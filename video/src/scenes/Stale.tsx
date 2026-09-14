import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Browser, PILL_W, STRIP_X, WIN, type TabState } from '../components/Browser';
import { Cursor } from '../components/Cursor';
import { Camera, zoomCurve } from '../components/Camera';
import { Caption } from '../components/Caption';
import { DEDUPED, STALE } from '../data';
import { colors } from '../theme';

export function Stale() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const popBack = STALE[0].id;
  const tabs: TabState[] = DEDUPED.map((t, i) => {
    if (!t.stale) return { ...t, w: 1, active: i === DEDUPED.length - 1 };
    const stagger = (i % 5) * 5;
    const collapse = interpolate(frame, [45 + stagger, 85 + stagger], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const back = t.id === popBack ? spring({ frame: frame - 140, fps, config: { damping: 16, stiffness: 140 } }) : 0;
    const w = Math.max(collapse, back);
    return { ...t, w, grey: frame > 8 && back < 0.5, glow: back > 0.5 && frame < 180 };
  });
  const pillW = spring({ frame: frame - 45, fps, config: { damping: 200 } });
  const move = spring({ frame: frame - 100, fps, config: { damping: 200, stiffness: 70 } });
  const cx = interpolate(move, [0, 1], [1300, WIN.left + STRIP_X + PILL_W / 2]);
  const cy = interpolate(move, [0, 1], [720, WIN.top + WIN.tabsTop + WIN.tabH / 2]);
  const stillStale = STALE.length - (frame > 150 ? 1 : 0);
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <Camera zoom={zoomCurve(frame, [[35, 1], [70, 1.5], [165, 1.5], [198, 1]])} fx={zoomCurve(frame, [[35, 960], [70, 420]])}>
        <Browser tabs={tabs} pill={{ w: pillW, count: stillStale }} counter={`${tabs.filter(t => t.w > 0.5).length} tabs`} />
        {frame >= 100 && frame < 165 && <Cursor x={cx} y={cy} pressed={frame >= 138 && frame < 146} />}
      </Camera>
      {frame < 135
        ? <Caption title="Stale tabs fold away." sub="Untouched for 24 hours? Into a collapsed group it goes." at={55} />
        : <Caption title="Click one — it comes right back." at={135} />}
    </AbsoluteFill>
  );
}
