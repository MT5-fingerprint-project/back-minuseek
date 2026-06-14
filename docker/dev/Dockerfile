FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY app/package.json app/pnpm-lock.yaml ./

RUN pnpm install --ignore-scripts

COPY app/ .

RUN pnpm prisma generate

# Au démarrage : applique les migrations à la DB, régénère le client Prisma
# (le dossier generated/ étant bind-monté, l'hôte est mis à jour aussi), puis lance l'app
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma generate && pnpm start:dev"]
