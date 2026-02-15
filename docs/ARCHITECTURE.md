# Architecture

## Monorepo
- `apps/api`:
  - Node.js + TypeScript + Fastify
  - Prisma + PostgreSQL
  - JWT auth + role-based access
- `apps/web`:
  - React + Vite + TypeScript
  - React Router + TanStack Query
- `infra/docker`:
  - `compose.dev.yml` (dev/hot reload)
  - `compose.yml` (prod-like; dodany w kolejnym kroku)

## Główne domeny
- auth:
  - `POST /auth/login`
  - `GET /me`
- courses:
  - `GET /courses`
  - `GET /courses/:id`
  - `POST /courses` (mentor/admin)
- sessions:
  - `GET /sessions`
  - `POST /sessions` (mentor/admin)
- bookings:
  - `POST /bookings` (student)
  - `GET /bookings/mine` (student)

## Security i role
Role:
- `admin`
- `mentor`
- `student`

Autoryzacja:
- JWT w nagłówku `Authorization: Bearer ...`
- middleware `authenticate` po stronie API

## BUG MODE
- backend: `BUGS`, `BUG_FLAGS`
- frontend: `VITE_BUGS`
- widok `/bugs` dostępny dla zalogowanego `mentor`/`admin`
- runtime API:
  - `GET /bugs/public-state`
  - `GET /internal/bugs`
  - `PUT /admin/bugs/state` (admin)

## Przepływ ruchu (dev)
1. Przeglądarka -> `web` (`http://localhost:8280`)
2. Vite proxy `/api/*` -> `api:8081`
3. API -> `db:5432`

## Operacja
Start dev:
```bash
docker compose -f infra/docker/compose.dev.yml up -d --build
```

Health:
```bash
curl -sSf http://localhost:8281/health
curl -I http://localhost:8280
```
