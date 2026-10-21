import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });


import { createClient } from "@libsql/client";

if (!process.env.TURSO_URL) {
    throw new Error('TURSO_URL non configurata nelle variabili d’ambiente');
}
if (!process.env.TURSO_TOKEN) {
    throw new Error('TURSO_TOKEN non configurato nelle variabili d’ambiente');
}

const db = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN
})

export async function init_Db() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS Buffer (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT
        )
    `);
    console.log('✅ Database Turso inizializzato');
}

export async function add_Element(data) {
    await db.execute({
        sql: "INSERT INTO Buffer (data) VALUES (?)",
        args: [JSON.stringify(data)]
    });
}

export async function get_All_Data() {
    const data = await db.execute(`
        SELECT * FROM Buffer
        `);
    return data.rows;
}

export async function clear_Buffer() {
    await db.execute("DELETE FROM Buffer");
    await db.execute("DELETE FROM sqlite_sequence WHERE name = 'Buffer'");
}
