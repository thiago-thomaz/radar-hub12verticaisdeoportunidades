/**
 * RADAR_HUB - Motor de Avaliação de Leilões vs Tabela FIPE / Mercado
 * Modela custos operacionais reais: comissão leiloeiro (5%), taxa administrativa,
 * provisão para reparos/documentação e calcula margem líquida real de revenda.
 */

export interface VehicleAuctionInput {
  title: string;
  bidPrice: number; // Lance atual ou lance mínimo
  fipePrice: number; // Valor de referência Tabela FIPE
  auctionFeePercent?: number; // Padrão 5% do leiloeiro
  fixedExpensesEstimate?: number; // Pátio, guincho, doc (ex: R$ 1.500)
  repairBufferPercent?: number; // Provisão reparos/mecânica (padrão 8-12%)
  categoryType: 'car' | 'motorcycle' | 'truck' | 'industrial_asset';
}

export interface VehicleAuctionResult {
  totalEstimatedCost: number;
  netProfitEstimate: number;
  netMarginPercentage: number;
  discountVsFipe: number;
  evaluationScore: number;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG';
  recommendation: 'STRONG_BUY' | 'BUY' | 'WATCH' | 'AVOID';
}

export function evaluateVehicleAuction(input: VehicleAuctionInput): VehicleAuctionResult {
  const auctionFeePercent = input.auctionFeePercent ?? 5.0;
  const fixedExpenses = input.fixedExpensesEstimate ?? 1500.0;
  const repairBufferPercent = input.repairBufferPercent ?? 10.0;

  if (input.fipePrice <= 0 || input.bidPrice <= 0) {
    return {
      totalEstimatedCost: 0,
      netProfitEstimate: 0,
      netMarginPercentage: 0,
      discountVsFipe: 0,
      evaluationScore: 0,
      priority: 'NORMAL',
      recommendation: 'AVOID',
    };
  }

  // Custos embutidos
  const auctioneerFee = input.bidPrice * (auctionFeePercent / 100);
  const repairBuffer = input.fipePrice * (repairBufferPercent / 100);
  const totalEstimatedCost = input.bidPrice + auctioneerFee + fixedExpenses + repairBuffer;

  const netProfitEstimate = input.fipePrice - totalEstimatedCost;
  const netMarginPercentage = (netProfitEstimate / input.fipePrice) * 100;
  const discountVsFipe = ((input.fipePrice - input.bidPrice) / input.fipePrice) * 100;

  let evaluationScore = 0;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';
  let recommendation: 'STRONG_BUY' | 'BUY' | 'WATCH' | 'AVOID' = 'AVOID';

  if (netMarginPercentage >= 40 || discountVsFipe >= 65) {
    evaluationScore = 95;
    priority = 'CRITICAL_BUG'; // Margem extrema
    recommendation = 'STRONG_BUY';
  } else if (netMarginPercentage >= 25 || discountVsFipe >= 50) {
    evaluationScore = 85;
    priority = 'HIGH';
    recommendation = 'STRONG_BUY';
  } else if (netMarginPercentage >= 15) {
    evaluationScore = 70;
    priority = 'NORMAL';
    recommendation = 'BUY';
  } else if (netMarginPercentage > 5) {
    evaluationScore = 50;
    priority = 'NORMAL';
    recommendation = 'WATCH';
  } else {
    evaluationScore = 20;
    priority = 'NORMAL';
    recommendation = 'AVOID';
  }

  return {
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(2)),
    netProfitEstimate: Number(netProfitEstimate.toFixed(2)),
    netMarginPercentage: Number(netMarginPercentage.toFixed(2)),
    discountVsFipe: Number(discountVsFipe.toFixed(2)),
    evaluationScore,
    priority,
    recommendation,
  };
}
