import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import closeDuplicates from '../src/rules/closeDuplicates.js';
import groupStale, { STALE_GROUP_TITLE } from '../src/rules/groupStale.js';
import groupBySite from '../src/rules/groupBySite.js';
import discardStale from '../src/rules/discardStale.js';
import { DEFAULTS, withDefaults } from '../src/lib/settings.js';
import { ownGroups, rememberGroup, siteGroups } from '../src/lib/groups.js';
import { protect, hold, holds, unprotect, protection, noteNavigation } from '../src/lib/protect.js';
import { siteOf, siteLabel, dedupeKey, planDuplicates, colorFor, GROUP_COLORS } from '../src/lib/tabs.js';

console.warn = () => {};
const HOUR = 60 * 60 * 1000;
const settings = (over = {}) => withDefaults({ ...DEFAULTS, ...over });
const ctx = (state, over = {}) => ({ tabs: state.tabs, settings: settings(), trigger: 'url-changed', protection: new Map(), ...over });

test('siteOf: ports, uppercase hosts, co.uk subdomains, http and junk', () => {
  assert.equal(siteOf('https://GitHub.com:8443/x'), 'github.com');
  assert.equal(siteOf('http://news.bbc.co.uk/1'), 'bbc.co.uk');
  assert.equal(siteOf('https://a.b.c.example.com'), 'example.com');
  assert.equal(siteOf('https://example.com'), 'example.com');
  assert.equal(siteOf('data:text/html,hi'), null);
  assert.equal(siteOf('not a url'), null);
  assert.equal(siteOf(''), null);
  assert.equal(siteOf(undefined), null);
});

test('siteOf: Microsoft and live.com split per product like Google', () => {
  assert.equal(siteOf('https://learn.microsoft.com/en-us/'), 'learn.microsoft.com');
  assert.equal(siteOf('https://outlook.live.com/mail'), 'outlook.live.com');
  assert.equal(siteOf('https://www.microsoft.com/'), 'microsoft.com');
  assert.equal(siteLabel('learn.microsoft.com'), 'learn.microsoft');
  assert.equal(siteLabel('drive.google.com'), 'drive.google');
});

test('siteLabel: two-level TLD subdomain hosts keep the product part', () => {
  assert.equal(siteLabel('bbc.co.uk'), 'bbc');
  assert.equal(siteLabel('shop.example.com.au'), 'shop.example');
});

test('colorFor: never grey, spreads over the palette', () => {
  const seen = new Set(['github.com', 'google.com', 'notion.so', 'x.com', 'linear.app', 'figma.com', 'slack.com', 'bbc.co.uk'].map(colorFor));
  assert.ok(!seen.has('grey'));
  assert.ok(seen.size >= 3);
  for (const c of seen) assert.ok(GROUP_COLORS.includes(c));
});

test('dedupeKey: trailing hash only and empty query collapse; different query stays different', () => {
  assert.equal(dedupeKey('https://a.com/x#'), dedupeKey('https://a.com/x'));
  assert.notEqual(dedupeKey('https://a.com/x?a=1'), dedupeKey('https://a.com/x?a=2'));
  assert.equal(dedupeKey('https://a.com/?utm_source=x', { stripTracking: true }), 'https://a.com/');
  assert.equal(dedupeKey('https://a.com/?id=1&utm_medium=y', { stripTracking: true }), 'https://a.com/?id=1');
});

test('planDuplicates: three copies close two, and an active duplicate hands focus to the keeper', () => {
  const tabs = [{ id: 1, url: 'https://a.com', windowId: 1 }, { id: 2, url: 'https://a.com', windowId: 1 }, { id: 3, url: 'https://a.com', windowId: 1, active: true }];
  const { toClose, toActivate } = planDuplicates(tabs, settings());
  assert.deepEqual(toClose.map(t => t.id).sort(), [2, 3]);
  assert.equal(toActivate.id, 1);
});

test('planDuplicates: tracking params only count as the same page when the setting is on', () => {
  const tabs = [{ id: 1, url: 'https://a.com/?utm_source=tw', windowId: 1 }, { id: 2, url: 'https://a.com/', windowId: 1 }];
  assert.equal(planDuplicates(tabs, settings()).toClose.length, 0);
  assert.equal(planDuplicates(tabs, settings({ ignoreTrackingParams: true })).toClose.length, 1);
});

test('closeDuplicates: no duplicates means no closes and no focus change', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://b.com' }] });
  const res = await closeDuplicates.run(ctx(state));
  assert.deepEqual(res.closed, []);
  assert.deepEqual(state.activated, []);
  assert.deepEqual(state.focused, []);
});

test('closeDuplicates: closed entries carry url, window and title for undo', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', title: 'A' }, { id: 2, url: 'https://a.com', title: 'A copy', windowId: 1 }] });
  const res = await closeDuplicates.run(ctx(state));
  assert.deepEqual(res.closed, [{ url: 'https://a.com', windowId: 1, title: 'A copy' }]);
});

test('discardStale: a failed discard is not counted and does not stop the rest', async () => {
  const old = Date.now() - 100 * HOUR;
  const { state, chrome } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', lastAccessed: old }, { id: 2, url: 'https://b.com', lastAccessed: old }] });
  const real = chrome.tabs.discard;
  chrome.tabs.discard = async id => { if (id === 1) throw new Error('cannot discard'); return real(id); };
  const res = await discardStale.run(ctx(state, { settings: settings({ discardHours: 72 }) }));
  assert.equal(res.discarded, 1);
  assert.deepEqual(state.discarded, [2]);
});

