/**
 * RADAR_HUB - Motor de Stacking de Descontos, Cupons, Milhas e Cashback Extremo
 * Modela a camada quádrupla:
 * [Preço Original] -> Desconto Base -> Cupom Ativo -> Cashback Direto -> Retorno em Milhas/Pontos por Real
 */

export interface StackingDealInput {
  title: string;
  originalPrice: number;
  promoPrice: number;
  couponDiscountValue?: number; // Desconto fixo do cupom em R$
  couponDiscountPercent?: number; // Desconto percentual do cupom
  cashbackPercent?: number; // Cashback (Méliuz, Inter, Cuponomia, etc.)
  pointsPerReal?: number; // Ex: 10 pontos Livelo/Esfera por R$ 1 gasto
  pointValueCpm?: number; // Valor monetário estimado de 1.000 pontos (padrão R$ 35,00)
}

export interface StackingDealResult {
  priceAfterCoupon: number;
  cashbackValue: number;
  pointsGenerated: number;
  pointsMonetaryValue: number;
  effectiveFinalPrice: number;
  totalSavingsPercentage: number;
  evaluationScore: number;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG';
  breakdown: string;
}

export function evaluateStackingDeal(input: StackingDealInput): StackingDealResult {
  let priceAfterCoupon = input.promoPrice;

  // Aplicação do Cupom
  if (input.couponDiscountPercent && input.couponDiscountPercent > 0) {
    priceAfterCoupon = priceAfterCoupon * (1 - input.couponDiscountPercent / 100);
  }
  if (input.couponDiscountValue && input.couponDiscountValue > 0) {
    priceAfterCoupon = Math.max(0, priceAfterCoupon - input.couponDiscountValue);
  }

  // Aplicação do Cashback
  const cashbackPercent = input.cashbackPercent || 0;
  const cashbackValue = priceAfterCoupon * (cashbackPercent / 100);

  // Aplicação de Pontos/Milhas por Real
  const pointsPerReal = input.pointsPerReal || 0;
  const pointsGenerated = Math.floor(priceAfterCoupon * pointsPerReal);
  const pointValueCpm = input.pointValueCpm || 35.0; // R$ 35 / 1.000 pts
  const pointsMonetaryValue = (pointsGenerated / 1000) * pointValueCpm;

  // Custo Efetivo Final
  const effectiveFinalPrice = Math.max(0, priceAfterCoupon - cashbackValue - pointsMonetaryValue);
  const baseReference = input.originalPrice > 0 ? input.originalPrice : input.promoPrice;
  const totalSavingsPercentage = ((baseReference - effectiveFinalPrice) / baseReference) * 100;

  let evaluationScore = 0;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (totalSavingsPercentage >= 75 || (pointsPerReal >= 12 && cashbackPercent >= 15)) {
    evaluationScore = 95;
    priority = 'CRITICAL_BUG';
  } else if (totalSavingsPercentage >= 55 || pointsPerReal >= 8 || cashbackPercent >= 20) {
    evaluationScore = 85;
    priority = 'HIGH';
  } else if (totalSavingsPercentage >= 35) {
    evaluationScore = 70;
    priority = 'NORMAL';
  } else {
    evaluationScore = Math.floor(totalSavingsPercentage);
    priority = 'NORMAL';
  }

  const breakdown = `Preço: R$ ${priceAfterCoupon.toFixed(2)} | Cashback: R$ ${cashbackValue.toFixed(2)} (${cashbackPercent}%) | Pontos: ${pointsGenerated} (~R$ ${pointsMonetaryValue.toFixed(2)}) => Preço Efetivo Final: R$ ${effectiveFinalPrice.toFixed(2)} (${totalSavingsPercentage.toFixed(1)}% OFF Total)`;

  return {
    priceAfterCoupon: Number(priceAfterCoupon.toFixed(2)),
    cashbackValue: Number(cashbackValue.toFixed(2)),
    pointsGenerated,
    pointsMonetaryValue: Number(pointsMonetaryValue.toFixed(2)),
    effectiveFinalPrice: Number(effectiveFinalPrice.toFixed(2)),
    totalSavingsPercentage: Number(totalSavingsPercentage.toFixed(2)),
    evaluationScore: Math.min(100, Math.max(0, evaluationScore)),
    priority,
    breakdown,
  };
}
