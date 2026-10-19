const { initServerDb, saveMealToBuffer, getPendingMeals, clearMealBuffer } = require('./serverDb');

console.log("=== INIZIO TEST DATABASE LOCALE ===");

// 1. Inizializzazione
initServerDb();

// 2. Simulazione di inserimento dati da Telegram
const pastoFinto = {
    timestamp: new Date(),
    telegram_file_id: "AgACAgQAAxkBAAN...",
    nutrition: {
        dish_name: "Ravioli di zucca con gamberi",
        calories: 650,
        protein: 25,
        carbs: 55,
        fat: 15
    }
};

const idInserito = saveMealToBuffer(pastoFinto);
console.log(`✅ Pasto test salvato con ID: ${idInserito}`);

const buffer = getPendingMeals();
console.log("📦 Dati attuali nel buffer server:", JSON.stringify(buffer, null, 2));


console.log("=== TEST COMPLETATO CON SUCCESSO ===");