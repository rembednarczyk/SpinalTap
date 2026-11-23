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

## Frakcja i zasady
Frakcja: ulica (hotel kapsułowy); druga: technika (panel kapsuły).
- §12 zgodne: ciasno, 1 z 2 wymiarów na siatce (obrys z kamienicy, §1).
- §13 dług: w pomiarach 0 źródeł w bryłach (lampa rysowana przez silnik); powiązać pasek LED i lampki z oprawami w modelu; drzwi w barwie nawigacji. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 47,5%, światło 44%, akcenty 8,5%, poza pasmem: baza 47,5% < 50%; światło 44% > 42%; po trybie wnętrza (ciemne otoczenie zamiast księżyca, lampa w oprawie stropu 1,25): baza 55,5%, światło 34,5%, akcenty 10%, zgodne.
- §14 zgodne: 20 rzeczy drobiazgu, 17 w skupiskach (jedzenie z automatu, zlew, śmieci, ładowarka), 15% luzem.
- §15 dług: wszystko matowe; połysk plastiku kapsuły.
- §16 zgodne.
- §17 do sprawdzenia: szum ulicy zza okna jako źródło.

## Scenariusz

### Pierwszy kadr
Seki skręca z Jezuickiej w drzwi 1,2 × 2,3 m w ścianie kamienicy (593,8; −134,3), naprzeciw Wieży Trynitarskiej, i wchodzi twarzą na północ. Pokój ma 3,7 × 4,5 m: po lewej aneks kuchenny wzdłuż zachodniej ściany, w głębi wnęka z łóżkiem pod szafkami i niebieski pasek LED nad nim, po prawej skrzynia, a na niej telefon z zapalonym ekranem. Przy drzwiach czytnik kart z zielonym światłem i listwa z wieszakami. Wejście zapisuje grę (ADR-0061). Wzrok ma iść na łóżko pod niebieskim paskiem.

### Postacie i miejsca
- W pokoju nie ma nikogo i gra nikogo tu nie stawia. Poprzedni lokator wyszedł rano (historia karty): śmieci przy drzwiach, talerz w zlewie, zupka na blacie, ręcznik na łóżku.
- Najbliżsi ludzie gry to patrole Hebi na Rynku wokół Trybunału, około 45 m na północ, na południowym odcinku pętli przy z −87 (`RYNEK_LOOP`, terytorium `rynek`).

### Przebieg
1. Wejście: zdarzenie `InteriorEntered` z `capsule` i autozapis, z limitem 60 s między zapisami (ADR-0061).
2. Rozejrzenie się: ślady lokatora w skupiskach (jedzenie z automatu, zlew, śmieci, ładowarka, karta wynajmu z hasłem do wifi). Nic nie daje nagrody ani nie zmienia flag.
3. Wyjście tymi samymi drzwiami na Jezuicką.
Pokój nie ma zadania, rozmowy ani skrytki. ADR-0063 (etap 3) postanowił, że to „pokój do wynajęcia bez wpływu na fabułę”, a kryjówka Seki (łóżko jako zapis, skrytka) czeka na decyzję użytkownika.

### Drogi
- Jedno wejście z ulicy, bez okna (ściana frontowa wycięta w parterze ma tylko drzwi, okna kamienicy są piętro wyżej).
- Walki tu nie ma. Pokój jest ślepym zaułkiem: kto wbiegnie w pościgu, zostaje zamknięty w 17 m².

### Pora i stan świata
- Bez okien, więc o każdej porze wygląda tak samo. Za drzwiami, w dzień, jeden patrol Hebi obchodzi Rynek, a od 21:00 do 5:00 obchodzą go dwa (`kanal-patrols.ts`).
- Stan pokoju się nie zmienia: przed wejściem i po nim jest taki sam, a autozapis nie zostawia śladu w świecie.

### Wymagania wobec sceny
- Łóżko jako cel wzroku od drzwi: niebieski pasek LED w oprawie modelu, dziś lampa silnika bez bryły (dług §13 w audycie).
- Drzwi w barwie nawigacji od środka (czytnik z zielonym światłem jest, `rd-capsule-door`).
- Gdy użytkownik zdecyduje o kryjówce: łóżko jako miejsce zapisu i skrytka w skrzyni.

## Dług sceny
- Kryjówka gracza (decyzja rekomendowana 23.11, nota w ADR-0063): łóżko jako miejsce zapisu i skrytka w skrzyni; dziś wnętrze ma tylko wejście z autozapisem, a nazwa `interior.capsule` mówi o pokoju na wynajem (`packages/ui/src/i18n/{pl,en}/content.ts`).
- Kryjówka, jeśli zapadnie decyzja: interakcja łóżka i skrytka w skrzyni w `packages/sim/src/content/capsule-room.ts` (bryła skrzyni już jest w `CAPSULE_FURNITURE`), tekst podpowiedzi w katalogach `i18n/{en,pl}`.
- Pasek LED i lampki szafek przypięte do opraw modelu (§13): `packages/engine/src/renderer/rooms/room-lights.ts`.
- Szum Jezuickiej i kroki patrolu za drzwiami jako dźwięk ze źródła (§17): `packages/engine/src/audio/room-sound-map.ts`.

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

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 17 m², wysokość 2,8 m
- siatka 0,5 m: 1 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 0
- warstwy wyposażenia: makro 0, mezo 1, mikro 20
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 17 rzeczy w nich, 3 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
