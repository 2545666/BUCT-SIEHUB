const { chromium } = require('../../tmp-playwright/node_modules/playwright');
const { makeUser, responseFor, measure } = require('./audit-browser.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const output = path.join(__dirname, 'after');
fs.mkdirSync(output, {recursive:true});
const results = [];
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
 async function scenario(name, url, role, width, run, dark=false) {
  if(process.env.UI_SCENARIOS && !new RegExp(process.env.UI_SCENARIOS).test(name)) return;
  console.log(name);
  const context = await browser.newContext({viewport:{width,height:900}});
  const user = makeUser(role || 'student'), errors = [], writes = [];
  let savedPolicy;
  await context.addInitScript(({role,dark}) => {
   if(role)localStorage.setItem('siehub_auth_token_v2','local-audit-fixture');
   localStorage.setItem('sievox_demo_theme_mode',dark?'dark':'light');
  },{role,dark});
  await context.route('**/api/**', async route => {
   const request = route.request(), url = new URL(request.url());
   const data = structuredClone(responseFor(url,user));
   if(url.pathname.endsWith('/performance-policy')) {
    if(request.method() !== 'GET') { savedPolicy = request.postDataJSON(); writes.push(savedPolicy); }
    if(savedPolicy)data.policy = {...savedPolicy,version:2,isCustomized:true};
   }
   for(const field of ['notices','articles','items'])for(const item of data[field]||[])if(typeof item.title==='string') {
    item.title={zh:item.title,en:'Campus service notice'};item.summary={zh:'活动安排与报名说明',en:'Activity information'};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await context.route(/https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
  const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto('http://127.0.0.1:5174'+url,{waitUntil:'networkidle',timeout:30000});
   const details=run ? await run(page,writes) : {};
   const metrics=await measure(page);
   assert.equal(metrics.scrollWidth,width,'document overflows');
   assert.deepEqual(errors,[],'page errors');
   await page.screenshot({path:path.join(output,name+'.png')});
   results.push({name,passed:true,...metrics,...details,errors});
  } catch(error) {
   console.error(name, error.message);
   results.push({name,passed:false,error:error.message,errors});
   await page.screenshot({path:path.join(output,name+'.png')}).catch(()=>{});
  } finally { fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)); await context.close(); }
 }
 for(const width of [320,390,768,1440]) {
  await scenario('home-'+width,'/','student',width,async page=>{
   const top=await page.locator('.siehub-product-windows').evaluate(el=>el.getBoundingClientRect().top);
   assert.ok(top<350,'service entries too low');return {serviceTop:top};
  });
  await scenario('rights-showcase-'+width,'/student-rights/index.html',null,width,async page=>{
   await page.locator('.workflow').scrollIntoViewIfNeeded();
   const broken=await page.evaluate(()=>[...document.images].filter(i=>i.complete&&i.currentSrc&&!i.naturalWidth).map(i=>i.currentSrc));
   assert.deepEqual(broken,[]);return {broken};
  });
 }
 for(const width of [390,768,1440])await scenario('manager-'+width,'/rights','lead',width,async page=>{
  const row=page.locator('.case-tr').filter({has:page.locator('strong')}).filter({hasText:'宿舍楼热水'}).first();
  await row.scrollIntoViewIfNeeded();const listY=await page.evaluate(()=>scrollY);
  await row.click();await page.waitForTimeout(250);
  assert.equal(await page.locator('.case-inspector h2').innerText(),'宿舍楼热水供应时间问题');
  const inputFont=await page.locator('#case-reply').evaluate(el=>getComputedStyle(el).fontSize);
  if(width<1024) {
   assert.equal(await page.locator('.queue-panel').isVisible(),false);
   assert.equal(inputFont,'16px');
   await page.screenshot({path:path.join(output,'manager-detail-'+width+'.png')});
   await page.getByRole('button',{name:'返回待办列表',exact:true}).click();
   assert.equal(await page.locator('.queue-panel').isVisible(),true);
   await page.waitForTimeout(100);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-listY)<8,'list scroll not restored');
  }
  return {inputFont};
 });
 for(const role of ['volunteer','presidium','ultimate'])await scenario('role-'+role,'/rights',role,390);
 for(const width of [390,1440])await scenario('student-dialog-'+width,'/rights','student',width,async page=>{
  const trigger=width<760?page.locator('.mobile-compose'):page.getByRole('button',{name:'发起新反馈'}).first();
  await trigger.click();
  const dialog=page.locator(width<760?'dialog.mobile-sheet':'dialog.compose-drawer');
  assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
  for(let i=0;i<22;i++) { await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog[open]')),true,'focus escaped dialog'); }
  await page.screenshot({path:path.join(output,'compose-'+width+'.png')});
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  if(width<760){
   assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
   await page.locator('.mobile-feedback').first().click();
   assert.equal(await page.locator('.feedback-dialog').evaluate(el=>el.matches(':modal')),true);
   await page.locator('#student-feedback-reply').fill('继续补充问题信息');
   await page.screenshot({path:path.join(output,'reply-'+width+'.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('.feedback-dialog').count(),0);
   await page.getByRole('button',{name:'返回 SIEHUB 主平台'}).click();await page.locator('.siehub-product-windows').waitFor();
  }
 });
 await scenario('policy-editor','/departments?module=new_media','lead',390,async(page,writes)=>{
  await page.getByRole('button',{name:'绩效考核',exact:true}).click();
  await page.getByRole('button',{name:/^(部门标准|部门考核标准)$/}).click();
  await page.getByRole('button',{name:'编辑制度',exact:true}).click();
  assert.equal(await page.getByText('评价来源（逗号分隔）').count(),0);
  const rows=page.locator('.siehub-policy-item');const initial=await rows.count();
  await page.getByRole('button',{name:'新增绩效板块',exact:true}).click();assert.equal(await rows.count(),initial+1);
  await rows.last().getByLabel('维度名称').fill('测试活动贡献');
  await rows.last().getByLabel('封顶分').fill('15');
  await rows.last().locator('textarea').fill('依据活动记录逐项评分');
  await rows.first().getByRole('button',{name:'删除板块'}).click();assert.equal(await rows.count(),initial);
  await page.getByRole('button',{name:'保存制度',exact:true}).click();
  await page.getByRole('button',{name:'编辑制度',exact:true}).waitFor();
  assert.ok(writes.length);assert.ok(writes[0].dimensions.some(d=>d.label==='测试活动贡献'));
  assert.deepEqual(writes[0].evaluationWeights,{self:10,leader:70,peer:20});
  await page.getByRole('button',{name:'编辑制度',exact:true}).click();
  await page.getByRole('button',{name:'新增绩效板块',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await rows.count(),initial);
  await page.getByRole('button',{name:/^(学期评价|学期成绩与评价)$/}).click();
  await page.locator('.unified-performance-selectors').scrollIntoViewIfNeeded();
  return {savedDimensions:writes[0].dimensions.length};
 });
 for(const [name,url,role] of [['organization','/organization','ultimate'],['bridge','/siebridge','student'],['account','/account','student'],['academic','/academic-technology/index.html',null],['culture','/culture-sports-arts/index.html',null]])await scenario(name,url,role,390,async page=>{
  if(name==='organization'){assert.equal(await page.locator('.organization-framework-panel').isVisible(),true);assert.equal(await page.locator('.organization-overview').getAttribute('open'),null);}
  if(name==='bridge'){assert.ok(await page.getByRole('textbox',{name:'搜索课程代码或名称'}).evaluate(el=>el.getBoundingClientRect().height)>=44);}
  if(name==='academic')assert.deepEqual(await page.evaluate(()=>[...document.images].filter(i=>i.complete&&i.currentSrc&&!i.naturalWidth).map(i=>i.currentSrc)),[]);
 });
 await scenario('dark-account','/account','student',390,null,true);
 await scenario('login','/',null,390,async page=>{
  const decline=page.getByRole('button',{name:'暂不同意',exact:true});if(await decline.count())await decline.click();
  const panel=await page.locator('.siehub-login-panel').evaluate(el=>el.getBoundingClientRect().top);assert.ok(panel<150);return {panelTop:panel};
 });
 } finally { await browser.close();fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2)); }
 console.log(JSON.stringify(results.map(({name,passed,error})=>({name,passed,error})),null,2));
 if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
