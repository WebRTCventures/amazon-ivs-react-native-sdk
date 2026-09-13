import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  IVSLocalPreviewView,
  requestCameraPermission,
  requestMicrophonePermission,
  useLocalMedia,
  type AspectMode,
} from 'amazon-ivs-react-native-sdk';
import { Button } from '../components/Button';
import { CallIconButton } from '../components/CallControls';
import { DebugLink } from '../components/DebugSheet';
import { GearButton } from '../components/MediaSettingsSheet';
import { colors, radius, space, type } from '../theme';

export function PreJoinScreen({
  meetingTitle,
  meetingCode,
  displayName,
  onChangeDisplayName,
  onBack,
  onJoin,
  joining,
  aspectMode,
  mirror,
  videoLabel,
  onOpenSettings,
  onOpenDebug,
}: {
  meetingTitle: string;
  meetingCode: string;
  displayName: string;
  onChangeDisplayName: (value: string) => void;
  onBack: () => void;
  onJoin: (options: { camera: boolean; microphone: boolean }) => void;
  joining: boolean;
  aspectMode: AspectMode;
  mirror: boolean;
  videoLabel: string;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
}) {
  const { prepareDevices, flipCamera } = useLocalMedia();
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [previewReady, setPreviewReady] = useState(false);
  const [status, setStatus] = useState('Starting camera…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cam = await requestCameraPermission();
        await requestMicrophonePermission();
        if (cancelled) {
          return;
        }
        if (cam !== 'granted') {
          setCameraOn(false);
          setPreviewReady(false);
          setStatus('Camera is off');
          await prepareDevices({ camera: false, microphone: true });
          return;
        }
        await prepareDevices({ camera: true, microphone: true });
        setPreviewReady(true);
      } catch (e) {
        setPreviewReady(false);
        setStatus(e instanceof Error ? e.message : 'Camera unavailable');
      }
    })().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [prepareDevices]);

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    try {
      if (next) {
        const cam = await requestCameraPermission();
        if (cam !== 'granted') {
          setCameraOn(false);
          setStatus('Camera is off');
          return;
        }
        await prepareDevices({ camera: true, microphone: micOn });
        setPreviewReady(true);
      } else {
        await prepareDevices({ camera: false, microphone: micOn });
        setPreviewReady(false);
        setStatus('Camera is off');
      }
    } catch (e) {
      console.error('toggleCamera failed', e);
    }
  }

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    try {
      await prepareDevices({
        camera: cameraOn && previewReady,
        microphone: next,
      });
    } catch (e) {
      console.error('toggleMic failed', e);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.video} />
      <SafeAreaView>
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <View style={styles.topMeta}>
            <Text style={styles.meetingTitle}>{meetingTitle}</Text>
            <Text style={styles.meetingCode}>Code {meetingCode}</Text>
          </View>
          <DebugLink light onPress={onOpenDebug} />
        </View>
      </SafeAreaView>

      <Pressable style={styles.previewLayer} onPress={Keyboard.dismiss}>
        {previewReady ? (
          <IVSLocalPreviewView
            style={styles.previewFill}
            aspectMode={aspectMode}
            mirror={mirror}
          />
        ) : (
          <View style={styles.previewFallback}>
            {status === 'Starting camera…' ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Text style={styles.previewFallbackBody}>{status}</Text>
            )}
          </View>
        )}
        <View style={styles.gearWrap} pointerEvents="box-none">
          <Text style={styles.resBadge}>{videoLabel}</Text>
          <GearButton onPress={onOpenSettings} />
        </View>
      </Pressable>

      <SafeAreaView>
        <View style={styles.sheet}>
          <Text style={styles.sheetLabel}>Your name</Text>
          <TextInput
            style={styles.nameInput}
            value={displayName}
            onChangeText={onChangeDisplayName}
            placeholder="Name"
            placeholderTextColor={colors.textSecondary}
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={Keyboard.dismiss}
            editable={!joining}
          />

          <View style={styles.controlsRow}>
            <CallIconButton kind="mic" off={!micOn} onPress={toggleMic} />
            <CallIconButton kind="cam" off={!cameraOn} onPress={toggleCamera} />
            <CallIconButton kind="switch" onPress={() => flipCamera()} />
          </View>

          <Button
            variant="primary"
            label={joining ? 'Joining…' : 'Join now'}
            disabled={joining || (cameraOn && !previewReady)}
            onPress={() => onJoin({ camera: cameraOn, microphone: micOn })}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.video,
  },
  previewLayer: {
    flex: 1,
    backgroundColor: colors.video,
    minHeight: 220,
  },
  previewFill: {
    flex: 1,
    width: '100%',
  },
  previewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  previewFallbackBody: {
    ...type.body,
    color: '#C7C7CC',
    textAlign: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  back: {
    ...type.headline,
    color: '#FFFFFF',
    minWidth: 56,
  },
  topMeta: {
    flex: 1,
    alignItems: 'center',
  },
  gearWrap: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  resBadge: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: colors.overlay,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meetingTitle: {
    ...type.headline,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  meetingCode: {
    ...type.caption,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 2,
  },
  sheet: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    gap: space.md,
  },
  sheetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  nameInput: {
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.canvas,
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.lg,
    paddingVertical: space.sm,
  },
});
