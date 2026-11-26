// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  ShieldCheck,
  Sprout,
  X,
} from 'lucide-react';
import { ROLE_LABELS } from '../lib/keycloak';

const ROLE_COLORS = {
  farmer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  coop_admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  inspector: 'bg-amber-100 text-amber-800 border-amber-200',
  warehouse_keeper: 'bg-sky-100 text-sky-800 border-sky-200',
  distributor: 'bg-purple-100 text-purple-800 border-purple-200',
};

function RoleBadge({ role }) {
  if (!role) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Chưa xác định vai trò
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        ROLE_COLORS[role] || 'border-slate-200 bg-slate-100 text-slate-700'
      }`}
    >
      {ROLE_LABELS[role] ? `${ROLE_LABELS[role]} (${role})` : role}
    </span>
  );
}

export default function Navbar({
  user,
  authStatus = 'unauthenticated',
  pathname = '/',
  onLogin,
  onLogout,
  onRetry,
  onNavigate,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isTraceActive = pathname === '/trace' || pathname.startsWith('/trace/');
  const isWorkspaceActive = !isTraceActive;

  const handleNavClick = (to) => {
    setMobileMenuOpen(false);
    onNavigate(to);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">
                NodusCore DX-OS
              </div>
              <div className="text-[11px] text-slate-500">
                Open-Core Agricultural Traceability
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-2 sm:flex" aria-label="Điều hướng chính">
            <button
              type="button"
              onClick={() => handleNavClick('/')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isWorkspaceActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Bàn làm việc
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('/trace')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                isTraceActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <QrCode className="h-4 w-4" />
              Tra cứu công khai
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {authStatus === 'loading' ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
              <span className="hidden sm:inline">Đang kiểm tra SSO...</span>
            </span>
          ) : user ? (
            <>
              <div className="hidden flex-col items-end sm:flex">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{user.username}</span>
                  <RoleBadge role={user.role} />
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  tenant_id: <code className="font-mono">{user.tenantId || 'N/A'}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/30 sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </>
          ) : authStatus === 'error' ? (
            <button
              type="button"
              onClick={onRetry || onLogin}
              className="hidden items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 sm:inline-flex"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Thử kết nối SSO
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="hidden items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập Keycloak SSO
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 sm:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1" aria-label="Điều hướng di động">
            <button
              type="button"
              onClick={() => handleNavClick('/')}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                isWorkspaceActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Bàn làm việc
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('/trace')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                isTraceActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <QrCode className="h-4 w-4" />
              Tra cứu công khai
            </button>
          </nav>

          <div className="mt-3 border-t border-slate-100 pt-3">
            {user ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{user.username}</div>
                    <div className="text-xs text-slate-500">
                      tenant_id: <code className="font-mono">{user.tenantId || 'N/A'}</code>
                    </div>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            ) : authStatus === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  (onRetry || onLogin)();
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                <AlertTriangle className="h-4 w-4" />
                Thử kết nối SSO
              </button>
            ) : authStatus !== 'loading' ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin();
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập Keycloak SSO
              </button>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
