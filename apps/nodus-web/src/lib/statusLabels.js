// Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0.

export const BATCH_STATUS_LABELS = {
  CREATED: 'Mới tạo',
  HARVESTED: 'Đã thu hoạch',
  INSPECTING: 'Đã kiểm định',
  IN_STORAGE: 'Đã nhập kho',
  DISTRIBUTING: 'Đang phân phối',
  SOLD: 'Đã bán hết',
  REJECTED: 'Không đạt chuẩn',
};

export const BATCH_STATUS_STYLES = {
  CREATED: 'border-slate-200 bg-slate-100 text-slate-700',
  HARVESTED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  INSPECTING: 'border-amber-200 bg-amber-50 text-amber-800',
  IN_STORAGE: 'border-sky-200 bg-sky-50 text-sky-800',
  DISTRIBUTING: 'border-purple-200 bg-purple-50 text-purple-800',
  SOLD: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
};

export const INSPECTION_RESULT_LABELS = {
  PASSED: 'Đạt chuẩn',
  FAILED: 'Không đạt',
  PENDING: 'Chưa kiểm định',
};

const RECEIVED_BATCH_STATUSES = new Set(['IN_STORAGE', 'DISTRIBUTING', 'SOLD']);
const NOT_RECEIVED_BATCH_STATUSES = new Set([
  'CREATED',
  'HARVESTED',
  'INSPECTING',
  'REJECTED',
]);

export const STAGE_LABELS = {
  CULTIVATION: 'Canh tác tại vườn',
  HARVEST: 'Thu hoạch tại vườn',
  INSPECTION: 'Kiểm tra chất lượng',
  STORAGE: 'Lưu kho bảo quản',
  DISTRIBUTION: 'Đưa ra thị trường',
};

export const EVENT_TYPE_LABELS = {
  BATCH_CREATED: 'Lập lô nông sản mới',
  QR_GENERATED: 'Sinh mã QR truy xuất',
  QUALITY_INSPECTED: 'Hoàn tất kiểm tra chất lượng',
  STORED_IN_WAREHOUSE: 'Đã nhập kho bảo quản',
  DISPATCHED_TO_MARKET: 'Xuất kho đi phân phối',
};

export const AUDIT_ACTION_LABELS = {
  BATCH_CREATED: 'Ghi nhận tạo lô mới',
  QR_GENERATED: 'Niêm phong sự kiện sinh QR',
  INSPECTION_RECORDED: 'Lưu kết quả kiểm định',
  WAREHOUSE_INTAKE: 'Lưu phiếu nhập kho',
  DISTRIBUTION_DISPATCHED: 'Lưu phiếu xuất bán',
};

export function getBatchStatusLabel(status) {
  return BATCH_STATUS_LABELS[status] || status || 'Chưa rõ';
}

export function getBatchStatusStyle(status) {
  return BATCH_STATUS_STYLES[status] || 'border-slate-200 bg-slate-100 text-slate-700';
}

export function getInspectionResultLabel(result) {
  return INSPECTION_RESULT_LABELS[result] || result || 'Chưa kiểm định';
}

export function getInspectionStatusInfo(inspections) {
  const latest = inspections?.[0];
  if (!latest || latest.result === 'PENDING') {
    return {
      code: 'PENDING',
      label: 'Chưa kiểm định',
      badgeClass: 'border-amber-200 bg-amber-100 text-amber-800',
    };
  }
  if (latest.result === 'PASSED') {
    return {
      code: 'PASSED',
      label: 'Đạt chuẩn',
      badgeClass: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    };
  }
  if (latest.result === 'FAILED') {
    return {
      code: 'FAILED',
      label: 'Không đạt',
      badgeClass: 'border-rose-200 bg-rose-100 text-rose-800',
    };
  }
  return {
    code: 'UNKNOWN',
    raw: String(latest.result),
    label: `Chưa rõ (${latest.result})`,
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
  };
}

export function getWarehouseIntakeStatusInfo(batchStatus) {
  if (RECEIVED_BATCH_STATUSES.has(batchStatus)) {
    return {
      code: 'RECEIVED',
      label: 'Đã nhập kho',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (NOT_RECEIVED_BATCH_STATUSES.has(batchStatus)) {
    return {
      code: 'NOT_RECEIVED',
      label: 'Chưa nhập kho',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }
  return {
    code: 'UNKNOWN',
    raw: String(batchStatus ?? ''),
    label: batchStatus ? `Chưa rõ (${batchStatus})` : 'Chưa rõ',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  };
}

export function getStageLabel(stage) {
  return STAGE_LABELS[stage] || stage;
}

export function getEventTypeLabel(eventType) {
  return EVENT_TYPE_LABELS[eventType] || eventType;
}

export function getAuditActionLabel(action) {
  return AUDIT_ACTION_LABELS[action] || action;
}
