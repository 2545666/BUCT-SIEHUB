const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const term = '2026-2027学年 第一学期';
const caps = ['switch_portal','manage_department_notice','manage_department_members','manage_department_accounts','manage_department_files','view_department_files','manage_department_performance','manage_volunteer_performance_policy','review_siebridge_content'];
const modules = ['organization','publicity','practice','volunteer_service','general_office','student_rights','culture_sports_arts','academic_technology','new_media'];
const makeUser = (role='student') => ({ id:role,_id:role,name:'审计示例成员',studentId:'2026000001',email:'audit@example.invalid',role:role==='student'?'student':role==='volunteer'?'admin':'superadmin',memberRole:role==='lead'?'department_lead':role==='ultimate'?'presidium':role,positionTitle:role==='lead'?'department_head':role==='presidium'||role==='ultimate'?'presidium_member':role,isUltimateAdmin:role==='ultimate',organization:'student_union',department:'student_rights',organizationLabel:'学生会',departmentLabel:'学生权益部',identityLabel:role==='lead'?'部门负责人':role==='volunteer'?'志愿者':role==='presidium'?'主席团成员':role==='ultimate'?'终极管理员':'学生',moduleCapabilities:modules.map((department,i)=>({department,organization:i<4?'youth_league':'student_union',moduleId:department==='student_rights'?'sievox':department==='academic_technology'?'siebridge':department,accessLevel:role==='student'?'public':role==='volunteer'?'member':'manage',capabilities:role==='student'?[]:caps})),managedDepartments:modules.map((department,i)=>({department,organization:i<4?'youth_league':'student_union'}))});
const dims=[['attendance','考勤积分',20],['activity','活动贡献',35],['feedback','权益跟进',25],['copywriting','文案与策划',15],['others','其他常规',5]].map(([key,label,max])=>({key,label,max,maxScore:max,scoringMode:'capped',rule:'根据实际工作表现逐项评分，保留活动记录和评价依据。'}));
const policy={title:'部门志愿者绩效考核制度',description:'按本部门维度与活动记录进行学期评价。',dimensions:dims,notes:[],evaluationWeights:{self:10,leader:70,peer:20},evaluationSources:['self','leader','peer']};
const feedbacks=Array.from({length:8},(_,i)=>({_id:'feedback'+i,id:'feedback'+i,title:['关于教学楼自习室开放时间的建议','宿舍楼热水供应时间问题'][i%2],content:'希望能够延长考试周自习室开放时间，方便晚间课程结束后继续复习。具体时间为上周三晚上九点。',category:'teaching',subCategory:'教学设施',status:i%3===0?'pending':'processing',priority:'normal',createdAt:'2026-10-20T10:00:00Z',updatedAt:'2026-10-21T10:00:00Z',semester:term,student:{name:'示例同学',studentId:'2026000010'},replies:[{_id:'reply'+i,senderType:'admin',sender:{name:'值班志愿者'},content:'已记录您的建议，正在联系相关部门核实。',createdAt:'2026-10-21T10:00:00Z'}],attachments:[]}));
const notices=Array.from({length:5},(_,i)=>({_id:'notice'+i,title:'关于开展本学期校园服务与学生交流活动的通知',summary:'欢迎关注学院活动安排，按通知要求完成报名。',content:'活动安排与报名说明。',departmentLabel:'学生权益部',organizationLabel:'学生会',department:'student_rights',organization:'student_union',createdAt:'2026-10-20T10:00:00Z',publishedAt:'2026-10-20T10:00:00Z',coverImageUrl:'/student-rights/sievox-real-interface.png'}));
const volunteers=Array.from({length:4},(_,i)=>({...makeUser('volunteer'),id:'v'+i,_id:'v'+i,name:'示例志愿者'+(i+1)}));
function responseFor(url,user){
 const p=url.pathname;
 const base={success:true};
 if(p.endsWith('/auth/me'))return {...base,user};
 if(p.endsWith('/performance-policy'))return {...base,policy,access:{canEdit:user.role!=='student'}};
 if(p.endsWith('/performance-evaluations')){
  const target={...volunteers[0],rubrics:{leader_volunteer:dims,self:dims,volunteer_peer:dims},allowedKinds:user.memberRole==='volunteer'?['self','volunteer_peer']:['leader_volunteer']};
  return {...base,semester:term,currentSemester:term,reviewOpen:true,semesters:[term],targets:[target],evaluations:[],summary:[...volunteers,user].map(target=>({target,total:86.5,supervisor:88,self:85,peer:82,bonus:0,dimensions:dims.map(d=>({name:d.label,max:d.max,score:d.max*.85})),status:'已完成'}))};
 }
 if(p.endsWith('/performance-workbench'))return {...base,semester:term,currentSemester:term,semesters:[term],policy,volunteers,roster:volunteers,records:[],leaders:[]};
 if(p.endsWith('/performance-review-window'))return {...base,currentSemester:term,open:true};
 if(p.endsWith('/ultimate/cohorts'))return {...base,cohorts:[{id:'c1',_id:'c1',name:'2026—2027学年团委学生会',status:'active',academicYear:'2026-2027',semesters:[term]}]};
 if(p.endsWith('/ultimate/members'))return {...base,members:volunteers.map(v=>({...v,user:v,cohort:'c1',accountSnapshot:v,performanceSnapshot:{source:'semester',total:86.5,semesterScores:[],dimensions:[]},semesterPerformanceArchives:[]}))};
 if(p.endsWith('/members'))return {...base,members:volunteers,cohorts:[],currentMembers:volunteers};
 if(p.endsWith('/users')||p.endsWith('/accounts'))return {...base,users:volunteers,accounts:volunteers};
 if(p.endsWith('/system/config'))return {...base,currentSemester:term,semesters:[term],config:{currentSemester:term}};
 if(p.endsWith('/feedbacks')||p.endsWith('/feedback/my'))return {...base,feedbacks,pagination:{page:1,pages:2,total:28},summary:{total:28,pending:6,processing:14,resolved:8}};
 if(/\/feedback\/feedback/.test(p))return {...base,feedback:feedbacks[0]};
 if(p.endsWith('/stats'))return {...base,stats:{total:28,pending:6,processing:14,resolved:8,byStatus:{pending:6,processing:14,resolved:8},byCategory:[]}};
 if(p.endsWith('/notifications'))return {...base,notifications:[]};
 if(p.endsWith('/feedback-archives'))return {...base,academicYears:[]};
 if(p.includes('/notices')||p.includes('/wechat'))return {...base,notices,articles:notices,items:notices,pagination:{page:1,pages:1,total:5},total:5};
 if(p.endsWith('/introduction'))return {...base,introduction:{title:'部门介绍',summary:'服务同学、开展活动、回应诉求。',content:'部门介绍与活动内容。',sections:[]},canEdit:true};
 if(p.endsWith('/files'))return {...base,files:[]};
 if(p.endsWith('/siebridge/meta'))return {...base,majors:['计算机科学与技术','生物工程'],gradeLevels:['大一','大二','大三','大四'],sections:[{key:'materials',label:'课程资料'},{key:'exams',label:'历年试题'}]};
 if(p.includes('/siebridge/courses'))return {...base,courses:[{id:'course1',_id:'course1',name:'高等数学（上）',code:'MATH101',major:'计算机科学与技术',grade:'大一',description:'课程复习、习题与历年资料',resourceCount:12,status:'approved'}],course:{id:'course1',name:'高等数学（上）',major:'计算机科学与技术',grade:'大一'},resources:[]};
 if(p.includes('/siebridge/'))return {...base,courses:[],resources:[],receipts:[]};
 return {...base,items:[],data:[],metrics:{hasData:true,averageFirstResponseHours:2.5,sampleCount:10},currentSemester:term};
}
async function measure(page){return page.evaluate(()=>{
 const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
 const desc=el=>({tag:el.tagName,text:(el.innerText||el.getAttribute('aria-label')||el.getAttribute('title')||el.getAttribute('placeholder')||'').trim().slice(0,65),cls:String(el.className||'').slice(0,130)});
 const all=[...document.querySelectorAll('body *')].filter(visible);
 const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(visible);
 return {title:document.title,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,bodyText:document.body.innerText.slice(0,700),overflow:all.filter(el=>{const r=el.getBoundingClientRect();return r.width>innerWidth&&getComputedStyle(el).position!=='fixed';}).slice(0,18).map(el=>({...desc(el),width:Math.round(el.getBoundingClientRect().width)})),smallTargets:controls.filter(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;}).slice(0,40).map(el=>({...desc(el),w:Math.round(el.getBoundingClientRect().width),h:Math.round(el.getBoundingClientRect().height)})),smallInputs:controls.filter(el=>['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>({...desc(el),font:getComputedStyle(el).fontSize})),unnamed:controls.filter(el=>!el.innerText?.trim()&&!el.getAttribute('aria-label')&&!el.getAttribute('title')&&!el.labels?.length&&el.type!=='submit').slice(0,20).map(desc),dialogs:[...document.querySelectorAll('[role=dialog],dialog')].filter(visible).length,fonts:[...new Set(all.filter(el=>el.children.length===0&&el.textContent.trim()).map(el=>getComputedStyle(el).fontSize))].sort(),headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(el=>el.textContent.trim()).slice(0,15)};
 });}
module.exports={makeUser,responseFor,measure};
if(require.main===module)(async()=>{
 fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
 const browser=await chromium.launch({headless:true});
 const results=[];
 const scenarios=[
  ['login','/',null],['home','/','student'],['directory','/departments','student'],['account','/account','student'],
  ['student-rights','/rights','student'],['volunteer-rights','/rights','volunteer'],['lead-rights','/rights','lead'],['presidium-rights','/rights','presidium'],['ultimate-rights','/rights','ultimate'],['organization','/organization','ultimate'],['bridge','/siebridge','student'],
  ['department','/departments?module=student_rights','lead'],['showcase-rights','/student-rights/index.html',null],['showcase-academic','/academic-technology/index.html',null],['showcase-culture','/culture-sports-arts/index.html',null]
 ];
 for(const width of [390,1440])for(const [name,url,role] of scenarios){
  const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:1});
  const user=makeUser(role||'student'), errors=[];
  await context.addInitScript(({role})=>{localStorage.setItem('siehub_privacy_notice_v1','accepted');if(role)localStorage.setItem('siehub_auth_token_v2','local-audit-fixture');},{role});
  await context.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(responseFor(new URL(route.request().url()),user))}));
  await context.route(/https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  try{
   console.log(`Inspecting ${name} at ${width}`);
   await page.goto('http://127.0.0.1:5174'+url,{waitUntil:'networkidle',timeout:15000});
   await page.waitForTimeout(350);
   async function capture(label){const m=await measure(page);m.name=label;m.role=role;m.errors=[...errors];results.push(m);await page.screenshot({path:path.join(out,'screenshots',`${label}-${width}.png`),fullPage:false});}
   await capture(name);
   if(name==='department')for(const tab of ['绩效考核','活动绩效记录','部门考核标准','部门资料库','成员管理','账号管理']){
    const button=page.getByRole('button',{name:tab,exact:true});if(await button.count()){await button.first().click();await page.waitForTimeout(200);await capture('department-'+tab);}
   }
   if(name==='student-rights'){
    const button=page.getByRole('button',{name:/发起反馈|我要反馈|提交反馈/});if(await button.count()){await button.first().click();await page.waitForTimeout(200);await capture('student-compose');}
   }
  }catch(error){results.push({name,width,role,error:error.message,errors});}
  await context.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({name:r.name,width:r.viewport||r.width,overflow:r.overflow?.length,smallTargets:r.smallTargets?.length,errors:r.errors,error:r.error})),null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
