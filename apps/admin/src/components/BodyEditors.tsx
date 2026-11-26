import { useState } from 'react';
import { errorsUnder, VIDEO_ANSWER_TIMEOUT_SECONDS, type BranchingBody, type FieldErrors, type QuizBody, type SongBody, type StoryNode, type VideoBody, VIDEO_SOURCES } from '@kidzo/shared';
import { base } from '@kidzo/ui-tokens';
import { api, describeError } from '../api';
import { nextId, removeNode } from '../content-model';
import { ArtPicker } from './ArtPicker';
import { Icon, type IconName } from './Icon';
import { Button, Field, IconButton, LocalizedInput } from './ui';

type Mode = 'choices' | 'next' | 'ending';
const modeOf = (n: StoryNode): Mode => (n.ending ? 'ending' : n.choices.length > 0 ? 'choices' : 'next');

const KIND: Record<'start' | Mode, { label: string; icon: IconName; kind: string }> = {
  start: { label: 'Start', icon: 'play', kind: 'start' },
  next: { label: 'Scene', icon: 'scene', kind: 'scene' },
  choices: { label: 'Choices', icon: 'choices', kind: 'choices' },
  ending: { label: 'Ending', icon: 'ending', kind: 'ending' },
};

interface EditorProps<B> {
  body: B;
  onChange: (b: B) => void;
  errors: FieldErrors;
  onBlur: (path: string) => void;
}

function NodeErrors({ errors, prefix }: { errors: FieldErrors; prefix: string }) {
  const own = Object.entries(errors).filter(([k]) => k === prefix || (k.startsWith(`${prefix}.`) && !/\.(en|fr|rw|sw)$/.test(k)));
  if (own.length === 0) return null;
  return (
    <div className="alert error" role="alert">
      <Icon name="warning" size={16} />
      <ul style={{ margin: 0 }}>
        {own.map(([k, v]) => (
          <li key={k}>{v}</li>
        ))}
      </ul>
    </div>
  );
}

