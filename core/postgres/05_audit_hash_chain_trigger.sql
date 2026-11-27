-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
-- NodusCore DX-OS | Server-side SHA-256 Hash Chaining Trigger on nodus_core.batch_audit_trail

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
