// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import Keycloak from 'keycloak-js';

export const APP_ROLES = [
  'farmer',
  'coop_admin',
  'inspector',
  'warehouse_keeper',
  'distributor',
];

export const ROLE_LABELS = {
  farmer: 'Nông hộ',
  coop_admin: 'Quản trị HTX',
  inspector: 'Kiểm định viên',
  warehouse_keeper: 'Thủ kho',
  distributor: 'Nhà phân phối',
};

export const KEYCLOAK_CONFIG = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'nodus-core',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'nodus-frontend',
};

export let keycloak = createKeycloakInstance();

let initPromise = null;

function createKeycloakInstance() {
  return new Keycloak({
    url: KEYCLOAK_CONFIG.url,
    realm: KEYCLOAK_CONFIG.realm,
    clientId: KEYCLOAK_CONFIG.clientId,
  });
}

export function resetKeycloakInstance() {
  initPromise = null;
  keycloak = createKeycloakInstance();
  return keycloak;
}

export async function checkKeycloakServerReachable(timeoutMs = 3000) {
  const discoveryUrl = `${KEYCLOAK_CONFIG.url.replace(/\/$/, '')}/realms/${encodeURIComponent(
    KEYCLOAK_CONFIG.realm
  )}/.well-known/openid-configuration`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(discoveryUrl, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `Máy chủ Keycloak phản hồi HTTP ${response.status} cho realm "${KEYCLOAK_CONFIG.realm}".`
      );
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(
        `Quá thời gian kết nối tới Keycloak tại ${KEYCLOAK_CONFIG.url} (timeout ${timeoutMs / 1000}s).`
      );
    }
    throw new Error(
      `Không thể kết nối tới Keycloak tại ${KEYCLOAK_CONFIG.url} (Realm: ${KEYCLOAK_CONFIG.realm}). Hãy đảm bảo container Keycloak đang chạy.`
    );
  } finally {
    clearTimeout(timer);
  }
}

export function initKeycloak() {
  if (!initPromise) {
    initPromise = (async () => {
      await checkKeycloakServerReachable();
      return keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
      });
    })();
  }
  return initPromise;
}

export function extractUserContext(kc) {
  if (!kc?.authenticated || !kc?.tokenParsed) return null;
  const realmRoles = Array.isArray(kc.tokenParsed?.realm_access?.roles)
    ? kc.tokenParsed.realm_access.roles
    : [];
  const matchedRole = APP_ROLES.find((r) => realmRoles.includes(r)) || null;
  const fullName =
    kc.tokenParsed.name ||
    [kc.tokenParsed.given_name, kc.tokenParsed.family_name].filter(Boolean).join(' ') ||
    '';

  return {
    username: kc.tokenParsed.preferred_username || 'unknown_user',
    fullName,
    email: kc.tokenParsed.email || '',
    sub: kc.tokenParsed.sub || '',
    tenantId: kc.tokenParsed.tenant_id || null,
    role: matchedRole,
    realmRoles,
    token: kc.token,
  };
}
