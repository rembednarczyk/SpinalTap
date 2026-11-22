# Katalog wyposażenia wnętrz (ADR-0099)

Wykaz potrzeb zebrany z inwentarzy docelowych wszystkich kart (`docs/pomieszczenia/*.md`) i z kolejki zasad (`docs/backlog.md`, §12–§17), ułożony rodzinami modeli, a nie pokojami. Każda pozycja ma kotwicę (gdzie generator ją stawia), rolę (główna, wspierająca, drobiazg) i miejsca, w których jest potrzebna. Pozycje zrobione mają klucz kształtu; reszta to partie modeli z etapów 3 i 4 ADR-0099.

## Rodzina 1: drobiazg wspólny (partia 1)
Drobiazg, kotwice `floor-free`, `floor-wall`, `table-top`, `counter-top`; zawsze w skupiskach (§14).
- śmieci przy ścianie: zgnieciony kubek, opakowanie, puszka, worek (perony, korytarze, Trasa, tunel P-2, P-1, schron);
- niedopałki i puszka przy drzwiach i w kątach (Trasa, perony, tunel P-2: `rd-p2t-butts`);
- kubki papierowe i plastikowe z pokrywką (galeria, biura, perony, sklepy);
- kartony płaskie i w stosie, taśma (zaplecza food hallu i sklepów, magazyny W-3, P-2);
- papiery, ulotki, paragony, rachunki (lady sklepów, biura, food hall, Koi);
- kable zwinięte i luzem z taśmą (klinika, sklepy elektroniki i napraw, biuro Tessen, galeria);
- butelki i puszki na blacie (Koi, perony, Trasa);
- telefon na ładowarce, power bank (food hall, kapsuła: `rd-capsule-charger`, lady sklepów);
- laptop z błędem na ekranie (galeria, biuro Tessen, sklepy elektroniki).

## Rodzina 2: oznakowanie i instalacje (partia 1)
Wspierające i architektura (§12, §13).
- znak wyjścia ewakuacyjnego nad drzwiami (`wall` nad otworem; hala W-3: `rd-w3h-exit`, galeria: bryły `led-green`; do zrobienia: tunel P-2 nad portalem i bramą schronu, P-1, P-2, perony, klinika, Koi);
- tablica ostrzegawcza (`wall`; `rd-w3h-warning`; do zrobienia: P-2, tunel P-2, piwnica W-3);
- gaśnica z tabliczką (`floor-wall` przy drzwiach; wszystkie wnętrza publiczne i przemysłowe);
- szafka hydrantowa (`wall`; tunel P-2, P-1, P-2, galeria);
- skrzynka rozdzielcza z listwą (`wall`; tunel P-2, piwnica W-3: `rd-w3b-panel`, biuro Tessen);
- kratka odpływu w posadzce (`floor-free`; tunel P-2, P-2, piwnica W-3, food hall przy kuchniach);
- korytko kablowe i rury pod stropem (`ceiling`, instalacje; tunel P-2, food hall, klinika, Koi; zrobione: hala W-3, P-1, P-2, piwnica W-3);
- listwy kablowe po ścianach (`wall`; biuro Tessen, klinika);
- odbojnice przy ścianach (`wall` nisko; tunel P-2, P-1).

## Rodzina 3: ślady i woda (partia 1, §15)
Drobiazg płaski, kotwice `floor-free` przy źródle.
- kałuża przy źródle wody (portal tunelu P-2, przecieki, kuchnie, perony przy wejściu z deszczu): połysk mokrej posadzki;
- plama oleju (`rd-p2-oil`; do zrobienia: P-1 przy autach, hala W-3 przy maszynach);
- zacieki pod sufitem i na ścianach (dylatacje tunelu, schron, piwnica W-3);
- ślady butów w kurzu (`rd-shelter-prints`; do zrobienia: Trasa, piwnica W-3).

## Rodzina 4: zestawy rodzajów pomieszczeń (partia 2)
- **sklep według branży** (`counter-top`, `shelf`, `floor-wall`): lada z kasą i drobiazgiem przy kasie (kasa, paragony, kubek, długopis) dla każdej branży; regały i gabloty są (`rd-gl-*`, `rd-gl-case-*`). Dług kart: 30 sklepów z drobiazgiem luzem powyżej 25%.
- **kuchnia food hallu** (zrobione w #918: `rd-fh-till`, `rd-fh-prep`, garnki, miski); do zrobienia: kartony z dostaw na zapleczach, frytownica, okap jako model.
- **peron metra** (`floor-wall`, `floor-free`): kosz na śmieci z drobiazgiem obok, skrzynki targowe (targ), automat z napojami (model gry `vending-machine`), ławka z rzeczami (`rd-metro-litter`). Dziś po 4 rzeczy drobiazgu na peron.
- **biuro korporacji** (biuro Tessen): fotel na kółkach, niszczarka z paskami papieru, segregatory; lada z szybą i okienkiem (wymaga bryły symulacji).
- **hala przemysłowa** (W-3): szafki w rzędach z drobiazgiem (kask, rękawice, termos), szafy sterownicze, zbiorniki zamiast bloków.
- **bar** (Neon Koi): naklejki na lustrze, ulotki zespołów, girlanda lampionów; boksy z kanapami (wymagają brył symulacji).
- **klinika**: kafle ścienne z łatami, kotara na szynie, plakat anatomiczny, ramki monitorów „PULS 48”, sejf lombardu, biurko Moriego z dwoma monitorami (bryły symulacji).
- **trasa podziemna**: gabloty z dawnymi znaleziskami, naklejki gangów na ścianach.
- **korytarz techniczny** (tunel P-2): wózek serwisowy przy szybie windy, oprawy w kratkach jako bryły rysunku.
- **galeria**: fontanna w atrium z misą i dyszami.

## Rzeczy fabularne (ręcznie, przed generatorem)
Stawiane w `*-detail.ts`, nie przez generator: sprzęt Hebi w schronie, szafka 14 i terminal kolektora w W-3, lady postaci z zadań, torba w lochu Trasy, skrytka przemytników w piwnicy W-3, rzeczy technika w P-2, stanowiska spawaczy W-3 (#920).
