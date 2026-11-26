/**
 * Answer feedback state machine, shared by every place a child answers a question.
 *
 *   idle --answer()--> locked --narration done--> showing --countdown 0--> done
 *                        |                          |  ^
 *                        |                 pause()  v  | resume()
 *                        +-------- pause() -----> paused
 *
 * - The first answer locks the question; later answers are ignored.
 * - "locked" lasts while the feedback narration plays. The countdown only starts after it.
 * - "Next" becomes available `minNextMs` after the answer, and ends feedback early.
 * - pause() (app in the background) freezes everything; resume() continues where it stopped.
 * - onDone fires exactly once.
 *
 * Pure TypeScript with injected timers so it can be tested with fake timers.
 */

export type FeedbackPhase = 'idle' | 'locked' | 'showing' | 'paused' | 'done';

export interface FeedbackSnapshot {
  phase: FeedbackPhase;
  /** Countdown time left. Equals the full duration until the countdown starts. */
  remainingMs: number;
  durationMs: number;
  nextAvailable: boolean;
}

export interface FeedbackClock {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

export interface FeedbackOptions {
  durationMs: number;
  /** When the Next button may be used, measured from the answer. */
  minNextMs?: number;
  /** How often snapshots are emitted while the countdown runs. */
  tickMs?: number;
  clock?: FeedbackClock;
  onChange?: (snapshot: FeedbackSnapshot) => void;
  onDone: (reason: 'timeout' | 'next') => void;
}

export const FEEDBACK_SECONDS_OPTIONS = [3, 5, 8] as const;
export const DEFAULT_FEEDBACK_SECONDS = 5;
export const MIN_NEXT_MS = 1500;

const realClock: FeedbackClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export interface FeedbackMachine {
  /** Locks the question. `narration` resolves when the feedback voice has finished. */
  answer: (narration?: Promise<unknown>) => boolean;
  next: () => boolean;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
  snapshot: () => FeedbackSnapshot;
}

export function createFeedbackMachine(options: FeedbackOptions): FeedbackMachine {
  const clock = options.clock ?? realClock;
  const minNextMs = options.minNextMs ?? MIN_NEXT_MS;
  const tickMs = options.tickMs ?? 100;
  const durationMs = Math.max(0, options.durationMs);

  let phase: FeedbackPhase = 'idle';
  let remainingMs = durationMs;
  let nextAvailable = false;
  let narrationDone = false;
  /** Time still to wait before Next unlocks; frozen while paused. */
  let nextWaitMs = minNextMs;
  /** When the current countdown segment started. */
  let segmentStart = 0;
  /** When the current wait for Next started. */
  let nextStart = 0;
  let pausedFrom: 'locked' | 'showing' | null = null;
  let tickHandle: unknown = null;
  let nextHandle: unknown = null;
  let disposed = false;

  const snapshot = (): FeedbackSnapshot => ({ phase, remainingMs, durationMs, nextAvailable });
  const emit = () => options.onChange?.(snapshot());
  const clear = () => {
    if (tickHandle !== null) clock.clearTimeout(tickHandle);
    if (nextHandle !== null) clock.clearTimeout(nextHandle);
    tickHandle = null;
    nextHandle = null;
  };

  const finish = (reason: 'timeout' | 'next') => {
    if (phase === 'done' || disposed) return;
    clear();
    phase = 'done';
    remainingMs = reason === 'timeout' ? 0 : remainingMs;
    emit();
    options.onDone(reason);
  };

  const armNext = () => {
    if (nextAvailable) return;
    nextStart = clock.now();
    nextHandle = clock.setTimeout(() => {
      nextHandle = null;
      nextWaitMs = 0;
      nextAvailable = true;
      emit();
    }, nextWaitMs);
  };

  const tick = () => {
    tickHandle = null;
    const elapsed = clock.now() - segmentStart;
    segmentStart = clock.now();
    remainingMs = Math.max(0, remainingMs - elapsed);
    if (remainingMs <= 0) return finish('timeout');
    emit();
    tickHandle = clock.setTimeout(tick, Math.min(tickMs, remainingMs));
  };

  const startCountdown = () => {
    phase = 'showing';
    segmentStart = clock.now();
    emit();
    if (remainingMs <= 0) return finish('timeout');
    tickHandle = clock.setTimeout(tick, Math.min(tickMs, remainingMs));
  };

  return {
    snapshot,
    answer(narration) {
      if (phase !== 'idle' || disposed) return false;
      phase = 'locked';
      emit();
      armNext();
      const onNarrationDone = () => {
        if (narrationDone || disposed || phase === 'done') return;
        narrationDone = true;
        if (phase === 'paused') {
          pausedFrom = 'showing';
          return;
        }
        startCountdown();
      };
      if (narration) narration.then(onNarrationDone, onNarrationDone);
      else onNarrationDone();
      return true;
    },
    next() {
      if (!nextAvailable || phase === 'done' || phase === 'idle' || disposed) return false;
      finish('next');
      return true;
    },
    pause() {
      if ((phase !== 'locked' && phase !== 'showing') || disposed) return;
      const elapsed = clock.now() - segmentStart;
      if (phase === 'showing') remainingMs = Math.max(0, remainingMs - elapsed);
      if (!nextAvailable) nextWaitMs = Math.max(0, nextWaitMs - (clock.now() - nextStart));
      clear();
      pausedFrom = phase;
      phase = 'paused';
      emit();
    },
    resume() {
      if (phase !== 'paused' || disposed) return;
      const from = pausedFrom;
      pausedFrom = null;
      if (!nextAvailable) armNext();
      if (from === 'showing') startCountdown();
      else {
        phase = 'locked';
        emit();
      }
    },
    dispose() {
      disposed = true;
      clear();
    },
  };
}
