import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  IVSLocalPreviewView,
  useLocalMedia,
  useParticipants,
  useStage,
  type AspectMode,
} from 'amazon-ivs-react-native-sdk';
import { CallIconButton } from '../components/CallControls';
import { DebugLink } from '../components/DebugSheet';
import { ErrorBanner } from '../components/ErrorBanner';
import { GearButton } from '../components/MediaSettingsSheet';
import { ParticipantTile } from '../components/ParticipantTile';
import { colors, radius, space, type } from '../theme';

export function StageScreen({
  meetingTitle,
  meetingCode,
  displayName,
  onLeave,
  aspectMode,
  mirror,
  videoLabel,
  onOpenSettings,
  onOpenDebug,
}: {
  meetingTitle: string;
  meetingCode: string;
  displayName: string;
  onLeave: () => void;
  aspectMode: AspectMode;
  mirror: boolean;
  videoLabel: string;
  onOpenSettings: () => void;
  onOpenDebug: () => void;
}) {
  const { connectionState, error, clearError } = useStage();
  const participants = useParticipants();
  const {
    microphoneEnabled,
    cameraEnabled,
    setMicrophoneEnabled,
    setCameraEnabled,
    flipCamera,
  } = useLocalMedia();
  const remote = participants.filter((p) => !p.isLocal);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>{meetingTitle}</Text>
          <Text style={styles.meta}>
            {connectionState === 'connecting'
              ? 'Joining…'
              : `${remote.length + 1} in this call`}
          </Text>
        </View>
        <DebugLink onPress={onOpenDebug} />
      </View>

      {error ? (
        <View style={styles.bannerWrap}>
          <ErrorBanner
            message={`${error.code}: ${error.message}`}
            onDismiss={clearError}
          />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.selfPreview}>
          {cameraEnabled ? (
            <IVSLocalPreviewView
              style={styles.previewFill}
              aspectMode={aspectMode}
              mirror={mirror}
            />
          ) : (
            <View style={styles.cameraOffFill}>
              <Text style={styles.cameraOffTitle}>Camera off</Text>
            </View>
          )}
          <View style={styles.gearWrap}>
            <Text style={styles.resBadge}>{videoLabel}</Text>
            <GearButton onPress={onOpenSettings} />
          </View>
          <View style={styles.selfBadge}>
            <Text style={styles.selfBadgeText}>
              {displayName.trim() || 'You'} · {videoLabel}
            </Text>
          </View>
        </View>

        <FlatList
          style={styles.remoteListFlex}
          data={remote}
          keyExtractor={(item) => item.participantId}
          numColumns={2}
          columnWrapperStyle={remote.length > 0 ? styles.gridRow : undefined}
          contentContainerStyle={styles.remoteList}
          renderItem={({ item }) => (
            <ParticipantTile participant={item} aspectMode={aspectMode} />
          )}
          ListEmptyComponent={
            <Text style={styles.emptyRemote}>Code {meetingCode}</Text>
          }
        />
      </View>

      <View style={styles.dock}>
        <View style={styles.dockRow}>
          <CallIconButton
            kind="mic"
            off={!microphoneEnabled}
            onPress={() => setMicrophoneEnabled(!microphoneEnabled)}
          />
          <CallIconButton
            kind="cam"
            off={!cameraEnabled}
            onPress={() => setCameraEnabled(!cameraEnabled)}
          />
          <CallIconButton kind="switch" onPress={() => flipCamera()} />
          <CallIconButton kind="leave" onPress={onLeave} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flex: 1,
  },
  brand: {
    ...type.overline,
    color: colors.textSecondary,
  },
  meta: {
    ...type.callout,
    color: colors.text,
    marginTop: 4,
  },
  bannerWrap: {
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  body: {
    flex: 1,
    paddingHorizontal: space.lg,
  },
  selfPreview: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.video,
    marginBottom: space.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  previewFill: {
    flex: 1,
  },
  gearWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
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
  selfBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.overlay,
  },
  selfBadgeText: {
    color: '#F2F2F7',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraOffFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.video,
  },
  cameraOffTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F2F2F7',
  },
  remoteListFlex: {
    flex: 1,
  },
  remoteList: {
    paddingBottom: space.md,
    flexGrow: 1,
  },
  gridRow: {
    gap: space.md,
  },
  emptyRemote: {
    color: colors.textSecondary,
    ...type.body,
  },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: 18,
    backgroundColor: colors.card,
  },
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
});
