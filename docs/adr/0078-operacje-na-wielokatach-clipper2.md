# ADR-0078: Operacje na wielokątach w imporcie mapy na Clipper2

Status: Zaakceptowany (12.11, decyzja użytkownika: „przyjmuję, lecimy”; start od etapów 1–2). Wynika z decyzji użytkownika z 12.11 (`docs/decyzje.md`, „Wyrównanie do wzorców”, punkt 1) i z reguły „Wzorce i standardy” w `CLAUDE.md`. Dotyczy ADR-0042 (import OSM i NMT), ADR-0077 (pokrycie mapy z danych) i ADR-0054 (glitche). Stan kodu: `origin/main` f7a18f0. Kod produkcyjny importu w tym kroku się nie zmienia: jest ten ADR, zależność deweloperska w `tools/osm-import` i prototyp pomiarowy w `tools/osm-import/bench`.

## Kontekst

**Jak jest dziś.** `tools/osm-import` składa nawierzchnię z własnych operacji na wielokątach:
- `bufferLine` i `stripAlong` (`geometry.ts`): pas wzdłuż linii z prostymi końcami, z łączeniem ukośnym ograniczonym do 3× przesunięcia, bez łączenia z sąsiednią drogą;
- `clipRingToRect` i `clipLineToRect` (`geometry.ts`): przycięcie do kawałka mapy (Sutherland–Hodgman);
- `cutHoles` i `notchOut` (`ring-holes.ts`): dziury i wcięcia trawników w placach;
- `convexParts` i `triangulate` (`convex.ts`): części wypukłe, także dla trawników na dachach (`raised-green.ts`);
- progi pola w `chunkGround` (`ground.ts`: 0,5 m², `MIN_SHARE` 0,01 m²) i uproszczenie 0,3 m po przycięciu;
- pasy nałożone na siebie w kolejności rysowania (`ORDER` w `ground.ts`, podniesienia `SURFACE_LIFT`), a nie podział płaszczyzny;
- wypełnienia przy krawężnikach (`kerbFills`, `kerb-widen.ts`) jako łaty na szczeliny, których nie zamyka sam bufor.

Glitche z 12.11 to typowe objawy takiego podejścia:
- samoprzecięcia obrysów: G-654, G-658, G-659 (30 obrysów w mieście, w Krakowskim 15);
- szczeliny i ścięte rogi na stykach: G-665, G-671, a w G-658 do 1 m² na zewnętrzny róg;
- szczeliny przy krawężnikach: `kerb-gap-bare` 29 702 próbek 0,25 m w bazie skanu.

**Wzorzec.** W GIS i w CAD te operacje robi biblioteka geometrii:
- operacje boolowskie na wielokątach: algorytm Vatti (Clipper, Clipper2) albo Martinez–Rueda–Feito (`polygon-clipping`, `martinez`);
- bufor (offset, suma Minkowskiego z kołem) z typem łączenia (round, miter, bevel) i zakończenia (round, butt, square), jak `ST_Buffer` w PostGIS (`join=round endcap=round`) i `BufferOp` w JTS/GEOS;
- warstwa pokrycia jako **podział płaszczyzny** (polygonal coverage w JTS): kawałki rozłączne, bez zakładek i bez szczelin, sprawdzane walidatorem pokrycia;
- usuwanie wąskich szczelin przez **domknięcie morfologiczne** (bufor +r, potem −r) i przydział szczeliny sąsiadowi;
- odporność numeryczna przez współrzędne całkowite (Clipper) albo predykaty odporne i zaokrąglanie do siatki (snap rounding w JTS).

## Rozważone opcje

Kandydaci z rejestru npm (`pnpm view`, 12.11):

