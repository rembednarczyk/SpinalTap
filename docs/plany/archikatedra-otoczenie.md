# Archikatedra: audyt otoczenia do etapów K3–K4

Kurator topografii, 24.11.2026, gałąź `feat/katedralny-noc` (worktree `wt-kat`). Audyt na prośbę użytkownika z 24.11 (zdjęcia frontu, boku w śniegu, Wieży Trynitarskiej i Street View z Królewskiej). Bryła katedry (portyk, kaplice, nawa, wieżyczki) jest poza tym audytem: robi ją główna sesja na własnym pomiarze NMPT.

Źródła i metoda:
- OSM: wyciągi `data/osm/*.json` i `data/osm/points/*.json`, rzut jak `geoToWorld` (sonda w Pythonie na tych samych wzorach).
- BDOT10k: `data/gugik/bdot.json` (ściany oporowe, mury historyczne).
- NMT: `data/terrain` przez `loadDistrictDtm`/`dtmAt`; y gry = NMT − 195,75 m (zmierzone na 4 płaskich miejscach: −195,70…−195,80).
- NMPT: `data/gugik/nmpt` (`loadChms`, `chmAt`), wierzch = NMT w środku oczka + NMPT − NMT.
- LoD2 GUGiK: `data/gugik/lod2/0_-1.json`.
- Ortofoto PZGiK z pamięci `~/.cache/seki-orto`: lot 2024-06 (liście) i 2025-04 (12.04.2025, bez liści), przerzucone na siatkę gry.
- Gra: `stare-miasto.generated.ts`, `props.generated.ts`, `groundY`, `surfacesAt`, `PARKED_CARS`, `MAP_CHUNKS[].barriers`; zrzuty `/dev/shm/kat0/kat-{krolewska,south,front,east,tower}.png`.
- Sondy: tymczasowe testy vitest `packages/sim/test/zz-topo-kat1..6.test.ts` (usunięte), skrypty `topo_*.py` w scratchpadzie.

Oznaczenia: „niepotwierdzone” to wiedza ogólna bez pomiaru w danych. Numery T- i G- poniżej są propozycjami. Ostatni wpis rejestru to T-349 (bryła katedry, etap K1), ostatni glitch G-967.

## 1. Murki, schody i taras wzdłuż Królewskiej

### 1.1 Dane

| Element | OSM | Przebieg (x; z) | Uwagi |
|---|---|---|---|
| Murek parkingu | w590597335 `barrier=wall`, `height=3` | (554,4; −195,8) → (554,7; −200,5) → (589,2; −197,8) | południowa krawędź tarasu parkingu, 39 m |
| Murek przy schodach i katedrze | w232362979 `barrier=wall`, `height=3` | (584,6; −200,6) → (604,8; −199,4) → (605,2; −202,7) → (611,0; −202,1) → (611,5; −204,8) → (617,9; −208,6) → (642,9; −205,8) | odcinek zachodni 20 m (pod tarasem), wschodni 40 m (pas drzew na południe od katedry) |
| Schody z Królewskiej na taras | w565845673 `highway=steps`, `incline=up`, `step_count=15`, poręcz | (584,5; −199,0) → (589,9; −198,5) | bieg równoległy do ulicy, między dwoma murkami; dojście w590597334 od chodnika (582,1; −202,1) |
| Szczyt schodów | w1054482070 → Plac Katedralny w877893121 (`highway=pedestrian`, `sett`) | (589,9; −198,5) → (591,8; −198,4) | |
| Chodnik Królewskiej | w1054482071, w232362925 (`paving_stones`) | z ≈ −202…−210 | |
| Mur oporowy Podwala | w67626198 `retaining_wall`, `height=2` | od (672,5; −200,7) na wschód | G-649 (przesunięty 1,8–3 m względem BDOT) |
| Schody ku Podwalu | w174897217, 50 stopni, `incline=up` | (667,9; −203,4) → (694,8; −176,7) | gra −9,30 → −2,62 (6,7 m), NMT 7,3 m: zgodne |
| Mur seminarium (po drugiej stronie Podwala) | w231832113 `wall`, `height=3` | (686,5; −204,5) → (631,1; −231,4) | poza placem; patrz 1.4 |

