# Elektronika CYBERDECK (`alchemia-shop-l2-s1`)

Alchemia, L2 frontu, lokal l2-s1 (5,8 × 6,9 m), witryną na północną stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

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
- §12 częściowo: rzut z planu galerii (5,8 × 6,9 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (niebieski ekranów i zielone diody). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 13 rzeczy drobiazgu, 8% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-cable × 1
- blender: rd-c-cups × 1
- blender: rd-c-laptop × 1
- blender: rd-c-papers × 1
- blender: rd-gl-case-electronics × 7
- blender: rd-gl-electronics × 14
- blender: rd-gl-electronics-b × 21
- blender: rd-gl-stock × 24
- blender: rd-gl-stock-b × 11
- model: figure × 1
- model: street-cabinet × 2
- piece: cable × 3
- piece: ceiling-light × 6
- piece: counter × 2
- piece: cup × 1
- piece: display × 4
- piece: duct × 1
- piece: error × 1
- piece: goods × 1
- piece: lamp × 4
- piece: led × 2
- piece: machine × 5
- piece: paper × 2
- piece: partition × 6
- piece: pipe × 2
- piece: rack × 27
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 40 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 15
- warstwy wyposażenia: makro 30, mezo 25, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 12 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 13
<!-- inwentarz-gry:end -->
