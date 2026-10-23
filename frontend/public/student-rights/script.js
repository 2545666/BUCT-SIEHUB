const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.main-nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));
const cases = {
  air: { title: '宿舍空调维修进度', copy: '已联系物业确认配件到货，预计今日 18:00 前完成一次进度回访。', tag: '住宿生活', status: '处理中', progress: '68%' },
  queue: { title: '食堂窗口排队体验', copy: '已整理高峰时段观察记录，等待与餐饮中心确认现场优化方案。', tag: '餐饮服务', status: '待回访', progress: '82%' },
  class: { title: '公共教室开放建议', copy: '建议已纳入本月空间使用复盘，处理结果已同步至 SIEHUB 通知中心。', tag: '学习空间', status: '已归档', progress: '100%' }
};
document.querySelectorAll('.case-row').forEach((row) => row.addEventListener('click', () => {
  const item = cases[row.dataset.case];
  if (!item) return;
  document.querySelectorAll('.case-row').forEach((node) => node.classList.remove('selected'));
  row.classList.add('selected');
  document.querySelector('.desk-detail small').textContent = `示例事项 / ${row.querySelector('.case-index').textContent}`;
  document.querySelector('.detail-status').textContent = item.status;
  document.querySelector('#case-title').textContent = item.title;
  document.querySelector('#case-copy').textContent = item.copy;
  document.querySelector('#case-tag').textContent = item.tag;
  document.querySelector('.mini-progress span').style.width = item.progress;
}));

const workflowSteps = [
  {
    label: '01 / 接住声音',
    title: '提交反馈，先让问题有名字',
    copy: '同学可以从 SIEHUB 进入 SIEVOX，留下问题分类、地点和期望。每一条反馈都会生成独立记录，方便后续追踪。',
    action: 'Open SIEVOX ↗'
  },
  {
    label: '02 / 自动编号',
    title: '生成单号，确认反馈进入队列',
    copy: '系统记录提交时间、反馈人状态、问题类型和附件信息，形成可检索的工单编号，避免问题在口头沟通中丢失。',
    action: '查看我的反馈 ↗'
  },
  {
    label: '03 / 初筛分类',
    title: '学生权益部先判断问题归属',
    copy: '志愿者和负责人会核对描述是否完整，必要时补充追问，再按教学教务、住宿、餐饮、安全或综合服务等类型分类。',
    action: '了解处理规则 ↗'
  },
  {
    label: '04 / 分派协同',
    title: '转交对应负责同学或协同部门',
    copy: '需要跨部门处理的问题会被分派到对应负责人；系统保留每次状态变化和回复记录，让进展对提交者可见。',
    action: '追踪处理进度 ↗'
  },
  {
    label: '05 / 处理回应',
    title: '持续更新进展，直到给出结果',
    copy: '处理过程中会同步阶段性说明、现场核实情况和最终解决方案。若问题暂时无法解决，也会说明原因和下一步安排。',
    action: '查看部门回复 ↗'
  },
  {
    label: '06 / 回访归档',
    title: '确认体验，把个案变成改进依据',
    copy: '事项完成后进行回访确认，并按学期归档。共性问题会进入复盘，转化为后续提案、服务优化和制度改进线索。',
    action: '查看归档记录 ↗'
  }
];

const workflowRoot = document.querySelector('.workflow');
const workflowLabel = document.querySelector('#workflowStepLabel');
const workflowTitle = document.querySelector('#workflowStepTitle');
const workflowCopy = document.querySelector('#workflowStepCopy');
const workflowAction = document.querySelector('#workflowStepAction');
const workflowCard = document.querySelector('.workflow-card');
const workflowProgress = document.querySelector('.workflow-progress i');
const workflowStepButtons = [...document.querySelectorAll('[data-workflow-step]')];
let workflowIndex = 0;
let workflowIdleUntil = 0;
let workflowTimer = null;

