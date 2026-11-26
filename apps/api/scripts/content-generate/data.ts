import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ART, parseArtKey } from '@kidzo/art';
import { AGE_GROUPS, AGE_GROUP_RULES, CATEGORY_KEYS, SKILLS } from '@kidzo/shared';
import { WORLD_COLORS } from '@kidzo/ui-tokens';
import { assertCategory, CONTENT_DIR, readJsonFile } from '../lib/plan-common';

const artKey = z.string().refine((v) => ART.has(parseArtKey(v).key), { message: 'unknown art key' });

const sceneSchema = z.object({
  art: artKey,
  /** What Zo says (narrated and shown as a caption). */
  say: z.string().min(1).max(400),
  /** Short on-screen label under the picture. */
  show: z.string().max(40).optional(),
  /** Big on-screen text beside the picture: a number, a letter, a sum. */
  big: z.string().max(24).optional(),
});

const quizSchema = z.object({
  prompt: z.string().min(3).max(200),
  art: artKey,
  options: z.array(z.object({ label: z.string().min(1).max(60), art: artKey })).min(2).max(4),
  /** Index of the right option. */
  answer: z.number().int().min(0).max(3),
  /** Said by Zo after a wrong answer. */
  explanation: z.string().min(3).max(300),
});

export const generatedVideoSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(80),
  summary: z.string().min(2).max(200),
  ageGroup: z.enum(AGE_GROUPS),
  world: z.enum(WORLD_COLORS).optional(),
  scenes: z.array(sceneSchema).min(2).max(20),
  quiz: z.array(quizSchema).min(1).max(4),
});
export type GeneratedVideo = z.infer<typeof generatedVideoSchema>;

export const topicSchema = z.object({
  topic: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(CATEGORY_KEYS),
  skills: z.array(z.enum(SKILLS)).min(1).max(4),
  art: artKey,
  calm: z.boolean().default(false),
  videos: z.array(generatedVideoSchema).min(1),
});
export type Topic = z.infer<typeof topicSchema>;

export const GENERATE_DIR = path.join(CONTENT_DIR, 'generate');

/** Age rules a generated video must follow: answer count per question for its group. */
export function videoProblems(v: GeneratedVideo): string[] {
  const rule = AGE_GROUP_RULES[v.ageGroup];
  const out: string[] = [];
  v.quiz.forEach((q, i) => {
    if (q.options.length < rule.minOptions || q.options.length > rule.maxOptions) {
      out.push(`${v.id} question ${i + 1}: ${rule.label} need ${rule.minOptions === rule.maxOptions ? rule.minOptions : `${rule.minOptions} to ${rule.maxOptions}`} answers, found ${q.options.length}`);
    }
    if (q.answer >= q.options.length) out.push(`${v.id} question ${i + 1}: answer ${q.answer} is not an option`);
    if (new Set(q.options.map((o) => o.label)).size !== q.options.length) out.push(`${v.id} question ${i + 1}: answers repeat`);
  });
  return out;
}

/** Reads and checks every content/generate/*.json file. Throws on the first broken file. */
export async function loadTopics(dir = GENERATE_DIR): Promise<Topic[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const topics: Topic[] = [];
  const ids = new Set<string>();
  for (const file of files) {
    const topic = await readJsonFile(path.join(dir, file), topicSchema);
    assertCategory({ id: topic.topic, category: topic.category, skills: topic.skills, calm: topic.calm });
    for (const v of topic.videos) {
      if (ids.has(v.id)) throw new Error(`Video id "${v.id}" is used twice`);
      ids.add(v.id);
      const problems = videoProblems(v);
      if (problems.length) throw new Error(`${file}: ${problems.join('; ')}`);
    }
    topics.push(topic);
  }
  return topics;
}
