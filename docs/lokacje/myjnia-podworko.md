# Podwórko za MYJNIA 24H przy Placu Łokietka (`myjnia-podworko`)

Myjnia samochodowa i podwórko na jej północ, na parkingu za kamienicami przy Placu Łokietka (`CAR_WASH_PLACE` (395; −69) w `lublin/sites.ts`, obszar x 389..417, z −44..−20). Miejsce pierwszego zlecenia: kurier Hebi i jego ochroniarz (M0, `m0_first_contract`), potem zlecenie Kaito `car_wash` i terytorium Hebi `car-wash-yard` (ADR-0091). Stan gry: scena według karty z 23.11 (ADR-0102 p. 5, gałąź `feat/scena-myjnia`); detal w `packages/sim/src/content/car-wash-detail.ts`, modele w `tools/blender/rooms/car_wash.py`.

## Historia
Teren to parking na zapleczu kamienic między Nowym Ratuszem, Lubartowską i Bajkowskiego (OSM w179269921), dojeżdża się do niego od strony Przystankowej (ink `fixer.first_meeting`). Takie parkingi powstały w Lublinie na dawnych podwórzach i ogrodach kamienic, kiedy centrum zapełniło się autami.

W 2077 róg parkingu zajęła myjnia bezobsługowa MYJNIA 24H: maszynownia pod murem, wiata na dwóch słupkach, bramownica i automat do płatności, który nie wydaje reszty (ktoś dopisał to markerem na pasku pod wrzutnikiem). Nikt jej nie pilnuje, więc kurierzy Hebi używają podwórka za nią na przekazania: ciepło od maszynowni, para z odpływu, auta, które nikogo nie dziwią. Właściciel odgrodził róg parkingu od reszty kontenerem i barierką, żeby klienci nie parkowali w kolejce do bramownicy; zostało jedno przejście od Lubartowskiej. Przed chwilą kurier dostał przesyłkę, która należy do klientów Kaito, i czeka na odbiór z ochroniarzem (ink: „Nosi coś, co należy do moich klientów”): kawa jeszcze ciepła, puszki po energetyku, torba z paczką przy nodze. Ktoś zostawił auto w myjni w połowie programu: bramownica stoi nad nim z czerwonym STOP, piana spływa do odpływu. Po prologu Hebi wracają tu we trzech i stoją przy kontenerach (`TERRITORY_GROUPS`, `dead:courier`).

