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
- Status: w PR #622; wcześniej: zgłoszone (z weryfikacji G-062)
- Ważność: S3 (proponowana; po G-062 da się stanąć pod mostem i strzelać przez pomost w obie strony) · Koszt: średni
- Dowód: ADR-0053 traktuje pomost jako podłogę dla ruchu, nie jako przesłonę dla strzałów i widoczności
- Pakiet właściciela: packages/sim (walka, linia widzenia)
- Test przyjęcia: strzał z pomostu do celu pod nim (i odwrotnie) trafia w pomost; świadek pod mostem nie widzi gracza na pomoście
- Przyczyna: GroundField.rayHit liczył tylko teren. Poprawka: rayDecks w deck.ts (płyta od powierzchni do spodu), w rayGeometry i lineOfSight. Test deck-cover.test.ts: 4/7 pada bez poprawki, 7/7 z nią. Hash determinism bez zmian.

### G-072 Walczący na pomoście nie schodzi pod most do gracza stojącego pod nim
- Status: naprawiony (main 16.11, #627); wcześniej: w PR #627; wcześniej: zgłoszone (z naprawy G-068)
- Ważność: S4 (proponowana) · Zasięg: pomosty z przejściem pod spodem · Koszt: średni (nawigacja między poziomami)
- Dowód: po G-062 `heightApart` daje 0 dla gracza pod mostem i walczącego na pomoście nad nim; walczący idzie do punktu nad graczem i stoi tam na pomoście, nie szuka zejścia
- Dodatkowo (weryfikacja G-068): pod wiaduktem Zamkowej zaalarmowany walczący idący Podwalem z lewej strony osi (chunk `stare-miasto-1-1`, 12–20 m od osi) utyka w (749.5–750.6, 180.4–181.4), także przed G-068
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: zaalarmowany walczący na pomoście Mełgiewskiej dociera do gracza pod mostem przez zejście w < 20 s
- Poprawka: zejście z pomostu przez landing (deck-landing.ts) + pastLedge/ontoDeck; deck-descent.test.ts i 3 przypadki w under-deck-ai.test.ts padają bez poprawki; hashe bez zmian. Część 'Dodatkowo' (Podwale 749.5–750.6, 180.4–181.4) niesprawdzona.

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
- 14.11: zakres poszerzony o dziedzińce Centrum Kultury r1071050 i Szkoły Urszulanek r14476826 (T-042). Test przyjęcia obejmuje też 4 drzewa z OSM (n7261650288…90, n9992771464), które mają wrócić do gry po otwarciu dziedzińców, czyli spadek osm-furniture-missing o 4.

### G-080 Dach dwuspadowy i pulpitowy liczony od prostokąta całego obrysu
- Status: zgłoszone (weryfikacja ADR-0064 etap 1, PR #78) · Ważność: S4 · Koszt: średni
- Gdzie: budynki wieloskrzydłowe: Zamek w48500136 (jedna połać nad wszystkimi skrzydłami), w232362886, r18246400
- Pakiet właściciela: packages/engine (`mapcity/roof-shapes.ts`)
- Test przyjęcia: osobna kalenica lub połać na każde skrzydło obrysu wklęsłego
- 15.11 G-841: Zamek w48500136 ma przepis z attyką, który chowa dach; reguła ogólna dla budynków wieloskrzydłowych dalej otwarta

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
- 14.11 audyt ADR-0077: przyczyna szersza: osm:props czyta statyczny plan, nie wyciągi; poprawka: data/osm/points/furniture.json z osm:fetch i kontrola osm-furniture-missing (baza 72: 70 w pasie, 2 słupki poza nim)
- 14.11 gałąź ccr-ec2c4269-ilh8k8-furniture-osm: furniture.json z osm:fetch, grupy osm.furniture.*; pas z < −200: +28 drzew, +28 słupków, +4 ławki i inne; osm-furniture-missing 97 -> 33 (w pasie 69 -> 5; reszta to 28 węzłów planu odrzuconych przy rozstawieniu); przegląd kuratora w toku
- 14.11: meble i drzewa w pasie z < −200 przyszły z wyciągu OSM (gałąź furniture-osm, przegląd kuratora ZGODNE Z UWAGAMI). Do zrobienia zostają latarnie, obeliski n481952883 i n7788786232 oraz tablice n11407618262 i n13589357167.

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

### G-118 Kolory z OSM (`building:colour`, `roof:colour`) pomijane na zabytkach
- Status: zgłoszone (audyt gmachów publicznych, kurator 31.10)
- Ważność: S4 (proponowana) · Zasięg: 25 budynków gry z kolorami w OSM, wszystkie to zabytki albo ich części · Koszt: średni
- Gdzie: Ratusz (żółty tynk, czerwony dach, zielona wieża) i Trybunał (beżowy, zielony dach blaszany) jako szare tynki i grafitowe dachy; T-066
- Dowód: `facade-style.ts`: dla `civic` tynk z `CIVIC_PLASTER` i dach zawsze z `ROOFS_METAL`; import nie przenosi tagów koloru do `LublinBuildingData`
- Pakiet właściciela: tools/osm-import (pole koloru w widoku) i packages/engine (mapcity/facade-style); kontrakt widoku `building`, więc dopisek do ADR-0064
- Test przyjęcia: zabytek z `roof:colour=green|red` dostaje dach z odpowiedniej rodziny palety (miedź, dachówka), a z `building:colour` najbliższy tynk palety; kontrola `landmark-colour-ignored` 25 → 0

### G-119 Ratusz i Trybunał bez przepisu zabytku (fasada jak każdy gmach)
- Status: częściowo naprawione w #571; drobne różnice S4 do zbiorczego przeglądu; wcześniej: w PR #571 (przegląd kuratora runda 2: ZGODNE); wcześniej: w poprawce, runda 2 (PR #571: portyk wielkiego porządku, wieża według NMPT/LOD2); wcześniej: w przepisie (gałąź ccr-ec2c4269-ilh8k8-g119); wcześniej: zgłoszone (audyt gmachów publicznych, kurator 31.10); to praca ADR-0062 etap 4
- Ważność: S3 (proponowana; dwa główne punkty orientacyjne, zgłoszenie użytkownika „trzeba poprawić urząd miasta”) · Zasięg: szeroki (Plac Łokietka, Rynek) · Koszt: duży
- Gdzie: Ratusz w66264120 z częściami w619138853 i w619138854; Trybunał w66264159; T-064, T-065, T-067
- Dowód: zrzuty `ratusz-s`, `ratusz-wide`, `ratusz-ne` i `trybunal-wide` (scratchpad kuratora): Ratusz wygląda jak biurowiec z siatką 5 rzędów okien i bez wejścia, a jego wieża jest grafitowym słupkiem nad połacią
- Przyczyna: brak przepisu w `landmarks/recipes.ts`; plan fasad dla `civic` (ADR-0051)
- Pakiet właściciela: packages/engine (mapcity/landmarks)
- Test przyjęcia: przepis Ratusza: ryzalit w osi fasady południowej z wejściem głównym, wieża z OSM z tarczą zegara (do potwierdzenia zdjęciem), kondygnacje w rytmie fasady klasycystycznej, kolory z T-066, warstwa 2077 bez nadbudowy (podpis, światło na gzymsach). Przepis Trybunału: wieżyczka zegarowa na kalenicy, jeśli potwierdzi ją zdjęcie. Przegląd kuratora ze zdjęciem; migawka NPR obejrzana
- Kurator 15.11 (zdjęcia użytkownika: Lublin360 2017, GSV 2025; przegląd modelu na main 6e7ea41, bez przepisu w landmarks/recipes.ts): w grze ryzalit w619138853 to gładki prostopadłościan pod połacią (G-117), fasada civic z równą siatką wysokich okien i gzymsami (facade-style), drzwi (415,1; −85,0), 3 biegi po 9 stopni w1095048695–97, kolor #ffff00 jako blady żółty z palety, brak masztu na dachu. W Lublinie, do przepisu: portyk na całą szerokość ryzalitu z 4 kolumnami o gładkich trzonach (głowice jońskie wg użytkownika; na zdjęciach słabo widoczne) na cokole, belkowanie z balkonem z tralkową balustradą na piętrze (nie trójkątny fronton; nad ryzalitem attyka); szerokie schody przed portykiem na jego szerokość (ok. 8–9 stopni, donice po bokach); parter skrzydeł z boniowaniem pasowym i prostokątnymi oknami, piętro z oknami zamkniętymi półkoliście w płycinach łukowych, wyższe piętro z prostokątnymi oknami z naczółkami; tynk piaskowy (jasna ochra) z jaśniejszymi, kremowymi detalami; maszt z flagą na osi ryzalitu; tablice pamiątkowe na lewym skrzydle. Wieża z OSM w619138854 i zegar nie są widoczne na tych zdjęciach: tarczę od strony Bramy Krakowskiej (wschód) potwierdzić zdjęciem przed przepisem. T-067
- 15.11 zdjęcie użytkownika (Street View 05.2025, narożnik od Placu Łokietka): wieża wyrasta z osi ryzalitu nad portykiem, dolna kondygnacja w kolorze elewacji z zegarem, wyżej kwadratowa z pilastrami, zielony hełm z latarnią i iglicą; trzy flagi nad balkonem; skrzydła z oknami półkolistymi w płycinach i niskim czerwonym dachem. W przepisie (gałąź ccr-ec2c4269-ilh8k8-g119).
- Poprawka użytkownika 15.11: flag nad balkonem jest pięć, nie trzy.
- Przepis ratusza w PR #571 (c768d2f): portyk z kolizją, balkon, 5 flag, fasada pałacowa, wieża z zegarem i hełmem 5 m (OSM bez roof:height), dach 3,5 m (G-117). W przeglądzie kuratora.
- Kurator 15.11, przegląd c768d2f: NIEZGODNE (T-067). P1 portyk wielkiego porządku: kolumny przez parter i I piętro, balkon przed oknami II piętra na ok. 10 m (NMPT 9,6–11,0 m, flagi do 15,2 m; Lublin360 2017: głowice na wysokości łuków okien I piętra); dziś balkon na gzymsie parteru ok. 5,8 m, COLUMN_TOP 6 w porticoes.ts do podniesienia razem z asercją w lublin-vertical.test.ts. P2 wieża: korpus 25 → ok. 30,5 m (NMPT 29,6–31,8), szczyt 30,1 → ok. 38 m (NMPT 38,2, LOD2 37,7), kondygnacja z zegarem ok. 4 m, miedziana ok. 6 m, hełm z latarnią i iglicą ok. 7,5 m; wysokości z danych GUGiK (korekta importu dla w619138854), hełm 5 m overGuess wtedy zbędny. Przyjęte: dach skrzydeł 3,5 m (G-117), blok ryzalitu, cofnięcie 1,5 m jak OSM, drzwi przepisu, 4 kolumny, 5 flag, zegar, okna.
- 15.11 kurator, przegląd rundy 2 (ecc0696, T-067): ZGODNE, P1 i P2 przyjęte (balkon 10,3 m, maszty 15,5 m, wieża 30,5/38,1 m wobec NMPT 29,6–31,8/38,2 m). Niekrytyczne, do osobnej drobnej poprawki (S4): zwieńczenie wieży jako kwadratowa miedziana latarnia z niską piramidką, kulą i wiatrowskazem zamiast dzwonu i okrągłej latarni; na kondygnacji miedzianej okno półkoliste i okrągła tarcza zamiast szczeliny (GSV 2025, fc71f17e)
- Scalone w #571 (15.11). Zostają drobne różnice S4: zwieńczenie wieży (kwadratowa latarnia, piramidka, kula, wiatrowskaz), okno półkoliste kondygnacji miedzianej, stopnie schodów, głowice jońskie, tablice pamiątkowe.
- 15.11 przegląd S4: resztki po #571 (zwieńczenie wieży, okno półkoliste, stopnie, głowice jońskie, tablice) to praca przepisu zabytku w engine (landmarks) ze zrzutami i przeglądem zdjęć; koszt średni, poza partią S4 (wygląd zabytku, nie drobny glitch mapy).

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
- Klucze skanu: kerb-strip-no-car-street stare-miasto-0-1 572,155; kerb-strip-no-car-street stare-miasto-0-1 556,74; bay-strip-empty-known krakowskie-2-1 375,2; bay-strip-empty-known podzamcze-0-0 536,175; bay-strip-empty-known podzamcze-2-1 950,466; bay-strip-empty-known nabrzeze-1-0 2649,76
- Ważność: S4 · Zasięg: w232362980 (Kowalska, lane, 2,2 m: spadek, nawierzchnia, wyjście poza obrys), w232362991 (Kowalska, diagonal, 3,4–3,9 m: za płytki na skos z tagu, 8 z 12 zatok bez modelu), w356947938 (najbliższa droga z ruchem 75 m dalej), w1159135271 (Łęczyńska, perpendicular, 3,4 m: za płytki na układ prostopadły), w1514058885 (Świętoduska, parallel, 2,45 m: 18 zatok na spadku, G-133); krakowskie-2-1 (12.11): `bay-strip-empty-known` w1514058885 Świętoduska (375; 2): pas postojowy bez aut na spadku ponad LEVEL_DROP (G-133).; stare-miasto-0-1 (12.11): `kerb-strip-no-car-street` 2 trafienia: parking w232362978 (572; 155) 54,5 m i w895572841 (556; 74) 23,5 m, oba przy ulicy dla dostaw bez aut; ta sama klasa co T-107.; podzamcze-0-0 (12.11): `bay-strip-empty-known` w232362991 Kowalska (536; 175): skos 3,4..3,9 m za płytki na auta pod 60° (G-133); ten sam pas, który wpis już wymienia.; podzamcze-2-1 (12.11): `bay-strip-empty-known` w1517184173 Ruska, północny krawężnik (950; 466): wszystkie zatoki na spadku > `LEVEL_DROP` (G-133); ten sam pas, który G-133 już wymienia.; nabrzeze-1-0 (12.11): `bay-strip-empty-known` w1159135271 Łęczyńska (2649; 76), pas prostopadły 3,4 m za płytki dla auta; znane.
- Poprawka: płytki pas z tagiem `diagonal`/`perpendicular` → mniejszy kąt albo krótszy model; spadek przez G-133 (pochylenie aut); `bay-strip-sparse` dziś pomija pasy bez auta
- Kurator #162: także odcinek Kowalskiej w232362980 x 644..668 bez zatok, bo ulica ma `use: deliveries`, a `bayCars` bierze tylko `CAR_STREETS` (T-107); zatoka w1544340690 s=24,8 (689,2; 171,8) odrzucona przez odstęp od chodnika w173566578, a na ortofoto stoi tam auto. Proponowane kontrole: `kerb-strip-no-car-street` (baza ≥ 1) i `bay-strip-sparse` także dla pasów bez aut (baza ≥ 5)
- Pakiet właściciela: packages/sim (kerb-bays), tools/glitch-scan
- 15.11 przegląd S4: Świętoduska w1514058888/89/90 (G-813) to ten sam spadek ponad LEVEL_DROP co w1514058885; dopisane do EMPTY_STRIPS_KNOWN (6bab190, gałąź ccr-ec2c4269-ilh8k8-s4-batch-1).

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
- 14.11 audyt ADR-0077: skarpy x 830..1010, z 140..300: 6500 m² korony z ortofoto, 2 drzewa w grze, pokrycie 3%; część zgłoszenia o drzewach z danych w całym mieście (G-nowy, krok 5)

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
- Po G-781 odsłonięte płaskie biegi Ratusza od Pl. Łokietka w1095048695/w1095048696 (step_count 9, ok. 1,4 m) w krakowskie-2-0 (411..421; -86..-90): szare płyty bez stopni 4 cm pod chodnikiem

### G-230 Mikrozdarzenie po skoku gracza o ponad 300 m zostaje w uśpionych do końca sesji
- Status: zgłoszone (2.11, weryfikator G-219)
- Ważność: S4 · Zasięg: skok o ok. 600 m w jednym kroku (metro, teleport): chunk zasypia przed zamknięciem „left”, napastnicy i ofiara (`micro:mugging:5:m0/m1/victim`) zostają w `state.dormant` i nic ich nie budzi; do zapisu nie trafiają (`isMicroKey`), więc to wyciek pamięci w sesji
- Poprawka: przy usypianiu chunka zamknąć trwające mikrozdarzenie (jak „left”) albo nie usypiać kluczy `micro:`; test z teleportem
- Pakiet właściciela: packages/sim (micro-events, streaming)

### G-234 Pasy schodów ucięte brzegiem chunka: klin rysowany w poprzek albo niewidoczny
- Status: zgłoszone (2.11, naprawiacz G-213); stan sprzed G-213, bazy skanu 1 i 1
- Klucze skanu: steps-across-run podzamcze-1-0 729,160; steps-band-hidden krakowskie-0-1 -200,125
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
- Pas 3 m biegu w503077033 przy wejściu n4934217573 (0,2..3,4; -71..-74,4) wchodzi 0,2 m w ścianę Poczty i po G-781 blokuje drzwi wejścia

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
- 17.11 przy G-928, także na main: deptak (300; -84) ziarno 13 przechodzień stoi 6,9 s przy (316,3; -100,1) w panice; (310; -100) ziarno 8 cywil 658 skoków yaw w 720 krokach (też G-369).

### G-329 Cywil 294 (koi-regular-2) drga w miejscu podczas paniki po strzałach
- Status: częściowo naprawione w #310 (6.11; przechodzień 294: 84 → 10 skoków, 1082: 283 → 40 w nagranym przebiegu; w tickach 1060–1159 u 294 zostaje 7)
- Ważność: S4 · Zasięg: nagrany przebieg `determinism.test.ts`, ticki ok. 1060–1159
- Pakiet właściciela: packages/sim/src/systems/ai

### G-339 Uskok na końcach pomostów: pomost poziomy w poprzek, droga obok na terenie (T-166)
- Status: zgłoszone (5.11, kurator, przegląd G-330)
- Klucze skanu: deck-abutment-step podzamcze-2-0 1070,160
- Ważność: S4 · Zasięg: 8 końców (Mełgiewska, wiadukt Zamkowej, kładka Podzamcza) · Koszt: średni; 12.11 (przejście stare-miasto-1-1): koniec (732,2; 151,7) to styk z górnym stopniem w294098693: uskok chodzenia 0,51–0,54 m na całej szerokości pasa (G-686, `steps-riser-tall` (732; 151)). Na końcu NW (727,9..728,9; 156,0..158,4) `deck-abutment-step` do 1,73 m.; podzamcze-2-0 (12.11): `deck-abutment-step` 1 kwadrat (3 próbki): kładka (1073,8; 161,7), (1073,8; 161,1), (1073,9; 160,6), pomost -25,66 wobec gruntu 0,3 m dalej; to ten sam koniec co w T-166 (1073,8; 161,6), bez nowych końców.; 12.11 (G-686, PR #476): koniec (732,2; 151,7) i (732,5; 151,3) usunięty rampą `flightTopRamps` (`deck-abutment-step` 10 → 8, `steps-riser-tall` 1 → 0). Zostaje koniec NW (727,9..728,9; 156,0..158,4) do 1,73 m przy schodach w56965515 oraz końce Mełgiewskiej i kładki.
- Gdzie: (2456,5; 296,6) 0,45 m; (2408,5; 280,0) 0,35 m; (2446,2; 246) 0,25 m; (727,7; 157,5) 0,89 m; (763,6; 182,7) 0,36 m; (1073,8; 161,6) 0,29 m
- Przyczyna (przypuszczalna): `makeDeck` bierze `rawHeight` końców osi i robi pomost poziomy w poprzek; droga obok idzie za poprzecznym spadkiem NMT
- Pakiet właściciela: packages/sim (content/lublin decks, terrain PADS/RAMPS)
- Test przyjęcia: kontrola `deck-end-step` (różnica `groundY` 0,15 m przed i za krawędzią > 0,15 m, poza drogą pod mostem) = 0
- 16.11 (kurator, po G-898 #655): przyczyna zmierzona, inna niż przypuszczalna. W 85 z 195 próbek krawędzi pomostów z progiem 0,02-0,45 m surowy NMT 1 m 0,25 m za obrysem leży na poziomie pomostu (-0,20…+0,09 m), a siatka importu 0,15-0,68 m pod NMT (kształtowanie terenu ±0,0). Rozmycie Gaussa NMT (BASE_SIGMA 1,5 m) i siatka 2,5 m wciągają skarpę lub rów pod mostem w pas obok końca pomostu. Miejsca: Zamkowa SW (729-732; 152-156), chodnik wiaduktu (754-764; 183-189), kładka (1070-1083; 162), Mełgiewska (2449-2451; 258-259), (2405-2445; 241-266), most Lutosławskiego (2440-2486; 406-439). Proponowana reguła importu (tools/osm-import/src/terrain.ts): rozmycie z maską, w którym 1 m komórki NMT pod obrysem man_made=bridge (pomostu) nie wchodzą do średniej dla punktów siatki poza obrysem (splot znormalizowany), albo punkty siatki do 2,5 m od boku pomostu i 3,6 m od końca biorą min(surowy NMT, pomost), gdy |surowy NMT − pomost| ≤ 0,15 m. Gdzie surowy NMT jest niżej o > 0,45 m, skarpa zostaje (T-new z tego przeglądu). Kontrola: deck-side-below-nmt, baza 85.

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
- Klucze skanu: metro-exit-bare podzamcze-1-0 720,290
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
- 14.11 audyt ADR-0077: w294098689 i w294098690 są w grze jako wall (podzamcze/stare-miasto.generated.ts, od #418); do weryfikacji i zamknięcia; mur ogrodu Karmelitów (brak w OSM) zostaje

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
- Klucze skanu: steps-band-hidden krakowskie-0-1 -200,125
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
- Klucze skanu: landmark-vs-lod1 stare-miasto-1-0 749,-104
- Ważność: S4 · Zasięg: środek dachu 30,9 m wobec 25,8 m w LoD1; poza zmianą heights, wynik sondy kuratora; przejście stare-miasto-1-0 (12.11): `landmark-vs-lod1` 1 w komórce to ten sam przypadek (30,9/25,8 m, IoU 0,90); po #459 bez zmian
- Pakiet właściciela: tools/osm-import, packages/engine (receptury landmarków)
- 15.11 przesiew po kluczach skanu: klucz landmark-vs-lod1 stare-miasto-1-0 749,-104 nadal w bazie; wpis aktualny.

### G-636 Bariera leżąca na ścianie budynku liczy się w skanie jako wycięta
- Status: zgłoszone (12.11, scalenie #418 z main; baza `barrier-parallel-cut` 14 → 15 opisana w commicie 529888c)
- Klucze skanu: barrier-parallel-cut podzamcze-0-1 539,517; barrier-parallel-cut krakowskie-2-0 387,-27; barrier-parallel-cut stare-miasto-0-1 558,100
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

### G-659 30 samoprzecinających się obrysów nawierzchni bez kontroli w skanie
- Status: częściowo naprawione: ground-ring-self-cross 30 → 1 (#509, #559); zostaje stare-miasto-1-0 742,-97; wcześniej: kontrola w main (#453, baza 30); wcześniej: kontrola w main (#453, `ground-ring-self-cross` baza 30); naprawa w etapach 2–3 ADR-0078
- Klucze skanu: ground-ring-self-cross stare-miasto-1-0 742,-97
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
- 15.11 przesiew po kluczach skanu: samoprzecięcia tych par zniknęły z ground-ring-self-cross (#559), ale skan nie liczy duplikatów obrysów, więc samo zdublowanie nie jest potwierdzone jako naprawione; do sprawdzenia kontrolą duplikatów.

### G-681 Linia środkowa Radziwiłłowskiej 0,2–1,5 m na południe od rzeczywistej
- Status: zgłoszone (12.11, kurator przeglądu #454; niski priorytet)
- Ważność: S4 · Zasięg: Krakowskie, x −88…−20, z ok. 113: w grze 113,0–113,6, w rzeczywistości ok. 113,7 (wschód) i 114,0–114,5 (zachód) według ortofoto 2025-04; linia idzie osią drogi z OSM przesuniętą przez `fitLanes`, nie osią malowania; mniej niż 1/3 pasa; odsyłacz G-655, G-675
- Pakiet właściciela: tools/osm-import

### G-682 Goły teren na nawierzchni wzdłuż Królewskiej
- Status: potwierdzone (12.11, kurator: ortofoto i 2 zrzuty; T-263); dodatkowo 12 próbek `kerb-fill-wide-estimated` (496..500; −202..−201) przy w40052496 (Królewska, `lanes=2`, bez `width`; korekta T-247 obejmuje tylko w66829063); udział ortofoto w pasie przy SE ścianie w66286377 to dach przechylony o 4–5 m, a nie nawierzchnia
- Klucze skanu: landuse-bare stare-miasto-0-0 470,-200; landuse-bare stare-miasto-0-0 520,-150
- Ważność: S3 · Zasięg: pas ukośny od ok. (478; −195) do (525; −145) i (505..525; −195..−215), 29 kwadratów, 2576 próbek `landuse-bare` (ok. 644 m²); nakładka ortofoto: 340 m² jasna nawierzchnia, 257 m² asfalt, 35 m² zieleń; pasy między jezdnią a chodnikami przy krzywiźnie Królewskiej i placu; kandydat do kroku 1.1 ADR-0077 (goła ziemia z ortofoto, w toku)
- Pakiet właściciela: tools/osm-import

### G-683 Wylot bramy poza osią frontu: Brama Krakowska i Wieża Trynitarska
- Status: potwierdzone dla (463; −94) (12.11, kurator; zrzut `sm00-krakowska-zach`; OSM −0,74 m, gra −1,80 m); poprawka: oś przejazdu łamana jak w OSM (w491869410 i w66264116, po ok. 21°) albo wylot w środku frontu przedbramia; Trynitarska liczona względem obrysu OSM, który LoD2 przesuwa o ok. 4 m (T-264), do potwierdzenia zdjęciem
- Klucze skanu: gate-mouth-off-axis stare-miasto-0-0 463,-94; gate-mouth-off-axis stare-miasto-0-0 587,-140; gate-mouth-off-axis stare-miasto-0-0 588,-154
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
- 14.11 audyt ADR-0077, świeże OSM: 9 linii w mapie bez bariery w grze (453 m): 7 z opisu, płot w233257785 (26 m, x ≈ −204, z ≈ −47) i toll_booth w1002731074 (wartownia); 14 z 80 węzłów gate bez otworu w grze

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
- 16.11 (G-874): pas 2,6-3 m odsłonięty spod skrzydła pn. (x 904-942, z 253-262) dochodzi do gołego podjazdu: landuse-bare podzamcze-1-0 910,250; bare-on-cover podzamcze-2-0 930,250

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
- Klucze skanu: sidewalk-under-carriageway stare-miasto-1-0 750,-180; sidewalk-under-carriageway stare-miasto-1-0 690,-210; kerb-gap-bare stare-miasto-1-0 610,-220; kerb-strip-bare stare-miasto-1-0 610,-220; kerb-gap-bare stare-miasto-0-0 530,-180
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

### G-732 NPC w pozie siedzącej idzie, nogi niewidoczne
- Status: w PR #719 (18.11, testy regresji; nie odtwarza się na main po #711, czeka na potwierdzenie użytkownika w grze); wcześniej: zgłoszone (12.11, zgłoszenie użytkownika); do zrobienia razem z pozycją backlogu „Animacje ruchu”
- Ważność: S3 · Zasięg: część NPC z modelami przesuwa się w pozie siedzenia (ADR-0040 aktywności, ADR-0058 etap 8 pozy przy ławkach), a nogi nie są widoczne; przypuszczalnie poza aktywności `sit` zostaje po wyjściu z miejsca siedzenia albo ukrycie nóg pod siedziskiem nie jest zdejmowane przy ruchu; to błąd przełączania stanu (siedzi albo idzie), nie brak klipu
- Pakiet właściciela: packages/engine (`activity-poses.ts`, modele postaci), ewentualnie packages/sim (stan aktywności)
- Test przyjęcia: test sesji, że postać w ruchu (prędkość > 0) nigdy nie ma pozy `sit` ani ukrytych nóg; przejście siad → wstawanie → chód w kolejności; zrzut przed/po
- 18.11 (pod nieobecność): test symulacji (14 przejść siad ↔ chód z planów dnia) i testy renderera (rig i model VRM) przechodzą bez zmian w kodzie; mutacja, w której renderer ignoruje koniec aktywności, wywraca testy renderera. Jeśli użytkownik nadal widzi błąd, potrzebne miejsce i godzina w grze.

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

### G-774 Raster cover poszerza trawniki na sąsiedni bruk (wygładzanie 1,5 m) i klasyfikuje zielonkawy bruk jako green
- Ważność: S4 · Zasięg: całe miasto; np. pierścień skweru Podzamcze (1045, 424), pętle w1343050082, w154012559, w515648305
- Opis: THRESHOLDS.smooth=1 rozlewa zieleń o ok. 0,5-0,75 m na bruk; bruk z ExG 0,05/0,03/0,15 (2023-09) przekracza średnią greenExg 0,026. Zawyża fill-on-green i reguły kładące trawę z rastra (G-761 był fałszywym alarmem z tego powodu).
- Status: zgłoszone (13.11, naprawiacz G-761)
- Pakiet właściciela: tools/orto

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

### G-791 Wejścia OSM bez drzwi na rysowanej ścianie (9 miejsc)
- Ważność: S4 · Zasięg: 9 miejsc bazy entrance-no-door: krakowskie-0-1 -143,32; krakowskie-1-0 156,-265; krakowskie-2-0 427,-245 i 432,-242; podzamcze-0-1 527,437; podzamcze-1-1 748,428; stare-miasto-0-0 588,-237; stare-miasto-0-1 590,17; stare-miasto-1-1 668,15
- Opis: wejście entrance=* w 1,5 m od ściany drzwi, reguły odrzucają wszystkie sloty, brak drzwi w 2 m
- Status: zgłoszone (14.11, naprawiacz G-781)
- Klucze skanu: entrance-no-door krakowskie-0-1 -143,32; entrance-no-door krakowskie-1-0 156,-265; entrance-no-door krakowskie-2-0 427,-245; entrance-no-door krakowskie-2-0 432,-242; entrance-no-door podzamcze-0-1 527,437; entrance-no-door podzamcze-1-1 748,428; entrance-no-door stare-miasto-0-0 588,-237; entrance-no-door stare-miasto-0-1 590,17; entrance-no-door stare-miasto-1-1 668,15
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: entrance-no-door spada, ground-over-steps nie rośnie

### G-792 laidOf odwraca dziury pierścieni zmienionych w pierwszej fazie roundJoints
- Ważność: S4 · Zasięg: pasy z pętlą (dziura), które dostały bit końca
- Opis: laidOf (G-777) obraca każdą ścieżkę ujemną, także prawdziwą dziurę z union w rings; dziura pętli liczy się jako przykryta, szczelina lub łata w niej może nie powstać; niezweryfikowane sondą
- Status: zgłoszone (14.11, naprawiacz G-782)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: laidOf obraca tylko obrysy pasów, dziury zostają dziurami

### G-793 Przycięcie przy zmianie dzielnicy: budowa kawałków miasta w jednej klatce
- Ważność: S3 · Zasięg: każda zmiana dzielnicy; 30–35 MB buforów wierzchołków; pod SwiftShaderem klatki 0,5–8 s
- Opis: bufferData i _createVertexBuffer kawałków miasta w jednej klatce przy wejściu do dzielnicy; do rozważenia budowa rozłożona na klatki albo dociąganie przy granicy dzielnicy (całe miasto w ładowaniu przekracza budżet ADR-0079); też dynamiczne bufory (updateVerticesData) potrafią zablokować klatkę
- Status: zgłoszone (14.11, pomiar ładowania wstępnego)
- Pakiet właściciela: packages/engine (renderer)
- Test przyjęcia: zmiana dzielnicy bez klatki > 100 ms w raporcie hitch-report

### G-794 Linie pasa wchodzą w skrzyżowanie i przecinają linię zatrzymania
- Ważność: S4 · Zasięg: Krakowskie (-109,8; 115) lane-dash 3 Maja ok. 4,5 m w pas Radziwiłłowskiej; Podzamcze (741–745; 356–361) lane-dash za linią zatrzymania do zebry
- Opis: linie pasa biegną do węzła OSM zamiast kończyć się na krawędzi skrzyżowania albo przed linią zatrzymania (P-12); stan sprzed G-782; proponowana kontrola: lane-dash/edge przecinające stop tej samej jezdni albo wchodzące > 1 m w cudzą jezdnię w obrębie węzła
- Status: zgłoszone (14.11, kurator, przegląd G-782), do audytu dróg
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola skanu bez kluczy w tych miejscach

### G-799 Hydranty nadziemne z OSM odpadają przy rozstawieniu (8 z 14)
- Ważność: S4 · Zasięg: osm.hydrants: 14 w planie, 6 w grze
- Opis: osm:props --items: osm.hydrants 14 asked, 6 placed; MAX_MOVE 3 m albo kolizja z budynkiem lub jezdnią (przyczyna do ustalenia)
- Status: zgłoszone (14.11, audyt ADR-0077)
- Pakiet właściciela: tools/osm-import (props-gen)
- Test przyjęcia: każdy hydrant nadziemny z planu stoi ≤ 3 m od węzła albo ma powód w raporcie osm:props

### G-805 Styl latarni: lamp-road na deptakach Śródmieścia, lamp-park przy peronach i na chodnikach
- Ważność: S4 · Zasięg: 7 linii krakowskie-side, ok. 14 lamp na Dworcu Podzamcze, 8 chodników footway=sidewalk
- Opis: YIELDING przejmuje tylko linie na ulicach samochodowych, więc deptaki lit=yes zostają z lamp-road z planu; PATH stawia lamp-park przy peronach i na chodnikach ulic. W rzeczywistości przy deptaku stoją latarnie stylizowane (Peowiaków, Commons 2009). T-298
- Status: zgłoszone (14.11, przegląd kuratora G-798)
- Pakiet właściciela: tools/osm-import (props-lit), docs/world/lublin-props.todo.json
- 15.11 przegląd S4: nadal na main (YIELDING tylko lamp-road na ulicach samochodowych, PATH dla footway=sidewalk i peronów bez zmian). Koszt średni: decyzja o wyglądzie (latarnie stylizowane przy deptaku, chodnik przy ulicy bez własnych lamp-park), przegląd kuratora. Ta sama rodzina co G-798, bez dubletu.

### G-811 kerbFills pomija stronę zmierzonej drogi zostawioną przy szacunku
- Ważność: S3 · Zasięg: ulice ADR-0080 PR 10 z jedną stroną HELD; kerb-gap-bare 810 → 823 (127 nowych kluczy), kerb-fill-wide-estimated 71 → 72
- Opis: Na gałęzi ccr-ec2c4269-ilh8k8-adr80-pr10 (b17eb17) strona drogi zostawiona przy szacunku (reguły: ścieżka przed krawężnikiem, strona węższa niż least/2) nie dostaje kerbFills, więc między jezdnią a chodnikiem zostaje goły pas. Do tego lawn-on-leafoff-paving 94 → 105 (trawnik na pasie zwolnionym przez węższą jezdnię, Nabrzeże). Blokuje scalenie PR 10.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import, tools/orto
- Runda 3 (054a446): kerb-gap-bare +127 → +70 nowych (suma 810 → 671), kerb-fill-wide-estimated +12, lawn-on-leafoff-paving +17 bez zmian (to drobiny canopyHard przy krawężniku, nie pas po węższej jezdni). Skan nadal czerwony; decyzja o bazie u użytkownika.
- PR 10 scalony w #565 (15.11) z bazą przyjętą decyzją użytkownika; zostaje kerb-gap-bare +70 i kerb-fill-wide-estimated +12 do poprawy.

### G-816 Odcinek reguły lit bez stacji liczy się jako oświetlony; przebieg uzupełniający powtarza stację, która właśnie odpadła
- Ważność: S4 · Zasięg: SW róg Krakowskiego (-160..-130; -270..-260), rząd drzew w1550442735
- Opis: Znalezione przy G-812: odcinek krótszy niż pół rozstawu nie dostaje stacji, a liczy się jako oświetlony; drugi przebieg powtarza tę samą zablokowaną stację.
- Status: część 1 naprawiona (#574); część 2 otwarta; wcześniej: częściowo w PR #574 (część 1); część 2 otwarta; wcześniej: częściowo w poprawce (przegląd S4 15.11, gałąź ccr-ec2c4269-ilh8k8-s4-batch-1, f429ad9: część 1, przebieg bez stacji nie oświetla; 16+2 takich linii w mieście, +8 elementów w tablicy); część 2 otwarta; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (props-lit)
- 15.11 przegląd S4, część 2 na main: 4 stacje przebiegu uzupełniającego leżą < 1 m od stacji pierwszego przebiegu i znowu odpadają: w1004767721 (1120,8; 381,7), w58643325 (2470,2; 417,3), w427417969 (1104,8; 176,3) i (1111,9; 205,4); do tego w172992144 (2427,9; 264,5), (2442,8; 255,3) bez latarni po obu przebiegach. Miejsce ze zgłoszenia (SW róg Krakowskiego) po G-812/G-821 już tego nie pokazuje. Koszt średni (przesunięcie stacji uzupełnienia względem pierwszego przebiegu). Sonda: scratchpad s4-p816.test.ts.

### G-822 Pasy ruchu rozłożone równo na zmierzoną szerokość razem z zatoką
- Ważność: S4 · Zasięg: Lubartowska w230504488 na gałęzi ADR-0080 PR 10: 3 pasy po ok. 4,1 m w 12,5 m
- Opis: Po pomiarze z ortofoto jezdnia ma 12,5 m (lewo 7,25, prawo 5,25); trzy pasy dzielą równo całą szerokość razem z zatoką lub parkowaniem, linie stoją 4,4 m od siebie zamiast 3,5 m.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import, packages/sim
- 15.11 przegląd S4: nadal na main po scaleniu PR 10 (#565): markings.ts dzieli całą szerokość przez liczbę pasów (lw = w / lanes), w230504488 ma w tablicy 12,5 m (7,25/5,25). Koszt średni (która strona to zatoka, ortofoto).

### G-823 Zebry z węzłów: 132 na gałęzi PR 10 wobec 136 na main
- Ważność: S4 · Zasięg: 4 zebry z węzłów OSM znikają na gałęzi ADR-0080 PR 10
- Opis: crossingBand kładzie zebrę od stopy węzła na przesuniętej jezdni (054a446), ale 4 nadal brakuje wobec main.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import
- 15.11 przegląd S4: nadal na main (#565): pól crossing 136 na 6e7ea41, 132 na main; brak zebr przy (2386,4; 336,0), (2351,9; 339,5) (Nabrzeże) i (1090,1; 491,6) (Podzamcze, sąsiednia przesunięta o 8 m); trzy inne przesunięte o ok. 3 m. Koszt średni (crossingBand: off liczony od przesuniętej osi).

### G-824 Komórka canopyHard przy krawężniku dołączana do trawnika (lawn-on-leafoff-paving)
- Ważność: S4 · Zasięg: 17 próbek 0,1–0,55 m od krawędzi jezdni, m.in. Rondo Cybulskiego, Mełgiewska
- Opis: Drobiny poniżej 8 komórek klasy canopyHard przy krawężniku (prawdopodobnie sam krawężnik) joinSpecks dołącza do trawnika; potrzebny krawężnik między asfaltem a pasem zieleni zamiast zgadywania klasy.
- Status: zgłoszone
- Pakiet właściciela: tools/orto, tools/osm-import
- 15.11 przegląd S4: nadal (joinSpecks bez pojęcia krawężnika); koszt średni; ta sama rodzina co G-826 (klasy ortofoto przy krawędzi jezdni), bez dubletu.

### G-825 Jezdnia importu węższa od prawdziwej przy łącznicach, kieszeniach skrętu i placement=left_of; pas wypełnia bruk z pokrycia
- Ważność: S3 · Zasięg: Mełgiewska/łącznica Andersa w40051729, Al. Solidarności w215609082 (kieszenie skrętu), Lwowska (placement=left_of:3)
- Opis: Znalezione przy G-821: import nie czyta placement i nie poszerza jezdni o łącznice i pasy skrętu; pas do prawdziwego krawężnika wypełnia bruk z pokrycia ortofoto, więc latarnie i meble przy krawężniku mapy stoją na prawdziwym asfalcie.
- Status: naprawione (PR #595); wcześniej: w PR #595 (kurator r5 ZGODNE, e3133eb); wcześniej: w naprawie (runda 2 po przeglądzie kuratora, gałąź ccr-ec2c4269-ilh8k8-g825); wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import, tools/orto
- 15.11 przegląd kuratora (41ddd97): NIEZGODNE. Placement zgodne z ortofoto; zwężenie przy węźle kładzie pół pasa łącznicy za krawężnik: Ruska w216655518 (1071..1074; 428..437) jezdnia na trawie ok. 12 m², Andersa w40051729 (2316..2322; 312..321) jezdnia i chodnik na trawie ok. 12 m², Solidarności w215609082 s 0-6 krawędź 7,7 m wobec 6,3 (ok. 5 m² na szpicu trawnika). kerb-fill-wide-estimated (1113,353) to fałszywy alarm (kostka dojścia do przejścia). Runda 2 naprawiacza.
- 15.11 runda 2: 4f9cf2f + merge ed53299; skan 3842 → 3833, nowa kontrola lane-place-on-green (baza 0); do ponownego przeglądu kuratora, w tym 5 sygnalizatorów przestawionych przy remisach
- Przegląd kuratora r2 (15.11, ed53299): NIEZGODNE. Ruska, Andersa (trawa), Solidarności i szwy zgodne. Do poprawy: pas trawnika z kerbFills na bruku i asfalcie (1088,9-1091,5; 456-472) +21,8 m² i (1110,5-1119; 274,35-276) +13,1 m²; reguła remisu sygnalizatorów pogarsza (-104,3;121) i (-104,1;49,7); n1946478264 (1104,1;264,7) 3,6 m w jezdni łuku (krawężnik placu z≈261,0, 2024-06). Runda 3 nowym agentem. Szczegóły: scratchpad/topo-g825-r2-raport.md
- 15.11 r3 7bfd370: pas do trawnika tylko przy szczelinie ≤ 0,6 m albo przy zieleni na ortofoto, szerszy jako square; reguła remisu sygnalizatorów wycofana (17 z 18 jak na main); kontrola lawn-strip-on-paving, baza 0. n1946478264 zostaje na klinie (1094,5; 279) jak w r1: obie pozycje docelowe wymagają nowej reguły, decyzja orkiestratora: sprawa G-842. Czeka na przegląd kuratora (Lwowska z 397–439 plamista, grządka 1110–1119; 514–522 jako square).
- Przegląd kuratora r3 (15.11, @ 7bfd370): NIEZGODNE, 1 poprawka. Zgodne: A (trawa od x 1090,9 / 1090,1 / 1090,2 / 1091,5 przy z 458 / 462 / 465 / 469; zdjęcie 1091,0 / 1090,0 / 1090,3 / 1091,5), B (square z 274,3–274,8 do 275,9–276,7, bez trawy przy z < 275,9), grządka square jak main i zdjęcie, 5 sygnalizatorów co do 0,0 m jak na main, lawn-strip-on-paving 0, teren 0, hashe zgodne. Do poprawy: pas przy przesuniętej krawędzi zmienia nawierzchnię co 1–3 m (square albo trawa do jezdni): Lwowska, zach. krawędź z 397,5–420,2 (7 przebiegów po 1,5–3 m) i z 337,8–365 (6 przebiegów po 1–5,8 m), A z 462,5–464,4 (2 m trawy do jezdni między pasami square). Zdjęcie 2023-09: na całych odcinkach ciągły trawnik i jasny krawężnik 0,5–1 m. Oczekiwane: jedna nawierzchnia na odcinek krawędzi, bez przebiegów krótszych niż 5 m między przebiegami drugiej (np. square z 392–442 i z 337,8–365). Kontrola: kerb-fill-flicker.
- 15.11 r4 d00cf52: pas do trawnika jedną nawierzchnią na odcinek (lawnStretches), kontrola kerb-fill-flicker (baza 63, wszystkie z main); do kuratora: łącznica Ruskiej (1068–1073; 432–447) square 1–1,5 m częściowo na zieleni ortofoto
- 15.11 kurator r4 d00cf52: NIEZGODNE. Lwowska z 337–365 i 390–441, A z 453–474, Solidarności zgodne z ortofoto. Łącznica Ruskiej w216655518 (1064–1074; 432–444): square 1,0–1,8 m na trawniku (+10,2 m² na zieleni), ortofoto 2023-09/2024-06/2025-04: trawnik od krawędzi jezdni. Przyczyna: weto jednej twardej próbki w lawnStretches (5 z 37). Oczekiwane: trawa z 432–444, square tylko przy zebrze z 444–447,5. Drobne: Andersa (2355,6–2356,6; 357–358) trawa zamiast square 0,3–0,8 m.
- r5 e3133eb: odcinek trawnikiem przy zielonych >1/2 i twardych <=1/5, twardy koniec przy zebrze square; Ruska trawa od krawężnika; scalenie main aa247de (konflikt z G-837)
- 15.11 kurator r5 e3133eb: ZGODNE. Ruska trawa od krawężnika z 431,8–444,5 (17 z 18,6 m² na zieleni ortofoto), square przy zebrze; Lwowska, A, Solidarności, Andersa bez zmian; G-837 zachowane (kerb-jag-places zielony, krakowskie i stare-miasto jak main); hashe zgodne, skan = baza; klucze bazy uzasadnione (kerb-jag 1050,440 = G-860). Resztki S4 w osobnym zgłoszeniu.
- Kurator 16.11 (a29a7d4): ZGODNE; evenKerbs przybliża do ortofoto, 4 próbki trawy 0–0,5 m poza parkingiem w granicy dokładności OSM

### G-826 Pokrycie ortofoto 2025-04 klasuje jasny asfalt jezdni jako paving
- Ważność: S3 · Zasięg: m.in. pod latarniami G-821; kontrola lamp-on-orto-carriageway ich nie widzi
- Opis: bare-cover kładzie bruk na prawdziwym asfalcie; kontrola lamp-on-orto-carriageway (baza 146) ma przez to słabą moc. Poprawić klasyfikator albo porównywać z jezdnią poszerzoną o łącznice i placement.
- Status: zgłoszone
- Pakiet właściciela: tools/orto

### G-827 Drzewa reguły koron: resztki po G-815 — dach garaży spoza OSM, drugie drzewo na koronie drzewa OSM, pary wierzchołków co 2,2 m
- Ważność: S4 · Zasięg: 2 drzewa na dachach/okapach, 3 drzewa 2,4–2,8 m od drzewa OSM, 5 par drzew reguły w odstępie 2,2 m; Krakowskie, Podzamcze, Nabrzeże
- Opis: Po rundzie 2 G-797 (2b26e13). Dachy: (552,5; 428,5) 5,9 m na pasie dachów garaży w podwórzu, których nie ma w OSM (CHM 4–6 m, ortofoto bez korony); (580,5; 516,5) 6 m na narożniku dachu, korona krzewu obok (wątpliwe). Drugie drzewo na koronie drzewa OSM w zasięgu rysowanej korony: (564,5; 118,5) przy OSM (564,3; 115,7), (1074,5; 562,5) przy (1073,6; 560,3), (2683,5; 82,5) przy (2685,9; 83,1); zasięg przy stawianiu liczony z wierzchołka CHM, rysowany z wariantu. Pary 2,2 m na jednej plamie CHM: (417,5; −198,5), (520,5; 342,5), (2482,5; 95,5), (2514,5; 96,5), (2658,5; 73,5). Nakładki scratchpad/topo-g797r2/rf.png, s1.png, s2.png.
- Status: zgłoszone (przegląd kuratora G-797 r2, 15.11)
- Pakiet właściciela: tools/osm-import (crown-trees.ts, crown-grid.ts)
- Test przyjęcia: drzewo reguły dalej od drzewa gry niż jego rysowana korona; brak drzewa reguły na (552,5; 428,5)
- 15.11 przegląd S4: nie sondowane osobno (crown-trees.ts bez zmian od #567); koszt średni, trzy osobne reguły; powiązane z G-806/G-814 (gałąź g814, drzewa przy ścianach), bez dubletu.

### G-829 Granitowe słupki z OSM (material=granite) rysowane jako żeliwne
- Ważność: S4 · Zasięg: 16 węzłów barrier=bollard przy Placu Litewskim (x 98–140, z −52…−86)
- Opis: Plan nie rozróżnia materiału słupków; po G-819 wszystkie są czarne żeliwne z łańcuchem. Do zbiorczego przeglądu S4.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)
- 15.11 przegląd S4: nadal (plan i engine bez materiału słupka); koszt średni (nowy wariant w prop-shapes i bit materiału w imporcie, zrzuty); niezależne od G-830–G-833.

### G-830 Pl. Łokietka: wschodni rząd słupków (w1514057823) 0,4–0,5 m od rzędu z ortofoto, bo jezdnia w grze zachodzi na krawężnik
- Ważność: S4 · Zasięg: Krakowskie, Lubartowska przy Pl. Łokietka x 446,4–447,0, z −61…−36 (15 słupków)
- Opis: Po G-818 (gałąź ccr-ec2c4269-ilh8k8-g818, 01170dc) słupki linii w1514057823 przesunięte z jezdni na chodnik o 0,40–0,54 m na wschód (KERB_REACH). Ortofoto 2025-04 (krakowskie-2-0, 0,25 m/px, profil poprzeczny i zbliżenie 48 px/m) pokazuje rząd dokładnie na linii OSM, na granicy szarej jezdni i jasnej kostki, czyli na krawężniku: jezdnia w grze sięga tu ok. 0,4 m za krawężnik, a słupki stoją na chodniku obok prawdziwego rzędu. Do tego rozstaw na ortofoto ok. 1,5 m (72 px przy 48 px/m), w grze 1,8 m: 15 słupków zamiast ok. 17. Poprawka: krawędź jezdni Lubartowskiej przy Pl. Łokietka z ortofoto (szerokość albo oś), po niej słupki wracają na linię OSM bez przesunięcia; rozstaw linii z ortofoto. Zachodni rząd w1514057822 zgodny (odchyłka do 0,2 m). Zrzut: scratchpad topo-g818r/zoom-1514057823-2025-04-8.png. T-301
- Status: nowy
- Pakiet właściciela: tools/osm-import (Infra / Build)
- Test przyjęcia: kontrola skanu: słupek linii OSM dalej niż 0,3 m od linii (baza 23 przesunięcia z G-818); krawędź jezdni a rząd słupków z OSM przy krawężniku
- 15.11 przegląd S4: u innego agenta (gałąź g825, ta sama przyczyna co G-825: jezdnia importu szersza/węższa od ortofoto).

### G-831 Rząd słupków z łańcuchem przez stanowiska prostopadłe na Karmelickiej (strona zachodnia/północna)
- Ważność: S4 · Zasięg: Karmelicka, ok. 50 m rzędu z łańcuchem (x≈230..270, z≈130..160) po stronie bez wyłączenia zatok
- Opis: Po G-820 P2 rząd odpada przy zatokach widocznych na ortofoto, ale strona zachodnia Karmelickiej nie przekracza progu (asfalt ≥80% okna ±4 m na głębokości 0–2,5 m): na ortofoto 2025-04 stoją tam auta prostopadle do krawężnika, a w grze biegnie przez nie rząd z łańcuchem (zrzut g820-r2-karmelicka). Strona wschodnia wyłączona poprawnie (49,8 m). T-303
- Status: zgłoszone (kurator 15.11, przegląd rundy 2 G-820)
- Pakiet właściciela: tools/osm-import (props-kerb-bollards, baysOf)
- Test przyjęcia: Karmelicka: brak słupków reguły na obu stronach odcinka stanowisk prostopadłych; kontrola skanu: słupek reguły, za którym 0–2,5 m na ortofoto auto/asfalt na ≥60% okna ±4 m (baza po wdrożeniu 0)
- 15.11 przegląd S4: dotyczy reguły z PR #573 (G-820), jeszcze nie na main; sprawdzić po scaleniu #573. Koszt: G-831 i G-833 mały–średni (baysOf, ROW_TURN w props-rows.ts), G-832 średni (dwa naloty lub maska cienia); G-831 i G-832 to ten sam detektor baysOf z przeciwnym błędem.

### G-832 Fałszywe wyłączenia rzędu słupków przez cienie na ortofoto (zatoki G-820 P2)
- Ważność: S4 · Zasięg: ok. 60–100 m krawężnika: 3 Maja zach. 24 m (x≈-115, z 75..99), Staszica 15 m (178..190, 32..40), Narutowicza 3 odcinki 18 m (95..109, -260..-250; 260..267, -167), Radziwiłłowska płd. 43 m (36..78, z≈104..109) niepewne
- Opis: Detektor zatok (baysOf) bierze cień budynku na ortofoto 2025-04 za asfalt. Na nalocie 2024-06 za krawężnikiem 3 Maja i Staszica jest jasny chodnik bez aut, Narutowicza (95,-255) i (263,-167) to chodnik w cieniu kamienicy i wieży; w grze brak tam rzędu. Radziwiłłowska płd. na 2024-06 ma auta ustawione skośnie na przedpolu budynku, więc wyłączenie może być trafne (do sprawdzenia na GSV). T-303
- Status: zgłoszone (kurator 15.11, przegląd rundy 2 G-820)
- Pakiet właściciela: tools/osm-import (props-kerb-bollards, loadOrtoAsphalt)
- Test przyjęcia: 3 Maja zach. i Staszica mają rząd; detektor zatok wymaga zgodności dwóch nalotów (2024-06 i 2025-04) albo odrzuca próbki w masce cienia
- 15.11 przegląd S4: dotyczy reguły z PR #573 (G-820), jeszcze nie na main; sprawdzić po scaleniu #573. Koszt: G-831 i G-833 mały–średni (baysOf, ROW_TURN w props-rows.ts), G-832 średni (dwa naloty lub maska cienia); G-831 i G-832 to ten sam detektor baysOf z przeciwnym błędem.

### G-833 Łańcuch rzędu słupków kończy się na rogu placu zamiast zawinąć łuk
- Ważność: S4 · Zasięg: narożniki placów z rzędami G-820 (np. Pl. Wolności, zrzut g820-r2-plac-wolnosci-naroznik); liczba do policzenia sondą
- Opis: Po G-820 P5 słupki idą po łuku narożnika placu, ale łańcuch przy ROW_TURN 35° (props-rows.ts) nie skręca za róg: na łuku stoją słupki bez łańcucha albo rząd urywa się na rogu, a w rzeczywistości łańcuch biegnie ciągle po łuku do przerwy na zebrze. T-303
- Status: zgłoszone (kurator 15.11, przegląd rundy 2 G-820)
- Pakiet właściciela: tools/osm-import (props-rows, props-kerb-corners)
- Test przyjęcia: rząd na łuku narożnika placu ma łańcuch między każdą parą sąsiednich słupków do przerwy na przejściu
- 15.11 przegląd S4: dotyczy reguły z PR #573 (G-820), jeszcze nie na main; sprawdzić po scaleniu #573. Koszt: G-831 i G-833 mały–średni (baysOf, ROW_TURN w props-rows.ts), G-832 średni (dwa naloty lub maska cienia); G-831 i G-832 to ten sam detektor baysOf z przeciwnym błędem.

### G-834 Reguła okapu koron odrzuca prawdziwe drzewa przy ścianach
- Ważność: S4 · Zasięg: 8 punktów z listy G-814: (351,5; −64,5), (409,5; 145,5), (406,5; 148,5), (740,5; −190,5), (530,5; 128,5), (530,5; 110,5), (577,5; 418,5), (2317,5; 444,5)
- Opis: onEave (#567, G-815 P1) uznaje koronę połączoną płasko z dachem za okap, gdy korona na ortofoto zajmuje mniej niż 60%; prawdziwe drzewa w podwórzach odpadają. Do zbiorczego przeglądu S4.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import (crown-trees)

### G-835 Latarnie parkowe w korycie Bystrzycy
- Ważność: S3 · Zasięg: Nabrzeże, (2441,0; 344,7), (2444,1; 374,5), (2450,1; 404,1)
- Opis: lamp-park na terenie koryta (y −30,5) w wodzie OSM w949475137, ok. 20 m od ścieżek; znalezisko audytu W-3 15.11. Kontrola skanu prop-in-water (baza 3)
- Status: nowy
- Klucze skanu: prop-in-water nabrzeze-0-1 2441,345; prop-in-water nabrzeze-0-1 2444,375; prop-in-water nabrzeze-0-1 2450,404
- Pakiet właściciela: tools/osm-import

### G-836 Zebry z węzłów: kąt do jezdni, koniec poza krawężnikiem, paski i poświata na chodniku
- Ważność: S3 · Zasięg: crossing-shape: skew 19, overhang 26, glow 54, kerb 55; Podzamcze, Krakowskie, Nabrzeże, Stare Miasto
- Opis: crossingBand (ground.ts) i stretchZebras (kerb-fill.ts) kładą prostokąt o stałych wymiarach wokół węzła z osią najbliższego segmentu OSM, niedopasowany do poszerzonej jezdni (kerbFills, widened). Kontrole w PR #581; zrzuty scratchpad/jag/final/f1–f6
- Status: naprawione (PR #597); wcześniej: w PR #597; wcześniej: w PR #597 (kurator r3 ZGODNE, 748ef6c); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g836, e181e1b, runda 2, do przeglądu kuratora); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g836, c52dde6, do przeglądu kuratora); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- 15.11: skew 19->5, overhang 26->9, glow 54->5, kerb 55->44; reszta: wyloty skrzyżowań, brzeg mapy, oś pasma vs ROAD_CHAINS; droga przejścia jako footway pod zebrą; zmieniony test G-811 (chodnik pod zebrą)
- Przegląd kuratora 15.11 @ c52dde6: NIEZGODNE. P1 (2361,432) n4087364975 zebra obrócona o 35° (regresja), oś wzdłuż w406693442 N–S, ok. 10 m; P2 (927,468) w1054556913 zebra 6,5 m, asfalt gry dalej o 6,2/≥11,9 m, na ortofoto ok. 22 m (regresja); P3 (913,345) n4586176953 zebra ok. 50° skośnie, ma biec W–E przez w739432830, ok. 11 m. Reguła: zebra węzła na skrzyżowaniu wzdłuż drogi pieszej OSM przez węzeł; zasięg po asfalcie gry do krawężnika. Kontrole: crossing-off-path (baza 9), crossing-short-of-asphalt (baza 16). Klucz lamp-on-orto-carriageway (−128,−65) przyjąć z powodem: cień budynku na chodniku, krawężnik z ≈ −64,4. Runda 2.
- 15.11 r2: P1–P3 poprawione; crossing-off-path 11->10, crossing-short-of-asphalt 16->8; zebry skrzyżowań wzdłuż ścieżki OSM (f4 12,5° od prostopadłej), zasięg po asfalcie gry z area:highway; P1 6,2 m (asfalt gry węższy), środek P3 3,6 m od punktu kuratora
- Przegląd kuratora r2 (15.11, @48a15ce): NIEZGODNE. P1–P3 kierunek zgodny. Regresja f4 (621,−218) w305027462: 12,1° od prostopadłej do Podwala, na ortofoto zebra prostopadła (azymut ok. 152°). Oczekiwane: kąt gry 24 ± 5, środek ok. (620,6; −220,5); wyjątek wzdłuż ścieżki tylko dla węzłów, nie dla dróg footway=crossing; usunąć klucz skew (621,−218). Runda 3 nowym agentem.
- r3 @ 748ef6c: f4 prostopadła do Podwala (24,3°), footway=crossing zawsze prostopadła, service nie tworzy skrzyżowania; koniec przy chodniku boku (G-837 Kapucyńska); skew 7->4, kerb 42->46 przyjęte przez accept (konflikt z kerb-jag), czeka na decyzję użytkownika
- Przegląd kuratora r3 (15.11, @748ef6c): ZGODNE. f4 (621,−218) prostopadła do Podwala, środek (620,5; −217,2), 5,55 m; od ortofoto 1,28 m wzdłuż ulicy (węzeł OSM 817070507, przyjęte) i 3,0 m w poprzek (T-063). Reguła footway=crossing zmieniła tylko f4 (12,2°) i (1061,455) (2,9°, T-312). Koniec boku: 25 zebr przesuniętych o 0,03–1,7 m, bez obrotów. Teren i pomosty 0, hashe zgodne. Klucze ze scalenia: bollard-blocks-mouth 278,−166 (słupek G-820 +0,4 m, 10→10) przyjęty; kerb −122,50, 185,75, 1090,255 do G-869

### G-838 Szczelina 0,12 m między kwadratem reguły gołej ziemi a przesuniętą krawędzią Lwowskiej w139586648
- Ważność: S4 · Zasięg: kerb-gap-bare podzamcze-2-1 1110,440
- Opis: Kontur komórek 0,5 m reguły gołej ziemi nie dochodzi do krawędzi jezdni przesuniętej przez G-825 (placement). Znalezione w rundzie 2 G-825
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-839 Wyspa między łącznicą Ruskiej w216655518 a Lwowską to goła ziemia, na ortofoto kostka
- Ważność: S4 · Zasięg: Podzamcze (1069–1078; 437–447)
- Opis: Było tak przed G-825; znalezione w rundzie 2 G-825. Także klin między łącznicą Andersa w40051729 a Mełgiewską jako square, na ortofoto asfalt (klasa G-826)
- Status: nowy
- Pakiet właściciela: tools/osm-import
- 15.11 kurator (G-825 r2): klin łącznicy Andersa przy Mełgiewskiej (2319-2334; 315-327), ok. 20 m²: na ortofoto asfalt do z 321,4 (x 2326) i 324,4 (x 2330); stan jak w main

### G-840 Schody bez wspólnej normy stopnia: płytkie stopnie Placu Zamkowego z daleka jako czarna plama
- Ważność: S3 · Zasięg: wszystkie biegi schodów z mapy (steps-plan.ts); najbardziej schody na Wzgórze Zamkowe z Placu Zamkowego
- Opis: Zgłoszenie użytkownika 15.11 ze zdjęciem: schody na Podzamczu są bardzo płytkie i z daleka widać je jako czarną plamę. steps-plan.ts tnie bieg na stopnie o stałej głębokości STEP_DEPTH 0,33 m, a wysokość wynika ze spadku wygładzonego NMT (od MIN_RISER 0,045 m w górę), więc wysokości są różne między biegami i często bardzo małe. Ciemne podstopnie (#4f4b46) co 0,33 m zlewają się z daleka w czarną plamę (aliasing). Propozycja użytkownika: jedna norma stopnia w całej grze, pilnowana skanem. Do zrobienia: (1) norma: podstopień 0,15 m (0,12–0,17), stopnica 0,32 m (2h+s 0,60–0,66), liczba stopni z całkowitej różnicy wysokości końców biegu (NMT/LOD2, nie z wygładzonego gruntu na każdej stopnicy), spoczniki co najwyżej co 10–12 stopni zamiast rozciągania stopnic; (2) z daleka (od ok. 40 m) bieg jako jedna pochylnia z uśrednionym kolorem, bez linii podstopni; (3) kontrola skanu steps-riser-norm (podstopień i stopnica poza normą, nierówne stopnie w biegu) z bazą. Referencja: schody Placu Zamkowego, dwa biegi ze spocznikiem, szerokie granitowe stopnie (zdjęcie użytkownika w scratchpadzie ref/, tylko jako referencja wizualna).
- Status: w PR #593 (kurator r2 ZGODNE, d3097ea); wcześniej: naprawione w gałęzi (d3097ea), przegląd kuratora ZGODNE, PR; wcześniej: w naprawie, runda 2 (d3097ea), do przeglądu kuratora; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g840, 4f65035), do przeglądu kuratora; wcześniej: nowy
- Pakiet właściciela: packages/engine/src/renderer/mapcity (steps-plan), tools/glitch-scan
- Przegląd kuratora 15.11 @ 4f65035: NIEZGODNE (T-307). Do poprawy: (1) droga ze step_count dostaje tyle stopni, bez spoczników z maxRun (w1305889408: 40, w1305940836: 12, w1305940837: 13); (2) stopnica nie niżej niż 0,02 m pod terenem (15 biegów). Kontrole steps-count-osm, steps-landing-osm, steps-tread-sunk. Pochylnia od 35–45 m zaciera stopnie widoczne na zdjęciu z ok. 60 m: próg ok. 70 m. Kolor: G-850; podesty: G-849.
- Przegląd kuratora r2 (15.11, @ d3097ea): ZGODNE. Bieg główny w1305889408: 40 podstopni × 0,131 m, stopnice 0,38 m (2h+s 0,64), bez spocznika; stopnica najwyżej 0,005 m pod osią terenu (bez LIFT); pochylnia z daleka 65–75 m. Nawierzchnia i teren 0, hashe zgodne. Wzrost steps-riser-norm 4 → 23 klucze (28 trafień) uzasadniony. 21 trafień (16 kluczy) to biegi z OSM step_count, pod którymi teren gry wznosi się mniej niż liczba × 0,12 m (podstopień 0,047–0,119 m; ADR-0042: liczba z mapy ma pierwszeństwo przed normą), w tym 7 zamkowych (G-849). 7 trafień to za strome lub za krótkie pasy (stride 0,48–0,60): stare 572,-70 i 753–755,-149/-150 oraz nowe 730,160 i 736,143. steps-count-osm 14 kluczy (NMT 0,07–0,6 m na 3–15 stopni), steps-landing-osm 0, steps-tread-sunk 0. Otwarte z r1: stopnice z bliska za ciemne (do trawy 1,39 wobec 1,67–1,92 na zdjęciu; kontrola steps-albedo-drift).

### G-841 Zamek Lubelski bez przepisu zabytku: fasada od Placu Zamkowego jak zwykły gmach
- Ważność: S3 · Zasięg: Zamek Lubelski, front od Placu Zamkowego i schodów
- Opis: Zgłoszenie użytkownika 15.11 ze zdjęciem frontu (Street View, tylko referencja wizualna, scratchpad ref/zamek-plac-zamkowy-sv.jpg). LANDMARK_RECIPES ma tylko Bramę Krakowską, Bramę Grodzką i Nowy Ratusz. Wygląd do odtworzenia: neogotycka fasada w kolorze kremowym, dwie wieżyczki po bokach bramy z krenelażem i masztami flag, między nimi blankowana attyka; dwa okrągłe okna-rozety nad ostrołukową bramą z napisem MUZEUM; ostrołukowe okna w rzędzie, długie skrzydła z krenelażem po bokach; po lewej w głębi wieża kaplicy (smukła iglica); u stóp schody ze spocznikiem, latarnie i zieleń na skarpie. Wymiary z LOD2/NMPT i OSM, jak przy G-119 (Nowy Ratusz).
- Status: naprawione (PR #602); wcześniej: w PR #602; wcześniej: kurator r3 ZGODNE, do PR (6eea580); wcześniej: do przeglądu kuratora (r3, 6eea580); wcześniej: w naprawie (runda 3 po przeglądzie kuratora r2); wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-g841 (0c22d9d), runda 2 do przeglądu topography-curator; wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-g841 (e84492c), do przeglądu topography-curator; wcześniej: nowy
- Pakiet właściciela: packages/engine/src/renderer/mapcity/landmarks
- 15.11: przepis zamek-lubelski (attyka do y 7,5 z blankami, wieżyczki do y 10 z flagami, parapet z blankami trójkątnymi, 2 rozety, portal ostrołukowy, lancety, szyld MUZEUM); korekta importu: okap y 3,3, korona y 7,5 z NMPT; test landmark-zamek.test.ts; skan 3900->3900, hashe bez zmian, perf w budżetach
- Przegląd kuratora 15.11 (e84492c): NIEZGODNE. NMPT 0,5 m: wieżyczki do y 12,2 (rise 2,5 -> ok. 4,7), szczyty blanków trójkątnych ryzalitu y 10,0-10,4 (parapet.rise 0,5 -> ok. 1,6), maszty do ok. y 15,5 (mast ok. 5,5 m) jako ciemne metalowe iglice z chorągiewką zamiast flag biało-czerwonych (zdjęcie z placu, plan Z2). Skrzydła fasady zachodniej: jeden rząd lancetów w parterze, wyżej lizeny, okienka okrągłe co ok. 4,7 m i fryz ostrołukowy pod koroną zamiast rzędów 2 i 3. Opcjonalnie: rozety r ok. 1,7 m, rozstaw ok. 3,4 m; środki wieżyczek ok. 0,9 m do wnętrza (NMPT (837,1; 245,9) i (835,8; 231,0)). Sondy topo-g841-dsm*.py w scratchpadzie.
- 15.11 runda 2 (0c22d9d): wg NMPT kuratora: wieżyczki y 12,2, iglice do y 15,5 z chorągiewką, parapet ryzalitu do y 10,3, skrzydła: lancety w parterze, lizeny, okienka okrągłe 10 m, fryz arkadowy; rozety r 1,7; sterczyny; środki wieżyczek bez zmian (brak reguły z obrysu). Skan 3900->3900, hashe bez zmian, perf w budżetach
- Przegląd kuratora r2 (0c22d9d): NIEZGODNE. Przyjęte: wieżyczki y 12,2, iglice do 15,5, parapet 10,3, rozety, skrzydła zachodnie, środki wieżyczek (wspólne przesunięcie OSM/NMPT ok. +0,7 m w z, rozstaw 14,9 vs 14,95). Do poprawy: (1) korona skrzydła pn. od x ok. 855 i ściany wsch. (945..948, 237..257) wg NMPT y 5,4-5,8 zamiast 7,5 (regresja wobec main 6,4), okap pn. od dziedzińca ok. 4,5; (2) sterczyny tylko na NW (842,1;266,1) do y 10,3, SW (836,1;210,9) do 9,4, SE (943,6;197,9) do 10,9, ośmiobok o średnicy ok. 1,3 m z ostrym hełmem; bez sterczyn na narożach pd. (883;201), (897;200) i NE. Opcjonalnie portal i rozety 1-2 m wyżej. Elewacja pd. przepalona w słońcu (12,7%). Proponowana kontrola landmark-crown-nmpt. Sondy i zrzuty: scratchpad topo-g841-r2-*
- Runda 3 (6eea580): korona wg stref NMPT (pn. za x 855 i wsch. y 5,6, okap dziedzińca pn. 4,5), sterczyny tylko NW/SW/SE z hełmami, rozety +2 m, kontrola skanu landmark-crown-nmpt 1->0; do przeglądu topography-curator
- r3 (6eea580) przegląd kuratora: ZGODNE (korona 5,6/okap 4,5, 3 sterczyny, rozety); wysokości w przepisie jako T celowe; uskok OSM pn. skrzydła osobno (G-874)

### G-842 Sygnalizatory na jezdni wewnątrz dużych skrzyżowań (square na asfalcie)
- Ważność: S4 · Zasięg: Rondo Dmowskiego n1946478264 (1104,1;264,7), (1043,6;277,9); rondo Cybulskiego (2539,8;268,2), (2481,7;302,3); 3 Maja (-115,1;53,6)
- Opis: offRoad wybiera square we wnętrzu skrzyżowania, który na ortofoto jest asfaltem; łuk prawoskrętu przy Rondzie Dmowskiego (1095-1110; 261-265,8) ma w grze square zamiast jezdni. Narusza T-031. Proponowana kontrola signal-in-junction
- Status: nowy
- Pakiet właściciela: tools/osm-import (props-place)
- 15.11: n1946478264 po G-825 r3 stoi na klinie (1094,5; 279), który na ortofoto jest jezdnią; cel ok. (1104; 260,3) na placu za krawężnikiem (13 m od węzła, poza zasięgiem 12 m)

### G-843 Obrys zebry zachodzi pod chodnik
- Ważność: S4 · Zasięg: krakowskie-0-1 (434,3; -10,3)
- Opis: Znalezione przy etapie 1 ADR-0084 (woda). Klasa G-836 (zebry z węzłów)
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-845 Kliny wypełnień kerbFills na narożnikach dwóch ulic (krawężnik w Y)
- Ważność: S3 · Zasięg: Podzamcze (531,410), (770,531), (538,477); Nabrzeże (2637,250)
- Opis: runRings z 1–3 próbek o skoku szczeliny 0,3–2,8 m na styku dwóch jezdni; znalezione przy G-837 (zrzuty f7, f8)
- Status: nowy
- Klucze skanu: kerb-gap-bare krakowskie-0-1 -130,40; kerb-gap-bare krakowskie-1-1 220,150; kerb-gap-bare nabrzeze-1-0 2650,110; kerb-gap-bare nabrzeze-0-1 2360,430; kerb-gap-bare podzamcze-2-1 920,470
- Pakiet właściciela: tools/osm-import
- 15.11 (przegląd G-836): kliny V między drogą przejścia a chodnikiem na końcach zebr: kerb-gap-bare (−100,−70), (180,70), (2390,330), (2670,100), (650,550), (1060,460); kerb-jag (−125,45), (225,155), (2655,115)
- G-836 r2: ząbki i szczeliny przy końcach zebr (kerb-jag -112,154; 2363,435; kerb-gap-bare 920,473) przyjęte do bazy

### G-846 Karta podsumowania zlecenia zakrywa komunikaty i cel, na 1024x600 wychodzi poza ekran
- Ważność: S3 · Zasięg: HUD przy skali 1: desktop 1280x720 przecina komunikat; telefon przecina cel, drążek i komunikat; 1024x600 poza ekranem
- Opis: Sonda e2e agenta skalowania 15.11; poza zakresem ADR-0085 (PR #587)
- Status: naprawiony (main 16.11); wcześniej: naprawiony na ccr-ec2c4269-ilh8k8-g846 (c55aa4c, 9e1517b), w PR; wcześniej: nowy
- Pakiet właściciela: packages/ui
- Test: e2e/ui-scale.spec.ts contract card (70 kolizji na main → 0) + packages/ui/test/debrief-zone.test.tsx; hint poza kontrolą, środek karty na telefonie nie przewija się palcem

### G-847 Schody bez policzków: stopnice normy do 0,40 m nad terenem z boku pasa
- Ważność: S4 · Zasięg: biegi z mapy, najwięcej strome i ściśnięte (Plac Zamkowy)
- Opis: Po G-840 stopnice stoją nad terenem do 0,40 m (wcześniej do 1,49), boków brak; przerwa widoczna z boku. Propozycja: policzki w siatce gruntu, z wyłączeniem w kontrolach podstopni
- Status: nowy
- Pakiet właściciela: packages/engine/src/renderer/mapcity (steps-plan)

### G-848 Sim STEP_RISE 0,16 poza normą stopnia 0,15
- Ważność: S4 · Zasięg: flightRamps (packages/sim/src/content/lublin/shape.ts)
- Opis: STEP_RISE 0.16 zamiast STEP_NORM.riser z G-840; zmiana ruszy złoty hash determinizmu
- Status: nowy
- Pakiet właściciela: packages/sim

### G-849 Schody zamkowe: pochyłe podesty i plac zamiast poziomych
- Ważność: S3 · Zasięg: Podzamcze, schody Placu Zamkowego x 768..810, z 234..250
- Opis: Teren gry (NMT) wznosi się na podestach w1305889407 (781,4..784,6) o ok. 0,17 m/m i w1305940838 (800,3..802,6) o ok. 0,20 m/m, a plac 768..776,7 o 0,76 m; biegi pokonują 7,46 z 9,76 m. W rzeczywistości podesty są poziome, a wysokość jest na 65 stopniach (OSM). Oczekiwane: PADS na podestach, rzędy niskich stopni na placu (w1435832499). Proponowana kontrola steps-count-osm
- Status: nowy
- Pakiet właściciela: packages/sim/src/content/lublin (sites.ts, PADS) + tools/osm-import
- Po G-840 r2 biegi 2 (w1305940836) i 4 (w1305940837) mają liczbę stopni z OSM (12 i 13) przy podstopniach 0,094–0,099 i 0,080–0,086 m, bo wysokość zabierają pochyłe podesty. Klucze steps-riser-norm podzamcze-1-0 781,242 ×2, 782,245, 806,240 ×2, 807,242, 807,245 zejdą, gdy podesty będą poziome.

### G-850 Schody: stopnice ciemniejsze od granitu na ortofoto
- Ważność: S3 · Zasięg: wszystkie schody miasta, najbardziej Plac Zamkowy
- Opis: Stopnica #77736c (do trawy gry 1,39), podstopień #4f4b46 (0,91), z daleka ok. 1,23; ortofoto bieg główny Placu Zamkowego 1,67 (2025-04) / 1,92 (2024-06), plac obok to samo; paleta square 1,7. Oczekiwane: stopnica ≈ square (luminancja ok. 141), podstopień ciemniejszy tylko cieniowaniem. Proponowana kontrola steps-albedo-drift (baza 1). Zgłoszenie użytkownika 15.11: jasny granit na zdjęciu
- Status: nowy
- Pakiet właściciela: packages/engine/src/npr (toon-city.ts), steps-plan

### G-851 Szwy 0,1–0,25 m kerb-gap-bare na końcach pasów square po G-825
- Ważność: S4 · Zasięg: podzamcze-0-1 (530,390), podzamcze-2-0 (1110,330)
- Opis: Przyjęte w r3 G-825 (7bfd370); szczelina między końcem pasu square a krawędzią przesuniętej jezdni
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-852 touch-layout: karta dzielnicy raz zachodzi na minimapę przy 844×390 en
- Ważność: S4 · Zasięg: e2e touch-layout, phone district card, skala 1
- Opis: Jedno przecięcie 16×74 px przy obciążeniu maszyny, powtórka zielona; możliwy flake e2e albo wyścig układu przy wczytaniu karty (znalezione przy PR #587)
- Status: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-test-reliability, e4d1d3f); wcześniej: nowy
- Pakiet właściciela: e2e, packages/ui
- 15.11 porządki rejestru: G-868 to duplikat; pada też na czystym main e839d94 (en i pl, 844x390 i 800x370), w śladzie tylko karta dzielnicy, przyczyna nieustalona.
- przyczyna: pomiar karty w trakcie animacji wejścia trzymanej przez brak klatek (toast-in +30 px = 16×74); test czeka na Animation.finished; dowód: wjazd 20 s pada bez/przechodzi z; 10/10 repeat

### G-853 Pasy gołej ziemi między kostką deptaku Krakowskiego Przedmieścia a pierzejami
- Ważność: S3 · Zasięg: deptak x −100..440: 2141 m² w 10 m od osi (2765 m² w 20 m); największe (222,5;−70,6) 620 m², (291,0;−69,9) 592 m², (364,6;−86,0) 200 m²
- Opis: Zgłoszenie użytkownika 15.11. Import nie kładzie nawierzchni między krawędzią kostki (z ortofoto) a ścianami kamienic residential; goła ziemia w kolorze TERRAIN #514c45. Stan od pierwszego importu 29.10 (c0e87f3), malał (2472 → 2141 m²), nie regresja; bardziej widoczny po jaśniejszej kostce z ortofoto (13.11). Zrzuty scratchpad/g-deptak/cmp2/grid.png
- Status: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: do przeglądu kuratora (e3175f7); wcześniej: w naprawie (WIP 7ff493d, runda 2: meble niezależne od wypełnień frontu, nowe klucze skanu, grass-on-light-paving); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- Przegląd kuratora r2 (e3175f7): NIEZGODNE z jedną poprawką (cover-fixes wpis 2, plac budowy Zielona 5A); fronty i wpis 1 przyjęte (wpisy T); bs-291-pn: przyciemnienie nieodtwarzalne (148 na e3175f7); plamę trawnika użytkownik przyjął; e3175f7 to pusty commit
- r3 (aed9fb4): cover-fixes wpis 2 usunięty, front omija place budowy, fill-on-construction 3059→0, map-ground-golden e520204b; drzwi i graffiti: wysokość z kostki frontu (+0,08 m), zamierzone
- r3 (aed9fb4) przegląd kuratora: ZGODNE; place budowy wracają do stanu main (Zielona 5A 1464 m² gołej ziemi, ortofoto 2025-04 budowa); klucze 330,50 (T-314) i 0,90/0,100 (wykop muzeum 2025-04) uzasadnione; drzwi/figury +0,08 m tylko na froncie

### G-854 Plamy gołej ziemi przy Bramie Krakowskiej i wschodnich ulicach Starego Miasta
- Ważność: S4 · Zasięg: (503,0;−69,3) 90 m², (663,5;−38,0) 226 m², (664,8;−119,4) 86 m²; Stare Miasto ≤6 m od ulic 948 m²
- Opis: Ta sama przyczyna co deptak (brak nawierzchni przed pierzeją). Rynek wokół Trybunału bez dużych plam (szczeliny kilka dm)
- Status: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: nowy
- Pakiet właściciela: tools/osm-import

### G-855 Skan nie liczy gołej ziemi przy ulicach pieszych z kamienicami residential: brak kontroli frontage-bare
- Ważność: S4 · Zasięg: deptak 54 kwadraty 10 m (1546 m²) poza bazami, Stare Miasto 75 kwadratów (708 m²)
- Opis: landuse-bare liczy tylko commercial/civic, kerb-gap-bare ≤3 m od jezdni, ground-strip-gap ≤1,25 m; z 109 kwadratów deptaku 24 w bazach
- Status: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan

### G-856 Dołek między końcem muru nabrzeża W-3 a pokładem mostu Lutosławskiego
- Ważność: S4 · Zasięg: Nabrzeże, W-3, x 2477,5..2480, z 416,6..418,5
- Opis: Mur nabrzeża (bryła z wierzchem W3_Y) kończy się na z 418,5, a krawędź pokładu biegnie ukośnie (z 418,4 przy x 2477, 416,6 przy x 2480). W trójkącie ok. 2 m² teren ławy leży 0,2–0,8 m pod posadzką (groundY −28,8..−29,4); z nabrzeża widać go jako brązową dziurę przy końcu barierki (kadr w3r2-nabrzeze-sciana). Do wody się nie wyjdzie (szczelina przy x 2477 ma mniej niż 0,2 m). Oczekiwane: mur albo pad nabrzeża do krawędzi pokładu (wielokąt, nie prostokąt), wierzch W3_Y ±0,05. T-002
- Status: nowy
- Pakiet właściciela: packages/sim/src/content/tessen-w3 (site.ts, quay.ts), packages/sim/src/content/lublin/sites.ts

### G-857 crossing-shape-kerb liczy asfalt wlotu skrzyżowania i szwy jako brak krawężnika
- Ważność: S4 · Zasięg: np. (625,151), (913,345)
- Opis: Fałszywe trafienia kontroli z #581, znalezione przy G-836
- Status: nowy
- Pakiet właściciela: tools/glitch-scan
- Kurator 15.11 (G-836): (913,345) nie jest fałszywe, to zebra węzła n4586176953 skośna o ok. 50° (P3 G-836); prawdziwe są też (927,468) i (2361,432). Klucze kerb-gap-bare (−160,50) i (2680,360) bez zmiany nawierzchni w kwadracie: szum progu

### G-858 Wypełnienia gołej ziemi odrzucane przez crossesItself po cięciu
- Ważność: S4 · Zasięg: ok. 40 kawałków w mieście, największe 33 m² (975,407) i 28 m² (373,−171)
- Opis: cutByPieces odrzuca wypełnienia, których obrys po cięciu sam się przecina; znalezione przy G-853
- Status: nowy
- Pakiet właściciela: tools/osm-import
- 15.11 porządki rejestru: G-863 to duplikat tego wpisu; klucz frontage-bare 370,-170 (G-853 r2), największe miejsca (975,407) ok. 33 m², (373,-171) ok. 28 m².

### G-859 Reguła gołej ziemi przy krawężniku zmienia trawę i square co <5 m
- Ważność: S4 · Zasięg: kerb-fill-flicker: 71 znalezisk na main (komórki 0,5 m reguły gołej ziemi) i 7 trawników OSM sięgających jezdni
- Opis: Znalezione kontrolą z G-825 r4; baza 63 kluczy
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-860 Zygzak krawężnika 0,98 m przy zebrze łącznicy Ruskiej
- Ważność: S4 · Zasięg: podzamcze-2-1 (1059,8; 447,9), kerb-jag 1050,440
- Opis: Pas chodnika przesuniętej jezdni G-825 (r1–r3), złapany kontrolą kerb-jag z #581
- Status: nowy
- Pakiet właściciela: tools/osm-import
- kurator 15.11: wcięcie 0,33 m w krawędzi chodnika przy zebrze (1060,3–1060,8; 447,4–447,7) i odłamki sidewalk od G-825 r3 7bfd370; na main krawędź prosta; ortofoto 2025-04: krawężnik prosty

### G-861 Kalinowszczyzna przy wylocie łącznicy w175886780 (2361,432): jezdnia gry ok. 3 m węższa niż na ortofoto
- Ważność: S4 · Zasięg: nabrzeze-0-1, (2355..2368, 426..438)
- Opis: Jezdnia w1551268848 i w139586650 na osi ścieżki w406693442 ma w grze ok. 6,8 m, a na ortofoto 2025-04 i 2024-06 ok. 9,5–10 m. Zebra n4087364975 kończy się na krawężniku gry: 6,8 m wobec ok. 9 m pasów (przegląd G-836 r2).
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-862 Resztki G-825: square przy zebrze łącznicy Ruskiej na zieleni, trawa zamiast square przy Andersie
- Ważność: S4 · Zasięg: podzamcze-2-1 (1062–1066,4; 443,3–447,3); nabrzeze-0-1 (2355,6–2356,6; 357–358)
- Opis: Po G-825 r5: pas square przy zebrze ma 8,6 m², z czego 5,2 m² na zieleni ortofoto 2025-04 (zieleń do z 446,5 przy x 1062,5–1065, kostka tylko ok. 1 m przy krawędzi jezdni, możliwe G-826); na main granica szła po zieleni. Andersa: trawa zamiast square 0,3–0,8 m (kurator r4). Proponowana kontrola kerb-strip-square-on-green: pas square kerbFills z >50% i >2 m² zieleni ortofoto, baza 1 (podzamcze-2-1 1060,440).
- Status: nowy
- Pakiet właściciela: tools/osm-import (kerb-fill.ts)

### G-863 Wypełnienia gołej ziemi odrzucane przez crossesItself po cięciu
- Ważność: S4 · Zasięg: ok. 40 miejsc w mieście, największe (975,407) ok. 33 m², (373,-171) ok. 28 m²
- Opis: Zgłoszone przez naprawiacza G-853 r2: wypełnienie jest odrzucane przez crossesItself i miejsce zostaje gołe; mechanizm z main. Klucz frontage-bare 370,-170.
- Status: duplikat G-858 (to samo zgłoszenie z G-853 r2); prowadzone w G-858; wcześniej: nowy
- Pakiet właściciela: tools/osm-import

### G-864 ground-strip-gap liczy szczeliny pod budynkami
- Ważność: S4 · Zasięg: cały skan; 16 kluczy z G-853 r2 w całości pod budynkami
- Opis: Kontrola skanu ground-strip-gap nie odrzuca szczelin przykrytych budynkiem, więc baza rośnie o fałszywe alarmy.
- Status: naprawiony (main 16.11); wcześniej: w PR #609 (8840dbc); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-scan-false-alarms, 8840dbc); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan
- 8840dbc: ground-strip-gap pomija komórki w obrysach budynków (inBuilding); -53 klucze (1270->1217), 0 nowych

### G-865 model-donors.test.ts wyczerpuje pamięć przy wspólnym przebiegu kilku pakietów
- Ważność: S4 · Zasięg: packages/engine/test/model-donors.test.ts
- Opis: Zgłoszone przez naprawiacza G-853 r2: test:rerun kilku pakietów naraz kończy się brakiem pamięci w tym pliku; sam przechodzi.
- Status: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-test-reliability, 69b355a); wcześniej: nowy
- Pakiet właściciela: packages/engine
- przyczyna: NullEngine bez dispose w EngineStore, worker isolate:false (150 silników, 1722 MB po GC, OOM); setupFiles free-engines.ts; engine 1 worker: OOM -> 151/151; test:rerun engine ui app OK

### G-866 cover-fixes: plac budowy Zielona 5A opisany jako ogródek kawiarni, front kładzie na nim trawę i kostkę
- Ważność: S4 · Zasięg: Krakowskie (249–256; 1–7), 48 próbek pokrycia, ok. 40 m² frontu
- Opis: Przegląd kuratora G-853 r2: drugi wpis COVER_FIXES opiera się na złym odczycie ortofoto (2025-04 budowa, 2024-06 działka, 2023-09 korony; OSM building=construction w1382552286, landuse=construction w770678456). Usunąć wpis i wyłączyć landuse=construction z frontów jak trawniki OSM. Proponowana kontrola fill-on-construction (baza co najmniej 1). Naprawa w ramach G-853 r3.
- Status: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: do przeglądu kuratora (aed9fb4); wcześniej: w naprawie
- Pakiet właściciela: tools/orto, tools/osm-import
- r3 (aed9fb4): wpis cover-fixes 2 usunięty, front omija landuse/building=construction, fill-on-construction 3059 -> 0; przegląd kuratora ZGODNE

### G-867 glitch-shots: ta sama treść daje raz klatkę w cieniu (jasność 49), raz w słońcu (148)
- Ważność: S4 · Zasięg: bs-291-pn (291; −78), przebieg naprawiacza G-853 r2 na e04c860 wobec dwóch przebiegów kuratora na e3175f7 (to samo drzewo)
- Opis: Przyczyna nieustalona: oświetlenie albo cień w przebiegu zrzutów, nie geometria. Zrzuty: scratchpad/g853/shots2 i scratchpad/topo-g853r2/shots2
- Status: naprawiony (main 16.11); wcześniej: w PR #618; wcześniej: nowy
- Pakiet właściciela: packages/engine
- odtworzone na e3175f7 (2/6 stron, 54,1/46,4 wobec 147,2); main 9/9 = 107,3; różnica w treści statycznej mapy cienia księżyca (+335..407 tys. tekseli) przy tych samych rzucających, macierzach i stanie GL; nie zegar, paleta, losowość; kandydaci: shareDepth, kolejność wobec sondy mokrego asfaltu, SwiftShader; capture() po view() zwraca poprzednią klatkę (inna sprawa); bez poprawki
- przyczyna: getIndices() bez kopii w rebuildStaticProxy + MergeMeshes wydłuża indeksy pierwszego klonu w miejscu, nowe proxy indeksuje poza wierzchołki; bez poprawki 6/33 stron inna mapa, z poprawką 12/12; test moon-shadow-proxy.test.ts

### G-868 touch-layout:503 flaky: karta dzielnicy zakrywa minimapę o 16×74 px
- Ważność: S4 · Zasięg: e2e/touch-layout.spec.ts:503, 844x390 i 800x370, en i pl
- Opis: Pada sporadycznie, także na czystym main e839d94; przechodzi w retry. W śladzie porażki na ekranie tylko karta dzielnicy, przyczyna nieustalona.
- Status: duplikat G-852 (ten sam flaky touch-layout:503); prowadzone w G-852; wcześniej: nowy
- Pakiet właściciela: packages/ui

### G-869 crossing-shape-kerb przeczy kerb-jag przy skośnym krawężniku: zebra-prostokąt kończy się przed krawężnikiem albo wcina róg w chodnik
- Ważność: S4 · Zasięg: 6 miejsc, np. (158,-198), (676,570)
- Opis: Po G-836 r3: koniec zebry przechodzi na koniec boku, więc 0,2–0,5 m przed krawężnikiem w osi; alternatywa wcina róg w chodnik (test G-837 kerb-jag-places). Baza crossing-shape-kerb 42->46 przyjęta przez użytkownika 15.11 do czasu naprawy. Docelowo koniec zebry dopasowany do skośnego krawężnika (czworokąt), wtedy baza wraca w dół.
- Status: nowy
- Pakiet właściciela: tools/osm-import (zebra-fit.ts)
- Kurator 15.11 (G-836 r3): ten sam rodzaj w kluczach ze scalenia main e3a5bdc: (−122,50), (185,75), (1090,255), 0,3–0,5 m; zasięg 9 miejsc

### G-871 Front ulicy pieszej przechodzi przez mur OSM na podwórze przy Zielonej
- Ważność: S4 · Zasięg: Zielona (296–310; −33..−20), podwórze za murem w503177989
- Opis: Front ulicy pieszej przechodzi przez barrier=wall OSM (inSight zatrzymują tylko ściany budynków) i kładzie kostkę na podwórzu z wjazdem w503177990; uwaga kuratora G-853 r2
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-872 Karmelicka 7: stojący budynek z building=construction pominięty przez SKIP_BUILDING
- Ważność: S3 · Zasięg: w1134342880 (311..335; 56..98), Krakowskie
- Opis: Ortofoto 2023-09, 2024-06 i 2025-04 pokazuje dach budynku; OSM building=construction, construction=commercial; w grze goła ziemia bez bryły (SKIP_BUILDING w generate.ts). Znalezione w przeglądzie kuratora G-853 r3. Test: bryła Karmelicka 7 z wysokością z LoD1/NMPT; proponowana kontrola osm-construction-built 1 -> 0.
- Status: naprawiony (main 16.11); wcześniej: w PR #631 (9 kluczy przyjętych decyzją użytkownika 16.11); wcześniej: wstrzymane do rana: decyzja użytkownika o 17 kluczach skanu (podniesienie bazy) i scalenie po #599; gałąź 2514e3b; wcześniej: w naprawie, runda 2 (przedpole: landuse=construction w1261814241); wcześniej: do przeglądu kuratora (6bbd199), skan czerwony: +15/+10/+5 kluczy przy bryle; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g872); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- builtSites (cfec849, 6bbd199): building=construction pod LoD1 2024 (IoU>=0,7) jako budynek, bryła 19,7 m commercial; osm-construction-built 1->0; przy bryle +15 landuse-bare, +10 bare-on-cover, +5 ground-strip-gap (goła ziemia sprzed poprawki, teraz przedpole sklepu); baza nie podniesiona, czeka na przegląd kuratora i decyzję
- przegląd kuratora (cfec849): bryła zgodna; 30 kluczy przedpola NIE do bazy: 26 w landuse=construction w1261814241 (nieaktualna budowa). Ortofoto: wsch./pn./pas przy ścianie zach. i NW -> grass, pd. nieutwardzony parking -> square. r2: landuse=construction z budynkiem z builtSites jak zakończona budowa + klasy other/cień z innych nalotów; cel +15/+10/+5 -> 0. Proponowana kontrola construction-landuse-built (baza 1).
- r2 2514e3b: działka w1261814241 zakończona (withBuiltSites), classifySite na działce; zostaje 16 kluczy + fill-on-green 1 (5 na linii ściany, 3 asfalt poza działką, 3 szczeliny); kolizja z #599 (krakowskie.cover.png, build.ts, generate.ts).
- 16.11 decyzja użytkownika: przyjąć 17 kluczy skanu z uzasadnieniem; PR po scaleniu #599.
- 16.11 decyzja użytkownika: po #599 przyjąć 9 kluczy w krakowskie-2-1 (3 z uzgodnienia, 5 fill-gap, 1 ground-strip-gap) i zmianę skanu: place budowy jak w imporcie

### G-874 Zamek Lubelski: skrzydło pn. x 904-942 o 2,6-3,0 m za daleko na północ (uskok obrysu OSM), bryła na asfalcie drogi za zamkiem
- Ważność: S3 · Zasięg: Podzamcze, w48500136, (903,9..941,5; 253,8..261,6)
- Opis: Węzły (903,9;261,6) i (941,5;256,8) tworzą uskok, którego nie ma w NMPT (krawędź x 910/925/940: z 257,75/256,3/254,0) ani na ortofoto 2023-09..2025-04; ściany zach. i pd. zgodne do 0,4 m. Poprawka: obrys pn. prosto (903,6;258,6)->(941,0;253,8) w korekcie importu. Przegląd kuratora G-841 r3. Proponowana kontrola landmark-outline-nmpt (baza 1).
- Status: naprawione (PR #616); wcześniej: przegląd kuratora ZGODNE (890681a), w PR; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g874 (890681a), do przeglądu kuratora; wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: krawędź obrysu pn. w48500136 w 0,5 m od krawędzi dachu NMPT przy x 910, 925, 940
- 16.11: drop węzłów uskoku w korekcie importu; ściana x 910/925/940 z 257,75/255,77/253,79 (odchyłka do 0,53 m przy x 925, wewnątrz dachu); kontrola landmark-outline-nmpt 1->0; 2 klucze przyjęte przez agenta (landuse-bare podzamcze-1-0 910,250; bare-on-cover podzamcze-2-0 930,250: goły pas odsłonięty spod bryły, G-699) — do potwierdzenia użytkownika; kolizja z #602: łatka g874-x602-resolution.patch
- 16.11 użytkownik zatwierdził 2 przyjęte klucze (pas spod bryły, G-699).
- 16.11 przegląd kuratora 890681a: ZGODNE (odchyłka jednostronna, ściana 0,2-0,5 m w głąb krawędzi dachu NMPT = okap; próg 0,55 akceptowalny; zniknięcie narożnika 941,0;253,8 słuszne)

### G-875 Skan: próbka na linii ukośnej ściany liczona jako goła (zaokrąglony obrys 0,1 m)
- Ważność: S4 · Zasięg: tools/glitch-scan landuse-bare, bare-on-cover; krakowskie-2-1 Karmelicka 7
- Opis: Ściana o nachyleniu 2:1 przechodzi przez siatkę 0,25/0,75 o 2-3 mm od obrysu tabeli; import uznaje próbkę za wnętrze, skan za ziemię (G-872 r2: 5 kluczy).
- Status: naprawiony (main 16.11); wcześniej: w PR #609 (066b575); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan
- Łatka gotowa (scratchpad/g875-fix.patch: próbka w obrysie z mapy i <=0,1 m od ściany tablicy): landuse-bare -36, bare-on-cover -47, ale +1 kerb-gap-bare krakowskie-0-0 -60,-170 (ta sama prawdziwa goła szczelina przy krawężniku przechodzi z landuse-bare do kerb-gap-bare przez landuseBareAt); czeka na decyzję użytkownika: accept 1 klucza (bilans -82) albo zmiana landuseBareAt na próbki 0,25 m
- 16.11 decyzja użytkownika: przyjąć 1 klucz kerb-gap-bare krakowskie-0-0 -60,-170 (bilans −82); łatka na gałęzi #609.
- 066b575: próbka w obrysie z mapy i najwyżej 0,1 m od ściany tablicy zakryta; landuse-bare -36, bare-on-cover -47, kerb-gap-bare +1 (accept, krakowskie-0-0 -60,-170, przesunięcie rodzaju, decyzja użytkownika 16.11); bilans -82

### G-876 Karta podsumowania na telefonie zakrywa buffy i .gear pod celem
- Ważność: S4 · Zasięg: telefon, karta .debrief przy aktywnym buffie
- Opis: Karta od 84 px pod celem leży na .buffs (84 px) i .touch-mode .gear (92 px); znalezione przy G-846
- Status: w PR (gałąź ccr-ec2c4269-ilh8k8-s4-ui-tests, 7e83f9c; zależy od #607); wcześniej: nowy
- Pakiet właściciela: packages/ui
- gear na telefonie ma display:none; karta zakrywała buffy także na pulpicie 1024x600 @1, naprawione tą samą regułą

### G-877 city-kit-loader.test.ts pada w workerze isolate:false, gdy city-kit-loader jest już w pamięci modułów
- Ważność: S4 · Zasięg: packages/engine/test/city-kit-loader.test.ts, projekt shared
- Opis: vi.mock city-kit nie działa, gdy moduł jest już załadowany w workerze (kolejność plików); znalezione przy G-865
- Status: w PR (gałąź ccr-ec2c4269-ilh8k8-s4-ui-tests, f83ba80); wcześniej: nowy
- Pakiet właściciela: packages/engine

### G-878 touch-layout scan card: .scan-note wjeżdża toast-in, pomiar w trakcie animacji jak G-852
- Ważność: S4 · Zasięg: e2e/touch-layout.spec.ts karta skanu
- Opis: .scan-note dalej używa toast-in 200 ms (+30 px); test może mierzyć w trakcie animacji pod obciążeniem; znalezione przy G-852
- Status: nie odtwarza się (16.11, partia s4-ui-tests); do zamknięcia przy przeglądzie, jeśli się nie pojawi; wcześniej: nowy
- Pakiet właściciela: e2e
- nie odtwarza się: .scan-note nie powstaje w teście karty skanu; hint-in 8 px przy zapasie 31-46 px; bez zmian w kodzie

### G-879 Uproszczenie obrysu budynku (0,3 m) zostawia gołe próbki między ścianą tablicy a obrysem z mapy
- Ważność: S4 · Zasięg: import budynków (prepareOutline), całe miasto
- Opis: Import zakrywa ziemię obrysem z mapy, tablica trzyma obrys uproszczony do 0,3 m; między nimi zostają gołe próbki, które skan słusznie liczy. Znalezione przy G-875.
- Status: nowy
- Pakiet właściciela: tools/osm-import

### G-880 Robotniki vitest projektu shared dochodzą do ok. 1,8 GB sterty przy limicie Node 2 GB
- Ważność: S4 · Zasięg: vitest.config.ts projekt shared (isolate: false), pełne test:coverage
- Opis: Zgłoszone przy ADR-0083 krok 3: jeden robotnik przekroczył 2 GB w teście modeli engine, także z SEKI_CITY_CACHE=off (stan sprzed zmiany). Możliwy związek z G-865 (silniki bez dispose, PR #608).
- Status: nowy
- Pakiet właściciela: vitest.config.ts, packages/engine/test

### G-881 barrier-detour-cost i traffic-bodies-shifted: podniesiony vi.mock w projekcie shared (isolate:false)
- Ważność: S4 · Zasięg: packages/sim/test/barrier-detour-cost.test.ts, traffic-bodies-shifted.test.ts
- Opis: Ten sam wzorzec co G-877: vi.mock nie sięga modułu już załadowanego w workerze; możliwa ta sama wada przy pewnej kolejności plików. Znalezione przy G-877.
- Status: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-g881, 74d3cfe); wcześniej: nowy
- Pakiet właściciela: packages/sim
- Wada realna: po pliku ładującym ../src vi.mock nie docierał (0 odczytów zmockowanego TRAFFIC_ROUTES wobec 91 597), testy przechodziły bez sprawdzania; resetModules + doMock + dynamiczne importy, strażniki (pas przesunięty < 0,05 m, routeAcrossLevels zmockowane).

### G-882 Efekty quickhacków (hackFx) nie trafiają do zapisu: po wczytaniu kamera po reboot_optics widzi od razu
- Ważność: S3 · Zasięg: zapis w trakcie quickhacka
- Opis: Znalezisko z W-3 etap 3: hackFx (np. blind z reboot_optics) nie jest zapisywany, więc wczytanie gry przywraca wzrok kamerze.
- Status: naprawiony (main 16.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim, packages/persistence

### G-883 Zapis w trakcie walki rozjeżdża się po wczytaniu: przechodzień zawraca, yaw gracza i RNG walki inne
- Ważność: S3 · Zasięg: podłoga determinizmu, ziarno 1234, zapis w krokach 200–1000 floorScript(); pierwszy krok po wczytaniu
- Opis: przechodzień (bystander) zmienia yaw o ok. pi; przy pałce yaw gracza o 0,1 rad; ok. ticku 1000 inne rngState i HP gangera; stan mózgu cywila i walki nie jest w zapisie (znalezisko z gałęzi determinism-floor)
- Status: naprawiony (main 16.11); wcześniej: w PR #632 (zapis v41); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai, packages/sim/src/world
- Druga przyczyna: przeładowanie gracza w toku nie jest w zapisie (gunOf w world/factory.ts:336 pomija gracza); zapis w trakcie przeładowania daje strzał w pierwszym kroku po wczytaniu, także bez tłumu i ruchu; it.todo w packages/sim/test/traffic-panic.test.ts (PR luki determinizmu)

### G-884 Przypięty strażnik liczy co krok linię wzroku i marsz po całym odcinku do dalekiego gracza (2,4 km)
- Ważność: S3 · Zasięg: strażnicy przypięci do gracza (G-188, G-201), cała gra
- Opis: W pinned-far-sleep 64% czasu to straightWalk, lineOfSight i bankBetween liczone co krok po całym odcinku do gracza 2,4 km dalej. Koszt CPU w grze (telefon) i w testach; do ograniczenia zasięgu albo częstotliwości (profil z partii 2 testów na podłogach).
- Status: naprawiony (main 16.11, #629); wcześniej: w PR #629; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Przyczyna: lineOfSight brał wszystkie bryły prostokąta odcinka (2300/krok); teraz tylko komórki, które odcinek przecina (5/krok), wynik identyczny, hash bez zmian; pinned-far-sleep −21,5%

### G-885 Walczący pod mostem nie wchodzi na pomost do gracza stojącego na nim
- Ważność: S4 · Zasięg: mosty z pomostem (Mełgiewska)
- Opis: Brawler z (2445.9, 302.2) pod pomostem do gracza na (2444.9, 307.5) oscyluje przy krawędzi cienia pomostu (2449.6, 298.9), 30 s bez dotarcia; znalezione przy G-072
- Status: naprawione (PR #646); wcześniej: w PR #646; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai

### G-886 Pościg 200 m: bankBetween próbkuje cały odcinek co krok
- Ważność: S4 · Zasięg: pościg strażnika za graczem w zasięgu
- Opis: pinned-far-sleep calmWest (cel 2670,300): 9544 pełnych bankBetween po 400 próbek steepAt, ok. 2,8 s pliku; znalezione przy G-884
- Status: naprawiony (main 16.11); wcześniej: w PR #630; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- GentleBlocks: bankBetween pyta o spadek tylko poza łagodnymi blokami terenu; pościg 200 m 1190 -> 94 steepAt, pinned-far-sleep (6 s) -44%, hashe bez zmian; to samo do nav-raster.ts:209 i walkable

### G-887 Szczeliny fill-gap wzdłuż północnej ściany bryły Karmelickiej 7
- Ważność: S4 · Zasięg: krakowskie-2-1, 327..333,98..100
- Opis: Po G-872 (bryła Karmelickiej 7) 5 szczelin 0,02–0,11 m² między wypełnieniem a północną ścianą bryły; klucze przyjęte w bazie decyzją użytkownika 16.11, do naprawy w imporcie
- Status: zgłoszone
- Klucze skanu: fill-gap krakowskie-2-1 327,100; fill-gap krakowskie-2-1 328,100; fill-gap krakowskie-2-1 330,99; fill-gap krakowskie-2-1 331,99; fill-gap krakowskie-2-1 333,98
- Pakiet właściciela: tools/osm-import

### G-888 Po wczytaniu gracz ma health.max 100 do pierwszego kroku player-control
- Ważność: S4 · Zasięg: wczytanie gry, apteczka w pierwszym kroku
- Opis: W grze źródłowej max 103 (np. podłoga determinizmu, zapis w kroku 786); apteczka w pierwszym kroku po wczytaniu leczy do 100. player-control-system.ts:267, factory.ts:60. Znalezione przez weryfikatora G-883, jest też na bazie.
- Status: naprawiony (PR #636); wcześniej: w PR #636; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-889 joinLoose dołącza do frontu deptaka wąskie pasy dowolnie daleko od osi (pas zieleni za Karmelicką 12–37 m)
- Ważność: S4 · Zasięg: Karmelicka: pas ścieżka–parking (344..351; 58..88), ok. 47 m² kostki na zieleni
- Opis: Przegląd kuratora #595: zoneFronts/joinLoose (bare-fronts.ts) dołącza do frontu każdy wolny region o średniej szerokości <3 m stykający się z frontem, bez limitu odległości od osi; pas zarośli dostaje kostkę (ortofoto 2024-06). Propozycja: dołączać tylko komórki w reach+zoneMargin+FRONT.strip od osi; kontrola skanu front-far.
- Status: odłożone (17.11, pierwsze podejście za szerokie, wariant b w notatce); wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: pas (344..351; 58..88): brak komórek frontu dalej niż 14 m od osi Karmelickiej; kostka na pasie poniżej 5 m²
- 17.11 noc (agent, gałąź ccr-ec2c4269-ilh8k8-g889, 65ab11b, nie do scalenia): odcięcie joinLoose na reach+zoneMargin+FRONT.strip (14 m) naprawia pas (kostka 28,75 → 4,5 m²), ale w mieście zabiera ok. 2017 m² kostki, z czego 993 m² potwierdza ortofoto, i daje 41 nowych kluczy skanu (landuse-bare +12, ground-strip-gap +19, bare-on-cover +5, kerb-gap-bare +3, fill-on-green +1, metro-exit-bare +1), walk-lawn-bare 14 954 > 14 600. Następne podejście (wariant b): za 14 m nie kłaść kostki domyślnej (korony, cień, komórki bez klasy), zostawić to, co ortofoto pokazuje samo; front-far wtedy z bazą. Pole frontu bez osi deptaka w krakowskie-1-0 (130..160; −160..−100) to ten sam mechanizm.

### G-890 Plamka zieleni pokrycia przy krawężniku w kostce zostaje trawnikiem (T-285) i migocze z kostką
- Ważność: S4 · Zasięg: pierwszy przebieg reguły gołej ziemi, całe miasto
- Opis: joinSpecks (T-285) zostawia plamkę zieleni z pokrycia dotykającą jezdni jako trawnik w kostce; kerb-fill-flicker. Klucze krakowskie-2-1 300,100 i 310,50 przyjęte 16.11 (G-825, #595). Do decyzji kuratora: plamka przy krawężniku nie jest dołem po drzewie.
- Status: zgłoszone
- Pakiet właściciela: tools/osm-import
- Klucze skanu: kerb-fill-flicker krakowskie-2-1 300,100; kerb-fill-flicker krakowskie-2-1 310,50

### G-891 Zakłócenia ulicy z wybuchu, alarmu i znalezienia ciała nie trafiają do zapisu
- Ważność: S4 · Zasięg: zapis dokładnie w kroku zdarzenia
- Opis: disturb() (sabotage-loud.ts:150, contract-system.ts:36, body-watch-system.ts:59) trafia do session.street.disturbances, których nie ma w zapisie; zapis w kroku wybuchu rozjeżdża hash od drugiego kroku. Znalezione przez weryfikatora W-3 3b (#633); klasa sprzed 3b.
- Status: naprawiony (PR #637); wcześniej: w PR #637; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- calmForSave czyści street.disturbances razem ze strachem tłumu (jak G-240); złote hashe bez zmian, bez v43; test w w3-sabotage-loud.test.ts

### G-892 Maksimum zdrowia po awansie albo implancie spóźnia się o krok: apteczka zaraz potem leczy do starego
- Ważność: S4 · Zasięg: krok awansu lub założenia implantu
- Opis: playerStatsOf().maxHp trafia do health.max dopiero w player-control; item-system i komenda use-item idą przed nim (systems/index.ts:134-135). Deterministyczne, nie rozjeżdża zapisu. Znalezione przy G-888.
- Status: naprawione (PR #643); wcześniej: w PR #643; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-893 Rusztowanie placu Zielona 5A zasłania szyld lokalu na ścianie w67499313
- Ważność: S4 · Zasięg: jedno miejsce, Zielona 5A
- Opis: Rusztowanie z banerem z etapu 2 placów budowy (gałąź place-budowy-2) stoi przy ścianie w67499313 i zasłania szyld FRYZURA Z PRZYTUPEM; rusztowanie powinno omijać ściany z szyldem lokalu albo szyld przenieść.
- Status: naprawione (PR #649); wcześniej: w PR #649; wcześniej: nowy
- Pakiet właściciela: osm-import
- Poprawka identyfikatora (kurator 16.11): rusztowanie stoi 0,25 m od szczytowej ściany w69915878 (Zielona 5), nie w67499313; szyld FRYZURA Z PRZYTUPEM sprawdzić na tej ścianie.

### G-894 Dźwig 66 m przed fasadą Pałacu Lubomirskich od Placu Litewskiego (plac budowy Muzeum Ziem Wschodnich)
- Ważność: S4 · Zasięg: plac budowy w1362895448, widok z Placu Litewskiego
- Opis: Generator dźwigu (construction-crane.ts, ADR-0087 etap 2, gałąź place-budowy-2) stawia maszt w (41; 78) w południowej wnęce Pałacu Lubomirskich w67508859 (historic=castle), między fasadą a Placem Litewskim; 27,1 m, wysięgnik 66 m nad dachem zabytku. Ortofoto 2025-04: budowa trwa (wykop na pn. podwórzu, kontenery), żurawia wieżowego brak; 2024-06 we wnęce trawnik. Miejsce wynika tylko z minimalnego zasięgu do najdalszego narożnika obrysu, który obejmuje cały pałac. Proponowana reguła: na placu, którego obrys obejmuje budynek historic/heritage, maszt nie stoi między fasadą zabytku a placem lub ulicą frontową (preferuj podwórze z wykopem), inaczej bez dźwigu albo wysięgnik do 50 m; kontrola skanu site-crane-heritage z wyjątkiem w1236055101 (żuraw na ortofoto 2025-04).
- Status: naprawione (PR #649); wcześniej: w PR #649; wcześniej: nowe
- Pakiet właściciela: tools/osm-import, engine mapcity/construction
- Test przyjęcia: construction-site.test.ts: dźwig w1362895448 nie stoi przed fasadą w67508859; skan site-crane-heritage 1 -> 0
- Topografia: T-322.

### G-895 Szybkie użycie apteczki pomija atut Field Medic
- Ważność: S4 · Zasięg: klawisz szybkiego użycia apteczki z atutem Field Medic
- Opis: item-system woła useConsumable bez healScale(perks); komenda use-item go stosuje, więc atut działa tylko przy komendzie. Znalezione przy G-892.
- Status: naprawione (PR #645); wcześniej: w PR #645; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-896 Walczący przy końcu pomostu na poziomie jezdni nie idzie po pomoście do gracza
- Ważność: S4 · Zasięg: końce mostów z pomostem (Mełgiewska, wiadukt Zamkowej)
- Opis: Brawler z (2454.9, 297.0) do gracza na pomoście nabrzeze-0-1[1] w t=0,2 i z (758.0, 188.5) do gracza na wiadukcie Zamkowej (748.9, 173.4) stoi 20 s, deckLanding zwraca null; tak samo na main i z poprawką G-885. Znalezione przy G-885 (sondy: scratchpad g885-probe*.test.ts).
- Status: naprawione (PR #647); wcześniej: w PR #647; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Weryfikator #646: wiadukt Zamkowej, brawler z Podwala (745, 169.8) do gracza na pomoście (748.9, 173.4) wchodzi na pomost, ok. 25 s stoi w (758.0, 188.5), schodzi pod wiadukt i staje w (745.1, 170.0); w 60 s nie dociera. Do (755, 180) dociera w 8 s.

### G-897 Migotanie trawa/plac przy końcu zebry (podzamcze-2-1)
- Ważność: S4 · Zasięg: podzamcze-2-1 1060,470, koniec zebry między placami
- Opis: Po G-836 (zebry przy placach, #597) 1 m trawy między placami przy końcu zebry migocze z placem (kerb-fill-flicker). Klucz przyjęty w bazie decyzją użytkownika 16.11, do naprawy w imporcie (kerb-fill.ts).
- Status: naprawione (PR #654); wcześniej: w PR #654; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import
- Klucze skanu: kerb-fill-flicker podzamcze-2-1 1060,470

### G-898 Walczący w pasie 10 cm poniżej jezdni przy dolnym moście Mełgiewskiej nie wychodzi do gracza na pomoście
- Ważność: S4 · Zasięg: dolny most Mełgiewskiej, (2454,9; 297,05), gracz na nabrzeze-0-1[1] t=0,4
- Opis: Strome krawędzie terenu poniżej STEP_HEIGHT zatrzymują ruch (offTheBank), a raster ich nie widzi; odchylenie ±31° nie wyprowadza na wschód. Przed i po G-896 (#647). Źródło w imporcie terenu albo w regule offTheBank. Sondy: scratchpad g896-probe.test.ts.
- Status: naprawione (PR #655); wcześniej: w PR #655; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (ruch, teren)

### G-899 Walczący z treści po wczytaniu w trakcie pościgu stoi jeden krok (velocity undefined, yaw o 0,1)
- Ważność: S4 · Zasięg: zapis i wczytanie w trakcie pościgu walczącego z treści (np. hebi-grodzka)
- Opis: Sonda weryfikatora #647: po wczytaniu w trakcie pościgu walczący z treści stoi jeden krok, velocity undefined, yaw różni się o 0,1; hash rozjeżdża się od pierwszego kroku (24 z 33 zapisów, tick 543). Tak samo na main. Sonda ręcznie zmieniała alerted i pozycję, więc do potwierdzenia przez łowcę (scratchpad v-g896-sl-*.json). Pokrewne G-883 (v41: prędkości).
- Status: nie potwierdzone (łowca 16.11); wcześniej: do potwierdzenia
- Pakiet właściciela: packages/sim, packages/persistence
- Łowca: 0 rozjazdów w ok. 700 zapisach (hebi-grodzka, hebi-bramowa, ziarna 3-5, strzał z 9 i 22 m, ucieczka sprintem). Sonda #647 daje 21 z 30 tylko po ręcznym przeniesieniu walczącego 130 m od posterunku. Hipoteza nieuzasadniona: zimna pamięć nawigacji (nav-memo, chase-queue) po wczytaniu w pościgu z objazdem bariery; tego wariantu nie sprawdzono. Pułapka sond: te same wejścia i yaw gracza obu symulacjom.
- Ta sama pułapka sondy co w G-900: zapis bez calmForSave.

### G-900 Zapis w trakcie pościgu gubi zgłoszenie przestępstwa, które przychodzi chwilę później
- Ważność: S3 · Zasięg: zapis i wczytanie w trakcie pościgu walczącego z treści
- Opis: Łowca G-899: hebi-bramowa, gracz ucieka sprintem, ziarna 3, 4, 5, zapis w kroku 1005 od startu pościgu (gracz 51 m od walczącego). Po 16 krokach gra żywa ma domain.heat poziom 1 (frakcja hebi, searchLeft 20, cooldown 7,98) i reinforcements.sent 1; wczytana ma heat 0 i reinforcements undefined. Stan przed zapisem identyczny. Przypuszczalnie licznik zgłoszenia (telefon świadka, m.call w crowd, WITNESS_CALL_SECONDS w crime-system.ts) poza zapisem; może się pokrywać z G-891. Sondy: scratchpad g899-heat.txt.
- Status: nie potwierdzone (artefakt sondy, 16.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim, packages/persistence
- Naprawiacz 16.11: artefakt sondy, zapis bez calmForSave. Gra zapisuje przez SaveController.snapshot() → sim.calmForSave() → settleCalls (G-240), więc zgłoszenie w toku przychodzi w chwili zapisu w obu grach. Z calmForSave 0 rozjazdów heat w ok. 400 zapisach (Lublin, 576,-24, ziarno 3), bez niego sygnatura G-900 (289+16). Sonda: scratchpad g900/g900-probe2.test.ts. Skutek projektu: zapis w trakcie rozmowy świadka przyspiesza zgłoszenie najwyżej o 5 s.

### G-901 Próg samoobrony (session.lastThreat) poza zapisem: strzał gracza tuż po strzale wroga po wczytaniu liczy się jako przestępstwo
- Ważność: S4 · Zasięg: zapis i wczytanie do 3 s po strzale wroga
- Opis: Znalezione przy G-900 (czytanie kodu, bez pomiaru): session.lastThreat (próg 3 s, playerEngaged w world/street.ts) nie trafia do zapisu. Po wczytaniu strzał gracza w ciągu 3 s po strzale wroga liczy się jako przestępstwo, w grze żywej nie. Do potwierdzenia przez łowcę; sonda musi zapisywać przez calmForSave (jak SaveController.snapshot).
- Status: naprawione (PR #653); wcześniej: w PR #653; wcześniej: potwierdzone (łowca 16.11); wcześniej: do potwierdzenia
- Pakiet właściciela: packages/sim
- Łowca: lastThreat (combat-system.ts:128 threaten) nie wchodzi do SaveSnapshot, a calmForSave go nie zeruje. Po wczytaniu strzał gracza <3 s po strzale wroga, gdy w 30 m nie ma zaangażowanego AI (np. strzelec zabity), daje offend(gunfire): incidents 1 zamiast 0, ziarna 4, 1, 7 (scena streetSim, zapis jak SaveController.snapshot). Czytają go też scanner-system.ts:162 i hud-sync.ts:36 (isCalm), niezmierzone.

### G-904 Stopy wychodzą z piwnicy W-3 na teren o 2,2 m w jednym kroku (2474,9; 408,5)
- Ważność: S3 · Zasięg: piwnica W-3, wyjście przy (2474,9; 408,5)
- Opis: Znalezione przy G-903: stopy z podłogi piwnicy (−30,2) wychodzą na teren (−28,0), +2,18 m w jednym kroku, także w pełnej symulacji z kolizjami (4 przypadki gracza po poprawce G-903). Bez pomostu, więc reguła deckSide tego nie obejmuje. Sondy: scratchpad g903-sim-probe.test.ts.
- Status: nie potwierdzone (artefakt sondy, 17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (ruch, W-3)
- 17.11 (orkiestrator, tryb bez agentów): w grze się nie odtwarza. Skok jest tylko wtedy, gdy gracz zostaje postawiony na stojąco w kolektorze przy x 2474-2476 (teleport sondy; tam nad stropem leży pokład 5 z BRIDGE_DECKS nabrzeze-0-1). Gra tego nie daje: do kolektora wchodzi się w kucki (W3_CULVERT_ENTRY), pod stropem nie da się wstać (puszczone kucanie zostawia crouched), chód w kucki i na stojąco przez x 2481-2468 przy z 406,6/407,2/407,8 trzyma podłogę −30,2 (u wylotu −30,05), a zapis i wczytanie w x 2472,5-2477 zostawiają ją na −30,2 w kucki. Sondy: g904.test.ts, g904b, g904c (usunięte po pomiarze).

### G-908 Droga cicha rurociągiem i dachem W-3 bez zagrożeń
- Ważność: S4 · Zasięg: trasa most, rurociąg, dach N, właz
- Opis: Playtest 17.11: cała trasa bez strażnika, kamery i obserwatora (ADR-0082 zakłada dwie kamery dachu (2530; 440), (2556; 440) i obserwatora w kabinie), ok. 2 minut gry w ciszy. Odtworzenie: od Genzō przez (2484; 409,5), drabina (2444; 438,6), rurociąg +10, tor (2501; 438,6) do włazu (2564; 439,3). Upload 40 s w martwym kącie pewny.
- Status: zgłoszone
- Pakiet właściciela: packages/sim

### G-924 Wejście ochrony (600; -8) w zamkniętej komórce: posiłki i oddział pościgu stoją
- Ważność: S3 · Zasięg: posiłki ciepła i pościg Tessen na Starym Mieście
- Opis: Znalezione przy G-922: komórka wejścia zamknięta, brak otwartej w 2 m (pole null); oddział z tego wejścia stoi (Rynek 520,0; 540,20; 560,60; 620,-60).
- Status: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: każde SECURITY_ENTRIES w otwartej komórce połączonej z ulicą
- 17.11 (orkiestrator): przy G-922 pościg je omija (wayless), zostają posiłki ciepła. Przeniesienie wejścia zmienia scenariusze dwóch testów tessen-hunt-trail (zamknięte wejście Grodzkiej jako przypadek awaryjny): do zrobienia razem z nowym przypadkiem zamkniętego wejścia w teście; spotNear wypycha tylko z budynków, a komórka jest zamknięta w rastrze nawigacji.

### G-925 Szeroka droga pościgu nie planuje dla idącego spoza okna celu
- Ważność: S3 · Zasięg: pościgi z dalszych niż ok. 96 m na oś od celu
- Opis: Znalezione przy G-922: chaseDetour/outsideWindow zwraca null; pościg Tessen czeka w ok. 28% punktów siatki, inni stoją.
- Status: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: idący 100-140 m od celu poza oknem dochodzi

### G-927 Walka na ok. 20 m przebudowuje rastry okna bliskiego co kilka kroków (kroki 40-90 ms)
- Ważność: S3 · Zasięg: walka oddziału lub posiłków, np. 520,-60
- Opis: Znalezione przy G-922, także na main: near r+1 f+1 co kilka kroków przy ok. 20 m od Seki.
- Status: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: walka 40 s bez kroku ponad budżet
- Przy G-928 nie odtworzył się (pościg Tessen 520,-60, ziarno 3, bez tłumu): to raczej inna przyczyna niż objazdy ucieczki.

### G-932 Technicy W-3 na zachodnim końcu hali kołyszą się albo stoją w panice
- Ważność: S3 · Zasięg: hala W-3, zachód (x 2504-2512, z 401-437)
- Opis: Znalezione przy sprawdzaniu G-928, identyczne na main: technik w (2508; 437) i (2511; 436,5) w scenie walki (ziarna 3/7/42) ma 416 skoków yaw w 480 krokach ucieczki i po 5 s jest 3,3 m od startu; siatka: 67 z 376 przypadków ma >= 20 skoków, 59 stoi > 2 s (np. (2504; 401) 4,7 s). Sondy: scratchpad/g928h/.
- Status: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: technik uciekający z zachodniego końca hali: zacięcie <= 2 s, skoki yaw < 5, ucieczka >= 10 m

### G-933 Zapis po końcu pościgu Tessen z żywym zaalarmowanym oddziałem rozjeżdża się po wczytaniu
- Ważność: S3 · Zasięg: zapis w dniu 3+ pościgu Tessen, posiłki ochrony
- Opis: Znalezione przy weryfikacji G-922 r3, także na main przed G-922 (91deba6): po wczytaniu hash inny, różnią się pole reinforcements i pozycje oddziału. Sondy: scratchpad/v-g922r3/.
- Status: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: zapis po końcu pościgu z żywym oddziałem: ten sam hash krok po kroku po wczytaniu
- 17.11 (orkiestrator): odtwarza się na main także z calmForSave i krokiem przed zapisem (sonda L1 weryfikatora G-922 r3, 11 odcinków, scratchpad/g933-sonda-L1.test.ts.txt, log g933-l1.log). Snapshot tuż po wczytaniu identyczny; różnica już w pierwszym kroku: strażnik posiłków security:1 w grze oryginalnej widzi Seki (lost 0, lastKnown na nią), we wczytanej nie (lost 1/60). Różnice encji po wczytaniu: inne id (1644/1645 kontra 1637/1638), inna kolejność w świecie (wczytane posiłki na początku), prevYaw, player.lastHitBy, combatant.engaged/melee.stunned/ai.sees undefined zamiast false. Kandydat: kolejność encji albo id posiłków odtworzonych z reinforcementsSnapshot zmienia wynik percepcji lub ruchu przy kilku strażnikach tuż przy Seki. Prosta sonda (oddział 2 przy Rynku, koniec pościgu, zapis) nie odtwarza. Do dalszej pracy, nie drobiazg.

### G-935 Patrol z trasą po tropie na innym poziomie nie wraca na trasę
- Ważność: S3 · Zasięg: patrole z ai.route na piętrach (W-3: P2 i kierownik zmiany na antresoli)
- Opis: Znalezione przy weryfikacji G-929: HoldPosition wraca przez walk.walkTo(pose.position) (ganger-ai-system.ts:163), a walkTo (ganger-walk.ts:165) chodzi tylko po swoim poziomie. P2 po tropie do (2522; 416) ląduje na parterze pod galerią (2547,3; 433,5) i tam zostaje. Także: trop na antresoli nad halą (nieosiągalny) zostawia P2 przy oknie galerii (z 430,7).
- Status: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: P2 po tropie na parterze wraca na trasę antresoli w 60 s
- 17.11 (orkiestrator, tryb bez agentów): sam powrót na trasę przez graf poziomów (routeAcrossLevels w HoldPosition) nie wystarcza. Sonda P2 (W3_PATROL_MEZZANINE, ziarno 3): z tropem do (2522; 416) schodzi i utyka na schodach w (2508,4; -27,6; 428,9), 1 m nad podłogą hali, z tropem na zawsze (head() bierze cel wprost, gdy heightApart > SAME_FLOOR, a pursueTo uznaje 1 m za to samo piętro, LEVEL_GAP 1,5 m); z tropem do (2510; 424) u stóp schodów nie rusza wcale. Naprawa wymaga zmian w ganger-walk (pursueTo/head na schodach) i pewnie zmienia złote hashe: osobna praca, nie drobiazg. Zmian nie wypchnięto.

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
