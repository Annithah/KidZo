import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ageGroupFor, CHILD_TOKEN_HEADER, type AgeGroup } from '@kidzo/shared';
import { AppError, forbidden } from './errors';
import { getOwnedChild, type ChildRow } from './usage';

/** How long a child-scoped token lasts. The app asks for a new one when a profile is opened. */
export const CHILD_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export interface ChildScope {
  child: ChildRow;
  timezone: string;
  group: AgeGroup;
}

/**
 * Signs a token naming one child of the signed-in parent. Kid endpoints read the child (and so
 * the age group) from this token, never from a request parameter.
 */
export function issueChildToken(app: FastifyInstance, parentId: string, childId: string): { token: string; expiresAt: string } {
  const token = app.jwt.sign({ sub: parentId, role: 'parent', scope: 'child', childId }, { expiresIn: CHILD_TOKEN_TTL_SECONDS });
  return { token, expiresAt: new Date(Date.now() + CHILD_TOKEN_TTL_SECONDS * 1000).toISOString() };
}

const childTokenError = (message: string) => new AppError(401, 'CHILD_TOKEN_INVALID', message);

/**
 * The child this request acts for, from the child header, or null when the header is absent
 * (a parent acting in the parent area). The token must belong to the signed-in parent.
 */
export async function getChildScope(request: FastifyRequest): Promise<ChildScope | null> {
  const raw = request.headers[CHILD_TOKEN_HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token) return null;
  let payload: { sub: string; scope?: string; childId?: string };
  try {
    payload = request.server.jwt.verify(token);
  } catch {
    throw childTokenError('Open the child profile again');
  }
  if (payload.scope !== 'child' || !payload.childId) throw childTokenError('Open the child profile again');
  if (payload.sub !== request.user.sub) throw forbidden();
  const { child, timezone } = await getOwnedChild(request.server.db, request.user.sub, payload.childId);
  return { child, timezone, group: ageGroupFor(child.age) };
}

/** Like getChildScope, but the request must act for a child. */
export async function requireChildScope(request: FastifyRequest): Promise<ChildScope> {
  const scope = await getChildScope(request);
  if (!scope) throw new AppError(401, 'CHILD_TOKEN_REQUIRED', 'Choose who is playing first');
  return scope;
}

/** A childId in the request may only repeat the token's child. */
export function assertSameChild(scope: ChildScope, childId: string | undefined): void {
  if (childId !== undefined && childId !== scope.child.id) throw forbidden();
}
