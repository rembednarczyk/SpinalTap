# ADR-0104 E3: przygotowanie włączenia grafu ulic na Krakowskim Przedmieściu

Ciąg dalszy `grunt-z-grafu-e2.md`. Próba jak w E2: `SEKI_STREET_GRAPH=krakowskie`, skan z `GLITCH_BASELINE=accept`, porównanie z `origin/main`.

## Runda 1 (26.11): uskoki chodnika

Uskoki (`sidewalk-step`, 7–8 cm) to styk chodnika grafu (0,16 m) z nawierzchnią obok niego położoną niżej: placem (0,08 m) albo ścieżką (0,09 m). Dwie przyczyny w danych:
- **Szczelina szersza niż 3 m** między krawężnikiem a zmapowanym chodnikiem była zawsze pasem zieleni. Wypełnienie z ortofoto kładło w nim plac, gdy ortofoto pokazywało nawierzchnię (Radziwiłłowska). Teraz pasem zieleni jest szczelina zielona w ortofoto albo na mapie; szczelina, którą ortofoto pokazuje jako nawierzchnię, jest chodnikiem aż do krawężnika.
- **Ścieżka za zatoką postojową** (`parking=street_side`, w883991779 przy Radziwiłłowskiej): leżała dalej niż 3 m od jezdni, więc dopasowanie nie brało jej za chodnik ulicy. Teraz ścieżka za asfaltowym polem przy krawężniku może leżeć do 6 m dalej.

Wersja E3-1 (Krakowskie, main → E2 v26 → E3-1):

| Rodzaj | main | v26 | E3-1 |
|---|---|---|---|
| sidewalk-surface-patch | 169 | 98 | 84 |
| ground-strip-gap | 288 | 238 | 194 |
| sidewalk-gap | 118 | 133 | 98 |
| sidewalk-step | 154 | 165 | 147 |
| sidewalk-width-jump | 88 | 115 | 109 |
| landuse-bare | 253 | 237 | 229 |
| bare-on-cover | 130 | 119 | 115 |
| kerb-gap-bare | 222 | 228 | 223 |
| kerb-strip-bare | 14 | 1 | 0 |
| crossing-shape-kerb | 17 | 8 | 8 |
| kerb-jag | 3 | 3 | 4 |

Rodzaje wyższe niż na main (Krakowskie):
- `sidewalk-width-jump` 88 → 109;
- `osm-furniture-missing` 15 → 18;
- `kerb-fit-sparse` 0 → 5;
- `bollard-blocks-mouth` 3 → 5;
- `osm-bollard-line-missing` 0 → 3;
- `bus-stop-on-fill` 0 → 2;
- `ground-ring-self-cross` 0 → 2;
- `bay-strip-sparse` 1 → 2;
- `kerb-jag` 3 → 4;
- `lane-dead-end` 12 → 13;
- `door-floating` 0 → 1;
- `lawn-strip-on-paving` 0 → 1.

To lista do przejrzenia przed przyjęciem baz.

## Skoki szerokości chodnika (`sidewalk-width-jump`, 109 wobec 88 na main)

67 nowych miejsc na Krakowskim:
- **49 szerszych od mediany odcinka.** 22 z nich to 8,25 m, czyli pas sięga do granicy pomiaru kontroli. Leżą przy narożnikach węzłów i przy placach: chodnik grafu obiega łuk narożnika, a ostry narożnik sięga dalej niż strefa skrzyżowania kontroli (`JUNCTION` = 4 m poza jezdnią drugiej ulicy). W rzeczywistości chodnik w narożniku jest szerszy, więc to pomiar starego modelu.
- **18 węższych.** To miejsca, gdzie chodnik zwęża się między krawężnikiem a budynkiem albo zatoką. Do sprawdzenia po kolei.

**Do decyzji (ADR przed E3):** czy kontrola jednolitości ma pomijać zasięg narożnika liczony jak w grafie (`cornerReach`) zamiast stałych 4 m. Bez tej zmiany trzeba przyjąć te miejsca do bazy z uzasadnieniem.

### Runda 2: narożnik w kontroli jak w grafie (decyzja użytkownika)

