import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from './api';

const KIND_LABELS = {
  self: '自评',
  leader_peer: '负责人互评',
  presidium_leader: '主席团评议负责人',
  volunteer_leader: '志愿者评议负责人',
  volunteer_peer: '志愿者互评',
  leader_volunteer: '负责人评议志愿者'
};
const currentChinaMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date());

const readJson = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || '绩效数据加载失败');
  return data;
};

export default function DepartmentPerformanceParticipation({ module, token, user, compact = false, period = '', onPeriodChange }) {
  const scope = `/hub/departments/${module.organization}/${module.key}`;
  const isCulture = module.key === 'culture_sports_arts';
  const [localSemester, setLocalSemester] = useState('');
  const semester = period || localSemester;
  const changeSemester = onPeriodChange || setLocalSemester;
  const [workbench, setWorkbench] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState('');
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setMessage('');
    setWorkbench(null);
    setEvaluation(null);
    try {
      const query = isCulture
        ? `/culture-performance-workbench?month=${encodeURIComponent(semester || currentChinaMonth())}`
        : `/performance-workbench${semester ? `?semester=${encodeURIComponent(semester)}` : ''}`;
      const source = await readJson(`${scope}${query}`, token);
      const nextWorkbench = isCulture
        ? { ...source, semester: source.month, semesters: source.months, records: [], policy: null }
        : source;
      const nextEvaluation = await readJson(`${scope}/performance-evaluations?semester=${encodeURIComponent(nextWorkbench.semester)}`, token);
      if (currentRequest !== requestId.current) return;
      setWorkbench(nextWorkbench);
      setEvaluation(nextEvaluation);
      if (!semester) changeSemester(nextWorkbench.semester);
    } catch (error) {
      if (currentRequest === requestId.current) setMessage(error.message);
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [scope, semester, token, isCulture, changeSemester]);

  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);

  const targets = evaluation?.targets || [];
  const selectedTarget = targets.find(target => String(target.id) === targetId) || targets[0];
  const kinds = selectedTarget?.allowedKinds || [];
  const selectedKind = kinds.includes(kind) ? kind : kinds[0] || '';
  const myId = String(user?.id || user?._id || '');
  const myRecords = (workbench?.records || []).filter(record => String(record.volunteer?.id || record.volunteer?._id) === myId);
  const myMonthlyScore = (workbench?.scores || []).find(item => String(item.target?.id) === myId);
  const dimensions = workbench?.policy?.dimensions || [];
  const myScore = useMemo(() => dimensions.reduce((sum, dimension) => {
    const raw = myRecords.filter(record => record.dimension === dimension.key).reduce((value, record) => value + Number(record.score || 0), 0);
    return sum + Math.max(0, dimension.scoringMode === 'bonus' || dimension.maxScore == null ? raw : Math.min(raw, Number(dimension.maxScore)));
  }, 0), [dimensions, myRecords]);
  const canManageResults = Boolean(workbench?.access?.canManageRecords || workbench?.access?.canManage);
  const managerRows = canManageResults ? (() => {
    const people = new Map(((isCulture ? workbench?.members : workbench?.volunteers) || []).map(person => [String(person.id || person._id), person]));
    if (!isCulture) (workbench?.assessmentLeaders || []).forEach(person => people.set(String(person.id || person._id), person));
    (evaluation?.summary || []).forEach(item => {
      const id = String(item.target?.id || item.target?._id);
      if (!people.has(id)) people.set(id, item.target);
    });
    return [...people].map(([id, person]) => {
      const result = (evaluation?.summary || []).find(item => String(item.target?.id || item.target?._id) === id);
      const monthly = (workbench?.scores || []).find(item => String(item.target?.id) === id);
      const facts = (workbench?.records || []).filter(item => String(item.volunteer?.id || item.volunteer?._id) === id);
      const factualScore = dimensions.reduce((sum, dimension) => {
        const raw = facts.filter(item => item.dimension === dimension.key).reduce((value, item) => value + Number(item.score || 0), 0);
        return sum + Math.max(0, dimension.scoringMode === 'bonus' || dimension.maxScore == null ? raw : Math.min(raw, Number(dimension.maxScore)));
      }, 0);
      const volunteer = person.memberRole === 'volunteer' || person.positionTitle === 'volunteer';
      return { id, person, result, factualScore, monthly, volunteer, restricted: !volunteer && id !== myId && !user?.isUltimateAdmin && user?.memberRole !== 'presidium' };
    });
  })() : [];

  const submit = async event => {
    event.preventDefault();
    const value = Number(score);
    if (!selectedTarget || !selectedKind || score === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      setMessage('请选择评价对象、类型，并填写 0–100 分。');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await readJson(`${scope}/performance-evaluations`, token, {
        method: 'POST',
        body: JSON.stringify({ targetId: selectedTarget.id, kind: selectedKind, score: value, comment, semester: workbench.semester })
      });
      const nextEvaluation = await readJson(`${scope}/performance-evaluations?semester=${encodeURIComponent(workbench.semester)}`, token);
      setEvaluation(nextEvaluation);
      setScore('');
      setComment('');
      setMessage('评价已保存。评价人身份仅按权限向管理者展示。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return <section className={`siehub-performance-card unified-performance ${compact ? 'is-compact' : ''}`}>
    <div className="siehub-performance-head">
      <div><p>PERFORMANCE / 绩效考核</p><h3>{compact ? '我的绩效与评价' : '志愿者与负责人考核'}</h3><span>{isCulture ? '月度逐项成绩与多源评价分别展示。' : '志愿者日常积分与负责人评价分开记录；当前不将各来源换算为一个总分。'}</span></div>
      <div className="unified-performance-period">
        <label htmlFor={`performance-period-${module.key}`}>考核{isCulture ? '月份' : '学期'}</label>
        <select id={`performance-period-${module.key}`} value={semester} onChange={event => changeSemester(event.target.value)} disabled={loading}>
          {(workbench?.semesters || (semester ? [semester] : [])).map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
    </div>
    {message && <p className="siehub-policy-message" role="status">{message}</p>}
    {loading && !workbench ? <p className="siehub-empty-text">正在加载绩效信息…</p> : <>
      {isCulture && myMonthlyScore && <div className="unified-performance-own">
        <div><span>本月逐项成绩</span><strong>{myMonthlyScore.combinedScore == null ? '—' : Number(myMonthlyScore.combinedScore).toFixed(1)}</strong><small>{myMonthlyScore.status}</small></div>
        <div className="unified-performance-dimensions"><span>管理评分 <b>{myMonthlyScore.leaderScore ?? '—'}</b></span><span>自评 <b>{myMonthlyScore.selfScore ?? '—'}</b></span><span>逐项明细和工作纪实请看下方文体评分表</span></div>
      </div>}
      {!isCulture && user?.memberRole === 'volunteer' && <div className="unified-performance-own">
        <div><span>本学期日常积分</span><strong>{myScore.toFixed(1)}</strong><small>{myRecords.length} 条事实与校准记录</small></div>
        <div className="unified-performance-dimensions">
          {dimensions.map(dimension => {
            const raw = myRecords.filter(record => record.dimension === dimension.key).reduce((value, record) => value + Number(record.score || 0), 0);
            return <span key={dimension.key}>{dimension.label} <b>{Math.max(0, dimension.maxScore == null ? raw : Math.min(raw, Number(dimension.maxScore))).toFixed(1)}</b></span>;
          })}
        </div>
      </div>}
      <div className="siehub-performance-grid">
        <section className="siehub-performance-panel">
          <div className="siehub-performance-panel-head"><span>01</span><div><h4>自评与互评</h4><p>评价对象和类型由当前身份决定，同一对象同类评价再次提交会更新原记录。</p></div></div>
          {targets.length ? <form className="unified-performance-form" onSubmit={submit}>
            <label>评价对象<select value={selectedTarget?.id || ''} onChange={event => { setTargetId(event.target.value); setKind(''); }}>{targets.map(target => <option key={target.id} value={target.id}>{target.name} · {target.positionTitle === 'volunteer' ? '志愿者' : '负责人'}</option>)}</select></label>
            <label>评价类型<select value={selectedKind} onChange={event => setKind(event.target.value)}>{kinds.map(item => <option key={item} value={item}>{KIND_LABELS[item] || item}</option>)}</select></label>
            <label>评分（0–100）<input type="number" min="0" max="100" step="0.5" value={score} onChange={event => setScore(event.target.value)} required /></label>
            <label className="unified-performance-comment">评价意见<textarea rows="3" maxLength="2000" value={comment} onChange={event => setComment(event.target.value)} /></label>
            <button className="siehub-wide-action" type="submit" disabled={saving || loading}>{saving ? '保存中…' : '提交评价'}</button>
          </form> : <p className="siehub-empty-text">当前身份暂无可评价对象。</p>}
        </section>
        <section className="siehub-performance-panel">
          <div className="siehub-performance-panel-head"><span>02</span><div><h4>考核对象与评价结果</h4><p>志愿者和负责人分开标注，按评价来源展示平均分；当前未设定跨来源综合权重。</p></div></div>
          {canManageResults ? (managerRows.length ? <div className="unified-performance-summary">{managerRows.map(row =>
            <article key={row.id}>
              <div className="unified-performance-result-title"><strong>{row.person?.name} <em>{row.volunteer ? '志愿者' : '负责人'}</em></strong><small>{isCulture ? `月度逐项成绩：${row.monthly?.combinedScore == null ? '待完成' : Number(row.monthly.combinedScore).toFixed(1)}` : row.volunteer ? `日常积分：${row.factualScore.toFixed(1)}` : '负责人评价单列'}</small></div>
              <div>{Object.entries(row.result?.byKind || {}).map(([source, value]) => <span key={source}>{KIND_LABELS[source] || source}：{Number(value).toFixed(1)}</span>)}{!row.result && <span>{row.restricted ? '评价结果仅本人及分管主席团可查看' : '暂无多源评价'}</span>}</div>
            </article>
          )}</div> : <p className="siehub-empty-text">本考核周期暂无部门成员。</p>) : (evaluation?.summary || []).length ? <div className="unified-performance-summary">{evaluation.summary.map(item =>
            <article key={item.target?.id || item.target?._id}><strong>{item.target?.name}</strong><div>{Object.entries(item.byKind || {}).map(([source, value]) => <span key={source}>{KIND_LABELS[source] || source}：{Number(value).toFixed(1)}</span>)}</div></article>
          )}</div> : <p className="siehub-empty-text">本考核周期暂无可查看的评价结果。</p>}
        </section>
      </div>
      {(evaluation?.evaluations || []).length > 0 && <details className="unified-performance-records"><summary>查看评价意见与记录</summary>{evaluation.evaluations.map(item => <p key={item.id}><b>{item.target?.name}</b> · {KIND_LABELS[item.kind] || item.kind} · {item.score} 分 · {item.evaluator?.name || '匿名评价人'}{item.comment ? ` · ${item.comment}` : ''}</p>)}</details>}
      {myRecords.length > 0 && <details className="unified-performance-records"><summary>查看我的积分记录</summary>{myRecords.map(record => <p key={record.id || record._id}><b>{record.score >= 0 ? '+' : ''}{record.score}</b> · {dimensions.find(item => item.key === record.dimension)?.label || record.dimension} · {record.reason}</p>)}</details>}
    </>}
  </section>;
}
