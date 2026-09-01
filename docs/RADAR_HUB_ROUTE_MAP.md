# 🗺️ RADAR_HUB — Mapa Oficial de Rotas & Verticais (Single Source of Truth)

> **Versão:** 1.1.0  
> **Status:** Ativo & Estabilizado  
> **Arquivos de Referência:** `engine/routes_registry.ts` (Backend) & `dashboard/routes.js` (Frontend)

---

## 1. As 12 Verticais de Oportunidades + Stacking

| # | Funcionalidade / Vertical | ID Técnico | Slug Oficial | Rota Interna (Deep Link) | Categoria | Tipo | Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **01** | **Bugs de Preço** | `price_bug` | `bugs-preco` | `/?vertical=price_bug` | `ecommerce` | Interna | Ativo |
| **02** | **Leilões de Veículos** | `car_auction` | `leiloes-veiculos` | `/?vertical=car_auction` | `auctions` | Interna | Ativo |
| **03** | **Leilões Industriais** | `industrial_auction` | `bens-industriais` | `/?vertical=industrial_auction` | `auctions` | Interna | Ativo |
| **04** | **Imóveis Bauru** | `real_estate_local` | `imoveis-bauru` | `/?vertical=real_estate_local` | `real_estate` | Interna | Ativo |
| **05** | **Licitações PNCP** | `public_tender` | `licitacoes-pncp` | `/?vertical=public_tender` | `government` | Interna | Ativo |
| **06** | **Domínios Expirando** | `expired_domain` | `dominios-expirando` | `/?vertical=expired_domain` | `seo_domains` | Interna | Ativo |
| **07** | **Vagas Remotas USD** | `remote_job` | `vagas-remotas-usd` | `/?vertical=remote_job` | `career` | Interna | Ativo |
| **08** | **Cupons & Descontos** | `coupon_deal` | `cupons-descontos` | `/?vertical=coupon_deal` | `ecommerce` | Interna | Ativo |
| **09** | **Cashback Máximo** | `cashback_max` | `cashback-maximo` | `/?vertical=cashback_max` | `fintech` | Interna | Ativo |
| **10** | **Sorteios SECAP** | `sweepstake_promo` | `sorteios-secap` | `/?vertical=sweepstake_promo` | `promotions` | Interna | Ativo |
| **11** | **Milhas CPM** | `miles_promo` | `milhas-cpm` | `/?vertical=miles_promo` | `travel` | Interna | Ativo |
| **12** | **Microtarefas Digitais** | `microtask_gig` | `microtarefas-digitais` | `/?vertical=microtask_gig` | `career` | Interna | Ativo |
| **13** | **Stacking de Descontos** | `stacking_deal` | `stacking-descontos` | `/?vertical=stacking_deal` | `arbitrage` | Interna | Ativo |

---

## 2. Rotas do Cockpit & PWA

| Rota | Método | Finalidade | Tipo |
| :--- | :---: | :--- | :---: |
| `/` | `GET` | Cockpit Web em Tempo Real (SPA PWA) | Interna |
| `/index.html` | `GET` | Estrutura HTML do Cockpit | Interna |
| `/styles.css` | `GET` | Folha de Estilos e Glassmorphism | Estático |
| `/routes.js` | `GET` | Registro Centralizado de Rotas Frontend | Estático |
| `/app.js` | `GET` | Controlador do Cockpit, WebSocket e Ações | Estático |
| `/sw.js` | `GET` | Service Worker (Stale-While-Revalidate & Push) | PWA |
| `/manifest.json` | `GET` | Manifest PWA de Instalação | PWA |

---

## 3. Endpoints REST da API & Telemetria

| Endpoint | Método | Descrição | Formato Retorno |
| :--- | :---: | :--- | :---: |
| `/health` | `GET` | Health check de dependências (PostgreSQL, Redis, WebSockets) | JSON |
| `/metrics` | `GET` | Métricas operacionais no formato Prometheus | Text / OpenMetrics |
| `/api/docs` | `GET` | Interface Swagger UI / OpenAPI 3.0 interativa | HTML |
| `/api/docs/spec.yaml` | `GET` | Especificação técnica em formato YAML | YAML |
| `/api/evaluate` | `POST` | Avaliação, scoring e persistência de oportunidades | JSON |
| `/api/checkout/create-order` | `POST` | Criação de ordem 1-clique e geração de PIX Copia e Cola | JSON |
| `/api/checkout/session` | `POST` | Criação de checkout multi-gateway (MP / Asaas / Stripe) | JSON |
| `/api/legal/generate-notice` | `POST` | Geração de Notificação Extrajudicial 48h e Petição JEC CDC | JSON |
| `/api/affiliates/generate` | `POST` | Injeção de tags de afiliado e short link | JSON |
| `/r/:shortCode` | `GET` | Redirecionamento seguro validado com tracking de clique | HTTP 302 |
| `/api/sniper/execute` | `POST` | Execução de compra via Sniper Headless | JSON |
| `/api/reports/dossier/:id` | `GET` | Geração de Dossiê Executivo em PDF | Binary PDF |
| `/api/financial/overview` | `GET` | DRE Financeiro e métricas SaaS em tempo real | JSON |
| `/api/financial/projection` | `GET` | Projeções de faturamento e lucro líquido | JSON |
| `/api/social/publish` | `POST` | Publicação automática multicanal em redes sociais | JSON |
| `/api/telegram/webhook` | `POST` | Processador de comandos e callbacks do Telegram Bot | JSON |
| `/api/webhooks/waha` | `POST` | Processador de mensagens e voz (Whisper/RAG) WhatsApp | JSON |
| `/api/push/subscribe` | `POST` | Registro de endpoint Web Push para alertas críticos | JSON |
