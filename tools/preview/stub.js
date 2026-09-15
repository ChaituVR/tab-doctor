// Fake chrome.* for rendering the extension pages outside Chrome (store screenshots, promo tiles).
// Flags via window.__preview: { empty: true } (no snoozed tabs), { dup: true } (popup shows the duplicate card).
(() => {
  const flags = window.__preview || {};
  const now = Date.now(); const H = 3600e3;
  const tomorrow9 = (() => { const d = new Date(now + 864e5); d.setHours(9, 0, 0, 0); return d.getTime(); })();
  const data = {
    settings: { paused: false, sameWindowOnly: true, staleHours: 24, duplicateMode: 'keep-existing', ignoreTrackingParams: false, holdOnNavigate: true, discardHours: 72, rules: { 'close-duplicates': true, 'group-stale': true, 'discard-stale': false, 'group-by-site': false } },
    snoozed: flags.empty ? [] : [
      { url: 'https://dataintensive.net/', title: 'Designing Data-Intensive Applications', wakeAt: now + 6 * H, kind: 'later' },
      { url: 'https://www.google.com/travel/flights', title: 'Flight options for October trip', wakeAt: tomorrow9, kind: 'tomorrow' }
    ],
    history: [
      { url: 'https://github.com/snapshot-labs/sx-monorepo/pull/2244', title: 'PR #2244 · sx-monorepo', closedAt: now - 2 * 60e3, rule: 'close-duplicates' },
      { url: 'https://tanstack.com/query/latest', title: 'TanStack Query docs', closedAt: now - 3 * H, rule: 'close-duplicates' },
      { url: 'https://news.ycombinator.com/', title: 'Hacker News', closedAt: now - 26 * H, rule: 'close-duplicates' },
      { url: 'https://developer.chrome.com/docs/extensions', title: 'Chrome Extensions docs', closedAt: now - 30 * H, rule: 'close-duplicates' }
    ],
    lastClosed: [{}, {}, {}],
    lastRun: { at: now - 40 * 60e3, closed: 3, grouped: 5 }
  };
  const pick = k => k == null ? { ...data } : Array.isArray(k) ? Object.fromEntries(k.map(x => [x, data[x]])) : { [k]: data[k] };
  const status = flags.dup ? { tabId: 1, held: true, twins: [{ id: 2, windowId: 1, title: 'x' }] } : { tabId: 1, held: false, twins: [] };
  window.chrome = {
    runtime: { sendMessage: async m => m?.type === 'tab-status' ? status : { ok: true }, openOptionsPage() {}, getManifest: () => ({ version: '1.6.0' }), lastError: null },
    storage: { local: { get: async k => pick(k), set: async v => Object.assign(data, v) }, session: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } },
    tabs: { query: async () => [{ id: 1, title: 'Flight options', url: 'https://x' }], create: async () => {} },
    windows: { getCurrent: async () => ({ id: 1, height: 300 }), update: async () => {} }
  };
})();
