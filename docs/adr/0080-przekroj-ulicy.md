# ADR-0080: Jeden przekrój ulicy, pasy ruchu z przekroju i jedna kontrola przejścia

Status: Zaakceptowany (13.11, odpowiedzi użytkownika na otwarte pytania na końcu). Wynika z decyzji użytkownika z 13.11 (`docs/decyzje.md`, „Ujednolicenie ulic i skanu”, punkty 2–4; punkt 1, baza skanu po miejscach, idzie osobno jako narzędzie). Dotyczy ADR-0042 (import OSM i NMT), ADR-0043 (teren i nachylenie w symulacji), ADR-0050 i ADR-0055 (ruch, skręty pasów), ADR-0052 (oznakowanie), ADR-0053 (pomosty), ADR-0054 (glitche), ADR-0077 (pokrycie z danych) i ADR-0078 (Clipper2), którego etapy 3 i 5 doprecyzowuje jako cel. Stan kodu: `origin/main` df0cfab. Etap 1 ADR-0078 jest w main (#453), etap 2 czeka na G-744.

## Kontekst

**Jak dziś powstaje ulica.** Każda nawierzchnia to osobny pas z własną szerokością, a styki wyrównują późniejsze reguły (`tools/osm-import/src`, kolejność z `generate.ts`):
1. `fitToKerb` (`ground.ts`) zwęża jezdnię bez `width` i bez `lanes` do odrębnie zmapowanych chodników (T-046). Mediana odległości z `sidewalkIndex.kerb`, minimum 3 / 4,5 m.
2. `fitLanes` (`lane-fit.ts`, 174 linie) robi to samo dla ulic z `lanes`, odcinkami i osobno dla każdej strony (G-655).
3. `lineBands` / `pieceBands` (`ground.ts`): jezdnia jako `bufferLine(oś, roadWidth)`, chodnik z tagów jako `stripAlong(oś, w/2, sw)`. To osobny bufor tej samej osi, ale bez wspólnej krawędzi po uproszczeniu i przycięciu. `footway=sidewalk` to osobny `bufferLine` własnej osi.
4. `cutSidewalk` próbkuje chodnik co 0,5 m i tnie go tam, gdzie wchodzi na cudzą jezdnię.
5. `bridgeFills` / `onCarriagewayDecks` (`bridge-fill.ts`, 115 linii) zalewają szczelinę do 4 m między chodnikiem a jezdnią na moście (G-340) i poziomują chodnik do jezdni (G-737). `toAbutments` (`bridge-ends.ts`, 75) przedłuża oś do przyczółka (G-344).
6. `kerbFills` (`kerb-fill.ts`, 384) zalepia pas gołej ziemi do `KERB_REACH` 3 m między asfaltem a chodnikiem (G-522). Przy szerokości szacowanej poszerza jezdnię (`kerb-widen.ts`, 110, G-570) i wydłuża zebry (`stretchZebras`).
7. Ręczne poprawki: `corrections-kerb.ts` (T-247: trawniki i szerokość z ortofoto). Do tego pas krawężnikowy reguły gołej ziemi: `bare-kerbs.ts`, 220.
8. `chunkGround` układa pasy jeden na drugim w kolejności `ORDER`, a nie jako podział płaszczyzny.
9. Teren pod przyczółkami poziomuje sim (`abutments.ts`, 311, G-349).

**Dane OSM** (4 dzielnice, 496 dróg z jezdnią, w tym 217 poza `service`):
- `width`: 1 droga; `lanes`: 164; `sidewalk:width`: 0; `kerb=*` na węzłach: 0;
- `sidewalk=*` na 117 drogach (`separate` 89, `no` 28), `sidewalk:left/right` na 96;
- `footway=sidewalk`: 107 z 884 dróg pieszych; `man_made=bridge`: 4; `area:highway`: 31.

Szerokość prawie zawsze jest więc szacunkiem: `lanes` × 3,25 m albo `ROAD_WIDTH` z typu. Potem poprawiają ją reguły 1, 2 i 6.

**Odbiorcy nawierzchni.** Sim i renderer czytają nakładające się pasy, nie przekrój:
- `surfacesAt`, `onRoad` i `surfaceLiftAt` (`packages/sim/src/content/lublin/roads.ts`) to test punktu w każdym obrysie z `SpatialHash`;
- `SURFACE_LIFT` (`core/world/city-geo.ts`: jezdnia 0,10, chodnik 0,16) to kolejność rysowania i wysokość stóp (`engine/.../surface-lift.ts`);
- renderer rysuje krawężnik na krawędzi chodnika, która „patrzy na jezdnię” (`ground-plan.ts` `kerbs`, `roadAt`);
- wystąpienia w `packages` i `tools`: `surfacesAt` 56, `onRoad` 35, `surfaceLiftAt` 19, `SURFACE_LIFT` 60.

**Ruch** (`packages/sim/src/content/traffic.ts`) nie zna szerokości z importu: `StreetOut` ma tylko nazwę, typ i oś.
- `reachAt` kroczy po 0,25 m w bok od osi, dopóki `onRoad` to potwierdza.
- `roadHalfWidth` bierze medianę próbek co 10 m; `laneLine` i `laneOffset` biorą z tego odsunięcie pasa; `parked-cars.ts` też.
- Skutek: G-744. Łuki etapu 2 ADR-0078 przesuwają krawędź asfaltu o centymetry, pasy przesuwają się do 12 cm i auta zderzają się na `traffic-junction-drive`.

**Łatki i ich kontrole w skanie** (baza z main):
- styk jezdnia–chodnik (klasa G-728):
  - `kerb-gap-bare` 28 460, `kerb-fill-wide-estimated` 3 627, `kerb-strip-bare` 180;
  - `sidewalk-under-carriageway` 131, `footway-on-carriageway` 471;
  - `kerb-fit-sparse` 0, `two-way-fit-narrow` 0;
- pasy nawierzchni (ADR-0078): `ground-strip-overlap` 93 707 m², `ground-strip-gap` 4 100 m², `ground-ring-self-cross` 30;
- pomosty: `deck-slot` 0, `deck-kerb-step` 0, `bridge-without-deck` 0;
- goły teren: `landuse-bare` 32 497, `bare-on-cover` 5 934.

**Uskoki** sprawdza siedem kontrol, każda z innym progiem:
- `deck-abutment-step` (8; 0,25 m), `deck-step-face` (0; 0,3 m), `deck-slot` (0; 0,5 m);
- `steps-riser-tall` (0; `TALL_RISER` 0,5 m), `deck-drawn-over-flight` (0; `STEP_HEIGHT`);
- `ground-over-deck` (233; 0,01 m), `deck-kerb-step` (0; 0,05 m);
- dalej `flight-underpass`, `paving-overlap-step`, `marking-step`, `steps-incline-against`.

Próg z ruchu: `STEP_HEIGHT` 0,45 m w górę i `SNAP_DOWN` 0,35 m w dół bez upadku (`movement-system.ts`). Nachylenie z ADR-0043: `MAX_WALK_SLOPE` = tg 35° (`world/ground.ts`). Planer AI ma osobną regułę krawędzi (`nav-raster.ts` `ledgesOf`), która zamyka boki pomostów tylko przy schodach (G-741).

## Rozważone opcje

| Opcja | Na czym polega | Koszt | Ryzyko |
|---|---|---|---|
| A. Zostawić łatki | ADR-0078 etapy 2–5 jak zapisano, G-744 jako minimalny odstęp pasów, każdy nowy styk osobną regułą | najmniejszy teraz; każda klasa glitchy to nowa reguła i nowa kontrola (dziś ok. 1 300 linii samych łatek) | każda zmiana geometrii przesuwa pasy, krawężniki i wypełnienia (G-744 to pierwszy taki przypadek); domknięcie z etapu 5 dokłada 1 585 m² nawierzchni bez źródła (pomiar ADR-0078) |
| B. Przekrój tylko dla jezdni i chodnika z tagów | jedna oś i przekrój dla `sidewalk=*`; odrębnie zmapowane chodniki dalej przez `kerbFills` | średni | połowa szczelin zostaje: 89 dróg `separate` i 107 `footway=sidewalk` to właśnie przypadki G-522/G-570 |
| **C. Jeden przekrój dla każdej drogi** (wybrana) | jezdnia, postój, krawężnik, pas zieleni i chodnik jako przedziały odsunięć od jednej osi; zmapowane chodniki zasilają szerokości przekroju zamiast leżeć osobno; skrzyżowania i place przez podział płaszczyzny ADR-0078 | duży: nowy moduł, przepięcie ruchu, kilka regeneracji | odejście od geometrii OSM tam, gdzie chodnik leży daleko od jezdni; zmiana semantyki `onRoad` |
| D. Nawierzchnia z rastra ortofoto | klasy ADR-0077 jako źródło obrysów | bardzo duży | szum klasyfikacji (cienie, auta, drzewa), brak osi dla ruchu, nowe szczeliny na granicach klas |

## Decyzja (proponowana)

### 1. Model przekroju (`tools/osm-import/src/street-section.ts`)

```ts
interface StreetSection {
  readonly way: string;                 // droga OSM (po `toAbutments`, `overTunnels`)
  readonly axis: readonly Pt[];         // oś jezdni; dla ścieżki oś ścieżki
  readonly deck?: readonly [Pt, Pt];    // pomost (ADR-0053): przekrój w jednym poziomie
  readonly stations: readonly Station[];// odcinki wzdłuż osi, co najmniej 5 m
}
interface Station { readonly from: number; readonly to: number; readonly left: readonly Strip[]; readonly right: readonly Strip[] }
interface Strip {
  readonly kind: "carriageway" | "parking" | "kerb" | "verge" | "sidewalk" | "cycleway" | "footway";
  readonly width: number;               // m, z dokładnością 0,05
  readonly source: "osm" | "ortho" | "mapped-way" | "fitted" | "default";
}
```

- Granica k-tego pasa leży w odsunięciu `Σ width[0..k]` od osi. Każdą granicę liczymy raz (`inflatePaths` / offset osi z ADR-0078 pkt 3) i oba sąsiednie pasy biorą tę samą polilinię. Styk jest więc wspólny z definicji, bez szczelin i bez zakładek.
- Zmiana szerokości między stacjami to rampa o nachyleniu 0,1 m na 1 m, jak `LANE_EDGE`.
- `kerb` to granica jezdnia | chodnik z atrybutem `raised | lowered | flush`. Domyślnie `raised`, przy przejściach `lowered`; OSM `kerb=*` ma pierwszeństwo, gdy się pojawi (dziś 0).

### 2. Źródła szerokości, w kolejności pierwszeństwa

1. **OSM:**
   - jezdnia: `width:carriageway`, `width`;
   - chodnik: `sidewalk:<strona>:width`;
   - pas zieleni: `verge` lub `sidewalk:<strona>:verge`;
   - postój: `parking:<strona>` z orientacją.
2. **Ortofoto (ADR-0077):** szerokość asfaltu i chodnika zmierzona na klasach pokrycia wzdłuż osi, co 5 m. Zapis jako tabela wygenerowana z raportem (nie ręczne poprawki). Wpisy T-247 z `corrections-kerb.ts` przechodzą do niej.
3. **Zmapowana droga obok** (`mapped-way`): odrębny chodnik (`sidewalk=separate`, `footway=sidewalk`, równoległy w zasięgu `roadWidth/2 + 7`, jak dziś `sidewalkIndex`) wyznacza granicę jezdnia | chodnik i szerokość chodnika. Obejmuje dzisiejsze `fitToKerb`, `fitLanes` i `kerbFills`. Odstęp ponad `KERB_REACH` 3 m daje pas zieleni, nie szczelinę.
4. **Domyślne z typu:**
   - jezdnia: `lanes` × 3,25 m, w drugiej kolejności `ROAD_WIDTH`;
   - chodnik: 3 m przy primary i secondary, poza nimi 2,5 m;
   - ścieżki: `PATHS`.

   `fitted` oznacza szerokość domyślną przyciętą do `mapped-way`.

Odbiorcy dostają źródło: skan liczy udział `default`, a kontrola `kerb-fill-wide-estimated` znika.

### 3. Skrzyżowania, mosty, place, ścieżki

- **Skrzyżowania:**
  - jezdnia skrzyżowania to suma pasów `carriageway` wchodzących przekrojów z łączeniem okrągłym;
  - chodnik wokół rogu: offset tej sumy o szerokość chodnika krótszego ramienia, minus jezdnie, minus budynki;
  - promień narożnika krawężnika: 3 m (`residential`), 6 m (`primary`/`secondary`);
  - zebry i linie zatrzymania biorą granicę `kerb` z przekroju (koniec `stretchZebras`).
- **Mosty i pomosty:**
  - przekrój na pomoście jest jeden i w jednym poziomie (G-737 z definicji), a jego szerokość obejmuje obrys `man_made=bridge`;
  - na pomoście nie ma pasa zieleni: odstęp jezdnia–chodnik idzie do chodnika (koniec `bridgeFills`);
  - `toAbutments` zostaje, bo dotyczy osi, nie przekroju;
  - poziomowanie terenu przy przyczółku (`abutments.ts`) zostaje w sim, a sprawdza je kontrola przejścia.
- **Place i strefy piesze** (`place=square`, `highway=pedestrian` jako obszar, `area:highway`) nie mają przekroju. Wchodzą do podziału płaszczyzny (ADR-0078 etap 3).
  - Szczelinę między przekrojem a placem albo trawnikiem zamyka domknięcie z etapu 5, ale tylko na styku przekrój–obszar, nie wzdłuż krawężnika (tam szczelin już nie ma).
- **Ścieżki bez jezdni** (`footway`, `path`, `cycleway`, nie `sidewalk`) to przekrój z jednym pasem `footway` wokół osi. Schody zostają prostokątami biegów (`flightStrips`).
  - `footway=sidewalk` daleko od każdej jezdni, ponad zasięg `mapped-way`, zostaje ścieżką.

### 4. Pasy ruchu z przekroju

- `StreetOut` dostaje `half: [lewo, prawo]` na każdym wierzchołku osi: krawędź pasa `carriageway` bez `parking`. Szacunek rozmiaru: 809 wierzchołków ulic, ok. 6 KB z 1,57 MB tablic.
- `traffic.ts`:
  - `roadHalfWidth`, `laneLine` i `parked-cars.ts` czytają `half`;
  - postój bierze pas `parking` zamiast `KERB_ROOM`;
  - liczba pasów jednokierunkowych z `lanes`, jeśli zmieszczą się w `half`.
- `reachAt` / `onRoad` zostają tylko jako kontrola w skanie (`lane-off-ground`, `car-lane-off-road`): pas ma leżeć na narysowanym asfalcie, ale go nie mierzy.
- Odstęp przeciwnych pasów: co najmniej szerokość auta plus 0,2 m (G-744).

### 5. Jedna kontrola przejścia: `walk-blocked`

- **Predykat** `walkStep(a, b)` w `packages/sim/src/world/walk.ts`, wspólny dla skanu i planera AI (`nav-raster.ts`), zamiast osobnego `ledgesOf`.
- **Gdzie liczymy:** raster 0,25 m po wszystkich powierzchniach do chodzenia: `road`, `sidewalk`, `square`, `cobble`, `footway`, `crossing`, kawałki pomostów, `steps` wzdłuż biegu.
- **Co jest znaleziskiem:** para sąsiednich komórek, które model łączy (ten sam przekrój, sąsiednie przekroje, przekrój–plac, pomost–przyczółek), a dla których zachodzi co najmniej jedno:
  - uskok `groundY` w górę ponad `STEP_HEIGHT` (0,45 m) albo w dół ponad `SNAP_DOWN` (0,35 m) (zob. pytanie 1);
  - nachylenie z różnic centralnych na 0,5 m (ADR-0043) ponad `MAX_WALK_SLOPE` (tg 35°), poza biegiem schodów.
- **Zamierzone krawędzie** model oznacza jawnie i nie są znaleziskiem: ściany budynków, bariery (ADR-0077), boki pomostów nad niższym terenem (dla AI zamknięte, G-741), nisza T-147.
- **Zastępuje:** `deck-abutment-step`, `deck-step-face`, `deck-slot`, `steps-riser-tall`, `flight-underpass`, `deck-drawn-over-flight`.
- **Z definicji przekroju:** `deck-kerb-step` przechodzi do testu modelu (chodnik i jezdnia w jednym poziomie na pomoście).
- **Kontrole rysunku zostają,** bo nie badają przejścia, tylko zgodność rysunku z symulacją: `ground-over-deck`, `paving-overlap-step`, `marking-step` (zob. pytanie 2).

## Plan migracji (osobne PR-y, każdy z regeneracją, bazą skanu po kluczach z punktu 1 decyzji 13.11 i listą przybyłych i ubyłych kluczy)

| # | PR | Względem ADR-0078 | Mierzalny wynik |
|---|---|---|---|
| 1 | G-744: minimalny odstęp przeciwnych pasów w `traffic.ts` | odblokowuje etap 2 | `traffic-junction-drive` 12/12 ziaren na gałęzi etapu 2; seedy 1–40 bez kolizji; złoty hash świadomie |
| 2 | Etap 2 ADR-0078 (bufor linii) | etap 2 | `ground-ring-self-cross` 30 → 0; `lane-*` bez nowych kluczy |
| 3 | `StreetOut.half` z obecnej jezdni (po `fitToKerb`/`fitLanes`/`widen`); ruch i parkowanie czytają tablicę, nie `reachAt` | przed etapem 3 | test: przesunięcie krawędzi asfaltu o 5 cm nie zmienia żadnego pasa; `car-lane-off-road` 0, `lane-off-ground` ≤ 1; tablice +≤ 10 KB |
| 4 | `walkStep` i `walk-blocked` w skanie obok starych kontroli | niezależny | każdy klucz 6 zastępowanych kontrol pokryty przez `walk-blocked` (raport pokrycia); baza z przebiegu |
| 5 | Moduł `street-section.ts` produkujący dzisiejsze pasy (refaktor) | przed etapem 3 | nawierzchnia w `*.generated.ts` bajt w bajt; raport źródeł szerokości (udział `osm` / `mapped-way` / `fitted` / `default`) |
| 6 | Etap 3 ADR-0078 (podział płaszczyzny) na pasach z przekroju; przegląd `surfacesAt`, `onRoad`, `SURFACE_LIFT`, `kerbs` w rendererze (krawężnik z granicy `kerb`, nie z `roadAt`) | etap 3 | `ground-strip-overlap` 93 707 → < 1 m²; `sidewalk-under-carriageway` 131 → 0 |
| 7 | Przekrój zamiast łatek: chodniki z granic przekroju, `mapped-way` zamiast `fitToKerb`/`fitLanes`/`kerbFills`/`kerb-widen`/`cutSidewalk`/`bridgeFills`/`stretchZebras`; skrzyżowania z narożnikami. Można podzielić na 7a ulice, 7b skrzyżowania, 7c mosty | zastępuje etap 5 wzdłuż krawężników | `kerb-gap-bare` 28 460 → ≤ 2 850 (−90%); `footway-on-carriageway` 471 → 0 dla `footway=sidewalk`; `kerb-fill-wide-estimated` usunięta; `ground-strip-gap` 4 100 → ≤ 1 000 m²; ok. −1 000 linii w `tools/osm-import` (baza `code-health`) |
| 8 | Etap 4 ADR-0078 (`rectClip`) i etap 5 zawężony do styku przekrój–obszar, z nakładką ortofoto | etapy 4–5 | `ground-strip-gap` ≤ 300 m²; `landuse-bare` spadek, bez nowych kluczy `grass-under-paving`; 0 samoprzecięć po domknięciu |
| 9 | `walk-blocked` przejmuje bazę; 6 starych kontroli usuniętych, `ledgesOf` w AI na `walkStep` | niezależny | 207 → 202 rodzaje; `bridge-edges-ai` zielony (G-741); `deck-abutment-step` 8 → klucze `walk-blocked` przy tych samych przyczółkach |
| 10 | Szerokości z ortofoto (źródło 2): pomiar z klas ADR-0077, tabela wygenerowana | po ADR-0077 krok 1.x | udział `default` w długości ulic spada o połowę wobec PR 5; przegląd `topography-curator` |

## Konsekwencje

- **Złote hashe** (`packages/sim/test/determinism.test.ts`):
  - zmieniają się w PR 1, 3, 6 i 7, a w każdym z nich świadomie, z uzasadnieniem w commicie;
  - PR 4, 5 i 9 nie zmieniają hashy (5 to refaktor bajt w bajt, 4 i 9 dotyczą tylko skanu, a `ledgesOf` w PR 9 może zmienić hash AI, co trzeba sprawdzić).
- **Migawka NPR** (`e2e/npr-perf.spec.ts`) zmienia się w PR 6–8, bo zmieniają się obrysy i krawężniki. Aktualizacja świadoma, z pomiarem `reports/perf.json` przed i po.
- **Rozmiar tablic:** dziś 1,57 MB tablic dzielnic, 3 852 kawałki nawierzchni.
  - `half` dokłada ok. 6 KB;
  - wynik etapu 3 w 0,01 m podwaja część cyfr (zmierzyć w PR 6);
  - wspólne granice zamiast nakładanych pasów zmniejszają liczbę kawałków (B w ADR-0078: obrysy −31%).
- **Czas importu:** wariant B ADR-0078 to +13–20% `generate`. Przekrój zastępuje próbkowanie `cutSidewalk` co 0,5 m i marsz `kerbFills`, więc oczekujemy wyniku netto ≤ B. Mierzone `bench:ground` i `pnpm bench:ab`.
- **Budżety ADR-0079:** wierzchołki miasta (ok. 974 tys.) przy limicie 2,5 mln; narożniki skrzyżowań z łukiem 0,1 m dokładają wierzchołki. Próg: +15% wierzchołków nawierzchni, liczba wywołań rysowania bez zmian (nawierzchnia kawałka to jeden bufor).
- **Kod:** usunięte `kerb-fill.ts`, `kerb-widen.ts`, `lane-fit.ts` (w większości), `bridge-fill.ts`, `fitToKerb`, `cutSidewalk` i część `corrections-kerb.ts`. Dochodzi `street-section.ts` i `walk.ts`.

## Ryzyka i jak je mierzyć

- **Wierność Lublinowi** (chodnik przyciągnięty do krawężnika albo pas zieleni tam, gdzie OSM ma chodnik dalej): miara to m² na klasach ortofoto przed i po (`orto diff`, ADR-0077) i przegląd `topography-curator` w PR 7 i 10; odstępstwa wpisujemy do `docs/topografia.md`.
- **Semantyka `onRoad` pod chodnikiem** (56 + 35 wystąpień): testy sesji dla parkowania, tłumu i `vehicle-rest` przed PR 6; przy każdym kluczu `parked-car-*`, `crowd-*`, `figure-on-road` przybyłym w PR 6 bramka stop.
- **Skrzyżowania o wielu ramionach i ronda:** test przypadków (T, X, rondo, ślepy koniec, wiadukt nad ulicą); `ground-ring-self-cross` = 0 i brak okruchów < 0,05 m² po PR 7b.
- **`walk-blocked` może być za szeroka** (fałszywe znaleziska na skarpach i murach): PR 4 idzie obok starych kontroli; przed PR 9 raport pokrycia kluczy i ręczny przegląd 20 losowych znalezisk.
- **Determinizm:** offset w Clipper2 na liczbach całkowitych; testy „gives the same result twice” i „reproduces the committed tables… twice” w `generate.test.ts`; G-745 (`osm:props` nieidempotentne) naprawić przed PR 6, bo psuje porównania przed/po.

## Odpowiedzi użytkownika (13.11)

1. Próg uskoku: w górę 0,45 m (`STEP_HEIGHT`), w dół 0,35 m (`SNAP_DOWN`), jak w szkicu.
2. Kontrole rysunku (`ground-over-deck`, `paving-overlap-step`, `marking-step`) zostają osobno; `walk-blocked` zastępuje tylko kontrole uskoków.
3. Odrębny chodnik z OSM 1–3 m od szacowanej krawędzi jezdni: pierwszeństwo ma ortofoto (poszerzenie asfaltu albo chodnika do krawężnika); pas zieleni tylko tam, gdzie ortofoto pokazuje zieleń. Kolejność źródeł w punkcie 2 decyzji: dla granicy jezdnia | chodnik ortofoto przed `mapped-way`.
4. Szerokości z ortofoto: automatyczny pomiar zapisany jako tabela wygenerowana (PR 10), przegląd `topography-curator`; ręczne poprawki typu T-247 przechodzą do tabeli.
