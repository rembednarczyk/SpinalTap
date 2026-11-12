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
