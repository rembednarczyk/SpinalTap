# ADR-0104 E4: grunt ulic z grafu na Podzamczu i Nabrzeżu

Ciąg dalszy `grunt-z-grafu-e3.md` (E3 scalone 27.11, #1090). Próba jak w E3: `SEKI_STREET_GRAPH=podzamcze,nabrzeze` (Krakowskie już w `STREET_GRAPH_DISTRICTS`), pełne testy i skan wobec main, tablice w repozytorium bez zmian do włączenia.

## Runda 1: pierwsza próba (27.11 wieczór)

- **Budowa:** 2 min 38 s (z wolnym slotem maszyny). Raport szerokości: BDOT10k 96,3% długości stron jezdni, domyślne 2,9%; 44 konflikty BDOT10k z ortofoto ponad 1 m (m.in. Turystyczna, Nowy Plac Targowy, Aleja Andersa). Zmieniają się też tablice Krakowskiego i Starego Miasta (granice dzielnic).
- **Testy:** 67 z 8832 padają w 22 plikach (41 to rodzaje skanu bez przyjętych baz). Poza skanem:
  - packages/engine/test/ccby-street.test.ts > utility poles over the side streets (ADR-0063) > stand clear of the buildings with the whole pole, not just its foot: Ciasna's lamp, off the wall now, takes one
  - packages/sim/test/abutments.test.ts > the bridges' abutments (G-349) > are at the free ends of Mełgiewska's bridges, not on the viaduct of Zamkowa with its flight, nor at a footbridge
  - packages/sim/test/abutments.test.ts > the bridges' abutments (G-349) > keep the terrain under the decks' ends where it came through them, not sinking the ground before them (G-736)
  - packages/sim/test/bridge-edges-ai.test.ts > chasing over the edges of the bridges away from the flights of steps (G-255) > gets from the foot of the wall of the western abutment of Mełgiewska's lower bridge onto it, not pressed against the wall (G-762)
  - packages/sim/test/bridges.test.ts > bridges' decks (ADR-0053) > carry a walker across Mełgiewska's bridges between the carriageway and the sidewalk, both ways: one deck, level within a kerb (G-340, G-344)
  - packages/sim/test/bridges.test.ts > bridges' decks (ADR-0053) > take a walker off Andersa onto Mełgiewska's south bridge and back across the whole carriageway, within a kerb (G-349)
  - packages/sim/test/bridges.test.ts > bridges' decks (ADR-0053) > lay Mełgiewska's sidewalks level with their carriageways in each cross section, and Andersa's sidewalk onto the south one without a step (G-737)
  - packages/sim/test/ground-readers.test.ts > the simulation's readers of the ground (ADR-0078 step 3) > keeps the car lanes on the carriageway, a zebra and a cobbled street's setts included
  - packages/sim/test/kerb-bay-cars.test.ts > cars of a kerb car park by the furniture and the footway past its kerb (G-189) > keep a car in Ciasna's deep strip, where only the layout across the kerb fits
  - packages/sim/test/metro-entrances.test.ts > metro entrances on the map (ADR-0071 stage 2) > targ A Plac Zamkowy: a pavement off every car's lane
  - packages/sim/test/street-crime-board.test.ts > the street's board of crimes (ADR-0091 stage 5a) > stands every spot of the board on the pavement of its district, with room round it
  - packages/sim/test/street-furniture-market.test.ts > the market's furniture of ADR-0058 stage 3 > keeps the stock exactly where its stall stays in the game, whichever chunk the stall is in
  - packages/sim/test/traffic-junction-drive.test.ts > the traffic through the junctions (ADR-0055, G-006) > by Ruska and Lwowska (seed 3): none in one of its own route, no more collisions or hold-ups than before
  - packages/sim/test/traffic-junctions.test.ts > turns at junctions (ADR-0055) > turns side by side do not cross: a two-lane carriageway into a two-lane one-way street
  - packages/sim/test/traffic.test.ts > the lanes of the traffic (ADR-0050) > the west carriageway of Aleja Tysiąclecia is one street with a lane all the way and a trolleybus (G-020)
  - packages/sim/test/vehicle-carjack.test.ts > taking a car from the traffic (ADR-0097) > pulls its driver out, throws him onto the road, and he gets up and runs off out of the way
  - tools/osm-import/test/corrections.test.ts > tag corrections (ADR-0042) > paves the north pavement of al. Tysiąclecia from the carriageway to the paths and the beds, and leaves the beds and the paths on top (G-337)
  - tools/osm-import/test/corrections.test.ts > tag corrections (ADR-0042) > paves the north pavement of al. Tysiąclecia east of the Dworzec from the carriageway to the footway, and leaves the road and the sidewalk on top (G-350)
  - tools/osm-import/test/corrections.test.ts > tag corrections (ADR-0042) > paves the wedge with the bus stop's shelter between the sidewalk and the cycleway east of the Dworzec (G-382)
  - tools/osm-import/test/ground-partition.test.ts > the ground as a partition of the plane (ADR-0078 step 3) > lays the city's ground (the committed tables) with no piece over another and no outline crossing itself
  - tools/osm-import/test/props-food.test.ts > the market's stock (ADR-0058 stage 3, generator) > stands beside a stall of every marketplace and the flea market, none in the old town
  - tools/osm-import/test/props-place.test.ts > the traffic lights a node on the road stands for (G-825 r3) > stand where they stood before G-825: by the nearest pavement, whichever side the traffic arrives on
  - tools/osm-import/test/zebra-fit-city.test.ts > the zebras of a junction and a road area's mouth (G-836, round 2) > lays n4586176953's west to east across Cerkiewna's northern branch w739432830, along the path w1435832526
- **Skan wobec main, spada:** `sidewalk-surface-patch` 455 → 202, `ground-strip-gap` 1225 → 1013, `sidewalk-gap` 401 → 284, `kerb-fill-flicker` 70 → 31, `kerb-fill-wide-estimated` 62 → 26, `lawn-on-leafoff-paving` 135 → 91, `footway-on-carriageway` 100 → 80, `crossing-shape-kerb` 44 → 28, `landuse-bare` 687 → 661, `bare-on-cover` 353 → 340, `fill-on-green` 50 → 40.
- **Skan wobec main, rośnie** (kolejność prac):
  1. mosty i pomosty: `deck-slot` 0 → 14, `deck-abutment-step` 2 → 10, `ground-over-deck` 3 → 9, `walk-blocked` 1 → 8, `bridge-end-in-slope` 0 → 1, `lamp-beside-deck` 0 → 1 oraz testy `bridges`, `abutments`, `bridge-edges-ai`: chodniki i jezdnie grafu przy pomostach Bystrzycy i wiaduktach;
  2. ruch: `lane-place-on-green` 0 → 34, `lane-off-ground` 0 → 1, `two-way-fit-narrow` 1 → 3 oraz testy `traffic`, `traffic-junctions`, `traffic-junction-drive`, `kerb-bay-cars`, `vehicle-carjack`;
  3. krawężniki: `kerb-jag` 20 → 38 (narożniki, jak G-982);
  4. meble: `furniture-in-car-lane` 0 → 6, `metro-entrance-blocked` 0 → 1 oraz testy `street-furniture-market`, `metro-entrances`, `props-place`, `props-food`, `street-crime-board`;
  5. drobne: `lawn-strip-on-paving` 1 → 11, `bus-stop-on-fill` 0 → 1, `ground-ring-self-cross` 1 → 2, `paving-coplanar` 0 → 1, `lit-street-dark` 11 → 12.

## Runda 2: mosty, klin rozdziału, ruch (27.11 wieczór)

- **Mosty: naprawione** (commit na tej gałęzi). BDOT10k mierzył też drogi na mostach: pomost jezdni Mełgiewskiej się poszerzał, a chodniki zmapowane na mostach wypadały jako ciągi piesze na jezdni. Stąd szczeliny w pomostach. Most jest poza grafem i zachowuje swoją szerokość. Na próbie: testy mostów 22/22; `deck-slot`, `ground-over-deck`, `walk-blocked`, `bridge-end-in-slope` wracają do main; zostaje `deck-abutment-step` 2 → 6. Testy: 56 padających zamiast 67. Tablice main bez zmian.
- **`lane-place-on-green` (34, węzeł Andersa (2362,8; 362,8)): przyczyna inna niż narożnik.** Łącznik `secondary_link` odchodzi od jezdni pod 32°, obie jednokierunkowe. Reguła klina rozdziału (gore nose: bez zaokrąglenia ostrego kąta między dwiema jednokierunkowymi) działała w teście, ale tu nic nie zmieniła, a na Krakowskim dodawała kilka miejsc (`kerb-jag` +1, `kerb-gap-bare` +2): wycofana. Mapa nawierzchni pokazuje dwie przyczyny: zmapowany ciąg pieszy wzdłuż ulicy kładziony jako jej chodnik o 0,5–1 m szerszy niż w main (na trawnik) i łącznik o 2–3 m szerszy (BDOT10k). Do oceny na ortofoto (kurator), zanim cokolwiek zmienię.
- **Trolejbus Alei Tysiąclecia (`traffic.test.ts`, G-020): wierny skutek.** w739432828: 3 pasy, BDOT10k 10,6 m, ortofoto 10,7 m, jezdnia 2,1 m na prawo od linii OSM. Trolejbus jedzie prawym pasem prawdziwej jezdni, 3,8 m od linii OSM; test dopuszcza 2 m od linii (dostrojony do starego modelu, który liczył pasy od linii OSM). Do przepisania na intencję (prawy pas jezdni).
- **Zostaje sprawdzić:** pozostałe testy ruchu (skrzyżowania, Ruska z Lwowską, porywanie auta, pasy poza jezdnią: 5 punktów), zatoka przy Ciasnej, meble (rynek, wejście metra na Placu Zamkowym, tablica przestępstw), korekty Alei Tysiąclecia (`corrections.test.ts`), `kerb-jag` 20 → 38, `lawn-strip-on-paving` 1 → 14.

## Runda 3: złącza z pomostami, ruch na skrzyżowaniach (27.11 wieczór)

- **Złącze jezdni grafu z końcem pomostu: zrobione** (`streets/abutment-joints.ts`, test `abutment-joints.test.ts`). Pomost jest ucięty prosto do osi mostu, ulica grafu prosto do swojej osi i przesunięta przez BDOT10k (Mełgiewska o 2,1 m): między końcami zostawały szczeliny, a pasy z pomostu wjeżdżały na chodnik grafu. Teraz asfalt od narożników końca pomostu do krawężników grafu 10 m dalej, jak rampa złącza. Na próbie `ground-readers` i testy mostów zielone; tablice main bez zmian. Zostaje `deck-abutment-step` 2 → 6 (uskok wysokości terenu za przyczółkiem, osobno).
- **Ruch na skrzyżowaniach Podzamcza (do zrobienia):**
  - `traffic-junction-drive`, Ruska z Lwowską (ziarno 3): postoje 200 pojazdo-sekund wobec 113 przed zmianą skrętów;
  - `traffic-junctions`, Furmańska z Cyruliczą: test buduje pasy ±1,6 m od linii OSM, a łuk skrętu musi leżeć na jezdni z mapy; z jezdnią grafu (BDOT10k, przesunięcie osi, promień narożnika 3–4 m) zmieniają się pary skrętów. Hipoteza: łuki pasów potrzebują promienia większego niż narożnik grafu i część skrętów wypada; do sprawdzenia na jednym skrzyżowaniu;
  - `vehicle-carjack`: wyrzucony kierowca odbiega 12,9 m zamiast ponad 25;
  - `kerb-bay-cars`: brak auta w głębokim pasie postojowym przy Ciasnej.
