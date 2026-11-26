// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { computeSha256Hex, DEFAULT_TENANT_UUID, graphqlRequest } from '../lib/graphql';

export const LIST_BATCHES_QUERY = `
  query FarmerBatches {
    batches(order_by: { created_at: desc }, limit: 20) {
      id
      tenant_id
      zone_id
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      expiry_date
      status
      created_at
    }
    tenants(order_by: { name: asc }) {
      id
      code
      name
    }
    production_zones(order_by: { zone_code: asc }) {
      id
      tenant_id
      zone_code
      name
      crop_type
      certification
    }
  }
`;

export const INSERT_BATCH_MUTATION = `
  mutation CreateBatch(
    $tenant_id: uuid!
    $zone_id: uuid!
    $batch_code: String!
    $public_trace_key: String!
    $product_name: String!
    $quantity: numeric!
    $unit: String!
    $harvest_date: date
    $expiry_date: date
  ) {
    insert_batches_one(
      object: {
        tenant_id: $tenant_id
        zone_id: $zone_id
        batch_code: $batch_code
        public_trace_key: $public_trace_key
        product_name: $product_name
        quantity: $quantity
        unit: $unit
        harvest_date: $harvest_date
        expiry_date: $expiry_date
        status: "HARVESTED"
      }
    ) {
      id
      tenant_id
      zone_id
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      expiry_date
      status
      created_at
    }
  }
`;

export const INSERT_EVENT_AND_AUDIT = `
  mutation LogBatchCreation(
    $tenant_id: uuid!
    $batch_id: uuid!
    $location: String
    $payload: jsonb!
    $data_snapshot: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "HARVEST"
        event_type: "BATCH_CREATED"
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
        action: "BATCH_CREATED"
        data_snapshot: $data_snapshot
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export async function fetchFarmerWorkspaceData({ token, role }) {
  const data = await graphqlRequest({
    query: LIST_BATCHES_QUERY,
    token,
    role,
  });

  return {
    batches: data?.batches || [],
    tenants: data?.tenants || [],
    zones: data?.production_zones || [],
  };
}

export async function createFarmerBatch({
  token,
  role,
  tenantId,
  zoneId,
  zoneName,
  productName,
  harvestDate,
  expiryDate,
  quantity,
  unit,
  actorUsername,
}) {
  const resolvedTenantId = tenantId || DEFAULT_TENANT_UUID;
  const batchCode = `LOT-${Date.now().toString(36).toUpperCase()}`;
  const traceKey = `TR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const res = await graphqlRequest({
    query: INSERT_BATCH_MUTATION,
    variables: {
      tenant_id: resolvedTenantId,
      zone_id: zoneId,
      batch_code: batchCode,
      public_trace_key: traceKey,
      product_name: productName.trim(),
      quantity: Number(quantity),
      unit: unit.trim() || 'kg',
      harvest_date: harvestDate || null,
      expiry_date: expiryDate || null,
    },
    token,
    role,
  });

  const batch = res?.insert_batches_one;
  if (!batch?.id || !batch?.batch_code || !batch?.public_trace_key) {
    throw new Error('Backend không trả về đầy đủ mã lô (batch_code) và mã truy xuất (public_trace_key).');
  }

  let auditWarning = '';
  try {
    const snapshot = {
      batch_code: batch.batch_code,
      public_trace_key: batch.public_trace_key,
      product_name: batch.product_name,
      quantity: batch.quantity,
      unit: batch.unit,
      harvest_date: batch.harvest_date,
      expiry_date: batch.expiry_date,
      actor: actorUsername,
    };
    const sha256 = await computeSha256Hex(snapshot);

    await graphqlRequest({
      query: INSERT_EVENT_AND_AUDIT,
      variables: {
        tenant_id: resolvedTenantId,
        batch_id: batch.id,
        location: zoneName || 'Vùng trồng Hòa Vang - Đà Nẵng',
        payload: snapshot,
        data_snapshot: snapshot,
        sha256_hash: sha256,
      },
      token,
      role,
    });
  } catch (err) {
    auditWarning = `Lô hàng đã lưu vào CSDL, nhưng chưa ghi được nhật ký sự kiện: ${err.message}`;
  }

  return { batch, auditWarning };
}
