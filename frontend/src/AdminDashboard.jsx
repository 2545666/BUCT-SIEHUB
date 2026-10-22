import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import sieLogo from './assets/LOGO_1.png';
import siehubLogo from './assets/SIEHUB_LOGO.png';
import siebridgeLogo from './assets/SIEBridge_LOGO.png';
import beian from './assets/beian.png';
import collegeLogo from './assets/SIE_LOGO.svg';
import { API_BASE, requestJson, uploadFeedbackFiles } from './api';
import AttachmentViewer from './AttachmentViewer';
import FeedbackPagination from './FeedbackPagination';
import { buildCalibrations } from './feedbackState';
import { ServiceHealthNote, useServiceMetrics } from './platformStatus';
import { sievoxRoleCopy } from './sievoxPortal';
import PerformanceDimensionRadar from './PerformanceDimensionRadar';


// ===================== 全局配置字典 =====================
const categories = {
  'academic': { label: '教学教务', icon: '📚' },
  'accommodation': { label: '宿舍住宿', icon: '🏠' },
  'catering': { label: '餐饮服务', icon: '🍽️' },
  'safety': { label: '安全保卫', icon: '🛡️' },
  'comprehensive': { label: '综合服务与其他', icon: '📋' }
};

const DEFAULT_SIEVOX_CURRENT_SEMESTER = '2026-2027学年 第一学期';

const ADMIN_FEEDBACK_CATEGORY_OPTIONS = [
  { value: 'academic', label: '教学教务', sub: ['课程与教学管理', '学业答疑与讲座安排', '考试与成绩管理', '其他教学相关'] },
  { value: 'accommodation', label: '宿舍住宿', sub: ['住宿环境与管理', '生活配套服务', '其他宿舍相关'] },
  { value: 'catering', label: '餐饮服务', sub: ['食品安全与卫生', '菜品与价格管理', '食堂运营与服务', '其他餐饮相关'] },
  { value: 'safety', label: '安全保卫', sub: ['人身与财产安全', '消防安全与隐患', '交通与出行安全', '网络与信息安全', '其他安全相关'] },
  { value: 'comprehensive', label: '综合服务与其他', sub: ['学院活动与文化建设', '心理健康与成长支持', '行政服务与流程优化', '校园公共设施与环境', '其他未分类诉求'] }
];

const statusConfig = {
  'pending': { label: '待处理', color: 'yellow' },
  'processing': { label: '处理中', color: 'blue' },
  'resolved': { label: '已解决', color: 'green' },
  'rejected': { label: '已拒绝', color: 'red' }
};

const priorityConfig = {
  'low': { label: '较低', color: 'gray' },
  'normal': { label: '一般', color: 'blue' },
  'high': { label: '紧急', color: 'red' }
};

const RoleTag = ({ user }) => {
  const label = user?.isUltimateAdmin ? '终极管理员' : (user?.identityLabel || (user?.role === 'superadmin' ? '超级管理员' : user?.role === 'admin' ? '志愿者' : '学生'));
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-purple-400/40 bg-purple-500/15 text-[10px] md:text-xs text-purple-100 whitespace-nowrap">
      {label}
    </span>
  );
};

const AdminPaletteBar = ({ themeTools }) => {
  if (!themeTools) return null;
  const colors = themeTools.palettes || [
    { key: 'purple', label: '典雅紫' },
    { key: 'blue', label: '海洋蓝' },
    { key: 'green', label: '森林绿' },
    { key: 'orange', label: '暖阳橙' },
    { key: 'teal', label: '青碧色' }
  ];
  const activeColor = themeTools.color || themeTools.palette || 'blue';
  const setColor = themeTools.setColor || themeTools.setPalette;
  return (
    <div className="sievox-palette-switch" aria-label="SIEVOX 管理端调色板">
      {colors.map(item => (
        <button
          key={item.key}
          type="button"
          className={`color-dot ${activeColor === item.key ? 'active' : ''}`}
          data-color={item.key}
          onClick={() => setColor?.(item.key)}
          title={item.label}
          aria-label={item.label}
        />
      ))}
    </div>
  );
};

const AdminThemeModeButtons = ({ themeTools }) => {
  if (!themeTools) return null;
  const setMode = themeTools.setMode;
  const mode = themeTools.mode || 'light';
  return (
    <div className="theme-mode-icons compact" aria-label="管理端深浅色切换">
      <button className={mode !== 'dark' ? 'is-active' : ''} type="button" onClick={() => setMode?.('light')} title="浅色模式" aria-label="浅色模式">☀</button>
      <button className={mode === 'dark' ? 'is-active' : ''} type="button" onClick={() => setMode?.('dark')} title="深色模式" aria-label="深色模式">☾</button>
    </div>
  );
};

const ORGANIZATION_FRAMEWORK = [
  {
    key: 'youth_league',
    title: '团委',
    accent: 'from-red-500/30 to-orange-400/10',
    leadership: '团委学生兼职团干部',
    departments: ['组织部', '宣传部', '实践部', '志愿者工作部']
  },
  {
    key: 'student_union',
    title: '学生会',
    accent: 'from-blue-500/30 to-cyan-400/10',
    leadership: '部门负责人',
    departments: ['综合办公室', '学生权益部', '文体艺术部', '学术科技部', '新媒体工作部']
  }
];

const ORGANIZATION_ORDER = ['youth_league', 'student_union'];
const DEPARTMENT_ARCHIVE_ORDER = [
  { organization: 'youth_league', organizationLabel: '团委', department: 'organization', departmentLabel: '组织部', badgeTone: 'red' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'publicity', departmentLabel: '宣传部', badgeTone: 'orange' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'practice', departmentLabel: '实践部', badgeTone: 'green' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'volunteer_service', departmentLabel: '志愿者工作部', badgeTone: 'rose' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'general_office', departmentLabel: '综合办公室', badgeTone: 'slate' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'student_rights', departmentLabel: '学生权益部', badgeTone: 'blue', logo: sieLogo },
  { organization: 'student_union', organizationLabel: '学生会', department: 'culture_sports_arts', departmentLabel: '文体艺术部', badgeTone: 'purple' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'academic_technology', departmentLabel: '学术科技部', badgeTone: 'teal', logo: siebridgeLogo },
  { organization: 'student_union', organizationLabel: '学生会', department: 'new_media', departmentLabel: '新媒体工作部', badgeTone: 'pink' }
];
const DEPARTMENT_ORDER_INDEX = new Map(DEPARTMENT_ARCHIVE_ORDER.map((item, index) => [`${item.organization}:${item.department}`, index]));
const ROLE_SORT_ORDER = {
  presidium_member: 0,
  youth_league_deputy_secretary: 0,
  department_head: 1,
  youth_league_cadre: 1,
  volunteer: 2
};

const canManageFeedbackWithdrawal = (user = {}) => {
  const isStudentRightsLeader = user.role === 'superadmin' &&
    user.memberRole === 'department_lead' &&
    user.positionTitle === 'department_head' &&
    user.organization === 'student_union' &&
    user.department === 'student_rights';
  const isAssignedPresidium = user.role === 'superadmin' &&
    user.memberRole === 'presidium' &&
    user.positionTitle === 'presidium_member' &&
    (user.managedDepartments || []).some(item =>
      item.organization === 'student_union' && item.department === 'student_rights'
    );
  return isStudentRightsLeader || isAssignedPresidium;
};
const DEPARTMENT_MEMBER_TIERS = [
  { key: 'presidium', rank: 0, label: '主席层级', shortLabel: '主席层级' },
  { key: 'department_lead', rank: 1, label: '负责人层级', shortLabel: '负责人层级' },
  { key: 'volunteer', rank: 2, label: '志愿者', shortLabel: '志愿者' }
];
const DEPARTMENT_BADGE_STYLE = {
  red: { backgroundColor: 'rgba(248, 113, 113, 0.18)' },
  orange: { backgroundColor: 'rgba(251, 146, 60, 0.18)' },
  green: { backgroundColor: 'rgba(34, 197, 94, 0.18)' },
  rose: { backgroundColor: 'rgba(244, 114, 182, 0.18)' },
  slate: { backgroundColor: 'rgba(100, 116, 139, 0.18)' },
  blue: { backgroundColor: 'rgba(59, 130, 246, 0.18)' },
  purple: { backgroundColor: 'rgba(168, 85, 247, 0.18)' },
  teal: { backgroundColor: 'rgba(20, 184, 166, 0.18)' },
  pink: { backgroundColor: 'rgba(236, 72, 153, 0.18)' }
};

const normalizeSearch = value => String(value || '').trim().toLowerCase();
const getDepartmentOrderIndex = member => DEPARTMENT_ORDER_INDEX.get(`${member.organization || ''}:${member.department || ''}`) ?? 999;
const getMemberSortRank = (member = {}) => {
  const positionTitle = member.positionTitle || member.user?.positionTitle || 'student';
  const memberRole = member.memberRole || member.user?.memberRole || 'student';
  if (ROLE_SORT_ORDER[positionTitle] !== undefined) return ROLE_SORT_ORDER[positionTitle];
  if (memberRole === 'volunteer' || positionTitle === 'volunteer') return 2;
  return 3;
};
const getMemberPerformanceTotal = member => Number(member?.performanceSnapshot?.total || 0);
const GovernancePerformance = ({ snapshot }) => {
  if (!snapshot || (snapshot.source === 'none' && !(snapshot.monthlyScores || []).length && !(snapshot.records || []).length)) return <span>暂无成绩</span>;
  const monthly = (snapshot.monthlyScores || []).length > 0;
  const completed = (snapshot.monthlyScores || []).filter(item => item.combinedScore != null);
  const semester = (snapshot.semesterScores || []).length > 0;
  const completedSemesters = (snapshot.semesterScores || []).filter(item => item.total != null);
  const dimensions = snapshot.source === 'semester' ? (snapshot.dimensions || []) : snapshot.dimensions?.length ? snapshot.dimensions : (snapshot.policy?.dimensions || [])
    .filter(item => item.scoringMode !== 'bonus')
    .map(item => ({ name: item.label, score: Number(snapshot.byDimension?.[item.key] || 0), max: Number(item.maxScore || 0) }));
  return <details className="org-performance-detail">
    <summary>{snapshot.source === 'semester' ? snapshot.total == null ? '学期成绩待完成' : `学期均分 ${Number(snapshot.total).toFixed(1)}` : snapshot.source === 'monthly' ? `旧月均 ${Number(snapshot.total || 0).toFixed(1)}` : snapshot.source === 'legacy' || !snapshot.source ? `旧制总分 ${Number(snapshot.total || 0).toFixed(1)}` : '暂无成绩'}{snapshot.source === 'semester' && <small> · 已完成 {completedSemesters.length} 学期</small>}{snapshot.source === 'monthly' && <small> · 已完成 {completed.length} 个月</small>}</summary>
    {dimensions.length > 0 && <PerformanceDimensionRadar dimensions={dimensions} label="归档绩效维度" />}
    {semester && <div className="org-performance-months">{snapshot.semesterScores.map(item => <span key={item.semester}>{item.semester}：{item.total == null ? '未完成' : `${Number(item.total).toFixed(1)} 分`}</span>)}</div>}
    {monthly && <details><summary>查看旧月度成绩</summary><div className="org-performance-months">{snapshot.monthlyScores.map(item => <span key={item.id || item.month}>{item.month}：{item.combinedScore == null ? '未完成' : `${Number(item.combinedScore).toFixed(1)} 分`}</span>)}</div></details>}
    {(snapshot.records || []).length > 0 && <small>保留旧制积分流水 {snapshot.records.length} 条。</small>}
  </details>;
};
const getMemberTierRank = (member = {}) => {
  const positionTitle = member.positionTitle || member.user?.positionTitle || 'student';
  const memberRole = member.memberRole || member.user?.memberRole || 'student';
  if (['presidium_member', 'youth_league_deputy_secretary'].includes(positionTitle) || memberRole === 'presidium') return 0;
  if (['department_head', 'youth_league_cadre'].includes(positionTitle) || memberRole === 'department_lead') return 1;
  return 2;
};
const groupMembersByTier = (members = []) => {
  const groups = DEPARTMENT_MEMBER_TIERS.map(meta => ({ ...meta, members: [] }));
  members.forEach(member => {
    const target = groups.find(item => item.rank === getMemberTierRank(member));
    if (target) target.members.push(member);
  });
  return groups;
};
const getGovernanceTierLabel = (rank, organization) => {
  if (rank === 0) return organization === 'youth_league' ? '团委学生兼职副书记' : '主席团成员';
  if (rank === 1) return organization === 'youth_league' ? '团委学生兼职团干部' : '部门负责人';
  return '志愿者';
};
const getGovernanceMemberRoleTitle = (member = {}) => {
  const positionTitle = member.positionTitle || member.user?.positionTitle || '';
  if (positionTitle === 'presidium_member') return '主席团成员';
  if (positionTitle === 'youth_league_deputy_secretary') return '团委学生兼职副书记';
  if (positionTitle === 'department_head') return '部门负责人';
  if (positionTitle === 'youth_league_cadre') return '团委学生兼职团干部';
  if (positionTitle === 'volunteer' || member.memberRole === 'volunteer') return '志愿者';
  return member.identityLabel || member.positionTitle || '-';
};
const getGovernanceTierVisualStyle = (rank) => {
  if (rank === 0) {
    return {
      color: '#ffffff',
      background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-primary) 82%, #0f172a), #0f172a)',
      borderColor: 'color-mix(in srgb, var(--theme-primary) 62%, rgba(255,255,255,.24))'
    };
  }
  if (rank === 1) {
    return {
      color: '#0f172a',
      background: 'color-mix(in srgb, var(--theme-primary) 34%, #ffffff)',
      borderColor: 'color-mix(in srgb, var(--theme-primary) 42%, rgba(15,23,42,.14))'
    };
  }
  return {
    color: '#0f172a',
    background: 'color-mix(in srgb, var(--theme-primary) 14%, #ffffff)',
    borderColor: 'color-mix(in srgb, var(--theme-primary) 24%, rgba(15,23,42,.12))'
  };
};
const sortMembersForGovernance = (members = []) => [...members].sort((a, b) => {
  const departmentDiff = getDepartmentOrderIndex(a) - getDepartmentOrderIndex(b);
  if (departmentDiff !== 0) return departmentDiff;
  const rankDiff = getMemberSortRank(a) - getMemberSortRank(b);
  if (rankDiff !== 0) return rankDiff;
  const performanceDiff = getMemberPerformanceTotal(b) - getMemberPerformanceTotal(a);
  if (performanceDiff !== 0) return performanceDiff;
  return String(a.studentId || a.accountSnapshot?.studentId || '').localeCompare(String(b.studentId || b.accountSnapshot?.studentId || ''), 'zh-Hans-CN');
});
const groupMembersByDepartment = (members = []) => {
  const grouped = new Map(DEPARTMENT_ARCHIVE_ORDER.map(item => [`${item.organization}:${item.department}`, { ...item, members: [] }]));
  members.forEach(member => {
    const managedDepartments = Array.isArray(member.managedDepartments) ? member.managedDepartments : [];
    const keys = member.memberRole === 'presidium' || ['presidium_member', 'youth_league_deputy_secretary'].includes(member.positionTitle)
      ? managedDepartments.map(item => `${item.organization || ''}:${item.department || ''}`)
      : [`${member.organization || ''}:${member.department || ''}`];
    [...new Set(keys)].forEach(key => {
      if (!grouped.has(key)) return;
      grouped.get(key).members.push(member);
    });
  });
  grouped.forEach(group => {
    group.members = sortMembersForGovernance(group.members);
  });
  return ORGANIZATION_ORDER.map(org => ({
    organization: org,
    groups: DEPARTMENT_ARCHIVE_ORDER.filter(item => item.organization === org).map(item => grouped.get(`${item.organization}:${item.department}`) || { ...item, members: [] })
  }));
};
const getDepartmentBadgeText = (departmentLabel = '') => {
  const clean = String(departmentLabel).replace(/部门|工作部|办公室/g, '').trim();
  return clean.slice(0, 2) || departmentLabel.slice(0, 2) || '部';
};
const DepartmentLogoMark = ({ item }) => {
  if (item?.logo) {
    return <img src={item.logo} alt={item.departmentLabel} className="h-full w-full object-contain p-1" />;
  }
  return <span className="text-[11px] font-black tracking-wide text-white">{getDepartmentBadgeText(item?.departmentLabel)}</span>;
};

const DEPARTMENT_OPTIONS = [
  { organization: 'youth_league', organizationLabel: '团委', department: 'organization', departmentLabel: '组织部' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'publicity', departmentLabel: '宣传部' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'practice', departmentLabel: '实践部' },
  { organization: 'youth_league', organizationLabel: '团委', department: 'volunteer_service', departmentLabel: '志愿者工作部' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'general_office', departmentLabel: '综合办公室' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'student_rights', departmentLabel: '学生权益部' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'culture_sports_arts', departmentLabel: '文体艺术部' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'academic_technology', departmentLabel: '学术科技部' },
  { organization: 'student_union', organizationLabel: '学生会', department: 'new_media', departmentLabel: '新媒体工作部' }
];

const TITLE_OPTIONS_BY_MEMBER_ROLE = {
  student: [{ value: 'student', label: '学生' }],
  volunteer: [{ value: 'volunteer', label: '志愿者' }],
  department_lead: [
    { value: 'department_head', label: '部门负责人' },
    { value: 'youth_league_cadre', label: '团委学生兼职团干部' }
  ],
  presidium: [
    { value: 'presidium_member', label: '主席团成员' },
    { value: 'youth_league_deputy_secretary', label: '团委学生兼职副书记' }
  ]
};

const MEMBER_ROLE_LABELS = {
  student: '学生',
  volunteer: '志愿者',
  department_lead: '部门负责人层级',
  presidium: '主席团层级'
};

const emptyMemberForm = {
  studentId: '',
  memberRole: 'volunteer',
  positionTitle: 'volunteer',
  organization: '',
  department: '',
  managedDepartments: []
};