| Pakiet | Algorytm | Licencja | Rozmiar (rozpakowany) | Ostatnie wydanie | Offset: łączenia / zakończenia | Liczby | Node bez modułów natywnych |
|---|---|---|---|---|---|---|---|
| **`clipper2-ts` 2.0.1-19** | Clipper2 (Vatti), port TS śledzący PolyClipping/Clipper2 | BSL-1.0 | 2,0 MB (dist 1,7 MB, min. 123 KB) | 7.11.2026, aktywny | Miter, Square, Bevel, Round / Polygon, Joined, Butt, Square, Round | int64 (`Paths64`), nakładki float `*D` | tak, czysty TS (ESM) |
| `clipper2-wasm` 0.4.0 | Clipper2 (Vatti), Emscripten | BSL-1.0 | 1,2 MB | 18.05.2026 | jak Clipper2 | int64 i float | tak (WASM), asynchroniczne ładowanie modułu |
| `@countertype/clipper2-ts` 1.5.4 | Clipper2, starsza gałąź tego samego portu | BSL-1.0 | 0,8 MB | 17.11.2025 | jak Clipper2 | int64 i float | tak |
| `clipper2-js` 1.2.4 | Clipper2, port TS (IRobot1) | BSL-1.0 | 1,9 MB | 1.01.2024, bez ruchu | jak Clipper2 | int64 i float | tak |
| `clipper-lib` 6.4.2 | Clipper 1 (Vatti), port JS | BSL-1.0 | 0,2 MB | kod z 2017, metadane 2022 | jtRound, jtMiter, jtSquare / etOpenRound, Butt, Square | int (53 bity) | tak |
| `js-angusj-clipper` 1.3.1 | Clipper 1, WASM i asm.js | MIT | 1,9 MB | 4.02.2023 | jak Clipper 1 | int | tak (WASM) |
| `polygon-clipping` 0.15.7 | Martinez–Rueda (wariant) | MIT | 0,35 MB + `splaytree`, `robust-predicates` | 18.12.2023 | brak offsetu | float z predykatami odpornymi | tak |
| `polyclip-ts` 0.16.8 (w `@turf/union`, `@turf/difference` 7.4) | port TS `polygon-clipping` | MIT | + `bignumber.js` | 17.12.2024 | brak offsetu | float, `bignumber.js` | tak |
| `martinez-polygon-clipping` 0.9.1 | Martinez–Rueda–Feito | MIT | 50 KB + 3 zależności | 8.11.2026 | brak offsetu | float | tak |
| `@turf/buffer` 7.4.0 | JTS (`@turf/jsts`) po rzutowaniu `d3-geo` | MIT | 37 KB + JSTS i d3-geo | 3.08.2026 | API bez wyboru łączeń i zakończeń (zawsze okrągłe), współrzędne geograficzne | float | tak |
| `jsts` 2.12.1 | JTS (BufferOp, OverlayNG, snap rounding) | EDL-1.0 lub EPL-1.0 | 3,7 MB | 16.11.2024 | round, mitre, bevel / round, flat, square | float z modelem precyzji | tak |

Wnioski z tabeli:
- Offset z wyborem łączeń i zakończeń mają tylko rodzina Clipper i JTS. `polygon-clipping`, `polyclip-ts` i `martinez` nie mają offsetu, więc bufor linii zostałby nasz. `@turf/buffer` nie daje wyboru łączeń, a liczy w stopniach geograficznych, nie w metrach świata.
- JSTS daje pełny model GIS (pokrycie, snap rounding), ale jest 2× większy, na licencji EDL/EPL i liczy we float.
- Clipper2 liczy na liczbach całkowitych, co daje wynik odporny i deterministyczny bez predykatów float. Rodzina Clipper (Angus Johnson, licencja Boost) jest szeroko używana w CAD i w slicerach druku 3D.
- Spośród portów Clipper2 `clipper2-ts` jest aktywny i ma synchroniczne API w czystym TS, bez ładowania WASM w generatorze. `clipper2-wasm` jest wariantem zapasowym z tym samym algorytmem.

## Pomiar (prototyp)

**Co mierzy.** Prototyp `tools/osm-import/bench/clipper-ground.ts`, uruchamiany komendą `pnpm --filter @seki/osm-import bench:ground`, nie wchodzi do `pnpm test`.
- Bierze z `generate` te same pasy, które dostaje `chunkGround` (opakowanie przez `vi.mock`, kod produkcyjny bez zmian), dla 6 kawałków Krakowskiego Przedmieścia (1223 pasy).
- Krok 1, bufor: jezdnie (oś z `kerb`) i pasy z `bufferLine` (oś odczytana z pierścienia przez `stripAxis`) dostają łączenia okrągłe. Zakończenie jest okrągłe tam, gdzie koniec drogi trafia na wierzchołek innej drogi; na ślepym końcu i na brzegu mapy zostaje proste. Chodniki mają proste końce przy krawężniku. Schody i zebry zachowują pierścienie, bo renderer czyta z nich bieg i pasy.
- Krok 2, podział płaszczyzny: suma każdej nawierzchni (NonZero) minus suma nawierzchni rysowanych wyżej, w kolejności `ORDER`. Mosty leżą osobno i nikogo nie tną.
- Krok 3: `rectClip` do kawałka. Opcjonalnie domknięcie morfologiczne o promieniu r: szczelina idzie w całości do najniższej nawierzchni, której dotyka, jak dziś `kerbFills`.
- Siatka całkowita: milimetry.
- Miary w `bench/ground-metrics.ts`:
  - samoprzecięcia pierścieni: `selfIntersects` z importu, ta sama definicja co w G-659;
  - raster 0,25 m: pole pokryte i pole zakładek;
  - szczeliny: gołe komórki z nawierzchnią po obu stronach w zasięgu 0,75 m wzdłuż x albo z, czyli szczeliny do 1,25 m;
  - zakładki w Clipper2 liczone dokładnie (przecięcia warstw);
  - trójkąty: V + 2H − 2 na obrys, bo tak tnie ear clipping w rendererze, z dziurami jako szwami.
  - Mosty poza miarami.

