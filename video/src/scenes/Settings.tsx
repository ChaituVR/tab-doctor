import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Camera, zoomCurve } from '../components/Camera';
import { Cursor } from '../components/Cursor';
import { Popup } from '../components/Popup';
import { colors, font } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const POP = { x: 1180, y: 120 };
const SWITCH = { x: POP.x + 320 - 14 - 23, y: POP.y + 14 + 6 + 28 + 8 + 22 }; // centre of the Paused switch

export function Settings() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 120 } });
  const move = spring({ frame: frame - 30, fps, config: { damping: 200, stiffness: 70 } });
  const cx = interpolate(move, [0, 1], [900, SWITCH.x]);
  const cy = interpolate(move, [0, 1], [820, SWITCH.y]);
  const paused = spring({ frame: frame - 82, fps, config: { damping: 15, stiffness: 180 } });
  const line = (text: string, at: number, size: number, dim = false, weight = 700) => (
    <div style={{ fontSize: size, fontWeight: weight, letterSpacing: size > 40 ? '-0.025em' : undefined, lineHeight: 1.15, color: dim ? colors.secondary : colors.label, marginTop: dim ? 14 : 0, opacity: interpolate(frame, [at, at + 12], [0, 1], clamp), transform: `translateY(${interpolate(frame, [at, at + 14], [16, 0], clamp)}px)` }}>{text}</div>
  );
  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: font }}>
      <div style={{ position: 'absolute', left: 160, top: 330, width: 800 }}>
        {line('Pause anytime.', 20, 84)}
        {line('One switch turns everything off. Snooze, reopen, undo — right from the popup. Rules and options live in their own settings tab.', 40, 30, true, 400)}
        {line('Settings never leave your browser.', 100, 30, true, 400)}
      </div>
      <Camera zoom={zoomCurve(frame, [[40, 1], [70, 1.5], [115, 1.5], [145, 1]])} fx={SWITCH.x} fy={SWITCH.y}>
        <div style={{ position: 'absolute', left: POP.x, top: POP.y, transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px) scale(${interpolate(enter, [0, 1], [0.96, 1])})`, transformOrigin: 'top center', opacity: enter }}>
          <Popup paused={Math.min(1, paused)} />
        </div>
        {frame >= 30 && frame < 130 && <Cursor x={cx} y={cy} pressed={frame >= 78 && frame < 86} />}
      </Camera>
    </AbsoluteFill>
  );
}
