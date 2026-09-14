import { planDuplicates } from '../lib/tabs.js';

export default {
  id: 'close-duplicates',
  name: 'Close duplicate tabs',
  description: 'Same URL (ignoring #hash) open more than once: keep one, close the rest.',
  triggers: ['url-changed', 'manual'],

  async run({ tabs, settings, protection, trigger }) {
    const { toClose, toActivate } = planDuplicates(tabs, settings, protection, { ignoreGrace: trigger === 'manual' });
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
