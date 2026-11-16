# tools/shots: zrzuty przed i po zmianie

Stałe narzędzie zamiast jednorazowych skryptów `*-shoot.sh` (backlog 13.11, punkt 3).

```
pnpm shots:compare <ref-przed> <ref-po> <punkty.json> [--hour 13 | --night] [--out <katalog>] [--work <katalog>] [--port <n>]
```

Przykład: `pnpm shots:compare origin/main HEAD /ścieżka/punkty.json --out /dev/shm/g999 --work <scratchpad>/g999-work`.

- Punkty w formacie `GLITCH_SPOTS`: `[[nazwa, x, z, yaw, pitch, y?]]` (`e2e/glitch-shots.spec.ts`). Nazwa to `[A-Za-z0-9._-]+`, bez powtórzeń.
- `HEAD` to bieżący checkout z niezatwierdzonymi zmianami. Inny ref trafia do odłączonego worktree w `--work` (domyślnie `$SHOTS_WORK`, inaczej katalog tymczasowy systemu) z `pnpm install --frozen-lockfile --prefer-offline`.
- Dla każdego refu po kolei: `pnpm build`, `pnpm e2e e2e/glitch-shots.spec.ts` z `SHOTS`, `SHOT_HOUR` (domyślnie 13, `--night` to 22), własnym `E2E_PORT` i `--output=/dev/shm/...`. Potem znika worktree, `dist` i wynik Playwrighta, także przy błędzie i Ctrl-C.
- Stary ref bez speca dostaje dzisiejszy spec (pole `specCopied` w raporcie).

## Wynik w `--out`
- `before/`, `after/`: PNG i JSON speca;
- `pair/<nazwa>.png`: przed | po, każde 800 px szerokości; `grid.png`: wszystkie pary pod sobą;
- `report.json`: refy, SHA, load na starcie i na końcu, liczby dla każdego punktu;
- `before.log`, `after.log`: instalacja, build i e2e.

Na wyjściu jedna linia na punkt. Kod 1, gdy ref się nie zbudował albo nie zrobił zdjęć, albo punkt nie ma pary.

## Liczby (`src/metrics.ts`, progi jak w sondach G-721 i G-734)
- `changedPct`: piksele z |dR| + |dG| + |dB| > 24, % kadru;
- `burntLowPct`: przepalenie, czyli R ≥ 250 i G ≥ 250, w dolnej połowie kadru (ziemia), przed i po;
- `burntAmongChangedPct`: dolne piksele zmienione i przepalone po zmianie;
- `meanLuma`: średnia luma Rec. 709 całego kadru; `changedLowLuma`: luma zmienionych pikseli dolnej połowy przed i po.

`src/checkout.ts` (worktree refu, sprzątanie, load) dzieli z `tools/bench-ab`.
