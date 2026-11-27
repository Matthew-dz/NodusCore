-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
-- NodusCore DX-OS | Consolidated Core Schema, Seed, Audit & Anomaly Fixes (06)

BEGIN;

-- 1. Relax area_hectares CHECK constraint to allow NULL when both planned & current areas are missing
ALTER TABLE production_zones DROP CONSTRAINT IF EXISTS production_zones_area_hectares_check;
ALTER TABLE production_zones ADD CONSTRAINT production_zones_area_hectares_check
    CHECK (area_hectares IS NULL OR area_hectares > 0);

-- 2. Seed user_profiles matching the 5 Keycloak demo accounts
INSERT INTO user_profiles (id, tenant_id, keycloak_sub, username, full_name, email, role, is_active)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'sub-farmer-demo', 'farmer_demo', 'Farmer Demo', 'farmer_demo@noduscore.local', 'farmer', true),
    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 'sub-coop-demo', 'coop_demo', 'Coop Admin Demo', 'coop_demo@noduscore.local', 'coop_admin', true),
    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 'sub-inspector-demo', 'inspector_demo', 'Inspector Demo', 'inspector_demo@noduscore.local', 'inspector', true),
    ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 'sub-warehouse-demo', 'warehouse_demo', 'Warehouse Demo', 'warehouse_demo@noduscore.local', 'warehouse_keeper', true),
    ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000000', 'sub-distributor-demo', 'distributor_demo', 'Distributor Demo', 'distributor_demo@noduscore.local', 'distributor', true)
ON CONFLICT (keycloak_sub) DO UPDATE SET
    username = EXCLUDED.username;

-- 3. Insert valid PASSED inspection to satisfy Poka-yoke gate for sample batch
INSERT INTO inspections (id, tenant_id, batch_id, inspection_code, result, notes)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000000',
    'c0000000-0000-0000-0000-000000000001',
    'INSP-DANANG-2026-001',
    'PASSED',
    'Đạt chuẩn kiểm định VietGAP TCVN 11892-1:2017'
) ON CONFLICT (tenant_id, inspection_code) DO NOTHING;

-- 4. Create anomaly surface view for production zones
CREATE OR REPLACE VIEW v_production_zone_anomalies AS
SELECT
    id, zone_code, name, puc_code, area_hectares,
    metadata->>'area_status' AS area_status,
    metadata->'anomalies' AS anomalies,
    metadata->>'district' AS district,
    metadata->>'ward' AS ward
FROM production_zones
WHERE jsonb_array_length(COALESCE(metadata->'anomalies', '[]'::jsonb)) > 0
   OR metadata->>'area_status' != 'VERIFIED';

-- 5. Server-side SHA-256 hash-chaining trigger on batch_audit_trail
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION seal_nodus_core_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_hash VARCHAR(64);
    v_raw_data  TEXT;
BEGIN
    NEW.sealed_at     := COALESCE(NEW.sealed_at, clock_timestamp());
    NEW.data_snapshot := COALESCE(NEW.data_snapshot, '{}'::jsonb);

    SELECT sha256_hash
      INTO v_last_hash
      FROM batch_audit_trail
     WHERE batch_id = NEW.batch_id
     ORDER BY sealed_at DESC, id DESC
     LIMIT 1;

    NEW.prev_hash := COALESCE(v_last_hash, repeat('0', 64));

    v_raw_data := NEW.prev_hash
               || NEW.batch_id::text
               || NEW.action
               || NEW.data_snapshot::text
               || to_char(NEW.sealed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    NEW.sha256_hash := encode(digest(v_raw_data, 'sha256'), 'hex');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_audit_trail_hash_chain ON batch_audit_trail;
CREATE TRIGGER trg_batch_audit_trail_hash_chain
    BEFORE INSERT ON batch_audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION seal_nodus_core_audit_trail();

-- 6. Ensure sample batch is in IN_STORAGE status for public traceability
UPDATE batches
SET status = 'IN_STORAGE',
    updated_at = NOW()
WHERE id = 'c0000000-0000-0000-0000-000000000001';

COMMIT;
