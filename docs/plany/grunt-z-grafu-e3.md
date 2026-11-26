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
