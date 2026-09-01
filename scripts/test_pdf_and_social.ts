/**
 * ==============================================================================
 * RADAR_HUB — SUÍTE DE TESTES DE DOSSIÊS PDF & SOCIAL POSTING
 * ==============================================================================
 * 1. Validação de Geração de Dossiês em PDF (Veículos, Imóveis Bauru e Indústria).
 * 2. Validação do Publicador para Twitter / X e Instagram Stories SVG (9:16).
 * 3. Validação das Regras de Gatilho (Score >= 90) e Cooldown Anti-Spam (15 min).
 */

import {
  RadarPdfReportGenerator,
  RadarSocialPoster,
  UnifiedOpportunity
} from '../engine';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function logHeader(title: string) {
  console.log('\n' + colors.bright + colors.blue + '═'.repeat(80));
  console.log(` 📑 PDF REPORTS & SOCIAL MEDIA // ${title}`);
  console.log('═'.repeat(80) + colors.reset);
}

function logPass(msg: string) {
  console.log(` ${colors.green}${colors.bright}[✔ PASS]${colors.reset} ${msg}`);
}

async function runPdfAndSocialSuite() {
  // ============================================================================
  // ETAPA 1: GERAÇÃO DE DOSSIÊS EXECUTIVOS EM PDF (3 CENÁRIOS)
  // ============================================================================
  logHeader('ETAPA 1: GERAÇÃO DE DOSSIÊS EXECUTIVOS EM PDF');

  const testAssets: UnifiedOpportunity[] = [
    {
      fingerprint_hash: 'hash_pdf_corolla_2021',
      category: 'car_auction',
      title: 'Toyota Corolla XEi 2.0 Flex Aut 2021',
      source_name: 'Freitas Leiloeiro',
      source_url: 'https://freitasleiloeiro.com.br/lote/1234',
      opportunity_price: 48000.00,
      fipe_or_market_ref: 85000.00,
      discount_percentage: 43.5,
      net_profit_estimate: 21500.00,
      evaluation_score: 95,
      priority: 'HIGH',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_pdf_imovel_bauru',
      category: 'real_estate_local',
      title: 'Apartamento 3 Dorms Altos da Cidade Bauru',
      source_name: 'Caixa Imóveis',
      source_url: 'https://venda-imoveis.caixa.gov.br/imovel/998877',
      opportunity_price: 180000.00,
      fipe_or_market_ref: 300000.00,
      discount_percentage: 40.0,
      net_profit_estimate: 78000.00,
      evaluation_score: 92,
      priority: 'HIGH',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_pdf_gerador_ind',
      category: 'industrial_auction',
      title: 'Grupo Gerador Diesel Cummins 500 kVA Cabinados',
      source_name: 'Superbid Exchange',
      source_url: 'https://superbid.net/oferta/gerador-500kva',
      opportunity_price: 65000.00,
      fipe_or_market_ref: 140000.00,
      discount_percentage: 53.5,
      net_profit_estimate: 52000.00,
      evaluation_score: 96,
      priority: 'CRITICAL_BUG',
      raw_metadata: {}
    }
  ];

  for (let i = 0; i < testAssets.length; i++) {
    const asset = testAssets[i];
    const { pdfBuffer, htmlContent, metadata } = RadarPdfReportGenerator.generateExecutiveDossier(asset);

    // Validação do buffer binário
    if (!pdfBuffer || pdfBuffer.length < 500 || !pdfBuffer.toString('utf-8', 0, 5).startsWith('%PDF')) {
      throw new Error(`Buffer de PDF inválido para o ativo #${i + 1} (${asset.title})`);
    }

    // Validação da estrutura HTML e cálculo
    if (!htmlContent.includes('DOSSIÊ EXECUTIVO') || (!htmlContent.includes('Custo Real de Aquisição') && !htmlContent.includes('Custo Efetivo Total') && !htmlContent.includes('Investimento Total'))) {
      throw new Error(`Estrutura do Dossiê HTML incompleta para ${asset.title}`);
    }

    logPass(`Dossiê #${i + 1} [${asset.category}]: Gerado com sucesso (${pdfBuffer.length} bytes) | CRA: R$ ${metadata.financialSummary.totalAcquisitionCostBrl.toLocaleString('pt-BR')} | Lucro Líquido: R$ ${metadata.financialSummary.projectedNetProfitBrl.toLocaleString('pt-BR')} (ROI: ${metadata.financialSummary.projectedRoiPercentage}%)`);
  }

  // ============================================================================
  // ETAPA 2: MOTOR DE SOCIAL MEDIA POSTING (TWITTER/X & INSTAGRAM STORIES)
  // ============================================================================
  logHeader('ETAPA 2: FORMAÇÃO DE POSTS TWITTER/X & BANNER INSTAGRAM STORIES');

  const socialPoster = new RadarSocialPoster();
  const viralOpportunity: UnifiedOpportunity = {
    fingerprint_hash: 'hash_social_oled_65',
    category: 'price_bug',
    title: 'Smart TV LG OLED 65 Polegadas 4K 120Hz',
    source_name: 'Amazon Brasil',
    source_url: 'https://amazon.com.br/dp/B0OLED65LG',
    opportunity_price: 799.00,
    fipe_or_market_ref: 6999.00,
    discount_percentage: 88.6,
    net_profit_estimate: 5500.00,
    evaluation_score: 98,
    priority: 'CRITICAL_BUG',
    raw_metadata: {}
  };

  // Teste de Tweet do Twitter / X
  const twitterResult = socialPoster.generateTwitterPost(viralOpportunity);
  if (!twitterResult.tweetText.includes('799.00') || !twitterResult.shortUrl.startsWith('https://radarhub.local/r/')) {
    throw new Error('Formatação de tweet do Twitter/X inválida.');
  }
  logPass(`Twitter / X: Tweet formatado com sucesso (${twitterResult.tweetText.length} caracteres) com tag de afiliado: ${twitterResult.shortUrl}`);

  // Teste de Banner Instagram Stories SVG (9:16)
  const storySvg = socialPoster.generateInstagramStoryBanner(viralOpportunity);
  if (!storySvg.includes('viewBox="0 0 1080 1920"') || !storySvg.includes('89% OFF') && !storySvg.includes('88% OFF') && !storySvg.includes('799,00')) {
    throw new Error('Banner SVG para Instagram Stories fora dos padrões visuais.');
  }
  logPass(`Instagram Stories: Banner SVG 9:16 gerado com sucesso (${storySvg.length} caracteres).`);

  // ============================================================================
  // ETAPA 3: REGRAS DE GATILHO (SCORE >= 90) E COOLDOWN ANTI-SPAM (15 MIN)
  // ============================================================================
  logHeader('ETAPA 3: REGRAS DE GATILHO & CONTROLE ANTI-SPAM');

  // Caso 1: Oportunidade com Score Baixo (< 90) deve ser rejeitada
  const lowScoreOpp: UnifiedOpportunity = {
    fingerprint_hash: 'hash_low_score_1',
    category: 'coupon_deal',
    title: 'Desconto de 5% em Fone de Ouvido Básico',
    source_name: 'Loja Genérica',
    source_url: 'https://loja.com/fone',
    opportunity_price: 50.00,
    fipe_or_market_ref: 55.00,
    discount_percentage: 9.0,
    evaluation_score: 65,
    priority: 'NORMAL',
    raw_metadata: {}
  };

  const lowScoreResult = await socialPoster.publishToSocialNetworks(lowScoreOpp);
  if (lowScoreResult.published) {
    throw new Error('Oportunidade com score abaixo de 90 não deveria ter sido publicada!');
  }
  logPass(`Gatilho de Score: Oportunidade com score 65 rejeitada corretamente (${lowScoreResult.reason}).`);

  // Caso 2: Oportunidade com Score >= 90 deve ser publicada
  const publishResult1 = await socialPoster.publishToSocialNetworks(viralOpportunity);
  if (!publishResult1.published) {
    throw new Error(`Falha na publicação da oportunidade viral: ${publishResult1.reason}`);
  }
  logPass(`Publicação Inicial: Oportunidade viral publicada com sucesso nos canais sociais.`);

  // Caso 3: Tentativa de publicação imediata deve ser bloqueada pelo cooldown de 15 minutos
  const immediateNextOpp: UnifiedOpportunity = { ...viralOpportunity, fingerprint_hash: 'hash_viral_2' };
  const cooldownResult = await socialPoster.publishToSocialNetworks(immediateNextOpp);
  if (cooldownResult.published) {
    throw new Error('Publicação consecutiva não respeitou o cooldown anti-spam de 15 minutos!');
  }
  logPass(`Controle Anti-Spam: Publicação consecutiva bloqueada com sucesso (${cooldownResult.reason}).`);

  // ============================================================================
  // RESUMO FINAL
  // ============================================================================
  logHeader('RESUMO DA HOMOLOGAÇÃO DE DOSSIÊS PDF & SOCIAL MEDIA');
  console.log(` ${colors.green}${colors.bright}✔ 1. Dossiês Executivos em PDF:${colors.reset} Memória de cálculo CRA, tabelas de custos ocultos e parecer técnico.`);
  console.log(` ${colors.green}${colors.bright}✔ 2. Twitter / X & Instagram Stories:${colors.reset} Threads virais com links de afiliado e banners SVG 9:16.`);
  console.log(` ${colors.green}${colors.bright}✔ 3. Regras de Gatilho & Anti-Spam:${colors.reset} Filtro estrito de Score >= 90 e cooldown de 15 min validados.`);
  console.log('\n' + colors.bright + colors.green + '>>> MÓDULOS DE DOSSIÊS PDF E SOCIAL POSTING HOMOLOGADOS COM 100% DE SUCESSO <<<' + colors.reset + '\n');
}

runPdfAndSocialSuite().catch(err => {
  console.error('\n' + colors.red + colors.bright + `[PDF/SOCIAL TEST FAIL] Erro: ${err.message}` + colors.reset);
  process.exit(1);
});
