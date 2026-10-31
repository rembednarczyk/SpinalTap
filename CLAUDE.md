# Zasady pracy w repozytorium (ludzie i agenci)

Pełny kontekst: `docs/seki-senshi-plan.md` (§11–13) i `docs/adr/`.

## Start nowej sesji
Sesje w chmurze nie mają pamięci między sobą: trwałe jest tylko to, co jest wypchnięte do repo. Na starcie przeczytaj:
- `docs/backlog.md` (sekcja „Następne”): kolejność prac i decyzje użytkownika;
- `docs/glitches.md`: statusy glitchy, w tym „w naprawie” i „w PR #…”;
- `.claude/agents/orchestrator.md` („Lekcje z pracy”), jeśli prowadzisz agentów;
- otwarte PR-y w GitHubie.

Praca agentów w worktree, której nie zintegrowano i nie wypchnięto, ginie z kontenerem. Stan i decyzje zapisuj w rejestrze i backlogu na bieżąco.

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
- Bez god objectów (ADR-0031): plik źródłowy do 500 linii, funkcja i komponent do 120 (ESLint pilnuje; wyjątki tylko dla tabel z danymi). Klasa powyżej ok. 20 metod to sygnał do podziału. Nowa funkcja w app dostaje własny kontroler i prezenter, w UI wąski interfejs intencji i hook, w engine własną część za fasadą `BabylonRenderer`.
- Zmiana schematu zapisu: podbij `SAVE_SCHEMA_VERSION` i dodaj migrację w `packages/persistence/src/migrations.ts` z testem.
- Zmiana reguł symulacji zmienia złoty hash w `packages/sim/test/determinism.test.ts`; aktualizuj go świadomie (`vitest -u`) i napisz w commicie dlaczego.
- Zmiana wyglądu NPR: `pnpm build && pnpm exec playwright test e2e/npr-perf.spec.ts --update-snapshots=all`, a nową migawkę obejrzyj przed commitem.
- Teksty dla gracza (ADR-0056): angielski domyślny, polski w opcjach. Nowy tekst trafia do katalogów `i18n/{en,pl}` w obu językach, a `core` i `sim` trzymają klucze, nie zdania. Skan `tools/i18n-scan` liczy polskie literały poza katalogami: baza tylko spada (`I18N_BASELINE=update`). Polski katalog zmieniasz tylko świadomie, bo gracz z polskim ustawieniem nie powinien widzieć zmian przy samym tłumaczeniu.

## Testy (ADR-0046)
- Logikę i UI sprawdzaj testami sesji bez renderera (`packages/app/test`, fałszywy `RenderPort`) i testami komponentów (`packages/ui/test`). Przeglądarka tylko do rozruchu, rysowania (migawka NPR, budżety, modele), układu HUD na telefonie i dotyku.
- Testy krokują symulację (`freeze` + `step`) i czekają na stan gry, nie na zegar.
- Podniesienie limitu czasu albo budżetu nie jest poprawką. Najpierw ustal przyczynę (ślad, nagranie, pomiar). Wyjątek wymaga uzasadnienia w commicie i wpisu do długu w ADR-0046.
- Lokalne e2e: `pnpm e2e e2e/<spec>.spec.ts`. Skrypt trzyma jedną przeglądarkę na maszynę i daje własny port na checkout. Agenty puszczają tylko spece swojej zmiany; pełny zestaw puszcza CI.
- Czas klatki pod SwiftShaderem to raport. Bramką są wywołania rysowania i aktywne siatki.

## Glitche (ADR-0054)
- Rejestr: `docs/glitches.md`; triage: umiejętność `glitch-triage`; zespół: `.claude/agents/` (`orchestrator` jako główny agent sesji, `glitch-hunter`, `glitch-fixer`, `fix-verifier`).
- Skan `tools/glitch-scan/test/glitch-scan.test.ts` liczy znane rodzaje glitchy w całym mieście i porównuje z `glitch-baseline.json`: wzrost to czerwony test. Poprawka obniża bazę (`GLITCH_BASELINE=update`) w tym samym commicie, a nowy policzalny rodzaj dostaje kontrolę w skanie.
- Poprawka glitcha: test pada bez niej i przechodzi z nią, jeden glitch na commit.

## Definition of Done
Zielone: `pnpm typecheck`, `pnpm lint`, `pnpm depcheck`, `pnpm test:coverage`, `pnpm build`, e2e dotkniętych speców przez `pnpm e2e`, a pełne `pnpm test:e2e` w CI. Conventional Commits, małe zmiany.
