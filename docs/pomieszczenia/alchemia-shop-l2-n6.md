# Serwis DATAFIX (`alchemia-shop-l2-n6`)

Alchemia, L2 frontu, lokal l2-n6 (7,0 × 10,4 m), witryną na południową stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Serwis napraw: telefony, drony, protezy. Na ladzie numerki zleceń, w kącie urządzenia czekające na części od miesięcy. Lokal otwarty, sprzedawca za ladą.

## Klimat
Lampa warsztatowa nad stołem, reszta w cieniu. Brzęczenie lutownicy, zapach przypalonej izolacji.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach;
- stoły warsztatowe na wyspach;
- szafy techniczne na zapleczu (model gry `street-cabinet`);
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: terminal z błędem na ekranie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: technika; druga: ulica.
- §12 częściowo: rzut z planu galerii (7,0 × 10,4 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (lampa warsztatowa nad stołem). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 dług: 7 rzeczy drobiazgu, 57% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-case-repair × 8
- blender: rd-gl-repair × 39
- blender: rd-gl-repair-b × 25
- blender: rd-gl-stock × 17
- blender: rd-gl-stock-b × 28
- model: figure × 1
- model: street-cabinet × 3
- piece: cable × 5
- piece: carton × 5
- piece: ceiling-light × 13
- piece: counter × 2
- piece: cup × 1
- piece: display × 2
- piece: duct × 1
- piece: error × 1
- piece: goods × 3
- piece: lamp × 4
- piece: led × 1
- piece: machine × 5
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 21
- piece: roof × 1
- piece: shopfront × 3
- piece: sign × 1
- piece: table × 2
- piece: vitrine × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 73 m², wysokość 3,9 m
- siatka 0,5 m: 1 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 17
- warstwy wyposażenia: makro 26, mezo 35, mikro 7
- drobiazg w skupiskach (≥ 3 w 1,2 m): 1 skupisk, 3 rzeczy w nich, 4 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 19
<!-- inwentarz-gry:end -->
