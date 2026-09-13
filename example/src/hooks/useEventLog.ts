import { useCallback, useState } from 'react';
import {
  useStageEvent,
  type IVSError,
  type IVSParticipantInfo,
  type IVSStageStreamInfo,
  type StageConnectionState,
} from 'amazon-ivs-react-native-sdk';

export type LogEntry = {
  id: number;
  event: string;
  detail: string;
};

let nextId = 0;

function streamLine(streams: IVSStageStreamInfo[]) {
  if (streams.length === 0) {
    return 'no streams';
  }
  return streams
    .map((stream) => `${stream.mediaType}${stream.isMuted ? ' muted' : ''}`)
    .join(', ');
}

function participantLine(participant: IVSParticipantInfo) {
  const name = participant.isLocal
    ? 'you'
    : participant.userId || participant.participantId.slice(0, 8);
  return `${name} · ${streamLine(participant.streams)}`;
}

export function useEventLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const push = useCallback((event: string, detail: string) => {
    setEntries((prev) => {
      const next = [...prev, { id: ++nextId, event, detail }];
      return next.length > 80 ? next.slice(-80) : next;
    });
  }, []);

  const onConnection = useCallback(
    (payload: { state: StageConnectionState; error?: IVSError }) => {
      push(
        'connectionStateChanged',
        payload.error
          ? `${payload.state} · ${payload.error.message}`
          : payload.state
      );
    },
    [push]
  );
  const onJoined = useCallback(
    (participant: IVSParticipantInfo) => {
      push('participantJoined', participantLine(participant));
    },
    [push]
  );
  const onUpdated = useCallback(
    (participant: IVSParticipantInfo) => {
      push('participantUpdated', participantLine(participant));
    },
    [push]
  );
  const onLeft = useCallback(
    (payload: { participantId: string }) => {
      push('participantLeft', payload.participantId);
    },
    [push]
  );
  const onStreams = useCallback(
    (payload: { participantId: string; streams: IVSStageStreamInfo[] }) => {
      push(
        'streamsChanged',
        `${payload.participantId.slice(0, 8)} · ${streamLine(payload.streams)}`
      );
    },
    [push]
  );
  const onError = useCallback(
    (error: IVSError) => {
      push('error', `${error.code}: ${error.message}`);
    },
    [push]
  );

  useStageEvent('connectionStateChanged', onConnection);
  useStageEvent('participantJoined', onJoined);
  useStageEvent('participantUpdated', onUpdated);
  useStageEvent('participantLeft', onLeft);
  useStageEvent('streamsChanged', onStreams);
  useStageEvent('error', onError);

  return {
    entries,
    clear: useCallback(() => setEntries([]), []),
  };
}
