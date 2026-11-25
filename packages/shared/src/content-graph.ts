import type { Locale, LocalizedText } from './schemas/common';
import type { BranchingBody, ContentBody, QuizBody, StoryNode } from './schemas/content';

/** Structural checks for a branching story. Returns human readable problems, empty when valid. */
export function validateBranchingBody(body: BranchingBody): string[] {
  const problems: string[] = [];
  const byId = new Map<string, StoryNode>();
  for (const node of body.nodes) {
    if (byId.has(node.id)) problems.push(`Duplicate scene id "${node.id}"`);
    byId.set(node.id, node);
  }
  if (!byId.has(body.startNodeId)) problems.push(`Start scene "${body.startNodeId}" does not exist`);

  for (const node of body.nodes) {
    const hasChoices = node.choices.length > 0;
    const hasNext = node.next !== null;
    const kinds = [hasChoices, hasNext, node.ending].filter(Boolean).length;
    if (kinds !== 1) {
      problems.push(`Scene "${node.id}" must have exactly one of: choices, a next scene, or be an ending`);
    }
    if (node.familyTurn && !hasChoices) {
      problems.push(`Scene "${node.id}" is a family turn but has no choices`);
    }
    if (node.videoQuestion) {
      if (!hasChoices) {
        problems.push(`Scene "${node.id}" has a timed video question but no choices`);
      } else if (!node.choices.some((choice) => choice.id === node.videoQuestion?.defaultChoiceId)) {
        problems.push(`Scene "${node.id}" default answer "${node.videoQuestion.defaultChoiceId}" is not one of its choices`);
      }
      const destinationIds = node.choices.map((choice) => choice.next);
      if (new Set(destinationIds).size !== destinationIds.length) {
        problems.push(`Timed video answers in scene "${node.id}" must lead to different destination scenes`);
      }
    }
    if (hasNext && node.next !== null && !byId.has(node.next)) {
      problems.push(`Scene "${node.id}" continues to missing scene "${node.next}"`);
    }
    const choiceIds = new Set<string>();
    for (const choice of node.choices) {
      if (choiceIds.has(choice.id)) problems.push(`Scene "${node.id}" has duplicate choice "${choice.id}"`);
      choiceIds.add(choice.id);
      if (!byId.has(choice.next)) {
        problems.push(`Choice "${choice.id}" in scene "${node.id}" points to missing scene "${choice.next}"`);
      }
    }
  }
  if (problems.length > 0) return problems;

  // Reachability: every scene reachable from start, and at least one ending reachable.
  const reachable = new Set<string>();
  const queue = [body.startNodeId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || reachable.has(id)) continue;
    reachable.add(id);
    const node = byId.get(id);
    if (!node) continue;
    if (node.next) queue.push(node.next);
    for (const choice of node.choices) queue.push(choice.next);
  }
  for (const node of body.nodes) {
    if (!reachable.has(node.id)) problems.push(`Scene "${node.id}" can never be reached`);
  }
  if (!body.nodes.some((n) => n.ending && reachable.has(n.id))) {
    problems.push('Story needs at least one reachable ending');
  }
  return problems;
}

export function validateQuizBody(body: QuizBody): string[] {
  const problems: string[] = [];
  const questionIds = new Set<string>();
  for (const q of body.questions) {
    if (questionIds.has(q.id)) problems.push(`Duplicate question id "${q.id}"`);
    questionIds.add(q.id);
    const optionIds = new Set(q.options.map((o) => o.id));
    if (optionIds.size !== q.options.length) problems.push(`Question "${q.id}" has duplicate option ids`);
    if (!optionIds.has(q.correctOptionId)) {
      problems.push(`Question "${q.id}" correct answer "${q.correctOptionId}" is not one of its options`);
    }
  }
  return problems;
}

export function validateContentBody(body: ContentBody): string[] {
  switch (body.kind) {
    case 'branching':
      return validateBranchingBody(body);
    case 'quiz':
      return validateQuizBody(body);
    case 'song':
      return [];
  }
}

/** True when `path` is a legal walk from the start scene to an ending. */
export function isValidStoryPath(body: BranchingBody, path: readonly string[]): boolean {
  if (path.length === 0 || path[0] !== body.startNodeId) return false;
  const byId = new Map(body.nodes.map((n) => [n.id, n]));
  for (let i = 0; i < path.length - 1; i += 1) {
    const node = byId.get(path[i] as string);
    const nextId = path[i + 1];
    if (!node || nextId === undefined) return false;
    const legal = node.next === nextId || node.choices.some((c) => c.next === nextId);
    if (!legal) return false;
  }
  const last = byId.get(path[path.length - 1] as string);
  return last?.ending === true;
}

export interface BranchingPathPlan {
  scenes: string[];
  choices: Array<{ nodeId: string; choiceId: string }>;
}

export interface BranchingPathEnumeration {
  paths: BranchingPathPlan[];
  cycles: number;
  truncated: boolean;
}

