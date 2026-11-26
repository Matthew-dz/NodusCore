<!-- Copyright 2026 NodusCore Team. Licensed under the Apache License, Version 2.0. -->
# NodusCore DX-OS — Web Portal (`apps/nodus-web`)

Ứng dụng Single Page App (SPA) sử dụng **Vite + React + Tailwind CSS** và tích hợp xác thực SSO qua **Keycloak (`keycloak-js`)** cho nền tảng NodusCore DX-OS.

## 1. Yêu cầu môi trường

- Node.js >= 18 và npm
- Cụm dịch vụ lõi ở thư mục gốc repository đang chạy (`docker compose up -d`), đặc biệt là Keycloak (`http://localhost:8081`, Realm `nodus-core`).

## 2. Cấu hình biến môi trường

Sao chép file mẫu nếu cần ghi đè endpoint mặc định:

```bash
cp .env.example .env
```

Các biến mặc định trong `.env.example`:
- `VITE_API_GATEWAY=http://localhost:9080`
- `VITE_KEYCLOAK_URL=http://localhost:8081`
- `VITE_KEYCLOAK_REALM=nodus-core`
- `VITE_KEYCLOAK_CLIENT_ID=nodus-frontend`

## 3. Cài đặt & Chạy

Chạy các lệnh sau từ thư mục `apps/nodus-web/`:

```bash
npm ci
npm run dev
```

Ứng dụng chạy mặc định tại `http://localhost:3000`.

Build kiểm tra production bundle:

```bash
npm run build
```

## 4. Kiểm thử luồng KHOA-01 (Keycloak SSO)

1. Đảm bảo Keycloak đang hoạt động tại `http://localhost:8081` và realm `nodus-core` đã import từ `core/keycloak/realm-export.json`.
2. Mở `http://localhost:3000`:
   - Khi Keycloak chưa chạy: giao diện hiển thị thẻ lỗi kết nối SSO và nút **Thử kết nối lại** (không crash, không trắng trang).
   - Khi Keycloak đã chạy: bấm **Đăng nhập Keycloak SSO**, đăng nhập với `farmer_demo` / `password123`.
3. Sau khi quay về ứng dụng:
   - Navbar hiển thị `farmer_demo`, badge vai trò **Nông hộ (farmer)**, `tenant_id: htx-danang` và nút **Đăng xuất**.
   - Nếu tài khoản không có vai trò hợp lệ trong `realm_access.roles`, giao diện hiển thị trạng thái **Chưa xác định vai trò** thay vì tự gán vai trò mặc định.
   - Bấm **Đăng xuất** để kết thúc phiên Keycloak và quay về trạng thái chưa đăng nhập.
