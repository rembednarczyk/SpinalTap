# Klinika doktora Moriego (`clinic`)

Parter kamienicy przy Krakowskim Przedmieściu, północna pierzeja deptaku (ADR-0038, ADR-0045). Jedno pomieszczenie za szklanymi drzwiami, z oknem na deptak.

## Historia
W latach dwudziestych była tu apteka „Pod Złotym Moździerzem”, potem bank, potem lombard. Mori wynajął lokal w 2069 za długi poprzedniego najemcy i do dziś nie zdjął z zaplecza sejfu lombardu. Oficjalnie to gabinet „medycyny estetycznej”. W praktyce wszczepia i wyjmuje to, czego nie wolno sprzedawać, a płaci mu się gotówką albo przysługą. Fotel zabiegowy kupił z likwidacji szpitala na Jaczewskiego, lampę operacyjną z demobilu wojskowego. Ostatni pacjent wyszedł kwadrans temu: na tacy leży jeszcze zakrwawiona gaza.

## Klimat
Zimne, sine światło lampy operacyjnej nad fotelem, ciepła żarówka nad biurkiem Moriego, czerwona dioda autoklawu. Kafle sprzed stu lat, popękane, z łatami z blachy. Pachnie środkiem dezynfekującym i papierosami. Technika za fortunę stoi obok plastikowego wiadra.

