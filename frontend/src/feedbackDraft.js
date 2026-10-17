const DATABASE = 'siehub-feedback-drafts-v1';

const openDatabase = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('草稿存储不可用，请保留当前窗口后重试'));
});

export const emptyFeedbackDraft = () => ({ category: '', subCategory: '', title: '', content: '', priority: 'normal', isAnonymous: false, files: [] });

export const feedbackDraftStore = async (accountId, operation, draft) => {
  if (!accountId) throw new Error('请先登录再暂存草稿');
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('drafts', operation === 'get' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('drafts');
    const request = operation === 'get' ? store.get(accountId) : operation === 'delete' ? store.delete(accountId) : store.put(draft, accountId);
    transaction.oncomplete = () => { database.close(); resolve(request.result); };
    transaction.onerror = () => { database.close(); reject(new Error('草稿保存失败，请保留当前窗口后重试')); };
    transaction.onabort = transaction.onerror;
  });
};
