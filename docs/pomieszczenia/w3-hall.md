# Hala zakładu W-3 (`w3-hall`)

Zakład odzysku wody Tessenu na Nabrzeżu, za ogrodzeniem (ADR-0082). W jego wielkiej nawie Tessen montuje drony: dwie taśmy z ramionami, stanowiska S1–S4, palety części, suwnica, za ścianą komora testów; wokół rzędy S i N z magazynami, warsztatami i korytarzami.

## Historia
W-3 zbudowano w 2051, gdy Bystrzyca przestała nadawać się do picia. Tessen przejął zakład od miasta za symboliczną złotówkę, zwolnił połowę ludzi i wstawił roboty. Zbiorniki przeniósł do rzędów przy ścianach, a w nawie, gdzie stały, ustawił linię montażu dronów, o której w papierach zakładu nie ma ani słowa. W hali pracuje dziś kilkunastu techników na trzy zmiany, reszta to automatyka. Przy północnej ścianie przecieka rura spustowa, którą od miesięcy łata się taśmą i wiadrem. Ktoś z nocnej zmiany zostawił na pomoście toru suwnicy termos, kanapkę w folii i kask z rękawicami.

## Klimat
Przemysłowy mrok przecięty żółtymi lampami nad przejściami i zielonymi znakami ewakuacji. Iskry spawania na taśmach, szum napędów, kapanie. Barierki z łuszczącą się farbą, etykiety ostrzegawcze, kable w korytach pod sufitem. Korporacja tu nie sprząta, tylko liczy.

## Przeznaczenie
Teren infiltracji i walki (akt Tessenu): przejścia między zbiornikami jako osłony, dwa poziomy (posadzka i pomosty), wejście z wieży i wyjście do piwnicy. Autozapis wyłączony.

## Inwentarz docelowy
Linię rysuje silnik (`packages/engine/src/renderer/tessen-w3/`): taśmy, ramiona w ruchu, ekrany stanowisk, iskry, suwnica, drony w komorze testów, napisy i pasy ostrzegawcze. Bryły i przegrody hali daje symulacja (`tessen-w3/hall-inside.ts`, `rows-s.ts`, `rows-n.ts`).

Z Blendera (`tools/blender/rooms/w3_hall.py`, plik `room-detail-w3-props.glb`):
- cztery palety części na bryłach palet przy długich ścianach: skrzynie z ramionami wirników w dwóch warstwach, z pasami szablonowymi, etykietami i folią, albo worki granulatu i zwój kabla (`rd-w3h-pallet-crates`, `rd-w3h-pallet-sacks`); bryły palet zostają, siatka wnętrza hali je pomija;
- wózek paletowy zaparkowany przy ścianie (`rd-w3h-jack`);
- cztery beczki chemii na żółtej wannie wychwytowej, pompka ręczna w jednej (`rd-w3h-barrels`);
- przeciek: rura spustowa na ścianie, złącze owinięte taśmą, wiadro do połowy z wodą, kałuża, składana tabliczka „mokra podłoga” (`rd-w3h-leak`);
- koryto kablowe wzdłuż ściany południowej z trzema wiązkami i kablem zwisającym do puszki (`rd-w3h-trays`);
- na pomoście toru N: termos z kubkiem, kanapka w folii, kask z rękawicami (`rd-w3h-break`);
- znaki wyjścia ewakuacyjnego nad drzwiami (`rd-w3h-exit`), tablice ostrzegawcze na trzech ścianach (`rd-w3h-warning`).
- na blatach stanowisk S1–S4 przy taśmach to, co zostawił spawacz: maska z podniesioną szybką, skórzane rękawice, kuweta śrub, puszka napoju, tablet z listą kontrolną w gumowym etui (`rd-w3h-station`).

Na telefonie (niska jakość) gra rysuje z tej listy tylko palety, bo stoją za bryły, które siatka hali pomija; resztę pomija jako drobiazg (`fine`, budżet trójkątów hali W-3 w `npr-perf`).

Z generatora wnętrz (ADR-0099, zestaw `assembly-hall` w `room-kits.ts`, układ `W3_HALL_LAYOUT` w `room-dressing-rooms.ts`): gaśnice przy bramie komory testów i przy śluzie S, skrzynki rozdzielcze, kratki odpływu przy ścianach, plamy oleju przy podstawach ramion taśmy, kartony z dostawą części. Wolne zostają alejka między taśmami, przejścia do śluz, drzwi północne, brama komory i drabina na tor suwnicy. Na telefonie nic z tego (drobny detal, budżet hali).

