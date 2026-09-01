/**
 * ==============================================================================
 * RADAR_HUB — TESTE DE CONTRATO FRONTEND → BACKEND (VERTICAIS & APIS)
 * ==============================================================================
 * Valida o contrato de entrada, normalização, scoring e schema de resposta para
 * todas as 12 verticais oficiais + Stacking de Descontos.
 */

import { VERTICALS_REGISTRY } from '../engine/routes_registry';
import { RadarScraperDaemon } from '../engine/scraper_daemon';

const daemon = new RadarScraperDaemon();

interface ContractResult {
  vertical: string;
  passed: boolean;
  error?: string;
}

const results: ContractResult[] = [];

console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
console.log('\x1b[1m\x1b[36m 📋 RADAR_HUB // TESTES DE CONTRATO DAS 12 VERTICAIS + STACKING\x1b[0m');
console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

for (const [key, meta] of Object.entries(VERTICALS_REGISTRY)) {
  try {
    const sample = daemon.generateSampleFeedItem(key);
    const scored = daemon.scoreRawFeedItem(key, sample);

    const hasValidCategory = scored.category === key;
    const hasValidTitle = typeof scored.title === 'string' && scored.title.length > 0;
    const hasValidScore = typeof scored.evaluation_score === 'number' && scored.evaluation_score >= 0 && scored.evaluation_score <= 100;
    const hasValidPrice = typeof scored.opportunity_price === 'number' && scored.opportunity_price >= 0;
    const hasValidFingerprint = typeof scored.fingerprint_hash === 'string' && scored.fingerprint_hash.length === 64;
    const hasValidSourceUrl = typeof scored.source_url === 'string' && (scored.source_url.startsWith('http://') || scored.source_url.startsWith('https://')) && !scored.source_url.includes('radarhub.local');

    const isValid = hasValidCategory && hasValidTitle && hasValidScore && hasValidPrice && hasValidFingerprint && hasValidSourceUrl;

    if (isValid) {
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m Vertical "${meta.name}" (${key}) cumpre contrato estrito.`);
      results.push({ vertical: key, passed: true });
    } else {
      const err = `Falha contrato: category=${hasValidCategory}, title=${hasValidTitle}, score=${hasValidScore}, price=${hasValidPrice}, fp=${hasValidFingerprint}, url=${hasValidSourceUrl}`;
      console.error(`  \x1b[31m✖ [FAIL]\x1b[0m Vertical "${meta.name}" (${key}): ${err}`);
      results.push({ vertical: key, passed: false, error: err });
    }
  } catch (e: any) {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m Vertical "${meta.name}" (${key}) lançou exceção: ${e.message}`);
    results.push({ vertical: key, passed: false, error: e.message });
  }
}

const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log('\n\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m');
console.log(`\x1b[1mTOTAL DE VERTICAIS: ${total} | APROVADAS: \x1b[32m${passed}\x1b[0m\x1b[1m | FALHAS: \x1b[${failed > 0 ? '31m' : '32m'}${failed}\x1b[0m`);
console.log('\x1b[35m════════════════════════════════════════════════════════════════════════════════\x1b[0m\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ CONTRATO DE TODAS AS VERTICAIS 100% HOMOLOGADO.\x1b[0m\n');
  process.exit(0);
}
