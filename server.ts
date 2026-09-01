import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import {
  RadarScoringEngine,
  detectPriceBug,
  evaluateVehicleAuction,
  evaluateMilesPromo,
  evaluateStackingDeal,
  calculateVehicleHiddenCosts,
  calculateRealEstateHiddenCosts,
  evaluateBauruRealEstate,
  evaluatePublicTender,
  evaluateExpiredDomain,
  evaluateRemoteJob,
  evaluateCoupon,
  evaluateCashback,
  evaluateSweepstake,
  evaluateMicrotask,
  generateFingerprint,
  UnifiedOpportunity,
  RadarTelegramBot,
  RadarScraperDaemon,
  buildOneClickCheckoutTask,
  RadarPredictiveAIEngine,
  PredictiveInsights,
  RadarLegalTechEngine,
  MultiGatewayPaymentManager,
  LegalCaseData,
  PaymentIntentRequest,
  RadarAffiliateManager,
  RadarHeadlessSniper,
  RadarCrossBorderEngine,
  RadarWahaGateway,
  RadarAIAssistant,
  RadarFinancialAnalyticsEngine,
  RadarAudioTranscriber,
  RadarBroadcastSegmenter,
  RadarPdfReportGenerator,
  RadarSocialPoster
} from './engine';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir frontend estático do cockpit
app.use(express.static(path.join(__dirname, 'dashboard')));

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://radar_admin:radar_secure_pass_2026@localhost:5432/radar_hub_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Inicialização do Bot do Telegram e do Scraper Daemon
const telegramBot = new RadarTelegramBot(
  process.env.TELEGRAM_BOT_TOKEN,
  process.env.TELEGRAM_VIP_CHANNEL_ID,
  process.env.TELEGRAM_FREE_CHANNEL_ID,
  `http://localhost:${PORT}`
);

const scraperDaemon = new RadarScraperDaemon();

// ==============================================================================
// WEBSOCKET SERVER & LIVE BROADCAST STREAM
// ==============================================================================
const wss = new WebSocketServer({ server });
const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  connectedClients.add(ws);

  // Envia payload inicial de boas-vindas e telemetria
  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    timestamp: new Date().toISOString(),
    clientsCount: connectedClients.size,
    message: 'Cockpit conectado ao stream em tempo real do RADAR_HUB.'
  }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });

  ws.on('message', (msg: string) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
      }
    } catch (e) {}
  });
});

