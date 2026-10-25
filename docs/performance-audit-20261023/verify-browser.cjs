const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const { makeUser, responseFor, measure } = require('../ui-audit-20261022/audit-browser.cjs');
const { listDepartments } = require('../../backend/organization');
const { buildPerformanceOverview } = require('../../backend/performance-overview');
const { rubricFor } = require('../../backend/semester-performance');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const term = '2026-2027学年 第一学期', previousTerm = '2025-2026学年 第二学期';
const a = { organization: 'student_union', department: 'student_rights' }, b = { organization: 'student_union', department: 'new_media' };
const volunteer = { ...makeUser('volunteer'), id: 'volunteer', _id: 'volunteer', name: '兼职示例志愿者', volunteerDepartments: [a, b] };
const leader = { ...makeUser('lead'), id: 'leader', _id: 'leader', name: '示例负责人' };
const policy = responseFor(new URL('http://local/performance-policy'), leader).policy;
const leaderPolicy = { dimensions: rubricFor('self', leader, {}).map(item => ({ ...item, maxScore: item.max, scoringMode: 'capped_additive' })) };
const out = path.join(__dirname, 'browser'); fs.mkdirSync(out, { recursive: true });
const results = [];
(async () => {
 const browser = await chromium.launch({ headless: true });
 try {
 async function scenario(name, role, width, run) {
  if (process.env.UI_SCENARIOS && !new RegExp(process.env.UI_SCENARIOS).test(name)) return;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const user = role === 'volunteer' ? volunteer : makeUser(role), errors = [], writes = [];
  let reviewOpen = false, reads = 0;
  await context.addInitScript(() => { localStorage.setItem('siehub_auth_token_v2', 'local-audit-fixture'); localStorage.setItem('sievox_demo_theme_mode', 'light'); });
  await context.route('**/api/**', async route => {
   const request = route.request(), url = new URL(request.url()), p = url.pathname;
   let data = structuredClone(responseFor(url, user));
   if (request.method() !== 'GET') writes.push({ path: p, body: request.postDataJSON() });
   if (p.endsWith('/performance-review-window') && request.method() === 'PUT') { reviewOpen = request.postDataJSON().open; data = { success: true, open: reviewOpen, currentSemester: term }; }
   if (p.endsWith('/performance-overview')) {
    reads++;
    data = { success: true, semester: url.searchParams.get('semester') || term, currentSemester: term, semesters: [term, previousTerm], reviewOpen, updatedAt: new Date().toISOString(), departments: buildPerformanceOverview({ departments: listDepartments().map(item => ({ ...item, policy })), users: [volunteer, leader], memberships: [], records: [{ id: 'daily', ...a, volunteer, memberRole: 'volunteer', activityName: '校园活动协助', reason: '按时完成现场协调', dimension: 'attendance', score: 3 }], evaluations: [{ ...a, target: volunteer.id, kind: 'self', score: 90, items: [] }], roster: [{ ...a, volunteer: volunteer.id }], semester: term, currentSemester: term }) };
   }
   if (p.endsWith('/performance-workbench')) data = { ...data, volunteers: [volunteer], roster: [volunteer], assessmentLeaders: [leader], leaderPolicy, canRecordLeaders: ['presidium', 'ultimate'].includes(role) };
   if (p.endsWith('/performance-evaluations') && role === 'volunteer') {
    const rubric = policy.dimensions.map(item => ({ ...item, max: item.maxScore }));
    data = { ...data, reviewOpen: true, targets: [{ ...volunteer, allowedKinds: ['self'], rubrics: { self: rubric } }, { ...leader, allowedKinds: ['volunteer_leader'], rubrics: { volunteer_leader: rubricFor('volunteer_leader', leader, {}) } }], summary: [{ target: volunteer, total: null, self: null, supervisor: null, peer: null, status: '待完成' }], ownActivityRecords: [{ id: 'mine', activityName: '新媒体工作', reason: '素材采集', score: 2 }] };
   }
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await context.route(/https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  try {
   await run(page, writes, () => reads);
   const metrics = await measure(page);
   assert.equal(metrics.scrollWidth, width, 'page width overflow'); assert.deepEqual(errors, []);
   await page.screenshot({ path: path.join(out, name + '.png') });
   results.push({ name, passed: true, viewport: width, errors });
  } catch (error) {
   results.push({ name, passed: false, error: error.message, errors });
   await page.screenshot({ path: path.join(out, name + '.png') }).catch(() => {});
  } finally { await context.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); }
 }
 for (const width of [390, 1440]) await scenario('overview-' + width, 'ultimate', width, async (page, writes, reads) => {
  await page.clock.install();
  await page.goto('http://127.0.0.1:5174/performance-overview', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '全部门绩效总览' }).waitFor();
  assert.equal(await page.locator('.performance-overview-department').count(), 9);
  await page.locator('.performance-overview-department').filter({ hasText: '学生权益部' }).click();
  await page.locator('.performance-overview-member summary').filter({ hasText: '兼职示例志愿者' }).click();
  await page.getByText('校园活动协助 · 3 分', { exact: true }).waitFor();
  await page.getByRole('button', { name: '开启期末评价', exact: true }).click();
  await page.getByRole('button', { name: '关闭期末评价', exact: true }).waitFor();
  assert.ok(writes.some(row => row.body.open === true && row.body.semester === term));
  const before = reads();
  const refreshed = page.waitForResponse(response => response.url().includes('/performance-overview') && response.status() === 200);
  await page.clock.fastForward(31000); await refreshed;
  await page.waitForFunction(() => !document.querySelector('.performance-overview-toolbar button').disabled);
  assert.ok(reads() > before, 'auto-refresh missing');
  await page.getByLabel('考核学期', { exact: true }).selectOption(previousTerm);
  await page.getByText('历史学期 · 只读', { exact: true }).waitFor();
  assert.equal(await page.locator('.performance-overview-primary').isDisabled(), true);
  await page.getByLabel('考核学期', { exact: true }).selectOption(term);
  await page.getByText('期末评价已开放', { exact: true }).waitFor();
 });
 for (const role of ['presidium', 'lead']) await scenario('daily-' + role, role, 390, async (page, writes) => {
  await page.goto('http://127.0.0.1:5174/departments?module=new_media', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '绩效考核', exact: true }).click();
  await page.getByRole('button', { name: '活动记录', exact: true }).click();
  if (role === 'lead') { assert.equal(await page.getByRole('button', { name: '负责人日常绩效', exact: true }).count(), 0); return; }
  await page.getByRole('button', { name: '负责人日常绩效', exact: true }).click();
  const form = page.locator('form.siehub-performance-panel');
  await form.getByText('示例负责人', { exact: true }).click();
  await form.getByLabel('加分', { exact: true }).fill('3'); await form.getByLabel('事项名称', { exact: true }).fill('活动统筹'); await form.getByLabel('加分事由', { exact: true }).fill('完成分工协调');
  await form.getByRole('button', { name: '录入绩效', exact: true }).click();
  await page.getByText('绩效录入成功。', { exact: true }).waitFor();
  const saved = writes.find(row => row.path.endsWith('/performance-records'));
  assert.equal(saved.body.dimension, 'planning'); assert.deepEqual(saved.body.volunteerIds, ['leader']); assert.ok(saved.path.includes('/new_media/'));
 });
 await scenario('secondary-self-review', 'volunteer', 390, async (page, writes) => {
  await page.goto('http://127.0.0.1:5174/departments?module=new_media', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /我的绩效与评价/ }).click();
  await page.locator('.unified-performance-selectors').waitFor();
  for (const input of await page.locator('.unified-performance-form input[type=number]').all()) await input.fill('5');
  await page.getByRole('button', { name: '提交本学期评价', exact: true }).click();
  await page.getByText('学期评价已保存。', { exact: true }).waitFor();
  assert.ok(writes.some(row => row.path.includes('/new_media/performance-evaluations') && row.body.kind === 'self'));
  await page.getByLabel('评价对象', { exact: true }).selectOption('leader');
  await page.getByText('任务安排与指导 · 满分 30', { exact: false }).waitFor();
 });
 await scenario('overview-denied', 'lead', 390, async page => {
  await page.goto('http://127.0.0.1:5174/performance-overview', { waitUntil: 'networkidle' });
  await page.getByText('仅终极管理员可访问', { exact: true }).waitFor(); assert.equal(await page.locator('.performance-overview').count(), 0);
 });
 await scenario('part-time-assignment', 'ultimate', 390, async (page, writes) => {
  await page.goto('http://127.0.0.1:5174/organization', { waitUntil: 'networkidle' });
  await page.locator('.org-member-row').first().getByRole('button', { name: '编辑', exact: true }).click();
  const departments = page.getByRole('group', { name: '兼职部门，可多选' });
  await departments.getByRole('button', { name: '学生会 · 新媒体工作部', exact: true }).click();
  assert.equal(await departments.getByRole('button', { name: '学生会 · 新媒体工作部', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '保存成员身份与分管部门', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.org-action-save').disabled);
  const saved = writes.find(row => row.path.endsWith('/ultimate/members'));
  assert.equal(saved.body.department, 'student_rights');
  assert.deepEqual(saved.body.volunteerDepartments, [b]);
 });
 } finally { await browser.close(); }
 console.log(JSON.stringify(results, null, 2)); if (results.some(row => !row.passed)) process.exitCode = 1;
})();
