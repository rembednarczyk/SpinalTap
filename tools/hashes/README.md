# tools/hashes: skróty testów złotych po scaleniu main

Stałe narzędzie zamiast ręcznego przepisywania skrótów (backlog 13.11, punkt 8).

```
pnpm hashes:check [--write [--bare]] [--out plik.json]
```

Użycie: po `git merge origin/main` w gałęzi puść `pnpm hashes:check`. Gdy wynik jest zrozumiały, puść `pnpm hashes:check --write`, a potem w commicie napisz, dlaczego skrót się zmienił (`docs/agenci-zasady.md`).

- Testy: `packages/engine/test/ground-cut.test.ts` (`CUT_BEFORE`), `packages/engine/test/map-ground-golden.test.ts`, `packages/sim/test/determinism.test.ts`.
- Narzędzie nie zmienia semantyki testów. Każdy plik biegnie raz jako kopia obok (`*.hashes-check.test.ts`), w której każde `expect(` to `expect.soft(`, więc jeden przebieg pokazuje wszystkie padające asercje, nie tylko pierwszą w teście. Kopie znikają na końcu, także po błędzie i Ctrl-C. Nie puszczaj w tym czasie całego `pnpm test` w tym checkoucie, bo zbierze też kopie.
- Reporter Vitest (`src/reporter.ts`) zbiera dla każdej asercji linię, `expected` i `actual`. `src/values.ts` rozkłada je na skróty (8 cyfr szesnastkowych, też po liczbie, jak `"6 408ae390"`), liczby (cięcia, siatki, wierzchołki) i resztę. Werdykty:
  - `liczby bez zmian`: różnią się tylko skróty, a liczby są te same. Tylko to `--write` zapisuje;
  - `bez liczb w teście`: sam skrót (determinism, mały świat w `map-ground-golden`). Narzędzie zapisuje go tylko z `--write --bare`, bo nie ma czego porównać;
  - `LICZBY ZMIENIONE`: inna liczba albo inny zestaw kluczy. Narzędzie odmawia i wypisuje różnicę;
  - `nie skrót`: pada inna asercja (np. `tick` w determinism). Wtedy w całym pliku nic nie jest zapisywane.
- Nowy skrót trafia do linii asercji. Gdy jej tam nie ma (`CUT_BEFORE`), trafia w jedyne miejsce w pliku. Skrót niejednoznaczny narzędzie odrzuca. Po zapisie puszcza zapisane pliki jeszcze raz.
- Kod 0, gdy nic nie pada albo wszystko zapisano i testy przechodzą. W przeciwnym razie kod 1. `--out` zapisuje całość w JSON.
- Liczba wątków: `VITEST_MAX_WORKERS` (tools/test-rerun).
