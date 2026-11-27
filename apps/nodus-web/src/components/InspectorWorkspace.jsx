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
  getInspectionResultLabel,
  getInspectionStatusInfo,
  getWarehouseIntakeStatusInfo,
} from '../lib/statusLabels';
import {
  fetchQualityWarehouseBatches,
  submitBatchInspection,
} from '../services/qualityWarehouseService';

const DEFAULT_PASS_NOTE = 'Đạt tiêu chuẩn VietGAP xuất kho.';

const RESIDUE_TEST_OPTIONS = [
  'Không phát hiện (Âm tính)',
  'Phát hiện vượt ngưỡng (Dương tính)',
  'Chưa xác định',
];

function validateInspectionForm({ result, agency, brix, residueTest, notes }) {
  const errors = {};
  const brixNum = Number(brix);
  const trimmedNotes = notes.trim();

  if (!agency.trim()) {
    errors.agency = 'Vui lòng nhập đơn vị kiểm định.';
  }

  if (brix === '' || brix === null || brix === undefined) {
    errors.brix = 'Vui lòng nhập độ Brix.';
  } else if (!Number.isFinite(brixNum) || brixNum < 0 || brixNum > 100) {
    errors.brix = 'Độ Brix phải là số từ 0 đến 100 (%).';
  }

  if (!residueTest.trim()) {
    errors.residueTest = 'Vui lòng chọn kết quả test kit dư lượng.';
  }

  if (result === 'FAILED') {
    if (!trimmedNotes || trimmedNotes.length < 5) {
      errors.notes = 'Khi chọn Không đạt, vui lòng nhập rõ lý do từ chối (tối thiểu 5 ký tự).';
    } else if (trimmedNotes === DEFAULT_PASS_NOTE) {
      errors.notes = 'Không thể giữ nguyên ghi chú "Đạt tiêu chuẩn..." cho phiếu Không đạt.';
    }
  }

  return errors;
}

