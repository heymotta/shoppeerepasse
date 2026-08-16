const test = require('node:test');
const assert = require('node:assert/strict');
const { extractProductFromText, generateSearchQueries } = require('../src/services/extractor');

test('identifica corretamente o produto Huggies ignorando headline e preços', () => {
  const text = `QUANTO TÁ SAINDO AGORAAAA
Huggies Fralda Tripla Proteção G 78 Un
Por R$ 49,90 Ou na recorrência
Compre aqui: https://amzn.to/123`;

  const title = extractProductFromText(text);
  assert.equal(title, 'Huggies Fralda Tripla Proteção G 78 Un');

  const queries = generateSearchQueries(title);
  assert.ok(queries.length >= 1);
  assert.equal(queries[0], 'Huggies Fralda Tripla Proteção G 78');
});

test('identifica corretamente o produto Berço Americano ignorando headline de desconto', () => {
  const text = `DESCONTÃO DOMINGO
Quarto Bebê Completo Berço Americano Marquesa Cômoda Uli
R$ 1149 em 10x
https://mercadolivre.com.br/123`;

  const title = extractProductFromText(text);
  assert.equal(title, 'Quarto Bebê Completo Berço Americano Marquesa Cômoda Uli');
});
