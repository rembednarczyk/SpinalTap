# Rejestr glitchy

Proces: [ADR-0054](adr/0054-proces-glitchy.md). Skala, priorytety i szablon: umiejętność `glitch-triage` (`.claude/skills/glitch-triage/SKILL.md`). Liczniki skanu: `tools/glitch-scan/test/glitch-baseline.json`, miejsca: `reports/glitch-scan.json`.

## Otwarte

### G-001 Test migawki NPR przekracza 90 s na wolnym runnerze CI
- Status: weryfikacja PRZYJĘTE, w PR. Tryb `?reference` rysuje dopiero przy gotowej scenie; migawka 18–42 s zamiast 72 s. Ryzyko szczątkowe: `still` nie czeka na `ProbeSchedule` (inwalidacja sondy < 1 s przed gotowością); zapas w pomiarach > 2,6 s.
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
- Status: przyjęte
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: Ku Farze (616, 44), droga OSM 481583497 `motor_vehicle=no`
- Dowód: trasa `Ku Farze#66:d` biegnie przez przejście; importer nie zapisuje `motor_vehicle`.
- Pakiet: `tools/osm-import` (ulice), `packages/sim` (`roads.ts`)
- Test przyjęcia: żadna trasa dostaw nie biegnie odcinkiem z `motor_vehicle=no`.

### G-003 Zawrót na Alei Tysiąclecia zahacza o skraj chodnika przed targiem
- Status: przyjęte
- Uzupełnienie (łowca, 2026-10-30): ten sam zawrót biegnie 2,5 m od linii pieszych `targ-deck` pod wiaduktem (758,4, 350,8–353,8), 5 punktów; skan pomija linie scen. Test przyjęcia obejmuje też to.
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (758, 349), trasa `Aleja Tysiąclecia#80:1/0+…#81:1/1`
- Dowód: skan `car-lane-off-road` = 1.
- Pakiet: `packages/sim` (`traffic.ts`, `uTurn`)

### G-004 Kandelabr na krawędzi pasa aut na Placu Zamkowym
- Status: zgłoszone
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (738, 282)
- Dowód: skan `furniture-in-car-lane` = 1 (0,9 m od linii pasa).
- Pakiet: `tools/osm-import` (meble) albo `packages/sim` (trasy przez parking)

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

### G-016 Auta zaparkowane do 10 m za zebrą na dwukierunkowej 3 Maja
- Status: później (S4; pełny art. 49 PoRD dla dróg dwukierunkowych, po G-015)
- Gdzie: (−115,58, 31,83) 3,0 m, (−103,16, −32,87) 7,75 m, (−115,53, 25,62) 9,0 m za zebrą

