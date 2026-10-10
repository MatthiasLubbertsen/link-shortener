# syntax=docker/dockerfile:1

# ---- builder: install deps and build the Nitro server ----
FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- runtime: only the built server ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

# Nitro's output bundles its own minimal node_modules, including libsql.
COPY --from=builder /app/.output ./.output

# Keep the SQLite file in a volume, owned by the non-root "node" user.
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
