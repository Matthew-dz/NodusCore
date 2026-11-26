// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogIn,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import FarmerWorkspace from './components/FarmerWorkspace';
import InspectorWorkspace from './components/InspectorWorkspace';
import WarehouseWorkspace from './components/WarehouseWorkspace';
import DistributorWorkspace from './components/DistributorWorkspace';
import PublicTracePage from './components/PublicTracePage';

function AppShell() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [adminTab, setAdminTab] = useState('farmer');
  const { status, user, error, sessionNotice, config, login, logout, retryAuth, dismissNotice } =
    useAuth();

  const navigate = (to) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
      setPathname(to);
    }
  };

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const isTraceRoute = pathname === '/trace' || pathname.startsWith('/trace/');
  const traceKey = pathname.startsWith('/trace/')
    ? decodeURIComponent(pathname.replace('/trace/', ''))
    : '';

  const activeWorkspaceRole = user?.role === 'coop_admin' ? adminTab : user?.role;

  return (
    <div className="min-h-screen text-slate-100">
      <Navbar
        user={user}
        authStatus={status}
        pathname={pathname}
        onLogin={login}
        onLogout={logout}
        onRetry={retryAuth}
        onNavigate={navigate}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {isTraceRoute ? (
          <PublicTracePage traceKey={traceKey} onNavigate={navigate} />
        ) : status === 'loading' ? (
          <div className="nodus-glass-card mx-auto max-w-xl rounded-[20px] p-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-400" />
            <h1 className="mt-4 text-base font-semibold text-slate-100">
              Đang kết nối Keycloak SSO...
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Kiểm tra phiên đăng nhập tại realm{' '}
              <code className="font-mono text-emerald-300">{config.realm}</code>.
            </p>
          </div>
        ) : status === 'error' ? (
          <div
            role="alert"
            className="nodus-glass-card mx-auto max-w-2xl rounded-[20px] border-rose-400/40 p-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-slate-100">
                  Không thể kết nối hoặc xác thực Keycloak SSO
                </h1>
                <p className="mt-1 text-sm text-rose-300">{error?.message}</p>

                <div className="nodus-glass-subcard mt-4 rounded-xl p-4 text-xs text-slate-300">
                  <div className="font-semibold text-slate-200">Thông số cấu hình hiện tại:</div>
                  <ul className="mt-1.5 space-y-1 font-mono text-emerald-300">
                    <li>URL: {config.url}</li>
                    <li>Realm: {config.realm}</li>
                    <li>Client ID: {config.clientId}</li>
                  </ul>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={retryAuth}
                    className="nodus-btn-primary inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-sm font-semibold text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Thử kết nối lại
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/trace')}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-emerald-400/25 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    <QrCode className="h-4 w-4" />
                    Mở tra cứu công khai (/trace)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-2xl space-y-4">
            {sessionNotice && (
              <div
                role="status"
                className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/35 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-200 backdrop-blur"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{sessionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={dismissNotice}
                  aria-label="Đóng thông báo"
                  className="rounded p-1 text-emerald-300 hover:bg-emerald-900/60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="nodus-glass-card rounded-[20px] p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-2xl font-bold text-transparent">
                NodusCore DX-OS — Cổng Tác Nghiệp Chuỗi Cung Ứng
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Đăng nhập bằng tài khoản Keycloak SSO (
                <code className="font-mono text-emerald-300">{config.realm}</code>) để vào bàn làm
                việc theo vai trò, hoặc mở cổng tra cứu QR công khai.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={login}
                  className="nodus-btn-primary inline-flex items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                >
                  <LogIn className="h-4 w-4" />
                  Đăng nhập Keycloak SSO
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/trace')}
                  className="inline-flex items-center gap-2 rounded-[10px] border border-emerald-400/25 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                >
                  <QrCode className="h-4 w-4" />
                  Tra cứu công khai (/trace)
                </button>
              </div>

              <div className="mt-6 border-t border-emerald-400/15 pt-4 text-xs text-slate-400">
                Keycloak Endpoint: <code className="font-mono text-slate-300">{config.url}</code> •
                Realm: <code className="font-mono text-slate-300">{config.realm}</code> • Client:{' '}
                <code className="font-mono text-slate-300">{config.clientId}</code>
              </div>
            </div>
          </div>
        ) : !user.role ? (
          <div className="nodus-glass-card mx-auto max-w-xl rounded-[20px] border-amber-400/40 p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/15 text-amber-300">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-100">Chưa xác định vai trò</h1>
                <p className="mt-1 text-sm text-slate-300">
                  Tài khoản <strong className="text-white">{user.username}</strong> đã đăng nhập
                  thành công nhưng chưa được gán vai trò hợp lệ trong realm{' '}
                  <code className="font-mono text-emerald-300">{config.realm}</code>.
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Vui lòng liên hệ quản trị viên Keycloak để gán một trong các vai trò:{' '}
                  <code className="font-mono text-slate-300">
                    farmer, coop_admin, inspector, warehouse_keeper, distributor
                  </code>
                  .
                </p>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {user.role === 'coop_admin' && (
              <div className="nodus-glass-card flex flex-wrap items-center gap-2 rounded-2xl border-indigo-400/35 p-3">
                <span className="px-2 text-xs font-bold uppercase text-indigo-300">
                  Chế độ Quản trị HTX:
                </span>
                {[
                  ['farmer', 'Nông hộ'],
                  ['inspector', 'Kiểm định'],
                  ['warehouse_keeper', 'Thủ kho (Poka-yoke)'],
                  ['distributor', 'Nhà phân phối'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAdminTab(key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      adminTab === key
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-950/60'
                        : 'border border-indigo-400/20 bg-slate-900/60 text-indigo-200 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {activeWorkspaceRole === 'farmer' && (
              <FarmerWorkspace user={user} onNavigate={navigate} />
            )}
            {activeWorkspaceRole === 'inspector' && <InspectorWorkspace user={user} />}
            {activeWorkspaceRole === 'warehouse_keeper' && <WarehouseWorkspace user={user} />}
            {activeWorkspaceRole === 'distributor' && (
              <DistributorWorkspace user={user} onNavigate={navigate} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