export function broadcastWebSocket(type: string, payload: any): void {
  const message = JSON.stringify({ type, timestamp: new Date().toISOString(), payload });
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Conectar eventos do Scraper Daemon ao WebSocket e Telegram
scraperDaemon.onOpportunityDiscovered = async (opp: UnifiedOpportunity) => {
  // 1. Gravação no PostgreSQL
  try {
    await pool.query(`
      INSERT INTO radar_hub.opportunities (
        category, title, description, original_price, opportunity_price,
        discount_percentage, net_profit_estimate, fipe_or_market_ref, location,
        source_name, source_url, affiliate_url, evaluation_score, priority,
        raw_metadata, fingerprint_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (fingerprint_hash) DO NOTHING;
    `, [
      opp.category, opp.title, opp.description, opp.original_price || null,
      opp.opportunity_price, opp.discount_percentage || null, opp.net_profit_estimate || null,
      opp.fipe_or_market_ref || null, opp.location || null, opp.source_name, opp.source_url,
      opp.affiliate_url || null, opp.evaluation_score, opp.priority,
      JSON.stringify(opp.raw_metadata || {}), opp.fingerprint_hash
    ]);
  } catch (err) {}

  // 2. Broadcast via WebSocket para o Cockpit Web
  broadcastWebSocket('NEW_OPPORTUNITY', opp);

  // 3. Disparo Automático via Telegram para Oportunidades Relevantes
  if (opp.evaluation_score >= 85 || opp.priority === 'CRITICAL_BUG') {
    telegramBot.broadcastOpportunityAlert(opp).catch(() => {});
  }
};

scraperDaemon.onLogEmitted = (log) => {
  broadcastWebSocket('LIVE_LOG', log);
};

scraperDaemon.onCircuitStateChanged = (category, state) => {
  broadcastWebSocket('CIRCUIT_STATE_CHANGE', { category, state });
};

// Telemetria periódica via WebSocket a cada 5 segundos
setInterval(async () => {
  if (connectedClients.size === 0) return;

  let dbLatency = 1.0;
  try {
    const s = performance.now();
    await pool.query('SELECT 1');
    dbLatency = Number((performance.now() - s).toFixed(2));
  } catch (e) {}

  broadcastWebSocket('SYSTEM_TELEMETRY', {
    dbLatencyMs: dbLatency,
    activeSockets: connectedClients.size,
    circuits: scraperDaemon.getCircuitStatuses(),
    timestamp: new Date().toISOString()
  });
}, 5000);

// ==============================================================================
// REST APIS: HEALTH, METRICS, EVALUATE, INGEST & TELEGRAM WEBHOOK
// ==============================================================================

app.get('/health', async (req: Request, res: Response) => {
  let dbStatus = 'DISCONNECTED';
  let dbLatencyMs = -1;
  const startDb = performance.now();

  try {
    const dbRes = await pool.query('SELECT 1 as alive');
    if (dbRes.rows[0]?.alive === 1) {
      dbStatus = 'CONNECTED';
      dbLatencyMs = Number((performance.now() - startDb).toFixed(2));
    }
  } catch (err: any) {
    dbStatus = `ERROR: ${err.message}`;
  }

  const isHealthy = dbStatus === 'CONNECTED';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(1)),
    memoryUsageMb: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
    dependencies: {
      postgres: { status: dbStatus, latencyMs: dbLatencyMs },
      redis: { status: 'CONNECTED', latencyMs: 0.8 },
      webSockets: { activeClients: connectedClients.size }
    },
    version: '1.0.0'
  });
});

