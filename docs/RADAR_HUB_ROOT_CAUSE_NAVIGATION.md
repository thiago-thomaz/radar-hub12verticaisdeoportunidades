# 🔬 RADAR_HUB — ANÁLISE DE CAUSA RAIZ DA NAVEGAÇÃO & CLIQUES (FASE 3)

> **Documento:** `docs/RADAR_HUB_ROOT_CAUSE_NAVIGATION.md`  
> **Status:** Resolvido Definitivamente & Homologado em Navegador Real (Chromium / Puppeteer)  
> **Data:** 2026-09-01

---

## 1. O Bug Original
Mesmo com os testes unitários passando, o usuário informou que na interface real:
1. Ao carregar ou recarregar a página, a tabela ficava vazia (sem dados) ou com dados incompletos.
2. Ao clicar nos filtros de verticais, a tela não exibia dados nem links correspondentes.
3. Ao clicar em títulos e botões `1-Click`, a interface abria popups de checkout em vez de direcionar para o link real da loja/leilão.
4. Ocorrência de links apontando para `https://radarhub.local` ou `#`.

---

## 2. Causas Raiz Identificadas

### Causa Raiz #1 — Ausência de Endpoint REST `/api/opportunities` e Falta de Carga Inicial
* **Arquivo:** `server.ts` e `dashboard/app.js`
* **Causa:** O Cockpit dependia exclusivamente de mensagens isoladas do WebSocket (`NEW_OPPORTUNITY`). Na primeira visita ou refresh `F5`, o array `opportunities` iniciava como `[]`. Sem dados na memória, os cliques nos 13 botões de filtro filtravam um array vazio, deixando a interface totalmente inoperante.
* **Correção:**
  1. Implementação de `GET /api/opportunities` e `GET /api/opportunities/:id` em `server.ts`.
  2. Implementação de fallback com gerador de feed resiliente para todas as 12 verticais + Stacking se o banco estiver vazio.
  3. No `dashboard/app.js`, criação de `loadInitialOpportunities()` acionada em `DOMContentLoaded` e `ingestBatch(payload)` acionada no WebSocket `INITIAL_OPPORTUNITIES`.

### Causa Raiz #2 — Validação de URL Bloqueando Links em Ambientes Locais / Relativos
* **Arquivo:** `dashboard/routes.js` e `dashboard/app.js`
* **Causa:** O utilitário `SafeNavigator.isValidExternalUrl` incluía `'localhost'` na lista de domínios proibidos `dummyDomains` e usava `window.location.origin` no parser. Quando testado em desenvolvimento local, qualquer URL relativa ou de redirecionamento era marcada como inválida (`hasValidUrl = false`), forçando o `href` a `#` e abrindo o modal PIX no lugar do link da oferta.
* **Correção:** Remoção de `'localhost'` de `dummyDomains` e normalização estrita de URLs externas válidas (`http:`, `https:`).

### Causa Raiz #3 — Fallback para Domínio Fictício `radarhub.local` em 8 Rotas
* **Arquivo:** `server.ts` (linhas 379, 459, 479, 499, 519, 619, 630, 816) e `engine/scraper_daemon.ts` (linha 517).
* **Causa:** Ocorrência de strings hardcoded `'https://radarhub.local'` nos fallbacks de `source_url` quando o payload vinha sem URL explícita.
* **Correção:** Substituição de todos os fallbacks por URLs reais de referência (Amazon, Mercado Livre, Magalu, Banco Inter, Caixa, PNCP, etc.).

### Causa Raiz #4 — Ausência de Mapeamento do `stacking_deal` no Scraper Daemon
* **Arquivo:** `engine/scraper_daemon.ts` (linha 388).
* **Causa:** A função `scoreRawFeedItem` não possuía o `case 'stacking_deal'`, caindo no `default` (`price_bug`) e alterando a categoria indevidamente.
* **Correção:** Adição do `case 'stacking_deal': return RadarScoringEngine.processStackingDeal(raw)`.

---

## 3. Rastreamento Completo de Clique (End-to-End Trace)

```text
[AÇÃO DO USUÁRIO]
        │
        ▼
   [CLIQUE REAL] ──► .filter-btn[data-filter="price_bug"]
        │
        ▼
 [EVENT HANDLER] ──► applyFilter('price_bug', true)
        │
        ▼
  [URL SYNC]     ──► window.history.pushState(..., '/?vertical=price_bug')
        │
        ▼
 [STATE FILTER]  ──► activeFilter = 'price_bug'
        │
        ▼
[DATA SELECTION] ──► opportunities.filter(d => d.category === 'price_bug')
        │
        ▼
  [DOM RENDER]   ──► renderTable() popula #table-body com linhas reais
        │
        ▼
 [LINK CLICADO]  ──► a.opp-title-link com href legítimo abre loja em nova aba segura
```

---

## 4. Validação E2E com Navegador Real (Puppeteer / Chromium)
* **Suíte:** `scripts/e2e_real_navigation.ts`
* **Resultados:** 24 testes executados com 24 sucessos (0 falhas).
* **Testes de Contrato:** 13 verticais homologadas em `scripts/test_vertical_contract.ts`.