const renderWorkflowStep = (index, manual = false) => {
  if (!workflowRoot || !workflowLabel || !workflowTitle || !workflowCopy || !workflowAction) return;
  workflowIndex = (index + workflowSteps.length) % workflowSteps.length;
  const step = workflowSteps[workflowIndex];
  workflowRoot.dataset.activeStep = String(workflowIndex + 1).padStart(2, '0');
  if (workflowCard) workflowCard.dataset.step = String(workflowIndex + 1).padStart(2, '0');
  workflowLabel.textContent = step.label;
  workflowTitle.textContent = step.title;
  workflowCopy.textContent = step.copy;
  workflowAction.textContent = step.action;
  workflowStepButtons.forEach((button) => {
    button.classList.toggle('is-active', Number(button.dataset.workflowStep) === workflowIndex);
    button.classList.toggle('rail-current', Number(button.dataset.workflowStep) === workflowIndex && button.closest('.workflow-rail'));
    button.setAttribute('aria-current', Number(button.dataset.workflowStep) === workflowIndex ? 'step' : 'false');
  });
  if (workflowProgress) {
    workflowProgress.style.animation = 'none';
    workflowProgress.offsetHeight;
    workflowProgress.style.animation = '';
  }
  if (manual) workflowIdleUntil = Date.now() + 9000;
};

workflowStepButtons.forEach((button) => {
  button.addEventListener('click', () => renderWorkflowStep(Number(button.dataset.workflowStep) || 0, true));
});

workflowRoot?.addEventListener('pointerenter', () => {
  workflowIdleUntil = Date.now() + 9000;
});

workflowRoot?.addEventListener('focusin', () => {
  workflowIdleUntil = Date.now() + 9000;
});

if (workflowRoot) {
  renderWorkflowStep(0);
  workflowTimer = window.setInterval(() => {
    if (Date.now() < workflowIdleUntil) return;
    renderWorkflowStep(workflowIndex + 1);
  }, 4400);
}

const showcaseCards = [...document.querySelectorAll('.gallery-trigger')];
const showcaseItems = showcaseCards.map((card, index) => ({
  title: card.querySelector('.event-info h3')?.textContent?.trim() || 'Activity ' + String(index + 1).padStart(2, '0'),
  category: card.querySelector('.event-info small')?.textContent?.trim() || 'SHOWCASE',
  caption: card.querySelector('.event-info span')?.textContent?.trim() || 'Activity photo set'
}));
const activityPhotoSets = [
  [
    { src: 'assets/activities/image1.png', label: '模拟政协提案大赛', caption: '模拟政协提案大赛现场' }
  ],
  [
    { src: 'assets/activities/image2.jpeg', label: '北京化工大学提案大赛', caption: '北京化工大学提案大赛活动海报' },
    { src: 'assets/activities/image3.png', label: '北京化工大学提案大赛', caption: '北京化工大学提案大赛展示记录' }
  ],
  [
    { src: 'assets/activities/image4.jpeg', label: '班级风采展示', caption: '班级风采展示活动记录' },
    { src: 'assets/activities/image5.png', label: '班级风采展示', caption: '班级风采展示成果画面' }
  ],
  [
  ],
  [
    { src: 'assets/activities/image7.png', label: '教师节暖心活动', caption: '教师节暖心活动现场' },
    { src: 'assets/activities/image9.png', label: '教师节暖心活动', caption: '教师节暖心活动互动瞬间' },
    { src: 'assets/activities/image10.jpeg', label: '教师节暖心活动', caption: '教师节暖心活动合影记录' }
  ],
  [
    { src: 'assets/activities/image12.png', label: '师生下午茶', caption: '师生下午茶活动记录' },
    { src: 'assets/activities/image13.jpeg', label: '师生下午茶', caption: '师生下午茶互动瞬间' },
    { src: 'assets/activities/image14.png', label: '师生下午茶', caption: '师生下午茶现场合影' }
  ],
  [
    { src: 'assets/activities/image16.png', label: '正念冥想活动', caption: '静心疗愈体验记录' },
  ],
  [
    { src: 'assets/activities/image20.png', label: '情绪拼贴画活动', caption: '剪贴情绪活动记录' },
    { src: 'assets/activities/image21.png', label: '情绪拼贴画活动', caption: '拼出心声作品展示' },
  ],
  [
    { src: 'assets/activities/image23.jpeg', label: '525百花心晴集市', caption: '525百花心晴集市现场' },
    { src: 'assets/activities/image24.png', label: '心愿徽章DIY', caption: '心愿徽章 DIY 活动' },
    { src: 'assets/activities/image25.jpeg', label: '烦恼香囊DIY', caption: '烦恼香囊 DIY 活动' },
    { src: 'assets/activities/image26.jpeg', label: '趣味套圈', caption: '趣味套圈活动' }
  ]
];
const placeholderCounts = activityPhotoSets.map((photos) => Math.max(photos.length, 1));
const storageKey = 'sievox-rights-showcase-photos-v1';
const galleryModal = document.querySelector('#galleryModal');
const galleryImage = document.querySelector('#galleryImage');
const galleryCaption = document.querySelector('#galleryCaption');
const galleryCounter = document.querySelector('#galleryCounter');
const galleryTitle = document.querySelector('#galleryTitle');
const galleryCategory = document.querySelector('#galleryCategory');
const galleryThumbs = document.querySelector('#galleryThumbs');
const galleryClose = document.querySelector('#galleryClose');
const cardPhotoIndexes = new Map();
let activeEventIndex = 0;
let activePhotoIndex = 0;

