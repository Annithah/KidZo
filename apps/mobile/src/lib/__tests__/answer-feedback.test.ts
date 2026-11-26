import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeedbackMachine, DEFAULT_FEEDBACK_SECONDS, FEEDBACK_SECONDS_OPTIONS, type FeedbackSnapshot } from '../answer-feedback';

const clock = {
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

function setup(durationMs = 5000) {
  const onDone = vi.fn();
  const states: FeedbackSnapshot[] = [];
  const m = createFeedbackMachine({ durationMs, clock, onDone, onChange: (s) => states.push(s) });
  return { m, onDone, states };
}

/** A narration promise the test resolves by hand. */
function narration() {
  let done!: () => void;
  const promise = new Promise<void>((r) => (done = r));
  return { promise, done };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-25T10:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('answer feedback', () => {
  it('locks after the first answer and ignores a second one', () => {
    const { m } = setup();
    expect(m.answer()).toBe(true);
    expect(m.answer()).toBe(false);
    expect(m.snapshot().phase).toBe('showing');
  });

  it('does not move on before the countdown ends', () => {
    const { m, onDone } = setup();
    m.answer();
    vi.advanceTimersByTime(4900);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('timeout');
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('defaults to 5 seconds and offers 3, 5 and 8', () => {
    expect(DEFAULT_FEEDBACK_SECONDS).toBe(5);
    expect([...FEEDBACK_SECONDS_OPTIONS]).toEqual([3, 5, 8]);
    for (const seconds of FEEDBACK_SECONDS_OPTIONS) {
      const { m, onDone } = setup(seconds * 1000);
      m.answer();
      vi.advanceTimersByTime(seconds * 1000 - 1);
      expect(onDone).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onDone).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps Next unavailable for the first 1.5 seconds, then lets the child move on early', () => {
    const { m, onDone } = setup();
    m.answer();
    vi.advanceTimersByTime(1499);
    expect(m.snapshot().nextAvailable).toBe(false);
    expect(m.next()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(m.snapshot().nextAvailable).toBe(true);
    expect(m.next()).toBe(true);
    expect(onDone).toHaveBeenCalledWith('next');
    expect(m.next()).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('waits for the narration to finish before counting down', async () => {
    const { m, onDone } = setup();
    const voice = narration();
    m.answer(voice.promise);
    vi.advanceTimersByTime(9000);
    expect(m.snapshot().phase).toBe('locked');
    expect(m.snapshot().remainingMs).toBe(5000);
    expect(onDone).not.toHaveBeenCalled();
    voice.done();
    await vi.advanceTimersByTimeAsync(0);
    expect(m.snapshot().phase).toBe('showing');
    vi.advanceTimersByTime(4999);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('pauses in the background and resumes where it stopped', () => {
    const { m, onDone } = setup();
    m.answer();
    vi.advanceTimersByTime(2000);
    m.pause();
    expect(m.snapshot().phase).toBe('paused');
    vi.advanceTimersByTime(60_000);
    expect(onDone).not.toHaveBeenCalled();
    m.resume();
    expect(m.snapshot().phase).toBe('showing');
    vi.advanceTimersByTime(2999);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('freezes the Next delay while paused', () => {
    const { m } = setup();
    m.answer();
    vi.advanceTimersByTime(1000);
    m.pause();
    vi.advanceTimersByTime(5000);
    expect(m.snapshot().nextAvailable).toBe(false);
    m.resume();
    vi.advanceTimersByTime(499);
    expect(m.snapshot().nextAvailable).toBe(false);
    vi.advanceTimersByTime(1);
    expect(m.snapshot().nextAvailable).toBe(true);
  });

  it('starts the countdown after a resume when narration ended in the background', async () => {
    const { m, onDone } = setup(3000);
    const voice = narration();
    m.answer(voice.promise);
    m.pause();
    voice.done();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onDone).not.toHaveBeenCalled();
    m.resume();
    vi.advanceTimersByTime(3000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('counts down in visible steps and stops all timers when disposed', () => {
    const { m, onDone, states } = setup();
    m.answer();
    vi.advanceTimersByTime(1000);
    expect(m.snapshot().remainingMs).toBe(4000);
    expect(states.some((s) => s.remainingMs === 4500)).toBe(true);
    m.dispose();
    vi.advanceTimersByTime(10_000);
    expect(onDone).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
