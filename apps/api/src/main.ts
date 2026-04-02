import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root
config({ path: resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import Redis from 'ioredis';
import { doubleCsrf } from 'csrf-csrf';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { validateEnv, apiEnvSchema } from '@assistai/shared';

async function bootstrap() {
  const env = validateEnv(apiEnvSchema, process.env as Record<string, string | undefined>, {
    serviceName: 'api',
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const isProduction = env.NODE_ENV === 'production';

  // Trust proxy for __Host- cookie prefix (requires Secure flag)
  app.set('trust proxy', 1);

  // ──────────────────────────────────────────
  // Security headers (Helmet.js)
  // ──────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // For inline styles (Tailwind/Vite HMR)
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", env.WEB_URL],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: isProduction ? [] : ['upgrade-insecure-requests'],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow embedding (GraphQL Playground, etc.)
    }),
  );

  // ──────────────────────────────────────────
  // Redis client for sessions
  // ──────────────────────────────────────────
  const redisClient = new Redis(env.REDIS_URL, {
    keyPrefix: 'sess:',
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  // ──────────────────────────────────────────
  // Session middleware (express-session + connect-redis)
  // Per backlog §2.5: express-session@^1.18, connect-redis@^8
  // Cookie: __Host-assistai_sid (prod) / assistai_sid (dev), HttpOnly, Secure in prod, SameSite=Lax, 8h rolling
  // Note: __Host- prefix requires Secure flag, so we only use it in production
  // ──────────────────────────────────────────
  const sessionMiddleware = session({
    name: isProduction ? '__Host-assistai_sid' : 'assistai_sid',
    store: new RedisStore({
      client: redisClient,
      prefix: '', // keyPrefix already set on Redis client
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset maxAge on each request (rolling session)
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 28_800_000, // 8 hours in ms
      path: '/',
    },
  });

  app.use(sessionMiddleware);

  // ──────────────────────────────────────────
  // Cookie parser (required by csrf-csrf to read req.cookies)
  // Must be registered AFTER session but BEFORE CSRF middleware
  // ──────────────────────────────────────────
  app.use(cookieParser());

  // ──────────────────────────────────────────
  // CSRF protection (csrf-csrf — Double Submit Cookie + HMAC)
  // Per backlog §2.5: csrf-csrf@^3 (installed v4, compatible API)
  // Cookie: __Host-assistai_csrf (prod) / assistai_csrf (dev), HttpOnly:false for JS access, Secure in prod, SameSite=Lax
  // Client sends token in x-csrf-token header
  // GET/HEAD/OPTIONS excluded
  // ──────────────────────────────────────────
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    getSecret: () => env.CSRF_SECRET,
    getSessionIdentifier: (req: Request) => req.sessionID ?? '',
    cookieName: isProduction ? '__Host-assistai_csrf' : 'assistai_csrf',
    cookieOptions: {
      httpOnly: false, // Client JS needs to read this
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    },
    getCsrfTokenFromRequest: (req: Request) => req.headers['x-csrf-token'] as string | undefined,
  });

  // Store generateCsrfToken on app for use in controllers
  app.set('csrfGenerateToken', generateCsrfToken);

  // Apply CSRF protection — exempt pre-auth and safe methods
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Safe methods are excluded
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      return next();
    }

    // Exempt pre-auth endpoints (magic-link doesn't need CSRF — no session yet)
    const exemptPaths = ['/auth/magic-link', '/health'];
    if (exemptPaths.some((p) => req.path === p || req.path.startsWith(p))) {
      return next();
    }

    doubleCsrfProtection(req, res, next);
  });

  // ──────────────────────────────────────────
  // CORS
  // ──────────────────────────────────────────
  const corsOrigin = isProduction
    ? false // No CORS en producción (mismo origen)
    : env.WEB_URL;

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  });

  await app.listen(env.PORT_API);

  console.log(`[api] Running on port ${env.PORT_API} (${env.NODE_ENV})`);
}

bootstrap();
