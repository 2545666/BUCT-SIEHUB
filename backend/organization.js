const ORGANIZATIONS = Object.freeze({
  youth_league: {
    label: '团委',
    departments: Object.freeze({
      organization: '组织部',
      publicity: '宣传部',
      practice: '实践部',
      volunteer_service: '志愿者工作部'
    })
  },
  student_union: {
    label: '学生会',
    departments: Object.freeze({
      general_office: '综合办公室',
      student_rights: '学生权益部',
      culture_sports_arts: '文体艺术部',
      academic_technology: '学术科技部',
      new_media: '新媒体工作部'
    })
  }
});

const MEMBER_ROLES = Object.freeze({
  student: '学生',
  volunteer: '志愿者',
  department_lead: '部门负责人层级',
  presidium: '主席团层级'
});

const POSITION_TITLES = Object.freeze({
  student: '学生',
  volunteer: '志愿者',
  department_head: '部门负责人',
  youth_league_cadre: '团委学生兼职团干部',
  presidium_member: '主席团成员',
  youth_league_deputy_secretary: '团委学生兼职副书记'
});

const ACCESS_ROLE_BY_MEMBER_ROLE = Object.freeze({
  student: 'student',
  volunteer: 'admin',
  department_lead: 'superadmin',
  presidium: 'superadmin'
});

const TITLES_BY_MEMBER_ROLE = Object.freeze({
  student: ['student'],
  volunteer: ['volunteer'],
  department_lead: ['department_head', 'youth_league_cadre'],
  presidium: ['presidium_member', 'youth_league_deputy_secretary']
});

const getDepartment = (organization, department) => ORGANIZATIONS[organization]?.departments?.[department];

const listDepartments = () => Object.entries(ORGANIZATIONS).flatMap(([organizationKey, organization]) =>
  Object.entries(organization.departments).map(([departmentKey, departmentLabel]) => ({
    organization: organizationKey,
    organizationLabel: organization.label,
    department: departmentKey,
    departmentLabel
  }))
);

const HUB_SYSTEM = Object.freeze({
  id: 'siehub',
  name: 'SIEHUB',
  logo: null,
  type: 'platform'
});

const HUB_WINDOWS = Object.freeze([
  Object.freeze({
    id: 'hub_governance',
    hubId: HUB_SYSTEM.id,
    productName: 'SIEHUB',
    title: '组织治理中枢',
    moduleType: 'governance_window',
    status: 'active',
    ultimateOnly: true
  })
]);

const SIEVOX_DEPARTMENT = Object.freeze({
  organization: 'student_union',
  department: 'student_rights'
});

const SIEBRIDGE_DEPARTMENT = Object.freeze({
  organization: 'student_union',
  department: 'academic_technology'
});

const SIEVOX_VOLUNTEER_PERFORMANCE_POLICY = Object.freeze({
  id: 'sievox_volunteer_performance_v1',
  version: 1,
  template: 'sievox_default_v1',
  sourceProduct: 'SIEVOX',
  title: 'SIEVOX 志愿者绩效考核制度',
  description: '所有部门初始统一复刻学生权益部 SIEVOX 的六维志愿者绩效考核制度。',
  totalBaseScore: 100,
  bonusMode: 'extra',
  dimensions: Object.freeze([
    Object.freeze({
      key: 'attendance',
      label: '考勤积分',
      maxScore: 20,
      capLabel: '20分',
      color: 'purple',
      rule: '准时出勤/合规请假 +2 分；迟到早退 +1 分；无故缺席 0 分。',
      scoringMode: 'capped_additive'
    }),
    Object.freeze({
      key: 'activity',
      label: '活动贡献',
      maxScore: 35,
      capLabel: '35分',
      color: 'blue',
      rule: '核心统筹策划 +4~5 分；主要骨干 +2~3 分；普通参与 +1 分。',
      scoringMode: 'capped_additive'
    }),
    Object.freeze({
      key: 'feedback',
      label: '权益跟进',
      maxScore: 25,
      capLabel: '25分',
      color: 'green',
      rule: '按时巡检系统与规范回复留言 +2 分/周；全月账号无违规 +1.25 分/月。',
      scoringMode: 'capped_additive'
    }),
    Object.freeze({
      key: 'copywriting',
      label: '文案与策划',
      maxScore: 15,
      capLabel: '15分',
      color: 'yellow',
      rule: '主笔大型活动策划案 +4~5 分；主笔推送文案 +2~3 分；参与辅助 +1 分。',
      scoringMode: 'capped_additive'
    }),
    Object.freeze({
      key: 'others',
      label: '其他常规',
      maxScore: 5,
      capLabel: '5分',
      color: 'slate',
      rule: '完成物资管理、资料整理或跨部门对接 +1 分/次。',
      scoringMode: 'capped_additive'
    }),
    Object.freeze({
      key: 'bonus',
      label: '特别加分',
      maxScore: null,
      capLabel: '附加',
      color: 'red',
      rule: '获校级表彰、突出建设性贡献直接 +2~5 分，计入总分。',
      scoringMode: 'bonus'
    })
  ]),
  notes: Object.freeze([
    '全员初始为 0 分。',
    '前五项常规维度封顶后计入总分，特别加分为附加项。',
    '当前各部门均沿用同一份 SIEVOX 模板，后续可按部门独立调整。'
  ])
});

