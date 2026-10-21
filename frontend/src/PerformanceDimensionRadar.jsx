import React from 'react';

export const dimensionsFromMonthlyScore = score => (score?.standardSnapshot?.dims || []).map(dimension => ({
  name: dimension.name,
  score: Number(score.dimensionScores?.[dimension.name] || 0),
  max: Number(dimension.max || 0)
}));

export default function PerformanceDimensionRadar({ dimensions = [], label = '绩效维度' }) {
  if (!dimensions.length) return <p className="siehub-empty-text">尚无逐项评分数据。</p>;
  const center = 150, radius = 86;
  const point = (index, ratio, distance = radius) => {
    const angle = index * Math.PI * 2 / dimensions.length - Math.PI / 2;
    return [center + Math.cos(angle) * distance * ratio, center + Math.sin(angle) * distance * ratio];
  };
  const polygon = ratio => dimensions.map((_, index) => point(index, ratio).join(',')).join(' ');
  const values = dimensions.map((item, index) => point(index, item.max > 0 ? Math.min(1, Math.max(0, item.score / item.max)) : 0).join(',')).join(' ');
  return <div className="performance-dimension-radar">
    {dimensions.length >= 3 && <svg viewBox="0 0 300 300" role="img" aria-label={`${label}雷达图`}>
      <title>{label}雷达图</title>
      {[0.25, 0.5, 0.75, 1].map(level => <polygon key={level} points={polygon(level)} className="performance-dimension-grid" />)}
      {dimensions.map((_, index) => <line key={index} x1={center} y1={center} x2={point(index, 1)[0]} y2={point(index, 1)[1]} className="performance-dimension-axis" />)}
      <polygon points={values} className="performance-dimension-value" />
      {dimensions.map((item, index) => {
        const [x, y] = point(index, 1, radius + 35);
        return <text key={index} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{item.name}</text>;
      })}
    </svg>}
    <div className="performance-dimension-values">
      {dimensions.map((item, index) => <span key={`${item.name}-${index}`}>{item.name}<b>{item.score.toFixed(1)} / {item.max.toFixed(1)}</b></span>)}
    </div>
  </div>;
}