BDOT10k: w pasie x 540–666 nie ma żadnej ściany oporowej ani muru historycznego. Najbliższa linia `ściana oporowa` (26780F22-8287…) zaczyna się w (666,7; −201,6) i biegnie na wschód wzdłuż Podwala (to ta z G-649).

### 1.2 Pomiar NMT i NMPT

Sonda co 2 m wzdłuż osi muru; „górny” i „dolny” to NMT 2,5 m od osi po obu stronach, „wierzch” to najwyższy NMPT w pasie ±1 m.

| Odcinek | Uskok NMT (dolny → górny) | Wierzch NMPT nad górnym poziomem | Gra: wierzch muru nad tarasem / nad chodnikiem |
|---|---|---|---|
| w590597335, x 554–558 | 1,0–1,3 m (−3,5…−4,0 → −2,65…−2,85) | +0,2…+1,0 (zwykle +0,3…+0,5) | +2,2…+2,5 / +3,3…+3,5 |
| w590597335, x 560–589 | 1,4–2,4 m (−4,05…−4,85 → −2,45…−2,65) | +0,2…+0,6 | +1,6…+2,2 / +3,4…+4,1 |
| w232362979 zach., x 586–602 | 2,3–2,8 m (−4,85…−5,1 → −2,25…−2,8) | +0,1…+0,7 | +1,0…+1,4 / +3,5…+3,8 |
| w232362979, x 605–612 | brak uskoku (−5,0…−5,3 po obu stronach) | ±0,1: NMPT nie widzi muru wyższego niż ok. 0,3 m | +3,0 / +3,0 |
| w232362979 wsch., x 620–643 | 0,4–1,7 m | tam, gdzie nie zasłaniają korony (x 628–630, 642): +0,1…+0,6 | +2,1…+2,7 / +3,0 |

Wniosek: w rzeczywistości to murki oporowe tarasu. Od strony Królewskiej mają 1,0–2,8 m (wysokość „3” z OSM to wysokość od ulicy z parapetem w najwyższym miejscu), a nad tarasem wystaje tylko parapet 0,2–0,6 m. Odcinek x 605–612 nie ma muru wyższego niż ok. 0,3 m. Ortofoto (2024-06, 2025-04) to potwierdza: rząd aut stoi tuż przy murku, a cień muru jest wąski. Te same liczby wynikają ze Street View użytkownika („kamienne murki oporowe ze schodami i tarasem”).

Taras (parking i pas przed fasadą) leży na NMT −2,2…−2,8, a chodnik Królewskiej na −3,7…−5,3: taras jest 1,0–2,8 m wyżej, uskok rośnie ku wschodowi. Na zachód od x ≈ 554 taras schodzi łagodnie do poziomu ulicy przy wyjeździe alejki w232362937 (526; −204).

### 1.3 Gra dziś i skąd się bierze szara ściana

1. **Murki są w grze rodzaju `wall` o wysokości 3 m liczonej od terenu na osi muru** (`barrierPieces` w `packages/sim/src/content/lublin/barriers.ts`, model `wall` w `barrier-models.ts`: blok od −0,3 m pod terenem do `height`). Import bierze `height=3` z OSM dosłownie (`barrierHeight` w `tools/osm-import/src/barriers.ts`). Liczba z tagu oznacza wysokość od strony ulicy, a gra stawia ją od połowy stoku.
2. **Teren nie ma uskoku.** Komórka `stare-miasto-0-0` ma siatkę terenu 5 m (`"cell":5`), więc uskok 2,4 m rozmywa się na ok. 8 m (z −204…−196). Mur stoi w połowie tego stoku (teren gry na osi −3,4…−3,8, wobec −2,5 na tarasie i −4,0…−4,8 na chodniku). Wierzch wypada na y −0,1…−0,8: 1,6–2,5 m nad tarasem i 3,3–4,1 m nad chodnikiem. Z Królewskiej widać jasnoszarą ścianę wyższą od człowieka o ponad 2 m (`kat-krolewska.png`), a z tarasu murek wysokości 2 m zasłania ulicę (`kat-front.png`, prawa strona, przed Figurą Matki Bożej).
3. **Skutki uboczne rozmytego uskoku** (sonda `groundY` wobec NMT):
   - taras przy murku jest do 0,6 m za nisko, a przy szczycie schodów 0,8–1,3 m za nisko (gra −3,66 wobec −2,4…−2,9);
   - chodnik u stopy muru jest do 0,36 m za wysoko i przechyla się ku murowi;
   - schody w565845673 (15 stopni, ok. 2,3 m) wznoszą się w grze tylko o 0,39 m (−4,05 → −3,66); skan zna to miejsce (`steps-count-osm` stare-miasto-0-0 584,−199), ale nie ma do niego zgłoszenia;
   - Figura Matki Bożej n6191145919 (599,5; −197,9) stoi na y −3,49, czyli 1,0 m pod tarasem z NMT.
