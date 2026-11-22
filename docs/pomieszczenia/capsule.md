# Pokój kapsułowy na Jezuickiej (`capsule`)

Parter kamienicy przy Jezuickiej 14 na Starym Mieście, naprzeciw Wieży Trynitarskiej (ADR-0063). Jeden pokój do wynajęcia na doby.

## Historia
Właściciel kamienicy podzielił mieszkanie na parterze na trzy kapsuły i wynajmuje je przez aplikację na doby. W tej śpią kurierzy, turyści, którzy pomylili Lublin z Krakowem, i ludzie, którzy nie chcą być znalezieni. Meble są z katalogu „compact living” sprzed piętnastu lat: składane, z panelami LED, połowa przycisków nie działa. Poprzedni lokator wyszedł dziś rano i nie wyniósł śmieci.

## Klimat
Niebieski pasek LED nad łóżkiem, ciepłe lampki w szafkach, za oknem neon z ulicy. Ciasno, czysto na pierwszy rzut oka, brudno przy bliższym spojrzeniu.

## Przeznaczenie
Kryjówka gracza z autozapisem: łóżko, aneks kuchenny, skrzynia. Jedno wejście od ulicy.

## Inwentarz docelowy
Architektura i duże obiekty pochodzą z modelu igor.tesV „Futuristic Compact Room” (`room-props.glb`, CC-BY 4.0): aneks kuchenny ze zlewem i piekarnikiem, łóżko we wnęce pod szafkami, regał w nogach łóżka, skrzynia. Ściany, sufit i ścianę z drzwiami dokłada gra. Wymiary powierzchni zmierzone w Blenderze na modelu: blat 0,87 m, dno zlewu 0,67 m, materac 0,92 m, wieko skrzyni 0,44 m.

Z Blendera (`tools/blender/rooms/capsule.py`):
- drzwi przesuwne od środka, odsunięte na ścianę obok przejścia: stalowe skrzydło z uchwytem, blachą u dołu, wizjerem i zdrapaną naklejką, szyna nad przejściem, czytnik kart z zielonym światłem przy drugiej ościeżnicy (`rd-capsule-door`);
- listwa z czterema wieszakami na ścianie przy drzwiach, na nich płócienna torba i czapka (`rd-capsule-hooks`);
- worek ze śmieciami zawiązany na supeł, karton po pizzy oparty o ścianę, puszka, która nie trafiła (`rd-capsule-trash`);
- w zlewie talerz z resztką sosu, kubek z łyżeczką, widelec (`rd-capsule-sink`);
- na blacie jedzenie z automatu: kubek zupki z uchyloną pokrywką i pałeczkami, trójkątne pudełko po kanapce, zgnieciona paczka chipsów, energetyk, serwetki (`rd-capsule-food`);
- ręcznik rzucony na łóżko, zwisający z krawędzi materaca (`rd-capsule-towel`);
- na skrzyni telefon z zapalonym ekranem, powerbank, kabel do gniazdka w ścianie i drugi luźny kabel (`rd-capsule-charger`);
- zalaminowana karta wynajmu z regulaminem, kodem QR do aplikacji i hasłem do wifi dopisanym markerem (`rd-capsule-rules`).

Odłożone: roleta. Ściana frontowa wycięta w kamienicy ma tylko drzwi, a okna kamienicy są piętro wyżej, więc rolety nie ma na czym zawiesić. Okno w kapsule wymaga zmiany bryły pomieszczenia (`capsule-room.ts`) i jego rysunku w silniku.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-capsule-charger × 1
- blender: rd-capsule-door × 1
- blender: rd-capsule-food × 1
- blender: rd-capsule-hooks × 1
- blender: rd-capsule-rules × 1
- blender: rd-capsule-sink × 1
- blender: rd-capsule-towel × 1
- blender: rd-capsule-trash × 1
<!-- inwentarz-gry:end -->
