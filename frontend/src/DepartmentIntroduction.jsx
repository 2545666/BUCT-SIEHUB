import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Copy,
  Eye,
  ImagePlus,
  Plus,
  Save,
  Send,
  SquarePen,
  Trash2,
  UploadCloud,
  Video
} from 'lucide-react';
import { API_BASE, requestJson, resolveMediaUrl } from './api';
import { shouldReplaceEditorContent, canvasPreviewScale } from './feedbackState';

const EXTERNAL_DEPARTMENT_INTRO_URLS = {};

const getExternalIntroductionUrl = (module) => EXTERNAL_DEPARTMENT_INTRO_URLS[module?.key] || '';
const EXTERNAL_EDITOR_DISABLED_DEPARTMENTS = new Set();

const getText = (value, language = 'zh') => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[language] || value.zh || value.en || '';
};

const DEPARTMENT_TITLE_EN = {
  organization: 'Organization Department',
  publicity: 'Publicity Department',
  practice: 'Practice Department',
  volunteer_service: 'Volunteer Service Department',
  general_office: 'General Office',
  student_rights: 'Student Rights Department',
  culture_sports_arts: 'Culture, Sports and Arts Department',
  academic_technology: 'Academic Technology Department',
  new_media: 'New Media Department'
};

const getModuleTitle = (module, language = 'zh') => {
  if (language === 'en') return DEPARTMENT_TITLE_EN[module?.key] || module?.title || 'Department';
  return module?.title || '部门';
};

const makeLocalized = (zh = '', en = '') => ({ zh, en });