4. **Ciemny pas z łukami w `kat-south.png` to nie mur ani teren.** To cokół bryły katedry w66286341: `y` −9,6 (najniższy punkt obrysu przy Podwalu, narożnik SE (666,9; −203,1)) i `plinth` 9,9 m, więc ciemna podmurówka sięga y ≈ 0,3, czyli ok. 2,6 m nad płytę placu, a nad nią zaczynają się okna. Jasna ściana przed nim to wschodni odcinek w232362979. Wskazówka dla bryły (główna sesja): cokół liczony od najniższego punktu obrysu, który schodzi skarpą ku Podwalu, wychodzi także na fasadzie od placu (`kat-front.png`: ciemny pas ok. 2,5 m pod oknami).

Skala w całym mieście (sonda na wszystkich `barriers` rodzaju `wall` i `retaining-wall`, kawałki po 4 m): 1063 kawałki, 543 mierzalne (bez koron i dachów nad murem). W 38 z nich wierzch w grze jest ponad 1 m wyżej niż wierzch NMPT. Połowa, czyli 19, przypada na Plac Katedralny (w590597335: 14, w232362979: 5), dalej w67626198: 5 (G-649), w231832113: 4, w1348806707: 4, r18507552: 3, w67498742: 2, w232362881: 1. Uskok NMT ponad 1 m, który gra oddaje w mniej niż połowie, ma 26 kawałków (w1348806707: 7, r18507552: 5, w399069071: 2, w590597335: 2, pozostałe po 1).

### 1.4 Ocena i propozycja

- **Waga:** S3. To najbardziej widoczne odstępstwo w otoczeniu zabytku: zasłania taras i parking od ulicy, a placowi zasłania ulicę. Nie blokuje przejścia, bo schody są drożne.
- **Wzorzec:** linie nieciągłości (breaklines) w modelu terenu, standardowe w NMT/TIN (GUGiK, LandXML): mur oporowy jest krawędzią, po której teren skacze, a mur ma wierzch „poziom górny + parapet”, nie „teren na osi + wysokość”. Dziś import nie ma ani jednego, ani drugiego: wysokość jest od osi, a siatka 5 m nie ma krawędzi.
- **Krok A (mały, import i sim, bez ruszania terenu):** każdy kawałek muru (`wall`, `retaining-wall`) dostaje bezwzględny wierzch z pomiaru: górny poziom NMT ±2,5 m od osi plus parapet z NMPT (przycięty do 0,2–1,2 m, domyślnie 0,4 m, gdy NMPT zasłaniają korony). Sim liczy wysokość kawałka jako `wierzch − groundY(środek)`. Mur oporowy z tagiem `height` traktujemy jako wysokość od dolnej strony, nie od osi. Na tym placu wierzch spada o 1,0–2,5 m, a od ulicy mur ma wtedy 1,5–2,5 m nad (za wysokim) stokiem. Koszt: mały do średniego (pole `top` w `LublinBarrierData`, `barriers.ts` w imporcie i sim, regeneracja tablic). Kontrola `wall-top-over-nmpt` spada z 38 do ok. 19 albo niżej. Odcinek w232362979 x 605–612 dostaje 0,3 m albo wypada z importu w korekcie, do potwierdzenia zdjęciem.
- **Krok B (średni, teren, osobny PR):** uskok pod murem. W pasie ±3 m wzdłuż murów z kontroli `wall-step-smeared` (tu w590597335 i zachodni odcinek w232362979) siatka zagęszcza się do 1,25 m (mechanizm `refineGrid` jak `w3Grid`/`flightGrid`, z komórką mniejszą niż `FLIGHT_CELL`). Punkty po górnej stronie dostają górny poziom NMT, po dolnej dolny, a ścianka muru zakrywa krawędź. Dopiero wtedy schody w565845673 dostają pełne 2,3 m, a taras, Figura Matki Bożej i rząd aut przy murku stają na NMT. Koszt: średni. Zmiana terenu jest ryzykowna (trasy tłumu, auta, skany `steps-*`, `ground-*`), więc idzie w osobnym PR, z przeglądem kuratora i zrzutami `kat-krolewska` i `kat-front`.
- **Mur seminarium w231832113** (po drugiej stronie Podwala, x 633–687): ten sam błąd (gra +2,5…+2,7 m nad NMPT w 4 miejscach). Wychodzi przy kroku A, bez osobnej pracy.

