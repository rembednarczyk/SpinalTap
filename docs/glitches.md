# Rejestr glitchy

Proces: [ADR-0054](adr/0054-proces-glitchy.md). Skala, priorytety i szablon: umiejętność `glitch-triage` (`.claude/skills/glitch-triage/SKILL.md`). Pełne wpisy naprawionych i odrzuconych: [glitches-archiwum.md](glitches-archiwum.md). Liczniki skanu: `tools/glitch-scan/test/glitch-baseline.json`, miejsca: `reports/glitch-scan.json`.

## Otwarte

### G-003 Zawrót na Alei Tysiąclecia zahacza o skraj chodnika przed targiem
- Status: przyjęte
- Uzupełnienie (łowca, 2026-10-30): ten sam zawrót biegnie 2,5 m od linii pieszych `targ-deck` pod wiaduktem (758,4, 350,8–353,8), 5 punktów; skan pomija linie scen. Test przyjęcia obejmuje też to.
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (758, 349), trasa `Aleja Tysiąclecia#80:1/0+…#81:1/1`
- Dowód: skan `car-lane-off-road` = 1.
- Pakiet: `packages/sim` (`traffic.ts`, `uTurn`)

### G-016 Auta zaparkowane do 10 m za zebrą na dwukierunkowej 3 Maja
- Status: później (S4; pełny art. 49 PoRD dla dróg dwukierunkowych, po G-015)
- Gdzie: (−115,58, 31,83) 3,0 m, (−103,16, −32,87) 7,75 m, (−115,53, 25,62) 9,0 m za zebrą

