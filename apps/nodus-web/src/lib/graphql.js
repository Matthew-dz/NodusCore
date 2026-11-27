// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.

export const GATEWAY_URL = import.meta.env.VITE_API_GATEWAY || 'http://localhost:9080';

export class ApiRequestError extends Error {
  constructor(message, { status = null, code = 'API_ERROR' } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export async function graphqlRequest({
  query,
  variables = {},
  token,
  role,
  isPublic = false,
  signal,
}) {
  const endpoint = isPublic
    ? `${GATEWAY_URL}/api/trace/`
    : `${GATEWAY_URL}/api/data/v1/graphql`;

  if (!isPublic && !token) {
    throw new ApiRequestError(
      'Phiên đăng nhập chưa có Bearer Token hợp lệ. Vui lòng đăng nhập lại.',
      { status: 401, code: 'NO_TOKEN' }
    );
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
      cache: isPublic ? 'no-store' : 'default',
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw err;
    }
    throw new ApiRequestError(
      isPublic
        ? 'Không thể kết nối tới cổng truy xuất công khai. Vui lòng kiểm tra mạng và thử lại.'
        : `Không thể kết nối tới API Gateway tại ${GATEWAY_URL}.`,
      { code: 'NETWORK_ERROR' }
    );
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) {
      throw new ApiRequestError(
        'Hệ thống đang giới hạn tần suất truy vấn công khai. Vui lòng thử lại sau ít phút.',
        { status: 429, code: 'RATE_LIMITED' }
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new ApiRequestError(
        isPublic
          ? 'Cổng truy xuất công khai hiện không cho phép truy vấn này.'
          : `Phiên xác thực đã hết hạn hoặc không đủ quyền truy cập (HTTP ${res.status}). Vui lòng đăng nhập lại.`,
        { status: res.status, code: 'AUTH_ERROR' }
      );
    }
    throw new ApiRequestError(
      isPublic
        ? `Cổng truy xuất công khai tạm thời gián đoạn (HTTP ${res.status}).`
        : json?.error || json?.message || `HTTP ${res.status}`,
      { status: res.status, code: 'HTTP_ERROR' }
    );
  }
  if (json.errors && json.errors.length > 0) {
    const rawMessage = json.errors
      .map((e) => e.extensions?.internal?.error?.message || e.message)
      .join(' | ');
    throw new ApiRequestError(rawMessage, { status: res.status, code: 'GRAPHQL_ERROR' });
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
