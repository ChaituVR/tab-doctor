import { rules } from './rules/index.js';
import { debounce, createQueue } from './lib/scheduler.js';
import { getSettings, saveSettings, getLastClosed, setLastClosed } from './lib/settings.js';
import { STALE_GROUP_TITLE } from './rules/groupStale.js';
import { SNOOZE_OPTIONS, computeWakeAt, alarmName, addSnoozed, removeSnoozed, listSnoozed, saveSnoozed } from './lib/snooze.js';
import { addHistory, removeHistory, saveHistory, listHistory } from './lib/history.js';
import { validateBackup, mergeHistory, mergeSnoozed } from './lib/backup.js';
import { protection, protect, unprotect, noteNavigation, hold, holds } from './lib/protect.js';
import { noteUrl, forgetUrl, seedUrls } from './lib/navigation.js';
import { duplicateKey, isManageable, isRestorableUrl, isLeftAlone, siteOf } from './lib/tabs.js';
import { forgetGroup } from './lib/groups.js';
import { nameGroups } from './lib/namer.js';

const enqueue = createQueue();
const runEvent = task => enqueue(task).catch(err => chrome.storage.local.set({ lastError: String(err) }).catch(() => {}));

async function runRules(trigger) {
  const results = await applyRules(trigger);
  await reconcileHolds();
  return results;
}

async function applyRules(trigger) {
  const settings = await getSettings();
  const enabled = settings.paused && trigger !== 'manual'
    ? []
    : rules.filter(rule => rule.triggers.includes(trigger) && settings.rules[rule.id] !== false);
  if (!enabled.length) { await chrome.storage.local.set({ lastError: null }); return []; }
  const results = [];
  for (const rule of enabled) {
    try {
      const ctx = { tabs: await chrome.tabs.query({}), settings, trigger, protection: await protection() };
      results.push({ rule: rule.id, ...(await rule.run(ctx)) });
    } catch (err) {
      results.push({ rule: rule.id, error: String(err) });
    }
  }

  const closed = results.flatMap(r => (r.closed || []).map(t => ({ ...t, rule: r.rule })));
  const grouped = results.reduce((n, r) => n + (r.grouped || 0), 0);
  const discarded = results.reduce((n, r) => n + (r.discarded || 0), 0);
  const created = results.flatMap(r => r.created || []);
  if (created.length) nameGroups(created).catch(err => chrome.storage.local.set({ lastError: String(err) }).catch(() => {}));
  if (closed.length) {
    await setLastClosed(closed);
    const closedAt = Date.now();
    await addHistory(closed.map(t => ({ url: t.url, title: t.title || t.url, closedAt, rule: t.rule })));
  }
  await chrome.storage.local.set({ lastRun: { at: Date.now(), trigger, closed: closed.length, grouped, discarded }, lastError: results.filter(r => r.error).map(r => r.error).join('; ') || null });
  return results;
}

async function reopen(props) {
  const tab = await chrome.tabs.create(props).catch(err => {
    if (props.windowId == null) throw err;
    return chrome.tabs.create({ url: props.url, active: props.active });
  });
  await protect(tab.id, props.url);
  return tab;
}

async function undoLastClose() {
  const closed = await getLastClosed();
  for (const [index, t] of closed.entries()) {
    await reopen({ url: t.url, windowId: t.windowId, active: false });
    await setLastClosed(closed.slice(index + 1));
  }
  return closed.length;
}

async function refreshBadge() {
  const { paused } = await getSettings();
  await chrome.action.setBadgeText({ text: paused ? 'II' : '' });
  for (const tab of await chrome.tabs.query({})) await chrome.action.setBadgeText({ tabId: tab.id, text: paused ? 'II' : '' }).catch(() => {});
  await reconcileHolds();
}

/** Other manageable tabs showing the same page as `tab`, under the current duplicate settings. */
async function twinsOf(tab, settings, tabs) {
  const key = tab && isManageable(tab) && !isLeftAlone(tab, settings) ? duplicateKey(tab, settings) : null;
  if (key === null) return [];
  return (tabs ?? await chrome.tabs.query({})).filter(t => t.id !== tab.id && isManageable(t) && !isLeftAlone(t, settings) && duplicateKey(t, settings) === key);
}

