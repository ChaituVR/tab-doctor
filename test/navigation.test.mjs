import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import { noteUrl, forgetUrl, seedUrls } from '../src/lib/navigation.js';
import { hold, holds, protection, unprotect } from '../src/lib/protect.js';
import closeDuplicates from '../src/rules/closeDuplicates.js';
import { DEFAULTS, withDefaults } from '../src/lib/settings.js';
import { validateBackup } from '../src/lib/backup.js';

test('noteUrl: first real page is an open, a later different page is a navigation', async () => {
  fakeChrome();
  assert.equal(await noteUrl(1, 'chrome://newtab/'), false);
  assert.equal(await noteUrl(1, 'https://a.com/x'), false, 'first page after newtab counts as opened');
  assert.equal(await noteUrl(1, 'https://a.com/x#section'), false, 'hash change is the same page');
  assert.equal(await noteUrl(1, 'https://b.com'), true, 'moving to another page is a navigation');
  assert.equal(await noteUrl(1, 'chrome://settings'), false);
  assert.equal(await noteUrl(1, 'https://c.com'), false, 'coming back from an internal page counts as opened again');
});

test('noteUrl: seeded tabs count as already shown, forgotten tabs start over', async () => {
  fakeChrome();
  await seedUrls([{ id: 4, url: 'https://a.com' }, { id: 5, url: 'chrome://extensions' }]);
  assert.equal(await noteUrl(4, 'https://b.com'), true);
  assert.equal(await noteUrl(5, 'https://b.com'), false);
  await forgetUrl(4);
  assert.equal(await noteUrl(4, 'https://c.com'), false);
});

test('hold: the navigated tab and its twin both stay, a manual run keeps the navigated one', async () => {
  const { state } = fakeChrome({ tabs: [{ id: 1, url: 'https://a.com' }, { id: 2, url: 'https://a.com', active: true }] });
  await hold(2, 'https://a.com');
  assert.deepEqual([...(await holds()).keys()], [2]);
  const settings = withDefaults(DEFAULTS);
  await closeDuplicates.run({ tabs: state.tabs, settings, trigger: 'url-changed', protection: await protection() });
  assert.deepEqual(state.removed, [], 'automatic run leaves both');
  await closeDuplicates.run({ tabs: state.tabs, settings, trigger: 'manual', protection: await protection() });
  assert.deepEqual(state.removed, [1], 'Run Now closes the other copy, not the tab being browsed');
  await unprotect(2);
  assert.equal((await holds()).size, 0);
});

test('holdOnNavigate defaults on and survives a backup round-trip', () => {
  assert.equal(withDefaults({}).holdOnNavigate, true);
  const ok = validateBackup({ app: 'tab-doctor', version: 1, settings: { holdOnNavigate: false }, snoozed: [], history: [] });
  assert.equal(ok.settings.holdOnNavigate, false);
  const junk = validateBackup({ app: 'tab-doctor', version: 1, settings: { holdOnNavigate: 'yes' }, snoozed: [], history: [] });
  assert.equal(junk.settings.holdOnNavigate, true);
});
