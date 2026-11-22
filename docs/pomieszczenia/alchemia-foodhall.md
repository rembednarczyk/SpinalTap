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

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-fh-bowls × 6
- blender: rd-fh-cup × 1
- blender: rd-fh-donburi × 3
- blender: rd-fh-gas × 12
- blender: rd-fh-lantern × 15
- blender: rd-fh-lantern-small × 32
- blender: rd-fh-pot × 11
- blender: rd-fh-ramen × 2
- blender: rd-fh-spilled × 1
- blender: rd-fh-stool × 1
- blender: rd-fh-teacup × 9
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
<!-- inwentarz-gry:end -->
