# NodusCore DX-OS

**NodusCore DX-OS** là nền tảng lõi kiến trúc mở (**Headless Open-Core Platform**) được thiết kế cho bài toán **Chuỗi cung ứng nông sản & Truy xuất nguồn gốc theo lô** (OLP Phần mềm Nguồn mở 2026).

---

## Kiến trúc 2 tầng (Two-Tier Architecture)

1. **Tầng 1 — Open-Core (`core/`)**: Cung cấp hạ tầng lõi headless, độc lập nghiệp vụ, gồm:
   - **API Gateway**: Apache APISIX (chế độ `standalone` YAML, định tuyến tập trung tại cổng `9080`).
   - **Identity & Access Management (IAM/SSO)**: Keycloak.
   - **Data & GraphQL Engine**: PostgreSQL + Hasura GraphQL Engine.
   - **Object Storage**: MinIO (tương thích S3 cho chứng từ, ảnh lô hàng, QR).
   - **Workflow Automation**: n8n (tự động hóa quy trình nghiệp vụ và webhook).
2. **Tầng 2 — Plugins & Apps (`plugins/`, `apps/`)**:
   - `plugins/`: Các module nghiệp vụ nông sản cắm-rút (nông hộ, vùng trồng, lô sản xuất, nhật ký canh tác, kiểm định).
   - `apps/`: Các ứng dụng Frontend (Web Portal, Mobile/PWA) giao tiếp qua API Gateway.

---

## Cấu trúc thư mục

```text
NodusCore/
├── core/
│   ├── apisix/         # Cấu hình Apache APISIX (standalone)
│   ├── keycloak/       # Cấu hình Realm / IAM
│   └── n8n/            # Cấu hình Workflow mẫu
├── plugins/            # Module nghiệp vụ nông sản (cắm-rút)
├── apps/               # Ứng dụng Frontend Tầng 2
├── docs/               # Tài liệu kiến trúc & API
├── docker-compose.yml  # Hạ tầng 6 container trên mạng nodus-net
├── .env.example        # Biến môi trường mẫu
├── CHANGELOG.md
└── LICENSE             # Apache License 2.0
```

---

## Hướng dẫn cài đặt & chạy từ mã nguồn (Building From Source)

### Yêu cầu tiên quyết
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose v2](https://docs.docker.com/compose/install/)

### Các bước khởi chạy

1. **Clone mã nguồn**:
   ```bash
   git clone <repository-url>
   cd NodusCore
   ```

2. **Cấu hình biến môi trường**:
   ```bash
   cp .env.example .env
   ```
   *(Chỉnh sửa mật khẩu và khóa bí mật trong `.env` trước khi chạy môi trường thực tế.)*

3. **Khởi chạy toàn bộ hệ thống lõi**:
   ```bash
   docker compose up -d
   ```

4. **Kiểm tra trạng thái**:
   - API Gateway Health Check: `http://localhost:9080/health`
   - Hasura Console: `http://localhost:8082`
   - Keycloak Admin Console: `http://localhost:8081`
   - MinIO Console: `http://localhost:9001` (S3 API: `http://localhost:9000`)
   - n8n Workflow Editor: `http://localhost:5678`

---

## Giấy phép

Phát hành theo giấy phép **Apache License, Version 2.0**. Xem chi tiết tại [LICENSE](LICENSE).
