/**
 * RADAR_HUB - Motor de Detecção de Bugs de Preço e Erros de E-commerce
 * Identifica quedas abruptas, erros de dígito decimal e anomalias de cupom.
 */

export interface PriceBugInput {
  title: string;
  currentPrice: number;
  originalPrice?: number;
  historicalAveragePrice?: number;
  sellerRating?: number; // 0-5
  isFulfilledOrPrime?: boolean;
}

export interface PriceBugResult {
  isBug: boolean;
  discountPercentage: number;
  digitErrorLikelihood: number; // 0 a 1
  evaluationScore: number; // 0 a 100
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG';
  reason: string;
}

export function detectPriceBug(input: PriceBugInput): PriceBugResult {
  const refPrice = input.historicalAveragePrice || input.originalPrice || 0;

  if (input.currentPrice <= 0 || refPrice <= 0 || input.currentPrice >= refPrice) {
    return {
      isBug: false,
      discountPercentage: 0,
      digitErrorLikelihood: 0,
      evaluationScore: 0,
      priority: 'NORMAL',
      reason: 'Sem desconto identificado em relação à referência.',
    };
  }

  const discountPercentage = ((refPrice - input.currentPrice) / refPrice) * 100;
  const ratio = input.currentPrice / refPrice;

  // Detecção de erro de dígito (ex: 199.90 ao invés de 1999.00 -> ratio ~0.10)
  let digitErrorLikelihood = 0;
  if (ratio <= 0.15 && ratio >= 0.05) {
    digitErrorLikelihood = 0.95; // Ex: ~90% de desconto (vírgula deslocada 1 casa)
  } else if (ratio <= 0.02 && ratio >= 0.005) {
    digitErrorLikelihood = 0.99; // Ex: ~99% de desconto (vírgula deslocada 2 casas)
  }

  let baseScore = 0;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';
  let reason = '';

  if (discountPercentage >= 80 || digitErrorLikelihood > 0.8) {
    baseScore = 95;
    priority = 'CRITICAL_BUG';
    reason = `ERRO CRÍTICO DE SISTEMA: ${discountPercentage.toFixed(1)}% OFF (Preço: R$ ${input.currentPrice.toFixed(2)} vs Ref: R$ ${refPrice.toFixed(2)})`;
  } else if (discountPercentage >= 60) {
    baseScore = 80;
    priority = 'HIGH';
    reason = `Super Oportunidade / Preço Anômalo: ${discountPercentage.toFixed(1)}% OFF`;
  } else if (discountPercentage >= 40) {
    baseScore = 60;
    priority = 'NORMAL';
    reason = `Desconto promocional regular: ${discountPercentage.toFixed(1)}% OFF`;
  } else {
    baseScore = Math.floor(discountPercentage);
    priority = 'NORMAL';
    reason = `Desconto leve: ${discountPercentage.toFixed(1)}% OFF`;
  }

  // Bonificação se for produto Prime / Full (menor risco de cancelamento/golpe)
  if (input.isFulfilledOrPrime) {
    baseScore = Math.min(100, baseScore + 5);
  }

  return {
    isBug: discountPercentage >= 60 || digitErrorLikelihood > 0.5,
    discountPercentage: Number(discountPercentage.toFixed(2)),
    digitErrorLikelihood,
    evaluationScore: Math.min(100, Math.max(0, baseScore)),
    priority,
    reason,
  };
}