Kontrole jednolitości chodnika w dzielnicach z grafem uznają za skrzyżowanie dysk węzła o zasięgu `cornerReach`, tak jak graf (`corner-zones.ts`). Poza grafem zostaje stałe 4 m, więc bazy na main się nie zmieniają. Wynik na Krakowskim (main → E3-1 → E3-2): `sidewalk-width-jump` 88 → 109 → 91, `sidewalk-step` 154 → 147 → 135, `sidewalk-gap` 118 → 98 → 89, `sidewalk-surface-patch` 169 → 84 → 82.

Pozostałe nowe skoki szerokości to głównie chodnik wchodzący w plac albo zatokę (Plac Wolności, Radziwiłłowska, Bernardyńska) i zwężenia przy budynkach. Przejrzę je przy przyjmowaniu baz.

### Runda 3: pozostałe rodzaje wyższe niż na main

- **`kerb-fit-sparse` 0 → 5 → 0.** Kontrola szuka ulic zwężonych do zmapowanych chodników. Szerokość z BDOT10k nie pochodzi z dopasowania, tak jak pomiar z ortofoto, który kontrola już pomija, więc teraz pomija też ulice z BDOT10k w dzielnicach z grafem.
- **Lubartowska: spór BDOT10k z wyposażeniem z OSM (do decyzji).** BDOT10k daje 9 m (w40050981) i 10 m (w742414722), a ortofoto 7,5 m i 12,5 m. Na szerszej jezdni z BDOT10k lądują zmapowane w OSM rzeczy, które leżą przy krawężniku:
  - linie słupków w1514057822, w1514057825 i w1514057828 (`osm-bollard-line-missing`: 3 z 18, 3 z 6 i 0 z 7 słupków);
  - trzy ławki n6681995509–11 przy (424; −30) (`osm-furniture-missing`).
  
  To dane OSM, które wskazują krawężnik węższy niż BDOT10k. Reguła „BDOT10k wygrywa zawsze” zostaje, a spór idzie do przeglądu.
- **Do przejrzenia przy przyjmowaniu baz:**
  - `bus-stop-on-fill` (233,9; −164,2 i 454,1; 16,2);
  - `ground-ring-self-cross` (173; 44 i 211; 16, małe kawałki chodnika);
  - `kerb-jag` (100,2; 97,9 0,62 m: chodnik obiegający koniec pasa zieleni; 280,8; −170,7 0,51 m);
  - `bollard-blocks-mouth` (−98; −99 i −97; −94);
  - `bay-strip-sparse` (w471191535);
  - `door-floating` (151; −103);
  - `lawn-strip-on-paving` (336; −230);
  - `lane-dead-end` (Peowiaków: dwa pasy z BDOT10k, skrzyżowanie łączy jeden; ślepy koniec był już na main).

### Runda 4: ulice wyłączone z ruchu i testy na próbnych tablicach

- **Deptak (w216497220, T-324):** na ulicy wyłączonej z ruchu jej własny chodnik w grafie dostaje nawierzchnię ulicy (bruk od krawężnika do krawężnika), a strona ze zmapowanym chodnikiem poszerza bruk do niego. Wcześniej szerokość z BDOT10k liczyła się jako zmierzona, więc w dawnej zatoce Brama Krakowska 01 lądował chodnik 2,5 m i padał test `kerb-fill-places` („zatoka … jako bruk”).
- **`bus-stop-on-fill` 2 → 1:** zostaje przystanek przy Narutowicza (233,9; −164,2). Szerokość z BDOT10k (7 m wobec 9,2 m z ortofoto) zostawia zatokę jako chodnik. To prawdopodobnie prawdziwy błąd: zatoki autobusowe przy ulicach z BDOT10k potrzebują własnej reguły (przystanek z OSM plus asfalt w ortofoto daje zatokę jezdni).

**Testy, które padają na próbnych tablicach z grafem** (`vitest run packages/sim tools/glitch-scan`, bez skanu; 17 testów w 13 plikach i plik `traffic-ramp.test.ts`, który nie wczytuje się z błędem `undefined.id`). Każdy trzeba rozstrzygnąć przed E3:
- **Deptak:**
  - `alchemia-deptak` (bryły na bruku);
  - `deptak-ends` (dwa testy końców bruku);
  - `deptak-night` (yatai przy krawędzi);
  - `traffic-deptak` (pierścień Bajkowskiego).
