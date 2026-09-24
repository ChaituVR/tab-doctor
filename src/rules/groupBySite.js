import { groupBy, siteOf, siteLabel, colorFor, NO_GROUP } from '../lib/tabs.js';
import { ownGroups, rememberGroup, siteGroups, rememberSiteGroup } from '../lib/groups.js';
import { groupNames } from '../lib/names.js';
import { STALE_GROUP_TITLE } from './groupStale.js';

const MIN_PER_SITE = 2;

export default {
  id: 'group-by-site',
  name: 'Group tabs by site',
  description: 'Two or more tabs from the same site get their own colour-coded tab group. Groups you made yourself are left alone.',
  triggers: ['url-changed', 'manual'],

  async run({ tabs, settings }) {
    const own = await ownGroups();
    const known = await siteGroups();
    const names = await groupNames();
    const byWindow = groupBy(tabs, t => t.windowId);
    let grouped = 0;
    const created = [];

    for (const [windowId, windowTabs] of byWindow) {
      const groups = await chrome.tabGroups.query({ windowId }).catch(() => []);
      const titleOf = new Map(groups.map(g => [g.id, g.title]));
      const candidates = windowTabs.filter(t => {
        if (t.pinned || siteOf(t.url) === null) return false;
        if (t.groupId === NO_GROUP) return true;
        return own.has(t.groupId) && titleOf.get(t.groupId) !== STALE_GROUP_TITLE; // may re-sort our own site groups, never user groups or Stale
      });

      // Keyed by label so github.com and github.io share one group instead of racing for the same title.
      for (const [label, siteTabs] of groupBy(candidates, t => siteLabel(siteOf(t.url)))) {
        const titles = [label, names[label]].filter(Boolean);
        // Remembered id first (survives retitling), then title (survives a restart, which empties session storage),
        // any same-titled group in the window counts so a restart never spawns a second one.
        const existing = groups.find(g => g.id === known[`${windowId}:${label}`])
          ?? groups.find(g => own.has(g.id) && titles.includes(g.title))
          ?? groups.find(g => titles.includes(g.title));
        const moving = siteTabs.filter(t => t.groupId !== existing?.id);
        if (!existing && siteTabs.length < MIN_PER_SITE) continue;
        if (!moving.length) continue;
        try {
          const tabIds = moving.map(t => t.id);
          const groupId = existing
            ? await chrome.tabs.group({ tabIds, groupId: existing.id })
            : await chrome.tabs.group({ tabIds, createProperties: { windowId } });
          if (!existing) {
            const title = settings.smartNames && names[label] ? names[label] : label;
            await chrome.tabGroups.update(groupId, { title, color: colorFor(label) });
            await rememberGroup(groupId);
            if (settings.smartNames && title === label) created.push({ groupId, label, tabs: siteTabs.map(t => ({ title: t.title, url: t.url })) });
          }
          await rememberSiteGroup(windowId, label, groupId);
          grouped += moving.length;
        } catch (err) {
          console.warn('[Tab Doctor] group-by-site skipped', label, err);
        }
      }
    }
    return { grouped, created };
  }
};
