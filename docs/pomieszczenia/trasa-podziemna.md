# Trasa Podziemna (`trasa-podziemna`)

Piwnice pod Rynkiem, wejście z Trybunału Koronnego (ADR-0048). Przedsionek, klatka schodowa, korytarze i loch.

## Historia
Prawdziwa Lubelska Trasa Podziemna łączy kamienicze piwnice pod Starym Miastem. W 2077 trasa jest zamknięta dla turystów od dziesięciu lat: miasto nie ma na konserwację. Zanim ją zamknięto, w lochu śpiewała Mei, za monety wrzucane do futerału. Dziś zagląda tu ochrona Trybunału, bezdomni i ci, którzy czegoś szukają. Ktoś zostawił w lochu torbę.

## Klimat
Kamienne sklepienia, ceglane łuki, wilgotne ściany z wykwitami soli. Stare lampy muzealne, część zgaszona, część zastąpiona przenośnymi LED-ami na kablach. Tablice informacyjne trasy wyblakłe, z naklejkami gangów.

## Przeznaczenie
Miejsce zadania („m4-ulica”): torba w lochu, ślad Mei. Ciasne korytarze, jedno wejście z Trybunału, schronienie przed patrolami.

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/trasa.py`, 22.11) albo do zrobienia.

Architektura:
- łuki ceglane pod sklepieniami korytarzy: klińce na łuku odcinkowym i wypełnienie do stropu, w miejscu sześciu żeber (zrobione: `rd-trasa-arch-24`, `rd-trasa-arch-21`);
- muzealna lampa ścienna na kinkiecie, kabel z taśmą do LED-ów (zrobione: `rd-trasa-lamp`, jedna przy ciepłym pasku w korytarzu południowym);
- barierka muzealna z czerwoną liną na mosiężnych słupkach (zrobione: `rd-trasa-rope`);
- ceglane ściany i kamienne progi zamiast gładkich bloków (do zrobienia: powłoka korytarzy).

Duże obiekty:
- tablice informacyjne trasy na stojakach, wyblakłe, z naklejkami gangów (zrobione: `rd-trasa-board`, dwie);
- scena Mei w lochu: podest z desek, wykładzina, statyw z mikrofonem, otwarty futerał z monetami, skrzynka (zrobione: `rd-trasa-stage`);
- kolumna głośnikowa przy scenie (zrobione: `rd-trasa-speaker`);
- posłanie bezdomnego z kartonów i koca, kurtka zamiast poduszki (zrobione: `rd-trasa-bedding`);
- gabloty z dawnymi znaleziskami (do zrobienia).

Drobiazg:
- monety w futerale (zrobione: `rd-trasa-stage`), puszki i butelki przy posłaniu (zrobione: `rd-trasa-bedding`);
- torba w lochu (skrytka gry, osobny widok), niedopałki, naklejki na ścianach (do zrobienia).

## Frakcja i zasady
Frakcja: ulica (gangi w starych piwnicach); druga: historia (muzeum).
- §12 zgodne: ciasne przejścia i wyższa sala (7,6 m), 3 z 8 wymiarów na siatce (stare piwnice, §1).
- §13 zgodne co do źródeł (7 widocznych: lampy muzealne, LED-y na kablach). Dług: drogi wyjścia w barwie nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 27,4%, światło 69,8%, akcenty 2,9%, poza pasmem: baza 27,4% < 50%; światło 69,8% > 42%; akcenty 2,9% < 3%.
- §14 zgodne: 14 rzeczy drobiazgu w czterech skupiskach (legowisko, scena, tablice), nic luzem.
- §15 częściowo: wilgotne ściany w opisie; do sprawdzenia połysk w grze.
- §16 zgodne.
- §17 do sprawdzenia: kapanie i echo.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-trasa-arch-21 × 3
- blender: rd-trasa-arch-24 × 3
- blender: rd-trasa-bedding × 1
- blender: rd-trasa-board × 2
- blender: rd-trasa-lamp × 1
- blender: rd-trasa-rope × 1
- blender: rd-trasa-speaker × 1
- blender: rd-trasa-stage × 1
- prop: blok (concrete) × 4
- prop: blok (concrete), rysunek osobno × 6
- prop: blok (concrete, pochyły) × 1
- prop: blok (metal) × 1
- prop: blok (metal), rysunek osobno × 2
- prop: neon × 6

Pomiary zasad (§12–§16):
- rzut: 4 prostokąty, 104 m², wysokość 3,6 / 7,6 / 2,7 m
- siatka 0,5 m: 3 z 8 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 7
- warstwy wyposażenia: makro 11, mezo 11, mikro 14
- drobiazg w skupiskach (≥ 3 w 1,2 m): 4 skupisk, 14 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 7
<!-- inwentarz-gry:end -->