- **Ruch:**
  - `traffic-bodies` (pasy Cichej, dwa testy);
  - `traffic-bodies-shifted` (łuk Kołłątaja);
  - `traffic-junction-drive` (3 Maja przy Żołnierzy Niepodległej);
  - `traffic-ramp` (rampa P−1).
- **Parkowanie:**
  - `traffic` (auta w zmapowanych parkingach przy krawężniku);
  - `kerb-bay-cars` (Lubartowska w471191535).
- **Piesi:**
  - `crowd` (miejsca tłumu);
  - `flee-wall` (trzy przebiegi ucieczki za róg).
- **Grunt:** `grass-under-paving` (Plac Litewski, 3 Maja przy klinice).

### Runda 5: deptak poza grafem, rampa P−1

- **Deptak (T-324) nie jest ulicą grafu.** Graf obejmuje jezdnie, a deptak jest miejscem dla pieszych z własnymi regułami: proste końce bruku, stoiska, strefa trolejbusu. Zostaje w starym modelu, a chodniki grafu zatrzymują się na jego bruku. Dwie reguły z rundy 4 dla ulic wyłączonych z ruchu usunięte jako zbędne. Na próbnych tablicach przechodzą już `alchemia-deptak`, `deptak-night` i `traffic-ramp`.
- **Wjazd na rampę P−1** sięga w jezdnię Bajkowskiego (z −14,5). Dotąd kończył się na dawnej krawędzi i przy krawężniku z BDOT10k zostawał pas chodnika ze słupkami w poprzek wylotu. Test rampy znajduje pasy Bajkowskiego po kolejności, nie po współrzędnych.
- **Zostaje na deptaku:**
  - `deptak-ends`: linie końców bruku leżą w stałej odległości od węzłów (`trim` 3,7 m od Bajkowskiego, 1,8 m od Olejnej), czyli na połowach jezdni dawnej geometrii. Jezdnie z BDOT10k sięgają 0,3–1 m dalej, więc `trim` trzeba liczyć z połówki jezdni ulicy poprzecznej przy węźle;
  - zatoka przy Bramie Krakowskiej 01 jest teraz placem (wypełnienie z ortofoto), a nie brukiem;
  - pierścień Bajkowskiego (`traffic-deptak`).

### Runda 6: końce deptaka, szerokość z OSM przed BDOT10k, narożnik dwóch ulic

- **Szerokość z OSM przed BDOT10k** (ADR-0104 pkt 4). Potok BDOT10k (`bdot-ways.ts`) nadpisywał szerokością i osią z BDOT10k także ulice, którym OSM podaje `width`: Olejna dostawała 5 m i oś przesuniętą o 1,4 m zamiast `width=3.5`. Teraz takie ulice zostają przy szerokości z mapy. Do tego test.
- **Narożnik dwóch ulic w węźle bez trzeciego ramienia.** Gdy deptak wypadł z grafu, Lubartowska-północ i Olejna zostały w węźle we dwie i graf traktował je jak jedną ulicę ze zmianą szerokości: dysk o promieniu szerszej (6,35 m) wchodził 3 m w deptak. Dwa ramiona pod kątem (ponad 30° od prostej) to teraz narożnik zaokrąglony jak skrzyżowanie, a karb po zewnętrznej stronie zamyka dysk węższej połowy. Do tego test.
- **Końce deptaka przy krawężniku z mapy** (`cutsAtKerb`). Linia cięcia przesuwa się w głąb deptaka do najdalszego zasięgu asfaltu ulicy poprzecznej w szerokości bruku (do 3 m). Pas postojowy deptaka nie liczy się jako ta ulica. Na main asfalt kończy się na `trim`, więc tablice bez zmian. Test `deptak-ends` sprawdza teraz to, co mówi jego tytuł: bruk kończy się na jednej prostej, prostopadłej do deptaka, z asfaltem za nią, gdziekolwiek ta prosta leży.
- **Na próbnych tablicach przechodzą:**
  - północny koniec deptaka;
  - pas postojowy;
  - pierścień Bajkowskiego (`traffic-deptak`);
  - stoiska;
  - noc;
  - rampa P−1.
