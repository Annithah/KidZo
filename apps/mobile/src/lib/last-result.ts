import type { ContentDetail } from '@kidzo/shared';
import type { FinishResult } from './play-session';

/** Hands the finished session from the player to the celebration and replay screens. */
export interface LastResult extends FinishResult {
  content: ContentDetail;
  path: string[];
  childId: string;
}

let last: LastResult | null = null;

export const setLastResult = (result: LastResult) => {
  last = result;
};

export const getLastResult = (): LastResult | null => last;
