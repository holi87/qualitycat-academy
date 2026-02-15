# Training Paths

## 1) Ścieżka Student
Cel: nauczyć się flow użytkownika końcowego.

Kroki:
1. logowanie (`/login`)
2. przegląd kursów (`/courses`, `/courses/:id`)
3. przegląd sesji (`/sessions`)
4. rezerwacja sesji
5. przegląd własnych rezerwacji (`/my-bookings`)

Ćwiczenia:
1. odtwórz błąd `SESSION_FULL`
2. odtwórz błąd `ALREADY_BOOKED`
3. sprawdź różnicę zachowania po runtime toggle `frontendBugs=true`

## 2) Ścieżka Mentor
Cel: obsługa części operacyjnej i jakościowej.

Kroki:
1. logowanie kontem mentora
2. tworzenie kursu (`POST /courses`)
3. tworzenie sesji (`POST /sessions`)
4. przegląd bugów technicznych (`GET /internal/bugs`)

Ćwiczenia:
1. analiza wycieku danych przy `BUG_BOOKINGS_LEAK`
2. analiza błędnej paginacji przy `BUG_PAGINATION_MIXED_BASE`
3. analiza N+1 przy `BUG_NPLUS1_COURSES`

## 3) Ścieżka Admin
Cel: pełny monitoring i prowadzenie sesji szkoleniowych.

Kroki:
1. włączanie/wyłączanie bug mode (panel admina lub `PUT /admin/bugs/state`)
2. walidacja endpointów `/internal/bugs` i `/__debug/flags`
3. prowadzenie debug sesji dla student/mentor

Ćwiczenia:
1. odtworzenie race condition przy `BUG_BOOKINGS_RACE`
2. wykrywanie niewłaściwych kodów odpowiedzi przy `BUG_AUTH_WRONG_STATUS`
3. przygotowanie planu naprawy i testów regresji

## Konta seed
- admin: `admin@qualitycat.academy` / `admin123`
- mentor: `mentor@qualitycat.academy` / `mentor123`
- student: `student@qualitycat.academy` / `student123`
