# BUG MODE

## Cel
Projekt ma kontrolowany tryb błędów do ćwiczeń debuggingu i review.

## Backend
Włączenie trybu:
- `BUGS=on`

Flagi backendu (zmienna `BUG_FLAGS`):
- `BUG_AUTH_WRONG_STATUS`:
  - błędne statusy auth (`401` zamienione na `403`)
- `BUG_BOOKINGS_LEAK`:
  - `/bookings/mine` zwraca bookingi wszystkich użytkowników
- `BUG_BOOKINGS_RACE`:
  - bookingi wykonywane bez serializable transaction + opóźnienie zwiększające ryzyko race condition
- `BUG_PAGINATION_MIXED_BASE`:
  - błędne obliczanie `skip` (`page * limit`)
- `BUG_NPLUS1_COURSES`:
  - dodatkowe zapytania per kurs przy liście kursów

Przykład:
```env
BUGS=on
BUG_FLAGS=BUG_AUTH_WRONG_STATUS=true,BUG_BOOKINGS_LEAK=false,BUG_BOOKINGS_RACE=false,BUG_PAGINATION_MIXED_BASE=false,BUG_NPLUS1_COURSES=false
```

Endpointy debug:
- `GET /__debug/flags` tylko gdy `BUGS=on`
- `GET /internal/bugs` dla `mentor/admin`

## Frontend
Włączenie:
- runtime: `PUT /admin/bugs/state` z `{"frontendBugs": true}`
- opcjonalny stan startowy: `VITE_BUGS=on` lub `FRONTEND_BUGS=on`

Bugi UI:
- double submit:
  - podwójne wywołanie login/rezerwacji
- stale cache:
  - bardzo długi `staleTime`, mniej odświeżania
- timezone +1h:
  - daty renderowane z przesunięciem +1h
- błędny komunikat 500:
  - dla HTTP 500 pokazywany tekst jak dla błędnego logowania

## Szybkie uruchomienie
```bash
docker compose -f infra/docker/compose.dev.yml up -d --build
curl -sSf http://localhost:8281/health
curl -I http://localhost:8280
```

## Runtime toggle (bez restartu)
Od tej wersji bugi można przełączać w runtime, bez restartu kontenerów.

- publiczny podgląd stanu dla web UI:
  - `GET /bugs/public-state`
- pełny podgląd flag (mentor/admin):
  - `GET /internal/bugs`
- zmiana stanu (admin):
  - `PUT /admin/bugs/state`
  - body (przykład):
    ```json
    {
      "backendBugs": true,
      "frontendBugs": true
    }
    ```

Wyłączenie:
```json
{
  "backendBugs": false,
  "frontendBugs": false
}
```

Jeśli `backendBugs=true` i nie podasz pola `flags`, backend automatycznie włącza wszystkie znane bug-flagi backendowe.
