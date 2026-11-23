# Deklaracje nowych siatek mapy

Każda nowa siatka chunków (rząd albo blok komórek dodanych do miasta) ma tu plik `<nazwa>.json`. Czyta go
`pnpm grid:verify <nazwa>` (`tools/grid-verify`), a pracę prowadzi umiejętność `.claude/skills/nowa-siatka/SKILL.md`.

```json
{
  "nazwa": "podzamcze-polnoc",
  "chunki": ["podzamcze-0-2", "podzamcze-1-2", "podzamcze-2-2"],
  "baza": "origin/main",
  "decyzje": {
    "kurator": { "status": "zrobione", "odnosnik": "przegląd z 23.11, T-340–T-343" },
    "skan-siatka": { "status": "przyjete", "odnosnik": "G-965", "uwagi": "krótko, dlaczego" }
  }
}
```

- `chunki`: identyfikatory z `docs/mapa-pokrycie.json` (każdy musi tam być ze statusem).
- `baza`: ref, względem którego skan liczy nowe miejsca (domyślnie `origin/main`).
- `decyzje`: rozstrzygnięcia punktów listy (`tools/grid-verify/src/checklist.ts`), klucz to `id` punktu.
  - `zrobione`: punkt bez komendy wykonany (przegląd, zrzuty, karty, dokumentacja).
  - `przyjete`: punkt świadomie zostawiony (np. glitch zgłoszony do osobnej naprawy). Działa też dla punktu z komendą, która pada.
  - `odnosnik` jest wymagany: G-…, T-…, PR, plik. Bez niego decyzja się nie liczy.

Statusy w raporcie (`reports/grid-<nazwa>.json` i `.md`, poza gitem): `ok`, `zrobione`, `przyjete` rozstrzygają punkt;
`blad`, `do-zrobienia`, `nie-uruchomione` (bramki tylko z `--full`) nie.
