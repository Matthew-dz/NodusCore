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
  CREATED: 'border-slate-500/40 bg-slate-800/70 text-slate-200',
  HARVESTED: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300',
  INSPECTING: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
  IN_STORAGE: 'border-sky-400/40 bg-sky-500/15 text-sky-300',
  DISTRIBUTING: 'border-purple-400/40 bg-purple-500/15 text-purple-300',
  SOLD: 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300',
  REJECTED: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
};

export const INSPECTION_RESULT_LABELS = {
  PASSED: 'Đạt chuẩn',
  FAILED: 'Không đạt',
  PENDING: 'Chờ kiểm định',
};

export const STAGE_LABELS = {
  CULTIVATION: 'Canh tác tại vườn',
  HARVEST: 'Thu hoạch tại vườn',
  INSPECTION: 'Kiểm tra chất lượng',
  STORAGE: 'Lưu kho bảo quản',
  DISTRIBUTION: 'Đưa ra thị trường',
};

export const EVENT_TYPE_LABELS = {
  BATCH_CREATED: 'Lập lô nông sản mới',
  QUALITY_INSPECTED: 'Hoàn tất kiểm tra chất lượng',
  STORED_IN_WAREHOUSE: 'Đã nhập kho bảo quản',
  DISPATCHED_TO_MARKET: 'Xuất kho đi phân phối',
};

export const AUDIT_ACTION_LABELS = {
  BATCH_CREATED: 'Ghi nhận tạo lô mới',
  INSPECTION_RECORDED: 'Lưu kết quả kiểm định',
  WAREHOUSE_INTAKE: 'Lưu phiếu nhập kho',
  DISTRIBUTION_DISPATCHED: 'Lưu phiếu xuất bán',
};

export function getBatchStatusLabel(status) {
  return BATCH_STATUS_LABELS[status] || status || 'Chưa rõ';
}

export function getBatchStatusStyle(status) {
  return (
    BATCH_STATUS_STYLES[status] || 'border-slate-500/40 bg-slate-800/70 text-slate-200'
  );
}

export function getInspectionResultLabel(result) {
  return INSPECTION_RESULT_LABELS[result] || result || 'Chưa kiểm định';
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
