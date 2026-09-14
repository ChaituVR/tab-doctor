import { font } from '../theme';

const item = (label: string, active = false, arrow = false) => (
  <div key={label} style={{
    padding: '7px 14px', fontSize: 16, borderRadius: 6, display: 'flex', justifyContent: 'space-between',
    background: active ? '#0a84ff' : 'transparent', color: active ? '#fff' : '#1d1d1f'
  }}>{label}{arrow && <span>›</span>}</div>
);

const panel = { background: 'rgba(255,255,255,.96)', borderRadius: 10, padding: 6, boxShadow: '0 12px 40px rgba(0,0,0,.22), 0 0 0 .5px rgba(0,0,0,.12)', fontFamily: font, width: 250 } as const;

export function ContextMenu({ x, y, scale, snoozeActive, submenu, subActive }: { x: number; y: number; scale: number; snoozeActive: boolean; submenu: number; subActive: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: `scale(${scale})`, transformOrigin: '0 0', zIndex: 10, opacity: Math.min(1, scale) }}>
      <div style={panel}>
        {item('Back')}{item('Forward')}{item('Reload')}
        <div style={{ height: 1, background: 'rgba(0,0,0,.1)', margin: '5px 8px' }} />
        {item('Snooze tab', snoozeActive, true)}
        <div style={{ height: 1, background: 'rgba(0,0,0,.1)', margin: '5px 8px' }} />
        {item('Inspect')}
      </div>
      {submenu > 0 && (
        <div style={{ ...panel, position: 'absolute', left: 252, top: 108, transform: `scale(${submenu})`, transformOrigin: '0 0', opacity: submenu, width: 240 }}>
          {item('Later today (6 hours)', subActive === 0)}
          {item('Tomorrow (9 AM)', subActive === 1)}
          {item('Weekend (Saturday 9 AM)', subActive === 2)}
        </div>
      )}
    </div>
  );
}