## 2. Parking na Placu Katedralnym

| | Gra dziś | Rzeczywistość | Źródło |
|---|---|---|---|
| Obszar | `carParks` w179262652, `kind: surface`, 1626 m², obrys z doklejonym rogiem przy schodach (589,8; −197,2)…(590; −199) | `amenity=parking`, `parking=surface`, `fee=yes`, `operator=EuroPark`, `name=Plac Katedralny- płatny`; bez `surface`, `capacity` i `parking_space` | OSM |
| Alejki | brak osobnego rysunku (cały obszar jak jezdnia) | w232362937 i w720908362, `service=parking_aisle`, `surface=sett` | OSM |
| Nawierzchnia | `road` w 415 z 629 próbek co 2 m (reszta: plac 59, chodnik 66, trawa 34, bruk 34); w `kat-front.png` ciemny asfalt | jasnoszara kostka lub płyty kamienne z białymi liniami stanowisk | ortofoto 2024-06 i 2025-04 |
| Stanowiska | brak | 4 rzędy prostopadłe: po obu stronach obu alejek (z ≈ −173…−178, −181…−186, −187…−192, −192…−197), stanowisko ok. 2,5 m | ortofoto |
| Auta | 0 (`PARKED_CARS` w pudełku x 500–612, z −205…−165) | ok. 55–70 aut (szacunek z obu lotów); parking jest zwykle pełny | ortofoto |
| Wjazd | alejka do Królewskiej przy (526; −204) | tak samo | OSM |

Przyczyna braku aut: `parked-cars.ts` stawia auta tylko na Placu Zamkowym (`squareCars`), przy krawężnikach (`kerbCars`) i w parkingach przykrawężnikowych (`bayCars`). Parking naziemny (`parking=surface`) nie dostaje żadnego. To reguła dla całego miasta: 70 parkingów naziemnych w danych, w tym 28 o powierzchni co najmniej 300 m² i 15 z alejką `parking_aisle` w środku. Wszystkie 15 są bez aut, bo żaden nie leży w pudełku Placu Zamkowego.

- **Waga:** S4. Parking przed katedrą jest pusty i wyasfaltowany, a w rzeczywistości jest pełny i wyłożony kostką. To rzuca się w oczy na zdjęciach użytkownika, ale nie psuje układu.
- **Wzorzec:** układ stanowisk prostopadłych wzdłuż alejki manewrowej, odczytywany z alejek OSM `service=parking_aisle` (tak, jak generatory brył 3D z OSM rozkładają stanowiska). Typowe wymiary stanowiska prostopadłego to 2,5 × 5,0 m przy alejce ok. 6 m (warunki techniczne dróg publicznych). Od Placu Zamkowego różnimy się tym, że rzędy idą wzdłuż alejek z OSM, nie po pudełku i stałym kroku.
- **Propozycja:**
  1. korekta nawierzchni: `surface=sett` (albo `paving_stones`) dla w179262652 w `corrections-surface.ts`, bo alejki mają `sett`, a ortofoto pokazuje kamień;
  2. auta: reguła `aisleCars` dla parkingów naziemnych z alejką (po obu stronach alejki, co 2,5 m, z `fits`, `level` i zajętością jak na Placu Zamkowym 0,8);
  3. opcjonalnie białe linie stanowisk w `markings`.
- **Koszt:** korekta nawierzchni mała. Reguła aut średnia (sim, `parked-cars.ts` ma już 430 linii, więc nowa reguła trafia do osobnego pliku). Rząd przy murku (z −192…−197) wymaga kroku B z 1.4, bo dziś taras przy murku opada o 0,6 m i `level` (0,15 m) odrzuci część stanowisk.
- Drobiazg: automat parkingowy n7854988477 stoi w grze 1,6 m na północ od OSM ((574,4; −172,3) wobec (574,4; −173,9)), poza obrysem parkingu. Powód nieznany, prawdopodobnie zepchnięcie z parkingu przez regułę mebli. Do wyjaśnienia przy kroku aut.

