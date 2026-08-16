const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db, now, setting, setSetting, log } = require('./db');
const { login, authorized } = require('./security');
const { parse } = require('./services/parser');
const { runOne } = require('./services/processor');
const evolution = require('./integrations/evolution');
const shopee = require('./integrations/shopee');
const config = require('./config');

const publicDir = path.resolve('public');

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

async function body(req) {
  let data = '';
  for await (const chunk of req) data += chunk;
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw new Error('JSON inválido');
  }
}

function safeSettings() {
  const hasShopee = Boolean((setting('shopee_app_id') || process.env.SHOPEE_APP_ID) && (setting('shopee_secret') || process.env.SHOPEE_SECRET));
  return {
    evolution_url: setting('evolution_url') || process.env.EVOLUTION_URL || '',
    evolution_instance: setting('evolution_instance') || process.env.EVOLUTION_INSTANCE || '',
    request_timeout: setting('request_timeout') || process.env.REQUEST_TIMEOUT || '15000',
    max_attempts: setting('max_attempts') || process.env.MAX_ATTEMPTS || '3',
    send_without_link: setting('send_without_link') || process.env.SEND_WITHOUT_LINK || '0',
    send_mode: setting('send_mode') || process.env.SEND_MODE || 'preview',
    bot_active: setting('bot_active') || process.env.BOT_ACTIVE || '1',
    shopee_app_id: setting('shopee_app_id') || process.env.SHOPEE_APP_ID || '',
    shopee_api_url: setting('shopee_api_url') || process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql',
    affiliate_id: setting('affiliate_id') || process.env.AFFILIATE_ID || '',
    shopee_configured: hasShopee
  };
}

function requireAuth(req, res) {
  if (!authorized(req)) {
    json(res, 401, { error: 'Não autorizado' });
    return false;
  }
  return true;
}

