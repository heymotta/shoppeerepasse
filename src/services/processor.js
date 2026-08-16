const { db, now, setting, log } = require('../db');
const evolution = require('../integrations/evolution');
const shopee = require('../integrations/shopee');
const { replaceUrl, parse } = require('./parser');

async function processJob(job) {
  const message = db.prepare('SELECT * FROM messages WHERE id=?').get(job.message_id);
  if (!message) return;

  const source = db.prepare("SELECT * FROM groups WHERE (remote_id=? OR id=?) AND kind='source' AND active=1")
    .get(message.source_remote_id, message.source_group_id);

  if (!source) {
    return fail(message, `Grupo de origem (${message.source_remote_id}) não está cadastrado ou está inativo no painel`, 'ignored');
  }

  const destinations = db.prepare('SELECT g.* FROM groups g JOIN routing_rules r ON r.destination_id=g.id WHERE r.source_id=? AND r.active=1 AND g.active=1').all(source.id);
  if (!destinations || destinations.length === 0) {
    return fail(message, `Nenhuma regra de rota ativa para o grupo "${source.name}"`, 'ignored');
  }

  // REGRA: Só converte se o link for da Shopee
  if (!message.original_url || !/shopee\.|shp\.ee/i.test(message.original_url)) {
    return fail(message, 'Mensagem ignorada: o link não é da Shopee (configurado para converter apenas links Shopee)', 'ignored');
  }

  // Converte EXATAMENTE o mesmo produto para o link de afiliado e busca imagem
  const result = await shopee.convertShopeeLink(message.original_url, message.text_content);
  if (!result.available || !result.url) {
    return fail(message, result.reason || 'Não foi possível gerar o link de afiliado para este produto da Shopee', 'failed');
  }

  const outgoing = replaceUrl(message.text_content, message.original_url, result.url);

  let rawEvent = null;
  let parsed = { text: outgoing };
  try {
    rawEvent = JSON.parse(message.event_json);
    parsed = parse(rawEvent);
  } catch (e) {}

  let sent = 0;
  for (const destination of destinations) {
    await evolution.send(parsed, destination.remote_id, outgoing, rawEvent, result.imageUrl);
    sent++;
  }

  db.prepare("UPDATE messages SET status='sent',shopee_url=?,product_title=?,confidence=?,processed_at=? WHERE id=?")
    .run(result.url, result.title || 'Produto Shopee Original', 100, now(), message.id);

  log(message.id, 'info', 'message_sent', `Link original convertido com sucesso para seu afiliado e enviado para ${sent} grupo(s) com foto do produto: ${destinations.map(d => d.name).join(', ')}`);
}

function fail(message, error, status = 'failed') {
  db.prepare('UPDATE messages SET status=?,error=?,processed_at=? WHERE id=?').run(status, error, now(), message.id);
  log(message.id, status === 'failed' ? 'error' : 'warn', status, error);
}

async function runOne() {
  const job = db.prepare("SELECT * FROM jobs WHERE status='queued' AND next_attempt_at<=? ORDER BY id LIMIT 1").get(now());
  if (!job) return false;

  db.prepare("UPDATE jobs SET status='processing',attempts=attempts+1,updated_at=? WHERE id=?").run(now(), job.id);
  try {
    await processJob(job);
    db.prepare("UPDATE jobs SET status='done',updated_at=? WHERE id=?").run(now(), job.id);
  } catch (error) {
    const attempts = job.attempts + 1;
    const max = Number(setting('max_attempts') || process.env.MAX_ATTEMPTS || 3);
    if (attempts >= max) {
      db.prepare("UPDATE jobs SET status='dead',last_error=?,updated_at=? WHERE id=?").run(error.message, now(), job.id);
      fail(db.prepare('SELECT * FROM messages WHERE id=?').get(job.message_id), error.message);
    } else {
      const next = new Date(Date.now() + Math.min(300000, 1000 * 2 ** attempts)).toISOString();
      db.prepare("UPDATE jobs SET status='queued',next_attempt_at=?,last_error=?,updated_at=? WHERE id=?").run(next, error.message, now(), job.id);
      log(job.message_id, 'error', 'retry_scheduled', error.message);
    }
  }
  return true;
}

module.exports = { runOne, processJob };
