require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DATABASE_PATH || './data/bot.sqlite',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  webhookSecret: process.env.WEBHOOK_SECRET || 'change-me-too',
  workerPollMs: Number(process.env.WORKER_POLL_MS || 1000),
  shopeeApiUrl: process.env.SHOPEE_API_URL || ''
};
