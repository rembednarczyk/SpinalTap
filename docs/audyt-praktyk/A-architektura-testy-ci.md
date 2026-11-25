# Audyt A: SpinalTap a `docs/praktyki-gamedev.md` (§2, §3, §4, §5, §6, §16, §21)

Stan repozytorium: `main` przy 304751a (25.11), historia pogłębiona do 1760 commitów. Uruchomione lokalnie:
`pnpm install --frozen-lockfile`, `pnpm lint` (wynik 0, bez błędów), `pnpm depcheck` („no dependency violations found
(1343 modules, 5961 dependencies cruised)”), `pnpm vitest run tools/code-health` (3 testy zielone),
`pnpm vitest run tools/glitch-scan/test/glitch-scan.test.ts` (306 testów zielonych w 89 s, `reports/glitch-scan-diff.txt`
pusty, czyli baza zgadza się z miastem co do klucza). Poza tym: skrypt liczący metody klas i funkcje w literałach obiektów
(parser TS, ta sama reguła co `tools/code-health`), ESLint z limitem obniżonym do 100 linii funkcji i 470 linii pliku,
`gh run list` i `gh run view` dla CI na `main` (100 ostatnich pushy, 22.11–25.11).

Oceny: ZGODNE, ODSTĘPSTWO, BRAK, NIE DOTYCZY. Koszt poprawki: S (do dnia), M (kilka dni), L (więcej).

