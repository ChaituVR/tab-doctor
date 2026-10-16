import { siteFromInput } from './tabs.js';

export const DEFAULTS = {
  paused: false,
  sameWindowOnly: true,
  staleHours: 24,
  duplicateMode: 'keep-existing', // or 'keep-newest'
  ignoreTrackingParams: false,
  holdOnNavigate: true,
  discardHours: 72,
  smartNames: false,
  leaveAlone: [],
  rules: { 'close-duplicates': true, 'group-stale': true, 'discard-stale': false, 'group-by-site': false }
};

export function withDefaults(stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
  const settings = {
    ...DEFAULTS,
    ...stored,
    rules: { ...DEFAULTS.rules, ...(stored?.rules || {}) }
  };
  for (const key of ['paused', 'sameWindowOnly', 'ignoreTrackingParams', 'holdOnNavigate', 'smartNames']) {
    if (typeof settings[key] !== 'boolean') settings[key] = DEFAULTS[key];
  }
  for (const [key, max] of [['staleHours', 720], ['discardHours', 8760]]) {
    if (!Number.isFinite(settings[key]) || settings[key] < 1 || settings[key] > max) settings[key] = DEFAULTS[key];
  }
  if (!['keep-existing', 'keep-newest'].includes(settings.duplicateMode)) settings.duplicateMode = DEFAULTS.duplicateMode;
  settings.leaveAlone = Array.isArray(settings.leaveAlone) ? [...new Set(settings.leaveAlone.map(siteFromInput).filter(Boolean))] : [];
  for (const [key, value] of Object.entries(DEFAULTS.rules)) {
    if (typeof settings.rules[key] !== 'boolean') settings.rules[key] = value;
  }
  return settings;
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