**Wyniki** (Krakowskie, 6 kawałków, nawierzchnia poza mostami):

| Miara | Dziś | A: bufor + podział, łuk 5 cm | B: A + uproszczenie kształtów 0,1 m przed podziałem, łuk 10 cm | C: B + domknięcie r = 0,6 m |
|---|---|---|---|---|
| Obrysy (zewnętrzne) | 1293 | 897 | 890 | 994 |
| Pierścienie z dziurami | 1293 | 1011 | 997 | 1117 |
| Pierścienie z samoprzecięciem | **15** | 1 | **0** | 13 |
| Wierzchołki | 11 070 | 15 137 (+37%) | 12 612 (+14%) | 17 514 (+58%) |
| Trójkąty | 8 484 | 13 571 (+60%) | 11 046 (+30%) | 15 772 (+86%) |
| Zakładki (m²) | 44 469 (raster) | 0,19 (dokładnie) | 0,19 | 0,46 |
| Szczeliny do 1,25 m (m², raster 0,25 m) | **969** | 943 (−3%) | 951 (−2%) | **120 (−88%)** |
| Pole pokryte (m²) | 138 050 | 138 161 | 138 119 | 139 310 |
| Pokryte tylko dziś / tylko w Clipper2 (m²) | – | 437 / 548 | 451 / 520 | 325 / 1585 |
| Okruchy < 0,05 m² | – | 40 | 27 | 128 |
| Czas operacji na wielokątach w dzielnicy | `chunkGround` 14–28 ms | 183–330 ms | 253–287 ms | 278–391 ms |

Czas `generate` dla Krakowskiego (dziś): 1270–1960 ms. Maszyna była współdzielona (load 6–13), więc czasy podaję jako zakresy z 4 przebiegów. Wariant B dodaje do `generate` dzielnicy ok. 13–20%, a C ok. 20–25%.

**Co z tego wynika.**
- Samoprzecięcia znikają przy samym buforze i sumie (B: 15 → 0; 15 to dokładnie Krakowskie z G-659). Zakładki znikają przy podziale: z 44 469 m² nałożonych pasów zostaje 0,19 m² z zaokrągleń do 1 mm.
- Łączenia okrągłe zamykają rogi na stykach (test `clipper-ground.test.ts`, „fills the outer corner…”). Szczelin ubywa jednak tylko o 2–3%: tylko 3% gołych komórek szczelin leży w 0,75 m od budynku, a reszta to pasy, których szerokości się nie schodzą (chodnik o stałym przesunięciu od osi, jezdnia z tagów). Te szczeliny zamyka dopiero domknięcie (C: −88%).
- Domknięcie dokłada 1585 m² nawierzchni tam, gdzie dziś jest goła ziemia. Część to prawdziwe szczeliny, część to wklęsłe rogi i wąskie pasy, których może nie być na ortofoto. Prosty przydział szczelin w prototypie daje 13 samoprzecięć i 128 okruchów, więc ten krok wymaga osobnej pracy i sprawdzenia z klasyfikacją ortofoto (ADR-0077).
- Uproszczenie kształtów 0,1 m przed podziałem (B) trzyma przyrost wierzchołków w +14% bez utraty rozłączności. Uproszczenie po podziale rozsunęłoby wspólne krawędzie.
- Siatka całkowita ma znaczenie:
  - w centymetrach zakładki wynoszą 1,31 m², a samoprzecięcia 2;
  - w milimetrach zakładki to 0,19 m², a samoprzecięcie 1;
  - w siatce 0,1 m (dzisiejsze `r1`) proces skończył się brakiem pamięci, czego dalej nie badałem.
  - Wynik ma więc wychodzić z 0,01 m, nie zaokrąglony po fakcie do 0,1 m, bo zaokrąglenie znów rozsunie krawędzie.
