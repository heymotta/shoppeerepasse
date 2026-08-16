const { setting } = require('../db');

function credentials() {
  return {
    url: (setting('evolution_url') || process.env.EVOLUTION_URL || '').replace(/\/$/, ''),
    key: setting('evolution_key') || process.env.EVOLUTION_KEY || '',
    instance: setting('evolution_instance') || process.env.EVOLUTION_INSTANCE || ''
  };
}

async function call(path, options = {}) {
  const c = credentials();
  if (!c.url || !c.key) throw new Error('Evolution API não configurada (URL e API Key são obrigatórios)');

  const timeoutMs = Number(setting('request_timeout', '15000')) || 15000;
  const response = await fetch(`${c.url}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: c.key,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Evolution API respondeu HTTP ${response.status}: ${errText}`);
  }

  return response.json().catch(() => ({}));
}

async function test() {
  const c = credentials();
  if (!c.url || !c.key) throw new Error('Evolution URL e API Key são necessários');

  if (c.instance) {
    try {
      return await call(`/instance/connectionState/${encodeURIComponent(c.instance)}`);
    } catch (e) {
      return await call(`/instance/fetchInstances`);
    }
  }

  return await call(`/instance/fetchInstances`);
}

async function getBase64FromMedia(rawMessage) {
  const c = credentials();
  if (!c.instance || !rawMessage) return null;
  try {
    const res = await call(`/chat/getBase64FromMediaMessage/${encodeURIComponent(c.instance)}`, {
      method: 'POST',
      body: JSON.stringify({
        message: rawMessage,
        convertToMp4: false
      })
    });
    if (res?.base64) {
      return res.base64.startsWith('data:') ? res.base64 : `data:image/jpeg;base64,${res.base64}`;
    }
  } catch (e) {}
  return null;
}

async function send(parsedMessage, destination, text, rawEvent = null, productImageUrl = null) {
  const c = credentials();
  if (!c.instance) throw new Error('Instância da Evolution API não definida');

  const number = destination.includes('@') ? destination : `${destination}@g.us`;

  let mediaPayload = null;

  // 1. Mídia da mensagem original do WhatsApp (se foi enviada como imagem)
  const isMedia = parsedMessage?.mediaType && ['image', 'video', 'document', 'audio'].includes(parsedMessage.mediaType);
  if (isMedia) {
    mediaPayload = parsedMessage.mediaUrl;
    if (rawEvent) {
      const msgObj = rawEvent.data?.message || rawEvent.message || rawEvent;
      const base64 = await getBase64FromMedia(msgObj);
      if (base64) mediaPayload = base64;
    }
  }

  // 2. Se a mensagem não era imagem, mas temos a URL da imagem do produto da Shopee
  if (!mediaPayload && productImageUrl) {
    mediaPayload = productImageUrl.endsWith('.jpg') ? productImageUrl : `${productImageUrl}.jpg`;
  }

  // Se tivermos imagem, tenta enviar como foto + legenda
  if (mediaPayload) {
    try {
      return await call(`/message/sendMedia/${encodeURIComponent(c.instance)}`, {
        method: 'POST',
        body: JSON.stringify({
          number,
          mediatype: 'image',
          mimetype: 'image/jpeg',
          media: mediaPayload,
          caption: text,
          fileName: 'oferta.jpeg'
        })
      });
    } catch (mediaError) {
      // Se a Evolution API falhar ao processar a imagem (ex: formato não suportado ou erro 500 no sharp),
      // faz fallback transparente para envio de texto com linkPreview para NUNCA perder o envio da oferta!
    }
  }

  // 3. Fallback ou envio padrão: mensagem de texto com linkPreview ativo
  return call(`/message/sendText/${encodeURIComponent(c.instance)}`, {
    method: 'POST',
    body: JSON.stringify({
      number,
      text,
      linkPreview: true,
      options: {
        linkPreview: true,
        presence: 'composing'
      }
    })
  });
}

async function groups() {
  const c = credentials();
  if (!c.instance) throw new Error('Instância da Evolution API não definida');
  return call(`/group/fetchAllGroups/${encodeURIComponent(c.instance)}?getParticipants=false`);
}

module.exports = { test, send, groups, credentials, getBase64FromMedia };
