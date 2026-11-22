# Sklep z syntetyczną żywnością MOGUMOGU (`alchemia-shop-p2-n2`)

Alchemia, P2, lokal p2-n2 (5,7 × 4,8 m), witryną na południową stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Sklep z syntetyczną żywnością: konserwy białkowe, napoje energetyczne, makaron w kubkach. Kasjer drzemie, lodówki buczą. Krata zasunięta do połowy: lokal zamknięty dla klientów, ale towar stoi na miejscu, a za kratą pali się jedna lampa.

## Klimat
Jasne świetlówki, zimny blask lodówek i automatów. Buczenie agregatu, zapach plastiku i soi.

## Przeznaczenie
Zamknięty: gracz widzi go zza witryny albo kraty. Jedno wejście od galerii.

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
- §12 częściowo: rzut z planu galerii (5,7 × 4,8 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (zimne świetlówki i blask automatów). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 16 rzeczy drobiazgu, 6% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-food × 6
- blender: rd-gl-food-b × 2
- blender: rd-gl-stock × 18
- blender: rd-gl-stock-b × 15
- model: vending-machine × 1
- piece: cable × 3
- piece: carton × 5
- piece: counter × 1
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: goods × 13
- piece: grille × 1
- piece: lamp × 2
- piece: machine × 1
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 15
- piece: roof × 2
- piece: shopfront × 3
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 27 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 17
- warstwy wyposażenia: makro 16, mezo 11, mikro 16
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 15 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 3
<!-- inwentarz-gry:end -->
