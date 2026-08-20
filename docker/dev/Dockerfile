FROM node:22-alpine

RUN corepack enable

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY app/package.json app/pnpm-lock.yaml ./

RUN pnpm install --ignore-scripts

COPY app/ .


RUN pnpm prisma:generate-tenant && pnpm prisma:generate-admin


CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma:generate-tenant && pnpm prisma:generate-admin && pnpm start:dev"]
