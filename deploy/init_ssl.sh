#!/usr/bin/env bash
# ==============================================================================
# RADAR_HUB - AUTOMAÇÃO DE CERTIFICADOS SSL / LET'S ENCRYPT
# ==============================================================================
# Suporte a certificados autoassinados para bootstrap e emissão automática
# com renovação diária via Certbot e reload do container Nginx.
# ==============================================================================

set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DOMAIN="${1:-${DOMAIN:-localhost}}"
EMAIL="${2:-${SSL_EMAIL:-admin@radarhub.local}}"
CERTS_DIR="./nginx/certs"

echo -e "\n${CYAN}======================================================================"
echo -e " 🔒 RADAR_HUB // AUTOMAÇÃO & GESTÃO DE CERTIFICADOS SSL/TLS"
echo -e " Domínio: ${DOMAIN} | Contato: ${EMAIL}"
echo -e "======================================================================${NC}\n"

mkdir -p "${CERTS_DIR}"

# 1. Geração de Parâmetros Diffie-Hellman (DHParam 2048-bit)
if [ ! -f "${CERTS_DIR}/dhparam.pem" ]; then
    echo -e "${CYAN}[1/3] Gerando parâmetros Diffie-Hellman (dhparam.pem)...${NC}"
    openssl dhparam -out "${CERTS_DIR}/dhparam.pem" 2048
    echo -e "${GREEN}[✔] dhparam.pem gerado com sucesso.${NC}"
else
    echo -e "${GREEN}[✔] dhparam.pem já existente.${NC}"
fi

# 2. Geração de Certificado Autoassinado para Bootstrap
if [ ! -f "${CERTS_DIR}/fullchain.pem" ] || [ ! -f "${CERTS_DIR}/privkey.pem" ]; then
    echo -e "${CYAN}[2/3] Gerando certificado SSL autoassinado de fallback...${NC}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${CERTS_DIR}/privkey.pem" \
        -out "${CERTS_DIR}/fullchain.pem" \
        -subj "/C=BR/ST=SP/L=Bauru/O=RADAR_HUB/OU=Security/CN=${DOMAIN}"
    echo -e "${GREEN}[✔] Certificados de bootstrap criados em ${CERTS_DIR}.${NC}"
fi

# 3. Emissão Real com Let's Encrypt (Se domínio público for informado)
if [[ "${DOMAIN}" != "localhost" && "${DOMAIN}" != "radarhub.local" && "${DOMAIN}" =~ \. ]]; then
    echo -e "${CYAN}[3/3] Solicitando certificado oficial Let's Encrypt via Certbot...${NC}"
    
    if command -v certbot &> /dev/null; then
        certbot certonly --standalone \
            --preferred-challenges http \
            --agree-tos \
            --no-eff-email \
            --email "${EMAIL}" \
            -d "${DOMAIN}" \
            --non-interactive || {
                echo -e "${YELLOW}[!] Falha ao emitir via Certbot standalone. Mantendo certificados autoassinados.${NC}"
            }

        # Se o certificado foi gerado no /etc/letsencrypt, copia para o volume do Nginx
        if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
            cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "${CERTS_DIR}/fullchain.pem"
            cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "${CERTS_DIR}/privkey.pem"
            echo -e "${GREEN}[✔] Certificados oficiais Let's Encrypt instalados com sucesso!${NC}"
        fi
    fi

    # Configuração de Cronjob Diário de Renovação Automática
    if [ "$EUID" -eq 0 ]; then
        cat << 'EOF' > /etc/cron.daily/radar-ssl-renew
#!/usr/bin/env bash
if command -v certbot &> /dev/null; then
    certbot renew --quiet --post-hook "docker compose -f /opt/radar-hub/docker-compose.yml exec -T nginx nginx -s reload || true"
fi
EOF
        chmod +x /etc/cron.daily/radar-ssl-renew
        echo -e "${GREEN}[✔] Rotina diária de renovação SSL (/etc/cron.daily/radar-ssl-renew) configurada.${NC}"
    fi
else
    echo -e "${YELLOW}[i] Domínio '${DOMAIN}' é local. Usando certificado autoassinado de alta segurança.${NC}"
fi

echo -e "\n${GREEN}✔ Configuração de SSL/TLS concluída com sucesso.${NC}\n"
