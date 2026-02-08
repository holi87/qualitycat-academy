# qualitycat-academy

## Quickstart (Docker)

1. Sklonuj repo i przejdź do katalogu projektu.
2. Skopiuj plik środowiskowy:
   ```bash
   cp infra/docker/env.example infra/docker/.env
   ```
3. Uruchom usługi:
   ```bash
   docker compose -f infra/docker/compose.dev.yml up -d --build
   ```
4. Sprawdź działanie:
   ```bash
   curl -sSf http://localhost:18081/health
   curl -I http://localhost:18080
   ```

Porty:
- web: `18080`
- api: `18081`
- db: `15432`
