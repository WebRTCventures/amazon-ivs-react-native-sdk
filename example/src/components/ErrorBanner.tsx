import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space, type } from '../theme';

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <Pressable
      onPress={onDismiss}
      disabled={onDismiss == null}
      style={styles.banner}
    >
      <Text style={styles.text}>{message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.errorBanner,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  text: {
    ...type.callout,
    color: colors.errorText,
    fontWeight: '600',
  },
});
