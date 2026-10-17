const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canWithdrawSievoxFeedback,
  getHubModuleAccess,
  getIdentityLabel,
  getVolunteerPerformancePolicy,
  listHubModules,
  listHubWindows,
  listDepartments,
  validateAssignment
} = require('./organization');

test('学生本人只能撤回待受理的 SIEVOX 反馈', () => {
  const student = { _id: 'student-1', role: 'student' };

  assert.equal(canWithdrawSievoxFeedback(student, { user: 'student-1', status: 'pending' }), true);
  assert.equal(canWithdrawSievoxFeedback(student, { user: 'student-1', status: 'processing' }), false);
  assert.equal(canWithdrawSievoxFeedback(student, { user: 'student-2', status: 'pending' }), false);
});

test('学生权益部负责人可以撤回 SIEVOX 反馈', () => {
  const leader = {
    role: 'superadmin',
    memberRole: 'department_lead',
    positionTitle: 'department_head',
    organization: 'student_union',
    department: 'student_rights'
  };

  assert.equal(canWithdrawSievoxFeedback(leader, { user: 'student-1', status: 'processing' }), true);
});

test('只有分管学生权益部的主席团成员可以撤回 SIEVOX 反馈', () => {
  const presidium = {
    role: 'superadmin',
    memberRole: 'presidium',
    positionTitle: 'presidium_member',
    managedDepartments: [{ organization: 'student_union', department: 'student_rights' }]
  };
  const otherPresidium = {
    ...presidium,
    managedDepartments: [{ organization: 'student_union', department: 'new_media' }]
  };

  assert.equal(canWithdrawSievoxFeedback(presidium, { user: 'student-1', status: 'resolved' }), true);
  assert.equal(canWithdrawSievoxFeedback(otherPresidium, { user: 'student-1', status: 'pending' }), false);
});

test('普通志愿者、其他部门负责人和终极管理员不能代为撤回 SIEVOX 反馈', () => {
  const feedback = { user: 'student-1', status: 'pending' };
  assert.equal(canWithdrawSievoxFeedback({ role: 'admin', memberRole: 'volunteer' }, feedback), false);
  assert.equal(canWithdrawSievoxFeedback({
    role: 'superadmin', memberRole: 'department_lead', positionTitle: 'department_head',
    organization: 'student_union', department: 'new_media'
  }, feedback), false);
  assert.equal(canWithdrawSievoxFeedback({ role: 'superadmin', isUltimateAdmin: true }, feedback), false);
});

test('团委学生兼职团干部只能归属团委部门', () => {
  assert.equal(validateAssignment({
    memberRole: 'department_lead',
    positionTitle: 'youth_league_cadre',
    organization: 'youth_league',
    department: 'organization'
  }).valid, true);
  assert.equal(validateAssignment({
    memberRole: 'department_lead',
    positionTitle: 'youth_league_cadre',
    organization: 'student_union',
    department: 'general_office'
  }).valid, false);
});

test('学生会部门负责人只能归属学生会部门', () => {
  assert.equal(validateAssignment({
    memberRole: 'department_lead',
    positionTitle: 'department_head',
    organization: 'student_union',
    department: 'student_rights'
  }).valid, true);
  assert.equal(validateAssignment({
    memberRole: 'department_lead',
    positionTitle: 'department_head',
    organization: 'youth_league',
    department: 'publicity'
  }).valid, false);
});

test('主席团层级暂不直接绑定组织和部门', () => {
  const result = validateAssignment({
    memberRole: 'presidium',
    positionTitle: 'youth_league_deputy_secretary'
  });
  assert.equal(result.valid, true);
  assert.equal(result.accessRole, 'superadmin');
});

test('终极管理员标签优先于具体职务标签', () => {
  assert.equal(getIdentityLabel({
    isUltimateAdmin: true,
    positionTitle: 'presidium_member'
  }), '终极管理员');
});

test('组织框架包含团委 4 个部门和学生会 5 个部门', () => {
  const departments = listDepartments();
  assert.equal(departments.filter(d => d.organization === 'youth_league').length, 4);
  assert.equal(departments.filter(d => d.organization === 'student_union').length, 5);
});

test('SIEHUB marks SIEVOX and SIEBridge as active mature modules', () => {
  const modules = listHubModules();
  const sievox = modules.find(module => module.id === 'sievox');
  const siebridge = modules.find(module => module.id === 'siebridge');

  assert.equal(modules.length, 9);
  assert.equal(sievox.hubId, 'siehub');
  assert.equal(sievox.organization, 'student_union');
  assert.equal(sievox.department, 'student_rights');
  assert.equal(sievox.productName, 'SIEVOX');
  assert.equal(sievox.moduleType, 'mature');
  assert.equal(sievox.status, 'active');
  assert.equal(siebridge.organization, 'student_union');
  assert.equal(siebridge.department, 'academic_technology');
  assert.equal(siebridge.productName, 'SIEBridge');
  assert.equal(siebridge.moduleType, 'mature');
  assert.equal(siebridge.status, 'active');
  assert.equal(siebridge.studentEntry, true);
  assert.equal(modules.filter(module => module.moduleType === 'scaffold').length, 7);
});

