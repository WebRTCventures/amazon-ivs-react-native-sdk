import { StyleSheet, Text, View } from 'react-native';
import {
  IVSParticipantVideoView,
  type AspectMode,
  type IVSParticipantInfo,
} from 'amazon-ivs-react-native-sdk';
import { colors, radius, space } from '../theme';

export function ParticipantTile({
  participant,
  aspectMode,
}: {
  participant: IVSParticipantInfo;
  aspectMode: AspectMode;
}) {
  const name = participant.userId || participant.participantId.slice(0, 8);

  return (
    <View style={styles.tile}>
      <View style={styles.media}>
        <IVSParticipantVideoView
          participantId={participant.participantId}
          aspectMode={aspectMode}
          style={styles.video}
        />
      </View>
      <View style={styles.footer}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    marginBottom: space.md,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  media: {
    height: 130,
    backgroundColor: colors.video,
  },
  video: {
    flex: 1,
    backgroundColor: colors.video,
  },
  footer: {
    padding: space.sm,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