## §2 Architektura

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: logika gry bez renderera i DOM, porty, korzeń kompozycji | ZGODNE | `packages/core/src/ports/` (render, audio, input, clock, random, persistence); testy sesji z fałszywym `RenderPort` w `packages/app/test`; 1073 pliki testów jednostkowych wobec 14 speców e2e; ADR-0046 „Wynik przeniesienia”: 10 speców przeniesionych do vitest | – | – |
| Z: kierunek zależności pilnuje narzędzie w CI | ZGODNE | `dependency-cruiser.config.cjs`: `no-circular`, `core-is-pure`, `sim-only-core`, `engine-no-ui-app`, `ui-no-engine`, `narrative-only-core`, `persistence-only-core`, `babylon-behind-one-module`, wszystkie `severity: "error"`; job `checks` w `.github/workflows/ci.yml` uruchamia `pnpm depcheck` przy każdej zmianie kodu; lokalnie 0 naruszeń | – | – |
| W: silnik graficzny importuje jeden moduł | ZGODNE | reguła `babylon-behind-one-module` (`pathNot: ^packages/engine/src/babylon\.ts$`), 0 naruszeń | – | – |
| W: wybór silnika z pomiaru, nie z rankingu | ODSTĘPSTWO | `docs/seki-senshi-plan.md:53-54`: Babylon i Havok wybrane z tabeli cech („Code-first, pełny silnik w TS…”), bez pomiaru na urządzeniu docelowym; ADR-0008 odkłada Havok z powodu architektury, nie pomiaru; pomiar urządzenia (ADR-0079) przyszedł później | Następną decyzję o silniku lub backendzie (WebGPU, fizyka) zapisywać w ADR z pomiarem na telefonie docelowym z ADR-0079 | S |
| Z: do symulacji tylko komendami; tabela handlerów z typem wymuszającym komplet | ODSTĘPSTWO | Wzorzec jest: `packages/sim/src/world/command-table.ts` (`CommandHandlers = { readonly [K in CommandType]: … }`), `Simulation.enqueue`, powtórka „ziarno + klatki” w `packages/sim/src/replay/replay.ts`; app woła `enqueue` 25 razy. Łamie go `packages/app/src/session-loop.ts:63` `simulation.session.dialogueActive = true` (zapis stanu sesji z app z pominięciem komendy, więc poza logiem powtórki) | Komenda `open-scene` (albo `start-dialogue`) w `GameCommand` i handler w `command-table.ts`; test powtórki z retrospekcją | S |
| W: gracz i AI to samo wejście i ta sama fizyka | ODSTĘPSTWO | Postacie: wspólny `movementSystem` dla gracza i NPC (`systems/index.ts`). Auta: auto gracza jedzie fizyką `driveCar` (`world/vehicle/step.ts:107`, wołane tylko w `vehicle-system.ts:303`), ruch uliczny AI kinematycznie po trasach (`traffic-system.ts`), więc zderzenie gracza z ruchem łączy dwa modele | Ruch AI w pobliżu gracza przez `driveCar` z `DriveInput` (typ już istnieje), kinematyka tylko jako LOD z daleka; audyt kontaktów auto gracza z ruchem przed i po | L |
| Z: symulacja emituje zdarzenia, prezentacja słucha | ZGODNE | `EventBus<DomainEvents>` w `Simulation`, `packages/app/src/event-presenter.ts`, np. `ctx.bus.emit("VehicleHit", …)` w `vehicle-system.ts:310` | – | – |
| Z: dane w tabelach, zachowanie w systemach | ZGODNE | `packages/core/src/items/catalog.ts`, `items/enemies.ts`, `COMMAND_HANDLERS`, treść `sim/src/content/*`; warunki na nazwach miejsc w logice prezentacji tylko 4 (`engine/src/renderer/drones/patrol-world.ts:197` `district === "kanal"`, `engine/src/audio/w3-*.ts`) | (opcjonalnie) cecha dzielnicy zamiast `"kanal"` | S |
| Z: jedno źródło prawdy kształtu dla fizyki i renderu | ODSTĘPSTWO | Dwie implementacje wysokości pomostu: `packages/engine/src/renderer/mapcity/deck-plan.ts:37` i `packages/sim/src/world/deck.ts:28` (ten sam wzór, osobne typy `DeckAxis` i `GroundDeck`). Rysowany grunt (`engine/src/renderer/mapcity/ground-plan.ts`, `drapeHeightAt`, `map-entries.ts:117 groundHeight`) to osobna konstrukcja od `GroundField` symulacji; zgodność trzymają rodzaje skanu (`lane-off-ground`, `prop-off-ground`, `steps-tread-sunk`, `ground-over-deck`), a nie wspólna funkcja. Kopia generatora mulberry32 w `engine/src/renderer/tessen-w3/w3-line-anim.ts:61-65` obok `@seki/core` | `deckHeight` jeden, w `core` lub `sim`, engine importuje; test przypinający, że wysokość rysowanego gruntu w próbkach równa się `groundAt` symulacji; `w3-line-anim` na `mulberry32` z `@seki/core` | S (deck, RNG), M (test gruntu) |
| W: widok bogatszy od symulacji, tylko czyta | ZGODNE | grep zapisów do `world`, `domain`, `session` w `packages/engine/src`: 0 trafień | – | – |
| W: opcje gry wyłączalne dla testów | ZGODNE | `SimulationOptions` (`sim/src/simulation.ts:52-67`): `crowd`, `traffic`, `chunks`, `difficulty`; powtórka działa z tłumem i bez (`replay.ts`); e2e `models=off` (ADR-0046) | – | – |
| Z: limity rozmiaru z bramką | ODSTĘPSTWO | Bramka działa (ESLint `max-lines` 500 i `max-lines-per-function` 120 w `eslint.config.js`, `tools/code-health` z bazą `{}`). Limity są wyczerpane do zera: 10 klas ma dokładnie 20 metod (`BabylonRenderer`, `Simulation`, `SynthAudio`, `CameraRig`, `ToonMaterials`, `CharacterViews`, `MapCity`, `ScreenFx`, `GroundField`, `WorldStreamer`); konstruktor `babylon-renderer.ts:174` i funkcja `tools/osm-import/src/generate.ts:324` mają po 120 z 120 linii; `tools/osm-import/src/corrections.ts` 499 i `props-gen.ts` 498 z 500 linii. Poza zasięgiem bramki: testy (`tools/glitch-scan/test/glitch-scan.test.ts` 3053 linie), `tools/*.mjs` i `tools/*.py`; literał obiektu z 57 funkcjami (`engine/src/renderer/mapcity/prop-models.ts:25`) nie jest klasą, więc zapadka go nie widzi. Test zapadki zapisuje bazę sam, gdy pliku nie ma (`!existsSync(BASELINE)` w `tools/code-health/test/*.test.ts`), więc usunięcie bazy daje zielony test | Raport „pas ostrzegawczy” (≥90% limitu) w `tools/code-health`; podział `BabylonRenderer`, `Simulation`, `corrections.ts`, `props-gen.ts` przed kolejną zmianą; brak bazy ma być czerwony; limit pliku także dla `tools/*/test` (wyjątek dla tabel oczekiwań) | M |
| W: nowa funkcja dostaje własny kontroler, prezenter, wycinek stanu | ZGODNE | `packages/app/src/controllers`, `presenters` (24 pliki), `game-session.ts` 162 linie, 20 wąskich interfejsów `*Intents` w `packages/ui/src` | – | – |
| W: mierz odpowiedzialność, nie tylko liczbę pól | ZGODNE | Wyjątki `max-lines` tylko dla tabel danych (4 ścieżki w `eslint.config.js`: `district-*.ts`, `*.generated.ts`, `items/catalog.ts`, `city-kit-data.ts`) | – | – |
| W: bez ukrytych globalnych singletonów | ODSTĘPSTWO | Store UI z fabryki (`createStore` w `ui/src/store/ui-store.ts:435`), dobrze. W `core`/`sim` 10 modułowych `let` i 39 modułowych `Map`/`Set`/`LruMap`, m.in. `sim/src/systems/player-control-system.ts:40-61` (pamięć statystyk gracza), `sim/src/systems/ai/nav-share.ts:24` (`installed`), `sim/src/world/deck.ts:64` (`foundFlight` jako parametr wyjściowy przez zmienną modułu); test determinizmu musiał dostać osobny przypadek na wyciek stanu modułu (`determinism.test.ts:34-38`). W engine 15 modułowych `let` z pamięcią miasta (`landmarks/match.ts:42-91`, `drone-world.ts:61`) | Pamięci podręczne do kontekstu świata (`SimContext`/`WeakMap` kluczowana światem), `foundFlight` jako wartość zwracana; test „dwa światy w jednym procesie dają te same wyniki co osobno” | M |
| W: biblioteka branżowa przed domową geometrią | ZGODNE | ADR-0078 (Clipper2) etapami z pomiarem; koszt +20,2% `osm:build` w długu ADR-0046 z warunkiem „do usunięcia, gdy etap 3 lub 4 ADR-0078 zastąpi `cutHoles`, `clipRingToRect`” | – | – |
| W: własna prosta fizyka, deterministyczna | ZGODNE | ADR-0008: kolizje kinematyczne w `sim`, Havok odłożony; całe akty grane w vitest | – | – |

