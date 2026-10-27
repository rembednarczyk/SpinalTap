# ADR-0005: Questy i dialogi bez XState

## Decyzja
Graf questów to dane (`core/src/quest/definitions.ts`) plus czysta funkcja `evaluateQuests(log, definitions, flags)`. Warunki kroków opierają się na flagach świata (`met_fixer`, `killed:<tag>`); kroki nie dają się przeskoczyć, `completed` jest stanem końcowym. Ink odpowiada za treść i lokalne rozgałęzienia rozmów, struktura należy do `core`.

## Konsekwencje
Zero zależności, pełna testowalność i serializowalność (stan questa to `{status, stepIndex}`). Do XState wrócimy, jeśli M3 przyniesie równoległe stany lub potrzebę wizualizacji automatów.
