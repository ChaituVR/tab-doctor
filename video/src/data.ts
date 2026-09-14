export type TabInfo = { id: number; title: string; color: string; stale?: boolean };

const T = (title: string, color: string, stale = false) => ({ title, color, stale });
const seq = [
  T('PR #2244 · sx-monorepo', '#24292f'),
  T('Vue Query docs', '#42b883'),
  T('Discord', '#5865f2'),
  T('YouTube', '#ff0000', true),
  T('PR #2244 · sx-monorepo', '#24292f'),
  T('Notion · Roadmap', '#1d1d1f'),
  T('Figma · Popup v2', '#a259ff', true),
  T('Vue Query docs', '#42b883'),
  T('Stack Overflow', '#f48024', true),
  T('Flight options for October', '#0a84ff'),
  T('MDN · Array.at', '#1d1d1f', true),
  T('Discord', '#5865f2'),
  T('Linear · TD-42', '#5e6ad2'),
  T('PR #2244 · sx-monorepo', '#24292f'),
  T('Spotify', '#1db954', true),
  T('Docs · Launch plan', '#4285f4')
];

export const ALL_TABS: TabInfo[] = seq.map((t, i) => ({ id: i + 1, ...t }));

/** Last occurrence of each title wins (newest tab). */
export const isNewest = (tab: TabInfo) => ALL_TABS.filter(t => t.title === tab.title).at(-1)!.id === tab.id;
export const isDuplicate = (tab: TabInfo) => ALL_TABS.filter(t => t.title === tab.title).length > 1;
export const DEDUPED: TabInfo[] = ALL_TABS.filter(isNewest);
export const STALE: TabInfo[] = DEDUPED.filter(t => t.stale);
export const FRESH: TabInfo[] = DEDUPED.filter(t => !t.stale);
export const SNOOZE_TARGET = 'Flight options for October';
