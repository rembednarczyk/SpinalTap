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

### G-052 Teatr Osterwy i Kościół Bernardynów poza danymi miasta (brzeg Krakowskiego na z = −200)
- Status: w naprawie (9f42423: oba zabytki w grze; czeka na G-074, G-075 i decyzję o budżecie sceny referencyjnej 181/76 → 191/81)
- Ważność: S3 (proponowana) · Zasięg: lokalny (Narutowicza, Bernardyńska) · Koszt: duży (prostokąt w config.ts, ADR-0042, regeneracja, budżety)
- Gdzie: (118.0, −205.7), (364.7, −239.8); ile w mieście: 2 zabytki z listy kuratora
- Dowód: brak w66330578 i w67508958 w `*.generated.ts`, `DISTRICTS[0].rect.minZ = −200`; T-014
- Przyczyna (przypuszczalna): zasięg prostokąta Krakowskiego (ADR-0042)
- Pakiet właściciela: tools/osm-import (decyzja: Architekt, ADR-0042)
- Test przyjęcia: kontrola `landmark-missing` daje 0
- Źródło: audyt topografii 1 (kurator, 31.10).

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
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-055 Liczba wywołań rysowania skacze między klatkami w ustalonym mieście
- Status: zgłoszone (z weryfikacji G-031)
- Ważność: S4 (proponowana) · Koszt: nieznany
- Dowód: w tym samym punkcie (300, −60) przy ustalonym mieście kolejne klatki dają 223 i 163 wywołania. Sprawdzić, skąd różnica (komórki przebudowywane leniwie, glow, cienie), i czy nie zaszumia budżetów w `npr-perf`.
- Pakiet właściciela: packages/engine

### G-058 Dotknięcie pierwszego wyboru tuż po otwarciu dialogu czasem ginie (e2e touch)
- Status: zgłoszone (z weryfikacji etapu 5 ADR-0056)
- Ważność: S3 (proponowana: flake w CI i możliwy błąd dotyku na telefonie) · Koszt: mały
- Dowód: `e2e/touch.spec.ts:56-57` „on-screen pad”: 1/4 czerwony na bazie c07dea9 i 2/5 na etapie 5 przy load 6–9; dotknięcie wyboru zaraz po otwarciu koła kwestii nie wybiera kwestii. Sprawdzić, czy koło przyjmuje dotyk przed pierwszym renderem albo czy działa osłona przed „ghost click” (G-048)
- Pakiet właściciela: packages/ui / e2e (QA)

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

### G-075 Kolizje aut na przecięciu pasów 3 Maja przy Zesłańców Sybiru
- Status: w naprawie (gałąź `g075` od main, poprawka `crowded`/`onItsWay` w traffic-system; z naprawy G-052, błąd jest też na main)
- Ważność: S3 (proponowana) · Zasięg: jedno skrzyżowanie · Koszt: mały–średni
- Gdzie: (−110, 56), przecięcie pasów 3 Maja#31:0 i #31:1
- Dowód: `traffic-junction-drive` na gałęzi G-052: Peowiaków ziarna 3 i 7 po 2 kolizje (próg 0), 3 Maja ziarno 7: 3 (próg 2)
- Pakiet właściciela: packages/sim (traffic-junctions)
- Test przyjęcia: `traffic-junction-drive` w progach na gałęzi G-052 i na main

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
- Status: zablokowane przez G-090 (łatka gotowa w `scratchpad/g082-wip.patch`, gałąź `fix/g-082-sidewalk-under-road` bez commita; 262 → 12 m, wariant oś chodnika − 0,5 m, min. 3 m)
- Gdzie: Podwale w40052391/w305027452, Staszica w1150131461, w232805965, Zielona w173533827, Łęczyńska w85717509
- Przyczyna: `roadWidth` bez `width`/`lanes` = 6,5/5 m, a `cutSidewalk` usuwa chodnik, którego środek leży na cudzej jezdni
- Propozycja: zwęzić domyślną jezdnię do 2 × (odległość osi od chodnika − pół chodnika), min. 3 m
- Pakiet: tools/osm-import · Test przyjęcia: `sidewalk-under-carriageway` 262 → 0

