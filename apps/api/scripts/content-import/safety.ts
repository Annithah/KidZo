import { AGE_GROUP_RULES, type AgeGroup } from '@kidzo/shared';

/**
 * Safety rules for imported clips. Everything here runs on metadata before a file is
 * downloaded, plus duration and size after probing. A human still reviews every item:
 * imports always land in "review", never published.
 */

/** Words that disqualify a clip when found in its title, tags or description. */
export const BLOCKLIST = [
  'violence', 'violent', 'weapon', 'weapons', 'gun', 'guns', 'rifle', 'pistol', 'knife', 'sword', 'bomb', 'explosion', 'explode',
  'blood', 'bloody', 'gore', 'dead', 'death', 'die', 'dying', 'kill', 'killed', 'killing', 'murder', 'corpse', 'funeral', 'skull',
  'scary', 'scare', 'horror', 'creepy', 'zombie', 'ghost', 'demon', 'monster', 'nightmare', 'halloween',
  'alcohol', 'beer', 'wine', 'vodka', 'whisky', 'whiskey', 'drunk', 'bar', 'cocktail', 'smoking', 'smoke', 'cigarette', 'vape', 'drug', 'drugs',
  'romance', 'romantic', 'kiss', 'kissing', 'sexy', 'sex', 'lingerie', 'bikini', 'swimwear', 'swimsuit', 'nude', 'naked',
  'injury', 'injured', 'wound', 'hospital', 'surgery', 'crash', 'accident', 'disaster', 'fire', 'burning', 'flood', 'tornado', 'hurricane',
  'war', 'military', 'army', 'soldier', 'battle', 'missile', 'tank', 'protest', 'riot', 'police', 'prison', 'hunt', 'hunting', 'prey', 'attack',
  'gambling', 'casino', 'politics', 'election', 'religion', 'news', 'press conference', 'briefing', 'interview', 'lecture',
  // Sad or distressing, and academic or technical footage that is not for children.
  'sad', 'miserable', 'cruel', 'cruelty', 'abuse', 'suffering', 'sick', 'slaughter', 'butcher', 'meat', 'poaching', 'trapped', 'stranded', 'crying',
  'data', 'dataset', 'study', 'research', 'analysis', 'simulation', 'visualization', 'landsat', 'sentinel', 'ndvi', 'conference', 'webinar', 'tutorial',
] as const;

/** Allowed subjects. A clip must clearly be about at least one of these. */
export const ALLOWED_SUBJECTS = [
  'animal', 'animals', 'wildlife', 'nature', 'ocean', 'sea', 'fish', 'whale', 'dolphin', 'turtle', 'coral', 'beach', 'river', 'lake', 'waterfall',
  'space', 'planet', 'moon', 'earth', 'star', 'stars', 'galaxy', 'astronaut', 'rocket', 'satellite', 'sun', 'mars', 'saturn', 'jupiter', 'aurora',
  'farm', 'cow', 'sheep', 'goat', 'chicken', 'horse', 'pig', 'duck', 'tractor',
  'vehicle', 'car', 'train', 'bus', 'boat', 'airplane', 'bicycle', 'truck',
  'music', 'instrument', 'drum', 'piano', 'guitar', 'violin', 'dance', 'dancing', 'cooking', 'baking', 'fruit', 'vegetable', 'kitchen',
  'art', 'painting', 'drawing', 'craft', 'clay', 'sport', 'football', 'soccer', 'running', 'swimming pool', 'playground',
  'weather', 'rain', 'snow', 'cloud', 'clouds', 'rainbow', 'sky', 'plant', 'plants', 'flower', 'flowers', 'tree', 'trees', 'forest', 'garden', 'leaf', 'leaves',
  'insect', 'insects', 'butterfly', 'bee', 'ant', 'ladybug', 'bird', 'birds', 'parrot', 'owl', 'penguin', 'flamingo',
  'city', 'town', 'market', 'bridge', 'africa', 'african', 'rwanda', 'kigali', 'gorilla', 'elephant', 'giraffe', 'zebra', 'lion', 'hippo', 'rhino',
  'savanna', 'safari', 'volcano', 'mountain', 'kivu', 'nyungwe', 'chimpanzee', 'monkey', 'cheetah', 'leopard', 'buffalo', 'antelope',
  'science', 'experiment', 'magnet', 'water', 'ice', 'body', 'heart', 'microscope', 'robot', 'coding', 'computer',
] as const;

