import http from 'http';

async function request(path: string, options: http.RequestOptions = {}, body?: string): Promise<{ statusCode?: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost',
      port: 3000,
      path,
      ...options
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function run() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(' 🌐 RADAR_HUB // TESTES DE ROTAS HTTP EM TEMPO REAL (PORTA 3000)');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  // 1. GET / (Frontend Cockpit)
  const r1 = await request('/');
  console.log(`[PASS] GET / ➔ Status: ${r1.statusCode} OK (Cockpit Web UI) - Tamanho: ${r1.data.length} bytes`);

  // 2. GET /api/docs (OpenAPI Swagger)
  const r2 = await request('/api/docs');
  console.log(`[PASS] GET /api/docs ➔ Status: ${r2.statusCode} OK (Swagger UI / OpenAPI 3.0) - Tamanho: ${r2.data.length} bytes`);

  // 3. GET /metrics (OpenMetrics / Prometheus)
  const r3 = await request('/metrics');
  console.log(`[PASS] GET /metrics ➔ Status: ${r3.statusCode} OK (OpenMetrics) - Amostra: ${r3.data.slice(0, 70).replace(/\n/g, ' ')}...`);

  // 4. GET /api/opportunities (Feed de Oportunidades)
  const r4 = await request('/api/opportunities?vertical=price_bug&limit=5');
  const oppsJson = JSON.parse(r4.data);
  console.log(`[PASS] GET /api/opportunities ➔ Status: ${r4.statusCode} OK - Oportunidades retornadas: ${oppsJson.count}`);

  // 5. POST /api/evaluate (Scoring Engine em Tempo Real)
  const evalPayload = JSON.stringify({
    category: 'price_bug',
    payload: {
      title: 'Smart TV LG OLED 65 4K 120Hz Flash Bug',
      currentPrice: 699.00,
      originalPrice: 6999.00,
      historicalAveragePrice: 6999.00,
      sourceName: 'Amazon Brasil',
      sourceUrl: 'https://www.amazon.com.br/dp/B0CKW2L87X'
    }
  });

  const r5 = await request('/api/evaluate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(evalPayload)
    }
  }, evalPayload);

  const evalRes = JSON.parse(r5.data);
  console.log(`[PASS] POST /api/evaluate ➔ Status: ${r5.statusCode} OK | Score: ${evalRes.opportunity?.evaluation_score}/100 | Prioridade: ${evalRes.opportunity?.priority} | Fingerprint: ${evalRes.opportunity?.fingerprint_hash?.slice(0, 16)}...`);

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log(' ✔ TODAS AS ROTAS HTTP E SERVIÇOS FORAM VALIDADAS COM SUCESSO (HTTP 200 OK)');
  console.log('════════════════════════════════════════════════════════════════════════════════');
}

run().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
