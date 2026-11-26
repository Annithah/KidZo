import { categoryOf, isCategoryAllowed } from './categories';
import { isAgeAppropriate } from './policy';

export interface RecommendableContent {
  id: string;
  type: string;
  calm: boolean;
  skills: readonly string[];
  ageMin: number;
  ageMax: number;
  featured?: boolean;
}

/** One play of one item. Only the item and whether it was finished are used. */
export interface PlayHistoryEntry {
  contentId: string;
  completed: boolean;
}

export interface ScoredRecommendation<T> {
  item: T;
  /** The skill that drove the pick, for a "Because you like ..." line. Null for starter picks. */
  becauseSkill: string | null;
  score: number;
}

/**
 * Interest-based picks from minimal data: which items the child played and finished. Skills of
 * finished items count double. Items finished already rank lower so the row shows new things.
 * Age range and the parent's blocked categories always apply. Children with no history get
 * featured items first, so the row is never empty when the catalog has something for them.
 */
export function recommendContent<T extends RecommendableContent>(
  child: { age: number; blockedCategories?: readonly string[] },
  catalog: readonly T[],
  history: readonly PlayHistoryEntry[],
  limit = 6,
): ScoredRecommendation<T>[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const skillWeight = new Map<string, number>();
  const categoryWeight = new Map<string, number>();
  const finished = new Set<string>();
  for (const play of history) {
    const item = byId.get(play.contentId);
    if (!item) continue;
    const w = play.completed ? 2 : 1;
    if (play.completed) finished.add(item.id);
    for (const s of item.skills) skillWeight.set(s, (skillWeight.get(s) ?? 0) + w);
    const cat = categoryOf(item);
    categoryWeight.set(cat, (categoryWeight.get(cat) ?? 0) + w);
  }

  const eligible = catalog.filter(
    (c) => isAgeAppropriate(child.age, c.ageMin, c.ageMax) && isCategoryAllowed(child.blockedCategories, c),
  );
  return eligible
    .map((item) => {
      let best: string | null = null;
      let bestWeight = 0;
      let score = 0;
      for (const s of item.skills) {
        const w = skillWeight.get(s) ?? 0;
        score += w;
        if (w > bestWeight) {
          bestWeight = w;
          best = s;
        }
      }
      score += (categoryWeight.get(categoryOf(item)) ?? 0) * 0.5;
      if (item.featured) score += 0.25;
      if (finished.has(item.id)) score *= 0.3;
      return { item, becauseSkill: best, score };
    })
    .sort((a, b) => b.score - a.score || Number(!!b.item.featured) - Number(!!a.item.featured) || a.item.ageMin - b.item.ageMin)
    .slice(0, limit);
}
