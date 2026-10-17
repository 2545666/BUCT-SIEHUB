export const feedbackId = (item) => typeof item === 'string' ? item : item?._id || item?.id || '';

export const responseSenderLabel = (response) => response.senderType === 'student'
  ? (response.senderName || '学生留言')
  : (response.adminName || response.senderName || '处理人员');

export const buildCalibrations = ({ members, records, dimension, maximum, totalActivities, weights }) => {
  if (!Number.isFinite(Number(maximum)) || !Number.isFinite(Number(totalActivities)) || Number(totalActivities) <= 0) throw new Error('请填写有效的活动总次数与维度满分');
  return members.map(member => {
    const volunteerId = feedbackId(member);
    const current = records.filter(record => feedbackId(record.volunteer) === volunteerId && record.dimension === dimension);
    const activities = new Set(current.filter(record => !record.isCalibration && record.activityName !== '期末系统加权' && Number(record.score) > 0).map(record => record.activityName || `record:${feedbackId(record)}`));
    const attendedWeight = [...activities].reduce((sum, name) => {
      const weight = Number(weights[name] ?? 1);
      if (!Number.isFinite(weight) || weight < 0) throw new Error('活动权重必须为非负数');
      return sum + weight;
    }, 0);
    return {
      volunteerId,
      targetScore: Math.round(Math.min(Number(maximum), Number(maximum) * attendedWeight / Number(totalActivities)) * 100) / 100,
      expectedTotal: current.reduce((sum, record) => sum + Number(record.score || 0), 0)
    };
  });
};

export const shouldReplaceEditorContent = (submitted, current) => JSON.stringify(submitted) === JSON.stringify(current);

export const canvasPreviewScale = (containerWidth, pageWidth = 1440) => Math.max(0, Math.min(1, Number(containerWidth) / (Number(pageWidth) || 1440)));
