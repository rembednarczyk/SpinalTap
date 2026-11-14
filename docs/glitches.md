# Rejestr glitchy

Proces: [ADR-0054](adr/0054-proces-glitchy.md). Skala, priorytety i szablon: umiejętność `glitch-triage` (`.claude/skills/glitch-triage/SKILL.md`). Pełne wpisy naprawionych i odrzuconych: [glitches-archiwum.md](glitches-archiwum.md). Liczniki skanu: `tools/glitch-scan/test/glitch-baseline.json`, miejsca: `reports/glitch-scan.json`.

## Otwarte

### G-016 Auta zaparkowane do 10 m za zebrą na dwukierunkowej 3 Maja
- Status: później (S4; pełny art. 49 PoRD dla dróg dwukierunkowych, po G-015)
- Gdzie: (−115,58, 31,83) 3,0 m, (−103,16, −32,87) 7,75 m, (−115,53, 25,62) 9,0 m za zebrą

### G-026 Zawrotki na wąskich ulicach mają promień ok. 1,5 m
- Status: zgłoszone (S4 proponowana)
- Gdzie: 7 nowych zawrotek z G-023 (rozstaw pasów 2,7–3,3 m)
- Dowód: weryfikator G-023: sedan 4,5 m obraca się prawie w miejscu; na Alei promień 8–14,5 m.
- Test przyjęcia: kontrola minimalnego promienia zawrotki albo zawracanie wielopunktowe.

### G-027 Skok pozycji auta na Zielonej
- Status: zgłoszone (do potwierdzenia)
- Gdzie: Zielona#21:d, z (271,6, −18) do (238,6, 4,7) w jednym kroku
- Dowód: sonda weryfikatora G-023 (seed 3, 8:00, 60 s); może być resynchronizacją auta poza wzrokiem.

### G-036 Sąsiednie zawrotki na Alei Tysiąclecia przy targu stykają się w wierzchołku
- Status: zgłoszone (z G-006)
- Ważność: S3 · Gdzie: ok. (756, 345) · Dowód: naprawiacz G-006: półokręgi o różnym promieniu sięgają tego samego wierzchołka; 24 zdarzenia kolizji na seedach 1–2 już na starej bazie (rodzina G-025/G-026, `turnRound`/`uTurn`).

### G-041 Wzór bruku placu przesuwa się na granicy chunków
- Status: zgłoszone (z G-018)
- Ważność: S4 (proponowana) · Zasięg: każdy plac `square` na granicy chunków · Koszt: mały
- Gdzie: Plac Litewski, x ≈ 20 (szew krakowskie-0-1/1-1)
- Dowód: naprawiacz G-018, zrzut po poprawce: wzór płyt nie łączy się na szwie. Bruk `square` jest przycięty osobno w każdym chunku, a UV liczone z prostokąta kawałka (`obbLocal`); możliwy też podwójny `square` w chunku (bez pomiaru z-fightingu).
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-042 Strome schody pod brukiem placu mogą przebijać bruk
- Status: zgłoszone (z G-018)
- Ważność: S4 (proponowana) · Zasięg: 15 pasów schodów w 100% pod `square`/`cobble`, np. krakowskie-2-0 (414, −90), podzamcze-1-0 (886, 223), stare-miasto-0-0 (575, −70) · Koszt: mały
- Dowód: naprawiacz G-018. Importer stawia schody na wierzchu (`ORDER` steps: 8), a renderer pod placem (stopnie +0,05, `square` +0,08). Do decyzji, która warstwa wygrywa. Osobno: 15 stromych biegów z płaskimi odcinkami ma pojedyncze podstopnie < 4,5 cm (np. stare-miasto-1-0 (680, −193)), których `steps-micro-riser` nie liczy.
- Pakiet właściciela: packages/engine (renderer/mapcity) / tools/osm-import

### G-007 Strzałki na pasach i napis BUS
- Status: później (ADR-0052 „Na później”)

### G-053 Plac po Farze bez fundamentów fary; ruiny z OSM pominięte
- Status: częściowo naprawione: fundamenty fary jako bariery 0,5 m od #418 (r18507552, r18507551, odcinki w1348806xxx; T-251); zostają ruiny `building=ruins` (w232362881, w1330433247, w813194693), które pomija `SKIP_BUILDING`. W1330433247 ma 3,3 m w LoD1 (NMPT wierzch y 3,75). Test przyjęcia zawęzić do ruin: 3 obrysy jako niskie mury z wysokością z LoD1 albo NMPT.
- Ważność: S4 (proponowana) · Zasięg: lokalny (Plac po Farze na trasie Grodzkiej) · Koszt: średni (nowa bryła niskiego muru w imporcie i rendererze)
- Gdzie: w173519315 (672.8, 43.2) i 3 budynki `building=ruins` (T-015); ile w mieście: 4 w dwóch dzielnicach
- Dowód: `SKIP_BUILDING` w generate.ts; `props-kinds.ts` „ruins: structures (later)”
- Przyczyna (przypuszczalna): ruiny nie mają reprezentacji
- Pakiet właściciela: tools/osm-import i packages/engine (renderer/mapcity)
- Test przyjęcia: zarys fundamentów fary jest w danych chunku stare-miasto-1-1 jako niski mur (≤ 1 m) i nie ma kolizji z nawierzchnią placu

## Proponowane kontrole skanu (`tools/glitch-scan`)