async function setDuplicateBadge(tabId, count) {
  const { paused } = await getSettings();
  const text = paused ? 'II' : count ? `×${count + 1}` : '';
  await chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (!count) {
    await chrome.action.setTitle({ tabId, title: 'Tab Doctor' }).catch(() => {});
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff9f0a' }).catch(() => {});
  await chrome.action.setTitle({ tabId, title: `Tab Doctor — this page is open in ${count + 1} tabs. Kept because you navigated here.` }).catch(() => {});
}

/** The user browsed this tab onto a page that is open elsewhere: keep both, mark the badge. */
async function holdIfDuplicate(tab) {
  const settings = await getSettings();
  if (settings.paused || !settings.holdOnNavigate || !tab) return;
  const twins = await twinsOf(tab, settings);
  if (!twins.length) return;
  await hold(tab.id, tab.url);
  await setDuplicateBadge(tab.id, twins.length);
}

/** Drop holds whose tab is gone, moved on, or no longer has a twin; keep badge counts current. */
async function reconcileHolds() {
  const held = await holds();
  if (!held.size) return;
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({});
  for (const [tabId] of held) {
    const tab = tabs.find(t => t.id === tabId);
    const twins = tab && settings.holdOnNavigate ? await twinsOf(tab, settings, tabs) : [];
    if (twins.length) { await setDuplicateBadge(tabId, twins.length); continue; }
    await unprotect(tabId);
    if (tab) await setDuplicateBadge(tabId, 0);
  }
}

const onUrlChanged = debounce(() => runEvent(() => runRules('url-changed')), 300);
const onTabCreated = debounce(() => runEvent(() => runRules('tab-created')), 300);
const onTabRemoved = debounce(() => runEvent(() => runRules('tab-removed')), 300);

chrome.tabs.onUpdated.addListener((id, changeInfo, tab) => {
  if (!changeInfo.url) return;
  return runEvent(async () => {
    await noteNavigation(id, changeInfo.url);
    const navigated = await noteUrl(id, changeInfo.url);
    await setDuplicateBadge(id, 0);
    if (navigated) await holdIfDuplicate(tab ?? await chrome.tabs.get(id).catch(() => null));
    if (tab?.active) await syncLeaveMenu(tab);
    onUrlChanged();
  });
});
chrome.tabs.onRemoved.addListener(id => runEvent(async () => { await unprotect(id); await forgetUrl(id); onTabRemoved(); }));
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) return runEvent(async () => { await refreshBadge(); await syncLeaveMenuForActiveTab(); }); });
chrome.tabGroups.onRemoved.addListener(group => runEvent(() => forgetGroup(group.id)));

const WAKE_RETRY_MS = 60000;
const WAKE_ATTEMPTS = 3;

/** Reopens a snoozed tab. A URL Chrome refuses (file: without file access) is retried a few times, then parked in Recently closed. */
async function wakeSnoozed(id) {
  const entry = (await listSnoozed()).find(item => item.id === id);
  if (!entry) return false;
  try { await reopen({ url: entry.url, active: false }); }
  catch (err) {
    const failures = (entry.failures || 0) + 1;
    if (failures < WAKE_ATTEMPTS) {
      await saveSnoozed((await listSnoozed()).map(item => item.id === id ? { ...item, failures } : item));
      await chrome.alarms.create(alarmName(id), { when: Date.now() + WAKE_RETRY_MS }).catch(() => {});
      throw err;
    }
    await removeSnoozed(id);
    await chrome.alarms.clear(alarmName(id));
    await addHistory([{ url: entry.url, title: entry.title || entry.url, closedAt: Date.now(), rule: 'snooze' }]);
    throw new Error(`Could not reopen "${entry.title || entry.url}" after ${WAKE_ATTEMPTS} tries, so it was moved to Recently closed. ${err?.message || err}`);
  }
  await removeSnoozed(id);
  await chrome.alarms.clear(alarmName(id));
  return true;
}

