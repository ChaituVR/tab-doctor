import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Title } from './scenes/Title';
import { Intro } from './scenes/Intro';
import { Duplicates } from './scenes/Duplicates';
import { Stale } from './scenes/Stale';
import { Snooze } from './scenes/Snooze';
import { Settings } from './scenes/Settings';
import { Options, FLIPS } from './scenes/Options';
import { Privacy } from './scenes/Privacy';
import { Outro } from './scenes/Outro';
import { colors } from './theme';
import { VOICE } from './voice';
import { ALL_TABS, isDuplicate, isNewest } from './data';

export const FPS = 30;
// Narration is off: run `npm run voice` in video/ to generate the clips, then flip this on.
const NARRATION = false;
const SCENES = [
  { name: 'title', comp: Title, frames: 75, fade: false },
  { name: 'intro', comp: Intro, frames: NARRATION ? 150 : 120, fade: true },
  { name: 'duplicates', comp: Duplicates, frames: NARRATION ? 200 : 180, fade: false },
  { name: 'stale', comp: Stale, frames: 200, fade: false },
  { name: 'snooze', comp: Snooze, frames: 250, fade: false },
  { name: 'settings', comp: Settings, frames: 160, fade: true },
  { name: 'options', comp: Options, frames: 210, fade: true },
  { name: 'privacy', comp: Privacy, frames: NARRATION ? 195 : 150, fade: true },
  { name: 'outro', comp: Outro, frames: 120, fade: true }
];
export const DURATION = SCENES.reduce((n, s) => n + s.frames, 0);
const OVERLAP = 12;
const sceneStart = (name: string) => {
  let from = 0;
  for (const s of SCENES) { if (s.name === name) return from; from += s.frames; }
  return 0;
};

// UI sounds, placed at the frame where the matching visual happens (scene-local frames).
const SFX: { file: string; at: number; gain?: number }[] = [
  { file: 'chime', at: sceneStart('title') + 6, gain: 0.35 },
  ...ALL_TABS.flatMap((t, i) => (isDuplicate(t) && !isNewest(t)) ? [{ file: 'pop', at: sceneStart('duplicates') + 62 + (i % 6) * 4, gain: 0.35 }] : []),
  { file: 'whoosh', at: sceneStart('stale') + 45, gain: 0.5 },
  { file: 'click', at: sceneStart('stale') + 138 },
  { file: 'chime', at: sceneStart('stale') + 141, gain: 0.4 },
  { file: 'click', at: sceneStart('snooze') + 44 },
  { file: 'click', at: sceneStart('snooze') + 108 },
  { file: 'whoosh', at: sceneStart('snooze') + 112, gain: 0.5 },
  { file: 'chime', at: sceneStart('snooze') + 186, gain: 0.4 },
  { file: 'click', at: sceneStart('settings') + 78 },
  { file: 'switch', at: sceneStart('settings') + 82, gain: 0.6 },
  ...FLIPS.flatMap(f => [{ file: 'click', at: sceneStart('options') + f.press }, { file: 'switch', at: sceneStart('options') + f.press + 3, gain: 0.6 }]),
  { file: 'typing', at: sceneStart('privacy') + 5, gain: 0.5 },
  { file: 'pop', at: sceneStart('outro') + 3, gain: 0.5 },
];

const VOICE_GAIN = 0.72;
const MUSIC_GAIN = NARRATION ? 0.28 : 0.55;
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

function CrossIn({ children }: { children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(frame, [0, OVERLAP], [0, 1], { extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
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
      {SFX.map((x, i) => (
        <Sequence key={`sfx-${i}`} from={x.at} durationInFrames={60} layout="none" name={`sfx ${x.file}`}>
          <Audio src={staticFile(`sfx/${x.file}.wav`)} volume={x.gain ?? 0.45} />
        </Sequence>
      ))}
      {SCENES.map((s, i) => {
        const start = i === 0 ? 0 : from - OVERLAP;
        const frames = s.frames + (i === 0 ? 0 : OVERLAP);
        const el = (
          <Sequence key={s.name} from={start} durationInFrames={frames} name={s.name}>
            {i === 0 ? <s.comp /> : <CrossIn><s.comp /></CrossIn>}
          </Sequence>
        );
        from = start + frames;
        return el;
      })}
    </AbsoluteFill>
  );
}
