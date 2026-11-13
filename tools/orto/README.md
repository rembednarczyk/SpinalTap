# tools/orto: pokrycie terenu z ortofotomapy (ADR-0077)

Narzędzie ma trzy kroki: pamięć podręczną ortofoto PZGiK, klasyfikator pokrycia i nakładkę liczbową (import kontra zdjęcie). Źródło i licencja: `data/osm/ATTRIBUTION.md`, sekcja PZGiK.

## Kroki
1. `node tools/orto/src/fetch.ts --cell krakowskie-0-1` pobiera kafle przez WMS do `${XDG_CACHE_HOME:-~/.cache}/seki-orto/<nalot>/` (inny katalog: `--cache`).
   - Komórka jest jednym kaflem 0,25 m/px na każdy nalot z `FLIGHTS` (`config.ts`).
   - Obszar podajesz jednym z parametrów: `--cell`, `--only <dzielnica>`, `--all`, `--bbox minX,minZ,maxX,maxZ` (układ gry) albo `--bbox-2180 minE,minN,maxE,maxN` (PUWG 1992), a dla prostokąta także `--name <nazwa>`.
   - Zapytania idą po jednym, z przerwą, bez ponowień po HTTP 429.
2. `node tools/orto/src/build.ts` klasyfikuje kafle offline do `data/orto/<obszar>.cover.{png,json}` i pisze manifest `data/orto/sources.json`.
3. `node tools/orto/src/report.ts --cell krakowskie-0-1 [--out plik.json]` daje raport komórki: gołą ziemię importu rozbitą na klasy, powierzchnie importu kontra zdjęcie, meble uliczne (OSM albo generator), puste chodniki i bariery (każda linia OSM, której gra nie rysuje, z id, rodzajem i metrami w komórce).
   - `--all` robi raport wszystkich komórek mapy.
   - Raport komórki kończy się stałymi sekcjami (`src/sections.ts`), żeby opiekun i kurator czytali liczby zamiast pisać sondy. Każda ma krótką tabelę i jednozdaniowy werdykt w tekście i w `--out` (pole `sections`):
     1. **Obrysy wobec LoD2** (`fit.ts`): maski obrysów gry i LoD2 na siatce 0,5 m, oba zbiory ze środkiem w tym samym prostokącie (komórka ± 30 m), IoU w komórce przy (0; 0), najlepsze przesunięcie LoD2 w ±8 m, IoU połówek, m² tylko w grze i tylko w LoD2; pary `matchFootprints` (IoU ≥ 0,3): liczba, mediana odległości środków, dx, dz. Gdy najlepsze przesunięcie poprawia IoU o mniej niż 0,02 (`FIT.SHIFT_GAIN`), werdykt nie mówi o przesunięciu, tylko „niskie IoU z braku danych LoD2 pod N budynkami gry” (lista w sekcji 4).
     2. **Przechył nalotów** (`lean.ts`): dla każdego nalotu w pamięci podręcznej przesunięcie obrazu (±8 m, co 0,25 m), przy którym gradient jasności najlepiej leży na krawędziach obrysów LoD2: dach obrysu widać przy obrysie + (dx; dz). Zalecany nalot ma najmniejszy przechył. Poniżej 2000 próbek krawędzi w komórce przechył jest niepewny i nalotu nie zalecamy.
     3. **Goły teren** (`bare-parts.ts`): próbki 0,5 m bez budynku i bez nawierzchni, otwarcie maski o 1 m (kwadrat 2,5 m), składowe ≥ 50 m². Klasa ze styku obwodu (patrząc za pasy usunięte otwarciem): `lod2` (co najmniej połowa w obrysach LoD2), `yard` (≥ 60% obwodu na ścianach), `frontage` (≥ 15% na ścianach i otwarte na jezdnię, chodnik albo parking), `gap` (przy jezdni, szersze niż `KERB_REACH`), `other`. Dla każdej składowej: m², udział ścian i jezdni, szerokość, m² w LoD2 i w `landuse-bare`, klasy ortofoto zalecanego nalotu (twarde, zieleń, inne) bez próbek pod dachem przesuniętym o przechył; bez kafli klasy z rastra pokrycia.
     4. **Budynki bez budynku gry** (`absent.ts`): LoD2 ≥ 30 m² ze środkiem prostokąta w komórce, budynki gry < 25%, poza `CLEARED_BUILDINGS`, z LoD1 2024 ≥ 50% (lista) albo bez niego (liczba, zapewne rozebrane). NMPT nie ma w `data/`, więc porównanie wysokości z NMPT jest pominięte, co sekcja mówi wprost. Odwrotnie (podsekcja „budynki gry bez LoD2”): budynki gry ze środkiem w komórce, których obrys LoD2 pokrywa w < 25%, z id, środkiem (x; z), m², udziałem LoD2 i najbliższym budynkiem LoD1 2024 w 12 m (id, m², odległość) albo „brak” (sprawdź, czy stoi).
     5. **Znane rodzaje** (`known.ts`): trafienia skanu w komórce z `reports/map-coverage-hits.json` (najpierw `pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts`) z odsyłaczami z całego rejestru, nie tylko z komórki: wpisy `docs/glitches.md` i archiwum z rodzajem w backtickach (poza wpisami także wiersze tabeli proponowanych kontroli), wiersze `docs/topografia.md`, zdania notatek i przeglądów wszystkich komórek w `docs/mapa-pokrycie.json` (też ze skrótami, np. „kerb-gap”, „kerb-fill”, „ground-strip”) i komentarz kontroli w skanie. Do 3 odsyłaczy na rodzaj, najpierw te z miejscem (x; z) w komórce albo z jej id (oznaczone `*`). Werdykt wymienia rodzaje bez odsyłacza w ogóle (kandydaci na nowe znalezisko) i rodzaje znane tylko z innych miejsc. Z `reports/glitch-scan.json` (`places.ts`) każdy rodzaj dostaje do 5 kwadratów 10 m z największą liczbą próbek (róg (x; z) i próbki) i do 5 id, które podaje skan: łańcuch pasów (`Podzamcze#107:1>Ruska#110:1`), pierwszy element OSM (`w…`, `n…`, `r…`) i wiersze T.
   - Liczby sekcji dla stare-miasto-1-0 porównuje z sondami kuratorów z 12.11 `test/sections.test.ts`.
   - `--area <id>` albo `--added` liczy m² obszarów z `ADDED_AREAS`.
