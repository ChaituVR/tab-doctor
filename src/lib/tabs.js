const IGNORED_SCHEMES = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'devtools:', 'view-source:'];

export function dedupeKey(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (IGNORED_SCHEMES.includes(u.protocol)) return null;
    u.hash = '';
    return u.href;
  } catch {
    return null;
  }
}

export function duplicateKey(tab, { sameWindowOnly }) {
  const key = dedupeKey(tab.url);
  if (key === null) return null;
  return sameWindowOnly ? `${tab.windowId}|${key}` : key;
}

export function isManageable(tab) {
  return !tab.pinned && dedupeKey(tab.url) !== null;
}

export function groupBy(tabs, keyFn) {
  const groups = new Map();
  for (const tab of tabs) {
    const key = keyFn(tab);
    if (key === null || key === undefined) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tab);
  }
  return groups;
}

export function newestFirst(tabs) {
  return [...tabs].sort((a, b) => b.id - a.id);
}

export const NO_GROUP = -1;

export function isStale(tab, { now, thresholdMs }) {
  if (tab.active || tab.pinned || typeof tab.lastAccessed !== 'number') return false;
  if (tab.groupId !== undefined && tab.groupId !== NO_GROUP) return false;
  return now - tab.lastAccessed >= thresholdMs;
}