export function BranchingEditor({ body, onChange, errors, onBlur }: EditorProps<BranchingBody>) {
  const ids = body.nodes.map((n) => n.id);
  const setNode = (id: string, patch: Partial<StoryNode>) => onChange({ ...body, nodes: body.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  /** Updates a scene's choices and keeps its timed-question default pointing at a choice that still exists. */
  const setChoices = (id: string, choices: StoryNode['choices']) => {
    const node = body.nodes.find((n) => n.id === id);
    if (!node) return;
    const defaultChoiceId = node.videoQuestion?.defaultChoiceId;
    const nextDefault = choices.some((choice) => choice.id === defaultChoiceId) ? defaultChoiceId : choices[0]?.id;
    setNode(id, {
      choices,
      videoQuestion: node.videoQuestion && nextDefault ? { ...node.videoQuestion, defaultChoiceId: nextDefault } : undefined,
    });
  };

  const setMode = (node: StoryNode, mode: Mode) => {
    const other = ids.find((i) => i !== node.id) ?? node.id;
    if (mode === 'ending') setNode(node.id, { ending: true, next: null, choices: [], familyTurn: false, videoQuestion: undefined });
    if (mode === 'next') setNode(node.id, { ending: false, next: node.next ?? other, choices: [], videoQuestion: undefined });
    if (mode === 'choices') {
      setNode(node.id, { ending: false, next: null, choices: node.choices.length ? node.choices : [{ id: 'choice-1', label: { en: '' }, art: 'object.sparkles', next: other }] });
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <Field label="Start scene">
          {(a11y) => (
            <select {...a11y} className="input" value={body.startNodeId} onChange={(e) => onChange({ ...body, startNodeId: e.target.value })}>
              {ids.map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          )}
        </Field>
        <Button
          tone="secondary"
          small
          icon="plus"
          style={{ alignSelf: 'flex-end' }}
          disabled={body.nodes.length >= 200}
          onClick={() => onChange({ ...body, nodes: [...body.nodes, { id: nextId(ids, 'scene'), text: { en: '' }, scene: { art: 'object.sparkle-star', color: base.sky, videoUrl: null }, familyTurn: false, choices: [], next: null, ending: true }] })}
        >
          Add scene
        </Button>
      </div>

      {body.nodes.map((node, index) => {
        const mode = modeOf(node);
        const isStart = node.id === body.startNodeId;
        const kind = KIND[isStart ? 'start' : mode];
        const prefix = `body.nodes.${index}`;
        const hasError = errorsUnder(errors, prefix).length > 0;
        return (
          <section key={node.id} className={`node ${hasError ? 'has-error' : ''}`} data-kind={kind.kind} aria-label={`Scene ${node.id}`}>
            <div className="node-head">
              <h3>
                <span className="node-type">
                  <Icon name={kind.icon} size={12} />
                  {kind.label}
                </span>
                {node.id}
                {node.scene.placeholder ? (
                  <span className="badge review" title="Uses a stand-in clip until a custom Zo animation is made">
                    <Icon name="info" size={12} />
                    Placeholder
                  </span>
                ) : null}
              </h3>
              <IconButton icon="delete" label={`Remove scene ${node.id}`} disabled={body.nodes.length <= 1} onClick={() => onChange(removeNode(body, node.id))} />
            </div>
            <div className="grid form">
              <Field label="Scene picture">
                {(a11y) => <ArtPicker id={a11y.id} label="Choose a scene picture" value={node.scene.art} color={node.scene.color} onChange={(art) => setNode(node.id, { scene: { ...node.scene, art } })} />}
              </Field>
              <Field label="Scene color">
                {(a11y) => <input {...a11y} className="input color" type="color" value={node.scene.color} onChange={(e) => setNode(node.id, { scene: { ...node.scene, color: e.target.value.toUpperCase() } })} />}
              </Field>
              <Field label="After this scene">
                {(a11y) => (
                  <select {...a11y} className="input" value={mode} onChange={(e) => setMode(node, e.target.value as Mode)}>
                    <option value="next">Continue to a scene</option>
                    <option value="choices">Offer choices</option>
                    <option value="ending">The end</option>
                  </select>
                )}
              </Field>
              {mode === 'next' ? (
                <Field label="Next scene">
                  {(a11y) => (
                    <select {...a11y} className="input" value={node.next ?? ''} onChange={(e) => setNode(node.id, { next: e.target.value })}>
                      {ids.filter((i) => i !== node.id).map((id) => (
                        <option key={id}>{id}</option>
                      ))}
                    </select>
                  )}
                </Field>
              ) : null}
            </div>
            {mode === 'choices' ? (
              <label className="checkbox" style={{ alignSelf: 'flex-start' }}>
                <input type="checkbox" checked={node.familyTurn} onChange={(e) => setNode(node.id, { familyTurn: e.target.checked })} />
                <Icon name="familyMode" size={16} />
                Parent&apos;s turn in Family Mode
              </label>
            ) : null}
            <LocalizedInput label={node.videoQuestion ? 'Question prompt' : 'Story text'} multiline path={`${prefix}.text`} errors={errors} value={node.text} onBlur={(l) => onBlur(`${prefix}.text.${l}`)} onChange={(text) => setNode(node.id, { text })} />
            <SceneVideoField videoUrl={node.scene.videoUrl} error={errors[`${prefix}.scene.videoUrl`]} onChange={(videoUrl) => setNode(node.id, { scene: { ...node.scene, videoUrl } })} />
            {mode === 'choices' ? (
              <div className="stack">
                <label className="checkbox" style={{ alignSelf: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={!!node.videoQuestion}
                    onChange={(e) => setNode(node.id, { videoQuestion: e.target.checked ? { timestampSeconds: 7, defaultChoiceId: node.choices[0]?.id ?? '' } : undefined })}
                  />
                  <Icon name="video" size={16} />
                  Pause this video for a timed question
                </label>
                {node.videoQuestion ? (
                  <>
                    <div className="grid form">
                      <Field label="Ask at (seconds)" hint="Time from the start of this clip">
                        {(a11y) => (
                          <input
                            {...a11y}
                            className="input"
                            type="number"
                            min={0}
                            max={7200}
                            step={0.1}
                            value={node.videoQuestion?.timestampSeconds ?? 0}
                            onChange={(e) => node.videoQuestion && setNode(node.id, { videoQuestion: { ...node.videoQuestion, timestampSeconds: Number(e.target.value) } })}
                          />
                        )}
                      </Field>
                      <Field label="No-answer timeout">
                        {(a11y) => <input {...a11y} className="input" type="text" readOnly value={`${VIDEO_ANSWER_TIMEOUT_SECONDS} seconds`} />}
                      </Field>
                    </div>
                    <p className="muted small">
                      The video pauses at this time. If no answer is chosen, the selected default is used after {VIDEO_ANSWER_TIMEOUT_SECONDS} seconds.
                      Each answer destination needs its own video scene before this experience can be published.
                    </p>
                    {!node.scene.videoUrl ? <div className="alert info">Upload a video for this scene before publishing its timed question.</div> : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {mode === 'choices'
              ? node.choices.map((choice, ci) => (
                  <div key={choice.id} className="choice">
                    <div className="row">
                      <strong style={{ flex: 1 }} className="row">
                        <Icon name="choices" size={16} />
                        Choice {ci + 1}
                      </strong>
                      {node.videoQuestion ? (
                        <label className="checkbox">
                          <input
                            type="radio"
                            name={`default-${node.id}`}
                            checked={node.videoQuestion.defaultChoiceId === choice.id}
                            onChange={() => node.videoQuestion && setNode(node.id, { videoQuestion: { ...node.videoQuestion, defaultChoiceId: choice.id } })}
                          />
                          Default if unanswered
                        </label>
                      ) : null}
                      <IconButton icon="delete" label={`Remove choice ${ci + 1}`} disabled={node.choices.length <= 1} onClick={() => setChoices(node.id, node.choices.filter((c) => c.id !== choice.id))} />
                    </div>
                    <div className="grid form">
                      <Field label="Picture">
                        {(a11y) => <ArtPicker id={a11y.id} label="Choose a choice picture" value={choice.art} onChange={(art) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, art } : c)))} />}
                      </Field>
                      <Field label="Goes to">
                        {(a11y) => (
                          <select {...a11y} className="input" value={choice.next} onChange={(e) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, next: e.target.value } : c)))}>
                            {ids.filter((i) => i !== node.id).map((id) => (
                              <option key={id}>{id}</option>
                            ))}
                          </select>
                        )}
                      </Field>
                    </div>
                    <LocalizedInput
                      label="Choice label"
                      path={`${prefix}.choices.${ci}.label`}
                      errors={errors}
                      value={choice.label}
                      onBlur={(l) => onBlur(`${prefix}.choices.${ci}.label.${l}`)}
                      onChange={(label) => setChoices(node.id, node.choices.map((c) => (c.id === choice.id ? { ...c, label } : c)))}
                    />
                  </div>
                ))
              : null}
            {mode === 'choices' && node.choices.length < 4 ? (
              <Button
                tone="secondary"
                small
                icon="plus"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setChoices(node.id, [...node.choices, { id: nextId(node.choices.map((c) => c.id), 'choice'), label: { en: '' }, art: 'object.sparkles', next: ids.find((i) => i !== node.id) ?? node.id }])}
              >
                Add choice
              </Button>
            ) : null}
            <NodeErrors errors={errors} prefix={prefix} />
          </section>
        );
      })}
    </div>
  );
}

function SceneVideoField({ videoUrl, onChange, error, label = 'Scene video', hint = 'Optional MP4 clip up to 100 MB. The scene picture shows if the video cannot play.' }: { videoUrl: string | null; onChange: (url: string | null) => void; error?: string; label?: string; hint?: string }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  return (
    <div className="stack tight">
      <Field label={label} hint={hint} error={error ?? uploadError ?? undefined}>
        {(a11y) => (
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input {...a11y} className="input" type="url" placeholder="https://" value={videoUrl ?? ''} onChange={(e) => onChange(e.target.value.trim() || null)} />
            <label className="btn secondary small" style={{ cursor: 'pointer' }}>
              <Icon name={uploading ? 'sync' : 'upload'} size={16} className={uploading ? 'spin' : undefined} />
              {uploading ? 'Uploading' : 'Upload MP4'}
              <input
                type="file"
                accept="video/mp4"
                hidden
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setUploadError(null);
                  try {
                    const result = await api.uploadMedia(file);
                    if (result.contentType !== 'video/mp4') throw new Error('Choose an MP4 video file');
                    onChange(result.url);
                  } catch (err) {
                    setUploadError(describeError(err).message);
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>
            {videoUrl ? <IconButton icon="close" label="Remove video" onClick={() => onChange(null)} /> : null}
          </div>
        )}
      </Field>
      {videoUrl ? <video controls playsInline src={videoUrl} style={{ maxWidth: 420, maxHeight: 240, borderRadius: 'var(--radius-sm)' }} /> : null}
    </div>
  );
}

export function QuizEditor({ body, onChange, errors, onBlur }: EditorProps<QuizBody>) {
  const setQ = (id: string, patch: Partial<QuizBody['questions'][number]>) => onChange({ ...body, questions: body.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  return (
    <div className="stack">
      {body.questions.map((q, qi) => {
        const prefix = `body.questions.${qi}`;
        return (
          <section key={q.id} className={`node ${errorsUnder(errors, prefix).length ? 'has-error' : ''}`} data-kind="question" aria-label={`Question ${qi + 1}`}>
            <div className="node-head">
              <h3>
                <span className="node-type">
                  <Icon name="question" size={12} />
                  Question
                </span>
                {qi + 1}
              </h3>
              <IconButton icon="delete" label={`Remove question ${qi + 1}`} disabled={body.questions.length <= 1} onClick={() => onChange({ ...body, questions: body.questions.filter((x) => x.id !== q.id) })} />
            </div>
            <Field label="Question picture">
              {(a11y) => <ArtPicker id={a11y.id} label="Choose a question picture" value={q.art} onChange={(art) => setQ(q.id, { art })} />}
            </Field>
            <LocalizedInput label="Question" path={`${prefix}.prompt`} errors={errors} value={q.prompt} onBlur={(l) => onBlur(`${prefix}.prompt.${l}`)} onChange={(prompt) => setQ(q.id, { prompt })} />
            <LocalizedInput
              label="Why this is the answer (optional)"
              path={`${prefix}.explanation`}
              errors={errors}
              value={q.explanation ?? { en: '' }}
              onBlur={(l) => onBlur(`${prefix}.explanation.${l}`)}
              onChange={(explanation) => setQ(q.id, { explanation: explanation.en.trim() ? explanation : undefined })}
            />
            {q.options.map((o, oi) => (
              <div key={o.id} className="choice">
                <div className="row">
                  <label className="checkbox" style={{ flex: 1 }}>
                    <input type="radio" name={`correct-${q.id}`} checked={q.correctOptionId === o.id} onChange={() => setQ(q.id, { correctOptionId: o.id })} />
                    <Icon name="checkCircle" size={16} />
                    Correct answer
                  </label>
                  <ArtPicker label={`Picture for answer ${oi + 1}`} value={o.art} onChange={(art) => setQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, art } : x)) })} />
                  <IconButton
                    icon="delete"
                    label={`Remove answer ${oi + 1}`}
                    disabled={q.options.length <= 2}
                    onClick={() => {
                      const options = q.options.filter((x) => x.id !== o.id);
                      setQ(q.id, { options, correctOptionId: q.correctOptionId === o.id ? (options[0]?.id ?? '') : q.correctOptionId });
                    }}
                  />
                </div>
                <LocalizedInput
                  label={`Answer ${oi + 1}`}
                  path={`${prefix}.options.${oi}.label`}
                  errors={errors}
                  value={o.label}
                  onBlur={(l) => onBlur(`${prefix}.options.${oi}.label.${l}`)}
                  onChange={(label) => setQ(q.id, { options: q.options.map((x) => (x.id === o.id ? { ...x, label } : x)) })}
                />
              </div>
            ))}
            {q.options.length < 4 ? (
              <Button tone="secondary" small icon="plus" style={{ alignSelf: 'flex-start' }} onClick={() => setQ(q.id, { options: [...q.options, { id: nextId(q.options.map((x) => x.id), 'opt'), label: { en: '' }, art: 'object.star' }] })}>
                Add answer
              </Button>
            ) : null}
            <NodeErrors errors={errors} prefix={prefix} />
          </section>
        );
      })}
      <Button
        tone="secondary"
        small
        icon="plus"
        style={{ alignSelf: 'flex-start' }}
        onClick={() =>
          onChange({
            ...body,
            questions: [
              ...body.questions,
              {
                id: nextId(body.questions.map((q) => q.id), 'q'),
                prompt: { en: '' },
                art: 'object.question',
                correctOptionId: 'a',
                options: [
                  { id: 'a', label: { en: '' }, art: 'object.letter-a' },
                  { id: 'b', label: { en: '' }, art: 'object.letter-b' },
                ],
              },
            ],
          })
        }
      >
        Add question
      </Button>
    </div>
  );
}

