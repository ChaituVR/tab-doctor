import { groupBy, siteOf, siteLabel, colorFor, NO_GROUP } from '../lib/tabs.js';
import { ownGroups, rememberGroup } from '../lib/groups.js';
import { STALE_GROUP_TITLE } from './groupStale.js';

const MIN_PER_SITE = 2;

export default {
  id: 'group-by-site',
  name: 'Group tabs by site',
  description: 'Two or more tabs from the same site get their own colour-coded tab group. Groups you made yourself are left alone.',
  triggers: ['url-changed', 'manual'],

  async run({ tabs }) {
    const own = await ownGroups();
    const byWindow = groupBy(tabs, t => t.windowId);
    let grouped = 0;

    for (const [windowId, windowTabs] of byWindow) {
      const groups = await chrome.tabGroups.query({ windowId }).catch(() => []);
      const titleOf = new Map(groups.map(g => [g.id, g.title]));
      const candidates = windowTabs.filter(t => {
        if (t.pinned || siteOf(t.url) === null) return false;
        if (t.groupId === NO_GROUP) return true;
        return own.has(t.groupId) && titleOf.get(t.groupId) !== STALE_GROUP_TITLE; // may re-sort our own site groups, never user groups or Stale
      });

      for (const [site, siteTabs] of groupBy(candidates, t => siteOf(t.url))) {
        const label = siteLabel(site);
        const existing = groups.find(g => g.title === label && own.has(g.id));
        const moving = siteTabs.filter(t => t.groupId !== existing?.id);
        if (!existing && siteTabs.length < MIN_PER_SITE) continue;
        if (!moving.length) continue;
        try {
          const tabIds = moving.map(t => t.id);
          const groupId = existing
            ? await chrome.tabs.group({ tabIds, groupId: existing.id })
            : await chrome.tabs.group({ tabIds, createProperties: { windowId } });
          if (!existing) {
            await chrome.tabGroups.update(groupId, { title: label, color: colorFor(site) });
            await rememberGroup(groupId);
          }
          grouped += moving.length;
        } catch (err) {
          console.warn('[Tab Doctor] group-by-site skipped', site, err);
        }
      }
    }
    return { grouped };
  }
};
