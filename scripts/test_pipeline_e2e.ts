/**
 * ==============================================================================
 * RADAR_HUB - TESTE E2E DE INJEÇÃO DE CARGA SINTÉTICA & DISPARO MULTICANAL
 * ==============================================================================
 * Executa homologação das 12 Verticais Monitoradas com Score > 85
 * Valida Fingerprint SHA-256 e Formatação de Alertas Telegram e Discord.
 */

import {
  RadarScoringEngine,
  evaluateBauruRealEstate,
  evaluatePublicTender,
  evaluateExpiredDomain,
  evaluateRemoteJob,
  evaluateCoupon,
  evaluateCashback,
  evaluateSweepstake,
  evaluateMicrotask,
  generateFingerprint,
  UnifiedOpportunity
} from '../engine';

// Helper para escapar caracteres do Telegram MarkdownV2
function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function formatTelegramAlert(opp: UnifiedOpportunity): string {
  const isBug = opp.priority === 'CRITICAL_BUG';
  const header = isBug ? '🚨 *ALERTA CRÍTICO: BUG DE PREÇO / SUPER MARGEM* 🚨' : '⚡ *OPORTUNIDADE RADAR_HUB* ⚡';
  
  const formattedTitle = escapeMarkdownV2(opp.title);
  const priceFormatted = opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const refFormatted = opp.fipe_or_market_ref ? opp.fipe_or_market_ref.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const profitFormatted = opp.net_profit_estimate ? opp.net_profit_estimate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

  let lines = [
    header,
    '',
    `📌 *Item:* ${formattedTitle}`,
    `🏷️ *Categoria:* \`${opp.category}\``,
    `💰 *Preço Oportunidade:* R\\$ *${escapeMarkdownV2(priceFormatted)}*`
  ];

  if (refFormatted) {
    lines.push(`📊 *Referência / FIPE:* ~R\\$ ${escapeMarkdownV2(refFormatted)}~`);
  }
  if (opp.discount_percentage) {
    lines.push(`🔥 *Desconto / Deságio:* *${escapeMarkdownV2(opp.discount_percentage.toString())}\\% OFF*`);
  }
  if (profitFormatted) {
    lines.push(`💵 *Lucro Líquido Estimado:* R\\$ *${escapeMarkdownV2(profitFormatted)}*`);
  }

  lines.push(`⭐ *Score Algorítmico:* *${opp.evaluation_score}/100*`);
  lines.push(`🏢 *Origem:* \`${escapeMarkdownV2(opp.source_name)}\``);
  lines.push('');
  lines.push(`🔗 [Acessar Link Direto](${opp.source_url})`);

  return lines.join('\n');
}

