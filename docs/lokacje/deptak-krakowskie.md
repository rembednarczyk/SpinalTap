# Deptak Krakowskiego Przedmieścia (`deptak-krakowskie`)

Odcinek deptaka między kliniką Mori (północna pierzeja, kamienica OSM w67499277) a barem Neon Koi (południowa pierzeja, w66330644), x ≈ 270..340, z ≈ −66..−104. Tu zaczyna się gra: Seki budzi się w klinice, wychodzi na deptak i przechodzi na drugą stronę do Kaito (ADR-0038, ADR-0045). Skrytka `stash:s7-pachinko` leży w ślepym końcu za blokiem PACHINKO. Stan gry na `1de4702`.

## Historia
Krakowskie Przedmieście wyrosło w średniowieczu za Bramą Krakowską, wzdłuż traktu na Kraków. W XIX wieku stało się główną ulicą Lublina z hotelami, bankami i kamienicami z witrynami, a w latach 90. XX wieku zamknięto je dla aut i wyłożono płytami jako deptak. Kamienice zostały te same, zmieniły się szyldy.

W 2077 deptak należy do ludzi, którzy pracują nocą. Parter kamienicy po północnej stronie wynajął doktor Mori na klinikę bez szyldu lekarskiego, tylko z neonem KLINIKA. Naprzeciwko Kaito trzyma bar Neon Koi, w którym od lat przyjmuje zlecenia. Między nimi stoją RAMEN, salon PACHINKO i apteka KUSURI. Hebi traktują deptak jak drogę przejazdową dla kurierów, a Kagami skupuje tu wspomnienia: punkt skupu jest za kliniką, bez szyldu, a kolejka ustawia się przed świtem (poeta Shiro, `enc_s7_poet`).

Ostatnie dni: wczoraj w nocy ratownicy wyciągnęli z wraku przy Placu Litewskim kobietę w cudzym chromie. Kaito przesiedział noc przy jej fotelu u Mori i zapłacił za łatanie (`mori.wake_up`, `koi_barman`). Babcia Ume widziała, jak ją wyciągali. Przed chwilą Ume zamiatała deptak przed kliniką, a para z włazu przed drzwiami kliniki niesie zapach przypalonego chromu.

