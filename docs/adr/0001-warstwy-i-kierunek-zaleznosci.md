# ADR-0001: Warstwy, porty i kierunek zależności

## Kontekst
Plan (§3, §4) wymaga testowalnej headless domeny, wymienności silnika i rozłącznych pakietów pod pracę agentową.

## Decyzja
- `core`: czyste TS, zero zależności. Definiuje porty (`RenderPort`, `InputPort`, `AudioPort`, `PersistencePort`, `ClockPort`, `RandomPort`), zdarzenia domenowe, komendy (`GameCommand`) i model zapisu.
- `sim` zależy tylko od `core` (+ `miniplex`, `mistreevous`).
- `engine` implementuje porty z `core` i korzysta ze stałych rigu kamery z `sim` (linia celowania TPP musi być wspólna dla symulacji i kamery).
- `narrative`, `persistence`, `ui` zależą tylko od `core`. UI zna wyłącznie store Zustand i interfejs `UiIntents`.
- `app` jest korzeniem kompozycji. Logika aplikacji (`GameSession`) nie używa przeglądarki ani Babylona, więc cała pętla M0 działa w teście Vitest.
- Babylon importowany jest wyłącznie w `engine/src/babylon.ts` (importy punktowe, tree-shaking: bundle 1,9 MB zamiast 7,4 MB).

Diagram z planu (`ui → app`) czytamy tak: UI jest montowane przez `app`, nie importuje `app`.

## Konsekwencje
Reguły egzekwuje `dependency-cruiser.config.cjs` (bramka CI), w tym zakaz nierozwiązywalnych i niezadeklarowanych importów (pnpm nie pozwala pakietowi sięgnąć do pakietu, którego nie zadeklarował).
