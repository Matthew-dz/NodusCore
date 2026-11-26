// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertOctagon,
  CheckCircle2,
  Loader2,
  PackageCheck,
  RefreshCw,
  ShieldAlert,
  Thermometer,
  Warehouse,
  X,
} from 'lucide-react';
import {
  getInspectionStatusInfo,
  getWarehouseIntakeStatusInfo,
} from '../lib/statusLabels';
import {
  fetchQualityWarehouseBatches,
  isPokaYokeViolationError,
  submitWarehouseIntake,
} from '../services/qualityWarehouseService';

function buildPokaYokeAlert(batch, rawMessage) {
  const inspectionInfo = getInspectionStatusInfo(batch?.inspections);

  if (inspectionInfo.code === 'FAILED') {
    return {
      batchCode: batch.batch_code,
      productName: batch.product_name,
      inspectionLabel: inspectionInfo.label,
      title: 'Không thể nhập kho: Lô hàng có kết quả kiểm định Không đạt!',
      description:
        'Lô nông sản này đã kiểm định nhưng Không đạt yêu cầu nên hệ thống chặn không cho đưa vào kho bảo quản.',
      detail: rawMessage,
    };
  }

  if (inspectionInfo.code === 'UNKNOWN') {
    return {
      batchCode: batch.batch_code,
      productName: batch.product_name,
      inspectionLabel: inspectionInfo.label,
      title: 'Không thể nhập kho: Trạng thái kiểm định không hợp lệ hoặc chưa rõ!',
      description:
        'Backend từ chối nhập kho vì trạng thái kiểm định hiện tại chưa xác nhận Đạt chuẩn.',
      detail: rawMessage,
    };
  }

  return {
    batchCode: batch.batch_code,
    productName: batch.product_name,
    inspectionLabel: 'Chưa kiểm định',
    title: 'Không thể nhập kho: Lô hàng chưa được kiểm định đạt chuẩn!',
    description:
      'Hệ thống kiểm soát lỗi Poka-yoke đã chặn nhập kho vì lô nông sản này chưa có phiếu kiểm định đạt chuẩn.',
    detail: rawMessage,
  };
}

