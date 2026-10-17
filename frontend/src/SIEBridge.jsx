import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  BookOpen, Check, Clock3, Download, Eye, FileText,
  Filter, Folder, FolderOpen, Plus, Search, Send, Trash2, Upload, X
} from 'lucide-react';
import { API_BASE } from './api';
import siebridgeLogo from './assets/SIEBridge_LOGO.png';
import { getSieBridgeEntityId, shouldApplyCourseDetailResponse } from './siebridgeSelection';
import { isMarkdownFile, isPlainTextFile } from './siebridgeFileType';
import './siebridge.css';

const STATUS_META = {
  pending: { label: '待审核', tone: 'pending' },
  approved: { label: '已通过', tone: 'approved' },
  rejected: { label: '已驳回', tone: 'rejected' }
};

const DEFAULT_SECTIONS = [
  { key: 'past_exams', label: '往年真题' },
  { key: 'courseware', label: '课件' },
  { key: 'notes', label: '笔记整理' },
  { key: 'other', label: '其他资料' }
];

const formatFileSize = (size = 0) => {
  if (!size) return '未知大小';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const joinLabels = (items = []) => items.length ? items.join(' / ') : '未分类';
const getSectionLabel = (section) => DEFAULT_SECTIONS.find(item => item.key === section)?.label || '其他资料';
const formatReceiptDate = (value) => value
  ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
  : '暂无日期';

const RECEIPT_PAGE_WIDTH = 1240;
const RECEIPT_PAGE_HEIGHT = 1754;
const RECEIPT_MARGIN = 96;
const RECEIPT_ISSUER = '北京化工大学国际教育学院学术科技部';
const RECEIPT_ISSUER_LINES = ['北京化工大学国际教育学院', '学术科技部'];
const RECEIPT_FONT_FAMILY = '"方正大标宋简体", "Source Han Serif SC", "Noto Serif SC", "Songti SC", Georgia, serif';
const receiptFont = (weight, size) => `${weight} ${size}px ${RECEIPT_FONT_FAMILY}`;

const loadReceiptImage = (() => {
  let promise = null;
  return () => {
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (error) => {
          promise = null;
          reject(error);
        };
        img.src = siebridgeLogo;
      });
    }
    return promise;
  };
})();

const wrapCanvasText = (ctx, text, maxWidth) => {
  const source = String(text || '');
  if (!source) return [''];
  const lines = [];
  let current = '';
  for (const char of source) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const renderReceiptPdfBlob = async (receipt) => {
  const files = receipt?.files || [];
  const width = RECEIPT_PAGE_WIDTH;
  const height = RECEIPT_PAGE_HEIGHT;
  const pages = [];
  let watermark = null;

  try {
    watermark = await loadReceiptImage();
  } catch {
    watermark = null;
  }

  const createPage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法生成上传凭证');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (watermark) {
      const wmWidth = width * 0.96;
      const wmHeight = wmWidth * (watermark.naturalHeight / watermark.naturalWidth || 1);
      const wmX = (width - wmWidth) / 2;
      const wmY = Math.max(110, (height - wmHeight) / 2);
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.drawImage(watermark, wmX, wmY, wmWidth, wmHeight);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#0f4c81';
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, width - 72, height - 72);
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    pages.push({ canvas, ctx });
    return ctx;
  };

  let ctx = createPage();

  ctx.fillStyle = '#0f172a';
  ctx.font = receiptFont(900, 38);
  ctx.fillText('上传凭证', RECEIPT_MARGIN, 86);
  ctx.font = receiptFont(700, 16);
  ctx.fillStyle = '#2563eb';
  ctx.fillText('SIEBridge Upload Certificate', RECEIPT_MARGIN, 136);

  ctx.fillStyle = '#0f172a';
  ctx.font = receiptFont(700, 24);
  ctx.fillText(receipt.courseName || '课程资料上传凭证', RECEIPT_MARGIN, 210);

  const labelFont = receiptFont(700, 18);
  const valueFont = receiptFont(500, 22);
  const labelColor = '#475569';
  const valueColor = '#0f172a';
  const rightX = 620;
  let leftY = 310;
  let rightY = 310;
  let contentY = 0;
  const leftFieldWidth = 470;
  const rightFieldWidth = 470;
  const contentBottom = height - 140;
  const signatureTop = height - 260;

  const drawField = (x, y, label, value, maxWidth) => {
    ctx.fillStyle = labelColor;
    ctx.font = labelFont;
    ctx.fillText(label, x, y);
    ctx.fillStyle = valueColor;
    ctx.font = valueFont;
    const lines = wrapCanvasText(ctx, value || '未填写', maxWidth);
    lines.forEach((line, index) => ctx.fillText(line, x, y + 30 + index * 30));
    return y + 30 + lines.length * 30 + 18;
  };

  const drawContentHeading = (label = '上传内容') => {
    ctx.fillStyle = labelColor;
    ctx.font = labelFont;
    ctx.fillText(label, RECEIPT_MARGIN, contentY);
    contentY += 34;
  };

  const ensureContentSpace = (blockHeight) => {
    if (contentY + blockHeight <= contentBottom) return;
    ctx = createPage();
    contentY = 110;
    drawContentHeading('上传内容（续）');
  };

  const drawSignature = () => {
    const footerY = height - 260;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(RECEIPT_MARGIN, footerY);
    ctx.lineTo(width - RECEIPT_MARGIN, footerY);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.font = receiptFont(700, 22);
    ctx.fillText(RECEIPT_ISSUER_LINES[0], width - RECEIPT_MARGIN, footerY + 28);
    ctx.fillText(RECEIPT_ISSUER_LINES[1], width - RECEIPT_MARGIN, footerY + 66);
    ctx.font = receiptFont(500, 18);
    ctx.fillText(formatReceiptDate(receipt.issuedAt || receipt.createdAt), width - RECEIPT_MARGIN, footerY + 106);
    ctx.textAlign = 'left';
  };

  leftY = drawField(RECEIPT_MARGIN, leftY, '姓名', receipt.uploaderName, leftFieldWidth);
  leftY = drawField(RECEIPT_MARGIN, leftY, '上传者学号', receipt.uploaderStudentId, leftFieldWidth);
  rightY = drawField(rightX, rightY, '上传课程信息', [receipt.courseCode, receipt.courseName, receipt.courseNature].filter(Boolean).join(' · '), rightFieldWidth);
  rightY = drawField(rightX, rightY, '上传日期', formatReceiptDate(receipt.uploadedAt), rightFieldWidth);

  contentY = Math.max(leftY, rightY) + 18;
  drawContentHeading();

  ctx.fillStyle = valueColor;
  ctx.font = valueFont;
  if (files.length) {
    files.forEach((file, index) => {
      const content = `${file.typeLabel || receipt.sectionLabel || '资料'} · ${file.relativePath || file.name || 'resource-file'}`;
      const lines = wrapCanvasText(ctx, content, width - RECEIPT_MARGIN * 2 - 12);
      lines.forEach((line, lineIndex) => {
        ensureContentSpace(28 + (lineIndex === lines.length - 1 ? 18 : 0));
        ctx.font = valueFont;
        if (lineIndex === 0) {
          ctx.fillStyle = '#1d4ed8';
          ctx.fillText(`${index + 1}.`, RECEIPT_MARGIN, contentY);
        }
        ctx.fillStyle = valueColor;
        ctx.fillText(line, RECEIPT_MARGIN + 40, contentY);
        contentY += 28;
      });
      contentY += 18;
    });
  } else {
    ensureContentSpace(34);
    ctx.font = valueFont;
    ctx.fillStyle = valueColor;
    ctx.fillText('暂无文件记录', RECEIPT_MARGIN, contentY);
    contentY += 34;
  }

  if (contentY > signatureTop - 24) {
    ctx = createPage();
  }
  drawSignature();

  pages.forEach(({ ctx: pageCtx }, index) => {
    pageCtx.fillStyle = '#64748b';
    pageCtx.textAlign = 'center';
    pageCtx.font = receiptFont(500, 16);
    pageCtx.fillText(`第 ${index + 1} / ${pages.length} 页`, width / 2, height - 92);
    pageCtx.textAlign = 'left';
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pages.forEach(({ canvas }, index) => {
    if (index) pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas, 'PNG', 0, 0, pdfWidth, pdfHeight);
  });
  return pdf.output('blob');
};

