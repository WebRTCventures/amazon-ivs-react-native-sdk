# Getting started

## Requirements

| Platform | Minimum |
| --- | --- |
| iOS | 14.0 |
| Android | API 28 (Android 9) |
| React Native | 0.81+ with **New Architecture enabled** |
| Node | 22.11+ (see `.nvmrc`) |

## iOS setup

### New Architecture

Set `RCT_NEW_ARCH_ENABLED=1` before `pod install`. The library's podspec fails fast if New Architecture is off.

### Info.plist

Add usage descriptions (customize the strings for your app):

```xml
<key>NSCameraUsageDescription</key>
<string>This app publishes your camera to an Amazon IVS Real-Time stage.</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app publishes your microphone to an Amazon IVS Real-Time stage.</string>
```

### CocoaPods — IVS Broadcast SDK

AWS ships Real-Time (Stages) SDK versions newer than 1.38 via XCFramework download only. Add the vendored podspec from this package:

```ruby
# Podfile
pod 'AmazonIVSBroadcastStages',
    :podspec => '../node_modules/amazon-ivs-react-native-sdk/vendor/AmazonIVSBroadcastStages.podspec'
```

Then:

```bash
cd ios && pod install
```

## Android setup

### New Architecture

In your app's `gradle.properties`:

```properties
newArchEnabled=true
```

### Permissions

The library's manifest merges:

- `android.permission.CAMERA`
- `android.permission.RECORD_AUDIO`
- `android.permission.MODIFY_AUDIO_SETTINGS`

Your app manifest should declare the same permissions you intend to request at runtime. The example app requests camera and microphone when the user turns on preview or goes live.

### minSdk

Set `minSdkVersion` to **28** or higher in your app's `build.gradle`. The IVS Stages AAR requires it.

### compileSdk

The library targets compileSdk 36; match or exceed in your app.

## Linking

Autolinking handles the native module. After install:

1. Rebuild the native app (not just Metro refresh).
2. If codegen fails, clean build folders and rebuild.

## Next steps

- [Tokens](tokens.md) — create a stage and mint participant tokens
- [Architecture](architecture.md) — how the SDK is layered
- Run the [example app](../example/README.md) for home → pre-join → call
