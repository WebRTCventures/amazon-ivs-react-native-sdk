import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type Kind = 'mic' | 'cam' | 'switch' | 'leave';

function MicGlyph({ off }: { off?: boolean }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.micCapsule, off && styles.glyphOff]} />
      <View style={[styles.micArc, off && styles.glyphOff]} />
      <View style={[styles.micStem, off && styles.micStemOff]} />
      {off ? <View style={styles.slash} /> : null}
    </View>
  );
}

function CamGlyph({ off }: { off?: boolean }) {
  return (
    <View style={styles.glyph}>
      <View style={[styles.camBody, off && styles.glyphOff]} />
      <View style={[styles.camLens, off && styles.glyphOff]} />
      {off ? <View style={styles.slash} /> : null}
    </View>
  );
}

function SwitchGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.switchTop} />
      <View style={styles.switchBottom} />
    </View>
  );
}

function LeaveGlyph() {
  return (
    <View style={styles.glyph}>
      <View style={styles.leaveBar} />
    </View>
  );
}

export function CallIconButton({
  kind,
  off,
  onPress,
}: {
  kind: Kind;
  off?: boolean;
  onPress: () => void | Promise<void>;
}) {
  const danger = kind === 'leave';
  const label =
    kind === 'mic'
      ? off
        ? 'Unmute'
        : 'Mute'
      : kind === 'cam'
        ? off
          ? 'Camera on'
          : 'Camera off'
        : kind === 'switch'
          ? 'Switch camera'
          : 'Leave';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Promise.resolve(onPress()).catch(console.error);
      }}
      style={({ pressed }) => [
        styles.circle,
        danger && styles.circleLeave,
        off && !danger && styles.circleOff,
        pressed && styles.pressed,
      ]}
    >
      {kind === 'mic' ? <MicGlyph off={off} /> : null}
      {kind === 'cam' ? <CamGlyph off={off} /> : null}
      {kind === 'switch' ? <SwitchGlyph /> : null}
      {kind === 'leave' ? <LeaveGlyph /> : null}
    </Pressable>
  );
}

const ink = '#1C1C1E';
const inkOnDark = '#FFFFFF';

const styles = StyleSheet.create({
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOff: {
    backgroundColor: colors.danger,
  },
  circleLeave: {
    backgroundColor: colors.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  glyph: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphOff: {
    borderColor: inkOnDark,
    backgroundColor: 'transparent',
  },
  micCapsule: {
    width: 10,
    height: 14,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: ink,
  },
  micArc: {
    position: 'absolute',
    bottom: 4,
    width: 16,
    height: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: ink,
  },
  micStem: {
    position: 'absolute',
    bottom: 0,
    width: 2,
    height: 5,
    backgroundColor: ink,
    borderRadius: 1,
  },
  micStemOff: {
    backgroundColor: inkOnDark,
  },
  camBody: {
    width: 18,
    height: 12,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: ink,
  },
  camLens: {
    position: 'absolute',
    right: 1,
    width: 6,
    height: 6,
    borderRadius: 1,
    borderWidth: 2,
    borderColor: ink,
    transform: [{ rotate: '20deg' }],
  },
  switchTop: {
    width: 16,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: ink,
    borderTopRightRadius: 4,
    marginBottom: 3,
  },
  switchBottom: {
    width: 16,
    height: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: ink,
    borderBottomLeftRadius: 4,
  },
  leaveBar: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: inkOnDark,
  },
  slash: {
    position: 'absolute',
    width: 22,
    height: 2,
    backgroundColor: inkOnDark,
    transform: [{ rotate: '-35deg' }],
  },
});
