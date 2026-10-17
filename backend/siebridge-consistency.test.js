const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  canResubmitCourse, canDeleteResource, getResourceFileByIndex,
  withRecoverableFileDeletion, formatSiebridgeUploadError
} = require('./siebridge');

test('malformed file indexes never select or delete the first file', () => {
  const resource = { files: [{ storedName: 'a' }, { storedName: 'b' }] };
  assert.equal(getResourceFileByIndex(resource, undefined).storedName, 'a');
  assert.equal(getResourceFileByIndex(resource, '1').storedName, 'b');
  for (const value of ['bad', '', null, -1, 1.5, '1e0', ' 0 ', 2]) {
    assert.equal(getResourceFileByIndex(resource, value), null);
  }
});

test('only the original submitter can resubmit a rejected course', () => {
  const course = { status: 'rejected', submittedBy: 'owner' };
  assert.equal(canResubmitCourse({ _id: 'owner' }, course), true);
  assert.equal(canResubmitCourse({ _id: 'other' }, course), false);
  assert.equal(canResubmitCourse({ _id: 'owner' }, { ...course, status: 'approved' }), false);
});

test('submitters can clear their own pending/rejected resources, never approved or others', () => {
  const owner = { _id: 'owner' };
  for (const status of ['pending', 'rejected']) {
    assert.equal(canDeleteResource(owner, { status, submittedBy: { _id: 'owner' } }), true);
    assert.equal(canDeleteResource(owner, { status, submittedBy: 'other' }), false);
  }
  assert.equal(canDeleteResource(owner, { status: 'approved', submittedBy: 'owner' }), false);
  assert.equal(canDeleteResource({ _id: 'reviewer', isUltimateAdmin: true }, { status: 'approved' }), true);
});

test('database failure restores all staged files and their original contents', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'siebridge-delete-'));
  try {
    const files = ['a.txt', 'b.txt'].map(name => path.join(dir, name));
    await Promise.all(files.map((file, i) => fs.writeFile(file, `original-${i}`)));
    await assert.rejects(withRecoverableFileDeletion(files, async () => {
      await assert.rejects(fs.access(files[0]));
      throw new Error('database unavailable');
    }), /database unavailable/);
    assert.deepEqual(await Promise.all(files.map(file => fs.readFile(file, 'utf8'))), ['original-0', 'original-1']);
    assert.deepEqual(await fs.readdir(path.join(dir, '.trash')), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('successful database removal deletes staged files; already missing files are tolerated', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'siebridge-delete-'));
  try {
    const file = path.join(dir, 'a.txt');
    await fs.writeFile(file, 'contents');
    let persisted = 0;
    await withRecoverableFileDeletion([file, path.join(dir, 'missing.txt')], async () => { persisted += 1; });
    assert.equal(persisted, 1);
    await assert.rejects(fs.access(file));
    assert.deepEqual(await fs.readdir(path.join(dir, '.trash')), []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('aggregate upload size error reports a useful limit', () => {
  assert.deepEqual(formatSiebridgeUploadError({ code: 'SIEBRIDGE_TOTAL_SIZE' }), {
    status: 413, message: '上传文件总量超过单次 600MB 或账号剩余容量'
  });
});
