/**
 * ==============================================================================
 * RADAR_HUB - SUÍTE DE TESTES LEGALTECH & MULTI-GATEWAY PAYMENT SWITCHER
 * ==============================================================================
 * 1. Validação de Petições JEC e Notificações Extrajudiciais (CDC Art. 30/35).
 * 2. Homologação dos 3 Gateways (Mercado Pago, Asaas e Stripe) com Webhooks.
 * 3. Teste de Failover Automático com Injeção de Falha em Gateway Primário.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  RadarLegalTechEngine,
  LegalCaseData,
  MultiGatewayPaymentManager,
  PaymentIntentRequest
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
  console.log('\n' + colors.bright + colors.magenta + '═'.repeat(80));
  console.log(` ⚖️ LEGALTECH & FINTECH PAYMENTS // ${title}`);
  console.log('═'.repeat(80) + colors.reset);
}

function logPass(msg: string) {
  console.log(` ${colors.green}${colors.bright}[✔ PASS]${colors.reset} ${msg}`);
}

function logInfo(msg: string) {
  console.log(` ${colors.cyan}${colors.bright}[ℹ INFO]${colors.reset} ${msg}`);
}

async function runLegalAndPaymentsSuite() {
  logHeader('ETAPA 1: GERAÇÃO DE PEÇAS JURÍDICAS AUTOMATIZADAS (LEGALTECH CDC)');

  const testCases: LegalCaseData[] = [
    {
      consumer: {
        name: 'Thiago Thomaz da Silva',
        cpf: '123.456.789-00',
        email: 'thiago@radarhub.com',
        phone: '(14) 99876-5432',
        address: 'Av. Getúlio Vargas, nº 1500, Jardim América',
        city: 'Bauru',
        state: 'SP',
        cep: '17017-000'
      },
      merchant: {
        storeName: 'Amazon Serviços de Varejo do Brasil Ltda',
        legalName: 'Amazon Brasil',
        cnpj: '15.436.940/0001-03',
        address: 'Av. Presidente Juscelino Kubitschek, 2041, São Paulo/SP',
        customerServiceEmail: 'atendimento@amazon.com.br'
      },
      dispute: {
        orderNumber: 'AMZ-BR-8921-2026',
        orderDate: '28/08/2026',
        productTitle: 'Smart TV 65 OLED 4K UHD 120Hz',
        advertisedPrice: 799.00,
        marketReferencePrice: 6999.00,
        paymentMethod: 'PIX',
        pixTransactionId: 'E15436940202608281001A8921',
        cancelDate: '29/08/2026',
        cancelReasonText: 'Erro evidente de precificação no sistema'
      },
      moralDamagesRequested: 3500.00
    },
    {
      consumer: {
        name: 'Mariana Costa Ribeiro',
        cpf: '987.654.321-99',
        email: 'mariana.costa@email.com',
        phone: '(11) 98765-4321',
        address: 'Rua Bela Cintra, nº 800, Consolação',
        city: 'São Paulo',
        state: 'SP',
        cep: '01415-000'
      },
      merchant: {
        storeName: 'Fast Shop S.A.',
        cnpj: '43.708.379/0001-00',
        customerServiceEmail: 'sac@fastshop.com.br'
      },
      dispute: {
        orderNumber: 'FAST-99882',
        orderDate: '29/08/2026',
        productTitle: 'Apple iPhone 15 Pro Max 256GB Titânio',
        advertisedPrice: 2499.00,
        marketReferencePrice: 9999.00,
        paymentMethod: 'CREDIT_CARD',
        cancelDate: '30/08/2026',
        cancelReasonText: 'Indisponibilidade de estoque no centro de distribuição'
      },
      moralDamagesRequested: 4000.00
    },
    {
      consumer: {
        name: 'Carlos Eduardo Nogueira',
        cpf: '333.444.555-66',
        email: 'carlos.nogueira@radarhub.com',
        phone: '(19) 97111-2233',
        address: 'Rua Barão de Jaguara, nº 450, Centro',
        city: 'Campinas',
        state: 'SP',
        cep: '13015-001'
      },
      merchant: {
        storeName: 'Magazine Luiza S.A.',
        cnpj: '47.960.950/0001-21'
      },
      dispute: {
        orderNumber: 'MAGALU-77123',
        orderDate: '25/08/2026',
        productTitle: 'Notebook Dell XPS 16 Intel Core Ultra 9 32GB 1TB',
        advertisedPrice: 3200.00,
        marketReferencePrice: 15999.00,
        paymentMethod: 'PIX',
        pixTransactionId: 'E47960950202608259902X77123',
        cancelDate: '26/08/2026',
        cancelReasonText: 'Preço incorreto'
      }
    }
  ];

  const mandatoryLegalClauses = [
    'Art. 30',
    'Art. 35',
    'Art. 51',
    'cumprimento forçado',
    'Desvio Produtivo',
    'TUTELA DE URGÊNCIA',
    'astreintes'
  ];

  for (let i = 0; i < testCases.length; i++) {
    const legalCase = testCases[i];
    const pack = RadarLegalTechEngine.generateFullLegalPack(legalCase);

    // Validação de cláusulas na Petição e Notificação
    for (const clause of mandatoryLegalClauses) {
      if (!pack.jecPetitionMarkdown.includes(clause)) {
        throw new Error(`Petição do Caso #${i + 1} não contém a fundamentação obrigatória: "${clause}"`);
      }
    }

    if (!pack.extrajudicialNoticeMarkdown.includes('48 (quarenta e oito) horas')) {
      throw new Error(`Notificação Extrajudicial do Caso #${i + 1} não contém o prazo de 48h.`);
    }

    logPass(`Caso #${i + 1} (${legalCase.dispute.productTitle}): Petição JEC (R$ ${pack.summary.totalClaimValue}) e Notificação 48h validadas.`);
  }

  // ============================================================================
  // ETAPA 2: HOMOLOGAÇÃO MULTI-GATEWAY (MERCADO PAGO, ASAAS E STRIPE)
  // ============================================================================
  logHeader('ETAPA 2: HOMOLOGAÇÃO DOS 3 PROVEDORES DE PAGAMENTO');

  const paymentManager = new MultiGatewayPaymentManager();

  const customer = {
    name: 'Investidor VIP Radar',
    email: 'investidor.vip@radarhub.com',
    cpf: '123.456.789-00',
    telegramUserId: 99887766
  };

  // 1. Teste Mercado Pago (PIX)
  const mpReq: PaymentIntentRequest = {
    customer,
    amount: 97.00,
    currency: 'BRL',
    planTier: 'VIP_MONTHLY',
    description: 'Assinatura Radar Supremo VIP Mensal',
    preferredProvider: 'MERCADO_PAGO'
  };

  const mpRes = await paymentManager.createPayment(mpReq);
  if (!mpRes.success || mpRes.providerUsed !== 'MERCADO_PAGO' || !mpRes.pixCode) {
    throw new Error('Falha na geração de cobrança PIX via Mercado Pago.');
  }
  logPass(`Mercado Pago: Cobrança PIX gerada (TxID: ${mpRes.transactionId}, PIX Code: ${mpRes.pixCode.slice(0, 35)}...)`);

  // 2. Teste Asaas (PIX / Split)
  paymentManager.setGatewayDegraded('MERCADO_PAGO', true);
  const asaasReq: PaymentIntentRequest = {
    customer,
    amount: 890.00,
    currency: 'BRL',
    planTier: 'VIP_ANNUAL',
    description: 'Assinatura Radar Supremo VIP Anual'
  };

  const asaasRes = await paymentManager.createPayment(asaasReq);
  if (!asaasRes.success || asaasRes.providerUsed !== 'ASAAS' || !asaasRes.checkoutUrl) {
    throw new Error('Falha na geração de cobrança PIX via Asaas.');
  }
  logPass(`Asaas Gateway: Cobrança gerada com sucesso (TxID: ${asaasRes.transactionId}, Checkout: ${asaasRes.checkoutUrl})`);

  // 3. Teste Stripe (Internacional USD)
  const stripeReq: PaymentIntentRequest = {
    customer,
    amount: 199.00,
    currency: 'USD',
    planTier: 'VIP_LIFETIME',
    description: 'RADAR_HUB Lifetime Global Pass'
  };

  const stripeRes = await paymentManager.createPayment(stripeReq);
  if (!stripeRes.success || stripeRes.providerUsed !== 'STRIPE' || !stripeRes.checkoutUrl) {
    throw new Error('Falha na criação de Stripe Checkout Session.');
  }
  logPass(`Stripe Global: Checkout Session criada (TxID: ${stripeRes.transactionId}, URL: ${stripeRes.checkoutUrl})`);

  // ============================================================================
  // ETAPA 3: TESTE DE FAILOVER AUTOMÁTICO INTELIGENTE
  // ============================================================================
  logHeader('ETAPA 3: TESTE DE FAILOVER AUTOMÁTICO SOB DEGRADAÇÃO DE GATEWAY');

  // Simula queda de Mercado Pago e Asaas simultaneamente para forçar failover até Stripe
  paymentManager.setGatewayDegraded('MERCADO_PAGO', true);
  paymentManager.setGatewayDegraded('ASAAS', true);

  const failoverReq: PaymentIntentRequest = {
    customer,
    amount: 97.00,
    currency: 'BRL',
    planTier: 'VIP_MONTHLY',
    description: 'Failover Emergency Checkout'
  };

  const failoverRes = await paymentManager.createPayment(failoverReq);

  if (failoverRes.success && failoverRes.providerUsed === 'STRIPE' && failoverRes.failoverOccurred) {
    logPass(`Failover Inteligente Validado: Mercado Pago ➔ Asaas ➔ Stripe. Trace: [${failoverRes.failoverTrace.join(' ➔ ')}]`);
  } else {
    throw new Error('Falha no mecanismo de failover automático.');
  }

  // Restaura gateways
  paymentManager.setGatewayDegraded('MERCADO_PAGO', false);
  paymentManager.setGatewayDegraded('ASAAS', false);

  // ============================================================================
  // ETAPA 4: PROCESSAMENTO DE WEBHOOKS COM VALIDAÇÃO DE ASSINATURA
  // ============================================================================
  logHeader('ETAPA 4: PROCESSADOR CENTRALIZADO DE WEBHOOKS (HMAC & ASSINATURA)');

  const mpWebhookPayload = {
    action: 'payment.created',
    data: {
      id: 'MP_TX_998822',
      transaction_amount: 97.00,
      payer: { email: 'investidor.vip@radarhub.com' },
      metadata: { plan_tier: 'VIP_MONTHLY' }
    }
  };

  const mpSignature = 'ts=1725000000,v1=' + crypto.createHmac('sha256', 'mp_secret_radar_secure_2026').update(JSON.stringify(mpWebhookPayload)).digest('hex');
  const mpEvent = paymentManager.processWebhook('MERCADO_PAGO', mpWebhookPayload, mpSignature);

  if (mpEvent.isPaid && mpEvent.signatureValid && mpEvent.customerEmail === 'investidor.vip@radarhub.com') {
    logPass(`Webhook Mercado Pago processado: Pagamento confirmado, assinatura HMAC validada.`);
  } else {
    throw new Error('Falha no processamento de webhook do Mercado Pago.');
  }

  const asaasWebhookPayload = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: 'pay_asaas_88712',
      value: 890.00,
      customerEmail: 'mariana.costa@email.com'
    },
    planTier: 'VIP_ANNUAL'
  };

  const asaasEvent = paymentManager.processWebhook('ASAAS', asaasWebhookPayload, 'asaas_token_radar_2026');
  if (asaasEvent.isPaid && asaasEvent.signatureValid) {
    logPass(`Webhook Asaas processado: Evento PAYMENT_RECEIVED confirmado (R$ ${asaasEvent.paidAmount}).`);
  } else {
    throw new Error('Falha no processamento de webhook do Asaas.');
  }

  // ============================================================================
  // RESUMO FINAL
  // ============================================================================
  logHeader('RESUMO DA HOMOLOGAÇÃO LEGALTECH & MULTI-GATEWAY PAYMENTS');
  console.log(` ${colors.green}${colors.bright}✔ 1. Motor Jurídico LegalTech:${colors.reset} Petições JEC e Notificações 48h com CDC Arts. 30/35 e Desvio Produtivo.`);
  console.log(` ${colors.green}${colors.bright}✔ 2. Multi-Gateway Switcher:${colors.reset} Mercado Pago (PIX), Asaas (Split) e Stripe (Global USD) operacionais.`);
  console.log(` ${colors.green}${colors.bright}✔ 3. Failover Automático:${colors.reset} Transição resiliente entre provedores sem perda de checkout.`);
  console.log(` ${colors.green}${colors.bright}✔ 4. Webhooks Centralizados:${colors.reset} Validação de assinatura criptográfica e ativação VIP imediata.`);
  console.log('\n' + colors.bright + colors.green + '>>> MÓDULOS LEGALTECH E FINTECH HOMOLOGADOS COM 100% DE SUCESSO <<<' + colors.reset + '\n');
}

runLegalAndPaymentsSuite().catch(err => {
  console.error('\n' + colors.red + colors.bright + `[LEGAL/PAY TEST FAIL] Erro: ${err.message}` + colors.reset);
  process.exit(1);
});
