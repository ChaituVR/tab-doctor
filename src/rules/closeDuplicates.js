import { dedupeKey, groupBy, isManageable, newestFirst } from '../lib/tabs.js';

export default {
  id: 'close-duplicates',
  name: 'Close duplicate tabs',
  description: 'Same URL (ignoring #hash) open more than once: keep the newest, close the rest.',
  triggers: ['url-changed', 'manual'],

  async run({ tabs }) {
    const groups = groupBy(tabs.filter(isManageable), t => dedupeKey(t.url));
    const toClose = [];
    let toActivate = null;

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...rest] = newestFirst(group);
      if (rest.some(t => t.active)) toActivate = keep;
      toClose.push(...rest.map(t => t.id));
    }

    if (toClose.length) await chrome.tabs.remove(toClose);
    if (toActivate) {
      await chrome.tabs.update(toActivate.id, { active: true });
      await chrome.windows.update(toActivate.windowId, { focused: true });
    }
    return { closed: toClose.length };
  }
};
