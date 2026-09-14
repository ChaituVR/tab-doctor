import { isStale, NO_GROUP } from '../lib/tabs.js';

export const STALE_GROUP_TITLE = 'Stale';

async function staleGroupFor(windowId) {
  const [existing] = await chrome.tabGroups.query({ windowId, title: STALE_GROUP_TITLE });
  return existing?.id ?? null;
}

export default {
  id: 'group-stale',
  name: 'Group stale tabs',
  description: 'Tabs not viewed for a while move into a collapsed "Stale" group. Focusing one brings it back.',
  triggers: ['alarm', 'manual'],

  async run({ tabs, settings }) {
    const opts = { now: Date.now(), thresholdMs: settings.staleHours * 60 * 60 * 1000 };
    const byWindow = new Map();
    for (const tab of tabs) {
      if (!isStale(tab, opts)) continue;
      if (!byWindow.has(tab.windowId)) byWindow.set(tab.windowId, []);
      byWindow.get(tab.windowId).push(tab.id);
    }

    let grouped = 0;
    for (const [windowId, tabIds] of byWindow) {
      try {
        const existing = await staleGroupFor(windowId);
        const groupId = existing !== null
          ? await chrome.tabs.group({ tabIds, groupId: existing })
          : await chrome.tabs.group({ tabIds, createProperties: { windowId } });
        if (existing === null) {
          await chrome.tabGroups.update(groupId, { title: STALE_GROUP_TITLE, color: 'grey', collapsed: true });
        }
        grouped += tabIds.length;
      } catch (err) {
        console.warn('[Chaitu Manager] group-stale skipped window', windowId, err);
      }
    }
    return { grouped };
  }
};
