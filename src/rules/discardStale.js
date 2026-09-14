import { isDiscardable } from '../lib/tabs.js';

export default {
  id: 'discard-stale',
  name: 'Discard stale tabs',
  description: 'Unload tabs untouched for days to free memory. They stay in place and reload when clicked.',
  triggers: ['alarm', 'manual'],

  async run({ tabs, settings }) {
    const opts = { now: Date.now(), thresholdMs: settings.discardHours * 60 * 60 * 1000 };
    let discarded = 0;
    for (const tab of tabs) {
      if (!isDiscardable(tab, opts)) continue;
      const ok = await chrome.tabs.discard(tab.id).then(() => true, () => false);
      if (ok) discarded++;
    }
    return { discarded };
  }
};