const escapeSvg = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const pad = (value) => String(value).padStart(2, '0');

const placeholderImage = (item, eventIndex, photoIndex) => {
  const photoNumber = pad(photoIndex + 1);
  const total = pad(placeholderCounts[eventIndex] || 4);
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 780">',
    '<rect width="1200" height="780" fill="#174c41"/>',
    '<circle cx="980" cy="128" r="132" fill="#df5a43" opacity=".2"/><circle cx="1040" cy="642" r="190" fill="#d5a542" opacity=".12"/>',
    '<rect x="74" y="74" width="1052" height="632" fill="none" stroke="#d5a542" stroke-width="4" opacity=".76"/>',
    '<text x="94" y="150" fill="#f2d27a" font-family="Georgia, serif" font-size="42" font-weight="700">' + pad(eventIndex + 1) + ' / ' + escapeSvg(item.category) + '</text>',
    '<text x="94" y="402" fill="#f8faf7" font-family="Georgia, serif" font-size="82" font-weight="700">' + escapeSvg(item.title) + '</text>',
    '<text x="94" y="496" fill="#f8faf7" font-family="Verdana, sans-serif" font-size="28" opacity=".72">Placeholder photo ' + photoNumber + ' of ' + total + '</text>',
    '<text x="94" y="574" fill="#d5a542" font-family="Verdana, sans-serif" font-size="22" opacity=".76">活动介绍请见下方正文</text>',
    '<text x="1038" y="682" fill="#ffffff" font-family="Georgia, serif" font-size="72" font-weight="700" opacity=".2">SIEVOX</text>',
    '</svg>'
  ].join('');
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
};

const placeholderPhoto = (eventIndex, photoIndex) => {
  const item = showcaseItems[eventIndex] || {};
  return {
    src: placeholderImage(item, eventIndex, photoIndex),
    label: '暂无活动照片',
    caption: item.title || '活动介绍'
  };
};

const getPhotoSet = (eventIndex) => {
  const publishedSet = window.SiePublishedShowcasePhotos?.[storageKey]?.[eventIndex];
  if (Array.isArray(publishedSet) && publishedSet.length) return publishedSet;
  const activitySet = activityPhotoSets[eventIndex];
  if (Array.isArray(activitySet) && activitySet.length) return activitySet;
  const count = placeholderCounts[eventIndex] || 4;
  return Array.from({ length: count }, (_, photoIndex) => placeholderPhoto(eventIndex, photoIndex));
};

const ensureDots = (stage, count) => {
  let dots = stage.querySelector('.photo-dots');
  if (!dots) {
    dots = document.createElement('div');
    dots.className = 'photo-dots';
    stage.append(dots);
  }
  if (dots.children.length !== count) {
    dots.replaceChildren(...Array.from({ length: count }, () => document.createElement('i')));
  }
  return dots;
};

