-- ==============================================================================
-- RADAR SUPREMO DE ARBITRAGEM, BUGS & LEILÕES (RADAR_HUB)
-- MÓDULO DE EXECUÇÃO RÁPIDA, LOCKS DE CACHE E HISTÓRICO DE COMPRAS
-- ==============================================================================

-- 1. Tabela de Locks de Deduplicação e Cache em Memória
CREATE TABLE IF NOT EXISTS radar_hub.cache_locks (
  key VARCHAR(255) PRIMARY KEY,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_cache_locked ON radar_hub.cache_locks(locked_until);

-- 2. Tabela de Ordens de Execução Automática (One-Click Buy / Checkout)
CREATE TABLE IF NOT EXISTS radar_hub.checkout_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES radar_hub.opportunities(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  account_email VARCHAR(120),
  applied_coupons TEXT[],
  final_checkout_price DECIMAL(12,2) NOT NULL,
  pix_code TEXT,
  pix_qr_url TEXT,
  order_status VARCHAR(30) DEFAULT 'PIX_PENDING', -- 'INITIATED', 'PIX_PENDING', 'PAID', 'EXPIRED', 'FAILED'
  execution_logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_radar_order_status ON radar_hub.checkout_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_radar_order_created ON radar_hub.checkout_orders(created_at DESC);

-- 3. Tabela de Pool de Proxies e Monitor de Saúde
CREATE TABLE IF NOT EXISTS radar_hub.proxy_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_url VARCHAR(255) NOT NULL UNIQUE,
  protocol VARCHAR(10) DEFAULT 'http', -- 'http', 'https', 'socks5'
  latency_ms INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. View Analítica de Performance Financeira e Conversão
CREATE OR REPLACE VIEW radar_hub.v_analytics_summary AS
SELECT
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 HOURS') AS opportunities_24h,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 DAYS') AS opportunities_7d,
  COALESCE(SUM(net_profit_estimate) FILTER (WHERE created_at >= NOW() - INTERVAL '24 HOURS'), 0) AS estimated_profit_24h,
  COALESCE(SUM(net_profit_estimate) FILTER (WHERE created_at >= NOW() - INTERVAL '7 DAYS'), 0) AS estimated_profit_7d,
  COUNT(*) FILTER (WHERE priority = 'CRITICAL_BUG' AND created_at >= NOW() - INTERVAL '7 DAYS') AS critical_bugs_7d,
  COUNT(*) FILTER (WHERE category = 'car_auction' AND created_at >= NOW() - INTERVAL '7 DAYS') AS car_auctions_7d,
  COUNT(*) FILTER (WHERE category = 'miles_promo' AND created_at >= NOW() - INTERVAL '7 DAYS') AS miles_promos_7d
FROM radar_hub.opportunities;