/** Enumerates complete answer routes while bounding cyclic or highly branching drafts. */
export function enumerateBranchingPaths(body: BranchingBody, maxPaths = 256): BranchingPathEnumeration {
  const limit = Math.max(1, Math.floor(maxPaths));
  const byId = new Map(body.nodes.map((node) => [node.id, node]));
  const result: BranchingPathEnumeration = { paths: [], cycles: 0, truncated: false };
  let visitedStates = 0;
  const stateLimit = limit * Math.max(1, body.nodes.length);

  const visit = (
    nodeId: string,
    scenes: string[],
    choices: BranchingPathPlan['choices'],
    ancestors: Set<string>,
  ) => {
    if (result.paths.length >= limit || visitedStates >= stateLimit) {
      result.truncated = true;
      return;
    }
    visitedStates += 1;
    if (ancestors.has(nodeId)) {
      result.cycles += 1;
      return;
    }
    const node = byId.get(nodeId);
    if (!node) return;
    const nextScenes = [...scenes, nodeId];
    if (node.ending) {
      result.paths.push({ scenes: nextScenes, choices });
      return;
    }
    const nextAncestors = new Set(ancestors).add(nodeId);
    const edges = node.choices.length > 0
      ? node.choices.map((choice) => ({
          nodeId: choice.next,
          choices: [...choices, { nodeId: node.id, choiceId: choice.id }],
        }))
      : node.next
        ? [{ nodeId: node.next, choices }]
        : [];
    for (let index = 0; index < edges.length; index += 1) {
      if (result.paths.length >= limit) {
        result.truncated = true;
        break;
      }
      const edge = edges[index];
      if (!edge) continue;
      visit(edge.nodeId, nextScenes, edge.choices, nextAncestors);
      if (result.truncated) break;
    }
  };

  visit(body.startNodeId, [], [], new Set());
  return result;
}

export function scoreQuiz(body: QuizBody, answers: Record<string, string>): { correct: number; total: number } {
  let correct = 0;
  for (const q of body.questions) {
    if (answers[q.id] === q.correctOptionId) correct += 1;
  }
  return { correct, total: body.questions.length };
}

/**
 * Stars for a finished session. Stories need a legal path to an ending, quizzes reward
 * effort (at least one star for finishing) plus accuracy, songs reward finishing.
 */
export function computeStars(
  body: ContentBody,
  rewardStars: number,
  path: readonly string[],
  answers: Record<string, string> | undefined,
): { valid: boolean; stars: number } {
  switch (body.kind) {
    case 'branching': {
      const valid = isValidStoryPath(body, path);
      return { valid, stars: valid ? rewardStars : 0 };
    }
    case 'quiz': {
      const { correct, total } = scoreQuiz(body, answers ?? {});
      const answeredAll = body.questions.every((q) => answers?.[q.id] !== undefined);
      if (!answeredAll) return { valid: false, stars: 0 };
      const stars = Math.max(rewardStars > 0 ? 1 : 0, Math.round((rewardStars * correct) / total));
      return { valid: true, stars };
    }
    case 'song':
      return { valid: true, stars: rewardStars };
  }
}

/** Approximate payload size of a content package, used for the download size label. */
export function estimatePackageBytes(body: ContentBody): number {
  return utf8ByteLength(JSON.stringify(body));
}

/** UTF-8 byte length without relying on TextEncoder, which is not available everywhere. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

/** Every translatable string inside a content body. */
export function collectBodyTexts(body: ContentBody): LocalizedText[] {
  switch (body.kind) {
    case 'branching':
      return body.nodes.flatMap((n) => [n.text, ...n.choices.map((c) => c.label)]);
    case 'quiz':
      return body.questions.flatMap((q) => [q.prompt, ...q.options.map((o) => o.label)]);
    case 'song':
      return body.lines.map((l) => l.text);
  }
}

/**
 * Problems that block publishing: structural errors, plus missing translations for any
 * language the content claims to support (title, summary and every scene or line).
 */
export function publishProblems(input: {
  title: LocalizedText;
  summary: LocalizedText;
  languages: readonly Locale[];
  body: ContentBody;
}): string[] {
  const problems = validateContentBody(input.body);
  if (input.body.kind === 'branching') {
    const nodes = new Map(input.body.nodes.map((node) => [node.id, node]));
    for (const node of input.body.nodes) {
      if (node.videoQuestion && !node.scene.videoUrl) {
        problems.push(`Scene "${node.id}" has a timed question but no video clip`);
      }
      if (!node.videoQuestion) continue;
      for (const choice of node.choices) {
        const destination = nodes.get(choice.next);
        if (destination && !destination.scene.videoUrl) {
          problems.push(`Answer "${choice.id}" from scene "${node.id}" needs a video clip on destination scene "${destination.id}"`);
        }
      }
    }
  }
  if (!input.languages.includes('en')) problems.push('English must be one of the languages');
  const texts = collectBodyTexts(input.body);
  for (const lang of input.languages) {
    if (lang === 'en') continue;
    const label = lang.toUpperCase();
    if (!input.title[lang]) problems.push(`Title is missing a ${label} translation`);
    if (!input.summary[lang]) problems.push(`Summary is missing a ${label} translation`);
    const missing = texts.filter((t) => !t[lang]).length;
    if (missing > 0) problems.push(`${missing} story line(s) are missing a ${label} translation`);
  }
  return problems;
}
