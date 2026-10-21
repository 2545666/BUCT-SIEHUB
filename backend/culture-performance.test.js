const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {
  DEFAULT_CULTURE_STANDARD, CultureMonthlyScore, CultureMonthlyStandard,
  calculateCultureGrade, normalizeCultureStandard, serializeCultureScore,
  installCulturePerformanceRoutes
} = require('./culture-performance');

const assignment = { organization: 'student_union', department: 'culture_sports_arts' };
const member = (id, extra = {}) => ({ _id: id, name: '同名成员', studentId: id.slice(-4), role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', isActive: true, ...assignment, ...extra });
const first = member('000000000000000000000001');
const second = member('000000000000000000000002');
const leader = member('000000000000000000000003', { role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head' });
const manager = { _id: '000000000000000000000004', name: '管理人员', isUltimateAdmin: true };
const copy = value => JSON.parse(JSON.stringify(value));
const chain = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => copy(value) });

function harness(t) {
  const routes = new Map(), scores = new Map(), standards = new Map(), writes = [];
  const users = [first, second, leader];
  const stub = (model, method, replacement) => {
    const original = model[method]; model[method] = replacement;
    t.after(() => { model[method] = original; });
  };
  stub(CultureMonthlyStandard, 'findOne', filter => chain(standards.get(filter.month) || null));
  stub(CultureMonthlyStandard, 'distinct', async () => [...standards.keys()]);
  stub(CultureMonthlyStandard, 'findOneAndUpdate', async (filter, update) => {
    writes.push({ model: 'standard', filter, update });
    const old = standards.get(filter.month) || { _id: 'standard', month: filter.month, version: 0 };
    const row = { ...old, ...copy(update.$set), version: old.version + update.$inc.version };
    standards.set(filter.month, row); return row;
  });
  stub(CultureMonthlyScore, 'find', filter => chain([...scores.values()].filter(s => s.month === filter.month && (!filter.target || s.target === filter.target))));
  stub(CultureMonthlyScore, 'distinct', async (_field, filter) => [...new Set([...scores.values()].filter(s => !filter.target || s.target === filter.target).map(s => s.month))]);
  stub(CultureMonthlyScore, 'findOneAndUpdate', async (filter, update, options) => {
    writes.push({ model: 'score', filter, update, options });
    const key = filter.target + '@' + filter.month;
    let row = scores.get(key);
    if (!row && options.upsert) row = { _id: 'score-' + scores.size, selfScore: null, leaderScore: null, ...copy(update.$setOnInsert) };
    if (!row) return null;
    Object.assign(row, copy(update.$set)); scores.set(key, row); return copy(row);
  });
  const User = {
    findById: id => chain(users.find(u => u._id === id) || null),
    find: filter => chain(users.filter(u => !filter._id || u._id === filter._id))
  };
  installCulturePerformanceRoutes({
    app: { get: (route, ...handlers) => routes.set('GET ' + route, handlers.at(-1)), put: (route, ...handlers) => routes.set('PUT ' + route, handlers.at(-1)), delete: (route, ...handlers) => routes.set('DELETE ' + route, handlers.at(-1)) },
    authenticate() {}, logAction: async () => {}, User,
    getDepartmentPerformanceAccess: user => user.isUltimateAdmin || user._id === leader._id ? { canEdit: true } : null,
    getDepartmentCapabilityAccess: user => user.organization === assignment.organization && user.department === assignment.department ? {} : null
  });
  const request = async (method, suffix, user, body = {}, query = {}) => {
    const response = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await routes.get(method + ' /api/hub/departments/student_union/culture_sports_arts/culture-performance-' + suffix)({ user, body, query }, response);
    return response;
  };
  return { request, scores, standards, writes, stub };
}

test('first self assessment saves zero, full work logs and comment under a stable user ID', async t => {
  const h = harness(t);
  const response = await h.request('PUT', 'scores', first, { month: '2026-10', targetId: first._id, mode: 'self', selfScore: 0, workLogs: [{ t: '舞台布置', d: '2026-10-11', w: '安装道具并核对清单' }], comment: '已完成本月工作' });
  assert.equal(response.code, 200);
  assert.equal(response.body.score.selfScore, 0);
  assert.equal(response.body.score.leaderScore, null);
  assert.equal(response.body.score.combinedScore, null);
  assert.equal(response.body.score.target.id, first._id);
  assert.equal(response.body.score.workLogs[0].w, '安装道具并核对清单');
  assert.equal(response.body.score.selfComment, '已完成本月工作');
  assert.equal(h.scores.size, 1);
  assert.equal(h.scores.has(second._id + '@2026-10'), false);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].options.upsert, true);
});

