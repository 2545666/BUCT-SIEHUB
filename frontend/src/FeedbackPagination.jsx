import React from 'react';

export default function FeedbackPagination({ pagination, onPageChange, loading = false }) {
  if (!pagination?.pages || pagination.pages <= 1) return null;
  return <nav className="feedback-pagination" aria-label="反馈列表分页">
    <button type="button" disabled={loading || pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>上一页</button>
    <span>第 {pagination.page} / {pagination.pages} 页 · 共 {pagination.total} 条</span>
    <button type="button" disabled={loading || pagination.page >= pagination.pages} onClick={() => onPageChange(pagination.page + 1)}>下一页</button>
  </nav>;
}
