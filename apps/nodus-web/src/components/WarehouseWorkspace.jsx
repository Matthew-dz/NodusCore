// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { AlertOctagon, CheckCircle2, PackageCheck, X } from 'lucide-react';
import { computeSha256Hex, DEFAULT_TENANT_UUID, graphqlRequest } from '../lib/graphql';

const WAREHOUSE_BATCHES_QUERY = `
  query WarehouseBatches {
    batches(order_by: { created_at: desc }, limit: 30) {
      id
      batch_code
      product_name
      quantity
      unit
      status
      inspections(order_by: { inspected_at: desc }, limit: 1) {
        result
        inspection_code
      }
    }
  }
`;

const MOVE_TO_STORAGE_MUTATION = `
  mutation MoveBatchToStorage($id: uuid!) {
    update_batches_by_pk(pk_columns: { id: $id }, _set: { status: "IN_STORAGE" }) {
      id
      batch_code
      status
    }
  }
`;

const LOG_STORAGE_EVENT = `
  mutation LogStorageEvent(
    $tenant_id: uuid!
    $batch_id: uuid!
    $payload: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "STORAGE"
        event_type: "STORED_IN_WAREHOUSE"
        location: "Kho lạnh Trung tâm HTX Đà Nẵng"
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        action: "WAREHOUSE_INTAKE"
        data_snapshot: $payload
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export default function WarehouseWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [pokaYokeError, setPokaYokeError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  const loadBatches = async () => {
    try {
      const data = await graphqlRequest({
        query: WAREHOUSE_BATCHES_QUERY,
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches || []);
    } catch (err) {
      setPokaYokeError({ title: 'Lỗi tải dữ liệu', detail: err.message });
    }
  };

  useEffect(() => {
    loadBatches();
  }, [user.token]);

  const handleIntake = async (batch) => {
    setLoadingId(batch.id);
    setPokaYokeError(null);
    setSuccessMsg('');
    try {
      await graphqlRequest({
        query: MOVE_TO_STORAGE_MUTATION,
        variables: { id: batch.id },
        token: user.token,
        role: user.role,
      });

      const payload = {
        batch_code: batch.batch_code,
        warehouse_keeper: user.username,
        status: 'IN_STORAGE',
      };
      const sha256 = await computeSha256Hex(payload);

      await graphqlRequest({
        query: LOG_STORAGE_EVENT,
        variables: {
          tenant_id: DEFAULT_TENANT_UUID,
          batch_id: batch.id,
          payload,
          sha256_hash: sha256,
        },
        token: user.token,
        role: user.role,
      });

      setSuccessMsg(`Đã nhập kho thành công lô ${batch.batch_code} (${batch.product_name}).`);
      await loadBatches();
    } catch (err) {
      const raw = err.message || '';
      const isPokaYoke =
        raw.includes('Poka-yoke') || raw.includes('IN_STORAGE') || raw.includes('PASSED');
      setPokaYokeError({
        title: isPokaYoke
          ? 'Poka-yoke chặn: Lô hàng chưa có phiếu kiểm định ĐẠT chuẩn, không thể nhập kho!'
          : `Không thể nhập kho: ${raw}`,
        detail: raw,
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {pokaYokeError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-xl border-2 border-rose-500 bg-rose-50 p-5 text-rose-900 shadow-md"
        >
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
            <div>
              <h3 className="text-base font-bold text-rose-800">{pokaYokeError.title}</h3>
              <p className="mt-1 font-mono text-xs text-rose-700">
                PostgreSQL Trigger Response: {pokaYokeError.detail}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPokaYokeError(null)}
            className="rounded-lg p-1 text-rose-600 hover:bg-rose-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-900">Bàn làm việc Thủ kho — Kiểm soát Nhập kho (Poka-yoke)</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          CSDL PostgreSQL sẽ tự động chặn chuyển trạng thái sang <code className="font-mono">IN_STORAGE</code> nếu lô chưa có phiếu kiểm định <code className="font-mono">PASSED</code>.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Mã lô</th>
                <th className="py-2 pr-3">Nông sản</th>
                <th className="py-2 pr-3">Sản lượng</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 pr-3">Kết quả Kiểm định</th>
                <th className="py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => {
                const insp = b.inspections?.[0];
                const alreadyStored = b.status === 'IN_STORAGE' || b.status === 'DISTRIBUTING' || b.status === 'SOLD';
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-3 font-mono text-xs font-semibold">{b.batch_code}</td>
                    <td className="py-3 pr-3 font-medium">{b.product_name}</td>
                    <td className="py-3 pr-3 text-slate-600">
                      {b.quantity} {b.unit}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      {insp ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            insp.result === 'PASSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {insp.result}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                          CHƯA KIỂM ĐỊNH
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {alreadyStored ? (
                        <span className="text-xs font-semibold text-emerald-700">Đã nhập kho</span>
                      ) : (
                        <button
                          type="button"
                          disabled={loadingId === b.id}
                          onClick={() => handleIntake(b)}
                          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                        >
                          {loadingId === b.id ? 'Đang xử lý...' : 'Nhập kho'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
