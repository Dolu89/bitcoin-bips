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

# pandoc: the conversion service shells out to the binary. Pin a recent release rather
# than Debian's (bookworm ships 2.17, too old for `--syntax-highlighting` → every render
# fails). Keep this in sync with the dev pandoc version. tini: clean PID 1 for SIGTERM.
ARG PANDOC_VERSION=3.9.0.2
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini ca-certificates curl \
  && arch="$(dpkg --print-architecture)" \
  && curl -fsSL -o /tmp/pandoc.deb \
     "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-${arch}.deb" \
  && apt-get install -y --no-install-recommends /tmp/pandoc.deb \
  && apt-get purge -y curl \
  && apt-get autoremove -y \
  && rm -rf /tmp/pandoc.deb /var/lib/apt/lists/*

# The built app already carries its production node_modules.
COPY --from=build --chown=node:node /app/build ./

# Writable dir for the SQLite file (mounted as a named volume in compose).
RUN mkdir -p tmp && chown node:node tmp

USER node
EXPOSE 3333

# Apply pending migrations, then exec the server (exec → tini signals node directly).
ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "node ace migration:run --force && exec node bin/server.js"]
