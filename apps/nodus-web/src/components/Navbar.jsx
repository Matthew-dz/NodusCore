// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { LogIn, LogOut, QrCode, ShieldCheck, Sprout } from 'lucide-react';
import { ROLE_LABELS } from '../lib/keycloak';

const ROLE_COLORS = {
  farmer: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  coop_admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  inspector: 'bg-amber-100 text-amber-800 border-amber-200',
  warehouse_keeper: 'bg-sky-100 text-sky-800 border-sky-200',
  distributor: 'bg-purple-100 text-purple-800 border-purple-200',
};

export default function Navbar({ user, onLogin, onLogout, onNavigate }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex items-center gap-2 text-left"
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

          <nav className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Bàn làm việc
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/trace')}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <QrCode className="h-4 w-4" />
              Tra cứu công khai
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden flex-col items-end sm:flex">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {user.username}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ROLE_LABELS[user.role] || user.role} ({user.role})
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  tenant_id: <code className="font-mono">{user.tenantId}</code>
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập Keycloak SSO
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
