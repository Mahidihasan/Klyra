FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev
EXPOSE 4000
ENV PORT=4000
CMD ["npm", "start"]

FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm install
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
EXPOSE 4000
ENV PORT=4000
CMD ["npm", "run", "dev"]
