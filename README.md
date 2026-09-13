# amazon-ivs-react-native-sdk

React Native SDK for [Amazon IVS Real-Time](https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/) (Stages). Join a stage, watch or publish camera and microphone, and render video with Fabric native views.

Requires **React Native New Architecture** (TurboModules + Fabric). Peer dependencies: `react >= 18.2.0`, `react-native >= 0.81.0`.

## Install

```bash
yarn add amazon-ivs-react-native-sdk
# or: npm install amazon-ivs-react-native-sdk
```

### iOS

1. Set `RCT_NEW_ARCH_ENABLED=1` (or `newArchEnabled=true` in Gradle for Android).
2. Add the vendored IVS Broadcast pod to your **Podfile** (AWS no longer publishes Stages versions > 1.38 via CocoaPods trunk):

```ruby
pod 'AmazonIVSBroadcastStages',
    :podspec => '../node_modules/amazon-ivs-react-native-sdk/vendor/AmazonIVSBroadcastStages.podspec'
```

3. Run `pod install`.

See [docs/getting-started.md](docs/getting-started.md) for Info.plist keys and platform versions (iOS 14.0+, Android minSdk 28).

### Android

Ensure `newArchEnabled=true` in `gradle.properties`. The library declares `CAMERA`, `RECORD_AUDIO`, and `MODIFY_AUDIO_SETTINGS`; your app must also declare runtime permissions you use.

## 60-second quickstart

```tsx
import {
  IVSLocalPreviewView,
  IVSParticipantVideoView,
  IVSStageProvider,
  useLocalMedia,
  useParticipants,
  useStage,
} from 'amazon-ivs-react-native-sdk';

function Room() {
  const { connectionState, join, leave } = useStage();
  const participants = useParticipants();
  const { publishEnabled, setPublishEnabled } = useLocalMedia();
  const remotes = participants.filter((p) => !p.isLocal);

  if (connectionState === 'disconnected') {
    return (
      <Button
        title="Join"
        onPress={() => join(PARTICIPANT_TOKEN, { publish: false })}
      />
    );
  }

  return (
    <>
      {publishEnabled ? (
        <IVSLocalPreviewView style={{ flex: 1 }} />
      ) : null}
      {remotes.map((p) => (
        <IVSParticipantVideoView
          key={p.participantId}
          participantId={p.participantId}
          style={{ height: 200 }}
        />
      ))}
      <Button
        title={publishEnabled ? 'Stop live' : 'Go live'}
        onPress={() => setPublishEnabled(!publishEnabled)}
      />
      <Button title="Leave" onPress={() => leave()} />
    </>
  );
}

export default function App() {
  return (
    <IVSStageProvider subscribe="audio-video">
      <Room />
    </IVSStageProvider>
  );
}
```

Mint a participant token with the included CLI — see [docs/tokens.md](docs/tokens.md).

## Example app

Meet-style Demo: home → pre-join preview → call. See [example/README.md](example/README.md).

```bash
yarn install
cp example/src/stage.config.example.ts example/src/stage.config.ts
# paste a token into stage.config.ts
yarn example ios    # or: yarn example android
```

## Documentation

| Doc | Description |
| --- | --- |
| [Getting started](docs/getting-started.md) | Platform setup, permissions, pod line |
| [Tokens](docs/tokens.md) | AWS stages, participant tokens, CLI |
| [Architecture](docs/architecture.md) | Four layers and boundary rules |
| [API reference](docs/api.md) | TSDoc / exported surface |
| [Audio](docs/audio.md) | Presets, routing, defaults |
| [Adding a feature](docs/adding-a-feature.md) | Contributor checklist |
| [Upgrading native SDK](docs/upgrading-the-native-sdk.md) | Bump AAR + podspec together |
| [Release checklist](docs/release-checklist.md) | Manual two-platform pass |
| [Troubleshooting](docs/troubleshooting.md) | Emulator, preview, pod install |
| [Contributing](CONTRIBUTING.md) | Dev workflow |
| [ADRs](docs/adr/) | Architecture decision records |

## License

MIT — see [LICENSE](LICENSE).
