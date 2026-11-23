# Podwórko za MYJNIA 24H przy Placu Łokietka (`myjnia-podworko`)

Myjnia samochodowa i podwórko na jej północ, na parkingu za kamienicami przy Placu Łokietka (`CAR_WASH_PLACE` (395; −69) w `lublin/sites.ts`, obszar x 389..417, z −44..−20). Miejsce pierwszego zlecenia: kurier Hebi i jego ochroniarz (M0, `m0_first_contract`), potem zlecenie Kaito `car_wash` i terytorium Hebi `car-wash-yard` (ADR-0091). Stan gry na `1de4702`.

## Historia
Teren to parking na zapleczu kamienic między Nowym Ratuszem, Lubartowską i Bajkowskiego (OSM w179269921), dojeżdża się do niego od strony Przystankowej (ink `fixer.first_meeting`). Takie parkingi powstały w Lublinie na dawnych podwórzach i ogrodach kamienic, kiedy centrum zapełniło się autami.

W 2077 róg parkingu zajęła myjnia bezobsługowa MYJNIA 24H: maszynownia pod murem, wiata na dwóch słupkach, bramownica i automat do płatności, który nie wydaje reszty. Nikt jej nie pilnuje, więc kurierzy Hebi używają podwórka za nią na przekazania: ciepło od maszynowni, para z kratki, auta, które nikogo nie dziwią. Przed chwilą kurier dostał przesyłkę, która należy do klientów Kaito, i czeka na odbiór z ochroniarzem (ink: „Nosi coś, co należy do moich klientów”). Ktoś zostawił auto w myjni z otwartym kołpakiem w połowie programu. Po prologu Hebi wracają tu we trzech i stoją przy kontenerach (`TERRITORY_GROUPS`, `dead:courier`).

