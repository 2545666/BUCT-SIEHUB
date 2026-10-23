import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from './api';
import PerformanceDimensionRadar from './PerformanceDimensionRadar';

const LABELS = { self: '本人自评', leader_peer: '负责人互评', presidium_leader: '主席团评分', volunteer_leader: '志愿者评议负责人', volunteer_peer: '志愿者互评', leader_volunteer: '负责人评分' };
const request = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || '学期绩效加载失败');
  return data;
};

function EvaluationForm({ target, kind, previous, semester, busy, onSubmit }) {
  const rubric = target.rubrics?.[kind] || [];
  const activity = kind === 'leader_volunteer' && Object.keys(target.activity?.rawByDimension || {}).length ? target.activity : null;
  const [scores, setScores] = useState(() => Object.fromEntries((previous?.items || (activity ? rubric.map(item => ({ key: item.key, score: activity.byDimension?.[item.key] || 0 })) : [])).map(item => [item.key, item.score])));
  const [comment, setComment] = useState(previous?.comment || '');
  const [bonusScore, setBonusScore] = useState(previous?.bonusScore ?? activity?.byDimension?.[target.bonusItem?.key] ?? 0);
  const [bonusReason, setBonusReason] = useState(previous?.bonusReason || '');
  const filled = rubric.length > 0 && rubric.every(item => scores[item.key] !== undefined && scores[item.key] !== '');
  const total = filled ? Math.round(rubric.reduce((sum, item) => sum + Number(scores[item.key]), 0) / rubric.reduce((sum, item) => sum + item.max, 0) * 1000) / 10 : null;
  return <form className="unified-performance-form" onSubmit={event => {
    event.preventDefault();
    onSubmit({ targetId: target.id, kind, semester, items: rubric.map(item => ({ key: item.key, score: Number(scores[item.key]) })), bonusScore, bonusReason, comment });
  }}>
    <p>逐项填写本学期实际表现，系统自动换算为百分制。{activity ? '活动绩效记录已预填到相应维度，负责人核对后可调整。' : '只评价实际了解的工作。'}</p>
    {rubric.map(item => <label key={item.key}>{item.label} · 满分 {item.max}<input type="number" min="0" max={item.max} step="0.5" required value={scores[item.key] ?? ''} onChange={event => setScores({ ...scores, [item.key]: event.target.value })} />{item.description && <small>{item.description}</small>}</label>)}
    {kind === 'leader_volunteer' && target.bonusItem && <><label>{target.bonusItem.label} · 额外加分<input type="number" min="0" max={target.bonusItem.maxScore ?? undefined} step="0.5" value={bonusScore} onChange={event => setBonusScore(event.target.value)} /></label><label>加分依据<input maxLength="500" required={Number(bonusScore) > 0} value={bonusReason} onChange={event => setBonusReason(event.target.value)} /></label><small>额外加分由负责人认定，在 70／10／20 合成后计入学期总分。</small></>}
    <label className="unified-performance-comment">评价依据与意见<textarea rows="3" maxLength="2000" value={comment} onChange={event => setComment(event.target.value)} /></label>
    <div>分项合计：<strong>{total == null ? '待填写' : `${total.toFixed(1)} 分`}</strong></div>
    <button className="siehub-wide-action" type="submit" disabled={busy || !filled}>{busy ? '保存中…' : previous ? '更新本学期评价' : '提交本学期评价'}</button>
  </form>;
}