const isSievoxDepartment = (organization, department) =>
  organization === SIEVOX_DEPARTMENT.organization &&
  department === SIEVOX_DEPARTMENT.department;

const isSiebridgeDepartment = (organization, department) =>
  organization === SIEBRIDGE_DEPARTMENT.organization &&
  department === SIEBRIDGE_DEPARTMENT.department;

const buildManageCapabilities = (organization, department, options = {}) => {
  const caps = [
    'view',
    'enter_student_portal',
    'enter_manage_portal',
    'switch_portal',
    'manage_module',
    'manage_department_introduction',
    'manage_department_notice',
    'manage_department_members',
    'manage_department_accounts',
    'manage_department_performance',
    'manage_department_files',
    'view_department_files',
    'manage_volunteer_performance_policy'
  ];
  if (options.includeSiebridgeReview && isSiebridgeDepartment(organization, department)) {
    caps.push('review_siebridge_content', 'delete_siebridge_approved_resource');
  }
  return caps;
};

const getHubModuleId = (organization, department) =>
  isSievoxDepartment(organization, department)
    ? 'sievox'
    : isSiebridgeDepartment(organization, department)
      ? 'siebridge'
    : `department:${organization}:${department}`;

const listHubModules = () => listDepartments().map((assignment) => {
  const isSievox = isSievoxDepartment(assignment.organization, assignment.department);
  const isSiebridge = isSiebridgeDepartment(assignment.organization, assignment.department);
  return {
    id: getHubModuleId(assignment.organization, assignment.department),
    hubId: HUB_SYSTEM.id,
    organization: assignment.organization,
    organizationLabel: assignment.organizationLabel,
    department: assignment.department,
    departmentLabel: assignment.departmentLabel,
    productName: isSievox ? 'SIEVOX' : isSiebridge ? 'SIEBridge' : assignment.departmentLabel,
    moduleType: (isSievox || isSiebridge) ? 'mature' : 'scaffold',
    status: (isSievox || isSiebridge) ? 'active' : 'planned',
    studentEntry: isSievox || isSiebridge
  };
});

const listHubWindows = () => HUB_WINDOWS.map(window => ({ ...window }));

