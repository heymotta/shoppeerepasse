const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, replaceUrl } = require('../src/services/parser');
const { score } = require('../src/services/matcher');

test('extrai URL e plataforma sem perder emojis ou texto', () => {
  const result = parse({ data: { key: { id: 'abc', remoteJid: '1@g.us' }, message: { conversation: '🔥 Oferta Produto XYZ https://mercadolivre.com.br/item?a=1' } } });
  assert.equal(result.messageId, 'abc');
  assert.equal(result.platform, 'mercado_livre');
  assert.equal(result.originalUrl, 'https://mercadolivre.com.br/item?a=1');
  assert.equal(replaceUrl(result.text, result.originalUrl, 'https://shopee.test/x'), '🔥 Oferta Produto XYZ https://shopee.test/x');
});

test('calcula score por termos compartilhados', () => {
  assert.ok(score('Fone Bluetooth JBL por R$ 99', 'JBL Fone Bluetooth sem fio') > 40);
  assert.equal(score('', 'qualquer produto'), 0);
});