## 3. Wieża Trynitarska

### 3.1 Położenie (G-683, T-264)

| | Zakres x | Środek x | Źródło |
|---|---|---|---|
| OSM w66286371 (`height=40`, `historic=city_gate`, `man_made=tower`) | 582,8…599,9 | ok. 591,3 | OSM |
| Część w617763431 (`height=50`, beż) | 583,5…597,1 | 590,3 | OSM |
| Część w618268118 (50–55, zielona) | 585,3…595,5 | 590,4 | OSM |
| Część w617763432 (55–60, `pyramidal`, `roof:height=5`, zielona) | 586,5…595,2 | 590,9 | OSM |
| LoD2 26780F22-0D25 | 578,9…593,6 (z −154,4…−140,0) | 586,3 | GUGiK |
| NMPT: bryła ponad y 30 | 579,5…593,5 (z −154…−140) | 586,4 (z −147,0) | GUGiK NMPT |
| NMPT: iglica ponad y 45 / 50 | 582…591 / 584…589 | 586,6 / 586,5 | GUGiK NMPT |
| Przejazd Gruella w298307007 | 586,6…587,6 | | OSM (`tunnel=yes`) |

NMPT potwierdza hipotezę T-264 niezależnie od ortofoto. To model powierzchni z lidaru, więc przechył wieży na zdjęciu lotniczym go nie dotyczy. Obrys OSM jest przesunięty o 4,9 m na wschód, a części hełmu o 3,9–4,4 m. Rozmiary części są dobre (korpus OSM 13,6 m, NMPT 13,5 m), źle jest tylko ich położenie. Po przesunięciu przejazd Gruella leży 0,2–1,2 m od osi wieży, czyli w osi, tak jak w rzeczywistości. Wpis `gate-mouth-off-axis` (587,−140) i (588,−154) powinien wtedy zejść. Pas x 579…583 należy w LoD2 do wieży, a OSM daje go plebanii w66286370 (wschodnia ściana na x 582,8…584,0), więc plebania do przycięcia do x ≈ 579. Status: hipoteza T-264 potwierdzona pomiarem, poprawka bez czekania na zdjęcie.

### 3.2 Wysokości i kształt

| | Gra dziś (y) | Rzeczywistość (y, teren y ≈ −0,85) | Źródło |
|---|---|---|---|
| Korpus (jasny tynk) | do 41,2 (w66286371, `height` 42 z cokołem 2) i dalej beżowa część w617763431 do 51,2 | okap 36,9 (37,8 m nad terenem); NMPT: pierścień ścian 37–39 | LoD2, NMPT |
| Naroża korpusu | jak ściany | NMPT 25–27 w czterech narożach (x 579–582 i 590–594, z −140…−142 i −151…−154), na środkach boków 37–39 | NMPT, interpretacja niepotwierdzona |
| Iglica (zielona) | zielona część w618268118 51,2–56,2, ostrosłup w617763432 56,2–61,2 (razem 10 m) | od ok. 37 do 58,6 (kalenica LoD2 59,5 m nad terenem), ok. 21,5 m; NMPT widzi pełną bryłę do 51,4 nad (586,3; −145,3), cienkiego szczytu już nie | LoD2, NMPT |
| Szczyt | 61,2 | 58,6 | LoD2 |
| Narożne szczyty i sterczyny przy iglicy | brak | są na zdjęciu użytkownika; NMPT pasuje do szczytów na środkach boków do ok. 38 i obniżonych naroży | zdjęcie użytkownika, NMPT (niepotwierdzone co do wymiarów) |

W grze beżowy korpus jest ok. 14 m za wysoki, a zielona iglica ma połowę rzeczywistej długości (10 m zamiast ok. 21,5 m). Sylwetka jest odwrócona: masywny, wysoki korpus i krótki hełm, a powinien być korpus ok. 38 m i wysoka smukła iglica. Przyczyną są tagi części w OSM (korpus `height=50`), a T-143 dotyczy tylko koloru. Skan tego nie łapie (`osm-tower-default-height`, `church-tower-off-nmpt` i `landmark-vs-lod1` nie mają wpisów przy wieży).

