import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import closeDuplicates from '../src/rules/closeDuplicates.js';
import groupStale from '../src/rules/groupStale.js';
import groupBySite from '../src/rules/groupBySite.js';
import discardStale from '../src/rules/discardStale.js';
import { DEFAULTS, withDefaults, saveSettings, getSettings } from '../src/lib/settings.js';
import { isLeftAlone, siteFromInput, planDuplicates } from '../src/lib/tabs.js';
import { validateBackup, serializeBackup } from '../src/lib/backup.js';

const HOUR = 60 * 60 * 1000;
const settings = (over = {}) => withDefaults({ ...DEFAULTS, ...over });
const ctx = (state, over = {}) => ({ tabs: state.tabs, settings: settings(), trigger: 'url-changed', protection: new Map(), ...over });
const alone = list => settings({ leaveAlone: list });

test('isLeftAlone: exact site, any subdomain, never for other sites or non-web tabs', () => {
  const s = alone(['github.com', 'localhost']);
  assert.equal(isLeftAlone({ url: 'https://github.com/x' }, s), true);
  assert.equal(isLeftAlone({ url: 'https://gist.github.com/x' }, s), true);
  assert.equal(isLeftAlone({ url: 'http://localhost:3000/' }, s), true);
  assert.equal(isLeftAlone({ url: 'https://notgithub.com/' }, s), false);
  assert.equal(isLeftAlone({ url: 'https://github.community/' }, s), false);
  assert.equal(isLeftAlone({ url: 'chrome://extensions' }, s), false);
  assert.equal(isLeftAlone({ url: 'https://github.com' }, settings()), false);
  assert.equal(isLeftAlone(undefined, s), false);
  assert.equal(isLeftAlone({ url: 'https://github.com' }, { leaveAlone: 'github.com' }), false);
});

test('isLeftAlone: a registrable domain covers the split Google products', () => {
  assert.equal(isLeftAlone({ url: 'https://docs.google.com/d/1' }, alone(['google.com'])), true);
  assert.equal(isLeftAlone({ url: 'https://www.google.com/search' }, alone(['docs.google.com'])), false);
});

test('siteFromInput: normalises what people type, rejects junk', () => {
  assert.equal(siteFromInput(' GitHub.com '), 'github.com');
  assert.equal(siteFromInput('https://www.github.com/ChaituVR'), 'github.com');
  assert.equal(siteFromInput('docs.google.com'), 'docs.google.com');
  assert.equal(siteFromInput('gist.github.com'), 'github.com');
  assert.equal(siteFromInput('bbc.co.uk'), 'bbc.co.uk');
  assert.equal(siteFromInput('localhost:8080'), 'localhost');
  assert.equal(siteFromInput('192.168.1.1'), '192.168.1.1');
  for (const junk of ['github', '', '   ', 'chrome://extensions', 'not a url', undefined, 42]) assert.equal(siteFromInput(junk), null, String(junk));
});

test('withDefaults: leaveAlone is normalised, deduped and defaults to empty', () => {
  assert.deepEqual(settings().leaveAlone, []);
  assert.deepEqual(withDefaults({ leaveAlone: 'github.com' }).leaveAlone, []);
  assert.deepEqual(withDefaults({ leaveAlone: ['GitHub.com', 'https://github.com/x', 'nope', 7, 'x.com'] }).leaveAlone, ['github.com', 'x.com']);
});

test('saveSettings: leaveAlone round-trips through storage and backups', async () => {
  fakeChrome();
  await saveSettings({ leaveAlone: ['github.com'] });
  assert.deepEqual((await getSettings()).leaveAlone, ['github.com']);
  const restored = validateBackup(JSON.parse(JSON.stringify(serializeBackup({ settings: await getSettings() }))));
  assert.deepEqual(restored.settings.leaveAlone, ['github.com']);
});

test('closeDuplicates: duplicates on a left-alone site stay open, others still close', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://github.com/a' }, { id: 2, url: 'https://github.com/a' },
    { id: 3, url: 'https://x.com/1' }, { id: 4, url: 'https://x.com/1' }
  ] });
  const res = await closeDuplicates.run(ctx(state, { settings: alone(['github.com']) }));
  assert.deepEqual(state.removed, [4]);
  assert.equal(res.closed.length, 1);
  assert.equal(planDuplicates(state.tabs, alone(['github.com', 'x.com'])).toClose.length, 0);
});

test('groupStale: stale tabs from a left-alone site are not folded', async () => {
  const old = Date.now() - 48 * HOUR;
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://github.com/a', lastAccessed: old }, { id: 2, url: 'https://x.com', lastAccessed: old }] });
  const res = await groupStale.run(ctx(state, { settings: alone(['github.com']) }));
  assert.equal(res.grouped, 1);
  assert.equal(state.tabs.find(t => t.id === 1).groupId, -1);
  assert.notEqual(state.tabs.find(t => t.id === 2).groupId, -1);
});

test('discardStale: left-alone tabs keep their memory', async () => {
  const old = Date.now() - 100 * HOUR;
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://github.com/a', lastAccessed: old }, { id: 2, url: 'https://x.com', lastAccessed: old }] });
  const res = await discardStale.run(ctx(state, { settings: alone(['github.com']) }));
  assert.equal(res.discarded, 1);
  assert.deepEqual(state.discarded, [2]);
});

test('groupBySite: a left-alone site never gets a group, even with many tabs', async () => {
  const { state } = fakeChrome({ tabs: [
    { id: 1, url: 'https://github.com/a' }, { id: 2, url: 'https://github.com/b' }, { id: 3, url: 'https://gist.github.com/c' },
    { id: 4, url: 'https://x.com/1' }, { id: 5, url: 'https://x.com/2' }
  ] });
  const res = await groupBySite.run(ctx(state, { settings: alone(['github.com']) }));
  assert.equal(res.grouped, 2);
  assert.deepEqual(state.groups.map(g => g.title), ['x']);
  assert.ok([1, 2, 3].every(id => state.tabs.find(t => t.id === id).groupId === -1));
});
