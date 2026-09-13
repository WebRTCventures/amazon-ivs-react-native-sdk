import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { ErrorBanner } from '../components/ErrorBanner';
import { colors, radius, space, type } from '../theme';

export function HomeScreen({
  hasToken,
  onNewMeeting,
  onJoinMeeting,
  onOpenDebug,
}: {
  hasToken: boolean;
  onNewMeeting: () => void;
  onJoinMeeting: (code: string) => void;
  onOpenDebug: () => void;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  function closeJoin() {
    setJoinOpen(false);
    setCode('');
    setJoinError(null);
  }

  function submitCode() {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setJoinError('Enter a meeting code.');
      return;
    }
    onJoinMeeting(trimmed);
    closeJoin();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>D</Text>
          </View>
          <Text style={styles.title}>Demo</Text>
        </View>

        {!hasToken ? (
          <ErrorBanner message="Add a token in stage.config.ts to join." />
        ) : null}

        <View style={styles.actions}>
          <Button
            variant="primary"
            label="New meeting"
            onPress={onNewMeeting}
            disabled={!hasToken}
          />
          <Button
            label="Join with a code"
            onPress={() => setJoinOpen(true)}
            disabled={!hasToken}
          />
        </View>

        <View style={styles.footer}>
          <DebugLink onPress={onOpenDebug} />
        </View>
      </View>

      <Modal visible={joinOpen} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeJoin}>
            <Pressable
              style={styles.modalSheet}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>Join</Text>
              <TextInput
                style={styles.codeInput}
                placeholder="Meeting code"
                placeholderTextColor={colors.textSecondary}
                value={code}
                onChangeText={(value) => {
                  setCode(value);
                  setJoinError(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={submitCode}
              />
              {joinError ? (
                <Text style={styles.joinError}>{joinError}</Text>
              ) : null}
              <Button variant="primary" label="Continue" onPress={submitCode} />
              <Button label="Cancel" variant="ghost" onPress={closeJoin} />
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  body: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: space.xxl,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  logoLetter: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textOnAccent,
  },
  title: {
    ...type.title,
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    gap: space.md,
  },
  footer: {
    alignItems: 'center',
    marginTop: space.xl,
  },
  modalAvoid: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  modalTitle: {
    ...type.headline,
    color: colors.text,
    fontSize: 20,
  },
  codeInput: {
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: 16,
    backgroundColor: colors.canvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 4,
    textAlign: 'center',
  },
  joinError: {
    ...type.callout,
    color: colors.errorText,
    textAlign: 'center',
  },
});
