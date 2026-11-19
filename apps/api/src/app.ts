import { mkdirSync } from 'node:fs';
import path from 'node:path';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { MAX_UPLOAD_BYTES } from '@kidzo/shared';
import type { Config } from './config';
import type { Db } from './db/client';
import { registerErrorHandler } from './lib/errors';
import { ConsoleMailer, type Mailer } from './lib/mailer';
import { LocalDiskStorage, type MediaStorage } from './lib/storage';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { catalogRoutes } from './routes/catalog';
import { childRoutes } from './routes/children';
import { guestRoutes } from './routes/guest';
import { meRoutes } from './routes/me';
import { sessionRoutes } from './routes/sessions';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
    config: Config;
    storage: MediaStorage;
    mailer: Mailer;
  }
}

export interface BuildAppOptions {
  config: Config;
  db: Db;
  storage?: MediaStorage;
  mailer?: Mailer;
}

export async function buildApp({ config, db, storage, mailer }: BuildAppOptions): Promise<FastifyInstance> {
  const isDev = config.NODE_ENV === 'development';
  const app = Fastify({
    logger:
      config.NODE_ENV === 'test'
        ? false
        : {
            level: config.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.body.password', 'req.body.pin', 'req.body.refreshToken'],
            ...(isDev ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } } : {}),
          },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: config.NODE_ENV === 'production',
  });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('storage', storage ?? new LocalDiskStorage(path.resolve(config.UPLOAD_DIR), config.PUBLIC_BASE_URL));

  app.decorate('mailer', mailer ?? new ConsoleMailer(app.log, config.NODE_ENV === 'production'));
  mkdirSync(path.resolve(config.UPLOAD_DIR), { recursive: true });
  registerErrorHandler(app);
  await app.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    origin: (origin, cb) => {
      // Native apps send no Origin header.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    enableDraftSpec: true,
    ...(config.NODE_ENV === 'test' ? { allowList: () => process.env.KIDZO_TEST_RATE_LIMIT !== '1' } : {}),
  });
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { algorithm: 'HS256' }, verify: { algorithms: ['HS256'] } });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  await app.register(fastifyStatic, {
    root: path.resolve(config.UPLOAD_DIR),
    prefix: '/media/',
    decorateReply: false,
    maxAge: '7d',
    immutable: true,
  });

  app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(childRoutes);
  await app.register(guestRoutes);
  await app.register(catalogRoutes);
  await app.register(sessionRoutes);
  await app.register(adminRoutes);

  return app;
}
