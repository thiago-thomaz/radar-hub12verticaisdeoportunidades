-- ==============================================================================
-- RADAR SUPREMO DE ARBITRAGEM, BUGS & LEILÕES (RADAR_HUB)
-- MODO NÃO DESTRUTIVO: ISOLAMENTO TOTAL VIA SCHEMA 'radar_hub'
-- ==============================================================================

-- 1. Criação do Schema Dedicado
CREATE SCHEMA IF NOT EXISTS radar_hub;

-- 2. Criação de Tipos Enumerados (com proteção contra duplicação)
DO $$ BEGIN
    CREATE TYPE radar_hub.opportunity_type AS ENUM (
      'price_bug',
      'car_auction',
      'real_estate_auction',
      'industrial_auction',
      'miles_promo',
      'stacking_deal'
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
    CREATE TYPE radar_hub.deal_status AS ENUM ('ACTIVE', 'EXPIRED', 'PURCHASED', 'FLAGGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabela Principal de Oportunidades
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

-- 4. Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_radar_score ON radar_hub.opportunities(evaluation_score DESC);
CREATE INDEX IF NOT EXISTS idx_radar_category ON radar_hub.opportunities(category);
CREATE INDEX IF NOT EXISTS idx_radar_priority ON radar_hub.opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_radar_status ON radar_hub.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_radar_created_at ON radar_hub.opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_fingerprint ON radar_hub.opportunities(fingerprint_hash);

-- 5. Tabela de Logs de Execução e Auditoria de Ingestão
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

-- 6. Trigger para Atualização Automática de 'updated_at'
CREATE OR REPLACE FUNCTION radar_hub.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_radar_opportunities ON radar_hub.opportunities;
CREATE TRIGGER set_timestamp_radar_opportunities
BEFORE UPDATE ON radar_hub.opportunities
FOR EACH ROW
EXECUTE FUNCTION radar_hub.trigger_set_timestamp();

-- 7. View de Oportunidades Quentes (Top ROI & Critical Bugs)
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
