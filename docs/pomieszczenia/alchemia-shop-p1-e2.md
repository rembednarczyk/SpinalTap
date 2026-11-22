# Sklep z syntetyczną żywnością MEGABOX (`alchemia-shop-p1-e2`)

Alchemia, P1, lokal p1-e2 (7,8 × 4,6 m), witryną na zachodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Sklep z syntetyczną żywnością: konserwy białkowe, napoje energetyczne, makaron w kubkach. Kasjer drzemie, lodówki buczą. Lokal zamknięty: roleta opuszczona, w środku towar pod folią. Właściciel wyjechał albo czeka na lepszy czynsz; szyld MEGABOX jeszcze świeci.

## Klimat
Za roletą ciemno, światło tylko z szyldu MEGABOX i z galerii. Buczenie agregatu, zapach plastiku i soi.

## Przeznaczenie
Zamknięty: gracz widzi go zza witryny albo kraty. Jedno wejście od galerii.

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- roleta w witrynie (wnętrze nierysowane).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (7,8 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: jedyne źródło to szyld; zgodne z brakiem światła znikąd.
- §14 dług: 1 rzeczy drobiazgu, 100% luzem (cel do 25%).
- §15 dług: posadzka i lada matowe; połysk gablot i szkła witryny do sprawdzenia, mokre ślady butów przy drzwiach.
- §16 zgodne co do barwy branży; geometria z generatora branż jest symetryczna, a ulica chce dobudówek i prowizorki (dług).
- §17 dług: dźwięk lokalu (muzyka, lodówka, maszynka) ze źródła w środku; ruch: sprzedawca stoi, bez pracy przy ladzie.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- piece: machine × 1
- piece: partition × 5
- piece: shopfront × 3
- piece: shutter × 2
- piece: sign × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 36 m², wysokość 4,2 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 10
- warstwy wyposażenia: makro 0, mezo 1, mikro 1
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
