/**
 * ==============================================================================
 * RADAR_HUB — SUÍTE DE TESTES AUTOMATIZADOS DE NAVEGAÇÃO, ROTAS & IDEMPOTÊNCIA
 * ==============================================================================
 * Executa testes rigorosos de:
 * 1. Unicidade e Consistência da Single Source of Truth (Rotas, Slugs, IDs)
 * 2. Validação de Segurança de URLs e Prevenção de Open Redirect / XSS
 * 3. Idempotência e Estabilidade dos Fingerprints de Deduplicação
 * 4. Alinhamento 1:1 entre Frontend (routes.js) e Backend (routes_registry.ts)
 */

import { VERTICALS_REGISTRY, SYSTEM_ROUTES, URLSafetyValidator } from '../engine/routes_registry';
import { generateFingerprint, RadarScoringEngine } from '../engine/scoring';
import fs from 'fs';
import path from 'path';

interface TestAssertion {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const assertions: TestAssertion[] = [];

function assert(name: string, condition: boolean, errorMsg?: string, details?: any) {
  assertions.push({
    name,
    passed: condition,
    error: condition ? undefined : (errorMsg || 'Falha na validação'),
    details
  });
  if (condition) {
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
  } else {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}: ${errorMsg}`);
  }
}

function assertUnique<T>(list: T[], name: string) {
  const seen = new Set<T>();
  const duplicates: T[] = [];
  for (const item of list) {
    if (seen.has(item)) {
      duplicates.push(item);
    } else {
      seen.add(item);
    }
  }
  assert(
    `Unicidade estrita de ${name}`,
    duplicates.length === 0,
    `Valores duplicados encontrados: ${JSON.stringify(duplicates)}`,
    duplicates
  );
}

console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
console.log('\x1b[1m\x1b[36m 🧭 RADAR_HUB // AUDITORIA E TESTES DE NAVEGAÇÃO, ROTAS & IDEMPOTÊNCIA\x1b[0m');
console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

// ------------------------------------------------------------------------------
// TESTE 1: UNICIDADE E INTEGRIDADE DA SINGLE SOURCE OF TRUTH (BACKEND)
// ------------------------------------------------------------------------------
console.log('\x1b[1m\x1b[33m[BLOCO 1] Single Source of Truth & Unicidade de Rotas\x1b[0m');

const verticalKeys = Object.keys(VERTICALS_REGISTRY);
assert(
  'Existência de todas as 12 Verticais Oficiais + Stacking',
  verticalKeys.length >= 12,
  `Esperado no mínimo 12 verticais, encontrado ${verticalKeys.length}`
);

const verticalIds = Object.values(VERTICALS_REGISTRY).map(v => v.id);
const verticalSlugs = Object.values(VERTICALS_REGISTRY).map(v => v.slug);
const verticalRoutes = Object.values(VERTICALS_REGISTRY).map(v => v.internalRoute);

assertUnique(verticalIds, 'IDs de Verticais');
assertUnique(verticalSlugs, 'Slugs de Verticais');
assertUnique(verticalRoutes, 'Rotas Internas de Verticais');

const systemRoutePaths = SYSTEM_ROUTES.map(r => r.path);
const systemRouteIds = SYSTEM_ROUTES.map(r => r.id);

assertUnique(systemRoutePaths, 'Paths das Rotas do Sistema');
assertUnique(systemRouteIds, 'IDs das Rotas do Sistema');

// ------------------------------------------------------------------------------
// TESTE 2: SEGURANÇA DE LINKS EXTERNOS & PREVENÇÃO DE OPEN REDIRECT / XSS
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[33m[BLOCO 2] Segurança de URLs e Prevenção de Open Redirect\x1b[0m');

const maliciousUrls = [
  'javascript:alert(1)',
  'JAVASCRIPT:document.location="http://evil.com"',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'http://localhost:3000/admin',
  'https://radarhub.local/fake',
  'https://exemplo.com/dummy',
  '',
  '   ',
  'not_a_valid_url'
];

maliciousUrls.forEach(url => {
  const isValid = URLSafetyValidator.isValidExternalUrl(url);
  assert(`Bloqueio de URL inválida/perigosa: "${url}"`, !isValid, 'URL perigosa não foi rejeitada');
});

const legitimateUrls = [
  'https://www.amazon.com.br/dp/B09V3HN1KC',
  'https://produto.mercadolivre.com.br/MLB-123456789',
  'https://www.freitasleiloeiro.com.br/lote/12345',
  'https://pncp.gov.br/app/editais/123456',
  'https://registro.br/busca-dominio/',
  'https://www.kabum.com.br/produto/99999'
];

legitimateUrls.forEach(url => {
  const isValid = URLSafetyValidator.isValidExternalUrl(url);
  assert(`Validação de URL legítima: "${url}"`, isValid, 'URL válida foi indevidamente rejeitada');
});

// Sanitização de Redirect
assert(
  'Sanitização de caminho relativo seguro ("/dashboard")',
  URLSafetyValidator.sanitizeRedirectUrl('/dashboard') === '/dashboard'
);
assert(
  'Sanitização bloqueia URL inválida e faz fallback para "/"',
  URLSafetyValidator.sanitizeRedirectUrl('javascript:evil()', '/') === '/'
);

// ------------------------------------------------------------------------------
// TESTE 3: IDEMPOTÊNCIA E ESTABILIDADE DE DEDUPLICAÇÃO (FINGERPRINTING)
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[33m[BLOCO 3] Idempotência e Deduplicação por Fingerprint SHA-256\x1b[0m');

const fp1 = generateFingerprint('Amazon', 'https://amazon.com.br/item1', 199.90);
const fp2 = generateFingerprint('Amazon', 'https://amazon.com.br/item1', 199.90);
const fp3 = generateFingerprint('Amazon', 'https://amazon.com.br/item1', 199.95);

assert('Fingerprints gerados para dados idênticos são rigorosamente iguais', fp1 === fp2);
assert('Fingerprint é hash hexadecimal SHA-256 de 64 caracteres', fp1.length === 64 && /^[0-9a-f]{64}$/.test(fp1));
assert('Alteração de preço produz fingerprint diferente (detecção de mudança)', fp1 !== fp3);

// Normalização idêntica no Scoring Engine
const bugSample = {
  title: 'Smart TV 55 4K',
  currentPrice: 399.00,
  historicalAveragePrice: 2800.00,
  sourceName: 'Amazon BR',
  sourceUrl: 'https://amazon.com.br/dp/B09123'
};

const processed1 = RadarScoringEngine.processPriceBug(bugSample);
const processed2 = RadarScoringEngine.processPriceBug(bugSample);

assert('Idempotência de processamento de oportunidade no Scoring Engine', processed1.fingerprint_hash === processed2.fingerprint_hash);
assert('Score e prioridade são determinísticos', processed1.evaluation_score === processed2.evaluation_score && processed1.priority === processed2.priority);

// ------------------------------------------------------------------------------
// TESTE 4: ALINHAMENTO ENTRE FRONTEND (routes.js) E BACKEND (routes_registry.ts)
// ------------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[33m[BLOCO 4] Alinhamento 1:1 Frontend (routes.js) vs Backend (routes_registry.ts)\x1b[0m');

const frontendRoutesPath = path.join(__dirname, '..', 'dashboard', 'routes.js');
assert('Arquivo dashboard/routes.js existe no disco', fs.existsSync(frontendRoutesPath));

const frontendRoutesContent = fs.readFileSync(frontendRoutesPath, 'utf8');

// Verifica se cada vertical do backend está declarada no frontend
for (const [key, vertical] of Object.entries(VERTICALS_REGISTRY)) {
  const hasKey = frontendRoutesContent.includes(key);
  const hasSlug = frontendRoutesContent.includes(vertical.slug);
  assert(`Vertical "${vertical.name}" (${key}) declarada no frontend`, hasKey && hasSlug);
}

// ------------------------------------------------------------------------------
// RESUMO FINAL
// ------------------------------------------------------------------------------
const total = assertions.length;
const passed = assertions.filter(a => a.passed).length;
const failed = assertions.filter(a => !a.passed).length;

console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
console.log(`\x1b[1mTOTAL DE VALIDAÇÕES: ${total} | APROVADOS: \x1b[32m${passed}\x1b[0m\x1b[1m | FALHAS: \x1b[${failed > 0 ? '31m' : '32m'}${failed}\x1b[0m`);
console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ TODAS AS AUDITORIAS DE ROTAS, NAVEGAÇÃO E IDEMPOTÊNCIA FORAM APROVADAS (PASS).\x1b[0m\n');
  process.exit(0);
}
