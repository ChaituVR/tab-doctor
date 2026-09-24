import { rules } from './rules/index.js';
import { debounce, serialize } from './lib/scheduler.js';
import { getSettings, getLastClosed, setLastClosed } from './lib/settings.js';
import { STALE_GROUP_TITLE } from './rules/groupStale.js';
import { SNOOZE_OPTIONS, computeWakeAt, alarmName, addSnoozed, removeSnoozed, listSnoozed, saveSnoozed } from './lib/snooze.js';
import { addHistory, removeHistory, saveHistory, listHistory } from './lib/history.js';
import { validateBackup, mergeHistory, mergeSnoozed } from './lib/backup.js';
import { protection, protect, unprotect, noteNavigation, hold, holds } from './lib/protect.js';
import { noteUrl, forgetUrl, seedUrls } from './lib/navigation.js';
import { duplicateKey, isManageable } from './lib/tabs.js';
import { forgetGroup } from './lib/groups.js';
import { nameGroups } from './lib/namer.js';

// Serialised: two overlapping runs each query groups before the other creates one and both create a duplicate.
const runRules = serialize(async trigger => {
  const results = await applyRules(trigger);
  await reconcileHolds();
  return results;
});

async function applyRules(trigger) {
  const settings = await getSettings();
  if (settings.paused && trigger !== 'manual') return [];

  const tabs = await chrome.tabs.query({});
  const ctx = { tabs, settings, trigger, protection: await protection() };
  const results = [];
  for (const rule of rules) {
    if (!rule.triggers.includes(trigger) || settings.rules[rule.id] === false) continue;
    try {
      results.push({ rule: rule.id, ...(await rule.run(ctx)) });
    } catch (err) {
      console.error(`[Tab Doctor] rule ${rule.id} failed`, err);
    }
  }

  const closed = results.flatMap(r => (r.closed || []).map(t => ({ ...t, rule: r.rule })));
  const grouped = results.reduce((n, r) => n + (r.grouped || 0), 0);
  const discarded = results.reduce((n, r) => n + (r.discarded || 0), 0);
  const created = results.flatMap(r => r.created || []);
  if (created.length) nameGroups(created).catch(err => console.warn('[Tab Doctor] smart names failed', err));
  if (closed.length) {
    await setLastClosed(closed);
    const closedAt = Date.now();
    await addHistory(closed.map(t => ({ url: t.url, title: t.title || t.url, closedAt, rule: t.rule })));
  }
  await chrome.storage.local.set({ lastRun: { at: Date.now(), trigger, closed: closed.length, grouped, discarded } });
  return results;
}

async function reopen(props) {
  const tab = await chrome.tabs.create(props).catch(() => chrome.tabs.create({ url: props.url, active: props.active }));
  await protect(tab.id, props.url);
  return tab;
}

async function undoLastClose() {
  const closed = await getLastClosed();
  for (const t of closed) await reopen({ url: t.url, windowId: t.windowId, active: false });
  await setLastClosed([]);
  return closed.length;
}

async function refreshBadge() {
  const { paused } = await getSettings();
  await chrome.action.setBadgeText({ text: paused ? 'II' : '' });
}

/** Other manageable tabs showing the same page as `tab`, under the current duplicate settings. */
async function twinsOf(tab, settings, tabs) {
  const key = tab && isManageable(tab) ? duplicateKey(tab, settings) : null;
  if (key === null) return [];
  return (tabs ?? await chrome.tabs.query({})).filter(t => t.id !== tab.id && isManageable(t) && duplicateKey(t, settings) === key);
}

async function setDuplicateBadge(tabId, count) {
  const text = count ? `×${count + 1}` : '';
  await chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  if (!count) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#ff9f0a' }).catch(() => {});
  await chrome.action.setTitle({ tabId, title: `Tab Doctor — this page is open in ${count + 1} tabs. Kept because you navigated here.` }).catch(() => {});
}

/** The user browsed this tab onto a page that is open elsewhere: keep both, mark the badge. */
async function holdIfDuplicate(tab) {
  const settings = await getSettings();
  if (!settings.holdOnNavigate || !tab) return;
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
    const twins = tab ? await twinsOf(tab, settings, tabs) : [];
    if (twins.length) { await setDuplicateBadge(tabId, twins.length); continue; }
    await unprotect(tabId);
    if (tab) await setDuplicateBadge(tabId, 0);
  }
}

