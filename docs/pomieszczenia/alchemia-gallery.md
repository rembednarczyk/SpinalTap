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

Stan (22.11): towar na półkach z Blendera (`tools/blender/rooms/alchemia_gallery.py`, plik `room-detail-galeria-props.glb`): pół metra półki na model, 11 rodzajów (apteka, elektronika, żywność, lombard, naprawy, wszczepy, broń, tatuaż, VR, kwiaty, zapas na zapleczu), każdy z odbiciem lustrzanym, żeby sąsiednie odcinki się różniły, i z modelem LOD z trzech brył na telefon. Dalej z Blendera: towar w gablotach według branży (wszczepy, elektronika, kosmetyki, broń, naprawy, lombard, kantor), ubrania na wieszakach (pół metra wieszaka na model) i ubrane manekiny w witrynach, wszystko z LOD na telefon. Zostają pudełka: szafki nad ladą płytkich sklepów, terminal, kubek i towar przy ladzie, rozsypany karton.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-fh-bowls × 1
- blender: rd-fh-lantern × 2
- blender: rd-fh-pot × 2
- blender: rd-fh-ramen × 1
- blender: rd-fh-teacup × 1
- blender: rd-gl-arms × 61
- blender: rd-gl-arms-b × 81
- blender: rd-gl-case-arms × 51
- blender: rd-gl-case-crypto × 7
- blender: rd-gl-case-electronics × 14
- blender: rd-gl-case-implants × 20
- blender: rd-gl-case-pawn × 22
- blender: rd-gl-case-pharmacy × 15
- blender: rd-gl-case-repair × 20
- blender: rd-gl-electronics × 58
- blender: rd-gl-electronics-b × 52
- blender: rd-gl-florist × 37
- blender: rd-gl-florist-b × 54
- blender: rd-gl-food × 49
- blender: rd-gl-food-b × 73
- blender: rd-gl-garments × 36
- blender: rd-gl-implants × 32
- blender: rd-gl-implants-b × 31
- blender: rd-gl-mannequin × 7
- blender: rd-gl-pawn × 41
- blender: rd-gl-pawn-b × 35
- blender: rd-gl-pharmacy × 41
- blender: rd-gl-pharmacy-b × 40
- blender: rd-gl-repair × 72
- blender: rd-gl-repair-b × 57
- blender: rd-gl-stock × 671
- blender: rd-gl-stock-b × 672
- blender: rd-gl-tattoo × 13
- blender: rd-gl-tattoo-b × 17
- blender: rd-gl-vr × 45
- blender: rd-gl-vr-b × 65
- model: atm × 5
- model: bench × 6
- model: figure × 68
- model: planter × 6
- model: shrubs × 16
- model: street-cabinet × 25
- model: ticket-machine × 12
- model: vending-machine × 12
- model: waste-bin × 4
- piece: bench × 106
- piece: cable × 266
- piece: carton × 236
- piece: ceiling-light × 208
- piece: chair × 55
- piece: column × 1
- piece: counter × 87
- piece: cup × 91
- piece: display × 116
- piece: duct × 52
- piece: error × 19
- piece: escalator × 18
- piece: floor × 3
- piece: food × 6
- piece: frame × 6
- piece: glass × 10
- piece: goods × 365
- piece: grille × 12
- piece: lamp × 223
- piece: lantern × 66
- piece: led × 19
- piece: led-green × 72
- piece: lightbox × 31
- piece: machine × 139
- piece: paper × 160
- piece: parapet × 16
- piece: partition × 253
- piece: pipe × 103
- piece: plaster × 5
- piece: rack × 897
- piece: roof × 94
- piece: shopfront × 146
- piece: shutter × 8
- piece: sign × 52
- piece: steam × 64
- piece: step × 221
- piece: table × 44
- piece: vitrine × 31
- piece: wall × 32
- piece: water × 1
<!-- inwentarz-gry:end -->
