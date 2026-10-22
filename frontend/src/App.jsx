import AdminDashboard, { OrganizationFrameworkPanel } from './AdminDashboard';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Check, ChevronRight,
  Download,
  GraduationCap, House, IdCard, ImagePlus, KeyRound, LayoutDashboard, LockKeyhole,
  LogOut, MessageCircleMore, MessagesSquare, Palette, Paperclip, Plus, Send,
  ShieldCheck, Smartphone, Sparkles, SquarePen, Utensils, UserRound,
  X, BedDouble, Eye, EyeOff, Moon, Sun, Info, Route, Clock3, PhoneCall,
  Building2, ChevronLeft, FileText, Flag, HeartHandshake, Megaphone,
  Network, Paintbrush, Scale, Trophy, UsersRound, Wrench
} from 'lucide-react';
import sieLogo from './assets/LOGO_1.png';
import siehubLogo from './assets/SIEHUB_LOGO.png';
import siebridgeLogo from './assets/SIEBridge_LOGO.png';
import collegeLogo from './assets/SIE_LOGO.svg';
import buctLogo from './assets/BUCT_LOGO_blue.png';
import beianIcon from './assets/beian.png';
import { API_BASE, readStoredToken, persistSessionToken, clearSessionToken, subscribeSessionChanges, requestJson, uploadFeedbackFiles, resolveMediaUrl } from './api';
import AttachmentViewer from './AttachmentViewer';
import FeedbackPagination from './FeedbackPagination';
import DepartmentPerformanceParticipation from './DepartmentPerformanceParticipation';
import { responseSenderLabel } from './feedbackState';
import { nextTranslatedValue } from './languageState';
import { emptyFeedbackDraft, feedbackDraftStore } from './feedbackDraft';
import { ServiceHealthNote, formatAverageFirstResponse, usePlatformClock, useServiceMetrics } from './platformStatus';
import { defaultSievoxPortalView, getSievoxPortalRole, resolveSievoxPortalView } from './sievoxPortal';
import { SIEBridgeReviewWorkspace, SIEBridgeStudentPortal } from './SIEBridge';
import {
  DepartmentIntroductionEditor,
  DepartmentIntroductionEntryCard,
  DepartmentIntroductionViewer
} from './DepartmentIntroduction';

export const CATEGORIES_CONFIG = {
  academic: {
    label: '教学教务',
    short: '教学',
    icon: GraduationCap,
    tileClass: 'academic',
    desc: '课程、考试与学籍',
    sub: ['课程与教学管理', '学辅答疑与讲座安排', '考试与成绩管理', '发展与规划指导', '学籍与培养方案', '设施维修与维护', '其他教学相关']
  },
  accommodation: {
    label: '宿舍住宿',
    short: '住宿',
    icon: BedDouble,
    tileClass: 'housing',
    desc: '环境与生活服务',
    sub: ['住宿环境与管理', '生活配套服务', '其他宿舍相关']
  },
  catering: {
    label: '餐饮服务',
    short: '餐饮',
    icon: Utensils,
    tileClass: 'dining',
    desc: '食品、价格与运营',
    sub: ['食品安全与卫生', '菜品与价格管理', '食堂运营与服务', '其他餐饮相关']
  },
  safety: {
    label: '安全保卫',
    short: '安全',
    icon: ShieldCheck,
    tileClass: 'safety',
    desc: '人身、消防与网络',
    sub: ['人身与财产安全', '消防安全与隐患', '交通与出行安全', '网络与信息安全', '其他安全相关']
  },
  comprehensive: {
    label: '综合服务',
    short: '综合',
    icon: Sparkles,
    tileClass: 'service',
    desc: '活动、心理与行政',
    sub: ['学院活动与文化建设', '心理健康与成长支持', '行政服务与流程优化', '校园公共设施与环境', '其他未分类诉求']
  }
};

const STATUS_META = {
  pending: { label: '待受理', className: 'pending' },
  processing: { label: '处理中', className: 'processing' },
  resolved: { label: '已解决', className: 'resolved' },
  rejected: { label: '已拒绝', className: 'pending' }
};

const ICP_RECORD_URL = 'https://beian.miit.gov.cn/';
const POLICE_RECORD_URL = 'https://beian.mps.gov.cn/#/query/webSearch?code=11011402055565';

const SiteLegalFooter = ({ compact = false }) => (
  <footer className={`siehub-site-legal-footer${compact ? ' is-compact' : ''}`}>
    <div className="siehub-site-legal-brand">Copyright© 2026 BUCT SIE</div>
    <div className="siehub-site-legal-links">
      <a href={ICP_RECORD_URL} target="_blank" rel="noreferrer">京ICP备2026010091号-1</a>
      <a href={POLICE_RECORD_URL} target="_blank" rel="noreferrer">
        <img src={beianIcon} alt="公安备案图标" />
        <span>京公网安备11011402055565号</span>
      </a>
    </div>
  </footer>
);

const PRIORITY_LABEL = {
  low: '低',
  normal: '普通',
  high: '高',
  urgent: '紧急'
};

const THEME_COLORS = [
  { key: 'purple', label: '典雅紫', value: '#6750A4' },
  { key: 'blue', label: '海洋蓝', value: '#1A6CE3' },
  { key: 'green', label: '森林绿', value: '#4A8D3F' },
  { key: 'orange', label: '暖阳橙', value: '#C85100' },
  { key: 'teal', label: '青碧色', value: '#007B7B' }
];

const cls = (...items) => items.filter(Boolean).join(' ');
const PRIVACY_NOTICE_KEY = 'siehub_privacy_notice_v1';
const LANGUAGE_KEY = 'siehub_language_v1';
const SIEVOX_URL = import.meta.env.VITE_SIEVOX_URL || '';
const SIEBRIDGE_URL = import.meta.env.VITE_SIEBRIDGE_URL || '';
const SIEVOX_HOST = (() => {
  try {
    return SIEVOX_URL ? new URL(SIEVOX_URL).host.toLowerCase() : '';
  } catch {
    return '';
  }
})();
const SIEBRIDGE_HOST = (() => {
  try {
    return SIEBRIDGE_URL ? new URL(SIEBRIDGE_URL).host.toLowerCase() : '';
  } catch {
    return '';
  }
})();
const currentHost = typeof window !== 'undefined' ? window.location.host.toLowerCase() : '';
const isCurrentHost = (targetHost) => Boolean(targetHost && currentHost === targetHost);
const SIEHUB_NAMED_PATHS = {
  hub: '/',
  departments: '/departments',
  department: '/departments',
  sievox: '/rights',
  siebridge: '/siebridge',
  my: '/account',
  ultimateOrganization: '/organization'
};
const getSurfaceFromPath = (pathname = '') => {
  const normalized = String(pathname || '').replace(/\/+$/, '').toLowerCase() || '/';
  if (normalized === '/departments') return 'departments';
  if (normalized === '/rights') return 'sievox';
  if (normalized === '/siebridge') return 'siebridge';
  if (normalized === '/account') return 'my';
  if (normalized === '/organization') return 'ultimateOrganization';
  return '';
};
const getPathForSurface = (surface = '') => SIEHUB_NAMED_PATHS[surface] || '/';
const getInitialDepartmentModuleFromLocation = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search || '');
  const rawKey = params.get('module') || params.get('department') || params.get('key') || '';
  const normalizedKey = rawKey.replace(/-/g, '_');
  return findSIEHUBModuleByKey(normalizedKey);
};
const getUrlForSIEHUBState = (surface = 'hub', activeModule = null) => {
  const path = getPathForSurface(surface);
  if (surface === 'department' && activeModule?.key) {
    return `${path}?module=${encodeURIComponent(activeModule.key)}`;
  }
  return path;
};
const getCurrentPathSurface = () => {
  if (typeof window === 'undefined') return '';
  return getSurfaceFromPath(window.location.pathname);
};

const EN_TRANSLATIONS = {
  'SIEBridge 课程资源共享平台': 'SIEBridge Course Resource Sharing Platform',
  '添加课程': 'Add Course',
  '输入课程代码或课程名称': 'Search by course code or course name',
  '全部专业': 'All majors',
  '全部年级': 'All grades',
  '机械设计制造及其自动化': 'Mechanical Design, Manufacturing and Automation',
  '生物工程': 'Bioengineering',
  '工业设计': 'Industrial Design',
  '大一': 'Year 1',
  '大二': 'Year 2',
  '大三': 'Year 3',
  '大四': 'Year 4',
  '往年真题': 'Past Exams',
  '课件': 'Courseware',
  '笔记整理': 'Notes',
  '其他资料': 'Other Resources',
  '上传资料': 'Upload Resource',
  '我的上传审核情况': 'My Upload Review Status',
  '课程资源审核工作台': 'Course Resource Review Workspace',
  '课程申请': 'Course Request',
  '资料申请': 'Resource Request',
  '待审核': 'Pending',
  '已通过': 'Approved',
  '已驳回': 'Rejected',
  '通过': 'Approve',
  '驳回': 'Reject',
  '预览': 'Preview',
  '下载': 'Download',
  '添加课程并上传资料': 'Add Course and Upload Resource',
  '课程代码': 'Course Code',
  '课程名称': 'Course Name',
  '课程性质': 'Course Nature',
  '上传者自行填写，如专业必修/公共选修': 'Enter freely, such as major required or public elective',
  '所属专业': 'Major',
  '适用年级': 'Applicable Grade',
  '资料分区': 'Resource Section',
  '资料标题': 'Resource Title',
  '说明': 'Notes',
  '上传课程资料': 'Upload Course Resource',
  '选择资料文件': 'Choose Resource File',
  '审核通过后才会在学生端展示': 'Visible to students only after approval',
  '提交审核': 'Submit for Review',
  '北京化工大学': 'Beijing University of Chemical Technology',
  '国际教育学院': 'School of International Education',
  '一处登录，抵达所有学生工作模块。': 'One sign-in for every student work module.',
  'SIEHUB 作为一级生活平台，统一承载团委、学生会各部门子平台。': 'SIEHUB serves as the main student life platform for Youth League and Student Union departments.',
  '统一身份认证': 'Unified Identity Verification',
  '进入 SIEHUB': 'Enter SIEHUB',
  '申请学生账号': 'Create Student Account',
  '输入账号与密码，完成统一身份认证后进入 SIEHUB。': 'Enter your account and password to access SIEHUB after identity verification.',
  '首次使用请完成校内身份信息登记，账号创建后从 SIEHUB 统一登录。': 'For first-time use, complete campus identity registration and sign in through SIEHUB.',
  '登录信息仅用于校内身份核验、权限确认与平台安全审计。': 'Login information is used only for campus identity verification, permission checks, and security audits.',
  '学号 / 账号': 'Student ID / Account',
  '请输入学号': 'Enter student ID',
  '姓名': 'Name',
  '请输入真实姓名': 'Enter your real name',
  '邮箱': 'Email',
  '请输入邮箱': 'Enter email address',
  '邮箱验证码': 'Email verification code',
  '请输入6位邮箱验证码': 'Enter the 6-digit email code',
  '发送验证码': 'Send code',
  '重新发送': 'Resend',
  '密码': 'Password',
  '请输入密码': 'Enter password',
  '确认密码': 'Confirm password',
  '请再次输入密码': 'Enter password again',
  '保持登录': 'Keep me signed in',
  '忘记密码？': 'Forgot password?',
  '创建 SIEHUB 学生账号': 'Create SIEHUB student account',
  '首次使用 SIEHUB？': 'First time using SIEHUB?',
  '创建学生账号': 'Create account',
  '已有账号？': 'Already have an account?',
  '返回登录': 'Back to sign in',
  '正在验证身份…': 'Verifying identity...',
  '注册成功，请登录': 'Registration complete. Please sign in.',
  '我已阅读并同意': 'I have read and agree to ',
  '《隐私条款》': 'Privacy Terms',
  '隐私条款': 'Privacy Terms',
  '隐私保护': 'Privacy',
  '使用帮助': 'Help',
  'SIEHUB 统一身份安全认证': 'SIEHUB Unified Identity Security',
  '个人信息仅用于校内身份核验、部门工作协同与服务进度通知。': 'Personal information is used only for campus verification, departmental collaboration, and service notifications.',
  '找回密码': 'Reset password',
  '绑定邮箱': 'Bound email',
  '请输入绑定邮箱': 'Enter your bound email',
  '新密码': 'New password',
  '请输入新密码': 'Enter a new password',
  '确认新密码': 'Confirm new password',
  '重置密码': 'Reset password',
  '关闭': 'Close',
  '验证码已发送，请查看邮箱。': 'Verification code sent. Please check your email.',
  '开发环境验证码已生成，请查看后端日志。': 'Development code generated. Please check backend logs.',
  '密码已重置，请使用新密码登录。': 'Password reset. Please sign in with the new password.',
  '请先阅读并勾选同意《隐私条款》后再继续。': 'Please read and agree to the Privacy Terms before continuing.',
  '两次输入的密码不一致': 'The two passwords do not match.',
  '无法连接 SIEHUB 后端，请确认本地服务已启动。': 'Cannot connect to the SIEHUB backend. Please confirm the local service is running.',
  '一处入口，连接每一份学生工作。': 'One entry point for every student work stream.',
  '全平台治理范围': 'Full platform governance',
  '学生服务': 'Student services',
  '可访问模块': 'Accessible modules',
  '平台治理': 'Platform governance',
  '团委': 'Youth League',
  '学生会': 'Student Union',
  '组织治理中枢': 'Organization Governance Hub',
  '组织部': 'Organization Department',
  '宣传部': 'Publicity Department',
  '实践部': 'Practice Department',
  '志愿者工作部': 'Volunteer Service Department',
  '综合办公室': 'General Office',
  '学生权益部': 'Student Rights Department',
  '文体艺术部': 'Culture, Sports and Arts Department',
  '学术科技部': 'Academic and Technology Department',
  '新媒体工作部': 'New Media Department',
  '部门工作台会按照当前身份与分管范围开放': 'Department workspaces open according to your identity and assigned scope.',
  '终极管理员已获得全部模块访问权限': 'Ultimate administrators have access to all modules.',
  '部门负责人及以上成员可在所属模块中维护志愿者绩效考核制度；具体业务能力将随模块逐步上线。': 'Department heads and above can maintain volunteer performance policies; more capabilities will roll out by module.',
  '返回 SIEHUB': 'Back to SIEHUB',
  '返回模块总览': 'Back to module overview',
  '学生端': 'Student portal',
  '管理端': 'Admin portal',
  '超级管理员': 'Super admin',
  '权益工作台': 'Rights dashboard',
  '我的反馈': 'My feedback',
  '服务指南': 'Service guide',
  '当前登录身份': 'Current identity',
  '外观设置': 'Appearance',
  '退出登录': 'Sign out',
  '退出': 'Sign out',
  '学生权益反馈系统': 'Student Rights Feedback System',
  '学生权益反馈': 'Student rights feedback',
  '反馈通道正常': 'Feedback channel online',
  '本学期平均首次响应': 'Average first response this semester',
  '发起反馈': 'New feedback',
  '绩效管理': 'Performance management',
  '教学教务': 'Academic affairs',
  '宿舍住宿': 'Dormitory',
  '餐饮服务': 'Dining services',
  '安全保卫': 'Safety and security',
  '综合服务': 'General services',
  '待处理': 'Pending',
  '处理中': 'Processing',
  '已解决': 'Resolved',
  '已拒绝': 'Rejected',
  '提交反馈': 'Submit feedback',
  '发送': 'Send',
  '取消': 'Cancel',
  '保存': 'Save',
  '编辑': 'Edit',
  '删除': 'Delete',
  '撤回': 'Recall',
  '确认': 'Confirm',
  '暂无新消息': 'No new messages',
  '消息通知': 'Notifications',
  '全部标为已读': 'Mark all as read',
  '个人设置': 'Profile settings',
  '绑定信息': 'Bound information',
  '修改密码': 'Change password',
  '发送中': 'Sending',
  '正在重置': 'Resetting',
  '确认修改密码': 'Confirm password change',
  '请输入唯一绑定邮箱': 'Enter a unique bound email',
  '请输入6位验证码': 'Enter the 6-digit code',
  '请再次输入新密码': 'Enter the new password again',
  '使用账号绑定邮箱接收验证码，校验通过后即可设置新密码。': 'Receive a verification code through the email bound to your account, then set a new password after verification.',
  '暂不同意': 'Not now',
  '已阅读并同意': 'I have read and agree',
  '终极管理员': 'Ultimate admin',
  '管理员': 'Admin',
  '学生': 'Student',
  '请输入有效邮箱。': 'Please enter a valid email address.',
  '验证码发送失败': 'Failed to send the verification code.',
  '验证码发送失败，请确认后端服务已启动。': 'Failed to send the verification code. Please confirm that the backend service is running.',
  '验证码已发送至绑定邮箱。': 'Verification code sent to the bound email.',
  '请先输入绑定邮箱。': 'Please enter your bound email first.',
  '两次输入的新密码不一致。': 'The new passwords do not match.',
  '密码重置失败': 'Password reset failed.',
  '密码重置失败，请确认后端服务已启动。': 'Password reset failed. Please confirm that the backend service is running.',
  '学生账号学号必须为唯一的10位数字。': 'Student IDs must be unique 10-digit numbers.',
  '请输入6位邮箱验证码。': 'Please enter the 6-digit email verification code.',
  '登录失败': 'Sign-in failed',
  '注册失败': 'Registration failed',
  '刚刚': 'Just now',
  '附件': 'Attachment',
  '深浅色切换': 'Toggle light/dark mode',
  '浅色模式': 'Light mode',
  '深色模式': 'Dark mode',
  '主题色': 'Theme color',
  '模式': 'Mode',
  '外观选择会自动保存在当前浏览器中。': 'Appearance preferences are saved in this browser.',
  '典雅紫': 'Classic purple',
  '海洋蓝': 'Ocean blue',
  '森林绿': 'Forest green',
  '暖阳橙': 'Warm orange',
  '青碧色': 'Teal',
  '课程、考试与学籍': 'Courses, exams, and academic records',
  '环境与生活服务': 'Living environment and services',
  '食品、价格与运营': 'Food, pricing, and operations',
  '人身、消防与网络': 'Personal, fire, and network safety',
  '活动、心理与行政': 'Activities, wellbeing, and administration',
  '课程与教学管理': 'Course and teaching management',
  '学辅答疑与讲座安排': 'Academic support and lecture scheduling',
  '考试与成绩管理': 'Exams and grades',
  '发展与规划指导': 'Development and planning guidance',
  '学籍与培养方案': 'Academic records and development plans',
  '设施维修与维护': 'Facility repair and maintenance',
  '其他教学相关': 'Other academic matters',
  '住宿环境与管理': 'Housing environment and management',
  '生活配套服务': 'Living support services',
  '其他宿舍相关': 'Other housing matters',
  '食品安全与卫生': 'Food safety and hygiene',
  '菜品与价格管理': 'Menu and pricing management',
  '食堂运营与服务': 'Dining operations and services',
  '其他餐饮相关': 'Other dining matters',
  '人身与财产安全': 'Personal and property safety',
  '消防安全与隐患': 'Fire safety and hazards',
  '交通与出行安全': 'Traffic and travel safety',
  '网络与信息安全': 'Network and information security',
  '其他安全相关': 'Other safety matters',
  '学院活动与文化建设': 'School activities and cultural development',
  '心理健康与成长支持': 'Wellbeing and growth support',
  '行政服务与流程优化': 'Administrative services and process improvement',
  '校园公共设施与环境': 'Campus facilities and environment',
  '其他未分类诉求': 'Other requests',
  '综合服务与其他': 'General services and other',
  '较低': 'Low',
  '一般': 'Normal',
  '高优先级': 'High priority',
  '业务反馈处理': 'Feedback processing',
  '清空筛选': 'Clear filters',
  '待办队列': 'Task queue',
  '事项': 'Item',
  '提交人': 'Submitted by',
  '优先级': 'Priority',
  '更新时间': 'Updated',
  '搜索学生、标题或编号': 'Search students, titles, or IDs',
  '全部': 'All',
  '加载中...': 'Loading...',
  '暂无反馈事项': 'No feedback items',
  '匿名学生': 'Anonymous student',
  '身份受保护': 'Identity protected',
  '校内账号': 'Campus account',
  '已撤回': 'Recalled',
  '学生已撤回': 'Student recalled',
  '提交时间': 'Submitted at',
  '当前状态': 'Current status',
  '系统管理员': 'System administrator',
  '此消息已撤回': 'This message was recalled',
  '状态更新': 'Status update',
  '回复学生': 'Reply to student',
  '输入处理进展或需要学生补充的信息…': 'Enter progress or information needed from the student...',
  '发送回复': 'Send reply',
  '开始处理': 'Start processing',
  '标记为已解决': 'Mark as resolved',
  '拒绝': 'Reject',
  '请选择左侧事项查看详情': 'Select an item on the left to view details',
  '人员与权限': 'People and permissions',
  '统一管理学生、志愿者、部门负责人/团委学生兼职团干部，以及主席团/团委学生兼职副书记的账号入口。': 'Manage accounts for students, volunteers, department heads, Youth League cadres, presidium members, and deputy secretaries.',
  '输入学号升级为志愿者': 'Enter a student ID to promote to volunteer',
  '确认设为志愿者': 'Promote to volunteer',
  '管理员队列': 'Administrator queue',
  '学生账户': 'Student accounts',
  '暂无管理员账号': 'No administrator accounts',
  '暂无学生账号': 'No student accounts',
  '操作审计': 'Action audit',
  '人员管理轨迹': 'People management trail',
  '权限总览': 'Permission overview',
  '账号': 'Accounts',
  '归档': 'Archive',
  '赋予管理员权限': 'Grant administrator access',
  '输入要升级的学生学号': 'Enter the student ID to promote',
  '确认设为管理员': 'Promote to administrator',
  '子管理员账号': 'Sub-administrator accounts',
  '人员': 'Person',
  '操作': 'Action',
  '日志': 'Logs',
  '重置': 'Reset',
  '降级': 'Demote',
  '查阅': 'View',
  '升级': 'Promote',
  '注销': 'Deactivate',
  '暂无记录': 'No records',
  '匿名提交': 'Anonymous submission',
  '处理了问题': 'Processed an issue',
  '提交了问题': 'Submitted an issue',
  '处理目标': 'Processing target',
  '问题描述': 'Issue description',
  '考核维度': 'Assessment dimension',
  '封顶分': 'Maximum points',
  '加分标准 (每次/每周)': 'Scoring standard (per action/week)',
  '考勤积分': 'Attendance points',
  '活动贡献': 'Activity contribution',
  '权益跟进': 'Rights follow-up',
  '文案与策划': 'Copywriting and planning',
  '其他常规': 'Other routine work',
  '特别加分': 'Bonus points',
  '删除届次': 'Delete cohort',
  '成员身份与分管部门': 'Member roles and managed departments',
  '生成归档预览': 'Generate archive preview',
  '确认归档': 'Confirm archive',
  '选择成员账号': 'Select member account',
  '选择所属组织与部门': 'Select organization and department',
  '清空编辑': 'Clear editing',
  '当前届': 'Current cohort',
  '草稿届次': 'Draft cohort',
  '未绑定绩效学期': 'No performance semester bound',
  '暂无届次，请先创建': 'No cohorts yet. Create one first.',
  '当前届次': 'Current cohort',
  '未选择': 'Not selected',
  '历史档案只读，不能继续编辑成员': 'Historical archives are read-only; members cannot be edited.',
  '部门负责人层级需要选择所属组织和部门': 'Department-head roles must select an organization and department.',
  '主席团层级通过下方选择多个分管部门': 'Presidium-level roles can select multiple managed departments below.',
  '该身份无需绑定组织部门': 'This identity does not need an organization or department.',
  '分管部门，可多选': 'Managed departments, multiple selection allowed',
  '当前届次暂无成员': 'No members in the current cohort.',
  '所属部门': 'Department',
  '分管部门': 'Managed departments',
  '绩效快照': 'Performance snapshot',
  '归档预览': 'Archive preview',
  '部门介绍': 'Department introduction',
  '部门服务信息将在此持续补充。': 'Department service information will continue to be added here.',
  '学生服务入口': 'Student service entry',
  '进入 SIEVOX 系统': 'Enter SIEVOX',
  '学生权益反馈、诉求跟进与处理进度查询直接进入 SIEVOX 完成。': 'Use SIEVOX directly for student rights feedback, request follow-up, and progress tracking.',
  '按专业与年级查找课程资料，上传真题、课件和笔记并查看审核进度。': 'Find course resources by major and grade, upload exams, courseware, and notes, and track review progress.',
  '返回学生服务入口': 'Back to Student Service Entry',
  '立即进入': 'Enter now',
  '该部门学生侧服务后续将在 SIEHUB 内逐步上线。': 'Student-facing services for this department will gradually launch in SIEHUB.',
  '通知与活动': 'Notices and activities',
  '面向学生的通知、报名、活动材料与服务进度将集中展示。': 'Student notices, sign-ups, activity materials, and service progress will be shown in one place.',
  '查看介绍': 'View intro',
  '部门介绍编辑': 'Department intro editor',
  '使用受控区块搭建学生端部门介绍页，支持中英文文本、图片与视频。': 'Build the student-facing department intro page with controlled blocks, bilingual text, images and videos.',
  '进入编辑': 'Edit',
  'SIEBridge 审核': 'SIEBridge review',
  '课程新增与资料上传申请在此集中审核，通过后展示到学生端。': 'Review course and resource submissions here before they appear to students.',
  '已接入': 'Connected',
  '顶部封面': 'Hero cover',
  '文本介绍': 'Text section',
  '图片展示': 'Image block',
  '视频展示': 'Video block',
  '部门职责': 'Responsibilities',
  '联系方式': 'Contact',
  '组件库': 'Block library',
  '区块顺序': 'Block order',
  '发布记录': 'Publish history',
  '暂无发布记录': 'No publish history yet',
  '加载编辑器中...': 'Loading editor...',
  '返回管理端': 'Back to manage portal',
  '保存草稿': 'Save draft',
  '保存中': 'Saving',
  '发布': 'Publish',
  '发布中': 'Publishing',
  '标题': 'Title',
  '副标题': 'Subtitle',
  '正文': 'Body',
  '替代文本': 'Alt text',
  '职责': 'Responsibility',
  '标签': 'Label',
  '内容': 'Content',
  '添加职责': 'Add responsibility',
  '添加联系方式': 'Add contact',
  '上传图片': 'Upload image',
  '上传视频': 'Upload video',
  '上传中...': 'Uploading...',
  '显示': 'Visible',
  '隐藏': 'Hidden',
  '草稿已保存。': 'Draft saved.',
  '部门介绍页已发布。': 'Department intro page published.',
  '媒体已上传，记得保存草稿。': 'Media uploaded. Remember to save the draft.',
  '至少保留一个区块。': 'Keep at least one block.'
};

