FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/entities/package.json packages/entities/package.json
RUN pnpm install

# Copy source
COPY packages/shared packages/shared
COPY packages/entities packages/entities
COPY apps/api apps/api

# --- Dev target ---
FROM base AS dev
WORKDIR /app
# Build everything (same as production build)
RUN pnpm --filter @assistai/shared build && \
    pnpm --filter @assistai/entities build && \
    pnpm --filter @assistai/api build
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]

# --- Build target ---
FROM base AS build
WORKDIR /app
# Build shared packages first (required for api to build)
RUN pnpm --filter @assistai/shared build && pnpm --filter @assistai/entities build
# Build the API
RUN pnpm --filter @assistai/api build
# Prune devDependencies at the workspace root
RUN CI=true pnpm prune --prod

# --- Production target ---
FROM node:20-alpine AS production
WORKDIR /app
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/entities/dist ./packages/entities/dist
COPY --from=build /app/packages/entities/package.json ./packages/entities/package.json
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
CMD ["node", "dist/main.js"]
