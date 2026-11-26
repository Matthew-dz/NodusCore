-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
-- NodusCore DX-OS | THUAN-01: Cryptographic Audit Trail (PostgreSQL 16 + pgcrypto)

-- ============================================================================
-- 1. Enable pgcrypto extension for SHA-256 digest()
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. Define batch_audit_trail table (Append-Only Cryptographic Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_audit_trail (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id      UUID NOT NULL,
    event_type    VARCHAR(50) NOT NULL,  -- e.g., HARVESTED, INSPECTED, IN_STORAGE, DISTRIBUTED
    actor_id      VARCHAR(100) NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    prev_hash     VARCHAR(64) NOT NULL DEFAULT repeat('0', 64),
    current_hash  VARCHAR(64) NOT NULL DEFAULT repeat('0', 64),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Ensure columns exist if table was initialized earlier
ALTER TABLE batch_audit_trail ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64) NOT NULL DEFAULT repeat('0', 64);
ALTER TABLE batch_audit_trail ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64) NOT NULL DEFAULT repeat('0', 64);

CREATE INDEX IF NOT EXISTS idx_batch_audit_trail_batch_created
    ON batch_audit_trail (batch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batch_audit_trail_current_hash
    ON batch_audit_trail (current_hash);

-- ============================================================================
-- 3. Poka-yoke Guardrail 1: Enforce Append-Only (Block UPDATE and DELETE)
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_audit_trail_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Poka-yoke violation: batch_audit_trail is immutable (append-only); % operations are strictly forbidden.',
        TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_audit_trail_append_only ON batch_audit_trail;
CREATE TRIGGER trg_batch_audit_trail_append_only
    BEFORE UPDATE OR DELETE ON batch_audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_trail_mutation();

-- ============================================================================
-- 4. Poka-yoke Guardrail 2: Automatic SHA-256 Hash Chaining (BEFORE INSERT)
-- ============================================================================
CREATE OR REPLACE FUNCTION seal_batch_audit_trail()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_last_hash VARCHAR(64);
    v_raw_data  TEXT;
BEGIN
    -- Normalize timestamp and payload before hashing
    NEW.created_at := COALESCE(NEW.created_at, clock_timestamp());
    NEW.payload    := COALESCE(NEW.payload, '{}'::jsonb);

    -- Look up the most recent current_hash for the same batch_id
    SELECT current_hash
      INTO v_last_hash
      FROM batch_audit_trail
     WHERE batch_id = NEW.batch_id
     ORDER BY created_at DESC, id DESC
     LIMIT 1;

    -- Genesis block uses 64 zeros if no prior record exists for this batch_id
    NEW.prev_hash := COALESCE(v_last_hash, repeat('0', 64));

    -- Concatenate fields deterministically and compute SHA-256 hex digest
    v_raw_data := NEW.prev_hash
               || NEW.batch_id::text
               || NEW.event_type
               || NEW.actor_id
               || NEW.payload::text
               || to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');

    NEW.current_hash := encode(digest(v_raw_data, 'sha256'), 'hex');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_batch_audit_trail_hash_chain ON batch_audit_trail;
CREATE TRIGGER trg_batch_audit_trail_hash_chain
    BEFORE INSERT ON batch_audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION seal_batch_audit_trail();