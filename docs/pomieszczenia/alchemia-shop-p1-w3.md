# Lombard LOMBARD (`alchemia-shop-p1-w3`)

Alchemia, P1, lokal p1-w3 (7,8 × 9,2 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Lombard: zastawione wszczepy, zegarki, gitary, broń bez numerów. Właściciel siedzi za kratą kasy i wycenia rzeczy, zanim klient skończy zdanie. Lokal otwarty, sprzedawca za ladą.

## Klimat
Ciepłe, brudne żółte światło, kraty, kurz na gablotach. Tykanie zegarów.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały z zastawionymi rzeczami;
- gabloty na wyspach i w witrynie;
- krata nad ladą przy kasie;
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: niedokończony posiłek na ladzie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (7,8 × 9,2 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (brudny ciepły żółty). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 9 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-cartons × 1
- blender: rd-c-papers × 1
- blender: rd-gl-case-pawn × 20
- blender: rd-gl-pawn × 38
- blender: rd-gl-pawn-b × 31
- blender: rd-gl-stock × 6
- blender: rd-gl-stock-b × 6
- model: figure × 1
- piece: cable × 3
- piece: carton × 5
- piece: counter × 4
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: goods × 2
- piece: grille × 1
- piece: lamp × 6
- piece: machine × 1
- piece: pane × 2
- piece: paper × 2
- piece: partition × 6
- piece: pipe × 2
- piece: rack × 29
- piece: roof × 4
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 3

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 72 m², wysokość 4,2 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 20
- warstwy wyposażenia: makro 37, mezo 16, mikro 9
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 9 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 7
<!-- inwentarz-gry:end -->
