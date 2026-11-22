# Sklep z bronią HAGANE ARMS (`alchemia-shop-p2-w3`)

Alchemia, P2, lokal p2-w3 (7,8 × 9,2 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

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
- §12 częściowo: rzut z planu galerii (7,8 × 9,2 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (ostra biel i czerwona lampka alarmu). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 4 rzeczy drobiazgu, 25% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-arms × 23
- blender: rd-gl-arms-b × 24
- blender: rd-gl-case-arms × 22
- blender: rd-gl-stock × 7
- blender: rd-gl-stock-b × 6
- model: figure × 1
- model: street-cabinet × 3
- piece: cable × 3
- piece: carton × 5
- piece: counter × 4
- piece: cup × 1
- piece: display × 9
- piece: duct × 1
- piece: goods × 1
- piece: grille × 1
- piece: lamp × 6
- piece: machine × 9
- piece: pane × 2
- piece: paper × 2
- piece: partition × 6
- piece: pipe × 2
- piece: rack × 21
- piece: roof × 8
- piece: shopfront × 3
- piece: sign × 1
- piece: steam × 2
- piece: vitrine × 3

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 72 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 24
- warstwy wyposażenia: makro 30, mezo 34, mikro 4
- drobiazg w skupiskach (≥ 3 w 1,2 m): 1 skupisk, 3 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 7
<!-- inwentarz-gry:end -->