const createBlock = (type) => {
  const id = `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = { id, type, visible: true, data: {} };
  if (type === 'hero') {
    base.data = {
      title: makeLocalized('部门介绍', 'Department Introduction'),
      subtitle: makeLocalized('在这里展示部门职责、成员风采与学生服务。', 'Show responsibilities, team profile and student services here.'),
      backgroundImageUrl: '',
      overlayOpacity: 0.45,
      textTone: 'light'
    };
  } else if (type === 'text') {
    base.data = {
      title: makeLocalized('正文标题', 'Section Title'),
      body: makeLocalized('请输入介绍内容。', 'Enter introduction content.'),
      backgroundImageUrl: '',
      overlayOpacity: 0.18,
      textTone: 'dark'
    };
  } else if (type === 'image') {
    base.data = {
      title: makeLocalized('图片展示', 'Image'),
      caption: makeLocalized('', ''),
      alt: makeLocalized('', ''),
      url: ''
    };
  } else if (type === 'video') {
    base.data = {
      title: makeLocalized('视频展示', 'Video'),
      caption: makeLocalized('', ''),
      alt: makeLocalized('', ''),
      url: ''
    };
  } else if (type === 'duties') {
    base.data = {
      title: makeLocalized('部门职责', 'Responsibilities'),
      items: [makeLocalized('完善一条部门职责', 'Add a responsibility')]
    };
  } else if (type === 'contact') {
    base.data = {
      title: makeLocalized('联系方式', 'Contact'),
      items: [{ label: makeLocalized('邮箱', 'Email'), value: makeLocalized('', '') }]
    };
  }
  return base;
};

const defaultContent = (module) => ({
  blocks: [
    {
      id: 'local-hero',
      type: 'hero',
      visible: true,
      data: {
        title: makeLocalized(module?.title || '部门介绍', getModuleTitle(module, 'en')),
        subtitle: makeLocalized(module?.summary || '部门介绍页面正在建设中。', 'This department introduction page is being prepared.'),
        backgroundImageUrl: '',
        overlayOpacity: 0.45,
        textTone: 'light'
      }
    },
    createBlock('text')
  ]
});

const FieldPair = ({ label, value = {}, onChange, textarea = false, language = 'zh' }) => {
  const Input = textarea ? 'textarea' : 'input';
  return (
    <label className="dept-intro-field">
      <span>{label}</span>
      <Input value={value.zh || ''} onChange={event => onChange({ ...value, zh: event.target.value })} placeholder={language === 'en' ? 'Chinese content' : '中文内容'} rows={textarea ? 4 : undefined} />
      <Input value={value.en || ''} onChange={event => onChange({ ...value, en: event.target.value })} placeholder={language === 'en' ? 'English content' : 'English content'} rows={textarea ? 4 : undefined} />
    </label>
  );
};

const getBackgroundBlockProps = (block, defaultTone) => {
  const url = resolveMediaUrl(block.data?.backgroundImageUrl || '');
  const textTone = ['light', 'dark'].includes(block.data?.textTone) ? block.data.textTone : defaultTone;
  const opacity = Number.isFinite(Number(block.data?.overlayOpacity)) ? Math.max(0, Math.min(0.9, Number(block.data.overlayOpacity))) : 0;
  if (!url) return { className: `tone-${textTone}`, style: undefined };
  const overlayColor = textTone === 'dark' ? '255, 255, 255' : '15, 23, 42';
  return {
    className: `has-background tone-${textTone}`,
    style: {
      backgroundImage: `linear-gradient(rgba(${overlayColor}, ${opacity}), rgba(${overlayColor}, ${opacity})), url("${url}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  };
};

const BlockPreview = ({ block, language = 'zh' }) => {
  if (!block?.visible) return null;
  const title = getText(block.data?.title, language);
  if (block.type === 'hero') {
    const backgroundProps = getBackgroundBlockProps(block, 'light');
    return (
      <section className={`dept-intro-page-hero ${backgroundProps.className}`} style={backgroundProps.style}>
        <p>SIEHUB / DEPARTMENT</p>
        <h1>{title}</h1>
        <span>{getText(block.data?.subtitle, language)}</span>
      </section>
    );
  }
  if (block.type === 'text') {
    const backgroundProps = getBackgroundBlockProps(block, 'dark');
    return (
      <section className={`dept-intro-page-section ${backgroundProps.className}`} style={backgroundProps.style}>
        <h2>{title}</h2>
        <p>{getText(block.data?.body, language)}</p>
      </section>
    );
  }
  if (block.type === 'image') {
    return (
      <section className="dept-intro-page-section media">
        <h2>{title}</h2>
        {block.data?.url ? <img src={resolveMediaUrl(block.data.url)} alt={getText(block.data?.alt, language) || title} /> : <div className="dept-intro-media-empty"><ImagePlus />{language === 'en' ? 'No image uploaded' : '未上传图片'}</div>}
        {getText(block.data?.caption, language) && <p>{getText(block.data.caption, language)}</p>}
      </section>
    );
  }
  if (block.type === 'video') {
    return (
      <section className="dept-intro-page-section media">
        <h2>{title}</h2>
        {block.data?.url ? <video src={resolveMediaUrl(block.data.url)} controls preload="metadata" /> : <div className="dept-intro-media-empty"><Video />{language === 'en' ? 'No video uploaded' : '未上传视频'}</div>}
        {getText(block.data?.caption, language) && <p>{getText(block.data.caption, language)}</p>}
      </section>
    );
  }
  if (block.type === 'duties') {
    return (
      <section className="dept-intro-page-section">
        <h2>{title}</h2>
        <div className="dept-intro-duty-list">
          {(block.data?.items || []).map((item, index) => <article key={`${block.id}-${index}`}>{getText(item, language)}</article>)}
        </div>
      </section>
    );
  }
  if (block.type === 'contact') {
    return (
      <section className="dept-intro-page-section">
        <h2>{title}</h2>
        <div className="dept-intro-contact-list">
          {(block.data?.items || []).map((item, index) => (
            <article key={`${block.id}-${index}`}>
              <span>{getText(item.label, language)}</span>
              <strong>{getText(item.value, language)}</strong>
            </article>
          ))}
        </div>
      </section>
    );
  }
  return null;
};

const newId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createCanvasElement = (type, overrides = {}) => {
  const base = {
    id: newId(type),
    type,
    visible: true,
    content: {},
    style: {
      x: 96,
      y: 96,
      width: 360,
      height: 180,
      rotation: 0,
      zIndex: 10,
      fontFamily: 'Noto Sans SC',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 1.25,
      color: '#132033',
      textAlign: 'left',
      backgroundColor: 'transparent',
      backgroundImageUrl: '',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      objectFit: 'cover',
      objectPosition: 'center',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 16,
      padding: 20,
      overlayColor: '#0f172a',
      overlayOpacity: 0,
      opacity: 1
    }
  };
  if (type === 'text') {
    base.content = { text: makeLocalized('双击右侧面板编辑文字', 'Edit text in the right panel') };
    base.style.width = 520;
    base.style.height = 110;
    base.style.fontSize = 42;
    base.style.fontFamily = 'Noto Serif SC';
    base.style.fontWeight = 800;
  } else if (type === 'image') {
    base.content = { title: makeLocalized('图片', 'Image'), alt: makeLocalized('', ''), url: '' };
    base.style.width = 420;
    base.style.height = 280;
    base.style.backgroundColor = '#dbeafe';
    base.style.borderRadius = 28;
  } else if (type === 'shape') {
    base.content = { label: makeLocalized('', '') };
    base.style.width = 220;
    base.style.height = 140;
    base.style.backgroundColor = '#facc15';
    base.style.borderRadius = 40;
  } else if (type === 'card') {
    base.content = { title: makeLocalized('信息卡片', 'Info card'), body: makeLocalized('可以编辑文字、背景图、蒙版、位置和大小。', 'Edit text, background, overlay, position and size.') };
    base.style.width = 380;
    base.style.height = 240;
    base.style.backgroundColor = '#ffffff';
    base.style.borderColor = '#d8e1ef';
    base.style.borderWidth = 1;
    base.style.borderRadius = 26;
  } else if (type === 'activity') {
    base.content = {
      kicker: makeLocalized('ACTIVITY', 'ACTIVITY'),
      title: makeLocalized('新活动', 'New activity'),
      body: makeLocalized('记录活动亮点、现场照片和成果。', 'Record highlights, photos and outcomes.'),
      date: makeLocalized('2026', '2026')
    };
    base.style.width = 420;
    base.style.height = 260;
    base.style.backgroundColor = '#102a43';
    base.style.color = '#ffffff';
    base.style.borderRadius = 30;
    base.style.overlayOpacity = 0.28;
  }
  return {
    ...base,
    ...overrides,
    style: { ...base.style, ...(overrides.style || {}) },
    content: { ...base.content, ...(overrides.content || {}) }
  };
};

const createCanvasPage = (module, index = 0) => ({
  id: newId('page'),
  title: makeLocalized(index === 0 ? `${module?.title || '部门'}首页` : `页面 ${index + 1}`, index === 0 ? `${getModuleTitle(module, 'en')} Home` : `Page ${index + 1}`),
  width: 1440,
  height: 900,
  backgroundColor: departmentCanvasPalette(module).background,
  backgroundImageUrl: '',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  overlayColor: '#0f172a',
  overlayOpacity: 0,
  transition: 'rise',
  elements: (() => {
    const palette = departmentCanvasPalette(module);
    const baseElements = [
      createCanvasElement('shape', {
        id: newId('background-band'),
        style: { x: 870, y: -120, width: 430, height: 1040, zIndex: 1, backgroundColor: palette.primary, borderRadius: 0, opacity: 0.92 }
      }),
      createCanvasElement('image', {
        id: newId('school-logo'),
        content: { title: makeLocalized('校徽', 'University logo'), alt: makeLocalized('北京化工大学校徽', 'BUCT logo'), url: '/BUCT_LOGO_blue.png' },
        style: { x: 78, y: 58, width: 58, height: 58, zIndex: 5, backgroundColor: 'transparent', borderRadius: 0, padding: 0, objectFit: 'contain' }
      }),
      createCanvasElement('image', {
        id: newId('college-logo'),
        content: { title: makeLocalized('院徽', 'College logo'), alt: makeLocalized('国际教育学院院徽', 'SIE logo'), url: '/SIE_LOGO.svg' },
        style: { x: 150, y: 58, width: 58, height: 58, zIndex: 5, backgroundColor: 'transparent', borderRadius: 0, padding: 0, objectFit: 'contain' }
      }),
      createCanvasElement('image', {
        id: newId('department-logo'),
        content: { title: makeLocalized('部门标志', 'Department logo'), alt: makeLocalized('部门标志', 'Department logo'), url: palette.logo },
        style: { x: 222, y: 52, width: 70, height: 70, zIndex: 5, backgroundColor: 'transparent', borderRadius: 0, padding: 0, objectFit: 'contain' }
      }),
      createCanvasElement('text', {
        id: newId('kicker'),
        content: { text: makeLocalized(palette.label, palette.label) },
        style: { x: 78, y: 172, width: 560, height: 42, zIndex: 5, fontFamily: 'Noto Sans SC', fontSize: 20, fontWeight: 900, color: palette.primary, lineHeight: 1.1 }
      }),
      createCanvasElement('text', {
        id: newId('title'),
        content: { text: palette.headline },
        style: { x: 72, y: 220, width: 670, height: 260, zIndex: 5, fontFamily: 'Noto Serif SC', fontSize: 76, fontWeight: 900, lineHeight: 1.08, color: palette.ink, padding: 0 }
      }),
      createCanvasElement('card', {
        id: newId('intro-card'),
        content: { title: makeLocalized('部门简介', 'Department Profile'), body: palette.body },
        style: { x: 82, y: 538, width: 500, height: 210, zIndex: 6, fontFamily: 'Noto Sans SC', fontSize: 22, color: palette.ink, backgroundColor: '#ffffff', borderColor: 'rgba(15, 23, 42, .12)', borderWidth: 1, borderRadius: 18, padding: 24 }
      }),
      createCanvasElement('image', {
        id: newId('hero-image'),
        content: { title: makeLocalized('主视觉图片', 'Hero image'), alt: makeLocalized('部门展示图片', 'Department showcase image'), url: '' },
        style: { x: 790, y: 112, width: 530, height: 430, zIndex: 4, backgroundColor: palette.accent, borderRadius: 26, overlayColor: palette.ink, overlayOpacity: 0.18 }
      }),
      createCanvasElement('activity', {
        id: newId('activity-card'),
        content: { kicker: makeLocalized('ACTIVITY', 'ACTIVITY'), title: palette.activityTitle, body: makeLocalized('这里可插入新活动、替换背景图，并调整蒙版颜色与透明度。', 'Insert new activities, replace background images, and tune overlay color and opacity.'), date: makeLocalized('2026', '2026') },
        style: { x: 760, y: 588, width: 330, height: 220, zIndex: 6, backgroundColor: palette.ink, color: '#ffffff', borderRadius: 22, overlayColor: palette.primary, overlayOpacity: 0.22 }
      }),
      createCanvasElement('card', {
        id: newId('gallery-card'),
        content: { title: makeLocalized('图片展示台', 'Gallery Stage'), body: makeLocalized('为活动照片、成员风采和项目成果预留展示位。', 'Reserve space for activity photos, member stories and project outcomes.') },
        style: { x: 1120, y: 588, width: 220, height: 220, zIndex: 6, backgroundColor: palette.warm, color: palette.ink, borderRadius: 22, padding: 20 }
      })
    ];
    if (index > 0) {
      return [
        createCanvasElement('text', {
          content: { text: makeLocalized(`页面 ${index + 1}`, `Page ${index + 1}`) },
          style: { x: 88, y: 88, width: 520, height: 120, fontSize: 64, fontFamily: 'Noto Serif SC', color: palette.ink, zIndex: 4 }
        }),
        createCanvasElement('activity', {
          content: { kicker: makeLocalized('NEW PAGE', 'NEW PAGE'), title: makeLocalized('新活动', 'New Activity'), body: makeLocalized('在这里继续添加活动、图片和说明。', 'Add activities, images and notes here.'), date: makeLocalized('2026', '2026') },
          style: { x: 92, y: 270, width: 460, height: 260, backgroundColor: palette.primary, color: '#ffffff', zIndex: 4 }
        })
      ];
    }
    return baseElements;
  })()
});

const ensureCanvasContent = (content, module) => {
  if (Array.isArray(content?.pages) && content.pages.length) return content;
  return { ...content, pages: [createCanvasPage(module, 0)] };
};

const departmentCanvasPalette = (module) => {
  if (module?.key === 'student_rights') {
    return {
      background: '#fffaf1',
      ink: '#1e2925',
      muted: '#59675f',
      primary: '#174c41',
      accent: '#d9553f',
      warm: '#f0c96a',
      logo: '/LOGO_1.png',
      label: 'SIEVOX / STUDENT SERVICE DESK',
      headline: makeLocalized('一张反馈单，\n一条看得见的改善路径。', 'One feedback ticket,\none visible path to change.'),
      body: makeLocalized('学生权益部把同学的日常体验带到可以行动的地方。反馈、跟进、回访与归档，都在 SIEHUB 中留下清楚节点。', 'Student Rights turns everyday experiences into clear action, follow-up and visible records.'),
      activityTitle: makeLocalized('权益反馈回访', 'Feedback Follow-up')
    };
  }
  if (module?.key === 'academic_technology') {
    return {
      background: '#f8faf7',
      ink: '#152239',
      muted: '#5c6a79',
      primary: '#4379ff',
      accent: '#65d7df',
      warm: '#e5bd51',
      logo: '/brand/siebridge.png',
      label: 'SIEBRIDGE / ACADEMIC TECHNOLOGY',
      headline: makeLocalized('好问题\n值得有\n下一步。', 'Good questions\ndeserve\na next step.'),
      body: makeLocalized('学术科技部把课程、竞赛、表达与升学资源组织起来，让资料、经验和机会在同学之间流动。', 'Academic Technology organizes courses, competitions, expression and future pathways into a shared resource flow.'),
      activityTitle: makeLocalized('SIE 学辅课堂', 'SIE Academic Lab')
    };
  }
  return {
    background: '#f7fafc',
    ink: '#132033',
    muted: '#64748b',
    primary: '#2563eb',
    accent: '#14b8a6',
    warm: '#facc15',
    logo: '',
    label: 'SIEHUB / DEPARTMENT',
    headline: makeLocalized(`${module?.title || '部门'}\n宣传展示台`, `${getModuleTitle(module, 'en')}\nShowcase`),
    body: makeLocalized(module?.summary || '在这里编辑部门职责、成员风采、服务流程与活动展示。', module?.summary || 'Edit department profile here.'),
    activityTitle: makeLocalized('部门活动展示', 'Department Activity')
  };
};

const canvasElementStyle = (element, scale = 1) => {
  const style = element.style || {};
  const backgroundImage = style.backgroundImageUrl ? `url("${resolveMediaUrl(style.backgroundImageUrl)}")` : undefined;
  return {
    left: `${(Number(style.x) || 0) * scale}px`,
    top: `${(Number(style.y) || 0) * scale}px`,
    width: `${(Number(style.width) || 100) * scale}px`,
    height: `${(Number(style.height) || 100) * scale}px`,
    transform: `rotate(${Number(style.rotation) || 0}deg)`,
    zIndex: Number(style.zIndex) || 1,
    color: style.color || '#132033',
    opacity: Number(style.opacity ?? 1),
    fontFamily: style.fontFamily || 'Noto Sans SC',
    fontSize: `${(Number(style.fontSize) || 18) * scale}px`,
    fontWeight: Number(style.fontWeight) || 700,
    lineHeight: Number(style.lineHeight) || 1.25,
    textAlign: style.textAlign || 'left',
    backgroundColor: style.backgroundColor || 'transparent',
    backgroundImage,
    backgroundSize: style.backgroundSize || 'cover',
    backgroundPosition: style.backgroundPosition || 'center',
    border: `${Number(style.borderWidth) || 0}px solid ${style.borderColor || 'transparent'}`,
    borderRadius: `${(Number(style.borderRadius) || 0) * scale}px`,
    padding: `${(Number(style.padding) || 0) * scale}px`
  };
};

const CanvasElementPreview = ({ element, language = 'zh', scale = 1, selected = false, onSelect, onPointerDown }) => {
  if (!element?.visible) return null;
  const style = element.style || {};
  const overlayStyle = {
    backgroundColor: style.overlayColor || '#0f172a',
    opacity: Number(style.overlayOpacity) || 0
  };
  const className = `dept-intro-slide-element ${element.type} ${selected ? 'is-selected' : ''}`;
  return (
    <div
      className={className}
      style={canvasElementStyle(element, scale)}
      onClick={onSelect}
      onPointerDown={event => onPointerDown?.(element, event, 'move')}
    >
      {style.backgroundImageUrl && <span className="dept-intro-slide-overlay" style={overlayStyle} />}
      {element.type === 'text' && <div className="dept-intro-slide-text">{getText(element.content?.text, language)}</div>}
      {element.type === 'image' && (element.content?.url ? <img src={resolveMediaUrl(element.content.url)} alt={getText(element.content.alt, language) || getText(element.content.title, language)} style={{ objectFit: style.objectFit || 'cover', objectPosition: style.objectPosition || 'center' }} /> : <div className="dept-intro-slide-empty"><ImagePlus />图片占位</div>)}
      {element.type === 'shape' && getText(element.content?.label, language) && <div>{getText(element.content.label, language)}</div>}
      {element.type === 'card' && <div className="dept-intro-slide-card-copy"><strong>{getText(element.content?.title, language)}</strong><p>{getText(element.content?.body, language)}</p></div>}
      {element.type === 'activity' && <div className="dept-intro-slide-card-copy"><small>{getText(element.content?.kicker, language)} / {getText(element.content?.date, language)}</small><strong>{getText(element.content?.title, language)}</strong><p>{getText(element.content?.body, language)}</p></div>}
      {selected && onPointerDown && (
        <span
          className="dept-intro-resize-handle"
          onPointerDown={event => onPointerDown(element, event, 'resize')}
        />
      )}
    </div>
  );
};

const CanvasPagePreview = ({ page, language = 'zh', scale = 1, selectedElementId = '', onSelectElement, onElementPointerDown }) => {
  const pageStyle = {
    width: `${page.width * scale}px`,
    height: `${page.height * scale}px`,
    backgroundColor: page.backgroundColor || '#f8fafc',
    backgroundImage: page.backgroundImageUrl ? `url("${resolveMediaUrl(page.backgroundImageUrl)}")` : undefined,
    backgroundSize: page.backgroundSize || 'cover',
    backgroundPosition: page.backgroundPosition || 'center'
  };
  return (
    <section className={`dept-intro-slide-page transition-${page.transition || 'rise'}`} style={pageStyle}>
      {page.backgroundImageUrl && <span className="dept-intro-slide-overlay" style={{ backgroundColor: page.overlayColor || '#0f172a', opacity: Number(page.overlayOpacity) || 0 }} />}
      {(page.elements || []).map(element => (
        <CanvasElementPreview
          key={element.id}
          element={element}
          language={language}
          scale={scale}
          selected={element.id === selectedElementId}
          onSelect={event => {
            event?.stopPropagation();
            onSelectElement?.(element.id);
          }}
          onPointerDown={onElementPointerDown}
        />
      ))}
    </section>
  );
};

const ResponsiveCanvasPages = ({ pages, language }) => {
  const container = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const measure = () => setWidth(container.current?.clientWidth || 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="dept-intro-slide-viewer">{width > 0 && pages.map(page => <CanvasPagePreview key={page.id} page={page} language={language} scale={canvasPreviewScale(width, page.width)} />)}</div>;
};

export const DepartmentIntroductionViewer = ({ module, token, language = 'zh' }) => {
  const externalUrl = getExternalIntroductionUrl(module);
  const [loading, setLoading] = useState(!externalUrl);
  const [intro, setIntro] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (externalUrl) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (!data.success) throw new Error(data.message || '获取部门介绍失败');
        setIntro(data.introduction);
      })
      .catch(error => {
        if (!cancelled) setMessage(error.message || '获取部门介绍失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalUrl, module.organization, module.key, token]);

  const content = intro?.content || defaultContent(module);
  if (externalUrl) {
    return (
      <section className="dept-intro-page" data-i18n-skip>
        <section className="dept-intro-page-hero tone-light">
          <p>SIEHUB / DEPARTMENT</p>
          <h1>{getModuleTitle(module, language)}</h1>
          <span>{language === 'en' ? 'This department introduction has been moved to an external showcase.' : '该部门介绍已迁移到外部展示站。'}</span>
        </section>
        <section className="dept-intro-page-section">
          <h2>{language === 'en' ? 'External showcase' : '外部展示站'}</h2>
          <p>{language === 'en' ? 'Open the dedicated showcase site for the latest department introduction layout.' : '点击进入独立展示站查看最新的部门介绍外观。'}</p>
          <a href={externalUrl} target="_blank" rel="noreferrer" className="dept-intro-external-link">
            {language === 'en' ? 'Open showcase' : '打开展示站'} <ArrowUpRight />
          </a>
        </section>
      </section>
    );
  }
  return (
    <section className="dept-intro-page" data-i18n-skip>
      {loading ? <div className="dept-intro-status">{language === 'en' ? 'Loading department introduction...' : '加载部门介绍中...'}</div> : null}
      {message ? <div className="dept-intro-status error">{message}</div> : null}
      {!loading && !message && (
        <>
          {!intro?.hasPublished && <div className="dept-intro-status">{language === 'en' ? 'This department has not published a custom introduction page yet. The default template is shown.' : '该部门暂未发布自定义介绍页，当前显示默认模板。'}</div>}
          {Array.isArray(content.pages) && content.pages.length ? (
            <ResponsiveCanvasPages pages={content.pages} language={language} />
          ) : (
            (content.blocks || []).map(block => <BlockPreview key={block.id} block={block} language={language} />)
          )}
        </>
      )}
    </section>
  );
};

export const DepartmentIntroductionEditor = ({ module, token, language = 'zh', onClose }) => {
  const isEnglish = language === 'en';
  const externalUrl = getExternalIntroductionUrl(module);
  const externalEditorDisabled = EXTERNAL_EDITOR_DISABLED_DEPARTMENTS.has(module?.key);
  const [loading, setLoading] = useState(!externalEditorDisabled);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState('');
  const [intro, setIntro] = useState(null);
  const [content, setContent] = useState(() => ensureCanvasContent(defaultContent(module), module));
  const [selectedId, setSelectedId] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState('');
  const [message, setMessage] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [conflict, setConflict] = useState(false);
  const writeInFlight = useRef(false);

  useEffect(() => {
    if (externalEditorDisabled) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    setMessage('');
    fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction/editor`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (!data.success) throw new Error(data.message || '获取编辑数据失败');
        if (!data.introduction || !Number.isFinite(data.introduction.draftVersion)) throw new Error('编辑版本未载入，请重新加载');
        const nextContent = ensureCanvasContent(data.introduction?.content || defaultContent(module), module);
        setIntro(data.introduction);
        setContent(nextContent);
        setSelectedId(nextContent.blocks?.[0]?.id || '');
        setSelectedPageId(nextContent.pages?.[0]?.id || '');
        setSelectedElementId(nextContent.pages?.[0]?.elements?.[0]?.id || '');
        setRevisions(data.revisions || []);
        setLoaded(true);
        setConflict(false);
      })
      .catch(error => {
        if (!cancelled) setMessage(error.message || '获取编辑数据失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalEditorDisabled, module.organization, module.key, token, loadAttempt]);

  const blocks = content.blocks || [];
  const selectedBlock = useMemo(() => blocks.find(block => block.id === selectedId) || blocks[0], [blocks, selectedId]);
  const pages = content.pages || [];
  const selectedPage = useMemo(() => pages.find(page => page.id === selectedPageId) || pages[0], [pages, selectedPageId]);
  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return selectedPage?.elements?.find(element => element.id === selectedElementId) || null;
  }, [selectedElementId, selectedPage]);

  const setBlocks = (nextBlocks) => {
    setContent({ blocks: nextBlocks });
    if (!nextBlocks.some(block => block.id === selectedId)) setSelectedId(nextBlocks[0]?.id || '');
  };

  const updateBlock = (id, updater) => {
    setBlocks(blocks.map(block => block.id === id ? updater(block) : block));
  };

  const addBlock = (type) => {
    const block = createBlock(type);
    setBlocks([...blocks, block]);
    setSelectedId(block.id);
  };

  const moveBlock = (id, direction) => {
    const index = blocks.findIndex(block => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next);
  };

  const removeBlock = (id) => {
    if (blocks.length <= 1) {
        setMessage(isEnglish ? 'Keep at least one block.' : '至少保留一个区块。');
      return;
    }
    if (!window.confirm(isEnglish ? 'Delete this block?' : '确认删除该区块吗？')) return;
    setBlocks(blocks.filter(block => block.id !== id));
  };

  const saveDraft = async () => {
    if (!loaded || conflict || writeInFlight.current) return;
    writeInFlight.current = true;
    const submitted = content;
    setSaving(true);
    setMessage('');
    try {
      const data = await requestJson(`/hub/departments/${module.organization}/${module.key}/introduction/draft`, token, {
        method: 'PUT',
        body: JSON.stringify({ baseVersion: intro.draftVersion, content: submitted })
      });
      if (!data.success) throw new Error(data.message || '保存草稿失败');
      setIntro(data.introduction);
      setContent(current => shouldReplaceEditorContent(submitted, current) ? (data.introduction?.content || submitted) : current);
      setMessage(isEnglish ? 'Draft saved.' : '草稿已保存。');
    } catch (error) {
      if (error.status === 409) setConflict(true);
      setMessage(error.message || '保存草稿失败');
    } finally {
      writeInFlight.current = false;
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!loaded || conflict || writeInFlight.current) return;
    if (!window.confirm(isEnglish ? 'Publish this department introduction page now? Students will see it immediately.' : '确认发布该部门介绍页吗？学生端将立即看到最新内容。')) return;
    setPublishing(true);
    writeInFlight.current = true;
    const submitted = content;
    setMessage('');
    try {
      const data = await requestJson(`/hub/departments/${module.organization}/${module.key}/introduction/publish`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: '管理端发布', baseVersion: intro.draftVersion, content: submitted })
      });
      if (!data.success) throw new Error(data.message || '发布失败');
      setIntro(data.introduction);
      setContent(current => shouldReplaceEditorContent(submitted, current) ? (data.introduction?.content || submitted) : current);
      setMessage(isEnglish ? 'Department intro page published.' : '部门介绍页已发布。');
    } catch (error) {
      if (error.status === 409) setConflict(true);
      setMessage(error.message || '发布失败');
    } finally {
      writeInFlight.current = false;
      setPublishing(false);
    }
  };

  const uploadMedia = async (block, file, targetField = 'url') => {
    if (!file) return;
    setUploadingBlockId(block.id);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '上传失败');
      updateBlock(block.id, current => ({ ...current, data: { ...current.data, [targetField]: data.media.url } }));
      setMessage(isEnglish ? 'Media uploaded. You can publish directly.' : '媒体已上传，可以直接发布。');
    } catch (error) {
      setMessage(error.message || '上传失败');
    } finally {
      setUploadingBlockId('');
    }
  };

  const setPageList = (nextPages) => {
    setContent(current => ({ ...(current || {}), pages: nextPages, blocks: current?.blocks || blocks }));
    if (!nextPages.find(page => page.id === selectedPageId)) {
      const nextPage = nextPages[0];
      setSelectedPageId(nextPage?.id || '');
      setSelectedElementId(nextPage?.elements?.[0]?.id || '');
    }
  };

  const updatePage = (pageId, updater) => {
    setPageList(pages.map(page => page.id === pageId ? updater(page) : page));
  };

  const addCanvasPage = () => {
    const nextPage = createCanvasPage(module, pages.length);
    setPageList([...pages, nextPage]);
    setSelectedPageId(nextPage.id);
    setSelectedElementId(nextPage.elements?.[0]?.id || '');
  };

  const removeCanvasPage = (pageId) => {
    if (pages.length <= 1) {
      setMessage(isEnglish ? 'Keep at least one page.' : '至少保留一个页面。');
      return;
    }
    setPageList(pages.filter(page => page.id !== pageId));
  };

  const duplicateCanvasPage = (pageId) => {
    const page = pages.find(item => item.id === pageId);
    if (!page) return;
    const copy = {
      ...page,
      id: newId('page'),
      title: {
        zh: `${getText(page.title, 'zh') || '页面'} 副本`,
        en: `${getText(page.title, 'en') || 'Page'} Copy`
      },
      elements: (page.elements || []).map(element => ({ ...element, id: newId(element.type), style: { ...element.style } }))
    };
    setPageList([...pages, copy]);
    setSelectedPageId(copy.id);
    setSelectedElementId(copy.elements?.[0]?.id || '');
  };

  const updateElement = (pageId, elementId, updater) => {
    updatePage(pageId, page => ({
      ...page,
      elements: (page.elements || []).map(element => element.id === elementId ? updater(element) : element)
    }));
  };

  const addCanvasElement = (type) => {
    if (!selectedPage) return;
    const element = createCanvasElement(type, { style: { x: 120 + (selectedPage.elements?.length || 0) * 20, y: 120 + (selectedPage.elements?.length || 0) * 16 } });
    updatePage(selectedPage.id, page => ({ ...page, elements: [...(page.elements || []), element] }));
    setSelectedElementId(element.id);
  };

  const removeCanvasElement = (pageId, elementId) => {
    updatePage(pageId, page => ({
      ...page,
      elements: (page.elements || []).filter(element => element.id !== elementId)
    }));
    setSelectedElementId('');
  };

  const duplicateCanvasElement = (pageId, elementId) => {
    const page = pages.find(item => item.id === pageId);
    const element = page?.elements?.find(item => item.id === elementId);
    if (!page || !element) return;
    const copy = {
      ...element,
      id: newId(element.type),
      style: {
        ...element.style,
        x: (Number(element.style?.x) || 0) + 32,
        y: (Number(element.style?.y) || 0) + 32,
        zIndex: (Number(element.style?.zIndex) || 1) + 1
      }
    };
    updatePage(pageId, current => ({ ...current, elements: [...(current.elements || []), copy] }));
    setSelectedElementId(copy.id);
  };

  const shiftCanvasElementLayer = (pageId, elementId, delta) => {
    updateElement(pageId, elementId, element => ({
      ...element,
      style: { ...element.style, zIndex: Math.max(0, (Number(element.style?.zIndex) || 0) + delta) }
    }));
  };

  const uploadCanvasMedia = async (element, file, targetField = 'url') => {
    if (!file || !selectedPage) return;
    setUploadingBlockId(element.id);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || '上传失败');
      updateElement(selectedPage.id, element.id, current => ({
        ...current,
        content: { ...current.content, [targetField]: data.media.url }
      }));
      setMessage(isEnglish ? 'Media uploaded. You can publish directly.' : '媒体已上传，可以直接发布。');
    } catch (error) {
      setMessage(error.message || '上传失败');
    } finally {
      setUploadingBlockId('');
    }
  };

  if (externalEditorDisabled) {
    return (
      <section className="dept-intro-editor dept-intro-editor--external">
        <div className="dept-intro-status">
          {isEnglish ? 'This department introduction editor has been temporarily hidden.' : '该部门介绍编辑器已临时隐藏。'}
        </div>
        <section className="dept-intro-page-section">
          <h2>{getModuleTitle(module, language)}</h2>
          <p>{isEnglish ? 'Open the external showcase site instead.' : '请直接打开外部展示站。'}</p>
          <a href={externalUrl} target="_blank" rel="noreferrer" className="dept-intro-external-link">
            {isEnglish ? 'Open showcase' : '打开展示站'} <ArrowUpRight />
          </a>
        </section>
      </section>
    );
  }

  if (Array.isArray(content.pages) && content.pages.length) {
    const currentPage = selectedPage || content.pages[0];
    const currentElement = selectedElement || null;
    const patchPage = (patch) => currentPage && updatePage(currentPage.id, page => ({ ...page, ...patch }));
    const patchPageStyle = (patch) => currentPage && updatePage(currentPage.id, page => ({ ...page, ...patch }));
    const patchElement = (patch) => currentPage && currentElement && updateElement(currentPage.id, currentElement.id, element => ({ ...element, ...patch }));
    const patchElementContent = (patch) => currentPage && currentElement && updateElement(currentPage.id, currentElement.id, element => ({ ...element, content: { ...element.content, ...patch } }));
    const patchElementStyle = (patch) => currentPage && currentElement && updateElement(currentPage.id, currentElement.id, element => ({ ...element, style: { ...element.style, ...patch } }));
    const uploadCanvasPageBackground = async (file) => {
      if (!file || !currentPage) return;
      setUploadingBlockId(`${currentPage.id}-background`);
      setMessage('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || '上传失败');
        updatePage(currentPage.id, page => ({ ...page, backgroundImageUrl: data.media.url }));
        setMessage(isEnglish ? 'Page background uploaded.' : '页面背景已上传。');
      } catch (error) {
        setMessage(error.message || '上传失败');
      } finally {
        setUploadingBlockId('');
      }
    };
    const uploadCanvasElementBackground = async (file) => {
      if (!file || !currentPage || !currentElement) return;
      setUploadingBlockId(`${currentElement.id}-background`);
      setMessage('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/hub/departments/${module.organization}/${module.key}/introduction/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || '上传失败');
        updateElement(currentPage.id, currentElement.id, element => ({
          ...element,
          style: { ...element.style, backgroundImageUrl: data.media.url }
        }));
        setMessage(isEnglish ? 'Element background uploaded.' : '组件背景已上传。');
      } catch (error) {
        setMessage(error.message || '上传失败');
      } finally {
        setUploadingBlockId('');
      }
    };
    const startCanvasInteraction = (element, event, mode, scale) => {
      if (!currentPage || !element || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedElementId(element.id);
      const startX = event.clientX;
      const startY = event.clientY;
      const baseStyle = element.style || {};
      const baseX = Number(baseStyle.x) || 0;
      const baseY = Number(baseStyle.y) || 0;
      const baseWidth = Number(baseStyle.width) || 100;
      const baseHeight = Number(baseStyle.height) || 100;
      const safeScale = scale || 1;
      const handleMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / safeScale;
        const dy = (moveEvent.clientY - startY) / safeScale;
        updateElement(currentPage.id, element.id, current => ({
          ...current,
          style: {
            ...current.style,
            ...(mode === 'resize'
              ? { width: Math.max(24, Math.round(baseWidth + dx)), height: Math.max(24, Math.round(baseHeight + dy)) }
              : { x: Math.round(baseX + dx), y: Math.round(baseY + dy) })
          }
        }));
      };
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp, { once: true });
    };
    const canvasScale = Math.min(1, 1060 / (currentPage.width || 1440));

    return (
      <section className="dept-intro-editor dept-intro-editor--canvas">
        <div className="dept-intro-editor-topbar">
          <div>
            <p>SIEHUB / INTRODUCTION BUILDER</p>
            <h2>{getModuleTitle(module, language)} / {isEnglish ? 'Canvas editor' : '画布编辑器'}</h2>
            <span>{isEnglish ? 'Drag, resize and restyle page elements like a deck.' : '像编辑 PPT 一样编辑页面、元素、位置和样式。'}</span>
          </div>
          <div>
            <button type="button" onClick={onClose}>{isEnglish ? 'Back to manage portal' : '返回管理端'}</button>
            {(!loaded || conflict) && <button type="button" disabled={loading || saving || publishing} onClick={() => { if (!conflict || window.confirm('重新加载会替换当前未保存内容，确认继续？')) setLoadAttempt(value => value + 1); }}>重新加载</button>}
            <button type="button" onClick={saveDraft} disabled={!loaded || conflict || saving || publishing || Boolean(uploadingBlockId)}><Save />{saving ? (isEnglish ? 'Saving' : '保存中') : (isEnglish ? 'Save draft' : '保存草稿')}</button>
            <button className="primary-button" type="button" onClick={publish} disabled={!loaded || conflict || saving || publishing || Boolean(uploadingBlockId)}><Send />{publishing ? (isEnglish ? 'Publishing' : '发布中') : (isEnglish ? 'Publish' : '发布')}</button>
          </div>
        </div>
        {message && <div className="dept-intro-status">{message}</div>}
        {loading ? <div className="dept-intro-status">{isEnglish ? 'Loading editor...' : '加载编辑器中...'}</div> : (
          <div className="dept-intro-editor-grid dept-intro-editor-grid--canvas">
            <aside className="dept-intro-library">
              <strong>{isEnglish ? 'Pages' : '页面'}</strong>
              <button type="button" onClick={addCanvasPage}><Plus />{isEnglish ? 'New page' : '新增页面'}</button>
              <div className="dept-intro-block-list">
                {content.pages.map(page => (
                  <article key={page.id} className={page.id === currentPage.id && !currentElement ? 'is-active' : ''} onClick={() => { setSelectedPageId(page.id); setSelectedElementId(''); }}>
                    <span>{String(content.pages.indexOf(page) + 1).padStart(2, '0')}</span>
                    <b>{getText(page.title, language) || `Page ${content.pages.indexOf(page) + 1}`}</b>
                    <div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); duplicateCanvasPage(page.id); }}><Copy /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); removeCanvasPage(page.id); }}><Trash2 /></button>
                    </div>
                  </article>
                ))}
              </div>
              <strong>{isEnglish ? 'Elements' : '元素'}</strong>
              <button type="button" onClick={() => addCanvasElement('text')}><Plus />{isEnglish ? 'Text' : '文本框'}</button>
              <button type="button" onClick={() => addCanvasElement('image')}><ImagePlus />{isEnglish ? 'Image' : '图片'}</button>
              <button type="button" onClick={() => addCanvasElement('card')}><Plus />{isEnglish ? 'Card' : '卡片'}</button>
              <button type="button" onClick={() => addCanvasElement('activity')}><Plus />{isEnglish ? 'Activity' : '活动'}</button>
              <button type="button" onClick={() => addCanvasElement('shape')}><Plus />{isEnglish ? 'Shape' : '图形'}</button>
              <div className="dept-intro-block-list">
                {(currentPage.elements || []).map(element => (
                  <article key={element.id} className={element.id === currentElement?.id ? 'is-active' : ''} onClick={() => setSelectedElementId(element.id)}>
                    <span>{element.type.slice(0, 2).toUpperCase()}</span>
                    <b>{getText(element.content?.text || element.content?.title || element.content?.label, language) || element.type}</b>
                    <div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); updateElement(currentPage.id, element.id, current => ({ ...current, visible: !current.visible })); }}><Eye /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); duplicateCanvasElement(currentPage.id, element.id); }}><Copy /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); removeCanvasElement(currentPage.id, element.id); }}><Trash2 /></button>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
            <main className="dept-intro-canvas dept-intro-canvas--deck">
              <div className="dept-intro-canvas-stage">
                <CanvasPagePreview
                  page={currentPage}
                  language={language}
                  scale={canvasScale}
                  selectedElementId={currentElement?.id}
                  onSelectElement={setSelectedElementId}
                  onElementPointerDown={(element, event, mode) => startCanvasInteraction(element, event, mode, canvasScale)}
                />
              </div>
            </main>
            <aside className="dept-intro-side">
              <div className="dept-intro-inspector">
                <div className="dept-intro-inspector-head">
                  <span>{currentElement ? currentElement.type.toUpperCase() : (isEnglish ? 'Page' : '页面')}</span>
                  <button type="button" onClick={() => currentElement && updateElement(currentPage.id, currentElement.id, current => ({ ...current, visible: !current.visible }))}>
                    <Eye />{currentElement?.visible ? (isEnglish ? 'Visible' : '显示') : (isEnglish ? 'Hidden' : '隐藏')}
                  </button>
                </div>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page title' : '页面标题'}</span>
                  <input value={getText(currentPage.title, 'zh')} onChange={event => patchPage({ title: { ...currentPage.title, zh: event.target.value } })} />
                  <input value={getText(currentPage.title, 'en')} onChange={event => patchPage({ title: { ...currentPage.title, en: event.target.value } })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Canvas width' : '画布宽度'}</span>
                  <input type="number" value={currentPage.width || 1440} onChange={event => patchPageStyle({ width: Number(event.target.value) || 1440 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Canvas height' : '画布高度'}</span>
                  <input type="number" value={currentPage.height || 900} onChange={event => patchPageStyle({ height: Number(event.target.value) || 900 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Background' : '背景色'}</span>
                  <input type="color" value={currentPage.backgroundColor || '#f8fafc'} onChange={event => patchPage({ backgroundColor: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Background image' : '背景图片'}</span>
                  <input value={currentPage.backgroundImageUrl || ''} onChange={event => patchPage({ backgroundImageUrl: event.target.value })} />
                </label>
                <label className="dept-intro-upload-button">
                  <UploadCloud />
                  {uploadingBlockId === `${currentPage.id}-background` ? (isEnglish ? 'Uploading...' : '上传中...') : (isEnglish ? 'Upload page background' : '上传页面背景')}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadCanvasPageBackground(event.target.files?.[0])} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page image fit' : '页面背景适配'}</span>
                  <select value={currentPage.backgroundSize || 'cover'} onChange={event => patchPage({ backgroundSize: event.target.value })}>
                    <option value="cover">{isEnglish ? 'Cover' : '铺满'}</option>
                    <option value="contain">{isEnglish ? 'Contain' : '完整显示'}</option>
                    <option value="auto">{isEnglish ? 'Original' : '原始尺寸'}</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page image position' : '页面背景位置'}</span>
                  <input value={currentPage.backgroundPosition || 'center'} onChange={event => patchPage({ backgroundPosition: event.target.value })} placeholder="center / 50% 20%" />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page overlay color' : '页面蒙版颜色'}</span>
                  <input type="color" value={currentPage.overlayColor || '#0f172a'} onChange={event => patchPage({ overlayColor: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page overlay opacity' : '页面蒙版透明度'}</span>
                  <input type="range" min="0" max="0.95" step="0.01" value={currentPage.overlayOpacity ?? 0} onChange={event => patchPage({ overlayOpacity: Number(event.target.value) })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Page transition' : '页面过渡动画'}</span>
                  <select value={currentPage.transition || 'rise'} onChange={event => patchPage({ transition: event.target.value })}>
                    <option value="rise">{isEnglish ? 'Rise' : '上浮'}</option>
                    <option value="fade">{isEnglish ? 'Fade' : '淡入'}</option>
                    <option value="slide">{isEnglish ? 'Slide' : '滑入'}</option>
                    <option value="none">{isEnglish ? 'None' : '无'}</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Selected x' : '位置 X'}</span>
                  <input type="number" value={currentElement?.style?.x || 0} onChange={event => patchElementStyle({ x: Number(event.target.value) || 0 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Selected y' : '位置 Y'}</span>
                  <input type="number" value={currentElement?.style?.y || 0} onChange={event => patchElementStyle({ y: Number(event.target.value) || 0 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Width' : '宽度'}</span>
                  <input type="number" value={currentElement?.style?.width || 300} onChange={event => patchElementStyle({ width: Number(event.target.value) || 300 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Height' : '高度'}</span>
                  <input type="number" value={currentElement?.style?.height || 160} onChange={event => patchElementStyle({ height: Number(event.target.value) || 160 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Rotation' : '旋转角度'}</span>
                  <input type="number" value={currentElement?.style?.rotation || 0} onChange={event => patchElementStyle({ rotation: Number(event.target.value) || 0 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Layer' : '图层顺序'}</span>
                  <input type="number" value={currentElement?.style?.zIndex || 1} onChange={event => patchElementStyle({ zIndex: Number(event.target.value) || 1 })} />
                </label>
                {currentElement && (
                  <div className="dept-intro-inline-actions">
                    <button type="button" onClick={() => duplicateCanvasElement(currentPage.id, currentElement.id)}><Copy />{isEnglish ? 'Duplicate' : '复制'}</button>
                    <button type="button" onClick={() => shiftCanvasElementLayer(currentPage.id, currentElement.id, 1)}>{isEnglish ? 'Layer +' : '上移图层'}</button>
                    <button type="button" onClick={() => shiftCanvasElementLayer(currentPage.id, currentElement.id, -1)}>{isEnglish ? 'Layer -' : '下移图层'}</button>
                  </div>
                )}
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Font family' : '字体'}</span>
                  <select value={currentElement?.style?.fontFamily || 'Noto Sans SC'} onChange={event => patchElementStyle({ fontFamily: event.target.value })}>
                    <option value="Noto Sans SC">Noto Sans SC</option>
                    <option value="Noto Serif SC">Noto Serif SC</option>
                    <option value="Microsoft YaHei">Microsoft YaHei</option>
                    <option value="KaiTi">KaiTi</option>
                    <option value="SimSun">SimSun</option>
                    <option value="Georgia">Georgia</option>
                    <option value="serif">Serif</option>
                    <option value="sans-serif">Sans-serif</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Font size' : '字号'}</span>
                  <input type="number" value={currentElement?.style?.fontSize || 24} onChange={event => patchElementStyle({ fontSize: Number(event.target.value) || 24 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Text color' : '文字颜色'}</span>
                  <input type="color" value={currentElement?.style?.color || '#132033'} onChange={event => patchElementStyle({ color: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Font weight' : '字重'}</span>
                  <input type="number" min="100" max="1000" step="100" value={currentElement?.style?.fontWeight || 700} onChange={event => patchElementStyle({ fontWeight: Number(event.target.value) || 700 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Line height' : '行高'}</span>
                  <input type="number" min="0.8" max="3" step="0.05" value={currentElement?.style?.lineHeight || 1.25} onChange={event => patchElementStyle({ lineHeight: Number(event.target.value) || 1.25 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Text align' : '文字对齐'}</span>
                  <select value={currentElement?.style?.textAlign || 'left'} onChange={event => patchElementStyle({ textAlign: event.target.value })}>
                    <option value="left">{isEnglish ? 'Left' : '左对齐'}</option>
                    <option value="center">{isEnglish ? 'Center' : '居中'}</option>
                    <option value="right">{isEnglish ? 'Right' : '右对齐'}</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Overlay opacity' : '蒙版透明度'}</span>
                  <input type="range" min="0" max="0.95" step="0.01" value={currentElement?.style?.overlayOpacity ?? 0} onChange={event => patchElementStyle({ overlayOpacity: Number(event.target.value) })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Overlay color' : '蒙版颜色'}</span>
                  <input type="color" value={currentElement?.style?.overlayColor || '#0f172a'} onChange={event => patchElementStyle({ overlayColor: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Element background' : '组件背景图'}</span>
                  <input value={currentElement?.style?.backgroundImageUrl || ''} onChange={event => patchElementStyle({ backgroundImageUrl: event.target.value })} />
                </label>
                <label className="dept-intro-upload-button">
                  <UploadCloud />
                  {currentElement && uploadingBlockId === `${currentElement.id}-background` ? (isEnglish ? 'Uploading...' : '上传中...') : (isEnglish ? 'Upload element background' : '上传组件背景')}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadCanvasElementBackground(event.target.files?.[0])} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Background fit' : '组件背景适配'}</span>
                  <select value={currentElement?.style?.backgroundSize || 'cover'} onChange={event => patchElementStyle({ backgroundSize: event.target.value })}>
                    <option value="cover">{isEnglish ? 'Cover' : '铺满'}</option>
                    <option value="contain">{isEnglish ? 'Contain' : '完整显示'}</option>
                    <option value="auto">{isEnglish ? 'Original' : '原始尺寸'}</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Background position' : '组件背景位置'}</span>
                  <input value={currentElement?.style?.backgroundPosition || 'center'} onChange={event => patchElementStyle({ backgroundPosition: event.target.value })} placeholder="center / 50% 20%" />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Background color' : '组件底色'}</span>
                  <input type="color" value={currentElement?.style?.backgroundColor === 'transparent' ? '#ffffff' : (currentElement?.style?.backgroundColor || '#ffffff')} onChange={event => patchElementStyle({ backgroundColor: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Image fit' : '图片适配'}</span>
                  <select value={currentElement?.style?.objectFit || 'cover'} onChange={event => patchElementStyle({ objectFit: event.target.value })}>
                    <option value="cover">{isEnglish ? 'Cover' : '铺满'}</option>
                    <option value="contain">{isEnglish ? 'Contain' : '完整显示'}</option>
                    <option value="fill">{isEnglish ? 'Fill' : '拉伸'}</option>
                  </select>
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Image position' : '图片位置'}</span>
                  <input value={currentElement?.style?.objectPosition || 'center'} onChange={event => patchElementStyle({ objectPosition: event.target.value })} placeholder="center / 50% 20%" />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Opacity' : '透明度'}</span>
                  <input type="range" min="0.05" max="1" step="0.01" value={currentElement?.style?.opacity ?? 1} onChange={event => patchElementStyle({ opacity: Number(event.target.value) })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Radius' : '圆角'}</span>
                  <input type="number" value={currentElement?.style?.borderRadius || 0} onChange={event => patchElementStyle({ borderRadius: Number(event.target.value) || 0 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Padding' : '内边距'}</span>
                  <input type="number" value={currentElement?.style?.padding || 0} onChange={event => patchElementStyle({ padding: Number(event.target.value) || 0 })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Border color' : '边框颜色'}</span>
                  <input type="color" value={currentElement?.style?.borderColor === 'transparent' ? '#ffffff' : (currentElement?.style?.borderColor || '#ffffff')} onChange={event => patchElementStyle({ borderColor: event.target.value })} />
                </label>
                <label className="dept-intro-field">
                  <span>{isEnglish ? 'Border width' : '边框宽度'}</span>
                  <input type="number" min="0" max="16" value={currentElement?.style?.borderWidth || 0} onChange={event => patchElementStyle({ borderWidth: Number(event.target.value) || 0 })} />
                </label>
                {currentElement?.type === 'text' && <FieldPair label={isEnglish ? 'Text' : '文字'} value={currentElement.content?.text} onChange={value => patchElementContent({ text: value })} textarea language={language} />}
                {currentElement?.type === 'card' && (
                  <>
                    <FieldPair label={isEnglish ? 'Title' : '标题'} value={currentElement.content?.title} onChange={value => patchElementContent({ title: value })} language={language} />
                    <FieldPair label={isEnglish ? 'Body' : '正文'} value={currentElement.content?.body} onChange={value => patchElementContent({ body: value })} textarea language={language} />
                  </>
                )}
                {currentElement?.type === 'activity' && (
                  <>
                    <FieldPair label="Kicker" value={currentElement.content?.kicker} onChange={value => patchElementContent({ kicker: value })} language={language} />
                    <FieldPair label={isEnglish ? 'Title' : '标题'} value={currentElement.content?.title} onChange={value => patchElementContent({ title: value })} language={language} />
                    <FieldPair label={isEnglish ? 'Body' : '正文'} value={currentElement.content?.body} onChange={value => patchElementContent({ body: value })} textarea language={language} />
                    <FieldPair label={isEnglish ? 'Date' : '日期'} value={currentElement.content?.date} onChange={value => patchElementContent({ date: value })} language={language} />
                  </>
                )}
                {currentElement?.type === 'image' && (
                  <>
                    <label className="dept-intro-field">
                      <span>{isEnglish ? 'Image URL' : '图片地址'}</span>
                      <input value={currentElement.content?.url || ''} onChange={event => patchElementContent({ url: event.target.value })} />
                    </label>
                    <label className="dept-intro-upload-button">
                      <UploadCloud />
                      {uploadingBlockId === currentElement.id ? (isEnglish ? 'Uploading...' : '上传中...') : (isEnglish ? 'Upload image' : '上传图片')}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadCanvasMedia(currentElement, event.target.files?.[0])} />
                    </label>
                    <FieldPair label={isEnglish ? 'Caption' : '说明'} value={currentElement.content?.title} onChange={value => patchElementContent({ title: value })} language={language} />
                    <FieldPair label={isEnglish ? 'Alt text' : '替代文本'} value={currentElement.content?.alt} onChange={value => patchElementContent({ alt: value })} language={language} />
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>
    );
  }

  const renderInspector = () => {
    if (!selectedBlock) return <div className="dept-intro-editor-empty">{isEnglish ? 'Select a block to edit.' : '选择一个区块后编辑内容。'}</div>;
    const block = selectedBlock;
    const patchData = (patch) => updateBlock(block.id, current => ({ ...current, data: { ...current.data, ...patch } }));
    const renderBackgroundControls = () => (
      <div className="dept-intro-background-editor">
        <label className="dept-intro-field">
          <span>Background image URL</span>
          <input value={block.data.backgroundImageUrl || ''} onChange={event => patchData({ backgroundImageUrl: event.target.value })} placeholder="/uploads/department-intros/image.webp" />
        </label>
        <label className="dept-intro-upload-button">
          <UploadCloud />
          {uploadingBlockId === block.id ? 'Uploading...' : 'Upload background'}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadMedia(block, event.target.files?.[0], 'backgroundImageUrl')} />
        </label>
        <label className="dept-intro-field">
          <span>Overlay opacity</span>
          <input type="range" min="0" max="0.9" step="0.05" value={block.data.overlayOpacity ?? (block.type === 'hero' ? 0.45 : 0.18)} onChange={event => patchData({ overlayOpacity: Number(event.target.value) })} />
        </label>
        <div className="dept-intro-tone-toggle">
          <span>Text tone</span>
          <button type="button" className={(block.data.textTone || (block.type === 'hero' ? 'light' : 'dark')) === 'light' ? 'is-active' : ''} onClick={() => patchData({ textTone: 'light' })}>Light</button>
          <button type="button" className={(block.data.textTone || (block.type === 'hero' ? 'light' : 'dark')) === 'dark' ? 'is-active' : ''} onClick={() => patchData({ textTone: 'dark' })}>Dark</button>
        </div>
      </div>
    );
    return (
      <div className="dept-intro-inspector">
        <div className="dept-intro-inspector-head">
          <span>{block.type.toUpperCase()}</span>
          <button type="button" onClick={() => updateBlock(block.id, current => ({ ...current, visible: !current.visible }))}>
            <Eye />{block.visible ? (isEnglish ? 'Visible' : '显示') : (isEnglish ? 'Hidden' : '隐藏')}
          </button>
        </div>
        {(block.type === 'hero' || block.type === 'text' || block.type === 'image' || block.type === 'video' || block.type === 'duties' || block.type === 'contact') && (
          <FieldPair label={isEnglish ? 'Title' : '标题'} value={block.data.title} onChange={value => patchData({ title: value })} language={language} />
        )}
        {block.type === 'hero' && <FieldPair label={isEnglish ? 'Subtitle' : '副标题'} value={block.data.subtitle} onChange={value => patchData({ subtitle: value })} textarea language={language} />}
        {block.type === 'text' && <FieldPair label={isEnglish ? 'Body' : '正文'} value={block.data.body} onChange={value => patchData({ body: value })} textarea language={language} />}
        {(block.type === 'hero' || block.type === 'text') && renderBackgroundControls()}
        {(block.type === 'image' || block.type === 'video') && (
          <>
            <label className="dept-intro-upload-button">
              <UploadCloud />
              {uploadingBlockId === block.id ? (isEnglish ? 'Uploading...' : '上传中...') : block.type === 'image' ? (isEnglish ? 'Upload image' : '上传图片') : (isEnglish ? 'Upload video' : '上传视频')}
              <input type="file" accept={block.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'} onChange={event => uploadMedia(block, event.target.files?.[0])} />
            </label>
            <FieldPair label={isEnglish ? 'Caption' : '说明'} value={block.data.caption} onChange={value => patchData({ caption: value })} textarea language={language} />
            <FieldPair label={isEnglish ? 'Alt text' : '替代文本'} value={block.data.alt} onChange={value => patchData({ alt: value })} language={language} />
          </>
        )}
        {block.type === 'duties' && (
          <div className="dept-intro-repeat-editor">
            {(block.data.items || []).map((item, index) => (
              <FieldPair key={`${block.id}-duty-${index}`} label={`${isEnglish ? 'Responsibility' : '职责'} ${index + 1}`} value={item} language={language} onChange={value => {
                const next = [...(block.data.items || [])];
                next[index] = value;
                patchData({ items: next });
              }} textarea />
            ))}
            <button type="button" onClick={() => patchData({ items: [...(block.data.items || []), makeLocalized('', '')] })}><Plus />{isEnglish ? 'Add responsibility' : '添加职责'}</button>
          </div>
        )}
        {block.type === 'contact' && (
          <div className="dept-intro-repeat-editor">
            {(block.data.items || []).map((item, index) => (
              <div className="dept-intro-contact-editor" key={`${block.id}-contact-${index}`}>
                <FieldPair label={`${isEnglish ? 'Label' : '标签'} ${index + 1}`} value={item.label} language={language} onChange={value => {
                  const next = [...(block.data.items || [])];
                  next[index] = { ...next[index], label: value };
                  patchData({ items: next });
                }} />
                <FieldPair label={`${isEnglish ? 'Content' : '内容'} ${index + 1}`} value={item.value} language={language} onChange={value => {
                  const next = [...(block.data.items || [])];
                  next[index] = { ...next[index], value };
                  patchData({ items: next });
                }} />
              </div>
            ))}
            <button type="button" onClick={() => patchData({ items: [...(block.data.items || []), { label: makeLocalized('', ''), value: makeLocalized('', '') }] })}><Plus />{isEnglish ? 'Add contact' : '添加联系方式'}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="dept-intro-editor">
      <div className="dept-intro-editor-topbar">
        <div>
          <p>SIEHUB / INTRODUCTION BUILDER</p>
          <h2>{getModuleTitle(module, language)} · {isEnglish ? 'Department intro editor' : '部门介绍编辑'}</h2>
          <span>{isEnglish ? 'Draft version' : '草稿版本'} {intro?.draftVersion || 0} · {isEnglish ? 'Published version' : '已发布版本'} {intro?.publishedVersion || 0}</span>
        </div>
        <div>
          <button type="button" onClick={onClose}>{isEnglish ? 'Back to manage portal' : '返回管理端'}</button>
            {(!loaded || conflict) && <button type="button" disabled={loading || saving || publishing} onClick={() => { if (!conflict || window.confirm('重新加载会替换当前未保存内容，确认继续？')) setLoadAttempt(value => value + 1); }}>重新加载</button>}
          <button type="button" onClick={saveDraft} disabled={!loaded || conflict || saving || publishing || Boolean(uploadingBlockId)}><Save />{saving ? (isEnglish ? 'Saving' : '保存中') : (isEnglish ? 'Save draft' : '保存草稿')}</button>
          <button className="primary-button" type="button" onClick={publish} disabled={!loaded || conflict || saving || publishing || Boolean(uploadingBlockId)}><Send />{publishing ? (isEnglish ? 'Publishing' : '发布中') : (isEnglish ? 'Publish' : '发布')}</button>
        </div>
      </div>
      {message && <div className="dept-intro-status">{message}</div>}
      {loading ? <div className="dept-intro-status">{isEnglish ? 'Loading editor...' : '加载编辑器中...'}</div> : (
        <div className="dept-intro-editor-grid">
          <aside className="dept-intro-library">
            <strong>{isEnglish ? 'Block library' : '组件库'}</strong>
            <button type="button" onClick={() => addBlock('hero')}><Plus />{isEnglish ? 'Hero cover' : '顶部封面'}</button>
            <button type="button" onClick={() => addBlock('text')}><Plus />{isEnglish ? 'Text section' : '文本介绍'}</button>
            <button type="button" onClick={() => addBlock('image')}><ImagePlus />{isEnglish ? 'Image block' : '图片展示'}</button>
            <button type="button" onClick={() => addBlock('video')}><Video />{isEnglish ? 'Video block' : '视频展示'}</button>
            <button type="button" onClick={() => addBlock('duties')}><Plus />{isEnglish ? 'Responsibilities' : '部门职责'}</button>
            <button type="button" onClick={() => addBlock('contact')}><Plus />{isEnglish ? 'Contact' : '联系方式'}</button>
            <strong>{isEnglish ? 'Block order' : '区块顺序'}</strong>
            <div className="dept-intro-block-list">
              {blocks.map((block, index) => (
                <article key={block.id} className={block.id === selectedBlock?.id ? 'is-active' : ''} onClick={() => setSelectedId(block.id)}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <b>{getText(block.data?.title, language) || block.type}</b>
                  <div>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, -1); }} disabled={index === 0}><ChevronUp /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, 1); }} disabled={index === blocks.length - 1}><ChevronDown /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }}><Trash2 /></button>
                  </div>
                </article>
              ))}
            </div>
          </aside>
          <main className="dept-intro-canvas">
            {(content.blocks || []).map(block => <BlockPreview key={block.id} block={block} language={language} />)}
          </main>
          <aside className="dept-intro-side">
            {renderInspector()}
            <div className="dept-intro-revisions">
              <strong>{isEnglish ? 'Publish history' : '发布记录'}</strong>
              {revisions.length ? revisions.map(item => (
                <article key={item.id}>
                  <span>v{item.version}</span>
                  <p>{new Date(item.createdAt).toLocaleString()}</p>
                </article>
              )) : <p>{isEnglish ? 'No publish history yet' : '暂无发布记录'}</p>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};


export const DepartmentIntroductionEntryCard = ({ onOpen, module }) => (
  <button className="siehub-student-service-entry dept-intro-entry" type="button" onClick={onOpen}>
    <span>01</span>
    <SquarePen />
    <strong>部门介绍</strong>
    <p>{module?.summary || '查看该部门职责介绍、成员风采、服务流程与联系方式。'}</p>
    <b>查看介绍 <ArrowUpRight /></b>
  </button>
);
