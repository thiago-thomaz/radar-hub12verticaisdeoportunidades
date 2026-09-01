# RADAR_HUB — REAL NAVIGATION QA

STATUS: **PASS (100% Homologado em Navegador Real Chromium / Puppeteer)**

## RESUMO

* **Testes executados:** 89 (44 rotas e segurança + 13 contratos de esquema + 24 E2E Chromium + 8 smoke engines)
* **Pass:** 89
* **Fail:** 0
* **Warnings:** 0
* **Not Verified:** 0

---

## BUG ORIGINAL

* **Descrição:** Os filtros de verticais e os links de oportunidades falhavam na interface real. Ao carregar a página, a tabela ficava vazia; cliques em títulos e botões de ação abriam o modal PIX ou direcionavam para domínios inexistentes (`https://radarhub.local`), impedindo o acesso real às ofertas.

---

## CAUSA RAIZ

1. **Ausência de carga inicial de oportunidades via REST:** O frontend dependia exclusivamente de eventos WebSocket `NEW_OPPORTUNITY`. No carregamento inicial ou refresh `F5`, `opportunities` permanecia como `[]`, tornando os 13 filtros visuais inoperantes.
2. **Bloqueio indevido no validador de links:** `SafeNavigator.isValidExternalUrl` continha `'localhost'` na lista de domínios proibidos, invalidando links em ambientes locais e forçando o fallback para `#` e modal PIX.
3. **Fallbacks de URLs fictícias:** Ocorrência de `'https://radarhub.local'` em 8 rotas de `/api/evaluate` no backend e no `scraper_daemon`.
4. **Ausência de mapeamento da categoria `stacking_deal` no Scraper Daemon:** `scoreRawFeedItem` não continha o `case 'stacking_deal'`, caindo no default (`price_bug`) e gerando divergência de contrato.

---

## FLUXO REAL

```text
[CLICK NO FILTRO / LINK]
        │
        ▼
   [DOM ELEMENT]   ──► <button class="filter-btn active" data-filter="car_auction">
        │
        ▼
  [EVENT HANDLER]  ──► applyFilter('car_auction', true)
        │
        ▼
   [ROUTE SYNC]    ──► window.history.pushState(..., '/?vertical=car_auction')
        │
        ▼
   [STATE STORE]   ──► activeFilter = 'car_auction'
        │
        ▼
   [API REQUEST]   ──► GET /api/opportunities?vertical=car_auction (200 OK)
        │
        ▼
  [DATABASE QUERY] ──► SELECT * FROM radar_hub.opportunities WHERE category = 'car_auction'
        │
        ▼
   [DOM RENDER]    ──► renderTable() popula #table-body com linhas reais
        │
        ▼
 [LINK EXTERNO]    ──► a.opp-title-link abre a loja / leilão diretamente em nova aba segura
```

---

## CORREÇÃO

* **`server.ts`**:
  - Implementação de `GET /api/opportunities` e `GET /api/opportunities/:id`.
  - Disparo do evento WebSocket `INITIAL_OPPORTUNITIES` com snapshot das oportunidades ativas no evento `connection`.
  - Remoção de todos os fallbacks para `radarhub.local` nas 8 rotas de avaliação e checkout.
* **`dashboard/routes.js`**:
  - Ajuste de `SafeNavigator.dummyDomains` para permitir URLs válidas sem bloqueios indevidos.
* **`dashboard/app.js`**:
  - Adição de `loadInitialOpportunities()` no evento `DOMContentLoaded`.
  - Implementação de `ingestBatch(payload)` para carga em lote de oportunidades.
  - Sincronização de deep link de oportunidade `/?opportunity=<ID>` com rolagem suave e destaque na tabela.
  - Adição das classes `.btn-1click` e `.btn-cdc` para controle e validação de cliques.
* **`engine/scraper_daemon.ts`**:
  - Adição de `case 'stacking_deal'` em `scoreRawFeedItem` e `generateSampleFeedItem`.
  - Remoção de `radarhub.local` no default feed generator.
* **`scripts/test_vertical_contract.ts` [NOVO]**:
  - Suíte de validação de contrato estrito de schema e normalização para todas as 13 verticais.
* **`scripts/e2e_real_navigation.ts` [NOVO]**:
  - Suíte E2E automatizada executando em navegador real headless Chromium (Puppeteer).

---

## TESTES E2E (NAVEGADOR REAL HEADLESS CHROMIUM)

* **Dashboard Geral (`/`):** PASS
* **Bugs de Preço (`/?vertical=price_bug`):** PASS
* **Leilões de Veículos (`/?vertical=car_auction`):** PASS
* **Leilões Industriais (`/?vertical=industrial_auction`):** PASS
* **Imóveis Bauru (`/?vertical=real_estate_local`):** PASS
* **Licitações PNCP (`/?vertical=public_tender`):** PASS
* **Domínios Expirando (`/?vertical=expired_domain`):** PASS
* **Vagas Remotas USD (`/?vertical=remote_job`):** PASS
* **Cupons & Descontos (`/?vertical=coupon_deal`):** PASS
* **Cashback Máximo (`/?vertical=cashback_max`):** PASS
* **Sorteios SECAP (`/?vertical=sweepstake_promo`):** PASS
* **Milhas CPM (`/?vertical=miles_promo`):** PASS
* **Microtarefas Digitais (`/?vertical=microtask_gig`):** PASS
* **Stacking de Descontos (`/?vertical=stacking_deal`):** PASS

---

## OPORTUNIDADES & AÇÕES RÁPIDAS

* **ID da Oportunidade:** Preservado de forma determinística via `fingerprint_hash` SHA-256.
* **Link do Título (`a.opp-title-link`):** `href` legítimo e abertura direta da loja/leiloeiro oficial em `_blank`.
* **Botão `[⚡ 1-Click]`:** Redirecionamento seguro para oferta externa ou abertura do modal PIX Copia e Cola para ordens locais.
* **Botão `[⚖️ CDC]`:** Abertura do Modal LegalTech com preenchimento da Notificação Extrajudicial (48h) e Petição Inicial JEC (Art. 35 CDC).

---

## SERVICE WORKER & CACHE

* **Service Worker:** PASS (`radar-hub-cache-v1.1.0` com estratégia Stale-While-Revalidate para estáticos e Network-First para `/api/*`).
* **Cache Busting / Invalidation:** PASS (Limpeza de caches antigos no hook `activate`).

---

## TELEGRAM BOT & WEBHOOK

* **Telegram Alerts:** PASS (Geração de inline keyboards com links reais e deep links seguros do Cockpit).

---

## REGRESSÃO & BUILD

* **`npm run test:navigation`**: 44/44 PASS
* **`npm run test:contract`**: 13/13 PASS
* **`npm run test:e2e-real`**: 24/24 PASS
* **`npm run test:engines`**: 8/8 PASS
* **`npm run build` (`tsc`)**: EXIT CODE 0

---

## PENDÊNCIAS

* **Nenhuma pendência técnica:** Todas as causas raiz foram eliminadas, a interface foi testada em navegador real e todo o fluxo está homologado.
