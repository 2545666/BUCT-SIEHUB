const idOf = value => String(value?._id || value?.id || value || '');

function isConsistentIdentity(user = {}) {
  const roles = { student: 'student', volunteer: 'admin', department_lead: 'superadmin', presidium: 'superadmin' };
  const titles = { student: ['student'], volunteer: ['volunteer'], department_lead: ['department_head', 'youth_league_cadre'], presidium: ['presidium_member', 'youth_league_deputy_secretary'] };
  return roles[user.memberRole] === user.role && titles[user.memberRole]?.includes(user.positionTitle);
}

function serializeFeedbackForViewer(feedback, viewer) {
  const result = typeof feedback.toObject === 'function' ? feedback.toObject() : { ...feedback, responses: (feedback.responses || []).map(response => ({ ...response })) };
  const owner = idOf(result.user) === idOf(viewer);
  if (result.isAnonymous && !owner && !viewer?.isUltimateAdmin) {
    result.user = { name: '匿名用户', studentId: '匿名' };
    result.responses = (result.responses || []).map(response => response.senderType === 'student'
      ? { ...response, senderName: '匿名用户', adminId: undefined, adminName: undefined }
      : response);
  }
  result.responses = (result.responses || []).map(response => response.isRecalled
    ? { ...response, content: '', attachments: [], senderName: '', adminName: '', adminId: undefined }
    : response);
  return result;
}

function paginationOf(query = {}) {
  const integer = (value, fallback, max) => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Math.min(Number(value), max) : fallback;
  return { page: integer(query.page, 1, 100000), limit: integer(query.limit, 20, 100) };
}

function canResetPassword(actor, target, managed = []) {
  if (!actor || !target || target.isUltimateAdmin) return false;
  if (actor.isUltimateAdmin) return true;
  if (!isConsistentIdentity(actor) || actor.memberRole !== 'presidium') return false;
  if (!['student', 'volunteer', 'department_lead'].includes(target.memberRole)) return false;
  return managed.some(scope => scope.organization === target.organization && scope.department === target.department);
}

function summarizeEvaluations(evaluations, policy, kinds) {
  const summaries = new Map();
  for (const item of evaluations) {
    const key = idOf(item.target);
    if (!summaries.has(key)) summaries.set(key, { target: item.target, byKind: {}, counts: {}, total: null, weight: 0 });
    const summary = summaries.get(key);
    summary.byKind[item.kind] = (summary.byKind[item.kind] || 0) + Number(item.score);
    summary.counts[item.kind] = (summary.counts[item.kind] || 0) + 1;
  }
  for (const summary of summaries.values()) {
    let total = 0;
    for (const kind of Object.keys(summary.byKind)) {
      summary.byKind[kind] /= summary.counts[kind];
      const alias = kind === 'leader_volunteer' || kind === 'presidium_leader' ? 'leader' : kind;
      const source = !policy.evaluationSources?.length || policy.evaluationSources.includes(kind) || policy.evaluationSources.includes(alias);
      const weight = !source ? 0 : Number(policy.evaluationWeights?.[kind] ?? policy.evaluationWeights?.[alias] ?? kinds[kind]?.weight ?? 0);
      if (weight > 0) { total += summary.byKind[kind] * weight; summary.weight += weight; }
    }
    summary.total = summary.weight ? Math.round(total / summary.weight * 10) / 10 : null;
  }
  return [...summaries.values()];
}

function calculatePerformance(records, policy) {
  const rawByDimension = {};
  records.forEach(record => { rawByDimension[record.dimension] = (rawByDimension[record.dimension] || 0) + Number(record.score || 0); });
  const byDimension = {};
  for (const dimension of policy.dimensions || []) {
    const raw = rawByDimension[dimension.key] || 0;
    byDimension[dimension.key] = dimension.scoringMode === 'capped_additive' && Number.isFinite(dimension.maxScore)
      ? Math.max(0, Math.min(raw, dimension.maxScore)) : Math.max(0, raw);
  }
  return { total: Object.values(byDimension).reduce((sum, score) => sum + score, 0), byDimension, rawByDimension };
}

function safeUploadType(filename, mime) {
  const extension = require('path').extname(filename || '').toLowerCase();
  const types = { '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'], '.webp': ['image/webp'], '.pdf': ['application/pdf'], '.txt': ['text/plain'], '.doc': ['application/msword'], '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], '.xls': ['application/vnd.ms-excel'], '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], '.ppt': ['application/vnd.ms-powerpoint'], '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], '.zip': ['application/zip', 'application/x-zip-compressed'] };
  return types[extension]?.includes(mime) || false;
}

function matchesFileSignature(buffer, filename) {
  const extension = require('path').extname(filename || '').toLowerCase();
  if (['.jpg', '.jpeg'].includes(extension)) return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (extension === '.png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (extension === '.webp') return buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP';
  if (extension === '.pdf') return buffer.subarray(0,5).toString() === '%PDF-';
  if (['.zip','.docx','.xlsx','.pptx'].includes(extension)) return buffer[0] === 80 && buffer[1] === 75 && buffer[2] === 3 && buffer[3] === 4;
  if (['.doc','.xls','.ppt'].includes(extension)) return buffer.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
  if (extension === '.txt') return !buffer.includes(0);
  return false;
}

module.exports = { idOf, isConsistentIdentity, serializeFeedbackForViewer, paginationOf, canResetPassword, summarizeEvaluations, calculatePerformance, safeUploadType, matchesFileSignature };
