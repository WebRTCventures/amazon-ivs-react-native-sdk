import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStage, type AspectMode } from 'amazon-ivs-react-native-sdk';
import { VIDEO_PRESETS } from '../media';
import { colors, radius, space, type } from '../theme';

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MediaSettingsSheet({
  visible,
  onClose,
  videoLabel,
  onVideoLabel,
  aspectMode,
  onAspectMode,
  mirror,
  onMirror,
}: {
  visible: boolean;
  onClose: () => void;
  videoLabel: string;
  onVideoLabel: (label: string) => void;
  aspectMode: AspectMode;
  onAspectMode: (mode: AspectMode) => void;
  mirror: boolean;
  onMirror: (value: boolean) => void;
}) {
  const { stage } = useStage();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Settings</Text>

          <Text style={styles.label}>Resolution</Text>
          <View style={styles.row}>
            {VIDEO_PRESETS.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                selected={videoLabel === preset.label}
                onPress={() => {
                  onVideoLabel(preset.label);
                  stage.setVideoConfig(preset.config).catch(console.error);
                }}
              />
            ))}
          </View>

          <Text style={styles.label}>Mirror</Text>
          <View style={styles.row}>
            <Chip label="On" selected={mirror} onPress={() => onMirror(true)} />
            <Chip
              label="Off"
              selected={!mirror}
              onPress={() => onMirror(false)}
            />
          </View>

          <Text style={styles.label}>Fit</Text>
          <View style={styles.row}>
            <Chip
              label="Fill"
              selected={aspectMode === 'fill'}
              onPress={() => onAspectMode('fill')}
            />
            <Chip
              label="Fit"
              selected={aspectMode === 'fit'}
              onPress={() => onAspectMode('fit')}
            />
          </View>

          <Pressable onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function GearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.gear}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Text style={styles.gearText}>⚙</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  title: {
    ...type.headline,
    color: colors.text,
    fontSize: 20,
    marginBottom: space.sm,
  },
  label: {
    marginTop: space.sm,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.fill,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  chipLabelSelected: {
    color: colors.textOnAccent,
  },
  done: {
    marginTop: space.lg,
    alignItems: 'center',
    paddingVertical: space.md,
  },
  doneText: {
    ...type.headline,
    color: colors.accent,
  },
  gear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
});
