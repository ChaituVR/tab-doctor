import { isStale } from '../lib/tabs.js';
import { ownGroups, rememberGroup } from '../lib/groups.js';

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
    // Tabs inside Tab Doctor's own site groups may still go stale; the Stale groups themselves are excluded.
    const own = await ownGroups();
    const staleGroups = new Set((await chrome.tabGroups.query({ title: STALE_GROUP_TITLE }).catch(() => [])).map(g => g.id));
    const allowGroups = new Set([...own].filter(id => !staleGroups.has(id)));
    const opts = { now: Date.now(), thresholdMs: settings.staleHours * 60 * 60 * 1000, allowGroups };
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
          await rememberGroup(groupId);
        }
        grouped += tabIds.length;
      } catch (err) {
        console.warn('[Tab Doctor] group-stale skipped window', windowId, err);
      }
    }
    return { grouped };
  }
};