const getEntityId = getSieBridgeEntityId;
const isPdfFile = (file = {}) => String(file.extension || '').toLowerCase() === '.pdf' || file.mimetype === 'application/pdf';
const isPreviewableFile = (file = {}) => isPdfFile(file) || isMarkdownFile(file) || isPlainTextFile(file);
const getFilePath = (file = {}) => file.webkitRelativePath || file.relativePath || file.originalName || file.filename || file.name || '';
const getFileName = (file = {}) => file.originalName || file.filename || file.name || getFilePath(file).split('/').pop() || 'resource-file';

const appendFilesToBody = (body, files = []) => {
  body.append('filePaths', JSON.stringify(files.map(file => file.webkitRelativePath || file.relativePath || file.name)));
  files.forEach(file => body.append('files', file));
};

const getFilesTotalSize = (files = []) => files.reduce((sum, file) => sum + Number(file.size || 0), 0);

const validateUploadFiles = (files = [], meta = {}) => {
  const maxFileSize = Number(meta.maxFileSize || 200 * 1024 * 1024);
  const maxFileCount = Number(meta.maxFileCount || 100);
  if (files.length > maxFileCount) return `单次最多上传 ${maxFileCount} 个文件，请分批上传`;
  const oversized = files.find(file => Number(file.size || 0) > maxFileSize);
  if (oversized) return `「${getFilePath(oversized) || oversized.name}」超过 ${formatFileSize(maxFileSize)}，请压缩后上传`;
  return '';
};

const buildFileTree = (files = []) => {
  const root = { folders: new Map(), files: [] };
  files.forEach((file, index) => {
    const parts = getFilePath(file).split('/').filter(Boolean);
    if (!parts.length) {
      root.files.push({ ...file, index });
      return;
    }
    const fileName = parts.pop();
    let cursor = root;
    parts.forEach(part => {
      if (!cursor.folders.has(part)) cursor.folders.set(part, { name: part, folders: new Map(), files: [] });
      cursor = cursor.folders.get(part);
    });
    cursor.files.push({ ...file, index, originalName: file.originalName || fileName });
  });
  return root;
};

const hashText = (value = '') => {
  let hash = 0;
  String(value).split('').forEach(char => {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  });
  return Math.abs(hash).toString(36);
};

const parseTableRow = (line = '') => line
  .trim()
  .replace(/^\|/, '')
  .replace(/\|$/, '')
  .split('|')
  .map(cell => cell.trim());

const parseTableAlignments = (line = '') => parseTableRow(line).map(cell => {
  const value = cell.trim();
  if (/^:-+:$/.test(value)) return 'center';
  if (/^-+:$/.test(value)) return 'right';
  return 'left';
});

const isMarkdownTableSeparator = (line = '') => {
  const cells = parseTableRow(line);
  return cells.length > 1 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
};

const isMarkdownTableStart = (lines = [], index = 0) => (
  /\|/.test(lines[index] || '') && isMarkdownTableSeparator(lines[index + 1] || '')
);

const MermaidDiagram = ({ content = '', id }) => {
  const [result, setResult] = useState({ status: 'loading', svg: '' });

  useEffect(() => {
    let active = true;
    setResult({ status: 'loading', svg: '' });
    import('mermaid')
      .then(module => {
        const mermaid = module.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default'
        });
        return mermaid.render(`siebridge-mermaid-${id}-${hashText(content)}`, content);
      })
      .then(({ svg }) => {
        if (active) setResult({ status: 'ready', svg });
      })
      .catch(() => {
        if (active) setResult({ status: 'error', svg: '' });
      });
    return () => { active = false; };
  }, [content, id]);

  if (result.status === 'loading') return <div className="siebridge-mermaid-state">正在渲染 Mermaid 图表...</div>;
  if (result.status === 'error') return <pre className="siebridge-mermaid-error"><code>{content}</code></pre>;
  return <div className="siebridge-mermaid-diagram" dangerouslySetInnerHTML={{ __html: result.svg }} />;
};

