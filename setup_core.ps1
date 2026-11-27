# Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
# NodusCore DX-OS | Quick Setup Script (Migrate + Open Data Ingestion + Hasura Metadata)

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Starting NodusCore Open-Core containers ===" -ForegroundColor Cyan
docker compose up -d

Write-Host "=== 2. Waiting for PostgreSQL & Hasura ===" -ForegroundColor Cyan
for ($i = 0; $i -lt 20; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:8082/healthz" -UseBasicParsing -TimeoutSec 2
        if ($res.StatusCode -eq 200) { break }
    } catch {
        Start-Sleep -Seconds 2
    }
}

# Load .env variables
$envMap = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $envMap[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}
$pgUser = if ($envMap["POSTGRES_USER"]) { $envMap["POSTGRES_USER"] } else { "nodus_admin" }
$pgDb = if ($envMap["POSTGRES_DB"]) { $envMap["POSTGRES_DB"] } else { "nodus_core" }
$hasuraSecret = if ($envMap["HASURA_GRAPHQL_ADMIN_SECRET"]) { $envMap["HASURA_GRAPHQL_ADMIN_SECRET"] } else { "nodus_admin_secret_2026" }

Write-Host "=== 3. Running PostgreSQL Schema Migrations ===" -ForegroundColor Cyan
Get-Content "core\postgres\init.sql" -Raw | docker compose exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1
Get-Content "core\postgres\04_alter_schema_real_data.sql" -Raw | docker compose exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1
Get-Content "core\postgres\06_consolidate_core_fixes.sql" -Raw | docker compose exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1

Write-Host "=== 4. Ingesting Open Data (Da Nang 158 Zones Offline-First) ===" -ForegroundColor Cyan
$env:POSTGRES_USER = $pgUser
$env:POSTGRES_DB = $pgDb
python core\scripts\ingest_open_data.py

Write-Host "=== 5. Tracking Tables, Relationships & Permissions in Hasura ===" -ForegroundColor Cyan
$headers = @{
    "Content-Type" = "application/json"
    "x-hasura-admin-secret" = $hasuraSecret
}

function Invoke-HasuraMetadata {
    param([hashtable]$Payload)
    try {
        Invoke-RestMethod -Method Post -Uri "http://localhost:8082/v1/metadata" -Headers $headers -Body ($Payload | ConvertTo-Json -Depth 12) | Out-Null
    } catch { }
}

# 5a. Track 8 core tables + anomaly view
$tables = @(
    "tenants",
    "user_profiles",
    "production_zones",
    "batches",
    "inspections",
    "batch_events",
    "batch_audit_trail",
    "plugin_registry",
    "v_production_zone_anomalies"
)
foreach ($t in $tables) {
    Invoke-HasuraMetadata @{ type = "pg_track_table"; args = @{ source = "default"; table = @{ schema = "public"; name = $t } } }
}

# 5b. Create Hasura relationships on batches
Invoke-HasuraMetadata @{
    type = "pg_create_object_relationship"
    args = @{
        source = "default"
        table  = @{ schema = "public"; name = "batches" }
        name   = "production_zone"
        using  = @{ foreign_key_constraint_on = "zone_id" }
    }
}
Invoke-HasuraMetadata @{
    type = "pg_create_array_relationship"
    args = @{
        source = "default"
        table  = @{ schema = "public"; name = "batches" }
        name   = "inspections"
        using  = @{ foreign_key_constraint_on = @{ table = @{ schema = "public"; name = "inspections" }; column = "batch_id" } }
    }
}

# 5c. Public Trace role (Least Privilege)
foreach ($sensitive in @("inspections", "user_profiles", "plugin_registry")) {
    Invoke-HasuraMetadata @{ type = "pg_drop_select_permission"; args = @{ source = "default"; table = $sensitive; role = "public_trace" } }
}
Invoke-HasuraMetadata @{ type = "pg_drop_select_permission"; args = @{ source = "default"; table = "batches"; role = "public_trace" } }
Invoke-HasuraMetadata @{
    type = "pg_create_select_permission"
    args = @{
        source = "default"
        table  = "batches"
        role   = "public_trace"
        permission = @{
            columns = @("id", "batch_code", "public_trace_key", "product_name", "quantity", "unit", "harvest_date", "expiry_date", "status", "certificate_code", "metadata")
            filter  = @{ status = @{ _in = @("IN_STORAGE", "DISTRIBUTING", "SOLD") } }
        }
    }
}
foreach ($pubTable in @("production_zones", "tenants", "v_production_zone_anomalies")) {
    Invoke-HasuraMetadata @{ type = "pg_drop_select_permission"; args = @{ source = "default"; table = $pubTable; role = "public_trace" } }
    Invoke-HasuraMetadata @{
        type = "pg_create_select_permission"
        args = @{
            source     = "default"
            table      = $pubTable
            role       = "public_trace"
            permission = @{ columns = "*"; filter = @{} }
        }
    }
}

# 5d. Internal roles (inspector, warehouse_keeper, coop_admin, farmer)
$internalRoles = @("inspector", "warehouse_keeper", "coop_admin", "farmer")
foreach ($role in $internalRoles) {
    foreach ($t in $tables) {
        Invoke-HasuraMetadata @{ type = "pg_create_select_permission"; args = @{ source = "default"; table = $t; role = $role; permission = @{ columns = "*"; filter = @{} } } }
    }
}
foreach ($t in @("batches", "production_zones", "batch_events", "batch_audit_trail")) {
    Invoke-HasuraMetadata @{ type = "pg_create_insert_permission"; args = @{ source = "default"; table = $t; role = "farmer"; permission = @{ check = @{}; columns = "*" } } }
}
foreach ($t in @("inspections", "batch_events", "batch_audit_trail")) {
    Invoke-HasuraMetadata @{ type = "pg_create_insert_permission"; args = @{ source = "default"; table = $t; role = "inspector"; permission = @{ check = @{}; columns = "*" } } }
}
Invoke-HasuraMetadata @{ type = "pg_create_update_permission"; args = @{ source = "default"; table = "batches"; role = "inspector"; permission = @{ columns = @("status", "updated_at"); filter = @{} } } }
Invoke-HasuraMetadata @{ type = "pg_create_update_permission"; args = @{ source = "default"; table = "inspections"; role = "inspector"; permission = @{ columns = "*"; filter = @{} } } }

foreach ($t in @("batch_events", "batch_audit_trail")) {
    Invoke-HasuraMetadata @{ type = "pg_create_insert_permission"; args = @{ source = "default"; table = $t; role = "warehouse_keeper"; permission = @{ check = @{}; columns = "*" } } }
}
Invoke-HasuraMetadata @{ type = "pg_create_update_permission"; args = @{ source = "default"; table = "batches"; role = "warehouse_keeper"; permission = @{ columns = @("status", "metadata", "updated_at"); filter = @{} } } }

foreach ($t in @("tenants", "user_profiles", "production_zones", "batches", "inspections", "batch_events", "batch_audit_trail", "plugin_registry")) {
    Invoke-HasuraMetadata @{ type = "pg_create_insert_permission"; args = @{ source = "default"; table = $t; role = "coop_admin"; permission = @{ check = @{}; columns = "*" } } }
    Invoke-HasuraMetadata @{ type = "pg_create_update_permission"; args = @{ source = "default"; table = $t; role = "coop_admin"; permission = @{ columns = "*"; filter = @{} } } }
}

Write-Host "=== Setup Completed Successfully! ===" -ForegroundColor Green
