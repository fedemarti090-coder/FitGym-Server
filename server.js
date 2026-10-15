require('dotenv').config();

const express = require('express');
const { Telegraf } = require('telegraf');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

let cloudBuffer = [];

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

    console.log(`Img id: ${fileId}`);

    await ctx.reply("📸 Foto ricevuta e salvata nel cloud temporaneo! Ti aggiorno presto.");
  } catch (error) {
    console.error("Errore gestione foto:", error);
    await ctx.reply("❌ Errore durante il salvataggio della foto.");
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server avviato sulla porta ${PORT}`);
  
  bot.launch();
  console.log("🤖 Bot Telegram attivo in background nel server.");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));