const MarkdownRenderer = ({ content = '' }) => {
  const blocks = [];
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = /^```([A-Za-z0-9_-]+)?\s*$/.exec(line);
    if (fence) {
      const codeLines = [];
      const language = (fence[1] || '').toLowerCase();
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push({ type: language === 'mermaid' ? 'mermaid' : 'code', language, content: codeLines.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] });
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push({ type: 'quote', content: quoteLines.join('\n') });
      continue;
    }
    if (isMarkdownTableStart(lines, index)) {
      const headers = parseTableRow(lines[index]);
      const alignments = parseTableAlignments(lines[index + 1]);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && /\|/.test(lines[index])) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, alignments, rows });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, ''));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,4})\s+/.test(lines[index]) && !lines[index].startsWith('```') && !isMarkdownTableStart(lines, index) && !/^[-*]\s+/.test(lines[index]) && !/^\d+\.\s+/.test(lines[index]) && !/^>\s?/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', content: paragraph.join('\n') });
  }

  if (!blocks.length) return <p className="siebridge-muted">该 Markdown 文件暂无可渲染内容。</p>;

  return (
    <div className="siebridge-markdown-body">
      {blocks.map((block, blockIndex) => {
        const key = `${block.type}-${blockIndex}`;
        if (block.type === 'heading') {
          const Tag = `h${Math.min(block.level + 1, 5)}`;
          return <Tag key={key}>{block.content}</Tag>;
        }
        if (block.type === 'code') return <pre key={key}><code>{block.content}</code></pre>;
        if (block.type === 'mermaid') return <MermaidDiagram key={key} id={key} content={block.content} />;
        if (block.type === 'quote') return <blockquote key={key}>{block.content}</blockquote>;
        if (block.type === 'table') {
          return (
            <div className="siebridge-markdown-table-wrap" key={key}>
              <table>
                <thead>
                  <tr>{block.headers.map((cell, cellIndex) => <th key={`${key}-h-${cellIndex}`} style={{ textAlign: block.alignments[cellIndex] || 'left' }}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-r-${rowIndex}`}>
                      {block.headers.map((_, cellIndex) => <td key={`${key}-r-${rowIndex}-${cellIndex}`} style={{ textAlign: block.alignments[cellIndex] || 'left' }}>{row[cellIndex] || ''}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return <ListTag key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{item}</li>)}</ListTag>;
        }
        return <p key={key}>{block.content}</p>;
      })}
    </div>
  );
};

const SIEBridgePreviewDialog = ({ preview, onClose }) => {
  if (!preview) return null;
  return (
    <div className="siebridge-preview">
      <dialog open className={preview.type === 'markdown' || preview.type === 'text' ? 'markdown-preview' : ''}>
        <header>
          <strong>{preview.title}</strong>
          <button className="icon-button" type="button" onClick={onClose}><X /></button>
        </header>
        {preview.type === 'markdown' ? (
          <MarkdownRenderer content={preview.content} />
        ) : preview.type === 'text' ? <pre className="siebridge-markdown-body" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.content}</pre> : (
          <iframe src={preview.url} title={preview.title}></iframe>
        )}
      </dialog>
    </div>
  );
};
const apiJson = async (path, token, options = {}) => {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok || !data.success) {
    if (res.status === 413) throw new Error('上传文件过大，请压缩后重试或减少单次上传文件数量');
    if (res.status >= 500) throw new Error(data.message || '服务器暂时无法处理，请稍后重试');
    throw new Error(data.message || '请求失败，请检查网络后重试');
  }
  return data;
};

const uploadSieBridgeForm = (path, token, body, { onProgress } = {}) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE}${path}`);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.timeout = 20 * 60 * 1000;

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable || !onProgress) return;
    const uploaded = event.loaded >= event.total;
    onProgress({
      phase: uploaded ? 'processing' : 'uploading',
      loaded: event.loaded,
      total: event.total,
      percent: uploaded ? 99 : Math.min(98, Math.round((event.loaded / event.total) * 100))
    });
  };

  xhr.onload = () => {
    const contentType = xhr.getResponseHeader('content-type') || '';
    const data = contentType.includes('application/json')
      ? (() => { try { return JSON.parse(xhr.responseText || '{}'); } catch { return {}; } })()
      : {};
    if (xhr.status >= 200 && xhr.status < 300 && data.success) {
      onProgress?.({ phase: 'done', loaded: 1, total: 1, percent: 100 });
      resolve(data);
      return;
    }
    if (xhr.status === 413) {
      reject(new Error(data.message || '上传文件过大，请压缩后重试或减少单次上传文件数量'));
      return;
    }
    if (xhr.status >= 500) {
      reject(new Error(data.message || '服务器暂时无法处理，请稍后重试'));
      return;
    }
    reject(new Error(data.message || '上传失败，请检查网络后重试'));
  };

  xhr.onerror = () => reject(new Error('上传连接中断，请检查网络后重试'));
  xhr.ontimeout = () => reject(new Error('上传耗时过长，请减少单次文件数量后重试'));
  xhr.onloadend = () => {
    if (xhr.status >= 200 && xhr.status < 300) return;
    onProgress?.(null);
  };

  onProgress?.({ phase: 'uploading', loaded: 0, total: 0, percent: 0 });
  xhr.send(body);
});

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return <span className={`siebridge-status ${meta.tone}`}>{meta.label}</span>;
};

const FileSelectionSummary = ({ files }) => {
  if (!files.length) return null;
  return (
    <ul className="siebridge-file-list" aria-label="已选择文件">
      {files.map((file, index) => (
        <li key={`${getFilePath(file)}-${file.size}-${index}`}>
          <FileText />
          <span title={getFilePath(file)}>{getFilePath(file)}</span>
          <em>{formatFileSize(file.size)}</em>
        </li>
      ))}
    </ul>
  );
};

const FileTreeNode = ({
  node,
  path = '',
  openFolders,
  onToggleFolder,
  onPreview,
  onDownload,
  onDelete,
  isDeletingFile,
  selectable = false,
  selectedFileIndexes = [],
  onToggleSelect
}) => {
  const folders = Array.from(node.folders.entries()).sort(([a], [b]) => a.localeCompare(b));
  const files = [...node.files].sort((a, b) => getFilePath(a).localeCompare(getFilePath(b)));
  const selectedIndexSet = new Set(selectedFileIndexes);

  return (
    <div className="siebridge-file-tree-level">
      {folders.map(([name, folder]) => {
        const folderPath = path ? `${path}/${name}` : name;
        const isOpen = openFolders.has(folderPath);
        return (
          <div className="siebridge-folder-node" key={folderPath}>
            <button type="button" className="siebridge-folder-button" onClick={() => onToggleFolder(folderPath)}>
              {isOpen ? <FolderOpen /> : <Folder />}
              <span>{name}</span>
            </button>
            {isOpen && (
              <FileTreeNode
                node={folder}
                path={folderPath}
                openFolders={openFolders}
                onToggleFolder={onToggleFolder}
                onPreview={onPreview}
                onDownload={onDownload}
                onDelete={onDelete}
                isDeletingFile={isDeletingFile}
                selectable={selectable}
                selectedFileIndexes={selectedFileIndexes}
                onToggleSelect={onToggleSelect}
              />
            )}
          </div>
        );
      })}
      {files.map(file => {
        const previewable = isPreviewableFile(file);
        const fileIndex = Number.isInteger(file.index) ? file.index : 0;
        return (
          <div className={`siebridge-file-node${selectable ? ' has-select' : ''}`} key={`${getFilePath(file)}-${file.index}`}>
            {selectable && (
              <label className="siebridge-file-select" title="选择文件">
                <input
                  type="checkbox"
                  checked={selectedIndexSet.has(fileIndex)}
                  onChange={() => onToggleSelect?.(file)}
                />
              </label>
            )}
            <FileText />
            <span title={getFilePath(file)}>{getFileName(file)}</span>
            <em>{formatFileSize(file.size)}</em>
            {previewable && <button type="button" title={isMarkdownFile(file) ? '渲染 Markdown' : isPlainTextFile(file) ? '预览文本' : '预览 PDF'} onClick={() => onPreview(file)}><Eye /></button>}
            <button type="button" title="下载文件" onClick={() => onDownload(file)}><Download /></button>
            {onDelete && <button type="button" className="danger" title="删除文件" disabled={isDeletingFile?.(file)} onClick={() => onDelete(file)}><Trash2 /></button>}
          </div>
        );
      })}
    </div>
  );
};

const ResourceFileBrowser = ({
  resource,
  onPreview,
  onDownload,
  onDelete,
  deletingFileKey,
  selectable = false,
  selectedFileIndexes = [],
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchDelete,
  isBatchDeleting = false
}) => {
  const files = resource.files || [];
  const [openFolders, setOpenFolders] = useState(() => {
    const firstPath = getFilePath(files[0] || {});
    const folders = firstPath.split('/').filter(Boolean).slice(0, -1);
    return new Set(folders.map((_, index) => folders.slice(0, index + 1).join('/')));
  });
  const tree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (folderPath) => {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  if (!files.length) return <span>暂无文件</span>;

  return (
    <div className="siebridge-resource-browser">
      <div className="siebridge-resource-browser-head">
        <strong>{resource.title}</strong>
        <span>{files.length > 1 ? `${files.length} 个文件` : `${getFileName(files[0])} · ${formatFileSize(files[0].size)}`}</span>
      </div>
      {selectable && (
        <div className="siebridge-file-batchbar">
          <span>已选 {selectedFileIndexes.length} 个</span>
          <button type="button" onClick={onSelectAll}>全选</button>
          <button type="button" onClick={onClearSelection} disabled={!selectedFileIndexes.length}>清空</button>
          <button
            type="button"
            className="danger"
            disabled={!selectedFileIndexes.length || isBatchDeleting}
            onClick={onBatchDelete}
          >
            <Trash2 />{isBatchDeleting ? '删除中' : '批量删除'}
          </button>
        </div>
      )}
      <FileTreeNode
        node={tree}
        openFolders={openFolders}
        onToggleFolder={toggleFolder}
        onPreview={(file) => onPreview(resource, file)}
        onDownload={(file) => onDownload(resource, file)}
        onDelete={onDelete ? (file) => onDelete(resource, file) : null}
        isDeletingFile={(file) => deletingFileKey === `${resource.id || resource._id}-${file.index}`}
        selectable={selectable}
        selectedFileIndexes={selectedFileIndexes}
        onToggleSelect={(file) => onToggleSelect?.(resource, file)}
      />
    </div>
  );
};

const SIEBridgeUploadPicker = ({ files, onChange, title, maxFileSize, maxFileCount }) => {
  const applySelection = (fileList) => onChange(Array.from(fileList || []));
  return (
    <div className="siebridge-upload-group">
      <label className="siebridge-upload">
        <Upload />
        <div>
          <strong>{files.length ? `已选择 ${files.length} 个文件` : title}</strong>
          <p>支持上传单个文件、多个文件或整个文件夹，单个不超过 {formatFileSize(maxFileSize || 200 * 1024 * 1024)}，单次最多 {maxFileCount || 100} 个文件，文件夹内部层级会保留</p>
          <FileSelectionSummary files={files} />
        </div>
        <input type="file" multiple onChange={e => applySelection(e.target.files)} />
      </label>
      <label className="siebridge-folder-upload">
        <Folder />
        <span>选择文件夹</span>
        <input type="file" multiple webkitdirectory="true" directory="true" onChange={e => applySelection(e.target.files)} />
      </label>
    </div>
  );
};

const UploadProgress = ({ progress }) => {
  if (!progress) return null;
  const percent = Math.max(0, Math.min(100, Number(progress.percent || 0)));
  const label = progress.phase === 'processing'
    ? '文件已上传，服务器正在整理资料...'
    : progress.phase === 'done'
      ? '上传完成'
      : `正在上传 ${percent}%`;
  return (
    <div className="siebridge-upload-progress" aria-live="polite">
      <div><span style={{ width: `${percent}%` }} /></div>
      <p>{label}{progress.total ? ` · ${formatFileSize(progress.loaded)} / ${formatFileSize(progress.total)}` : ''}</p>
    </div>
  );
};

const getSubmitLabel = (submitting, uploadProgress) => {
  if (!submitting) return '提交审核';
  if (uploadProgress?.phase === 'processing') return '服务器处理中...';
  if (uploadProgress?.phase === 'uploading') return `上传中 ${uploadProgress.percent || 0}%`;
  return '提交中...';
};

const CourseForm = ({ meta, onClose, onSubmit, submitting, error, uploadProgress, initialCourse }) => {
  const [form, setForm] = useState({
    code: '',
    name: '',
    courseNature: '',
    majors: [],
    gradeLevels: [],
    section: 'past_exams',
    title: '',
    description: '',
    ...(initialCourse ? { code: initialCourse.code, name: initialCourse.name, courseNature: initialCourse.courseNature, majors: initialCourse.majors || [], gradeLevels: initialCourse.gradeLevels || [] } : {})
  });
  const [files, setFiles] = useState([]);

  const toggle = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form, files);
  };

  return (
    <div className="siebridge-drawer">
      <form className="siebridge-panel" onSubmit={submit}>
        <header className="siebridge-panel-head">
          <div><span>NEW COURSE</span><h3>{initialCourse ? '修改并重新提交课程' : '添加课程并上传资料'}</h3></div>
          <button type="button" className="icon-button" onClick={onClose}><X /></button>
        </header>
        <div className="siebridge-form-grid">
          <label><span>课程代码</span><input value={form.code} readOnly={Boolean(initialCourse)} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="如 MECH101" required /></label>
          <label><span>课程名称</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="请输入课程名称" required /></label>
          <label><span>课程性质</span><input value={form.courseNature} onChange={e => setForm({ ...form, courseNature: e.target.value })} placeholder="上传者自行填写，如专业必修/公共选修" required /></label>
          <label><span>资料标题</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如 2024 春季期末真题" required /></label>
        </div>
        <div className="siebridge-choice-row">
          <strong>所属专业</strong>
          {(meta.majors || []).map(item => <button key={item} type="button" className={form.majors.includes(item) ? 'is-active' : ''} onClick={() => toggle('majors', item)}>{item}</button>)}
        </div>
        <div className="siebridge-choice-row compact">
          <strong>适用年级</strong>
          {(meta.gradeLevels || []).map(item => <button key={item} type="button" className={form.gradeLevels.includes(item) ? 'is-active' : ''} onClick={() => toggle('gradeLevels', item)}>{item}</button>)}
        </div>
        <div className="siebridge-choice-row compact">
          <strong>资料分区</strong>
          {(meta.sections || DEFAULT_SECTIONS).map(item => <button key={item.key} type="button" className={form.section === item.key ? 'is-active' : ''} onClick={() => setForm({ ...form, section: item.key })}>{item.label}</button>)}
        </div>
        <label className="siebridge-wide-field"><span>说明</span><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="可补充课程教师、考试年份、资料来源说明等" /></label>
        <SIEBridgeUploadPicker files={files} onChange={setFiles} title="上传课程资料" maxFileSize={meta.maxFileSize} maxFileCount={meta.maxFileCount} />
        <UploadProgress progress={uploadProgress} />
        {error && <div className="siebridge-form-error">{error}</div>}
        <footer><button type="button" className="text-button" onClick={onClose} disabled={submitting}>取消</button><button className="primary-button" disabled={submitting} type="submit">{getSubmitLabel(submitting, uploadProgress)} <Send /></button></footer>
      </form>
    </div>
  );
};

const ResourceForm = ({ course, meta, onClose, onSubmit, submitting, error, uploadProgress }) => {
  const [form, setForm] = useState({ section: 'past_exams', title: '', description: '' });
  const [files, setFiles] = useState([]);
  const submit = (event) => {
    event.preventDefault();
    onSubmit(course.id || course._id, form, files);
  };
  return (
    <div className="siebridge-drawer">
      <form className="siebridge-panel small" onSubmit={submit}>
        <header className="siebridge-panel-head">
          <div><span>UPLOAD RESOURCE</span><h3>{course.name}</h3></div>
          <button type="button" className="icon-button" onClick={onClose}><X /></button>
        </header>
        <div className="siebridge-choice-row compact">
          <strong>资料分区</strong>
          {(meta.sections || DEFAULT_SECTIONS).map(item => <button key={item.key} type="button" className={form.section === item.key ? 'is-active' : ''} onClick={() => setForm({ ...form, section: item.key })}>{item.label}</button>)}
        </div>
        <label><span>资料标题</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="请输入资料标题" required /></label>
        <label className="siebridge-wide-field"><span>说明</span><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="可补充年份、版本、适用范围等" /></label>
        <SIEBridgeUploadPicker files={files} onChange={setFiles} title="选择资料文件" maxFileSize={meta.maxFileSize} maxFileCount={meta.maxFileCount} />
        <UploadProgress progress={uploadProgress} />
        {error && <div className="siebridge-form-error">{error}</div>}
        <footer><button type="button" className="text-button" onClick={onClose} disabled={submitting}>取消</button><button className="primary-button" disabled={submitting} type="submit">{getSubmitLabel(submitting, uploadProgress)} <Send /></button></footer>
      </form>
    </div>
  );
};

const getReceiptId = (receipt = {}) => String(receipt.id || receipt._id || '');

const SIEBridgeReceiptCard = ({ receipt, onDownloadPdf }) => {
  if (!receipt) return <p className="siebridge-muted">暂无上传凭证</p>;
  return (
    <article className="siebridge-receipt-card">
      <img className="siebridge-receipt-watermark" src={siebridgeLogo} alt="" aria-hidden="true" />
      <header>
        <span>SIEBRIDGE UPLOAD CERTIFICATE</span>
        <h3>上传凭证</h3>
      </header>
      <dl>
        <div><dt>姓名</dt><dd>{receipt.uploaderName || '未填写'}</dd></div>
        <div><dt>上传者学号</dt><dd>{receipt.uploaderStudentId || '未填写'}</dd></div>
        <div><dt>上传课程信息</dt><dd>{[receipt.courseCode, receipt.courseName, receipt.courseNature].filter(Boolean).join(' · ') || '未填写'}</dd></div>
        <div><dt>上传日期</dt><dd>{formatReceiptDate(receipt.uploadedAt)}</dd></div>
        <div className="wide"><dt>上传内容</dt><dd>{(receipt.files || []).length ? (
          <ul>
            {receipt.files.map((file, index) => (
              <li key={`${file.relativePath || file.name}-${index}`}>
                <strong>{file.typeLabel || receipt.sectionLabel || '资料'}</strong>
                <span>{file.relativePath || file.name}</span>
              </li>
            ))}
          </ul>
        ) : '暂无文件记录'}</dd></div>
      </dl>
      <footer>
        <strong>{receipt.issuer || '北京化工大学国际教育学院学术科技部'}</strong>
        <time>{formatReceiptDate(receipt.issuedAt || receipt.createdAt)}</time>
      </footer>
      <div className="siebridge-receipt-actions">
        <button type="button" className="primary-button" onClick={() => onDownloadPdf?.(receipt)}><Download />下载 PDF</button>
      </div>
    </article>
  );
};

const SIEBridgeReceiptPrompt = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="siebridge-receipt-prompt">
      <dialog open>
        <header><FileText /><h3>感谢您的分享，审核通过后请领取您的上传凭证</h3></header>
        <p>资料已进入审核队列，审核通过后会自动生成凭证并保存在 SIEBridge「我的」中。</p>
        <footer>
          <button type="button" className="primary-button" onClick={onClose}>我知道了</button>
        </footer>
      </dialog>
    </div>
  );
};