const onUrlChanged = debounce(() => runRules('url-changed'), 300);
const onTabCreated = debounce(() => runRules('tab-created'), 300);
const onTabRemoved = debounce(() => runRules('tab-removed'), 300);

chrome.tabs.onUpdated.addListener(async (id, changeInfo, tab) => {
  if (!changeInfo.url) return;
  await noteNavigation(id, changeInfo.url);
  const navigated = await noteUrl(id, changeInfo.url);
  await setDuplicateBadge(id, 0);
  if (navigated) await holdIfDuplicate(tab ?? await chrome.tabs.get(id).catch(() => null));
  onUrlChanged();
});
chrome.tabs.onRemoved.addListener(id => { unprotect(id); forgetUrl(id); onTabRemoved(); });
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.storage.onChanged.addListener(refreshBadge);
chrome.tabGroups.onRemoved.addListener(group => forgetGroup(group.id));

async function wakeSnoozed(id) {
  const entry = await removeSnoozed(id);
  if (!entry) return false;
  await chrome.alarms.clear(alarmName(id));
  await reopen({ url: entry.url, active: false });
  return true;
}

async function snoozeTab(tab, kind, customWakeAt) {
  if (!tab?.url || !tab.id) return;
  const id = `${Date.now()}-${tab.id}`;
  const wakeAt = kind === 'custom' ? customWakeAt : computeWakeAt(kind);
  await addSnoozed({ id, url: tab.url, title: tab.title || tab.url, kind, wakeAt, snoozedAt: Date.now() });
  await chrome.alarms.create(alarmName(id), { when: wakeAt });
  await chrome.tabs.remove(tab.id).catch(() => {});
}

async function reopenFromHistory(closedAt, url) {
  const entry = await removeHistory(closedAt, url);
  if (!entry) return false;
  await reopen({ url: entry.url, active: true });
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
    if (entry.wakeAt <= now) await wakeSnoozed(entry.id);
  }
}

async function installContextMenus() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'snooze', title: 'Snooze tab', contexts: ['page', 'action'] });
  for (const opt of SNOOZE_OPTIONS) {
    chrome.contextMenus.create({ id: `snooze-${opt.id}`, parentId: 'snooze', title: opt.title, contexts: ['page', 'action'] });
  }
  chrome.contextMenus.create({ id: 'snooze-sep', parentId: 'snooze', type: 'separator', contexts: ['page', 'action'] });
  chrome.contextMenus.create({ id: 'snooze-custom', parentId: 'snooze', title: 'Pick date & time…', contexts: ['page', 'action'] });
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
  await chrome.alarms.create('hourly', { periodInMinutes: 60 });
  await installContextMenus();
  await wakeOverdue();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const kind = String(info.menuItemId).replace(/^snooze-/, '');
  if (kind === 'custom') openSnoozePicker(tab);
  else if (SNOOZE_OPTIONS.some(o => o.id === kind)) snoozeTab(tab, kind);
});
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'hourly') runRules('alarm');
  else if (alarm.name.startsWith('snooze:')) wakeSnoozed(alarm.name.slice('snooze:'.length));
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.groupId === -1) return;
  const group = await chrome.tabGroups.get(tab.groupId).catch(() => null);
  if (group?.title === STALE_GROUP_TITLE) await chrome.tabs.ungroup(tabId).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handlers = {
    'run-now': async () => {
      const results = await runRules('manual');
      return {
        closed: results.flatMap(r => r.closed || []).length,
        grouped: results.reduce((n, r) => n + (r.grouped || 0), 0),
        discarded: results.reduce((n, r) => n + (r.discarded || 0), 0)
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
      const twins = await twinsOf(tab, await getSettings());
      return { tabId: tab?.id ?? null, held: tab ? (await holds()).has(tab.id) : false, twins: twins.map(t => ({ id: t.id, windowId: t.windowId, title: t.title })) };
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
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler().then(sendResponse).catch(err => sendResponse({ error: String(err) }));
  return true;
});
