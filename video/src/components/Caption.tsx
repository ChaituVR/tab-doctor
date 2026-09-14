import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, font } from '../theme';

export function Caption({ title, sub, at = 0, dark = false }: { title: string; sub?: string; at?: number; dark?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - at);
  const s = spring({ frame: local, fps, config: { damping: 200, stiffness: 120 } });
  const opacity = interpolate(local, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const y = interpolate(s, [0, 1], [24, 0]);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center', fontFamily: font, opacity, transform: `translateY(${y}px)` }}>
      <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: '-0.025em', color: dark ? '#fff' : colors.label, lineHeight: 1.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 32, color: dark ? 'rgba(255,255,255,.65)' : colors.secondary, marginTop: 14 }}>{sub}</div>}
    </div>
  );
}
