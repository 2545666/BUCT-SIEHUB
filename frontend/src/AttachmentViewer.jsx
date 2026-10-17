import React, { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { API_BASE, readStoredToken, resolveApiAssetUrl } from './api';

const ProtectedAttachment = ({ file }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const path = file.path || '';
  const isImage = file.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(path);
  const isVideo = file.mimetype?.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(path);

  useEffect(() => {
    const controller = new AbortController();
    let blobUrl = '';
    setUrl('');
    setError('');
    const load = async () => {
      try {
        const source = resolveApiAssetUrl(path);
        const apiOrigin = new URL(API_BASE, window.location.href).origin;
        if (new URL(source, window.location.href).origin !== apiOrigin) throw new Error('附件地址无效');
        const res = await fetch(source, { headers: { Authorization: `Bearer ${readStoredToken()}` }, signal: controller.signal });
        if (!res.ok) throw new Error('附件暂时无法读取，请刷新重试');
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(blob);
        setUrl(blobUrl);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      }
    };
    load();
    return () => { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [path]);

  if (error) return <span className="attachment-error" role="status">{file.filename || '附件'}：{error}</span>;
  if (!url) return <span className="attachment-loading">正在读取{file.filename || '附件'}…</span>;
  if (isImage) return <a href={url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}><img src={url} alt={file.filename || '附件'} /></a>;
  if (isVideo) return <video src={url} controls preload="metadata" onClick={event => event.stopPropagation()} />;
  return <a href={url} download={file.filename || '附件'} onClick={event => event.stopPropagation()}><Paperclip />{file.filename || '附件'}</a>;
};

export default function AttachmentViewer({ attachments = [] }) {
  if (!attachments.length) return null;
  return <div className="attachment-strip">{attachments.map((file, index) => <ProtectedAttachment key={`${file.path}-${index}`} file={file} />)}</div>;
}
