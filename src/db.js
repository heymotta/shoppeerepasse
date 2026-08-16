const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

const dbFile = path.resolve(config.dbPath);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK(kind IN ('source','destination')), name TEXT NOT NULL, remote_id TEXT NOT NULL UNIQUE, description TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS routing_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, destination_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, active INTEGER NOT NULL DEFAULT 1, UNIQUE(source_id,destination_id));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL UNIQUE, source_group_id INTEGER REFERENCES groups(id), source_remote_id TEXT NOT NULL, event_json TEXT NOT NULL, text_content TEXT DEFAULT '', original_url TEXT DEFAULT '', platform TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'queued', product_title TEXT DEFAULT '', shopee_url TEXT DEFAULT '', confidence REAL, error TEXT DEFAULT '', received_at TEXT NOT NULL, processed_at TEXT);
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL, last_error TEXT DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS processing_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER REFERENCES messages(id), level TEXT NOT NULL, event TEXT NOT NULL, details TEXT DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_jobs_ready ON jobs(status,next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status,received_at);
`);

function now() { return new Date().toISOString(); }
function setting(key, fallback = '') { const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key); return row ? row.value : fallback; }
function setSetting(key, value) { db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').run(key, String(value), now()); }
function log(messageId, level, event, details = '') { db.prepare('INSERT INTO processing_logs(message_id,level,event,details,created_at) VALUES(?,?,?,?,?)').run(messageId || null, level, event, typeof details === 'string' ? details : JSON.stringify(details), now()); }
module.exports = { db, now, setting, setSetting, log };