test('grading and self assessment update separate fields and preserve the saved standard version', async t => {
  const h = harness(t), details = {};
  DEFAULT_CULTURE_STANDARD.dims.forEach((dim, di) => dim.items.forEach((_item, ii) => { details[`i_${di}_${ii}`] = '优秀'; }));
  const grade = await h.request('PUT', 'scores', manager, { month: '2026-10', targetId: first._id, mode: 'grade', standardVersion: 0, itemDetails: details, selfScore: 99, comment: '管理评语' });
  assert.equal(grade.body.score.leaderScore, 100);
  assert.equal(grade.body.score.selfScore, null);
  const self = await h.request('PUT', 'scores', first, { month: '2026-10', targetId: first._id, mode: 'self', selfScore: 0, workLogs: [{ t: '活动', w: '执行任务' }], comment: '自我评价', itemDetails: {} });
  assert.equal(self.body.score.combinedScore, 70);
  assert.deepEqual(self.body.score.itemDetails, { ...details, bonus: 0, minus: 0 });
  assert.equal(self.body.score.leaderComment, '管理评语');
  assert.equal(self.body.score.selfComment, '自我评价');
  const next = copy(DEFAULT_CULTURE_STANDARD); next.weight = { leader: 20, self: 80 };
  await h.request('PUT', 'standards', manager, { month: '2026-10', standard: next });
  const read = await h.request('GET', 'workbench', manager, {}, { month: '2026-10' });
  assert.equal(read.body.standardVersion, 1);
  assert.equal(read.body.scores[0].combinedScore, 70);
  assert.equal(read.body.scores[0].standardVersion, 0);
  assert.equal(read.body.scores[0].standardSnapshot.weight.leader, 70);
  const updatedGrade = await h.request('PUT', 'scores', manager, { month: '2026-10', targetId: first._id, mode: 'grade', standardVersion: 1, itemDetails: details, workLogs: [], selfScore: 99 });
  assert.equal(updatedGrade.body.score.combinedScore, 20);
  assert.equal(updatedGrade.body.score.selfScore, 0);
  assert.equal(updatedGrade.body.score.workLogs[0].w, '执行任务');
});

test('read-only workbench shares one monthly result and never modifies a roster or scores', async t => {
  const h = harness(t); h.standards.set('2026-09', { month: '2026-09', configuration: DEFAULT_CULTURE_STANDARD, version: 2 });
  const result = await h.request('GET', 'workbench', manager, {}, { month: '2026-10' });
  assert.deepEqual(result.body.months, ['2026-09', '2026-10']);
  assert.equal(result.body.members.length, 3);
  assert.equal(result.body.members[2].positionTitle, 'department_head');
  assert.equal(result.body.members[2].canGrade, true);
  assert.equal(h.writes.length, 0);
  const own = await h.request('GET', 'workbench', first, {}, { month: '2026-10' });
  assert.deepEqual(own.body.members.map(u => u.id), [first._id]);
  assert.equal(own.body.members[0].canSelf, true);
  assert.equal(own.body.members[0].canGrade, false);
});

test('department heads see volunteer rankings but cannot read another leader score', async t => {
  const h = harness(t);
  h.scores.set(first._id + '@2026-10', { _id: 'volunteer-score', target: first._id, month: '2026-10', leaderScore: 80, selfScore: 80, standardSnapshot: DEFAULT_CULTURE_STANDARD });
  const otherLeaderId = '000000000000000000000005';
  h.scores.set(otherLeaderId + '@2026-10', { _id: 'other-leader-score', target: otherLeaderId, targetSnapshot: { positionTitle: 'department_head' }, month: '2026-10', leaderScore: 90, selfScore: 90, standardSnapshot: DEFAULT_CULTURE_STANDARD });
  const view = await h.request('GET', 'workbench', leader, {}, { month: '2026-10' });
  assert.deepEqual(view.body.scores.map(score => score.id), ['volunteer-score']);
  const chairView = await h.request('GET', 'workbench', manager, {}, { month: '2026-10' });
  assert.equal(chairView.body.scores.length, 2);
});

