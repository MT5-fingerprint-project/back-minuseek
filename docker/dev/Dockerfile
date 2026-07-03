FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY app/package.json app/pnpm-lock.yaml ./

RUN pnpm install --ignore-scripts

COPY app/ .


RUN pnpm prisma:generate-tenant && pnpm prisma:generate-admin


CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma:generate-tenant && pnpm prisma:generate-admin && pnpm start:dev"]
