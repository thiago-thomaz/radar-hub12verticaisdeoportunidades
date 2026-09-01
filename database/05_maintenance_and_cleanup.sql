-- ==============================================================================
-- RADAR_HUB - ROTINAS DE AUTOLIMPEZA, RETENÇÃO E MANUTENÇÃO DE PARTIÇÕES
-- SCHEMA DEDICADO: radar_hub (database/05_maintenance_and_cleanup.sql)
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS radar_hub;

-- 1. EXPIRAÇÃO DE LOCKS DE CACHE E DEDUPLICAÇÃO
CREATE OR REPLACE FUNCTION radar_hub.cleanup_expired_cache_locks()
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM radar_hub.cache_locks
    WHERE locked_until < NOW()
    RETURNING key
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 2. POLÍTICA DE RETENÇÃO DE LOGS DE EXECUÇÃO (> 30 DIAS)
CREATE OR REPLACE FUNCTION radar_hub.purge_old_execution_logs(p_retention_days INT DEFAULT 30)
RETURNS INT AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM radar_hub.execution_logs
    WHERE executed_at < NOW() - (p_retention_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 3. ARQUIVAMENTO E SOFT-DELETE DE OPORTUNIDADES EXPIRADAS / ESGOTADAS
CREATE OR REPLACE FUNCTION radar_hub.archive_stale_opportunities(
  p_active_retention_days INT DEFAULT 7,
  p_hard_delete_days INT DEFAULT 30
)
RETURNS TABLE (archived_count INT, hard_deleted_count INT) AS $$
DECLARE
  v_archived INT;
  v_hard_deleted INT;
BEGIN
  -- Arquivar oportunidades ativas antigas com score moderado (< 85)
  WITH archived AS (
    UPDATE radar_hub.opportunities
    SET status = 'ARCHIVED',
        updated_at = NOW()
    WHERE status = 'ACTIVE'
      AND created_at < NOW() - (p_active_retention_days || ' days')::INTERVAL
      AND evaluation_score < 85
      AND priority != 'CRITICAL_BUG'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_archived FROM archived;

  -- Hard-delete permanente de itens arquivados ou expirados há mais de 30 dias
  WITH hard_deleted AS (
    DELETE FROM radar_hub.opportunities
    WHERE status IN ('EXPIRED', 'ARCHIVED')
      AND created_at < NOW() - (p_hard_delete_days || ' days')::INTERVAL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_hard_deleted FROM hard_deleted;

  RETURN QUERY SELECT v_archived, v_hard_deleted;
END;
$$ LANGUAGE plpgsql;

-- 4. PROCEDURE MESTRA DE MANUTENÇÃO PERIÓDICA (WATCHDOG EXECUTOR)
CREATE OR REPLACE FUNCTION radar_hub.run_full_system_maintenance()
RETURNS JSONB AS $$
DECLARE
  v_locks_cleaned INT;
  v_logs_purged INT;
  v_opps_archived INT;
  v_opps_deleted INT;
  v_result JSONB;
BEGIN
  -- Executar etapas
  v_locks_cleaned := radar_hub.cleanup_expired_cache_locks();
  v_logs_purged := radar_hub.purge_old_execution_logs(30);
  
  SELECT archived_count, hard_deleted_count 
  INTO v_opps_archived, v_opps_deleted
  FROM radar_hub.archive_stale_opportunities(7, 30);

  -- Registrar log de auditoria no watchdog_logs
  INSERT INTO radar_hub.watchdog_logs (
    check_type,
    records_last_2h,
    cleaned_records_count,
    archived_records_count,
    status,
    details
  ) VALUES (
    'FULL_SYSTEM_MAINTENANCE',
    0,
    v_locks_cleaned + v_logs_purged + v_opps_deleted,
    v_opps_archived,
    'HEALTHY',
    jsonb_build_object(
      'locks_cleaned', v_locks_cleaned,
      'logs_purged_30d', v_logs_purged,
      'opportunities_archived', v_opps_archived,
      'opportunities_hard_deleted', v_opps_deleted,
      'timestamp', NOW()
    )
  );

  v_result := jsonb_build_object(
    'status', 'SUCCESS',
    'locks_cleaned', v_locks_cleaned,
    'logs_purged', v_logs_purged,
    'opportunities_archived', v_opps_archived,
    'opportunities_hard_deleted', v_opps_deleted,
    'executed_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 5. VIEW DE MÉTRICAS OPERACIONAIS E SAÚDE DO SISTEMA (24H)
CREATE OR REPLACE VIEW radar_hub.v_system_health_metrics AS
SELECT
  (SELECT COUNT(*) FROM radar_hub.opportunities WHERE status = 'ACTIVE') AS active_opportunities,
  (SELECT COUNT(*) FROM radar_hub.opportunities WHERE priority = 'CRITICAL_BUG' AND status = 'ACTIVE') AS critical_bugs_active,
  (SELECT COUNT(*) FROM radar_hub.opportunities WHERE created_at >= NOW() - INTERVAL '24 HOURS') AS ingested_last_24h,
  (SELECT COUNT(*) FROM radar_hub.cache_locks WHERE locked_until >= NOW()) AS active_locks_count,
  (SELECT COUNT(*) FROM radar_hub.subscribers WHERE subscription_status = 'ACTIVE') AS active_vip_subscribers,
  (SELECT COUNT(*) FROM radar_hub.execution_logs WHERE executed_at >= NOW() - INTERVAL '24 HOURS' AND status = 'SUCCESS') AS successful_pipeline_runs_24h,
  (SELECT COUNT(*) FROM radar_hub.execution_logs WHERE executed_at >= NOW() - INTERVAL '24 HOURS' AND status != 'SUCCESS') AS failed_pipeline_runs_24h;
