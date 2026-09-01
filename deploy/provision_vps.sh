#!/usr/bin/env bash
# ==============================================================================
# RADAR_HUB - SCRIPT DE PROVISIONAMENTO AUTOMATIZADO & HARDENING DA VPS
# ==============================================================================
# Compatibilidade: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS (x86_64 / ARM64)
# Execução: sudo bash deploy/provision_vps.sh
# ==============================================================================

set -euo pipefail

# Cores para feedback visual
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${CYAN}======================================================================"
echo -e " 🚀 RADAR_HUB // PROVISIONAMENTO & HARDENING DE VPS DE PRODUÇÃO"
echo -e "======================================================================${NC}\n"

# 1. Verificação de Permissões de Root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERRO] Este script precisa ser executado como root (sudo).${NC}"
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# ==============================================================================
# 2. ATUALIZAÇÃO DO SISTEMA & PACOTES ESSENCIAIS
# ==============================================================================
echo -e "${CYAN}[1/7] Atualizando repositórios e pacotes do sistema...${NC}"
apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"

echo -e "${CYAN}[2/7] Instalando utilitários essenciais e ferramentas de segurança...${NC}"
apt-get install -y \
    curl \
    wget \
    git \
    ufw \
    fail2ban \
    htop \
    jq \
    ca-certificates \
    gnupg \
    lsb-release \
    unattended-upgrades \
    certbot \
    python3-certbot-nginx

# Habilitar atualizações de segurança automáticas
dpkg-reconfigure -f noninteractive -p low unattended-upgrades

# ==============================================================================
# 3. INSTALAÇÃO DO DOCKER ENGINE & DOCKER COMPOSE PLUGIN
# ==============================================================================
echo -e "${CYAN}[3/7] Instalando Docker Engine & Docker Compose Plugin oficial...${NC}"
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}[✔] Docker instalado com sucesso: $(docker --version)${NC}"
else
    echo -e "${GREEN}[✔] Docker já instalado: $(docker --version)${NC}"
fi

# ==============================================================================
# 4. CONFIGURAÇÃO DE FIREWALL UFW (LEAST PRIVILEGE)
# ==============================================================================
echo -e "${CYAN}[4/7] Configurando regras de firewall UFW (Portas 22, 80 e 443)...${NC}"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Permitir SSH, HTTP e HTTPS
SSH_PORT="${SSH_PORT:-22}"
ufw allow "${SSH_PORT}/tcp" comment 'SSH Access'
ufw allow 80/tcp comment 'HTTP Nginx Gateway'
ufw allow 443/tcp comment 'HTTPS Nginx Gateway'

# Bloquear explicitamente portas internas de infraestrutura caso expostas
ufw deny 5432 comment 'Block direct PostgreSQL'
ufw deny 6379 comment 'Block direct Redis'
ufw deny 5678 comment 'Block direct n8n'
ufw deny 9090 comment 'Block direct Prometheus'
ufw deny 3000 comment 'Block direct Radar App'
ufw deny 3001 comment 'Block direct Grafana'

ufw --force enable
echo -e "${GREEN}[✔] Firewall UFW ativo e configurado.${NC}"

# ==============================================================================
# 5. HARDENING DO SERVIÇO SSH & FAIL2BAN
# ==============================================================================
echo -e "${CYAN}[5/7] Aplicando Hardening SSH e proteção Fail2ban contra força bruta...${NC}"

mkdir -p /etc/ssh/sshd_config.d
cat << 'EOF' > /etc/ssh/sshd_config.d/99-radar-hardening.conf
# Hardening de Segurança SSH - RADAR_HUB
PermitRootLogin prohibit-password
PasswordAuthentication no
ChallengeResponseAuthentication no
MaxAuthTries 3
X11Forwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
Banner none
EOF

# Reiniciar SSH com fallback seguro
if systemctl is-active --quiet ssh; then
    systemctl restart ssh
elif systemctl is-active --quiet sshd; then
    systemctl restart sshd
fi

# Configuração do Fail2ban
cat << 'EOF' > /etc/fail2ban/jail.local
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 3
backend  = auto

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port    = http,https
filter  = nginx-http-auth

[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
maxretry = 2
EOF

systemctl enable fail2ban
systemctl restart fail2ban
echo -e "${GREEN}[✔] Hardening SSH e Fail2ban configurados com sucesso.${NC}"

# ==============================================================================
# 6. CONFIGURAÇÃO DE SWAP FILE OTIMIZADO (4GB, SWAPPINESS 10)
# ==============================================================================
echo -e "${CYAN}[6/7] Otimizando memória virtual (Swapfile de 4GB)...${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo -e "${GREEN}[✔] Swapfile de 4GB criado e ativado.${NC}"
else
    echo -e "${GREEN}[✔] Swapfile já existente.${NC}"
fi

# ==============================================================================
# 7. TUNING DE KERNEL SYSCTL (ALTA CONCORRÊNCIA & I/O)
# ==============================================================================
echo -e "${CYAN}[7/7] Aplicando parâmetros de kernel otimizados (sysctl)...${NC}"
cat << 'EOF' > /etc/sysctl.d/99-radar-tuning.conf
# Tuning para Alta Concorrência, WebSockets e Redis/TimescaleDB
vm.max_map_count = 262144
fs.file-max = 2097152
net.core.somaxconn = 65535
vm.overcommit_memory = 1
vm.swappiness = 10
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
EOF

sysctl --system > /dev/null
echo -e "${GREEN}[✔] Parâmetros de kernel aplicados.${NC}"

# ==============================================================================
# CRIAÇÃO DO DIRETÓRIO BASE DA APLICAÇÃO
# ==============================================================================
mkdir -p /opt/radar-hub
mkdir -p /opt/radar-hub/backups
mkdir -p /opt/radar-hub/nginx/certs

echo -e "\n${GREEN}======================================================================"
echo -e " ✔ PROVISIONAMENTO E HARDENING DA VPS CONCLUÍDOS COM SUCESSO!"
echo -e " Diretório base: /opt/radar-hub"
echo -e " Portas abertas: 22 (SSH), 80 (HTTP), 443 (HTTPS)"
echo -e "======================================================================${NC}\n"
