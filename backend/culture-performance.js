const mongoose = require('mongoose');
const { getVolunteerPerformancePolicy, isValidManagedDepartment } = require('./organization');

const ASSIGNMENT = Object.freeze({ organization: 'student_union', department: 'culture_sports_arts' });
const ROUTE = '/api/hub/departments/student_union/culture_sports_arts/culture-performance';
const LEADER_POSITIONS = ['department_head', 'youth_league_cadre'];
const PRESIDIUM_POSITIONS = ['presidium_member', 'youth_league_deputy_secretary'];
const DEFAULT_CULTURE_STANDARD = {
  levels: [
    { text: '优秀', ratio: 1 }, { text: '良好', ratio: 0.85 },
    { text: '合格', ratio: 0.7 }, { text: '待改进', ratio: 0.6 }, { text: '不合格', ratio: 0.4 }
  ],
  dims: [
    { name: '出勤参与', max: 30, items: [
      { name: '例会出勤', max: 10, desc: '按时参加部门例会，无迟到早退、无故缺席' },
      { name: '活动到场率', max: 12, desc: '本部门活动实际到场次数占应参与次数的比例' },
      { name: '任务响应速度', max: 8, desc: '接到通知及时回复，按时到场，不拖延失联' }
    ] },
    { name: '工作贡献', max: 35, items: [
      { name: '承担任务量', max: 12, desc: '本月实际承担的任务数量与难易程度' },
      { name: '完成质量', max: 12, desc: '交付成果符合标准，无明显疏漏与返工' },
      { name: '主动加担', max: 11, desc: '职责之外主动承担，关键时刻顶得上' }
    ] },
    { name: '团队协作', max: 20, items: [
      { name: '部门内配合', max: 10, desc: '主动补位，配合他人完成工作，不本位主义' },
      { name: '跨部门沟通', max: 10, desc: '与其他部门对接顺畅，能推进协作事项' }
    ] },
    { name: '创新与作风', max: 15, items: [
      { name: '创意与建议', max: 5, desc: '提出可行的活动创意或工作改进建议' },
      { name: '部门建设', max: 5, desc: '为部门制度、资料沉淀、新人带教作出贡献' },
      { name: '材料归档', max: 5, desc: '活动资料按规范及时提交，命名统一' }
    ] }
  ],
  weight: { leader: 70, self: 30 }, selfDueHour: 20,
  bonus: { name: '加分项', max: 10, desc: '突出贡献、获奖、承担重大专项' },
  minus: { name: '扣分项', max: 10, desc: '违纪、失职、延误、材料缺失' }
};
const monthlyStandardSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true },
  configuration: { type: mongoose.Schema.Types.Mixed, required: true },
  version: { type: Number, default: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
const monthlyScoreSchema = new mongoose.Schema({
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', default: null },
  month: { type: String, required: true },
  organization: { type: String, default: ASSIGNMENT.organization, enum: [ASSIGNMENT.organization] },
  department: { type: String, default: ASSIGNMENT.department, enum: [ASSIGNMENT.department] },
  targetSnapshot: { name: String, studentId: String, positionTitle: String },
  selfScore: { type: Number, min: 0, max: 100, default: null },
  workLogs: [{ t: String, d: String, w: String }],
  selfComment: { type: String, default: '' },
  selfSubmittedAt: Date,
  leaderScore: { type: Number, default: null },
  dimensionScores: { type: mongoose.Schema.Types.Mixed, default: {} },
  itemDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  bonus: { type: Number, default: 0 }, minus: { type: Number, default: 0 },
  leaderComment: { type: String, default: '' },
  ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  raterName: { type: String, default: '' }, ratingDate: String, ratedAt: Date,
  standardSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  standardVersion: { type: Number, default: 0 }
}, { timestamps: true });
monthlyScoreSchema.index({ target: 1, month: 1 }, { unique: true });
monthlyScoreSchema.index({ organization: 1, department: 1, month: 1 });
const CultureMonthlyStandard = mongoose.models.CultureMonthlyStandard || mongoose.model('CultureMonthlyStandard', monthlyStandardSchema);
const CultureMonthlyScore = mongoose.models.CultureMonthlyScore || mongoose.model('CultureMonthlyScore', monthlyScoreSchema);
const departmentMonthlyStandardSchema = new mongoose.Schema({
  ...monthlyStandardSchema.obj,
  month: { type: String, required: true },
  organization: { type: String, required: true },
  department: { type: String, required: true }
}, { timestamps: true });
departmentMonthlyStandardSchema.index({ organization: 1, department: 1, month: 1 }, { unique: true });
const departmentMonthlyScoreSchema = new mongoose.Schema({
  ...monthlyScoreSchema.obj,
  organization: { type: String, required: true },
  department: { type: String, required: true }
}, { timestamps: true });
departmentMonthlyScoreSchema.index({ organization: 1, department: 1, target: 1, month: 1 }, { unique: true });
const DepartmentMonthlyStandard = mongoose.models.DepartmentMonthlyStandard || mongoose.model('DepartmentMonthlyStandard', departmentMonthlyStandardSchema);
const DepartmentMonthlyScore = mongoose.models.DepartmentMonthlyScore || mongoose.model('DepartmentMonthlyScore', departmentMonthlyScoreSchema);

const round = value => Math.round(value * 10) / 10;
const text = (value, max) => String(value ?? '').trim().slice(0, max);
const isValidMonth = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(month || ''));
const currentChinaMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date());
const badInput = message => Object.assign(new Error(message), { status: 400 });
const numberInRange = (value, min, max, label) => {
  if (value === null || value === undefined || String(value).trim() === '' || typeof value === 'boolean') throw badInput(`${label}不能为空`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw badInput(`${label}应在 ${min} 到 ${max} 之间`);
  return number;
};
const isDepartmentMember = (user, assignment) => user && user.isActive !== false &&
  user.organization === assignment.organization && user.department === assignment.department &&
  ((user.role === 'admin' && user.memberRole === 'volunteer' && user.positionTitle === 'volunteer') ||
    (user.role === 'superadmin' && user.memberRole === 'department_lead' && LEADER_POSITIONS.includes(user.positionTitle)));
const standardFromPolicy = policy => {
  const regular = (policy.dimensions || []).filter(item => item.scoringMode !== 'bonus' && item.key !== 'bonus');
  const total = regular.reduce((sum, item) => sum + Number(item.maxScore || 0), 0);
  if (!regular.length || total <= 0) return DEFAULT_CULTURE_STANDARD;
  let allocated = 0;
  const dims = regular.map((item, index) => {
    const max = index === regular.length - 1 ? Math.round((100 - allocated) * 10) / 10 : Math.round(Number(item.maxScore || 0) / total * 1000) / 10;
    allocated += max;
    return { name: item.label, max, items: [{ name: item.label, max, desc: item.rule || '' }] };
  });
  const bonus = (policy.dimensions || []).find(item => item.scoringMode === 'bonus' || item.key === 'bonus');
  const selfWeight = Number(policy.evaluationWeights?.self);
  const leaderWeight = Number(policy.evaluationWeights?.leader);
  const weight = Number.isFinite(selfWeight) && Number.isFinite(leaderWeight) && Math.abs(selfWeight + leaderWeight - 100) < 0.001
    ? { self: selfWeight, leader: leaderWeight } : DEFAULT_CULTURE_STANDARD.weight;
  return { ...DEFAULT_CULTURE_STANDARD, dims, weight, bonus: { ...DEFAULT_CULTURE_STANDARD.bonus, name: bonus?.label || '加分项', max: policy.bonusMode === 'extra' && bonus?.maxScore == null ? null : bonus?.maxScore ?? DEFAULT_CULTURE_STANDARD.bonus.max, desc: bonus?.rule || '' } };
};
const userBrief = user => ({
  id: String(user._id || user.id), name: user.name || '', studentId: user.studentId || '',
  positionTitle: user.positionTitle || 'volunteer', isActive: user.isActive !== false
});
const normalizeCultureStandard = input => {
  if (!input || !Array.isArray(input.levels) || !input.levels.length || input.levels.length > 20 ||
      !Array.isArray(input.dims) || !input.dims.length || input.dims.length > 20) throw badInput('请设置评分等级和考核维度');
  const levels = input.levels.map(level => ({ text: text(level.text, 40), ratio: numberInRange(level.ratio, 0, 1, '等级系数') }));
  if (levels.some(level => !level.text) || new Set(levels.map(level => level.text)).size !== levels.length) throw badInput('评分等级名称不能为空或重复');
  const dims = input.dims.map(dim => {
    if (!Array.isArray(dim.items) || !dim.items.length || dim.items.length > 50) throw badInput('每个维度至少需要一个考核项');
    const items = dim.items.map(item => ({ name: text(item.name, 100), max: numberInRange(item.max, 0, 100, '考核项满分'), desc: text(item.desc, 1000) }));
    const max = numberInRange(dim.max, 0, 100, '维度满分');
    if (items.some(item => !item.name) || Math.abs(items.reduce((sum, item) => sum + item.max, 0) - max) > 0.001) throw badInput('维度满分必须等于其考核项满分之和');
    return { name: text(dim.name, 100), max, items };
  });
  if (dims.some(dim => !dim.name || ['__proto__', 'constructor', 'prototype'].includes(dim.name)) || new Set(dims.map(dim => dim.name)).size !== dims.length) throw badInput('维度名称不能为空或重复');
  if (Math.abs(dims.reduce((sum, dim) => sum + dim.max, 0) - 100) > 0.001) throw badInput('所有维度满分合计应为 100 分');
  const weight = {
    leader: numberInRange(input.weight?.leader, 0, 100, '管理评分权重'),
    self: numberInRange(input.weight?.self, 0, 100, '自评权重')
  };
  if (Math.abs(weight.leader + weight.self - 100) > 0.001) throw badInput('两项权重之和应为 100%');
  const selfDueHour = numberInRange(input.selfDueHour ?? 20, 0, 23, '自评截止小时');
  if (!Number.isInteger(selfDueHour)) throw badInput('自评截止小时应为整数');
  const adjustment = (item, label, allowUnlimited = false) => ({ name: text(item?.name || label, 100), max: allowUnlimited && item?.max === null ? null : numberInRange(item?.max ?? 10, 0, 100, label), desc: text(item?.desc, 1000) });
  return { levels, dims, weight, selfDueHour, bonus: adjustment(input.bonus, '加分项', true), minus: adjustment(input.minus, '扣分项') };
};
const calculateCultureGrade = (details, standard) => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw badInput('逐项评分无效');
  const clean = {}, dimensions = {}, allowedKeys = new Set(['bonus', 'minus']);
  let total = 0;
  standard.dims.forEach((dim, di) => {
    let sum = 0;
    dim.items.forEach((item, ii) => {
      const key = `i_${di}_${ii}`;
      allowedKeys.add(key);
      const value = details[key];
      if (value === undefined || value === '') return;
      const level = standard.levels.find(level => level.text === value);
      if (!level) throw badInput('逐项评分与当前考核标准不一致，请刷新后重新评分');
      clean[key] = level.text;
      sum += item.max * level.ratio;
    });
    dimensions[dim.name] = round(sum);
    total += sum;
  });
  if (Object.keys(details).some(key => !allowedKeys.has(key))) throw badInput('评分中包含无效考核项');
  const bonus = numberInRange(details.bonus ?? 0, 0, standard.bonus.max == null ? Infinity : standard.bonus.max, '加分项');
  const minus = numberInRange(details.minus ?? 0, 0, standard.minus.max, '扣分项');
  clean.bonus = bonus; clean.minus = minus;
  return { itemDetails: clean, dimensionScores: dimensions, bonus, minus, leaderScore: round(Math.max(0, standard.bonus.max == null ? total + bonus - minus : Math.min(100 + standard.bonus.max, total + bonus - minus))) };
};
const normalizeWorkLogs = (input, month) => {
  if (!Array.isArray(input) || input.length > 100) throw badInput('工作纪实格式无效');
  const logs = input.filter(log => text(log?.t, 200) || text(log?.w, 2000)).map(log => {
    const entry = { t: text(log.t, 200), d: text(log.d, 10), w: text(log.w, 2000) };
    if (!entry.t || !entry.w) throw badInput('每条工作纪实需填写事项名称和具体工作');
    const date = new Date(`${entry.d}T00:00:00Z`);
    if (entry.d && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.d) || entry.d.slice(0, 7) !== month || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== entry.d)) throw badInput('工作纪实日期应属于当前考核月份');
    return entry;
  });
  if (!logs.length) throw badInput('请填写至少一条工作纪实');
  return logs;
};
const serializeCultureScore = document => {
  const score = document?.toObject ? document.toObject() : document;
  const targetId = String(score.target?._id || score.target);
  const populatedTarget = score.target?.name ? score.target : null;
  const target = { ...(score.targetSnapshot || {}), ...(populatedTarget ? userBrief(populatedTarget) : {}), id: targetId };
  const leader = score.leaderScore ?? null, self = score.selfScore ?? null;
  const standard = score.standardSnapshot || DEFAULT_CULTURE_STANDARD;
  const combinedScore = leader === null || self === null ? null : round(leader * standard.weight.leader / 100 + self * standard.weight.self / 100);
  return {
    id: String(score._id), target, cohortId: score.cohort ? String(score.cohort) : null, month: score.month,
    selfScore: self, workLogs: score.workLogs || [], selfComment: score.selfComment || '', selfSubmittedAt: score.selfSubmittedAt || null,
    leaderScore: leader, dimensionScores: score.dimensionScores || {}, itemDetails: score.itemDetails || {},
    bonus: score.bonus || 0, minus: score.minus || 0, leaderComment: score.leaderComment || '',
    raterName: score.raterName || '', ratingDate: score.ratingDate || '', ratedAt: score.ratedAt || null,
    combinedScore, standardSnapshot: standard, standardVersion: score.standardVersion || 0,
    status: leader !== null && self !== null ? '已完成' : leader !== null ? '已评分' : '已自评'
  };
};

