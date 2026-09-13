import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useParticipants, useStage } from 'amazon-ivs-react-native-sdk';
import type { LogEntry } from '../hooks/useEventLog';
import { colors, radius, space, type } from '../theme';

type Tab = 'state' | 'logs';

export function DebugSheet({
  visible,
  onClose,
  entries,
  onClearLog,
}: {
  visible: boolean;
  onClose: () => void;
  entries: LogEntry[];
  onClearLog: () => void;
}) {
  const [tab, setTab] = useState<Tab>('state');
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
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
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
                style={[styles.tabLabel, tab === 'state' && styles.tabLabelOn]}
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
          ) : (
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
          )}
        </Pressable>
      </Pressable>
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