## Klimat
- Światło: po północnej stronie bursztynowy RAMEN (#ffb000) i zielony PACHINKO (#39ff8a), nad drzwiami kliniki turkusowo-zielony KLINIKA (#39ffd0); po południowej różowy NEON KOI (#ff2e88) nad podwójnymi drzwiami i pionowy fioletowy KUSURI (#b46cff), który miga. Cztery lampy gry: zimne niebieskie (304; −76,4) i (326; −92,6), różowa (334; −80,2), ciepła (297; −90,4). Do tego pięć pastorałów z mebli ulicznych. Mokre płyty odbijają każdy neon.
- Dźwięk: brzęczenie neonów deptaka (`neonEmitters` w `engine/src/audio/spatial.ts`), syk pary z włazu (312; −83), radia z drzwi PACHINKO i NEON KOI (stacja Drift) i RAMEN (Tessen FM), deszcz, rano furgonetki dostawcze (T-016).
- Zapach: piwo ryżowe i przypalony chrom z Koi, bulion z RAMEN, spirytus z kliniki.
- Kontrast: klinika z monitorami za tysiące stoi w parterze kamienicy z odpadającym tynkiem; reklamy holo nad witrynami są nowsze niż kamienice.
- Ruch: tłum mieszkańców z pasów deptaka, Ume z miotłą od 6:30 do 23:00, pijany sarariman na płytach przy Koi przed świtem, Nobu przy PACHINKO wieczorem.

## Przeznaczenie
- Hub fabularny prologu i aktu I: klinika (Mori, implanty, rozmowy aktu I), Neon Koi (Kaito, zlecenia), Ume (wspomnienia, trop Rena w akcie II, trop Zamku w akcie III po zakończeniu `street`).
- Wejścia: drzwi kliniki (321,4; −73,6), drzwi Neon Koi (315; −92,9), deptak z zachodu od Placu Litewskiego i ze wschodu od Placu Łokietka, przerwa między kamienicami przy x ≈ 280–292 na podwórko za Koi.
- Osłony: ławki, donice i drzewa na osi deptaka, ogródek kawiarni, automat z napojami. Na deptaku nie ma walki z treści: Hebi go nie trzymają (najbliższe terytorium to podwórze za myjnią i zaułek przy Kapucyńskiej).
- Punkty widokowe: brak wysokich; oś deptaka prowadzi wzrok na wschód ku Bramie Krakowskiej (ok. 150 m) i na zachód ku Placowi Litewskiemu.

## Topografia
- Prawdziwe miejsce: Krakowskie Przedmieście, odcinek deptaka (OSM w177528393, `surface=paving_stones`, `motor_vehicle=no`) między Kapucyńską a Placem Łokietka. Teren z NMT ok. 195,2–195,6 m n.p.m. (y −0,7..−0,2).
- Zgodne: pierzeje, obrysy kamienic (IoU z LoD2 0,889 w komórce krakowskie-2-0), szerokość ulicy między fasadami, nawierzchnia.
- Odstępstwa: pady pokoi kliniki i Koi wyrównują teren do progu, do 0,68 m od NMT (T-280, celowe; pady bez `row`, G-432); dostawy na deptaku 6–11 (T-016, celowe); pas bruku węższy niż pierzeja, goły teren przy fasadach na odcinku 266..327 (G-081, do poprawy).

## Inwentarz docelowy
Architektura:
- fasady kamienic z mapy z witrynami i przejściem do kliniki i baru (mapa, `lublin/sites.ts` `ROOM_SITES`);
- markizy i daszki nad drzwiami kliniki i Koi (do zrobienia: Blender, nowy skrypt `tools/blender/rooms/deptak.py`);
- kable między kamienicami nad deptakiem, skrzynki przyłączy na fasadach (generator pionowego Lublina ADR-0051, dziś tylko w kanionach z ruchem).
Duże obiekty:
- pastorały, ławki, donice, drzewa, ogródek kawiarni, automat z napojami, bankomat (model gry, meble uliczne ADR-0047/ADR-0094);
- lada uliczna przy drzwiach Neon Koi, przy której pije nocny pijak ze zlecenia (`BAR_SPOT` (316,5; −92,6) w `contract-plans.ts`; do zrobienia: Blender, `rd-` model lady z dwoma stołkami);
- ławka przed PACHINKO, na której siedzi Nobu (`enc_s7_pachinko`; do zrobienia: model gry `bench`);
- drzwi bez szyldu punktu skupu Kagami za kliniką z kolejką (do zrobienia: drzwi z mapy i miejsca tłumu).
Drobiazg w skupiskach:
- przy drzwiach Koi: niedopałki, kapsle, podkładki, plastikowy kubek (generator ADR-0096, rola `litter`, dziś tylko na zapleczach restauracji);
- przy RAMEN: kartony, worek śmieci, skrzynka po kapuście (generator ADR-0096, `bags`, `boxes`);
- przy progu Ume: miotła, szufelka, wiadro (Blender, `deptak.py`);
- ulotki i naklejki na latarniach (model gry `sticker`, jest pięć).

## Frakcja i zasady
Frakcja: ulica, technika (klinika Mori).
- §12 zgodne: deptak ok. 21 m szerokości między fasadami (z −72,5 i −94) po wejściu z ciasnych drzwi kliniki (1,6 m) daje otwarcie. Próg ulica/wnętrze zmienia światło i strop (drzwi kliniki i baru). Dług: przerwa przy x ≈ 280–292 na podwórko za Koi jest szeroka jak plac, bez bramy ani zwężenia.
- §13 częściowo: każde światło ma źródło (neony na fasadach, lampy gry). Nawigacja: cel prologu (drzwi Koi) jest oznaczony tylko różowym neonem nad drzwiami, który jest akcentem, a nie światłem drogi; zielony PACHINKO myli barwę wejść z §4. Udziału 60-30-10 nie mierzono: zrzut nocny ze sceny `reference` (Neon Koi od deptaka) przez `pnpm shots:palette`.
- §14 częściowo: makro i mezo z mebli ulicznych (17 ławek, 11 drzew, 5 donic, automat), mikro tylko 5 naklejek i 5 rzeczy `clutter` w 45 m. Brak skupisk przy drzwiach baru i kliniki.
- §15 zgodne: mokre płyty z odbiciami neonów i lamp (`atmosphere.addReflection`), szkło witryn obok matowego tynku.
- §16 zgodne: ulica (neony, ciepły brudny żółty, prowizorka); klinika jako wtręt techniki.
- §17 zgodne: brzęczenie neonów, para z włazu, radia z drzwi lokali, wszystko ze źródła. Ruch: tłum, Ume, para, migający KUSURI. Skala: ławki, drzwi 2,6 m, latarnie.

## Scenariusz

### Pierwszy kadr
Seki wychodzi z kliniki drzwiami (321,4; −73,6) na południe. Wprost przed nią, 19 m dalej, różowy NEON KOI nad podwójnymi drzwiami baru, po prawej fioletowy KUSURI, który miga, między nimi para z włazu (312; −83) podświetlona zimną lampą (304; −76,4). Po lewej babcia Ume z miotłą (328,5; −76,8), zwrócona ku drzwiom kliniki. Słychać deszcz, brzęczenie neonów i radio z PACHINKO. Wzrok ma iść na drzwi Koi: to jedyne drzwi w kadrze z ludźmi w środku.

### Postacie i miejsca
- Mori w gabinecie kliniki przy monitorach (322,2; −63,3), cały dzień; Seki budzi się na fotelu (319,6; −64,9), twarzą na wschód.
- Ume na deptaku przed kliniką (328,5; −76,8), patrzy na zachód, od 6:30 do 23:00 zamiata i zagaduje (`sweep`, `talk`); od 23:00 śpi w swojej bramie (329,2; −73,4) przy kamienicy kliniki.
- Kaito przy ladzie Neon Koi (317; −99,8), twarzą do drzwi, cały dzień. Barman za ladą (315; −102,3), dwóch bywalców przy stolikach (309,4; −95,6) i (320,8; −97,7).
- Nobu na „ławce” przed PACHINKO (306; −77), 19:00–4:00, raz (`enc_s7_pachinko`).
- Sarariman śpiący na płytach przy Koi (328; −91), 1:00–6:00, raz (`enc_s7_salaryman`).
- Skrytka kuriera Hebi w ślepym końcu za blokiem PACHINKO (272,5; −67): 80 €$, 18 naboi 9 mm, chip. Kładzie się dopiero, gdy Seki odejdzie od kliniki ponad 40 m.

### Przebieg
1. Przebudzenie (`find_fixer`): Mori przy fotelu (`mori.wake_up`) mówi o trzech odłamkach szyby i pół metra cudzego kabla i odsyła do Neon Koi. Napięcie niskie, gracz uczy się chodzić.
2. Deptak: Ume (`ume`) zaczepia „Widziałam, jak cię wyciągali z tego auta” i mówi, że Kaito czeka w Koi. Wybór „Znałaś mnie wcześniej?” daje wspomnienie `street_runner` (dachy, chłopak od Hebi). Nagroda: pierwszy ślad przeszłości.
3. Neon Koi (`fixer.first_meeting`): Kaito nadaje imię Seki Senshi i daje robotę: kurier Hebi na podwórku za myjnią za Placem Łokietka. Flaga `met_fixer`. Gracz wychodzi z baru na wschód, deptakiem ku Placowi Łokietka.
4. Powrót (`report_back`): Kaito w Koi płaci 500 €$ (`fixer.payday`), Hebi −15, „Ktoś już pytał o kobietę z wraku”. Bywalec zna już Seki (`koi_regular`).
5. Akt I (`m3_echo`): kontrakt od Kaito (`echo_contract`), potem retrospekcja walizki, która kończy się „Stoisz na Krakowskim Przedmieściu, a ręka sama szuka kajdanek”; rozmowa z Mori o module (`ask_mori`), implant (`new_implant`), retrospekcja nocy wypadku przed kliniką („Stoisz przed kliniką Mori i trzymasz się framugi”), decyzja w klinice (`decide`, zakończenie `aya` albo `seki`).
6. Akt II: Ume mówi, gdzie śpi Ren (`ume.ren_trail`), a po zakończeniu `seki` robi to Mori (`mori.sold`). Kaito daje zlecenie na Rena (`fixer.ren_job`).
7. Akt III po zakończeniu `street`: Ume dzwoni pierwszy raz w życiu (`act3_opening.chips_vanish`), a na deptaku mówi o furgonetce Kagami, która pojechała Zamkową pod górę (`zrodlo_ume`). Flaga `castle_lead`.

### Drogi
- Cicha: wzdłuż północnej pierzei pod markizami, poza światłem lamp; na deptaku nikt na gracza nie poluje.
- Głośna: strzał na deptaku to świadkowie z tłumu i obława po heat (ADR-0029), bez grupy Hebi na miejscu.
- Ucieczka: drzwi kliniki i baru zamykają się za graczem (ADR-0038); przerwa przy x ≈ 280–292 na podwórko za Koi i dalej na południe; deptak na wschód do metra A na Placu Łokietka (433; −107), na zachód do metra Plac Litewski (74; 16,9).
- Pułapki: brak. Skrót: podwórko za Koi łączy deptak z Placem Wolności.

### Pora i stan świata
- Noc (20:00–5:00): neony i lampy niosą cały kadr, Nobu przy PACHINKO, sarariman nad ranem. Dzień (7:00–18:00): Ume zamiata, dostawczaki do 11:00 (T-016), światło dnia gasi neony do akcentów.
- Przed prologiem: Kaito w barze od początku (G-034), na deptaku tylko tłum i Ume. Po prologu: Hebi −19 w całym mieście, ale deptak nie jest ich terytorium, więc nic się tu nie zmienia; plotka o „kobiecie z wraku” wraca w `koi_regular` i w metrze.
- Po akcie I: Mori pyta o głowę (`after_aya`) albo trzyma fiolkę z modułem na półce (`after_seki`). Po akcie III: epilog wspomina Ume chodzącą od drzwi do drzwi.

### Wymagania wobec sceny
- Drzwi Koi czytelne jako cel z drzwi kliniki: ciepła lampa nad progiem baru albo zielony obrys progu (§4, §13). Dziś: tylko różowy neon.
- Ślad „ktoś wyszedł przed chwilą”: miotła i wiadro Ume przy jej bramie, niedopałki i kubek przy drzwiach Koi. Dziś: brak.
- Miejsca spotkań z ink: ławka przed PACHINKO dla Nobu, lada uliczna przy Koi dla nocnego pijaka. Dziś: obu brak.
- Punkt skupu Kagami za kliniką (Shiro) jako drzwi bez szyldu z kolejką przed świtem: łączy deptak z wątkiem archiwum. Dziś: brak.
- Bruk do fasad (G-081).

## Dług sceny
- Ciepła lampa nad drzwiami Neon Koi i jaśniejszy próg jako światło drogi prologu: `packages/sim/src/content/interiors.ts` (`signs()`, nowa `lamp` na końcu listy).
- Barwa neonu PACHINKO poza zielenią wejść (np. żółto-pomarańczowa) albo świadome odstępstwo od §4 w karcie: `packages/sim/src/content/district-m0.ts` (`deptak()`).
- Ławka przed PACHINKO przy (306; −77) dla `enc_s7_pachinko` (ink: „Na ławce przed PACHINKO”): `packages/sim/src/content/district-m0.ts` albo plan mebli `tools/osm-import` (gałąź `kp-deptak.bench`).
- Lada uliczna z dwoma stołkami przy `BAR_SPOT` (316,5; −92,6), przy której pije nocny pijak zlecenia (komentarz mówi o ladzie, której nie ma): model w `tools/blender/rooms/deptak.py`, rekwizyt `room-detail` w nowym `packages/sim/src/content/deptak-detail.ts`.
- Drobiazg w skupiskach przy drzwiach Koi, przy RAMEN i w bramie Ume (miotła, wiadro, niedopałki, kubek): `tools/blender/rooms/deptak.py` i `packages/sim/src/content/deptak-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES` w `packages/core/src/world/room-detail.ts`.
- Punkt skupu Kagami za kliniką: drzwi bez szyldu w podwórzu kamienicy w67499277 i 4–6 miejsc tłumu w kolejce od 4:00 do 6:00: `packages/sim/src/content/district-m0.ts`, `packages/sim/src/content/crowd.ts`.
- Bruk do fasad na odcinku 266..327 (G-081): `tools/osm-import`.
- Wiersz `row: "T-280"` przy padach pokoi (G-432): `packages/sim/src/content/lublin/sites.ts`.
- Zmierzyć 60-30-10 na zrzucie nocnym sceny `reference` (`pnpm shots:palette`) i wpisać w §13 tej karty.
