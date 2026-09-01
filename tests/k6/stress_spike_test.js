/**
 * ==============================================================================
 * RADAR_HUB - TESTE DE ESTRESSE & PICO SÚBITO (SPIKE TEST) GRAFANA k6
 * ==============================================================================
 * Simulação de Injeção Instantânea: 0 -> 500 VUs em 10 segundos
 * Cenário de Bug Crítico de Preço Viral (>80% OFF) / Disparo em Massa no Telegram.
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const spikeErrorRate = new Rate('spike_error_rate');
const spikeLatency = new Trend('spike_latency_ms');

export const options = {
  stages: [
    { duration: '5s', target: 20 },    // Linha de base rápida
    { duration: '10s', target: 500 },  // PICO SÚBITO (Disparo Viral Telegram)
    { duration: '20s', target: 500 },  // Sustentação sob pressão máxima
    { duration: '10s', target: 50 },   // Resfriamento
    { duration: '5s', target: 0 },     // Finalização
  ],
  thresholds: {
    'http_req_duration': ['p(95)<180', 'p(99)<350'],
    'spike_error_rate': ['rate<0.01'], // Menos de 1% de erro durante o pico de 500 VUs
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:3000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Payload de Bug Crítico (Score 98/100)
  const viralBugPayload = JSON.stringify({
    category: 'price_bug',
    payload: {
      title: `Smart TV 65 OLED 4K 120Hz (Flash Bug #${__VU})`,
      currentPrice: 699.00,
      historicalAveragePrice: 6999.00,
      isFulfilledOrPrime: true,
      sourceName: 'Amazon Brasil',
      sourceUrl: `https://amazon.com.br/dp/VIRAL_${__VU}`
    }
  });

  const res = http.post(
    `${BASE_URL}/api/evaluate`,
    viralBugPayload,
    { headers, tags: { name: 'POST /api/evaluate (VIRAL_BUG)' } }
  );

  spikeLatency.add(res.timings.duration);
  const success = check(res, {
    'spike evaluate status is 200': (r) => r.status === 200,
    'has priority CRITICAL_BUG': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.opportunity.priority === 'CRITICAL_BUG';
      } catch (e) {
        return false;
      }
    }
  });

  spikeErrorRate.add(!success);

  // Tentativa de Checkout Instantâneo por 50% dos VUs
  if (Math.random() < 0.5) {
    const checkoutRes = http.post(
      `${BASE_URL}/api/checkout/create-order`,
      JSON.stringify({
        opportunityId: `spike_order_${__VU}_${Date.now()}`,
        targetUrl: 'https://amazon.com.br/dp/VIRAL',
        maxPriceLimit: 699.00,
        accountEmail: `buyer_${__VU}@radarhub.com`
      }),
      { headers, tags: { name: 'POST /api/checkout/create-order (SPIKE)' } }
    );

    check(checkoutRes, {
      'spike checkout is 200': (r) => r.status === 200
    });
  }

  sleep(0.02); // 20ms entre iterações
}
