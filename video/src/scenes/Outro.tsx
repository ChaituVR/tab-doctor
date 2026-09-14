import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../theme';

export function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const fade = (at: number) => interpolate(frame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: font, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 200, transform: `scale(${pop})`, lineHeight: 1 }}>👨‍⚕️</div>
      <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: '-0.03em', color: colors.label, marginTop: 24, opacity: fade(10) }}>Tab Doctor</div>
      <div style={{ fontSize: 36, color: colors.secondary, marginTop: 10, opacity: fade(22) }}>Free on the Chrome Web Store</div>
      <div style={{ fontSize: 26, color: colors.blue, marginTop: 40, opacity: fade(34) }}>github.com/ChaituVR/tab-doctor</div>
    </AbsoluteFill>
  );
}