Object.assign(EN_TRANSLATIONS, {
  '未知大小': 'Unknown size',
  '未分类': 'Uncategorized',
  '请求失败': 'Request failed',
  '未知上传者': 'Unknown uploader',
  '资料文件': 'Resource file',
  '请输入课程名称': 'Enter the course name',
  '请输入资料标题': 'Enter the resource title',
  '如 2024 春季期末真题': 'e.g. Spring 2024 final exam',
  '如 MECH101': 'e.g. MECH101',
  '可补充课程教师、考试年份、资料来源说明等': 'Add the instructor, exam year, or source notes',
  '可补充年份、版本、适用范围等': 'Add the year, version, or intended audience',
  '支持 PDF、Word、PPT、Excel、ZIP，单个不超过 50MB': 'PDF, Word, PPT, Excel, and ZIP; max 50 MB per file',
  '请上传至少一份课程资料': 'Upload at least one course resource',
  '请上传至少一份资料': 'Upload at least one resource',
  '课程与资料已提交审核': 'Course and resources submitted for review',
  '资料已提交审核': 'Resource submitted for review',
  '该资料暂不支持在线预览': 'This resource does not support online preview',
  '下载失败': 'Download failed',
  '暂无已通过资料': 'No approved resources yet',
  '选择一门课程': 'Select a course',
  '课程资料会按往年真题、课件、笔记整理分区展示。': 'Course resources are grouped into past exams, courseware, and notes.',
  '暂无课程': 'No courses yet',
  '可以添加课程并提交资料等待审核。': 'Add a course and submit resources for review.',
  '暂无提交记录': 'No submissions yet',
  '请输入驳回原因': 'Enter a reason for rejection',
  '正在加载审核队列…': 'Loading the review queue…',
  '当前筛选下没有需要显示的审核项。': 'No review items match the current filter.',
  '预览 PDF': 'Preview PDF',
  '课程申请': 'Course request',
  '资料申请': 'Resource request',
  '课程': 'Course',
  '资料': 'Resource',
  '终极管理员 · 组织框架': 'Ultimate Administrator · Organization Framework',
  '团委学生会架构': 'Youth League & Student Union Structure',
  '团委与学生会分开管理，主席团成员 / 团委学生兼职副书记可分管多个部门，部门负责人层级只拥有对应部门权限。': 'The Youth League and Student Union are managed separately. Presidium members and deputy secretaries may oversee multiple departments, while department heads only access their assigned department.',
  '组织': 'Organization',
  '部门': 'Department',
  '当前届成员': 'Current cohort members',
  '对应负责人标签：': 'Responsible role: ',
  '身份与权限映射': 'Identity & Permission Mapping',
  '仅提交与查看自己的反馈': 'Submit and view your own feedback only',
  '子管理员端': 'Sub-admin portal',
  '处理反馈并查看本人绩效': 'Process feedback and view your own performance',
  '部门负责人 / 团委学生兼职团干部': 'Department head / Youth League cadre',
  '管理所属单一部门': 'Manage one assigned department',
  '主席团成员 / 团委学生兼职副书记': 'Presidium member / deputy secretary',
  '管理被分配的多个分管部门': 'Manage multiple assigned departments',
  '届次与归档': 'Cohorts & Archive',
  '例：2026届团委学生会': 'e.g. 2026 Youth League & Student Union',
  '包含绩效学期，可用空格或逗号分隔': 'Performance semesters, separated by spaces or commas',
  '创建届次': 'Create cohort',
  '删除会移除当前届次及其成员归档记录，需输入完整届次名称和“确认删除”。': 'Deleting removes this cohort and its archived member records. Enter the full cohort name and “确认删除” to continue.',
  '删除当前届次': 'Delete current cohort',
  '当前届次：': 'Current cohort: ',
  '生成归档预览': 'Generate archive preview',
  '确认归档': 'Confirm archive',
  '选择成员账号': 'Select member account',
  '选择所属组织与部门': 'Select organization and department',
  '主席团层级通过下方选择多个分管部门': 'Presidium roles can select multiple managed departments below',
  '该身份无需绑定组织部门': 'This identity does not require an organization or department',
  '分管部门，可多选': 'Managed departments (multi-select)',
  '保存成员身份与分管部门': 'Save member role & managed departments',
  '清空编辑': 'Clear form',
  '当前届次暂无成员': 'No members in the current cohort',
  '归档预览': 'Archive preview',
  '身份': 'Identity',
  '绩效': 'Performance',
  '人员与权限': 'People & Permissions',
  '获取用户列表失败': 'Failed to load users',
  '未找到该学号的用户': 'No user found for this student ID',
  '该账号已降级为普通学生': 'The account has been demoted to a regular student',
  '权限不足：仅超级管理员可注销账号': 'Permission denied: only super admins can deactivate accounts',
  '危险操作：确定要彻底注销并抹除该账号吗？此操作不可逆！': 'Dangerous action: permanently deactivate and erase this account? This cannot be undone.',
  '该账号已从系统中彻底注销': 'The account has been permanently deactivated',
  '网络通信错误': 'Network communication error',
  '密码无效或取消操作': 'Invalid password or action cancelled',
  '密码重置成功': 'Password reset successfully',
  '获取记录失败': 'Failed to load records',
  '获取日志失败': 'Failed to load logs',
  '管理员队列': 'Administrator queue',
  '学生账户': 'Student accounts',
  '操作审计': 'Action audit',
  '人员管理轨迹': 'People management trail',
  '权限总览': 'Permission overview',
  '包含志愿者、超级管理员与终极管理员视角可管理人员。': 'Includes volunteers, super admins, and ultimate-admin managed accounts.',
  '可查看学生反馈、重置密码、升级为志愿者或注销账户。': 'View feedback, reset passwords, promote volunteers, or deactivate accounts.',
  '组织届次归档联动': 'Organization cohort archive linkage',
  '角色最终以团委学生会架构里的身份分配与届次归档为准。': 'Final roles follow the assignments and cohort archives in the Youth League & Student Union structure.',
  '超管': 'Super admin',
  '志愿者': 'Volunteer',
  '危险操作：删除届次会同时删除该届次下': 'Dangerous action: deleting this cohort also removes',
  '请输入届次完整名称以继续：': 'Enter the full cohort name to continue: ',
  '请再次输入“确认删除”四个字完成最终确认：': 'Type “确认删除” again for final confirmation: ',
  '届次名称输入不一致，已取消删除': 'Cohort name mismatch. Deletion cancelled.',
  '最终确认文本不一致，已取消删除': 'Final confirmation mismatch. Deletion cancelled.',
  '确定归档该届次吗？归档会冻结成员账号信息、身份与绩效快照。': 'Archive this cohort? Member account information, identities, and performance snapshots will be frozen.',
  '确认删除': 'Confirm deletion',
  '删除届次失败': 'Failed to delete cohort',
  '届次已删除，同时删除': 'Cohort deleted, also removed',
  '条成员记录': 'member records',
  '创建届次失败': 'Failed to create cohort',
  '届次已创建': 'Cohort created',
  '保存成员失败': 'Failed to save member',
  '成员身份与分管部门已保存': 'Member role and managed departments saved',
  '归档完成，共归档': 'Archive complete, archived',
  '名成员': 'members',
  '该届次已经归档': 'This cohort is already archived',
  '归档失败': 'Archive failed',
  '生成归档预览失败': 'Failed to generate archive preview',
  '请先创建或选择届次': 'Create or select a cohort first',
  '请先选择届次': 'Select a cohort first',
  '已归档届次不可继续编辑成员': 'Archived cohorts cannot be edited',
  '未选择': 'Not selected',
  '暂无管理员账号': 'No administrator accounts',
  '暂无学生账号': 'No student accounts',
  '该部门还没有志愿者账号。': 'This department has no volunteer accounts yet.',
  '请先添加本学期成员。': 'Add members for this semester first.',
  '暂无排行数据。': 'No ranking data yet.',
  '暂无绩效流水。': 'No performance records yet.',
  '该学期暂未获取积分': 'No points recorded for this semester',
  '全部标为已读': 'Mark all as read',
  '账号管理': 'Account management',
  '修改信息': 'Edit information',
  '注销': 'Deactivate',
  '编辑': 'Edit',
  '团委学生会组织治理中枢': 'Youth League & Student Union Governance Hub',
  '学院权益治理总控台': 'School Rights Governance Console',
  '权益事务处理台': 'Rights Operations Desk',
  '统一查看账号权限、子管理员处理轨迹、学期绩效与成员名单，给系统运行留下一条清楚的治理账本。': 'Review account permissions, sub-admin activity, semester performance, and member rosters in one governance ledger.',
  '届次成员、身份角色、分管部门与归档快照从 SIEVOX 中移出，由终极管理员在 SIEHUB 统一维护。': 'Cohort members, roles, managed departments, and archive snapshots are maintained centrally in SIEHUB by the ultimate administrator.',
  '业务反馈处理': 'Feedback operations',
  '用户密码重置': 'User password reset',
  '期末动态加权结算': 'End-of-term weighted settlement',
  '按活动参与人数与规则自动校准板块得分。': 'Automatically calibrate section scores by participation and rules.',
  '生成加权结果前，请先确认成员名单和绩效流水。': 'Confirm the roster and performance records before generating weighted results.',
  '管理本学期成员名单': 'Manage semester roster',
  '管理本学期成员': 'Manage semester members',
  '从子管理员账号中选择参与本学期绩效核算的成员。': 'Select members from sub-admin accounts for this semester’s performance calculation.',
  '录入前先维护名单，避免历史学期数据混入。': 'Maintain the roster before scoring to avoid mixing historical semester data.',
  '账号管理面板': 'Account management panel',
  '部门绩效管理': 'Department performance',
  '我的绩效档案': 'My performance record',
  '仅查看本人当前学期的积分、维度分布和绩效流水。': 'View only your own points, dimension breakdown, and performance records for the current semester.',
  '学期管理、成员名单、批量赋分、绩效流水撤回与期末动态加权统一在这里完成。': 'Manage semesters, rosters, batch scoring, record recalls, and end-of-term dynamic weighting here.',
  '志愿者绩效制度': 'Volunteer performance policy',
  '我的绩效与评价': 'My performance and reviews',
  '我的成绩与评价': 'My scores and reviews',
  '成绩与评价': 'Scores and reviews',
  '历史日常积分': 'Historical daily points',
  '部门基础模板': 'Department base template',
  '部门绩效工作台': 'Department performance workspace',
  '当前先完整复刻 SIEVOX 的六维考核体系，后续再按部门单独微调。': 'The six-dimension SIEVOX assessment model is replicated first and can be customized by department later.',
  '同款模板': 'Matching template',
  '制度标题': 'Policy title',
  '制度说明': 'Policy description',
  '维度名称': 'Dimension name',
  '添加成员、批量录入、查看流水与排行。': 'Add members, enter scores in bulk, and view records and rankings.',
  '本学期成员': 'Semester members',
  '部门志愿者账号': 'Department volunteer accounts',
  '绩效流水': 'Performance records',
  '封顶分': 'Score cap',
  '计分方式': 'Scoring method',
  '已加权': 'Weighted',
  '确认并应用加权到总分': 'Confirm and apply weighting to total',
  '本学期尚未选择参与绩效的成员，请点击右上角「👥 管理本学期成员名单」从子管理员账号中添加。': 'No members have been selected for this semester. Use “👥 Manage semester roster” in the upper-right corner to add sub-admin accounts.',
  '勾选后即为本学期参与绩效核算的成员（来源：子管理员账号）。': 'Selected members will be included in this semester’s performance calculation (from sub-admin accounts).',
  '当前学期': 'Current semester',
  '当前管理学期：': 'Current managed semester:',
  '当前管理学期': 'Current managed semester',
  '重命名此学期': 'Rename this semester',
  '归档并开启新学期': 'Archive and open a new semester',
  '当前运行中': 'Currently active',
  '历史归档': 'Archived',
  '学期：': 'Semester: ',
  '选择一个需要修改的学期': 'Select a semester to edit',
  '请先选择一个需要修改的学期': 'Select a semester to edit first',
  '本学期绩效成员名单已保存。': 'Semester performance roster saved.',
  '绩效录入成功。': 'Performance entry saved.',
  '绩效记录已撤回。': 'Performance record recalled.',
  '保存成员名单失败': 'Failed to save the member roster',
  '保存绩效制度失败': 'Failed to save the performance policy',
  '恢复默认失败': 'Failed to restore the default',
  '绩效录入失败': 'Failed to enter performance',
  '获取部门绩效工作台失败': 'Failed to load department performance workspace',
  '已保存为该部门的定制绩效制度。': 'Saved as this department’s custom performance policy.',
  '已恢复为 SIEVOX 默认绩效制度。': 'Restored the SIEVOX default performance policy.',
  '保存绩效制度失败，请稍后重试。': 'Failed to save the performance policy. Please try again.',
  '恢复默认失败，请稍后重试。': 'Failed to restore the default. Please try again.',
  '加权已成功应用！成绩右上角已点亮绿色的“已加权”。': 'Weighting applied. The green “Weighted” marker is now shown.',
  '学期名称修改成功！': 'Semester name updated successfully!',
  '新学期已成功开启！全员积分已重置。': 'New semester opened successfully. All scores have been reset.',
  '本学期成员名单已保存': 'Semester roster saved',
  '状态更新成功': 'Status updated successfully',
  '绩效录入成功': 'Performance entry saved',
  '网络错误，请重试': 'Network error. Please try again.',
  '新密码至少需要6位': 'The new password must be at least 6 characters',
  '请填写届次名称': 'Enter a cohort name',
  '请先选择要录入绩效的成员。': 'Select members for performance entry first.',
  '请先选择要撤回的记录': 'Select records to recall first',
  '确定应用加权吗？系统将自动校准该板块得分，并在得分处点亮“已加权”绿标。': 'Apply weighting? The system will recalculate this section and show a green “Weighted” marker.',
  '确定彻底撤销这条反馈吗？': 'Permanently withdraw this feedback?',
  '确定撤回这条留言吗？': 'Recall this message?',
  '确定要撤回这条回复吗？（撤回后学生和普通管理员将无法查看具体内容）': 'Recall this reply? Students and regular administrators will no longer see its content.',
  '确认撤回这条绩效记录吗？': 'Recall this performance record?',
  '警告：确定要彻底撤回这条赋分记录吗？撤回后该人员本学期的总分将自动重算！': 'Warning: permanently withdraw this score record? The member’s semester total will be recalculated.',
  '本学期尚未选择参与绩效的成员': 'No members selected for this semester’s performance review',
  '反馈如何流转': 'How feedback moves',
  '响应时效': 'Response time',
  '紧急事项': 'Urgent matters',
  '普通事项原则上 1 个工作日内首次响应；高优先级问题会进入加急队列。': 'Routine matters receive a first response within one working day; high-priority issues enter an expedited queue.',
  '涉及人身安全、火情或突发疾病时，请直接联系校园应急电话，不要仅依赖在线反馈。': 'For personal safety, fire, or medical emergencies, contact campus emergency services directly instead of relying only on online feedback.',
  '提交后由学生权益中心初审，并按问题领域分派至责任部门，全程可查看节点与回复。': 'The Student Rights Center reviews submissions first, routes them to the responsible department, and keeps every step visible.',
  '快速反馈': 'Quick feedback',
  '最近反馈': 'Recent feedback',
  '选择问题领域': 'Choose an issue area',
  '帮助中心': 'Help center',
  '处理需要多久': 'How long does processing take?',
  '查看受理和分派规则': 'View intake and routing rules',
  '各类型事项响应时效': 'Response times by issue type',
  '校园应急联系电话': 'Campus emergency contacts',
  '已提交': 'Submitted',
  '核实中': 'Verifying',
  '待完成': 'Awaiting completion',
  '已有部门回复': 'Department replied',
  '已进入处理队列': 'In the processing queue',
  '点击查看完整对话流转记录': 'Click to view the full conversation trail',
  '条互动': 'interactions',
  '超管强制撤回': 'Recalled by super admin',
  '发出者已撤回': 'Withdrawn by sender',
  '反馈记录永久保留': 'Feedback records are retained permanently',
  '归档留痕': 'Archive trail',
  '全部优先级': 'All priorities',
  '全部状态': 'All statuses',
  '全部类别': 'All categories',
  '问题领域': 'Issue area',
  '个人信息修改成功！': 'Profile updated successfully!',
  '密码修改成功！请重新登录。': 'Password changed. Please sign in again.',
  '保存失败': 'Save failed',
  '更新失败': 'Update failed',
  '操作失败': 'Action failed',
  '提交失败': 'Submission failed',
  '撤回失败': 'Recall failed',
  '撤销失败': 'Withdrawal failed',
  '发送失败': 'Send failed',
  '重置失败': 'Reset failed',
  '网络错误': 'Network error',
  '处理了问题': 'Processed an issue',
  '提交了问题': 'Submitted an issue',
  '状态更新': 'Status update',
  '回复学生': 'Reply to student',
  '细分类别': 'Subcategory',
  '请完整填写问题领域、细分类别、标题和描述': 'Complete the issue area, subcategory, title, and description',
  '请选择细分类别': 'Select a subcategory',
  '请选择详细诉求分类': 'Select a detailed request category',
  '返回学生服务入口': 'Back to Student Service Entry'
});

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

const translateTextValue = (value) => {
  if (!value || !/[\u4e00-\u9fa5]/.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (EN_TRANSLATIONS[normalized]) return `${leading}${EN_TRANSLATIONS[normalized]}${trailing}`;
  let translated = normalized;
  Object.entries(EN_TRANSLATIONS)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([zh, en]) => { translated = translated.split(zh).join(en); });
  translated = translated
    .replace(/已选择\s*(\d+)\s*个文件/g, '$1 files selected')
    .replace(/删除会移除当前届次及其成员归档记录，需输入完整届次名称和“确认删除”/g, 'Deleting removes this cohort and its archived member records. Enter the full cohort name and “确认删除”')
    .replace(/请输入学号\s*(\S+)\s*的新密码\(至少6位\)/g, 'Enter a new password (at least 6 characters) for student ID $1')
    .replace(/确定要将\s*(.+?)\s*\((\S+)\)\s*升级为管理员吗？/g, 'Promote $1 ($2) to administrator?')
    .replace(/确定要撤销学号\s*(\S+)\s*的管理员权限吗？/g, 'Revoke administrator access for student ID $1?')
    .replace(/确定要彻底注销并抹除该账号吗？/g, 'Permanently deactivate and erase this account?')
    .replace(/请输入学号和新密码/g, 'Enter the student ID and new password')
    .replace(/确定要将学号\s*(\S+)\s*的密码重置吗？/g, 'Reset the password for student ID $1?')
    .replace(/共\s*(\d+)\s*个附件/g, '$1 attachments')
    .replace(/包含\s*(\d+)\s*个附件/g, '$1 attachments')
    .replace(/当前筛选下没有需要显示的审核项/g, 'No review items match the current filter')
    .replace(/Youth League\s*(\d+)\s*个模块/g, 'Youth League $1 modules')
    .replace(/Student Union\s*(\d+)\s*个模块/g, 'Student Union $1 modules')
    .replace(/已接入\s*(\d+)\s*个部门模块/g, '$1 department modules connected')
    .replace(/团委\s*(\d+)\s*个模块/g, 'Youth League $1 modules')
    .replace(/学生会\s*(\d+)\s*个模块/g, 'Student Union $1 modules')
    .replace(/共\s*(\d+)\s*条事项\s*·\s*按状态与优先级实时筛选/g, '$1 items · live filters by status and priority')
    .replace(/(\d+)\s*名成员/g, '$1 members')
    .replace(/(\d+)\s*名学生账号/g, '$1 student accounts')
    .replace(/(\d+)\s*名管理账号/g, '$1 administrator accounts')
    .replace(/包含志愿者、超级管理员与终极管理员视角可管理人员/g, 'Includes volunteers, super administrators, and ultimate administrator views')
    .replace(/第\s*(.*?)\s*名/g, 'Rank $1')
    .replace(/(\d+(?:\.\d+)?)\s*小时/g, '$1 hours');
  return `${leading}${translated}${trailing}`;
};

const shouldSkipTranslation = (node) => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element) return true;
  const tag = element.tagName;
  return ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag) || Boolean(element.closest('[data-i18n-skip]'));
};

const useLanguage = () => {
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) || 'zh');
  const textOriginals = useRef(new WeakMap());
  const attrOriginals = useRef(new WeakMap());
  const translating = useRef(false);

  const applyLanguage = useCallback((mode = language) => {
    if (!document.body) return;
    translating.current = true;
    document.documentElement.lang = mode === 'en' ? 'en' : 'zh-CN';
    document.documentElement.dataset.language = mode;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (!shouldSkipTranslation(textNode)) {
        const { original, rendered } = nextTranslatedValue(textOriginals.current.get(textNode), textNode.nodeValue, mode, translateTextValue);
        textOriginals.current.set(textNode, { original, rendered });
        if (textNode.nodeValue !== rendered) textNode.nodeValue = rendered;
      }
      textNode = walker.nextNode();
    }

    document.body.querySelectorAll('*').forEach(element => {
      if (shouldSkipTranslation(element)) return;
      let originals = attrOriginals.current.get(element);
      if (!originals) {
        originals = {};
        attrOriginals.current.set(element, originals);
      }
      TRANSLATABLE_ATTRS.forEach(attr => {
        if (!element.hasAttribute(attr)) return;
        const current = element.getAttribute(attr);
        const { original, rendered } = nextTranslatedValue(originals[attr], current, mode, translateTextValue);
        originals[attr] = { original, rendered };
        if (current !== rendered) element.setAttribute(attr, rendered);
      });
    });

    requestAnimationFrame(() => { translating.current = false; });
  }, [language]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_KEY, language);
    applyLanguage(language);
  }, [language, applyLanguage]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (translating.current) return;
      requestAnimationFrame(() => applyLanguage(language));
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TRANSLATABLE_ATTRS });
    return () => observer.disconnect();
  }, [language, applyLanguage]);

  return { language, setLanguage };
};

const LanguageSwitcher = ({ language, setLanguage }) => (
  <div className="language-switcher" data-i18n-skip aria-label="Language switch">
    <button className={language === 'zh' ? 'is-active' : ''} type="button" onClick={() => setLanguage('zh')}>{language === 'zh' ? '中文' : 'ZH'}</button>
    <i></i>
    <button className={language === 'en' ? 'is-active' : ''} type="button" onClick={() => setLanguage('en')}>EN</button>
  </div>
);

const PRIVACY_TERMS = [
  {
    title: '一、适用范围',
    content: '本隐私条款依据《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》及 App 个人信息保护合规要求制定，适用于 SIEHUB 平台及其接入的校内学生工作模块。平台面向北京化工大学国际教育学院相关学生、志愿者、部门成员与管理人员，用于统一身份认证、学生服务办理、权益反馈流转、部门协同和通知触达。'
  },
  {
    title: '二、我们收集的信息',
    content: '为保障平台正常运行与校内身份核验，我们可能收集学号或账号、姓名、邮箱、手机号、身份角色、所属组织/部门、登录时间、访问 IP 地址、浏览器与设备基础信息、操作日志、反馈内容、附件材料、处理记录及绩效相关记录。'
  },
  {
    title: '三、使用目的',
    content: '我们遵循合法、正当、必要、诚信、公开透明和最小必要原则处理个人信息。上述信息将用于账号注册与登录、身份识别、权限分配、反馈提交与处理、服务进度通知、部门工作协同、安全审计、异常排查、数据统计分析以及法律法规和学校管理要求下的必要用途。'
  },
  {
    title: '四、存储与保护',
    content: '平台将采取访问控制、权限分级、日志审计、传输加密、最小必要授权等安全措施保护个人信息。除法律法规、学校管理要求或完成服务所必需的情形外，未经授权不会向无关第三方公开披露个人信息。'
  },
  {
    title: '五、用户权利',
    content: '你有权依法查询、更正、补充、删除个人信息，撤回同意，注销账号，或对个人信息处理规则进行咨询、投诉。撤回同意可能导致部分依赖身份认证、通知触达或反馈流转的功能无法继续使用。'
  },
  {
    title: '六、未成年人保护',
    content: '如用户属于未成年人，应在监护人指导下使用本平台。平台将按照法律法规要求保护未成年人个人信息，并仅在提供校内学生服务所必需的范围内处理相关信息。'
  },
  {
    title: '七、联系方式',
    content: '如对本隐私条款或个人信息处理有疑问，可联系平台管理员或国际教育学院学生工作相关负责人。平台会在合理期限内处理你的请求。'
  }
];

const PRIVACY_TERMS_EN = [
  {
    title: '1. Scope',
    content: 'These Privacy Terms are formulated in accordance with the Personal Information Protection Law of the People’s Republic of China, the Cybersecurity Law of the People’s Republic of China, the Data Security Law of the People’s Republic of China, and applicable personal-information compliance requirements for apps. They apply to SIEHUB and its connected on-campus student-work modules. The platform serves relevant students, volunteers, department members, and administrators of the School of International Education at Beijing University of Chemical Technology for unified identity verification, student services, rights feedback, departmental collaboration, and notifications.'
  },
  {
    title: '2. Information We Collect',
    content: 'To keep the platform running and verify campus identities, we may collect your student ID or account, name, email address, phone number, identity role, organization or department, sign-in time, IP address, basic browser and device information, operation logs, feedback, attachments, processing records, and performance-related records.'
  },
  {
    title: '3. How We Use Information',
    content: 'We process personal information according to the principles of lawfulness, legitimacy, necessity, good faith, openness, transparency, and data minimization. The information above may be used for account registration and sign-in, identity recognition, permission assignment, feedback submission and processing, service notifications, departmental collaboration, security audits, incident investigation, statistical analysis, and other purposes required by laws, regulations, or university administration.'
  },
  {
    title: '4. Storage and Protection',
    content: 'We use access controls, permission tiers, audit logs, encrypted transmission, and least-privilege authorization to protect personal information. Unless required by law, university administration, or service delivery, we will not disclose personal information to unrelated third parties without authorization.'
  },
  {
    title: '5. Your Rights',
    content: 'You may lawfully access, correct, supplement, or delete your personal information, withdraw consent, close your account, or ask questions and file complaints about our information-processing rules. Withdrawing consent may prevent some functions that depend on identity verification, notifications, or feedback workflows from continuing to operate.'
  },
  {
    title: '6. Protection of Minors',
    content: 'If you are a minor, use this platform under the guidance of a guardian. We protect minors’ personal information as required by law and process it only to the extent necessary to provide on-campus student services.'
  },
  {
    title: '7. Contact Us',
    content: 'If you have questions about these Privacy Terms or the processing of personal information, contact the platform administrator or the person responsible for student affairs at the School of International Education. We will handle your request within a reasonable period.'
  }
];

const getCategory = (value) => CATEGORIES_CONFIG[value] || CATEGORIES_CONFIG.comprehensive;
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '刚刚';
const firstChar = (name = '赵') => name.trim().slice(0, 1) || '赵';

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(readStoredToken);
  const [authError, setAuthError] = useState('');
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const logout = useCallback(() => {
    const currentToken = readStoredToken();
    if (currentToken) requestJson('/auth/logout', currentToken, { method: 'POST' }).catch(() => {});
    clearSessionToken();
    setToken(null);
    setUser(null);
    setAuthError('');
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    setAuthError('');
    try {
      const data = await requestJson('/auth/me', token);
      if (readStoredToken() === token) setUser(data.user);
    } catch (error) {
      if (readStoredToken() === token) setAuthError(error.message || '暂时无法验证登录，请检查连接后重试');
    }
  }, [token]);

  useEffect(() => subscribeSessionChanges(nextToken => {
    if (tokenRef.current !== nextToken) setUser(null);
    setToken(nextToken);
    setAuthError('');
  }), []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = async (studentId, password, remember = false) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password, remember })
    });
    const data = await res.json();
    if (data.success) {
      persistSessionToken(data.token, remember);
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  const register = async (payload) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  return { user, token, login, register, logout, refreshUser, authError };
};

export const useTheme = () => {
  const [mode, setMode] = useState(() => localStorage.getItem('sievox_demo_theme_mode') || localStorage.getItem('sievox_theme_v2') || 'light');
  const [color, setColor] = useState(() => localStorage.getItem('sievox_demo_theme_color') || localStorage.getItem('sievox_palette_v2') || 'blue');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode === 'dark' ? 'dark' : 'light';
    root.dataset.color = THEME_COLORS.some(item => item.key === color) ? color : 'blue';
    root.classList.toggle('dark', mode === 'dark');
    localStorage.setItem('sievox_demo_theme_mode', root.dataset.theme);
    localStorage.setItem('sievox_demo_theme_color', root.dataset.color);
    localStorage.setItem('sievox_theme_v2', root.dataset.theme);
    localStorage.setItem('sievox_palette_v2', root.dataset.color);
  }, [mode, color]);

  return { mode, setMode, color, setColor, open, setOpen };
};

const ThemeModeButtons = ({ theme, compact = false }) => (
  <div className={cls('theme-mode-icons', compact && 'compact')} aria-label="深浅色切换">
    <button
      className={theme.mode !== 'dark' ? 'is-active' : ''}
      type="button"
      onClick={() => theme.setMode('light')}
      aria-label="浅色模式"
      title="浅色模式"
    >
      <Sun />
    </button>
    <button
      className={theme.mode === 'dark' ? 'is-active' : ''}
      type="button"
      onClick={() => theme.setMode('dark')}
      aria-label="深色模式"
      title="深色模式"
    >
      <Moon />
    </button>
  </div>
);

const ThemePanel = ({ theme }) => (
  <aside className={cls('theme-panel', theme.open && 'is-open')} aria-hidden={!theme.open}>
    <header>
      <div><span>APPEARANCE</span><h2>外观设置</h2></div>
      <button className="icon-button" type="button" onClick={() => theme.setOpen(false)}><X /></button>
    </header>
    <div className="theme-section theme-composer">
      <div>
        <p>模式</p>
        <ThemeModeButtons theme={theme} />
      </div>
      <div>
        <p>主题色</p>
        <div className="palette-list">
          {THEME_COLORS.map(item => (
            <button key={item.key} className={theme.color === item.key ? 'is-active' : ''} type="button" onClick={() => theme.setColor(item.key)}>
              <i className={`palette-swatch ${item.key}`}></i>
              <span><strong>{item.label}</strong><small>{item.value}</small></span>
              <Check />
            </button>
          ))}
        </div>
      </div>
    </div>
    <p className="theme-note"><Info />外观选择会自动保存在当前浏览器中。</p>
  </aside>
);

