// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { Download, ExternalLink, Truck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { computeSha256Hex, DEFAULT_TENANT_UUID, graphqlRequest } from '../lib/graphql';
import { getBatchStatusLabel } from '../lib/statusLabels';

const DISTRIBUTOR_BATCHES_QUERY = `
  query DistributorBatches {
    batches(
      where: { status: { _in: ["IN_STORAGE", "DISTRIBUTING", "SOLD"] } }
      order_by: { created_at: desc }
      limit: 30
    ) {
      id
      tenant_id
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      status
    }
  }
`;

const MARK_DISTRIBUTING_MUTATION = `
  mutation MarkDistributing(
    $id: uuid!
    $tenant_id: uuid!
    $payload: jsonb!
    $sha256_hash: bpchar!
  ) {
    update_batches_by_pk(pk_columns: { id: $id }, _set: { status: "DISTRIBUTING" }) {
      id
      status
    }
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $id
        stage: "DISTRIBUTION"
        event_type: "DISPATCHED_TO_MARKET"
        location: "Kênh phân phối Siêu thị / Bán lẻ"
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $id
        action: "DISTRIBUTION_DISPATCHED"
        data_snapshot: $payload
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export default function DistributorWorkspace({ user, onNavigate }) {
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');

  const loadBatches = async () => {
    try {
      const data = await graphqlRequest({
        query: DISTRIBUTOR_BATCHES_QUERY,
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [user.token]);

  const downloadQrSvg = (traceKey) => {
    const svgEl = document.getElementById(`qr-svg-${traceKey}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nodus-qr-${traceKey}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDispatch = async (batch) => {
    try {
      const payload = {
        batch_code: batch.batch_code,
        distributor: user.username,
        status: 'DISTRIBUTING',
      };
      const sha256 = await computeSha256Hex(payload);
      await graphqlRequest({
        query: MARK_DISTRIBUTING_MUTATION,
        variables: {
          id: batch.id,
          tenant_id: batch.tenant_id || DEFAULT_TENANT_UUID,
          payload,
          sha256_hash: sha256,
        },
        token: user.token,
        role: user.role,
      });
      await loadBatches();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="nodus-glass-card rounded-[20px] p-6">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-purple-400" />
          <h2 className="text-lg font-bold text-slate-100">
            Bàn làm việc Nhà phân phối — In nhãn QR & Xuất bán
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Chỉ hiển thị các lô nông sản đã kiểm định đạt chuẩn và đã nhập kho (Đã nhập kho / Đang
          phân phối).
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-950/50 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.map((b) => {
            const traceUrl = `${window.location.origin}/trace/${b.public_trace_key}`;
            return (
              <div
                key={b.id}
                className="nodus-glass-subcard flex flex-col justify-between rounded-2xl p-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {b.batch_code}
                    </span>
                    <span className="rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[11px] font-semibold text-purple-300">
                      {getBatchStatusLabel(b.status)}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-white">{b.product_name}</h3>
                  <p className="text-xs text-slate-400">
                    Sản lượng: {b.quantity} {b.unit}
                  </p>

                  <div className="my-4 flex justify-center rounded-xl border border-emerald-300/30 bg-white p-3">
                    <QRCodeSVG
                      id={`qr-svg-${b.public_trace_key}`}
                      value={traceUrl}
                      size={128}
                      level="M"
                      includeMargin
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => downloadQrSvg(b.public_trace_key)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Tải nhãn QR
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate(`/trace/${b.public_trace_key}`)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Xem
                    </button>
                  </div>

                  {b.status === 'IN_STORAGE' && (
                    <button
                      type="button"
                      onClick={() => handleDispatch(b)}
                      className="w-full rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-purple-500"
                    >
                      Xuất kho phân phối
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {batches.length === 0 && (
            <div className="col-span-full py-8 text-center text-sm text-slate-400">
              Chưa có lô hàng nào đã nhập kho để phân phối.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
