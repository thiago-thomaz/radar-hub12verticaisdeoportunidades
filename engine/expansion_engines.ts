/**
 * RADAR_HUB - Motores de Cálculo e Normalização para as 8 Novas Verticais
 */

// 1. Radar de Cupons & Promoções Rápidas
export interface CouponInput {
  storeName: string;
  couponCode: string;
  discountValue?: number;
  discountPercent?: number;
  minOrderValue?: number;
  applicableCategory?: string;
  isVerified?: boolean;
}

export function evaluateCoupon(input: CouponInput) {
  let score = 60;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if ((input.discountPercent && input.discountPercent >= 50) || (input.discountValue && input.discountValue >= 100)) {
    score = 95;
    priority = 'CRITICAL_BUG';
  } else if ((input.discountPercent && input.discountPercent >= 30) || (input.discountValue && input.discountValue >= 50)) {
    score = 80;
    priority = 'HIGH';
  }

  if (input.isVerified) score = Math.min(100, score + 5);

  return {
    couponCode: input.couponCode.toUpperCase().trim(),
    score,
    priority,
    description: `Cupom ${input.couponCode}: ${input.discountPercent ? `${input.discountPercent}% OFF` : `R$ ${input.discountValue} OFF`} na loja ${input.storeName}${input.minOrderValue ? ` (Gasto mínimo R$ ${input.minOrderValue})` : ''}`,
  };
}

// 2. Radar de Cashback & Afiliados
export interface CashbackComparisonInput {
  storeName: string;
  meliuzPercent?: number;
  interPercent?: number;
  cuponomiaPercent?: number;
  nuveiPercent?: number;
  productPrice: number;
}

export function evaluateCashback(input: CashbackComparisonInput) {
  const options = [
    { name: 'Méliuz', rate: input.meliuzPercent || 0 },
    { name: 'Banco Inter', rate: input.interPercent || 0 },
    { name: 'Cuponomia', rate: input.cuponomiaPercent || 0 },
    { name: 'Nuvei/Outros', rate: input.nuveiPercent || 0 },
  ];

  options.sort((a, b) => b.rate - a.rate);
  const best = options[0];
  const cashValue = (input.productPrice * best.rate) / 100;

  let score = Math.min(100, Math.floor(best.rate * 4));
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';
  if (best.rate >= 20) priority = 'CRITICAL_BUG';
  else if (best.rate >= 10) priority = 'HIGH';

  return {
    bestProvider: best.name,
    bestRate: best.rate,
    cashValue: Number(cashValue.toFixed(2)),
    score,
    priority,
    summary: `Melhor Cashback: ${best.rate}% no ${best.name} (Retorno de R$ ${cashValue.toFixed(2)})`,
  };
}

// 3. Sorteios e Promoções Fáceis (SECAP/SRE)
export interface SweepstakeInput {
  brandName: string;
  title: string;
  secapCertificateNumber?: string;
  participationType: 'FREE_FORM' | 'BUY_AND_WIN' | 'WHATSAPP_REGISTRATION';
  mainPrizeValue: number;
  drawDate?: string;
}

export function evaluateSweepstake(input: SweepstakeInput) {
  let score = 50;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (input.participationType === 'FREE_FORM' || input.participationType === 'WHATSAPP_REGISTRATION') {
    score = 80;
    if (input.mainPrizeValue >= 50000) {
      score = 95;
      priority = 'CRITICAL_BUG';
    } else {
      priority = 'HIGH';
    }
  } else if (input.mainPrizeValue >= 100000) {
    score = 85;
    priority = 'HIGH';
  }

  return {
    score,
    priority,
    isOfficialSecap: !!input.secapCertificateNumber,
    description: `Sorteio Oficial ${input.brandName}: Prêmio de R$ ${input.mainPrizeValue.toLocaleString('pt-BR')} | Cadastro Simples (${input.participationType})`,
  };
}

// 4. Radar de Imóveis Abaixo do Mercado (Bauru e Região)
export interface BauruRealEstateInput {
  title: string;
  neighborhood: string;
  totalPrice: number;
  totalAreaM2: number;
  benchmarkM2Price?: number;
}

const BAURU_BENCHMARKS: Record<string, number> = {
  'Jardim America': 6800.0,
  'Altos da Cidade': 5400.0,
  'Vila Aviacao': 8200.0,
  'Vila Universitaria': 5100.0,
  'Parque das Nacoes': 3200.0,
  'Nucleo Mary Dota': 2700.0,
  'Centro': 3900.0,
  'Geral': 4200.0,
};

export function evaluateBauruRealEstate(input: BauruRealEstateInput) {
  if (input.totalAreaM2 <= 0 || input.totalPrice <= 0) {
    return { calculatedM2Price: 0, discountVsBenchmarkPercent: 0, score: 0, priority: 'NORMAL' as const };
  }

  const calculatedM2Price = input.totalPrice / input.totalAreaM2;
  const benchmark = input.benchmarkM2Price || BAURU_BENCHMARKS[input.neighborhood] || BAURU_BENCHMARKS['Geral'];
  const marketEstimatedTotal = benchmark * input.totalAreaM2;
  const netDiscount = marketEstimatedTotal - input.totalPrice;
  const discountVsBenchmarkPercent = ((marketEstimatedTotal - input.totalPrice) / marketEstimatedTotal) * 100;

  let score = 50;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (discountVsBenchmarkPercent >= 45) {
    score = 98;
    priority = 'CRITICAL_BUG';
  } else if (discountVsBenchmarkPercent >= 30) {
    score = 85;
    priority = 'HIGH';
  } else if (discountVsBenchmarkPercent >= 15) {
    score = 70;
  }

  return {
    calculatedM2Price: Number(calculatedM2Price.toFixed(2)),
    benchmarkM2Price: benchmark,
    marketEstimatedTotal: Number(marketEstimatedTotal.toFixed(2)),
    netDiscount: Number(netDiscount.toFixed(2)),
    discountVsBenchmarkPercent: Number(discountVsBenchmarkPercent.toFixed(2)),
    score,
    priority,
    description: `Imóvel em ${input.neighborhood} (Bauru): R$ ${calculatedM2Price.toFixed(0)}/m² vs Méd. Região R$ ${benchmark.toFixed(0)}/m² (${discountVsBenchmarkPercent.toFixed(1)}% de deságio)`,
  };
}