const setCardPreview = (eventIndex, photoIndex) => {
  const card = showcaseCards[eventIndex];
  if (!card) return;
  const photos = getPhotoSet(eventIndex);
  const safeIndex = (photoIndex + photos.length) % photos.length;
  const photo = photos[safeIndex];
  const stage = card.querySelector('.upload-photo');
  const img = stage?.querySelector('img');
  const count = stage?.querySelector('.photo-count');
  if (!stage || !img || !photo) return;
  cardPhotoIndexes.set(eventIndex, safeIndex);
  stage.classList.add('has-image');
  img.src = photo.src;
  img.alt = photo.label || showcaseItems[eventIndex]?.title || '';
  if (count) count.textContent = pad(safeIndex + 1) + ' / ' + pad(photos.length);
  const dots = ensureDots(stage, photos.length);
  [...dots.children].forEach((dot, index) => dot.classList.toggle('active', index === safeIndex));
};

const renderGallery = (photoIndex) => {
  const photos = getPhotoSet(activeEventIndex);
  activePhotoIndex = (photoIndex + photos.length) % photos.length;
  const item = showcaseItems[activeEventIndex];
  const photo = photos[activePhotoIndex];
  if (!item || !photo) return;
  galleryImage.src = photo.src;
  galleryImage.alt = photo.label || item.title;
  galleryCaption.textContent = photo.caption || item.caption;
  galleryTitle.textContent = item.title;
  galleryCategory.textContent = item.category;
  galleryCounter.textContent = 'PHOTO ' + pad(activePhotoIndex + 1) + ' / ' + pad(photos.length);
  [...galleryThumbs.children].forEach((thumb, thumbIndex) => thumb.classList.toggle('active', thumbIndex === activePhotoIndex));
  setCardPreview(activeEventIndex, activePhotoIndex);
};

const buildThumbs = () => {
  const photos = getPhotoSet(activeEventIndex);
  galleryThumbs.replaceChildren();
  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'View photo ' + pad(index + 1));
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = '';
    button.append(img);
    button.addEventListener('click', () => renderGallery(index));
    galleryThumbs.append(button);
  });
};

const openGallery = (eventIndex, photoIndex = 0) => {
  activeEventIndex = (eventIndex + showcaseItems.length) % showcaseItems.length;
  buildThumbs();
  renderGallery(photoIndex);
  galleryModal.classList.add('open');
  galleryModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('gallery-open');
};

const closeGallery = () => {
  galleryModal.classList.remove('open');
  galleryModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('gallery-open');
};

showcaseCards.forEach((card, eventIndex) => {
  setCardPreview(eventIndex, eventIndex % getPhotoSet(eventIndex).length);
  card.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    openGallery(eventIndex, cardPhotoIndexes.get(eventIndex) || 0);
  });
  card.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openGallery(eventIndex, cardPhotoIndexes.get(eventIndex) || 0);
    }
  });
});

window.setInterval(() => {
  if (document.body.classList.contains('gallery-open')) return;
  showcaseCards.forEach((_, eventIndex) => {
    const photos = getPhotoSet(eventIndex);
    if (photos.length < 2) return;
    setCardPreview(eventIndex, (cardPhotoIndexes.get(eventIndex) || 0) + 1);
  });
}, 3600);

galleryClose?.addEventListener('click', closeGallery);
document.querySelector('#galleryPrev')?.addEventListener('click', () => renderGallery(activePhotoIndex - 1));
document.querySelector('#galleryNext')?.addEventListener('click', () => renderGallery(activePhotoIndex + 1));
galleryModal?.addEventListener('click', (event) => {
  if (event.target === galleryModal) closeGallery();
});
document.addEventListener('keydown', (event) => {
  if (!galleryModal?.classList.contains('open')) return;
  if (event.key === 'Escape') closeGallery();
  if (event.key === 'ArrowLeft') renderGallery(activePhotoIndex - 1);
  if (event.key === 'ArrowRight') renderGallery(activePhotoIndex + 1);
});