function formatDiscordEmbed(opp: UnifiedOpportunity): Record<string, any> {
  const isBug = opp.priority === 'CRITICAL_BUG';
  const color = isBug ? 0xFF0033 : (opp.priority === 'HIGH' ? 0xFFA500 : 0x00FF88);

  return {
    embeds: [
      {
        title: `${isBug ? '🚨 [CRÍTICO] ' : '⚡ '}${opp.title}`,
        description: opp.description || `Oportunidade identificada pelo Radar de ${opp.category}.`,
        url: opp.source_url,
        color: color,
        fields: [
          { name: 'Preço', value: `R$ ${opp.opportunity_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, inline: true },
          { name: 'Valor Referência', value: opp.fipe_or_market_ref ? `R$ ${opp.fipe_or_market_ref.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A', inline: true },
          { name: 'Desconto / Deságio', value: opp.discount_percentage ? `${opp.discount_percentage}% OFF` : 'N/A', inline: true },
          { name: 'Lucro Líquido Est.', value: opp.net_profit_estimate ? `R$ ${opp.net_profit_estimate.toLocaleString('pt-BR')}` : 'N/A', inline: true },
          { name: 'Score', value: `${opp.evaluation_score}/100`, inline: true },
          { name: 'Fonte', value: opp.source_name, inline: true }
        ],
        footer: {
          text: `RADAR_HUB • Fingerprint: ${opp.fingerprint_hash.substring(0, 12)}...`
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
}

// 12 Casos de Teste Sintéticos de Alta Relevância
const SYNTHETIC_DEALS = [
  {
    verticalNumber: 1,
    category: 'price_bug',
    name: 'Bugs de Preço & Erros de E-commerce',
    input: {
      title: 'Smart TV 65 polegadas OLED 4K 120Hz',
      currentPrice: 699.00,
      historicalAveragePrice: 6999.00,
      isFulfilledOrPrime: true,
      sourceName: 'Amazon Brasil',
      sourceUrl: 'https://amazon.com.br/dp/B0BUG123'
    },
    evaluator: (input: any) => RadarScoringEngine.processPriceBug(input)
  },
  {
    verticalNumber: 2,
    category: 'car_auction',
    name: 'Leilões Judiciais de Veículos vs FIPE',
    input: {
      title: 'Toyota Corolla Cross XRE 2.0 2023',
      bidPrice: 58000.00,
      fipePrice: 135000.00,
      categoryType: 'car',
      sourceName: 'Freitas Leiloeiro',
      sourceUrl: 'https://freitasleiloeiro.com.br/lote/456'
    },
    evaluator: (input: any) => RadarScoringEngine.processVehicleAuction(input)
  },
  {
    verticalNumber: 3,
    category: 'industrial_auction',
    name: 'Leilões & Bens Industriais (Massas Falidas)',
    input: {
      title: 'Gerador Diesel Cummins 250kVA Silenciado',
      bidPrice: 35000.00,
      fipePrice: 120000.00,
      categoryType: 'industrial_asset',
      sourceName: 'Sodré Santoro Leilões',
      sourceUrl: 'https://sodresantoro.com.br/lote/gen789'
    },
    evaluator: (input: any) => RadarScoringEngine.processVehicleAuction(input)
  },
  {
    verticalNumber: 4,
    category: 'real_estate_local',
    name: 'Imóveis Abaixo do Mercado (Bauru e Região)',
    input: {
      title: 'Apartamento Alto Padrão Vila Aviação (110m²)',
      neighborhood: 'Vila Aviacao',
      totalPrice: 390000.00,
      totalAreaM2: 110,
      sourceName: 'Caixa Leilões Imobiliários',
      sourceUrl: 'https://venda-imoveis.caixa.gov.br/bauru110'
    },
    evaluator: (input: any) => {
      const r = evaluateBauruRealEstate(input);
      return {
        category: 'real_estate_local' as any,
        title: input.title,
        description: r.description,
        original_price: r.marketEstimatedTotal,
        opportunity_price: input.totalPrice,
        discount_percentage: r.discountVsBenchmarkPercent,
        net_profit_estimate: r.netDiscount,
        fipe_or_market_ref: r.marketEstimatedTotal,
        location: `Bauru - ${input.neighborhood}`,
        source_name: input.sourceName,
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.sourceName, input.sourceUrl, input.totalPrice)
      };
    }
  },
  {
    verticalNumber: 5,
    category: 'public_tender',
    name: 'Monitor de Licitações Públicas (PNCP / Comprasnet)',
    input: {
      title: 'Dispensa Eletrônica: Fornecimento de Switches e Roteadores Corporativos',
      organName: 'Tribunal Regional do Trabalho',
      estimatedValue: 56000.00,
      modality: 'DISPENSA',
      closingDate: '2026-09-15',
      estimatedMarginPercent: 32.0,
      sourceUrl: 'https://pncp.gov.br/app/editais/12345'
    },
    evaluator: (input: any) => {
      const r = evaluatePublicTender(input);
      return {
        category: 'public_tender' as any,
        title: input.title,
        description: r.description,
        original_price: input.estimatedValue,
        opportunity_price: input.estimatedValue,
        discount_percentage: 32.0,
        net_profit_estimate: r.estimatedProfit,
        fipe_or_market_ref: input.estimatedValue,
        source_name: input.organName,
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.organName, input.sourceUrl, input.estimatedValue)
      };
    }
  },
  {
    verticalNumber: 6,
    category: 'expired_domain',
    name: 'Radar de Domínios Expirando (Registro.br & SEO Drops)',
    input: {
      domain: 'advocaciabauru.com.br',
      domainAuthority: 36,
      backlinksCount: 2200,
      estimatedAppraisalUsd: 750,
      sourceUrl: 'https://registro.br/busca-dominio/?q=advocaciabauru.com.br'
    },
    evaluator: (input: any) => {
      const r = evaluateExpiredDomain(input);
      return {
        category: 'expired_domain' as any,
        title: `Domínio Drop: ${input.domain}`,
        description: r.description,
        original_price: r.estimatedValueBrl,
        opportunity_price: 40.00,
        discount_percentage: 98.8,
        net_profit_estimate: r.estimatedValueBrl - 40.00,
        fipe_or_market_ref: r.estimatedValueBrl,
        source_name: 'Registro.br Drop',
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint('Registro.br', input.domain, 40.00)
      };
    }
  },
  {
    verticalNumber: 7,
    category: 'remote_job',
    name: 'Radar de Vagas Remotas Globais (USD / BRL)',
    input: {
      title: 'Senior TypeScript & Distributed Systems Engineer',
      company: 'North American FinTech Corp',
      salaryUsdAnnual: 120000,
      techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'n8n'],
      sourceUrl: 'https://remoteok.com/remote-jobs/102938'
    },
    evaluator: (input: any) => {
      const r = evaluateRemoteJob(input);
      return {
        category: 'remote_job' as any,
        title: input.title,
        description: r.description,
        original_price: r.monthlyBrl,
        opportunity_price: r.monthlyBrl,
        discount_percentage: 0,
        net_profit_estimate: r.monthlyBrl,
        fipe_or_market_ref: r.monthlyBrl,
        source_name: input.company,
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.company, input.sourceUrl, r.monthlyBrl)
      };
    }
  },
  {
    verticalNumber: 8,
    category: 'coupon_deal',
    name: 'Radar de Cupons & Descontos Ativos',
    input: {
      storeName: 'Magazine Luiza',
      couponCode: 'SUPERPROMO70',
      discountPercent: 70,
      minOrderValue: 200,
      isVerified: true,
      sourceUrl: 'https://magazineluiza.com.br/cupom/superpromo70'
    },
    evaluator: (input: any) => {
      const r = evaluateCoupon(input);
      return {
        category: 'coupon_deal' as any,
        title: `Cupom ${input.couponCode} (70% OFF) na ${input.storeName}`,
        description: r.description,
        original_price: 300.00,
        opportunity_price: 90.00,
        discount_percentage: 70.0,
        net_profit_estimate: 210.00,
        fipe_or_market_ref: 300.00,
        source_name: input.storeName,
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.storeName, input.couponCode, 70)
      };
    }
  },
  {
    verticalNumber: 9,
    category: 'cashback_max',
    name: 'Radar de Cashback Máximo & Afiliados',
    input: {
      storeName: 'Dell Brasil',
      interPercent: 24,
      meliuzPercent: 12,
      productPrice: 6500.00,
      sourceUrl: 'https://bancointer.com.br/dell-cashback-24'
    },
    evaluator: (input: any) => {
      const r = evaluateCashback(input);
      return {
        category: 'cashback_max' as any,
        title: `24% Cashback Banco Inter na Dell Brasil`,
        description: r.summary,
        original_price: input.productPrice,
        opportunity_price: input.productPrice - r.cashValue,
        discount_percentage: r.bestRate,
        net_profit_estimate: r.cashValue,
        fipe_or_market_ref: input.productPrice,
        source_name: 'Banco Inter Shopping',
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint('Banco Inter', input.storeName, r.bestRate)
      };
    }
  },
  {
    verticalNumber: 10,
    category: 'sweepstake_promo',
    name: 'Sorteios e Promoções Fáceis (SECAP/SRE)',
    input: {
      brandName: 'Nestlé Brasil',
      title: 'Promoção 1 Milhão de Reais na Conta',
      secapCertificateNumber: 'SECAP/SRE 2026/08912',
      participationType: 'FREE_FORM',
      mainPrizeValue: 1000000.00,
      sourceUrl: 'https://promonestle.com.br/participe'
    },
    evaluator: (input: any) => {
      const r = evaluateSweepstake(input);
      return {
        category: 'sweepstake_promo' as any,
        title: input.title,
        description: r.description,
        original_price: input.mainPrizeValue,
        opportunity_price: 0.00,
        discount_percentage: 100,
        net_profit_estimate: input.mainPrizeValue,
        fipe_or_market_ref: input.mainPrizeValue,
        source_name: 'SECAP / SRE Oficial',
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.brandName, input.title, input.mainPrizeValue)
      };
    }
  },
  {
    verticalNumber: 11,
    category: 'miles_promo',
    name: 'Milhas Aéreas & Emissões com Desconto',
    input: {
      title: '100% de Bônus Livelo para Smiles (CPM R$ 17,50)',
      programSource: 'LIVELO',
      programTarget: 'SMILES',
      bonusPercentage: 100,
      costPerThousandOrigin: 35.00,
      sourceName: 'Livelo Pontos',
      sourceUrl: 'https://livelo.com.br/promos/smiles100'
    },
    evaluator: (input: any) => RadarScoringEngine.processMilesPromo(input)
  },
  {
    verticalNumber: 12,
    category: 'microtask_gig',
    name: 'Marketplace de Microtarefas Digitais',
    input: {
      taskTitle: 'Validação e Rotulagem de Vídeos de IA (Veículos Autônomos)',
      platform: 'Remotasks / Scale AI',
      rewardBrl: 45.00,
      estimatedMinutesToComplete: 20,
      isAutomatedScriptable: true,
      sourceUrl: 'https://scale.com/gigs/task998'
    },
    evaluator: (input: any) => {
      const r = evaluateMicrotask(input);
      return {
        category: 'microtask_gig' as any,
        title: input.taskTitle,
        description: r.description,
        original_price: r.hourlyRate,
        opportunity_price: input.rewardBrl,
        discount_percentage: 0,
        net_profit_estimate: input.rewardBrl,
        fipe_or_market_ref: r.hourlyRate,
        source_name: input.platform,
        source_url: input.sourceUrl,
        evaluation_score: r.score,
        priority: r.priority,
        raw_metadata: r,
        fingerprint_hash: generateFingerprint(input.platform, input.taskTitle, input.rewardBrl)
      };
    }
  }
];