## Klimat
- Światło: czerwony neon MYJNIA 24H (#ff4040) na froncie wiaty, zwrócony na zachód; czerwona lampa podwórka (394; −30, #ff6a6a) nad kurierem. Czerwień znaczy tu zagrożenie (§4), także czerwone STOP na belce bramownicy. Drogi są jaśniejsze: ciepła lampa parkowa przy przejściu od Lubartowskiej (417,4; −27,2) i słabsza, zimna latarnia ścienna na wschodniej ścianie maszynowni (416; −42) nad drogą od Ratusza. Pod wiatą dwie świetlówki, ekran i czytnik automatu płatniczego.
- Dźwięk (§17, ze źródła): syk pary z odpływu stanowiska pod neonem (403,7; −38,5, emiter `STEAM_VENTS`), szum pompy wysokociśnieniowej w klatce na ścianie maszynowni (`rd-cw-machine`, pętla `pump`), szum dmuchawy suszarki bramownicy (`rd-cw-gantry`, pętla `vent`); słychać je w całości na podwórku (otwarte powietrze to osobne „pomieszczenie” w `room-sound-map.ts`), a z wnętrz przytłumione. Do tego brzęczenie neonu i deszcz na blasze wiaty.
- Zapach: chemia do mycia, mokra guma, spaliny.
- Kontrast: automat płatniczy z czytnikiem wszczepów obok przerdzewiałego kontenera i kanistrów chemii na tacce.
- Ruch: para z odpływu stanowiska, w czerwonym świetle neonu; szczotki stoją (program przerwany).

## Przeznaczenie
- M0: likwidacja kuriera (`eliminate_courier`); potem zlecenie `car_wash` (likwidacja, pula `ELIMINATION_SITE_IDS`, wariant pijaka idzie stąd do Koi) i grupa Hebi neutralna, dopóki gracz jej nie sprowokuje.
- Wejścia: od wschodu z Lubartowskiej przez lukę w ogrodzeniu parkingu (422; −30) i ciasne przejście 1,46 m między kontenerem a barierką (419,4; −28,6), droga pijaka w `contract-plans.ts`; od południa, od strony Ratusza, alejką 2,2 m między maszynownią a kontenerem (x 416..418); od północy z chodnika przy Bajkowskiego, gdzie teren opada (G-754).
- Osłony: duży kontener na śmieci (406; −31,5, kryjówka na ciało), mały (399; −30,5), skrzynia (392; −33), auto na parkingu (414,5; −31,5), auto w myjni (406,2; −38,5), automat płatniczy (401,8; −36,4), nogi bramownicy, słupki wiaty, kontener 20 ft przy wschodnim boku.
- Punkt widokowy: brak; teren opada ku Bajkowskiemu, więc od północy podwórko widać z dołu.

## Topografia
- Prawdziwe miejsce: parking w179269921 za Placem Łokietka, przy Lubartowskiej i Bajkowskiego. Teren ok. 195,0–195,6 m n.p.m. (y −0,8..−0,2), na północ opada. Parking jest w OSM ogrodzony (w173531574, z szlabanem n814806996 od Bajkowskiego).
- Zgodne: położenie parkingu, nawierzchnia, ulice dookoła; żaden budynek nie jest wycięty; wschodni bok ogrodzenia parkingu stoi.
- Odstępstwa: myjnia to scena gry na parkingu (T-051, celowe; zamyka alejkę w1208186144 i zwęża chodnik w232464413); teren wyrównany padem x 388..422, z −41..−27 (T-003, celowe, G-754), poziomy na siatce 5 m do z −30. Kontener i barierka przy wschodnim boku podwórka stoją na parkingu (T-051, ruchome, bez muru). Północny bok ogrodzenia w173531574 w obrębie `CAR_WASH_AREA` + 2 m nie jest rysowany (`clearOfGame`), do decyzji (T-051).
- Postacie: kurier, ochroniarz, załoga zlecenia i punkty wariantów stoją na poziomym gruncie padu (z ≤ −30). Pad zostaje: poszerzony do z −22 podniósłby chodnik w232464413 o 0,2–0,5 m, czyli cofnąłby G-754. Krąg grupy Hebi (405; −25) zostaje na północnym skraju, 0,2–0,3 m pod padem: test terytoriów (`territory-groups.test.ts`) trzyma grupy poza nawierzchnią parkingu, a cały poziomy grunt podwórka jest parkingiem.
- Pomiar `inBuilding` na siatce 2 m: podwórko nie ma ścian; od wschodu domyka je kontener i barierka, od północy i zachodu jest otwarty parking. Najbliższe budynki: na południe od z −48 i na zachód od x 381.

## Inwentarz docelowy
Architektura:
- maszynownia (blok 6 × 4,6 × 9 m ze skórką `shop` bez szyldów); od podwórka drzwi serwisowe, żaluzja wentylacji z wentylatorem, pompa w klatce na cokole, rura wody z zaworem, skrzynka bezpieczników, komin kotła nad dach (Blender `rd-cw-machine`, zrobione);
- wiata na dwóch słupkach (bloki `metal`) ze świetlówkami pod dachem (Blender `rd-cw-tubes`, zrobione);
- bramownica na szynach: ramy boczne, belka z czerwonym STOP, dwie szczotki pionowe, szczotka dachowa na ramionach, łuk dysz, suszarka, węże (Blender `rd-cw-gantry` na bryłach nóg, zrobione);
- kontener 20 ft i barierka od strony parkingu z jednym przejściem (modele gry `container`, `ex-railing-b`, zrobione).
Duże obiekty:
- auto w myjni, auto zaparkowane (skórka `car`), dwa kontenery na śmieci (skórka `dumpster`), skrzynia;
- automat płatniczy na słupku przy wjeździe: ekran, sześć przycisków programów, wrzutnik z paskiem „nie wydaje reszty”, czytnik kart i wszczepów (Blender `rd-cw-pay`, zrobione; model gry `ticket-machine` to parkomat);
- wąż ciśnieniowy na zwijaku, lanca, trzy kanistry chemii na tacce, dwa wiadra z gąbkami, ściągaczka (Blender `rd-cw-chem`, zrobione).
Drobiazg w skupiskach:
- przy kurierze: niedopałki, dwie puszki energetyka, kubek kawy z pokrywką, folia po kanapce, torba z paczką (Blender `rd-cw-courier`, zrobione);
- przy kontenerach na śmieci: worki, kartony, butelka, kubek (modele gry ADR-0096 `bags`, `boxes`, `litter`, zrobione);
- na stanowisku: odpływ liniowy, piana spływająca z auta, kałuża z tęczą oleju, mokre ślady opon (Blender `rd-cw-bay`, zrobione).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: dojście z Lubartowskiej idzie przez lukę w ogrodzeniu, wąski pas wzdłuż kontenera i przejście 1,46 m, po którym podwórko otwiera się na 25 m (ciasno, potem szeroko); próg to zmiana światła z ciepłej lampy przejścia na czerwień lampy i neonu. Od Ratusza alejka 2,2 m wzdłuż maszynowni.
- §13 częściowo: każde światło ma oprawę (neon, lampa, lampa parkowa, latarnia ścienna, świetlówki, ekran automatu); czerwień znaczy cel, ciepłe światło drogę od Lubartowskiej, zimne drugą drogę. 60-30-10 nocą (`pnpm shots:palette`, zrzuty 23.11 przed i po): pierwszy kadr z (441; −40) baza 90%, światło 9,5%, akcenty 0,4% (przed 90,5 / 9,1 / 0,5), kadr wiaty z podwórka 80,4 / 17,5 / 2,2 (przed 81,4 / 16 / 2,6); oba poza pasmem: kadr z Lubartowskiej to ciemny parking i tło miasta, a podwórko zasłania maszynownia (dług niżej).
- §14 zgodne: makro (maszynownia, wiata, bramownica, auta, kontenery), mezo (automat, chemia, pompa, lampy, barierka), mikro w trzech skupiskach (kurier, dwa kontenery na śmieci) i na stanowisku.
- §15 zgodne: mokra posadzka, piana i kałuża tylko na stanowisku, gdzie woda ma źródło; obok matowy beton, rdza kontenera, lakier aut i chrom bramownicy.
- §16 zgodne: ulica, prowizorka (kontener i barierka zamiast ogrodzenia), beton i blacha, czerwony neon.
- §17 zgodne: pompa, suszarka i para ze źródła; ruch: para z odpływu; skala: drzwi serwisowe 2,1 m, auta, kontenery, wiadra.

## Scenariusz

### Pierwszy kadr
Gracz wychodzi z Neon Koi, idzie deptakiem na wschód, przez Plac Łokietka i na północ Lubartowską. Przy (441; −40) skręca w parking na zachód: przed nim ogrodzenie parkingu z luką, za nią rdzawy kontener i ciepła lampa nad przejściem, nad dachem maszynowni czerwona poświata neonu MYJNIA 24H i komin kotła. Wzrok ma iść na lampę przy przejściu, a za przejściem na czerwoną lampę nad kurierem.

### Postacie i miejsca
- Kurier Hebi (`courier`, tag `hebi_courier`) przy (396; −30,6) pod czerwoną lampą, twarzą na południe (yaw π), ku myjni; ochroniarz (`guard`) przy (392,5; −30,6), też na południe. Stoją od nowej gry do śmierci.
- Zlecenie `car_wash` (po M0): 2–4 Hebi przy (396; −30,6), (392,5; −30,6), (401,6; −31), (390,8; −35,2), twarzami ku (395; −39), czyli na wjazd do myjni. Ochroniarze wariantu (394,6; −31,6), (397,4; −30), sobowtór (402,4; −32,8), czujka (397; −32,5), zasadzka (395; −36), (393,5; −39,5), (399; −38) przy wiacie.
- Grupa terytorium `car-wash-yard` po śmierci kuriera: trzech Hebi w kręgu wokół (405; −25), na północnym skraju podwórka, palą, dzwonią i gadają na zmianę (`TERRITORY_ACTIVITIES`).
- Hina szuka robotycznego kota na Placu Łokietka (428; −99), 9:00–18:00 (`enc_s7_neko`); kot śpi „pod szczotkami myjni”.

### Przebieg
1. Zlecenie (`fixer.first_meeting`): „Kurier gangu Hebi siedzi w podwórku za myjnią, za Placem Łokietka, od strony Przystankowej. Ma ochronę”. Cel w HUD: „Zneutralizuj kuriera Hebi na podwórku za myjnią przy Placu Łokietka”.
2. Dojście i rozpoznanie: z przejścia przy kontenerze widać obu; kurier patrzy na myjnię, bokiem do wejścia od Lubartowskiej. Napięcie: pierwsza walka w grze.
3. Likwidacja (`eliminate_courier`, flaga `killed:hebi_courier`): nagroda wspomnienie `combat_reflex` („ręce wiedzą, jak celować”). Ciało można schować w dużym kontenerze na śmieci (ADR-0065).
4. Powrót do Koi (`report_back`): Kaito słyszał strzały „i ciszę po nich”; Hebi −15.
5. Po prologu: Hebi wracają na podwórko jako grupa neutralna. Zlecenie `car_wash` kieruje tu znowu; bark `hook_eliminate_1` („Szef co godzinę chodzi sam za myjnię”) pasuje właśnie do tego miejsca.

### Drogi
- Cicha: od Ratusza alejką wzdłuż maszynowni (x 416..418, pod zimną latarnią), za wiatą między pompą a autem, do dużego kontenera na śmieci na 10 m od kuriera; albo od północy, od Bajkowskiego, pod górę stoku: obaj patrzą na myjnię, więc to podejście wchodzi im za plecy.
- Głośna: od Lubartowskiej przez przejście przy kontenerze, za autem zaparkowanym (414,5; −31,5); 20 m otwartej przestrzeni do celu.
- Ucieczka: przejściem na Lubartowską i na południe do Placu Łokietka i metra A (433; −107), na północ w dół ku Bajkowskiemu, na zachód parkingiem.
- Pułapki: zasadzka wariantu `ambush` stoi pod wiatą, na wylocie cichej drogi zza maszynowni; przejście przy kontenerze to wąskie gardło, łatwe do pilnowania.

### Pora i stan świata
- Noc: czerwona lampa i neon świecą na cel, lampa parkowa i latarnia ścienna na drogi; para z odpływu widoczna w czerwieni neonu. Dzień: parking pełny, bramownica stoi.
- Przed M0: kurier i ochroniarz, nic więcej. Po M0: dwa ciała (do streamingu), potem grupa Hebi (`dead:courier`); uraza Hebi w `shinsekai-7` z zabójstw rośnie, a o świcie spada (ADR-0091). Postawa Hebi w całym mieście po prologu ok. −19.
- Akt I: `echo_contract` może wypaść tutaj (`car_wash`).

### Wymagania wobec sceny
- Podwórko domknięte rzeczami, które mogą stać na parkingu, z jednym ciasnym przejściem od Lubartowskiej (§12): zrobione (kontener i barierka, 1,46 m).
- Myjnia działa: szczotki i dysze bramownicy, mokra posadzka, piana, dźwięk pompy i suszarki: zrobione; kot pod szczotkami (ink `enc_s7_neko`): dług.
- Ślad „przed chwilą”: ciepły kubek i niedopałki przy kurierze, przesyłka w torbie przy jego nodze: zrobione (kubek bez pary).
- Światło drogi od Lubartowskiej i drugie, słabsze, od Ratusza (dwie drogi, §9): zrobione.
- Kurier i ochroniarz na poziomym gruncie padu: zrobione (postacie przesunięte, pad bez zmian).

## Dług sceny
Zrobione 23.11 (ADR-0102 p. 5): bramownica, automat płatniczy, chemia i wąż, maszynownia od podwórka, świetlówki wiaty, mokre stanowisko i drobiazg kuriera z Blendera (`tools/blender/rooms/car_wash.py`, klucze `rd-cw-*` na końcu `ROOM_DETAIL_SHAPES`); kontener 20 ft, barierka, lampa parkowa, latarnia ścienna i drobiazg przy kontenerach na śmieci z modeli gry (`packages/sim/src/content/car-wash-detail.ts`, bryły z `furnitureProps`); para z odpływu stanowiska zamiast z powietrza nad stokiem (`STEAM_VENTS`); pompa i suszarka jako emitery dźwięku na otwartym powietrzu (`packages/engine/src/audio/room-sound-map.ts`); kurier, ochroniarz, załoga zlecenia, punkty wariantów i droga pijaka na poziomym gruncie padu (`district-m0.ts`, `contract-plans.ts`).

Zostaje:
- Grupa Hebi `car-wash-yard` w kręgu wokół (405; −25), na stoku za krawędzią padu: przenieść ją na poziomy grunt przy kontenerach wymaga zgody na stanie na nawierzchni parkingu (dziś `onRoad` w `territory-groups.test.ts` liczy cały parking jako jezdnię): `packages/sim/src/content/territory-groups.ts` i test.
- Kot pod szczotkami (ink `enc_s7_neko`): model śpiącego srebrnego kota tylko do flagi `enc_s7_neko_returned`, czyli rekwizyt warunkowy (dziś detal jest stały): `packages/sim/src/content/car-wash-detail.ts` i mechanizm obecności rekwizytu po fladze.
- Ruch szczotek albo dmuchawy (dziś stoją, program przerwany; ruchomy element to osobna siatka i wywołanie rysowania): `packages/engine/src/renderer`, po pomiarze budżetu `krakowskie-tpp`.
- 60-30-10 pierwszego kadru poza pasmem (baza 90%, światło 9,5%): z Lubartowskiej podwórko zasłania maszynownia; rozważyć neon albo szyld MYJNIA także na wschodniej ścianie maszynowni (`district-car-wash.ts`), żeby myjnia była punktem orientacyjnym od wejścia (§9).
- Północne ogrodzenie parkingu w173531574 z szlabanem n814806996: przywrócić (podejście od Bajkowskiego przez szlaban, za plecami kuriera) albo wpisać jako celowe (T-051): `packages/sim/src/content/street-props.ts` (`clearOfGame`, `CAR_WASH_AREA`), przegląd `topography-curator`.
- Para z kubka kawy kuriera (ślad „przed chwilą”): cząsteczki są drogie, więc najwyżej wspólny system z odpływem: `packages/engine/src/renderer/screen-fx.ts`.
- Sprzeczność ink i gry: Kaito mówi „od strony Przystankowej”, a droga z gry (pijak, dojście) idzie Lubartowską; ulicy Przystankowej nie ma w danych mapy Krakowskiego. Propozycja: w `packages/narrative/ink/{pl,en}/m0.ink` „od strony Lubartowskiej” albo potwierdzić Przystankową w OSM i dać jej nazwę na minimapie.
- Bark `hook_eliminate_1` („za myjnię”) pasuje tylko tutaj, a gra daje go na każdym miejscu likwidacji: wpis w kartach pozostałych miejsc, poprawka w `packages/narrative/ink/{pl,en}/hooks.ink` albo osobny bark na miejsce w `packages/sim/src/content/contract-hooks.ts`.