const SIEBridgeMyWindow = ({
  submissions,
  receipts,
  selectedReceiptId,
  onSelectReceipt,
  onClose,
  onPreview,
  onDownload,
  onDownloadPdf,
  onResubmitCourse,
  onDeleteResource,
  deletingResourceId
}) => {
  const uploadItems = useMemo(() => (submissions.resources || [])
    .map(item => ({
      ...item,
      kind: '资料',
      sectionLabel: getSectionLabel(item.section),
      courseName: item.course?.name,
      courseCode: item.course?.code
    }))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)), [submissions.resources]);
  const [activeUploadId, setActiveUploadId] = useState('');
  const activeUpload = uploadItems.find(item => getEntityId(item) === activeUploadId) || uploadItems[0] || null;
  const activeReceipt = receipts.find(item => getReceiptId(item) === selectedReceiptId) || receipts[0] || null;

  useEffect(() => {
    if (!uploadItems.length) return;
    if (!activeUploadId || !uploadItems.some(item => getEntityId(item) === activeUploadId)) {
      setActiveUploadId(getEntityId(uploadItems[0]));
    }
  }, [activeUploadId, uploadItems]);

  useEffect(() => {
    if (!selectedReceiptId && receipts[0]) onSelectReceipt(getReceiptId(receipts[0]));
  }, [onSelectReceipt, receipts, selectedReceiptId]);

  return (
    <div className="siebridge-drawer siebridge-my-window">
      <section className="siebridge-panel wide">
        <header className="siebridge-panel-head">
          <div><span>MY SIEBRIDGE</span><h3>我的</h3></div>
          <button type="button" className="icon-button" onClick={onClose}><X /></button>
        </header>
        <div className="siebridge-my-grid">
          <section className="siebridge-my-block">
            <header><div><p>MY COURSES</p><h4>我的课程申请</h4></div><BookOpen /></header>
            {(submissions.courses || []).map(course => <article key={getEntityId(course)}><strong>{course.code} · {course.name}</strong><StatusBadge status={course.status} />{course.reviewComment && <p>{course.reviewComment}</p>}{course.status === 'rejected' && <button type="button" onClick={() => onResubmitCourse(course)}>修改并重新提交</button>}</article>)}
          </section>
          <section className="siebridge-my-block">
            <header><div><p>MY UPLOADS</p><h4>我的上传资料</h4></div><Clock3 /></header>
            <div className="siebridge-my-list">
              {uploadItems.length ? uploadItems.map(item => (
                <button key={getEntityId(item)} type="button" className={getEntityId(activeUpload) === getEntityId(item) ? 'is-active' : ''} onClick={() => setActiveUploadId(getEntityId(item))}>
                  <span>{item.kind}</span>
                  <strong>{item.title}</strong>
                  <small>{[item.courseCode, item.courseName].filter(Boolean).join(' · ')}</small>
                  <StatusBadge status={item.status} />
                </button>
              )) : <p className="siebridge-muted">暂无上传资料</p>}
            </div>
            {activeUpload && (
              <div className="siebridge-upload-detail">
                <h5>{activeUpload.title}</h5>
                <p>{[activeUpload.courseCode, activeUpload.courseName, activeUpload.sectionLabel].filter(Boolean).join(' · ')}</p>
                <ResourceFileBrowser resource={activeUpload} onPreview={onPreview} onDownload={onDownload} />
                {['pending', 'rejected'].includes(activeUpload.status) && <button type="button" disabled={deletingResourceId === getEntityId(activeUpload)} onClick={() => onDeleteResource(activeUpload)}><Trash2 />删除我的资料</button>}
              </div>
            )}
          </section>
          <section className="siebridge-my-block">
            <header><div><p>UPLOAD CERTIFICATES</p><h4>我的上传凭证</h4></div><FileText /></header>
            <div className="siebridge-my-list receipts">
              {receipts.length ? receipts.map(receipt => (
                <button key={getReceiptId(receipt)} type="button" className={getReceiptId(activeReceipt) === getReceiptId(receipt) ? 'is-active' : ''} onClick={() => onSelectReceipt(getReceiptId(receipt))}>
                  <span>{formatReceiptDate(receipt.uploadedAt)}</span>
                  <strong>{receipt.courseName || receipt.resourceTitle || '上传凭证'}</strong>
                  <small>{(receipt.files || []).length} 个文件 · {receipt.sectionLabel || '资料'}</small>
                </button>
              )) : <p className="siebridge-muted">暂无上传凭证</p>}
            </div>
            <SIEBridgeReceiptCard receipt={activeReceipt} onDownloadPdf={onDownloadPdf} />
          </section>
        </div>
      </section>
    </div>
  );
};