| Kontrola | Definicja | Baza |
|---|---|---|
| `landmark-default-height` | Budynek z listy zabytków skanu (`LANDMARK_BUILDINGS`) z `source: "default"` (wysokość z wartości domyślnej dzielnicy) | 3 (w66258167 Kaplica Trójcy, w67508958 Teatr Osterwy, w66330578 kościół Nawrócenia św. Pawła); 2 po G-204, 1 po #208 (Teatr Osterwy); G-204 |
| `church-fake-tower` | Kościół (`use: church`), któremu `addTowers` dokłada wierzchołki wież, a nie ma go na liście kościołów z prawdziwą wieżą (NMPT/OSM; dziś: Brygidki w66264082, św. Jozafata w69916021, św. Mikołaja w66258180, Świętego Ducha w66264126, cerkiew Przemienienia w66264148, Bernardyni w66330578) | 4 po #198 (Kapucyni, św. Piotra, św. Wojciecha, Niecała 4; Karmelici zdjęci w #198); G-215 |
| `church-tower-off-building` | Środek wieży proceduralnej (`towerSpots`) poza obrysem swojego budynku | 0 po #198 (w skanie od #198); G-212 |
| `church-over-nmpt` | Budynek `use: church` z `source: "default"` bez pomiaru albo z okapem lub kalenicą ponad 1,5 m nad pomiarem NMPT (`CHURCH_SURFACE`); dawniej proponowana jako `church-default-height` | 9 przed #208, 0 po #208; G-216 |
| `church-part-below-roof` | Kościół z pomiarem NMPT, w którego obrysie ponad 15 % komórek leży co najmniej 2 m nad terenem i ponad 3 m pod okapem gry (niższa część na wysokości nawy); dane z siatki NMPT jak `CHURCH_SURFACE` albo lista udziałów | 5 (szacunek z sondy #208: Świętego Ducha, św. Piotra, Brygidki, Karmelici, św. Mikołaja); G-238 |
| `osm-tower-default-height` | Budynek z OSM z `man_made=tower` albo `tower:type` bez `height` i `building:levels` (wysokość z wartości domyślnej dzielnicy) | 1 (w680377807 dzwonnica św. Mikołaja, G-235; w1382552285 wieża św. Jozafata poprawiona w #207); G-224 |
| `tower-area-missing` | Obrys z OSM `man_made=tower` (zamknięta droga, środek w mapie) bez budynku gry o tym ID, ani własnego, ani części innego | 2 (w1002739983, w1002739984 Pałac Lubomirskich, G-249); 3 przed #216 (G-098); 0 po #220 |
| `measured-over-nmpt` | Budynek albo część z pomiarem NMPT w tabeli jak `CHURCH_SURFACE` (rozszerzonej o budynki niekościelne: Pałac Lubomirskich w67508859 okap 11,0 i wierzch 12,0, wieże w1002739983/4 wierzch 17,9, w232805924 wierzch 4,6, sprostowane z 5,1 przy przeglądzie #224), którego okap albo wierzch w grze odbiega od pomiaru o ponad 1,5 m | 1 (w232805924, G-251); 0 po G-251; T-136, T-137 |
| `tower-roof-ridge` | Część albo budynek z `man_made=tower` lub `tower:type`, z dachem (`roof` > 0) i bez `roofShape`, który renderer rysuje jako czterospadowy z kalenicą, choć NMPT ma jeden wierzchołek | 1 (szacunek: w1090997970 Brygidki, T-060) |
| `steps-narrower-than-walls` | Bieg `highway=steps` między dwoma równoległymi `barrier=wall` (do 15 m od osi po obu stronach), gdy odstęp murków przekracza szerokość pasa `steps` w grze o ponad 1 m. Wymaga murków w wyciągu | 1 (schody zamkowe); G-203 |
| `plan-prop-off-target` | Rekwizyt z wpisu planu z `points` przesunięty przez generator o ponad 4 m od swojego punktu albo na drugą stronę ściany budynku | 2 (reflektory Zamku); G-206 |
| `landmark-missing` | Lista ID z OSM: r7224409, w66286371, w66286341, w66264159, w66264120, w232362876, w66286338, r2366732, w48500136, w450180469, w66258167, w67508958, w66330578. Liczy ID, których nie ma w `MAP_CHUNKS` albo które usuwa `clearedBuilding`. Do tego monumenty Placu Litewskiego (n481952877, n481952879, n481952880) wśród rekwizytów `monument` w promieniu 1 m | 2 (Osterwy, Bernardyni) |
| `landmark-overbuilt` | Budynek z `verticalOf(...).rise > 0` w promieniu 30 m od środka landmarku, którego nazwa pasuje do /brama\|wieża\|trybuna\|katedr\|ratusz\|zamek\|donżon\|kościół\|bazylika\|kaplica/i, i którego `y + height + roof + rise` przekracza szczyt landmarku | 2 (w66293355 przy Bramie Grodzkiej, w66324576 przy Kościele Ewangelicznym). Dla pełnego `isLandmark` baza wynosi 12 (m.in. pałace i urzędy w Krakowskim) |
| `terrain-off-pads` | `\|groundY − rawHeight\| > 0,3 m` na siatce co 5 m poza `PADS` (z `blend`), rampami schodów i pomostami | 0 |
| `terrain-off-dtm` | Test w tools/osm-import, bo potrzebuje `data/terrain`: `\|rawHeight − NMT 1 m\| > 1,0 m` na siatce co 10 m w prostokątach dzielnic | 2 w Krakowskim i na Starym Mieście; reszta miasta niezmierzona |
| `street-attr-mismatch` | Kawałek ulicy, którego nazwa, flaga `oneway` albo kierunek różni się od najbliższej drogi OSM o tej nazwie (≤ 1 m) | 0 |
| `building-cleared-unregistered` | Budynek usuwany przez `clearedBuilding` spoza listy z rejestru topografii | 0 (lista: w672635872, w672635873, w458298766, w1354195809) |
| `building-part-ignored` | Test importu: budynek z `building:part` wyższym od własnej bryły o ponad 3 m. Wymaga zachowania części w ekstrakcie | ≥ 5 w próbce, do ustalenia po ponownym pobraniu |
| `civic-as-residential` | Budynek gry z `use` ∉ {civic, historic, church}. Część A: jego tagi OSM mają `office=government`, `government=*` albo `amenity` ∈ {townhall, courthouse, library, theatre, post_office, arts_centre}. Część B: w obrysie leży punkt `amenity` ∈ {townhall, courthouse, theatre, library, arts_centre}, obrys ma `building` ∈ {yes, public, government, civic}, a adresy punktu i obrysu są zgodne albo któregoś brak (jak G-051). Test importu, bo potrzebuje tagów i punktów z `data/osm` | A 2 (w55897069, w67498728), B 2 (w67508958 Teatr Osterwy, w55897083), razem 4 na efeb31b (G-097, G-120) |
| `part-buried-in-roof` | Część z OSM podniesiona na obrys (`soffit`), której szczyt (ściany i dach) leży poniżej połaci dachu obrysu nad środkiem części; połać liczona jak `addHipRoof` (wcięcie `min(rise/0,84+0,35; 1,15·pole/obwód)`) | 1 (w619138853 na Ratuszu, G-117) |
| `fractional-levels-rounded` | Obrys albo część z ułamkowym `building:levels` bez `height`, w których ściany nad cokołem przekraczają `building:levels × 3,2 m` o ponad 0,5 m | 6 (G-116) |
| `landmark-colour-ignored` | Budynek z `isLandmark` z `roof:colour` albo `building:colour` w OSM, któremu gra rysuje dach albo tynk z innej rodziny kolorów | 25 (G-118) |
| `vehicle-below-surface` | Pojazd z `PARKED_CARS` albo blok sceny ze skórką `car`, `van`, `wreck`: w środku i 4 narożnikach obrysu `groundY + SURFACE_LIFT(nawierzchnia)` wyżej od spodu pojazdu o ponad 0,15 m | 38 z 87 (G-130) |
| `vehicle-on-pavement` | Pojazd jak wyżej z ≥ 1 narożnikiem na `sidewalk`, `footway`, `steps` albo `square` bez `road` i `cobble`, poza listą celowych z rejestru (T-077: wrak (152.6, −51), furgonetka (112, −42)) | 3 bez listy (2 auta z 1/5 narożnika na `footway` przy (922.9, 430.6) i (745.9, 447.7), blok `car` (400.5, −23.5)); 0 po dopisaniu do rejestru albo poprawce |
| `small-freestanding-tall` | Obrys `source: "default"` o polu do `SMALL_ALONE_AREA` = 50 m², bez innego obrysu bliżej niż 1 m, z `levels` > 1 | 2 (G-127; zostają przybudówki z G-134) |
| `landmark-monument-generic` | Pomnik z `LANDMARK_MONUMENTS`, którego rekwizyt `monument` ma kształt ogólny (`figure` albo `abstract`) zamiast własnego | 2 (G-128) |
| `old-town-ring-cuts-block` | Budynek z `addr:street` ∈ {Rynek, Grodzka (na zachód od Bramy Grodzkiej, x < 705), Jezuicka, Złota, Dominikańska, Archidiakońska} ze środkiem poza `OLD_TOWN_RING`; para: `outside-ring-in-old-town` (budynek z adresem Królewskiej, Podwala, Kowalskiej, Lubartowskiej albo Noworybnej, bez `historic=city_gate`, ze środkiem w obrysie) | 22 i 0 (G-271, T-142) |
| `green-wall-plastered` | Budynek albo część z zielonym `building:colour` w OSM (green, darkgreen, #rgb z przewagą G) i zielonym `roof:colour` albo `building:part=tower`, którego kolor ściany (`style.plaster`) leży w paletach tynku (`PLASTER_SWATCHES`); węższy przypadek `landmark-colour-ignored` | 3 (w618268118, w617763432, w619138854; G-272, T-143) |
- Źródło: audyt topografii 1 (kurator, 31.10); `part-buried-in-roof`…`landmark-colour-ignored`: audyt gmachów publicznych (kurator, 31.10); cztery ostatnie: audyt Placu Litewskiego i Pedetu (kurator, 31.10).

### G-055 Liczba wywołań rysowania skacze między klatkami w ustalonym mieście
- Status: zgłoszone (z weryfikacji G-031)
- Ważność: S4 (proponowana) · Koszt: nieznany
- Dowód: w tym samym punkcie (300, −60) przy ustalonym mieście kolejne klatki dają 223 i 163 wywołania. Sprawdzić, skąd różnica (komórki przebudowywane leniwie, glow, cienie), i czy nie zaszumia budżetów w `npr-perf`.
- Pakiet właściciela: packages/engine

### G-060 Części `building:part` niższe od obrysu pomijane przy pokryciu < 75% (Podzamcze)
- Status: zgłoszone (z przeglądu topografii G-049)
- Ważność: S4 (proponowana) · Zasięg: 2 budynki · Koszt: mały
- Gdzie: w1306000298 (650.3, 479.5), w1306000299 (658.8, 503); T-019
- Dowód: części OSM w73833861/65 i w587306232 mają 4 kondygnacje, w73833864 ma 2, a obrysy w grze mają 16 m (pokrycie 43% i 32%). Tagowanie OSM niespójne; możliwe rozwiązanie: rysować części, resztę obrysu zostawić
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: nowa kontrola skanu `building-part-lower-ignored` (okap części > 1 kondygnację niżej od ścian obrysu w jej środku), baza 2 → 0

### G-063 Zadaszenia `building=roof` pominięte (perony dworca, daszki Targu na Ruskiej, studnia)
- Status: zgłoszone (audyt topografii 2)
- Ważność: S3 (proponowana) · Zasięg: 8 w mieście · Koszt: średni
- Gdzie: w458862470 (837, 386), w1547216433/35/36/37 (747..813, 529..577), w828763988 (859, 226), w175886790 (2619, 207), w1382568876 (340, −16); T-025
- Dowód: `SKIP_BUILDING` w `tools/osm-import/src/generate.ts`
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)
- Test przyjęcia: każde z 8 zadaszeń jest daszkiem na słupach, przez który da się przejść; kontrola `osm-roof-skipped` 8 → 0

### G-065 Budynki podpisane nazwą muralu lub tablicy pamiątkowej
- Status: zgłoszone (audyt topografii 2; ta sama przyczyna co G-051, naprawiać razem)
- Ważność: S4 (proponowana) · Zasięg: 13 w mieście · Koszt: mały
- Gdzie (Podzamcze): w73833875 (682.4, 512.6), w1306000299 (658.8, 503), w73833890 (727.5, 532.9), w444375213 (596.4, 445.6); T-027
- Dowód: nazwa z węzłów n9059454201, n8175404403, n13252131249; `labels.ts` traktuje `tourism=artwork` i `historic=memorial` jako „sight”
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `building-named-by-artwork` 13 → 0

### G-066 Nadbudowa na zabytkowej Karczmie „Budzyń”
- Status: zgłoszone (audyt topografii 2)
- Ważność: S4 (proponowana) · Zasięg: 1 · Koszt: mały
- Gdzie: w294483985 (2620.7, 368.2), Nabrzeże; T-029
- Dowód: `verticalOf` daje rise 3, bo `building=house` z `historic=yes` dostaje `use=residential`
- Pakiet właściciela: tools/osm-import (building-tags) albo packages/sim (vertical.ts)
- Test przyjęcia: kontrola `heritage-overbuilt` (budynek z `historic`/`heritage` poza Starym Miastem z rise > 0) daje 0 po G-050 i tej poprawce

### G-069 Postać zespawnowana pod mostem trafia na pomost
- Status: zgłoszone (z weryfikacji G-062)
- Ważność: S4 (proponowana) · Zasięg: pod pomostami · Koszt: mały
- Dowód: `settle`/`clearSpot` (`placement.ts:17`), teleport w `app/debug-api.ts` (l.145), `street-scenes`, `micro-events` i spawn tłumu biorą najwyższy pomost; rekwizyty ulicy też (artwork (745, 166.4), stragan (750.1, 177.7) na pomoście Zamkowej)
- Pakiet właściciela: packages/sim (content, world)
- Test przyjęcia: spawn w punkcie pod pomostem z prześwitem > 2 m stoi na terenie

### G-070 Drzewo i stragan pod wiaduktem Zamkowej wchodzą w pomost
- Status: zgłoszone (z weryfikacji G-062)
- Ważność: S4 (proponowana; widoczne z Podwala po G-062) · Zasięg: lokalny · Koszt: mały
- Gdzie: drzewo pod wiaduktem Zamkowej (koroną przebija pomost), stragan (750.1, 177.7) przy 2,66 m prześwitu
- Pakiet właściciela: tools/osm-import (props) / packages/engine
- Test przyjęcia: żaden rekwizyt pod pomostem nie sięga wyżej niż spód pomostu

### G-071 Kule przelatują przez pomost
- Status: zgłoszone (z weryfikacji G-062)
- Ważność: S3 (proponowana; po G-062 da się stanąć pod mostem i strzelać przez pomost w obie strony) · Koszt: średni
- Dowód: ADR-0053 traktuje pomost jako podłogę dla ruchu, nie jako przesłonę dla strzałów i widoczności
- Pakiet właściciela: packages/sim (walka, linia widzenia)
- Test przyjęcia: strzał z pomostu do celu pod nim (i odwrotnie) trafia w pomost; świadek pod mostem nie widzi gracza na pomoście

### G-072 Walczący na pomoście nie schodzi pod most do gracza stojącego pod nim
- Status: zgłoszone (z naprawy G-068)
- Ważność: S4 (proponowana) · Zasięg: pomosty z przejściem pod spodem · Koszt: średni (nawigacja między poziomami)
- Dowód: po G-062 `heightApart` daje 0 dla gracza pod mostem i walczącego na pomoście nad nim; walczący idzie do punktu nad graczem i stoi tam na pomoście, nie szuka zejścia
- Dodatkowo (weryfikacja G-068): pod wiaduktem Zamkowej zaalarmowany walczący idący Podwalem z lewej strony osi (chunk `stare-miasto-1-1`, 12–20 m od osi) utyka w (749.5–750.6, 180.4–181.4), także przed G-068
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: zaalarmowany walczący na pomoście Mełgiewskiej dociera do gracza pod mostem przez zejście w < 20 s

### G-073 Stare stragany pchlego targu na Placu Zamkowym wchodzą w drzewa i meble uliczne
- Status: zgłoszone (z weryfikacji G-064)
- Ważność: S4 (proponowana) · Zasięg: 8 straganów · Koszt: mały
- Gdzie: Plac Zamkowy, np. (704.9, 266); stragany 0,3–0,8 m od drzew, stojaka na rowery, automatu biletowego i słupa ogłoszeniowego
- Dowód: sonda weryfikatora G-064 na `WORLD_STREET_PROPS`; problem sprzed G-064 (nowe stragany z G-064 nie nachodzą na nic)
- Pakiet właściciela: tools/osm-import (props-gen)
- Test przyjęcia: kontrola skanu „stragan na innym rekwizycie” (odstęp < 0,9 m od drzewa, stojaka, automatu, słupa), baza 8 → 0

### G-078 Brama Zamku z domyślnymi wymiarami przejazdu
- Status: zgłoszone (audyt bram i przejazdów) · Ważność: S4 · Koszt: mały
- Gdzie: brama wjazdowa Zamku, 2,4 × 3,4 m domyślnie; T-040
- Test przyjęcia: wymiar zmierzony ze zdjęcia jako korekta w `corrections.ts` (ADR-0042)
- Pomiar (kurator, 1.11): portal ok. 3,8 × 5,8 m (zdjęcie Commons z wiaduktu Zamkowej, skala z osób, ±0,7 m); plan `docs/plany/zamek-lubelski.md`, etap Z0

### G-079 Wypełnione wirydarze klasztorów Kapucynów i Dominikanów
- Status: zgłoszone (audyt bram i przejazdów) · Ważność: S4 · Koszt: średni (dziury multipoligonów)
- Gdzie: r5420680, r2366732; ścieżki wirydarza i przejście w586408568 w środku bryły; T-042
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: dziedziniec z `inner` multipoligonu jest otwarty i dostępny przejściem z OSM; `runsInside` widzi dziury, więc w586408568 (wirydarz Dominikanów → Zaułek Giedroycia, `tunnel=yes`) dostaje przejście przez r2366732 (uwaga kuratora z przeglądu G-076)
- 13.11 audyt luk SM: ta sama reguła wypełnia 22 inne dziedzińce multipoligonów (ok. 6 450 m²): SM r5420359 420, r3119721 137, r6477272 112, r18246399/400/401 69+67+26, r6477346 63, r7224409 41; Krakowskie r1071052 2 849, r1071050 819, r14476826 638, r1071051 205, r1207679 204, r1207677 155, r5420467 96, r17337408 70, r1156579 31; Podzamcze r6476362 234, r6476361 213. Jedna reguła: inner >= 20 m² otwarty, chyba że NMPT/LoD2 pokazuje dach; ważność do S3. Proponowana kontrola courtyard-filled (baza 24 pierścienie).

### G-080 Dach dwuspadowy i pulpitowy liczony od prostokąta całego obrysu
- Status: zgłoszone (weryfikacja ADR-0064 etap 1, PR #78) · Ważność: S4 · Koszt: średni
- Gdzie: budynki wieloskrzydłowe: Zamek w48500136 (jedna połać nad wszystkimi skrzydłami), w232362886, r18246400
- Pakiet właściciela: packages/engine (`mapcity/roof-shapes.ts`)
- Test przyjęcia: osobna kalenica lub połać na każde skrzydło obrysu wklęsłego

### G-081 Deptaki węższe niż pierzeja: goły teren między pasem bruku a fasadami
- Status: zgłoszone (audyt dróg, T-045)
- Ważność: S3 (proponowana: główna ulica Lublina wygląda jak 8 m chodnik w błocie) · Zasięg: deptaki bez `width`, 59 z 206 przekrojów · Koszt: średni
- Gdzie: Krakowskie Przedmieście w177528393 (266..327, −73..−86), Jezuicka w173565066 (541..619, −120..−135), Grodzka w385706810 (663..679, 82..105)
- Dowód: przekroje co 10 m od osi do fasady: KP 21,2 m między fasadami, 9,6 m bez nawierzchni
- Przyczyna: `lineBands` (`ground.ts`) buforuje `pedestrian` na `width ?? 8`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `pedestrian-bare` 59 → ≤ 10

### G-084 Place bez nazw na mapie miasta
- Status: zgłoszone (audyt dróg) (T-048) · Ważność: S4 · Zasięg: 6 placów · Koszt: mały
- Przyczyna: import zapisuje nazwy tylko z linii; `city-map.ts` podpisuje `streets` i budynki
- Pakiet: tools/osm-import + packages/app (city-map) · Test przyjęcia: `square-name-missing` 6 → 0

### G-085 Ścieżki w remoncie (`highway=construction`) bez nawierzchni
- Status: zgłoszone (audyt dróg) (T-050) · Ważność: S4 · Zasięg: 3 drogi, 316 m · Koszt: mały
- Propozycja: korekta typu na `path` (poprzednia wersja OSM) z odsyłaczem T-050
- Pakiet: tools/osm-import

### G-086 Nawierzchnie: kostka na jezdni jako asfalt, ścieżki gruntowe jako utwardzone
- Status: zgłoszone (audyt dróg) (T-052) · Ważność: S4 · Koszt: średni (kontrakt `GroundSurface` w core, ADR)

### G-091 Długie przytrzymanie „Use” wybiera kwestię pod palcem w kole dialogu
- Status: zgłoszone (z badania G-058; do potwierdzenia na prawdziwym telefonie przez glitch-huntera)
- Ważność: S3 (proponowana; przypadkowy wybór kwestii w rozmowie) · Zasięg: dotyk · Koszt: mały
- Dowód: sonda e2e (`scratchpad/g058-probe.spec.ts`): przytrzymanie „Use” ok. 1,0–1,3 s, aż dialog się otworzy, potem `pointerup` i `click` na `BUTTON.wheel__opt`; dialog idzie dalej. `touchend` trafia w odpięty przycisk pada, więc nie jest anulowany, a osłona z G-048 już wygasła (700 ms). Niepewne, czy prawdziwy telefon wysyła kliknięcie po długim przytrzymaniu (CDP może się różnić)
- Pakiet właściciela: packages/ui (`touch/ghost-click.ts`)
- Test przyjęcia: test komponentu: kliknięcie z dotyku, który zaczął się przed otwarciem koła, nie wybiera kwestii

### G-099 Pas poszerzenia Krakowskiego bez mebli z planu (latarnie, obeliski)
- Status: zgłoszone (z przeglądu kuratora G-052) · Ważność: S3 (proponowana; ciemne ulice nocą) · Zasięg: pas 660 × 70 m · Koszt: mały–średni
- Gdzie: T-061 (Narutowicza, Peowiaków, Zesłańców Sybiru, Bernardyńska; obeliski na Placu Kochanowskiego)
- Przyczyna: plan `docs/world/lublin-props.todo.json` (29.10) ma pozycje tylko w starych prostokątach; reguła `lamps.krakowskie-side` nie obejmuje pasa poniżej −200
- Pakiet właściciela: tools/osm-import (plan mebli)
- Test przyjęcia: kontrola `lit-street-dark` (odcinki nazwanych dróg z `lit=yes` dalej niż 30 m od latarni, w metrach) w pasie 0; obeliski w promieniu 1 m od węzłów OSM. Ostrożnie z ADR-0064 etap 3 (oświetlenie z `lit`), który robi to samo w całym mieście

### G-111 Resztka G-094: krawędzie przedsionka Trasy Podziemnej
- Status: zgłoszone (z weryfikacji G-094) · Ważność: S4 · Zasięg: 1 wejście · Koszt: mały
- Gdzie: `packages/sim/src/content/kanal-underground.ts:113-122`; przy południowej ścianie przedsionka (z −58,0…−57,6) wnętrze zaczyna się 0,81–1,03 m za fasadą, przy północnej 0,06–0,35 m; pokój drzwi wystaje do 0,21 m przed fasadę przy z ≈ −56,5 (z histerezą wnętrze trzyma się do 0,66 m na Rynku)
- Przyczyna: pokój drzwi ma tylko 1 m szerokości, a fasada ma załamanie z minimum 567,21 przy z −57,7; kontrola `interior-entrance-gap` próbkuje tylko oś przejścia, a `interior-outside-building` ma tolerancję 0,3 m
- Pakiet właściciela: packages/sim
- Test przyjęcia: kontrola `interior-entrance-gap` próbkuje całą szerokość przejścia (co 0,25 m) i daje 0; schodkowe pokoje wzdłuż fasady

### G-115 Megawieża Tatar z Nabrzeża: podstawa nad horyzontem
- Status: zgłoszone (z ADR-0063 etap 2; było już przed nim) · Ważność: S4 · Koszt: mały
- Gdzie: panorama (ADR-0051), wieża Tatary (1900, 1500) widziana z Nabrzeża; T-056
- Pakiet właściciela: packages/engine (mapcity/skyline)
- Test przyjęcia: podstawa wieży poniżej linii terenu panoramy z każdego punktu Nabrzeża

### G-117 Dach całego obrysu przykrywa wyższą część z OSM (ryzalit Ratusza)
- Status: zgłoszone (audyt gmachów publicznych, kurator 31.10)
- Ważność: S3 (proponowana; Ratusz z Placu Łokietka) · Zasięg: 1 w mieście (Ratusz); części kościoła Dominikanów przykryte ścianami, ale ich dachy wychodzą ponad połać · Koszt: średni
- Gdzie: ryzalit w619138853 (414.8, −79.4) na Ratuszu w66264120; T-065
- Dowód: dach czterospadowy z `addHipRoof` nad całym obrysem od y 17,1 do 24,0; nad środkiem ryzalitu 22,6, a szczyt ryzalitu 20,3 (bez dachu). Widać tylko pas 1,6 m przy okapie
- Przyczyna: `stackParts` stawia część z OSM na bryle (`soffit` = ściany obrysu), a renderer kryje dachem cały obrys, także pod częściami wyższymi od niego
- Pakiet właściciela: packages/engine (mapcity/roof-plan) albo przepis zabytku ADR-0062 etap 4
- Test przyjęcia: połać obrysu nie wchodzi nad obrys części, która jest wyższa od ścian obrysu i dochodzi do jego krawędzi (dach kończy się na ścianach ryzalitu); kontrola `part-buried-in-roof` 1 → 0

### G-118 Kolory z OSM (`building:colour`, `roof:colour`) pomijane na zabytkach
- Status: zgłoszone (audyt gmachów publicznych, kurator 31.10)
- Ważność: S4 (proponowana) · Zasięg: 25 budynków gry z kolorami w OSM, wszystkie to zabytki albo ich części · Koszt: średni
- Gdzie: Ratusz (żółty tynk, czerwony dach, zielona wieża) i Trybunał (beżowy, zielony dach blaszany) jako szare tynki i grafitowe dachy; T-066
- Dowód: `facade-style.ts`: dla `civic` tynk z `CIVIC_PLASTER` i dach zawsze z `ROOFS_METAL`; import nie przenosi tagów koloru do `LublinBuildingData`
- Pakiet właściciela: tools/osm-import (pole koloru w widoku) i packages/engine (mapcity/facade-style); kontrakt widoku `building`, więc dopisek do ADR-0064
- Test przyjęcia: zabytek z `roof:colour=green|red` dostaje dach z odpowiedniej rodziny palety (miedź, dachówka), a z `building:colour` najbliższy tynk palety; kontrola `landmark-colour-ignored` 25 → 0

### G-119 Ratusz i Trybunał bez przepisu zabytku (fasada jak każdy gmach)
- Status: zgłoszone (audyt gmachów publicznych, kurator 31.10); to praca ADR-0062 etap 4
- Ważność: S3 (proponowana; dwa główne punkty orientacyjne, zgłoszenie użytkownika „trzeba poprawić urząd miasta”) · Zasięg: szeroki (Plac Łokietka, Rynek) · Koszt: duży
- Gdzie: Ratusz w66264120 z częściami w619138853 i w619138854; Trybunał w66264159; T-064, T-065, T-067
- Dowód: zrzuty `ratusz-s`, `ratusz-wide`, `ratusz-ne` i `trybunal-wide` (scratchpad kuratora): Ratusz wygląda jak biurowiec z siatką 5 rzędów okien i bez wejścia, a jego wieża jest grafitowym słupkiem nad połacią
- Przyczyna: brak przepisu w `landmarks/recipes.ts`; plan fasad dla `civic` (ADR-0051)
- Pakiet właściciela: packages/engine (mapcity/landmarks)
- Test przyjęcia: przepis Ratusza: ryzalit w osi fasady południowej z wejściem głównym, wieża z OSM z tarczą zegara (do potwierdzenia zdjęciem), kondygnacje w rytmie fasady klasycystycznej, kolory z T-066, warstwa 2077 bez nadbudowy (podpis, światło na gzymsach). Przepis Trybunału: wieżyczka zegarowa na kalenicy, jeśli potwierdzi ją zdjęcie. Przegląd kuratora ze zdjęciem; migawka NPR obejrzana

### G-121 Poczta Główna jako sklep z nadbudową
- Status: zgłoszone (audyt gmachów publicznych, kurator 31.10); przed poprawką trzeba potwierdzić budynek zdjęciem albo w rejestrze NID
- Ważność: S4 (proponowana) · Zasięg: 1 · Koszt: mały
- Gdzie: w69672579 (−45, −75), Krakowskie Przedmieście 50; punkt `amenity=post_office` „Poczta Główna” n2526835832; T-070
- Dowód: OSM `building=retail`, `building:levels=5`, więc w grze `commercial` z witrynami, nadbudową +6 m i bez nazwy
- Pakiet właściciela: tools/osm-import (`corrections.ts` z wpisem T-070, albo poprawka w OSM)
- Test przyjęcia: po potwierdzeniu `use=civic` z nazwą „Poczta Główna” i bez nadbudowy

### G-122 Gmachy publiczne z domyślną wysokością i płaskim dachem
- Status: później (czeka na ADR-0064 etap 11 (LOD2) albo 14 (NMPT); bez danych poprawka byłaby zgadywaniem)
- Ważność: S4 · Zasięg: 7 (Sąd Okręgowy, Collegium Maximum, Collegium Medicum, Świętoduska 3, Peowiaków 13 ×2, Teatr Osterwy) · Koszt: średni
- Gdzie: T-071
- Dowód: `source: "default"` albo brak `roof:shape` przy `use=civic`: 4 kondygnacje i dach płaski
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: wysokość z LOD2 albo NMPT (mediana w obrysie) i dach z LOD2; rozbieżność > 20% z OSM do przeglądu kuratora

### G-126 Pedet z domyślną wysokością `commercial` i fasadą kamienicy
- Status: zgłoszone (12.11, przejście krakowskie-1-0: wysokość naprawiona w #429: 19,8 m, 4 kondygnacje, `source: lod1`, LoD2 okap 20,7, kalenica główna 21,4; zostaje fasada `shop=mall`). Zgłoszenie użytkownika 31.10: „brakuje rozbudowania galerii Pedet”
- Ważność: S3 (proponowana; punkt orientacyjny Krakowskiego z podpisem) · Zasięg: 1 (zasada dotyczy też innych `building=retail` bez `building:levels`) · Koszt: mały (wysokość), średni (fasada domu towarowego)
- Gdzie: w67508935 (124.1, −128.1), Krakowskie Przedmieście 40; T-073
- Dowód: OSM `building=retail`, `shop=mall`, bez `building:levels`, `height` i `building:part`. W grze `levels: 3`, `source: "default"`, ściany 10,4 m nad najwyższym terenem; zrzuty `pedet-ne.png`, `pedet-east.png`, `pedet-north.png`, `pedet-sw.png` (scratchpad kuratora) pokazują trzykondygnacyjną fasadę kamienicy z siatką okien, bez witryn
- Przyczyna: `defaultLevels` w `tools/osm-import/src/building-tags.ts` daje każdemu `commercial` 3 kondygnacje, a renderer rysuje go jak kamienicę z witryną
- Pakiet właściciela: tools/osm-import (wysokość: `corrections.ts` z wpisem T-073 albo dane LOD2/NMPT); packages/engine/src/renderer/mapcity (fasada `shop=mall`/`department_store`: pasy witryn i pełne ściany pięter handlowych zamiast okien mieszkań)
- Test przyjęcia: `shop=mall` dostaje fasadę handlową (test planu fasady w engine); baza `landmark-overbuilt` bez wzrostu

### G-128 Pomniki Placu Litewskiego jako ta sama stojąca postać (Piłsudski bez konia)
- Status: zgłoszone (audyt Placu Litewskiego, kurator 31.10). Zgłoszenie użytkownika: „brakuje pomnika Józefa Piłsudskiego”
- Ważność: S3 (proponowana; zabytek z listy kuratora nie do rozpoznania) · Zasięg: 2 z 3 pomników `LANDMARK_MONUMENTS` (Piłsudski n481952877, 3 Maja n481952880); Unia n481952879 ma własny obelisk · Koszt: średni (model konny), mały (blok 3 Maja)
- Gdzie: (−45.8, −13.3) i (−87.1, −22.6); T-075; zrzuty `pilsudski.png`, `pilsudski-diag.png`
- Dowód: `shapeOf` w `tools/osm-import/src/props-gen.ts` daje każdemu `monument` poza obeliskiem i koziołkiem kształt 1 (`figure`): cokół 1,8 m i postać ok. 2,1 m, razem ok. 3,9 m. `landmark-missing` liczy tylko obecność rekwizytu, więc daje 0
- Pakiet właściciela: packages/engine/src/renderer/mapcity (`prop-civic.ts`: kształty `equestrian` i `constitution`); tools/osm-import (`shapeOf` po ID planu); packages/sim (`furniture.ts`: kolizja cokołu nowego kształtu)
- Test przyjęcia: n481952877 rysowany jako pomnik konny ok. 7,3 m (cokół ok. 3 m, koń z jeźdźcem ok. 4,3 m) w brązie, warstwa 2077 według planu (neonowy kontur, graffiti AR na cokole); 3 Maja jako blok z orłem; kontrola `landmark-monument-generic` 2 → 0; budżet wywołań rysowania bez wzrostu (kształt w siatce mebli bloku)

### G-129 Fontanna multimedialna na Placu Litewskim bez strumieni, czaszy i pokazu
- Status: zgłoszone (audyt Placu Litewskiego, kurator 31.10). Prośba użytkownika: „fontanna na Litewskim powinna być spektakularna”
- Ważność: S3 (proponowana; najważniejsza atrakcja placu) · Zasięg: 1 (zasada dotyczy też kaskady w503047622 i fontanny z wieżą ciśnień w256406832) · Koszt: średni; 12.11 (kurator, przegląd paczki, T-281): woda w niecce płytka i przejrzysta, dno jasne (granit). Test przyjęcia: w dzień niecka ma jasność ≥ 0,7 jasności kostki placu; kaskada w503047622 schodkowa z jasnego kamienia.
- Gdzie: w503047621 (x −35..−4.7, z 18.9..56.6); T-076; zrzuty `fountain.png`, `fountain-wide.png`
- Dowód: 16 dysz `fountain-jets` (`JETS["fountain-multimedia"] = 16` w `props-gen.ts`), każda to rurka 1 m z kulką (`fountainJets` w `prop-civic.ts`); woda w niecce płaska, bez czaszy w środku, balustrady i stopni-siedzisk
- Propozycja (NPR, 2077, bez nowych siatek): (1) dysze w siatce mebli bloku jako 3 pierścienie po obrysie (np. 48 + 32 + 16) i pióropusz w środku; strumienie to pionowe wstęgi z przecięciem w kształcie krzyża (2 quady, bez przezroczystości sortowanej), wysokości 1–4 m, w środku 8–12 m; (2) czasza z balustradą i drewniane stopnie z obrysu w siatce terenu, jak obrzeże `planBasin`; (3) poświata w siatce halo miasta (już jedna): kolory strumieni z palety neonu ADR-0051 (cyjan, magenta, bursztyn), nocą mocniejsze; (4) pokaz: wieczorem (21:00, w grze codziennie albo w piątki i soboty z `ClockPort`) wysokość i kolor z fazy w atrybucie wierzchołka, czytany przez istniejący materiał w shaderze; bez animacji CPU na wierzchołkach; (5) mgła z dysz jako istniejące cząsteczki pary (`STEAM_VENTS`), do 2 źródeł. Holo nad strumieniami (ADR-0051) opcjonalnie, w warstwie reklam
- Pakiet właściciela: packages/engine/src/renderer/mapcity (`prop-civic.ts`, `ground-plan.ts`); tools/osm-import (`props-gen.ts`: liczba i układ dysz z obrysu)
- Test przyjęcia: test planu: fontanna multimedialna ma ≥ 96 strumieni i czaszę w środku obrysu; `npr-perf` krakowskie-tpp bez wzrostu wywołań rysowania i aktywnych siatek (dziś 386 / 164); zrzut nocny z pokazem obejrzany przez kuratora

### G-134 Budynek z sąsiadem spoza chunków stoi w grze samotnie, a ścieżki kondygnacji zaokrąglają różnie
- Status: częściowo naprawione (#105: przecinek dziesiętny i zaokrąglenie w ścieżce z wysokością); przybudówki bez głównego budynku otwarte
- Ważność: S4 · Zasięg: w231832052 (Podwale 3, 14,8 m) i w231372264 (DPS „Kalina”, 13 m) jako samotne wysokie bloki; ułamkowe kondygnacje w ścieżce `heights`/`partTier`
- Gdzie: `tools/osm-import/src/generate.ts` (budynek trafia do chunka po środku obrysu, sąsiad ze środkiem poza chunkami nie trafia wcale); `parseLevels` dzieli po przecinku („4,5” daje 5, dziś brak w danych); ścieżka z wysokością przepuszcza ułamkowe `levels`, które renderer zaokrągla w górę, a ścieżka kondygnacji po G-116 w dół
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: spójne zaokrąglenie w obu ścieżkach z testem; budynki główne w66293125 (Podwale 3) i w171014956 (DPS „Kalina”) w grze albo przybudówki wycięte (T-080); proponowana kontrola `building-neighbour-missing` (obrys dzieli węzeł OSM z budynkiem nieobecnym w grze), baza ≥ 2

### G-137 Brama Grodzka bez attyki z wazami od strony Grodzkiej
- Status: odłożone (1.11, decyzja orkiestratora: sylwetka poza dachem z OSM wymaga wyjątku od ADR-0062; T-083)
- Ważność: S4 · Koszt: średni (nowy element zestawu poza bryłą)
- Pakiet właściciela: packages/engine (renderer, przepisy zabytków)

### G-142 Atlas nazw budynków: 32 wiersze na 118 nazw, część tabliczek pusta
- Status: zgłoszone (1.11, weryfikator ADR-0062 etap 2; etap w main, #109)
- Ważność: S3 · Zasięg: 121 nazwanych budynków (118 różnych nazw), 32 wiersze `NAME_SLOTS` bez zwalniania (29 po rezerwacji napisów zabytków); które tabliczki wyjdą puste, zależy od kolejności wczytywania komórek
- Gdzie: `packages/engine/src/renderer/mapcity/map-signs.ts` (`planBuildingSigns`, `slotFor`)
- Pakiet właściciela: packages/engine (renderer)
- Poprawka do wyboru: większy atlas, zwalnianie wierszy przy wyładowaniu komórki albo atlas na chunk; budżet tekstur na telefonie
- Test przyjęcia: wszystkie nazwy z wczytanych komórek mają wiersz; test ładowania w różnej kolejności

### G-144 Szczeliny w asfalcie na styku dróg OSM na załamaniu
- Status: zgłoszone (1.11, naprawiacz G-138)
- Ważność: S4 · Zasięg: ok. 20 miejsc pod pasami ruchu poza Aleją Tysiąclecia, szczeliny 0,1–0,25 m (np. Mełgiewska 2370,285; Turystyczna 2526,357 i 2606,332); nabrzeze-1-1 (12.11): `lane-off-ground` Turystyczna#122:0 (2526; 357), miejsce wymienione w G-144; skan wciąż je liczy.
- Przyczyna: bufory dróg w `tools/osm-import/src/ground.ts` (`bufferLine`) mają ścięte końce, a do tego `simplifyRing` 0,3 i zaokrąglenie do 0,1
- Poprawka: zaokrąglone albo zachodzące końce buforów na styku dróg; tabele przez `osm:build`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: punkty pasów co 0,1 m bez nawierzchni → 0 poza zawracaniem na Alei Tysiąclecia; `lane-off-ground` 9 → 8
- Uwaga weryfikatora G-138: `lane-off-ground` próbkuje co 1 m, więc wynik zależy od przesunięcia próbek (7–12 przy tej samej geometrii); Mełgiewska 2370,285 i Turystyczna 2606,332 wypadły z bazy tylko przez przesunięcie. Przy poprawce próbkować co 0,1 m i liczyć skupiska; co 0,1 m jest 29 skupisk, ok. 21 poza Aleją Tysiąclecia
- Poboczne: `groundY` daje 0 poza mapą, a `GroundField` grunt najbliższego chunka; pasy już tam nie wychodzą, inni użytkownicy obu funkcji mogą trafić na rozbieżność

### G-147 Stopy bliskich megawież po impostorze bliżej niż płaszczyzna panoramy
- Status: zgłoszone (1.11, weryfikator ADR-0067); dziś niewidoczne
- Ważność: S4 · Zasięg: wieże `near` w ok. 31% par „kamera w chunku – wieża”, np. z Krakowskiego (90, −200) ku wieży (−513, −204)
- Przyczyna: skala impostora do szczytu wieży (ADR-0067) przesuwa stopy bliskich wysokich wież z 288 m na 217–260 m od kamery, w pas, w którym stoją jeszcze budynki miasta (do `maxZ` 320 m); możliwa odwrócona głębia wobec zabudowy
- Dowód: sonda weryfikatora (`scratchpad/v-mega-sonda2.json`), zrzuty A/B stara/nowa formuła bez widocznej różnicy poza światłami i deszczem
- Poprawka: test, że żaden fragment wieży nie wypada bliżej niż skorupa przy danych miasta w kierunku kamery, albo osobna skala dla stopy; przy okazji kontrole `megablock-*` przenieść do `tools/glitch-scan` z bazą w `glitch-baseline.json` (dziś w teście engine)
- Pakiet właściciela: packages/engine (renderer), tools/glitch-scan

### G-150 Źle położone dachy (zgłoszenie gracza niepotwierdzone)
- Status: zgłoszone, niepotwierdzone (1.11, łowca): z kadru gracza 922af477 nie da się wskazać usterki; potrzebne miejsce albo nowy zrzut
- Ważność: S4 dla znalezionych kandydatów · Zasięg: rzadki
- Kandydaci: 10 dachów niekościelnych ponad 0,7 m poza obrysem (Hotel Hostel Królewska (517,0; −144,8) 1,05 m, nr 487 mansarda (720,6; 300,8) 0,91 m, (451,3; −20,6) 0,84 m, Teatr NN (724,1; 145,2) i inne); okapy w bryle wyższego sąsiada: G-162
- Przyczyna (przypuszczalna): `offsetRing(ring, 0.35)` w `roof-plan.ts` i `roof-shapes.ts` daje mitrę bez ograniczenia przy ostrych kątach
- Kontrola skanu: `roof-out-of-outline` (bez kościołów), baza 10
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-154 Nieoznakowane przejścia nie chronią przed parkowaniem
- Status: zgłoszone (1.11, weryfikator G-143); dziś bez auta przy takim przejściu
- Ważność: S4 · Zasięg: 88 `footway=crossing` i 17 `path=crossing` bez zebry
- Poprawka: odstęp zaparkowanych aut od przejść bez zebry jak od zebr; kontrola skanu
- Pakiet właściciela: packages/sim (parked-cars), tools/osm-import

### G-161 Markiza zasłania dolny rząd liter tablicy lokalu
- Status: zgłoszone (1.11, łowca G-148)
- Ważność: S4 · Zasięg: zależny od kadru; np. STAJNIA SMAKU (489,2; −76,3), zrzut g148-k-stajnia
- Przyczyna: góra markizy 0,08 m (`AWNING_GAP`) pod tablicą przy wysięgu 1,0 m; z oczu gracza bliżej niż ok. 10 m zasłania litery
- Pakiet właściciela: packages/engine (facade-props.ts)

### G-162 Okapy dachów w bryłach wyższych sąsiadów
- Status: zgłoszone (1.11, łowca G-150)
- Ważność: S4 · Zasięg: 50 z 112 dachów niepłaskich, np. Zamek (945,9; 209,6), Brama Rybna (569,5; −12,6), Hotel Avatary Miasta (551,2; −36,8); w większości ukryte w murze
- Przyczyna: stały `EAVES = 0.35` bez sprawdzenia ściany wspólnej
- Pakiet właściciela: packages/engine (roof-plan.ts, roof-shapes.ts); „później” dopuszczalne po ocenie kuratora

### G-163 Hydrant magentowy zamiast czerwonego (brak czerwieni w palecie)
- Status: zgłoszone (1.11, weryfikator #124)
- Ważność: S4 · Zasięg: 6 hydrantów nadziemnych (`st-hydrant`)
- Przyczyna: paleta modeli ulicznych nie ma czerwieni; najbliższa próbka `fabric-magenta` #8e2457 w dzień wygląda różowo
- Poprawka: próbka czerwieni w palecie i przepieczenie plików modeli ulicznych (osobny PR, budżet rozmiaru GLB)
- Pakiet właściciela: packages/engine (paleta), tools (wypiek)

### G-166 Sztukmistrz na linie nad Grodzką
- Status: zgłoszone (1.11, kurator przy G-149)
- Ważność: S3 · Zasięg: Grodzka (617.1, 25.8), n7168903380; plan ulic P1 („model do zrobienia + lina”)
- Stan: od #132 pominięty (`SKIPPED_ART.rope`), wcześniej postać na cokole w uliczce
- Poprawka: figura linoskoczka na linie ok. 6–8 m nad ulicą między w66293391/w66293395 a Warsztatami Kultury r3119721, bez kolizji z graczem; T-096
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import

### G-167 Wolnostojące pomniki z grup `plaque` pominięte
- Status: zgłoszone (1.11, kurator przy G-149)
- Ważność: S3 · Zasięg: Pomnik Ofiar Getta (66.7, 129.6), stela Popiełuszki (475.3, −195.4), kamienie Maharszal (870.5, 298.8), Hołodomor (1044.8, 423.9), Glatsztejn (996.6, 283.0)
- Przyczyna: grupa `plaque` pomijana w całości (`SKIPPED.plaque`), choć `artShape` daje im stelę, a tablice odrzuca
- Poprawka: `kind=plaque` przez `artShape`; kontrola skanu `memorial-freestanding-missing` (baza ok. 12, w tym 5 w pasie z < −200 z G-099, św. Józef n10803415137, wodopój n4348652375); T-100
- Pakiet właściciela: tools/osm-import

### G-168 Neon „Przypadek? Nie sądzę!” niewidoczny
- Status: zgłoszone (1.11, kurator przy G-149)
- Ważność: S4 · Zasięg: Stare Miasto (485.6, 11.4), n9382021599
- Przyczyna: `SKIPPED_ART.neon` podaje, że wisi z szyldami fasad (ADR-0044), ale wśród szyldów go nie ma; jest tylko etykieta `sight`
- Poprawka: dodać do szyldów fasad albo poprawić powód; T-099
- Pakiet właściciela: tools/osm-import, packages/engine

### G-169 Kontenery w środku Giełdy na Kresowej rozbijają rzędy straganów
- Status: zgłoszone (1.11, kurator #124, rekomendacja nieblokująca)
- Ważność: S4 · Zasięg: 3 z 6 kontenerów w środku placu, 9,5–14,8 m od krawędzi: (2331.5, 228.5), (2320.5, 240.5), (2332.5, 245.5); zachodnia część placu w odłamkach po 1–3 stragany; straganów 158 zamiast 180
- Poprawka: kontenery przy skraju obrysu, przed straganami; wolne miejsca kuratora: (2302.5, 248.5), (2313.5, 255.5), (2340.5, 211.5), (2357.5, 255.5), (2319.5, 252.5), (2327.5, 252.5); wtedy 178 straganów (sonda `scratchpad/topo-r3/topo-alt.ts`)
- Pakiet właściciela: tools/osm-import (props-bulky)

### G-172 Etykieta poziomu na slocie może być nieaktualna po zapisie z innej karty
- Status: zgłoszone (1.11, weryfikator ADR-0066 etap 2)
- Ważność: S4 · Zasięg: `SlotDifficulties` (`packages/app/src/presenters/difficulty.ts:41`) rozpoznaje slot po dacie z dokładnością do minuty; `refreshSlots` dekoduje nieznane sloty dwa razy
- Poprawka: profil w `SaveSlotInfo` (zmiana portu `core/src/ports`, zgoda architekta) zamiast drugiego odczytu
- Pakiet właściciela: packages/core (ports), packages/app

### G-175 Odstęp zaparkowanego auta od pasa ruchu liczony od środka, nie od narożnika
- Status: zgłoszone (1.11, weryfikator #143); było przed #143
- Ważność: S4 · Zasięg: `fits` (`tools/osm-import/src/parked-cars.ts`) mierzy `LANE_CLEAR` 1,4 m od środka auta; narożnik auta przy Placu Zamkowym (739; 233,2) 0,92 m od osi pasa, auto na pasie postojowym Ruskiej (963,5; 472,1) 1,30 m; jadące auto ma 0,27–0,43 m luzu
- Poprawka: odstęp od narożników prostokąta auta; kontrola skanu z bazą
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-181 Drobne pola sesji po wczytaniu
- Status: zgłoszone (1.11, weryfikator #145)
- Ważność: S4 · Zasięg: (a) wczytanie w metrze gubi ofertę fixera po przyjeździe (seed 2, `met_genzo`, jazda shinsekai → doki, zapis w trakcie; oryginał dostaje `phone_genzo_offer` w kroku 658, wczytana gra nie, `watch.district` null); (b) histereza wnętrza w progu (`INTERIOR_KEEP`) nie jest odtwarzana, `interiorAt` w `session-resume.ts:23` liczy bez poprzedniego wnętrza, więc wczytanie 0,1 m za ścianą kliniki daje fałszywe `InteriorEntered`; (c) `session.lastThreat` poza zapisem (regeneracja RAM w walce), rozjazdu nie zmierzono
- Pakiet właściciela: packages/sim

### G-186 Obserwator `onReadyObservable` przybywa przy każdej nowej grze (do sprawdzenia w przeglądarce)
- Status: zgłoszone (1.11, autor i weryfikator #151); możliwy artefakt NullEngine
- Ważność: S4 · Zasięg: na NullEngine `scene.onReadyObservable` rośnie o 1 na każde newGame (9 → 13 w 5 cyklach); źródło prawdopodobnie `scene.whenReadyAsync(true)` w `packages/engine/src/renderer/start-prep.ts:181`, które na NullEngine się nie rozwiązuje
- Weryfikator #171: liczba obserwatorów waha się między przebiegami tego samego kodu (0 albo 1 w fazach `city` i `prepared`), więc sondy sesji powinny ją pomijać albo czekać na `isReady`
- Poprawka: sprawdzić w przeglądarce (nowa gra przed gotowością sceny); jeśli rośnie, anulowanie oczekiwania przy `cancelPrepare`/clear
- Pakiet właściciela: packages/engine (renderer)

### G-190 Puste pasy postojowe OSM
- Status: częściowo naprawione: skan w main (1.11, #169: `kerb-strip-no-car-street` baza 3, `bay-strip-empty-known` baza 4, `bay-strip-sparse` 0); zostaje poprawka generatora: łatka zatok przy ulicach dostaw (`docs/plany/g190-zatoki-przy-ulicach-dostaw.patch`) razem z G-133; Łęczyńska w1159135271 (OSM `capacity=23`, w grze 0: obrys płytszy niż auto w poprzek) do decyzji, np. nadwozie nad krawężnikiem
- Ważność: S4 · Zasięg: w232362980 (Kowalska, lane, 2,2 m: spadek, nawierzchnia, wyjście poza obrys), w232362991 (Kowalska, diagonal, 3,4–3,9 m: za płytki na skos z tagu, 8 z 12 zatok bez modelu), w356947938 (najbliższa droga z ruchem 75 m dalej), w1159135271 (Łęczyńska, perpendicular, 3,4 m: za płytki na układ prostopadły), w1514058885 (Świętoduska, parallel, 2,45 m: 18 zatok na spadku, G-133); krakowskie-2-1 (12.11): `bay-strip-empty-known` w1514058885 Świętoduska (375; 2): pas postojowy bez aut na spadku ponad LEVEL_DROP (G-133).; stare-miasto-0-1 (12.11): `kerb-strip-no-car-street` 2 trafienia: parking w232362978 (572; 155) 54,5 m i w895572841 (556; 74) 23,5 m, oba przy ulicy dla dostaw bez aut; ta sama klasa co T-107.; podzamcze-0-0 (12.11): `bay-strip-empty-known` w232362991 Kowalska (536; 175): skos 3,4..3,9 m za płytki na auta pod 60° (G-133); ten sam pas, który wpis już wymienia.; podzamcze-2-1 (12.11): `bay-strip-empty-known` w1517184173 Ruska, północny krawężnik (950; 466): wszystkie zatoki na spadku > `LEVEL_DROP` (G-133); ten sam pas, który G-133 już wymienia.; nabrzeze-1-0 (12.11): `bay-strip-empty-known` w1159135271 Łęczyńska (2649; 76), pas prostopadły 3,4 m za płytki dla auta; znane.
- Poprawka: płytki pas z tagiem `diagonal`/`perpendicular` → mniejszy kąt albo krótszy model; spadek przez G-133 (pochylenie aut); `bay-strip-sparse` dziś pomija pasy bez auta
- Kurator #162: także odcinek Kowalskiej w232362980 x 644..668 bez zatok, bo ulica ma `use: deliveries`, a `bayCars` bierze tylko `CAR_STREETS` (T-107); zatoka w1544340690 s=24,8 (689,2; 171,8) odrzucona przez odstęp od chodnika w173566578, a na ortofoto stoi tam auto. Proponowane kontrole: `kerb-strip-no-car-street` (baza ≥ 1) i `bay-strip-sparse` także dla pasów bez aut (baza ≥ 5)
- Pakiet właściciela: packages/sim (kerb-bays), tools/glitch-scan

### G-191 Gzymsy wystają poza obrys OSM i przycinają płaskie płyty znaków
- Status: zgłoszone (1.11, autor G-160)
- Ważność: S4 · Zasięg: gzymsy w mapcity sięgają poza obrys budynku z OSM; płaska płyta (neon, szyld) na ich wysokości wchodzi w gzyms (tak był ucięty róg SAKE przed runda 2 G-160); kontrole oparte na `inBuilding` i obrysie tego nie widzą, a przy lokalach (`ROOM_SITES`, wycięta kondygnacja) dają fałszywe trafienia
- Poprawka: kontrola skanu „płyta znaku w bryle gzymsu” (geometria gzymsu z planu fasady); kontrole na obrysie uwzględniają fronty lokali
- Pakiet właściciela: tools/glitch-scan, packages/engine (mapcity)

### G-196 Ciała i powaleni posiłkowie ochrony zostają do końca sesji
- Status: częściowo naprawione w #174 (1.11, PRZYJĘTE): powalony żywy posiłek nie znika już po końcu heatu i nie zajmuje limitu; zostaje otwarte: ciała i powaleni posiłkowie nie mają chunku, leżą do końca sesji, a `sent` rośnie w kolejnych heatach
- Ważność: S4 · Zasięg: powalony, ale żywy posiłek ma AI; po końcu heatu, gdy jest daleko i poza wzrokiem, `runReinforcements` (`packages/sim/src/systems/crime-system.ts`) usuwa go jak żywego, więc ciało znika ze świata bez zapisu; do tego ciała posiłków nie mają chunku i zostają do końca sesji, a `sent` rośnie w kolejnych heatach (wpływ na wybór enforcerów od `n`)
- Poprawka: odsyłanie tylko posiłków na nogach; powaleni zostają jak ciała; ciała posiłków sprzątane razem z chunkiem, w którym leżą; test jednej sesji
- Pakiet właściciela: packages/sim

### G-198 Wejście OSM bez drzwi, a drzwi zastępcze na innej ścianie
- Status: zgłoszone (1.11, kurator #167, T-111)
- Ważność: S4 · Zasięg: wejście główne n12776690896 (−143,1; 32,2): brak gniazda drzwi w promieniu 1,5 m, reguła zastępcza stawia drzwi klatki 16 m dalej na innej ścianie
- Poprawka: budynek z wejściem OSM przy rysowanej ścianie dostaje drzwi w najbliższym gnieździe tej ściany albo żadnych zastępczych; kontrola `entrance-door-elsewhere` (baza dziś 1) → 0. Przy okazji do rozważenia: wybór ściany drzwi klatki wg `addr:street` (40 ze 179 drzwi patrzy na inną ulicę niż adres, np. Pałac Lubomirskich (60,4; 99,3) od Radziwiłłowskiej) i kontrola `door-on-osm-passage` (drzwi do 3 m od osi `tunnel=building_passage`/`covered=yes`, baza 1: Niecała 4, T-109)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-205 Dolne kandelabry schodów zamkowych stoją na skarpie zamiast na murkach u stóp schodów
- Status: zgłoszone (1.11, audyt zespołu zamkowego, T-115)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (770,9; 224,3), (773,6; 211,8), (775,3; 233,4), (780,3; 225,3), (784,7; 234,4); wpis planu `zamek.stairs-lamps`
- Po #194 (T-115, T-127): (826,2; 235,8) stoi 1 m w głąb pasa biegu 5 w1306105687, na stopniach; (792,0; 248,5) i (796,4; 237,2) 0,55–0,85 m za osią murków biegu głównego, na trawie zbocza (latarnie na balustradzie dopiero w Z4). Test przyjęcia rozszerzony: żaden kandelabr nie stoi na pasie `steps`
- Przyczyna: wpis planu ma jedną linię od schodów w65351905 do biegu głównego i 16 sztuk rozłożonych wzdłuż niej
- Poprawka: dwa wpisy: 10 pojedynczych przy balustradach biegu głównego i 6 podwójnych na murkach po obu stronach stóp schodów (ok. x 762..768, z 233..252)
- Pakiet właściciela: tools/osm-import (`docs/world/lublin-props.todo.json`)
- Test przyjęcia: żaden kandelabr schodów nie stoi dalej niż 6 m od biegu albo murka

### G-206 Reflektory fasady zachodniej Zamku świecą na dziedziniec
- Status: zgłoszone (1.11, audyt zespołu zamkowego, T-116)
- Ważność: S4 · Zasięg: lokalny (nocny widok z placu) · Koszt: mały
- Gdzie: (850,3; 222), (852,5; 240); plan `zamek.floodlights` (x 846 w bryle)
- Przyczyna: punkty planu leżą w obrysie Zamku, a generator przenosi je na najbliższy wolny grunt, tu za ścianą
- Poprawka: punkty planu na przedpolu bramy (x ok. 828..834); w generatorze nie przenosić rekwizytu przez ścianę budynku
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `plan-prop-off-target` (baza 2) → 0

### G-207 Skarpy Wzgórza Zamkowego prawie bez drzew
- Status: zgłoszone (1.11, audyt zespołu zamkowego, T-117)
- Ważność: S3 (proponowana) · Zasięg: lokalny (tło Zamku z placu, alei i Błoni) · Koszt: średni
- Gdzie: skarpa północna x 840..1010, z 255..300 (2 drzewa), południowa x 830..1010, z 140..200 (0)
- Dowód: ortofoto PZGiK: gęsty drzewostan; drzewa w grze tylko z węzłów OSM `natural=tree`
- Poprawka: reguła drzew na zboczach w zieleni (`leisure=park`, `landuse=grass`) z gęstością z ortofoto, poza ścieżkami, schodami, klifami i osią widokową schodów
- Pakiet właściciela: tools/osm-import (rekwizyty)
- Test przyjęcia: ≥ 1 drzewo na 150 m² zbocza obu skarp, 0 drzew na ścieżkach i schodach

### G-214 Kościół Bernardynów bez swojej wieży i sygnaturki, za wysoka nawa
- Status: zgłoszone (2.11, kurator, przegląd #190)
- Ważność: S3 (proponowana) · Zasięg: lokalny (Bernardyńska, widok z Krakowskiego Przedmieścia i Placu Wolności) · Koszt: mały; 12.11 (kurator, przegląd G-215): wieżę da się dodać jednym wpisem w `BELL_TOWERS` po scaleniu G-215, bez korekty importu: w66330578, środek (378,1; −247,7), half 2,75, top ok. 32,5, tip 39,2 (rzut w obrysie OSM); sygnaturka (375,4; −240,1) do y 31,8 wymaga mniejszego rodzaju wpisu
- Gdzie: w66330578 (364,7; −239,8), Krakowskie; T-120
- Dowód: NMPT GUGiK 0,5 m: wieża (378,1; −247,7), ok. 5,5 × 5,5 m, hełm do y 39,2; sygnaturka (375,4; −240,1) do y 31,8; kalenica nawy y 24,5 (gra 30,1, `source: default`). Po #190 gra nie ma żadnej wieży, przed #190 miała dwie na zachodzie
- Przyczyna: OSM nie ma wieży jako części; renderer zgaduje wieże przy zachodnim szczycie
- Poprawka: korekta importu: część `building:part=tower` (korpus do y ok. 32,5, hełm do 39,2) i sygnaturka; `height`/`roof:height` nawy z NMPT; potem zdjąć w66330578 z `TOWERLESS_OSM` (G-049 sam wyłącza wieże proceduralne)
- Pakiet właściciela: tools/osm-import (corrections), packages/engine (lista)
- Test przyjęcia: najwyższy wierzchołek bryły w promieniu 4 m od (378,1; −247,7) ma y 39,2 ± 1, poza nim nic nie przekracza y 32; dziś pada (brak wieży, kalenica 30,1)

### G-217 Bieg 2 i bieg przed bramą schodów zamkowych węższe niż w rzeczywistości
- Status: zgłoszone (2.11, kurator, przegląd #194)
- Ważność: S4 (proponowana) · Zasięg: lokalny, oś widokowa Placu Zamkowego · Koszt: mały (dane)
- Gdzie: T-126; w1305940836 (x 776,8..781,4), w1306105687 (x 824,9..829,2), podest w56965512
- Dowód: ortofoto PZGiK (siatka 2 m): bieg 2 ok. 15,5 m (z 236,8..252,5), bieg 5 ok. 15 m (z 231..247); w grze po #194 po 10 m, obok biegu 2 trawa (779; 251)
- Przyczyna: `width=10` z rozstawu murków biegu głównego nadane wszystkim biegom; OSM nie ma `width`
- Poprawka: w `TAG_CORRECTIONS` `width=15` dla w1305940836 i w1306105687 (oś OSM bliska środka pasa z ortofoto, do sprawdzenia przy poprawce), podest w56965512 i w1305889407 co najmniej tyle co sąsiedni bieg; sprawdzić, czy kandelabry i kosze przy biegach nie lądują na stopniach
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: pas `steps` biegu 2 i 5 ≥ 14,5 m; punkty bez nawierzchni na osi poprzecznej biegu 2 (±7,5 m) = 0; żaden rekwizyt na pasie `steps`

### G-218 Pas bez nawierzchni między brukiem Placu Zamkowego a stopą schodów zamkowych
- Status: zgłoszone (2.11, kurator, przegląd #194; wcześniej jako poboczne w G-213)
- Ważność: S4 (proponowana) · Zasięg: lokalny, pierwszy plan widoku z placu na schody · Koszt: mały
- Gdzie: T-128; x ok. 759..765, z ok. 233..256
- Dowód: sonda nawierzchni (762; 245) i (760; 245): żaden obrys; zrzut `g203-plac` (ciemny pas przed schodami); ortofoto: ciągły chodnik z płyt
- Przyczyna: luka w OSM (żaden obszar nie pokrywa chodnika między parkingiem w294103450 a ścieżką w56965514)
- Poprawka: obszar chodnika w korektach importu (np. `footway` / plac pieszy z obrysem od krawędzi parkingu do pierwszego stopnia) z wpisem T-128, albo uzupełnienie OSM i ponowne pobranie
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: punkty bez nawierzchni w prostokącie x 758..766, z 236..254 (co 0,5 m) = 0

### G-221 Kamienica przy Archidiakońskiej w66293533 bez żadnych drzwi
- Status: zgłoszone (2.11, naprawiacz G-197; kurator #201: stan sprzed G-197, nie jego skutek)
- Uwaga kuratora (#201): zdjęte drzwi (654,9; 9,0) stały na Grodzkiej 7 r3119721 (G-227), a w66293533 (ok. 664; 12,5) nie miała drzwi ani przed, ani po; jej wejście OSM n2969572872 (667,8; 15,0) na rogu od Archidiakońskiej odpada na stopniu 1,15 m (T-109). Poprawka najlepiej przez to wejście (próg albo stopień przed drzwiami), nie przez gniazda reguły klatek
- Ważność: S4 · Zasięg: w66293533: ściana 8,9 m od Archidiakońskiej (oś 2,2 m) nie dostaje gniazda drzwi; T-110 oczekuje wejścia od Archidiakońskiej
- Poprawka: ustalić, czemu reguły gniazd nie stawiają drzwi na ścianie od Archidiakońskiej; kontrola skanu „kamienica przy ulicy bez drzwi”
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-227 Grodzka 7 (Warsztaty Kultury) r3119721 bez żadnych drzwi po G-197
- Status: zgłoszone (2.11, kurator #201, T-130)
- Ważność: S4 · Zasięg: 1 kamienica na Grodzkiej przy Placu po Farze (ok. 641; 21) · Koszt: mały–średni (reguły drzwi)
- Gdzie: r3119721 (multipolygon z patio w232362988); ściany od Grodzkiej 23,7 m (oś w293488505 2,9 m) i od Archidiakońskiej 30,4 m (oś w173565359 4,6 m)
- Dowód: tabela drzwi przed PR #201 miała tu tylko (654,9; 8,95) na ścianie SE od zamkniętego podwórza (przez Trasę Podziemną, G-197); po #201 0 drzwi na obrysie (sonda `topo-g197-doors.py`). Lokale w OSM: Warsztaty Kultury n6335671428 i n2604112432, Poczta n4466716892, Trakt Królewski n9874495717, Bubble.Vibe n10931435786
- Przyczyna: do ustalenia: reguła 3 odrzuca obie ściany od ulicy (`facesStreet`: próbki 2/6/10 m przed ścianą w budynku po drugiej stronie wąskiej Grodzkiej? brak gniazd?), a reguła 2 nie stawia drzwi pod szyldami tych lokali
- Poprawka: drzwi klatki na ścianie od Grodzkiej (adres); kontrola skanu `tenement-no-door` (kamienica z adresem i ścianą do 6 m od osi nazwanej ulicy bez drzwi; baza do policzenia, co najmniej 2: r3119721, w66293533 z G-221)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan
- Test przyjęcia: r3119721 ma drzwi na ścianie od Grodzkiej albo Archidiakońskiej; `tenement-no-door` spada

### G-228 Stopnie sąsiednich pasów jednego biegu na różnej wysokości
- Status: zgłoszone (2.11, naprawiacz G-213)
- Ważność: S4 · Zasięg: biegi szersze niż pas, dzielone na pasy (G-203, G-213): `planSteps` próbkuje teren osobno na osi każdego pasa, więc stopnie sąsiednich pasów rozjeżdżają się o 2–3 cm (np. w48304281x), na schodach zamkowych do ok. 0,06 m
- Poprawka: renderer zna cały bieg (nowe pole w `GroundOut`/`GroundSurface`, kontrakt w core) i liczy stopnie raz na bieg; test na dwóch pasach jednego biegu
- Pakiet właściciela: tools/osm-import, packages/core (kontrakt), packages/engine

### G-229 Krótkie biegi schodów z OSM leżą płasko na wygładzonym terenie
- Status: zgłoszone (2.11, naprawiacz G-213)
- Ważność: S4 · Zasięg: 51 dróg schodów, np. w1435832499 (1,3 m, schody zamkowe): reguła G-018 w `planSteps` nie daje stopni, gdy NMT nie daje 4,5 cm na stopień
- Poprawka: bieg z `highway=steps` dostaje stopnie mimo płaskiego NMT (np. minimalna wysokość z `step_count` albo z sąsiednich podestów); kontrola skanu „schody bez stopni”
- Także (kurator, przegląd #219, T-131): portal Archikatedry w66335060 (603,5; −184,6) po rampie G-236 wznosi się 0,76 m (`step_count` 7 daje ok. 1,12 m), a bieg jest rysowany jako bruk: 0,48 m na 19 stopniach po 0,33 m w kawałku chunka `stare-miasto-0-0`, poniżej `MIN_RISER`. Dla biegu ze `step_count` liczba i głębokość stopni z tagu (7 stopni na 6,2 m to stopnie z podestem), a nie z długości pasa
- Pakiet właściciela: packages/engine (terrain), tools/osm-import

### G-230 Mikrozdarzenie po skoku gracza o ponad 300 m zostaje w uśpionych do końca sesji
- Status: zgłoszone (2.11, weryfikator G-219)
- Ważność: S4 · Zasięg: skok o ok. 600 m w jednym kroku (metro, teleport): chunk zasypia przed zamknięciem „left”, napastnicy i ofiara (`micro:mugging:5:m0/m1/victim`) zostają w `state.dormant` i nic ich nie budzi; do zapisu nie trafiają (`isMicroKey`), więc to wyciek pamięci w sesji
- Poprawka: przy usypianiu chunka zamknąć trwające mikrozdarzenie (jak „left”) albo nie usypiać kluczy `micro:`; test z teleportem
- Pakiet właściciela: packages/sim (micro-events, streaming)

### G-234 Pasy schodów ucięte brzegiem chunka: klin rysowany w poprzek albo niewidoczny
- Status: zgłoszone (2.11, naprawiacz G-213); stan sprzed G-213, bazy skanu 1 i 1
- Ważność: S4 · Zasięg: w56965515 przy (729; 160): trójkąt 1,6 × 0,9 m z brzegu z = 160 rysowany w poprzek (`steps-across-run` 1); w80139527 przy (−200; 125): pas 3 × 0,2 m przy brzegu x = −200, którego `planSteps` nie rysuje (`steps-band-hidden` 1)
- Poprawka: schody nie przycinane do chunka, tylko całe do chunka ze środkiem pasa (zmienia zasadę „outline clipped to the chunk” z `model.ts`, sprawdzić szew chunków); bazy obu kontroli → 0
- Pakiet właściciela: tools/osm-import (ground, model), tools/glitch-scan

### G-235 Dzwonnica kościoła św. Mikołaja z wysokości domyślnej, wysokość bez źródła
- Status: zgłoszone (2.11, kurator, przegląd #207; wydzielone z G-224)
- Ważność: S3 (proponowana: kościół na Czwartku bez pionowego akcentu) · Zasięg: 1 budynek (Podzamcze) · Koszt: średni (najpierw źródło, potem dane)
- Gdzie: T-129; w680377807 (879,1; 545), wolnostojąca dzwonnica ok. 5 m na południe od kościoła w66258180, rzut wydłużony ok. 7–7,5 × 2,5–3 m z dachem czterospadowym (ortofoto PZGiK, przegląd #209; dawne „ok. 7 × 7 m” błędne, obrys OSM 6,8 × 2,2 m poprawny co do kształtu). Po #209 dach namiotowy 3 m nad ścianą 3,3 m (szczyt y 3,8)
- Dowód: w grze `source: default`, 3,3 m (1 kondygnacja), szczyt y 0,8 przy terenie y −2,5. OSM: `building=yes`, `man_made=tower`, `tower:type=bell_tower`, bez `height` i `building:levels`
- Czego brak: wysokości. NMPT GUGiK nie nadaje się: maks. y 15,7 w obrysie to korona drzewa (odbicia od gruntu w obrysie, odchylenie 4–6 m, drzewa obok do y 18,2). Pl. Wikipedia nie podaje wysokości. Nie zgadywać
- Źródła do sprawdzenia (kolejno, bez łamania licencji i zabezpieczeń): (1) chmura punktów LAS GUGiK (te same dane otwarte co NMT/NMPT) z klasyfikacją: punkty klasy 6 (budynek) w obrysie, maks. wysokość minus teren; drzewa (klasy 3–5) odpadają same; (2) zdjęcia z kategorii Commons „Belfry of Church of Saint Nicholas in Lublin” (licencja każdego pliku osobno): liczba kondygnacji i proporcja do kalenicy kościoła lub sąsiedniej kamienicy z `height`/`building:levels` w OSM; (3) karta zabytku NID A/226 (zespół kościoła) w zabytek.pl, jeśli opis podaje wysokość lub kondygnacje. Wynik i źródło wpisać do T-129
- Poprawka: korekta `height` (ewentualnie `roof:shape`/`roof:height` hełmu) w `tools/osm-import/src/corrections.ts` z odsyłaczem T-129 i źródłem w komentarzu
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: szczyt bryły w680377807 (`y + height + roof`) ± 1 m od wartości ze źródła, `source: height`; kontrola `osm-tower-default-height` 1 → 0

### G-237 Schody bez `width` z OSM rysowane na 3 m: nachodzą na siebie na zakrętach i wchodzą w budynki
- Status: zgłoszone (2.11, kurator, przegląd #204; stan sprzed G-213)
- Ważność: S4 · Zasięg: wszystkie 87 dróg `highway=steps` w wyciągach poza schodami zamkowymi (żadna nie ma `width`) · Koszt: średni
- Gdzie: T-132; metalowe schody do wejścia Donżonu w66258166 (884,5..887; 218..222), w888479969 (754..763; −150,5..−145,5), zakręt w293370649 (572; −69,5)
- Dowód: ortofoto PZGiK (2.11): schody Donżonu ok. 1–1,2 m, w888479969 ok. 1,2–1,6 m; w grze pas 3 m (`PATHS.steps`). Przy Donżonie pasy trzech biegów po 1,9 m nachodzą na siebie i 1,5 m w obrys wieży. Przy w293370649 pasy biegu 0,6 m na zakręcie leżą na górnych 1,5 m biegu 3,5 m i po #204 ich stopnie idą w poprzek stopni tamtego biegu
- Poprawka: szerokość schodów bez `width` z kontekstu (np. bieg przy `entrance` albo krótki ze `step_count` ≤ 12: 1,5 m; metalowe `surface=metal`: 1,2 m), korekty z ortofoto w `TAG_CORRECTIONS` dla Donżonu i w888479969; pas biegu na zakręcie przycięty do dwusiecznej kąta, bez nakładania na sąsiedni bieg
- Pakiet właściciela: tools/osm-import (ground)
- Test przyjęcia: pas w66258166 ≤ 1,5 m i bez części w obrysie w450180469; żaden pas schodów nie nachodzi ponad 0,1 m² na pas innego biegu tej samej drogi; kontrola `steps-runs-overlap` liczy takie pary (baza do ustalenia przy wdrożeniu)

### G-238 Niższe części kościoła w jednym obrysie stoją na wysokości nawy
- Status: zgłoszone (2.11, kurator, przegląd #208)
- Ważność: S4 (proponowana: sylwetka bryły, nie zabytek z listy) · Zasięg: 5 kościołów (Świętego Ducha i Brygidki przy deptaku i Narutowicza, św. Piotra, Karmelici Bosi, św. Mikołaja) · Koszt: średni (obrysy części z NMPT)
- Gdzie: T-133; w66264126 (383,1; −78,5), w66335226 (464,2; −210), w66264082, r5420467 (366,2; 116,7), w66258180 (880; 563)
- Dowód: sonda weryfikatora #208 (`v-g216-out.txt`, NMPT GUGiK 0,5 m): udział obrysu ≥ 2 m nad terenem i > 3 m pod okapem gry: 58 %, 33 %, 31 %, 29 %, 17 %; przybudówki, prezbiteria i skrzydła klasztoru (Karmelici) stoją w grze 5–9 m za wysoko
- Przyczyna: OSM ma jeden obrys bez `building:part`, korekta G-216 daje jedną wysokość głównej bryły
- Poprawka: części `building:part` z wysokością z NMPT w korektach importu (`tools/osm-import/src/corrections.ts`, odsyłacz T-133), co najmniej kościół Karmelitów osobno od skrzydeł; bez zmiany wysokości nawy
- Pakiet właściciela: tools/osm-import, tools/glitch-scan
- Test przyjęcia: kontrola `church-part-below-roof` 5 → 0; okap i kalenica nawy w grze dalej w 1,5 m od `CHURCH_SURFACE`

### G-241 Obaleni albo zabici takedownem przechodnie bez klucza mogą ginąć przy zapisie (do potwierdzenia)
- Status: zgłoszone (2.11), prawdopodobnie nie do odtworzenia: weryfikator G-233 ustalił, że `takedownDistance` odrzuca `passerby` i `interactable`, a obalani cywile mają klucz; zamknąć po sondzie
- Ważność: S4 · Zasięg: cywile bez klucza nie mają `enemy`, więc `strayBodies` (G-233) ich nie bierze
- Poprawka: sonda zapis/wczytanie z obalonym cywilem; jeśli ginie, rozszerzyć `strayBodies` z testem
- Pakiet właściciela: packages/sim, packages/persistence

### G-245 Wieże z OSM z rzędami świecących okien co ok. 8 m zamiast strzelnic i otworów dzwonnych
- Status: zgłoszone (2.11, kurator, przegląd #209)
- Ważność: S4 · Zasięg: Donżon w450180469, Baszta Gotycka w66286376 (wieże obronne); dzwonnice w680377807 i w1382552285 do sprawdzenia po G-235/G-246; Wieża Trynitarska zgodna (okna na kondygnacjach) · Koszt: mały do średniego
- Gdzie: T-135; Podzamcze (893,1; 214,6), Stare Miasto (512,6; −143)
- Dowód: fasada wieży (`freeTower`) daje wysokie okna „civic” w kondygnacjach co ok. 8 m, nocą oświetlone; Donżon dwa rzędy dookoła (zrzut `g232-shots/g232-donzon-po.png`, ten sam układ przed #209). Rzeczywistość: Donżon i Baszta mają małe otwory i strzelnice, dzwonnice otwory na dzwony tylko u góry
- Poprawka: dla `tower:type=defensive` małe ciemne otwory (strzelnice) bez świecenia; dla `tower:type=bell_tower` otwory dzwonne w górnej kondygnacji, niżej ślepa ściana; Wieża Trynitarska bez zmian
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import (przeniesienie `tower:type`)
- Test przyjęcia: kontrola skanu `tower-lit-tiers` (budynek z `tower: true` i `tower:type` defensive albo bell_tower z oświetlanymi oknami poniżej górnej kondygnacji) 2 → 0

### G-247 Skan i18n nie widzi tekstu w propsach, stałych i `toast`
- Status: zgłoszone (2.11, weryfikator G-243)
- Ważność: S4 (luka w narzędziu) · Zasięg: `tools/i18n-scan` po #214 nie liczy literałów w propsach własnych komponentów (`<Button label="move">`), stałych i obiektach przekazanych do JSX (`{L}`, `{LABELS[k]}`), `.map` po tablicy literałów, `{"x" as string}`, `?:` w `${}` szablonu, `{["Open", x]}`, `toast("Saved")`; dziś w kodzie nic takiego nie ma (przegląd weryfikatora), ale reguła tego nie pilnuje
- Poprawka: śledzić literały płynące do propsów i do znanych funkcji tekstu (toast, notify); testy dodatnie i ujemne
- Pakiet właściciela: tools/i18n-scan

### G-250 Pojazdy z paczki CC-BY bez przednich świateł, koła `-lite` stopione, NaN w UV przy wypieku
- Status: zgłoszone (2.11, weryfikator ADR-0058 etap 4, PR #217)
- Ważność: S4 · Zasięg: `veh-cyber` i `veh-dirty` nie mają roli `headlight` (nocą tylko neon i bursztyn); modele `-lite` SUV-a i śmieciarki mają po uproszczeniu stopione koła (telefon); `tools/city_vehicles.py:230` (`ear_clip`): zdegenerowany wielokąt w Bus.obj daje zerową normalną i NaN w UV (`RuntimeWarning`), wynik powtarzalny
- Poprawka: rola `headlight` z przodu obu modeli; `-lite` z kołami jako osobnymi prostymi bryłami; pominięcie zdegenerowanych wielokątów w `ear_clip` z testem
- Pakiet właściciela: tools (city_vehicles), packages/engine (vehicle-models)

### G-254 Drony liczą czas z zegara klatki (latają w pauzie)
- Status: zgłoszone (2.11, weryfikator ADR-0058 etap 7)
- Ważność: S4 · Zasięg: `packages/engine/src/renderer/drones/*` biorą `dt` klatki renderera, nie czas świata; w pauzie drony dalej lecą (tak samo tłum renderera)
- Poprawka: czas dronów (i tłumu) z czasu świata przez `RenderPort`, zatrzymany w pauzie; test
- Pakiet właściciela: packages/engine (renderer)

### G-257 Obrys cerkwi św. Jozafata (nawa i wieża) w OSM ok. 0,9 m na północ od rzeczywistego
- Status: zgłoszone (2.11, kurator przy przeglądzie #226)
- Ważność: S4 · Zasięg: 2 budynki, nawa w69916021 (284,4; −11,9) i wieża w1382552285 (270; −9,2), Krakowskie, przy Zielonej · Koszt: mały (OSM) do średniego (przesunięcie obrysu w imporcie)
- Gdzie: T-129
- Dowód: NMPT GUGiK 0,5 m (kafel `topo-g210/dl-nmpt/jozaf.asc`, sonda `topo-g246-scripts/topo-edges.py`): rzut wieży ok. 0,9 m na południe i 0,2–0,3 m na zachód od obrysu OSM (krawędź północna 0,1–0,4 m wewnątrz obrysu, południowo-zachodnia 1,1–1,4 m na zewnątrz); południowa elewacja nawy 1,4–2,1 m na zewnątrz obrysu (z okapem ok. 0,5 m). Wierzchołek dachu wieży NMPT y 9,4 w (269,7; −10,0), w grze nad środkiem obrysu (269,99; −9,16); ortofoto PZGiK: dach symetryczny, więc przesunięty jest obrys, nie dach. Kotwica gry nie jest winna (sąsiedni w232805913 na tym samym kaflu ok. 0,4 m, Brygidki T-060 co do 0,5 m)
- Poprawka: najlepiej u źródła, poprawka obrysów w OSM według ortofoto i NMPT (dane GUGiK są otwarte), potem ponowny import; inaczej korekta z przesunięciem obrysu (`TAG_CORRECTIONS` umie dziś tylko skalę) dla obu budynków razem, z odsyłaczem T-129
- Pakiet właściciela: tools/osm-import (dane `data/osm`)
- Test przyjęcia: przesunięcie obrysu w69916021 i w1382552285 dopasowane do skoków NMPT ≤ 0,5 m; wierzchołek wieży w grze ≤ 0,5 m od (269,7; −10,0)

### G-258 Ławki na chodniku stoją ok. 16 cm w nawierzchni
- Status: zgłoszone (2.11, autor ADR-0058 etap 8, PR #228)
- Ważność: S4 (siedzisko 0,29 m nad chodnikiem zamiast ok. 0,45 m; nogi ławki znikają w płycie) · Zasięg: ławki rekwizytów na chodnikach (liczba do ustalenia sondą, tabela `props.generated.ts`) · Koszt: mały
- Dowód: przy etapie 8 siedzące postacie wymagały pozy „przysiad” (łydki cofnięte o 50°), bo ławka stoi na terenie pod chodnikiem, a chodnik jest podniesiony o `SURFACE_LIFT`; różnica ok. 0,16 m
- Przyczyna (do potwierdzenia): wysokość rekwizytu z `groundY` terenu bez podniesienia nawierzchni chodnika
- Poprawka: rekwizyty na chodniku stawiane na wysokości nawierzchni (teren + `SURFACE_LIFT`), jak ludzie i pasy chodu; po poprawce siedzący z ławki mogą wrócić do zwykłej pozy siedzącej
- Pakiet właściciela: tools/osm-import (props), packages/engine (renderer/mapcity), packages/sim (jeśli wysokość w tabeli)
- Test przyjęcia: kontrola skanu `prop-sunk` (rekwizyt z podstawą ponad 5 cm pod nawierzchnią w swoim punkcie) baza z main → 0

### G-260 Po zapisie przy przypiętym, zaalarmowanym strażniku i odejściu 600 m `ai.lost` różni się o krok
- Status: zgłoszone (2.11, weryfikator G-239)
- Ważność: S4 · Zasięg: `hebi-bramowa`, ziarna 7 i 13, gracz teleportowany 600 m po zapisie i wczytaniu; `ai.lost` 1,55 vs 1,567, hash się rozjeżdża; tak samo na cb6c014 bez zmian G-239
- Poprawka: do ustalenia (licznik `lost` przypiętego AI liczony przed/po kroku wczytania)
- Pakiet właściciela: packages/sim (AI, streaming)
- Uwaga: ocucony napastnik bez klucza po zaalarmowaniu jest przypięty bez limitu (`sleepPinned` obsługuje tylko AI z kluczem; z czytania kodu, niesprawdzone)

### G-261 Żaden test nie pilnuje Rynku poza obrysem Trybunału przy wykopie Trasy Podziemnej
- Status: zgłoszone (2.11, weryfikator G-252)
- Ważność: S4 (luka w testach) · Zasięg: mutacja `blend: 10` w padzie Trasy (dół 2,5–2,8 m na Rynku) przechodzi wszystkie testy; dziś Rynek przy narożniku Trybunału (571,25; −68,75) jest 0,36 m niżej poza obrysem budynku (siatka 4 m: 0,50 m), a komentarz w `sites.ts` mówi „slope stays inside the Trybunał's walls”
- Poprawka: test „Rynek poza obrysem w66264159 nie niżej niż X cm od NMT” i poprawa komentarza albo padu
- Pakiet właściciela: packages/sim (content/lublin)

### G-262 Postać z kolejki do straganu pod wiaduktem Zamkowej stoi na pomoście, 2,75 m nad ladą
- Status: zgłoszone (2.11, przegląd topografii PR #228, T-139)
- Ważność: S4 (proponowana; widoczne z Podwala i z wiaduktu) · Zasięg: 1 postać, `stare-miasto-1-1` (751,27; −13,32; 178,30), gospodarz stragan (750,1; −16,07; 177,7) · Koszt: mały
- Dowód: `addFigures` (`tools/osm-import/src/props-figures.ts`) stawia stojącą postać na `max(surfaceY)` pod podeszwami i sprawdza tylko ich wzajemną różnicę (`SOLE_STEP`), nie poziom gospodarza; `surfaceY` przy wiadukcie zwraca pomost (jak G-069), więc kolejka trafia na wiadukt, zwrócona do straganu pod nim
- Pakiet właściciela: tools/osm-import (props)
- Test przyjęcia: stojąca postać nie dalej niż 0,5 m w pionie od `y` gospodarza (miejsce odrzucone z powodem np. `host level`); kontrola skanu `figure-off-host-level` 1 → 0; tabela z `pnpm osm:props`

- Dług z weryfikacji #228 (do tego samego kroku albo osobno): `FIGURE_SOLES` (x ±0,12) węższe niż buty mężczyzny (±0,18, z ręką na biodrze ±0,23), dziś 1 róg buta 0,15 m w chodniku (palący 589,34; 570,29); stopy siedzących i `figure-off-seat` sprawdzają jeden punkt pod stopami (dziś bez przekroczeń, rozrzut do 5,6 cm); postacie bez brył (świadome w ADR-0058).
### G-265 Reguła G-259 zdejmuje zwykłą latarnię przy stylizowanej, która potem odpada
- Status: zgłoszone (2.11, weryfikator G-259)
- Ważność: S4 (dziś 0 przypadków w danych) · Zasięg: `byStyledLamp` (`tools/osm-import/src/props-lamp-looks.ts:23-26`, `props-gen.ts:376`) liczy stylizowane latarnie z `placed`, przed odrzuceniem (poza chunkiem, w budynku, przed szyldem, `crowded`), więc może zostawić ciemne miejsce
- Poprawka: lista stylizowanych z końcowej tabeli (po odrzuceniach); kontrola `lamp-gap` (miejsce, gdzie przed regułą stała latarnia, bez żadnej latarni w N m) albo test sondy weryfikatora (pastorał poza chunkiem, `street-lamp` w chunku)
- Pakiet właściciela: tools/osm-import (props)

### G-267 Latarenki pastorałów wchodzą w korony drzew
- Status: zgłoszone (2.11, naprawiacz G-264/G-266; widoczne na zrzucie `shots/g264/g266-after-pierzeja-east.png`)
- Ważność: S4 · Zasięg: pastorały przy drzewach na pierzei Placu Litewskiego (m.in. x ≈ −80 i 8) i prawdopodobnie na deptaku; wyższe słupy miały oprawy nad koronami · Koszt: mały
- Poprawka: reguła odstępu latarni od drzewa w generatorze (latarenka poza bryłą korony) albo przesunięcie latarni wzdłuż linii; kontrola skanu `lamp-in-crown` (punkt latarenki w bryle korony drzewa), baza z main → 0
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-269 Neony we wnętrzach kliniki i Neon Koi świecą przez ściany na ulicę
- Status: zgłoszone (2.11, naprawiacz G-263)
- Ważność: S4 · Zasięg: każdy `neon` z `S7_INTERIORS` dostaje w `buildNeon` światło punktowe 11 m, 1,2 m przed szyldem; szacunek zasięgu na bruku przed fasadą: klinika „NUMER 7” ok. 5,7 m, dwa `#eafcff` ok. 1,5 m, „PULS 48” i `#ff4d6d` ok. 0,6 m; Koi „KOI LIVE” ok. 4,4 m, `#ff2e88` ok. 1,3 m, „JUKE” ok. 0,5 m; neony wnętrz stale zajmują sloty świateł (8 na scenę), także z ulicy · Koszt: mały do średniego
- Poprawka: mechanizm `clip` (prostokąt światła) z G-263 dla świateł neonów wnętrz; engine potrzebuje prostokąta pokoju z deskryptora propa (pole w widoku neonu albo `RoomSite` w engine: zmiana w sim, kontrakt widoku); sloty świateł wnętrz tylko w pobliżu pokoju
- Pakiet właściciela: packages/engine (npr, renderer), packages/sim (widok neonu)
- Dane: `scratchpad/g263-fix/clinic-koi.txt`

### G-271 Obrys Starego Miasta `OLD_TOWN_RING` odcina pierzeje wewnątrz murów (Rynek 3–5, Grodzka, Dominikanie, Jezuicka)
- Status: zgłoszone (2.11, kurator, przegląd PR #236; T-142)
- Ważność: S4 (dziś bez skutku w grze: żadna latarnia w odciętych pasach) · Zasięg: reguła importu `oldTownLook` i kontrola skanu `lamp-road-in-old-town`; 22 budynki z adresem ulic wewnątrz murów mają środek poza obrysem · Koszt: mały (dane wielokąta i test)
- Gdzie: `tools/osm-import/src/old-town.ts`; Rynek 3, 4, 5 (w66309785 (540; −30), w66309787, w66293437), Grodzka 18–36 pierzeja północna (w66293367 (634; 79) … w66293349 (701; 144)), Grodzka 2 w232362888 (570; 2), Bazylika Dominikanów w66286338 (727; −55), Archidiakońska 9 w66293665, Dominikańska 3 w66286347, Jezuicka 15, 17, 19, 21 (w66286344, w66286327, w66286329, w66286331, w813194693); także język Placu Łokietka w177524462 przy południowej ścianie Bramy Krakowskiej (x 464–482, z −95…−107) wewnątrz obrysu
- Dowód: sonda kuratora `topo-ring` (scratchpad sesji): budynki z `addr:street` ∈ {Rynek, Grodzka (x < 705), Jezuicka, Złota, Dominikańska, Archidiakońska} ze środkiem poza obrysem = 22; budynki z adresem Królewskiej, Podwala, Kowalskiej, Lubartowskiej i Noworybnej w obrysie = 0
- Przyczyna: obrys prowadzony cięciwami między bramami i dwoma odcinkami `barrier=city_wall` (w609951474, w232362994; w żywym OSM, nie w `data/osm`), zamiast za tyłami pierzei
- Poprawka: wierzchołki za tyłami działek: północ za Rynkiem 3–5 i za północną pierzeją Grodzkiej (między nią a Rybną 11–13 i Kowalską), wschód po krawędzi skarpy za Dominikanami (x ok. 765), południe za Jezuicką 15–21 (z ok. −167), od Bramy Krakowskiej na południowy wschód po jej ścianie (bez języka Placu Łokietka); Królewska, Podwale, Kowalska i Rybna za Bramą Rybną zostają na zewnątrz. Komentarz w `old-town.ts`: oba odcinki muru są w OSM, ale poza wyciągiem `data/osm`. Przegląd `topography-curator`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola skanu `old-town-ring-cuts-block` 22 → 0 przy `outside-ring-in-old-town` (adresy Królewskiej, Podwala, Kowalskiej, Lubartowskiej, Noworybnej w obrysie) = 0; `lamp-road-in-old-town` = 0

### G-272 Miedziane zwieńczenia wież (`building:colour=green`) rysowane miętowym tynkiem
- Status: zgłoszone (2.11, kurator, przegląd PR #237; T-143)
- Ważność: S4 (rozpoznawalny punkt orientacyjny, widoczny z daleka, ale mały element) · Zasięg: 3 części: Wieża Trynitarska w618268118 (50–55 m) i w617763432 (55–60 m), wieża Ratusza w619138854 · Koszt: mały
- Gdzie: Stare Miasto (591,3; −147,3), Krakowskie (415,0; −79,3)
- Dowód: od #237 `mappedWall` (`packages/engine/src/renderer/mapcity/facade-style.ts`) zamienia nasycony kolor z mapy na pastel i bierze najbliższy tynk: `green` → #a9c2a8, z jasnymi tynkowymi gzymsami (`lighten`). W OSM te części mają też `roof:colour=green` i nie mają `building:material`; w rzeczywistości to blacha miedziana z patyną (wiedza ogólna, zdjęcia niepotwierdzone: Commons 429)
- Przyczyna: reguła „kolor nasycony = pastelowy tynk” nie rozróżnia pokrycia metalowego na zwieńczeniu wieży
- Poprawka: ściana części z zielonym `building:colour` i zielonym `roof:colour` (albo części wieży ponad dachem korpusu) w kolorze miedzi z patyną z `ROOFS_COPPER`, z gzymsami ciemniejszymi (jak cegła), nie z tynkowych; reszta `building:colour` bez zmian. Przegląd `topography-curator`
- Pakiet właściciela: packages/engine (renderer/mapcity); ewentualnie tools/osm-import, gdyby materiał `metal`/`copper` miał przyjść z danych
- Test przyjęcia: test engine: część z `colour` zielonym i dachem zielonym ma ścianę z palety miedzi; kontrola skanu `green-wall-plastered` 3 → 0

### G-273 Kroki wyższe niż STEP_HEIGHT na biegu w56965515 po G-255; SEAM_STEP bez testu
- Status: zgłoszone (2.11, weryfikator G-255 runda 4, dług po #233)
- Ważność: S4 · Zasięg: krok 0,56–0,58 m przy chodzie w wewnętrznym narożniku zakrętu (729,89; 162,80) −15,63 → (729,96) −15,07 (styk pomostów odcinków w marginesie 1,9 m poza rysowanym pasmem); krok 0,56–0,60 m przy szczycie biegu na wiadukt (733,6; 160,9) −14,1 → −13,55 (na main tego nie było); `SEAM_STEP` (0,45) w `packages/sim/src/world/ground.ts:26` to ręczna kopia `STEP_HEIGHT` bez testu zgodności · Koszt: mały
- Poprawka: wyrównanie styku pomostów w narożniku i u szczytu do ≤ STEP_HEIGHT; test `SEAM_STEP === STEP_HEIGHT` (albo stała we wspólnym module bez cyklu)
- Pakiet właściciela: packages/sim (content/lublin decks, world/ground)
- Także (stare, nie z G-255): podrzut 1,0 m na wiadukt przy (727,67; 157,66) (reguła G-062); 1,73 m (728,88; 156,77) i 2,0 m (736,68; 159,97) tylko przy wymuszonej prędkości 10–14 m/s

### G-276 Na WebGL1 wnętrze pokoju kapsułowego prawie czarne
- Status: zgłoszone (2.11, weryfikator G-263; także na main 8b8ee07, nie regresja)
- Ważność: S4 · Zasięg: przeglądarki bez WebGL2: brak cyjanowego paska i oświetlonych mebli w pokoju kapsułowym; ostrzeżenia `texImage2D: invalid format` i framebuffer o zerowym rozmiarze (te same na main) · Koszt: do ustalenia
- Poprawka: ustalić przyczynę (format tekstury palety/emisji na WebGL1, render target), wnętrze czytelne na WebGL1
- Pakiet właściciela: packages/engine (rooms, npr)

### G-277 Pasy bez nawierzchni w bruku (rynsztok/dziura ok. 0,2–0,3 m)
- Status: zgłoszone (2.11, autor ADR-0058 etapu 7b)
- Ważność: S4 · Zasięg: pas szer. ok. 0,2–0,3 m, 7 cm niżej, częściowo bez nawierzchni: Zamkowa (760,6; 186,0), deptak (404,9; −98,2) · Koszt: do ustalenia
- Poprawka: ustalić źródło (szew pasów nawierzchni, krawężnik, rynsztok z importu) i domknąć nawierzchnię; kontrola skanu na szczeliny nawierzchni (punkt chodnika bez nawierzchni otoczony nawierzchnią)
- Pakiet właściciela: tools/osm-import (ground), packages/engine (renderer/mapcity)

### G-290 Strażnicy liczą obecność w strefie w mundurze jako czyn zabroniony mimo znanego kodu
- Status: zgłoszone (4.11, naprawiacz G-280; do sprawdzenia, czy zamierzone)
- Ważność: S4 · Zasięg: `zoneActive` w `world/disguise.ts` nie uwzględnia `codeKnown` (jego odpowiednik w `crime-system.ts` tak); przy przyjaznej postawie Tessen „Cover blown” bez skutku
- Pakiet właściciela: packages/sim (world/disguise.ts)

### G-291 Kamera i start strzału TPP w bryle ściany przy ramieniu dociśniętym do ściany
- Status: zgłoszone (4.11, autor G-275 runda 2; stan sprzed G-275)
- Ważność: S3 · Zasięg: przesunięcie ramienia 0,55 m bez przycinania; 8/739 pozycji we wnętrzach startuje strzał za ścianą, kamera widzi przez ścianę (kapsuła z = −134,37 przy ścianie −134,2…−134,5)
- Poprawka: przycinać ramię do pierwszej przeszkody (`rayGeometry`), wspólnie dla sim (`aimOrigin`) i kamery
- Pakiet właściciela: packages/sim (world/hitscan) i packages/engine (camera)

### G-292 Pole nawigacji prowadzi NPC wzdłuż stóp krawędzi niskiego pomostu Mełgiewskiej, gdzie ruch staje
- Status: zgłoszone (4.11, autor G-255 runda 8; także na main)
- Ważność: S4 · Zasięg: (2457,9; 311,4), stok terenu plus krawędź w zasięgu próbek dają „za stromo”; pościg (738,3; 182,8) → (756,7; 158,3) pod wiaduktem Zamkowej nie dochodzi także na main
- Pakiet właściciela: packages/sim/src/systems/ai (steering)

### G-295 Po alarmie licznik podejrzeń zostaje na 1 i pierwsze ok. 2 s przeszukania alarmuje w jednym kroku
- Status: zgłoszone (4.11, weryfikator ADR-0069 etap 1)
- Ważność: S4 · Zasięg: `ganger-perception.ts` (`track`)
- Pakiet właściciela: packages/sim/src/systems/ai

### G-296 Pomost kładki podzamcze-2-0 kończy się na szwie z = 160 bez ciągu w chunku obok
- Status: zgłoszone (5.11, naprawiacz G-278)
- Ważność: S4 · Zasięg: kładka x 1073,8–1082,2, z 160–162,1; krawędź 0,03–1,9 m nad terenem; brak w danych importu
- Pakiet właściciela: tools/osm-import (pomosty mostów)

### G-300 Rysowany bruk odbiega od `surfaceY` o kilka cm na wygiętym terenie
- Status: zgłoszone (5.11, naprawiacz G-293); po #275 na deptaku (127; −55) do 2,5 cm; pełna naprawa wymaga, żeby drapowanie znało siatkę chunka (2,5 / 5 / 4 m) albo żeby sim czytał `drapeY`
- Ważność: S4 · Zasięg: wszędzie, gdzie `drape` (trójkąty do 5 m) odstaje od terenu; dotyczy aut (G-130), postaci i kontroli skanu; na deptaku (127; −55) do 4,5 cm
- Pakiet właściciela: packages/engine (mapcity/ground-plan) i sim

### G-302 Test kolizji hali Alchemii pomija pionowe ściany
- Status: zgłoszone (5.11, weryfikator #259)
- Ważność: S4 (luka w testach) · Zasięg: „makes solid what a body walking round the hall would bump into” liczy tylko powierzchnie niepionowe; przesunięcie zachodniej ściany bryły o 0,3 m do środka przechodzi przez cały zestaw
- Pakiet właściciela: packages/engine (test alchemii)

### G-303 Chwyt oburęczny: płytkie przenikania w przysiadzie i skoki przy drabinie
- Status: zgłoszone (5.11, weryfikator #258 runda 2)
- Ważność: S4 · Zasięg: dobycie i chowanie w przysiadzie (`drawn` 0,50–0,67) przedramię w kolbie 1–2 cm; heroine z rifle w przysiadzie z celowaniem kolba w ramieniu < 1 cm; przy `drawn` 0,5 broń przeskakuje z pleców do rąk w jednej klatce; wejście i wyjście z drabiny lub mantle obraca tors skokowo do 37°; ślizg stopy w przysiadzie z celowaniem 0,07
- Pakiet właściciela: packages/engine (renderer, two-hand-hold)

### G-309 FPP w połowie drabiny: kadr w całości wypełnia szczebel, dłoni nie widać
- Status: zgłoszone (5.11, autor poprawek drabin, PR #269)
- Ważność: S3 · Zasięg: oko ok. 0,3 m za szczeblami; wymaga decyzji o widoku FPP na drabinie
- Pakiet właściciela: packages/engine/src/camera

### G-311 Rozglądanie się na drabinie obraca ciało dowolnie, także plecami do szczebli
- Status: zgłoszone (5.11, autor poprawek drabin, PR #269)
- Ważność: S3 · Zasięg: każda drabina; poprawka wymaga osobnego obrotu ciała w `Transform` (zmiana kontraktu, ADR)
- Pakiet właściciela: packages/sim i packages/core (kontrakt `Transform`)

### G-312 Drabina łapie tylko przy kącie podejścia do 52°; na wprost z 0,6 m już nie łapie
- Status: zgłoszone (5.11, autor poprawek drabin, PR #269)
- Ważność: S3 · Zasięg: każda drabina; do decyzji, jaki kąt i zasięg mają łapać
- Pakiet właściciela: packages/sim (ruch, drabiny)

### G-316 Luki w testach martwej strefy ADR-0070: trzy mutacje przeżywają
- Status: zgłoszone (5.11, weryfikator PR #267)
- Ważność: S4 (test, nie gra) · Zasięg: `SEATED` bez „sleep” (brak testu leżącego w pasie), `StayFacingPlayer` obracający siedzącego stałego mieszkańca przy −60 (brak testu), `holdLanePlace` bez `waypoint = null` (nic nie sprawdza)
- Pakiet właściciela: packages/sim (testy `flee-dead-zone`, `reputation-tiers`)

### G-319 Łamane linii metra na mapie przechodzą pod zwykłymi budynkami, a skan nie widzi zabytków poza importem
- Status: zgłoszone (5.11, kurator, ponowny przegląd PR #270)
- Ważność: S4 · Zasięg: róg Kozia/Bernardyńska ścina narożnik przez w67498752 (ok. 17 m; wierne punkty (390; −144), (362; −149), (368; −172)); w luce T-022 odcinek (1580; 232) → (1738; 386) pod 5 budynkami, a (1738; 386) → (2084; 384) ok. 19 m na północ od łuku ulicy (lepiej (1803; 377), (1891; 368), (1962; 367), (2044; 378)); odcinek (506; −389) → (590; −1840) 5 m od Pałacu Sobieskich w181283749 (wierniej Bernardyńską (583; −528), (639; −627) i Zamojską (662; −728)). Kontrola `metro-line-protected` poza prostokątami importu widzi tylko `PROTECTED_AREAS`: dodać listę zabytków poza importem (punkt i promień, m.in. kościół św. Agnieszki w171014937, Pałac Sobieskich), baza 0; od PR #279 też odcinek Plac Litewski (88; −60) → (240; −66) pod w67504389 i w67504391 (34 m), punkty w T-163
- Pakiet właściciela: packages/sim (`content/metro.ts`), tools/glitch-scan

### G-321 Mapa M przy mocnym oddaleniu: nazwy dzielnic nakładają się („PRZEDSTARE MIASTO”)
- Status: zgłoszone (5.11, weryfikator PR #270; było też przed tą zmianą)
- Ważność: S4 · Zasięg: `liftDistricts` przesuwa „KRAKOWSKIE PRZEDMIEŚCIE” i „STARE MIASTO” na ten sam wiersz; na telefonie przy oddaleniu tłoczą się też etykiety zabytków
- Pakiet właściciela: packages/ui (mapa miasta)

### G-322 Panel kiosku metra i karta są półprzezroczyste: przez nie widać napisy HUD
- Status: zgłoszone (5.11, weryfikator PR #270)
- Ważność: S4 · Zasięg: powiadomienie dzielnicy, cel i podpowiedź dotyku prześwitują przez panel (`shots/metro1-v2/phone-kiosk-kanal-target.png`)
- Pakiet właściciela: packages/ui (metro)

### G-324 Chunk terenu z siatką 4 m nie zgadza się z siatką drapowania bruku 2,5 m
- Status: zgłoszone (5.11, weryfikator PR #275)
- Ważność: S4 · Zasięg: chunk x 240..460, z −20..160; po #275 328 próbek bruku pod terenem, najgłębiej 0,35 m; także nieciągłość `h` na progu `DECK_HEADROOM` (G-062) daje „namiot” trawy pod końcami pomostów Mełgiewskiej (np. (2483,6; 416,1) 1,00 m) i kropkowane obrysy na spodzie pomostu
- Pakiet właściciela: packages/engine (mapcity/ground-plan, cell-builder)

### G-328 Cywil uciekający w ślepy zaułek biega w miejscu w promieniu ucieczki
- Status: częściowo naprawione w #305 (6.11, 396131c; wariant z gracza (0; 2), ziarno 11, 1002001: osaczony cywil staje zamiast zawracać ku graczowi, drogi ±3π/4 usunięte). Pozostałe warianty z tego wpisu (43/1002008 gracz (3; 0), 11/1002001 i 7/1002001 gracz (2; 0), 3/1002002 i 29/1002002 gracz (0; −2)) mają inną przyczynę: migotanie skrętu 0 / −π/4 na granicy sondy; przeniesione do G-343 (weryfikator #305)
- Ważność: S3 · Zasięg: zaułek ok. (308,4; −101,5), ziarno 11, przechodzień 1002001, gracz o (0,2): przez 10 s nie wychodzi z promienia; także w pościgu: zaułek przy (316; −95) zatrzymuje uciekającego na main (465 skoków kąta); pościg w róg (316; −95) dalej ok. 465 skoków (poprawka z G-326 wycofana, bo przypinała cywila do ściany); także ziarno 43, 1002008, gracz 3 m: cywil staje 1,18 m od gracza; gracz stojący w zaułku przy (308; −101): 213 skoków
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `runFrom`)

### G-329 Cywil 294 (koi-regular-2) drga w miejscu podczas paniki po strzałach
- Status: częściowo naprawione w #310 (6.11; przechodzień 294: 84 → 10 skoków, 1082: 283 → 40 w nagranym przebiegu; w tickach 1060–1159 u 294 zostaje 7)
- Ważność: S4 · Zasięg: nagrany przebieg `determinism.test.ts`, ticki ok. 1060–1159
- Pakiet właściciela: packages/sim/src/systems/ai

### G-339 Uskok na końcach pomostów: pomost poziomy w poprzek, droga obok na terenie (T-166)
- Status: zgłoszone (5.11, kurator, przegląd G-330)
- Ważność: S4 · Zasięg: 8 końców (Mełgiewska, wiadukt Zamkowej, kładka Podzamcza) · Koszt: średni; 12.11 (przejście stare-miasto-1-1): koniec (732,2; 151,7) to styk z górnym stopniem w294098693: uskok chodzenia 0,51–0,54 m na całej szerokości pasa (G-686, `steps-riser-tall` (732; 151)). Na końcu NW (727,9..728,9; 156,0..158,4) `deck-abutment-step` do 1,73 m.; podzamcze-2-0 (12.11): `deck-abutment-step` 1 kwadrat (3 próbki): kładka (1073,8; 161,7), (1073,8; 161,1), (1073,9; 160,6), pomost -25,66 wobec gruntu 0,3 m dalej; to ten sam koniec co w T-166 (1073,8; 161,6), bez nowych końców.; 12.11 (G-686, PR #476): koniec (732,2; 151,7) i (732,5; 151,3) usunięty rampą `flightTopRamps` (`deck-abutment-step` 10 → 8, `steps-riser-tall` 1 → 0). Zostaje koniec NW (727,9..728,9; 156,0..158,4) do 1,73 m przy schodach w56965515 oraz końce Mełgiewskiej i kładki.
- Gdzie: (2456,5; 296,6) 0,45 m; (2408,5; 280,0) 0,35 m; (2446,2; 246) 0,25 m; (727,7; 157,5) 0,89 m; (763,6; 182,7) 0,36 m; (1073,8; 161,6) 0,29 m
- Przyczyna (przypuszczalna): `makeDeck` bierze `rawHeight` końców osi i robi pomost poziomy w poprzek; droga obok idzie za poprzecznym spadkiem NMT
- Pakiet właściciela: packages/sim (content/lublin decks, terrain PADS/RAMPS)
- Test przyjęcia: kontrola `deck-end-step` (różnica `groundY` 0,15 m przed i za krawędzią > 0,15 m, poza drogą pod mostem) = 0

### G-348 Długi przebieg e2e z modelami pod SwiftShaderem rośnie do 6–7 GB i kończy się OOM; zatrzymany zegar Playwrighta blokuje rysowanie
- Status: zgłoszone (5.11, autor broni białej)
- Ważność: S4 (narzędzia testowe) · Zasięg: przebieg ok. 20 min z modelami: RSS 6–7 GB, OOM-kill (nie wiadomo, czy wyciek w grze, czy `toDataURL` co klatkę); `page.clock.pauseAt` + `runFor` blokuje rysowanie, bo `GpuPacer` dostaje fence od Chrome tylko przy prawdziwych klatkach; zrzuty z dokładnym czasem wymagają innej drogi
- Pakiet właściciela: e2e (QA), packages/app (`GpuPacer`)

### G-351 Pas dzielący al. Tysiąclecia za wąski i goły (T-174)
- Status: zgłoszone (5.11, kurator, przegląd G-337)
- Ważność: S4 · Zasięg: x 620–810 i dalej, ok. 250 m²; w grze 1,25–1,5 m, w rzeczywistości ok. 3 m z barierą · Koszt: średni (szerokość z geometrii jezdni)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: pas dzielący z nawierzchnią na całej długości, szerokość ok. 3 m

### G-353 Plac `square` przy jezdni bez krawężnika i kratek (T-176)
- Status: zgłoszone (5.11, kurator, przegląd G-337)
- Ważność: S4 · Zasięg: północna krawędź al. Tysiąclecia 164,5 m (x 640–806), także T-162, T-164, T-169; renderer rysuje krawężnik tylko przy `sidewalk`, `grateAt` nie stawia kratek przy placu · Koszt: średni
- Pakiet właściciela: packages/engine (`ground-plan.ts`), tools/osm-import (`grateAt`), tools/glitch-scan
- Test przyjęcia: nowa kontrola skanu `square-road-no-kerb` (długość krawędzi jezdni, przy której z zewnątrz leży `square`/pedestrian, bez przejść) = 0

### G-354 Schowana pałka przenika brzeg spódnicy modelu VRM
- Status: zgłoszone (5.11, weryfikator PR #297)
- Ważność: S4 · Zasięg: broń biała w kaburze na biodrze przy modelach VRM ze spódnicą · Koszt: mały
- Pakiet właściciela: packages/engine (`weapon-mount`)
- Test przyjęcia: w TPP z modelem VRM ze spódnicą schowana broń nie wchodzi w siatkę spódnicy (zrzut przed/po)

### G-355 Nazwa slotu `hipL` myli: broń biała wisi po innej stronie albo w innym miejscu
- Status: zgłoszone (5.11, weryfikator PR #297)
- Ważność: S4 (kod) · Zasięg: nazwa slotu montażu nie odpowiada położeniu · Koszt: mały
- Pakiet właściciela: packages/engine

### G-356 `__seki.capture()` zwraca klatkę spóźnioną o jedną
- Status: zgłoszone (5.11, weryfikator PR #297)
- Ważność: S4 (narzędzia testowe) · Zasięg: zrzuty w e2e i w skryptach zrzutów pokazują stan sprzed ostatniego kroku · Koszt: mały
- Pakiet właściciela: packages/app (debug API), e2e
- Test przyjęcia: zrzut po `step` pokazuje stan po tym kroku

### G-358 O 23:00 sprzedawcy północnego targu uciekają na każdym progu reputacji
- Status: zgłoszone (5.11, weryfikator PR #299, do potwierdzenia)
- Ważność: S3 · Zasięg: sonda sesji, druga doba 23:00, gracz 1,5 m od straganu Fumiko: Fumiko (sklep otwarty) i Kenta w stanie tłumu „fleeing”, Goro się przesuwa; tak samo przy reputacji 0, +50, −30, −60, −100. Możliwy niezidentyfikowany alarm na targu albo artefakt przeskoku zegara w sondzie · Koszt: nieznany
- Pakiet właściciela: packages/sim (`systems/ai`, tłum)
- Test przyjęcia: sesja bez renderera o 23:00 przy straganie Fumiko bez strzałów i walki: żaden sprzedawca nie ucieka

### G-360 Nawigacja AI przepuszcza krawędź pomostu ze stopniem 0,25–0,45 m, a ruch postaci na niej staje
- Status: zgłoszone (5.11, naprawiacz G-349)
- Ważność: S3 · Zasięg: rampa na wschodnim końcu Zamkowej psuła pościgi (`flight-chase`, `under-deck-ai`); pozostałe stopnie przyczółków z `deck-abutment-step` (wiadukt Zamkowej 9, kładka podzamcze-2-0 3) · Koszt: średni
- Pakiet właściciela: packages/sim (nawigacja, `systems/ai`)
- Test przyjęcia: pole nawigacji nie prowadzi przez krawędź wyższą niż `STEP_HEIGHT`; pościgi pod mostami bez zmian

### G-361 Latarnia na wschodnim końcu mostu północnego Mełgiewskiej stoi 0,66 m pod pomostem
- Status: zgłoszone (5.11, naprawiacz G-349)
- Ważność: S4 · Zasięg: `lamp-road` (2445,6; 246,4), −25,89 przy pomoście −25,23; blokuje przejście ok. 6 m od osi · Koszt: mały
- Pakiet właściciela: tools/osm-import (rozstawienie latarni przy pomostach)

### G-362 Pomost mostu Lutosławskiego 0,9 m za nisko na zachodnim końcu; plac przed nim obniżony (T-177)
- Status: zgłoszone (6.11, kurator, przegląd G-349)
- Ważność: S4 · Zasięg: x 2436–2444, z 428–441, ok. 25 m²; plac do 0,72 m poniżej NMT, podejście ok. 26% · Koszt: mały
- Pakiet właściciela: tools/osm-import (`bridge-ends.ts`, wysokość końca pomostu), packages/sim (`abutments.ts`)
- Propozycja: wysokość końca pomostu z NMT przed przyczółkiem (pas OUT), gdy wyższy niż na końcu osi; podnosić pomost zamiast obniżać plac. Kontrola skanu `abutment-cut` (teren w zasięgu ramp przyczółków poza pomostem > 0,3 m pod NMT; baza 7)
- Test przyjęcia: na (2440; 437,5) teren nie niżej niż NMT − 0,3 m
- 13.11: poprawione na gałęzi ccr-ec2c4269-ilh8k8-g739 (ae90173): kładka przy moście Lutosławskiego (2440,9; 434,7) → (2439,4; 435,6), koniec −27,32 → −26,74; ortofoto: nowy koniec na utwardzeniu przy zachodnim narożu pomostu; zamknąć po scaleniu

### G-363 Pawilon metra w komórce bez szyldów (Nabrzeże) bez nazwy stacji i litery wejścia
- Status: zgłoszone (6.11, weryfikator PR #303)
- Ważność: S4 · Zasięg: litery pawilonu trafiają tylko do komórki, która ma już siatkę szyldów (`cell-builder.ts:70`); pylon i „M” są · Koszt: mały
- Pakiet właściciela: packages/engine (`renderer/metro`, `cell-builder`)
- Test przyjęcia: każdy pawilon ma nazwę na blendzie i literę wejścia, bez nowego wywołania rysowania w komórce z szyldami

### G-364 Cywil napiera w miejscu na stojącą postać, bo sonda ucieczki nie widzi postaci
- Status: zgłoszone (6.11, naprawiacz G-328)
- Ważność: S4 · Zasięg: ziarno 11, przechodzień 1002001, gracz (−2; 0): napiera na NPC `fixer` (id 287, ok. (317; −99,8)), prędkość 3,4 przy stałej pozycji · Koszt: średni
- Pakiet właściciela: packages/sim (`systems/ai`)

### G-365 Wyjście pawilonu metra `targ` A prowadzi na rabatę zamiast na bruk (T-158)
- Status: zgłoszone (6.11, kurator, przegląd #303; zaległość z T-158)
- Ważność: S4 · Zasięg: otwór (722; 286) wychodzi na rabatę z 289,6–292,6; według T-158 otwór miał dostać stronę parkingu albo pawilon miał się przesunąć · Koszt: mały; `metro-exit-bare` 27 (cała baza miasta) to próbki tej rabaty (przegląd podzamcze-1-0, 12.11); test przyjęcia: `metro-exit-bare` 27 → 0 bez brukowania rabaty
- Pakiet właściciela: packages/sim (`content/metro.ts`); przegląd kuratora
- Test przyjęcia: wyjście pawilonu na nawierzchni `square`/`sidewalk`, nie na rabacie

### G-367 Jasna „piła” pod stropem przejścia z hali na peron metra
- Status: zgłoszone (6.11, autor ADR-0071 etap 4, do potwierdzenia)
- Ważność: S4 · Zasięg: ściana przejścia pod stropem; prawdopodobnie światło księżyca między kawałkami stropu · Koszt: mały
- Pakiet właściciela: packages/engine (`renderer/metro`, cienie/światło)

### G-369 Cywil biega w kieszeni ok. 0,9 m przy graczu 1 m i drga w miejscu w pościgu 4 m/s (resztki G-343, G-328, G-326)
- Status: zgłoszone (6.11, weryfikator #310)
- Ważność: S4 · Zasięg: ucieczka przy graczu 1 m: 3/1002001 (0; −1) 35 skoków w drugiej połowie, 11/1002001 (1; 0) 44 (okres ok. 0,5 s); pościg 4 m/s: 43/1002008 115–163, 11/1002001 (0; −2) 239, 19/1002002 (0; 2) 29; 11/1002001 przy (310; −96) napiera na róg skrzyni 274 (sonda ±0,5 promienia ciała nie widzi rogu, pas z G-338) · Koszt: średni
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, steering)
- Test przyjęcia: w tych przypadkach skoki w drugiej połowie ≤ 4, bez biegu w miejscu

### G-374 Lista quickhacków w HUD pokazuje koszt RAM bez zniżki ICEpick
- Status: zgłoszone (6.11, autor ADR-0059 etapu 3b)
- Ważność: S4 (UI) · Zasięg: `ui/hud/scanner.tsx` bierze koszt z tabeli, a symulacja liczy ze zniżką · Koszt: mały
- Pakiet właściciela: packages/ui, packages/app (przekazanie kosztu z sim)
- Test przyjęcia: test komponentu: przy ICEpick koszt na liście równa się kosztowi pobieranemu w symulacji

### G-375 `elevatorSystem` przesuwa bramki windy bez sprawdzenia, czy ktoś stoi na ich linii
- Status: zgłoszone (6.11, weryfikator #312)
- Ważność: S4 · Zasięg: windy ADR-0020 (targ, Alchemia); zgniatanie sprawdza tylko platforma przy zjeździe · Koszt: mały
- Pakiet właściciela: packages/sim (`elevator-system`)

### G-378 Graf poziomów łączy węzły tylko prostą: ścigający bez prostej do drzwi albo narożnika wraca na posterunek
- Status: zgłoszone (6.11, naprawiacz G-368)
- Ważność: S4 · Zasięg: targ A 15 m na północ od otworu, za murem podwórza przy doki A, shinsekai A przy (u −6, w 6) · Koszt: średni
- Pakiet właściciela: packages/sim (`world/nav.ts`, `steering`)

### G-379 Winda targu: gracz staje na zamkniętej bramce 1,1 m i podciąga się na ściany szybu i barierki estakady
- Status: zgłoszone (6.11, autor windy Alchemii, sonda z #312)
- Ważność: S4 · Zasięg: skoki z estakady w zamkniętą bramkę (kabina na dole): stopy 1,05–1,20 m nad pomostem na wierzchu bramki, podciągnięcia na 2,20–2,37 m (ściany szybu, barierki), część prób wpada do szybu (do 2,6 m, bez obrażeń) · Koszt: mały (wzorem #312: bramka do nadproża i głowica) albo w ramach G-372. Dopisek 6.11 (G-372): po poprawce nikt nie staje na bramce, ale skok (szczyt 1,17–1,22 m) przenosi gracza nad bramką 1,1 m do szybu (do 9,9 m): 170 → 266 wejść w 396 próbach; potrzebna zmiana treści jak w #312 (bramka do nadproża)
- Pakiet właściciela: packages/sim (treść windy targu), G-372 (`ledgeAhead`)
- Test przyjęcia: test skoków w bramki jak w #312 (0–75° co 15°) dla windy targu: 0 wejść na bramkę i do szybu

### G-380 Martwy eksport `statsFor` liczy statystyki z pełnego wyposażenia, z pominięciem puli wszczepów
- Status: zgłoszone (6.11, weryfikator #317)
- Ważność: S4 (kod) · Zasięg: `packages/sim/src/systems/player-control-system.ts:40`, eksportowany, nieużywany w src; pułapka dla przyszłych odczytów po etapie 3c · Koszt: mały (usunąć albo przejść na `workingCyberware`)
- Pakiet właściciela: packages/sim

### G-384 Winda Alchemii: z północnej połowy klatki na górze żaden przycisk nie jest w zasięgu
- Status: zgłoszone (6.11, weryfikator #312)
- Ważność: S4 · Zasięg: górny przycisk (−1,0; −1,8 od środka) dalej niż `BUTTON_REACH` 3 m z (0; 1,05) i (0,95; 1,0); trzeba podejść pół metra na południe. Przy okazji: `lift-bake.ts` kopiuje wymiar `BUTTON` z sim zamiast brać go z planu · Koszt: mały
- Pakiet właściciela: packages/sim (`content/alchemia-lift.ts`), packages/engine (`renderer/alchemia/lift-bake.ts`)

### G-385 Strzelec 15 m niżej o dwa biegi schodów metra nigdy nie trafia (shinsekai A, doki A, seed 11)
- Status: zgłoszone (6.11, naprawiacz G-368; także na main)
- Ważność: S4 · Zasięg: oddaje wszystkie strzały, zero trafień; prawdopodobnie linia strzału przez strop przejścia albo kąt · Koszt: nieznany
- Pakiet właściciela: packages/sim (walka, raycast)

### G-386 Memo `playerStatsOf` nie ma w kluczu `inventory`, choć ubranie z `inventory.items` wpływa na wynik
- Status: zgłoszone (6.11, weryfikator #317; sprzed etapu 3c)
- Ważność: S4 · Zasięg: `packages/sim/src/systems/player-control-system.ts:74-81`, `wornGarments(domain.inventory, …)`; zmiana ubrania przy tym samym `equipment` może dać nieaktualne statystyki · Koszt: mały
- Pakiet właściciela: packages/sim
- Test przyjęcia: zmiana zużycia albo sztuki odzieży w `inventory.items` zmienia wynik `playerStatsOf`

### G-388 `Site.byLot(p, 2)` obejmuje 44 z 62 parkingów; generator pomija tam `offRoad` dla latarni
- Status: zgłoszone (6.11, weryfikator #318)
- Ważność: S4 (narzędzia/generator) · Zasięg: `lamp-road` i `lamp-modern-pole` w 2 m od parkingu `surface` nie są spychane z jezdni; przed latarnią w pasie ruchu chroni dziś tylko skan `furniture-in-car-lane` (0), `props.test.ts` jej nie złapie · Koszt: mały
- Pakiet właściciela: tools/osm-import (`props-gen`, `props-site`)
- Test przyjęcia: test `props.test.ts` łapie latarnię w pasie ruchu także przy parkingu

### G-389 Wariant A strzału jednym kciukiem: celowanie z ● nie kasuje zatrzaśniętego sprintu, a po zmianie broni na białą jeden krok ma `aim`
- Status: zgłoszone (6.11, weryfikator #322)
- Ważność: S4 · Zasięg: `aim` z ● dochodzi po zatrzaskach (`InputLatches.apply` w `keymap.ts`), więc po puszczeniu ● gracz wraca do sprintu; przy zmianie palna → biała przez jeden krok `posture.aiming` = true (flaga broni spóźnia się o krok). Test sesji B nie obejmuje tapnięcia ◎ krótszego niż krok (tylko test jednostkowy) · Koszt: mały
- Pakiet właściciela: packages/engine (`input`), packages/app (`touch-fire.ts`)

### G-392 Cembrowiny fontann 0,46–0,66 m nad brukiem: krok „na kamień i do wody” nie działa na większości odcinków
- Status: zgłoszone (6.11, naprawiacz G-372; także na main)
- Ważność: S4 (treść) · Zasięg: `BASIN_RIM.top` 0,45 m plus spadek terenu; komentarz w `basins.ts` („Seki steps up onto the stone”) rozmija się z krokiem 0,45 m · Koszt: mały
- Pakiet właściciela: packages/sim (`content/lublin/basins.ts`)

### G-393 Czubek dachu podzamcze 591: gracz spada 22 m przez widoczny płaski dach
- Status: zgłoszone (6.11, weryfikator PR #321)
- Ważność: S4 · Zasięg: jedno miejsce w mieście; trójkątny kawałek dachu 1,5 × 0,41 m przy (613,5–615; 333,9–334,4) liczy się jako wąska bryła; z 8 punktów czubka gracz zostaje na 2 (przed G-372 na 8), idąc w wierzchołek spada już 0,62 m od niego; przyczyna: `LEVEL_HOPS` = 3 i szukanie oparcia tylko w poprzek najwęższego kierunku (`foothold` w `movement-system.ts`); sondy `scratchpad/v-g372b-tip.test.ts.txt`
- Pakiet właściciela: packages/sim (movement-system)

### G-394 Epicki lub legendarny wpis o stałej rzadkości w sklepie albo tabeli łupu wypada bez cech
- Status: zgłoszone (6.11, weryfikator PR #323); ukryte, dziś bez skutku
- Ważność: S4 · Zasięg: `stockGrade` (`core/shop/shops.ts`) i tabele łupu nie losują cech dla wpisu epickiego lub legendarnego o stałej rzadkości, a walidacja zapisu przyjmuje brak pola `traits`; dziś żaden taki wpis nie istnieje; poprawka: test treści, że każdy wpis epicki lub legendarny przechodzi przez `rollTraits`, albo walidacja wymagająca cech od epickiego
- Pakiet właściciela: packages/core (items, shop)

### G-395 Wiaty przystankowe z OSM jako zamknięte garaże (T-187)
- Status: zgłoszone (6.11, kurator, przegląd #327)
- Ważność: S4 · Zasięg: 3 wiaty (w672635872, w672635873, w672635874), 2 widoczne od #327 · Koszt: mały; test przyjęcia: `shelter_type=public_transport` daje prop `bus-shelter` na obrysie zamiast budynku, budynków `use=garage` z `amenity=shelter` jest 0; kontrola skanu `shelter-as-building` (baza 3)
- Pakiet właściciela: tools/osm-import (`building-tags.ts`, `props-gen.ts`)

### G-397 Taras Alchemii to strefa bez walki przy zasadzce Kagami
- Status: zgłoszone (6.11, weryfikator PR #327)
- Ważność: S4 · Zasięg: NPC nie jeżdżą windą, czyściciele na placu nie alarmują się przez 40 s, a ekrany tarasu blokują strzały w obie strony; gracz zjeżdża windą i walczy na placu, więc bez softlocka; do decyzji: zejście czyścicieli schodami albo celowe schronienie
- Pakiet właściciela: packages/sim (systems/ai, content Alchemii)

### G-398 Haki `hook_retrieve_2` i `hook_protect_2` obiecują widok z tarasu, którego ekrany nie dają
- Status: zgłoszone (6.11, weryfikator PR #327)
- Ważność: S4 · Zasięg: ekrany tarasu blokują linię wzroku do wszystkich celów (0,2–5,5 m od oka); tekst haka albo przezierność ekranów do poprawy
- Pakiet właściciela: packages/sim (content), packages/narrative

### G-399 Dostawa Kaito→Hana: limity 50/65/80 s liczone na dawną trasę, haki przy kładce nad Grodzką poza trasą
- Status: zgłoszone (6.11, weryfikator PR #327)
- Ważność: S4 (balans) · Zasięg: trasa ma teraz ok. 200 m; limity za luźne, haki dostawy nie leżą na drodze
- Pakiet właściciela: packages/sim (content kontraktów)

### G-402 `PAD_DEADZONE_RANGE` w engine to martwa kopia zakresu z ui, a `shapeStick` nie chroni się przed strefą ≥ 0,95
- Status: zgłoszone (6.11, weryfikator PR #329)
- Ważność: S4 · Zasięg: `packages/engine/src/input/keymap.ts:204` (nieużywany eksport) i `packages/ui/src/store/ui-vm.ts:265`; przy `deadzone >= PAD_OUTER_DEADZONE` dzielnik w `shapeStick` jest zerowy lub ujemny, dziś chroni tylko `sanitizeSettings`
- Pakiet właściciela: packages/engine (input)

### G-403 `ghost-click.test.tsx`: timer odpala się po rozebraniu jsdom pod obciążeniem
- Status: zgłoszone (6.11, weryfikator PR #329)
- Ważność: S4 (testy) · Zasięg: timer z `packages/ui/src/.../ghost-click.ts:18` daje „Errors 1” przy load ok. 30 mimo zielonych testów; osobno plik przechodzi
- Pakiet właściciela: packages/ui

### G-404 Końce pomostów: kawałek pomostu i kawałek terenu pokrywają się z różnicą ok. 0,1 mm
- Status: zgłoszone (6.11, weryfikator PR #328)
- Ważność: S4 · Zasięg: np. (731,9; 152,2) cobble/cobble, (761,9; 184,3) i (2446,2; 240,7) footway; cięcie G-320 i skan wymagają całego przekroju w 1 mm, więc ich nie łapią; możliwe resztkowe migotanie; także: skan `paving-coplanar` porównuje kod nawierzchni przez `!==` (`tools/glitch-scan/test/paving-coplanar.ts:41`), lepiej `Math.round`
- Pakiet właściciela: packages/engine (mapcity), tools/glitch-scan

### G-405 Krawężniki: pasek na `h()+0,164` zamiast przy płytach `drapeY+0,16`, bez kontroli w skanie
- Status: zgłoszone (6.11, weryfikator PR #328)
- Ważność: S4 · Zasięg: w 1808 z 6512 próbek pasek pod płytami chodnika (do −24 cm przy (−199,8; −50,4)), w 197 nad nimi o < 1 mm (ryzyko migotania); 2 pary krawężnik/krawężnik w jednej płaszczyźnie: (365,3; −152,0), (635,7; 252,0); przegrany kawałek G-320 zachowuje krawężniki pod zwycięzcą; nowa kontrola skanu potrzebna
- Pakiet właściciela: packages/engine (mapcity), tools/glitch-scan

### G-406 Rynek jako mozaika kostki i płyt; kostka na 11 skrzyżowaniach wbrew bliższej osi OSM (T-189, T-190)
- Status: zgłoszone (6.11, kurator, przegląd #328)
- Ważność: S4 · Zasięg: Rynek r2082677 (pasy 8 m linii `sett` w obszarze `paving_stones`), 11 skrzyżowań 91 m²; poprawka: nawierzchnia Rynku ze zdjęcia jedną korektą w `corrections.ts`, przy dwóch liniach nawierzchnia bliższej osi (wymaga rodzaju źródła w `GroundEntry`); kontrola skanu `paving-specific-lost` (baza 11); pokrewne T-045
- Pakiet właściciela: tools/osm-import

### G-407 Wspomaganie pada bez testu sesji i bez opisu w ADR i changelogu
- Status: zgłoszone (6.11, weryfikator PR #333)
- Ważność: S4 · Zasięg: ADR-0072 etap 4 wymaga testu sesji bez renderera z syntetycznym `PadState` i tym samym celem co etap 3, jest tylko test adaptera (`packages/engine/test/browser-input-look.test.ts`); opis „Zbudowane” etapu 3 i `changelog.d/2026-11-06-wspomaganie-celowania.md` nie wspominają przyciągania z LT i spowolnienia pada
- Pakiet właściciela: packages/app (testy), docs

### G-408 Przyciski dotykowe nie filtrują `pointerType`; `aimTargets` liczone co krok także przy samej myszy
- Status: zgłoszone (6.11, weryfikator PR #333)
- Ważność: S4 · Zasięg: na urządzeniu hybrydowym klik myszą w ◎ albo przeciągnięcie myszą po strefie obrotu dostaje wspomaganie jak dotyk (`packages/ui/src/touch/pad-button.tsx`); `feedAimAssist` liczy cele (w TPP z podwójną linią wzroku) w każdym kroku także u gracza bez dotyku i pada, choć wynik nie jest używany
- Pakiet właściciela: packages/ui (touch), packages/app

### G-411 Ikony 9 mm i 5.56 w ładownicy na telefonie prawie nieodróżnialne; linie „Sprzedaj” z ikoną i bez nie są wyrównane
- Status: zgłoszone (6.11, weryfikator PR #334)
- Ważność: S4 · Zasięg: ładownica 16 px w kolorze zwykłej rzadkości (`crop-844-pouch.png`), lada „Sprzedaj” na 844×390; do ADR-0073 etap 2
- Pakiet właściciela: packages/ui (icons, trade)

### G-412 `rayHit`: koszt `cutEntry` także w chunkach bez szybów (+19%); promień z krypty w górę przeskakuje przykrycie
- Status: zgłoszone (6.11, weryfikator PR #335)
- Ważność: S4 · Zasięg: `packages/sim/src/world/ground.ts`: `cutEntry` przy każdym kroku (ok. 0,35 µs na promień, zdjąć warunkiem `chunkCuts[at].length > 0`); `vaultExit`/`rayHit`: promień z krypty w górę nie trafia w teren ulicy nad peronem, np. Kanal A (434.14; −0.72; −109.68) → (427.25; 1.23; −120.50), było przed #335, może przykrywa to strop-bryła
- Pakiet właściciela: packages/sim (world/ground)

### G-413 Resztki po ADR-0059 etap 5: nieaktualne komentarze testów, martwa stała, brak testu pasma skrytek i posiłków targu
- Status: zgłoszone (6.11, weryfikator PR #331)
- Ważność: S4 · Zasięg: komentarze `packages/sim/test/stealth-scenes.ts:82-84` i `save-load-hack-fight.test.ts:11-13` opisują stare reguły; `CONTRACT_CREW_LEVEL = 0` martwa w `packages/core/src/contracts/contracts.ts:173`; żaden test nie sprawdza poziomu skrytki ani posiłków w obszarze targu (`districtLevelAt`)
- Pakiet właściciela: packages/sim, packages/core

### G-414 Skrytka `stash:kanal-alley` (459,5; −99) leży w dzielnicy `shinsekai-7`, nie w `kanal`
- Status: zgłoszone (6.11, weryfikator PR #331; było przed PR)
- Ważność: S4 · Zasięg: nazwa i pasmo skrytki nie zgadzają się z dzielnicą; do sprawdzenia z kuratorem topografii
- Pakiet właściciela: packages/sim (content)

### G-415 Strzelec nie strzela do gracza przykucniętego za krawędzią osłony, stoi do `GIVE_UP` (20 s)
- Status: zgłoszone (6.11, naprawiacz G-381); decyzja projektowa (ADR-0016, osłony)
- Ważność: S3 · Zasięg: `firingPosition` sprawdza linię wzroku do torsu stojącego (`CHEST` 1,25), a AI celuje w `chestOf(player)`, niżej przy kucaniu; strzelec stoi na stanowisku z zerową prędkością, np. doki, gracz kuca na stosie kontenerów SW, strzelec przy `doki-aisle-s` 0,47 m, 10 s bez ruchu; poprawka (stanowisko na niski tors) zmienia działanie osłon
- Pakiet właściciela: packages/sim (`world/nav.ts`, AI strzelca)

### G-416 `routeAcrossLevels` oscyluje na granicy `ARRIVE`, gdy cel stoi na biegu schodów; węzeł `doki-pier` 0,6 m nad pomostem
- Status: zgłoszone (6.11, naprawiacz G-381)
- Ważność: S4 · Zasięg: przy `kanal A` strzelec chodzi tam i z powrotem przy węźle `head` co krok (0,476–0,528 m), gdy oba końce biegu sięgają celu przez `via`; węzeł `doki-pier` w `DOKI_NAV` 0,6 m nad podłogą pomostu (linia wzroku z oka wyżej niż strzelca)
- Pakiet właściciela: packages/sim (`world/nav.ts`, content doków)

### G-417 `memoAt` w `cable-spans.ts` trzyma ok. 135 MB sterty do końca pliku skanu; pozostałe wolne kontrole i `decksAt` liniowo
- Status: zgłoszone (6.11, weryfikator PR #336 i naprawiacz G-409)
- Ważność: S4 (testy) · Zasięg: pamięć `memoAt` na poziomie modułu (zwalniać po kontroli albo płaski klucz); nieruszane kontrole vehicle-outside-passage, paving-coplanar, drone-low-pool 4–7 s pod obciążeniem; `decksAt` w `packages/sim/src/world/deck.ts` przegląda liniowo pomosty chunka (indeks przestrzenny przyspieszyłby cable-low, drone-low-pool i kontrole rekwizytów)
- Pakiet właściciela: tools/glitch-scan, packages/sim (world/deck)

### G-418 Synapse booster (900 €$) w tabeli Tessenu podnosi wartość worka strażnika poza kontrolą E10
- Status: zgłoszone (6.11, weryfikator PR #337)
- Ważność: S4 (balans) · Zasięg: E10 sprawdza tylko worki Hebi; złote hashe nie przechodzą przez worek pokonany przez gracza, więc nie pilnują tabel łupu; do etapu 8 (test balansu)
- Pakiet właściciela: packages/core (items/loot), testy balansu

### G-419 Po ADR-0073 etap 2: brak testu sesji ikon w pasku broni, mały zapas kontrastu w HUD, nachodzące etykiety slotów na telefonie
- Status: zgłoszone (6.11, weryfikator PR #340)
- Ważność: S4 · Zasięg: `icon: WEAPON_ICONS[weapon]` w `packages/app/src/weapon-hud.ts:33` bez testu sesji; `ICON_BACKGROUNDS.hud` zakłada tło #c8c8c8 (rzadka 3,04:1, przy bieli 2,4:1); na 800/844 etykiety „2 SECONDARY” i „3 MELEE” nachodzą (było przed #340); ikony `magazine` i hełmu Tessen mało czytelne w 31 px; skróty nazw bez kluczy `item.*.short` ucinane na desktopie
- Pakiet właściciela: packages/app, packages/ui

### G-420 Efekty hacków na wrogu (`hackFx`: oślepienie, spowolnienie, ping) nie trafiają do zapisu
- Status: zgłoszone (6.11, naprawiacz rundy 3 PR #337)
- Ważność: S3 · Zasięg: po wczytaniu oślepiony wróg od razu widzi gracza, przebieg rozjeżdża się z zapisanym (hash po wczytaniu inny niż w ciągłej grze); dotyczy każdego zapisu w trakcie walki z hackami
- Pakiet właściciela: packages/sim, packages/core (save-snapshot), packages/persistence

### G-424 Zapis v30 z ogłuszonym wrogiem: migracja 30→31 nie stawia `fought` na ciałach
- Status: zgłoszone (6.11, weryfikator PR #337)
- Ważność: S4 · Zasięg: zabicie ciała ogłuszonego przed aktualizacją liczy jedną walkę stylu ciosu (np. pistolet) zamiast skradania; nadal najwyżej jedna walka na wroga; poprawka: migracja stawia `fought` na encjach `downed`/`unconscious` albo świadome pozostawienie
- Pakiet właściciela: packages/persistence (migrations)

### G-425 Spec `touch-layout` nie sprawdza sklepu kliniki na telefonie; `clampItemLevel(NaN)` zwraca NaN
- Status: zgłoszone (6.11, weryfikator PR #341)
- Ważność: S4 · Zasięg: oferta kliniki z nowym wierszem cyberdecku nie ma kontroli układu na 844×390; `clampItemLevel(NaN)` → NaN propaguje się do `deckStats` (dziś nieosiągalne, walidacja wymaga liczb całkowitych)
- Pakiet właściciela: e2e, packages/core (items)

### G-426 Aktywna broń rzadkości niezwykłej ma ramkę w kolorze paska aktywnej; na telefonie sloty broni bez ikon i z wychodzącą etykietą
- Status: zgłoszone (6.11, weryfikator PR #342)
- Ważność: S4 · Zasięg: `packages/ui/src/styles.css:981`, `equipment-slots.tsx:17`: uncommon i pasek aktywnej to ten sam cyjan #5ff2ff, różni je tylko grubość dolnej krawędzi; na 844×390 sloty broni bez ikon, „2 SECONDARY” wychodzi na sąsiedni slot (było przed #342)
- Pakiet właściciela: packages/ui (inventory)

### G-429 `place=square` rysuje drugą identyczną kostkę placu (T-200)
- Status: zgłoszone (6.11, kurator)
- Ważność: S4 · Zasięg: 7 par w mieście (28 144 m²), m.in. r10460232 na r7690183; kontrola `ground-duplicate` (baza 7)
- Pakiet właściciela: tools/osm-import

### G-430 Pierścienie kostki triangulowane jak pełna tarcza (T-201)
- Status: zgłoszone (6.11, kurator)
- Ważność: S4 · Zasięg: 14 kawałków, np. Plac Krąpca (163,3; 57,3): 159 m² trójkątów na 71 m² obrysu, przykrywa rabatę; kontrola `ground-tri-overdraw` (baza 14)
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)

### G-431 Szew gołego terenu na granicach chunków przy trawnikach (poza placami)
- Status: zgłoszone (6.11, kurator)
- Ważność: S4 · Zasięg: trawnik upraszczany po przycięciu do chunku nie domyka sąsiedniej nawierzchni; kontrola `ground-chunk-gap` (sonda: 61,4 m próbek przed G-421)
- Pakiet właściciela: tools/osm-import (ground)

### G-432 Kontrola `pad-unregistered` sprawdza tylko format `T-NNN`, nie istnienie wiersza; scena `alchemia-tpp` patrzy obok hali
- Status: zgłoszone (6.11, weryfikator PR #343)
- Ważność: S4 · Zasięg: rejestr topografii jest na gałęzi sesji, więc kontrola w main nie może sprawdzić wiersza (rozważyć przeniesienie `docs/topografia.md` do main albo listę T w danych); budżet `alchemia-tpp` słabo mierzy halę; `raid_north` startuje z zachodu T1 do czasu T2 (etap 2); (krakowskie-2-0): dwa `pad-unregistered` to pady wnętrz `CLINIC_SITE` (w67499277, 322; -68) i `KOI_SITE` (w66330644, 316; -99) z `ROOM_SITES`, bez `row`; do wiersza T albo wyjątku przy naprawie.; 12.11 (kurator, przegląd paczki): pady `ROOM_SITES` są celowe, wiersz T-280. Poprawka: `row: "T-280"` przy padzie w `sites.ts`, `pad-unregistered` −2.
- Pakiet właściciela: tools/glitch-scan, e2e

### G-435 Zapisane ustawienia z K przypisanym do sterowania zostają (`sanitizeBindings` nie odrzuca `RESERVED_KEYS`)
- Status: zgłoszone (6.11, weryfikator PR #346)
- Ważność: S4 · Zasięg: K otwiera Rozwój i jednocześnie wykonuje przypisaną akcję; tak samo T i B; poprawka: `sanitizeBindings` odrzuca klucze zarezerwowane z ostrzeżeniem
- Pakiet właściciela: packages/app (settings), packages/engine (input)

### G-437 Po awansie maks. zdrowie rośnie, a zdrowie nie: blok HUD widoczny do leczenia; stopka Dziennika bez K
- Status: zgłoszone (6.11, naprawiacz rundy 3 PR #346)
- Ważność: S4 · Zasięg: 100/100 → 100/109 po awansie trzyma blok zdrowia na ekranie (decyzja: dolać różnicę przy awansie albo ukrywać blok przy zdrowiu ≥ poprzedniego maks.); stopka Dziennika („J zamknij · I ekwipunek · Tab karta postaci”) nie wymienia K; odznaki przebrania i przekroczonej puli oraz kolumna buffów nachodzą na minimapę na komputerze: pomiar weryfikatora 7.11 na 1024×600–1920×1080 to −17 px (pula), −31/−32 px (przebranie, najdłuższa etykieta pl), −53 px (obie), identycznie na main; `e2e/hud-layout.spec.ts` mierzy tylko blok bez odznak
- Pakiet właściciela: packages/sim (progression), packages/ui (HUD, dziennik)

### G-438 Goły teren w podwórku-wcięciu domu w69672561 za Sądem na Placu Czechowicza
- Status: zgłoszone (7.11, naprawiacz G-436)
- Ważność: S4 · Zasięg: x 3–4, z −121, kilka punktów; tył budynku, liczone tylko przez bliskość ściany sądu
- Pakiet właściciela: tools/osm-import

### G-439 Goły teren na zachód od domu w69672561 przy Placu Czechowicza
- Status: zgłoszone (7.11, naprawiacz G-436)
- Ważność: S4 · Zasięg: x −5…−2, z −123…−125, ok. 23 punkty `landuse-bare`
- Pakiet właściciela: tools/osm-import

### G-441 Iglaki z OSM rysowane jako drzewa liściaste (T-212)
- Status: zgłoszone (7.11, kurator, przegląd G-423)
- Ważność: S4 · Zasięg: 5 drzew i szpaler 9 drzew z `leaf_type=needleleaved`; poprawka: model iglaka w stylu NPR, kontrola skanu `tree-needleleaved-as-broadleaved` (baza 6)
- Pakiet właściciela: tools/osm-import (props), packages/engine (renderer/mapcity)

### G-442 Drzewa poza NMPT bez wysokości z tagu `height` (T-214)
- Status: zgłoszone (7.11, kurator, przegląd G-423)
- Ważność: S4 · Zasięg: topola biała n1929177005 ma 13,3 m zamiast 25 m; poprawka: pobierać `height` w `osm:trees`, kontrola `tree-height-vs-osm-tag` (różnica ponad 3 m, baza 1)
- Pakiet właściciela: tools/osm-import

### G-443 Pnie starych dębów o ok. 40% za grube (T-215)
- Status: zgłoszone (7.11, kurator, przegląd G-423)
- Ważność: S4 · Zasięg: r 0,87/0,92 m wobec 0,62/0,64 m z obwodu; także kolizja w sim; poprawka: pień skalowany słabiej niż korona
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import

### G-445 Rampa E Alchemii: kostka drapowana na siatce 2,5 m przebija stopnie
- Status: zgłoszone (7.11, naprawiacz rundy 3 PR #343)
- Ważność: S4 · Zasięg: `drapedTriangles` (`DRAPE_GRID` 2,5 m) czyta teren przy x 435 (NMT w obrysie hali) i x 442,5 (wyższy grunt na wschód), więc paski kostki wychodzą ponad stopnie; poprawka: wyrównać teren pod obrysem hali przy ścianie E albo stopnie dopasowane do siatki drapowania
- Pakiet właściciela: packages/sim (content Alchemii), packages/engine (renderer/mapcity)

### G-446 Starsze pady zmieniają teren na drogach i chodnikach (`pad-on-road` baza 8; T-051, T-002)
- Status: zgłoszone (7.11, naprawiacz rundy 3 PR #343; kontrola `pad-on-road` z tego PR)
- Ważność: S4 · Zasięg: pad T-051 przy Bajkowskiego zmienia teren na 7 drogach i chodnikach o 0,5–1,5 m (w40052294 +1,52 m); pad T-002 przy (2515; 387) obniża ścieżkę w972606056 o 1,80 m; także rampa zachodnia Alchemii nachodzi na chodnik w232464426 przy z 52–56 (przypadkiem w tolerancji); krakowskie-2-0 (12.11): `pad-on-road` 3 to pad myjni T-051 (385..415; −50..−21), celowa scena.; krakowskie-2-1 (12.11): `pad-on-road` 3 próbki to znów pad myjni T-051: w40052294 (384; -17) +1,52 m na 40 m, w173531768 (398; -17) 1,02 m na 13 m, w232805957 (385; -16) 1,54 m na 8 m; celowa scena.; nabrzeze-1-1 (12.11): `pad-on-road` pad T-002 przesuwa ścieżkę w972606056 o -1,80 m na 18 m (2515; 387); znane.
- Pakiet właściciela: packages/sim (content, pady), tools/glitch-scan
- część T-051 usunięta w G-754 (f395319); zostaje krakowskie-2-0 415,-40 (alejka w1208186144 pod maszynownią, wewnątrz sceny) i T-002 nabrzeze-1-1 2515,387

### G-448 `traffic.test.ts` „takes turns at crossings by the market” przekracza 5 s pod obciążeniem
- Status: zgłoszone (7.11, naprawiacz G-334)
- Ważność: S4 (test) · Zasięg: przy load ok. 14 pada na limicie 5000 ms, osobno przechodzi; najpierw pomiar kosztu, bez podnoszenia limitu
- Pakiet właściciela: packages/sim (traffic)

### G-452 Szczeliny 1–15 cm między przylegającymi budynkami z OSM (T-223)
- Status: zgłoszone (7.11, kurator, przegląd G-440; widoczność do potwierdzenia zrzutem)
- Ważność: S4 · Zasięg: 241 par, 1731 m szczelin w mieście; poprawka: przy imporcie dociągać ściany do sąsiada w odległości ≤ 0,15 m; kontrola `building-sliver` (baza 241)
- Pakiet właściciela: tools/osm-import (buildings)

### G-453 Karta skanu na telefonie zasłania cel misji
- Status: zgłoszone (7.11, weryfikator #353; sprzed tego PR, po nim o 24 px szerzej)
- Ważność: S4 · Zasięg: 4 px przy jednej linii celu, przy 667×375 pl cała druga linia celu (264×20 px); poprawka: karta poniżej celu albo cel nad kartą; dopisać do kontroli `touch-layout`
- Pakiet właściciela: packages/ui (HUD, skan)

### G-454 E2E: `step` przy zamrożonej symulacji nie przesuwa gracza z wciśniętym drążkiem
- Status: zgłoszone (7.11, weryfikator #353; do potwierdzenia, może błąd sondy)
- Ważność: S4 (test) · Zasięg: `step(30)` z drążkiem wciśniętym przez CDP nie rusza gracza, przed i po #353; możliwe, że wejście dotykowe nie idzie przez `step`
- Pakiet właściciela: e2e (QA), packages/app (input)

### G-455 Nokaut przy przechodniu, dobicie na oczach patrolu przed końcem telefonu: −3 zamiast −2
- Status: zgłoszone (7.11, weryfikator #355; także na main)
- Ważność: S4 · Zasięg: kanał świadka nie wywołuje `dropBodyCalls`, więc telefon o napaści dolicza −1 po zgłoszonym zabójstwie; niespójne z zasadą jednego czynu (ADR-0070); przy okazji nieścisłe komentarze `WitnessCall.body` (`components/ai.ts:174`) i `Offence.body` (`context.ts:108`)
- Pakiet właściciela: packages/sim (crime-system)

### G-456 Napad `raid_east` w `m4-contracts` zależy od kolejności id encji
- Status: zgłoszone (7.11, budowniczy ADR-0074 etap 2)
- Ważność: S4 (test) · Zasięg: przy zmianie id gangerzy stoją ok. 600 kroków przy wschodniej ścianie hali (x 436,4), test wisi na granicy 960 kroków
- Pakiet właściciela: packages/sim (AI, treść Alchemii), packages/app (test)

### G-462 Inne ruiny z OSM rysowane jak budynki
- Status: zgłoszone (7.11, kurator przeglądu #357; poza w66286396, które zamyka #357)
- Ważność: S4 · Zasięg: w232362881 (`ruins=yes`), `building=ruins` w67498742, w813194693, w1330433247; do rozważenia razem z G-053; stare-miasto-0-1 (12.11): ruina Rybna 12 w232362881 (539,6; 113,7) ma w LoD2 i LoD1 2024 budynek 385 m² (okap 6,4, kalenica 12 m, LoD1 9,2 m), w grze 0%; ten sam przypadek co T-015.
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)

### G-463 Złote hashe nie obejmują XP zleceń, premii za brak wykrycia i wrogów powyżej poziomu 1
- Status: zgłoszone (7.11, weryfikator #351; potwierdzone sondą)
- Ważność: S4 (test) · Zasięg: zmiana XP zleceń, `undetectedXp`, mnożnika powyżej poziomu 1 albo kroków zadań poza pierwszym nie zmienia `determinism` ani `reinforcement-sidestep`; poprawka: scenariusz hasha ze zleceniem ukończonym bez wykrycia i wrogiem z pasma powyżej 1
- Pakiet właściciela: packages/sim (test)

### G-464 Model przejścia testu balansu powiela logikę gry
- Status: zgłoszone (7.11, weryfikator #351)
- Ważność: S4 (test) · Zasięg: `balance-model.ts:128` (HP gracza bez `levelModifiers`, HP wroga bez `npcHealth`), `:205` (pasmo z tabeli zamiast `gradeEnemy`), `:218` (`questGains` zamiast `evaluateQuests`/`questLogXp`); rozjazd z grą może przejść niezauważony
- Pakiet właściciela: packages/sim (test)

### G-467 Chodnik przy Arkadach nie do przejścia bez skoku (T-218)
- Status: zgłoszone (7.11, kurator przeglądu #357 runda 2)
- Ważność: S4 · Zasięg: na północnym końcu chodnika stopnie 0,54 i 0,75 m i czoło 0,63–1,2 m, uskok 0,5 m między podestem a płytą a −2…0; wszystko ponad `STEP_HEIGHT` 0,45 m; poprawka: koniec chodnika jako schody (rampa jak T2_STAIRS), płyta a −2…0 na poziomie podestu; kontrola `alchemia-walk-step` (baza 3)
- Pakiet właściciela: packages/sim (Alchemia), tools/glitch-scan

### G-468 Neon Hebi przy Arkadach czytany lustrzanie („ƎH”) z części ujęć
- Status: zgłoszone (7.11, kurator przeglądu #357; było już w rundzie 1)
- Ważność: S4 · Zasięg: z kamery (437; 104) napis odwrócony, z ujęcia autora poprawny; do sprawdzenia strona billboardu
- Pakiet właściciela: packages/engine (renderer)

### G-470 Kostka do fasad Peowiaków dalej na zachód i po stronie południowej (T-225, T-226)
- Status: zgłoszone (7.11, kurator, przegląd G-450)
- Ważność: S4 · Zasięg: 361 próbek przy w69672573 i ok. 1000 po stronie południowej; poprawka wzorem T-211 i T-221; kontrola skanu `facade-footway-bare` (goła próbka do 3 m od osi `footway`, po stronie budynku, najwyżej 1,5 m od ściany; bazę zmierzyć w całym mieście)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-472 Luki OSM przy Peowiaków: przesmyk z budynkiem i plac (T-227, T-229)
- Status: zgłoszone (7.11, kurator, przegląd G-450; do weryfikacji)
- Ważność: S4 · Zasięg: niski budynek z dachem dwuspadowym i brukowany przesmyk (x −1…21) oraz utwardzony plac 283 m² (x 61–78) bez danych w OSM; przejście krakowskie-1-0 (12.11): na placu T-229 LoD2 i LoD1 2024 mają niski budynek (61..74; −207..−191), 111 m², okap 2,7, kalenica 3,6 m. Za Teatrem Osterwy stoi dobudówka (132..147; −190..−176), 136 m², okap 3,9, kalenica 5,4 m (LoD1 4,1), na ortofoto 2025-04 jasny płaski dach, w OSM nic; leży w niej 67 m² `landuse-bare`. Dwa budynki LoD2 bez OSM (82..89; −156..−134) i (86..105; −178..−157) zostały rozebrane (parking, brak w LoD1 2024). Poprawka: `ADDED_BUILDINGS` z obrysem LoD2 i wysokością LoD1, albo wpis do OSM
- Pakiet właściciela: tools/osm-import (korekty)

### G-473 Na telefonie dwa toasty naraz zasłaniają „Użyj” i skok
- Status: zgłoszone (7.11, naprawiacz G-466)
- Ważność: S4 · Zasięg: karta dzielnicy i „Zapisano grę” razem: stos 126 px (y 76–202) nachodzi na „Użyj” i skok przy 844×390, 800×370 i 667×375 (ok. 26 px przy 800×370); poprawka: limit wysokości stosu toastów pod `.touch-mode` albo jeden toast naraz na telefonie
- Pakiet właściciela: packages/ui (HUD)

### G-475 Na telefonie toasty w rozmowie leżą na dwóch pierwszych opcjach koła dialogowego
- Status: zgłoszone (7.11, naprawiacz G-466 runda 2)
- Ważność: S4 · Zasięg: 844×390, w rozmowie kolumna toastów x 464–724, y 76–200 nachodzi na opcje koła x 490–670, y 140–246; było tak już przed G-466 (kolumna 260 px); `e2e/dialogue-fit.spec.ts` nie sprawdza koła z toastami; przy okazji: e2e nie ma dostępu do `hooks.toastMs` (krótszy czas toastów w testach wymaga przeciągnięcia haka przez `pushToastTimed`)
- Pakiet właściciela: packages/ui (HUD)

### G-476 Brak stałego testu, że zwykły glTF zachowuje kolory wierzchołków
- Status: zgłoszone (7.11, weryfikator #368)
- Ważność: S4 · Zasięg: po G-474 kolory wierzchołków zdejmowane są tylko z VRM; weryfikator sprawdził sondą z syntetycznym GLB z COLOR_0 (glTF zachowuje, VRM 0.x, VRM 1.0 i VRM w .glb tracą), ale sonda nie została w repo; wystarczy dopisać ją do `packages/engine/test/model-cast-colours.test.ts`
- Pakiet właściciela: packages/engine (renderer: modele postaci)

### G-478 Murki `barrier=wall` przy deptakach nie mają bryły (T-234)
- Status: zgłoszone (7.11, kurator przeglądu #366)
- Ważność: S4 · Zasięg: murki grobli Zamkowej w294098689/w294098690 i mur ogrodu Karmelitów (brak w OSM) zostawiają goły grunt; `barrier=wall` nie jest importowane (`features.ts:66`); por. T-178; nowa kontrola `wall-unbuilt` (`barrier=wall` ≤ 5 m od osi drogi pieszej bez bryły); po G-477 latarnie grobli stoją 0,3 m za kostką, na osi przyszłych murków: postawić je na murku albo zostawić przerwę
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-480 Po podniesieniu ciała na ziemi zostaje ciemny przedmiot w miejscu głowy
- Status: zgłoszone (7.11, budowniczy ADR-0075 etap 2)
- Ważność: S4 · Zasięg: widoczne na zrzucie niesienia (`4-niesienie-bok.png`); wygląda na nakrycie głowy albo dodatek stroju korpo (`garment-addons.ts`), który nie idzie za niesionym ciałem; prawdopodobnie sprzed etapu 2
- Pakiet właściciela: packages/engine (renderer)

### G-481 Postać zabita w skoku albo na drabinie leży w powietrzu
- Status: zgłoszone (7.11, weryfikator #370)
- Ważność: S4 · Zasięg: po G-457 zwłoki opadają z wysokości korzenia w chwili śmierci, więc przy śmierci w locie albo na drabinie ciało zostaje na tej wysokości (wcześniej spadało na y = 0); poprawka: grunt z terenu pod postacią bez części lotnej albo ragdoll (ADR-0075 etap 5)
- Pakiet właściciela: packages/engine (renderer)

### G-482 Z perkiem Quick Takedown klip duszenia urywa się w 60%
- Status: zgłoszone (7.11, weryfikator #371)
- Ważność: S4 · Zasięg: renderer liczy czas klipu od zmiany fazy (1,2 s), a perk skraca duszenie do 0,72 s; upadek zaczyna się z głową na 1,41 m zamiast 1,28 m (bez skoku, krok 0,074 m/klatkę); poprawka: czas fazy w widoku (`Transform`, zmiana portu) albo skalowanie klipu
- Pakiet właściciela: packages/engine (renderer), packages/core (ports)

### G-483 Sonda ścian przy odkładaniu ciała może trafiać w teren na stoku
- Status: zgłoszone (7.11, weryfikator #371; tylko z kodu, niezweryfikowane sondą)
- Ważność: S4 · Zasięg: `body-lay.ts` sprawdza ściany na 0,3 m nad korzeniem przez `rayGeometry` po wszystkich bryłach, w tym terenie; na stoku ponad ok. 30% ciało może się obrócić albo przesunąć bez ściany; do sprawdzenia testem na nachylonym terenie
- Pakiet właściciela: packages/engine (renderer)

### G-484 `npr-perf` „Rynek” przekracza 90 s przy load ok. 17
- Status: zgłoszone (7.11, weryfikator #371)
- Ważność: S4 · Zasięg: lokalnie strona padła przy `page.evaluate` w czasie strojenia miasta, powtórka przy load 16–19 zielona; CI zielone; nie podnosić limitu, najpierw ślad (ADR-0046)
- Pakiet właściciela: e2e (QA)

### G-486 Odłożone ciało może spaść przez niską barierkę bez oparcia
- Status: zgłoszone (7.11, weryfikator #373; z kodu)
- Ważność: S4 · Zasięg: `blocked` w `carry-system.ts` pomija warunek `foothold` z `blocks`; barierka do 0,45 m nad uskokiem nie zatrzymuje ciała, które może spaść z balkonu
- Pakiet właściciela: packages/sim

### G-487 Ciało bez klucza zmienia wygląd po wczytaniu gry
- Status: zgłoszone (7.11, weryfikator #372)
- Ważność: S4 · Zasięg: `stray-bodies.ts:31` liczy `look = fnv1a("#"+id)`, a po wczytaniu `id` jest nowe; rabuś za życia ma `look` z klucza `${id}:m${i}` (`micro-events.ts:54`), więc zmienia wygląd już przy przejściu w ciało; ofiary pomocy z `passerBy` bez klucza tak samo; łamie ADR-0076 §1 (wygląd stały między zapisami); widoczne dopiero od etapu 2 (warianty); naprawa: `look` w `StrayBodySnapshot` (migracja) albo z danych zapisu
- Pakiet właściciela: packages/sim, packages/persistence

### G-491 Auto na rampie P−1 pojawia się i znika na szczycie rampy
- Status: częściowo w PR #382 (8.11; auta pojawiają się i znikają poza szczytem rampy, ale wyjeżdżające znika w (450; 26), w połowie kwartału Lubartowskiej, w polu widzenia z placu; poprawka: `OUT_WAY` do Olejnej (454,9; 42,8), razem z G-510 i G-492)
- Ważność: S4 · Zasięg: przy chodniku Bajkowskiego auto wjeżdżające i wyjeżdżające z P−1 materializuje się i znika zamiast włączać się w ruch
- Pakiet właściciela: packages/engine (renderer)

### G-492 Auta w ruchu nie mają bryły w symulacji
- Status: zgłoszone (7.11, budowniczy ADR-0074 etap 4)
- Ważność: S4 · Zasięg: tak jak drony; gracz przechodzi przez jadące auto na P−1 i na ulicach; przy okazji: trzy osoby na P−1 (parkingowy, technik, ochroniarz) to mieszkańcy tłumu bez dialogów
- Pakiet właściciela: packages/sim

### G-493 Magentowa klamra paska na `kaito.vrm`
- Status: zgłoszone (7.11, budowniczy ADR-0076 etap 2)
- Ważność: S4 · Zasięg: widoczna też na main; klucz ALPHATEST razy jasny teksel w ścieżce bez odcienia (etap 2 naprawił tylko ścieżkę TINT)
- Pakiet właściciela: packages/engine (renderer: toon-shader)

### G-496 Posiłki w dokach mogą stać w bryłach
- Status: zgłoszone (7.11, naprawiacz G-485; pomiar zgrubny)
- Ważność: S4 · Zasięg: test `reinforcement-sidestep.test.ts` (G-208) notuje kroki z wnikaniem w bryły do 0,38 m, przed i po G-485 (900 kroków: ziarno 21 ok. 1355, ziarno 5 ok. 1746); licznik filtruje wysokość brył prosto, więc część to może być fałsz; do sprawdzenia sondą; weryfikator #377: po G-485 wnikanie posiłków w bryły ponad 1 mm 116/106 → 0/0 kroków (liczby autora 1355/1746 liczyły bryły podłogi), do zamknięcia po sondzie
- Pakiet właściciela: packages/sim (AI, ruch)

### G-498 Kontrola `underground-level-exit` liczy krawędzie grafu zamiast wyjść
- Status: częściowo naprawione (#398: kontrola liczy wyjścia); zostaje część renderera; wcześniej: częściowo w PR #398 (8.11; kontrola liczy wyjścia po punktach na granicy, nie krawędzie; zostaje część renderera: aktywne siatki miasta nad sceną `alchemia-p1`)
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/level-exit-checks.ts`: dwie krawędzie przez jedne drzwi dają „2 wyjścia”, więc kontrola może przepuścić poziom z jednym wyjściem; przy okazji: scena `alchemia-p1` pod ziemią ma aktywne siatki miasta nad sobą (`map-ground` 11, `map-signs` 11, `map-near` 7), brak zasłaniania dla wnętrz podziemnych to kandydat na oszczędność budżetu
- Pakiet właściciela: tools/glitch-scan, packages/engine (renderer)

### G-499 Migracja do v36 wskrzesza Sachiko z zapisu, w którym była martwa albo ranna
- Status: zgłoszone (7.11, weryfikator #375)
- Ważność: S4 · Zasięg: `packages/persistence/src/alchemia-parking.ts` usuwa stan Sachiko (wzorzec `MOVED_PEOPLE` z etapu 1), więc po wczytaniu zapisu v35 wraca zdrowa; wzorzec przyjęty, ale skutek nieopisany w ADR ani w teście
- Pakiet właściciela: packages/persistence

### G-501 Przebranie zdejmuje pożyczoną górę albo dół wariantu postaci
- Status: zgłoszone (7.11, weryfikator #376)
- Ważność: S4 · Zasięg: `loadout.ts:448` bierze własną teksturę pliku, więc w przebraniu postać traci teksturę ubrań pożyczoną z innego modelu (ADR-0076 etap 2); przy okazji: akcesoria bez obrysu i cienia odstają od stylu modeli; `donorsOf` wczytuje każdy plik manifestu, by poznać jego bazę (przy limicie 5 plików na telefonie problem w etapie 4); `models.spec` nie sprawdza aktywnych siatek, tylko wywołania; `npr-perf` „Nabrzeże at night” przekracza limit czekania na klatkę przy load ok. 19
- Pakiet właściciela: packages/engine (renderer)

### G-502 Latarnia poety z `district-m0.ts` stoi w kamienicy w67498725
- Status: zgłoszone (7.11, naprawiacz G-489)
- Ważność: S4 · Zasięg: prop gry pod `ground(100, -21)` („the lamp Shiro reads his poems under”) stoi 1,3 m w kamienicy; kontrola `furniture-in-building` liczy tylko `WORLD_STREET_PROPS`, więc propów gry nie widzi; przy okazji: `solidsAt` w `wave2-encounters.test.ts` filtruje wysokość brył bezwzględnie (`top < 0.3 || bottom > 1.8`), w wyższych dzielnicach (targ y ≈ −20, doki y ≈ −28) może nic nie sprawdzać
- Pakiet właściciela: packages/sim (treść), tools/glitch-scan

### G-504 Latarnie i słupy trakcji przebijają pomosty mostów Mełgiewskiej (T-240)
- Status: zgłoszone (7.11, kurator przeglądu #381; z danych)
- Ważność: S4 · Zasięg: 3 `lamp-road` i 3 `trolley-pole` stoją pod pomostem, pięć z nich 3,8–4,4 m niżej, więc słup przebija płytę; kontrola `pole-through-deck` dla słupów od 4 m (baza 6, w tym (2445,6; 246,4) z G-361); po G-503 (#383) 3 `lamp-road` stoją już na pomoście, zostają słupy trakcji
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-505 Fartuch NPC ma postrzępiony kontur
- Status: zgłoszone (7.11, weryfikator #376)
- Ważność: S4 · Zasięg: `model-apron.ts` tnie całymi trójkątami (próg `FACING` 0,35, ±0,09 wzrostu), więc boki kamizelki i spodni Mori mają białe zęby, a rąbek fartucha Kenty wystaje zębami spod bioder siedzącego; poprawka: przycięcie trójkątów na granicy albo maska; przy okazji: test „at most four looks” w `model-variants.test.ts` przekracza 20 s pod obciążeniem (4000 kroków `setTimeout(0)` dla 12 modeli)
- Pakiet właściciela: packages/engine (renderer)

### G-508 Kanciaste górki terenu
- Status: zgłoszone (7.11, użytkownik)
- Ważność: S3 · Zasięg: w wielu miejscach miasta wzniesienia terenu z NMT wyglądają kanciasto (widoczne płaskie trójkąty i ostre załamania zamiast łagodnych zboczy); do ustalenia: rozdzielczość siatki terenu (4 m i skośne cięcie), wygładzanie NMT przy imporcie, normalne cieniowania (płaskie zamiast uśrednionych), krawędzie NPR na załamaniach; najpierw pomiar i zrzuty kilku miejsc, potem poprawka z testem `map-ground-golden`; pomiary opiekuna mapy: krakowskie-0-0 szum NMT przy ścianach (1 krawędź > 20° pod budynkiem), krakowskie-0-1 jeden lokalny dół (G-523: 4 krawędzie > 20°); zalecany próg kontroli `terrain-crease` 15° bez obrysów budynków
- Pakiet właściciela: tools/osm-import (teren), packages/engine (renderer: teren)

### G-515 Cywile w modelu VRoid trzymają lewą rękę przy twarzy bez parasola
- Status: zgłoszone (8.11, budowniczy ADR-0076 etap 3a)
- Ważność: S4 · Zasięg: poza parasola riga zostaje na modelu VRoid, choć parasol jest ukryty; u Ume i innych starszych mocno odmładza sylwetkę; przy okazji: pochylenie starszych na Base_Male (Sabu, Goro, Genzō) słabo czyta się z boku (głowa Sabu wysunięta o ok. 10 cm, na zrzucie prawie prosto), do podniesienia `stoop` w manifeście
- Pakiet właściciela: packages/engine (renderer: pozy, modele)

### G-516 Spódnica Seki przebita w pozach siedzenia i snu
- Status: zgłoszone (8.11, naprawiacz G-514)
- Ważność: S4 · Zasięg: sonda `seki-skirt`: w `sit` 2,0 cm, w `sleep` 6,9 cm (oba uda, spread 0); dotyczy scen, w których bohaterka siada albo śpi; przy okazji: poza `holdingDown` nie klęczy naprawdę (tylne kolano ok. 0,27 m nad ziemią, tylna stopa w powietrzu); po #396 tylne kolano i stopa w `holdingDown` 0,29 i 0,34 m nad ziemią, a oko FPP w duszeniu (`choke-arms.ts`, `eyeHeightAt(0.7)` 1,284 m) ok. 9 cm pod głową TPP: do wyrównania przy prawdziwym klęczeniu
- Pakiet właściciela: packages/engine (renderer: pozy)

### G-518 Hina (dziecko) ma kolizję i strefę trafień dorosłego
- Status: zgłoszone (8.11, weryfikator #395)
- Ważność: S4 · Zasięg: po etapie 3a Hina rysuje się w skali 0,74, ale kolizja i trafienia w sim mają wymiar dorosłego, więc trafienie może wypaść nad głową; przy okazji: `fit` przycinany do 0,8 (torba Hiny ok. 8% za duża), niejednorodne skalowanie korzenia przekosi rekwizyty w dłoni (miotła Ume ok. 6%)
- Pakiet właściciela: packages/sim (wymiary postaci), packages/engine (renderer)

### G-519 Kratki ściekowe i krawężnik przy kostce T-243 na KP, 3 Maja i Kołłątaja
- Status: zgłoszone (8.11, kurator przeglądu #397)
- Ważność: S4 · Zasięg: 9 kratek usuniętych przez `grateAt` (odrzucenie „kerb” w `props-decals-street.ts`), m.in. (−113,9; −38,3), (−118,0; −53,9), (−132,2; −54,8), (−103,7; −80,5), (−97,7; −81,3), (−97,4; −75,0), (−103,4; −74,5), (−107,7; −112,3), (−110,5; −134,2); reguła przepuszczała gołą ziemię, a odrzuca kostkę `square`; między jezdnią a `square` nie rysuje się krawężnik, w rzeczywistości jest; poprawka: krawężnik i kratki przy obszarach-chodnikach (np. `footway=sidewalk` → `sidewalk`) albo `square` w regule; kontrola `grate-kerb-square` (baza ≥ 9; w mieście 182 odrzuceń „kerb”)
- Pakiet właściciela: tools/osm-import (props-decals-street), packages/engine (renderer: krawężniki)

### G-520 Jezdnia 3 Maja i róg KP/3 Maja/Kołłątaja przesunięte na wschód (T-244)
- Status: zgłoszone (8.11, kurator przeglądu #397)
- Ważność: S4 · Zasięg: x −122…−100, z −64…−13; na ortofoto zachodni krawężnik ok. 3–4 m dalej na zachód niż krawędź jezdni w grze (−113,8 przy z −40); w grze ten pas to chodnik i kostka T-243 (wcześniej goła ziemia), w rzeczywistości lewy pas ruchu i asfalt skrzyżowania; por. T-094
- Pakiet właściciela: tools/osm-import

### G-523 Dół 3,7 m w dziedzińcu pod w55897055 (krakowskie-0-1)
- Status: zgłoszone (8.11, opiekun mapy; do oceny kuratora: prawdziwy dół czy artefakt NMT)
- Ważność: S4 · Zasięg: teren spada z 0,6 do −3,5 m na ok. 25 × 15 m (x −175..−150, z −5..10), najgłębiej (−160; 5); czarny cokół ściany 3–4 m od dna (`pit-e`, `pit-f`, `pit-g`); `SHAPED_TERRAIN` bez `PADS`; to tu 4 krawędzie terenu > 20° (G-508); przy okazji: `steps-band-hidden` na krawędzi chunka (−200; 125), pasmo 3 × 0,2 m, niewidoczne dla gracza
- Pakiet właściciela: tools/osm-import (teren NMT)

### G-525 Objazd gracza przez auta ruchu nie zna ścian
- Status: zgłoszone (8.11, weryfikator #399; na rampie P−1 naprawiane w #399 runda 2)
- Ważność: S3 · Zasięg: `traffic-system.ts` (`MAX_ASIDE` 2,8 m) zjeżdża w bok bez sprawdzania brył; na rampie P−1 auto przejeżdżało przez ścianę; do sprawdzenia kabiny, fartuch P−1 i wąskie przejazdy w mieście
- Pakiet właściciela: packages/sim

### G-526 Lampa hali Alchemii oświetla przez strop ściany brył na dachu
- Status: zgłoszone (8.11, naprawiacz G-509)
- Ważność: S4 · Zasięg: światło punktowe food hallu w obrysie klipu oświetla od dołu ściany boczne brył na dachu (trawniki zielonego dachu ok. 860 punktów próbnych, domek klatki, kiosk windy); przeciek tego samego rodzaju co G-263; był przed G-509
- Pakiet właściciela: packages/engine (renderer: światła punktowe)

### G-527 Goła ziemia na podwórzach i przy gmachach Krakowskiego Przedmieścia wschód (krakowskie-1-1)
- Status: zgłoszone (8.11, opiekun mapy, komórka krakowskie-1-1; naprawa po G-521, bo te same pliki korekt)
- Ważność: S3 · Zasięg: 87 kwadratów 10 × 10 m `landuse-bare`, 1540 m² w 60 skupieniach (6159 próbek 0,5 m); największe: 397 m² (x 115..177; z 10..31) i 151 m² (119..191; 5..45) przy UM Collegium Maximum w67499318 (`amenity=university`), 291 m² (146..180; 100..141) i 113 m² (168..180; 109..131) za w232674406 i kamienicami, 145 m² (205..217; −20..7) i 48 m² (203..222; 8..18) przy garażach w67499326 i w67499315, 106 m² (20..42; 122..140) i 42 m² (20..29; 139..144) przy Collegium Medicum w232674395 i kościele w232674421, dziedziniec SP nr 24 przy w232674397 (ok. 136 m² w 4 skupieniach), zaplecze Radziwiłłowskiej 33 m² (147..166; 93..98); zrzuty `shots/opiekun-k11/coll-g.png`, `yard-s-g.png`; przyczyna jak G-513 i G-521 (OSM bez nawierzchni podwórek, dziedzińców uczelni i szkoły); ok. 94% powierzchni to 6 największych skupień; test przyjęcia jak `landuse-bare-krakowskie.test.ts`
- Pakiet właściciela: tools/osm-import (korekty)

### G-533 Auto rampy P−1 nie objeżdża gracza na dolnej połowie pasa w dół
- Status: zgłoszone (8.11, weryfikator #399)
- Ważność: S4 · Zasięg: `ownWayRoom` w `packages/sim/src/content/traffic-ramp.ts` bierze najmniejsze miejsce w oknie 14 m naprzód, a łuk u stopy rampy (miejsce 0) wchodzi w okno już od z ≈ 8; na pasie w dół przy z ≈ 8–22 auto IN stoi i trąbi, choć do wschodniej ściany są prawie 2 m; przykład: ziarno 1234, gracz (416,15; 12), 1,3 m od osi pasa, auto stoi 8 s i rusza po zejściu gracza; bezpieczne, ale zachowawcze; test `alchemia-ramp-pass` ma przypadki „down” tylko przy z 4–8
- Pakiet właściciela: packages/sim (ruch aut)

### G-534 Auto pojawia się tuż przy graczu poza jego widokiem i go spycha
- Status: zgłoszone (8.11, weryfikator #399)
- Ważność: S4 · Zasięg: `comeAndGo` nie ma minimalnej odległości od gracza; przykład: ziarno 77, ruch high, 11:00, gracz (413,25; −13,5), yaw 0: `alchemia-p1:in` pojawia się w kroku 1 przy (412,96; −13,72) i spycha gracza; najpewniej dotyczy też tras miasta (niesprawdzone)
- Pakiet właściciela: packages/sim (ruch aut)

### G-546 Kurosawa nosi młodzieżową bluzę z kapturem zamiast garnituru
- Status: zgłoszone (8.11, weryfikator #404; czeka na plik z VRoid Studio, ADR-0076 decyzja 1 B)
- Ważność: S4 · Zasięg: `kurosawa.vrm` (HairSample_Male CC0) ma bluzę z kapturem w jasnych pasach i rękawach; ciemny odcień z `dress` i okulary łagodzą, ale człowiek Kagami wygląda młodziej, niż pasuje do postaci; przy okazji drobne z weryfikacji: tytuł testu w `model-kurosawa.test.ts` wymienia Kaito, a sprawdza tylko Base_Male; komentarz „in a dark suit” w `model-manifest.test.ts` nieaktualny; krój `M00_006` bez numeru wersji w `model-library.ts`
- Pakiet właściciela: packages/engine (renderer: modele), packages/app/public/models

### G-550 Nieudana asercja na teksturach w testach modeli kończy worker vitest brakiem pamięci
- Status: zgłoszone (8.11, budowniczy ADR-0076 etap 4a)
- Ważność: S4 · Zasięg: `toContain` na tablicy tekstur w `packages/engine/test/model-variants.test.ts` przy porażce wypisuje graf sceny i kończy się OOM w workerze (SIGABRT) zamiast czytelnego błędu; `model-kurosawa.test.ts` obchodzi to porównaniem wartości logicznych; poprawka: porównywać nazwy albo wartości logiczne
- Pakiet właściciela: packages/engine (testy)

### G-555 Import nie rysuje obszarów `highway=service` z `area=yes`
- Status: zgłoszone (8.11, kurator przeglądu #405)
- Ważność: S4 · Zasięg: `areaSurface` zwraca null dla `highway=service` + `area=yes`, więc asfalt tych obszarów nie powstaje; 4 obszary, ok. 2 970 m²: w232464419 (410 m²), w283151244 (1 567 m²), w294902807 (864 m²), w1022724910 (131 m², pętla podjazdu kliniki Radziwiłłowska 13); propozycja kontroli `highway-area-undrawn`, baza 4
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-565 Jezdnia Ruskiej przy Szkolnej i przy Targu na Ruskiej węższa od prawdziwej
- Status: zgłoszone (8.11, kurator przeglądu #408; T-249)
- Ważność: S4 · Zasięg: przy przystanku Szkolna (x 845–880, z 486–520) i przy sklepach obok Targu na Ruskiej (x 676–714, z 565–575) pas jezdni kończy się 2–3 m przed prawdziwym krawężnikiem; przy Szkolnej zewnętrzny asfaltowy pas ze strzałkami (ok. 2 m) leży pod kostką `zatoka-szkolna`; OSM w732251517 bez `lanes`, w213515733 `lanes=3`; na ortofoto ok. 20 m od krawężnika do krawężnika
- Pakiet właściciela: tools/osm-import (szerokość jezdni)

### G-566 Wcięcie Nadstawnej 4 to w grze otwarte podwórze, a w rzeczywistości niski dach
- Status: zgłoszone (8.11, kurator przeglądu #408; T-248)
- Ważność: S4 · Zasięg: obrys w73833921 (x 758–781, z 464–491) ma w OSM 9 m przerwy na zachód między (761; 464,9) a (758,1; 474); w grze dostępny dziedziniec wyłożony kostką, na ortofoto dach zamknięty skrzydłami budynku; zrzut `topo-408-shots/notch.png`
- Pakiet właściciela: tools/osm-import (korekty budynków)

### G-576 `donorsOf` po `setManifest` wpisuje dawców starego manifestu
- Status: zgłoszone (8.11, weryfikator #407; istniało na main)
- Ważność: S4 · Zasięg: obietnica dla starego manifestu rozstrzyga się po `clear()` i wpisuje `donorsReady`; w grze manifest ustawia się raz, skutek teoretyczny
- Pakiet właściciela: packages/engine (renderer: modele)

### G-585 Na telefonie same pliki dawców ubrań przekraczają limit plików modeli
- Status: zgłoszone (8.11, budowniczy ADR-0076 etap 4b)
- Ważność: S4 · Zasięg: profil `low` ma limit 5 plików, a dawców jest 6 (ok. 260 MiB tekstur); limitu nie da się spełnić bez etapu 5 (tekstury tła 512 px) albo mniejszego zbioru dawców
- Pakiet właściciela: packages/engine (renderer: modele), tools (shrink_glb)

### G-590 Na telefonie plik obsady spoza dawców nie czeka 30 s i pobiera się przy każdym powrocie
- Status: zgłoszone (8.11, weryfikator #410; skutek G-585)
- Ważność: S4 (tylko profil Low wybrany ręcznie; domyślnie High także na telefonach, decyzja 1.11) · Zasięg: profil `low`: dawcy sami przekraczają limit 5 plików, więc `kurosawa.vrm` wypada od razu; 3 wyjścia i powroty co 2 s dały 4 pobrania (ok. 45 MiB tekstur na wczytanie); poprawka: limit liczony bez dawców albo w MiB
- Pakiet właściciela: packages/engine (renderer: modele)

### G-591 `setManifest` z innym manifestem zostawia pliki starego w pamięci
- Status: zgłoszone (8.11, weryfikator #410)
- Ważność: S4 · Zasięg: przegląd `ModelMemory` widzi tylko `manifestFiles` nowego manifestu; dziś manifest przychodzi raz na renderer, skutek teoretyczny
- Pakiet właściciela: packages/engine (renderer: modele)

### G-595 Cała flota zaparkowanych aut jest aktywna, gdy jej obrys zahacza o stożek widoku
- Status: częściowo naprawione: odcinanie floty po stożku scalone w #417 (12.11) (rynek-tpp 232/91 → 229/90); budżet #409 to przesłanianie za ścianami, nie stożek (diagnoza w zgłoszeniu błędna), decyzja użytkownika 11.11: wyjątek w ADR-0046 i przesłanianie w backlogu
- Ważność: S3 · Zasięg: zaparkowane auta są we wspólnej siatce floty z zasięgiem rysowania 240 m (`VEHICLE_LOD` w `vehicle-views.ts`); jedno nowe auto 170 m od kamery (Kapucyńska, (153,7; −147,9)) poszerza obrys siatki tak, że przecina stożek widoku sceny `reference`, i cała flota staje się aktywna, choć auta w kadrze nie ma: 193/82 → 196/83; poprawka: podział floty na komórki albo obrys liczony z aut w zasięgu, bez podnoszenia budżetu; blokuje #409
- Pakiet właściciela: packages/engine (renderer: pojazdy)

### G-622 Loader glTF liczy pozycje skóry na CPU dla każdego prymitywu
- Status: zgłoszone (11.11, naprawiacz G-620; do sprawdzenia w przeglądarce)
- Ważność: S4 · Zasięg: `refreshBoundingInfo(true, true)` przy wczytywaniu VRM kosztuje 40–450 ms na plik w NullEngine; jeśli tak samo w przeglądarce, wydłuża wczytywanie postaci; inne testy modeli (`model-textures`, `model-cast-colours`, `model-donors`, `model-figure*`) też nie zwalniają silników
- Pakiet właściciela: packages/engine (renderer: modele)

### G-630 Budynki LoD1 dopasowane luźno (IoU 0,5–0,7) zostają przy starej wysokości
- Status: zgłoszone (12.11, kurator przeglądu wysokości LoD1) ; osobny PR po heights
- Ważność: S4 · Zasięg: 25 budynków z różnicą > 3 m, np. Kowalska 5 (w66309797) 24,5 m wobec LoD1 14,8 m obok Kowalskiej 7 z 15,3 m (uskok 9 m), Kuratorium Oświaty (T-253); proponowana kontrola `lod1-loose-match` (baza 25)
- Pakiet właściciela: tools/osm-import

### G-633 Klasztor Dominikanów: środek dachu 5 m nad LoD1
- Status: zgłoszone (12.11, kurator przeglądu wysokości LoD1)
- Ważność: S4 · Zasięg: środek dachu 30,9 m wobec 25,8 m w LoD1; poza zmianą heights, wynik sondy kuratora; przejście stare-miasto-1-0 (12.11): `landmark-vs-lod1` 1 w komórce to ten sam przypadek (30,9/25,8 m, IoU 0,90); po #459 bez zmian
- Pakiet właściciela: tools/osm-import, packages/engine (receptury landmarków)

### G-636 Bariera leżąca na ścianie budynku liczy się w skanie jako wycięta
- Status: zgłoszone (12.11, scalenie #418 z main; baza `barrier-parallel-cut` 14 → 15 opisana w commicie 529888c)
- Ważność: S4 · Zasięg: mur oporowy w227679479 na Podzamczu (539; 517) biegnie po południowej ścianie garażu w444375263, który stoi w grze od G-556; `inBuilding` w `barrier-room.ts` słusznie go tnie, a kontrola liczy odcinek jako „cut”; poprawka: import pomija odcinek bariery leżący na ścianie budynku albo kontrola go nie liczy; po niej baza wraca do 14; (krakowskie-2-0): `barrier-parallel-cut` płot w173531574 (387; -27) 8 z 16 m; tnie go myjnia T-051 (scena celowa), nie ściana budynku; kontrola liczy go jak G-636.; stare-miasto-0-1 (12.11): `barrier-parallel-cut` mur w436266757 (558; 100), odcinek 2 z 5 m; ta sama klasa (niepotwierdzone, że leży na ścianie budynku).; 12.11 (kurator, przegląd paczki): mur w436266757 (555..561; 100) to inna przyczyna, nie ściana budynku: najbliższa ściana gry (r6477272) jest 7,2 m dalej. Odcinek tnie trasa wzdłuż muru (cięcia w `crowd-barriers.ts`), czyli przypadek, który kontrola ma łapać. Do rozstrzygnięcia przy naprawie: trasę odsunąć albo przyjąć cięcie jako celowe z wierszem T.
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-640 Raster AI bierze koniec niskiego pomostu za płaski teren
- Status: zgłoszone (12.11, naprawiacz G-625; potwierdzone w kodzie)
- Ważność: S3 · Zasięg: `ledgesOf` liczy uskoki pomostu tylko w oknie ze schodami (`steering.ts:313` `const ledges = base && flight ? ledgesOf(...) : null;`, warunek w `:266`); w doku przy (2477,2; 407,8) teren −27,24, pomost −26,88 (`onLowDeck`), uskok 0,37 m, którego ruch nie pokonuje, a raster widzi płasko; ganger w pościgu przy dokach może tam utknąć; rodzina G-339
- Pakiet właściciela: packages/sim (systems/ai)

### G-641 Po utknięciu ganger planuje z tego samego pola i bez kroku w bok
- Status: zgłoszone (12.11, naprawiacz G-625; potwierdzone w kodzie)
- Ważność: S4 · Zasięg: `ganger-walk.ts:157` `if (p && !p.plan && this.unsticking())`: gdy raster nie zgadza się z ruchem, ponowny plan daje tę samą drogę i ganger stoi bez końca zamiast spróbować prostej drogi albo kroku w bok
- Pakiet właściciela: packages/sim (systems/ai)

### G-642 Testy AI teleportują gracza na y = 0 i zadają mu obrażenia od upadku
- Status: zgłoszone (12.11, naprawiacz G-625)
- Ważność: S4 · Zasięg: `teleportPlayer(sim, { x, y: 0, z })` na wysokim terenie daje 155–217 pkt w nogę w pierwszym kroku (wschód mapy); `barrier-ai.test.ts` (l. 34) robi to samo, dziś na niskim terenie; testy powinny brać `ground(x, z)` jak `barrier-detour.test.ts`, inaczej „gracz traci zdrowie” może przejść z niewłaściwego powodu
- Pakiet właściciela: packages/sim (testy)

### G-645 Po wczytaniu zapisu wszystkie pościgi `wide` przebudowują rastry w jednym kroku
- Status: zgłoszone (12.11, weryfikator #426)
- Ważność: S4 · Zasięg: pamięć `chases` (`steering.ts:660`) nie trafia do zapisu, a `chaseDetour` nie podlega limitowi `mayPlan`; pierwszy krok po wczytaniu buduje rastry `wide` wszystkich gangerów z `chase` naraz (54,7 ms na okno, przy kilku oknach N razy więcej); to samo przy zmianie `floor|reach`; determinizm bez zmian
- Pakiet właściciela: packages/sim (systems/ai)

### G-648 Budynek z relacji bierze użytek tylko z relacji, nie z obrysu
- Status: zgłoszone (12.11, kurator przeglądu G-600)
- Ważność: S4 · Zasięg: VIVO ma w grze `use` = residential, bo relacja ma `building=yes`, a obrys w376043568 (`building=retail`, `shop=mall`) jest pomijany; poprawka: `buildingUse` bierze też tagi obrysu (`role=outline`); kontrola `building-use-vs-outline` (co najmniej 1 trafienie)
- Pakiet właściciela: tools/osm-import

### G-649 Mur oporowy i chodnik przy Podwalu przesunięte o 1,8–3 m na północ
- Status: zgłoszone (12.11, kurator przeglądu G-613, T-259)
- Ważność: S3 · Zasięg: x 695–760: mur w67626198 i oś chodnika w56965511 z OSM leżą 1,8–3 m na północ od rzeczywistości; ściana oporowa w BDOT10k (`OT_BUUO_L`, przez (739,2; −178,6), (726,2; −184,5), (706,5; −191,2)) pokrywa się ze stopniem NMT, ortofoto ma kostkę od 1,8–2,4 m na południe od osi do ścian domów; trasa tłumu idzie przez to po skarpie (NMT 1,5–2 m nad chodnikiem, x 735: 182,7 wobec 180,6 m); poprawka: geometria muru i chodnika według BDOT10k; kontrola `barrier-vs-bdot` (mur oporowy OSM > 1,5 m od linii BDOT10k, baza ≥ 1)
- Pakiet właściciela: tools/osm-import

### G-650 Dwie alejki przy Radziwiłłowskiej bez tras tłumu po G-613
- Status: odblokowane (12.11: G-655 naprawiony w #437); wcześniej: zablokowane przez G-655 (12.11; kryterium ≥ 1 m od płotu niemożliwe bez osłabienia `walker-on-car-lane`: oś pasa ruchu Radziwiłłowskiej 2,8–3,7 m od płotu, bo jezdnia zachodzi na chodnik; kontrola alejek bez tras liczona dosłownie daje 17, przy 3 największych alejkach chunku 2)
- Ważność: S4 · Zasięg: po odsunięciu tras od płotów alejki przy w232805994 (x 45–80, z ok. 105, Pałac Lubomirskich, Plac Litewski 3) i w232805996 (x −63…−11, Plac Litewski 5) zostały bez przechodniów, w promieniu 30 m brak trasy; kryterium: trasa ≥ 1 m od płotu, a gdy pętla jest za wąska, jedna linia zamiast zniknięcia; kontrola `footway-alley-unwalked` (alejka powyżej `ALLEY_AREA` bez próbki trasy w 5 m, baza 2)
- Pakiet właściciela: packages/sim (tłum)

### G-652 `glitch-scan.test.ts` ma 2236 linii i rośnie
- Status: zgłoszone (12.11, weryfikator G-600)
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/glitch-scan.test.ts` (wyjątek spoza reguły ESLint o 500 liniach, ADR-0031) dostaje kolejne kontrole przy każdej zmianie mapy; podział na pliki według rodzaju kontroli
- Pakiet właściciela: tools/glitch-scan

### G-653 Odcięty ganger na ulicy nie szuka drogi przez graf poziomów
- Status: zgłoszone (12.11, runda wydajności #426)
- Ważność: S4 · Zasięg: gdy ani okno `near`, ani `wide` nie prowadzi do celu, ganger na ulicy wraca na posterunek bez `routeAcrossLevels` (jak na main); droga kładką lub schodami nad barierą nie jest szukana; pytanie co krok kosztowało 2,7 s na test (4790 wywołań, `attach` liczy wzrok do wszystkich węzłów), więc jeśli ma wrócić, to rzadko (np. raz na cel w komórce 32 m) i z limitem na krok
- Pakiet właściciela: packages/sim (systems/ai)

### G-656 Alejka z donicami w krakowskie-1-1 zapada się w `unloop` i zostaje bez trasy
- Status: zgłoszone (12.11, naprawiacz G-650)
- Ważność: S4 · Zasięg: pas x 199…229, z 83…104 przy murach oporowych w1365971524/25/27/31: po G-613 `unloop` zjada pętlę z 180 do 69 próbek, reszta leży na ścianach i budynku, alejka bez przechodniów; rozwiązanie razem z G-650 (jedna linia zamiast zapadniętej pętli)
- Pakiet właściciela: packages/sim (tłum)

### G-658 Jezdnie w kształcie „lizaka” mają samoprzecinający się obrys
- Status: zgłoszone (12.11, naprawiacz G-654)
- Ważność: S4 · Zasięg: w173489056, w179269926, w296752325, w360030910, w1561106064 (drogi serwisowe z pętlą zamkniętą na własnym węźle); `simplePieces` z #433 celowo ich nie tnie, bo pocięcie odsłania lukę w cięciu chodnika w Nabrzeżu przy (2696; 299), +1 próbka `landuse-bare`; razem z tym wypełnienie zewnętrznych rogów na stykach kawałków dróg (proste końce `bufferLine`, do 1 m² na róg); nabrzeze-1-1 (12.11): `ground-ring-self-cross` droga (road) 14 punktów (2685; 280) i `kerb-fill-wide-estimated` 7 kwadratów (708 próbek), skupisko (2695; 300), obok miejsca (2696; 299) z G-658; niepotwierdzone, że ta sama droga.
- Pakiet właściciela: tools/osm-import

### G-659 30 samoprzecinających się obrysów nawierzchni bez kontroli w skanie
- Status: kontrola w main (#453, `ground-ring-self-cross` baza 30); naprawa w etapach 2–3 ADR-0078
- Ważność: S4 · Zasięg: place przycięte na krawędzi kawałka mapy przy (20; −20), pętle zamkniętych ścieżek w Podzamczu i Nabrzeżu; skan nie liczy tego rodzaju; poprawka: kontrola w `tools/glitch-scan` z bazą z przebiegu (i wpis w `docs/mapa-pokrycie.json`), potem naprawy; propozycja kuratora (przegląd #433): `ground-ring-self-cross`, baza 30 (Krakowskie 15, w tym 6 placów przy (20; −20), Nabrzeże 5, Podzamcze 5, Stare Miasto 5); podzamcze-2-1 (12.11): `ground-ring-self-cross` 3 kwadraty (4 trafienia), pętle ścieżek (footway) w (961; 538) 37 punktów, (1057; 504) 34, (1046; 424) 42 i (1045; 424) 46; ta sama klasa.; nabrzeze-0-0 (12.11): `ground-ring-self-cross` 2 pętle ścieżek (footway): (2483; 137) 20 punktów i (2488; 144) 17 punktów.; nabrzeze-0-1 (12.11): `ground-ring-self-cross` pętla ścieżki (footway) (2427; 451), 42 punkty.; nabrzeze-1-0 (12.11): `ground-ring-self-cross` droga (road) nabrzeze-1-0, 10 punktów (2599; 263).
- Pakiet właściciela: tools/glitch-scan, tools/osm-import
- 13.11 gałąź G-744 (ADR-0078 etap 2): ground-ring-self-cross 30 -> 8, wnętrza 16 pętli ścieżek kładzione w całości (pathLoops); kurator: Podzamcze (1046,424) plac na kostce ortofoto, Nabrzeże w154012559/60 trawa na ściółce pod koronami (2025-04) zgodne.

### G-661 Goły plac na północ od VIVO
- Status: zgłoszone (12.11, kurator przeglądu G-647; T-260)
- Ważność: S4 · Zasięg: Podzamcze, x 1101–1120, z 239,7–252, ok. 55 m² gołe od G-647 (wcześniej przykryte trawnikiem r11978659); ortofoto: jasna nawierzchnia placu; poprawka: kostka lub płyty do krawędzi garażu albo reguła gołej ziemi z ortofoto (ADR-0077 krok 1.1)
- Pakiet właściciela: tools/osm-import

### G-663 Drogi `segregated=yes` za wąskie
- Status: zgłoszone (12.11, kurator przeglądu G-647; T-262)
- Ważność: S4 · Zasięg: 62 drogi `highway=path` z `segregated=yes` (Podzamcze, Nabrzeże) mają pas 2 m (`PATHS.path`); np. w65351890 przy (1038; 305): kostka ok. 4 m i asfalt rowerowy ok. 2,4 m; poprawka: szerokość z `footway:width` + `cycleway:width` albo domyślnie ok. 2,5 + 2 m, dwie nawierzchnie; kontrola skanu `path-segregated-width`
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-666 Pamięć pościgu `chase` nie jest czyszczona, gdy cel przejdzie przez barierę
- Status: zgłoszone (12.11, naprawiacz G-644; także na main)
- Ważność: S4 · Zasięg: `chase` gangera (`ganger-walk.ts`) zostaje, dopóki cel jest w `CHASE_DRIFT` (8 m) od starego; gdy gracz przeskoczy płot w tym promieniu, ganger może dojść do starego celu i stać po złej stronie bariery
- Pakiet właściciela: packages/sim (systems/ai)

### G-668 Trawnik `T-246/trawnik-nadstawna-3` leży na dachu
- Status: zgłoszone (12.11, kurator przeglądu G-627)
- Ważność: S4 · Zasięg: Podzamcze, x 814–823, z 474–489, przy zachodniej ścianie w73833932 (5,6 m): na obu nalotach krawędź dachu ok. 2,5 m na zachód od obrysu OSM, zarośla przy x 812–818; najpierw sprawdzić obrys w73833932, potem przesunąć trawnik
- Pakiet właściciela: tools/osm-import

### G-669 `T-170/trawnik-pawilonow` sięga na kostkę z misami drzew
- Status: zgłoszone (12.11, kurator przeglądu G-627)
- Ważność: S4 · Zasięg: Podzamcze, x 840–870, z 361–369: południowe 3–4 m trawnika do ścieżki w227698420 to kostka z misami drzew; niski priorytet
- Pakiet właściciela: tools/osm-import

### G-673 `added-grass-off-green` liczy cały obrys trawnika, nie widoczną trawę
- Status: zgłoszone (12.11, kurator przeglądu G-667; opcjonalne)
- Ważność: S4 · Zasięg: ścieżki biegnące przez ręczny trawnik zaniżają jego zieleń, np. `T-245/trawnik-klinika` 53% całego obrysu, a 67% tam, gdzie gra pokazuje trawę (ścieżka w1011367932 i ciemny pas przy ścianie kliniki); poprawka: liczyć po górnej nawierzchni w grze; przy okazji odsunąć południową krawędź trawnika-kliniki o ok. 1 m od ściany
- Pakiet właściciela: tools/glitch-scan

### G-676 Uskok 6,2 m między dachem VIVO a dachem garażu
- Status: zgłoszone (12.11, kurator przeglądu G-662; niski priorytet)
- Ważność: S4 · Zasięg: VIVO r5601275 przy ukośnej ścianie NE (x 1106–1120, z 228–240): w grze dach VIVO 17,2 m (jedna wysokość LoD1 dla całej galerii), garaż 11 m; w rzeczywistości uskok < ok. 1 m (garaż jasny na całej szerokości na nalocie 2025-04, uskok 6 m dałby cień ok. 5,8 m; trawnik r11978659 ciągnie się po obu dachach, tarasowy dach „Tarasy Zamkowe”); przy cyplu NW krawędź garażu prawdopodobnie obniża się do ok. 7–8 m
- Pakiet właściciela: tools/osm-import

### G-679 Trzy pary identycznych kawałków nawierzchni placów na Krakowskim
- Status: zgłoszone (12.11, ADR-0078 etap 1)
- Ważność: S4 · Zasięg: tabele `krakowskie.generated.ts`: 3 pary identycznych obrysów placów w krakowskie-1-0, 0-1 i 1-1 (centroidy (56; −46), (−48; 43), (66; 33)), podwójne rysowanie i podwójne samoprzecięcia w `ground-ring-self-cross`; kandydat na kontrolę duplikatów nawierzchni
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-681 Linia środkowa Radziwiłłowskiej 0,2–1,5 m na południe od rzeczywistej
- Status: zgłoszone (12.11, kurator przeglądu #454; niski priorytet)
- Ważność: S4 · Zasięg: Krakowskie, x −88…−20, z ok. 113: w grze 113,0–113,6, w rzeczywistości ok. 113,7 (wschód) i 114,0–114,5 (zachód) według ortofoto 2025-04; linia idzie osią drogi z OSM przesuniętą przez `fitLanes`, nie osią malowania; mniej niż 1/3 pasa; odsyłacz G-655, G-675
- Pakiet właściciela: tools/osm-import

### G-682 Goły teren na nawierzchni wzdłuż Królewskiej
- Status: potwierdzone (12.11, kurator: ortofoto i 2 zrzuty; T-263); dodatkowo 12 próbek `kerb-fill-wide-estimated` (496..500; −202..−201) przy w40052496 (Królewska, `lanes=2`, bez `width`; korekta T-247 obejmuje tylko w66829063); udział ortofoto w pasie przy SE ścianie w66286377 to dach przechylony o 4–5 m, a nie nawierzchnia
- Ważność: S3 · Zasięg: pas ukośny od ok. (478; −195) do (525; −145) i (505..525; −195..−215), 29 kwadratów, 2576 próbek `landuse-bare` (ok. 644 m²); nakładka ortofoto: 340 m² jasna nawierzchnia, 257 m² asfalt, 35 m² zieleń; pasy między jezdnią a chodnikami przy krzywiźnie Królewskiej i placu; kandydat do kroku 1.1 ADR-0077 (goła ziemia z ortofoto, w toku)
- Pakiet właściciela: tools/osm-import

### G-683 Wylot bramy poza osią frontu: Brama Krakowska i Wieża Trynitarska
- Status: potwierdzone dla (463; −94) (12.11, kurator; zrzut `sm00-krakowska-zach`; OSM −0,74 m, gra −1,80 m); poprawka: oś przejazdu łamana jak w OSM (w491869410 i w66264116, po ok. 21°) albo wylot w środku frontu przedbramia; Trynitarska liczona względem obrysu OSM, który LoD2 przesuwa o ok. 4 m (T-264), do potwierdzenia zdjęciem
- Ważność: S4 · Zasięg: `gate-mouth-off-axis` = 3 (cała baza miasta w tej komórce): (463; −94) −1,80 m od środka frontu 7,47 m; (587; −140) −0,81 m z 5,90 m; (588; −154) −4,44 m z 15,84 m (ten może być fałszywy: front obejmuje sąsiednią ścianę); G-136 (Brama Grodzka) zapowiadał pomiar Krakowskiej; najpierw pomiar z OSM i ortofoto
- Pakiet właściciela: packages/sim (`GATE_PASSAGES`), tools/glitch-scan

### G-687 `startOf` wybiera komórkę za cienkim płotem
- Status: zgłoszone (12.11, naprawiacz G-643; także na main)
- Ważność: S4 · Zasięg: szukanie komórki startowej w promieniu 2 (`steering.ts`) bierze komórkę po drugiej stronie płotu; ganger przy płocie podwórka (114,7; 85,3) dostaje drogę „przez” płot
- Pakiet właściciela: packages/sim (systems/ai)

### G-688 Pierwszy krok pościgów i pierwszy krok po wczytaniu budują wszystko naraz
- Status: zgłoszone (12.11, naprawiacz G-643; także na main)
- Ważność: S3 · Zasięg: pierwszy krok pościgu buduje rastry near wszystkich celów naraz (133–187 ms przy 18 pościgach); pierwszy krok po wczytaniu buduje wszystkie trzymane drogi wide od razu (do 1,6 mln komórek); poprawka: ta sama kolejka z budżetem co w G-643 (#455); powiązane z G-645
- Pakiet właściciela: packages/sim (systems/ai)

### G-690 Siedem linii barier z OSM nieobecnych w grze; bramy 4 → 2 w stare-miasto-0-0
- Status: zgłoszone (12.11, naprawiacz G-685; do triage)
- Ważność: S4 · Zasięg: poprawiony raport `tools/orto --all`: w783241007 (płot, 202 m i 93 m w dwóch komórkach), w295849311 (mur, 114 m), w296752323, w292125943, w296750495, w1395539925, w618560965 nie mają barier w danych gry; w stare-miasto-0-0 mapa ma 4 punkty `gate`, gra 2; możliwy glitch importera (#418) albo celowe pominięcie; krakowskie-2-1 (12.11): raport komórki: nierysowana linia bariery w783241007 (płot 202 m); bez nowych id.; stare-miasto-0-1 (12.11): raport komórki: nierysowany płot w783241007, 92,8 m (część w tej komórce); bez nowych id.
- Pakiet właściciela: tools/osm-import

### G-692 Budynek z domyślną wysokością 13,2 m przy kalenicy LoD2 6 m (w67504382)
- Status: zgłoszone (12.11, autor G-639)
- Ważność: S4 · Zasięg: w67504382: wysokość domyślna 13,2 m, LoD2 przy IoU 1,00 daje kalenicę 6 m, LoD1 niedopasowany; żadna kontrola tego nie łapie; propozycja: kontrola wysokości domyślnej wobec LoD2, gdy LoD1 brak
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-693 Lublinianka płaska na 19 m przy okapie LoD2 17,1 m
- Status: zgłoszone (12.11, autor G-639)
- Ważność: S4 · Zasięg: dach głównej bryły w LoD2 ma równo 4,0 m, a reguła dachów z LoD2 (#G-639) bierze dach > 4 m; do decyzji próg ≥ 4 m albo wyjątek
- Pakiet właściciela: tools/osm-import

### G-695 Okap od ulicy z najniższej połaci powłoki LoD2
- Status: zgłoszone (12.11, kurator przeglądu #459)
- Ważność: S3 · Zasięg: reguła dachów z LoD2 (#459) bierze okap jako najniższy punkt powłoki głównej bryły, więc fasada od ulicy wychodzi za nisko: Złota 3 −4,1 m, Lubartowska 23 w66309793 −3,6 m, Rybna 6 w66293219 −2,7 m, Centrum Kultury −1,5 m (skrzydła 12,7 do 15,6 m, środkowy trakt do 18,4 m); poprawka: okap od strony ulicy z `addr:street` (azymut ±50°) albo per część; kontrola `lod2-street-eaves` (baza 3)
- Pakiet właściciela: tools/osm-import, tools/gugik, tools/glitch-scan

### G-696 Dachy LoD2: mansarda jako czterospadowy, pałace z kondygnacjami kamienic, Narutowicza 4 jednym obrysem
- Status: zgłoszone (12.11, kurator przeglądu #459; niski priorytet)
- Ważność: S4 · Zasięg: Pałac Parysów w66330695 ma w LoD2 mansardę (połacie 60° do 15,6 m, 16° do 18,2 m), w grze czterospadowy (`roofType` 1130); pałace bez `building:levels` (Czartoryskich, Parysów, Potockich) dostają kondygnacje po 2,7–3,3 m zamiast 2 wysokich; Narutowicza 4 (WBP): zabytkowe skrzydło od ulicy płasko na 14 m, w rzeczywistości okap ok. 8,5 m i kalenica 12,4 m (jeden obrys OSM, do podziału na części)
- Pakiet właściciela: tools/osm-import

### G-698 Kuria Metropolitalna płasko na 13,1 m: LoD2 dzieli ją na dwa budynki
- Status: zgłoszone (12.11, autor G-639)
- Ważność: S4 · Zasięg: w66293168: LoD2 ma dwa budynki o IoU 0,45 i 0,50 z obrysem OSM, więc reguła dachów z LoD2 (#459, dopasowanie 1:1, IoU ≥ 0,7) jej nie obejmuje; LoD1 2024 ma ją w całości (IoU 0,91), płasko 13,1 m przy LoD2 10,8–15,5 m; poprawka: dopasowanie wielu budynków LoD2 do jednego obrysu (części)
- Pakiet właściciela: tools/osm-import, tools/gugik

### G-699 Podjazd i taras przy Zamku węższe niż w Lublinie: goły teren między pasem drogi a licem (T-265)
- Status: zgłoszone (12.11, kurator, przegląd podzamcze-1-0)
- Ważność: S4 · Zasięg: Podzamcze, Zamek w48500136. Od północy (844..920; 262..273) ok. 382 m² gołego terenu między pasem 4 m drogi w66258158 a licem, a na ortofoto asfaltowy podjazd ok. 10 m z parkowaniem. Od południa (830..920; 202..209) ok. 130 m² przy licu i taras (882..900; 193..200) ok. 89 m², na ortofoto kostka. Zrzuty `pz10d-pn-podjazd`, `pz10d-pd-taras`; podzamcze-2-0 (12.11): `landuse-bare` 865 próbek w x 920..930 (z 160..370) tuż za granicą komórki podzamcze-1-0; niepotwierdzone, że to ciąg pasów przy Zamku z wpisu.; 12.11 (kurator, przegląd paczki): pas (920..975; 183..263) w podzamcze-2-0 jest ciągiem wpisu. Droga w66258158 okrąża wschodni koniec Zamku przy Kaplicy Trójcy, a goły teren między jezdnią a licem i kaplicą przechodzi przez x = 920 bez przerwy (wycinek `topo-paczka/crop/pz20w.png`). Do poprawy przedpola (920..960; 227..262) i (944..959; 195..229), twarde 70% i 97%. Zieleń zbocza na wschód od drogi to T-117 i zostaje. Test przyjęcia uzupełnić o `landuse-bare` w (920..975; 183..263) bez próbek zieleni ortofoto < 100.” Z T-274 i G-713 usunąć zastrzeżenie „niepotwierdzone, że ciąg
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS` albo korekta `width`)
- Test przyjęcia: `landuse-bare` w (844..920; 255..273) 1527 → mniej niż 100, w (830..920; 202..212) i na tarasie 873 → mniej niż 100; zbocze z trawą bez nawierzchni

### G-700 Ganger w `seek` podchodzi do bariery na 0,4 m
- Status: zgłoszone (12.11, z weryfikacji #461)
- Ważność: S4 · Zasięg: czujnik `FEELER` z #461 to linia ze środka ciała bez promienia 0,38 m, więc przy ruchu prawie równoległym do bariery ganger dochodzi do 0,38 m (cienki płot 114.7,85.3, strona -1, g11) i 0,41 m (mur 214,-28); na 503bff0 2,3–2,6 m; wydostaje się, na końcu przebiegu ponad 2 m; poprawka: czujnik jako kapsuła z promieniem ciała (dwie równoległe linie)
- Pakiet właściciela: packages/sim (systems/ai)

### G-701 Przy cienkim płocie i murze ganger dalej stoi, czekając na plan
- Status: zgłoszone (12.11, z weryfikacji #461)
- Ważność: S4 · Zasięg: płot 114.7,85.3 (n12, strona +1) i mur 214,-28 (strona -1): postój 245 i 103 kroki, jak przed #461, bo `FEELER` jest zablokowany z obu stron; reszta G-694; poprawka: przy obu stronach zablokowanych krok wzdłuż bariery albo pierwszeństwo w kolejce
- Pakiet właściciela: packages/sim (systems/ai)

### G-702 Wczytanie przy zaalarmowanym tłumie za płotem rozjeżdża się po ok. 95 krokach
- Status: zgłoszone (12.11, z weryfikacji #461; tak samo na 503bff0)
- Ważność: S4 · Zasięg: tłum 18 zaalarmowany, gracz 6 m za płotem 2359, zapis w trakcie czekania na plan; od kroku ok. 95 pozycje odbiegają od ciągłej gry, do 1,9 m po 300 krokach; powiązane z G-645 (pamięć `chases` poza zapisem)
- Pakiet właściciela: packages/sim (systems/ai), packages/persistence

### G-706 Normalne nawierzchni przyciętej brzegiem mapy czytają teren 0 za brzegiem
- Status: zgłoszone (12.11, z naprawy G-703)
- Ważność: S4 · Zasięg: `groundNormal` drape'a próbkuje ±0,75 m, więc przy brzegu mapy każda nawierzchnia przycięta brzegiem (nie tylko schody) dostaje normalną liczoną z terenem 0 za brzegiem; skutek: złe cieniowanie pasa przy brzegu (nie zmierzone); G-703 (#463) poprawia to tylko dla schodów (`onItsSide` w `steps-plan.ts`); do tego stopnie pasa przyciętego skośnie rysują się na pełnym prostokącie, ok. 1 m za brzegiem, na poprawnej wysokości
- Pakiet właściciela: packages/engine/src/renderer/mapcity (drape)

### G-722 Pamięć wygenerowanego miasta w CI nie trafia
- Status: zgłoszone (12.11, z naprawy G-719 i G-720)
- Ważność: S4 · Zasięg: tylko `venues.test.ts` (przez `test/city.ts`) korzysta z pamięci miasta (ADR-0046); CI nie zachowuje `node_modules/.cache`, a klucz obejmuje całe `packages/{core,sim,engine}/src`, więc nie trafiłby nawet przy zachowaniu; `generatedCity()` woła `generate` bez lod1/lod2, więc test liczy inne miasto niż tabele. Po G-719 test ma zapas (ok. 9 s w CI przy limicie 20 s); do zrobienia przy następnym spowolnieniu importu: węższy klucz i `actions/cache`
- Pakiet właściciela: tools/osm-import (test/city.ts), .github

### G-723 Klasa: ruch aut odłożony (decyzja użytkownika 31.10, „samochody na później”)
- Status: zgłoszone, klasa (12.11, porządki rejestru: 11 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S3 (najwyższa w klasie) · Zasięg: ruch aut i pasy jezdni (zawrotki, ślepe końce, szerokość, dziury, pochylenie aut, hash ruchu)
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-003 (S4) Zawrót na Alei Tysiąclecia zahacza o skraj chodnika przed targiem — lokalny
  - G-022 (S3) Pas aut kończy się przed krótkim łańcuchem tej samej jezdni, który nie dostaje pasa — lokalny (6 miejsc, 8 ślepych końców)
  - G-024 (S3) Jednokierunkowe pasy kończą się przed ulicą dla dostaw (Lubartowska, Kowalska, Świętoduska) — lokalny (6 końców)
  - G-025 (S3) Istniejące zawrotki na Alei Tysiąclecia wychodzą poza nawierzchnię — lokalny, trasa główna
  - G-037 (S3) Pas Andersy kończy się na pasach Mełgiewskiej: auta czekają na siebie
  - G-074 (S3) Ślepe końce pasów po poszerzeniu Krakowskiego (Peowiaków, Kapucyńska, Dolna Panny Marii) — 3 skrzyżowania
  - G-083 (S3) Drogi dla aut bez nazwy i łącznice bez pasów ruchu — 7 dróg bez nazwy + 3 łącznice, ok. 550 m
  - G-092 (S3) Ulice ok. 3–4 m z dwoma pasami: auto zachodzi na chodnik — wąskie ulice dwukierunkowe (po G-082 m.in. Staszica miejscami, Łęczyńska#120)
  - G-093 (S4) Dziura w nawierzchni jezdni Narutowicza — lokalny
  - G-133 (S4) Pojazdy na stromych ulicach bez pochylenia: dolny koniec odstaje od bruku — 8 pojazdów odstaje ponad 0,2 m, najgorzej dostawczak (544.7, 167.7) o 0,44 m
  - G-524 (S4) Złoty hash nie obejmuje ruchu aut — `determinism.test.ts` liczy hash z `snapshot` (zapis), a pojazdów w zapisie nie ma
- Pakiet właściciela: packages/sim (traffic), tools/osm-import (drogi)

### G-724 Klasa: luki kontroli i testów skanu
- Status: zgłoszone, klasa (12.11, porządki rejestru: 8 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S4 (najwyższa w klasie) · Zasięg: kontrola albo test skanu czegoś nie widzi lub jest za wolny; gra bez skutku, ryzyko przeoczenia przyszłych glitchy
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-146 (S4) `onPassageAxes` i skan przejazdów: słabe przy trasie równoległej do osi
  - G-153 (S4) Skan `furniture-overlap` pomija słupki — np. stojak (-137.1, -52.2) z bryłą na słupku (-137.9, -53.1)
  - G-176 (S4) Skan aut przy krawężniku luźniejszy niż generator — `parked-car-multilane-kerb` zwalnia auto w każdym `amenity=parking`, także podziemnym i dachowym, a generator tylko w naziemnych
  - G-223 (S4) Test skanu `market-piece-on-crowd-lane` przekracza 20 s przy load ponad 20 — `tools/glitch-scan`, kontrola `market-piece-on-crowd-lane`
  - G-346 (S4) Kontrola `deck-slot` nie widzi pomostu powyżej zasięgu stopy — `deck-slot` porównuje z `groundY`, a postać stoi na ziemi z `reach` = stopa + `STEP_HEIGHT`
  - G-370 (S4) Skan `metro-shaft-open` nie sprawdza ścian pawilonu powyżej ulicy (szkło nad cokołem) — wszystkie wejścia metra
  - G-657 (S4) Skan `walker-on-car-lane` sprawdza tylko wierzchołki tras — `tools/glitch-scan/test/glitch-scan.test.ts:606–608` bierze `l.points` zamiast próbek co metr, więc długi odcinek trasy blisko pasa ruchu mo
  - G-691 (S4) Zapadka bazy skanu przepuszcza zawyżoną bazę po scaleniu z innej podstawy — `glitch-scan.test.ts` sprawdza tylko „znaleziono ≤ baza”
- Pakiet właściciela: tools/glitch-scan

### G-725 Klasa: reguły importu bez skutku dziś (uśpione)
- Status: zgłoszone, klasa (12.11, porządki rejestru: 2 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S4 (najwyższa w klasie) · Zasięg: reguła importu ma lukę, która dziś nie zmienia miasta; wróci przy poszerzaniu mapy albo nowych danych
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-222 (S4) Reguła wieży z OSM: krawędzie (bok wieży, maszty, wieże różnej wysokości) — `tools/osm-import/src/building-towers.ts:59` mierzy od wierzchołków wieży do ścian kościoła (wieża bokiem bliżej niż 10 m zostanie pominięta
  - G-225 (S4) Reguła drogi pod ziemią (G-197) zdejmuje też nawierzchnię nad tunelem i przejazdy bramne — `tools/osm-import/src/props-doors.ts:234`: odcinek ulicy z chunków pokrywający się w rzucie z drogą pod ziemią przestaje być ulicą
- Pakiet właściciela: tools/osm-import

### G-726 Klasa: goły teren komórek (podwórza, przedpola, szczeliny; ADR-0077)
- Status: zgłoszone, klasa (12.11, porządki rejestru: 12 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S3 (najwyższa w klasie) · Zasięg: ziemia bez nawierzchni tam, gdzie ortofoto ma kostkę lub asfalt; jedna reguła ważności z przeglądu paczki 12.11 (S3 przy ≥ ok. 1000 m² twardej, inaczej S4); poprawka regułami ADR-0077 (krok 1.1 i dalsze), nie ręcznymi obszarami
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-704 (S3) Podwórza Starego Miasta przy Archikatedrze, Dominikanach, Farze i Podwalu to goła ziemia (T-266, T-268) — stare-miasto-1-0, 7 podwórzy, ok. 2500 m² gołego terenu, w tym 1960 m² twardej nawierzchni na ortofoto: (627..666
  - G-705 (S3) Goły teren przy gmachach i sklepach Krakowskiego (krakowskie-1-0): Pedet, Teatr Osterwy, Urszulanki, Narutowic — krakowskie-1-0, `landuse-bare` 6144 próbki (1536 m²), z czego ok. 1300 m² do poprawy. Pedet w67508935 (108..142
  - G-709 (S3) Goły teren w krakowskie-2-0: podwórza, przedpola Dolnej Panny Marii i deptaka, szczeliny przy jezdni i dwa bud — krakowskie-2-0, goły teren 16083 m²: podwórza 14 / 4655 m² (twarde 80%), przedpola 15 / 7101 m² (twarde 88%), szczeliny przy jezdni > 3 m 11
  - G-710 (S3) Goły teren w krakowskie-2-1: przedpola przy fasadach i szczeliny przy jezdni (T-271) — krakowskie-2-1, goły teren 10063 m²: przedpola 13 / 5222 m² (twarde 70%), szczeliny przy jezdni > 3 m 2 / 2780 m² (twarde 66%), podwórza 1 /
  - G-711 (S3) Goły teren w stare-miasto-0-1: podwórza i przedpola przy Rybnej, Lubartowskiej i Kowalskiej (T-272) — stare-miasto-0-1, goły teren 6600 m²: podwórza 7 / 4223 m² (twarde 100%), przedpola 4 / 1344 m² (twarde 100%), szczeliny, obrys LoD2 i inne
  - G-712 (S3) Goły teren w podzamcze-0-0: podwórza, przedpola i szczeliny przy Kowalskiej, Furmańskiej i Alei Tysiąclecia (T — podzamcze-0-0, goły teren 10945 m²: podwórza 10 / 5958 m² (twarde 89%), przedpola 10 / 1620 m² (twarde 79%), szczeliny przy jezdni > 3 m 2 /
  - G-713 (S3) Goły teren w podzamcze-2-0: przedpola i szczeliny przy wschodnim Wzgórzu Zamkowym, Alei Tysiąclecia i VIVO (T- — podzamcze-2-0, goły teren 7147 m²: przedpola 5 / 1263 m² (twarde 77%), szczeliny przy jezdni > 3 m 16 / 2941 m² (twarde 73%), inne 5 / 1166
  - G-714 (S3) Goły teren w podzamcze-2-1: przedpola i szczeliny przy Ruskiej, Podzamczu i Cerkiewnej (T-275) — podzamcze-2-1, goły teren 9543 m²: przedpola 7 / 5009 m² (twarde 39%), szczeliny przy jezdni > 3 m 16 / 1624 m² (twarde 85%), inne 4 / 569 m
  - G-715 (S4) Goły teren w nabrzeze-0-0: szczeliny przy jezdni Mełgiewskiej i bulwaru (T-276) — nabrzeze-0-0, szczeliny przy jezdni > 3 m 3 / 526 m² (twarde 77%)
  - G-716 (S4) Goły teren w nabrzeze-0-1: przedpole DPS "Kalina" i szczeliny przy jezdniach Andersa, Towarowej i Kalinowszczy — nabrzeze-0-1, goły teren 6567 m²: przedpola 2 / 1725 m² (twarde 23%), szczeliny przy jezdni > 3 m 8 / 749 m² (twarde 48%), inne 7 / 908 m²,
  - G-717 (S3) Goły teren w nabrzeze-1-0: przedpola przy fasadach i szczeliny przy jezdniach Łęczyńskiej i Mełgiewskiej (T-27 — nabrzeze-1-0, goły teren 10164 m²: przedpola 9 / 5935 m² (twarde 15%), szczeliny przy jezdni > 3 m 10 / 1958 m² (twarde 65%), inne 2 / 263 m
  - G-718 (S3) Goły teren w nabrzeze-1-1: przedpole przy fasadach i szczeliny przy jezdni Turystycznej (T-279) — nabrzeze-1-1, goły teren 6779 m²: przedpole 1 / 3104 m² (twarde 44%), szczeliny przy jezdni > 3 m 6 / 1913 m² (twarde 60%), inne 1 / 113 m²
- Pakiet właściciela: tools/osm-import (ADR-0077)
- 13.11 krok 1.2 ADR-0077 (gałąź ccr-ec2c4269-ilh8k8-adr77-kerb): szczeliny przy jezdni kładzione z ortofoto, kerb-gap-bare -54%, kerb-strip-bare -64%; zostaje asfalt przy jezdni (etap asfaltu)
- Krok 1.2 ADR-0077 w main (#510, 13.11).
- 13.11 audyt luk SM: SM goły teren 19 218 m², podwórza i przedpola 48 składowych / 12 670 m², goły asfalt 9 720 m². Przyczyna w bare-cover.ts: dropLoose odrzuca regiony o średniej szerokości < FILL.looseWidth 6 m (podwórza 2,2-4,3 m), klasa asfalt niekładziona; landuse-bare ich nie liczy. Proponowana kontrola yard-bare. Kolejność: po G-771.

### G-727 Klasa: odłożone do poszerzania mapy
- Status: zgłoszone, klasa (12.11, porządki rejestru: 2 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S3 (najwyższa w klasie) · Zasięg: sprawy za obecnym brzegiem mapy albo wymagające danych spoza obecnych komórek (decyzja użytkownika 8.11)
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-096 (S3) Narożnik Starego Miasta za brzegiem z = −240 (Pałac Ordynacki, Kuria) — lokalny, 7 budynków, 2 zabytki
  - G-680 (S4) Probostwo 11: przejazd bramowy bez tagu w OSM — w444375185 × w252541795 (`service=driveway`, 12 m w budynku, bez `tunnel`), (468
- Pakiet właściciela: tools/osm-import

### G-728 Klasa: szerokość jezdni i styk jezdnia–chodnik (krawężniki, szczeliny, wypełnienia)
- Status: zgłoszone, klasa (12.11, porządki rejestru: 9 wpisów scalonych, pełne opisy w archiwum)
- Ważność: S3 (najwyższa w klasie) · Zasięg: jezdnia z domyślnej szerokości albo dopasowana do chodnika tylko z jednej strony wchodzi pod chodnik lub zostawia szczelinę; kontrole `sidewalk-under-carriageway`, `footway-on-carriageway`, `kerb-gap-bare`, `kerb-strip-bare`, `kerb-fill-wide-estimated`; przegląd 12.11: footway bez `footway=sidewalk` nie wchodzi do `fitToKerb` (Peowiaków). Poprawka regułą dla całego miasta, nie po jednej ulicy
- Członkowie (pełne opisy w `docs/glitches-archiwum.md`):
  - G-082 (S4) Domyślna szerokość jezdni wycina zmapowane chodniki
  - G-112 (S3) Szerokość jezdni z chodnika przy skrzyżowaniu zwęża całą ulicę — Łęczyńska w85717509, Montażowa w40052079, 566 m
  - G-113 (S3) Dwukierunkowa jezdnia zwężana symetrycznie od chodnika z jednej strony — Podwale w40052391 3,6 m, Staszica w1150131461 4,4 m, w232805965 4,7 m (po G-111 także Łęczyńska i Montażowa, jeśli zostaną dopasowane)
  - G-192 (S4) Uproszczona oś chodnika: auta kilka cm w zmapowanej szerokości — `simplifyLine` 0,5 m w imporcie przesuwa oś chodnika do ok. 0,09 m
  - G-451 (S4) Klin gołego terenu między chodnikiem a jezdnią Kościuszki (T-222) — zachodni krawężnik x 9–17, z −142…−189, ok. 13 m²
  - G-471 (S4) Szczelina przy południowym krawężniku Peowiaków (T-228) — x −44…57, 1134 próbki
  - G-635 (S4) Trzy próbki `kerb-fill-wide-estimated` przy nowych skrawkach chodnika na Podzamczu — (879,5
  - G-671 (S4) Próg 0,5 m² w `chunkGround` gubi małe wycinki wypełnień krawężnikowych na granicach chunków — `tools/osm-import/src/ground.ts` `chunkGround`: wycinki pasm `holed` (wypełnienia chodnika przy krawężniku) poniżej 0,5 m² w chunku są odrzu
  - G-674 (S4) Północny krawężnik Radziwiłłowskiej przy Placu Litewskim przed trawnikiem OSM — w914787972 i w331453920, x −87…−40: goły pas 1–2,8 m między północną krawędzią asfaltu (z 119,1–119,7) a trawnikiem w1011367949
- Pakiet właściciela: tools/osm-import (ground, `fitToKerb`, `kerbFills`)
- 13.11 przegląd ADR-0078 etap 2 (G-744): Podwale w179264852 +7 próbek sidewalk-under-carriageway (750,-180; 690,-210) przyjęte przez GLITCH_BASELINE=accept; przyczyna jak G-082/G-113, goły pas przy elewacji 755..758 do poprawy razem z nimi (T-046).
- 13.11 audyt luk SM: kerb-gap-bare 1 358 próbek (Podwale płd. 307, Królewska 299, Kowalska-Lubartowska 569), kerb-fill-wide-estimated 775, sidewalk-under-carriageway 52, footway-on-carriageway 65; przypisanie ADR-0080 PR 7, szerokości PR 10 po G-771.
- 13.11 G-771: pokrycie SM bez pustych nalotów dodało 92 próbki kerb-gap-bare (szczeliny 0,07-0,2 m przy z -178, x 500..540) i klucze 470,70; 610,-220 Podwale; przyjęte accept
- 14.11 G-771: kerb-strip-bare SM-1-0 610,-220 (Podwale w40052391 610,-213, 3,1 m gołego asfaltu do nowego trawnika) i kerb-gap-bare SM-0-0 530,-180 (szczelina 0,15 m) przyjęte accept

### G-729 Szyld Neon Koi wchodzi na szyld BANK POWSZEDNI
- Status: odłożone za priorytet mapowania i refaktoru (decyzja użytkownika 12.11: „póki co trzymaj obecne priorytety”); zgłoszone (12.11, zgłoszenie użytkownika; przyczyna do potwierdzenia)
- Ważność: S3 (widoczne w głównym miejscu gry, deptak przy klinice, kadr sceny `reference`) · Zasięg: szyld baru Neon Koi i szyld lokalu BANK POWSZEDNI na sąsiednim budynku w66330644 (313,9; −102,1), Krakowskie Przedmieście. Hipoteza: #459 (dachy z LoD2, G-639) podniósł okap w66330644 z 11,5 m (domyślne) na 12,7 m i w opisie PR-a „szyld i górny rząd okien idą w górę”, więc szyld banku wjechał w szyld Neon Koi; do potwierdzenia zrzutem przed/po #459
- Pakiet właściciela: tools/osm-import (szyldy lokali, `venue-names.ts`, rozstawienie szyldów na fasadzie) albo packages/engine (szyldy NPR), zależnie od przyczyny
- Test przyjęcia: kontrola skanu nakładania szyldów sąsiednich fasad (nowy rodzaj, np. `sign-overlap`, baza policzona na main) w tym miejscu 0; zrzut dzienny i nocny z deptaka przed Neon Koi bez nakładania

### G-730 Rekwizyty przed Trybunałem Koronnym stoją w wejściu do budynku
- Status: odłożone po mapowaniu (12.11, zgłoszenie użytkownika; pozycja „Ogródki Rynku przy lokalach” w backlogu)
- Ważność: S3 (zablokowane albo zasłonięte wejście zabytku w środku Rynku) · Zasięg: Rynek, Trybunał Koronny; rekwizyty (stoliki, parasole albo inne meble) postawione na wejściu do budynku; do sprawdzenia, czy kontrola skanu wejść (`door-*`, meble przy drzwiach) to łapie
- Pakiet właściciela: tools/osm-import (rozstawienie rekwizytów, `props-*`)
- Test przyjęcia: brak rekwizytów w strefie wejść Trybunału i innych zabytków Rynku (kontrola skanu dla stref wejść, baza obniżona); zrzut dzienny przed/po

### G-731 NPC stoją w pozie z rękami do góry
- Status: zgłoszone (12.11, zgłoszenie użytkownika); do zrobienia razem z pozycją backlogu „Animacje ruchu” (po mapowaniu, pierwszy priorytet)
- Ważność: S3 (widoczne na każdym kroku, wiele postaci) · Zasięg: domyślna poza części NPC z modelami VRM to ręce do góry, czyli T-/A-poza pliku modelu; przypuszczalnie przeniesienie pozy z riga (`HumanoidRetarget`, ADR-0076, decyzja „ramiona opuszczone zamiast T-pozy pliku”) nie działa albo działa za późno w części przypadków — możliwa regresja; do ustalenia: które postacie, kiedy (wczytanie, podmiana modelu, LOD, poza aktywności)
- Pakiet właściciela: packages/engine (renderer: modele postaci, retarget)
- Test przyjęcia: test renderera, że żadna postać z modelem nie ma w żadnej klatce kąta ramion T-/A-pozy (poza zamierzonymi pozami); zrzut tłumu przed/po

### G-732 NPC w pozie siedzącej idzie, nogi niewidoczne
- Status: zgłoszone (12.11, zgłoszenie użytkownika); do zrobienia razem z pozycją backlogu „Animacje ruchu”
- Ważność: S3 · Zasięg: część NPC z modelami przesuwa się w pozie siedzenia (ADR-0040 aktywności, ADR-0058 etap 8 pozy przy ławkach), a nogi nie są widoczne; przypuszczalnie poza aktywności `sit` zostaje po wyjściu z miejsca siedzenia albo ukrycie nóg pod siedziskiem nie jest zdejmowane przy ruchu; to błąd przełączania stanu (siedzi albo idzie), nie brak klipu
- Pakiet właściciela: packages/engine (`activity-poses.ts`, modele postaci), ewentualnie packages/sim (stan aktywności)
- Test przyjęcia: test sesji, że postać w ruchu (prędkość > 0) nigdy nie ma pozy `sit` ani ukrytych nóg; przejście siad → wstawanie → chód w kolejności; zrzut przed/po

### G-733 Ścieżki z `surface` asfalt, żwir lub grunt rysowane jako jasna kostka (T-282)
- Status: zgłoszone (12.11, kurator, przegląd G-721)
- Ważność: S4 · Zasięg: 55 dróg `footway`/`path` z tagiem `surface=asphalt|gravel|ground|…`, głównie Podzamcze i Nabrzeże (np. w351669238); barwa ziemi z typu drogi, nie z tagu `surface`; poprawka: pole `surface` w danych importu i barwa z mediany ortofoto dla tego `surface`; kontrola `footway-surface-mismatch` (baza 55)
- Pakiet właściciela: tools/osm-import (pole w danych ziemi), packages/engine (`ground-plan.ts`)

### G-736 Teren wystaje nad pomosty wiaduktów i przyczółków (860 próbek `ground-over-deck`)
- Ważność: S4 (szare łaty bez bruku na pomoście, do 0,25 m) · Zasięg: koniec NE wiaduktu Zamkowej (780..790; 190..206), 245 próbek do 0,25 m; przyczółki Mełgiewskiej (G-349), ok. 610 próbek do 0,155 m; kładka podzamcze-2-0, 2 próbki
- Opis: teren pod obrysem pomostu leży wyżej niż pomost + 0,01 m i przebija przez jego nawierzchnię. Kontrola `ground-over-deck` (G-686, runda 2, 253613f) liczy próbki co 0,25 m; baza 860.
- Status: część 1 scalona (13.11, #482); zostaje 397 próbek: Zamkowa NE 230 celowe (T-284), Mełgiewska zachód nad chodnikiem (G-737, T-283), kładka podzamcze-2-0 2 próbki (do sprawdzenia z ortofoto, T-166); wcześniej: w PR #482 (13.11, 4e65501, część 1: `underDecks` dla wszystkich pomostów, `ground-over-deck` 860 → 397: Mełgiewska 613 → 165, Zamkowa NE 245 → 230, kładka 2 → 2; przegląd kuratora ZGODNE Z UWAGAMI, bez blokad; T-283, T-284); reszta: pomost nad tunelem w66258159 (`tunnel-decks.ts`) pod garbem terenu, do poprawy u źródła w imporcie; wcześniej: zgłoszone (13.11, naprawiacz G-686)
- Pakiet właściciela: packages/sim (content/lublin abutments)

### G-750 Biały rękaw postaci w kadrze FPP przepala się w słońcu (1,3–1,6% dolnej połowy kadru)
- Ważność: S4 · Zasięg: widok z pierwszej osoby w dzień, każde ujęcie
- Opis: po G-742 resztę przepalenia ujęć dnia daje rękaw bohaterki; połowa progu 3% z G-721
- Status: zgłoszone (13.11, naprawiacz G-742)
- Pakiet właściciela: packages/engine (materiał postaci, widok FPP)
- Test przyjęcia: `pnpm shots:compare` o 12:00: przepalenie samego rękawa < 0,5% dolnej połowy kadru
- 13.11: rękaw to proceduralny rekwizyt `vm-sleeve` (`cyberIvory`) w `camera-rig.ts`, nie model; poprawka materiałem do czasu rąk z modelu (backlog „Animacje ruchu”)

### G-751 Pasy przeciwne Ruska/Podzamcze nachodzą na siebie (0,3–2 m)
- Ważność: S3 · Zasięg: ok. (1000–1036; 462); ok. 64 kolizje aut na 10 ziaren (sonda G-744)
- Opis: przeciwne pasy leżą 0,3–2 m od siebie, poniżej szerokości aut; reguła G-744 ustępowania nie wystarcza przy stałym nachodzeniu
- Status: zgłoszone (13.11, naprawiacz G-744)
- Pakiet właściciela: packages/sim (content/traffic, pasy)
- Test przyjęcia: sonda ziaren 1–40: 0 kolizji przy Ruskiej; odstęp przeciwnych pasów ≥ szerokość auta + 0,2 m

### G-752 Ciasna: dwa dostawczaki się nie mijają (pasy 2,2–2,5 m od siebie)
- Ważność: S4 · Zasięg: ul. Ciasna; 14 kolizji na 10 ziaren (sonda G-744)
- Opis: jezdnia za wąska na dwa pasy z dostawczakami; potrzebna reguła: ruch jednokierunkowy albo mijanie z ustępowaniem
- Status: zgłoszone (13.11, naprawiacz G-744)
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: sonda ziaren: 0 kolizji na Ciasnej

### G-753 Kolizje aut na przecięciu dróg przy Cerkiewnej (ok. 1098; 273)
- Ważność: S4 · Zasięg: skrzyżowanie ok. (1098; 273)
- Opis: auta zderzają się na przecięciu tras poza regułą G-744 (to nie ruch z naprzeciwka)
- Status: zgłoszone (13.11, naprawiacz G-744)
- Pakiet właściciela: packages/sim (systems/traffic, skrzyżowania)
- Test przyjęcia: sonda ziaren 1–40: 0 kolizji na skrzyżowaniu

### G-769 Ciemny trójkąt ok. 0,2 m w kostce na Krakowskim przy (297; -226) po G-764
- Ważność: S4 · Zasięg: krakowskie, (297; -226); zrzut /dev/shm/g764-reshoot/pair/krakowskie-297-215.png na 6b0ebb7
- Opis: drobna dziura w fills między nowym kawałkiem kostki z canopyHard a sąsiednim kawałkiem; widać ciemne podłoże; zauważone przez kuratora w przeglądzie G-764, potwierdzone ponownym zrzutem
- Status: w PR #532 (14.11); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (14.11); PR po scaleniu #528 i przegenerowaniu; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g769b (f80370a), czeka na przegląd kuratora; wcześniej: zgłoszone (13.11, kurator, przegląd G-764)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: brak dziury w fills przy (297; -226) (sonda 0,1 m), kontrola lawn-leafoff-patch lub fills-gap
- 14.11: #519 (G-764) w main, można naprawiać
- 14.11: tileRings obrysowuje kafel o komórkę dalej i tnie na krawędzi; nowa kontrola fill-gap 130 -> 16; map-ground-golden 171963 -> 171799 (146ff8d4); przyjęte (decyzja nocna: rekomendowane przyjęcie, artefakty pomiaru) +1 ground-strip-gap nabrzeze-1-0 2521,96 (podzbiór gołego pola z main) i +1 kerb-gap-bare nabrzeze-0-0 2442.6,92.9 (próbka na wspólnej krawędzi, 0,4 mm)
- 14.11 przegląd kuratora (f80370a vs ebed0d2): ZGODNE Z UWAGAMI; orto:diff 6,3 m² (trawa +4,8 na green/canopy, kostka +1,3 na paving), teren 0, pomosty 0; odsłonięte 0,44 m² (paski ≤ 3 cm), nakładki fills bez zmian; klucze 2442,6;92,9 i 2521,1;95,9 potwierdzone jako artefakty; po scaleniu z main powtórzyć osm:build, scan:diff, orto:diff

### G-772 Mediany barw z ortofoto liczone z pustego kafla 2024-06/stare-miasto-0-1
- Ważność: S4 · Zasięg: albedo-medians.json (ALBEDO_FLIGHTS 2025-04, 2024-06), stare-miasto-0-1
- Opis: albedo-report.ts nie pomija pustych nalotów (isBlank z G-771), biały kafel wchodzi do median barw; przeliczenie zmienia wygląd
- Status: w PR (14.11, gałąź ccr-ec2c4269-ilh8k8-g772, 9754068); wcześniej: zgłoszone (13.11, naprawiacz G-771)
- Pakiet właściciela: tools/orto
- Test przyjęcia: albedo-report pomija nalot z isBlank; mediany bez kafla 2024-06/SM-0-1
- albedo-medians przeliczone; 2024-06 cobble do trawy 1,586→1,502; 2025-04 bez zmian od poprawki; renderer nie czyta pliku, wygląd bez zmian; plik nie jest pilnowany wobec pokryć (był nieaktualny już na main)

### G-774 Raster cover poszerza trawniki na sąsiedni bruk (wygładzanie 1,5 m) i klasyfikuje zielonkawy bruk jako green
- Ważność: S4 · Zasięg: całe miasto; np. pierścień skweru Podzamcze (1045, 424), pętle w1343050082, w154012559, w515648305
- Opis: THRESHOLDS.smooth=1 rozlewa zieleń o ok. 0,5-0,75 m na bruk; bruk z ExG 0,05/0,03/0,15 (2023-09) przekracza średnią greenExg 0,026. Zawyża fill-on-green i reguły kładące trawę z rastra (G-761 był fałszywym alarmem z tego powodu).
- Status: zgłoszone (13.11, naprawiacz G-761)
- Pakiet właściciela: tools/orto

### G-775 Beżowa kostka i patyna pomnika jako zieleń w komórkach SM z dwoma nalotami
- Ważność: S4 · Zasięg: stare-miasto-0-1 (476..478; 75..81), stare-miasto-0-0 (607..610; -207..-212); klucze 470,70
- Opis: Po G-771 SM-0-0/0-1 mają 2 naloty; beżowa kostka (exg 0,035 w 2025-04) i nalot letni w cieniu albo z przechyłem dają green/canopy; patyna pomnika daje green; bare-cover kładzie trawę na chodniku. Proponowana kontrola: grass-on-light-paving
- Status: przegląd kuratora ZGODNE Z UWAGAMI (14.11); do PR; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g775 (89751b9, merge c1ad6ed), czeka na przegląd kuratora; wcześniej: zgłoszone (13.11, kurator, przegląd G-771)
- Pakiet właściciela: tools/orto (classify.ts)
- Test przyjęcia: narożnik Lubartowska/Noworybna i chodnik Królewskiej przy (608,-210) kostką; klucze 470,70 znikają
- 14.11 G-771 runda 2 (scalenie z regułą koron #519): klucze 470,70 zniknęły; do sprawdzenia, czy zostaje tylko kępa trawy przy pomniku na Królewskiej (607..610; -207..-212)
- 14.11 naprawiacz: reguły patyny i beżowej kostki w cieniu przy jednym nalocie letnim (CLASSIFIER_VERSION 5); raster tylko SM-0-0/0-1, 330 m²; orto:diff 25 m² (trawa -23,6, square +11,1); Królewska trawa 3,6 m² -> square; grass-on-light-paving 61,5 -> 38,25 m² (test z kafli, skipIf bez cache); skan bez zmian kluczy, złote bez zmian; zrzuty /dev/shm/g775-shots/grid.png

### G-779 Łaty G-760 mniejsze niż 0,5 m² odrzucane przez chunkGround
- Ważność: S4 · Zasięg: złącza z małymi łatami w całym mieście
- Opis: chunkGround odrzuca każdy kawałek pod 0,5 m², więc część łat pęknięć i klinów G-760 nie trafia do tabel; ich zachowanie daje ground-strip-overlap +3 klucze, kerb-gap-bare -2
- Status: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: łaty G-760 w tabelach; ground-strip-overlap nie rośnie

### G-780 Goły klin przy końcu jednej jezdni na węźle innej drogi (97,9;98,4)
- Ważność: S4 · Zasięg: 97,2;98,6 (jezdnia/trawa), ok. 0,35 m²; podobne złącza z jednym końcem
- Opis: bit końca odrzucony (dzieli obrys pasa); łata klina nakłada się z wypełnieniem z ortofoto, które nie czyta łat (overlap +1); wypełnienie czytające łaty psuje 2693;432 (gap +1, kerb +1)
- Status: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: brak gołych komórek 0,1 m w tarczy 97,2;98,6; ground-strip-overlap i gap nie rosną

### G-781 Footway i łaty G-760 na obrysie schodów (193 klucze ground-over-steps na main)
- Ważność: S4 · Zasięg: 193 miejsca, m.in. 950;229, Podzamcze 803-829;237-247, Krakowskie 411-421;-86..-90
- Opis: kawałki gruntu z liftem wyższym niż schody (footway 0,09 nad 0,05) zachodzą na obrys steps ponad 0,01 m² i przebijają najniższy stopień
- Status: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g781 (768efbb), czeka na przegląd kuratora; wcześniej: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: ground-over-steps spada; zrzut 1009,6;447,5 bez kostki na stopniach
- chunkGround wycina obrys schodów z gruntu wyższego od nich (steps-cut.ts), narożniki cięcia z dokładnością do mm; ground-over-steps 234 -> 0 (193 klucze -> 0), żaden rodzaj nie rośnie; map-ground-golden 170580 -> 173539 wierzchołków; ubyły drzwi (0,44;-74,64) krakowskie-0-0, ich próg wypadał na stopniach

### G-782 roundJoints: suma NonZero pierścieni zgodnych z ruchem wskazówek zegara w fazie okrągłych końców
- Ważność: S4 · Zasięg: 242 z 2141 pasów ma pierścień zgodny z ruchem wskazówek zegara
- Opis: covered w pierwszej fazie roundJoints sumuje pierścienie bez obracania; obszar zgodny z ruchem wskazówek zegara znosi pasy na nim, bit końca może trafić w fałszywą dziurę
- Status: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: pierścienie obrócone przed sumą; ground-strip-overlap i ground-over-steps nie rosną

### G-783 Dziury fill-gap na krawędziach chunków: obrys wypełnienia nie sięga za chunk
- Ważność: S4 · Zasięg: nabrzeze x=2500 i z=270, podzamcze z=370 (np. 2500,295.25; 2544,269.88; 795.5,369.88)
- Opis: obrys wypełnienia bare-cover kończy się na krawędzi chunka; sąsiedni chunk tnie po swojemu, zostaje goła szczelina
- Status: zgłoszone (14.11, naprawiacz G-769)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: fill-gap bez miejsc na krawędziach chunków

### G-784 Romb gołego terenu w siodle trawnika i kostki
- Ważność: S4 · Zasięg: krakowskie-1-0 (110; -192.5) i podobne w bazie fill-gap
- Opis: oba obrysy (trawnik i kostka) rozwiązują siodło siatki osobno, każdy ścina narożnik, zostaje romb gołego terenu
- Status: zgłoszone (14.11, naprawiacz G-769)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: fill-gap bez rombów w siodłach

### G-785 Trawnik poniżej 1 m² po przycięciu do kafli odrzucony, kostka zostawia dziurę na krawędzi
- Ważność: S4 · Zasięg: krakowskie-2-0 (396.5; -90.25), stare-miasto-1-0 (699.4; -90.9)
- Opis: kawałek trawnika po przycięciu do kafli spada poniżej progu i jest odrzucany, a kostka nie wchodzi w jego miejsce
- Status: zgłoszone (14.11, naprawiacz G-769)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: fill-gap bez dziur po odrzuconych małych kawałkach na krawędzi kafli

### G-787 Patyna, plandeki i szklane dachy jako zieleń w komórkach z dwoma nalotami letnimi
- Ważność: S4 · Zasięg: krakowskie, podzamcze, nabrzeze, stare-miasto-1-x: ok. 2,7 tys. próbek (np. podzamcze 670,540; krakowskie 260,-210)
- Opis: Reguła patyny z G-775 działa tylko przy jednym nalocie letnim; rozszerzona na całe miasto daje przez bare-cover 7 nowych kluczy (bare-on-cover +3, fill-on-green +2, ground-strip-gap +2)
- Status: zgłoszone (14.11, naprawiacz G-775)
- Pakiet właściciela: tools/orto (classify.ts) + tools/osm-import (bare-cover)
- Test przyjęcia: grass-on-light-paving poniżej 20 m², bez nowych kluczy

### G-788 Przedpole kościoła św. Piotra: trawa i goły teren zamiast kostki pod przechyloną patyną dachu
- Ważność: S4 · Zasięg: Stare Miasto, (470..480; -200..-190)
- Opis: Po G-775 zostaje trawa 9 m² (2 kawałki) i goły teren ok. 14 m² na przedpolu kościoła św. Piotra (OSM w66335226) obok przystanku Brama Krakowska 02. Ortofoto 2024-06: kostka placu w cieniu; 2025-04: przechylony dach z patyną daje klasę asphalt/green; bare-cover zostawia asphalt gołym. Oczekiwane: square. Topografia: T-291. Zastępuje G-786.
- Status: zgłoszone (14.11, kurator, przegląd G-775)
- Pakiet właściciela: tools/orto, tools/osm-import

### G-789 Powtórzone identyczne kawałki placu w tabelach
- Ważność: S4 · Zasięg: krakowskie-0-1 (plac -5;-5, kawałki #141 i #143), krakowskie-0-0 3;-73, krakowskie-1-1 112;58 i 115;45, podzamcze-1-0 885;218
- Opis: ten sam obrys square dwa razy w ground jednego chunku; podwaja klucze skanu i rysowanie
- Status: zgłoszone (14.11, naprawiacz G-781)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: żaden chunk nie ma dwóch identycznych kawałków gruntu

### G-790 Ciemny trójkąt i wyszczerbiony róg u podstawy biegu schodów (1009; 446..450)
- Ważność: S4 · Zasięg: Podzamcze (1009; 446) trójkąt, (1009; 450) schodkowy lewy dolny róg biegu
- Opis: widoczne przed i po G-781; róg wygląda na kształt kawałka steps (flightStrips), trójkąt przyczyna nieustalona
- Status: zgłoszone (14.11, naprawiacz G-781), do łowcy
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: zrzut 1009,6;447,5 bez ciemnego trójkąta i ze zwartym rogiem biegu

### G-132 Smoke „quicksave/quickload” flaky pod obciążeniem (także na main)
- Status: zgłoszone (weryfikator ADR-0057, 1.11)
- Ważność: S3 (test, nie gra); priorytet średni, bo czerwony CI kosztuje cykl
- Gdzie: `e2e/smoke.spec.ts`, test quicksave/quickload; przy load ponad 15 F5 albo F9 trafia na stronę zablokowaną długim zadaniem (Press F5 8,8 s, poll 30 s na „Game saved”)
- Pomiar: na `feat/loading-screen` 2/5 czerwone przy load 20–26, 4/4 zielone przy 7–15; na origin/main 1/4 czerwone (F9)
- Pakiet właściciela: e2e (QA), możliwa przyczyna w app (synchroniczne zadania po klawiszu)
- Test przyjęcia: ślad z długimi zadaniami przed i po; bez podnoszenia limitu czasu (ADR-0046)

## Naprawione
| ID | Glitch | PR |
|---|---|---|
| G-100 | Plamy blasku przez ściany (warstwa glow bez przesłon), odbicia ignorujące wysokość | #19 |
| G-101 | Spód dachów czterospadowych w dali | #20 |
| G-102 | Myjnia na placu przed ratuszem; wieża Trynitarska jako zwykła kamienica; brzegi fontann; ruch bez ustępowania na skrzyżowaniach | #21 |
| G-103 | Piesi z placów na jezdniach; zebry niewidoczne pod brukiem | #22 |
| G-104 | Jezdnia pod placami i chodnikami; brak oznakowania poziomego | #23 |
| G-105 | Ulice jednokierunkowe jeżdżone w obie strony | #24 |
| G-106 | Auta przez hale targu; zderzenia przy wjeździe na rondo Dmowskiego | #25 |
| G-107 | Sygnalizatory, automaty i drzewa na jezdni; stragany na pasach parkingu | #26 |
| G-108 | Dostawczaki przez ściany Rybnej i Ku Farze (bramy z OSM); piesi deptaków zawracający na ulicy | #27 |
| G-109 | Stragany i szafki bez bryły; rzeźby w ścianach; jezdnia mostów w korycie Bystrzycy | #28 |
| G-110 | Wrak, furgonetka i kontener zapadnięte w zbocze | #29 |
| G-001 | Test migawki NPR przekracza 90 s na wolnym runnerze CI | #39 |
| G-002 | Dostawczak jedzie przez bramę Ku Farze z zakazem wjazdu | #44 |
| G-008 | Budynki z OSM wchodzą w sceny targu i doków | #33 |
| G-009 | Auta zaparkowane przy krawężniku stoją na trawniku i chodniku | #31 |
| G-010 | Brama przy północnej krawędzi mapy kończy się w pustce, posadzka wznosi się o 2,4 m | #31 |
| G-011 | Meble wewnątrz budynków: reflektory w Wieży Trynitarskiej, Archikatedrze i przy Zamku, kioski w swoich budynkach, wiata w ścianie | #32 |
| G-012 | Meble z bryłą nachodzą na siebie: kosze w pniach drzew na deptaku | #35 |
| G-013 | Narzędzie zrzutów: kadr przesunięty o jedno miejsce albo powtórzony | #37 |
| G-014 | Auta zaparkowane na przejściach dla pieszych | #32 |
| G-015 | Auta zaparkowane tyłem do ruchu na ulicach jednokierunkowych | #34 |
| G-017 | Wiaty przystanków z OSM jako trzypiętrowe bloki mieszkalne na Alei Tysiąclecia | #34 |
| G-019 | Auto z jednokierunkowej pętli Cerkiewnej stoi na trzypasmowej jezdni Alei Tysiąclecia | #36 |
| G-020 | Jezdnia zachodnia Alei Tysiąclecia ma 36 m bez pasa (literówka „Aleje” w OSM) | #38 |
| G-021 | Szwy chunków ucinają krótkie kawałki ulic: dziury w pasach aut (Narutowicza, Lubartowska ×2) | #40 |
| G-023 | Pasy aut kończą się bez zawrotki przy ulicach dla dostaw i na końcach ulic | #37 |
| G-028 | Resynchronizacja przenosi auto w łuk zawrotki z pełną prędkością | #38 |
| G-029 | Kliknięcie „Nowa gra” w `models.spec.ts` wisi ponad 60 s na CI | #46 |
| G-032 | Słupki przy ulicach stoją chaotycznie: łańcuchy celują w różne strony i nie łączą sąsiadów; słupki za małe | #45 |
| G-033 | Postać, która przechodzi w inne miejsce według flag, „umiera”: renderer gra upadek | #46 |
| G-034 | Kaito od początku w Neon Koi (decyzja użytkownika) | #46 |
| G-035 | Wskaźniki zadań nie prowadzą do postaci z wątku: nie da się znaleźć babci Ume | #43 |
| G-039 | Łańcuch słupków przechodzi przez podstawę latarni na Placu Łokietka | #45 |
| G-018 | Pionowy pas czarnych kresek na bruku Placu Litewskiego | #47 |
| G-030 | Poza Seki w klatce referencyjnej zależy od czasu zegarowego | #47 |
| G-044 | Tłum i pozy czynności animują się zegarem ściennym także w klatce referencyjnej | #47 |
| G-045 | Test `far-city.test.ts` przekracza 5 s pod obciążeniem | #47 |
| G-047 | Karta skanu hackowania nie zmienia języka do zmiany celu | #47 |
| G-006 | Skręty aut na skrzyżowaniach | #47 |
| G-046 | Smoke M0: kierunek ruchu po `freeze` zależy od chwili zamrożenia | #49 |
| G-048 | Prawdziwy tap tuż po przycisku pada ginie jako „ghost click” | #48 |
| G-004 | Kandelabr na krawędzi pasa aut na Placu Zamkowym | #51 |
| G-038 | `lane-dead-end` nie sprawdza użycia początku, który „spotyka” koniec | #51 |
| G-031 | Testy TPP w `npr-perf` i smoke save/load przekraczają limit przy obciążeniu | #57 |
| G-049 | Zabytki bez wież i hełmów: import pomijał `building:part` | #65 |
| G-054 | `glitch-shots` mógł zapisać klatkę sprzed ułożenia miasta | #62 |
| G-057 | Proceduralne wieże obok wieżyczek z OSM (Archikatedra, Dominikanie) | #69 |
| G-050 | Nadbudowa przy Bramie Grodzkiej góruje nad bramą (piętra odsunięte ≥ 5 m) | #60 |
| G-062 | Przejścia pod mostami zablokowane (Podwale, bulwar Bystrzycy) | #70 |
| G-068 | AI nie widziało przejścia pod mostem | #71 |
| G-064 | Targowiska bez straganów | #76 |
| G-051 | Podpis muzeum na kamienicy Jezuicka 3 zamiast na Bramie Krakowskiej | #75 |
| G-067 | Klasztor Dominikanów z proceduralnymi wieżami kościoła | #72 |
| G-056 | Kształt dachu z OSM (`roof:shape`) ignorowany: hełmy, kopuły i dachy dwuspadowe jako czterospadowe | #78 |
| G-061 | Część `building:part` bez obrysu `building` nie trafia do gry (pawilon Bona) | #74 |
| G-076 | Przejazdy bramne z `tunnel=yes` zamknięte bryłą (Gruella pod Trynitarską, Królewska, Sąd Okręgowy, Rynek 5) | #80 |
| G-077 | Budynek podziemny zbudowany na powierzchni ul. Zamkowej | #80 |
| G-058 | Dotknięcie pierwszego wyboru tuż po otwarciu dialogu czasem ginie (e2e touch) | #50 |
| G-075 | Kolizje aut na przecięciu pasów 3 Maja przy Zesłańców Sybiru | #85 |
| G-089 | Bramy z maxheight=below_default ze sklepieniem 4 m | #89 |
| G-090 | Przesunięcie pasa ruchu z mediany szerokości całego łańcucha ulicy | #88 |
| G-052 | Teatr Osterwy i Kościół Bernardynów poza danymi miasta (brzeg Krakowskiego na z = −200) | #87 |
| G-094 | Przedsionek Trasy Podziemnej: pierwsze 4,5 m poza obszarem wnętrza | #90 |
| G-125 | Ekranu opcji nie da się przewijać na telefonie | #94 |
| G-087 | `stepRamps` tylko dla nazwanych schodów | #97 |
| G-127 | Parterowy pawilon jako czterokondygnacyjna wieża (Bar Centralny przed Pedetem) | #103 |
| G-097 | Teatr Osterwy jako kamienica mieszkalna | #104 |
| G-116 | Ułamkowe `building:levels` zaokrąglane w górę (Ratusz o 1,6 m za wysoki) | #104 |
| G-120 | Urzędy z `office=government` w tagach obrysu jako kamienice z nadbudową | #104 |
| G-130 | Pojazdy zapadnięte pod nawierzchnię (wrak na deptaku przy Pedecie) | #107 |
| G-140 | Zaparkowane auta na wjazdach i wylotach dróg serwisowych (Cerkiewna) | #110 |
| G-114 | npr-perf Nabrzeże: czasem +98 wywołań rysowania przy tych samych siatkach | #113 |
| G-139 | Smoke „title → new game”: gracz przechodzi 2,09 m przy szybkim starcie (skok kursora jako obrót) | #112 |
| G-141 | Obezwładnienie: telefon świadka kończy się w trakcie chwytu; wyjątek pomocnika bez testu | #114 |
| G-138 | Pasy ruchu na krawędziach mapy bez nawierzchni | #115 |
| G-135 | Pointer lock wyłączony na stałe po odmowie bez gestu (Esc przed pierwszym kliknięciem) | #116 |
| G-136 | Przejazd Bramy Grodzkiej poza osią frontów | #117 |
| G-131 | Etap 1 obezwładnienia: klawisz interakcji, ogłuszony „w walce”, strzał po zabiciu | #100 |

## Odrzucone
- G-005 Wiata przystanku wchodzi w ścianę przy Alei Tysiąclecia: duplikat (G-011)
- G-040 Śmierć babci Ume blokuje krok ren_trail: odrzucone (Ume nie ma `health` w `district-m0.ts`, a NPC bez niego nie da się zranić ani zabić, `builders.ts:77`; krok nie może się zablokować)
- Biała iglica i kreski nad rondem Dmowskiego: megawieże tła horyzontu (`far-city.ts`), celowe.
- Krzewy przy schodach w Podzamczu, rzeźba w fontannie (1078, 175): tak jest w danych OSM.
- Nakładka 26 m² budynków w69916021 i w1382552285: dane OSM, niewidoczna.
- Czarny kadr w dokach (2555, 420): teleport testu do wnętrza bryły.

## Mapa pokrycia
| Obszar / rodzaj | Ostatnio | Czym |
|---|---|---|
| Trasy aut: nawierzchnia, budynki, mosty | 2026-10-30 | skan |
| Trasy pieszych na pasach aut | 2026-10-30 | skan |
| Meble: pasy, ściany, woda, tory | 2026-10-30 | skan, pomiar |
| Auta zaparkowane: meble, trasy pieszych | 2026-10-30 | skan, pomiar |
| Rekwizyty gry i NPC: wysokość | 2026-10-30 | skan, pomiar |
| Budynki: nakładanie | 2026-10-30 | pomiar |
| Zrzuty: 3 Maja, Lubartowska, Dmowskiego, Plac Zamkowy, Mełgiewska, Plac Litewski, Rynek, Grodzka, Plac Wolności, Łokietka, Królewska, Bazar, mosty Bystrzycy | 2026-10-30 | zrzuty |
| Podzamcze i Nabrzeże (łowca): trasy przez bloki scen, pomosty, wysokości aktorów, Nowy Plac Targowy, latarnie nad Bystrzycą | 2026-10-30 | pomiar, zrzuty |
| Krakowskie i Stare Miasto (łowca): 15 bram przechodnich w obie strony, tłum względem budynków i mebli, kable kanionu, podstawy budynków, Narutowicza, Radziwiłłowska, Plac po Farze, Plac Katedralny | 2026-10-30 | pomiar, zrzuty |
| Sieć pasów aut: ślepe końce, szwy chunków, krótkie łańcuchy, łącznice bez nazwy (łowca) | 2026-10-30 | pomiar, skan `lane-dead-end`, `street-seam-gap`, `car-road-hole` |
| Ruch w czasie: korki, skoki pozycji, kolizje przy skrzyżowaniach (weryfikatorzy G-006) | 2026-10-30 | symulacja-sonda, test `traffic-junction-drive` |
| Słupki i łańcuchy w całym mieście (G-032) | 2026-10-30 | skan `bollard-chain-*`, zrzuty |
| Postacie wątku i wskaźniki zadań (G-035) | 2026-10-30 | test sesji |
| Wnętrza (klinika, Neon Koi, Tessen, Trasa Podziemna): spójność pomieszczeń, NPC w środku 240 s, obszary na progu, zrzuty FPP (łowca) | 2026-10-31 | pomiar kolizji, symulacja, zrzuty |
| Zamek i Podzamcze wokół (Plac Zamkowy, brama, Dziedziniec, Donżon, Kaplica): dostępność pieszo, szew chunków x = 920 (zapas ok. 5 m przy `loadRadius` 30), nakładanie brył (łowca) | 2026-10-31 | pomiar, zrzuty |
| Ekran ładowania (ADR-0057, weryfikator): etapy i postęp, wiszące pobranie, zapis w trakcie, układ na telefonie, smoke pod obciążeniem | 2026-11-01 | testy sesji, sondy, e2e |
| Nieoglądane: wnętrza w TPP w ciasnym pokoju, zapis i wczytanie w środku, 60 s przerwy autozapisu, schody na wzgórze zamkowe, latarnie i AI na zboczu, Ruska (zrzuty), Kalinowszczyzna, noc i deszcz z bliska, telefon, ekran tytułowy | - | - |
