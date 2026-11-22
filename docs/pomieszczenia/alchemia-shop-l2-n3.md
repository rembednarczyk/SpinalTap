# Kwiaciarnia BONSAI (`alchemia-shop-l2-n3`)

Alchemia, L2 frontu, lokal l2-n3 (5,5 × 10,4 m), witryną na południową stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Kwiaciarnia z plastikowymi kwiatami i nielicznymi żywymi pod lampą wzrostu. Żywe kosztują tyle co tygodniowa racja. Lokal otwarty, sprzedawca za ladą.

## Klimat
Różowo-fioletowa lampa wzrostu nad żywymi, reszta w półmroku. Kapanie wody, zapach mokrej ziemi.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach;
- kwiaty na wyspach i w witrynie;
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: kubek na ladzie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (5,5 × 10,4 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (róż i fiolet lampy wzrostu). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 7 rzeczy drobiazgu, 14% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-florist × 31
- blender: rd-gl-florist-b × 46
- blender: rd-gl-stock × 11
- blender: rd-gl-stock-b × 17
- model: figure × 1
- model: shrubs × 10
- piece: cable × 3
- piece: carton × 5
- piece: ceiling-light × 8
- piece: counter × 4
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: goods × 1
- piece: lamp × 3
- piece: machine × 1
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 28
- piece: shopfront × 3
- piece: sign × 1
- piece: steam × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 57 m², wysokość 3,9 m
- siatka 0,5 m: 1 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 14
- warstwy wyposażenia: makro 32, mezo 29, mikro 7
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 6 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 12
<!-- inwentarz-gry:end -->
