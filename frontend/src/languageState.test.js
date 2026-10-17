import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTranslatedValue } from './languageState.js';

test('switching feedback titles updates the cached translation source', () => {
  const translate = value => `EN:${value}`;
  let state = nextTranslatedValue(undefined, '第一个问题', 'zh', translate);
  state = nextTranslatedValue(state, '第二个问题', 'zh', translate);
  assert.equal(state.rendered, '第二个问题');
  state = nextTranslatedValue(state, state.rendered, 'en', translate);
  assert.equal(state.rendered, 'EN:第二个问题');
  state = nextTranslatedValue(state, '第三个问题', 'en', translate);
  assert.equal(state.rendered, 'EN:第三个问题');
  assert.equal(nextTranslatedValue(state, state.rendered, 'zh', translate).rendered, '第三个问题');
});