## §3 Determinizm i symulacja

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: stały krok z interpolacją renderu | ZGODNE | `packages/sim/src/loop/fixed-step-loop.ts` (akumulator), `render(alpha)` w `app/src/session-loop.ts:41`, `interpolationSystem` w `createSystems()` | – | – |
| Z: losowość i czas tylko przez porty, linter pilnuje, osobne strumienie | ZGODNE | `eslint.config.js`: `no-restricted-properties` (`Math.random`, `Date.now`, `performance.now`), `new Date` zakazane, `no-explicit-any` dla `core/src` i `sim/src`; lint 0 błędów, w repo 0 komentarzy wyłączających te reguły; `sim/src/rng/derive-random.ts` (strumień na cel) | – | – |
| Z: iteracja w kolejności id, jawna kolejność systemów, remisy | ODSTĘPSTWO | Jawna tablica: `createSystems()` w `sim/src/systems/index.ts:132`; remis kopca po numerze węzła `sim/src/world/nav.ts:109`. Brak reguły w `CLAUDE.md` (w Broadside jest `sortedById`), brak wspólnej funkcji i strażnika; kolejność bytów to kolejność wstawiania miniplex, 9 jawnych sortowań po id. Błędu nie znaleziono | Reguła w `CLAUDE.md` i helper `sortedById` w `sim`; test: ta sama scena z bytami wstawionymi w innej kolejności daje ten sam hash | S |
| W: nowe byty na koniec, osobna pula id | ZGODNE | `CROWD_ID_BASE = 1_000_000` (`world/crowd.ts:19`), `VEHICLE_ID_BASE = 3_000_000` (`world/traffic.ts:16`), `SCENERY_ID_BASE = 5_000_000`, `ROOM_ID_BASE`, `STREET_ID_BASE` | – | – |
| Z: złoty hash na małej podłodze, tylko ręcznie | ODSTĘPSTWO | Podłoga jest (`sim/test/fixtures/determinism-floor.ts`, ADR-0088), `tools/hashes/src/check.ts` nie zapisuje hasha (`BY_HAND`). Hash liczy jednak `sim.snapshot(…)` razem z `SAVE_SCHEMA_VERSION`: od 16.11 złota liczba zmieniła się w 13 commitach, w tym w co najmniej 5 „changes only the version” (v42, v44, v50, v52, v53, komentarze `determinism.test.ts:51-66`). Każdy PR zapisu koliduje na tej linii, a nad asercją urosło 19 linii historii | Hash ze stanu bez pola wersji i metadanych zapisu; historię z komentarza do commitów | S |
| W: stały hash nie dowodzi braku zmiany zachowania | ZGODNE | ADR-0046, dług 20.11: „Trajektorie bajt w bajt te same w 1501 testach sim”, „hash pozycji, prędkości i kąta każdego ciała po każdym kroku w całym sim (2101 testów)” | – | – |
| W: stan liczony z ziarna nie trafia do zapisu | ZGODNE | `replay.ts`: tłum i ruch nie są zapisywane; `determinism.test.ts:29` („not saved: none in a loaded game”) | – | – |
| Z: zmiana schematu: wersja, migracja, test | ZGODNE | `SAVE_SCHEMA_VERSION = 53` (`core/src/save/save-snapshot.ts:105`), 52 migracje w `persistence/src/migrations.ts`, 39 plików testów zapisu w `persistence/test` (np. `market-move-save.test.ts`) | – | – |
| W: narzędzia diagnostyczne zapisują tą samą drogą co gra | ZGODNE | Lekcja w `.claude/agents/orchestrator.md:132` (G-899, G-900); debug API zapisuje przez `session.saves.saveAsync` | – | – |
| W: zdarzenie fizyczne liczone raz na styk | BRAK | `vehicle-system.ts:308-315`: `VehicleHit` i `takeHit` przy każdym kroku z prędkością styku ponad progiem; brak okna styku i brak testu „docisk do ściany przez N kroków daje jedno uderzenie” (`vehicle-damage.test.ts` sprawdza tylko sumę energii). Wielokrotnego liczenia nie stwierdzono, bo kolizja prawdopodobnie zeruje prędkość normalną, ale nic tego nie pilnuje | Test docisku auta do ściany i jazdy wzdłuż ściany; przy potrzebie okno styku jak w PodRcr | S |
| W: LOD fizyki po odległości | ZGODNE | `sim/test/pinned-far-sleep.test.ts`, usypianie w `world/actor-spawner.ts`, strumieniowanie chunków | – | – |
| W: najpierw zmierz, potem zmieniaj | ZGODNE | ADR-0089 „Liczby z audytu (sondy sim bez renderera, origin/main e2f6330)” przed zmianą AI walki | – | – |
| W: wspomaganie jako osobna nazwana reguła | ZGODNE | `DrivingAssist = "full" \| "abs" \| "off"` (`core/src/ports/types.ts:115`), `app/src/aim-assist-feed.ts`, presety trudności ADR-0066 | – | – |
| W: fizykę wprowadzaj częściami z audytem | ZGODNE | ADR-0089 etapy 1–5, każdy z testem (`combat-pace.test.ts` etap 1, pasmo broni etap 2, żetony etap 4) | – | – |
| W: konstrukcje ze statyki | NIE DOTYCZY | Konstrukcje to prawdziwe budowle Lublina z OSM, NMT i LoD2 (ADR-0042); spójność geometrii pilnują rodzaje skanu (`bridge-without-deck`, `deck-abutment`, `cable-spans`), statyka nie jest kryterium | – | – |
| W: parametry z prawdziwego źródła, ściśnięte do gry | ZGODNE | OSM, NMT, ortofoto (ADR-0042, ADR-0080); `world/vehicle/damage.ts:11` energia z masy 1,35 t i 50 km/h | – | – |

