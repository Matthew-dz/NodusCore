# Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
# NodusCore DX-OS | Import n8n Workflows & Register Hasura Event Trigger

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Importing n8n workflow: batch_qr_pipeline.json ===" -ForegroundColor Cyan
docker compose cp "core\n8n\workflows\batch_qr_pipeline.json" "n8n:/tmp/batch_qr_pipeline.json"
docker compose exec n8n n8n import:workflow --input=/tmp/batch_qr_pipeline.json
docker compose exec n8n n8n update:workflow --id=nodus-batch-qr-pipeline --active=true
docker compose restart n8n

Write-Host "=== 2. Waiting for n8n & Hasura ===" -ForegroundColor Cyan
for ($i = 0; $i -lt 15; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5678/healthz" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { break }
    } catch { Start-Sleep -Seconds 2 }
}
Start-Sleep -Seconds 3

$envMap = @{}
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $envMap[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
}
$hasuraSecret = if ($envMap["HASURA_GRAPHQL_ADMIN_SECRET"]) { $envMap["HASURA_GRAPHQL_ADMIN_SECRET"] } else { "nodus_admin_secret_2026" }

Write-Host "=== 3. Registering Hasura Event Trigger: on_batch_created ===" -ForegroundColor Cyan
$headers = @{
    "Content-Type" = "application/json"
    "x-hasura-admin-secret" = $hasuraSecret
}

$deletePayload = @{
    type = "pg_delete_event_trigger"
    args = @{ name = "on_batch_created"; source = "default" }
} | ConvertTo-Json -Depth 5
try {
    Invoke-RestMethod -Method Post -Uri "http://localhost:8082/v1/metadata" -Headers $headers -Body $deletePayload | Out-Null
} catch { }

$triggerPayload = @{
    type = "pg_create_event_trigger"
    args = @{
        name = "on_batch_created"
        source = "default"
        table = @{ schema = "public"; name = "batches" }
        webhook = "http://n8n:5678/webhook/new-batch"
        insert = @{ columns = "*" }
    }
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method Post -Uri "http://localhost:8082/v1/metadata" -Headers $headers -Body $triggerPayload | ConvertTo-Json -Compress
Write-Host "=== n8n Workflow & Hasura Event Trigger Ready! ===" -ForegroundColor Green
