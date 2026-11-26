-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
-- NodusCore DX-OS | Migration: Align Database Schema with Real Agricultural Open Data

-- 1. Bổ sung thuộc tính thực tế cho bảng Hợp tác xã (Tenants)
ALTER TABLE tenants 
    ADD COLUMN IF NOT EXISTS tax_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS legal_rep VARCHAR(100),
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Bổ sung thuộc tính thực tế cho bảng Vùng trồng (Production Zones)
ALTER TABLE production_zones 
    ADD COLUMN IF NOT EXISTS puc_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS area_hectares NUMERIC(10, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS crop_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS farming_standard VARCHAR(50) DEFAULT 'VietGAP',
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Bổ sung thuộc tính thực tế cho bảng Lô hàng (Batches)
ALTER TABLE batches 
    ADD COLUMN IF NOT EXISTS certificate_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS expiry_date DATE,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Tạo chỉ mục tìm kiếm tối ưu truy vấn
CREATE INDEX IF NOT EXISTS idx_production_zones_puc ON production_zones (puc_code);
CREATE INDEX IF NOT EXISTS idx_tenants_tax_code ON tenants (tax_code);