### G-017 Wiaty przystanków z OSM jako trzypiętrowe bloki mieszkalne na Alei Tysiąclecia
- Status: naprawione (#34)
- Ważność: S3 · Zasięg: lokalny · Koszt: mały
- Gdzie: w672635874 (709,5, 335,3) i w672635872 (781, 365,1), po 3 kondygnacje i 9,7–9,8 m; w672635873 3,3 m
- Dowód: raport naprawiacza G-011 (obrysy `amenity=shelter` + `building=yes` budowane jako `residential`).
- Pakiet: `tools/osm-import` (`building-tags.ts` / `buildings.ts`), wymaga `pnpm osm:build`
- Test przyjęcia: budynek z `amenity=shelter` (lub `building=roof`/`shelter`) ma wysokość wiaty (≤ 3,5 m, jedna kondygnacja) albo staje się meblem `bus-shelter`.

### G-018 Pionowy pas czarnych kresek na bruku Placu Litewskiego
- Status: zgłoszone (do potwierdzenia przez łowcę)
- Ważność: S3 (proponowana) · Zasięg: lokalny
- Gdzie: Plac Litewski (20, 10), kadr z yaw 3,14
- Dowód: zrzut naprawiacza G-013 (pionowy pas czarnych poziomych kresek na środku bruku; może decal albo odpływ).

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
- Status: przyjęte
- Ważność: S3 · Zasięg: lokalny (3 miejsca, 7 ślepych końców pasów) · Koszt: mały
- Gdzie: Narutowicza szew x = 240 ((238,3, −171,6)–(268,6, −161,6), #8 ma 30,3 m bez pasa); Lubartowska szew z = −20 (brak 4,2 m przy (442,2, −20)); Lubartowska szew z = 370 (brak 3,8 m przy (585, 366,5), #39 ma 9,3 m bez pasa)
- Dowód: łowca (pomiar `clipLineToRect`); `krakowskie.generated.ts:688` kończy Lubartowską na (442,2, −20), `:1492` zaczyna na (442,3, −15,8). OSM w40051392, w40050981, w60145297.
- Przyczyna (przypuszczalna): `tools/osm-import/src/labels.ts:33` (`lineLength(piece) < 5`) odrzuca kawałek przycięty na szwie; `JOIN` 0,6 m w `roads.ts` nie łączy przerwy.
- Pakiet właściciela: tools/osm-import + regeneracja `content/lublin`
- Test przyjęcia: kontrola skanu `street-seam-gap` (pary łańcuchów aut o tej samej nazwie z końcami 0,6–8 m od siebie, dalej niż 6 m od krawędzi mapy) daje 0; dziś 3.

### G-022 Pas aut kończy się przed krótkim łańcuchem tej samej jezdni, który nie dostaje pasa
- Status: przyjęte (po G-020 i G-021, te same pliki)
- Ważność: S3 · Zasięg: lokalny (6 miejsc, 8 ślepych końców) · Koszt: średni
- Gdzie: Cerkiewna#92 (912, 346) → pętla #90 (44,4 m); Aleja Unii Lubelskiej#96 (1099, 272) → Aleja Tysiąclecia#84 (21 m); Kalinowszczyzna#131 (2361, 430); Łęczyńska#121 (2659, 95); Kapucyńska#10 (150, −160); Kołłątaja#2 / Peowiaków#0 (−100, −169) → Zesłańców Sybiru#5 (35 m)
- Dowód: łowca: koniec łańcucha z pasami dotyka (≤ 8 m) łańcucha aut < 45 m z 0 pasami.
- Przyczyna (przypuszczalna): klucz łączenia w `roads.ts:71` zawiera `oneway`; `MIN_ROUTE` (`traffic.ts:83`) liczony dla łańcucha, nie dla ciągu łańcuchów.
- Pakiet właściciela: packages/sim (`content/lublin/roads.ts`, `content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-end-at-laneless-street` daje 0; dziś 8 (bez G-020, po G-021).

### G-023 Pasy aut kończą się bez zawrotki przy ulicach dla dostaw i na końcach ulic
- Status: naprawione (#37) (częściowo: 7 z 13 końców, dwukierunkowe; 6 końców jednokierunkowych wydzielone do G-024). Skan `lane-dead-end` 75 → 68.
- Ważność: S3 · Zasięg: szeroki (13 końców, m.in. Lubartowska przy Starym Mieście) · Koszt: średni
- Gdzie: Lubartowska#37 (460, 56); Kowalska#76 (568, 160), #87 (668, 161); Królewska#19 (459, −156); Kapucyńska#10 (144, −97); Karmelicka#34 (293, 120); Staszica#35 (199, 28); Świętoduska#20 (350, −48); Kościuszki#4 (28, −103); Browarna#102 (532, 407)
- Dowód: łowca: żaden pas aut w promieniu 6 m od końca; sąsiedni łańcuch ma `use=deliveries` albo OSM ma tylko service/footway/parking. Auto w polu widzenia staje na końcu pasa (`traffic-system.ts:334`) i czeka.
- Przyczyna (przypuszczalna): `turnRound()` w `traffic.ts` paruje tylko pasy przecięte blokiem gry; koniec ulicy i zmiana `useOf` nie dostają zawrotki.
- Pakiet właściciela: packages/sim (`content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-dead-end` (koniec pasa w mapie, > 6 m od krawędzi, bez początku pasa zgodnego kierunku w 3 m); dziś 75, z czego 33 to G-006 i 2 to G-020; ta poprawka obniża o 13, baza tylko spada.

### G-024 Jednokierunkowe pasy kończą się przed ulicą dla dostaw (Lubartowska, Kowalska, Świętoduska)
- Status: w naprawie razem z G-006 (decyzja użytkownika: opcja B, skręty w boczne ulice; ADR-0055)
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

### G-028 Resynchronizacja przenosi auto w łuk zawrotki z pełną prędkością
- Status: naprawione (#38)
- Ważność: S3 · Zasięg: lokalny (każda zawrotka; widać po złączeniu Alei w G-020) · Koszt: mały
- Gdzie: Aleja Tysiąclecia, zawrotka przed targiem; seed 3: auto za trolejbusem spada ponad `RESYNC` za rozkład, poza wzrokiem przeskakuje z s=204,6 na s=244,8 (w łuku) i jedzie dalej 7,7 m/s przy `TURN_SPEED` 4
- Dowód: test „turns round before the market on Aleja Tysiąclecia” pada po G-020 (7,69 > 4,01)
- Przyczyna: `traffic-system.ts:296-299` ustawia `st.s` z rozkładu, ale zostawia prędkość auta
- Pakiet właściciela: packages/sim (`systems/traffic-system.ts`)
- Test przyjęcia: auto po resynchronizacji w łuku nie przekracza `TURN_SPEED`; test zawrotki bez złagodzenia przechodzi z G-020.

### G-029 Kliknięcie „Nowa gra” w `models.spec.ts` wisi ponad 60 s na CI
- Status: zgłoszone (po ponowieniu PR #37 zielony; naprawiacz G-001 wskazuje ten sam mechanizm: pełne klatki rysowane w trakcie ładowania budują kolejkę GPU SwiftShadera; testy TPP i smoke save/load padają przy obciążeniu)
- Ważność: S1 (proponowana: czerwone CI, niestabilne) · Zasięg: każdy PR · Koszt: nieznany
- Gdzie: `e2e/models.spec.ts:16`, shard E2E 1/3
- Dowód: PR #37 (CI 41089511069) pada w obu próbach, PR #33 (CI 41069178665) przeszedł przy drugiej. Playwright: element widoczny i stabilny, „performing click action” bez końca, więc wątek strony zablokowany.
- Przyczyna (przypuszczalna): długa praca synchroniczna po „Nowa gra” (budowa świata, ubieranie postaci VRoid) pod SwiftShaderem; może ta sama kolejka GPU co G-001.
- Pakiet właściciela: packages/app / packages/engine (do ustalenia śladem)
- Test przyjęcia: ślad pokazuje, co blokuje wątek; kliknięcie wraca w < 10 s na CI bez podnoszenia limitu.

### G-030 Poza Seki w klatce referencyjnej zależy od czasu zegarowego
- Status: zgłoszone
- Ważność: S4 (proponowana: migawka różni się między przebiegami w prostokącie postaci) · Koszt: mały
- Dowód: naprawiacz G-001: animacja bezczynności dostaje prawdziwe `dt`; dwa przebiegi starego kodu różnią się w x 703–797, y 273–532.
- Pakiet właściciela: packages/engine (animacja postaci) / packages/app (`?reference`)

### G-031 Testy TPP w `npr-perf` i smoke save/load przekraczają limit przy obciążeniu
- Status: zgłoszone (powiązane z G-029)
- Ważność: S2 (proponowana: niestabilne e2e) · Koszt: nieznany
- Dowód: naprawiacz G-001: przy obciążeniu 5–11 za każdym razem pada inny test (Krakowskie, Rynek, targ, Nabrzeże, quicksave/quickload); przypuszczalnie ten sam mechanizm co G-001 w zwykłym trybie (pełne klatki w trakcie ładowania i kroków budują kolejkę GPU SwiftShadera). `captureFrame` rysuje dodatkową klatkę mimo `preserveDrawingBuffer` (1,3–5,8 s na przechwycenie).
- Pakiet właściciela: packages/app / e2e

### G-006 Skręty aut na skrzyżowaniach
- Status: w naprawie (decyzja użytkownika przy G-024: skręty w boczne ulice; ADR-0055)
- Ważność: S3 · Zasięg: szeroki (33 ślepe końce pasów na skrzyżowaniach i 6 z G-024) · Koszt: duży
- Test przyjęcia: `lane-dead-end` spada; łuki skrętu na nawierzchni drogi i poza budynkami.

### G-007 Strzałki na pasach i napis BUS
- Status: później (ADR-0052 „Na później”)

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

## Odrzucone
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
| Nieoglądane: Ruska, Narutowicza, Kalinowszczyzna, Zamek, wnętrza, noc i deszcz z bliska, telefon | - | - |
