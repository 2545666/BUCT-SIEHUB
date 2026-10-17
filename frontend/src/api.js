const configuredApiBase = import.meta.env?.VITE_API_BASE || '/api';

export const API_BASE = configuredApiBase.replace(/\/$/, '');

export const AUTH_TOKEN_KEY = 'siehub_auth_token_v2';
const AUTH_EVENT_KEY = 'siehub_auth_change_v2';
const AUTH_CHANNEL = 'siehub-session-v2';

export const readStoredToken = () => {
  localStorage.removeItem('token');
  return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
};

const publishSessionChange = (change) => {
  window.dispatchEvent(new CustomEvent('siehub-session-change', { detail: change }));
  localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ kind: change.kind, remember: change.remember, nonce: crypto.randomUUID() }));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(AUTH_CHANNEL);
    channel.postMessage(change);
    channel.close();
  }
};

export const persistSessionToken = (token, remember = false) => {
  localStorage.removeItem('token');
  if (remember) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  publishSessionChange({ kind: 'login', token, remember });
};

export const clearSessionToken = () => {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('token');
  publishSessionChange({ kind: 'logout' });
};

export const subscribeSessionChanges = (onChange) => {
  const applyChange = (change) => {
    if (change.kind === 'logout') {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      onChange(null);
    } else if (change.token) {
      if (change.remember) sessionStorage.removeItem(AUTH_TOKEN_KEY);
      else sessionStorage.setItem(AUTH_TOKEN_KEY, change.token);
      onChange(change.token);
    }
  };
  const localListener = (event) => applyChange(event.detail);
  const storageListener = (event) => {
    if (event.key !== AUTH_EVENT_KEY || !event.newValue) return;
    let change;
    try { change = JSON.parse(event.newValue); } catch { return; }
    if (change.kind === 'logout') applyChange(change);
    else if (change.remember) applyChange({ ...change, token: localStorage.getItem(AUTH_TOKEN_KEY) });
    else if (typeof BroadcastChannel === 'undefined') applyChange({ kind: 'logout' });
  };
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTH_CHANNEL) : null;
  if (channel) channel.onmessage = (event) => applyChange(event.data);
  window.addEventListener('siehub-session-change', localListener);
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener('siehub-session-change', localListener);
    window.removeEventListener('storage', storageListener);
    channel?.close();
  };
};

export const requestJson = async (path, token, options = {}) => {
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] ||= 'application/json';
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.success === false || !data) {
    if (res.status === 401 && token && readStoredToken() === token) clearSessionToken();
    const error = new Error(data?.message || (res.status === 401 ? '登录已失效，请重新登录' : '请求失败，请稍后重试'));
    error.status = res.status;
    throw error;
  }
  return data;
};

export const resolveApiAssetUrl = (path, apiBase = API_BASE) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return '';
  const suffix = path.replace(/^\/api(?=\/)/, '').replace(/^\//, '');
  return `${apiBase}/${suffix}`;
};

export const resolveMediaUrl = (path = '') => {
  if (/^\/(?:api|uploads)(?:\/|$)/.test(path)) return resolveApiAssetUrl(path);
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path) && !/^https?:\/\//i.test(path)) return '';
  return path;
};

export const uploadFeedbackFiles = async (files, token) => {
  if (!files?.length) return [];
  if (files.length > 10 || files.some(file => file.size > 20 * 1024 * 1024)) throw new Error('最多上传10个文件，单个文件不超过20MB');
  const body = new FormData();
  files.forEach(file => body.append('files', file));
  const data = await requestJson('/upload', token, { method: 'POST', body });
  if (data.success !== true || !Array.isArray(data.files) || data.files.length !== files.length) throw new Error('附件未全部上传成功，已保留所选文件，请重试');
  return data.files;
};
