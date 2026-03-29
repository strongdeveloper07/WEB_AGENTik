const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../agentik.db'));
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullname TEXT,
  login TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  polis TEXT UNIQUE,
  passport TEXT,
  birth_date TEXT,
  clinic TEXT,
  device_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS agents (
  uid TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  hostname TEXT NOT NULL,
  version TEXT NOT NULL,
  session_token TEXT,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'online'
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_uid TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT,
  status TEXT DEFAULT 'pending',
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_uid) REFERENCES agents(uid)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_uid TEXT NOT NULL,
  patient_id INTEGER,
  filename TEXT NOT NULL,
  stored_as TEXT NOT NULL,
  size INTEGER,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_uid) REFERENCES agents(uid),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER REFERENCES users(id),
  fullname TEXT NOT NULL,
  phone TEXT,
  polis TEXT UNIQUE NOT NULL,
  clinic TEXT,
  blood_type TEXT,
  allergies TEXT,
  chronic_diseases TEXT,
  photo TEXT,
  last_visit TEXT,
  total_visits INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER REFERENCES patients(id),
  visit_date DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

module.exports = db;