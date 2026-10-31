# Archiwum glitchy

Pełne wpisy naprawionych, odrzuconych i zdublowanych glitchy, przeniesione z [rejestru](glitches.md), który trzyma tylko otwarte sprawy (ADR-0054).

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
