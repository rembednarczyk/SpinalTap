# Gabinet wszczepów NEUROTEK (`alchemia-shop-p1-e3`)

Alchemia, P1, lokal p1-e3 (7,8 × 4,6 m), witryną na zachodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

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
- §12 częściowo: rzut z planu galerii (7,8 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (cyjan i czysta biel). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 dług: 5 rzeczy drobiazgu, 40% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-case-implants × 8
- blender: rd-gl-implants × 13
- blender: rd-gl-implants-b × 16
- blender: rd-gl-stock × 10
- blender: rd-gl-stock-b × 17
- model: figure × 1
- model: street-cabinet × 1
- piece: cable × 3
- piece: carton × 5
- piece: counter × 3
- piece: cup × 1
- piece: display × 4
- piece: duct × 1
- piece: error × 1
- piece: goods × 1
- piece: lamp × 5
- piece: machine × 5
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 21
- piece: roof × 5
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 36 m², wysokość 4,2 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 19
- warstwy wyposażenia: makro 24, mezo 24, mikro 5
- drobiazg w skupiskach (≥ 3 w 1,2 m): 1 skupisk, 3 rzeczy w nich, 2 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
