# Changelog

All notable changes to **NodusCore DX-OS** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-26

### Added
- Khởi tạo cấu trúc Monorepo chuẩn Open-Core cho **NodusCore DX-OS** (`core/`, `plugins/`, `apps/`, `docs/`).
- Cấu hình **Apache APISIX** (`3.9.1-debian`) chạy ở chế độ `standalone` (`config_provider: yaml`) không phụ thuộc `etcd`, kèm 3 route mẫu (`/health`, `/api/data/*`, `/api/workflow/*`).
- Khởi tạo `docker-compose.yml` tích hợp 6 dịch vụ lõi trên mạng `nodus-net`: PostgreSQL 16, Keycloak 25.0, Hasura GraphQL Engine v2.40.0, MinIO, n8n và Apache APISIX.
- Bổ sung `.env.example`, `.gitignore`, `README.md` và header bản quyền Apache-2.0 cho toàn bộ tệp cấu hình.
