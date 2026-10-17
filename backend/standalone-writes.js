async function withOperationLock(Lock, key, task) {
  const owner = require('crypto').randomUUID();
  const now = new Date();
  try {
    await Lock.findOneAndUpdate({ _id: key, expiresAt: { $lte: now } }, { owner, expiresAt: new Date(now.getTime() + 300000) }, { upsert: true, new: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const conflict = new Error('该操作正在进行，请稍后重试');
    conflict.status = 409;
    throw conflict;
  }
  try { return await task(); }
  finally { await Lock.deleteOne({ _id: key, owner }); }
}

async function compensate(task, rollback) {
  try { return await task(); }
  catch (error) {
    try { await rollback(); }
    catch (rollbackError) {
      error.recoveryRequired = true;
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

module.exports = { withOperationLock, compensate };
