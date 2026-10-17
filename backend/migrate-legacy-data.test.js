const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLegacyRoster, factHash, roleFromSavedIdentity } = require('./migrate-legacy-data');

test('role correction follows a complete saved identity, preserving unknown and ultimate cases', () => {
  assert.equal(roleFromSavedIdentity({ role: 'superadmin', memberRole: 'student', positionTitle: 'student' }), 'student');
  assert.equal(roleFromSavedIdentity({ role: 'admin', memberRole: 'department_lead', positionTitle: 'department_head' }), 'superadmin');
  assert.equal(roleFromSavedIdentity({ role: 'admin', memberRole: 'department_lead', positionTitle: 'student' }), 'admin');
  assert.equal(roleFromSavedIdentity({ role: 'superadmin', memberRole: 'student', positionTitle: 'student', isUltimateAdmin: true }), 'superadmin');
});

test('legacy department backfill never changes the facts hash, including negative and zero scores', () => {
  const records = [{ _id: 'r1', volunteer: 'u1', score: -5, dimension: 'others', semester: '2025 春季' },
    { _id: 'r2', volunteer: 'u1', score: 0, dimension: 'routine', semester: '2026 秋季' }];
  assert.equal(factHash(records), factHash(records.map(record => ({ ...record, organization: 'student_union', department: 'student_rights' }))));
  assert.notEqual(factHash(records), factHash(records.map(record => ({ ...record, score: 1 }))));
});

test('legacy roster keeps stable user IDs and periods, without guessing current department or historic position', () => {
  const users = [{ _id: 'u1', name: '同名', studentId: '1', department: 'culture_sports_arts' },
    { _id: 'u2', name: '同名', studentId: '2', department: 'other' }];
  const rows = buildLegacyRoster([
    { volunteer: 'u1', semester: '2025 春季' }, { volunteer: 'u1', semester: '2025 春季' },
    { volunteer: 'u1', semester: '2026 秋季' }, { volunteer: 'u2', semester: '2025 春季' }
  ], users);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].volunteer, 'u1');
  assert.equal(rows[2].volunteer, 'u2');
  assert.equal(rows[2].studentId, '2');
  assert.ok(rows.every(row => row.department === 'student_rights' && !('positionTitle' in row)));
});
