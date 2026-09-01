/**
 * RADAR_HUB - Motor de Arbitragem de Milhas e Emissões com Desconto
 * Calcula Custo por Milheiro (CPM), Bonificação de Transferência,
 * Spread de Arbitragem e Eficiência de Emissão vs Dinheiro.
 */

export interface MilesPromoInput {
  programSource: 'LIVELO' | 'ESFERA' | 'IUPP' | 'BANCO_DO_BRASIL' | 'OTHER';
  programTarget: 'LATAM_PASS' | 'SMILES' | 'AZUL' | 'IBERIA_PLUS' | 'TAP_MILES_AND_GO';
  bonusPercentage: number; // Ex: 100% de bônus
  costPerThousandOrigin?: number; // Custo de compra de pontos na origem (ex: R$ 35,00/mil)
  marketCpmTarget?: number; // Custo médio de venda no mercado balcão/hotmilhas (ex: R$ 17,50)
  flightCashPrice?: number; // Preço da passagem pagando em dinheiro
  flightMilesRequired?: number; // Quantidade de milhas necessárias
  flightTaxes?: number; // Taxas de embarque
}

export interface MilesPromoResult {
  effectiveCpmTarget: number; // CPM final gerado no destino
  arbitrageSpreadPercent: number; // Lucro bruto de venda do milheiro
  emissionSavingsPercent?: number; // Economia na emissão de voo vs dinheiro
  evaluationScore: number;
  priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG';
  analysis: string;
}

export function evaluateMilesPromo(input: MilesPromoInput): MilesPromoResult {
  const costOrigin = input.costPerThousandOrigin ?? 35.0; // Padrão Livelo clube/assinante
  const bonusMultiplier = 1 + (input.bonusPercentage / 100);
  
  // 1.000 pontos na origem viram (1.000 * bonusMultiplier) no destino
  // Custo por milheiro no destino = costOrigin / bonusMultiplier
  const effectiveCpmTarget = costOrigin / bonusMultiplier;

  // Mercado de referência de venda por programa
  const defaultMarketCpm: Record<string, number> = {
    LATAM_PASS: 24.50,
    SMILES: 16.50,
    AZUL: 19.00,
    IBERIA_PLUS: 75.00,
    TAP_MILES_AND_GO: 32.00,
  };

  const marketCpm = input.marketCpmTarget || defaultMarketCpm[input.programTarget] || 18.00;
  const arbitrageSpreadPercent = ((marketCpm - effectiveCpmTarget) / effectiveCpmTarget) * 100;

  let emissionSavingsPercent: number | undefined = undefined;
  if (input.flightCashPrice && input.flightMilesRequired) {
    const flightCostViaMiles = (input.flightMilesRequired / 1000) * effectiveCpmTarget + (input.flightTaxes || 0);
    emissionSavingsPercent = ((input.flightCashPrice - flightCostViaMiles) / input.flightCashPrice) * 100;
  }

  let evaluationScore = 0;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (input.bonusPercentage >= 100 || (emissionSavingsPercent && emissionSavingsPercent >= 60)) {
    evaluationScore = 95;
    priority = 'CRITICAL_BUG'; // Oportunidade absurda de emissão
  } else if (input.bonusPercentage >= 80 || arbitrageSpreadPercent >= 20 || (emissionSavingsPercent && emissionSavingsPercent >= 40)) {
    evaluationScore = 85;
    priority = 'HIGH';
  } else if (input.bonusPercentage >= 50) {
    evaluationScore = 70;
    priority = 'NORMAL';
  } else {
    evaluationScore = 40;
    priority = 'NORMAL';
  }

  const analysis = `Bônus: ${input.bonusPercentage}% (${input.programSource} -> ${input.programTarget}) | CPM Gerado: R$ ${effectiveCpmTarget.toFixed(2)} vs Mercado R$ ${marketCpm.toFixed(2)}${emissionSavingsPercent ? ` | Economia em Voo: ${emissionSavingsPercent.toFixed(1)}%` : ''}`;

  return {
    effectiveCpmTarget: Number(effectiveCpmTarget.toFixed(2)),
    arbitrageSpreadPercent: Number(arbitrageSpreadPercent.toFixed(2)),
    emissionSavingsPercent: emissionSavingsPercent ? Number(emissionSavingsPercent.toFixed(2)) : undefined,
    evaluationScore,
    priority,
    analysis,
  };
}