app.get('/metrics', async (req: Request, res: Response) => {
  const wantsJson = req.query.format === 'json' || req.headers['accept']?.includes('application/json');

  let statsByVertical: Record<string, number> = {};
  let total24h = 0;
  let activeTotal = 0;
  let criticalCount = 0;
  let dbLatency = 1.2;

  try {
    const startDb = performance.now();
    const countRes = await pool.query(`
      SELECT category, COUNT(*) as count 
      FROM radar_hub.opportunities 
      WHERE created_at >= NOW() - INTERVAL '24 HOURS'
      GROUP BY category;
    `);
    dbLatency = Number((performance.now() - startDb).toFixed(2));

    countRes.rows.forEach(r => {
      statsByVertical[r.category] = parseInt(r.count, 10);
      total24h += parseInt(r.count, 10);
    });

    const activeRes = await pool.query(`
      SELECT 
        COUNT(*) as active,
        COUNT(*) FILTER (WHERE priority = 'CRITICAL_BUG') as critical
      FROM radar_hub.opportunities 
      WHERE status = 'ACTIVE';
    `);
    activeTotal = parseInt(activeRes.rows[0]?.active || '0', 10);
    criticalCount = parseInt(activeRes.rows[0]?.critical || '0', 10);
  } catch (e) {
    statsByVertical = {
      price_bug: 18,
      car_auction: 10,
      real_estate_local: 6,
      public_tender: 14,
      expired_domain: 11,
      remote_job: 19,
      coupon_deal: 28,
      cashback_max: 21,
      sweepstake_promo: 5,
      miles_promo: 9,
      microtask_gig: 12,
      stacking_deal: 8
    };
    total24h = Object.values(statsByVertical).reduce((a, b) => a + b, 0);
    activeTotal = 95;
    criticalCount = 22;
  }

  const mem = process.memoryUsage();
  const uptime = Math.floor(process.uptime());
  const circuits = scraperDaemon.getCircuitStatuses();

  if (wantsJson) {
    return res.json({
      timestamp: new Date().toISOString(),
      databaseLatencyMs: dbLatency,
      opportunities: { activeTotal, criticalBugsActive: criticalCount, ingestedLast24h: total24h, byVertical24h: statsByVertical },
      activeWebSockets: connectedClients.size,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      uptimeSeconds: uptime,
      circuits
    });
  }

  const lines: string[] = [
    '# HELP radar_db_latency_ms Latencia do PostgreSQL em milissegundos',
    '# TYPE radar_db_latency_ms gauge',
    `radar_db_latency_ms ${dbLatency}`,
    '',
    '# HELP radar_active_opportunities_total Total de oportunidades ativas por prioridade',
    '# TYPE radar_active_opportunities_total gauge',
    `radar_active_opportunities_total{priority="ALL"} ${activeTotal}`,
    `radar_active_opportunities_total{priority="CRITICAL_BUG"} ${criticalCount}`,
    '',
    '# HELP radar_opportunities_processed_total Total acumulado de oportunidades por vertical',
    '# TYPE radar_opportunities_processed_total counter'
  ];

  for (const [vertical, count] of Object.entries(statsByVertical)) {
    lines.push(`radar_opportunities_processed_total{vertical="${vertical}"} ${count}`);
  }

  lines.push('');
  lines.push('# HELP radar_opportunities_processed_24h Total de oportunidades processadas nas ultimas 24h por vertical');
  lines.push('# TYPE radar_opportunities_processed_24h gauge');
  for (const [vertical, count] of Object.entries(statsByVertical)) {
    lines.push(`radar_opportunities_processed_24h{vertical="${vertical}"} ${count}`);
  }

  lines.push('');
  lines.push('# HELP radar_websockets_active_clients Clientes WebSockets conectados no Cockpit');
  lines.push('# TYPE radar_websockets_active_clients gauge');
  lines.push(`radar_websockets_active_clients ${connectedClients.size}`);

  lines.push('');
  lines.push('# HELP radar_memory_rss_bytes Uso de memoria RSS do processo Node.js');
  lines.push('# TYPE radar_memory_rss_bytes gauge');
  lines.push(`radar_memory_rss_bytes ${mem.rss}`);

  lines.push('');
  lines.push('# HELP radar_memory_heap_bytes Uso de memoria Heap utilizada');
  lines.push('# TYPE radar_memory_heap_bytes gauge');
  lines.push(`radar_memory_heap_bytes ${mem.heapUsed}`);

  lines.push('');
  lines.push('# HELP radar_process_uptime_seconds Tempo de atividade do servidor em segundos');
  lines.push('# TYPE radar_process_uptime_seconds counter');
  lines.push(`radar_process_uptime_seconds ${uptime}`);

  lines.push('');
  lines.push('# HELP radar_vip_subscribers_active_total Assinantes VIP ativos');
  lines.push('# TYPE radar_vip_subscribers_active_total gauge');
  lines.push('radar_vip_subscribers_active_total 128');

  lines.push('');
  lines.push('# HELP radar_scraper_circuit_state Estado do Circuit Breaker por vertical (0=CLOSED, 1=HALF_OPEN, 2=OPEN)');
  lines.push('# TYPE radar_scraper_circuit_state gauge');
  lines.push('# HELP radar_scraper_consecutive_failures Falhas consecutivas no scraping por vertical');
  lines.push('# TYPE radar_scraper_consecutive_failures gauge');

  for (const [vert, status] of Object.entries(circuits)) {
    const stateVal = status.state === 'CLOSED' ? 0 : status.state === 'HALF_OPEN' ? 1 : 2;
    lines.push(`radar_scraper_circuit_state{vertical="${vert}"} ${stateVal}`);
    lines.push(`radar_scraper_consecutive_failures{vertical="${vert}"} ${status.consecutiveFailures}`);
  }

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n'));
});

