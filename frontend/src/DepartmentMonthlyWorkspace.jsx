import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from './api';

const STORIES = {
  'youth_league:organization': ['组织建设', '把成员发展、组织生活与材料落实到每个月。', '名册准确', '流程落实', '材料归档', 'civic'],
  'youth_league:publicity': ['宣传表达', '让选题、采编与发布形成完整的工作记录。', '选题策划', '内容制作', '传播复盘', 'editorial'],
  'youth_league:practice': ['实践现场', '从项目筹备到现场执行，记录每一次真实贡献。', '项目筹备', '现场执行', '成果复盘', 'field'],
  'youth_league:volunteer_service': ['志愿服务', '用服务时长、协作和服务质量呈现本月工作。', '服务准备', '现场服务', '志愿协作', 'service'],
  'student_union:general_office': ['统筹中枢', '把会务、协调和材料交付放进同一条工作线。', '会务统筹', '跨部协调', '文档交付', 'office'],
  'student_union:student_rights': ['权益闭环', '围绕诉求响应、跟进处理和结果反馈记录贡献。', '诉求响应', '跟进处理', '结果反馈', 'rights'],
  'student_union:culture_sports_arts': ['舞台与赛场', '保留文体艺术部原有的活动、赛事与艺术实践考核细则。', '活动参与', '现场协作', '成果呈现', 'stage'],
  'student_union:academic_technology': ['学术科技', '关注学术活动策划、技术支持与成果沉淀。', '活动策划', '技术支持', '成果沉淀', 'lab'],
  'student_union:new_media': ['内容工作室', '从创意到发布，再到传播效果的复盘。', '内容策划', '制作发布', '效果复盘', 'media']
};
const todayMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).format(new Date());
const todayDate = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
const ROLE_LABELS = { volunteer: '志愿者 · 本人自评', department_lead: '部门负责人 · 部门评分', presidium: '主席团 · 分管部门评分', ultimate_admin: '终极管理员 · 统筹视图' };
const oneLog = () => ({ t: '', d: '', w: '' });
const request = async (path, token, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || '请求失败，请稍后重试');
  return data;
};
const clone = value => JSON.parse(JSON.stringify(value));
const gradeTotal = (details, standard) => {
  if (!standard?.dims) return 0;
  const points = standard.dims.reduce((sum, dimension, di) => sum + dimension.items.reduce((sub, item, ii) => {
    const ratio = standard.levels.find(level => level.text === details[`i_${di}_${ii}`])?.ratio || 0;
    return sub + Number(item.max || 0) * ratio;
  }, 0), 0);
  return Math.max(0, Math.round((points + Number(details.bonus || 0) - Number(details.minus || 0)) * 10) / 10);
};

function SelfForm({ member, score, month, onSave, busy }) {
  const [value, setValue] = useState(score?.selfScore ?? '');
  const [comment, setComment] = useState(score?.selfComment || '');
  const [logs, setLogs] = useState(score?.workLogs?.length ? clone(score.workLogs) : [oneLog()]);
  const updateLog = (index, key, value) => setLogs(previous => previous.map((log, i) => i === index ? { ...log, [key]: value } : log));
  const submit = event => {
    event.preventDefault();
    onSave({ targetId: member.id, month, mode: 'self', selfScore: value, workLogs: logs, comment });
  };
  return <form className="monthly-workspace-sheet" onSubmit={submit}>
    <div className="monthly-workspace-sheet-title"><span>01 / 本人填写</span><h3>我的自评与工作纪实</h3><p>记录本月实际完成的工作，再提交自评分。已保存内容会在此继续编辑。</p></div>
    <label className="monthly-workspace-field">本月自评分 <input type="number" min="0" max="100" step="0.5" required value={value} onChange={event => setValue(event.target.value)} placeholder="0—100" /></label>
    <div className="monthly-workspace-log-head"><strong>工作纪实</strong><button type="button" onClick={() => setLogs([...logs, oneLog()])}>＋ 添加事项</button></div>
    {logs.map((log, index) => <div className="monthly-workspace-log" key={index}>
      <input aria-label={`第${index + 1}项工作名称`} value={log.t} onChange={event => updateLog(index, 't', event.target.value)} placeholder="活动或事项名称" required />
      <input aria-label={`第${index + 1}项日期`} type="date" min={`${month}-01`} max={`${month}-31`} value={log.d || ''} onChange={event => updateLog(index, 'd', event.target.value)} />
      <input aria-label={`第${index + 1}项具体工作`} value={log.w} onChange={event => updateLog(index, 'w', event.target.value)} placeholder="我具体做了什么" required />
      <button type="button" aria-label="删除该事项" disabled={logs.length === 1} onClick={() => setLogs(logs.filter((_, i) => i !== index))}>×</button>
    </div>)}
    <label className="monthly-workspace-field">自我评价 <textarea value={comment} maxLength="2000" onChange={event => setComment(event.target.value)} placeholder="本月收获、存在的问题和下一步改进" /></label>
    <div className="monthly-workspace-form-end"><span>{score?.selfSubmittedAt ? '已提交，可再次修改' : '尚未提交'}</span><button type="submit" disabled={busy}>{busy ? '保存中…' : '保存我的自评'}</button></div>
  </form>;
}