const LoginPage = ({ onLogin, onRegister, theme, language = 'zh', languageSwitcher = null }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const isMobileClient = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);
  const [remember, setRemember] = useState(isMobileClient);
  const [privacyAccepted, setPrivacyAccepted] = useState(() => localStorage.getItem(PRIVACY_NOTICE_KEY) === 'accepted');
  const [privacyOpen, setPrivacyOpen] = useState(() => localStorage.getItem(PRIVACY_NOTICE_KEY) !== 'accepted');
  const [form, setForm] = useState({ studentId: '', password: '', confirmPassword: '', name: '', email: '', phone: '', emailCode: '' });
  const [emailCodeState, setEmailCodeState] = useState({ sending: false, cooldown: 0, message: '' });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ email: '', code: '', password: '', confirmPassword: '' });
  const [resetState, setResetState] = useState({ sending: false, submitting: false, cooldown: 0, message: '', error: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const privacyTerms = language === 'en' ? PRIVACY_TERMS_EN : PRIVACY_TERMS;
  const loginModules = SIEHUB_MODULES.filter(module => module.organization !== 'hub');
  const youthLeagueModules = loginModules.filter(module => module.organization === 'youth_league');
  const studentUnionModules = loginModules.filter(module => module.organization === 'student_union');
  const youthLeagueCount = loginModules.filter(module => module.organization === 'youth_league').length;
  const studentUnionCount = loginModules.filter(module => module.organization === 'student_union').length;
  const loginModuleEnglishTitles = {
    organization: 'Organization',
    publicity: 'Publicity',
    practice: 'Practice',
    volunteer_service: 'Volunteer',
    general_office: 'General Office',
    student_rights: 'Student Rights',
    culture_sports_arts: 'Arts & Sports',
    academic_technology: 'Academic Tech',
    new_media: 'New Media'
  };

  useEffect(() => {
    let active = true;
    const checkPrivacyNotice = async () => {
      try {
        const res = await fetch(`${API_BASE}/privacy/notice-status`);
        const data = await res.json();
        if (!active || !data.success) return;
        if (data.accepted) {
          localStorage.setItem(PRIVACY_NOTICE_KEY, 'accepted');
          setPrivacyAccepted(true);
          setPrivacyOpen(false);
        } else {
          localStorage.removeItem(PRIVACY_NOTICE_KEY);
          setPrivacyAccepted(false);
          setPrivacyOpen(true);
        }
      } catch {
        if (!localStorage.getItem(PRIVACY_NOTICE_KEY)) setPrivacyOpen(true);
      }
    };
    checkPrivacyNotice();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (emailCodeState.cooldown <= 0) return;
    const id = setInterval(() => setEmailCodeState(current => ({ ...current, cooldown: Math.max(0, current.cooldown - 1) })), 1000);
    return () => clearInterval(id);
  }, [emailCodeState.cooldown]);

  useEffect(() => {
    if (resetState.cooldown <= 0) return;
    const id = setInterval(() => setResetState(current => ({ ...current, cooldown: Math.max(0, current.cooldown - 1) })), 1000);
    return () => clearInterval(id);
  }, [resetState.cooldown]);

  const acceptPrivacyTerms = async () => {
    try {
      await fetch(`${API_BASE}/privacy/notice-acceptance`, { method: 'POST' });
    } catch {
      // 登录本身仍依赖后端；此处保留本地确认，避免网络抖动卡住阅读流程。
    }
    localStorage.setItem(PRIVACY_NOTICE_KEY, 'accepted');
    setPrivacyAccepted(true);
    setPrivacyOpen(false);
    setError('');
  };

  const sendRegisterEmailCode = async () => {
    setError('');
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('请先输入有效邮箱。');
    setEmailCodeState(current => ({ ...current, sending: true, message: '' }));
    try {
      const res = await fetch(`${API_BASE}/auth/email-code/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!data.success) setError(data.message || '验证码发送失败');
      else setEmailCodeState({ sending: false, cooldown: 60, message: data.message || '验证码已发送，请查看邮箱。' });
    } catch {
      setError('验证码发送失败，请确认后端服务已启动。');
      setEmailCodeState(current => ({ ...current, sending: false }));
      return;
    }
    setEmailCodeState(current => ({ ...current, sending: false }));
  };

  const sendResetEmailCode = async () => {
    setResetState(current => ({ ...current, sending: true, message: '', error: '' }));
    const email = resetForm.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setResetState(current => ({ ...current, sending: false, error: '请先输入绑定邮箱。' }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/email-code/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!data.success) setResetState(current => ({ ...current, sending: false, error: data.message || '验证码发送失败' }));
      else setResetState({ sending: false, submitting: false, cooldown: 60, message: data.message || '验证码已发送至绑定邮箱。', error: '' });
    } catch {
      setResetState(current => ({ ...current, sending: false, error: '验证码发送失败，请确认后端服务已启动。' }));
    }
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    setResetState(current => ({ ...current, submitting: true, error: '', message: '' }));
    if (resetForm.password !== resetForm.confirmPassword) {
      setResetState(current => ({ ...current, submitting: false, error: '两次输入的新密码不一致。' }));
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/auth/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetForm.email, code: resetForm.code, password: resetForm.password })
      });
      const data = await res.json();
      if (!data.success) setResetState(current => ({ ...current, submitting: false, error: data.message || '密码重置失败' }));
      else {
        setResetState({ sending: false, submitting: false, cooldown: 0, message: '密码已重置，请使用新密码登录。', error: '' });
        setResetForm({ email: '', code: '', password: '', confirmPassword: '' });
        setTimeout(() => setResetOpen(false), 900);
      }
    } catch {
      setResetState(current => ({ ...current, submitting: false, error: '密码重置失败，请确认后端服务已启动。' }));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!privacyAccepted) {
      setPrivacyOpen(true);
      return setError('请先阅读并勾选同意《隐私条款》后再继续。');
    }
    if (!isLogin && form.password !== form.confirmPassword) return setError('两次输入的密码不一致');
    if (!isLogin && !/^\d{10}$/.test(form.studentId.trim())) return setError('学生账号学号必须为唯一的10位数字。');
    if (!isLogin && !/^\d{6}$/.test(form.emailCode.trim())) return setError('请输入6位邮箱验证码。');
    setLoading(true);
    try {
      const data = isLogin ? await onLogin(form.studentId, form.password, remember) : await onRegister(form);
      if (!data.success) setError(data.message || (isLogin ? '登录失败' : '注册失败'));
      else if (!isLogin) {
        setIsLogin(true);
        setError('');
        alert('注册成功，请登录');
      }
    } catch {
      setError('无法连接 SIEHUB 后端，请确认本地服务已启动。');
    }
    setLoading(false);
  };

  return (
    <section className="login-view siehub-login-view" aria-label="SIEHUB 统一登录">
      <div className="login-art siehub-login-art" aria-hidden="true">
        <div className="login-art-header">
          <div className="institution-mark siehub-institution-mark">
            <span className="siehub-login-logo"><img src={siehubLogo} alt="SIEHUB" /></span>
            <div><strong>SIEHUB</strong><span>SIE LIFE PLATFORM</span></div>
          </div>
          <span className="edition-mark">LT1 · PLATFORM UPGRADE</span>
        </div>
        <div className="siehub-login-blueprint">
          <div className="login-orbit-bridge"></div>
          <section className="login-organization-orbit youth-league-orbit">
            <div className="login-orbit-track"></div>
            <div className="login-orbit-core">
              <span>团委</span>
              <small>YOUTH LEAGUE</small>
            </div>
            <div className="login-orbit-nodes">
              {youthLeagueModules.map((module, index) => (
                <span
                  key={module.key}
                  className="login-orbit-node"
                  style={{ '--node-angle': `${index * 90}deg`, '--node-index': index }}
                >
                  <span className="login-orbit-node-inner">
                    <span className="login-orbit-node-motion">
                      <DepartmentModuleMark module={module} showLogo={false} />
                      <b>{language === 'en' ? loginModuleEnglishTitles[module.key] : module.title}</b>
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </section>
          <section className="login-organization-orbit student-union-orbit">
            <div className="login-orbit-track"></div>
            <div className="login-orbit-core">
              <span>学生会</span>
              <small>STUDENT UNION</small>
            </div>
            <div className="login-orbit-nodes">
              {studentUnionModules.map((module, index) => (
                <span
                  key={module.key}
                  className="login-orbit-node"
                  style={{ '--node-angle': `${-90 + index * 72}deg`, '--node-index': index }}
                >
                  <span className="login-orbit-node-inner">
                    <span className="login-orbit-node-motion">
                      <DepartmentModuleMark module={module} showLogo={false} />
                      <b>{language === 'en' ? loginModuleEnglishTitles[module.key] : module.title}</b>
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </section>
        </div>
        <div className="login-art-copy">
          <p className="art-kicker">ONE ID · ALL STUDENT WORK</p>
          <h1>一处登录，抵达所有学生工作模块。</h1>
          <div className="art-caption"><span>01</span><p>SIEHUB 作为一级生活平台，统一承载团委、学生会各部门子平台。</p></div>
        </div>
        <div className="login-art-footer">
          <span>{language === 'en' ? `Youth League ${youthLeagueCount} modules` : `团委 ${youthLeagueCount} 个模块`}</span>
          <span>{language === 'en' ? `Student Union ${studentUnionCount} modules` : `学生会 ${studentUnionCount} 个模块`}</span>
          <b></b>
          <span>统一身份认证</span>
        </div>
      </div>

      <div className="login-panel siehub-login-panel">
        <div className="login-panel-top">
          <div className="college-signature siehub-college-signature">
            <img src={buctLogo} alt="北京化工大学" />
            <span className="signature-rule"></span>
            <img src={collegeLogo} alt="国际教育学院" />
            <div><strong>北京化工大学</strong><span>国际教育学院</span></div>
          </div>
          <div className="login-panel-actions">
            <button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)}><Palette /></button>
            {languageSwitcher}
          </div>
        </div>
        <form className={cls('login-form', !isLogin && 'is-register')} onSubmit={submit}>
          <div className="login-heading">
            <span className="login-index">01 / SIEHUB ACCESS</span>
            <h2>{isLogin ? '进入 SIEHUB' : '申请学生账号'}</h2>
            <p>{isLogin ? '输入账号与密码，完成统一身份认证后进入 SIEHUB。' : '首次使用请完成校内身份信息登记，账号创建后从 SIEHUB 统一登录。'}</p>
          </div>
          <div className="unified-login-card siehub-routing-card" aria-label="SIEHUB 统一登录说明">
            <ShieldCheck />
            <div>
              <strong>统一身份认证</strong>
              <span>登录信息仅用于校内身份核验、权限确认与平台安全审计。</span>
            </div>
          </div>
          {error && <div className="form-message">{error}</div>}
          <label className="login-field">
            <span>学号 / 账号</span>
            <div><IdCard /><input name="studentId" value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} placeholder="请输入学号" autoComplete="username" required /></div>
          </label>
          {!isLogin && (
            <>
              <label className="login-field"><span>姓名</span><div><UserRound /><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="请输入真实姓名" required /></div></label>
              <label className="login-field"><span>绑定邮箱</span><div className="email-code-field"><MessagesSquare /><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="请输入唯一绑定邮箱" required /><button type="button" onClick={sendRegisterEmailCode} disabled={emailCodeState.sending || emailCodeState.cooldown > 0}>{emailCodeState.sending ? '发送中' : emailCodeState.cooldown > 0 ? `${emailCodeState.cooldown}s` : '发送验证码'}</button></div></label>
              {emailCodeState.message && <p className="email-code-tip">{emailCodeState.message}</p>}
              <label className="login-field"><span>邮箱验证码</span><div><KeyRound /><input inputMode="numeric" maxLength={6} value={form.emailCode} onChange={e => setForm({ ...form, emailCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="请输入6位验证码" required /></div></label>
            </>
          )}
          <label className="login-field">
            <span>密码</span>
            <div><LockKeyhole /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="请输入密码" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
          </label>
          {!isLogin && <label className="login-field"><span>确认密码</span><div><KeyRound /><input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="请再次输入密码" required /></div></label>}
          <label className="privacy-consent">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={e => {
                setPrivacyAccepted(e.target.checked);
                if (!e.target.checked) localStorage.removeItem(PRIVACY_NOTICE_KEY);
              }}
            />
            <i></i>
            <span>我已阅读并同意<button type="button" onClick={() => setPrivacyOpen(true)}>《隐私条款》</button></span>
          </label>
          <div className="login-options">
            <label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /><i></i><span>保持登录</span></label>
            <button type="button" onClick={() => setResetOpen(true)}>忘记密码？</button>
          </div>
          <button className="login-submit" type="submit" disabled={loading || !privacyAccepted}><span>{loading ? '正在验证身份…' : (isLogin ? '进入 SIEHUB' : '创建 SIEHUB 学生账号')}</span><ArrowUpRight /></button>
          <div className="login-register"><span>{isLogin ? '首次使用 SIEHUB？' : '已有账号？'}</span><button type="button" onClick={() => setIsLogin(v => !v)}>{isLogin ? '创建学生账号' : '返回登录'}</button></div>
        </form>
        <div className="login-help"><ShieldCheck /><p><strong>SIEHUB 统一身份安全认证</strong><span>个人信息仅用于校内身份核验、部门工作协同与服务进度通知。</span></p></div>
        <footer className="login-legal">
          <span>Copyright© 2026 BUCT SIE</span>
          <a href={ICP_RECORD_URL} target="_blank" rel="noreferrer">京ICP备2026010091号-1</a>
          <a href={POLICE_RECORD_URL} target="_blank" rel="noreferrer" className="login-police-record"><img src={beianIcon} alt="公安备案图标" /> 京公网安备11011402055565号</a>
          <button type="button" onClick={() => setPrivacyOpen(true)}>隐私保护</button>
        </footer>
      </div>
      {privacyOpen && (
        <div className="privacy-modal-backdrop" role="presentation">
          <section className="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
            <header>
              <div>
                <span>SIEHUB PRIVACY</span>
                <h2 id="privacy-title">隐私条款</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setPrivacyOpen(false)} aria-label="关闭隐私条款"><X /></button>
            </header>
            <div className="privacy-modal-body">
              <p className="privacy-effective">生效日期：2026年7月26日</p>
              {privacyTerms.map(item => (
                <article key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                </article>
              ))}
            </div>
            <footer>
              <button className="privacy-secondary" type="button" onClick={() => setPrivacyOpen(false)}>暂不同意</button>
              <button className="privacy-primary" type="button" onClick={acceptPrivacyTerms}>已阅读并同意</button>
            </footer>
          </section>
        </div>
      )}
      {resetOpen && (
        <div className="privacy-modal-backdrop" role="presentation">
          <form className="password-reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onSubmit={submitPasswordReset}>
            <header>
              <div>
                <span>SIEHUB ACCOUNT</span>
                <h2 id="reset-title">找回密码</h2>
                <p>使用账号绑定邮箱接收验证码，校验通过后即可设置新密码。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setResetOpen(false)} aria-label="关闭找回密码"><X /></button>
            </header>
            <div className="password-reset-body">
              {resetState.error && <div className="form-message">{resetState.error}</div>}
              {resetState.message && <p className="email-code-tip success">{resetState.message}</p>}
              <label className="login-field"><span>绑定邮箱</span><div className="email-code-field"><MessagesSquare /><input type="email" value={resetForm.email} onChange={e => setResetForm({ ...resetForm, email: e.target.value })} placeholder="请输入绑定邮箱" required /><button type="button" onClick={sendResetEmailCode} disabled={resetState.sending || resetState.cooldown > 0}>{resetState.sending ? '发送中' : resetState.cooldown > 0 ? `${resetState.cooldown}s` : '发送验证码'}</button></div></label>
              <label className="login-field"><span>邮箱验证码</span><div><KeyRound /><input inputMode="numeric" maxLength={6} value={resetForm.code} onChange={e => setResetForm({ ...resetForm, code: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="请输入6位验证码" required /></div></label>
              <label className="login-field"><span>新密码</span><div><LockKeyhole /><input type="password" value={resetForm.password} onChange={e => setResetForm({ ...resetForm, password: e.target.value })} placeholder="请输入新密码" required /></div></label>
              <label className="login-field"><span>确认新密码</span><div><KeyRound /><input type="password" value={resetForm.confirmPassword} onChange={e => setResetForm({ ...resetForm, confirmPassword: e.target.value })} placeholder="请再次输入新密码" required /></div></label>
            </div>
            <footer>
              <button className="privacy-secondary" type="button" onClick={() => setResetOpen(false)}>取消</button>
              <button className="privacy-primary" type="submit" disabled={resetState.submitting}>{resetState.submitting ? '正在重置' : '确认修改密码'}</button>
            </footer>
          </form>
        </div>
      )}
      <ThemePanel theme={theme} />
    </section>
  );
};

const RoleTag = ({ user }) => <b className="role-pill admin">{user?.isUltimateAdmin ? '终极管理员' : (user?.identityLabel || (user?.role === 'student' ? '学生' : '管理员'))}</b>;

const SIEHUB_MODULES = [
  { key: 'hub_governance', organization: 'hub', title: '组织治理中枢', summary: '团委学生会架构、成员身份、分管部门与届次归档', icon: ShieldCheck, tone: 'gold', product: 'SIEHUB', ultimateOnly: true },
  { key: 'organization', organization: 'youth_league', title: '组织部', summary: '组织建设、团务活动与成员发展', icon: Network, tone: 'indigo' },
  { key: 'publicity', organization: 'youth_league', title: '宣传部', summary: '品牌传播、视觉内容与新闻采编', icon: Megaphone, tone: 'orange' },
  { key: 'practice', organization: 'youth_league', title: '实践部', summary: '社会实践、项目协作与成长记录', icon: Flag, tone: 'green' },
  { key: 'volunteer_service', organization: 'youth_league', title: '志愿者工作部', summary: '志愿服务、时长管理与项目调度', icon: HeartHandshake, tone: 'red' },
  { key: 'general_office', organization: 'student_union', title: '综合办公室', summary: '组织运转、会议事项与综合协调', icon: Building2, tone: 'slate' },
  { key: 'student_rights', organization: 'student_union', title: '学生权益部', summary: '学生权益反馈、诉求跟进与服务闭环', icon: Scale, tone: 'blue', logo: sieLogo, entryLabel: 'SIEVOX学生权益反馈系统' },
  { key: 'culture_sports_arts', organization: 'student_union', title: '文体艺术部', summary: '文体活动、艺术项目与赛事组织', icon: Trophy, tone: 'purple' },
  { key: 'academic_technology', organization: 'student_union', title: '学术科技部', summary: '学术活动、科技竞赛与创新服务', icon: Wrench, tone: 'teal', logo: siebridgeLogo, entryLabel: 'SIEBridge课程资源共享平台' },
  { key: 'new_media', organization: 'student_union', title: '新媒体工作部', summary: '内容矩阵、平台运营与视觉创作', icon: Paintbrush, tone: 'pink' }
];

const DEPARTMENT_SHOWCASE_URLS = {
  student_rights: '/student-rights/index.html',
  academic_technology: '/academic-technology/index.html',
  culture_sports_arts: '/culture-sports-arts/index.html'
};
const CULTURE_SPORTS_ARTS_INTRO_URL = DEPARTMENT_SHOWCASE_URLS.culture_sports_arts;

const SIEHUB_HISTORY_MARKER = 'siehub-navigation-v1';
const SIEHUB_APP_SURFACES = new Set(['hub', 'departments', 'ultimateOrganization', 'department', 'sievox', 'siebridge', 'my']);
const SIEHUB_PORTAL_VIEWS = new Set(['student', 'admin', 'superadmin']);

const createSIEHUBHistoryState = (appSurface = 'hub', activeModule = null, portalView = 'superadmin') => ({
  marker: SIEHUB_HISTORY_MARKER,
  appSurface: SIEHUB_APP_SURFACES.has(appSurface) ? appSurface : 'hub',
  activeModuleKey: activeModule?.key || null,
  portalView: SIEHUB_PORTAL_VIEWS.has(portalView) ? portalView : 'superadmin'
});

const isSIEHUBHistoryState = (state) => state?.marker === SIEHUB_HISTORY_MARKER;
const findSIEHUBModuleByKey = (key) => SIEHUB_MODULES.find(module => module.key === key) || null;
const openExternalOrFallback = (url, fallback) => {
  if (url) {
    window.location.assign(url);
    return true;
  }
  if (typeof fallback === 'function') {
    fallback();
    return true;
  }
  return false;
};

const DEFAULT_VOLUNTEER_PERFORMANCE_POLICY = {
  sourceProduct: 'SIEVOX',
  title: 'SIEVOX 志愿者绩效考核制度',
  description: '所有部门初始统一复刻学生权益部 SIEVOX 的六维志愿者绩效考核制度。',
  totalBaseScore: 100,
  bonusMode: 'extra',
  dimensions: [
    { key: 'attendance', label: '考勤积分', capLabel: '20分', maxScore: 20, rule: '准时出勤/合规请假 +2 分；迟到早退 +1 分；无故缺席 0 分。', color: 'purple' },
    { key: 'activity', label: '活动贡献', capLabel: '35分', maxScore: 35, rule: '核心统筹策划 +4~5 分；主要骨干 +2~3 分；普通参与 +1 分。', color: 'blue' },
    { key: 'feedback', label: '权益跟进', capLabel: '25分', maxScore: 25, rule: '按时巡检系统与规范回复留言 +2 分/周；全月账号无违规 +1.25 分/月。', color: 'green' },
    { key: 'copywriting', label: '文案与策划', capLabel: '15分', maxScore: 15, rule: '主笔大型活动策划案 +4~5 分；主笔推送文案 +2~3 分；参与辅助 +1 分。', color: 'yellow' },
    { key: 'others', label: '其他常规', capLabel: '5分', maxScore: 5, rule: '完成物资管理、资料整理或跨部门对接 +1 分/次。', color: 'slate' },
    { key: 'bonus', label: '特别加分', capLabel: '附加', maxScore: null, rule: '获校级表彰、突出建设性贡献直接 +2~5 分，计入总分。', color: 'red' }
  ],
  notes: ['全员初始为 0 分', '五项常规维度封顶后计入总分，特别加分为附加项']
};

const canManageVolunteerPolicy = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) return matchedAccess.capabilities?.includes('manage_volunteer_performance_policy');
  return user?.role === 'superadmin' && ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle);
};

const canManageDepartmentNotice = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) return matchedAccess.capabilities?.includes('manage_department_notice');
  return user?.role === 'superadmin' && ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle);
};

const canManageDepartmentMembers = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) return matchedAccess.capabilities?.includes('manage_department_members');
  return user?.role === 'superadmin' && ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle);
};

const canManageDepartmentAccounts = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) return matchedAccess.capabilities?.includes('manage_department_accounts');
  return user?.role === 'superadmin' && ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle);
};

const canViewDepartmentFiles = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) {
    return Boolean(
      matchedAccess.capabilities?.includes('view_department_files') ||
      matchedAccess.capabilities?.includes('manage_department_files') ||
      matchedAccess.accessLevel === 'member' ||
      matchedAccess.accessLevel === 'manage'
    );
  }
  return user?.memberRole === 'volunteer' && user?.organization === module?.organization && user?.department === module?.key;
};

const canManageDepartmentFiles = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, module);
  if (matchedAccess) return matchedAccess.capabilities?.includes('manage_department_files');
  return user?.role === 'superadmin' && ['department_head', 'youth_league_cadre', 'presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle);
};

const canReviewSIEBridgeContent = (user) => {
  if (user?.isUltimateAdmin) return true;
  const matchedAccess = getModuleAccess(user, { key: 'academic_technology', organization: 'student_union' });
  return Boolean(matchedAccess?.capabilities?.includes('review_siebridge_content'));
};

const DepartmentModuleMark = ({ module, showLogo = true }) => {
  const Icon = module?.icon || Building2;
  if (showLogo && module?.logo) return <img className="siehub-module-logo" src={module.logo} alt={`${module.title || '部门'} logo`} />;
  return <Icon />;
};

const getModuleAccess = (user, module) => {
  const accessItems = Array.isArray(user?.moduleCapabilities) ? user.moduleCapabilities : [];
  return accessItems.find(item =>
    item.department === module?.key ||
    item.key === module?.key ||
    item.moduleId === module?.id ||
    (module?.key === 'student_rights' && item.moduleId === 'sievox') ||
    (module?.key === 'academic_technology' && item.moduleId === 'siebridge')
  );
};

const canSwitchDepartmentPortal = (user, module) => {
  if (user?.isUltimateAdmin) return true;
  const access = getModuleAccess(user, module);
  return access?.accessLevel === 'manage' && access.capabilities?.includes('switch_portal');
};

const createPolicyDraft = (policy = DEFAULT_VOLUNTEER_PERFORMANCE_POLICY) => ({
  title: policy.title || DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.title,
  description: policy.description || DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.description,
  dimensions: (policy.dimensions?.length ? policy.dimensions : DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.dimensions).map(item => ({
    key: item.key,
    label: item.label,
    maxScore: item.maxScore,
    capLabel: item.capLabel || (item.maxScore ? `${item.maxScore}分` : '附加'),
    color: item.color || item.tone || 'slate',
    rule: item.rule
  })),
  notes: policy.notes?.length ? [...policy.notes] : [...DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.notes],
  evaluationSources: policy.evaluationSources?.length ? [...policy.evaluationSources] : ['self', 'leader'],
  evaluationWeights: { ...(policy.evaluationWeights || { self: 30, leader: 70 }) }
});

const DepartmentPerformancePolicyCard = ({ module, policy, canEdit, loading, saving, message, onSave, onReset }) => {
  const activePolicy = policy || DEFAULT_VOLUNTEER_PERFORMANCE_POLICY;
  const dimensions = activePolicy.dimensions?.length ? activePolicy.dimensions : DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.dimensions;
  const notes = activePolicy.notes?.length ? activePolicy.notes : DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.notes;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => createPolicyDraft(activePolicy));

  useEffect(() => {
    if (!editing) setDraft(createPolicyDraft(activePolicy));
  }, [activePolicy.id, activePolicy.version, activePolicy.updatedAt, editing]);

  const updateDraftDimension = (key, field, value) => {
    setDraft(current => ({
      ...current,
      dimensions: current.dimensions.map(item => {
        if (item.key !== key) return item;
        if (field === 'maxScore') {
          const score = value === '' ? '' : Math.max(0, Math.min(100, Number(value)));
          return { ...item, maxScore: score, capLabel: item.key === 'bonus' ? '附加' : `${score || 0}分` };
        }
        return { ...item, [field]: value };
      })
    }));
  };
  const addDimension = () => setDraft(current => ({ ...current, dimensions: [...current.dimensions, { key: `custom_${Date.now()}`, label: '新板块', maxScore: 10, capLabel: '10分', color: 'slate', rule: '请填写评分细则' }] }));
  const removeDimension = (key) => setDraft(current => ({ ...current, dimensions: current.dimensions.filter(item => item.key !== key) }));

  const submitDraft = async () => {
    if (!onSave) return;
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // 保持编辑态，避免保存失败时丢失用户正在调整的规则。
    }
  };

  return (
  <section className={cls('siehub-policy-card', editing && 'is-editing')}>
    <div className="siehub-policy-head">
      <div>
        <p>{module?.title || '部门工作台'} / VOLUNTEER PERFORMANCE</p>
        <h3>部门基础模板</h3>
        <span>{activePolicy.description || '当前先完整复刻 SIEVOX 的六维考核体系，后续再按部门单独微调。'}</span>
      </div>
      <div className="siehub-policy-actions">
        <b>{loading ? '同步中' : activePolicy.isCustomized ? `定制版 v${activePolicy.version || 1}` : canEdit ? '可编辑' : '只读'}</b>
        {canEdit && (
          <>
            {!editing ? (
              <button type="button" onClick={() => setEditing(true)} disabled={loading || saving}>编辑制度</button>
            ) : (
              <>
                <button type="button" className="ghost" onClick={() => { setDraft(createPolicyDraft(activePolicy)); setEditing(false); }} disabled={saving}>取消</button>
                <button type="button" onClick={submitDraft} disabled={saving}>{saving ? '保存中' : '保存制度'}</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
    <div className="siehub-policy-note">
      <ShieldCheck />
      <div>
        <strong>{activePolicy.sourceProduct || 'SIEVOX'} 同款模板</strong>
        <span>{module?.title || '该部门'}当前采用「{activePolicy.title || 'SIEVOX 志愿者绩效考核制度'}」{activePolicy.updatedBy?.name ? `，最近由 ${activePolicy.updatedBy.name} 更新` : ''}。学期末自评和上级评分按下列部门维度逐项填写。</span>
      </div>
      {canEdit && <button type="button" onClick={onReset} disabled={saving || loading}>恢复 SIEVOX 默认</button>}
    </div>
    {message && <div className="siehub-policy-message">{message}</div>}
    {editing && (
      <div className="siehub-policy-editor">
        <label className="siehub-latest-filter">
          <span>制度标题</span>
          <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          <span>制度说明</span>
          <textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} rows={3} />
        </label>
        {module?.key !== 'student_rights' && <>
          <label><span>评价来源（逗号分隔）</span><input value={(draft.evaluationSources || []).join(',')} onChange={event => setDraft(current => ({ ...current, evaluationSources: event.target.value.split(',').map(item => item.trim()).filter(Boolean) }))} /></label>
          <label><span>自评权重（%）</span><input type="number" value={draft.evaluationWeights?.self ?? 30} onChange={event => setDraft(current => ({ ...current, evaluationWeights: { ...current.evaluationWeights, self: Number(event.target.value || 0) } }))} /></label>
          <label><span>负责人权重（%）</span><input type="number" value={draft.evaluationWeights?.leader ?? 70} onChange={event => setDraft(current => ({ ...current, evaluationWeights: { ...current.evaluationWeights, leader: Number(event.target.value || 0) } }))} /></label>
          <button type="button" className="outline-button" onClick={addDimension}>新增绩效板块</button>
        </>}
      </div>
    )}
    <div className="siehub-policy-grid">
      {dimensions.map(item => (
        <article key={item.key} className={`siehub-policy-item tone-${item.tone || item.color || 'slate'}`}>
          {editing ? (
            <>
              <div className="siehub-policy-item-editor">
                <label>
                  <span>维度名称</span>
                  <input value={draft.dimensions.find(d => d.key === item.key)?.label || item.label} onChange={event => updateDraftDimension(item.key, 'label', event.target.value)} />
                </label>
                <label>
                  <span>{item.key === 'bonus' ? '计分方式' : '封顶分'}</span>
                  <input
                    type={item.key === 'bonus' ? 'text' : 'number'}
                    value={item.key === 'bonus' ? '附加' : (draft.dimensions.find(d => d.key === item.key)?.maxScore ?? '')}
                    disabled={item.key === 'bonus'}
                    onChange={event => updateDraftDimension(item.key, 'maxScore', event.target.value)}
                  />
                </label>
              </div>
              <textarea value={draft.dimensions.find(d => d.key === item.key)?.rule || item.rule} onChange={event => updateDraftDimension(item.key, 'rule', event.target.value)} rows={4} />
              {module?.key !== 'student_rights' && <button type="button" className="ghost" onClick={() => removeDimension(item.key)}>删除板块</button>}
            </>
          ) : (
            <>
              <span>{item.capLabel || (item.maxScore ? `${item.maxScore}分` : '附加')}</span>
              <strong>{item.label}</strong>
              <em>{item.rule}</em>
            </>
          )}
        </article>
      ))}
    </div>
    <div className="siehub-policy-footer">
      <span>{notes[0]}</span>
      <i></i>
      <span>{notes[1]}</span>
    </div>
  </section>
  );
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

const calculateDepartmentScoreRows = (records = [], roster = [], policy = DEFAULT_VOLUNTEER_PERFORMANCE_POLICY) => {
  const dimensions = policy?.dimensions?.length ? policy.dimensions : DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.dimensions;
  const caps = Object.fromEntries(dimensions.map(item => [item.key, item.maxScore]));
  const rows = new Map(roster.map(user => [user.id || user._id, { user, byDimension: {}, total: 0 }]));
  records.forEach(record => {
    const userId = record.volunteer?.id || record.volunteer?._id;
    if (!rows.has(userId)) return;
    const row = rows.get(userId);
    row.byDimension[record.dimension] = (row.byDimension[record.dimension] || 0) + Number(record.score || 0);
  });
  rows.forEach(row => {
    row.total = dimensions.reduce((sum, item) => {
      const raw = Math.max(0, row.byDimension[item.key] || 0);
      return sum + (item.key === 'bonus' || item.scoringMode === 'bonus' ? raw : Math.min(Number(caps[item.key] || 0), raw));
    }, 0);
  });
  return Array.from(rows.values()).sort((a, b) => b.total - a.total);
};

const DepartmentPerformanceWorkbench = ({ module, token, canManage, readOnly = false, period = '', onPeriodChange }) => {
  const [localPeriod, setLocalPeriod] = useState('');
  const selectedPeriod = period || localPeriod;
  const changePeriod = onPeriodChange || setLocalPeriod;
  const [workbench, setWorkbench] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [rosterSelection, setRosterSelection] = useState([]);
  const [recordSelection, setRecordSelection] = useState([]);
  const [form, setForm] = useState({
    dimension: 'attendance',
    score: '',
    reason: '',
    activityName: '',
    occurrenceDate: getTodayInputValue(),
    targetSemester: ''
  });

  const refreshWorkbench = useCallback(async () => {
    if (!module?.organization || !module?.key || !token || !canManage) return;
    setLoading(true);
    try {
      const query = selectedPeriod ? `?semester=${encodeURIComponent(selectedPeriod)}` : '';
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-workbench${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '获取部门绩效工作台失败');
      setWorkbench(data);
      if (!selectedPeriod) changePeriod(data.semester);
      const rosterIds = (data.roster || []).map(user => user.id || user._id);
      setRosterSelection(rosterIds);
      setRecordSelection(current => current.filter(id => rosterIds.includes(id)));
      setForm(current => ({
        ...current,
        targetSemester: data.semester || current.targetSemester,
        dimension: data.policy?.dimensions?.[0]?.key || current.dimension
      }));
    } catch (error) {
      setMessage(error.message || '获取部门绩效工作台失败');
    } finally {
      setLoading(false);
    }
  }, [module?.organization, module?.key, token, canManage, selectedPeriod, changePeriod]);

  useEffect(() => {
    refreshWorkbench();
  }, [refreshWorkbench]);

  if (!canManage) return null;

  const volunteers = workbench?.volunteers || [];
  const roster = workbench?.roster || [];
  const records = workbench?.records || [];
  const policy = workbench?.policy || DEFAULT_VOLUNTEER_PERFORMANCE_POLICY;
  const dimensions = policy.dimensions?.length ? policy.dimensions : DEFAULT_VOLUNTEER_PERFORMANCE_POLICY.dimensions;
  const scoreRows = calculateDepartmentScoreRows(records, roster, policy);

  const toggleRoster = (id) => {
    setRosterSelection(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const toggleRecordMember = (id) => {
    setRecordSelection(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const saveRoster = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-roster`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ semester: workbench?.semester || form.targetSemester, volunteerIds: rosterSelection })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '保存成员名单失败');
      setMessage('本学期绩效成员名单已保存。');
      await refreshWorkbench();
    } catch (error) {
      setMessage(error.message || '保存成员名单失败');
    } finally {
      setSaving(false);
    }
  };

  const submitPerformance = async (event) => {
    event.preventDefault();
    if (recordSelection.length === 0) return setMessage('请先选择要录入绩效的成员。');
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, volunteerIds: recordSelection, targetSemester: workbench?.semester || form.targetSemester })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '绩效录入失败');
      setMessage('绩效录入成功。');
      setRecordSelection([]);
      setForm(current => ({ ...current, score: '', reason: '', activityName: '', occurrenceDate: getTodayInputValue() }));
      await refreshWorkbench();
    } catch (error) {
      setMessage(error.message || '绩效录入失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (recordId) => {
    if (!window.confirm('确认撤回这条绩效记录吗？')) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-records/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '撤回失败');
      setMessage('绩效记录已撤回。');
      await refreshWorkbench();
    } catch (error) {
      setMessage(error.message || '撤回失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="siehub-performance-card">
      <div className="siehub-performance-head">
        <div>
          <p>DEPARTMENT PERFORMANCE</p>
          <h3>{readOnly ? '历史日常积分' : '学期活动绩效记录'}</h3>
          <span>{workbench?.semester || '当前学期'} · {readOnly ? '查看旧制积分流水与排行。' : '记录每次活动的绩效依据，期末逐项评分时可核对。'}</span>
        </div>
        <div className="unified-performance-period">
          <label htmlFor={`manage-performance-period-${module.key}`}>考核学期</label>
          <select id={`manage-performance-period-${module.key}`} value={selectedPeriod || workbench?.semester || ''} onChange={event => changePeriod(event.target.value)} disabled={loading || saving}>
            {(workbench?.semesters || []).map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={refreshWorkbench} disabled={loading || saving}>{loading ? '同步中' : '刷新'}</button>
        </div>
      </div>
      {message && <div className="siehub-policy-message">{message}</div>}
      <div className="siehub-performance-stats">
        <span><strong>{volunteers.length}</strong><em>部门志愿者账号</em></span>
        <span><strong>{roster.length}</strong><em>本学期成员</em></span>
        <span><strong>{records.length}</strong><em>绩效流水</em></span>
      </div>
      {!readOnly && <div className="siehub-performance-grid">
        <section className="siehub-performance-panel">
          <div className="siehub-performance-panel-head"><span>01</span><div><h4>添加本学期成员</h4><p>从该部门志愿者账号中选择参与绩效核算的成员。</p></div></div>
          <div className="siehub-member-checks">
            {volunteers.length === 0 ? <p className="siehub-empty-text">该部门还没有志愿者账号。</p> : volunteers.map(user => {
              const id = user.id || user._id;
              return (
                <label key={id} className="siehub-member-check">
                  <input className="siehub-checkbox" type="checkbox" checked={rosterSelection.includes(id)} onChange={() => toggleRoster(id)} />
                  <i aria-hidden="true"></i>
                  <span><strong>{user.name}</strong><small>{user.studentId}</small></span>
                </label>
              );
            })}
          </div>
          <button className="siehub-wide-action" type="button" onClick={saveRoster} disabled={saving || loading}>保存成员名单</button>
        </section>

        <form className="siehub-performance-panel" onSubmit={submitPerformance}>
          <div className="siehub-performance-panel-head"><span>02</span><div><h4>批量录入绩效</h4><p>成员必须先加入本学期名单，才能录入绩效。</p></div></div>
          <div className="siehub-record-targets">
            {roster.length === 0 ? <p className="siehub-empty-text">请先添加本学期成员。</p> : roster.map(user => {
              const id = user.id || user._id;
              return (
                <label key={id}>
                  <input className="siehub-checkbox" type="checkbox" checked={recordSelection.includes(id)} onChange={() => toggleRecordMember(id)} />
                  <i aria-hidden="true"></i>
                  <span>{user.name}</span>
                </label>
              );
            })}
          </div>
          <div className="siehub-performance-form-grid">
            <label><span>维度</span><select value={form.dimension} onChange={event => setForm({ ...form, dimension: event.target.value })}>{dimensions.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
            <label><span>加分</span><input type="number" step="0.5" min="0" value={form.score} onChange={event => setForm({ ...form, score: event.target.value })} required /></label>
            <label><span>日期</span><input type="date" value={form.occurrenceDate} onChange={event => setForm({ ...form, occurrenceDate: event.target.value })} required /></label>
            <label><span>事项名称</span><input value={form.activityName} onChange={event => setForm({ ...form, activityName: event.target.value })} placeholder="例：迎新活动统筹" required /></label>
          </div>
          <label className="siehub-performance-reason"><span>加分事由</span><textarea value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} rows={3} required /></label>
          <button className="siehub-wide-action" type="submit" disabled={saving || loading}>{saving ? '处理中' : '录入绩效'}</button>
        </form>
      </div>}

      <div className="siehub-performance-grid lower">
        <section className="siehub-performance-panel">
          <div className="siehub-performance-panel-head"><span>03</span><div><h4>部门排行</h4><p>按当前学期已录入流水实时计算。</p></div></div>
          <div className="siehub-score-list">
            {scoreRows.length === 0 ? <p className="siehub-empty-text">暂无排行数据。</p> : scoreRows.map((row, index) => (
              <div key={row.user.id || row.user._id} className="siehub-score-row">
                <b>{index + 1}</b>
                <span><strong>{row.user.name}</strong><small>{row.user.studentId}</small></span>
                <em>{row.total.toFixed(1)}</em>
              </div>
            ))}
          </div>
        </section>
        <section className="siehub-performance-panel">
          <div className="siehub-performance-panel-head"><span>04</span><div><h4>绩效流水</h4><p>最近录入的部门绩效记录。</p></div></div>
          <div className="siehub-record-list">
            {records.length === 0 ? <p className="siehub-empty-text">暂无绩效流水。</p> : records.slice(0, 10).map(record => {
              const dim = dimensions.find(item => item.key === record.dimension);
              return (
                <article key={record.id || record._id}>
                  <div><strong>{record.volunteer?.name || '成员'}</strong><small>{dim?.label || record.dimension} · {record.activityName || '常规记录'}</small><p>{record.reason}</p></div>
                  <span>+{record.score}</span>
                  {!readOnly && <button type="button" onClick={() => deleteRecord(record.id || record._id)}>撤回</button>}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
};

const DepartmentAccountWorkspace = ({ module, token, canManage, language = 'zh' }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const refreshAccounts = useCallback(async () => {
    if (!module?.organization || !module?.key || !token || !canManage) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '获取部门账号失败');
      setAccounts(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      setMessage(error.message || '获取部门账号失败');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [module?.organization, module?.key, token, canManage]);

  useEffect(() => { refreshAccounts(); }, [refreshAccounts]);

  if (!canManage) return null;

  return (
    <section className="siehub-module-workspace">
      <div className="siehub-module-workspace-head">
        <div>
          <p>DEPARTMENT ACCOUNTS</p>
          <h2>账号管理</h2>
          <span>仅显示本部门账号与身份信息。</span>
        </div>
        <button type="button" onClick={refreshAccounts} disabled={loading}>{loading ? '同步中' : '刷新'}</button>
      </div>
      {message && <div className="siehub-policy-message">{message}</div>}
      <div className="siehub-account-list">
        {accounts.map(account => (
          <article key={account._id}>
            <span className="siehub-avatar">{account.avatarUrl ? <img src={resolveMediaUrl(account.avatarUrl)} alt="" /> : firstChar(account.name)}</span>
            <div>
              <strong>{account.name}</strong>
              <small>{account.studentId} · {account.identityLabel || '-'}</small>
              <small>{account.departmentLabel || '-'}</small>
            </div>
          </article>
        ))}
        {accounts.length === 0 && <p className="siehub-empty-text">暂无部门账号。</p>}
      </div>
    </section>
  );
};

const formatDepartmentFileSize = (size = 0) => {
  const value = Number(size || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const DepartmentFileWorkspace = ({ module, token, canManage, canView = true, compact = false }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', description: '', files: [] });

  const refreshFiles = useCallback(async () => {
    if (!module?.organization || !module?.key || !token || !canView) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '获取部门资料失败');
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (error) {
      setMessage(error.message || '获取部门资料失败');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [module?.organization, module?.key, token, canView]);

  useEffect(() => { refreshFiles(); }, [refreshFiles]);

  const uploadFiles = async (event) => {
    event.preventDefault();
    if (!canManage) return setMessage('当前身份只能查看部门资料');
    if (!form.files.length) return setMessage('请选择要上传的部门资料');
    setUploading(true);
    setMessage('');
    try {
      const body = new FormData();
      form.files.forEach(file => body.append('files', file));
      body.append('title', form.title);
      body.append('description', form.description);
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '上传部门资料失败');
      setForm({ title: '', description: '', files: [] });
      setMessage(`已上传 ${data.files?.length || form.files.length} 个部门资料`);
      await refreshFiles();
    } catch (error) {
      setMessage(error.message || '上传部门资料失败');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (file) => {
    if (!canManage) return;
    const confirmed = window.confirm(`确认删除「${file.originalName || file.title || '该资料'}」吗？`);
    if (!confirmed) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/files/${file.id || file._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '删除部门资料失败');
      setMessage(data.message || '部门资料已删除');
      await refreshFiles();
    } catch (error) {
      setMessage(error.message || '删除部门资料失败');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = async (file) => {
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/files/${file.id || file._id}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('下载部门资料失败');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName || file.title || 'department-file';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message || '下载部门资料失败');
    }
  };

  if (!canView) return null;

  return (
    <section className={cls('siehub-module-workspace siehub-file-workspace', compact && 'compact')}>
      <div className="siehub-module-workspace-head">
        <div>
          <p>DEPARTMENT FILES</p>
          <h2>部门资料库</h2>
          <span>{canManage ? '上传、查看与删除本部门工作资料；志愿者可查看下载。' : '查看本部门共享资料，下载后按部门要求使用。'}</span>
        </div>
        <button type="button" onClick={refreshFiles} disabled={loading}>{loading ? '同步中' : '刷新'}</button>
      </div>
      {canManage && (
        <form className="siehub-file-upload" onSubmit={uploadFiles}>
          <label>
            <span>资料标题</span>
            <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="可选，默认使用文件名" />
          </label>
          <label>
            <span>资料说明</span>
            <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="可选，说明文件用途、适用活动或届次" rows={3} />
          </label>
          <label className="siehub-file-picker">
            <input type="file" multiple onChange={event => setForm(current => ({ ...current, files: Array.from(event.target.files || []) }))} />
            <Paperclip />
            <strong>{form.files.length ? `已选择 ${form.files.length} 个文件` : '选择部门资料'}</strong>
            <span>{form.files.length ? form.files.map(file => file.name).join('、') : '支持多文件上传，单个文件不超过 200MB'}</span>
          </label>
          <button type="submit" disabled={uploading || !form.files.length}>{uploading ? '上传中' : '上传资料'}</button>
        </form>
      )}
      {message && <div className="siehub-policy-message">{message}</div>}
      <div className="siehub-file-list">
        {files.map(file => (
          <article key={file.id || file._id}>
            <span className="siehub-file-icon"><FileText /></span>
            <div>
              <strong>{file.title || file.originalName}</strong>
              <small>{file.originalName} · {formatDepartmentFileSize(file.size)}</small>
              <small>{file.uploader?.name || '成员'} 上传 · {formatNoticeDate(file.createdAt)}</small>
              {file.description && <p>{file.description}</p>}
            </div>
            <button type="button" onClick={() => downloadFile(file)}>
              <Download />下载
            </button>
            {canManage && (
              <button type="button" className="danger" onClick={() => deleteFile(file)} disabled={loading}>
                删除
              </button>
            )}
          </article>
        ))}
        {files.length === 0 && <p className="siehub-empty-text">{loading ? '资料同步中...' : '暂无部门资料。'}</p>}
      </div>
    </section>
  );
};

const DEPARTMENT_MEMBER_TIER_META = [
  { key: 'presidium', rank: 0, label: '主席层级', shortLabel: '主席层级' },
  { key: 'department_lead', rank: 1, label: '负责人层级', shortLabel: '负责人层级' },
  { key: 'volunteer', rank: 2, label: '志愿者', shortLabel: '志愿者' }
];

const getDepartmentMemberTierRank = (member = {}) => {
  const positionTitle = member.positionTitle || member.user?.positionTitle || 'student';
  const memberRole = member.memberRole || member.user?.memberRole || 'student';
  if (['presidium_member', 'youth_league_deputy_secretary'].includes(positionTitle) || memberRole === 'presidium') return 0;
  if (['department_head', 'youth_league_cadre'].includes(positionTitle) || memberRole === 'department_lead') return 1;
  return 2;
};

const groupDepartmentMembersByTier = (members = []) => {
  const groups = DEPARTMENT_MEMBER_TIER_META.map(meta => ({ ...meta, members: [] }));
  members.forEach(member => {
    const tier = getDepartmentMemberTierRank(member);
    const target = groups.find(item => item.rank === tier);
    if (target) target.members.push(member);
  });
  return groups;
};

const getDepartmentTierLabel = (rank, organization) => {
  if (rank === 0) return organization === 'youth_league' ? '团委学生兼职副书记' : '主席团成员';
  if (rank === 1) return organization === 'youth_league' ? '团委学生兼职团干部' : '部门负责人';
  return '志愿者';
};

const getDepartmentMemberRoleTitle = (member = {}) => {
  const positionTitle = member.positionTitle || member.user?.positionTitle || '';
  if (positionTitle === 'presidium_member') return '主席团成员';
  if (positionTitle === 'youth_league_deputy_secretary') return '团委学生兼职副书记';
  if (positionTitle === 'youth_league_cadre') return '团委学生兼职团干部';
  if (positionTitle === 'department_head') return '部门负责人';
  if (positionTitle === 'volunteer' || member.memberRole === 'volunteer') return '志愿者';
  return member.identityLabel || member.memberRoleLabel || '-';
};

const DepartmentMemberWorkspace = ({ module, token, canManage, language = 'zh' }) => {
  const [currentMembers, setCurrentMembers] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [studentIdToAdd, setStudentIdToAdd] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const refreshMembers = useCallback(async () => {
    if (!module?.organization || !module?.key || !token || !canManage) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '获取部门成员失败');
      setCurrentMembers(Array.isArray(data.current) ? data.current : []);
      setCohorts(Array.isArray(data.cohorts) ? data.cohorts : []);
    } catch {
      setCurrentMembers([]);
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  }, [module?.organization, module?.key, token, canManage]);

  useEffect(() => { refreshMembers(); }, [refreshMembers]);
  const currentMemberGroups = useMemo(() => groupDepartmentMembersByTier(currentMembers), [currentMembers]);
  const cohortGroups = useMemo(() => cohorts.map(group => ({
    ...group,
    tierGroups: groupDepartmentMembersByTier(group.members || [])
  })), [cohorts]);

  const addDepartmentVolunteer = async (event) => {
    event.preventDefault();
    const cleanStudentId = studentIdToAdd.trim();
    if (!cleanStudentId) return setMessage('请输入要添加的成员学号');
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: cleanStudentId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '添加部门志愿者失败');
      setStudentIdToAdd('');
      setMessage(data.message || '已添加为本部门志愿者');
      await refreshMembers();
    } catch (error) {
      setMessage(error.message || '添加部门志愿者失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteDepartmentVolunteer = async (member) => {
    const targetId = member?.userId || member?.id || member?._id || member?.studentId;
    if (!targetId) return setMessage('缺少要删除的成员标识');
    const confirmed = window.confirm(`确认从本部门删除志愿者「${member?.name || member?.studentId || ''}」吗？该账号会降级为普通学生，历届归档不会被删除。`);
    if (!confirmed) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/members/${targetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '删除部门志愿者失败');
      setMessage(data.message || '已删除本部门志愿者');
      await refreshMembers();
    } catch (error) {
      setMessage(error.message || '删除部门志愿者失败');
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) return null;

  return (
    <section className="siehub-module-workspace">
      <div className="siehub-module-workspace-head">
        <div>
          <p>DEPARTMENT MEMBERS</p>
          <h2>成员管理</h2>
          <span>仅展示本部门成员与历届归档信息；届次归档操作只保留在终极管理员端。</span>
        </div>
        <button type="button" onClick={refreshMembers} disabled={loading}>{loading ? '同步中' : '刷新'}</button>
      </div>
      <form className="siehub-member-add-form" onSubmit={addDepartmentVolunteer}>
        <label>
          <span>添加本部门志愿者</span>
          <input value={studentIdToAdd} onChange={event => setStudentIdToAdd(event.target.value)} placeholder="输入10位学号" inputMode="numeric" />
        </label>
        <button type="submit" disabled={loading || !studentIdToAdd.trim()}>添加</button>
      </form>
      {message && <div className="siehub-policy-message">{message}</div>}
      <section className="siehub-member-section">
        <div className="siehub-member-section-head">
          <strong>当前成员</strong>
          <span>{currentMembers.length} 人</span>
        </div>
        {currentMembers.length === 0 ? (
          <p className="siehub-empty-text">暂无当前成员。</p>
        ) : (
          <div className="siehub-member-tier-list">
            {currentMemberGroups.map(group => group.members.length > 0 && (
              <section key={group.key} className="siehub-member-tier-section" data-tier={group.rank}>
                <div className="siehub-member-tier-head">
                  <div>
                    <strong>{getDepartmentTierLabel(group.rank, module.organization)}</strong>
                    <small>{group.members.length} 人</small>
                  </div>
                </div>
                <div className="siehub-member-grid compact">
                  {group.members.map(member => (
                    <article key={member.id || member.userId} className="siehub-member-tier-card" data-tier={group.rank}>
                      <span className="siehub-avatar">{member.avatarUrl ? <img src={resolveMediaUrl(member.avatarUrl)} alt="" /> : firstChar(member.name)}</span>
                      <div>
                        <strong>{member.name}</strong>
                        <small>{member.studentId}</small>
                        <small>{getDepartmentMemberRoleTitle(member)}</small>
                        {member.showPerformance && <small>绩效总成绩：{member.performanceSnapshot?.total == null ? '待完成' : member.performanceSnapshot.total}</small>}
                      </div>
                      {group.rank === 2 && (
                        <button type="button" className="siehub-member-delete-button" onClick={() => deleteDepartmentVolunteer(member)} disabled={loading}>
                          删除
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      <section className="siehub-member-section">
        <div className="siehub-member-section-head">
          <strong>历届成员归档</strong>
          <span>{cohorts.reduce((total, group) => total + (group.members?.length || 0), 0)} 人</span>
        </div>
        <div className="siehub-cohort-list">
          {cohortGroups.map(group => (
            <article key={group.cohort?.id || group.cohort?.name} className="siehub-cohort-card">
              <header>
                <div>
                  <strong>{group.cohort?.name || '未命名届次'}</strong>
                  <small>{group.cohort?.semesters?.length ? group.cohort.semesters.join(' / ') : '未绑定绩效学期'}</small>
                </div>
                <span>{group.members?.length || 0} 人</span>
              </header>
              <div className="siehub-member-tier-list">
                {group.tierGroups.map(tier => tier.members.length > 0 && (
                  <section key={tier.key} className="siehub-member-tier-section" data-tier={tier.rank}>
                    <div className="siehub-member-tier-head">
                      <div>
                        <strong>{getDepartmentTierLabel(tier.rank, module.organization)}</strong>
                        <small>{tier.members.length} 人</small>
                      </div>
                    </div>
                    <div className="siehub-member-grid compact">
                      {tier.members.map(member => (
                        <article key={member.id || `${group.cohort?.id}-${member.studentId}`} className="siehub-member-tier-card" data-tier={tier.rank}>
                          <span className="siehub-avatar">{member.avatarUrl ? <img src={resolveMediaUrl(member.avatarUrl)} alt="" /> : firstChar(member.name)}</span>
                          <div>
                            <strong>{member.name}</strong>
                            <small>{member.studentId}</small>
                            <small>{getDepartmentMemberRoleTitle(member)}</small>
                            {member.showPerformance && <small>绩效总成绩：{member.performanceSnapshot?.total == null ? '待完成' : member.performanceSnapshot.total}</small>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
          {cohorts.length === 0 && <p className="siehub-empty-text">暂无历届归档成员。</p>}
        </div>
      </section>
    </section>
  );
};

const getAccessibleModules = (user) => {
  if (user?.isUltimateAdmin) return SIEHUB_MODULES;

  const rawCapabilities = Array.isArray(user?.moduleCapabilities) ? user.moduleCapabilities : [];
  const capabilities = rawCapabilities.map(item => typeof item === 'string' ? item : item?.department || item?.key).filter(Boolean);
  const managed = Array.isArray(user?.managedDepartments) ? user.managedDepartments.map(item => item?.department || item).filter(Boolean) : [];
  const departments = [...new Set([...capabilities, ...managed, user?.department].filter(Boolean))];

  if (departments.length) return SIEHUB_MODULES.filter(module => !module.ultimateOnly && departments.includes(module.key));
  if (user?.role === 'student' || user?.memberRole === 'student') {
    return SIEHUB_MODULES.filter(module => !module.ultimateOnly);
  }
  return [];
};

const HubUserChip = ({ user }) => (
  <div className="siehub-user-chip" aria-label="当前登录身份">
    <span className="siehub-avatar">{user?.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" /> : firstChar(user?.name)}</span>
    <span><strong>{user?.name}</strong><small>{user?.studentId}</small></span>
    <RoleTag user={user} />
  </div>
);

const canViewMySecurityTools = (user = {}) =>
  Boolean(
    user?.isUltimateAdmin ||
    (user?.role === 'superadmin' && (!user?.positionTitle || user?.positionTitle === 'student')) ||
    ['presidium_member', 'youth_league_deputy_secretary'].includes(user?.positionTitle)
  );

const SIEHUBMobileDock = ({ active = 'home', onHome, onDepartments = onHome, onMy }) => (
  <nav className="siehub-mobile-dock" aria-label="SIEHUB mobile navigation">
    <button type="button" className={active === 'home' ? 'is-active' : ''} onClick={onHome}><House /><span>首页</span></button>
    <button type="button" className={active === 'departments' ? 'is-active' : ''} onClick={onDepartments}><Building2 /><span>部门</span></button>
    <button type="button" className={active === 'my' ? 'is-active' : ''} onClick={onMy}><UserRound /><span>账号设置</span></button>
  </nav>
);

const MyProfileWindow = ({ user, token, theme, onBack, onOpenDepartments, onOpenMy = () => {}, onLogout, onRefreshUser, languageSwitcher = null }) => {
  const [profile, setProfile] = useState({ name: user?.name || '', studentId: user?.studentId || '', email: user?.email || '', phone: user?.phone || '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [resetForm, setResetForm] = useState({ studentId: '', newPassword: '', confirmPassword: '' });
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailVerification, setEmailVerification] = useState({ currentPassword: '', emailCode: '' });
  const [emailSending, setEmailSending] = useState(false);
  const emailChanged = profile.email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase();
  const showSecurity = canViewMySecurityTools(user);

  useEffect(() => {
    setProfile({ name: user?.name || '', studentId: user?.studentId || '', email: user?.email || '', phone: user?.phone || '' });
  }, [user?.name, user?.studentId, user?.email, user?.phone]);

  const refreshLogs = useCallback(async () => {
    if (!showSecurity || !token) return;
    try {
      const res = await fetch(`${API_BASE}/my/login-logs`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setLogs(data.logs || []);
    } catch {
      setLogs([]);
    }
  }, [showSecurity, token]);

  useEffect(() => { refreshLogs(); }, [refreshLogs]);

  const sendProfileEmailCode = async () => {
    if (!emailVerification.currentPassword) return setMessage('请先输入当前密码');
    setEmailSending(true);
    try {
      const data = await requestJson('/auth/email-code/profile-email', token, { method: 'POST', body: JSON.stringify({ email: profile.email, currentPassword: emailVerification.currentPassword }) });
      setMessage(data.message || '验证码已发送至新邮箱');
    } catch (error) { setMessage(error.message); }
    finally { setEmailSending(false); }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...profile, studentId: user.studentId, ...(emailChanged ? emailVerification : {}) })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '资料保存失败');
      if (data.sessionRevoked) { alert('邮箱已更新，请重新登录'); onLogout(); return; }
      await onRefreshUser?.();
      setMessage('资料已更新');
    } catch (error) {
      setMessage(error.message || '资料保存失败');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '密码修改失败');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      alert('密码已更新，请重新登录');
      onLogout();
    } catch (error) {
      setMessage(error.message || '密码修改失败');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch(`${API_BASE}/auth/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '头像上传失败');
      await onRefreshUser?.();
      setMessage('头像已更新');
    } catch (error) {
      setMessage(error.message || '头像上传失败');
    } finally {
      setSaving(false);
      event.target.value = '';
    }
  };

  const resetUserPassword = async (event) => {
    event.preventDefault();
    if (!resetForm.studentId.trim()) return setMessage('请输入需要重置密码的学号');
    if (resetForm.newPassword !== resetForm.confirmPassword) return setMessage('两次输入的新密码不一致');
    if (resetForm.newPassword.length < 6) return setMessage('新密码至少需要6位');
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(resetForm.studentId.trim())}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: resetForm.newPassword })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '密码重置失败');
      setResetForm({ studentId: '', newPassword: '', confirmPassword: '' });
      setMessage(data.message || '密码已重置');
    } catch (error) {
      setMessage(error.message || '密码重置失败');
    } finally {
      setSaving(false);
    }
  };

  return <main className="siehub-shell siehub-my-shell">
    <header className="siehub-topbar">
      <div className="siehub-brand"><span className="siehub-brand-mark"><img src={siehubLogo} alt="SIEHUB" /><i></i></span><div><strong>SIEHUB</strong><small>ACCOUNT SETTINGS</small></div></div>
      <div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)}><Palette /></button><HubUserChip user={user} /><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div>
    </header>
    <div className="siehub-content">
      <button className="siehub-back" type="button" onClick={onBack}><ChevronLeft />返回 SIEHUB</button>
      <section className="siehub-my-hero">
        <span className="siehub-avatar siehub-my-avatar">{user?.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" /> : firstChar(user?.name)}</span>
        <div><p>ACCOUNT SETTINGS</p><h1>账号设置</h1><span>{user?.identityLabel || '学生账号'} · {user?.studentId}</span></div>
        <label className="siehub-avatar-upload"><ImagePlus /><span>更换头像</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadAvatar} /></label>
      </section>
      {message && <div className="siehub-policy-message">{message}</div>}
      <div className="siehub-my-grid">
        <form className="siehub-my-card" onSubmit={saveProfile}>
          <div className="siehub-my-card-head"><IdCard /><div><h2>账号信息</h2><p>更新姓名、邮箱、手机号等基础信息。</p></div></div>
          <label><span>姓名</span><input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} required /></label>
          <label><span>学号</span><input value={profile.studentId} readOnly /></label>
          <label><span>邮箱</span><input type="email" value={profile.email} onChange={event => setProfile({ ...profile, email: event.target.value })} required /></label>
          {emailChanged && <>
            <label><span>当前密码（验证邮箱变更）</span><input type="password" required value={emailVerification.currentPassword} onChange={event => setEmailVerification({ ...emailVerification, currentPassword: event.target.value })} /></label>
            <label><span>新邮箱验证码</span><input inputMode="numeric" required maxLength={6} value={emailVerification.emailCode} onChange={event => setEmailVerification({ ...emailVerification, emailCode: event.target.value.replace(/\D/g, '').slice(0, 6) })} /></label>
            <button type="button" disabled={emailSending || saving} onClick={sendProfileEmailCode}>{emailSending ? '发送中' : '发送新邮箱验证码'}</button>
          </>}
          <label><span>手机号</span><input value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={saving}>保存信息</button>
        </form>
        <form className="siehub-my-card" onSubmit={changePassword}>
          <div className="siehub-my-card-head"><KeyRound /><div><h2>密码修改</h2><p>使用当前密码校验后设置新密码。</p></div></div>
          <label><span>当前密码</span><input type="password" value={passwordForm.currentPassword} onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></label>
          <label><span>新密码</span><input type="password" value={passwordForm.newPassword} onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></label>
          <label><span>确认新密码</span><input type="password" value={passwordForm.confirmPassword} onChange={event => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} required /></label>
          <button className="primary-button" type="submit" disabled={saving}>修改密码</button>
        </form>
        {showSecurity && (
          <>
            <form className="siehub-my-card" onSubmit={resetUserPassword}>
              <div className="siehub-my-card-head"><ShieldCheck /><div><h2>密码重置</h2><p>仅超级管理员、主席/团副与终极管理员可使用。</p></div></div>
              <label><span>目标学号</span><input value={resetForm.studentId} onChange={event => setResetForm({ ...resetForm, studentId: event.target.value })} required /></label>
              <label><span>新密码</span><input type="password" value={resetForm.newPassword} onChange={event => setResetForm({ ...resetForm, newPassword: event.target.value })} required /></label>
              <label><span>确认新密码</span><input type="password" value={resetForm.confirmPassword} onChange={event => setResetForm({ ...resetForm, confirmPassword: event.target.value })} required /></label>
              <button className="primary-button" type="submit" disabled={saving}>重置密码</button>
            </form>
            <section className="siehub-my-card siehub-login-log-card">
              <div className="siehub-my-card-head"><Clock3 /><div><h2>登录日志</h2><p>仅超级管理员、主席/团副与终极管理员可查看。</p></div></div>
              <button className="outline-button" type="button" onClick={refreshLogs}>刷新日志</button>
              <div className="siehub-login-log-list">
                {logs.length === 0 ? <p className="siehub-empty-text">暂无登录日志。</p> : logs.map(item => (
                  <article key={item.id}>
                    <b className={item.success ? 'success' : 'danger'}>{item.success ? '成功' : '失败'}</b>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    <small>{item.ip || 'unknown'} · {item.reason || '-'}</small>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
    <SIEHUBMobileDock active="my" onHome={onBack} onDepartments={onOpenDepartments} onMy={() => {}} />
    <ThemePanel theme={theme} />
  </main>;
};

const pickLocalizedNoticeText = (value = {}, language = 'zh') =>
  (language === 'en' ? value.en || value.zh : value.zh || value.en) || '';

const formatNoticeDate = (value, language = 'zh') => {
  if (!value) return language === 'en' ? 'Unpublished' : '未发布';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
};

const formatNoticeFilterDate = (value) => value || '';

const NoticeDateField = ({ value, onChange, language = 'zh', kind = 'start' }) => {
  const inputRef = useRef(null);
  const isStart = kind === 'start';
  const label = language === 'en'
    ? (isStart ? 'Start date' : 'End date')
    : (isStart ? '选择起始日期' : '选择终止日期');

  const openDatePicker = (event) => {
    event.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch (error) {
        // Some mobile browsers expose showPicker but reject it; fall back below.
      }
    }
    input.focus();
    input.click();
  };

  return (
    <label className="siehub-date-field" role="button" tabIndex={0} onClick={openDatePicker} onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') openDatePicker(event);
    }}>
      <span className={cls('siehub-date-field-display', !value && 'is-placeholder')}>
        {value ? formatNoticeFilterDate(value) : label}
      </span>
      <input ref={inputRef} type="date" value={value} onClick={event => event.stopPropagation()} onChange={event => onChange(event.target.value)} aria-label={label} />
    </label>
  );
};

const noticeDepartmentOptions = () => SIEHUB_MODULES
  .filter(module => module.organization !== 'hub')
  .map(module => ({
    value: `${module.organization}:${module.key}`,
    organization: module.organization,
    department: module.key,
    label: module.title
  }));

const emptyNoticeDraft = {
  title: { zh: '', en: '' },
  summary: { zh: '', en: '' },
  body: { zh: '', en: '' },
  coverImageUrl: '',
  sourceUrl: '',
  status: 'draft',
  publishedAt: '',
  heroEnabled: false,
  heroOrder: 0
};

const cloneNoticeDraft = (notice = emptyNoticeDraft) => ({
  title: { zh: notice.title?.zh || '', en: notice.title?.en || '' },
  summary: { zh: notice.summary?.zh || '', en: notice.summary?.en || '' },
  body: { zh: notice.body?.zh || '', en: notice.body?.en || '' },
  coverImageUrl: notice.coverImageUrl || '',
  sourceUrl: notice.sourceUrl || '',
  status: notice.status || 'draft',
  publishedAt: notice.publishedAt || '',
  heroEnabled: Boolean(notice.heroEnabled),
  heroOrder: Number(notice.heroOrder || 0)
});

const localizedFieldPatch = (draft, field, languageKey, value) => ({
  ...draft,
  [field]: { ...(draft[field] || {}), [languageKey]: value }
});

const noticeIdentity = (notice) => String(notice?.id || notice?._id || notice?.sourceExternalId || '');
const noticeReadStorageKey = (user, fixedModule = null) => {
  const userKey = user?.id || user?._id || user?.studentId || 'guest';
  const moduleKey = fixedModule ? `${fixedModule.organization}:${fixedModule.key}` : 'hub';
  return `siehub_notice_reads_v1:${userKey}:${moduleKey}`;
};

const readNoticeReadIds = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const writeNoticeReadIds = (key, ids) => {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage errors so the notice center still works in private mode.
  }
};

const NoticeDetailPage = ({ notice, language = 'zh', onBack }) => {
  const title = pickLocalizedNoticeText(notice?.title, language) || (language === 'en' ? 'Untitled notice' : '未命名通知');
  const summary = pickLocalizedNoticeText(notice?.summary, language);
  const body = pickLocalizedNoticeText(notice?.body, language);

  return (
    <section className="siehub-notice-detail-page">
      <button className="siehub-back" type="button" onClick={onBack}><ChevronLeft />{language === 'en' ? 'Back to notices' : '返回通知公告'}</button>
      <article className="siehub-notice-detail-card">
        {notice?.coverImageUrl && <img className="siehub-notice-detail-cover" src={notice.coverImageUrl} alt="" />}
        <header>
          <p>{notice?.organizationLabel} · {notice?.departmentLabel} · {formatNoticeDate(notice?.publishedAt, language)}</p>
          <h2>{title}</h2>
          {summary && <span>{summary}</span>}
        </header>
        <div className="siehub-notice-detail-body">
          {body ? body.split(/\r?\n/).filter(Boolean).map((paragraph, index) => (
            <p key={`${noticeIdentity(notice)}-${index}`}>{paragraph}</p>
          )) : (
            <p className="siehub-empty-text">{language === 'en' ? 'No body content has been added for this notice.' : '该通知暂未填写正文。'}</p>
          )}
        </div>
        {notice?.sourceUrl && (
          <footer>
            <a href={notice.sourceUrl} target="_blank" rel="noreferrer">
              {language === 'en' ? 'Open attached link' : '打开附加链接'}
              <ArrowUpRight />
            </a>
          </footer>
        )}
      </article>
    </section>
  );
};

const SIEHUB_NEWS_PAGE_SIZE = 5;

const SIEHUBNoticePortal = ({ token, language = 'zh', fixedModule = null, user = null, refreshKey = 0 }) => {
  const [news, setNews] = useState([]);
  const [newsSlideIndex, setNewsSlideIndex] = useState(0);
  const [newsPageIndex, setNewsPageIndex] = useState(0);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [filters, setFilters] = useState({
    departmentKey: fixedModule ? `${fixedModule.organization}:${fixedModule.key}` : '',
    dateFrom: '',
    dateTo: '',
    latestOnly: false
  });
  const departments = useMemo(noticeDepartmentOptions, []);
  const readStorageKey = useMemo(() => noticeReadStorageKey(user, fixedModule), [user?.id, user?._id, user?.studentId, fixedModule?.organization, fixedModule?.key]);
  const [readNoticeIds, setReadNoticeIds] = useState(() => new Set(readNoticeReadIds(readStorageKey)));

  useEffect(() => {
    setReadNoticeIds(new Set(readNoticeReadIds(readStorageKey)));
  }, [readStorageKey]);

  useEffect(() => {
    if (fixedModule) {
      setFilters(current => ({ ...current, departmentKey: `${fixedModule.organization}:${fixedModule.key}` }));
    }
  }, [fixedModule?.organization, fixedModule?.key]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    const selected = departments.find(item => item.value === filters.departmentKey);
    const noticeParams = new URLSearchParams({ source: 'manual' });
    const newsParams = new URLSearchParams({ source: 'wechat_mp', limit: 'all' });
    if (filters.latestOnly) noticeParams.set('limit', '8');
    if (selected) {
      noticeParams.set('organization', selected.organization);
      noticeParams.set('department', selected.department);
    }
    if (filters.dateFrom) noticeParams.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) noticeParams.set('dateTo', filters.dateTo);

    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/hub/notices?${newsParams.toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }).then(res => res.ok ? res.json() : Promise.reject(new Error('news_fetch_failed'))),
      fetch(`${API_BASE}/hub/notices?${noticeParams.toString()}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }).then(res => res.ok ? res.json() : Promise.reject(new Error('notice_fetch_failed')))
    ])
      .then(([newsData, noticeData]) => {
        setNews(Array.isArray(newsData.notices) ? newsData.notices : []);
        setNotices(Array.isArray(noticeData.notices) ? noticeData.notices : []);
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          setNews([]);
          setNotices([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, filters, departments, refreshKey]);

  const carouselNews = news;
  const newsSignature = carouselNews.map(noticeIdentity).join('|');

  useEffect(() => {
    setNewsSlideIndex(0);
    setNewsPageIndex(0);
  }, [newsSignature]);

  useEffect(() => {
    if (carouselNews.length <= 1) return undefined;
    const timer = setInterval(() => {
      setNewsSlideIndex(current => (current + 1) % carouselNews.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [carouselNews.length]);

  const unreadNoticeCount = notices.reduce((count, notice) => {
    const id = noticeIdentity(notice);
    return id && !readNoticeIds.has(id) ? count + 1 : count;
  }, 0);

  const markNoticeRead = (notice) => {
    const id = noticeIdentity(notice);
    if (!id || readNoticeIds.has(id)) return;
    setReadNoticeIds(current => {
      const next = new Set(current);
      next.add(id);
      writeNoticeReadIds(readStorageKey, next);
      return next;
    });
  };

  const openNotice = (notice) => {
    markNoticeRead(notice);
    setSelectedNotice(notice);
  };

  const activeNewsSlideIndex = carouselNews.length ? newsSlideIndex % carouselNews.length : 0;
  const featureNews = carouselNews.length ? carouselNews[activeNewsSlideIndex] : null;
  const featureNewsKey = noticeIdentity(featureNews) || `wechat-news-${activeNewsSlideIndex}`;
  const featureNewsTitle = pickLocalizedNoticeText(featureNews?.title, language);
  const featureNewsDate = formatNoticeDate(featureNews?.publishedAt, language);
  const featureNewsHref = featureNews?.sourceUrl || '';
  const featureNewsCover = featureNews?.coverImageUrl || '';
  const newsPageCount = Math.max(1, Math.ceil(carouselNews.length / SIEHUB_NEWS_PAGE_SIZE));
  const visibleNewsPageIndex = Math.min(newsPageIndex, newsPageCount - 1);
  const pagedNews = carouselNews.slice(
    visibleNewsPageIndex * SIEHUB_NEWS_PAGE_SIZE,
    visibleNewsPageIndex * SIEHUB_NEWS_PAGE_SIZE + SIEHUB_NEWS_PAGE_SIZE
  );
  const shiftNewsSlide = (direction) => {
    if (!carouselNews.length) return;
    setNewsSlideIndex(current => (current + direction + carouselNews.length) % carouselNews.length);
  };

  if (selectedNotice) {
    return (
      <section className="siehub-school-notice-center">
        <NoticeDetailPage notice={selectedNotice} language={language} onBack={() => setSelectedNotice(null)} />
      </section>
    );
  }

  return (
    <section className="siehub-school-notice-center">
      <header className="siehub-school-notice-head">
        <div>
          <p>{language === 'en' ? 'SIEHUB MESSAGE CENTER' : 'SIEHUB 消息中心'}</p>
          <h2>{language === 'en' ? 'News & Notices' : '新闻动态 · 通知公告'}</h2>
        </div>
        {unreadNoticeCount > 0 && <span className="siehub-unread-badge" aria-label={`未读消息 ${unreadNoticeCount}`}>{unreadNoticeCount > 99 ? '99+' : unreadNoticeCount}</span>}
      </header>
      <div className="siehub-notice-filters siehub-school-notice-filters">
        <select
          value={filters.departmentKey}
          disabled={Boolean(fixedModule)}
          onChange={event => setFilters(current => ({ ...current, departmentKey: event.target.value }))}
        >
          <option value="">{language === 'en' ? 'All departments' : '全部部门'}</option>
          {departments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <NoticeDateField value={filters.dateFrom} language={language} kind="start" onChange={dateFrom => setFilters(current => ({ ...current, dateFrom }))} />
        <NoticeDateField value={filters.dateTo} language={language} kind="end" onChange={dateTo => setFilters(current => ({ ...current, dateTo }))} />
        <label className="siehub-latest-filter">
          <input className="siehub-checkbox" type="checkbox" checked={filters.latestOnly} onChange={event => setFilters(current => ({ ...current, latestOnly: event.target.checked }))} />
          <i aria-hidden="true"></i>
          <span>{language === 'en' ? 'Latest only' : '仅看最新'}</span>
        </label>
      </div>
      <div className="siehub-school-notice-grid">
        <section className="siehub-school-news-panel">
          <div className="siehub-school-panel-title"><span>NEWS</span><h3>{language === 'en' ? 'News' : '新闻动态'}</h3></div>
          {loading ? (
            <p className="siehub-empty-text">{language === 'en' ? 'Loading news...' : '正在同步新闻...'}</p>
          ) : featureNews ? (
            <div className="siehub-school-news-carousel">
              <button
                key={featureNewsKey}
                className="siehub-school-feature-news"
                type="button"
                onClick={() => featureNewsHref && window.open(featureNewsHref, '_blank', 'noopener,noreferrer')}
              >
                {featureNewsCover ? <img key={`${featureNewsKey}-cover`} src={featureNewsCover} alt={featureNewsTitle} /> : <span className="siehub-news-cover-fallback">SIE</span>}
                <span className="siehub-school-news-caption">
                  <strong key={`${featureNewsKey}-title`}>{featureNewsTitle}</strong>
                  <small key={`${featureNewsKey}-date`}>{featureNewsDate}</small>
                </span>
              </button>
              {carouselNews.length > 1 && (
                <div className="siehub-school-carousel-controls">
                  <button type="button" onClick={() => shiftNewsSlide(-1)} aria-label="上一条推文"><ArrowLeft /></button>
                  <div>
                    {carouselNews.map((item, index) => (
                      <button
                        key={noticeIdentity(item)}
                        type="button"
                        className={index === activeNewsSlideIndex ? 'is-active' : ''}
                        onClick={() => setNewsSlideIndex(index)}
                        aria-label={`第 ${index + 1} 条推文`}
                      />
                    ))}
                  </div>
                  <button type="button" onClick={() => shiftNewsSlide(1)} aria-label="下一条推文"><ArrowRight /></button>
                </div>
              )}
              {carouselNews.length > 1 && (
                <>
                  <div className="siehub-school-news-list">
                    {pagedNews.map((item, index) => {
                      const originalIndex = visibleNewsPageIndex * SIEHUB_NEWS_PAGE_SIZE + index;
                      return (
                    <button
                      key={noticeIdentity(item)}
                      type="button"
                      className={originalIndex === activeNewsSlideIndex ? 'is-active' : ''}
                      onClick={() => {
                        setNewsSlideIndex(originalIndex);
                        if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <span>{formatNoticeDate(item.publishedAt, language)}</span>
                      <strong>{pickLocalizedNoticeText(item.title, language)}</strong>
                      {item.sourceUrl && <ArrowUpRight />}
                    </button>
                      );
                    })}
                  </div>
                  {newsPageCount > 1 && (
                    <div className="siehub-school-news-pagination">
                      <button
                        type="button"
                        onClick={() => setNewsPageIndex(current => Math.max(0, current - 1))}
                        disabled={visibleNewsPageIndex <= 0}
                        aria-label={language === 'en' ? 'Previous news page' : '上一页新闻'}
                      >
                        <ArrowLeft />
                      </button>
                      <span>{visibleNewsPageIndex + 1} / {newsPageCount}</span>
                      <button
                        type="button"
                        onClick={() => setNewsPageIndex(current => Math.min(newsPageCount - 1, current + 1))}
                        disabled={visibleNewsPageIndex >= newsPageCount - 1}
                        aria-label={language === 'en' ? 'Next news page' : '下一页新闻'}
                      >
                        <ArrowRight />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="siehub-empty-text">{language === 'en' ? 'No WeChat posts yet.' : '暂无公众号推送。'}</p>
          )}
        </section>
        <section className="siehub-school-announcement-panel">
          <div className="siehub-school-panel-title"><span>NOTICE</span><h3>{language === 'en' ? 'Notices' : '通知公告'}</h3></div>
          <div className="siehub-school-announcement-list">
            {loading ? (
              <p className="siehub-empty-text">{language === 'en' ? 'Loading notices...' : '正在加载通知...'}</p>
            ) : notices.length ? notices.map(notice => {
              const id = noticeIdentity(notice);
              const unread = id && !readNoticeIds.has(id);
              return (
                <article key={id} className={cls(unread && 'is-unread')}>
                  <time>{formatNoticeDate(notice.publishedAt, language)}</time>
                  <button type="button" onClick={() => openNotice(notice)}>
                    <span>{notice.organizationLabel} · {notice.departmentLabel}</span>
                    <strong>{pickLocalizedNoticeText(notice.title, language)}</strong>
                  </button>
                </article>
              );
            }) : (
              <p className="siehub-empty-text">{language === 'en' ? 'No department notices yet.' : '暂无部门通知公告。'}</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
};

const HubNoticeCenter = ({ token, language = 'zh', fixedModule = null }) => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [filters, setFilters] = useState({
    departmentKey: fixedModule ? `${fixedModule.organization}:${fixedModule.key}` : '',
    dateFrom: '',
    dateTo: '',
    latestOnly: false
  });
  const departments = useMemo(noticeDepartmentOptions, []);

  useEffect(() => {
    if (fixedModule) {
      setFilters(current => ({ ...current, departmentKey: `${fixedModule.organization}:${fixedModule.key}` }));
    }
  }, [fixedModule?.organization, fixedModule?.key]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters.latestOnly) params.set('limit', '5');
    const selected = departments.find(item => item.value === filters.departmentKey);
    if (selected) {
      params.set('organization', selected.organization);
      params.set('department', selected.department);
    }
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    setLoading(true);
    fetch(`${API_BASE}/hub/notices?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('notice_fetch_failed')))
      .then(data => setNotices(Array.isArray(data.notices) ? data.notices : []))
      .catch(error => {
        if (error.name !== 'AbortError') setNotices([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, filters, departments]);

  if (selectedNotice) {
    return (
      <section className="siehub-notice-center">
        <NoticeDetailPage notice={selectedNotice} language={language} onBack={() => setSelectedNotice(null)} />
      </section>
    );
  }

  return (
    <section className="siehub-notice-center">
      <div className="siehub-notice-head">
        <span><Megaphone /></span>
        <div><p>MESSAGE CENTER</p><h2>{language === 'en' ? 'Department Notices' : '部门消息中心'}</h2></div>
        <b>{notices.length}</b>
      </div>
      <div className="siehub-notice-filters">
        <select
          value={filters.departmentKey}
          disabled={Boolean(fixedModule)}
          onChange={event => setFilters(current => ({ ...current, departmentKey: event.target.value }))}
        >
          <option value="">{language === 'en' ? 'All departments' : '全部部门'}</option>
          {departments.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <NoticeDateField value={filters.dateFrom} language={language} kind="start" onChange={dateFrom => setFilters(current => ({ ...current, dateFrom }))} />
        <NoticeDateField value={filters.dateTo} language={language} kind="end" onChange={dateTo => setFilters(current => ({ ...current, dateTo }))} />
        <label className="siehub-latest-filter">
          <input className="siehub-checkbox" type="checkbox" checked={filters.latestOnly} onChange={event => setFilters(current => ({ ...current, latestOnly: event.target.checked }))} />
          <i aria-hidden="true"></i>
          <span>{language === 'en' ? 'Latest only' : '仅看最新'}</span>
        </label>
      </div>
      <div className="siehub-notice-list">
        {loading ? (
          <p className="siehub-empty-text">{language === 'en' ? 'Loading notices...' : '正在同步通知...'}</p>
        ) : notices.length ? notices.map(notice => (
          <article key={notice.id || notice._id}>
            {notice.coverImageUrl && <img className="siehub-notice-cover" src={notice.coverImageUrl} alt="" />}
            <div>
              <span>{notice.organizationLabel} · {notice.departmentLabel} · {notice.source === 'wechat_mp' ? 'WeChat MP' : 'Manual'}</span>
              <button className="siehub-notice-title-button" type="button" onClick={() => setSelectedNotice(notice)}>
                <strong>{pickLocalizedNoticeText(notice.title, language)}</strong>
              </button>
              <p>{pickLocalizedNoticeText(notice.summary, language)}</p>
              {notice.sourceUrl && <small>{language === 'en' ? 'Attached link available in detail page' : '正文页底部附有链接'}</small>}
            </div>
            <time>{formatNoticeDate(notice.publishedAt, language)}</time>
          </article>
        )) : (
          <p className="siehub-empty-text">{language === 'en' ? 'No published department notices yet.' : '暂无已发布部门通知。'}</p>
        )}
      </div>
    </section>
  );
};

const DepartmentHeroPortal = ({ module, token, language = 'zh' }) => {
  const [data, setData] = useState({ hero: [], news: [], notices: [] });
  const [selected, setSelected] = useState(null);
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    if (!module?.organization || !module?.key || !token) return undefined;
    const controller = new AbortController();
    fetch(`${API_BASE}/hub/hero?organization=${module.organization}&department=${module.key}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
    }).then(res => res.json()).then(result => {
      if (!controller.signal.aborted && result.success) setData({ hero: result.hero || [], news: result.news || [], notices: result.notices || [] });
    }).catch(() => {});
    return () => controller.abort();
  }, [module?.organization, module?.key, token]);
  const lead = data.hero.length ? data.hero[slideIndex % data.hero.length] : null;
  useEffect(() => {
    if (data.hero.length <= 1) return undefined;
    const timer = setInterval(() => setSlideIndex(index => (index + 1) % data.hero.length), 5200);
    return () => clearInterval(timer);
  }, [data.hero.length]);
  if (selected) return <NoticeDetailPage notice={selected} language={language} onBack={() => setSelected(null)} />;
  return <section className="siehub-department-news-hero">
    <div className="siehub-department-news-head"><div><p>SIEHUB / DEPARTMENT HERO</p><h2>{module?.title}新闻与消息</h2></div><span>{data.hero.length} HERO</span></div>
    {lead ? <>
      <button className="siehub-department-news-feature" type="button" onClick={() => setSelected(lead)}>
      {lead.coverImageUrl ? <img src={lead.coverImageUrl} alt="" /> : <span className="siehub-news-cover-fallback">SIE</span>}
      <span><small>{formatNoticeDate(lead.publishedAt, language)}</small><strong>{pickLocalizedNoticeText(lead.title, language)}</strong><em>{pickLocalizedNoticeText(lead.summary, language)}</em></span>
      </button>
      {data.hero.length > 1 && <div className="siehub-department-news-dots">{data.hero.map((item, index) => <button key={noticeIdentity(item)} className={index === slideIndex % data.hero.length ? 'is-active' : ''} type="button" onClick={() => setSlideIndex(index)} aria-label={`第${index + 1}条 Hero`} />)}</div>}
    </> : <p className="siehub-empty-text">暂无加入 Hero 的新闻动态。</p>}
    <div className="siehub-department-news-columns"><section><div className="siehub-school-panel-title"><span>NEWS</span><h3>新闻动态</h3></div><div className="siehub-department-news-list">{data.news.slice(0, 6).map(news => <button key={noticeIdentity(news)} type="button" onClick={() => setSelected(news)}><span>{formatNoticeDate(news.publishedAt, language)}</span><strong>{pickLocalizedNoticeText(news.title, language)}</strong><ArrowUpRight /></button>)}</div></section><section><div className="siehub-school-panel-title"><span>NOTICE</span><h3>消息通知</h3></div><div className="siehub-department-news-list">{data.notices.slice(0, 6).map(notice => <button key={noticeIdentity(notice)} type="button" onClick={() => setSelected(notice)}><span>{formatNoticeDate(notice.publishedAt, language)}</span><strong>{pickLocalizedNoticeText(notice.title, language)}</strong></button>)}</div></section></div>
  </section>;
};

const HeroNewsManagement = ({ token }) => {
  const [notices, setNotices] = useState([]);
  const [message, setMessage] = useState('');
  const departments = useMemo(() => SIEHUB_MODULES.filter(item => item.organization !== 'hub').map(item => ({ organization: item.organization, department: item.key, label: item.title })).concat([{ organization: 'student_union', department: 'default', label: '默认' }]), []);
  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/hub/admin/news?limit=all`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || '加载新闻失败');
    setNotices(data.notices || []);
  }, [token]);
  useEffect(() => { load().catch(error => setMessage(error.message)); }, [load]);
  const update = async (notice, patch) => {
    setMessage('');
    const res = await fetch(`${API_BASE}/hub/admin/news/${notice.id || notice._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(patch) });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || '保存失败');
    setNotices(items => items.map(item => (item.id === notice.id ? data.notice : item)));
    setMessage('新闻已保存，Hero 与部门页面已同步更新');
  };
  return <section className="siehub-hero-news-management"><div className="siehub-workspace-title"><div><p>ULTIMATE ADMIN / NEWS &amp; HERO</p><h2>Hero 页面与新闻动态管理</h2></div><button type="button" onClick={() => load().then(() => setMessage('新闻列表已刷新')).catch(error => setMessage(error.message))}>刷新</button></div>{message && <p className="siehub-form-message">{message}</p>}<div className="siehub-hero-news-table">{notices.map(notice => { const department = departments.find(item => item.organization === notice.organization && item.department === notice.department); return <article key={notice.id || notice._id}><div>{notice.coverImageUrl ? <img src={notice.coverImageUrl} alt="" /> : <span className="siehub-news-cover-fallback">SIE</span>}</div><label>标题<input value={notice.title?.zh || ''} onChange={event => setNotices(items => items.map(item => item.id === notice.id ? { ...item, title: { ...item.title, zh: event.target.value } } : item))} /></label><label>时间<input type="datetime-local" value={notice.publishedAt ? new Date(notice.publishedAt).toISOString().slice(0, 16) : ''} onChange={event => setNotices(items => items.map(item => item.id === notice.id ? { ...item, publishedAt: event.target.value } : item))} /></label><label>归属<select value={`${notice.organization}:${notice.department}`} onChange={event => { const [organization, department] = event.target.value.split(':'); setNotices(items => items.map(item => item.id === notice.id ? { ...item, organization, department } : item)); }}>{departments.map(item => <option key={`${item.organization}:${item.department}`} value={`${item.organization}:${item.department}`}>{item.label}</option>)}</select></label><label className="siehub-hero-toggle"><input type="checkbox" checked={Boolean(notice.heroEnabled)} onChange={event => setNotices(items => items.map(item => item.id === notice.id ? { ...item, heroEnabled: event.target.checked } : item))} />加入 Hero</label><button type="button" onClick={() => update(notice, { title: notice.title, publishedAt: notice.publishedAt, organization: notice.organization, department: notice.department, heroEnabled: notice.heroEnabled, heroOrder: notice.heroOrder }).catch(error => setMessage(error.message))}>保存</button></article>; })}</div></section>;
};

const DepartmentNoticeWorkspace = ({ module, token, language = 'zh', onClose }) => {
  const [status, setStatus] = useState('draft');
  const [notices, setNotices] = useState([]);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [draft, setDraft] = useState(emptyNoticeDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [message, setMessage] = useState('');

  const loadNotices = useCallback(async () => {
    if (!module?.organization || !module?.key || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/notices?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '加载通知失败');
      setNotices(data.notices || []);
    } catch (error) {
      setMessage(error.message || '加载通知失败');
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [module?.organization, module?.key, status, token]);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  const startCreate = () => {
    setSelectedNotice(null);
    setDraft(cloneNoticeDraft());
    setCoverUploading(false);
    setMessage('');
  };

  const startEdit = (notice) => {
    setSelectedNotice(notice);
    setDraft(cloneNoticeDraft(notice));
    setCoverUploading(false);
    setMessage('');
  };

  const uploadNoticeCover = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('封面图片不能超过 10MB');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setCoverUploading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/notices/cover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '封面图片上传失败');
      setDraft(current => ({ ...current, coverImageUrl: data.media?.url || data.image?.url || '' }));
      setMessage('封面图片已上传，保存草稿或发布后生效');
    } catch (error) {
      setMessage(error.message || '封面图片上传失败');
    } finally {
      setCoverUploading(false);
    }
  };

  const saveNotice = async (nextStatus = draft.status) => {
    const payload = { ...draft, status: nextStatus };
    if (!payload.title.zh && !payload.title.en) {
      setMessage('请填写通知标题');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const id = selectedNotice?.id || selectedNotice?._id;
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/notices${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '保存通知失败');
      setSelectedNotice(data.notice);
      setDraft(cloneNoticeDraft(data.notice));
      setStatus(nextStatus);
      setMessage(nextStatus === 'published' ? '通知已发布' : nextStatus === 'archived' ? '通知已归档' : '草稿已保存');
      await loadNotices();
    } catch (error) {
      setMessage(error.message || '保存通知失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="siehub-notice-workspace">
      <header>
        <div><p>NOTICE DESK</p><h2>{module?.title}通知管理</h2></div>
        <button className="text-button" type="button" onClick={onClose}><ChevronLeft />返回工作台</button>
      </header>
      <div className="siehub-notice-admin-layout">
        <aside>
          <div className="siehub-notice-tabs">
            {['draft', 'published', 'archived'].map(item => (
              <button key={item} type="button" className={status === item ? 'is-active' : ''} onClick={() => setStatus(item)}>
                {item === 'draft' ? '草稿' : item === 'published' ? '已发布' : '已归档'}
              </button>
            ))}
          </div>
          <button className="primary-button siehub-wide-action" type="button" onClick={startCreate}><Plus />新建通知</button>
          <div className="siehub-notice-admin-list">
            {loading ? <p>加载中...</p> : notices.length ? notices.map(notice => (
              <button key={notice.id || notice._id} type="button" className={(selectedNotice?.id || selectedNotice?._id) === (notice.id || notice._id) ? 'is-active' : ''} onClick={() => startEdit(notice)}>
                <strong>{pickLocalizedNoticeText(notice.title, language) || '未命名通知'}</strong>
                <span>{formatNoticeDate(notice.publishedAt, language)} · {notice.source === 'wechat_mp' ? 'WeChat MP' : 'Manual'}</span>
              </button>
            )) : <p>当前状态暂无通知</p>}
          </div>
        </aside>
        <form className="siehub-notice-form" onSubmit={event => { event.preventDefault(); saveNotice(draft.status); }}>
          <div className="siehub-notice-form-grid">
            <label><span>中文标题</span><input value={draft.title.zh} onChange={event => setDraft(current => localizedFieldPatch(current, 'title', 'zh', event.target.value))} /></label>
            <label><span>English Title</span><input value={draft.title.en} onChange={event => setDraft(current => localizedFieldPatch(current, 'title', 'en', event.target.value))} /></label>
            <label><span>中文摘要</span><textarea value={draft.summary.zh} onChange={event => setDraft(current => localizedFieldPatch(current, 'summary', 'zh', event.target.value))} rows={3} /></label>
            <label><span>English Summary</span><textarea value={draft.summary.en} onChange={event => setDraft(current => localizedFieldPatch(current, 'summary', 'en', event.target.value))} rows={3} /></label>
            <div className="siehub-notice-cover-field">
              <span>封面图片</span>
              <div className="siehub-notice-cover-picker">
                {draft.coverImageUrl ? (
                  <img src={draft.coverImageUrl} alt="" />
                ) : (
                  <div className="siehub-notice-cover-empty"><ImagePlus /><strong>从本地上传图片</strong><small>支持 JPG、PNG、WEBP，单张不超过 10MB</small></div>
                )}
                <div className="siehub-notice-cover-actions">
                  <label>
                    <ImagePlus />
                    <span>{coverUploading ? '上传中...' : draft.coverImageUrl ? '更换图片' : '选择图片'}</span>
                    <input
                      hidden
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={coverUploading}
                      onChange={event => {
                        uploadNoticeCover(event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {draft.coverImageUrl && <button type="button" disabled={coverUploading} onClick={() => setDraft(current => ({ ...current, coverImageUrl: '' }))}>移除封面</button>}
                </div>
              </div>
            </div>
            <label><span>原文链接</span><input value={draft.sourceUrl} onChange={event => setDraft(current => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://..." /></label>
            <label><span>发布时间</span><input type="datetime-local" value={draft.publishedAt ? new Date(draft.publishedAt).toISOString().slice(0, 16) : ''} onChange={event => setDraft(current => ({ ...current, publishedAt: event.target.value }))} /></label>
            <label><span>Hero 排序</span><input type="number" value={draft.heroOrder} onChange={event => setDraft(current => ({ ...current, heroOrder: Number(event.target.value || 0) }))} /></label>
            <label className="siehub-hero-toggle"><input type="checkbox" checked={draft.heroEnabled} onChange={event => setDraft(current => ({ ...current, heroEnabled: event.target.checked }))} /><span>加入本部门 Hero 页面</span></label>
          </div>
          <label className="siehub-notice-body"><span>中文正文</span><textarea value={draft.body.zh} onChange={event => setDraft(current => localizedFieldPatch(current, 'body', 'zh', event.target.value))} rows={7} /></label>
          <label className="siehub-notice-body"><span>English Body</span><textarea value={draft.body.en} onChange={event => setDraft(current => localizedFieldPatch(current, 'body', 'en', event.target.value))} rows={5} /></label>
          {message && <p className="siehub-notice-message">{message}</p>}
          <footer>
            <button type="submit" disabled={saving}><SquarePen />保存草稿</button>
            <button type="button" disabled={saving} onClick={() => saveNotice('published')}><Send />发布</button>
            {selectedNotice && <button type="button" disabled={saving} onClick={() => saveNotice(selectedNotice.status === 'published' ? 'draft' : 'archived')}><Flag />{selectedNotice.status === 'published' ? '撤回为草稿' : '归档'}</button>}
          </footer>
        </form>
      </div>
    </section>
  );
};

const extractWechatArticleUrls = (value = '') => {
  const matches = String(value).match(/(?:https?:\/\/)?mp\.weixin\.qq\.com\/[^\s"'<>，,；;]+/gi) || [];
  return Array.from(new Set(matches.map(url => {
    const clean = url.replace(/[)\]。！？!?]+$/g, '');
    return clean.startsWith('http') ? clean : `https://${clean}`;
  }).filter(Boolean)));
};

const WechatMpHeroEntry = ({
  token,
  user,
  language = 'zh',
  onWechatMpChanged = () => {},
  manualImportOpen = false,
  onOpenManualImport = () => {},
  onCloseManualImport = () => {}
}) => {
  const [wechatMp, setWechatMp] = useState(null);
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [manualImportText, setManualImportText] = useState('');
  const [manualImportLoading, setManualImportLoading] = useState(false);
  const [manualImportMessage, setManualImportMessage] = useState('');
  const manualImportUrls = useMemo(() => extractWechatArticleUrls(manualImportText), [manualImportText]);

  const loadConfig = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/hub/wechat-mp`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setWechatMp(data.wechatMp || null);
    } catch {
      setWechatMp(null);
    }
  }, [token]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const openAccount = () => {
    if (wechatMp?.accountUrl) window.open(wechatMp.accountUrl, '_blank', 'noopener,noreferrer');
  };

  const syncArticles = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/wechat-mp/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '同步失败');
      setWechatMp(data.wechatMp || null);
      onWechatMpChanged();
      const imported = data.result?.importedCount || 0;
      const updated = data.result?.updatedCount || 0;
      setMessage(data.result?.configured === false ? '公众号凭据未配置，已保持降级展示。' : `同步完成：新增 ${imported} 条，更新 ${updated} 条。`);
    } catch (error) {
      setMessage(error.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const updateManualImportText = (value) => {
    setManualImportText(value);
    if (!value.trim()) {
      setManualImportMessage('');
      return;
    }
    const urls = extractWechatArticleUrls(value);
    setManualImportMessage(urls.length
      ? `已识别 ${urls.length} 条推文链接，点击“开始导入”继续。`
      : '未识别到有效网址，请粘贴 https://mp.weixin.qq.com/s/... 链接。');
  };

  const handleManualImportPaste = (event) => {
    const pasted = event.clipboardData?.getData('text') || '';
    const pastedUrls = extractWechatArticleUrls(pasted);
    if (pastedUrls.length) {
      setManualImportMessage(`已识别 ${pastedUrls.length} 条推文链接，粘贴后可直接开始导入。`);
    }
  };

  const importManualLinks = async () => {
    const text = manualImportText.trim();
    const urls = extractWechatArticleUrls(text);
    if (!urls.length) {
      setManualImportMessage(text ? '未识别到有效网址，请粘贴 https://mp.weixin.qq.com/s/... 链接。' : '请先粘贴至少一条推文链接');
      return;
    }
    setManualImportLoading(true);
    setManualImportMessage(`正在导入 ${urls.length} 条推文链接，请稍候...`);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${API_BASE}/hub/wechat-mp/import`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text, urls })
      });
      window.clearTimeout(timer);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '导入失败');
      setWechatMp(data.wechatMp || null);
      onWechatMpChanged();
      const imported = data.result?.importedCount || 0;
      const updated = data.result?.updatedCount || 0;
      const failed = data.result?.failedCount || 0;
      const failureNote = data.result?.failed?.length ? ` 首个失败原因：${data.result.failed[0].error}` : '';
      setManualImportMessage(`导入完成：新增 ${imported} 条，更新 ${updated} 条，失败 ${failed} 条。${failureNote}`);
      setMessage('');
    } catch (error) {
      window.clearTimeout(timer);
      setManualImportMessage(error.name === 'AbortError' ? '导入请求超时，请稍后重试或检查链接是否能公开访问。' : (error.message || '导入失败'));
    } finally {
      setManualImportLoading(false);
    }
  };

  const accountName = wechatMp?.accountName || '国教空间';
  return (
    <aside className="siehub-wechat-entry">
      <button type="button" className="siehub-wechat-cover" onClick={openAccount} disabled={!wechatMp?.accountUrl}>
        <span>
          {wechatMp?.qrImageUrl ? <img src={wechatMp.qrImageUrl} alt={`${accountName} QR`} /> : <Smartphone />}
          <strong>{accountName}</strong>
        </span>
      </button>
      <div>
        <p>WECHAT MP</p>
        <h2>关注“{accountName}”</h2>
        <span>{language === 'en' ? 'Follow the official account for college updates.' : '关注公众号，查看学院资讯与学生工作动态。'}</span>
        <div className="siehub-wechat-actions">
          {wechatMp?.accountUrl && <button type="button" onClick={openAccount}>打开主页 <ArrowUpRight /></button>}
          {user?.isUltimateAdmin && <button type="button" onClick={syncArticles} disabled={syncing}>{syncing ? '同步中' : '同步文章'}</button>}
          {user?.isUltimateAdmin && <button type="button" onClick={onOpenManualImport}>手动导入 <Plus /></button>}
        </div>
        {message && <small>{message}</small>}
      </div>
      {manualImportOpen && typeof document !== 'undefined' && createPortal(
        <div className="siehub-modal-backdrop siehub-modal-portal-backdrop" role="presentation" onClick={onCloseManualImport}>
          <section className="siehub-modal siehub-modal-portal" role="dialog" aria-modal="true" aria-labelledby="wechat-import-title" onClick={event => event.stopPropagation()}>
            <header>
              <div>
                <p>MANUAL IMPORT</p>
                <h2 id="wechat-import-title">粘贴推文链接</h2>
              </div>
              <button type="button" className="icon-button" onClick={onCloseManualImport}><X /></button>
            </header>
            <p className="siehub-modal-note">一行一条，系统会尽量提取标题、摘要和封面；如果链接页受限，会返回失败结果。</p>
            <textarea
              className="siehub-modal-textarea"
              value={manualImportText}
              onChange={event => updateManualImportText(event.target.value)}
              onPaste={handleManualImportPaste}
              placeholder="https://mp.weixin.qq.com/s/..."
              rows={8}
            />
            <small className="siehub-modal-muted">已识别 {manualImportUrls.length} 条链接{wechatMp?.noticeDepartmentLabel ? ` · 导入目标：${wechatMp.noticeDepartmentLabel} · ${wechatMp.accountName || '国教空间'}` : ''}</small>
            {manualImportMessage && <p className="siehub-modal-message">{manualImportMessage}</p>}
            <footer>
              <button type="button" className="text-button" onClick={onCloseManualImport}>取消</button>
              <button type="button" className="primary-button" onClick={importManualLinks} disabled={manualImportLoading}>{manualImportLoading ? '导入中...' : '开始导入'}</button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </aside>
  );
};

const SIEHUBWechatNewsCarousel = ({ token, language = 'zh', refreshKey = 0 }) => {
  const [news, setNews] = useState([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_BASE}/hub/notices?${new URLSearchParams({ source: 'wechat_mp', limit: 'all' }).toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('news_fetch_failed')))
      .then(data => setNews(Array.isArray(data.notices) ? data.notices : []))
      .catch(error => {
        if (error.name !== 'AbortError') setNews([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, refreshKey]);

  const carouselNews = news;
  const newsSignature = carouselNews.map(noticeIdentity).join('|');

  useEffect(() => {
    setSlideIndex(0);
  }, [newsSignature]);

  useEffect(() => {
    if (carouselNews.length <= 1) return undefined;
    const timer = setInterval(() => {
      setSlideIndex(current => (current + 1) % carouselNews.length);
    }, 5200);
    return () => clearInterval(timer);
  }, [carouselNews.length]);

  const activeIndex = carouselNews.length ? slideIndex % carouselNews.length : 0;
  const activeNews = carouselNews.length ? carouselNews[activeIndex] : null;
  const activeKey = noticeIdentity(activeNews) || `wechat-news-${activeIndex}`;
  const activeTitle = String(pickLocalizedNoticeText(activeNews?.title, language) || '')
    .replace(/\s+/g, ' ')
    .replace(/(?:\.html\(false\);\s*var\s+msg_desc\s*=\s*htmlDecode\([\s\S]*)$/i, '')
    .replace(/(?:var\s+msg_desc\s*=\s*htmlDecode\([\s\S]*)$/i, '')
    .trim();
  const activeDate = formatNoticeDate(activeNews?.publishedAt, language);
  const activeHref = activeNews?.sourceUrl || '';
  const activeCover = activeNews?.coverImageUrl || '';
  const shiftSlide = (direction) => {
    if (!carouselNews.length) return;
    setSlideIndex(current => (current + direction + carouselNews.length) % carouselNews.length);
  };

  return (
    <section className="siehub-home-news-panel" aria-label={language === 'en' ? 'WeChat hero post' : '推文封面'}>
      {loading ? (
        <p className="siehub-home-news-empty">{language === 'en' ? 'Loading news...' : '正在同步推文...'}</p>
      ) : activeNews ? (
        <div className="siehub-home-news-carousel">
          <button
            key={activeKey}
            className="siehub-home-feature-news"
            type="button"
            onClick={() => activeHref && window.open(activeHref, '_blank', 'noopener,noreferrer')}
          >
            {activeCover ? <img src={activeCover} alt={activeTitle} /> : <span className="siehub-news-cover-fallback">SIE</span>}
            <span className="siehub-home-news-mask" aria-hidden="true"></span>
            <span className="siehub-home-news-caption">
              <strong>{activeTitle}</strong>
              {activeDate && <small>{activeDate}</small>}
            </span>
          </button>
          {carouselNews.length > 1 && (
            <div className="siehub-home-carousel-controls">
              <button type="button" onClick={() => shiftSlide(-1)} aria-label={language === 'en' ? 'Previous post' : '上一条推文'}><ArrowLeft /></button>
              <div>
                {carouselNews.map((item, index) => (
                  <button
                    key={noticeIdentity(item)}
                    type="button"
                    className={index === activeIndex ? 'is-active' : ''}
                    onClick={() => setSlideIndex(index)}
                    aria-label={`${language === 'en' ? 'Slide' : '第'} ${index + 1}`}
                  />
                ))}
              </div>
              <button type="button" onClick={() => shiftSlide(1)} aria-label={language === 'en' ? 'Next post' : '下一条推文'}><ArrowRight /></button>
            </div>
          )}
        </div>
      ) : (
        <p className="siehub-home-news-empty">{language === 'en' ? 'No WeChat posts yet.' : '暂无推文可展示。'}</p>
      )}
    </section>
  );
};

const SIEHUBHomeNotificationCenter = ({ token, onOpenSIEVOX }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const unreadCount = useMemo(() => notifications.filter(item => !item.isRead).length, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setNotifications(data.notifications || []);
    } catch {}
  }, [token]);

  const markNotificationsRead = useCallback(async (ids = []) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(ids.length ? { ids } : {})
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(current => current.map(item => (
          ids.length === 0 || ids.includes(item._id)
            ? { ...item, isRead: true }
            : item
        )));
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 12000);
    return () => clearInterval(timer);
  }, [fetchNotifications]);

  const openNotification = async (notification) => {
    const targetId = notification.feedbackId?._id || notification.feedbackId;
    if (!targetId) return;
    try {
      const data = await requestJson(`/feedback/${targetId}`, token);
      onOpenSIEVOX?.({ feedback: data.feedback, notification });
      setOpen(false);
      await markNotificationsRead([notification._id]);
    } catch (error) { alert(error.message || '事项暂时无法打开'); }
  };

  return (
    <>
      <button className="icon-button" type="button" title="消息通知" onClick={() => setOpen(current => !current)}>
        <Bell />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      <NotificationDrawer
        open={open}
        notifications={notifications}
        unreadCount={unreadCount}
        onClose={() => setOpen(false)}
        onMarkReadAll={() => markNotificationsRead()}
        onMarkReadOne={item => markNotificationsRead([item._id])}
        onOpenNotification={openNotification}
      />
    </>
  );
};

const SIEHUBHome = ({ user, token, theme, onOpenModule, onOpenDepartments, onOpenSIEVOX, onOpenSIEBridge, onOpenUltimate, onOpenMy, onLogout, language = 'zh', languageSwitcher = null }) => {
  const modules = getAccessibleModules(user);
  const clock = usePlatformClock(language);
  const serviceMetrics = useServiceMetrics(token);
  const [wechatNewsRefreshKey, setWechatNewsRefreshKey] = useState(0);
  const [wechatManualImportOpen, setWechatManualImportOpen] = useState(false);
  const youthLeague = modules.filter(module => module.organization === 'youth_league');
  const studentUnion = modules.filter(module => module.organization === 'student_union');
  const roleScope = user?.isUltimateAdmin ? '全平台治理范围' : `${user?.organizationLabel || '学生服务'} / ${user?.departmentLabel || '可访问模块'}`;
  const refreshWechatNews = useCallback(() => setWechatNewsRefreshKey(current => current + 1), []);
  const openWechatManualImport = useCallback(() => setWechatManualImportOpen(true), []);
  const closeWechatManualImport = useCallback(() => setWechatManualImportOpen(false), []);
  const sievoxModule = SIEHUB_MODULES.find(module => module.key === 'student_rights');
  const siebridgeModule = SIEHUB_MODULES.find(module => module.key === 'academic_technology');
  const productWindows = [
    {
      key: 'siebridge',
      marker: '01',
      label: 'SIEBridge课程资源共享平台',
      title: '课程资源共享',
      summary: '课程资料、真题课件与学习笔记的共享、上传和审核。',
      className: 'siebridge-window',
      icon: <img src={siebridgeLogo} alt="SIEBridge" />,
      action: () => onOpenSIEBridge ? onOpenSIEBridge() : onOpenModule(siebridgeModule)
    },
    {
      key: 'sievox',
      marker: '02',
      label: 'SIEVOX学生权益反馈系统',
      title: '学生权益反馈',
      summary: '学生诉求提交、办理进度追踪与服务响应闭环。',
      className: 'sievox-window',
      icon: <img src={sieLogo} alt="SIEVOX" />,
      action: () => onOpenSIEVOX ? onOpenSIEVOX() : onOpenModule(sievoxModule)
    }
  ];

  const renderDepartmentStrip = (title, marker, items) => (
    <div className="siehub-department-strip-row">
      <span>{marker}</span>
      <strong>{title}</strong>
      <div className="siehub-department-chip-grid">
        {items.map(module => {
          const showcaseUrl = DEPARTMENT_SHOWCASE_URLS[module.key] || '';
          const content = (
            <>
              <i><DepartmentModuleMark module={module} /></i>
              <span>{module.title}</span>
              <ChevronRight />
            </>
          );
          return showcaseUrl ? (
            <a key={module.key} className={`siehub-department-chip tone-${module.tone}`} href={showcaseUrl}>
              {content}
            </a>
          ) : (
            <button key={module.key} className={`siehub-department-chip tone-${module.tone}`} type="button" onClick={() => onOpenModule(module)}>
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );

  return <main className="siehub-shell">
    <header className="siehub-topbar">
      <div className="siehub-brand"><span className="siehub-brand-mark"><img src={siehubLogo} alt="SIEHUB" /><i></i></span><div><strong>SIEHUB</strong><small>SIE LIFE PLATFORM</small></div></div>
      <div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)} title="外观设置"><Palette /></button><HubUserChip user={user} />{user?.isUltimateAdmin && <><button className="siehub-topbar-link" type="button" onClick={onOpenUltimate}><ShieldCheck />Hero与新闻管理</button><button className="icon-button siehub-wechat-import-trigger" type="button" onClick={openWechatManualImport} title="公众号导入"><Plus /></button></>}<SIEHUBHomeNotificationCenter token={token} onOpenSIEVOX={onOpenSIEVOX} /><button className="siehub-topbar-link" type="button" onClick={onOpenDepartments}><Building2 />部门</button><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div>
    </header>
    <div className="siehub-content">
      <section className="siehub-hero">
        <div className="siehub-hero-meta"><span>SIEHUB</span><b>{roleScope}</b></div>
        <SIEHUBWechatNewsCarousel token={token} language={language} refreshKey={wechatNewsRefreshKey} />
        <div className="siehub-hero-copy">
          <div className="siehub-live-greeting">
            <span>{clock.greeting}，{user?.name}</span>
            <strong>{clock.timeLabel}</strong>
            <small>{clock.dateLabel} · {clock.timezoneLabel}</small>
            <small>{language === 'en' ? 'SIEVOX first response' : 'SIEVOX 首次响应'}：{serviceMetrics.loading && !serviceMetrics.metrics ? (language === 'en' ? 'Syncing' : '同步中') : formatAverageFirstResponse(serviceMetrics.metrics, language)}</small>
          </div>
        </div>
        <WechatMpHeroEntry
          token={token}
          user={user}
          language={language}
          onWechatMpChanged={refreshWechatNews}
          manualImportOpen={wechatManualImportOpen}
          onOpenManualImport={openWechatManualImport}
          onCloseManualImport={closeWechatManualImport}
        />
      </section>
      <SIEHUBNoticePortal token={token} language={language} user={user} refreshKey={wechatNewsRefreshKey} />
      <section className="siehub-product-windows" aria-label="SIEHUB 平台入口">
        <div className="siehub-group-heading"><span>ENTRY</span><div><p>PLATFORM WINDOWS</p><h2>核心平台入口</h2></div><b>{productWindows.length}</b></div>
        <div className="siehub-product-window-grid">
          {productWindows.map(window => (
            <button key={window.key} className={`siehub-product-window ${window.className}`} type="button" onClick={window.action}>
              <span className="siehub-product-window-index">{window.marker}</span>
              <span className="siehub-product-window-mark">{window.icon}</span>
              <span className="siehub-product-window-copy">
                <small>{window.label}</small>
                <strong>{window.title}</strong>
                <em>{window.summary}</em>
              </span>
              <span className="siehub-product-window-action">进入 <ArrowUpRight /></span>
            </button>
          ))}
        </div>
      </section>
      <section className="siehub-department-strip" aria-label="部门宣传入口">
        <div className="siehub-group-heading"><span>DEPT</span><div><p>SHOWCASE GATEWAY</p><h2>部门风采入口</h2></div><button className="siehub-section-link" type="button" onClick={onOpenDepartments}>全部部门 <ArrowRight /></button></div>
        {renderDepartmentStrip('团委', '01', youthLeague)}
        {renderDepartmentStrip('学生会', '02', studentUnion)}
      </section>
    </div>
    <SIEHUBMobileDock active="home" onHome={() => {}} onDepartments={onOpenDepartments} onMy={onOpenMy} />
    <ThemePanel theme={theme} />
  </main>;
};

const SIEHUBDepartmentDirectory = ({ user, theme, onBack, onOpenModule, onOpenMy, onLogout, languageSwitcher = null }) => {
  const modules = getAccessibleModules(user);
  const governanceModules = modules.filter(module => module.organization === 'hub');
  const youthLeague = modules.filter(module => module.organization === 'youth_league');
  const studentUnion = modules.filter(module => module.organization === 'student_union');
  const renderDirectoryGroup = (title, eyebrow, items) => (
    <section className="siehub-directory-group">
      <div className="siehub-group-heading"><span>{eyebrow}</span><div><p>DEPARTMENT ORDER</p><h2>{title}</h2></div><b>{items.length}</b></div>
      <div className="siehub-directory-grid">
        {items.map((module, index) => {
          const content = (
            <>
              <span className="siehub-directory-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="siehub-module-icon"><DepartmentModuleMark module={module} /></span>
              <span className="siehub-directory-copy">
                <small>{module.entryLabel || (module.organization === 'youth_league' ? '团委部门宣传页' : '学生会部门宣传页')}</small>
                <strong>{module.title}</strong>
                <em>{module.summary}</em>
              </span>
              <span className="siehub-directory-action">进入 <ArrowUpRight /></span>
            </>
          );
          return (
            <button key={module.key} className={`siehub-directory-card tone-${module.tone}`} type="button" onClick={() => onOpenModule(module)}>
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );

  return <main className="siehub-shell">
    <header className="siehub-topbar">
      <div className="siehub-brand"><span className="siehub-brand-mark"><img src={siehubLogo} alt="SIEHUB" /><i></i></span><div><strong>SIEHUB</strong><small>DEPARTMENT DIRECTORY</small></div></div>
      <div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)} title="外观设置"><Palette /></button><HubUserChip user={user} /><button className="siehub-topbar-link is-active" type="button"><Building2 />部门</button><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div>
    </header>
    <div className="siehub-content">
      <button className="siehub-back" type="button" onClick={onBack}><ArrowLeft /> 返回首页</button>
      <section className="siehub-directory-hero">
        <span className="siehub-module-icon tone-indigo"><Building2 /></span>
        <div><p>SIEHUB / DEPARTMENT SHOWCASE</p><h1>部门矩阵</h1><span>按团委学生会组织架构排序，集中进入各部门宣传页、部门服务与管理工作台。</span></div>
      </section>
      {user?.isUltimateAdmin && governanceModules.length > 0 && renderDirectoryGroup('平台治理', '00', governanceModules)}
      {renderDirectoryGroup('团委', '01', youthLeague)}
      {renderDirectoryGroup('学生会', '02', studentUnion)}
    </div>
    <SIEHUBMobileDock active="departments" onHome={onBack} onDepartments={() => {}} onMy={onOpenMy} />
    <ThemePanel theme={theme} />
  </main>;
};

const DepartmentStudentPortal = ({ module, onOpenSIEVOX, onOpenSIEBridge, token, user, language = 'zh', initialPerformanceOpen = false }) => {
  const [introductionOpen, setIntroductionOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(initialPerformanceOpen);
  const [performancePeriod, setPerformancePeriod] = useState('');
  const isSIEVOX = module?.key === 'student_rights';
  const isSIEBridge = module?.key === 'academic_technology';
  const canViewFiles = canViewDepartmentFiles(user, module);
  const performanceAccess = getModuleAccess(user, module);
  const canEnterPerformance = Boolean(user?.isUltimateAdmin || ['member', 'manage', 'ultimate'].includes(performanceAccess?.accessLevel));
  useEffect(() => { setPerformancePeriod(''); }, [module?.key]);

  if (performanceOpen) {
    return (
      <>
        <button className="siehub-back" type="button" onClick={() => setPerformanceOpen(false)}>
          <ChevronLeft />
          返回学生服务入口
        </button>
        <div className="unified-performance-tabs" role="tablist" aria-label="绩效内容">
          <button type="button" className="is-active">我的学期成绩与评价</button>
        </div>
        <DepartmentPerformanceParticipation module={module} token={token} user={user} compact period={performancePeriod} onPeriodChange={setPerformancePeriod} />
      </>
    );
  }

  if (introductionOpen) {
    return (
      <>
        <button className="siehub-back" type="button" onClick={() => setIntroductionOpen(false)}>
          <ChevronLeft />
          返回学生服务入口
        </button>
        <DepartmentIntroductionViewer module={module} token={token} language={language} />
      </>
    );
  }

  if (noticesOpen) {
    return (
      <>
        <button className="siehub-back" type="button" onClick={() => setNoticesOpen(false)}>
          <ChevronLeft />
          返回学生服务入口
        </button>
        <SIEHUBNoticePortal token={token} language={language} fixedModule={module} user={user} />
      </>
    );
  }

  if (filesOpen) {
    return (
      <>
        <button className="siehub-back" type="button" onClick={() => setFilesOpen(false)}>
          <ChevronLeft />
          返回学生服务入口
        </button>
        <DepartmentFileWorkspace module={module} token={token} canView={canViewFiles} canManage={false} compact />
      </>
    );
  }

  return (
    <>
      <section className="siehub-student-portal-card">
        <div className="siehub-student-portal-head">
          <p>STUDENT PORTAL</p>
          <h2>{module?.title}学生端</h2>
          <span>这里面向所有学生开放，用于查看部门服务说明、活动入口和后续上线的学生侧功能。</span>
        </div>
        <DepartmentHeroPortal module={module} token={token} language={language} />
        <div className="siehub-student-service-grid">
          <DepartmentIntroductionEntryCard module={module} onOpen={() => setIntroductionOpen(true)} />
          {isSIEVOX ? (
            <button className="siehub-student-service-entry sievox-entry" type="button" onClick={onOpenSIEVOX}>
              <span>02</span>
              <img src={sieLogo} alt="SIEVOX" />
              <strong>SIEVOX学生权益反馈系统</strong>
              <p>学生权益反馈、诉求跟进与处理进度查询直接进入 SIEVOX 完成。</p>
              <b>立即进入 <ArrowUpRight /></b>
            </button>
          ) : isSIEBridge ? (
            <button className="siehub-student-service-entry siebridge-entry" type="button" onClick={onOpenSIEBridge}>
              <span>02</span>
              <img src={siebridgeLogo} alt="SIEBridge" />
              <strong>SIEBridge课程资源共享平台</strong>
              <p>按专业与年级查找课程资料，上传真题、课件和笔记并查看审核进度。</p>
              <b>立即进入 <ArrowUpRight /></b>
            </button>
          ) : canEnterPerformance ? (
            <button className="siehub-student-service-entry" type="button" onClick={() => setPerformanceOpen(true)}>
              <span>02</span>
              <Trophy />
              <strong>我的绩效与评价</strong>
              <p>查看学期成绩，在学期末完成自评、互评和职责范围内的评分。</p>
              <b>进入考核 <ArrowUpRight /></b>
            </button>
          ) : (
            <article><span>02</span><strong>学生服务入口</strong><p>该部门学生侧服务后续将在 SIEHUB 内逐步上线。</p></article>
          )}
          {(isSIEVOX || isSIEBridge) && canEnterPerformance && (
            <button className="siehub-student-service-entry" type="button" onClick={() => setPerformanceOpen(true)}>
              <span>05</span>
              <Trophy />
              <strong>我的绩效与评价</strong>
              <p>查看学期成绩，在学期末完成自评、互评和职责范围内的评分。</p>
              <b>进入考核 <ArrowUpRight /></b>
            </button>
          )}
          <button className="siehub-student-service-entry" type="button" onClick={() => setNoticesOpen(true)}>
            <span>03</span>
            <Megaphone />
            <strong>通知与活动</strong>
            <p>面向学生的通知、报名、活动材料与服务进度将集中展示。</p>
            <b>查看通知 <ChevronRight /></b>
          </button>
          {canViewFiles && (
            <button className="siehub-student-service-entry" type="button" onClick={() => setFilesOpen(true)}>
              <span>04</span>
              <FileText />
              <strong>部门资料库</strong>
              <p>查看本部门共享文件、活动资料和工作文档。</p>
              <b>查看资料 <ChevronRight /></b>
            </button>
          )}
        </div>
      </section>
    </>
  );
};

const DepartmentPlaceholder = ({ module, user, token, theme, onBack, onOpenSIEVOX, onOpenSIEBridge, onOpenMy, onLogout, initialWorkspace = '', languageSwitcher = null, language = 'zh' }) => {
  const [performancePolicy, setPerformancePolicy] = useState(null);
  const [policyAccess, setPolicyAccess] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyMessage, setPolicyMessage] = useState('');
  const canSwitchPortal = canSwitchDepartmentPortal(user, module);
  const [departmentPortal, setDepartmentPortal] = useState(canSwitchPortal ? 'manage' : 'student');
  const [manageWorkspace, setManageWorkspace] = useState(initialWorkspace || 'introduction');
  const [performanceSection, setPerformanceSection] = useState('overview');
  const [performancePeriod, setPerformancePeriod] = useState('');
  const fallbackCanManagePerformance = canManageVolunteerPolicy(user, module);
  const canManageNotice = canManageDepartmentNotice(user, module);
  const canManageMembers = canManageDepartmentMembers(user, module);
  const canManageAccounts = canManageDepartmentAccounts(user, module);
  const canViewFiles = canViewDepartmentFiles(user, module);
  const canManageFiles = canManageDepartmentFiles(user, module);
  const canManagePerformance = policyAccess?.canEdit ?? fallbackCanManagePerformance;
  const canManagePerformanceRecords = Boolean(user?.isUltimateAdmin || getModuleAccess(user, module)?.capabilities?.includes('manage_department_performance'));
  const canEnterSIEVOX = module?.key === 'student_rights' || user?.isUltimateAdmin;
  const isSIEBridge = module?.key === 'academic_technology';
  const isCultureSportsArts = module?.key === 'culture_sports_arts';
  const isLocalShowcaseDepartment = module?.key === 'student_rights' || module?.key === 'academic_technology';
  const hideIntroductionWorkspace = isCultureSportsArts || isLocalShowcaseDepartment;
  const showManagePortal = canSwitchPortal && departmentPortal === 'manage';

  useEffect(() => {
    setDepartmentPortal(canSwitchPortal ? 'manage' : 'student');
    setManageWorkspace(initialWorkspace || (hideIntroductionWorkspace ? 'notice' : 'introduction'));
    setPerformancePeriod('');
    setPerformanceSection('overview');
  }, [canSwitchPortal, module?.key, hideIntroductionWorkspace, initialWorkspace]);

  useEffect(() => {
    if (!module?.organization || !module?.key || !token) {
      setPerformancePolicy(null);
      setPolicyAccess(null);
      return undefined;
    }

    let cancelled = false;
    setPolicyLoading(true);
    fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-policy`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) {
          setPerformancePolicy(data.policy || null);
          setPolicyAccess(data.access || null);
        } else {
          setPerformancePolicy(null);
          setPolicyAccess(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPerformancePolicy(null);
          setPolicyAccess(null);
        }
      })
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [module?.organization, module?.key, token]);

  const savePerformancePolicy = async (draft) => {
    setPolicySaving(true);
    setPolicyMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-policy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(draft)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '保存绩效制度失败');
      setPerformancePolicy(data.policy || null);
      setPolicyAccess(data.access || null);
      setPolicyMessage('已保存为该部门的定制绩效制度。');
      return data;
    } catch (error) {
      setPolicyMessage(error.message || '保存绩效制度失败，请稍后重试。');
      throw error;
    } finally {
      setPolicySaving(false);
    }
  };

  const resetPerformancePolicy = async () => {
    if (!window.confirm(`确认将【${module?.title || '该部门'}】的志愿者绩效制度恢复为 SIEVOX 默认模板吗？`)) return;
    setPolicySaving(true);
    setPolicyMessage('');
    try {
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/performance-policy/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '恢复默认失败');
      setPerformancePolicy(data.policy || null);
      setPolicyAccess(data.access || null);
      setPolicyMessage('已恢复为 SIEVOX 默认绩效制度。');
    } catch (error) {
      setPolicyMessage(error.message || '恢复默认失败，请稍后重试。');
    } finally {
      setPolicySaving(false);
    }
  };

  return <main className="siehub-shell siehub-department-shell">
    <header className="siehub-topbar"><div className="siehub-brand"><span className="siehub-brand-mark"><img src={siehubLogo} alt="SIEHUB" /><i></i></span><div><strong>SIEHUB</strong><small>{module?.title || '部门工作台'} / FRAMEWORK</small></div></div><div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)}><Palette /></button><HubUserChip user={user} /><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div></header>
    <div className="siehub-content">
      <button className="siehub-back" type="button" onClick={onBack}><ChevronLeft />返回模块总览</button>
      <section className="siehub-department-hero"><span className={`siehub-module-icon tone-${module?.tone || 'slate'}`}><DepartmentModuleMark module={module} /></span><div><p>SIEHUB / DEPARTMENT PLATFORM</p><h1>{module?.title}</h1><span>{module?.summary}</span></div></section>
      {canSwitchPortal && (
        <div className="siehub-portal-switch" aria-label="部门端口切换">
          <button type="button" className={departmentPortal === 'student' ? 'is-active' : ''} onClick={() => setDepartmentPortal('student')}>学生端</button>
          <button type="button" className={departmentPortal === 'manage' ? 'is-active' : ''} onClick={() => setDepartmentPortal('manage')}>管理端</button>
        </div>
      )}
      {showManagePortal && (
        <div className="siehub-manage-tabs" aria-label="部门管理一级板块">
          {!hideIntroductionWorkspace && <button type="button" className={manageWorkspace === 'introduction' ? 'is-active' : ''} onClick={() => setManageWorkspace('introduction')}>部门介绍编辑</button>}
          <button type="button" className={manageWorkspace === 'notice' ? 'is-active' : ''} onClick={() => setManageWorkspace('notice')}>通知管理</button>
          <button type="button" className={manageWorkspace === 'members' ? 'is-active' : ''} onClick={() => setManageWorkspace('members')}>成员管理</button>
          <button type="button" className={manageWorkspace === 'accounts' ? 'is-active' : ''} onClick={() => setManageWorkspace('accounts')}>账号管理</button>
          <button type="button" className={manageWorkspace === 'files' ? 'is-active' : ''} onClick={() => setManageWorkspace('files')}>部门资料库</button>
          <button type="button" className={manageWorkspace === 'performance' ? 'is-active' : ''} onClick={() => setManageWorkspace('performance')}>绩效考核</button>
        </div>
      )}
      {showManagePortal ? (manageWorkspace === 'introduction' && !hideIntroductionWorkspace ? (
        <DepartmentIntroductionEditor
          module={module}
          token={token}
          language={language}
          onClose={() => setManageWorkspace('introduction')}
        />
      ) : manageWorkspace === 'notice' ? (
        <DepartmentNoticeWorkspace
          module={module}
          token={token}
          language={language}
          onClose={() => setManageWorkspace('notice')}
        />
      ) : manageWorkspace === 'members' ? (
        <DepartmentMemberWorkspace module={module} token={token} canManage={canManageMembers} language={language} />
      ) : manageWorkspace === 'accounts' ? (
        <DepartmentAccountWorkspace module={module} token={token} canManage={canManageAccounts} language={language} />
      ) : manageWorkspace === 'files' ? (
        <DepartmentFileWorkspace module={module} token={token} canView={canViewFiles} canManage={canManageFiles} />
      ) : manageWorkspace === 'performance' ? (
        <>
          <div className="unified-performance-tabs" role="tablist" aria-label="绩效内容">
            <button type="button" className={performanceSection === 'overview' ? 'is-active' : ''} onClick={() => setPerformanceSection('overview')}>学期成绩与评价</button>
            <button type="button" className={performanceSection === 'legacy' ? 'is-active' : ''} onClick={() => setPerformanceSection('legacy')}>活动绩效记录</button>
            <button type="button" className={performanceSection === 'policy' ? 'is-active' : ''} onClick={() => setPerformanceSection('policy')}>部门考核标准</button>
          </div>
          {performanceSection === 'overview' ? <DepartmentPerformanceParticipation module={module} token={token} user={user} period={performancePeriod} onPeriodChange={setPerformancePeriod} />
            : performanceSection === 'legacy' ? <DepartmentPerformanceWorkbench module={module} token={token} canManage={canManagePerformanceRecords} period={performancePeriod} onPeriodChange={setPerformancePeriod} />
              : <DepartmentPerformancePolicyCard
                  module={module}
                  policy={performancePolicy}
                  canEdit={canManagePerformance}
                  loading={policyLoading}
                  saving={policySaving}
                  message={policyMessage}
                  onSave={savePerformancePolicy}
                  onReset={resetPerformancePolicy}
                />}
        </>
      ) : (
        <>
          <div className="siehub-framework-grid">
            <section><span>01</span><h2>通知管理</h2><p>发布面向学生的部门通知、活动信息和公众号文章链接，首页消息中心会自动汇总展示。</p><button type="button" disabled={!canManageNotice} onClick={() => setManageWorkspace('notice')}>{canManageNotice ? '进入编辑' : '只读说明'}</button></section>
            {isCultureSportsArts && (
              <section>
                <span>02</span>
                <h2>部门介绍</h2>
                <p>文体艺术部介绍已切换到外部展示站，站内旧编辑页已暂时隐藏。</p>
                <button type="button" onClick={() => window.open(CULTURE_SPORTS_ARTS_INTRO_URL, '_blank', 'noopener,noreferrer')}>打开展示站</button>
              </section>
            )}
            {isSIEBridge ? (
              <section><span>03</span><h2>SIEBridge 审核</h2><p>课程新增与资料上传申请在此集中审核，通过后展示到学生端。</p><button type="button" disabled>已接入</button></section>
            ) : (
              <section><span>03</span><h2>绩效考核</h2><p>学期末逐项评分、自评互评和部门标准集中在绩效工作区。</p><button type="button" onClick={() => setManageWorkspace('performance')}>进入绩效</button></section>
            )}
            <section><span>04</span><h2>成员与归档</h2><p>届次成员、身份标签、分管关系与绩效档案将归入统一组织框架。</p><button type="button" disabled>规划中</button></section>
            <section><span>05</span><h2>部门资料库</h2><p>部门负责人、团委学生兼职团干部和分管主席层级可维护资料；志愿者可在学生端查看下载。</p><button type="button" disabled={!canViewFiles} onClick={() => setManageWorkspace('files')}>{canManageFiles ? '进入资料库' : canViewFiles ? '查看资料' : '未开放'}</button></section>
          </div>
          {isSIEBridge ? (
            <section className="siehub-bridge-card">
              <img className="siehub-bridge-logo" src={siebridgeLogo} alt="SIEBridge" />
              <div><strong>SIEBridge 已作为独立业务页面运行</strong><span>课程检索、资料上传、提交记录和审核管理统一进入 SIEBridge 页面完成。</span></div>
              <button className="primary-button" type="button" onClick={onOpenSIEBridge}>进入 SIEBridge <ArrowUpRight /></button>
            </section>
          ) : null}
          {!isSIEBridge && (canEnterSIEVOX ? (
            <section className="siehub-bridge-card"><img className="siehub-bridge-logo" src={sieLogo} alt="SIEVOX" /><div><strong>学生权益部已具备独立业务平台</strong><span>SIEVOX 保持现有反馈、账号、绩效与组织管理功能，继续作为学生权益部的成熟子模块运行。</span></div><button className="primary-button" type="button" onClick={onOpenSIEVOX}>进入 SIEVOX <ArrowUpRight /></button></section>
          ) : (
            <section className="siehub-bridge-card"><Scale /><div><strong>该部门暂不接入 SIEVOX</strong><span>当前仅学生权益部保留成熟的 SIEVOX 业务模块，其他部门将以框架工作台和后续专属平台的形式逐步展开。</span></div></section>
          ))}
        </>
      )) : (
        <DepartmentStudentPortal module={module} onOpenSIEVOX={onOpenSIEVOX} onOpenSIEBridge={onOpenSIEBridge} token={token} user={user} language={language} initialPerformanceOpen={initialWorkspace === 'performance'} />
      )}
    </div>
    <SIEHUBMobileDock active="home" onHome={onBack} onMy={onOpenMy} />
    <ThemePanel theme={theme} />
  </main>;
};

const UltimateOrganizationWindow = ({ user, token, theme, onBack, onOpenMy, onLogout, languageSwitcher = null }) => {
  const allowed = Boolean(user?.isUltimateAdmin);
  const [workspace, setWorkspace] = useState('news');

  return <main className="siehub-shell siehub-ultimate-window admin-demo-shell">
    <header className="siehub-topbar">
      <div className="siehub-brand"><span className="siehub-brand-mark"><img src={siehubLogo} alt="SIEHUB" /><i></i></span><div><strong>SIEHUB</strong><small>ORGANIZATION GOVERNANCE</small></div></div>
      <div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)} title="外观设置"><Palette /></button><HubUserChip user={user} /><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div>
    </header>
    <div className="siehub-content">
      <button className="siehub-back" type="button" onClick={onBack}><ChevronLeft />返回模块总览</button>
      <section className="siehub-ultimate-hero">
        <span className="siehub-module-icon tone-gold"><ShieldCheck /></span>
        <div>
          <p>SIEHUB / ULTIMATE WINDOW</p>
          <h1>团委学生会组织治理中枢</h1>
          <span>届次成员、身份角色、分管部门与归档快照从 SIEVOX 中移出，由终极管理员在 SIEHUB 统一维护。</span>
        </div>
      </section>
      {allowed ? (
        <>
          <div className="siehub-portal-switch" aria-label="终极管理员工作区"><button type="button" className={workspace === 'organization' ? 'is-active' : ''} onClick={() => setWorkspace('organization')}>组织架构</button><button type="button" className={workspace === 'news' ? 'is-active' : ''} onClick={() => setWorkspace('news')}>Hero与新闻</button></div>
          <section className="siehub-organization-host">{workspace === 'news' ? <HeroNewsManagement token={token} /> : <OrganizationFrameworkPanel token={token} />}</section>
        </>
      ) : (
        <section className="siehub-access-denied">
          <LockKeyhole />
          <div><strong>仅终极管理员可访问</strong><span>该窗口包含团委学生会组织架构、成员身份、分管关系与届次归档能力。</span></div>
        </section>
      )}
    </div>
    <SIEHUBMobileDock active="home" onHome={onBack} onMy={onOpenMy} />
    <ThemePanel theme={theme} />
  </main>;
};

const SIEBridgeWindow = ({ user, token, theme, onBack, onOpenMy, onLogout, languageSwitcher = null }) => {
  const canReview = canReviewSIEBridgeContent(user);
  const [workspace, setWorkspace] = useState('student');

  return (
    <main className="siehub-shell siebridge-window">
      <header className="siehub-topbar">
        <div className="siehub-brand"><span className="siehub-brand-mark"><img src={siebridgeLogo} alt="SIEBridge" /><i></i></span><div><strong>SIEBridge</strong><small>COURSE RESOURCE PLATFORM</small></div></div>
        <div className="siehub-topbar-actions"><ThemeModeButtons theme={theme} compact /><button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)} title="外观设置"><Palette /></button><HubUserChip user={user} /><button className="icon-button" type="button" onClick={onOpenMy} title="账号设置"><UserRound /></button><button className="icon-button" type="button" onClick={onLogout} title="退出登录"><LogOut /></button>{languageSwitcher}</div>
      </header>
      <div className="siehub-content">
        <button className="siehub-back" type="button" onClick={onBack}><ChevronLeft />返回 SIEHUB</button>
        <section className="siehub-ultimate-hero">
          <span className="siehub-module-icon tone-blue"><img className="siehub-module-logo" src={siebridgeLogo} alt="SIEBridge" /></span>
          <div>
            <p>SIEHUB / SIEBRIDGE</p>
            <h1>SIEBridge 课程资源共享平台</h1>
            <span>面向学生开放课程资料检索、上传与审核进度查询，审核后的资源会在这里集中展示。</span>
          </div>
        </section>
        {canReview && (
          <div className="siehub-portal-switch siebridge-mode-switch" aria-label="SIEBridge 工作区切换">
            <button type="button" className={workspace === 'student' ? 'is-active' : ''} onClick={() => setWorkspace('student')}>学生端</button>
            <button type="button" className={workspace === 'review' ? 'is-active' : ''} onClick={() => setWorkspace('review')}>审核管理</button>
          </div>
        )}
        {workspace === 'review' && canReview ? <SIEBridgeReviewWorkspace token={token} /> : <SIEBridgeStudentPortal token={token} user={user} />}
      </div>
      <SIEHUBMobileDock active="home" onHome={onBack} onMy={onOpenMy} />
    <ThemePanel theme={theme} />
    </main>
  );
};

const HubInlineReturnButton = ({ onClick }) => (
  <button className="hub-inline-return" type="button" onClick={onClick} title="返回 SIEHUB 模块总览">
    <img src={siehubLogo} alt="" />
    <span>返回 SIEHUB</span>
  </button>
);

const Sidebar = ({ user, activePage, setActivePage, openCompose, onOpenManage, serviceMetrics, language = 'zh' }) => (
  <aside className="sidebar" aria-label="主导航">
    <div className="brand-lockup"><img src={sieLogo} alt="SIEVOX" /><div><strong>SIEVOX</strong><span>学生权益反馈系统</span></div></div>
    <nav className="side-nav">
      <p className="nav-label">学生服务</p>
      <button className={cls('nav-item', activePage === 'dashboard' && 'is-active')} type="button" onClick={() => setActivePage('dashboard')}><LayoutDashboard /><span>权益工作台</span></button>
      <button className="nav-item" type="button" onClick={() => openCompose()}><SquarePen /><span>发起反馈</span><kbd>N</kbd></button>
      <button className={cls('nav-item', activePage === 'feedbacks' && 'is-active')} type="button" onClick={() => setActivePage('feedbacks')}><MessagesSquare /><span>我的反馈</span><span className="nav-count">●</span></button>
      <button className={cls('nav-item', activePage === 'guide' && 'is-active')} type="button" onClick={() => setActivePage('guide')}><BookOpen /><span>服务指南</span></button>
      {onOpenManage && <><p className="nav-label">职责范围</p><button className="nav-item" type="button" onClick={onOpenManage}><LayoutDashboard /><span>反馈处理台</span></button></>}
    </nav>
    <ServiceHealthNote metrics={serviceMetrics.metrics} loading={serviceMetrics.loading} error={serviceMetrics.error} language={language} />
    <div className="sidebar-user">
      <span className="avatar">{firstChar(user?.name)}</span>
      <div><strong>{user?.name}</strong><span>{user?.identityLabel || (user?.isUltimateAdmin ? '终极管理员' : user?.studentId)}</span></div>
    </div>
  </aside>
);

const Topbar = ({ pageTitle, theme, notifications, unreadCount = 0, onToggleNotifications, showNotifications = true, user, portalView, onPortalChange, onBackToHub, languageSwitcher = null }) => (
  <header className="topbar">
    <div className="breadcrumb"><span>国际教育学院</span><ChevronRight /><strong id="page-title">{pageTitle}</strong></div>
    <div className="topbar-actions">
      {getSievoxPortalRole(user) !== 'student' && (
        <div className="role-switch" aria-label="当前身份">
          <button className={portalView === 'student' ? 'is-active' : ''} type="button" onClick={() => onPortalChange?.('student')}>本人反馈</button>
          <button type="button" onClick={() => onPortalChange?.(user?.isUltimateAdmin ? 'admin' : defaultSievoxPortalView(user))}>反馈处理台</button>
          {user?.isUltimateAdmin && <button type="button" onClick={() => onPortalChange?.('superadmin')}>终极管理</button>}
        </div>
      )}
      {onBackToHub && <HubInlineReturnButton onClick={onBackToHub} />}
      <div className="topbar-user-chip" aria-label="当前登录身份">
        <span>{user?.name}</span>
        <RoleTag user={user} />
      </div>
      <ThemeModeButtons theme={theme} compact />
      <button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)}><Palette /></button>
      {showNotifications && <button className="icon-button" type="button" title="消息通知" onClick={onToggleNotifications}><Bell />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>}
      {languageSwitcher}
    </div>
  </header>
);

const NotificationDrawer = ({ open, notifications = [], unreadCount = 0, onClose, onMarkReadAll, onMarkReadOne, onOpenNotification }) => {
  if (!open) return null;
  return (
    <div className="notification-drawer-backdrop" onClick={onClose}>
      <aside className="notification-drawer" onClick={event => event.stopPropagation()}>
        <header className="notification-drawer-head">
          <div>
            <p>MESSAGES</p>
            <h2>消息通知</h2>
            <span>未读 {unreadCount}</span>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭消息通知"><X /></button>
        </header>
        <div className="notification-drawer-actions">
          <button type="button" className="outline-button" onClick={onMarkReadAll} disabled={notifications.length === 0}>全部标为已读</button>
        </div>
        <div className="notification-drawer-list">
          {notifications.length === 0 ? (
            <p className="siehub-empty-text">暂无消息。</p>
          ) : notifications.map(item => {
            const unread = !item.isRead;
            return (
              <button
                key={item._id}
                type="button"
                className={cls('notification-item', unread && 'is-unread')}
                onClick={() => onOpenNotification ? onOpenNotification(item) : onMarkReadOne?.(item)}
              >
                <div>
                  <strong>{item.type === 'new_message' ? '新留言' : item.type === 'new_feedback' ? '新反馈' : '系统通知'}</strong>
                  <p>{item.content}</p>
                  <small>{new Date(item.createdAt).toLocaleString('zh-CN')}</small>
                </div>
                {unread && <span className="notification-unread-dot" />}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return <span className={`status ${meta.className}`}><i></i>{meta.label}</span>;
};

const CategoryIcon = ({ category }) => {
  const cat = getCategory(category);
  const Icon = cat.icon;
  return <span className={`case-icon ${cat.tileClass}`}><Icon /></span>;
};

const StatsStrip = ({ stats }) => (
  <div className="stats-strip" aria-label="反馈统计">
    <div><span>累计反馈</span><strong>{String(stats.total || 0).padStart(2, '0')}</strong><small>持续记录</small></div>
    <div><span>处理中</span><strong className="text-blue">{String(stats.processing || 0).padStart(2, '0')}</strong><small>等待部门更新</small></div>
    <div><span>已解决</span><strong className="text-green">{String(stats.resolved || 0).padStart(2, '0')}</strong><small>解决率提升中</small></div>
    <div><span>待受理</span><strong>{String(stats.pending || 0).padStart(2, '0')}</strong><small>进入受理队列</small></div>
  </div>
);

const CategoryGrid = ({ openCompose }) => (
  <div className="category-grid">
    {Object.entries(CATEGORIES_CONFIG).map(([key, cat]) => {
      const Icon = cat.icon;
      return (
        <button key={key} className={`category-tile ${cat.tileClass}`} type="button" onClick={() => openCompose(key)}>
          <span><Icon /></span><strong>{cat.label}</strong><small>{cat.desc}</small><ArrowUpRight />
        </button>
      );
    })}
  </div>
);

const FeedbackRow = ({ feedback, onOpen, onDelete }) => {
  const cat = getCategory(feedback.category);
  const canWithdraw = feedback.status === 'pending' && typeof onDelete === 'function';
  return (
    <article className="feedback-row">
      <button className="feedback-row-main" type="button" onClick={() => onOpen(feedback)}>
        <CategoryIcon category={feedback.category} />
        <span className="feedback-copy"><strong>{feedback.title}</strong><small>{cat.label} · {feedback.subCategory || '综合事项'}</small></span>
        <StatusPill status={feedback.status} />
        <span className="feedback-time"><strong>{formatDate(feedback.updatedAt || feedback.createdAt)}</strong><small>{feedback.responses?.length ? '已有部门回复' : '已进入队列'}</small></span>
        <ChevronRight />
      </button>
      {canWithdraw && (
        <button className="feedback-withdraw-button" type="button" onClick={() => onDelete(feedback._id)}>
          撤回
        </button>
      )}
    </article>
  );
};

const ActiveCase = ({ feedback, onOpen }) => {
  if (!feedback) return (
    <section className="active-case">
      <div className="section-heading compact"><div><p className="eyebrow">ACTIVE CASE</p><h2>暂无处理中事项</h2></div></div>
      <p className="case-summary">当前没有正在处理中的反馈。你可以发起新的问题反馈。</p>
    </section>
  );
  return (
    <section className="active-case">
      <div className="section-heading compact"><div><p className="eyebrow">ACTIVE CASE</p><h2>{STATUS_META[feedback.status]?.label || '处理中'}</h2></div><StatusPill status={feedback.status} /></div>
      <p className="case-number">#{feedback._id?.slice(-6)?.toUpperCase()}</p>
      <h3>{feedback.title}</h3>
      <p className="case-summary">{feedback.responses?.[feedback.responses.length - 1]?.content || '事项已进入处理流程，新的处理进展会通过站内通知同步。'}</p>
      <ol className="case-timeline">
        <li className="is-done"><span><Check /></span><div><strong>提交成功</strong><small>{formatDate(feedback.createdAt)}</small></div></li>
        <li className={feedback.status === 'resolved' ? 'is-done' : 'is-current'}><span>{feedback.status === 'resolved' ? <Check /> : null}</span><div><strong>{feedback.status === 'resolved' ? '处理完成' : '部门核实中'}</strong><small>{formatDate(feedback.updatedAt)}</small></div></li>
        <li><span></span><div><strong>归档留痕</strong><small>反馈记录永久保留</small></div></li>
      </ol>
      <button className="wide-outline-button" type="button" onClick={() => onOpen(feedback)}>查看完整对话<ArrowRight /></button>
    </section>
  );
};

const ComposeDrawer = ({ open, mobile, category, setCategory, onClose, onSubmit, loading, draft, setDraft, onSaveDraft, draftMessage }) => {
  const { subCategory, files } = draft;
  const form = draft;
  const setForm = next => setDraft(current => ({ ...current, ...next }));
  const setFiles = files => setDraft(current => ({ ...current, files }));
  const setSubCategory = subCategory => setDraft(current => ({ ...current, subCategory }));
  const activeCategory = category || '';
  const catMeta = activeCategory ? getCategory(activeCategory) : null;

  const submit = () => {
    if (!activeCategory || !subCategory || !form.title || !form.content) return alert('请完整填写问题领域、细分类别、标题和描述');
    const { files: draftFiles, ...payload } = form;
    onSubmit({ ...payload, category: activeCategory, subCategory }, draftFiles).then(ok => {
      if (ok) {
        setDraft(emptyFeedbackDraft());
      }
    });
  };

  if (mobile) {
    return (
      <section className={cls('mobile-sheet', open && 'is-open')} aria-hidden={!open}>
        <div className="sheet-handle"></div>
        <header><div><span>STEP 1 OF 3</span><h2>告诉我们发生了什么</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header>
        <div className="sheet-body">
          <label>问题领域</label>
          <select className="mobile-select" value={activeCategory} onChange={e => setCategory(e.target.value)}><option value="">请选择问题领域</option>{Object.entries(CATEGORIES_CONFIG).map(([key, cat]) => <option key={key} value={key}>{cat.label}</option>)}</select>
          <label>细分类别</label>
          <select value={subCategory} onChange={e => setSubCategory(e.target.value)}><option value="">请选择细分类别</option>{catMeta?.sub.map(item => <option key={item}>{item}</option>)}</select>
          <label>问题标题</label><input maxLength="50" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="用一句话概括问题" />
          <label>详细描述</label><textarea maxLength="500" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="时间、地点、具体情况…" />
          {files.length > 0 && <p>已选择 {files.length} 个附件</p>}
          {draftMessage && <p role="status">{draftMessage}</p>}
          <button className="text-button" type="button" onClick={onSaveDraft} disabled={loading}>暂存草稿（含附件）</button>
          <div className="sheet-actions">
            <label className="sheet-attach"><Paperclip /><input hidden type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
            <label className="mobile-anonymous"><input type="checkbox" checked={form.isAnonymous} onChange={e => setForm({ ...form, isAnonymous: e.target.checked })} /><i></i><span>匿名</span></label>
            <button className="sheet-next" type="button" onClick={submit} disabled={loading}>{loading ? '提交中' : '提交反馈'}<ArrowRight /></button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <aside className={cls('compose-drawer', open && 'is-open')} aria-hidden={!open} aria-label="发起反馈">
      <header><div><span>NEW FEEDBACK</span><h2>发起反馈</h2></div><button className="icon-button" type="button" onClick={onClose}><X /></button></header>
      <div className="compose-body">
        <div className="step-indicator"><span className="is-active">1</span><i></i><span>2</span><i></i><span>3</span><small>描述问题</small><small>补充信息</small><small>确认提交</small></div>
        <label className="field-label">问题领域</label>
        <div className="compose-categories">
          {Object.entries(CATEGORIES_CONFIG).map(([key, cat]) => <button key={key} className={activeCategory === key ? 'is-active' : ''} type="button" onClick={() => setCategory(key)}>{cat.label}</button>)}
        </div>
        <label className="input-field"><span>细分类别</span><select value={subCategory} onChange={e => setSubCategory(e.target.value)}><option value="">请选择详细诉求分类</option>{catMeta?.sub.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="input-field"><span>问题标题</span><input maxLength="50" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="用一句话概括你遇到的问题" /><small>{form.title.length} / 50</small></label>
        <label className="input-field textarea-field"><span>详细描述</span><textarea maxLength="500" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="请描述时间、地点、具体情况，以及你希望得到的帮助…" /><small>{form.content.length} / 500</small></label>
        <label className="upload-area"><ImagePlus /><div><strong>{files.length ? `已选择 ${files.length} 个文件` : '添加图片或视频'}</strong><p>最多 10 个文件，单个不超过 20MB</p></div><span className="outline-button">选择文件</span><input hidden type="file" multiple onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
        <div className="compose-options">
          <div><span>优先级</span><div className="priority-switch">{['normal', 'high', 'urgent'].map(key => <button key={key} className={form.priority === key ? 'is-active' : ''} type="button" onClick={() => setForm({ ...form, priority: key })}>{PRIORITY_LABEL[key]}</button>)}</div></div>
          <label><span><strong>匿名提交</strong><small>处理部门不可见你的身份</small></span><input className="switch-input" type="checkbox" checked={form.isAnonymous} onChange={e => setForm({ ...form, isAnonymous: e.target.checked })} /><i></i></label>
        </div>
      </div>
      {draftMessage && <p role="status">{draftMessage}</p>}
      <footer><button className="text-button" type="button" onClick={onSaveDraft} disabled={loading}>暂存草稿（含附件）</button><button className="primary-button" type="button" onClick={submit} disabled={loading}>确认并提交<Send /></button></footer>
    </aside>
  );
};

const FeedbackDialog = ({ feedback, onClose, onReply, onRecall, onDelete }) => {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => setReply(''), [feedback?._id]);
  if (!feedback) return null;
  const status = STATUS_META[feedback.status] || STATUS_META.pending;
  const submitReply = async () => {
    if (!reply.trim()) return;
    if (sending) return;
    setSending(true);
    try { if (await onReply(feedback._id, reply)) setReply(''); }
    finally { setSending(false); }
  };
  return (
    <div className="dialog-backdrop">
      <dialog className="feedback-dialog" open>
        <button className="dialog-close icon-button" type="button" onClick={onClose}><X /></button>
        <div className="dialog-status"><span className={`status ${status.className}`}><i></i>{status.label}</span><small>#{feedback._id?.slice(-6)?.toUpperCase()}</small></div>
        <h2>{feedback.title}</h2>
        <p>{feedback.content}</p>
        <AttachmentViewer attachments={feedback.attachments} />
        <ol className="dialog-timeline">
          <li className="done"><Check /><div><strong>提交成功</strong><small>{formatDate(feedback.createdAt)}</small></div></li>
          {(feedback.responses || []).map(resp => (
            <li className="current" key={resp._id || resp.createdAt}><MessagesSquare /><div><strong>{responseSenderLabel(resp)}</strong><small>{formatDate(resp.createdAt)}</small><p>{resp.isRecalled ? '该回复已被撤回' : resp.content}</p>{!resp.isRecalled && <AttachmentViewer attachments={resp.attachments} />}{!resp.isRecalled && resp.canRecall && <button className="text-button" type="button" onClick={() => onRecall(feedback._id, resp._id)}>撤回留言</button>}</div></li>
          ))}
        </ol>
        <div className="dialog-reply"><input value={reply} onChange={e => setReply(e.target.value)} placeholder="补充信息或回复处理老师…" /><button type="button" disabled={sending} onClick={submitReply}><Send /><span>{sending ? '发送中' : '发送'}</span></button></div>
        {feedback.status === 'pending' && <button className="text-button danger-text" type="button" onClick={() => onDelete(feedback._id)}>撤销这条反馈</button>}
      </dialog>
    </div>
  );
};

const StudentDesktop = ({ user, stats, feedbacks, activePage, setActivePage, openCompose, onOpenFeedback, onDeleteFeedback, clock, pagination, onPageChange, filter, onFilterChange, search, onSearchChange, listLoading }) => {
  const latest = feedbacks[0];
  const activeCase = feedbacks.find(item => item.status === 'processing') || latest;
  return (
    <section id="student-desktop" className="role-view">
      <div className={cls('page-panel', activePage === 'dashboard' && 'is-active')}>
        <div className="page-heading">
          <div><p className="eyebrow">{clock.dateLabel} · {clock.timeLabel} {clock.timezoneLabel}</p><h1>{clock.greeting}，{user?.name}</h1><p>你有 {stats.processing || 0} 条反馈正在处理，最近一次更新于 {latest ? formatDate(latest.updatedAt || latest.createdAt) : '暂无'}。</p></div>
          <button className="primary-button" type="button" onClick={() => openCompose()}><Plus />发起新反馈</button>
        </div>
        <StatsStrip stats={stats} />
        <div className="workspace-grid">
          <div className="workspace-primary">
            <section className="content-section"><div className="section-heading"><div><h2>从哪里开始？</h2><p>选择问题领域，我们会自动匹配负责部门。</p></div></div><CategoryGrid openCompose={openCompose} /></section>
            <section className="content-section feedback-section"><div className="section-heading"><div><h2>最近反馈</h2><p>所有进度与回复会在这里持续留痕。</p></div><button className="text-button" type="button" onClick={() => setActivePage('feedbacks')}>查看全部<ArrowRight /></button></div><div className="feedback-list">{feedbacks.slice(0, 3).map(item => <FeedbackRow key={item._id} feedback={item} onOpen={onOpenFeedback} onDelete={onDeleteFeedback} />)}</div></section>
          </div>
          <aside className="insight-rail"><ActiveCase feedback={activeCase} onOpen={onOpenFeedback} /><section className="response-note"><MessageCircleMore /><div><strong>你的声音，会抵达。</strong><p>匿名反馈不会向处理部门展示个人身份，所有操作均保留审计记录。</p></div></section></aside>
        </div>
      </div>

      <div className={cls('page-panel simple-page', activePage === 'feedbacks' && 'is-active')}>
        <div className="page-heading"><div><p className="eyebrow">MY FEEDBACK</p><h1>我的反馈</h1><p>按状态查看提交记录、部门回复与处理结果。</p></div><button className="primary-button" type="button" onClick={() => openCompose()}><Plus />发起新反馈</button></div>
        <div className="filter-row">{['', 'pending', 'processing', 'resolved', 'rejected'].map(status => <button key={status} type="button" className={cls('filter-chip', filter === status && 'is-active')} onClick={() => onFilterChange(status)}>{status ? STATUS_META[status].label : '全部'} {status ? stats[status] || 0 : stats.total}</button>)}<span></span><label className="search-field"><MessagesSquare /><input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="搜索标题或内容" /></label></div>
        {listLoading && <p role="status">正在加载…</p>}
        <div className="feedback-list full-list">{feedbacks.map(item => <FeedbackRow key={item._id} feedback={item} onOpen={onOpenFeedback} onDelete={onDeleteFeedback} />)}</div>
        <FeedbackPagination pagination={pagination} onPageChange={onPageChange} loading={listLoading} />
      </div>

      <div className={cls('page-panel simple-page', activePage === 'guide' && 'is-active')}>
        <div className="page-heading"><div><p className="eyebrow">SERVICE GUIDE</p><h1>服务指南</h1><p>了解反馈受理、处理时效、材料补充与紧急联系方式，提交前可先确认事项是否适合走线上流程。</p></div></div>
        <div className="guide-grid">
          <section><Route /><h2>反馈如何流转</h2><p>提交后由学生权益部先行受理，确认问题类别、紧急程度和是否需要补充材料，再分派至对应负责人与协同部门。</p></section>
          <section><Clock3 /><h2>响应时效</h2><p>普通事项原则上 1 个工作日内首次响应；涉及跨部门核实、场地维修、制度咨询等事项，会在详情页持续同步进展。</p></section>
          <section><PhoneCall /><h2>紧急事项</h2><p>涉及人身安全、突发疾病、火情、重大设备风险时，请优先联系学院老师、楼宇值班或校园应急渠道，线上反馈可作为后续留痕。</p></section>
          <section><ShieldCheck /><h2>材料与隐私</h2><p>可上传图片、文档、录屏或其他佐证材料。匿名反馈不会向处理部门展示个人身份，但系统会保留必要审计记录以防恶意提交。</p></section>
          <section><MessageCircleMore /><h2>补充与撤回</h2><p>事项提交后可在“我的反馈”中继续补充说明、查看回复。未进入处理流程前可撤回，已处理事项会保留归档记录。</p></section>
          <section><FileText /><h2>提交建议</h2><p>建议写清时间、地点、涉及对象、已尝试解决方式和期望结果。标题简洁、正文具体，会明显提升受理效率。</p></section>
        </div>
      </div>
    </section>
  );
};

const MobileShell = ({ user, feedbacks, stats, page, setPage, openCompose, onOpenFeedback, onOpenManage, theme, clock, unreadCount = 0, onToggleNotifications, showNotifications = true, languageSwitcher = null, pagination, onPageChange, filter, onFilterChange, search, onSearchChange, listLoading }) => {
  const latest = feedbacks.find(item => item.status === 'processing') || feedbacks[0];
  return (
    <div className="mobile-stage">
      <div className="mobile-shell">
        <header className="mobile-header">
          <div className="mobile-brand"><img src={sieLogo} alt="SIEVOX" /><div><strong>SIEVOX</strong><span>学生权益反馈</span></div></div>
          <div className="mobile-header-actions"><span className="mobile-role-chip"><span>{user?.name}</span><RoleTag user={user} /></span>{onOpenManage && <button className="icon-button" type="button" onClick={onOpenManage} title="反馈处理台" aria-label="反馈处理台"><LayoutDashboard /></button>}<button className="icon-button theme-trigger" type="button" onClick={() => theme.setOpen(true)}><Palette /></button>{showNotifications && <button className="icon-button" type="button" onClick={onToggleNotifications} title="消息通知"><Bell />{unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}</button>}{languageSwitcher}</div>
        </header>
        <main className="mobile-main">
          <section className={cls('mobile-page', page === 'home' && 'is-active')}>
            <div className="mobile-greeting"><p>{clock.greeting}，{user?.name}<span>{clock.timeLabel} {clock.timezoneLabel}</span></p><h1>今天想反馈什么？</h1></div>
            {latest && <button className="mobile-active-case" type="button" onClick={() => onOpenFeedback(latest)}><span className="case-state"><i></i>{STATUS_META[latest.status]?.label}</span><span className="case-code">#{latest._id?.slice(-6)?.toUpperCase()}</span><strong>{latest.title}</strong><p>{latest.responses?.length ? '已有部门回复' : '已进入处理队列'} · {formatDate(latest.updatedAt || latest.createdAt)}</p><span className="mobile-progress"><i></i></span><span className="progress-labels"><small>已提交</small><small>核实中</small><small>待完成</small></span></button>}
            <section className="mobile-section"><div className="mobile-section-head"><h2>快速反馈</h2><span>选择问题领域</span></div><div className="mobile-categories">{Object.entries(CATEGORIES_CONFIG).map(([key, cat]) => { const Icon = cat.icon; return <button key={key} type="button" onClick={() => openCompose(key, true)}><span className={cat.tileClass}><Icon /></span><small>{cat.short}</small></button>; })}</div></section>
            <section className="mobile-section recent-mobile"><div className="mobile-section-head"><h2>最近反馈</h2><button type="button" onClick={() => setPage('feedbacks')}>全部 {stats.total} 条<ChevronRight /></button></div>{feedbacks.slice(0, 2).map(item => <button key={item._id} className="mobile-feedback" type="button" onClick={() => onOpenFeedback(item)}><CategoryIcon category={item.category} /><span><strong>{item.title}</strong><small>{formatDate(item.createdAt)} · {getCategory(item.category).label}</small></span><StatusPill status={item.status} /></button>)}</section>
          </section>
          <section className={cls('mobile-page', page === 'feedbacks' && 'is-active')}>
            <div className="mobile-page-title"><button className="icon-button" type="button" onClick={() => setPage('home')}><ArrowLeft /></button><div><span>我的记录</span><h1>我的反馈</h1></div></div>
            <div className="mobile-filter-scroll">{['', 'pending', 'processing', 'resolved', 'rejected'].map(status => <button key={status} type="button" className={filter === status ? 'is-active' : ''} onClick={() => onFilterChange(status)}>{status ? STATUS_META[status].label : '全部'} {status ? stats[status] || 0 : stats.total}</button>)}</div>
            <label className="search-field"><MessagesSquare /><input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="搜索标题或内容" /></label>
            {listLoading && <p role="status">正在加载…</p>}
            <div className="mobile-history">{feedbacks.map(item => <button key={item._id} type="button" onClick={() => onOpenFeedback(item)}><span><StatusPill status={item.status} /><small>#{item._id?.slice(-6)?.toUpperCase()}</small></span><strong>{item.title}</strong><p>{item.responses?.[0]?.content || item.content}</p><time>更新于 {formatDate(item.updatedAt || item.createdAt)}</time></button>)}</div>
            <FeedbackPagination pagination={pagination} onPageChange={onPageChange} loading={listLoading} />
          </section>
          <section className={cls('mobile-page', page === 'guide' && 'is-active')}>
            <div className="mobile-page-title"><div><span>帮助中心</span><h1>服务指南</h1></div></div>
            <div className="mobile-guide">{[
              [Route, '反馈如何流转', '受理、分派、回复与归档', '提交后由学生权益部受理并确认问题类别，再分派至负责人或协同部门。处理进展会保留在反馈详情中。'],
              [Clock3, '处理需要多久', '普通事项 1 个工作日内响应', '普通事项原则上 1 个工作日内首次响应。跨部门核实、维修等事项可在完整对话中查看进展。'],
              [PhoneCall, '紧急情况处理', '先联系线下应急渠道', '涉及人身安全、突发疾病、火情时，请优先联系学院老师、楼宇值班或校园应急渠道。线上反馈可作为后续记录。'],
              [ShieldCheck, '材料与隐私', '附件支持佐证，匿名保护身份', '可上传图片、文档和录屏。匿名事项不会向处理部门显示个人身份，系统保留必要审计记录。'],
              [MessageCircleMore, '补充与撤回', '在我的反馈中继续跟进', '在我的反馈打开事项，可补充信息、查看回复及撤回自己的留言。未受理的反馈可以撤销。']
            ].map(([Icon, title, subtitle, description]) => <details key={title}><summary><Icon /><span><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight /></summary><p>{description}</p></details>)}</div>
          </section>
        </main>
        <nav className="mobile-tabbar" aria-label="手机端导航">
          <button className={page === 'home' ? 'is-active' : ''} type="button" onClick={() => setPage('home')}><House /><span>首页</span></button>
          <button className={page === 'feedbacks' ? 'is-active' : ''} type="button" onClick={() => setPage('feedbacks')}><MessagesSquare /><span>反馈</span></button>
          <button className="mobile-compose" type="button" onClick={() => openCompose('', true)}><Plus /></button>
          <button className={page === 'guide' ? 'is-active' : ''} type="button" onClick={() => setPage('guide')}><BookOpen /><span>指南</span></button>
        </nav>
      </div>
    </div>
  );
};

const SettingsModal = () => null;

const DashboardPage = ({ user, token, onLogout, onRefreshUser, onOpenMy, theme, portalView = 'student', onPortalChange, onBackToHub, renderLanguageSwitcher, language = 'zh', enableNotifications = false, notificationTarget }) => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activePage, setActivePage] = useState('dashboard');
  const [mobilePage, setMobilePage] = useState('home');
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileComposeOpen, setMobileComposeOpen] = useState(false);
  const [draft, setDraft] = useState(emptyFeedbackDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState('');
  const composeCategory = draft.category;
  const setComposeCategory = category => setDraft(current => ({ ...current, category, subCategory: current.category === category ? current.subCategory : '' }));
  const draftAccountId = user?.id || user?._id;
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, pending: 0, processing: 0, resolved: 0, rejected: 0 });
  const selectedFeedbackRef = useRef(null);
  const feedbackRequestRef = useRef(0);
  const submitInFlight = useRef(false);
  selectedFeedbackRef.current = selectedFeedback;
  const clock = usePlatformClock(language);
  const serviceMetrics = useServiceMetrics(token);
  const unreadCount = useMemo(() => notifications.filter(item => !item.isRead).length, [notifications]);

  useEffect(() => {
    let cancelled = false;
    feedbackDraftStore(draftAccountId, 'get').then(saved => {
      if (!cancelled && saved) { setDraft({ ...emptyFeedbackDraft(), ...saved }); setDraftMessage('已恢复暂存草稿（含附件）'); }
    }).catch(error => { if (!cancelled) setDraftMessage(error.message); }).finally(() => { if (!cancelled) setDraftReady(true); });
    return () => { cancelled = true; };
  }, [draftAccountId]);

  const saveFeedbackDraft = async () => {
    try {
      await feedbackDraftStore(draftAccountId, 'put', draft);
      setDraftMessage('草稿及附件已保存，可在本设备继续填写');
      setComposeOpen(false);
      setMobileComposeOpen(false);
    } catch (error) { setDraftMessage(error.message); }
  };

  const fetchFeedbacks = useCallback(async () => {
    const requestId = ++feedbackRequestRef.current;
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(feedbackPage), limit: '20' });
      if (filter) params.set('status', filter);
      if (search) params.set('search', search);
      const data = await requestJson(`/feedback/my?${params}`, token);
      if (requestId !== feedbackRequestRef.current) return;
      setFeedbacks(data.feedbacks || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      if (data.summary) setStats(data.summary);
      if (data.pagination?.pages > 0 && feedbackPage > data.pagination.pages) setFeedbackPage(data.pagination.pages);
      const selectedId = selectedFeedbackRef.current?._id;
      if (selectedId) {
        const detail = await requestJson(`/feedback/${selectedId}`, token);
        if (requestId === feedbackRequestRef.current && selectedFeedbackRef.current?._id === selectedId) setSelectedFeedback(detail.feedback);
      }
    } catch (error) { console.error('反馈读取失败', error); }
    finally { if (requestId === feedbackRequestRef.current) setListLoading(false); }
  }, [token, feedbackPage, filter, search]);

  useEffect(() => {
    if (!notificationTarget?.feedback) return;
    setSelectedFeedback(notificationTarget.feedback);
    setActivePage('feedbacks');
    setMobilePage('feedbacks');
  }, [notificationTarget]);

  const fetchNotifications = useCallback(async () => {
    if (!enableNotifications) return;
    try {
      const res = await fetch(`${API_BASE}/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setNotifications(data.notifications || []);
    } catch {}
  }, [enableNotifications, token]);

  const markNotificationsRead = useCallback(async (ids = []) => {
    if (!enableNotifications) return;
    try {
      const body = ids.length ? { ids } : {};
      const res = await fetch(`${API_BASE}/notifications/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(current => current.map(item => (
          ids.length === 0 || ids.includes(item._id)
            ? { ...item, isRead: true }
            : item
        )));
      }
    } catch {}
  }, [enableNotifications, token]);

  const handleOpenNotification = useCallback(async (notification) => {
    const feedbackId = notification?.feedbackId?._id || notification?.feedbackId || null;
    if (feedbackId) {
      try {
        const data = await requestJson(`/feedback/${feedbackId}`, token);
        setSelectedFeedback(data.feedback);
        setActivePage('feedbacks');
        setMobilePage('feedbacks');
        await markNotificationsRead([notification._id]);
      } catch (error) { alert(error.message); return; }
    }
    setShowNotifications(false);
  }, [token, markNotificationsRead]);

  useEffect(() => {
    fetchFeedbacks();
    if (enableNotifications) fetchNotifications();
    const id = setInterval(() => { fetchFeedbacks(); if (enableNotifications) fetchNotifications(); }, 12000);
    return () => clearInterval(id);
  }, [enableNotifications, fetchFeedbacks, fetchNotifications]);

  const openCompose = (category = '', mobile = false) => {
    if (!draftReady) return alert('草稿正在读取，请稍后重试');
    if (category) setComposeCategory(category);
    if (mobile) setMobileComposeOpen(true);
    else setComposeOpen(true);
  };

  const submitFeedback = async (formData, files) => {
    if (submitInFlight.current) return false;
    submitInFlight.current = true;
    setLoading(true);
    try {
      const uploadedFiles = await uploadFeedbackFiles(files, token);
      const res = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, attachments: uploadedFiles })
      });
      const data = await res.json();
      if (data.success) {
        setComposeOpen(false);
        setMobileComposeOpen(false);
        setActivePage('feedbacks');
        setMobilePage('feedbacks');
        setFeedbackPage(1);
        feedbackDraftStore(draftAccountId, 'delete').catch(() => setDraftMessage('已提交，但旧草稿清理失败'));
        await fetchFeedbacks();
      } else alert(data.message || '提交失败');
      return data.success;
    } catch (error) {
      alert(error.message || '网络错误，请重试');
      return false;
    } finally {
      submitInFlight.current = false;
      setLoading(false);
    }
  };

  const reply = async (feedbackId, content) => {
    try {
      const data = await requestJson(`/feedback/${feedbackId}/reply`, token, { method: 'POST', body: JSON.stringify({ content }) });
      setSelectedFeedback(current => current?._id === feedbackId ? data.feedback : current);
      fetchFeedbacks();
      return true;
    } catch (error) { alert(error.message || '发送失败'); return false; }
  };

  const recall = async (feedbackId, replyId) => {
    if (!window.confirm('确定撤回这条留言吗？')) return;
    const res = await fetch(`${API_BASE}/feedback/${feedbackId}/reply/${replyId}/recall`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      await fetchFeedbacks();
      setSelectedFeedback(null);
    } else alert(data.message || '撤回失败');
  };

  const deleteFeedback = async (feedbackId) => {
    if (!window.confirm('确定彻底撤销这条反馈吗？')) return;
    const res = await fetch(`${API_BASE}/feedback/${feedbackId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.success) {
      await fetchFeedbacks();
      setSelectedFeedback(null);
    } else alert(data.message || '撤销失败');
  };

  const pageTitle = activePage === 'feedbacks' ? '我的反馈' : activePage === 'guide' ? '服务指南' : '权益工作台';
  const listControls = { pagination, onPageChange: setFeedbackPage, filter, onFilterChange: status => { setFilter(status); setFeedbackPage(1); }, search, onSearchChange: value => { setSearch(value); setFeedbackPage(1); }, listLoading };
  const draftControls = { draft, setDraft, onSaveDraft: saveFeedbackDraft, draftMessage };

  return (
    <>
      <div className="desktop-shell">
        <Sidebar user={user} activePage={activePage} setActivePage={setActivePage} openCompose={openCompose} onOpenManage={getSievoxPortalRole(user) !== 'student' ? () => onPortalChange?.(defaultSievoxPortalView(user)) : null} serviceMetrics={serviceMetrics} language={language} />
        <main className="desktop-main">
          <Topbar
            pageTitle={pageTitle}
            theme={theme}
            notifications={enableNotifications ? notifications : []}
            unreadCount={enableNotifications ? unreadCount : 0}
            showNotifications={enableNotifications}
            onToggleNotifications={() => setShowNotifications(current => !current)}
            user={user}
            portalView={portalView}
            onPortalChange={onPortalChange}
            onBackToHub={onBackToHub}
            languageSwitcher={renderLanguageSwitcher?.()}
          />
          <StudentDesktop {...listControls} user={user} stats={stats} feedbacks={feedbacks} activePage={activePage} setActivePage={setActivePage} openCompose={openCompose} onOpenFeedback={setSelectedFeedback} onDeleteFeedback={deleteFeedback} clock={clock} />
        </main>
      </div>
      <MobileShell {...listControls} user={user} feedbacks={feedbacks} stats={stats} page={mobilePage} setPage={setMobilePage} openCompose={openCompose} onOpenFeedback={setSelectedFeedback} onOpenManage={getSievoxPortalRole(user) !== 'student' ? () => onPortalChange?.(defaultSievoxPortalView(user)) : null} theme={theme} clock={clock} unreadCount={enableNotifications ? unreadCount : 0} onToggleNotifications={() => setShowNotifications(current => !current)} showNotifications={enableNotifications} languageSwitcher={renderLanguageSwitcher?.()} />
      <div className={cls('drawer-backdrop', (composeOpen || mobileComposeOpen) && 'is-open')} onClick={() => { setComposeOpen(false); setMobileComposeOpen(false); }}></div>
      <ComposeDrawer {...draftControls} open={composeOpen} category={composeCategory} setCategory={setComposeCategory} onClose={() => setComposeOpen(false)} onSubmit={submitFeedback} loading={loading} />
      <ComposeDrawer {...draftControls} mobile open={mobileComposeOpen} category={composeCategory} setCategory={setComposeCategory} onClose={() => setMobileComposeOpen(false)} onSubmit={submitFeedback} loading={loading} />
      {enableNotifications && (
        <NotificationDrawer
          open={showNotifications}
          notifications={notifications}
          unreadCount={unreadCount}
          onClose={() => setShowNotifications(false)}
          onMarkReadAll={() => markNotificationsRead()}
          onMarkReadOne={item => markNotificationsRead([item._id])}
          onOpenNotification={handleOpenNotification}
        />
      )}
      <FeedbackDialog feedback={selectedFeedback} onClose={() => setSelectedFeedback(null)} onReply={reply} onRecall={recall} onDelete={deleteFeedback} />
      <ThemePanel theme={theme} />
    </>
  );
};

export default function App() {
  const { user, token, login, register, logout, refreshUser, authError } = useAuth();
  const theme = useTheme();
  const languageTools = useLanguage();
  const [portalView, setPortalView] = useState('superadmin');
  const [appSurface, setAppSurface] = useState(() => {
    const initialDepartmentModule = getInitialDepartmentModuleFromLocation();
    if (initialDepartmentModule) return 'department';
    const pathSurface = getCurrentPathSurface();
    if (pathSurface) return pathSurface;
    if (currentHost && SIEVOX_HOST && currentHost === SIEVOX_HOST) return 'sievox';
    if (currentHost && SIEBRIDGE_HOST && currentHost === SIEBRIDGE_HOST) return 'siebridge';
    return 'hub';
  });
  const [activeModule, setActiveModule] = useState(() => getInitialDepartmentModuleFromLocation());
  const [departmentEntry, setDepartmentEntry] = useState('');
  const [notificationTarget, setNotificationTarget] = useState(null);
  const historySyncRef = useRef({ initialized: false, applyingPop: false, signature: '' });
  const renderLanguageSwitcher = () => <LanguageSwitcher language={languageTools.language} setLanguage={languageTools.setLanguage} />;

  useEffect(() => {
    document.body.classList.toggle('auth-active', !user);
    return () => document.body.classList.remove('auth-active');
  }, [user]);

  useEffect(() => {
    if (user && appSurface === 'sievox') {
      setPortalView(defaultSievoxPortalView(user));
    }
  }, [user, appSurface]);

  useEffect(() => {
    if (!user) {
      setNotificationTarget(null);
      const initialDepartmentModule = getInitialDepartmentModuleFromLocation();
      setAppSurface(initialDepartmentModule ? 'department' : (getCurrentPathSurface() || 'hub'));
      setActiveModule(initialDepartmentModule);
      historySyncRef.current = { initialized: false, applyingPop: false, signature: '' };
    }
  }, [user]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (!isSIEHUBHistoryState(event.state)) {
        historySyncRef.current.applyingPop = true;
        setAppSurface(getCurrentPathSurface() || 'hub');
        setActiveModule(getInitialDepartmentModuleFromLocation());
        return;
      }
      const nextSurface = SIEHUB_APP_SURFACES.has(event.state.appSurface) ? event.state.appSurface : 'hub';
      historySyncRef.current.applyingPop = true;
      setAppSurface(nextSurface);
      setActiveModule(findSIEHUBModuleByKey(event.state.activeModuleKey));
      setPortalView(SIEHUB_PORTAL_VIEWS.has(event.state.portalView) ? event.state.portalView : 'superadmin');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const state = createSIEHUBHistoryState(appSurface, activeModule, portalView);
    const signature = JSON.stringify(state);
    const targetUrl = getUrlForSIEHUBState(appSurface, activeModule);
    if (historySyncRef.current.applyingPop) {
      historySyncRef.current.applyingPop = false;
      historySyncRef.current.signature = signature;
      historySyncRef.current.initialized = true;
      return;
    }
    if (!historySyncRef.current.initialized) {
      window.history.replaceState(state, '', targetUrl);
      historySyncRef.current = { initialized: true, applyingPop: false, signature };
      return;
    }
    if (historySyncRef.current.signature !== signature) {
      window.history.pushState(state, '', targetUrl);
      historySyncRef.current.signature = signature;
    }
  }, [user, appSurface, activeModule, portalView]);

  const openModule = (module) => {
    setDepartmentEntry('');
    setActiveModule(module);
    if (module.key === 'hub_governance') {
      setAppSurface(user?.isUltimateAdmin ? 'ultimateOrganization' : 'hub');
      return;
    }
    setAppSurface('department');
  };
  const openDepartments = () => setAppSurface('departments');
  const openUltimate = () => setAppSurface('ultimateOrganization');
  const openMy = () => setAppSurface('my');
  const openSIEVOX = (target = null) => {
    setNotificationTarget(target?.feedback ? target : null);
    setActiveModule(SIEHUB_MODULES.find(module => module.key === 'student_rights'));
    setPortalView(defaultSievoxPortalView(user));
    setAppSurface('sievox');
  };
  const openSievoxPerformance = () => {
    setDepartmentEntry('performance');
    setActiveModule(SIEHUB_MODULES.find(module => module.key === 'student_rights'));
    setAppSurface('department');
  };
  const openSIEBridge = () => {
    setActiveModule(SIEHUB_MODULES.find(module => module.key === 'academic_technology'));
    setAppSurface('siebridge');
  };
  const sievoxPortalView = resolveSievoxPortalView(user, portalView);

  let content;
  if (!user && token) content = <main className="auth-session-status"><p role="status">{authError || '正在验证登录…'}</p>{authError && <button type="button" onClick={refreshUser}>重新连接</button>}<button type="button" onClick={logout}>退出登录</button></main>;
  else if (!user) content = <LoginPage onLogin={login} onRegister={register} theme={theme} language={languageTools.language} languageSwitcher={renderLanguageSwitcher()} />;
  else if (appSurface === 'hub') content = <SIEHUBHome user={user} token={token} theme={theme} onOpenModule={openModule} onOpenDepartments={openDepartments} onOpenSIEVOX={openSIEVOX} onOpenSIEBridge={openSIEBridge} onOpenUltimate={openUltimate} onOpenMy={openMy} onLogout={logout} language={languageTools.language} languageSwitcher={renderLanguageSwitcher()} />;
  else if (appSurface === 'departments') content = <SIEHUBDepartmentDirectory user={user} theme={theme} onBack={() => setAppSurface('hub')} onOpenModule={openModule} onOpenMy={openMy} onLogout={logout} languageSwitcher={renderLanguageSwitcher()} />;
  else if (appSurface === 'my') content = <MyProfileWindow user={user} token={token} theme={theme} onBack={() => setAppSurface('hub')} onOpenDepartments={openDepartments} onOpenMy={openMy} onLogout={logout} onRefreshUser={refreshUser} languageSwitcher={renderLanguageSwitcher()} />;
  else if (appSurface === 'ultimateOrganization') content = <UltimateOrganizationWindow user={user} token={token} theme={theme} onBack={() => setAppSurface('hub')} onOpenMy={openMy} onLogout={logout} languageSwitcher={renderLanguageSwitcher()} />;
  else if (appSurface === 'sievox') {
    content = sievoxPortalView === 'student'
      ? <DashboardPage key={user.id || user._id} notificationTarget={notificationTarget} user={user} token={token} onLogout={logout} onRefreshUser={refreshUser} onOpenMy={openMy} theme={theme} portalView={sievoxPortalView} onPortalChange={setPortalView} onBackToHub={() => setAppSurface('hub')} renderLanguageSwitcher={renderLanguageSwitcher} language={languageTools.language} enableNotifications={true} />
      : <AdminDashboard key={user.id || user._id} notificationTarget={notificationTarget} user={user} token={token} onLogout={logout} onRefreshUser={refreshUser} onOpenMy={openMy} onOpenUltimate={openUltimate} onOpenPerformance={openSievoxPerformance} themeTools={theme} portalView={sievoxPortalView} onPortalChange={setPortalView} onBackToHub={() => setAppSurface('hub')} language={languageTools.language} languageSwitcher={renderLanguageSwitcher()} />;
  }
  else if (appSurface === 'department') content = <DepartmentPlaceholder module={activeModule} user={user} token={token} theme={theme} onBack={() => setAppSurface('hub')} onOpenSIEVOX={openSIEVOX} onOpenSIEBridge={openSIEBridge} onOpenMy={openMy} onLogout={logout} initialWorkspace={departmentEntry} languageSwitcher={renderLanguageSwitcher()} language={languageTools.language} />;
  else if (appSurface === 'siebridge') content = <SIEBridgeWindow user={user} token={token} theme={theme} onBack={() => setAppSurface('hub')} onOpenMy={openMy} onLogout={logout} languageSwitcher={renderLanguageSwitcher()} />;
  else if (user.role === 'admin' || user.role === 'superadmin') {
    content = (
      <>
        <AdminDashboard user={user} token={token} onLogout={logout} onRefreshUser={refreshUser} onOpenMy={openMy} onOpenPerformance={openSievoxPerformance} themeTools={theme} portalView={user.isUltimateAdmin ? portalView : undefined} onPortalChange={setPortalView} onBackToHub={() => setAppSurface('hub')} language={languageTools.language} languageSwitcher={renderLanguageSwitcher()} />
        <ThemePanel theme={theme} />
      </>
    );
  } else {
    content = <DashboardPage user={user} token={token} onLogout={logout} onRefreshUser={refreshUser} onOpenMy={openMy} theme={theme} onBackToHub={() => setAppSurface('hub')} renderLanguageSwitcher={renderLanguageSwitcher} language={languageTools.language} />;
  }

  return (
    <>
      {content}
      {user && <SiteLegalFooter />}
    </>
  );
}
