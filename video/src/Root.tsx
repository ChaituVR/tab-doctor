import { Composition } from 'remotion';
import { TabDoctorVideo, DURATION, FPS } from './Video';

export const RemotionRoot = () => (
  <Composition
    id="TabDoctor"
    component={TabDoctorVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
