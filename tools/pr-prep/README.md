# tools/pr-prep: gałąź przed scaleniem PR

Stałe narzędzie zamiast ręcznych poleceń git przed scaleniem (backlog 13.11, punkt 7). Działa na samym git, bez API GitHuba.

```
pnpm pr:prep <gałąź> [--no-fetch] [--prefix <p>] [--out plik.json]
```

Przykład: `pnpm pr:prep ccr-ec2c4269-ilh8k8-g745` (też `origin/…`).

- Najpierw `git fetch --prune origin` (pomija go `--no-fetch`).
- Dalej narzędzie podaje:
  - pełny SHA głowy `origin/<gałąź>` i liczbę commitów przed i za `origin/main`;
  - czy gałąź scala się czysto z `origin/main` (`git merge-tree --write-tree`), a jeśli nie, które pliki są w konflikcie;
  - pliki wspólne z innymi otwartymi gałęziami o tym samym przedrostku (`git branch -r`; przedrostek `ccr-<id>-<id>-` z nazwy gałęzi albo `--prefix`). Gałąź jest otwarta, gdy nie jest przodkiem `origin/main`, a jej scalenie zmienia drzewo main, więc gałąź po squash merge odpada (pole `notOpen`);
  - które pliki wygenerowane, złote skróty i bazy gałąź zmienia (`src/analyze.ts`, lista `GUARDED`): tablice `lublin/*.generated.ts`, rastry `data/orto`, `determinism`, `ground-cut`, `map-ground-golden`, migawkę NPR, bazy skanu glitchy, i18n, god objects i budżety;
  - po scaleniu których gałęzi trzeba ponowić CI tej gałęzi: wspólny plik, rzecz strzeżona zmieniana przez obie albo zmieniana przez jedną, gdy druga zmienia jej wejścia (np. ta zmienia `map-ground-golden`, tamta tablice importu). Wtedy po scaleniu tamtej puść `pnpm hashes:check` i CI.
- Wyjście: jedna linia na stdout, szczegóły w JSON do `--out` (domyślnie `reports/pr-prep-<gałąź>.json`).
