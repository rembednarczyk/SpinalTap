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
- §13 częściowo: tryb wnętrza i lampy praktyczne (PR #909); od 22.11 oprawy pod stropem pasów P1 i P2 (panele co 4 m, `gallery-lights.ts`), lampy atrium na krawędziach z pasami LED, test `lamp-fixtures.test.ts` (żadna lampa dalej niż 3 m od oprawy); kontrast funkcjonalny: nad drzwiami obu trzonów na każdym piętrze zielony znak wyjścia (`exit-signs.ts`, ISO 7010 E001) i zielona plama światła przed drzwiami (`alchemia-lamp-exit-*`, test `functional-contrast.test.ts`). Dług: drzwi windy bez znaku; witryny zamkniętych lokali bez źródła są ciemne, dobrze. Dług: drzwi do klatek i wind w trzonach bez zielonego światła nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 83,6%, światło 11,1%, akcenty 5,3%, poza pasmem: baza 83,6% > 75%; światło 11,1% < 18%; po mocniejszych oprawach pasów P1 i P2 (1,6 zamiast 1,05, zasięg 13 m): baza 80%, światło 14,7%, akcenty 5,3%, poza pasmem: baza 80% > 75%; światło 14,7% < 18%. Dług: siedem miejsc lamp idzie do pasów i sklepów obok oka, a sklepy przed nim stoją ciemne za szybą; wybór lamp z kierunkiem patrzenia (odcinanie lamp poza bryłą widzenia) osobno.
- §14 częściowo: na pasażach 240 z 280 rzeczy drobiazgu w skupiskach (14% luzem); towar liczą karty sklepów. Dług: pasaże bez śladów obecności poza ławkami i kawiarnią frontu.
- §15 dług: posadzka pasaży matowa wszędzie; połysk tylko na szkle. Połysk posadzki przy wejściach, wilgoć pod atrium (deszcz pada do P0).
- §16 częściowo: pasaże czyste jak u korporacji, zaplecza mają być brudne jak ulica.
- §17 do sprawdzenia: szum schodów ruchomych i muzyka sklepów ze źródła.

## Scenariusz

### Pierwszy kadr
Najczęstsza droga to biegiem od wózka Hany na T1 (428; −6,4; 66) do Oyajiego na P3, gdy Hebi idą na jego sklep. Seki wchodzi wejściem od T1 na P0 i widzi atrium otwarte do nieba (x 411–425, z 40–50): na środku fontanna z hologramem koi, za nią przy południowej krawędzi schody ruchome nożycowo, trzy biegi jeden nad drugim. Dookoła witryny sklepów P0, każda w innym kolorze, nad nimi balustrady galerii P1–P3, a pod stropem P3 neon FOOD HALL nad galerią północną. Zielone znaki wyjścia nad drzwiami obu trzonów. Wzrok ma iść na stopę pierwszych schodów ruchomych przy wschodnim końcu atrium (x 424,4) i w górę, na neon FOOD HALL.

### Postacie i miejsca
- Hebi napadu `protect` (ADR-0093 O3, `alchemia/market.ts`, `contract-plans.ts`), 2–4 ludzi, pojawiają się na P2 przy drzwiach trzonów, gdy już się wspięli:
  - `raid_north`, od Świętoduskiej schodami trzonu SW: po 6,5 s przy drzwiach trzonu SW (401,2–406,3; 2,3; 38,9), w przejściu do galerii zachodniej;
  - `raid_east`, od Lubartowskiej schodami trzonu NE: po 9,5 s przy drzwiach trzonu NE (426,4; 2,3; 56,2) i dwóch dalej we wschodnim końcu galerii północnej (425,6; 52,2), (427,2; 51,6).
  Wszyscy patrzą na Oyajiego na P3 i idą ostatnimi schodami ruchomymi P2→P3 (stopa x 424,5 przy południowo-wschodnim rogu atrium).
- Czujki wariantu blokady stoją na ulicy: `raid_north` na T2 (431,5; 123), `raid_east` na T1 (445; 74).
- Tłum galerii (ADR-0060): klient przed co drugim otwartym lokalem i cztery osoby przy balustradzie atrium na P1 i P2. Na P0 śpiący na ławkach (historia karty).
- Fumiko w nocy, od 0:00 do 4:00, wydaje ramen przez okienko swojego lokalu na P0 na T1 (`fumiko-p0.ts`), potem siedzi na stołku przed nim.
- Hana przy wózku na T1, przed wejściem, twarzą do hali.

### Przebieg
1. Zlecenie u Hany (8:00–22:00): „Oyaji nie zapłacił Hebi w tym miesiącu i właśnie po niego idą. Pilnuj go, aż padnie ostatni z nich”. Opis miejsca mówi, którymi schodami idą.
2. Haki: mail na terminalu Hany przy wózku (`hook_protect_2`): „Hebi wejdą przez galerię: drzwiami trzonów na drugim piętrze, potem ostatnimi schodami ruchomymi do food hallu. Z ogrodu na dachu widać całe atrium, a oni nigdy nie patrzą w górę”. Bark `hook_protect_1` z załogi.
3. Wyścig w górę: gracz biegnie od wózka trzy kondygnacje schodami ruchomymi P0→P1→P2→P3 albo trzonem NE, i ma być na P3 przed Hebi (pierwsza rana Oyajiego po około 18 s).
4. Decyzja: zatrzymać ich na P2 przy drzwiach trzonów i u stopy ostatnich schodów albo bronić lady Oyajiego na P3 (karta `alchemia-foodhall`). Z dachu (ogród, otwór nad atrium) widać ich z góry.
5. Nagroda u Hany: „Oyaji żyje. Już narzeka, że nikt mu nie pomoże zbierać towaru z ziemi”.
Poza zleceniem galeria to handel (sklepy P0–P2), spacer i droga do food hallu, dachu, parkingu P−1 i metra.

### Drogi
- Cicha: galeria nie ma tu drogi cichej, napad to obrona. Ukrycie daje ogród na dachu nad otworem atrium (hak) i balustrady.
- Głośna: P2 przy drzwiach trzonów i stopa schodów P2→P3 to wąskie gardła. Osłony: bryłowe balustrady atrium 1,1 m, filary, lady sklepów, kosze i automaty.
- Ucieczka i skróty: trzony SW i NE z windami i klatkami (zielone znaki wyjścia nad drzwiami na każdym piętrze), schody ruchome w obie strony, wyjścia na T1, T0 (Bajkowskiego) i do parkingu P−1.
- Pułapka: schody ruchome są widoczne z całego atrium, a dwa kierunki napadu wchodzą z dwóch końców P2.

### Pora i stan świata
- Atrium jest otwarte do nieba, więc dzień i noc różnią się: za dnia światło z góry i deszcz do P0, w nocy witryny, pasy LED i lampy praktyczne (§13). W nocy na P0 okienko Fumiko i śpiący na ławkach.
- Napady tylko od 8:00 do 22:00, gdy Oyaji ma otwarte. Po śmierci Oyajiego (`dead:oyaji`) Hana nie daje już ochrony.
- Terytorium Hebi `alchemia-arcades` leży na zewnątrz, pod Arkadami na T2, a gang wchodzi do galerii tylko w napadzie.

### Wymagania wobec sceny
- Drzwi trzonów na P2 i stopa ostatnich schodów ruchomych widoczne ze schodów P1→P2, żeby gracz zdążył zobaczyć Hebi, zanim wejdą na górę.
- Otwór atrium widoczny z ogrodu na dachu na całą wysokość, jak mówi hak.
- Drzwi klatek i wind w trzonach w barwie nawigacji (dług §13 w audycie).
- Ślady obecności na pasażach poza ławkami i kawiarnią (dług §14 w audycie), zwłaszcza na trasie napadu (P2 przy trzonach).

## Dług sceny
- Hak `hook_protect_1` w `packages/narrative/ink/{pl,en}/hooks.ink`: „Do starego idziemy przez plac, jak zawsze”. Od O3 Hebi idą trzonami i galerią. Propozycja: „Do starego idziemy schodami od Świętoduskiej, jak zawsze. Po co zmieniać coś, co działa”.
- Czujki wariantu blokady stoją na ulicy, z dala od trasy napadu i od Oyajiego (ADR-0093 O3, otwarte). Propozycja: czujka przy drzwiach trzonu na P1 albo przy stopie schodów P1→P2 w `packages/sim/src/content/contract-plans.ts` (`raid_north`, `raid_east`).
- Id `raid_north` oznacza napad od południowego zachodu (trzon SW, Świętoduska), a `raid_east` od północnego wschodu. Nazwy zostają (zapis je zna), a opisy miejsc w `packages/ui/src/i18n/{pl,en}/domain.ts` mówią prawdę.
- Ślady obecności na P2 przy drzwiach trzonów: skupiska drobiazgu w `packages/sim/src/content/room-dressing-rooms.ts` (generator) albo `tools/blender/rooms/alchemia_gallery.py`.
- Światło nawigacji przy drzwiach klatek i wind w trzonach: `packages/sim/src/content/alchemia/exit-signs.ts`, `gallery-lights.ts`.

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
- piece: ceiling-light × 156
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
- piece: led-green × 77
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
- warstwy wyposażenia: makro 58, mezo 627, mikro 280
- drobiazg w skupiskach (≥ 3 w 1,2 m): 12 skupisk, 240 rzeczy w nich, 40 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 384
<!-- inwentarz-gry:end -->
