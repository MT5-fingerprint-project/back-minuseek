FROM node:24-alpine AS base
#fix pnpm version to avoid pnpm11 post install script error on ci
RUN apk upgrade --no-cache
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .

RUN pnpm prisma:generate-tenant && pnpm prisma:generate-admin
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS production
ENV NODE_ENV=production
ENV SWAGGER_DOC=false
RUN apk upgrade --no-cache
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=prod-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build     --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build     --chown=nestjs:nodejs /app/package.json ./package.json
RUN chown nestjs:nodejs /app
USER nestjs
EXPOSE 3000
CMD ["node", "dist/src/main"]

# --- migration job, will run in a cloud run job in prod /dev ---

FROM build AS migration
ENV NODE_ENV=production
CMD ["pnpm", "prisma", "migrate", "deploy"]
