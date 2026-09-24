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
  assert.deepEqual(s.rules, { 'close-duplicates': true, 'group-stale': true, 'discard-stale': false, 'group-by-site': false, 'other-rule': false });
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

test('validateBackup rejects junk and normalizes entries', async () => {
  const { validateBackup, mergeHistory, mergeSnoozed } = await import('../src/lib/backup.js');
  assert.throws(() => validateBackup({}), /Not a Tab Doctor/);
  assert.throws(() => validateBackup({ app: 'tab-doctor', version: 99 }), /Unsupported/);
  const b = validateBackup({ app: 'tab-doctor', version: 1, settings: { staleHours: 9999 },
    snoozed: [{ id: 'a', url: 'https://x.com', wakeAt: 5 }, { id: 'bad', url: 'javascript:alert(1)', wakeAt: 5 }],
    history: [{ url: 'https://y.com', closedAt: 10 }, { url: 'nope', closedAt: 1 }] });
  assert.equal(b.settings.staleHours, 24);
  assert.deepEqual(b.snoozed.map(e => e.id), ['a']);
  assert.deepEqual(b.history.map(e => e.url), ['https://y.com']);
  assert.deepEqual(mergeHistory([{ url: 'https://y.com', closedAt: 10 }], b.history).length, 1);
  assert.equal(mergeHistory([{ url: 'https://z.com', closedAt: 3 }], b.history, 1).length, 1);
  assert.equal(mergeSnoozed([{ id: 'a', title: 'old' }], b.snoozed)[0].url, 'https://x.com');
});

test('splitDuplicates honours duplicateMode', async () => {
  const { splitDuplicates } = await import('../src/lib/tabs.js');
  const group = [{ id: 4 }, { id: 9 }, { id: 2 }];
  assert.deepEqual(splitDuplicates(group, 'keep-newest').map(t => t.id), [9, 4, 2]);
  assert.deepEqual(splitDuplicates(group, 'keep-existing').map(t => t.id), [2, 4, 9]);
});

test('planDuplicates: protected tab is the keeper, grace skips group, manual ignores grace', async () => {
  const { planDuplicates } = await import('../src/lib/tabs.js');
  const settings = { sameWindowOnly: false, duplicateMode: 'keep-existing' };
  const now = 1_000_000;
  const tabs = [
    { id: 1, url: 'https://a.com', windowId: 1 }, { id: 7, url: 'https://a.com', windowId: 1, active: true },
    { id: 2, url: 'https://b.com', windowId: 1 }, { id: 9, url: 'https://b.com', windowId: 1 }
  ];
  const fresh = new Map([[7, { graceUntil: now + 60_000 }]]);
  // within grace: a.com group untouched, b.com deduped normally (keep-existing → close 9)
  assert.deepEqual(planDuplicates(tabs, settings, fresh, { now }).toClose.map(t => t.id), [9]);
  // manual run ignores grace: protected 7 is keeper, 1 closes
  assert.deepEqual(planDuplicates(tabs, settings, fresh, { now, ignoreGrace: true }).toClose.map(t => t.id).sort(), [1, 9]);
  // after grace: same as manual
  const old = new Map([[7, { graceUntil: now - 1 }]]);
  assert.deepEqual(planDuplicates(tabs, settings, old, { now }).toClose.map(t => t.id).sort(), [1, 9]);
  // a NEW duplicate of a protected tab still gets closed (protected tab never does)
  const later = [...tabs, { id: 12, url: 'https://a.com', windowId: 1, active: true }];
  const plan = planDuplicates(later, settings, old, { now });
  assert.ok(plan.toClose.map(t => t.id).includes(12));
  assert.ok(!plan.toClose.map(t => t.id).includes(7));
  assert.equal(plan.toActivate.id, 7);
  // no protection: plain keep-existing
  assert.deepEqual(planDuplicates(tabs, settings).toClose.map(t => t.id).sort(), [7, 9]);
});

test('dedupeKey strips tracking params only when asked', async () => {
  const { dedupeKey } = await import('../src/lib/tabs.js');
  const u = 'https://a.com/post?id=7&utm_source=slack&fbclid=abc#top';
  assert.equal(dedupeKey(u), 'https://a.com/post?id=7&utm_source=slack&fbclid=abc');
  assert.equal(dedupeKey(u, { stripTracking: true }), 'https://a.com/post?id=7');
  assert.equal(dedupeKey('https://a.com/?utm_medium=x', { stripTracking: true }), 'https://a.com/');
});

test('isDiscardable skips active/pinned/audible/already discarded', async () => {
  const { isDiscardable } = await import('../src/lib/tabs.js');
  const now = 10_000_000, opts = { now, thresholdMs: 1000 };
  const t = { lastAccessed: now - 5000, active: false, pinned: false, audible: false, discarded: false };
  assert.equal(isDiscardable(t, opts), true);
  for (const k of ['active', 'pinned', 'audible', 'discarded']) assert.equal(isDiscardable({ ...t, [k]: true }, opts), false);
  assert.equal(isDiscardable({ ...t, lastAccessed: now - 10 }, opts), false);
});


test('siteOf / siteLabel / colorFor', async () => {
  const { siteOf, siteLabel, colorFor, GROUP_COLORS } = await import('../src/lib/tabs.js');
  assert.equal(siteOf('https://www.github.com/x/y'), 'github.com');
  assert.equal(siteOf('https://gist.github.com/x'), 'github.com');
  assert.equal(siteOf('https://www.bbc.co.uk/news'), 'bbc.co.uk');
  assert.equal(siteOf('chrome://extensions'), null);
  assert.equal(siteOf('file:///Users/chaitu/Desktop/pr-reviews/before-after.html'), null);
  assert.equal(siteOf('http://localhost:8080/x'), 'localhost');
  assert.equal(siteOf('http://127.0.0.1:3000/'), '127.0.0.1');
  assert.equal(siteOf('https://docs.google.com/document/d/1'), 'docs.google.com');
  assert.equal(siteOf('https://www.google.com/search?q=x'), 'google.com');
  assert.equal(siteLabel('bbc.co.uk'), 'bbc');
  assert.equal(siteLabel('github.com'), 'github');
  assert.equal(siteLabel('docs.google.com'), 'docs.google');
  assert.equal(siteLabel('mail.google.com'), 'gmail');
  assert.equal(siteLabel('google.com'), 'google');
  assert.equal(siteLabel('127.0.0.1'), '127.0.0.1');
  assert.equal(siteLabel('localhost'), 'localhost');
  assert.equal(colorFor('github.com'), colorFor('github.com'));
  assert.ok(GROUP_COLORS.includes(colorFor('anything.io')));
});

test('isStale allows tabs inside allowed (own) groups', async () => {
  const { isStale } = await import('../src/lib/tabs.js');
  const now = 1_000_000_000;
  const t = { lastAccessed: now - 7200_000, active: false, pinned: false, groupId: 42 };
  assert.equal(isStale(t, { now, thresholdMs: 3600_000 }), false);
  assert.equal(isStale(t, { now, thresholdMs: 3600_000, allowGroups: new Set([42]) }), true);
});
