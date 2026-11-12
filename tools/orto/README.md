# tools/orto: pokrycie terenu z ortofotomapy (ADR-0077)

Narzędzie ma trzy kroki: pamięć podręczną ortofoto PZGiK, klasyfikator pokrycia i nakładkę liczbową (import kontra zdjęcie). Źródło i licencja: `data/osm/ATTRIBUTION.md`, sekcja PZGiK.

## Kroki
1. `node tools/orto/src/fetch.ts --cell krakowskie-0-1` pobiera kafle przez WMS do `${XDG_CACHE_HOME:-~/.cache}/seki-orto/<nalot>/` (inny katalog: `--cache`).
   - Komórka jest jednym kaflem 0,25 m/px na każdy nalot z `FLIGHTS` (`config.ts`).
   - Obszar podajesz jednym z parametrów: `--cell`, `--only <dzielnica>`, `--all`, `--bbox minX,minZ,maxX,maxZ` (układ gry) albo `--bbox-2180 minE,minN,maxE,maxN` (PUWG 1992), a dla prostokąta także `--name <nazwa>`.
   - Zapytania idą po jednym, z przerwą, bez ponowień po HTTP 429.
2. `node tools/orto/src/build.ts` klasyfikuje kafle offline do `data/orto/<obszar>.cover.{png,json}` i pisze manifest `data/orto/sources.json`.
3. `node tools/orto/src/report.ts --cell krakowskie-0-1 [--out plik.json]` daje raport komórki: gołą ziemię importu rozbitą na klasy, powierzchnie importu kontra zdjęcie, meble uliczne (OSM albo generator), puste chodniki i bariery.
   - `--all` robi raport wszystkich komórek mapy.
   - `--area <id>` albo `--added` liczy m² obszarów z `ADDED_AREAS`.

## Klasy i progi
- Klasy: zieleń, zieleń pod koronami (zielona tylko na letnich nalotach, nie na nalocie bez liści 2025-04; G-672), jasna nawierzchnia, asfalt, cień, nieznane, brak zdjęcia.
- Progi są w `src/thresholds.ts`, a zgodność z prawdą trzyma `test/cover-truth.test.ts`.
- Po zmianie progów puść `build.ts`, podbij `CLASSIFIER_VERSION` w `src/manifest.ts` i commituj rastry razem z progami.
