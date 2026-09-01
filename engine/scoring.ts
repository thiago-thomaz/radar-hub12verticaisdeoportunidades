/**
 * RADAR_HUB - Orquestrador Unificado de Scoring e Normalização de Oportunidades
 */

import { detectPriceBug, PriceBugInput } from './bug_detector';
import { evaluateVehicleAuction, VehicleAuctionInput } from './fipe_engine';
import { evaluateMilesPromo, MilesPromoInput } from './miles_engine';
import { evaluateStackingDeal, StackingDealInput } from './stacking_engine';
import * as crypto from 'crypto';

export type OpportunityCategory =
  | 'price_bug'
  | 'car_auction'
  | 'real_estate_auction'
  | 'industrial_auction'
  | 'miles_promo'
  | 'stacking_deal';

export type PriorityLevel = 'NORMAL' | 'HIGH' | 'CRITICAL_BUG';

export interface UnifiedOpportunity {
  category: OpportunityCategory | string;
  title: string;
  description?: string;
  original_price?: number;
  opportunity_price: number;
  discount_percentage?: number;
  net_profit_estimate?: number;
  fipe_or_market_ref?: number;
  location?: string;
  source_name: string;
  source_url: string;
  affiliate_url?: string;
  evaluation_score: number;
  priority: PriorityLevel;
  raw_metadata: Record<string, any>;
  fingerprint_hash: string;
}

export function generateFingerprint(sourceName: string, sourceUrl: string, price: number): string {
  const payload = `${sourceName}:${sourceUrl.trim().toLowerCase()}:${price.toFixed(2)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export class RadarScoringEngine {
  /**
   * Processa oportunidade de Bug de Preço
   */
  public static processPriceBug(
    data: PriceBugInput & { sourceName: string; sourceUrl: string; affiliateUrl?: string; description?: string }
  ): UnifiedOpportunity {
    const result = detectPriceBug(data);
    const originalPrice = data.historicalAveragePrice || data.originalPrice || data.currentPrice;
    const netProfit = originalPrice - data.currentPrice;

    return {
      category: 'price_bug',
      title: data.title,
      description: data.description || result.reason,
      original_price: originalPrice,
      opportunity_price: data.currentPrice,
      discount_percentage: result.discountPercentage,
      net_profit_estimate: netProfit > 0 ? Number(netProfit.toFixed(2)) : 0,
      fipe_or_market_ref: originalPrice,
      source_name: data.sourceName,
      source_url: data.sourceUrl,
      affiliate_url: data.affiliateUrl,
      evaluation_score: result.evaluationScore,
      priority: result.priority,
      raw_metadata: {
        digitErrorLikelihood: result.digitErrorLikelihood,
        isBug: result.isBug,
      },
      fingerprint_hash: generateFingerprint(data.sourceName, data.sourceUrl, data.currentPrice),
    };
  }

  /**
   * Processa oportunidade de Leilão (Veículo ou Bens)
   */
  public static processVehicleAuction(
    data: VehicleAuctionInput & { sourceName: string; sourceUrl: string; location?: string; description?: string }
  ): UnifiedOpportunity {
    const result = evaluateVehicleAuction(data);
    const category: OpportunityCategory =
      data.categoryType === 'industrial_asset' ? 'industrial_auction' : 'car_auction';

    return {
      category,
      title: data.title,
      description: data.description || `Recomendação: ${result.recommendation} | Margem Real: ${result.netMarginPercentage}% (Lucro Est.: R$ ${result.netProfitEstimate.toLocaleString('pt-BR')})`,
      original_price: data.fipePrice,
      opportunity_price: data.bidPrice,
      discount_percentage: result.discountVsFipe,
      net_profit_estimate: result.netProfitEstimate,
      fipe_or_market_ref: data.fipePrice,
      location: data.location || 'Brasil',
      source_name: data.sourceName,
      source_url: data.sourceUrl,
      evaluation_score: result.evaluationScore,
      priority: result.priority,
      raw_metadata: {
        totalEstimatedCost: result.totalEstimatedCost,
        netMarginPercentage: result.netMarginPercentage,
        recommendation: result.recommendation,
      },
      fingerprint_hash: generateFingerprint(data.sourceName, data.sourceUrl, data.bidPrice),
    };
  }

  /**
   * Processa oportunidade de Milhas e Bônus
   */
  public static processMilesPromo(
    data: MilesPromoInput & { title: string; sourceName: string; sourceUrl: string; description?: string }
  ): UnifiedOpportunity {
    const result = evaluateMilesPromo(data);

    return {
      category: 'miles_promo',
      title: data.title,
      description: data.description || result.analysis,
      original_price: (data.costPerThousandOrigin || 35.0) * 10, // Referência 10k pontos
      opportunity_price: result.effectiveCpmTarget * 10,
      discount_percentage: Number(Math.max(0, result.arbitrageSpreadPercent).toFixed(2)),
      net_profit_estimate: result.arbitrageSpreadPercent > 0 ? Number((result.arbitrageSpreadPercent * 10).toFixed(2)) : 0,
      fipe_or_market_ref: result.effectiveCpmTarget,
      source_name: data.sourceName,
      source_url: data.sourceUrl,
      evaluation_score: result.evaluationScore,
      priority: result.priority,
      raw_metadata: {
        effectiveCpmTarget: result.effectiveCpmTarget,
        arbitrageSpreadPercent: result.arbitrageSpreadPercent,
        bonusPercentage: data.bonusPercentage,
      },
      fingerprint_hash: generateFingerprint(data.sourceName, data.sourceUrl, result.effectiveCpmTarget),
    };
  }

  /**
   * Processa oportunidade de Stacking & Cashback
   */
  public static processStackingDeal(
    data: StackingDealInput & { sourceName: string; sourceUrl: string; affiliateUrl?: string; description?: string }
  ): UnifiedOpportunity {
    const result = evaluateStackingDeal(data);

    return {
      category: 'stacking_deal',
      title: data.title,
      description: data.description || result.breakdown,
      original_price: data.originalPrice,
      opportunity_price: result.effectiveFinalPrice,
      discount_percentage: result.totalSavingsPercentage,
      net_profit_estimate: Number((data.originalPrice - result.effectiveFinalPrice).toFixed(2)),
      fipe_or_market_ref: data.originalPrice,
      source_name: data.sourceName,
      source_url: data.sourceUrl,
      affiliate_url: data.affiliateUrl,
      evaluation_score: result.evaluationScore,
      priority: result.priority,
      raw_metadata: {
        priceAfterCoupon: result.priceAfterCoupon,
        cashbackValue: result.cashbackValue,
        pointsGenerated: result.pointsGenerated,
        pointsMonetaryValue: result.pointsMonetaryValue,
      },
      fingerprint_hash: generateFingerprint(data.sourceName, data.sourceUrl, result.effectiveFinalPrice),
    };
  }
}