Z partii 2 (ADR-0099, zestaw `assembly-hall`): szafy sterownicze linii przy ścianach (ekran z błędem, przyciski, wyłącznik awaryjny) i rząd szafek zmiany z jedną otwartą (kask, rękawice, termos).

Do zrobienia w kolejnych krokach: koryta pod stropem nad linią, zbiorniki w rzędach (dziś bloki).

## Frakcja i zasady
Frakcja: korporacja (Tessen, przemysł); druga: technika (linia produkcyjna).
- §12 dług: 3 z 74 wymiarów na siatce. Kontrast: wejście przez biuro przepustek (ciasno) do hali (16 m): zgodne.
- §13 zgodne (światło): lampy W-3 mają oprawy w geometrii silnika (świetlówki pod każdym stropem, `w3-inside-geometry.ts`, sprawdzone 22.11), choć pomiar kart ich nie widzi, bo nie są bryłami. W hali siedem lamp (`w3-lights.ts`): cztery białe pod drugim i czwartym rzędem świetlówek nad krawędziami alejki (światło), turkus ekranów stanowisk S1 i S3 na blatach i posadzce oraz czerwień świateł nad bramą komory testów (akcenty); poza halą dwie, żeby reflektory placu i latarnie miały swoje miejsca w shaderze. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 91,6%, światło 8,3%, akcenty 0%; po niej baza 58,2%, światło 35,6%, akcenty 6,2%, zgodne. Dług: drzwi do piwnicy i biura w barwie nawigacji.
- §14 zgodne: 31 rzeczy drobiazgu, 28 w sześciu skupiskach (przeciek, rzeczy nocnej zmiany, cztery stanowiska S1–S4 przy taśmach: maska spawalnicza, rękawice, kuweta śrub, puszka, tablet z listą kontrolną, `rd-w3h-station`), 3 luzem (10%, tablice ostrzegawcze na ścianach). Dalej: szafki w rzędach.
- §15 częściowo: kapanie w opisie; plamy oleju przy podstawach ramion i kratki odpływu (generator). Dług: połysk plam i posadzki.
- §16 zgodne: korporacja, która „nie sprząta, tylko liczy”.
- §17 częściowo: iskry i taśmy jako ruch; szum napędów ze źródła do sprawdzenia. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): buczenie skrzynek i kapanie przecieku (obok pejzażu W-3), w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Droga cicha z piwnicy (Q1): Seki wychodzi schodami A na linię podzespołów w rzędzie S, drzwiami w korytarz S i drzwiami hali (2512; 406) do nawy, twarzą na północ. Strop 16 m nad nią, przed nią taśma L1 z ramionami i stanowiska S1 i S2 z ekranami (turkusowe światło przy S1), za nimi aleja produkcyjna (z 413–423), dalej taśma L2. Na zachód szeroko otwarta śluza wagonowa ze strażnikiem, na wschód brama komory testów pod czerwonymi światłami. Wysoko po północnej stronie okna galerii antresoli, a w nich czasem kierownik zmiany. Wzrok ma iść wzdłuż alei na wschód, ku korytarzowi N i serwerowni. Droga Q2 zaczyna się inaczej: włazem z dachu rzędu N prosto do serwerowni N, ciasnej, pod szafami serwerów.

### Postacie i miejsca
Sabotaż `sabotage` (kontrakt `w3_hall`, ADR-0082 §1–§2, `tessen-w3/mission.ts`, `posts.ts`, `mission-loud.ts`):
- P1, patrol hali: pętla (2512; 418) → (2546; 418) → (2546; 431) → (2512; 431), co drugie okrążenie dalej korytarzem N do drzwi serwerowni N (2566; 431). Nie rozpoznaje przebrań.
- P2, patrol antresoli: galeria +5,5 od (2503,5; 433,5) do (2557; 433,5) i z powrotem.
- Kierownik zmiany (egzekutor przebrań): biuro na antresoli (x 2524–2536), przy biurku twarzą do drzwi (2530), raz na okrążenie zatrzymuje się w oknie nad linią (2540; 430,95) i patrzy w dół, potem cofa się o krok.
- Strażnik śluzy wagonowej (2505; 418), twarzą na wschód wzdłuż alei. Strażnik zbrojowni S (2552; 402,6) przy drzwiach wewnętrznych, twarzą w pokój.
- Technicy linii: przy S2 (2537; 414,2) nad taśmą L1 i przy S3 (2519; 421,8) nad L2.
- Kamera serwerowni N w północno-zachodnim narożniku (2561,8; 3,6; 438,8), patrzy na drzwi i front terminalu rdzenia (2566; 437,1). Martwy kąt przy terminalu od strony wschodniej szafy (2568,6; 438,4).
- Na dachu rzędu N dwie kamery na attyce (2530; +11,5; 440) na zachód i (2556; +11,5; 440) na wschód, w kabinie wieży obserwator (`tessen_sniper`, 40 m wzroku, przed alarmem nie strzela).
- Fale alarmu: trzech ze śluz od razu (2506; 409,5), (2506; 426), (2507; 416), trzech z placu odbioru po 60 s (2520, 2530, 2540; 446).
- Poza halą: technik na papierosie przy furtce serwisowej (2552,3; 390,4), 19:00–23:00.

