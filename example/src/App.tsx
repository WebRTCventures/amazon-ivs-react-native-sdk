import { useState } from 'react';
import { Alert } from 'react-native';
import {
  IVSStageProvider,
  useLocalMedia,
  useStage,
  type AspectMode,
} from 'amazon-ivs-react-native-sdk';
import { DebugSheet } from './components/DebugSheet';
import { MediaSettingsSheet } from './components/MediaSettingsSheet';
import { useEventLog } from './hooks/useEventLog';
import { VIDEO_PRESETS } from './media';
import { HomeScreen } from './screens/HomeScreen';
import { PreJoinScreen } from './screens/PreJoinScreen';
import { StageScreen } from './screens/StageScreen';
import {
  DEFAULT_DISPLAY_NAME,
  MEETING_CODE,
  MEETING_TITLE,
  STAGE_PARTICIPANT_TOKEN,
} from './stage.config';

function AppContent() {
  const token = STAGE_PARTICIPANT_TOKEN.trim();
  const [screen, setScreen] = useState<'home' | 'prejoin' | 'call'>('home');
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME);
  const [joining, setJoining] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [videoLabel, setVideoLabel] = useState(VIDEO_PRESETS[0]!.label);
  const [aspectMode, setAspectMode] = useState<AspectMode>('fill');
  const [mirror, setMirror] = useState(true);

  const { join, leave, stage, clearError } = useStage();
  const {
    setPublishEnabled,
    setCameraEnabled,
    setMicrophoneEnabled,
    setCameraPosition,
    cameraPosition,
  } = useLocalMedia();
  const { entries, clear } = useEventLog();

  const video =
    VIDEO_PRESETS.find((preset) => preset.label === videoLabel) ??
    VIDEO_PRESETS[0]!;

  async function applySettings(camera: boolean, microphone: boolean) {
    await setCameraEnabled(camera);
    await setMicrophoneEnabled(microphone);
    await setCameraPosition(cameraPosition);
    await stage.setVideoConfig(video.config);
  }

  async function handleJoin(options: { camera: boolean; microphone: boolean }) {
    clearError();
    setJoining(true);
    try {
      await applySettings(options.camera, options.microphone);
      await join(token, { publish: true });
      await setPublishEnabled(true);
      await applySettings(options.camera, options.microphone);
      setScreen('call');
    } catch (e) {
      console.error('Join failed', e);
      setJoining(false);
      setScreen('prejoin');
    }
  }

  async function handleLeave() {
    setJoining(false);
    await leave();
    setScreen('home');
  }

  function handleJoinWithCode(code: string) {
    if (code.replace(/\s/g, '').toUpperCase() !== MEETING_CODE.toUpperCase()) {
      Alert.alert('Code not found', 'Check the code and try again.');
      return;
    }
    setScreen('prejoin');
  }

  return (
    <>
      {screen === 'home' ? (
        <HomeScreen
          hasToken={token.length > 0}
          onNewMeeting={() => setScreen('prejoin')}
          onJoinMeeting={handleJoinWithCode}
          onOpenDebug={() => setDebugOpen(true)}
        />
      ) : null}

      {screen === 'prejoin' ? (
        <PreJoinScreen
          meetingTitle={MEETING_TITLE}
          meetingCode={MEETING_CODE}
          displayName={displayName}
          onChangeDisplayName={setDisplayName}
          onBack={() => setScreen('home')}
          onJoin={handleJoin}
          joining={joining}
          aspectMode={aspectMode}
          mirror={mirror}
          videoLabel={videoLabel}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDebug={() => setDebugOpen(true)}
        />
      ) : null}

      {screen === 'call' ? (
        <StageScreen
          meetingTitle={MEETING_TITLE}
          meetingCode={MEETING_CODE}
          displayName={displayName}
          onLeave={handleLeave}
          aspectMode={aspectMode}
          mirror={mirror}
          videoLabel={videoLabel}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenDebug={() => setDebugOpen(true)}
        />
      ) : null}

      <MediaSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        videoLabel={videoLabel}
        onVideoLabel={setVideoLabel}
        aspectMode={aspectMode}
        onAspectMode={setAspectMode}
        mirror={mirror}
        onMirror={setMirror}
      />
      <DebugSheet
        visible={debugOpen}
        onClose={() => setDebugOpen(false)}
        entries={entries}
        onClearLog={clear}
      />
    </>
  );
}

export default function App() {
  return (
    <IVSStageProvider subscribe="audio-video">
      <AppContent />
    </IVSStageProvider>
  );
}
