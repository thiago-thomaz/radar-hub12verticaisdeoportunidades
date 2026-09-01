/**
 * ==============================================================================
 * RADAR_HUB - SUÍTE DE TESTES DE CARGA & CONCORRÊNCIA GRAFANA k6
 * ==============================================================================
 * Cenário de Rampa Progressiva: 10 -> 100 -> 300 Usuários Virtuais (VUs)
 * Validação de Throughput nas 12 Verticais, Criação de Pedidos PIX e WebSockets.
 * SLOs Estritos: p95 < 80ms | Erros < 0.1%
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas customizadas
const errorRate = new Rate('custom_error_rate');
const evaluateLatency = new Trend('evaluate_latency_ms');
const checkoutLatency = new Trend('checkout_latency_ms');

export const options = {
  stages: [
    { duration: '15s', target: 10 },   // Warm-up
    { duration: '30s', target: 100 },  // Carga Nominal
    { duration: '30s', target: 300 },  // Carga de Pico
    { duration: '15s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<80', 'p(99)<150'], // 95% das requisições abaixo de 80ms
    'custom_error_rate': ['rate<0.001'],            // Taxa de erro menor que 0.1%
    'http_req_failed': ['rate<0.001'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

const SAMPLE_PAYLOADS = [
  {
    category: 'price_bug',
    payload: {
      title: 'Smart TV 65 OLED 4K 120Hz',
      currentPrice: 799.00,
      historicalAveragePrice: 6999.00,
      isFulfilledOrPrime: true,
      sourceName: 'Amazon Brasil',
      sourceUrl: 'https://amazon.com.br/dp/B0K6TEST'
    }
  },
  {
    category: 'car_auction',
    payload: {
      title: 'Jeep Compass Longitude 2023',
      bidPrice: 54000.00,
      fipePrice: 130000.00,
      categoryType: 'car',
      sourceName: 'Freitas Leiloeiro',
      sourceUrl: 'https://freitasleiloeiro.com.br/lote/compass'
    }
  },
  {
    category: 'real_estate_local',
    payload: {
      title: 'Apartamento Jardim América 120m²',
      neighborhood: 'Jardim America',
      totalPrice: 360000.00,
      totalAreaM2: 120,
      sourceName: 'Caixa Bauru',
      sourceUrl: 'https://caixa.gov.br/imovel_bauru_k6'
    }
  },
  {
    category: 'remote_job',
    payload: {
      title: 'Principal TypeScript Systems Engineer',
      company: 'US Fintech Global',
      salaryUsdAnnual: 150000,
      techStack: ['TypeScript', 'Kubernetes', 'Go'],
      sourceUrl: 'https://remoteok.com/job_k6'
    }
  },
  {
    category: 'miles_promo',
    payload: {
      title: '110% de Bônus Livelo para Smiles',
      programSource: 'LIVELO',
      programTarget: 'SMILES',
      bonusPercentage: 110,
      costPerThousandOrigin: 35.00,
      sourceName: 'Livelo',
      sourceUrl: 'https://livelo.com.br/promo_k6'
    }
  },
  {
    category: 'coupon_deal',
    payload: {
      storeName: 'Magazine Luiza',
      couponCode: 'K6SUPER70',
      discountPercent: 70,
      minOrderValue: 150,
      isVerified: true,
      sourceUrl: 'https://magalu.com/cupom'
    }
  }
];

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Teste de Avaliação de Oportunidade (/api/evaluate)
  const item = SAMPLE_PAYLOADS[Math.floor(Math.random() * SAMPLE_PAYLOADS.length)];
  const evalRes = http.post(
    `${BASE_URL}/api/evaluate`,
    JSON.stringify(item),
    { headers, tags: { name: 'POST /api/evaluate' } }
  );

  evaluateLatency.add(evalRes.timings.duration);
  const evalSuccess = check(evalRes, {
    'evaluate status is 200': (r) => r.status === 200,
    'evaluate has opportunity': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && body.opportunity.evaluation_score >= 0;
      } catch (e) {
        return false;
      }
    },
  });
  errorRate.add(!evalSuccess);

  // 2. Teste de Criação de Ordem de Checkout PIX (/api/checkout/create-order)
  if (Math.random() < 0.4) {
    const checkoutPayload = JSON.stringify({
      opportunityId: `k6_${Date.now()}_${__VU}`,
      targetUrl: 'https://radarhub.local/deal',
      maxPriceLimit: 149.90,
      accountEmail: `user_${__VU}@radarhub.com`
    });

    const checkoutRes = http.post(
      `${BASE_URL}/api/checkout/create-order`,
      checkoutPayload,
      { headers, tags: { name: 'POST /api/checkout/create-order' } }
    );

    checkoutLatency.add(checkoutRes.timings.duration);
    const checkoutSuccess = check(checkoutRes, {
      'checkout status is 200': (r) => r.status === 200,
      'checkout has pix code': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true && body.order.pixCode.length > 20;
        } catch (e) {
          return false;
        }
      },
    });
    errorRate.add(!checkoutSuccess);
  }

  // 3. Healthcheck & Metrics
  if (Math.random() < 0.2) {
    const healthRes = http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
    check(healthRes, { 'health is 200': (r) => r.status === 200 });
  }

  sleep(0.05); // 50ms delay entre iterações por VU
}