- **Zostaje:**
  - południowy koniec: dwa pomiary trafiały 2,4 m przed linią na „dziury” w bruku przy węźle dwóch odcinków deptaka (442,9; −9,9). To szczeliny do 1 cm między kawałkiem deptaka a kawałkiem jego wylotu, z zaokrąglenia podziału do 0,1 m, a nie dziury. Test przeskakuje szczeliny węższe niż 0,1 m i przechodzi na main i na próbnych tablicach;
  - zatoka przy Bramie Krakowskiej 01 jest placem zamiast brukiem.

### Runda 7: deptak i jego zatoka

Zatoka przy Bramie Krakowskiej 01 jest znowu brukiem deptaka. Trzy miejsca, w których graf sięgał do deptaka spoza grafu:
- **BDOT10k** nie mierzy ulicy wyłączonej z ruchu, więc jej strony pozostają szacowane i stary model poszerza bruk do krawężnika zatoki jak na main (T-324).
- **Dopasowanie ścieżek do ulic** bierze tylko ulice grafu. Ścieżka wzdłuż deptaka zostaje jego krawędzią.
- **Wysepki grafu:** dziura, która dotyka jezdni ulicy wyłączonej z ruchu, należy do tej ulicy. Wcześniej graf kładł tam plac i marsz wypełnień deptaka zatrzymywał się na nim.

Na próbnych tablicach przechodzą wszystkie testy deptaka i rampy (40 z 40): `deptak-ends`, `deptak-night`, `alchemia-deptak`, `traffic-deptak`, `traffic-ramp`, `kerb-fill-places`. Tablice main bez zmian.

### Runda 8: ruch i stan listy testów (próbne tablice)

- **`traffic-bodies` (Cicha).** Test brał długość pierwszego odcinka trasy za odległość do zakrętu. Z rampą osi na środek jezdni z BDOT10k pierwszy odcinek ma 2,2 m. Teraz test szuka zakrętu po zmianie kierunku o ponad 20°. Zielony na main i na próbnych tablicach.
- **Przechodzą już na próbnych tablicach** (po zmianach rund 5–7):
  - `traffic-bodies-shifted` (łuk Kołłątaja);
  - `traffic-junction-drive` (3 Maja przy Żołnierzy Niepodległej);
  - `crowd`;
  - `flee-wall`.
- **Zostają:**
  - parkowanie: `traffic` (auta w parkingach przy krawężniku, w471191535 przy Peowiaków bez aut) i `kerb-bay-cars` (ten sam pas). Pas jest asfaltem na obu zestawach tablic, więc przyczyna leży gdzie indziej, prawdopodobnie pasy ruchu Peowiaków przesunięte osią z BDOT10k nad pas postojowy;
  - `traffic` G-090: pas ulicy dwukierunkowej zjeżdża z asfaltu przy (−98,6; −19,05). Nowe;
  - `grass-under-paving`: Plac Litewski (pas gołej ziemi na krawędzi chunku) i trawa na chodniku 3 Maja przy klinice (G-667);
  - zatoka autobusowa przy Narutowicza.

**Parkowanie przy Peowiaków (w471191535), przyczyna:** na main jezdnia Peowiaków ma w kilku miejscach połowę poniżej 2,6 m, więc symulacja daje jej jeden pas ruchu. Z BDOT10k jezdnia ma równe 5,7 m (połowy 2,85 m) i reguła `lanesOf` stawia dwa pasy po ±1,6 m od osi. Prawy pas wchodzi w strefę zmapowanego pasa postojowego (`parking=street_side`), a auta muszą stać z dala od pasów ruchu, więc nie stoi żadne. W rzeczywistości to jeden pas ruchu z parkowaniem: OSM nie podaje `lanes` (jest `lane_markings=no`), a ulica jednokierunkowa bez tego tagu ma według konwencji OSM jeden pas. Do decyzji: liczba pasów z OSM (`lanes`, w domyśle konwencja OSM) zamiast z szerokości, albo szerokość jezdni pomniejszona o zmapowany pas postojowy.

### Runda 9: poprawka reguły „OSM przed BDOT10k” i uczciwy stan listy

