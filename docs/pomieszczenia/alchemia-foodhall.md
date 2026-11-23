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
- §17 do sprawdzenia: dźwięk kuchni i klimatyzacji ze źródła; ruch jest (para, ludzie). Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): bulgotanie garnków na straganach, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Seki wjeżdża ostatnimi schodami ruchomymi z P2 i staje na podeście P3 przy południowej krawędzi atrium (około 416,6; 6,5; 40,7), twarzą na zachód. Przed nią zachodni rząd lokali (THAI, zamknięty SEOUL, w narożniku RAMEN FUMIKO), po prawej nad galerią północną neon FOOD HALL i lady OKONOMIYAKI, KASA TEA i KAWA, nad stołami lampiony, para nad garnkami. Za plecami, we wschodnim końcu galerii południowej, KIOSK Sachiko i w narożniku pancerna lada ARMS z kratą: sklep Oyajiego. Lady ludzi z zadań świecą jaśniej i bielej niż kuchnie (§13). W napadzie wzrok ma iść na ARMS, a dziś po wjeździe stoi do niego plecami.

### Postacie i miejsca
- Oyaji (`oyaji`, 120 HP, sklep `oyaji`) za ladą pancerną 1,1 m z kratą do 2,6 m (429,8; 6,5; 35,7), twarzą na północ. Klapa w ladzie przy zachodniej ścianie sklepu (x 428–428,9) to droga Hebi do niego; drzwi zaplecza przy z 35,4–36,6, za wschodnim końcem lady.
- Sachiko (`sachiko`) w kiosku (423,3; 35,7), twarzą na północ, o każdej porze.
- Kenta (410,8; 54,3) i Goro (416,5; 54,3) za ladami północnymi, twarzami na południe; Fumiko (403,1; 53,4) za barem w narożniku, twarzą na wschód.
- Klienci przed ladami (`beforeKeeper`), tłum przy stołach i półkach przy balustradzie (`crowd.ts`).
- W napadzie (karta `alchemia-gallery`) 2–4 Hebi wjeżdżają tymi samymi schodami P2→P3 i idą galerią południową na wschód, do klapy Oyajiego.

### Przebieg
1. Zlecenie Hany (8:00–22:00, ochrona Oyajiego): „Pilnuj go, aż padnie ostatni z nich”. Kwestia Hany w trakcie: „Hebi są już na targu. Nie stój przy mnie, pilnuj Oyajiego!”.
2. Napięcie: Hebi pojawiają się na P2 po 6,5 albo 9,5 s od przyjęcia (wspinaczka w trzonach), a pierwszą ranę Oyaji dostaje po około 18 s. Gracz od wózka Hany zdąży, jeśli biegnie.
3. Obrona: Hebi idą do klapy w ladzie, bo krata zamyka resztę. Kto stanie w galerii południowej między schodami a ARMS, zatrzymuje ich na około 10 m otwartej podłogi.
4. Nagroda u Hany. Przy przyjaznej postawie cywilów Oyaji mówi: „Dla ciebie zawsze coś odłożę”. Śmierć Oyajiego (`dead:oyaji`) zamyka ochronę na dobre.
5. Poza zleceniem: jedzenie u Fumiko (leczenie, 16:00–24:00 na P3), handel u Oyajiego, rozmowy z Kentą, Goro, Sachiko. Kenta mówi o dachu: „Winda za halą jeszcze jeździ, jak się mocno naciśnie”.

### Drogi
- Cicha: brak w napadzie. Poza nim food hall to droga na dach (trzony SW i NE, winda) i z dachu w dół.
- Głośna: osłony to lada pancerna Oyajiego (z gracza strony klientów), kiosk Sachiko z daszkiem, ławy i stoły (do sprawdzenia, które są bryłami), kuchnie lokali. Strzał z galerii nad atrium na podest schodów jest otwarty.
- Ucieczka: schody ruchome w dół, trzon SW (galeria zachodnia), trzon NE (galeria północna).
- Pułapka: podest schodów P3 jest jedynym wejściem napadu i jedynym szybkim wejściem gracza, więc spóźniony gracz wjeżdża Hebi za plecy albo prosto pod ich lufy.

### Pora i stan świata
- Szkło fasady i otwarte atrium: w dzień jasno z góry, w nocy lampiony i neony (§13, zrzut dzień i noc).
- Godziny: food hall 10:00–24:00 (Kenta i Goro przy ladach, od 0:00 do 10:00 siedzą w głębi lokali), Fumiko 16:00–24:00 na P3, potem na P0, Oyaji 8:00–22:00, potem za kratą (`oyaji_closed`), Sachiko zawsze.
- Przed ochroną Oyaji płaci Hebi co miesiąc („Jak nie zapłacę, przychodzą za dnia, przy ludziach”). Przy przyjaznej postawie cywilów Hana i Oyaji mówią, że przy Seki Hebi omijają targ.

### Wymagania wobec sceny
- Lada ARMS czytelna z podestu schodów P3 bez odwracania się, albo znak nad schodami w jej stronę (§9, linia wzroku do celu).
- Klapa w ladzie Oyajiego widoczna jako słabe miejsce (inna barwa, ślady, uchylona).
- Osłony w galerii południowej między schodami a ARMS (stół, automat, kosz), bez zamykania przejścia napadu.
- Ślad „przed chwilą” przy Oyajim: kubek (karta: do zrobienia), towar z ziemi po napadzie (Hana: „zbierać towaru z ziemi”).

## Dług sceny
- Ink przeczy grze: Goro w `packages/narrative/ink/{pl,en}/m4-ulica.ink` ma stragan otwarty 8–22 („Stragan zamknięty, ale ja nie śpię”), a plan dnia w `schedules.ts` trzyma go przy ladzie 10:00–24:00 (`FOODHALL_HOURS`). Propozycja: warunek w ink według `FOODHALL_HOURS`.
- Oyaji w `packages/narrative/ink/{pl,en}/day-cycle.ink` (`oyaji_closed`): „Gary już wystygły”, a Oyaji handluje bronią i łata kurtki (lokal ARMS). Propozycja: „Krata w dół, naboje pod kluczem”.
- Sachiko w `m4-ulica.ink`: „Uważaj przy ruinie za straganami” i „Za ruiną na końcu placu leży torba”, a od ADR-0074 etap 2 ruiny nie ma, a torba z blokady (`stash:targ-overpass`) leży przed łukiem Arkad na T2. Propozycja: „pod Arkadami na dolnym placu”.
- Hana w `packages/narrative/ink/{pl,en}/m4-targ.ink`: „Będę przy wózku, na placu za straganami”, a stragany są na P3, a wózek na T1 przed halą. Propozycja: „na placu przed halą”.
- Podest schodów P3 obrócony plecami do ARMS: znak albo światło nad galerią południową ku ladzie Oyajiego w `packages/sim/src/content/alchemia/foodhall-detail.ts` (rysunek w `tools/blender/rooms/alchemia_foodhall.py`).
- Kubek Oyajiego i towar przy ladzie: `tools/blender/rooms/alchemia_foodhall.py`, `foodhall-detail.ts` (karta: „kubki Sachiko i Oyaji do zrobienia”).

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
