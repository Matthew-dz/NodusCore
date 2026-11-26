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
  farmer: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  coop_admin: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
  inspector: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  warehouse_keeper: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  distributor: 'border-purple-400/40 bg-purple-500/15 text-purple-300',
};

function RoleBadge({ role }) {
  if (!role) {
    return (
      <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        Chưa xác định vai trò
      </span>
    );
  }

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        ROLE_COLORS[role] || 'border-slate-500/40 bg-slate-800/70 text-slate-200'
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
    <header className="sticky top-0 z-30 border-b border-emerald-400/20 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => handleNavClick('/')}
            className="flex items-center gap-2.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-950/60">
              <Sprout className="h-5 w-5" />
            </span>
            <div>
              <div className="bg-gradient-to-r from-emerald-300 to-emerald-400 bg-clip-text text-sm font-bold tracking-tight text-transparent">
                NodusCore DX-OS
              </div>
              <div className="text-[11px] text-slate-400">
                Open-Core Agricultural Traceability
              </div>
            </div>
          </button>

          <nav className="hidden items-center gap-2 sm:flex" aria-label="Điều hướng chính">
            <button
              type="button"
              onClick={() => handleNavClick('/')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isWorkspaceActive
                  ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              Bàn làm việc
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('/trace')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                isTraceActive
                  ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <QrCode className="h-4 w-4" />
              Tra cứu công khai
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {authStatus === 'loading' ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              <span className="hidden sm:inline">Đang kiểm tra SSO...</span>
            </span>
          ) : user ? (
            <>
              <div className="hidden flex-col items-end sm:flex">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-100">{user.username}</span>
                  <RoleBadge role={user.role} />
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <ShieldCheck className="h-3 w-3 text-emerald-400" />
                  tenant_id:{' '}
                  <code className="font-mono text-emerald-300">{user.tenantId || 'N/A'}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="hidden items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </>
          ) : authStatus === 'error' ? (
            <button
              type="button"
              onClick={onRetry || onLogin}
              className="hidden items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-900/70 sm:inline-flex"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              Thử kết nối SSO
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="nodus-btn-primary hidden items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 sm:inline-flex"
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
            className="inline-flex items-center justify-center rounded-lg border border-emerald-400/25 bg-slate-900/70 p-2 text-slate-200 hover:bg-slate-800 sm:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-emerald-400/20 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:hidden">
          <nav className="flex flex-col gap-1" aria-label="Điều hướng di động">
            <button
              type="button"
              onClick={() => handleNavClick('/')}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                isWorkspaceActive
                  ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              Bàn làm việc
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('/trace')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                isTraceActive
                  ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <QrCode className="h-4 w-4" />
              Tra cứu công khai
            </button>
          </nav>

          <div className="mt-3 border-t border-emerald-400/15 pt-3">
            {user ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{user.username}</div>
                    <div className="text-xs text-slate-400">
                      tenant_id:{' '}
                      <code className="font-mono text-emerald-300">{user.tenantId || 'N/A'}</code>
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
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
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
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-900/70"
              >
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                Thử kết nối SSO
              </button>
            ) : authStatus !== 'loading' ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogin();
                }}
                className="nodus-btn-primary inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold text-white"
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
