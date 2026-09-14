import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Title() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const icon = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 150 } });
  const rise = (at: number) => ({
    opacity: interpolate(frame, [at, at + 12], [0, 1], clamp),
    transform: `translateY(${interpolate(frame, [at, at + 16], [18, 0], clamp)}px)`
  });
  return (
    <AbsoluteFill style={{ background: colors.bgGradient, fontFamily: font, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ width: 200, height: 200, borderRadius: 46, background: '#fff', boxShadow: '0 24px 60px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 128, lineHeight: 1, transform: `scale(${icon})` }}>👨‍⚕️</div>
      <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: '-0.03em', color: colors.label, marginTop: 34, ...rise(10) }}>Tab Doctor</div>
      <div style={{ fontSize: 36, color: colors.secondary, marginTop: 8, ...rise(22) }}>Tabs, kept healthy.</div>
    </AbsoluteFill>
  );
}
