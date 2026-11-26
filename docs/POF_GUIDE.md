# NodusCore DX-OS — Hướng dẫn Kiểm chứng Tính năng (Proof of Functionality - PoF Guide)

Tài liệu này cung cấp kịch bản **Live Demo** cho Ban Giám khảo (OLP Phần mềm Nguồn mở 2026) để kiểm chứng trực tiếp kiến trúc **Open-Core Tầng 1** của **NodusCore DX-OS**.

---

## 1. Kiểm tra Gateway Health, Routing & CORS (`APISIX :9080`)

Kiểm tra sức khỏe API Gateway ở chế độ `standalone`:

```bash
curl -i http://localhost:9080/health
```

**Kỳ vọng:** `HTTP/1.1 200 OK`
```json
{"status": "UP", "gateway": "Apache APISIX", "engine": "NodusCore DX-OS"}
```

Truy vấn lô hàng mẫu **`LOT-HOANHON-001`** qua cổng Public Allowlist (`/api/trace/*`, không cần Bearer Token):

```bash
curl -s -X POST http://localhost:9080/api/trace/test \
  -H "Content-Type: application/json" \
  -d '{"query":"{ batches(where: {batch_code: {_eq: \"LOT-HOANHON-001\"}}) { id batch_code public_trace_key product_name status } }"}'
```

---

## 2. Kiểm chứng Chống Spam / DDoS Quét QR (Rate Limiting `429`)

Route `/api/trace/*` được bảo vệ bởi plugin `limit-count` (tối đa **60 requests / 60 giây** theo `remote_addr`). Chạy vòng lặp 65 requests liên tiếp bằng PowerShell:

```powershell
1..65 | ForEach-Object {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:9080/api/trace/test" -Method Post -ContentType "application/json" -Body '{"query":"{ batches(limit:1) { batch_code } }"}' -UseBasicParsing
    "Req $_ -> $($r.StatusCode)"
  } catch {
    "Req $_ -> $($_.Exception.Response.StatusCode.value__)"
  }
}
```

**Kỳ vọng:** 60 request đầu trả về `200`, từ request thứ 61 trở đi APISIX tự động chặn và trả về **`429` (`Too Many Requests`)**.

---

## 3. Kiểm chứng Sổ cái Mật mã SHA-256 Hash Chaining

Chạy SQL trên database tạm (hoặc database tích hợp `02_audit_trail.sql`) để chứng minh Genesis Block có `prev_hash` là **64 số `0`** và bản ghi tiếp theo kế thừa chính xác `current_hash` của bản ghi trước:

```powershell
docker compose exec postgres psql -U nodus_admin -d nodus_core -c "CREATE DATABASE pof_audit_demo;"
Get-Content core\postgres\02_audit_trail.sql -Raw | docker compose exec -T postgres psql -U nodus_admin -d pof_audit_demo -v ON_ERROR_STOP=1

@"
INSERT INTO batch_audit_trail (batch_id, event_type, actor_id, payload)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HARVESTED', 'farmer_demo', '{"weight_kg": 500}');

INSERT INTO batch_audit_trail (batch_id, event_type, actor_id, payload)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'INSPECTED', 'inspector_demo', '{"passed": true}');

SELECT event_type, prev_hash, current_hash FROM batch_audit_trail ORDER BY created_at ASC;
"@ | docker compose exec -T postgres psql -U nodus_admin -d pof_audit_demo
```

---

## 4. Kiểm chứng Rào chắn Poka-yoke Bất biến (Append-Only)

Thử thực hiện `DELETE` hoặc `UPDATE` trên bảng `batch_audit_trail`:

```powershell
docker compose exec postgres psql -U nodus_admin -d pof_audit_demo -c "DELETE FROM batch_audit_trail;"
docker compose exec postgres psql -U nodus_admin -d nodus_core -c "DROP DATABASE pof_audit_demo;"
```

**Kỳ vọng:** PostgreSQL Trigger `trg_batch_audit_trail_append_only` chặn đứng và báo lỗi:
```text
ERROR:  Poka-yoke violation: batch_audit_trail is immutable (append-only); DELETE operations are strictly forbidden.
```

---

## 5. Kiểm chứng Dữ liệu Mở Thực tế (Open Data Provenance)

Đối soát bản ghi **Hợp tác xã Dịch vụ Nông nghiệp Hòa Nhơn** (Mã số doanh nghiệp **`0401764614`**) và mã **`osm_id`** từ OpenStreetMap trong PostgreSQL:

```powershell
docker compose exec postgres psql -U nodus_admin -d nodus_core -c "
SELECT t.code, t.name, t.tax_code, z.puc_code, z.metadata->>'osm_id' AS osm_id, z.metadata->>'license' AS geo_license
FROM tenants t
JOIN production_zones z ON z.tenant_id = t.id
WHERE t.tax_code = '0401764614';
"
```

*(Xem thêm chi tiết giấy phép ODbL 1.0 & CC-BY 4.0 tại [docs/DATA_LICENSES.md](DATA_LICENSES.md).)*

---

## 6. Kết quả Nghiệm thu Thực tế (Verified PoF Benchmark)

Các kiểm thử tự động trên môi trường Docker Open-Core đã xác nhận:

- **APISIX Health:** `GET http://localhost:9080/health` trả về **HTTP 200** (`{"status":"UP","gateway":"Apache APISIX","engine":"NodusCore DX-OS"}`).
- **Rate Limiter:** Chặn chính xác từ request thứ 61 (**HTTP 429 Too Many Requests**) trên tuyến `/api/trace/*` (`limit-count`: 60 req/60s).
- **MinIO Object Storage:** Bucket `nodus-batches` được container `nodus-minio-init` khởi tạo tự động với quyền `download` công khai cho ảnh QR và chứng nhận.
- **n8n Automation Pipeline:** Webhook `/webhook/new-batch` kích hoạt quy trình sinh QR, lưu tệp `qr_LOT-HOANHON-001.png` (**572 bytes**, `HTTP 200`) lên MinIO và ghi nhận sự kiện `QR_GENERATED` vào sổ cái mật mã SHA-256.

