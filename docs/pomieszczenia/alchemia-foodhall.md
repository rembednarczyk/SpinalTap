# Food hall Alchemii (`alchemia-foodhall`)

Poziom P3 galerii Alchemii przy Placu Ofiar Getta, dwanaście lokali wokół sali z ławami (ADR-0074, ADR-0093 O3).

## Historia
Alchemia powstała w 2060 według planu inwestora na miejscu ogrodzonego nieużytku przy Lubartowskiej. Food hall miał być „najsmaczniejszym piętrem Lublina”. Dziś to głównie jedzenie z automatów i kuchnie, które zmieniają szyldy co pół roku. Najstarszy lokal to bar ramen Fumiko, która gotowała tu od otwarcia. Oyaji handluje bronią zza kraty w lokalu ARMS: oficjalnie sprzedaje „sprzęt turystyczny”. Przy stole pod oknem ktoś zostawił niedojedzoną miskę i telefon ładujący się z listwy.

## Klimat
Ciepłe światło nad ladami, lampiony nad ławami, zimny błękit ekranów z menu. Para z garnków, syk frytownic, klimatyzacja buczy pod sufitem. Ławy z jasnego drewna porysowane nożami, plastikowe tace, papierowe serwetki na podłodze.

## Przeznaczenie
Hub handlu i spotkań: jedzenie (leczenie), handlarz bronią, rozmowy z NPC. Wiele wejść: schody ruchome, windy w trzonach, taras.

## Inwentarz docelowy
Architektura:
- fronty lokali z ladami, kratami i szyldami (Blender: lada z blatem i frontem, krata roletowa, kaseton szyldu);
- sufit z kanałami wentylacji, korytami i lampionami nad ławami (Blender);
- przepierzenia między lokalami z blachy i płyt (Blender).

Duże obiekty:
- ławy i stoły z jasnego drewna na stalowych nogach (Blender);
- kuchnie lokali: frytownice, garnki, kuchenki indukcyjne, okapy (Blender);
- lodówki z przeszklonymi drzwiami, automaty z napojami (model gry: `vending-machine`);
- kosze z segregacją (model gry: `waste-bin`).

Drobiazg:
- miski, tace, pałeczki, kubki z parą, serwetki, butelki sosów (Blender);
- telefon na ładowarce, rachunki, ulotki, kartony z dostaw na zapleczach (Blender).

Z Blendera (`tools/blender/rooms/alchemia_foodhall.py`, plik `room-detail-alchemia-props.glb`, 22.11): okrągłe rzeczy, które siedzenia miały dotąd jako pudełka (komiksowy realizm, `docs/zasady-lokacji.md` §9):
- papierowe lampiony (chochin) nad stołami i na girlandach wzdłuż balustrady atrium: lakierowane denka, papier na żebrach świecący ciepło, czerwony pas, frędzel (`rd-fh-lantern`, `rd-fh-lantern-small`); kable zostają kawałkami silnika;
- miski zostawione na stołach: ramen z bulionem, makaronem i jajkiem albo donburi ze zdjętą pokrywką i czarką herbaty, na tacach, z pałeczkami (`rd-fh-ramen`, `rd-fh-donburi`); para nad gorącymi zostaje kawałkiem silnika;
- kubek mrożonej herbaty, kubek przewrócony przy rozlanym napoju (`rd-fh-cup`, `rd-fh-spilled`);
- stołek barowy przewrócony przy barze Fumiko (`rd-fh-stool`);
- w kuchniach lokali: garnki z pokrywką i chochlą na kuchenkach, stosy misek, czarki herbaty przy kasach, czerwone butle gazowe z reduktorem (`rd-fh-pot`, `rd-fh-bowls`, `rd-fh-teacup`, `rd-fh-gas`; miejsca z generatora kuchni, `KITCHEN_ROUND`).

Do zrobienia w kolejnych krokach: kubki Sachiko i Oyaji, frytownice i okapy, dziś pudełka kawałków.

## Frakcja i zasady
Frakcja: ulica (handel i jedzenie); druga: korporacja (galeria inwestora).
- §12 zgodne z wyjątkiem: obrys szkła z planszy (1 z 4 wymiarów na siatce, odstępstwo z §1). Instalacje pod stropem są. Wejście schodami ruchomymi z atrium otwiera się na halę.
- §13 częściowo: lampiony i kuchnie jako źródła (PR #909); kontrast funkcjonalny: lady ludzi z zadań (Fumiko, Kenta, Goro, Oyaji, Sachiko) pod bielszą i jaśniejszą lampą nad samą ladą (`#ffe4c2`, 1,7 wobec 1,0 kuchni), test `functional-contrast.test.ts`. Dług: 60-30-10 do zmierzenia zrzutem.
- §14 zgodne: 161 ze 165 rzeczy drobiazgu w 23 skupiskach, 4 luzem (2%, ulotki na podłodze). Na każdym stole przyprawnik (sos sojowy, shichimi, wykałaczki, pałeczki), przy posiłkach serwetki, paragon i szklanka; na ladzie każdej kuchni i u Sachiko i Oyajiego kasa (terminal, szpikulec z bonami, słoik napiwków, długopis) przy kubku, przy stosie misek pałeczki, chochla w dzbanku i butelki z sosami (Blender, `rd-fh-condiments`, `rd-fh-leftovers`, `rd-fh-till`, `rd-fh-prep`).
- §15 dług: brak połysku i wilgoci poza wodą. Mokra posadzka przy zmywakach, lakier na ladach.
- §16 zgodne: ciepły żółty, neony nad ladami, asymetria budek.
- §17 do sprawdzenia: dźwięk kuchni i klimatyzacji ze źródła; ruch jest (para, ludzie).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-fh-bowls × 6
- blender: rd-fh-condiments × 7
- blender: rd-fh-cup × 1
- blender: rd-fh-donburi × 3
- blender: rd-fh-gas × 12
- blender: rd-fh-lantern × 15
- blender: rd-fh-lantern-small × 32
- blender: rd-fh-leftovers × 6
- blender: rd-fh-pot × 11
- blender: rd-fh-prep × 6
- blender: rd-fh-ramen × 2
- blender: rd-fh-spilled × 1
- blender: rd-fh-stool × 1
- blender: rd-fh-teacup × 9
- blender: rd-fh-till × 9
- model: vending-machine × 2
- model: waste-bin × 2
- piece: bench × 19
- piece: cable × 49
- piece: carton × 29
- piece: counter × 19
- piece: display × 28
- piece: duct × 15
- piece: floor × 1
- piece: frame × 2
- piece: glass × 2
- piece: goods × 41
- piece: grille × 1
- piece: lamp × 10
- piece: led × 2
- piece: led-green × 2
- piece: machine × 43
- piece: paper × 5
- piece: parapet × 7
- piece: partition × 24
- piece: pipe × 3
- piece: rack × 9
- piece: roof × 78
- piece: shutter × 3
- piece: steam × 12
- piece: step × 46
- piece: table × 7
- piece: vitrine × 1
- piece: wall × 2
- piece: water × 1

Pomiary zasad (§12–§16):
- rzut: 2 prostokąty, 903 m², wysokość 3,9 m
- siatka 0,5 m: 1 z 4 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 234
- warstwy wyposażenia: makro 50, mezo 203, mikro 165
- drobiazg w skupiskach (≥ 3 w 1,2 m): 23 skupisk, 161 rzeczy w nich, 4 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 62
<!-- inwentarz-gry:end -->
