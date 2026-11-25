# Audyt SpinalTap według przewodnika dobrych praktyk

Stan: `main` przy 304751a, 25.11.2026. Wzorzec porównania: [`docs/praktyki-gamedev.md`](../praktyki-gamedev.md).
Repozytorium nie było zmieniane w trakcie audytu.

Audyt zrobiło trzech agentów, każdy na swojej grupie rozdziałów przewodnika. Każdy punkt ma ocenę, dowód
(ścieżka, liczba, wynik polecenia), proponowaną poprawkę i koszt:
- [A: architektura, determinizm, testy, audyty, zapadki, CI](A-architektura-testy-ci.md) (§2–§6, §16);
- [B: wydajność, weryfikacja wizualna, assety, UI, języki, telefon, audio](B-wydajnosc-obraz-ui-assety.md) (§7, §8, §11–§13);
- [C: wzorce, lokacje, rozgrywka i AI, agenci, ciągłość, błędy, dokumentacja, właściciel](C-proces-agenci-tresc.md)
  (§1, §9, §10, §14, §15, §17–§19).

Skrypty pomocnicze, o których wspominają raporty (`alloc.py`, `rm-old-wt.sh`), zostały w scratchpadzie sesji i nie
weszły do repo.

## Wynik

| Część | Punkty | Zgodne | Odstępstwo | Brak | Nie dotyczy |
|---|---|---|---|---|---|
| A | 84 | 54 | 25 | 4 | 1 |
| B | 75 | 39 | 26 | 6 | 4 |
| C | 90 | 43 | 44 | 1 | 2 |
| **Razem** | **249** | **136** | **95** | **11** | **7** |

Fundamenty trzymają się dobrze:
- czyste granice pakietów: `pnpm depcheck` daje 0 naruszeń na 1343 modułach;
- `pnpm lint` daje 0 błędów;
- baza god objectów i baza literałów i18n mają 0 pozycji;
- skan glitchy jest zgodny z bazą co do klucza;
- działają: rejestr licencji z testem, autozapis przy schowaniu strony, jedna skala UI z celami dotyku ≥44 px, karty
  pomieszczeń pilnowane testem i bramka na wywołaniach rysowania.

Odstępstwa skupiają się w trzech miejscach:
1. **Proces dryfuje od zasad.** Czerwony main, sprzeczne instrukcje agentów, nieaktualne statusy rejestru, ADR-y bez
   sekcji „Wzorzec”, backlog i decyzje prowadzone jak dziennik.
2. **Zapadki są dziurawe na brzegach.** Skan nie pada, gdy klucz zniknie z bazy. Brak pliku bazy daje zielony test.
   Nadpisanych limitów czasu jest więcej, niż podaje lista długu.
3. **Telefon jest słabiej pilnowany niż komputer.** Gęstość pikseli bez limitu, pauza bez wyciszenia, brak ogranicznika
   klatek i automatycznej rozdzielczości, budżety bez klasy urządzenia, brak pomiaru na telefonie.

## Sprawdzone w głównej sesji

Na podstawie raportów agentów sprawdziłem w kodzie następujące ustalenia. Wszystkie się potwierdziły:
- `renderScaling` w `packages/engine/src/renderer/stage.ts:36` ogranicza gęstość pikseli tylko na Low;
- `AudioContext.suspend` nie występuje w kodzie produkcyjnym, a `pageHidden()` w `game-session.ts:159` tylko zapisuje;
- komentarz nad złotym hashem w `packages/sim/test/determinism.test.ts` opisuje kolejne zmiany złotej liczby, które
  wynikały z samego podbicia `SAVE_SCHEMA_VERSION` (v42, v44, v50, v52, v53);