### G-022 Pas aut kończy się przed krótkim łańcuchem tej samej jezdni, który nie dostaje pasa
- Status: przyjęte (po G-020 i G-021, te same pliki)
- Ważność: S3 · Zasięg: lokalny (6 miejsc, 8 ślepych końców) · Koszt: średni
- Gdzie: Lubartowska#38:1 (588, 379): dwa pasy jednokierunkowe schodzą w jeden dwukierunkowej (po G-021); Cerkiewna#92 (912, 346) → pętla #90 (44,4 m); Aleja Unii Lubelskiej#96 (1099, 272) → Aleja Tysiąclecia#84 (21 m); Kalinowszczyzna#131 (2361, 430); Łęczyńska#121 (2659, 95); Kapucyńska#10 (150, −160); Kołłątaja#2 / Peowiaków#0 (−100, −169) → Zesłańców Sybiru#5 (35 m)
- Dowód: łowca: koniec łańcucha z pasami dotyka (≤ 8 m) łańcucha aut < 45 m z 0 pasami.
- Przyczyna (przypuszczalna): klucz łączenia w `roads.ts:71` zawiera `oneway`; `MIN_ROUTE` (`traffic.ts:83`) liczony dla łańcucha, nie dla ciągu łańcuchów.
- Pakiet właściciela: packages/sim (`content/lublin/roads.ts`, `content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-end-at-laneless-street` daje 0; dziś 8 (bez G-020, po G-021).

### G-024 Jednokierunkowe pasy kończą się przed ulicą dla dostaw (Lubartowska, Kowalska, Świętoduska)
- Status: otwarte, decyzja użytkownika ponownie: skręty (opcja B) niemożliwe, w zasięgu 16 m brak ulicy dla aut (najbliższe pasy aut: Lubartowska#37 ok. 100 m, Kowalska#76 56 m, Świętoduska#20 48 m; spotykają je tylko ulice dla dostaw). Zostaje opcja A (dalej ulicą dla dostaw) albo pozostawienie
- Ważność: S3 · Zasięg: lokalny (6 końców) · Koszt: średni
- Gdzie: Lubartowska#37:0/1 (460, 56), Kowalska#76:0/1 (568, 160), Świętoduska#20:0/1 (350, −48)
- Dowód: naprawiacz G-023: oba pasy jadą w tę samą stronę, nie ma pasa powrotnego do zawrotki; zawrotka oznaczałaby jazdę pod prąd (regres G-105) albo czołowe zatory.
- Opcje: A) pasy jadą dalej przez następną ulicę dla dostaw (Kowalska#67 60 m do Furmańskiej#77; Zielona 172 m do Staszica#35; Lubartowska#68 112 m); B) skręty w boczne ulice (G-006).
- Pakiet właściciela: packages/sim (`content/traffic.ts`), ewentualnie `useOf` w `content/lublin`
- Test przyjęcia: `lane-dead-end` spada o 6.

### G-025 Istniejące zawrotki na Alei Tysiąclecia wychodzą poza nawierzchnię
- Status: zgłoszone (do potwierdzenia)
- Ważność: S3 (proponowana) · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: Aleja Tysiąclecia #80/#81, zawrotki przy (757,8, 348,5) i (816, 340,6)
- Dowód: naprawiacz G-023: 4–6 próbek co 0,25 m bez żadnej nawierzchni (`surfacesAt` puste). Możliwe, że to znany 1 w `car-lane-off-road`.
- Pakiet właściciela: packages/sim (`content/traffic.ts`, `uTurn`)

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

### G-037 Pas Andersy kończy się na pasach Mełgiewskiej: auta czekają na siebie
- Status: zgłoszone; było „w naprawie razem z G-006”, ale G-006 scalono w #47 bez zamknięcia G-037 (1.11: do sprawdzenia, czy blokada nadal występuje; ruch aut odłożony decyzją użytkownika z 31.10)
- Ważność: S3 · Gdzie: ok. (2401, 282) · Dowód: kąt 31°, pojazdy obu tras biorą się nawzajem za „auto przed sobą”, resynchronizacja co ok. 40 m.

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
- Status: zgłoszone
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

### G-059 Testy sesji `m2-schedules` i `m3-loop` trwają ok. 5 s i przekraczają limit vitest pod obciążeniem
- Status: odrzucone (pomiar, 31.10)
- Ustalenie orkiestratora: główny `vitest.config.ts` daje `testTimeout: 20_000` właśnie dla testów całych aktów. Limit 5 s działa tylko przy vitest puszczonym z katalogu pakietu, bez głównej konfiguracji. Z roota przy load 30: najdłuższy test 7,6 s (zegar HUD, 3600 klatek), wszystkie 10 zielonych. Testy uruchamiamy z roota repo

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

### G-074 Ślepe końce pasów po poszerzeniu Krakowskiego (Peowiaków, Kapucyńska, Dolna Panny Marii)
- Status: odłożone do osobnego etapu ADR-0055 (decyzja użytkownika 31.10: włączenia z pierwszeństwem w systemie ruchu; ogólna reguła łączenia ślepych pasów psuje limity czekania). G-052 wchodzi z bazą `lane-dead-end` 45
- Ważność: S3 (proponowana: auta znikają albo stają) · Zasięg: 3 skrzyżowania · Koszt: mały–średni
- Gdzie: Peowiaków (−91, −167): skrzyżowanie trzech ulic, oba wyjazdy zajęte jazdą prosto, jednokierunkowa Peowiaków nie ma skrętu; Kapucyńska (159, −207) i Dolna Panny Marii (336, −185): skrzyżowania T w połowie pasa (znana klasa)
- Dowód: skan `lane-dead-end` na gałęzi G-052: 44 → 45 (dwa stare końce znikają, trzy nowe)
- Pakiet właściciela: packages/sim (traffic-junctions)
- Test przyjęcia: `lane-dead-end` na gałęzi G-052 nie wyższy niż 44

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

### G-082 Domyślna szerokość jezdni wycina zmapowane chodniki
- Status: częściowo naprawione (#98: 262 → 131 m); zostaje otwarte do 0 (Zielona, Podwale przy 4,5 m, Łęczyńska przy skrzyżowaniu); przesunięcie jezdni od chodnika jednostronnego: G-113
- Gdzie: Podwale w40052391/w305027452, Staszica w1150131461, w232805965, Zielona w173533827, Łęczyńska w85717509
- Przyczyna: `roadWidth` bez `width`/`lanes` = 6,5/5 m, a `cutSidewalk` usuwa chodnik, którego środek leży na cudzej jezdni
- Propozycja: zwęzić domyślną jezdnię do 2 × (odległość osi od chodnika − pół chodnika), min. 3 m
- Pakiet: tools/osm-import · Test przyjęcia: `sidewalk-under-carriageway` 262 → 0
- Przegląd kuratora (921e44d): UWAGI, T-062/G-112 (zwężenie całej ulicy z próbek przy skrzyżowaniu) i T-063/G-113 (dwukierunkowe poniżej 4,5 m, zwężenie symetryczne); Podwale w305027452 ma 4,3 m, nie 3 m

### G-083 Drogi dla aut bez nazwy i łącznice bez pasów ruchu
- Status: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (audyt dróg) (T-047) · Ważność: S3 · Zasięg: 7 dróg bez nazwy + 3 łącznice, ok. 550 m · Koszt: mały–średni
- Przyczyna: `labels.ts` `chunkStreets` wymaga `name`, `STREET_KINDS` nie ma `primary_link`/`secondary_link`/`tertiary_link`
- Uwaga: po dodaniu pasów sprawdzić `lane-dead-end`, `car-road-hole`, `turn-off-road`
- Pakiet: tools/osm-import (+ sim roads.ts klucz łączenia dla dróg bez nazwy) · Test przyjęcia: `car-way-without-lane` 10 → 0

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

### G-088 Zamkowa zapada się o 3,5 m nad tunelem pieszym przed Zamkiem
- Status: zgłoszone (z przeglądu kuratora G-077)
- Ważność: S3 (proponowana; dojście do Zamku, obejście 6 m od osi) · Zasięg: lokalny · Koszt: średni
- Gdzie: (781.2, 198.8), Zamkowa w154962966 nad w66258159; T-053
- Dowód: GroundField wzdłuż osi: −12,5 → −15,6 → −12,8 m; steepAt prawda na pasie od −8 do +5 m od osi
- Przyczyna (przypuszczalna): NMT bez konstrukcji nad tunelem; ulica bez pomostu (jak BRIDGE_DECKS), a tunel pomija `underground()`
- Pakiet właściciela: tools/osm-import / packages/sim (pomosty)
- Test przyjęcia: kontrola `road-dip-over-tunnel` 1 → 0 (droga z OSM przecina tunel bez wspólnego węzła, a grunt w ±8 m od przecięcia leży > 1 m pod cięciwą; w mieście 34 przecięcia, następne 0,35 m); pod pomostem przejście w66258159 drożne (G-062)

### G-091 Długie przytrzymanie „Use” wybiera kwestię pod palcem w kole dialogu
- Status: zgłoszone (z badania G-058; do potwierdzenia na prawdziwym telefonie przez glitch-huntera)
- Ważność: S3 (proponowana; przypadkowy wybór kwestii w rozmowie) · Zasięg: dotyk · Koszt: mały
- Dowód: sonda e2e (`scratchpad/g058-probe.spec.ts`): przytrzymanie „Use” ok. 1,0–1,3 s, aż dialog się otworzy, potem `pointerup` i `click` na `BUTTON.wheel__opt`; dialog idzie dalej. `touchend` trafia w odpięty przycisk pada, więc nie jest anulowany, a osłona z G-048 już wygasła (700 ms). Niepewne, czy prawdziwy telefon wysyła kliknięcie po długim przytrzymaniu (CDP może się różnić)
- Pakiet właściciela: packages/ui (`touch/ghost-click.ts`)
- Test przyjęcia: test komponentu: kliknięcie z dotyku, który zaczął się przed otwarciem koła, nie wybiera kwestii

### G-092 Ulice ok. 3–4 m z dwoma pasami: auto zachodzi na chodnik
- Status: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (z naprawy G-082 i G-090)
- Ważność: S3 (proponowana) · Zasięg: wąskie ulice dwukierunkowe (po G-082 m.in. Staszica miejscami, Łęczyńska#120) · Koszt: średni
- Dowód: po stronie pasa mniej niż 2,1 m asfaltu; przy dolnym progu `laneOffset` (1,2 m) pół auta (0,9 m) wychodzi poza jezdnię; test G-090 celowo pomija takie odcinki
- Przyczyna (przypuszczalna): `lanesOf` w `packages/sim/src/content/traffic.ts` zawsze daje dwa pasy ulicy dwukierunkowej, bez względu na szerokość
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: kontrola skanu „auto poza jezdnią” (pół szerokości auta od pasa poza `surfacesAt` jezdni) z bazą; ulica węższa niż 2 × 2,1 m dostaje jeden pas albo mijankę

### G-093 Dziura w nawierzchni jezdni Narutowicza
- Status: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (z naprawy G-090)
- Ważność: S4 (proponowana) · Zasięg: lokalny · Koszt: mały
- Gdzie: Narutowicza, ok. 62 m wzdłuż łańcucha, 1,75 m od osi: `surfacesAt` pusty
- Dowód: sonda G-090 (`scratchpad/g090-scan.sh`); pas zwęża się przed dziurą
- Pakiet właściciela: tools/osm-import (ground)
- Test przyjęcia: kontrola `car-road-hole` (albo nowa) wykrywa i spada do 0

### G-095 Żółty kabel kanionu przez przedsionek Trasy Podziemnej (do potwierdzenia)
- Status: niepotwierdzone (glitch hunt wnętrz, 31.10)
- Ważność: S4 (proponowana) · Koszt: mały
- Dowód: zrzut `scratchpad/shots1/p1-trasa-vest.png` (kamera 567, 1,93, −57, yaw π/2): żółta linia na wysokości głowy w poprzek przedsionka i krótki odcinek na tylnej ścianie
- Do ustalenia: czy to kabel z `renderer/mapcity/canyon-plan.ts` albo `landmarks/cables.ts` przechodzący przez bryłę; ile takich w mieście
- Pakiet właściciela: packages/engine (jeśli się potwierdzi)
- Test przyjęcia: kontrola `cable-through-interior` (odcinek kabla wchodzi w bryłę wnętrza `interior: true`) z bazą → 0

### G-096 Narożnik Starego Miasta za brzegiem z = −240 (Pałac Ordynacki, Kuria)
- Status: zgłoszone (z przeglądu kuratora G-052)
- Ważność: S3 (proponowana) · Zasięg: lokalny, 7 budynków, 2 zabytki · Koszt: średni (prostokąt, ADR-0042, regeneracja)
- Gdzie: x od 460 do 760, z od −240 do −270; T-058
- Przyczyna: `stare-miasto` minZ = −240, a G-052 przesuwa Krakowskie do −270 (uskok gruntu na x = 460)
- Pakiet właściciela: tools/osm-import (decyzja o prostokątach: Architekt, ADR-0042)
- Test przyjęcia: w66335239 i w66293168 w `MAP_CHUNKS`, bez uskoku gruntu na x = 460; propozycja: `stare-miasto` minZ −270 z `zEdges` [−270, −40, 160] (rząd 230 m, identyfikatory chunków bez zmian); kontrola `historic-cut-by-edge` (budynek zabytkowy z obrysem w prostokącie dzielnicy i środkiem poza wszystkimi) 4 → 1 (Pałac Tarłów zostaje, T-057)

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

### G-112 Szerokość jezdni z chodnika przy skrzyżowaniu zwęża całą ulicę
- Status: zgłoszone (z przeglądu kuratora G-082) (T-062)
- Ważność: S3 (proponowana; główna ulica Nabrzeża o połowę węższa na 380 m) · Zasięg: Łęczyńska w85717509, Montażowa w40052079, 566 m · Koszt: mały
- Dowód: sonda `topo-g082-probe2.ts`: próbki chodnika z osią na jezdni z typu to 8 z 196 (Łęczyńska) i 21 z 98 (Montażowa), w miejscach, gdzie chodnik skręca do przejścia; wzdłuż reszty oś chodnika 3,6–7,7 m od osi. Po 921e44d 4,1 i 3,6 m dwukierunkowej jezdni zamiast ok. 6–8 m
- Przyczyna: `sidewalkIndex.kerb` (`tools/osm-import/src/generate.ts`) bierze medianę tylko z próbek w zasięgu (`MIN_KERB_SAMPLES` = 5, bez odniesienia do długości ulicy), a `fitToKerb` ustawia jedną szerokość na całą drogę
- Propozycja: dopasowanie tylko wtedy, gdy próbki w zasięgu pokrywają co najmniej 1/3 (lepiej 1/2) próbek ulicy po tej stronie; w pozostałych wycinać chodnik lokalnie albo zwężać tylko odcinek (jak lokalna szerokość w G-090)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `kerb-fit-sparse` (droga z `width:carriageway` z dopasowania, gdzie próbki rozstrzygającej strony < 1/3 próbek ulicy) 2 → 0; `sidewalk-under-carriageway` może wzrosnąć najwyżej o metry przy tych skrzyżowaniach (do policzenia)

### G-113 Dwukierunkowa jezdnia zwężana symetrycznie od chodnika z jednej strony
- Status: zgłoszone (z przeglądu kuratora G-082) (T-063); związane z G-092 (auta na chodniku)
- Ważność: S3 (proponowana; ulice węższe niż w Lublinie, auto 2 m na 1,8 m pół jezdni) · Zasięg: Podwale w40052391 3,6 m, Staszica w1150131461 4,4 m, w232805965 4,7 m (po G-111 także Łęczyńska i Montażowa, jeśli zostaną dopasowane) · Koszt: średni
- Dowód: chodnik zmapowany tylko po jednej stronie (n po stronach [0, 44], [29, 0], [0, 24]); po drugiej asfalt kończy się 1,8–2,4 m od osi, przed terenem posesji, placem budowy albo pasem 4,7 m do budynku (Staszica)
- Przyczyna: `fitToKerb` (`tools/osm-import/src/ground.ts`) daje 2 × kerb wokół osi OSM i to samo minimum 3 m dla dwukierunkowych i jednokierunkowych
- Propozycja: dla ulicy dwukierunkowej minimum 4,5–5 m; gdy ogranicza tylko jedna strona, przesunąć pas jezdni od chodnika (krawędź po wolnej stronie zostaje na szerokości z typu albo do przeszkody), zamiast zwężać ją symetrycznie
- Pakiet właściciela: tools/osm-import (+ packages/sim content/traffic, jeśli oś pasa przestaje być osią OSM)
- Test przyjęcia: kontrola `two-way-fit-narrow` (droga bez `oneway` z dopasowaną szerokością < 4,5 m) 4 → 0 (Podwale 3,6, Montażowa 3,6, Łęczyńska 4,1, Staszica 4,4) bez wzrostu `sidewalk-under-carriageway` i `car-lane-off-road`

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
- Status: później (czeka na źródło wysokości: ADR-0064 etap 11 (LOD2) albo 14 (NMPT), albo zdjęcie; bez tego poprawka byłaby zgadywaniem). Zgłoszenie użytkownika 31.10: „brakuje rozbudowania galerii Pedet”
- Ważność: S3 (proponowana; punkt orientacyjny Krakowskiego z podpisem) · Zasięg: 1 (zasada dotyczy też innych `building=retail` bez `building:levels`) · Koszt: mały (wysokość), średni (fasada domu towarowego)
- Gdzie: w67508935 (124.1, −128.1), Krakowskie Przedmieście 40; T-073
- Dowód: OSM `building=retail`, `shop=mall`, bez `building:levels`, `height` i `building:part`. W grze `levels: 3`, `source: "default"`, ściany 10,4 m nad najwyższym terenem; zrzuty `pedet-ne.png`, `pedet-east.png`, `pedet-north.png`, `pedet-sw.png` (scratchpad kuratora) pokazują trzykondygnacyjną fasadę kamienicy z siatką okien, bez witryn
- Przyczyna: `defaultLevels` w `tools/osm-import/src/building-tags.ts` daje każdemu `commercial` 3 kondygnacje, a renderer rysuje go jak kamienicę z witryną
- Pakiet właściciela: tools/osm-import (wysokość: `corrections.ts` z wpisem T-073 albo dane LOD2/NMPT); packages/engine/src/renderer/mapcity (fasada `shop=mall`/`department_store`: pasy witryn i pełne ściany pięter handlowych zamiast okien mieszkań)
- Test przyjęcia: wysokość Pedetu z LOD2/NMPT albo potwierdzona zdjęciem (rozbieżność > 20% z wpisem do przeglądu kuratora); `shop=mall` dostaje fasadę handlową (test planu fasady w engine); baza `landmark-overbuilt` bez wzrostu

### G-128 Pomniki Placu Litewskiego jako ta sama stojąca postać (Piłsudski bez konia)
- Status: zgłoszone (audyt Placu Litewskiego, kurator 31.10). Zgłoszenie użytkownika: „brakuje pomnika Józefa Piłsudskiego”
- Ważność: S3 (proponowana; zabytek z listy kuratora nie do rozpoznania) · Zasięg: 2 z 3 pomników `LANDMARK_MONUMENTS` (Piłsudski n481952877, 3 Maja n481952880); Unia n481952879 ma własny obelisk · Koszt: średni (model konny), mały (blok 3 Maja)
- Gdzie: (−45.8, −13.3) i (−87.1, −22.6); T-075; zrzuty `pilsudski.png`, `pilsudski-diag.png`
- Dowód: `shapeOf` w `tools/osm-import/src/props-gen.ts` daje każdemu `monument` poza obeliskiem i koziołkiem kształt 1 (`figure`): cokół 1,8 m i postać ok. 2,1 m, razem ok. 3,9 m. `landmark-missing` liczy tylko obecność rekwizytu, więc daje 0
- Pakiet właściciela: packages/engine/src/renderer/mapcity (`prop-civic.ts`: kształty `equestrian` i `constitution`); tools/osm-import (`shapeOf` po ID planu); packages/sim (`furniture.ts`: kolizja cokołu nowego kształtu)
- Test przyjęcia: n481952877 rysowany jako pomnik konny ok. 7,3 m (cokół ok. 3 m, koń z jeźdźcem ok. 4,3 m) w brązie, warstwa 2077 według planu (neonowy kontur, graffiti AR na cokole); 3 Maja jako blok z orłem; kontrola `landmark-monument-generic` 2 → 0; budżet wywołań rysowania bez wzrostu (kształt w siatce mebli bloku)

### G-129 Fontanna multimedialna na Placu Litewskim bez strumieni, czaszy i pokazu
- Status: zgłoszone (audyt Placu Litewskiego, kurator 31.10). Prośba użytkownika: „fontanna na Litewskim powinna być spektakularna”
- Ważność: S3 (proponowana; najważniejsza atrakcja placu) · Zasięg: 1 (zasada dotyczy też kaskady w503047622 i fontanny z wieżą ciśnień w256406832) · Koszt: średni
- Gdzie: w503047621 (x −35..−4.7, z 18.9..56.6); T-076; zrzuty `fountain.png`, `fountain-wide.png`
- Dowód: 16 dysz `fountain-jets` (`JETS["fountain-multimedia"] = 16` w `props-gen.ts`), każda to rurka 1 m z kulką (`fountainJets` w `prop-civic.ts`); woda w niecce płaska, bez czaszy w środku, balustrady i stopni-siedzisk
- Propozycja (NPR, 2077, bez nowych siatek): (1) dysze w siatce mebli bloku jako 3 pierścienie po obrysie (np. 48 + 32 + 16) i pióropusz w środku; strumienie to pionowe wstęgi z przecięciem w kształcie krzyża (2 quady, bez przezroczystości sortowanej), wysokości 1–4 m, w środku 8–12 m; (2) czasza z balustradą i drewniane stopnie z obrysu w siatce terenu, jak obrzeże `planBasin`; (3) poświata w siatce halo miasta (już jedna): kolory strumieni z palety neonu ADR-0051 (cyjan, magenta, bursztyn), nocą mocniejsze; (4) pokaz: wieczorem (21:00, w grze codziennie albo w piątki i soboty z `ClockPort`) wysokość i kolor z fazy w atrybucie wierzchołka, czytany przez istniejący materiał w shaderze; bez animacji CPU na wierzchołkach; (5) mgła z dysz jako istniejące cząsteczki pary (`STEAM_VENTS`), do 2 źródeł. Holo nad strumieniami (ADR-0051) opcjonalnie, w warstwie reklam
- Pakiet właściciela: packages/engine/src/renderer/mapcity (`prop-civic.ts`, `ground-plan.ts`); tools/osm-import (`props-gen.ts`: liczba i układ dysz z obrysu)
- Test przyjęcia: test planu: fontanna multimedialna ma ≥ 96 strumieni i czaszę w środku obrysu; `npr-perf` krakowskie-tpp bez wzrostu wywołań rysowania i aktywnych siatek (dziś 386 / 164); zrzut nocny z pokazem obejrzany przez kuratora

### G-133 Pojazdy na stromych ulicach bez pochylenia: dolny koniec odstaje od bruku
- Status: zgłoszone (1.11, naprawiacz G-130); odłożone razem z pracami nad autami
- Z G-190 (1.11): przy poprawce wcielić łatkę `docs/plany/g190-zatoki-przy-ulicach-dostaw.patch` (zatoki pasów postojowych wzdłuż wszystkich ulic, omijanie tras dostawczaków); sonda z łatką i progiem spadku 0,6 m: +6 aut Kowalska x 643..668, +2 Rybna w895572841; też w1517184173 (Ruska, północ, 46 m) pusty przez spadek 0,23–0,43 m; Kowalska x 643..655: chodnik 2,5 m zachodzi 0,25 m na pas
- Ważność: S4 · Zasięg: 8 pojazdów odstaje ponad 0,2 m, najgorzej dostawczak (544.7, 167.7) o 0,44 m; też Plac Zamkowy, (450, 40), (550, 165), (810, 481)
- Przyczyna: pojazdy stoją poziomo (`pitch: 0`), a po G-130 opierają się na najwyższym punkcie nawierzchni pod obrysem
- Poprawka wymaga pochylenia i przechyłu w kontrakcie `Transform`/`SceneryItem` oraz w `VehicleViews` (zmiana kontraktu, ADR); auta jadące mają też y z terenu w środku bez `SURFACE_LIFT`
- Pakiet właściciela: packages/core (kontrakt), packages/sim, packages/engine

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
- Ważność: S4 · Zasięg: ok. 20 miejsc pod pasami ruchu poza Aleją Tysiąclecia, szczeliny 0,1–0,25 m (np. Mełgiewska 2370,285; Turystyczna 2526,357 i 2606,332)
- Przyczyna: bufory dróg w `tools/osm-import/src/ground.ts` (`bufferLine`) mają ścięte końce, a do tego `simplifyRing` 0,3 i zaokrąglenie do 0,1
- Poprawka: zaokrąglone albo zachodzące końce buforów na styku dróg; tabele przez `osm:build`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: punkty pasów co 0,1 m bez nawierzchni → 0 poza zawracaniem na Alei Tysiąclecia; `lane-off-ground` 9 → 8
- Uwaga weryfikatora G-138: `lane-off-ground` próbkuje co 1 m, więc wynik zależy od przesunięcia próbek (7–12 przy tej samej geometrii); Mełgiewska 2370,285 i Turystyczna 2606,332 wypadły z bazy tylko przez przesunięcie. Przy poprawce próbkować co 0,1 m i liczyć skupiska; co 0,1 m jest 29 skupisk, ok. 21 poza Aleją Tysiąclecia
- Poboczne: `groundY` daje 0 poza mapą, a `GroundField` grunt najbliższego chunka; pasy już tam nie wychodzą, inni użytkownicy obu funkcji mogą trafić na rozbieżność

### G-146 `onPassageAxes` i skan przejazdów: słabe przy trasie równoległej do osi
- Status: zgłoszone (1.11, weryfikator G-136); dziś żadna trasa tego nie wyzwala
- Ważność: S4
- Gdzie: `packages/sim/src/content/traffic.ts` `onPassageAxes` przesuwa tylko wierzchołki od 1 m przed wylotem do 1 m za drugim; trasa równoległa do osi, odsunięta o 1–3,5 m z gęstymi wierzchołkami, przeskakuje na oś tuż przed wylotem (narożniki dostawczaka 2,0–4,5 m od osi przy połowie przejazdu 1,7–1,8 m); bez wierzchołka pod sklepieniem nic nie przesuwa. `vehicle-outside-passage` liczy środek plus połowę szerokości, nie narożniki
- Poprawka: dociąć trasę do osi na całej długości przejazdu z płynnym wejściem (wstawić wierzchołki na wylotach); skan liczy narożniki prostokąta pojazdu
- Pakiet właściciela: packages/sim, tools/glitch-scan

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

### G-153 Skan `furniture-overlap` pomija słupki
- Status: zgłoszone (1.11, weryfikator #124)
- Ważność: S4 · Zasięg: np. stojak (-137.1, -52.2) z bryłą na słupku (-137.9, -53.1)
- Poprawka: słupki w kontroli nakładania brył mebli; bryła stojaka dopasowana do rowerów (dziś hx 1,0 przy rowerach do 0,47 m)
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

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

### G-176 Skan aut przy krawężniku luźniejszy niż generator
- Status: zgłoszone (1.11, weryfikator #143)
- Ważność: S4 (narzędzie) · Zasięg: `parked-car-multilane-kerb` zwalnia auto w każdym `amenity=parking`, także podziemnym i dachowym, a generator tylko w naziemnych; `parked-car-on-footway` liczy `pedestrian` i `cycleway`, których generator (`footWays`, `clearOfKeptWays`) nie pomija; po #143 `clearOfStops` nie zmienia tabeli (te same auta zdejmuje G-155), więc G-156 pilnuje tylko skan
- Poprawka: wyrównać zbiory dróg i parkingów między skanem a generatorem; test generatora dla przystanku niezależny od G-155
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

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
- Status: skan w main (1.11, #169: `kerb-strip-no-car-street` baza 3, `bay-strip-empty-known` baza 4, `bay-strip-sparse` 0); zostaje poprawka generatora: łatka zatok przy ulicach dostaw (`docs/plany/g190-zatoki-przy-ulicach-dostaw.patch`) razem z G-133; Łęczyńska w1159135271 (OSM `capacity=23`, w grze 0: obrys płytszy niż auto w poprzek) do decyzji, np. nadwozie nad krawężnikiem
- Ważność: S4 · Zasięg: w232362980 (Kowalska, lane, 2,2 m: spadek, nawierzchnia, wyjście poza obrys), w232362991 (Kowalska, diagonal, 3,4–3,9 m: za płytki na skos z tagu, 8 z 12 zatok bez modelu), w356947938 (najbliższa droga z ruchem 75 m dalej), w1159135271 (Łęczyńska, perpendicular, 3,4 m: za płytki na układ prostopadły), w1514058885 (Świętoduska, parallel, 2,45 m: 18 zatok na spadku, G-133)
- Poprawka: płytki pas z tagiem `diagonal`/`perpendicular` → mniejszy kąt albo krótszy model; spadek przez G-133 (pochylenie aut); `bay-strip-sparse` dziś pomija pasy bez auta
- Kurator #162: także odcinek Kowalskiej w232362980 x 644..668 bez zatok, bo ulica ma `use: deliveries`, a `bayCars` bierze tylko `CAR_STREETS` (T-107); zatoka w1544340690 s=24,8 (689,2; 171,8) odrzucona przez odstęp od chodnika w173566578, a na ortofoto stoi tam auto. Proponowane kontrole: `kerb-strip-no-car-street` (baza ≥ 1) i `bay-strip-sparse` także dla pasów bez aut (baza ≥ 5)
- Pakiet właściciela: packages/sim (kerb-bays), tools/glitch-scan

### G-191 Gzymsy wystają poza obrys OSM i przycinają płaskie płyty znaków
- Status: zgłoszone (1.11, autor G-160)
- Ważność: S4 · Zasięg: gzymsy w mapcity sięgają poza obrys budynku z OSM; płaska płyta (neon, szyld) na ich wysokości wchodzi w gzyms (tak był ucięty róg SAKE przed runda 2 G-160); kontrole oparte na `inBuilding` i obrysie tego nie widzą, a przy lokalach (`ROOM_SITES`, wycięta kondygnacja) dają fałszywe trafienia
- Poprawka: kontrola skanu „płyta znaku w bryle gzymsu” (geometria gzymsu z planu fasady); kontrole na obrysie uwzględniają fronty lokali
- Pakiet właściciela: tools/glitch-scan, packages/engine (mapcity)

### G-192 Uproszczona oś chodnika: auta kilka cm w zmapowanej szerokości
- Status: zgłoszone (1.11, autor G-189)
- Ważność: S4 · Zasięg: `simplifyLine` 0,5 m w imporcie przesuwa oś chodnika do ok. 0,09 m; auta z main (np. taxi (922,53; 430,5) i dwa na Kalinowszczyźnie) wchodzą o kilka cm w szerokość chodnika z OSM; skan ma margines `AXIS_SLACK` 0,1 m
- Poprawka: dokładniejsza oś dla chodników przy pasach postojowych albo odstęp liczony od osi z OSM
- Pakiet właściciela: tools/osm-import, packages/sim

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
- Ważność: S3 (proponowana) · Zasięg: lokalny (Bernardyńska, widok z Krakowskiego Przedmieścia i Placu Wolności) · Koszt: mały
- Gdzie: w66330578 (364,7; −239,8), Krakowskie; T-120
- Dowód: NMPT GUGiK 0,5 m: wieża (378,1; −247,7), ok. 5,5 × 5,5 m, hełm do y 39,2; sygnaturka (375,4; −240,1) do y 31,8; kalenica nawy y 24,5 (gra 30,1, `source: default`). Po #190 gra nie ma żadnej wieży, przed #190 miała dwie na zachodzie
- Przyczyna: OSM nie ma wieży jako części; renderer zgaduje wieże przy zachodnim szczycie
- Poprawka: korekta importu: część `building:part=tower` (korpus do y ok. 32,5, hełm do 39,2) i sygnaturka; `height`/`roof:height` nawy z NMPT; potem zdjąć w66330578 z `TOWERLESS_OSM` (G-049 sam wyłącza wieże proceduralne)
- Pakiet właściciela: tools/osm-import (corrections), packages/engine (lista)
- Test przyjęcia: najwyższy wierzchołek bryły w promieniu 4 m od (378,1; −247,7) ma y 39,2 ± 1, poza nim nic nie przekracza y 32; dziś pada (brak wieży, kalenica 30,1)

### G-215 Proceduralne wieże na kościołach, które ich nie mają albo mają inne
- Status: zgłoszone (2.11, kurator, przegląd #190)
- Ważność: S3 (proponowana) · Zasięg: szeroki (7 kościołów, m.in. deptak: Kapucyni i Świętego Ducha) · Koszt: średni
- Priorytet (kurator, przegląd #208): wyżej. Wieże skalują się ze ścianami, więc po G-216 Niecała 4 w232674421 ma wieżę do y ok. 13 na budynku ok. 3,7 m (ponad trzy razy wyżej niż budynek bez wieży), a Świętego Ducha dwie wieże do y 28,5 przy kalenicy 20,4. Najtańszy pierwszy krok: kościoły bez wieży w rzeczywistości (Niecała 4, Kapucyni, św. Piotra, św. Wojciecha) na liście bez wieży, z odsyłaczem T-121
- Gdzie: T-121: Kapucyni w67508932, Karmelici r5420467 (poprawione w #198: wieże poza obrysem zdjęte), św. Piotra w66335226, św. Wojciecha w61102109, Niecała 4 w232674421, Świętego Ducha w66264126 (2 wieże zamiast 1 smukłej na narożu SW do y 26,5), cerkiew Przemienienia w66264148 (wieża 13 m za wysoka)
- Dowód: sonda `topo-g210-probe` (towerSpots w świecie) i NMPT GUGiK 0,5 m, wartości w T-121
- Przyczyna: `roof-plan` `addTowers` stawia wieże każdemu kościołowi bez części; zachód obrysu i szerokość > 22 m decydują o liczbie i miejscu, wysokość 1,7 × ściany do 65 m
- Poprawka: wieża proceduralna tylko dla kościołów z tabeli wież (dane: położenie, rzut, wysokość z NMPT albo `building:part` w korektach importu); pozostałe bez wieży (rozszerzyć `TOWERLESS_OSM` do odwrotnej listy); co najmniej: środek wieży w obrysie
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import, tools/glitch-scan
- Test przyjęcia: kontrole `church-fake-tower` i `church-tower-off-building` (niżej) spadają do 0

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

### G-222 Reguła wieży z OSM: krawędzie (bok wieży, maszty, wieże różnej wysokości)
- Status: zgłoszone (2.11, weryfikator G-212); dziś bez skutku w mieście
- Ważność: S4 · Zasięg: `tools/osm-import/src/building-towers.ts:59` mierzy od wierzchołków wieży do ścian kościoła (wieża bokiem bliżej niż 10 m zostanie pominięta); `isTowerTags` uznaje każde `tower:type` i `man_made=tower` (maszt albo wieża ciśnień obok kościoła zdjęłaby mu wieże); `towerTips` w skanie sprawdza tylko najwyższy poziom bryły (wieże różnej wysokości ominęłyby `church-tower-off-building`)
- Poprawka: odległość odcinek–odcinek; `tower:type` z listy (bell_tower, church) i bez `man_made=tower` z `tower:type=communication`/`water`; `towerTips` po wszystkich wieżach; testy dla każdego przypadku
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-223 Test skanu `market-piece-on-crowd-lane` przekracza 20 s przy load ponad 20
- Status: zgłoszone (2.11, weryfikator G-212)
- Ważność: S4 (test, nie gra) · Zasięg: `tools/glitch-scan`, kontrola `market-piece-on-crowd-lane`; sama przy load 15 przechodzi
- Poprawka: pomiar i przyspieszenie (indeks przestrzenny jak w G-200), bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: tools/glitch-scan

### G-225 Reguła drogi pod ziemią (G-197) zdejmuje też nawierzchnię nad tunelem i przejazdy bramne
- Status: zgłoszone (2.11, weryfikator G-197); dziś bez skutku dla drzwi
- Ważność: S4 · Zasięg: `tools/osm-import/src/props-doors.ts:234`: odcinek ulicy z chunków pokrywający się w rzucie z drogą pod ziemią przestaje być ulicą; Rynek nad Trasą Podziemną traci 2 odcinki (609,1; −50,9)→(617,9; −48,7), Teodora Gruella w298307007 (przejazd bramny `tunnel=yes`, `layer=-1`, por. G-076) 1 odcinek. Kamienica stojąca tylko od takiego odcinka straciłaby drzwi, a `door-faces-underground` tego nie wykryje. Testy nie łapią mutacji „tylko końce” i `ALONG=0.3`
- Poprawka: odróżniać drogę pod ziemią od nawierzchni po id/nazwie drogi (chunki niosą id OSM?), przejazdy bramne z tagiem `tunnel=yes` krótsze niż ok. 20 m pod budynkiem traktować jak `building_passage`; testy warunku środka i progu
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-226 E2E `npr-perf` „the Rynek in TPP” przekracza 90 s na `citySettled` przy load 12–15
- Status: zbadane (2.11, naprawiacz): przepustowość maszyny, nie regresja. Klatka pod SwiftShaderem 2–3 s przy load 10, 4–7 s przy 15–19 (skoki 10–16 s); miasto dochodzi do `citySettled` w 1–3 klatki; main vs. przed #186 i #167: wywołania i siatki identyczne, trójkąty +1 %, czas w szumie. Propozycje: (1) wspólna strona dla scen TPP (zmienia historię próbki, decyzja), (2) klatki na żądanie w `freeze` (`__seki.draw(n)`, ADR-0046), żeby `page.evaluate` nie czekało za klatkami w tle (pomoże też G-132), (3) orkiestrator wstrzymuje ciężkie zadania na czas e2e perf. Propozycja (2) zbudowana i odłożona (gałąź `ccr-ec2c4269-ilh8k8-draw-on-demand` @ 07c0b98, bez PR): `FrameGate` i `__seki.draw(n)` działają, budżety i migawka bez zmian, ale scena nie jest krótsza (settle potrzebuje 4–5 klatek zamiast 3–4, sumy w szumie); wątek strony blokuje też coś poza klatkami w tle (wiadukt: `step` 10 s, rynek: teleport 3 s; hipoteza: synchroniczne GL przy spawnie siatek nowego chunka). Następny krok: ślad tego `step`, potem decyzja o (1); raport `scratchpad/g226-raport.md`
- Ważność: S3 (test, czerwony CI kosztuje cykl) · Zasięg: `e2e/npr-perf.spec.ts:89` (Rynek TPP), także „Krakowskie Przedmieście TPP” i „market under the viaduct” (weryfikator #199: timeout 90 s przy load 13–17; viaduct na main 1,4 min przy load 15–21); powtórki same przechodzą
- Poprawka: ślad (trace) i pomiar, co trzyma `citySettled` (wczytywanie chunków, kafle, decale z #186?); bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: e2e (QA), engine

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

### G-255 Garb w biegu schodów w56965515 przy pomoście wiaduktu Zamkowej: uskok 2,9 m i bieg pod prąd
- Status: w PR #233 (2.11, runda 4 @ 223dedc PRZYJĘTE z uwagami (dług w G-273), kurator w toku; runda 8 czeka na slot (po G-281 i G-279, decyzja użytkownika 4.11); runda 7 @ f3f7060 NIE PRZYJĘTE: `walkable` sprawdza ścianę w całym oknie 80 m i NPC staje na przyczółku wschodnim (756,7; 158,3) → (738,3; 182,8), main 8/8, gałąź 0/8; kierunek: zamknąć w polu uskoki pomostu przy obu przyczółkach, `walkable` jak w defc2a0; raport scratchpad/v-g255r7-raport.md; runda 6 @ 96cfc6a NIE PRZYJĘTE: reguła ściany w `steering.ts` na całe okno psuje pościg z Podwala, reszta (wnęka, dash, chód 126/126) dobra; runda 5 @ defc2a0 NIE PRZYJĘTE: w obrysie wiaduktu renderer rysuje stopnie biegu, a symulacja daje płytę albo teren pod nią (24 z 63 przejść źle), testy omijały ten pas; G-274 naprawione; runda 3 @ d03bb2d: podrzut z podestu; runda 2 @ 0e075bb: NPC w pościgu; runda 1 @ daaca9f: pod górę 4/30; pochyły pomost biegu zamiast rampy terenu; zgłoszone przez kuratora przy #219)
- Ważność: S3 (proponowana: uskok 2,9 m w środku schodów, gracz spada albo AI się zatrzymuje) · Zasięg: 1 droga (3 kawałki pasa w dwóch chunkach), możliwe dalsze z kontroli `steps-riser-tall` · Koszt: mały do średniego
- Gdzie: T-131; w56965515 bieg węzeł 2 → 3 (734,1; 163,9) → (729,5; 159,9), Podzamcze/Stare Miasto, granica chunków z = 160
- Dowód: `planSteps` na `groundY` (sonda `topo-g236-flight.txt`, 5757fae): stopnie na pomoście y −13,48 do x ≈ 733,4, potem podstopnica 2,92 m na teren −16,41, dalej stopnie w górę do −15,28 przy węźle 3 (flight ma `incline=down`); kawałek tego biegu w `stare-miasto-1-1` (730,8; 159,6) leży płasko na pomoście −13,51 obok −15,4 za granicą chunka. Stan sprzed #219 identyczny
- Przyczyna: pas biegu 3 m idzie ok. 4 m od osi wiaduktu i częściowo leży w obrysie pomostu, więc `groundY` daje tam pomost (stopnie w kawałku pasa nad nim stoją na pomoście, reguła sufitu G-062 tego nie zmienia), a tuż za krawędzią pomostu interpolowany NMT spod wiaduktu (−16,4..−16,8), niższy od końca biegu
- Poprawka: bieg ze `incline` przy pomoście dostaje rampę od wysokości pomostu na węźle wiaduktu do terenu na końcu (jak `flightRamps`, ale z pomostem jako górą), a schody nie biorą pomostu z `groundY` poza węzłem na wiadukcie; razem z G-062
- Pakiet właściciela: packages/sim (content/lublin: shape, decks), packages/engine (steps-plan)
- Test przyjęcia: profil biegów w56965515 maleje od −13,5 do −17,1 bez podstopnicy ponad 0,3 m; kontrola `steps-riser-tall` (podstopnica `planSteps` na `groundY` > 0,5 m) baza 7 → co najwyżej 6

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

### G-274 Skraj wiaduktu Zamkowej nad biegiem w56965515 rysowany, ale bez podłogi: spadek 1,7 m przez bruk (po #233)
- Status: w naprawie w PR #233 (2.11; naprawione w rundzie 5 @ defc2a0, czeka na całość #233; zgłoszone przez kuratora przy przeglądzie #233 @ 223dedc; wprowadzone przez G-255)
- Ważność: S2 (proponowana: gracz spada przez widoczną nawierzchnię na trasie Brama Grodzka–Zamek) · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: T-144; pas 1,5–2 m wzdłuż północno-zachodniej krawędzi pomostu w232362907 od (729,0; 157,0) do (733,5; 162,0), `stare-miasto-1-1` i `podzamcze-1-0`, ok. 10 m²; w mieście 1 miejsce
- Dowód: sonda `topo-cross` (przekroje w poprzek osi wiaduktu co 1 m od przyczółka): na 223dedc `groundY` spada z −13,57 na −15,31 między 2,0 a 2,5 m od osi, a `deckAt` obrysu wiaduktu (rysowanego) sięga 4,0 m; uskok 1,74 m (t = 2–5), 1,2 m (t = 6), 0,57 m (t = 7). Siatka 0,5 m: 40 punktów obrysu wiaduktu z gruntem niżej o ponad 0,25 m. Na main 8b8ee07 pomost do 4,0 m bez uskoku. Zrzut autora `shots/g255/tpp-z-dolu.png`: stopnie biegu 2 wchodzą pod płytę pomostu
- Przyczyna: `FLIGHT_DECKS` (`content/lublin/decks.ts`) kładzie pas biegu 3,8 m (`FLIGHT_HALF` 1,9) na osi z OSM, a ta leży ok. 3,9 m od osi wiaduktu, na krawędzi obrysu pomostu (pół szerokości 4 m); `beside` w `deckAt` oddaje bieg stopom w całej części wspólnej, a renderer (`Decks.heightAt`, `planSurface` kawałka mostu) rysuje płytę wiaduktu na całym obrysie i nie stawia fasady na tej krawędzi (sąsiedni pomost biegu)
- Poprawka: pas biegu przy moście przycięty do obrysu pomostu (bieg zaczyna się za krawędzią wiaduktu, jak we wnęce na ortofoto PZGiK) albo przesunięty na zewnątrz o część wspólną; `beside` tylko tam, gdzie pomost biegu jest nad gruntem poza obrysem mostu. Bez zmiany obrysu wiaduktu (zgodny z balustradą na ortofoto)
- Pakiet właściciela: packages/sim (content/lublin/decks.ts, world/deck.ts)
- Test przyjęcia: w obrysie każdego kawałka mostu `groundY` nie leży niżej niż pomost o więcej niż `STEP_HEIGHT` poza przejściami pod mostem (G-062); kontrola skanu `deck-drawn-over-flight` 40 → 0; testy G-255 (`flight-walk`, `flight-chase`) dalej zielone

### G-275 W TPP przy celowaniu z bliska (zwłaszcza w kucaniu) postać zasłania cel
- Status: w PR #243 (4.11, runda 1 @ f97804c NIE PRZYJĘTE: przesunięcie ramienia 0,8 m bez sprawdzenia ściany pozwala strzelać i patrzeć przez ścianę (388/739 pozycji we wnętrzach, było 8), strzał i celownik rozjeżdżają się 0,22 s przy zmianie ramienia, objaw w TPP nieodtworzony (zasłona ≤ 9%); użytkownik 4.11: objaw był w FPP (broń w widoku z pierwszej osoby zasłania cel); runda 2 nowy autor po wolnym slocie: FPP + cofnięcie 0,8 m albo przycięcie do ściany)
- Ważność: S3 (zgłoszenie gracza, podstawowa mechanika strzelania) · Zasięg: kamera TPP (`packages/engine/src/camera/camera-rig.ts`: `TPP_DISTANCE` 2,2 m, `TPP_SHOULDER_OFFSET` 0,55 m z `packages/sim/src/world/hitscan.ts`, `TPP_HEIGHT_OFFSET` 0, `TPP_ADS_PULL` 0,45; w kucaniu kamera tylko obniża się z `eyeHeightAt`), cel z przyłożenia i do kilku metrów · Koszt: średni
- Rozwiązania branżowe do połączenia: (1) przy celowaniu i w kucaniu większe przesunięcie przez ramię i lekko w górę (postać ucieka na bok kadru); (2) zmiana ramienia klawiszem/padem (akcja wejścia, i18n, opcje sterowania); (3) przezroczystość albo wzór kropek (dither, pasuje do NPR) postaci, gdy zasłania celownik lub kamera jest blisko; (4) strzał z promienia kamery z poprawką lufy, żeby trafienie było tam, gdzie celownik, przy dużych przesunięciach (hitscan w `sim` już liczy punkt startu z kucaniem: sprawdzić zgodność, bo stałe przesunięcia są w `sim`)
- Pakiet właściciela: packages/engine (camera, npr), packages/sim (hitscan: stałe przesunięć, jeśli się zmieniają; złote hashe), packages/engine/src/input (zmiana ramienia), packages/ui (opcje)
- Test przyjęcia: test kamery bez renderera: w kucaniu z celem 1–3 m przed postacią celownik nie leży w rzucie sylwetki postaci (albo postać jest w tym czasie wygaszona); test trafienia: punkt trafienia = punkt pod celownikiem przy obu ramionach; zrzuty przed/po (stanie, kucanie, cel z bliska, oba ramiona) dla użytkownika; budżety bez wzrostu

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

### G-278 Wyszukiwanie pomostu na szwie chunków bierze tylko pierwszy chunk
- Status: potwierdzone (2.11, autor G-255 runda 6 na main 8b8ee07: `GroundField` bierze pomosty tylko chunka pierwszego w tabeli, w (735; 160) teren −15,14 zamiast pomostu −13,55)
- Ważność: S4 · Zasięg: punkty dokładnie na granicy chunków (np. z = 160 przy wiadukcie Zamkowej): wyszukiwanie pomostu (`decksAt`/most) patrzy tylko w pomosty pierwszego chunka, więc w tych punktach bieg schodów wychodzi bez płyty wiaduktu nad nim · Koszt: mały
- Poprawka: na szwie brać pomosty obu chunków (albo indeks pomostów niezależny od chunka); test w punktach z = granica
- Pakiet właściciela: packages/sim (world/deck)

### G-280 Dash uruchamia ochronę Tessen (security) w siedzibie Tessen
- Status: w naprawie (4.11; przyczyna: ADR-0033, zryw w przebraniu to czyn zabroniony; użytkownik miał mundur Tessen; decyzja użytkownika 4.11: reakcja zostaje, ale słabsza niż przy sprincie, pojedynczy zryw nie demaskuje)
- Ważność: S3 · Zasięg: użycie umiejętności Dash na terenie Tessen; prawdopodobnie ruch umiejętności liczony jako wtargnięcie albo atak
- Pakiet właściciela: packages/sim (systemy przestępstw i ochrony)

### G-282 Karabin Tessen w FPP ma model pistoletu
- Status: zgłoszone (4.11, użytkownik, testowy przebieg; do odtworzenia)
- Ważność: S3 · Zasięg: widok FPP z karabinem Tessen; możliwe także inne rodzaje broni bez własnego modelu
- Pakiet właściciela: packages/engine (renderer, broń) i assety

### G-283 Okno dialogowe od razu przewija się w dół i często się scrolluje
- Status: zgłoszone (4.11, użytkownik, testowy przebieg; do odtworzenia)
- Ważność: S3 · Zasięg: dialogi z NPC
- Pakiet właściciela: packages/ui

### G-284 Winda nie działa albo jej nie ma
- Status: zgłoszone (4.11, użytkownik, testowy przebieg; do odtworzenia)
- Ważność: S3 · Zasięg: winda z treści (estakada, ADR windy z bramkami); do ustalenia, która i gdzie
- Pakiet właściciela: packages/sim i treść lublin; docelowo winda w Alchemii (backlog)

### G-285 Przeciwnicy wykrywają gracza natychmiast, takedown niemożliwy
- Status: zgłoszone (4.11, użytkownik, testowy przebieg; do odtworzenia)
- Ważność: S2 (proponowana: blokuje mechanikę) · Zasięg: walka z gangerami; czujność NPC i kamer (`AWARENESS_STEP`, `GUARD_CONE`, `ganger-perception.ts`)
- Do ustalenia: błąd w czujności czy brak trybu skradania (backlog, skradanie)
- Pakiet właściciela: packages/sim/src/systems/ai

### G-286 Scalony toast „×N” znika 4,5 s od pierwszego zdarzenia, nie od ostatniego
- Status: zgłoszone (4.11, weryfikator G-281)
- Ważność: S4 · Zasięg: każdy scalany toast; identyczne powiadomienie po 4,4 s widać ułamek sekundy; `sameToast` pomija flagę `keep` (dziś teoretyczne)
- Pakiet właściciela: packages/ui (store, toasty)

### G-287 Drzwi i witryny stoisk Alchemii wiszą nad brukiem od Świętoduskiej
- Status: zgłoszone (4.11, weryfikator i kurator PR #247; przed otwarciem wejść)
- Ważność: S3 · Zasięg: podłoga 1,04–1,24 m nad brukiem przy środku frontu stoisk 2, 3, 5, w rogach do 1,88 m; brak stopni i ramp; `placeAlchemiaModule` stawia moduł na najwyższym punkcie rzutu
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-288 Zewnętrzne schody hali Alchemii to pełny prostopadłościan do 7,35 m
- Status: zgłoszone (4.11, weryfikator PR #247)
- Ważność: S4 · Zasięg: `HALL_PARTS[2]`: widać otwarte stopnie, nie da się wejść, pod biegiem niewidzialna ściana; żaden test nie pilnuje, że części hali nie wystają ponad dach
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-289 Z dachu Alchemii nie ma bezpiecznego zejścia
- Status: zgłoszone (4.11, weryfikator PR #247; dług na etap z windą i Rin na dachu)
- Ważność: S4 · Zasięg: zeskok z 11–13 m kosztuje 48–96 HP; dziś dach nieosiągalny
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-290 Strażnicy liczą obecność w strefie w mundurze jako czyn zabroniony mimo znanego kodu
- Status: zgłoszone (4.11, naprawiacz G-280; do sprawdzenia, czy zamierzone)
- Ważność: S4 · Zasięg: `zoneActive` w `world/disguise.ts` nie uwzględnia `codeKnown` (jego odpowiednik w `crime-system.ts` tak); przy przyjaznej postawie Tessen „Cover blown” bez skutku
- Pakiet właściciela: packages/sim (world/disguise.ts)

### G-132 Smoke „quicksave/quickload” flaky pod obciążeniem (także na main)
- Status: nowe (weryfikator ADR-0057, 1.11)
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