export default function DepartmentPerformanceParticipation({ module, token, user, compact = false, period = '', onPeriodChange }) {
  const scope = `/hub/departments/${module.organization}/${module.key}`;
  const [localSemester, setLocalSemester] = useState('');
  const semester = period || localSemester;
  const changeSemester = onPeriodChange || setLocalSemester;
  const [data, setData] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [kind, setKind] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const current = ++requestId.current;
    setLoading(true);
    try {
      const next = await request(`${scope}/performance-evaluations${semester ? `?semester=${encodeURIComponent(semester)}` : ''}`, token);
      if (current !== requestId.current) return;
      setData(next);
      if (!semester) changeSemester(next.semester);
    } catch (error) { if (current === requestId.current) setMessage(error.message); }
    finally { if (current === requestId.current) setLoading(false); }
  }, [scope, semester, token, changeSemester]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);

  const targets = data?.targets || [];
  const selectedTarget = targets.find(item => String(item.id) === targetId) || targets[0];
  const selectedKind = selectedTarget?.allowedKinds?.includes(kind) ? kind : selectedTarget?.allowedKinds?.[0] || '';
  const myId = String(user?.id || user?._id || '');
  const own = (data?.summary || []).find(item => String(item.target?.id || item.target?._id) === myId);
  const manager = user?.isUltimateAdmin || ['department_lead', 'presidium'].includes(user?.memberRole);
  const visible = manager ? data?.summary || [] : own ? [own] : [];
  const volunteers = visible.filter(item => item.target?.memberRole === 'volunteer');
  const leaders = visible.filter(item => item.target?.memberRole === 'department_lead');
  const ranking = volunteers.filter(item => item.total != null).sort((a, b) => b.total - a.total);
  const previous = (data?.evaluations || []).find(item => String(item.target?.id || item.target?._id) === String(selectedTarget?.id) && item.kind === selectedKind && String(item.evaluator?.id || item.evaluator?._id) === myId);

  const submit = async body => {
    setSaving(true); setMessage('');
    try {
      await request(`${scope}/performance-evaluations`, token, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      setMessage('学期评价已保存。');
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };

  return <section className={`siehub-performance-card unified-performance ${compact ? 'is-compact' : ''}`}>
    <div className="siehub-performance-head"><div><p>PERFORMANCE / 学期绩效</p><h3>{compact ? '我的学期绩效' : '学期成绩与评价'}</h3><span>上级逐项评分 70% · 本人自评 10% · 同伴互评 20%。三部分齐全后生成学期总分。</span></div>
      <div className="unified-performance-period"><label htmlFor={`performance-period-${module.key}`}>考核学期</label><select id={`performance-period-${module.key}`} value={semester} disabled={loading} onChange={event => changeSemester(event.target.value)}>{(data?.semesters || (semester ? [semester] : [])).map(item => <option key={item} value={item}>{item}</option>)}</select></div></div>
    {message && <p className="siehub-policy-message" role="status">{message}</p>}
    {loading && !data ? <p className="siehub-empty-text">正在加载学期绩效…</p> : <>
      {own && <div className="unified-performance-own"><div><span>本学期总分</span><strong>{own.total == null ? '待完成' : own.total.toFixed(1)}</strong><small>{own.status}</small></div><div className="unified-performance-dimensions"><span>上级评分 <b>{own.supervisor ?? '—'}</b></span><span>自评 <b>{own.self ?? '—'}</b></span><span>互评 <b>{own.peer ?? '—'}</b></span>{own.bonus > 0 && <span>额外加分 <b>+{own.bonus}</b></span>}</div></div>}
      {own?.dimensions?.length > 0 && <PerformanceDimensionRadar dimensions={own.dimensions} label="本人学期绩效" />}
      <div className="siehub-performance-grid">
        <section className="siehub-performance-panel"><div className="siehub-performance-panel-head"><span>01</span><div><h4>学期末逐项评价</h4><p>志愿者由负责人评分；负责人由主席团评分。自评与互评在学期末填写，归档前可修改。</p></div></div>
          {semester === data?.currentSemester && data?.reviewOpen && targets.length ? <>
            <div className="unified-performance-selectors">
              <label>评价对象<select value={selectedTarget?.id || ''} onChange={event => { setTargetId(event.target.value); setKind(''); }}>{targets.map(item => <option key={item.id} value={item.id}>{item.name} · {item.memberRole === 'volunteer' ? '志愿者' : '负责人'}</option>)}</select></label>
              <label>评价类型<select value={selectedKind} onChange={event => setKind(event.target.value)}>{(selectedTarget?.allowedKinds || []).map(value => <option key={value} value={value}>{LABELS[value] || value}</option>)}</select></label>
            </div>
            {selectedTarget && selectedKind && <EvaluationForm key={`${semester}-${selectedTarget.id}-${selectedKind}-${previous?.id || ''}`} target={selectedTarget} kind={selectedKind} previous={previous} semester={semester} busy={saving} onSubmit={submit} />}
          </> : <p className="siehub-empty-text">{semester !== data?.currentSemester ? '历史学期只读，成绩随届次归档保存。' : !data?.reviewOpen ? '学期末评价尚未开放，开放后可逐项填写。' : '当前身份暂无可评价对象。'}</p>}
        </section>
        <section className="siehub-performance-panel"><div className="siehub-performance-panel-head"><span>02</span><div><h4>学期成绩</h4><p>缺少上级评分、自评或互评时显示待完成，不临时重分配权重。</p></div></div>
          {manager && <div className="unified-performance-ranking"><h5>志愿者排名 · 已完成学期总分</h5>{ranking.length ? <ol>{ranking.map((item, index) => <li key={item.target.id}><span>{index + 1}. {item.target.name}</span><b>{item.total.toFixed(1)} 分</b></li>)}</ol> : <p>暂无已完成成绩。</p>}</div>}
          {visible.length ? <div className="unified-performance-summary">{[...volunteers, ...leaders].map(item => <article key={item.target.id}><strong>{item.target.name} <em>{item.target.memberRole === 'volunteer' ? '志愿者' : '负责人'}</em></strong><div><span>学期总分：{item.total == null ? '待完成' : item.total.toFixed(1)}</span><span>上级 {item.supervisor ?? '—'} · 自评 {item.self ?? '—'} · 互评 {item.peer ?? '—'}{item.bonus > 0 ? ` · 额外 +${item.bonus}` : ''}</span></div>{item.dimensions?.length > 0 && <details><summary>查看主项雷达图</summary><PerformanceDimensionRadar dimensions={item.dimensions} label={`${item.target.name}学期绩效`} /></details>}</article>)}</div> : <p className="siehub-empty-text">本学期暂无可查看的成绩。</p>}
        </section>
      </div>
    </>}
  </section>;
}