- **Błąd z rundy 6:** reguła „szerokość z OSM przed BDOT10k” czytała tagi po poprawkach importu. Pomiar z ortofoto jest zapisany jako `width:carriageway`, więc ulice zmierzone na ortofoto (m.in. Narutowicza, Kołłątaja, 3 Maja, Lubartowska, Bajkowskiego) wyglądały na ulice z szerokością z OSM i BDOT10k je pomijał. Teraz reguła czyta tagi z OSM przed poprawkami. Do tego test.
- **Kawałki jezdni grafu** nie dziedziczą poszerzeń starego pasma (`widen`, `widenLanes`). Jezdnia grafu ma szerokość ze źródeł, a pasy czytają tę szerokość.
- **Skutek na próbnych tablicach:** przechodzi `traffic` G-090 (Narutowicza). Wracają porażki, które w rundzie 6 znikały tylko przez ten błąd:
  - `flee-wall` (3 przebiegi);
  - `traffic-bodies-shifted` (łuk Kołłątaja);
  - `traffic-junction-drive` (3 Maja przy Żołnierzy Niepodległej);
  - `traffic-deptak` (pierścień Bajkowskiego).
  
  Zostają też parkowanie (czeka na #1080, pasy z OSM) i `grass-under-paving` (2). Razem 10 testów do rozwiązania przed E3.

### Runda 10: przyczyny ruchu, parkowania i ucieczek (27.11)

- **Parkowanie przy Peowiaków.** Po #1080 (pasy z OSM) ulica ma jeden pas, ale ten biegnie osią jezdni, a BDOT10k liczy 5,7 m razem z pasem postojowym w471191535. Środki miejsc wypadały 1,8 do 2,1 m od pasa (potrzeba ok. 2,3 m). Poprawka w osobnym PR #1081 (`traffic-parking.ts`, ADR-0105 pkt 4): jedyny pas biegnie środkiem części jezdni, którą zostawia zmapowany pas postojowy. Na próbnych tablicach `traffic` (G-177) i `kerb-bay-cars` przechodzą.
- **3 Maja przy Żołnierzy Niepodległej i łuk Kołłątaja** (`traffic-junction-drive`, `traffic-bodies-shifted`). Obie porażki to jedno zderzenie przy (−113; 54). Oś jezdni 3 Maja#31 z BDOT10k skręca o 15° na wschód 9 m przed węzłem, bo jezdnia zbiega się z drugą. Prawy pas przed skrętem w prawo odbija w lewo, lewy zjeżdża w prawo, a skręcony kadłub wchodzi na pas obok. Ruch w tę samą stronę czytał tylko środki aut wobec toru, nie kadłuby. Poprawka w osobnej gałęzi `fix/kadluby-obok`: odczyt kadłubów (G-744) także dla aut na innych trasach w tym samym kierunku. Na próbnych tablicach oba testy przechodzą.
- **Pierścień Bajkowskiego** (`traffic-deptak`, G-966). Test stawiał gracza na jezdni (na main 4,7 m od pasa pierścienia, na próbnych 3,4 m), a auta zwalniały przed nim. Gracz staje teraz w pierwszym miejscu poza jezdnią (commit na tej gałęzi). Zielony na obu tablicach.
- **`flee-wall` (G-326, 3 przebiegi).** Sceny są przypięte ziarnem i numerem przechodnia. Na main przechodnie stoją już w otwartym miejscu (0 skoków), więc te przypadki niczego tam nie sprawdzają. Na próbnych tablicach przechodzień 1002005 (ziarno 17) rodzi się 2,4 m od fasady przy (275; −124) i przy ścianie przerzuca stronę skrętu: NW, potem SW (1,56 rad), potem N (2,35 rad). To ten sam rodzaj glitcha co G-326 w nowym miejscu, a nie błąd grafu. Próba „trzymaj stronę skrętu” (algorytm bug) zepsuła testy ślepego zaułka i została wycofana. Do zrobienia: przypiąć sceny miejscem, nie numerem przechodnia, i poprawić wybór skrętu przy fasadzie osobno, w obszarze AI.
- **Zostaje:** `flee-wall` (wyżej), `grass-under-paving` (2), zatoka autobusowa przy Narutowicza.
