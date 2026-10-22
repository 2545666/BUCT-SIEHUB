const test = require('node:test');
const assert = require('node:assert/strict');
const { rubricFor, normalizeItems, scoreOf, summarizeSemester } = require('./semester-performance');
const { getVolunteerPerformancePolicy, listDepartments } = require('./organization');

const volunteer = { memberRole: 'volunteer' };
const leader = { memberRole: 'department_lead' };
const policy = getVolunteerPerformancePolicy('student_union', 'student_rights');

test('every department keeps its own main items while peer reviews use observable items', () => {
  assert.equal(listDepartments().length, 9);
  for (const assignment of listDepartments()) {
    const main = rubricFor('leader_volunteer', volunteer, getVolunteerPerformancePolicy(assignment.organization, assignment.department));
    assert.equal(main.reduce((sum, item) => sum + item.max, 0), 100);
    assert.deepEqual(rubricFor('self', volunteer, getVolunteerPerformancePolicy(assignment.organization, assignment.department)), main);
  }
  assert.equal(rubricFor('volunteer_peer', volunteer, policy).length, 4);
  assert.notDeepEqual(rubricFor('self', leader, policy), rubricFor('self', volunteer, policy));
  assert.deepEqual(rubricFor('presidium_leader', leader, policy), rubricFor('self', leader, policy));
});

test('server derives the score from every validated item instead of trusting a total', () => {
  const rubric = rubricFor('volunteer_peer', volunteer, policy);
  const input = rubric.map(item => ({ key: item.key, score: item.max / 2 }));
  assert.equal(scoreOf(normalizeItems(input, rubric)), 50);
  assert.equal(normalizeItems(input.slice(1), rubric), null);
  assert.equal(normalizeItems([...input.slice(0, 3), input[0]], rubric), null);
  assert.equal(normalizeItems(input.map((item, index) => index ? item : { ...item, score: '' }), rubric), null);
  assert.equal(normalizeItems(input.map((item, index) => index ? item : { ...item, score: 31 }), rubric), null);
});

test('semester score requires supervisor, self and peer sources and uses 70/10/20', () => {
  const rows = [
    { kind: 'leader_volunteer', score: 90, items: [{ key: 'work', label: '工作', max: 100, score: 90 }] },
    { kind: 'self', score: 88 },
    { kind: 'volunteer_peer', score: 80 },
    { kind: 'volunteer_peer', score: 88 }
  ];
  assert.equal(summarizeSemester(rows.slice(0, 2), volunteer, '2026-2027学年 第一学期').total, null);
  const result = summarizeSemester(rows, volunteer, '2026-2027学年 第一学期');
  assert.equal(result.peer, 84);
  assert.equal(result.total, 88.6);
  assert.equal(result.dimensions[0].score, 90);
});

test('leader receives presidium main rating and team or leader peer input', () => {
  const rows = [{ kind: 'presidium_leader', score: 90 }, { kind: 'self', score: 80 }, { kind: 'volunteer_leader', score: 70 }];
  assert.equal(summarizeSemester(rows, leader, '2026-2027学年 第一学期').total, 85);
  rows.push({ kind: 'leader_peer', score: 90 });
  assert.equal(summarizeSemester(rows, leader, '2026-2027学年 第一学期').peer, 80);
});

test('department extra credit is counted once after the weighted semester score', () => {
  const rows = [{ kind: 'leader_volunteer', score: 90, bonusScore: 3 }, { kind: 'self', score: 80 }, { kind: 'volunteer_peer', score: 70 }];
  const result = summarizeSemester(rows, volunteer, '2026-2027学年 第一学期');
  assert.equal(result.bonus, 3);
  assert.equal(result.total, 88);
});
