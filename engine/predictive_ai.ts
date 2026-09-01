/**
 * ==============================================================================
 * RADAR_HUB — MÓDULO DE INTELIGÊNCIA PREDITIVA DE PREÇOS E CANCELAMENTOS
 * ==============================================================================
 * Modelos Analíticos & Heurísticas de Machine Learning em TypeScript:
 * 1. Cancelation Risk Estimator (Probabilidade de cancelamento unilateral 0-100%)
 * 2. Price Drift & Seasonality Predictor (Mínima histórica e Time-to-Correction)
 * 3. Smart Recommendation Engine (Veredito operacional: PIX, Análise ou Risco)
 */

export interface PredictiveInput {
  currentPrice: number;
  historicalAveragePrice: number;
  isFulfilledOrPrime?: boolean;
  isOfficialStore1P?: boolean;
  storeName?: string;
  category?: string;
  storeRating?: number; // 0 a 5.0
  historicalCancellationRate?: number; // 0.0 a 1.0
  stockCount?: number;
}

export interface PredictiveInsights {
  // Estimativa de Risco de Cancelamento
  cancelationRiskScore: number; // 0 a 100
  cancelationProbabilityPct: number; // 0.0 a 100.0%
  cancelationRiskLevel: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';
  
  // Projeção Temporal e Drift de Preço
  isHistoricalAllTimeLow: boolean;
  estimatedTimeToCorrectionMinutes: number;
  discountPercentage: number;
  projectedResaleMarginBrl: number;
  projectedResaleMarginPct: number;

  // Veredito e Recomendações
  verdict: 'COMPRA_IMEDIATA_PIX' | 'AVALIAR_CUSTO_BENEFICIO' | 'ALTO_RISCO_CANCELAMENTO';
  legalEnforceabilityRating: 'ALTA' | 'MEDIA' | 'BAIXA';
  confidenceScore: number; // 0.00 a 1.00
  rationale: string;
  actionPlanChecklist: string[];
}

export class RadarPredictiveAIEngine {
  /**
   * Avalia a probabilidade estatística de cancelamento pelo e-commerce
   */
  public static estimateCancelationRisk(input: PredictiveInput): {
    score: number;
    probabilityPct: number;
    level: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO';
  } {
    const {
      currentPrice,
      historicalAveragePrice,
      isFulfilledOrPrime = false,
      isOfficialStore1P = false,
      storeRating = 4.5,
      historicalCancellationRate
    } = input;

    if (historicalAveragePrice <= 0 || currentPrice <= 0) {
      return { score: 50, probabilityPct: 50.0, level: 'MODERADO' };
    }

    const discountRatio = Math.max(0, (historicalAveragePrice - currentPrice) / historicalAveragePrice);
    let rawRisk = 0;

    // 1. Magnitude do Erro de Preço (Curva não-linear)
    if (discountRatio >= 0.85) {
      rawRisk += 65; // Erro de dígito crasso (>85% OFF)
    } else if (discountRatio >= 0.70) {
      rawRisk += 45;
    } else if (discountRatio >= 0.50) {
      rawRisk += 25;
    } else {
      rawRisk += 10;
    }

    // 2. Tipo de Vendedor (1P vs 3P Marketplace)
    if (isOfficialStore1P) {
      rawRisk -= 20; // Grandes varejistas cumprem mais frequentemente via CDC
    } else {
      rawRisk += 20; // Seller marketplace terceirizado cancela com mais facilidade
    }

    // 3. Logística e Fulfillment (Prime / Full / CD próprio)
    if (isFulfilledOrPrime) {
      rawRisk -= 15; // Produto já estocado no CD, faturamento automático rápido
    }

    // 4. Reputação do Seller
    if (storeRating < 3.8) {
      rawRisk += 25;
    } else if (storeRating >= 4.8) {
      rawRisk -= 10;
    }

    // 5. Histórico Conhecido de Cancelamentos
    if (typeof historicalCancellationRate === 'number') {
      rawRisk += (historicalCancellationRate * 40);
    }

    const finalScore = Math.min(100, Math.max(5, Math.round(rawRisk)));
    const probabilityPct = Number((finalScore * 0.95).toFixed(1));

    let level: 'BAIXO' | 'MODERADO' | 'ALTO' | 'CRITICO' = 'MODERADO';
    if (finalScore < 30) level = 'BAIXO';
    else if (finalScore < 60) level = 'MODERADO';
    else if (finalScore < 85) level = 'ALTO';
    else level = 'CRITICO';

    return { score: finalScore, probabilityPct, level };
  }