test('discardStale: respects a custom threshold', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', lastAccessed: Date.now() - 2 * HOUR }] });
  assert.equal((await discardStale.run(ctx(state, { settings: settings({ discardHours: 3 }) }))).discarded, 0);
  assert.equal((await discardStale.run(ctx(state, { settings: settings({ discardHours: 1 }) }))).discarded, 1);
});

test('groupStale: one Stale group per window, none when nothing is stale', async () => {
  const old = Date.now() - 48 * HOUR;
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com', lastAccessed: old, windowId: 1 },
    { id: 2, url: 'https://b.com', lastAccessed: old, windowId: 2 },
    { id: 3, url: 'https://c.com', lastAccessed: Date.now(), windowId: 2 }
  ] });
  const res = await groupStale.run(ctx(state));
  assert.equal(res.grouped, 2);
  const stale = state.groups.filter(g => g.title === STALE_GROUP_TITLE);
  assert.deepEqual(stale.map(g => g.windowId).sort(), [1, 2]);
  assert.ok(stale.every(g => g.collapsed && g.color === 'grey'));
  assert.equal(state.tabs.find(t => t.id === 3).groupId, -1);

  const fresh = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com', lastAccessed: Date.now() }] });
  assert.equal((await groupStale.run(ctx(fresh.state))).grouped, 0);
  assert.equal(fresh.state.groups.length, 0);
});

test('groupStale: tabs without lastAccessed are never treated as stale', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }] });
  assert.equal((await groupStale.run(ctx(state))).grouped, 0);
});

test('groupBySite: pinned tabs and a single tab never form a group', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com/1', pinned: true }, { id: 2, url: 'https://a.com/2' }, { id: 3, url: 'https://b.com' }] });
  const res = await groupBySite.run(ctx(state));
  assert.equal(res.grouped, 0);
  assert.equal(state.groups.length, 0);
});

test('groupBySite: a single new tab joins an existing site group', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com/1', groupId: 60 }, { id: 2, url: 'https://a.com/2', groupId: 60 }, { id: 3, url: 'https://a.com/3' }], groups: [{ id: 60, title: 'a' }] });
  await rememberGroup(60);
  assert.equal((await groupBySite.run(ctx(state))).grouped, 1);
  assert.equal(state.tabs.find(t => t.id === 3).groupId, 60);
});

test('groupBySite: each window gets its own group for the same site', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://a.com/1', windowId: 1 }, { id: 2, url: 'https://a.com/2', windowId: 1 },
    { id: 3, url: 'https://a.com/3', windowId: 2 }, { id: 4, url: 'https://a.com/4', windowId: 2 }
  ] });
  await groupBySite.run(ctx(state));
  assert.deepEqual(state.groups.map(g => g.windowId).sort(), [1, 2]);
  assert.deepEqual(Object.keys(await siteGroups()).sort(), ['1:a', '2:a']);
});

test('groupBySite: a tab that navigated to another site moves out of our old site group', async () => {
  const { state } = fakeChrome({
    tabs: [{ id: 1, url: 'https://a.com/1', groupId: 60 }, { id: 2, url: 'https://a.com/2', groupId: 60 }, { id: 3, url: 'https://b.com/1', groupId: 60 }, { id: 4, url: 'https://b.com/2' }],
    groups: [{ id: 60, title: 'a' }]
  });
  await rememberGroup(60);
  await groupBySite.run(ctx(state));
  const b = state.groups.find(g => g.title === 'b');
  assert.ok(b);
  assert.equal(state.tabs.find(t => t.id === 3).groupId, b.id);
  assert.equal(state.tabs.find(t => t.id === 1).groupId, 60);
});

test('groupBySite: running twice changes nothing the second time', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com/1' }, { id: 2, url: 'https://a.com/2' }] });
  await groupBySite.run(ctx(state));
  const res = await groupBySite.run(ctx(state, { tabs: state.tabs }));
  assert.equal(res.grouped, 0);
  assert.equal(state.groups.length, 1);
});

test('groupBySite: a failing group call skips that site only', async () => {
  const { state, chrome } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com/1' }, { id: 2, url: 'https://a.com/2' }, { id: 3, url: 'https://b.com/1' }, { id: 4, url: 'https://b.com/2' }] });
  const real = chrome.tabs.group;
  chrome.tabs.group = async opts => { if (opts.tabIds.includes(1)) throw new Error('drag in progress'); return real(opts); };
  const res = await groupBySite.run(ctx(state));
  assert.equal(res.grouped, 2);
  assert.deepEqual(state.groups.map(g => g.title), ['b']);
  assert.deepEqual([...await ownGroups()], [state.groups[0].id]);
});

test('protect: hold never expires and shows in holds(); unprotect clears it', async () => {
  fakeChrome();
  await hold(7, 'https://a.com', 0);
  await protect(8, 'https://b.com', 0);
  const far = Date.now() + 365 * 24 * HOUR;
  assert.deepEqual([...(await holds(far)).keys()], [7]);
  assert.equal((await protection(far)).has(8), false);
  await unprotect(7);
  assert.equal((await holds()).size, 0);
  await unprotect(999);
});

test('protect: noteNavigation ignores hash changes and unknown tabs', async () => {
  fakeChrome();
  await protect(1, 'https://a.com/x');
  await noteNavigation(1, 'https://a.com/x#section');
  assert.ok((await protection()).has(1));
  await noteNavigation(2, 'https://z.com');
  assert.deepEqual([...(await protection()).keys()], [1]);
});
