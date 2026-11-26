# ADR-0103: Linie nieciągłości w siatce terenu

Status: Przyjęty (26.11, tryb nocny: rekomendowana poprawka G-971)

## Kontekst
Pod murkami tarasu Placu Katedralnego teren gry ma uskok 1–2,8 m (T-351, `breaklines.ts`, #1038). Siatka terenu jest regularna i interpolowana dwuliniowo (`terrainHeightAt`, ADR-0042). Uskok rozlewa się więc na komórkę 1,25 m, która przecina linię muru. Murek ma 0,4 m grubości, więc przed licem zostaje nasyp do 1,85 m wysokości, a za parapetem rów do 2,16 m głębokości (G-971). Bruk jest drapowany na siatce świata 2,5 m (`drapeY`), więc w nim klin sięga dalej: przy x 593 ma ok. 2 m wysokości. Zagęszczenie siatki całego chunka do 0,3 m dałoby ok. 300 tys. wierzchołków terenu. To za dużo na budżety rysowania.

## Wzorzec
- **Interpolacja z barierami** z GIS (bariery w IDW i Kernel Interpolation w ArcGIS): próbka po drugiej stronie bariery nie wchodzi do interpolacji.
- **Twarde linie nieciągłości TIN-u** (hard breaklines, `Breaklines` w LandXML, NMT GUGiK): powierzchnia nie jest interpolowana przez linię.
- **Przycinanie wielokąta wypukłego** do półpłaszczyzny metodą Sutherlanda-Hodgmana, jak przy cięciu drapowania na siatce (`clipConvex`).

Czym się różnimy od TIN-u: siatka zostaje regularna. Linia nie zmienia węzłów. Zmienia tylko to, które narożniki komórki biorą udział w interpolacji, i to, jak renderer tnie trójkąty tej komórki.

## Decyzja
1. **Kontrakt.** `TerrainGrid.breaks?`: łamane, przez które wysokość nie jest interpolowana (`@seki/core`, `city-geo.ts`). W komórce przeciętej linią `terrainHeightAt` pomija narożniki po drugiej stronie najbliższego odcinka i skaluje wagi pozostałych do jedności (`brokenHeight`). Teren schodzi więc dokładnie na linii, a po każdej stronie zostaje ciągły. Komórki przecięte liniami liczy `breakCells`, z pamięcią podręczną na siatkę.
2. **Symulacja.** `breakGrid` (`breaklines.ts`) oddaje linie razem z siatką. Grunt gry (`groundY`) i renderer czytają je z tej samej siatki, więc stopy i teren się zgadzają. Murek oporowy czyta swoje strony przy licach (±0,25 m), a nie na osi, bo na osi jest uskok (`RETAINED_FACE`).
3. **Renderer.** `planTerrain` tnie trójkąty komórek przeciętych linią dwiema prostymi ±0,15 m od osi muru (`terrain-breaks.ts`): obie części obok muru leżą płasko na swojej stronie, a pasek pod murem bierze na siebie uskok. Drapowanie (`drape`) robi to samo w komórkach siatki 2,5 m przeciętych linią i kładzie tam bruk na wysokości samego gruntu, a nie na płaszczyźnie narożników po obu stronach. Linie dostaje przez `HeightAt.breaks` z `TerrainEntries.breaksOn`. Normalne przy linii są czytane na ich własnej stronie.
4. **Auta.** Zaparkowane auto trzyma się 0,6 m od linii (G-976), bo mur ustępuje autu (`barrierBlocked`), a stanowisko dochodzące do muru zostawiłoby krawędź tarasu otwartą.

## Skutki
- `breaks` mają dziś tylko linie z `BREAKLINES`, czyli taras Placu Katedralnego. Każdy przyszły uskok pod murem dostaje linię tak samo.
- Złoty skrót cięcia gruntu `stare-miasto-0-0` się zmienia (`ground-cut.test.ts`).
- Zasięg: wierzchołki cięcia nie są współdzielone z sąsiednimi komórkami, a na krawędzi sąsiada powstaje złącze T o tej samej wysokości. Obejmuje to ok. 110 komórek terenu.
