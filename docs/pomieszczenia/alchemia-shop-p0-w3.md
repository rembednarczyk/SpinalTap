# Apteka APTEKA NOVA (`alchemia-shop-p0-w3`)

Alchemia, P0 (dawna hala), lokal p0-w3 (7,6 × 4,6 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

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
- §12 częściowo: rzut z planu galerii (7,6 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: lampa lokalu w trybie wnętrza Alchemii (zielony krzyż i zimna biel). Dług: lada i drzwi zaplecza w barwie nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 31,7%, światło 68,2%, akcenty 0,1%, poza pasmem: baza 31,7% < 50%; światło 68,2% > 42%; akcenty 0,1% < 3%; po strojeniu ekspozycji sklepów (moc lampy według farby ścian, ściany w średnim tonie): baza 68,7%, światło 31,1%, akcenty 0,2%, poza pasmem: akcenty 0,2% < 3%. Dług: zielony krzyż apteki jako neon wewnątrz.
- §14 zgodne: 16 rzeczy drobiazgu, 0% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-cups × 1
- blender: rd-c-papers × 1
- blender: rd-gl-case-pharmacy × 6
- blender: rd-gl-pharmacy × 15
- blender: rd-gl-pharmacy-b × 17
- blender: rd-gl-stock × 14
- blender: rd-gl-stock-b × 10
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
- piece: roof × 1
- piece: shopfront × 3
- piece: sign × 1
- piece: vitrine × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 35 m², wysokość 3,8 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 15
- warstwy wyposażenia: makro 27, mezo 20, mikro 16
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 16 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
