# qualitycat-academy

Monorepo do szkoleń i mentoringu (API + Web) z kontrolowanym BUG MODE.

## Quickstart (Dev)
1. Skopiuj środowisko:
   ```bash
   cp infra/docker/env.example infra/docker/.env
   ```
2. Uruchom dev stack:
   ```bash
   docker compose -f infra/docker/compose.dev.yml up -d --build
   ```
3. Sprawdź działanie:
   ```bash
   curl -sSf http://localhost:8281/health
   curl -I http://localhost:8280
   ```

Porty dev:
- web: `8280`
- api: `8281`
- db: `5532`

Compose project name: `academy-dev`

## Quickstart (Prod-like)
```bash
docker compose -f infra/docker/compose.yml up -d --build
```

Compose project name: `academy-prod`

`academy-prod` uruchamia automatycznie:
- migracje DB (`api-migrate`)
- bootstrap seed przy pustej bazie (`api-bootstrap`)
- cotygodniowy reset danych do baseline (`niedziela 22:00`, konfigurowalny ENV)

## API Docs
- Swagger UI (Try it out): `http://localhost:8281/api-docs`
- OpenAPI JSON: `http://localhost:8281/api-docs.json`
- przez Traefik (prod-like): `http://academy.qualitycat.com.pl/api/api-docs`

## Konta testowe (seed)
- admin: `admin@qualitycat.academy` / `admin123`
- mentor: `mentor@qualitycat.academy` / `mentor123`
- student: `student@qualitycat.academy` / `student123`

## Admin Reset DB
- endpoint: `POST /admin/reset-database` (tylko `admin`)
- body: `{ "confirmation": "RESET" }`
- UI: `/admin` (widoczne tylko dla zalogowanego admina)
- po resecie wymagane jest ponowne logowanie

## BUG MODE
- backend: `BUGS=on|off` + `BUG_FLAGS=...`
- frontend: `VITE_BUGS=on|off`
- ukryta strona: `/bugs` (tylko gdy `VITE_BUGS=on`)

Szczegóły: `docs/BUGS.md`

## Dokumentacja
- `docs/ARCHITECTURE.md`
- `docs/TRAINING_PATHS.md`
- `docs/BUGS.md`
