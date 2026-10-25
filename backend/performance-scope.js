const archiveMatchesDepartment = (entry, member, assignment) =>
  (entry.organization || member.organization) === assignment.organization &&
  (entry.department || member.department) === assignment.department;

const archivedPerformanceQuery = (assignment, semester) => ({ $or: [
  { semesterPerformanceArchives: { $elemMatch: { semester, organization: assignment.organization, department: assignment.department } } },
  { organization: assignment.organization, department: assignment.department, semesterPerformanceArchives: { $elemMatch: { semester, organization: { $exists: false }, department: { $exists: false } } } }
] });

const evaluationKey = ({ target, evaluator, semester, kind, organization, department }) => ({ target, evaluator, semester, kind, organization, department });

// Install the stronger constraint before removing the old cross-department constraint.
async function ensureDepartmentEvaluationIndex(model) {
  await model.init();
  await model.collection.createIndex({ target: 1, evaluator: 1, semester: 1, kind: 1, organization: 1, department: 1 }, { unique: true });
  const indexes = await model.collection.indexes();
  const old = indexes.find(index => index.unique && Object.keys(index.key).length === 4 && ['target', 'evaluator', 'semester', 'kind'].every(key => index.key[key] === 1));
  if (old) await model.collection.dropIndex(old.name);
}

module.exports = { archiveMatchesDepartment, archivedPerformanceQuery, evaluationKey, ensureDepartmentEvaluationIndex };