- Triangulacja Clipper2 (`triangulate`, oznaczona w źródle jako „BETA”) zawiesiła się na jednej warstwie Krakowskiego. Na 6 zestawach warstw i na 13 dzisiejszych obrysach zwróciła błąd. Nie używamy jej: trójkąty zostają przy ear clippingu renderera (`packages/engine/src/renderer/mapcity/polygon.ts`).

## Decyzja (proponowana)

1. **Biblioteka:** `clipper2-ts` w dokładnej wersji (dziś `2.0.1-19`), tylko jako `devDependencies` w `tools/osm-import`. Gra jej nie importuje (`depcheck`), a do paczki gry trafiają tylko wygenerowane tablice. Bierzemy z niej operacje boolowskie (`union`, `difference`, `intersect`), offset (`inflatePaths`) i `rectClip`. Triangulacji nie bierzemy. Siatka całkowita: 1 mm.
2. **Model nawierzchni:** podział płaszczyzny zamiast kolejności rysowania. Kawałki różnych nawierzchni są rozłączne, a kolejność `ORDER` mówi tylko, kto wygrywa przy cięciu. Odstępstwa od wzorca:
   - schody i zebry zostają prostokątami, bo renderer czyta z nich kierunek;
   - mosty leżą poza podziałem, jako druga warstwa na pokładzie;
   - szczelinę z domknięcia dostaje najniższa nawierzchnia, której dotyka, jak dziś `kerbFills`, a nie sąsiad z najdłuższą wspólną krawędzią (wzorzec GIS).
3. **Bufor linii:** łączenia okrągłe (łuk 0,1 m). Zakończenia okrągłe na styku z inną drogą, proste na ślepym końcu, na brzegu mapy i przy krawężniku chodnika. OSM-Carto rysuje drogi z okrągłym zakończeniem wszędzie; my zostawiamy proste tam, gdzie okrągłe wyszłoby poza dane.
4. **Własne operacje do usunięcia po migracji:**
   - `bufferLine` i `stripAlong` dla pasów, `clipRingToRect` dla nawierzchni, `cutHoles` i `notchOut` (`openPavings` staje się różnicą), `convexParts` w `raised-green.ts` (różnica z budynkami i jezdniami);
   - progi pola w `chunkGround` (zastąpione usuwaniem okruchów jednym progiem po podziale) i z czasem `kerbFills` z `kerb-widen.ts` (zastąpione domknięciem);
   - zostają `convexParts` i `triangulate` dla brył budynków w symulacji: to rozkład na części wypukłe, nie operacja boolowska.

## Plan migracji (osobne PR-y, każdy z regeneracją, przeglądem `topography-curator` i pomiarem tym prototypem)

1. **Kontrole w skanie** (bez zmiany importu): `ground-ring-self-cross` (G-659, baza z przebiegu, ok. 30) i `ground-overlap-area` (pole zakładek różnych nawierzchni, dziś duże z założenia; liczone do raportu, bez bazy, dopóki krok 3 nie wejdzie).
2. **Bufor linii:** `lineBands` na `inflatePaths` z łączeniami okrągłymi i zakończeniami jak w punkcie 3 decyzji, suma pasa (NonZero). Format `GroundOut` bez zmian: jeden pierścień, dziury szwami (`cutHoles`). Oczekiwane: `ground-ring-self-cross` 30 → 0; zamknięte G-654, G-658 i rogi z G-671. `kerb-gap-bare` spada nieznacznie (pomiar: −2…−3% szczelin).
   - *Wykonanie (13.11, `tools/osm-import/src/line-buffer.ts`, `roundJoints`, razem z G-744):* `ground-ring-self-cross` 30 → 8, `kerb-gap-bare` 897 → 879 kluczy skanu. Koszt: `osm:build` +20%, test „sign nearly all” w `venues.test.ts` +29% (pomiar pod obciążeniem), ponad próg +15%; przyjęte decyzją użytkownika 13.11 z wpisem do długu w [ADR-0046](0046-strategia-testow-e2e.md).
   - *Znany błąd po etapie:* G-760, szczeliny 5–10 cm w złączach pasów jezdni po zaokrągleniu do 0,1 m (np. dziura w jezdni Kalinowszczyzny przy 2340,427, klucz `car-lane-off-road`). `roundJoints` pomija kawałki mniejsze niż SLIVER i liczy pokrycie przed zaokrągleniem. Poprawka w `line-buffer.ts` osobnym PR po scaleniu etapu.
