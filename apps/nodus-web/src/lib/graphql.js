// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.

export const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:9080';

export async function graphqlRequest({ query, variables = {}, token, role, isPublic = false }) {
  const endpoint = isPublic
    ? `${GATEWAY_URL}/api/trace/`
    : `${GATEWAY_URL}/api/data/v1/graphql`;

  if (!isPublic && !token) {
    throw new Error('Phiên đăng nhập chưa có Bearer Token hợp lệ. Vui lòng đăng nhập lại.');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (!isPublic && token) {
    headers['Authorization'] = `Bearer ${token}`;
    if (role) {
      headers['x-hasura-role'] = role;
    }
  }

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(`Không thể kết nối tới API Gateway tại ${GATEWAY_URL}.`);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Phiên xác thực đã hết hạn hoặc không đủ quyền truy cập (HTTP ${res.status}). Vui lòng đăng nhập lại.`
      );
    }
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  }
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      json.errors
        .map((e) => e.extensions?.internal?.error?.message || e.message)
        .join(' | ')
    );
  }
  return json.data;
}

export async function computeSha256Hex(payload) {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const DEFAULT_TENANT_UUID = '11111111-1111-1111-1111-111111111111';
export const DEFAULT_ZONE_UUID = '22222222-2222-2222-2222-222222222222';
