# 🔍 RADAR_HUB — Relatório de Auditoria de Duplicidades

> **Data da Auditoria:** 2026-09-01  
> **Status:** **PASS (Todas as Duplicidades Eliminadas)**

---

## 1. Duplicidades Identificadas e Corrigidas

### A. Frontend: Acúmulo Ilimitado de Toasts de Notificação
* **Causa:** Ausência de controle de concorrência e throttle no container de alertas flutuantes (`#toast-container`).
* **Correção:**
  - Limite estrito de no máximo **2 toasts visíveis simultaneamente**.
  - Saída imediata com animação suave `slideOut` do mais antigo quando um 3º toast chega.
  - Auto-dismiss em **4 segundos**.
  - Switch de silenciamento visual no header persistido em `localStorage`.

### B. Frontend: Inconsistência e Duplicação na Lista de Categorias
* **Causa:** Existência de múltiplos mapas locais de categorias no frontend (`categoryMap`) desconectados do backend.
* **Correção:**
  - Criação de `dashboard/routes.js` (espelho de `engine/routes_registry.ts`), centralizando as 12 verticais oficiais + Stacking em uma única fonte de verdade (`RADAR_VERTICALS`).

### C. Ingestão & Banco de Dados: Duplicação de Oportunidades
* **Causa:** Algumas rotinas utilizavam `crypto.randomUUID()` em vez de hash determinístico, ou não incluíam `fingerprint_hash` nas cláusulas de inserção.
* **Correção:**
  - Padronização do cálculo de `fingerprint_hash`: `SHA-256(sourceName:sourceUrl:price)`.
  - Inserção com cláusula `ON CONFLICT (fingerprint_hash) DO UPDATE SET updated_at = NOW(), opportunity_price = EXCLUDED.opportunity_price, evaluation_score = EXCLUDED.evaluation_score`.
  - Deduplicação no array em memória do Cockpit por `fingerprint_hash`.

### D. Service Worker: Cache Mismatch de Recursos Estáticos
* **Causa:** `sw.js` continha caminhos iniciando com `/dashboard/index.html` enquanto o Express serve o diretório na raiz `/`.
* **Correção:**
  - Normalização da lista `STATIC_ASSETS` para `['/', '/index.html', '/styles.css', '/routes.js', '/app.js', ...]`.
  - Incremento da versão do cache para `radar-hub-cache-v1.1.0` com invalidação automática de versões antigas no hook `activate`.

### E. WebSockets: Prevenção de Listeners Duplicados
* **Causa:** Reconexões em loops rápidos podiam disparar múltiplos handlers.
* **Correção:**
  - Limpeza de sockets fechados com `connectedClients.delete(ws)` no backend e gerenciamento de reconexão única com backoff exponencial no frontend.
