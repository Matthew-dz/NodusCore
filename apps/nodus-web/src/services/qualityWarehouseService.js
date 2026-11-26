// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { computeSha256Hex, DEFAULT_TENANT_UUID, graphqlRequest } from '../lib/graphql';

export const QUALITY_WAREHOUSE_BATCHES_QUERY = `
  query QualityWarehouseBatches {
    batches(order_by: { created_at: desc }, limit: 30) {
      id
      tenant_id
      batch_code
      product_name
      quantity
      unit
      status
      inspections(order_by: { inspected_at: desc }, limit: 1) {
        id
        inspection_code
        result
        notes
        inspected_at
      }
    }
  }
`;

const INSERT_INSPECTION_MUTATION = `
  mutation CreateInspection(
    $tenant_id: uuid!
    $batch_id: uuid!
    $inspection_code: String!
    $result: String!
    $notes: String!
    $batch_status: String!
    $payload: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_inspections_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        inspection_code: $inspection_code
        result: $result
        notes: $notes
        minio_report_path: "s3://nodus-inspections/demo-report.pdf"
      }
    ) {
      id
      inspection_code
      result
      notes
      inspected_at
    }
    update_batches_by_pk(
      pk_columns: { id: $batch_id }
      _set: { status: $batch_status }
    ) {
      id
      status
    }
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "INSPECTION"
        event_type: "QUALITY_INSPECTED"
        location: "Trung tâm Kiểm định Chất lượng"
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        action: "INSPECTION_RECORDED"
        data_snapshot: $payload
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

const MOVE_TO_STORAGE_MUTATION = `
  mutation MoveBatchToStorage($id: uuid!) {
    update_batches_by_pk(pk_columns: { id: $id }, _set: { status: "IN_STORAGE" }) {
      id
      batch_code
      status
    }
  }
`;

const LOG_STORAGE_EVENT = `
  mutation LogStorageEvent(
    $tenant_id: uuid!
    $batch_id: uuid!
    $location: String!
    $payload: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "STORAGE"
        event_type: "STORED_IN_WAREHOUSE"
        location: $location
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        action: "WAREHOUSE_INTAKE"
        data_snapshot: $payload
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export function isPokaYokeViolationError(message = '') {
  const normalized = String(message).toLowerCase();
  return (
    normalized.includes('poka-yoke') ||
    normalized.includes('in_storage') ||
    normalized.includes('without a passed inspection') ||
    normalized.includes('passed inspection')
  );
}

export async function fetchQualityWarehouseBatches({ token, role }) {
  const data = await graphqlRequest({
    query: QUALITY_WAREHOUSE_BATCHES_QUERY,
    token,
    role,
  });
  return data?.batches || [];
}

export async function submitBatchInspection({
  token,
  role,
  batch,
  result,
  agency,
  brix,
  residueTest,
  notes,
  actorUsername,
}) {
  if (!batch?.id) {
    throw new Error('Không xác định được lô hàng cần kiểm định.');
  }
  if (result !== 'PASSED' && result !== 'FAILED') {
    throw new Error('Kết quả kiểm định chỉ chấp nhận PASSED hoặc FAILED.');
  }

  const tenantId = batch.tenant_id || DEFAULT_TENANT_UUID;
  const inspectionCode = `INSP-${Date.now().toString(36).toUpperCase()}`;
  const brixNum = Number(brix);
  const metricsSummary = `Brix: ${brixNum}%, Dư lượng BVTV: ${residueTest.trim()}`;
  const combinedNotes = `[Đơn vị: ${agency.trim()}] [Chỉ số: ${metricsSummary}] ${notes.trim()}`.trim();
  const payload = {
    batch_code: batch.batch_code,
    inspection_code: inspectionCode,
    result,
    agency: agency.trim(),
    brix: brixNum,
    residue_test: residueTest.trim(),
    metrics: metricsSummary,
    notes: notes.trim(),
    inspector: actorUsername,
  };
  const sha256 = await computeSha256Hex(payload);

  const res = await graphqlRequest({
    query: INSERT_INSPECTION_MUTATION,
    variables: {
      tenant_id: tenantId,
      batch_id: batch.id,
      inspection_code: inspectionCode,
      result,
      notes: combinedNotes,
      batch_status: result === 'PASSED' ? 'INSPECTING' : 'REJECTED',
      payload,
      sha256_hash: sha256,
    },
    token,
    role,
  });

  const inspection = res?.insert_inspections_one;
  const updatedBatch = res?.update_batches_by_pk;
  if (!inspection?.id || !updatedBatch?.status) {
    throw new Error('Backend không trả về dữ liệu phiếu kiểm định hợp lệ.');
  }

  return { inspection, updatedBatch };
}

export async function submitWarehouseIntake({
  token,
  role,
  batch,
  actorUsername,
  storageLocation = 'Kho lạnh Trung tâm HTX Đà Nẵng - Kệ A1',
  storageTemp = 4,
}) {
  if (!batch?.id) {
    throw new Error('Không xác định được lô hàng cần nhập kho.');
  }

  const moveRes = await graphqlRequest({
    query: MOVE_TO_STORAGE_MUTATION,
    variables: { id: batch.id },
    token,
    role,
  });

  const updatedBatch = moveRes?.update_batches_by_pk;
  if (!updatedBatch?.id || updatedBatch?.status !== 'IN_STORAGE') {
    throw new Error('Backend không xác nhận chuyển trạng thái lô hàng sang IN_STORAGE.');
  }

  let auditWarning = '';
  try {
    const tenantId = batch.tenant_id || DEFAULT_TENANT_UUID;
    const resolvedLocation = `${storageLocation.trim()} (${Number(storageTemp)}°C)`;
    const payload = {
      batch_code: batch.batch_code,
      warehouse_keeper: actorUsername,
      storage_location: storageLocation.trim(),
      temperature_c: Number(storageTemp),
      status: updatedBatch.status,
    };
    const sha256 = await computeSha256Hex(payload);

    await graphqlRequest({
      query: LOG_STORAGE_EVENT,
      variables: {
        tenant_id: tenantId,
        batch_id: batch.id,
        location: resolvedLocation,
        payload,
        sha256_hash: sha256,
      },
      token,
      role,
    });
  } catch (err) {
    auditWarning = `Đã nhập kho lô ${updatedBatch.batch_code}, nhưng chưa ghi được nhật ký sự kiện: ${err.message}`;
  }

  return { updatedBatch, auditWarning };
}
