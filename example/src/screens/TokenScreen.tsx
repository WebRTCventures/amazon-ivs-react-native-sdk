import { useState } from 'react';
import {
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
import { Button } from '../components/Button';
import { DebugLink } from '../components/DebugSheet';
import { colors, radius, space, type } from '../theme';

export function TokenScreen({
  meetingTitle,
  token,
  onChangeToken,
  onBack,
  onContinue,
  onOpenDebug,
}: {
  meetingTitle: string;
  token: string;
  onChangeToken: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
  onOpenDebug: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const ready = token.trim().length > 0;

  function submit() {
    if (!ready) {
      setError('Paste a participant token to continue.');
      return;
    }
    onContinue();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
            <Text style={styles.back}>Back</Text>
          </Pressable>
          <Text style={styles.topTitle}>{meetingTitle}</Text>
          <DebugLink onPress={onOpenDebug} />
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>Participant token</Text>
          <Text style={styles.hint}>
            Each person needs their own token for this stage. For local testing
            this field is pre-filled from stage.config.ts.
          </Text>

          <TextInput
            style={styles.input}
            value={token}
            onChangeText={(value) => {
              onChangeToken(value);
              setError(null);
            }}
            placeholder="Paste participant token"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            multiline
            textAlignVertical="top"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            variant="primary"
            label="Continue"
            onPress={submit}
            disabled={!ready}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: {
    ...type.headline,
    color: colors.accent,
    minWidth: 56,
  },
  topTitle: {
    ...type.caption,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  title: {
    ...type.headline,
    color: colors.text,
    fontSize: 22,
    marginTop: space.sm,
  },
  hint: {
    ...type.body,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 140,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  error: {
    ...type.callout,
    color: colors.errorText,
  },
});
