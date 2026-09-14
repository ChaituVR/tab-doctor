import type { ReactNode } from 'react';
import { Switch } from './Popup';
import { colors } from '../theme';
import './popup.css';

export const PANEL = { left: 1000, top: 70, width: 660, pad: 24 };
const TITLE_H = 48;
const H2_H = 34;
const GROUP_GAP = 10;
const ROW_H = 62;
const SWITCH_W = 46;

type Row = { key: string; label: string; sub: string; control: 'switch' | 'select' | 'stepper'; value?: string };
type Section = { title?: string; rows: Row[] };

export const SECTIONS: Section[] = [
  { rows: [{ key: 'paused', label: 'Paused', sub: 'Stop automatic actions', control: 'switch' }] },
  { title: 'Rules', rows: [
    { key: 'close-duplicates', label: 'Close duplicate tabs', sub: 'Same URL open more than once: keep one, close the rest.', control: 'switch' },
    { key: 'group-stale', label: 'Group stale tabs', sub: 'Tabs not viewed for a while move into a collapsed "Stale" group.', control: 'switch' },
    { key: 'group-by-site', label: 'Group tabs by site', sub: 'Two or more tabs from the same site get their own colour-coded group.', control: 'switch' },
    { key: 'discard-stale', label: 'Discard stale tabs', sub: 'Unload tabs untouched for days to free memory. They reload when clicked.', control: 'switch' }
  ] },
  { title: 'Options', rows: [
    { key: 'same-window', label: 'Same window only', sub: 'Duplicates across windows are kept', control: 'switch' },
    { key: 'duplicate-mode', label: 'When a duplicate appears', sub: 'Switch to the tab you already had, or keep the new one', control: 'select', value: 'Switch to existing tab' },
    { key: 'tracking', label: 'Ignore tracking parameters', sub: 'utm_*, fbclid, gclid, ref… count as the same page', control: 'switch' },
    { key: 'discard-hours', label: 'Discard after', sub: 'Hours untouched before a tab is unloaded', control: 'stepper', value: '72' },
    { key: 'stale-hours', label: 'Stale after', sub: 'Hours since a tab was last viewed', control: 'stepper', value: '24' }
  ] }
];

/** Top of each row relative to the panel, so scenes can aim the cursor without measuring the DOM. */
export const ROW_TOP: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  let y = PANEL.pad + TITLE_H;
  for (const s of SECTIONS) {
    y += GROUP_GAP + (s.title ? H2_H : 0);
    for (const r of s.rows) { out[r.key] = y; y += ROW_H; }
  }
  return out;
})();

export const PANEL_HEIGHT = Math.max(...Object.values(ROW_TOP)) + ROW_H + PANEL.pad + 8;

/** Screen-space centre of a row's switch. */
export const switchCenter = (key: string) => ({
  x: PANEL.left + PANEL.width - PANEL.pad - 16 - SWITCH_W / 2,
  y: PANEL.top + ROW_TOP[key] + ROW_H / 2
});

function Control({ row, on }: { row: Row; on: number }): ReactNode {
  if (row.control === 'switch') return <Switch on={on} />;
  if (row.control === 'select') return <div className="select" style={{ fontSize: 14, padding: '7px 30px 7px 12px' }}>{row.value}</div>;
  return <div className="stepper"><div style={{ width: 56, padding: '6px 8px', borderRadius: 8, background: 'rgba(118,118,128,.12)', color: colors.label, fontSize: 14, textAlign: 'right' }}>{row.value}</div><span>h</span></div>;
}

export function SettingsPage({ states }: { states: Record<string, number> }) {
  return (
    <div style={{ position: 'absolute', left: PANEL.left, top: PANEL.top, width: PANEL.width, height: PANEL_HEIGHT, padding: PANEL.pad, boxSizing: 'border-box', background: '#f2f2f7', borderRadius: 18, boxShadow: '0 30px 80px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: TITLE_H, padding: '0 8px' }}>
        <span style={{ fontSize: 26, lineHeight: '28px' }}>👨‍⚕️</span>
        <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.01em', color: colors.label }}>Tab Doctor</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: colors.secondary }}>v1.6.0</span>
      </div>
      {SECTIONS.map((s, i) => (
        <div key={i} style={{ paddingTop: GROUP_GAP }}>
          {s.title && <h2 style={{ height: H2_H, margin: '0 0 0 16px', boxSizing: 'border-box', paddingTop: 12, lineHeight: '16px' }}>{s.title}</h2>}
          <ul className="list" style={{ borderRadius: 14 }}>
            {s.rows.map(r => (
              <li key={r.key} className="row" style={{ height: ROW_H, boxSizing: 'border-box', padding: '8px 16px' }}>
                <div className="text"><span className="label" style={{ fontSize: 15 }}>{r.label}</span><span className="sub" style={{ fontSize: 13, WebkitLineClamp: 1 }}>{r.sub}</span></div>
                <Control row={r} on={states[r.key] ?? 0} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
