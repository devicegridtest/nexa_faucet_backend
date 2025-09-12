// database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : path.join(__dirname, 'faucet.db');

const db = new sqlite3.Database(dbPath);

// Crear tabla si no existe
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS requests (
            address TEXT PRIMARY KEY,
            last_request INTEGER NOT NULL
        )
    `);
});

function canRequest(address) {
    return new Promise((resolve, reject) => {
        db.get(
            `SELECT last_request FROM requests WHERE address = ?`, 
            [address], 
            (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(true);

                const cooldown = parseInt(process.env.COOLDOWN_MS);
                const now = Date.now();
                resolve((now - row.last_request) > cooldown);
            }
        );
    });
}

function saveRequest(address) {
    return new Promise((resolve, reject) => {
        const now = Date.now();
        db.run(
            `INSERT OR REPLACE INTO requests (address, last_request) VALUES (?, ?)`,
            [address, now],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

module.exports = { canRequest, saveRequest, db };