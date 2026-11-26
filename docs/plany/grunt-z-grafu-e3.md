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