- `fails()` w `tools/glitch-scan/src/scan-keys.ts` reaguje tylko na klucze dodane i urosłe;
- ADR-y 0080–0084 i 0086–0092 nie mają nagłówka z wzorcem;
- `packages/engine/src/renderer/tessen-w3/w3-line-anim.ts:61` ma własną kopię mulberry32;
- `window.__seki = debug` w `packages/app/src/main.tsx` nie jest za warunkiem trybu deweloperskiego;
- ostatnie 100 przebiegów workflow na main: 46 udanych, 44 nieudane, 9 anulowanych.

Pozostałe ustalenia opierają się na raportach agentów i mają tam dowody.

## Poprawki według priorytetu

Koszt: S do dnia, M kilka dni, L więcej. Litera w nawiasie wskazuje raport ze szczegółami.

### P0: najpierw

| # | Poprawka | Dlaczego | Koszt |
|---|---|---|---|
| 1 | **Zielony main.** Przyspieszyć testy tuż pod progiem 75% (`m4-contracts` 15,2–16,7 s, `loot` 16,1 s, `i18n-scan` 15,2 s z 20 s) według profilu. Czwarty shard (shard 1 doszedł do limitu 20 min). Stan CI main dopisany do listy startowej w CLAUDE.md. Przy czerwonym main nie scalać. (A) | 44 ze 100 ostatnich przebiegów na main padło, więc czerwony main przestał być sygnałem. | M |
| 2 | **Pauza i schowanie aplikacji zatrzymują grę i dźwięk.** `setPaused` w porcie audio, czyli zmiana kontraktu z ADR-em. `pageHidden()` woła `pause()`, a po powrocie jest odliczanie. Test sesji. (B) | Na telefonie po przełączeniu aplikacji gra i muzyka działają dalej. | S |
| 3 | **Gęstość pikseli ≤ 2 na High i Medium**, z testem w `stage-scaling.test.ts`. (B) | Ok. 80% klatki na telefonie zależy od pikseli. Przy DPR 3 to 2,25 raza więcej pracy bez widocznej różnicy. | S |
| 4 | **Złoty hash bez wersji zapisu**, a historia z komentarza przeniesiona do commitów. (A) | Co najmniej 5 z 13 zmian złotej liczby od 16.11 wynikało z samej wersji schematu, więc hash zmienia się bez zmiany reguł. | S |
| 5 | **Instrukcje agentów bez sprzeczności.** Lista 9 sprzeczności w raporcie C, m.in. szkic PR czy gotowy, `CHANGELOG.md` czy `changelog.d/`, push czy jego zakaz, pięć różnych limitów agentów. Ścieżki z dawnych kontenerów zamienione na pliki w repo. Lekcje orkiestratora (33 KB, ok. 95 punktów, lekcja o worktree 5 razy) skonsolidowane do ok. 40. (C) | Agent dostaje dziś sprzeczne polecenia i wybiera przypadkowo. | M |
| 6 | **Rejestr glitchy: szybka część.** G-053 i G-063 (PR-y #981 i #979 scalone) przenieść do archiwum. Status „nowy” (23 wpisy) zamienić na słownikowy. Nagłówek bez odwołania do usuniętego `glitch-baseline.json`. (C) | Rejestr ma być źródłem prawdy na starcie sesji. | S |

### P1: zaraz potem

| # | Poprawka | Koszt |
|---|---|---|
| 7 | **Zapadki wymuszają spadek.** Ubyły klucz skanu jest czerwony do `scan:update`, a brak pliku bazy w `code-health` i `i18n-scan` też jest czerwony. Dziś w obu przypadkach test przechodzi. (A) | S |
| 8 | **Dług limitów czasu zgodny z kodem.** W vitest jest 27 nadpisań ≥20 s, a ADR-0046 podaje 11. W e2e jest 26 nadpisań, w ADR 4. Zapadka miejsc z nadpisanym `timeout` oraz wpisy z warunkiem zdjęcia albo usunięcie nadpisań. Wspólna pamięć modeli VRM w procesie testów. (A) | S + M |
| 9 | **Test niezmienników z losowym wejściem i soak.** Kierowca-chuligan na podłodze testowej i w 3 scenach. Soak 20 min w Lublinie: NaN, najgorszy krok, liczba bytów. Dziś obu brak, a testy aktów przenoszą gracza teleportem. (A) | S + M |
| 10 | **Jedno źródło kształtu i algorytmu.** `deckHeight` jest dwa razy (`engine/.../deck-plan.ts:37` i `sim/src/world/deck.ts:28`). Mulberry32 trzeba przenieść na `@seki/core`. Test przypina rysowany grunt do `groundAt`. 6 ręcznych siatek kubełkowych przenieść na `SpatialHash`, a kopie łapać kontrolą w `code-health`. (A, C) | S + M |
| 11 | **Budżety z klasy urządzenia.** Historia z `$comment` w `tools/perf-budgets.json` (16,5 tys. znaków, 10 podniesień budżetu) do osobnego dokumentu, w pliku ≤300 znaków z testem. Pole `device` na scenę. Pomiar na telefonie (etap 3 ADR-0079). (B, C) | M |
| 12 | **Ogranicznik klatek, potem automatyczna rozdzielczość z histerezą.** Czyste klasy z testami bez GPU, wyłączane w narzędziach. (B) | S, potem M |
| 13 | **Narzędzie udziałów kosztu klatki w repo.** Pomiar z 14.11 nie trafił do repo. (B) | M |
| 14 | **Powtarzalny widok i zrzut A/B opcji jakości.** Ziarno zamiast `Math.random` w `w3-fx.ts`, `atmosphere.ts`, `face.ts`. Cząstki krokowane czasem gry. Reguła ESLint rozszerzona na `engine` i `ui`. `shots:compare` dla dwóch zestawów parametrów: różnica pikseli większa od zera dowodzi, że przełącznik coś rysuje. (B) | M |
| 15 | **Sekcja „Wzorzec” w ADR jako test.** Szablon w `docs/adr/README.md`, test dla ADR-ów od 0103, uzupełnienie 0080–0084 i 0086–0092. (C) | M |
| 16 | **`decyzje.md` i backlog jako pamięć.** Decyzje posortowane, sekcja „Tokeny przy mapowaniu” (ok. 25 niezwiązanych decyzji) rozbita, nieaktualne oznaczone, jeden wpis z obowiązującą kolejnością prac i limitem agentów. Z „Następne” (137 KB, 61 pozycji) dzienniki sesji i wykonane prace do archiwum. (C) | M |
| 17 | **`tools/worktree-prune.sh` w repo i decyzja o 6 gałęziach z pracą bez PR**: `feat/rooms-near` 43 commity, `feat/jazda-kierowca` 19 (PR #853 zamknięty bez scalenia), `feat/archikatedra-dach`, `feat/neon-straganow`, `fix/foodhall-oyaji`, `test/front-signs-szybciej`. (C) | S |
| 18 | **Wyjście z utknięcia gracza**: „wróć na drogę” z ostatniej pozycji na grafie nawigacji, z testem sesji. Dziś zostaje tylko wczytanie zapisu. (C) | M |
| 19 | **Komenda zamiast zapisu stanu z app.** `session-loop.ts:63` ustawia `dialogueActive` z pominięciem `GameCommand`. (A) | S |
| 20 | **Rejestr glitchy: przegląd pełny.** Pomiar na main ok. 200 wpisów bez sprawdzenia od 15.11 (`g-sieve`). Klasy dla schodów i krawężników. Test pól obowiązkowych (Gdzie, Dowód, Test przyjęcia) dla nowych numerów. Unikalność numerów (`G-966` jest dwa razy w archiwum). (A, C) | L |

### P2: w kolejce

| # | Poprawka | Koszt |
|---|---|---|
| 21 | Limity wyczerpane do zera: 10 klas z dokładnie 20 metodami (w tym `BabylonRenderer`, `Simulation`), konstruktor renderera i `generate.ts:324` po 120 linii, `corrections.ts` 499 i `props-gen.ts` 498 linii. Raport pasa ≥90% w `code-health`, podział przed następną zmianą w tych plikach. (A) | M |
| 22 | Audyty rozgrywki jako narzędzie: `vitest.audit.config.ts` z sondami walki i skradania z ADR-0089, tryb A/B dwóch refów, potem autopilot zlecenia bez teleportu. (A) | M + L |
| 23 | `window.__seki` (teleport, step) tylko w buildzie testowym, poza APK i artefaktem. (A) | M |
| 24 | Alokacje w pętli klatki: `spring-bones.ts` (ok. 21 na staw na klatkę), `camera-rig.ts` (nowy `Ray` co klatkę), `moon-shadow.ts`, `model-rig.ts`. Punkt na liście weryfikatora. (B) | M |
| 25 | Audyt UI macierzą okien × rozdzielczości × en/pl z kodem błędu, z kontrolą pisma <8 px. Czcionka mono (86 reguł CSS) z polskimi znakami. (B) | M + S |
| 26 | APK: `versionCode` z liczby commitów (dziś `github.run_number`, lokalnie 1) i stały klucz także bez sekretów. Raport rozmiaru `dist` i APK w CI. (B) | S |
| 27 | Audio: 115 plików bez manifestu sha256 i skryptu pobierania; haptyka z priorytetem, limitem częstotliwości i minimum 60 ms. (B) | S + M |
| 28 | CLAUDE.md: styl pisania i raport w trzech listach (zrobione, sprawdzone, niesprawdzone). Szablon briefu w `agenci-zasady.md`. (C) | S |
| 29 | Zasady lokacji mierzone: drugie wyjście we wnętrzach fabularnych (`clinic`, `neon-koi`, `tessen-office`, `capsule`), 60-30-10 w 40 kartach „do zmierzenia”, siatka 0,5 m (44 z 69 kart ma 0 wymiarów na siatce), reguły §17 (0 z 69 kart zgodnych). (C) | L |
| 30 | Histereza AI i pętle nagrody jako kontrole: skan skoków kursu w walce i ucieczce (G-329, G-328, PR #1039), test niezmiennika handlu, lista „świadomie bez” w ADR-0089. (C) | M |
| 31 | Złożenie `changelog.d` (273 fragmenty od 11.11) do `CHANGELOG.md`. (A) | S |
| 32 | Pokrycie: `engine` i `app` poza pomiarem, `ui` i `narrative` bez progu. (A) | M |

## Proponowana kolejność

1. Jeden dzień na P0 o koszcie S, każdy osobnym PR-em: gęstość pikseli (3), pauza z ADR-em (2), hash bez wersji (4)
   i szybka część rejestru (6). Hash i pauza to zmiany ryzykowne według CLAUDE.md, więc idą osobno.
2. Zielony main (1) przed kolejnymi scaleniami treści.
3. Porządek instrukcji (5) razem z punktem 28, żeby kolejne sesje agentów pracowały na spójnych zasadach.
4. Zapadki (7, 8) przed testami niezmienników (9), bo nowe testy dołożą czasu do bramki.
5. Telefon (11–14) jako jedna seria z pomiarem na urządzeniu na końcu.

## Czego audyt nie sprawdził

- Pełnego `pnpm test:coverage` i e2e lokalnie. Uruchomione były lint, depcheck, `code-health`, skan glitchy, skan
  i18n oraz wybrane testy UI, audio, zapisu i skali.
- Zachowania gry w przeglądarce i na telefonie (pauza, kamera, drżenie, wyjścia z porażki).
- Pełnej treści każdego ADR-u: sekcję wzorca szukano po nagłówkach i słowach kluczowych.
- Czy 6 gałęzi bez PR weszło do main inną drogą (np. cherry-pick).
- Czy kolizja auta liczy uderzenie więcej niż raz: brak strażnika stwierdzony, błędu nie.
