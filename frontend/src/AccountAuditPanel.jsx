import React, { useEffect, useState } from 'react';
import { requestJson } from './api';

const loginReasons = { success: '登录成功', user_not_found: '账号不存在', locked: '账号锁定', locked_after_failures: '连续失败后锁定', password_mismatch: '密码错误' };

export default function AccountAuditPanel({ token }) {
  const [kind, setKind] = useState('login');
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    requestJson(`/ultimate/account-logs?${new URLSearchParams({ kind, search, page, limit: 20 })}`, token)
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, kind, search, page, reload]);
  return <section className="account-audit" aria-label="账号日志管理">
    <h2>账号日志</h2><p>全员登录与操作记录，仅终极管理员可查看。</p>
    <div className="account-audit-tabs">{[['login', '登录记录'], ['operation', '操作记录']].map(([key, label]) => <button key={key} type="button" aria-pressed={kind === key} onClick={() => { setKind(key); setPage(1); }}>{label}</button>)}</div>
    <form className="account-audit-search" onSubmit={event => { event.preventDefault(); setSearch(input.trim()); setPage(1); setReload(value => value + 1); }}>
      <label><span>姓名或学号</span><input value={input} onChange={event => setInput(event.target.value)} placeholder="搜索所有账号" maxLength={100} /></label><button type="submit" disabled={loading}>查询</button><button type="button" disabled={loading} onClick={() => setReload(value => value + 1)}>刷新</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">正在读取记录…</p> : data && <>
      <p>共 {data.pagination.total} 条记录</p>
      <div className="account-audit-list">{data.logs.length ? data.logs.map(log => <article key={log._id}>
        <header><strong>{log.user?.name || '未关联账号'} <small>{log.user?.studentId || log.studentId || ''}</small></strong><time>{new Date(log.createdAt).toLocaleString('zh-CN')}</time></header>
        <p>{kind === 'login' ? `${log.success ? '成功' : '失败'} · ${loginReasons[log.reason] || log.reason || '无说明'}` : `${log.action} · ${log.resource || '系统'}`}</p>
        <details><summary>查看详情</summary><dl><dt>IP 地址</dt><dd>{log.ip || '未记录'}</dd><dt>设备信息</dt><dd>{log.userAgent || '未记录'}</dd>{kind === 'operation' && <><dt>操作内容</dt><dd><pre>{JSON.stringify(log.details || {}, null, 2)}</pre></dd></>}</dl></details>
      </article>) : <p>暂无匹配记录。</p>}</div>
      <nav className="account-audit-pages" aria-label="日志分页"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>{page} / {data.pagination.pages}</span><button type="button" disabled={page >= data.pagination.pages} onClick={() => setPage(value => value + 1)}>下一页</button></nav>
    </>}
  </section>;
}
