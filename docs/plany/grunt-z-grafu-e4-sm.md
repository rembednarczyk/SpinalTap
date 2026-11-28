# Graf ulic: Stare Miasto (ADR-0104 E4, ostatnia dzielnica)

Ciąg dalszy `grunt-z-grafu-e4.md`. Gałąź `feat/grunt-z-grafu-ulic-e4-sm` na `feat/grunt-z-grafu-ulic-e4` (PR #1096). Próba: `SEKI_STREET_GRAPH=stare-miasto` (Krakowskie, Podzamcze i Nabrzeże w `STREET_GRAPH_DISTRICTS`), skan wobec gałęzi E4.

## Runda 1: pierwsza próba (28.11)

- **Skan wobec E4:** suma 4445 → 4326. Spada: `kerb-fill-wide-estimated` 22 → 0, `ground-strip-gap` 1030 → 982, `kerb-gap-bare` 622 → 612, `sidewalk-gap` 286 → 278, `sidewalk-step` 355 → 349, `sidewalk-width-jump` 233 → 224, `landuse-bare` 662 → 651, `bare-on-cover` 343 → 331, `kerb-strip-bare` 9 → 5.
- **Rośnie, do sprawdzenia:** `sidewalk-under-carriageway` 22 → 28, `bus-stop-on-fill` 1 → 4, `lawn-strip-on-paving` 27 → 30, `footway-on-carriageway` 80 → 82, po jednym nowym `metro-exit-bare`, `walk-blocked`, `barrier-parallel-cut`, `crossing-shape-glow`.
- **Nawierzchnia:** ADR-0104 pkt 2 zakłada chodniki z reguł dzielnicy (`sidewalk-rules.ts`), ale takiego modułu nie ma. Bruk jezdni idzie z tagów OSM (`cobbled`), chodniki grafu są `sidewalk` (płyty). Do decyzji: chodnik grafu w obrębie murów (`OLD_TOWN_RING`) z nawierzchni zmapowanej drogi albo jako `cobble`; skan nie liczy rodzaju nawierzchni chodnika, więc to ocena kuratora na ortofoto.
- **Testy na próbie:** 30 czerwonych w 8 plikach. 24 to testy syntetyczne starych etapów (`generate`, `kerb-fill`, `zebra-fit`, `lane-fit`), które leżą we współrzędnych chunków Starego Miasta, ostatniej dzielnicy poza grafem: z całym miastem na grafie trzeba im dać `OFF_GRAPH` albo przenieść je do E6 (usunięcie starych etapów). Prawdziwe skutki do zbadania: `water-mask` (woda na zebrach, pomostach, krawężnikach albo trawnikach), `breaklines` (rząd aut przy parapecie Królewskiej, G-977), `crowd-square-barriers` (trasa placu na barierze, G-613), `kerb-bollards` (łańcuch po zachodniej stronie Wyszyńskiego, P4).
