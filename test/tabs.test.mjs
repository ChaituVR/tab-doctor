import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeKey, duplicateKey, groupBy, isManageable, newestFirst } from '../src/lib/tabs.js';
import { withDefaults, DEFAULTS } from '../src/lib/settings.js';

test('dedupeKey ignores hash, keeps query', () => {
  assert.equal(dedupeKey('https://a.com/x?y=1#top'), 'https://a.com/x?y=1');
});

test('dedupeKey rejects internal and invalid urls', () => {
  assert.equal(dedupeKey('chrome://extensions'), null);
  assert.equal(dedupeKey(''), null);
  assert.equal(dedupeKey('not a url'), null);
});

test('duplicateKey scopes by window only when sameWindowOnly', () => {
  const a = { windowId: 1, url: 'https://a.com' };
  const b = { windowId: 2, url: 'https://a.com' };
  assert.notEqual(duplicateKey(a, { sameWindowOnly: true }), duplicateKey(b, { sameWindowOnly: true }));
  assert.equal(duplicateKey(a, { sameWindowOnly: false }), duplicateKey(b, { sameWindowOnly: false }));
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

test('withDefaults merges nested rule toggles', () => {
  assert.deepEqual(withDefaults(undefined), DEFAULTS);
  const s = withDefaults({ paused: true, rules: { 'other-rule': false } });
  assert.equal(s.paused, true);
  assert.equal(s.sameWindowOnly, true);
  assert.deepEqual(s.rules, { 'close-duplicates': true, 'group-stale': true, 'other-rule': false });
});

test('isStale respects threshold and exemptions', async () => {
  const { isStale, NO_GROUP } = await import('../src/lib/tabs.js');
  const now = 1_000_000_000;
  const opts = { now, thresholdMs: 3600_000 };
  const old = { lastAccessed: now - 7200_000, active: false, pinned: false, groupId: NO_GROUP };
  assert.equal(isStale(old, opts), true);
  assert.equal(isStale({ ...old, lastAccessed: now - 60_000 }, opts), false);
  assert.equal(isStale({ ...old, active: true }, opts), false);
  assert.equal(isStale({ ...old, pinned: true }, opts), false);
  assert.equal(isStale({ ...old, groupId: 7 }, opts), false);
  assert.equal(isStale({ ...old, lastAccessed: undefined }, opts), false);
});

test('computeWakeAt: later, tomorrow 9AM, next Saturday 9AM', async () => {
  const { computeWakeAt } = await import('../src/lib/snooze.js');
  const wed = new Date(2026, 8, 16, 14, 30).getTime(); // Wed Sep 16 2026 14:30 local
  assert.equal(computeWakeAt('later', wed), wed + 6 * 3600_000);
  assert.deepEqual(new Date(computeWakeAt('tomorrow', wed)), new Date(2026, 8, 17, 9, 0));
  assert.deepEqual(new Date(computeWakeAt('weekend', wed)), new Date(2026, 8, 19, 9, 0));
  const sat = new Date(2026, 8, 19, 10, 0).getTime();
  assert.deepEqual(new Date(computeWakeAt('weekend', sat)), new Date(2026, 8, 26, 9, 0));
});
