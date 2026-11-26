// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  ImageDown,
  Loader2,
  Printer,
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
  CREATED: 'border-slate-500/40 bg-slate-800/70 text-slate-200',
  HARVESTED: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  INSPECTING: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  IN_STORAGE: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  DISTRIBUTING: 'border-purple-400/40 bg-purple-500/15 text-purple-300',
  SOLD: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
  REJECTED: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
};

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDefaultExpiryIsoDate(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

function validateBatchForm({
  tenantId,
  zoneId,
  productName,
  harvestDate,
  expiryDate,
  quantity,
  unit,
}) {
  const errors = {};
  const trimmedName = productName.trim();
  const trimmedUnit = unit.trim();
  const numericQty = Number(quantity);

  if (!tenantId) {
    errors.tenantId = 'Vui lòng chọn Hợp tác xã.';
  }

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

  if (!expiryDate) {
    errors.expiryDate = 'Vui lòng chọn ngày hết hạn.';
  } else if (Number.isNaN(Date.parse(expiryDate))) {
    errors.expiryDate = 'Ngày hết hạn không hợp lệ.';
  } else if (harvestDate && expiryDate < harvestDate) {
    errors.expiryDate = 'Ngày hết hạn phải lớn hơn hoặc bằng ngày thu hoạch.';
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
  const [expiryDate, setExpiryDate] = useState(() => getDefaultExpiryIsoDate(7));
  const [quantity, setQuantity] = useState('500');
  const [unit, setUnit] = useState('kg');
  const [tenantId, setTenantId] = useState(DEFAULT_TENANT_UUID);
  const [zoneId, setZoneId] = useState(DEFAULT_ZONE_UUID);
  const [tenants, setTenants] = useState([]);
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

  const tenantMap = useMemo(() => {
    const map = {};
    for (const t of tenants) {
      map[t.id] = t;
    }
    return map;
  }, [tenants]);

  const filteredZones = useMemo(() => {
    if (!zones.length) return [];
    const matching = zones.filter((z) => z.tenant_id === tenantId);
    return matching.length > 0 ? matching : zones;
  }, [zones, tenantId]);

  const loadData = useCallback(async () => {
    setLoadingList(true);
    setLoadError('');
    try {
      const data = await fetchFarmerWorkspaceData({
        token: user.token,
        role: user.role,
      });
      setBatches(data.batches);
      setTenants(data.tenants);
      setZones(data.zones);

      let resolvedTenantId = tenantId;
      if (data.tenants.length > 0) {
        const matchedTenant =
          data.tenants.find((t) => t.id === tenantId) ||
          data.tenants.find((t) => t.code === user.tenantId) ||
          data.tenants[0];
        resolvedTenantId = matchedTenant.id;
        setTenantId(resolvedTenantId);
      }

      if (data.zones.length > 0) {
        setZoneId((prev) => {
          if (data.zones.some((z) => z.id === prev)) return prev;
          const zoneForTenant = data.zones.find((z) => z.tenant_id === resolvedTenantId);
          return (zoneForTenant || data.zones[0]).id;
        });
      }
    } catch (err) {
      setLoadError(`Không tải được danh sách lô hàng: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, [user.token, user.role, user.tenantId]);

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

  const resetFormFields = () => {
    setProductName('');
    setHarvestDate(getTodayIsoDate());
    setExpiryDate('');
    setQuantity('');
    setUnit('kg');
    setFieldErrors({});
  };

  const handleReset = () => {
    resetFormFields();
    const defaultTenant =
      tenants.find((t) => t.code === user.tenantId) || tenants[0];
    const nextTenantId = defaultTenant?.id || DEFAULT_TENANT_UUID;
    setTenantId(nextTenantId);
    const firstZone =
      zones.find((z) => z.tenant_id === nextTenantId) || zones[0];
    setZoneId(firstZone?.id || DEFAULT_ZONE_UUID);
    setSubmitError('');
    setAuditWarning('');
  };

  const handleTenantChange = (nextTenantId) => {
    setTenantId(nextTenantId);
    clearFieldError('tenantId');
    const zoneForTenant = zones.find((z) => z.tenant_id === nextTenantId);
    if (zoneForTenant) {
      setZoneId(zoneForTenant.id);
      clearFieldError('zoneId');
    }
  };

  const handleZoneChange = (nextZoneId) => {
    setZoneId(nextZoneId);
    clearFieldError('zoneId');
    const selectedZone = zones.find((z) => z.id === nextZoneId);
    if (selectedZone?.tenant_id) {
      setTenantId(selectedZone.tenant_id);
      clearFieldError('tenantId');
    }
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

  const downloadQrSvg = (traceKey) => {
    const svgEl = document.getElementById(`farmer-qr-svg-${traceKey}`);
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

  const downloadQrPng = (traceKey) => {
    const svgEl = document.getElementById(`farmer-qr-svg-${traceKey}`);
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) return;
        const pngUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `nodus-qr-${traceKey}.png`;
        link.click();
        URL.revokeObjectURL(pngUrl);
      }, 'image/png');
    };
    img.src = svgUrl;
  };

  const printQrLabel = (batch) => {
    const svgEl = document.getElementById(`farmer-qr-svg-${batch.public_trace_key}`);
    if (!svgEl) return;
    const svgMarkup = new XMLSerializer().serializeToString(svgEl);
    const printWin = window.open('', '_blank', 'width=480,height=640');
    if (!printWin) {
      window.print();
      return;
    }

    const labelUrl = `${window.location.origin}/trace/${batch.public_trace_key}`;
    const escapeHtml = (v) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    printWin.document.open();
    printWin.document.write(`<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <title>Nhãn QR - ${escapeHtml(batch.batch_code)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      .label { max-width: 360px; margin: 0 auto; border: 2px solid #0f172a; border-radius: 12px; padding: 18px; text-align: center; }
      .brand { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #059669; text-transform: uppercase; }
      h1 { font-size: 18px; margin: 6px 0 12px; }
      .qr { display: inline-block; padding: 8px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
      .meta { text-align: left; margin-top: 14px; font-size: 12px; line-height: 1.6; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
      .mono { font-family: monospace; font-weight: 700; }
      @media print { body { margin: 0; } }
    </style>
  </head>
  <body>
    <div class="label">
      <div class="brand">NodusCore DX-OS • Truy xuất nguồn gốc</div>
      <h1>${escapeHtml(batch.product_name)}</h1>
      <div class="qr">${svgMarkup}</div>
      <div class="meta">
        <div>Mã lô: <span class="mono">${escapeHtml(batch.batch_code)}</span></div>
        <div>Trace Key: <span class="mono">${escapeHtml(batch.public_trace_key)}</span></div>
        <div>Sản lượng: <strong>${escapeHtml(batch.quantity)} ${escapeHtml(batch.unit)}</strong></div>
        <div>Thu hoạch: ${escapeHtml(batch.harvest_date || '—')}</div>
        <div>Hết hạn: ${escapeHtml(batch.expiry_date || '—')}</div>
        <div style="margin-top:6px;font-size:10px;word-break:break-all;">${escapeHtml(labelUrl)}</div>
      </div>
    </div>
    <script>window.onload = function(){ window.print(); };</script>
  </body>
</html>`);
    printWin.document.close();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setAuditWarning('');

    const errors = validateBatchForm({
      tenantId,
      zoneId,
      productName,
      harvestDate,
      expiryDate,
      quantity,
      unit,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const selectedZone = zones.find((z) => z.id === zoneId);
    const resolvedTenantId = selectedZone?.tenant_id || tenantId || DEFAULT_TENANT_UUID;
    setSubmitting(true);
    try {
      const result = await createFarmerBatch({
        token: user.token,
        role: user.role,
        tenantId: resolvedTenantId,
        zoneId,
        zoneName: selectedZone?.name,
        productName,
        harvestDate,
        expiryDate,
        quantity,
        unit,
        actorUsername: user.username,
      });

      setCreatedBatch(result.batch);
      setAuditWarning(result.auditWarning || '');
      setCopiedField('');
      resetFormFields();
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
    `mt-1 w-full rounded-[10px] border px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-rose-400/70 bg-rose-950/30 focus:border-rose-400 focus:ring-rose-500/25'
        : 'border-emerald-400/35 bg-slate-900/65 focus:border-emerald-400 focus:ring-emerald-500/30'
    }`;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-5">
        <section
          aria-labelledby="farmer-create-batch-heading"
          className="nodus-glass-card rounded-[20px] p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-emerald-400" />
                <h2
                  id="farmer-create-batch-heading"
                  className="text-lg font-bold text-slate-100"
                >
                  Tạo Lô Nông Sản Mới
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Gửi GraphQL mutation qua APISIX Gateway (
                <code className="font-mono text-emerald-300">/api/data/v1/graphql</code>)
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Nông hộ
            </span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="farmer-tenant"
                className="block text-xs font-semibold text-slate-300"
              >
                Hợp tác xã (Tenants) <span className="text-rose-400">*</span>
              </label>
              <select
                id="farmer-tenant"
                value={tenantId}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.tenantId)}
                aria-describedby={fieldErrors.tenantId ? 'farmer-tenant-error' : undefined}
                onChange={(e) => handleTenantChange(e.target.value)}
                className={inputClassName(Boolean(fieldErrors.tenantId))}
              >
                {tenants.length > 0 ? (
                  tenants.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900 text-slate-100">
                      {t.name} ({t.code})
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_TENANT_UUID} className="bg-slate-900 text-slate-100">
                    HTX Nông nghiệp Hòa Vang - Đà Nẵng (htx-danang)
                  </option>
                )}
              </select>
              {fieldErrors.tenantId && (
                <p id="farmer-tenant-error" className="mt-1 text-xs text-rose-400">
                  {fieldErrors.tenantId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="farmer-zone"
                className="block text-xs font-semibold text-slate-300"
              >
                Vùng trồng <span className="text-rose-400">*</span>
              </label>
              <select
                id="farmer-zone"
                value={zoneId}
                disabled={submitting}
                aria-invalid={Boolean(fieldErrors.zoneId)}
                aria-describedby={fieldErrors.zoneId ? 'farmer-zone-error' : undefined}
                onChange={(e) => handleZoneChange(e.target.value)}
                className={inputClassName(Boolean(fieldErrors.zoneId))}
              >
                {filteredZones.length > 0 ? (
                  filteredZones.map((z) => {
                    const htxName = tenantMap[z.tenant_id]?.name;
                    return (
                      <option key={z.id} value={z.id} className="bg-slate-900 text-slate-100">
                        {z.zone_code} — {z.name}
                        {htxName ? ` (${htxName})` : ''}
                      </option>
                    );
                  })
                ) : (
                  <option value={DEFAULT_ZONE_UUID} className="bg-slate-900 text-slate-100">
                    ZONE-DN-01 — Vùng trồng Hòa Vang - Đà Nẵng
                  </option>
                )}
              </select>
              {fieldErrors.zoneId && (
                <p id="farmer-zone-error" className="mt-1 text-xs text-rose-400">
                  {fieldErrors.zoneId}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="farmer-product-name"
                className="block text-xs font-semibold text-slate-300"
              >
                Tên cây trồng <span className="text-rose-400">*</span>
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
                <p id="farmer-product-name-error" className="mt-1 text-xs text-rose-400">
                  {fieldErrors.productName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="farmer-harvest-date"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-300"
                >
                  Ngày thu hoạch <span className="text-rose-400">*</span>
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
                    clearFieldError('expiryDate');
                  }}
                  className={inputClassName(Boolean(fieldErrors.harvestDate))}
                />
                {fieldErrors.harvestDate && (
                  <p id="farmer-harvest-date-error" className="mt-1 text-xs text-rose-400">
                    {fieldErrors.harvestDate}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="farmer-expiry-date"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-300"
                >
                  Ngày hết hạn <span className="text-rose-400">*</span>
                </label>
                <input
                  id="farmer-expiry-date"
                  type="date"
                  min={harvestDate || undefined}
                  disabled={submitting}
                  value={expiryDate}
                  aria-invalid={Boolean(fieldErrors.expiryDate)}
                  aria-describedby={
                    fieldErrors.expiryDate ? 'farmer-expiry-date-error' : undefined
                  }
                  onChange={(e) => {
                    setExpiryDate(e.target.value);
                    clearFieldError('expiryDate');
                  }}
                  className={inputClassName(Boolean(fieldErrors.expiryDate))}
                />
                {fieldErrors.expiryDate && (
                  <p id="farmer-expiry-date-error" className="mt-1 text-xs text-rose-400">
                    {fieldErrors.expiryDate}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <label
                  htmlFor="farmer-quantity"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-300"
                >
                  Sản lượng <span className="text-rose-400">*</span>
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
                  <p id="farmer-quantity-error" className="mt-1 text-xs text-rose-400">
                    {fieldErrors.quantity}
                  </p>
                )}
              </div>

              <div className="sm:col-span-5">
                <label
                  htmlFor="farmer-unit"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-300"
                >
                  Đơn vị tính <span className="text-rose-400">*</span>
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
                  <p id="farmer-unit-error" className="mt-1 text-xs text-rose-400">
                    {fieldErrors.unit}
                  </p>
                )}
              </div>
            </div>

            {submitError && (
              <div
                role="alert"
                className="flex items-start justify-between gap-2 rounded-xl border border-rose-400/40 bg-rose-950/50 p-3 text-xs text-rose-200"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{submitError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitError('')}
                  aria-label="Đóng thông báo lỗi"
                  className="rounded p-0.5 text-rose-300 hover:bg-rose-900/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="nodus-btn-primary inline-flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-emerald-400/25 bg-slate-900/60 px-3.5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800/80 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="nodus-glass-card rounded-[20px] border-emerald-400/45 p-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                Đã lưu lô thành công & Sinh mã QR
              </div>
              <button
                type="button"
                onClick={() => setCreatedBatch(null)}
                aria-label="Ẩn thông báo tạo lô thành công"
                className="rounded p-1 text-slate-300 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {auditWarning && (
              <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-950/40 p-2.5 text-xs text-amber-200">
                {auditWarning}
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-xl border border-emerald-300/40 bg-white p-2.5 shadow-md">
                <QRCodeSVG
                  id={`farmer-qr-svg-${createdBatch.public_trace_key}`}
                  value={traceUrl}
                  size={156}
                  level="M"
                  includeMargin
                />
              </div>

              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <div className="flex items-center gap-1.5 font-bold text-slate-100">
                  <QrCode className="h-4 w-4 text-emerald-400" />
                  <span>{createdBatch.product_name}</span>
                </div>

                <div className="text-xs text-slate-300">
                  Sản lượng:{' '}
                  <span className="font-semibold text-white">
                    {createdBatch.quantity} {createdBatch.unit}
                  </span>
                  {' • '}HSD:{' '}
                  <span className="font-semibold text-slate-200">
                    {createdBatch.expiry_date || '—'}
                  </span>
                </div>

                <div className="text-xs text-slate-300">
                  Mã lô:{' '}
                  <code className="font-mono font-semibold text-white">
                    {createdBatch.batch_code}
                  </code>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                  <span>Trace Key:</span>
                  <code className="font-mono font-semibold text-emerald-300">
                    {createdBatch.public_trace_key}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopyValue('traceKey', createdBatch.public_trace_key)}
                    className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-slate-900/70 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300 hover:bg-slate-800"
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

                <div className="nodus-glass-subcard rounded-lg p-2 text-[11px] text-slate-300 break-all">
                  {traceUrl}
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => downloadQrPng(createdBatch.public_trace_key)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-slate-800"
                  >
                    <ImageDown className="h-3.5 w-3.5" />
                    Tải PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadQrSvg(createdBatch.public_trace_key)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Tải SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => printQrLabel(createdBatch)}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-slate-900/70 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    In nhãn
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(`/trace/${createdBatch.public_trace_key}`)}
                  className="inline-flex items-center gap-1 pt-0.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
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
        className="nodus-glass-card rounded-[20px] p-6 lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 id="farmer-batch-list-heading" className="text-base font-bold text-slate-100">
              Danh sách Lô Nông Sản
            </h3>
            <span className="rounded-full border border-emerald-400/25 bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
              {batches.length} lô
            </span>
          </div>
          <button
            type="button"
            disabled={loadingList}
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            {loadingList ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-950/50 p-3 text-xs text-rose-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="shrink-0 rounded border border-rose-400/40 bg-rose-900/50 px-2.5 py-1 font-semibold text-rose-100 hover:bg-rose-900"
            >
              Thử lại
            </button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-400/20 text-xs uppercase text-slate-400">
                <th className="py-2 pr-3">Mã lô</th>
                <th className="py-2 pr-3">Cây trồng</th>
                <th className="py-2 pr-3">Thu hoạch / HSD</th>
                <th className="py-2 pr-3">Sản lượng</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2">Trace Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-400/10">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      Đang tải danh sách lô nông sản...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => (
                    <tr key={b.id} className="transition hover:bg-emerald-500/5">
                      <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-200">
                        {b.batch_code}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-white">{b.product_name}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-300">
                        <div>{b.harvest_date || '—'}</div>
                        <div className="text-[11px] text-slate-400">
                          HSD: {b.expiry_date || '—'}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-300">
                        {b.quantity} {b.unit}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            STATUS_BADGE_STYLES[b.status] ||
                            'border-slate-500/40 bg-slate-800/70 text-slate-200'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() => onNavigate(`/trace/${b.public_trace_key}`)}
                          className="font-mono text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
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
