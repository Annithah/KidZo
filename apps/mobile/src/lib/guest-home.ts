import type { ContentSummary } from '@kidzo/shared';

type GuestStory = Pick<ContentSummary, 'id' | 'type'>;

export function firstGuestStory<T extends GuestStory>(items: readonly T[]): T | null {
  return items.find((item) => item.type === 'adventure') ?? items.find((item) => item.type === 'story') ?? null;
}
