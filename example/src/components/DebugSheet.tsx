import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useParticipants, useStage } from 'amazon-ivs-react-native-sdk';
import type { LogEntry } from '../hooks/useEventLog';
import { colors, radius, space, type } from '../theme';

type Tab = 'state' | 'logs' | 'token';

function tokenExpiry(token: string): Date | null {
  try {
    // Hermes has atob; RN's types don't declare it.
    const { atob } = globalThis as { atob?: (data: string) => string };
    const payload = token.split('.')[1];
    if (!payload || !atob) {
      return null;
    }
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const exp = JSON.parse(atob(padded)).exp;
    return typeof exp === 'number' ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

export function DebugSheet({
  visible,
  onClose,
  entries,
  onClearLog,
  pastedToken,
  onPasteToken,
  hasBuiltInToken,
}: {
  visible: boolean;
  onClose: () => void;
  entries: LogEntry[];
  onClearLog: () => void;
  pastedToken: string;
  onPasteToken: (token: string) => void;
  hasBuiltInToken: boolean;
}) {
  const [tab, setTab] = useState<Tab>('state');
  const [draft, setDraft] = useState('');
  const [snapshot, setSnapshot] = useState('Loading…');
  const { stage, connectionState } = useStage();
  const participants = useParticipants();

  const loadState = useCallback(async () => {
    try {
      const native = await stage.readState();
      setSnapshot(
        JSON.stringify(
          {
            connectionState,
            people: participants.length,
            native,
          },
          null,
          2
        )
      );
    } catch (e) {
      setSnapshot(e instanceof Error ? e.message : String(e));
    }
  }, [connectionState, participants.length, stage]);

  useEffect(() => {
    if (visible && tab === 'state') {
      loadState().catch(console.error);
    }
  }, [visible, tab, loadState]);

  useEffect(() => {
    if (visible) {
      setTab('state');
      setDraft('');
    }
  }, [visible]);

  const cleanDraft = draft.replace(/\s/g, '');
  const draftLooksValid = cleanDraft.split('.').length === 3;
  const pastedExpiry = pastedToken ? tokenExpiry(pastedToken) : null;
  let tokenSource = 'No token. Paste one to join.';
  if (pastedToken) {
    tokenSource = pastedExpiry
      ? `Using the pasted token, expires ${pastedExpiry.toLocaleString()}.`
      : 'Using the pasted token.';
  } else if (hasBuiltInToken) {
    tokenSource = 'Using the token from stage.config.ts.';
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.avoid} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Debug</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.link}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.tabs}>
              <Pressable
                onPress={() => setTab('state')}
                style={[styles.tab, tab === 'state' && styles.tabOn]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    tab === 'state' && styles.tabLabelOn,
                  ]}
                >
                  State
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('logs')}
                style={[styles.tab, tab === 'logs' && styles.tabOn]}
              >
                <Text
                  style={[styles.tabLabel, tab === 'logs' && styles.tabLabelOn]}
                >
                  Logs
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab('token')}
                style={[styles.tab, tab === 'token' && styles.tabOn]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    tab === 'token' && styles.tabLabelOn,
                  ]}
                >
                  Token
                </Text>
              </Pressable>
            </View>

            {tab === 'state' ? (
              <ScrollView style={styles.body}>
                <Pressable onPress={loadState} style={styles.refresh}>
                  <Text style={styles.link}>Refresh</Text>
                </Pressable>
                <Text selectable style={styles.mono}>
                  {snapshot}
                </Text>
              </ScrollView>
            ) : null}

            {tab === 'token' ? (
              <View style={styles.tokenBody}>
                <Text style={styles.muted}>{tokenSource}</Text>
                <TextInput
                  style={styles.tokenInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Paste a participant token"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  multiline
                />
                {draft.length > 0 && !draftLooksValid ? (
                  <Text style={styles.tokenError}>
                    That does not look like a participant token.
                  </Text>
                ) : null}
                <View style={styles.tokenActions}>
                  {pastedToken ? (
                    <Pressable onPress={() => onPasteToken('')} hitSlop={8}>
                      <Text style={styles.link}>Clear pasted token</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Pressable
                    onPress={() => {
                      onPasteToken(cleanDraft);
                      setDraft('');
                    }}
                    disabled={!draftLooksValid}
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.link, !draftLooksValid && styles.linkOff]}
                    >
                      Use token
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {tab === 'logs' ? (
              <ScrollView style={styles.body}>
                <Pressable onPress={onClearLog} style={styles.refresh}>
                  <Text style={styles.link}>Clear</Text>
                </Pressable>
                {entries.length === 0 ? (
                  <Text style={styles.muted}>No logs yet</Text>
                ) : (
                  entries
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <View key={entry.id} style={styles.logRow}>
                        <Text style={styles.logEvent}>{entry.event}</Text>
                        <Text style={styles.logDetail}>{entry.detail}</Text>
                      </View>
                    ))
                )}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DebugLink({
  onPress,
  light,
}: {
  onPress: () => void;
  light?: boolean;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button">
      <Text style={[styles.debugLink, light && styles.debugLinkLight]}>
        Debug
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avoid: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: {
    ...type.headline,
    color: colors.text,
    fontSize: 20,
  },
  link: {
    color: colors.accent,
    fontWeight: '600',
  },
  linkOff: {
    color: colors.textSecondary,
  },
  tokenBody: {
    gap: space.md,
  },
  tokenInput: {
    minHeight: 96,
    maxHeight: 160,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: colors.canvas,
    color: colors.text,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  tokenError: {
    ...type.caption,
    color: colors.danger,
  },
  tokenActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: space.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  tabOn: {
    backgroundColor: colors.card,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelOn: {
    color: colors.text,
  },
  body: {
    maxHeight: 420,
  },
  refresh: {
    alignSelf: 'flex-end',
    marginBottom: space.sm,
  },
  mono: {
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 16,
    color: colors.text,
  },
  muted: {
    ...type.callout,
    color: colors.textSecondary,
  },
  logRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  logEvent: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  logDetail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  debugLink: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  debugLinkLight: {
    color: 'rgba(255,255,255,0.72)',
  },
});
