/** Pure helpers for the content editor (no React), unit tested. */
import {
  BODY_KIND_FOR_TYPE,
  contentInputSchema,
  publishProblems,
  type ContentBody,
  type ContentDetail,
  type ContentInput,
  type ContentType,
  type StoryNode,
} from '@kidzo/shared';

/** Editable content: metadata as entered, body always in its parsed (defaults applied) form. */
export type Draft = Omit<ContentInput, 'body'> & {
  body: ContentBody;
  featured: boolean;
  rewardStickerId: string | null;
};

const SCENE = { emoji: '🌟', color: '#5BC0F8', videoUrl: null };

export function blankNode(id: string, ending = false): StoryNode {
  return { id, text: { en: '' }, scene: { ...SCENE }, familyTurn: false, choices: [], next: null, ending };
}

export function blankBody(type: ContentType): ContentBody {
  switch (BODY_KIND_FOR_TYPE[type]) {
    case 'branching':
      return { kind: 'branching', startNodeId: 'start', nodes: [{ ...blankNode('start'), next: 'end' }, blankNode('end', true)] };
    case 'quiz':
      return {
        kind: 'quiz',
        questions: [
          {
            id: 'q1',
            prompt: { en: '' },
            emoji: '❓',
            correctOptionId: 'a',
            options: [
              { id: 'a', label: { en: '' }, emoji: '🅰️' },
              { id: 'b', label: { en: '' }, emoji: '🅱️' },
            ],
          },
        ],
      };
    case 'song':
      return { kind: 'song', audioUrl: null, lines: [{ text: { en: '' }, emoji: '🎵' }] };
  }
}

export function blankDraft(type: ContentType = 'adventure'): Draft {
  return {
    slug: '',
    type,
    title: { en: '' },
    summary: { en: '' },
    ageMin: 3,
    ageMax: 8,
    durationMinutes: 10,
    skills: ['kindness'],
    languages: ['en'],
    coverEmoji: '🌈',
    coverColor: '#5BC0F8',
    calm: false,
    featured: false,
    rewardStars: 10,
    rewardStickerId: null,
    body: blankBody(type),
  };
}

export function draftFromDetail(d: ContentDetail): Draft {
  return {
    slug: d.slug,
    type: d.type,
    title: d.title,
    summary: d.summary,
    ageMin: d.ageMin,
    ageMax: d.ageMax,
    durationMinutes: d.durationMinutes,
    skills: d.skills,
    languages: d.languages,
    coverEmoji: d.coverEmoji,
    coverColor: d.coverColor,
    calm: d.calm,
    featured: d.featured,
    rewardStars: d.rewardStars,
    rewardStickerId: d.rewardStickerId,
    body: d.body,
  };
}

/** Changing the type swaps in a fresh body when the body kind no longer matches. */
export function withType(draft: Draft, type: ContentType): Draft {
  const body = BODY_KIND_FOR_TYPE[type] === draft.body.kind ? draft.body : blankBody(type);
  return { ...draft, type, body, calm: type === 'game' ? false : draft.calm };
}

/** Lowercase id not already used, e.g. scene-3. */
export function nextId(existing: readonly string[], prefix: string): string {
  let n = existing.length + 1;
  while (existing.includes(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** Problems shown live in the editor: schema errors first, then publish blockers. */
export function liveProblems(draft: Draft): { schema: string[]; publish: string[] } {
  const parsed = contentInputSchema.safeParse(draft);
  if (!parsed.success) {
    return { schema: parsed.error.issues.map((i) => `${i.path.join('.') || 'content'}: ${i.message}`), publish: [] };
  }
  return { schema: [], publish: publishProblems(parsed.data) };
}

/** Removes a scene and any links pointing to it. */
export function removeNode(body: Extract<ContentBody, { kind: 'branching' }>, id: string): Extract<ContentBody, { kind: 'branching' }> {
  const nodes = body.nodes
    .filter((n) => n.id !== id)
    .map((n) => {
      const choices = n.choices.filter((c) => c.next !== id);
      const defaultChoiceId = n.videoQuestion?.defaultChoiceId;
      const nextDefaultChoiceId =
        choices.find((choice) => choice.id === defaultChoiceId)?.id ?? choices[0]?.id;
      return {
        ...n,
        next: n.next === id ? null : n.next,
        choices,
        videoQuestion: n.videoQuestion && nextDefaultChoiceId
          ? {
              ...n.videoQuestion,
              defaultChoiceId: nextDefaultChoiceId,
            }
          : undefined,
      };
    });
  return { ...body, nodes, startNodeId: body.startNodeId === id ? (nodes[0]?.id ?? '') : body.startNodeId };
}
