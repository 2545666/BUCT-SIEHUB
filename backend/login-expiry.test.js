const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_EXPIRE = '7d';
process.env.JWT_REMEMBER_EXPIRE = '180d';

const app = require('./server');

test('remembered login tokens last 180d', () => {
  assert.equal(app.getLoginTokenExpiresIn(false), '7d');
  assert.equal(app.getLoginTokenExpiresIn(true), '180d');
});

test('mobile sessions require the same explicit remember choice as desktop sessions', () => {
  assert.equal(app.isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(app.isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
  assert.equal(app.shouldPersistLogin(false, 'Mozilla/5.0 (Android 14; Mobile)'), false);
  assert.equal(app.shouldPersistLogin(true, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), true);
  assert.equal(app.shouldPersistLogin(false, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), false);
});
