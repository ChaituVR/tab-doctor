// Remembers the last real page each tab showed, so a URL change can be told apart:
// the first page a tab shows was "opened" (dedupe applies); a different page later means the
// user navigated inside the tab, and that tab is theirs to keep.
import { dedupeKey } from './tabs.js';

const KEY = 'lastUrls';
const area = () => chrome.storage.session ?? chrome.storage.local;

async function read() {
  return (await area().get(KEY))[KEY] || {};
}

/** Records the tab's new URL. Returns true when this was a navigation from one real page to a different one. */
export async function noteUrl(tabId, url) {
  const map = await read();
  const prevKey = map[tabId] ? dedupeKey(map[tabId]) : null;
  const key = dedupeKey(url);
  if (key === null) delete map[tabId]; else map[tabId] = url;
  await area().set({ [KEY]: map });
  return prevKey !== null && key !== null && prevKey !== key;
}

export async function forgetUrl(tabId) {
  const map = await read();
  if (!(tabId in map)) return;
  delete map[tabId];
  await area().set({ [KEY]: map });
}

/** Treat every open tab's current page as already shown (browser start, extension install). */
export async function seedUrls(tabs) {
  const map = {};
  for (const t of tabs) if (t.id != null && dedupeKey(t.url) !== null) map[t.id] = t.url;
  await area().set({ [KEY]: map });
}