## Przeznaczenie
Miejsce zadań i usług: wszczepy, leczenie, rozmowy z Morim. Gracz wchodzi z deptaku, rozmawia przy biurku, siada na fotelu. Jedno wejście od ulicy i zaplecze za kotarą (droga ucieczki w zadaniach).

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/clinic.py`, 22.11) albo do zrobienia.

Architektura:
- kafle ścienne do 1,6 m z łatami, sufit z rurami i korytem kablowym (do zrobienia);
- kotara na szynie do zaplecza, okno na deptak z żaluzją (do zrobienia).

Duże obiekty:
- fotel zabiegowy na hydraulicznej kolumnie, oparcie uniesione pod kątem, podnóżek, podłokietniki z pasami, pedał (zrobione: `rd-clinic-chair`);
- lampa operacyjna z sufitu, dwie głowice po sześć soczewek (zrobione: `rd-clinic-lamp`);
- wózek narzędziowy z trzema szufladami i tacą (zrobione: `rd-clinic-cart`);
- lada recepcji z perforowanym frontem, monitorem na ramieniu i czytnikiem kart (zrobione: `rd-clinic-reception`);
- ławka w poczekalni z czterech siedzisk, jedno pęknięte (zrobione: `rd-clinic-bench`);
- szafa lekowa ze szklanymi drzwiami, autoklaw z czerwoną diodą (zrobione: `rd-clinic-cabinet`);
- sejf lombardu, biurko Moriego z dwoma monitorami (do zrobienia: wymaga brył symulacji);
- pojemnik na odpady medyczne (zrobione: `rd-clinic-sharps`).

Drobiazg:
- taca z narzędziami i zakrwawioną gazą, rękawiczki, strzykawka (zrobione: `rd-clinic-cart`);
- karty pacjentów, zimna kawa, popielniczka pełna niedopałków, długopis na ladzie (zrobione: `rd-clinic-counter-things`);
- ramki monitorów „PULS 48”, plakat anatomiczny, kable z taśmą (do zrobienia).

## Frakcja i zasady
Frakcja: technika (ripperdoc); druga: ulica (kafle, wiadro).
- §12 dług: 0 z 2 wymiarów na siatce (obrys z kamienicy, §1). Instalacje na wierzchu do dodania pod stropem.
- §13 zgodne: tryb wnętrza z lampami przy oprawach (`room-lights.ts`, od 22.11): oprawa świetlówkowa poczekalni (`rd-tessen-lights` pod stropem), lampa zabiegowa nad fotelem, turkus znaków NUMER 7 i PULS 48. Dług: fotel i terminal Moriego jako cel rozmowy mocniej wyróżnione. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 53,8%, światło 41,1%, akcenty 5,1% (wcześniej 87,8 / 10,8 / 1,4).
- §14 zgodne: 14 rzeczy drobiazgu w trzech skupiskach (wózek z narzędziami, szafka z lekami, lada recepcji), nic luzem.
- §15 dług: kafle i stal z połyskiem, kałuża przy umywalce (umywalka jest od partii 2 ADR-0099: `rd-k-washbasin` na południowej ścianie gabinetu przy wezgłowiu fotela, z lustrem, mydłem, ręcznikami i koszem; kotara na szynie `rd-k-curtain` między fotelem a przejściem).
- §16 zgodne: zimne światło techniki na brudnej ulicy.
- §17 do sprawdzenia: buczenie autoklawu. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): świetlówki poczekalni, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Nowa gra: Seki otwiera oczy na fotelu zabiegowym w gabinecie (319,6; −64,9), twarzą na wschód, wzdłuż fotela ku podnóżkowi (`CLINIC_WAKE_SPOT`, `CLINIC_WAKE_YAW`). Nad nią dwie głowice lampy zabiegowej świecą bielą (#eafcff), jak w ink `mori.wake_up`: „Biała lampa nad fotelem świeci ci prosto w oczy”. Po lewej przy tylnej ścianie turkusowy ekran PULS 48 i Mori przy monitorach. Po prawej z przodu przejście w ściance działowej do poczekalni, a za nim szklane drzwi na deptak. Wzrok ma iść na Moriego (rozmowa) i na przejście (droga do Neon Koi). Kto wraca z deptaku, wchodzi od południa pod turkusowym neonem KLINIKA, przez drzwi 1,6 m (321,4; −72,3): poczekalnia z ławką i ladą recepcji, ekran NUMER 7, w głębi biel lampy nad fotelem.

### Postacie i miejsca
- Doktor Mori (`mori`, frakcja `clinic`, sklep i rozmowa `mori`) przy monitorach za fotelem (322,2; −63,3), twarzą na zachód-południowy zachód, ku fotelowi. Stoi tu zawsze, bez planu dnia.
- Seki leży na fotelu tylko na starcie nowej gry. Potem fotel jest miejscem zabiegów w scenach (`mori.module`, `recall_operating_table`).
- Babcia Ume (`ume`) zamiata deptak przed kliniką (328,5; −76,8) od 6:30, a o 23:00 idzie spać do bramy obok (329,2; −73,4) (`schedules.ts`).
- Przed drzwiami na deptaku właz z parą (312; −83). Drzwi Neon Koi są 22 m na południowy zachód, po drugiej stronie deptaka.

### Przebieg
1. Pobudka (M0, krok `find_fixer`). Mori zagadnięty mówi `mori.wake_up`: odłamki szyby, „pół metra cudzego kabla”, Kaito zapłacił. Odsyła do Neon Koi: „Drzwi otwierają się same. Nie kop ich”. Cel w HUD prowadzi do Kaito, a rozmowa z Morim jest opcjonalna.
2. Sklep: wszczepy i leczenie u Moriego. Kaito poleca go w `fixer.contract_menu`: „Bierze gotówkę i nie zadaje pytań”.
3. Akt I, krok `ask_mori`. Po wspomnieniu walizki Mori obraca monitor ze skanem czaszki: moduł Kagami za uchem, potem igła diagnostyki (`mori.module`, flaga `mori_module`). Retrospekcja `recall_operating_table` kończy się na tym samym fotelu: „Siedzisz w fotelu u Mori, a on wyciąga ci igłę zza ucha”.
4. Krok `new_implant`. Nowy wszczep od Moriego budzi `recall_crash_night`, który kończy się przed kliniką: „Stoisz przed kliniką Mori i trzymasz się framugi”.
5. Krok `decide`. Mori proponuje wyjęcie modułu (`mori.decision`). Zakończenie „aya”: moduł zostaje, wpis do kartoteki. Zakończenie „seki”: Mori wyjmuje moduł pincetą do szklanej fiolki. Nagroda: cywile +5 i koniec aktu I. Za drzwiami gra `act2_opening` (`module_voice`: „Za drzwiami kliniki moduł za uchem zaczyna szumieć”).
6. Akt II, krok `ren_trail` po „seki”: Mori przyznaje, że fiolkę kupił Ren Odagiri, i mówi, że Ren nocuje na dachu Alchemii (`mori.sold`, flaga `ren_trail`).

### Drogi
- Jedno wejście, szklane drzwi automatyczne od deptaku (`door:klinika`), i jedno przejście w ściance działowej (węzły `s7-clinic-in`, `s7-surgery` w `S7_NAV`). Zaplecza ani drugiego wyjścia w grze nie ma.
- Klinika nie jest miejscem walki: żadne zlecenie ani przestępstwo nie stawia tu wrogów. Ucieczka prowadzi deptakiem: na zachód ku Placowi Litewskiemu, na wschód ku Bramie Krakowskiej i Placowi Łokietka.

### Pora i stan świata
- Wnętrze wygląda tak samo o każdej porze (lampy własne, okna wnętrza z ADR-0061 niesprawdzone). Mori jest zawsze. Ume za dnia stoi za drzwiami, w nocy śpi w bramie obok.
- Przed `met_fixer` Seki jest po wypadku, a Mori odsyła ją do Kaito. Po akcie I: przy „aya” rozmowa `after_aya`, przy „seki” fiolka z modułem, do chwili, gdy w akcie II Mori ją sprzedaje.
- Terytoria Hebi i uraza w `shinsekai-7` nie sięgają wnętrza (ADR-0091: bez wnętrz z fabułą).

### Wymagania wobec sceny
- Fotel pod białą lampą widoczny od drzwi wzdłuż osi poczekalnia, przejście, gabinet (§9): jest.
- Monitor na ramieniu przy fotelu, który Mori obraca do Seki (ink `mori.module`), i biurko Moriego z dwoma monitorami. Dziś jest ekran PULS 48 na tylnej ścianie, a biurka nie ma (karta: „wymaga brył symulacji”).
- Ślad nocy, którą Kaito przesiedział przy fotelu (ink `ume`, `koi_barman`): stołek obok fotela, kubek, niedopałki.
- Fiolka z modułem na półce szafy po zakończeniu „seki”, do sprzedaży w akcie II.
- Lampa zabiegowa Moriego różna od lampy Kagami z retrospekcji (ink: „Inna niż u Mori, większa, z sześcioma soczewkami”).

## Dług sceny
Zrobione 23.11: lampa Moriego z czterema soczewkami na głowicę (ink odróżnia lampę Kagami po sześciu, `tools/blender/rooms/clinic.py`), stołek Kaito z kubkiem i niedopałkami przy fotelu (`tools/blender/rooms/clinic_kaito.py`, test `packages/sim/test/clinic-scene.test.ts`); sprzeczność ink o fiolce poprawiona w #955. Zostaje:
- Monitor na ramieniu przy fotelu i biurko Moriego jako bryła: na końcu `clinic()` w `packages/sim/src/content/interiors.ts` (świadoma zmiana id i złotego hasha), rysunek w `tools/blender/rooms/clinic.py` i `packages/sim/src/content/clinic-detail.ts`.
- Fiolka na półce szafy lekowej (`rd-clinic-cabinet`) zależy od flagi zakończenia, a rekwizyty wnętrz są dziś stałe. Do decyzji: rekwizyt zależny od flagi w `clinic-detail.ts` albo tylko kwestia w ink.
- Część „Przeznaczenie” tej karty mówi o zapleczu za kotarą jako drodze ucieczki, a w grze kotara (`rd-k-curtain`) dzieli tylko fotel od przejścia. Propozycja: poprawić kartę albo, jeśli klinika dostanie zadanie z walką, dodać drzwi zaplecza do klatki kamienicy w `packages/sim/src/content/interiors.ts` (§9).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-clinic-bench × 1
- blender: rd-clinic-cabinet × 1
- blender: rd-clinic-cart × 1
- blender: rd-clinic-chair × 1
- blender: rd-clinic-counter-things × 1
- blender: rd-clinic-lamp × 1
- blender: rd-clinic-reception × 1
- blender: rd-clinic-sharps × 1
- blender: rd-clinic-stool × 1
- blender: rd-k-curtain × 1
- blender: rd-k-washbasin × 1
- blender: rd-tessen-lights × 1
- prop: blok (concrete) × 3
- prop: blok (concrete), rysunek osobno × 1
- prop: blok (glass), rysunek osobno × 2
- prop: blok (metal) × 1
- prop: blok (metal), rysunek osobno × 6
- prop: neon × 3
- prop: neon, rysunek osobno × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 62 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 3
- warstwy wyposażenia: makro 6, mezo 17, mikro 18
- drobiazg w skupiskach (≥ 3 w 1,2 m): 4 skupisk, 18 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 7
<!-- inwentarz-gry:end -->