### Przebieg
1. Zlecenie u Genzō, raz w grze: „Dwanaście dronów bojowych z hali W-3. Wojsko odbiera je o szóstej rano”. Seki dostaje pendrive `w3_virus` i dwa haki: kolektor do piwnicy z kombinezonami w szatni i rurociąg na dach rzędu N z włazem. Termin to najbliższa 6:00 odległa o co najmniej 6 godzin.
2. Rozpoznanie: technik przy furtce wieczorem (`hook_sabotage_2`, szafka 14), strażnik śluzy (`hook_sabotage_1`: patrol schodzi do serwerowni co drugie okrążenie).
3. Droga cicha: piwnica, kombinezon `tessen_overalls`, linia podzespołów, przejście przez aleję w rytmie postoju kierownika w oknie, korytarz N między okrążeniami P1, serwerownia N. Albo dach: dwie kamery (`reboot_optics` oślepia je na 30 s), właz (2564; 439,3), drabina w dół.
4. Wgranie: 40 s (25 s po złamaniu ICEpickiem) w promieniu 3 m od terminalu, z martwego kąta kamery. Potem „Wyjdź ze strefy W-3 niezauważona”, przez płot albo do metra. Wypłata telefonem (2000 przy poziomie 1, 1420, gdy ktoś widział wyjście).
5. Przejście na głośną: alarm przed końcem wgrywania zamyka serwerownie (zamek `alarm`): „Serwerownia odcięta. Zostaje zbrojownia”.
6. Droga głośna: zbrojownia S, „Weź ładunki” ze skrzynki (2555; 0,9; 400,8) zawsze podnosi alarm, skrzynia z łupem obok (2552; 0,8; 397). Trzy ładunki na trzech z czterech stanowisk S1–S4, po 2,5 s każdy, potem 60 s lontu i ucieczka z hali przez bramę albo do metra. Telefon `phone_genzo_paid_loud`, Tessen najwyżej −60, pościg 3 dni.
7. Porażka: o 6:00 bez wirusa i bez wybuchu partia wyjeżdża (`batch-shipped`, `phone_genzo_failed_shipped`).

### Drogi
- Cicha Q1: kolektor, piwnica, schody A na linię podzespołów albo schody B do warsztatu W2, korytarz S, drzwi hali 2512 albo 2546, aleja, korytarz N, drzwi serwerowni (2566; 432). Osłony: taśmy 1,2 m (kucanie), podstawy ramion 1,8 m, palety 1,4 m.
- Cicha Q2: drabina rurociągu na zachodnim brzegu, chodnik +10, podest wieży, kładka na dach N, około 64 m po dachu między agregatami chłodzenia, właz. Pułapka: obserwator w kabinie wieży widzi dach i plac odbioru.
- Głośna: zbrojownia S od korytarza S (drzwi zewnętrzne (2552; 396) są na razie zamkniętym skrzydłem). Fale wchodzą ze śluz od zachodu i z placu odbioru od północy.
- Ucieczka: śluzy na zachodni plac i do furtki, metro A Nabrzeże (wejście na pasie publicznym, peron pod magazynem S). Tor suwnicy N +12 (drabina (2520; 429,3)) to punkt widokowy nad linią.
- Kryjówki ciał: szafki w szatni piwnicy i w śluzach, skrzynie części w magazynach, kontener na placu odbioru.

