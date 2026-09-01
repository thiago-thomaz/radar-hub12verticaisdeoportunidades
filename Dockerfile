FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY engine ./engine
COPY dashboard ./dashboard
COPY scripts ./scripts
COPY server.ts ./

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --only=production && npm install -g tsx

COPY --from=builder /app ./

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
