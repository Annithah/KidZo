import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  enumerateBranchingPaths,
  localize,
  VIDEO_ANSWER_TIMEOUT_SECONDS,
  type BranchingBody,
  type BranchingPathPlan,
  type StoryChoice,
} from '@kidzo/shared';
import { Art } from './Art';

function pathKey(choices: BranchingPathPlan['choices']): string {
  return choices.map(({ nodeId, choiceId }) => `${nodeId}:${choiceId}`).join('|');
}

export function BranchingPreview({ body }: { body: BranchingBody }) {
  const [open, setOpen] = useState(false);
  const [nodeId, setNodeId] = useState(body.startNodeId);
  const [visit, setVisit] = useState(0);
  const [path, setPath] = useState<string[]>([body.startNodeId]);
  const [visibleQuestionVisitKey, setVisibleQuestionVisitKey] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(VIDEO_ANSWER_TIMEOUT_SECONDS);
  const [durationWarning, setDurationWarning] = useState<string | null>(null);
  const [testedChoices, setTestedChoices] = useState<Set<string>>(() => new Set());
  const [routeChoices, setRouteChoices] = useState<BranchingPathPlan['choices']>([]);
  const [testedPaths, setTestedPaths] = useState<Set<string>>(() => new Set());
  const answered = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nodes = useMemo(() => new Map(body.nodes.map((node) => [node.id, node])), [body.nodes]);
  const routePlans = useMemo(() => enumerateBranchingPaths(body), [body]);
  const node = nodes.get(nodeId);
  const visitKey = `${nodeId}:${visit}`;
  const choices = body.nodes.flatMap((storyNode) =>
    storyNode.choices.map((choice) => ({ nodeId: storyNode.id, choice })),
  );
  const questionVisible = !!node?.videoQuestion && visibleQuestionVisitKey === visitKey;

  useEffect(() => {
    setTestedChoices(new Set());
    setTestedPaths(new Set());
    setNodeId(body.startNodeId);
    setPath([body.startNodeId]);
    setRouteChoices([]);
    setVisit((previous) => previous + 1);
    setVisibleQuestionVisitKey(null);
  }, [body]);

  useEffect(() => {
    if (!node?.videoQuestion || node.scene.videoUrl) return;
    setVisibleQuestionVisitKey(visitKey);
  }, [node?.scene.videoUrl, node?.videoQuestion, visitKey]);

  const choose = useCallback((choice: StoryChoice) => {
    if (!node || answered.current) return;
    answered.current = true;
    setTestedChoices((previous) => new Set(previous).add(`${node.id}:${choice.id}`));
    setRouteChoices((previous) => [...previous, { nodeId: node.id, choiceId: choice.id }]);
    setPath((previous) => [...previous, choice.next]);
    setNodeId(choice.next);
    setVisit((previous) => previous + 1);
    setVisibleQuestionVisitKey(null);
  }, [node]);

  useEffect(() => {
    answered.current = false;
    setDurationWarning(null);
  }, [visitKey]);

  useEffect(() => {
    if (!node?.ending) return;
    const finishedPath = pathKey(routeChoices);
    if (routePlans.paths.some((plan) => pathKey(plan.choices) === finishedPath)) {
      setTestedPaths((previous) => new Set(previous).add(finishedPath));
    }
  }, [node?.ending, routeChoices, routePlans]);

  useEffect(() => {
    if (!node?.videoQuestion || !questionVisible) return;
    const defaultChoice = node.choices.find((choice) => choice.id === node.videoQuestion?.defaultChoiceId);
    if (!defaultChoice) return;
    const durationMs = VIDEO_ANSWER_TIMEOUT_SECONDS * 1000;
    const deadline = Date.now() + durationMs;
    setSecondsRemaining(VIDEO_ANSWER_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 100);
    const timeout = setTimeout(() => choose(defaultChoice), durationMs);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [choose, node, questionVisible]);

  const restart = () => {
    answered.current = false;
    setNodeId(body.startNodeId);
    setVisit((previous) => previous + 1);
    setPath([body.startNodeId]);
    setRouteChoices([]);
    setVisibleQuestionVisitKey(null);
  };

  if (!node) return <div className="alert error">Preview cannot find scene “{nodeId}”.</div>;

  const revealQuestion = () => {
    if (!node.videoQuestion || questionVisible) return;
    videoRef.current?.pause();
    setVisibleQuestionVisitKey(visitKey);
  };
  const selectQuestion = (nextNodeId: string) => {
    answered.current = false;
    setNodeId(nextNodeId);
    setVisit((previous) => previous + 1);
    setPath([nextNodeId]);
    setRouteChoices([]);
    setVisibleQuestionVisitKey(null);
  };
  const advance = (next: string) => {
    setPath((previous) => [...previous, next]);
    setNodeId(next);
    setVisit((previous) => previous + 1);
  };

  return (
    <section className="scene stack" aria-label="Interactive video preview and path tester">
      <div className="row">
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>Preview and test answer paths</h3>
          <p className="muted small">
            Test each answer branch ({testedChoices.size}/{choices.length} choices tested).
          </p>
        </div>
        <button type="button" className="btn secondary small" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close preview' : 'Open preview'}
        </button>
      </div>
      {open ? (
        <div className="stack">
          <div className="row">
            <button type="button" className="btn ghost small" onClick={restart}>Restart from beginning</button>
            <label className="muted small">
              Jump to a question to test another branch{' '}
              <select
                className="input"
                value=""
                aria-label="Jump to a scene with choices"
                onChange={(event) => selectQuestion(event.target.value)}
              >
                <option value="">Choose a scene</option>
                {body.nodes.filter((item) => item.choices.length > 0).map((item) => (
                  <option key={item.id} value={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <span className="muted small">Path: {path.join(' → ')}</span>
          </div>
          <div className="muted small">
            Complete routes tested: {testedPaths.size}/{routePlans.paths.length}
          </div>
          {choices.length > 0 && testedChoices.size === choices.length ? (
            <div className="alert success">Every answer branch has been tested.</div>
          ) : null}
          <details className="stack">
            <summary>Show possible ending routes ({routePlans.paths.length})</summary>
            <ol>
              {routePlans.paths.map((plan) => {
                const signature = pathKey(plan.choices);
                const route = plan.choices.map(({ nodeId: sourceId, choiceId }) => {
                  const source = nodes.get(sourceId);
                  const selected = source?.choices.find((choice) => choice.id === choiceId);
                  return `${sourceId}: ${selected ? localize(selected.label, 'en') : choiceId}`;
                });
                const endingId = plan.scenes[plan.scenes.length - 1] ?? 'unknown';
                return (
                  <li key={signature || endingId}>
                    {route.length > 0 ? route.join(' → ') : 'No choices'} → {endingId}
                    {testedPaths.has(signature) ? ' · Tested' : ' · Not tested'}
                  </li>
                );
              })}
            </ol>
            {routePlans.cycles > 0 ? (
              <div className="alert info">The graph contains {routePlans.cycles} loop route(s); use the scene jump control to test those manually.</div>
            ) : null}
            {routePlans.truncated ? (
              <div className="alert info">Route listing reached its safety limit. Test the remaining branches with the scene jump control.</div>
            ) : null}
          </details>
          {durationWarning ? <div className="alert error">{durationWarning}</div> : null}
          <div style={{ position: 'relative', width: '100%', maxWidth: 720, aspectRatio: '16 / 9', alignSelf: 'center', overflow: 'hidden', borderRadius: 16, background: node.scene.color, display: 'grid', placeItems: 'center' }}>
            {node.scene.videoUrl ? (
              <video
                key={visitKey}
                ref={videoRef}
                src={node.scene.videoUrl}
                controls
                playsInline
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (node.videoQuestion && Number.isFinite(duration) && node.videoQuestion.timestampSeconds >= duration) {
                    setDurationWarning(`Question timestamp (${node.videoQuestion.timestampSeconds}s) must be before the clip ends (${duration.toFixed(1)}s).`);
                  }
                }}
                onTimeUpdate={(event) => {
                  if (node.videoQuestion && event.currentTarget.currentTime >= node.videoQuestion.timestampSeconds) {
                    revealQuestion();
                  }
                }}
                onEnded={revealQuestion}
                onError={revealQuestion}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <Art art={node.scene.art} size={120} />
            )}
            {node.videoQuestion && questionVisible ? (
              <div style={{ position: 'absolute', inset: 12, padding: 16, borderRadius: 14, background: 'rgba(20, 35, 58, 0.92)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, overflowY: 'auto' }}>
                <strong style={{ textAlign: 'center', fontSize: 20 }}>{localize(node.text, 'en')}</strong>
                <span aria-live="polite" style={{ textAlign: 'center' }}>
                  Default answer in {secondsRemaining}…
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: node.choices.length > 2 ? '1fr 1fr' : '1fr', gap: 6 }}>
                  {node.choices.map((choice) => (
                    <button key={choice.id} type="button" className="btn sky small" onClick={() => choose(choice)}>
                      <Art art={choice.art} size={22} /> {localize(choice.label, 'en')}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {node.choices.length > 0 && !node.videoQuestion ? (
            <div className="row">
              {node.choices.map((choice) => (
                <button key={choice.id} type="button" className="btn sky small" onClick={() => choose(choice)}>
                  <Art art={choice.art} size={22} /> {localize(choice.label, 'en')}
                </button>
              ))}
            </div>
          ) : null}
          {node.next ? (
            <button type="button" className="btn sky small" style={{ alignSelf: 'flex-start' }} onClick={() => {
              if (node.next) advance(node.next);
            }}>
              Continue to {node.next}
            </button>
          ) : null}
          {node.ending ? <div className="alert success">Ending reached. Restart or jump to another question to test more branches.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
