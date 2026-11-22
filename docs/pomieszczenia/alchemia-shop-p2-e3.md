# Pusty lokal P2-E3 (`alchemia-shop-p2-e3`)

Alchemia, P2, lokal p2-e3 (7,8 × 4,6 m), witryną na zachodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Pusty lokal po marce, której nikt już nie pamięta: gołe ściany, kable z sufitu, kartony, drabina i puszka farby. Ktoś zaczął remont i przestał; ktoś inny tu nocuje.

## Klimat
Jedna goła żarówka na kablu, reszta w cieniu galerii zza witryny. Kurz, zapach farby i stęchlizny.

## Przeznaczenie
Kryjówka i miejsce na ślad (§5): ktoś tu nocuje. Jedno wejście od galerii.

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- kartony w trzech stosach, drabina przy ścianie, puszka farby;
- goła żarówka na kablu z sufitu;
- kubek i śmieci przy drzwiach.

## Frakcja i zasady
Frakcja: ulica (pustostan).
- §12 częściowo: rzut z planu galerii (7,8 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: jedyne źródło to goła żarówka; zgodne z brakiem światła znikąd.
- §14 zgodne: 15 rzeczy drobiazgu, 7% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne: pustostan ulicy.
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-gl-stock × 10
- blender: rd-gl-stock-b × 12
- piece: cable × 3
- piece: carton × 11
- piece: cup × 1
- piece: duct × 1
- piece: goods × 4
- piece: lamp × 2
- piece: paper × 8
- piece: partition × 5
- piece: pipe × 2
- piece: plaster × 1
- piece: rack × 10
- piece: roof × 10
- piece: shopfront × 1
- piece: sign × 1
- piece: steam × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 36 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 22
- warstwy wyposażenia: makro 10, mezo 15, mikro 15
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 14 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 3
<!-- inwentarz-gry:end -->
