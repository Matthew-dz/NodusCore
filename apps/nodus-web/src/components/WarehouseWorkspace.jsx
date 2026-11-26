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
  X,
} from 'lucide-react';
import {
  fetchQualityWarehouseBatches,
  isPokaYokeViolationError,
  submitWarehouseIntake,
} from '../services/qualityWarehouseService';

const BATCH_STATUS_BADGE = {
  CREATED: 'border-slate-500/40 bg-slate-800/70 text-slate-200',
  HARVESTED: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  INSPECTING: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  IN_STORAGE: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  DISTRIBUTING: 'border-purple-400/40 bg-purple-500/15 text-purple-300',
  SOLD: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
  REJECTED: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
};

function buildPokaYokeAlert(batch, rawMessage) {
  const inspectionResult = batch?.inspections?.[0]?.result;
  if (inspectionResult === 'FAILED') {
    return {
      batchCode: batch.batch_code,
      productName: batch.product_name,
      inspectionLabel: 'FAILED (Không đạt)',
      title: 'Poka-yoke chặn nhập kho: Lô hàng có kết quả kiểm định KHÔNG ĐẠT (FAILED)!',
      description:
        'Lô nông sản này đã bị đánh dấu FAILED nên không đủ điều kiện an toàn để chuyển vào kho lưu trữ (IN_STORAGE).',
      detail: rawMessage,
    };
  }

  return {
    batchCode: batch.batch_code,
    productName: batch.product_name,
    inspectionLabel: 'CHƯA KIỂM ĐỊNH',
    title: 'Poka-yoke chặn nhập kho: Lô hàng chưa được kiểm định đạt chuẩn (PASSED)!',
    description:
      'Cơ chế kiểm soát lỗi Poka-yoke tại PostgreSQL đã từ chối thao tác nhập kho vì lô hàng chưa có phiếu kiểm định đạt chuẩn.',
    detail: rawMessage,
  };
}

export default function WarehouseWorkspace({ user }) {
  const [batches, setBatches] = useState([]);
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
      });

      setBatches((prev) =>
        prev.map((item) =>
          item.id === batch.id ? { ...item, status: updatedBatch.status } : item
        )
      );
      setSuccessMsg(
        `Đã nhập kho thành công lô ${updatedBatch.batch_code} (${batch.product_name}) — trạng thái: ${updatedBatch.status}.`
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onClick={() => setPokaYokeModal(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[20px] border-2 border-rose-500/80 bg-slate-900/95 shadow-2xl shadow-rose-950/60 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-rose-500/30 bg-rose-600 px-6 py-4 text-white">
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
              <div className="rounded-xl border border-rose-400/40 bg-rose-950/50 p-4">
                <p className="text-sm font-bold text-rose-200">{pokaYokeModal.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-rose-300">
                  {pokaYokeModal.description}
                </p>
              </div>

              <div className="nodus-glass-subcard grid grid-cols-1 gap-2 rounded-xl p-3.5 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-slate-400">Lô hàng: </span>
                  <strong className="font-mono text-white">{pokaYokeModal.batchCode}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Nông sản: </span>
                  <strong className="text-slate-100">{pokaYokeModal.productName}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400">Tình trạng kiểm định: </span>
                  <span className="inline-block rounded-full border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 font-bold text-rose-300">
                    {pokaYokeModal.inspectionLabel}
                  </span>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  Phản hồi từ Backend / PostgreSQL Trigger:
                </div>
                <div className="rounded-lg border border-rose-400/30 bg-slate-950/80 p-3 font-mono text-xs text-rose-300 break-words">
                  {pokaYokeModal.detail}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setPokaYokeModal(null)}
                  className="rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400/50"
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
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-950/60 p-4 text-sm font-medium text-emerald-200 backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg('')}
            aria-label="Đóng thông báo thành công"
            className="rounded p-1 text-emerald-300 hover:bg-emerald-900/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {auditWarning && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-950/50 p-3 text-xs text-amber-200">
          {auditWarning}
        </div>
      )}

      {apiError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-rose-400/40 bg-rose-950/50 p-4 text-xs text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{apiError}</span>
          </div>
          <button
            type="button"
            onClick={() => setApiError('')}
            aria-label="Đóng thông báo lỗi"
            className="rounded p-1 text-rose-300 hover:bg-rose-900/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section
        aria-labelledby="warehouse-heading"
        className="nodus-glass-card rounded-[20px] p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-sky-400" />
              <h2 id="warehouse-heading" className="text-lg font-bold text-slate-100">
                Bàn làm việc Thủ kho — Kiểm soát Nhập kho (Poka-yoke)
              </h2>
              <span className="rounded-full border border-emerald-400/25 bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-sky-300">
                {batches.length} lô
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              CSDL PostgreSQL sẽ tự động chặn chuyển trạng thái sang{' '}
              <code className="font-mono text-sky-300">IN_STORAGE</code> nếu lô chưa có phiếu kiểm
              định <code className="font-mono text-emerald-300">PASSED</code>.
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
                <th className="py-2 pr-3">Kết quả Kiểm định</th>
                <th className="py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-400/10">
              {loadingList && batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                      Đang tải danh sách lô hàng...
                    </span>
                  </td>
                </tr>
              ) : (
                <>
                  {batches.map((b) => {
                    const insp = b.inspections?.[0];
                    const alreadyStored =
                      b.status === 'IN_STORAGE' ||
                      b.status === 'DISTRIBUTING' ||
                      b.status === 'SOLD';
                    const isProcessing = loadingId === b.id;

                    return (
                      <tr key={b.id} className="transition hover:bg-emerald-500/5">
                        <td className="py-3 pr-3 font-mono text-xs font-semibold text-slate-200">
                          {b.batch_code}
                        </td>
                        <td className="py-3 pr-3 font-medium text-white">{b.product_name}</td>
                        <td className="py-3 pr-3 text-slate-300">
                          {b.quantity} {b.unit}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              BATCH_STATUS_BADGE[b.status] ||
                              'border-slate-500/40 bg-slate-800/70 text-slate-200'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {insp ? (
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                                insp.result === 'PASSED'
                                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-rose-400/40 bg-rose-500/15 text-rose-300'
                              }`}
                            >
                              {insp.result}
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                              CHƯA KIỂM ĐỊNH
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {alreadyStored ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã nhập kho
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(loadingId)}
                              onClick={() => handleIntake(b)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 disabled:cursor-not-allowed disabled:opacity-50"
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
