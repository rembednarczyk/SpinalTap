# Rejestr odstępstw od topografii Lublina

Prowadzi go agent `topography-curator` (`.claude/agents/topography-curator.md`). Źródła prawdy: OpenStreetMap i NMT z ADR-0042. Każde odstępstwo gry od prawdziwego Lublina jest tu wpisane: celowe z powodem i ADR-em, a niezamierzone ze zgłoszeniem w `docs/glitches.md`.

Statusy: `celowe`, `do poprawy` (z G-NNN), `poprawione (#PR)`.

## Odstępstwa

| ID | Miejsce (x, z) | W grze | W rzeczywistości | Rodzaj | Status |
|---|---|---|---|---|---|
| T-001 | Podzamcze, targ pod wiaduktem (`MARKET_AREA`) | budynki z OSM wycięte pod scenę targu, teren wyrównany (`PADS`) | zabudowa i spadek według OSM i NMT | wycięte budynki, teren | celowe (scena gry, ADR-0045); do przeglądu kuratora: zakres wycięcia |
| T-002 | Nabrzeże, doki (`DOCKS_AREA`, `DOCKS_BASIN`) | budynki wycięte, basen portowy obniżony o 3 m | brzeg Bystrzycy według OSM | wycięte budynki, teren | celowe (scena doków, ADR-0024, ADR-0045); do przeglądu kuratora |
| T-003 | `CAR_WASH_AREA` | budynek myjni wycięty | według OSM | wycięty budynek | celowe (G-102: myjnia na placu przed ratuszem); do przeglądu kuratora |
| T-004 | Stare Miasto, okolice Trybunału | teren pod Trybunałem obniżony (`PADS`), uskok do z ≈ −68 (z weryfikacji G-018) | według NMT | teren | do przeglądu kuratora |
| T-005 | Plac Zamkowy (738, 282) | kandelabry na zgadywanych 4 m od osi ulicy na bruku placu | brak węzłów latarni w OSM | meble | celowe do czasu danych (G-004) |

Pierwszy pełny audyt (cztery dzielnice) dopisze resztę wpisów.