export interface CandidateMeta {
  title: string;
  description: string;
  tags: readonly string[];
}

/** Lowercase words and two-word phrases from the metadata, for whole-word matching. */
function words(meta: CandidateMeta): Set<string> {
  const text = [meta.title, meta.description, ...meta.tags].join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const list = text.split(/\s+/).filter(Boolean);
  const set = new Set(list);
  for (let i = 0; i < list.length - 1; i += 1) set.add(`${list[i]} ${list[i + 1]}`);
  return set;
}

const STOPWORDS = new Set(['the', 'and', 'with', 'for', 'from', 'kids', 'child', 'children', 'baby', 'little', 'calm', 'slow', 'timelapse', 'aerial']);

/**
 * The clip must be about what was searched: at least one meaningful word of the search term
 * (singular or plural) appears in its title, tags or description.
 */
export function checkRelevance(meta: CandidateMeta, term: string): Rejection | null {
  const w = words(meta);
  const keys = term.toLowerCase().split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  if (keys.length === 0) return null;
  const hit = keys.some((k) => w.has(k) || w.has(`${k}s`) || (k.endsWith('s') && w.has(k.slice(0, -1))));
  return hit ? null : { reason: 'subject', detail: `does not mention "${term}"` };
}

export type Rejection =
  | { reason: 'blocklist'; detail: string }
  | { reason: 'subject'; detail: string }
  | { reason: 'license'; detail: string }
  | { reason: 'duration'; detail: string }
  | { reason: 'resolution'; detail: string };

export function checkText(meta: CandidateMeta): Rejection | null {
  const w = words(meta);
  const blocked = BLOCKLIST.find((b) => w.has(b));
  if (blocked) return { reason: 'blocklist', detail: blocked };
  if (!ALLOWED_SUBJECTS.some((s) => w.has(s))) return { reason: 'subject', detail: 'no allowed subject in title, tags or description' };
  return null;
}

/** Licenses the importer accepts, by normalized short name. Share-alike, NC and ND are refused. */
export function checkLicense(license: string): Rejection | null {
  const l = license.toLowerCase().replace(/\s+/g, ' ').trim();
  const ok =
    l === 'pexels license' ||
    l === 'pixabay content license' ||
    l === 'public domain' ||
    l.startsWith('pd') ||
    l === 'cc0' ||
    l.startsWith('cc0 ') ||
    /^cc by \d(\.\d)?$/.test(l) ||
    l === 'cc by';
  return ok ? null : { reason: 'license', detail: license };
}

/**
 * Duration fits every age group the clip is meant for (the strictest one wins) and the plan's
 * own bounds; resolution is at least 720p.
 */
export function checkMedia(
  info: { durationSeconds: number; width: number; height: number },
  groups: readonly AgeGroup[],
  bounds: { minSeconds?: number; maxSeconds?: number } = {},
): Rejection | null {
  const maxAllowed = Math.min(...groups.map((g) => AGE_GROUP_RULES[g].maxVideoSeconds), bounds.maxSeconds ?? Infinity);
  const minAllowed = Math.max(bounds.minSeconds ?? 0, 5);
  if (!(info.durationSeconds > 0)) return { reason: 'duration', detail: 'unknown length' };
  if (info.durationSeconds < minAllowed) return { reason: 'duration', detail: `${info.durationSeconds}s is shorter than ${minAllowed}s` };
  if (info.durationSeconds > maxAllowed) return { reason: 'duration', detail: `${info.durationSeconds}s is longer than ${maxAllowed}s` };
  if (Math.min(info.width, info.height) < 720 && Math.max(info.width, info.height) < 1280) {
    return { reason: 'resolution', detail: `${info.width}x${info.height} is below 720p` };
  }
  return null;
}
