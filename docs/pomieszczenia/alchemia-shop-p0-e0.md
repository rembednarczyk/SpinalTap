# Sklep z bronią TETSU (`alchemia-shop-p0-e0`)

Alchemia, P0 (dawna hala), lokal p0-e0 (7,6 × 4,6 m), witryną na zachodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Sklep z bronią legalną i półlegalną: gabloty z pistoletami, amunicja za kratą. Właściciel zna każdego klienta z ksywki. Lokal otwarty, sprzedawca za ladą.

## Klimat
Ostre białe reflektory nad gablotami, czerwona lampka alarmu. Szczęk zamków, zapach smaru.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach;
- ekrany na ścianach;
- gabloty na wyspach i w witrynie;
- krata nad ladą przy kasie;
- szafy techniczne na zapleczu (model gry `street-cabinet`);
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: kubek na ladzie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica; druga: technika.
- §12 częściowo: rzut z planu galerii (7,6 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (ostra biel i czerwona lampka alarmu). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 7 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-papers × 1
- blender: rd-gl-arms × 12
- blender: rd-gl-arms-b × 17
- blender: rd-gl-case-arms × 7
- blender: rd-gl-stock × 17
- blender: rd-gl-stock-b × 7
- model: figure × 1
- model: street-cabinet × 1
- piece: cable × 3
- piece: carton × 5
- piece: counter × 3
- piece: cup × 1
- piece: display × 5
- piece: duct × 1
- piece: goods × 1
- piece: grille × 1
- piece: lamp × 5
- piece: machine × 5
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 21
- piece: shopfront × 3
- piece: sign × 1
- piece: steam × 2
- piece: vitrine × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 35 m², wysokość 3,8 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 15
- warstwy wyposażenia: makro 24, mezo 25, mikro 7
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 7 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