function GradeForm({ member, score, standard, version, month, onSave, busy }) {
  const [details, setDetails] = useState(score?.itemDetails ? clone(score.itemDetails) : { bonus: 0, minus: 0 });
  const [comment, setComment] = useState(score?.leaderComment || '');
  const [ratingDate, setRatingDate] = useState(score?.ratingDate || todayDate());
  const update = (key, value) => setDetails(previous => ({ ...previous, [key]: value }));
  const submit = event => {
    event.preventDefault();
    onSave({ targetId: member.id, month, mode: 'grade', standardVersion: version, itemDetails: details, comment, ratingDate });
  };
  return <form className="monthly-workspace-sheet" onSubmit={submit}>
    <div className="monthly-workspace-sheet-title"><span>02 / 管理评分</span><h3>{member.name}的逐项评分</h3><p>根据本月标准逐项选择等级；保存时固定标准版本，避免后续修改影响旧成绩。</p></div>
    <div className="monthly-workspace-grade-total"><span>当前管理评分预估</span><strong>{gradeTotal(details, standard).toFixed(1)}</strong><small>分 · 标准版本 {version}</small></div>
    {(standard?.dims || []).map((dimension, di) => <section className="monthly-workspace-dimension" key={`${di}-${dimension.name}`}>
      <header><b>{String(di + 1).padStart(2, '0')} · {dimension.name}</b><span>{dimension.max} 分</span></header>
      {dimension.items.map((item, ii) => <label className="monthly-workspace-grade-item" key={`${di}-${ii}`}>
        <span><strong>{item.name}</strong><small>{item.desc || '按照本月考核标准评分'} · 满分 {item.max}</small></span>
        <select value={details[`i_${di}_${ii}`] || ''} onChange={event => update(`i_${di}_${ii}`, event.target.value)}><option value="">未评分</option>{(standard.levels || []).map(level => <option key={level.text} value={level.text}>{level.text} · {Math.round(level.ratio * 100)}%</option>)}</select>
      </label>)}
    </section>)}
    <div className="monthly-workspace-adjustments">
      <label>{standard?.bonus?.name || '加分项'} <input type="number" min="0" max={standard?.bonus?.max ?? undefined} step="0.5" value={details.bonus ?? 0} onChange={event => update('bonus', event.target.value)} /></label>
      <label>{standard?.minus?.name || '扣分项'} <input type="number" min="0" max={standard?.minus?.max ?? 100} step="0.5" value={details.minus ?? 0} onChange={event => update('minus', event.target.value)} /></label>
      <label>评分日期 <input type="date" value={ratingDate} onChange={event => setRatingDate(event.target.value)} /></label>
    </div>
    <label className="monthly-workspace-field">评分意见 <textarea value={comment} maxLength="2000" onChange={event => setComment(event.target.value)} placeholder="写出具体依据和改进建议" /></label>
    <div className="monthly-workspace-form-end"><span>{score?.ratedAt ? '已评分，可再次修改' : '尚未评分'}</span><button type="submit" disabled={busy}>{busy ? '保存中…' : '保存逐项评分'}</button></div>
  </form>;
}

