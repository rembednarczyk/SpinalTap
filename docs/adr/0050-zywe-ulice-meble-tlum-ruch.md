# ADR-0050: Żywe ulice Lublina: meble uliczne w grze, gęstszy tłum, ruch uliczny i zaparkowane auta

## Kontekst
Gracz zgłosił, że miasto w skali 1:1 wydaje się przepastne i puste. Ulice mają wyglądać na żywe jak w Cyberpunku 2077, bez zmiany skali i układu. Meble uliczne z ADR-0047 były tylko w podglądzie, tłum z ADR-0041 miał po 12 osób na chunk 200 × 200 m rozsianych po całym chunku i rysowanych do 60 m, a jezdnie były puste.

Ograniczenia jak zawsze: `core` bez zależności, `sim` tylko `core`, Babylon tylko przez `engine/src/babylon.ts`, determinizm i złote hashe, zapis bez zmian, limity ADR-0031, budżety scen z pomiaru (ADR-0046: najpierw optymalizacja, potem uzasadniona wartość).

## Decyzja

### Meble uliczne w grze
- **Obraz.** `WORLD_SCENERY` dostaje widok `street-props` każdego chunka (za dotychczasowymi widokami, więc ich identyfikatory scenografii się nie przesuwają). Meble stoją na terenie po kształtowaniu (`groundY`), nie na surowym terenie z importu.
- **Co odpada** (`content/street-props.ts`, `clearOfGame`): sztuki w scenkach gry (targ, nabrzeże, myjnia) i do 1,2 m od bloków gry, kiosków metra i postaci, oraz na prostych drogach, które treść przechodzi bez omijania: droga pijaka do baru (ADR-0034), przejścia przez bramy (ADR-0045), Plac Łokietka do Bramy Krakowskiej i zejście Zamkową przez Plac Zamkowy na targ.
- **Kolizje** (`content/lublin/furniture.ts`): tanie pryzmaty wypukłe w układzie sztuki (front +z, obrót jak w rendererze) dla ławek (ława bez oparcia 0,55 m, z oparciem 1 m), słupków, koszy, latarń (słup, nie ramię; latarenka na fasadzie bez kolizji), pni drzew (z rozmiarem drzewa), kiosków, wiat (tył, bok, ekran i ławka, otwarte z przodu), automatów, biletomatów, słupów ogłoszeniowych, sygnalizatorów, słupów trakcji, masztów i pomników. Drobiazgi (włazy, tabliczki, potykacze, donice, krzewy, szafki) bez kolizji. Pryzmaty zaczynają się 0,3 m pod stopą, więc na zboczu nie ma szpary.
- **Identyfikatory.** Bryły ulicy chunka (meble i zaparkowane auta) dostają `STREET_ID_BASE` (2 000 000) + 4 000 × pozycja chunka + indeks, poza alokatorem: żaden dotychczasowy identyfikator ani identyfikator worka się nie przesuwa. Są statycznymi rekwizytami chunka (`ChunkDef.street`), wchodzą i wychodzą ze streamingiem, nie mają klucza, więc nie trafiają do zapisu.
- **AI i tłum.** Pole odległości AI (ADR-0025) rasteryzuje statyczne bryły, więc ławki i słupy omija samo. Trasy tłumu (`streetLanes`) są wyginane wokół mebli: pętla co metr odpychana od okręgu sztuki na 1 m plus jej promień, potem wygładzona; test pilnuje 0,25 m od każdej bryły po obu stronach trasy. Idący omijają też pojazdy (punkty wzdłuż auta z jego szerokością, krok w bok do 1,2 m plus połowa szerokości). Ławki z miejscami przechodniów Placu Litewskiego i Rynku stoją teraz na prawdziwych ławkach.
- **Kamera TPP** patrzy przez meble (`seeThrough`, `rayGeometry(..., camera)`): słup latarni między kamerą a graczem nie przyciąga kamery. Kule i wzrok AI się na nich zatrzymują.

