# Zasady pracy w repozytorium (ludzie i agenci)

Pełny kontekst: `docs/seki-senshi-plan.md` (§11–13) i `docs/adr/`.

## Własność pakietów
| Obszar | Pakiet / katalog |
|---|---|
| Architekt | root, `docs/adr`, `packages/core/src/ports`, `packages/core/src/events`, `packages/core/src/commands` |
| Core Domain | `packages/core` (poza kontraktami) |
| Simulation / ECS | `packages/sim` (poza `systems/ai`) |
| AI / NPC | `packages/sim/src/systems/ai` |
| Rendering / NPR | `packages/engine/src/{renderer,npr,effects}` |
| Physics & Controller | `packages/engine/src/camera` |
| Input | `packages/engine/src/input` |
| Audio | `packages/engine/src/audio` |
| Narrative | `packages/narrative` |
| UI / HUD | `packages/ui` |
| Persistence | `packages/persistence` |
| Infra / Build | `packages/app`, `tools`, `.github`, konfiguracje w root |
| QA | `e2e`, testy przekrojowe |

Zmiana w cudzym obszarze idzie przez zmianę kontraktu (port, typ zdarzenia, komenda) z ADR-em, jeśli zmienia granice.

## Reguły twarde
- `core` nie importuje niczego spoza siebie. `sim` tylko `core`. UI nie zna `engine` ani `sim`.
- Babylon importuje wyłącznie `packages/engine/src/babylon.ts`.
- W `core` i `sim`: bez `any`, bez `Math.random`, `Date.now`, `performance.now`. Losowość przez `RandomPort`, czas przez `ClockPort`.
- Kolejność systemów ECS tylko w `createSystems()`.
- Zmiana schematu zapisu: podbij `SAVE_SCHEMA_VERSION` i dodaj migrację w `packages/persistence/src/migrations.ts` z testem.
- Zmiana reguł symulacji zmienia złoty hash w `packages/sim/test/determinism.test.ts`; aktualizuj go świadomie (`vitest -u`) i napisz w commicie dlaczego.
- Zmiana wyglądu NPR: `pnpm build && pnpm exec playwright test e2e/npr-perf.spec.ts --update-snapshots=all`, a nową migawkę obejrzyj przed commitem.

## Definition of Done
Zielone: `pnpm typecheck`, `pnpm lint`, `pnpm depcheck`, `pnpm test:coverage`, `pnpm build`, `pnpm test:e2e`. Conventional Commits, małe zmiany.