function StandardEditor({ standard, version, month, onSave, onReset, busy }) {
  const [draft, setDraft] = useState(() => clone(standard));
  const set = change => setDraft(previous => change(clone(previous)));
  const updateDimension = (di, key, value) => set(previous => { previous.dims[di][key] = value; return previous; });
  const updateItem = (di, ii, key, value) => set(previous => { previous.dims[di].items[ii][key] = value; return previous; });
  return <section className="monthly-workspace-sheet monthly-workspace-standard">
    <div className="monthly-workspace-sheet-title"><span>03 / 本月标准</span><h3>维度与给分细则</h3><p>{month} · 版本 {version}。修改仅作用于本部门本月；已有成绩保留保存时的标准快照。</p></div>
    <div className="monthly-workspace-adjustments">
      <label>管理评分权重 % <input type="number" min="0" max="100" value={draft.weight.leader} onChange={event => set(previous => { previous.weight.leader = Number(event.target.value); previous.weight.self = 100 - previous.weight.leader; return previous; })} /></label>
      <label>自评权重 % <input type="number" min="0" max="100" value={draft.weight.self} onChange={event => set(previous => { previous.weight.self = Number(event.target.value); previous.weight.leader = 100 - previous.weight.self; return previous; })} /></label>
      <label>自评截止时刻 <input type="number" min="0" max="23" value={draft.selfDueHour ?? 20} onChange={event => set(previous => { previous.selfDueHour = Number(event.target.value); return previous; })} /></label>
    </div>
    {(draft.dims || []).map((dimension, di) => <div className="monthly-workspace-standard-dimension" key={di}>
      <header><strong>维度 {String(di + 1).padStart(2, '0')}</strong><button type="button" disabled={draft.dims.length === 1} onClick={() => set(previous => { previous.dims.splice(di, 1); return previous; })}>删除维度</button></header>
      <div className="monthly-workspace-adjustments"><label>维度名称<input value={dimension.name} onChange={event => updateDimension(di, 'name', event.target.value)} /></label><label>维度满分<input type="number" min="0" max="100" value={dimension.max} onChange={event => updateDimension(di, 'max', Number(event.target.value))} /></label></div>
      {dimension.items.map((item, ii) => <div className="monthly-workspace-standard-item" key={ii}>
        <input aria-label="考核项名称" value={item.name} onChange={event => updateItem(di, ii, 'name', event.target.value)} placeholder="考核项名称" />
        <input aria-label="考核项满分" type="number" min="0" max="100" value={item.max} onChange={event => updateItem(di, ii, 'max', Number(event.target.value))} />
        <input aria-label="给分细则" value={item.desc || ''} onChange={event => updateItem(di, ii, 'desc', event.target.value)} placeholder="给分细则" />
        <button type="button" disabled={dimension.items.length === 1} onClick={() => set(previous => { previous.dims[di].items.splice(ii, 1); return previous; })}>×</button>
      </div>)}
      <button className="monthly-workspace-text-button" type="button" onClick={() => set(previous => { previous.dims[di].items.push({ name: '新考核项', max: 0, desc: '' }); return previous; })}>＋ 添加考核项</button>
    </div>)}
    <button className="monthly-workspace-text-button" type="button" onClick={() => set(previous => { previous.dims.push({ name: '新维度', max: 0, items: [{ name: '新考核项', max: 0, desc: '' }] }); return previous; })}>＋ 添加维度</button>
    <div className="monthly-workspace-standard-levels"><strong>评分等级</strong>{draft.levels.map((level, index) => <label key={index}><input aria-label="等级名称" value={level.text} onChange={event => set(previous => { previous.levels[index].text = event.target.value; return previous; })} /><input aria-label="等级系数" type="number" min="0" max="1" step="0.01" value={level.ratio} onChange={event => set(previous => { previous.levels[index].ratio = Number(event.target.value); return previous; })} /></label>)}</div>
    <div className="monthly-workspace-adjustments"><label>加分上限<input type="number" min="0" max="100" value={draft.bonus.max ?? ''} placeholder="不设上限" onChange={event => set(previous => { previous.bonus.max = event.target.value === '' ? null : Number(event.target.value); return previous; })} /></label><label>扣分上限<input type="number" min="0" max="100" value={draft.minus.max} onChange={event => set(previous => { previous.minus.max = Number(event.target.value); return previous; })} /></label></div>
    <div className="monthly-workspace-form-end"><button type="button" className="is-secondary" disabled={busy} onClick={onReset}>恢复部门基础模板</button><button type="button" disabled={busy} onClick={() => onSave(draft)}>{busy ? '保存中…' : '保存本月标准'}</button></div>
  </section>;
}