async function api(req, res, url) {
  // Login
  if (req.method === 'POST' && url.pathname === '/api/login') {
    const b = await body(req);
    const token = login(b.user, b.password);
    return token ? json(res, 200, { token }) : json(res, 401, { error: 'Credenciais inválidas' });
  }

  // Webhooks Evolution API
  if (url.pathname.startsWith('/webhooks/evolution')) {
    const authHeader = req.headers['x-webhook-secret'] || req.headers['apikey'] || url.searchParams.get('secret');
    if (config.webhookSecret && config.webhookSecret !== 'change-me-too' && authHeader !== config.webhookSecret) {
      return json(res, 401, { error: 'Webhook não autorizado' });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'Método não permitido' });

    let event;
    try {
      event = await body(req);
    } catch {
      return json(res, 400, { error: 'JSON inválido' });
    }

    const parsed = parse(event);

    // Ignora mensagens enviadas pelo próprio bot
    if (parsed.fromMe) {
      return json(res, 200, { accepted: false, reason: 'Mensagem própria ignorada' });
    }

    if (!parsed.messageId || !parsed.sourceRemoteId) {
      return json(res, 202, { accepted: false, reason: 'Evento sem identificadores de mensagem/grupo' });
    }

    const isBotActive = (setting('bot_active') || process.env.BOT_ACTIVE || '1') === '1';
    if (!isBotActive) {
      log(null, 'warn', 'webhook_ignored', `Mensagem recebida de ${parsed.sourceRemoteId}, mas o Bot está INATIVO nas configurações.`);
      return json(res, 202, { accepted: false, reason: 'Bot inativo' });
    }

    const source = db.prepare("SELECT * FROM groups WHERE remote_id=? AND kind='source' AND active=1").get(parsed.sourceRemoteId);

    try {
      const result = db.prepare('INSERT INTO messages(message_id,source_group_id,source_remote_id,event_json,text_content,original_url,platform,received_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(parsed.messageId, source?.id || null, parsed.sourceRemoteId, JSON.stringify(event), parsed.text, parsed.originalUrl, parsed.platform, now());

      if (!source) {
        log(result.lastInsertRowid, 'warn', 'source_not_registered', `Mensagem recebida do grupo "${parsed.sourceRemoteId}", mas ele NÃO está cadastrado como Origem ativa no painel.`);
        db.prepare("UPDATE messages SET status='ignored',error='Grupo de origem não cadastrado ou inativo no painel',processed_at=? WHERE id=?").run(now(), result.lastInsertRowid);
        return json(res, 202, { accepted: true, queued: false, reason: 'Grupo de origem não cadastrado' });
      }

      db.prepare('INSERT INTO jobs(message_id,next_attempt_at,created_at,updated_at) VALUES(?,?,?,?)').run(result.lastInsertRowid, now(), now(), now());
      log(result.lastInsertRowid, 'info', 'webhook_queued', `Mensagem enfileirada com sucesso do grupo "${source.name}".`);
      return json(res, 202, { accepted: true, queued: true });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) {
        return json(res, 202, { accepted: true, duplicate: true });
      }
      throw e;
    }
  }

  // Rotas autenticadas
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET' && url.pathname === '/api/dashboard') {
    const count = q => db.prepare(q).get()?.n || 0;
    return json(res, 200, {
      settings: safeSettings(),
      metrics: {
        received: count('SELECT count(*) n FROM messages'),
        processed: count("SELECT count(*) n FROM messages WHERE status='sent'"),
        errors: count("SELECT count(*) n FROM messages WHERE status IN ('failed','dead')"),
        queued: count("SELECT count(*) n FROM jobs WHERE status IN ('queued','processing')"),
        converted: count("SELECT count(*) n FROM messages WHERE shopee_url<>''")
      }
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/settings') return json(res, 200, safeSettings());

  if (req.method === 'PUT' && url.pathname === '/api/settings') {
    const b = await body(req);
    const textKeys = ['evolution_url', 'evolution_instance', 'request_timeout', 'max_attempts', 'send_without_link', 'send_mode', 'bot_active', 'shopee_app_id', 'shopee_api_url', 'affiliate_id'];
    for (const key of textKeys) {
      if (b[key] !== undefined) setSetting(key, b[key]);
    }
    if (b.evolution_key) setSetting('evolution_key', b.evolution_key);
    if (b.shopee_secret) setSetting('shopee_secret', b.shopee_secret);
    return json(res, 200, safeSettings());
  }

  if (req.method === 'POST' && url.pathname === '/api/test/evolution') {
    try {
      const resTest = await evolution.test();
      return json(res, 200, { ok: true, data: resTest });
    } catch (e) {
      return json(res, 200, { ok: false, error: e.message });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/test/shopee') {
    try {
      const resTest = await shopee.test();
      return json(res, 200, { ok: true, data: resTest });
    } catch (e) {
      return json(res, 200, { ok: false, error: e.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/groups') {
    return json(res, 200, db.prepare('SELECT * FROM groups ORDER BY kind,name').all());
  }

  if (req.method === 'POST' && url.pathname === '/api/groups') {
    const b = await body(req);
    if (!b.name || !b.remote_id || !['source', 'destination'].includes(b.kind)) {
      return json(res, 400, { error: 'name, remote_id e kind são obrigatórios' });
    }
    const t = now();
    try {
      const r = db.prepare('INSERT INTO groups(kind,name,remote_id,description,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
        .run(b.kind, b.name, b.remote_id.trim(), b.description || '', b.active === false ? 0 : 1, t, t);
      return json(res, 201, { id: r.lastInsertRowid });
    } catch (e) {
      return json(res, 409, { error: 'ID de grupo já cadastrado' });
    }
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/groups/')) {
    const id = Number(url.pathname.split('/').pop());
    const b = await body(req);
    db.prepare('UPDATE groups SET name=COALESCE(?,name),description=COALESCE(?,description),active=COALESCE(?,active),updated_at=? WHERE id=?')
      .run(b.name, b.description, b.active === undefined ? null : (b.active ? 1 : 0), now(), id);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/groups/')) {
    const id = Number(url.pathname.split('/').pop());
    db.prepare('DELETE FROM groups WHERE id=?').run(id);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/routes') {
    return json(res, 200, db.prepare('SELECT r.*,s.name source_name,d.name destination_name FROM routing_rules r JOIN groups s ON s.id=r.source_id JOIN groups d ON d.id=r.destination_id').all());
  }

  if (req.method === 'POST' && url.pathname === '/api/routes') {
    const b = await body(req);
    try {
      db.prepare('INSERT INTO routing_rules(source_id,destination_id) VALUES(?,?)').run(b.source_id, b.destination_id);
      return json(res, 201, { ok: true });
    } catch {
      return json(res, 409, { error: 'Regra já existe' });
    }
  }

  if (req.method === 'DELETE' && url.pathname.startsWith('/api/routes/')) {
    const id = Number(url.pathname.split('/').pop());
    db.prepare('DELETE FROM routing_rules WHERE id=?').run(id);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/logs') {
    return json(res, 200, db.prepare('SELECT l.*,m.message_id,m.source_remote_id,m.status,m.original_url,m.shopee_url FROM processing_logs l LEFT JOIN messages m ON m.id=l.message_id ORDER BY l.id DESC LIMIT 100').all());
  }

  if (req.method === 'GET' && url.pathname === '/api/messages') {
    return json(res, 200, db.prepare('SELECT id,message_id,source_remote_id,text_content,original_url,platform,status,shopee_url,confidence,error,received_at,processed_at FROM messages ORDER BY id DESC LIMIT 100').all());
  }

  if (req.method === 'GET' && url.pathname === '/api/evolution/groups') {
    try {
      return json(res, 200, await evolution.groups());
    } catch (e) {
      return json(res, 502, { error: e.message });
    }
  }

  return json(res, 404, { error: 'Rota não encontrada' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/webhooks/')) {
      return await api(req, res, url);
    }
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.join(publicDir, file);
    if (!file.startsWith(publicDir) || !fs.existsSync(file)) {
      return json(res, 404, { error: 'Não encontrado' });
    }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
    res.writeHead(200, { 'Content-Type': `${types[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

// Worker integrado de fila em background
let workerRunning = true;
async function backgroundWorker() {
  while (workerRunning) {
    try {
      const worked = await runOne();
      if (!worked) {
        await new Promise(r => setTimeout(r, config.workerPollMs || 1000));
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, config.workerPollMs || 1000));
    }
  }
}
backgroundWorker();

server.listen(config.port, () => console.log(`Shopee bot ouvindo em http://localhost:${config.port}`));
