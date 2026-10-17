const mongoose = require('mongoose');

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
const isCultureMember = user => user && user.isActive !== false &&
  user.organization === ASSIGNMENT.organization && user.department === ASSIGNMENT.department &&
  ((user.role === 'admin' && user.memberRole === 'volunteer' && user.positionTitle === 'volunteer') ||
    (user.role === 'superadmin' && user.memberRole === 'department_lead' && LEADER_POSITIONS.includes(user.positionTitle)));
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
  const adjustment = (item, label) => ({ name: text(item?.name || label, 100), max: numberInRange(item?.max ?? 10, 0, 100, label), desc: text(item?.desc, 1000) });
  return { levels, dims, weight, selfDueHour, bonus: adjustment(input.bonus, '加分项'), minus: adjustment(input.minus, '扣分项') };
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
  const bonus = numberInRange(details.bonus ?? 0, 0, standard.bonus.max, '加分项');
  const minus = numberInRange(details.minus ?? 0, 0, standard.minus.max, '扣分项');
  clean.bonus = bonus; clean.minus = minus;
  return { itemDetails: clean, dimensionScores: dimensions, bonus, minus, leaderScore: round(Math.max(0, Math.min(100 + standard.bonus.max, total + bonus - minus))) };
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

const installCulturePerformanceRoutes = ({ app, authenticate, logAction, User, CohortMembership, getDepartmentPerformanceAccess, getDepartmentCapabilityAccess }) => {
  const canManage = user => Boolean(getDepartmentPerformanceAccess(user, ASSIGNMENT));
  const canEnter = user => canManage(user) || (isCultureMember(user) && Boolean(getDepartmentCapabilityAccess(user, ASSIGNMENT, 'participate')));
  const canGrade = (actor, target) => canManage(actor) &&
    (!LEADER_POSITIONS.includes(target.positionTitle) || actor.isUltimateAdmin || PRESIDIUM_POSITIONS.includes(actor.positionTitle));
  const loadStandard = async month => {
    const doc = await CultureMonthlyStandard.findOne({ month }).lean();
    return { configuration: doc?.configuration || DEFAULT_CULTURE_STANDARD, version: doc?.version || 0 };
  };
  const fail = (res, error, message) => res.status(error.status || 500).json({ success: false, message: error.status ? error.message : message });
  app.get(`${ROUTE}-workbench`, authenticate, async (req, res) => {
    if (!canEnter(req.user)) return res.status(403).json({ success: false, message: '无权访问文体艺术部考核' });
    const month = req.query.month || currentChinaMonth();
    if (!isValidMonth(month)) return res.status(400).json({ success: false, message: '月份格式应为 YYYY-MM' });
    try {
      const manager = canManage(req.user);
      const scoreScope = { ...ASSIGNMENT, ...(manager ? {} : { target: req.user._id }) };
      const [members, scores, standard, months, standardMonths] = await Promise.all([
        User.find({ ...ASSIGNMENT, isActive: true, $or: [{ role: 'admin', memberRole: 'volunteer', positionTitle: 'volunteer' }, { role: 'superadmin', memberRole: 'department_lead', positionTitle: { $in: LEADER_POSITIONS } }], ...(manager ? {} : { _id: req.user._id }) }).select('name studentId role positionTitle memberRole organization department isActive').sort({ studentId: 1 }).lean(),
        CultureMonthlyScore.find({ ...scoreScope, month }).populate('target', 'name studentId positionTitle isActive').sort({ createdAt: 1 }).lean(),
        loadStandard(month), CultureMonthlyScore.distinct('month', scoreScope), CultureMonthlyStandard.distinct('month')
      ]);
      res.json({ success: true, month, months: Array.from(new Set([month, ...months, ...standardMonths])).sort(),
        viewerId: String(req.user._id), access: { canManage: manager, canEditStandards: manager },
        members: members.map(member => ({ ...userBrief(member), canGrade: canGrade(req.user, member), canSelf: String(member._id) === String(req.user._id) })),
        scores: scores.map(serializeCultureScore), standard: standard.configuration, standardVersion: standard.version });
    } catch (error) { fail(res, error, '加载文体考核失败'); }
  });
  app.put(`${ROUTE}-standards`, authenticate, async (req, res) => {
    if (!canManage(req.user)) return res.status(403).json({ success: false, message: '无权修改文体考核标准' });
    try {
      const month = req.body.month;
      if (!isValidMonth(month)) throw badInput('月份格式应为 YYYY-MM');
      const configuration = normalizeCultureStandard(req.body.standard);
      const doc = await CultureMonthlyStandard.findOneAndUpdate({ month }, { $set: { configuration, updatedBy: req.user._id }, $inc: { version: 1 } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: false });
      await logAction(req.user._id, 'update_culture_monthly_standard', 'cultureMonthlyStandard', doc._id, { ...ASSIGNMENT, month, version: doc.version }, req);
      res.json({ success: true, standard: doc.configuration, version: doc.version });
    } catch (error) { fail(res, error, '保存考核标准失败'); }
  });
  app.put(`${ROUTE}-scores`, authenticate, async (req, res) => {
    if (!canEnter(req.user)) return res.status(403).json({ success: false, message: '无权提交文体考核' });
    try {
      const { month, targetId, mode } = req.body;
      if (!isValidMonth(month) || !mongoose.isValidObjectId(targetId) || !['self', 'grade'].includes(mode)) throw badInput('月份、成员或评分类型无效');
      const target = await User.findById(targetId).select('name studentId role positionTitle memberRole organization department isActive').lean();
      if (!isCultureMember(target)) return res.status(403).json({ success: false, message: '只能考核文体艺术部在岗成员' });
      if (mode === 'self' ? String(req.user._id) !== String(target._id) : !canGrade(req.user, target)) return res.status(403).json({ success: false, message: mode === 'self' ? '只能提交本人的自评' : '无权为该成员评分' });
      const standard = await loadStandard(month);
      if (mode === 'grade' && Number(req.body.standardVersion) !== standard.version) return res.status(409).json({ success: false, message: '本月考核标准已更新，请刷新后重新评分' });
      const now = new Date();
      let fields;
      if (mode === 'self') {
        fields = { selfScore: round(numberInRange(req.body.selfScore, 0, 100, '自评分')), workLogs: normalizeWorkLogs(req.body.workLogs, month), selfComment: text(req.body.comment, 2000), selfSubmittedAt: now };
      } else {
        const ratingDate = text(req.body.ratingDate, 10) || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ratingDate) || Number.isNaN(new Date(`${ratingDate}T00:00:00Z`).getTime()) || new Date(`${ratingDate}T00:00:00Z`).toISOString().slice(0, 10) !== ratingDate) throw badInput('评分日期无效');
        fields = { ...calculateCultureGrade(req.body.itemDetails, standard.configuration), leaderComment: text(req.body.comment, 2000), ratedBy: req.user._id, raterName: req.user.name, ratingDate, ratedAt: now, standardSnapshot: standard.configuration, standardVersion: standard.version };
      }
      let cohortId = null;
      if (CohortMembership) {
        const membership = await CohortMembership.findOne({ ...ASSIGNMENT, user: target._id, archivedAt: null }).populate('cohort').sort({ createdAt: -1 }).lean();
        if (membership?.cohort?.status === 'active') cohortId = membership.cohort._id;
      }
      const insertFields = { target: target._id, month, ...ASSIGNMENT, cohort: cohortId,
        targetSnapshot: { name: target.name, studentId: target.studentId, positionTitle: target.positionTitle } };
      if (mode === 'self') { insertFields.standardSnapshot = standard.configuration; insertFields.standardVersion = standard.version; }
      const filter = { target: target._id, month, ...ASSIGNMENT };
      const update = { $set: fields, $setOnInsert: insertFields };
      let score;
      try {
        score = await CultureMonthlyScore.findOneAndUpdate(filter, update, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        score = await CultureMonthlyScore.findOneAndUpdate(filter, { $set: fields }, { new: true, runValidators: true });
      }
      await logAction(req.user._id, mode === 'self' ? 'submit_culture_self_score' : 'submit_culture_grade', 'cultureMonthlyScore', score._id, { ...ASSIGNMENT, month, targetId }, req);
      res.json({ success: true, score: serializeCultureScore(score) });
    } catch (error) { fail(res, error, '保存月度考核失败'); }
  });
};
module.exports = { DEFAULT_CULTURE_STANDARD, CultureMonthlyScore, CultureMonthlyStandard, calculateCultureGrade, normalizeCultureStandard, serializeCultureScore, isValidMonth, installCulturePerformanceRoutes };
