const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../agentik.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, device_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

db.exec(`CREATE TABLE IF NOT EXISTS agents (uid TEXT PRIMARY KEY, platform TEXT NOT NULL, hostname TEXT NOT NULL, version TEXT NOT NULL, session_token TEXT, last_seen DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'online')`);

db.exec(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_uid TEXT NOT NULL, type TEXT NOT NULL, payload TEXT, status TEXT DEFAULT 'pending', result TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (agent_uid) REFERENCES agents(uid))`);

db.exec(`CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_uid TEXT NOT NULL, filename TEXT NOT NULL, stored_as TEXT NOT NULL, size INTEGER, uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (agent_uid) REFERENCES agents(uid))`);

module.exports = db;
