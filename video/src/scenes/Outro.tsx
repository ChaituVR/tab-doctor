import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../theme';

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const fade = (at: number) => interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: colors.bgGradient, fontFamily: font, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 200, transform: `scale(${pop})`, lineHeight: 1 }}>👨‍⚕️</div>
      <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: '-0.03em', color: colors.label, marginTop: 24, opacity: fade(10) }}>Tab Doctor</div>
      <div style={{ fontSize: 36, color: colors.secondary, marginTop: 10, opacity: fade(22) }}>Free on the Chrome Web Store</div>
      <div style={{ display: 'flex', gap: 14, marginTop: 34, opacity: fade(30) }}>
        {['Free', 'Open source', 'Zero network calls'].map(t => (
          <div key={t} style={{ fontSize: 22, fontWeight: 600, color: colors.label, background: 'rgba(0,0,0,.06)', borderRadius: 999, padding: '10px 22px' }}>{t}</div>
        ))}
      </div>
      <div style={{ fontSize: 26, color: colors.blue, marginTop: 36, opacity: fade(40) }}>github.com/ChaituVR/tab-doctor</div>
    </AbsoluteFill>
  );
}
