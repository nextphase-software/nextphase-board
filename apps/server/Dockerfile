# SPDX-License-Identifier: Apache-2.0
FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9 AS build
WORKDIR /app
COPY . .
RUN npm ci --ignore-scripts --no-audit --no-fund && npm run build:server

FROM node:26.13.0-bookworm-slim@sha256:bc0a2afd3b74ce12222fc8bab99271e66257f021078f5f4a5d687a77d280c1d9
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/server/dist /app/dist
RUN mkdir -p /data/boards && chown -R node:node /data
USER node
EXPOSE 8788
CMD ["node", "dist/node.mjs"]
