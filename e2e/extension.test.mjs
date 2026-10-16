import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { launch } from './harness.mjs';
import { writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let h;
before(async () => { h = await launch(); });
after(async () => { await h?.close(); });
beforeEach(async () => { await h.reset(); await h.saveSettings({ leaveAlone: [], smartNames: false, rules: { 'group-by-site': false } }); });

const settled = () => new Promise(r => setTimeout(r, 900));

test('service worker boots, restores the hourly alarm, reports no error', async () => {
  const alarm = await h.inSw(() => chrome.alarms.get('hourly'));
  assert.ok(alarm, 'hourly alarm exists');
  assert.ok(!(await h.local('lastError')), 'no lastError');
});

test('privacy: neither the service worker nor an extension page can reach the network', async () => {
  const ping = h.url('/ping');
  assert.match(await h.inSw(u => fetch(u).then(r => `status ${r.status}`, e => `blocked: ${e.message}`), ping), /blocked/);
  const page = await h.ctx.newPage();
  await page.goto(h.ext('src/popup/popup.html'));
  assert.match(await page.evaluate(u => fetch(u).then(r => `status ${r.status}`, e => `blocked: ${e.message}`), ping), /blocked/);
  await page.close();
});

test('duplicates: opening a page twice closes the newer copy and remembers it for undo', async () => {
  const first = await h.openTab(h.url('/dup'));
  await settled();
  const second = await h.openTab(h.url('/dup'));
  await h.until(async () => !(await h.tabs()).some(t => t.id === second.id), 'second copy to close');
  assert.ok((await h.tabs()).some(t => t.id === first.id), 'first copy stays');
  const history = await h.until(() => h.local('history'), 'history entry');
  assert.equal(history[0].url, h.url('/dup'));
  assert.equal((await h.local('lastClosed')).length, 1);
});

test('hold on navigate: browsing an existing tab onto an open page keeps both', async () => {
  const twin = await h.openTab(h.url('/held'));
  const mover = await h.openTab(h.url('/elsewhere'));
  await settled();
  await h.inSw(([id, u]) => chrome.tabs.update(id, { url: u }), [mover.id, h.url('/held')]);
  await h.until(async () => (await h.session('protectedTabs'))?.[mover.id]?.hold, 'hold to be recorded');
  await settled();
  const ids = (await h.tabs()).map(t => t.id);
  assert.ok(ids.includes(twin.id) && ids.includes(mover.id), 'both tabs stay open');
});

test('leave alone: a listed site is never deduplicated', async () => {
  await h.saveSettings({ leaveAlone: ['localhost'] });
  await h.openTab(h.altUrl('/alone'));
  await settled();
  await h.openTab(h.altUrl('/alone'));
  await settled(); await settled();
  assert.equal((await h.siteTabs()).filter(t => t.url.endsWith('/alone')).length, 2);
  assert.equal(await h.local('lastClosed'), undefined);
});

test('group by site: two tabs form one group, and a restart never creates a second one', async () => {
  await h.saveSettings({ rules: { 'group-by-site': true } });
  await h.openTab(h.url('/g1'));
  await h.openTab(h.url('/g2'));
  const groups = await h.until(async () => { const g = await h.groups(); return g.length ? g : null; }, 'a site group');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].title, '127.0.0.1');
  await h.inSw(() => chrome.storage.session.remove(['ownGroups', 'siteGroups'])); // what a browser restart does
  await h.openTab(h.url('/g3'));
  await h.until(async () => (await h.siteTabs()).filter(t => t.groupId === groups[0].id).length === 3, 'third tab to join');
  assert.equal((await h.groups()).length, 1, 'still one group');
});

test('leave alone: a listed site is never grouped', async () => {
  await h.saveSettings({ rules: { 'group-by-site': true }, leaveAlone: ['127.0.0.1'] });
  await h.openTab(h.url('/n1'));
  await h.openTab(h.url('/n2'));
  await settled(); await settled();
  assert.equal((await h.groups()).length, 0);
});

test('smart names: without an on-device model the group keeps its plain label and nothing errors', async () => {
  const hasModel = await h.inSw(() => typeof LanguageModel !== 'undefined');
  await h.saveSettings({ smartNames: true, rules: { 'group-by-site': true } });
  await h.openTab(h.altUrl('/s1'));
  await h.openTab(h.altUrl('/s2'));
  const groups = await h.until(async () => { const g = await h.groups(); return g.length ? g : null; }, 'a site group');
  await settled(); await settled();
  assert.equal((await h.groups())[0].title, hasModel ? (await h.groups())[0].title : 'localhost');
  assert.ok(!(await h.local('lastError')), 'no lastError');
  assert.equal(groups.length, 1);
});

test('snooze: the tab closes, an alarm is set, waking reopens it under protection', async () => {
  const tab = await h.openTab(h.url('/snooze'));
  const page = await h.ctx.newPage();
  await page.goto(h.ext('src/options/options.html'));
  const res = await page.evaluate(([tabId, wakeAt]) => chrome.runtime.sendMessage({ type: 'snooze-custom', tabId, wakeAt }), [tab.id, Date.now() + 60 * 60 * 1000]);
  assert.deepEqual(res, { ok: true });
  await h.until(async () => !(await h.tabs()).some(t => t.id === tab.id), 'snoozed tab to close');
  const [entry] = await h.local('snoozed');
  assert.equal(entry.url, h.url('/snooze'));
  assert.ok(await h.inSw(id => chrome.alarms.get(`snooze:${id}`), entry.id), 'wake alarm exists');
  const woke = await page.evaluate(id => chrome.runtime.sendMessage({ type: 'snooze-wake', id }), entry.id);
  assert.deepEqual(woke, { ok: true });
  await h.until(async () => (await h.siteTabs()).some(t => t.url.endsWith('/snooze')), 'tab to reopen');
  assert.deepEqual(await h.local('snoozed'), []);
  const protectedTabs = await h.session('protectedTabs');
  assert.ok(Object.values(protectedTabs).some(p => p.url === h.url('/snooze')), 'reopened tab is protected from dedupe');
  await page.close();
});

