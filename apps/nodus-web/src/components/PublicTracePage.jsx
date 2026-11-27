// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  FileCheck2,
  Hash,
  Info,
  Loader2,
  MapPin,
  Package,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  Warehouse,
  X,
} from 'lucide-react';
import {
  getAuditActionLabel,
  getBatchStatusLabel,
  getBatchStatusStyle,
  getEventTypeLabel,
  getStageLabel,
  getWarehouseIntakeStatusInfo,
} from '../lib/statusLabels';
import {
  fetchPublicTraceBatch,
  formatPublicTraceError,
  validatePublicTraceKey,
} from '../services/publicTraceService';

function formatDateVi(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleDateString('vi-VN');
}

function formatDateTimeVi(value) {
  if (!value) return 'Chưa có dữ liệu';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toLocaleString('vi-VN');
}

function getMissingTraceFields(batch, availability) {
  if (!batch) return [];
  const missing = [];
  if (!batch.tenant?.name) missing.push('Đơn vị sản xuất');
  if (!batch.production_zone?.name) missing.push('Vùng trồng');
  if (!batch.production_zone?.puc_code) missing.push('Mã số vùng trồng (PUC)');
  if (!batch.harvest_date) missing.push('Ngày thu hoạch');
  if (!batch.expiry_date) missing.push('Hạn sử dụng');
  if (!batch.certificate_code) missing.push('Mã chứng từ lô hàng');
  if (!availability?.inspectionAvailable) missing.push('Chi tiết kiểm định từ API công khai');
  if (!availability?.timelineAvailable || !batch.batch_events?.length) {
    missing.push('Mốc sự kiện chuỗi cung ứng');
  }
  if (!availability?.auditAvailable || !batch.batch_audit_trails?.length) {
    missing.push('Bản ghi niêm phong SHA-256');
  }
  return missing;
}

