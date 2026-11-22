# Hala zakładu W-3 (`w3-hall`)

Zakład odzysku wody Tessenu na Nabrzeżu, za ogrodzeniem (ADR-0082). W jego wielkiej nawie Tessen montuje drony: dwie taśmy z ramionami, stanowiska S1–S4, palety części, suwnica, za ścianą komora testów; wokół rzędy S i N z magazynami, warsztatami i korytarzami.

## Historia
W-3 zbudowano w 2051, gdy Bystrzyca przestała nadawać się do picia. Tessen przejął zakład od miasta za symboliczną złotówkę, zwolnił połowę ludzi i wstawił roboty. Zbiorniki przeniósł do rzędów przy ścianach, a w nawie, gdzie stały, ustawił linię montażu dronów, o której w papierach zakładu nie ma ani słowa. W hali pracuje dziś kilkunastu techników na trzy zmiany, reszta to automatyka. Przy północnej ścianie przecieka rura spustowa, którą od miesięcy łata się taśmą i wiadrem. Ktoś z nocnej zmiany zostawił na pomoście toru suwnicy termos, kanapkę w folii i kask z rękawicami.

## Klimat
Przemysłowy mrok przecięty żółtymi lampami nad przejściami i zielonymi znakami ewakuacji. Iskry spawania na taśmach, szum napędów, kapanie. Barierki z łuszczącą się farbą, etykiety ostrzegawcze, kable w korytach pod sufitem. Korporacja tu nie sprząta, tylko liczy.

## Przeznaczenie
Teren infiltracji i walki (akt Tessenu): przejścia między zbiornikami jako osłony, dwa poziomy (posadzka i pomosty), wejście z wieży i wyjście do piwnicy. Autozapis wyłączony.

## Inwentarz docelowy
Linię rysuje silnik (`packages/engine/src/renderer/tessen-w3/`): taśmy, ramiona w ruchu, ekrany stanowisk, iskry, suwnica, drony w komorze testów, napisy i pasy ostrzegawcze. Bryły i przegrody hali daje symulacja (`tessen-w3/hall-inside.ts`, `rows-s.ts`, `rows-n.ts`).

Z Blendera (`tools/blender/rooms/w3_hall.py`, plik `room-detail-w3-props.glb`):
- cztery palety części na bryłach palet przy długich ścianach: skrzynie z ramionami wirników w dwóch warstwach, z pasami szablonowymi, etykietami i folią, albo worki granulatu i zwój kabla (`rd-w3h-pallet-crates`, `rd-w3h-pallet-sacks`); bryły palet zostają, siatka wnętrza hali je pomija;
- wózek paletowy zaparkowany przy ścianie (`rd-w3h-jack`);
- cztery beczki chemii na żółtej wannie wychwytowej, pompka ręczna w jednej (`rd-w3h-barrels`);
- przeciek: rura spustowa na ścianie, złącze owinięte taśmą, wiadro do połowy z wodą, kałuża, składana tabliczka „mokra podłoga” (`rd-w3h-leak`);
- koryto kablowe wzdłuż ściany południowej z trzema wiązkami i kablem zwisającym do puszki (`rd-w3h-trays`);
- na pomoście toru N: termos z kubkiem, kanapka w folii, kask z rękawicami (`rd-w3h-break`);
- znaki wyjścia ewakuacyjnego nad drzwiami (`rd-w3h-exit`), tablice ostrzegawcze na trzech ścianach (`rd-w3h-warning`).

Na telefonie (niska jakość) gra rysuje z tej listy tylko palety, bo stoją za bryły, które siatka hali pomija; resztę pomija jako drobiazg (`fine`, budżet trójkątów hali W-3 w `npr-perf`).

Do zrobienia w kolejnych krokach: koryta pod stropem nad linią, szafy sterownicze w rzędach, zbiorniki w rzędach (dziś bloki).

## Frakcja i zasady
Frakcja: korporacja (Tessen, przemysł); druga: technika (linia produkcyjna).
- §12 dług: 3 z 74 wymiarów na siatce. Kontrast: wejście przez biuro przepustek (ciasno) do hali (16 m): zgodne.
- §13 częściowo: lampy W-3 mają oprawy w geometrii silnika (świetlówki pod każdym stropem, `w3-inside-geometry.ts`, sprawdzone 22.11), choć pomiar kart ich nie widzi, bo nie są bryłami. Dług: drzwi do piwnicy i biura w barwie nawigacji.
- §14 dług: 13 rzeczy mikro, wszystkie luzem. Skupiska przy taśmach, stanowiskach spawania, szafkach.
- §15 częściowo: kapanie w opisie; plamy oleju z połyskiem przy maszynach.
- §16 zgodne: korporacja, która „nie sprząta, tylko liczy”.
- §17 częściowo: iskry i taśmy jako ruch; szum napędów ze źródła do sprawdzenia.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-w3h-barrels × 1
- blender: rd-w3h-break × 1
- blender: rd-w3h-exit × 2
- blender: rd-w3h-jack × 1
- blender: rd-w3h-leak × 1
- blender: rd-w3h-pallet-crates × 2
- blender: rd-w3h-pallet-sacks × 2
- blender: rd-w3h-trays × 1
- blender: rd-w3h-warning × 3
- prop: blok (concrete), rysunek osobno × 19
- prop: blok (concrete, pochyły) × 1
- prop: blok (metal) × 13
- prop: blok (metal), rysunek osobno × 63
- prop: blok (metal, pochyły) × 1

Pomiary zasad (§12–§16):
- rzut: 37 prostokąty, 3409 m², wysokość 16,0 / 13,4 / 10,0 / 5,0 / 4,5 / 2,6 / 7,5 / 6,0 m
- siatka 0,5 m: 3 z 74 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 52
- warstwy wyposażenia: makro 32, mezo 14, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 13 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
