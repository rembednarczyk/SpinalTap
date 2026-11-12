# Archiwum glitchy

Pełne wpisy naprawionych, odrzuconych i zdublowanych glitchy, przeniesione z [rejestru](glitches.md), który trzyma tylko otwarte sprawy (ADR-0054).

### G-625 Ganger staje przy długim płocie albo murze, gdy w oknie sterowania nie ma drogi
- Status: naprawiony (PR #426, 5888292)
- Ważność: S3 · Zasięg: `planDetour` (`steering.ts`) zwraca „off-field”, gdy w oknie 80 m nie ma objazdu; ganger dochodzi do przeszkody i stoi, gracz za nią bezpieczny (sonda 30 s: 0 strzałów); np. płot (11,83; −251,22), mur 3 m (214; −28,13); bariery z #418 uwidaczniają to w wielu miejscach; test `barrier-ai.test.ts` („moved > 1”) przeszedłby też z gangerem stojącym przy płocie; poprawka: dłuższy objazd (nawigacja po grafie poziomu albo większe okno), a gdy drogi nie ma, przejście do osłony lub szukania
- Pakiet właściciela: packages/sim (systems/ai, steering)

### G-651 `belowGround` zdjęłoby budynek naziemny z `level=-1` i piętrami nad ziemią
- Status: naprawiony (PR #432, f0cad0b)
- Ważność: S4 · Zasięg: `tools/osm-import/src/building-tags.ts` `belowGround`: `level=-1` przy `building:levels=3`, `height=20` albo `roof:levels=1` daje `true`, więc budynek naziemny zniknąłby; w danych dziś takiego nie ma, ryzyko na przyszłość; poprawka: budynek z dodatnimi piętrami lub wysokością nie jest podziemny
- Pakiet właściciela: tools/osm-import

### G-646 Skan `market-pieces` ma własną regułę podziemia
- Status: naprawiony (PR #431, 71841c5)
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/market-pieces.ts:96` `const isBuilding = (t: Tags): boolean => t.building !== undefined && t.building !== "roof" && t.location !== "underground" && Number(t.layer ?? 0) >= 0;`: garaż z `level=-2`, `layer=2` liczy jako budynek, a samo `layer<0` (budynek pod wiaduktem) jako podziemie; do ujednolicenia z `belowGround` (G-600)
- Pakiet właściciela: tools/glitch-scan

### G-601 Budynki na brzegu mapy z domyślną wysokością niezgodną z NMPT
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S4 · Zasięg: Cicha 6 w grze ok. 15 m przy ok. 7 m w rzeczywistości, Cicha 8 ok. 11,2 m przy ok. 17,5 m, XVI LO ok. 6 m za niskie, Pałac Ordynacki bez dachu spadzistego (jak G-122), narożnik Cichej 5 do sprawdzenia; T-250; także VIVO r5601275: 11,1 m z `building:levels=3` w relacji, LoD1 17,2 m (po scaleniu heights sprawdzić, że LoD1 trafia do VIVO, nie do zdjętego garażu w173070505)
- Pakiet właściciela: tools/osm-import

### G-629 Na skarpie cokół NMT połyka kondygnacje z tagu (Kowalska)
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: reguła `MIN_STOREY` w `lod1-heights.ts` liczy ściany od wierzchu cokołu; przy cokole 9–12 m Kowalska 7 spada z 4 kondygnacji do 1, Kowalska 9, 11, 13 z 3 do 1, od ulicy ślepy mur z jednym rzędem okien; 15 budynków (T-252); poprawka: kondygnacje z tagu zostają, gdy `height ≥ levels × 2,6`, cokół do `height − levels × STOREY`
- Pakiet właściciela: tools/osm-import

### G-631 Trybunał Koronny i Teatr Osterwy poniżej LoD1, Trybunał niższy od kamienic Rynku
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: oba w `LOD1_LANDMARKS` zostają przy starych wysokościach; Trybunał okap 11,4 m wobec LoD1 17,5 m i LoD2 ok. 16,4 m, po zmianie kamienice Rynku mają okapy 4–8 m wyżej (odwrócona relacja); Teatr 16,3 wobec 19,5 m (T-254); poprawka: korekta w `TAG_CORRECTIONS` zgodna z LoD1 i NMPT; kontrola `landmark-vs-lod1` (baza 3 z Klasztorem Dominikanów, G-633)
- Pakiet właściciela: tools/osm-import

### G-632 Wyjątek `historic` wyjmuje z LoD1 pałace spoza listy punktów orientacyjnych
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: `use === "historic"` w `lod1Exempt`: Pałac Zylbera 10,1 m wobec LoD1 19,4 m (okap LoD2 17,7), Pałac Parysów 11,1 wobec 18,1, Złota 3, Rynek 11, Pałac Pawęczkowskiego, DPS im. Michelisowej (T-255); poprawka: usunąć ten warunek, punkty orientacyjne mają własną listę; kontrola `height-vs-lod1` z historic (baza 10)
- Pakiet właściciela: tools/osm-import

### G-600 Podwójna bryła VIVO: garaż podziemny `level=-2` rysowany jako budynek
- Status: naprawiony (PR #427, a6cef32)
- Ważność: S3 · Zasięg: w173070505 (`building=yes`, `level=-2`, `layer=2`) ma prawie ten sam obrys co VIVO r5601275; po G-556 obie bryły wracają przycięte, nakładają się na 1732 m², dachy dzieli 0,1 m (y −12,5 i −12,6), ryzyko migotania; Podzamcze x 1088–1120, z 160–240; poprawka: pomijać w imporcie budynki, których wszystkie `level` są ujemne (jak `location=underground`); garaż wystaje poza VIVO, więc po usunięciu odsłania ok. 149 próbek gołej ziemi (do wyłożenia według ortofoto); skan: ta sama reguła w `edge-buildings.ts` i `building-underground-solid`, nowa kontrola `building-duplicate` (nakładanie > 50% pola mniejszego, bez `building:part`)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-613 Trasy tłumu przy Podwalu biegną po linii muru oporowego zamiast osią chodnika
- Status: naprawione w #428 (12.11; `offBarriers` odsuwa trasy placów 1 m od barier wzdłuż, `unloop`; mur w67626198 179/183 m)
- Ważność: S3 · Zasięg: trasy `stare-miasto-1-0-square-0` i `stare-miasto-1-1-square-0` idą w medianie 0,5 m od muru w67626198, a oś chodnika w56965511 jest 0,65–1,95 m od muru (zwykle 1,7 m); przez to 61 m dwumetrowego muru skarpy pod Archikatedrą wycięte (x 673–693, 701–705, 731–743, 753–760 przy z −200…−161 i x 745–760 przy z −15…12); kryterium: trasy co najmniej 1,0 m od muru i mur w grze ponad 170 z 183 m; T-251
- Pakiet właściciela: packages/sim (tłum), tools/osm-import


### G-626 Piesi tłumu wchodzą w bariery biegnące wzdłuż ich trasy
- Status: naprawione w #428 razem z G-613 (12.11; `CROWD_LINE` 0,70 m, `barrier-on-crowd-lane` 0, `barrier-parallel-cut` 15 → 12)
- Ważność: S4 · Zasięg: `barrier-room.ts` (`CROWD_LINE` 0,3 m) przy pieszych idących 0,28 m od linii trasy bez kolizji z bryłami; 45 kawałków, 149 m (21 płotów, 7 żywopłotów, 1 mur, 16 murów oporowych), najgłębiej ponad 0,2 m, np. płot (729,5; 93,0); skan `barrier-on-crowd-lane` ma próg `ALONG` 0,2 m zamiast 0,58 m; łączy się z G-613 (trasy tłumu z dala od barier)
- Pakiet właściciela: packages/sim (tłum), tools/glitch-scan


### G-522 Klinowe szczeliny bez nawierzchni między jezdnią a chodnikiem Krakowskiego
- Status: naprawione: krok 1 w #400, krok 2 w #409 (12.11; reguła `kerbFills` z indeksem `RingBins`, `kerb-gap-bare` 103 204 → 29 702; budżet reference 199/85 z wpisem w ADR-0046; T-247)
- Ważność: S3 · Zasięg: (−120,5..−114; 54,5..101) 128 m², (−104,5..−102,5; −6,5..13) 48 m², (−121,5..−120,5; 74,5..100,5) 27 m², także części nieliczone skanem; zrzuty `kp-strip-g`, `s-strip-l`, `wedge`; przyczyna: jezdnia i chodnik się nie schodzą; propozycja `kerb-gap-bare` z przeglądu G-440 (baza ok. 35 631 próbek 0,25 m w mieście)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-570 Wypełnienie G-522 kładzie chodnik na pasach postojowych, zatokach i pasie ruchu
- Status: naprawione w #409 (12.11; asfalt jako osobne kawałki jezdni, kurator runda 3 ZGODNE)
- Ważność: S3 · Zasięg: 12 z 19 miejsc ortofoto, ok. 63% z 5 855 m² wypełnień przy ulicach z `lanes`; krawężnik 1–3 m wewnątrz prawdziwej jezdni (Ruska, Kapucyńska, Niecała, Peowiaków, Lubartowska przy przystanku Brama Krakowska 01, Unii Lubelskiej, Turystyczna, 3 Maja, Dolna Panny Marii, Zesłańców Sybiru); trawnik jako chodnik przy Andersa; przyczyna: szerokość z `lanes` × 3,25 lub typu nie obejmuje postoju, `fitToKerb` (T-046) tylko zwęża; poprawka: pas przy ulicy o szacowanej szerokości i szczelinie ≥ 1 m jako jezdnia z krawężnikiem przy nawierzchni pieszej, zebry do nowego krawężnika, trawniki przez korekty; kontrole `bus-stop-on-fill` i `kerb-fill-wide-estimated`
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-605 Fundamenty fary na Placu po Farze stoją jako murki 1,0 m zamiast ok. 0,5 m
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: r18507551, r18507552, w1348806697–708 (431 m w grze), NMPT − otoczenie: mediana 0,45 m, p75 0,78 m; przy 1,0 m zamknięty labirynt; poprawka: korekta wysokości 0,5 m (bez w1348806709, taras przy Rynku 11); kontrola `ruin-wall-height`
- Pakiet właściciela: tools/osm-import


### G-606 Symulacja tnie bariery, wzdłuż których biegnie trasa tłumu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: 21 odcinków ≥ 3 m, ok. 397 m, m.in. 127 m z ok. 152 m dwumetrowego muru oporowego skarpy pod Archikatedrą w67626198 (Podwale), ogrodzenie w231832115 (70 m), żywopłot w828140561; trasa 0,9 m od muru zostawia 0,4 m luzu; poprawka: ciąć tylko przy przecięciu (kąt jak `CROSS_SINE`) albo mniejszy `CROWD_ROOM`; kontrola `barrier-parallel-cut`
- Pakiet właściciela: packages/sim, tools/osm-import


### G-607 Przy schodach znikają mury po obu stronach biegu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: Zaułek Panasa w179264861: mur miejski w232362994 z 40 m zostaje 7 m (`FLIGHT_ROOM` 1,9 m), mur oporowy w232362995 traci 40 m w imporcie i 37 m w sim; balustrada w231832095 na podeście w Podzamczu (785; 248); poprawka: mur na krawędzi biegu zostaje (ewentualnie odsunięty na krawędź pasa), odstęp z szerokości biegu; kontrola `city-wall-kept`
- Pakiet właściciela: tools/osm-import, packages/sim


### G-608 Import tnie bariery biegnące wzdłuż krawędzi pasa jezdni
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S4 · Zasięg: pas z `roadWidth` szerszy niż jezdnia na ortofoto, więc mur przy krawężniku leży „na jezdni”: w232806008 (51 m, 389; 153), w886723051 (48 m, 220; −196), płot w73811517 przy Zamkowej (985; 281), murek w227679479 (28 m, 534; 517), koniec w67626198 (29 m); poprawka: reguła kąta jak dla dróg, bariery wzdłuż krawędzi przesunąć poza pas
- Pakiet właściciela: tools/osm-import


### G-610 Gracz za płotem jest nietykalny: ganger widzi przez płot i strzela w niego bez końca
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S2 · Zasięg: `inSight` (`ganger-perception.ts:201`) przez `clearSight` przepuszcza wzrok przez płot, a strzał płot zatrzymuje; `ShootAtPlayer` zeruje prędkość, `ChasePlayer` i `firingPosition` się nie włączają; sonda: 11 strzałów, 0 HP straty przy trzech płotach; 1359 płotów w grze
- Pakiet właściciela: packages/sim (systems/ai)


### G-611 Świadkowie przestępstwa nie widzą przez płot i żywopłot, obserwatorzy ciał widzą
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S4 · Zasięg: `crime-system.ts:82-104` (kamera, świadek, patrol, `inPlayerView`) używa `lineOfSight`, a reszta wzroku `clearSight`
- Pakiet właściciela: packages/sim


### G-612 Mury przecinają ogródki kawiarniane i siedziska tłumu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: `furnitureClearance` (`world-barriers.ts:513`) pomija meble niesolidne, `CROWD_SPOTS` i `SEAT_SPOTS` nie biorą udziału w cięciu; cafe-garden (629,5; 117,2) 31 ze 168 próbek w murze, (583,7; 24,5), siedziska #286 i #287 z murem 0,05–0,14 m przed twarzą
- Pakiet właściciela: packages/sim, tools/glitch-scan


### G-637 Limit pobierania modelu liczy cały czas, nie bezczynność
- Status: naprawione w #424 (12.11; limit bezczynności 30 s, strumień zwalniany po porażce)
- Ważność: S4 · Zasięg: `MODEL_FETCH_TIMEOUT_MS` (120 s) przerywa całe pobieranie; przy łączu wolniejszym niż ok. 0,5 Mbit/s plik 8 MB (kaito.vrm) nigdy się nie załaduje, bo każda próba zaczyna od zera; poprawka: limit bezczynności (brak nowych bajtów przez N s) zamiast całkowitego; przy okazji: pełny zestaw engine+app+code-health trwa ok. 507 s (import 55%), do rozważenia `isolate: false` albo podział
- Pakiet właściciela: packages/engine (renderer: modele)


### G-634 `ModelLibrary.load` nie sprawdza `response.ok`
- Status: naprawione w #423 (12.11; `r.ok` sprawdzane przed parserem)
- Ważność: S4 · Zasięg: odpowiedź 404 albo 500 trafia do parsera jako GLB i pada dopiero przy parsowaniu z mylącym błędem; `.gltf` po URL (`LoadAssetContainerAsync`) i dynamiczny import pluginu glTF nadal bez limitu czasu (dziś nieużywane, manifest ma `.vrm`)
- Pakiet właściciela: packages/engine (renderer: modele)


### G-638 `fetch` bez sprawdzenia `res.ok` w zestawie miasta i dźwiękach
- Status: nie odtwarza się (12.11; wszystkie trzy miejsca sprawdzają `res.ok` w linii po `fetch` od fe802ea i 51d54c7, zgłoszenie wskazało same wywołania; błąd idzie do zastępstwa: fasady proceduralne, synteza dźwięku)
- Ważność: S4 · Zasięg: `city-kit-loader.ts:108`, `city-kit.ts:167` i `audio/samples.ts:62` pobierają bez sprawdzenia statusu, więc 404 trafia do parsera albo dekodera z mylącym błędem (ten sam wzorzec co G-634)
- Pakiet właściciela: packages/engine (renderer, audio)


### G-561 Model, którego pobieranie się nie kończy, zostawia postacie tła z pożyczką ubrania jako figurę riga na stałe
- Status: naprawione w #422 (12.11; limit 120 s, `fetchModelBytes` z AbortController i wyścigiem z zegarem; dalszy ciąg G-637)
- Ważność: S3 · Zasięg: `ModelLibrary.load` nie ma limitu czasu, więc zawieszony fetch blokuje `settled()` i `clothOf`
- Pakiet właściciela: packages/engine (renderer: modele)


### G-628 `tools/orto report --area` wybiera raster po pierwszym wierzchołku obszaru
- Status: naprawione w #421 (12.11; `coverOfRing` wybiera raster pokrywający najwięcej wierzchołków)
- Ważność: S4 · Zasięg: `report.ts --area T-245/zielen-litevski` zwraca „brak rastra”, bo pierwszy wierzchołek (x −201) leży tuż przed rastrem Krakowskiego (od x −200); poprawka: wybór rastra po środku obszaru albo po dowolnym punkcie na rastrze
- Pakiet właściciela: tools/orto


### G-621 `ModelMemory` bez testu kolejności zwalniania
- Status: naprawione w #420 (12.11; test jednostkowy `model-memory.test.ts`, pada 3/5 przy odwróconym sortowaniu)
- Ważność: S4 · Zasięg: przypadek telefonu w `model-release.test.ts` przechodzi także z odwróconym sortowaniem w `ModelMemory.sweep` (naraz jeden kandydat); brak testu jednostkowego „najdłużej nieużywany idzie pierwszy”
- Pakiet właściciela: packages/engine (testy)


### G-556 Budynek ze środkiem poza mapą znika w całości, także w części leżącej w chunku
- Status: naprawione w #414 (12.11; budynki przycięte do brzegu mapy ze ślepą ścianą; budżety reference 196/84 i krakowskie-tpp 165 z wpisem w ADR-0046; reszta za brzegiem w backlogu „Poszerzanie mapy”, T-250)
- Ważność: S3 · Zasięg: w mieście 50 budynków, ok. 10 100 m²; w krakowskie-0-1 Cicha 3, 5, 6 i 8 (281 m²), które w grze dają gołą ziemię w pasie Cichej i przy ogrodzie na zachód od Cichej 4; Ordynacki i Kuria już w T-058/G-096; propozycja kontroli `edge-building-dropped` (część w chunku > 2 m², środek poza mapą, poza rejestrem), baza 50 albo 48 bez T-058
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-620 Test zwalniania modeli przekracza w CI limit 20 s
- Status: naprawione (PR #419, 11.11; testy zwalniają `NullEngine` w `afterEach`, przypadek telefonu na lekkim pliku pod siedmioma nazwami; 6,3 → 1,8 s, pod obciążeniem 9,7 → 4,3 s; limity czasu bez zmian)
- Ważność: S2 · Zasięg: `packages/engine/test/model-release.test.ts` › „keeps no more files than a phone's limit” (#410) wczytuje sześć pełnych plików VRM przez NullEngine i w CI kończy się `Test timed out in 20000ms`; czerwieni shard „Unit tests (1)” w #416, #417, #418 (lokalnie przechodzi); limitu nie podnosimy, test do odchudzenia
- Pakiet właściciela: packages/engine (testy)

### G-536 Goła ziemia na placu przy Nowym Placu Targowym, Nadstawnej i na podwórzach Podzamcza (podzamcze-1-1)
- Status: naprawione (PR #408, 11.11; 22 obszary T-246/*: 15 kostki, 7 trawników i rabat; `landuse-bare` podzamcze-1-1 8021 → 188, podzamcze-0-1 6972 → 222; kurator ODSTĘPSTWO CELOWE T-246 po rundzie 2; obszary pocięte, żeby nie poszerzać siatek ziemi komórek: `krakowskie-tpp` 164 siatki jak na main)
- Ważność: S3 · Zasięg: 93 kwadraty 10 × 10 m `landuse-bare`, ok. 2005 m² (8021 próbek 0,5 m) w 28 skupieniach; największe (m², x, z): 680 (747..800; 446..490) przy parkingach w227698438 i w227698440, postoju taxi w227698439 i sklepie w73833921; 221 (735..750; 452..511) za Nova w66264174; 159 (815..841; 450..485) przy kioskach w73833930/31/32; 153 (742..769; 513..536) przy skraju Ruskiej; 121 i 107 (848..868; 507..526) przy Szkolnej; 110 (769..808; 501..526); 98 (807..828; 458..490); 91 (860..878; 487..498); dziewięć największych to ok. 88%; 60% próbek w `landuse=commercial` w1305996965 bez `surface`, 37% w pasie do 5 m od ścian; zrzuty dzienne `shots/opiekun-p11/d-d1-d.png`, `d-b1-b.png`, `d-a2-plac-e.png`; przyczyna jak G-513, G-521, G-527; test przyjęcia: `landuse-bare` w komórce do ≤ 10% z bazą obniżoną w tym samym commicie
- Pakiet właściciela: tools/osm-import (korekty nawierzchni)

### G-540 Goła ziemia na podwórzach i placach Podzamcza: Lubartowska, Probostwo, Nowy Plac Targowy, Ruska (podzamcze-0-1)
- Status: naprawione (PR #408, 11.11; 22 obszary T-246/*: 15 kostki, 7 trawników i rabat; `landuse-bare` podzamcze-1-1 8021 → 188, podzamcze-0-1 6972 → 222; kurator ODSTĘPSTWO CELOWE T-246 po rundzie 2; obszary pocięte, żeby nie poszerzać siatek ziemi komórek: `krakowskie-tpp` 164 siatki jak na main)
- Ważność: S3 · Zasięg: 81 kwadratów 10 × 10 m `landuse-bare`, ok. 1743 m² (6972 próbki 0,5 m; pierwotnie zaniżone do 2180 przez błąd zaokrąglenia) w 28 skupieniach; największe (m², x, z): 208 (609..662; 386..457) wzdłuż Lubartowskiej i przy Nowym Placu Targowym, 48 (606..630; 398..461), 38 (636..650; 559..580) przy parkingu w227679484, 37 (520..530; 427..447), 34 (676..715; 567..580) przy Ruskiej; kontekst OSM: 36% w `landuse=retail` w291844839 bez `surface`, 20% w `landuse=commercial` w1094207955, 7% w `landuse=retail` w1547216431, 35% poza wielokątami; zrzuty `shots/opiekun-p01/d-s3-slope2.png`, `d-a1-big-w.png`, `d-a2-big-n.png`; przyczyna jak G-513, G-521, G-527, G-536; przy okazji w komórce `kerb-gap-bare` 116 trafień (G-522) i 7 znanych `lane-dead-end`, G-508 tu to prawdziwe skarpy NMT (największa 548..570 × 538..560, 33°)
- Pakiet właściciela: tools/osm-import (korekty nawierzchni)

### G-059 Testy sesji `m2-schedules` i `m3-loop` trwają ok. 5 s i przekraczają limit vitest pod obciążeniem
- Status: odrzucone (pomiar, 31.10)
- Ustalenie orkiestratora: główny `vitest.config.ts` daje `testTimeout: 20_000` właśnie dla testów całych aktów. Limit 5 s działa tylko przy vitest puszczonym z katalogu pakietu, bez głównej konfiguracji. Z roota przy load 30: najdłuższy test 7,6 s (zegar HUD, 3600 klatek), wszystkie 10 zielonych. Testy uruchamiamy z roota repo

### G-095 Żółty kabel kanionu przez przedsionek Trasy Podziemnej (do potwierdzenia)
- Status: odrzucone, niepotwierdzone (porządek rejestru 11.11): niepotwierdzone (glitch hunt wnętrz, 31.10)
- Ważność: S4 (proponowana) · Koszt: mały
- Dowód: zrzut `scratchpad/shots1/p1-trasa-vest.png` (kamera 567, 1,93, −57, yaw π/2): żółta linia na wysokości głowy w poprzek przedsionka i krótki odcinek na tylnej ścianie
- Do ustalenia: czy to kabel z `renderer/mapcity/canyon-plan.ts` albo `landmarks/cables.ts` przechodzący przez bryłę; ile takich w mieście
- Pakiet właściciela: packages/engine (jeśli się potwierdzi)
- Test przyjęcia: kontrola `cable-through-interior` (odcinek kabla wchodzi w bryłę wnętrza `interior: true`) z bazą → 0

### G-226 E2E `npr-perf` „the Rynek in TPP” przekracza 90 s na `citySettled` przy load 12–15
- Status: odrzucone, nie regresja (porządek rejestru 11.11): zbadane (2.11, naprawiacz): przepustowość maszyny, nie regresja. Klatka pod SwiftShaderem 2–3 s przy load 10, 4–7 s przy 15–19 (skoki 10–16 s); miasto dochodzi do `citySettled` w 1–3 klatki; main vs. przed #186 i #167: wywołania i siatki identyczne, trójkąty +1 %, czas w szumie. Propozycje: (1) wspólna strona dla scen TPP (zmienia historię próbki, decyzja), (2) klatki na żądanie w `freeze` (`__seki.draw(n)`, ADR-0046), żeby `page.evaluate` nie czekało za klatkami w tle (pomoże też G-132), (3) orkiestrator wstrzymuje ciężkie zadania na czas e2e perf. Propozycja (2) zbudowana i odłożona (gałąź `ccr-ec2c4269-ilh8k8-draw-on-demand` @ 07c0b98, bez PR): `FrameGate` i `__seki.draw(n)` działają, budżety i migawka bez zmian, ale scena nie jest krótsza (settle potrzebuje 4–5 klatek zamiast 3–4, sumy w szumie); wątek strony blokuje też coś poza klatkami w tle (wiadukt: `step` 10 s, rynek: teleport 3 s; hipoteza: synchroniczne GL przy spawnie siatek nowego chunka). Następny krok: ślad tego `step`, potem decyzja o (1); raport `scratchpad/g226-raport.md`
- Ważność: S3 (test, czerwony CI kosztuje cykl) · Zasięg: `e2e/npr-perf.spec.ts:89` (Rynek TPP), także „Krakowskie Przedmieście TPP” i „market under the viaduct” (weryfikator #199: timeout 90 s przy load 13–17; viaduct na main 1,4 min przy load 15–21); powtórki same przechodzą
- Poprawka: ślad (trace) i pomiar, co trzyma `citySettled` (wczytywanie chunków, kafle, decale z #186?); bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: e2e (QA), engine

### G-285 Przeciwnicy wykrywają gracza natychmiast, takedown niemożliwy
- Status: naprawione (porządek rejestru 11.11): naprawione przez ADR-0069 etap 1 (#252) i 2 (#254, 5.11, słuch kroków); balans w etapie 3 (trop co krok za ścianą, sprint przed Kagami i Tessen 0,6–0,7 s)
- Ważność: S2 (proponowana: blokuje mechanikę) · Zasięg: walka z gangerami; czujność NPC i kamer (`AWARENESS_STEP`, `GUARD_CONE`, `ganger-perception.ts`)
- Do ustalenia: błąd w czujności czy brak trybu skradania (backlog, skradanie)
- Pakiet właściciela: packages/sim/src/systems/ai

### G-562 Plik modelu, który się nie wczytał, nie wczyta się ponownie w tej sesji
- Status: naprawione (PR #410, 8.11; odrzucony promise wypada z `containers`, plik wczytuje się ponownie; testy `model-loader` i `model-release` padają bez poprawki)
- Ważność: S4 · Zasięg: odrzucony promise zostaje w `containers` `ModelLibrary`, bez ponowienia
- Pakiet właściciela: packages/engine (renderer: modele)

### G-580 `parseModelManifest` przepuszcza pole `lends` bez walidacji
- Status: naprawione (PR #410, 8.11; `parseModelManifest` odrzuca wpis z `lends` innym niż boolean; test w app)
- Ważność: S4 · Zasięg: `"lends": "true"` (napis) po cichu usuwa `base-female.vrm` z dawców i przywraca G-575; żaden test aplikacji nie sprawdza, że `lends` przeżywa parsowanie (`model-donors.test.ts` czyta surowy JSON); przy okazji opis commita d2e8007 mówi o 10 postaciach, ADR wylicza 9
- Pakiet właściciela: packages/app (manifest modeli)

### G-547 `kurosawa.vrm` wczytuje się na ekranie ładowania, choć Kurosawa pojawia się w II akcie
- Status: naprawione (PR #407, 8.11; ADR-0076 etap 4a: start nowej gry 7 plików / 42,5 MiB → 6 / 36,5 MiB, `kurosawa.vrm` wczytuje się, gdy Kurosawa staje w scenie; 3 rundy weryfikacji: G-560, G-575)
- Ważność: S4 · Zasięg: +6 MiB na starcie; `donorsOf` ładuje wszystkie pliki manifestu przy liczeniu dawców ubrań; wczytywanie w tle według dzielnic i aktów to etap 4
- Pakiet właściciela: packages/engine (renderer: modele)

### G-560 Wygląd postaci tła zależy od tego, które pliki modeli są już wczytane
- Status: naprawione (PR #407, 8.11; stały zbiór dawców `donorFiles` = Seki ∪ pliki tła ∪ obsada z `lends`; testy determinizmu padają na rundzie 1)
- Ważność: S3 · Zasięg: w gałęzi #407 `countDonors` (`character-models.ts`) liczy dawców tylko z wczytanych plików, a `donorOf` (`model-dress.ts:48-49`) wybiera teksturę jako `floor(fraction * list.length)`; ta sama postać tła (to samo ziarno) po ponownym ubraniu nosi inne spodnie lub górę po wczytaniu `mori.vrm` w tle i po `kurosawa.vrm` w II akcie; łamie decyzję „Determinizm” ADR-0076
- Pakiet właściciela: packages/engine (renderer: modele)

### G-575 Postacie nazwane zmieniają ubranie po zmianie zbioru dawców w #407
- Status: naprawione (PR #407, 8.11; `base-female.vrm` wśród dawców przez `lends`; względem main zmieniają się tylko spodnie barmana, gull-guard, Shiro, Daigo i Koji, opisane w ADR-0076 §4a; test `model-donors.test.ts`)
- Ważność: S3 · Zasięg: wariant 100+ z `dress` bez `topFrom`/`bottomFrom` bierze te pola z ziarna, więc krótsza lista dawców zmienia indeks w `donorOf`; zmiany: spodnie barmana, gull-guard, shiro, daigo (Kurosawy → Kaito), koji (Kurosawy → gangera), akane (base-female → Seki), koi-regular-2 (góra i spodnie), mei i mika (góra); barman i koi-regular-2 w Neon Koi; ADR nie opisywał zmiany
- Pakiet właściciela: packages/engine (renderer: modele)

### G-521 Goła ziemia na podwórkach bloków Krakowskiego Przedmieścia (krakowskie-0-1)
- Status: naprawione (PR #405, 8.11; 19 obszarów T-245/*, w tym 6 trawników, w `corrections-zn.ts` i `corrections-radziwillowska.ts`; `landuse-bare` komórka 10 004 → 136, miasto 96 273 → 86 405, `kerb-gap-bare` → 101 904; test `landuse-bare-krakowskie-0-1.test.ts` pada bez poprawki; kurator ODSTĘPSTWO CELOWE T-245 po rundzie 2; budynki Cichej 3–8 w G-556, pętle `highway=service area=yes` w G-555)
- Ważność: S3 · Zasięg: 141 kwadratów 10 × 10 m, ok. 3100 m², 59 skupień; największe: blok NW 1431 m² (x −200..−120; z −20..49, zawiera pas z 7..12 od naprawiacza G-513), podwórze SW 289 m² (−198..−165; 92..124) i 273 m² (−163..−135; 73..93), wschód (−27..−5; 143..158) 109 m², (6..19; 139..151) 81 m²; zrzuty `shots/opiekun-k01/` (`nw-strip-a`, `s-yard-i`, `se-a`); przyczyna jak G-513 (OSM bez nawierzchni na podwórkach); poza skanem ok. 4800 m² gołych podwórek mieszkalnych (do decyzji kuratora)
- Pakiet właściciela: tools/osm-import (korekty)

### G-509 Stożek odblasku na stropie food hallu Alchemii (i możliwy w kapsule)
- Status: naprawione (PR #402, 8.11; lampy hali i kapsuły w oprawie stropu, testy padają bez poprawki)
- Ważność: S4 · Zasięg: lampa w `alchemia-view.ts` wisi 0,4 m pod stropem hali (zrzut `shots/g490/after/hall-north.png`), lampa w `capsule-room-view.ts` 0,3 m pod sufitem; poprawka jak w P−1: lampa w oprawie stropu (po G-490 shader już nie świeci od tyłu)
- Pakiet właściciela: packages/engine (renderer)

### G-513 Goła ziemia na podwórkach i przy gmachach Krakowskiego Przedmieścia (krakowskie-0-0)
- Status: naprawione (PR #397, 8.11; 18 ręcznych obszarów kostki T-243/* w `corrections-krakowskie.ts` i `corrections-ck.ts`: podwórza KP 37–60 z Sądem i UM, pasy przy fasadach, okolice Centrum Kultury, trawnik `ck-zachod` przy zachodniej ścianie CK; `landuse-bare` komórka 10 075 → 155, miasto 108 592 → 96 273; test `landuse-bare-krakowskie.test.ts` pada na danych sprzed poprawki; kurator ODSTĘPSTWO CELOWE T-243; kratki i krawężnik w G-519)
- Ważność: S3 · Zasięg: 144 kwadraty 10 × 10 m `landuse-bare` w ok. 87 skupieniach, ok. 2500 m²; największe: 244 m² (x −53,8..−13,8; z −94,3..−84,3), 208 m² (−189..−150; −220..−189), 190 m² (−188..−127; −270..−220), 182 m² (−176..−162; −32..−20), 180 m² (−155..−107; −101..−72), 155 m² (−16..−2; −128..−99); zrzuty `shots/opiekun-k00/clD-0.png`, `bare1-a.png`, `sad.png`; przyczyna: import nie kładzie nawierzchni na podwórkach i pasach przy gmachach (`landuse=retail/commercial`, gmachy publiczne); rozszerzenie G-450/T-221; kontrola `landuse-bare` istnieje, poprawka obniża bazę; przy okazji: G-508 w tej komórce to szum NMT przy krawędziach budynków (1 krawędź > 20° pod budynkiem, 15 > 10° w gołym terenie; propozycja `terrain-crease` z progiem 12° bez obrysów budynków), T-204 do sprawdzenia przez kuratora (skan `tree-height-vs-nmpt` 0 w komórce)
- Pakiet właściciela: tools/osm-import (ground), tools/glitch-scan

### G-517 Duszony strażnik po ok. 4 s nadal stoi zamiast klęczeć
- Status: odrzucone, nie odtwarza się (PR #401, 8.11; test ochronny: cel klęczy po 1,2 s i do końca przytrzymania; zrzut e2e był po krokowaniu hurtem `step(n)` bez klatek renderera, rozwiązanie dokładne w G-482)
- Ważność: S4 · Zasięg: przy przytrzymanym duszeniu (ADR-0075) `heldPose` celu nie przechodzi w klęczenie po ok. 4 s; do sprawdzenia testem pozy w czasie i z czasem fazy (por. G-482)
- Pakiet właściciela: packages/engine (renderer: grab-pose)

### G-511 Znak `spread` w `activity-poses.ts` zwiera nogi zamiast je rozstawiać
- Status: naprawione (PR #396, 8.11; `applyActivityPose` i `poseParts` tłumu: lewa noga −spread, prawa +spread, jak w kucaniu; testy w `activities.test.ts` i `crowd.test.ts` padają bez poprawki)
- Ważność: S4 · Zasięg: dodatnie `spread` dla lewej nogi obraca ją do środka (`legL.rotation.z = +0,2` przesuwa kolano z x −0,083 na +0,005), komentarz mówi „feet apart”; wartości 0,04–0,08, sprzed #386
- Pakiet właściciela: packages/engine (renderer: pozy)

### G-514 Przód spódnicy Seki wcina się w udo przy duszeniu (poza „holdingDown”)
- Status: naprawione (PR #396, 8.11; `holdingDown` w `grab-pose.ts`: pochylenie 0,15, udo −1,0 rad (biodro 66°), kolano 0,8, ciało 3 cm wyżej; wnikanie 3,8/2,2 cm (duszenie) i 3,9/2,5 cm (zabicie) → najwyżej 0,6 cm; rozjazd głowy TPP i oka FPP w duszeniu ok. 9 cm, tylne kolano i stopa w powietrzu w G-516)
- Ważność: S4 · Zasięg: `grab-pose.ts:149`, poza postaci chwytającej ma udo L −1,55 rad przy pochyleniu 0,3 (ok. 72° zgięcia w biodrze), ponad granicą ok. 63° dla przodu spódnicy `seki.vrm` (pomiar z #386); brak przypadku w `seki-skirt.test.ts`; przy okazji: śmierć z kucnięcia nie wygasza `body.position.y/z` ani `body.rotation.x` (ciało przesunięte −0,38/−0,14 m, kosmetyka)
- Pakiet właściciela: packages/engine (renderer: pozy)

### G-512 Postać zabita w kucki leży z kolanami na zewnątrz
- Status: naprawione (PR #394, 8.11; `animateDeath` wygasza `rotation.z` nóg, `applyPose` miesza ją do 0; w chwycie z kucnięcia kolana schodzą płynnie, pozy aktywności bez zmian; testy padają bez poprawki)
- Ważność: S4 · Zasięg: `animateDeath` (`character-animation.ts`, ok. l. 136) nie zeruje `legL/legR.rotation.z`, więc po nowym kucaniu z kolanami na zewnątrz (0,25 rad) ciało leży z rozwartymi kolanami; przy okazji: nieaktualny komentarz `CROUCH_EYE_HEIGHT` w `packages/sim/src/world/hitscan.ts:93` (głowa rigu w kucki 1,22 m, oko 1,14 m)
- Pakiet właściciela: packages/engine (renderer)

### G-507 Pastorał przy przyczółku wiaduktu Zamkowej ma latarenkę na wysokości przechodniów
- Status: naprawione (PR #392, 8.11; `DECK_DROP` 1 m z pomiaru, pastorał (756,8; 175,7) → (756,4; 176,2) na pomoście; przy okazji `lamp-road` Nabrzeża z obrysu pomostu jezdni na chodnik mostu; `lamp-beside-deck` od 1,5 m, 1 → 0)
- Ważność: S4 · Zasięg: (756,8; 175,7) stoi 1,85 m pod pomostem, 2 m od niego (poniżej progu `DECK_DROP` 2,5 m), latarenka ok. 1,55 m nad pomostem, 0,35 m od kostki; poprawka: niższy próg albo `byParapet` od ok. 1,5 m; zaostrzenie `lamp-beside-deck` do 1,5 m (baza 1)
- Pakiet właściciela: tools/osm-import (props)

### G-490 Przez strop P−1 Alchemii widać półprzezroczysty stożek
- Status: naprawione (PR #385, 8.11; stożek na stropie P−1 to odblask lampy P−1 0,4 m pod stropem i shader świecący od tyłu: lampa w oprawie, odblask tylko z powierzchni zwróconej do światła; deszcz nie pada w food hallu (`built-roofs.ts`); oświetlonych punktów stropu 126067 → 0; migawka NPR bez zmian; reszta w G-509)
- Ważność: S4 · Zasięg: na zrzucie `after/e4-deck.png` stożek (prawdopodobnie poświata latarni albo drona z T0) przechodzi przez strop parkingu; do sprawdzenia też, czy w food hallu z etapu 1 nie pada deszcz pod stropem
- Pakiet właściciela: packages/engine (renderer: efekty)

### G-506 Generator mebli ignoruje `yaw` grup planu z `points` (ławki placu T0 tyłem do trawników)
- Status: naprawione (PR #382, 8.11, runda 2; `placeItem` bierze `yaw` grupy także dla `points`, zmiany tylko w krakowskie-2-1; 11 ławek placu T0 przodem do trawników i placu; test w `props.test.ts` pada bez poprawki)
- Ważność: S4 · Zasięg: `placeItem` dla grup z `points` ustawia `yaw: null` (props-gen.ts ok. 245), `openFacing` odwraca 7 z 8 ławek placu T0 od trawy, 4 pod pergolą patrzą na wykop rampy; kontrola `plan-yaw-ignored` (baza 8)
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-500 Asfalt alejek parkingu w173531008 urywa się na parapetach rampy P−1 i wchodzi pod domek klatki
- Status: naprawione (PR #382, 8.11; kurator ODSTĘPSTWO CELOWE T-241; parking i alejki w177513189, w173567309 wyłączone z importu (`REPLACED_WAYS`), plac T0 z kostki w obrysie, wjazd asfaltem tylko między ścianami rampy; `cut-on-road` 3 → 0, pada bez poprawki)
- Ważność: S4 · Zasięg: wykop rampy przecina oś alejki w177513189 na 17,6 m, szyb klatki na 2,2 m, domek klatki stoi na jej zakręcie (zostaje ok. 2,8 m przejazdu); T0 ma nawierzchnię z OSM, choć plan 2026 przewiduje plac i zielony dach; proponowana kontrola `cut-on-road` (baza dziś 3); T-237, T-238
- Pakiet właściciela: tools/osm-import

### G-495 `models.spec` czasem mierzy klatkę bez aktywnych siatek
- Status: naprawione (PR #387, 8.11; po `freeze` `step` nie rysuje klatki, spec czytał klatkę z rozruchu 326/0; `sampleNow` w `e2e/helpers.ts`, asercja aktywnych siatek > 0, scena `models` 465/158 w `tools/perf-budgets.json`; stary pomiar 5/5 pustych klatek, nowy 4/4 stabilnie 448/152)
- Ważność: S4 · Zasięg: na main w dwóch z trzech przebiegów pomiar 324/0 (wywołania / aktywne siatki); pomiar niestabilny, bramka może przepuścić regresję; przy okazji: NPC „doker” w dokach bez wpisu w obsadzie, akcesoria sztywne (fartuch jak deska, dłonie siedzących sprzedawców przez niego); potwierdzone w 4 przebiegach przy load 10–12 (budowniczy i weryfikator #376): koszt wariantów i fartucha nie jest mierzony lokalnie
- Pakiet właściciela: e2e (QA)

### G-488 Waga puli modeli niebędąca liczbą daje zawsze ostatni plik
- Status: naprawione (PR #388, 8.11; `weightOf` w `model-cast.ts`: waga spoza skończonych liczb jak 1, ujemna jak 0; parser manifestu odrzuca wpisy puli z wagą nie będącą skończoną liczbą ≥ 0; dwa testy padają bez poprawki)
- Ważność: S4 · Zasięg: `pickFromPool` w `model-cast.ts`: `weight` = `"abc"` daje NaN i wybór ostatniego pliku puli, także z wagą ujemną; `parseModelManifest` nie sprawdza typu ani znaku `weight`; przy okazji: próg `< 50` MiB w `model-textures.test.ts` nie odróżnia stanu przed i po, a `loadToonModel` nie ma wywołań w kodzie
- Pakiet właściciela: packages/engine (renderer)

### G-503 Generator mebli nie stawia latarni na pomostach (T-239)
- Status: naprawione (PR #383, 7.11; kurator ZGODNE; latarnia linii planu nad przęsłem staje na pomoście 0,3 m od krawędzi (`sideSpot`/`byParapet`), stopa z `deckHeightAt`; 3 pastorały Zamkowej i 3 `lamp-road` Mełgiewskiej na pomoście; `lamp-beside-deck` 6 → 0, pada bez poprawki; reszta G-507)
- Ważność: S4 · Zasięg: linia `lamps.zamkowa` przy wiadukcie w232362907 i pomoście grobli, przy okazji Mełgiewska
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-497 Pastorał grobli przy wiadukcie w232362907 stoi na trawie (T-235)
- Status: naprawione (PR #381, 7.11; kurator ZGODNE; krawędź mierzona z kostki pomostu (`deckAt`, `deckHeightAt`, próg `DECK_DROP` 2,5 m), latarnia (757,6; 175,0) → (756,8; 175,7), 0,35 m od kostki; `lamp-off-band` 1 → 0; test pada bez poprawki; reszta w G-503)
- Ważność: S4 · Zasięg: 1 `lamp-pastoral`
- Pakiet właściciela: tools/osm-import (props)

### G-489 Scena `s7_poet` stoi wewnątrz bryły budynku
- Status: naprawione (PR #378, 7.11; scena z (102, −23) w kamienicy w67498725 na (97, −23), płyta placu Litewskiego, 1,6 m od ściany; kontrola `buildingsAt` w `wave2-encounters.test.ts` (pryzmaty budynków, wysokość od gruntu w punkcie) dla 15 scen, pada ze starym punktem; brak testu dojścia pieszo do poety)
- Ważność: S4 · Zasięg: miejsce sceny `s7_poet` (102, −23) w `encounters.ts` leży w pryzmacie budynku (chunk `krakowskie-1-1`, bryła 318); ruch nie wypycha z głębi pryzmatu (graczka postawiona w (102, −13) dalej w nim stoi); test sceny ulicznej teleportuje graczkę do wnętrza; poprawka: przesunąć scenę na chodnik
- Pakiet właściciela: packages/sim (treść)

### G-469 Brak testu unieważniania koszyków `TerrainEntries` przy `set`/`delete`/`clear`
- Status: naprawione (PR #379, 7.11; sam test `terrain-index.test.ts`, 5 przypadków odczytu przed i po `set`, `delete`, `clear`; mutacja usuwająca czyszczenie koszyków łamie 5/5, 2/5 i 1/5; błędu w kodzie nie znaleziono)
- Ważność: S4 (test) · Zasięg: mutacja usuwająca unieważnienie koszyków po pierwszym odczycie przechodzi wszystkie testy; gotowa sonda weryfikatora w scratchpadzie sesji `v-g444-stale.test.ts` do przeniesienia do `packages/engine/test`
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-477 Latarnie z planu mebli stoją poza pasem deptaka (T-232, T-233)
- Status: naprawione (PR #374, 7.11, dwie rundy; latarnia z linii planu na wyłożonej osi deptaka staje 0,3 m za zmierzoną krawędzią kostki, najwyżej w odstępie FALLBACK; nowa kontrola `lamp-off-band` z tolerancją 1 m: 16 → 1 (przed tolerancją 210 → 188); 24 latarnie przesunięte, żadna nie zniknęła; test i skan padają bez poprawki; build deterministyczny; runda 2: test reputacji G-281 zależał od przypadkowej długości pasa tłumu, scena testu wybiera teraz parę mieszkańców; reszta przy wiadukcie w232362907 w G-497)
- Ważność: S4 · Zasięg: grobla Zamkowej (pastorały na trawie Błoni), Karmelicka (2 `lamp-road` w ogrodzie), przy okazji 17 pastorałów deptaka Krakowskiego Przedmieścia bliżej kostki
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-494 Kurosawa wisi nad ziemią
- Status: nie odtwarza się (7.11, naprawiacz; Kurosawa w `KUROSAWA_SPOT` (418; 29,4) na parkingu stoi na gruncie: y = `groundY` = −2,0375, renderer podnosi stopy o 0,1 na drodze (ADR-0045); ucięta głowa to kadr speca zrzutów liczony od y z sim bez podniesienia nawierzchni; uwaga do kadrowania zrzutów, nie glitch gry)
- Ważność: S4 · Zasięg: postać stoi na y −2,04 wyżej niż grunt, także na main; na zrzutach z etapu 2 ucina jej głowę
- Pakiet właściciela: packages/sim (treść) albo packages/engine (renderer), do ustalenia

### G-485 `pushOut` kończy się odepchnięciem od ciał bez ponownego sprawdzenia brył
- Status: naprawione (PR #377, 7.11; `pushOut` w każdej iteracji najpierw ciała, potem bryły, a odepchnięcie od ciała przecinające lico bryły jest odrzucane (`crossesSolid`); test `push-out-bodies-solids.test.ts` 127 przypadków, bez poprawki pada 102; `SINK` w `carry-drop-solid.test.ts` 1 mm; hashe G-208 przepisane świadomie, wnikanie posiłków w bryły ponad 1 mm 116/106 → 0/0 kroków; posiłki w tłumie przy ścianie nakładają się do 1,7 cm, zamierzenie)
- Ważność: S3 · Zasięg: `movement-system.ts`, `ITERATIONS = 2`: ostatni krok to odepchnięcie od innych ciał, bez kolizji z bryłami; postać nachodząca na leżące ciało (zerowa prędkość, nie jest wypychane) przy ścianie zostaje w ścianie, przy cienkiej ścianie przechodzi przez nią; niezależne od G-479; po G-479 runda 2 graczka wchodząca w leżące ciało przy ścianie wnika w nią do 3,5 cm (próg `SINK` 5 cm w `carry-drop-solid.test.ts` do zaostrzenia po naprawie); skutek: graczka stojąca środkiem w cienkiej ścianie (6 cm) odkłada ciało po drugiej stronie, bo bryła ze środkiem graczki nie blokuje odłożenia (G-479); przy okazji: `m1.test.ts` „save/load with deaths and spawns” przekracza limit przy load ok. 22 (146 s), osobno przechodzi (nie podnosić limitu)
- Pakiet właściciela: packages/sim

### G-479 Odłożone ciało może trafić środkiem w bryłę (kontener) i w niej zostać
- Status: naprawione (PR #373, 7.11, dwie rundy; `dropSpot` w `carry-system.ts` sprawdza 8 miejsc w odległości promień graczki + promień ciała (przód, skosy, boki, tył), bez miejsca ciało zostaje na ramieniu z podpowiedzią `prompt.body.no-room`; test `carry-drop-solid.test.ts` 19 przypadków, na kodzie sprzed G-479 pada 22 z sondami; próg `SINK` 5 cm do zaostrzenia po G-485)
- Ważność: S3 · Zasięg: `dropBody` w sim stawia ciało 0,6 m przed graczem bez sprawdzania brył; przy kontenerze (391,2..392,8 × −33,6..−32,4) środek ciała wszedł w bryłę i po 30 krokach wypychanie go nie wyciągnęło; sonda renderera (G-458) patrzy wtedy od środka bryły; poprawka w sim: miejsce odłożenia poza bryłami (cofnięcie do gracza albo bok), test w sim; do połączenia z ADR-0075 etap 4 (`settle-body`)
- Pakiet właściciela: packages/sim

### G-459 Bohaterka niesie ciało z wyciągniętym pistoletem
- Status: naprawione (PR #371, 7.11, ADR-0075 etap 2; `handsBusy` w rigu: broń w kaburze w chwycie i przy niesieniu, kamera chowa viewmodel w FPP; testy `grab-pose` i `camera-grab` padają bez zmiany)
- Ważność: S3 · Zasięg: sim blokuje broń przy niesieniu (ADR-0065), ale renderer dalej rysuje pistolet w dłoni
- Pakiet właściciela: packages/engine (renderer)

### G-458 Leżące ciało rysowane na 1,7 m, a kolizja to małe koło: głowa w ścianie
- Status: naprawione (PR #371, 7.11, ADR-0075 etap 2; `body-lay.ts` sprawdza ściany i meble ulicy (`BabylonRenderer.wallRay` przez `connectWorldRays`) i obraca albo odsuwa ciało do 0,5 m; testy `body-lay`, `wall-probe`, `world-rays` padają bez zmiany)
- Ważność: S4 · Zasięg: ciało odłożone albo osuwające się twarzą do ściany wchodzi w nią (głowa w witrynie; poza leżenia sięga 0,8–0,9 m od punktu symulacji w kierunku yaw); poprawka: odłożenie z kierunkiem od ściany albo kolizja leżącego ciała
- Pakiet właściciela: packages/sim (bodies), packages/engine

### G-457 Zwłoki na podniesionym terenie skaczą na y≈0
- Status: naprawione (PR #370, 7.11; `startDeath` zapamiętuje wysokość korzenia (teren z sim + podniesienie chodnika) w `rig.deathGround`, `animateDeath` liczy od niej; testy `characters.test.ts` i `character-deaths.test.ts` padają bez poprawki; przypadek śmierci w locie i na drabinie w G-481)
- Ważność: S3 · Zasięg: `animateDeath` ustawia `root.position.y = 0.12 − sink` w układzie świata, więc ciało na terenie NMT wyżej niż 0 spada pod teren albo wisi; do połączenia z ragdollem
- Pakiet właściciela: packages/engine (renderer)

### G-466 Karta dzielnicy na telefonie zasłania przycisk „Użyj”; po zmianie języka zostaje po angielsku
- Status: naprawione (PR #365, 7.11; karta dzielnicy na telefonie poza „Use” i skokiem, odświeża język; runda 2: w rozmowie węższa kolumna toastów `toasts--talk`, nie wchodzi pod napisy; testy komponentu padają bez poprawki; dialogue-fit, touch-layout, hud-layout 20/20)
- Ważność: S4 · Zasięg: 667×375 przy przyjeździe na Krakowskie Przedmieście karta zasłania „Użyj”, na 800×370 podobnie pierwsza linia podpowiedzi ruchu; karta pokazana przed zmianą języka nie przechodzi na pl
- Pakiet właściciela: packages/ui (HUD)

### G-428 Deptaki bez `width` buforowane na 8 m zachodzą na trawniki (T-199)
- Status: naprawione (PR #366, 7.11; szerokości z ortofoto PZGiK w `corrections-deptaki.ts`: Karmelicka 5 m, grobla 6,5 m, aleja Placu Litewskiego 6 m, ścieżki 1,5/1 m, podwórze w470555118 jako bruk; kostka na trawnikach 68/79/23 → 0/23/2 m², `grass-under-paving` 5 → 0; test pada bez poprawki, build deterministyczny)
- Ważność: S4 · Zasięg: Karmelicka, Szambelańska, Zamkowa ×2; poprawka: `TAG_CORRECTIONS` `width` z ortofoto; trawnik w470555118 na brukowanym podwórzu
- Pakiet właściciela: tools/osm-import

### G-474 Fixer (Kaito) rysuje się jako czarna postać
- Status: naprawione (PR #368, 7.11; `kaito.vrm` niesie COLOR_0 z samych zer, toon shader mnożył albedo przez kolor wierzchołków; loader zdejmuje COLOR_0 z siatek VRM, glTF bez zmian; test `model-cast-colours.test.ts` na każdym pliku manifestu; jasność postaci na zrzucie 6,9 → 40,3)
- Ważność: S2 · Zasięg: model `kaito.vrm` (Sakurada Fumiriya, `manifest.json` rola `fixer`) widoczny w grze jako czarna sylwetka; do zbadania: materiał MToon/tekstury po zmniejszeniu (`tools/shrink_glb.py`), światło NPR, alfa; postać kluczowa dla wątku
- Pakiet właściciela: packages/engine (renderer: modele postaci), packages/app/public/models

### G-450 Goły pas przy fasadach Peowiaków na rogach Kościuszki i przy w67508886 (T-221, T-224)
- Status: naprawione (PR #364, 7.11; 5 obszarów kostki T-221/* i T-224 od fasad do osi chodników, 431 + 998 + 52 → 0 gołych próbek 0,25 m; skan bez zmian, kontrola `facade-footway-bare` przeniesiona do G-470)
- Ważność: S4 · Zasięg: ok. 70 m pierzei Peowiaków i 3 m² przy w67508886; poprawka jak T-210 i T-211 (`ADDED_AREAS` od fasad do osi chodników, obszar na dom); test: zero gołych próbek 0,25 m; przy okazji kontrola `facade-footway-bare`
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-396 Ruina `ruins=yes` rysowana jak cały budynek (T-188)
- Status: naprawione (PR #357, 7.11; w66286396 odbudowany jako Arkady; inne ruiny w G-462)
- Ważność: S4 · Zasięg: 1 budynek (w66286396, skrytka Hebi) · Koszt: średni; test przyjęcia: budynek z `ruins=yes` nie ma okien ani dachu, a jego wysokość ≤ poziom × 3 m; pokrewne G-053
- Pakiet właściciela: tools/osm-import

### G-460 Dołek do 1,0–1,3 m przy północno-wschodnim końcu Arkad (T-218)
- Status: naprawione (PR #357, 7.11; chodnik do a 44, podest 2,2 m na zachód; `pad-dip-uncovered` 33 → 0)
- Ważność: S4 · Zasięg: a 40–43, x 463–465, z 118–121, ok. 12 m², poza płytami chodnika; test: na wschód od ściany poza płytami `rawHeight − groundY ≤ 0,3`; kontrola `pad-dip-uncovered`
- Pakiet właściciela: packages/sim (content Alchemii), tools/glitch-scan

### G-461 Arkady: 12 równych przęseł zamiast 14 z ortofoto (T-218)
- Status: naprawione (PR #357, 7.11; 13 filarów co do 0,00 m z ortofoto; `arcade-rhythm` 0)
- Ważność: S4 · Zasięg: filary z ortofoto w a = 2,95 / 6,25 / 9,9 / 13,6 / 17,2 / 20,8 / 24,55 / 28,25 / 31,75 / 35,4 / 39,1 / 42,95 / 46,4 m; kontrola `arcade-rhythm`
- Pakiet właściciela: packages/sim, packages/engine (Alchemia)

### G-444 `map-city.test.ts` z małym zapasem do 5 s: koszt docinania i drapowania podłoża
- Status: naprawione (PR #363, 7.11; CPU głównego wątku −35/−39%, czas testu ok. 5,2 → 3,4 s przy load 11–18; geometria identyczna bit w bit, test `map-ground-golden`)
- Ważność: S4 (test) · Zasięg: „builds the whole generated Lublin” zużywa ok. 3,8–4,2 s CPU wobec limitu 5000 ms, więc przy load ok. 15 na 4 rdzeniach przekracza limit na każdym commicie; ok. 60% profilu to `ground-cut.ts` (`cutCovers`, `minusTriangle`), `ground-plan.ts` (drapowanie, `planSurface`) i `heightAt` w `map-entries.ts`; profil w scratchpadzie sesji `g444-new.cpuprofile`; bez podnoszenia limitu
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-465 Krótkie kliknięcie lub stuknięcie ataku gubi strzał (brak krawędzi `fire` w klatce)
- Status: naprawione (PR #359, 7.11; `fire` w klatce to trzymanie albo krawędź naciśnięcia w `virtual-pad.ts` i `keymap.ts`; krótkie kliknięcie oddaje jeden strzał, trzymanie bez zmian)
- Ważność: S3 · Zasięg: `fire` w klatce to stan trzymania (`virtual-pad.ts` `poll()`, `keymap.ts:143`); naciśnięcie i puszczenie między dwoma odczytami wejścia nie oddaje strzału ani nie wybiera „Zabij” w chwycie; przy 15–20 kl./s na telefonie dotyczy stuknięć krótszych niż 50–66 ms
- Pakiet właściciela: packages/engine (input), packages/app (kontrolery)

### G-449 Ogłuszona postać stoi: renderer nie zna stanu `unconscious`
- Status: naprawione (PR #356, 7.11; pozy osunięcia, leżenia, przebudzenia, niesienia przez ramię i odłożenia w rendererze; `knockout-carry.ts` poza `CharacterViews`)
- Ważność: S2 · Zasięg: każdy nokaut (takedown bez zabicia): `render-sync.ts:79` wysyła `unconscious: true`, ale `packages/engine` nigdzie go nie czyta, więc postać zostaje w pozie stojącej; da się ją tylko nieść. Do sprawdzenia przy okazji: poza niesionego ciała i ciała odłożonego po niesieniu
- Pakiet właściciela: packages/engine (renderer: character-animation, character-poses)

### G-447 Zabójczy takedown widziany przez jednego przechodnia nigdy nie jest zgłaszany jako zabójstwo
- Status: naprawione (PR #355, 7.11; `bodyReported` oznacza martwe ciało tylko przy zgłoszeniu zabójstwa, `knockOutCallsOver` usunięte; nokaut przy przechodniu i zwłoki znalezione w trakcie telefonu: −2 zamiast −3 zgodnie z zasadą jednego czynu z ADR-0070)
- Ważność: S3 · Zasięg: świadek dzwoni tylko o napaść, a będąc już w trakcie połączenia pomija zabójstwo; połączenie o napaści oznacza zwłoki jako zgłoszone, bo zabójczy takedown oznacza ciało jak nokaut (ADR-0065, etap 3); potwierdzone sondą weryfikatora #350: `takedown-system.ts:182` woła `noteViolence(..., target.id)`, `civilianWitness` pomija dzwoniącego, `callThrough` → `bodyReported` oznacza martwe ciało; propozycja: strażnik w `bodyReported`/`callThrough`, żeby zgłoszenie napaści nie oznaczało martwego ciała (może zastąpić `knockOutCallsOver`)
- Pakiet właściciela: packages/sim (bodies, crime-system)

### G-433 Na telefonie karta skanu zasłania pasek broni i podpowiedź ruchu
- Status: naprawione (PR #353, 7.11; hacki w siatce 2×2, karta 264×183 px, kółko drążka schowane przy skanerze; zero nachodzeń przy 844×390, 800×370, 667×375)
- Ważność: S3 · Zasięg: 844×390 i 800×370, karta skanu (Kiroshi) nachodzi na pasek broni i podpowiedź ruchu; do kontroli w `touch-layout`
- Pakiet właściciela: packages/ui (HUD, skan)

### G-440 Goły pas 1–1,5 m wzdłuż fasad ul. Kościuszki (T-211)
- Status: naprawione (PR #352, 7.11; 7 obszarów kostki T-211/* od fasad do osi chodników, 927 + 698 → 0 gołych próbek; landuse-bare bez zmian, bo nie liczy zwykłych domów)
- Ważność: S4 · Zasięg: x ok. 8–21, z −127…−182 i wschodnia strona ulicy, ok. 1200 punktów `landuse-bare`; poprawka jak T-210/T-164 (`ADDED_AREAS` kostki do ścian)
- Pakiet właściciela: tools/osm-import

### G-334 Zabójstwo ogłuszonego gangera po nokaucie zgłoszonym wcześniej nigdy nie jest zgłaszane jako zabójstwo
- Status: naprawione (PR #350, 7.11; zwłoki ogłuszonego nie dziedziczą zgłoszenia nokautu, `wronged` czyta `downed.fought`)
- Ważność: S3 · Zasięg: `corpseOf` przenosi na zwłoki `reported` z nokautu (`bodies.ts:75`), więc patrol, który znajdzie świeże ciało, go nie zgłasza; po wczytaniu dobicie ogłuszonego na oczach patrolu też nie jest przestępstwem, bo `wronged` jest przejściowe, a `offend` w `death-system.ts:72` nie czyta `downed.fought`
- Pakiet właściciela: packages/sim (bodies, death-system, crime-system)

### G-434 Pad T1 Alchemii podnosi Świętoduską o ok. 1,85 m (T-209)
- Status: naprawione (PR #343, runda 3, 7.11; T1 trzy pady, ulica ±0,15 m od NMT; kontrola `pad-on-road` 13 → 8)
- Ważność: S3 · Zasięg: jezdnia w230503896, chodnik w232464426, pas postojowy w1514058885 przy x 393–402, z 56–84; poprawka: przyciąć T1, przejście od ulicy ≤ 2 m; kontrola `pad-on-road`
- Pakiet właściciela: packages/sim (content Alchemii), tools/glitch-scan

### G-423 Pomniki przyrody bez swojego gatunku (dęby i topola „Baobab” jako lipy i klony)
- Status: naprawione (PR #348, 7.11; `tree-species-ignored` 4 → 0, dęby i topola z własnymi modelami)
- Ważność: S4 · Zasięg: 3 drzewa na Placu Litewskim; poprawka: `species`/`genus` z OSM (Quercus, Populus), model dębu; kontrola `tree-species-ignored`
- Pakiet właściciela: tools/osm-import, packages/engine (assety)

### G-436 Pas gołego terenu 1–2 m przed Sądem Okręgowym na Placu Czechowicza (T-210)
- Status: naprawione (PR #349, 7.11; `landuse-bare` 108 863 → 108 592)
- Ważność: S4 · Zasięg: x 2–22, z −104,7…−122, ok. 280 punktów `landuse-bare`; poprawka: domknąć nawierzchnię do ściany w69672563 (baza spadnie o ok. 280)
- Pakiet właściciela: tools/osm-import

### G-427 Plac Czechowicza i plac zabaw na Litewskim pod kostką (T-197, T-198)
- Status: naprawione (PR #347, 7.11; `grass-under-paving` 7 → 5; plac zabaw z T-198 był błędną diagnozą, resztka w G-428)
- Ważność: S3 · Zasięg: trawnik `village_green` 308 m² z pomnikiem wychodzi poza obrysy obu placów, więc `openPavings` go nie wycina; plac zabaw 22 m² styka się z trawnikiem; poprawka: odejmowanie wielokątów albo `place=square` bez nawierzchni
- Pakiet właściciela: tools/osm-import (ground)

### G-422 Drzewa o ok. 1/3 za niskie i z wąskimi koronami (Plac Litewski)
- Status: naprawione (PR #345, 6.11; mediana błędu wysokości 4,91 → 0,03 m, `tree-height-vs-nmpt` 47 → 6)
- Ważność: S3 · Zasięg: w grze 6,7–12,2 m, w NMPT mediana 12,7 m, 43 drzewa ponad 15 m; poprawka: skala z NMPT (szczyt w promieniu 3 m minus teren) albo z tagu `height`, zakres skali ok. 0,7–2,2; test: mediana błędu ≤ 2 m; kontrola `tree-height-vs-nmpt`
- Pakiet właściciela: tools/osm-import (props), packages/engine

### G-421 Trawniki pod kostką placów: multipoligon placu bez wyciętych pierścieni `inner` (Plac Litewski i 70 innych kawałków)
- Status: naprawione (PR #344, 6.11; zgłoszenie użytkownika; Plac Litewski 1,75 → 8 012 m² trawy, `grass-under-paving` 68 → 7)
- Ważność: S2 · Zasięg: 71 kawałków trawy, 13 425 m² w mieście, w tym ok. 9 700 m² w Krakowskim (Plac Litewski r7690183 ma w grze 0,01% trawy wobec 31% w rzeczywistości), obrzeża drzew na deptaku, część Placu Krąpca, Nabrzeże (2343; 161) · Koszt: mały; poprawka w `tools/osm-import` (`features.ts`: wyciąć `inner` z nawierzchni) albo w `ground.ts` (odjąć `grass` od `square`/`cobble`); NIE podnosić `SURFACE_LIFT.grass` (wspólne z symulacją, G-130); test: trawa widoczna na placu ≥ 9 000 m², kontrola `grass-under-paving` z bazą zbijaną do 0
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)

### G-410 Ramki rzadkości w torbie i slotach ekwipunku niewidoczne (kolejność reguł CSS)
- Status: naprawione (PR #342, 6.11; sloty z ramką rzadkości, zaznaczenie białym pierścieniem)
- Ważność: S3 (weryfikator #334: ramki niewidoczne od E4 4c23a7f; rzadkość tylko tekstem) · Zasięg: w `styles.css` reguły `.inv__cell` i `.inv__slot` stoją za `.rarity--*` i nadpisują kolor ramki; od #334 komórki z ikoną mają kolor w stylu, komórki tekstowe (mody, wszczepy) i sloty ubrań nadal nie; zaznaczenie (magenta) wygląda jak kolor rzadkiego
- Pakiet właściciela: packages/ui (inventory)

### G-383 Gołe podłoże na wschód od stanowisk Dworca, x 870–915 (T-185)
- Status: naprawione (PR #339, 6.11)
- Ważność: S4 · Zasięg: ok. 630 m² · Koszt: mały (najpierw ortofoto x 870–920)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: ≤ 0,5 m² gołego poza rabatą

### G-382 Gołe podłoże przy wiacie przystanku w672635871 (T-184)
- Status: naprawione (PR #339, 6.11)
- Ważność: S4 · Zasięg: ok. 98 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: gołe próbki 0,1 m w klinie ≤ 0,5 m²

### G-409 Kontrole skanu glitchy blisko limitu 20 s w CI z pokryciem
- Status: naprawione (PR #336, 6.11; sześć kontroli 2–70× szybciej, raport skanu identyczny bajt w bajt)
- Ważność: S3 (CI) · Zasięg: pod obciążeniem z `VITEST_COVERAGE_SHARD=1`: building-in-set-piece 21,2 s, cable-low 29,7 s (ponad limit), market-piece-on-crowd-lane 15,2 s, lamp-style-change-on-way 13,8 s, paving-overlap-step 6–8 s; na runnerze CI grożą jak `paving-coplanar` w #328; poprawka: przyspieszyć kontrole (pomiar, indeksy), nie podnosić limitu
- Pakiet właściciela: tools/glitch-scan

### G-381 Strzelec staje w promieniu `ARRIVE` od stanowiska, a linia wzroku liczy się z samego węzła: stanowisko bywa bez strzału
- Status: naprawione w #316 (gałąź `held` w `firingPosition`: strzelec dochodzi do węzła, gdy z pozycji nie ma strzału); potwierdzone sondami 6.11 (metro, stary targ, doki), nie odtwarza się na 245a455
- Ważność: S3 · Zasięg: `firingPosition` i `firstStep` w `packages/sim/src/world/nav.ts`; strzelec czeka z zerową prędkością bez końca · Koszt: średni
- Pakiet właściciela: packages/sim (`world/nav.ts`, AI strzelca)
- Test przyjęcia: strzelec dochodzi do gracza albo strzela we wszystkich przypadkach siatki z #316

### G-377 Promień z ulicy do szybu metra trafia w niewidzialny teren pod pawilonem
- Status: naprawione (PR #335, 6.11; skan `metro-shaft-ray` 948 → 0)
- Ważność: S3 · Zasięg: `GroundField.rayHit` maszeruje teren chunka ulicy w obszarze szybu do najbliższej linii siatki, więc trafia w dawną powierzchnię ulicy pod pawilonem; strzelec 0,5 m przed otworem Alchemii B nie widzi gracza w hali i przez 20 s nie strzela; prawdopodobnie też strzały gracza z zewnątrz do hali · Koszt: średni
- Pakiet właściciela: packages/sim (`world/ground.ts`, raycast)
- Test przyjęcia: linia wzroku i strzał z ulicy przed otworem do gracza w hali przechodzą (i odwrotnie)

### G-320 Nakładające się nawierzchnie `square` i `cobble` leżą w jednej płaszczyźnie: migotanie głębi (z-fighting) bruku i płyt w całym mieście
- Status: naprawione (PR #328, 6.11; zgłoszenie gracza z nagraniem; skan `paving-coplanar` 1560 → 0)
- Ważność: S3 (było S4) · Zasięg: 69 par różnych nawierzchni z tym samym `SURFACE_LIFT` 0,08; dwa nakładające się `square` z różnym wzorem spoin dają słabe kropkowane linie (zrzut `shots/g301/after/g301-c.png`); trwale: rysować jeden kawałek z pary (przycięcie nakładek w imporcie)
- Pakiet właściciela: tools/osm-import i packages/engine (mapcity/ground-plan)

### G-401 Napad z mikrozdarzenia otwiera pusty panel rozmowy i odbiera sterowanie
- Status: naprawione (PR #332, 6.11)
- Ważność: S3 · Zasięg: mikrozdarzenie napadu wysyła `EncounterStarted` z pustym knotem `""`; app (`packages/app/src/controllers/compose.ts`, `onEncounter`) otwiera pusty, zakończony panel rozmowy, który blokuje sterowanie, dopóki gracz go nie zamknie
- Pakiet właściciela: packages/app (controllers), packages/sim (micro-events)

### G-400 E2E w CI: przy trafieniu cache `.deb` apt i tak pobiera czcionki z mirrora (15 min)
- Status: naprawione (PR #330, 6.11; setup e2e 887 s → 21 s)
- Ważność: S3 (CI) · Zasięg: przebieg 42237620499 (#327): cache `playwright-debs` trafiony, ale `apt-get install ~/playwright-debs/*.deb` pobrał te same 9 paczek (21,9 MB) z mirrora Azure w 15 min, shard 1 przekroczył 25 min; regresja po G-387 (#319); poprawka: `dpkg -i` na lokalnych plikach
- Pakiet właściciela: .github (Infra)

### G-391 `Ground.rayHit` poza chunkami: promień 2 km małymi krokami, `chunkIndex` liniowo po wszystkich chunkach
- Status: naprawione (PR #325, 6.11)
- Ważność: S3 (wydajność gry i CI) · Zasięg: `packages/sim/src/world/ground.ts:341` (`rayHit`) i ok. l. 164 (`chunkIndex`); pościg strażników przypiętych daleko woła co krok `lineOfSight`; pierwsze kroki do 110 ms, dalej ok. 25 ms; przyczyna G-357, G-390 i wolnych `save-load-away-guards` · Koszt: średni
- Pakiet właściciela: packages/sim (`world/ground.ts`)
- Test przyjęcia: wyniki `rayHit` identyczne (test z wersją referencyjną), złote hashe bez zmian, czasy wymienionych testów wyraźnie niższe

### G-372 Podciąganie (`ledgeAhead`) sprawdza tylko punkt docelowy: na cienką barierkę da się wejść wzdłuż jej linii i chodzić po wierzchu
- Status: naprawione (PR #321, 6.11; resztka na czubku dachu podzamcze 591 jako G-393)
- Ważność: S3 · Zasięg: prawdopodobnie barierki w całym mieście; przy windzie Alchemii wymusiło barierki 2,6 m zamiast 1,1 m · Koszt: średni
- Pakiet właściciela: packages/sim (`movement-system`)
- Test przyjęcia: podciągnięcie na bryłę węższą niż ciało albo na krawędź barierki jest odrzucane; barierka 1,1 m nie daje się przejść

### G-390 `save-load-contract-ended.test.ts` przekracza 20 s w CI (przypięci daleko strażnicy)
- Status: naprawione (PR #324, 6.11)
- Ważność: S3 (zatrzymuje CI losowych PR-ów) · Zasięg: „saved away from the docks, the guards of the alarm wait at the office in both games”; ten sam wzorzec co G-357 (krokowanie z przypiętymi daleko strażnikami ok. 10× droższe) · Koszt: mały
- Pakiet właściciela: packages/sim (test)
- Test przyjęcia: najdłuższy przypadek pliku lokalnie ≤ 1,5 s, asercje bez zmian

### G-345 Gołe podłoże wokół stanowisk Dworca Autobusowego (x 808–870)
- Status: naprawione w #318 (6.11, 0fc0023; `T-170/*`, trawnik przed pawilonami jako `flowerbed`)
- Ważność: S4 · Zasięg: ok. 1000 m² w x 808–870, z 366–395 (pas między ścieżką w227698420, chodnikiem w227698409 i stanowiskami, z gruntem pod zadaszeniem w458862470); też pas na północ od kiosku w73833929 (z 434–442, x 780–816) · Topografia: T-170 (kurator: pod zadaszeniem ok. 453 m², przed pawilonami ok. 535 m², na północ od kiosku ok. 160 m²)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`), przegląd kuratora

### G-347 Gołe podłoże wzdłuż parkingu w227698441 przy ul. Nowy Plac Targowy (T-172)
- Status: naprawione w #318 (6.11, 0fc0023; `T-172/pas-parkingu` asfalt, latarnia przed autami, `T-172/chodnik-przy-hali`)
- Ważność: S4 · Zasięg: x 672–726, z 436–448, ok. 100 m² (pas 1,2–1,9 m od jezdni w40050943, klin przy chodniku w227698428, szczelina ok. 5 m² przy (725,4; 437)) · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`; pas (a) asfalt jak jezdnia albo parking, nie kostka; klin (b) kostka chodnika)
- Test przyjęcia: gołe próbki 0,1 m poza budynkami w x 672–727, z 434–449 ≤ 0,5 m² (szwy); parking w227698441, chodnik i jezdnia na wierzchu

### G-350 Gołe podłoże przy al. Tysiąclecia na wschód od Dworca (T-173)
- Status: naprawione w #318 (6.11, 0fc0023; `T-173/chodnik-tysiaclecia-wschod`)
- Ważność: S4 · Zasięg: x 806–872, z ok. 343–360, ok. 470 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: gołe próbki 0,5 m w obszarze ≤ 0,5 m² (szwy)

### G-352 Chodnik przy wschodniej ścianie Bazaru za wąski (T-175)
- Status: naprawione w #318 (6.11, 0fc0023; `T-175/chodnik-przy-bazarze`)
- Ważność: S4 · Zasięg: x 716–721, z 389–413, ok. 30–35 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: kostka od ściany hal ok. 5 m, gołe próbki 0

### G-368 AI nie ściga gracza w metrze (hala, zejście, peron, wejścia A i B)
- Status: naprawione w #316 (6.11, 58f3036; graf poziomów przez wejścia metra, `shaftAt` w `heightApart`, `attach()` z wysokością biegu, strzelec wchodzi na węzeł bez strzału z miejsca postoju; siatka 264 pościgów: 176 → 4 bez wyniku)
- Ważność: S3 · Zasięg: ganger zaalarmowany z ulicy, z hali albo z peronu nie dochodzi do gracza w żadnym z 14 sprawdzonych przypadków · Koszt: średni
- Pakiet właściciela: packages/sim (`systems/ai`, nawigacja przez schody i sklepienia)
- Test przyjęcia: pościg z ulicy do hali i z hali na peron dochodzi do gracza w rozsądnym czasie

### G-371 Hala w otwartym wykopie i ulica wychodzą w `heightApart` 1,0 m od siebie, poniżej `LEVEL_GAP`
- Status: naprawione w #316 (6.11, 58f3036; razem z G-368)
- Ważność: S4 · Zasięg: AI (sniper, steering, ganger-walk) może brać halę i ulicę za jedno piętro · Koszt: mały
- Pakiet właściciela: packages/sim (`world/ground.ts`)

### G-387 Shard e2e (1) na granicy `timeout-minutes: 25`: przygotowanie ok. 11 min, testy 13,6 min
- Status: naprawione w #319 (6.11, 354a1cd; cache przeglądarek Playwright i `.deb` czcionek; do potwierdzenia przy drugim przebiegu: „.deb cache hit: true”)
- Ważność: S2 (blokuje scalanie PR-ów z kodem) · Zasięg: `.github/workflows/ci.yml`, job e2e; instalacja, build i pobranie przeglądarek przed testami (10:40 → 10:51), potem 21 testów jednym workerem · Koszt: średni. Przyczyna z logu #317: `pnpm exec playwright install --with-deps chromium` pobiera przez apt 9 pakietów czcionek (fonts-ipafont-gothic, fonts-wqy-zenhei, fonts-unifont, xfonts-*; 22 MB) z lustra azure.archive.ubuntu.com, tym razem 31 kB/s → 10 min 59 s; biblioteki Chromium są już na runnerze. Propozycja: cache `.deb` czcionek albo `~/.cache/ms-playwright` (`actions/cache`, klucz z wersji Playwright) i `install-deps` tylko dla brakujących pakietów; migawka NPR może zależeć od czcionek, więc nie wyrzucać ich bez sprawdzenia
- Pakiet właściciela: Infra/Build (`.github`), QA (`e2e`)
- Poprawka bez podnoszenia limitu (ADR-0046): skrócić przygotowanie (cache przeglądarek Playwright i builda, build raz i artefakt dla shardów) albo trzeci shard
- Test przyjęcia: oba shardy e2e kończą się z zapasem ≥ 5 min na obecnym main

### G-289 Z dachu Alchemii nie ma bezpiecznego zejścia
- Status: naprawione w #312 (6.11, b65bd52; winda Alchemii na dach z mostkiem i tarasem, bramki do nadproża, podświetlone przyciski; weryfikator i kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: zeskok z 11–13 m kosztuje 48–96 HP; dziś dach nieosiągalny
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-373 Odcinek tunelu peronu metra `kanal` A wchodzi 0,4 m w narożnik kamienicy w67498758 (T-181)
- Status: naprawione w #314 (6.11; `w0` −10 → −9,5, test peronu sprawdza `vaults` co 0,25 m)
- Ważność: S4 (niewidoczne) · Zasięg: 0,81 m² podziemia pod obrysem; test `metro-platform.test.ts` sprawdza tylko `rooms`, nie `vaults` · Koszt: mały (np. `w0` −10 → −9,5 albo krótszy odcinek po tej stronie)
- Pakiet właściciela: packages/sim (`content/metro.ts`), tools/glitch-scan (kontrola `metro-vault-in-building`)
- Test przyjęcia: każdy `vault` każdego peronu ma 0 próbek (co 0,25 m) w `inBuilding`; test rozszerzony na `vaults` pada przed poprawką

### G-376 Job CI „Typecheck, lint, architecture, unit tests” przekracza `timeout-minutes: 20`: same testy z pokryciem trwają 18,6 min
- Status: naprawione w #315 (6.11, 63f2bbd; dwie części testów z raportami blob, progi na scalonym pokryciu; części 5 i 11 min, scalanie z typecheckiem 1,5 min)
- Ważność: S2 (blokuje scalanie każdego PR-a z kodem) · Zasięg: `.github/workflows/ci.yml`, job unit (l. 45), `pnpm test:coverage` 1116 s (testy 57%, import 41%; 452 workery, vitest sugeruje `isolate: false`, ok. 31 s mniej) · Koszt: średni
- Pakiet właściciela: Infra/Build (`.github`, konfiguracja vitest w root), QA (najwolniejsze testy)
- Poprawka bez podnoszenia limitu (CLAUDE.md, ADR-0046): podział przebiegu na części (sharding) albo przyspieszenie (izolacja, najwolniejsze pliki, import ciężkich modułów). Pokrycie łączone z części
- Test przyjęcia: job unit kończy się z zapasem ≥ 5 min na obecnym main; progi pokrycia bez zmian

### G-366 Odmowa zmiany rozdania (respec) przy przekroczonej puli wszczepów nie mówi, że trzeba wyjąć wszczep
- Status: naprawione w #313 (6.11, cd6c93e; respec ponad pulą przechodzi, inne odmowy mówią, co zrobić)
- Ważność: S4 (UI/tekst) · Zasięg: toast „Your body won't take any more…”, przycisk Przebudowy aktywny mimo odmowy · Koszt: mały
- Pakiet właściciela: packages/ui, packages/app (`ShopController`), i18n en/pl

### G-088 Zamkowa zapada się o 3,5 m nad tunelem pieszym przed Zamkiem
- Status: naprawione w #306 (6.11, eb33598; pomost Zamkowej nad tunelem w66258159 z `tunnel-decks.ts`, `road-dip-over-tunnel` 1 → 0; AI: pomost z prześwitem > 2 m jest sufitem, gdy prosta NPC→cel przechodzi pod nim; kurator PRZYJĘTE, kształt: T-178)
- Ważność: S3 (proponowana; dojście do Zamku, obejście 6 m od osi) · Zasięg: lokalny · Koszt: średni
- Gdzie: (781.2, 198.8), Zamkowa w154962966 nad w66258159; T-053
- Dowód: GroundField wzdłuż osi: −12,5 → −15,6 → −12,8 m; steepAt prawda na pasie od −8 do +5 m od osi
- Przyczyna (przypuszczalna): NMT bez konstrukcji nad tunelem; ulica bez pomostu (jak BRIDGE_DECKS), a tunel pomija `underground()`
- Pakiet właściciela: tools/osm-import / packages/sim (pomosty)
- Test przyjęcia: kontrola `road-dip-over-tunnel` 1 → 0 (droga z OSM przecina tunel bez wspólnego węzła, a grunt w ±8 m od przecięcia leży > 1 m pod cięciwą; w mieście 34 przecięcia, następne 0,35 m); pod pomostem przejście w66258159 drożne (G-062)

### G-343 Uciekający cywil przełącza się co krok między dwoma kierunkami przy ścianie (ziarna 3 i 7)
- Status: naprawione w #310 (6.11, c9b13d1; trzymana droga po kursie objazdu, próg zawrotu 5π/6, sonda ciała na `STEP_HEIGHT + 0.05`; skoki w przeglądzie 144 przypadków 1414 → 212; złote hashe zmienione świadomie). Resztki: G-369
- Ważność: S4 · Zasięg: ziarno 7, 1002001, gracz 2 m, ok. (309; −99,5): ściana tuż przy końcu sondy 2,5 m, a objazd „na wprost” prowadzi z powrotem obok gracza (242 skoki); ziarno 3, 1002001/1002003, gracz 1 m, ok. (326; −29): `fleeStep` biegnie na zablokowany punkt 6 m dalej (`steerPoint` oddaje cel, objazd pusty), na zmianę z objazdem przy +π/2 (183/186 skoków). Dopisek 6.11 (weryfikacja #305): także warianty z G-328 w zaułku (ok. 309,5; −97,7): ziarno 43, 1002008, gracz (3; 0): 431 skoków, 1,18 m od gracza; ziarno 11 i 7, 1002001, gracz (2; 0): 352 i 417 skoków; ziarna 3 i 29, 1002002, gracz (0; −2): 380 i 129 skoków. Ślad `fleeTurn`: co krok 0 ↔ −π/4, `null` nie pada. Test przyjęcia: w każdym z tych przypadków po 4 s cywil stoi albo ucieka bez przeskoków co krok
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `fleeStep`, `bendsBack`)

### G-359 Odmowa wrogiej kliniki: „Ammo and basics, nothing more.”, choć Mori nie sprzedaje amunicji
- Status: naprawione w #307 (6.11, d8352bc; klucz `shop.failure.refusedClinic` en/pl)
- Ważność: S4 (tekst) · Zasięg: komunikat odmowy wspólny dla sklepów; klinika potrzebuje własnego wariantu (en i pl) · Koszt: mały
- Pakiet właściciela: packages/ui (i18n `trade`), packages/core (klucz odmowy per sklep)

### G-331 Deszcz pada pod dachem pawilonu metra i w hali biletowej
- Status: naprawione w #303 (6.11, fd4e7be; deszcz i rozbryzgi kończą się pod dachem pawilonu i w hali)
- Ważność: S4 · Zasięg: wszystkie wejścia metra (widać na zrzutach schodów `shots/metro2/`); do etapu 3 ADR-0071 albo osobno
- Pakiet właściciela: packages/engine/src/effects (deszcz)

### G-333 Drobne usterki po etapie 2 metra (#279)
- Status: naprawione w #303 (6.11, fd4e7be; granitowy stopień przed otworem Alchemii B, próg 0,32 → 0,23 m; reszta drobiazgów z #279 w #284)
- Ważność: S4 · Zasięg: kontrola `metro-shaft-open` (`tools/glitch-scan/test/metro-entrances.ts:131-135`) krucha na zaokrąglenie przy próbce na krawędzi (`z <= w.maxZ`), potrzebny epsilon; `cutGround` (`engine/.../ground-cut.ts:94-95`) liczy każdy trójkąt każdej siatki gruntu (106 ms CPU na 20 chunków), wystarczy wcześniej pominąć siatki bez otworu; Alchemia B: przy rogu otworu bruk 0,32 m pod progiem podestu; Nabrzeże A: okap 0,4 m w murze placu Tessen (T-160); niesprawdzone: wróg w pościgu schodzący za graczem do hali
- Pakiet właściciela: tools/glitch-scan, packages/engine (mapcity), packages/sim

### G-337 Północny chodnik al. Tysiąclecia bez nawierzchni (T-165)
- Status: naprawione w #298 (6.11, d0b3a6b; `T-165/chodnik-tysiaclecia` i `T-165/okap-bazaru`, kurator PRZYJĘTE po drugiej rundzie)
- Ważność: S4 · Zasięg: x ok. 640–790, z ok. 362–383, ok. 670 m² na samym x 705–790; przed halami Bazaru rabaty (nie brukować); także x 764–806 przed frontem Dworca (T-165 pkt 1–2): ok. 136 m² między drogą rowerową w1435832523 a ścieżką w227698420 (x 773–803 rabata, nie brukować) i ok. 50 m² między chodnikiem w1435832518 a drogą rowerową (kostka z wiatami)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m w obszarze T-165 poza rabatami; propozycja kontroli `paving-sliver` dla całego miasta

### G-357 `pinned-far-sleep.test.ts` przekracza 20 s pod coverage w CI
- Status: naprawione w #302 (6.11, cf1e8fe; podział na przypadki ze wspólnym przebiegiem, najdłuższy pod coverage 9,2 → 2,9 s). Poboczne: krokowanie z przypiętym daleko strażnikiem ok. 10× droższe, do zbadania
- Ważność: S4 (narzędzia testowe) · Zasięg: „a calm guard whose chunk sleeps stays while he stands in a loaded one…” lokalnie ok. 3 s, plik ok. 30 s także na main; w CI pod coverage 20 s. Wzorzec jak #276 i #295: podzielić test albo zapamiętać wspólny przebieg, limitu nie podnosić
- Pakiet właściciela: packages/sim (test)
- Test przyjęcia: najdłuższy test pliku lokalnie ≤ 1,5 s

### G-349 Próg 0,3–0,4 m na zachodnim przyczółku mostu południowego Mełgiewskiej po G-340
- Status: naprawione w #300 (6.11, 5820de7; teren przyczółków na wysokości pomostu, kontrola `deck-abutment-step` 21 → 12; weryfikator i kurator PRZYJĘTE; reszta progów w G-360)
- Ważność: S3 · Zasięg: pomost w50733068 przedłużony przez `bridge-ends.ts` jest poziomy na NMT końca osi (−25,72), a teren wzdłuż 13-metrowej krawędzi przyczółka opada na południe do −26,0…−26,14; na próbkach 0,5 m to skarpa (`MAX_WALK_SLOPE`, ADR-0043): postać idąca z Andersa na wschód 4,75–6,0 m na południe od osi staje w (2414,2–2414,7; 323,3–324,4); pas aut Andersa#126:0 schodzi z pomostu bokiem ze skokiem 0,17 m. Skan nie ma kontroli progu pomost–teren na przyczółkach; `bridge-ends.test.ts` nie pilnuje warunku węzła wspólnego (przypadek ze wspólnym węzłem bliżej niż 15 m od krawędzi)
- Pakiet właściciela: tools/osm-import (`bridge-ends.ts`), packages/sim (terrain/decks), tools/glitch-scan
- Test przyjęcia: postać przechodzi z Andersa na most na całej szerokości jezdni; kontrola progu pomost–teren na przyczółkach (> 0,25 m) = 0

### G-340 Szczelina 1–2 m między jezdnią a chodnikiem obu mostów Mełgiewskiej (T-167)
- Status: naprawione w #293 (5.11, b7bc879; `bridge-fill.ts` wypełnia obrys mostu, `bridge-ends.ts` przedłuża koniec drogi mostowej do krawędzi obrysu; `deck-slot` i `deck-step-face` 0; próg przy przyczółku w G-349)
- Ważność: S2 (spadek 2,5–5 m z mostu) · Zasięg: 2 mosty Nabrzeża, trasa aut · Koszt: mały–średni
- Gdzie: x 2407–2446, z 243–269 oraz x 2423–2457, z 310–324; ok. 148 m²
- Przyczyna (przypuszczalna): pomosty z szerokości jezdni i chodnika z osobnych dróg OSM, bez wypełnienia obrysem mostu (`man_made=bridge` w1123148473/474)
- Pakiet właściciela: tools/osm-import (pomosty z obrysu `man_made=bridge`)
- Test przyjęcia: kontrola `deck-slot` (punkt poza pomostami z pomostem po obu stronach do 2 m i ziemią ≥ 0,5 m niżej) = 0 poza wnęką T-147

### G-344 Most południowy Mełgiewskiej (w50733068): z jezdni na chodnik postać spada 2,6–4,5 m pod pomost (stopień do 2,05 m)
- Status: naprawione w #293 razem z G-340 (5.11, b7bc879; jezdnia i chodnik mostu południowego w jednym poziomie, 0,09–0,17 m)
- Ważność: S2 · Zasięg: jezdnia opada wzdłuż mostu o ok. 2,2 m, pomost chodnika prawie poziomy; z jezdni na chodnik nie da się wejść, po G-340 w rysowaniu stoi tam szara ściana; w Lublinie oba na jednym poziomie. Docelowo wspólny pomost dla obu dróg mostu (por. G-339, T-166) (T-171). Przyczyna: zachodni węzeł w50733068 ok. 8 m przed przyczółkiem, wysokość z NMT na skarpie. Test przyjęcia: kontrola `deck-step-face` (krawędź pomostu z innym pomostem 0,3 m dalej niższym o > 0,3 m, próbki co 0,5 m) = 0 poza T-147
- Pakiet właściciela: tools/osm-import (pomosty mostów), packages/sim (content/lublin decks)

### G-342 Zaplecze Novy bez nawierzchni (T-169)
- Status: naprawione w #296 (5.11, 31f56ed; `T-169/zaplecze-novy`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: x 726–756, z 428–441, ok. 270 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`; nawierzchnia utwardzona, nie trawa)
- Test przyjęcia: 0 gołych próbek 0,5 m poza budynkami w prostokącie; parking w227698438 i jezdnia w40050943 na wierzchu

### G-341 Gołe pasy wokół Dworca Autobusowego od północy i wschodu (T-168)
- Status: naprawione w #294 (5.11, a5b773f; `T-168/peron-przy-dworcu` i `T-168/chodnik-przy-dworcu`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: x 785–797, z 422–430 (ok. 42 m²) i x 793–808, z 376–428 (ok. 325 m²) · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m poza budynkami w obu prostokątach; asfalt stanowisk w66323033 i chodniki zostają na wierzchu

### G-338 Uciekający cywil stoi w miejscu, a kierunek przeskakuje 0 ↔ −π/2
- Status: naprawione w #292 (5.11, c49ab71; `bodyWalk`, sonda ucieczki z szerokością ciała; ziarna 3 i 7 w G-343)
- Ważność: S4 · Zasięg: ziarno 17, przechodzień 1002008, pościg 4 m/s do 2 m, ok. (248,2; −65): sonda 2,5 m pokazuje wolną drogę, a ruch jest zablokowany (242 skoki); także ziarno 3, 1002001/1002003, gracz 1 m, ok. (326,5; −29), 183–186 skoków; ziarno 7, 1002001, gracz 2 m
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system)

### G-336 Pasy gołego podłoża przy Dworcu Autobusowym (T-164)
- Status: naprawione w #291 (5.11, 5f49f0c; `T-164/plac-przy-dworcu` i `T-164/chodnik-novy`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: pas między parkingiem w175995587 a chodnikiem w227698423 (ok. 70 m²), plac między chodnikiem a ścianą Dworca w66264171 (ok. 250 m²), pas przy ścianie Novy (ok. 105 m²)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m w prostokątach T-164 poza rabatami

### G-330 Pozostałości farby przy pomostach po #275
- Status: naprawione w #290 (5.11, fd3f7ce; linie na końcach mostu na powierzchni, bieg 3 w56965515 na pomoście, `paint-under-deck` z trójkątami na obrysie)
- Ważność: S4 · Zasięg: przy (2446; 245,8) linia krawędzi przechodzi przez obrys pomostu (3 trójkąty, uskok 0,51 m na 0,38 m, niewidoczne); schody przy (732–735; 151–161) przy moście Zamkowej wchodzą pod pomost do 2,54 m pod jezdnią (tak samo na main; `paint-under-deck` pomija trójkąty przecinające obrys, być może celowo)
- Pakiet właściciela: packages/engine (mapcity), tools/glitch-scan

### G-310 Dłonie nie trafiają w szczeble: faza rąk 3,4 rad/m (cykl na 1,85 m) przy szczeblach co 0,3 m
- Status: naprawione w #289 (5.11, 2b87fc7; dłonie trzymają szczeble, faza z wysokości, `CLIMB_SPEED` 1,5 m/s)
- Ważność: S3 · Zasięg: ręce zostają za ciałem i ślizgają się; faza niezwiązana z wysokością; przy 2,2 m/s pełne tempo dałoby ok. 3,7 cyklu/s, więc trzeba zmienić tempo albo prędkość wspinania
- Pakiet właściciela: packages/engine/src/renderer (pozy postaci)

### G-326 Uciekający cywil drga przy objeździe: `steerPoint` przełącza się między drogą prosto a objazdem
- Status: naprawione w #286 (5.11, 9899e16; histereza objazdu `fleeStep`; róg w pościgu zostaje w G-328)
- Ważność: S3 · Zasięg: ziarno 17, −60, przechodzień 1002005, gracz 2 m (25 skoków kąta ok. 0,42 rad) i 1 m (42); `straightWalk` do punktu 6 m przed cywilem raz jest wolny, raz nie; także: w rogu (316; −95) `steerPoint` zawraca „prosto od gracza” niemal wprost na gracza (−1,25 rad), na main przy zatrzymaniu gracza ≥ 2 m ok. 465 skoków; drganie ±0,5 rad w miejscu przy stałym wyborze kierunku (ziarno 23, ok. (262; −81))
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `steerPoint`)

### G-332 Plac przed Dworcem Autobusowym bez nawierzchni: wyjście pawilonu metra na gołe podłoże
- Status: naprawione w #285 (5.11, 662209b; `ADDED_AREAS` `T-162/plac-dworca`, obrys kuratora 428,8 m², testy wycofania i węzłów)
- Ważność: S4 · Zasięg: Podzamcze, x ok. 740–764, z ok. 370–377 (ok. 170 m²), wyjście `targ` B (T-162, T-159)
- Pakiet właściciela: packages/sim (treść `lublin`, ręczna nawierzchnia) albo tools/osm-import

### G-318 Zejście chodem z zachodniego dachu przy `targ-escape-2` przelatuje nad balkonem: upadek 9,1 m na posadzkę targu
- Status: naprawione w #288 (5.11, 375456d; balkon `BALCONY_DEPTH` 3,4 m, zejście chodem ląduje na balkonie)
- Ważność: S3 · Zasięg: `targ-escape-2`, balkon z 64–65,3; przy 4,1 m/s graczka mija balkon i ląduje na posadzce targu; do oceny, czy balkon ma łapać, czy krawędź ma być dalej
- Pakiet właściciela: packages/sim (treść targu, ruch)

### G-335 Zapis w locie gubi prędkość: wczytanie zmienia tor lotu
- Status: naprawione w #287 (5.11, 296ab1d; autozapis czeka na podłogę, ręczny zapis w powietrzu z komunikatem; bez zmiany schematu)
- Ważność: S4 · Zasięg: zapis nie trzyma `fall`, `velocity`, `airPeak`, a `compose.ts:169` nie blokuje zapisu w powietrzu, więc każdy zapis w locie wczytuje się z zerową prędkością; do decyzji: blokować zapis w powietrzu (autozapis „w bezpiecznej chwili”) czy zapisywać stan lotu (zmiana schematu)
- Pakiet właściciela: packages/app (compose, autozapis) albo packages/sim i persistence

### G-313 Wczytanie zapisu z paska dachu przy drabinie stawia graczkę na szczycie drabiny
- Status: naprawione w #281 (5.11, d0d30d7; miejsce po podłodze pod graczką, zasięg `TOP_CATCH_REACH` 0,7 m)
- Ważność: S4 · Zasięg: pasek ok. 0,2 × 0,1 m przy krawędzi nad drabiną (t < 0,5 odcinka linia–wyjście, np. `targ-escape-2` (69,2; 9,1; 63,85–64,05)); bez upadku i straty zdrowia. Teoretycznie z ciałem na ramieniu (ADR-0065) system drabin ją pominie i spadnie. Przesunięcie `resumeOnLadderTop` sięga 0,61 m (`targ-escape-1`), a stały test obejmuje tylko `targ-escape-2`
- Pakiet właściciela: packages/sim (`ladder-system.ts`, `resumeOnLadderTop`)

### G-317 Ucieczka cywila pod ścianą drga: kąt skacze o ±0,8 rad co klatkę
- Status: naprawione w #277 (5.11, 11ca247; histereza `fleeTurn` z `bendsBack`, ściana 23 → 3 skoki, pościg jak na main)
- Ważność: S3 · Zasięg: ucieczka przy ścianie; ziarno 3, −60, przechodzień 1002004, gracz w 2 m: ok. 0,4 s, 24 skoki, bo przełącza się kierunek sondy wolnej drogi
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `runFrom`)

### G-327 Testy „zapis bez ukrytego stanu” na przechodniach z tłumu nic nie dowodzą
- Status: naprawione w #280 (5.11, ae546c8; testy wczytania porównują pola przechodnia; test `flee-wall` z #277 nie ma testu wczytania)
- Ważność: S3 (test) · Zasięg: przechodnie z tłumu (bez `key`) nie są w zapisie ani w `stateHash`, więc hash po wczytaniu zgadza się przy dowolnym ukrytym stanie; przejrzeć testy wczytania w `flee-dead-zone`, `flee-wall`, `reputation-tiers` i podobne; porównywać `yaw` i pozycję konkretnego cywila albo używać cywila z `key`
- Pakiet właściciela: packages/sim (testy)

### G-325 Każda `GameSession` w testach kompiluje ink od nowa (ok. 150 ms)
- Status: naprawione w #282 (5.11, fceb8ae; `loadInk`, kompilacja ink raz na źródło)
- Ważność: S4 (czas testów) · Zasięg: prawie każdy test app; pamięć podręczna skompilowanej historii (`compileInk`) przyspieszyłaby cały zestaw
- Pakiet właściciela: packages/narrative

### G-307 Kioski metra stoją przy zabytkach: Plac Litewski 3,8 m od upamiętnienia Andrzeja Struga, Brama Krakowska 10,8 m od Bramy w murach i 2,1 m od tablicy Ludomira Michała Rogowskiego
- Status: naprawione w #279 (5.11, d5c2440; kioski zastąpione pawilonami ponad 80 m od tablic i 25 m od Bramy, T-154)
- Ważność: S3 · Zasięg: dwie stacje metra; zasłaniają zabytek i stoją w murach Starego Miasta (ADR-0042)
- Pakiet właściciela: packages/sim (treść `lublin`, stacje metra), przegląd `topography-curator`

### G-301 Nakładające się kawałki bruku mają różne drapowania (stopnie 1–3 cm, migotanie głębi)
- Status: naprawione w #275 (5.11, cda5b7a; wspólna siatka drapowania 2,5 m, `drapeY` na powierzchni `surfaceAt`; kontrole `paving-overlap-step`, `paint-under-deck`, `paint-lifted-by-deck` z bazą 0; przy okazji znikają linie wiszące do 20 m nad terenem przy (1055; 162))
- Ważność: S4 · Zasięg: np. dwa `square`; jaśniejsze i ciemniejsze łaty o prostych krawędziach; drzazga 8 cm przy (435,3; −94,6)
- Pakiet właściciela: packages/engine (mapcity/ground-plan)

### G-323 Test `reputation-toasts` na granicy limitu CI: 6,5 s pojedynczo, ok. 20 s pod obciążeniem
- Status: naprawione w #276 (5.11, af5e862; chód 20 s, dokładnie 1 toast; pod pokryciem 6,5–7,0 s)
- Ważność: S3 (test; czerwony CI kosztuje cykl) · Zasięg: `packages/app/test/reputation-toasts.test.ts` „gets one toast…”; także `save-crowd-calm` 10,4 s pod obciążeniem. Przyczyna do ustalenia pomiarem, bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: packages/app (testy)

### G-308 Zejście z dachu na drabinę tylko klawiszem: wejście za krawędź przy drabinie kończy się upadkiem
- Status: naprawione w #273 (5.11, 3e7ca0c; `caughtAtTop` przy zejściu tempem chodu, nigdy w locie po dashu)
- Ważność: S3 · Zasięg: `targ-escape-2` i `targ-escape-3`; upadek z 3,6–4,6 m bez obrażeń, drabina nie łapie
- Pakiet właściciela: packages/sim (ruch, drabiny)

### G-314 Linia metra na mapie przechodzi pod Starym cmentarzem żydowskim
- Status: naprawione w #270 (5.11, 02c7c6d; przebieg al. Tysiąclecia – Kalinowszczyzna – most Lutosławskiego, kontrola `metro-line-protected`)
- Ważność: S3 · Zasięg: lokalny, odcinek `METRO_TUNNEL` (1120; 310) → (1700; 380), ok. 75 m pod w40049437 · Koszt: mały
- Pakiet właściciela: packages/sim (`content/metro.ts`)
- Test przyjęcia: każdy punkt `METRO_TUNNEL` co 5 m poza `PROTECTED_AREAS` i obrysami `historic`/`heritage`/`place_of_worship`; przebieg al. Tysiąclecia – Kalinowszczyzna – most Lutosławskiego (ADR-0071, przegląd kuratora)

### G-315 Możliwe stacje Ogród Saski i Lublin Główny w złym miejscu
- Status: naprawione w #270 (5.11, 02c7c6d; Ogród Saski (−630; −84), Lublin Główny (590; −1840))
- Ważność: S4 · Zasięg: mapa metra · Koszt: mały
- Pakiet właściciela: packages/sim (`content/metro.ts`)
- Test przyjęcia: Ogród Saski (−630; −84) poza obrysem parku i ≤ 30 m od Alej Racławickich; Lublin Główny (590; −1840) ≤ 80 m od w171203532; odgałęzienie z Placu Łokietka ulicami Kozią i Bernardyńską, poza obrysami zabytków

### G-305 Oyaji przy nieufności ma otwarty sklep, ale trzyma się 7 m od gracza (interakcja z 3 m)
- Status: naprawione w #267 (5.11, 8de6c8f; ADR-0070 etap 2, stali mieszkańcy nie odsuwają się z powodu reputacji)
- Ważność: S3 · Zasięg: reputacja −11..−49; w praktyce sklep zamknięty przed progiem odmowy
- Pakiet właściciela: packages/sim (civilian-ai-system)

### G-286 Scalony toast „×N” znika 4,5 s od pierwszego zdarzenia, nie od ostatniego
- Status: naprawione w #265 (5.11, 975fdb2; `expireToast` liczy żywe wpisy, `sameToast` porównuje `keep`)
- Ważność: S4 · Zasięg: każdy scalany toast; identyczne powiadomienie po 4,4 s widać ułamek sekundy; `sameToast` pomija flagę `keep` (dziś teoretyczne)
- Pakiet właściciela: packages/ui (store, toasty)

### G-304 Przy wrogiej postawie Hana kończy rozmowę przed sprawdzeniem kursu od Kaito
- Status: naprawione w #263 (5.11, f3c496d; dostawa od Kaito sprawdzana przed odmową)
- Ważność: S3 · Zasięg: `m4-targ.ink`, knot `hana`; paczki nie da się oddać, kurs przepada z karą −4 u fixerów
- Pakiet właściciela: packages/narrative

### G-306 Blokada kursora zostaje na canvasie po otwarciu menu klawiszem I zaraz po starcie
- Status: naprawione w #264 (5.11, 902d7a5; `wantsLock` i zwalnianie spóźnionej blokady)
- Ważność: S3 · Zasięg: desktop; zgoda na blokadę przychodzi po naciśnięciu I, `releasePointerLock` nic nie robi, bo flaga `locked` jest jeszcze fałszywa; kliknięcia w ekwipunek trafiają w canvas
- Pakiet właściciela: packages/engine/src/input (browser-input) i packages/app (pointer-focus)

### G-293 Plama reflektora niskiego patrolu ma ciemny środek: widać tylko jasny pierścień, miejscami przerwany
- Status: naprawione w #260 (5.11, fbfac59; plama na rysowanym bruku, `drapeHeightAt`)
- Ważność: S3 (proponowana; każdy zawis każdego patrolu, plama ma być jednolitym kręgiem światła) · Zasięg: wszystkie patrole na `high` i `medium` przy zawisie 4,6–7,7 m nad brukiem · Koszt: do ustalenia
- Gdzie: deptak (127,1; −55,0), oko (136; −54) 9,5 m od drona; to samo na zrzutach z drugiego miejsca (`r4-plama-a-*`)
- Dowód: zrzuty `/tmp/claude-0/-home-user-SpinalTap/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/shots/drony-niskie/r4-plama-b-4.7m.png` (pierścień z ciemnym wnętrzem i wcięciem po prawej), `r4-plama-a-6.0m.png`, kolaże `r4-plama-a-kolaz.png` i `r4-plama-b-kolaz.png` (ciemny środek na każdej wysokości 4,7–7,7 m). Jasny pas jest węższy niż zewnętrzna połowa promienia, a wnętrze ma kolor bruku albo ciemniejszy
- Przyczyna (przypuszczalna): nie widać wewnętrznego wachlarza plamy (`withBeam` w `packages/engine/src/renderer/drones/patrol-models.ts`: 32 trójkąty od środka do pierścienia 0,5 z jednym narożnikiem zdublowanym) albo części pasa. Nawinięcie obu części jest zgodne (`GeometrySink.quad` układa je według normalnej UP), cienia drona nie ma (ADR-0058). Do sprawdzenia: głębia lub kolejność rysowania wnętrza względem bruku (`layPool`, `pavingAt`, `POOL_LIFT` 0,02 m), przebieg G-bufora i obrysu w miejscu plamy oraz zostawianie plamy po `POOL_RELAY` przy zmianie slotu
- Pakiet właściciela: packages/engine (renderer/drones, npr)
- Test przyjęcia: zrzut FPP z tego samego oka i czasu (`r4-plama-b-4.7m.json`, t 127,12) pokazuje jednolity jasny krąg bez ciemnego środka i wcięć na wysokościach 4,7–7,7 m; test bez renderera: po `placePool` każdy niezdegenerowany trójkąt plamy leży nad brukiem (y ≥ bruk + `POOL_LIFT` − 1 mm) i ma normalną skierowaną w górę; migawka NPR i budżety bez zmian

### G-299 Wejście frontowe hali Alchemii na cokole 1,23 m bez stopni
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S4 · Zasięg: front zasłonięty bryłą (G-298); model nie rysuje stopni
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-298 Korpus kolizji hali Alchemii wystaje poza ściany modelu
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S3 · Zasięg: z przodu z 5,2–6,1 ok. 0,9 m niewidzialnej ściany nad cokołem, z tyłu z −6,1…−5,54 ok. 0,5 m; także na main
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-297 Niewidzialna ściana na krawędzi podestu hali Alchemii
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S3 · Zasięg: x 2,24: model rysuje podłogę balkonu 6,64 na zachód (x 1–2,2, z 2,5–4), a kolizja korpusu i skosu dachu (9,9 i 11,51 m) ją zasłania
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-288 Zewnętrzne schody hali Alchemii to pełny prostopadłościan do 7,35 m
- Status: naprawione w #257 (5.11, 3a5b56d; schody hali chodzone do podestu 6,64 m)
- Ważność: S4 · Zasięg: `HALL_PARTS[2]`: widać otwarte stopnie, nie da się wejść, pod biegiem niewidzialna ściana; żaden test nie pilnuje, że części hali nie wystają ponad dach
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-287 Drzwi i witryny stoisk Alchemii wiszą nad brukiem od Świętoduskiej
- Status: naprawione w #257 (5.11, 3a5b56d; stopnie z bruku do każdego stoiska)
- Ważność: S3 · Zasięg: podłoga 1,04–1,24 m nad brukiem przy środku frontu stoisk 2, 3, 5, w rogach do 1,88 m; brak stopni i ramp; `placeAlchemiaModule` stawia moduł na najwyższym punkcie rzutu
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-278 Wyszukiwanie pomostu na szwie chunków bierze tylko pierwszy chunk
- Status: naprawione w #256 (5.11, 2ec6e1f; pomosty sąsiadów sięgające granic chunka)
- Ważność: S4 · Zasięg: punkty dokładnie na granicy chunków (np. z = 160 przy wiadukcie Zamkowej): wyszukiwanie pomostu (`decksAt`/most) patrzy tylko w pomosty pierwszego chunka, więc w tych punktach bieg schodów wychodzi bez płyty wiaduktu nad nim · Koszt: mały
- Poprawka: na szwie brać pomosty obu chunków (albo indeks pomostów niezależny od chunka); test w punktach z = granica
- Pakiet właściciela: packages/sim (world/deck)

### G-294 Wróg z podejrzeniem obraca się do gracza, którego nie widzi
- Status: naprawione w #254 (5.11, d695c0e; podejrzliwy wróg obraca się tylko do widzianego gracza)
- Ważność: S3 · Zasięg: każdy niezaalarmowany wróg z podejrzeniem > 0 (`HoldPosition`, `ganger-ai-system.ts:135`, `faceTowards(this, this.seen.player)`); gracz 25 m w bok za ścianą: obrót 1,47 → 0 rad w 0,25 s; powinien patrzeć na ostatnie widziane miejsce
- Pakiet właściciela: packages/sim/src/systems/ai

### G-284 Winda nie działa albo jej nie ma
- Status: naprawione w #312 (6.11, b65bd52; winda Alchemii na dach z mostkiem i tarasem, bramki do nadproża, podświetlone przyciski; weryfikator i kurator PRZYJĘTE)
- Ważność: S3 · Zasięg: winda z treści (estakada, ADR windy z bramkami); do ustalenia, która i gdzie
- Pakiet właściciela: packages/sim i treść lublin; docelowo winda w Alchemii (backlog)

### G-283 Okno dialogowe od razu przewija się w dół i często się scrolluje
- Status: naprawione w #251 (5.11, 5ff20cc; napisy tylko bieżącego kroku w lewym dolnym rogu, historia za przyciskiem, HUD ukryty w rozmowie, strzałka przy przepełnieniu)
- Ważność: S3 · Zasięg: dialogi z NPC
- Pakiet właściciela: packages/ui

### G-282 Karabin Tessen w FPP ma model pistoletu
- Status: naprawione w #253 (5.11, 48c9546; FPP pokazuje model aktywnej broni z własną pozycją; własne modele rewolweru, strzelby i karabinu w pracy)
- Ważność: S3 · Zasięg: widok FPP z karabinem Tessen; możliwe także inne rodzaje broni bez własnego modelu
- Pakiet właściciela: packages/engine (renderer, broń) i assety

### G-274 Skraj wiaduktu Zamkowej nad biegiem w56965515 rysowany, ale bez podłogi: spadek 1,7 m przez bruk (po #233)
- Status: naprawione w #233 (4.11, cfd3a73, razem z G-255)
- Ważność: S2 (proponowana: gracz spada przez widoczną nawierzchnię na trasie Brama Grodzka–Zamek) · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: T-144; pas 1,5–2 m wzdłuż północno-zachodniej krawędzi pomostu w232362907 od (729,0; 157,0) do (733,5; 162,0), `stare-miasto-1-1` i `podzamcze-1-0`, ok. 10 m²; w mieście 1 miejsce
- Dowód: sonda `topo-cross` (przekroje w poprzek osi wiaduktu co 1 m od przyczółka): na 223dedc `groundY` spada z −13,57 na −15,31 między 2,0 a 2,5 m od osi, a `deckAt` obrysu wiaduktu (rysowanego) sięga 4,0 m; uskok 1,74 m (t = 2–5), 1,2 m (t = 6), 0,57 m (t = 7). Siatka 0,5 m: 40 punktów obrysu wiaduktu z gruntem niżej o ponad 0,25 m. Na main 8b8ee07 pomost do 4,0 m bez uskoku. Zrzut autora `shots/g255/tpp-z-dolu.png`: stopnie biegu 2 wchodzą pod płytę pomostu
- Przyczyna: `FLIGHT_DECKS` (`content/lublin/decks.ts`) kładzie pas biegu 3,8 m (`FLIGHT_HALF` 1,9) na osi z OSM, a ta leży ok. 3,9 m od osi wiaduktu, na krawędzi obrysu pomostu (pół szerokości 4 m); `beside` w `deckAt` oddaje bieg stopom w całej części wspólnej, a renderer (`Decks.heightAt`, `planSurface` kawałka mostu) rysuje płytę wiaduktu na całym obrysie i nie stawia fasady na tej krawędzi (sąsiedni pomost biegu)
- Poprawka: pas biegu przy moście przycięty do obrysu pomostu (bieg zaczyna się za krawędzią wiaduktu, jak we wnęce na ortofoto PZGiK) albo przesunięty na zewnątrz o część wspólną; `beside` tylko tam, gdzie pomost biegu jest nad gruntem poza obrysem mostu. Bez zmiany obrysu wiaduktu (zgodny z balustradą na ortofoto)
- Pakiet właściciela: packages/sim (content/lublin/decks.ts, world/deck.ts)
- Test przyjęcia: w obrysie każdego kawałka mostu `groundY` nie leży niżej niż pomost o więcej niż `STEP_HEIGHT` poza przejściami pod mostem (G-062); kontrola skanu `deck-drawn-over-flight` 40 → 0; testy G-255 (`flight-walk`, `flight-chase`) dalej zielone

### G-255 Garb w biegu schodów w56965515 przy pomoście wiaduktu Zamkowej: uskok 2,9 m i bieg pod prąd
- Status: naprawione w #233 (4.11, cfd3a73; 9 rund: wnęka w pomoście wiaduktu T-147, pomost biegu zgodny z rysunkiem, nawigacja NPC z maską krawędzi pomostu przy biegach; kurator: zgodne z uwagami)
- Ważność: S3 (proponowana: uskok 2,9 m w środku schodów, gracz spada albo AI się zatrzymuje) · Zasięg: 1 droga (3 kawałki pasa w dwóch chunkach), możliwe dalsze z kontroli `steps-riser-tall` · Koszt: mały do średniego
- Gdzie: T-131; w56965515 bieg węzeł 2 → 3 (734,1; 163,9) → (729,5; 159,9), Podzamcze/Stare Miasto, granica chunków z = 160
- Dowód: `planSteps` na `groundY` (sonda `topo-g236-flight.txt`, 5757fae): stopnie na pomoście y −13,48 do x ≈ 733,4, potem podstopnica 2,92 m na teren −16,41, dalej stopnie w górę do −15,28 przy węźle 3 (flight ma `incline=down`); kawałek tego biegu w `stare-miasto-1-1` (730,8; 159,6) leży płasko na pomoście −13,51 obok −15,4 za granicą chunka. Stan sprzed #219 identyczny
- Przyczyna: pas biegu 3 m idzie ok. 4 m od osi wiaduktu i częściowo leży w obrysie pomostu, więc `groundY` daje tam pomost (stopnie w kawałku pasa nad nim stoją na pomoście, reguła sufitu G-062 tego nie zmienia), a tuż za krawędzią pomostu interpolowany NMT spod wiaduktu (−16,4..−16,8), niższy od końca biegu
- Poprawka: bieg ze `incline` przy pomoście dostaje rampę od wysokości pomostu na węźle wiaduktu do terenu na końcu (jak `flightRamps`, ale z pomostem jako górą), a schody nie biorą pomostu z `groundY` poza węzłem na wiadukcie; razem z G-062
- Pakiet właściciela: packages/sim (content/lublin: shape, decks), packages/engine (steps-plan)
- Test przyjęcia: profil biegów w56965515 maleje od −13,5 do −17,1 bez podstopnicy ponad 0,3 m; kontrola `steps-riser-tall` (podstopnica `planSteps` na `groundY` > 0,5 m) baza 7 → co najwyżej 6

### G-275 W TPP przy celowaniu z bliska (zwłaszcza w kucaniu) postać zasłania cel
- Status: naprawione w #243 (4.11, 93568a1; FPP: ADS 4 cm niżej i bez podrzutu lufy, zasłonięcie 66–85% → 0%; TPP ramię 0,55 m, zmiana ramienia bez rozjazdu; zgłoszone przez użytkownika)
- Ważność: S3 (zgłoszenie gracza, podstawowa mechanika strzelania) · Zasięg: kamera TPP (`packages/engine/src/camera/camera-rig.ts`: `TPP_DISTANCE` 2,2 m, `TPP_SHOULDER_OFFSET` 0,55 m z `packages/sim/src/world/hitscan.ts`, `TPP_HEIGHT_OFFSET` 0, `TPP_ADS_PULL` 0,45; w kucaniu kamera tylko obniża się z `eyeHeightAt`), cel z przyłożenia i do kilku metrów · Koszt: średni
- Rozwiązania branżowe do połączenia: (1) przy celowaniu i w kucaniu większe przesunięcie przez ramię i lekko w górę (postać ucieka na bok kadru); (2) zmiana ramienia klawiszem/padem (akcja wejścia, i18n, opcje sterowania); (3) przezroczystość albo wzór kropek (dither, pasuje do NPR) postaci, gdy zasłania celownik lub kamera jest blisko; (4) strzał z promienia kamery z poprawką lufy, żeby trafienie było tam, gdzie celownik, przy dużych przesunięciach (hitscan w `sim` już liczy punkt startu z kucaniem: sprawdzić zgodność, bo stałe przesunięcia są w `sim`)
- Pakiet właściciela: packages/engine (camera, npr), packages/sim (hitscan: stałe przesunięć, jeśli się zmieniają; złote hashe), packages/engine/src/input (zmiana ramienia), packages/ui (opcje)
- Test przyjęcia: test kamery bez renderera: w kucaniu z celem 1–3 m przed postacią celownik nie leży w rzucie sylwetki postaci (albo postać jest w tym czasie wygaszona); test trafienia: punkt trafienia = punkt pod celownikiem przy obu ramionach; zrzuty przed/po (stanie, kucanie, cel z bliska, oba ramiona) dla użytkownika; budżety bez wzrostu

### G-280 Dash uruchamia ochronę Tessen (security) w siedzibie Tessen
- Status: naprawione w #249 (4.11, bff2d26; zryw w przebraniu z wagą 0,08 przez odnowienie, pojedynczy nie demaskuje, seria 5–8,5 s wobec sprintu 0,5–1,6 s; decyzja użytkownika, notka w ADR-0033)
- Ważność: S3 · Zasięg: użycie umiejętności Dash na terenie Tessen; prawdopodobnie ruch umiejętności liczony jako wtargnięcie albo atak
- Pakiet właściciela: packages/sim (systemy przestępstw i ochrony)

### G-281 Przy złej reputacji setki powiadomień bez przerwy
- Status: naprawione w #248 (4.11, afa615c; znacznik ucieczki resetowany dopiero 14 m od gracza, scalanie identycznych toastów „×N”, 30 s ciszy dla tej samej reakcji frakcji; 696 → 1 w teście sesji; zgłoszone przez użytkownika)
- Ważność: S2 (proponowana: zalewa ekran) · Zasięg: zła reputacja w mieście; każdy uciekający lub reagujący NPC zdaje się generować własne powiadomienie
- Poprawka: scalanie i limit powiadomień tego samego rodzaju; decyzja o samej panice w backlogu (reputacja)
- Pakiet właściciela: packages/ui (powiadomienia) i packages/sim (źródło zdarzeń)

### G-279 Kamera przechyla się w osi i obrót kręci całym obrazem zamiast postacią
- Status: naprawione w #246 (4.11, 45aad32; `updateUpVectorFromRotation`: wektor „góry” kamery z bieżącego obrotu w każdej klatce; zgłoszone przez użytkownika)
- Ważność: S2 (proponowana: utrata sterowania) · Zasięg: niejasny, „w pewnym momencie” gry; do odtworzenia (ślad, nagranie)
- Pakiet właściciela: packages/engine (camera)

### G-268 Kable przęseł nad ulicą wiszą za nisko, kilka pod ziemią
- Status: naprawione w #244 (2.11, b225f89; runda 2 @ ae0a0f2 PRZYJĘTE; przęsła < 3,45 m: 21 → 0, telefon 5 → 0; kontrola `cable-low` baza 0)
- Ważność: S4 (S3, jeśli kabel przecina przechodniów na wysokości głowy) · Zasięg: 11 przęseł niżej niż 2,5 m nad rysowaną nawierzchnią, m.in. x≈996, z≈568 (do −7,8 m, pod ziemią), x≈520, z≈171 (−2,6 m), x≈634, z≈124 (2,1 m) · Koszt: mały
- Przyczyna (do potwierdzenia): wysokość przęsła liczona od podstawy budynku na zboczu, nie od nawierzchni pod przęsłem
- Poprawka: najniższy punkt przęsła ≥ ok. 3,5 m nad nawierzchnią pod nim (albo przęsło pominięte); kontrola skanu `cable-low` (punkt przęsła < 2,5 m nad nawierzchnią) baza z main → 0
- Pakiet właściciela: packages/engine (renderer/mapcity, `spanCables`)
- Także: na zrzucie dolnej Grodzkiej (x≈615, z≈15) linia na wysokości ramion przechodnia, źródło nieustalone

- Potwierdzone (weryfikator #238): (996; 568) −7,78 m, (996; 569) −6,22, (995; 576) −5,60, (995; 568) −4,41, (520; 171) −2,65, (520; 172) −2,23, (635; 124) 2,12 m; linia na Grodzkiej (615; 15) to nie kabel przęsła (może kable słupów).
### G-270 Drzwi bez widocznych futryn
- Status: naprawione w #241 (2.11, c10b1ab; runda 2 @ d818ffb PRZYJĘTE; zgłoszone przez użytkownika)
- Ważność: S3 (zgłoszenie gracza, wszystkie drzwi miasta) · Zasięg: drzwi na fasadach (ADR-0058 etap 9): ościeżnica i nadproże `DOOR_FRAME` (`packages/engine/src/renderer/mapcity/prop-door.ts`: `side` 0,08 m, `lintel` 0,1 m, `depth` 0,2 m) w tym samym kolorze `FRAME_COLOR` #2a2e36 co ciemne skrzydła, więc z kilku metrów skrzydło i futryna to jedna płaszczyzna; drzwi gry (klinika, Neon Koi, ADR-0038) i wejście pokoju kapsułowego (#234) bez obramowania · Koszt: mały do średniego
- Poprawka: widoczna futryna i opaska: szersza ościeżnica (ok. 0,12–0,15 m) i nadproże, opaska wystająca kilka cm przed lico ściany, kolor kontrastujący ze skrzydłem i ścianą (np. jaśniejszy kamienny/tynkowy dla kamienic, metalowy dla sklepów, z palety kitu), próg; te same reguły dla drzwi gry i otworu pokoju kapsułowego; bez nowych wywołań rysowania (w siatce bloku mebli); drzwi nie mogą przez to wejść w szyby, szyldy ani przejazdy (kontrole `door-*` bez wzrostu)
- Pakiet właściciela: packages/engine (renderer/mapcity, rooms, wnętrza gry)
- Test przyjęcia: test engine: futryna szersza od progu i w kolorze różnym od skrzydła i ściany; zrzuty przed/po (kamienica, sklep, klinika, kapsuła) dla użytkownika; budżety i migawka (świadomie, jeśli drzwi w kadrze)

### G-263 Lampy wnętrz świecą przez ściany na ulicę
- Status: naprawione w #239 (2.11, PRZYJĘTE; prostokąt światła `clip` w shaderze toon, płynna moc 35–45 m; klinika i Neon Koi w G-269; próg drzwi nieoświetlony: drobna uwaga)
- Ważność: S4 · Zasięg: światła punktowe wnętrz (pokój kapsułowy `capsule-room-view.ts` `LAMP` 5,5 m, ok. 2,5 m za fasadą Jezuickiej 14; do sprawdzenia klinika i Neon Koi) · Koszt: mały do średniego
- Dowód: światła punktowe shadera toon nie mają przesłaniania, więc lampa wnętrza oświetla też bruk i fasadę przed budynkiem; przy 45–50 m od pokoju włącza się i wyłącza skokowo (wiązanie z siatką wnętrza)
- Poprawka: światło wnętrza tylko dla siatek wnętrza (`includedOnlyMeshes`) albo zasięg przycięty do pokoju; włączanie z płynnym wygaszaniem
- Pakiet właściciela: packages/engine (renderer, rooms)
- Test przyjęcia: zrzut nocą przed drzwiami z lampą i bez: różnica oświetlenia bruku poza progiem drzwi ≤ próg; test, że lampa nie ma w zasięgu siatek ulicy
- Także (weryfikator): pokój nie jest w `ROOM_SITES` (bez zwolnień w `crowd.test` i `neon-off-wall`; dziś bez skutku); niski element modelu wystaje 0,2 m poza bryłę kuchni
- Także (kurator, T-138): na bruku Jezuickiej plama sięga ok. 2,3 m przed fasadę, a Wieży Trynitarskiej (8,5 m) nie dosięga; poza tym topografia jest zgodna

### G-244 Budynki ceglane z OSM rysowane w tynku: `building:material` nie trafia do gry
- Status: naprawione w #237 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: cegła Baszty, Donżonu i Kaplicy; 19 kolorów ścian z OSM; miedziane hełmy w G-272)
- Ważność: S3 (proponowana: rozpoznawalne zabytki w złym materiale) · Zasięg: 4 budynki (6 elementów OSM z `building:material=brick`): Donżon w450180469, Baszta Gotycka w66286376, Kaplica Trójcy w66258167, Brama Krakowska r7224409 (części w617597406, w617597407) · Koszt: średni (pole w danych + paleta fasady)
- Gdzie: T-134; Podzamcze (893,1; 214,6), (941; 214,6), Stare Miasto (512,6; −143), Krakowskie (472,6; −91,2)
- Dowód: import nie przenosi `building:material` ani `building:colour` (tylko `roof:colour` w części dachów); kolor fasady z palety użycia. Po #209 Donżon i Baszta w jasnym tynku kościelnym (zrzut `g232-shots/g232-donzon-po.png`), przed #209 w szarofioletowym tynku `historic`. W rzeczywistości nietynkowana cegła (Brama Krakowska: cegła w części gotyckiej, tynk w nadbudowie)
- Poprawka: import przenosi `building:material` (brick, stone, plaster) i `building:colour` (11 budynków) do danych budynku i części; fasada bierze z nich kolor ściany przed paletą użycia (cegła: czerwonobrązowa, bez tynku); Brama Krakowska rozdzielona po częściach
- Pakiet właściciela: tools/osm-import, packages/engine (renderer/mapcity)
- Test przyjęcia: budynek z `building:material=brick` ma kolor ściany z rodziny cegły; kontrola skanu `brick-plastered` (budynek lub część z `building:material=brick` w OSM z kolorem ściany z palety tynku) 6 → 0

### G-266 Na pierzei Krakowskiego przy Placu Litewskim styl latarni zmienia się przy x 20 bez oparcia w OSM
- Status: naprawione w #236 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: pastorały na całej pierzei placu, decyzja użytkownika)
- Ważność: S4 · Zasięg: Krakowskie Przedmieście x −87…130 (drogi w598108789 i w40049340 z tagami placu w1054556917, nie deptaka); `lamps.kp-deptak` (pastorały) sięga x 20, choć opis planu mówi „od Kapucyńskiej” (tagi deptaka od x 129,7) · Koszt: mały
- Poprawka (decyzja użytkownika 2.11: pastorały): pastorały na całej pierzei placu od x −87 do Kapucyńskiej (`lamps.kp-deptak` wydłużony na zachód), słupy nowoczesne tylko na alejkach wewnątrz placu; kontrola skanu na później: zmiana stylu latarni na osi jednej drogi OSM o tych samych tagach
- Pakiet właściciela: docs/world (plan), tools/osm-import (props)

### G-264 Latarnie OSM na Archidiakońskiej (Stare Miasto) rysowane jako drogowe
- Status: naprawione w #236 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: latarnie OSM w obrysie Starego Miasta jako pastorały; obrys odcina 22 budynki w G-271)
- Ważność: S4 · Zasięg: 2 latarnie `grodzka.street-lamp` → `lamp-road`: (653,9; 39,3), (653,5; 46,6), przy Placu po Farze, 9,8 i 14,9 m od latarni ściennej · Koszt: mały
- Przyczyna: mapowanie `street-lamp → lamp-road` w `tools/osm-import/src/props-kinds.ts:56` („OSM street lamps away from the old town are road lamps”) nie patrzy na miejsce; na Starym Mieście (decyzja użytkownika 2.11: wiodą latarnie stylizowane) powinny być stylizowane
- Poprawka: `street-lamp` w strefie Starego Miasta → stylizowana (np. latarnia ścienna albo pastorał, styl do potwierdzenia przez kuratora); przegląd `topography-curator`
- Pakiet właściciela: tools/osm-import (props)
- Test przyjęcia: kontrola skanu `lamp-road-in-old-town` (zwykła latarnia w obrysie strefy Starego Miasta) 2 → 0
- Także (kurator, T-141): węzły n5830072379 i n5830072380 (`highway=street_lamp`, `layer=1`, bez tagów typu) są wolnostojące, 5–11 m od osi Archidiakońskiej, daleko od ściany. Styl: latarnia stylizowana wolnostojąca (pastorał albo niska latarenka na słupie) w punkcie OSM, nie kinkiet. Te dwa węzły to jedyne latarnie OSM na Starym Mieście

### G-259 Na deptaku Krakowskiego Przedmieścia nowoczesne słupy stoją 1 m od pastorałów
- Status: naprawione w #235 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: na deptaku same pastorały, słupy nowoczesne tylko na alejkach placu; granica stylu przy x 20 w G-266, Archidiakońska w G-264)
- Ważność: S3 (zgłoszenie gracza: charakterystyczne lubelskie latarnie przy deptaku dublowane fabrycznymi) · Zasięg: 16 par `lamp-modern-pole` + `lamp-pastoral` w `krakowskie-1-0` (x 32..227, z −68..−44), odstęp 0,9–2,7 m; do sprawdzenia 2 × `lamp-road` 6,9 m od pastorału w `krakowskie-2-0` (279,7; −89,3), (362,3; −104,3) · Koszt: mały
- Przyczyna: dwa wpisy planu `docs/world/lublin-props.todo.json` mają te same osie deptaka: `lamps.kp-deptak` (pastorał, x 20..440) i `lamps.plac-litewski` (słup nowoczesny), którego `lines` obejmują też odcinki deptaka x 20..240 (`[129.7,-54.9,82.4,-56.3]`, `[240,-66.5,…,129.7,-54.9]`, `[82.4,-56.3,20,-59.4]`), a nie tylko alejki placu
- Poprawka: na deptaku prowadzą latarnie stylizowane (decyzja użytkownika 2.11): odcinki deptaka zdjęte z `lamps.plac-litewski` (słupy zostają na alejkach i obrysie placu), `count` przeliczony; w generatorze reguła: latarnia zwykła (`lamp-road`, `lamp-modern-pole`) nie staje bliżej niż ok. 8 m od stylizowanej (`lamp-pastoral`, `lamp-candelabra`, `lamp-wall-lantern`) przy tej samej ulicy
- Pakiet właściciela: tools/osm-import (props), docs/world (plan)
- Test przyjęcia: kontrola skanu `lamp-plain-by-styled` (zwykła latarnia bliżej niż 8 m od stylizowanej) baza 16+ → 0; tabela z `pnpm osm:props`

### G-252 Złote hashe i testy nie pilnują terenu Trasy Podziemnej; pad wykopu zależy od rozdzielczości siatki
- Status: naprawione w #230 (2.11, PRZYJĘTE z uwagą: pad w metrach, testy pod stopniami, teren bitowo bez zmian; Rynek przy Trybunale bez testu w G-261)
- Ważność: S3 (luka w testach przy ryzykownym obszarze) · Zasięg: przebiegi `determinism.test.ts` nie przechodzą przez Trasę Podziemną ani Rynek przy Trybunale, więc zmiana kształtu terenu tam nie zmienia hasha; pad Trasy Podziemnej (`sites.ts:159`, blend 0,01) jest ustawiony pod węzły siatki 5 m chunka `stare-miasto-0-0`, każda zmiana komórki (także w imporcie) po cichu przesuwa ściany wykopu
- Poprawka: test „grunt pod stopniami Trasy Podziemnej z zapasem ≥ 1 m pod rampą kolizyjną” i „bruk nie wystaje nad stopnie”; pad niezależny od rozdzielczości siatki (granice w metrach, nie w węzłach)
- Pakiet właściciela: packages/sim (content/lublin)

### G-239 Ciało napastnika po wygranym napadzie znika po odejściu gracza ok. 400 m
- Status: naprawione w #229 (2.11, PRZYJĘTE; ciała wroga bez klucza nie są usypiane z chunkiem; nagromadzenie: najwyżej kilka ciał na 30 min, koszt kroku pomijalny)
- Ważność: S4 · Zasięg: po „won” ciało nie ma klucza, a ma chunk ofiary, więc uśpienie chunka zdejmuje je bez stanu (analogia G-219); tak samo po wczytaniu
- Poprawka: jak G-219 (ciało bez chunku), z oceną nagromadzenia ciał (G-196); test z odejściem 400 m
- Pakiet właściciela: packages/sim (micro-events, streaming)

### G-246 Dach namiotowy wieży cerkwi św. Jozafata za stromy, okap ok. 1,5 m za nisko
- Status: naprawione w #226 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: okap y 8,1, szczyt y 9,5, ostrosłup; przesunięcie obrysu cerkwi w OSM w G-257)
- Ważność: S4 · Zasięg: 1 budynek, w1382552285 (270; −9,2), Krakowskie · Koszt: mały (korekta danych)
- Gdzie: T-129
- Dowód: po #209 ściana 8,1 m (okap y 6,5) i dach namiotowy 3 m (stała importu dla wieży bez dachu w OSM), szczyt y 9,5. NMPT GUGiK 0,5 m: wierzchołek y 9,4 w (269,5; −10), okap ok. y 8,0–8,2 przy krawędziach, czyli ok. 1,4 m dachu (ok. 22°); ortofoto PZGiK: jasny blaszany dach namiotowy, rodzaj zgodny
- Poprawka: korekta w `tools/osm-import/src/corrections.ts` z odsyłaczem T-129: `roof:shape=pyramidal`, `roof:height` 1,4 i `height` tak, by szczyt został y 9,5
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: okap w1382552285 y 8,0 ± 0,5, szczyt y 9,5 ± 0,5

### G-256 Skok debugowy robi migawkę z pominięciem `canSave`
- Status: naprawione w #227 (2.11, PRZYJĘTE; `jump` pyta tę samą bramkę `canSave`; sonda weryfikatora: zapis ręczny w walce z `hebi_ganger` bez rozjazdu przez 300 kroków, strażnicy Tessen i pociski w locie niesprawdzone)
- Ważność: S4 (tylko narzędzie debugowe; gracz tego nie widzi) · Zasięg: `packages/app/src/debug-api.ts:154` (`saves.snapshot()`) · Koszt: mały
- Dowód: po #225 wszystkie ścieżki zapisu gracza (slot, szybki zapis, autozapis, ukrycie strony) idą przez `canSave`, a skok debugowy bierze migawkę bez tej bramki, także w chwycie i w walce; skok z takiej migawki odtwarza rozjazd G-253 i G-240 w testach e2e, które go używają
- Poprawka: debugowa migawka przez tę samą bramkę (odmowa z powodem) albo jawny parametr `force` z ostrzeżeniem w logu
- Pakiet właściciela: packages/app
- Test przyjęcia: test sesji: skok debugowy w chwycie odmawia (albo z `force` ostrzega), poza chwytem działa jak dziś

### G-251 Przybudówka Pałacu Lubomirskich w232805924 ok. 6,5 m za wysoka
- Status: naprawione w #224 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: płaski dach y 4,6 w rundzie 2, przesunięcie obrysów zespołu ok. 1 m opisane w T-137, `building:levels` 2 niepotwierdzone)
- Ważność: S4 (proponowana: przy fasadzie południowej od Placu Litewskiego stoi bryła 4 kondygnacji równa pałacowi zamiast niskiej przybudówki; zasłania parter i pierwsze piętro fasady) · Zasięg: 1 budynek · Koszt: mały (korekta tagów, regeneracja `krakowskie`)
- Gdzie: T-137; w232805924 (57,9; 74,3), teren y −1,4
- Dowód: OSM `building=yes`, `layer=1`, bez `height` i `building:levels`; w grze `source: default`, `height` 13, `levels` 4, wierzch y 11,6 (okap pałacu y 11,0). NMPT GUGiK 0,5 m (`scratchpad/topo-g098/dl-nmpt/lubom.asc`, sonda `scratchpad/topo-g249/topo-probe.py`): p10 y 4,6, p50 y 5,1 (p90 12,7 to ściana pałacu w obrysie)
- Przyczyna: OSM bez wysokości, import daje wartość domyślną dzielnicy
- Poprawka: korekta w `TAG_CORRECTIONS` z odsyłaczem T-137: `height` ok. 6,5 (wierzch y 5,1), `roof:shape=flat`, `building:levels` 1 albo 2 według elewacji. Nazwa z tablicy n12281417452 (węzeł obrysu) to G-065, nie mieszać w jednym commicie
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: wierzch w232805924 y 5,1 ± 1 m i co najmniej 4 m pod okapem pałacu; graffiti przy tej ścianie może wrócić (ściana odsłonięta), sprawdzić tabelę `props.generated.ts`
- Przegląd topografii PR #224 (2.11, @ 8e7db42): ZGODNE Z UWAGAMI, nie blokuje. Dach przybudówki w NMPT jest płaski na y 4,6 (p50 5,1 zawiera ścianę pałacu): zalecane `height` 5,8 i cel testu 4,6; `building:levels` 2 niepotwierdzone (1 równie prawdopodobne); przesunięcie obrysów OSM ok. 1 m to T-136, bez nowego glitcha; `props.generated.ts` aktualny (T-137)

### G-253 Zapis w trakcie obezwładnienia: chwyt poza zapisem
- Status: naprawione w #225 (2.11, PRZYJĘTE; zapis ręczny w chwycie odmawia, autozapis czeka do końca chwytu; migawka debugowa w G-256)
- Ważność: S4 · Zasięg: `session.takedown` nie trafia do migawki, a `canSave` nie blokuje zapisu w chwycie; gra wczytana nie ma chwytu, a gra, z której zapisano, go kończy (rozjazd jak G-240)
- Poprawka: `canSave`/autozapis czeka na koniec chwytu (prościej) albo chwyt w zapisie; test hash po zapisie w chwycie
- Pakiet właściciela: packages/app (save-controller, autosave), packages/sim (takedown)

### G-240 Panika tłumu nie trafia do zapisu: wczytana gra rozjeżdża się zaraz po walce
- Status: naprawione w #221 (2.11, PRZYJĘTE; zapis rozlicza zgłoszenia świadków i uspokaja ulicę w obu grach; chwyt przy zapisie w G-253)
- Ważność: S4 · Zasięg: `crowd.state: fleeing` (np. Hideo po walce) poza zapisem; wczytana gra różni się od gry bez zapisu do uspokojenia tłumu (ok. 12 s)
- Poprawka: stan ucieczki tłumu w migawce encji (zapis + migracja) albo wyliczany z zapisanych zdarzeń; test hash co krok po zapisie w trakcie paniki
- Pakiet właściciela: packages/sim (crowd), packages/persistence

### G-236 Schody z `incline` z OSM wznoszą się w grze w drugą stronę
- Status: naprawione w #219 (2.11, runda 3 @ 5757fae PRZYJĘTE; kurator ZGODNE Z UWAGAMI: korekta w56965515 na `incline=down` słuszna, topologia wiaduktu; T-131 poprawiony; garb pod pomostem w G-255, portal bez stopni w G-229)
- Ważność: S4 · Zasięg: 2 z 48 dróg schodów z `incline` w prostokątach map · Koszt: mały do średniego
- Gdzie: T-131; w56965515 pod wiaduktem Zamkowej (736,8; 161,0) → (727,3; 164,0), Podzamcze/Stare Miasto, brzeg chunka z = 160; w66335060 (603,5; −184,6) → (597,3; −185,3), Stare Miasto
- Dowód: teren gry (`SHAPED_TERRAIN`, bez pomostu wiaduktu) na węzłach w56965515: −15,87, −16,76, −15,33, −17,13 przy OSM `incline=up` (sprostowanie kuratora przy #219: droga zaczyna się na pomoście wiaduktu i schodzi, więc błędny był tag OSM, nie teren); w66335060: −2,70 → −2,30 przy `incline=down`, `step_count=7`. `planSteps` stawia stopnie po terenie, więc przy portalu katedry schody szły w dół tam, gdzie w Lublinie idą w górę
- Przyczyna: NMT pod wiaduktem i przy murach to interpolacja (mosty i obiekty usunięte), a schody nie dostają własnego spadku
- Poprawka: dla biegu z `incline` (i `step_count`) wysokości końców z kierunku OSM: wyrównanie terenu wzdłuż schodów (`RAMPS`/`PADS` z uzasadnieniem w T-131) albo spadek biegu liczony w imporcie; razem z G-229
- Pakiet właściciela: tools/osm-import, packages/sim/src/content/lublin (`sites.ts`), packages/engine (steps-plan)
- Test przyjęcia: teren na końcach każdego biegu z `incline` rośnie w kierunku OSM o ≥ 0,1 m na bieg ze stopniami; kontrola `steps-incline-against` 2 → 0

### G-249 Wieże Pałacu Lubomirskich bez bryły, pałac z wysokości domyślnej 3–4 m za niski
- Status: naprawione w #220 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI; dach pałacu 1,0 m i `building:levels=3` dopisane przez orkiestratora; przybudówka w232805924 w G-251)
- Ważność: S4 (proponowana: dwie wieże ok. 20 m stoją 4–6 m nad dachem pałacu przy Placu Litewskim; bez nich i przy za niskim dachu sylwetka pałacu jest płaska) · Zasięg: 1 budynek, 2 wieże · Koszt: mały (korekty tagów jak w T-060, regeneracja `krakowskie`)
- Gdzie: T-136; w1002739983 (83,5; 99,3), w1002739984 (40,3; 102,7), pałac w67508859 (55,8; 87,4)
- Dowód: NMPT GUGiK 0,5 m (kafel `scratchpad/topo-g098/dl-nmpt/lubom.asc`, środek świata (60; 95), ±45 m; pobrany 2.11): wieża zachodnia x 34–40,5, z 99–106, p50 y 17,8; wschodnia x 78–84,5, z 96–102,5, p50 y 17,9, maks. y 19,0; wierzchy płaskie. Dach pałacu p50 y 11,9 (p10 10,8, p90 14,1), w grze wierzch y 8,5 (`source: default`, `height` 10,6, płaski). Obrysy wież z OSM 2–4 m na wschód od NMPT
- Przyczyna: OSM bez `height` dla wież i pałacu; od #216 wieża `man_made=tower` staje się częścią budynku, ale tylko z korektą wysokości (bez niej kontrola `tower-area-missing` ją liczy)
- Poprawka: korekty w `TAG_CORRECTIONS` z odsyłaczem T-136. Wieże: `height` od podstawy pałacu (y −2,1 i cokół 1 m, czyli y −1,1) ok. 19,0, aby wierzch wypadł na y 17,9, oraz `roof:shape=flat`. Pałac: `height` i `roof:height` z profilu NMPT (okap ok. y 11, wierzch dachu y 12–14). Obrysy zostają z OSM, a przesunięcie 2–4 m to sprawa danych OSM, nie gry
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: `tower-area-missing` 2 → 0; wierzch obu wież y 17,9 ± 1 m; wierzch pałacu w ± 1,5 m od NMPT p50 (y 11,9) w środkowym bloku

### G-098 Wieże zmapowane jako `man_made=tower` bez `building` pominięte
- Status: naprawione w #216 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: hełm rysowany czterospadowo zamiast ostrosłupa, cegła, okna; wieże Pałacu Lubomirskich w G-249) · Ważność: S3 (od 2.11, przegląd #198: po G-212 Brygidki nie mają żadnej wieży, a prawdziwa ok. 34 m jest dominantą Narutowicza) · Zasięg: 1 obrys w Krakowskim (dawniej 3; wieże pałacu w G-249) · Koszt: mały–średni
- Wysokość: OSM nie ma `height`; z NMPT wieża Brygidek do y 32,4 (teren y ok. −1,2), w imporcie korekta `height` 31,5 i `roof:height` 9,1 z odsyłaczem T-060
- Uwagi kuratora (S4, nie blokują, T-060): hełm rysowany z kalenicą ok. 1,5 m, a NMPT ma jeden wierzchołek (`roof:shape=pyramidal` w tej samej korekcie); cegła bez `building:material` w OSM (G-244); okna dzwonnicy poza G-245, bo część nie ma `tower: true`
- Gdzie: w1090997970 (wieża Brygidek, 161, −229); T-060
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `tower-area-missing` 3 → 2 (zostają w1002739983 i w1002739984, G-249); szczyt w1090997970 y 32,4 ± 0,5 m

### G-248 „Doktor Mori” po polsku także w angielskiej wersji
- Status: naprawione w #218 (2.11, orkiestrator): `shop.clinic.title` w skanerze, test w `wave1-hud.test.ts`
- Ważność: S4 · Zasięg: `packages/app/src/scan-view.ts:20` `"Doktor Mori"` pokazywany graczowi niezależnie od języka; skan go nie liczy (to nie JSX, a „Doktor” nie ma polskich znaków)
- Poprawka: tytuł z katalogu (en „Doctor Mori”, pl „Doktor Mori”) albo nazwa własna z decyzją w katalogu; przy okazji podglądy deweloperskie (`lublin-preview/preview-main.ts:40`, `props-gallery.ts:32`) bez zmian, gracz ich nie widzi
- Pakiet właściciela: packages/app, packages/ui (i18n)

### G-243 Skan i18n nie łapie polskich słów bez polskich znaków
- Status: naprawione w #214 (2.11, PRZYJĘTE; „ruch” w #213; nowa reguła `shown` znalazła jeszcze 2 teksty, przeniesione do katalogów; reszta luk w G-247)
- Ważność: S4 (luka w narzędziu) · Zasięg: `tools/i18n-scan` liczy literały z polskimi znakami; „ruch” w `touch-controls.tsx` przeszedł, baza była 0
- Poprawka: w JSX liczyć każdy tekst węzła (i `aria-label`, `title`, `placeholder`) poza wywołaniami `t()`, z listą dozwolonych (nazwy własne, symbole); baza z nowej reguły, potem w dół
- Pakiet właściciela: tools/i18n-scan

### G-242 Napastnik po wygranym napadzie zachowuje `ai.victim` w grze, ale nie po wczytaniu
- Status: naprawione w #215 (2.11, PRZYJĘTE; luka: brak testu dla „failed” z ogłuszonym napastnikiem, mutacja „czyść tylko przy won” przeżywa; po „failed” żywy napastnik bez klucza teraz rezygnuje z pościgu)
- Ważność: S4 · Zasięg: `close()` przy „won” nie czyści `ai.victim` (np. `micro:mugging:11:victim`), a zapis tego pola nie trzyma; po przebudzeniu ogłuszonego napastnika `isEngaged` (street.ts:45), `freeToLook` (body-watch-system.ts:31) i `interrupted` (activity.ts:18) różnią się między grą bez wczytania i po wczytaniu (atak na niego jest napaścią tylko po wczytaniu); hash tego nie łapie
- Poprawka: czyścić `ai.victim` w `close()`; test zapis/wczytanie z obudzonym napastnikiem
- Pakiet właściciela: packages/sim (micro-events)

### G-232 Wolnostojące dzwonnice i wieże z `use: historic` rysowane jak kamienice
- Status: naprawione w #209 (2.11, PRZYJĘTE; kurator: ZGODNE Z UWAGAMI, uwagi w G-244 (cegła), G-245 (okna wież), G-246 (dach Jozafata za stromy))
- Ważność: S3 (proponowana: zabytek wygląda jak blok) · Zasięg: dzwonnica św. Mikołaja w680377807, wieża cerkwi św. Jozafata w1382552285 (po G-224 z wysokością z NMPT): rzędy oświetlonych okien i płaski szczyt (zrzut `scratchpad/g224/shots/g224-mikolaj-po.png`)
- Poprawka: budynek z `man_made=tower`/`tower:type=bell_tower` dostaje fasadę wieży (bez okien mieszkań, okna dzwonnicy u góry) i dach namiotowy/hełm; kontrola skanu „wieża z oknami mieszkań”
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import (use)

### G-233 Ciało napastnika mikrozdarzenia niesione na ramieniu znika przy zapisie i wczytaniu
- Status: naprawione w #211 (2.11, zapis v28, PRZYJĘTE): `strayBodies`; ciało niesione w trakcie napadu: zapis zamyka napad jak „left”
- Ważność: S4 · Zasięg: napad (mugging): ciało napastnika niesione przez gracza (`carrying` ustawione) po zapisie i wczytaniu: `carrying` null, 0 ciał. Przed „won” ciało ma klucz `micro:` i odpada w `isMicroKey`, po „won” klucza nie ma i dalej ginie
- Poprawka: ciało napastnika po zakończeniu zdarzenia staje się zwykłym ciałem w zapisie (jak ciała posiłków, G-193); test zapis/wczytanie z niesionym ciałem
- Pakiet właściciela: packages/sim (micro-events, bodies), packages/persistence

### G-216 Kościoły z wysokości domyślnej o 3–15 m za wysokie
- Status: naprawione w #208 (2.11, PRZYJĘTE przez weryfikatora; kurator: ZGODNE Z UWAGAMI, nie blokuje; okap Mikołaja 8,5 zostaje, niższe części obrysu w G-238, wieże proceduralne w G-215): 9 kościołów z NMPT (dach potwierdzony niezależną sondą u wszystkich 9), kontrola `church-over-nmpt` 9 → 0 (w tabeli kontroli dawna nazwa `church-default-height`); kontrola łapie rachunek i domyślne wysokości, nie zły pomiar; do kuratora: okap św. Mikołaja może być 1–1,5 m za wysoko, Świętego Ducha: 16,5 to okap, kalenica 20,4
- Ważność: S3 (proponowana) · Zasięg: szeroki (9 kościołów w trzech dzielnicach) · Koszt: mały (dane)
- Gdzie: T-122 (lista i wysokości)
- Dowód: kalenice w grze przed #208 (`y + height + roof`, `height` zawiera cokół) a kalenice NMPT: Bernardyni 27,7/24,5, Brygidki 27,7/22,0, Świętego Ducha 25,1/20,4 (okap 16,5), Niecała 4 18,0/1,8, św. Jozafata 22,6/11,4, Karmelici 23,0/14,5, św. Piotra 23,3/19,7, św. Mikołaja 21,1/12,5, cerkiew Przemienienia 5,4/−4,3 (T-122)
- Priorytet (kurator, przegląd #207): wyżej, zacząć od św. Jozafata w69916021. Po G-224 wieża (szczyt y 9,5) stoi 6,3 m pod okapem nawy (y 15,8) i 13,1 m pod kalenicą, w rzeczywistości ok. 3,8 m pod szczytem kościoła; bez obniżenia nawy poprawna wieża jest niewidoczna z ulicy. U św. Mikołaja kalenicę mierzyć z dala od koron drzew (por. G-235)
- Przyczyna: `building=church` bez `height` i `building:levels` dostaje 4 kondygnacje i cokół
- Poprawka: korekty `height`/`roof:height` z NMPT w `corrections.ts` (jak G-204)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `church-over-nmpt` spada z 9 do 0

### G-213 Biegi schodów krótsze niż szerokie rysowane w poprzek
- Status: naprawione w #204 (2.11, runda 3 @ 0995c9d PRZYJĘTE; kurator ZGODNE Z UWAGAMI: każdy pas leży wzdłuż biegu swojej drogi poza znanymi brzegami chunków G-234, uproszczenie usuwa wierzchołki do 4,2 cm; odstępstwa sprzed zmiany T-131 (G-236), T-132 (G-237)): pasy ≥ 0,45 m, kontrola `steps-band-hidden`; bazy `steps-across-run` 1 i `steps-band-hidden` 1 to stan sprzed G-213 na brzegach chunków (G-234)
- Ważność: S4 · Zasięg: 36 ze 121 biegów w mieście jest krótszych niż ich pas 3 m, więc renderer bierze dłuższy bok pasa za kierunek biegu i rysuje stopnie w poprzek (np. w66258166 przy Donżonie, w1312664177)
- Poprawka: zdjąć warunek `w > PATHS.steps` w `flightStrips` (tools/osm-import/src/ground.ts, po #194), żeby każdy bieg krótszy niż szeroki był dzielony na pasy; kontrola skanu „bieg w poprzek”
- Poboczne: wyciąg `krakowskie.json` bez murków (nieaktualny cache kafli, `osm:fetch --only=krakowskie` z siecią); pas bez nawierzchni między brukiem Placu Zamkowego (x ok. 759) a ścieżką w56965514 (x ok. 765)
- Z weryfikacji #194: sąsiednie pasy krótkiego biegu dają stopnie przesunięte w pionie do ok. 0,06 m (`planSteps` próbkuje teren osobno na osi każdego pasa); najkrótszy bieg w1435832499 (1,3 m) wychodzi płaski (rise/count < `MIN_RISER`)
- Pakiet właściciela: tools/osm-import

### G-224 Wieże kościołów z OSM z wysokości domyślnej (wieża cerkwi św. Jozafata; dzwonnica św. Mikołaja w G-235)
- Status: naprawione w #207 (2.11, runda 2 PRZYJĘTE; kurator: ZGODNE Z UWAGAMI): tylko wieża cerkwi św. Jozafata (szczyt y 9,5); dzwonnica św. Mikołaja wydzielona do G-235, nawa Jozafata do G-216
- Ważność: S3 (proponowana; po G-212 to jedyna wieża cerkwi) · Zasięg: 1 wieża (Krakowskie) · Koszt: mały (dane)
- Gdzie: T-129; w1382552285 (270; −9,2), wieża cerkwi św. Jozafata
- Dowód: w grze `source: default`: 13,8 m z cokołem 1 m, szczyt y 12,2; NMPT GUGiK 0,5 m: maks. w obrysie y 9,5 (10,1 w promieniu 4 m od środka to krawędź nawy)
- Przyczyna: OSM ma tylko `building=yes`, `man_made=tower`, `tower:type=bell_tower`, bez `height` i `building:levels`
- Poprawka: korekta `height` 10,1 (nad cokołem) z NMPT w `corrections.ts` z odsyłaczem T-129; to samo dla wieży Brygidek przy G-098
- Pakiet właściciela: tools/osm-import, tools/glitch-scan
- Test przyjęcia: najwyższy wierzchołek bryły w1382552285 (`y + height + roof`) y 9,5 ± 1, `source: height`; kontrola `osm-tower-default-height` z bazą 1 (zostaje w680377807, G-235). Wcześniejsze kryterium „w680377807 y 15,7 ± 1” było błędne (korona drzewa)
- Uwaga kuratora: wieża jest teraz 6,3 m pod okapem nawy w69916021 z wysokości domyślnej (w rzeczywistości 3,8 m pod szczytem kościoła); pełna zgodność dopiero z G-216

### G-231 Mikrozdarzenie: obaj napastnicy powaleni żywcem nie dają wygranej (do potwierdzenia)
- Status: naprawione w #206 (2.11, PRZYJĘTE; potwierdzone prawdziwym `takedown`, ogłuszającym i śmiertelnym; `out()` = brak encji albo `downed`)
- Ważność: S3 (proponowana: brak nagrody za wykonaną akcję) · Zasięg: `runMicroEvent` sprawdza `attackers.every((id) => !byId(…))`, więc powaleni, ale obecni napastnicy nie liczą się jako pokonani; po odejściu gracza „left” bez nagrody i usunięcie powalonych (sonda przez `restoreDowned`)
- Poprawka: pokonany = nieobecny albo powalony; test z prawdziwym takedownem obu
- Pakiet właściciela: packages/sim (micro-events)

### G-219 Powalony żywy posiłek ochrony znika po odejściu gracza ok. 300 m
- Status: naprawione w #203 (2.11, PRZYJĘTE; posiłki bez `chunk` jak ciała, nie są usypiane; sprzątanie powalonych i ciał zostaje w G-196)
- Ważność: S4 · Zasięg: posiłek powalony żywcem ma `chunk: ""`; `chunk-unload` usypia go po chunku, w którym leży, a bez klucza nie zostaje po nim stan, więc znika na zawsze, a `sent` spada do 0 (sonda, ziarno 7: 100 m nadal jest, 300 m już nie, po powrocie brak); pokrewne G-196 (ciała posiłków bez chunku)
- Poprawka: powaleni i ciała posiłków przypisani do chunka, w którym leżą, z zapisem przy uśpieniu i powrotem przy wczytaniu chunka (wtedy `goneReinforcement` z G-209 musi uwzględnić uśpionych, żeby nie płacili XP drugi raz)
- Pakiet właściciela: packages/sim (streaming, reinforcements)

### G-220 Brak testu: powalony, niesiony albo schowany posiłek nie jest „odeszły” dla pamięci hacków
- Status: naprawione w #203 (2.11, PRZYJĘTE; test powalonego, niesionego i schowanego posiłku łapie mutację `filter(!e.downed)`)
- Ważność: S4 (luka w testach) · Zasięg: `goneReinforcement` (`packages/sim/src/world/reinforcements.ts`); mutacja `present` bez powalonych (`filter(!e.downed)`) przechodzi testy G-209, łapie ją tylko sonda weryfikatora
- Poprawka: test, w którym powalony, niesiony i schowany posiłek zostaje w pamięci po zapełnieniu jej odeszłymi (pada z mutacją)
- Pakiet właściciela: packages/sim

### G-197 Drzwi klatek od podwórza: Trasa Podziemna liczona jako ulica
- Status: naprawione w #201 (2.11, PRZYJĘTE przez weryfikatora; kurator: ZGODNE Z UWAGAMI, T-110 poprawione): `undergroundWays` z ekstraktów, kontrola `door-faces-underground` 2 → 0; Złota 6 dostaje drzwi od Złotej; drugie zdjęte drzwi (654,9; 9,0) były na Grodzkiej 7 r3119721, która zostaje bez drzwi (G-227); w66293533 bez drzwi już przed zmianą (G-221)
- Ważność: S4 · Zasięg: 2 drzwi: Złota 6 (667,7; −31,0), Grodzka 7 r3119721 (654,9; 9,0)
- Przyczyna: `facesStreet` w `tools/osm-import/src/props-doors.ts` bierze drogi z `tunnel=yes`, `layer=-1` (Trasa Podziemna, w chunkach zwykły `footway`), więc ściana od podwórza wygląda na ścianę od ulicy
- Poprawka: `facesStreet` pomija drogi z `layer<0` albo `tunnel`; kontrola skanu `door-faces-underground` (baza dziś 2) → 0
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-208 Pamięć utknięcia gangera poza zapisem: posiłki w heacie rozjeżdżają się po wczytaniu
- Status: naprawione w #195 (2.11, zapis v27; runda 2 PRZYJĘTE: strona odchylenia posiłku z `n` nazwana zmianą reguły, walidator `since`/`unstickUntil`, `avoid` do 256 najbliższych; świadomy kompromis: ponad 256 postaci w 8 m da inne obejście po wczytaniu)
- Ważność: S4 · Zasięg: posiłki ochrony w heacie (seed 21 i 5, zapis po 300, 450 i 700 krokach, rozjazd w krokach 209, 59 i 50); `sec2` wciśnięty w `sec1` przy (415,6; −98,9), obejście (unstick) zaczyna się w innym kroku
- Przyczyna: przejściowa pamięć postępu `Progress` w `createGangerAiSystem` (ADR-0025) nie jest komponentem i nie trafia do zapisu
- Poprawka: `Progress` jako komponent z zapisem (nowa wersja zapisu) albo pamięć wyliczana z zapisanego stanu; test zapis–wczytanie dla posiłków w heacie
- Poboczne: `gameOver`, `session.lastThreat`, `player.lastHitBy` (id encji) i `velocity` NPC poza zapisem; stan lotu gracza (`fall`, `airPeak`, `jump`) poza zapisem, więc zapis w powietrzu rozjeżdża się w 1. kroku (weryfikator #185: (2440;545), (490;180), seed 8; pokrewne G-201); walidator przyjmuje `gun.loaded` ponad magazynek i `sniper.perch` spoza tabeli; testy zapisujące martwego gracza porównują stan, którego w grze nie ma
- Pakiet właściciela: packages/sim, packages/persistence

### G-212 Podwójne wieże: proceduralna obok wieży z OSM
- Status: naprawione w #198 (2.11, PRZYJĘTE przez weryfikatora, kurator: ZGODNE Z UWAGAMI, uwagi w T-129/G-224 i G-098): `mappedTower` z OSM i wieże tylko w obrysie; Brygidki bez wieży do G-098, Karmelici Bosi bez wież na trawie
- Ważność: S4 · Zasięg: cerkiew św. Jozafata w69916021 (wieża z OSM w1382552285 przy (270; −9)) i kościół św. Mikołaja w66258180 (dzwonnica z OSM w680377807 przy (879; 545)) dostają dodatkowo proceduralną wieżę (`roof-plan` `addTowers`); Brygidki w66264082: proceduralne wieże, prawdziwa w1090997970 niezaimportowana (G-098)
- Poprawka: `addTowers` pomija kościół, przy którym (w obrysie albo do 10 m) stoi wieża z OSM; rozszerzyć kontrolę `landmark-fake-tower` albo nowa `landmark-double-tower`
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/glitch-scan

### G-203 Schody zamkowe mają 3 m zamiast ok. 10 m szerokości
- Status: naprawione w #194 (2.11, PRZYJĘTE przez weryfikatora i kuratora z uwagami): `correctedLine` z `width=10` dla 5 biegów i 6 podestów, kontrola `steps-narrower-than-walls` baza 0. Uwagi kuratora (ortofoto PZGiK): bieg 2 i bieg 5 przed bramą mają w rzeczywistości ok. 15 m (T-126, G-217); kandelabr (826,2; 235,8) na biegu 5 (T-127, G-205)
- Ważność: S3 (proponowana) · Zasięg: lokalny, ale to oś widokowa Placu Zamkowego · Koszt: mały–średni
- Gdzie: biegi w1435832499, w1305940836, w1305889408, w1305940837, w1306105687, x 766..829, z 238..246
- Dowód: `ground.ts` `PATHS.steps = 3`; murki OSM w231832094 i w231832095 stoją ok. 9,9 m od siebie, na ortofoto PZGiK ok. 11 m; zrzut `zamek-schody`
- Przyczyna: OSM nie ma `width` na biegach; import bierze szerokość domyślną. `TAG_CORRECTIONS` zna tylko obszary, nie linie (to samo potrzebne dla T-050)
- Pakiet właściciela: tools/osm-import (korekta `width` dla linii albo szerokość biegu ze ściskających go murków)
- Test przyjęcia: pas `steps` każdego biegu ma ≥ 9,5 m, a podesty łączą się z biegami bez trawy pomiędzy; kontrola `steps-narrower-than-walls` (baza 1) → 0

### G-209 Cel uploadu `security:<n>` niejednoznaczny przy dwóch posiłkach z tym samym numerem; pamięć hacków 256
- Status: naprawione w #196 (2.11, PRZYJĘTE): część 2 (pamięć hacków) naprawiona przez zapominanie odeszłych posiłków; część 1 nie odtwarza się (`sent` i walidator wykluczają powtórzone `n`)
- Ważność: S4 · Zasięg: gdy żyje powalony posiłek z poprzedniego heatu i nowy posiłek z tym samym `n`, `findTarget` (G-194, `scanner-system.ts`) może trafić w niewłaściwy; `HACKED_MEMORY = 256` (`packages/core/src/progression/progression.ts`): po 256 hackach posiłków (każdy dodaje klucz) najstarsze urządzenia z kluczem wypadają z pamięci i płacą ponownie
- Poprawka: cel uploadu jako `security:<n>@<since>` (klucz z G-202); pamięć hacków osobno dla posiłków albo większa granica z testem; przy balansie (ADR-0059 etap 8) ocenić XP za posiłki w długim heacie
- Pakiet właściciela: packages/sim, packages/core

### G-210 Proceduralna dzwonnica z iglicą na Kaplicy Trójcy
- Status: naprawione w #190 (2.11, PRZYJĘTE; Bernardyni na liście do czasu G-214, bo ich prawdziwa wieża stoi przy południowej ścianie)
- Ważność: S3 (proponowana: fałszywa iglica jest najwyższym akcentem wzgórza zamkowego zamiast Donżonu) · Zasięg: Kaplica w66258167 (941; 214,6), możliwe inne kościoły z listy zabytków bez części i bez `tower` w OSM
- Przyczyna: `packages/engine/src/renderer/mapcity/roof-plan.ts` (`towerSpots`/`addTowers`) dokłada wieżę kościołom bez `building:part`, więc wyłączenie z G-057 nie działa; korona wieży ok. y 19,0, iglica do ok. y 28–30 (Donżon 16,9; prawdziwa Kaplica bez wieży, szczyt zachodni ok. y 16,9)
- Poprawka: bez proceduralnej wieży na zabytkach z `LANDMARK_BUILDINGS` bez `tower` w OSM (albo przepis Z3); kontrola skanu `landmark-fake-tower` (baza ≥ 1); migawka NPR świadomie
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/glitch-scan

### G-211 Teleport (narzędzie zrzutów) na targu i w dokach ląduje we wnętrzu
- Status: niepotwierdzone (2.11, łowca na origin/main 421a10b; do zamknięcia jako odrzucone, nie do odtworzenia)
- Ważność: S4 (gdyby się potwierdziło) · Zasięg: zgłoszone (2689; 247) w dokach i (550; 281) na targu
- Dowód (dane): żaden z dwóch punktów nie leży w żadnym pokoju `INTERIORS` (7 pokoi w 4 wnętrzach: clinic x 318–325, neon-koi x 307–324, trasa-podziemna x 568–585 z ok. -64 do -56, tessen-office x 2530–2542, z 428–438; najbliższy (2689; 247) to Tessen, ok. 190 m dalej; `interiorAt` na y gruntu +0,1 i +1 daje null w obu punktach). Żaden nie leży w obrysie budynku OSM (docki: w173489049 środek 17 m, obrys nie obejmuje punktu; targ: najbliższy w66324547 20,7 m, w66324546 22 m) ani w obszarze set piece (MARKET_AREA x 755–815, DOCKS_AREA x 2520–2594). Wysokość: `groundY` = -22,744 (docki) i -18,44 (targ), `teleport` stawia gracza na `streamer.ground.heightAt` (zrzut JSON: y -22,744, kamera y -21,124), czyli nie pod terenem
- Dowód (zrzuty z gry, `glitch-shots`, yaw 0, pitch 0): docki `/tmp/claude-0/-home-user-SpinalTap/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/g211-shots/g211-docks.png`: plac przy ścianie budynku (ciemna ściana po prawej), z lewej granatowa woda/niecka, żadnego wnętrza; targ `.../g211-market.png`: ulica z zabudową, żadnego wnętrza. Niebieski kadr, który widział weryfikator, to najpewniej woda (docki) lub kadr z innego yaw/y; nie odtworzono
- Kontrola `interior-outside-building` (baza 0, tolerancja 0,3 m) nie ma tu nic do zgłoszenia: żadne wnętrze nie sięga tych punktów
- Do zrobienia: zamknąć jako odrzucone (nie do odtworzenia); jeśli weryfikator ma kadr, niech poda yaw, pitch i y teleportu. Opcjonalnie test przyjęcia na przyszłość (QA): `interiorAt` dla (2689; 247) i (550; 281) na gruncie zwraca null
- Pakiet właściciela: bez (packages/sim ani e2e bez zmian)

### G-180 Zapis po śmierci gracza wczytuje się bez game over
- Status: niepotwierdzone (2.11, naprawiacz): żadna ścieżka w app nie zapisuje martwego gracza (obrażenia przed `deathSystem`, `canSave` odrzuca ekran `dead`, pauza wymaga `inControl`, autozapis wymaga `!gameOver` i hp > 0); strażnik `packages/app/test/death-save.test.ts` w PR #193. Poboczne: import spreparowanego zapisu z hp 0 może dać podwójne `PlayerDied` (walidator mógłby odrzucać hp ≤ 0)
- Ważność: S3 do potwierdzenia · Zasięg: zapis przy hp 0 wczytuje się z `gameOver=false` i drugi raz emituje `PlayerDied`
- Pakiet właściciela: packages/sim, packages/app

### G-201 Teren poza chunkami dostępny: reguła „poza wczytanym chunkiem” usypia strażnika obok gracza
- Status: naprawione w #189 (2.11, PRZYJĘTE): `nearFocus` 30 m w `unloadChunks` i `sleepPinned`, także w chunkach; zostaje osobno: strażnik dalej niż 30 m w obcym chunku znika przy uśpieniu własnego
- Ważność: S4 · Zasięg: obszary bez chunków, a z terenem, np. (2440; 545) na północ od Nabrzeża albo pas x 460–520, z > 160 między Starym Miastem a Podzamczem; żywy gracz stoi tam (hp 96), spokojny przypięty strażnik 6 m od niego znika w 1. s, zaalarmowany po 30 s (`sleepPinned`, G-188)
- Poprawka: odległość od gracza zamiast samej przynależności do chunku albo brak dostępnego terenu poza chunkami; pokrewne: spokojny nieprzypięty strażnik w innym wczytanym chunku znika przy uśpieniu własnego (`standing` w `unloadChunks` tylko dla planów dnia i ciał); `ai.victim` z szablonu nie trafia do zapisu; `goAway()` w `contract-site-cleared.test.ts` stawia gracza poza mapą (testy G-195 z martwym graczem); `keepFormer` bez testu integracyjnego
- Weryfikator #189: próg poza chunkami to 30 m (`loadRadius`), w chunkach praktycznie 44 m (histereza usypiania), więc spokojny strażnik 31 m od gracza poza chunkami znika w jednym kroku; w `micro-events.ts` uśpienie obu napastników zamknęłoby zdarzenie jako „won” z nagrodą (dziś wyklucza to geometria `MICRO_SPOTS`, ale nic tego nie pilnuje)
- Pakiet właściciela: packages/sim (streaming)

### G-202 Posiłki ochrony nie dają XP za quickhack
- Status: naprawione w #187 (2.11, PRZYJĘTE; zapis v26): klucz XP `security:<n>@<since>`, decyzja użytkownika „zgodnie ze standardem”
- Ważność: S4 · Zasięg: `grantQuickhackXp` (`packages/sim/src/world/progression-ops.ts`) zaczyna się od `if (!key) return;`, więc posiłek ochrony (bez klucza) nigdy nie daje XP, a strażnik z kluczem daje raz
- Oczekiwane (standard gatunku, bez farmienia): każdy posiłek daje XP za quickhack raz, także po zapisie i wczytaniu; ten sam posiłek drugi raz nic
- Poprawka: klucz XP posiłku z trwałego numeru (`security:<n>` z G-194) z rozróżnieniem kolejnych heatów, jeśli `n` może się powtórzyć po resecie `sent` (np. numer heatu w kluczu); test jednej sesji i zapisu; złoty hash świadomie, jeśli się zmieni
- Pakiet właściciela: packages/sim

### G-204 Wysokości Kaplicy Trójcy (domyślna) i Donżonu niezgodne z NMPT
- Status: naprawione w #188 (2.11, PRZYJĘTE; kurator: wysokości zgodne z NMPT, korona Donżonu na parapecie 16,9)
- Ważność: S3 (proponowana) · Zasięg: lokalny (sylwetka Zamku) · Koszt: mały
- Gdzie: Kaplica w66258167 (941; 214,6), Donżon w450180469 (893,1; 214,6)
- Dowód: NMPT GUGiK 0,5 m. Kaplica: okap ok. y 7 wobec 9,7 w grze, kalenica y 15,3 wobec 14,1; prezbiterium niższe (kalenica ok. y 11). Donżon: korona ok. y 16,4–16,9 wobec 18,6
- Poprawka: `corrections.ts`: Kaplica `height` 21,6 (ściany 13,3 + dach 8,3, wzór importera: walls = height − min(roof, height/2)), `roof:height` 8,3; Donżon `height` ok. 23,3; prezbiterium Kaplicy jako część w etapie Z3 planu
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `landmark-default-height` (baza 3) spada do 2; okap i kalenica Kaplicy oraz korona Donżonu w danych gry co do 1 m z NMPT

### G-185 Stan strażników kontraktu po wczytaniu (hack w toku, uśpieni)
- Status: (a) naprawione w #185 (1.11, PRZYJĘTE w rundzie 2; zapis v25: broń NPC i stan snajpera w zapisie, laser po wczytaniu w fazie `aim`, walidator naboi); (b) i (c) nie odtwarzają się z żywym graczem (artefakt martwego gracza poza mapą), test `save-load-away-guards.test.ts` pilnuje; (d)/(e) w G-208. Zgłoszenie zamknięte.
- Ważność: S3 · Zasięg: (a) hack w toku: seed 9, zlecenie `hack` przy Genzo, połączenie z `quay_terminal`, zapis 565 kroków po połączeniu: w 1. kroku `c1-g1.cooldown` 2,583 w oryginale i 0 po wczytaniu, gracz hp 6 vs 37, inny `rngState`; zapis po 660 krokach: `c1-g2` po wczytaniu stoi na posterunku (2576; −28,6; 421), w oryginale się rusza; (b) `lost` zaalarmowanego strażnika zapisanego poza chunkiem o 1/60 wyżej (`dormant-restore`; seed 77, 10 kroków po alarmie, teleport Genzo+2000, 120 kroków, zapis); (c) `suspicion` uśpionego strażnika: seed 8, aktywny `infiltrate`, wyjście z doków, zapis, powrót na `docks(0,0,120)` i 5 kroków: `c1-g0.suspicion` 0,0266 vs 0,0183 (d) z weryfikacji #165: zapis w trakcie wymiany ognia rozjeżdża się po ok. 150–210 krokach, z posiłkami i z kluczowanym NPC (courier, seed 21: krok 33 na main i HEAD); zapis gubi m.in. `combatant.loaded`, `bloom`, `velocity`, `session.lastThreat` i przechodniów tłumu; (e) z weryfikacji #172: zapis z żywymi, walczącymi posiłkami w trwającym heacie rozjeżdża się w 9. kroku po wczytaniu, także bez ciał (`rngState`, `hp`, `cooldown` broni; stany w `scratchpad/v-g193-c.json`, `v-g193-d.json`)
- Poprawka: cooldown/stan walki strażników w zapisie albo odtwarzane; `dormant-restore` bez dodatkowego kroku; test zapis–wczytanie dla każdego wariantu
- Pakiet właściciela: packages/sim, packages/persistence

### G-200 Test tabeli rekwizytów blisko limitu 20 s w CI po drzwiach
- Status: naprawione w #183 (1.11, PRZYJĘTE; main czerwony od #167 do #183): przyczyna z profilu: `neighbour` w `cityFrames` przeglądał wszystkie 3662 budynki na próbkę co 10 cm, #167 dodał drugie ramkowanie; poprawka przez `BinIndex` i wczesne odrzucenie w `fits`, tabela bajt w bajt, 9,3 → 3,0 s pod `--coverage`. Poboczne: `determinism.test.ts` „golden run… at every density” 27 s pod load 24–27; `DoorRules.fit` filtruje wszystkie rekwizyty na slot; `cityFrames` liczy szczyt sąsiada z `at.y + height`, renderer z `base + height`: sprawdzone przez orkiestratora, to to samo (`MapCity` wpisuje `base: at.y`, `map-city.ts:125`); różni się za to `heightAt` w `mapBuilding`: `cityFrames` podaje `() => null`, więc `foot` = `base`, a renderer bierze najniższy teren pod obrysem; do sprawdzenia przy G-197/G-198, czy `facadeFrame` zależy od `foot` w miejscach drzwi i szyldów na spadku
- Weryfikator #183: na tym samym hoście 2,7–4,5 s zamiast 9,2–13,5 s; w pełnym `test:coverage` 6,7 s; do obserwacji: `traffic-junction-drive.test.ts` „by Ruska and Lwowska (seed 3)” 17,5 s pod coverage przy load 18 (domyślny limit 20 s?) i „is deterministic…” w props.test.ts 10,3 s
- Ważność: S3 (test, czerwony CI kosztuje cykl) · Zasięg: `tools/osm-import/test/props.test.ts` „matches the committed table” przekroczył 20 s w `test:coverage` na CI (przebieg 714 s zamiast ok. 550 s); lokalnie 3,1–3,2 s przy load 17
- Przyczyna do ustalenia: generator rekwizytów urósł o reguły drzwi (#167) i targu (#153); test przelicza całą tabelę pod pokryciem
- Poprawka: pomiar czasu generacji przed i po #167 (profil), przyspieszenie generatora albo wspólne wyliczenie tabeli dla testów; bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: tools/osm-import (QA)

### G-194 Quickhack w toku na encji bez klucza trafia po wczytaniu w inną encję
- Status: naprawione w #179 (1.11, PRZYJĘTE): posiłek jako `security:<n>`, inne encje bez klucza przerwane po wczytaniu (`SessionWatch.uploadId`), schemat bez zmian
- Ważność: S4 · Zasięg: `packages/sim/src/systems/scanner-system.ts:94` zapisuje cel jako `#<id>` w `domain.netrun.upload`; po wczytaniu id są przydzielane od nowa (worki z łupem biorą nowe), więc upload trafia w inną encję albo w nic
- Poprawka: cel uploadu przez klucz (np. `security:<n>`) albo odrzucenie uploadu na encji bez klucza przy zapisie
- Pakiet właściciela: packages/sim

### G-188 Zaalarmowani strażnicy zlecenia przypięci w świecie daleko od gracza
- Status: naprawione w #181 (1.11, PRZYJĘTE; zapis v24): `sleepPinned` usypia przypiętych poza wczytanymi chunkami (zaalarmowanych po 30 s), znacznik `away` w zapisie, `dormant-restore` po znaczniku, `keepFormer` przycina szablony
- Ważność: S4 · Zasięg: zaalarmowani strażnicy zleceń (np. c1-g2, c3-g3) zostają przypięci w świecie ponad 4000 ticków, gdy gracz jest 2 km dalej; przez to zastąpione zlecenia trwale siedzą w `formerContracts` zapisu
- Z weryfikacji #175 (G-195): uspokojony przypięty strażnik, którego chunk już śpi, zostaje w świecie do końca sesji, a po wczytaniu znika (sesja i zapis się rozchodzą); `dormant-restore.ts` sprawdza chunk szablonu (`former.chunk`), a nie chunk, w którym strażnik stoi, więc uspokojony strażnik oczyszczonego miejsca w innym, załadowanym chunku znika po wczytaniu na oczach gracza; `StreamCatalog.former` nie jest przycinana i rośnie z każdym wypłaconym zleceniem
- Poprawka: zaalarmowany strażnik daleko od gracza (poza zasięgiem chunków przez N s) uspokaja się i zasypia; test jednej sesji i zapisu
- Pakiet właściciela: packages/sim (streaming, dormant-restore)

### G-199 XP za quickhack na celu bez klucza: możliwe wielokrotne zbieranie
- Status: niepotwierdzone (1.11, sonda naprawiacza): `grantQuickhackXp` zaczyna się od `if (!key) return;`, więc cel bez klucza nigdy nie daje XP (posiłek n=1 hackowany 3 razy i 2 razy po wczytaniu: 0 XP); cele z kluczem płacą raz (`progression.hacked` w zapisie). Do decyzji użytkownika (poza rejestrem): czy posiłki ochrony mają płacić raz, pamięć po `security:<n>`
- Ważność: S4 (proponowana) · Zasięg: `grantQuickhackXp(ctx, target.key)` w `packages/sim/src/systems/scanner-system.ts`; posiłki ochrony i inne cele bez klucza nie mają klucza, więc gra nie zapamiętuje, że cel już dał XP
- Do zrobienia: sonda (ten sam posiłek hackowany kilka razy, także po zapisie i wczytaniu); jeśli XP rośnie za każdym razem, pamięć po `security:<n>` jak w G-194
- Uwaga: po wczytaniu trwający upload jest przerwany w 1. kroku, gdy gracz nie trzyma skanu (zachowanie sprzed G-194)
- Pakiet właściciela: packages/sim

### G-195 Strażnicy wykonanego kontraktu wracają po ponownym wejściu
- Status: naprawione w #175 (1.11, PRZYJĘTE; decyzja użytkownika: „jak w innych grach tego typu”): `clearSite()` przy wypłacie i przy wczytaniu; przegrane jak dotąd; schemat v23 bez migracji
- Ważność: S3 · Zasięg: po wykonaniu kontraktu jego strażnicy odradzają się przy ponownym wejściu w chunk, dopóki miejsce nie dostanie następnego kontraktu (zastąpione zlecenia żyją w `formerContracts`, `packages/sim/src/simulation.ts:98`, `:245`)
- Oczekiwane (wzór gier z gigami i posterunkami): miejsce wykonanego kontraktu zostaje oczyszczone; zabici i obezwładnieni nie wracają, ocaleni odchodzą przy wyjściu gracza z zasięgu; nowi strażnicy pojawiają się tylko z następnym kontraktem w tym miejscu; ciała znikają po wyjściu z zasięgu chunków
- Poprawka: strażnicy wykonanego kontraktu nie trafiają do `formerContracts` przy uśpieniu (albo wpis oznaczony jako oczyszczony); test jednej sesji (wyjście i powrót) i zapisu; złoty hash zmieni się świadomie; razem z G-188 (ten sam mechanizm uśpienia)
- Pakiet właściciela: packages/sim (streaming, contracts), packages/persistence

### G-183 Skan latarni ściennych nie widzi przejść spoza `building_passage`
- Status: naprawione w #168 (1.11, PRZYJĘTE w rundzie 2): kontrola `wall-lantern-by-passage` (baza 0) i `Site.nearPassage` przycinają oś `GATE_PASSAGES` do sklepienia; tabela rozstawienia bez zmian (runda 1 była fałszywym alarmem). Poboczne: skan pomija przejścia bez obrysu `p.building`
- Ważność: S4 (narzędzie) · Zasięg: `wall-lantern-in-building` bierze osie tylko z `tunnel=building_passage`; przejście Gruella pod Wieżą Trynitarską (w298307007, `tunnel=yes`, `layer=-1`) i ręczne bramy `GATE_PASSAGES` pilnuje tylko generator (`Site.nearPassage` zna przejazdy chunków, nie zna `GATE_PASSAGES`); dziś 0 trafień
- Poprawka: kontrola „latarnia ścienna bliżej niż 2 m od osi przejścia z danych gry” (`PASSAGES` i `GATE_PASSAGES`, odcinek przycięty do końców), baza 0; `nearPassage` także dla `GATE_PASSAGES`. Uwaga: pas wokół `tunnel=yes|covered=yes` z OSM łapie Trasę Podziemną (w293370650), więc nie z OSM
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

### G-193 Zwłoki posiłku ochrony znikają po wczytaniu
- Status: naprawione w #172 (1.11, PRZYJĘTE): `corpseOf` zachowuje `security`, zapis obejmuje ciała posiłków, `crime-system` liczy tylko żywych; schemat v23 bez zmian
- Ważność: S3 · Zasięg: posiłek zabity po powaleniu albo w trakcie obalenia zostawia ciało bez klucza i bez `security` (`corpseOf`, `packages/sim/src/world/bodies.ts:64`); ciało nie trafia ani do `entities`, ani do `reinforcements`, więc po wczytaniu nie ma go do znalezienia ani zgłoszenia
- Poprawka: zwłoki posiłków w zapisie (z `n`) albo `corpseOf` przenosi klucz `security:<n>`; test zapis–wczytanie
- Pakiet właściciela: packages/sim, packages/persistence

### G-148 Szyldy i neony wcięte w fasady (parasol)
- Status: zamknięte (1.11, orkiestrator): G-157, G-158, G-159 i G-160 naprawione (w archiwum), a kontrole `venue-board-in-neighbour`, `banner-in-neighbour`, `holo-or-blade-in-neighbour` i `wall-lantern-over-venue-board` mają w main bazę 0 (wcześniej 7, 31, 4, 17); zostaje osobno G-161 (markiza nad literami)
- Ważność: S3 · Zasięg: całe miasto, najgęściej Stare Miasto
- Pomiar w całym mieście (660 budynków, 319 tablic lokali): 7 tablic lokali w sąsiedzie (G-159), 31 banerów `canyon-signs`, 3 holo i 1 `blade` w sąsiedzie (G-157), 17 latarni ściennych na tablicach (G-158), płyta „DEN…” o nieznanym źródle (G-160), markiza zasłaniająca dolny rząd liter z oczu gracza (G-161)
- Dowód: zrzuty `scratchpad/g148-shots/` (g148-e/f/h/j przy OKRUSZEK, g148-k przy STAJNIA SMAKU, g148-r2/r4 na Rynku), pomiary `scratchpad/g148-measure.json`, `g148-venue.json`
- Proponowane kontrole skanu (baza dziś): `venue-board-in-neighbour` 7, `banner-in-neighbour` 31, `holo-or-blade-in-neighbour` 4, `wall-lantern-over-venue-board` 17
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import

### G-043 Zatwierdzona migawka NPR nie zgadza się z tym, co rysuje main
- Status: zamknięte (1.11, orkiestrator): migawka przepisana od zgłoszenia co najmniej 5 razy (ostatnio #153); na main 1592dab `npr-perf` „reference” z `maxDiffPixelRatio: 0` (próg piksela 0,2) przechodzi 2/2, więc klatka main zgadza się z migawką; tolerancja 0,02 zostaje jako zapas na SwiftShader
- Ważność: S3 (proponowana: migawka przestaje pilnować wyglądu) · Koszt: mały
- Dowód: naprawiacz i weryfikator G-030: `e2e/__snapshots__/npr-perf.spec.ts/reference-m0.png` różni się od deterministycznej klatki main (b5507ce) o 39 806 px poza Seki (bbox 0,0–1280,533); m.in. brak białej smugi odblasku na lewym oknie Neon Koi (y ok. 290). Test przechodzi tylko dzięki `maxDiffPixelRatio: 0.02`. Ustalić, który commit zmienił klatkę: regresja czy niezaktualizowana migawka.
- Pakiet właściciela: packages/engine / e2e (QA)

### G-179 Posiłki ochrony przy heacie poza zapisem
- Status: naprawione (1.11, #165: zapis v23 z `reinforcements`, `watch.sent`, rozrzut i enforcer z `n` zamiast id; złote hashe tylko przez posiłki w zapisie; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: encje `security` bez klucza i `session.watch.reinforce` nie wchodzą do zapisu; `stateHash` nie widzi encji bez klucza
- Dane: alleySim seed 21, `heat {level 2, faction hebi, lastKnown ALLEY_START}`, krok do pojawienia się posiłków i 30 dalej, zapis: oryginał 1 posiłek, `reinforce=3.5`; wczytana gra 0 i od razu nowy gdzie indziej; rozjazd w 130. kroku
- Pakiet właściciela: packages/sim, packages/persistence

### G-189 Radziwiłłowska: jedno auto na sześć miejsc postojowych
- Status: naprawione (1.11, #162: ulga za krawężnikiem tylko dla mebli, pełny odstęp od chodnika, krótszy model w zatoce; `bay-strip-sparse` 1 → 0; `PARKED_CARS` 72 → 80; dwie rundy weryfikacji, kurator ZGODNE Z UWAGAMI, T-102..T-104, T-107, T-108)
- Ważność: S4 · Zasięg: w883991779 ma 1 auto na 6 stanowisk; bay s=36 odrzuca `furnitureClearance` 0,75 m przy nosie (mebel w obrysie pasa), s=39 `clearOfKeptWays` (ścieżka w obrysie), s=30 i 33 pomija hash zajętości 0,8
- Poprawka: sprawdzić mebel i ścieżkę w obrysie postoju (czy to błąd danych gry, czy OSM); ewentualnie meble poza obrysem pasa postojowego
- Uwagi: kontrola `bay-car-orientation` bierze kierunek pasa z najdłuższej krawędzi obrysu, w Ciasnej w227679486 ta krawędź biegnie w poprzek ulicy (kontrola słaba); dla pasa bez tagu łapie tylko auta > 75°
- Z weryfikacji #158: skan i generator mają różne reguły dla pasa ≥ 4,5 m bez tagu (skan liczy auto w poprzek jako znalezisko, generator cofa się do układu w poprzek, gdy skośny się nie mieści); auto Ciasnej (628,96; 551,62) stoi pod 2,4° do najbliższej ulicy z ruchem aut; fallback `perpendicular` chroni tylko test jednostkowy `bayLayouts`
- Kurator #158: mebel (parkometr n9596788047) i chodnik o szerokości 2,5 m są prawdziwe i stoją za krawędzią pasa; w Lublinie zajęte są wszystkie 6 zatok; poprawka przez marginesy (np. przy nosie jak `KERB_GAP` dla mebla i chodnika poza obrysem), bez usuwania danych (T-104). Proponowana kontrola: pas OSM ≥ 15 m, mniej niż 50% zatok możliwych przy `BAY_STEP` po odjęciu hasha zajętości, odrzucenia tylko przez mebel lub chodnik spoza obrysu (baza ok. 1)
- Pakiet właściciela: packages/sim (parked-cars, kerb-bays), tools/glitch-scan

### G-160 Neon DENKI (i KARAOKE, SAKE) osiowy na ukośnej ścianie: koniec w murze, koniec w powietrzu
- Status: naprawione (1.11, #161: oś bliższa ścianie, płyty 0,55 m pionowo 0,16 m od ściany, SAKE z narożnika na płaski odcinek; `neon-off-wall` z częścią płyty w bryle ≤ 15%, 3 → 0; dwie rundy weryfikacji). Opcja B (`yaw` w widoku `neon`, ADR) dla szerszych płyt na skośnych ścianach zostaje do decyzji
- Ważność: S3 · Zasięg: lokalny (Rynek/Grodzka, trasa kanału Tetsu, widoczne z deptaka) · Koszt: mały
- Gdzie: DENKI (567,3; −24,9) y 4,1, odsunięcie końca od ściany 1,95 m; KARAOKE (554,0; −33,8) 2,41 m; SAKE (545,0; −74,0) 0,45 m; w mieście 3 z 8 neonów przy ścianach
- Dowód: kąt osi płyty do stycznej ściany 51°/53°/46°; zrzuty `scratchpad/g160-shots/g160-h.png`, `g160-i.png`
- Przyczyna: `facadeNeon()` (`packages/sim/src/content/district-kanal.ts`) zamienia `againstWall().yaw` na `facing` o jednej z czterech osi; widok `neon` (`packages/core/src/ports/types.ts:195`) nie ma obrotu, a ściana jest ukośna
- Poprawka: A (teraz) dane: przestawić albo skrócić trzy neony na płaski odcinek ściany; B (później, ADR) opcjonalny `yaw` w widoku `neon`
- Test przyjęcia: kontrola skanu `neon-off-wall` (baza 3 → 0)
- Pakiet właściciela: packages/sim (district-kanal.ts), tools/glitch-scan

### G-187 Auta w głębokich pasach postojowych bez `orientation` w poprzek zamiast skośnie
- Status: naprawione (1.11, #158: pod 60°, rozstaw 3,0 m, nosem do chodnika; `PARKED_CARS` 75 → 72; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-103 poprawione, T-104)
- Ważność: S4 · Zasięg: 2 pasy: Krakowskie Przedmieście w55897048 (15 aut, w rzeczywistości ok. 60°), Radziwiłłowska w883991779 (1 auto, w rzeczywistości 6 miejsc ok. 65–70°), nosem do chodnika (ortofoto PZGiK)
- Poprawka (do wyboru): (a) domyślny układ dla obrysu ≥ 4,5 m bez tagu `diagonal`; (b) kąt `diagonal` parametrem (60° zamiast 45°); (c) tabela `KERB_ORIENTATION` w `sites.ts` ze źródłem albo `orientation=diagonal` w OSM i ponowny import; z (c) kontrola „auto poza ±20° od kąta z tabeli”, baza 0
- Uwagi z weryfikacji #152: test pasa bez tagu nie sprawdza, że pas płytszy niż 4,5 m trzyma auta wzdłuż; układ `diagonal` nie ma auta na danych (tylko test `bayYaw`); kierunek auta na Ruskiej (963,8; 473,0) ze stycznej osi zamiast krawędzi obrysu (4–7°); `offKerbParks` zagęszcza punkty trasy przy przesunięciach kilku cm (18 → 604); `clearRun` odrzuca odsunięty odcinek krakowskie-2-1-square-1, przyczyna nieustalona
- Pakiet właściciela: packages/sim (kerb-bays.ts, crowd-kerb-parks.ts)

### G-178 Strażnicy nieudanej infiltracji znikają po wczytaniu
- Status: naprawione (1.11, #150: `endedContract` i `formerContracts` w zapisie v22, `completed` z chwili rejestracji, czyszczenie zastąpionych zleceń, unikalność id; trzy rundy weryfikacji). Otwarta decyzja projektowa użytkownika: szablony zakończonego zlecenia respawnują nietkniętych strażników przy ponownym wejściu na teren, aż do następnego zlecenia (tak było przed poprawką)
- Ważność: S2 (zapis pozwala uciec z walki) · Zasięg: kontrakt infiltrate zakończony alarmem (`contracts.active` null), strażnicy `c3-*` (5 encji) dalej walczą; po wczytaniu ich nie ma
- Dane: seed 77, `completed: 2`, gracz w `docks(6,0,110)`, 30 kroków, `accept-contract infiltrate`, teleport 6 m przed `c3-g1`, kroki do alarmu i 60 dalej, zapis; w 1. kroku oryginał: gracz ginie (hp 0), wczytana gra: hp 84
- Przyczyna: konstruktor `Simulation` rejestruje kontrakt tylko przy `status==="active" || hasAmbush`
- Pakiet właściciela: packages/sim, packages/persistence

### G-182 `MapEntries.neighboursNear` bez własnego testu
- Status: naprawione (1.11, #155: test na prawdziwym `MapEntries`, pada przy zawężonym zapytaniu indeksu)
- Ważność: S4 (test) · Zasięg: skan i test jednostkowy G-170 używają kopii logiki odsiania, więc ścieżki gry (`map-entries.ts`) nic nie pilnuje; dziś poprawna (sonda: 7298 czworokątów identycznych z `near` i bez)
- Poprawka: test `neighboursNear` na prawdziwym `MapEntries` (sąsiad na granicy komórek, ściana skośna, sąsiad wyższą częścią)
- Pakiet właściciela: packages/engine (mapcity)

### G-177 Auta na pasach postojowych OSM równolegle na środku głębokości obrysu
- Status: naprawione (1.11, #152: auta przy krawężniku i w poprzek, tłum 1 m od pasów; kontrole `bay-car-out-of-park` 1 → 0, `bay-car-orientation` 1 → 0, `crowd-lane-on-parking` 3 → 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102, T-103)
- Ważność: S4 · Zasięg: auta z `bayCars` (`tools/osm-import/src/parked-cars.ts`): Kowalska w232362980 (683,7; 161,0) odsunięta 0,8 m ku jezdni (narożniki 0,31 i 0,56 m poza obrysem), bo trasa tłumu `stare-miasto-1-1-square-2` biegnie po krawężniku pasa; obrysy 4,7–8 m głębokości (Ruska w1024029951, Radziwiłłowska w883991779, Ciasna w227679486) i Kalinowszczyzna w1000912163 (`orientation=perpendicular`, 4–5 miejsc) mają po jednym aucie równolegle
- Poprawka: auto przy zewnętrznej krawędzi obrysu (krawężnik), w obrysie ≥4,5 m albo z `orientation=perpendicular|diagonal` w poprzek (tag `orientation` do `CarParkOut`); trasa tłumu na osi chodnika w173566577; kontrole skanu `bay-car-out-of-park` (baza 1), `bay-car-orientation` (baza 1), `crowd-lane-on-parking`
- Uwaga: `offMultiLaneKerbs` nie patrzy na stronę ulicy; na drogach 1+2 (Krakowskie w154962958, Lubartowska, Radziwiłłowska w331453920) wyklucza też krawężnik od strony jednego pasa; dziś bez skutku
- Pakiet właściciela: tools/osm-import, packages/sim (crowd), tools/glitch-scan

### G-184 Szkielety modeli przybywają przy każdym cyklu nowa gra / clear
- Status: naprawione (1.11, #151: szkielet postaci proceduralnej zwalniany z rigiem; szkielety po clear 34/43/52/61 → 25 stale; pula VRM zamierzona, ograniczona szczytem jednoczesnych postaci; weryfikacja PRZYJĘTE)
- Ważność: S3 do potwierdzenia (możliwy wyciek pamięci) · Zasięg: liczba szkieletów w scenie rośnie o 12 na cykl newGame/clear (67 → 79) na NullEngine z modelami VRM; sprawdzić, czy to zamierzona pula
- Poprawka: dispose szkieletów postaci przy clear (`CharacterViews`) albo udokumentowana pula; test sesji: dwa cykle, ta sama liczba szkieletów
- Pakiet właściciela: packages/engine (renderer)

### G-173 Latarnie ścienne w przejazdach bramnych i szczelinach
- Status: naprawione (1.11, #147: kontrola `wall-lantern-in-building` 4 → 0, rozstawienie 3774 → 3770, 1 latarnia przesunięta przy Wieży Trynitarskiej; piąta zgłoszona (Grodzka 20, (653,4; 80,8)) wisi przed fasadą, szczeliny w danych nie ma; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI)
- Ważność: S4 · Zasięg: 5 latarni: przejazd Bramy Krakowskiej (475,2; −90,1), Bramy Grodzkiej (713,5; 138,9), (718,6; 144,5), Ku Farze pod Grodzką 14 (621,8; 40,4), szczelina Grodzka 18/20 (653,4; 80,8); 4 były przed #137, (621,8; 40,4) wróciła w #137 przez odstęp od przesuniętej sąsiadki
- Przyczyna: linia planu `lamps.stare-miasto-wall` (rozstaw 15 m) stawia latarnie na osi dróg `tunnel=building_passage`; głowica 3,1–4,5 m wchodzi w sklepienie (4–4,2 m); `furniture-in-building` pomija `lamp-wall-lantern`
- Poprawka: linia planu nie stawia latarni ściennej w obrysie budynku ani w pasie 2 m wokół osi `building_passage`; kontrola skanu `wall-lantern-in-building` (baza 4 → 0); przy okazji latarnia KUCHNI POD KOPYTEM może przejść na sąsiednią ścianę Grodzkiej 20
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-170 Neonowe rurki pod gzymsem wchodzą w sąsiednie budynki
- Status: naprawione (1.11, #148: rurki tylko na wolnych odcinkach ściany, odsianie sąsiadów; skan `tube-in-neighbour` 65 → 0; weryfikacja PRZYJĘTE)
- Ważność: S4 · Zasięg: 58 rurek w 49 budynkach (`tubes` w `sign-plan.ts`), w większości ukryte w bryle sąsiada
- Poprawka: rurka kończy się przed sąsiadem wystającym przed ścianę (to samo `sign-room` co banery z G-157); kontrola skanu z bazą
- Pakiet właściciela: packages/engine (sign-plan.ts)

### G-174 Zapis i wczytanie nie odtwarzają stanu przy kontrakcie infiltrate
- Status: naprawione (1.11, #145: `ai.suspicion` w zapisie v21, pola pochodne sesji odtwarzane przez `resumeSession`; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: każdy aktywny kontrakt infiltrate przy strażnikach z widzeniem stożkowym, nie tylko `time_limit`; bez kontraktu rozjazdu nie ma
- Dane: `Simulation.create({ seed: 4242 })`, `fromSnapshot` z `contracts: { active: null, completed: 5 }` (albo 0), `teleportPlayer(sim, docks(0, 0, 120))`, 30 kroków, `accept-contract infiltrate`, 1 krok, zapis i `fromSnapshot`, oba przebiegi krokowane razem: hash równy zaraz po wczytaniu, rozjazd w 42. kroku (`rngState`, strażnicy c6-g* zaalarmowani tylko w oryginale)
- Przyczyna: `ai.suspicion` (np. c6-g3 = 0,0229) i `ai.sees` nie wchodzą do zapisu, po wczytaniu podejrzliwość startuje od 0; różnią się też pola sesji `watch`, `street2`, `interior`
- Poprawka: podejrzliwość i widzenie strażników (oraz brakujące pola sesji) w zapisie albo świadoma decyzja, że wczytanie zeruje czujność; zmiana schematu z migracją; test zapis–wczytanie z tym scenariuszem
- Pakiet właściciela: packages/sim, packages/persistence

### G-155 Auta przy krawężniku na ulicach wielopasowych bez parkowania
- Status: naprawione (1.11, #143: kontrola skanu do 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102 i G-177)
- Ważność: S4 · Zasięg: 3 Maja w40050974/w757848901 (x −116..−103, z −33..32): 13 aut 4,1–5,4 m od osi, na skrajnych pasach (`lanes=4`, brak `parking:*`)
- Poprawka: bez parkowania przy krawężniku dróg z `lanes>=4` albo `lanes:forward|backward>=2` poza `amenity=parking`; kontrola skanu `parked-car-multilane-kerb`, baza 13 → 0
- Pakiet właściciela: packages/sim (parked-cars), tools/glitch-scan

### G-156 Auta na przystankach
- Status: naprawione (1.11, #143: kontrola skanu do 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102 i G-177)
- Ważność: S4 · Zasięg: przystanek „Plac Litewski 02” (słupek n836158674 (−100.3, 3.6)): van 0,7 m, van 11,7 m, hatchback 13,1 m od słupka po stronie przystanku
- Poprawka: zakaz postoju do 15 m od słupka (art. 49 PoRD); kontrola skanu `parked-car-at-bus-stop`, baza 3 → 0; przy okazji `path=sidewalk` poza `footWays` i `pedestrian`/`cycleway` w `parked-car-on-footway`
- Pakiet właściciela: packages/sim (parked-cars), tools/osm-import, tools/glitch-scan

### G-171 Odroczona zmiana poziomu trudności ginie przy zapisie
- Status: naprawione (1.11, #142: czekający profil w zapisie, schemat v20 z migracją; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: zmiana poziomu w walce („Zmieni się po walce”), potem zapis i wczytanie przed końcem walki
- Przyczyna: `pendingDifficulty` nie wchodzi do zapisu (etap 1); po wczytaniu gracz jest na starym poziomie bez informacji, a slot ma etykietę starego
- Poprawka: odroczony profil w zapisie (zmiana schematu: `SAVE_SCHEMA_VERSION` + migracja + test) albo zastosowanie go przy zapisie; test sesji
- Pakiet właściciela: packages/sim, packages/persistence

### G-158 Latarnie ścienne zasłaniają tablice lokali
- Status: naprawione (1.11, #137: niezależna kontrola 14 → 0, latarnie ścienne prostopadle do ściany; weryfikacja w 2 rundach, kurator zgodne)
- Ważność: S3 · Zasięg: 17 z 169 latarni ściennych, np. WIEJSKI RAJ (564,0; −88,9), KORZEŃ CZAROWNICY (611,4; −74,9), PUB ZA KURTYNĄ (599,6; −2,6); zrzuty g148-r2-rynek-e, g148-r4-rynek-s
- Przyczyna: rozstaw `lamp-wall-lantern` (ADR-0047) nie zna tablic lokali (ADR-0064 etap 4); markiza je zna (`venueBoardOn`)
- Test przyjęcia: `wall-lantern-over-venue-board` 17 → 0
- Pakiet właściciela: tools/osm-import (props-gen), packages/engine

### G-159 Tablica lokalu wchodzi w sąsiedni budynek
- Status: naprawione (1.11, #138: tablica w wolnym odcinku ściany, skan 7 → 0)
- Ważność: S3 · Zasięg: 7: KUCHNIA SPOD ARARATU (600,8; −21,8), ZIELONY CZAROWNIK (168,0; −99,2), SZAFA PÓŁWIECZE (112,5; −111,8), ZJEDZ I ZNIKAJ (622,2; −6,8), WULKANIZACJA PIASTA (580,9; 552,6), KAMBUZ (828,6; 496,4), KLUB ZEBRANIE (205,8; −105,3)
- Przyczyna: `venueBoards` (`venue-plan.ts`) mieści tablicę w ścianie z marginesem 0,3 m, bez sprawdzenia sąsiada przed płaszczyzną ściany
- Test przyjęcia: `venue-board-in-neighbour` 7 → 0
- Pakiet właściciela: packages/engine (venue-plan.ts)

### G-157 Banery, holo-reklamy i wysięgniki wchodzą w sąsiednie budynki
- Status: naprawione (1.11, #138: banery, holo i wysięgniki poza sąsiadem, skan 33 i 4 → 0; wąskie wieże zachowują holo)
- Ważność: S3 · Zasięg: 31 banerów w 29 budynkach, 3 holo, 1 `blade`; np. (−190,6; −3,3), (195,5; −98,8), (228,3; −39,9), (309,8; −70,8); holo (577,3; 540,8), (494,9; −140,2); `blade` (578; 161,6)
- Przyczyna: `banners` w `canyon-signs.ts` (1,2 m od końca ściany, 1 m od niej) i `holos` (0,45 m) nie sprawdzają, czy sąsiad wystaje przed płaszczyznę ściany
- Test przyjęcia: `banner-in-neighbour` 31 → 0, `holo-or-blade-in-neighbour` 4 → 0
- Pakiet właściciela: packages/engine (canyon-signs.ts, sign-plan.ts)

### G-164 Menu postaci zmienia broń przy niesieniu ciała
- Status: naprawione (1.11, #134, 7b27ff1: przy niesieniu ciała `equip-item`/`unequip-item` nie ruszają slotów broni; test w `takedown-carry-limits.test.ts`)
- Ważność: S4 · Zasięg: komendy `equip-item` i `unequip-item` z menu postaci przy `carrying`
- Objaw: z ciałem na ramieniu menu dobywa albo chowa broń (sonda S7), choć ADR-0065 mówi „bez zmiany broni”; broń nie strzela, więc skutek mały
- Poprawka: odrzucić `equip-item`/`unequip-item` broni przy niesieniu (albo zablokować przycisk w menu), test sesji
- Pakiet właściciela: packages/sim, packages/ui

### G-165 `BodyFound` emitowane przy każdym nowym oglądającym zwłoki
- Status: zamknięte jako zamierzone (1.11, orkiestrator): `BodyFound { body, finder }` to „ten NPC znalazł ciało”; każdy NPC ogląda ciało raz (`lookedBy`), więc para ciało–znalazca się nie powtarza, a kolejne znalezienia są potrzebne (patrol zgłasza zwłoki po przechodniu; 8 testów stage 2–3 na tym stoi). UI, które zechce jednego zdarzenia na ciało, filtruje po `body`
- Ważność: S4 · Zasięg: każde zwłoki oglądane przez kilku NPC (np. przechodzień, potem patrol)
- Poprawka: jedno `BodyFound` na ciało albo jawne pole „pierwszy znalazca”, zanim UI zacznie z niego korzystać
- Pakiet właściciela: packages/sim (body-watch)

### G-152 Kontenery w ogrodzonym parku na Nabrzeżu
- Status: naprawione (1.11, #124: 6 kontenerów na Giełdzie na Kresowej, park pusty; dalej G-169)
- Ważność: S3 · Zasięg: 5 z 8 kontenerów w parku w154191322 (`leisure=park`, `natural=scrub`, `barrier=fence`), jeden w poprzek płotu
- Poprawka: kontenery poza parkiem, najlepiej na Giełdzie na Kresowej (plan ulic: „kontenery Tessen”); kontrola skanu „mebel w obrysie `leisure=park`/`natural=*` albo na `barrier=fence`”
- Pakiet właściciela: tools/osm-import (props-bulky)

### G-151 Hydranty stawiane regułą zamiast z OSM
- Status: naprawione (1.11, #124: 6 hydrantów nadziemnych z OSM na węzłach, reguła usunięta)
- Ważność: S3 · Zasięg: 33 hydranty w grze, żaden w prawdziwym miejscu (mediana 143 m od najbliższego nadziemnego)
- Przyczyna: `filterOsm` (`tools/osm-import/src/osm.ts:151`) zostawia tylko węzły z `name`, a hydranty nazwy nie mają; żywe OSM ma w chunkach 77 (6 `pillar`, 71 podziemnych, import z 2015 z `ref`)
- Poprawka: hydranty nadziemne z OSM (do 3 m od węzła), podziemne świadomie pominięte albo jako pokrywa; kontrola skanu „hydrant dalej niż 3 m od `pillar` z OSM”
- Pakiet właściciela: tools/osm-import

### G-149 Pomniki i rzeźby z OSM mają przypadkowy kształt
- Status: naprawione (1.11, #132, 67fc8a1; weryfikator PRZYJĘTE, kurator zgodne z trzema nieblokującymi uwagami → G-166…G-168, T-096…T-100); skan `monument-shape-off-tags` 48 → 0; uwaga weryfikatora: kontrola przepuszcza każdą stelę
- Ważność: S3 · Zasięg: 27 pomników i rzeźb z planu (`docs/world/lublin-props.todo.json`) i wszystkie `memorial`/`artwork` z OSM
- Przyczyna: ADR-0047 bierze pozycję z OSM, ale kształt z hasha id (`variant`, `SHAPES.monument = 4`): obelisk, postać na cokole, Koziołek albo abstrakcja; poza kilkoma wymuszonymi w planie prawdziwy pomnik dostaje losową bryłę (np. stos sześcianów albo postać na czarnym bloku w wąskiej uliczce)
- Poprawka: kształt z tagów OSM (`memorial=plaque|statue|bust|stone`, `artwork_type`, `historic`) i z ręcznej tabeli znanych pomników Lublina; tablica pamiątkowa na fasadzie zamiast wolnostojącej bryły; bez dopasowania: neutralna tablica albo kapliczka, nie abstrakcja; przegląd kuratora
- Pakiet właściciela: tools/osm-import (props-kinds, props-gen), packages/engine (prop-civic)

### G-143 Taksówki na osi chodnika przy Podzamczu
- Status: naprawione (1.11, #125, aee0832; weryfikator PRZYJĘTE, kurator bez zastrzeżeń)
- Ważność: S4 · Zasięg: taxi (928.6, 452.2) 0,01 m od osi `highway=footway` w809962786, taxi (922.9, 430.6) 0,80 m od niej
- Ustalone (1.11, orkiestrator, dane `data/osm/podzamcze.json`): w809962786 to samodzielna ścieżka piesza 52 m (`highway=footway`, bez `footway=sidewalk`/`crossing`, oświetlona, asfalt), co najmniej 7,8 m od osi Cerkiewnej i dróg serwisowych; łączy się z postojem taxi w471549002 (`amenity=taxi`, obszar), placem w66323033 (`area:highway`), chodnikiem w1517184174 i przejściem w1054556913. Taksówka 0,01 m od jej osi stoi więc na ścieżce pieszych obok postoju, nie na jezdni: glitch prawdziwy
- Poprawka: zaparkowane auta trzymają odstęp od osi samodzielnych ścieżek `footway`/`path` (poza `sidewalk` wzdłuż krawężnika), a taksówki z postoju `amenity=taxi` stoją wewnątrz jego obszaru; kontrola skanu „auto bliżej niż 1 m od osi ścieżki pieszej”
- Pakiet właściciela: packages/sim (content), przegląd kuratora

### G-145 Megabloki na zabytkach, w parku, nad Bystrzycą i na osiach widokowych
- Status: naprawione (1.11, #123, a56b621; weryfikator i dwa przeglądy kuratora)
- Ważność: S3 · Zasięg: wiele miejsc poza danymi miasta
- Gdzie: Stary cmentarz żydowski w40049437 (`near[19–21]`, `ring[15]`), Nowy cmentarz żydowski w792467989 (`ring[61]`), Ogród Saski w174005440 (`ring[77]`, `ring[78]`, `ring[34]`, `near[44–45]`), oś Bystrzycy r7577565 (`docks[9–11]`, `docks[15]`, `ring[10]`, `ring[42]` i bryły bliżej niż 50 m od osi); okno Placu Litewskiego na Wieżę Trynitarską i katedrę (azymut 101–109°: `near[13–14]`, `ring[10–11]`, `ring[51]`); panorama z Nabrzeża na Stare Miasto i Zamek (`near[17–18]`, `ring[14]`, `ring[54–55]`); 8 par wież nachodzących na siebie; dawna wieża „Zalew Zemborzycki” (−1200, −3700) 31 m od Bystrzycy w Wrotkowie
- Poprawka: obszary zakazane i okna widokowe w generatorze układu, testy `megablock-protected`, `megablock-overlap`, `megablock-viewaxis` z bazą 0
- Pakiet właściciela: packages/engine (renderer, mapcity)

### G-001 Test migawki NPR przekracza 90 s na wolnym runnerze CI
- Status: naprawione (#39). Tryb `?reference` rysuje dopiero przy gotowej scenie; migawka 18–42 s zamiast 72 s. Ryzyko szczątkowe: `still` nie czeka na `ProbeSchedule` (inwalidacja sondy < 1 s przed gotowością); zapas w pomiarach > 2,6 s.
- Ważność: S1 (czerwone CI) · Zasięg: każdy PR · Koszt: średni
- Gdzie: `e2e/npr-perf.spec.ts` „NPR reference frame matches the approved snapshot”, PR #28 (E2E 1/3, dwa razy)
- Dowód (pomiar lokalny, SwiftShader):
  - gotowość po ~18 s, `still` po ~27 s;
  - pierwszy `capture()` kończy się po ~60 s (`scene.render` 16 ms, `toDataURL` ~16 s, reszta to oczekiwanie na kolejkę GPU);
  - na `main` tak samo (~63 s);
  - zmniejszenie liczby klatek ustalania z 8 do 3 nie zmienia czasu.
- Przyczyna (przypuszczalna): praca GPU po zbudowaniu miasta wokół kadru (kompilacja shaderów, przesyłanie geometrii, klatki w kolejce) pod SwiftShaderem.
- Pakiet: `packages/app` (tryb referencyjny), `packages/engine`.
- Test przyjęcia: test migawki poniżej 45 s lokalnie, migawka bez zmian; limitu się nie podnosi.

### G-002 Dostawczak jedzie przez bramę Ku Farze z zakazem wjazdu
- Status: naprawione (#44) (naprawa orkiestratora: tylko bramy pod budynkiem z `motor_vehicle=no`; deptaki z `motor_vehicle=no` dalej obsługują dostawy zgodnie z ADR-0050)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: Ku Farze (616, 44), droga OSM 481583497 `motor_vehicle=no`
- Dowód: trasa `Ku Farze#66:d` biegnie przez przejście; importer nie zapisuje `motor_vehicle`.
- Pakiet: `tools/osm-import` (ulice), `packages/sim` (`roads.ts`)
- Test przyjęcia: żadna trasa dostaw nie biegnie odcinkiem z `motor_vehicle=no`.

### G-005 Wiata przystanku wchodzi w ścianę przy Alei Tysiąclecia
- Status: duplikat (G-011)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (709, 335)
- Dowód: skan `furniture-in-wall` = 1.
- Pakiet: `tools/osm-import` (meble przy ścianach stawiane z `ON_BUILDINGS`)

### G-008 Budynki z OSM wchodzą w sceny targu i doków
- Status: naprawione (#33)
- Decyzja orkiestratora: budynek znika, gdy przecina pełny blok sceny albo ponad 25% jego powierzchni leży w prostokątach; Dworzec Autobusowy (2,6%, bez kolizji) zostaje. Znikają w1354195809 i „Hunek” w458298766.
- Ważność: S3 · Zasięg: lokalny · Koszt: mały
- Gdzie: w1354195809 przy dokach (2595, 391), wbity w ścianę doków i 1,2 m nad wyrównanym placem; „Hunek" w458298766 (817, 373,5) we wschodniej ścianie targu; w66264171 (789, 396) na placu targu
- Dowód:
  - pomiar siatką 0,5 m (obrysy przecięte z `CLEARED_BUILDINGS` i blokami scen);
  - zrzut `doki-east-wall.png`.
- Przyczyna: `CLEARED_BUILDINGS` usuwa budynek tylko wtedy, gdy jego środek leży w prostokącie (`places.ts` i warstwa rysowania).
- Pakiet: `packages/sim` (`lublin/places.ts`, `sites.ts`, scenografia)
- Test przyjęcia: żaden budynek zostający w grze nie przecina pełnego bloku sceny ani nie leży w prostokątach w ponad 25%; kontrola `building-in-set-piece` w skanie = 0.

### G-009 Auta zaparkowane przy krawężniku stoją na trawniku i chodniku
- Status: naprawione (#31)
- Ważność: S3 · Zasięg: szeroki · Koszt: mały
- Gdzie:
  - Ruska (1071,6, 460), (1067,2, 464,1);
  - Kowalska (533,9, 173,6);
  - Cerkiewna (909–927, 361–406), 8 aut;
  - Nowy Plac Targowy, Nadstawna, 2 w krakowskie-0-0.
- Ile: 19 ze 118 aut ma co najmniej 3 z 5 punktów obrysu poza jezdnią, placem albo parkingiem.
- Dowód: pomiar `surfacesAt`; zrzuty `ruska-b.png`, `kowalska-van.png`, `cerkiewna.png`.
- Przyczyna: `kerbCars()` stawia auta na odsunięciu z mediany szerokości całej ulicy; `fits()` nie sprawdza nawierzchni.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: rogi i środek każdego auta na `road`, `cobble`, `square` albo `parking`; kontrola `parked-car-off-road` w skanie = 0.

### G-010 Brama przy północnej krawędzi mapy kończy się w pustce, posadzka wznosi się o 2,4 m
- Status: naprawione (#31)
- Ważność: S4 · Zasięg: rzadki · Koszt: mały
- Gdzie: kamienica w232674407 (38, 159), przejście (46, 157.2) → (30.7, 161)
- Dowód:
  - koniec przejścia leży poza chunkami (z > 160), gdzie `groundY` = 0;
  - posadzka biegnie od −2,43 do 0, sklepienie ma 6,4 m nad gruntem;
  - gracz staje na krawędzi świata;
  - zrzuty `/tmp/gh-a/01-brama-edge.png`, `10-edge-passage-in.png`.
- Pakiet: `tools/osm-import` (`passages.ts`)
- Test przyjęcia: oba końce każdego przejścia z `PASSAGES` leżą w granicach chunka.

### G-011 Meble wewnątrz budynków: reflektory w Wieży Trynitarskiej, Archikatedrze i przy Zamku, kioski w swoich budynkach, wiata w ścianie
- Status: naprawione (#32)
- Uwaga weryfikatora: `SINGLE_OUTLINE` obejmuje też `bus-stop` i `vending-machine`, więc reguła „centroid obrysu jest budynkiem → bez mebla” może kiedyś po cichu usunąć przystanek z obrysu (dziś nic takiego nie znika; przystanki zasilają `stopsAlong` trolejbusów).
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie:
  - reflektory: (597, −152), (605, −175), (620, −190), (846, 222/240/258), (890, 205);
  - kioski: w66330705 (291.4, −115.9), w458298771 (835.9, 373.5);
  - wiata: (709, 335) (dawne G-005).
- Dowód:
  - `inBuilding` dla 7 reflektorów i 2 kiosków; środki do 7,8 m w głąb;
  - zrzut `/tmp/gh-a3/13-katedra-floodlights.png` (brak reflektorów u fasady).
- Przyczyna: `floodlight`, `kiosk` i `bus-shelter` są w `ON_BUILDINGS` generatora mebli, więc nie dotyczy ich `offWall` ani kontrola głębokości. Kiosk stawiany w centroidzie obrysu, który importer wciąga też jako budynek.
- Pakiet: `tools/osm-import` (`props-gen.ts`), dane w `docs/world/lublin-props.todo.json`
- Test przyjęcia: kontrola `furniture-in-building` w skanie (środek mebla głębiej niż 0,5 m w budynku) = 0.

### G-012 Meble z bryłą nachodzą na siebie: kosze w pniach drzew na deptaku
- Status: naprawione (#35). Kontrola `furniture-overlap` liczy nachodzenie brył > 5 cm; para kandelabr–szafka (734, 215) miała 0,8 cm (modele tylko się stykają), więc skan jej nie liczy, a generator i tak ją rozsunął.
- Ważność: S4 · Zasięg: szeroki · Koszt: mały
- Gdzie:
  - kosze (175.5, −48.6) i (288, −73.3) w pniach drzew z OSM;
  - stragan i automat (705, 267);
  - kandelabr i szafka (734, 215).
- Dowód: odległość środków 0,14 i 0,20 m przy promieniach 0,3 + 0,3.
- Przyczyna: `placeStreetGroup` (`props-streets.ts`) nie omija innych mebli.
- Pakiet: `tools/osm-import`
- Test przyjęcia: kontrola `furniture-overlap` w skanie = 0 (meble z bryłą, poza słupkami).

### G-013 Narzędzie zrzutów: kadr przesunięty o jedno miejsce albo powtórzony
- Status: naprawione (#37). Spec czeka na `frames() > n` po `step` i asertuje pozę kamery (pozycja 3 m, yaw i pitch ±0,01; zakłada FPP i stojącego gracza).
- Ważność: S3 (proces: fałszywe dowody łowców) · Zasięg: każde polowanie · Koszt: mały
- Gdzie: `e2e/glitch-shots.spec.ts`
- Dowód:
  - u łowcy Podzamcza pierwsza seria przesunięta o jeden kadr;
  - u łowcy Krakowskiego dwa różne punkty dały identyczny zrzut.
- Przyczyna (przypuszczalna): `citySettled()` jest już prawdą z poprzedniego miejsca, zanim ruszy streaming nowego.
- Pakiet: `e2e` (QA)
- Test przyjęcia: dwa różne punkty dają różne zrzuty, a kadr odpowiada pozycji gracza (np. zapis pozycji kamery obok zrzutu).

### G-014 Auta zaparkowane na przejściach dla pieszych
- Status: naprawione (#32)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie:
  - (−104,9, 35,2) van, 12/153 punktów obrysu na zebrze;
  - (−111,8, −42,2) dostawczy, 44/153;
  - (920,4, 469,2) hatchback, środek na zebrze.
- Dowód: sonda weryfikatora G-009 (153 punkty obrysu na auto). Auta stały tam przed G-009.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: kontrola `parked-car-on-crossing` w skanie = 0 (żaden punkt obrysu na `crossing`).

### G-015 Auta zaparkowane tyłem do ruchu na ulicach jednokierunkowych
- Status: naprawione (#34)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: 10 aut, m.in. Lubartowska (449,9, 40,7), Aleja Tysiąclecia (920,0, 329,9), Nowy Plac Targowy, Nadstawna
- Dowód: sonda weryfikatora G-014 (kierunek auta wobec najbliższej osi ulicy; do potwierdzenia).
- Przyczyna: `kerbCars()` w `parked-cars.ts` nie patrzy na `oneway` i stawia auta przy obu krawężnikach w obu kierunkach.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: na ulicy jednokierunkowej każde zaparkowane auto stoi przodem w kierunku ruchu.

### G-017 Wiaty przystanków z OSM jako trzypiętrowe bloki mieszkalne na Alei Tysiąclecia
- Status: naprawione (#34)
- Ważność: S3 · Zasięg: lokalny · Koszt: mały
- Gdzie: w672635874 (709,5, 335,3) i w672635872 (781, 365,1), po 3 kondygnacje i 9,7–9,8 m; w672635873 3,3 m
- Dowód: raport naprawiacza G-011 (obrysy `amenity=shelter` + `building=yes` budowane jako `residential`).
- Pakiet: `tools/osm-import` (`building-tags.ts` / `buildings.ts`), wymaga `pnpm osm:build`
- Test przyjęcia: budynek z `amenity=shelter` (lub `building=roof`/`shelter`) ma wysokość wiaty (≤ 3,5 m, jedna kondygnacja) albo staje się meblem `bus-shelter`.

### G-019 Auto z jednokierunkowej pętli Cerkiewnej stoi na trzypasmowej jezdni Alei Tysiąclecia
- Status: naprawione (#36). Luka skanu do domknięcia osobno: auto przy krawężniku bez rozpoznanej ulicy (> 12 m albo > 20°) jest pomijane, a auto wjechane na inną ulicę osiedlową uznawane za stojące przy niej; generację chroni `offOtherRoads`.
- Ważność: S3 · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: (920,02, 329,90), hatchback; 1 na 81 aut w mieście
- Dowód: 2,49 m od osi „Aleje Tysiąclecia” (OSM way 739432828, primary, 3 pasy), kąt 35°; pętla Cerkiewnej (ways 66322976, 422659195) leży 7–13 m od osi Alei bez pobocza.
- Przyczyna: `roadHalfWidth()` (`traffic.ts:102`) skanuje każdą nawierzchnię jezdni, więc lewy krawężnik pętli trafia za Aleję (limit 9 m) i `parked-cars.ts:155` stawia auto na pasie Alei; `fits()` sprawdza tylko pasy `TRAFFIC_ROUTES`, a odcinek Alei (36,4 m < `MIN_ROUTE` 45) nie ma pasa.
- Pakiet właściciela: packages/sim (`content/parked-cars.ts`)
- Test przyjęcia: kontrola skanu `parked-car-on-other-road` (auto przy krawężniku w zasięgu nawierzchni innej drogi dla aut + 0,5 m; własna ulica wyznaczana w skanie, nie z pola poprawki) daje 0; dziś 1.

### G-020 Jezdnia zachodnia Alei Tysiąclecia ma 36 m bez pasa (literówka „Aleje” w OSM)
- Status: naprawione (#38)
- Ważność: S2 · Zasięg: szeroki (trasa główna) · Koszt: mały
- Gdzie: (930,3, 331,4)–(894,1, 335,1), `ROAD_CHAINS[91]`, OSM way 739432828; 1 w mieście
- Dowód: pasy #85/#86 kończą się w x 930, #82–#84 zaczynają w x 894. W symulacji (seed 3, 8:00, 90 s) auta stoją na końcu pasa z v = 0 i tworzą korek do 6 aut, w ramce naliczono 18 pojawień i 21 zniknięć. Łańcuch #82 (128,5 m < `MIN_TROLLEY` 150) traci trolejbus.
- Przyczyna: `tools/osm-import/src/labels.ts:26` przepisuje nazwę bez korekty; klucz łączenia w `content/lublin/roads.ts:71` zawiera nazwę, więc Aleja rozpada się na 3 łańcuchy. Martwy obejściowy wpis „Aleje Tysiąclecia” w `TROLLEY_STREETS` (`traffic.ts:62`).
- Pakiet właściciela: tools/osm-import (korekta nazwy) + regeneracja `content/lublin`
- Test przyjęcia: jeden łańcuch „Aleja Tysiąclecia” ok. 472 m; pas aut bliżej niż 2 m od (912, 333); trolejbus na jezdni zachodniej; kontrola skanu `car-road-hole` (krótki łańcuch między dwoma łańcuchami z pasami, ten sam rodzaj i oneway) daje 0, dziś 1.
- Uwaga: po złączeniu odcinek dostaje pas, a to może samo usunąć objaw G-019; przyczyna G-019 (krawężnik liczony przez cudzą jezdnię) zostaje osobna.
- Trop poza zakresem: 12 bezimiennych dróg dla aut odrzuconych przez import (`labels.ts:27`, m.in. primary_link 60149306, 232464399) może dawać podobne przerwy na łącznikach.

### G-021 Szwy chunków ucinają krótkie kawałki ulic: dziury w pasach aut (Narutowicza, Lubartowska ×2)
- Status: naprawione (#40). `street-seam-gap` 3 → 0, `lane-dead-end` 66 → 61. Pasy Świętoduska:0 i Narutowicza:f zaczynają się 0,8–1,3 m za krawędzią mapy (bez skutków, `car-lane-off-road` tego nie liczy).
- Ważność: S3 · Zasięg: lokalny (3 miejsca, 7 ślepych końców pasów) · Koszt: mały
- Gdzie: Narutowicza szew x = 240 ((238,3, −171,6)–(268,6, −161,6), #8 ma 30,3 m bez pasa); Lubartowska szew z = −20 (brak 4,2 m przy (442,2, −20)); Lubartowska szew z = 370 (brak 3,8 m przy (585, 366,5), #39 ma 9,3 m bez pasa)
- Dowód: łowca (pomiar `clipLineToRect`); `krakowskie.generated.ts:688` kończy Lubartowską na (442,2, −20), `:1492` zaczyna na (442,3, −15,8). OSM w40051392, w40050981, w60145297.
- Przyczyna (przypuszczalna): `tools/osm-import/src/labels.ts:33` (`lineLength(piece) < 5`) odrzuca kawałek przycięty na szwie; `JOIN` 0,6 m w `roads.ts` nie łączy przerwy.
- Pakiet właściciela: tools/osm-import + regeneracja `content/lublin`
- Test przyjęcia: kontrola skanu `street-seam-gap` (pary łańcuchów aut o tej samej nazwie z końcami 0,6–8 m od siebie, dalej niż 6 m od krawędzi mapy) daje 0; dziś 3.

### G-023 Pasy aut kończą się bez zawrotki przy ulicach dla dostaw i na końcach ulic
- Status: naprawione (#37) (częściowo: 7 z 13 końców, dwukierunkowe; 6 końców jednokierunkowych wydzielone do G-024). Skan `lane-dead-end` 75 → 68.
- Ważność: S3 · Zasięg: szeroki (13 końców, m.in. Lubartowska przy Starym Mieście) · Koszt: średni
- Gdzie: Lubartowska#37 (460, 56); Kowalska#76 (568, 160), #87 (668, 161); Królewska#19 (459, −156); Kapucyńska#10 (144, −97); Karmelicka#34 (293, 120); Staszica#35 (199, 28); Świętoduska#20 (350, −48); Kościuszki#4 (28, −103); Browarna#102 (532, 407)
- Dowód: łowca: żaden pas aut w promieniu 6 m od końca; sąsiedni łańcuch ma `use=deliveries` albo OSM ma tylko service/footway/parking. Auto w polu widzenia staje na końcu pasa (`traffic-system.ts:334`) i czeka.
- Przyczyna (przypuszczalna): `turnRound()` w `traffic.ts` paruje tylko pasy przecięte blokiem gry; koniec ulicy i zmiana `useOf` nie dostają zawrotki.
- Pakiet właściciela: packages/sim (`content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-dead-end` (koniec pasa w mapie, > 6 m od krawędzi, bez początku pasa zgodnego kierunku w 3 m); dziś 75, z czego 33 to G-006 i 2 to G-020; ta poprawka obniża o 13, baza tylko spada.

### G-028 Resynchronizacja przenosi auto w łuk zawrotki z pełną prędkością
- Status: naprawione (#38)
- Ważność: S3 · Zasięg: lokalny (każda zawrotka; widać po złączeniu Alei w G-020) · Koszt: mały
- Gdzie: Aleja Tysiąclecia, zawrotka przed targiem; seed 3: auto za trolejbusem spada ponad `RESYNC` za rozkład, poza wzrokiem przeskakuje z s=204,6 na s=244,8 (w łuku) i jedzie dalej 7,7 m/s przy `TURN_SPEED` 4
- Dowód: test „turns round before the market on Aleja Tysiąclecia” pada po G-020 (7,69 > 4,01)
- Przyczyna: `traffic-system.ts:296-299` ustawia `st.s` z rozkładu, ale zostawia prędkość auta
- Pakiet właściciela: packages/sim (`systems/traffic-system.ts`)
- Test przyjęcia: auto po resynchronizacji w łuku nie przekracza `TURN_SPEED`; test zawrotki bez złagodzenia przechodzi z G-020.

### G-029 Kliknięcie „Nowa gra” w `models.spec.ts` wisi ponad 60 s na CI
- Status: naprawione (#46). Kliknięcie „New Game” 12,7 s → 4,9 s przy podobnym load; po utracie kontekstu WebGL rysowanie wraca ( naprawa: `GpuPacer` w engine, najwyżej 2 klatki w kolejce GPU; ekran tytułowy 20 → 2 klatki przed płotem, `models.spec` 15–33 s; kryterium < 10 s do potwierdzenia na CI)
- Ważność: S1 (proponowana: czerwone CI, niestabilne) · Zasięg: każdy PR · Koszt: nieznany
- Gdzie: `e2e/models.spec.ts:16`, shard E2E 1/3
- Dowód: PR #37 (CI 41089511069) pada w obu próbach, PR #33 (CI 41069178665) przeszedł przy drugiej. Playwright: element widoczny i stabilny, „performing click action” bez końca, więc wątek strony zablokowany.
- Przyczyna (przypuszczalna): długa praca synchroniczna po „Nowa gra” (budowa świata, ubieranie postaci VRoid) pod SwiftShaderem; może ta sama kolejka GPU co G-001.
- Pakiet właściciela: packages/app / packages/engine (do ustalenia śladem)
- Test przyjęcia: ślad pokazuje, co blokuje wątek; kliknięcie wraca w < 10 s na CI bez podnoszenia limitu.

### G-032 Słupki przy ulicach stoją chaotycznie: łańcuchy celują w różne strony i nie łączą sąsiadów; słupki za małe
- Status: naprawione (#45). Na samym Placu Łokietka nie został żaden łańcuch: słupek z wylotu zebry usunięty, sąsiedni zabiera gra (przejście do Bramy Krakowskiej). (Latarnia jako ogniwo rzędu i wolne wyloty przejść dla pieszych, decyzje użytkownika)
- Ważność: S3 · Zasięg: szeroki (Plac Litewski, Krakowskie Przedmieście, deptak, Plac Łokietka; ok. 53 słupki z OSM) · Koszt: średni
- Dowód: model `bollard()` (`engine/.../mapcity/prop-street.ts:36`) ma stałe odcinki łańcucha ±1 m w lokalnej osi X, a obrót słupka nie wynika z rzędu, w którym stoi; odstępy w rzędach 1,9–2,8 m (`docs/world/lublin-props.todo.json`). Słupek 0,26 × 0,95 m.
- Pakiet właściciela: tools/osm-import (rzędy i obrót), packages/engine (model, łańcuch), packages/sim (`furniture.ts`, bryła)
- Test przyjęcia: słupki w rzędzie mają obrót wzdłuż rzędu; łańcuch łączy dokładnie sąsiednie słupki rzędu (koniec łańcucha przy sąsiedzie, bez wolnych końców w powietrzu); słupek większy (wymiary z dokumentacji/zdjęć Lublina), bryła w sim zgodna z modelem; migawka NPR obejrzana i świadomie zaktualizowana, budżety bez podnoszenia.

### G-033 Postać, która przechodzi w inne miejsce według flag, „umiera”: renderer gra upadek
- Status: naprawione (#46)
- Ważność: S2 · Zasięg: każda postać warunkowa (Kaito klinika → bar, cele wariantów kontraktów) · Koszt: mały
- Dowód: po `met_fixer` `Streaming.syncPresence` usuwa Kaito z kliniki; `RenderSync` (`presentation/render-sync.ts:101`) zgłasza `despawn(id, "removed")`, bo usunięcie nie jest w `streamedOut`, a `CharacterViews.despawn` z `fall` gra animację śmierci.
- Pakiet właściciela: packages/sim (`world/streaming.ts`, `presentation/render-sync.ts`)
- Test przyjęcia: test sesji: po ustawieniu flagi postać warunkowa znika z `despawn(..., "unloaded")`; zabity NPC dalej dostaje `"removed"`.

### G-034 Kaito od początku w Neon Koi (decyzja użytkownika)
- Status: naprawione (#46). Ume i barman wskazują Neon Koi. Zapis v16 z migracją; złote hashe replay i pojedynku zmienione przez wersję schematu i pozycję Kaito
- Ważność: S3 · Zasięg: prolog · Koszt: średni
- Zmiana: jedna postać Kaito w barze bez warunku `met_fixer`; prolog w `m0.ink` i cel HUD prowadzą z kliniki do Neon Koi; pierwsza rozmowa w barze.
- Pakiet właściciela: packages/sim (`content/district-m0.ts`), packages/narrative (`ink/m0.ink`), packages/app (`objective.ts`)
- Test przyjęcia: test sesji prologu: nowa gra w klinice, cel wskazuje Neon Koi, rozmowa z Kaito w barze ustawia `met_fixer` i daje zlecenie kuriera, Kaito się nie przemieszcza.

### G-035 Wskaźniki zadań nie prowadzą do postaci z wątku: nie da się znaleźć babci Ume
- Status: naprawione (#43). Cel kroku (`target`) i znacznik `quest` na minimapie i mapie miasta; poza wczytanym chunkiem znacznik na miejscu z harmonogramu. Uwaga weryfikatora: jeśli Ume zginie w kroku ren_trail (po „aya”), krok nie ma innej drogi ukończenia (do osobnego zgłoszenia).
- Ważność: S2 (blokuje postęp wątku głównego, akt II) · Zasięg: każdy krok „porozmawiaj z X” (Ume, Mori, Ren, Kurosawa) · Koszt: średni
- Dowód: `minimap.ts` `markerKind` oznacza tylko zleceniodawców (`fixer`/`hana`/`genzo`) i cele z tagiem; kroki zadań (`core/quest/definitions.ts`) mają tylko tekst `objective`, bez celu. „Zapytaj babcię Ume o Rena Odagiri” nie mówi, gdzie ona jest (deptak przy klinice ok. (328, −77) od 6:30, w nocy brama obok, `schedules.ts`).
- Pakiet właściciela: packages/core (`quest`, krok z celem), packages/app (`minimap.ts`, HUD), packages/ui (znacznik)
- Test przyjęcia: test sesji: w kroku z celem-postacią minimapa ma znacznik celu na tej postaci (o każdej porze, także gdy postać śpi albo jest poza wczytanym chunkiem: znacznik na jej miejscu z harmonogramu); dla Ume w kroku `m3_lustro` znacznik w ok. (328, −77) w dzień.

### G-039 Łańcuch słupków przechodzi przez podstawę latarni na Placu Łokietka
- Status: naprawione (#45) razem z G-032 (łańcuch przez latarnię nie występuje; słupek z wylotu zebry na Łokietku usunięty)
- Ważność: S4 · Gdzie: `lamp-pastoral` (439,2; −96,1) w rzędzie słupków (439; −94,4)–(439; −96,8)
- Przyczyna (przypuszczalna): słupki są w `LOOSE` (`props-solid.ts`), więc latarnia stawiana później ich nie widzi; łańcuch od G-032 łączy sąsiadów przez latarnię.
- Test przyjęcia: kontrola skanu „łańcuch słupków przez mebel” daje 0.

### G-040 Śmierć babci Ume blokuje krok ren_trail
- Status: odrzucone (Ume nie ma `health` w `district-m0.ts`, a NPC bez niego nie da się zranić ani zabić, `builders.ts:77`; krok nie może się zablokować)
- Ważność: S2 (proponowana: blokada wątku) · Dowód: krok `ren_trail` (po zakończeniu „aya”) kończy tylko rozmowa z Ume; po `dead:ume` znacznik znika i nie ma innej drogi.

### G-018 Pionowy pas czarnych kresek na bruku Placu Litewskiego
- Status: naprawione (#47). Bieg o średnim podstopniu < 4,5 cm rysowany jako bruk; skan `steps-micro-riser` 42 → 0. Uwaga weryfikatora: reguła zmienia 60 ze 101 pasów schodów, w tym zbocza Podzamcza (np. (798, 272), spadek 12%), które teraz są rampą w kolorze stopni
- Ważność: S3 (proponowana) · Zasięg: lokalny
- Gdzie: Plac Litewski (20, 10), kadr z yaw 3,14
- Dowód: zrzut naprawiacza G-013 (pionowy pas czarnych poziomych kresek na środku bruku; może decal albo odpływ).

### G-030 Poza Seki w klatce referencyjnej zależy od czasu zegarowego
- Status: naprawione (#47). Zegary bezczynności postaci stoją w trybie `?reference`; dwa przebiegi migawki: 1106 px różnicy → 0
- Ważność: S4 (proponowana: migawka różni się między przebiegami w prostokącie postaci) · Koszt: mały
- Dowód: naprawiacz G-001: animacja bezczynności dostaje prawdziwe `dt`; dwa przebiegi starego kodu różnią się w x 703–797, y 273–532.
- Pakiet właściciela: packages/engine (animacja postaci) / packages/app (`?reference`)

### G-044 Tłum i pozy czynności animują się zegarem ściennym także w klatce referencyjnej
- Status: naprawione (#47). (cykle chodu, kołysania i czynności idą z `clock`, w `?reference` 0)
- Ważność: S4 (proponowana; dziś poza kadrem referencyjnym) · Koszt: mały
- Dowód: naprawiacz G-030: `crowd-pose.ts` (`stepPuppet`, `s.time`) i `activity-poses.ts` (`b.time`) idą z `dt`; jeśli wejdą w kadr `?reference`, wróci niedeterminizm migawki.
- Pakiet właściciela: packages/engine (renderer)

### G-045 Test `far-city.test.ts` przekracza 5 s pod obciążeniem
- Status: naprawione (#47). Przyczyna: `expect` na każdą parę wierzchołek × chunk; teraz jedna asercja na liście naruszeń, 3773 ms → 12 ms, kontrola ta sama (odwrócony warunek pada)
- Ważność: S3 (proponowana: niestabilny test jednostkowy) · Koszt: mały
- Dowód: „keeps rings and fillers off every chunk's ground” 5182 ms przy load 16 i padł przy load ok. 8; sam przechodzi 5/5. Ustalić, co jest drogie (podniesienie limitu nie jest poprawką).
- Pakiet właściciela: packages/engine

### G-047 Karta skanu hackowania nie zmienia języka do zmiany celu
- Status: naprawione (#47). (presenter pamięta język karty)
- Ważność: S4 (proponowana) · Koszt: mały
- Dowód: `hacking-hud.ts:62` przelicza kartę tylko przy zmianie celu; po zmianie języka w pauzie karta tego samego celu zostaje w starym języku.
- Pakiet właściciela: packages/app (HUD), etap 2c ADR-0056

### G-006 Skręty aut na skrzyżowaniach
- Status: naprawione (#47). w PR. `lane-dead-end` 61 → 44; zator Ruska/Lwowska usunięty; nowa kontrola `turn-off-road` 6 (zawrotki targu, G-025). CPU sceny targu 3,8 → 4,3 s na 3000 kroków
- Ważność: S3 · Zasięg: szeroki (33 ślepe końce pasów na skrzyżowaniach i 6 z G-024) · Koszt: duży
- Test przyjęcia: `lane-dead-end` spada; łuki skrętu na nawierzchni drogi i poza budynkami.

### G-046 Smoke M0: kierunek ruchu po `freeze` zależy od chwili zamrożenia
- Status: naprawione (#49). Przyczyna w grze: Chromium po wejściu w pointer lock wysyła jeden `mousemove` z ruchem równym minus pozycja kursora (−640 px), `BrowserInput` brał go za obrót (yaw π/2 → 0,16); pierwszy ruch po zmianie stanu blokady nie obraca już widoku
- Ważność: S2 (proponowana: niestabilne e2e) · Koszt: mały
- Dowód: weryfikator i18n 2b, sonda: New Game, `freeze`, 6×10 kroków `moveZ`; `tick0` wypada 10, 15 albo 20 i każdy daje inny kierunek; przy `tick0=15` gracz idzie na ścianę z=−62,88 i staje po 2,09 m, więc `smoke.spec.ts:26` (ruch > 2,5) pada. Na czystym main (b5507ce) 3/4 przebiegów sondy trafia na ścianę. Test zakłada kierunek, który zależy od liczby ticków przed `freeze`.
- Pakiet właściciela: e2e (QA) / packages/app

### G-048 Prawdziwy tap tuż po przycisku pada ginie jako „ghost click”
- Status: naprawione (#48). (`packages/ui/src/touch/ghost-click.ts`)
- Ważność: S2 (niestabilne e2e `touch.spec`, a na telefonie zgubiony pierwszy wybór w dialogu) · Koszt: mały
- Dowód: `pointerdown` na przycisku pada uzbraja `swallowNextClick` na 700 ms, a ten sam przycisk w `touchend` robi `preventDefault`, więc klik zgodności nie przychodzi i nasłuch zjada pierwszy prawdziwy tap w wybór dialogu. Pomiar: padły 3 z 5 przebiegów (odstępy 432–679 ms), przeszły przy 1,6–1,8 s; bez G-006 też 2 z 5. Poprawka: nasłuch wygasa przy następnym `pointerdown`.
- Pakiet właściciela: packages/ui (touch)

### G-004 Kandelabr na krawędzi pasa aut na Placu Zamkowym
- Status: naprawione (#51). Jak na prawdziwej mapie: OSM wpuszcza auta na plac, lampy poza pasem, kosze idą z lampami; skan `furniture-in-car-lane` 1 → 0, nowa kontrola `hanging-basket-orphan`.
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (738, 282)
- Dowód: skan `furniture-in-car-lane` = 1 (0,9 m od linii pasa).
- Pomiar (orkiestrator, 31.10, po G-006): `lamp-candelabra` z chunku podzamcze-1-0 (737,7; 282,3) stoi 0,04 m od osi jezdni „Plac Zamkowy” (`residential`, `cars`) i 1,34 m od linii pasa `Plac Zamkowy#84:f` (promień 0,45 + pół auta 0,9). Mebel z OSM leży na jezdni, więc poprawka należy do importu mebli (odsunięcie na krawędź albo pominięcie), a nie do tras. Nawierzchnia w tym miejscu to `cobble` (bruk placu, nie `road`), więc `props-place.ts` (`surfaceAt(p) === "road"`) nie widzi jezdni, choć `sim` puszcza tamtędy pas aut. Do wyboru przy naprawie: import mebli traktuje oś ulicy z pasem aut jak jezdnię (lampy na krawędź), albo bruk placu nie dostaje pasa aut.
- Pakiet: `tools/osm-import` (meble) albo `packages/sim` (trasy przez parking)

### G-038 `lane-dead-end` nie sprawdza użycia początku, który „spotyka” koniec
- Status: naprawione (#51). Kontrola wymaga tego samego `use`; licznik 44 bez zmian (po G-006 koniec już liczony).
- Ważność: S4 (skan) · Gdzie: koniec trolejbusu na Mełgiewskiej ok. (2456, 245) ukryty przez początek pasa aut.

### G-031 Testy TPP w `npr-perf` i smoke save/load przekraczają limit przy obciążeniu
- Status: naprawione (#57). Zgłoszona postać nie odtwarzała się już po G-029 (pacer); #57 domyka `captureFrame` (bez własnego renderu) i podgląd postaci (przez pacer). Pozostałości: G-054, G-055.
- Ważność: S2 (proponowana: niestabilne e2e) · Koszt: nieznany
- Dowód: naprawiacz G-001: przy obciążeniu 5–11 za każdym razem pada inny test (Krakowskie, Rynek, targ, Nabrzeże, quicksave/quickload); przypuszczalnie ten sam mechanizm co G-001 w zwykłym trybie (pełne klatki w trakcie ładowania i kroków budują kolejkę GPU SwiftShadera). `captureFrame` rysuje dodatkową klatkę mimo `preserveDrawingBuffer` (1,3–5,8 s na przechwycenie).
- Pakiet właściciela: packages/app / e2e

### G-049 Zabytki tracą wieże, hełmy i wysokość: import pomija `building:part` (Trynitarska 42 zamiast 60 m)
- Status: naprawione (#65). Części `building:part` jako osobne bryły z `soffit`; skan `building-part-ignored` 11 → 0. Pozostałe odstępstwa: G-056, G-057, G-060, G-061 (T-017–T-020)
- Ważność: S3 (proponowana) · Zasięg: szeroki (panorama Starego Miasta, Plac Łokietka, Rynek) · Koszt: średni (fetch, osm.ts, massing, buildings w tools/osm-import; regeneracja danych)
- Gdzie: Trynitarska (591.3, −147.3), Brama Krakowska (472.6, −91.2), Ratusz (415, −79), Archikatedra (634, −184), Dominikanie (731, −55); ile w mieście: co najmniej 5 w próbce, pełna liczba po ponownym pobraniu
- Dowód: OSM w617763432 `height=60 min_height=55 roof:shape=pyramidal` w obrysie w66286371; w617878341 `building:levels=6 roof:shape=onion` w r7224409; w619138854 `building:part=tower building:levels=7.5`; T-006 do T-010
- Przyczyna (przypuszczalna): `filterOsm` nie zachowuje `building:part`, a `massing` liczy jedną bryłę z tagów obrysu zewnętrznego
- Pakiet właściciela: tools/osm-import (dane: packages/sim/src/content/lublin/*.generated.ts)
- Test przyjęcia: test w tools/osm-import na wycinku z Trynitarską: najwyższy punkt bryły ≥ 59 m nad stopą, a przybudówka Bramy Krakowskiej ≤ 2 kondygnacje. Dziś pada (42 m, 5 kondygnacji)
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-054 Narzędzie zrzutów `glitch-shots` może zapisać klatkę sprzed ułożenia miasta
- Status: naprawione (#62). Spec czeka na dwie klatki narysowane po `citySettled`; objawu nie odtworzono (0/24), przyjęte z analizy kodu
- Ważność: S4 (narzędzie, poza CI) · Koszt: mały
- Dowód: po G-031 `captureFrame` nie rysuje własnej klatki. `e2e/glitch-shots.spec.ts:34-35` czeka na `frames() > n && citySettled()`, więc gdy miasto ułoży się w klatce pominiętej przez pacer, zrzut pokazuje ostatnią klatkę sprzed końca wczytywania. Sonda: 2 z 15 punktów, (520, −63) i (146, −49), przy load 11–12. Poprawka: czekać na klatkę narysowaną już po `citySettled`, jak `sampleNow` w npr-perf.
- Pakiet właściciela: e2e (QA)

### G-057 Kościoły z wieżyczkami z OSM dostają dodatkowo proceduralne wieże renderera
- Status: naprawione (#69). Flaga `carriesParts` dla obrysu z częściami z `soffit`; skan `church-towers-over-parts` 2 → 0
- Ważność: S3 (proponowana) · Zasięg: Archikatedra i inne kościoły z `building:part` · Koszt: mały
- Dowód: po G-049 Archikatedra ma wieżyczki z części OSM i proceduralne wieże z `roof-plan`
- Pakiet właściciela: packages/engine (mapcity)
- Test przyjęcia: kościół, który ma części `building:part`, nie dostaje proceduralnych wież

### G-050 Nadbudowa Podzamcza przy Bramie Grodzkiej góruje 16 m nad bramą
- Status: naprawione (#60). Piętra nadbudowy ponad zabytkiem ≥ 5 m od jego obrysu, próg przylegania 5 m; skan `landmark-overbuilt` 25 → 0. Kurator proponuje dalej regułę 45° (T-011), do decyzji użytkownika
- Ważność: S3 (proponowana) · Zasięg: lokalny (widok z Zamku i Placu Zamkowego na bramę) · Koszt: mały (vertical.ts)
- Gdzie: Grodzka 36a w66293355 (717.5, 162), Podzamcze; ile w mieście: 2 (z kontrolą `landmark-overbuilt` niżej; druga to w66324576 przy Kościele Ewangelicznym r6476361)
- Dowód: `verticalOf` daje `rise=15`, szczyt na y 17,5, a brama ma szczyt na y 1,7; T-011
- Przyczyna (przypuszczalna): reguła `targ` nie bierze pod uwagę sąsiadującego landmarku
- Pakiet właściciela: packages/sim (content/lublin/vertical.ts)
- Test przyjęcia (decyzja użytkownika 31.10: nadbudowy zostają, lekko odsunięte): budynek PRZYLEGAJĄCY do landmarku (odstęp obrysów < 5 m; zabytki i gmachy publiczne, także `civic` bez nazwy) zachowuje nadbudowę, ale żadne piętro nadbudowy ponad szczytem landmarku nie stoi bliżej niż ok. 5 m od jego obrysu. Obcinanie wysokości z e783f82 odrzucone; zostaje tylko tam, gdzie po odsunięciu nie mieści się żadne piętro
- Uwaga: odsunięcie wymaga informacji o stronie landmarku w `BuildingVertical` (port w core, obszar architekta): rozszerzenie kontraktu z dopiskiem do ADR-0051
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-062 Przejścia pod mostami zablokowane: grunt pod pomostem to pomost (Podwale, bulwar Bystrzycy)
- Status: naprawione (#70). Pomost > 2 m nad terenem i nad stopami jest sufitem; skan `under-deck-blocked` 6 → 0. Skutki uboczne: G-068–G-072
- Ważność: S3 (proponowana) · Zasięg: lokalny (2 miejsca, 6 par droga × most) · Koszt: średni
- Gdzie: Podwale w66318260 (747, 166) z chodnikami w56965511, w56965514 i schodami w56965515 pod wiaduktem Zamkowej (teren −19,2, pomost −13,5); ścieżka bulwaru w307943890 pod mostami Mełgiewskiej (2435, 262) i (2450, 306); T-024
- Dowód: `groundY` zwraca pomost (sonda kuratora `topo-deck`); ADR-0053 to przyznaje
- Pakiet właściciela: packages/sim (world/deck, lublin/decks), packages/engine (mapcity)
- Test przyjęcia: idąc Podwalem i bulwarem, grunt pod pomostem nie skacze o więcej niż 0,5 m; kontrola `under-deck-blocked` 6 → 0

### G-068 AI nie widzi przejścia pod mostem: walczący wręcz utyka na skarpie bulwaru
- Status: naprawione (#71). Pomost jest sufitem dla AI tylko, gdy NPC albo cel stoi pod nim; pierwsza wersja (7b118fd) odrzucona za regresję na wiadukcie Zamkowej
- Ważność: S3 (proponowana: bezpieczne miejsce przed walką wręcz) · Zasięg: przejścia pod pomostami (Mełgiewska, Podwale) · Koszt: mały
- Gdzie: gracz pod dolnym mostem Mełgiewskiej (2445.9, 302.2); `hebi_brawler` startujący od południa (2449, 318) utyka w (2458.4, 314.2) i przez 20 s zostaje 16–17 m od gracza
- Przyczyna: `packages/sim/src/systems/ai/steering.ts` `terrainOf` (l.140), `closeBanks` (l.155), `bankBetween` (l.359) wołają `heightAt`/`steepAt` bez `reach` (G-062), więc AI widzi pomost jako grunt
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: zaalarmowany walczący wręcz dociera do gracza pod mostem Mełgiewskiej z obu stron w < 10 s

### G-067 Klasztor Dominikanów dostaje proceduralne wieże kościoła
- Status: naprawione (#72). `monastery` i `convent` jako `historic`, bez wież proceduralnych
- Ważność: S4 (proponowana) · Zasięg: 1 znany · Koszt: mały
- Gdzie: r2366732 (748.5, −104.4), Stare Miasto
- Dowód: budynek klasztoru ma `use: church`, więc `addTowers` stawia na nim wieże kościoła, choć to klasztor; widać z ujęcia „Dominikanie od wschodu” (810, −56)
- Pakiet właściciela: tools/osm-import (building-tags) / packages/engine (mapcity)
- Test przyjęcia: klasztor bez wież proceduralnych; kościół obok zachowuje swoje

### G-051 Podpis „Muzeum Historii Miasta Lublina” na kamienicy Jezuicka 3 zamiast na Bramie Krakowskiej
- Status: naprawione (#75, z etapem 1 ADR-0062). Nazwa z punktu tylko przy zgodnym adresie
- Ważność: S4 (proponowana) · Zasięg: lokalny · Koszt: mały (labels/buildings w tools/osm-import)
- Gdzie: w66286384 (478.7, −114.4); ile w mieście: 1 znane
- Dowód: węzeł n993790419 `addr:street=Plac Władysława Łokietka addr:housenumber=3` leży w obrysie Jezuickiej 3, 6 m od r7224409; T-013
- Przyczyna (przypuszczalna): nazwa trafia do budynku zawierającego punkt, a adres węzła nie jest porównywany z adresem budynku. Możliwa też poprawka położenia węzła w OSM
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: po regeneracji w66286384 nie ma nazwy muzeum, a r7224409 nosi nazwę Bramy Krakowskiej (nazwa budynku ma pierwszeństwo przed punktem)
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-064 Targowiska bez straganów (Targ na Ruskiej, Bazar, Giełda na Kresowej)
- Status: naprawione (#76). 420 straganów w rzędach; skan `marketplace-empty` 3 → 0
- Ważność: S4 (proponowana) · Zasięg: 3 · Koszt: mały
- Gdzie: w182461192 (787, 561), w67502759 (681, 413), w231445090 (x 2300..2383); T-026
- Dowód: `props.generated` nie ma `market-stall` w podzamcze-1-1 i 0-1
- Pakiet właściciela: tools/osm-import (props-gen)
- Test przyjęcia: każdy obrys `amenity=marketplace` w dzielnicach ma ≥ 1 stragan na 150 m²; kontrola `marketplace-empty` 3 → 0

### G-056 Kształt dachu z OSM (`roof:shape`) ignorowany: hełmy, kopuły i dachy dwuspadowe jako czterospadowe
- Status: naprawione (#78, ADR-0064 etap 1). Dachy z `roof:shape`/`roof:orientation`; skan `roof-shape-ignored` = 0. Dalej: G-080
- Ważność: S3 (proponowana) · Zasięg: zabytki Starego Miasta i Krakowskiego · Koszt: średni (pole w widoku `building`, czyli kontrakt w core/ports i ADR)
- Dowód: hełm wieży Bramy Krakowskiej rysuje się jako dach czterospadowy i zasłania 3,2 m ścian ośmioboku; to samo przy cebulach i kopułach
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity), kontrakt: architekt

### G-061 Część `building:part` bez obrysu `building` nie trafia do gry (pawilon Bona)
- Status: naprawione (#74). Osierocone części jako budynki (`orphanParts`/`asBuilding`); skan `building-part-orphan` = 0
- Ważność: S4 (proponowana) · Zasięg: 1 · Koszt: mały
- Gdzie: w1236054202 (708.4, 166.8), Podzamcze; T-020
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola skanu `building-part-orphan` (część bez obrysu i bez bryły w grze), baza 1 → 0

### G-076 Przejazdy bramne z `tunnel=yes` zamknięte bryłą (Gruella pod Trynitarską, Królewska, Sąd Okręgowy, Rynek 5)
- Status: naprawione (#80). `streetLevelTunnels`: przejazdy `tunnel=yes`/`covered=yes` na poziomie ulicy jako przejścia; skan `passage-blocked` 9 → 0. Dalej: G-089 (maxheight), G-079 (w586408568)
- Ważność: S2 (proponowana) · Zasięg: 9 miejsc, w tym zabytek · Koszt: mały
- Gdzie: Gruella w298307007 (587.6, −147); Sąd Okręgowy w343899807 (1.4, −96.1); Peowiaków 13 w343899804 (−48.5, −167.8); Królewska, 5 bram kamienic (x 387..489); Rynek 5 w1222303436 (562, −29.1); T-036…T-039
- Dowód: zalewanie siatki 0,25 m: ciało 0,38 m nie przechodzi; tagi OSM `tunnel=yes`
- Przyczyna (przypuszczalna): `passages.ts` bierze tylko `tunnel=building_passage`, a `underground()` w `ground.ts` zabiera nawierzchnię
- Test przyjęcia: kontrola `passage-blocked` (definicja kuratora w `scratchpad/topo-bramy-raport.md`), baza 9 → 0


### G-077 Budynek podziemny zbudowany na powierzchni ul. Zamkowej
- Status: naprawione (#80). `buildingAreas` pomija `location=underground`; skan `building-underground-solid` 1 → 0. Odsłonięte: G-088
- Ważność: S2 (proponowana: zasłania 11,5 m osi drogi na dojściu do Zamku) · Koszt: mały
- Gdzie: w980143457 (771.1, 190.5), `location=underground`, `layer=-1`, bryła 6,9 m na osi w154962966; T-041
- Pakiet właściciela: tools/osm-import (`buildingAreas`)
- Test przyjęcia: kontrola `building-underground-solid` 1 → 0

### G-058 Dotknięcie pierwszego wyboru tuż po otwarciu dialogu czasem ginie (e2e touch)
- Status: naprawione (#50, e970b3d: osłona przed „ghost click” G-048 wygasa przy następnym `pointerdown`). Na bazach z czerwonymi przebiegami (c07dea9, gałąź etapu 5) tej poprawki nie było; ślad: tap 325 ms po „Use” zjadany w fazie capture. Na main 20/20 zielonych przy `--repeat-each=10` i 14/14 z dławieniem CPU ×6 i ×20; test komponentu `ghost-click.test.tsx` („a real tap on a choice right after the talk opens…”) pada na starym pliku
- Ważność: S3 (proponowana: flake w CI i możliwy błąd dotyku na telefonie) · Koszt: mały
- Dowód: `e2e/touch.spec.ts:56-57` „on-screen pad”: 1/4 czerwony na bazie c07dea9 i 2/5 na etapie 5 przy load 6–9; dotknięcie wyboru zaraz po otwarciu koła kwestii nie wybiera kwestii. Sprawdzić, czy koło przyjmuje dotyk przed pierwszym renderem albo czy działa osłona przed „ghost click” (G-048)
- Pakiet właściciela: packages/ui / e2e (QA)

### G-075 Kolizje aut na przecięciu pasów 3 Maja przy Zesłańców Sybiru
- Status: naprawione (#85). `crowded` sprawdza obrócone ciało i następne 12 m obu pojazdów, `onItsWay` następne 6 m pojazdu w tę samą stronę; 3 Maja ziarna 1–30 bez kolizji
- Ważność: S3 (proponowana) · Zasięg: jedno skrzyżowanie · Koszt: mały–średni
- Gdzie: (−110, 56), przecięcie pasów 3 Maja#31:0 i #31:1
- Dowód: `traffic-junction-drive` na gałęzi G-052: Peowiaków ziarna 3 i 7 po 2 kolizje (próg 0), 3 Maja ziarno 7: 3 (próg 2)
- Pakiet właściciela: packages/sim (traffic-junctions)
- Test przyjęcia: `traffic-junction-drive` w progach na gałęzi G-052 i na main

### G-089 Bramy z maxheight=below_default ze sklepieniem 4 m
- Status: naprawione (#89). `vaultOf`: `maxheight` → sklepienie, `below_default` 3,6 m (szacunek, do potwierdzenia zdjęciem); skan `passage-maxheight` 3 → 0
- Gdzie: Królewska w755152552/555/560; T-054
- Przyczyna: `buildingPassages` (wysokość w `out.push`, przy `widthOf`) nie czyta `maxheight`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `passage-maxheight` 3 → 0 (np. sklepienie 3,6 m dla `below_default`)

### G-090 Przesunięcie pasa ruchu z mediany szerokości całego łańcucha ulicy
- Status: naprawione (#88). `laneLine`: przesunięcie pasa zwężane lokalnie (okno ±10 m, ≤ 0,1 m/m); 6 ze 149 pasów na main
- Ważność: S3 (proponowana; na łańcuchach o różnej szerokości pas wychodzi poza wąski odcinek, latarnie w pasie) · Zasięg: łańcuchy ulic z odcinkami różnej szerokości · Koszt: mały–średni
- Gdzie: Staszica (dopasowany w1150131461, połowa asfaltu ok. 2,0–2,5 m, i odcinek 3,25 m); latarnie `lamp-road` (217, 145) i (205, 118) 1,03 m od pasa
- Przyczyna: `packages/sim/src/content/traffic.ts` `lanesOf` bierze `laneOffset(roadHalfWidth(...))` z mediany całego łańcucha (2,75 → pas 1,375 m od osi) zamiast lokalnej szerokości odcinka (1,2 m)
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: z łatką G-082 (`scratchpad/g082-wip.patch`) `furniture-in-car-lane` 2 → 0 bez wzrostu `car-lane-off-road`, `lane-dead-end`, `turn-off-road`; świadoma zmiana złotego hasha, jeśli ruch się zmienia
- Uwaga z naprawy G-082: ulice ok. 3–4 m mają w sim dwa pasy, a auta (pół szerokości 0,9 m) zachodzą na chodnik; żadna kontrola tego nie liczy

### G-052 Teatr Osterwy i Kościół Bernardynów poza danymi miasta (brzeg Krakowskiego na z = −200)
- Status: naprawione (#87). Krakowskie do z = −270 (Teatr Osterwy, Bernardyni, Brygidki, III LO); baza `lane-dead-end` 45 (G-074 odłożone), budżet reference 194/81 z długiem w ADR-0046; uwagi kuratora: G-096…G-099, T-057…T-061
- Ważność: S3 (proponowana) · Zasięg: lokalny (Narutowicza, Bernardyńska) · Koszt: duży (prostokąt w config.ts, ADR-0042, regeneracja, budżety)
- Gdzie: (118.0, −205.7), (364.7, −239.8); ile w mieście: 2 zabytki z listy kuratora
- Dowód: brak w66330578 i w67508958 w `*.generated.ts`, `DISTRICTS[0].rect.minZ = −200`; T-014
- Przyczyna (przypuszczalna): zasięg prostokąta Krakowskiego (ADR-0042)
- Pakiet właściciela: tools/osm-import (decyzja: Architekt, ADR-0042)
- Test przyjęcia: kontrola `landmark-missing` daje 0
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-094 Przedsionek Trasy Podziemnej: pierwsze 4,5 m poza obszarem wnętrza
- Status: naprawione (#90). Początek Trasy Podziemnej z obrysu OSM (`facadeAt`); kontrola `interior-entrance-gap` 1 → 0; resztka: G-111
- Ważność: S4 (proponowana) · Zasięg: 1 wejście · Koszt: mały
- Gdzie: wejście do Trybunału w66264159, przedsionek z = −57; fasada przecina go skośnie (x 567,5…568,2), luka w obszarze wnętrza x 567,6…570 (2,4 m; poprawka naprawiacza)
- Dowód: `interiorAt` na stopie (y = podłoga przedsionka + 0,1, z = −57): x 565,6/567/569/569,9 → null, x 570,1 → `trasa-podziemna`; `TRASA_PODZIEMNA.vestibule.from.x` = 565,5, pierwszy pokój `minX: 570`; zrzut `scratchpad/shots1/p1-trasa-vest.png`; test w `interior-areas.test.ts` zaczyna chód od x = 563, a wyjście liczy od 571, więc tego nie łapie
- Skutek: `InteriorEntered` (autozapis, ambient ADR-0060) 4,5 m za drzwiami, już w ciemnym korytarzu; wyjście symetrycznie
- Przyczyna (przypuszczalna): pierwszy pokój zaczyna się od zgadniętego `minX: 570` w `content/kanal-underground.ts` zamiast od `T.vestibule.from.x`
- Pakiet właściciela: packages/sim
- Test przyjęcia: `interiorAt` na (vestibule.from.x + 0,3, −57, door + 0,1) zwraca `trasa-podziemna`; kontrola skanu `interior-entrance-gap` (punkt 0,3 m za fasadą przy drzwiach/przejściu budynku wnętrza leży w obszarze) 1 → 0

### G-125 Ekranu opcji nie da się przewijać na telefonie
- Status: naprawione (#94). `.screen`: `overflow-y: auto`, `justify-content: safe center`; test e2e na telefonie 844×390
- Ważność: S2 (proponowana; na telefonie część opcji, m.in. dostępność, nieosiągalna) · Zasięg: każde menu pełnoekranowe wyższe niż ekran (pauza z opcjami, sloty, autorzy) · Koszt: mały
- Przyczyna: `.screen` z `justify-content: center` bez `overflow-y`, a `html, body` z `overflow: hidden`
- Pakiet właściciela: packages/ui
- Test przyjęcia: `e2e/touch-layout.spec.ts` „phone: the settings in the pause menu scroll to their last control” (844×390)

### G-087 `stepRamps` tylko dla nazwanych schodów
- Status: rozstrzygnięte (#97): rampy tylko dla nazwanych schodów, poprawny opis w `shape.ts`; reszta biegów na terenie zgodnym z NMT
- Gdzie: `packages/sim/src/content/lublin/shape.ts` `stepRamps` czyta `c.streets` (tylko nazwy) → 3 rampy z 69 biegów
- Decyzja: albo rampy dla wszystkich biegów (wtedy sprawdzić `terrain-off-pads`, `steps-micro-riser`), albo poprawić komentarz

### G-131 Etap 1 obezwładnienia: trzy błędy z weryfikacji
- Status: naprawione (#100, ADR-0065 etap 1): poprawki przed PR, sondy weryfikatora jako testy
- Błędy: klawisz interakcji obezwładnia mimo podpowiedzi bliższego celu (rozmowa, łup, drzwi); ogłuszony po parowaniu zostaje „w walce” (`ai.alerted`, RAM i aktywności); przytrzymany atak jako „zabij” strzela po obezwładnieniu
- Pakiet właściciela: packages/sim, packages/app
- Test przyjęcia: sondy weryfikatora (`scratchpad/v-a-probes/`) jako testy, padające przed poprawką

### G-127 Parterowy pawilon na skwerze jako czterokondygnacyjna wieża (Bar Centralny przed Pedetem)
- Status: naprawione (#103): `smallAlone`, 15 pawilonów z 2–4 kondygnacji na 1, `small-freestanding-tall` 16 → 2 (reszta w G-134)
- Ważność: S3 (proponowana; stoi na osi widoku z deptaku na Pedet i zasłania go) · Zasięg: 24 wolnostojące obrysy < 60 m² w mieście · Koszt: mały
- Gdzie: w665959137 (112.5, −84.6), skwer Witkowskiego; T-074. Inne: w631242940 (−86, 19.8) na Placu Litewskim, w67499328 (130.8, 17.5), w458298770 „VapeTube” (851.5, 369.7), w458298766 „Hunek” (817.1, 373.5) i 19 dalszych (lista w `topo-pedet-raport.md`)
- Dowód: okrągły obrys o średnicy 6,7 m (pole 33 m²), `building=yes` bez kondygnacji; w grze `levels: 4`, 13,7 m, `residential` z witryną; zrzut `pedet-north.png`: czerwona kamienica z roletami po prawej, przed Pedetem
- Przyczyna: `defaultLevels` daje 1 kondygnację tylko pod 25 m²; większy wolnostojący pawilon dostaje piętra dzielnicy jak kamienica
- Pakiet właściciela: tools/osm-import (`building-tags.ts`)
- Test przyjęcia: nowa kontrola `small-freestanding-tall` (niżej) 24 → co najwyżej przypadki potwierdzone przez kuratora; w665959137 ma 1 kondygnację

### G-097 Teatr Osterwy jako kamienica mieszkalna
- Status: naprawione (#104)
- Gdzie: w67508958 (118.0, −205.7); T-059
- Przyczyna: `buildingUse` czyta tylko tagi obrysu (`building=yes`); punkt `amenity=theatre` w obrysie daje nazwę, nie przeznaczenie
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: punkt `amenity=theatre`/`arts_centre` w obrysie `building=yes` daje `use=civic`; kontrola `theatre-not-civic` 1 → 0; wysokość według zdjęcia lub LOD2 (ADR-0062 etap 7)
- Uzupełnienie (audyt gmachów publicznych, 31.10): ten sam mechanizm dotyczy punktów `amenity=townhall|courthouse|library` (Pedagogiczna Biblioteka Wojewódzka n10568650059 w w55897083, T-069: `residential` z nadbudową +21 m). Reguła tylko przy zgodnym adresie (jak G-051) i dla `building=yes|public|government|civic`. Punktów `office=government` reguła nie obejmuje, bo bywają lokalem w kamienicy (Biuro Rozwoju Turystyki UM n9529164485 w w66293242). Kontrola `civic-as-residential` (część B) 2 → 0

### G-116 Ułamkowe `building:levels` zaokrąglane w górę (Ratusz o 1,6 m za wysoki)
- Status: naprawione (#104)
- Ważność: S4 (proponowana) · Zasięg: 6 obrysów i części (Ratusz w66264120 z wieżą w619138854, kościół Dominikanów w66286338 z w618270604 i w618270605, w55897040) · Koszt: mały
- Gdzie: Ratusz (416.1, −69.6); T-064
- Dowód: `heights` w `tools/osm-import/src/building-tags.ts`: `levels = Math.round(4.5) = 5` i `walls = floors(levels)`, czyli 16 m zamiast 14,4 m. Wieża Ratusza 7,5 → 8 kondygnacji
- Przyczyna: ściany liczone z zaokrąglonej liczby kondygnacji
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: `building:levels=4.5` daje ściany 14,4 m nad cokołem, a w siatce okien 4 kondygnacje (wyższe, po 3,6 m); kontrola `fractional-levels-rounded` 6 → 0

### G-120 Urzędy z `office=government` w tagach obrysu jako kamienice z nadbudową
- Status: naprawione (#104)
- Ważność: S3 (proponowana; nadbudowa 2,4–3,4 raza wyższa od gmachu) · Zasięg: 2 (Kuratorium Oświaty w55897069, Urząd Miasta przy Placu Litewskim 1 w67498728) · Koszt: mały
- Gdzie: (−132.0, 74.5) i (118.7, 35.9); T-068
- Dowód: `buildingUse` nie czyta `office` ani `government`, więc z `building=yes` wychodzi `residential`. `landmarkName` gubi wtedy nazwę, a `verticalOf` daje +24 m i +21 m
- Pakiet właściciela: tools/osm-import (`building-tags.ts`)
- Test przyjęcia: obrys z `office=government` albo `government=*` daje `use=civic` z nazwą; kontrola `civic-as-residential` (część A) 2 → 0; baza `landmark-overbuilt` bez wzrostu

### G-130 Pojazdy zapadnięte pod nawierzchnię (wrak na deptaku przy Pedecie)
- Status: naprawione (#107): pojazdy na najwyższym punkcie nawierzchni, bez postoju na spadku > 0,15 m, auta jadące z `SURFACE_LIFT`; `vehicle-below-surface` 77 → 0, `vehicle-off-surface` 15 → 0
- Ważność: S3 (proponowana; widoczne na głównym ciągu pieszym) · Zasięg: 38 z 87 pojazdów w mieście zapadniętych ponad 0,15 m pod rysowaną nawierzchnię, 8 ponad 0,25 m · Koszt: mały
- Gdzie: wrak (152.6, −51.0) na deptaku Krakowskiego Przedmieścia przy wylocie Kapucyńskiej, ok. 50 m od Pedetu; T-077. Najgłębiej: dostawczak (544.7, 167.7) 0,36 m, furgonetki na Placu Zamkowym (757, 249.4) 0,30 m, taxi (810.3, 481.3) 0,29 m
- Dowód: pojazd ze zgłoszenia to blok sceny `wreck` z `DISTRICT_M0_PROPS` (`district-m0.ts`, grupa `WRECK` (150, −20), skrzynia (2.6, −31)), nie auto zaparkowane: w promieniu 80 m od Pedetu nie ma żadnego z 80 `PARKED_CARS`. Stoi na nawierzchni `square` (4/5 narożników). Jego spód leży na terenie w środku (y 0,54), teren pod narożnikami ma 0,50–0,61, a renderer kładzie `square` 0,08 m nad terenem (`SURFACE_LIFT`). Koła są więc do 0,15 m pod płytami. To samo dotyczy aut zaparkowanych i jadących: `PARKED_CARS` i `vehicleEntity` biorą `groundY` ze środka, z `pitch: 0`, a jezdnia jest rysowana +0,10 m, chodnik +0,16 m. Zrzuty `wreck.png`, `pedet-wide.png` i `wreck-side.png` (z boku: dolna ćwiartka kół schowana pod płytami)
- Przyczyna: wysokość pojazdu liczona od gołego terenu w jednym punkcie, bez podniesienia nawierzchni i bez pochylenia na spadku
- Pakiet właściciela: packages/sim (`content/parked-cars.ts`, `content/district-m0.ts` przez `standing`, `systems/traffic-system.ts`), a wysokości nawierzchni z `packages/engine/src/renderer/mapcity/ground-plan.ts` (`SURFACE_LIFT`) przenieść do kontraktu w `core`, żeby sim je znał
- Test przyjęcia: kontrola `vehicle-below-surface` 38 → 0; dla wraku najwyższy narożnik nawierzchni ≤ spód + 0,05 m; złoty hash symulacji zmieniony świadomie, jeśli zmieni się y aut

### G-140 Zaparkowane auta na wjazdach i wylotach dróg serwisowych (Cerkiewna)
- Status: naprawione (#110): `serviceWays` w chunkach, auta co najmniej półszerokość + 0,5 m od osi dróg serwisowych; `parked-car-on-service-road` 3 → 0; aut 63 → 61 (próg testu ruchu > 60)
- Ważność: S4 · Zasięg: 3 auta (Cerkiewna (908.8, 440.5) na `driveway` w1381877866, (912.2, 416.4) i (910.8, 422.5) przy wylocie `service` w739432848)
- Przyczyna: `offOtherRoads` w `parked-cars.ts` pilnuje tylko ulic z `CAR_KINDS`, bez `highway=service`
- Poprawka: w `fits()` odstęp od osi `highway=service` (poza `parking_aisle`) co najmniej półszerokość + 0,5 m. Uwaga (1.11): dane chunków sim mają tylko nazwane ulice, a `service` i `driveway` przy Cerkiewnej są bez nazwy, więc najpierw import musi przenosić osie nienazwanych dróg serwisowych (osobne pole, nie `streets`); koszt mały–średni, nie drobna poprawka
- Pakiet właściciela: packages/sim (content)
- Test przyjęcia: kontrola skanu „auto bliżej niż 1,5 m od osi `service`”, baza 3 → 0

### G-114 npr-perf Nabrzeże: czasem +98 wywołań rysowania przy tych samych siatkach
- Status: naprawione (#113): `sampleNow` czeka na klatkę po kroku, kontrola braku renderu sondy `WetProbe` między ustaleniem miasta a próbką; `citySettled` czeka na zaległy render sondy (zabezpieczenie)
- Dowód: 334/102 albo 338/102 zamiast 236/102 w ok. 2 z 7 pełnych przebiegów przy obciążeniu, przy identycznym `byName` siatek i +431 tys. trójkątów; na bazie 0 z 3 próbek (za mało, by wykluczyć)
- Dowód 2 (1.11, weryfikacje Grodzkiej i G-130): 338/102 w 1 z 3 pełnych przebiegów, sama scena 0 z 10 (gałąź i main po 5); ta sama sygnatura (+102 wywołania, +482 tys. trójkątów, identyczne `byName`). Wskazuje na zależność od wcześniejszych testów w przebiegu albo od czasu sondy `WetProbe`; trafia też w weryfikacje innych zmian, więc priorytet rośnie
- Przyczyna (przypuszczalna): w próbkowanej klatce renderuje się sonda odbicia `WetProbe` (6 ścian × ok. 16 siatek + cień); `ProbeSchedule` dławi rendery do 1 s czasu rzeczywistego, a `citySettled`/`sampleNow` na to nie czeka (por. G-001)
- Pakiet właściciela: packages/engine (renderer) / e2e (QA)
- Test przyjęcia: pomiar `npr-perf` czeka na ustalenie sondy; 10 przebiegów Nabrzeża pod obciążeniem bez +98

### G-139 Smoke „title → new game”: gracz przechodzi 2,09 m zamiast ponad 2,5 m przy szybkim starcie
- Status: naprawione (#112): `pointerlockerror` od odrzuconej opcji `unadjustedMovement` nie wyłącza blokady; o odmowie decyduje obietnica żądania
- Ważność: S3 (fałszywie czerwony smoke w CI)
- Gdzie: `e2e/smoke.spec.ts`, test „title → new game → … IndexedDB”: przy starcie ok. 14 s ruch w pierwszych 60 krokach daje 2,09 m; bez renderera zawsze 4,20 m, więc to wyścig startu w aplikacji (może z ekranem ładowania #102: kroki liczone przed końcem `prepare` albo wejście przed pointer lockiem)
- Pakiet właściciela: packages/app, e2e (QA)
- Test przyjęcia: przyczyna ustalona śladem; test czeka na stan gry, nie na zegar (ADR-0046); 10 przebiegów bez błędu

### G-141 Obezwładnienie: telefon świadka kończy się w trakcie chwytu; wyjątek pomocnika bez testu
- Status: naprawione (#114): świadek w chwycie wstrzymuje telefon (po ogłuszeniu urwany, po wyrwaniu wraca); test wyjątku `helper`; zapis w ADR-0065
- Ważność: S4 · Koszt: mały
- Gdzie: `runCalls` sprawdza `c.unconscious`, nie `incapacitated`: telefon, któremu zostało mniej niż `TAKEDOWN_TIME` (1,2 s), dochodzi, gdy gracz trzyma świadka w chwycie (sonda: 0,38 s pozostałych, 1 zgłoszenie); wyjątek `helper` w `react` (`crime-system.ts` ok. l. 155) bez testu (świeże, niezauważone ciało, pomocnik znajduje je pierwszy)
- Pakiet właściciela: packages/sim
- Test przyjęcia: oba przypadki jako testy symulacji, padające bez poprawki

### G-138 Pasy ruchu na szwach chunków i krawędziach mapy bez nawierzchni
- Status: naprawione (#115): końce pasów 0,1 m przed krawędzią mapy (`onTheMap`), `lane-off-ground` 56 → 9 (reszta: zawracanie na Alei Tysiąclecia i G-144)
- Ważność: S4 · Zasięg: 56 z 23 374 punktów pasów (co 1 m), na szwach chunków (z ≈ 160) i krawędziach mapy
- Gdzie: `surfacesAt` nie zwraca tam żadnej nawierzchni, a `GroundField.heightAt` różni się od `groundY` (np. (−96.3, −270.5): −1,80 zamiast 0,00); sprawa sprzed G-130
- Pakiet właściciela: packages/sim (content/lublin, ground)
- Test przyjęcia: kontrola skanu dla punktów pasów bez nawierzchni, baza 56 → 0 albo uzasadnione wyjątki

### G-135 Pointer lock bez gestu: panel otwarty i zamknięty Esc przed pierwszym kliknięciem po ekranie ładowania
- Status: naprawione (#116; NotAllowedError, czyli brak gestu, nie ustawia `lockUnavailable`; następne kliknięcie bierze blokadę)
- Ważność: S4 (proponowana) · Zasięg: desktop, tylko gdy gracz otworzy panel przed pierwszym kliknięciem po ładowaniu
- Gdzie: `packages/app/src/pointer-focus.ts`: zamknięcie panelu Esc woła blokadę od razu; strona bez wcześniejszej blokady i bez gestu może dostać odmowę, a odmowa ustawia na stałe `lockUnavailable` (`browser-input.ts:154` po G-139: odrzucona obietnica ponowionego żądania)
- Pakiet właściciela: packages/app, packages/engine/src/input
- Test przyjęcia: prawdziwy Chrome (e2e) z tym przebiegiem; po odmowie kolejne kliknięcie nadal blokuje

### G-136 Przejazd Bramy Grodzkiej poza osią frontów
- Status: naprawione (#117): przejazd w osi obu frontów, 3 osie okien co 2 m, trasa dostaw na osi, latarnie spod sklepienia; prześwit (T-086) osobno
- Ważność: S3 · Zasięg: lokalny (Brama Grodzka) · Koszt: niski
- Gdzie: `GATE_PASSAGES` w `packages/sim/src/content/lublin/sites.ts` biegnie za węzłem drogi OSM w293488528, ok. 1,4 m na południe od osi bramy; łuk przesunięty o 1,64 m (od Grodzkiej) i 1,36 m (od Zamku) od środka widocznego frontu, przez co przepis ma 2 osie okien zamiast 3
- Poprawka: przejazd przesunięty prostopadle o ok. 1,4 m na północ, (701,0, 129,4)→(727,0, 153,6); potem przepis z 3 osiami co 2,1 m; prześwit łuku (T-086) przy okazji
- Pakiet właściciela: packages/sim (złoty hash zmieniony świadomie), packages/engine (przepis)
- Test przyjęcia: proponowana kontrola skanu `gate-mouth-off-axis` (środek wylotu dalej niż 0,5 m od środka czystej części frontu), baza 2 → 0; Krakowska do zmierzenia przed ustaleniem bazy
