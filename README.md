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

- Frontend (placeholder/static):
  1. cd frontend && npm install
  2. npm run start:static  # serves static placeholder (or run Next.js dev if configured)

CI (GitHub Actions):
- A workflow is provided at .github/workflows/smoke-tests.yml. On pull_request it installs backend deps, starts the backend using SQLite (npm run dev:sqlite), waits for /api/health, then runs the cart smoke test (npm run smoke:cart). The job stops the server afterward.
- Note: the workflow assumes a dev.sqlite3 file is present in the backend root. If you prefer runtime initialization, run backend/scripts/init_sqlite.js before starting the server; I can update the workflow to do this.

See session plan.md for design details and next steps.
