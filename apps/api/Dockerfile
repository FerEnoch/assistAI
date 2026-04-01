FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared packages/shared
COPY apps/api apps/api

# --- Dev target ---
FROM base AS dev
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]

# --- Build target ---
FROM base AS build
WORKDIR /app/apps/api
RUN pnpm build

# --- Production target ---
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
