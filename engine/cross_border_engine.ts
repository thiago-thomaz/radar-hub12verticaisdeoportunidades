/**
 * ==============================================================================
 * RADAR_HUB — MOTOR DE ARBITRAGEM CROSS-BORDER & COTAÇÃO DE CÂMBIO
 * ==============================================================================
 * Conversão de moedas (USD, EUR, GBP, JPY, CNY para BRL),
 * cálculo de impostos de importação sob o programa Remessa Conforme (II + ICMS por dentro),
 * IOF, frete internacional e projeção de margem de revenda em marketplaces locais.
 */

export type LocalMarketplacePreset = 'MERCADO_LIVRE' | 'OLX' | 'ENJOEI' | 'CUSTOM';

export interface CrossBorderInput {
  foreignPrice: number;
  currency: 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY';
  shippingForeign?: number;
  localMarketReferenceBrl: number;
  marketplacePreset?: LocalMarketplacePreset;
  marketplaceSellingFeePct?: number; // Padrão 12% (Mercado Livre)
  localDomesticFreightBrl?: number; // Frete nacional médio de envio (ex: R$ 22,00)
  paymentType?: 'PIX_REMETADORA' | 'CREDIT_CARD';
}

export interface CrossBorderCalculationResult {
  currency: string;
  exchangeRateBrl: number;
  foreignPrice: number;
  shippingForeign: number;
  totalCifUsd: number;
  
  // Impostos Remessa Conforme
  importTaxIiUsd: number;
  importTaxIiBrl: number;
  icmsBrl: number;
  iofBrl: number;
  totalTaxesBrl: number;
  
  // Custo Total de Entrada (Landed Cost)
  totalLandedCostBrl: number;
  
  // Análise de Arbitragem de Revenda
  localMarketReferenceBrl: number;
  marketplaceUsed: string;
  projectedNetSellingRevenueBrl: number;
  netArbitrageProfitBrl: number;
  netRoiPct: number;
  verdict: 'IMPORTAR_ALTA_MARGEM' | 'MARGEM_MODERADA' | 'INVIAVEL_IMPOSTOS_ALTOS';
  taxRuleApplied: string;
}

export class RadarCrossBorderEngine {
  private static readonly FX_RATES: Record<string, number> = {
    USD: 5.45,
    EUR: 5.95,
    GBP: 6.95,
    JPY: 0.036,
    CNY: 0.76
  };

  /**
   * Calcula o custo final de importação e margem líquida de revenda no Brasil
   */
  public static calculateImportArbitrage(input: CrossBorderInput): CrossBorderCalculationResult {
    const {
      foreignPrice,
      currency,
      shippingForeign = 0,
      localMarketReferenceBrl,
      marketplaceSellingFeePct = 12.0,
      paymentType = 'PIX_REMETADORA'
    } = input;

    const fxRate = this.FX_RATES[currency] || 5.45;
    const usdRate = this.FX_RATES['USD'];

    // Converte o valor CIF para USD para aplicação das faixas da Remessa Conforme
    const priceInBrl = foreignPrice * fxRate;
    const shippingInBrl = shippingForeign * fxRate;
    const totalCifBrl = priceInBrl + shippingInBrl;
    const totalCifUsd = Number((totalCifBrl / usdRate).toFixed(2));

    let importTaxIiUsd = 0;
    let taxRuleApplied = '';

    // Regras de Imposto de Importação (II) - Remessa Conforme
    if (totalCifUsd <= 50.00) {
      // Faixa até US$ 50: Alíquota de 20%
      importTaxIiUsd = totalCifUsd * 0.20;
      taxRuleApplied = 'Remessa Conforme: Faixa 1 (<= US$ 50) - II 20% + ICMS 17%';
    } else {
      // Faixa acima de US$ 50: Alíquota de 60% com dedução fixa de US$ 20
      importTaxIiUsd = Math.max(0, (totalCifUsd * 0.60) - 20.00);
      taxRuleApplied = 'Remessa Conforme: Faixa 2 (> US$ 50) - II 60% com desconto de $20 + ICMS 17%';
    }

    const importTaxIiBrl = Number((importTaxIiUsd * usdRate).toFixed(2));

    // Cálculo do ICMS "por dentro" (Alíquota estadual padrão de 17%)
    // Base ICMS = (CIF + II) / (1 - 0.17)
    const icmsBaseBrl = (totalCifBrl + importTaxIiBrl) / (1 - 0.17);
    const icmsBrl = Number((icmsBaseBrl * 0.17).toFixed(2));

    // IOF: 0.38% para PIX/Remetadora ou 4.38% para cartão de crédito internacional
    const iofPct = paymentType === 'CREDIT_CARD' ? 0.0438 : 0.0038;
    const iofBrl = Number(((totalCifBrl + importTaxIiBrl) * iofPct).toFixed(2));

    const totalTaxesBrl = Number((importTaxIiBrl + icmsBrl + iofBrl).toFixed(2));
    const totalLandedCostBrl = Number((totalCifBrl + totalTaxesBrl).toFixed(2));

    // Análise de Revenda Local por Marketplace (Mercado Livre, OLX, Enjoei)
    let effectiveFeePct = marketplaceSellingFeePct;
    let marketplaceUsed = 'MERCADO_LIVRE';

    if (input.marketplacePreset === 'OLX') {
      effectiveFeePct = 8.5;
      marketplaceUsed = 'OLX Direct';
    } else if (input.marketplacePreset === 'ENJOEI') {
      effectiveFeePct = 18.0;
      marketplaceUsed = 'Enjoei Pro';
    } else if (input.marketplacePreset === 'CUSTOM' && input.marketplaceSellingFeePct !== undefined) {
      effectiveFeePct = input.marketplaceSellingFeePct;
      marketplaceUsed = 'Custom Channel';
    }

    const domesticFreight = input.localDomesticFreightBrl || 0;
    const feeDecimal = effectiveFeePct / 100;
    const grossSellingRevenue = localMarketReferenceBrl * (1 - feeDecimal);
    const projectedNetSellingRevenueBrl = Number(Math.max(0, grossSellingRevenue - domesticFreight).toFixed(2));
    const netArbitrageProfitBrl = Number((projectedNetSellingRevenueBrl - totalLandedCostBrl).toFixed(2));
    const netRoiPct = totalLandedCostBrl > 0
      ? Number(((netArbitrageProfitBrl / totalLandedCostBrl) * 100).toFixed(1))
      : 0;

    let verdict: 'IMPORTAR_ALTA_MARGEM' | 'MARGEM_MODERADA' | 'INVIAVEL_IMPOSTOS_ALTOS';
    if (netRoiPct >= 45.0) {
      verdict = 'IMPORTAR_ALTA_MARGEM';
    } else if (netRoiPct >= 20.0) {
      verdict = 'MARGEM_MODERADA';
    } else {
      verdict = 'INVIAVEL_IMPOSTOS_ALTOS';
    }

    return {
      currency,
      exchangeRateBrl: fxRate,
      foreignPrice,
      shippingForeign,
      totalCifUsd,
      importTaxIiUsd: Number(importTaxIiUsd.toFixed(2)),
      importTaxIiBrl,
      icmsBrl,
      iofBrl,
      totalTaxesBrl,
      totalLandedCostBrl,
      localMarketReferenceBrl,
      marketplaceUsed,
      projectedNetSellingRevenueBrl,
      netArbitrageProfitBrl,
      netRoiPct,
      verdict,
      taxRuleApplied
    };
  }
}
