import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Browser, type TabState } from '../components/Browser';
import { Caption } from '../components/Caption';
import { Camera, zoomCurve } from '../components/Camera';
import { ALL_TABS } from '../data';
import { colors } from '../theme';

export function Intro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tabs: TabState[] = ALL_TABS.map((t, i) => {
    const s = spring({ frame: frame - i * 2.5, fps, config: { damping: 18, stiffness: 160 } });
    return { ...t, w: Math.max(0, s), active: i === ALL_TABS.length - 1 && s > 0.5 };
  });
  const visible = tabs.filter(t => t.w > 0.5).length;
  return (
    <AbsoluteFill style={{ background: colors.bgGradient }}>
      <Camera zoom={zoomCurve(frame, [[0, 1], [120, 1.08]])} fx={960}>
        <Browser tabs={tabs} counter={`${visible} tabs`} />
      </Camera>
      <Caption title="Sound familiar?" sub="Half of these are the same page." at={70} />
    </AbsoluteFill>
  );
}