async function runE2ETestSuite() {
  console.log('\x1b[1m\x1b[35m' + '='.repeat(80));
  console.log(' RADAR_HUB - HOMOLOGAÇÃO & INJEÇÃO DE CARGA SINTÉTICA (12 VERTICAIS)');
  console.log('=' .repeat(80) + '\x1b[0m\n');

  const generatedOpps: UnifiedOpportunity[] = [];
  const fingerprintsSeen = new Set<string>();
  let passedCount = 0;

  for (const deal of SYNTHETIC_DEALS) {
    const start = performance.now();
    try {
      const opp = deal.evaluator(deal.input);
      const duration = performance.now() - start;

      // Validação de Relevância
      const isHighQuality = opp.evaluation_score >= 85 || opp.priority === 'CRITICAL_BUG';
      const hasUniqueHash = !fingerprintsSeen.has(opp.fingerprint_hash);
      fingerprintsSeen.add(opp.fingerprint_hash);

      if (isHighQuality && hasUniqueHash) {
        passedCount++;
        generatedOpps.push(opp);
        console.log(`\x1b[32m[OK]\x1b[0m \x1b[1mVertical ${deal.verticalNumber.toString().padStart(2, '0')}\x1b[0m: [${deal.category}] ${deal.name}`);
        console.log(`     Score: \x1b[33m${opp.evaluation_score}/100\x1b[0m | Prioridade: \x1b[31m${opp.priority}\x1b[0m | Lucro Est.: \x1b[32mR$ ${opp.net_profit_estimate?.toLocaleString('pt-BR') || 'N/A'}\x1b[0m`);
        console.log(`     Fingerprint SHA-256: \x1b[90m${opp.fingerprint_hash}\x1b[0m (${duration.toFixed(2)}ms)`);
      } else {
        console.log(`\x1b[31m[FAIL]\x1b[0m Vertical ${deal.verticalNumber}: ${deal.name} (Score: ${opp.evaluation_score}, Hash Único: ${hasUniqueHash})`);
      }
    } catch (err: any) {
      console.log(`\x1b[31m[FAIL]\x1b[0m Vertical ${deal.verticalNumber}: ${deal.name} -> Erro: ${err.message}`);
    }
  }

  // Teste de Deduplicação de Hash
  console.log('\n\x1b[1m\x1b[36m=== TESTE DE PROTEÇÃO ANTI-DUPLICAÇÃO (DEDUPLICATION SMOKE TEST) ===\x1b[0m');
  const duplicateHash = generateFingerprint('Amazon Brasil', 'https://amazon.com.br/dp/B0BUG123', 699.00);
  if (fingerprintsSeen.has(duplicateHash)) {
    console.log(`\x1b[32m[OK]\x1b[0m Mecanismo Anti-Duplicação: Fingerprint detectado e rejeitado em caso de reprocessamento.`);
  } else {
    console.log(`\x1b[31m[FAIL]\x1b[0m Falha na detecção de duplicação de fingerprint.`);
  }

  // Demonstração dos Alertas Formatados para os Canais de Alta Velocidade
  console.log('\n\x1b[1m\x1b[36m=== AMOSTRA DE ALERTA DISPARADO: TELEGRAM (MARKDOWN V2) ===\x1b[0m');
  const sampleTelegram = formatTelegramAlert(generatedOpps[0]);
  console.log('\x1b[90m' + '-'.repeat(70) + '\x1b[0m');
  console.log(sampleTelegram);
  console.log('\x1b[90m' + '-'.repeat(70) + '\x1b[0m');

  console.log('\n\x1b[1m\x1b[36m=== AMOSTRA DE ALERTA DISPARADO: DISCORD (RICH EMBED JSON) ===\x1b[0m');
  const sampleDiscord = formatDiscordEmbed(generatedOpps[1]);
  console.log('\x1b[90m' + '-'.repeat(70) + '\x1b[0m');
  console.log(JSON.stringify(sampleDiscord, null, 2));
  console.log('\x1b[90m' + '-'.repeat(70) + '\x1b[0m');

  console.log('\n\x1b[1m\x1b[36m=== RESUMO DA HOMOLOGAÇÃO E2E ===\x1b[0m');
  console.log(`Total de Verticais Homologadas: ${SYNTHETIC_DEALS.length}`);
  console.log(`\x1b[32mSucessos com Alta Relevância (Score > 85): ${passedCount} / ${SYNTHETIC_DEALS.length}\x1b[0m`);

  if (passedCount === SYNTHETIC_DEALS.length) {
    console.log('\n\x1b[1m\x1b[32m✔ TODAS AS 12 VERTICAIS ESTÃO HOMOLOGADAS E PRONTAS PARA O DESPACHO EM ALTA VELOCIDADE.\x1b[0m\n');
  } else {
    console.log('\n\x1b[1m\x1b[31m✖ ATENÇÃO: ALGUMA VERTICAL APRESENTOU SCORE ABAIXO DO LIMIAR DE ALTA RELEVÂNCIA.\x1b[0m\n');
  }
}

runE2ETestSuite().catch(err => {
  console.error('Erro na execução do teste E2E:', err);
  process.exit(1);
});
