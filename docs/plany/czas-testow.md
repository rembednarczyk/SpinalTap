# Czas testów jednostkowych (12.11.2026)

Shardy „Unit tests (1/2)” w CI dochodziły do limitu 20 min (905–1001 s). Limitu nie podnosimy
(ADR-0046); ten plik zapisuje pomiar przed zmianą i po niej.

## Pomiar przed (origin/main b6b9365)

Pełne `vitest run --coverage` lokalnie, 4 rdzenie, load average na starcie 0,9 (w trakcie do 4,4,
czyli tyle, ile workerów vitest). Czasy z `TestModule.diagnostic()` (własny reporter): import to
`collectDuration` (import pliku testu z zależnościami i wykonanie bloków `describe`), testy to
`duration` (testy i hooki).

- Ściana: **1116 s** (18 min 36 s), 601 plików, 5422 testy, wszystkie zielone.
- Suma po plikach: import **1897 s (58%)**, testy 1274 s (40%), środowisko 27 s, przygotowanie 10 s.
- Import pliku w `packages/sim` i w testach, które go ciągną (app, engine, glitch-scan), to
  stałe 5–6 s: każdy plik od nowa wykonuje tabele miasta (`content/lublin/*.generated.ts`,
  1,6 MB) pod instrumentacją pokrycia. Próba na 40 plikach `packages/sim/test`: 77 s z
  izolacją, 29 s bez niej.

| Pakiet | Pliki | Razem [s] | Import [s] | Testy [s] |
|---|---:|---:|---:|---:|
| packages/sim | 158 | 1476 | 806 | 669 |
| packages/app | 96 | 726 | 534 | 184 |
| packages/engine | 131 | 633 | 388 | 242 |
| tools/glitch-scan | 41 | 178 | 102 | 75 |
| tools/osm-import | 42 | 100 | 43 | 56 |
| packages/ui | 37 | 51 | 13 | 19 |
| tools/i18n-scan | 1 | 15 | 1 | 14 |
| packages/narrative | 13 | 13 | 2 | 11 |
| packages/persistence | 26 | 5 | 4 | 0 |
| packages/core | 50 | 5 | 4 | 1 |
| reszta tools | 6 | 5 | 1 | 4 |

30 najwolniejszych plików (razem / import / testy, s):

| Razem | Import | Testy | Plik |
|---:|---:|---:|---|
| 84,5 | 5,2 | 79,4 | packages/sim/test/traffic-junction-drive.test.ts |
| 75,4 | 11,3 | 64,0 | tools/glitch-scan/test/glitch-scan.test.ts |
| 44,9 | 5,8 | 39,0 | packages/engine/test/model-background-load.test.ts |
| 39,7 | 5,4 | 34,3 | packages/sim/test/pinned-far-sleep.test.ts |
| 38,5 | 5,3 | 33,2 | packages/sim/test/flee-dead-zone.test.ts |
| 34,5 | 5,5 | 29,1 | packages/engine/test/model-release.test.ts |
| 32,0 | 5,4 | 26,6 | packages/sim/test/determinism.test.ts |
| 31,7 | 5,8 | 25,9 | packages/sim/test/save-load-contract-ended.test.ts |
| 30,5 | 5,8 | 24,7 | packages/sim/test/traffic.test.ts |
| 30,2 | 0,2 | 29,9 | packages/engine/test/seki-skirt.test.ts |
| 29,6 | 5,3 | 24,4 | packages/sim/test/flee-wall.test.ts |
| 28,1 | 5,1 | 23,0 | packages/sim/test/save-load-away-guards.test.ts |
| 26,8 | 5,0 | 21,7 | packages/sim/test/micro-body-streaming.test.ts |
| 24,4 | 6,0 | 18,4 | packages/app/test/alchemia-ramp-pass.test.ts |
| 23,7 | 5,4 | 18,3 | packages/sim/test/crowd.test.ts |
| 22,7 | 5,7 | 17,0 | packages/sim/test/save-load-crowd-panic.test.ts |
| 21,7 | 6,5 | 15,2 | packages/engine/test/model-kurosawa.test.ts |
| 20,9 | 0,3 | 20,5 | packages/engine/test/two-hand-motion.test.ts |
| 19,5 | 5,3 | 14,2 | packages/sim/test/stealth.test.ts |
| 19,2 | 5,6 | 13,6 | packages/sim/test/save-load-hack-fight.test.ts |
| 19,1 | 5,8 | 13,3 | packages/engine/test/model-variants.test.ts |
| 18,1 | 5,4 | 12,7 | tools/osm-import/test/props.test.ts |
| 17,7 | 5,3 | 12,3 | packages/sim/test/save-load-micro-body.test.ts |
| 17,3 | 5,7 | 11,6 | packages/sim/test/wave1-street.test.ts |
| 17,2 | 5,6 | 11,5 | packages/sim/test/m4-contracts.test.ts |
| 16,8 | 6,0 | 10,8 | packages/app/test/alchemia-ramp-traffic.test.ts |
| 15,1 | 5,2 | 9,8 | packages/sim/test/m4-docks.test.ts |
| 14,9 | 0,8 | 14,1 | tools/i18n-scan/test/i18n-scan.test.ts |
| 14,9 | 5,8 | 9,2 | packages/engine/test/fpp-sight-clear.test.ts |
| 14,9 | 5,5 | 9,4 | packages/sim/test/push-out-bodies-solids.test.ts |

