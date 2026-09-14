// Tabs Tab Doctor reopened on purpose (Undo, Recently closed, snooze wake) are never closed by dedupe again
// (they become the keeper of their duplicate group) until they navigate to a different page, close, or PROTECT_MS passes.
// For GRACE_MS right after reopening, their whole group is left alone so nothing snaps shut in the user's face.
import { dedupeKey } from './tabs.js';

export const PROTECT_MS = 60 * 60 * 1000;
export const GRACE_MS = 2 * 60 * 1000;
const FOREVER = Number.MAX_SAFE_INTEGER;
const KEY = 'protectedTabs';
const area = () => chrome.storage.session ?? chrome.storage.local;

async function read(now) {
  const map = (await area().get(KEY))[KEY] || {};
  const live = Object.fromEntries(Object.entries(map).filter(([, v]) => v.until > now));
  if (Object.keys(live).length !== Object.keys(map).length) await area().set({ [KEY]: live });
  return live;
}

/** Map<tabId, { until, graceUntil, url }> */
export async function protection(now = Date.now()) {
  return new Map(Object.entries(await read(now)).map(([id, v]) => [Number(id), v]));
}

export async function protect(tabId, url, now = Date.now()) {
  const map = await read(now);
  map[tabId] = { until: now + PROTECT_MS, graceUntil: now + GRACE_MS, url };
  await area().set({ [KEY]: map });
}

/** The user navigated this tab onto a page that is open elsewhere: leave the whole group alone
 *  until the tab moves on or closes. A manual run still cleans up, keeping this tab. */
export async function hold(tabId, url, now = Date.now()) {
  const map = await read(now);
  map[tabId] = { until: FOREVER, graceUntil: FOREVER, url, hold: true };
  await area().set({ [KEY]: map });
}

export async function holds(now = Date.now()) {
  return new Map([...(await protection(now))].filter(([, v]) => v.hold));
}

export async function unprotect(tabId) {
  const map = await read(Date.now());
  if (!(tabId in map)) return;
  delete map[tabId];
  await area().set({ [KEY]: map });
}

/** Drop protection once the tab has moved to a different page. */
export async function noteNavigation(tabId, url) {
  const map = await read(Date.now());
  const entry = map[tabId];
  if (entry && dedupeKey(entry.url) !== dedupeKey(url)) await unprotect(tabId);
}
