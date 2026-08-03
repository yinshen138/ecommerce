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

See session plan.md for design details and next steps.