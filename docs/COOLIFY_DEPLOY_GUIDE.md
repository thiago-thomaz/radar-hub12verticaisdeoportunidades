# GUIA DE DEPLOY AUTOMÁTICO VIA COOLIFY (VPS DEPLOYMENT)

Este repositório foi 100% otimizado para deploy contínuo e sem fricção no **Coolify**, com arquitetura autônoma (zero n8n), container Docker multi-stage enxuto e healthcheck zero-downtime.

---

## 1. Configuração da Aplicação no Painel do Coolify

1. **Adicionar Recurso:**
   - No Dashboard do Coolify, clique em **+ Create Resource** ➔ **Public / Private Git Repository**.
   - Insira a URL do repositório: `https://github.com/thiago-thomaz/radar-hub12verticaisdeoportunidades.git`
   - Branch: `main`.

2. **Tipo de Build (Build Pack):**
   - Selecione **Dockerfile** (para a aplicação Cockpit autônoma) ou **Docker Compose** (caso queira subir Postgres, Redis e Observabilidade na mesma stack).
   - O repositório já conta com `Dockerfile` multi-stage com `dumb-init`, usuário não-root e healthcheck nativo.

3. **Portas e Rede:**
   - **Exposed Port:** `3000` (Porta nativa do Cockpit Web UI, API e WebSockets).
   - **Domains:** `https://radar.seu-dominio.com.br` (o Coolify gerencia automaticamente o certificado SSL via Traefik/Let's Encrypt).

4. **Healthcheck:**
   - **Healthcheck Path:** `/health`
   - **Healthcheck Port:** `3000`
   - **Intervalo:** 20 segundos
   - O endpoint responde `200 OK` garantindo deploys sem queda de conexão (Zero-Downtime Rolling Update).

---

## 2. Variáveis de Ambiente no Coolify (.env)

Copie e cole as variáveis no campo **Environment Variables** da aplicação no Coolify:

```env
NODE_ENV=production
PORT=3000
BASE_URL=https://radar.seu-dominio.com.br

# Banco de Dados PostgreSQL gerenciado pelo Coolify ou Container Local
DB_USER=radar_admin
DB_PASSWORD=sua_senha_segura_aqui
DB_HOST=postgres
DB_PORT=5432
DB_NAME=radar_hub_db
DATABASE_URL=postgres://radar_admin:sua_senha_segura_aqui@postgres:5432/radar_hub_db

# Cache Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_redis_aqui
REDIS_URL=redis://:sua_senha_redis_aqui@redis:6379

# Telegram Bot
TELEGRAM_BOT_TOKEN=seu_bot_token_telegram
TELEGRAM_VIP_CHANNEL_ID=-1001234567890
TELEGRAM_FREE_CHANNEL_ID=-1009876543210

# Discord Cockpit Alerts
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Gateways de Pagamento & Checkout 1-Clique
PIX_KEY=sua_chave_pix@empresa.com.br
PIX_RECEIVER_NAME=RADAR_HUB LTDA
PIX_CITY=SAO_PAULO
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-...
STRIPE_SECRET_KEY=sk_live_...

# Mensageria WhatsApp (WAHA)
WAHA_BASE_URL=http://waha:3000
WAHA_API_KEY=sua_chave_waha
WAHA_SESSION=default
WHATSAPP_VIP_GROUP_ID=120363012345678901@g.us
WHATSAPP_FREE_GROUP_ID=120363098765432109@g.us

# Backups Criptografados
BACKUP_STORAGE_TYPE=LOCAL
BACKUP_ENCRYPTION_KEY=sua_chave_aes_256_32_bytes_minimo!
```

---

## 3. Deploy Contínuo (Auto Deploy via Git Push)

- Ative a opção **Automatic Deployment** (Git Webhook) nas configurações da aplicação no Coolify.
- A cada `git push origin main`, o Coolify aciona o webhook, realiza o build multi-stage do container e executa o rollover sem downtime.

---

## 4. Endpoints de Verificação Pós-Deploy

- **Cockpit Web UI:** `https://radar.seu-dominio.com.br/`
- **Healthcheck:** `https://radar.seu-dominio.com.br/health` (HTTP 200)
- **Status do Orquestrador Nativo (18 Pipelines):** `https://radar.seu-dominio.com.br/api/orchestrator/status` (HTTP 200)
- **Documentação Swagger:** `https://radar.seu-dominio.com.br/api/docs`
- **Métricas Prometheus:** `https://radar.seu-dominio.com.br/metrics`
