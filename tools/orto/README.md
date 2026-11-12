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
   - Raport komórki kończy się stałymi sekcjami (`src/sections.ts`), żeby opiekun i kurator czytali liczby zamiast pisać sondy. Każda ma krótką tabelę i jednozdaniowy werdykt w tekście i w `--out` (pole `sections`):
     1. **Obrysy wobec LoD2** (`fit.ts`): maski obrysów gry i LoD2 na siatce 0,5 m, oba zbiory ze środkiem w tym samym prostokącie (komórka ± 30 m), IoU w komórce przy (0; 0), najlepsze przesunięcie LoD2 w ±8 m, IoU połówek, m² tylko w grze i tylko w LoD2; pary `matchFootprints` (IoU ≥ 0,3): liczba, mediana odległości środków, dx, dz.
     2. **Przechył nalotów** (`lean.ts`): dla każdego nalotu w pamięci podręcznej przesunięcie obrazu (±8 m, co 0,25 m), przy którym gradient jasności najlepiej leży na krawędziach obrysów LoD2: dach obrysu widać przy obrysie + (dx; dz). Zalecany nalot ma najmniejszy przechył. Poniżej 2000 próbek krawędzi w komórce przechył jest niepewny i nalotu nie zalecamy.
     3. **Goły teren** (`bare-parts.ts`): próbki 0,5 m bez budynku i bez nawierzchni, otwarcie maski o 1 m (kwadrat 2,5 m), składowe ≥ 50 m². Klasa ze styku obwodu (patrząc za pasy usunięte otwarciem): `lod2` (co najmniej połowa w obrysach LoD2), `yard` (≥ 60% obwodu na ścianach), `frontage` (≥ 15% na ścianach i otwarte na jezdnię, chodnik albo parking), `gap` (przy jezdni, szersze niż `KERB_REACH`), `other`. Dla każdej składowej: m², udział ścian i jezdni, szerokość, m² w LoD2 i w `landuse-bare`, klasy ortofoto zalecanego nalotu (twarde, zieleń, inne) bez próbek pod dachem przesuniętym o przechył; bez kafli klasy z rastra pokrycia.
     4. **Budynki bez budynku gry** (`absent.ts`): LoD2 ≥ 30 m² ze środkiem prostokąta w komórce, budynki gry < 25%, poza `CLEARED_BUILDINGS`, z LoD1 2024 ≥ 50% (lista) albo bez niego (liczba, zapewne rozebrane). NMPT nie ma w `data/`, więc porównanie wysokości z NMPT jest pominięte, co sekcja mówi wprost.
     5. **Znane rodzaje** (`known.ts`): trafienia skanu w komórce z `reports/map-coverage-hits.json` (najpierw `pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts`) z odsyłaczami z całego rejestru, nie tylko z komórki: wpisy `docs/glitches.md` i archiwum z rodzajem w backtickach (poza wpisami także wiersze tabeli proponowanych kontroli), wiersze `docs/topografia.md`, zdania notatek i przeglądów wszystkich komórek w `docs/mapa-pokrycie.json` (też ze skrótami, np. „kerb-gap”, „kerb-fill”, „ground-strip”) i komentarz kontroli w skanie. Do 3 odsyłaczy na rodzaj, najpierw te z miejscem (x; z) w komórce albo z jej id (oznaczone `*`). Werdykt wymienia rodzaje bez odsyłacza w ogóle (kandydaci na nowe znalezisko) i rodzaje znane tylko z innych miejsc.
   - Liczby sekcji dla stare-miasto-1-0 porównuje z sondami kuratorów z 12.11 `test/sections.test.ts`.
   - `--area <id>` albo `--added` liczy m² obszarów z `ADDED_AREAS`.

## Klasy i progi
- Klasy: zieleń, zieleń pod koronami (zielona tylko na letnich nalotach, nie na nalocie bez liści 2025-04; G-672), jasna nawierzchnia, asfalt, cień, nieznane, brak zdjęcia.
- Progi są w `src/thresholds.ts`, a zgodność z prawdą trzyma `test/cover-truth.test.ts`.
- Po zmianie progów puść `build.ts`, podbij `CLASSIFIER_VERSION` w `src/manifest.ts` i commituj rastry razem z progami.
