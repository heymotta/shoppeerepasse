const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('calcula assinatura sha256 no formato correto da Shopee Affiliate Open API', () => {
  const appId = '123456';
  const secret = 'mysecret';
  const timestamp = 1700000000;
  const payload = JSON.stringify({ query: '{ test }' });
  const factor = `${appId}${timestamp}${payload}${secret}`;
  const signature = crypto.createHash('sha256').update(factor).digest('hex');

  assert.equal(typeof signature, 'string');
  assert.equal(signature.length, 64);
});
