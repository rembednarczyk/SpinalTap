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
- Status: w naprawie razem z G-006 (koniec Andersy staje 5 m przed pasami Mełgiewskiej; blokada istniała na bazie)
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

### G-043 Zatwierdzona migawka NPR nie zgadza się z tym, co rysuje main
- Status: zgłoszone (z G-030)
- Ważność: S3 (proponowana: migawka przestaje pilnować wyglądu) · Koszt: mały
- Dowód: naprawiacz i weryfikator G-030: `e2e/__snapshots__/npr-perf.spec.ts/reference-m0.png` różni się od deterministycznej klatki main (b5507ce) o 39 806 px poza Seki (bbox 0,0–1280,533); m.in. brak białej smugi odblasku na lewym oknie Neon Koi (y ok. 290). Test przechodzi tylko dzięki `maxDiffPixelRatio: 0.02`. Ustalić, który commit zmienił klatkę: regresja czy niezaktualizowana migawka.
- Pakiet właściciela: packages/engine / e2e (QA)

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

### G-098 Wieże zmapowane jako `man_made=tower` bez `building` pominięte
- Status: zgłoszone (z przeglądu kuratora G-052) · Ważność: S4 · Zasięg: 3 obrysy w Krakowskim · Koszt: mały–średni
- Gdzie: w1090997970 (wieża Brygidek, 161, −229), w1002739983 (84, 99), w1002739984 (40, 103); T-060
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `tower-area-missing` 3 → 0

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

### G-143 Taksówki na osi chodnika przy Podzamczu
- Status: w PR #125; weryfikator PRZYJĘTE (1.11), czeka na przegląd kuratora (zmiana importu); 3ab42ad, skan `parked-car-on-footway` 3 → 0; część o postoju taxi odpada, bo gra nie stawia taksówek na postojach
- Ważność: S4 · Zasięg: taxi (928.6, 452.2) 0,01 m od osi `highway=footway` w809962786, taxi (922.9, 430.6) 0,80 m od niej
- Ustalone (1.11, orkiestrator, dane `data/osm/podzamcze.json`): w809962786 to samodzielna ścieżka piesza 52 m (`highway=footway`, bez `footway=sidewalk`/`crossing`, oświetlona, asfalt), co najmniej 7,8 m od osi Cerkiewnej i dróg serwisowych; łączy się z postojem taxi w471549002 (`amenity=taxi`, obszar), placem w66323033 (`area:highway`), chodnikiem w1517184174 i przejściem w1054556913. Taksówka 0,01 m od jej osi stoi więc na ścieżce pieszych obok postoju, nie na jezdni: glitch prawdziwy
- Poprawka: zaparkowane auta trzymają odstęp od osi samodzielnych ścieżek `footway`/`path` (poza `sidewalk` wzdłuż krawężnika), a taksówki z postoju `amenity=taxi` stoją wewnątrz jego obszaru; kontrola skanu „auto bliżej niż 1 m od osi ścieżki pieszej”
- Pakiet właściciela: packages/sim (content), przegląd kuratora

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

### G-148 Szyldy i neony wcięte w fasady i narożniki
- Status: zgłoszone (1.11, gracz, telefon, zrzuty `scratchpad/gracz-1-11/`)
- Ważność: S3 · Zasięg: Stare Miasto (Grodzka, okolice Bramy Krakowskiej: Bramowa, Jezuicka, Szambelańska), prawdopodobnie całe miasto
- Objawy: świecąca rama szyldu „DEN…” przechodzi przez narożnik budynku (Grodzka); ciemna płyta wystaje ze ściany obok szyldu „…AJNIA SMAKU” (Bramowa); pionowe neony nachodzą na sąsiednie elewacje
- Do ustalenia: które to szyldy (lokale ADR-0064 etap 4, #118, czy starsze neony dressingu) i czy szyld wychodzi poza odcinek elewacji przy narożniku
- Poprawka: szyld mieści się w swoim odcinku elewacji z marginesem od narożnika, a wysięgnik nie wchodzi w sąsiedni budynek; kontrola skanu „szyld poza swoją elewacją”
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import (venues)

### G-149 Pomniki i rzeźby z OSM mają przypadkowy kształt
- Status: zgłoszone (1.11, gracz: „strategia stawiania assetów wydaje się randomowa”)
- Ważność: S3 · Zasięg: 27 pomników i rzeźb z planu (`docs/world/lublin-props.todo.json`) i wszystkie `memorial`/`artwork` z OSM
- Przyczyna: ADR-0047 bierze pozycję z OSM, ale kształt z hasha id (`variant`, `SHAPES.monument = 4`): obelisk, postać na cokole, Koziołek albo abstrakcja; poza kilkoma wymuszonymi w planie prawdziwy pomnik dostaje losową bryłę (np. stos sześcianów albo postać na czarnym bloku w wąskiej uliczce)
- Poprawka: kształt z tagów OSM (`memorial=plaque|statue|bust|stone`, `artwork_type`, `historic`) i z ręcznej tabeli znanych pomników Lublina; tablica pamiątkowa na fasadzie zamiast wolnostojącej bryły; bez dopasowania: neutralna tablica albo kapliczka, nie abstrakcja; przegląd kuratora
- Pakiet właściciela: tools/osm-import (props-kinds, props-gen), packages/engine (prop-civic)

### G-150 Źle położone dachy na Starym Mieście
- Status: zgłoszone (1.11, gracz, bez dokładnych miejsc); do łowcy
- Ważność: S3 · Zasięg: do ustalenia
- Objawy z opisu gracza: dachy przesunięte albo nachodzące na sąsiednie budynki, gzymsy wystające poza fasadę
- Poprawka: najpierw łowca (przegląd dachów Starego Miasta zrzutami i skanem), potem osobne wpisy

### G-151 Hydranty stawiane regułą zamiast z OSM
- Status: w poprawkach PR #124 (1.11, kurator)
- Ważność: S3 · Zasięg: 33 hydranty w grze, żaden w prawdziwym miejscu (mediana 143 m od najbliższego nadziemnego)
- Przyczyna: `filterOsm` (`tools/osm-import/src/osm.ts:151`) zostawia tylko węzły z `name`, a hydranty nazwy nie mają; żywe OSM ma w chunkach 77 (6 `pillar`, 71 podziemnych, import z 2015 z `ref`)
- Poprawka: hydranty nadziemne z OSM (do 3 m od węzła), podziemne świadomie pominięte albo jako pokrywa; kontrola skanu „hydrant dalej niż 3 m od `pillar` z OSM”
- Pakiet właściciela: tools/osm-import

### G-152 Kontenery w ogrodzonym parku na Nabrzeżu
- Status: w poprawkach PR #124 (1.11, kurator)
- Ważność: S3 · Zasięg: 5 z 8 kontenerów w parku w154191322 (`leisure=park`, `natural=scrub`, `barrier=fence`), jeden w poprzek płotu
- Poprawka: kontenery poza parkiem, najlepiej na Giełdzie na Kresowej (plan ulic: „kontenery Tessen”); kontrola skanu „mebel w obrysie `leisure=park`/`natural=*` albo na `barrier=fence`”
- Pakiet właściciela: tools/osm-import (props-bulky)

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
