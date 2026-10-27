import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from './api';

const CHINA_TIME_ZONE = 'Asia/Shanghai';

const getChinaDate = (value = new Date()) => new Date(value.toLocaleString('en-US', { timeZone: CHINA_TIME_ZONE }));

const pad2 = (value) => String(value).padStart(2, '0');

const getGreetingText = (hour, language = 'zh') => {
  const isEnglish = language === 'en';
  if (hour >= 5 && hour < 9) return isEnglish ? 'Good morning' : '早上好';
  if (hour >= 9 && hour < 12) return isEnglish ? 'Good morning' : '上午好';
  if (hour >= 12 && hour < 14) return isEnglish ? 'Good afternoon' : '中午好';
  if (hour >= 14 && hour < 18) return isEnglish ? 'Good afternoon' : '下午好';
  if (hour >= 18 && hour < 23) return isEnglish ? 'Good evening' : '晚上好';
  return isEnglish ? 'Still awake' : '夜深了';
};

const formatClockDate = (now, language = 'zh') => {
  if (language === 'en') {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: CHINA_TIME_ZONE,
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    }).format(now).replace(',', ' ·').toUpperCase();
  }
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    weekday: 'short',
    month: 'long',
    day: 'numeric'
  }).format(now);
};

export const usePlatformClock = (language = 'zh') => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => {
    const chinaNow = getChinaDate(now);
    const hour = chinaNow.getHours();
    return {
      hour,
      greeting: getGreetingText(hour, language),
      dateLabel: formatClockDate(now, language),
      timeLabel: `${pad2(chinaNow.getHours())}:${pad2(chinaNow.getMinutes())}`,
      timezoneLabel: language === 'en' ? 'Beijing time' : '北京时间'
    };
  }, [language, now]);
};

export const useServiceMetrics = (token) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setMetrics(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/service-metrics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'service metrics failed');
      setMetrics(data.metrics || null);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { metrics, loading, error, refresh };
};

export const formatAverageFirstResponse = (metrics, language = 'zh') => {
  const hours = metrics?.averageFirstResponseHours;
  if (!Number.isFinite(hours)) return language === 'en' ? 'No data' : '暂无数据';
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return language === 'en' ? `${minutes} min` : `${minutes} 分钟`;
  }
  const value = hours < 10 ? hours.toFixed(1) : Math.round(hours).toString();
  return language === 'en' ? `${value} h` : `${value} 小时`;
};

export const ServiceHealthNote = ({ metrics, loading, error, language = 'zh' }) => {
  const isEnglish = language === 'en';
  const hasData = Number.isFinite(metrics?.averageFirstResponseHours);
  const statusText = error
    ? (isEnglish ? 'Metric sync paused' : '指标同步中断')
    : (loading && !metrics ? (isEnglish ? 'Syncing metrics' : '指标同步中') : (isEnglish ? 'Feedback channel online' : '反馈通道正常'));
  const sampleText = metrics
    ? (isEnglish
      ? `${metrics.respondedFeedbackCount || 0} measured / ${metrics.feedbackCount || 0} total`
      : `${metrics.respondedFeedbackCount || 0} 条已计入 / 共 ${metrics.feedbackCount || 0} 条`)
    : (isEnglish ? 'Loading data' : '正在加载数据');

  return (
    <div className="service-note">
      <div className="service-note-head">
        <span className="live-dot"></span>
        <span>{statusText}</span>
      </div>
      <strong>{formatAverageFirstResponse(metrics, language)}</strong>
      <p>{isEnglish ? 'Avg. first response this semester' : '本学期平均首次响应'}</p>
      <small className="service-note-meta">{hasData ? sampleText : (isEnglish ? 'No valid first response yet' : '暂无有效首次响应样本')}</small>
    </div>
  );
};