export function SongEditor({ body, onChange, errors, onBlur }: EditorProps<SongBody>) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <section className="node" data-kind="line">
        <h3 className="row">
          <Icon name="song" size={18} />
          Recorded track (optional)
        </h3>
        <p className="muted small">Without a track, the app reads the lyrics aloud with gentle narration.</p>
        <Field label="Audio link" error={errors['body.audioUrl'] ?? error ?? undefined}>
          {(a11y) => (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input {...a11y} className="input" value={body.audioUrl ?? ''} onChange={(e) => onChange({ ...body, audioUrl: e.target.value.trim() || null })} />
              <label className="btn secondary small" style={{ cursor: 'pointer' }}>
                <Icon name={uploading ? 'sync' : 'upload'} size={16} className={uploading ? 'spin' : undefined} />
                {uploading ? 'Uploading' : 'Upload MP3 or M4A'}
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
            </div>
          )}
        </Field>
        {body.audioUrl ? <audio controls src={body.audioUrl} /> : null}
      </section>
      {body.lines.map((line, i) => {
        const prefix = `body.lines.${i}`;
        return (
          <section key={i} className={`node ${errorsUnder(errors, prefix).length ? 'has-error' : ''}`} data-kind="line" aria-label={`Line ${i + 1}`}>
            <div className="node-head">
              <h3>
                <span className="node-type">
                  <Icon name="song" size={12} />
                  Line
                </span>
                {i + 1}
              </h3>
              <ArtPicker label={`Picture for line ${i + 1}`} value={line.art} onChange={(art) => onChange({ ...body, lines: body.lines.map((l, j) => (j === i ? { ...l, art } : l)) })} />
              <IconButton icon="delete" label={`Remove line ${i + 1}`} disabled={body.lines.length <= 1} onClick={() => onChange({ ...body, lines: body.lines.filter((_, j) => j !== i) })} />
            </div>
            <LocalizedInput label="Lyrics" path={`${prefix}.text`} errors={errors} value={line.text} onBlur={(l) => onBlur(`${prefix}.text.${l}`)} onChange={(text) => onChange({ ...body, lines: body.lines.map((l, j) => (j === i ? { ...l, text } : l)) })} />
          </section>
        );
      })}
      <Button tone="secondary" small icon="plus" style={{ alignSelf: 'flex-start' }} onClick={() => onChange({ ...body, lines: [...body.lines, { text: { en: '' }, art: 'object.music-note' }] })}>
        Add line
      </Button>
    </div>
  );
}

