const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DepartmentMonthlyScore, DepartmentMonthlyStandard, standardFromPolicy,
  installCulturePerformanceRoutes
} = require('./culture-performance');
const { getVolunteerPerformancePolicy, listDepartments } = require('./organization');

const rights = { organization: 'student_union', department: 'student_rights' };
const academic = { organization: 'student_union', department: 'academic_technology' };
const id = number => String(number).padStart(24, '0');
const volunteer = (number, assignment) => ({
  _id: id(number), name: `成员${number}`, studentId: String(number),
  role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer', isActive: true, ...assignment
});
const rightMember = volunteer(1, rights);
const academicMember = volunteer(2, academic);
const manager = { _id: id(3), name: '总管理员', isUltimateAdmin: true };
const chain = value => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });

test('nine-department monthly defaults keep the existing six-dimension rights rules', () => {
  assert.equal(listDepartments().length, 9);
  for (const department of listDepartments()) {
    const standard = standardFromPolicy(getVolunteerPerformancePolicy(department.organization, department.department));
    assert.equal(standard.dims.reduce((sum, dim) => sum + dim.max, 0), 100);
  }
  const policy = getVolunteerPerformancePolicy(rights.organization, rights.department);
  const standard = standardFromPolicy(policy);
  assert.equal(standard.dims.length, 5);
  assert.equal(standard.dims.reduce((sum, dim) => sum + dim.max, 0), 100);
  assert.equal(standard.dims[0].items[0].desc, policy.dimensions[0].rule);
  assert.equal(standard.bonus.desc, policy.dimensions[5].rule);
  assert.equal(standard.bonus.max, null);
});

test('monthly workbench and writes stay inside one managed department', async t => {
  const routes = new Map(), users = [rightMember, academicMember];
  const scores = [], standards = [];
  const stub = (model, method, replacement) => {
    const original = model[method]; model[method] = replacement;
    t.after(() => { model[method] = original; });
  };
  const matches = (row, filter) => row.organization === filter.organization && row.department === filter.department &&
    (!filter.month || row.month === filter.month) && (!filter.target || row.target === filter.target);
  stub(DepartmentMonthlyScore, 'find', filter => chain(scores.filter(row => matches(row, filter))));
  stub(DepartmentMonthlyScore, 'distinct', async (_field, filter) => [...new Set(scores.filter(row => matches(row, filter)).map(row => row.month))]);
  stub(DepartmentMonthlyScore, 'findOneAndUpdate', async (filter, update) => {
    const row = { _id: id(9), ...update.$setOnInsert, ...update.$set };
    scores.push(row); return row;
  });
  stub(DepartmentMonthlyStandard, 'findOne', filter => chain(standards.find(row => matches(row, filter)) || null));
  stub(DepartmentMonthlyStandard, 'distinct', async (_field, filter) => [...new Set(standards.filter(row => matches(row, filter)).map(row => row.month))]);
  stub(DepartmentMonthlyStandard, 'findOneAndUpdate', async (filter, update) => {
    const row = { _id: id(10), ...filter, ...update.$set, version: 1 };
    standards.push(row); return row;
  });
  stub(DepartmentMonthlyStandard, 'deleteOne', async filter => {
    const index = standards.findIndex(row => matches(row, filter));
    if (index >= 0) standards.splice(index, 1);
  });
  const User = {
    find: filter => chain(users.filter(user => user.organization === filter.organization && user.department === filter.department && (!filter._id || user._id === filter._id))),
    findById: targetId => chain(users.find(user => user._id === targetId) || null)
  };
  const DepartmentPerformancePolicy = { findOne: () => chain(null) };
  installCulturePerformanceRoutes({
    app: {
      get: (route, ...handlers) => routes.set(`GET ${route}`, handlers.at(-1)),
      put: (route, ...handlers) => routes.set(`PUT ${route}`, handlers.at(-1)),
      delete: (route, ...handlers) => routes.set(`DELETE ${route}`, handlers.at(-1))
    },
    authenticate() {}, logAction: async () => {}, User, DepartmentPerformancePolicy,
    getDepartmentPerformanceAccess: (user, assignment) => user.isUltimateAdmin ? {} : null,
    getDepartmentCapabilityAccess: (user, assignment) => user.organization === assignment.organization && user.department === assignment.department ? {} : null
  });
  const request = async (method, suffix, assignment, user, body = {}) => {
    const route = `${method} /api/hub/departments/:organization/:department/monthly-performance-${suffix}`;
    const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
    await routes.get(route)({ params: assignment, user, body, query: { month: '2026-10' } }, res);
    return res;
  };

  const saved = await request('PUT', 'scores', rights, rightMember, {
    month: '2026-10', targetId: rightMember._id, mode: 'self', selfScore: 80,
    workLogs: [{ t: '权益反馈', w: '完成本月反馈跟进' }]
  });
  assert.equal(saved.code, 200);
  assert.deepEqual(scores[0].organization, rights.organization);
  assert.deepEqual(scores[0].department, rights.department);
  assert.equal((await request('PUT', 'scores', academic, rightMember, { ...saved.body.score, month: '2026-10', targetId: academicMember._id, mode: 'self' })).code, 403);

  const rightView = await request('GET', 'workbench', rights, manager);
  const academicView = await request('GET', 'workbench', academic, manager);
  assert.equal(rightView.body.scores.length, 1);
  assert.equal(academicView.body.scores.length, 0);
  assert.deepEqual(rightView.body.members.map(member => member.id), [rightMember._id]);
  assert.deepEqual(academicView.body.members.map(member => member.id), [academicMember._id]);
  assert.equal((await request('PUT', 'standards', academic, rightMember, { month: '2026-10', standard: academicView.body.standard })).code, 403);
  assert.equal((await request('PUT', 'standards', academic, manager, { month: '2026-10', standard: academicView.body.standard })).code, 200);
  assert.equal(standards[0].department, academic.department);
  assert.equal((await request('GET', 'workbench', rights, manager)).body.standardVersion, 0);
  assert.equal((await request('GET', 'workbench', academic, manager)).body.standardVersion, 1);
  assert.equal((await request('DELETE', 'standards', academic, rightMember, { month: '2026-10' })).code, 403);
  assert.equal((await request('DELETE', 'standards', academic, manager, { month: '2026-10' })).code, 200);
  assert.equal((await request('GET', 'workbench', academic, manager)).body.standardVersion, 0);
  assert.equal((await request('GET', 'workbench', rights, manager)).body.scores.length, 1);
});