### Gęstszy tłum
- **Limity na chunk** (`CROWD_CAP`): `high` 32, `medium` 18, `low` 6 (telefon). Zasięg rysowania tłumu 90, 70 i 40 m (było 60, 50, 36): to dalej jedna siatka i jedno wywołanie na przebieg.
- **Profil `evening`** dla deptaka Krakowskiego (`krakowskie-1-0`, `krakowskie-2-0`) i Rynku (`stare-miasto-0-0`, `stare-miasto-0-1`): pełne od 18 do 23, 0,9 o północy, rano 0,2 do 0,5. W tych chunkach do sześciu tras, na szerokiej ulicy dwie obok siebie (różne odsunięcia od osi), więc ludzie są tam, gdzie gracz chodzi, a nie w bocznych uliczkach. Podzamcze ma profil ulicy z udziałem 0,7, Nabrzeże 0,4.
- **Stoi dwóch na pięciu** (drugi i czwarty indeks z każdej piątki), reszta chodzi.
- **Grupy przy meblach** (`content/lublin/seats.ts`, `content/crowd-seats.ts`): ławka (trzy miejsca na ławie, dwa na ławce z oparciem), ogródek (cztery stołki przy dwóch stolikach i para rozmawiająca przy płotku), kiosk (kolejka trzech, pierwszy „rozmawia”), wiata (jeden siedzi, dwóch czeka pod dachem bez parasola). Siedzący stoi stopami 0,67 m przed frontem ławki, biodra idą 0,45 m w tył, więc siedzi na krawędzi siedziska, a od bryły ma promień ciała. Na chunk do 14 grup, kolejność z hasha pozycji, co najmniej 7 m od siebie, z dala od ścian, przechodniów i nazwanych postaci. Kolejność grup tasuje ziarno, a stojący zajmują grupę po kolei, więc ławka zapełnia się razem.
- **Koszt kroku** (Node, krok 1/60 s, najlepszy z trzech pomiarów po 300 kroków, w trakcie równoległego e2e):

| Miejsce, godzina | bez tłumu i ruchu | `low` | `medium` | `high` | sam ruch `high` |
|---|---|---|---|---|---|
| Krakowskie, 20:00 | 0,13 ms | 0,17 ms (6 os.) | 0,24 ms (18) | 0,50 ms (32 os., 21 poj.) | 0,16 ms |
| Plac Litewski, 18:00 | 0,04 ms | 0,09 ms | 0,25 ms | 0,48 ms (47 os., 31 poj.) | 0,12 ms |
| Rynek, 21:00 | 0,10 ms | 0,16 ms | 0,33 ms | 0,64 ms (64 os., 13 poj.) | 0,12 ms |
| Plac Zamkowy, 17:00 | 0,09 ms | 0,17 ms | 0,36 ms | 0,73 ms (32 os., 65 poj.) | 0,35 ms |
| al. Tysiąclecia, 8:00 | 0,09 ms | 0,15 ms | 0,37 ms | 0,77 ms (16 os., 87 poj.) | 0,51 ms |

