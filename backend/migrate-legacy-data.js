const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const LEGACY_ASSIGNMENT = { organization: 'student_union', department: 'student_rights' };

const roleFromSavedIdentity = user => {
  if (user.isUltimateAdmin) return user.role;
  const identities = { student: ['student', ['student']], volunteer: ['admin', ['volunteer']],
    department_lead: ['superadmin', ['department_head', 'youth_league_cadre']],
    presidium: ['superadmin', ['presidium_member', 'youth_league_deputy_secretary']] };
  const identity = identities[user.memberRole];
  return identity?.[1].includes(user.positionTitle) ? identity[0] : user.role;
};

const buildLegacyRoster = (records, users) => {
  const byId = new Map(users.map(user => [String(user._id), user]));
  const seen = new Set();
  return records.flatMap(record => {
    const key = `${record.volunteer}:${record.semester}`;
    const user = byId.get(String(record.volunteer));
    if (seen.has(key) || !user || !record.semester) return [];
    seen.add(key);
    return [{ volunteer: record.volunteer, originalUserId: record.volunteer, semester: record.semester,
      ...LEGACY_ASSIGNMENT, name: user.name, studentId: user.studentId,
      addedBy: record.recordedBy, createdAt: record.createdAt || record.date || new Date(),
      updatedAt: new Date() }];
  });
};

const factHash = records => crypto.createHash('sha256').update(JSON.stringify(records.map(record => {
  const copy = { ...record };
  delete copy.organization;
  delete copy.department;
  return copy;
}))).digest('hex');

async function migrate({ apply = false, backupDir } = {}) {
  require('dotenv').config();
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/buct_feedback');
  try {
    const db = mongoose.connection.db;
    const recordsCollection = db.collection('performancerecords');
    const planFile = backupDir ? path.join(backupDir, 'migration-plan.json') : null;
    const savedPlan = planFile && fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, 'utf8')) : null;
    const records = await recordsCollection.find(savedPlan
      ? { _id: { $in: savedPlan.recordIds.map(id => new mongoose.Types.ObjectId(id)) } }
      : { $or: [{ department: null }, { department: '' }] }).sort({ _id: 1 }).toArray();
    const users = await db.collection('users').find({}).toArray();
    const roster = buildLegacyRoster(records, users);
    const missingIdentity = users.filter(user => user.role === 'student' && !user.memberRole && !user.positionTitle && !user.organization && !user.department);
    const memberships = await db.collection('cohortmemberships').find({ endedAt: null, archivedAt: null }).toArray();
    const identityCorrections = users.filter(user => roleFromSavedIdentity(user) !== user.role);
    const byId = new Map(users.map(user => [String(user._id), { ...user, role: roleFromSavedIdentity(user) }]));
    const membershipChanges = memberships.filter(member => byId.has(String(member.user)) && member.systemRole !== byId.get(String(member.user)).role);
    const feedbacks = await db.collection('feedbacks').find({ 'responses.adminId': { $exists: true } }).toArray();
    const repliesToFix = feedbacks.reduce((sum, feedback) => sum + (feedback.responses || []).filter(reply => reply.adminId && !['admin', 'superadmin', 'student'].includes(reply.senderType)).length, 0);
    const summary = { mode: apply ? 'apply' : 'preview', legacyPerformance: records.length,
      historicalRoster: roster.length, missingStudentIdentity: missingIdentity.length,
      contradictoryUserRoles: identityCorrections.length,
      currentMembershipRoleMismatch: membershipChanges.length, legacyAdminReplies: repliesToFix };
    console.log(JSON.stringify(summary));
    if (!apply) return summary;
    if (records.length !== 0 && records.length !== 180) throw new Error('旧流水数量与已确认的180条不同，已停止迁移');
    if (!backupDir || !fs.existsSync(path.join(backupDir, 'database.archive.gz'))) throw new Error('执行前必须提供完整数据库备份');
    const beforeHash = savedPlan?.factsSha256 || factHash(records);
    if (!savedPlan) fs.writeFileSync(planFile, JSON.stringify({ recordIds: records.map(record => record._id), factsSha256: beforeHash }), { mode: 0o600 });
    if (records.length) {
      await recordsCollection.updateMany({ _id: { $in: records.map(record => record._id) }, $or: [{ department: null }, { department: '' }] }, { $set: LEGACY_ASSIGNMENT });
      const migrated = await recordsCollection.find({ _id: { $in: records.map(record => record._id) } }).sort({ _id: 1 }).toArray();
      if (migrated.some(record => record.department !== 'student_rights' || record.organization !== 'student_union') || factHash(migrated) !== beforeHash) {
        throw new Error('流水归属或原始事实校验未通过');
      }
      for (const member of roster) {
        await db.collection('semestermembers').updateOne({ volunteer: member.volunteer, semester: member.semester,
          $or: [{ department: null }, { department: '' }] },
          { $set: { ...LEGACY_ASSIGNMENT, originalUserId: member.volunteer } });
      }
      if (roster.length) await db.collection('semestermembers').bulkWrite(roster.map(member => ({ updateOne: {
        filter: { volunteer: member.volunteer, semester: member.semester, ...LEGACY_ASSIGNMENT },
        update: { $setOnInsert: member }, upsert: true
      } })), { ordered: true });
    }
    for (const user of missingIdentity) {
      await db.collection('users').updateOne({ _id: user._id, role: 'student', memberRole: null, positionTitle: null },
        { $set: { memberRole: 'student', positionTitle: 'student', organization: null, department: null, managedDepartments: [] } });
    }
    for (const user of identityCorrections) {
      await db.collection('users').updateOne({ _id: user._id, role: user.role, memberRole: user.memberRole, positionTitle: user.positionTitle },
        { $set: { role: roleFromSavedIdentity(user) }, $inc: { tokenVersion: 1 } });
    }
    for (const member of membershipChanges) {
      await db.collection('cohortmemberships').updateOne({ _id: member._id, systemRole: member.systemRole, endedAt: null, archivedAt: null },
        { $set: { systemRole: byId.get(String(member.user)).role } });
    }
    // Update only the missing discriminator; existing messages and response identities remain intact.
    await db.collection('feedbacks').updateMany({ 'responses.adminId': { $exists: true } },
      { $set: { 'responses.$[reply].senderType': 'admin' } },
      { arrayFilters: [{ 'reply.adminId': { $exists: true, $ne: null }, 'reply.senderType': { $nin: ['student', 'admin', 'superadmin'] } }] });
    const indexes = await db.collection('semestermembers').indexes();
    await db.collection('semestermembers').createIndex({ volunteer: 1, semester: 1, organization: 1, department: 1 }, { unique: true });
    for (const index of indexes) {
      if (index.unique && Object.keys(index.key).length === 2 && index.key.volunteer === 1 && index.key.semester === 1) {
        await db.collection('semestermembers').dropIndex(index.name);
      }
    }
    const result = { ...summary, originalFactsPreserved: true, factsSha256: beforeHash };
    fs.writeFileSync(path.join(backupDir, 'migration-result.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  migrate({ apply: process.argv.includes('--apply'), backupDir: process.argv[process.argv.indexOf('--backup-dir') + 1] })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { buildLegacyRoster, factHash, roleFromSavedIdentity };