export default function PublicTracePage({ traceKey = '', routeInvalid = false, onNavigate }) {
  const [inputKey, setInputKey] = useState(traceKey || '');
  const [batch, setBatch] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);

  const runTraceLookup = useCallback(async (keyToFetch) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++requestSeqRef.current;

    setLoading(true);
    setErrorState(null);
    setBatch(null);
    setAvailability(null);

    try {
      const outcome = await fetchPublicTraceBatch(keyToFetch, { signal: controller.signal });
      if (seq !== requestSeqRef.current) return;

      if (outcome.status === 'invalid_key') {
        setErrorState({
          type: 'invalid_key',
          message: outcome.error,
          canRetry: false,
        });
        return;
      }

      if (outcome.status === 'not_found') {
        setErrorState({
          type: 'not_found',
          message: outcome.error,
          canRetry: false,
        });
        return;
      }

      setBatch(outcome.batch);
      setAvailability(outcome.availability);
    } catch (err) {
      if (err?.name === 'AbortError' || seq !== requestSeqRef.current) return;
      const mapped = formatPublicTraceError(err);
      setErrorState({
        type: mapped.code === 'RATE_LIMITED' ? 'rate_limit' : 'api',
        message: mapped.message,
        canRetry: true,
      });
    } finally {
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (routeInvalid) {
      abortControllerRef.current?.abort();
      setLoading(false);
      setBatch(null);
      setAvailability(null);
      setInputKey('');
      setErrorState({
        type: 'invalid_key',
        message: 'Đường dẫn hoặc mã QR truy xuất không hợp lệ.',
        canRetry: false,
      });
      return;
    }

    if (traceKey) {
      setInputKey(traceKey);
      runTraceLookup(traceKey);
    } else {
      abortControllerRef.current?.abort();
      setLoading(false);
      setBatch(null);
      setAvailability(null);
      setErrorState(null);
    }
  }, [traceKey, routeInvalid, runTraceLookup]);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const validation = validatePublicTraceKey(inputKey);
    if (!validation.valid) {
      abortControllerRef.current?.abort();
      setLoading(false);
      setBatch(null);
      setAvailability(null);
      setErrorState({
        type: 'invalid_key',
        message: validation.error,
        canRetry: false,
      });
      return;
    }

    if (onNavigate) {
      if (validation.normalized === traceKey && !routeInvalid) {
        runTraceLookup(validation.normalized);
      } else {
        onNavigate(`/trace/${encodeURIComponent(validation.normalized)}`);
      }
    } else {
      runTraceLookup(validation.normalized);
    }
  };

  const handleResetSearch = () => {
    setInputKey('');
    setBatch(null);
    setAvailability(null);
    setErrorState(null);
    if (onNavigate) {
      onNavigate('/trace');
    }
  };

  const intakeInfo = batch ? getWarehouseIntakeStatusInfo(batch.status) : null;
  const missingFields = getMissingTraceFields(batch, availability);
  const isErrorLike = errorState?.type === 'api' || errorState?.type === 'rate_limit';

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <section
        aria-labelledby="public-trace-heading"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <QrCode className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1
              id="public-trace-heading"
              className="text-lg font-bold leading-snug text-slate-900 sm:text-xl"
            >
              Cổng Tra Cứu Nguồn Gốc Nông Sản
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
              Truy cập công khai bằng mã QR hoặc khóa truy xuất, không yêu cầu đăng nhập.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} noValidate className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="public-trace-input" className="sr-only">
              Khóa truy xuất nguồn gốc
            </label>
            <input
              id="public-trace-input"
              type="text"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Nhập khóa QR (ví dụ: TR-XXXXXXXX)..."
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white py-2 pl-3.5 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            {inputKey && (
              <button
                type="button"
                onClick={() => setInputKey('')}
                aria-label="Xóa mã đang nhập"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? 'Đang tra cứu...' : 'Tra cứu'}
          </button>
        </form>
      </section>

      {loading && (
        <section
          role="status"
          aria-live="polite"
          className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"
        >
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-900">
            Đang tải thông tin truy xuất nguồn gốc...
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Hệ thống đang đối chiếu khóa truy xuất từ cổng API công khai.
          </p>
        </section>
      )}

      {!loading && errorState && (
        <section
          role="alert"
          className={`rounded-xl border p-4 shadow-sm sm:p-5 ${
            isErrorLike
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : errorState.type === 'invalid_key'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {isErrorLike ? (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            ) : (
              <ShieldAlert
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  errorState.type === 'invalid_key' ? 'text-rose-600' : 'text-amber-600'
                }`}
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold sm:text-base">
                {errorState.type === 'invalid_key'
                  ? 'Mã truy xuất không hợp lệ'
                  : errorState.type === 'not_found'
                    ? 'Không tìm thấy thông tin lô hàng'
                    : errorState.type === 'rate_limit'
                      ? 'Tạm giới hạn tần suất truy vấn'
                      : 'Không thể kết nối dữ liệu truy xuất'}
              </h2>
              <p className="mt-1 text-xs leading-relaxed sm:text-sm">{errorState.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {errorState.canRetry && traceKey && (
                  <button
                    type="button"
                    onClick={() => runTraceLookup(traceKey)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Thử lại
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetSearch}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Tra cứu mã khác
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && !errorState && !batch && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm sm:p-8">
          <QrCode className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-sm font-semibold text-slate-800 sm:text-base">
            Sẵn sàng tra cứu lô nông sản
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500 sm:text-sm">
            Hãy quét mã QR trên nhãn sản phẩm hoặc nhập khóa truy xuất công khai vào ô phía trên để
            kiểm tra nguồn gốc và lịch sử ghi nhận từ backend.
          </p>
        </section>
      )}

      {!loading && batch && (
        <div className="space-y-4 sm:space-y-6">
          {missingFields.length > 0 && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 sm:p-4"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 leading-relaxed">
                <span className="font-semibold">Dữ liệu truy xuất chưa đầy đủ:</span> Một số mục
                hiện chưa có dữ liệu từ API công khai ({missingFields.join(', ')}). Các thông tin
                thiếu được giữ nguyên là &ldquo;Chưa có dữ liệu&rdquo;.
              </div>
            </div>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getBatchStatusStyle(
                      batch.status
                    )}`}
                  >
                    Lưu thông: {getBatchStatusLabel(batch.status)}
                  </span>
                  {intakeInfo && (
                    <span
                      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${intakeInfo.badgeClass}`}
                    >
                      <Warehouse className="h-3.5 w-3.5" />
                      Kho: {intakeInfo.label}
                    </span>
                  )}
                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    Kiểm định: Chưa có dữ liệu công khai
                  </span>
                </div>

                <h2 className="mt-2.5 break-words text-xl font-bold text-slate-900 sm:text-2xl">
                  {batch.product_name || 'Chưa có dữ liệu'}
                </h2>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 sm:text-sm">
                  <span>
                    Mã lô:{' '}
                    <code className="break-all font-mono font-semibold text-slate-800">
                      {batch.batch_code}
                    </code>
                  </span>
                  <span>
                    Khóa QR:{' '}
                    <code className="break-all font-mono font-semibold text-emerald-700">
                      {batch.public_trace_key}
                    </code>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 sm:block sm:shrink-0 sm:text-right">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 sm:justify-end">
                  <Package className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sản lượng</span>
                </div>
                <div className="text-base font-bold text-slate-900 sm:mt-0.5 sm:text-lg">
                  {batch.quantity != null
                    ? `${batch.quantity} ${batch.unit || ''}`.trim()
                    : 'Chưa có dữ liệu'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Xuất xứ &amp; Vùng trồng</span>
                </div>
                <dl className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Đơn vị / HTX:</dt>
                    <dd className="break-words text-right font-semibold text-slate-900">
                      {batch.tenant?.name || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Vùng trồng:</dt>
                    <dd className="break-words text-right font-medium text-slate-900">
                      {batch.production_zone?.name || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Cây trồng:</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {batch.production_zone?.crop_type || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Mã vùng (PUC):</dt>
                    <dd className="break-all text-right font-mono text-slate-800">
                      {batch.production_zone?.puc_code || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Tiêu chuẩn canh tác:</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {batch.production_zone?.farming_standard || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Ngày thu hoạch:</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {formatDateVi(batch.harvest_date) || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Hạn sử dụng:</dt>
                    <dd className="text-right font-medium text-slate-800">
                      {formatDateVi(batch.expiry_date) || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FileCheck2 className="h-4 w-4 shrink-0 text-sky-600" />
                  <span>Trạng thái Nghiệp vụ &amp; Chứng từ</span>
                </div>
                <dl className="mt-2.5 space-y-2 text-xs text-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Trạng thái nhập kho:</dt>
                    <dd className="font-semibold text-slate-900">
                      {intakeInfo?.label || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Trạng thái lưu thông:</dt>
                    <dd className="font-semibold text-slate-900">
                      {getBatchStatusLabel(batch.status)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Trạng thái kiểm tra:</dt>
                    <dd className="font-medium text-amber-800">
                      Chưa có dữ liệu từ API công khai
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                    <dt className="text-slate-500">Mã chứng từ lô hàng:</dt>
                    <dd className="break-all text-right font-mono font-semibold text-slate-900">
                      {batch.certificate_code || 'Chưa có dữ liệu'}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 border-t border-slate-200 pt-2.5 text-[11px] leading-relaxed text-slate-500">
                  Cổng công khai chỉ hiển thị dữ liệu do backend cho phép công bố; không tự suy
                  diễn kết quả kiểm định khi API không trả về hồ sơ kiểm tra.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
              <Clock className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Dòng thời gian Chuỗi cung ứng</span>
            </h3>
            {!availability?.timelineAvailable ? (
              <p className="mt-3 text-xs text-slate-500 sm:text-sm">
                Chưa có dữ liệu dòng thời gian từ API công khai.
              </p>
            ) : batch.batch_events?.length > 0 ? (
              <ol className="mt-4 space-y-4 border-l-2 border-emerald-200 pl-4">
                {batch.batch_events.map((ev) => (
                  <li key={ev.id} className="relative min-w-0">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-white" />
                    <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <span className="inline-block w-fit max-w-full break-words rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                        {getStageLabel(ev.stage)} — {getEventTypeLabel(ev.event_type)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTimeVi(ev.occurred_at)}
                      </span>
                    </div>
                    <div className="mt-1 break-words text-xs text-slate-600">
                      Địa điểm: {ev.location || 'Chưa có dữ liệu'}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-xs text-slate-500 sm:text-sm">
                Chưa có dữ liệu sự kiện truy xuất được ghi nhận cho lô hàng này.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
              <Hash className="h-4 w-4 shrink-0 text-indigo-600" />
              <span>Sổ cái Niêm phong Dữ liệu (SHA-256)</span>
            </h3>
            {!availability?.auditAvailable ? (
              <p className="mt-3 text-xs text-slate-500 sm:text-sm">
                Chưa có dữ liệu bản ghi niêm phong từ API công khai.
              </p>
            ) : batch.batch_audit_trails?.length > 0 ? (
              <div className="mt-3 space-y-2">
                {batch.batch_audit_trails.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-800">
                        #{a.id} {getAuditActionLabel(a.action)}
                      </span>
                      <span className="block text-slate-500 sm:ml-2 sm:inline">
                        {formatDateTimeVi(a.sealed_at)}
                      </span>
                    </div>
                    <code className="break-all font-mono text-[11px] text-indigo-700">
                      {a.sha256_hash || 'Chưa có dữ liệu'}
                    </code>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500 sm:text-sm">
                Chưa có dữ liệu bản ghi niêm phong hash.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
