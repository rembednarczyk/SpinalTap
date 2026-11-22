# Elektronika VOLTAGE (`alchemia-shop-p1-s2`)

Alchemia, P1, lokal p1-s2 (3,8 × 4,8 m), witryną na północną stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Elektronika z drugiej ręki: telefony, decki, kable, części do wszczepów. Sprzedawca naprawia przy ladzie to, czego nie sprzedał. Lokal otwarty, sprzedawca za ladą.

## Klimat
Niebieskie ekrany demo, zielone diody ładowarek. Pisk zasilaczy, zapach kalafonii.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach i na wyspach;
- ekrany na ścianach;
- szafy techniczne na zapleczu (model gry `street-cabinet`);
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: terminal z błędem na ekranie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: technika; druga: ulica (towar z drugiej ręki).
- §12 częściowo: rzut z planu galerii (3,8 × 4,8 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (niebieski ekranów i zielone diody). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 12 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-cups × 1
- blender: rd-c-laptop × 1
- blender: rd-c-papers × 1
- blender: rd-gl-electronics × 5
- blender: rd-gl-electronics-b × 1
- blender: rd-gl-stock × 8
- blender: rd-gl-stock-b × 12
- model: figure × 1
- piece: cable × 3
- piece: counter × 1
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: error × 1
- piece: goods × 1
- piece: lamp × 3
- piece: machine × 2
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 14
- piece: shopfront × 3
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 18 m², wysokość 4,2 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 14
- warstwy wyposażenia: makro 15, mezo 8, mikro 12
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 12 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 4
<!-- inwentarz-gry:end -->
