-- ==============================================================================
-- RADAR SUPREMO DE ARBITRAGEM (RADAR_HUB) - EXPANSÃO DE 8 NOVOS NICHOS
-- ==============================================================================

-- 1. Extensão de Tipos de Oportunidades (Idempotente)
DO $$ BEGIN
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'coupon_deal';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'cashback_max';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'sweepstake_promo';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'real_estate_local';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'public_tender';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'expired_domain';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'remote_job';
    ALTER TYPE radar_hub.opportunity_type ADD VALUE IF NOT EXISTS 'microtask_gig';
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN others THEN null;
END $$;

-- 2. Tabela de Referência de Valor Médio por M² (Bauru e Região)
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

-- 3. Tabela de Monitoramento de Licitações (PNCP / Comprasnet)
CREATE TABLE IF NOT EXISTS radar_hub.tender_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword VARCHAR(100) NOT NULL UNIQUE,
  min_estimated_value DECIMAL(12,2) DEFAULT 5000.00,
  max_estimated_value DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO radar_hub.tender_keywords (keyword, min_estimated_value)
VALUES 
  ('desenvolvimento de software', 30000.00),
  ('computadores e notebooks', 20000.00),
  ('servicos de ti e infraestrutura', 50000.00),
  ('licenciamento de software', 15000.00),
  ('veiculos e frotas', 80000.00)
ON CONFLICT (keyword) DO NOTHING;