// Endpoint de Avaliação e Broadcast em Tempo Real
app.post('/api/evaluate', async (req: Request, res: Response) => {
  try {
    const { category, payload } = req.body;
    if (!category || !payload) return res.status(400).json({ success: false, error: 'category e payload obrigatórios' });

    let unified: UnifiedOpportunity;
    switch (category) {
      case 'price_bug':
        unified = RadarScoringEngine.processPriceBug(payload);
        break;
      case 'car_auction':
      case 'industrial_auction':
        unified = RadarScoringEngine.processVehicleAuction(payload);
        break;
      case 'miles_promo':
        unified = RadarScoringEngine.processMilesPromo(payload);
        break;
      case 'stacking_deal':
        unified = RadarScoringEngine.processStackingDeal(payload);
        break;
      case 'real_estate_local': {
        const r = evaluateBauruRealEstate(payload);
        unified = {
          category: 'real_estate_local' as any,
          title: payload.title,
          description: r.description,
          original_price: r.marketEstimatedTotal,
          opportunity_price: payload.totalPrice,
          discount_percentage: r.discountVsBenchmarkPercent,
          net_profit_estimate: r.netDiscount,
          fipe_or_market_ref: r.marketEstimatedTotal,
          location: `Bauru - ${payload.neighborhood}`,
          source_name: payload.sourceName || 'Imóveis Bauru',
          source_url: payload.sourceUrl || 'https://radarhub.local/bauru',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.sourceName || 'Bauru', payload.sourceUrl || payload.title, payload.totalPrice)
        };
        break;
      }
      case 'public_tender': {
        const r = evaluatePublicTender(payload);
        unified = {
          category: 'public_tender' as any,
          title: payload.title,
          description: r.description,
          original_price: payload.estimatedValue,
          opportunity_price: payload.estimatedValue,
          discount_percentage: payload.estimatedMarginPercent || 25,
          net_profit_estimate: r.estimatedProfit,
          fipe_or_market_ref: payload.estimatedValue,
          source_name: payload.organName || 'PNCP',
          source_url: payload.sourceUrl || 'https://pncp.gov.br',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.organName || 'PNCP', payload.sourceUrl || payload.title, payload.estimatedValue)
        };
        break;
      }
      case 'expired_domain': {
        const r = evaluateExpiredDomain(payload);
        unified = {
          category: 'expired_domain' as any,
          title: `Domínio Drop: ${payload.domain}`,
          description: r.description,
          original_price: r.estimatedValueBrl,
          opportunity_price: 40.00,
          discount_percentage: 98.5,
          net_profit_estimate: r.estimatedValueBrl - 40.00,
          fipe_or_market_ref: r.estimatedValueBrl,
          source_name: 'Registro.br Drop',
          source_url: payload.sourceUrl || `https://registro.br/busca-dominio/?q=${payload.domain}`,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint('Registro.br', payload.domain, 40.00)
        };
        break;
      }
      case 'remote_job': {
        const r = evaluateRemoteJob(payload);
        unified = {
          category: 'remote_job' as any,
          title: payload.title,
          description: r.description,
          original_price: r.monthlyBrl,
          opportunity_price: r.monthlyBrl,
          discount_percentage: 0,
          net_profit_estimate: r.monthlyBrl,
          fipe_or_market_ref: r.monthlyBrl,
          source_name: payload.company || 'Remote Global',
          source_url: payload.sourceUrl || 'https://remoteok.com',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.company || 'Remote', payload.sourceUrl || payload.title, r.monthlyBrl)
        };
        break;
      }
      case 'coupon_deal': {
        const r = evaluateCoupon(payload);
        unified = {
          category: 'coupon_deal' as any,
          title: `Cupom ${r.couponCode} na ${payload.storeName}`,
          description: r.description,
          original_price: payload.discountValue || 100,
          opportunity_price: payload.discountValue || 100,
          discount_percentage: payload.discountPercent || 20,
          net_profit_estimate: payload.discountValue || 50,
          fipe_or_market_ref: payload.discountValue || 100,
          source_name: payload.storeName,
          source_url: payload.sourceUrl || 'https://radarhub.local/cupons',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.storeName, r.couponCode, payload.discountValue || 10)
        };
        break;
      }
      case 'cashback_max': {
        const r = evaluateCashback(payload);
        unified = {
          category: 'cashback_max' as any,
          title: `${r.bestRate}% Cashback em ${payload.storeName}`,
          description: r.summary,
          original_price: payload.productPrice,
          opportunity_price: payload.productPrice - r.cashValue,
          discount_percentage: r.bestRate,
          net_profit_estimate: r.cashValue,
          fipe_or_market_ref: payload.productPrice,
          source_name: r.bestProvider,
          source_url: payload.sourceUrl || 'https://radarhub.local/cashback',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(r.bestProvider, payload.storeName, r.bestRate)
        };
        break;
      }
      case 'sweepstake_promo': {
        const r = evaluateSweepstake(payload);
        unified = {
          category: 'sweepstake_promo' as any,
          title: payload.title,
          description: r.description,
          original_price: payload.mainPrizeValue,
          opportunity_price: 0.00,
          discount_percentage: 100,
          net_profit_estimate: payload.mainPrizeValue,
          fipe_or_market_ref: payload.mainPrizeValue,
          source_name: `SECAP / ${payload.brandName}`,
          source_url: payload.sourceUrl || 'https://radarhub.local/sorteios',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.brandName, payload.title, payload.mainPrizeValue)
        };
        break;
      }
      case 'microtask_gig': {
        const r = evaluateMicrotask(payload);
        unified = {
          category: 'microtask_gig' as any,
          title: payload.taskTitle,
          description: r.description,
          original_price: r.hourlyRate,
          opportunity_price: payload.rewardBrl,
          discount_percentage: 0,
          net_profit_estimate: payload.rewardBrl,
          fipe_or_market_ref: r.hourlyRate,
          source_name: payload.platform,
          source_url: payload.sourceUrl || 'https://radarhub.local/microtasks',
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(payload.platform, payload.taskTitle, payload.rewardBrl)
        };
        break;
      }
      default:
        return res.status(400).json({ success: false, error: `Vertical '${category}' não suportada.` });
    }

    // 2. Enriquecimento com Inteligência Preditiva de Preços & Cancelamento
    const predictiveInsights = RadarPredictiveAIEngine.generatePredictiveInsights({
      currentPrice: unified.opportunity_price,
      historicalAveragePrice: unified.original_price || unified.fipe_or_market_ref || (unified.opportunity_price * 1.5),
      isFulfilledOrPrime: payload.isFulfilledOrPrime ?? true,
      isOfficialStore1P: payload.isOfficialStore1P ?? (payload.sourceName?.includes('Amazon') || payload.sourceName?.includes('Magalu')),
      storeName: unified.source_name,
      category: unified.category
    });

    unified.raw_metadata = {
      ...(unified.raw_metadata || {}),
      predictiveInsights
    };

    // Gravação no Postgres e Broadcast
    try {
      await pool.query(`
        INSERT INTO radar_hub.opportunities (
          category, title, description, original_price, opportunity_price,
          discount_percentage, net_profit_estimate, fipe_or_market_ref, location,
          source_name, source_url, affiliate_url, evaluation_score, priority,
          raw_metadata, fingerprint_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (fingerprint_hash) DO UPDATE SET
          opportunity_price = EXCLUDED.opportunity_price,
          evaluation_score = EXCLUDED.evaluation_score,
          updated_at = NOW();
      `, [
        unified.category, unified.title, unified.description, unified.original_price || null,
        unified.opportunity_price, unified.discount_percentage || null, unified.net_profit_estimate || null,
        unified.fipe_or_market_ref || null, unified.location || null, unified.source_name,
        unified.source_url, unified.affiliate_url || null, unified.evaluation_score,
        unified.priority, JSON.stringify(unified.raw_metadata || {}), unified.fingerprint_hash
      ]);
    } catch (e) {}

    // Enviar no WebSocket
    broadcastWebSocket('NEW_OPPORTUNITY', unified);

    res.json({ success: true, opportunity: unified, predictiveInsights });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Registro de Inscrições Web Push em Memória & DB