Zegar: OSM nie ma tarczy (jedyny `amenity=clock` w pobliżu to zegar słoneczny n4839302930 (645,6; −270,2)). Zegar jest na zdjęciu użytkownika. Niepotwierdzone (wiedza ogólna): tarcze w osi ścian na najwyższej kondygnacji korpusu, pod gzymsem wieńczącym, czyli w grze ok. y 32–35 po korekcie wysokości. Strony i liczbę tarcz trzeba odczytać ze zdjęć użytkownika, co najmniej jedna od strony placu (południe).

Zależności w treści gry: `KATEDRALNY_BEACON` (`katedralny-lights.ts`) stoi w (591,3; 42,4; −147,3), czyli w środku beżowej części w617763431 (41,2–51,2), i dziś jest zakryty. Światło przeszkodowe powinno stać na szczycie iglicy (po korekcie ok. y 58,6, x ≈ 586,4). Dwa reflektory `kat-wash-tower-*` też liczą położenie od obrysu OSM.

- **Waga:** położenie S4 (G-683), wysokości i kształt S3. To sylwetka zabytku z listy kuratora, widoczna z całego Starego Miasta.
- **Propozycja:** w `corrections-landmarks.ts` przesunąć obrys w66286371 i trzy części o (−4,9; 0) (albo wziąć obrys z LoD2), przyciąć w66286370 do x ≈ 579 i nadpisać wysokości części: korpus do 37,8 m nad terenem, iglica jako ostrosłup 37,8 → 59,5 m z czterema narożnymi sterczynami i szczytami na bokach (przepis zabytku w `landmarks/recipes.ts`, tak jak mają Brama Krakowska i Grodzka). Zegar dopiero po potwierdzeniu na zdjęciu. Na końcu przenieść beacon i reflektory.
- **Koszt:** średni (korekty importu, przepis zabytku w rendererze, regeneracja, zrzut `kat-tower` i widok z placu). Przy okazji zamyka G-683 dla wieży.

## 4. Słupki, latarnie, ławki i drzewa

| Rzecz | Gra dziś | OSM i rzeczywistość | Ocena |
|---|---|---|---|
| Słupki z łańcuchami wzdłuż Królewskiej | 37 słupków co 1,8 m na linii w1302893330 (547; −203) → (612; −211), łańcuchy 1,70–1,81 m (wariant), ostatni bez łańcucha | linia OSM 66,7 m; Street View użytkownika: czarne słupki z łańcuchami | zgodne (T-301, reguła G-818) |
| Słupki na krawędzi parkingu | 13 słupków w punktach OSM (508,8…538,8; −185,3…−197,2), połączone łańcuchami | węzły `barrier=bollard` n1896043410, n8260368938…48 | zgodne co do położenia; łańcuchy wynikają z reguły G-032, w danych ich nie ma (niepotwierdzone) |
| Słupki przy Podwalu | 5 w punktach OSM (621,4…628,5; −212,4…−208,7) | n8260368970…74 | zgodne |
| Ławki | 8 w punktach OSM wzdłuż ścieżki w232362948 (538,3…579,0; −172,8…−168,6), 2 przy przystanku | to samo | zgodne |
| Latarnie | 11 pastorałów wzdłuż Królewskiej i Podwala (reguła, część z koszami kwiatów), 2 parkowe na ścieżce nad parkingiem (528,3; −174,4), (558,1; −171,3), 3 latarenki na fasadzie, 4 reflektory iluminacji | OSM nie ma w tym pudełku ani jednego `highway=street_lamp`; ortofoto nie rozstrzyga | do sprawdzenia na zdjęciach użytkownika; brak latarń na samym parkingu (niepotwierdzone) |
| Figura Matki Bożej n6191145919 | (599,5; −197,9), y −3,49 | to samo miejsce, taras NMT ok. −2,45 | położenie zgodne, wysokość 1,0 m za nisko (1.3, krok B) |
| Koziołek Kryspin n12439546243, pomnik Wyszyńskiego n3020699255 | w punktach OSM | to samo | zgodne |
| Drzewa OSM | 26 drzew z OSM w pudełku x 500–700, z −235…−130, dokładnie w punktach | to samo | zgodne |
| Drzewa z reguły koron (G-797) | (509,5; −177,5), (531,5; −172,5), (531,5; −161,5) | korony NMPT (510; −175) 16,8 m, (531; −172) 15,6 m, (532; −161) 5,2 m | zgodne |
| Drzewa na trawniku w67502042 między parkingiem a plebanią | brak | korony NMPT: (546; −161) 18,8 m, (557; −157) 17,0 m, (561; −168) 22,4 m, (566; −156) 16,8 m, (574; −166) 7,2 m; ortofoto 2024-06: zielone korony, 2025-04: gałęzie bez liści | do poprawy |
| Drzewa na parkingu i płycie przed fasadą | brak | NMPT bez koron, ortofoto bez drzew | zgodne |

