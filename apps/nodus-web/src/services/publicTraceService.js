// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { ApiRequestError, graphqlRequest } from '../lib/graphql';

// Chỉ truy vấn các trường tối thiểu phục vụ người tiêu dùng theo quyền Hasura public_trace.
// Không yêu cầu id nội bộ, metadata vận hành, bảng inspections hay payload chứa username nội bộ.
export const PUBLIC_TRACE_FULL_QUERY = `
  query PublicTraceBatch($key: String!) {
    batches(where: { public_trace_key: { _eq: $key } }, limit: 1) {
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      expiry_date
      status
      certificate_code
      tenant {
        code
        name
      }
      production_zone {
        zone_code
        name
        crop_type
        puc_code
        farming_standard
      }
      batch_events(order_by: { occurred_at: asc }) {
        id
        stage
        event_type
        location
        occurred_at
      }
      batch_audit_trails(order_by: { id: asc }) {
        id
        action
        sha256_hash
        sealed_at
      }
    }
  }
`;

export const PUBLIC_TRACE_CORE_QUERY = `
  query PublicTraceBatchCore($key: String!) {
    batches(where: { public_trace_key: { _eq: $key } }, limit: 1) {
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      expiry_date
      status
      certificate_code
      tenant {
        code
        name
      }
      production_zone {
        zone_code
        name
        crop_type
        puc_code
        farming_standard
      }
    }
  }
`;

const TRACE_KEY_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export function validatePublicTraceKey(rawKey) {
  const normalized = String(rawKey ?? '').trim();
  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      error: 'Vui lòng nhập hoặc quét mã truy xuất (public_trace_key).',
    };
  }
  if (normalized.length < 4 || normalized.length > 64 || !TRACE_KEY_PATTERN.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Mã truy xuất không hợp lệ. Khóa truy xuất chỉ gồm chữ cái, chữ số, dấu gạch ngang (-) hoặc gạch dưới (_) dài 4–64 ký tự.',
    };
  }
  if (/^\d+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Mã truy xuất không hợp lệ: hệ thống không sử dụng mã số tuần tự để tra cứu công khai.',
    };
  }
  return { valid: true, normalized, error: '' };
}

function isRestrictedRelationError(err) {
  const msg = String(err?.message || '');
  return (
    err?.code === 'GRAPHQL_ERROR' &&
    (msg.includes('batch_events') || msg.includes('batch_audit_trails')) &&
    msg.includes('not found in type')
  );
}

export function formatPublicTraceError(err) {
  if (err instanceof ApiRequestError) {
    if (err.code === 'RATE_LIMITED') {
      return {
        code: 'RATE_LIMITED',
        message: err.message,
      };
    }
    if (err.code === 'NETWORK_ERROR') {
      return {
        code: 'NETWORK_ERROR',
        message: err.message,
      };
    }
    if (err.code === 'GRAPHQL_ERROR') {
      return {
        code: 'API_ERROR',
        message: 'Không thể truy xuất dữ liệu từ API công khai vào lúc này. Vui lòng thử lại sau.',
      };
    }
    return {
      code: err.code || 'API_ERROR',
      message: err.message,
    };
  }

  return {
    code: 'API_ERROR',
    message: 'Đã xảy ra lỗi kết nối khi truy xuất nguồn gốc. Vui lòng thử lại sau.',
  };
}

export async function fetchPublicTraceBatch(rawKey, { signal } = {}) {
  const validation = validatePublicTraceKey(rawKey);
  if (!validation.valid) {
    return {
      status: 'invalid_key',
      key: validation.normalized,
      error: validation.error,
      batch: null,
      availability: {
        timelineAvailable: false,
        auditAvailable: false,
        inspectionAvailable: false,
      },
    };
  }

  let data;
  let timelineAvailable = true;
  let auditAvailable = true;

  try {
    data = await graphqlRequest({
      query: PUBLIC_TRACE_FULL_QUERY,
      variables: { key: validation.normalized },
      isPublic: true,
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    if (isRestrictedRelationError(err)) {
      timelineAvailable = false;
      auditAvailable = false;
      data = await graphqlRequest({
        query: PUBLIC_TRACE_CORE_QUERY,
        variables: { key: validation.normalized },
        isPublic: true,
        signal,
      });
    } else {
      throw err;
    }
  }

  const found = Array.isArray(data?.batches) ? data.batches[0] || null : null;
  if (!found || !found.batch_code || !found.public_trace_key) {
    return {
      status: 'not_found',
      key: validation.normalized,
      error:
        'Không tìm thấy lô hàng phù hợp với khóa truy xuất này, hoặc lô hàng chưa đủ điều kiện công khai / khóa không còn hiệu lực.',
      batch: null,
      availability: {
        timelineAvailable,
        auditAvailable,
        inspectionAvailable: false,
      },
    };
  }

  return {
    status: 'found',
    key: validation.normalized,
    error: '',
    batch: found,
    availability: {
      timelineAvailable,
      auditAvailable,
      // Hasura role public_trace (setup_core.ps1) không cấp quyền đọc bảng inspections.
      inspectionAvailable: Array.isArray(found.inspections),
    },
  };
}
