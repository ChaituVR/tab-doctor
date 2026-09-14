import { rules } from './rules/index.js';
import { debounce } from './lib/scheduler.js';
import { getSettings, getLastClosed, setLastClosed } from './lib/settings.js';
import { STALE_GROUP_TITLE } from './rules/groupStale.js';
import { SNOOZE_OPTIONS, computeWakeAt, alarmName, addSnoozed, removeSnoozed, listSnoozed } from './lib/snooze.js';

async function runRules(trigger) {
  const settings = await getSettings();
  if (settings.paused && trigger !== 'manual') return [];

  const tabs = await chrome.tabs.query({});
  const ctx = { tabs, settings, trigger };
  const results = [];
  for (const rule of rules) {
    if (!rule.triggers.includes(trigger) || settings.rules[rule.id] === false) continue;
    try {
      results.push({ rule: rule.id, ...(await rule.run(ctx)) });
    } catch (err) {
      console.error(`[Chaitu Manager] rule ${rule.id} failed`, err);
    }
  }

  const closed = results.flatMap(r => r.closed || []);
  const grouped = results.reduce((n, r) => n + (r.grouped || 0), 0);
  if (closed.length) await setLastClosed(closed);
  await chrome.storage.local.set({ lastRun: { at: Date.now(), trigger, closed: closed.length, grouped } });
  return results;
}

async function undoLastClose() {
  const closed = await getLastClosed();
  for (const t of closed) {
    await chrome.tabs.create({ url: t.url, windowId: t.windowId, active: false }).catch(() => chrome.tabs.create({ url: t.url, active: false }));
  }
  await setLastClosed([]);
  return closed.length;
}

async function refreshBadge() {
  const { paused } = await getSettings();
  await chrome.action.setBadgeText({ text: paused ? 'II' : '' });
}

const onUrlChanged = debounce(() => runRules('url-changed'), 300);
const onTabCreated = debounce(() => runRules('tab-created'), 300);
const onTabRemoved = debounce(() => runRules('tab-removed'), 300);

chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.url) onUrlChanged();
});
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.storage.onChanged.addListener(refreshBadge);

async function wakeSnoozed(id) {
  const entry = await removeSnoozed(id);
  if (!entry) return false;
  await chrome.alarms.clear(alarmName(id));
  await chrome.tabs.create({ url: entry.url, active: false });
  return true;
}

async function snoozeTab(tab, kind) {
  if (!tab?.url || !tab.id) return;
  const id = `${Date.now()}-${tab.id}`;
  const wakeAt = computeWakeAt(kind);
  await addSnoozed({ id, url: tab.url, title: tab.title || tab.url, kind, wakeAt, snoozedAt: Date.now() });
  await chrome.alarms.create(alarmName(id), { when: wakeAt });
  await chrome.tabs.remove(tab.id).catch(() => {});
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
}

async function init() {
  await refreshBadge();
  await chrome.alarms.create('hourly', { periodInMinutes: 60 });
  await installContextMenus();
  await wakeOverdue();
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const kind = String(info.menuItemId).replace(/^snooze-/, '');
  if (SNOOZE_OPTIONS.some(o => o.id === kind)) snoozeTab(tab, kind);
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
        grouped: results.reduce((n, r) => n + (r.grouped || 0), 0)
      };
    },
    'undo': async () => ({ reopened: await undoLastClose() }),
    'snooze-wake': async () => ({ ok: await wakeSnoozed(msg.id) }),
    'snooze-cancel': async () => {
      await removeSnoozed(msg.id);
      await chrome.alarms.clear(alarmName(msg.id));
      return { ok: true };
    }
  };
  const handler = handlers[msg?.type];
  if (!handler) return false;
  handler().then(sendResponse).catch(err => sendResponse({ error: String(err) }));
  return true;
});
