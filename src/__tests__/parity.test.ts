/**
 * Parity harness: asserts the TurboModule spec surface is the contract both
 * platforms must implement, and that mapping wire strings are identical.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SPEC_METHODS = [
  'getSdkVersion',
  'getCapabilities',
  'enumerateDevices',
  'getCameraPermission',
  'getMicrophonePermission',
  'requestCameraPermission',
  'requestMicrophonePermission',
  'joinStage',
  'leaveStage',
  'renewToken',
  'listParticipants',
  'readState',
  'setPublishEnabled',
  'setMicrophoneEnabled',
  'setCameraEnabled',
  'setCameraPosition',
  'flipCamera',
  'prepareDevices',
  'releaseDevices',
  'setVideoConfig',
  'setDefaultSubscribeType',
  'setSubscribeType',
  'setAudioPreset',
  'setAudioOutput',
  'getAudioRoute',
] as const;

const SPEC_EVENTS = [
  'onStageConnectionStateChanged',
  'onParticipantJoined',
  'onParticipantUpdated',
  'onParticipantLeft',
  'onParticipantStreamsChanged',
  'onAudioRouteChanged',
  'onStageError',
] as const;

/** Canonical wire strings — both IvsMapping tables must emit these. */
export const WIRE_STRINGS = {
  connectionState: {
    disconnected: 'disconnected',
    connecting: 'connecting',
    connected: 'connected',
  },
  publishState: {
    notPublished: 'notPublished',
    attemptingPublish: 'attemptingPublish',
    published: 'published',
  },
  subscribeState: {
    notSubscribed: 'notSubscribed',
    attemptingSubscribe: 'attemptingSubscribe',
    subscribed: 'subscribed',
  },
  subscribeType: {
    none: 'none',
    audioOnly: 'audio-only',
    audioVideo: 'audio-video',
  },
  permissionStatus: {
    granted: 'granted',
    denied: 'denied',
    restricted: 'restricted',
    undetermined: 'undetermined',
  },
  audioOutput: {
    auto: 'auto',
    speaker: 'speaker',
    earpiece: 'earpiece',
    bluetooth: 'bluetooth',
    wired: 'wired',
  },
  mediaType: {
    audio: 'audio',
    video: 'video',
  },
} as const;

const ROOT = path.resolve(__dirname, '../..');

function fileContainsAll(
  filePath: string,
  needles: readonly string[]
): string[] {
  if (!fs.existsSync(filePath)) {
    return [...needles];
  }
  const src = fs.readFileSync(filePath, 'utf8');
  return needles.filter((n) => !src.includes(n));
}

describe('parity', () => {
  it('spec declares the full method and event surface', () => {
    const specPath = path.join(ROOT, 'src/spec/NativeAmazonIvsRealTime.ts');
    const missingMethods = fileContainsAll(specPath, SPEC_METHODS);
    const missingEvents = fileContainsAll(specPath, SPEC_EVENTS);
    expect(missingMethods).toEqual([]);
    expect(missingEvents).toEqual([]);
  });

  it('both platforms implement every spec method (native sources)', () => {
    const iosManager = path.join(ROOT, 'ios/IvsStageManager.mm');
    const iosShim = path.join(ROOT, 'ios/AmazonIvsRealTime.mm');
    const androidManager = path.join(
      ROOT,
      'android/src/main/java/com/amazonivsrealtime/IvsStageManager.kt'
    );
    const androidShim = path.join(
      ROOT,
      'android/src/main/java/com/amazonivsrealtime/AmazonIvsRealTimeModule.kt'
    );

    expect(fs.existsSync(iosShim)).toBe(true);
    expect(fs.existsSync(androidShim)).toBe(true);
    expect(fs.existsSync(iosManager)).toBe(true);
    expect(fs.existsSync(androidManager)).toBe(true);

    // Method names appear in the shim or manager on each platform.
    const iosSrc =
      fs.readFileSync(iosShim, 'utf8') + fs.readFileSync(iosManager, 'utf8');
    const androidSrc =
      fs.readFileSync(androidShim, 'utf8') +
      fs.readFileSync(androidManager, 'utf8');

    const iosMissing = SPEC_METHODS.filter((m) => !iosSrc.includes(m));
    const androidMissing = SPEC_METHODS.filter((m) => !androidSrc.includes(m));
    expect(iosMissing).toEqual([]);
    expect(androidMissing).toEqual([]);
  });

  it('mapping wire strings are identical across platforms', () => {
    const iosMap = path.join(ROOT, 'ios/IvsMapping.mm');
    const androidMap = path.join(
      ROOT,
      'android/src/main/java/com/amazonivsrealtime/IvsMapping.kt'
    );

    const expected = [
      ...Object.values(WIRE_STRINGS.connectionState),
      ...Object.values(WIRE_STRINGS.publishState),
      ...Object.values(WIRE_STRINGS.subscribeState),
      ...Object.values(WIRE_STRINGS.subscribeType),
      ...Object.values(WIRE_STRINGS.permissionStatus),
      ...Object.values(WIRE_STRINGS.audioOutput),
      ...Object.values(WIRE_STRINGS.mediaType),
    ];

    expect(fileContainsAll(iosMap, expected)).toEqual([]);
    expect(fileContainsAll(androidMap, expected)).toEqual([]);
  });

  it('iOS participant video view skips same-stream preview rebinds', () => {
    const videoView = path.join(ROOT, 'ios/IvsParticipantVideoView.mm');
    const src = fs.readFileSync(videoView, 'utf8');

    expect(src).toContain('stream == _attachedVideoStream');
    expect(src).toContain('[_attachedAspectMode isEqualToString:_aspectMode]');
    expect(src).toContain('_hostView.previewView != nil');

    const guardIndex = src.indexOf('if (alreadyAttached)');
    const clearIndex = src.indexOf('[_hostView clearPreview];');
    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(clearIndex).toBeGreaterThan(guardIndex);

    expect(src).toContain('_attachedVideoStream = stream;');
    expect(src).toContain('_attachedVideoStream = nil;');
  });
});
