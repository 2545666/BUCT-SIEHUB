const { getMemberDepartments, isMemberOfDepartment } = require('./organization');
const { idOf, isConsistentIdentity } = require('./security-policy');
const { summarizeSemester } = require('./semester-performance');
const { archiveMatchesDepartment } = require('./performance-scope');

function buildPerformanceOverview({ departments, users, memberships, records, evaluations, roster, semester, currentSemester }) {
  return departments.map(department => {
    const matches = row => row.organization === department.organization && row.department === department.department;
    const scopedRecords = records.filter(matches), scopedEvaluations = evaluations.filter(matches);
    const candidates = new Map();
    const add = user => {
      if (['volunteer', 'department_lead'].includes(user.memberRole)) candidates.set(idOf(user), user);
    };
    // Current staff define the live denominator, including volunteers not yet on the activity roster.
    if (semester === currentSemester) users.filter(user => isConsistentIdentity(user) && isMemberOfDepartment(user, department)).forEach(add);
    const frozen = new Map();
    for (const member of memberships) {
      const archive = (member.semesterPerformanceArchives || []).find(row => row.semester === semester && archiveMatchesDepartment(row, member, department));
      const assignments = [...getMemberDepartments(member), ...(member.appointmentHistory || []).flatMap(getMemberDepartments)];
      const hasHistory = member.cohort?.semesters?.includes(semester) && assignments.some(matches);
      const userId = idOf(member.user);
      if (!userId) continue;
      const hasEvaluation = scopedEvaluations.some(row => idOf(row.target) === userId);
      if (!archive && !(semester !== currentSemester && hasHistory) && !hasEvaluation) continue;
      if (!candidates.has(userId)) add({ _id: userId, ...(member.accountSnapshot || {}), memberRole: member.memberRole });
      if (archive) frozen.set(userId, archive);
    }
    // Keep records visible if an account moved or left before a cohort archive was created.
    for (const user of users) if (!candidates.has(idOf(user)) && (scopedRecords.some(row => idOf(row.volunteer) === idOf(user)) || scopedEvaluations.some(row => idOf(row.target) === idOf(user)))) add(user);
    for (const record of scopedRecords) if (record.volunteer && !candidates.has(idOf(record.volunteer))) add({ ...record.volunteer, memberRole: record.memberRole || 'volunteer' });
    const members = [...candidates.values()].map(user => {
      const id = idOf(user), archive = frozen.get(id);
      const ownEvaluations = archive?.evaluations || scopedEvaluations.filter(row => idOf(row.target) === id);
      const activityRecords = archive?.activityRecords || scopedRecords.filter(row => idOf(row.volunteer) === id);
      const result = archive || summarizeSemester(ownEvaluations, user, semester);
      return {
        id, name: user.name || '历史成员', studentId: user.studentId || '', memberRole: user.memberRole,
        inRoster: roster.some(row => matches(row) && idOf(row.volunteer) === id && row.isActive !== false),
        archived: Boolean(archive), result, activityRecords,
        evaluations: ownEvaluations.map(row => ({ kind: row.kind, score: row.score, items: row.items || [], bonusScore: row.bonusScore || 0, bonusReason: row.bonusReason || '', comment: row.comment || '', evaluatorName: row.evaluator?.name || '', updatedAt: row.updatedAt || row.createdAt }))
      };
    });
    const count = predicate => members.filter(predicate).length;
    return { ...department, members, recordCount: scopedRecords.length, counts: {
      total: members.length, volunteers: count(row => row.memberRole === 'volunteer'), leaders: count(row => row.memberRole === 'department_lead'),
      rosterMissing: count(row => row.memberRole === 'volunteer' && !row.inRoster && !row.archived),
      withRecords: count(row => row.activityRecords.length > 0),
      supervisor: count(row => row.result.supervisor != null), self: count(row => row.result.self != null), peer: count(row => row.result.peer != null),
      completed: count(row => row.result.total != null), archived: count(row => row.archived)
    } };
  });
}

module.exports = { buildPerformanceOverview };