3. **Podział płaszczyzny** w kawałku: suma nawierzchni minus suma wyższych. Przedtem trzeba przejrzeć odbiorców, którzy dziś zakładają nakładanie:
   - `surfacesAt`, `onRoad` i `surfaceLiftAt` w `packages/sim/src/content/lublin/roads.ts` (pod chodnikiem nie będzie już „road”);
   - `SURFACE_LIFT` w rendererze;
   - kontrole skanu `sidewalk-under-carriageway` (131, z definicji → 0), `paving-overlap-*`, `paving-coplanar`, `grass-under-paving`.
   
   Wynik z dokładnością 0,01 m (podwaja część cyfr w `*.generated.ts`; rozmiar zmierzyć). Oczekiwane: `ground-overlap-area` → ok. 0, `openPavings` i `groundRaisedGreen` na różnicach.
   - *Wykonanie (14.11, `tools/osm-import/src/ground-partition.ts`, ADR-0080 PR 6):* podział po `chunkGround` i wypełnieniach z pokrycia, bez mostów. Odstępstwa od tego punktu:
     - **ranga:** schody, potem jezdnia (zebra nad asfaltem), potem wyższy `SURFACE_LIFT`, czyli to, co obraz rysował na wierzchu; nie `ORDER`. Na krawędzi jezdni wygrywa asfalt (decyzja użytkownika 14.11), więc pasy i zatoki parkowania zachowują asfalt spod zakładek chodnika. `ORDER` różnił się od obrazu na ok. 7% zakładek (chodnik pieszy nad asfaltem 2 736 m², kostka nad asfaltem 874 m²) i po podziale wyznacza już tylko kolejność kawałków w tablicy;
     - **siatka:** nowe narożniki w milimetrach, nie w 0,01 m. Zaokrąglone do 0,01 m zostawiały 32 m² zakładek na rastrze skanu (9 m² w mm), bo narożnik na cudzej krawędzi odchodzi od niej do 7 mm. Koszt: ok. +2% tablic. Kawałek nieprzecięty zostaje co do cyfry;
     - **dziury:** wycinane szwem (`cutHoles`); część, której szew przecina się, i pierścień dotykający się w narożniku dzielone na części (ear clipping renderera kładł je ponad własnym polem);
     - **zebra** jest osobnym kawałkiem jezdni: renderer kładzie pod pasami asfalt, `onRoad` i kontrole skanu czytają ją jako jezdnię;
     - **trasy tłumu** po placach i alejkach biegną po obrysach sprzed podziału (`walkAreas` w tablicach dzielnic tłumu, ok. 32 KB);
     - **kamienie krawężnika** z `kerbFills` leżą za krawędzią asfaltu, na chodniku pieszym, a nie na asfalcie: krawężnik stoi na granicy podziału, 0,4 m dalej od osi niż przedtem.
   - *Wynik:* zakładki 93 tys. m² → 0,94 m² (dokładnie, Clipper2), `ground-strip-overlap` 3 552 → 0 kluczy; tablice 1 856 → 2 152 KiB (+16%, z czego `walkAreas` ok. 32 KB); wierzchołki nawierzchni 53 789 → 68 781 (+28%), ponad próg +15% z ADR-0080, do zbicia w etapie 4 (`rectClip` bez schodków 0,1 m). Zostaje ok. 16 m² gołych włosowatych szczelin (do 2 mm) między kawałkami ciętymi wzdłuż siebie; `landuse-bare` liczy kawałek 2 mm za krawędzią.
4. **Przycięcie do kawałków:** `rectClip` zamiast `clipRingToRect`, bez progów `MIN_SHARE` i 0,5 m². Okruchy usuwa jeden próg po podziale, wspólny dla sąsiednich kawałków. Oczekiwane: koniec szczelin na brzegach kawałków (G-665).
5. **Domknięcie szczelin** (r ok. 0,6 m) zamiast `kerbFills` i `kerb-widen`, sprawdzone nakładką ortofoto z ADR-0077. Oczekiwane: `kerb-gap-bare` 29 702 → spadek rzędu pomiaru (−88% szczelin do 1,25 m w Krakowskim) i część `landuse-bare` (69 214). Kontrola `kerb-fill-wide-estimated` (3627) do przeglądu albo usunięcia. Przydział szczelin musi dać 0 samoprzecięć (w prototypie 13).
6. **Sprzątanie:** usunięcie martwych funkcji z punktu 4 decyzji i spadek bazy `tools/code-health`.

