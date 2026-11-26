// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { LogIn, QrCode, ShieldCheck } from 'lucide-react';
import { extractUserContext, initKeycloak, keycloak } from './lib/keycloak';
import Navbar from './components/Navbar';
import FarmerWorkspace from './components/FarmerWorkspace';
import InspectorWorkspace from './components/InspectorWorkspace';
import WarehouseWorkspace from './components/WarehouseWorkspace';
import DistributorWorkspace from './components/DistributorWorkspace';
import PublicTracePage from './components/PublicTracePage';

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [adminTab, setAdminTab] = useState('farmer');

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

  useEffect(() => {
    let active = true;
    initKeycloak().then((authenticated) => {
      if (!active) return;
      if (authenticated) {
        setUser(extractUserContext(keycloak));
      }
      setAuthReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const isTraceRoute = pathname === '/trace' || pathname.startsWith('/trace/');
  const traceKey = pathname.startsWith('/trace/')
    ? decodeURIComponent(pathname.replace('/trace/', ''))
    : '';

  const activeWorkspaceRole = user?.role === 'coop_admin' ? adminTab : user?.role;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        user={user}
        onLogin={() => keycloak.login()}
        onLogout={() => keycloak.logout({ redirectUri: window.location.origin })}
        onNavigate={navigate}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {isTraceRoute ? (
          <PublicTracePage traceKey={traceKey} onNavigate={navigate} />
        ) : !authReady ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            Đang kết nối Keycloak SSO...
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              NodusCore DX-OS — Cổng Tác Nghiệp Chuỗi Cung Ứng
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Đăng nhập bằng tài khoản Keycloak SSO (<code className="font-mono">nodus-core</code>) để vào bàn làm việc theo vai trò, hoặc mở cổng tra cứu QR công khai.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => keycloak.login()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <LogIn className="h-4 w-4" />
                Đăng nhập Keycloak SSO
              </button>
              <button
                type="button"
                onClick={() => navigate('/trace')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <QrCode className="h-4 w-4" />
                Tra cứu công khai (/trace)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {user.role === 'coop_admin' && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
                <span className="px-2 text-xs font-bold uppercase text-indigo-800">
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      adminTab === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-indigo-800 hover:bg-indigo-100'
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
