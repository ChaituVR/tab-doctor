const IGNORED_SCHEMES = ['chrome:', 'chrome-extension:', 'edge:', 'about:', 'devtools:', 'view-source:'];

const TRACKING_PARAM = /^(utm_|fbclid$|gclid$|dclid$|msclkid$|mc_cid$|mc_eid$|igshid$|ref$|ref_src$|_hsenc$|_hsmi$|vero_id$|yclid$|twclid$|ttclid$)/i;

export function dedupeKey(url, { stripTracking = false } = {}) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (IGNORED_SCHEMES.includes(u.protocol)) return null;
    u.hash = '';
    if (stripTracking) {
      for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
      if (![...u.searchParams.keys()].length) u.search = '';
    }
    return u.href;
  } catch {
    return null;
  }
}

export function duplicateKey(tab, { sameWindowOnly, ignoreTrackingParams }) {
  const key = dedupeKey(tab.url, { stripTracking: ignoreTrackingParams });
  if (key === null) return null;
  return sameWindowOnly ? `${tab.windowId}|${key}` : key;
}

/** Stale tabs that can be unloaded from memory without losing anything the user is doing. */
export function isDiscardable(tab, { now, thresholdMs }) {
  if (tab.discarded || tab.active || tab.pinned || tab.audible || typeof tab.lastAccessed !== 'number') return false;
  return now - tab.lastAccessed >= thresholdMs;
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

export function oldestFirst(tabs) {
  return [...tabs].sort((a, b) => a.id - b.id);
}

/**
 * Plans a dedupe pass.
 * protection: Map<tabId, { graceUntil }> for tabs Tab Doctor reopened on purpose. A protected tab is never closed
 * (it becomes its group's keeper); while its grace period runs, the whole group is skipped unless ignoreGrace.
 */
export function planDuplicates(tabs, settings, protection = new Map(), { now = Date.now(), ignoreGrace = false } = {}) {
  const groups = groupBy(tabs.filter(isManageable), t => duplicateKey(t, settings));
  const toClose = [];
  let toActivate = null;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const protectedTabs = group.filter(t => protection.has(t.id));
    if (!ignoreGrace && protectedTabs.some(t => protection.get(t.id).graceUntil > now)) continue;
    const [keep, ...rest] = protectedTabs.length
      ? [newestFirst(protectedTabs)[0], ...group.filter(t => t.id !== newestFirst(protectedTabs)[0].id)]
      : splitDuplicates(group, settings.duplicateMode);
    const closing = rest.filter(t => !protection.has(t.id));
    if (!closing.length) continue;
    if (closing.some(t => t.active)) toActivate = keep;
    toClose.push(...closing);
  }
  return { toClose, toActivate };
}

/** Returns [keep, ...close] for a duplicate group according to the mode. */
export function splitDuplicates(group, mode) {
  return mode === 'keep-existing' ? oldestFirst(group) : newestFirst(group);
}

export const NO_GROUP = -1;

export function isStale(tab, { now, thresholdMs, allowGroups = new Set() }) {
  if (tab.active || tab.pinned || typeof tab.lastAccessed !== 'number') return false;
  if (tab.groupId !== undefined && tab.groupId !== NO_GROUP && !allowGroups.has(tab.groupId)) return false;
  return now - tab.lastAccessed >= thresholdMs;
}

const TWO_LEVEL_TLDS = new Set(['co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'co.in', 'co.jp', 'co.nz', 'co.za', 'com.au', 'net.au', 'org.au', 'com.br', 'com.mx', 'com.sg', 'com.tr']);

/** Registrable domain: github.com, bbc.co.uk. null for non-http(s). */
export function siteOf(url) {
  if (dedupeKey(url) === null) return null;
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol) || !u.hostname) return null; // file://, data:, etc. never get a site group
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (/^[\d.]+$/.test(host) || host === 'localhost') return host; // IPs and localhost group as themselves
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  return TWO_LEVEL_TLDS.has(last2) ? parts.slice(-3).join('.') : last2;
}

export function siteLabel(site) {
  return site.split('.')[0];
}

export const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

/** Stable colour per site (grey is reserved for the Stale group). */
export function colorFor(site) {
  let h = 0;
  for (const ch of site) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GROUP_COLORS[h % GROUP_COLORS.length];
}
