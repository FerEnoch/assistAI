FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared packages/shared
COPY apps/web apps/web

# --- Dev target ---
FROM base AS dev
WORKDIR /app/apps/web
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# --- Build target ---
FROM base AS build
WORKDIR /app/apps/web
RUN pnpm build

# --- Production target ---
FROM nginx:1.27-alpine AS production
# Create non-root user and configure nginx to run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /usr/share/nginx/html \
    && chown -R appuser:appgroup /var/cache/nginx \
    && touch /var/run/nginx.pid \
    && chown appuser:appgroup /var/run/nginx.pid
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER appuser
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
