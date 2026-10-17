import test from 'node:test';
import assert from 'node:assert/strict';
import { API_BASE, AUTH_TOKEN_KEY, readStoredToken, persistSessionToken, clearSessionToken, subscribeSessionChanges, requestJson, uploadFeedbackFiles, resolveApiAssetUrl, resolveMediaUrl } from './api.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
};
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
globalThis.window = new EventTarget();
globalThis.BroadcastChannel = undefined;
globalThis.CustomEvent = class extends Event { constructor(type, options) { super(type); this.detail = options.detail; } };

test('记住登录只在勾选时永久存储，换账号与退出发布会话变更', () => {
  const changes = [];
  const unsubscribe = subscribeSessionChanges(token => changes.push(token));
  persistSessionToken('temporary', false);
  assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), 'temporary');
  assert.equal(localStorage.getItem(AUTH_TOKEN_KEY), null);
  persistSessionToken('remembered', true);
  assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), null);
  assert.equal(localStorage.getItem(AUTH_TOKEN_KEY), 'remembered');
  clearSessionToken();
  assert.equal(readStoredToken(), null);
  assert.deepEqual(changes, ['temporary', 'remembered', null]);
  unsubscribe();
});

test('其他标签页登录会替换旧临时会话，其他标签页退出清空本标签页', () => {
  const changes = [];
  const unsubscribe = subscribeSessionChanges(token => changes.push(token));
  sessionStorage.setItem(AUTH_TOKEN_KEY, 'old');
  localStorage.setItem(AUTH_TOKEN_KEY, 'new');
  const emit = value => { const event = new Event('storage'); event.key = 'siehub_auth_change_v2'; event.newValue = JSON.stringify(value); window.dispatchEvent(event); };
  emit({ kind: 'login', remember: true });
  assert.equal(readStoredToken(), 'new');
  emit({ kind: 'logout' });
  assert.equal(sessionStorage.getItem(AUTH_TOKEN_KEY), null);
  assert.deepEqual(changes, ['new', null]);
  unsubscribe();
  localStorage.clear();
});

test('断网、HTML 502和业务403保留会话；401只撤销对应token', async () => {
  persistSessionToken('current', false);
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(requestJson('/auth/me', 'current'));
  assert.equal(readStoredToken(), 'current');
  globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
  await assert.rejects(requestJson('/auth/me', 'current'));
  assert.equal(readStoredToken(), 'current');
  globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({ success: false }) });
  await assert.rejects(requestJson('/feedback/private', 'current'));
  assert.equal(readStoredToken(), 'current');
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ success: false }) });
  await assert.rejects(requestJson('/auth/me', 'outdated'));
  assert.equal(readStoredToken(), 'current');
  await assert.rejects(requestJson('/auth/me', 'current'));
  assert.equal(readStoredToken(), null);
});

test('附件上传业务失败及数量不足均拒绝继续提交', async () => {
  const files = [new File(['evidence'], 'evidence.txt', { type: 'text/plain' })];
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: false, message: '上传失败' }) });
  await assert.rejects(uploadFeedbackFiles(files, null), /上传失败/);
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, files: [] }) });
  await assert.rejects(uploadFeedbackFiles(files, null), /全部上传/);
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: true, files: [{ path: '/uploads/a' }] }) });
  assert.deepEqual(await uploadFeedbackFiles(files, null), [{ path: '/uploads/a' }]);
});

test('附件遵循API_BASE，保留HTTP地址并拒绝不安全协议', () => {
  assert.equal(API_BASE, '/api');
  assert.equal(resolveApiAssetUrl('/api/uploads/a.png', 'https://api.example.edu/v1'), 'https://api.example.edu/v1/uploads/a.png');
  assert.equal(resolveApiAssetUrl('/uploads/a.png', '/v1'), '/v1/uploads/a.png');
  assert.equal(resolveApiAssetUrl('https://api.example.edu/a.png', '/v1'), 'https://api.example.edu/a.png');
  assert.equal(resolveApiAssetUrl('javascript:alert(1)'), '');
  assert.equal(resolveApiAssetUrl('//untrusted.example/a'), '');
  assert.equal(resolveMediaUrl('/assets/logo.png'), '/assets/logo.png');
});
