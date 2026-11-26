# NodusCore DX-OS
[![CI Pipeline](https://github.com/Matthew-dz/NodusCore/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/Matthew-dz/NodusCore/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Data License: ODbL 1.0 & CC-BY 4.0](https://img.shields.io/badge/Data_License-ODbL_%26_CC--BY_4.0-brightgreen.svg)](docs/DATA_LICENSES.md)
[![Database: PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16_pgcrypto-336791.svg)](core/postgres/)
[![Gateway: Apache APISIX](https://img.shields.io/badge/API_Gateway-Apache_APISIX_3.x-E43921.svg)](core/apisix/)

**NodusCore DX-OS** là nền tảng lõi mở (**Headless Open-Core Platform**) phục vụ bài toán **Quản lý Chuỗi cung ứng Nông sản & Truy xuất Nguồn gốc Bất biến theo Lô** dành cho Hội thi Olympic Tin học Sinh viên Việt Nam (Khối thi Phần mềm Nguồn mở - OLP 2026).

---

## 🏛️ Kiến trúc Hệ thống 2 Tầng (Two-Tier Open Architecture)

NodusCore áp dụng triệt để mô hình **Open-Core** kết hợp kiến trúc phân tầng Microservices để tách biệt hạ tầng kỹ thuật dùng chung và nghiệp vụ chuyên ngành:

```text
[ Trình duyệt / Web Portal ] (nodus-web: React + Tailwind CSS)
             │
             ▼ :9080
┌────────────────────────────────────────────────────────┐
│ Apache APISIX Gateway (Định tuyến, Auth & Rate-Limit)  │
└────────────┬─────────────────────────────┬─────────────┘
             │ :8080                       │ :8080
             ▼                             ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│  Hasura GraphQL Engine    │ │ Keycloak IAM / SSO       │
│  (Data APIs & Permissions)│ │ (OIDC / AgriTech Theme)  │
└────────────┬──────────────┘ └──────────────────────────┘
             │ :5432
             ▼
┌────────────────────────────────────────────────────────┐
│  PostgreSQL 16 Database + pgcrypto                     │
│  ├── Master Open Data (OSM Polygons & Đà Nẵng OpenData)│
│  └── Sổ cái Mật mã Niêm phong (SHA-256 Hash Chaining)  │
└────────────────────────────────────────────────────────┘
```

1. **Tầng 1 — Open-Core (`core/`)**: Hạ tầng lõi Headless độc lập nghiệp vụ:
   - **API Gateway**: Apache APISIX (chế độ Standalone định tuyến tập trung tại cổng `9080`).
   - **Identity & Access Management (IAM/SSO)**: Keycloak OIDC/PKCE với giao diện tùy biến phong cách AgriTech Glassmorphism.
   - **Data & GraphQL Engine**: Hasura GraphQL Engine + PostgreSQL 16 (`pgcrypto`).
   - **Cryptographic Audit Trail**: Sổ cái mật mã bất biến (Append-Only) móc xích chuỗi băm SHA-256 tự động niêm phong từng trạng thái lô hàng.
   - **Tự động hóa & Mở rộng**: n8n Workflow Automation và MinIO S3 Object Storage.
2. **Tầng 2 — Ứng dụng & Nghiệp vụ (`plugins/`, `apps/`)**:
   - `apps/nodus-web`: Ứng dụng Web (Bàn làm việc Nông hộ & Cổng tra cứu minh bạch công khai).
   - `plugins/`: Các module nghiệp vụ nông sản cắm-rút (quản lý vùng trồng, định ngạch sản lượng, kiểm định VietGAP).

---

## 📂 Cấu trúc Thư mục Dự án

```text
NodusCore/
├── .github/
│   └── workflows/
│       └── ci.yml             # Đường ống CI tự động (Docker Compose & Web build)
├── apps/
│   └── nodus-web/             # Frontend Single Page App (React + Tailwind CSS)
├── core/
│   ├── apisix/
│   │   └── apisix.yaml        # Cấu hình routes và upstreams của Apache APISIX
│   ├── keycloak/
│   │   ├── realm-export.json  # Realm nodus-core, roles (farmer, admin) và client
│   │   └── themes/nodus/      # Theme giao diện đăng nhập kính mờ (Glassmorphism)
│   ├── postgres/
│   │   ├── 01_init.sql        # Lược đồ bảng cơ sở (tenants, zones, batches)
│   │   ├── 02_audit_trail.sql # Sổ cái Mật mã SHA-256 & Trigger Poka-yoke chặn sửa/xóa
│   │   └── 04_alter_schema_real_data.sql # Mở rộng trường dữ liệu theo chuẩn TCCS & TCVN
│   └── scripts/
│       └── ingest_open_data.py # Script tự động kéo Dữ liệu Mở (OSM Overpass API & Đà Nẵng)
├── docs/
│   ├── ARCHITECTURE.md        # Thuyết minh kiến trúc chi tiết
│   ├── DATA_LICENSES.md       # Bằng chứng bản quyền Dữ liệu Mở (ODbL, CC-BY 4.0)
│   └── POF_GUIDE.md           # Kịch bản kiểm chứng tính năng cho Ban Giám khảo
├── setup_core.ps1             # Script một chạm tự động khởi tạo và nạp dữ liệu (Windows)
├── docker-compose.yml         # Hạ tầng 6 dịch vụ trên bridge network nodus-net
├── .env.example               # Mẫu tham số môi trường
├── CHANGELOG.md
└── LICENSE                    # Apache License 2.0
```

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy (Building from Source)

### Yêu cầu tiên quyết
- **Docker Engine** (>= 24.0) và **Docker Compose v2** (>= 2.20)
- **Node.js** (>= 20.x) & **npm** (để chạy Frontend)
- **Python** (>= 3.10) kèm thư viện `urllib` mặc định

### Bước 1: Tải mã nguồn & Chuẩn bị môi trường
```bash
git clone [https://github.com/Matthew-dz/NodusCore.git](https://github.com/Matthew-dz/NodusCore.git)
cd NodusCore
git checkout dev
cp .env.example .env
```

### Bước 2: Khởi động Cụm Hạ tầng Core
```bash
docker compose up -d
```

### Bước 3: Khởi tạo Dữ liệu & Cấu hình Tự động (Một chạm)
Chạy script tự động hóa để nạp migration, gọi API kéo dữ liệu ranh giới vệ tinh thực tế và cấp quyền Hasura GraphQL:

*Trên Windows PowerShell:*
```powershell
.\setup_core.ps1
```

*Trên Linux / macOS:*
```bash
# Nạp DDL và Sổ cái Mật mã
docker compose exec -T postgres psql -U postgres -d nodus_db < core/postgres/02_audit_trail.sql
docker compose exec -T postgres psql -U postgres -d nodus_db < core/postgres/04_alter_schema_real_data.sql

# Kéo Dữ liệu Mở thực tế từ OpenStreetMap API
python3 core/scripts/ingest_open_data.py

# Khởi động lại Hasura
docker compose restart hasura
```

### Bước 4: Khởi chạy Ứng dụng Web
```bash
cd apps/nodus-web
npm install
npm run dev
```

---

## 🧭 Bảng Ánh xạ Cổng & Dịch vụ

| Dịch vụ | Địa chỉ truy cập | Tài khoản mặc định | Mô tả chức năng |
| :--- | :--- | :--- | :--- |
| **Bàn làm việc Nông hộ** | `http://localhost:3000` | OIDC Login qua Keycloak | Tạo lô hàng, xem chuỗi băm, in mã QR |
| **Tra cứu Công khai** | `http://localhost:3000/trace/TR-HOANHON-2026` | Không yêu cầu đăng nhập | Cổng đối soát minh bạch chuỗi cung ứng |
| **API Gateway (APISIX)** | `http://localhost:9080` | Header: `X-API-KEY` | Điểm tiếp nhận API tập trung của toàn hệ thống |
| **Hasura GraphQL Engine** | `http://localhost:8082` | Secret trong `.env` | Trình quản trị GraphQL Schema & Phân quyền |
| **Keycloak IAM Admin** | `http://localhost:8081` | `admin` / `admin` | Quản trị Realm `nodus-core`, User & Theme |
| **MinIO Storage Console** | `http://localhost:9001` | `minioadmin` / `minioadmin` | Quản lý chứng từ VietGAP & file đính kèm |
| **n8n Automation** | `http://localhost:5678` | Đăng ký tài khoản nội bộ | Workflow xử lý bất đồng bộ và Webhook |

---

## 🧪 Kịch bản Kiểm chứng Tính năng (Proof of Functionality - PoF)

Dành cho Ban Giám khảo thẩm định trực tiếp tính toàn vẹn của hệ thống:

### 1. Kiểm chứng Cơ chế Mật mã Niêm phong (SHA-256 Hash Chaining)
Kiểm tra tính liên kết bất biến giữa khối khởi nguyên (Genesis Block) và khối kế tiếp:
```bash
docker compose exec postgres psql -U postgres -d nodus_db -c "
SELECT id, event_type, prev_hash, current_hash, created_at 
FROM batch_audit_trail 
ORDER BY created_at ASC;"
```
*Kết quả thẩm định:* Khối 1 có `prev_hash` gồm 64 số `0`. Khối 2 có `prev_hash` trùng khớp 100% với `current_hash` của khối 1.

### 2. Kiểm chứng Rào chắn Poka-yoke Append-Only
Thử nghiệm can thiệp trái phép hoặc xóa lịch sử lô hàng:
```bash
docker compose exec postgres psql -U postgres -d nodus_db -c "DELETE FROM batch_audit_trail;"
```
*Kết quả thẩm định:* PostgreSQL kích hoạt trigger và chặn đứng giao dịch:
`ERROR: Poka-yoke violation: batch_audit_trail is immutable (append-only); DELETE operations are strictly forbidden.`

---

## 🌐 Công bố Dữ liệu Mở & Bản quyền (Open Data Provenance)

NodusCore DX-OS tuân thủ nguyên tắc không sử dụng dữ liệu giả lập (mock data); 100% dữ liệu thực nghiệm ban đầu được thu thập từ các nguồn Dữ liệu Mở hợp pháp:

* **Tọa độ & Ranh giới Vùng trồng:** © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) — Giấy phép **Open Data Commons Open Database License (ODbL 1.0)**. Trích xuất tự động qua Overpass API tại Xã Hòa Nhơn, Huyện Hòa Vang, TP. Đà Nẵng.
* **Danh bạ Hợp tác xã Nông nghiệp:** Khai thác từ [Cổng Dữ liệu Mở TP. Đà Nẵng](https://opendata.danang.gov.vn) — Giấy phép **Creative Commons Attribution 4.0 International (CC-BY 4.0)**. Định danh: Hợp tác xã Dịch vụ Nông nghiệp Hòa Nhơn (MST: `0401764614`).
* **Tiêu chuẩn Kỹ thuật:** Mã số vùng trồng (PUC) theo quy chuẩn **TCCS 774:2020/BVTV** và quy trình canh tác VietGAP theo chuẩn quốc gia **TCVN 11892-1:2017**.
* *Đặc tả pháp lý chi tiết và kịch bản đối soát xem tại [docs/DATA_LICENSES.md](docs/DATA_LICENSES.md).*

---

## 📄 Giấy phép Mã nguồn (Source Code License)

Toàn bộ mã nguồn nền tảng NodusCore DX-OS được phát hành theo giấy phép chuẩn nguồn mở **Apache License, Version 2.0**. Xem chi tiết tại tệp [LICENSE](LICENSE).