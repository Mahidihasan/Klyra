FROM node:20-alpine AS base
WORKDIR /app

FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM base AS development
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm install
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY src ./src
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
