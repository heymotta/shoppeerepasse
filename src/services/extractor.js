const HOOK_PATTERNS = [
  /^(?:quanto\s+t[aá]|descont[aã]o|corre+|aten[çc][aã]o|olha\s+s[oó]|alerta|super\s+oferta|mega\s+oferta|oferta|promo[çc][aã]o|achadinho|imperd[ií]vel|baixou|menor\s+pre[çc]o|urgente|top|aproveit|saindo\s+agora|n[aã]o\s+perca|loucura|bom\s+dia|boa\s+tarde|boa\s+noite|genteee+|chocad|veja|confira|pra\s+facilitar|para\s+facilitar)/i,
  /(?:puro\s+charme|lindo\s+lindo|maravilhoso|perfeito|olha\s+isso|coisa\s+mais\s+linda|fofura|apaixonada|amei)/i,
  /^(?:🚨|🔥|😱|⚡|💥|🛒|👀|📢|🏷️|✨|👇|🎉|😍|❤️|🔝|⚠️)+\s*(?:[A-ZÀ-Ú\s!]{3,35})$/u
];

const PRICE_AND_CTA_PATTERNS = [
  /^(?:de\s*r\$|por\s*r\$|poor\s*r\$|poor|r\$\s*\d|no\s*pix|recorr[eê]ncia|em\s*\d+x|com\s*cupom|frete|cupom|compre|link|acesse|clique|use\s*o\s*cupom|c[oó]digo|valor|pagando|cart[aã]o|cashback|estoque|garanta|corra)/i,
  /(?:sujeit[oa]\s+a\s+altera[çc]|todas\s+as\s+promo[çc][oõ]es|valores\s+sujeitos|promo[çc][aã]o\s+v[aá]lida)/i,
  /(?:r\$\s*[\d.,]+.*ou\s+recorr)/i
];

function cleanLine(line) {
  if (!line) return '';
  return line
    .replace(/[\u{1F600}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200B}-\u{200D}]/gu, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHookLine(clean) {
  if (clean.length < 3) return true;
  for (const pattern of HOOK_PATTERNS) {
    if (pattern.test(clean)) return true;
  }
  // Linhas curtas em caixa alta como "OFERTA!" ou "CORRE!"
  if (clean.length < 30 && /^[A-ZÀ-Ú\s!?.:-]+$/.test(clean) && !/\d/.test(clean)) {
    return true;
  }
  return false;
}

function isPriceOrCta(clean) {
  for (const pattern of PRICE_AND_CTA_PATTERNS) {
    if (pattern.test(clean)) return true;
  }
  return false;
}

function extractProductFromText(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const candidates = [];

  for (const line of lines) {
    const clean = cleanLine(line);
    if (!clean || clean.length < 5) continue;
    if (isPriceOrCta(clean)) continue;

    // Se for hook line, só adiciona com score baixo se não houver outra
    const isHook = isHookLine(clean);

    // Remove preços residuais no final da linha (ex: "Berço Americano R$ 1149")
    const withoutTrailingPrice = clean
      .replace(/(?:de\s*r\$|por\s*r\$|r\$|de\s+|por\s+)\s*[\d.,]+.*$/i, '')
      .replace(/\s*-\s*r\$.*$/i, '')
      .trim();

    if (withoutTrailingPrice.length >= 5) {
      candidates.push({
        text: withoutTrailingPrice,
        score: (isHook ? 0 : 50) + Math.min(withoutTrailingPrice.length, 60)
      });
    }
  }

  if (candidates.length > 0) {
    // Ordena pelo maior score (linha mais descritiva e sem hook)
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].text;
  }

  // Fallback: se tudo foi filtrado, pega o texto limpo sem URLs e sem preços
  return cleanLine(text)
    .replace(/(?:r\$|\$)\s*[\d.,]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function extractSlugFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;

    // Mercado Livre: /fralda-huggies-tripla-protecao-g-78-tiras/p/MLB...
    if (/mercadolivre|meli/i.test(parsed.hostname)) {
      const match = path.match(/\/([a-z0-9-]+)(?:\/p\/|\/MLB|\?|$)/i);
      if (match && match[1] && match[1].length > 6 && !['produto', 'item', 'p', 'dp'].includes(match[1].toLowerCase())) {
        return match[1].replace(/-/g, ' ');
      }
    }

    // Amazon: /Fralda-Huggies-Tripla-Proteção-G/dp/...
    if (/amazon|amzn/i.test(parsed.hostname)) {
      const match = path.match(/\/([^\/]+)\/dp\//i);
      if (match && match[1] && match[1].length > 5) {
        return decodeURIComponent(match[1]).replace(/[-_+]/g, ' ');
      }
    }

    // Magalu: /fralda-huggies-tripla-protecao.../p/...
    if (/magazineluiza|magalu/i.test(parsed.hostname)) {
      const match = path.match(/\/([a-z0-9-]+)\/p\//i);
      if (match && match[1] && match[1].length > 6) {
        return match[1].replace(/-/g, ' ');
      }
    }
  } catch (e) {}
  return null;
}

async function fetchOgTitle(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.html)'
      },
      signal: AbortSignal.timeout(3000)
    });
    const html = await res.text();
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i)
      || html.match(/<title>([^<]+)<\/title>/i);

    if (ogMatch && ogMatch[1]) {
      let title = ogMatch[1]
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s*\|\s*.*$/, '')
        .replace(/\s*-\s*Mercado Livre.*$/i, '')
        .replace(/\s*:\s*Amazon.*$/i, '')
        .replace(/\s*-\s*Magazine Luiza.*$/i, '')
        .trim();
      return cleanLine(title);
    }
  } catch (e) {}
  return null;
}

function generateSearchQueries(productTitle) {
  if (!productTitle) return [];
  const clean = cleanLine(productTitle)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(w => w.length >= 1);
  const queries = [];

  // Query 1: Termo completo (até 6 palavras)
  if (words.length > 0) {
    queries.push(words.slice(0, 6).join(' '));
  }

  // Query 2: Primeiras 4 palavras (marca + tipo + modelo)
  if (words.length > 4) {
    queries.push(words.slice(0, 4).join(' '));
  }

  // Query 3: Primeiras 3 palavras
  if (words.length > 3) {
    queries.push(words.slice(0, 3).join(' '));
  }

  return [...new Set(queries.filter(q => q.length >= 3))];
}

module.exports = {
  extractProductFromText,
  extractSlugFromUrl,
  fetchOgTitle,
  generateSearchQueries,
  cleanLine
};
