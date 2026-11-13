# tools/test-rerun: testy jednostkowe pod obciążeniem

Backlog 13.11, punkt 5. Przy obciążonej maszynie testy padają na limicie czasu. Takie porażki narzędzie oddziela od asercji i puszcza ponownie.

```
pnpm test:rerun <pakiet | ścieżka | filtr>... [--log-dir <katalog>] [-- <opcje vitest>]
```

Przykłady: `pnpm test:rerun sim app`, `pnpm test:rerun packages/sim/test/determinism.test.ts`, `VITEST_MAX_WORKERS=2 pnpm test:rerun ui`.

- Sama nazwa katalogu z `packages/` albo `tools/` oznacza ten katalog. Reszta idzie do Vitesta bez zmian.
- Jeden `vitest run` wszystkiego z reporterem JSON. Porażki „Test timed out in …ms” i „Hook timed out in …ms” to przekroczenia czasu, każda inna porażka (asercja, błąd, plik, który się nie wczytał) jest prawdziwa (`src/classify.ts`).
- Plik z samymi przekroczeniami czasu idzie jeszcze raz sam, z `--maxWorkers=1`.
- Kod 0 tylko wtedy, gdy po ponowieniu nic nie pada. Asercja, błąd, przekroczenie, które zostaje przy pliku puszczonym osobno, i porażka poza plikami (nieobsłużony błąd, próg pokrycia) dają kod 1.
- Na wyjściu krótkie podsumowanie, asercje osobno (`ASSERTION plik > test: komunikat`). Pełny wynik Vitesta trafia do `reports/test-rerun/vitest.log`.

## Limit wątków na agenta
`VITEST_MAX_WORKERS=<n>` ogranicza liczbę wątków Vitesta. Vitest 5 czyta tę zmienną sam i ma ona pierwszeństwo przed `--maxWorkers` i konfiguracją, więc `vitest.config.ts` nie potrzebuje zmian. W CI zmienna nie jest ustawiona i CI działa jak dotąd. Ponowienia ustawiają ją na 1.
