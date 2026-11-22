# Elektronika DATAKOM (`alchemia-shop-p0-w4`)

Alchemia, P0 (dawna hala), lokal p0-w4 (7,6 × 4,6 m), witryną na wschodnią stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Elektronika z drugiej ręki: telefony, decki, kable, części do wszczepów. Sprzedawca naprawia przy ladzie to, czego nie sprzedał. Lokal zamknięty: roleta opuszczona, w środku towar pod folią. Właściciel wyjechał albo czeka na lepszy czynsz; szyld DATAKOM jeszcze świeci.

## Klimat
Za roletą ciemno, światło tylko z szyldu DATAKOM i z galerii. Pisk zasilaczy, zapach kalafonii.

## Przeznaczenie
Zamknięty: gracz widzi go zza witryny albo kraty. Jedno wejście od galerii.

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- roleta w witrynie (wnętrze nierysowane).

## Frakcja i zasady
Frakcja: technika; druga: ulica (towar z drugiej ręki).
- §12 częściowo: rzut z planu galerii (7,6 × 4,6 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: jedyne źródło to szyld; zgodne z brakiem światła znikąd.
- §14 dług: 1 rzecz drobiazgu, 100% luzem (cel do 25%).
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
- rzut: 1 prostokąt, 35 m², wysokość 3,8 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 10
- warstwy wyposażenia: makro 0, mezo 1, mikro 1
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
