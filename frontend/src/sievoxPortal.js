const RIGHTS_ORGANIZATION = 'student_union';
const RIGHTS_DEPARTMENT = 'student_rights';

const rightsAccess = user => (user?.moduleCapabilities || []).find(item =>
  item?.moduleId === 'sievox' ||
  (item?.organization === RIGHTS_ORGANIZATION && item?.department === RIGHTS_DEPARTMENT)
);

export const getSievoxPortalRole = user => {
  if (user?.isUltimateAdmin) return 'ultimate';
  const access = rightsAccess(user);
  if (access?.accessLevel === 'manage' && user?.role === 'superadmin') {
    if (user.memberRole === 'department_lead' && user.positionTitle === 'department_head') return 'lead';
    if (user.memberRole === 'presidium' && user.positionTitle === 'presidium_member') return 'presidium';
  }
  if (access?.accessLevel === 'member' && user?.role === 'admin' && user.memberRole === 'volunteer' && user.positionTitle === 'volunteer') return 'volunteer';
  return 'student';
};

export const defaultSievoxPortalView = user => {
  const role = getSievoxPortalRole(user);
  return role === 'ultimate' || role === 'lead' || role === 'presidium' ? 'superadmin' : role === 'volunteer' ? 'admin' : 'student';
};

export const resolveSievoxPortalView = (user, requested) => {
  const role = getSievoxPortalRole(user);
  if (role === 'student') return 'student';
  if (requested === 'student') return 'student';
  if (role === 'ultimate' && ['admin', 'superadmin'].includes(requested)) return requested;
  return defaultSievoxPortalView(user);
};

export const sievoxRoleCopy = user => {
  const role = getSievoxPortalRole(user);
  if (role === 'volunteer') return { label: '志愿者', title: '学生权益部处理台', scope: '学生权益部 · 处理本部门反馈' };
  if (role === 'lead') return { label: '负责人', title: '学生权益部处理台', scope: '学生权益部负责人 · 管理本部门反馈' };
  if (role === 'presidium') return { label: '主席团成员', title: '学生权益部处理台', scope: '主席团成员 · 分管学生权益部反馈' };
  if (role === 'ultimate') return { label: '终极管理员', title: '权益治理总览', scope: '全平台 · 查看各部门反馈' };
  return { label: '学生', title: '我的权益工作台', scope: '提交与跟进本人反馈' };
};
