const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DEFAULT_CULTURE_STANDARD, serializeCultureScore, installCulturePerformanceRoutes } = require('./culture-performance');

test('historical monthly records still serialize for archived cohorts', () => {
  const score = serializeCultureScore({ _id: 'old', month: '2026-10', leaderScore: 90, selfScore: 70, standardSnapshot: DEFAULT_CULTURE_STANDARD });
  assert.equal(score.combinedScore, 84);
  assert.equal(score.month, '2026-10');
});

test('monthly write endpoints are retired while historical read endpoint remains', async () => {
  const routes = new Map();
  const app = {
    get: (path, ...handlers) => routes.set(`GET ${path}`, handlers.at(-1)),
    put: (path, ...handlers) => routes.set(`PUT ${path}`, handlers.at(-1)),
    delete: (path, ...handlers) => routes.set(`DELETE ${path}`, handlers.at(-1))
  };
  installCulturePerformanceRoutes({ app, authenticate() {}, User: {}, DepartmentPerformancePolicy: {}, getDepartmentPerformanceAccess() {}, getDepartmentCapabilityAccess() {} });
  for (const path of ['/api/hub/departments/:organization/:department/monthly-performance', '/api/hub/departments/student_union/culture_sports_arts/culture-performance']) {
    assert.equal(typeof routes.get(`GET ${path}-workbench`), 'function');
    for (const suffix of ['standards', 'scores']) {
      const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      routes.get(`PUT ${path}-${suffix}`)({}, res);
      assert.equal(res.code, 410);
    }
  }
});

test('website and bookmarked cultural page point to semester performance', () => {
  const app = fs.readFileSync(path.join(__dirname, '../frontend/src/App.jsx'), 'utf8');
  const legacyPage = fs.readFileSync(path.join(__dirname, '../frontend/public/culture-sports-arts/performance/index.html'), 'utf8');
  assert.doesNotMatch(app, /DepartmentMonthlyWorkspace|月度逐项评分与标准/);
  assert.match(app, /学期评价/);
  assert.match(app, /<DepartmentPerformanceParticipation\b/);
  assert.match(legacyPage, /月度考核已停用/);
});
