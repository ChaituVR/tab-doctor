import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, groupBy, isManageable, newestFirst } from '../src/lib/tabs.js';

test('dedupeKey ignores hash, keeps query', () => {
  assert.equal(dedupeKey('https://a.com/x?y=1#top'), 'https://a.com/x?y=1');
});

test('dedupeKey rejects internal and invalid urls', () => {
  assert.equal(dedupeKey('chrome://extensions'), null);
  assert.equal(dedupeKey(''), null);
  assert.equal(dedupeKey('not a url'), null);
});

test('isManageable skips pinned', () => {
  assert.equal(isManageable({ pinned: true, url: 'https://a.com' }), false);
  assert.equal(isManageable({ pinned: false, url: 'https://a.com' }), true);
});

test('groupBy + newestFirst keep highest id first', () => {
  const tabs = [{ id: 1, url: 'https://a.com' }, { id: 5, url: 'https://a.com#x' }, { id: 3, url: 'https://b.com' }];
  const groups = groupBy(tabs, t => dedupeKey(t.url));
  assert.equal(groups.size, 2);
  assert.deepEqual(newestFirst(groups.get('https://a.com/')).map(t => t.id), [5, 1]);
});
