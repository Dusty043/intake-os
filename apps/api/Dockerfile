FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run api:prisma:generate
RUN npm run build:core
RUN npm run api:build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --schema apps/api/prisma/schema.prisma && node dist/apps/api/src/main.js"]
