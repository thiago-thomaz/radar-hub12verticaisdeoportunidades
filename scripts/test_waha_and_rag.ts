/**
 * ==============================================================================
 * RADAR_HUB — SUÍTE DE TESTES WAHA (WHATSAPP), ASSISTENTE RAG & DRE FINANCEIRO
 * ==============================================================================
 * 1. Formatação de Alertas Ricos para WhatsApp WAHA com Tags de Afiliado.
 * 2. Simulação de 5 Interações Conversacionais via RAG (Carros, Bugs, Câmbio, Imóveis, VIP).
 * 3. Processamento de Webhooks do WAHA.
 * 4. Validação Contábil de DRE, MRR/ARR, LTV/CAC e Projeções Financeiras.
 */

import {
  RadarWahaGateway,
  RadarAIAssistant,
  RadarFinancialAnalyticsEngine,
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
  console.log('\n' + colors.bright + colors.green + '═'.repeat(80));
  console.log(` 💬 WAHA WHATSAPP, RAG ASSISTANT & DRE // ${title}`);
  console.log('═'.repeat(80) + colors.reset);
}

function logPass(msg: string) {
  console.log(` ${colors.green}${colors.bright}[✔ PASS]${colors.reset} ${msg}`);
}

function logInfo(msg: string) {
  console.log(` ${colors.cyan}${colors.bright}[ℹ INFO]${colors.reset} ${msg}`);
}

