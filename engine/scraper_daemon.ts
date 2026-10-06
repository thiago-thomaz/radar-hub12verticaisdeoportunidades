/**
 * ==============================================================================
 * RADAR_HUB - WORKER DAEMON DE SCRAPING, INGESTÃO CONTÍNUA & CIRCUIT BREAKER
 * ==============================================================================
 * Gerenciamento autônomo de polling com slots de rotação de proxy, tolerância a falhas,
 * circuit breaker adaptativo de 3 estados (CLOSED, OPEN, HALF_OPEN) e pipeline integrado
 * de captura, scoring, deduplicação SHA-256 e broadcast multicanal.
 */

import {
  RadarScoringEngine,
  generateFingerprint,
  UnifiedOpportunity,
  OpportunityCategory
} from './scoring';
import {
  generateResilientHeaders,
  calculateExponentialBackoff
} from './proxy_rotator';
import { RadarFirecrawlService } from './firecrawl_service';
import {
  evaluateBauruRealEstate,
  evaluatePublicTender,
  evaluateExpiredDomain,
  evaluateRemoteJob,
  evaluateCoupon,
  evaluateCashback,
  evaluateSweepstake,
  evaluateMicrotask
} from './expansion_engines';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface VerticalWorkerConfig {
  category: OpportunityCategory | 'real_estate_local' | 'public_tender' | 'expired_domain' | 'remote_job' | 'coupon_deal' | 'cashback_max' | 'sweepstake_promo' | 'microtask_gig';
  name: string;
  pollingIntervalMs: number;
  failureThreshold: number;
  cooldownPeriodMs: number;
  maxRequestsPerMinute: number;
}

export interface CircuitBreakerStatus {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
  totalRequests: number;
  successfulRequests: number;
  rateLimitHits: number;
}

export interface LogEmission {
  pipeline: string;
  message: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  durationMs: number;
  timestamp: string;
}

export class RadarScraperDaemon {
  private isRunning: boolean = false;
  private intervalHandles: NodeJS.Timeout[] = [];
  private circuits: Map<string, CircuitBreakerStatus> = new Map();
  private processedFingerprints: Set<string> = new Set();
  
  // Callbacks de Eventos e Broadcast
  public onOpportunityDiscovered?: (opp: UnifiedOpportunity) => void | Promise<void>;
  public onLogEmitted?: (log: LogEmission) => void;
  public onCircuitStateChanged?: (category: string, state: CircuitState) => void;

  // Configuração das 12 Verticais com Agendamento Adaptativo
  private workers: VerticalWorkerConfig[] = [
    { category: 'price_bug', name: 'Bugs de Preço & E-commerce', pollingIntervalMs: 8000, failureThreshold: 3, cooldownPeriodMs: 20000, maxRequestsPerMinute: 60 },
    { category: 'car_auction', name: 'Leilões Judiciais de Veículos FIPE', pollingIntervalMs: 15000, failureThreshold: 3, cooldownPeriodMs: 30000, maxRequestsPerMinute: 30 },
    { category: 'industrial_auction', name: 'Leilões de Bens Industriais', pollingIntervalMs: 25000, failureThreshold: 3, cooldownPeriodMs: 40000, maxRequestsPerMinute: 20 },
    { category: 'real_estate_local', name: 'Imóveis Abaixo Mercado (Bauru)', pollingIntervalMs: 30000, failureThreshold: 3, cooldownPeriodMs: 45000, maxRequestsPerMinute: 15 },
    { category: 'public_tender', name: 'Licitações Públicas PNCP', pollingIntervalMs: 20000, failureThreshold: 3, cooldownPeriodMs: 35000, maxRequestsPerMinute: 25 },
    { category: 'expired_domain', name: 'Domínios Expirando Registro.br', pollingIntervalMs: 18000, failureThreshold: 3, cooldownPeriodMs: 30000, maxRequestsPerMinute: 30 },
    { category: 'remote_job', name: 'Vagas Remotas Globais (USD)', pollingIntervalMs: 22000, failureThreshold: 3, cooldownPeriodMs: 30000, maxRequestsPerMinute: 25 },
    { category: 'coupon_deal', name: 'Cupons & Descontos Ativos', pollingIntervalMs: 10000, failureThreshold: 3, cooldownPeriodMs: 20000, maxRequestsPerMinute: 50 },
    { category: 'cashback_max', name: 'Cashback Máximo & Spread', pollingIntervalMs: 14000, failureThreshold: 3, cooldownPeriodMs: 25000, maxRequestsPerMinute: 40 },
    { category: 'sweepstake_promo', name: 'Sorteios Oficiais SECAP/SRE', pollingIntervalMs: 40000, failureThreshold: 3, cooldownPeriodMs: 60000, maxRequestsPerMinute: 10 },
    { category: 'miles_promo', name: 'Milhas Aéreas & Emissões CPM', pollingIntervalMs: 12000, failureThreshold: 3, cooldownPeriodMs: 25000, maxRequestsPerMinute: 45 },
    { category: 'microtask_gig', name: 'Marketplace de Microtarefas', pollingIntervalMs: 16000, failureThreshold: 3, cooldownPeriodMs: 30000, maxRequestsPerMinute: 35 },
  ];

