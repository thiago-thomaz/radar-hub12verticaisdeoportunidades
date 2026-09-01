-- ==============================================================================
-- MASTER SCHEMA UNIFICADO SUPREMO (PILOTO AUTOMÁTICO): RADAR_HUB (12 VERTICAIS)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS radar_hub;

-- 1. TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE radar_hub.opportunity_type AS ENUM (
      'price_bug',
      'car_auction',
      'real_estate_auction',
      'industrial_auction',
      'miles_promo',
      'stacking_deal',
      'coupon_deal',
      'cashback_max',
      'sweepstake_promo',
      'real_estate_local',
      'public_tender',
      'expired_domain',
      'remote_job',
      'microtask_gig'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE radar_hub.priority_level AS ENUM ('NORMAL', 'HIGH', 'CRITICAL_BUG');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE radar_hub.deal_status AS ENUM ('ACTIVE', 'EXPIRED', 'PURCHASED', 'FLAGGED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABELA PRINCIPAL DE OPORTUNIDADES
CREATE TABLE IF NOT EXISTS radar_hub.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category radar_hub.opportunity_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_price DECIMAL(12,2),
  opportunity_price DECIMAL(12,2) NOT NULL,
  discount_percentage DECIMAL(5,2),
  net_profit_estimate DECIMAL(12,2),
  fipe_or_market_ref DECIMAL(12,2),
  location VARCHAR(120),
  source_name VARCHAR(100) NOT NULL,
  source_url TEXT NOT NULL,
  affiliate_url TEXT,
  evaluation_score INT CHECK (evaluation_score BETWEEN 0 AND 100),
  priority radar_hub.priority_level DEFAULT 'NORMAL',
  raw_metadata JSONB DEFAULT '{}'::jsonb,
  status radar_hub.deal_status DEFAULT 'ACTIVE',
  fingerprint_hash VARCHAR(64) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_score ON radar_hub.opportunities(evaluation_score DESC);
CREATE INDEX IF NOT EXISTS idx_radar_category ON radar_hub.opportunities(category);
CREATE INDEX IF NOT EXISTS idx_radar_priority ON radar_hub.opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_radar_status ON radar_hub.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_radar_created_at ON radar_hub.opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_fingerprint ON radar_hub.opportunities(fingerprint_hash);

-- 3. LOGS DE EXECUÇÃO
CREATE TABLE IF NOT EXISTS radar_hub.execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name VARCHAR(100) NOT NULL,
  items_processed INT DEFAULT 0,
  opportunities_found INT DEFAULT 0,
  alerts_dispatched INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  error_message TEXT,
  duration_ms INT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LOCKS DE CACHE & DEDUPLICAÇÃO
CREATE TABLE IF NOT EXISTS radar_hub.cache_locks (
  key VARCHAR(255) PRIMARY KEY,
  locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. ORDENS DE CHECKOUT (ONE-CLICK BUY)
CREATE TABLE IF NOT EXISTS radar_hub.checkout_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES radar_hub.opportunities(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  account_email VARCHAR(120),
  applied_coupons TEXT[],
  final_checkout_price DECIMAL(12,2) NOT NULL,
  pix_code TEXT,
  pix_qr_url TEXT,
  order_status VARCHAR(30) DEFAULT 'PIX_PENDING',
  execution_logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 6. ASSINANTES VIP & MONETIZAÇÃO
CREATE TABLE IF NOT EXISTS radar_hub.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email VARCHAR(150) NOT NULL UNIQUE,
  customer_name VARCHAR(150),
  telegram_user_id BIGINT,
  telegram_username VARCHAR(100),
  plan_tier VARCHAR(50) DEFAULT 'VIP_MONTHLY',
  subscription_status VARCHAR(30) DEFAULT 'ACTIVE',
  gateway_subscription_id VARCHAR(100),
  access_invite_link TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. TABELA DE BENCHMARKS DE M² (BAURU E REGIÃO)
CREATE TABLE IF NOT EXISTS radar_hub.bauru_neighborhood_m2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood VARCHAR(100) NOT NULL UNIQUE,
  zone VARCHAR(50),
  avg_m2_price DECIMAL(10,2) NOT NULL,
  commercial_m2_price DECIMAL(10,2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO radar_hub.bauru_neighborhood_m2 (neighborhood, zone, avg_m2_price, commercial_m2_price)
VALUES 
  ('Jardim America', 'Zona Sul', 6800.00, 8500.00),
  ('Altos da Cidade', 'Zona Central/Sul', 5400.00, 7200.00),
  ('Vila Aviacao', 'Zona Sul', 8200.00, 9800.00),
  ('Vila Universitaria', 'Zona Sul', 5100.00, 6500.00),
  ('Parque das Nacoes', 'Zona Norte', 3200.00, 4100.00),
  ('Nucleo Mary Dota', 'Zona Leste', 2700.00, 3400.00),
  ('Centro', 'Zona Central', 3900.00, 5800.00),
  ('Bauru - Media Geral', 'Geral', 4200.00, 5500.00)
ON CONFLICT (neighborhood) DO UPDATE SET
  avg_m2_price = EXCLUDED.avg_m2_price,
  updated_at = NOW();

-- 8. PROCEDURE DE MANUTENÇÃO E LIMPEZA ZERO-TOUCH
CREATE OR REPLACE FUNCTION radar_hub.run_storage_maintenance()
RETURNS TABLE (deleted_count INT, archived_count INT) AS $$
DECLARE
  v_deleted INT;
  v_archived INT;
BEGIN
  WITH deleted AS (
    DELETE FROM radar_hub.opportunities 
    WHERE created_at < NOW() - INTERVAL '15 days' 
      AND status IN ('EXPIRED', 'ARCHIVED')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  WITH archived AS (
    UPDATE radar_hub.opportunities 
    SET status = 'ARCHIVED' 
    WHERE created_at < NOW() - INTERVAL '7 days' 
      AND status = 'ACTIVE' 
      AND evaluation_score < 80
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived FROM archived;

  RETURN QUERY SELECT v_deleted, v_archived;
END;
$$ LANGUAGE plpgsql;

-- 9. VIEW DE OPORTUNIDADES EM ALTA
CREATE OR REPLACE VIEW radar_hub.v_hot_opportunities AS
SELECT 
  id,
  category,
  title,
  opportunity_price,
  original_price,
  discount_percentage,
  net_profit_estimate,
  fipe_or_market_ref,
  location,
  source_name,
  affiliate_url,
  evaluation_score,
  priority,
  created_at
FROM radar_hub.opportunities
WHERE status = 'ACTIVE' 
  AND (evaluation_score >= 70 OR priority = 'CRITICAL_BUG')
ORDER BY 
  CASE WHEN priority = 'CRITICAL_BUG' THEN 1 ELSE 2 END,
  evaluation_score DESC,
  created_at DESC;
