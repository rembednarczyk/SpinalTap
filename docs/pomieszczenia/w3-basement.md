# Piwnica W-3 z przepustem (`w3-basement`)

Piwnica pod halą W-3 i kanał przepustu pod tarasem (ADR-0082 etap 2).

## Historia
Piwnica została po przedwojennej garbarni, na której fundamentach stoi zakład. Tessen zamurował jej część i zostawił tylko pompownię i przepust do rzeki, którym kiedyś odpływały ścieki garbarni. Przepust zarósł osadem; technicy schodzą tu raz w miesiącu wymienić filtr. Szmuglerzy znają go lepiej niż Tessen: na ścianie wisi ich znak kredą, a w niszy stoi skrzynka z latarką i zapasową baterią.

## Klimat
Wilgoć, ceglane sklepienia przemieszane z betonem, jedna żarówka w kratce i czerwone światło awaryjne. Woda po kostki w przepuście, echo kropli, zapach mułu.

## Przeznaczenie
Droga ukryta do hali i ucieczka nad rzekę. Ciasno, nisko, bez autozapisu.

## Inwentarz docelowy
Bryła i duże obiekty z symulacji (`tessen-w3/basement.ts`): piwnica 31 × 12,4 m i 4,1 m wysoka, dwa słupy, cztery szafki szatni z kryjówkami, ławka, schody A i B, szyb windy z drabiną, przepust: wylot w skarpie, kanał 37 m długi i 1,5 m wysoki, zejście do piwnicy. Szafki i ławkę rysuje scenografia hali W-3.

Z Blendera (`tools/blender/rooms/w3_basement.py`), tylko rysunek, bez nowych brył, więc identyfikatory hali i jej drzwi zostają:
- dwie rury pod stropem wzdłuż południowej ściany na obejmach, kołnierze, zacieki rdzy (`rd-w3b-pipes`);
- zespół pompowy w narożniku: silnik i korpus pompy na cokole, osłona sprzęgła, ssanie do kratki studzienki, obudowa filtra z przykręconą pokrywą, pion tłoczny do rur pod stropem z zasuwą i manometrem, zawieszka serwisowa (`rd-w3b-pump`);
- skrzynka elektryczna z ostrzeżeniem, rurki kabli do stropu, oprawa awaryjna z czerwonym kloszem (`rd-w3b-panel`);
- dwie żarówki w koszyczkach z drutu (`rd-w3b-bulb`);
- poręcze z rury na schodach A i B (`rd-w3b-handrail-a`, `rd-w3b-handrail-b`);
- cegła garbarni w miejscach, gdzie odpadł tynk, na ścianie południowej i wschodniej (`rd-w3b-brick-wide`, `rd-w3b-brick-tall`);
- krata przepustu odchylona na skrzydło wylotu, zawiasy od czoła, skobel z otwartą kłódką (`rd-w3b-grate`);
- skrytka szmuglerów w kanale: skrzynka z odsuniętym wiekiem, latarka, zapasowy akumulator, znak kredą na ścianie (`rd-w3b-stash`);
- woda po kostki w kanale, ławice mułu przy ścianach, puszki, butelka i worek w mule (`rd-w3b-water`).

Na telefonie (niska jakość) gra pomija drobiazg (`fine` w `ROOM_DETAIL_SHAPES`): żarówki, cegłę, kratę, skrytkę, wodę z mułem, rury i poręcze; zostają pompa i skrzynka (budżet trójkątów hali W-3 w `npr-perf`).

## Frakcja i zasady
Frakcja: korporacja (Tessen, zaniedbana); druga: ulica (przepust).
- §12 zgodne: 5 z 6 wymiarów na siatce; niski przepust (1,5 m) przed piwnicą.
- §13 zgodne (światło): lampy W-3 w silniku (`w3-lights.ts`) przy oprawach z karty: biała pod świetlówkami stropu (słabsza), ciepłe plamy dwóch żarówek w koszyczkach (`rd-w3b-bulb`) i czerwień klosza oprawy awaryjnej nad skrzynką elektryczną (`rd-w3b-panel`). 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 73,9%, światło 26,1%, akcenty 0%; po niej baza 65,7%, światło 30,4%, akcenty 4%, zgodne.
- §14 zgodne: 8 rzeczy drobiazgu (skrytka przemytników, śmieci w mule), 25% luzem; rury, poręcze i łaty cegieł to instalacje (§12), nie drobiazg.
- §15 zgodne: woda w przepuście, mokre ściany.
- §16 zgodne.
- §17 do sprawdzenia: kapanie i pompa ze źródła. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): pompa i buczenie skrzynki elektrycznej, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Droga Q1 sabotażu: Seki schodzi z pasa publicznego na ławę Bystrzycy, wchodzi w wylot kolektora pod nabrzeżem (x 2462–2472, z 406,2–408,2) i interakcją `prompt.culvert` wczołguje się pod ścianę czołową. Przed nią 37 m ciemnego kanału 1,5 m wysokiego, woda po kostki, puszki w mule, a w kanale otwarta skrzynka szmuglerów ze znakiem kredą. Na końcu kanał schodzi biegiem w dół i otwiera się w piwnicę 31 × 12,4 m pod stropem 4,1 m: dwie żarówki w koszyczkach, czerwony klosz nad skrzynką elektryczną, pompa w narożniku, cztery szafki szatni pod północną ścianą. To kontrast ciasno i szeroko z §12. Wzrok ma iść na szafki (kombinezon) i na schody A w górę.

