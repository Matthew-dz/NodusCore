// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { computeSha256Hex, DEFAULT_TENANT_UUID, graphqlRequest } from '../lib/graphql';

const INSPECTOR_BATCHES_QUERY = `
  query InspectorBatches {
    batches(order_by: { created_at: desc }, limit: 30) {
      id
      batch_code
      product_name
      quantity
      unit
      status
      inspections(order_by: { inspected_at: desc }, limit: 1) {
        id
        inspection_code
        result
        notes
        inspected_at
      }
    }
  }
`;

const INSERT_INSPECTION_MUTATION = `
  mutation CreateInspection(
    $tenant_id: uuid!
    $batch_id: uuid!
    $inspection_code: String!
    $result: String!
    $notes: String!
    $batch_status: String!
    $payload: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_inspections_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        inspection_code: $inspection_code
        result: $result
        notes: $notes
        minio_report_path: "s3://nodus-inspections/demo-report.pdf"
      }
    ) {
      id
      inspection_code
      result
    }
    update_batches_by_pk(
      pk_columns: { id: $batch_id }
      _set: { status: $batch_status }
    ) {
      id
      status
    }
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "INSPECTION"
        event_type: "QUALITY_INSPECTED"
        location: "Trung tâm Kiểm định Chất lượng"
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        action: "INSPECTION_RECORDED"
        data_snapshot: $payload
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export default function InspectorWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [result, setResult] = useState('PASSED');
  const [agency, setAgency] = useState('Trung tâm Kiểm định Nông sản Đà Nẵng');
  const [metrics, setMetrics] = useState('Brix: 14.5%, Dư lượng BVTV: Không phát hiện');
  const [notes, setNotes] = useState('Đạt tiêu chuẩn VietGAP xuất kho.');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBatches = async () => {
    try {
      const data = await graphqlRequest({
        query: INSPECTOR_BATCHES_QUERY,
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches || []);
      if (!selectedBatch && data.batches?.length) {
        setSelectedBatch(data.batches[0]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [user.token]);

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const inspectionCode = `INSP-${Date.now().toString(36).toUpperCase()}`;
      const combinedNotes = `[Đơn vị: ${agency}] [Chỉ số: ${metrics}] ${notes}`;
      const payload = {
        batch_code: selectedBatch.batch_code,
        inspection_code: inspectionCode,
        result,
        agency,
        metrics,
        inspector: user.username,
      };
      const sha256 = await computeSha256Hex(payload);

      await graphqlRequest({
        query: INSERT_INSPECTION_MUTATION,
        variables: {
          tenant_id: DEFAULT_TENANT_UUID,
          batch_id: selectedBatch.id,
          inspection_code: inspectionCode,
          result,
          notes: combinedNotes,
          batch_status: result === 'PASSED' ? 'INSPECTING' : 'REJECTED',
          payload,
          sha256_hash: sha256,
        },
        token: user.token,
        role: user.role,
      });

      setMessage(`Đã lưu phiếu kiểm định ${inspectionCode} (${result}) cho lô ${selectedBatch.batch_code}.`);
      await loadBatches();
    } catch (err) {
      setError(`Lỗi ghi phiếu kiểm định: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
        <h2 className="text-lg font-bold text-slate-900">Danh sách Lô chờ Kiểm định</h2>
        <p className="mt-1 text-xs text-slate-500">Chọn một lô nông sản để lập phiếu kiểm định chất lượng.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Mã lô</th>
                <th className="py-2 pr-3">Nông sản</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 pr-3">Kiểm định gần nhất</th>
                <th className="py-2">Chọn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => {
                const latest = b.inspections?.[0];
                const isSelected = selectedBatch?.id === b.id;
                return (
                  <tr key={b.id} className={isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 pr-3 font-mono text-xs font-semibold">{b.batch_code}</td>
                    <td className="py-2.5 pr-3 font-medium">{b.product_name}</td>
                    <td className="py-2.5 pr-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {latest ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            latest.result === 'PASSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {latest.result}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa kiểm định</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedBatch(b)}
                        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                      >
                        Kiểm định
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-bold text-slate-900">Phiếu Kiểm Định</h3>
        </div>

        {selectedBatch ? (
          <form onSubmit={handleInspect} className="mt-4 space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              Đang kiểm định lô: <strong className="font-mono">{selectedBatch.batch_code}</strong> —{' '}
              <strong>{selectedBatch.product_name}</strong>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Kết quả kiểm định</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="PASSED">PASSED — Đạt chuẩn</option>
                <option value="FAILED">FAILED — Không đạt</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Đơn vị kiểm định</label>
              <input
                type="text"
                required
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Chỉ số kiểm nghiệm</label>
              <input
                type="text"
                required
                value={metrics}
                onChange={(e) => setMetrics(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Ghi chú</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            {message && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? 'Đang lưu phiếu...' : 'Lưu kết quả kiểm định'}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Chưa có lô hàng nào để kiểm định.</p>
        )}
      </div>
    </div>
  );
}
