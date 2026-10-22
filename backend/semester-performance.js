const round = value => Math.round(value * 10) / 10;

const PEER_ITEMS = {
  volunteer: [
    { key: 'cooperation', label: '合作配合', max: 30 },
    { key: 'responsibility', label: '任务责任', max: 30 },
    { key: 'communication', label: '沟通反馈', max: 20 },
    { key: 'reliability', label: '守时与履约', max: 20 }
  ],
  leader: [
    { key: 'guidance', label: '任务安排与指导', max: 30 },
    { key: 'delivery', label: '推进与解决问题', max: 30 },
    { key: 'fairness', label: '公平尊重', max: 20 },
    { key: 'coordination', label: '跨部门协作', max: 20 }
  ]
};
const LEADER_MAIN_ITEMS = [
  { key: 'planning', label: '部门计划与任务落实', max: 30 },
  { key: 'coordination', label: '团队组织与跨部门协作', max: 30 },
  { key: 'guidance', label: '成员指导与培养', max: 20 },
  { key: 'accountability', label: '问题响应与责任履行', max: 20 }
];

const targetRole = target => target.memberRole === 'department_lead' ? 'leader' : 'volunteer';
const supervisorKind = target => targetRole(target) === 'leader' ? 'presidium_leader' : 'leader_volunteer';
const peerKinds = target => targetRole(target) === 'leader' ? ['leader_peer', 'volunteer_leader'] : ['volunteer_peer'];
const bonusItemFor = (target, policy) => targetRole(target) === 'volunteer' ? (policy.dimensions || []).find(item => item.scoringMode === 'bonus') || null : null;

function rubricFor(kind, target, policy) {
  if (kind === 'self' || kind === supervisorKind(target)) {
    if (targetRole(target) === 'leader') return LEADER_MAIN_ITEMS;
    return (policy.dimensions || []).filter(item => item.scoringMode !== 'bonus').map(item => ({
      key: item.key, label: item.label, max: Number(item.maxScore || 0), description: item.rule || ''
    }));
  }
  return peerKinds(target).includes(kind) ? PEER_ITEMS[targetRole(target)] : [];
}

function normalizeItems(input, rubric) {
  if (!Array.isArray(input) || input.length !== rubric.length || !rubric.length) return null;
  if (input.some(item => item.score === '' || item.score === null || item.score === undefined)) return null;
  const values = new Map(input.map(item => [String(item.key), Number(item.score)]));
  if (values.size !== rubric.length) return null;
  const items = rubric.map(item => ({ ...item, score: values.get(item.key) }));
  if (items.some(item => !Number.isFinite(item.score) || item.score < 0 || item.score > item.max)) return null;
  return items;
}

function scoreOf(items) {
  const max = items.reduce((sum, item) => sum + item.max, 0);
  return max ? round(items.reduce((sum, item) => sum + item.score, 0) / max * 100) : null;
}

function summarizeSemester(evaluations, target, semester) {
  const byKind = {};
  for (const kind of ['self', supervisorKind(target), ...peerKinds(target)]) {
    const values = evaluations.filter(item => item.kind === kind).map(item => Number(item.score));
    if (values.length) byKind[kind] = round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  const supervisor = byKind[supervisorKind(target)] ?? null;
  const supervisorRows = evaluations.filter(item => item.kind === supervisorKind(target));
  const bonus = supervisorRows.length ? round(supervisorRows.reduce((sum, item) => sum + Number(item.bonusScore || 0), 0) / supervisorRows.length) : 0;
  const self = byKind.self ?? null;
  const peerSources = peerKinds(target).map(kind => byKind[kind]).filter(value => value != null);
  const peer = peerSources.length ? round(peerSources.reduce((sum, value) => sum + value, 0) / peerSources.length) : null;
  const total = supervisor == null || self == null || peer == null ? null : round(supervisor * 0.7 + self * 0.1 + peer * 0.2 + bonus);
  const detailedRows = supervisorRows.filter(item => Array.isArray(item.items) && item.items.length);
  const dimensions = detailedRows[0]?.items?.map(item => ({
    name: item.label, max: item.max,
    score: round(detailedRows.reduce((sum, row) => sum + Number(row.items.find(other => other.key === item.key)?.score || 0), 0) / detailedRows.length)
  })) || [];
  return { semester, total, supervisor, self, peer, bonus, byKind, dimensions, status: total == null ? '待完成' : '已完成' };
}

module.exports = { rubricFor, normalizeItems, scoreOf, summarizeSemester, supervisorKind, peerKinds, bonusItemFor };
