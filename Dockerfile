# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS web-build
COPY app.json tsconfig.json ./
COPY src ./src
COPY shared ./shared
COPY assets ./assets
ENV CI=1 EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_SAME_ORIGIN=true
RUN npm run export:web

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production PORT=3001 SEED_DEMO=false
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/*.mjs ./server/
COPY server/discovery ./server/discovery
COPY server/migrations ./server/migrations
COPY server/certs/prod-ca-2021.crt ./server/certs/prod-ca-2021.crt
COPY shared ./shared
COPY scripts/grant-admin.mjs ./scripts/grant-admin.mjs
COPY deploy/entrypoint.mjs ./deploy/entrypoint.mjs
RUN mkdir -p server/data/uploads && chown -R node:node server/data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=8s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/ready',{signal:AbortSignal.timeout(5000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "deploy/entrypoint.mjs"]

FROM nginx:1.28-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/dist /usr/share/nginx/html
RUN nginx -t
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
