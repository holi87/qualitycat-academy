# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QualityCat Academy — a training/mentoring platform for teaching QA and testing. It features intentional, toggleable bugs for educational purposes. Monorepo with two apps: React frontend (`apps/web`) and Fastify API backend (`apps/api`).

## Tech Stack

- **Backend**: Fastify 5, Prisma 6, PostgreSQL 16, TypeScript, JWT auth
- **Frontend**: React 18, Vite 5, TanStack Query, React Router 6, TypeScript
- **Infra**: Docker Compose (dev + prod), Nginx (prod web serving), Traefik (prod proxy)
- **CI/CD**: GitHub Actions → GHCR (multi-arch Docker images)
- **Node**: >=22 required

## Development Commands

```bash
# Start dev environment
cp infra/docker/env.example infra/docker/.env
docker compose -f infra/docker/compose.dev.yml up -d --build

# Verify services
curl -sSf http://localhost:8281/health    # API
curl -I http://localhost:8280             # Web

# Database operations (inside api container)
docker compose -f infra/docker/compose.dev.yml exec -T api npm run db:migrate
docker compose -f infra/docker/compose.dev.yml exec -T api npm run db:seed

# Production-like stack (auto-migrates + bootstraps)
docker compose -f infra/docker/compose.yml up -d --build
```

**Dev ports**: Web 8280, API 8281, PostgreSQL 5532

**API scripts** (`apps/api`): `dev` (tsx watch), `build` (tsc), `start`, `db:migrate`, `db:seed`, `db:bootstrap`
**Web scripts** (`apps/web`): `dev` (vite), `build` (tsc + vite build), `preview`

No linter or test runner is configured.

## Architecture

Two independent apps (no monorepo tooling, separate `package.json` files), orchestrated via Docker Compose.

**API** (`apps/api/src/index.ts`): Single-file Fastify server with all routes. Auth via `@fastify/jwt`. Prisma ORM for DB access. Swagger at `/api-docs`.

**Web** (`apps/web`): Vite proxies `/api/*` → `http://api:8081` in dev (stripping the `/api` prefix). Pages: Login, Courses, CourseDetails, Sessions, MyBookings, Admin, Bugs.

**Roles**: ADMIN, MENTOR, STUDENT — role-based route guards in both API and frontend.

**Data model** (Prisma schema at `apps/api/prisma/schema.prisma`): User → Session (as mentor), Course → Session, Session → Booking ← User (as student). Booking has unique constraint on (sessionId, userId).

## Bug Mode System

Core educational feature. Bugs can be toggled at runtime without restart.

**Backend bugs** (`BUGS=on` + `BUG_FLAGS` env var, runtime toggle via `PUT /admin/bugs/state`):
- `BUG_AUTH_WRONG_STATUS` — 403 instead of 401
- `BUG_BOOKINGS_LEAK` — returns all users' bookings
- `BUG_BOOKINGS_RACE` — no serializable transaction + artificial delay
- `BUG_PAGINATION_MIXED_BASE` — wrong offset calculation
- `BUG_NPLUS1_COURSES` — N+1 queries on course list

**Frontend bugs** (`VITE_BUGS=on`, runtime state from `/bugs/public-state`):
- Double submit, stale cache, timezone offset +1h, wrong error messages

Bug mode logic: `apps/api/src/lib/bugs.ts` (backend), `apps/web/src/lib/bugs.ts` (frontend).

## Test Accounts

All passwords follow pattern `<role>123` (e.g., `admin123`):
- `admin@qualitycat.academy` / `mentor@qualitycat.academy` / `student@qualitycat.academy`

## Key Files

- `apps/api/src/index.ts` — all API routes and middleware
- `apps/api/prisma/schema.prisma` — database schema
- `apps/api/src/lib/baseline.ts` — database reset logic
- `apps/web/src/App.tsx` — routing and bug state polling
- `apps/web/src/lib/auth.ts` — token storage and role extraction
- `apps/web/src/lib/http.ts` — API client wrapper
- `infra/docker/compose.dev.yml` — dev stack definition
- `infra/docker/env.example` — all environment variables