const getHubModuleAccess = (user = {}) => {
  const accessByModuleId = new Map();
  const accessRank = { student: 1, member: 2, manage: 3, ultimate: 4 };
  const grant = (organization, department, accessLevel, capabilities) => {
    if (!isValidManagedDepartment({ organization, department })) return;
    const moduleId = getHubModuleId(organization, department);
    const existing = accessByModuleId.get(moduleId);
    if (existing && (accessRank[existing.accessLevel] || 0) >= (accessRank[accessLevel] || 0)) return;
    accessByModuleId.set(moduleId, {
      moduleId,
      organization,
      department,
      accessLevel,
      capabilities
    });
  };

  listDepartments().forEach(({ organization, department }) => {
    grant(organization, department, 'student', [
      'view',
      'enter_student_portal'
    ]);
  });

  if (user.isUltimateAdmin) {
    listHubWindows().forEach(window => {
      accessByModuleId.set(window.id, {
        moduleId: window.id,
        accessLevel: 'ultimate',
        capabilities: [
          'view',
          'manage_organization_framework',
          'manage_cohort_archive',
          'manage_member_identity',
          'manage_department_accounts',
          'manage_department_members',
          'manage_department_performance'
        ]
      });
    });
    listDepartments().forEach(({ organization, department }) => {
      grant(organization, department, 'manage', buildManageCapabilities(organization, department, { includeSiebridgeReview: true }));
    });
    return Array.from(accessByModuleId.values());
  }

  if (user.role === 'superadmin' && user.memberRole === 'department_lead' && ['department_head', 'youth_league_cadre'].includes(user.positionTitle)) {
    grant(user.organization, user.department, 'manage', buildManageCapabilities(user.organization, user.department));
    return Array.from(accessByModuleId.values());
  }

  if (user.role === 'superadmin' && user.memberRole === 'presidium' && (user.positionTitle === 'presidium_member' || user.positionTitle === 'youth_league_deputy_secretary')) {
    normalizeManagedDepartments(user.managedDepartments).forEach(({ organization, department }) => {
      grant(organization, department, 'manage', buildManageCapabilities(organization, department, { includeSiebridgeReview: true }));
    });
    return Array.from(accessByModuleId.values());
  }

  if (user.role === 'admin' && user.memberRole === 'volunteer' && user.positionTitle === 'volunteer') {
    getMemberDepartments(user).forEach(({ organization, department }) => grant(organization, department, 'member', ['view', 'enter_student_portal', 'participate', 'view_department_files']));
    return Array.from(accessByModuleId.values());
  }

  return Array.from(accessByModuleId.values());
};

const isValidManagedDepartment = (assignment = {}) =>
  Boolean(getDepartment(assignment.organization, assignment.department));