## Klimat
- Światło: czerwony neon MYJNIA 24H (#ff4040) na froncie wiaty, zwrócony na zachód; czerwona lampa podwórka (394; −30, #ff6a6a) nad kurierem. Czerwień znaczy tu zagrożenie (§4). Od strony Lubartowskiej pastorały ulicy, od Ratusza jego iluminacja.
- Dźwięk: syk pary z kratki za podwórkiem (389,8; 1,45; −25, emiter `STEAM_VENTS`), brzęczenie neonu, deszcz na blasze wiaty; brak dźwięku samej myjni (pompy, szczotki, suszarka).
- Zapach: chemia do mycia, mokra guma, spaliny.
- Kontrast: automat płatniczy z czytnikiem wszczepów obok przerdzewiałych kontenerów.
- Ruch: para z kratki; poza tym nic. Auto w myjni stoi.

## Przeznaczenie
- M0: likwidacja kuriera (`eliminate_courier`); potem zlecenie `car_wash` (likwidacja, pula `ELIMINATION_SITE_IDS`, wariant pijaka idzie stąd do Koi) i grupa Hebi neutralna, dopóki gracz jej nie sprowokuje.
- Wejścia: od wschodu z Lubartowskiej przez parking ((441; −40) → (420; −30), droga pijaka w `contract-plans.ts`), od południa wzdłuż maszynowni od strony Ratusza, od północy z Bajkowskiego, gdzie teren opada (G-754).
- Osłony: duży kontener (406; −31,5, kryjówka na ciało), mały kontener (399; −30,5), skrzynia (392; −33), auto na parkingu (414,5; −31,5), auto w myjni (406,2; −38,5), słupki wiaty.
- Punkt widokowy: brak; teren opada ku Bajkowskiemu, więc od północy podwórko widać z dołu.

## Topografia
- Prawdziwe miejsce: parking w179269921 za Placem Łokietka, przy Lubartowskiej i Bajkowskiego. Teren ok. 195,0–195,6 m n.p.m. (y −0,8..−0,2), na północ opada.
- Zgodne: położenie parkingu, nawierzchnia, ulice dookoła; żaden budynek nie jest wycięty.
- Odstępstwa: myjnia to scena gry na parkingu (T-051, celowe; zamyka alejkę w1208186144 i zwęża chodnik w232464413); teren wyrównany padem x 388..422, z −41..−27 (T-003, celowe, G-754). Kurier (396; −26) i dwa punkty załogi zlecenia (399; −22), (391; −22) stoją już za północną krawędzią padu, na stoku.
- Pomiar `inBuilding` na siatce 2 m: podwórko nie ma ścian; od każdej strony jest otwarty parking. Najbliższe budynki: na południe od z −48 i na zachód od x 381.

## Inwentarz docelowy
Architektura:
- maszynownia (blok 6 × 4,6 × 9 m ze skórką `shop` bez szyldów) z drzwiami serwisowymi, kratką wentylacji i rurą pary (do zrobienia: Blender `tools/blender/rooms/car_wash.py`);
- wiata na dwóch słupkach i bramownica (dziś bloki `metal` i `glass`; do zrobienia: bramownica z ramą, szczotkami i dyszami, Blender);
- ogrodzenie z siatki albo rząd kontenerów od strony parkingu, które robią z rogu parkingu podwórko (do zrobienia, ruchome, bez muru, bo parking jest prawdziwy).
Duże obiekty:
- auto w myjni, auto zaparkowane (skórka `car`), dwa kontenery (skórka `dumpster`), skrzynia;
- automat płatniczy na słupku przy wjeździe (do zrobienia: model gry `ticket-machine` albo Blender);
- wąż ciśnieniowy na zwijaku, wiadra, kanister chemii (Blender).
Drobiazg w skupiskach:
- przy kurierze: niedopałki, puszki, kubek z kawą jeszcze ciepły, folia po kanapce (Blender, `car_wash.py`);
- przy kontenerach: worki, kartony, rozlany płyn (generator ADR-0096 `bags`, `boxes`, `litter`);
- pod bramownicą: piana i kałuża z tęczą oleju (Blender `rd-c-puddle` jest w zestawie wnętrz, do użycia na zewnątrz).

## Frakcja i zasady
Frakcja: ulica.
- §12 dług: podwórko bez ścian i bez progu. Dojście z Lubartowskiej idzie szerokim parkingiem, bez zwężenia przed celem; „podwórko” czyta się jak róg parkingu.
- §13 częściowo: neon i lampa mają źródło; czerwone światło dobrze znaczy zagrożenie przy kurierze. Brak światła drogi (zielonego albo jaśniejszego wejścia) od Lubartowskiej. 60-30-10 niemierzone.
- §14 dług: makro 6 brył, mezo prawie brak, mikro zero (w 12 m od (400; −30) nie ma ani jednego mebla ulicznego ani drobiazgu).
- §15 dług: myjnia bez mokrej posadzki, piany i kałuż, choć woda ma tu najlepsze źródło w mieście.
- §16 zgodne: ulica, prowizorka, beton i blacha, czerwony neon.
- §17 częściowo: para z kratki i neon ze źródła; myjnia bez dźwięku pomp i szczotek. Ruch: tylko para. Skala: auta i kontenery.

## Scenariusz

### Pierwszy kadr
Gracz wychodzi z Neon Koi, idzie deptakiem na wschód, przez Plac Łokietka i na północ Lubartowską. Przy (441; −40) skręca w parking na zachód: 25 m przed nim wiata z czerwonym MYJNIA 24H, auto pod bramownicą, za wiatą czerwona lampa nad dwiema sylwetkami przy kontenerach, a za nimi para z kratki. Wzrok ma iść na czerwoną lampę: tam stoi cel.

### Postacie i miejsca
- Kurier Hebi (`courier`, tag `hebi_courier`) przy (396; −26), twarzą na południe (yaw π), ku myjni; ochroniarz (`guard`) przy (392,5; −29,5) pod lampą, też na południe. Stoją od nowej gry do śmierci.
- Zlecenie `car_wash` (po M0): 2–4 Hebi przy (396; −26), (392,5; −29,5), (399; −22), (391; −22), twarzami ku (395; −39), czyli na wiatę. Ochroniarze wariantu (395; −24,8), (397,2; −26,6), sobowtór (393,5; −22,5), czujka (397; −32,5), zasadzka (395; −36), (393,5; −39,5), (399; −38) przy wiacie.
- Grupa terytorium `car-wash-yard` po śmierci kuriera: trzech Hebi w kręgu wokół (405; −25), palą, dzwonią i gadają na zmianę (`TERRITORY_ACTIVITIES`).
- Hina szuka robotycznego kota na Placu Łokietka (428; −99), 9:00–18:00 (`enc_s7_neko`); kot śpi „pod szczotkami myjni”.

### Przebieg
1. Zlecenie (`fixer.first_meeting`): „Kurier gangu Hebi siedzi w podwórku za myjnią, za Placem Łokietka, od strony Przystankowej. Ma ochronę”. Cel w HUD: „Zneutralizuj kuriera Hebi na podwórku za myjnią przy Placu Łokietka”.
2. Dojście i rozpoznanie: z parkingu widać obu; kurier patrzy na myjnię, bokiem do wejścia od Lubartowskiej. Napięcie: pierwsza walka w grze.
3. Likwidacja (`eliminate_courier`, flaga `killed:hebi_courier`): nagroda wspomnienie `combat_reflex` („ręce wiedzą, jak celować”). Ciało można schować w dużym kontenerze (ADR-0065).
4. Powrót do Koi (`report_back`): Kaito słyszał strzały „i ciszę po nich”; Hebi −15.
5. Po prologu: Hebi wracają na podwórko jako grupa neutralna. Zlecenie `car_wash` kieruje tu znowu; bark `hook_eliminate_1` („Szef co godzinę chodzi sam za myjnię”) pasuje właśnie do tego miejsca.

### Drogi
- Cicha: od Ratusza wzdłuż maszynowni (x 416) i za wiatą, pod osłoną auta w myjni, do dużego kontenera na 4 m od kuriera; obaj patrzą na myjnię, więc podejście od północy (od Bajkowskiego, pod górę stoku) wchodzi im za plecy.
- Głośna: z parkingu od wschodu, za autem zaparkowanym (414,5; −31,5); 20 m otwartej przestrzeni do celu.
- Ucieczka: Lubartowską na południe do Placu Łokietka i metra A (433; −107), na północ w dół ku Bajkowskiemu, na zachód parkingiem.
- Pułapki: zasadzka wariantu `ambush` stoi pod wiatą, czyli na cichej drodze od Ratusza.

### Pora i stan świata
- Noc: czerwona lampa i neon to jedyne światła podwórka; para widoczna w świetle lampy. Dzień: parking pełny, myjnia bez klientów (brak ruchu w scenie).
- Przed M0: kurier i ochroniarz, nic więcej. Po M0: dwa ciała (do streamingu), potem grupa Hebi (`dead:courier`); uraza Hebi w `shinsekai-7` z zabójstw rośnie, a o świcie spada (ADR-0091). Postawa Hebi w całym mieście po prologu ok. −19.
- Akt I: `echo_contract` może wypaść tutaj (`car_wash`).

### Wymagania wobec sceny
- Podwórko domknięte rzeczami, które mogą stać na parkingu (kontenery, siatka budowlana, dostawczak), z jednym ciasnym przejściem od Lubartowskiej (§12).
- Myjnia działa: szczotki i dysze bramownicy, mokra posadzka, piana, dźwięk pompy i suszarki, kot pod szczotkami (ink `enc_s7_neko`).
- Ślad „przed chwilą”: ciepły kubek i niedopałki przy kurierze, przesyłka w torbie przy jego nodze.
- Światło drogi od Lubartowskiej i drugie, słabsze, od Ratusza (dwie drogi, §9).
- Kurier i ochroniarz na poziomym gruncie padu albo pad poszerzony do z −22 (dziś stoją na stoku za krawędzią).

## Dług sceny
- Bramownica ze szczotkami, dyszami i suszarką (ink `enc_s7_neko`: „Pod szczotkami myjni leży srebrny kot”) i automat płatniczy: modele w nowym `tools/blender/rooms/car_wash.py`, rekwizyty w `packages/sim/src/content/district-car-wash.ts` (bloki zostają bryłami, rysunek `scenery`), klucze na końcu `ROOM_DETAIL_SHAPES` (`packages/core/src/world/room-detail.ts`).
- Mokra posadzka, piana i kałuże pod wiatą (`gloss`/`wet` w shaderze toon): `packages/sim/src/content/district-car-wash.ts` (rekwizyty `rd-c-puddle`) i `packages/engine/src/npr`.
- Drobiazg w skupiskach przy kurierze i przy kontenerach: `tools/blender/rooms/car_wash.py`, nowy `packages/sim/src/content/car-wash-detail.ts`.
- Domknięcie podwórka kontenerami albo siatką budowlaną z jednym przejściem od Lubartowskiej, bez zamykania grafu nawigacji (skan `walk-blocked`): `packages/sim/src/content/district-car-wash.ts`, przegląd `topography-curator` (T-051).
- Dźwięk myjni (pompa, szczotki, suszarka) jako emiter w maszynowni: `packages/engine/src/audio/spatial.ts` (dziś tylko para i neon).
- Światło drogi od Lubartowskiej (lampa nad przejściem, ciepła albo zielona): `packages/sim/src/content/district-car-wash.ts`.
- Kurier i ochroniarz za krawędzią padu: przesunąć ich na z ≤ −27 albo poszerzyć pad (T-003, G-754): `packages/sim/src/content/district-m0.ts` (`GANGER_SPAWNS`, zmiana złotego hasha) albo `packages/sim/src/content/lublin/sites.ts`.
- Sprzeczność ink i gry: Kaito mówi „od strony Przystankowej”, a droga z gry (pijak, dojście) idzie Lubartowską; ulicy Przystankowej nie ma w danych mapy Krakowskiego. Propozycja: w `packages/narrative/ink/{pl,en}/m0.ink` „od strony Lubartowskiej” albo potwierdzić Przystankową w OSM i dać jej nazwę na minimapie.
- Bark `hook_eliminate_1` („za myjnię”) pasuje tylko tutaj, a gra daje go na każdym miejscu likwidacji: wpis w kartach pozostałych miejsc, poprawka w `packages/narrative/ink/{pl,en}/hooks.ink` albo osobny bark na miejsce w `packages/sim/src/content/contract-hooks.ts`.
