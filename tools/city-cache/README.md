# city-cache: wspólna pamięć miasta dla testów (ADR-0083, krok 3)

Plik setup Vitest projektu `shared` (`vitest.config.ts`). Raz na robotnika instaluje magazyn
rastrów i pól sterowania (`packages/sim/src/systems/ai/nav-share.ts`, haczyk `shareNav` w
`nav-field.ts`), z którego korzystają wszystkie symulacje robotnika: para zapis/wczytanie,
powtórki `determinism` i kolejne pliki w tym samym miejscu miasta nie liczą już tych samych pól.

- Tylko przyspieszenie: klucz to treść (kształty brył, treść gruntu, okno), a trafienie oddaje te
  same raporty pracy co liczenie, więc pamięć świata, liczniki `nearBuilds`/`wideBuilds` i
  rozłożenie pracy na kroki są takie jak bez magazynu (`packages/sim/test/nav-share.test.ts`).
- `SEKI_CITY_CACHE=off` wyłącza, `SEKI_CITY_CACHE=stats` wypisuje trafienia po każdym pliku.
- Pamięć procesu, nie dysk: rastry i pola zależą od kodu symulacji, nie tylko od wejść tablic
  (`OWNED` z kroku 1), więc klucz z odcisku tablic mógłby się zestarzeć. Budżet 128 MB na
  rastry i tyle samo na pola na robotnika (`nav-stores.ts`), najdawniej użyte wypadają.
- Pliki izolowane (app, ui, narrative) go nie mają: każdy taki plik ładuje moduły od nowa.
