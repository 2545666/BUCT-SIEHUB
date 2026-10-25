const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('./server');
const policy = require('./security-policy');
const { withOperationLock, compensate } = require('./standalone-writes');
const models = app.models;
const helpers = app.backendHelpers;
const rights = { organization: 'student_union', department: 'student_rights' };
const volunteer = { _id: '000000000000000000000001', role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', isActive: true, name: 'Test volunteer', ...rights };
const leader = { _id: '000000000000000000000002', role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head', ...rights };
const other = { ...volunteer, department: 'new_media' };
const owner = { _id: '000000000000000000000003', role: 'student', memberRole: 'student', positionTitle: 'student' };
const query = value => ({ populate() { return this; }, sort() { return this; }, select() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, sendStatus(code) { this.statusCode = code; return this; } });
const handler = (method, path) => app._router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
const request = (user, body = {}, params = {}) => ({ user, body, params, query: {}, ip: '127.0.0.1', get: () => '', headers: {} });
const lockMocks = t => {
  t.mock.method(models.OperationLock, 'findOneAndUpdate', async () => ({}));
  t.mock.method(models.OperationLock, 'deleteOne', async () => ({}));
};
const performanceReads = (t, records = []) => {
  t.mock.method(models.PerformanceRecord, 'find', () => query(records));
  t.mock.method(models.PerformanceCalibration, 'find', () => query([]));
  t.mock.method(models.DepartmentPerformancePolicy, 'findOne', () => query(null));
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([]));
};

test('password recovery cannot reach ultimate, peers, or a different managed department', () => {
  const presidium = { role: 'superadmin', memberRole: 'presidium', positionTitle: 'presidium_member' };
  assert.equal(policy.canResetPassword(presidium, { ...leader, isUltimateAdmin: true }, [rights]), false);
  assert.equal(policy.canResetPassword(presidium, { ...leader, memberRole: 'presidium' }, [rights]), false);
  assert.equal(policy.canResetPassword(presidium, other, [rights]), false);
  assert.equal(policy.canResetPassword(presidium, leader, [rights]), true);
  assert.equal(policy.canResetPassword({ isUltimateAdmin: true }, { ...leader, isUltimateAdmin: true }, [rights]), false);
});

test('rights volunteer work survives, and other volunteer roles cannot obtain global feedback access', () => {
  const unassigned = { user: owner._id };
  const assigned = { ...unassigned, handlingOrganization: rights.organization, handlingDepartment: rights.department };
  assert.equal(helpers.ensureFeedbackAccess(volunteer, unassigned), true);
  assert.equal(helpers.ensureFeedbackAccess(volunteer, assigned), true);
  assert.equal(helpers.ensureFeedbackAccess(other, unassigned), false);
  assert.equal(helpers.ensureFeedbackAccess(other, assigned), false);
  assert.equal(helpers.ensureFeedbackAccess(volunteer, { ...assigned, handlingDepartment: 'new_media' }), false);
  assert.deepEqual(helpers.buildDepartmentScopedQuery(other), { _id: null });
  assert.equal(helpers.canReadFeedback(leader, { ...assigned, isRevoked: true }), false);
  assert.equal(helpers.canReadFeedback(owner, { ...assigned, isRevoked: true }), true);
});

test('anonymous details and student replies lose all correlating sender identifiers for ordinary handlers', () => {
  const feedback = { user: { _id: owner._id, name: 'Real name', studentId: '2026000000' }, isAnonymous: true, responses: [{ senderType: 'student', senderName: 'Real name', adminId: owner._id }, { senderType: 'admin', senderName: 'Handler', content: 'recalled secret', attachments: [{ path: 'secret' }], isRecalled: true }] };
  const serialized = policy.serializeFeedbackForViewer(feedback, volunteer);
  assert.equal(serialized.user._id, undefined);
  assert.equal(serialized.responses[0].senderName, '匿名用户');
  assert.equal(serialized.responses[0].adminId, undefined);
  assert.equal(serialized.responses[1].content, '');
  assert.deepEqual(serialized.responses[1].attachments, []);
  assert.equal(policy.serializeFeedbackForViewer(feedback, owner).user.name, 'Real name');
  assert.equal(feedback.responses[0].senderName, 'Real name');
});

test('pagination cannot produce unbounded, negative, NaN or fractional database requests', () => {
  assert.deepEqual(policy.paginationOf({ page: '-1', limit: 'all' }), { page: 1, limit: 20 });
  assert.deepEqual(policy.paginationOf({ page: '2', limit: '1000000' }), { page: 2, limit: 100 });
  assert.deepEqual(policy.paginationOf({ page: '1.5', limit: '0' }), { page: 1, limit: 20 });
});

test('my feedback search filters the list while summary remains scoped to all my feedback', async t => {
  let listQuery;
  let summaryQuery;
  t.mock.method(models.Feedback, 'find', filter => { listQuery = filter; return query([]); });
  t.mock.method(models.Feedback, 'countDocuments', async () => 0);
  t.mock.method(models.Feedback, 'aggregate', async pipeline => { summaryQuery = pipeline[0].$match; return []; });
  const req = request(owner);
  req.query = { search: '食堂.*', status: 'pending' };
  const res = response();
  await handler('get', '/api/feedback/my')(req, res);
  assert.equal(res.body.success, true);
  assert.equal(listQuery.user, owner._id);
  assert.equal(listQuery.status, 'pending');
  assert.equal(listQuery.$or[0].title.$regex, '食堂\\.\\*');
  assert.equal(summaryQuery.user, owner._id);
  assert.equal(summaryQuery.$or, undefined);
  assert.equal(summaryQuery.status, undefined);
});

test('scores cap the defined dimensions, retain the original ledger and add only configured extra credit', () => {
  const score = policy.calculatePerformance([{ dimension: 'attendance', score: 30 }, { dimension: 'activity', score: -4 }, { dimension: 'bonus', score: 5 }, { dimension: 'routine', score: 90 }], require('./organization').getVolunteerPerformancePolicy(rights.organization, rights.department));
  assert.equal(score.total, 25);
  assert.equal(score.byDimension.attendance, 20);
  assert.equal(score.rawByDimension.attendance, 30);
  assert.equal(score.rawByDimension.routine, 90);
});

test('evaluation category weights survive duplicate peer evaluations and disabled categories', () => {
  const rows = [{ target: { id: 'one' }, kind: 'self', score: 100 }, { target: { id: 'one' }, kind: 'volunteer_peer', score: 10 }, { target: { id: 'one' }, kind: 'volunteer_peer', score: 30 }, { target: { id: 'one' }, kind: 'leader_volunteer', score: 80 }];
  const result = policy.summarizeEvaluations(rows, { evaluationSources: ['self', 'volunteer_peer', 'leader'], evaluationWeights: { self: 20, volunteer_peer: 30, leader: 50 } }, {});
  assert.equal(result[0].byKind.volunteer_peer, 20);
  assert.equal(result[0].total, 66);
});

test('all nine departments share performance management while the student-rights policy stays locked', () => {
  const departments = require('./organization').listDepartments();
  assert.equal(departments.length, 9);
  for (const assignment of departments) {
    const manager = { ...leader, ...assignment };
    assert.ok(helpers.getDepartmentPerformanceAccess(manager, assignment), `${assignment.department} manager cannot open the workbench`);
    assert.equal(helpers.getDepartmentPerformanceAccess({ ...volunteer, ...assignment }, assignment), null);
  }
});

test('department workbench lists leaders as assessment targets outside the volunteer ledger', async t => {
  t.mock.method(models.SystemConfig, 'findOne', async () => ({ value: '2026-2027学年 第一学期' }));
  t.mock.method(models.User, 'find', filter => query(filter.memberRole === 'volunteer' ? [volunteer] : [leader]));
  t.mock.method(models.SemesterMember, 'find', () => query([]));
  t.mock.method(models.PerformanceRecord, 'find', () => query([]));
  t.mock.method(models.PerformanceCalibration, 'find', () => query([]));
  t.mock.method(models.DepartmentPerformancePolicy, 'findOne', () => query(null));
  t.mock.method(models.PerformanceRecord, 'distinct', async () => []);
  t.mock.method(models.SemesterMember, 'distinct', async () => []);
  t.mock.method(models.PerformanceEvaluation, 'distinct', async () => []);
  const res = response();
  await handler('get', '/api/hub/departments/:organization/:department/performance-workbench')(request(leader, {}, rights), res);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.volunteers.map(item => String(item.id)), [volunteer._id]);
  assert.deepEqual(res.body.assessmentLeaders.map(item => String(item.id)), [leader._id]);
  assert.equal(res.body.assessmentLeaders[0].memberRole, 'department_lead');
});

