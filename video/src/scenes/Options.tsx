import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Camera, zoomCurve } from '../components/Camera';
import { Cursor } from '../components/Cursor';
import { PANEL, PANEL_HEIGHT, SettingsPage, switchCenter } from '../components/SettingsPage';
import { colors, font } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Three switches get flipped on, one after another.
export const FLIPS = [
  { key: 'group-by-site', arrive: 30, press: 62 },
  { key: 'discard-stale', arrive: 72, press: 102 },
  { key: 'tracking', arrive: 112, press: 140 }
];
const START = { x: 700, y: 900 };

export function Options() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 120 } });

  const states: Record<string, number> = { 'close-duplicates': 1, 'group-stale': 1, 'same-window': 1 };
  for (const f of FLIPS) states[f.key] = spring({ frame: frame - f.press - 2, fps, config: { damping: 15, stiffness: 180 } });

  // cursor glides from switch to switch
  const stops = [START, ...FLIPS.map(f => switchCenter(f.key))];
  let cx = START.x, cy = START.y;
  FLIPS.forEach((f, i) => {
    const t = spring({ frame: frame - f.arrive, fps, config: { damping: 200, stiffness: 80 } });
    cx = interpolate(t, [0, 1], [cx, stops[i + 1].x]);
    cy = interpolate(t, [0, 1], [cy, stops[i + 1].y]);
  });
  const pressed = FLIPS.some(f => frame >= f.press && frame < f.press + 6);
  const cursorVisible = frame >= FLIPS[0].arrive && frame < 170;

  const line = (text: string, at: number, size: number, dim = false, weight = 700) => (
    <div style={{ fontSize: size, fontWeight: weight, letterSpacing: size > 40 ? '-0.025em' : undefined, lineHeight: 1.15, color: dim ? colors.secondary : colors.label, marginTop: dim ? 14 : 0, opacity: interpolate(frame, [at, at + 12], [0, 1], clamp), transform: `translateY(${interpolate(frame, [at, at + 14], [16, 0], clamp)}px)` }}>{text}</div>
  );
  const focus = { x: PANEL.left + PANEL.width / 2, y: PANEL.top + PANEL_HEIGHT / 2 };
  return (
    <AbsoluteFill style={{ background: colors.bgGradient, fontFamily: font }}>
      <div style={{ position: 'absolute', left: 160, top: 330, width: 760 }}>
        {line('Make it yours.', 16, 84)}
        {line('Group tabs by site. Unload stale tabs to free memory. Ignore tracking links. Tune every timer.', 30, 30, true, 400)}
        {line('Every rule is a switch, off by default. Your setup backs up to one JSON file.', 120, 28, true, 400)}
      </div>
      <Camera zoom={zoomCurve(frame, [[20, 1], [60, 1.08], [160, 1.08], [195, 1]])} fx={focus.x} fy={focus.y}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
          <SettingsPage states={states} />
        </div>
        {cursorVisible && <Cursor x={cx} y={cy} pressed={pressed} />}
      </Camera>
    </AbsoluteFill>
  );
}
