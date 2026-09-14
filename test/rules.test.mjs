import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import closeDuplicates from '../src/rules/closeDuplicates.js';
import groupStale, { STALE_GROUP_TITLE } from '../src/rules/groupStale.js';
import groupBySite from '../src/rules/groupBySite.js';
import discardStale from '../src/rules/discardStale.js';
import { DEFAULTS, withDefaults } from '../src/lib/settings.js';
import { protect, protection, unprotect, noteNavigation, PROTECT_MS, GRACE_MS } from '../src/lib/protect.js';
import { ownGroups, rememberGroup, forgetGroup } from '../src/lib/groups.js';
import { siteLabel } from '../src/lib/tabs.js';

const HOUR = 60 * 60 * 1000;
const settings = (over = {}) => withDefaults({ ...DEFAULTS, ...over });
const ctx = (state, over = {}) => ({ tabs: state.tabs, settings: settings(), trigger: 'url-changed', protection: new Map(), ...over });

test('closeDuplicates: keeps the existing tab, closes the newer copy, refocuses the keeper', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com/x' }, { id: 2, url: 'https://b.com' }, { id: 3, url: 'https://a.com/x#frag', active: true }
  ] });
  const res = await closeDuplicates.run(ctx(state));
  assert.deepEqual(state.removed, [3]);
  assert.deepEqual(res.closed.map(c => c.url), ['https://a.com/x#frag']);
  assert.deepEqual(state.activated, [1]);
  assert.deepEqual(state.focused, [1]);
});

test('closeDuplicates: keep-newest mode closes the older copy instead', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 3, url: 'https://a.com' }] });
  await closeDuplicates.run(ctx(state, { settings: settings({ duplicateMode: 'keep-newest' }) }));
  assert.deepEqual(state.removed, [1]);
});

test('closeDuplicates: pinned and chrome:// tabs are never touched', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com', pinned: true }, { id: 2, url: 'https://a.com', pinned: true },
    { id: 3, url: 'chrome://extensions' }, { id: 4, url: 'chrome://extensions' }
  ] });
  await closeDuplicates.run(ctx(state));
  assert.deepEqual(state.removed, []);
});

test('closeDuplicates: sameWindowOnly keeps duplicates that live in different windows', async () => {
  const make = () => fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', windowId: 1 }, { id: 2, url: 'https://a.com', windowId: 2 }] });
  let { state } = make();
  await closeDuplicates.run(ctx(state));
  assert.deepEqual(state.removed, []);
  ({ state } = make());
  await closeDuplicates.run(ctx(state, { settings: settings({ sameWindowOnly: false }) }));
  assert.deepEqual(state.removed, [2]);
});

test('closeDuplicates: a tab we reopened is left alone during grace, then becomes the keeper', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 9, url: 'https://a.com' }] });
  await protect(9, 'https://a.com');
  await closeDuplicates.run(ctx(state, { protection: await protection() }));
  assert.deepEqual(state.removed, [], 'grace period: nothing closes');
  await protect(9, 'https://a.com', Date.now() - GRACE_MS - 1000);   // as if reopened a while ago
  await closeDuplicates.run(ctx(state, { protection: await protection() }));
  assert.deepEqual(state.removed, [1], 'after grace the older tab goes, reopened one stays');
});

test('closeDuplicates: manual run ignores grace but still respects the keeper', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 9, url: 'https://a.com' }] });
  await protect(9, 'https://a.com');
  await closeDuplicates.run(ctx(state, { trigger: 'manual', protection: await protection() }));
  assert.deepEqual(state.removed, [1]);
});

test('closeDuplicates: a tab that vanished mid-run does not abort the others', async () => {
  const { state, chrome } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://a.com' }, { id: 3, url: 'https://a.com' }] });
  const realRemove = chrome.tabs.remove;
  chrome.tabs.remove = async id => { if (id === 2) throw new Error('No tab with id: 2.'); return realRemove(id); };
  const res = await closeDuplicates.run(ctx(state));
  assert.deepEqual(state.removed, [3]);
  assert.equal(res.closed.length, 1);
});

test('groupStale: stale tabs fold into one collapsed grey group per window, active/pinned/user-grouped stay', async () => {
  const now = Date.now();
  const old = now - 30 * HOUR;
  const { state } = fakeChrome({
    tabs: [
      { id: 1, url: 'https://a.com', lastAccessed: old },
      { id: 2, url: 'https://b.com', lastAccessed: old, active: true },
      { id: 3, url: 'https://c.com', lastAccessed: old, pinned: true },
      { id: 4, url: 'https://d.com', lastAccessed: old, groupId: 7 },
      { id: 5, url: 'https://e.com', lastAccessed: now - HOUR },
      { id: 6, url: 'https://f.com', lastAccessed: old, windowId: 2 }
    ],
    groups: [{ id: 7, title: 'Work' }]
  });
  const res = await groupStale.run(ctx(state));
  assert.equal(res.grouped, 2);
  const stale = state.groups.filter(g => g.title === STALE_GROUP_TITLE);
  assert.equal(stale.length, 2);
  assert.ok(stale.every(g => g.collapsed && g.color === 'grey'));
  assert.equal(state.tabs.find(t => t.id === 1).groupId, stale.find(g => g.windowId === 1).id);
  assert.equal(state.tabs.find(t => t.id === 6).groupId, stale.find(g => g.windowId === 2).id);
  assert.equal(state.tabs.find(t => t.id === 4).groupId, 7);
  assert.deepEqual([...await ownGroups()].sort(), stale.map(g => g.id).sort());
});

