# E-commerce B2C Platform (Scaffold)

This repository contains a starter scaffold for a B2C e-commerce platform (MVP-first).

Structure:
- frontend/ — Next.js + TypeScript + Tailwind CSS
- backend/ — Express + TypeScript API
- docker-compose.yml — dev compose for frontend & backend (Postgres)

Quick start (local dev, from project root):
- Backend (SQLite fallback, recommended for immediate testing):
  1. cd backend && npm install
  2. npm run dev:sqlite    # starts API using dev.sqlite3 (forces SQLITE_PATH)
  3. npm run smoke:cart    # runs automated cart CRUD smoke test against the running server
  4. npm run smoke:order   # runs checkout/order/cancel smoke flow
  5. npm run smoke:payment # runs payment sandbox callback smoke flow

- Frontend (placeholder/static):
  1. cd frontend && npm install
  2. npm run start:static  # serves static placeholder (or run Next.js dev if configured)

CI (GitHub Actions):
- A workflow is provided at .github/workflows/smoke-tests.yml. On pull_request it installs backend deps, prepares the DB, starts the backend, then runs smoke tests for cart/order/payment (npm run smoke:cart/order/payment). The job stops the server afterward.

- CI uses an in-memory DB fallback for the cart endpoints to avoid native sqlite native-module issues on hosted runners. This behavior is enabled explicitly in the workflow by setting USE_FAKE_DB=1 when starting the backend container or process.
  - Differences from local SQLite:
    - In-memory DB does not persist data between runs (no dev.sqlite3 is read/written during CI cart tests).
    - It is intended only for fast smoke tests (POST/GET/PATCH/DELETE flows); it does not fully emulate SQL constraints or inventory logic.
    - Production and local development should continue to use PostgreSQL or the SQLite fallback for realistic behavior.
- If you prefer CI to initialize and use a file-backed SQLite DB instead, update the workflow to run backend/scripts/init_sqlite.js and start the server without USE_FAKE_DB; note GitHub hosted runners may still hit native binary compatibility issues with better-sqlite3.

- PostgreSQL CI strategy decision:
  - Keep pull_request CI fast and stable with USE_FAKE_DB=1 smoke tests as the default gate.
  - Run PostgreSQL-backed integration tests as a separate non-blocking workflow (manual/scheduled), to avoid flaky native sqlite issues while still validating real SQL behavior on a regular cadence.

Payment integration (sandbox + real):
- `POST /api/payments/create` now supports:
  - `PAYMENT_PROVIDER_MODE=sandbox` (default): returns sandbox payment URL.
  - `PAYMENT_PROVIDER_MODE=real`: signs and prepares real gateway payment requests.
- Provider callbacks:
  - Alipay callback: `POST /api/payments/notify/alipay`
  - WeChat Pay callback: `POST /api/payments/notify/wechat`
  - Generic callback for local tests: `POST /api/payments/notify`

Required env vars for real mode:
- Alipay:
  - `ALIPAY_APP_ID`
  - `ALIPAY_PRIVATE_KEY` (PEM, supports `\\n`)
  - `ALIPAY_PUBLIC_KEY` (for callback verify; can set `ALIPAY_NOTIFY_SKIP_VERIFY=1` for non-production debug)
  - `ALIPAY_NOTIFY_URL`
  - Optional: `ALIPAY_RETURN_URL`, `ALIPAY_GATEWAY_URL`
- WeChat Pay v3:
  - `WECHAT_APP_ID`
  - `WECHAT_MCH_ID`
  - `WECHAT_SERIAL_NO`
  - `WECHAT_PRIVATE_KEY` (PEM, supports `\\n`)
  - `WECHAT_NOTIFY_URL`
  - `WECHAT_API_V3_KEY` (used to decrypt callback resource payload)
  - Optional: `WECHAT_API_BASE_URL` (default `https://api.mch.weixin.qq.com`)

Notes:
- For production, callback signature verification should be strictly enabled with official platform keys/certs.
- The current implementation updates order/payment status in DB after successful provider callback handling.

See session plan.md for design details and next steps.