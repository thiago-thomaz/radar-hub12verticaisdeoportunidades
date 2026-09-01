/**
 * ==============================================================================
 * RADAR_HUB — GERENCIADOR DE TAGS DE AFILIADOS & DEEP LINKING
 * ==============================================================================
 * Injeção inteligente de tags de afiliados para Amazon, Mercado Livre, Shopee,
 * Magazine Luiza e Awin, com encurtador de links e rastreamento de conversão.
 */

import crypto from 'crypto';
import dotenv from 'dotenv';
import { URLSafetyValidator } from './routes_registry';

dotenv.config();

export interface AffiliateNetworkConfig {
  network: 'AMAZON' | 'MERCADO_LIVRE' | 'SHOPEE' | 'MAGALU' | 'ALIEXPRESS' | 'AWIN' | 'GENERIC';
  tagParam: string;
  defaultTagValue: string;
  commissionRateEstimatePct: number;
}

export interface GeneratedAffiliateLink {
  originalUrl: string;
  affiliateUrl: string;
  network: string;
  shortCode: string;
  shortUrl: string;
  campaign: string;
  estimatedCommissionPct: number;
  createdAt: string;
}

export interface AffiliateClickRecord {
  shortCode: string;
  originalUrl: string;
  network: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export class RadarAffiliateManager {
  private networkConfigs: Map<string, AffiliateNetworkConfig>;
  private linksStore: Map<string, GeneratedAffiliateLink> = new Map();
  private clicksStore: AffiliateClickRecord[] = [];

  constructor() {
    this.networkConfigs = new Map<string, AffiliateNetworkConfig>([
      [
        'AMAZON',
        {
          network: 'AMAZON',
          tagParam: 'tag',
          defaultTagValue: process.env.AMAZON_AFFILIATE_TAG || 'radarhub-20',
          commissionRateEstimatePct: 7.0
        }
      ],
      [
        'MERCADO_LIVRE',
        {
          network: 'MERCADO_LIVRE',
          tagParam: 'matt_tool',
          defaultTagValue: process.env.ML_AFFILIATE_TOOL || 'radar_ml_aff_2026',
          commissionRateEstimatePct: 8.5
        }
      ],
      [
        'SHOPEE',
        {
          network: 'SHOPEE',
          tagParam: 'af_sub1',
          defaultTagValue: process.env.SHOPEE_AFFILIATE_SUB || 'radarhub',
          commissionRateEstimatePct: 10.0
        }
      ],
      [
        'MAGALU',
        {
          network: 'MAGALU',
          tagParam: 'parceiro',
          defaultTagValue: process.env.MAGALU_AFFILIATE_PARTNER || 'radarhub',
          commissionRateEstimatePct: 6.0
        }
      ],
      [
        'ALIEXPRESS',
        {
          network: 'ALIEXPRESS',
          tagParam: 'aff_platform',
          defaultTagValue: process.env.ALI_AFFILIATE_PLATFORM || 'radar_ali_aff',
          commissionRateEstimatePct: 8.0
        }
      ]
    ]);
  }

  /**
   * Detecta a rede da URL de destino
   */
  public detectNetwork(urlStr: string): string {
    const lower = urlStr.toLowerCase();
    if (lower.includes('amazon.')) return 'AMAZON';
    if (lower.includes('mercadolivre.') || lower.includes('mercadolibre.')) return 'MERCADO_LIVRE';
    if (lower.includes('shopee.')) return 'SHOPEE';
    if (lower.includes('magazineluiza.') || lower.includes('magalu.')) return 'MAGALU';
    if (lower.includes('aliexpress.')) return 'ALIEXPRESS';
    return 'GENERIC';
  }

  /**
   * Injeta tag de afiliado e gera short link inteligente
   */
  public generateAffiliateLink(
    targetUrl: string,
    options?: { customTag?: string; campaign?: string }
  ): GeneratedAffiliateLink {
    const network = this.detectNetwork(targetUrl);
    const config = this.networkConfigs.get(network);
    const campaign = options?.campaign || 'telegram_vip';

    let finalAffiliateUrl = targetUrl;

    try {
      const parsedUrl = new URL(targetUrl);

      // Remove tags de afiliados de terceiros preexistentes
      const thirdPartyParams = [
        'tag', 'ascsubtag', 'linkCode', 'creative', 'creativeASIN',
        'matt_tool', 'matt_word', 'matt_source',
        'af_sub1', 'af_sub2', 'af_sub3', 'af_siteid',
        'parceiro', 'partner', 'origem', 'awin', 'awinaffid', 'zanpid', 'lmd'
      ];
      thirdPartyParams.forEach(p => parsedUrl.searchParams.delete(p));

      // Injeta tags proprietárias e parâmetros UTM
      if (config) {
        const tagValue = options?.customTag || config.defaultTagValue;
        parsedUrl.searchParams.set(config.tagParam, tagValue);
        parsedUrl.searchParams.set('utm_source', 'radar_hub');
        parsedUrl.searchParams.set('utm_campaign', campaign);
        finalAffiliateUrl = parsedUrl.toString();
      }
    } catch {
      // Fallback para URL simples
      finalAffiliateUrl = `${targetUrl}?ref=radarhub&camp=${campaign}`;
    }

    const shortCode = crypto.randomBytes(4).toString('hex').substring(0, 7);
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const shortUrl = `${baseUrl}/r/${shortCode}`;

    const record: GeneratedAffiliateLink = {
      originalUrl: targetUrl,
      affiliateUrl: finalAffiliateUrl,
      network,
      shortCode,
      shortUrl,
      campaign,
      estimatedCommissionPct: config?.commissionRateEstimatePct || 5.0,
      createdAt: new Date().toISOString()
    };

    this.linksStore.set(shortCode, record);
    return record;
  }

  /**
   * Registra clique no link encurtado e retorna a URL final de redirecionamento seguro
   */
  public trackAndRedirect(shortCode: string, ip?: string, ua?: string): string | null {
    const record = this.linksStore.get(shortCode);
    if (!record) return null;

    if (!URLSafetyValidator.isValidExternalUrl(record.affiliateUrl)) {
      return null;
    }

    this.clicksStore.push({
      shortCode,
      originalUrl: record.originalUrl,
      network: record.network,
      ipAddress: ip,
      userAgent: ua,
      timestamp: new Date().toISOString()
    });

    return record.affiliateUrl;
  }

  public getStats(): { totalLinks: number; totalClicks: number } {
    return {
      totalLinks: this.linksStore.size,
      totalClicks: this.clicksStore.length
    };
  }
}