## Konsekwencje

- **Złote hashe:** ten krok żadnego nie zmienia. Kroki 2–5 zmieniają `packages/sim/src/content/lublin/*.generated.ts`, a symulacja czyta nawierzchnię (`roads.ts`: `surfacesAt`, `onRoad`, `surfaceLiftAt`, widoki w `city.ts`). Krok 3 zmienia też semantykę „co leży pod punktem”, więc złote hashe w `packages/sim/test/determinism.test.ts` i migawka NPR (`e2e/npr-perf.spec.ts`) mogą się zmienić. Aktualizujemy je świadomie, z uzasadnieniem w commicie etapu. Clipper2 jest deterministyczny (liczby całkowite), co sprawdzają testy „gives the same result twice” i „reproduces the committed tables… twice” w `generate.test.ts`.
- **Skan glitchy:**
  - powinny spaść: `ground-ring-self-cross` (nowa, 30 → 0), `kerb-gap-bare` (29 702), część `landuse-bare` (69 214), `sidewalk-under-carriageway` (131 → 0 z definicji), `kerb-fill-wide-estimated` (3627, po kroku 5);
  - nie mogą wzrosnąć: `paving-*`, `steps-*`, `grass-under-paving`, `raised-green-on-ground`, `crowd-*`, `lane-*`.
- **Czas CI:**
  - `generate` całego miasta pod pokryciem trwa ok. 8 s (`tools/osm-import/test/city.ts`) i jest raz na klucz wejść w pamięci podręcznej;
  - wariant B dodaje ok. 13–20% czasu `generate`, czyli ok. 1–1,5 s na klucz, a testy wołające `generate` wprost (dwa przebiegi w `generate.test.ts`) płacą to dwa razy;
  - prototyp pomiarowy nie chodzi w CI;
  - nowy test `tools/osm-import/test/clipper-ground.test.ts` trwa ok. 20 ms.
- **Rozmiar:** zależność tylko w narzędziach, paczka gry bez zmian. Wierzchołki nawierzchni +14% (B), trójkąty +30%. Liczba wywołań rysowania się nie zmienia, bo nawierzchnia kawałka idzie jednym buforem; budżety sprawdza `npr-perf`.
- **Licencja:** BSL-1.0 (Boost) pozwala na użycie i zmiany bez wymogu atrybucji w wynikach. Kod biblioteki nie trafia do paczki gry, więc wpis w „Autorach” nie jest potrzebny.

## Ryzyka i jak je mierzyć

- **Wersja przedpremierowa portu z jednym opiekunem** (`2.0.1-19` z tagiem `latest`):
  - przypięta dokładna wersja i własne testy przypadków (`clipper-ground.test.ts`: róg, pętla, rozłączność);
  - zapasowo `clipper2-wasm` z tym samym algorytmem albo `clipper-lib` (Clipper 1);
  - przy podbiciu wersji: `bench:ground` i porównanie liczb z tabeli.
- **Triangulacja Clipper2 (beta) zawiesza się:** nie używamy jej; przegląd PR-ów etapów sprawdza, że `triangulate` z biblioteki nie wchodzi do importu.
- **Siatka i zaokrąglenia:** praca w 1 mm, wynik z 0,01 m. Zakładki liczy `ground-overlap-area`, a szczeliny z zaokrągleń są poniżej rastra 0,25 m.
- **Wierność Lublinowi:**
  - okrągłe zakończenia i domknięcie dokładają nawierzchnię (B: +520/−451 m², ok. 0,7% pokrycia; C: +1585 m²);
  - mierzymy nakładką ortofoto (ADR-0077) i przeglądem `topography-curator`;
  - celowe odstępstwa wpisujemy do `docs/topografia.md`.
- **Odbiorcy zakładający nakładanie** (sim `roads.ts`, renderer, skan): przegląd przed krokiem 3 i testy sesji dla `onRoad` pod chodnikiem.
- **Okruchy po podziale** (27 w B, 128 w C): jeden próg po podziale i kontrola skanu na okruchy, gdy krok 3 wejdzie.