test('evaluation relationships stay within their department and exclude ordinary students', () => {
  const volunteer2 = { ...volunteer, _id: '000000000000000000000004' };
  const leader2 = { ...leader, _id: '000000000000000000000005' };
  const student = { ...owner, ...rights };
  assert.equal(helpers.canSubmitPerformanceEvaluation(volunteer, volunteer, 'self', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(volunteer, volunteer2, 'volunteer_peer', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(leader, volunteer, 'leader_volunteer', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(leader, leader, 'self', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(leader, leader2, 'leader_peer', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(volunteer, leader, 'volunteer_leader', rights), true);
  assert.equal(helpers.canSubmitPerformanceEvaluation(leader, volunteer, 'volunteer_peer', rights), false);
  assert.equal(helpers.canSubmitPerformanceEvaluation(volunteer, student, 'self', rights), false);
  assert.equal(helpers.canSubmitPerformanceEvaluation(volunteer, { ...volunteer2, department: 'new_media' }, 'volunteer_peer', rights), false);
});

test('ten simultaneous wrong email codes consume exactly the five allowed atomic attempts', async t => {
  let attempts = 0;
  t.mock.method(models.EmailVerification, 'findOneAndUpdate', async (filter, update) => {
    if (filter.attempts && attempts < filter.attempts.$lt) { attempts += update.$inc.attempts; return { _id: 'code', codeHash: 'wrong', attempts }; }
    return null;
  });
  const results = await Promise.all(Array.from({ length: 10 }, () => helpers.verifyEmailCode({ email: 'test@example.test', purpose: 'register', code: '123456' })));
  assert.equal(attempts, 5);
  assert.ok(results.every(result => !result.ok));
});

test('simultaneous successful email checks cannot consume the same code twice', async t => {
  let consumed = false;
  const hash = helpers.hashVerificationCode('test@example.test', 'register', '123456');
  t.mock.method(models.EmailVerification, 'findOneAndUpdate', async (filter, update) => {
    if (update.$inc) return { _id: 'code', codeHash: hash };
    if (consumed) return null;
    consumed = true; return { _id: 'code', codeHash: hash };
  });
  const results = await Promise.all([1, 2].map(() => helpers.verifyEmailCode({ email: 'test@example.test', purpose: 'register', code: '123456' })));
  assert.equal(results.filter(result => result.ok).length, 1);
});

test('a occupied email-send window rejects concurrent requests before any email is sent', async t => {
  t.mock.method(models.VerificationWindow, 'findOneAndUpdate', async () => { throw { code: 11000 }; });
  const results = await Promise.all([1, 2, 3].map(() => helpers.issueEmailVerification({ email: 'test@example.test', purpose: 'register' })));
  assert.ok(results.every(result => result.status === 429));
});

test('standalone operation locks reject a concurrent writer and release after failure', async () => {
  const active = new Map();
  const Lock = { async findOneAndUpdate(filter, update) { if (active.has(filter._id)) throw { code: 11000 }; active.set(filter._id, update); return update; }, async deleteOne(filter) { if (active.get(filter._id)?.owner === filter.owner) active.delete(filter._id); } };
  let finish;
  const task = withOperationLock(Lock, 'same', () => new Promise(resolve => { finish = resolve; }));
  await Promise.resolve(); await Promise.resolve();
  await assert.rejects(withOperationLock(Lock, 'same', async () => {}), error => error.status === 409);
  finish(); await task;
  await assert.rejects(withOperationLock(Lock, 'same', async () => { throw new Error('failed'); }), /failed/);
  assert.equal(active.size, 0);
});

test('compensation restores previous state and reports any failed recovery without claiming success', async () => {
  let state = 'original';
  await assert.rejects(compensate(async () => { state = 'partial'; throw new Error('failure'); }, async () => { state = 'original'; }), /failure/);
  assert.equal(state, 'original');
  await assert.rejects(compensate(async () => { throw new Error('failure'); }, async () => { throw new Error('offline'); }), error => error.recoveryRequired && error.rollbackError.message === 'offline');
});

test('password version and per-session revocation reject previously signed tokens', async t => {
  t.mock.method(models.User, 'findById', async () => ({ ...volunteer, tokenVersion: 2 }));
  t.mock.method(models.RevokedSession, 'exists', async () => false);
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-buct-2024-secure';
  const token = jwt.sign({ id: volunteer._id, tokenVersion: 1 }, secret);
  let accepted = false;
  const res = response();
  await helpers.authenticate({ headers: { authorization: `Bearer ${token}` } }, res, () => { accepted = true; });
  assert.equal(res.statusCode, 401); assert.equal(accepted, false);
  t.mock.method(models.RevokedSession, 'exists', async () => true);
  const revoked = jwt.sign({ id: volunteer._id, tokenVersion: 2, jti: 'revoked' }, secret);
  const revokedRes = response();
  await helpers.authenticate({ headers: { authorization: `Bearer ${revoked}` } }, revokedRes, () => { accepted = true; });
  assert.equal(revokedRes.statusCode, 401); assert.equal(accepted, false);
});

test('private attachment ownership cannot override a parent feedback permission denial', async t => {
  t.mock.method(models.Feedback, 'find', () => query([{ user: owner._id, handlingOrganization: rights.organization, handlingDepartment: rights.department, attachments: [{ path: '/api/uploads/private.pdf' }], responses: [] }]));
  t.mock.method(models.PrivateUpload, 'findOne', async () => ({ owner: other._id, originalName: 'private.pdf' }));
  const res = response();
  await handler('get', '/api/uploads/:filename')(request(other, {}, { filename: 'private.pdf' }), res);
  assert.equal(res.statusCode, 403);
});

test('active script types and disguised image files cannot pass feedback upload validation', () => {
  assert.equal(policy.safeUploadType('payload.html', 'text/html'), false);
  assert.equal(policy.safeUploadType('payload.svg', 'image/svg+xml'), false);
  assert.equal(policy.safeUploadType('photo.png', 'image/png'), true);
  assert.equal(policy.matchesFileSignature(Buffer.from('<script>bad</script>'), 'photo.png'), false);
  assert.equal(policy.matchesFileSignature(Buffer.from('%PDF-test'), 'report.pdf'), true);
});

test('an ordinary handler reply preserves the workflow state and writes first-response metadata', async t => {
  const feedback = { _id: 'feedback', user: owner._id, title: 'Test', status: 'pending', responses: [], ...{ handlingOrganization: rights.organization, handlingDepartment: rights.department } };
  t.mock.method(models.Feedback, 'findById', async () => feedback);
  t.mock.method(models.Feedback, 'findOneAndUpdate', async (filter, update) => { assert.equal(update.$set, undefined); feedback.responses.push(update.$push.responses); return feedback; });
  t.mock.method(models.Notification, 'create', async () => ({}));
  const res = response();
  await handler('post', '/api/feedback/:id/reply')(request(volunteer, { content: 'A normal reply' }, { id: 'feedback' }), res);
  assert.equal(res.statusCode, 200); assert.equal(feedback.status, 'pending');
  assert.equal(feedback.responses[0].senderType, 'admin');
  assert.equal(feedback.responses[0].adminId, volunteer._id);
  assert.ok(helpers.getFirstAdminResponseAt({ responses: [{ adminId: volunteer._id, createdAt: new Date('2026-01-01') }] }));
});

test('a student can add multiple follow-up replies to the same feedback', async t => {
  const feedback = { _id: 'feedback', user: owner._id, title: 'Test', status: 'resolved', responses: [] };
  t.mock.method(models.Feedback, 'findById', async () => feedback);
  t.mock.method(models.Feedback, 'findOneAndUpdate', async (filter, update) => {
    feedback.responses.push(update.$push.responses);
    return feedback;
  });
  t.mock.method(models.User, 'find', () => query([]));
  const messages = ['第一次补充', '第二次补充', '第三次补充', '第四次补充', '第五次补充'];
  for (const content of messages) {
    const res = response();
    await handler('post', '/api/feedback/:id/reply')(request(owner, { content }, { id: 'feedback' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(feedback.responses.map(item => item.content), messages);
  assert.deepEqual(feedback.responses.map(item => item.senderType), messages.map(() => 'student'));
});

test('feedback reopening clears resolution time, uses a conditional write, and rejects stale updates', async t => {
  const feedback = { _id: 'feedback', user: owner._id, title: 'Test', status: 'resolved', resolvedAt: new Date(), updatedAt: new Date(), handlingOrganization: rights.organization, handlingDepartment: rights.department };
  t.mock.method(models.Feedback, 'findById', async () => feedback);
  let writes = 0;
  t.mock.method(models.Feedback, 'findOneAndUpdate', async (filter, update) => { writes++; assert.equal(filter.status, 'resolved'); assert.equal(update.$set.resolvedAt, null); return { ...feedback, ...update.$set }; });
  t.mock.method(models.Notification, 'create', async () => ({})); t.mock.method(models.AuditLog, 'create', async () => ({}));
  const stale = response();
  await handler('patch', '/api/admin/feedback/:id/status')(request(leader, { status: 'processing', expectedStatus: 'pending' }, { id: 'feedback' }), stale);
  assert.equal(stale.statusCode, 409); assert.equal(writes, 0);
  const res = response();
  await handler('patch', '/api/admin/feedback/:id/status')(request(leader, { status: 'processing', expectedStatus: 'resolved' }, { id: 'feedback' }), res);
  assert.equal(res.statusCode, 200); assert.equal(writes, 1);
});

test('one stale calibration rejects an entire batch before its single atomic replacement', async t => {
  lockMocks(t); performanceReads(t, [{ volunteer: volunteer._id, dimension: 'attendance', score: 10 }, { volunteer: owner._id, dimension: 'attendance', score: 7 }]);
  t.mock.method(models.CohortMembership, 'exists', async () => false);
  t.mock.method(models.User, 'find', () => query([volunteer, { ...volunteer, _id: owner._id }]));
  t.mock.method(models.SemesterMember, 'exists', async () => true);
  t.mock.method(models.PerformanceCalibration, 'findById', () => query(null));
  let replacements = 0;
  t.mock.method(models.PerformanceCalibration, 'findOneAndUpdate', async (filter, update) => { replacements++; assert.deepEqual(update.values.map(value => value.score), [5, 5]); return update; });
  t.mock.method(models.AuditLog, 'create', async () => ({}));
  const body = { semester: '2026', dimension: 'attendance', calibrations: [{ volunteerId: volunteer._id, targetScore: 15, expectedTotal: 10 }, { volunteerId: owner._id, targetScore: 12, expectedTotal: 6 }] };
  const stale = response();
  await handler('post', '/api/admin/performance/calibrate')(request({ isUltimateAdmin: true }, body), stale);
  assert.equal(stale.statusCode, 409); assert.equal(replacements, 0);
  body.calibrations[1].expectedTotal = 7;
  const res = response(); await handler('post', '/api/admin/performance/calibrate')(request({ isUltimateAdmin: true }, body), res);
  assert.equal(res.statusCode, 200); assert.equal(replacements, 1);
});

test('old performance entry rejects negative scores, unknown dimensions, and missing semester membership', async t => {
  lockMocks(t); performanceReads(t);
  t.mock.method(models.User, 'find', () => query([volunteer]));
  t.mock.method(models.SystemConfig, 'findOne', async () => ({ value: '2026' }));
  t.mock.method(models.SemesterMember, 'exists', async () => false);
  t.mock.method(models.CohortMembership, 'exists', async () => false);
  const body = { volunteerIds: [volunteer._id], dimension: 'attendance', score: -1, reason: 'Test' };
  await assert.rejects(helpers.createPerformanceRecords(leader, body), /正加分/);
  await assert.rejects(helpers.createPerformanceRecords(leader, { ...body, score: 1, dimension: 'invented' }), /维度无效/);
  await assert.rejects(helpers.createPerformanceRecords(leader, { ...body, score: 1 }), /名单/);
});

test('an archived cohort retry performs no user writes, freezes no new snapshots and returns idempotently', async t => {
  lockMocks(t);
  t.mock.method(models.Cohort, 'findById', async () => ({ _id: 'old', status: 'archived' }));
  t.mock.method(models.CohortMembership, 'countDocuments', async () => 4);
  const userWrite = t.mock.method(models.User, 'updateOne', async () => { throw new Error('must not write'); });
  const result = await helpers.archiveCohort('old', leader._id);
  assert.equal(result.archivedMembers, 4); assert.equal(userWrite.mock.callCount(), 0);
});

test('new cohort snapshots preserve old monthly history without using it as an official semester score', async t => {
  performanceReads(t, [{ volunteer: volunteer._id, dimension: 'attendance', score: 8, semester: '2026-2027学年 第一学期' }]);
  const standard = { weight: { leader: 70, self: 30 }, dims: [{ name: '考勤', max: 60 }, { name: '贡献', max: 40 }] };
  const scores = [
    { _id: 'oct', target: volunteer._id, month: '2026-10', leaderScore: 90, selfScore: 70, dimensionScores: { 考勤: 54, 贡献: 36 }, standardSnapshot: standard },
    { _id: 'nov', target: volunteer._id, month: '2026-11', leaderScore: 100, selfScore: 80, dimensionScores: { 考勤: 60, 贡献: 40 }, standardSnapshot: standard },
    { _id: 'dec', target: volunteer._id, month: '2026-12', leaderScore: 80, selfScore: null, dimensionScores: { 考勤: 48, 贡献: 32 }, standardSnapshot: standard }
  ];
  t.mock.method(models.DepartmentMonthlyScore, 'find', filter => {
    assert.deepEqual(filter.month.$in, ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    return query(scores);
  });
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([{ semester: '2026-10', kind: 'volunteer_peer', score: 88, comment: '配合顺畅' }]));
  const snapshot = await helpers.buildPerformanceSnapshot(volunteer._id, ['2026-2027学年 第一学期'], rights);
  assert.equal(snapshot.source, 'semester');
  assert.equal(snapshot.total, null);
  assert.equal(snapshot.monthlyScores.length, 3);
  assert.equal(snapshot.monthlyScores[2].combinedScore, null);
  assert.deepEqual(snapshot.byDimension, {});
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.legacySnapshot.total, 8);
  assert.equal(snapshot.evaluations[0].score, 88);
});

test('semester scores take precedence over preserved monthly history and average across the cohort year', async t => {
  performanceReads(t);
  t.mock.method(models.DepartmentMonthlyScore, 'find', () => query([{ _id: 'old-month', target: volunteer._id, month: '2026-10', leaderScore: 100, selfScore: 100, standardSnapshot: { weight: { leader: 70, self: 30 }, dims: [] } }]));
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([
    { semester: '2026-2027学年 第一学期', kind: 'leader_volunteer', score: 90 },
    { semester: '2026-2027学年 第一学期', kind: 'self', score: 80 },
    { semester: '2026-2027学年 第一学期', kind: 'volunteer_peer', score: 70 },
    { semester: '2026-2027学年 第二学期', kind: 'leader_volunteer', score: 80 },
    { semester: '2026-2027学年 第二学期', kind: 'self', score: 90 },
    { semester: '2026-2027学年 第二学期', kind: 'volunteer_peer', score: 90 }
  ]));
  const snapshot = await helpers.buildPerformanceSnapshot(volunteer._id, ['2026-2027学年 第一学期', '2026-2027学年 第二学期'], volunteer);
  assert.equal(snapshot.source, 'semester');
  assert.deepEqual(snapshot.semesterScores.map(item => item.total), [85, 83]);
  assert.equal(snapshot.total, 84);
  assert.equal(snapshot.monthlyScores[0].combinedScore, 100);
});

test('academic semester labels split by an old form are recombined before archive', () => {
  assert.deepEqual(helpers.monthsForPerformanceSemesters(['2026-2027学年', '第一学期']), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
});

test('ultimate administrator can freeze one semester before archiving the whole cohort', async t => {
  lockMocks(t); performanceReads(t);
  const semester = '2026-2027学年 第一学期';
  const cohort = { _id: 'cohort', status: 'active', semesters: [semester] };
  const member = { _id: 'membership', user: volunteer, memberRole: 'volunteer', ...rights, semesterPerformanceArchives: [], async save() {} };
  t.mock.method(models.Cohort, 'findById', async () => cohort);
  t.mock.method(models.CohortMembership, 'find', () => query([member]));
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([{ kind: 'leader_volunteer', score: 90 }, { kind: 'self', score: 80 }, { kind: 'volunteer_peer', score: 70 }]));
  t.mock.method(models.AuditLog, 'create', async () => ({}));
  const req = request({ _id: leader._id, isUltimateAdmin: true }, {}, { id: cohort._id, semester });
  const first = response();
  await handler('post', '/api/ultimate/cohorts/:id/performance-semesters/:semester/archive')(req, first);
  assert.equal(first.body.archivedMembers, 1);
  assert.equal(member.semesterPerformanceArchives[0].total, 85);
  assert.equal(member.semesterPerformanceArchives[0].evaluations.length, 3);
  assert.equal(member.semesterPerformanceArchives[0].evaluations[0].evaluator, undefined);
  const second = response();
  await handler('post', '/api/ultimate/cohorts/:id/performance-semesters/:semester/archive')(req, second);
  assert.equal(second.body.archivedMembers, 0);
});

test('semester reviews stay closed until the ultimate administrator opens the current term', async t => {
  lockMocks(t);
  let open = '';
  const semester = '2026-2027学年 第一学期';
  t.mock.method(models.SystemConfig, 'findOne', async filter => ({ value: filter.key === 'currentSemester' ? semester : open }));
  t.mock.method(models.SystemConfig, 'findOneAndUpdate', async (_filter, update) => { open = update.value; return { value: open }; });
  t.mock.method(models.AuditLog, 'create', async () => ({}));
  const actor = { _id: leader._id, isUltimateAdmin: true };
  const before = response();
  await handler('get', '/api/ultimate/performance-review-window')(request(actor), before);
  assert.equal(before.body.open, false);
  const wrong = response();
  await handler('put', '/api/ultimate/performance-review-window')(request(actor, { semester: 'other', open: true }), wrong);
  assert.equal(wrong.statusCode, 400);
  const opened = response();
  await handler('put', '/api/ultimate/performance-review-window')(request(actor, { semester, open: true }), opened);
  assert.equal(opened.body.open, true);
  const after = response();
  await handler('get', '/api/ultimate/performance-review-window')(request(actor), after);
  assert.equal(after.body.open, true);
});

test('archiving freezes historical members and protects a newer current cohort identity', async t => {
  lockMocks(t); performanceReads(t);
  const cohort = { _id: 'old', semesters: ['2026'], status: 'active', async save() {} };
  const user = { ...volunteer, activeCohortId: 'new' };
  const member = { _id: 'member', cohort: 'old', user, memberRole: user.memberRole, positionTitle: user.positionTitle, organization: user.organization, department: user.department, systemRole: user.role, async save() {} };
  t.mock.method(models.Cohort, 'findById', async () => cohort);
  t.mock.method(models.CohortMembership, 'find', () => query([member]));
  t.mock.method(models.CohortMembership, 'exists', async () => true);
  t.mock.method(models.CohortMembership, 'updateOne', async () => ({}));
  const updates = t.mock.method(models.User, 'updateOne', async () => ({}));
  await helpers.archiveCohort('old', leader._id);
  assert.ok(member.archivedAt); assert.equal(cohort.status, 'archived'); assert.equal(updates.mock.callCount(), 0);
});

test('cohort archive freezes old monthly history without making it the new semester grade', async t => {
  lockMocks(t); performanceReads(t);
  const cohort = { _id: 'monthly', semesters: ['2026-2027学年 第一学期'], status: 'active', async save() {} };
  const member = { _id: 'monthly-member', cohort: cohort._id, user: { ...volunteer, activeCohortId: 'new' }, memberRole: 'volunteer', positionTitle: 'volunteer', ...rights, async save() {} };
  t.mock.method(models.Cohort, 'findById', async () => cohort);
  t.mock.method(models.CohortMembership, 'find', () => query([member]));
  t.mock.method(models.CohortMembership, 'exists', async () => true);
  t.mock.method(models.CohortMembership, 'updateOne', async () => ({}));
  t.mock.method(models.DepartmentMonthlyScore, 'find', () => query([{ _id: 'monthly-score', target: volunteer._id, month: '2026-10', leaderScore: 90, selfScore: 70, dimensionScores: { 考勤: 90 }, standardSnapshot: { weight: { leader: 70, self: 30 }, dims: [{ name: '考勤', max: 100 }] } }]));
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([]));
  await helpers.archiveCohort(cohort._id, leader._id);
  assert.equal(cohort.status, 'archived');
  assert.equal(member.performanceSnapshot.total, null);
  assert.equal(member.performanceSnapshot.monthlyScores[0].id, 'monthly-score');
  assert.deepEqual(member.performanceSnapshot.dimensions, []);
});

test('archive ranks only volunteers with completed scores within each department', () => {
  const member = (id, role, department, source, total, monthlyScores = []) => ({
    id, memberRole: role, organization: 'student_union', department,
    performanceSnapshot: { source, total, monthlyScores, rank: 99 }
  });
  const members = [
    member('a', 'volunteer', 'rights', 'monthly', 90, [{ combinedScore: 90 }]),
    member('b', 'volunteer', 'rights', 'monthly', 0, [{ combinedScore: null }]),
    member('c', 'department_lead', 'rights', 'monthly', 95, [{ combinedScore: 95 }]),
    member('d', 'volunteer', 'rights', 'monthly', 80, [{ combinedScore: 80 }]),
    member('e', 'volunteer', 'culture', 'monthly', 70, [{ combinedScore: 70 }]),
    member('f', 'volunteer', 'rights', 'legacy', 10, [{ combinedScore: null }])
  ];
  helpers.rankArchivedVolunteers(members);
  assert.deepEqual(members.map(item => item.performanceSnapshot.rank), [1, undefined, undefined, 2, 1, undefined]);
});

test('ultimate organization member list shows pending semester performance and keeps old archived snapshots frozen', async t => {
  performanceReads(t);
  let status = 'active';
  const member = { _id: 'member', cohort: 'cohort', user: volunteer, memberRole: 'volunteer', positionTitle: 'volunteer', ...rights, performanceSnapshot: { total: 12, source: 'legacy' } };
  t.mock.method(models.Cohort, 'findById', () => query({ _id: 'cohort', status, semesters: ['2026-2027学年 第一学期'] }));
  t.mock.method(models.CohortMembership, 'find', () => query([member]));
  t.mock.method(models.DepartmentMonthlyScore, 'find', () => query([{ _id: 'live', target: volunteer._id, month: '2026-10', leaderScore: 90, selfScore: 70, standardSnapshot: { weight: { leader: 70, self: 30 }, dims: [{ name: '考勤', max: 100 }] }, dimensionScores: { 考勤: 90 } }]));
  t.mock.method(models.PerformanceEvaluation, 'find', () => query([]));
  const req = request({ isUltimateAdmin: true }); req.query = { cohortId: 'cohort' };
  const live = response();
  await handler('get', '/api/ultimate/members')(req, live);
  assert.equal(live.body.members[0].performanceSnapshot.total, null);
  assert.equal(live.body.members[0].performanceSnapshot.monthlyScores[0].combinedScore, 84);
  status = 'archived';
  const archived = response();
  await handler('get', '/api/ultimate/members')(req, archived);
  assert.equal(archived.body.members[0].performanceSnapshot.total, 12);
});

test('roster upsert failure restores the saved roster and managed-semester configuration', async t => {
  lockMocks(t);
  const old = [{ _id: 'roster', volunteer: owner._id, semester: '2026', ...rights }];
  t.mock.method(models.SemesterMember, 'find', () => query(old));
  t.mock.method(models.SystemConfig, 'findOne', () => query({ key: 'rosterManagedSemesters', value: '["2025"]' }));
  t.mock.method(models.SemesterMember, 'updateOne', async () => { throw new Error('disk failure'); });
  t.mock.method(models.SemesterMember, 'deleteMany', async () => ({}));
  let restored;
  t.mock.method(models.SemesterMember, 'insertMany', async rows => { restored = rows; });
  t.mock.method(models.SystemConfig, 'replaceOne', async (filter, data) => assert.equal(data.value, '["2025"]'));
  await assert.rejects(helpers.replaceRoster({ semester: '2026', ...rights }, [volunteer], leader._id), /disk failure/);
  assert.deepEqual(restored, old);
});

test('a target viewing their anonymous evaluation cannot identify its evaluator', () => {
  const row = { _id: 'evaluation', evaluator: { ...leader, email: 'private@example.test' }, target: volunteer._id, kind: 'leader_volunteer', score: 80, ...rights };
  assert.equal(helpers.serializePerformanceEvaluation(row, volunteer, volunteer).evaluator, null);
  assert.equal(helpers.serializePerformanceEvaluation(row, leader, volunteer).evaluator.id, leader._id);
});

test('department member addition refuses an existing higher or other-department identity before any write', async t => {
  t.mock.method(models.User, 'findOne', async () => ({ ...leader, studentId: '2026000000', department: 'new_media' }));
  const save = t.mock.method(models.User, 'findOneAndUpdate', async () => { throw new Error('must not write'); });
  const res = response();
  await handler('post', '/api/hub/departments/:organization/:department/members')(request(leader, { studentId: '2026000000' }, rights), res);
  assert.equal(res.statusCode, 403); assert.equal(save.mock.callCount(), 0);
});

test('profile cannot replace the stable student ID or bind a new recovery email without the current password', async t => {
  const user = { ...owner, studentId: '2026000000', email: 'before@example.test', comparePassword: async () => false };
  t.mock.method(models.User, 'findById', () => query(user));
  t.mock.method(models.User, 'exists', async () => false);
  const invalidId = response();
  await handler('put', '/api/auth/profile')(request(user, { name: 'Student', studentId: '2026999999', email: user.email }), invalidId);
  assert.equal(invalidId.statusCode, 403);
  const invalidEmail = response();
  await handler('put', '/api/auth/profile')(request(user, { name: 'Student', studentId: user.studentId, email: 'after@example.test', currentPassword: 'wrong' }), invalidEmail);
  assert.equal(invalidEmail.statusCode, 400);
});

test('identity write failure restores User and its previous appointment record', async t => {
  lockMocks(t); performanceReads(t);
  const live = { ...volunteer, identityRevision: 0, activeCohortId: 'cohort' };
  const original = { ...live };
  const membership = { _id: 'membership', user: live._id, cohort: 'cohort', systemRole: live.role, memberRole: live.memberRole, positionTitle: live.positionTitle, ...rights, appointmentHistory: [{ memberRole: 'volunteer', positionTitle: 'volunteer', ...rights }] };
  t.mock.method(models.Cohort, 'find', () => query([{ _id: 'cohort', status: 'active', semesters: ['2026'] }]));
  t.mock.method(models.User, 'findById', async () => ({ ...live }));
  t.mock.method(models.CohortMembership, 'find', () => query([membership]));
  t.mock.method(models.SemesterMember, 'find', () => query([]));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => { Object.assign(live, update.$set); return live; });
  t.mock.method(models.CohortMembership, 'updateOne', async () => { throw new Error('membership failure'); });
  let restoredMembership;
  t.mock.method(models.CohortMembership, 'replaceOne', async (filter, value) => { restoredMembership = value; });
  t.mock.method(models.User, 'updateOne', async (filter, update) => { Object.assign(live, update.$set); return {}; });
  await assert.rejects(helpers.commitUserIdentity({ ...original }, helpers.buildIdentityUpdate({ memberRole: 'student', positionTitle: 'student' }).update, leader._id), /membership failure/);
  assert.equal(live.role, original.role); assert.equal(live.identityRevision, original.identityRevision);
  assert.equal(restoredMembership.appointmentHistory.length, 1);
});

test('reapplying the same identity updates snapshots without appending a duplicate appointment', async t => {
  lockMocks(t);
  const live = { ...volunteer, identityRevision: 0, activeCohortId: 'cohort' };
  const membership = { _id: 'membership', user: live._id, cohort: 'cohort', systemRole: live.role, memberRole: live.memberRole, positionTitle: live.positionTitle, ...rights, appointmentHistory: [{ memberRole: 'volunteer', positionTitle: 'volunteer', ...rights }] };
  t.mock.method(models.Cohort, 'find', () => query([{ _id: 'cohort', status: 'active', semesters: ['2026'] }]));
  t.mock.method(models.User, 'findById', async () => ({ ...live }));
  t.mock.method(models.CohortMembership, 'find', () => query([membership]));
  t.mock.method(models.SemesterMember, 'find', () => query([]));
  t.mock.method(models.User, 'findOneAndUpdate', async (filter, update) => { Object.assign(live, update.$set); return live; });
  t.mock.method(models.CohortMembership, 'updateOne', async (filter, update) => { Object.assign(membership, update.$set); });
  t.mock.method(models.SystemConfig, 'findOne', async () => ({ value: '2026' }));
  t.mock.method(models.SemesterMember, 'updateMany', async () => ({}));
  t.mock.method(models.CohortMembership, 'findOne', () => query(membership));
  const identity = helpers.buildIdentityUpdate({ memberRole: 'volunteer', positionTitle: 'volunteer', ...rights }).update;
  await helpers.commitUserIdentity({ ...live }, identity, leader._id);
  await helpers.commitUserIdentity({ ...live }, identity, leader._id);
  assert.equal(membership.appointmentHistory.length, 1);
});

test('stale draft publication fails before persistence even when publishing the saved draft', async t => {
  lockMocks(t);
  t.mock.method(models.DepartmentIntroduction, 'findOne', () => query({ draftVersion: 3 }));
  const write = t.mock.method(models.DepartmentIntroduction, 'findOneAndUpdate', () => { throw new Error('must not write'); });
  await assert.rejects(helpers.saveDepartmentIntroduction(request(leader, { baseVersion: 2 }, rights), true), error => error.status === 409);
  assert.equal(write.mock.callCount(), 0);
});
