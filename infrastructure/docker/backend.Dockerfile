FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate --schema prisma/schema.prisma

COPY tsconfig.json ./tsconfig.json
COPY src ./src
COPY scripts ./scripts
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/server.js"]
