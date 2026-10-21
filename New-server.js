import 'dotenv/config';

import express from 'express';
import { Telegraf } from 'telegraf';
import cors from 'cors';

import { groq_Analyze_Meal_Img } from './lib/groq.js';
import { init_Db, add_Element, get_All_Data, clear_Buffer } from './lib/TursoDB.js';

const app = express();
app.use(express.json());
app.use(cors());
app.set('trust proxy', true);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('Var ambiente non configurata');
}

const bot = new Telegraf(BOT_TOKEN);

app.use('/telegram-webhook', (req, res, next) => {
    next();
})

app.use(bot.webhookCallback('/telegram-webhook'));

bot.start((ctx) => {
    ctx.reply("Benvenuto! Bot collegato con successo.");
});

async function get_Telegram_Img(fileId) {
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

        const img = await get_Telegram_Img(fileId);

        const nutrition = await groq_Analyze_Meal_Img(img);

        const new_data = {
            type: "meal",
            timestamp: new Date(),
            telegram_file_id: fileId,
            status: "analyzed",
            nutrition
        }

        await add_Element(new_data);

        await ctx.reply(`✅ Foto analizzata e salvata nel database!\n${JSON.stringify(nutrition, null, 2)}`);
    } catch (error) {
        console.error('Errore gestione foto:', error);
        await ctx.reply(`❌ Errore (${error})`);
    }
})

app.get('/api/sync/pull', async (req, res) => {
    console.log("✅ Server pullato correttamente (lettura da DB)");
    const data = await get_All_Data();
    res.json({ success: true, data });
});

app.post('/api/sync/ack', async (req, res) => {
    console.log("✅ Svuotamento buffer Turso completato");
    await clear_Buffer();
    res.json({ success: true, message: "Cloud ripulito dal database!" });
});

app.get('/', (req, res) => {
    res.send('Fit Server con Webhook attivo e Turso persistente! 🚀');
});

const PORT = Number(process.env.PORT) || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, '');

async function startServer() {
    await init_Db();

    app.listen(PORT, () => {
        console.log(`✅ Server avviato sulla porta ${PORT}`);

        if (RENDER_URL) {
            bot.telegram.setWebhook(`${RENDER_URL}/telegram-webhook`)
                .then(() => {
                    console.log(`✅ Webhook Telegram impostato su: ${RENDER_URL}/telegram-webhook`);
                })
                .catch((error) => {
                    console.error('❌ Errore durante la configurazione del webhook Telegram:', error);
                });
        } else {
            console.warn('❌ RENDER_EXTERNAL_URL non configurato: webhook Telegram non impostato');
        }
    });
}

startServer().catch((error) => {
    console.error('❌ Avvio server fallito:', error);
    process.exitCode = 1;
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));