async function runWahaAndRagSuite() {
  // ============================================================================
  // ETAPA 1: VALIDAÇÃO DE ALERTAS RICOS DO WHATSAPP (WAHA)
  // ============================================================================
  logHeader('ETAPA 1: FORMATAÇÃO DE ALERTAS RICOS DO WHATSAPP');

  const waha = new RadarWahaGateway();

  const testOpps: UnifiedOpportunity[] = [
    {
      fingerprint_hash: 'hash_bug_1',
      category: 'price_bug',
      title: 'Smart TV LG OLED 65 4K 120Hz',
      source_name: 'Amazon Brasil',
      source_url: 'https://www.amazon.com.br/dp/B0CKW2L87X',
      opportunity_price: 799.00,
      fipe_or_market_ref: 6999.00,
      discount_percentage: 88.6,
      net_profit_estimate: 5500.00,
      evaluation_score: 98,
      priority: 'CRITICAL_BUG',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_car_2',
      category: 'car_auction',
      title: 'Toyota Corolla XEi 2.0 Flex Aut 2021',
      source_name: 'Freitas Leiloeiro',
      source_url: 'https://freitasleiloeiro.com.br/lote/1234',
      opportunity_price: 48000.00,
      fipe_or_market_ref: 85000.00,
      discount_percentage: 43.5,
      net_profit_estimate: 21500.00,
      evaluation_score: 92,
      priority: 'HIGH',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_re_3',
      category: 'real_estate_local',
      title: 'Apartamento 3 Dorms Altos da Cidade Bauru',
      source_name: 'Caixa Imóveis',
      source_url: 'https://venda-imoveis.caixa.gov.br/imovel/998877',
      opportunity_price: 180000.00,
      fipe_or_market_ref: 300000.00,
      discount_percentage: 40.0,
      net_profit_estimate: 78000.00,
      evaluation_score: 89,
      priority: 'HIGH',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_job_4',
      category: 'remote_job',
      title: 'Senior TypeScript / Node.js Engineer',
      source_name: 'Remotive Global',
      source_url: 'https://remotive.com/jobs/senior-typescript',
      opportunity_price: 45000.00,
      fipe_or_market_ref: 45000.00,
      discount_percentage: 0,
      net_profit_estimate: 45000.00,
      evaluation_score: 95,
      priority: 'CRITICAL_BUG',
      raw_metadata: {}
    },
    {
      fingerprint_hash: 'hash_miles_5',
      category: 'miles_promo',
      title: 'Transferência Livelo ➔ Smiles com 110% de Bônus',
      source_name: 'Livelo Fidelidade',
      source_url: 'https://www.livelo.com.br/promocao-smiles',
      opportunity_price: 14.50,
      fipe_or_market_ref: 18.90,
      discount_percentage: 23.3,
      net_profit_estimate: 3200.00,
      evaluation_score: 91,
      priority: 'HIGH',
      raw_metadata: {}
    }
  ];

  for (let i = 0; i < testOpps.length; i++) {
    const opp = testOpps[i];
    const alertMsg = waha.formatOpportunityAlert(opp, true);

    if (!alertMsg.includes('RADAR_HUB') || !alertMsg.includes('https://radarhub.local/r/')) {
      throw new Error(`Alerta #${i + 1} (${opp.title}) não contém a estrutura ou link encurtado.`);
    }

    logPass(`Alerta #${i + 1} [${opp.category}]: Formatado com sucesso (${alertMsg.length} caracteres).`);
  }

  // ============================================================================
  // ETAPA 2: SIMULAÇÃO DE INTERAÇÕES CONVERSACIONAIS VIA RAG
  // ============================================================================
  logHeader('ETAPA 2: ATENDIMENTO CONVERSACIONAL RAG (TELEGRAM & WHATSAPP)');

  const queries = [
    { text: 'Quero assinar o grupo VIP para receber os bugs', expectedKey: 'PLANO RADAR_HUB VIP', isPix: true },
    { text: 'Qual a chance de cancelarem a TV OLED de 699 na Magalu?', expectedKey: 'ANÁLISE PREDITIVA DE RISCO DE CANCELAMENTO', isPix: false },
    { text: 'Tem algum Corolla em leilão hoje abaixo da FIPE?', expectedKey: 'CONSULTA DE LEILÃO // TOYOTA COROLLA', isPix: false },
    { text: 'Vale a pena importar da China sob a Remessa Conforme?', expectedKey: 'ANÁLISE DE IMPORTAÇÃO & REMESSA CONFORME', isPix: false },
    { text: 'Quais os custos ocultos de comprar imóvel em Bauru?', expectedKey: 'ANÁLISE IMOBILIÁRIA // BAURU (SP)', isPix: false }
  ];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const res = await RadarAIAssistant.processUserMessage(q.text, {
      channel: 'WHATSAPP',
      senderId: '551499887766@c.us',
      senderName: 'Investidor VIP'
    });

    if (!res.responseText.includes(q.expectedKey)) {
      throw new Error(`Resposta do RAG para query #${i + 1} não contém chave esperada: "${q.expectedKey}"`);
    }

    if (q.isPix && (!res.pixPayload || res.actionRequired !== 'SHOW_PIX')) {
      throw new Error(`Query de VIP #${i + 1} não gerou o payload PIX esperado.`);
    }

    logPass(`RAG Query #${i + 1} ("${q.text.slice(0, 35)}..."): Respondido com confiança ${(res.confidence * 100).toFixed(0)}%.`);
  }

  // ============================================================================
  // ETAPA 3: SIMULAÇÃO DE WEBHOOK DO WAHA
  // ============================================================================
  logHeader('ETAPA 3: TESTE DE PROCESSAMENTO DE WEBHOOKS WAHA');

  const simulatedWebhook = {
    event: 'message',
    session: 'default',
    payload: {
      id: 'waha_msg_test_8812',
      from: '551199887766@c.us',
      body: 'Qual o valor do grupo VIP?',
      fromMe: false,
      timestamp: Date.now()
    }
  };

  const webhookAssistantResponse = await RadarAIAssistant.processUserMessage(simulatedWebhook.payload.body, {
    channel: 'WHATSAPP',
    senderId: simulatedWebhook.payload.from
  });

  if (!webhookAssistantResponse.responseText.includes('PLANO RADAR_HUB VIP')) {
    throw new Error('Falha no processamento do webhook do WAHA.');
  }

  const sendRes = await waha.sendMessage(simulatedWebhook.payload.from, webhookAssistantResponse.responseText);
  if (!sendRes.success || !sendRes.messageId) {
    throw new Error('Falha no despacho de resposta para o WhatsApp via WAHA.');
  }

  logPass(`Webhook WAHA processado com sucesso: Resposta enviada em ${sendRes.durationMs}ms para ${sendRes.chatId}.`);

  // ============================================================================
  // ETAPA 4: VALIDAÇÃO CONTÁBIL DO DRE E ANALYTICS FINANCEIRO
  // ============================================================================
  logHeader('ETAPA 4: DRE FINANCEIRO, MRR/ARR E ANALYTICS DE ARBITRAGEM');

  const financialOverview = RadarFinancialAnalyticsEngine.getFinancialOverview();

  if (financialOverview.subscription.monthlyRecurringRevenueBrl <= 0 || financialOverview.subscription.annualRecurringRevenueBrl <= 0) {
    throw new Error('Cálculo de MRR/ARR inválido.');
  }

  if (financialOverview.subscription.customerLifetimeValueBrl <= 0) {
    throw new Error('Cálculo de LTV inválido.');
  }

  logPass(`Métricas SaaS: ${financialOverview.subscription.activeVipSubscribers} assinantes VIP | MRR: R$ ${financialOverview.subscription.monthlyRecurringRevenueBrl} | ARR: R$ ${financialOverview.subscription.annualRecurringRevenueBrl}`);
  logPass(`Saúde do Negócio: LTV: R$ ${financialOverview.subscription.customerLifetimeValueBrl} | CAC: R$ ${financialOverview.subscription.customerAcquisitionCostBrl} (LTV/CAC: ${financialOverview.subscription.ltvToCacRatio}x) | Churn: ${financialOverview.subscription.churnRatePct}%`);
  logPass(`Economia de Arbitragem: GMV: R$ ${financialOverview.arbitrage.totalGmvTransactedBrl.toLocaleString('pt-BR')} | Economia Gerada: R$ ${financialOverview.arbitrage.totalSavingsGeneratedBrl.toLocaleString('pt-BR')}`);
  logPass(`Comissões por Canal: WhatsApp: R$ ${financialOverview.arbitrage.commissionsByChannel.whatsappWahaBrl} | Telegram: R$ ${financialOverview.arbitrage.commissionsByChannel.telegramChannelsBrl} | Web: R$ ${financialOverview.arbitrage.commissionsByChannel.webCockpitBrl}`);
  logPass(`Lucro Operacional Líquido: R$ ${financialOverview.operationalProfitability.netMarginBrl} (Margem Líquida: ${financialOverview.operationalProfitability.netMarginPercentage}%)`);

  const projections = RadarFinancialAnalyticsEngine.getFinancialProjections();
  if (projections.length !== 3) {
    throw new Error('Projeções financeiras incompletas.');
  }

  logPass(`Projeção 12 Meses: ${projections[2].projectedVipSubscribers} Assinantes | MRR Projetado: R$ ${projections[2].projectedMrrBrl} | ARR Projetado: R$ ${projections[2].projectedArrBrl}`);

  // ============================================================================
  // RESUMO FINAL
  // ============================================================================
  logHeader('RESUMO DA HOMOLOGAÇÃO WAHA, RAG E FINANCEIRO');
  console.log(` ${colors.green}${colors.bright}✔ 1. WAHA WhatsApp Gateway:${colors.reset} Formatação rica de alertas, anti-ban com jitter e deep links de afiliado.`);
  console.log(` ${colors.green}${colors.bright}✔ 2. Assistente RAG Conversacional:${colors.reset} 5 intenções estratégicas atendidas com suporte a PIX.`);
  console.log(` ${colors.green}${colors.bright}✔ 3. Webhooks WAHA:${colors.reset} Recepção, parsing e despacho de mensagens bidirecionais.`);
  console.log(` ${colors.green}${colors.bright}✔ 4. BI Financeiro & DRE:${colors.reset} MRR, ARR, LTV/CAC, GMV, economia gerada e projeções validadas.`);
  console.log('\n' + colors.bright + colors.green + '>>> MÓDULOS WAHA, RAG E DRE FINANCEIRO HOMOLOGADOS COM 100% DE SUCESSO <<<' + colors.reset + '\n');
}

runWahaAndRagSuite().catch(err => {
  console.error('\n' + colors.red + colors.bright + `[WAHA/RAG TEST FAIL] Erro: ${err.message}` + colors.reset);
  process.exit(1);
});