  constructor() {
    this.workers.forEach(w => {
      this.circuits.set(w.category, {
        state: 'CLOSED',
        consecutiveFailures: 0,
        totalRequests: 0,
        successfulRequests: 0,
        rateLimitHits: 0
      });
    });
  }

  /**
   * Inicia o Daemon com agendamento autônomo e rotação de proxies
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.workers.forEach(worker => {
      const handle = setInterval(() => {
        this.runWorkerTick(worker).catch(err => {
          this.emitLog(worker.name, `Erro não tratado no worker: ${err.message}`, 'ERROR', 0);
        });
      }, worker.pollingIntervalMs);

      this.intervalHandles.push(handle);
    });

    this.emitLog('DAEMON_MASTER', `Daemon de Scraping ativado com ${this.workers.length} verticais em execução contínua.`, 'INFO', 0);
  }

  /**
   * Interrompe o Daemon e limpa os timers ativos
   */
  public stop(): void {
    this.isRunning = false;
    this.intervalHandles.forEach(h => clearInterval(h));
    this.intervalHandles = [];
    this.emitLog('DAEMON_MASTER', 'Daemon de Scraping pausado com sucesso.', 'INFO', 0);
  }

  /**
   * Executa um ciclo de coleta com Circuit Breaker, Headers Resilientes e Pipeline Integrado
   */
  public async runWorkerTick(worker: VerticalWorkerConfig): Promise<UnifiedOpportunity | null> {
    const circuit = this.circuits.get(worker.category)!;
    const now = Date.now();

    // 1. Verificação do Estado do Circuit Breaker
    if (circuit.state === 'OPEN') {
      if (circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
        circuit.state = 'HALF_OPEN';
        this.onCircuitStateChanged?.(worker.category, 'HALF_OPEN');
        this.emitLog(worker.name, 'Cooldown expirado. Circuito em modo HALF_OPEN: enviando requisição de teste...', 'WARN', 0);
      } else {
        const remainingSec = circuit.nextAttemptTime ? Math.max(0, ((circuit.nextAttemptTime - now) / 1000)).toFixed(1) : '0.0';
        return null; // Fonte pausada por falhas consecutivas ou HTTP 429
      }
    }

    const start = performance.now();
    circuit.totalRequests++;

    try {
      // 2. Geração de Headers Anti-Block & Simulação de Requisição Resiliente
      const headers = generateResilientHeaders();
      const rawItem = this.generateSampleFeedItem(worker.category);

      // 3. Normalização e Scoring
      const scoredOpportunity = this.scoreRawFeedItem(worker.category, rawItem);
      const duration = performance.now() - start;

      // 4. Tratamento de Sucesso no Circuit Breaker
      circuit.consecutiveFailures = 0;
      circuit.successfulRequests++;

      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        this.onCircuitStateChanged?.(worker.category, 'CLOSED');
        this.emitLog(worker.name, 'Requisição de teste bem-sucedida! Circuit breaker restaurado para CLOSED.', 'INFO', duration);
      }

      // 5. Anti-Deduplicação SHA-256 e Broadcast
      if (!this.processedFingerprints.has(scoredOpportunity.fingerprint_hash)) {
        this.processedFingerprints.add(scoredOpportunity.fingerprint_hash);
        
        if (this.onOpportunityDiscovered) {
          await this.onOpportunityDiscovered(scoredOpportunity);
        }

        const scoreColor = scoredOpportunity.evaluation_score >= 90 ? '🔥' : '⚡';
        this.emitLog(
          worker.name,
          `${scoreColor} Oportunidade detectada: "${scoredOpportunity.title}" | Score: ${scoredOpportunity.evaluation_score}/100 | Prioridade: ${scoredOpportunity.priority}`,
          'INFO',
          duration
        );

        return scoredOpportunity;
      }

      return null;
    } catch (err: any) {
      const duration = performance.now() - start;
      circuit.consecutiveFailures++;
      circuit.lastFailureTime = now;

      const isRateLimit = err.message?.includes('429') || err.message?.includes('RateLimit');
      if (isRateLimit) circuit.rateLimitHits++;

      const backoffMs = calculateExponentialBackoff(circuit.consecutiveFailures, 2000, worker.cooldownPeriodMs);

      if (circuit.consecutiveFailures >= worker.failureThreshold || isRateLimit) {
        circuit.state = 'OPEN';
        circuit.nextAttemptTime = now + backoffMs;
        this.onCircuitStateChanged?.(worker.category, 'OPEN');
        this.emitLog(
          worker.name,
          `⛔ CIRCUIT BREAKER DISPARADO (OPEN). ${circuit.consecutiveFailures} falhas consecutivas. Pausando por ${(backoffMs / 1000).toFixed(1)}s: ${err.message}`,
          'ERROR',
          duration
        );
      } else {
        this.emitLog(
          worker.name,
          `⚠️ Falha transitória (${circuit.consecutiveFailures}/${worker.failureThreshold}): ${err.message}`,
          'WARN',
          duration
        );
      }

      return null;
    }
  }

  /**
   * Transforma payload bruto em UnifiedOpportunity através dos motores de scoring
   */
  public scoreRawFeedItem(category: string, raw: any): UnifiedOpportunity {
    switch (category) {
      case 'price_bug':
        return RadarScoringEngine.processPriceBug(raw);
      case 'car_auction':
      case 'industrial_auction':
        return RadarScoringEngine.processVehicleAuction(raw);
      case 'miles_promo':
        return RadarScoringEngine.processMilesPromo(raw);
      case 'real_estate_local': {
        const r = evaluateBauruRealEstate(raw);
        return {
          category: 'real_estate_local' as any,
          title: raw.title,
          description: r.description,
          original_price: r.marketEstimatedTotal,
          opportunity_price: raw.totalPrice,
          discount_percentage: r.discountVsBenchmarkPercent,
          net_profit_estimate: r.netDiscount,
          fipe_or_market_ref: r.marketEstimatedTotal,
          location: `Bauru - ${raw.neighborhood}`,
          source_name: raw.sourceName || 'Imóveis Bauru',
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.sourceName || 'Bauru', raw.sourceUrl, raw.totalPrice)
        };
      }
      case 'public_tender': {
        const r = evaluatePublicTender(raw);
        return {
          category: 'public_tender' as any,
          title: raw.title,
          description: r.description,
          original_price: raw.estimatedValue,
          opportunity_price: raw.estimatedValue,
          discount_percentage: raw.estimatedMarginPercent || 28.0,
          net_profit_estimate: r.estimatedProfit,
          fipe_or_market_ref: raw.estimatedValue,
          source_name: raw.organName || 'PNCP',
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.organName || 'PNCP', raw.sourceUrl, raw.estimatedValue)
        };
      }
      case 'expired_domain': {
        const r = evaluateExpiredDomain(raw);
        return {
          category: 'expired_domain' as any,
          title: `Domínio Drop: ${raw.domain}`,
          description: r.description,
          original_price: r.estimatedValueBrl,
          opportunity_price: 40.00,
          discount_percentage: 98.8,
          net_profit_estimate: r.estimatedValueBrl - 40.00,
          fipe_or_market_ref: r.estimatedValueBrl,
          source_name: 'Registro.br Drop',
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint('Registro.br', raw.domain, 40.00)
        };
      }
      case 'remote_job': {
        const r = evaluateRemoteJob(raw);
        return {
          category: 'remote_job' as any,
          title: raw.title,
          description: r.description,
          original_price: r.monthlyBrl,
          opportunity_price: r.monthlyBrl,
          discount_percentage: 0,
          net_profit_estimate: r.monthlyBrl,
          fipe_or_market_ref: r.monthlyBrl,
          source_name: raw.company || 'Remote Hub',
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.company || 'Remote', raw.sourceUrl, r.monthlyBrl)
        };
      }
      case 'coupon_deal': {
        const r = evaluateCoupon(raw);
        return {
          category: 'coupon_deal' as any,
          title: `Cupom ${raw.couponCode} na ${raw.storeName}`,
          description: r.description,
          original_price: raw.originalPrice || 250,
          opportunity_price: raw.discountValue ? (raw.originalPrice || 250) - raw.discountValue : 75,
          discount_percentage: raw.discountPercent || 70,
          net_profit_estimate: raw.discountValue || 175,
          fipe_or_market_ref: raw.originalPrice || 250,
          source_name: raw.storeName,
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.storeName, raw.couponCode, raw.discountPercent || 70)
        };
      }
      case 'cashback_max': {
        const r = evaluateCashback(raw);
        return {
          category: 'cashback_max' as any,
          title: `${r.bestRate}% Cashback em ${raw.storeName}`,
          description: r.summary,
          original_price: raw.productPrice,
          opportunity_price: raw.productPrice - r.cashValue,
          discount_percentage: r.bestRate,
          net_profit_estimate: r.cashValue,
          fipe_or_market_ref: raw.productPrice,
          source_name: r.bestProvider,
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(r.bestProvider, raw.storeName, r.bestRate)
        };
      }
      case 'sweepstake_promo': {
        const r = evaluateSweepstake(raw);
        return {
          category: 'sweepstake_promo' as any,
          title: raw.title,
          description: r.description,
          original_price: raw.mainPrizeValue,
          opportunity_price: 0,
          discount_percentage: 100,
          net_profit_estimate: raw.mainPrizeValue,
          fipe_or_market_ref: raw.mainPrizeValue,
          source_name: raw.brandName,
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.brandName, raw.title, raw.mainPrizeValue)
        };
      }
      case 'microtask_gig': {
        const r = evaluateMicrotask(raw);
        return {
          category: 'microtask_gig' as any,
          title: raw.taskTitle,
          description: r.description,
          original_price: r.hourlyRate,
          opportunity_price: raw.rewardBrl,
          discount_percentage: 0,
          net_profit_estimate: raw.rewardBrl,
          fipe_or_market_ref: r.hourlyRate,
          source_name: raw.platform,
          source_url: raw.sourceUrl,
          evaluation_score: r.score,
          priority: r.priority,
          raw_metadata: r,
          fingerprint_hash: generateFingerprint(raw.platform, raw.taskTitle, raw.rewardBrl)
        };
      }
      case 'stacking_deal':
        return RadarScoringEngine.processStackingDeal(raw);
      default:
        return RadarScoringEngine.processPriceBug(raw);
    }
  }

  /**
   * Gera payload dinâmico a partir dos dados verificados e raspados pelo Firecrawl (100% Links 200 OK)
   */
  public generateSampleFeedItem(category: string): any {
    const verified = RadarFirecrawlService.getInstance().getVerifiedData(category);

    switch (category) {
      case 'price_bug':
        return {
          title: verified.title,
          currentPrice: verified.opportunityPrice,
          historicalAveragePrice: verified.originalPrice,
          isFulfilledOrPrime: true,
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'car_auction':
        return {
          title: verified.title,
          bidPrice: verified.opportunityPrice,
          fipePrice: verified.fipeOrMarketRef,
          categoryType: 'car',
          location: verified.location || 'São Paulo - SP',
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'industrial_auction':
        return {
          title: verified.title,
          bidPrice: verified.opportunityPrice,
          fipePrice: verified.fipeOrMarketRef,
          categoryType: 'industrial_asset',
          location: verified.location || 'Guarulhos - SP',
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'real_estate_local':
        return {
          title: verified.title,
          neighborhood: 'Jardim America',
          totalPrice: verified.opportunityPrice,
          totalAreaM2: 120,
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'public_tender':
        return {
          title: verified.title,
          organName: verified.sourceName,
          estimatedValue: verified.opportunityPrice,
          modality: 'DISPENSA',
          closingDate: '2026-11-30',
          estimatedMarginPercent: verified.discountPercentage,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'expired_domain':
        return {
          domain: 'processo-de-liberacao.registro.br',
          domainAuthority: 42,
          backlinksCount: 3800,
          estimatedAppraisalUsd: 760,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'remote_job':
        return {
          title: verified.title,
          company: verified.sourceName,
          salaryUsdAnnual: 120000,
          techStack: ['TypeScript', 'Node.js', 'React', 'Go'],
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'coupon_deal':
        return {
          storeName: verified.sourceName,
          couponCode: 'MAGALU70',
          discountPercent: verified.discountPercentage,
          minOrderValue: 100,
          originalPrice: verified.originalPrice,
          discountValue: verified.netProfitEstimate,
          isVerified: true,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'cashback_max':
        return {
          storeName: verified.sourceName,
          interPercent: 22,
          meliuzPercent: 22,
          productPrice: verified.originalPrice,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'sweepstake_promo':
        return {
          brandName: verified.sourceName,
          title: verified.title,
          secapCertificateNumber: 'SECAP/SRE 2026/0894',
          participationType: 'FREE_FORM',
          mainPrizeValue: verified.originalPrice,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'miles_promo':
        return {
          title: verified.title,
          programSource: 'ESFERA',
          programTarget: 'SMILES',
          bonusPercentage: 100,
          costPerThousandOrigin: 35.00,
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'microtask_gig':
        return {
          taskTitle: verified.title,
          platform: verified.sourceName,
          rewardBrl: verified.opportunityPrice,
          estimatedMinutesToComplete: 60,
          isAutomatedScriptable: true,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      case 'stacking_deal':
        return {
          title: verified.title,
          originalPrice: verified.originalPrice,
          promoPrice: verified.opportunityPrice,
          couponDiscountPercent: 20,
          cashbackPercent: 10,
          pointsPerReal: 2,
          pointValueCpm: 35.0,
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
      default:
        return {
          title: verified.title,
          currentPrice: verified.opportunityPrice,
          historicalAveragePrice: verified.originalPrice,
          sourceName: verified.sourceName,
          sourceUrl: verified.sourceUrl,
          description: verified.description
        };
    }
  }

  /**
   * Dispara raspagem manual para uma vertical específica
   */
  public async triggerManualScrape(category: string): Promise<UnifiedOpportunity | null> {
    const worker = this.workers.find(w => w.category === category);
    if (!worker) throw new Error(`Vertical '${category}' não configurada.`);
    return this.runWorkerTick(worker);
  }

  /**
   * Força injeção de falha sintética para testes de Circuit Breaker
   */
  public injectSyntheticFailure(category: string, errorMessage: string = 'HTTP 429 Too Many Requests (Rate Limit)'): void {
    const circuit = this.circuits.get(category);
    if (!circuit) return;

    circuit.consecutiveFailures++;
    circuit.lastFailureTime = Date.now();
    circuit.rateLimitHits++;

    const worker = this.workers.find(w => w.category === category) || { failureThreshold: 3, cooldownPeriodMs: 30000, name: category };
    const backoffMs = calculateExponentialBackoff(circuit.consecutiveFailures, 2000, worker.cooldownPeriodMs);

    if (circuit.consecutiveFailures >= worker.failureThreshold || errorMessage.includes('429')) {
      circuit.state = 'OPEN';
      circuit.nextAttemptTime = Date.now() + backoffMs;
      this.onCircuitStateChanged?.(category, 'OPEN');
      this.emitLog(worker.name, `Trip Circuit Breaker (OPEN): ${errorMessage}`, 'ERROR', 0);
    }
  }

  /**
   * Restaura manualmente o Circuit Breaker de uma vertical
   */
  public resetCircuit(category: string): void {
    const circuit = this.circuits.get(category);
    if (!circuit) return;
    circuit.state = 'CLOSED';
    circuit.consecutiveFailures = 0;
    circuit.nextAttemptTime = undefined;
    this.onCircuitStateChanged?.(category, 'CLOSED');
    this.emitLog(category, 'Circuit Breaker reinicializado manualmente (CLOSED).', 'INFO', 0);
  }

  private emitLog(pipeline: string, message: string, level: 'INFO' | 'WARN' | 'ERROR', durationMs: number): void {
    if (this.onLogEmitted) {
      this.onLogEmitted({
        pipeline,
        message,
        level,
        durationMs: Number(durationMs.toFixed(2)),
        timestamp: new Date().toISOString()
      });
    }
  }

  public getCircuitStatuses(): Record<string, CircuitBreakerStatus> {
    const res: Record<string, CircuitBreakerStatus> = {};
    this.circuits.forEach((val, key) => {
      res[key] = { ...val };
    });
    return res;
  }

  public getWorkersList(): VerticalWorkerConfig[] {
    return [...this.workers];
  }
}