test('popup: shows the leave-alone switch for the active site and toggles the list', async () => {
  const site = await h.openTab(h.url('/popup-site'));
  const popup = await h.ctx.newPage();
  await popup.goto(h.ext('src/popup/popup.html'));
  await h.inSw(id => chrome.tabs.update(id, { active: true }), site.id);
  await popup.reload();
  await popup.waitForSelector('#leaveCard:not([hidden])');
  assert.equal(await popup.textContent('#leaveLabel'), 'Leave 127.0.0.1 alone');
  assert.equal(await popup.isChecked('#leaveSite'), false);
  await popup.click('#leaveSite');
  await h.until(async () => (await h.local('settings'))?.leaveAlone?.includes('127.0.0.1'), 'site to be listed');
  await h.until(() => popup.evaluate(() => document.getElementById('leaveSite').checked && !document.getElementById('leaveSite').disabled), 'switch to settle on');
  await popup.click('#leaveSite');
  await h.until(async () => !(await h.local('settings'))?.leaveAlone?.length, 'site to be removed');
  await popup.close();
});

test('options: the leave-alone card lists, adds and removes sites', async () => {
  await h.saveSettings({ leaveAlone: ['example.org'] });
  const page = await h.ctx.newPage();
  await page.goto(h.ext('src/options/options.html'));
  await page.waitForSelector('#leaveAlone .row .label');
  assert.equal(await page.textContent('#leaveAlone .row .label'), 'example.org');
  await page.fill('#leaveInput', 'GitHub.com/ChaituVR');
  await page.press('#leaveInput', 'Enter');
  await h.until(async () => (await h.local('settings')).leaveAlone.includes('github.com'), 'github.com to be added');
  await page.fill('#leaveInput', 'nonsense');
  await page.click('#leaveAdd');
  await h.until(() => page.evaluate(() => document.getElementById('status').textContent.includes('Enter a domain')), 'validation message');
  await page.waitForSelector('#leaveAlone .row:nth-child(2)');
  await page.click('#leaveAlone .row:first-child .pill');
  await h.until(async () => { const l = (await h.local('settings')).leaveAlone; return l.length === 1 && l[0] === 'github.com'; }, 'example.org to be removed');
  assert.ok(!(await h.local('lastError')), 'no lastError');
  await page.close();
});

test('snooze: a tab Chrome refuses to reopen is retried, then parked in Recently closed', async () => {
  const entry = { id: 'broken', url: 'http://', title: 'Broken link', kind: 'later', wakeAt: Date.now() - 1000, snoozedAt: Date.now() };
  await h.inSw(e => chrome.storage.local.set({ snoozed: [e] }), entry);
  const page = await h.ctx.newPage();
  await page.goto(h.ext('src/options/options.html'));
  const wake = () => page.evaluate(id => chrome.runtime.sendMessage({ type: 'snooze-wake', id }), entry.id);
  for (const attempt of [1, 2]) {
    assert.ok((await wake()).error, `attempt ${attempt} reports the error`);
    assert.equal((await h.local('snoozed'))[0].failures, attempt);
    assert.ok(await h.inSw(id => chrome.alarms.get(`snooze:${id}`), entry.id), 'retry alarm is armed');
  }
  assert.match((await wake()).error, /Recently closed/);
  assert.deepEqual(await h.local('snoozed'), []);
  assert.ok(!(await h.inSw(id => chrome.alarms.get(`snooze:${id}`), entry.id)), 'retry alarm is gone');
  assert.equal((await h.local('history'))[0].url, entry.url);
  await page.close();
});

test('snooze: a local file is refused unless file access is allowed, so the tab is never lost', async () => {
  const allowed = await h.inSw(() => chrome.extension.isAllowedFileSchemeAccess());
  const file = path.join(os.tmpdir(), `tab-doctor-${process.pid}.html`);
  writeFileSync(file, '<!doctype html><title>local</title>');
  const page = await h.ctx.newPage();
  try {
    await page.goto(`file://${file}`);
    const tab = await h.until(async () => (await h.tabs()).find(t => t.url === `file://${file}`), 'the file tab');
    const options = await h.ctx.newPage();
    await options.goto(h.ext('src/options/options.html'));
    const res = await options.evaluate(([tabId, wakeAt]) => chrome.runtime.sendMessage({ type: 'snooze-custom', tabId, wakeAt }), [tab.id, Date.now() + 60 * 60 * 1000]);
    if (allowed) {
      assert.deepEqual(res, { ok: true });
    } else {
      assert.match(res.error, /Allow access to file URLs/);
      assert.ok((await h.tabs()).some(t => t.id === tab.id), 'the tab stays open');
      assert.deepEqual(await h.local('snoozed') ?? [], []);
    }
    await options.close();
  } finally {
    await page.close().catch(() => {});
    rmSync(file, { force: true });
  }
});

test('errors: a stale lastError clears on the next run, even while paused', async () => {
  await h.inSw(() => chrome.storage.local.set({ lastError: 'old failure' }));
  await h.saveSettings({ paused: true });
  try {
    await h.openTab(h.url('/paused'));
    await h.until(async () => (await h.local('lastError')) === null, 'lastError to clear');
  } finally {
    await h.saveSettings({ paused: false });
  }
});