/** A single video with its credit, optional variants and an optional quiz after it. */
export function VideoEditor({ body, onChange, errors, onBlur }: EditorProps<VideoBody>) {
  const credit = body.credit;
  const setCredit = (patch: Partial<VideoBody['credit']>) => onChange({ ...body, credit: { ...credit, ...patch } });
  const text = (label: string, value: string | null, set: (v: string | null) => void, path: string) => (
    <Field label={label} error={errors[path]}>
      {(a11y) => <input {...a11y} className="input" value={value ?? ''} onChange={(e) => set(e.target.value.trim() ? e.target.value : null)} />}
    </Field>
  );
  return (
    <div className="stack">
      <SceneVideoField label="Video" hint="MP4, up to 100 MB. Imported clips already have 480p and 720p versions." videoUrl={body.videoUrl || null} error={errors['body.videoUrl']} onChange={(url) => onChange({ ...body, videoUrl: url ?? '' })} />
      <div className="grid form">
        <Field label="Length in seconds" hint="Children only get videos that fit their age group's limit." error={errors['body.durationSeconds']}>
          {(a11y) => <input {...a11y} className="input" type="number" min={1} value={body.durationSeconds} onChange={(e) => onChange({ ...body, durationSeconds: Number(e.target.value) })} />}
        </Field>
        <Field label="Sound">
          {(a11y) => (
            <select {...a11y} className="input" value={body.audio} onChange={(e) => onChange({ ...body, audio: e.target.value as VideoBody['audio'] })}>
              <option value="original">Original sound</option>
              <option value="narration">KIDZO narration</option>
              <option value="none">No sound (music rights unclear)</option>
            </select>
          )}
        </Field>
        {text('480p version URL', body.variants.p480, (v) => onChange({ ...body, variants: { ...body.variants, p480: v } }), 'body.variants.p480')}
        {text('720p version URL', body.variants.p720, (v) => onChange({ ...body, variants: { ...body.variants, p720: v } }), 'body.variants.p720')}
        {text('Thumbnail URL', body.thumbnailUrl, (v) => onChange({ ...body, thumbnailUrl: v }), 'body.thumbnailUrl')}
      </div>
      {body.thumbnailUrl ? <img src={body.thumbnailUrl} alt="Video thumbnail" style={{ maxWidth: 240, borderRadius: 'var(--radius-sm)' }} /> : null}

      <section className="stack tight" aria-label="Credit">
        <h3 style={{ margin: 0 }}>Credit and license</h3>
        <div className="grid form">
          <Field label="Source">
            {(a11y) => (
              <select {...a11y} className="input" value={credit.source} onChange={(e) => setCredit({ source: e.target.value as VideoBody['credit']['source'] })}>
                {VIDEO_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </Field>
          {text('License', credit.license, (v) => setCredit({ license: v ?? '' }), 'body.credit.license')}
          {text('Author', credit.author, (v) => setCredit({ author: v }), 'body.credit.author')}
          {text('Source page', credit.sourceUrl, (v) => setCredit({ sourceUrl: v }), 'body.credit.sourceUrl')}
          {text('Attribution shown on Credits', credit.attribution, (v) => setCredit({ attribution: v ?? '' }), 'body.credit.attribution')}
        </div>
      </section>

      <section className="stack tight" aria-label="Quiz after the video">
        <div className="row">
          <h3 style={{ margin: 0, flex: 1 }}>Quiz after the video</h3>
          {body.quiz.length ? (
            <Button tone="ghost" small icon="delete" onClick={() => onChange({ ...body, quiz: [] })}>
              Remove quiz
            </Button>
          ) : (
            <Button
              tone="secondary"
              small
              icon="plus"
              onClick={() =>
                onChange({
                  ...body,
                  quiz: [{ id: 'q1', prompt: { en: '' }, art: 'object.question', correctOptionId: 'a', options: [{ id: 'a', label: { en: '' }, art: 'object.letter-a' }, { id: 'b', label: { en: '' }, art: 'object.letter-b' }] }],
                })
              }
            >
              Add a quiz
            </Button>
          )}
        </div>
        {body.quiz.length ? (
          <QuizEditor body={{ kind: 'quiz', questions: body.quiz }} errors={errors} onBlur={onBlur} onChange={(q) => onChange({ ...body, quiz: q.questions })} />
        ) : (
          <p className="muted small">Little Explorers get 2 picture answers, Young Adventurers 3, Big Explorers 3 or 4.</p>
        )}
      </section>
    </div>
  );
}