test('SIEHUB exposes organization governance as an ultimate-only window', () => {
  const windows = listHubWindows();
  const governance = windows.find(window => window.id === 'hub_governance');

  assert.equal(windows.length, 1);
  assert.equal(governance.hubId, 'siehub');
  assert.equal(governance.title, '组织治理中枢');
  assert.equal(governance.moduleType, 'governance_window');
  assert.equal(governance.status, 'active');
  assert.equal(governance.ultimateOnly, true);

  const ultimateAccess = getHubModuleAccess({ isUltimateAdmin: true });
  const governanceAccess = ultimateAccess.find(item => item.moduleId === 'hub_governance');
  assert.equal(governanceAccess.accessLevel, 'ultimate');
  assert.ok(governanceAccess.capabilities.includes('manage_organization_framework'));
  assert.ok(governanceAccess.capabilities.includes('manage_cohort_archive'));
});

test('SIEHUB student portals are open while management stays department-scoped', () => {
  const studentAccess = getHubModuleAccess({ role: 'student', memberRole: 'student' });
  assert.equal(studentAccess.length, 9);
  assert.equal(studentAccess.filter(item => item.accessLevel === 'student').length, 9);
  assert.ok(studentAccess.every(item => item.capabilities.includes('enter_student_portal')));
  assert.ok(studentAccess.every(item => !item.capabilities.includes('enter_manage_portal')));

  const leaderAccess = getHubModuleAccess({
    role: 'superadmin',
    memberRole: 'department_lead',
    positionTitle: 'department_head',
    organization: 'student_union',
    department: 'new_media'
  });
  assert.equal(leaderAccess.length, 9);
  const leaderManaged = leaderAccess.find(item => item.moduleId === 'department:student_union:new_media');
  assert.equal(leaderManaged.accessLevel, 'manage');
  assert.ok(leaderManaged.capabilities.includes('switch_portal'));
  assert.ok(leaderManaged.capabilities.includes('manage_department_notice'));
  assert.equal(leaderAccess.filter(item => item.accessLevel === 'manage').length, 1);

  const presidiumAccess = getHubModuleAccess({
    role: 'superadmin',
    memberRole: 'presidium',
    positionTitle: 'presidium_member',
    managedDepartments: [{ organization: 'youth_league', department: 'publicity' }]
  });
  assert.equal(presidiumAccess.length, 9);
  const presidiumManaged = presidiumAccess.find(item => item.moduleId === 'department:youth_league:publicity');
  assert.equal(presidiumManaged.accessLevel, 'manage');
  assert.ok(presidiumManaged.capabilities.includes('enter_manage_portal'));

  const volunteerAccess = getHubModuleAccess({ role: 'admin' });
  assert.equal(volunteerAccess.length, 9);
  assert.equal(volunteerAccess.filter(item => item.accessLevel === 'student').length, 9);
});

test('SIEBridge review capability is limited to ultimate and assigned presidium', () => {
  const ultimateAccess = getHubModuleAccess({ isUltimateAdmin: true });
  const ultimateBridge = ultimateAccess.find(item => item.moduleId === 'siebridge');
  assert.ok(ultimateBridge.capabilities.includes('review_siebridge_content'));
  assert.ok(ultimateBridge.capabilities.includes('delete_siebridge_approved_resource'));

  const assignedPresidiumAccess = getHubModuleAccess({
    role: 'superadmin',
    memberRole: 'presidium',
    positionTitle: 'presidium_member',
    managedDepartments: [{ organization: 'student_union', department: 'academic_technology' }]
  });
  const assignedBridge = assignedPresidiumAccess.find(item => item.moduleId === 'siebridge');
  assert.ok(assignedBridge.capabilities.includes('review_siebridge_content'));
  assert.ok(assignedBridge.capabilities.includes('delete_siebridge_approved_resource'));

  const departmentHeadAccess = getHubModuleAccess({
    role: 'superadmin',
    memberRole: 'department_lead',
    positionTitle: 'department_head',
    organization: 'student_union',
    department: 'academic_technology'
  });
  const departmentHeadBridge = departmentHeadAccess.find(item => item.moduleId === 'siebridge');
  assert.ok(!departmentHeadBridge.capabilities.includes('review_siebridge_content'));
  assert.ok(!departmentHeadBridge.capabilities.includes('delete_siebridge_approved_resource'));
});

test('all SIEHUB departments inherit the SIEVOX volunteer performance policy', () => {
  const expectedKeys = ['attendance', 'activity', 'feedback', 'copywriting', 'others', 'bonus'];

  listDepartments().forEach(({ organization, department }) => {
    const policy = getVolunteerPerformancePolicy(organization, department);
    assert.equal(policy.sourceProduct, 'SIEVOX');
    assert.equal(policy.template, 'sievox_default_v1');
    assert.equal(policy.totalBaseScore, 100);
    assert.deepEqual(policy.dimensions.map(item => item.key), expectedKeys);
    assert.deepEqual(policy.dimensions.map(item => item.maxScore), [20, 35, 25, 15, 5, null]);
  });
});

test('a downgraded or incomplete identity cannot retain management through an old title or scope', () => {
  for (const identity of [
    { role: 'student', memberRole: 'department_lead', positionTitle: 'department_head', organization: 'student_union', department: 'student_rights' },
    { role: 'superadmin', memberRole: 'student', positionTitle: 'presidium_member', managedDepartments: [{ organization: 'student_union', department: 'student_rights' }] },
    { role: 'admin', memberRole: 'student', positionTitle: 'volunteer', organization: 'student_union', department: 'student_rights' }
  ]) assert.ok(getHubModuleAccess(identity).every(module => module.accessLevel === 'student'));
});
