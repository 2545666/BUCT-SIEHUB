const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./server');
const mongoose = require('mongoose');
const route = path => app._router.stack.find(layer => layer.route?.path === path).route;
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, set() {}, json(data) { this.data = data; } });

test('only ultimate admin can access own login logs and global account audit', () => {
  for (const path of ['/api/my/login-logs', '/api/ultimate/account-logs']) {
    const guard = route(path).stack[1].handle;
    for (const memberRole of ['student', 'volunteer', 'department_lead', 'presidium']) {
      const res = response();
      guard({ user: { role: 'superadmin', memberRole, positionTitle: 'presidium_member' } }, res, () => assert.fail('non-ultimate allowed'));
      assert.equal(res.code, 403);
    }
    let passed = false;
    guard({ user: { isUltimateAdmin: true } }, response(), () => { passed = true; });
    assert.ok(passed);
  }
});

test('legacy per-account operation logs still reject non-ultimate users', async () => {
  const handler = route('/api/admin/users/:id/logs').stack.at(-1).handle;
  for (const memberRole of ['student', 'volunteer', 'department_lead', 'presidium']) {
    const res = response();
    await handler({ user: { memberRole }, params: { id: 'any-account' } }, res);
    assert.equal(res.code, 403);
  }
});

test('global audit separates log kinds, searches safely and paginates records', async t => {
  const handler = route('/api/ultimate/account-logs').stack.at(-1).handle;
  const LoginEvent = mongoose.model('LoginEvent');
  const observed = [];
  t.mock.method(app.models.User, 'find', query => { observed.push(query); return { select: () => ({ lean: async () => [{ _id: 'matched-user' }] }) }; });
  for (const [kind, model] of [['login', LoginEvent], ['operation', app.models.AuditLog]]) {
    let offset;
    const chain = { sort() { return this; }, skip(value) { offset = value; return this; }, limit() { return this; }, populate() { return this; }, async lean() { return [{ _id: kind }]; } };
    t.mock.method(model, 'find', query => { observed.push(query); return chain; });
    t.mock.method(model, 'countDocuments', async () => 35);
    const res = response();
    await handler({ query: { kind, search: 'member.*', page: '2', limit: '20' } }, res);
    assert.equal(res.data.logs[0]._id, kind);
    assert.equal(res.data.pagination.pages, 2);
    assert.equal(offset, 20);
  }
  assert.equal(observed[0].$or[0].name.source, 'member\\.\\*');
  assert.deepEqual(observed[1].$or[0].user.$in, ['matched-user']);
  assert.deepEqual(observed[3].user.$in, ['matched-user']);
  const invalid = response(); await handler({ query: { kind: 'invalid' } }, invalid);
  assert.equal(invalid.code, 400);
});