const installCulturePerformanceRoutes = ({ app, authenticate, logAction, User, CohortMembership, DepartmentPerformancePolicy, getDepartmentPerformanceAccess, getDepartmentCapabilityAccess }) => {
  const cultureScope = { assignment: ASSIGNMENT, Score: CultureMonthlyScore, Standard: CultureMonthlyStandard, legacy: true };
  const scopeFor = req => {
    if (!req.params?.organization) return cultureScope;
    const assignment = { organization: req.params.organization, department: req.params.department };
    return isValidManagedDepartment(assignment)
      ? assignment.organization === ASSIGNMENT.organization && assignment.department === ASSIGNMENT.department
        ? cultureScope : { assignment, Score: DepartmentMonthlyScore, Standard: DepartmentMonthlyStandard, legacy: false }
      : null;
  };
  const standardFilter = (scope, month) => scope.legacy ? { month } : { ...scope.assignment, month };
  const canManage = (user, scope) => Boolean(getDepartmentPerformanceAccess(user, scope.assignment));
  const canEnter = (user, scope) => canManage(user, scope) ||
    (isDepartmentMember(user, scope.assignment) && Boolean(getDepartmentCapabilityAccess(user, scope.assignment, 'participate')));
  const canGrade = (actor, target, scope) => canManage(actor, scope) &&
    (!LEADER_POSITIONS.includes(target.positionTitle) || actor.isUltimateAdmin || PRESIDIUM_POSITIONS.includes(actor.positionTitle));
  const loadStandard = async (scope, month) => {
    const doc = await scope.Standard.findOne(standardFilter(scope, month)).lean();
    if (doc) return { configuration: doc.configuration, version: doc.version || 0 };
    if (scope.legacy) return { configuration: DEFAULT_CULTURE_STANDARD, version: 0 };
    const custom = DepartmentPerformancePolicy ? await DepartmentPerformancePolicy.findOne(scope.assignment).lean() : null;
    const policy = custom?.dimensions?.length ? custom : getVolunteerPerformancePolicy(scope.assignment.organization, scope.assignment.department);
    return { configuration: standardFromPolicy(policy), version: 0 };
  };
  const fail = (res, error, message) => res.status(error.status || 500).json({ success: false, message: error.status ? error.message : message });
  const workbench = async (req, res) => {
    const scope = scopeFor(req);
    if (!scope) return res.status(404).json({ success: false, message: '部门模块不存在' });
    if (!canEnter(req.user, scope)) return res.status(403).json({ success: false, message: '无权访问该部门考核' });
    const month = req.query.month || currentChinaMonth();
    if (!isValidMonth(month)) return res.status(400).json({ success: false, message: '月份格式应为 YYYY-MM' });
    try {
      const manager = canManage(req.user, scope);
      const scoreScope = { ...scope.assignment, ...(manager ? {} : { target: req.user._id }) };
      const [members, scores, standard, months, standardMonths] = await Promise.all([
        User.find({ ...scope.assignment, isActive: true, $or: [{ role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer' }, { role: 'superadmin', memberRole: 'department_lead', positionTitle: { $in: LEADER_POSITIONS } }], ...(manager ? {} : { _id: req.user._id }) }).select('name studentId role positionTitle memberRole organization department isActive').sort({ studentId: 1 }).lean(),
        scope.Score.find({ ...scoreScope, month }).populate('target', 'name studentId positionTitle isActive').sort({ createdAt: 1 }).lean(),
        loadStandard(scope, month), scope.Score.distinct('month', scoreScope), scope.Standard.distinct('month', scope.legacy ? {} : scope.assignment)
      ]);
      const visibleScores = manager ? scores.filter(score => {
        const targetId = String(score.target?._id || score.target);
        if (targetId === String(req.user._id)) return true;
        const target = members.find(member => String(member._id) === targetId) || score.targetSnapshot;
        return target && canGrade(req.user, target, scope);
      }) : scores;
      const viewerRole = req.user.isUltimateAdmin ? 'ultimate_admin' : PRESIDIUM_POSITIONS.includes(req.user.positionTitle) ? 'presidium' : LEADER_POSITIONS.includes(req.user.positionTitle) ? 'department_lead' : 'volunteer';
      res.json({ success: true, month, months: Array.from(new Set([month, ...months, ...standardMonths])).sort(),
        viewerId: String(req.user._id), access: { canManage: manager, canEditStandards: manager, viewerRole },
        members: members.map(member => ({ ...userBrief(member), canGrade: canGrade(req.user, member, scope), canSelf: String(member._id) === String(req.user._id) })),
        scores: visibleScores.map(serializeCultureScore), standard: standard.configuration, standardVersion: standard.version });
    } catch (error) { fail(res, error, '加载部门考核失败'); }
  };
  for (const route of [ROUTE, '/api/hub/departments/:organization/:department/monthly-performance']) {
    app.get(`${route}-workbench`, authenticate, workbench);
    app.put(`${route}-standards`, authenticate, (_req, res) => res.status(410).json({ success: false, message: '月度考核已停用，请使用学期绩效' }));
    app.put(`${route}-scores`, authenticate, (_req, res) => res.status(410).json({ success: false, message: '月度考核已停用，请使用学期绩效' }));
  }
  app.delete('/api/hub/departments/:organization/:department/monthly-performance-standards', authenticate, (_req, res) => res.status(410).json({ success: false, message: '月度考核已停用，请使用学期绩效' }));
};
module.exports = { DEFAULT_CULTURE_STANDARD, CultureMonthlyScore, CultureMonthlyStandard, DepartmentMonthlyScore, DepartmentMonthlyStandard, standardFromPolicy, calculateCultureGrade, normalizeCultureStandard, serializeCultureScore, isValidMonth, installCulturePerformanceRoutes };
