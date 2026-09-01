/**
 * ==============================================================================
 * RADAR_HUB - SCRIPT DE BOOTSTRAP, MIGRAÇÃO E VALIDAÇÃO DE MOTORES (SMOKE TEST)
 * ==============================================================================
 */

let Client: any = null;
try {
  const pgModule = require('pg');
  Client = pgModule.Client;
} catch (e) {
  // Client will be loaded if pg is available
}

try {
  const dotenv = require('dotenv');
  dotenv.config();
} catch (e) {
  // dotenv fallback
}

import * as fs from 'fs';
import * as path from 'path';
import {
  RadarScoringEngine,
  detectPriceBug,
  evaluateVehicleAuction,
  evaluateMilesPromo,
  evaluateStackingDeal,
  calculateVehicleHiddenCosts,
  calculateRealEstateHiddenCosts,
  evaluateCoupon,
  evaluateCashback,
  evaluateSweepstake,
  evaluateBauruRealEstate,
  evaluatePublicTender,
  evaluateExpiredDomain,
  evaluateRemoteJob,
  evaluateMicrotask,
  generateResilientHeaders,
  calculateExponentialBackoff,
  processPaymentEvent,
  formatVipWelcomeMessage,
  buildOneClickCheckoutTask
} from '../engine';

interface TestResult {
  suite: string;
  name: string;
  status: 'OK' | 'FAIL';
  durationMs: number;
  details?: string;
}

const results: TestResult[] = [];

function recordResult(suite: string, name: string, status: 'OK' | 'FAIL', durationMs: number, details?: string) {
  results.push({ suite, name, status, durationMs, details });
  const statusStr = status === 'OK' ? '\x1b[32m[OK]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`  ${statusStr} [${suite}] ${name} (${durationMs.toFixed(1)}ms)${details ? ` -> ${details}` : ''}`);
}

async function runDatabaseBootstrap(): Promise<boolean> {
  console.log('\n\x1b[1m\x1b[36m=== 1. INICIALIZAÇÃO E MIGRAÇÃO DO POSTGRESQL ===\x1b[0m');

  if (!Client) {
    console.log('\x1b[33m[AVISO] Pacote "pg" não instalado localmente. Pulando migração do banco no host (execute via container ou instale deps).\x1b[0m');
    return false;
  }

  const connectionString = process.env.DATABASE_URL || 'postgres://radar_admin:radar_secure_pass_2026@localhost:5432/radar_hub_db';
  const client = new Client({ connectionString });

  const startConnect = performance.now();
  try {
    await client.connect();
    const connectDuration = performance.now() - startConnect;
    recordResult('DATABASE', 'Conexão PostgreSQL', 'OK', connectDuration, `Conectado em ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
  } catch (err: any) {
    const connectDuration = performance.now() - startConnect;
    recordResult('DATABASE', 'Conexão PostgreSQL', 'FAIL', connectDuration, `Falha: ${err.message}`);
    console.log('\x1b[33m[AVISO] Banco de dados indisponível no host atual. Continuando para validação dos motores em memória.\x1b[0m');
    return false;
  }

  const migrationFiles = [
    '00_master_schema.sql',
    '01_init_schema.sql',
    '02_execution_and_cache_schema.sql',
    '03_monetization_and_watchdog_schema.sql',
    '04_expansion_verticals_schema.sql'
  ];

  const dbDir = path.join(__dirname, '..', 'database');

  for (const file of migrationFiles) {
    const filePath = path.join(dbDir, file);
    if (!fs.existsSync(filePath)) {
      recordResult('MIGRATION', `Arquivo ${file}`, 'FAIL', 0, 'Arquivo não encontrado');
      continue;
    }

    const sql = fs.readFileSync(filePath, 'utf-8');
    const startMig = performance.now();
    try {
      await client.query(sql);
      const migDuration = performance.now() - startMig;
      recordResult('MIGRATION', `Aplicação: ${file}`, 'OK', migDuration, 'Schema e tabelas sincronizadas com sucesso');
    } catch (err: any) {
      const migDuration = performance.now() - startMig;
      recordResult('MIGRATION', `Aplicação: ${file}`, 'FAIL', migDuration, `Erro SQL: ${err.message}`);
    }
  }

  try {
    const checkRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'radar_hub';
    `);
    const tables = checkRes.rows.map((r: any) => r.table_name);
    recordResult('DATABASE_CHECK', 'Verificação de Tabelas (radar_hub)', 'OK', 5, `Tabelas ativas: ${tables.join(', ')}`);
  } catch (err: any) {
    recordResult('DATABASE_CHECK', 'Verificação de Tabelas', 'FAIL', 5, err.message);
  }

  await client.end();
  return true;
}

