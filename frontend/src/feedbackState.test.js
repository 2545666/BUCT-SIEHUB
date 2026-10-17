import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalibrations, responseSenderLabel, shouldReplaceEditorContent, canvasPreviewScale } from './feedbackState.js';
import { isMarkdownFile, isPlainTextFile } from './siebridgeFileType.js';

test('加权按活动去重，包含旧校准总分作为并发校验，不越过满分', () => {
  const records = [
    { _id: 'r1', volunteer: { _id: 'v1' }, dimension: 'activity', score: 3, activityName: '迎新' },
    { _id: 'r2', volunteer: { _id: 'v1' }, dimension: 'activity', score: 2, activityName: '迎新' },
    { _id: 'r3', volunteer: { _id: 'v1' }, dimension: 'activity', score: 8, activityName: '期末系统加权' },
    { _id: 'r4', volunteer: { _id: 'v1' }, dimension: 'attendance', score: 10, activityName: '迎新' }
  ];
  const result = buildCalibrations({ members: [{ _id: 'v1' }, { _id: 'v2' }], records, dimension: 'activity', maximum: 35, totalActivities: 2, weights: { 迎新: 1 } });
  assert.deepEqual(result, [{ volunteerId: 'v1', targetScore: 17.5, expectedTotal: 13 }, { volunteerId: 'v2', targetScore: 0, expectedTotal: 0 }]);
  assert.equal(buildCalibrations({ members: [{ _id: 'v1' }], records, dimension: 'activity', maximum: 35, totalActivities: 1, weights: { 迎新: 3 } })[0].targetScore, 35);
});

test('加权拒绝零分母和负活动权重', () => {
  const input = { members: [{ id: 'v1' }], records: [{ volunteer: { id: 'v1' }, dimension: 'activity', score: 1, activityName: '活动' }], dimension: 'activity', maximum: 35, totalActivities: 1, weights: {} };
  assert.throws(() => buildCalibrations({ ...input, totalActivities: 0 }));
  assert.throws(() => buildCalibrations({ ...input, weights: { 活动: -1 } }));
});

test('学生留言按senderType识别，老师名称和学生名称分开', () => {
  assert.equal(responseSenderLabel({ senderType: 'student', senderName: '学生甲', adminName: '旧字段老师' }), '学生甲');
  assert.equal(responseSenderLabel({ senderType: 'admin', adminName: '处理甲' }), '处理甲');
  assert.equal(responseSenderLabel({ senderType: 'student' }), '学生留言');
});

test('保存响应不得覆盖请求期间的新编辑', () => {
  const snapshot = { pages: [{ id: 'a', title: '旧标题' }] };
  assert.equal(shouldReplaceEditorContent(snapshot, structuredClone(snapshot)), true);
  assert.equal(shouldReplaceEditorContent(snapshot, { pages: [{ id: 'a', title: '新标题' }] }), false);
});

test('375/768/1100容器画布不溢出，宽屏不放大', () => {
  for (const width of [375, 768, 1100]) assert.ok(1440 * canvasPreviewScale(width, 1440) <= width);
  assert.equal(canvasPreviewScale(1800, 1440), 1);
});

test('纯文本保留原格式，Markdown才启用Markdown渲染', () => {
  assert.equal(isMarkdownFile({ extension: '.txt', mimetype: 'text/plain' }), false);
  assert.equal(isPlainTextFile({ extension: '.txt', mimetype: 'text/plain' }), true);
  assert.equal(isMarkdownFile({ extension: '.md', mimetype: 'text/plain' }), true);
  assert.equal(isPlainTextFile({ extension: '.md', mimetype: 'text/plain' }), false);
});
