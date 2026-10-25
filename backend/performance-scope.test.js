const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./server');
const { getMemberDepartments, getHubModuleAccess, departmentMemberQuery } = require('./organization');
const { archivedPerformanceQuery, archiveMatchesDepartment, ensureDepartmentEvaluationIndex } = require('./performance-scope');
const { summarizeSemester, rubricFor } = require('./semester-performance');
const { getVolunteerPerformancePolicy } = require('./organization');
const h = app.backendHelpers, m = app.models;
const a = { organization: 'student_union', department: 'student_rights' };
const b = { organization: 'student_union', department: 'new_media' };
const c = { organization: 'youth_league', department: 'organization' };
const semester = '2026-2027学年 第一学期';
const volunteer = { _id: '000000000000000000000001', role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', isActive: true, ...a, volunteerDepartments: [b] };
const lead = { _id: '000000000000000000000002', role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head', isActive: true, ...a };
const chair = { _id: '000000000000000000000003', role: 'superadmin', memberRole: 'presidium', positionTitle: 'presidium_member', managedDepartments: [a, b] };
const ultimate = { _id: '000000000000000000000004', isUltimateAdmin: true };
const query = value => ({ select() { return this; }, populate() { return this; }, sort() { return this; }, lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const handler = (method, path) => app._router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
const req = (user, scope, body = {}) => ({ user, params: scope, query: {}, body, headers: {}, ip: '127.0.0.1', get: () => '' });
function mocks(t) {
  t.mock.method(m.OperationLock, 'findOneAndUpdate', async () => ({}));
  t.mock.method(m.OperationLock, 'deleteOne', async () => ({}));
  t.mock.method(m.SystemConfig, 'findOne', async () => ({ value: semester }));
  t.mock.method(m.CohortMembership, 'exists', async () => false);
  t.mock.method(m.DepartmentPerformancePolicy, 'findOne', () => query(null));
  t.mock.method(m.AuditLog, 'create', async () => ({}));
}

test('daily record permission matrix separates supervisors from assessed leaders', () => {
  for (const [actor, target, scope, allowed] of [
    [lead, volunteer, a, true], [chair, volunteer, a, true], [chair, volunteer, b, true],
    [chair, lead, a, true], [ultimate, lead, a, true], [lead, lead, a, false],
    [volunteer, volunteer, a, false], [chair, volunteer, c, false],
    [{ ...lead, ...b }, volunteer, a, false], [chair, { ...lead, ...c }, c, false],
    [{ ...lead, role: 'student' }, volunteer, a, false]
  ]) assert.equal(h.canRecordPerformance(actor, target, scope), allowed);
  assert.equal(h.canManageRecord(lead, { ...a, memberRole: 'department_lead' }), false);
  assert.equal(h.canManageRecord(chair, { ...a, memberRole: 'department_lead' }), true);
});

test('semester permissions include chair to volunteer, self and volunteer to each department leader', () => {
  for (const [actor, target, kind, scope, allowed] of [
    [chair, volunteer, 'leader_volunteer', a, true], [chair, volunteer, 'leader_volunteer', b, true],
    [chair, lead, 'presidium_leader', a, true], [lead, volunteer, 'leader_volunteer', a, true],
    [volunteer, volunteer, 'self', a, true], [volunteer, volunteer, 'self', b, true],
    [lead, lead, 'self', a, true], [volunteer, lead, 'volunteer_leader', a, true],
    [volunteer, { ...lead, ...b }, 'volunteer_leader', b, true],
    [volunteer, { ...lead, ...c }, 'volunteer_leader', c, false],
    [lead, volunteer, 'leader_volunteer', b, false], [volunteer, volunteer, 'volunteer_peer', b, false]
  ]) assert.equal(h.canSubmitPerformanceEvaluation(actor, target, kind, scope), allowed, `${kind} ${scope.department}`);
});

test('part-time assignments grant member access only and validate identity edits', () => {
  assert.deepEqual(getMemberDepartments(volunteer), [a, b]);
  const access = getHubModuleAccess(volunteer);
  for (const scope of [a, b]) assert.equal(access.find(item => item.department === scope.department).accessLevel, 'member');
  assert.equal(access.find(item => item.department === c.department).accessLevel, 'student');
  assert.equal(access.some(item => item.capabilities.includes('manage_department_performance')), false);
  const identity = h.buildIdentityUpdate({ ...volunteer, volunteerDepartments: [a, b, b] });
  assert.equal(identity.valid, true); assert.deepEqual(identity.update.volunteerDepartments, [b]);
  assert.equal(h.buildIdentityUpdate({ ...volunteer, volunteerDepartments: [{ ...a, department: 'invented' }] }).valid, false);
  assert.deepEqual(h.buildIdentityUpdate({ memberRole: 'student', positionTitle: 'student' }).update.volunteerDepartments, []);
  assert.deepEqual(departmentMemberQuery(b).$or[1].volunteerDepartments.$elemMatch, b);
});

test('daily record writes use the selected department, and leader records use leader dimensions', async t => {
  mocks(t);
  let target = volunteer;
  t.mock.method(m.User, 'find', () => query([target]));
  t.mock.method(m.SemesterMember, 'exists', async () => true);
  const saved = [];
  t.mock.method(m.PerformanceRecord, 'insertMany', async rows => { saved.push(...rows); return rows; });
  const payload = { volunteerIds: [volunteer._id], dimension: 'attendance', score: 2, reason: '值班出勤', activityName: '例会', targetSemester: semester };
  await h.createPerformanceRecords(chair, payload, b);
  assert.equal(saved[0].department, b.department);
  assert.equal(saved[0].memberRole, 'volunteer');
  await assert.rejects(h.createPerformanceRecords(chair, payload), /具体部门/);
  target = lead;
  await assert.rejects(h.createPerformanceRecords(lead, { ...payload, volunteerIds: [lead._id], dimension: 'planning' }, a), /无权/);
  await h.createPerformanceRecords(ultimate, { ...payload, volunteerIds: [lead._id], dimension: 'planning' }, a);
  assert.equal(saved[1].memberRole, 'department_lead');
  assert.equal(saved[1].dimension, 'planning');
  assert.equal(saved.length, 2);
});

test('same volunteer self-evaluation persists independently in two departments and only updates its own row', async t => {
  mocks(t);
  t.mock.method(m.User, 'findOne', () => query(volunteer));
  const rows = new Map();
  t.mock.method(m.PerformanceEvaluation, 'findOneAndUpdate', (filter, update) => {
    assert.ok(filter.organization && filter.department);
    const key = JSON.stringify(filter);
    const row = { ...update, _id: key, evaluator: volunteer };
    rows.set(key, row); return query(row);
  });
  const route = handler('post', '/api/hub/departments/:organization/:department/performance-evaluations');
  for (const [scope, fraction] of [[a, 0.6], [b, 0.8], [a, 0.7]]) {
    const items = rubricFor('self', volunteer, getVolunteerPerformancePolicy(scope.organization, scope.department)).map(item => ({ key: item.key, score: item.max * fraction }));
    const res = response();
    await route(req(volunteer, scope, { targetId: volunteer._id, kind: 'self', semester, items }), res);
    assert.equal(res.statusCode, 200); assert.equal(res.body.success, true);
  }
  assert.equal(rows.size, 2);
  assert.deepEqual([...rows.values()].map(row => [row.department, row.score]), [[a.department, 70], [b.department, 80]]);
});

test('department archive preserves independent grades and daily records', async t => {
  mocks(t);
  t.mock.method(m.PerformanceEvaluation, 'find', scope => query([
    { kind: 'leader_volunteer', score: scope.department === a.department ? 90 : 70 },
    { kind: 'self', score: 80 }, { kind: 'volunteer_peer', score: 80 }
  ]));
  t.mock.method(m.PerformanceRecord, 'find', scope => query([{ _id: 'row-' + scope.department, volunteer: volunteer._id, ...scope, score: 2, dimension: 'attendance' }]));
  t.mock.method(m.PerformanceCalibration, 'find', () => query([]));
  t.mock.method(m.DepartmentMonthlyScore, 'find', () => query([]));
  let saves = 0;
  const member = { ...volunteer, user: volunteer, semesterPerformanceArchives: [], async save() { saves++; } };
  assert.equal(await h.archiveSemesterForMembers([member], semester, ultimate._id), 1);
  assert.equal(await h.archiveSemesterForMembers([member], semester, ultimate._id), 0);
  assert.equal(saves, 1);
  assert.deepEqual(member.semesterPerformanceArchives.map(item => [item.department, item.total, item.activityRecords.length]), [[a.department, 87, 1], [b.department, 73, 1]]);
  const snapshot = await h.buildPerformanceSnapshot(volunteer._id, [semester], member);
  assert.deepEqual(snapshot.departments.map(item => [item.department, item.total]), [[a.department, 87], [b.department, 73]]);
  assert.equal(archiveMatchesDepartment({ semester, total: 87 }, member, b), false);
  assert.equal(archivedPerformanceQuery(b, semester).$or[0].semesterPerformanceArchives.$elemMatch.department, b.department);
});

test('database index migration creates scoped uniqueness before removing only the obsolete constraint', async () => {
  const calls = [];
  await ensureDepartmentEvaluationIndex({ async init() {}, collection: {
    async createIndex(key, options) { assert.ok(key.organization && key.department && options.unique); calls.push('create'); },
    async indexes() { return [{ name: 'old_unique', unique: true, key: { target: 1, evaluator: 1, semester: 1, kind: 1 } }, { name: 'scope_lookup', key: { organization: 1 } }]; },
    async dropIndex(name) { assert.equal(name, 'old_unique'); calls.push('drop'); }
  } });
  assert.deepEqual(calls, ['create', 'drop']);
  const unique = m.PerformanceEvaluation.schema.indexes().find(([, options]) => options.unique)[0];
  assert.ok(unique.organization && unique.department);
});

test('archived grades reject legacy delete and calibration without writing', async t => {
  mocks(t);
  t.mock.method(m.CohortMembership, 'exists', async () => true);
  const record = { ...a, semester, volunteer, async deleteOne() { assert.fail('archived record deleted'); } };
  t.mock.method(m.PerformanceRecord, 'findById', () => query(record));
  const deleted = response();
  await handler('delete', '/api/admin/performance/:id')(req(ultimate, { id: 'row' }), deleted);
  assert.equal(deleted.statusCode, 409);
  t.mock.method(m.User, 'find', () => query([{ ...volunteer, volunteerDepartments: [] }]));
  t.mock.method(m.PerformanceRecord, 'find', () => query([]));
  t.mock.method(m.PerformanceCalibration, 'find', () => query([]));
  t.mock.method(m.PerformanceCalibration, 'findById', () => query(null));
  t.mock.method(m.PerformanceCalibration, 'findOneAndUpdate', () => assert.fail('archived grade changed'));
  const calibrated = response();
  await handler('post', '/api/admin/performance/calibrate')(req(ultimate, {}, { semester, dimension: 'attendance', calibrations: [{ volunteerId: volunteer._id, targetScore: 8, expectedTotal: 0 }] }), calibrated);
  assert.equal(calibrated.statusCode, 409);
});

test('removing one department preserves the other appointment and its roster', async t => {
  mocks(t);
  const live = { ...volunteer };
  t.mock.method(m.Cohort, 'find', () => query([]));
  t.mock.method(m.CohortMembership, 'find', () => query([]));
  t.mock.method(m.User, 'findById', async () => ({ ...live }));
  t.mock.method(m.User, 'findOneAndUpdate', async (filter, update) => { Object.assign(live, update.$set); return live; });
  t.mock.method(m.SemesterMember, 'find', () => query([]));
  const rosterChanges = [];
  t.mock.method(m.SemesterMember, 'updateMany', async (filter, update) => { rosterChanges.push({ filter, update }); });
  const res = response();
  await handler('delete', '/api/hub/departments/:organization/:department/members/:id')(req(lead, { ...a, id: volunteer._id }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(live.memberRole, 'volunteer'); assert.equal(live.department, b.department);
  assert.deepEqual(live.volunteerDepartments, []);
  assert.equal(rosterChanges.find(row => row.filter.department === a.department).update.$set.isActive, false);
  assert.equal(rosterChanges.find(row => row.filter.department === b.department).update.$set.isActive, undefined);
});

test('volunteer can reload own evaluation of a leader without seeing other leader evaluations', async t => {
  mocks(t);
  t.mock.method(m.User, 'find', () => query([volunteer, lead]));
  t.mock.method(m.PerformanceEvaluation, 'find', filter => {
    assert.deepEqual(filter.$or[0].target.$in, [volunteer._id]);
    assert.equal(filter.$or[1].evaluator, volunteer._id);
    return query([{ _id: 'mine', target: lead._id, evaluator: volunteer, kind: 'volunteer_leader', score: 80 }]);
  });
  t.mock.method(m.PerformanceEvaluation, 'distinct', async () => []);
  t.mock.method(m.CohortMembership, 'distinct', async () => []);
  t.mock.method(m.PerformanceRecord, 'find', () => query([]));
  t.mock.method(m.PerformanceCalibration, 'find', () => query([]));
  const res = response();
  await handler('get', '/api/hub/departments/:organization/:department/performance-evaluations')(req(volunteer, a), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.evaluations[0].id, 'mine');
  assert.equal(res.body.evaluations[0].target.studentId, undefined);
  assert.equal(res.body.summary.length, 1); assert.equal(res.body.summary[0].target.id, volunteer._id);
});

test('multiple supervisor evaluations share the 70 percent component without doubling total', () => {
  const result = summarizeSemester([{ kind: 'leader_volunteer', score: 80 }, { kind: 'leader_volunteer', score: 100 }, { kind: 'self', score: 80 }, { kind: 'volunteer_peer', score: 70 }], volunteer, semester);
  assert.equal(result.supervisor, 90); assert.equal(result.total, 85);
});
