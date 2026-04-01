FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared packages/shared
COPY apps/worker apps/worker

# --- Dev target ---
FROM base AS dev
WORKDIR /app/apps/worker
CMD ["pnpm", "dev"]

# --- Build target ---
FROM base AS build
WORKDIR /app/apps/worker
RUN pnpm build
# Prune devDependencies before copying to production
RUN pnpm prune --prod

# --- Production target ---
FROM node:20-alpine AS production
WORKDIR /app
# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=build /app/apps/worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3001
CMD ["node", "dist/main.js"]
