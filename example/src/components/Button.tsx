import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space, type } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'secondary',
  disabled,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Promise.resolve(onPress()).catch(console.error);
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' && styles.labelOnFill,
          variant === 'ghost' && styles.labelGhost,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  ghost: {
    backgroundColor: 'transparent',
    minHeight: 40,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    ...type.button,
    color: colors.text,
    textAlign: 'center',
  },
  labelOnFill: {
    color: colors.textOnAccent,
  },
  labelGhost: {
    color: colors.accent,
  },
});