## §4 Testy

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: logika i UI bez przeglądarki | ZGODNE | 14 speców w `e2e/` (rozruch, NPR, budżety, modele, dotyk, układ HUD), reszta w vitest; ADR-0046 | – | – |
| Z: testy krokują symulację i czekają na stan | ZGODNE | Debug API `step(n)`; w e2e `waitForTimeout` tylko 3 razy, przy przytrzymaniu klawisza (`smoke.spec.ts:231`, `touch.spec.ts:18`) i w raporcie przycięć (`hitch-report.spec.ts:107`); w vitest `setTimeout(r, 0)` tylko do opróżnienia kolejki | – | – |
| Z: test całej rozgrywki jako bramka fizyki, AI i poziomów | ODSTĘPSTWO | Akty i zakończenia w `app/test/m3-loop.test.ts`, `m3-lustro-loop.test.ts`, `m3-zrodlo-loop.test.ts`, ale gracz przenosi się `teleport()` (`m3-lustro-loop.test.ts:24-30`), więc trasy, schody, mosty i AI po drodze nie są bramką; `balance.test.ts` to model formuł | Wariant aktu II, w którym gracz dochodzi do celów nawigacją (`sprint along a route` z debug API albo `nav.ts`), z limitem czasu gry i liczbą zablokowań | M |
| W: test niezmienników z losowym wejściem | BRAK | grep: brak `fast-check`, brak testu z losowym `InputFrame`; `isFinite`/`NaN` tylko w pojedynczych testach treści | Test „chuligan” na podłodze determinizmu i w 3 scenach miasta: losowe wejście z ziarna co 0,3–1,5 s, asercje: wartości skończone, gracz na gruncie, postęp, ten sam hash dwa razy | S |
| Z: dowód poprawki podmianą pliku | ZGODNE | `CLAUDE.md` („test pada bez niej”), `.claude/agents/glitch-fixer.md:17`, `feature-builder.md:17` (`git show <hash>^:<plik>`) | – | – |
| Z: kontrola liczy niezależnie od poprawki | ZGODNE | `change-verifier.md`, `orchestrator.md:115` (mutacje wskazane przez weryfikatora, G-213) | – | – |
| W: kryterium sondą bezpośrednią | ZGODNE | Rodzaje `walk-blocked` i `drone-low-pool` liczone w osobnym procesie (`glitch-scan.test.ts`, `MADE`), `pnpm scan:walk-coverage` | – | – |
| Z: test reguły obejmuje całą treść | ZGODNE | Skan całego miasta: 62 pliki bazy, 306 testów, 89 s lokalnie | – | – |
| Z: każdy błąd dostaje test regresji | ZGODNE | Reguła w `CLAUDE.md` (Glitche), testy nazwane numerami G-… | – | – |
| Z: refaktor dowodzi się odciskiem | ZGODNE | 16 opisów commitów `refactor` z porównaniem „bajt w bajt”/„te same trajektorie”; ADR-0083, ADR-0088 | – | – |
| W: zaczepy testowe tylko w buildzie deweloperskim | ODSTĘPSTWO | `packages/app/src/main.tsx:323` `window.__seki = debug` bez warunku; w `packages/app/src` brak `import.meta.env`. API ma `teleport`, `step`, zapisy (`debug-api.ts:59-217`), więc działa w APK i w artefakcie na telefon. Wymaga go e2e na buildzie (`pnpm build` w CI) | Flaga budowania (np. `VITE_TEST_HOOKS=1` dla buildu e2e), APK i artefakt bez niej | M |
| Z: podniesiony limit nie jest poprawką; wyjątek w długu z warunkiem | ODSTĘPSTWO | Globalny `testTimeout: 20_000` (`vitest.config.ts`, domyślnie 5 s). 27 nadpisań ≥ 20 s w 21 plikach (5×20 s, 2×30 s, 11×60 s, 6×120 s, 3×240 s), a ADR-0046 („Dług: nadpisane limity…”, 16.11) mówi „z 71 miejsc zostało 11”. Bez wpisu w długu: `beforeAll` 60 s w `engine/test/aim-point.test.ts:47`, `recoil.test.ts:36`, `forearm-rings`, `seated-walk` (wszystkie 18.11), `two-hand-hold`, `two-hand-motion`, `sim/test/deck-side.test.ts:125,143` (17.11), 120 s w `app/test/m3-lustro-loop.test.ts:50` i `quest-target.test.ts:23`. W e2e 26 nadpisań 150–400 s, w ADR wymienione tylko `smoke`, `touch`, `touch-layout`, `models` | Zapadka liczby nadpisań (lista miejsc z bazą, jak skan); dopisać brakujące do ADR-0046 z warunkiem albo usunąć; wspólne wczytanie VRM w pamięci procesu (jak `tools/city-cache`) zamiast 60 s na plik | S (zapadka), M (przyspieszenie) |
| W: wolny test dostaje szybszą konstrukcję | ZGODNE | `sim/test/fixtures/barrier-floor.ts`, `determinism-floor.ts`, `tools/city-cache`, projekt `shared` z `isolate: false` (`vitest.config.ts`) | – | – |
| W: bramka czasu: twarde progi, wzrost wobec main tylko raport | ODSTĘPSTWO | Logika zgodna: `tools/test-time/src/gate.ts` blokuje tylko 50%/75% limitu, wzrost to `::warning`. Twardy próg 75% sam robi czerwony main na szumie: 3 ostatnie pushe na `main` (25.11 20:59, 22:08, 22:40) czerwone tylko przez „Unit test time” (`m4-contracts.test.ts` „a save during the raid…” 15,2–16,7 s, `loot.test.ts` 16,1 s, `i18n-scan.test.ts` 15,2 s), w 12 ostatnich czerwonych przebiegach main 6 razy ten job. Komentarz w `ci.yml` (job `test-time`) dalej mówi, że wzrost zatrzymuje PR. Shard 1 testów jednostkowych przekroczył 20 min joba (przebieg 25.11 20:40, `cancelled`) | Przyspieszyć trzy testy (profil, nie wyjątek); próg 75% liczyć po tempie shardu (już liczone w `runPace`) albo jako najlepszy z dwóch prób; poprawić komentarz `ci.yml`; czwarty shard | M |
| W: pomiar czasu w izolacji, najlepszy z N | ZGODNE | `tools/bench-ab/src/bench.ts` (pary przeplatane), zamki `tools/heavy.sh` | – | – |
| W: pułapki uruchamiania | ZGODNE | Pakiety nie mają własnych skryptów testów ani konfiguracji vitest (tylko root); `tools/ci-scope/src/scope.ts:73` `CROSS_CUTTING` uruchamia `code-health` i `i18n-scan` w lekkim PR; `pnpm ci` łańcuchem `&&`; pułapka `hashes:check` opisana w `orchestrator.md:152`; reporter oddziela import od testów (`tools/test-time/src/reporter.ts:33`) | – | – |