test('server rejects another member self assessment, unauthorized leader grading and stale standards', async t => {
  const h = harness(t), body = { month: '2026-10', targetId: second._id, mode: 'self', selfScore: 0, workLogs: [{ t: '活动', w: '工作' }] };
  assert.equal((await h.request('PUT', 'scores', first, body)).code, 403);
  assert.equal((await h.request('PUT', 'scores', leader, { ...body, targetId: leader._id, mode: 'grade', standardVersion: 0, itemDetails: {} })).code, 403);
  assert.equal((await h.request('PUT', 'scores', manager, { ...body, mode: 'grade', standardVersion: 2, itemDetails: {} })).code, 409);
  assert.equal((await h.request('PUT', 'scores', { ...first, department: 'student_rights' }, body)).code, 403);
  assert.equal(h.writes.length, 0);
});

test('invalid self inputs fail before persistence while genuine zero grades remain zero', async t => {
  const h = harness(t), body = { month: '2026-02', targetId: first._id, mode: 'self', selfScore: '', workLogs: [{ t: '活动', d: '2026-02-30', w: '工作' }] };
  assert.equal((await h.request('PUT', 'scores', first, body)).code, 400);
  assert.equal((await h.request('PUT', 'scores', first, { ...body, selfScore: 0 })).code, 400);
  assert.equal(h.writes.length, 0);
  const zero = await h.request('PUT', 'scores', manager, { month: '2026-10', targetId: first._id, mode: 'grade', standardVersion: 0, itemDetails: { bonus: 0, minus: 0 } });
  assert.equal(zero.body.score.leaderScore, 0);
  assert.equal(zero.body.score.selfScore, null);
  assert.equal(zero.body.score.status, '已评分');
});

test('a concurrent first insert retries a duplicate key using only the submitted fields', async t => {
  const h = harness(t), original = CultureMonthlyScore.findOneAndUpdate;
  let count = 0;
  h.scores.set(first._id + '@2026-10', { _id: 'existing', target: first._id, month: '2026-10', ...assignment, leaderScore: 80, selfScore: null, standardSnapshot: copy(DEFAULT_CULTURE_STANDARD), standardVersion: 0 });
  h.stub(CultureMonthlyScore, 'findOneAndUpdate', async (filter, update, options) => {
    if (!count++) throw Object.assign(new Error('duplicate'), { code: 11000 });
    assert.equal(options.upsert, undefined);
    assert.equal(update.$setOnInsert, undefined);
    return original(filter, update, options);
  });
  const result = await h.request('PUT', 'scores', first, { month: '2026-10', targetId: first._id, mode: 'self', selfScore: 100, workLogs: [{ t: '活动', w: '工作' }] });
  assert.equal(result.code, 200);
  assert.equal(result.body.score.leaderScore, 80);
  assert.equal(result.body.score.combinedScore, 86);
});

test('standards validate totals and grade details against their exact configuration', () => {
  const standard = normalizeCultureStandard(copy(DEFAULT_CULTURE_STANDARD));
  assert.throws(() => normalizeCultureStandard({ ...standard, weight: { leader: 80, self: 30 } }), /权重/);
  assert.throws(() => normalizeCultureStandard({ ...standard, dims: [{ ...standard.dims[0], max: 100 }] }), /满分/);
  assert.throws(() => calculateCultureGrade({ i_0_0: '伪造等级' }, standard), /不一致/);
  assert.throws(() => calculateCultureGrade({ i_99_99: '优秀' }, standard), /无效/);
  assert.throws(() => calculateCultureGrade({ bonus: 11 }, standard), /加分/);
  const unlimited = normalizeCultureStandard({ ...standard, bonus: { ...standard.bonus, max: null } });
  assert.equal(calculateCultureGrade({ bonus: 25 }, unlimited).leaderScore, 25);
  const score = serializeCultureScore({ _id: 'zero', target: first._id, month: '2026-10', leaderScore: 0, selfScore: 0, standardSnapshot: standard });
  assert.equal(score.combinedScore, 0);
  assert.equal(score.status, '已完成');
});

