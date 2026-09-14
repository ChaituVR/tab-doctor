import { interpolate } from 'remotion';
import './popup.css';

function Switch({ on }: { on: number }) {
  const bg = on > 0.5 ? '#34c759' : '#e9e9eb';
  return (
    <div style={{ flex: 'none', width: 46, height: 28, borderRadius: 14, background: bg, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 2, left: 2, width: 24, height: 24, borderRadius: 12, background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,.15), 0 1px 1px rgba(0,0,0,.06)', transform: `translateX(${interpolate(on, [0, 1], [0, 18])}px)` }} />
    </div>
  );
}

const Row = ({ label, sub, right }: { label: string; sub?: string; right: React.ReactNode }) => (
  <li className="row"><div className="text"><span className="label">{label}</span>{sub && <span className="sub">{sub}</span>}</div>{right}</li>
);

export function Popup({ paused }: { paused: number }) {
  return (
    <div className="popup-root popup" style={{ boxShadow: '0 30px 80px rgba(0,0,0,.22), 0 0 0 .5px rgba(0,0,0,.12)' }}>
      <header className="titlebar"><span style={{ fontSize: 20, lineHeight: '20px' }}>👨‍⚕️</span><span className="app">Tab Doctor</span><span style={{ marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, background: 'rgba(118,118,128,.12)', color: '#6e6e73', textAlign: 'center', lineHeight: '28px', fontSize: 16 }}>⚙︎</span></header>
      <section className="group"><ul className="list">
        <Row label="Paused" sub="Stop automatic actions" right={<Switch on={paused} />} />
      </ul></section>
      <section className="group"><h2>Snoozed</h2><ul className="list">
        <Row label="Snooze this tab" sub="Later today · Tomorrow · Weekend · pick a date" right={<div className="pills"><span className="pill">Pick time</span></div>} />
      </ul>
      <ul className="list" style={{ marginTop: 8 }}>
        <li className="row" style={{ flexWrap: 'wrap', rowGap: 8 }}>
          <div className="text" style={{ flexBasis: '100%' }}><span className="label">Flight options for October</span><span className="sub">Wakes Tomorrow, 9:00 AM</span></div>
          <div className="pills" style={{ marginLeft: 'auto' }}><span className="pill">Copy</span><span className="pill">Open</span><span className="pill quiet">✕</span></div>
        </li>
      </ul></section>
      <section className="group"><h2>Recently closed</h2><ul className="list">
        <Row label="PR #2244 · sx-monorepo" sub="2m ago · duplicate" right={<div className="pills"><span className="pill">Reopen</span></div>} />
        <Row label="Vue Query docs" sub="3h ago · duplicate" right={<div className="pills"><span className="pill">Reopen</span></div>} />
        <li className="row footer"><span>12 kept (last 500)</span><span className="link">See all ↗</span></li>
      </ul></section>
      <section className="actions"><div className="btn primary" style={{ textAlign: 'center' }}>Run Now</div><div className="btn tinted" style={{ textAlign: 'center' }}>Undo (3)</div></section>
      <p className="status">Last run Today, 9:14 · 3 closed, 5 grouped</p>
      <nav className="foot"><span className="footlink">All settings…</span><span className="footlink">Request a feature ↗</span></nav>
    </div>
  );
}