export default function DepartmentMonthlyWorkspace({ module, token, period = '', onPeriodChange }) {
  const story = STORIES[`${module.organization}:${module.key}`] || ['月度考核', '记录每月工作与成长。', '工作纪实', '逐项评分', '结果归档', 'office'];
  const month = period || todayMonth();
  const base = `/hub/departments/${module.organization}/${module.key}/monthly-performance`;
  const reportUrl = `/culture-sports-arts/performance/index.html?organization=${encodeURIComponent(module.organization)}&department=${encodeURIComponent(module.key)}&departmentLabel=${encodeURIComponent(module.title)}&month=${encodeURIComponent(month)}`;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [section, setSection] = useState('');
  const [targetId, setTargetId] = useState('');
  const requestId = useRef(0);
  const currentMonth = useRef(month);
  currentMonth.current = month;
  const load = async () => {
    const id = ++requestId.current;
    setLoading(true); setMessage('');
    try { const result = await request(`${base}-workbench?month=${encodeURIComponent(month)}`, token); if (id === requestId.current) setData(result); }
    catch (error) { if (id === requestId.current) { setData(null); setMessage(error.message); } }
    finally { if (id === requestId.current) setLoading(false); }
  };
  useEffect(() => { const id = ++requestId.current; setLoading(true); setMessage(''); request(`${base}-workbench?month=${encodeURIComponent(month)}`, token)
    .then(result => { if (id === requestId.current) setData(result); }).catch(error => { if (id === requestId.current) { setData(null); setMessage(error.message); } }).finally(() => { if (id === requestId.current) setLoading(false); });
    return () => { requestId.current += 1; };
  }, [base, month, token]);
  const members = data?.members || [];
  const self = members.find(member => member.canSelf);
  const gradeable = members.filter(member => member.canGrade);
  const target = gradeable.find(member => member.id === targetId) || gradeable[0];
  const selected = section || (self ? 'self' : gradeable.length ? 'grade' : 'standard');
  const scoreFor = id => (data?.scores || []).find(score => score.target?.id === id);
  const write = async (suffix, method, body, success) => {
    setBusy(true); setMessage('');
    try { await request(`${base}-${suffix}`, token, { method, body: JSON.stringify(body) }); if (currentMonth.current === month) { await load(); setMessage(success); } }
    catch (error) { if (currentMonth.current === month) setMessage(error.message); }
    finally { setBusy(false); }
  };
  const setMonth = value => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) { onPeriodChange?.(value); setSection(''); } };
  return <section className="monthly-workspace" data-motif={story[5]}>
    <header className="monthly-workspace-hero"><div><p>{module.organization === 'youth_league' ? 'YOUTH LEAGUE' : 'STUDENT UNION'} / MONTHLY REVIEW</p><h2>{story[0]}<span>· 月度绩效</span></h2><p>{story[1]}</p><div className="monthly-workspace-story">{story.slice(2, 5).map((text, index) => <span key={text}><b>0{index + 1}</b>{text}</span>)}</div></div><div className="monthly-workspace-period"><label>考核月份<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><small>身份由 SIEHUB 账号与后端权限决定</small><a href={reportUrl} target="_blank" rel="noreferrer">{module.key === 'culture_sports_arts' ? '打开文体艺术部完整评分台' : '历史报表与导出'} ↗</a></div></header>
    {message && <p className="monthly-workspace-message" role="status">{message}</p>}
    {loading ? <p className="monthly-workspace-loading">正在读取本部门月度考核…</p> : data && <div className="monthly-workspace-body">
      <nav className="monthly-workspace-nav" aria-label="月度考核操作">
        <div className="monthly-workspace-identity"><span>当前身份</span><strong>{ROLE_LABELS[data.access?.viewerRole] || (data.access?.canManage ? '管理视图' : '成员自评视图')}</strong><small>{module.title} · {month}</small></div>
        {self && <button className={selected === 'self' ? 'is-active' : ''} onClick={() => setSection('self')}>我的自评 <span>{scoreFor(self.id)?.selfScore == null ? '待填写' : '已保存'}</span></button>}
        {gradeable.length > 0 && <button className={selected === 'grade' ? 'is-active' : ''} onClick={() => setSection('grade')}>逐项评分 <span>{gradeable.length} 人</span></button>}
        <button className={selected === 'standard' ? 'is-active' : ''} onClick={() => setSection('standard')}>本月标准 <span>v{data.standardVersion}</span></button>
        <div className="monthly-workspace-nav-note">评分权限以服务端为准。负责人只能评分本部门志愿者；主席团可按分管权限评分负责人。</div>
      </nav>
      <div className="monthly-workspace-content">
        {selected === 'self' && self && <SelfForm key={`${month}-${self.id}-${scoreFor(self.id)?.selfSubmittedAt || ''}`} member={self} score={scoreFor(self.id)} month={month} busy={busy} onSave={body => write('scores', 'PUT', body, '自评与工作纪实已保存')} />}
        {selected === 'grade' && gradeable.length > 0 && <><div className="monthly-workspace-targets">{gradeable.map(member => <button key={member.id} className={target?.id === member.id ? 'is-active' : ''} onClick={() => setTargetId(member.id)}>{member.name}<small>{member.positionTitle === 'volunteer' ? '志愿者' : '负责人'} · {scoreFor(member.id)?.combinedScore == null ? '待完成' : `${scoreFor(member.id).combinedScore.toFixed(1)} 分`}</small></button>)}</div>{target && <GradeForm key={`${month}-${target.id}-${scoreFor(target.id)?.ratedAt || ''}`} member={target} score={scoreFor(target.id)} standard={data.standard} version={data.standardVersion} month={month} busy={busy} onSave={body => write('scores', 'PUT', body, `${target.name}的逐项评分已保存`)} />}</>}
        {selected === 'standard' && (data.access?.canEditStandards ? <StandardEditor key={`${month}-${data.standardVersion}`} standard={data.standard} version={data.standardVersion} month={month} busy={busy} onSave={standard => write('standards', 'PUT', { month, standard }, '本月标准已保存')} onReset={() => { if (window.confirm('恢复该部门本月基础模板？已有成绩的标准快照不会改变。')) write('standards', 'DELETE', { month }, '本月标准已恢复'); }} /> : <section className="monthly-workspace-sheet"><div className="monthly-workspace-sheet-title"><span>本月标准</span><h3>考核维度</h3><p>由本部门负责人和主席团维护，成员可查看给分依据。</p></div>{data.standard?.dims.map((dimension, index) => <div className="monthly-workspace-dimension" key={index}><header><b>{dimension.name}</b><span>{dimension.max} 分</span></header>{dimension.items.map((item, ii) => <p key={ii}>{item.name} · {item.max} 分 <small>{item.desc}</small></p>)}</div>)}</section>)}
      </div>
    </div>}
  </section>;
}
