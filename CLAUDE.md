# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QualityCat Academy — a test automation training platform for QA engineers. Features full CRUD API, rich interactive UI with `data-testid` attributes, and 18 intentional toggleable bugs (easy/medium/hard) for teaching test automation. Monorepo with React frontend (`apps/web`) and Fastify API backend (`apps/api`).

## Tech Stack

- **Backend**: Fastify 5, Prisma 6, PostgreSQL 16, TypeScript, JWT auth, `@fastify/multipart` (uploads)
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

No linter or test runner is configured (by design — this is a platform for learning test automation).

## Workflow

After every set of changes, create a git commit and push to remote.

## Architecture

Two independent apps (no monorepo tooling, separate `package.json` files), orchestrated via Docker Compose.

### Backend (`apps/api`)

Modular route architecture using Fastify plugins:

- `src/index.ts` — app bootstrap, plugin registration (~100 lines)
- `src/routes/auth.routes.ts` — login, register, profile (prefix: `/auth`)
- `src/routes/courses.routes.ts` — full CRUD + search + reviews (prefix: `/courses`)
- `src/routes/sessions.routes.ts` — full CRUD with filters (prefix: `/sessions`)
- `src/routes/bookings.routes.ts` — create, list, cancel, delete (prefix: `/bookings`)
- `src/routes/users.routes.ts` — admin user management (prefix: `/users`)
- `src/routes/uploads.routes.ts` — file upload/serve (prefix: `/uploads`)
- `src/routes/admin.routes.ts` — DB reset, bug toggles (prefix: `/admin`)
- `src/routes/bugs.routes.ts` — bug state endpoints (no prefix)
- `src/routes/system.routes.ts` — health, api-docs (no prefix)
- `src/lib/` — shared modules: `errors.ts`, `auth.ts`, `pagination.ts`, `bugs.ts`, `baseline.ts`
- `src/types/shared.ts` — shared types and helpers

### Frontend (`apps/web`)

- `src/App.tsx` — routing (14 routes) and bug state polling
- `src/components/ui/` — 13 reusable UI components (Modal, DataTable, Pagination, SearchBar, Tabs, Badge, etc.)
- `src/pages/` — 12 page components
- `src/lib/` — types, http client, auth, bugs, datetime

Vite proxies `/api/*` → `http://api:8081` in dev.

### Data Model (6 models)

`apps/api/prisma/schema.prisma`: User (with name/bio/avatar), Course (with level/duration/image/published), Session (with location/description), Booking, Review, Upload. Enums: UserRole, BookingStatus, CourseLevel.

**Roles**: ADMIN, MENTOR, STUDENT — role-based guards in both API and frontend.

## API Endpoints (~40 total)

| Domain | Methods | Key features |
|--------|---------|-------------|
| Auth | POST login/register, GET/PATCH me | JWT, registration, profile |
| Courses | GET/POST/PUT/PATCH/DELETE, GET search, reviews CRUD | Pagination, filters, search, level |
| Sessions | GET/POST/PUT/PATCH/DELETE | Filters, capacity validation |
| Bookings | GET/POST/PATCH/DELETE, GET mine | Cancel, race condition bug |
| Users | GET/PATCH/DELETE | Admin management |
| Uploads | POST/GET | Image upload with MIME validation |
| Admin | PUT bugs/state, POST reset-database | Granular bug toggles |

Swagger UI at `/api-docs`.

## Bug Mode System (18 bugs)

Bugs toggleable at runtime via `PUT /admin/bugs/state`. Each has difficulty level and category metadata.

**Backend bugs (10):**

| Difficulty | Flag | Description |
|-----------|------|-------------|
| Easy | `BUG_AUTH_WRONG_STATUS` | 403 instead of 401 |
| Easy | `BUG_COURSES_MISSING_FIELD` | Omits description from list |
| Easy | `BUG_SESSIONS_WRONG_SORT` | Flips sort order |
| Medium | `BUG_PAGINATION_MIXED_BASE` | Wrong offset calculation |
| Medium | `BUG_BOOKINGS_LEAK` | Returns all users' bookings |
| Medium | `BUG_SEARCH_WRONG_RESULTS` | Case-sensitive search |
| Medium | `BUG_PAGINATION_MISSING_META` | Omits totalPages |
| Hard | `BUG_BOOKINGS_RACE` | No serializable transaction |
| Hard | `BUG_NPLUS1_COURSES` | N+1 queries |
| Hard | `BUG_FILE_UPLOAD_NO_MIME_CHECK` | No MIME validation |

**Frontend bugs (8):**

| Difficulty | Flag | Description |
|-----------|------|-------------|
| Easy | `FE_BUG_DOUBLE_SUBMIT` | Double mutation call |
| Easy | `FE_BUG_WRONG_ERROR_MSG` | Wrong 500 error message |
| Easy | `FE_BUG_FORM_NO_VALIDATION` | Submit not disabled on errors |
| Medium | `FE_BUG_TIMEZONE_OFFSET` | Dates +1h |
| Medium | `FE_BUG_STALE_CACHE` | Infinite staleTime |
| Medium | `FE_BUG_PAGINATION_OFF_BY_ONE` | Wrong page number |
| Medium | `FE_BUG_MODAL_NO_CLOSE_ON_ESC` | Modal ignores ESC |
| Hard | `FE_BUG_XSS_COURSE_DESC` | dangerouslySetInnerHTML |

Bug definitions with metadata: `apps/api/src/lib/bugs.ts` (backend), `apps/web/src/lib/bugs.ts` (frontend).

## Test Automation Features

**data-testid convention** — every interactive element has a `data-testid`:
- Pages: `page-{name}`, Forms: `form-{name}`, Inputs: `input-{name}`
- Buttons: `btn-{action}`, Tables: `table-{name}`, Rows: `row-{id}`
- Modals: `modal-{name}`, Pagination: `pagination-prev/next/page-{n}`
- Navigation: `nav-link-{name}`, `nav-logout`, `nav-hamburger`

**UI components for E2E testing**: DataTable (sortable columns), Pagination, Modal, ConfirmDialog, SearchBar, Tabs, Badge, FileUpload, Select, Stepper, Breadcrumbs, Spinner, EmptyState.

## Test Accounts

All passwords follow pattern `<role>123`:
- `admin@qualitycat.academy` / `mentor@qualitycat.academy` / `student@qualitycat.academy`
- `mentor2@qualitycat.academy` / `student2@qualitycat.academy` / `student3@qualitycat.academy`

## Seed Data

6 users, 10 courses (varied levels), 20 sessions, 15 bookings, 8 reviews. Enough for pagination testing (2+ pages at limit=6).
