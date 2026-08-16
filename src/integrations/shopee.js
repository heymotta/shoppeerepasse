const crypto = require('node:crypto');
const { setting } = require('../db');
const { extractProductFromText, generateSearchQueries } = require('../services/extractor');

function getShopeeConfig() {
  return {
    appId: setting('shopee_app_id') || process.env.SHOPEE_APP_ID || '',
    secret: setting('shopee_secret') || process.env.SHOPEE_SECRET || '',
    endpoint: setting('shopee_api_url') || process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql',
    affiliateId: setting('affiliate_id') || process.env.AFFILIATE_ID || ''
  };
}

function sign(appId, secret, payload, timestamp) {
  const factor = `${appId}${timestamp}${payload}${secret}`;
  return crypto.createHash('sha256').update(factor).digest('hex');
}

async function callShopee(query, variables = {}) {
  const cfg = getShopeeConfig();
  if (!cfg.appId || !cfg.secret) {
    throw new Error('Shopee App ID e Secret não configurados no painel');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ query, variables });
  const signature = sign(cfg.appId, cfg.secret, payload, timestamp);
  const authHeader = `SHA256 Credential=${cfg.appId}, Timestamp=${timestamp}, Signature=${signature}`;

  const timeoutMs = Number(setting('request_timeout', '15000')) || 15000;
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: payload,
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Shopee API HTTP ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map(e => e.message).join('; ') || 'Erro retornado pela API da Shopee');
  }

  return json.data;
}

async function resolveToCanonicalShopeeUrl(url) {
  if (!url) return url;
  let targetUrl = url.trim();

  // Se já for uma URL canônica de produto
  const directMatch = targetUrl.match(/(?:product\/|\/opaanlp\/)(\d+)\/(\d+)/i) || targetUrl.match(/-i\.(\d+)\.(\d+)/i);
  if (directMatch) {
    return `https://shopee.com.br/product/${directMatch[1]}/${directMatch[2]}`;
  }

  // Se for shortlink (s.shopee.com.br ou shp.ee), resolve o redirecionamento
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(4000)
    });

    const location = res.headers.get('location');
    if (location) {
      const match = location.match(/(?:\/opaanlp\/|\/product\/)(\d+)\/(\d+)/i) || location.match(/-i\.(\d+)\.(\d+)/i);
      if (match) {
        return `https://shopee.com.br/product/${match[1]}/${match[2]}`;
      }
      return location.split('?')[0];
    }
  } catch (e) {}

  return targetUrl;
}

async function generateShortLink(originUrl) {
  const cfg = getShopeeConfig();
  const mutation = `mutation GenerateLink($input: ShortLinkInput!) {
    generateShortLink(input: $input) {
      shortLink
    }
  }`;

  const subIds = cfg.affiliateId ? [cfg.affiliateId] : [];
  const variables = {
    input: {
      originUrl: originUrl.trim(),
      subIds: subIds
    }
  };

  const data = await callShopee(mutation, variables);
  return data?.generateShortLink?.shortLink || null;
}

async function getProductImage(textContent) {
  if (!textContent) return null;
  const keyword = extractProductFromText(textContent);
  if (!keyword || keyword.length < 3) return null;

  const queries = generateSearchQueries(keyword);
  for (const q of queries) {
    try {
      const query = `query SearchImage($keyword: String!) {
        productOfferV2(keyword: $keyword, limit: 1) {
          nodes {
            imageUrl
          }
        }
      }`;
      const data = await callShopee(query, { keyword: q });
      const img = data?.productOfferV2?.nodes?.[0]?.imageUrl;
      if (img) return img;
    } catch (e) {}
  }
  return null;
}

async function convertShopeeLink(originalUrl, textContent = '') {
  const cfg = getShopeeConfig();
  if (!cfg.appId || !cfg.secret) {
    return { available: false, reason: 'Shopee App ID ou Secret não configurados no painel' };
  }

  if (!originalUrl || !/shopee\.|shp\.ee/i.test(originalUrl)) {
    return { available: false, reason: 'Link ignorado: não é um link da Shopee' };
  }

  try {
    const canonicalUrl = await resolveToCanonicalShopeeUrl(originalUrl);
    let shortLink = await generateShortLink(canonicalUrl).catch(() => null);

    if (!shortLink) {
      shortLink = await generateShortLink(originalUrl);
    }

    if (shortLink) {
      const imageUrl = await getProductImage(textContent);
      return {
        available: true,
        url: shortLink,
        title: 'Produto Shopee Original',
        confidence: 100,
        imageUrl: imageUrl
      };
    }
  } catch (error) {
    return { available: false, reason: `Erro ao converter link na Shopee: ${error.message}` };
  }

  return { available: false, reason: 'A Shopee não retornou o link de afiliado para esta URL' };
}

async function test() {
  const cfg = getShopeeConfig();
  if (!cfg.appId || !cfg.secret) {
    throw new Error('Configure o Shopee App ID e Shopee Secret na aba Integrações');
  }

  const query = `query TestAuth {
    productOfferV2(keyword: "teste", page: 1, limit: 1) {
      nodes {
        itemId
        productName
      }
    }
  }`;

  const data = await callShopee(query);
  return { ok: true, data };
}

module.exports = {
  getShopeeConfig,
  generateShortLink,
  convertShopeeLink,
  getProductImage,
  resolveToCanonicalShopeeUrl,
  test
};
