FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY app/package.json app/pnpm-lock.yaml ./

RUN pnpm install

COPY app/ .

CMD ["pnpm", "start:dev"]
