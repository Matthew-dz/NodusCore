-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
-- NodusCore DX-OS Core Database Schema (PostgreSQL 16)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. tenants: Multi-tenancy management
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(64) NOT NULL UNIQUE,
    name        VARCHAR(255) NOT NULL,
    status      VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
                CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. user_profiles: Linked to Keycloak sub and 5 core roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    keycloak_sub  VARCHAR(128) NOT NULL UNIQUE,
    username      VARCHAR(128) NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    email         VARCHAR(255),
    phone         VARCHAR(32),
    role          VARCHAR(32) NOT NULL
                  CHECK (role IN ('farmer', 'coop_admin', 'inspector', 'warehouse_keeper', 'distributor')),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant_id ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_keycloak_sub ON user_profiles(keycloak_sub);

-- ============================================================================
-- 3. production_zones: Agricultural growing areas
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_zones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    zone_code         VARCHAR(64) NOT NULL,
    name              VARCHAR(255) NOT NULL,
    crop_type         VARCHAR(128) NOT NULL,
    area_hectares     NUMERIC(10, 2) CHECK (area_hectares > 0),
    location_geojson  JSONB,
    certification     VARCHAR(128),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, zone_code)
);

CREATE INDEX IF NOT EXISTS idx_production_zones_tenant_id ON production_zones(tenant_id);

-- ============================================================================
-- 4. batches: Agricultural batches with public_trace_key for QR codes
-- ============================================================================
CREATE TABLE IF NOT EXISTS batches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    zone_id           UUID NOT NULL REFERENCES production_zones(id) ON DELETE RESTRICT,
    created_by        UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    batch_code        VARCHAR(64) NOT NULL,
    public_trace_key  VARCHAR(64) NOT NULL UNIQUE,
    product_name      VARCHAR(255) NOT NULL,
    quantity          NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit              VARCHAR(32) NOT NULL DEFAULT 'kg',
    harvest_date      DATE,
    status            VARCHAR(32) NOT NULL DEFAULT 'CREATED'
                      CHECK (status IN ('CREATED', 'HARVESTED', 'INSPECTING', 'IN_STORAGE', 'DISTRIBUTING', 'SOLD', 'REJECTED')),
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, batch_code)
);

CREATE INDEX IF NOT EXISTS idx_batches_tenant_id ON batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batches_zone_id ON batches(zone_id);
CREATE INDEX IF NOT EXISTS idx_batches_public_trace_key ON batches(public_trace_key);

-- ============================================================================
-- 5. inspections: Quality inspection records & MinIO report path
-- ============================================================================
CREATE TABLE IF NOT EXISTS inspections (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_id           UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    inspector_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    inspection_code    VARCHAR(64) NOT NULL,
    result             VARCHAR(32) NOT NULL
                       CHECK (result IN ('PENDING', 'PASSED', 'FAILED')),
    notes              TEXT,
    minio_report_path  TEXT,
    inspected_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, inspection_code)
);

CREATE INDEX IF NOT EXISTS idx_inspections_batch_id ON inspections(batch_id);

-- ============================================================================
-- 6. batch_events: 5-stage supply chain event log
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_id     UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    actor_id     UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    stage        VARCHAR(32) NOT NULL
                 CHECK (stage IN ('CULTIVATION', 'HARVEST', 'INSPECTION', 'STORAGE', 'DISTRIBUTION')),
    event_type   VARCHAR(64) NOT NULL,
    location     VARCHAR(255),
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_events_batch_id ON batch_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_events_stage ON batch_events(stage);

-- ============================================================================
-- 7. batch_audit_trail: Append-only SHA-256 data sealing ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS batch_audit_trail (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    batch_id       UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    actor_id       UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    action         VARCHAR(64) NOT NULL,
    data_snapshot  JSONB NOT NULL,
    prev_hash      CHAR(64),
    sha256_hash    CHAR(64) NOT NULL,
    sealed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_audit_trail_batch_id ON batch_audit_trail(batch_id);

-- ============================================================================
-- 8. plugin_registry: Plug-and-play module registry
-- ============================================================================
CREATE TABLE IF NOT EXISTS plugin_registry (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plugin_key     VARCHAR(64) NOT NULL UNIQUE,
    name           VARCHAR(255) NOT NULL,
    version        VARCHAR(32) NOT NULL,
    is_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    config         JSONB NOT NULL DEFAULT '{}'::jsonb,
    registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Poka-yoke Triggers
-- ============================================================================

-- Trigger 1: Prevent transitioning batch status to 'IN_STORAGE' without a 'PASSED' inspection
CREATE OR REPLACE FUNCTION prevent_uninspected_batch_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'IN_STORAGE' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'IN_STORAGE') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM inspections
            WHERE batch_id = NEW.id
              AND result = 'PASSED'
        ) THEN
            RAISE EXCEPTION 'Poka-yoke violation: Batch % cannot transition to IN_STORAGE without a PASSED inspection.', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batches_require_passed_inspection ON batches;
CREATE TRIGGER trg_batches_require_passed_inspection
    BEFORE INSERT OR UPDATE OF status ON batches
    FOR EACH ROW
    EXECUTE FUNCTION prevent_uninspected_batch_storage();

-- Trigger 2: Enforce Append-Only on batch_audit_trail (block UPDATE and DELETE)
CREATE OR REPLACE FUNCTION prevent_audit_trail_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Poka-yoke violation: batch_audit_trail is append-only; % operations are forbidden.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_batch_audit_trail_append_only ON batch_audit_trail;
CREATE TRIGGER trg_batch_audit_trail_append_only
    BEFORE UPDATE OR DELETE ON batch_audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_trail_mutation();