  /**
   * Prediz a sazonalidade, tempo estimado até a correção do bug e margem
   */
  public static predictPriceDriftAndWindow(input: PredictiveInput): {
    isHistoricalAllTimeLow: boolean;
    estimatedTimeToCorrectionMinutes: number;
    discountPercentage: number;
    projectedResaleMarginBrl: number;
    projectedResaleMarginPct: number;
  } {
    const { currentPrice, historicalAveragePrice, isOfficialStore1P = false } = input;
    const discountPercentage = historicalAveragePrice > 0
      ? Number((((historicalAveragePrice - currentPrice) / historicalAveragePrice) * 100).toFixed(1))
      : 0;

    const isHistoricalAllTimeLow = discountPercentage >= 40;

    // Estimativa de Time-to-Correction (Minutos até os bots do varejista pausarem a oferta)
    let timeToCorrectionMinutes = 30;

    if (discountPercentage >= 80) {
      // Bugs virais de grande impacto são corrigidos entre 6 a 15 minutos em grandes lojas
      timeToCorrectionMinutes = isOfficialStore1P ? 8 : 14;
    } else if (discountPercentage >= 60) {
      timeToCorrectionMinutes = isOfficialStore1P ? 20 : 35;
    } else {
      timeToCorrectionMinutes = 60;
    }

    const projectedResaleMarginBrl = Number((historicalAveragePrice * 0.85 - currentPrice).toFixed(2));
    const projectedResaleMarginPct = currentPrice > 0
      ? Number(((projectedResaleMarginBrl / currentPrice) * 100).toFixed(1))
      : 0;

    return {
      isHistoricalAllTimeLow,
      estimatedTimeToCorrectionMinutes: timeToCorrectionMinutes,
      discountPercentage,
      projectedResaleMarginBrl,
      projectedResaleMarginPct
    };
  }

  /**
   * Gera a síntese de inteligência com veredito operacional completo
   */
  public static generatePredictiveInsights(input: PredictiveInput): PredictiveInsights {
    const risk = this.estimateCancelationRisk(input);
    const drift = this.predictPriceDriftAndWindow(input);

    let verdict: 'COMPRA_IMEDIATA_PIX' | 'AVALIAR_CUSTO_BENEFICIO' | 'ALTO_RISCO_CANCELAMENTO';
    let legalEnforceabilityRating: 'ALTA' | 'MEDIA' | 'BAIXA';
    let rationale = '';
    const actionPlanChecklist: string[] = [];

    // Lógica do Veredito Inteligente
    if (drift.discountPercentage >= 70 && input.isOfficialStore1P) {
      verdict = 'COMPRA_IMEDIATA_PIX';
      legalEnforceabilityRating = 'ALTA';
      rationale = `Desconto expressivo de ${drift.discountPercentage}% em loja oficial 1P (${input.storeName || 'Oficial'}). Alta probabilidade de cumprimento da oferta sob o CDC (Art. 30 e 35). Janela estimada de correção de apenas ~${drift.estimatedTimeToCorrectionMinutes} min.`;
      actionPlanChecklist.push('Concluir pagamento instantâneo via PIX para fixação imediata do pedido.');
      actionPlanChecklist.push('Salvar print com URL completa, timestamp e tela de confirmação.');
      actionPlanChecklist.push('Guardar número do pedido e e-mail para garantia jurídica de cumprimento.');
    } else if (risk.score > 80 && !input.isOfficialStore1P) {
      verdict = 'ALTO_RISCO_CANCELAMENTO';
      legalEnforceabilityRating = 'BAIXA';
      rationale = `Vendedor terceiro (3P) com desconto agressivo de ${drift.discountPercentage}%. Risco de cancelamento unilateral elevado (${risk.probabilityPct}%). Recomenda-se cautela ou uso de cartão temporário.`;
      actionPlanChecklist.push('Utilizar cartão virtual descartável com limite exato da compra.');
      actionPlanChecklist.push('Não antecipar revenda do produto antes da emissão da Nota Fiscal.');
    } else {
      verdict = 'AVALIAR_CUSTO_BENEFICIO';
      legalEnforceabilityRating = 'MEDIA';
      rationale = `Oportunidade consistente com ${drift.discountPercentage}% de desconto e margem projetada de R$ ${drift.projectedResaleMarginBrl.toLocaleString('pt-BR')}. Risco de cancelamento moderado/baixo (${risk.probabilityPct}%).`;
      actionPlanChecklist.push('Verificar custos de frete e prazos de entrega.');
      actionPlanChecklist.push('Comparar com outros marketplaces no Cockpit.');
    }

    const confidenceScore = Number((0.85 + (input.isOfficialStore1P ? 0.1 : 0.05) - (risk.score > 80 ? 0.05 : 0)).toFixed(2));

    return {
      cancelationRiskScore: risk.score,
      cancelationProbabilityPct: risk.probabilityPct,
      cancelationRiskLevel: risk.level,
      isHistoricalAllTimeLow: drift.isHistoricalAllTimeLow,
      estimatedTimeToCorrectionMinutes: drift.estimatedTimeToCorrectionMinutes,
      discountPercentage: drift.discountPercentage,
      projectedResaleMarginBrl: drift.projectedResaleMarginBrl,
      projectedResaleMarginPct: drift.projectedResaleMarginPct,
      verdict,
      legalEnforceabilityRating,
      confidenceScore,
      rationale,
      actionPlanChecklist
    };
  }
}