Brakujące drzewa nad parkingiem są tłem widoku z Królewskiej na wieżę i plebanię. Hipoteza: reguła `crown-trees.ts` wymaga korony na ortofoto i czyta lot 2025-04 bez liści albo odrzuca korony przy ścianie plebanii (`crownClear`, z −154,6…−158). Korona (561; −168) stoi jednak ok. 10 m od ściany, więc ta druga przyczyna nie wyjaśnia wszystkiego. Skan `canopy-without-tree` nie ma tu wpisów (kwadraty 540…570, −170…−150), więc te drzewa umykają też kontroli.

- **Waga:** S4. **Koszt:** mały (diagnoza reguły i regeneracja rekwizytów).

## 5. Proponowane kontrole skanu

| Kontrola | Definicja | Liczba bazowa (sonda 24.11) |
|---|---|---|
| `wall-top-over-nmpt` | kawałek muru (`wall`, `retaining-wall`, po 4 m), gdzie NMPT nad nim jest mierzalny (wierzch NMPT w pasie ±1 m minus górny NMT ±2,5 m < 3 m, czyli bez koron i dachów), a wierzch w grze (`groundY` na osi + `height`) jest ponad 1,0 m wyżej niż wierzch NMPT | 38 w mieście (z 543 mierzalnych z 1063), w tym 19 na Placu Katedralnym |
| `wall-step-smeared` | uskok NMT w poprzek muru (±2,5 m) > 1,0 m, a uskok terenu gry w tych samych punktach < połowy | 26 w mieście, w tym 3 na Placu Katedralnym |
| `landmark-part-vs-lod2` | zabytek z listy kuratora z częściami `building:part`, gdzie ściany najwyższej części jasnej (bez dachu i hełmu) kończą się ponad 5 m od okapu LoD2 | co najmniej 1 (Wieża Trynitarska: 51,2 wobec 36,9); reszty listy nie mierzyłem |
| `surface-park-empty` | parking `kind: surface` o powierzchni ≥ 300 m² z alejką `service=parking_aisle` w środku i bez zaparkowanego auta | 15 |

Odwrotny warunek (wierzch w grze ponad 1 m niżej niż NMPT) daje 70 kawałków, ale łapie też pnącza, korony przy murze i okapy sąsiednich dachów. Bez dodatkowego filtra nie nadaje się na kontrolę.

## 6. Proponowane wiersze rejestru

Treść do wpisania przez główną sesję albo przy poprawce. Numery tymczasowe.

