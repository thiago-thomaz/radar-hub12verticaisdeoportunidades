# ==============================================================================
# RADAR_HUB — PRODUCTION MULTI-STAGE DOCKERFILE (COOLIFY / VPS READY)
# ==============================================================================
# - Multi-stage build otimizado com cache de dependências
# - Imagem enxuta baseada em Alpine Linux
# - Execução segura sob usuário não-root (node)
# - Tratamento adequado de sinais POSIX (SIGTERM/SIGINT) via dumb-init
# - Healthcheck integrado compatível com monitoramento do Coolify
# ==============================================================================

# --- ESTÁGIO 1: Dependências de Build ---
FROM node:20-alpine AS deps
WORKDIR /app

# Instala ferramentas necessárias para compilação nativa se houver
RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# --- ESTÁGIO 2: Build da Aplicação ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY engine ./engine
COPY dashboard ./dashboard
COPY scripts ./scripts
COPY monitoring ./monitoring
COPY database ./database
COPY server.ts ./

# Compila o TypeScript para JavaScript nativo em dist/
RUN npm run build && cp -r dashboard dist/dashboard

# Limpa dependências de desenvolvimento para o runner
RUN npm prune --production

# --- ESTÁGIO 3: Runner de Produção (Coolify Deployment Target) ---
FROM node:20-alpine AS runner
WORKDIR /app

# Instala dumb-init para propagação correta de sinais SIGTERM/SIGINT
RUN apk add --no-cache dumb-init wget

ENV NODE_ENV=production
ENV PORT=3000

# Cria diretórios necessários e ajusta permissões para o usuário node
RUN mkdir -p /app/storage /app/backups /app/dist && \
    chown -R node:node /app

# Copia dependências de produção e artefatos compilados
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/dashboard ./dashboard
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/monitoring ./monitoring
COPY --from=builder --chown=node:node /app/database ./database

# Troca para usuário sem privilégios (Segurança OWASP / Docker Hardening)
USER node

EXPOSE 3000

# Healthcheck nativo para o orquestrador do Coolify
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]
