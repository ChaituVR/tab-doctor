import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { font, mono } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const CODE = `"content_security_policy": { "extension_pages": "default-src 'none'" }`;

export function Privacy() {
  const frame = useCurrentFrame();
  const typed = CODE.slice(0, Math.floor(interpolate(frame, [5, 60], [0, CODE.length], clamp)));
  const line = (text: string, at: number, size = 64, dim = false) => (
    <div style={{ fontSize: size, fontWeight: dim ? 400 : 700, letterSpacing: '-0.02em', color: dim ? 'rgba(255,255,255,.6)' : '#fff', opacity: interpolate(frame, [at, at + 12], [0, 1], clamp), transform: `translateY(${interpolate(frame, [at, at + 14], [16, 0], clamp)}px)`, marginTop: 18 }}>{text}</div>
  );
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: font, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ fontFamily: mono, fontSize: 30, color: '#7dd3fc', background: '#111', padding: '18px 28px', borderRadius: 12, marginBottom: 40, minWidth: 1180, textAlign: 'left' }}>
        {typed}<span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>▍</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        {line('Zero network calls.', 62, 84)}
        {line('No content scripts. No host permissions. No analytics.', 88, 36, true)}
        {line('Open source.', 112, 36, true)}
      </div>
    </AbsoluteFill>
  );
}
