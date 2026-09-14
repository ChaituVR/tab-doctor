import { rules } from './rules/index.js';
import { debounce } from './lib/scheduler.js';
import { flashBadge } from './lib/badge.js';

async function runRules(trigger) {
  const tabs = await chrome.tabs.query({});
  const ctx = { tabs, trigger };
  const results = [];
  for (const rule of rules) {
    if (!rule.triggers.includes(trigger)) continue;
    try {
      results.push({ rule: rule.id, ...(await rule.run(ctx)) });
    } catch (err) {
      console.error(`[Chaitu Manager] rule ${rule.id} failed`, err);
    }
  }
  return results;
}

const onUrlChanged = debounce(() => runRules('url-changed'), 300);
const onTabCreated = debounce(() => runRules('tab-created'), 300);
const onTabRemoved = debounce(() => runRules('tab-removed'), 300);

chrome.tabs.onUpdated.addListener((_id, changeInfo) => {
  if (changeInfo.url) onUrlChanged();
});
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onRemoved.addListener(onTabRemoved);

chrome.action.onClicked.addListener(async () => {
  const results = await runRules('manual');
  const closed = results.reduce((n, r) => n + (r.closed || 0), 0);
  await flashBadge(closed);
});
