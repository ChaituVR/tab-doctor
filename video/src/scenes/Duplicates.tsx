import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Browser, type TabState } from '../components/Browser';
import { Caption } from '../components/Caption';
import { Camera, zoomCurve } from '../components/Camera';
import { ALL_TABS, isDuplicate, isNewest } from '../data';
import { colors } from '../theme';

export function Duplicates() {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [10, 20, 30, 40, 50], [0, 1, 0, 1, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tabs: TabState[] = ALL_TABS.map((t, i) => {
    const dup = isDuplicate(t);
    const doomed = dup && !isNewest(t);
    const stagger = (i % 6) * 4;
    const w = doomed ? interpolate(frame, [55 + stagger, 90 + stagger], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 1;
    const glow = dup && isNewest(t) && frame > 60 && frame < 140;
    return { ...t, w, highlight: dup && frame < 60 && pulse > 0.5, glow, active: i === ALL_TABS.length - 1 };
  });
  const visible = tabs.filter(t => t.w > 0.5).length;
  return (
    <AbsoluteFill style={{ background: colors.bgGradient }}>
      <Camera zoom={zoomCurve(frame, [[0, 1.08], [30, 1.3], [125, 1.3], [165, 1]])} fx={zoomCurve(frame, [[0, 960], [30, 760]])}>
        <Browser tabs={tabs} counter={`${visible} tabs`} />
      </Camera>
      <Caption title="Duplicates close themselves." sub="The newest copy stays. Pin a tab to protect it. Undo if it ever bites." at={60} />
    </AbsoluteFill>
  );
}
