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

RUN pnpm prune --prod --ignore-scripts

FROM node:24-alpine AS production
ENV NODE_ENV=production
ENV SWAGGER_DOC=false
RUN apk upgrade --no-cache
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/prisma-admin ./prisma-admin
COPY --from=build --chown=nestjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=nestjs:nodejs /app/prisma-admin.config.ts ./prisma-admin.config.ts
COPY --from=build --chown=nestjs:nodejs /app/scripts ./scripts
RUN chown nestjs:nodejs /app
USER nestjs
EXPOSE 3000
CMD ["node", "dist/src/main"]

# --- migration job, will run in a cloud run job in prod /dev ---

FROM build AS migration
ENV NODE_ENV=production

# Migre le schéma admin puis fan-out du schéma métier sur chaque base tenant
# du registre (docs/multitenancy.md).
CMD ["sh", "scripts/migrate-all.sh"]
