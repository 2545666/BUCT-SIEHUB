const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPerformanceOverview } = require('./performance-overview');
const { listDepartments } = require('./organization');
const a = { organization: 'student_union', department: 'student_rights' }, b = { organization: 'student_union', department: 'new_media' };
const volunteer = { _id: 'v', name: '兼职志愿者', role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', ...a, volunteerDepartments: [b] };
const lead = { _id: 'l', name: '负责人', role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head', ...a };
const input = { departments: listDepartments(), users: [volunteer, lead], memberships: [], records: [], evaluations: [], roster: [], semester: '2026秋', currentSemester: '2026秋' };

test('overview counts nine departments and separate part-time positions, without treating empty as complete', () => {
  const result = buildPerformanceOverview({ ...input, evaluations: [
    ...['leader_volunteer', 'self', 'volunteer_peer'].map(kind => ({ ...a, target: 'v', kind, score: 80 })),
    { ...b, target: 'v', kind: 'self', score: 90 }, { ...a, target: 'l', kind: 'volunteer_leader', score: 70 }
  ], records: [{ ...b, volunteer: { id: 'v' }, score: 2 }], roster: [{ ...a, volunteer: 'v', isActive: true }] });
  assert.equal(result.length, 9);
  const rights = result.find(row => row.department === a.department), media = result.find(row => row.department === b.department);
  assert.equal(rights.counts.total, 2); assert.equal(rights.counts.completed, 1); assert.equal(rights.counts.peer, 2);
  assert.equal(media.counts.total, 1); assert.equal(media.counts.completed, 0); assert.equal(media.counts.rosterMissing, 1);
  assert.equal(media.members[0].result.self, 90); assert.equal(media.members[0].activityRecords.length, 1);
  assert.equal(result.find(row => row.department === 'practice').counts.completed, 0);
});

test('historical overview retains departed members and uses frozen department result', () => {
  const memberships = [{ user: 'v', memberRole: 'volunteer', ...a, accountSnapshot: { name: '归档成员' }, cohort: { semesters: ['2026春'] }, semesterPerformanceArchives: [
    { ...a, semester: '2026春', total: 87, supervisor: 90, self: 80, peer: 80, evaluations: [], activityRecords: [{ score: 3 }] },
    { ...b, semester: '2026春', total: 73, supervisor: 70, self: 80, peer: 80, evaluations: [], activityRecords: [] }
  ] }];
  const result = buildPerformanceOverview({ ...input, users: [], semester: '2026春', memberships });
  assert.equal(result.find(row => row.department === a.department).members[0].result.total, 87);
  assert.equal(result.find(row => row.department === b.department).members[0].result.total, 73);
  assert.equal(result.find(row => row.department === b.department).counts.archived, 1);
});

test('overview route rejects every non-ultimate identity before reading data', () => {
  const app = require('./server');
  const route = app._router.stack.find(layer => layer.route?.path === '/api/ultimate/performance-overview').route;
  const guard = route.stack[1].handle;
  for (const memberRole of ['student', 'volunteer', 'department_lead', 'presidium']) {
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() {} };
    guard({ user: { memberRole } }, res, () => assert.fail('unauthorized read'));
    assert.equal(res.statusCode, 403);
  }
  let allowed = false; guard({ user: { isUltimateAdmin: true } }, {}, () => { allowed = true; });
  assert.ok(allowed);
});
