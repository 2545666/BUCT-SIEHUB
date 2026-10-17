const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');
const { installSieBridgeRoutes, MAX_USER_STORAGE } = require('./siebridge');

test('streamed upload enforces account remaining bytes and removes partial files', { timeout: 10000 }, async () => {
  const Resource = mongoose.model('SiebridgeResource');
  const originalAggregate = Resource.aggregate;
  Resource.aggregate = async () => [{ bytes: MAX_USER_STORAGE - 4 }];
  const app = express();
  installSieBridgeRoutes({ app, authenticate: (req, res, next) => {
    req.user = { _id: new mongoose.Types.ObjectId() };
    next();
  }, logAction: async () => {} });
  const dir = path.join(__dirname, 'siebridge_uploads');
  const before = await fs.readdir(dir);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const form = new FormData();
    form.append('files', new Blob(['this is over the remaining capacity']), 'test.txt');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/siebridge/courses`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 413);
    assert.match((await response.json()).message, /600MB/);
    assert.deepEqual(await fs.readdir(dir), before);
  } finally {
    Resource.aggregate = originalAggregate;
    await new Promise(resolve => server.close(resolve));
  }
});
