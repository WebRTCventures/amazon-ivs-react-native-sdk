# Demo

Meet-style sample for [`amazon-ivs-react-native-sdk`](../README.md). The app is the walkthrough: three screens, one join path, tokens stay out of the UI.

A product app would mint tokens on your server when someone creates or joins a room. This demo reads a token from gitignored `stage.config.ts` so reviewers can run it locally. A build handed to testers has no token at all; they paste one under **Debug → Token** (see [Tester builds](#tester-builds-android)).

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

**Use a physical phone.** The iOS Simulator has no camera, so the preview stays black. Android emulators have a virtual camera, but the camera and audio paths that matter only behave for real on a device.

iOS: the phone and the Mac must share Wi‑Fi. Metro defaults to port 8081. Android: connect over USB and run `adb reverse tcp:8081 tcp:8081`.

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

### Signing (device builds and archives)

The checked-in `example/ios/Signing.xcconfig` is deliberately repository-neutral:
a project-owned bundle identifier and an empty `DEVELOPMENT_TEAM`. Contributors
are not members of each other's Apple teams, so a hardcoded team here would
break device builds and archives for everyone else.

To run on a physical device or archive for TestFlight, create your own override:

```sh
cat > example/ios/Signing.local.xcconfig <<'EOF'
DEVELOPMENT_TEAM = ABCDE12345
PRODUCT_BUNDLE_IDENTIFIER = com.yourcompany.ivsexample
EOF
```

`Signing.local.xcconfig` is gitignored and wins over the committed defaults.
Simulator builds need neither file.

## Run

```sh
yarn example start
yarn example ios --device
```

### Android

Needs JDK 17 (React Native 0.85 pins `jvmToolchain(17)`; newer JDKs fail) and an Android SDK with platform 36. Point Gradle at the SDK with `ANDROID_HOME`, or with `sdk.dir` in a gitignored `example/android/local.properties`.

```sh
yarn example start
adb reverse tcp:8081 tcp:8081
yarn example android
```

A release build embeds the JS bundle, so it runs without Metro:

```sh
cd example/android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
# app/build/outputs/apk/release/app-release.apk
```

Release builds are signed with the debug keystore unless these Gradle properties are set, for example in `~/.gradle/gradle.properties`: `ivsExampleReleaseStoreFile`, `ivsExampleReleaseStorePassword`, `ivsExampleReleaseKeyAlias`, `ivsExampleReleaseKeyPassword`.

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

## Tester builds (Android)

The **Android example** workflow (`.github/workflows/android-example.yml`) builds a release APK only when asked, so it doesn't spend Actions minutes on every pull request. There are two ways to run it:

- **Push a tag** named `example-android-<version>`, for example `git tag example-android-0.2.0 && git push origin example-android-0.2.0`. The workflow builds that commit and publishes the APK as a GitHub prerelease on the tag, with `versionName` set to the part after `example-android-`.
- **Run it manually** from the Actions tab. The APK is attached to the run as an artifact. Tick **release** to also publish it as a prerelease tagged `example-android-0.1.<run>`.

Never use a `v*` tag for this: those publish the library to npm.

Each build's `versionCode` is its run number, so a newer APK installs over an older one.

**The APK carries no token.** For each tester, mint a token with their own user id and send it to them:

```sh
./scripts/ivs token --user-id alice --username Alice
```

The tester installs the APK (allowing installs from their browser or files app), opens **Debug → Token**, pastes the token and taps **Use token**. The tab shows when the token expires. A pasted token lasts until the app restarts.

**Signing.** Without secrets, CI signs with the debug keystore that is committed to the repo. That is fine for testing, but anyone can produce an update signed with the same key, and it can never go to Play. To sign with a real key, add these repository secrets: `ANDROID_EXAMPLE_KEYSTORE_BASE64` (`base64 -w0 release.jks`), `ANDROID_EXAMPLE_KEYSTORE_PASSWORD`, `ANDROID_EXAMPLE_KEY_ALIAS` and `ANDROID_EXAMPLE_KEY_PASSWORD`. Testers have to uninstall once when the key changes.

See [docs/release-checklist.md](../docs/release-checklist.md) before a release.
