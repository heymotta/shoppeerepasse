const URL_RE = /https?:\/\/[^\s<>]+/gi;
const platforms = [
  { name: 'mercado_livre', test: u => /mercadolivre\.|meli\.|mlb\./i.test(u) },
  { name: 'amazon', test: u => /amazon\.|amzn\./i.test(u) },
  { name: 'shopee', test: u => /shopee\.|shp\.ee/i.test(u) },
  { name: 'magalu', test: u => /magazineluiza\.|magalu\./i.test(u) },
  { name: 'aliexpress', test: u => /aliexpress\./i.test(u) }
];

function parse(event) {
  const data = event.data || event;
  const key = data.key || {};
  const message = data.message || {};

  const fromMe = Boolean(key.fromMe || data.fromMe);
  const sourceRemoteId = key.remoteJid || data.remoteJid || data.sender || '';
  const messageId = key.id || data.id || data.keyId || '';

  const text = (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    data.text ||
    ''
  );

  const rawUrl = text.match(URL_RE)?.[0] || '';
  const url = rawUrl.replace(/[),.;!?]+$/, '');
  const platform = platforms.find(p => p.test(url))?.name || (url ? 'other' : '');

  const media = message.imageMessage || message.videoMessage || message.documentMessage || message.audioMessage;
  const mediaUrl = media?.url || media?.directPath || data.mediaUrl || '';
  const mediaType = message.imageMessage ? 'image' : (message.videoMessage ? 'video' : (message.documentMessage ? 'document' : (message.audioMessage ? 'audio' : '')));
  const fileName = media?.fileName || data.fileName || '';

  return {
    messageId,
    sourceRemoteId,
    fromMe,
    text,
    originalUrl: url,
    platform,
    mediaUrl,
    mediaType,
    fileName
  };
}

function replaceUrl(text, original, replacement) {
  if (!original) return text;
  return text.replace(original, replacement);
}

module.exports = { parse, replaceUrl };
