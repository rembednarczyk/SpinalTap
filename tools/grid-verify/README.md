# grid-verify

Lista kontrolna nowej siatki mapy uruchamiana od końca do końca: `pnpm grid:verify <nazwa> [--full] [--start | --stop]`.

- `src/checklist.ts`: punkty (faza, opis, skąd się wziął, komenda albo decyzja).
- `src/evaluate.ts`: status punktu z przebiegu i decyzji, podział nowych miejsc skanu, podsumowanie.
- `src/verify.ts`: CLI; pisze `reports/grid-<nazwa>.json` i `.md` (poza gitem).
- `test/grid-probe.test.ts`: sondy siatki (`GRID_NAME`), bez zmiennej pominięte.
- `hook.sh`: hook Stop z `.claude/settings.json`, aktywny tylko z plikiem `.claude/grid-active`.

Przebieg pracy: `.claude/skills/nowa-siatka/SKILL.md`. Deklaracje: `docs/siatki/`.
