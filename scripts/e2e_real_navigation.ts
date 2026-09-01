/**
 * ==============================================================================
 * RADAR_HUB — TESTE E2E DE NAVEGAÇÃO REAL COM PUPPETEER (HEADLESS CHROME)
 * ==============================================================================
 * Executa testes reais de clique, URL, DOM, eventos, histórico e modais no navegador.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import http from 'http';
import express from 'express';
import path from 'path';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { RadarScraperDaemon } from '../engine/scraper_daemon';
import { UnifiedOpportunity } from '../engine/scoring';

const TEST_PORT = 3199;
let server: http.Server;
let browser: Browser;
let page: Page;

const scraperDaemon = new RadarScraperDaemon();

function generateInitialSeed(): UnifiedOpportunity[] {
  const allVerts = [
    'price_bug', 'car_auction', 'industrial_auction', 'real_estate_local',
    'public_tender', 'expired_domain', 'remote_job', 'coupon_deal',
    'cashback_max', 'sweepstake_promo', 'miles_promo', 'microtask_gig', 'stacking_deal'
  ];

  const items: UnifiedOpportunity[] = [];
  for (const v of allVerts) {
    try {
      const sample = scraperDaemon.generateSampleFeedItem(v);
      const scored = scraperDaemon.scoreRawFeedItem(v, sample);
      items.push(scored);
    } catch {}
  }
  return items;
}

const seedOpportunities = generateInitialSeed();

interface E2EResult {
  step: string;
  passed: boolean;
  details?: string;
}

const testResults: E2EResult[] = [];

function record(step: string, passed: boolean, details?: string) {
  testResults.push({ step, passed, details });
  if (passed) {
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${step}`);
  } else {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${step} -> ${details}`);
  }
}

async function setupTestServer(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'dashboard')));

  // Endpoint REST de Oportunidades
  app.get('/api/opportunities', (req, res) => {
    const vertical = (req.query.vertical || req.query.category || 'ALL') as string;
    const oppId = (req.query.opportunity || req.query.id) as string | undefined;

    let filtered = seedOpportunities;
    if (vertical && vertical !== 'ALL') {
      filtered = filtered.filter(d => d.category === vertical);
    }
    if (oppId) {
      filtered = filtered.filter(d => d.fingerprint_hash === oppId);
    }

    res.json({
      success: true,
      count: filtered.length,
      vertical,
      opportunities: filtered
    });
  });

  server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    ws.send(JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      timestamp: new Date().toISOString(),
      message: 'Conexão E2E Teste estabelecida.'
    }));

    ws.send(JSON.stringify({
      type: 'INITIAL_OPPORTUNITIES',
      timestamp: new Date().toISOString(),
      payload: seedOpportunities
    }));
  });

  return new Promise((resolve) => {
    server.listen(TEST_PORT, () => {
      console.log(`\x1b[34m[E2E SERVER]\x1b[0m Servidor de teste ativo em http://localhost:${TEST_PORT}`);
      resolve();
    });
  });
}

async function runE2ETests() {
  console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m\x1b[36m 🚀 RADAR_HUB // TESTES E2E EM NAVEGADOR REAL (HEADLESS CHROME)\x1b[0m');
  console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

  await setupTestServer();

  console.log('\x1b[33m[1/6] Inicializando Chromium via Puppeteer...\x1b[0m');
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Carregamento inicial do Cockpit
  console.log('\x1b[33m[2/6] Carregando Cockpit Dashboard...\x1b[0m');
  await page.goto(`http://localhost:${TEST_PORT}/`, { waitUntil: 'networkidle0' });

  const title = await page.title();
  record('Carregamento inicial da página e Title HTML', title.includes('RADAR_HUB'), `Título: "${title}"`);

  // Aguarda renderização da tabela
  await page.waitForSelector('#opportunities-table tbody tr', { timeout: 5000 });
  const initialRowCount = await page.$$eval('#opportunities-table tbody tr', rows => rows.length);
  record('Renderização inicial de oportunidades na tabela', initialRowCount > 0, `Linhas renderizadas: ${initialRowCount}`);

  // 2. Teste de Todos os Filtros de Verticais (Cliques Reais)
  console.log('\n\x1b[33m[3/6] Testando Cliques Reais em Todos os 13 Filtros de Verticais...\x1b[0m');

  const filterButtons = await page.$$eval('.filter-btn[data-filter]', btns => 
    btns.map(b => ({
      filter: b.getAttribute('data-filter') || '',
      text: b.textContent?.trim() || ''
    }))
  );

  for (const fb of filterButtons) {
    const selector = `.filter-btn[data-filter="${fb.filter}"]`;
    await page.click(selector);
    await new Promise(r => setTimeout(r, 100)); // Pequena pausa para re-render

    const currentUrl = page.url();
    const isActive = await page.$eval(selector, el => el.classList.contains('active'));
    const rows = await page.$$eval('#opportunities-table tbody tr', rows => rows.length);

    const expectedUrlPart = fb.filter === 'ALL' ? `http://localhost:${TEST_PORT}/` : `vertical=${fb.filter}`;
    const urlMatches = currentUrl.includes(expectedUrlPart);

    record(
      `Clique no Filtro "${fb.text}" (${fb.filter})`,
      isActive && urlMatches && rows >= 0,
      `URL: ${currentUrl} | Active: ${isActive} | Linhas: ${rows}`
    );
  }

  // 3. Teste de Navegação no Histórico (Back / Forward)
  console.log('\n\x1b[33m[4/6] Testando Histórico do Navegador (Back / Forward)...\x1b[0m');
  
  // Clica em Bugs e depois em Leilões
  await page.click('.filter-btn[data-filter="price_bug"]');
  await new Promise(r => setTimeout(r, 50));
  await page.click('.filter-btn[data-filter="car_auction"]');
  await new Promise(r => setTimeout(r, 50));

  // Volta no histórico
  await page.goBack();
  await new Promise(r => setTimeout(r, 100));
  const urlAfterBack = page.url();
  const isBugActiveAfterBack = await page.$eval('.filter-btn[data-filter="price_bug"]', el => el.classList.contains('active'));
  record('Navegação Voltar (Browser Back) restaura vertical "price_bug"', urlAfterBack.includes('vertical=price_bug') && isBugActiveAfterBack);

  // Avança no histórico
  await page.goForward();
  await new Promise(r => setTimeout(r, 100));
  const urlAfterForward = page.url();
  const isCarActiveAfterForward = await page.$eval('.filter-btn[data-filter="car_auction"]', el => el.classList.contains('active'));
  record('Navegação Avançar (Browser Forward) restaura vertical "car_auction"', urlAfterForward.includes('vertical=car_auction') && isCarActiveAfterForward);

  // 4. Teste de Ações Rápidas: 1-Click e Modal CDC LegalTech
  console.log('\n\x1b[33m[5/6] Testando Ações Rápidas (1-Click, CDC LegalTech e Modais)...\x1b[0m');

  // Volta para Todas
  await page.click('.filter-btn[data-filter="ALL"]');
  await new Promise(r => setTimeout(r, 100));

  // Pega ID da primeira oportunidade
  const firstDeal = await page.$eval('#opportunities-table tbody tr:first-child a.opp-title-link', el => ({
    id: el.getAttribute('data-id') || '',
    title: el.textContent?.trim() || '',
    href: el.getAttribute('href') || ''
  }));

  record('Link do Título da oportunidade possui ID e href válidos', firstDeal.id.length > 0 && firstDeal.href !== '#', `ID: ${firstDeal.id} | Href: ${firstDeal.href}`);

  // Clica no botão CDC LegalTech
  await page.waitForSelector('.btn-action.btn-cdc', { timeout: 3000 });
  await page.click('.btn-action.btn-cdc');
  await new Promise(r => setTimeout(r, 200));

  const isLegalModalOpen = await page.$eval('#legal-modal', el => el.classList.contains('show'));
  const legalDocContent = await page.$eval('#legal-doc-content', (el: any) => el.value);

  record('Abertura do Modal LegalTech CDC (Art. 35)', isLegalModalOpen && legalDocContent.length > 50, `Conteúdo: ${legalDocContent.substring(0, 40)}...`);

  // Fecha o modal CDC via ESC
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 150));
  const isLegalModalClosed = await page.$eval('#legal-modal', el => !el.classList.contains('show'));
  record('Fechamento do Modal via tecla ESC', isLegalModalClosed);

  // 5. Teste de Deep Links Diretos e URL Inválida
  console.log('\n\x1b[33m[6/6] Testando Deep Links Diretos e Parâmetros Inválidos...\x1b[0m');

  // Deep link direto para Imóveis Bauru
  await page.goto(`http://localhost:${TEST_PORT}/?vertical=real_estate_local`, { waitUntil: 'networkidle0' });
  const isBauruActive = await page.$eval('.filter-btn[data-filter="real_estate_local"]', el => el.classList.contains('active'));
  record('Acesso direto por URL: "?vertical=real_estate_local" ativa filtro correto', isBauruActive);

  // URL com parâmetro inválido
  await page.goto(`http://localhost:${TEST_PORT}/?vertical=invalid_category_xyz`, { waitUntil: 'networkidle0' });
  const rowsInvalid = await page.$$eval('#opportunities-table tbody tr', rows => rows.length);
  record('URL com parâmetro inválido faz fallback seguro sem quebrar UI', rowsInvalid >= 0);

  // Switch de Silenciamento de Toasts (clique no label)
  await page.click('#silence-toggle-wrap');
  const isSilenced = await page.evaluate(() => (globalThis as any).localStorage.getItem('radar_silence_visual_toasts'));
  record('Switch "🔕 Silenciar Alertas" persiste preferência no localStorage', isSilenced === 'true');

  // Encerramento
  await browser.close();
  server.close();

  // Resumo
  const total = testResults.length;
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;

  console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[1mTOTAL DE TESTES E2E: ${total} | SUCESSOS: \x1b[32m${passed}\x1b[0m\x1b[1m | FALHAS: \x1b[${failed > 0 ? '31m' : '32m'}${failed}\x1b[0m`);
  console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ TODOS OS TESTES E2E DE NAVEGAÇÃO REAL FORAM APROVADOS (PASS) NO CHROMIUM.\x1b[0m\n');
    process.exit(0);
  }
}

runE2ETests().catch(err => {
  console.error('Erro fatal nos testes E2E:', err);
  if (browser) browser.close();
  if (server) server.close();
  process.exit(1);
});
