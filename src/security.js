const crypto = require('node:crypto');
const config = require('./config');
const sessions = new Map();
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function login(user, password) { if (user !== config.adminUser || hash(password) !== hash(config.adminPassword)) return null; const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Date.now() + 86400000); return token; }
function authorized(req) { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (!token) return false; const expires = sessions.get(token); if (!expires || expires < Date.now()) { sessions.delete(token); return false; } return true; }
module.exports = { login, authorized };
