# Salon VR DREAMDECK (`alchemia-shop-p2-w1`)

Alchemia, P2, lokal p2-w1 (7,8 × 4,4 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Salon VR: fotele z goglami na godziny, kabiny za zasłonami. Stali klienci płacą z góry za całą noc. Lokal otwarty, sprzedawca za ladą.

## Klimat
Fioletowy półmrok, poświata gogli. Szum wentylatorów komputerów, zapach potu i płynu do czyszczenia.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

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
- §12 częściowo: rzut z planu galerii (7,8 × 4,4 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (fiolet i poświata gogli). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 62 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- model: figure × 1
- model: street-cabinet × 1
- piece: cable × 3
- piece: carton × 5
- piece: counter × 1
- piece: cup × 1
- piece: display × 5
- piece: duct × 1
- piece: error × 1
- piece: goods × 116
- piece: lamp × 3
- piece: machine × 6
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 23
- piece: shopfront × 3
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 34 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 14
- warstwy wyposażenia: makro 22, mezo 82, mikro 62
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 62 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 4
<!-- inwentarz-gry:end -->