### Ruch uliczny
- **Pasy** (`content/lublin/roads.ts`, `content/traffic.ts`): kawałki ulic z OSM, przycięte do chunków, łączone z powrotem po nazwie w całe ulice (drogi główne bez odwracania, bo OSM rysuje jezdnię w kierunku jazdy). Jezdnia dwujezdniowa (inna droga główna 4 do 32 m obok, w przeciwną stronę, na większości długości) i ronda są jednokierunkowe: dwa pasy, gdy jezdnia jest szeroka (±1,6 m od osi), inaczej jeden. Ulica dwukierunkowa ma pas w każdą stronę, odsunięty w prawo o połowę jezdni zmierzonej po nawierzchniach `road` (1,2 do 2,2 m), a przy pasie postojowym o 1,6 m. Auta: drogi `primary` do `unclassified`. Stare Miasto (dystrykt `kanal`) i deptaki (`pedestrian`, `living_street`) mają tylko dostawcze: jedną furgonetkę na co trzeciej dłuższej ulicy, 3,5 m/s, od 6 do 11.
- **Trolejbusy** jeżdżą po ulicach sieci z planu (§6): Lubartowska, Królewska, Wyszyńskiego, al. Tysiąclecia (na bateriach), Lwowska, al. Unii Lubelskiej, Mełgiewska, Andersa, Krakowskie przy 3 Maja. Jeden na 420 m pasa, 8,5 m/s, 12 s na każdym przystanku z mebli (`bus-stop`, `bus-shelter` do 10 m po prawej pasa); nocą (poziom ruchu poniżej 0,2) nie jeżdżą.
- **Rozkład z ziarna i zegara** (`world/traffic.ts`): pojazd i pasa r ma model, lakier i fazę ze strumieni `deriveRandom(seed, "traffic-…")`, prędkość jedną na pas (0,88 do 1 prędkości ulicy), fazy rozłożone złotym podziałem. Jego miejsce w rozkładzie to czysta funkcja zegara (dla trolejbusu z postojami). Liczba na pasie zależy od godziny (`TRAFFIC_BY_HOUR`, szczyt 8 i 16 do 17) i gęstości. Gęstość ruchu idzie za gęstością tłumu, `?traffic=` ją nadpisuje.
- **Jazda** (`systems/traffic-system.ts`, w `createSystems()` zaraz po ruchu, przed aktywnościami): pojazd jedzie do miejsca z rozkładu (prędkość rozkładu plus 0,5/s zaległości, do 1,3 prędkości pasa), hamuje 6 m/s² tak, by stanąć 1,2 m przed każdym ciałem w korytarzu przed sobą (szerokość auta plus ciało plus 0,35 m), także na przejściu, i 2,2 m za pojazdem przed sobą jadącym w tę samą stronę. Z dala od rozkładu o ponad 40 m (przeskok czasu) wraca na rozkład, gdy gracz nie patrzy.
- **Gracz na drodze**: po sekundzie postoju klakson (`VehicleHorned`, dźwięk `horn` z syntezy, co 3,5 s), po 2,5 s objazd na stronę dalszą od gracza (do 2,8 m od pasa, 1,2 m/s), potem powrót na pas.
- **Strzały**: `Disturbance` typu `gunshot` w promieniu 45 m. Pojazd albo staje na 5 s, albo przyspiesza do 1,7 prędkości na 6 s; wybór z hasha identyfikatora i kroku, bez wspólnego RNG. Uciekający dalej staje przed ludźmi.
- **Kolizja z graczem**: pojazd nie ma ciała ani bryły. Ruch zatrzymuje go przed graczem, a system wypycha gracza z prostokąta pojazdu (wzdłuż krótszej osi przenikania). Bez fizyki potrąceń: pojazd nikogo nie przewraca ani nie rani, bo zawsze staje; gracz wchodzący w bok jadącego auta jest odsuwany. Potrącenia (ragdoll, obrażenia od prędkości) to osobna decyzja.
- **Pojawianie się**: pojazdy są w promieniu 260, 200, 140 m od gracza (`high`, `medium`, `low`) niezależnie od streamingu (wysokość z `GroundField` wszystkich chunków). Przychodzą i odchodzą poza wzrokiem gracza (stożek i linia wzroku jak u świadków, do 0,6 promienia); po nowej grze, wczytaniu, metrze i teleporcie ulica wypełnia się od razu. Koniec pasa: pojazd znika i wraca na początek z rozkładem; gdy gracz patrzy na koniec pasa, czeka tam.
- **Zapis i determinizm**: pojazdy mają identyfikatory od 3 000 000 (32 na pas), bez klucza, poza zapisem. Po wczytaniu stają na swoich miejscach z rozkładu (te same ziarno i zegar dają te same pojazdy, test). Złote hashe bez zmian: ca34413e, pojedynek 9dbab235, bez pól v13 32388f9c. Przebieg wzorcowy idzie deptakiem i nie dotyka mebli ani pojazdów; test ADR-0041 sprawdza teraz przebieg z tłumem i ruchem `high` (z pojazdami na Lubartowskiej i Królewskiej).

