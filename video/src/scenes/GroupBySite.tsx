import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Browser, layoutTabs, PILL_W, STRIP_X, WIN, type GroupChip, type Laid, type TabState } from '../components/Browser';
import { Caption } from '../components/Caption';
import { Camera, zoomCurve } from '../components/Camera';
import { SITE_TABS, SITE_COLORS, STALE } from '../data';
import { colors } from '../theme';

const CHIP_W = 92;
const CHIP_GAP = 6;
const STRIP_W = WIN.width - STRIP_X - 24;
export const GROUP_AT = 35;

/** Final positions: each site's tabs gather at the spot of that site's first tab, behind a label chip. */
function groupedLayout(before: Laid[], pillWidth: number) {
  const sites = [...new Set(SITE_TABS.filter(t => t.site).map(t => t.site!))];
  const nChips = sites.length;
  const unit = (STRIP_W - pillWidth - 8 - nChips * (CHIP_W + CHIP_GAP)) / SITE_TABS.length;
  const placed = new Map<number, { x: number; width: number }>();
  const chips: GroupChip[] = [];
  let cursor = STRIP_X + pillWidth + 8;
  for (const t of SITE_TABS) {
    if (placed.has(t.id)) continue;
    if (t.site) {
      const members = SITE_TABS.filter(m => m.site === t.site);
      const x = cursor;
      cursor += CHIP_W + CHIP_GAP;
      for (const m of members) { placed.set(m.id, { x: cursor, width: unit }); cursor += unit; }
      chips.push({ title: t.site, color: SITE_COLORS[t.site], x, w: CHIP_W, span: cursor - x, opacity: 1 });
    } else {
      placed.set(t.id, { x: cursor, width: unit });
      cursor += unit;
    }
  }
  return { tabs: before.map(l => ({ ...l, ...placed.get(l.tab.id)! })), chips };
}

export function GroupBySite() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = spring({ frame: frame - GROUP_AT, fps, config: { damping: 200, stiffness: 55 } });
  const pulse = interpolate(frame, [8, 16, 24, 32], [0, 1, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const tabs: TabState[] = SITE_TABS.map((s, i) => ({ ...s, w: 1, active: i === SITE_TABS.length - 1, highlight: !!s.site && frame < GROUP_AT && pulse > 0.5 }));
  const pill = { w: 1, count: STALE.length - 1 };
  const { tabs: before, pillWidth } = layoutTabs(tabs, pill);
  const after = groupedLayout(before, pillWidth);
  const layout = before.map((l, i) => ({ ...l, x: interpolate(t, [0, 1], [l.x, after.tabs[i].x]), width: interpolate(t, [0, 1], [l.width, after.tabs[i].width]) }));
  const groups = after.chips.map(c => ({ ...c, w: c.w * t, span: c.span * t, opacity: Math.min(1, t * 1.5) }));
  return (
    <AbsoluteFill style={{ background: colors.bgGradient }}>
      <Camera zoom={zoomCurve(frame, [[15, 1], [45, 1.18], [150, 1.18], [185, 1]])} fx={760}>
        <Browser tabs={tabs} pill={pill} layout={layout} groups={groups} counter={`${SITE_TABS.length} tabs`} />
      </Camera>
      <Caption title="Group by site." sub="Same site, same colour: GitHub, Notion, Linear each get their own group. Off by default, one switch." at={50} />
    </AbsoluteFill>
  );
}
