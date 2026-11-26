import type { BranchingBody, StoryChoice, StoryNode } from './schemas/content';

/** The choice that leads from `from` to `to`, if the move was a choice and not a linear "next". */
export function choiceBetween(from: StoryNode, to: string): StoryChoice | undefined {
  return from.choices.find((c) => c.next === to);
}

export interface ChoiceCount {
  choiceId: string;
  count: number;
}

export interface StoryPathSummary {
  /** Paths that were counted (visited the start node). */
  paths: number;
  /** Times each ending node was reached, most common first. */
  endings: { nodeId: string; count: number }[];
  /** For every choice scene that was reached: how often each choice was picked. */
  choices: { nodeId: string; reached: number; picks: ChoiceCount[] }[];
}

/**
 * Aggregates recorded play paths (node ids in order) into choice and ending counts. Paths that
 * do not start at the story's start node, or step through unknown links, stop counting at the
 * first bad step so one stale session cannot distort the totals.
 */
export function summarizeStoryPaths(body: BranchingBody, paths: readonly (readonly string[])[]): StoryPathSummary {
  const nodes = new Map(body.nodes.map((n) => [n.id, n]));
  const endings = new Map<string, number>();
  const reached = new Map<string, number>();
  const picks = new Map<string, Map<string, number>>();
  let counted = 0;

  for (const path of paths) {
    if (path[0] !== body.startNodeId) continue;
    counted += 1;
    for (let i = 0; i < path.length; i += 1) {
      const node = nodes.get(path[i] ?? '');
      if (!node) break;
      if (node.ending && i === path.length - 1) endings.set(node.id, (endings.get(node.id) ?? 0) + 1);
      if (node.choices.length === 0) {
        if (i + 1 < path.length && node.next !== path[i + 1]) break;
        continue;
      }
      reached.set(node.id, (reached.get(node.id) ?? 0) + 1);
      const next = path[i + 1];
      if (next === undefined) break;
      const choice = choiceBetween(node, next);
      if (!choice) break;
      const forNode = picks.get(node.id) ?? new Map<string, number>();
      forNode.set(choice.id, (forNode.get(choice.id) ?? 0) + 1);
      picks.set(node.id, forNode);
    }
  }

  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count;
  return {
    paths: counted,
    endings: [...endings].map(([nodeId, count]) => ({ nodeId, count })).sort(byCount),
    choices: body.nodes
      .filter((n) => reached.has(n.id))
      .map((n) => ({
        nodeId: n.id,
        reached: reached.get(n.id) ?? 0,
        picks: n.choices.map((c) => ({ choiceId: c.id, count: picks.get(n.id)?.get(c.id) ?? 0 })).sort(byCount),
      })),
  };
}

export interface RecapScene {
  node: StoryNode;
  /** The choice the child made in this scene, if it was a choice scene. */
  choice: StoryChoice | null;
}

/**
 * The child's own journey through a story, scene by scene with the choice made in each,
 * used for the personalized recap after finishing. Unknown ids are skipped.
 */
export function recapFromPath(body: BranchingBody, path: readonly string[]): RecapScene[] {
  const nodes = new Map(body.nodes.map((n) => [n.id, n]));
  const scenes: RecapScene[] = [];
  path.forEach((id, i) => {
    const node = nodes.get(id);
    if (!node) return;
    const next = path[i + 1];
    scenes.push({ node, choice: next !== undefined ? (choiceBetween(node, next) ?? null) : null });
  });
  return scenes;
}
