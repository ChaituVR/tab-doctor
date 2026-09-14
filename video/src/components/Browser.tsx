import type { CSSProperties, ReactNode } from 'react';
import { colors, font } from '../theme';

export type TabState = {
  id: number;
  title: string;
  color: string;
  w: number;          // 0..1 width factor
  opacity?: number;   // content opacity
  grey?: boolean;
  highlight?: boolean;
  glow?: boolean;
  lift?: number;      // translateY px
  active?: boolean;
};

export type Pill = { w: number; count: number };

export const WIN = { left: 100, top: 130, width: 1720, tabsTop: 8, tabH: 38, barH: 52, contentH: 380 };
const TAB_MAX = 230;
const TAB_MIN_VISIBLE = 0.02;
export const PILL_W = 128;
export const STRIP_X = 96;
const STRIP_W = WIN.width - STRIP_X - 24;

export type Laid = { tab: TabState; x: number; width: number };

export function layoutTabs(tabs: TabState[], pill?: Pill): { tabs: Laid[]; pillWidth: number } {
  const pillWidth = pill ? PILL_W * pill.w : 0;
  const avail = STRIP_W - pillWidth - (pill ? 8 : 0);
  const sum = tabs.reduce((n, t) => n + t.w, 0) || 1;
  const unit = Math.min(TAB_MAX, avail / sum);
  let x = STRIP_X + pillWidth + (pill ? 8 : 0);
  const laid = tabs.map(t => {
    const width = t.w * unit;
    const item = { tab: t, x, width };
    x += width;
    return item;
  });
  return { tabs: laid, pillWidth };
}

export function Browser({ tabs, pill, children, counter }: { tabs: TabState[]; pill?: Pill; children?: ReactNode; counter?: string }) {
  const { tabs: laid, pillWidth } = layoutTabs(tabs, pill);
  const shell: CSSProperties = {
    position: 'absolute', left: WIN.left, top: WIN.top, width: WIN.width,
    height: WIN.tabsTop + WIN.tabH + WIN.barH + WIN.contentH,
    background: colors.chrome, borderRadius: 14, overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)', fontFamily: font
  };
  return (
    <div style={shell}>
      <div style={{ position: 'absolute', left: 18, top: 16, display: 'flex', gap: 8 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      </div>
      {pill && pillWidth > 2 && (
        <div style={{
          position: 'absolute', left: STRIP_X, top: WIN.tabsTop + 5, width: pillWidth, height: WIN.tabH - 10, overflow: 'hidden',
          background: colors.stale, borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pill.w, whiteSpace: 'nowrap'
        }}>
          Stale <span style={{ background: 'rgba(255,255,255,.25)', borderRadius: 6, padding: '0 6px', fontSize: 13 }}>{pill.count}</span>
        </div>
      )}
      {laid.map(({ tab, x, width }) => width < TAB_MIN_VISIBLE ? null : (
        <div key={tab.id} style={{
          position: 'absolute', left: x, top: WIN.tabsTop + (tab.lift ?? 0), width: Math.max(0, width - 2), height: WIN.tabH,
          background: tab.active ? colors.tabActive : colors.tabInactive,
          borderRadius: '10px 10px 0 0', overflow: 'hidden',
          display: 'flex', alignItems: 'center', gap: 7, padding: width < 120 ? '0 8px' : '0 10px', boxSizing: 'border-box',
          opacity: (tab.opacity ?? 1) * Math.min(1, Math.max(0, tab.w * 1.5)),
          filter: tab.grey ? 'grayscale(1)' : undefined,
          outline: tab.highlight ? `3px solid ${colors.blue}` : undefined, outlineOffset: -3,
          boxShadow: tab.glow ? `0 0 0 3px ${colors.blue}, 0 0 24px ${colors.blue}` : undefined,
          zIndex: tab.glow || tab.highlight ? 2 : 1
        }}>
          <div style={{ width: 14, height: 14, borderRadius: 4, background: tab.color, flex: 'none', opacity: tab.grey ? .5 : 1 }} />
          <div style={{ fontSize: 14, color: tab.grey ? colors.stale : colors.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{tab.title}</div>
          {(width >= 120 || tab.active) && <div style={{ fontSize: 14, color: colors.secondary, flex: 'none' }}>×</div>}
        </div>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: WIN.tabsTop + WIN.tabH, height: WIN.barH, background: '#fff', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 14 }}>
        <span style={{ color: colors.secondary, fontSize: 18 }}>‹  ›  ↻</span>
        <div style={{ flex: 1, height: 34, borderRadius: 17, background: '#f1f3f4', display: 'flex', alignItems: 'center', padding: '0 16px', color: colors.secondary, fontSize: 15 }}>github.com/snapshot-labs/sx-monorepo/pull/2244</div>
        {counter && <div style={{ fontSize: 15, fontWeight: 600, color: colors.label, background: '#f1f3f4', borderRadius: 10, padding: '6px 12px' }}>{counter}</div>}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: WIN.tabsTop + WIN.tabH + WIN.barH, bottom: 0, background: '#fff' }}>
        <div style={{ position: 'absolute', left: 60, top: 40, width: 560, height: 30, borderRadius: 8, background: '#e8e8ed' }} />
        <div style={{ position: 'absolute', left: 60, top: 92, width: 420, height: 16, borderRadius: 6, background: '#f0f0f3' }} />
        {[0, 1, 2, 3].map(i => <div key={i} style={{ position: 'absolute', left: 60, top: 150 + i * 44, width: 1100 - (i % 2) * 260, height: 18, borderRadius: 6, background: '#f0f0f3' }} />)}
        <div style={{ position: 'absolute', right: 60, top: 40, width: 380, height: 260, borderRadius: 14, background: '#f5f5f7' }} />
        {children}
      </div>
    </div>
  );
}
