# 🧭 RADAR_HUB — Matriz de Auditoria de Navegação & Ações

> **Data de Auditoria:** 2026-09-01  
> **Status Geral:** **PASS (100% Aprovado)**

---

## 1. Auditoria de Menus e Filtros de Verticais (Cockpit)

| Origem | Elemento Visual | Destino Esperado | Destino Anterior | Status | Correção Aplicada |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Cockpit** | Filtro "Todas" | `/?vertical=ALL` | Sem query param | **PASS** | Sincronizado com `applyFilter('ALL')` |
| **Cockpit** | Filtro "Bugs" | `/?vertical=price_bug` | `price_bug` sem URL | **PASS** | Histórico e deep link ativos |
| **Cockpit** | Filtro "Leilões Veículos"| `/?vertical=car_auction`| `car_auction` | **PASS** | Deep link e sincronia de badge |
| **Cockpit** | Filtro "Bens Industriais"| `/?vertical=industrial_auction`| *Ausente* | **PASS** | Adicionado botão e vertical oficial |
| **Cockpit** | Filtro "Imóveis Bauru" | `/?vertical=real_estate_local` | `real_estate_local` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Licitações PNCP"| `/?vertical=public_tender` | `public_tender` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Domínios" | `/?vertical=expired_domain` | `expired_domain` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Vagas Remotas" | `/?vertical=remote_job` | `remote_job` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Cupons" | `/?vertical=coupon_deal` | `coupon_deal` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Cashback Max" | `/?vertical=cashback_max` | `cashback_max` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Sorteios SECAP" | `/?vertical=sweepstake_promo`| `sweepstake_promo` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Milhas CPM" | `/?vertical=miles_promo` | `miles_promo` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Microtarefas" | `/?vertical=microtask_gig` | `microtask_gig` | **PASS** | Sincronizado com Single Source of Truth |
| **Cockpit** | Filtro "Stacking" | `/?vertical=stacking_deal` | *Ausente* | **PASS** | Adicionado botão e vertical oficial |

---

## 2. Auditoria de Ações por Oportunidade (Tabela & Cards)

| Elemento | Ação do Usuário | Destino Esperado | Comportamento Anterior | Status | Correção Aplicada |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Título da Linha** | Clique no Link | Site de Origem (URL Externa) ou Checkout PIX | Texto plano não clicável | **PASS** | `<a>` seguro com target `_blank` e `noopener,noreferrer` |
| **Botão `[⚡ 1-Click]`** | Clique em Oferta Externa | Abrir loja (Amazon, ML, Leilão) em nova aba | Não disparava redirect | **PASS** | Validação com `SafeNavigator.openExternal` |
| **Botão `[⚡ 1-Click]`** | Clique em Oferta Local | Modal Checkout PIX (`#checkout-modal`) | Inoperante | **PASS** | Modal abre com QR Code e código Copia e Cola |
| **Botão `[⚖️ CDC]`** | Clique no botão | Modal LegalTech (`#legal-modal`) com minutas | Não abria ou abria vazio | **PASS** | Recupera ID, popula Notificação 48h e Petição JEC |
| **Toast Flutuante** | Clique em `[⚡ 1-Click]` | Ação rápida da oportunidade do toast | Inoperante | **PASS** | Dispara `handleOneClickAction(id)` |
| **Toast Flutuante** | Clique em `[✕]` | Remoção imediata do toast | Travava na tela | **PASS** | `dismissToast` com animação suave de saída |
| **Telegram Bot** | Botão `[🛒 Comprar]` | Redirecionamento seguro para loja | `radarhub.local` | **PASS** | Validação e fallback para deep link do Cockpit |
| **Telegram Bot** | Botão `[🖥️ WebApp]` | Abrir Cockpit no WebApp Telegram | URL mockada | **PASS** | URL parametrizada `process.env.BASE_URL` |
| **Encurtador `/r/:code`**| Acesso via link curto | Redirect 302 para afiliado seguro | Sem validação de protocolo | **PASS** | `URLSafetyValidator.isValidExternalUrl` |
