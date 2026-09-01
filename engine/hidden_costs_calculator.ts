/**
 * RADAR_HUB - Calculadora Preditiva de Liquidez e Custos Ocultos
 * Modela dedução estrita de custos para Leilões de Veículos, Imóveis e Bens.
 */

export interface VehicleCostBreakdown {
  lanceInicial: number;
  fipeValue: number;
  comissaoLeiloeiro: number; // 5%
  taxaPatioGuincho: number; // R$ 800 - R$ 900
  custoReparosEstimado: number; // Funilaria/mecânica (estimado via IA ou 8-12%)
  custoRealAquisicao: number; // CRA
  lucroLiquidoEstimado: number;
  desagioRealPercent: number;
  isLucroAlto: boolean; // Flag se (FIPE - CRA) >= R$ 15.000
  evaluationScore: number;
}

export function calculateVehicleHiddenCosts(
  bidPrice: number,
  fipeValue: number,
  customRepairEstimate?: number
): VehicleCostBreakdown {
  if (bidPrice <= 0 || fipeValue <= 0) {
    return {
      lanceInicial: bidPrice,
      fipeValue,
      comissaoLeiloeiro: 0,
      taxaPatioGuincho: 0,
      custoReparosEstimado: 0,
      custoRealAquisicao: 0,
      lucroLiquidoEstimado: 0,
      desagioRealPercent: 0,
      isLucroAlto: false,
      evaluationScore: 0,
    };
  }

  const comissaoLeiloeiro = bidPrice * 0.05;
  const taxaPatioGuincho = 900.0;
  const custoReparosEstimado = customRepairEstimate ?? fipeValue * 0.08;

  const custoRealAquisicao = bidPrice + comissaoLeiloeiro + taxaPatioGuincho + custoReparosEstimado;
  const lucroLiquidoEstimado = fipeValue - custoRealAquisicao;
  const desagioRealPercent = ((fipeValue - custoRealAquisicao) / fipeValue) * 100;
  const isLucroAlto = lucroLiquidoEstimado >= 15000.0;

  let evaluationScore = 50;
  if (desagioRealPercent > 40 && isLucroAlto) {
    evaluationScore = 98;
  } else if (desagioRealPercent > 25) {
    evaluationScore = 85;
  } else if (desagioRealPercent > 15) {
    evaluationScore = 70;
  } else {
    evaluationScore = 40;
  }

  return {
    lanceInicial: Number(bidPrice.toFixed(2)),
    fipeValue: Number(fipeValue.toFixed(2)),
    comissaoLeiloeiro: Number(comissaoLeiloeiro.toFixed(2)),
    taxaPatioGuincho,
    custoReparosEstimado: Number(custoReparosEstimado.toFixed(2)),
    custoRealAquisicao: Number(custoRealAquisicao.toFixed(2)),
    lucroLiquidoEstimado: Number(lucroLiquidoEstimado.toFixed(2)),
    desagioRealPercent: Number(desagioRealPercent.toFixed(2)),
    isLucroAlto,
    evaluationScore,
  };
}

export interface RealEstateCostBreakdown {
  lanceMinimo: number;
  valorMercado: number;
  itbiTax: number; // 3%
  registroCartorio: number; // 1%
  despesasRegularizacaoDespejo: number; // Provisão jurídica se ocupado (ex: R$ 8.000)
  custoTotal: number;
  lucroProjetado: number;
  roiProjetadoPercent: number;
  isOcupado: boolean;
}

export function calculateRealEstateHiddenCosts(
  bidPrice: number,
  marketValue: number,
  isOcupado: boolean = true
): RealEstateCostBreakdown {
  const itbiTax = bidPrice * 0.03;
  const registroCartorio = bidPrice * 0.01;
  const despesasRegularizacaoDespejo = isOcupado ? 8500.0 : 1500.0;

  const custoTotal = bidPrice + itbiTax + registroCartorio + despesasRegularizacaoDespejo;
  const lucroProjetado = marketValue - custoTotal;
  const roiProjetadoPercent = (lucroProjetado / custoTotal) * 100;

  return {
    lanceMinimo: Number(bidPrice.toFixed(2)),
    valorMercado: Number(marketValue.toFixed(2)),
    itbiTax: Number(itbiTax.toFixed(2)),
    registroCartorio: Number(registroCartorio.toFixed(2)),
    despesasRegularizacaoDespejo,
    custoTotal: Number(custoTotal.toFixed(2)),
    lucroProjetado: Number(lucroProjetado.toFixed(2)),
    roiProjetadoPercent: Number(roiProjetadoPercent.toFixed(2)),
    isOcupado,
  };
}