const normalizeManagedDepartments = (assignments = []) => {
  if (!Array.isArray(assignments)) return [];
  const seen = new Set();
  return assignments
    .filter(isValidManagedDepartment)
    .map(({ organization, department }) => ({ organization, department }))
    .filter((assignment) => {
      const key = `${assignment.organization}:${assignment.department}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getMemberDepartments = (user = {}) => normalizeManagedDepartments([
  { organization: user.organization, department: user.department },
  ...(user.memberRole === 'volunteer' && Array.isArray(user.volunteerDepartments) ? user.volunteerDepartments : [])
]);

const isMemberOfDepartment = (user, assignment) => getMemberDepartments(user).some(item =>
  item.organization === assignment.organization && item.department === assignment.department
);

const departmentMemberQuery = assignment => ({ $or: [
  { organization: assignment.organization, department: assignment.department },
  { memberRole: 'volunteer', volunteerDepartments: { $elemMatch: { organization: assignment.organization, department: assignment.department } } }
] });

const canWithdrawSievoxFeedback = (user = {}, feedback = {}) => {
  const actorId = String(user._id || user.id || '');
  const submitterId = String(feedback.user?._id || feedback.user?.id || feedback.user || '');
  if (actorId && actorId === submitterId) return feedback.status === 'pending';
  const isStudentRightsLeader = user.role === 'superadmin' &&
    user.memberRole === 'department_lead' &&
    user.positionTitle === 'department_head' &&
    isSievoxDepartment(user.organization, user.department);
  const isAssignedPresidium = user.role === 'superadmin' &&
    user.memberRole === 'presidium' &&
    user.positionTitle === 'presidium_member' &&
    normalizeManagedDepartments(user.managedDepartments).some(item =>
      isSievoxDepartment(item.organization, item.department)
    );
  return isStudentRightsLeader || isAssignedPresidium;
};

const getVolunteerPerformancePolicy = (organization, department) => {
  if (!isValidManagedDepartment({ organization, department })) return null;
  return {
    id: `${organization}_${department}_${SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.template}`,
    sourcePolicyId: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.id,
    version: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.version,
    template: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.template,
    sourceProduct: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.sourceProduct,
    title: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.title,
    description: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.description,
    totalBaseScore: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.totalBaseScore,
    bonusMode: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.bonusMode,
    moduleId: getHubModuleId(organization, department),
    organization,
    organizationLabel: ORGANIZATIONS[organization].label,
    department,
    departmentLabel: getDepartment(organization, department),
    inheritedFrom: {
      moduleId: getHubModuleId(SIEVOX_DEPARTMENT.organization, SIEVOX_DEPARTMENT.department),
      organization: SIEVOX_DEPARTMENT.organization,
      organizationLabel: ORGANIZATIONS[SIEVOX_DEPARTMENT.organization].label,
      department: SIEVOX_DEPARTMENT.department,
      departmentLabel: getDepartment(SIEVOX_DEPARTMENT.organization, SIEVOX_DEPARTMENT.department),
      productName: 'SIEVOX'
    },
    dimensions: SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.dimensions.map(item => ({ ...item })),
    notes: [...SIEVOX_VOLUNTEER_PERFORMANCE_POLICY.notes]
  };
};

const getDepartmentLabel = (organization, department) => {
  const organizationLabel = ORGANIZATIONS[organization]?.label || '';
  const departmentLabel = getDepartment(organization, department) || '';
  return [organizationLabel, departmentLabel].filter(Boolean).join(' · ');
};

function validateAssignment(input = {}) {
  const { memberRole, positionTitle } = input;
  const organization = input.organization || null;
  const department = input.department || null;

  if (!MEMBER_ROLES[memberRole]) return { valid: false, message: '组织身份无效' };
  if (!TITLES_BY_MEMBER_ROLE[memberRole]?.includes(positionTitle)) {
    return { valid: false, message: '具体职务与组织身份不匹配' };
  }

  if (memberRole === 'student') {
    if (organization || department) return { valid: false, message: '学生身份不能绑定团委或学生会部门' };
    return { valid: true, accessRole: 'student', organization: null, department: null };
  }

  if (memberRole === 'presidium') {
    if (organization || department) return { valid: false, message: '主席团层级职务暂不直接归属单一部门' };
    return { valid: true, accessRole: 'superadmin', organization: null, department: null };
  }

  if (!ORGANIZATIONS[organization]) return { valid: false, message: '请选择团委或学生会' };
  if (!getDepartment(organization, department)) return { valid: false, message: '所选部门不属于当前组织' };

  if (memberRole === 'volunteer' && positionTitle === 'volunteer') {
    return {
      valid: true,
      accessRole: ACCESS_ROLE_BY_MEMBER_ROLE[memberRole],
      organization,
      department
    };
  }

  if (positionTitle === 'youth_league_cadre' && organization !== 'youth_league') {
    return { valid: false, message: '团委学生兼职团干部只能归属团委部门' };
  }
  if (positionTitle === 'department_head' && organization !== 'student_union') {
    return { valid: false, message: '部门负责人只能归属学生会部门' };
  }

  return {
    valid: true,
    accessRole: ACCESS_ROLE_BY_MEMBER_ROLE[memberRole],
    organization,
    department
  };
}

function getIdentityLabel(user = {}) {
  if (user.isUltimateAdmin) return '终极管理员';
  if (POSITION_TITLES[user.positionTitle]) return POSITION_TITLES[user.positionTitle];
  if (user.role === 'admin') return '志愿者';
  if (user.role === 'superadmin') return '超级管理员 · 职务待确认';
  return '学生';
}

function getAssignableScope(user = {}) {
  if (user.isUltimateAdmin) return null;
  return getHubModuleAccess(user).filter(module => module.accessLevel === 'manage').map(({ organization, department }) => ({ organization, department }));
}

module.exports = {
  getMemberDepartments,
  isMemberOfDepartment,
  departmentMemberQuery,
  ORGANIZATIONS,
  MEMBER_ROLES,
  POSITION_TITLES,
  ACCESS_ROLE_BY_MEMBER_ROLE,
  TITLES_BY_MEMBER_ROLE,
  HUB_SYSTEM,
  SIEBRIDGE_DEPARTMENT,
  SIEVOX_DEPARTMENT,
  SIEVOX_VOLUNTEER_PERFORMANCE_POLICY,
  canWithdrawSievoxFeedback,
  getDepartment,
  getDepartmentLabel,
  getHubModuleAccess,
  getHubModuleId,
  getIdentityLabel,
  getAssignableScope,
  getVolunteerPerformancePolicy,
  isValidManagedDepartment,
  listDepartments,
  listHubModules,
  listHubWindows,
  normalizeManagedDepartments,
  validateAssignment
};