export default function WarehouseWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
  const [storageLocation, setStorageLocation] = useState(
    'Kho lạnh Trung tâm HTX Đà Nẵng - Kệ A1'
  );
  const [storageTemp, setStorageTemp] = useState('4.0');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [pokaYokeModal, setPokaYokeModal] = useState(null);
  const [apiError, setApiError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [auditWarning, setAuditWarning] = useState('');
  const inFlightRef = useRef(false);

  const loadBatches = useCallback(async () => {
    setLoadingList(true);
    setLoadError('');
    try {
      const list = await fetchQualityWarehouseBatches({
        token: user.token,
        role: user.role,
      });
      setBatches(list);
    } catch (err) {
      setLoadError(`Không tải được danh sách lô hàng: ${err.message}`);
    } finally {
      setLoadingList(false);
    }
  }, [user.token, user.role]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!pokaYokeModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPokaYokeModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pokaYokeModal]);

  const handleIntake = async (batch) => {
    if (inFlightRef.current) return;

    const trimmedLoc = storageLocation.trim();
    const numericTemp = Number(storageTemp);
    if (!trimmedLoc) {
      setApiError('Vui lòng nhập vị trí kho / kệ bảo quản trước khi nhập kho.');
      return;
    }
    if (storageTemp === '' || !Number.isFinite(numericTemp) || numericTemp < -30 || numericTemp > 50) {
      setApiError('Nhiệt độ bảo quản phải nằm trong khoảng -30°C đến 50°C.');
      return;
    }

    inFlightRef.current = true;
    setLoadingId(batch.id);
    setPokaYokeModal(null);
    setApiError('');
    setSuccessMsg('');
    setAuditWarning('');

    try {
      const { updatedBatch, auditWarning: warning } = await submitWarehouseIntake({
        token: user.token,
        role: user.role,
        batch,
        actorUsername: user.username,
        storageLocation: trimmedLoc,
        storageTemp: numericTemp,
      });

      setBatches((prev) =>
        prev.map((item) =>
          item.id === batch.id ? { ...item, status: updatedBatch.status } : item
        )
      );
      const nextIntakeInfo = getWarehouseIntakeStatusInfo(updatedBatch.status);
      setSuccessMsg(
        `Đã nhập kho thành công lô ${updatedBatch.batch_code} (${batch.product_name}) tại ${trimmedLoc} (${numericTemp}°C) — ${nextIntakeInfo.label}.`
      );
      if (warning) {
        setAuditWarning(warning);
      }
      await loadBatches();
    } catch (err) {
      const raw = err.message || 'Lỗi không xác định khi nhập kho.';
      if (isPokaYokeViolationError(raw)) {
        setPokaYokeModal(buildPokaYokeAlert(batch, raw));
      } else {
        setApiError(`Không thể nhập kho lô ${batch.batch_code}: ${raw}`);
      }
    } finally {
      inFlightRef.current = false;
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {pokaYokeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="poka-yoke-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          onClick={() => setPokaYokeModal(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border-2 border-rose-500 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-rose-200 bg-rose-600 px-6 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="h-6 w-6 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-rose-100">
                    Cơ chế kiểm soát lỗi Poka-yoke
                  </div>
                  <h3 id="poka-yoke-modal-title" className="text-base font-bold">
                    Từ chối nhập kho lô hàng chưa hợp lệ
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPokaYokeModal(null)}
                aria-label="Đóng cảnh báo Poka-yoke"
                className="rounded-lg p-1 text-rose-100 transition hover:bg-rose-700 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-sm font-bold text-rose-900">{pokaYokeModal.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-rose-800">
                  {pokaYokeModal.description}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Lô hàng: </span>
                  <strong className="font-mono text-slate-900">{pokaYokeModal.batchCode}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Nông sản: </span>
                  <strong className="text-slate-900">{pokaYokeModal.productName}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Trạng thái kiểm định: </span>
                  <span className="inline-flex items-center whitespace-nowrap rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-800">
                    {pokaYokeModal.inspectionLabel}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                  Phản hồi từ Backend / PostgreSQL Trigger:
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 font-mono text-xs text-rose-800 break-words">
                  {pokaYokeModal.detail}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPokaYokeModal(null)}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                >
                  Đóng cảnh báo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            aria-label="Đóng thông báo thành công"
            className="rounded p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {auditWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {auditWarning}
        </div>
      )}

      {apiError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{apiError}</span>
          </div>
          <button
            type="button"
            onClick={() => setApiError('')}
            aria-label="Đóng thông báo lỗi"
            className="rounded p-1 text-rose-600 hover:bg-rose-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section
        aria-labelledby="warehouse-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-sky-600" />
              <h2 id="warehouse-heading" className="text-lg font-bold text-slate-900">
                Bàn làm việc Thủ kho — Kiểm soát Nhập kho (Poka-yoke)
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {batches.length} lô
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Hệ thống tự động chặn nhập kho nếu lô nông sản chưa được kiểm định{' '}
              <span className="font-semibold text-emerald-700">Đạt chuẩn</span>.
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

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-12">
          <div className="sm:col-span-8">
            <label
              htmlFor="warehouse-location"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
            >
              <Warehouse className="h-3.5 w-3.5 text-sky-600" />
              Kho / Vị trí kệ tiếp nhận <span className="text-rose-600">*</span>
            </label>
            <input
              id="warehouse-location"
              type="text"
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="Ví dụ: Kho lạnh Trung tâm HTX Đà Nẵng - Kệ A1"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <div className="sm:col-span-4">
            <label
              htmlFor="warehouse-temp"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
            >
              <Thermometer className="h-3.5 w-3.5 text-sky-600" />
              Nhiệt độ bảo quản (°C) <span className="text-rose-600">*</span>
            </label>
            <input
              id="warehouse-temp"
              type="number"
              min="-30"
              max="50"
              step="0.5"
              value={storageTemp}
              onChange={(e) => setStorageTemp(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
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
                <th className="whitespace-nowrap py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tải danh sách lô hàng...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => {
                    const inspectionInfo = getInspectionStatusInfo(b.inspections);
                    const intakeInfo = getWarehouseIntakeStatusInfo(b.status);
                    const alreadyReceived = intakeInfo.code === 'RECEIVED';
                    const isRejectedOrFailed =
                      b.status === 'REJECTED' || inspectionInfo.code === 'FAILED';
                    const isProcessing = loadingId === b.id;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-slate-800">
                          {b.batch_code}
                        </td>
                        <td className="py-3 pr-3 font-medium text-slate-900">{b.product_name}</td>
                        <td className="py-3 pr-3 whitespace-nowrap text-slate-600">
                          {b.quantity} {b.unit}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${inspectionInfo.badgeClass}`}
                          >
                            {inspectionInfo.label}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${intakeInfo.badgeClass}`}
                          >
                            {intakeInfo.label}
                          </span>
                        </td>
                        <td className="py-3">
                          {alreadyReceived ? (
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã nhập kho
                            </span>
                          ) : isRejectedOrFailed ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center whitespace-nowrap text-xs font-medium text-rose-700">
                                Không đủ điều kiện
                              </span>
                              <button
                                type="button"
                                disabled={Boolean(loadingId)}
                                onClick={() => handleIntake(b)}
                                title="Thử nhập kho để kiểm chứng cơ chế chặn Poka-yoke từ PostgreSQL"
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {isProcessing ? 'Đang kiểm tra...' : 'Thử nhập kho (Poka-yoke)'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(loadingId)}
                              onClick={() => handleIntake(b)}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              {isProcessing ? 'Đang xử lý...' : 'Nhập kho'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                        Chưa có lô hàng nào trong hệ thống.
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
