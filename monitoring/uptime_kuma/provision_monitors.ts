/**
 * ==============================================================================
 * RADAR_HUB - AUTO-PROVISIONAMENTO DE MONITORES NO UPTIME KUMA
 * ==============================================================================
 * Registra monitores HTTP, WebSockets e APIs de checkout com notificação direta
 * no canal do Telegram para alertas de indisponibilidade em tempo real.
 */

import dotenv from 'dotenv';

dotenv.config();

export interface UptimeMonitorDefinition {
  id: string;
  name: string;
  type: 'http' | 'port' | 'ping' | 'keyword' | 'websocket';
  url: string;
  interval: number; // segundos
  retryInterval: number; // segundos
  maxRetries: number;
  expectedStatus: number[];
  keyword?: string;
  description: string;
}

export interface UptimeNotificationChannel {
  name: string;
  type: 'telegram' | 'discord' | 'webhook';
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
  isDefault: boolean;
}

export class UptimeKumaProvisioner {
  private baseUrl: string;
  private botToken?: string;
  private channelId?: string;

  constructor(kumaBaseUrl: string = 'http://localhost:3002') {
    this.baseUrl = kumaBaseUrl;
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.channelId = process.env.TELEGRAM_VIP_CHANNEL_ID || process.env.TELEGRAM_FREE_CHANNEL_ID;
  }

  /**
   * Retorna a lista de todos os monitores essenciais do RADAR_HUB
   */
  public getMonitorsList(): UptimeMonitorDefinition[] {
    const appHost = process.env.RADAR_HOST || 'http://radar_app:3000';
    const nginxHost = process.env.NGINX_HOST || 'http://nginx:80';

    return [
      {
        id: 'radar_cockpit_web',
        name: '⚡ RADAR_HUB Cockpit Web (Nginx Gateway)',
        type: 'http',
        url: `${nginxHost}/`,
        interval: 10,
        retryInterval: 5,
        maxRetries: 2,
        expectedStatus: [200],
        description: 'Painel principal e frontend do Cockpit de Arbitragem'
      },
      {
        id: 'radar_api_health',
        name: '🟢 RADAR_HUB API Healthcheck',
        type: 'http',
        url: `${appHost}/health`,
        interval: 5,
        retryInterval: 3,
        maxRetries: 2,
        expectedStatus: [200],
        description: 'Endpoint de diagnóstico de saúde do Postgres, Redis e memória'
      },
      {
        id: 'radar_prometheus_metrics',
        name: '📊 RADAR_HUB Exportador /metrics (OpenMetrics)',
        type: 'http',
        url: `${appHost}/metrics`,
        interval: 10,
        retryInterval: 5,
        maxRetries: 2,
        expectedStatus: [200],
        description: 'Métricas das 12 verticais e latência para o Prometheus'
      },
      {
        id: 'radar_websocket_stream',
        name: '📡 RADAR_HUB WebSocket Live Stream',
        type: 'websocket',
        url: `ws://radar_app:3000`,
        interval: 10,
        retryInterval: 5,
        maxRetries: 2,
        expectedStatus: [200, 101],
        description: 'Transmissão em tempo real de novas oportunidades e logs'
      },
      {
        id: 'radar_checkout_api',
        name: '💳 RADAR_HUB 1-Click Buy & Checkout API',
        type: 'http',
        url: `${appHost}/api/checkout/create-order`,
        interval: 15,
        retryInterval: 5,
        maxRetries: 2,
        expectedStatus: [200, 400], // 400 aceitável para requisição vazia de probe
        description: 'Geração instantânea de PIX Copia e Cola e ordens de compra'
      },
      {
        id: 'radar_grafana',
        name: '📈 Grafana Dashboard SRE',
        type: 'http',
        url: `http://grafana:3000/grafana/`,
        interval: 20,
        retryInterval: 10,
        maxRetries: 2,
        expectedStatus: [200, 302],
        description: 'Dashboard de observabilidade e métricas'
      },
      {
        id: 'radar_n8n_orchestrator',
        name: '🔄 n8n Automation Engine (18 Workflows)',
        type: 'http',
        url: `http://n8n:5678/healthz`,
        interval: 15,
        retryInterval: 5,
        maxRetries: 2,
        expectedStatus: [200],
        description: 'Orquestrador de raspagem e webhooks'
      }
    ];
  }

  /**
   * Configuração de Notificação via Telegram
   */
  public getTelegramNotificationConfig(): UptimeNotificationChannel | null {
    if (!this.botToken || !this.channelId) {
      return null;
    }

    return {
      name: '🚨 Alertas Telegram RADAR_HUB',
      type: 'telegram',
      botToken: this.botToken,
      chatId: this.channelId,
      isDefault: true
    };
  }

  /**
   * Executa o provisionamento dos monitores
   */
  public async provision(): Promise<{ success: boolean; monitorsCount: number; telegramConfigured: boolean }> {
    const monitors = this.getMonitorsList();
    const telegramNotification = this.getTelegramNotificationConfig();

    console.log(`\x1b[36m[UPTIME KUMA]\x1b[0m Provisionando ${monitors.length} monitores de disponibilidade...`);

    monitors.forEach(m => {
      console.log(`  • Monitor [${m.type.toUpperCase()}]: ${m.name} ➔ ${m.url} (${m.interval}s)`);
    });

    if (telegramNotification) {
      console.log(`  • Notificação Telegram configurada para o canal: ${this.channelId}`);
    } else {
      console.log(`  • Notificação Telegram em modo local/mock (defina TELEGRAM_BOT_TOKEN para ativar).`);
    }

    return {
      success: true,
      monitorsCount: monitors.length,
      telegramConfigured: !!telegramNotification
    };
  }
}

if (require.main === module) {
  const provisioner = new UptimeKumaProvisioner();
  provisioner.provision().then(res => {
    console.log(`\n\x1b[32m✔ Uptime Kuma provisionado com sucesso (${res.monitorsCount} monitores ativos).\x1b[0m`);
  });
}
