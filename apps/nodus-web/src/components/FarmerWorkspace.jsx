// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Sprout,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { DEFAULT_TENANT_UUID, DEFAULT_ZONE_UUID } from '../lib/graphql';
import { createFarmerBatch, fetchFarmerWorkspaceData } from '../services/farmerBatchService';

const UNIT_SUGGESTIONS = ['kg', 'tấn', 'tạ', 'thùng', 'giỏ', 'bó'];

const STATUS_BADGE_STYLES = {
  CREATED: 'bg-slate-100 text-slate-700 border-slate-200',
  HARVESTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INSPECTING: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_STORAGE: 'bg-sky-50 text-sky-700 border-sky-200',
  DISTRIBUTING: 'bg-purple-50 text-purple-700 border-purple-200',
  SOLD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function validateBatchForm({ zoneId, productName, harvestDate, quantity, unit }) {
  const errors = {};
  const trimmedName = productName.trim();
  const trimmedUnit = unit.trim();
  const numericQty = Number(quantity);

  if (!zoneId) {
    errors.zoneId = 'Vui lòng chọn vùng trồng.';
  }

  if (!trimmedName) {
    errors.productName = 'Vui lòng nhập tên cây trồng.';
  } else if (trimmedName.length < 2) {
    errors.productName = 'Tên cây trồng phải có ít nhất 2 ký tự.';
  } else if (trimmedName.length > 255) {
    errors.productName = 'Tên cây trồng tối đa 255 ký tự.';
  }

  if (!harvestDate) {
    errors.harvestDate = 'Vui lòng chọn ngày thu hoạch.';
  } else if (Number.isNaN(Date.parse(harvestDate))) {
    errors.harvestDate = 'Ngày thu hoạch không hợp lệ.';
  }

  if (quantity === '' || quantity === null || quantity === undefined) {
    errors.quantity = 'Vui lòng nhập sản lượng.';
  } else if (!Number.isFinite(numericQty) || numericQty <= 0) {
    errors.quantity = 'Sản lượng phải lớn hơn 0.';
  } else if (numericQty > 999999999) {
    errors.quantity = 'Sản lượng vượt quá giới hạn cho phép.';
  } else if (!/^\d+(\.\d{1,3})?$/.test(String(quantity).trim())) {
    errors.quantity = 'Sản lượng tối đa 3 chữ số thập phân.';
  }

  if (!trimmedUnit) {
    errors.unit = 'Vui lòng nhập đơn vị tính.';
  } else if (trimmedUnit.length > 32) {
    errors.unit = 'Đơn vị tính tối đa 32 ký tự.';
  }

  return errors;
}

export default function FarmerWorkspace({ user, onNavigate }) {
  const [productName, setProductName] = useState('Xoài Cát Chu');
  const [harvestDate, setHarvestDate] = useState(getTodayIsoDate);
  const [quantity, setQuantity] = useState('500');
  const [unit, setUnit] = useState('kg');
  const [zoneId, setZoneId] = useState(DEFAULT_ZONE_UUID);
  const [zones, setZones] = useState([]);
  const [batches, setBatches] = useState([]);
  const [createdBatch, setCreatedBatch] = useState(null);
  const [auditWarning, setAuditWarning] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadData = useCallback(async () => {
    setLoadingList(true);
    setLoadError('');
    try {
      const data = await fetchFarmerWorkspaceData({
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches);
      if (data.zones.length > 0) {
        setZones(data.zones);
        setZoneId((prev) =>
          data.zones.some((z) => z.id === prev) ? prev : data.zones[0].id
        );
      }
    } catch (err) {
      setLoadError(`Không tải được danh sách lô hàng: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, [user.token, user.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleReset = () => {
    setProductName('');
    setHarvestDate(getTodayIsoDate());
    setQuantity('');
    setUnit('kg');
    setZoneId(zones[0]?.id || DEFAULT_ZONE_UUID);
    setFieldErrors({});
    setSubmitError('');
    setAuditWarning('');
  };

  const handleCopyValue = async (field, text) => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      // Clipboard API may be unavailable in restricted contexts.
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setAuditWarning('');

    const errors = validateBatchForm({ zoneId, productName, harvestDate, quantity, unit });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const selectedZone = zones.find((z) => z.id === zoneId);
    setSubmitting(true);
    try {
      const result = await createFarmerBatch({
        token: user.token,
        role: user.role,
        tenantId: selectedZone?.tenant_id || DEFAULT_TENANT_UUID,
        zoneId,
        zoneName: selectedZone?.name,
        productName,
        harvestDate,
        quantity,
        unit,
        actorUsername: user.username,
      });

      setCreatedBatch(result.batch);
      setAuditWarning(result.auditWarning || '');
      setCopiedField('');
      await loadData();
    } catch (err) {
      setSubmitError(`Lỗi tạo lô hàng: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const traceUrl = createdBatch
    ? `${window.location.origin}/trace/${createdBatch.public_trace_key}`
    : '';

  const inputClassName = (hasError) =>
    `mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/20'
        : 'border-slate-300 bg-white focus:border-emerald-500 focus:ring-emerald-500/20'
    }`;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <section
          aria-labelledby="farmer-create-batch-heading"
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-600" />
                <h2
                  id="farmer-create-batch-heading"
                  className="text-lg font-bold text-slate-900"
                >
                  Tạo Lô Nông Sản Mới
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Gửi GraphQL mutation qua APISIX Gateway (
                <code className="font-mono">/api/data/v1/graphql</code>)
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Nông hộ
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="farmer-zone"
                className="block text-xs font-semibold text-slate-700"
              >
                Vùng trồng <span className="text-rose-600">*</span>
              </label>
              <select
                id="farmer-zone"
                value={zoneId}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.zoneId)}
                aria-describedby={fieldErrors.zoneId ? 'farmer-zone-error' : undefined}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  clearFieldError('zoneId');
                }}
                className={inputClassName(Boolean(fieldErrors.zoneId))}
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
              {fieldErrors.zoneId && (
                <p id="farmer-zone-error" className="mt-1 text-xs text-rose-600">
                  {fieldErrors.zoneId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="farmer-product-name"
                className="block text-xs font-semibold text-slate-700"
              >
                Tên cây trồng <span className="text-rose-600">*</span>
              </label>
              <input
                id="farmer-product-name"
                type="text"
                maxLength={255}
                disabled={submitting}
                value={productName}
                aria-invalid={Boolean(fieldErrors.productName)}
                aria-describedby={
                  fieldErrors.productName ? 'farmer-product-name-error' : undefined
                }
                onChange={(e) => {
                  setProductName(e.target.value);
                  clearFieldError('productName');
                }}
                placeholder="Ví dụ: Xoài Cát Chu"
                className={inputClassName(Boolean(fieldErrors.productName))}
              />
              {fieldErrors.productName && (
                <p id="farmer-product-name-error" className="mt-1 text-xs text-rose-600">
                  {fieldErrors.productName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label
                  htmlFor="farmer-harvest-date"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-700"
                >
                  Ngày thu hoạch <span className="text-rose-600">*</span>
                </label>
                <input
                  id="farmer-harvest-date"
                  type="date"
                  disabled={submitting}
                  value={harvestDate}
                  aria-invalid={Boolean(fieldErrors.harvestDate)}
                  aria-describedby={
                    fieldErrors.harvestDate ? 'farmer-harvest-date-error' : undefined
                  }
                  onChange={(e) => {
                    setHarvestDate(e.target.value);
                    clearFieldError('harvestDate');
                  }}
                  className={inputClassName(Boolean(fieldErrors.harvestDate))}
                />
                {fieldErrors.harvestDate && (
                  <p id="farmer-harvest-date-error" className="mt-1 text-xs text-rose-600">
                    {fieldErrors.harvestDate}
                  </p>
                )}
              </div>

              <div className="sm:col-span-4">
                <label
                  htmlFor="farmer-quantity"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-700"
                >
                  Sản lượng <span className="text-rose-600">*</span>
                </label>
                <input
                  id="farmer-quantity"
                  type="number"
                  min="0.001"
                  step="any"
                  disabled={submitting}
                  value={quantity}
                  placeholder="500"
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  aria-describedby={
                    fieldErrors.quantity ? 'farmer-quantity-error' : undefined
                  }
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    clearFieldError('quantity');
                  }}
                  className={inputClassName(Boolean(fieldErrors.quantity))}
                />
                {fieldErrors.quantity && (
                  <p id="farmer-quantity-error" className="mt-1 text-xs text-rose-600">
                    {fieldErrors.quantity}
                  </p>
                )}
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="farmer-unit"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-700"
                >
                  Đơn vị tính <span className="text-rose-600">*</span>
                </label>
                <input
                  id="farmer-unit"
                  type="text"
                  list="farmer-unit-options"
                  maxLength={32}
                  disabled={submitting}
                  value={unit}
                  placeholder="kg"
                  aria-invalid={Boolean(fieldErrors.unit)}
                  aria-describedby={fieldErrors.unit ? 'farmer-unit-error' : undefined}
                  onChange={(e) => {
                    setUnit(e.target.value);
                    clearFieldError('unit');
                  }}
                  className={inputClassName(Boolean(fieldErrors.unit))}
                />
                <datalist id="farmer-unit-options">
                  {UNIT_SUGGESTIONS.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                {fieldErrors.unit && (
                  <p id="farmer-unit-error" className="mt-1 text-xs text-rose-600">
                    {fieldErrors.unit}
                  </p>
                )}
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex items-start justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError('')}
                  aria-label="Đóng thông báo lỗi"
                  className="rounded p-0.5 text-rose-600 hover:bg-rose-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitting ? 'Đang lưu lô hàng...' : 'Lưu & Tạo lô hàng'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleReset}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                Đặt lại
              </button>
            </div>
          </form>
        </section>

        {createdBatch && (
          <div
            role="status"
            className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Đã lưu lô thành công & Sinh mã QR
              </div>
              <button
                type="button"
                onClick={() => setCreatedBatch(null)}
                aria-label="Ẩn thông báo tạo lô thành công"
                className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {auditWarning && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                {auditWarning}
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm">
                <QRCodeSVG value={traceUrl} size={160} level="M" includeMargin />
              </div>

              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <QrCode className="h-4 w-4 text-emerald-600" />
                  <span>{createdBatch.product_name}</span>
                </div>

                <div className="text-xs text-slate-600">
                  Sản lượng:{' '}
                  <span className="font-semibold text-slate-800">
                    {createdBatch.quantity} {createdBatch.unit}
                  </span>
                </div>

                <div className="text-xs text-slate-600">
                  Mã lô:{' '}
                  <code className="font-mono font-semibold text-slate-900">
                    {createdBatch.batch_code}
                  </code>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span>Trace Key:</span>
                  <code className="font-mono font-semibold text-emerald-700">
                    {createdBatch.public_trace_key}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyValue('traceKey', createdBatch.public_trace_key)}
                    className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    {copiedField === 'traceKey' ? (
                      <>
                        <Check className="h-3 w-3" />
                        Đã chép
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Chép
                      </>
                    )}
                  </button>
                </div>

                <div className="rounded-lg border border-emerald-200/80 bg-white/80 p-2 text-[11px] text-slate-600 break-all">
                  {traceUrl}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(`/trace/${createdBatch.public_trace_key}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                >
                  Mở trang tra cứu /trace/{createdBatch.public_trace_key}
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <section
        aria-labelledby="farmer-batch-list-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id="farmer-batch-list-heading" className="text-base font-bold text-slate-900">
              Danh sách Lô Nông Sản
            </h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {batches.length} lô
            </span>
          </div>
          <button
            type="button"
            disabled={loadingList}
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            {loadingList ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="shrink-0 rounded border border-rose-200 bg-white px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Mã lô</th>
                <th className="py-2 pr-3">Cây trồng</th>
                <th className="py-2 pr-3">Thu hoạch</th>
                <th className="py-2 pr-3">Sản lượng</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2">Trace Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải danh sách lô nông sản...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-800">
                        {b.batch_code}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">{b.product_name}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">
                        {b.harvest_date || '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">
                        {b.quantity} {b.unit}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_BADGE_STYLES[b.status] ||
                            'border-slate-200 bg-slate-100 text-slate-700'
                          }`}
                        >
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
                      <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                        Chưa có lô nông sản nào. Hãy tạo lô đầu tiên bên trái!
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
