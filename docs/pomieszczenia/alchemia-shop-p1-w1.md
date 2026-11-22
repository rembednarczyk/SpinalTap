# Apteka MEDIFARM (`alchemia-shop-p1-w1`)

Alchemia, P1, lokal p1-w1 (7,8 × 4,4 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Apteka bez recepty: leki na receptę spod lady, stymulanty w kolorowych blistrach, plastry na porty wszczepów. Farmaceutka liczy tabletki przy kasie i nie patrzy klientom w oczy. Lokal otwarty, sprzedawca za ladą.

## Klimat
Zimne białe świetlówki, zielony krzyż w witrynie. Szum lodówki z insuliną, zapach środka dezynfekującego.

## Przeznaczenie
Tło handlu galerii i osłony przy walce na pasażu: lada, regały i gabloty. Jedno wejście od galerii, przez drzwi w witrynie; zaplecze bez drugiego wyjścia (ślepy zaułek).

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- regały na ścianach z towarem aptecznym;
- gabloty na wyspach i w witrynie;
- lada z terminalem i kasą (generator branż `shop-trades.ts`);
- zaplecze za ścianką z drzwiami;
- kable z sufitu;
- ślad obecności: upuszczony karton z rozsypanym towarem przed ladą;
- śmieci przy drzwiach;
- sprzedawca za ladą (model postaci).

## Frakcja i zasady
Frakcja: ulica (handel); druga: korporacja (leki z sieci).
- §12 częściowo: rzut z planu galerii (7,8 × 4,4 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (zielony krzyż i zimna biel). Dług: lada i drzwi zaplecza w barwie nawigacji; 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 10 rzeczy drobiazgu, 10% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-case-pharmacy × 6
- blender: rd-gl-pharmacy × 16
- blender: rd-gl-pharmacy-b × 19
- blender: rd-gl-stock × 14
- blender: rd-gl-stock-b × 11
- model: figure × 1
- piece: cable × 3
- piece: carton × 6
- piece: counter × 3
- piece: cup × 1
- piece: display × 1
- piece: duct × 1
- piece: goods × 7
- piece: lamp × 5
- piece: machine × 1
- piece: paper × 2
- piece: partition × 5
- piece: pipe × 2
- piece: rack × 28
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 34 m², wysokość 4,2 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 14
- warstwy wyposażenia: makro 27, mezo 21, mikro 10
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 9 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