export const OrganizationFrameworkPanel = ({ token }) => {
  const [cohorts, setCohorts] = useState([]);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [cohortForm, setCohortForm] = useState({ name: '2026届团委学生会', semesters: '', status: 'active' });
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [archivePreview, setArchivePreview] = useState(null);
  const [reviewWindow, setReviewWindow] = useState(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const titleOptions = TITLE_OPTIONS_BY_MEMBER_ROLE[memberForm.memberRole] || TITLE_OPTIONS_BY_MEMBER_ROLE.student;
  const selectedCohort = cohorts.find(c => (c.id || c._id) === selectedCohortId);
  const isArchivedCohort = selectedCohort?.status === 'archived';
  const visibleUsers = users.filter(item => item.isActive !== false);
  const filteredUsers = useMemo(() => {
    const query = normalizeSearch(memberSearchQuery);
    const baseList = query
      ? visibleUsers.filter(item => (
        normalizeSearch(item.name).includes(query) ||
        normalizeSearch(item.studentId).includes(query)
      ))
      : visibleUsers;
    const selected = visibleUsers.find(item => (item.studentId || '') === memberForm.studentId);
    if (selected && !baseList.some(item => (item.studentId || '') === selected.studentId)) {
      return [selected, ...baseList];
    }
    return baseList;
  }, [memberSearchQuery, memberForm.studentId, visibleUsers]);
  const sortedMembers = useMemo(() => sortMembersForGovernance(members), [members]);
  const performanceMembers = members.filter(member => ['volunteer', 'department_lead'].includes(member.memberRole) && member.organization && member.department);
  const archiveGroups = useMemo(() => groupMembersByDepartment(archivePreview?.members || []), [archivePreview]);
  const memberTierGroups = useMemo(() => groupMembersByTier(sortedMembers), [sortedMembers]);
  const singleDepartmentOptions = memberForm.positionTitle === 'youth_league_cadre'
    ? DEPARTMENT_OPTIONS.filter(item => item.organization === 'youth_league')
    : memberForm.positionTitle === 'department_head'
      ? DEPARTMENT_OPTIONS.filter(item => item.organization === 'student_union')
      : DEPARTMENT_OPTIONS;

  const authHeaders = { 'Authorization': `Bearer ${token}` };
  const jsonHeaders = { 'Content-Type': 'application/json', ...authHeaders };

  const loadBase = useCallback(async () => {
    try {
      const [cohortRes, userRes, reviewRes] = await Promise.all([
        fetch(`${API_BASE}/ultimate/cohorts`, { headers: authHeaders }),
        fetch(`${API_BASE}/ultimate/users`, { headers: authHeaders }),
        fetch(`${API_BASE}/ultimate/performance-review-window`, { headers: authHeaders })
      ]);
      const cohortData = await cohortRes.json();
      const userData = await userRes.json();
      const reviewData = await reviewRes.json();
      if (cohortData.success) {
        const nextCohorts = cohortData.cohorts || [];
        setCohorts(nextCohorts);
        const stillExists = nextCohorts.some(item => (item.id || item._id) === selectedCohortId);
        if ((!selectedCohortId || !stillExists) && nextCohorts.length > 0) setSelectedCohortId(nextCohorts[0].id || nextCohorts[0]._id);
      }
      if (userData.success) setUsers(userData.users || []);
      if (reviewData.success) setReviewWindow(reviewData);
    } catch (error) {
      console.error('加载组织归档基础数据失败:', error);
    }
  }, [token, selectedCohortId]);

  const loadMembers = useCallback(async (cohortId = selectedCohortId) => {
    if (!cohortId) {
      setMembers([]);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/ultimate/members?cohortId=${encodeURIComponent(cohortId)}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setMembers(data.members || []);
    } catch (error) {
      console.error('加载届次成员失败:', error);
    }
  }, [token, selectedCohortId]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMembers(selectedCohortId); setArchivePreview(null); }, [loadMembers, selectedCohortId]);

  const handleCreateCohort = async (e) => {
    e.preventDefault();
    if (!cohortForm.name.trim()) return alert('请填写届次名称');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/cohorts`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          name: cohortForm.name.trim(),
          status: cohortForm.status,
          semesters: cohortForm.semesters.split(/[,，\n]+/).map(item => item.trim()).filter(Boolean)
        })
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || '创建届次失败');
      setSelectedCohortId(data.cohort.id || data.cohort._id);
      await loadBase();
      alert('届次已创建');
    } catch (error) {
      alert('创建届次失败');
    } finally {
      setBusy(false);
    }
  };

  const updateMemberRole = (memberRole) => {
    const nextTitle = TITLE_OPTIONS_BY_MEMBER_ROLE[memberRole]?.[0]?.value || 'student';
    setMemberForm({
      ...memberForm,
      memberRole,
      positionTitle: nextTitle,
      organization: '',
      department: '',
      managedDepartments: []
    });
  };

  const updatePositionTitle = (positionTitle) => {
    setMemberForm({
      ...memberForm,
      positionTitle,
      organization: '',
      department: ''
    });
  };

  const updateSingleDepartment = (value) => {
    const selected = DEPARTMENT_OPTIONS.find(item => `${item.organization}:${item.department}` === value);
    setMemberForm({
      ...memberForm,
      organization: selected?.organization || '',
      department: selected?.department || ''
    });
  };

  const toggleManagedDepartment = (item) => {
    const exists = memberForm.managedDepartments.some(current => current.organization === item.organization && current.department === item.department);
    setMemberForm({
      ...memberForm,
      managedDepartments: exists
        ? memberForm.managedDepartments.filter(current => !(current.organization === item.organization && current.department === item.department))
        : [...memberForm.managedDepartments, { organization: item.organization, department: item.department }]
    });
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    if (!selectedCohortId) return alert('请先创建或选择届次');
    if (isArchivedCohort) return alert('已归档届次不可继续编辑成员');
    if (!memberForm.studentId) return alert('请选择成员账号');
    if (['department_lead', 'volunteer'].includes(memberForm.memberRole) && (!memberForm.organization || !memberForm.department)) {
      return alert(memberForm.memberRole === 'volunteer' ? '志愿者需要选择所属组织和部门' : '部门负责人层级需要选择所属组织和部门');
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/members`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          cohortId: selectedCohortId,
          studentId: memberForm.studentId,
          memberRole: memberForm.memberRole,
          positionTitle: memberForm.positionTitle,
          organization: memberForm.organization || null,
          department: memberForm.department || null,
          managedDepartments: memberForm.memberRole === 'presidium' ? memberForm.managedDepartments : []
        })
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || '保存成员失败');
      setMemberForm(emptyMemberForm);
      setMemberSearchQuery('');
      await Promise.all([loadBase(), loadMembers(selectedCohortId)]);
      alert('成员身份与分管部门已保存');
    } catch (error) {
      alert('保存成员失败');
    } finally {
      setBusy(false);
    }
  };

  const handlePreviewArchive = async () => {
    if (!selectedCohortId) return alert('请先选择届次');
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/cohorts/${selectedCohortId}/archive-preview`, { headers: authHeaders });
      const data = await res.json();
      if (!data.success) return alert(data.message || '生成归档预览失败');
      setArchivePreview(data);
    } catch (error) {
      alert('生成归档预览失败');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedCohortId) return alert('请先选择届次');
    if (isArchivedCohort) return alert('该届次已经归档');
    if (!window.confirm('确认归档该届次吗？归档会冻结成员身份、各学期绩效与学年汇总，旧月度记录保留供查阅。')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/cohorts/${selectedCohortId}/archive`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || '归档失败');
      await Promise.all([loadBase(), loadMembers(selectedCohortId)]);
      setArchivePreview(null);
      alert(`归档完成，共归档 ${data.archivedMembers || 0} 名成员`);
    } catch (error) {
      alert('归档失败');
    } finally {
      setBusy(false);
    }
  };

  const handleArchivePerformanceSemester = async semester => {
    if (!selectedCohortId || isArchivedCohort) return;
    if (!window.confirm(`归档 ${semester} 的绩效成绩？归档后该学期评价不可修改。`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/cohorts/${selectedCohortId}/performance-semesters/${encodeURIComponent(semester)}/archive`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!data.success) return alert(data.message || '学期绩效归档失败');
      await loadMembers(selectedCohortId);
      setArchivePreview(null);
      alert(`${semester} 已归档，共保存 ${data.archivedMembers || 0} 名成员的学期绩效`);
    } catch (error) { alert('学期绩效归档失败'); }
    finally { setBusy(false); }
  };

  const handleReviewWindow = async () => {
    if (!reviewWindow?.currentSemester) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/performance-review-window`, { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ semester: reviewWindow.currentSemester, open: !reviewWindow.open }) });
      const data = await res.json();
      if (!data.success) return alert(data.message || '更新评价时间失败');
      setReviewWindow(data);
    } catch { alert('更新评价时间失败'); }
    finally { setBusy(false); }
  };

  const handleDeleteCohort = async () => {
    if (!selectedCohortId || !selectedCohort) return alert('请先选择要删除的届次');
    const memberCount = members.length;
    const typedName = window.prompt(`危险操作：删除届次会同时删除该届次下 ${memberCount} 条成员归档记录，且不可恢复。\n\n请输入届次完整名称以继续：\n${selectedCohort.name}`);
    if (typedName === null) return;
    if (typedName.trim() !== selectedCohort.name) return alert('届次名称输入不一致，已取消删除');
    const confirmation = window.prompt('请再次输入“确认删除”四个字完成最终确认：');
    if (confirmation === null) return;
    if (confirmation.trim() !== '确认删除') return alert('最终确认文本不一致，已取消删除');

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/ultimate/cohorts/${selectedCohortId}`, {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ cohortName: typedName.trim(), confirmation: confirmation.trim() })
      });
      const data = await res.json();
      if (!data.success) return alert(data.message || '删除届次失败');
      setSelectedCohortId('');
      setMembers([]);
      setArchivePreview(null);
      await loadBase();
      alert(`届次已删除，同时删除 ${data.deletedMembers || 0} 条成员记录`);
    } catch (error) {
      alert('删除届次失败');
    } finally {
      setBusy(false);
    }
  };

  const handleEditMember = (member) => {
    if (isArchivedCohort) return;
    setMemberSearchQuery(member.name || member.studentId || '');
    setMemberForm({
      studentId: member.studentId || member.accountSnapshot?.studentId || '',
      memberRole: member.memberRole || 'volunteer',
      positionTitle: member.positionTitle || 'volunteer',
      organization: member.organization || '',
      department: member.department || '',
      managedDepartments: (member.managedDepartments || []).map(item => ({
        organization: item.organization,
        department: item.department
      }))
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="organization-framework-panel animate-fadeIn space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8">
        <div className="absolute right-0 top-0 h-40 w-40 bg-purple-500/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-sm text-purple-200/60 font-medium">终极管理员 · 组织框架</p>
            <h2 className="mt-2 text-2xl md:text-4xl font-black text-white tracking-tight">团委学生会架构</h2>
            <p className="mt-3 max-w-3xl text-sm md:text-base leading-7 text-purple-100/70">
              团委与学生会分开管理，主席团成员 / 团委学生兼职副书记可分管多个部门，部门负责人层级只拥有对应部门权限。
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black text-white">2</div>
              <div className="text-[10px] text-purple-200/50">组织</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black text-white">9</div>
              <div className="text-[10px] text-purple-200/50">部门</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-2xl font-black text-white">{members.length}</div>
              <div className="text-[10px] text-purple-200/50">当前届成员</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ORGANIZATION_FRAMEWORK.map(org => (
          <section key={org.key} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
            <div className={`bg-gradient-to-br ${org.accent} border-b border-white/10 p-5`}>
              <p className="text-xs text-purple-100/60">组织</p>
              <h3 className="mt-1 text-2xl font-black text-white">{org.title}</h3>
              <div className="org-leadership-tag mt-3 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-purple-100/80">
                对应负责人标签：{org.leadership}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
              {org.departments.map((department, index) => (
                <div key={department} className="group rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-all hover:-translate-y-0.5 hover:border-purple-400/40 hover:bg-white/[0.08]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-purple-500/15 text-sm font-black text-purple-100">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-[10px] text-purple-200/40">{org.title}</span>
                  </div>
                  <h4 className="mt-4 text-lg font-bold text-white">{department}</h4>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
        <h3 className="text-lg font-bold text-white mb-4">身份与权限映射</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['学生', '学生端', '仅提交与查看自己的反馈'],
            ['志愿者', '子管理员端', '处理反馈并查看本人绩效'],
            ['部门负责人 / 团委学生兼职团干部', '超级管理员端', '管理本部门并查看志愿者排名'],
            ['主席团成员 / 团委学生兼职副书记', '超级管理员端', '查看分管部门志愿者排名与负责人绩效']
          ].map(([role, portal, scope]) => (
            <div key={role} className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
              <div className="text-sm font-bold text-white">{role}</div>
              <div className="mt-2 text-xs text-purple-300">{portal}</div>
              <p className="mt-3 text-xs leading-6 text-purple-100/60">{scope}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <section className="org-governance-card xl:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 space-y-5">
          <div>
            <p className="text-xs text-purple-200/60">Cohort Archive</p>
            <h3 className="mt-1 text-xl font-black text-white">届次与归档</h3>
          </div>
          <form onSubmit={handleCreateCohort} className="space-y-3">
            <input value={cohortForm.name} onChange={e => setCohortForm({ ...cohortForm, name: e.target.value })} placeholder="例：2026届团委学生会" className="org-governance-field w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500" />
            <input value={cohortForm.semesters} onChange={e => setCohortForm({ ...cohortForm, semesters: e.target.value })} placeholder="绩效学期，多个学期用逗号分隔" className="org-governance-field w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500" />
            <select value={cohortForm.status} onChange={e => setCohortForm({ ...cohortForm, status: e.target.value })} className="org-governance-field w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500">
              <option value="active">当前届</option>
              <option value="draft">草稿届次</option>
            </select>
            <button disabled={busy} className="org-action-primary w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-all">
              创建届次
            </button>
          </form>
          <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
            {cohorts.map(cohort => {
              const id = cohort.id || cohort._id;
              return (
                <button key={id} onClick={() => setSelectedCohortId(id)} className={`org-cohort-tab w-full text-left rounded-xl border px-4 py-3 transition-all ${selectedCohortId === id ? 'is-active' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="org-cohort-name font-bold">{cohort.name}</span>
                    <span className="org-cohort-status text-[10px] rounded-full border px-2 py-0.5">{cohort.status}</span>
                  </div>
                  <div className="org-cohort-semesters mt-1 text-xs">{(cohort.semesters || []).join('、') || '未绑定绩效学期'}</div>
                </button>
              );
            })}
            {cohorts.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-purple-100/50">暂无届次，请先创建</div>}
          </div>
          {selectedCohort && (
            <div
              className="org-delete-zone rounded-xl border p-3"
              style={{
                color: '#ffffff',
                background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                borderColor: 'rgba(254, 202, 202, .72)'
              }}
            >
              <p className="org-delete-warning text-xs leading-5">删除会移除当前届次及其成员归档记录，需输入完整届次名称和“确认删除”。</p>
              <button type="button" onClick={handleDeleteCohort} disabled={busy} className="org-action-danger mt-3 w-full rounded-lg border px-3 py-2 text-xs font-black disabled:opacity-50 transition-all">删除当前届次</button>
            </div>
          )}
        </section>

        <section className="org-governance-card xl:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <p className="text-xs text-purple-200/60">Member Assignment</p>
              <h3 className="mt-1 text-xl font-black text-white">成员身份与分管部门</h3>
              <p className="mt-1 text-xs text-purple-100/50">当前届次：{selectedCohort?.name || '未选择'}</p>
              {reviewWindow && <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-purple-100"><span>{reviewWindow.currentSemester} · 学期末评价{reviewWindow.open ? '已开放' : '未开放'}</span><button type="button" onClick={handleReviewWindow} disabled={busy} className="rounded-lg bg-blue-600/30 px-2 py-1 text-blue-100 disabled:opacity-50">{reviewWindow.open ? '关闭评价' : '开启评价'}</button></div>}
              {(selectedCohort?.semesters || []).map(semester => <div key={semester} className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-purple-100"><span>{semester} · 已归档 {performanceMembers.filter(member => member.semesterPerformanceArchives?.some(item => item.semester === semester)).length}/{performanceMembers.length} 人</span><button type="button" onClick={() => handleArchivePerformanceSemester(semester)} disabled={busy || isArchivedCohort} className="rounded-lg bg-purple-600/30 px-2 py-1 text-purple-100 disabled:opacity-50">归档本学期</button></div>)}
              {isArchivedCohort && <p className="mt-2 inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">历史档案只读，不能继续编辑成员</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handlePreviewArchive} disabled={busy || !selectedCohortId} className="px-3 py-2 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-100 text-xs font-bold disabled:opacity-50 transition-all">生成归档预览</button>
              <button onClick={handleArchive} disabled={busy || !selectedCohortId || isArchivedCohort} className="px-3 py-2 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-100 text-xs font-bold disabled:opacity-50 transition-all">确认归档</button>
            </div>
          </div>

          <form onSubmit={handleSaveMember} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="md:col-span-2">
              <span className="mb-2 block text-xs font-bold text-purple-100/70">选择成员账号</span>
              <input
                value={memberSearchQuery}
                onChange={e => setMemberSearchQuery(e.target.value)}
                placeholder="输入学号或姓名筛选成员账号"
                className="org-governance-field w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
              />
              <span className="mt-1 block text-[10px] text-purple-100/45">当前筛选到 {filteredUsers.length} 个可选账号</span>
            </label>
            <select disabled={isArchivedCohort} value={memberForm.studentId} onChange={e => setMemberForm({ ...memberForm, studentId: e.target.value })} className="org-governance-field px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50">
              <option value="">选择成员账号</option>
              {filteredUsers.map(item => <option key={item.id || item._id} value={item.studentId}>{item.name} · {item.studentId} · {item.identityLabel || item.role}</option>)}
            </select>
            <select disabled={isArchivedCohort} value={memberForm.memberRole} onChange={e => updateMemberRole(e.target.value)} className="org-governance-field px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50">
              {Object.entries(MEMBER_ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select disabled={isArchivedCohort} value={memberForm.positionTitle} onChange={e => updatePositionTitle(e.target.value)} className="org-governance-field px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50">
              {titleOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {['department_lead', 'volunteer'].includes(memberForm.memberRole) ? (
              <select disabled={isArchivedCohort} value={memberForm.organization && memberForm.department ? `${memberForm.organization}:${memberForm.department}` : ''} onChange={e => updateSingleDepartment(e.target.value)} className="org-governance-field px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 disabled:opacity-50">
                <option value="">选择所属组织与部门</option>
                {singleDepartmentOptions.map(item => <option key={`${item.organization}:${item.department}`} value={`${item.organization}:${item.department}`}>{item.organizationLabel} · {item.departmentLabel}</option>)}
              </select>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-purple-100/60">
                {memberForm.memberRole === 'presidium' ? '主席团层级通过下方选择多个分管部门' : '该身份无需绑定组织部门'}
              </div>
            )}
            {memberForm.memberRole === 'presidium' && (
              <div className="md:col-span-2 rounded-xl border border-white/10 bg-slate-950/30 p-3">
                <div className="mb-2 text-xs font-bold text-purple-100/70">分管部门，可多选</div>
                <div className="flex flex-wrap gap-2">
                  {DEPARTMENT_OPTIONS.map(item => {
                    const active = memberForm.managedDepartments.some(current => current.organization === item.organization && current.department === item.department);
                    return (
                      <button key={`${item.organization}:${item.department}`} type="button" disabled={isArchivedCohort} onClick={() => toggleManagedDepartment(item)} className={`px-3 py-1.5 rounded-lg border text-xs transition-all disabled:opacity-50 ${active ? 'bg-purple-600 border-purple-400 text-white' : 'bg-white/5 border-white/10 text-purple-100/70 hover:bg-white/10'}`}>
                        {item.organizationLabel} · {item.departmentLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
              <button disabled={busy || isArchivedCohort} className="org-action-save px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-all">保存成员身份与分管部门</button>
              <button type="button" onClick={() => setMemberForm(emptyMemberForm)} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-purple-100 text-sm font-bold transition-all">清空编辑</button>
            </div>
          </form>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-white/5 text-purple-100/60">
                <tr>
                  <th className="px-4 py-3">成员</th>
                  <th className="px-4 py-3">身份</th>
                  <th className="px-4 py-3">所属部门</th>
                  <th className="px-4 py-3">分管部门</th>
                  <th className="px-4 py-3">绩效快照</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {memberTierGroups.map(group => group.members.length > 0 && (
                  <React.Fragment key={group.key}>
                    <tr className="org-member-tier-row" data-tier={group.rank}>
                      <td colSpan={6} className="px-4 py-2">
                        <span>{group.label}</span>
                        <b>{group.members.length} 人</b>
                      </td>
                    </tr>
                    {group.members.map(item => (
                      <tr key={item.id || item._id} className="org-member-row text-purple-50" data-tier={group.rank}>
                        <td className="px-4 py-3 font-bold">{item.name || item.accountSnapshot?.name}<div className="text-[10px] font-normal text-purple-200/50">{item.studentId || item.accountSnapshot?.studentId}</div></td>
                        <td className="px-4 py-3">{getGovernanceMemberRoleTitle(item)}</td>
                        <td className="px-4 py-3">{item.departmentLabel || '-'}</td>
                        <td className="px-4 py-3">{(item.managedDepartments || []).length > 0 ? item.managedDepartments.map(d => d.label || `${d.organizationLabel} · ${d.departmentLabel}`).join('、') : '-'}</td>
                        <td className="px-4 py-3">{getMemberTierRank(item) > 0 ? <GovernancePerformance snapshot={item.performanceSnapshot} /> : '-'}</td>
                        <td className="px-4 py-3">
                          <button disabled={isArchivedCohort} onClick={() => handleEditMember(item)} className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-purple-500/30 disabled:opacity-40 text-xs text-purple-100 transition-all">
                            编辑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {members.length === 0 && <div className="p-8 text-center text-sm text-purple-100/50">当前届次暂无成员</div>}
          </div>
        </section>
      </div>

      {archivePreview && (
        <section className="org-archive-preview-panel rounded-2xl border border-blue-400/20 bg-blue-500/10 p-5 md:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-blue-100/60">Archive Preview</p>
              <h3 className="text-xl font-black text-white">{archivePreview.cohort?.name} · 归档预览</h3>
            </div>
            <span className="rounded-full border border-blue-300/30 px-3 py-1 text-xs text-blue-100">{archivePreview.members?.length || 0} 名成员</span>
          </div>
          <div className="space-y-6">
            {archiveGroups.map(section => (
              <section key={section.organization} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-blue-100/60">{section.organization === 'youth_league' ? '团委' : '学生会'}</p>
                    <h4 className="text-lg font-black text-white">{section.organization === 'youth_league' ? '团委成员归档' : '学生会成员归档'}</h4>
                  </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {section.groups.map(item => (
                    <article key={`${item.organization}:${item.department}`} className="org-archive-department-card rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <header className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-white/10 text-white" style={DEPARTMENT_BADGE_STYLE[item.badgeTone || 'slate'] || DEPARTMENT_BADGE_STYLE.slate}>
                          <DepartmentLogoMark item={item} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-purple-200/50">{item.organizationLabel}</p>
                          <h5 className="truncate text-base font-bold text-white">{item.departmentLabel}</h5>
                        </div>
                        <div className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-purple-100/70">{item.members.length} 人</div>
                      </header>
                      <div className="mt-4 space-y-2">
                        {item.members.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-white/10 bg-white/5 px-3 py-6 text-center text-xs text-purple-100/45">该部门暂无归档成员</p>
                        ) : groupMembersByTier(item.members).map(group => group.members.length > 0 && (
                          <section key={group.key} className="siehub-member-tier-section org-archive-tier-section" data-tier={group.rank} style={getGovernanceTierVisualStyle(group.rank)}>
                            <div className="siehub-member-tier-head">
                              <div>
                                <strong>{getGovernanceTierLabel(group.rank, item.organization)}</strong>
                                <small>{group.members.length} 人</small>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {group.members.map(member => {
                                const canShowPerformance = getMemberTierRank(member) > 0;
                                return (
                                  <div key={member.id || member._id} className="siehub-member-tier-card rounded-xl border px-3 py-2.5" data-tier={group.rank} style={getGovernanceTierVisualStyle(group.rank)}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate font-bold">{member.name}</div>
                                        <div className="text-[10px] opacity-70">{member.studentId}</div>
                                      </div>
                                      {canShowPerformance ? (
                                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-100">{member.performanceSnapshot?.total == null ? '待完成' : `${member.performanceSnapshot?.source === 'monthly' ? '旧月均' : '绩效'} ${Number(member.performanceSnapshot.total).toFixed(1)}`}</span>
                                      ) : (
                                        <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold opacity-70">无绩效</span>
                                      )}
                                    </div>
                                    <div className="mt-2 text-[10px] opacity-75">{getGovernanceMemberRoleTitle(member)}</div>
                                    {canShowPerformance && <GovernancePerformance snapshot={member.performanceSnapshot} />}
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ===================== 附件预览组件 =====================
// ===================== 绩效维度配置 =====================
const PERF_DIMENSIONS = {
  attendance: { label: '考勤积分', max: 20, color: 'purple' },
  activity: { label: '活动贡献', max: 35, color: 'blue' },
  feedback: { label: '权益跟进', max: 25, color: 'green' },
  copywriting: { label: '文案与策划', max: 15, color: 'yellow' },
  others: { label: '其他常规', max: 5, color: 'gray' },
  bonus: { label: '特别加分', max: '附加', color: 'red' }
};

// ===================== 考核细则面板 =====================
const PerformanceRulesAccordion = () => (
  <div className="mb-6 p-1 rounded-2xl bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
    <details className="group">
      <summary className="flex items-center justify-between p-4 cursor-pointer list-none text-white font-medium outline-none">
        <div className="flex items-center gap-3"><span className="text-xl">📜</span><span className="text-sm md:text-base">点击查看《SIE学生权益部志愿者考核细则》</span></div>
        <span className="text-purple-300 transition-transform duration-300 group-open:-rotate-180">▼</span>
      </summary>
      <div className="p-4 md:p-5 pt-0 text-sm text-purple-200/80 border-t border-white/10 mt-2 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        <p className="text-xs text-yellow-400/80 font-bold">全员初始为 0 分。通过完成任务积攒分数，各模块达到上限后即封顶，期末满分 100 分及以上。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse mt-2 text-xs min-w-[500px]">
            <thead><tr className="border-b border-white/10 text-white/60"><th className="py-2">考核维度</th><th className="w-16">封顶分</th><th>加分标准 (每次/每周)</th></tr></thead>
            <tbody className="divide-y divide-white/5">
            <tr><td className="py-2 text-purple-300">考勤积分</td><td>20分</td><td>准时出勤/合规请假 +2 分；迟到早退 +1 分；无故缺席 0 分。</td></tr>
            <tr><td className="py-2 text-blue-300">活动贡献</td><td>35分</td><td>核心统筹策划 +4~5 分；主要骨干 +2~3 分；普通参与 +1 分。</td></tr>
            <tr><td className="py-2 text-green-300">权益跟进</td><td>25分</td><td>按时巡检系统与规范回复留言 +2分/周；全月账号无违规 +1.25分/月。</td></tr>
            <tr><td className="py-2 text-yellow-300">文案与策划</td><td>15分</td><td>主笔大型活动策划案 +4~5分；主笔推送文案 +2~3分；参与辅助 +1分。</td></tr>
            <tr><td className="py-2 text-gray-300">其他常规</td><td>5分</td><td>完成物资管理、资料整理或跨部门对接 +1分/次。</td></tr>
            <tr><td className="py-2 text-red-400 font-bold">特别加分</td><td>附加</td><td>获校级表彰、突出建设性贡献直接 +2~5 分，计入总分。</td></tr>
          </tbody>
        </table>
      </div>
     </div>
    </details>
  </div>
);

// ===================== 绩效多边形雷达图组件 =====================
const PerformanceRadar = ({ scores, dimensions }) => {
  const keys = ['attendance', 'activity', 'feedback', 'copywriting', 'others'];
  const size = 220; 
  const center = size / 2;
  const radius = size * 0.35; 

  const points = keys.map((key, i) => {
    const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const max = dimensions[key].max;
    const score = scores[key] || 0;
    const ratio = Math.min(1, Math.max(0, score / max));
    return `${center + radius * ratio * Math.cos(angle)},${center + radius * ratio * Math.sin(angle)}`;
  }).join(' ');

  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const grids = gridLevels.map(level => {
    return keys.map((_, i) => {
      const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      return `${center + radius * level * Math.cos(angle)},${center + radius * level * Math.sin(angle)}`;
    }).join(' ');
  });

  return (
    <div className="flex justify-center items-center py-2">
      <svg width={size} height={size} className="overflow-visible drop-shadow-xl">
        {grids.map((pts, i) => <polygon key={i} points={pts} fill={i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)"} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />)}
        {keys.map((_, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          return <line key={`line-${i}`} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        })}
        <polygon points={points} fill="rgba(168, 85, 247, 0.4)" stroke="#c084fc" strokeWidth="2" className="drop-shadow-[0_0_12px_rgba(168,85,247,0.8)] transition-all duration-700 ease-in-out" />
        {keys.map((key, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
          const max = dimensions[key].max;
          const ratio = Math.min(1, Math.max(0, (scores[key] || 0) / max));
          const px = center + radius * ratio * Math.cos(angle);
          const py = center + radius * ratio * Math.sin(angle);
          const lx = center + (radius + 24) * Math.cos(angle); 
          const ly = center + (radius + 15) * Math.sin(angle);
          return (
            <g key={key}>
              <circle cx={px} cy={py} r="4" fill="#fff" className="shadow-lg" />
              <text x={lx} y={ly} fill="rgba(255,255,255,0.7)" fontSize="11" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                {dimensions[key].label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ===================== 账号管理子组件 =====================
const AccountManagement = ({ token, user: currentUser }) => {
  const [users, setUsers] = useState([]);
  const [targetStudentId, setTargetStudentId] = useState('');
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, type: '', data: [], title: '' });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.users || []);
    } catch (err) { alert('获取用户列表失败'); }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handlePromote = async (e) => {
    e.preventDefault();
    if (!targetStudentId) return;
    const targetUser = users.find(u => u.studentId === targetStudentId);
    if (!targetUser) return alert('未找到该学号的用户');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${targetStudentId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: 'admin' })
      });
      if ((await res.json()).success) {
        alert(`${targetUser.name} (${targetStudentId}) 已经是管理员了`);
        setTargetStudentId('');
        fetchUsers();
      }
    } catch (err) { alert('操作失败'); }
  };

  const handleDemote = async (studentId) => {
    if (!window.confirm(`确定要撤销学号 ${studentId} 的管理员权限吗？`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${studentId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: 'student' })
      });
      if ((await res.json()).success) {
        alert('该账号已降级为普通学生');
        fetchUsers();
      }
    } catch (err) { alert('操作失败'); }
  };

  const handleDirectPromote = async (studentId, studentName) => {
    if (!window.confirm(`确定要将 ${studentName} (${studentId}) 升级为管理员吗？`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${studentId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: 'admin' })
      });
      if ((await res.json()).success) {
        alert(`${studentName} (${studentId}) 已经是管理员了`);
        fetchUsers();
      }
    } catch (err) { alert('操作失败'); }
  };

  // [新增] 前端注销账号请求逻辑
  const handleDeleteUser = async (userId) => {
    if (currentUser?.role !== 'superadmin') {
      return alert('权限不足：仅超级管理员可注销账号');
    }
    
    if (!window.confirm('危险操作：确定要彻底注销并抹除该账号吗？此操作不可逆！')) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        alert('该账号已从系统中彻底注销');
        fetchUsers(); 
      } else {
        alert(data.message || '注销失败');
      }
    } catch (err) { alert('网络通信错误'); }
  };

 const handleResetPassword = async (studentId) => {
    const newPwd = window.prompt(`请输入学号 ${studentId} 的新密码(至少6位)：`, '123456'); 
    if (!newPwd || newPwd.length < 6) return alert('密码无效或取消操作');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${studentId}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPassword: newPwd })
      });
      if ((await res.json()).success) alert('密码重置成功');
    } catch (err) { alert('重置失败'); }
  };

  const viewStudentFeedbacks = async (userId, userName) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/feedbacks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDetailsModal({ isOpen: true, type: 'feedback', title: `${userName} 提交的问题 (含匿名)`, data: data.feedbacks || [] });
      }
    } catch (err) { alert('获取记录失败'); }
  };

  const viewAdminLogs = async (userId, userName) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}/logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDetailsModal({ isOpen: true, type: 'log', title: `${userName} 的处理操作日志`, data: data.logs || [] });
      }
    } catch (err) { alert('获取日志失败'); }
  };

  const admins = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
  const students = users.filter(u => u.role === 'student');

  if (currentUser?.role !== 'superadmin') return null;

  return (
    <div className="people-management-panel space-y-6 mt-6 animate-fadeIn">
      <section className="people-command">
        <div>
          <h2>人员与权限</h2>
          <p>统一管理学生、志愿者、部门负责人/团委学生兼职团干部，以及主席团/团委学生兼职副书记的账号入口。</p>
        </div>
        <form onSubmit={handlePromote} className="people-actions">
          <label className="search-field"><span>⌕</span><input type="text" value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} placeholder="输入学号升级为志愿者" required /></label>
          <button type="submit" className="primary-button">确认设为志愿者</button>
        </form>
      </section>

      <div className="people-layout">
        <section className="role-ledger">
          <div className="ledger-head"><h3>管理员队列</h3><span>{admins.length} 人</span></div>
          {admins.map(admin => (
            <div key={admin._id} className={`person-row ${admin._id === currentUser?.id ? 'is-selected' : ''}`}>
              <span className="avatar admin-avatar">{(admin.name || '管').slice(0, 1)}</span>
              <div><strong>{admin.name}</strong><small>{admin.studentId} · {admin.identityLabel || (admin.role === 'superadmin' ? '超级管理员' : '志愿者')}</small></div>
              <b className={`role-pill ${admin.role === 'superadmin' ? 'super' : 'admin'}`}>{admin.role === 'superadmin' ? '超管' : '志愿者'}</b>
              <button className="icon-button" type="button" title="查看日志" onClick={() => viewAdminLogs(admin._id, admin.name)}>志</button>
              <button className="icon-button" type="button" title="重置密码" onClick={() => handleResetPassword(admin.studentId)}>钥</button>
              {admin.role !== 'superadmin' && <button className="icon-button danger" type="button" title="降级为学生" onClick={() => handleDemote(admin.studentId)}>降</button>}
            </div>
          ))}
          {admins.length === 0 && <div className="empty-case-row">暂无管理员账号</div>}
        </section>

        <section className="role-ledger">
          <div className="ledger-head"><h3>学生账户</h3><span>{students.length} 人</span></div>
          {students.map(student => (
            <div key={student._id} className="person-row">
              <span className="avatar student-avatar">{(student.name || '学').slice(0, 1)}</span>
              <div><strong>{student.name}</strong><small>{student.studentId} · {student.identityLabel || '学生'}</small></div>
              <b className="role-pill student">学生</b>
              <button className="icon-button" type="button" title="查看反馈" onClick={() => viewStudentFeedbacks(student._id, student.name)}>查</button>
              <button className="icon-button" type="button" title="提升为志愿者" onClick={() => handleDirectPromote(student.studentId, student.name)}>升</button>
              <button className="icon-button danger" type="button" title="注销账户" onClick={() => handleDeleteUser(student._id)}>删</button>
            </div>
          ))}
          {students.length === 0 && <div className="empty-case-row">暂无学生账号</div>}
        </section>

        <aside className="audit-inspector">
          <div className="inspector-head"><div><span className="status processing"><i></i>操作审计</span><p>人员管理轨迹</p></div><button className="icon-button" type="button" onClick={fetchUsers}>↻</button></div>
          <h2>{currentUser?.name || '终极管理员'} · 权限总览</h2>
          <ol className="audit-list">
            <li><span>账号</span><div><strong>{admins.length} 名管理账号</strong><p>包含志愿者、超级管理员与终极管理员视角可管理人员。</p></div></li>
            <li><span>学生</span><div><strong>{students.length} 名学生账号</strong><p>可查看学生反馈、重置密码、升级为志愿者或注销账户。</p></div></li>
            <li><span>归档</span><div><strong>组织届次归档联动</strong><p>角色最终以团委学生会架构里的身份分配与届次归档为准。</p></div></li>
          </ol>
        </aside>
      </div>

      <div className="legacy-account-management" hidden>
      <div className="p-6 bg-white/5 border border-purple-500/30 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500" />
        <h3 className="text-lg font-bold text-white mb-4">赋予管理员权限</h3>
        <form onSubmit={handlePromote} className="flex gap-4">
          <input type="text" value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} placeholder="输入要升级的学生学号" className="flex-1 px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:border-purple-500 outline-none" required />
          <button type="submit" className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-all">确认设为管理员</button>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl h-96 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 shrink-0">子管理员账号</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <table className="w-full text-left text-sm text-purple-200/80">
              <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-white z-10 transition-colors">
                <tr><th className="py-2 pl-2">人员</th><th className="py-2">操作</th></tr>
              </thead>
              <tbody>
                {admins.map(admin => (
                  <tr key={admin._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 pl-2">
                      <div className="text-white font-medium">{admin.name} {admin.role === 'superadmin' && <span className="text-[10px] text-yellow-400 border border-yellow-400/50 rounded px-1 ml-1">超管</span>}</div>
                      <div className="text-xs font-mono opacity-60">{admin.studentId}</div>
                    </td>
                    <td className="py-3 space-x-2">
                      <button onClick={() => viewAdminLogs(admin._id, admin.name)} className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/40 transition">日志</button>
                      <button onClick={() => handleResetPassword(admin.studentId)} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/40 transition">重置</button>
                      {admin.role !== 'superadmin' && (
                        <button onClick={() => handleDemote(admin.studentId)} className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/40 transition">降级</button>
                      )}
                      {/* [新增] 账号注销按钮，增加权限屏障仅渲染给 superadmin 且不能注销自己 */}
                      {currentUser?.role === 'superadmin' && admin._id !== currentUser.id && (
                        <button 
                          onClick={() => handleDeleteUser(admin._id)} 
                          className="text-xs px-2 py-1 bg-slate-600/20 text-slate-800 dark:text-slate-400 hover:bg-slate-800 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 border border-slate-500/30 rounded transition-all"
                        >
                          注销
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl h-96 flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 shrink-0">学生账号</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <table className="w-full text-left text-sm text-purple-200/80">
              <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-white z-10 transition-colors">
                <tr><th className="py-2 pl-2">人员</th><th className="py-2">操作</th></tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 pl-2">
                      <div className="text-white font-medium">{student.name}</div>
                      <div className="text-xs font-mono opacity-60">{student.studentId}</div>
                    </td>
                    <td className="py-3 space-x-2">
                      <button onClick={() => viewStudentFeedbacks(student._id, student.name)} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded hover:bg-purple-500/40 transition">查阅</button>
                      <button onClick={() => handleResetPassword(student.studentId)} className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded hover:bg-yellow-500/40 transition">重置</button>
                      <button onClick={() => handleDirectPromote(student.studentId, student.name)} className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded hover:bg-green-500/40 transition">升级</button>
                      {/* [新增] 账号注销按钮 */}
                      {currentUser?.role === 'superadmin' && (
                        <button 
                          onClick={() => handleDeleteUser(student._id)} 
                          className="text-xs px-2 py-1 bg-slate-600/20 text-slate-800 dark:text-slate-400 hover:bg-slate-800 hover:text-white dark:hover:bg-white dark:hover:text-slate-900 border border-slate-500/30 rounded transition-all"
                        >
                          注销
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>

      {detailsModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl p-6 max-h-[80vh] flex flex-col relative">
            <button onClick={() => setDetailsModal({ isOpen: false, type: '', data: [], title: '' })} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl z-10">✕</button>
            <h3 className="text-xl font-bold text-white mb-4 shrink-0 pr-8">{detailsModal.title}</h3>
            <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {(!detailsModal.data || detailsModal.data.length === 0) ? (
                <p className="text-purple-200/50 py-4 text-center">暂无记录</p>
              ) : (
                detailsModal.data.map((item, index) => (
                  <div key={index} className="p-3 bg-white/5 rounded-lg text-sm text-purple-200/80 border border-white/5">
                    {detailsModal.type === 'feedback' && (
                      <>
                        <div className="flex justify-between items-start text-white font-medium mb-1">
                          <span className="flex-1 pr-2 break-all">{item.title} {item.isAnonymous && <span className="text-xs px-1 py-0.5 ml-1 bg-orange-500/20 text-orange-400 rounded">匿名提交</span>}</span>
                          <span className="text-xs text-purple-200/50 shrink-0 mt-0.5">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="line-clamp-2 text-xs opacity-80 mt-1">{item.content}</p>
                      </>
                    )}
                    {detailsModal.type === 'log' && (
                      <>
                        <div className="flex justify-between items-center font-medium mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-300 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                              {item.action === 'update_status' ? '处理了问题' : (item.action === 'create' ? '提交了问题' : item.action)}
                            </span>
                            {item.details?.status && (
                              <span className="text-purple-300 text-xs font-bold">
                                将状态变更为: {statusConfig[item.details.status]?.label || item.details.status}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-purple-200/50 shrink-0">{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                        
                        {item.feedbackInfo ? (
                          <div className="mt-2 bg-slate-950/50 rounded-lg p-3 border border-white/5">
                            <div className="text-sm text-white font-medium mb-1">处理目标：{item.feedbackInfo.title}</div>
                            <p className="text-xs text-purple-200/60 mb-3 line-clamp-2">问题描述：{item.feedbackInfo.content}</p>
                            
                            <details className="group cursor-pointer">
                              <summary className="text-xs text-purple-400 hover:text-purple-300 outline-none select-none font-medium pb-1 transition-colors">
                                ▶ 点击查看完整对话流转记录 ({item.feedbackInfo.responses?.length || 0} 条互动)
                              </summary>
                              <div className="mt-3 space-y-2 cursor-default pt-2 border-t border-white/5">
                                {item.feedbackInfo.responses?.length > 0 ? (
                                  item.feedbackInfo.responses.map((resp, idx) => {
                                    const isStudent = resp.senderType === 'student';
                                    return (
                                      <div key={idx} className={`p-2.5 rounded-xl border ${isStudent ? 'bg-blue-500/10 border-blue-500/20 mr-6' : 'bg-purple-500/10 border-purple-500/20 ml-6'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className={`text-[10px] font-bold ${isStudent ? 'text-blue-300' : 'text-purple-300'}`}>
                                            {isStudent ? (resp.senderName || '学生留言') : (resp.adminName || resp.senderName || '系统管理员')}
                                          </span>
                                          <span className="text-[9px] text-purple-200/40">{new Date(resp.createdAt).toLocaleString('zh-CN')}</span>
                                        </div>
                                        <p className="text-xs text-purple-100 whitespace-pre-wrap leading-relaxed">{resp.content || '(仅更新了状态/附件)'}</p>
                                        {resp.attachments?.length > 0 && <span className="text-[10px] text-purple-400 mt-1.5 block">📎 包含 {resp.attachments.length} 个附件</span>}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-purple-200/40 italic text-center py-2">暂无流转对话</p>
                                )}
                              </div>
                            </details>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs opacity-70 bg-black/20 p-2 rounded break-all font-mono">
                            {JSON.stringify(item.details)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FeedbackArchivePage = ({
  archives = [],
  feedbacks = [],
  loading = false,
  activeSemesterName,
  canManageSemester = false,
  currentSemester = '',
  semesterLoadError = '',
  onSelectArchive,
  onClearArchive,
  onArchiveSemester,
  onBackToFeedback
}) => {
  const formatArchiveHours = (hours) => {
    if (!Number.isFinite(hours)) return '暂无';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟`;
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} 小时`;
  };

  return (
    <div className="business-feedback-redesign feedback-archive-page">
      <div className="admin-tabs" aria-label="管理端功能切换">
        <button type="button" onClick={onBackToFeedback}>◆ 业务反馈处理</button>
        <button className="is-active" type="button">◇ 问题归档</button>
      </div>

      <section className="feedback-archive-panel">
        <header>
          <div>
            <p>SEMESTER ARCHIVE</p>
            <h2>每学期问题归档</h2>
            <span>{activeSemesterName ? `当前筛选：${activeSemesterName}` : '按学年统一归纳，点击学期卡片查看该学期问题归档。'}</span>
          </div>
          <div className="feedback-archive-panel-actions">
            {canManageSemester && (
              <div className="feedback-archive-current-semester">
                <span>当前学期</span>
                <strong>{currentSemester || semesterLoadError || '加载中'}</strong>
              </div>
            )}
            {activeSemesterName && <button type="button" onClick={onClearArchive}>查看全部学期</button>}
            {canManageSemester && (
              <button type="button" className="feedback-archive-primary" onClick={onArchiveSemester}>
                归档并开启新学期
              </button>
            )}
          </div>
        </header>
        <div className="feedback-archive-years">
          {archives.length === 0 ? (
            <div className="feedback-archive-empty">暂无可归档的问题数据</div>
          ) : archives.map(year => (
            <article key={year.academicYear} className="feedback-archive-year">
              <div className="feedback-archive-year-head">
                <strong>{year.academicYear}</strong>
                <span>{year.total} 条问题</span>
              </div>
              <div className="feedback-archive-semesters">
                {(year.semesters || []).map(semester => (
                  <button
                    key={semester.semester}
                    type="button"
                    className={activeSemesterName === semester.semester ? 'is-active' : ''}
                    onClick={() => onSelectArchive?.(semester)}
                  >
                    <span>{semester.termLabel}</span>
                    <strong>{semester.total}</strong>
                    <small>{semester.startDate} 至 {semester.endDate}</small>
                    <em>待受理 {semester.pending || 0} · 处理中 {semester.processing || 0} · 已解决 {semester.resolved || 0}</em>
                    <i>平均首响 {formatArchiveHours(semester.averageFirstResponseHours)}</i>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="queue-panel archive-feedback-results">
        <div className="queue-toolbar">
          <div>
            <h2>{activeSemesterName ? `${activeSemesterName} · 问题明细` : '归档问题明细'}</h2>
            <span>{activeSemesterName ? `当前学期共检索到 ${feedbacks.length} 条记录` : '点击上方学期卡片后，在这里查看该学期的问题记录。'}</span>
          </div>
        </div>
        {activeSemesterName ? (
          <div className="case-table" role="table">
            <div className="case-tr table-head" role="row"><span>事项</span><span>提交人</span><span>状态</span><span>优先级</span><span>提交时间</span></div>
            {loading ? (
              <div className="empty-case-row">加载中...</div>
            ) : feedbacks.length === 0 ? (
              <div className="empty-case-row">该学期暂无反馈事项</div>
            ) : feedbacks.map(feedback => {
              const cat = categories[feedback.category] || { label: feedback.category, icon: '📌' };
              const status = statusConfig[feedback.status] || statusConfig.pending;
              const priority = priorityConfig[feedback.priority] || priorityConfig.normal;
              const priorityClass = feedback.priority === 'high' || feedback.priority === 'urgent' ? 'high' : 'normal';
              return (
                <div key={feedback._id} className={`case-tr ${feedback.isRevoked ? 'is-revoked' : ''}`} role="row">
                  <span>
                    <i className={`priority-mark ${priorityClass}`}></i>
                    <strong>{feedback.title}</strong>
                    <small>#{feedback._id?.slice(-6)?.toUpperCase()} · {cat.label}</small>
                  </span>
                  <span><strong>{feedback.isAnonymous ? '匿名学生' : (feedback.user?.name || '学生')}</strong><small>{feedback.isAnonymous ? '身份受保护' : (feedback.user?.studentId || '校内账号')}</small></span>
                  <span><b className={`status ${status.color === 'yellow' ? 'pending' : feedback.status}`}><i></i>{feedback.isRevoked ? '已撤回' : status.label}</b></span>
                  <span><b className={`priority ${priorityClass}`}>{priority.label}</b></span>
                  <span><strong>{new Date(feedback.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</strong><small>{new Date(feedback.createdAt).toLocaleDateString('zh-CN')}</small></span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-case-row">请选择一个学期查看归档问题。</div>
        )}
      </section>
    </div>
  );
};

const AdminQuickFeedbackPage = ({ token, onBackToFeedback, onSubmitted }) => {
  const defaultCategory = ADMIN_FEEDBACK_CATEGORY_OPTIONS[0];
  const [form, setForm] = useState({
    category: defaultCategory.value,
    subCategory: defaultCategory.sub[0],
    title: '',
    content: '',
    priority: 'normal',
    isAnonymous: false
  });
  const [submitting, setSubmitting] = useState(false);
  const selectedCategory = ADMIN_FEEDBACK_CATEGORY_OPTIONS.find(item => item.value === form.category) || defaultCategory;

  const updateCategory = (category) => {
    const next = ADMIN_FEEDBACK_CATEGORY_OPTIONS.find(item => item.value === category) || defaultCategory;
    setForm(current => ({ ...current, category: next.value, subCategory: next.sub[0] }));
  };

  const submitFeedback = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert('请填写反馈标题和详细内容');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '提交反馈失败');
      alert('反馈提交成功');
      setForm({
        category: defaultCategory.value,
        subCategory: defaultCategory.sub[0],
        title: '',
        content: '',
        priority: 'normal',
        isAnonymous: false
      });
      onSubmitted?.();
    } catch (error) {
      alert(error.message || '提交反馈失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="business-feedback-redesign admin-side-page">
      <div className="admin-tabs" aria-label="管理端功能切换">
        <button type="button" onClick={onBackToFeedback}>◆ 业务反馈处理</button>
        <button className="is-active" type="button">□ 发起反馈</button>
      </div>
      <form className="queue-panel admin-quick-feedback-form" onSubmit={submitFeedback}>
        <div className="queue-toolbar">
          <div>
            <h2>发起反馈</h2>
            <span>以当前账号提交问题反馈，提交后可在业务反馈中跟进处理记录。</span>
          </div>
        </div>
        <div className="admin-quick-feedback-grid">
          <label className="input-field">
            <span>问题领域</span>
            <select value={form.category} onChange={event => updateCategory(event.target.value)}>
              {ADMIN_FEEDBACK_CATEGORY_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="input-field">
            <span>具体分类</span>
            <select value={form.subCategory} onChange={event => setForm(current => ({ ...current, subCategory: event.target.value }))}>
              {selectedCategory.sub.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="input-field">
            <span>优先级</span>
            <select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value }))}>
              <option value="normal">普通</option>
              <option value="high">紧急</option>
              <option value="urgent">特急</option>
            </select>
          </label>
        </div>
        <label className="input-field">
          <span>反馈标题</span>
          <input value={form.title} maxLength={100} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="用一句话概括问题" />
        </label>
        <label className="input-field textarea-field">
          <span>详细内容</span>
          <textarea value={form.content} maxLength={2000} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder="请写清时间、地点、具体情况和期望结果" />
        </label>
        <div className="admin-quick-feedback-actions">
          <label className="mobile-anonymous">
            <input type="checkbox" checked={form.isAnonymous} onChange={event => setForm(current => ({ ...current, isAnonymous: event.target.checked }))} />
            <i></i>
            <span>匿名提交</span>
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>{submitting ? '提交中...' : '提交反馈'}</button>
        </div>
      </form>
    </div>
  );
};

const AdminServiceGuidePage = ({ onBackToFeedback }) => (
  <div className="business-feedback-redesign admin-side-page">
    <div className="admin-tabs" aria-label="管理端功能切换">
      <button type="button" onClick={onBackToFeedback}>◆ 业务反馈处理</button>
      <button className="is-active" type="button">◇ 服务指南</button>
    </div>
    <section className="queue-panel">
      <div className="queue-toolbar">
        <div>
          <h2>服务指南</h2>
          <span>用于说明学生权益反馈系统的受理范围、处理时效和材料规范。</span>
        </div>
      </div>
      <div className="guide-grid admin-guide-grid">
        <section><h2>反馈如何流转</h2><p>提交后由学生权益部先行受理，确认问题类别、紧急程度和是否需要补充材料，再分派给对应负责人或协同部门。</p></section>
        <section><h2>响应时效</h2><p>普通事项原则上 1 个工作日内首次响应；涉及跨部门核实、场地维修、制度咨询等事项，会在详情页持续同步进展。</p></section>
        <section><h2>紧急事项</h2><p>涉及人身安全、突发疾病、火情、重大设备风险时，请优先联系学院老师、楼宇值班或校园应急渠道。</p></section>
        <section><h2>材料与隐私</h2><p>支持上传图片、文档、录屏等佐证材料。匿名反馈不会向处理部门展示个人身份，但系统会保留必要审计记录。</p></section>
        <section><h2>补充与撤回</h2><p>事项提交后可继续补充说明、查看回复；未进入处理流程前可撤回，已处理事项会进入学期归档。</p></section>
        <section><h2>提交建议</h2><p>建议写清时间、地点、涉及对象、已尝试解决方式和期望结果。标题简洁、正文具体，会提升受理效率。</p></section>
      </div>
    </section>
  </div>
);

const BusinessFeedbackWorkspace = ({
  feedbacks,
  archives = [],
  selectedFeedback,
  setSelectedFeedback,
  responseText,
  setResponseText,
  setSelectedReplyFiles,
  updateStatus,
  handleRecallMsg,
  handleWithdrawFeedback,
  user,
  loading,
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  canManageSemester = false,
  currentSemester = '',
  semesterLoadError = '',
  activeSemesterName,
  onSelectArchive,
  onClearArchive,
  onArchiveSemester,
  pagination,
  onPageChange,
  summary,
  replySending,
  selectedReplyFiles
}) => {
  const activeFeedback = selectedFeedback || feedbacks.find(item => !item.isRevoked) || feedbacks[0] || null;
  const counts = summary || {
    total: feedbacks.length,
    pending: feedbacks.filter(item => item.status === 'pending').length,
    processing: feedbacks.filter(item => item.status === 'processing').length,
    high: feedbacks.filter(item => item.priority === 'high' || item.priority === 'urgent').length
  };

  const selectStatus = (status) => setFilters({ ...filters, status });
  const formatArchiveHours = (hours) => {
    if (!Number.isFinite(hours)) return '暂无';
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} 分钟`;
    return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} 小时`;
  };

  return (
    <div className="business-feedback-redesign">
      {false && (
      <section className="feedback-archive-panel">
        <header>
          <div>
            <p>SEMESTER ARCHIVE</p>
            <h2>每学期问题归档</h2>
            <span>{activeSemesterName ? `当前筛选：${activeSemesterName}` : '按学年统一归纳，点击学期卡片筛选该学期问题。'}</span>
          </div>
          <div className="feedback-archive-panel-actions">
            {canManageSemester && (
              <div className="feedback-archive-current-semester">
                <span>当前学期</span>
                <strong>{currentSemester || semesterLoadError || '加载中'}</strong>
              </div>
            )}
            {activeSemesterName && <button type="button" onClick={onClearArchive}>查看全部学期</button>}
            {canManageSemester && (
              <button type="button" className="feedback-archive-primary" onClick={onArchiveSemester}>
                归档并开启新学期
              </button>
            )}
          </div>
        </header>
        <div className="feedback-archive-years">
          {archives.length === 0 ? (
            <div className="feedback-archive-empty">暂无可归档的问题数据</div>
          ) : archives.map(year => (
            <article key={year.academicYear} className="feedback-archive-year">
              <div className="feedback-archive-year-head">
                <strong>{year.academicYear}</strong>
                <span>{year.total} 条问题</span>
              </div>
              <div className="feedback-archive-semesters">
                {(year.semesters || []).map(semester => (
                  <button
                    key={semester.semester}
                    type="button"
                    className={activeSemesterName === semester.semester ? 'is-active' : ''}
                    onClick={() => onSelectArchive?.(semester)}
                  >
                    <span>{semester.termLabel}</span>
                    <strong>{semester.total}</strong>
                    <small>{semester.startDate} 至 {semester.endDate}</small>
                    <em>待受理 {semester.pending || 0} · 处理中 {semester.processing || 0} · 已解决 {semester.resolved || 0}</em>
                    <i>平均首响 {formatArchiveHours(semester.averageFirstResponseHours)}</i>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      <div className="admin-workspace">
        <section className="queue-panel">
          <div className="queue-toolbar">
            <div>
              <h2>待办队列</h2>
              <span>共 {counts.total} 条事项 · 按状态与优先级实时筛选</span>
            </div>
            <label className="search-field">
              <span>⌕</span>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索标题或内容" />
            </label>
            <button className="icon-button" type="button" title="清空筛选" aria-label="清空筛选" onClick={() => setFilters({ status: '', category: '', priority: '' })}>↺</button>
          </div>

          <div className="queue-tabs">
            <button className={!filters.status && !filters.priority ? 'is-active' : ''} type="button" onClick={() => setFilters({ ...filters, status: '', priority: '' })}>全部 <span>{counts.total}</span></button>
            <button className={filters.status === 'pending' ? 'is-active' : ''} type="button" onClick={() => selectStatus('pending')}>待受理 <span>{counts.pending}</span></button>
            <button className={filters.status === 'processing' ? 'is-active' : ''} type="button" onClick={() => selectStatus('processing')}>处理中 <span>{counts.processing}</span></button>
            <button className={filters.priority === 'high' ? 'is-active' : ''} type="button" onClick={() => setFilters({ ...filters, priority: 'high' })}>高优先级 <span>{counts.high}</span></button>
          </div>

          <div className="case-table" role="table">
            <div className="case-tr table-head" role="row"><span>事项</span><span>提交人</span><span>状态</span><span>优先级</span><span>更新时间</span></div>
            {loading ? (
              <div className="empty-case-row">加载中...</div>
            ) : feedbacks.length === 0 ? (
              <div className="empty-case-row">暂无反馈事项</div>
            ) : feedbacks.map(feedback => {
              const cat = categories[feedback.category] || { label: feedback.category, icon: '📋' };
              const status = statusConfig[feedback.status] || statusConfig.pending;
              const priority = priorityConfig[feedback.priority] || priorityConfig.normal;
              const selected = activeFeedback?._id === feedback._id;
              const priorityClass = feedback.priority === 'high' || feedback.priority === 'urgent' ? 'high' : 'normal';
              return (
                <button
                  key={feedback._id}
                  className={`case-tr ${selected ? 'is-selected' : ''} ${feedback.isRevoked ? 'is-revoked' : ''}`}
                  type="button"
                  onClick={() => setSelectedFeedback(feedback)}
                >
                  <span>
                    <i className={`priority-mark ${priorityClass}`}></i>
                    <strong>{feedback.title}</strong>
                    <small>#{feedback._id?.slice(-6)?.toUpperCase()} · {cat.label}</small>
                  </span>
                  <span><strong>{feedback.isAnonymous ? '匿名学生' : (feedback.user?.name || '学生')}</strong><small>{feedback.isAnonymous ? '身份受保护' : (feedback.user?.studentId || '校内账号')}</small></span>
                  <span><b className={`status ${status.color === 'yellow' ? 'pending' : feedback.status}`}><i></i>{feedback.isRevoked ? '已撤回' : status.label}</b></span>
                  <span><b className={`priority ${priorityClass}`}>{priority.label}</b></span>
                  <span><strong>{new Date(feedback.updatedAt || feedback.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</strong><small>{new Date(feedback.createdAt).toLocaleDateString('zh-CN')}</small></span>
                </button>
              );
            })}
          </div>
          <FeedbackPagination pagination={pagination} onPageChange={onPageChange} loading={loading} />
        </section>

        <aside className="case-inspector">
          {activeFeedback ? (
            <>
              {(() => {
                const cat = categories[activeFeedback.category] || { label: activeFeedback.category, icon: '📋' };
                const status = statusConfig[activeFeedback.status] || statusConfig.pending;
                const priority = priorityConfig[activeFeedback.priority] || priorityConfig.normal;
                const isRevoked = activeFeedback.isRevoked;
                return (
                  <>
                    <div className="inspector-head">
                      <div><span className={`status ${status.color === 'yellow' ? 'pending' : activeFeedback.status}`}><i></i>{isRevoked ? '学生已撤回' : status.label}</span><p>#{activeFeedback._id?.slice(-6)?.toUpperCase()}</p></div>
                      <button className="icon-button" type="button" onClick={() => setSelectedFeedback(null)}>×</button>
                    </div>
                    <h2>{activeFeedback.title}</h2>
                    <div className="case-tags"><span>{cat.label}</span>{activeFeedback.subCategory && <span>{activeFeedback.subCategory}</span>}<span className={activeFeedback.priority === 'high' || activeFeedback.priority === 'urgent' ? 'high' : ''}>{priority.label}优先级</span></div>
                    <p className="case-body">{activeFeedback.content}</p>
                    <AttachmentViewer attachments={activeFeedback.attachments} />
                    <dl className="case-meta">
                      <div><dt>提交时间</dt><dd>{new Date(activeFeedback.createdAt).toLocaleString('zh-CN')}</dd></div>
                      <div><dt>提交人</dt><dd>{activeFeedback.isAnonymous ? '匿名学生' : (activeFeedback.user?.name || '学生')}</dd></div>
                      <div><dt>当前状态</dt><dd>{isRevoked ? '已撤回' : status.label}</dd></div>
                    </dl>

                    {activeFeedback.responses?.length > 0 && (
                      <ol className="dialog-timeline admin-flow-timeline">
                        {activeFeedback.responses.map((resp, i) => {
                          const canRecall = !resp.isRecalled && resp.canRecall;
                          return (
                            <li key={resp._id || i} className={resp.isRecalled ? '' : 'current'}>
                              <span></span>
                              <div>
                                <strong>{resp.senderType === 'student' ? (resp.senderName || '学生留言') : (resp.adminName || resp.senderName || '系统管理员')}</strong>
                                <small>{new Date(resp.createdAt).toLocaleString('zh-CN')}</small>
                                <p>{resp.isRecalled && user?.role !== 'superadmin' ? '此消息已撤回' : (resp.content || '状态更新')}</p>
                                {(!resp.isRecalled || user?.role === 'superadmin') && <AttachmentViewer attachments={resp.attachments} />}
                                {canRecall && <button className="text-button danger-text" type="button" onClick={() => handleRecallMsg(activeFeedback._id, resp._id)}>撤回</button>}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    <div className="reply-box">
                      <label>回复学生（本事项草稿）</label>
                      <textarea disabled={replySending} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="输入处理进展或需要学生补充的信息…" />
                      <div>
                        <input type="file" multiple disabled={replySending} key={activeFeedback?._id} onChange={e => setSelectedReplyFiles(Array.from(e.target.files))} />
                        {selectedReplyFiles.length > 0 && <span>已选择 {selectedReplyFiles.length} 个附件</span>}
                        <button className="send-button" type="button" disabled={isRevoked || replySending} onClick={() => updateStatus(activeFeedback._id)}>发送回复</button>
                      </div>
                    </div>
                    {!isRevoked && (
                      <fieldset className="case-action-grid" disabled={replySending}>
                        {activeFeedback.status !== 'processing' && <button className="send-button" type="button" onClick={() => updateStatus(activeFeedback._id, 'processing')}>开始处理</button>}
                        {['pending', 'processing'].includes(activeFeedback.status) && <button className="resolve-button" type="button" onClick={() => updateStatus(activeFeedback._id, 'resolved')}>标记为已解决</button>}
                        {['pending', 'processing'].includes(activeFeedback.status) && <button className="outline-button danger-text" type="button" onClick={() => updateStatus(activeFeedback._id, 'rejected')}>拒绝</button>}
                        {canManageFeedbackWithdrawal(user) && <button className="outline-button danger-text" type="button" onClick={() => handleWithdrawFeedback(activeFeedback._id)}>撤回问题</button>}
                      </fieldset>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="empty-inspector">请选择左侧事项查看详情</div>
          )}
        </aside>
      </div>
    </div>
  );
};

// ===================== 主页面: AdminDashboard =====================
export default function AdminDashboard({ user, token, onLogout, onRefreshUser, onOpenMy, onOpenUltimate, onOpenPerformance, themeTools, portalView, onPortalChange, onBackToHub, language = 'zh', languageSwitcher = null, notificationTarget }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const selectedFeedbackRef = useRef(null);
  selectedFeedbackRef.current = selectedFeedback;
  const feedbackRequestRef = useRef(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [semesterName, setSemesterName] = useState('');
  const [feedbackArchives, setFeedbackArchives] = useState([]);
  const [activeAdminPage, setActiveAdminPage] = useState('feedback');
  const [loading, setLoading] = useState(false);
  const [semesterLoadError, setSemesterLoadError] = useState('');
  const [resetStudentId, setResetStudentId] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const activeFeedbackId = selectedFeedback?._id || feedbacks.find(item => !item.isRevoked)?._id || feedbacks[0]?._id;
  const responseText = replyDrafts[activeFeedbackId]?.content || '';
  const selectedReplyFiles = replyDrafts[activeFeedbackId]?.files || [];
  const setResponseText = content => setReplyDrafts(current => ({ ...current, [activeFeedbackId]: { ...current[activeFeedbackId], content } }));
  const setSelectedReplyFiles = files => setReplyDrafts(current => ({ ...current, [activeFeedbackId]: { ...current[activeFeedbackId], files } }));
  const [replySending, setReplySending] = useState(false);
  const replyInFlight = useRef(false);
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [pwdData, setPwdData] = useState({ current: '', new: '' });
  const [profileData, setProfileData] = useState({ name: '', studentId: '', email: '', phone: '' });
  const serviceMetrics = useServiceMetrics(token);
  const isUltimateAdmin = Boolean(user?.isUltimateAdmin);
  const roleCopy = sievoxRoleCopy(user);
  const activePortal = isUltimateAdmin ? (portalView || 'superadmin') : (user?.role === 'admin' ? 'admin' : 'superadmin');
  const showUltimatePortal = isUltimateAdmin && activePortal === 'superadmin' && activeAdminPage === 'feedback';
  const canManageSievoxSemester = Boolean(
    isUltimateAdmin ||
    (user?.moduleCapabilities || []).some(module => (
      module.moduleId === 'sievox' &&
      (
        module.accessLevel === 'manage' ||
        module.accessLevel === 'ultimate' ||
        module.capabilities?.includes('manage_module') ||
        module.capabilities?.includes('enter_manage_portal')
      )
    ))
  );

  useEffect(() => {
    if (!showUltimatePortal && showAccountManagement) {
      setShowAccountManagement(false);
    }
  }, [showUltimatePortal, showAccountManagement]);

  // 绩效与学期专属状态
  const [performanceRecords, setPerformanceRecords] = useState([]);
  const [perfForm, setPerfForm] = useState({ volunteerIds: [], dimension: 'attendance', score: '', reason: '', occurrenceDate: '', activityName: '', targetSemester: '' });
  const [volunteers, setVolunteers] = useState([]);
  const [currentSemester, setCurrentSemester] = useState(DEFAULT_SIEVOX_CURRENT_SEMESTER);
  const [selectedSemester, setSelectedSemester] = useState(DEFAULT_SIEVOX_CURRENT_SEMESTER);
  const [availableSemesters, setAvailableSemesters] = useState([DEFAULT_SIEVOX_CURRENT_SEMESTER]);

  // [新增] 按学期成员名单（绩效"人员存档"）
  const [rosterMembers, setRosterMembers] = useState([]);   // 当前所选学期名单 [{_id,name,studentId}]
  const [rosterSource, setRosterSource] = useState('');       // explicit | current | legacy
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterSelection, setRosterSelection] = useState([]); // 弹窗中勾选的成员 id

  // 加权核算器专属状态
  const [showWeightCalc, setShowWeightCalc] = useState(false);
  const [calcDimension, setCalcDimension] = useState('activity');
  const [totalActivitiesCount, setTotalActivitiesCount] = useState(10); 
  const [weightConfig, setWeightConfig] = useState({}); 
  const [weighting, setWeighting] = useState(false);
  const weightingInFlight = useRef(false);

  // [新增] 批量撤回选中的记录状态
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);

  // 撤回单条绩效记录
  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('警告：确定要彻底撤回这条赋分记录吗？撤回后该人员本学期的总分将自动重算！')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/performance/${recordId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if ((await res.json()).success) {
        fetchPerformanceAndUsers(selectedSemester); 
        // 撤回成功后，如果是被选中的记录，将其从选中列表中移除
        setSelectedRecordIds(prev => prev.filter(id => id !== recordId));
      }
    } catch (err) { alert('撤回失败'); }
  };

  // [新增] 批量撤回绩效记录
  const handleBatchDeleteRecords = async () => {
    if (selectedRecordIds.length === 0) return alert('请先选择要撤回的记录');
    if (!window.confirm(`警告：确定要批量撤回选中的 ${selectedRecordIds.length} 条记录吗？此操作不可逆！`)) return;
    
    let successCount = 0;
    for (const id of selectedRecordIds) {
      try {
        const res = await fetch(`${API_BASE}/admin/performance/${id}`, {
          method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
        });
        if ((await res.json()).success) successCount++;
      } catch (err) { console.error('撤回失败', id); }
    }
    
    alert(`批量撤回完成，成功撤回 ${successCount} 条记录。`);
    setSelectedRecordIds([]);
    fetchPerformanceAndUsers(selectedSemester);
  };

  // 应用加权计算
  const handleApplyWeighting = async () => {
    if (weightingInFlight.current) return;
    if (!window.confirm('确定应用加权吗？系统将自动校准该板块得分，并在得分处点亮“已加权”绿标。')) return;
    weightingInFlight.current = true;
    setWeighting(true);
    try {
      const calibrations = buildCalibrations({ members: rosterMembers, records: performanceRecords, dimension: calcDimension, maximum: PERF_DIMENSIONS[calcDimension]?.max, totalActivities: totalActivitiesCount, weights: weightConfig });
      const data = await requestJson('/admin/performance/calibrate', token, {
        method: 'POST',
        body: JSON.stringify({ semester: selectedSemester || currentSemester, dimension: calcDimension, calibrations })
      });
      alert(`加权已完成，已原子保存 ${data.results?.length ?? calibrations.length} 位成员的结果。`);
      setShowWeightCalc(false);
      await fetchPerformanceAndUsers(selectedSemester);
    } catch (error) { alert(error.message || '加权失败，尚未保存，请重试'); }
    finally { weightingInFlight.current = false; setWeighting(false); }
  };

  const fetchSemesterConfig = useCallback(async () => {
    try {
      const sysRes = await fetch(`${API_BASE}/admin/system/config`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sysData = await sysRes.json();
      if (!sysData.success) {
        throw new Error(sysData.message || '学期信息加载失败');
      }
      const nextSemester = sysData.currentSemester || '';
      setCurrentSemester(nextSemester);
      setAvailableSemesters(sysData.semesters || []);
      setSemesterLoadError('');
      if (nextSemester) {
        setSelectedSemester(prev => prev || nextSemester);
        setPerfForm(prev => ({
          ...prev,
          targetSemester: prev.targetSemester || nextSemester
        }));
      }
      return sysData;
    } catch (err) {
      console.error('获取当前学期失败:', err);
      setSemesterLoadError('学期信息加载失败');
      return null;
    }
  }, [token]);

  // [修改修复] 彻底解决由于多次 .json() 读取流或 undefined 引起的崩溃隐患
  const fetchPerformanceAndUsers = useCallback(async (targetSemester = '') => {
    try {
      const sysData = await fetchSemesterConfig();
      
      let querySemester = targetSemester || selectedSemester; 
      
      if (sysData?.success) {
        if (!querySemester) {
            querySemester = sysData.currentSemester;
        }
        setPerfForm(prev => ({ ...prev, targetSemester: querySemester }));
      }

      const endpoint = user?.role === 'superadmin' ? '/admin/performance' : '/admin/performance/my';
      const res = await fetch(`${API_BASE}${endpoint}?semester=${encodeURIComponent(querySemester)}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPerformanceRecords(data.records || []);

      if (user?.role === 'superadmin') {
        const uRes = await fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } });
        const uData = await uRes.json(); // 安全的单次读取
        if (uData.success) setVolunteers((uData.users || []).filter(u => u.role === 'admin'));

        // [新增] 拉取当前所选学期的成员名单（榜单/录入/加权器均以此为准）
        const rRes = await fetch(`${API_BASE}/admin/system/roster?semester=${encodeURIComponent(querySemester)}`, { headers: { 'Authorization': `Bearer ${token}` } });
        const rData = await rRes.json();
        if (rData.success) {
          setRosterMembers(rData.members || []);
          setRosterSource(rData.source || '');
        }
      }
    } catch (err) { console.error('获取绩效信息失败:', err); }
  }, [fetchSemesterConfig, token, user?.role, selectedSemester]);

  // [新增] 打开"管理本学期成员名单"弹窗，初始勾选 = 当前名单
  const openRosterModal = () => {
    setRosterSelection(rosterMembers.map(m => m._id));
    setShowRosterModal(true);
  };

  // [新增] 保存本学期成员名单（整份替换）
  const handleSaveRoster = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/system/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ semester: selectedSemester || currentSemester, volunteerIds: rosterSelection })
      });
      const data = await res.json();
      if (data.success) {
        alert('本学期成员名单已保存');
        setShowRosterModal(false);
        fetchPerformanceAndUsers(selectedSemester);
      } else {
        alert(data.message || '保存失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const calculateScore = useCallback((records) => {
    let scores = { attendance: 0, activity: 0, feedback: 0, copywriting: 0, others: 0, bonus: 0 };
    let weightedFlags = { attendance: false, activity: false, feedback: false, copywriting: false, others: false, bonus: false };
    
    (records || []).forEach(r => { 
        if (scores[r.dimension] !== undefined) {
            scores[r.dimension] += r.score; 
            if (r.isCalibration || r.activityName === '期末系统加权') weightedFlags[r.dimension] = true;
        }
    });
    
    const attendance = Math.min(PERF_DIMENSIONS.attendance.max, Math.max(0, scores.attendance));
    const activity = Math.min(PERF_DIMENSIONS.activity.max, Math.max(0, scores.activity));
    const feedback = Math.min(PERF_DIMENSIONS.feedback.max, Math.max(0, scores.feedback));
    const copywriting = Math.min(PERF_DIMENSIONS.copywriting.max, Math.max(0, scores.copywriting));
    const others = Math.min(PERF_DIMENSIONS.others.max, Math.max(0, scores.others));
    const bonus = Math.max(0, scores.bonus);
    
    const total = attendance + activity + feedback + copywriting + others + bonus;
    return { attendance, activity, feedback, copywriting, others, bonus, total, weightedFlags };
  }, []);

  const handlePerfSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/performance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...perfForm, targetSemester: selectedSemester || currentSemester })
      });
      if ((await res.json()).success) {
        alert('绩效录入成功');
        setPerfForm({ volunteerIds: [], dimension: 'attendance', score: '', reason: '', occurrenceDate: '', activityName: '', targetSemester: selectedSemester || currentSemester });
        fetchPerformanceAndUsers(selectedSemester);
      }
    } catch (err) { alert('提交失败'); }
  };

  const handleArchiveSemester = async () => {
    const newSemester = window.prompt(`当前运行学期为：${currentSemester}\n请输入新学期的名称以进行归档重置`); 
    if (!newSemester || newSemester === currentSemester) return;
    if (!window.confirm(`警告：确认开启新学期 [${newSemester}] 吗？\n上一学期的成员名单与绩效将被冻结存档，新学期成员名单将清空，需重新从子管理员账号中选择！`)) return;
    
    try {
      const res = await fetch(`${API_BASE}/admin/system/semester`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ semester: newSemester })
      });
      const data = await res.json();
      if (data.success) {
        alert('新学期已成功开启！全员积分已重置。');
        fetchPerformanceAndUsers(newSemester);
      } else {
        alert(data.message || '开启新学期失败');
      }
    } catch(err) { alert('操作失败'); }
  };

  const handleRenameSemester = async () => {
    if (!selectedSemester) return alert('请先选择一个需要修改的学期');
    const newName = window.prompt(`修改学期名称\n\n原名称：${selectedSemester}\n请输入新名称：`, selectedSemester);
    if (!newName || newName === selectedSemester) return;
    if (!window.confirm(`确定将学期重命名为 "${newName}" 吗？\n该操作会同步更新该学期下产生的所有历史数据与加权记录。`)) return;

    try {
      const res = await fetch(`${API_BASE}/admin/system/semester/rename`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldName: selectedSemester, newName })
      });
      const data = await res.json();
      if (data.success) {
        alert('学期名称修改成功！');
        setSelectedSemester(newName);
        fetchPerformanceAndUsers(newName);
      } else {
        alert(data.message || '操作失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadNotificationCount = notifications.filter(item => !item.isRead).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setNotifications(data.notifications || []);
    } catch (err) {}
  }, [token]);

  const markNotificationsRead = async (ids = []) => {
    try {
      await requestJson('/notifications/read', token, { method: 'PUT', body: JSON.stringify(ids.length ? { ids } : {}) });
      setNotifications(current => current.map(item => (
        ids.length === 0 || ids.includes(item._id) ? { ...item, isRead: true } : item
      )));
    } catch (err) { alert(err.message || '标记已读失败'); }
  };

  const openNotification = async (notification) => {
    if (!notification) return;
    const feedbackId = notification.feedbackId?._id || notification.feedbackId;
    if (feedbackId) {
      try {
        const data = await requestJson(`/feedback/${feedbackId}`, token);
        setSelectedFeedback(data.feedback);
        setActiveAdminPage('feedback');
        if (!notification.isRead) await markNotificationsRead([notification._id]);
      } catch (error) { alert(error.message); return; }
    }
    setShowNotifs(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdData.new.length < 6) return alert('新密码至少需要6位');
    try {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pwdData.current, newPassword: pwdData.new })
      });
      const data = await res.json();
      if (data.success) {
        alert('密码修改成功！请重新登录。');
        setShowSettingsModal(false);
        setPwdData({ current: '', new: '' });
        onLogout(); 
      } else {
        alert(data.message || '修改失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (data.success) {
        alert('个人信息修改成功！');
        if (onRefreshUser) onRefreshUser();
      } else {
        alert(data.message || '修改失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) { console.error('获取统计数据失败:', err); }
  }, [token]);

  const fetchFeedbackArchives = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (searchQuery) params.append('search', searchQuery);
      const res = await fetch(`${API_BASE}/admin/feedback-archives?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setFeedbackArchives(data.academicYears || []);
    } catch (err) {
      console.error('获取反馈归档失败:', err);
    }
  }, [token, filters, searchQuery]);

  const fetchFeedbacks = useCallback(async (showLoading = true) => {
    const requestId = ++feedbackRequestRef.current;
    if (showLoading) setLoading(true); 
    try {
      const params = new URLSearchParams();
      params.set('page', String(feedbackPage));
      params.set('limit', '20');
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (searchQuery) params.append('search', searchQuery);
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);
      
      const res = await fetch(`${API_BASE}/admin/feedbacks?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && requestId === feedbackRequestRef.current) {
        setFeedbacks(data.feedbacks || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        setFeedbackSummary(data.summary || null);
        if (data.pagination?.pages > 0 && feedbackPage > data.pagination.pages) setFeedbackPage(data.pagination.pages);
        const selectedId = selectedFeedbackRef.current?._id;
        if (selectedId) {
          const detail = await requestJson(`/feedback/${selectedId}`, token);
          if (requestId === feedbackRequestRef.current && selectedFeedbackRef.current?._id === selectedId) setSelectedFeedback(detail.feedback);
        }
      }
    } catch (err) { console.error('获取反馈失败:', err); }
    if (requestId === feedbackRequestRef.current) setLoading(false);
  }, [token, filters, searchQuery, dateRange, feedbackPage]);

  useEffect(() => { setFeedbackPage(1); }, [filters, searchQuery, dateRange]);
  useEffect(() => {
    if (notificationTarget?.feedback) {
      setSelectedFeedback(notificationTarget.feedback);
      setActiveAdminPage('feedback');
    }
  }, [notificationTarget]);

  useEffect(() => {
    fetchStats();
    fetchFeedbacks(true); 
    fetchFeedbackArchives();
    fetchNotifications(); 
    const interval = setInterval(() => {
      fetchStats();
      fetchFeedbacks(false); 
      fetchFeedbackArchives();
      fetchNotifications(); 
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchFeedbacks, fetchFeedbackArchives, fetchNotifications]);

  useEffect(() => {
    if (!token) return;
    fetchSemesterConfig();
  }, [token, fetchSemesterConfig]);

  useEffect(() => {
    if (!canManageSievoxSemester || !currentSemester || availableSemesters.length > 0) return;
    fetchPerformanceAndUsers(selectedSemester || currentSemester);
  }, [
    canManageSievoxSemester,
    currentSemester,
    availableSemesters.length,
    selectedSemester,
    fetchPerformanceAndUsers
  ]);

  const selectFeedbackArchive = useCallback((semester) => {
    if (!semester) return;
    setSemesterName(semester.semester);
    setDateRange({ start: semester.startDate || '', end: semester.endDate || '' });
    setSelectedFeedback(null);
  }, []);

  const clearFeedbackArchive = useCallback(() => {
    setSemesterName('');
    setDateRange({ start: '', end: '' });
    setSelectedFeedback(null);
  }, []);

  const exportFeedbackReport = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (searchQuery) params.append('search', searchQuery);
      if (semesterName) params.append('semester', semesterName);
      else {
        if (dateRange.start) params.append('startDate', dateRange.start);
        if (dateRange.end) params.append('endDate', dateRange.end);
      }
      const res = await fetch(`${API_BASE}/admin/feedbacks/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('导出失败');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const suffix = semesterName || new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `SIEVOX反馈报表-${suffix}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出报表失败，请稍后重试');
    }
  }, [token, filters, searchQuery, dateRange, semesterName]);

  const handleRecallMsg = async (feedbackId, replyId) => {
    if (!window.confirm('确定要撤回这条回复吗？（撤回后学生和普通管理员将无法查看具体内容）')) return;
    try {
      const res = await fetch(`${API_BASE}/feedback/${feedbackId}/reply/${replyId}/recall`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchFeedbacks(false); 
      } else {
        alert(data.message || '撤回失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const updateStatus = async (feedbackId, status) => {
    if (replyInFlight.current) return;
    const draft = replyDrafts[feedbackId] || { content: '', files: [] };
    if (!status && !draft.content?.trim() && !draft.files?.length) return alert('请填写回复或选择附件');
    replyInFlight.current = true;
    setReplySending(true);
    try {
      const attachments = await uploadFeedbackFiles(draft.files || [], token);
      const selected = selectedFeedback?._id === feedbackId ? selectedFeedback : feedbacks.find(item => item._id === feedbackId);
      await requestJson(status ? `/admin/feedback/${feedbackId}/status` : `/feedback/${feedbackId}/reply`, token, {
        method: status ? 'PATCH' : 'POST',
        body: JSON.stringify(status ? { status, expectedStatus: selected?.status, response: draft.content || '', attachments } : { content: draft.content || '', attachments })
      });
      setReplyDrafts(current => { const next = { ...current }; delete next[feedbackId]; return next; });
      await fetchFeedbacks(false);
      fetchStats();
    } catch (error) {
      alert(error.message || '发送失败，请重试');
      if (error.status === 409) fetchFeedbacks(false);
    } finally { replyInFlight.current = false; setReplySending(false); }
  };

  const handleResetPassword = async () => {
    if (!resetStudentId || !resetNewPassword) {
      alert('请输入学号和新密码');
      return;
    }
    if (!window.confirm(`确定要将学号 ${resetStudentId} 的密码重置吗？`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${resetStudentId}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ newPassword: resetNewPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setResetStudentId('');
        setResetNewPassword('');
      } else {
        alert(data.message || '重置失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const handleWithdrawFeedback = async (feedbackId) => {
    if (!window.confirm('确定要撤回这条问题吗？撤回后将停止流转并保留审计记录。')) return;
    try {
      const res = await fetch(`${API_BASE}/feedback/${feedbackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedFeedback(null);
        fetchFeedbacks(false);
        fetchStats();
      } else {
        alert(data.message || '撤回失败');
      }
    } catch (err) { alert('网络错误'); }
  };

  const adminPageTitle = activeAdminPage === 'compose'
    ? '发起反馈'
    : activeAdminPage === 'guide'
      ? '服务指南'
      : activeAdminPage === 'archive'
        ? '问题归档'
        : roleCopy.title;

// ------------------ 视图渲染 ------------------
  return (
    <div className="desktop-shell admin-demo-shell">
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-lockup">
          <img src={sieLogo} alt="SIEVOX" />
          <div>
            <strong>SIEVOX</strong>
            <span>学生权益反馈系统</span>
          </div>
        </div>

        <nav className="side-nav">
          <p className="nav-label">反馈工作</p>
          <button className={`nav-item ${activeAdminPage === 'feedback' ? 'is-active' : ''}`} type="button" onClick={() => { setShowAccountManagement(false); clearFeedbackArchive(); setActiveAdminPage('feedback'); }}>
            <span>▦</span><span>反馈处理台</span>
          </button>
          <button className={`nav-item ${activeAdminPage === 'archive' ? 'is-active' : ''}`} type="button" onClick={() => setActiveAdminPage('archive')}>
            <span>▱</span><span>问题归档</span>
          </button>
          <p className="nav-label">本人服务</p>
          <button className="nav-item" type="button" onClick={() => onPortalChange?.('student')}>
            <span>□</span><span>我的反馈</span>
          </button>
          <button className={`nav-item ${activeAdminPage === 'compose' ? 'is-active' : ''}`} type="button" onClick={() => { setShowAccountManagement(false); setActiveAdminPage('compose'); }}>
            <span>＋</span><span>发起反馈</span>
          </button>
          <button className={`nav-item ${activeAdminPage === 'guide' ? 'is-active' : ''}`} type="button" onClick={() => { setShowAccountManagement(false); setActiveAdminPage('guide'); }}>
            <span>◇</span><span>服务指南</span>
          </button>
          {isUltimateAdmin && onOpenUltimate && <><p className="nav-label">平台治理</p><button className="nav-item" type="button" onClick={onOpenUltimate}><span>◈</span><span>组织与账号</span></button></>}
        </nav>

        <ServiceHealthNote metrics={serviceMetrics.metrics} loading={serviceMetrics.loading} error={serviceMetrics.error} language={language} />

        <div className="sidebar-user">
          <span className="avatar">{(user?.name || '管').slice(0, 1)}</span>
          <div><strong>{user?.name}</strong><span>{roleCopy.scope}</span><RoleTag user={user} /></div>
        </div>
      </aside>

      <main className="desktop-main">
      
      {/* 顶部导航 */}
      {/* 修改：浅色模式下背景设为稍深的紫色 (bg-purple-200/60)，边框设为紫色的半透明边框 (border-purple-300/50) */}
      <header className="topbar">
        <div className="breadcrumb">
          <span>国际教育学院</span><span>›</span><strong>{showUltimatePortal ? '学院权益治理总控台' : adminPageTitle}</strong>
        </div>
        <div className="topbar-actions">
          {isUltimateAdmin && (
            <div className="role-switch" aria-label="当前身份">
              <button type="button" onClick={() => onPortalChange?.('student')}>本人反馈</button>
              <button className={activePortal === 'admin' ? 'is-active' : ''} type="button" onClick={() => onPortalChange?.('admin')}>反馈处理台</button>
              <button className={activePortal === 'superadmin' ? 'is-active' : ''} type="button" onClick={() => onPortalChange?.('superadmin')}>终极管理</button>
            </div>
          )}
          {onBackToHub && (
            <button className="hub-inline-return" type="button" onClick={onBackToHub} title="返回 SIEHUB 模块总览">
              <img src={siehubLogo} alt="" />
              <span>返回 SIEHUB</span>
            </button>
          )}
          {onOpenPerformance && <button className="hub-inline-return" type="button" onClick={onOpenPerformance}>绩效考核</button>}
          <div className="topbar-user-chip" aria-label="当前登录身份">
            <span>{user?.name}</span>
            <RoleTag user={user} />
          </div>
          <button className="icon-button" type="button" onClick={() => setShowNotifs(true)} title="消息通知" aria-label={`消息通知，${unreadNotificationCount} 条未读`}>📬{unreadNotificationCount > 0 && <span className="notification-badge">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>}</button>
          <button className="hub-inline-return sievox-account-settings" type="button" onClick={onOpenMy}>账号设置</button>
          <AdminThemeModeButtons themeTools={themeTools} />
          <button className="icon-button theme-trigger" type="button" onClick={() => themeTools?.setOpen?.(true)} aria-label="外观设置">🎨</button>
          {languageSwitcher}
        </div>
        {false && <div className="max-w-7xl mx-auto px-2 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <img src={collegeLogo} alt="学院LOGO" className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain" />
              <img src={sieLogo} alt="系统LOGO" className="w-7 h-7 sm:w-10 sm:h-10 md:w-12 md:h-12 object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[14px] sm:text-base md:text-2xl font-bold text-white truncate">管理控制台</h1>
              <p className="text-[10px] sm:text-xs text-purple-200/60 truncate">学生权益反馈系统</p>
            </div>
          </div>
          
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            <button 
              onClick={themeTools?.toggleTheme} 
              className="p-1 sm:p-2 text-base sm:text-xl hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-all"
              title="切换深浅色主题"
            >
              🌗
            </button>
            <AdminPaletteBar themeTools={themeTools} />
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="p-1 sm:p-2 text-base sm:text-xl hover:bg-white/10 rounded-full transition-all relative">
                📬
                {notifications.length > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900"></span>}
              </button>
            {showNotifs && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-[100] max-h-80 flex flex-col overflow-hidden text-left transition-colors">
                  <div className="p-3 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
                    <span className="text-sm font-medium text-slate-800 dark:text-white">消息通知</span>
                    {notifications.length > 0 && <button onClick={() => markNotificationsRead()} className="text-xs text-purple-500 dark:text-purple-300 hover:text-purple-700 dark:hover:text-white transition-colors">全部标为已读</button>}
                  </div>
                  <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-purple-200/50 text-center py-6">暂无新消息</p>
                    ) : (
                      notifications.map(n => (
                        <button key={n._id} type="button" onClick={() => openNotification(n)} className={`w-full p-2.5 mb-1 rounded-lg border text-left text-slate-800 dark:text-purple-100 flex flex-col gap-1 transition-colors ${n.isRead ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60'}`}>
                          <p className="text-xs break-words">{n.content}</p>
                          <span className="text-[10px] text-slate-500 dark:text-purple-200/40 text-right">{new Date(n.createdAt).toLocaleString('zh-CN')}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-right hidden sm:block">
             <div className="text-sm font-bold text-white flex items-center justify-end gap-2">{user?.name}<RoleTag user={user} /></div>
              <div className="text-xs text-purple-200/60 font-mono mt-0.5">{user?.studentId}</div>
            </div>
            
            <button 
              onClick={() => onOpenMy?.()}
              className="px-4 py-2 bg-white/5 hover:bg-purple-500/20 text-purple-200 hover:text-purple-300 rounded-xl text-sm transition-all border border-white/10"
            >
              修改信息
            </button>

            <button 
              onClick={onLogout}
              className="px-4 py-2 bg-white/5 hover:bg-red-500/20 text-purple-200 hover:text-red-400 rounded-xl text-sm transition-all border border-white/10 hover:border-red-500/30"
            >
              退出登录
            </button>
          </div>
        </div>}
      </header>

      {showNotifs && <div className="notification-drawer-backdrop" onClick={() => setShowNotifs(false)}>
        <aside className="notification-drawer" aria-label="消息通知" onClick={event => event.stopPropagation()}>
          <header className="notification-drawer-head"><div><p>MESSAGES</p><h2>消息通知</h2><span>未读 {unreadNotificationCount}</span></div><button className="icon-button" type="button" onClick={() => setShowNotifs(false)} aria-label="关闭通知">×</button></header>
          <div className="notification-drawer-actions"><button className="outline-button" type="button" disabled={unreadNotificationCount === 0} onClick={() => markNotificationsRead()}>全部标为已读</button></div>
          <div className="notification-drawer-list">{notifications.length === 0 ? <p className="siehub-empty-text">暂无消息。</p> : notifications.map(item => <button key={item._id} type="button" className={`notification-item ${item.isRead ? '' : 'is-unread'}`} onClick={() => openNotification(item)}><div><strong>{item.type === 'new_feedback' ? '新反馈' : item.type === 'new_message' ? '新留言' : '状态更新'}</strong><p>{item.content}</p><small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small></div>{!item.isRead && <span className="notification-unread-dot" />}</button>)}</div>
        </aside>
      </div>}

      <nav className="sievox-admin-mobile-nav" aria-label="反馈系统导航">
        <button className={activeAdminPage === 'feedback' ? 'is-active' : ''} type="button" onClick={() => { clearFeedbackArchive(); setActiveAdminPage('feedback'); }}>处理台</button>
        <button className={activeAdminPage === 'archive' ? 'is-active' : ''} type="button" onClick={() => setActiveAdminPage('archive')}>归档</button>
        <button className={activeAdminPage === 'compose' ? 'is-active' : ''} type="button" onClick={() => setActiveAdminPage('compose')}>发起反馈</button>
        <button className={activeAdminPage === 'guide' ? 'is-active' : ''} type="button" onClick={() => setActiveAdminPage('guide')}>指南</button>
        <button type="button" onClick={() => onPortalChange?.('student')}>我的反馈</button>
        {onOpenPerformance && <button type="button" onClick={onOpenPerformance}>绩效</button>}
        <button type="button" onClick={onOpenMy}>账号</button>
        {isUltimateAdmin && onOpenUltimate && <button type="button" onClick={onOpenUltimate}>组织治理</button>}
      </nav>

      {/* 主体内容区 */}
      <section className={showUltimatePortal ? 'role-view superadmin-view' : 'role-view'}>
        {showUltimatePortal ? (
          <>
            <div className="superadmin-hero">
              <div>
                <p className="eyebrow">SIEVOX · 权益治理</p>
                <h1>{roleCopy.title}</h1>
                <p>{roleCopy.scope}。在这里查看反馈进度；账号与届次请进入组织治理。</p>
              </div>
              <div className="superadmin-badge"><span>当前模块</span><strong>业务反馈</strong></div>
            </div>
            <div className="superadmin-metrics">
              <div><span>有效反馈</span><strong>{stats?.total ?? '—'}</strong><small>全部职责范围</small></div>
              <div><span>待受理</span><strong>{stats?.pending ?? '—'}</strong><small>需要及时查看</small></div>
              <div><span>处理中</span><strong>{stats?.processing ?? '—'}</strong><small>持续跟进</small></div>
              <div><span>已解决</span><strong>{stats?.resolved ?? '—'}</strong><small>累计处理完成</small></div>
            </div>
          </>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <p className="eyebrow">SIEVOX · 反馈处理</p>
                <h1>{adminPageTitle}</h1>
                <p>{roleCopy.scope}</p>
              </div>
              <div className="admin-actions">
                {activeAdminPage === 'feedback' && <button className="outline-button" type="button" onClick={exportFeedbackReport}>导出报表</button>}
              </div>
            </div>
            {activeAdminPage === 'feedback' && <div className="admin-metrics">
              <div><span>有效反馈</span><strong>{stats?.total ?? '—'}</strong><small>本职责范围</small></div>
              <div><span>待受理</span><strong>{stats?.pending ?? '—'}</strong><small>请及时处理</small></div>
              <div><span>处理中</span><strong>{stats?.processing ?? '—'}</strong><small>持续跟进</small></div>
              <div><span>已解决</span><strong>{stats?.resolved ?? '—'}</strong><small>累计处理完成</small></div>
            </div>}
          </>
        )}

        {false ? (
          <div className={`performance-redesign-panel ${user?.role === 'superadmin' ? 'super-performance-redesign' : 'self-performance-redesign'} animate-fadeIn space-y-4 md:space-y-6`}>
            <section className="performance-command">
              <div className="performance-command-copy">
                <p className="performance-command-kicker">PERFORMANCE COMMAND</p>
                <h2>历史面板已停用</h2>
                <p>{user?.role === 'superadmin' ? '学期管理、成员名单、批量赋分、绩效流水撤回与期末动态加权统一在这里完成。' : '仅查看本人当前学期的积分、维度分布和绩效流水。'}</p>
              </div>
              {user?.role === 'superadmin' && (
                <div className="performance-action-board">
                  <button className="performance-action-card roster" type="button" onClick={openRosterModal}>
                    <span>👥</span>
                    <strong>管理本学期成员</strong>
                    <small>从子管理员账号中选择参与本学期绩效核算的成员。<br />录入前先维护名单，避免历史学期数据混入。</small>
                  </button>
                  <button className="performance-action-card weight" type="button" onClick={() => setShowWeightCalc(true)}>
                    <span>🧮</span>
                    <strong>期末动态加权结算</strong>
                    <small>按活动参与人数与规则自动校准板块得分。<br />生成加权结果前，请先确认成员名单和绩效流水。</small>
                  </button>
                </div>
              )}
            </section>
            <PerformanceRulesAccordion />
            
            <section className="performance-semester-console">
               <div className="performance-semester-copy">
                 <span>当前管理学期：</span>
                 <div className="performance-semester-control">
                   <select 
                     value={selectedSemester} 
                     onChange={(e) => { setSelectedSemester(e.target.value); fetchPerformanceAndUsers(e.target.value); }}
                     className="performance-semester-select"
                   >
                     {availableSemesters.map(s => <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">{s} {s === currentSemester ? '(当前运行中)' : '(历史归档)'}</option>)}
                   </select>
                   {showUltimatePortal && (
                     <button onClick={handleRenameSemester} title="重命名此学期" className="performance-rename-button" type="button">
                       ✏️ 
                     </button>
                   )}
                 </div>
               </div>
               {showUltimatePortal && (
                 <button onClick={handleArchiveSemester} className="performance-archive-button" type="button">
                   📦 归档并开启新学期
                 </button>
               )}
            </section>
            
            {user?.role === 'superadmin' ? (
              <div className="space-y-4 md:space-y-6">
                <div className="p-4 md:p-6 bg-gradient-to-br from-white to-purple-50 dark:from-slate-900 dark:to-purple-950/50 border border-purple-200 dark:border-purple-500/30 rounded-2xl shadow-sm transition-colors">
                  {/* [修复] 在这里加回了呼出“加权核算器”的按钮！ */}
                  <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2"><span>🏆</span> 部门全员期末核算总榜单</div>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-purple-200/60 transition-colors">
                        <tr>
                          <th className="pb-3 pr-4">志愿者姓名</th>
                          <th className="pb-3 pr-4 text-purple-600 dark:text-purple-300">考勤(20)</th>
                          <th className="pb-3 pr-4 text-blue-600 dark:text-blue-300">活动(35)</th>
                          <th className="pb-3 pr-4 text-green-600 dark:text-green-300">跟进(25)</th>
                          <th className="pb-3 pr-4 text-yellow-600 dark:text-yellow-300">文案(15)</th>
                          <th className="pb-3 pr-4 text-slate-500 dark:text-gray-300">常规(5)</th>
                          <th className="pb-3 pr-4 text-red-500 dark:text-red-300">+附加</th>
                          <th className="pb-3 font-bold text-slate-800 dark:text-white">总计得分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-slate-700 dark:text-purple-100 transition-colors">
                        {rosterMembers.map(v => {
                          const personalRecords = performanceRecords.filter(r => r.volunteer?._id === v._id);
                          return { user: v, scoreObj: calculateScore(personalRecords) };
                        }).sort((a, b) => b.scoreObj.total - a.scoreObj.total).map(({ user: v, scoreObj: s }) => (
                          <tr key={v._id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="py-3 pr-4 font-medium text-slate-800 dark:text-white">{v.name}</td>
                            <td className="py-3 pr-4">{s.attendance}</td>
                            <td className="py-3 pr-4">{s.activity}</td>
                            <td className="py-3 pr-4">{s.feedback}</td>
                            <td className="py-3 pr-4">{s.copywriting}</td>
                            <td className="py-3 pr-4">{s.others}</td>
                            <td className="py-3 pr-4 text-red-600 dark:text-red-400">{s.bonus > 0 ? `+${s.bonus}` : '-'}</td>
                            <td className="py-3 text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 relative pr-6">
                              {s.total}
                              {Object.values(s.weightedFlags).some(val => val) && <span className="absolute top-1 ml-1 text-[9px] text-green-400 bg-green-500/10 border border-green-500/30 px-1 py-0.5 rounded shadow-sm whitespace-nowrap">已加权</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rosterMembers.length === 0 && (
                      <p className="text-center text-slate-500 dark:text-purple-200/50 py-6 text-sm">
                        本学期尚未选择参与绩效的成员，请点击右上角「👥 管理本学期成员名单」从子管理员账号中添加。
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                  <div className="md:col-span-1 p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl h-fit">
                    <h3 className="text-base md:text-lg font-bold text-white mb-4">✍️ 快捷赋分录入</h3>
                    <form onSubmit={handlePerfSubmit} className="space-y-4">
                      
                      <div>
                        <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">录入目标学期 (默认跟随当前视图)</label>
                        <select 
                          value={perfForm.targetSemester || currentSemester} 
                          onChange={e => setPerfForm({...perfForm, targetSemester: e.target.value})} 
                          className={`w-full px-3 py-2 rounded-lg outline-none transition-colors ${
                            perfForm.targetSemester && perfForm.targetSemester !== currentSemester 
                              ? 'bg-orange-50 dark:bg-orange-950/50 border border-orange-300 dark:border-orange-500/50 text-orange-600 dark:text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.2)]' 
                              : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white'
                          }`}
                        >
                          {availableSemesters.map(s => <option key={s} value={s}>{s} {s === currentSemester ? '(当前学期)' : '(历史归档)'}</option>)}
                        </select>
                        {perfForm.targetSemester && perfForm.targetSemester !== currentSemester && (
                          <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-1.5 flex items-start gap-1 leading-tight">
                            <span className="shrink-0">⚠️</span>
                            <span>注意：您当前正在向历史归档学期补录积分，此操作将改变该学期的结算总分。</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">考核维度</label>
                        <select value={perfForm.dimension} onChange={e => setPerfForm({...perfForm, dimension: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 outline-none transition-colors">
                          {Object.entries(PERF_DIMENSIONS).map(([k, v]) => <option key={k} value={k}>{v.label} (封顶{v.max}分)</option>)}
                        </select>
                      </div>
                      
                      {(perfForm.dimension === 'attendance' || perfForm.dimension === 'activity' || perfForm.dimension === 'copywriting' || perfForm.dimension === 'bonus') && (
                        <div>
                          <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">具体项目名称 (填写名称后方可参与期末加权)</label>
                          <input type="text" placeholder="例: 第三周例会 / 迎新晚会统筹" value={perfForm.activityName} onChange={e => setPerfForm({...perfForm, activityName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 outline-none transition-colors" />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">发生日期</label>
                          <input type="date" required value={perfForm.occurrenceDate} onChange={e => setPerfForm({...perfForm, occurrenceDate: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 outline-none dark:[color-scheme:dark] transition-colors" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">获得积分数</label>
                          <input type="number" step="0.5" required placeholder="如 2 或 4.5" value={perfForm.score} onChange={e => setPerfForm({...perfForm, score: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 outline-none transition-colors" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">详细加分事由</label>
                        <textarea required rows="2" placeholder="例: 按时全勤出勤 / 独立撰写大型策划案" value={perfForm.reason} onChange={e => setPerfForm({...perfForm, reason: e.target.value})} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-800 dark:text-white border border-slate-200 dark:border-white/10 outline-none resize-none transition-colors" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-purple-200/60 mb-1 block transition-colors">选择志愿者 (仅限本学期名单)</label>
                        <div className="max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-white/10 p-2 space-y-1 custom-scrollbar transition-colors">
                          {rosterMembers.map(v => (
                            <label key={v._id} className="flex items-center gap-2 text-sm text-slate-800 dark:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 p-1 rounded cursor-pointer transition-colors">
                              <input type="checkbox" checked={perfForm.volunteerIds.includes(v._id)} onChange={(e) => {
                                const ids = e.target.checked ? [...perfForm.volunteerIds, v._id] : perfForm.volunteerIds.filter(id => id !== v._id);
                                setPerfForm({...perfForm, volunteerIds: ids});
                              }} className="accent-purple-500" />
                              {v.name}
                            </label>
                          ))}
                          {rosterMembers.length === 0 && (
                            <p className="text-xs text-slate-400 dark:text-purple-200/40 text-center py-3">本学期暂无成员，请先用上方「👥 管理本学期成员名单」添加。</p>
                          )}
                        </div>
                      </div>
                      
                      <button type="submit" className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium shadow-lg">确认发放积分</button>
                    </form>
                  </div>

                  <div className="md:col-span-2 p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl h-fit">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base md:text-lg font-bold text-white">🗂 部门打分流水账库</h3>
                      {selectedRecordIds.length > 0 && (
                        <button 
                          onClick={handleBatchDeleteRecords} 
                          className="px-3 py-1.5 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-lg transition-all text-xs font-medium flex items-center gap-1"
                        >
                          🗑️ 批量撤回 ({selectedRecordIds.length})
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-white/10 text-purple-200/60">
                          <tr>
                            <th className="pb-3 pr-4">
                              <input 
                                type="checkbox" 
                                className="accent-purple-500 cursor-pointer"
                                checked={performanceRecords.length > 0 && selectedRecordIds.length === performanceRecords.length}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedRecordIds(performanceRecords.map(r => r._id));
                                  else setSelectedRecordIds([]);
                                }}
                              />
                            </th>
                            <th className="pb-3 pr-4">日期</th>
                            <th className="pb-3 pr-4">志愿者</th>
                            <th className="pb-3 pr-4">分值</th>
                            <th className="pb-3 pr-4">维度</th>
                            <th className="pb-3 pr-4">事由明细</th>
                            <th className="pb-3">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-purple-100">
                          {performanceRecords.map(r => (
                            <tr key={r._id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 pr-4">
                                <input 
                                  type="checkbox" 
                                  className="accent-purple-500 cursor-pointer"
                                  checked={selectedRecordIds.includes(r._id)}
                                  onChange={(e) => {
                                    if (e.target.checked) setSelectedRecordIds([...selectedRecordIds, r._id]);
                                    else setSelectedRecordIds(selectedRecordIds.filter(id => id !== r._id));
                                  }}
                                />
                              </td>
                              <td className="py-3 pr-4 text-xs">{new Date(r.occurrenceDate).toLocaleDateString('zh-CN')}</td>
                              <td className="py-3 pr-4">{r.volunteer?.name}</td>
                              <td className={`py-3 pr-4 font-bold text-green-400`}>+{r.score}</td>
                              <td className="py-3 pr-4"><span className={`px-2 py-0.5 rounded text-[10px] bg-${PERF_DIMENSIONS[r.dimension]?.color || 'gray'}-500/20 text-${PERF_DIMENSIONS[r.dimension]?.color || 'gray'}-300`}>{PERF_DIMENSIONS[r.dimension]?.label || '旧版归档记录'}</span></td>
                              <td className="py-3 pr-4 text-xs truncate max-w-[200px]" title={r.reason}>{r.activityName ? `[${r.activityName}] ` : ''}{r.reason}</td>
                              <td className="py-3">
                                <button 
                                  onClick={() => handleDeleteRecord(r._id)} 
                                  className="text-xs px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded transition-colors"
                                >
                                  撤回
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {performanceRecords.length === 0 && (
                        <p className="text-center text-purple-200/50 py-6 text-sm">暂无打分记录</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                 <div className="space-y-4 md:space-y-6">
                  <div className="p-4 md:p-6 bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-2xl text-center relative overflow-hidden">
                    <p className="text-sm md:text-base text-purple-200/80 mb-2">【{selectedSemester || '当前学期'}】绩效得分</p>
                    <div className="relative inline-block">
                      <p className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 drop-shadow-lg mb-0">
                        {calculateScore(performanceRecords).total} <span className="text-lg md:text-xl font-normal text-white/50">/100</span>
                      </p>
                      {Object.values(calculateScore(performanceRecords).weightedFlags).some(v => v) && (
                        <span className="absolute -top-3 -right-14 bg-green-500/20 border border-green-500/50 text-green-400 text-[10px] px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(34,197,94,0.3)] font-bold whitespace-nowrap">
                          ✓ 已加权
                        </span>
                      )}
                    </div>
                    
                    <PerformanceRadar scores={calculateScore(performanceRecords)} dimensions={PERF_DIMENSIONS} />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-left border-t border-white/10 pt-4 mt-2">
                      {['attendance', 'activity', 'feedback', 'copywriting', 'others'].map(k => {
                        const s = calculateScore(performanceRecords)[k];
                        const d = PERF_DIMENSIONS[k];
                        const isMax = s >= d.max;
                        return (
                          <div key={k} className={`p-2.5 rounded-xl border ${isMax ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-black/20 border-white/5'}`}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className={`text-${isMax ? 'yellow' : d.color}-300 flex items-center gap-1`}>
                                {d.label}
                                {calculateScore(performanceRecords).weightedFlags[k] && <span className="bg-green-500/20 text-green-400 text-[8px] px-1 rounded border border-green-500/30">加权</span>}
                              </span>
                              <span className={`font-bold ${isMax ? 'text-yellow-400' : 'text-white'}`}>{isMax ? '已满MAX' : `${s}/${d.max}`}</span>
                            </div>
                            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"><div className={`h-full ${isMax ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]' : `bg-${d.color}-500`}`} style={{ width: `${(s/d.max)*100}%` }}></div></div>
                          </div>
                        );
                      })}
                      <div className="col-span-1 sm:col-span-2 bg-red-900/20 p-2.5 rounded-xl border border-red-500/20 flex justify-between items-center">
                        <span className="text-xs text-red-300">🎉 特殊附加奖励</span><span className="text-lg font-bold text-red-400">+{calculateScore(performanceRecords).bonus}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 md:p-6 bg-white/5 border border-white/10 rounded-2xl max-h-[600px] flex flex-col">
                  <h3 className="text-base md:text-lg font-bold text-white mb-4 shrink-0">📈 我的绩效履历档案</h3>
                  <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar space-y-4">
                    {performanceRecords.length === 0 ? <p className="text-center text-purple-200/50 py-10 text-sm">该学期暂未获取积分</p> : 
                      performanceRecords.map(r => (
                        <div key={r._id} className="relative pl-6 border-l-2 border-purple-500/30 pb-4 last:pb-0">
                          <span className="absolute left-[-5px] top-0 w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]"></span>
                          <div className="text-[10px] text-purple-200/50 mb-1">{new Date(r.occurrenceDate).toLocaleDateString('zh-CN')} · 由 {r.recordedBy?.name} 授予</div>
                          <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] bg-${PERF_DIMENSIONS[r.dimension]?.color || 'gray'}-500/20 text-${PERF_DIMENSIONS[r.dimension]?.color || 'gray'}-300`}>{PERF_DIMENSIONS[r.dimension]?.label || '旧版记录'}</span>
                                {r.activityName && <span className="text-xs font-bold text-white">[{r.activityName}]</span>}
                              </div>
                              <p className="text-sm text-purple-100">{r.reason}</p>
                            </div>
                            <span className={`shrink-0 text-lg font-bold text-green-400`}>+{r.score}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : false && showAccountManagement && showUltimatePortal ? (
           <AccountManagement token={token} user={user} />
        ) : (
          <>
            {activeAdminPage === 'compose' ? (
              <AdminQuickFeedbackPage
                token={token}
                onBackToFeedback={() => { clearFeedbackArchive(); setActiveAdminPage('feedback'); }}
                onSubmitted={() => { fetchFeedbacks(false); setActiveAdminPage('feedback'); }}
              />
            ) : activeAdminPage === 'guide' ? (
              <AdminServiceGuidePage onBackToFeedback={() => setActiveAdminPage('feedback')} />
            ) : activeAdminPage === 'archive' ? (
              <FeedbackArchivePage
                archives={feedbackArchives}
                feedbacks={feedbacks}
                loading={loading}
                canManageSemester={canManageSievoxSemester}
                currentSemester={currentSemester}
                semesterLoadError={semesterLoadError}
                activeSemesterName={semesterName}
                onSelectArchive={selectFeedbackArchive}
                onClearArchive={clearFeedbackArchive}
                onArchiveSemester={handleArchiveSemester}
                onBackToFeedback={() => { clearFeedbackArchive(); setActiveAdminPage('feedback'); }}
              />
            ) : (
              <BusinessFeedbackWorkspace
                pagination={pagination}
                onPageChange={setFeedbackPage}
                summary={feedbackSummary}
                replySending={replySending}
                selectedReplyFiles={selectedReplyFiles}
                feedbacks={feedbacks}
                archives={feedbackArchives}
                selectedFeedback={selectedFeedback}
                setSelectedFeedback={setSelectedFeedback}
                responseText={responseText}
                setResponseText={setResponseText}
                setSelectedReplyFiles={setSelectedReplyFiles}
                updateStatus={updateStatus}
                handleRecallMsg={handleRecallMsg}
                handleWithdrawFeedback={handleWithdrawFeedback}
                user={user}
                loading={loading}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filters={filters}
                setFilters={setFilters}
                canManageSemester={canManageSievoxSemester}
                currentSemester={currentSemester}
                semesterLoadError={semesterLoadError}
                activeSemesterName={semesterName}
                onSelectArchive={selectFeedbackArchive}
                onClearArchive={clearFeedbackArchive}
                onArchiveSemester={handleArchiveSemester}
              />
            )}
            <div className="legacy-feedback-content" hidden>
            {/* 统计模块 */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: '总反馈', value: stats.total, icon: '📊', gradient: 'from-purple-600 to-purple-400' },
                  { label: '待处理', value: stats.pending, icon: '⏳', gradient: 'from-yellow-600 to-yellow-400' },
                  { label: '处理中', value: stats.processing, icon: '⚙️', gradient: 'from-blue-600 to-blue-400' },
                  { label: '已解决', value: stats.resolved, icon: '✅', gradient: 'from-green-600 to-green-400' }
                ].map((stat, i) => (
                  <div key={i} className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-all">
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.gradient} opacity-20 blur-2xl`} />
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-200/60 text-sm">{stat.label}</span>
                        <span className="text-2xl">{stat.icon}</span>
                      </div>
                      <p className="text-4xl font-bold text-white">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 按类别统计 */}
            {stats?.byCategory && (
              <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-medium text-white mb-4">按类别统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(categories).map(([key, cat]) => (
                    <div key={key} className="text-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                      <span className="text-3xl">{cat.icon}</span>
                      <p className="text-white font-bold mt-2">{stats.byCategory[key] || 0}</p>
                      <p className="text-purple-200/60 text-xs">{cat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 密码重置面板 */}
            <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <span>🔐</span> 用户密码重置
              </h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="text-sm text-purple-200/60 mb-1 block">学生学号</label>
                  <input type="text" value={resetStudentId} onChange={e => setResetStudentId(e.target.value)} placeholder="例如：2024090101" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500" />
                </div>
                <div className="flex-1 w-full">
                  <label className="text-sm text-purple-200/60 mb-1 block">新密码</label>
                  <input type="text" value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} placeholder="设置一个临时密码" className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500" />
                </div>
                <button onClick={handleResetPassword} className="w-full md:w-auto px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all font-medium">确认重置</button>
              </div>
            </div>

            {/* 检索与归档面板 */}
            <div className="mb-6 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium text-white flex items-center gap-2"><span>🔍</span> 问题检索与归档</h3>
                <button onClick={() => { setSearchQuery(''); setDateRange({ start: '', end: '' }); setSemesterName(''); setFilters({ status: '', category: '', priority: '' }); }} className="text-xs text-purple-300 hover:text-white transition-colors">清空所有条件</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4">
                  <label className="text-xs text-purple-200/60 mb-1.5 block">关键词检索 (空格分隔)</label>
                  <div className="relative">
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="例如：宿舍 漏水" className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-purple-500 transition-all" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">🔎</span>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="text-xs text-purple-200/60 mb-1.5 block">归档/学期名称 (可选)</label>
                  <input type="text" value={semesterName} onChange={e => setSemesterName(e.target.value)} placeholder="例: 23-24学年第一学期" className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all text-yellow-300 placeholder-white/20" />
                </div>

                <div className="md:col-span-5 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-purple-200/60 mb-1.5 block">起始日期</label>
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-xs text-purple-200/60 mb-1.5 block">截止日期</label>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500 transition-all [color-scheme:dark]" />
                  </div>
                </div>
              </div>
            </div>

            {/* 快速筛选按钮 */}
            <div className="mb-6 flex flex-wrap gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <select value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})} className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500">
                <option value="">全部状态</option>
                {Object.entries(statusConfig).map(([k, v]) => ( <option key={k} value={k}>{v.label}</option> ))}
              </select>
              
              <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500">
                <option value="">全部类别</option>
                {Object.entries(categories).map(([k, v]) => ( <option key={k} value={k}>{v.label}</option> ))}
              </select>
              
              <select value={filters.priority} onChange={e => setFilters({...filters, priority: e.target.value})} className="px-4 py-2 rounded-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:border-purple-500">
                <option value="">全部优先级</option>
                {Object.entries(priorityConfig).map(([k, v]) => ( <option key={k} value={k}>{v.label}</option> ))}
              </select>
              
              <button onClick={() => setFilters({ status: '', category: '', priority: '' })} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all">重置筛选</button>
            </div>

            {/* 反馈列表 */}
            <div className="space-y-4">
              {semesterName && dateRange.start && dateRange.end && !loading && (
                <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 flex items-center justify-between shadow-lg shadow-purple-900/20">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-3xl">📂</span>
                      <h2 className="text-2xl font-bold text-white tracking-wide">{semesterName}</h2>
                      <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs border border-purple-500/30 uppercase tracking-wider">Archive</span>
                    </div>
                    <p className="text-purple-200/60 text-sm flex items-center gap-3 font-mono">
                      <span>📅 {dateRange.start} ~ {dateRange.end}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                      <span>共检索到 <span className="text-white font-bold">{feedbacks.length}</span> 条反馈</span>
                    </p>
                  </div>
                </div>
              )}
              
              {loading ? (
                <div className="text-center py-12 text-purple-200/60">加载中...</div>
              ) : feedbacks.length === 0 ? (
                <div className="text-center py-12 text-purple-200/60">
                  <span className="text-6xl mb-4 block">📭</span>暂无反馈
                </div>
              ) : (
               feedbacks.map(feedback => {
                  const cat = categories[feedback.category] || { label: feedback.category, icon: '📋' };
                  const status = statusConfig[feedback.status] || statusConfig.pending;
                  const priority = priorityConfig[feedback.priority] || priorityConfig.normal;
                  // [新增] 提取撤回状态
                  const isRevoked = feedback.isRevoked;
                  
                  return (
                    <div key={feedback._id} className={`p-6 rounded-2xl border transition-all cursor-pointer ${isRevoked ? 'bg-slate-900/50 border-gray-600/50 opacity-75 grayscale-[50%]' : 'bg-white/5 border-white/10 hover:bg-white/10'} ${selectedFeedback?._id === feedback._id ? '!border-purple-500 bg-purple-500/10 opacity-100 grayscale-0' : ''}`} onClick={() => setSelectedFeedback(selectedFeedback?._id === feedback._id ? null : feedback)}>
                      <div className="flex items-start justify-between gap-2 md:gap-4">
                        <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                          
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${isRevoked ? 'bg-gray-800' : 'bg-white/10'}`}>
                            <span className="text-lg md:text-xl">{cat.icon}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                              <h4 className={`font-medium truncate max-w-full ${isRevoked ? 'text-gray-400 line-through' : 'text-white'}`}>{feedback.title}</h4>
                              {!isRevoked && <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] md:text-xs bg-${priority.color}-500/20 text-${priority.color}-400`}>{priority.label}</span>}
                              {/* [新增] 撤回标签 */}
                              {isRevoked && <span className="shrink-0 px-2 py-0.5 rounded text-[10px] md:text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30">学生已撤回</span>}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-sm text-purple-200/60">
                              <span className="shrink-0">{cat.label}{feedback.subCategory ? ` > ${feedback.subCategory}` : ''}</span>
                              <span className="shrink-0">{feedback.isAnonymous ? '匿名用户' : feedback.user?.name}</span>
                              <span className="shrink-0">{new Date(feedback.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                          
                        </div>
                        <span className={`shrink-0 px-2 py-1 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium bg-${status.color}-500/20 text-${status.color}-400`}>{status.label}</span>
                      </div>
                      
                      {selectedFeedback?._id === feedback._id && (
                        <div className="mt-4 pt-4 border-t border-white/10" onClick={e => e.stopPropagation()}>
                          <p className="text-purple-200/80 whitespace-pre-wrap mb-4">{feedback.content}</p>
                          <AttachmentViewer attachments={feedback.attachments} />
                          
                          {feedback.responses?.length > 0 && (
                            <div className="mb-4 space-y-3">
                              <h5 className="text-sm font-medium text-white mb-2">流转与对话记录</h5>
                              {feedback.responses.map((resp, i) => {
                                const isStudent = resp.senderType === 'student';
                                const isAdmin = !isStudent;
                                const isSuperadmin = user?.role === 'superadmin';

                                if (resp.isRecalled && !isSuperadmin) {
                                  return (
                                    <div key={i} className={`p-3 rounded-xl border opacity-50 ${isStudent ? 'bg-blue-500/10 border-blue-500/20 mr-8' : 'bg-purple-500/10 border-purple-500/20 ml-8'}`}>
                                      <p className="text-xs text-purple-200/50 italic text-center py-2">此消息已撤回</p>
                                    </div>
                                  );
                                }

                                return (
                                 <div key={i} className={`p-3 rounded-xl border ${isStudent ? 'bg-blue-500/10 border-blue-500/20 mr-8' : 'bg-purple-500/10 border-purple-500/20 ml-8'} ${resp.isRecalled ? 'opacity-60 border-red-500/30 bg-red-900/10' : ''}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className={`text-xs font-bold ${isStudent ? 'text-blue-300' : 'text-purple-300'}`}>
                                        {isStudent ? (resp.senderName || '学生') : (resp.adminName || resp.senderName || '系统管理员')}
                                        {resp.isRecalled && isSuperadmin && (
                                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] border ${resp.recalledByRole === 'superadmin' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                            {resp.recalledByRole === 'superadmin' ? '超管强制撤回' : '发出者已撤回'}
                                          </span>
                                        )}
                                      </span>
                                      
                                      <div className="flex items-center gap-2">
                                        {!resp.isRecalled && isAdmin && (resp.adminId === user?.id || isSuperadmin) && (
                                          <button onClick={(e) => { e.stopPropagation(); handleRecallMsg(feedback._id, resp._id); }} className="text-[10px] text-red-400/80 hover:text-red-400 transition-colors">
                                            撤回
                                          </button>
                                        )}
                                        <span className="text-[10px] text-purple-200/40">{new Date(resp.createdAt).toLocaleString('zh-CN')}</span>
                                      </div>
                                    </div>
                                    <p className="text-sm text-purple-100 whitespace-pre-wrap leading-relaxed">{resp.content}</p>
                                    <AttachmentViewer attachments={resp.attachments} />
                                  </div>
                                );
                              })}
                            </div>
                         )}
                          
                          <div className="space-y-3">
                            <textarea value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="添加处理回复..." className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 min-h-[100px]" />
                            <input type="file" multiple onChange={e => setSelectedReplyFiles(Array.from(e.target.files))} className="block w-full text-xs text-purple-200/60 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer" />
                            
                          <div className="flex flex-wrap gap-2">
                              {/* [修复] 使用三元运算符替代非法的 if 语句 */}
                              {!feedback.isRevoked ? (
                                <>
                                  {feedback.status !== 'processing' && ( <button onClick={() => updateStatus(feedback._id, 'processing')} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm transition-all">开始处理</button> )}
                                  {feedback.status !== 'resolved' && ( <button onClick={() => updateStatus(feedback._id, 'resolved')} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm transition-all">标记解决</button> )}
                                  {feedback.status !== 'rejected' && ( <button onClick={() => updateStatus(feedback._id, 'rejected')} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm transition-all">拒绝</button> )}
                                  <button onClick={() => updateStatus(feedback._id, feedback.status)} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm transition-all">仅添加回复</button>
                                </>
                              ) : (
                                <div className="text-xs text-gray-400 bg-gray-900/50 px-4 py-2 rounded-lg border border-gray-700/50">此反馈已被学生撤销，已锁定流转状态。</div>
                              )}
                            </div>  
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            </div>
          </>
        )}
      </section>

      {/* 底部信息 */}
      <div className="mt-6 text-center text-[10px] md:text-xs text-purple-200/40 px-4 transform scale-90 origin-center space-y-2 pb-6">
        <p>Copyright© 2026 BUCT SIE</p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 mt-1">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-purple-200 transition-colors">京ICP备2026010091号-1</a>
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=11011402055565" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-purple-200 transition-colors">
            <img src={beian} alt="公安" className="w-3 h-3 md:w-4 md:h-4" /> 京公网安备11011402055565号
          </a>
        </div>
      </div>

      {/* 动态加权核算器弹窗 */}
      {false && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-5xl p-6 relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <button onClick={() => setShowWeightCalc(false)} className="absolute top-4 right-4 text-purple-200/50 hover:text-white text-lg z-10">✕</button>
            
            <div className="flex flex-wrap items-center justify-between mb-4 pr-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><span>🧮</span> 期末分数动态加权结算器</h3>
              <button disabled={weighting} onClick={handleApplyWeighting} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                ✓ 确认并应用加权到总分
              </button>
            </div>
            
            <p className="text-xs text-purple-200/60 mb-6">公式：该板块结算分 = 该板块满分 × (已参加活动对应设定的权重之和) / 该板块内设定所有活动总次数(×1)</p>
            
            <div className="grid md:grid-cols-3 gap-6 flex-1 min-h-0">
              <div className="md:col-span-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                <div>
                  <label className="text-xs text-purple-200/60 mb-1 block">1. 选择需加权结算的板块</label>
                  <select value={calcDimension} onChange={e => setCalcDimension(e.target.value)} className="w-full px-3 py-2 bg-slate-950 rounded-lg text-white border border-white/10 outline-none focus:border-blue-500 transition-colors">
                    {Object.entries(PERF_DIMENSIONS).filter(([, value]) => Number.isFinite(Number(value.max))).map(([k, v]) => <option key={k} value={k}>{v.label} (满分 {v.max})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-purple-200/60 mb-1 block">2. 设定【该板块内所有活动总次数】分母</label>
                  <input type="number" min="1" value={totalActivitiesCount} onChange={e => setTotalActivitiesCount(Number(e.target.value))} className="w-full px-3 py-2 bg-slate-950 rounded-lg text-white border border-white/10 outline-none focus:border-blue-500" />
                </div>
                
                <div className="pt-4 border-t border-white/10">
                  <label className="text-xs text-blue-300 font-bold mb-2 block">3. 各活动名称及权重配置 (自动提取自流水)</label>
                  {[...new Set(performanceRecords.filter(r => r.dimension === calcDimension && r.activityName !== '期末系统加权').map(r => r.activityName || '未命名/常规记录'))].map((activity, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 mb-2 p-2 bg-white/5 rounded border border-white/5">
                      <span className="text-xs text-white truncate flex-1" title={activity}>{activity}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-purple-200/50">权重:</span>
                        <input type="number" step="0.1" min="0" value={weightConfig[activity] ?? 1} 
                          onChange={e => setWeightConfig({...weightConfig, [activity]: Number(e.target.value)})} 
                          className="w-14 px-1 py-1 bg-slate-950 rounded text-white text-xs border border-white/10 text-center outline-none focus:border-blue-500" />
                      </div>
                    </div>
                  ))}
                  {[...new Set(performanceRecords.filter(r => r.dimension === calcDimension && r.activityName !== '期末系统加权').map(r => r.activityName || '未命名/常规记录'))].length === 0 && (
                    <p className="text-xs text-purple-200/40 text-center py-4">当前学期该板块暂无任何有效流水记录</p>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-xl flex flex-col overflow-hidden">
                <div className="p-3 bg-blue-900/20 border-b border-white/10 shrink-0">
                  <span className="text-sm font-bold text-blue-300">📊 加权后预览榜单 (点击应用前仅作预览)</span>
                </div>
                <div className="overflow-y-auto p-0 flex-1 custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-900/50 sticky top-0 backdrop-blur text-purple-200/60 text-xs">
                      <tr><th className="py-2 pl-4">干事姓名</th><th className="py-2">有效参次记录</th><th className="py-2 text-blue-300">累计获得权重</th><th className="py-2 pr-4 font-bold text-white text-right">加权后覆盖得分</th></tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rosterMembers.map(v => {
                        const userRecords = performanceRecords.filter(r => r.volunteer?._id === v._id && r.dimension === calcDimension && !r.isCalibration && r.activityName !== '期末系统加权');
                        const activities = [...new Set(userRecords.filter(r => Number(r.score) > 0).map(r => r.activityName || `record:${r._id}`))];
                        const attendedWeight = activities.reduce((sum, name) => sum + Number(weightConfig[name] ?? 1), 0);
                        const maxScore = Number(PERF_DIMENSIONS[calcDimension]?.max) || 0;
                        const finalScore = Math.min(maxScore, maxScore * attendedWeight / (totalActivitiesCount || 1));
                        return { user: v, count: activities.length, weight: attendedWeight, score: finalScore };
                      }).sort((a, b) => b.score - a.score).map((data, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="py-3 pl-4 font-medium text-white">{data.user.name}</td>
                          <td className="py-3 text-purple-200/60">{data.count} 条记录</td>
                          <td className="py-3 font-mono text-blue-300">{data.weight.toFixed(1)}</td>
                          <td className="py-3 pr-4 text-right text-lg font-bold text-green-400">{data.score.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

     {/* [新增] 管理本学期成员名单弹窗 */}
      {false && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] transition-colors">
            <button onClick={() => setShowRosterModal(false)} className="absolute top-4 right-4 text-purple-400 dark:text-purple-200/50 hover:text-slate-800 dark:hover:text-white text-lg transition-colors">✕</button>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 pr-8 flex items-center gap-2"><span>👥</span> 管理本学期成员名单</h3>
            <p className="text-xs text-slate-500 dark:text-purple-200/60 mb-4">
              学期：<span className="font-bold text-purple-600 dark:text-purple-300">{selectedSemester || currentSemester}</span>
              　勾选后即为本学期参与绩效核算的成员（来源：子管理员账号）。
            </p>

            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-slate-500 dark:text-purple-200/50">已选 {rosterSelection.length} / {volunteers.length} 人</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setRosterSelection(volunteers.map(v => v._id))} className="text-purple-600 dark:text-purple-300 hover:underline">全选</button>
                <button type="button" onClick={() => setRosterSelection([])} className="text-slate-500 dark:text-purple-200/50 hover:underline">清空</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-white/10 p-2 space-y-1">
              {volunteers.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-purple-200/40 text-center py-8">
                  {user?.isUltimateAdmin ? '暂无子管理员账号，请先在「账号管理面板」中将学生升级为管理员。' : '你的分管部门内暂无可纳入绩效名单的志愿者账号。'}
                </p>
              ) : (
                volunteers.map(v => (
                  <label key={v._id} className="flex items-center gap-3 text-sm text-slate-800 dark:text-white hover:bg-slate-200/50 dark:hover:bg-white/5 p-2 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      className="accent-purple-500"
                      checked={rosterSelection.includes(v._id)}
                      onChange={(e) => {
                        if (e.target.checked) setRosterSelection([...rosterSelection, v._id]);
                        else setRosterSelection(rosterSelection.filter(id => id !== v._id));
                      }}
                    />
                    <span className="font-medium">{v.name}</span>
                    <span className="text-xs font-mono text-slate-400 dark:text-purple-200/40">{v.studentId}</span>
                  </label>
                ))
              )}
            </div>

            <div className="pt-4 flex justify-end gap-2">
              <button onClick={() => setShowRosterModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-purple-200/70 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-sm">取消</button>
              <button onClick={handleSaveRoster} className="px-5 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all font-medium shadow-lg shadow-purple-500/20 text-sm">保存名单</button>
            </div>
          </div>
        </div>
      )}

     {/* 全局设置弹窗 */}
      {false && showSettingsModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl transition-colors">
            <button onClick={() => setShowSettingsModal(false)} className="absolute top-4 right-4 text-purple-400 dark:text-purple-200/50 hover:text-slate-800 dark:hover:text-white text-lg transition-colors">✕</button>
            <div className="flex mb-6 p-1 bg-slate-100 dark:bg-white/5 rounded-xl w-full border border-slate-200 dark:border-transparent transition-colors">
              <button onClick={() => setSettingsTab('profile')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${settingsTab === 'profile' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 dark:text-purple-200/60 hover:text-slate-800 dark:hover:text-white'}`}>个人资料</button>
              <button onClick={() => setSettingsTab('password')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${settingsTab === 'password' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 dark:text-purple-200/60 hover:text-slate-800 dark:hover:text-white'}`}>修改密码</button>
            </div>
            {settingsTab === 'profile' ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">学号</label>
                    <input type="text" required value={profileData.studentId} readOnly className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">姓名</label>
                    <input type="text" required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">邮箱</label>
                  <input type="email" required value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">手机号</label>
                  <input type="text" value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all font-medium shadow-lg shadow-purple-500/20">保存资料修改</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">当前密码</label>
                  <input type="password" required value={pwdData.current} onChange={e => setPwdData({...pwdData, current: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="输入当前使用的密码" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-slate-600 dark:text-purple-200/80 transition-colors">新密码</label>
                  <input type="password" required value={pwdData.new} onChange={e => setPwdData({...pwdData, new: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="设置新密码（至少6位）" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-all font-medium shadow-lg shadow-purple-500/20">确认修改密码</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
      </main>
    </div>
  );
}