Wniosek: większość czasu to powtarzany import tych samych modułów, nie same testy. Pełne
`generate(...)` miasta woła tylko `tools/osm-import/test/venues.test.ts` (raz); reszta testów
generatora buduje małe mapy albo kilka chunków.

## Zmiany i pomiar po

Ten sam pomiar (pełne `vitest run --coverage`, 4 rdzenie, load na starcie 2–3, pamięć miasta
zimna jak w CI):

| Stan | Ściana [s] | Import, suma [s] | Testy, suma [s] |
|---|---:|---:|---:|
| przed (b6b9365) | 1116 | 1897 | 1274 |
| `isolate: false` dla core, sim, engine, persistence, tools | 697 (-38%) | 655 | 1327 |
| + wspólna pamięć miasta (`tools/osm-import/test/city.ts`) | 660 (-41%) | 595 | 1280 |

Testy te same: 5422, wszystkie zielone, ta sama lista nazw. Pokrycie bez spadku (gałęzie
92,66% -> 92,68%).

- **Bez izolacji** (projekt `shared` w `vitest.config.ts`): core, sim, engine, persistence i
  tools. Każdy pakiet 3 razy z `--sequence.shuffle` i raz w całym zestawie. Suma czasu plików:
  sim 1476 -> 697 s, engine 633 -> 279 s, glitch-scan 178 -> 90 s, osm-import 100 -> 78 s,
  core 5,0 -> 1,1 s, persistence 5,1 -> 0,6 s.
- **Z izolacją** (projekt `isolated`): ui i app (jsdom, React; app to dziś największy import,
  529 s sumy, do sprawdzenia osobno), narrative (`ink-cache.test.ts` liczy kompilacje inkjs
  przez `vi.mock`, a wspólny worker trzymałby już skompilowane historie z innych plików) i każdy
  nowy pakiet.
- **Pamięć miasta**: pełne `generate` (venues) i `generateProps` planu (props, props-e2,
  props-rows, props-market) liczone raz na proces, między procesami z
  `node_modules/.cache/seki-city`. W CI pamięć jest zimna, więc zysk to tylko powtórzenia w
  procesie: osm-import 78 -> 66 s sumy. Lokalnie przy ciepłej pamięci venues 8 s -> 0,04 s.

Shardy jak w CI (`--shard=i/2`, `VITEST_COVERAGE_SHARD=1`), lokalnie: shard 1 627 s z izolacją,
379 s po zmianach; shard 2 286 s po zmianach. Podział vitest jest po skrócie ścieżki, nie po
czasie: shard 1 ma dwa najdłuższe pliki (traffic-junction-drive 86 s, glitch-scan 66 s), stąd
różnica 93 s. W CI shard 1 trwał 905–1001 s, czyli ok. 1,5 raza dłużej niż lokalnie; po
zmianach to ok. 570 s (9,5 min) i 430 s (7 min), poniżej 15 min.
