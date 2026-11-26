import type { FastifyError, FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { friendlyMessage } from '@kidzo/shared';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in again') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

/** Validates untrusted input with Zod and throws a 400 with field level details on failure. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Some fields need attention',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: friendlyMessage(i as Parameters<typeof friendlyMessage>[0]) })),
    );
  }
  return result.data;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError | Error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled error');
      return reply.status(500).send({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
    }
    const code = 'code' in error && typeof error.code === 'string' ? error.code : 'REQUEST_ERROR';
    return reply.status(statusCode).send({ error: { code, message: error.message } });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}