function runEngineSmokeTests() {
  console.log('\n\x1b[1m\x1b[36m=== 2. SMOKE TESTS & VALIDAÇÃO DOS MOTORES DE NEGÓCIO ===\x1b[0m');

  // Test 1: Bug Detector (Detecção de Erro de Dígito e >60% OFF)
  {
    const start = performance.now();
    try {
      const bugResult = detectPriceBug({
        title: 'Smart TV OLED 65 4K',
        currentPrice: 199.90,
        historicalAveragePrice: 1999.00,
        isFulfilledOrPrime: true
      });

      if (bugResult.isBug && bugResult.priority === 'CRITICAL_BUG' && bugResult.digitErrorLikelihood > 0.8) {
        recordResult('ENGINE', 'bug_detector.ts (Erro de Dígito 90% OFF)', 'OK', performance.now() - start, `Score: ${bugResult.evaluationScore}/100, Prioridade: ${bugResult.priority}`);
      } else {
        recordResult('ENGINE', 'bug_detector.ts (Erro de Dígito)', 'FAIL', performance.now() - start, `Inconsistência: ${JSON.stringify(bugResult)}`);
      }
    } catch (e: any) {
      recordResult('ENGINE', 'bug_detector.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 2: FIPE Engine (Leilão de Veículo com Custos Ocultos)
  {
    const start = performance.now();
    try {
      const auctionRes = evaluateVehicleAuction({
        title: 'Toyota Corolla Cross 2023',
        bidPrice: 65000,
        fipePrice: 130000,
        categoryType: 'car'
      });

      if (auctionRes.recommendation === 'STRONG_BUY' && auctionRes.netMarginPercentage > 30) {
        recordResult('ENGINE', 'fipe_engine.ts (Leilão vs FIPE)', 'OK', performance.now() - start, `Margem Líquida: ${auctionRes.netMarginPercentage}%, Lucro Est.: R$ ${auctionRes.netProfitEstimate}`);
      } else {
        recordResult('ENGINE', 'fipe_engine.ts', 'FAIL', performance.now() - start, `Resultado: ${JSON.stringify(auctionRes)}`);
      }
    } catch (e: any) {
      recordResult('ENGINE', 'fipe_engine.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 3: Hidden Costs Calculator (Veículos e Imóveis)
  {
    const start = performance.now();
    try {
      const vCosts = calculateVehicleHiddenCosts(50000, 100000);
      const reCosts = calculateRealEstateHiddenCosts(250000, 500000, true);

      if (vCosts.custoRealAquisicao > 50000 && reCosts.itbiTax === 7500 && reCosts.roiProjetadoPercent > 0) {
        recordResult('ENGINE', 'hidden_costs_calculator.ts (Veículos + Imóveis)', 'OK', performance.now() - start, `CRA Veículo: R$ ${vCosts.custoRealAquisicao} | ROI Imóvel: ${reCosts.roiProjetadoPercent.toFixed(1)}%`);
      } else {
        recordResult('ENGINE', 'hidden_costs_calculator.ts', 'FAIL', performance.now() - start, 'Falha nas deduções de taxas ou ITBI');
      }
    } catch (e: any) {
      recordResult('ENGINE', 'hidden_costs_calculator.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 4: Miles Engine (Arbitragem de Milhas e Emissões)
  {
    const start = performance.now();
    try {
      const milesRes = evaluateMilesPromo({
        programSource: 'LIVELO',
        programTarget: 'LATAM_PASS',
        bonusPercentage: 100,
        costPerThousandOrigin: 35.00
      });

      if (milesRes.effectiveCpmTarget === 17.50 && milesRes.priority === 'CRITICAL_BUG') {
        recordResult('ENGINE', 'miles_engine.ts (100% Bônus Livelo -> Latam)', 'OK', performance.now() - start, `CPM Efetivo: R$ ${milesRes.effectiveCpmTarget.toFixed(2)} (Score: ${milesRes.evaluationScore})`);
      } else {
        recordResult('ENGINE', 'miles_engine.ts', 'FAIL', performance.now() - start, `CPM calculado: ${milesRes.effectiveCpmTarget}`);
      }
    } catch (e: any) {
      recordResult('ENGINE', 'miles_engine.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 5: Stacking Engine (4 Camadas: Preço + Cupom + Cashback + Pontos)
  {
    const start = performance.now();
    try {
      const stackingRes = evaluateStackingDeal({
        title: 'Smartphone Flagship',
        originalPrice: 5000,
        promoPrice: 4000,
        couponDiscountPercent: 10,
        cashbackPercent: 15,
        pointsPerReal: 10,
        pointValueCpm: 35
      });

      if (stackingRes.totalSavingsPercentage > 40 && stackingRes.pointsGenerated > 0) {
        recordResult('ENGINE', 'stacking_engine.ts (4 Camadas de Desconto)', 'OK', performance.now() - start, `Economia Total: ${stackingRes.totalSavingsPercentage}% | Preço Efetivo: R$ ${stackingRes.effectiveFinalPrice}`);
      } else {
        recordResult('ENGINE', 'stacking_engine.ts', 'FAIL', performance.now() - start, 'Falha no empilhamento');
      }
    } catch (e: any) {
      recordResult('ENGINE', 'stacking_engine.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 6: Unified Scoring Orchestrator
  {
    const start = performance.now();
    try {
      const opp = RadarScoringEngine.processPriceBug({
        title: 'Monitor Gamer 240Hz',
        currentPrice: 350.00,
        historicalAveragePrice: 2200.00,
        sourceName: 'Kabum',
        sourceUrl: 'https://kabum.com.br/item/123'
      });

      if (opp.fingerprint_hash && opp.evaluation_score >= 90 && opp.priority === 'CRITICAL_BUG') {
        recordResult('ENGINE', 'scoring.ts (RadarScoringEngine Unificado)', 'OK', performance.now() - start, `Fingerprint: ${opp.fingerprint_hash.substring(0, 12)}... | Score: ${opp.evaluation_score}`);
      } else {
        recordResult('ENGINE', 'scoring.ts', 'FAIL', performance.now() - start, 'Falha na normalização unificada');
      }
    } catch (e: any) {
      recordResult('ENGINE', 'scoring.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 7: Expansion Engines (8 Verticais: Bauru, PNCP, Domínios, Vagas USD, Cupons, Cashback, Sorteios, Microtarefas)
  {
    const start = performance.now();
    try {
      const bauruRes = evaluateBauruRealEstate({
        title: 'Casa Jardim América',
        neighborhood: 'Jardim America',
        totalPrice: 700000,
        totalAreaM2: 200
      });

      const tenderRes = evaluatePublicTender({
        title: 'Dispensa TI PNCP',
        organName: 'Tribunal Regional',
        estimatedValue: 45000,
        modality: 'DISPENSA',
        closingDate: '2026-12-31'
      });

      const domainRes = evaluateExpiredDomain({
        domain: 'financasbauru.com.br',
        domainAuthority: 38,
        backlinksCount: 1500
      });

      const jobRes = evaluateRemoteJob({
        title: 'Senior TypeScript Engineer',
        company: 'Silicon Valley AI',
        salaryUsdAnnual: 120000,
        techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker']
      });

      const couponRes = evaluateCoupon({
        storeName: 'Amazon',
        couponCode: 'OFF60',
        discountPercent: 60,
        isVerified: true
      });

      const cashbackRes = evaluateCashback({
        storeName: 'Dell',
        interPercent: 22,
        meliuzPercent: 10,
        productPrice: 5000
      });

      const sweepRes = evaluateSweepstake({
        brandName: 'Nestlé',
        title: 'Super Promoção 1 Milhão',
        participationType: 'FREE_FORM',
        mainPrizeValue: 1000000
      });

      const microRes = evaluateMicrotask({
        taskTitle: 'Data Labelling AI',
        platform: 'Appen',
        rewardBrl: 30,
        estimatedMinutesToComplete: 30,
        isAutomatedScriptable: true
      });

      if (
        bauruRes.score >= 40 &&
        tenderRes.priority === 'HIGH' &&
        domainRes.priority === 'CRITICAL_BUG' &&
        jobRes.monthlyBrl > 40000 &&
        couponRes.priority === 'CRITICAL_BUG' &&
        cashbackRes.bestProvider === 'Banco Inter' &&
        sweepRes.priority === 'CRITICAL_BUG' &&
        microRes.priority === 'CRITICAL_BUG'
      ) {
        recordResult('ENGINE', 'expansion_engines.ts (8 Verticais de Expansão)', 'OK', performance.now() - start, `Bauru deságio: ${bauruRes.discountVsBenchmarkPercent}% | Salário Remoto: R$ ${jobRes.monthlyBrl.toFixed(2)}/mês | Cashback: ${cashbackRes.bestRate}%`);
      } else {
        recordResult('ENGINE', 'expansion_engines.ts', 'FAIL', performance.now() - start, 'Falha nos cálculos das verticais de expansão');
      }
    } catch (e: any) {
      recordResult('ENGINE', 'expansion_engines.ts', 'FAIL', performance.now() - start, e.message);
    }
  }

  // Test 8: Proxy Rotator, Subscriptions & One-Click Buy Engine
  {
    const start = performance.now();
    try {
      const headers = generateResilientHeaders();
      const backoff = calculateExponentialBackoff(2, 1000, 8000);

      const subRecord = processPaymentEvent({
        event: 'PAYMENT_RECEIVED',
        customer: { email: 'investidor@radarhub.com', name: 'Thiago Thomaz' },
        plan: 'VIP_MONTHLY',
        durationDays: 30
      });

      const welcomeMsg = formatVipWelcomeMessage(subRecord.customerName, 'https://t.me/+ExclusivoVipInvite', subRecord.expiresAt);

      const checkoutTask = buildOneClickCheckoutTask({
        opportunityId: 'opp_12345',
        targetUrl: 'https://kabum.com.br/produto/123',
        maxPriceLimit: 299.90,
        coupons: ['BUG10']
      });

      if (
        headers['User-Agent'] &&
        backoff >= 4000 &&
        subRecord.status === 'ACTIVE' &&
        welcomeMsg.includes('BEM-VINDO') &&
        checkoutTask.success &&
        checkoutTask.pixCode
      ) {
        recordResult('ENGINE', 'proxy_rotator, subscription & one_click_checkout', 'OK', performance.now() - start, `PIX Gerado: ${checkoutTask.orderId} | Assinatura VIP Ativa até ${subRecord.expiresAt.toISOString().split('T')[0]}`);
      } else {
        recordResult('ENGINE', 'proxy_rotator, subscription & one_click_checkout', 'FAIL', performance.now() - start, 'Falha nos módulos de suporte');
      }
    } catch (e: any) {
      recordResult('ENGINE', 'proxy_rotator, subscription & one_click_checkout', 'FAIL', performance.now() - start, e.message);
    }
  }
}

function printSummary() {
  console.log('\n\x1b[1m\x1b[36m=== 3. RESUMO GERAL DA VALIDAÇÃO (RADAR_HUB) ===\x1b[0m');

  const total = results.length;
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`Total de Testes/Pipelines Validados: ${total}`);
  console.log(`\x1b[32mSucessos [OK]:   ${passed}\x1b[0m`);
  console.log(`${failed > 0 ? '\x1b[31m' : '\x1b[32m'}Falhas   [FAIL]: ${failed}\x1b[0m`);

  if (failed === 0) {
    console.log('\n\x1b[1m\x1b[32m✔ TODOS OS MOTORES E ESTRUTURAS ESTÃO 100% OPERACIONAIS PARA PRODUÇÃO.\x1b[0m\n');
  } else {
    console.log('\n\x1b[1m\x1b[31m✖ ATENÇÃO: HOUVE FALHAS NA VALIDAÇÃO. VERIFIQUE OS LOGS ACIMA.\x1b[0m\n');
  }
}

async function main() {
  console.log('\x1b[1m\x1b[35m' + '='.repeat(70));
  console.log(' RADAR_HUB - SUÍTE DE BOOTSTRAP, MIGRAÇÃO & SMOKE TESTING');
  console.log('='.repeat(70) + '\x1b[0m');

  const isSmokeOnly = process.argv.includes('--smoke-only');

  if (!isSmokeOnly) {
    await runDatabaseBootstrap();
  } else {
    console.log('\n[MODO SMOKE-ONLY ATIVADO: Pulando conexão com banco de dados]');
  }

  runEngineSmokeTests();
  printSummary();
}

main().catch(err => {
  console.error('\x1b[31mErro fatal no bootstrap:\x1b[0m', err);
  process.exit(1);
});
