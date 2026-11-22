# Sklep z odzieżą TOKYO DRIP (`alchemia-shop-p2-s2`)

Alchemia, L2 frontu, lokal p2-s2 (5,5 × 10,4 m), witryną na południową stronę. Wnętrze w galerii (`within: alchemia-gallery`), osobne od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Sklep z odzieżą: kurtki z podświetlanymi szwami, podróbki marek, wieszaki ciasno. Przymierzalnia za zasłoną. Lokal zamknięty: roleta opuszczona, w środku towar pod folią. Właściciel wyjechał albo czeka na lepszy czynsz; szyld TOKYO DRIP jeszcze świeci.

## Klimat
Za roletą ciemno, światło tylko z szyldu TOKYO DRIP i z galerii. Muzyka z głośnika, zapach nowej tkaniny.

## Przeznaczenie
Zamknięty: gracz widzi go zza witryny albo kraty. Jedno wejście od galerii.

## Inwentarz docelowy
Lokal buduje generator galerii (`alchemia/shops.ts`, `shop-fittings.ts`, `shop-trades.ts`), deterministycznie z id lokalu; towar na półkach i w gablotach z Blendera (`tools/blender/rooms/alchemia_gallery.py`):
- roleta w witrynie (wnętrze nierysowane).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: rzut z planu galerii (5,5 × 10,4 m); jedno wejście od pasażu. Dług: instalacje pod stropem lokalu i próg (zmiana światła lub posadzki) w drzwiach.
- §13 częściowo: jedyne źródło to szyld; zgodne z brakiem światła znikąd.
- §14 dług: bez drobiazgu w pomiarze (cel: skupiska, do 25% luzem).
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
- rzut: 1 prostokąt, 57 m², wysokość 3,9 m
- siatka 0,5 m: 1 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 10
- warstwy wyposażenia: makro 0, mezo 2, mikro 0
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
