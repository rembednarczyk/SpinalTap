# Sklep z syntetyczną żywnością KONBINI (`alchemia-shop-l1e-1`)

Alchemia, L1 frontu, skrzydło wschodnie, lokal l1e-1 (7,9 × 5,6 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Sklep z syntetyczną żywnością: konserwy białkowe, napoje energetyczne, makaron w kubkach. Kasjer drzemie, lodówki buczą. Lokal otwarty, sprzedawca za ladą.

## Klimat
Jasne świetlówki, zimny blask lodówek i automatów. Buczenie agregatu, zapach plastiku i soi.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach i na wyspach;
- automaty z jedzeniem w witrynie (model gry `vending-machine`), gdy witryna ma miejsce;
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: upuszczony karton z rozsypanym towarem przed ladą;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (7,9 × 5,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (zimne świetlówki i blask automatów). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 13 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-papers × 1
- blender: rd-gl-food × 15
- blender: rd-gl-food-b × 29
- blender: rd-gl-stock × 16
- blender: rd-gl-stock-b × 17
- model: figure × 1
- model: vending-machine × 2
- piece: cable × 3
- piece: carton × 6
- piece: ceiling-light × 6
- piece: counter × 1
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: goods × 7
- piece: lamp × 4
- piece: lightbox × 3
- piece: machine × 1
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 34
- piece: shopfront × 3
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 44 m², wysokość 2,8 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 14
- warstwy wyposażenia: makro 35, mezo 25, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 13 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 14
<!-- inwentarz-gry:end -->
