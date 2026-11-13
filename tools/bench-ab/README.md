# tools/bench-ab: pomiar czasu A/B dwóch refów

Stałe narzędzie zamiast skryptów `ab.sh`, `ab3.sh`, `med3.py` (backlog 13.11, punkt 4). Czas na wspólnej maszynie to raport (ADR-0046), więc mierzymy pary, nie pojedyncze przebiegi.

```
pnpm bench:ab <ref-A> <ref-B> --vitest <plik testu> --name "<część nazwy testu>" [opcje]
pnpm bench:ab <ref-A> <ref-B> [opcje] -- <polecenie> [argumenty...]
```

Przykład: `pnpm bench:ab origin/main HEAD --vitest tools/osm-import/test/venues.test.ts --name "sign nearly" --before-each "rm -rf node_modules/.cache/seki-city" --work <scratchpad>/ab-work`.

- `--vitest`: czas samego testu z raportu JSON Vitesta (nazwa musi wskazać dokładnie jeden test). Polecenie po `--`: czas zegarowy całego polecenia.
- `HEAD` to bieżący checkout. Inny ref trafia do odłączonego worktree w `--work` (domyślnie `$BENCH_WORK`, inaczej katalog tymczasowy systemu), usuwanego na końcu, także przy błędzie.
- Opcje: `--pairs 12`, `--max-load 4` (para startuje dopiero przy load average 1 min poniżej progu), `--max-wait 1800` (sekundy czekania na próg; potem para idzie i jest liczona jako ponad progiem), `--before-each "<shell>"` (przed każdym przebiegiem, bez pomiaru, w katalogu refu), `--out <plik.json>` (domyślnie `<work>/bench-ab.json`).
- Kolejność w parach się zmienia: A B, B A, A B…

## Wynik
Mediana zmiany w parze B / A − 1 (nie zmiana median), rozrzut (min, kwartyle, max), mediany czasów i zakres load (`src/stats.ts`). Jedna linia do raportu, np.:

```
B vs A: +7,5% (1000 ms / 1075 ms, 12 par, load 1,2–3,9); rozrzut −5,0…+20,0%, połowa par +2,1…+12,5%
```

JSON w `--out` ma tę linię, podsumowanie i każdą parę. Nieudany przebieg przerywa pomiar (kod 1).
