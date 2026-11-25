import { useState } from 'react';
import { VIDEO_ANSWER_TIMEOUT_SECONDS, type BranchingBody, type QuizBody, type SongBody, type StoryNode } from '@kidzo/shared';
import { api, describeError } from '../api';
import { nextId, removeNode } from '../content-model';
import { Field, LocalizedInput } from './ui';

type Mode = 'choices' | 'next' | 'ending';
const modeOf = (n: StoryNode): Mode => (n.ending ? 'ending' : n.choices.length > 0 ? 'choices' : 'next');

export function BranchingEditor({ body, onChange }: { body: BranchingBody; onChange: (b: BranchingBody) => void }) {
  const ids = body.nodes.map((n) => n.id);
  const setNode = (id: string, patch: Partial<StoryNode>) =>
    onChange({ ...body, nodes: body.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const setChoices = (id: string, choices: StoryNode['choices']) => {
    const node = body.nodes.find((n) => n.id === id);
    if (!node) return;
    const defaultChoiceId = node.videoQuestion?.defaultChoiceId;
    const nextDefault = choices.some((choice) => choice.id === defaultChoiceId)
      ? defaultChoiceId
      : choices[0]?.id;
    setNode(id, {
      choices,
      videoQuestion: node.videoQuestion && nextDefault
        ? { ...node.videoQuestion, defaultChoiceId: nextDefault }
        : undefined,
    });
  };

  const setMode = (node: StoryNode, mode: Mode) => {
    const other = ids.find((i) => i !== node.id) ?? node.id;
    if (mode === 'ending') setNode(node.id, { ending: true, next: null, choices: [], familyTurn: false, videoQuestion: undefined });
    if (mode === 'next') setNode(node.id, { ending: false, next: node.next ?? other, choices: [], videoQuestion: undefined });
    if (mode === 'choices') {
      setNode(node.id, {
        ending: false,
        next: null,
        choices: node.choices.length ? node.choices : [{ id: 'choice-1', label: { en: '' }, emoji: '✨', next: other }],
      });
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <Field label="Start scene">
          <select className="input" value={body.startNodeId} onChange={(e) => onChange({ ...body, startNodeId: e.target.value })}>
            {ids.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="btn sky small"
          style={{ alignSelf: 'flex-end' }}
          disabled={body.nodes.length >= 200}
          onClick={() => onChange({ ...body, nodes: [...body.nodes, { id: nextId(ids, 'scene'), text: { en: '' }, scene: { emoji: '🌟', color: '#5BC0F8', videoUrl: null }, familyTurn: false, choices: [], next: null, ending: true }] })}
        >
          + Add scene
        </button>
      </div>

      {body.nodes.map((node) => {
        const mode = modeOf(node);
        return (
          <section key={node.id} className="scene stack" aria-label={`Scene ${node.id}`}>
            <div className="scene-head">
              <span className="cover" style={{ background: node.scene.color }}>
                {node.scene.emoji}
              </span>
              <h3 style={{ flex: 1 }}>
                {node.id}
                {node.id === body.startNodeId ? ' · start' : ''}
              </h3>
              <button type="button" className="btn small danger" disabled={body.nodes.length <= 1} onClick={() => onChange(removeNode(body, node.id))}>
                Remove
              </button>
            </div>
            <div className="row">
              <Field label="Scene emoji">
                <input className="input" style={{ width: 100 }} value={node.scene.emoji} onChange={(e) => setNode(node.id, { scene: { ...node.scene, emoji: e.target.value } })} />
              </Field>
              <Field label="Scene color">
                <input className="input" type="color" style={{ width: 90, height: 44, padding: 4 }} value={node.scene.color} onChange={(e) => setNode(node.id, { scene: { ...node.scene, color: e.target.value.toUpperCase() } })} />
              </Field>
              <Field label="After this scene">
                <select className="input" value={mode} onChange={(e) => setMode(node, e.target.value as Mode)}>
                  <option value="next">Continue to a scene</option>
                  <option value="choices">Offer choices</option>
                  <option value="ending">The end</option>
                </select>
              </Field>
              {mode === 'next' ? (
                <Field label="Next scene">
                  <select className="input" value={node.next ?? ''} onChange={(e) => setNode(node.id, { next: e.target.value })}>
                    {ids.filter((i) => i !== node.id).map((id) => (
                      <option key={id}>{id}</option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {mode === 'choices' ? (
                <label className="checkbox">
                  <input type="checkbox" checked={node.familyTurn} onChange={(e) => setNode(node.id, { familyTurn: e.target.checked })} />
                  Parent&apos;s turn in Family Mode
                </label>
              ) : null}
            </div>
            <LocalizedInput
              label={node.videoQuestion ? 'Question prompt' : 'Story text'}
              multiline
              value={node.text}
              onChange={(text) => setNode(node.id, { text })}
            />
            <SceneVideoField
              videoUrl={node.scene.videoUrl}
              onChange={(videoUrl) => setNode(node.id, { scene: { ...node.scene, videoUrl } })}
            />
            {mode === 'choices' ? (
              <div className="stack">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={!!node.videoQuestion}
                    onChange={(e) => setNode(node.id, {
                      videoQuestion: e.target.checked
                        ? { timestampSeconds: 7, defaultChoiceId: node.choices[0]?.id ?? '' }
                        : undefined,
                    })}
                  />
                  Pause this video for a timed question
                </label>
                {node.videoQuestion ? (
                  <>
                    <div className="row">
                      <Field label="Ask at (seconds)" hint="Time from the start of this clip">
                        <input
                          className="input"
                          type="number"
                          min={0}
                          max={7200}
                          step={0.1}
                          value={node.videoQuestion.timestampSeconds}
                          onChange={(e) => setNode(node.id, {
                            videoQuestion: { ...node.videoQuestion!, timestampSeconds: Number(e.target.value) },
                          })}
                        />
                      </Field>
                      <Field label="No-answer timeout">
                        <input className="input" type="text" readOnly value={`${VIDEO_ANSWER_TIMEOUT_SECONDS} seconds`} />
                      </Field>
                    </div>
                    <p className="muted small">
                      The video pauses at this time. If no answer is chosen, the selected default is used after {VIDEO_ANSWER_TIMEOUT_SECONDS} seconds.
                    </p>
                    <p className="muted small">
                      Each answer destination needs its own video scene before this experience can be published.
                    </p>
                    {!node.scene.videoUrl ? (
                      <div className="alert info">Upload a video for this scene before publishing its timed question.</div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {mode === 'choices'
              ? node.choices.map((choice, ci) => (
                  <div key={choice.id} className="choice stack">
                    <div className="row">
                      <strong style={{ flex: 1 }}>Choice {ci + 1}</strong>
                      {node.videoQuestion ? (
                        <label className="checkbox">
                          <input
                            type="radio"
                            name={`default-${node.id}`}
                            checked={node.videoQuestion.defaultChoiceId === choice.id}
                            onChange={() => setNode(node.id, {
                              videoQuestion: { ...node.videoQuestion!, defaultChoiceId: choice.id },
                            })}
                          />
                          Default if unanswered
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="btn small ghost"
                        disabled={node.choices.length <= 1}
                        onClick={() => setChoices(node.id, node.choices.filter((c) => c.id !== choice.id))}
                      >
                        Remove choice
                      </button>
                    </div>
                    <div className="row">
                      <Field label="Emoji">
                        <input
                          className="input"
                          style={{ width: 90 }}
                          value={choice.emoji}
                          onChange={(e) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, emoji: e.target.value } : c)))}
                        />
                      </Field>
                      <Field label="Goes to">
                        <select
                          className="input"
                          value={choice.next}
                          onChange={(e) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, next: e.target.value } : c)))}
                        >
                          {ids.filter((i) => i !== node.id).map((id) => (
                            <option key={id}>{id}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <LocalizedInput
                      label="Choice label"
                      value={choice.label}
                      onChange={(label) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, label } : c)))}
                    />
                  </div>
                ))
              : null}
            {mode === 'choices' && node.choices.length < 4 ? (
              <button
                type="button"
                className="btn small secondary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() =>
                  setChoices(node.id, [
                    ...node.choices,
                    { id: nextId(node.choices.map((c) => c.id), 'choice'), label: { en: '' }, emoji: '✨', next: ids.find((i) => i !== node.id) ?? node.id },
                  ])
                }
              >
                + Add choice
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function SceneVideoField({ videoUrl, onChange }: { videoUrl: string | null; onChange: (url: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <Field label="Scene video URL" hint="MP4 video clip, up to 100 MB. Optional; the emoji scene remains as a fallback.">
        <input className="input" type="url" value={videoUrl ?? ''} onChange={(e) => onChange(e.target.value.trim() || null)} />
      </Field>
      <label className="btn small secondary" style={{ cursor: 'pointer', alignSelf: 'flex-start' }}>
        {uploading ? 'Uploading...' : 'Upload MP4 video'}
        <input
          type="file"
          accept="video/mp4"
          hidden
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError(null);
            try {
              const result = await api.uploadMedia(file);
              if (result.contentType !== 'video/mp4') throw new Error('Choose an MP4 video file');
              onChange(result.url);
            } catch (err) {
              setError(describeError(err).message);
            } finally {
              setUploading(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      {videoUrl ? <video controls playsInline src={videoUrl} style={{ maxWidth: 420, maxHeight: 240, borderRadius: 12 }} /> : null}
      {error ? <div className="alert error" role="alert">{error}</div> : null}
    </div>
  );
}

export function QuizEditor({ body, onChange }: { body: QuizBody; onChange: (b: QuizBody) => void }) {
  const setQ = (id: string, patch: Partial<QuizBody['questions'][number]>) =>
    onChange({ ...body, questions: body.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  return (
    <div className="stack">
      {body.questions.map((q, qi) => (
        <section key={q.id} className="scene stack" aria-label={`Question ${qi + 1}`}>
          <div className="scene-head">
            <h3 style={{ flex: 1 }}>
              Question {qi + 1} <span className="muted small">({q.id})</span>
            </h3>
            <button type="button" className="btn small danger" disabled={body.questions.length <= 1} onClick={() => onChange({ ...body, questions: body.questions.filter((x) => x.id !== q.id) })}>
              Remove
            </button>
          </div>
          <Field label="Emoji or picture">
            <input className="input" style={{ maxWidth: 200 }} value={q.emoji} onChange={(e) => setQ(q.id, { emoji: e.target.value })} />
          </Field>
          <LocalizedInput label="Question" value={q.prompt} onChange={(prompt) => setQ(q.id, { prompt })} />
          {q.options.map((o) => (
            <div key={o.id} className="choice stack">
              <div className="row">
                <label className="checkbox" style={{ flex: 1 }}>
                  <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === o.id} onChange={() => setQ(q.id, { correctOptionId: o.id })} />
                  Correct answer
                </label>
                <input
                  className="input"
                  style={{ width: 90 }}
                  aria-label="Option emoji"
                  value={o.emoji}
                  onChange={(e) => setQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, emoji: e.target.value } : x)) })}
                />
                <button
                  type="button"
                  className="btn small ghost"
                  disabled={q.options.length <= 2}
                  onClick={() => {
                    const options = q.options.filter((x) => x.id !== o.id);
                    setQ(q.id, { options, correctOptionId: q.correctOptionId === o.id ? (options[0]?.id ?? '') : q.correctOptionId });
                  }}
                >
                  Remove
                </button>
              </div>
              <LocalizedInput label="Option" value={o.label} onChange={(label) => setQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, label } : x)) })} />
            </div>
          ))}
          {q.options.length < 4 ? (
            <button
              type="button"
              className="btn small secondary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setQ(q.id, { options: [...q.options, { id: nextId(q.options.map((x) => x.id), 'opt'), label: { en: '' }, emoji: '⭐' }] })}
            >
              + Add option
            </button>
          ) : null}
        </section>
      ))}
      <button
        type="button"
        className="btn sky small"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          onChange({
            ...body,
            questions: [
              ...body.questions,
              {
                id: nextId(body.questions.map((q) => q.id), 'q'),
                prompt: { en: '' },
                emoji: '❓',
                correctOptionId: 'a',
                options: [
                  { id: 'a', label: { en: '' }, emoji: '🅰️' },
                  { id: 'b', label: { en: '' }, emoji: '🅱️' },
                ],
              },
            ],
          })
        }
      >
        + Add question
      </button>
    </div>
  );
}

export function SongEditor({ body, onChange }: { body: SongBody; onChange: (b: SongBody) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="scene stack">
        <h3>Recorded track (optional)</h3>
        <p className="muted small">Without a track, the app reads the lyrics aloud with gentle narration.</p>
        <Field label="Audio URL">
          <input className="input" value={body.audioUrl ?? ''} onChange={(e) => onChange({ ...body, audioUrl: e.target.value.trim() || null })} />
        </Field>
        <div className="row">
          <label className="btn small secondary" style={{ cursor: 'pointer' }}>
            {uploading ? 'Uploading...' : 'Upload MP3 / M4A'}
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac"
              hidden
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                setError(null);
                try {
                  const res = await api.uploadMedia(file);
                  onChange({ ...body, audioUrl: res.url });
                } catch (err) {
                  setError(describeError(err).message);
                } finally {
                  setUploading(false);
                  e.target.value = '';
                }
              }}
            />
          </label>
          {body.audioUrl ? <audio controls src={body.audioUrl} /> : null}
        </div>
        {error ? <div className="alert error">{error}</div> : null}
      </div>
      {body.lines.map((line, i) => (
        <section key={i} className="scene stack" aria-label={`Line ${i + 1}`}>
          <div className="scene-head">
            <input
              className="input"
              style={{ width: 90 }}
              aria-label="Line emoji"
              value={line.emoji}
              onChange={(e) => onChange({ ...body, lines: body.lines.map((l, j) => (j === i ? { ...l, emoji: e.target.value } : l)) })}
            />
            <h3 style={{ flex: 1 }}>Line {i + 1}</h3>
            <button type="button" className="btn small danger" disabled={body.lines.length <= 1} onClick={() => onChange({ ...body, lines: body.lines.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
          <LocalizedInput label="Lyrics" value={line.text} onChange={(text) => onChange({ ...body, lines: body.lines.map((l, j) => (j === i ? { ...l, text } : l)) })} />
        </section>
      ))}
      <button type="button" className="btn sky small" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...body, lines: [...body.lines, { text: { en: '' }, emoji: '🎵' }] })}>
        + Add line
      </button>
    </div>
  );
}
