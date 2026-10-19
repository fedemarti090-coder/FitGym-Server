const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const { Telegraf } = require('telegraf');
const cors = require('cors');

const { initServerDb, saveMealToBuffer, getPendingMeals, clearMealBuffer } = require('./serverDb.js');

const { main: analyzeMealImage } = require('./test-groq.js');

const app = express();
app.use(express.json());
app.use(cors());

app.set('trust proxy', true);

initServerDb();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN non configurato nelle variabili d’ambiente');
}
const bot = new Telegraf(BOT_TOKEN);

app.use('/telegram-webhook', (req, res, next) => {
    console.log("🔔 Richiesta webhook ricevuta da Telegram!");
    next();
});

app.use(bot.webhookCallback('/telegram-webhook'));

bot.start((ctx) => {
    ctx.reply("Benvenuto! Bot collegato con successo.");
});

async function getTelegramFileUrl(fileId) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`, {
        signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) {
        throw new Error(`Telegram getFile fallito: HTTP ${res.status}`);
    }
    const data = await res.json();

    if (!data.ok) {
        throw new Error("Impossibile recuperare il file da Telegram");
    }

    const filePath = data.result.file_path;

    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
}

bot.on('photo', async (ctx) => {
    try {
        const photos = ctx.message.photo;
        const bestPhoto = photos[photos.length - 1];
        const fileId = bestPhoto.file_id;

        console.log(`Foto Telegram ricevuta (file_id: ${fileId}); recupero URL immagine`);
        const img = await getTelegramFileUrl(fileId);
        console.log("URL immagine recuperato; avvio analisi Groq");
        const nutrition = await analyzeMealImage(img);
        console.log("Analisi Groq completata; salvataggio su SQLite");
        
        const new_data = {
            type: 'meal',
            timestamp: new Date(),
            telegram_file_id: fileId,
            status: 'analyzed',
            nutrition
        };

        saveMealToBuffer(new_data);
        console.log(new_data);
        
        await ctx.reply(`✅ Foto analizzata e salvata nel database SQLite del server! ${JSON.stringify(nutrition)}`);

    } catch (error) {
        console.error("Errore gestione foto:", error);
        await ctx.reply(`❌ Errore (${error})`);
    }
});

app.get('/api/sync/pull', (req, res) => {
    console.log("Server pullato correttamente (lettura da DB)");
    const data = getPendingMeals();
    res.json({ success: true, data });
});

app.post('/api/sync/ack', (req, res) => {
    console.log("Svuotamento buffer SQLite completato");
    clearMealBuffer();
    res.json({ success: true, message: "Cloud ripulito dal database!" });
});

app.get('/', (req, res) => {
    res.send('Fit Server con Webhook attivo e SQLite persistente! 🚀');
});

const PORT = Number(process.env.PORT) || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, '');

app.listen(PORT, () => {
    console.log(`Server avviato sulla porta ${PORT}`);

    if (RENDER_URL) {
        bot.telegram.setWebhook(`${RENDER_URL}/telegram-webhook`)
            .then(() => {
                console.log(`🔗 Webhook Telegram impostato su: ${RENDER_URL}/telegram-webhook`);
            })
            .catch((error) => {
                console.error('Errore durante la configurazione del webhook Telegram:', error);
            });
    } else {
        console.warn('RENDER_EXTERNAL_URL non configurato: webhook Telegram non impostato');
    }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));