export const SIEBridgeStudentPortal = ({ token }) => {
  const [meta, setMeta] = useState({ majors: [], gradeLevels: [], sections: DEFAULT_SECTIONS });
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [resources, setResources] = useState([]);
  const [submissions, setSubmissions] = useState({ courses: [], resources: [] });
  const [receipts, setReceipts] = useState([]);
  const [filters, setFilters] = useState({ search: '', major: '', grade: '' });
  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [resourceFormCourse, setResourceFormCourse] = useState(null);
  const [myWindowOpen, setMyWindowOpen] = useState(false);
  const [resubmissionCourse, setResubmissionCourse] = useState(null);
  const [deletingResourceId, setDeletingResourceId] = useState('');
  const [receiptPromptOpen, setReceiptPromptOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');
  const detailRequestRef = useRef(0);
  const detailAbortRef = useRef(null);

  const loadMeta = useCallback(async () => {
    const data = await apiJson('/siebridge/meta', token);
    setMeta({
      majors: data.majors || [],
      gradeLevels: data.gradeLevels || [],
      sections: data.sections || DEFAULT_SECTIONS,
      maxFileSize: data.maxFileSize,
      maxFileCount: data.maxFileCount
    });
  }, [token]);

  const loadCourses = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.search.trim()) params.set('search', filters.search.trim());
    if (filters.major) params.set('major', filters.major);
    if (filters.grade) params.set('grade', filters.grade);
    const data = await apiJson(`/siebridge/courses?${params.toString()}`, token);
    setCourses(data.courses || []);
  }, [filters, token]);

  const loadSubmissions = useCallback(async () => {
    const data = await apiJson('/siebridge/submissions/mine', token);
    setSubmissions({ courses: data.courses || [], resources: data.resources || [] });
  }, [token]);

  const loadReceipts = useCallback(async () => {
    const data = await apiJson('/siebridge/receipts/mine', token);
    setReceipts(data.receipts || []);
  }, [token]);

  const loadCourseDetail = useCallback(async (course) => {
    const courseId = typeof course === 'string' ? course : getEntityId(course);
    if (!courseId) return;
    if (detailAbortRef.current) detailAbortRef.current.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    const summary = typeof course === 'string'
      ? courses.find(item => getEntityId(item) === courseId)
      : course;
    setSelectedCourseId(courseId);
    setSelectedCourse(summary || null);
    setResources([]);
    setDetailLoading(true);
    try {
      const data = await apiJson(`/siebridge/courses/${courseId}`, token, { signal: controller.signal });
      if (!shouldApplyCourseDetailResponse({
        requestId,
        activeRequestId: detailRequestRef.current,
        requestedCourseId: courseId,
        responseCourse: data.course
      })) return;
      setSelectedCourseId(getEntityId(data.course) || courseId);
      setSelectedCourse(data.course || summary || null);
      setResources(data.resources || []);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (detailRequestRef.current === requestId) setMessage(error.message);
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
        detailAbortRef.current = null;
      }
    }
  }, [courses, token]);

  useEffect(() => { loadMeta().catch(error => setMessage(error.message)); }, [loadMeta]);
  useEffect(() => { loadCourses().catch(error => setMessage(error.message)); }, [loadCourses]);
  useEffect(() => { loadSubmissions().catch(() => {}); }, [loadSubmissions]);
  useEffect(() => { loadReceipts().catch(() => {}); }, [loadReceipts]);
  useEffect(() => {
    if (!selectedCourseId) return;
    if (courses.length && courses.every(course => getEntityId(course) !== selectedCourseId)) {
      setSelectedCourseId('');
      setSelectedCourse(null);
      setResources([]);
    }
  }, [courses, selectedCourseId]);

  const groupedResources = useMemo(() => {
    const groups = Object.fromEntries((meta.sections || DEFAULT_SECTIONS).map(item => [item.key, []]));
    resources.forEach(item => { (groups[item.section] ||= []).push(item); });
    return groups;
  }, [meta.sections, resources]);

  const openMyWindow = useCallback(async () => {
    setMyWindowOpen(true);
    await Promise.all([loadSubmissions(), loadReceipts()]).catch(() => {});
  }, [loadReceipts, loadSubmissions]);

  const submitCourse = async (form, files) => {
    if (!files.length) return setMessage('请上传至少一份课程资料');
    const validationMessage = validateUploadFiles(files, meta);
    if (validationMessage) return setMessage(validationMessage);
    setSubmitting(true);
    setMessage('');
    setUploadProgress({ phase: 'uploading', loaded: 0, total: getFilesTotalSize(files), percent: 0 });
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, Array.isArray(value) ? JSON.stringify(value) : value));
      appendFilesToBody(body, files);
      await uploadSieBridgeForm('/siebridge/courses', token, body, {
        onProgress: (progress) => setUploadProgress(progress ? {
          ...progress,
          total: progress.total || getFilesTotalSize(files)
        } : null)
      });
      setCourseFormOpen(false);
      setMessage('课程与资料已提交审核');
      setReceiptPromptOpen(true);
      await Promise.all([loadCourses(), loadSubmissions()]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const submitResource = async (courseId, form, files) => {
    if (!files.length) return setMessage('请上传至少一份资料');
    const validationMessage = validateUploadFiles(files, meta);
    if (validationMessage) return setMessage(validationMessage);
    setSubmitting(true);
    setMessage('');
    setUploadProgress({ phase: 'uploading', loaded: 0, total: getFilesTotalSize(files), percent: 0 });
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      appendFilesToBody(body, files);
      await uploadSieBridgeForm(`/siebridge/courses/${courseId}/resources`, token, body, {
        onProgress: (progress) => setUploadProgress(progress ? {
          ...progress,
          total: progress.total || getFilesTotalSize(files)
        } : null)
      });
      setResourceFormCourse(null);
      setMessage('资料已提交审核');
      setReceiptPromptOpen(true);
      await Promise.all([loadCourseDetail(courseId), loadSubmissions()]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const openPreview = async (resource, selectedFile) => {
    try {
      const file = selectedFile || resource.files?.[0] || {};
      const fileIndex = Number.isInteger(file.index) ? file.index : 0;
      const res = await fetch(`${API_BASE}/siebridge/resources/${resource.id || resource._id}/preview?file=${fileIndex}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('该资料暂不支持在线预览');
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const contentType = res.headers.get('content-type') || '';
      if (isMarkdownFile(file) || /markdown|text\/plain/i.test(contentType)) {
        setPreview({ title: `${resource.title} / ${getFileName(file)}`, type: isMarkdownFile(file) || /markdown/i.test(contentType) ? 'markdown' : 'text', content: await res.text() });
        return;
      }
      const blob = await res.blob();
      setPreview({ title: `${resource.title} / ${getFileName(file)}`, type: 'pdf', url: URL.createObjectURL(blob) });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const downloadResource = async (resource, selectedFile) => {
    try {
      const file = selectedFile || resource.files?.[0] || {};
      const fileIndex = Number.isInteger(file.index) ? file.index : 0;
      const res = await fetch(`${API_BASE}/siebridge/resources/${resource.id || resource._id}/download?file=${fileIndex}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName(file) || `${resource.title}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const downloadReceiptPdf = useCallback(async (receipt) => {
    try {
      const blob = await renderReceiptPdfBlob(receipt);
      const url = URL.createObjectURL(blob);
      const safeName = String(`${receipt.courseCode || 'SIEBridge'}-${receipt.courseName || receipt.resourceTitle || 'upload-receipt'}`)
        .replace(/[\\/:*?"<>|]/g, '_');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeName}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  }, []);

  const submissionItems = [
    ...submissions.courses.map(item => ({ ...item, kind: '课程' })),
    ...submissions.resources.map(item => ({ ...item, kind: '资料', courseName: item.course?.name }))
  ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const resubmitCourse = course => { setResubmissionCourse(course); setCourseFormOpen(true); setMyWindowOpen(false); };
  const deleteOwnResource = async resource => {
    if (deletingResourceId) return;
    const confirmation = window.prompt(`请输入资料标题确认删除：\n${resource.title}`);
    if (confirmation?.trim() !== resource.title) return;
    setDeletingResourceId(getEntityId(resource));
    try {
      await apiJson(`/siebridge/resources/${getEntityId(resource)}`, token, { method: 'DELETE', body: JSON.stringify({ confirmation: confirmation.trim() }) });
      setMessage('资料已删除');
      await loadSubmissions();
    } catch (error) { setMessage(error.message); }
    finally { setDeletingResourceId(''); }
  };

  return (
    <section className="siebridge-shell">
      <div className="siebridge-toolbar">
        <div>
          <p>SIEBRIDGE RESOURCE PLATFORM</p>
          <h2>SIEBridge 课程资源共享平台</h2>
        </div>
        <div className="siebridge-toolbar-actions">
          <button className="outline-button" type="button" onClick={openMyWindow}><FileText />我的</button>
          <button className="primary-button" type="button" onClick={() => { setResubmissionCourse(null); setCourseFormOpen(true); }}><Plus />添加课程</button>
        </div>
      </div>
      <div className="siebridge-searchbar">
        <label><Search /><input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="输入课程代码或课程名称" /></label>
        <select value={filters.major} onChange={e => setFilters({ ...filters, major: e.target.value })}><option value="">全部专业</option>{meta.majors.map(item => <option key={item}>{item}</option>)}</select>
        <select value={filters.grade} onChange={e => setFilters({ ...filters, grade: e.target.value })}><option value="">全部年级</option>{meta.gradeLevels.map(item => <option key={item}>{item}</option>)}</select>
      </div>
      {message && <div className="siebridge-message">{message}<button type="button" onClick={() => setMessage('')}><X /></button></div>}
      <div className="siebridge-layout">
        <div className="siebridge-course-list">
          {courses.length ? courses.map(course => (
            <button key={getEntityId(course)} className={selectedCourseId === getEntityId(course) ? 'is-active' : ''} type="button" onClick={() => loadCourseDetail(course)}>
              <span>{course.code}</span>
              <strong>{course.name}</strong>
              <small>{course.courseNature} · {joinLabels(course.majors)} · {joinLabels(course.gradeLevels)}</small>
            </button>
          )) : <div className="siebridge-empty"><BookOpen /><strong>暂无课程</strong><span>可以添加课程并提交资料等待审核。</span></div>}
        </div>
        <div className="siebridge-course-detail" key={selectedCourseId || 'empty-course'}>
          {selectedCourse ? (
            <>
              <header>
                <div><span>{selectedCourse.code}</span><h3>{selectedCourse.name}</h3><p>{selectedCourse.courseNature} · {joinLabels(selectedCourse.majors)} · {joinLabels(selectedCourse.gradeLevels)}</p></div>
                <button className="outline-button" type="button" onClick={() => setResourceFormCourse(selectedCourse)}><Upload />上传资料</button>
              </header>
              {detailLoading && <p className="siebridge-muted">正在加载课程资料...</p>}
              {(meta.sections || DEFAULT_SECTIONS).map(section => (
                <section key={section.key} className="siebridge-resource-section">
                  <h4>{section.label}</h4>
                  {(groupedResources[section.key] || []).length ? groupedResources[section.key].map(resource => (
                    <article key={resource.id || resource._id}>
                      <ResourceFileBrowser resource={resource} onPreview={openPreview} onDownload={downloadResource} />
                    </article>
                  )) : <p className="siebridge-muted">暂无已通过资料</p>}
                </section>
              ))}
            </>
          ) : <div className="siebridge-empty large"><Filter /><strong>选择一门课程</strong><span>课程资料会按往年真题、课件、笔记整理分区展示。</span></div>}
        </div>
      </div>
      <section className="siebridge-submissions">
        <header><div><p>MY SUBMISSIONS</p><h3>我的上传审核情况</h3></div><Clock3 /></header>
        <div>{submissionItems.length ? submissionItems.map(item => <article key={`${item.kind}-${item.id || item._id}`}><span>{item.kind}</span><strong>{item.name || item.title}</strong><small>{item.courseName || item.code || ''}</small><StatusBadge status={item.status} />{item.reviewComment && <em>{item.reviewComment}</em>}{item.kind === '课程' && item.status === 'rejected' && <button type="button" onClick={() => resubmitCourse(item)}>修改并重新提交</button>}{item.kind === '资料' && ['pending', 'rejected'].includes(item.status) && <button type="button" disabled={Boolean(deletingResourceId)} onClick={() => deleteOwnResource(item)}><Trash2 />删除</button>}</article>) : <p className="siebridge-muted">暂无提交记录</p>}</div>
      </section>
      {courseFormOpen && <CourseForm initialCourse={resubmissionCourse} meta={meta} onClose={() => setCourseFormOpen(false)} onSubmit={submitCourse} submitting={submitting} error={message} uploadProgress={uploadProgress} />}
      {resourceFormCourse && <ResourceForm course={resourceFormCourse} meta={meta} onClose={() => setResourceFormCourse(null)} onSubmit={submitResource} submitting={submitting} error={message} uploadProgress={uploadProgress} />}
      <SIEBridgeReceiptPrompt open={receiptPromptOpen} onClose={() => setReceiptPromptOpen(false)} />
      {myWindowOpen && (
        <SIEBridgeMyWindow
          onResubmitCourse={resubmitCourse}
          onDeleteResource={deleteOwnResource}
          deletingResourceId={deletingResourceId}
          submissions={submissions}
          receipts={receipts}
          selectedReceiptId={selectedReceiptId}
          onSelectReceipt={setSelectedReceiptId}
          onClose={() => setMyWindowOpen(false)}
          onPreview={openPreview}
          onDownload={downloadResource}
          onDownloadPdf={downloadReceiptPdf}
        />
      )}
      <SIEBridgePreviewDialog preview={preview} onClose={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }} />
    </section>
  );
};

export const SIEBridgeReviewWorkspace = ({ token }) => {
  const [status, setStatus] = useState('pending');
  const [courses, setCourses] = useState([]);
  const [resources, setResources] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [deletingResourceId, setDeletingResourceId] = useState('');
  const [deletingFileKey, setDeletingFileKey] = useState('');
  const [batchDeletingResourceId, setBatchDeletingResourceId] = useState('');
  const [selectedResourceFiles, setSelectedResourceFiles] = useState({});

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson(`/siebridge/reviews?status=${status}`, token);
      setCourses(data.courses || []);
      setResources(data.resources || []);
      setMessage('');
    } catch (error) {
      setMessage(error.message);
      setCourses([]);
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [status, token]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const review = async (type, id, nextStatus) => {
    const reviewComment = nextStatus === 'rejected' ? window.prompt('请输入驳回原因') : '';
    if (nextStatus === 'rejected' && !reviewComment) return;
    try {
      await apiJson(`/siebridge/reviews/${type}/${id}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, reviewComment })
      });
      await loadReviews();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const openPreview = async (resource, selectedFile) => {
    try {
      const file = selectedFile || resource.files?.[0] || {};
      const fileIndex = Number.isInteger(file.index) ? file.index : 0;
      const res = await fetch(`${API_BASE}/siebridge/resources/${resource.id || resource._id}/preview?file=${fileIndex}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('该资料暂不支持在线预览');
      if (preview?.url) URL.revokeObjectURL(preview.url);
      const contentType = res.headers.get('content-type') || '';
      if (isMarkdownFile(file) || contentType.includes('markdown') || contentType.includes('text/plain')) {
        setPreview({ title: `${resource.title} / ${getFileName(file)}`, type: isMarkdownFile(file) || contentType.includes('markdown') ? 'markdown' : 'text', content: await res.text() });
        return;
      }
      const blob = await res.blob();
      setPreview({ title: `${resource.title} / ${getFileName(file)}`, type: 'pdf', url: URL.createObjectURL(blob) });
    } catch (error) {
      setMessage(error.message);
    }
  };

  const downloadResource = async (resource, selectedFile) => {
    try {
      const file = selectedFile || resource.files?.[0] || {};
      const fileIndex = Number.isInteger(file.index) ? file.index : 0;
      const res = await fetch(`${API_BASE}/siebridge/resources/${resource.id || resource._id}/download?file=${fileIndex}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName(file) || resource.title;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const deleteApprovedResource = async (resource) => {
    const resourceId = resource.id || resource._id;
    const confirmation = window.prompt(`危险操作：删除资料会同时移除后台文件，且不可恢复。\n\n请输入资料标题或“确认删除”以继续：\n${resource.title}`);
    if (!confirmation) return;
    setDeletingResourceId(resourceId);
    try {
      await apiJson(`/siebridge/resources/${resourceId}`, token, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: confirmation.trim() })
      });
      setMessage('资料已删除');
      await loadReviews();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDeletingResourceId('');
    }
  };

  const deleteApprovedResourceFile = async (resource, file) => {
    const resourceId = resource.id || resource._id;
    const fileIndex = Number.isInteger(file.index) ? file.index : 0;
    const fileName = getFilePath(file) || getFileName(file);
    const confirmation = window.prompt(`危险操作：只删除当前文件，不会删除这条资料记录中的其他文件。\n\n请输入文件名或“确认删除”以继续：\n${fileName}`);
    if (!confirmation) return;
    const deleteKey = `${resourceId}-${fileIndex}`;
    setDeletingFileKey(deleteKey);
    try {
      await apiJson(`/siebridge/resources/${resourceId}/files/${fileIndex}`, token, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation: confirmation.trim() })
      });
      setMessage('文件已删除');
      await loadReviews();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDeletingFileKey('');
    }
  };

  const getSelectedFileIndexes = (resource) => selectedResourceFiles[resource.id || resource._id] || [];

  const toggleSelectedResourceFile = (resource, file) => {
    const resourceId = resource.id || resource._id;
    const fileIndex = Number.isInteger(file.index) ? file.index : 0;
    setSelectedResourceFiles(prev => {
      const selected = new Set(prev[resourceId] || []);
      if (selected.has(fileIndex)) selected.delete(fileIndex);
      else selected.add(fileIndex);
      return { ...prev, [resourceId]: Array.from(selected).sort((a, b) => a - b) };
    });
  };

  const selectAllResourceFiles = (resource) => {
    const resourceId = resource.id || resource._id;
    const fileIndexes = (resource.files || []).map((_, index) => index);
    setSelectedResourceFiles(prev => ({ ...prev, [resourceId]: fileIndexes }));
  };

  const clearSelectedResourceFiles = (resource) => {
    const resourceId = resource.id || resource._id;
    setSelectedResourceFiles(prev => ({ ...prev, [resourceId]: [] }));
  };

  const batchDeleteApprovedResourceFiles = async (resource) => {
    const resourceId = resource.id || resource._id;
    const fileIndexes = getSelectedFileIndexes(resource);
    if (!fileIndexes.length) {
      setMessage('请先选择要删除的文件');
      return;
    }
    if ((resource.files || []).length - fileIndexes.length < 1) {
      setMessage('不能批量删除全部文件，请使用整条资料删除');
      return;
    }
    const confirmation = window.prompt(`危险操作：将删除当前资料中已选的 ${fileIndexes.length} 个文件，且不可恢复。\n\n请输入“确认删除”以继续。`);
    if (!confirmation) return;
    setBatchDeletingResourceId(resourceId);
    try {
      await apiJson(`/siebridge/resources/${resourceId}/files`, token, {
        method: 'DELETE',
        body: JSON.stringify({ fileIndexes, confirmation: confirmation.trim() })
      });
      setSelectedResourceFiles(prev => ({ ...prev, [resourceId]: [] }));
      setMessage(`已删除 ${fileIndexes.length} 个文件`);
      await loadReviews();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBatchDeletingResourceId('');
    }
  };

  const reviewItems = [
    ...courses.map(item => ({ ...item, type: 'course', kind: '课程申请' })),
    ...resources.map(item => ({ ...item, type: 'resource', kind: '资料申请', courseName: item.course?.name }))
  ];

  return (
    <section className="siebridge-review">
      <header className="siebridge-toolbar">
        <div><p>SIEBRIDGE REVIEW</p><h2>课程资源审核工作台</h2></div>
        <div className="siebridge-review-tabs">
          {['pending', 'approved', 'rejected'].map(item => <button key={item} type="button" className={status === item ? 'is-active' : ''} onClick={() => setStatus(item)}>{STATUS_META[item].label}</button>)}
        </div>
      </header>
      {message && <div className="siebridge-message">{message}</div>}
      <div className="siebridge-review-list">
        {loading ? <p className="siebridge-muted">正在加载审核队列…</p> : reviewItems.length ? reviewItems.map(item => (
          <article key={`${item.type}-${item.id || item._id}`}>
            <div><span>{item.kind}</span><strong>{item.name || item.title}</strong><small>{item.courseName || item.code || ''} · {item.submittedBy?.name || '未知上传者'}</small></div>
            <StatusBadge status={item.status} />
            {item.reviewComment && <p>{item.reviewComment}</p>}
            {item.type === 'resource' && (
              <div className="siebridge-review-files">
                <ResourceFileBrowser
                  resource={item}
                  onPreview={openPreview}
                  onDownload={downloadResource}
                  onDelete={status === 'approved' ? deleteApprovedResourceFile : null}
                  deletingFileKey={deletingFileKey}
                  selectable={status === 'approved'}
                  selectedFileIndexes={getSelectedFileIndexes(item)}
                  onToggleSelect={toggleSelectedResourceFile}
                  onSelectAll={() => selectAllResourceFiles(item)}
                  onClearSelection={() => clearSelectedResourceFiles(item)}
                  onBatchDelete={() => batchDeleteApprovedResourceFiles(item)}
                  isBatchDeleting={batchDeletingResourceId === (item.id || item._id)}
                />
                <button type="button" className="danger" disabled={deletingResourceId === (item.id || item._id)} onClick={() => deleteApprovedResource(item)}><Trash2 />{deletingResourceId === (item.id || item._id) ? '删除中' : '删除'}</button>
              </div>
            )}
            {status === 'pending' && <footer><button type="button" onClick={() => review(item.type, item.id || item._id, 'approved')}><Check />通过</button><button type="button" className="danger" onClick={() => review(item.type, item.id || item._id, 'rejected')}><X />驳回</button></footer>}
          </article>
        )) : <div className="siebridge-empty"><Clock3 /><strong>暂无记录</strong><span>当前筛选下没有需要显示的审核项。</span></div>}
      </div>
      <SIEBridgePreviewDialog preview={preview} onClose={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }} />
    </section>
  );
};
