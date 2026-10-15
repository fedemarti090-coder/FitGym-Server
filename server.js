require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.set('trust proxy', true);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

let cloudBuffer = [];

app.use('/telegram-webhook', (req, res, next) => {
  console.log("🔔 Richiesta webhook ricevuta da Telegram!");
  next();
});

app.use(bot.webhookCallback('/telegram-webhook'));

bot.start((ctx) => {
  ctx.reply("Benvenuto! Bot collegato con successo.");
});

bot.on('photo', async (ctx) => {
  try {
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    const fileId = bestPhoto.file_id;

    cloudBuffer.push({
      type: 'meal',
      timestamp: new Date(),
      telegram_file_id: fileId,
      status: 'pending_ai_analysis'
    });

    console.log(`Img id salvato: ${fileId}`);
    await ctx.reply("📸 Foto ricevuta e salvata nel cloud temporaneo!");
  } catch (error) {
    console.error("Errore gestione foto:", error);
    await ctx.reply("❌ Errore durante il salvataggio.");
  }
});

app.get('/api/sync/pull', (req, res) => {
  res.json({ success: true, data: cloudBuffer });
});

app.post('/api/sync/ack', (req, res) => {
  cloudBuffer = [];
  res.json({ success: true, message: "Cloud ripulito!" });
});

app.get('/', (req, res) => {
  res.send('Fit Server con Webhook attivo! 🚀');
});

const PORT = process.env.PORT || 3000;
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;

app.listen(PORT, async () => {
  console.log(`Server avviato sulla porta ${PORT}`);

  if (RENDER_URL) {
    await bot.telegram.setWebhook(`${RENDER_URL}/telegram-webhook`);
    console.log(`🔗 Webhook Telegram impostato su: ${RENDER_URL}/telegram-webhook`);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));