const html = fs.readFileSync(path.join(__dirname, '../frontend/public/culture-sports-arts/performance/index.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
function page(search = '') {
  const elements = new Map(), storage = new Map();
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', style: {}, className: '', disabled: false, options: [], addEventListener() {}, setAttribute() {}, querySelectorAll: () => [] });
    return elements.get(id);
  };
  const sandbox = { console, Date, URLSearchParams, location: { search }, setTimeout, clearTimeout, document: { getElementById: getElement, addEventListener() {}, querySelectorAll: () => [], body: { className: '' } }, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, sessionStorage: { getItem: () => '' }, window: {}, fetch: async () => { throw new Error('unexpected request'); } };
  vm.createContext(sandbox);
  vm.runInContext(scripts.find(source => source.includes('var state =')), sandbox);
  sandbox.state.std = copy(DEFAULT_CULTURE_STANDARD);
  sandbox.db = sandbox.siehubDatabaseAdapter();
  return sandbox;
}

test('shared page routes each department to its own monthly scores, evaluations and draft storage', async () => {
  const culture = page();
  const rights = page('?organization=student_union&department=student_rights&departmentLabel=学生权益部');
  assert.equal(culture.CULTURE_PATH, '/hub/departments/student_union/culture_sports_arts/culture-performance');
  assert.equal(rights.CULTURE_PATH, '/hub/departments/student_union/student_rights/monthly-performance');
  assert.notEqual(rights.DRAFT_KEY, culture.DRAFT_KEY);
  const requests = [];
  rights.siehubRequest = async path => { requests.push(path); return {}; };
  await rights.siehubLoadWorkbench();
  await rights.siehubLoadEvaluations('2026-10');
  assert.match(requests[0], /student_rights\/monthly-performance-workbench/);
  assert.match(requests[1], /student_rights\/performance-evaluations/);
});

test('all page scripts parse and the page keeps duplicate names distinct by user ID', () => {
  scripts.forEach(source => new vm.Script(source));
  const p = page();
  p.state.people = p.siehubPeopleRows({ members: [first, second, leader].map(u => ({ ...u, id: u._id })) });
  p.state.scores = p.siehubScoreRows({ scores: [{ id: 'a', target: { id: first._id, name: first.name }, month: '2026-10', selfScore: 0, leaderScore: 100, combinedScore: 70, workLogs: [{ t: '活动', w: '证据' }], itemDetails: { i_0_0: '优秀' }, standardSnapshot: DEFAULT_CULTURE_STANDARD }, { id: 'b', target: { id: second._id, name: second.name }, month: '2026-10', selfScore: null, leaderScore: 0, combinedScore: null }] });
  p.state.period = '2026-10';
  assert.equal(p.findPerson(second._id)._id, second._id);
  assert.equal(p.findScore(second._id)._id, 'b');
  assert.equal(p.tierOf(leader._id), '负责人');
  assert.equal(p.selfDone(p.findScore(second._id)), false);
  assert.equal(p.selfDone(p.findScore(first._id)), true);
  p.state.std.weight = { leader: 20, self: 80 };
  assert.equal(p.finalOf(p.findScore(first._id)), 70);
  assert.notEqual(p.draftKey(first._id), p.draftKey(second._id));
});

test('page first-save sends one non-destructive monthly PUT including zero and complete evidence', async () => {
  const p = page(), requests = [];
  p.siehubRequest = async (route, options) => { requests.push({ route, options }); return {}; };
  await p.saveRecord(second._id, { month: '2026-10', mode: 'self', selfScore: 0, workLogs: [{ t: '活动', w: '完整证据' }], comment: '零分自评' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(requests[0].route.endsWith('culture-performance-scores'), true);
  assert.deepEqual(JSON.parse(requests[0].options.body), { month: '2026-10', mode: 'self', selfScore: 0, workLogs: [{ t: '活动', w: '完整证据' }], comment: '零分自评', targetId: second._id });
  assert.equal(html.includes("CULTURE_PATH + '-scores', { method: 'DELETE'"), false);
  assert.equal(html.includes('performance-roster'), false);
});

test('switching months reloads both scores and evaluations and rejects an old response', async () => {
  const p = page(), requests = [];
  p.state.period = '2026-09'; p.state.loading = false;
  p.state.scores = [{ targetId: first._id, 考核月度: '2026-09', 总分: 99 }];
  p.refreshAll = () => {};
  let oldResolve;
  p.siehubRequest = (route) => {
    requests.push(route);
    if (route.includes('workbench?month=2026-09')) return new Promise(resolve => { oldResolve = resolve; });
    if (route.includes('workbench')) return Promise.resolve({ members: [{ ...first, id: first._id, canSelf: true }], scores: [], months: ['2026-09', '2026-10'], viewerId: first._id, standard: copy(DEFAULT_CULTURE_STANDARD), standardVersion: 2 });
    return Promise.resolve({ targets: [{ id: second._id, name: second.name }], allowedKinds: [], evaluations: [], summary: [] });
  };
  const oldRequest = p.fetchData();
  await p.switchPeriod('2026-10');
  oldResolve({ members: [], scores: [{ id: 'old', target: { id: first._id }, month: '2026-09' }], standard: DEFAULT_CULTURE_STANDARD, standardVersion: 0 });
  await oldRequest;
  assert.equal(p.state.period, '2026-10');
  assert.equal(p.state.standardVersion, 2);
  assert.equal(p.state.scores.length, 0);
  assert.equal(p.state.evaluationTargets[0].id, second._id);
  assert.equal(requests.filter(route => route.includes('month=2026-10')).length, 1);
  assert.equal(requests.filter(route => route.includes('evaluations?semester=2026-10')).length, 1);
});

test('a member submits only their own self fields and an empty score never becomes an implicit zero', async () => {
  const p = page(), requests = [];
  p.state.period = '2026-10'; p.state.cur = first._id; p.state.viewerId = first._id; p.state.loading = false;
  p.state.people = [{ _id: first._id, 姓名: first.name, canSelf: true, canGrade: false }];
  p.state.logs = [{ t: '活动', d: '2026-10-12', w: '完整工作纪实' }];
  p.fetchData = async () => {}; p.refreshAll = () => {};
  p.siehubRequest = async (route, options) => { requests.push({ route, body: JSON.parse(options.body) }); return {}; };
  p.document.getElementById('fCmt').value = '自评意见';
  await p.saveScore();
  assert.equal(requests.length, 0);
  p.document.getElementById('fSelf').value = '0';
  await p.saveScore();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.targetId, first._id);
  assert.equal(requests[0].body.selfScore, 0);
  assert.equal(requests[0].body.workLogs[0].w, '完整工作纪实');
  assert.equal(requests[0].body.itemDetails, undefined);
  assert.equal(requests[0].body.mode, 'self');
});

test('failed form drafts restore only for the same viewer and month without automatic submission', () => {
  const p = page();
  p.state.cur = first._id; p.state.viewerId = first._id; p.state.period = '2026-10';
  p.state.people = [{ _id: first._id, canSelf: true }];
  p.document.getElementById('fCmt').value = '暂存评语'; p.document.getElementById('fSelf').value = '0';
  p.state.logs = [{ t: '活动', w: '暂存证据' }]; p.cacheForm();
  p.renderScoring = () => { p.document.getElementById('fCmt').value = '服务器原评语'; };
  p.renderLogs = () => {}; p.updateTotals = () => {}; p.applyMode = () => {};
  p.document.getElementById('fCmt').value = ''; p.state.logs = [];
  p.restoreFormCache();
  assert.equal(p.document.getElementById('fCmt').value, '暂存评语');
  assert.equal(p.document.getElementById('fSelf').value, '0');
  assert.equal(p.state.logs[0].w, '暂存证据');
  p.state.period = '2026-11'; p.document.getElementById('fCmt').value = '新月内容';
  p.restoreFormCache();
  assert.equal(p.document.getElementById('fCmt').value, '新月内容');
  assert.equal(html.includes('正在自动提交'), false);
});

test('monthly role flows render with only the permitted self or grading fields enabled', () => {
  const cases = [
    { viewer: first, target: first, mode: 'view', access: {}, canSelf: true, canGrade: false, save: true },
    { viewer: leader, target: first, mode: 'edit', access: { canManage: true, canEditStandards: true }, canSelf: false, canGrade: true, save: true },
    { viewer: leader, target: leader, mode: 'edit', access: { canManage: true, canEditStandards: true }, canSelf: true, canGrade: false, save: false },
    { viewer: leader, target: leader, mode: 'view', access: { canManage: true, canEditStandards: true }, canSelf: true, canGrade: false, save: true },
    { viewer: manager, target: leader, mode: 'edit', access: { canManage: true, canEditStandards: true }, canSelf: false, canGrade: true, save: true }
  ];
  for (const scenario of cases) {
    const p = page(); p.state.loading = false; p.state.period = '2026-10'; p.state.viewerId = scenario.viewer._id;
    p.state.cur = scenario.target._id; p.state.mode = scenario.mode; p.state.access = scenario.access;
    p.state.people = p.siehubPeopleRows({ members: [{ ...scenario.target, id: scenario.target._id, canSelf: scenario.canSelf, canGrade: scenario.canGrade }] });
    p.refreshAll();
    assert.equal(p.document.getElementById('btnSave').disabled, !scenario.save);
    assert.equal(p.document.getElementById('fSelf').disabled, scenario.mode === 'edit' || !scenario.canSelf);
    assert.equal(p.document.getElementById('fDate').disabled, scenario.mode !== 'edit' || !scenario.canGrade);
  }
});

test('anonymous evaluation kinds follow the selected target role and never offer self evaluation of another user', () => {
  const p = page(); p.state.viewerId = first._id;
  p.state.evaluationTargets = [first, second, leader].map(u => ({ ...u, id: u._id }));
  p.evaluationData.allowedKinds = ['self', 'volunteer_peer', 'volunteer_leader'];
  assert.deepEqual([...p.evaluationKindsForTarget(first._id)], ['self']);
  assert.deepEqual([...p.evaluationKindsForTarget(second._id)], ['volunteer_peer']);
  assert.deepEqual([...p.evaluationKindsForTarget(leader._id)], ['volunteer_leader']);
  p.state.viewerId = leader._id; p.evaluationData.allowedKinds = ['self', 'leader_peer', 'leader_volunteer'];
  assert.deepEqual([...p.evaluationKindsForTarget(leader._id)], ['self']);
  assert.deepEqual([...p.evaluationKindsForTarget(first._id)], ['leader_volunteer']);
});

test('CSV and Excel export saved dimensions, weight versions and per-item scores from each result snapshot', () => {
  const p = page(), saved = copy(DEFAULT_CULTURE_STANDARD);
  const current = copy(saved); current.dims[0].name = '新维度'; current.levels[0].ratio = 0.1; current.weight = { leader: 20, self: 80 };
  p.state.std = current; p.state.period = '2026-10';
  p.state.scores = p.siehubScoreRows({ scores: [{ id: 'saved', target: { id: first._id, name: first.name, positionTitle: 'volunteer' }, month: '2026-10', selfScore: 0, leaderScore: 100, combinedScore: 70, dimensionScores: { 出勤参与: 30, 工作贡献: 35, 团队协作: 20, 创新与作风: 15 }, itemDetails: { i_0_0: '优秀' }, standardSnapshot: saved, standardVersion: 4 }] });
  let csv, sheets;
  p.download = (_name, data) => { csv = data; };
  p.exportCsv();
  assert.equal(csv.includes('"出勤参与"'), true);
  assert.equal(csv.includes('"新维度"'), false);
  assert.equal(csv.includes('"标准版本"'), true);
  assert.match(csv, /,4,70,30,"000000000000000000000001"/);
  p.xlsxFiles = data => { sheets = data; return []; }; p.zipStore = () => new Uint8Array(); p.downloadBlob = () => {};
  p.exportXlsx();
  const detail = sheets[1].rows[1];
  assert.equal(detail[1], '出勤参与');
  assert.equal(detail[6], 10);
  assert.equal(detail[7], 4);
  assert.equal(detail[8], first._id);
  const summary = sheets[0].rows[1];
  assert.equal(summary[sheets[0].rows[0].indexOf('综合得分')], 70);
  assert.equal(summary[sheets[0].rows[0].indexOf('管理评分权重')], 70);
});
