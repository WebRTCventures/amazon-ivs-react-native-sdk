# Demo

Meet-style sample for [`amazon-ivs-react-native-sdk`](../README.md). The app is the walkthrough: three screens, one join path, tokens stay out of the UI.

A product app would mint tokens on your server when someone creates or joins a room. This demo reads a token from gitignored `stage.config.ts` so reviewers can run it locally.

## How it was built

The old example was a single lobby with a JWT field, publish jargon, and a Lab screen. It was rewritten as a small meeting flow:

1. **Home** — New meeting, or join with a short code (not a token).
2. **Pre-join** — Camera preview, name, mic / camera / flip, then **Join now**.
3. **Call** — Local tile + remotes, same controls, leave.

Settings (resolution, mirror, fill/fit) live in `App.tsx` so they survive preview → call. Debug is a sheet on top of those screens, not its own destination.

```
example/src/
  App.tsx                 IVSStageProvider, screen state, join / leave
  stage.config.ts         gitignored token + meeting code
  stage.config.example.ts checked-in template
  media.ts                720p / 540p / 360p publish presets
  theme.ts                light UI tokens
  screens/
    HomeScreen.tsx
    PreJoinScreen.tsx
    StageScreen.tsx
  components/             buttons, tiles, settings, debug
  hooks/useEventLog.ts    stage events → Debug → Logs
```

### SDK surface the demo uses

| Need | API |
| --- | --- |
| Stage + events | `IVSStageProvider`, `useStage`, `useStageEvent` |
| Join / leave / publish | `join(token, { publish: true })`, `setPublishEnabled`, `leave` |
| Camera / mic | `useLocalMedia` — `prepareDevices`, `setCameraEnabled`, `setMicrophoneEnabled`, `flipCamera` |
| Local preview | `IVSLocalPreviewView` (`mirror`, `aspectMode`) |
| Remote video | `useParticipants` + `IVSParticipantVideoView` |
| Encode size | `stage.setVideoConfig` (what remotes receive, not the preview texture) |
| Permissions | `requestCameraPermission`, `requestMicrophonePermission` |

`App.tsx` is the map. Join applies cam/mic/position/`setVideoConfig`, then `join` + `setPublishEnabled(true)`, then applies those settings again so the call does not flash SDK defaults.

### Why mirror is `'on' | 'off'`

Fabric omits a boolean `false` on remount. Join creates a new `IVSLocalPreviewView`, so `mirror={false}` used to snap back to the native default (`true`). The JS prop is still `mirror: boolean`; the native spec uses `'on' | 'off'`.

Mute, camera, and flip emit `participantUpdated` (and sometimes `streamsChanged`). Debug → Logs listens for those. Pre-join only talks to the local camera, so those rows appear after you are in the call.

## Device

**Use a physical iPhone.** The Simulator has no camera — preview stays black.

Phone and Mac must share Wi‑Fi. Metro defaults to port 8081.

## Setup

From the repo root:

```sh
yarn install
cp example/src/stage.config.example.ts example/src/stage.config.ts
```

Mint a participant token (never commit it):

```sh
cp scripts/ivs.env.example scripts/ivs.env   # fill IVS_STAGE_ARN
./scripts/ivs token --copy
```

Paste into `STAGE_PARTICIPANT_TOKEN` in `example/src/stage.config.ts`. Set `MEETING_CODE` to whatever guests type (for example `482916`).

## Run

```sh
yarn example start
yarn example ios --device
```

If pods are stale:

```sh
cd example/ios
RCT_NEW_ARCH_ENABLED=1 bundle exec pod install
cd ../..
yarn example ios --device
```

1. **New meeting** → allow camera/mic → check preview → **Join now**
2. On a second phone, mint another token (`./scripts/ivs token --user-id guest --copy`), put it in that phone’s `stage.config.ts`, then **Join with a code** using the same `MEETING_CODE`

Or join from the [IVS real-time web demo](https://aws.github.io/amazon-ivs-real-time-web-demo/) with a separate token.

See [docs/release-checklist.md](../docs/release-checklist.md) before a release.
