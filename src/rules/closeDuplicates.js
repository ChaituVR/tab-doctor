import { planDuplicates, duplicateKey, isManageable } from '../lib/tabs.js';

export default {
  id: 'close-duplicates',
  name: 'Close duplicate tabs',
  description: 'Same URL (ignoring #hash) open more than once: keep one, close the rest.',
  triggers: ['url-changed', 'tab-created', 'manual'],

  async run({ tabs, settings, protection, trigger }) {
    const { toClose, keepers } = planDuplicates(tabs, settings, protection, { ignoreGrace: trigger === 'manual' });
    const closed = [];
    const activate = new Map();
    for (const tab of toClose) {
      const [current, keeper] = await Promise.all([
        chrome.tabs.get(tab.id).catch(() => null),
        chrome.tabs.get(keepers.get(tab.id).id).catch(() => null)
      ]);
      const key = duplicateKey(tab, settings);
      if (!current || !keeper || !isManageable(current) || current.pendingUrl || keeper.pendingUrl) continue;
      if (duplicateKey(current, settings) !== key || duplicateKey(keeper, settings) !== key) continue;
      const ok = await chrome.tabs.remove(tab.id).then(() => true, () => false);
      if (ok) {
        closed.push({ url: current.url, windowId: current.windowId, title: current.title });
        if (current.active) activate.set(keeper.windowId, keeper);
      }
    }
    for (const toActivate of activate.values()) {
      await chrome.tabs.update(toActivate.id, { active: true }).catch(() => {});
      await chrome.windows.update(toActivate.windowId, { focused: true }).catch(() => {});
    }
    return { closed };
  }
};
