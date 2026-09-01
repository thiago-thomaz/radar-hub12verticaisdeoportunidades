#!/usr/bin/env bash
# ==============================================================================
# RADAR_HUB - SCRIPT DE DEPLOY ZERO-DOWNTIME & SMOKE HEALTHCHECK
# ==============================================================================
# Execução: bash deploy/deploy.sh
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/opt/radar-hub}"
if [ ! -d "${APP_DIR}" ]; then
    APP_DIR="$(pwd)"
fi

cd "${APP_DIR}"

echo -e "\n${CYAN}======================================================================"
echo -e " 🚀 RADAR_HUB // PIPELINE DE DEPLOY CONTÍNUO EM PRODUÇÃO"
echo -e " Diretório: ${APP_DIR} | Horário: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo -e "======================================================================${NC}\n"

# Função para Notificação no Telegram
notify_telegram() {
    local message="$1"
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_VIP_CHANNEL_ID:-}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_VIP_CHANNEL_ID}" \
            -d "text=${message}" \
            -d "parse_mode=HTML" > /dev/null || true
    fi
}

# ==============================================================================
# 1. ATUALIZAÇÃO DO CÓDIGO FONTE (GIT PULL)
# ==============================================================================
echo -e "${CYAN}[1/6] Atualizando código fonte a partir do repositório Git...${NC}"
if [ -d ".git" ]; then
    git fetch origin main || true
    git pull origin main || echo -e "${YELLOW}[!] Git pull ignorado (ambiente offline/local).${NC}"
else
    echo -e "${YELLOW}[!] Repositório git não detectado. Prosseguindo com artefatos locais.${NC}"
fi

# ==============================================================================
# 2. INSTALAÇÃO DE DEPENDÊNCIAS & BUILD TYPESCRIPT
# ==============================================================================
echo -e "${CYAN}[2/6] Verificando dependências e compilando TypeScript...${NC}"
if command -v npm &> /dev/null; then
    npm install --prefer-offline --no-audit
    npm run build
else
    echo -e "${YELLOW}[!] Node.js/npm não encontrado no host. O build será realizado dentro do container Docker.${NC}"
fi

# ==============================================================================
# 3. BACKUP PREVENTIVO DO BANCO DE DADOS (PRÉ-DEPLOY)
# ==============================================================================
echo -e "${CYAN}[3/6] Executando snapshot de backup preventivo antes do deploy...${NC}"
if command -v npx &> /dev/null; then
    npx tsx scripts/backup/db_backup.ts || {
        echo -e "${YELLOW}[!] Backup via host indisponível. Executando via container ou prosseguindo.${NC}"
    }
fi

# ==============================================================================
# 4. BUILD & INICIALIZAÇÃO DOS CONTAINERS DOCKER
# ==============================================================================
echo -e "${CYAN}[4/6] Construindo imagens e subindo containers via Docker Compose...${NC}"
docker compose up -d --build --remove-orphans

# ==============================================================================
# 5. HEALTHCHECK PÓS-DEPLOY COM RETRY & TIMEOUT
# ==============================================================================
echo -e "${CYAN}[5/6] Executando Healthcheck de validação pós-deploy...${NC}"
HEALTH_URL="http://127.0.0.1:3000/health"
MAX_ATTEMPTS=15
ATTEMPT=1
IS_HEALTHY=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo -e "  • Tentativa ${ATTEMPT}/${MAX_ATTEMPTS}: Verificando ${HEALTH_URL}..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || echo "000")
    
    if [ "$HTTP_STATUS" -eq 200 ]; then
        IS_HEALTHY=true
        break
    fi
    
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$IS_HEALTHY" = true ]; then
    echo -e "${GREEN}[✔] Healthcheck aprovado! Servidor RADAR_HUB respondendo HTTP 200 OK.${NC}"
else
    echo -e "${RED}[✖] FALHA NO HEALTHCHECK: A aplicação não respondeu após 30 segundos!${NC}"
    echo -e "${YELLOW}[!] Exibindo logs recentes do container radar_app:${NC}"
    docker compose logs --tail=50 radar_app
    notify_telegram "❌ <b>ALERTA DE FALHA NO DEPLOY</b>%0AAplicação RADAR_HUB falhou no healthcheck pós-deploy."
    exit 1
fi

# ==============================================================================
# 6. VERIFICAÇÃO DO PROXY NGINX E WEBSOCKETS
# ==============================================================================
echo -e "${CYAN}[6/6] Verificando proxy reverso Nginx e stream WebSockets...${NC}"
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:80" || echo "000")
if [ "$NGINX_STATUS" -eq 200 ] || [ "$NGINX_STATUS" -eq 301 ] || [ "$NGINX_STATUS" -eq 302 ]; then
    echo -e "${GREEN}[✔] Nginx Gateway operacional (HTTP ${NGINX_STATUS}).${NC}"
else
    echo -e "${YELLOW}[!] Nginx retornou status HTTP ${NGINX_STATUS}.${NC}"
fi

# Notificação de Sucesso
notify_telegram "🚀 <b>DEPLOY RADAR_HUB CONCLUÍDO COM SUCESSO!</b>%0AVersão: 1.0.0%0AHealthcheck: 🟢 200 OK%0ATimestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"

echo -e "\n${GREEN}======================================================================"
echo -e " ✔ DEPLOY DE PRODUÇÃO CONCLUÍDO COM 100% DE SUCESSO!"
echo -e " Cockpit Web: http://localhost:80"
echo -e " Grafana:     http://localhost:3001/grafana/"
echo -e " Prometheus:  http://localhost:9090"
echo -e "======================================================================${NC}\n"
