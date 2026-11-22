# Galeria Alchemii (`alchemia-gallery`)

Galeria wokół atrium na poziomach P0, P1 i P2, z dawną halą na P0, sklepami i kondygnacjami frontu od Bajkowskiego: arkady, lokale, kawiarnia i bar (ADR-0093 O1–O5).

## Historia
Galeria otworzyła się w 2062 jako „pasaż przyszłości”, z fontanną w atrium i sklepami marek, które dziś już nie istnieją. Lokale zajęli lombardy, naprawy telefonów, apteki bez recepty, salony wszczepów kosmetycznych i sklepy z elektroniką z drugiej ręki. Fontanna działa, ale woda jest zielonkawa. Na P0 stoją ławki, na których śpią ci, którzy nie mają gdzie. W kawiarni na froncie ktoś zostawił otwarty laptop z błędem na ekranie.

## Klimat
Witryny świecą każda innym kolorem, nad przejściami pasy LED, w lokalach ciepłe panele pod sufitem. Schody ruchome skrzypią. Reklamy holograficzne pękają na brzegach. Czysto przy wejściach, brudno na zapleczach.

## Przeznaczenie
Handel (sklepy z wyposażeniem, usługi), spacer, spotkania, ucieczki przez trzony. Wejścia z placu, z parkingu i z metra; schody ruchome parami przy atrium, windy i klatki w trzonach.

## Inwentarz docelowy
Architektura:
- witryny z ramami i drzwiami, kasetony szyldów, kraty roletowe (Blender);
- balustrady szklane z pochwytem, sufity z kanałami i panelami świetlnymi (Blender);
- fontanna w atrium z misą i dyszami (Blender).

Duże obiekty:
- wyposażenie sklepów według branż: regały, lady, gabloty, fotele, stojaki (Blender, osobny zestaw na branżę);
- bankomaty, automaty biletowe i z napojami (modele gry: `atm`, `ticket-machine`, `vending-machine`);
- ławki i donice z roślinami (modele gry: `bench`, `planter`, `shrubs`).

Drobiazg:
- towar na półkach według branż (Blender, kilka kształtów na branżę);
- kubki, kartony, paragony, kable, laptop z błędem (Blender).

Stan (22.11, rysuje go osobna siatka `GalleryDetailView` razem z wnętrzem hali, jak dawne pudełka, nie blok mebli miasta widoczny ze 170 m): towar na półkach z Blendera (`tools/blender/rooms/alchemia_gallery.py`, plik `room-detail-galeria-props.glb`): pół metra półki na model, 11 rodzajów (apteka, elektronika, żywność, lombard, naprawy, wszczepy, broń, tatuaż, VR, kwiaty, zapas na zapleczu), każdy z odbiciem lustrzanym, żeby sąsiednie odcinki się różniły, i z modelem LOD z trzech brył na telefon. Dalej z Blendera: towar w gablotach według branży (wszczepy, elektronika, kosmetyki, broń, naprawy, lombard, kantor), ubrania na wieszakach (pół metra wieszaka na model) i ubrane manekiny w witrynach, wszystko z LOD na telefon. Zostają pudełka: szafki nad ladą płytkich sklepów, terminal, kubek i towar przy ladzie, rozsypany karton.

## Frakcja i zasady
Frakcja: ulica (handel); druga: korporacja (inwestor, wejścia i atrium).
- §12 dług: 5 z 38 wymiarów na siatce (plan z planszy). Sklepy i lokale frontu są od 22.11 osobnymi wnętrzami (`alchemia-shop-*`, karty obok); ta karta to pasaże, atrium, trzony i pomieszczenia frontu bez lokali.
- §13 częściowo: tryb wnętrza i lampy praktyczne (PR #909). Dług: drzwi do klatek i wind w trzonach bez zielonego światła nawigacji; witryny zamkniętych lokali bez źródła są ciemne, dobrze. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 83,6%, światło 11,1%, akcenty 5,3%, poza pasmem: baza 83,6% > 75%; światło 11,1% < 18%.
- §14 częściowo: na pasażach 232 z 273 rzeczy drobiazgu w skupiskach (15% luzem); towar liczą karty sklepów. Dług: pasaże bez śladów obecności poza ławkami i kawiarnią frontu.
- §15 dług: posadzka pasaży matowa wszędzie; połysk tylko na szkle. Połysk posadzki przy wejściach, wilgoć pod atrium (deszcz pada do P0).
- §16 częściowo: pasaże czyste jak u korporacji, zaplecza mają być brudne jak ulica.
- §17 do sprawdzenia: szum schodów ruchomych i muzyka sklepów ze źródła.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-fh-bowls × 1
- blender: rd-fh-condiments × 1
- blender: rd-fh-lantern × 2
- blender: rd-fh-leftovers × 1
- blender: rd-fh-pot × 2
- blender: rd-fh-ramen × 1
- blender: rd-fh-teacup × 1
- model: atm × 2
- model: bench × 6
- model: figure × 28
- model: planter × 6
- model: shrubs × 4
- model: street-cabinet × 1
- model: vending-machine × 5
- model: waste-bin × 4
- piece: bench × 106
- piece: cable × 118
- piece: carton × 14
- piece: ceiling-light × 124
- piece: chair × 55
- piece: column × 1
- piece: counter × 10
- piece: cup × 43
- piece: display × 15
- piece: duct × 4
- piece: error × 1
- piece: escalator × 18
- piece: floor × 3
- piece: food × 6
- piece: frame × 6
- piece: glass × 10
- piece: goods × 167
- piece: lamp × 43
- piece: lantern × 66
- piece: led × 15
- piece: led-green × 72
- piece: lightbox × 25
- piece: machine × 12
- piece: paper × 34
- piece: parapet × 16
- piece: partition × 6
- piece: pipe × 7
- piece: rack × 9
- piece: roof × 49
- piece: steam × 34
- piece: step × 219
- piece: table × 40
- piece: vitrine × 1
- piece: wall × 32
- piece: water × 1

Pomiary zasad (§12–§16):
- rzut: 19 prostokąty, 5217 m², wysokość 3,8 / 4,2 / 3,9 / 3,1 / 2,8 m
- siatka 0,5 m: 5 z 38 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 490
- warstwy wyposażenia: makro 58, mezo 590, mikro 280
- drobiazg w skupiskach (≥ 3 w 1,2 m): 12 skupisk, 240 rzeczy w nich, 40 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 347
<!-- inwentarz-gry:end -->
