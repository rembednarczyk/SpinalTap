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
<!-- inwentarz-gry:end -->
