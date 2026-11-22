# Gabinet wszczepów CHROMEDOC (`alchemia-shop-p2-n1`)

Alchemia, P2, lokal p2-n1 (5,7 × 4,8 m), witryną na południową stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Gabinet wszczepów kosmetycznych i drobnych: oczy, porty, skóra. Zabiegi za parawanem, faktury bez nazwisk. Lokal otwarty, sprzedawca za ladą.

## Klimat
Cyjan i biel, czysto przy fotelu, brudno na zapleczu. Szum sterylizatora, zapach ozonu.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach;
- ekrany na ścianach;
- gabloty na wyspach i w witrynie;
- szafy techniczne na zapleczu (model gry `street-cabinet`);
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: terminal z błędem na ekranie;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: technika; druga: korporacja (wszczepy z licencją).
- §12 częściowo: rzut z planu galerii (5,7 × 4,8 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (cyjan i czysta biel). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 13 rzeczy drobiazgu, 8% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-laptop × 1
- blender: rd-c-papers × 1
- blender: rd-gl-case-implants × 3
- blender: rd-gl-implants × 5
- blender: rd-gl-implants-b × 1
- blender: rd-gl-stock × 21
- blender: rd-gl-stock-b × 12
- model: figure × 1
- piece: cable × 3
- piece: carton × 4
- piece: counter × 2
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: error × 1
- piece: goods × 5
- piece: lamp × 5
- piece: machine × 2
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 15
- piece: roof × 2
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 27 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 16
- warstwy wyposażenia: makro 16, mezo 16, mikro 13
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 12 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
