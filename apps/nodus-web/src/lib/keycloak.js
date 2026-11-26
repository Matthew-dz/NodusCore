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

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8081',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'nodus-core',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'nodus-frontend',
});

let initPromise = null;

export function initKeycloak() {
  if (!initPromise) {
    initPromise = keycloak
      .init({
        onLoad: 'check-sso',
        checkLoginIframe: false,
      })
      .catch((err) => {
        console.warn('Keycloak init warning:', err);
        return false;
      });
  }
  return initPromise;
}

export function extractUserContext(kc) {
  if (!kc?.authenticated || !kc?.tokenParsed) return null;
  const roles = kc.tokenParsed?.realm_access?.roles || [];
  const appRole = APP_ROLES.find((r) => roles.includes(r)) || 'farmer';
  return {
    username: kc.tokenParsed.preferred_username || 'user',
    sub: kc.tokenParsed.sub,
    tenantId: kc.tokenParsed.tenant_id || 'htx-danang',
    role: appRole,
    token: kc.token,
  };
}
