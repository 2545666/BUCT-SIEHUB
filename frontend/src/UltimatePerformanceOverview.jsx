import React, { useCallback, useEffect, useRef, useState } from 'react';
import { requestJson } from './api';
import PerformanceDimensionRadar from './PerformanceDimensionRadar';
import './UltimatePerformanceOverview.css';

const kinds = { self: '自评', leader_volunteer: '上级评议志愿者', presidium_leader: '主席团评议负责人', volunteer_peer: '志愿者互评', volunteer_leader: '志愿者评议负责人', leader_peer: '负责人互评' };
const score = value => value == null ? '待完成' : Number(value).toFixed(1);

export default function UltimatePerformanceOverview({ token, onOpenDepartment, onOpenOrganization }) {
  const [semester, setSemester] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState('');
  const [role, setRole] = useState('all');
  const [onlyPending, setOnlyPending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await requestJson(`/ultimate/performance-overview${semester ? `?semester=${encodeURIComponent(semester)}` : ''}`, token);
      if (id !== requestId.current) return;
      setData(next); setError('');
    } catch (failure) { if (id === requestId.current) setError(failure.message || '刷新失败，请重试。'); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [semester, token]);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { requestId.current++; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);
  const changeWindow = async () => {
    const open = !data.reviewOpen;
    if (!window.confirm(open ? `开启「${data.currentSemester}」九个部门的期末评价？` : '关闭本学期期末评价？关闭后成员不能继续提交。')) return;
    setSaving(true); setError('');
    try {
      await requestJson('/ultimate/performance-review-window', token, { method: 'PUT', body: JSON.stringify({ semester: data.currentSemester, open }) });
      await refresh();
    } catch (failure) { setError(failure.message || '调整失败，请重试。'); }
    finally { setSaving(false); }
  };
  const departments = data?.departments || [];
  const department = departments.find(item => item.department === selected);
  const sum = key => departments.reduce((total, item) => total + item.counts[key], 0);
  const members = (department?.members || []).filter(item => (role === 'all' || item.memberRole === role) && (!onlyPending || item.result.total == null));
  return <section className="performance-overview" aria-label="全部门绩效总览">
    <div className="performance-overview-toolbar">
      <label htmlFor="overview-semester">考核学期<select id="overview-semester" aria-label="考核学期" value={semester || data?.semester || ''} disabled={saving} onChange={event => { setSemester(event.target.value); setData(null); setSelected(''); }}>{(data?.semesters || (semester ? [semester] : [])).map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" disabled={loading || saving} onClick={refresh}>{loading ? '刷新中…' : '立即刷新'}</button>
      <button type="button" onClick={onOpenOrganization}>组织与归档</button>
    </div>
    {error && <p className="performance-overview-error" role="alert">{error} {data ? '以下保留上次成功读取的数据。' : ''}</p>}
    {!data ? <p role="status">{loading ? '正在读取九个部门的绩效情况…' : '暂无可用数据，请点击立即刷新。'}</p> : <>
      <div className="performance-overview-review">
        <div><strong>{data.semester !== data.currentSemester ? '历史学期 · 只读' : data.reviewOpen ? '期末评价已开放' : '期末评价未开放'}</strong></div>
        <button type="button" className="performance-overview-primary" disabled={saving || loading || data.semester !== data.currentSemester} onClick={changeWindow}>{saving ? '正在保存…' : data.reviewOpen ? '关闭期末评价' : '开启期末评价'}</button>
      </div>
      <div className="performance-overview-status"><dl><div><dt>成绩完成（人次）</dt><dd>{sum('completed')} <small>/ {sum('total')}</small></dd></div><div><dt>已归档</dt><dd>{sum('archived')}</dd></div><div><dt>未入日常名单</dt><dd>{sum('rosterMissing')}</dd></div></dl><small>更新于 {new Date(data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}</small></div>
      <div className="performance-overview-departments" aria-label="各部门评价进度">
        {departments.map(item => <button type="button" className="performance-overview-department" key={item.department} aria-pressed={selected === item.department} onClick={() => setSelected(item.department)}>
          <span><strong>{item.departmentLabel}</strong><small>{item.organizationLabel} · 志愿者 {item.counts.volunteers} / 负责人 {item.counts.leaders}</small></span>
          <span className="performance-overview-progress"><span>学期成绩 {item.counts.completed} / {item.counts.total}</span><progress max={Math.max(1, item.counts.total)} value={item.counts.completed} aria-label={`${item.departmentLabel}学期成绩完成进度`} /></span>
          <span className="performance-overview-counts">日常 {item.recordCount} 条 · {item.counts.withRecords} 人有记录<br />已评人数：上级 {item.counts.supervisor} · 自评 {item.counts.self} · 同伴 {item.counts.peer}<br />已归档 {item.counts.archived} 人</span>
        </button>)}
      </div>
      {department ? <section className="performance-overview-detail" key={department.department}>
        <div className="performance-overview-detail-head"><h2>{department.departmentLabel}绩效明细</h2><button type="button" onClick={() => onOpenDepartment(department.department)}>进入部门绩效</button></div>
        <details className="performance-overview-policy"><summary>本部门志愿者评分维度与细则</summary>{department.policy.dimensions.map(item => <p key={item.key}><strong>{item.label} · {item.maxScore == null ? '按实际加分' : `满分 ${item.maxScore}`}</strong><br />{item.rule}</p>)}</details>
        <div className="performance-overview-toolbar"><label>成员身份<select value={role} onChange={event => setRole(event.target.value)}><option value="all">全部成员</option><option value="volunteer">志愿者</option><option value="department_lead">负责人</option></select></label><label className="performance-overview-checkbox"><input type="checkbox" checked={onlyPending} onChange={event => setOnlyPending(event.target.checked)} />仅看成绩待完成</label></div>
        <p>上级评分 70% · 自评 10% · 同伴评价 20%</p>
        {!members.length && <p>当前条件下暂无成员。</p>}
        {members.map(member => <details className="performance-overview-member" key={member.id}>
          <summary><span><strong>{member.name}</strong> · {member.memberRole === 'volunteer' ? '志愿者' : '负责人'}<small>{member.studentId}{member.archived ? ' · 已归档' : member.memberRole === 'volunteer' && !member.inRoster ? ' · 未加入日常名单' : ''}</small></span><span>总分 {score(member.result.total)}<small>上级 {score(member.result.supervisor)} · 自评 {score(member.result.self)} · 同伴 {score(member.result.peer)}</small></span></summary>
          {member.result.dimensions?.length > 0 && <PerformanceDimensionRadar dimensions={member.result.dimensions} label={`${member.name}学期绩效`} />}
          <h3>日常绩效记录 · {member.activityRecords.length} 条</h3>
          {member.activityRecords.map((record, index) => <p key={record.id || record._id || index}><strong>{record.activityName || '日常事项'} · {record.score} 分</strong><br />{record.reason}<small>{record.recordedBy?.name ? `录入人：${record.recordedBy.name} · ` : ''}{record.occurrenceDate ? new Date(record.occurrenceDate).toLocaleDateString('zh-CN') : ''}</small></p>)}
          {!member.activityRecords.length && <p>暂无日常记录。</p>}
          <h3>学期评价 · {member.evaluations.length} 份</h3>
          {member.evaluations.map((evaluation, index) => <div className="performance-overview-evaluation" key={index}><strong>{kinds[evaluation.kind] || evaluation.kind} · {score(evaluation.score)} 分</strong>{evaluation.evaluatorName && <small>评价人：{evaluation.evaluatorName}</small>}<ul>{evaluation.items.map(item => <li key={item.key}>{item.label}：{item.score} / {item.max}</li>)}</ul>{evaluation.bonusScore > 0 && <p>额外加分 {evaluation.bonusScore} · {evaluation.bonusReason}</p>}{evaluation.comment && <p>{evaluation.comment}</p>}</div>)}
          {!member.evaluations.length && <p>暂无已提交评价。</p>}
        </details>)}
      </section> : <p>选择部门查看明细。</p>}
    </>}
  </section>;
}
