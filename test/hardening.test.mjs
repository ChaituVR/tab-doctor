import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import closeDuplicates from '../src/rules/closeDuplicates.js';
import groupStale, { STALE_GROUP_TITLE } from '../src/rules/groupStale.js';
import groupBySite from '../src/rules/groupBySite.js';
import { DEFAULTS, withDefaults } from '../src/lib/settings.js';
import { planDuplicates } from '../src/lib/tabs.js';
import { rememberGroup } from '../src/lib/groups.js';

const HOUR = 60 * 60 * 1000;
const settings = (over = {}) => withDefaults({ ...DEFAULTS, ...over });
const ctx = (state, over = {}) => ({ tabs: state.tabs, settings: settings(), trigger: 'url-changed', protection: new Map(), ...over });

test('withDefaults: wrong types and out-of-range values fall back to defaults', () => {
  const s = withDefaults({ paused: 'yes', sameWindowOnly: 1, smartNames: 'true', staleHours: 0, discardHours: '72', duplicateMode: 'random', rules: { 'close-duplicates': 'off', custom: true } });
  assert.equal(s.paused, false);
  assert.equal(s.sameWindowOnly, true);
  assert.equal(s.smartNames, false);
  assert.equal(s.staleHours, 24);
  assert.equal(s.discardHours, 72);
  assert.equal(s.duplicateMode, 'keep-existing');
  assert.equal(s.rules['close-duplicates'], true);
  assert.equal(s.rules.custom, true, 'unknown rule keys pass through');
});

test('withDefaults: null, arrays and strings are treated as empty', () => {
  for (const junk of [null, undefined, [], 'x', 42]) assert.deepEqual(withDefaults(junk), DEFAULTS, String(junk));
});

test('planDuplicates: keepers maps every closing tab to the tab that stays', () => {
  const tabs = [{ id: 1, url: 'https://a.com', windowId: 1 }, { id: 2, url: 'https://a.com', windowId: 1 }, { id: 3, url: 'https://b.com', windowId: 1 }, { id: 4, url: 'https://b.com', windowId: 1 }];
  const { toClose, keepers } = planDuplicates(tabs, settings());
  assert.deepEqual(toClose.map(t => t.id), [2, 4]);
  assert.equal(keepers.get(2).id, 1);
  assert.equal(keepers.get(4).id, 3);
  assert.equal(keepers.has(1), false);
});

test('closeDuplicates: re-checks the tab right before closing, so a tab that navigated away survives', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://a.com' }] });
  const snapshot = state.tabs.map(t => ({ ...t }));
  state.tabs.find(t => t.id === 2).url = 'https://elsewhere.com';
  const res = await closeDuplicates.run(ctx(state, { tabs: snapshot }));
  assert.deepEqual(res.closed, []);
  assert.deepEqual(state.removed, []);
});

test('closeDuplicates: a tab still loading (pendingUrl) or a vanished keeper is left alone', async () => {
  let { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://a.com', pendingUrl: 'https://next.com' }] });
  assert.deepEqual((await closeDuplicates.run(ctx(state))).closed, []);
  ({ state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://a.com' }] }));
  const snapshot = state.tabs.map(t => ({ ...t }));
  state.tabs = state.tabs.filter(t => t.id !== 1);
  assert.deepEqual((await closeDuplicates.run(ctx(state, { tabs: snapshot }))).closed, []);
  assert.equal(state.tabs.length, 1);
});

test('closeDuplicates: each window refocuses its own keeper when the active copy was closed', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com', windowId: 1 }, { id: 2, url: 'https://a.com', windowId: 1, active: true },
    { id: 3, url: 'https://b.com', windowId: 2 }, { id: 4, url: 'https://b.com', windowId: 2, active: true }
  ] });
  await closeDuplicates.run(ctx(state));
  assert.deepEqual(state.activated.sort(), [1, 3]);
  assert.deepEqual(state.focused.sort(), [1, 2]);
});

test('closeDuplicates and groupBySite also run when a tab is created', () => {
  assert.ok(closeDuplicates.triggers.includes('tab-created'));
  assert.ok(groupBySite.triggers.includes('tab-created'));
});

test('groupStale: prefers our own Stale group over a user group with the same name', async () => {
  const old = Date.now() - 30 * HOUR;
  const { state } = fakeChrome({
    tabs: [{ id: 1, url: 'https://a.com', lastAccessed: old }],
    groups: [{ id: 40, title: STALE_GROUP_TITLE }, { id: 41, title: STALE_GROUP_TITLE }]
  });
  await rememberGroup(41);
  await groupStale.run(ctx(state));
  assert.equal(state.tabs[0].groupId, 41);
  assert.equal(state.groups.length, 2);
});

test('groupStale: after a restart empties ownGroups, the surviving Stale group is reused', async () => {
  const old = Date.now() - 30 * HOUR;
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', lastAccessed: old }], groups: [{ id: 40, title: STALE_GROUP_TITLE }] });
  await groupStale.run(ctx(state));
  assert.equal(state.tabs[0].groupId, 40);
  assert.equal(state.groups.length, 1, 'no second Stale group');
});