// 5. Monitor de Licitações Públicas (PNCP / Comprasnet)
export interface PublicTenderInput {
  title: string;
  organName: string;
  estimatedValue: number;
  modality: 'PREGAO_ELETRONICO' | 'DISPENSA' | 'CONCORRENCIA';
  closingDate: string;
  estimatedMarginPercent?: number;
}

export function evaluatePublicTender(input: PublicTenderInput) {
  const marginPercent = input.estimatedMarginPercent || 25.0;
  const estimatedProfit = (input.estimatedValue * marginPercent) / 100;

  let score = 65;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (input.modality === 'DISPENSA' && input.estimatedValue <= 60000) {
    score = 90; // Dispensa eletrônica rápida
    priority = 'HIGH';
  } else if (input.estimatedValue >= 200000) {
    score = 85;
    priority = 'HIGH';
  }

  return {
    estimatedProfit: Number(estimatedProfit.toFixed(2)),
    score,
    priority,
    description: `Edital PNCP: ${input.organName} - Valor Est.: R$ ${input.estimatedValue.toLocaleString('pt-BR')} | Modalidade: ${input.modality} (Lucro Est. R$ ${estimatedProfit.toLocaleString('pt-BR')})`,
  };
}

// 6. Radar de Domínios Expirando (Registro.br & SEO Drops)
export interface ExpiredDomainInput {
  domain: string;
  domainAuthority?: number; // 0-100 DA Moz/Ahrefs
  backlinksCount?: number;
  monthlyOrganicTraffic?: number;
  estimatedAppraisalUsd?: number;
}

export function evaluateExpiredDomain(input: ExpiredDomainInput) {
  const da = input.domainAuthority || 0;
  const backlinks = input.backlinksCount || 0;
  const estValueBrl = (input.estimatedAppraisalUsd || 100) * 5.60;

  let score = 50;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (da >= 30 || backlinks >= 1000) {
    score = 95;
    priority = 'CRITICAL_BUG';
  } else if (da >= 15 || backlinks >= 200) {
    score = 80;
    priority = 'HIGH';
  }

  return {
    domain: input.domain.toLowerCase().trim(),
    estimatedValueBrl: Number(estValueBrl.toFixed(2)),
    score,
    priority,
    description: `Domínio em Liberação: ${input.domain} (DA: ${da}, Backlinks: ${backlinks}) | Valor Estimado: R$ ${estValueBrl.toFixed(2)}`,
  };
}

// 7. Radar de Vagas Remotas (USD/BRL)
export interface RemoteJobInput {
  title: string;
  company: string;
  salaryUsdAnnual?: number;
  salaryBrlMonthly?: number;
  techStack: string[];
}

export function evaluateRemoteJob(input: RemoteJobInput) {
  let monthlyBrl = input.salaryBrlMonthly || 0;
  if (input.salaryUsdAnnual && input.salaryUsdAnnual > 0) {
    monthlyBrl = (input.salaryUsdAnnual / 12) * 5.60;
  }

  let score = 60;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (monthlyBrl >= 35000) {
    score = 98; // Vaga internacional sênior em USD
    priority = 'CRITICAL_BUG';
  } else if (monthlyBrl >= 18000) {
    score = 85;
    priority = 'HIGH';
  }

  return {
    monthlyBrl: Number(monthlyBrl.toFixed(2)),
    score,
    priority,
    description: `Vaga 100% Remota: ${input.title} na ${input.company} | Salário Est.: R$ ${monthlyBrl.toLocaleString('pt-BR')}/mês | Stack: ${input.techStack.join(', ')}`,
  };
}

// 8. Marketplace de Microtarefas Automatizadas
export interface MicrotaskInput {
  taskTitle: string;
  platform: string;
  rewardBrl: number;
  estimatedMinutesToComplete: number;
  isAutomatedScriptable?: boolean;
}

export function evaluateMicrotask(input: MicrotaskInput) {
  const hourlyRate = input.estimatedMinutesToComplete > 0 
    ? (input.rewardBrl / input.estimatedMinutesToComplete) * 60 
    : 0;

  let score = 50;
  let priority: 'NORMAL' | 'HIGH' | 'CRITICAL_BUG' = 'NORMAL';

  if (input.isAutomatedScriptable && hourlyRate >= 50) {
    score = 95;
    priority = 'CRITICAL_BUG';
  } else if (hourlyRate >= 40) {
    score = 80;
    priority = 'HIGH';
  }

  return {
    hourlyRate: Number(hourlyRate.toFixed(2)),
    score,
    priority,
    description: `Microtarefa (${input.platform}): ${input.taskTitle} | Ganho: R$ ${input.rewardBrl.toFixed(2)} em ${input.estimatedMinutesToComplete}m (Taxa Horária R$ ${hourlyRate.toFixed(2)}/h)`,
  };
}
