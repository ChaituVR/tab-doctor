export const DEFAULTS = {
  paused: false,
  sameWindowOnly: true,
  staleHours: 24,
  duplicateMode: 'keep-existing', // or 'keep-newest'
  ignoreTrackingParams: false,
  holdOnNavigate: true,
  discardHours: 72,
  rules: { 'close-duplicates': true, 'group-stale': true, 'discard-stale': false, 'group-by-site': false }
};

export function withDefaults(stored) {
  return {
    ...DEFAULTS,
    ...stored,
    rules: { ...DEFAULTS.rules, ...(stored?.rules || {}) }
  };
}

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return withDefaults(settings);
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = withDefaults({ ...current, ...patch, rules: { ...current.rules, ...(patch.rules || {}) } });
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getLastClosed() {
  const { lastClosed } = await chrome.storage.local.get('lastClosed');
  return lastClosed || [];
}

export async function setLastClosed(tabs) {
  await chrome.storage.local.set({ lastClosed: tabs });
}