### Pora i stan świata
- W hali świeci tylko jej własne światło (tryb wnętrza), więc w środku jest tak samo o każdej porze. Zapis startowy wycinka zaczyna o 21:00 przy Genzō, a technik pali przy furtce 19–23, więc dobre okno to wieczór i noc. Na placu odbioru nocą stuka ktoś w kontenerze (`enc_doki_container`, 22–4).
- Bez zlecenia w hali nie ma ludzi sabotażu: posterunki, patrole i techników stawia szablon kontraktu. Po cichej drodze Tessen bez zmian, po głośnej wrogi w mieście przez 3 dni pościgu. Sabotaż jest jednorazowy, potem Genzō wraca do infiltracji i włamania.
- Wewnątrz strefy bez autozapisu (`autosave: false`).

### Wymagania wobec sceny
- Aleja i oba korytarze czytelne jako droga patrolu: żółte lampy nad przejściami są, drzwi do piwnicy i do biura w barwie nawigacji są długiem w audycie.
- Okno kierownika nad linią widoczne z alei, żeby gracz zobaczył jego postój, zanim przejdzie (§9).
- Terminal rdzenia jaśniejszy niż szafy i martwy kąt kamery czytelny z progu serwerowni.
- Stanowiska S1–S4 jako cele ładunków czytelne z daleka. Turkusowe światło ekranów pada dziś tylko przy S1 i S3.
- Odbiór partii: plac odbioru z ciężarówką wojska i rampą, bo termin 6:00 to cała stawka misji.

## Dług sceny
- Ink przeczy grze: Genzō w `packages/narrative/ink/{pl,en}/m4-doki.ink` (`offer`, sabotaż) mówi „Są dwa wejścia, których nikt nie pilnuje”, a od G-908 na dachu N są dwie kamery i obserwator w kabinie wieży. ADR-0082 („Po playteście 17.11”) zapisał tę poprawkę. Propozycja: „Rurociąg na dach rzędu N. Na dachu są dwie kamery, a z kabiny wieży patrzy obserwator”.
- Telefon `phone_genzo_failed_shipped` w `packages/narrative/ink/{pl,en}/phone.ink`: „Partia odpłynęła z nabrzeża”, a ADR i Genzō mówią o odbiorze przez wojsko (łodzi w v1 nie ma). Propozycja: „Partia odjechała z placu odbioru o szóstej”.
- Drzwi zewnętrzne zbrojowni S (2552; 396) z kodem (ADR-0082 §1 droga głośna): dziś zamknięte skrzydło w `packages/sim/src/content/tessen-w3/rows-s.ts`, odłożone w etapie 3b.
- Stanowiska S2 i S4 bez turkusowej plamy światła, którą mają S1 i S3: `packages/engine/src/renderer/tessen-w3/w3-lights.ts` (w budżecie świateł shadera albo samoświeceniem blatu).
- Plac odbioru z ciężarówką wojska i rampą jako cel terminu 6:00: rekwizyty w `packages/sim/src/content/tessen-w3/public.ts` albo nowym pliku placu, rysunek z `vehicle-props`.
- Światło nad drzwiami serwerowni N i nad terminalem rdzenia (§13): `w3-lights.ts`, oprawa w `tools/blender/rooms/w3_hall.py`.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-cartons × 2
- blender: rd-c-drain × 3
- blender: rd-c-extinguisher × 2
- blender: rd-c-fusebox × 2
- blender: rd-c-puddle × 3
- blender: rd-k-control-cabinet × 3
- blender: rd-k-lockers × 1
- blender: rd-w3h-barrels × 1
- blender: rd-w3h-break × 1
- blender: rd-w3h-exit × 2
- blender: rd-w3h-jack × 1
- blender: rd-w3h-leak × 1
- blender: rd-w3h-pallet-crates × 2
- blender: rd-w3h-pallet-sacks × 2
- blender: rd-w3h-station × 4
- blender: rd-w3h-trays × 1
- blender: rd-w3h-warning × 3
- prop: blok (concrete), rysunek osobno × 19
- prop: blok (concrete, pochyły) × 1
- prop: blok (metal) × 13
- prop: blok (metal), rysunek osobno × 63
- prop: blok (metal, pochyły) × 1

Pomiary zasad (§12–§16):
- rzut: 37 prostokąty, 3409 m², wysokość 16,0 / 13,4 / 10,0 / 5,0 / 4,5 / 2,6 / 7,5 / 6,0 m
- siatka 0,5 m: 3 z 74 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 58
- warstwy wyposażenia: makro 32, mezo 29, mikro 31
- drobiazg w skupiskach (≥ 3 w 1,2 m): 6 skupisk, 28 rzeczy w nich, 3 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