## §5 Audyty i pomiary rozgrywki

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: pomiar z raportem jako osobne narzędzie obok testów | ODSTĘPSTWO | Dla mapy i wydajności narzędzia są (`scan:diff`, `scan:walk-coverage`, `shots:palette`, `bench:ab`, `orto:widths`, `rooms:write`, `tools/hitch-report`). Dla rozgrywki nie: sondy audytu ADR-0089 („sondy sim bez renderera”) nie są w repo jako narzędzie, brak `*.audit.ts` i osobnej konfiguracji | `vitest.audit.config.ts` z audytami walki, skradania i ruchu (tabele: czas zabicia, czas śmierci, wykrycia, zablokowania) uruchamianymi przed i po | M |
| Z: przed i po w tym samym wywołaniu, ten sam skład | ODSTĘPSTWO | `bench:ab` robi to dla czasu; dla zachowania (wyniki walk, trasy AI) brak narzędzia A/B dwóch refów, porównania robione ręcznie w opisach ADR | Tryb `bench:ab` dla raportu audytu (dwa worktree, ta sama lista ziaren, diff tabel) | S |
| W: audyt balansu jako bramka | ZGODNE | `sim/test/balance.test.ts` (progi z ADR-0059: tempo, czas walki 0,75–1,33, rzadkości), `combat-pace.test.ts` (bot z reakcją 0,15 s), `stealth-balance.test.ts` | – | – |
| W: pierwszy audyt pokazuje, że gra nie działa | ZGODNE | Audyt 17.11 (ADR-0089, `backlog.md:66`): poziomy 1, 6, 12 prawie ten sam wynik, G-917, G-918 | – | – |
| Z: próg zmienia się według intencji | ZGODNE | Progi `balance.test.ts` zapisane w ADR-0059 z decyzją użytkownika 7.11 („ok. 7 poziomów na dzielnicę”); `PACE_TARGETS` w `combat-pace.test.ts:25` | – | – |
| W: metryka nieosiągalna zostaje raportem | ZGODNE | `CLAUDE.md`: czas klatki pod SwiftShaderem to raport, bramką wywołania i aktywne siatki (`tools/perf-budgets.json`) | – | – |
| W: audyt autopilota (czy da się grać) | BRAK | Brak bota, który przechodzi zlecenie od przyjęcia do wypłaty po mieście; testy aktów teleportują; playtest W-3 17.11 był ręczny (`backlog.md:67`) | Autopilot zlecenia W-3 i jednego zlecenia z targu: nawigacja `nav.ts`, walka botem z `combat-pace`, raport: czas, zablokowania, śmierci | L |
| W: soak wykrywa zablokowaną grę | BRAK | grep „soak” w kodzie i narzędziach: 0 | Soak 20 min gry w Lublinie z tłumem i ruchem: brak NaN, najgorszy krok, liczba bytów stała, gracz ma wyjście z każdego stanu (śmierć, auto, winda) | M |
| W: beta-testerzy jako agenci z profilami | ODSTĘPSTWO | Jeden playtest agenta 17.11 (W-3, `backlog.md:67`), wnioski wykorzystane (G-909, `w3-start-save-session.test.ts`); brak profili i definicji agenta w `.claude/agents` | Agent `beta-tester` z 3 profilami (nowicjusz telefon EN, weteran PL monitor, gracz akcji), raport jako zgłoszenia glitchy | M |
| W: pomiar z wielu kamer zamiast oglądania | ZGODNE | `tools/shots/src/palette-cli.ts` (60-30-10), `e2e/glitch-shots.spec.ts`, linia wzroku z ulic dla dronów | – | – |

