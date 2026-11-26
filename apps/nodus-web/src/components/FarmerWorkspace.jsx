// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { ExternalLink, PlusCircle, Sprout } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  computeSha256Hex,
  DEFAULT_TENANT_UUID,
  DEFAULT_ZONE_UUID,
  graphqlRequest,
} from '../lib/graphql';

const LIST_BATCHES_QUERY = `
  query FarmerBatches {
    batches(order_by: { created_at: desc }, limit: 20) {
      id
      batch_code
      public_trace_key
      product_name
      quantity
      unit
      harvest_date
      status
      created_at
    }
    production_zones {
      id
      zone_code
      name
    }
  }
`;

const INSERT_BATCH_MUTATION = `
  mutation CreateBatch(
    $tenant_id: uuid!
    $zone_id: uuid!
    $batch_code: String!
    $public_trace_key: String!
    $product_name: String!
    $quantity: numeric!
    $unit: String!
    $harvest_date: date
  ) {
    insert_batches_one(
      object: {
        tenant_id: $tenant_id
        zone_id: $zone_id
        batch_code: $batch_code
        public_trace_key: $public_trace_key
        product_name: $product_name
        quantity: $quantity
        unit: $unit
        harvest_date: $harvest_date
        status: "HARVESTED"
      }
    ) {
      id
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

const INSERT_EVENT_AND_AUDIT = `
  mutation LogBatchCreation(
    $tenant_id: uuid!
    $batch_id: uuid!
    $location: String
    $payload: jsonb!
    $data_snapshot: jsonb!
    $sha256_hash: bpchar!
  ) {
    insert_batch_events_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        stage: "HARVEST"
        event_type: "BATCH_CREATED"
        location: $location
        payload: $payload
      }
    ) {
      id
    }
    insert_batch_audit_trail_one(
      object: {
        tenant_id: $tenant_id
        batch_id: $batch_id
        action: "BATCH_CREATED"
        data_snapshot: $data_snapshot
        sha256_hash: $sha256_hash
      }
    ) {
      id
    }
  }
`;

export default function FarmerWorkspace({ user, onNavigate }) {
  const [productName, setProductName] = useState('Xoài Cát Chu');
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('500');
  const [unit, setUnit] = useState('kg');
  const [zoneId, setZoneId] = useState(DEFAULT_ZONE_UUID);
  const [zones, setZones] = useState([]);
  const [batches, setBatches] = useState([]);
  const [createdBatch, setCreatedBatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const data = await graphqlRequest({
        query: LIST_BATCHES_QUERY,
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches || []);
      if (data.production_zones?.length) {
        setZones(data.production_zones);
        setZoneId(data.production_zones[0].id);
      }
    } catch (err) {
      setError(`Không tải được danh sách lô hàng: ${err.message}`);
    }
  };

  useEffect(() => {
    loadData();
  }, [user.token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const batchCode = `LOT-${Date.now().toString(36).toUpperCase()}`;
      const traceKey = `TR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      const res = await graphqlRequest({
        query: INSERT_BATCH_MUTATION,
        variables: {
          tenant_id: DEFAULT_TENANT_UUID,
          zone_id: zoneId,
          batch_code: batchCode,
          public_trace_key: traceKey,
          product_name: productName.trim(),
          quantity: Number(quantity),
          unit: unit.trim() || 'kg',
          harvest_date: harvestDate || null,
        },
        token: user.token,
        role: user.role,
      });

      const batch = res.insert_batches_one;
      const snapshot = {
        batch_code: batch.batch_code,
        public_trace_key: batch.public_trace_key,
        product_name: batch.product_name,
        quantity: batch.quantity,
        unit: batch.unit,
        actor: user.username,
      };
      const sha256 = await computeSha256Hex(snapshot);

      await graphqlRequest({
        query: INSERT_EVENT_AND_AUDIT,
        variables: {
          tenant_id: DEFAULT_TENANT_UUID,
          batch_id: batch.id,
          location: zones.find((z) => z.id === zoneId)?.name || 'Vùng trồng Hòa Vang',
          payload: snapshot,
          data_snapshot: snapshot,
          sha256_hash: sha256,
        },
        token: user.token,
        role: user.role,
      });

      setCreatedBatch(batch);
      await loadData();
    } catch (err) {
      setError(`Lỗi tạo lô hàng: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const traceUrl = createdBatch
    ? `${window.location.origin}/trace/${createdBatch.public_trace_key}`
    : '';

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Tạo Lô Nông Sản Mới</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Gửi GraphQL mutation qua APISIX Gateway (<code className="font-mono">/api/data/v1/graphql</code>)
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Vùng trồng</label>
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              >
                {zones.length > 0 ? (
                  zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.zone_code} — {z.name}
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_ZONE_UUID}>ZONE-DN-01 — Vùng trồng Hòa Vang</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Tên loại nông sản</label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ví dụ: Xoài Cát Chu"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Ngày thu hoạch</label>
                <input
                  type="date"
                  required
                  value={harvestDate}
                  onChange={(e) => setHarvestDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700">Sản lượng</label>
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">ĐVT</label>
                  <input
                    type="text"
                    required
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <PlusCircle className="h-4 w-4" />
              {submitting ? 'Đang tạo lô...' : 'Tạo lô hàng'}
            </button>
          </form>
        </div>

        {createdBatch && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Đã tạo lô thành công & Sinh mã QR
            </div>
            <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
              <div className="rounded-lg border border-emerald-200 bg-white p-3">
                <QRCodeSVG value={traceUrl} size={112} />
              </div>
              <div className="space-y-1 text-sm">
                <div className="font-bold text-slate-900">{createdBatch.product_name}</div>
                <div className="text-xs text-slate-600">
                  Mã lô: <code className="font-mono font-semibold">{createdBatch.batch_code}</code>
                </div>
                <div className="text-xs text-slate-600">
                  Trace Key: <code className="font-mono font-semibold text-emerald-700">{createdBatch.public_trace_key}</code>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate(`/trace/${createdBatch.public_trace_key}`)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Mở trang tra cứu /trace/{createdBatch.public_trace_key}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7">
        <h3 className="text-base font-bold text-slate-900">Danh sách Lô Nông Sản</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Mã lô</th>
                <th className="py-2 pr-3">Nông sản</th>
                <th className="py-2 pr-3">Sản lượng</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2">Trace Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-800">
                    {b.batch_code}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-slate-900">{b.product_name}</td>
                  <td className="py-2.5 pr-3 text-slate-600">
                    {b.quantity} {b.unit}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {b.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/trace/${b.public_trace_key}`)}
                      className="font-mono text-xs font-semibold text-emerald-700 hover:underline"
                    >
                      {b.public_trace_key}
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-slate-400">
                    Chưa có lô nông sản nào. Hãy tạo lô đầu tiên bên trái!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