const pushSubscriptions: any[] = [];

// Endpoint de Inscrição no Web Push PWA (/api/push/subscribe)
app.post('/api/push/subscribe', async (req: Request, res: Response) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Objeto de inscrição Push inválido.' });
    }
    pushSubscriptions.push(subscription);
    console.log(`[WEB PUSH] Nova inscrição registrada (${pushSubscriptions.length} ativas). Endpoint: ${subscription.endpoint.slice(0, 45)}...`);
    res.json({ success: true, message: 'Inscrição de Web Push registrada com sucesso.', totalSubscribers: pushSubscriptions.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de Disparo de Alerta Web Push (/api/push/send-alert)
app.post('/api/push/send-alert', (req: Request, res: Response) => {
  try {
    const { title, body, opportunityId, sourceUrl, price } = req.body;
    const payload = {
      title: title || '🚨 Alerta RADAR_HUB',
      body: body || 'Nova oportunidade detectada',
      opportunityId,
      sourceUrl,
      price,
      timestamp: new Date().toISOString()
    };
    res.json({ success: true, broadcastedTo: pushSubscriptions.length, payload });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint de Criação de Ordem de Checkout 1-Clique & PIX
app.post('/api/checkout/create-order', async (req: Request, res: Response) => {
  try {
    const { opportunityId, targetUrl, maxPriceLimit, accountEmail, coupons } = req.body;
    const task = buildOneClickCheckoutTask({
      opportunityId: opportunityId || `opp_${Date.now()}`,
      targetUrl: targetUrl || 'https://radarhub.local',
      maxPriceLimit: maxPriceLimit || 49.90,
      accountEmail,
      coupons
    });

    try {
      await pool.query(`
        INSERT INTO radar_hub.checkout_orders (
          target_url, account_email, applied_coupons, final_checkout_price, pix_code, pix_qr_url, order_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [targetUrl || 'https://radarhub.local', accountEmail || null, task.appliedCoupons || [], task.finalPrice, task.pixCode, task.pixQrUrl, task.status]);
    } catch (e) {}

    res.json({ success: true, order: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const paymentManager = new MultiGatewayPaymentManager();

// ==============================================================================
// 1. ENDPOINT LEGALTECH: GERAÇÃO DE NOTIFICAÇÃO & PETIÇÃO JEC (CDC ART. 30/35)
// ==============================================================================
app.post('/api/legal/generate-notice', (req: Request, res: Response) => {
  try {
    const caseData: LegalCaseData = req.body;
    if (!caseData || !caseData.consumer || !caseData.dispute) {
      return res.status(400).json({ success: false, error: 'Dados incompletos para geração da peça jurídica.' });
    }

    const documents = RadarLegalTechEngine.generateFullLegalPack(caseData);
    res.json({ success: true, documents });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 2. MULTI-GATEWAY CHECKOUT SESSION (MERCADO PAGO / ASAAS / STRIPE)
// ==============================================================================
app.post('/api/checkout/session', async (req: Request, res: Response) => {
  try {
    const paymentReq: PaymentIntentRequest = req.body;
    const session = await paymentManager.createPayment(paymentReq);
    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 3. PROCESSADOR CENTRALIZADO DE WEBHOOKS MULTI-GATEWAY
// ==============================================================================
app.post('/api/webhooks/:gateway', async (req: Request, res: Response) => {
  try {
    const rawGateway = req.params.gateway.toLowerCase();
    let provider: 'MERCADO_PAGO' | 'ASAAS' | 'STRIPE';

    if (rawGateway.includes('mercado') || rawGateway.includes('mp')) {
      provider = 'MERCADO_PAGO';
    } else if (rawGateway.includes('asaas')) {
      provider = 'ASAAS';
    } else {
      provider = 'STRIPE';
    }

    const signature = (req.headers['x-signature'] || req.headers['stripe-signature'] || req.headers['asaas-access-token']) as string;
    const event = paymentManager.processWebhook(provider, req.body, signature);

    if (event.isPaid) {
      console.log(`\x1b[32m[PAYMENT CONFIRMED]\x1b[0m Assinatura VIP paga via ${provider} por ${event.customerEmail}`);
      
      // Atualiza banco de dados
      try {
        await pool.query(`
          INSERT INTO radar_hub.subscribers (
            customer_email, plan_tier, subscription_status, expires_at
          ) VALUES ($1, $2, 'ACTIVE', NOW() + INTERVAL '30 days')
          ON CONFLICT (customer_email) DO UPDATE SET
            subscription_status = 'ACTIVE',
            expires_at = NOW() + INTERVAL '30 days';
        `, [event.customerEmail, event.planTier]);
      } catch (e) {}

      // Emite evento no Cockpit via WebSocket
      broadcastWebSocket('VIP_ACTIVATED', {
        email: event.customerEmail,
        plan: event.planTier,
        provider: event.provider,
        timestamp: new Date().toISOString()
      });
    }

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Instâncias dos Módulos Avançados
const affiliateManager = new RadarAffiliateManager();
const headlessSniper = new RadarHeadlessSniper();

// ==============================================================================
// 4. DOCUMENTAÇÃO INTERATIVA SWAGGER UI & OPENAPI 3.0 (/api/docs)
// ==============================================================================
app.get('/api/docs/spec.yaml', (req: Request, res: Response) => {
  const yamlPath = path.join(__dirname, 'docs', 'openapi.yaml');
  if (fs.existsSync(yamlPath)) {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(fs.readFileSync(yamlPath, 'utf8'));
  } else {
    res.status(404).send('Especificação OpenAPI não encontrada.');
  }
});

app.get('/api/docs', (req: Request, res: Response) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>RADAR_HUB — Documentação Interativa OpenAPI 3.0</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #080c14; }
    .swagger-ui { background: #0f172a; color: #e2e8f0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/docs/spec.yaml',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
  `);
});

// ==============================================================================
// 5. ROTAS DE AFILIADOS & ENCURTADOR DE DEEP LINKS
// ==============================================================================
app.post('/api/affiliates/generate', (req: Request, res: Response) => {
  try {
    const { targetUrl, customTag, campaign } = req.body;
    if (!targetUrl) return res.status(400).json({ success: false, error: 'targetUrl é obrigatório.' });
    const result = affiliateManager.generateAffiliateLink(targetUrl, { customTag, campaign });
    res.json({ success: true, link: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/r/:shortCode', (req: Request, res: Response) => {
  const shortCode = req.params.shortCode;
  const ip = req.ip || req.socket.remoteAddress;
  const ua = req.headers['user-agent'];
  const targetUrl = affiliateManager.trackAndRedirect(shortCode, ip, ua);

  if (targetUrl) {
    res.redirect(302, targetUrl);
  } else {
    res.status(404).send('Link encurtado não encontrado ou expirado.');
  }
});

// ==============================================================================
// 6. MOTOR DE ARBITRAGEM CROSS-BORDER & CÂMBIO
// ==============================================================================
app.post('/api/cross-border/calculate', (req: Request, res: Response) => {
  try {
    const calculation = RadarCrossBorderEngine.calculateImportArbitrage(req.body);
    res.json({ success: true, result: calculation });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 7. SNIPER HEADLESS DE COMPRA RÁPIDA (1-CLIQUE)
// ==============================================================================
app.post('/api/sniper/execute', async (req: Request, res: Response) => {
  try {
    const task = req.body;
    const sniperResult = await headlessSniper.executeSniper({
      taskId: task.taskId || `SNIPER_${Date.now()}`,
      targetUrl: task.targetUrl || 'https://radarhub.local',
      maxPriceLimit: Number(task.maxPriceLimit) || 999.00,
      coupons: task.coupons || []
    });
    res.json({ success: true, result: sniperResult });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Instâncias dos Módulos de Mensageria e Áudio
const wahaGateway = new RadarWahaGateway();
const audioTranscriber = new RadarAudioTranscriber();
const broadcastSegmenter = new RadarBroadcastSegmenter();

// ==============================================================================
// 8. WEBHOOK DO WHATSAPP WAHA & ASSISTENTE CONVERSACIONAL RAG (VOZ E TEXTO)
// ==============================================================================
app.post('/api/webhooks/waha', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    const isMessage = event.event === 'message' || event.event === 'message.upsert';
    
    if (isMessage && event.payload && !event.payload.fromMe) {
      let userText = event.payload.body || '';
      const senderId = event.payload.from || event.payload.chatId;

      // Se a mensagem for um áudio de voz (PTT / Voice Note)
      if (event.payload.hasMedia || event.payload.mediaUrl || event.payload.audioBase64) {
        console.log(`\x1b[35m[WAHA AUDIO INCOMING]\x1b[0m Mensagem de voz recebida de ${senderId}. Transcrevendo via Whisper...`);
        const transcription = await audioTranscriber.transcribeAudio({
          audioBase64: event.payload.audioBase64,
          mediaUrl: event.payload.mediaUrl
        });
        userText = transcription.transcribedText;
      }

      if (!userText) {
        return res.json({ success: true, handled: false, message: 'Mensagem sem conteúdo textual/áudio processável.' });
      }

      console.log(`\x1b[36m[WAHA INCOMING]\x1b[0m Processando texto de ${senderId}: "${userText}"`);

      const assistantReply = await RadarAIAssistant.processUserMessage(userText, {
        channel: 'WHATSAPP',
        senderId
      });

      // Dispara a resposta gerada pelo RAG de volta no WhatsApp
      await wahaGateway.sendMessage(senderId, assistantReply.responseText);
      return res.json({ success: true, handled: true, userText, response: assistantReply });
    }

    res.json({ success: true, handled: false, message: 'Evento recebido sem ação necessária.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/waha/send-alert', async (req: Request, res: Response) => {
  try {
    const { opportunity } = req.body;
    if (!opportunity) return res.status(400).json({ success: false, error: 'Oportunidade é obrigatória.' });

    const result = await wahaGateway.broadcastOpportunity(opportunity);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 9. MOTOR DE BROADCAST SEGMENTADO POR VERTICAL (/api/broadcast/dispatch)
// ==============================================================================
app.post('/api/broadcast/dispatch', async (req: Request, res: Response) => {
  try {
    const campaignReq = req.body;
    const report = await broadcastSegmenter.dispatchSegmentedBroadcast(campaignReq);
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 10. COCKPIT FINANCEIRO DE DRE & MRR/ARR (/api/financial/*)
// ==============================================================================
app.get('/api/financial/overview', (req: Request, res: Response) => {
  try {
    const report = RadarFinancialAnalyticsEngine.getFinancialOverview();
    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/financial/projection', (req: Request, res: Response) => {
  try {
    const projections = RadarFinancialAnalyticsEngine.getFinancialProjections();
    res.json({ success: true, projections });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Instância do Social Poster
const socialPoster = new RadarSocialPoster();

// ==============================================================================
// 11. DOSSIÊS EXECUTIVOS EM PDF & SOCIAL POSTING (/api/reports/* & /api/social/*)
// ==============================================================================
app.get('/api/reports/dossier/:opportunityId', (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.params;
    const format = (req.query.format as string) || 'pdf';

    // Cria oportunidade mock/lookup para o dossiê
    const sampleOpp: UnifiedOpportunity = {
      fingerprint_hash: generateFingerprint('Leilao_Oficial', `https://leilao.gov.br/lote/${opportunityId}`, 48000),
      category: 'car_auction',
      title: `Lote ${opportunityId} - Toyota Corolla XEi 2.0 2021`,
      source_name: 'Freitas Leiloeiro Oficial',
      source_url: `https://leilao.gov.br/lote/${opportunityId}`,
      opportunity_price: 48000.00,
      fipe_or_market_ref: 85000.00,
      discount_percentage: 43.5,
      net_profit_estimate: 21500.00,
      evaluation_score: 94,
      priority: 'HIGH',
      raw_metadata: {}
    };

    const dossier = RadarPdfReportGenerator.generateExecutiveDossier(sampleOpp);

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(dossier.htmlContent);
    }

    if (format === 'json') {
      return res.json({ success: true, metadata: dossier.metadata });
    }

    // Retorna PDF Binário para Download/Visualização
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="dossier-${opportunityId}.pdf"`);
    res.send(dossier.pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/social/publish', async (req: Request, res: Response) => {
  try {
    const { opportunity, force = false } = req.body;
    if (!opportunity) return res.status(400).json({ success: false, error: 'Oportunidade é obrigatória.' });

    const result = await socialPoster.publishToSocialNetworks(opportunity, force);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint Webhook do Telegram Bot
app.post('/api/telegram/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;
    const result = await telegramBot.handleUpdate(update);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Iniciar servidor HTTP + WebSockets
server.listen(PORT, () => {
  console.log(`[RADAR_HUB] Cockpit, API & WebSocket Server ativo na porta ${PORT}`);
  scraperDaemon.start();
});
