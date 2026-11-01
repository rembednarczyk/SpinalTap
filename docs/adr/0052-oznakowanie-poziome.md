# ADR-0052: Oznakowanie poziome Lublina 2077: z danych mapy, w neonowej farbie, jezdnia na wierzchu

## Kontekst
Jezdnie miasta z danych mapowych (ADR-0042, ADR-0044) miały tylko linie, które shader dorysowywał na długich, prostych pasach jezdni: przerywaną oś i krawędzie, bez względu na liczbę pasów, kierunek, skrzyżowania i przejścia. Importer pomijał przejścia dla pieszych jako „oznakowanie poziome”. Część jezdni leżała pod innymi nawierzchniami, czyli była od nich niżej:
- Królewska pod płytami placu Łokietka;
- alejki i chodniki przecinające ulice;
- chodniki ciągnięte przez skrzyżowania.

Na 7400 punktów tras samochodów 380 leżało pod inną nawierzchnią.

## Decyzja

### Jezdnia na wierzchu
Kolejność nawierzchni (wysokość nad terenem w `SURFACE_LIFT`):

| Nawierzchnia | Wysokość |
|---|---|
| plac, bruk placów | 0,08 m |
| alejka | 0,09 m |
| jezdnia | 0,10 m |
| tory | 0,105 m |
| zebra, linie | 0,13 m |
| pasy rowerowe i autobusowe | 0,12 m |
| chodnik | 0,16 m |

Jezdnia i to, co na niej namalowane, leżą więc nad placami i ścieżkami, a pod podniesionymi chodnikami. Odstępy mają kilka centymetrów, bo dwie siatki kładzione na teren różnie gęsto rozjeżdżają się na zboczu o tyle.

Tabela `SURFACE_LIFT` mieszka w `core` (`world/city-geo.ts`), nie w rendererze (G-130): renderer kładzie według niej nawierzchnie, a symulacja stawia na tej samej wysokości to, co stoi na bruku. Zaparkowane auta i pojazdy scen (auto, furgonetka, wrak) stoją poziomo na najwyższym punkcie nawierzchni rysowanej pod ich obrysem (narożniki, środki boków, środek; `restingY` w `sim/content/lublin/terrain.ts`), zapadnięte w nią najwyżej 5 cm. Renderer obraca pojazd tylko o kąt kursu, więc na stoku dolne koła odstają od bruku. Dlatego auto nie parkuje tam, gdzie nawierzchnia pod jego obrysem opada o więcej niż 0,15 m (`LEVEL_DROP`); takie miejsce przy krawężniku przesuwa się wzdłuż niego o 1,5 albo 2,5 m albo zostaje puste. Pochylenie aut (G-133) wymaga zmiany kontraktu (`Transform`).

Chodnik (dokładany przez importer albo zmapowany osobno, `footway=sidewalk`) jest przycinany tam, gdzie jego środek wchodzi na inną jezdnię. Kończy się więc na krawężniku ulicy, którą spotyka.

### Przejścia dla pieszych
Nowa nawierzchnia `crossing` to pas w poprzek jezdni (dłuższy bok w poprzek). Powstaje w dwóch przypadkach:
- z oznakowanej drogi przejścia (`footway=crossing`, `cycleway=crossing`); nieoznakowana zostaje samym asfaltem;
- z węzła `highway=crossing` na jezdni, przez który nie biegnie żadna droga przejścia: pas szeroki jak jezdnia i długi na 3 m.

Renderer maluje białe pasy wzdłuż jezdni, 0,5 m z taką samą przerwą (P-10), od krawężnika do krawężnika, z cienką samoświecącą turkusową linią wzdłuż obu krawędzi.

### Linie
Typ `RoadMarkingKind` w `core` ma rodzaje:
- `centre-dash` (P-1);
- `centre-double` (P-4, od czterech pasów);
- `lane-dash`;
- `edge` (P-7, na drogach głównych od 9 m szerokości);
- `stop` (P-14);
- `cycle-lane` i `bus-lane`.

Widok `road-marking` to jedna linia (rodzaj i polilinia).

Importer (`tools/osm-import/src/markings.ts`) liczy pasy z `lanes`, `lanes:forward` i `lanes:backward`, `oneway` i szerokości jezdni. Domyślnie przyjmuje pas 3,25 m. Granice między pasami leżą w odstępach `szerokość / pasy` od lewego krawężnika, a kierunki spotykają się po pasach „wstecz”. Ruch jest prawostronny.

Linii nie dostają:
- bruk Starego Miasta;
- `living_street`, `service`;
- tunele;
- drogi z `lane_markings=no`.

Pasy rowerowe i autobusowe biegną przy krawężniku (`cycleway*`/`busway*` = `lane`).

Linie zatrzymania stoją przed sygnalizacją (`highway=traffic_signals`, filtr OSM zachowuje te węzły) w poprzek pasów jadących ku światłom, 4 m przed nimi. Jeśli w tym miejscu leży skrzyżowanie, linia cofa się przed nie.

Każda linia jest przecinana tam, gdzie wchodzi na inną jezdnię albo zebrę, tak jak farba. W centrum wychodzi 644 linii.

Renderer (`mapcity/marking-plan.ts`) rysuje linie geometrią w siatce gruntu komórki, bez nowych wywołań rysowania. Kreski są wycentrowane na linii: oś 3 m kreski i 5 m przerwy, pasy 2 m kreski i 4 m przerwy. Farba jest samoświecąca i nocą świeci na mokrym asfalcie. Kolory:

| Linia | Kolor | Szerokość |
|---|---|---|
| oś | neonowy róż | 0,12 m |
| między pasami | turkus | 0,12 m |
| krawędź | chłodna biel | 0,15 m |
| zatrzymania | jasna biel | 0,45 m |
| pas rowerowy | ciemnofioletowe pole z jaśniejszymi brzegami | 1,5 m |
| pas autobusowy | ciemnobursztynowe pole z jaśniejszymi brzegami | 1,5 m |

Stare linie z shadera jezdni odpadają. Pole `strip` zostaje tylko dla podkładów torów.

## Konsekwencje
- Nowe dane w chunkach: `markings` w `LublinChunkData`, a w `data/osm` tagi węzłów przejść i sygnalizacji. Złote hashe bez zmian, bo scenografia nie jest stanem gry.
- Liczba wywołań rysowania i aktywnych siatek w scenach perf bez zmian; rośnie tylko liczba wierzchołków siatek gruntu.
- Bruk Placu Zamkowego leży nad trasą aut, bo parking jest tam naprawdę brukowany.
- Na później:
  - strzałki kierunkowe na pasach;
  - napis BUS;
  - miejsca parkingowe;
  - przejścia rowerowe w innym wzorze niż zebra.
