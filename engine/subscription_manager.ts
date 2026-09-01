/**
 * ==============================================================================
 * RADAR_HUB - MOTOR DE MONETIZAÇÃO & GESTÃO DE ASSINATURAS VIP
 * ==============================================================================
 */

export interface PaymentWebhookPayload {
  event: 'PAYMENT_RECEIVED' | 'SUBSCRIPTION_RENEWED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CANCELED';
  customer: {
    email: string;
    name?: string;
    telegramId?: number;
  };
  subscriptionId?: string;
  plan: 'VIP_MONTHLY' | 'VIP_ANNUAL' | 'LIFETIME';
  durationDays?: number;
}

export interface SubscriptionRecord {
  customerEmail: string;
  customerName: string;
  telegramId?: number;
  planTier: string;
  expiresAt: Date;
  status: 'ACTIVE' | 'OVERDUE' | 'CANCELED' | 'EXPIRED';
}

export function processPaymentEvent(payload: PaymentWebhookPayload): SubscriptionRecord {
  const duration = payload.durationDays || (payload.plan === 'VIP_ANNUAL' ? 365 : payload.plan === 'LIFETIME' ? 3650 : 30);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + duration);

  const status = (payload.event === 'PAYMENT_FAILED' || payload.event === 'SUBSCRIPTION_CANCELED')
    ? 'CANCELED'
    : 'ACTIVE';

  return {
    customerEmail: payload.customer.email.toLowerCase().trim(),
    customerName: payload.customer.name || 'Assinante VIP',
    telegramId: payload.customer.telegramId,
    planTier: payload.plan,
    expiresAt,
    status,
  };
}

export function formatVipWelcomeMessage(name: string, inviteLink: string, expiresAt: Date): string {
  return `🎉 **BEM-VINDO AO GRUPO VIP RADAR_HUB!** 🎉\n\n` +
    `Olá **${name}**, seu pagamento foi confirmado com sucesso!\n\n` +
    `💎 **Seu Acesso VIP:**\n` +
    `• Vigência até: **${expiresAt.toLocaleDateString('pt-BR')}**\n` +
    `• Alertas Instantâneos de Bugs de Preço (>60% off)\n` +
    `• Leilões com Margem Líquida vs FIPE\n` +
    `• Botão de Compra em 1-Clique\n\n` +
    `👉 **Clique no link exclusivo para entrar:**\n${inviteLink}\n\n` +
    `⚠️ *Este link é de uso único e intransferível.*`;
}

export class SubscriptionManager {
  private subscriptions: Map<number, SubscriptionRecord> = new Map();

  public registerSubscription(telegramId: number, record: SubscriptionRecord): void {
    this.subscriptions.set(telegramId, record);
  }

  public isVipActive(telegramId: number): boolean {
    const sub = this.subscriptions.get(telegramId);
    if (!sub) return false;
    return sub.status === 'ACTIVE' && sub.expiresAt.getTime() > Date.now();
  }

  public getSubscription(telegramId: number): SubscriptionRecord | undefined {
    return this.subscriptions.get(telegramId);
  }

  public handlePaymentWebhook(payload: PaymentWebhookPayload): SubscriptionRecord {
    const record = processPaymentEvent(payload);
    if (payload.customer.telegramId) {
      this.registerSubscription(payload.customer.telegramId, record);
    }
    return record;
  }
}
