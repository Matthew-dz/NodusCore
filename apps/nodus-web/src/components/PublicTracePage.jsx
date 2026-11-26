// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Hash,
  MapPin,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { graphqlRequest } from '../lib/graphql';
import {
  getAuditActionLabel,
  getBatchStatusLabel,
  getEventTypeLabel,
  getInspectionResultLabel,
  getStageLabel,
} from '../lib/statusLabels';

const TRACE_QUERY = `
  query PublicTraceBatch($key: String!) {
    batches(where: { public_trace_key: { _eq: $key } }, limit: 1) {
      id
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      expiry_date
      status
      created_at
      tenant {
        code
        name
      }
      production_zone {
        zone_code
        name
        crop_type
        certification
      }
      inspections(order_by: { inspected_at: desc }) {
        inspection_code
        result
        notes
        inspected_at
      }
      batch_events(order_by: { occurred_at: asc }) {
        id
        stage
        event_type
        location
        payload
        occurred_at
      }
      batch_audit_trails(order_by: { id: asc }) {
        id
        action
        sha256_hash
        sealed_at
      }
    }
  }
`;

export default function PublicTracePage({ traceKey, onNavigate }) {
  const [inputKey, setInputKey] = useState(traceKey || '');
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTrace = async (keyToFetch) => {
    if (!keyToFetch) return;
    setLoading(true);
    setError('');
    setBatch(null);
    try {
      const data = await graphqlRequest({
        query: TRACE_QUERY,
        variables: { key: keyToFetch.trim() },
        isPublic: true,
      });
      const found = data?.batches?.[0] || null;
      if (!found) {
        setError(`Không tìm thấy lô hàng với mã truy xuất "${keyToFetch}".`);
      } else {
        setBatch(found);
      }
    } catch (err) {
      setError(`Lỗi kết nối cổng tra cứu công khai: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (traceKey) {
      setInputKey(traceKey);
      fetchTrace(traceKey);
    }
  }, [traceKey]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    onNavigate(`/trace/${encodeURIComponent(inputKey.trim())}`);
  };

  const latestInspection = batch?.inspections?.[0];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="nodus-glass-card rounded-[20px] p-6">
        <h1 className="text-xl font-bold text-slate-100">
          Cổng Tra Cứu Nguồn Gốc Nông Sản (Public Allowlist)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Truy cập công khai không cần đăng nhập qua APISIX Allowlist (
          <code className="rounded bg-slate-900/80 px-1.5 py-0.5 text-xs text-emerald-300">
            /api/trace/*
          </code>
          ).
        </p>

        <form onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Nhập mã QR / public_trace_key (ví dụ: TR-XXXXXXXX)..."
            className="flex-1 rounded-[10px] border border-emerald-400/35 bg-slate-900/65 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <button
            type="submit"
            disabled={loading}
            className="nodus-btn-primary inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loading ? 'Đang tra cứu...' : 'Tra cứu'}
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 p-4 text-sm text-rose-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {batch && (
        <div className="space-y-6">
          <div className="nodus-glass-card rounded-[20px] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-400/15 pb-4">
              <div>
                <span className="inline-block rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  {getBatchStatusLabel(batch.status)}
                </span>
                <h2 className="mt-2 text-2xl font-bold text-white">{batch.product_name}</h2>
                <p className="text-sm text-slate-400">
                  Mã lô:{' '}
                  <code className="font-mono font-semibold text-slate-200">{batch.batch_code}</code>{' '}
                  • Khóa QR:{' '}
                  <code className="font-mono font-semibold text-emerald-300">
                    {batch.public_trace_key}
                  </code>
                </p>
              </div>
              <div className="nodus-glass-subcard rounded-xl px-4 py-2 text-right">
                <div className="text-xs text-slate-400">Sản lượng</div>
                <div className="text-lg font-bold text-white">
                  {batch.quantity} {batch.unit}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="nodus-glass-subcard rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  Xuất xứ & Vùng trồng
                </div>
                <div className="mt-1.5 text-sm font-semibold text-white">
                  {batch.production_zone?.name || 'Đang cập nhật'}
                </div>
                <div className="text-xs text-slate-300">
                  Đơn vị: {batch.tenant?.name} • Chứng nhận:{' '}
                  {batch.production_zone?.certification || 'VietGAP'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Thu hoạch: {batch.harvest_date || 'Chưa ghi nhận'} • HSD:{' '}
                  {batch.expiry_date || 'Chưa ghi nhận'}
                </div>
              </div>

              <div className="nodus-glass-subcard rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Chứng nhận Kiểm định Chất lượng
                </div>
                {latestInspection ? (
                  <div className="mt-1.5">
                    <div className="flex items-center gap-1.5">
                      {latestInspection.result === 'PASSED' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                      <span
                        className={`text-sm font-bold ${
                          latestInspection.result === 'PASSED'
                            ? 'text-emerald-300'
                            : 'text-rose-300'
                        }`}
                      >
                        {getInspectionResultLabel(latestInspection.result)}
                      </span>
                      <span className="text-xs text-slate-400">
                        ({latestInspection.inspection_code})
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{latestInspection.notes}</p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-amber-300">Chưa có phiếu kiểm định</p>
                )}
              </div>
            </div>
          </div>

          <div className="nodus-glass-card rounded-[20px] p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Clock className="h-4 w-4 text-emerald-400" />
              Dòng thời gian Chuỗi cung ứng (Supply Chain Timeline)
            </h3>
            {batch.batch_events?.length > 0 ? (
              <ol className="mt-4 space-y-4 border-l-2 border-emerald-400/40 pl-4">
                {batch.batch_events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                        {getStageLabel(ev.stage)} — {getEventTypeLabel(ev.event_type)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(ev.occurred_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    {ev.location && (
                      <div className="mt-1 text-xs text-slate-300">Địa điểm: {ev.location}</div>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Chưa có sự kiện vận chuyển nào được ghi nhận.
              </p>
            )}
          </div>

          <div className="nodus-glass-card rounded-[20px] p-6">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-100">
              <Hash className="h-4 w-4 text-indigo-400" />
              Sổ cái Niêm phong Dữ liệu (Append-Only SHA-256 Audit Trail)
            </h3>
            {batch.batch_audit_trails?.length > 0 ? (
              <div className="mt-3 space-y-2">
                {batch.batch_audit_trails.map((a) => (
                  <div
                    key={a.id}
                    className="nodus-glass-subcard flex flex-col justify-between gap-1 rounded-xl p-3 text-xs sm:flex-row sm:items-center"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">
                        #{a.id} {getAuditActionLabel(a.action)}
                      </span>
                      <span className="ml-2 text-slate-400">
                        {new Date(a.sealed_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <code className="break-all font-mono text-[11px] text-indigo-300">
                      {a.sha256_hash}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Chưa có bản ghi niêm phong hash.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