4. `node tools/orto/src/albedo-report.ts [--out plik.json]` podaje medianę barwy każdej nawierzchni importu na ortofoto całej mapy, osobno dla nalotów 2025-04 i 2024-06 (`src/albedo.ts`).
   - Liczą się próbki co najmniej 1 m wewnątrz kawałka, w klasie, którą nawierzchnia powinna mieć: jasna pod placami i ścieżkami, asfalt pod jezdniami, zieleń pod trawnikami.
   - Raport podaje też jasność (luma Rec. 709) do trawy i udział klas pod każdą nawierzchnią.
   - Na tych medianach stoi paleta nawierzchni renderera (`ORTHO_PAVING` w `ground-plan.ts`, G-721). Gdy mediany się zmienią, przepisz je tam.
   - `--write-medians [plik]` zapisuje zatwierdzone mediany do `data/orto/albedo-medians.json` (`src/albedo-medians.ts`). Plik ma ok. 3 KB i jest deterministyczny: dla każdego nalotu dzień zdjęcia, a dla każdej nawierzchni medianę RGB, lumę, stosunek do trawy i liczbę próbek. Nalot odniesienia `reference` to pierwszy, bieżący obraz 2025-04, na którym skalibrowano paletę. Bez kafli w pamięci podręcznej narzędzie odmawia zapisu.
   - Na tym pliku stoi kontrola skanu `paving-albedo-drift` (`tools/glitch-scan/test/paving-albedo.ts`). Bierze barwę, jaką renderer kładzie (`planSurface`), dla nawierzchni z `ORTHO_PAVING` i dla każdej innej kładzionej nawierzchni z medianą (np. `road`). Trafieniem jest stosunek do trawy różny od mediany nalotu odniesienia o więcej niż 0,25. Niecka fontanny (`basin`) jest wyłączona, bo zostaje ciemna z decyzji użytkownika z 13.11. Po zmianie importu albo palety puść `--write-medians` i scommituj plik razem ze zmianą.

