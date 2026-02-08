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

## BUG MODE
- backend: `BUGS=on|off` + `BUG_FLAGS=...`
- frontend: `VITE_BUGS=on|off`
- ukryta strona: `/bugs` (tylko gdy `VITE_BUGS=on`)

Szczegóły: `docs/BUGS.md`

## Dokumentacja
- `docs/ARCHITECTURE.md`
- `docs/TRAINING_PATHS.md`
- `docs/BUGS.md`
