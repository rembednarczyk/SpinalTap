# Salon VR NEUROVIA (`alchemia-shop-l2-s2`)

Alchemia, L2 frontu, lokal l2-s2 (5,6 × 6,9 m), witryną na północną stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Salon VR: fotele z goglami na godziny, kabiny za zasłonami. Stali klienci płacą z góry za całą noc. Krata zasunięta do połowy: lokal zamknięty dla klientów, ale towar stoi na miejscu, a za kratą pali się jedna lampa.

## Klimat
Fioletowy półmrok, poświata gogli. Szum wentylatorów komputerów, zapach potu i płynu do czyszczenia.

## Przeznaczenie
Zamknięty: gracz widzi go zza witryny albo kraty. Jedno wejście od galerii.

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach;
- ekrany na ścianach;
- kabiny VR na wyspach;
- ekran na stojaku w witrynie;
- szafy techniczne na zapleczu (model gry `street-cabinet`);
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: terminal z błędem na ekranie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: technika; druga: ulica.
- §12 częściowo: rzut z planu galerii (5,6 × 6,9 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (fiolet i poświata gogli). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 dług: 5 rzeczy drobiazgu, 40% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-stock × 14
- blender: rd-gl-stock-b × 15
- blender: rd-gl-vr × 8
- blender: rd-gl-vr-b × 21
- model: street-cabinet × 2
- piece: cable × 3
- piece: counter × 1
- piece: cup × 1
- piece: display × 6
- piece: duct × 1
- piece: error × 1
- piece: goods × 1
- piece: grille × 1
- piece: lamp × 2
- piece: led × 1
- piece: machine × 7
- piece: paper × 2
- piece: partition × 6
- piece: pipe × 2
- piece: rack × 23
- piece: shopfront × 3
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 39 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 16
- warstwy wyposażenia: makro 22, mezo 21, mikro 5
- drobiazg w skupiskach (≥ 3 w 1,2 m): 1 skupisk, 3 rzeczy w nich, 2 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 4
<!-- inwentarz-gry:end -->
