# ADR-0007: Budżety wydajności M0

## Decyzja
Budżety w `tools/perf-budgets.json`, sprawdzane przez `e2e/npr-perf.spec.ts` na dwóch scenach (kadr referencyjny i ulica w TPP). Pierwsze pomiary (Chromium + SwiftShader):

| Scena | Draw calls | Aktywne siatki | Budżet draw calls | Budżet siatek |
|---|---|---|---|---|
| reference | 106 | 45 | 160 | 80 |
| street-tpp | 246 | 105 | 320 | 140 |

Czas klatki ma w CI luźny sufit 60 ms, bo SwiftShader renderuje na CPU. Raport trafia do `reports/perf.json` i artefaktów CI.

## Konsekwencje
Progi do rewizji po profilowaniu na GPU. Największy koszt to kontury i osobne siatki części postaci; pierwszym krokiem optymalizacji będzie scalanie części postaci (`Mesh.MergeMeshes` z multi-materiałem) i instancjonowanie budynków.
