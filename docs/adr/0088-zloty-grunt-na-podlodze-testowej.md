# ADR-0088: Złoty hash gruntu na stałej podłodze testowej

Status: Zaakceptowany (16.11, decyzja użytkownika z przeglądu antywzorców, punkt 2). Dotyczy ADR-0044 (miasto z danych mapy), ADR-0046 (testy), ADR-0054 (glitche, G-444). Wzorem jest podłoga determinizmu z #624/#626 (`packages/sim/test/fixtures/determinism-floor.ts`, `BY_HAND` w `tools/hashes`).

## Kontekst
- `packages/engine/test/map-ground-golden.test.ts` (G-444) trzymał liczbę siatek, wierzchołków i hash FNV gruntu i wody czterech chunków Lublina (`krakowskie-1-1`, `stare-miasto-1-1`, `podzamcze-1-0`, `nabrzeze-0-1`). Hash zależał od tablic `lublin/*.generated.ts`, więc zmieniał go każdy PR mapy, a dwa PR-y mapy zawsze kolidowały w tym pliku. Orkiestrator przepisywał wartości ręcznie po każdym scaleniu, a komentarz nad asercją rósł o opis każdej zmiany danych (ok. 60 linii).
- Test ma pilnować zasad budowy gruntu (drapowanie, cięcia, krawężniki, wycinanie szybów, układanie w komórkach skanu), nie treści mapy. Zmiany treści widać gdzie indziej: skan glitchy, `orto:diff`, raport `map:refresh` (obiekty, m² nawierzchni, teren, pomosty), przegląd kuratora.

## Decyzja
1. Część na chunkach Lublina zastępuje stała podłoga testowa `packages/engine/test/fixtures/ground-floor.ts`: mały plac daleko poza miastem (róg w x, z = −2048, na styku czterech komórek 128 m), bez tablic Lublina. Obejmuje to, co dawały chunki: bruk na placu, plac i ciąg pieszy w placu, trawnik, fontannę, jezdnię z zebrą i liniami, chodniki z krawężnikami po obu stronach, schody na skarpie, rzekę, tory, kładkę na pomoście, krawędź mapy na końcu terenu i trzy szyby wycięte jak szyby metra. Podłoga przechodzi raz przez `MapCity` (komórki, siatki `map-ground-*` i `map-water-*`) i raz kawałek po kawałku przez `planGround` w całości i w komórkach skanu (`FLOOR_SCAN`), z `cutGround(FLOOR_SHAFTS)`. Część z małym światem i pomostem (`world`, `PIECES`) zostaje bez zmian.
2. Złoty hash podłogi zmienia się tylko ze zmianą zasady budowy gruntu. `tools/hashes` dopisuje `map-ground-golden.test.ts` do `BY_HAND`: `hashes:check` go sprawdza, ale nigdy nie zapisuje (także z `--bare`). Nowy hash wpisuje człowiek (`vitest -u` albo edycja), z nazwaną zasadą w commicie.
3. `tools/pr-prep` liczy wejścia `map-ground-golden` z zasad gruntu (`packages/core/src`, `packages/sim/src/world`, `packages/engine/src/renderer`, podłoga), nie z tablic mapy: PR importu nie wymaga już ponowienia CI gałęzi, która zmienia ten golden.
4. Bez odcisku treści mapy liczonego przy buildzie. Sprawdzone: hash chunków Lublina był tylko w tym teście. `hashes:check` go jedynie porównywał, `map:refresh` traktował zmienione liczby jako powód przeglądu, ale ma do tego własne miary (obiekty, m² nawierzchni, `orto:diff`, teren, pomosty, skan). Glitch-scan, CI i `scan:update` go nie czytają. Tablice mają już odcisk wejść (ADR-0083). Nowy mechanizm byłby nadmiarowy.

## Wartości (16.11)
- Podłoga: 5 siatek, 4381 wierzchołków w komórkach miasta, 6428 wierzchołków kawałków (w całości i w komórkach skanu, po wycięciu szybów), hash `53e83d0b`. Mały świat bez zmian: `7a01ecb0`.
- Dowód: przesunięcie narożnika placu w `krakowskie-1-1` o 1,5 m zmienia stary test (167 643 → 167 644 wierzchołków, `825e5602` → `bece8f4d`), a nowy zostaje zielony. Krawężnik niżej o 1 cm (`ground-plan.ts`, `kerbs`) zmienia nowy hash (`53e83d0b` → `e5587031`) i hash małego świata.

## Konsekwencje
- Koniec ręcznego przepisywania goldenu gruntu po scaleniach PR-ów mapy i koniec kolizji dwóch PR-ów mapy w tym pliku.
- Zmiana treści mapy, która ujawnia błąd zasady gruntu tylko w Lublinie, nie poruszy goldenu: łapie ją skan glitchy i przegląd kuratora. Nowy przypadek z miasta, którego podłoga nie ma, dopisuje się do podłogi razem z poprawką zasady.
- `map-edge-wall.test.ts` i inne testy engine na tablicach Lublina nie są objęte tą decyzją.