### Zaparkowane auta
- `content/parked-cars.ts`: przy prawym krawężniku dwukierunkowych ulic `residential`, `tertiary`, `unclassified`, których jezdnia sięga co najmniej 4,6 m od osi, co 6,2 m, 62% zajętych, nie bliżej niż 12 m od końców ulicy, 1,4 m plus pół auta od osi każdego pasa ruchu. Plac Zamkowy (w rzeczywistości parking) w rzędach przodem do siebie na bruku i płytach, 80% zajętych, z wolną obwodnicą placu i przejściem pieszym. Żadne dwa się nie nakładają, wszystkie z dala od ścian, mebli i treści gry. Razem 138 aut, na Placu Zamkowym 65.
- Każde to statyczna bryła chunka (prostokąt modelu, `STREET_ID_BASE`) i scenografia (widok `vehicle` z `parked`, z obrotem: `SceneryItem.yaw`).

### Kontrakty (`core`)
- `ViewDescriptor` `{ kind: "vehicle", model, tint, parked? }`, `VehicleModel` (`sedan`, `hatchback`, `taxi`, `van`, `delivery`, `trolleybus`) i `VEHICLE_SIZE` (wspólne wymiary dla kolizji i rysowania).
- Zdarzenie `VehicleHorned { vehicleId, at }` (tylko prezentacja) i dźwięk `horn`.

### Prezentacja
- **Pojazdy** (`VehicleViews` za fasadą `BabylonRenderer`): modele Car Kit z `city-kit.glb` (ADR-0022) rozciągnięte do rzeczywistych wymiarów, lakier w kolorze wierzchołka na materiale kitu (9 lakierów), trolejbus proceduralny (biały nad zielonym pasem, czerwony dach, ciemne szyby, dwa odbieraki do przewodów, cyjanowy pasek LED), dalekie wersje z kilku brył, światła świecą (glow). Jadące w jednej siatce przeliczanej na CPU co klatkę, zaparkowane w drugiej, przepisywanej tylko przy zmianie LOD: dwie siatki na całe miasto. LOD: szczegóły do 90, 70, 45 m, bryły do 240, 180, 120 m, dalej zwinięte. Bez cienia księżyca i obrysu, jak budynki kitu. Bez kitu (`?city=off`) pojazdów nie widać.
- **Meble** (`StreetProps`): zamiast instancji cienkich na rodzaj (jedno wywołanie na rodzaj w zasięgu, 17 do 20 siatek na deptaku) bliski blok 256 m piecze wszystkie swoje sztuki w jedną siatkę przy pierwszym zbliżeniu (jeden blok na klatkę, do tego czasu stoi jego daleka siatka), a halo wszystkich latarń miasta to jedna addytywna siatka. Na deptaku 7 siatek mebli zamiast 20. Drobiazgi bliskiego bloku są rysowane tak daleko jak reszta bloku: to wierzchołki, nie wywołania.
- `PerfProbe` raportuje aktywne siatki po nazwie (`byName`), żeby było widać, gdzie idzie budżet.

## Konsekwencje
- Pomiary scen `npr-perf` (SwiftShader, `models=off`, ADR-0046), wywołania rysowania / aktywne siatki, przed (gałąź z ADR-0048 i ADR-0049) i po:

