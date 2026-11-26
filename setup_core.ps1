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
$hasuraSecret = if ($envMap["HASURA_GRAPHQL_ADMIN_SECRET"]) { $envMap["HASURA_GRAPHQL_ADMIN_SECRET"] } else { "nodus_local_hasura_2026" }

Write-Host "=== 3. Running PostgreSQL Schema Migrations ===" -ForegroundColor Cyan
Get-Content "core\postgres\init.sql" -Raw | docker compose exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1
Get-Content "core\postgres\04_alter_schema_real_data.sql" -Raw | docker compose exec -T postgres psql -U $pgUser -d $pgDb -v ON_ERROR_STOP=1

Write-Host "=== 4. Ingesting Open Data (OSM Overpass + Da Nang Open Data) ===" -ForegroundColor Cyan
$env:POSTGRES_USER = $pgUser
$env:POSTGRES_DB = $pgDb
python core\scripts\ingest_open_data.py

Write-Host "=== 5. Tracking Tables & Permissions in Hasura ===" -ForegroundColor Cyan
$headers = @{
    "Content-Type" = "application/json"
    "x-hasura-admin-secret" = $hasuraSecret
}

$tables = @("tenants", "production_zones", "batches", "batch_audit_trail")
$ops = @()
foreach ($t in $tables) {
    $ops += @{ type = "pg_track_table"; args = @{ source = "default"; table = @{ schema = "public"; name = $t } } }
}
foreach ($op in $ops) {
    try {
        Invoke-RestMethod -Method Post -Uri "http://localhost:8082/v1/metadata" -Headers $headers -Body ($op | ConvertTo-Json -Depth 10) | Out-Null
    } catch { }
}

$permOps = @()
foreach ($t in @("batches", "production_zones", "batch_audit_trail", "tenants")) {
    $permOps += @{ type = "pg_create_select_permission"; args = @{ source = "default"; table = $t; role = "farmer"; permission = @{ columns = "*"; filter = @{} } } }
    $permOps += @{ type = "pg_create_insert_permission"; args = @{ source = "default"; table = $t; role = "farmer"; permission = @{ check = @{}; columns = "*" } } }
}
foreach ($op in $permOps) {
    try {
        Invoke-RestMethod -Method Post -Uri "http://localhost:8082/v1/metadata" -Headers $headers -Body ($op | ConvertTo-Json -Depth 10) | Out-Null
    } catch { }
}

Write-Host "=== Setup Completed Successfully! ===" -ForegroundColor Green
