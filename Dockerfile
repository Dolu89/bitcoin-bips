# syntax=docker/dockerfile:1

# ---- build stage: compile TS, bundle Vite assets, install production deps ----
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Toolchain for better-sqlite3's native build. Absent from the final image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install against the lockfile first (cached unless deps change), then build.
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN node ace build

# Reinstall production-only deps inside the build output. This recompiles
# better-sqlite3 on the same base as the runtime stage → ABI-compatible.
WORKDIR /app/build
RUN npm ci --omit=dev

# ---- runtime stage: slim image with pandoc + the built app ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pandoc: the conversion service shells out to the binary (not an npm package).
# tini: clean PID 1 so SIGTERM reaches node for a graceful shutdown.
RUN apt-get update \
  && apt-get install -y --no-install-recommends pandoc tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The built app already carries its production node_modules.
COPY --from=build --chown=node:node /app/build ./

# Writable dir for the SQLite file (mounted as a named volume in compose).
RUN mkdir -p tmp && chown node:node tmp

USER node
EXPOSE 3333

# Apply pending migrations, then exec the server (exec → tini signals node directly).
ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "node ace migration:run --force && exec node bin/server.js"]
