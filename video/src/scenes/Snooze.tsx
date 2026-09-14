import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Browser, layoutTabs, WIN, type TabState } from '../components/Browser';
import { Caption } from '../components/Caption';
import { ContextMenu } from '../components/ContextMenu';
import { Cursor } from '../components/Cursor';
import { Camera, zoomCurve } from '../components/Camera';
import { FRESH, STALE, SNOOZE_TARGET } from '../data';
import { colors, font } from '../theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function Snooze() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pill = { w: 1, count: STALE.length - 1 };

  const gone = interpolate(frame, [112, 140], [0, 1], clamp);
  const back = spring({ frame: frame - 185, fps, config: { damping: 14, stiffness: 120 } });
  const presence = Math.max(1 - gone, back);

  const tabs: TabState[] = FRESH.map((t, i) => {
    const isTarget = t.title === SNOOZE_TARGET;
    return {
      ...t,
      w: isTarget ? presence : 1,
      lift: isTarget ? interpolate(presence, [0, 1], [-260, 0]) : 0,
      opacity: isTarget ? presence : 1,
      glow: isTarget && back > 0.6 && frame < 235,
      active: isTarget ? frame > 30 : i === FRESH.length - 1 && frame <= 30
    };
  });

  const { tabs: laid } = layoutTabs(tabs, pill);
  const target = laid.find(l => l.tab.title === SNOOZE_TARGET)!;
  const tabCx = WIN.left + target.x + target.width / 2;
  const tabCy = WIN.top + WIN.tabsTop + WIN.tabH / 2;

  const move = spring({ frame: frame - 5, fps, config: { damping: 200, stiffness: 60 } });
  const cx = interpolate(move, [0, 1], [1400, tabCx]);
  const cy = interpolate(move, [0, 1], [700, tabCy]);
  const menu = spring({ frame: frame - 46, fps, config: { damping: 18, stiffness: 220 } });
  const submenu = spring({ frame: frame - 74, fps, config: { damping: 18, stiffness: 220 } });
  const menuVisible = frame >= 46 && frame < 112;

  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <Camera zoom={zoomCurve(frame, [[15, 1], [45, 1.55], [118, 1.55], [150, 1], [185, 1], [210, 1.3], [232, 1.3], [250, 1]])} fx={tabCx}>
        <Browser tabs={tabs} pill={pill} counter={`${tabs.filter(t => t.w > 0.5).length} tabs`} />
        {menuVisible && (
          <ContextMenu x={cx + 6} y={cy + 8} scale={menu} snoozeActive={frame >= 66} submenu={frame >= 74 ? submenu : 0} subActive={frame >= 96 ? 1 : -1} />
        )}
        {frame < 130 && <Cursor x={cx} y={cy} pressed={(frame >= 44 && frame < 50) || (frame >= 108 && frame < 114)} />}
        {frame >= 140 && frame < 185 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: WIN.top + 200, textAlign: 'center', fontFamily: font, fontSize: 40, fontWeight: 600, color: colors.secondary, opacity: interpolate(frame, [140, 150, 178, 185], [0, 1, 1, 0], clamp) }}>
            ⏰ Tomorrow, 9:00 AM
          </div>
        )}
      </Camera>
      {frame < 175
        ? <Caption title="Snooze it." sub="Later today · Tomorrow 9 AM · Weekend. The tab closes itself." at={40} />
        : <Caption title="…and it comes back on time." at={180} />}
    </AbsoluteFill>
  );
}
