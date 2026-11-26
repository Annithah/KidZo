import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { createFeedbackMachine, MIN_NEXT_MS, type FeedbackMachine, type FeedbackSnapshot } from './answer-feedback';

/**
 * React wrapper around the answer feedback state machine. Pauses while the app is in the
 * background, cleans up on unmount, and calls `onDone` once per answer.
 * Call `reset()` before the next question to start a fresh machine.
 */
export function useAnswerFeedback({ durationMs, onDone }: { durationMs: number; onDone: (reason: 'timeout' | 'next') => void }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);
  const machine = useRef<FeedbackMachine | null>(null);
  const [snapshot, setSnapshot] = useState<FeedbackSnapshot>({ phase: 'idle', remainingMs: durationMs, durationMs, nextAvailable: false });

  const build = useCallback(() => {
    machine.current?.dispose();
    machine.current = createFeedbackMachine({
      durationMs,
      minNextMs: MIN_NEXT_MS,
      onChange: setSnapshot,
      onDone: (reason) => onDoneRef.current(reason),
    });
    setSnapshot(machine.current.snapshot());
  }, [durationMs]);

  useEffect(() => {
    build();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') machine.current?.resume();
      else machine.current?.pause();
    });
    return () => {
      sub.remove();
      machine.current?.dispose();
      machine.current = null;
    };
  }, [build]);

  return {
    snapshot,
    locked: snapshot.phase !== 'idle',
    answer: useCallback((narration?: Promise<unknown>) => machine.current?.answer(narration) ?? false, []),
    next: useCallback(() => machine.current?.next() ?? false, []),
    reset: build,
  };
}
