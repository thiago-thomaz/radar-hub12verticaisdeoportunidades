-- ==============================================================================
-- RADAR SUPREMO DE ARBITRAGEM, BUGS & LEILÕES (RADAR_HUB)
-- MÓDULO FINAL: MONETIZAÇÃO VIP, WATCHDOG E MANUTENÇÃO ZERO-TOUCH
-- ==============================================================================

-- 1. Tabela de Assinantes VIP e Gestão de Planos Recorrentes
CREATE TABLE IF NOT EXISTS radar_hub.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email VARCHAR(150) NOT NULL UNIQUE,
  customer_name VARCHAR(150),
  telegram_user_id BIGINT,
  telegram_username VARCHAR(100),
  plan_tier VARCHAR(50) DEFAULT 'VIP_MONTHLY', -- 'VIP_MONTHLY', 'VIP_ANNUAL', 'LIFETIME'
  subscription_status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'OVERDUE', 'CANCELED', 'EXPIRED'
  gateway_subscription_id VARCHAR(100),
  access_invite_link TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_sub_status ON radar_hub.subscribers(subscription_status);
CREATE INDEX IF NOT EXISTS idx_radar_sub_expires ON radar_hub.subscribers(expires_at);

-- 2. Tabela de Logs do Watchdog
CREATE TABLE IF NOT EXISTS radar_hub.watchdog_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type VARCHAR(50) NOT NULL,
  records_last_2h INT DEFAULT 0,
  cleaned_records_count INT DEFAULT 0,
  archived_records_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'HEALTHY', -- 'HEALTHY', 'ALERT_TRIGGERED', 'ERROR'
  details JSONB DEFAULT '{}'::jsonb,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_watchdog_time ON radar_hub.watchdog_logs(checked_at DESC);

-- 3. Procedure de Manutenção e Otimização de Armazenamento de Disco
CREATE OR REPLACE FUNCTION radar_hub.run_storage_maintenance()
RETURNS TABLE (deleted_count INT, archived_count INT) AS $$
DECLARE
  v_deleted INT;
  v_archived INT;
BEGIN
  -- Expurgo de itens expirados com mais de 15 dias
  WITH deleted AS (
    DELETE FROM radar_hub.opportunities 
    WHERE created_at < NOW() - INTERVAL '15 days' 
      AND status IN ('EXPIRED', 'ARCHIVED')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;

  -- Arquivamento de itens antigos com score menor que 80
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
