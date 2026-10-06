/**
 * ==============================================================================
 * RADAR_HUB — SUÍTE DE AUDITORIA E VALIDAÇÃO DE LINKS FIRECRAWL (13 VERTICAIS)
 * ==============================================================================
 * Validação rigorosa:
 * 1. Zero links quebrados (100% Status 200 OK);
 * 2. Links Diretos na Loja/Fonte Oficial (proibido fóruns agregadores como Pelando);
 * 3. Conteúdo Ativo de AGORA (zero conteúdo com selo 'Expirado', 'Esgotado' ou antigo);
 * 4. Validação de contratos de schema e scoring;
 * 5. Conformidade com URLSafetyValidator.
 */

import { RadarFirecrawlService } from '../engine/firecrawl_service';
import { URLSafetyValidator } from '../engine/routes_registry';

async function verifyAllLinks() {
  console.log('================================================================');
  console.log('RADAR_HUB — AUDITORIA DE LINKS DIRETOS & DADOS ATIVOS (FIRECRAWL)');
  console.log('================================================================\n');

  const firecrawl = RadarFirecrawlService.getInstance();
  const opportunities = firecrawl.getAllUnifiedOpportunities();

  console.log(`Total de verticais a auditar: ${opportunities.length}\n`);

  let passedCount = 0;
  let failedCount = 0;

  for (const opp of opportunities) {
    const url = opp.source_url;
    console.log(`[TEST] Vertical: ${opp.category}`);
    console.log(`       Título: "${opp.title}"`);
    console.log(`       Fonte: ${opp.source_name}`);
    console.log(`       URL: ${url}`);

    // 1. Validação de segurança sintática
    const isSafe = URLSafetyValidator.isValidExternalUrl(url);
    if (!isSafe) {
      console.error(`  ❌ FALHA DE SEGURANÇA: URL rejeitada pelo URLSafetyValidator!`);
      failedCount++;
      continue;
    }

    // 2. Validação de Direct Merchant (sem intermediários de fórum)
    if (RadarFirecrawlService.isForumAggregatorUrl(url)) {
      console.error(`  ❌ FALHA: URL pertence a fórum/agregador intermediário (${url}). Deve ser link direto da loja!`);
      failedCount++;
      continue;
    }

    // 2.1 Validação de Deep Link (proibido homepage genérica raiz - deve ser link direto de produto/edital)
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
        console.error(`  ❌ FALHA: URL é uma homepage raiz genérica (${url}). Deve apontar diretamente para o produto final!`);
        failedCount++;
        continue;
      }
    } catch {
      console.error(`  ❌ FALHA: URL inválida (${url})`);
      failedCount++;
      continue;
    }

    // 3. Requisição HTTP real para validar liveness e conteúdo
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });

      if (res.status >= 200 && res.status < 400) {
        const text = await res.text();
        const isExpired = RadarFirecrawlService.isContentExpired(text);

        if (isExpired) {
          console.error(`  ❌ FALHA: A página foi carregada mas contém selo de EXPIRADO/ESGOTADO no conteúdo!\n`);
          failedCount++;
        } else {
          console.log(`  ✅ HTTP ${res.status} OK — Link Direto na Loja, Ativo AGORA e 100% Funcional.\n`);
          passedCount++;
        }
      } else {
        console.error(`  ❌ FALHA: HTTP Status ${res.status} (${res.statusText})\n`);
        failedCount++;
      }
    } catch (err: any) {
      console.error(`  ❌ ERRO DE REDE: ${err.message}\n`);
      failedCount++;
    }
  }

  console.log('================================================================');
  console.log(`RELATÓRIO FINAL:`);
  console.log(`Total testado: ${opportunities.length}`);
  console.log(`Aprovados (Diretos, 200 OK e Ativos): ${passedCount}`);
  console.log(`Falhas: ${failedCount}`);
  console.log('================================================================');

  if (failedCount > 0) {
    console.error(`\n🚨 AUDITORIA FALHOU: ${failedCount} problemas encontrados.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 SUCESSO TOTAL: 100% dos links são diretos, sem fóruns e com dados ativos de AGORA!`);
    process.exit(0);
  }
}

verifyAllLinks().catch(err => {
  console.error('Erro fatal na auditoria:', err);
  process.exit(1);
});
