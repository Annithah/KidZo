import type { ContentStatus } from '@kidzo/shared';
import type { IconName } from './components/Icon';

/** Editorial actions, matching the API's /admin/content/:id/<action> routes. */
export type WorkflowAction = 'submit' | 'requestChanges' | 'publish' | 'unpublish' | 'archive' | 'restore';

interface ActionInfo {
  label: string;
  icon: IconName;
  toast: string;
  /** The main forward step for this status, shown as the primary button. */
  primary?: boolean;
}

export const ACTIONS: Record<WorkflowAction, ActionInfo> = {
  submit: { label: 'Send for review', icon: 'forward', toast: 'Sent for review.', primary: true },
  requestChanges: { label: 'Request changes', icon: 'back', toast: 'Sent back to drafts.' },
  publish: { label: 'Approve and publish', icon: 'publish', toast: 'Published. Families can see it now.', primary: true },
  unpublish: { label: 'Unpublish', icon: 'unpublish', toast: 'Unpublished. Hidden from families.' },
  archive: { label: 'Archive', icon: 'archive', toast: 'Archived.' },
  restore: { label: 'Restore to draft', icon: 'edit', toast: 'Restored to drafts.' },
};

/** Which actions each status allows, in button order. Mirrors the API's transition rules. */
export const ACTIONS_FOR: Record<ContentStatus, WorkflowAction[]> = {
  draft: ['submit', 'archive'],
  review: ['publish', 'requestChanges', 'archive'],
  published: ['unpublish'],
  unpublished: ['publish', 'archive'],
  archived: ['restore'],
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Draft',
  review: 'In review',
  published: 'Published',
  unpublished: 'Unpublished',
  archived: 'Archived',
};

/** Only content that never went live, or was archived, can be deleted (the API also checks play history). */
export const canDelete = (status: ContentStatus) => status !== 'published';