## §6 Zapadki i skany

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: kontrola z bazą, która tylko spada; spadek obniża bazę w tym samym commicie | ODSTĘPSTWO | Wzrost jest czerwony: `fails = added \|\| grown` (`tools/glitch-scan/src/scan-keys.ts:152`). Spadku nic nie wymusza: ubyłe klucze nie robią czerwieni, więc poprawka bez `scan:update` zostawia klucz w bazie i powrót glitcha w to miejsce przejdzie. Dziś baza jest czysta (lokalny skan: pusty diff). `tools/code-health` i `tools/i18n-scan` zapisują bazę same, gdy pliku nie ma (`!existsSync(BASELINE)`). Historia bazy skanu: 7382 klucze po #493, dziś ok. 4356; 29 z 55 commitów na bazie ma przyrost netto (np. +725 w #976, przyjęte `GLITCH_BASELINE=accept` z uzasadnieniem) | Ubyły klucz w bazie = czerwony test z poleceniem `pnpm scan:update`; brak pliku bazy = czerwony test | S |
| Z: baza zapisuje miejsca, nie liczbę | ZGODNE | `tools/glitch-scan/test/baseline/*.txt` (rodzaj, chunk, kwadrat); `pnpm scan:diff`. `i18n-baseline.json` jest liczbowy, ale wszędzie 0 | (opcjonalnie) i18n po miejscach, gdy baza odejdzie od zera | S |
| W: klucz odporny na drobne przesunięcia | ZGODNE | Nagłówki baz: „grid 10 m (x,z = the square's corner…)”, sprawdzane w `scan-keys.ts:191` | – | – |
| W: zapadka w PR, który naprawia pierwszy egzemplarz | ZGODNE | `CLAUDE.md` („Nowy policzalny rodzaj dostaje kontrolę w skanie”), np. #1036 „kontrole scene-lamp-in-solid i beacon-off-tip” | – | – |
| W: fałszywy alarm naprawia się w kontroli | ZGODNE | `orchestrator.md:81` (G-183), #609 `fix(glitch-scan): fałszywe alarmy pod budynkami…` | – | – |
| W: lista kontrolna jako blokada końca pracy | ZGODNE | Hook `Stop` w `.claude/settings.json` → `tools/grid-verify/hook.sh` (raport ważny dla `HEAD` i stanu drzewa), pole `skad` w `tools/grid-verify/src/checklist.ts` (17 punktów) | – | – |
| Antywzorzec: próg jako sam raport | ODSTĘPSTWO | Progi pokrycia tylko dla `core`, `sim`, `persistence` (`vitest.config.ts`); `engine` i `app` wyłączone z pomiaru pokrycia, `ui` i `narrative` mierzone bez progu | Progi dla `ui` i `narrative` na dzisiejszym poziomie (zapadka); `engine` i `app` przynajmniej jako raport w podsumowaniu CI | S |

## §16 Zmiany, CI i git

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Z: jedna zmiana, jedna gałąź, jeden PR; jeden błąd na commit | ODSTĘPSTWO | Zasada w `CLAUDE.md`. Od 15.11 4 ze 109 commitów `fix` niosą po kilka glitchy: #788 (G-940, G-941), #599 (G-853, G-854, G-855, G-866), #611 (G-876, G-877), #609 (G-864, G-875) | Sprawdzenie w `tools/pr-prep`: tytuł `fix` z więcej niż jednym G-… wymaga uzasadnienia | S |
| Z: czerwony main to pierwsza praca sesji | ODSTĘPSTWO | 46 ze 100 ostatnich pushy na `main` (22.11–25.11) czerwonych, 8 anulowanych; 24.11 `w3-start-save-session.test.ts` przekroczył limit na trzech kolejnych pushach; 25.11 trzy ostatnie pushe czerwone przez bramkę czasu, a scalenia szły dalej. Lista „Start nowej sesji” w `CLAUDE.md` nie wymienia stanu CI na `main` | Punkt „stan CI main (`gh run list --branch main --limit 5`)” na początku listy w `CLAUDE.md`; orkiestrator nie scala, gdy main jest czerwony | S |
| Z: kilka zielonych PR-ów scalaj po kolei | ZGODNE | `orchestrator.md:61`; job „What changed” w `ci.yml` puszcza wszystko, gdy main się przesunął od przebiegu PR | – | – |
| W: PR lekki, main pełny, osobna grupa współbieżności | ZGODNE | `tools/ci-scope`, `vitest related` w PR, `concurrency.group: main-<sha>` dla push, nocny przebieg `17 2 * * *` | – | – |
| W: zmiana tylko w dokumentacji nie uruchamia testów; PR jako gotowy | ZGODNE | `pushScope` i `DOCS` w `tools/ci-scope/src/scope.ts`; `if: … !github.event.pull_request.draft` | – | – |
| W: unikaj plików konfliktujących przy scaleniu | ODSTĘPSTWO | Dobrze: `changelog.d/`, tablice po linii (#641), tablice bez odcisku wejść (ADR-0083). Źle: 273 fragmenty w `changelog.d/` nieskładane od 11.11 (ostatnia zmiana `CHANGELOG.md`: c0c374e0, 11.11), brak joba składającego; numer glitcha nadawany w gałęzi jako max+1 (`tools/rejestry/rej.py:53`), stąd `G-966` dwa razy w `docs/glitches-archiwum.md` (linie 29 i 49) | Składanie `changelog.d` krokiem na main (albo przy wydaniu); numer nadawany po scaleniu albo test unikalności nagłówków `### G-` w rejestrach | S |
| W: scalanie main skryptem z polityką konfliktów; pliki blisko limitu | ZGODNE | `tools/merge-main.sh` (konflikt tylko w `*.generated.ts` rozwiązuje przeliczenie, inny przerywa). Uwaga: `corrections.ts` (499/500) i `props-gen.ts` (498/500) to dziś główne ryzyko konfliktu przy limicie (zob. §2) | – | – |
| W: nieudaną próbę wycofaj i opisz | ZGODNE | 0 revertów w historii, ale nieudane próby opisane, np. `backlog.md:10` („Plac Zamkowy nocą: próba i wniosek”), ADR-0046 (zawężenie `collidersNear`, mały zysk) | – | – |

## §21 Antywzorce (dotyczące powyższych tematów)

| Punkt przewodnika | Ocena | Dowód | Proponowana poprawka | Koszt |
|---|---|---|---|---|
| Podnoszenie limitu czasu albo budżetu, żeby test przeszedł | ODSTĘPSTWO | Zob. §4: 27 nadpisań w vitest wobec 11 w długu, 26 w e2e wobec 4 w długu; budżety `reference` i `phone-low` podnoszone z wpisami i warunkami (ADR-0046:75-81) | Zapadka miejsc z nadpisanym limitem | S |
| Próg tylko jako raport | ODSTĘPSTWO | Pokrycie `engine`, `app`, `ui`, `narrative` bez progu (zob. §6) | Zob. §6 | S |
| Baza zapadki jako sama liczba | ZGODNE | Skan po miejscach (#493); i18n liczbowy na zerze | – | – |
| Złoty hash na treści świata albo poprawiany automatem | ZGODNE | Podłoga testowa (ADR-0088), `hashes:check` nie pisze `determinism` (`BY_HAND`); zastrzeżenie o wersji zapisu w §3 | – | – |
| Kontrola tymi samymi danymi co poprawka | ZGODNE | Proces weryfikatora z mutacjami (`orchestrator.md:115`), `walk-blocked` w osobnym procesie | – | – |
| Dwie implementacje tego samego kształtu | ODSTĘPSTWO | `deckHeight` w `engine/.../deck-plan.ts:37` i `sim/src/world/deck.ts:28`; rysowany grunt osobno od `GroundField` | Zob. §2 | S |
| Czas klatki pod rendererem programowym jako bramka | ZGODNE | `CLAUDE.md` (Testy), `tools/perf-budgets.json` (wywołania, siatki) | – | – |
| Bramka wzrostu czasu wobec main | ZGODNE | Wzrost tylko ostrzeżeniem od 16.11 (`gate.ts`, `blocking`; ADR-0046 „Dług: wzrost czasu…”); nieaktualny komentarz w `ci.yml` | Poprawić komentarz | S |
| Odcisk wejść w nagłówku, wspólny `CHANGELOG.md`, status rejestru po każdej zmianie | ODSTĘPSTWO | Odcisku nie ma (ADR-0083), ale `changelog.d` nieskładany od 11.11 i kolizja numeru `G-966` (zob. §16) | Zob. §16 | S |
| Historia pomiarów w komentarzach nad asercjami | ODSTĘPSTWO | `sim/test/determinism.test.ts:51-69` (19 linii wersji v42–v53), `tools/test-time/src/exceptions.ts` (pomiary z datami w `reason`), wielolinijkowe historie w `ci.yml` (np. job `unit`, 13 linii o shardach) | Historia do commitów i ADR, w kodzie jedno zdanie „dlaczego” | S |

## Podsumowanie ocen

| Rozdział | ZGODNE | ODSTĘPSTWO | BRAK | NIE DOTYCZY |
|---|---|---|---|---|
| §2 | 11 | 6 | 0 | 0 |
| §3 | 12 | 2 | 1 | 1 |
| §4 | 11 | 4 | 1 | 0 |
| §5 | 5 | 3 | 2 | 0 |
| §6 | 5 | 2 | 0 | 0 |
| §16 | 5 | 3 | 0 | 0 |
| §21 | 5 | 5 | 0 | 0 |
| Razem (84) | 54 | 25 | 4 | 1 |

## Najważniejsze poprawki

1. **P0. Zielony main i stan CI na starcie sesji.** 46 ze 100 pushy na `main` czerwonych; trzy ostatnie przez twardy próg 75% bramki czasu (`m4-contracts` 15,2–16,7 s, `loot` 16,1 s, `i18n-scan` 15,2 s z 20 s). Profil i przyspieszenie tych testów, próg 75% liczony z tempem shardu, czwarty shard (shard 1 doszedł do 20 min), stan CI main na liście startowej `CLAUDE.md`, a przy czerwonym main nie scalać. Koszt M.
2. **P0. Złoty hash niezależny od wersji zapisu.** Hash ze stanu bez `SAVE_SCHEMA_VERSION` i metadanych; co najmniej 5 z 13 zmian złotej liczby od 16.11 to sama wersja. Historia z komentarza (19 linii) do commitów. Koszt S.
3. **P1. Test niezmienników z losowym wejściem i soak.** Kierowca-chuligan na podłodze i w 3 scenach (wartości skończone, gracz na gruncie, ten sam hash dwa razy); soak 20 min gry w Lublinie (NaN, najgorszy krok, liczba bytów, wyjście z każdego stanu). Dziś brak obu. Koszt S + M.
4. **P1. Jedno źródło kształtu.** `deckHeight` raz (engine importuje z `sim` lub `core`), kopia mulberry32 w `w3-line-anim.ts` na `@seki/core`, test przypinający wysokość rysowanego gruntu do `groundAt`. Koszt S (M z testem gruntu).
5. **P1. Zapadki wymuszają spadek.** Ubyły klucz w bazie skanu ma być czerwony do `scan:update`; brak pliku bazy w `code-health` i `i18n-scan` ma być czerwony, a nie zapisywać nowej bazy. Koszt S.
6. **P1. Dług limitów czasu zgodny z kodem.** Zapadka miejsc z nadpisanym `timeout` (vitest i e2e), dopisanie do ADR-0046 brakujących (60 s `beforeAll` VRM w 7 plikach engine, `deck-side`, 120 s w `m3-lustro-loop` i `quest-target`, 22 nadpisania e2e) z warunkiem zdjęcia albo ich usunięcie; wspólna pamięć modeli VRM w procesie. Koszt S + M.
7. **P1. Komenda zamiast zapisu stanu z app.** `session-loop.ts:63` (`dialogueActive = true`) przez `GameCommand`, żeby powtórka „ziarno + klatki” była pełna. Koszt S.
8. **P2. Limity wyczerpane do zera.** Raport pasa ≥90% w `tools/code-health`; podział `BabylonRenderer` (20 metod, konstruktor 120 linii), `Simulation` (20), `corrections.ts` (499) i `props-gen.ts` (498) przed następną zmianą w nich. Koszt M.
9. **P2. Audyty rozgrywki jako narzędzie.** `vitest.audit.config.ts` z sondami walki i skradania z ADR-0089, tryb A/B dwóch refów; potem autopilot zlecenia W-3 bez teleportu. Koszt M + L.
10. **P2. Zaczepy testowe poza APK i artefaktem.** `window.__seki` tylko w buildzie e2e (flaga budowania). Przy okazji: unikalność numerów w rejestrach (`G-966` dwa razy) i składanie `changelog.d` (273 fragmenty od 11.11). Koszt M + S.

## Czego nie sprawdzono

- Pełnego `pnpm test:coverage` i e2e lokalnie (uruchomione tylko lint, depcheck, `tools/code-health`, skan glitchy).
- Czy kolizja auta zeruje prędkość normalną (punkt „raz na styk”): ocena BRAK dotyczy braku strażnika, wielokrotnego liczenia nie stwierdzono.
- Kolejności iteracji bytów miniplex w każdym systemie zależnym od kolejności: przejrzane tylko jawne sortowania i kopiec A*.
