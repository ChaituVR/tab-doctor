import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Intro } from './scenes/Intro';
import { Duplicates } from './scenes/Duplicates';
import { Stale } from './scenes/Stale';
import { Snooze } from './scenes/Snooze';
import { Settings } from './scenes/Settings';
import { Privacy } from './scenes/Privacy';
import { Outro } from './scenes/Outro';
import { colors } from './theme';
import { VOICE } from './voice';

export const FPS = 30;
// Narration is off: run `npm run voice` in video/ to generate the clips, then flip this on.
const NARRATION = false;
const SCENES = [
  { name: 'intro', comp: Intro, frames: NARRATION ? 150 : 120, fade: true },
  { name: 'duplicates', comp: Duplicates, frames: NARRATION ? 200 : 180, fade: false },
  { name: 'stale', comp: Stale, frames: 200, fade: false },
  { name: 'snooze', comp: Snooze, frames: 250, fade: false },
  { name: 'settings', comp: Settings, frames: 160, fade: true },
  { name: 'privacy', comp: Privacy, frames: NARRATION ? 195 : 150, fade: true },
  { name: 'outro', comp: Outro, frames: 120, fade: true }
];
export const DURATION = SCENES.reduce((n, s) => n + s.frames, 0);

const VOICE_GAIN = 0.72;
const MUSIC_GAIN = 0.28;
const MUSIC_DUCKED = 0.13;

const clips = (() => {
  let from = 0;
  return SCENES.flatMap(s => {
    const v = NARRATION ? VOICE[s.name] : undefined;
    const start = from + (v?.offset ?? 0);
    from += s.frames;
    return v ? [{ name: s.name, start, end: start + Math.ceil(v.seconds * FPS) }] : [];
  });
})();

function musicVolume(frame: number) {
  const fades = interpolate(frame, [0, 30, DURATION - 75, DURATION - 5], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const RAMP = 10;
  const duck = clips.reduce((d, c) => {
    const amount = interpolate(frame, [c.start - RAMP, c.start, c.end, c.end + RAMP], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return Math.max(d, amount);
  }, 0);
  return fades * interpolate(duck, [0, 1], [MUSIC_GAIN, MUSIC_DUCKED]);
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
}

export function TabDoctorVideo() {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <Audio src={staticFile('music/bed.m4a')} volume={musicVolume} />
      {clips.map(c => (
        <Sequence key={`voice-${c.name}`} from={c.start} durationInFrames={c.end - c.start + 5} layout="none" name={`voice ${c.name}`}>
          <Audio src={staticFile(`voice/${c.name}.wav`)} volume={VOICE_GAIN} />
        </Sequence>
      ))}
      {SCENES.map(s => {
        const el = (
          <Sequence key={s.name} from={from} durationInFrames={s.frames} name={s.name}>
            {s.fade ? <FadeIn><s.comp /></FadeIn> : <s.comp />}
          </Sequence>
        );
        from += s.frames;
        return el;
      })}
    </AbsoluteFill>
  );
}
