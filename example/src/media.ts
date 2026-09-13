import type { IVSVideoConfig } from 'amazon-ivs-react-native-sdk';

export const VIDEO_PRESETS: { label: string; config: IVSVideoConfig }[] = [
  {
    label: '720p',
    config: {
      width: 1280,
      height: 720,
      targetFramerate: 30,
      maxBitrate: 2_500_000,
    },
  },
  {
    label: '540p',
    config: {
      width: 960,
      height: 540,
      targetFramerate: 30,
      maxBitrate: 1_200_000,
    },
  },
  {
    label: '360p',
    config: {
      width: 640,
      height: 360,
      targetFramerate: 15,
      maxBitrate: 600_000,
    },
  },
];