### Postacie i miejsca
- W piwnicy i kolektorze nie stoi nikt: posterunki sabotażu są w hali, na antresoli, w śluzie wagonowej i w zbrojowni S (`W3_CONTRACT_POSTS.w3_hall`). Patrol P1 tu nie schodzi.
- Szafka 14, wschodnia z czterech (x 2525,3–2528, przy ścianie z 408,4), z kombinezonem technika `tessen_overalls` na czas sabotażu (`W3_LOCKER_14`, (2526,6; 407,4)). Każda szafka mieści ciało (ADR-0065).
- Technik z haka szafki 14 stoi poza strefą, przy furtce serwisowej (2552,3; 390,4) od 19:00 do 23:00.

### Przebieg
1. Brief Genzō: „Wylot kolektora pod nabrzeżem: przeczołgasz się nim do piwnicy magazynów, technicy trzymają tam w szatni kombinezony”.
2. Hak przy furtce (`hook_sabotage_2`): „Weź szafkę czternaście w piwnicy, jest niczyja. Zamek nie działa od wiosny”.
3. Kolektor: 37 m w kucaniu, bez wrogów. Napięcie robi ciasnota i ciemność, a nagrodą jest skrytka szmuglerów (rysunek `rd-w3b-stash`).
4. Szatnia: kombinezon z szafki 14. Od teraz technicy na linii nie zwracają uwagi, dopóki broń jest schowana i Seki nie biega. Egzekutorem przebrań jest kierownik zmiany na antresoli.
5. Wyjście w górę: schody A na linię podzespołów (2517–2525; 402–403,8), schody B do warsztatu W2 (2539–2541; 397,6–403,6) albo drabina w szybie windy towarowej (2530; 401,4).
6. Po wgraniu wirusa ta sama droga prowadzi z powrotem do wylotu kolektora, bez posterunków po drodze.

### Drogi
- Cicha: cała piwnica. Wchodzi się tylko kolektorem od rzeki albo z hali trzema wyjściami w górę.
- Głośna: w piwnicy nie ma walki, chyba że fala z alarmu zejdzie po graczu schodami A albo B. Osłony: dwa słupy (x 2522 i 2536, z 401), szafki, zespół pompowy.
- Ucieczka: kolektorem do wylotu na ławie rzeki albo drabiną w szybie windy (pościg nie chodzi po drabinach, ADR-0021).
- Pułapka: w kolektorze nie da się wstać ani biec, więc odwrót po alarmie jest wolny, a schody A i B to jedyne wejścia fali.

### Pora i stan świata
- Pod ziemią bez okien, więc zawsze tak samo. Kolektor działa o każdej porze, ale kombinezon w szafce 14 leży tylko w czasie sabotażu.
- Przed sabotażem piwnica jest pusta i nikt jej nie strzeże. Po nim nic się nie zmienia, nawet po wybuchu w hali (wraki stanowisk w ADR-0082 są odłożone). Bez autozapisu (`autosave: false`).

### Wymagania wobec sceny
- Szafka 14 różna od trzech innych: numer, uchylone drzwiczki z zepsutym zamkiem, kombinezon na wieszaku (ink: „Zamek nie działa od wiosny”). Dziś cztery takie same bryły z `lockers()`.
- Numery szafek 11–14 albo inne, które zgadzają się z „czternaście” z haka.
- Zielone albo jaśniejsze światło u stopy schodów A, B i drabiny w szybie (§13, drogi w górę).
- Wylot kolektora czytelny z ławy: krata odchylona, światło z wnętrza albo ślady w mule (krata jest, `rd-w3b-grate`).

## Dług sceny
Zrobione 23.11: szafka 14 z numerem, uchylonymi drzwiami, kombinezonem i kaskiem (`rd-w3-locker14`, `packages/sim/src/content/tessen-w3/outside-dress.ts`, bryły szafek bez zmian). Zostaje:
- Nazwa w kartach i w grze: ta karta i jej historia mówią „przepust”, a ADR-0082, ink Genzō i podpowiedź `prompt.culvert` mówią „kolektor”. Propozycja: „kolektor” w części „Historia” i „Przeznaczenie” tej karty.
- Ink Genzō mówi o „piwnicy magazynów”, a historia tej karty o pompowni po garbarni. Do uzgodnienia w karcie: piwnica magazynów części z dawną pompownią garbarni w narożniku.
- Światło dróg w górę u stóp schodów A i B i w szybie windy: `packages/engine/src/renderer/tessen-w3/w3-lights.ts` (oprawy w `w3_basement.py`).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-w3-locker14 × 1
- blender: rd-w3b-brick-tall × 1
- blender: rd-w3b-brick-wide × 1
- blender: rd-w3b-bulb × 2
- blender: rd-w3b-grate × 1
- blender: rd-w3b-handrail-a × 1
- blender: rd-w3b-handrail-b × 1
- blender: rd-w3b-panel × 1
- blender: rd-w3b-pipes × 1
- blender: rd-w3b-pump × 1
- blender: rd-w3b-stash × 1
- blender: rd-w3b-water × 1
- prop: blok (concrete), rysunek osobno × 7
- prop: blok (concrete, pochyły) × 3
- prop: blok (metal) × 3
- prop: blok (metal), rysunek osobno × 4

Pomiary zasad (§12–§16):
- rzut: 3 prostokąty, 490 m², wysokość 4,1 / 1,5 / 4,4 m
- siatka 0,5 m: 5 z 6 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 17
- warstwy wyposażenia: makro 3, mezo 5, mikro 9
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 9 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