| ID | Miejsce | Co w grze | Co w rzeczywistości | Rodzaj | Status |
|---|---|---|---|---|---|
| T-350 | Stare Miasto, Królewska i Plac Katedralny: murki w590597335 (554,4…589,2; −200,5…−195,8) i w232362979 (584,6…642,9; −208,6…−199,4) | `wall` 3 m od terenu na osi, na stoku wygładzonym siatką 5 m: wierzch 1,0–2,5 m nad tarasem i 3,3–4,1 m nad chodnikiem; x 605–612 mur 3 m | murki oporowe tarasu: od ulicy 1,0–2,8 m (NMT), nad tarasem parapet 0,2–0,6 m (NMPT); x 605–612 bez muru ponad ok. 0,3 m; x 620–643 oporowy 0,4–1,7 m, wierzch na poziomie górnym (ortofoto 2024-06, 2025-04, Street View użytkownika) | geometria, wysokość | do poprawy (nowy G, S3; kontrola `wall-top-over-nmpt` 38) |
| T-351 | Stare Miasto, taras Placu Katedralnego wzdłuż Królewskiej (554…605; −205…−195), schody w565845673 (584,5; −199,0) | uskok 1,0–2,8 m rozmyty na ok. 8 m (komórka `stare-miasto-0-0`, siatka 5 m): taras przy murku do 0,6 m za nisko (przy schodach 0,8–1,3 m), chodnik do 0,36 m za wysoko; schody wznoszą się 0,39 m; Figura Matki Bożej n6191145919 1,0 m pod tarasem | taras na NMT −2,2…−2,8, chodnik −3,7…−5,3, krawędź pod murkiem; 15 stopni po ok. 0,15 m (2,3 m) | teren | do poprawy (nowy G, S3; kontrola `wall-step-smeared` 26; `steps-count-osm` 584,−199 już w bazie) |
| T-352 | Stare Miasto, parking Plac Katedralny w179262652 (508,8…598,7; −199,6…−171,7) | nawierzchnia `road` (asfalt), 0 aut, bez stanowisk | jasna kostka lub płyty kamienne z liniami stanowisk, 4 rzędy prostopadłe wzdłuż alejek w232362937 i w720908362 (`sett`), ok. 55–70 aut (ortofoto 2024-06 i 2025-04); `fee=yes`, EuroPark | meble, geometria (nawierzchnia) | do poprawy (nowy G, S4; kontrola `surface-park-empty` 15) |
| T-353 | Stare Miasto, Wieża Trynitarska w66286371 i części w617763431, w618268118, w617763432 (591,3; −147,3) | jasny korpus do y 51,2, zielone części 51,2–61,2 (10 m) | LoD2: okap 37,8 m, kalenica 59,5 m nad terenem 194,9 m (y 36,9 i 58,6); NMPT: ściany 37–39, naroża 25–27, iglica pełna do 51,4; iglica ostrosłupowa z narożnymi sterczynami i szczytami (zdjęcie użytkownika), zegar (zdjęcie, położenie niepotwierdzone) | wysokość, zabytek | do poprawy (S3, razem z G-683; kontrola `landmark-part-vs-lod2` ≥ 1) |
| T-354 | Stare Miasto, trawnik w67502042 między parkingiem a plebanią (540…575; −170…−155) | brak drzew | 5 koron NMPT 7–22 m: (546; −161), (557; −157), (561; −168), (566; −156), (574; −166); ortofoto 2024-06 zielone korony | meble | do poprawy (nowy G, S4) |

Dopisek do T-264 (zamiast nowego wiersza): „NMPT 24.11 (`data/gugik/nmpt`, lidar, bez przechyłu ortofoto): bryła ponad y 30 x 579,5…593,5, środek (586,4; −147,0), iglica ponad y 50 x 584…589. Przesunięcie OSM 4,9 m na wschód potwierdzone, części hełmu 3,9–4,4 m; przejście Gruella w osi wieży (0,2–1,2 m). Do poprawy bez czekania na zdjęcie.”

## 7. Etapy w kolejności

1. **K3a, murki (mały, import i sim):** wierzch muru z pomiaru zamiast `teren na osi + height` (pole `top`, parapet z NMPT); odcinek w232362979 x 605–612 do 0,3 m albo korekta. Kontrola `wall-top-over-nmpt` w tym samym PR. Zamyka główną część T-350.
2. **K4a, Wieża Trynitarska (średni, równolegle do K3a):** przesunięcie o 4,9 m na zachód, przycięcie plebanii, wysokości części według LoD2, przepis iglicy z sterczynami i szczytami, beacon i reflektory na nowe miejsce; zegar po zdjęciu. Zamyka G-683 (wieża), T-264, T-353.
3. **K3b, uskok tarasu (średni, teren, osobny PR):** linia nieciągłości pod murkami w590597335 i w232362979 (zachód), schody 2,3 m, taras i Figura na NMT. Zamyka T-351, kontrola `wall-step-smeared`.
4. **K3c, parking (średni, po K3b):** nawierzchnia kamienna, reguła aut wzdłuż alejek dla 15 parkingów z alejką (pierwszy Plac Katedralny), opcjonalnie linie stanowisk. Zamyka T-352.
5. **K4b, drzewa i drobiazgi (mały):** 5 koron nad parkingiem (diagnoza reguły koron na locie 2024-06), automat parkingowy 1,6 m, latarnie po zdjęciach użytkownika. Zamyka T-354.

Każdy krok przechodzi przegląd kuratora ze zrzutami `kat-krolewska`, `kat-front` i `kat-south` przed scaleniem i po scaleniu.