async function snoozeTab(tab, kind, customWakeAt) {
  if (!tab?.url || tab.id == null || !isRestorableUrl(tab.url)) throw new Error('Only web pages and local files can be snoozed.');
  if (tab.url.startsWith('file:') && !await chrome.extension.isAllowedFileSchemeAccess()) throw new Error('To snooze local files, turn on "Allow access to file URLs" for Tab Doctor in chrome://extensions.');
  const id = `${Date.now()}-${tab.id}`;
  const wakeAt = kind === 'custom' ? customWakeAt : computeWakeAt(kind);
  await addSnoozed({ id, url: tab.url, title: tab.title || tab.url, kind, wakeAt, snoozedAt: Date.now() });
  try {
    await chrome.alarms.create(alarmName(id), { when: wakeAt });
    await chrome.tabs.remove(tab.id);
  }
  catch (err) {
    await removeSnoozed(id);
    await chrome.alarms.clear(alarmName(id));
    throw err;
  }
}

async function reopenFromHistory(closedAt, url) {
  const entry = (await listHistory()).find(item => item.closedAt === closedAt && item.url === url);
  if (!entry) return false;
  await reopen({ url: entry.url, active: true });
  await removeHistory(closedAt, url);
  return true;
}

async function importBackup(raw) {
  const data = validateBackup(raw);
  await chrome.storage.local.set({ settings: data.settings });
  const snoozed = mergeSnoozed(await listSnoozed(), data.snoozed);
  await saveSnoozed(snoozed);
  for (const e of snoozed) await chrome.alarms.create(alarmName(e.id), { when: Math.max(e.wakeAt, Date.now() + 1000) });
  await saveHistory(mergeHistory(await listHistory(), data.history));
  return { settings: true, snoozed: data.snoozed.length, history: data.history.length };
}

async function wakeOverdue() {
  const now = Date.now();
  for (const entry of await listSnoozed()) {
    if (entry.wakeAt <= now) {
      try { await wakeSnoozed(entry.id); }
      catch (err) { await chrome.storage.local.set({ lastError: String(err) }); }
    }
  }
}

async function restoreAlarms() {
  if (!await chrome.alarms.get('hourly')) await chrome.alarms.create('hourly', { periodInMinutes: 60 });
  for (const entry of await listSnoozed()) {
    if (!await chrome.alarms.get(alarmName(entry.id))) await chrome.alarms.create(alarmName(entry.id), { when: Math.max(entry.wakeAt, Date.now() + 1000) });
  }
}

/** Adds or removes the tab's site from the leave-alone list. Returns the new state, or null when the tab has no site. */
async function toggleLeaveAlone(tab) {
  const site = siteOf(tab?.url);
  if (site === null) return null;
  const { leaveAlone } = await getSettings();
  const leftAlone = !leaveAlone.includes(site);
  await saveSettings({ leaveAlone: leftAlone ? [...leaveAlone, site] : leaveAlone.filter(s => s !== site) });
  return leftAlone;
}

async function syncLeaveMenu(tab) {
  const site = siteOf(tab?.url);
  const settings = await getSettings();
  await chrome.contextMenus.update('leave-site', {
    enabled: site !== null,
    checked: site !== null && isLeftAlone(tab, settings),
    title: site ? `Leave ${site} alone` : 'Leave this site alone'
  }).catch(() => {});
}

async function syncLeaveMenuForActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }).catch(() => []);
  if (tab) await syncLeaveMenu(tab);
}

async function installContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'snooze', title: 'Snooze tab', contexts: ['page', 'action'] });
  for (const opt of SNOOZE_OPTIONS) {
    chrome.contextMenus.create({ id: `snooze-${opt.id}`, parentId: 'snooze', title: opt.title, contexts: ['page', 'action'] });
  }
  chrome.contextMenus.create({ id: 'snooze-sep', parentId: 'snooze', type: 'separator', contexts: ['page', 'action'] });
  chrome.contextMenus.create({ id: 'snooze-custom', parentId: 'snooze', title: 'Pick date & time…', contexts: ['page', 'action'] });
  chrome.contextMenus.create({ id: 'leave-site', type: 'checkbox', title: 'Leave this site alone', contexts: ['action'] });
}

async function openSnoozePicker(tab) {
  if (!tab?.id) return;
  const url = chrome.runtime.getURL(`src/snooze/snooze.html?tabId=${tab.id}&title=${encodeURIComponent(tab.title || tab.url || '')}`);
  const size = { width: 400, height: 300 };
  const parent = tab.windowId != null ? await chrome.windows.get(tab.windowId).catch(() => null) : null;
  const position = parent
    ? { left: Math.round(parent.left + (parent.width - size.width) / 2), top: Math.round(parent.top + (parent.height - size.height) / 2) }
    : {};
  await chrome.windows.create({ url, type: 'popup', focused: true, ...size, ...position });
}

