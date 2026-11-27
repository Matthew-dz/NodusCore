// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  checkKeycloakServerReachable,
  extractUserContext,
  initKeycloak,
  keycloak,
  KEYCLOAK_CONFIG,
  resetKeycloakInstance,
} from '../lib/keycloak';

const AuthContext = createContext(null);

function formatAuthError(err) {
  if (!err) return 'Đã xảy ra lỗi không xác định khi xác thực Keycloak SSO.';
  if (typeof err === 'string') return err;
  if (err.error_description) return err.error_description;
  if (err.error) return `Lỗi Keycloak: ${err.error}`;
  if (err.message) return err.message;
  return 'Không thể hoàn tất xác thực Keycloak SSO.';
}

export function AuthProvider({ children, deferAutoInit = false }) {
  const [status, setStatus] = useState(() => (deferAutoInit ? 'unauthenticated' : 'loading'));
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [sessionNotice, setSessionNotice] = useState('');

  const bindKeycloakEvents = useCallback((kc) => {
    kc.onAuthSuccess = () => {
      setUser(extractUserContext(kc));
      setStatus('authenticated');
      setError(null);
      setSessionNotice('');
    };

    kc.onAuthRefreshSuccess = () => {
      setUser(extractUserContext(kc));
    };

    kc.onAuthError = (errData) => {
      setUser(null);
      setStatus('error');
      setError({
        code: 'KEYCLOAK_AUTH_ERROR',
        message: formatAuthError(errData),
      });
    };

    kc.onAuthRefreshError = () => {
      setUser(null);
      setStatus('error');
      setError({
        code: 'TOKEN_REFRESH_FAILED',
        message: 'Phiên đăng nhập đã hết hạn hoặc không thể làm mới token. Vui lòng đăng nhập lại.',
      });
    };

    kc.onTokenExpired = () => {
      kc.updateToken(30)
        .then((refreshed) => {
          if (refreshed) {
            setUser(extractUserContext(kc));
          }
        })
        .catch(() => {
          setUser(null);
          setStatus('error');
          setError({
            code: 'SESSION_EXPIRED',
            message: 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại qua Keycloak SSO.',
          });
        });
    };

    kc.onAuthLogout = () => {
      setUser(null);
      setStatus('unauthenticated');
      setError(null);
      setSessionNotice('Bạn đã đăng xuất khỏi phiên Keycloak SSO.');
    };
  }, []);

  const bootstrapAuth = useCallback(
    async ({ isRetry = false } = {}) => {
      setStatus('loading');
      setError(null);

      const activeKc = isRetry ? resetKeycloakInstance() : keycloak;
      bindKeycloakEvents(activeKc);

      try {
        const authenticated = await initKeycloak();
        if (authenticated) {
          setUser(extractUserContext(activeKc));
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      } catch (err) {
        setUser(null);
        setStatus('error');
        setError({
          code: 'KEYCLOAK_INIT_ERROR',
          message: formatAuthError(err),
        });
      }
    },
    [bindKeycloakEvents]
  );

  useEffect(() => {
    if (deferAutoInit || keycloak.didInitialize) {
      return undefined;
    }

    let active = true;
    setStatus('loading');
    setError(null);
    bindKeycloakEvents(keycloak);

    initKeycloak()
      .then((authenticated) => {
        if (!active) return;
        if (authenticated) {
          setUser(extractUserContext(keycloak));
          setStatus('authenticated');
        } else {
          setUser(null);
          setStatus('unauthenticated');
        }
      })
      .catch((err) => {
        if (!active) return;
        setUser(null);
        setStatus('error');
        setError({
          code: 'KEYCLOAK_INIT_ERROR',
          message: formatAuthError(err),
        });
      });

    return () => {
      active = false;
    };
  }, [bindKeycloakEvents, deferAutoInit]);

  const login = useCallback(async () => {
    setError(null);
    setSessionNotice('');
    try {
      await checkKeycloakServerReachable();
      if (!keycloak.didInitialize) {
        await bootstrapAuth({ isRetry: true });
      }
      await keycloak.login({
        redirectUri: window.location.origin,
      });
    } catch (err) {
      setStatus('error');
      setError({
        code: 'KEYCLOAK_LOGIN_ERROR',
        message: formatAuthError(err),
      });
    }
  }, [bootstrapAuth]);

  const logout = useCallback(async () => {
    setError(null);
    try {
      if (!keycloak.didInitialize) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }
      await keycloak.logout({
        redirectUri: window.location.origin,
      });
    } catch (err) {
      setStatus('error');
      setError({
        code: 'KEYCLOAK_LOGOUT_ERROR',
        message: `Không thể hoàn tất đăng xuất Keycloak: ${formatAuthError(err)}`,
      });
    }
  }, []);

  const retryAuth = useCallback(() => {
    return bootstrapAuth({ isRetry: true });
  }, [bootstrapAuth]);

  const dismissNotice = useCallback(() => {
    setSessionNotice('');
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        error,
        sessionNotice,
        config: KEYCLOAK_CONFIG,
        login,
        logout,
        retryAuth,
        dismissNotice,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
