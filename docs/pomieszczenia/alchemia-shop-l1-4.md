# Studio tatuażu BLACK LOTUS (`alchemia-shop-l1-4`)

Alchemia, L1 frontu, lokal l1-4 (4,0 × 5,1 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Studio tatuażu z fotelem przy witrynie: tusz UV i wzory, które świecą pod skórą. Tatuażysta robi też ślepe wzory pod porty wszczepów. Lokal otwarty, sprzedawca za ladą.

## Klimat
Magenta neonu, biały reflektor nad fotelem. Brzęczenie maszynki, zapach tuszu i spirytusu.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- niskie regały (1,2 m) z tuszami i wzornikami;
- ekrany ze wzorami na ścianach;
- fotele do tatuażu na wyspach;
- ekran na stojaku w witrynie;
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: kubek na ladzie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (4,0 × 5,1 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (magenta i biały punkt nad fotelem). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 10 rzeczy drobiazgu, 10% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-papers × 1
- blender: rd-gl-stock × 13
- blender: rd-gl-stock-b × 14
- blender: rd-gl-tattoo-b × 2
- model: figure × 1
- piece: cable × 3
- piece: carton × 4
- piece: ceiling-light × 3
- piece: counter × 1
- piece: cup × 1
- piece: display × 2
- piece: duct × 1
- piece: goods × 7
- piece: lamp × 4
- piece: machine × 2
- piece: paper × 2
- piece: partition × 4
- piece: pipe × 2
- piece: rack × 13
- piece: shopfront × 3
- piece: sign × 1
- piece: steam × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 20 m², wysokość 3,1 m
- siatka 0,5 m: 1 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 13
- warstwy wyposażenia: makro 12, mezo 19, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 12 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 8
<!-- inwentarz-gry:end -->