export default function InspectorWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [result, setResult] = useState('PASSED');
  const [agency, setAgency] = useState('Trung tâm Kiểm định Nông sản Đà Nẵng');
  const [brix, setBrix] = useState('14.5');
  const [residueTest, setResidueTest] = useState(RESIDUE_TEST_OPTIONS[0]);
  const [notes, setNotes] = useState(DEFAULT_PASS_NOTE);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const inFlightRef = useRef(false);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId) || null;
  const selectedInspectionInfo = selectedBatch
    ? getInspectionStatusInfo(selectedBatch.inspections)
    : null;
  const selectedIntakeInfo = selectedBatch
    ? getWarehouseIntakeStatusInfo(selectedBatch.status)
    : null;

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

  const handleResultChange = (nextResult) => {
    setResult(nextResult);
    clearFieldError('notes');
    if (nextResult === 'FAILED') {
      if (notes.trim() === DEFAULT_PASS_NOTE) {
        setNotes('');
      }
    } else if (!notes.trim()) {
      setNotes(DEFAULT_PASS_NOTE);
    }
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!selectedBatch || inFlightRef.current) return;

    setMessage('');
    setSubmitError('');
    const errors = validateInspectionForm({ result, agency, brix, residueTest, notes });
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
        brix,
        residueTest,
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
    `mt-1 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 transition focus:outline-none focus:ring-2 ${
      hasError
        ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-500/20'
        : 'border-slate-300 bg-white focus:border-amber-500 focus:ring-amber-500/20'
    }`;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section
        aria-labelledby="inspector-list-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="inspector-list-heading" className="text-lg font-bold text-slate-900">
                Danh sách Lô chờ Kiểm định
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {batches.length} lô
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Chọn một lô nông sản để đánh giá chất lượng (Đạt chuẩn / Không đạt).
            </p>
          </div>
          <button
            type="button"
            disabled={loadingList}
            onClick={loadBatches}
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
              onClick={loadBatches}
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
                <th className="whitespace-nowrap py-2 pr-3">Mã lô</th>
                <th className="whitespace-nowrap py-2 pr-3">Nông sản</th>
                <th className="whitespace-nowrap py-2 pr-3">Sản lượng</th>
                <th className="whitespace-nowrap py-2 pr-3">Trạng thái kiểm định</th>
                <th className="whitespace-nowrap py-2 pr-3">Trạng thái nhập kho</th>
                <th className="whitespace-nowrap py-2">Chọn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải danh sách lô kiểm định...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => {
                    const inspectionInfo = getInspectionStatusInfo(b.inspections);
                    const intakeInfo = getWarehouseIntakeStatusInfo(b.status);
                    const isSelected = selectedBatch?.id === b.id;
                    return (
                      <tr key={b.id} className={isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'}>
                        <td className="py-2.5 pr-3 font-mono text-xs font-semibold text-slate-800">
                          {b.batch_code}
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-slate-900">{b.product_name}</td>
                        <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-slate-600">
                          {b.quantity} {b.unit}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${inspectionInfo.badgeClass}`}
                          >
                            {inspectionInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${intakeInfo.badgeClass}`}
                          >
                            {intakeInfo.label}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => handleSelectBatch(b)}
                            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                              isSelected
                                ? 'bg-amber-700 text-white'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
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
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5"
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <h3 id="inspector-form-heading" className="text-lg font-bold text-slate-900">
            Phiếu Kiểm Định
          </h3>
        </div>

        {selectedBatch ? (
          <form onSubmit={handleInspect} noValidate className="mt-4 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <div>
                Đang kiểm định lô:{' '}
                <strong className="font-mono text-slate-900">{selectedBatch.batch_code}</strong> —{' '}
                <strong className="text-slate-900">{selectedBatch.product_name}</strong>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-slate-500">
                <span>
                  Sản lượng: {selectedBatch.quantity} {selectedBatch.unit}
                </span>
                <span>•</span>
                <span>
                  Kiểm định:{' '}
                  <strong className="text-slate-700">{selectedInspectionInfo?.label}</strong>
                </span>
                <span>•</span>
                <span>
                  Nhập kho: <strong className="text-slate-700">{selectedIntakeInfo?.label}</strong>
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="inspector-result"
                className="block text-xs font-semibold text-slate-700"
              >
                Kết quả kiểm định
              </label>
              <select
                id="inspector-result"
                disabled={submitting}
                value={result}
                onChange={(e) => handleResultChange(e.target.value)}
                className={inputClassName(false)}
              >
                <option value="PASSED">Đạt chuẩn — Đủ điều kiện nhập kho</option>
                <option value="FAILED">Không đạt — Chưa đủ điều kiện</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="inspector-agency"
                className="block text-xs font-semibold text-slate-700"
              >
                Đơn vị kiểm định <span className="text-rose-600">*</span>
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
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.agency}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label
                  htmlFor="inspector-brix"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-700"
                >
                  Độ Brix (%) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="inspector-brix"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  disabled={submitting}
                  value={brix}
                  aria-invalid={Boolean(fieldErrors.brix)}
                  onChange={(e) => {
                    setBrix(e.target.value);
                    clearFieldError('brix');
                  }}
                  className={inputClassName(Boolean(fieldErrors.brix))}
                />
                {fieldErrors.brix && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.brix}</p>
                )}
              </div>

              <div className="sm:col-span-8">
                <label
                  htmlFor="inspector-residue"
                  className="block whitespace-nowrap text-xs font-semibold text-slate-700"
                >
                  Test kit dư lượng BVTV <span className="text-rose-600">*</span>
                </label>
                <select
                  id="inspector-residue"
                  disabled={submitting}
                  value={residueTest}
                  aria-invalid={Boolean(fieldErrors.residueTest)}
                  onChange={(e) => {
                    setResidueTest(e.target.value);
                    clearFieldError('residueTest');
                  }}
                  className={inputClassName(Boolean(fieldErrors.residueTest))}
                >
                  {RESIDUE_TEST_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {fieldErrors.residueTest && (
                  <p className="mt-1 text-xs text-rose-600">{fieldErrors.residueTest}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="inspector-notes"
                className="block text-xs font-semibold text-slate-700"
              >
                {result === 'FAILED' ? (
                  <>
                    Lý do không đạt chuẩn <span className="text-rose-600">*</span>
                  </>
                ) : (
                  'Ghi chú kiểm định'
                )}
              </label>
              <textarea
                id="inspector-notes"
                rows={3}
                disabled={submitting}
                value={notes}
                placeholder={
                  result === 'FAILED'
                    ? 'Nhập rõ lý do không đạt (ví dụ: Dư lượng vượt ngưỡng, độ Brix thấp)...'
                    : 'Nhập ghi chú kiểm định...'
                }
                aria-invalid={Boolean(fieldErrors.notes)}
                onChange={(e) => {
                  setNotes(e.target.value);
                  clearFieldError('notes');
                }}
                className={inputClassName(Boolean(fieldErrors.notes))}
              />
              {fieldErrors.notes && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.notes}</p>
              )}
            </div>

            {message && (
              <div
                role="status"
                className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMessage('')}
                  aria-label="Đóng thông báo thành công"
                  className="rounded p-0.5 text-emerald-700 hover:bg-emerald-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

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

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Đang lưu phiếu...' : 'Lưu kết quả kiểm định'}
            </button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {loadingList
              ? 'Đang tải danh sách lô hàng...'
              : 'Chưa có lô hàng nào để kiểm định.'}
          </p>
        )}
      </section>
    </div>
  );
}