test('groupStale: reuses the existing Stale group and can pull from our own site groups', async () => {
  const old = Date.now() - 30 * HOUR;
  const { state } = fakeChrome({
    tabs: [{ id: 1, url: 'https://a.com', lastAccessed: old, groupId: 50 }, { id: 2, url: 'https://b.com', lastAccessed: old }],
    groups: [{ id: 40, title: STALE_GROUP_TITLE, collapsed: true }, { id: 50, title: 'github' }]
  });
  await rememberGroup(40); await rememberGroup(50);
  await groupStale.run(ctx(state));
  assert.equal(state.groups.length, 2, 'no new group');
  assert.ok(state.tabs.every(t => t.groupId === 40));
});

test('groupBySite: two or more tabs from a site get a titled colour group, user groups and singles untouched', async () => {
  const { state } = fakeChrome({
    tabs: [
      { id: 1, url: 'https://github.com/a' }, { id: 2, url: 'https://www.github.com/b' },
      { id: 3, url: 'https://docs.x.com' },
      { id: 4, url: 'https://github.com/c', groupId: 7 },
      { id: 5, url: 'file:///Users/me/a.html' }, { id: 6, url: 'file:///Users/me/b.html' }
    ],
    groups: [{ id: 7, title: 'Work' }]
  });
  const res = await groupBySite.run(ctx(state));
  assert.equal(res.grouped, 2);
  const gh = state.groups.find(g => g.title === siteLabel('github.com'));
  assert.ok(gh && gh.color !== 'grey');
  assert.equal(state.tabs.find(t => t.id === 1).groupId, gh.id);
  assert.equal(state.tabs.find(t => t.id === 2).groupId, gh.id);
  assert.equal(state.tabs.find(t => t.id === 3).groupId, -1);
  assert.equal(state.tabs.find(t => t.id === 4).groupId, 7);
  assert.equal(state.tabs.find(t => t.id === 5).groupId, -1, 'file:// never forms a site group');
});

test('groupBySite: a later tab joins the existing site group, Stale tabs are not pulled out', async () => {
  const { state } = fakeChrome({
    tabs: [{ id: 1, url: 'https://github.com/a', groupId: 60 }, { id: 2, url: 'https://github.com/b' }, { id: 3, url: 'https://github.com/c', groupId: 40 }],
    groups: [{ id: 60, title: 'github', color: 'blue' }, { id: 40, title: STALE_GROUP_TITLE }]
  });
  await rememberGroup(60); await rememberGroup(40);
  const res = await groupBySite.run(ctx(state));
  assert.equal(res.grouped, 1);
  assert.equal(state.tabs.find(t => t.id === 2).groupId, 60);
  assert.equal(state.tabs.find(t => t.id === 3).groupId, 40);
  assert.equal(state.groups.length, 2);
});

test('discardStale: unloads only tabs past the threshold that are safe to unload', async () => {
  const now = Date.now();
  const old = now - 80 * HOUR;
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com', lastAccessed: old },
    { id: 2, url: 'https://b.com', lastAccessed: old, active: true },
    { id: 3, url: 'https://c.com', lastAccessed: old, audible: true },
    { id: 4, url: 'https://d.com', lastAccessed: old, discarded: true },
    { id: 5, url: 'https://e.com', lastAccessed: now - 10 * HOUR }
  ] });
  const res = await discardStale.run(ctx(state));
  assert.equal(res.discarded, 1);
  assert.deepEqual(state.discarded, [1]);
});

test('protect: entries expire, navigation to another page drops protection, same page keeps it', async () => {
  fakeChrome();
  const now = Date.now();
  await protect(5, 'https://a.com/x', now);
  const p = await protection(now);
  assert.equal(p.get(5).until, now + PROTECT_MS);
  assert.equal(p.get(5).graceUntil, now + GRACE_MS);
  await noteNavigation(5, 'https://a.com/x#section');
  assert.ok((await protection(now)).has(5), 'hash change is the same page');
  await noteNavigation(5, 'https://a.com/y');
  assert.equal((await protection(now)).has(5), false);
  await protect(6, 'https://b.com', now);
  assert.equal((await protection(now + PROTECT_MS + 1)).has(6), false, 'expired');
  await protect(7, 'https://c.com', now);
  await unprotect(7);
  assert.equal((await protection(now)).has(7), false);
});

test('groups: remember/forget own groups is idempotent', async () => {
  fakeChrome();
  await rememberGroup(1); await rememberGroup(1); await rememberGroup(2);
  assert.deepEqual([...await ownGroups()].sort(), [1, 2]);
  await forgetGroup(1); await forgetGroup(99);
  assert.deepEqual([...await ownGroups()], [2]);
});