## Dwie wersje mapy: `pnpm orto:diff`
```
pnpm orto:diff <ref-A> <ref-B> [--cell <id>] [--box x0,z0,x1,z1] [--out plik.json] [--work katalog]
```
Przykład dla przeglądu `topography-curator`: `pnpm orto:diff origin/main HEAD --cell nabrzeze-0-1 --out <scratchpad>/topo-123-diff.json --work <scratchpad>/topo-123-work`.

- Bez buildu i bez `node_modules` refu: `src/diff-snapshot.ts` rozpakowuje `git archive` refu (`packages/core`, `packages/sim`, `tsconfig.base.json`) do `--work` (domyślnie katalog tymczasowy systemu) i czyta przez moduły Vite tablice `*.generated.ts`, teren gry (`SHAPED_TERRAIN`) i pomosty (`GROUND_DECKS`). Katalog znika zaraz po odczycie. `HEAD` to bieżący checkout z niezatwierdzonymi zmianami.
- `--cell` i `--box` (układ gry) zawężają wynik; oba naraz to ich część wspólna.
- Liczby (`src/diff-map.ts`):
  - **nawierzchnia**: próbki 0,5 m rastra pokrycia z `data/orto` (tego checkoutu), na których wierzch się zmienia. Wierzch to ostatni kawałek ziemi w kolejności importu, a budynek (`building`) przykrywa wszystko, jak w raporcie komórki. Dla każdego rodzaju nawierzchni m² dodane i usunięte na klasach (trawa, korony, kostka, asfalt, cień, nieznane, bez zdjęcia), w sumie i po komórkach.
  - **teren**: punkty siatki `SHAPED_TERRAIN` refu B, których wysokość różni się od terenu A w tym miejscu o więcej niż 5 mm. Podaje liczbę, m² (oczko siatki na punkt), maks. i medianę |Δh|, maks. w górę i w dół oraz odstęp od NMT (siatka importu refu B) przed i po: medianę i maks. Dalej idą punkty zmienione najbardziej i punkty NMT, które zmienił sam import.
  - **pomosty**: kawałki pomostów i schodów przy nich, parowane po obrysie (IoU prostokątów ≥ 0,3). Dla każdego przesunięcie obu końców osi, wysokości na końcach przed i po i zmiana pola. Do tego kawałki dodane i usunięte.
- Brak rastra dzielnicy w `data/orto` narzędzie zgłasza wprost (`UWAGA …`, pole `missingCover`). Mówi też, czy kafle są tylko w pamięci podręcznej (`~/.cache/seki-orto`, wtedy zbuduj raster przez `build.ts`). Próbki takiej dzielnicy liczą się jako „bez zdjęcia”.
- Wyjście: krótki tekst na stdout, całość w JSON do `--out`.

## Klasy i progi
- Klasy: zieleń, zieleń pod koronami (zielona tylko na letnich nalotach, nie na nalocie bez liści 2025-04; G-672), jasna nawierzchnia, asfalt, cień, nieznane, brak zdjęcia.
- Progi są w `src/thresholds.ts`, a zgodność z prawdą trzyma `test/cover-truth.test.ts`.
- Po zmianie progów puść `build.ts`, podbij `CLASSIFIER_VERSION` w `src/manifest.ts` i commituj rastry razem z progami.
