import { duplicateKey, groupBy, isManageable, newestFirst } from '../lib/tabs.js';

export default {
  id: 'close-duplicates',
  name: 'Close duplicate tabs',
  description: 'Same URL (ignoring #hash) open more than once: keep the newest, close the rest.',
  triggers: ['url-changed', 'manual'],

  async run({ tabs, settings }) {
    const groups = groupBy(tabs.filter(isManageable), t => duplicateKey(t, settings));
    const toClose = [];
    let toActivate = null;

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...rest] = newestFirst(group);
      if (rest.some(t => t.active)) toActivate = keep;
      toClose.push(...rest);
    }

    const closed = [];
    for (const tab of toClose) {
      const ok = await chrome.tabs.remove(tab.id).then(() => true, () => false);
      if (ok) closed.push({ url: tab.url, windowId: tab.windowId, title: tab.title });
    }
    if (toActivate && closed.length) {
      await chrome.tabs.update(toActivate.id, { active: true }).catch(() => {});
      await chrome.windows.update(toActivate.windowId, { focused: true }).catch(() => {});
    }
    return { closed };
  }
};
