// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  getBatchStatusLabel,
  getBatchStatusStyle,
  getInspectionResultLabel,
} from '../lib/statusLabels';
import {
  fetchQualityWarehouseBatches,
  submitBatchInspection,
} from '../services/qualityWarehouseService';

function validateInspectionForm({ agency, metrics }) {
  const errors = {};
  if (!agency.trim()) {
    errors.agency = 'Vui lòng nhập đơn vị kiểm định.';
  }
  if (!metrics.trim()) {
    errors.metrics = 'Vui lòng nhập chỉ số kiểm nghiệm.';
  }
  return errors;
}

export default function InspectorWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [result, setResult] = useState('PASSED');
  const [agency, setAgency] = useState('Trung tâm Kiểm định Nông sản Đà Nẵng');
  const [metrics, setMetrics] = useState('Brix: 14.5%, Dư lượng BVTV: Không phát hiện');
  const [notes, setNotes] = useState('Đạt tiêu chuẩn VietGAP xuất kho.');
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const inFlightRef = useRef(false);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || null;

  const loadBatches = useCallback(async () => {
    setLoadingList(true);
    setLoadError('');
    try {
      const list = await fetchQualityWarehouseBatches({
        token: user.token,
        role: user.role,
      });
      setBatches(list);
      setSelectedBatchId((prevId) => {
        if (prevId && list.some((item) => item.id === prevId)) {
          return prevId;
        }
        return list[0]?.id || null;
      });
    } catch (err) {
      setLoadError(`Không tải được danh sách lô hàng: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, [user.token, user.role]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSelectBatch = (batch) => {
    setSelectedBatchId(batch.id);
    setSubmitError('');
    setMessage('');
    setFieldErrors({});
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!selectedBatch || inFlightRef.current) return;

    setMessage('');
    setSubmitError('');
    const errors = validateInspectionForm({ agency, metrics });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const { inspection, updatedBatch } = await submitBatchInspection({
        token: user.token,
        role: user.role,
        batch: selectedBatch,
        result,
        agency,
        metrics,
        notes,
        actorUsername: user.username,
      });

      setBatches((prev) =>
        prev.map((item) =>
          item.id === selectedBatch.id
            ? {
                ...item,
                status: updatedBatch.status,
                inspections: [inspection],
              }
            : item
        )
      );

      setMessage(
        `Đã lưu phiếu kiểm định ${inspection.inspection_code} (${getInspectionResultLabel(
          inspection.result
        )}) cho lô ${selectedBatch.batch_code}.`
      );
      await loadBatches();
    } catch (err) {
      setSubmitError(`Lỗi ghi phiếu kiểm định: ${err.message}`);
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const inputClassName = (hasError) =>
    `mt-1 w-full rounded-[10px] border px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-rose-400/70 bg-rose-950/30 focus:border-rose-400 focus:ring-rose-500/25'
        : 'border-emerald-400/35 bg-slate-900/65 focus:border-amber-400 focus:ring-amber-500/25'
    }`;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section
        aria-labelledby="inspector-list-heading"
        className="nodus-glass-card rounded-[20px] p-6 lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="inspector-list-heading" className="text-lg font-bold text-slate-100">
                Danh sách Lô chờ Kiểm định
              </h2>
              <span className="rounded-full border border-emerald-400/25 bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                {batches.length} lô
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Chọn một lô nông sản để đánh giá chất lượng (Đạt chuẩn / Không đạt).
            </p>
          </div>
          <button
            type="button"
            disabled={loadingList}
            onClick={loadBatches}
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
              onClick={loadBatches}
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
                <th className="py-2 pr-3">Nông sản</th>
                <th className="py-2 pr-3">Sản lượng</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 pr-3">Kiểm định gần nhất</th>
                <th className="py-2">Chọn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-400/10">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      Đang tải danh sách lô kiểm định...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => {
                    const latest = b.inspections?.[0];
                    const isSelected = selectedBatch?.id === b.id;
                    return (
                      <tr
                        key={b.id}
                        className={
                          isSelected
                            ? 'bg-amber-500/10'
                            : 'transition hover:bg-emerald-500/5'
                        }
                      >
                        <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-200">
                          {b.batch_code}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-white">{b.product_name}</td>
                        <td className="py-2.5 pr-3 text-xs text-slate-300">
                          {b.quantity} {b.unit}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getBatchStatusStyle(
                              b.status
                            )}`}
                          >
                            {getBatchStatusLabel(b.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          {latest ? (
                            <span
                              className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                                latest.result === 'PASSED'
                                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              {getInspectionResultLabel(latest.result)}
                            </span>
                          ) : (
                            <span className="whitespace-nowrap text-xs text-slate-400">
                              Chưa kiểm định
                            </span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => handleSelectBatch(b)}
                            className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-amber-600/90 text-white hover:bg-amber-500'
                            }`}
                          >
                            {isSelected ? 'Đang chọn' : 'Kiểm định'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                        Chưa có lô hàng nào cần kiểm định.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        aria-labelledby="inspector-form-heading"
        className="nodus-glass-card rounded-[20px] p-6 lg:col-span-5"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-amber-400" />
          <h3 id="inspector-form-heading" className="text-lg font-bold text-slate-100">
            Phiếu Kiểm Định
          </h3>
        </div>

        {selectedBatch ? (
          <form onSubmit={handleInspect} noValidate className="mt-4 space-y-4">
            <div className="nodus-glass-subcard rounded-xl p-3 text-xs text-slate-300">
              <div>
                Đang kiểm định lô:{' '}
                <strong className="font-mono text-white">{selectedBatch.batch_code}</strong> —{' '}
                <strong className="text-emerald-300">{selectedBatch.product_name}</strong>
              </div>
              <div className="mt-1 text-slate-400">
                Sản lượng: {selectedBatch.quantity} {selectedBatch.unit} • Trạng thái:{' '}
                <span className="font-semibold text-slate-200">
                  {getBatchStatusLabel(selectedBatch.status)}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="inspector-result"
                className="block text-xs font-semibold text-slate-300"
              >
                Kết quả kiểm định
              </label>
              <select
                id="inspector-result"
                disabled={submitting}
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className={inputClassName(false)}
              >
                <option value="PASSED" className="bg-slate-900 text-slate-100">
                  Đạt chuẩn — Đủ điều kiện nhập kho
                </option>
                <option value="FAILED" className="bg-slate-900 text-slate-100">
                  Không đạt — Chưa đủ điều kiện
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="inspector-agency"
                className="block text-xs font-semibold text-slate-300"
              >
                Đơn vị kiểm định <span className="text-rose-400">*</span>
              </label>
              <input
                id="inspector-agency"
                type="text"
                disabled={submitting}
                value={agency}
                aria-invalid={Boolean(fieldErrors.agency)}
                onChange={(e) => {
                  setAgency(e.target.value);
                  clearFieldError('agency');
                }}
                className={inputClassName(Boolean(fieldErrors.agency))}
              />
              {fieldErrors.agency && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.agency}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="inspector-metrics"
                className="block text-xs font-semibold text-slate-300"
              >
                Chỉ số kiểm nghiệm <span className="text-rose-400">*</span>
              </label>
              <input
                id="inspector-metrics"
                type="text"
                disabled={submitting}
                value={metrics}
                aria-invalid={Boolean(fieldErrors.metrics)}
                onChange={(e) => {
                  setMetrics(e.target.value);
                  clearFieldError('metrics');
                }}
                className={inputClassName(Boolean(fieldErrors.metrics))}
              />
              {fieldErrors.metrics && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.metrics}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="inspector-notes"
                className="block text-xs font-semibold text-slate-300"
              >
                Ghi chú
              </label>
              <textarea
                id="inspector-notes"
                rows={3}
                disabled={submitting}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClassName(false)}
              />
            </div>

            {message && (
              <div
                role="status"
                className="flex items-start justify-between gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/50 p-3 text-xs text-emerald-200"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMessage('')}
                  aria-label="Đóng thông báo thành công"
                  className="rounded p-0.5 text-emerald-300 hover:bg-emerald-900/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-950/50 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Đang lưu phiếu...' : 'Lưu kết quả kiểm định'}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-400">
            {loadingList
              ? 'Đang tải danh sách lô hàng...'
              : 'Chưa có lô hàng nào để kiểm định.'}
          </p>
        )}
      </section>
    </div>
  );
}
