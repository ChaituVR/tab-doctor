import { withDefaults } from './settings.js';
import { HISTORY_CAP } from './history.js';

export const BACKUP_VERSION = 1;

export function serializeBackup({ settings, snoozed, history }) {
  return {
    app: 'tab-doctor',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: withDefaults(settings),
    snoozed: snoozed || [],
    history: history || []
  };
}

const isUrl = s => typeof s === 'string' && /^https?:\/\//.test(s);

/** Returns a normalized backup or throws a readable error. Never trusts the file blindly. */
export function validateBackup(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Tab Doctor backup file');
  if (raw.app !== 'tab-doctor') throw new Error('Not a Tab Doctor backup file');
  if (raw.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version ${raw.version}`);
  const settings = withDefaults(typeof raw.settings === 'object' ? raw.settings : {});
  if (typeof settings.staleHours !== 'number' || settings.staleHours < 1 || settings.staleHours > 720) settings.staleHours = 24;
  if (!['keep-newest', 'keep-existing'].includes(settings.duplicateMode)) settings.duplicateMode = 'keep-newest';
  if (typeof settings.discardHours !== 'number' || settings.discardHours < 1 || settings.discardHours > 8760) settings.discardHours = 72;
  settings.ignoreTrackingParams = settings.ignoreTrackingParams === true;
  const snoozed = (Array.isArray(raw.snoozed) ? raw.snoozed : [])
    .filter(e => e && typeof e.id === 'string' && isUrl(e.url) && Number.isFinite(e.wakeAt))
    .map(e => ({ id: e.id, url: e.url, title: String(e.title || e.url), kind: String(e.kind || 'later'), wakeAt: e.wakeAt, snoozedAt: Number.isFinite(e.snoozedAt) ? e.snoozedAt : Date.now() }));
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .filter(e => e && isUrl(e.url) && Number.isFinite(e.closedAt))
    .map(e => ({ url: e.url, title: String(e.title || e.url), closedAt: e.closedAt, rule: String(e.rule || 'unknown') }));
  return { settings, snoozed, history };
}

/** Union by (closedAt, url), newest first, capped. */
export function mergeHistory(current, incoming, cap = HISTORY_CAP) {
  const seen = new Set();
  const out = [];
  for (const e of [...incoming, ...current].sort((a, b) => b.closedAt - a.closedAt)) {
    const key = `${e.closedAt}|${e.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= cap) break;
  }
  return out;
}

/** Union by id; incoming wins on conflict. */
export function mergeSnoozed(current, incoming) {
  const byId = new Map(current.map(e => [e.id, e]));
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()];
}
