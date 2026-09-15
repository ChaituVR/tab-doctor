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

/** A messier strip for the group-by-site scene: three sites with 2–3 tabs each, mixed in with singles. */
export type SiteTab = TabInfo & { site?: string };
export const SITE_TABS: SiteTab[] = [
  { id: 1, title: 'PR #2244 · sx-monorepo', color: '#24292f', site: 'GitHub' },
  { id: 2, title: 'Vue Query docs', color: '#42b883' },
  { id: 3, title: 'Notion · Roadmap', color: '#1d1d1f', site: 'Notion' },
  { id: 4, title: 'Issues · tab-doctor', color: '#24292f', site: 'GitHub' },
  { id: 5, title: 'Linear · TD-42', color: '#5e6ad2', site: 'Linear' },
  { id: 6, title: 'Discord', color: '#5865f2' },
  { id: 7, title: 'Notion · Meeting notes', color: '#1d1d1f', site: 'Notion' },
  { id: 8, title: 'Actions · CI run', color: '#24292f', site: 'GitHub' },
  { id: 9, title: 'Flight options for October', color: '#0a84ff' },
  { id: 10, title: 'Linear · TD-57', color: '#5e6ad2', site: 'Linear' },
  { id: 11, title: 'Docs · Launch plan', color: '#4285f4' }
];
/** Chrome's tab-group palette. */
export const SITE_COLORS: Record<string, string> = { GitHub: '#1a73e8', Notion: '#fa903e', Linear: '#a142f4' };