| Scena | Przed | Po | Budżet |
|---|---|---|---|
| `reference` | 167 / 67 | 178 / 73 | 173 / 70 → 184 / 76 |
| `krakowskie-tpp` | 357 / 151 | 375 / 159 | 368 / 155 → 386 / 164 |
| `rynek-tpp` | 209 / 77 | 221 / 84 | 215 / 81 → 228 / 87 |
| `podzamcze-tpp` | 256 / 96 | 275 / 105 | 263 / 100 → 283 / 109 |
| `nabrzeze` | 224 / 94 | 230 / 97 | 232 / 99 (bez zmian) |
| `phone-low` | 226 / 141 | 232 / 147 | 233 / 145 → 239 / 151 |

  Z nowych siatek 6 do 7 to meble (bliskie bloki, dalekie bloki, jedno halo), 1 pojazdy, 1 zaparkowane auta (na Podzamczu). Meble jako instancje cienkie per rodzaj (ADR-0047) dawały na deptaku 17 do 20 siatek i o 15 wywołań więcej niż teraz; pieczenie per komórka 128 m (w dwóch siatkach, potem w jednej) 18 i 17. Dalsze cięcie wymagałoby wspólnej siatki dalekiej z bliską (podwójne drzewa w bloku przejściowym) albo krótszego zasięgu szczegółów, więc budżety idą kilka procent nad pomiar.
- Ujęcia gracza (zrzuty w scratchpadzie `streets/`, `high`, SwiftShader 1280 × 720, telefon 800 × 370 `low`), wywołania / siatki przed → po, mieszkańcy w świecie przed → po, pojazdy po:

| Ujęcie | Wywołania | Siatki | Mieszkańcy | Pojazdy (trolejbusy) |
|---|---|---|---|---|
| Krakowskie 20:00 | 359 → 375 | 151 → 159 | 24 → 64 | 22 |
| Plac Litewski 18:00 | 124 → 137 | 45 → 51 | 22 → 77 | 29 |
| Rynek 21:00 | 145 → 152 | 48 → 52 | 14 → 64 | 14 |
| Plac Zamkowy 17:00 | 321 → 345 | 150 → 160 | 21 → 55 | 48 (4) |
| al. Tysiąclecia 8:00 | 301 → 319 | 118 → 126 | 6 → 16 | 86 (6) |
| telefon, deptak 20:00 | 227 → 233 | 141 → 147 | 8 → 12 | 0 |
- Kadr referencyjny NPR mieści się w migawce (różnica poniżej progu): latarnie i ławki deptaka w kadrze Neon Koi to drobne zmiany.
- Targ pod wiaduktem stoi na Alei Tysiąclecia (ADR-0045). Pasy aut kończą się przed bryłami gry, które stoją na jezdni niżej niż 3 m nad terenem (hale, filary, schody); pomost wiaduktu przepuszcza. Pas ucięty przed targiem zawraca półkolem na pas drugiej jezdni, a auto zwalnia w zawrocie do 4 m/s. Wcześniej auta przejeżdżały przez hale i filary.
- Pojazdy jadące pod kątem od 45° (włączanie się na rondo) ustępują sobie jak na skrzyżowaniu. Wcześniej liczyły się jak jadące tym samym pasem i na rondzie Dmowskiego wjeżdżały w siebie.
- Na później:
  - fizyka potrąceń i obrażenia od pojazdu, strzelanie do aut (kule przelatują przez pojazdy), wsiadanie;
  - skrzyżowania: auta z różnych pasów przejeżdżają przez siebie na skrzyżowaniu, sygnalizacja nie steruje ruchem, pas kończy się zniknięciem auta zamiast skrętu w inną ulicę;
  - przejścia dla pieszych jako miejsca, gdzie tłum przechodzi przez jezdnię (dziś trasy tłumu są na ulicach pieszych, a auto staje przed każdym, kto wejdzie na jezdnię);
  - piesi siedzący nie wstają, gdy przy ławce przechodzi gracz; nie ma kelnerów w ogródkach;
  - `low` daje mało aut (zaokrąglenie: pas z jednym autem przy udziale 0,45 i poziomie poniżej 1 jest pusty).