### G-083 Drogi dla aut bez nazwy i łącznice bez pasów ruchu
- Status: zgłoszone (audyt dróg) (T-047) · Ważność: S3 · Zasięg: 7 dróg bez nazwy + 3 łącznice, ok. 550 m · Koszt: mały–średni
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

### G-087 `stepRamps` tylko dla nazwanych schodów
- Status: zgłoszone (audyt dróg) (z audytu dróg, bez T: teren = NMT) · Ważność: S4 · Koszt: mały
- Gdzie: `packages/sim/src/content/lublin/shape.ts` `stepRamps` czyta `c.streets` (tylko nazwy) → 3 rampy z 69 biegów
- Decyzja: albo rampy dla wszystkich biegów (wtedy sprawdzić `terrain-off-pads`, `steps-micro-riser`), albo poprawić komentarz

### G-088 Zamkowa zapada się o 3,5 m nad tunelem pieszym przed Zamkiem
- Status: zgłoszone (z przeglądu kuratora G-077)
- Ważność: S3 (proponowana; dojście do Zamku, obejście 6 m od osi) · Zasięg: lokalny · Koszt: średni
- Gdzie: (781.2, 198.8), Zamkowa w154962966 nad w66258159; T-053
- Dowód: GroundField wzdłuż osi: −12,5 → −15,6 → −12,8 m; steepAt prawda na pasie od −8 do +5 m od osi
- Przyczyna (przypuszczalna): NMT bez konstrukcji nad tunelem; ulica bez pomostu (jak BRIDGE_DECKS), a tunel pomija `underground()`
- Pakiet właściciela: tools/osm-import / packages/sim (pomosty)
- Test przyjęcia: kontrola `road-dip-over-tunnel` 1 → 0 (droga z OSM przecina tunel bez wspólnego węzła, a grunt w ±8 m od przecięcia leży > 1 m pod cięciwą; w mieście 34 przecięcia, następne 0,35 m); pod pomostem przejście w66258159 drożne (G-062)

### G-089 Bramy z maxheight=below_default ze sklepieniem 4 m
- Status: zgłoszone (z przeglądu kuratora G-076) · Ważność: S4 · Zasięg: 3 miejsca · Koszt: mały
- Gdzie: Królewska w755152552/555/560; T-054
- Przyczyna: `buildingPassages` (wysokość w `out.push`, przy `widthOf`) nie czyta `maxheight`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `passage-maxheight` 3 → 0 (np. sklepienie 3,6 m dla `below_default`)

### G-090 Przesunięcie pasa ruchu z mediany szerokości całego łańcucha ulicy
- Status: zgłoszone (z naprawy G-082; blokuje G-082)
- Ważność: S3 (proponowana; na łańcuchach o różnej szerokości pas wychodzi poza wąski odcinek, latarnie w pasie) · Zasięg: łańcuchy ulic z odcinkami różnej szerokości · Koszt: mały–średni
- Gdzie: Staszica (dopasowany w1150131461, połowa asfaltu ok. 2,0–2,5 m, i odcinek 3,25 m); latarnie `lamp-road` (217, 145) i (205, 118) 1,03 m od pasa
- Przyczyna: `packages/sim/src/content/traffic.ts` `lanesOf` bierze `laneOffset(roadHalfWidth(...))` z mediany całego łańcucha (2,75 → pas 1,375 m od osi) zamiast lokalnej szerokości odcinka (1,2 m)
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: z łatką G-082 (`scratchpad/g082-wip.patch`) `furniture-in-car-lane` 2 → 0 bez wzrostu `car-lane-off-road`, `lane-dead-end`, `turn-off-road`; świadoma zmiana złotego hasha, jeśli ruch się zmienia
- Uwaga z naprawy G-082: ulice ok. 3–4 m mają w sim dwa pasy, a auta (pół szerokości 0,9 m) zachodzą na chodnik; żadna kontrola tego nie liczy

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
| Nieoglądane: Ruska (zrzuty), Kalinowszczyzna, Zamek, wnętrza, noc i deszcz z bliska, telefon, ekran tytułowy i ładowanie | - | - |
