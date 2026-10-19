const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server_buffer.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');


function initServerDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS pending_meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_file_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            dish_name TEXT,
            calories REAL,
            protein REAL,
            carbs REAL,
            fat REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("✅ Database server buffer inizializzato con successo.");
}


function saveMealToBuffer(data) {
    const { timestamp, telegram_file_id, nutrition } = data;
    const { dish_name, calories, protein, carbs, fat } = nutrition || {};

    const sql = `
        INSERT INTO pending_meals (telegram_file_id, timestamp, dish_name, calories, protein, carbs, fat)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const stmt = db.prepare(sql);
    const result = stmt.run(
        telegram_file_id,
        new Date(timestamp).toISOString(),
        dish_name || 'Sconosciuto',
        calories || 0,
        protein || 0,
        carbs || 0,
        fat || 0
    );

    return result.lastInsertRowid;
}

/**
 * Recupera tutti i pasti in attesa di essere scaricati dall'app desktop
 */
function getPendingMeals() {
    const sql = `SELECT * FROM pending_meals ORDER BY id ASC`;
    const rows = db.prepare(sql).all();

    // Riconverte i dati nel formato atteso dalla tua app client/desktop
    return rows.map(row => ({
        type: 'meal',
        timestamp: row.timestamp,
        telegram_file_id: row.telegram_file_id,
        status: 'analyzed',
        nutrition: {
            dish_name: row.dish_name,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat
        }
    }));
}

/**
 * Svuota il buffer dopo che il client ha confermato la sincronizzazione (ACK)
 */
function clearMealBuffer() {
    const stmt = db.prepare(`DELETE FROM pending_meals`);
    const result = stmt.run();

    // Ripristina l'autoincrement degli ID
    db.prepare(`DELETE FROM sqlite_sequence WHERE name='pending_meals'`).run();

    return result.changes;
}

module.exports = {
    initServerDb,
    saveMealToBuffer,
    getPendingMeals,
    clearMealBuffer
};