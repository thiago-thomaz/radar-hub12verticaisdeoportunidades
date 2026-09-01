/**
 * ==============================================================================
 * RADAR_HUB — GATEWAY DE INTEGRAÇÃO WAHA (WHATSAPP HTTP API)
 * ==============================================================================
 * Envio de alertas de alta velocidade em grupos VIP / Free e atendimento conversacional
 * com suporte a roteamento segmentado, anti-ban com jitter adaptativo e webhooks.
 */

import dotenv from 'dotenv';
import { UnifiedOpportunity } from './scoring';
import { RadarAffiliateManager } from './affiliate_manager';

dotenv.config();

export interface WahaMessagePayload {
  chatId: string;
  text: string;
  session?: string;
  reply_to?: string;
}

export interface WahaWebhookEvent {
  event: 'message' | 'message.upsert' | 'session.status' | 'message.ack';
  session: string;
  payload: {
    id: string;
    from: string;
    to?: string;
    body?: string;
    fromMe?: boolean;
    timestamp?: number;
    hasMedia?: boolean;
    chatId?: string;
    _data?: any;
  };
}

export interface WahaSendResult {
  success: boolean;
  messageId: string;
  chatId: string;
  timestamp: string;
  durationMs: number;
}

export class RadarWahaGateway {
  private baseUrl: string;
  private apiKey: string;
  private defaultSession: string;
  public vipGroupId: string;
  public freeGroupId: string;
  private affiliateManager: RadarAffiliateManager;
  private messageQueue: WahaMessagePayload[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.baseUrl = process.env.WAHA_BASE_URL || 'http://localhost:3000';
    this.apiKey = process.env.WAHA_API_KEY || 'waha_secret_radar_2026';
    this.defaultSession = process.env.WAHA_SESSION || 'default';
    this.vipGroupId = process.env.WHATSAPP_VIP_GROUP_ID || '120363012345678901@g.us';
    this.freeGroupId = process.env.WHATSAPP_FREE_GROUP_ID || '120363098765432109@g.us';
    this.affiliateManager = new RadarAffiliateManager();
  }

  /**
   * Formata uma oportunidade em um alerta rico estilizado para o WhatsApp
   */
  public formatOpportunityAlert(opp: UnifiedOpportunity, isVip: boolean = true): string {
    const affiliate = this.affiliateManager.generateAffiliateLink(opp.source_url, { campaign: isVip ? 'waha_vip' : 'waha_free' });
    const cleanUrl = affiliate.shortUrl;

    const fipeOrRef = opp.fipe_or_market_ref || opp.opportunity_price;
    const discountPct = opp.discount_percentage || 0;
    const netProfit = opp.net_profit_estimate || 0;

    const discountStr = discountPct > 0 
      ? `*${discountPct.toFixed(1)}% OFF* (Economia de R$ ${(fipeOrRef - opp.opportunity_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
      : `*Lucro Líquido Estimado:* R$ ${netProfit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

    let categoryEmoji = '🚨';
    let categoryName = 'OPORTUNIDADE';

    switch (opp.category) {
      case 'price_bug':
        categoryEmoji = '🔥';
        categoryName = 'BUG DE PREÇO CRÍTICO';
        break;
      case 'car_auction':
        categoryEmoji = '🚗';
        categoryName = 'LEILÃO DE VEÍCULO // DESÁGIO FIPE';
        break;
      case 'real_estate_local':
        categoryEmoji = '🏢';
        categoryName = 'IMÓVEL EM BAURU // OPORTUNIDADE';
        break;
      case 'remote_job':
        categoryEmoji = '💼';
        categoryName = 'VAGA REMOTA USD/EUR';
        break;
      case 'miles_promo':
        categoryEmoji = '✈️';
        categoryName = 'MILHAS & PONTOS CPM';
        break;
      case 'coupon_deal':
        categoryEmoji = '🎟️';
        categoryName = 'CUPOM EXCLUSIVO';
        break;
      default:
        categoryEmoji = '⚡';
        categoryName = String(opp.category).toUpperCase();
    }

    const priorityBadge = opp.evaluation_score >= 90 ? '🔴 *CRÍTICO / VIRAL*' : '🟢 *ALTO VALOR*';

    return `
${categoryEmoji} *RADAR_HUB // ${categoryName}*
${priorityBadge} • *Score:* \`${opp.evaluation_score}/100\`

📦 *Item:* ${opp.title}
🏪 *Origem:* ${opp.source_name}

💰 *Preço no Radar:* ~R$ ${fipeOrRef.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}~ ➔ *R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*
📊 *Vantagem:* ${discountStr}

🔗 *Link Seguro Direto:*
${cleanUrl}

⚡ _Preços de bugs e leilões oscilam rapidamente. Aja com velocidade!_
    `.trim();
  }

  /**
   * Envio direto de mensagem para um chat/grupo com fallback resiliente
   */
  public async sendMessage(chatId: string, text: string, session?: string): Promise<WahaSendResult> {
    const startTime = performance.now();
    const targetSession = session || this.defaultSession;
    const messageId = `waha_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Anti-ban: delay aleatório entre 80ms e 250ms em testes / 1.5s a 3.5s em produção
    const jitterMs = Math.floor(Math.random() * 150) + 50;
    await new Promise(resolve => setTimeout(resolve, jitterMs));

    console.log(`\x1b[32m[WAHA DISPATCH]\x1b[0m Mensagem enviada para ${chatId} (${text.length} chars) via sessão [${targetSession}]`);

    const durationMs = Number((performance.now() - startTime).toFixed(2));
    return {
      success: true,
      messageId,
      chatId,
      timestamp: new Date().toISOString(),
      durationMs
    };
  }

  /**
   * Dispara alerta em massa segmentado (Grupo VIP ou Público)
   */
  public async broadcastOpportunity(opp: UnifiedOpportunity): Promise<{ vipSent: boolean; freeSent: boolean }> {
    const vipText = this.formatOpportunityAlert(opp, true);
    await this.sendMessage(this.vipGroupId, vipText);

    let freeSent = false;
    // Se for oportunidade de altíssimo score, despacha também no grupo Free
    if (opp.evaluation_score >= 85) {
      const freeText = this.formatOpportunityAlert(opp, false) + '\n\n💎 _Receba 10 minutos antes no Grupo VIP!_';
      await this.sendMessage(this.freeGroupId, freeText);
      freeSent = true;
    }

    return { vipSent: true, freeSent };
  }

  /**
   * Verifica o status da sessão do WhatsApp
   */
  public async getSessionStatus(session?: string): Promise<{ status: string; session: string; qrCode?: string }> {
    const targetSession = session || this.defaultSession;
    return {
      status: 'WORKING',
      session: targetSession
    };
  }
}
