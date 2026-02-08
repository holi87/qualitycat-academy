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
   curl -sSf http://localhost:8281/health
   curl -I http://localhost:8280
   ```

Porty:
- web: `8280`
- api: `8281`
- db: `5532`