async function init() {
  await seedUrls(await chrome.tabs.query({}));
  await refreshBadge();
  await restoreAlarms();
  await installContextMenus();
  await syncLeaveMenuForActiveTab();
  await wakeOverdue();
}

chrome.contextMenus.onClicked.addListener((info, tab) => runEvent(async () => {
  if (info.menuItemId === 'leave-site') { await toggleLeaveAlone(tab); await syncLeaveMenu(tab); return; }
  const kind = String(info.menuItemId).replace(/^snooze-/, '');
  if (kind === 'custom') await openSnoozePicker(tab);
  else if (SNOOZE_OPTIONS.some(o => o.id === kind)) await snoozeTab(tab, kind);
}));
chrome.runtime.onStartup.addListener(() => runEvent(init));
chrome.runtime.onInstalled.addListener(() => runEvent(init));
chrome.alarms.onAlarm.addListener(alarm => runEvent(async () => {
  if (alarm.name === 'hourly') { await wakeOverdue(); await runRules('alarm'); }
  else if (alarm.name.startsWith('snooze:')) await wakeSnoozed(alarm.name.slice('snooze:'.length));
}));

chrome.tabs.onActivated.addListener(({ tabId }) => runEvent(async () => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  await syncLeaveMenu(tab);
  if ((await getSettings()).paused) return;
  if (!tab || tab.groupId === -1) return;
  const group = await chrome.tabGroups.get(tab.groupId).catch(() => null);
  if (group?.title === STALE_GROUP_TITLE) await chrome.tabs.ungroup(tabId).catch(() => {});
}));

chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) runEvent(syncLeaveMenuForActiveTab);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    'save-settings': async () => ({ settings: await saveSettings(msg.patch) }),
    'run-now': async () => {
      const results = await runRules('manual');
      return {
        closed: results.flatMap(r => r.closed || []).length,
        grouped: results.reduce((n, r) => n + (r.grouped || 0), 0),
        discarded: results.reduce((n, r) => n + (r.discarded || 0), 0),
        error: results.filter(r => r.error).map(r => r.error).join('; ') || undefined
      };
    },
    'undo': async () => ({ reopened: await undoLastClose() }),
    'snooze-wake': async () => ({ ok: await wakeSnoozed(msg.id) }),
    'snooze-cancel': async () => {
      await removeSnoozed(msg.id);
      await chrome.alarms.clear(alarmName(msg.id));
      return { ok: true };
    },
    'history-reopen': async () => ({ ok: await reopenFromHistory(msg.closedAt, msg.url) }),
    'snooze-custom': async () => {
      const tab = await chrome.tabs.get(msg.tabId);
      if (!Number.isFinite(msg.wakeAt) || msg.wakeAt < Date.now()) throw new Error('wake time must be in the future');
      await snoozeTab(tab, 'custom', msg.wakeAt);
      return { ok: true };
    },
    'snooze-picker': async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      await openSnoozePicker(tab);
      return { ok: true };
    },
    'tab-status': async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const settings = await getSettings();
      const twins = await twinsOf(tab, settings);
      const site = siteOf(tab?.url);
      return { tabId: tab?.id ?? null, site, leftAlone: site !== null && isLeftAlone(tab, settings), held: tab ? (await holds()).has(tab.id) : false, twins: twins.map(t => ({ id: t.id, windowId: t.windowId, title: t.title })) };
    },
    'leave-site': async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const leftAlone = await toggleLeaveAlone(tab);
      if (tab) await syncLeaveMenu(tab);
      return { leftAlone };
    },
    'activate-tab': async () => {
      const tab = await chrome.tabs.get(msg.tabId);
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
      return { ok: true };
    },
    'close-tab': async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab) await chrome.tabs.remove(tab.id);
      return { ok: true };
    },
    'history-clear': async () => { await saveHistory([]); return { ok: true }; },
    'import': async () => importBackup(msg.data)
  };
  const handler = Object.hasOwn(handlers, msg?.type) ? handlers[msg.type] : null;
  if (!handler) return false;
  enqueue(handler).then(sendResponse).catch(err => sendResponse({ error: String(err) }));
  return true;
});

runEvent(restoreAlarms);
