# Podwórko za Neon Koi (`koi-podworko`)

Podwórze kamienic na południe od baru Neon Koi (kamienica OSM w66330644), środek sceny `KOI_BACK` (300; −132) w `district-m0.ts`, plac ok. x 272..318, z −104..−132. Miejsce zlecenia Kaito `koi_back` i skrytki `stash:s7-koi-back` za kontenerem baru. Scena według tej karty: `packages/sim/src/content/koi-back.ts` (rozstawienie), `tools/blender/rooms/koi_back.py` (modele), zaplecze baru w `interiors.ts` (23.11, ADR-0102 p. 5).

## Historia
Kamienice po południowej stronie Krakowskiego Przedmieścia mają od XIX wieku podwórza od tyłu: oficyny, komórki, trzepaki, później garaże i miejsca na śmietniki. Z deptaka wchodzi się do nich bramami i przerwami między domami.

W 2077 podwórze za Neon Koi jest zapleczem baru i całego kwartału: kontener Koi pod tylną ścianą, dostawy skrzynek od rana, kucharz na papierosie. Hebi zbierają się tu, kiedy chcą pogadać z dala od kamer deptaka; barman mówi, że sprząta po nich częściej niż po klientach (`koi_barman`), a ich tag z wężem jest na murze kamienicy obok. Ktoś z ludzi Hebi wsunął za kontener torbę z drobnymi, opatrunkiem i złomem i już po nią nie wrócił (`S7_STASHES`). Przed chwilą kucharz wypalił papierosa na odwróconej skrzynce przy drzwiach zaplecza, zostawił kubek kawy i wrócił do kuchni; worki ze śmieciami stoją przy kontenerze.

## Klimat
- Światło: trzy źródła w oprawach. Żółta lampa okrętowa pod blaszanym daszkiem nad drzwiami zaplecza (droga z baru, kontener i skrytka w jej kręgu), ciepła latarnia na murze w przejściu z deptaka (droga wejścia), zimna świetlówka na zachodniej ścianie oficyny (droga do wyjścia na południowy wschód). Czerwona dioda kamery nad kontenerem jako akcent bez światła. Okna parteru kamienicy Koi od podwórza świecą jak witryny banku (renderer rysuje witryny na wszystkich ścianach budynku z lokalem; patrz dług).
- Dźwięk: wyciąg kuchni Koi szumi na tylnej ścianie, rynna kapie do kałuży, skrzynka liczników brzęczy (emitery w modelach, słyszane w całości na podwórku i głucho z zaplecza). Deszcz i dalekie radio z deptaka. Dług: muzyka z baru stłumiona przez mur.
- Zapach: śmieci z kontenera, frytura z wyciągu kuchni, mokry beton.
- Kontrast: kable światłowodowe baru przypięte trytytkami do rynny i wprowadzone do puszki na ścianie, kamera z diodą nad kontenerem obok odwróconej skrzynki po piwie jako stołka.
- Ruch: para z wyciągu kuchni (cząsteczki `STEAM_VENTS`). Dług: kot przy kontenerze, kucharz przy drzwiach po północy.

## Przeznaczenie
- Zlecenie Kaito `koi_back` (likwidacja 2–4 Hebi, pula `ELIMINATION_SITE_IDS`, także krok `echo_contract` aktu I), wariant pijaka idzie stąd do lady przy Koi; skrytka za kontenerem.
- Wejścia (pomiar `inBuilding` co 2 m): przerwa między kamienicami z deptaka przy x ≈ 278–292 (z −88..−104), drzwi zaplecza Neon Koi (309,4; −109,8) z baru przez korytarz, wyjście na zachód przy x 270 (z −104..−108), pas na południowy zachód (x 270–280, dalej za z −140), wąskie przejście na południowy wschód przy x ≈ 316–320, z −138.
- Osłony: kontener baru (306,5; −112,8) i drugi kontener pod murem kamienicy na zachód (295,5; −108,6), oba mieszczą ciało (ADR-0065); skrzynki po piwie z kegiem pod tylną ścianą baru (313,8; −110,3), dzwon na szkło pod komórką na zachodzie (291,9; −113,3), skuter dostawczy w środku (300,9; −114,6).
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: podwórze za kamienicą w66330644 przy Krakowskim Przedmieściu, od strony Placu Wolności. Teren z NMT ok. 196,0–196,2 m n.p.m. (y 0,2..0,4), kontenery stoją na terenie pod swoim środkiem.
- Zgodne: obrysy budynków wokół podwórza, przejścia między nimi, teren. Rzeczy na ścianach stoją na liniach obrysów OSM (tylna ściana w66330644, mur kamienicy na zachód, ściana w przejściu, oficyna).
- Odstępstwa: T-339 (korytarz zaplecza Neon Koi wycięty z parteru kamienicy, drzwi w tylnej elewacji; celowe, do przeglądu kuratora). Pad pokoju Koi (T-280) kończy się na z −109, przed podwórzem; teren pod kamienicą wznosi się w korytarzu od podłogi baru do podwórka (−0,38..0,0), więc korytarz ma pochylnię 6% nad nim.

## Inwentarz docelowy
Architektura:
- tylna ściana kamienicy z drzwiami zaplecza Neon Koi i daszkiem (zrobione: drzwi obsługi `door:neon-koi-staff` z baru, korytarz `KOI_BACK_ROOM` w `interiors.ts` z pochylnią zamiast schodka, bo teren wznosi się do podwórka, drzwi `door:neon-koi-back`, daszek z lampą `rd-kb-canopy`, znak wyjścia `rd-w3h-exit` i goła żarówka `rd-w3b-bulb` w korytarzu);
- rynna, kanał wyciągu kuchni z wentylatorem, skrzynka liczników, kable (zrobione: Blender `rd-kb-downpipe`, `rd-kb-extract`, `rd-c-fusebox`);
- przybudówka albo komórka z blachy przy zachodnim wyjściu (do zrobienia: w danych OSM są dwie niskie komórki, (291,4; −115,9) i (318,3; −115,8), rysowane jako budynki mapy).
Duże obiekty:
- kontener Koi (skórka `dumpster`) i drugi kontener na papier (skórka `dumpster`, zrobione), dzwon na szkło (zrobione: Blender `rd-kb-glass-bin`; model gry `container` to kontener 20 stóp, nie pasuje);
- stos skrzynek po piwie z kegiem (zrobione: Blender `rd-kb-crates`); beczka na zużyty olej (do zrobienia: beczka `barrel` z paczki ADR-0096 jest w grze pasiastą beczką drogową, więc nie stoi);
- zaparkowany skuter dostawczy (zrobione: Blender `rd-kb-scooter`; `vehicle-props` ma tylko auta, skuter z `city-props` stoi tylko przy stojaku rowerowym).
Drobiazg w skupiskach:
- przy drzwiach zaplecza: popielniczka z puszki, niedopałki, odwrócona skrzynka jako stołek, kubek, paczka i zapalniczka (zrobione: Blender `rd-kb-smoke`), kałuża pod kapiącym daszkiem (`rd-c-puddle`);
- przy kontenerze: worki, pudło, kartony (zrobione: generator ADR-0096 `bags`, `boxes`, Blender `rd-c-cartons`), butelki przy dzwonie (`rd-c-bottles`), kałuża pod rynną (`rd-c-puddle`);
- na murze: tag Hebi z naklejkami i zdartym plakatem (zrobione: Blender `rd-kb-tag`), kamera z diodą nad kontenerem (`rd-kb-camera`).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: wejście z deptaka przerwą między domami szeroką na 12–14 m, bez bramy; podwórze nie ma ciasnego progu od deptaka. Od baru jest sekwencja ciasno i szeroko: drzwi obsługi przy końcu regału, korytarz zaplecza 1,3 m pod stropem 2,8 m z gołą żarówką i zielonym znakiem wyjścia, drzwi i otwarte podwórze. Dług: przewężenie przy wejściu z deptaka.
- §13 zgodne: trzy źródła w oprawach (lampa nad drzwiami, latarnia w przejściu, świetlówka na oficynie) i dioda kamery. 60-30-10 nocą (23:00, `pnpm shots:palette`): ujęcie z południowego wschodu na drzwi i kontenery baza 58,5%, światło 36,1%, akcenty 5,4% (przed: 69,2 / 24,3 / 6,5), zgodne. Ujęcie przed drzwiami POZA_DRZWI. Korytarz zaplecza POZA_KORYTARZ: ciemny odcinek przed podwórkiem, zgodnie z §12.
- §14 zgodne: makro 5 (dwa kontenery, skrzynki z kegiem, dzwon, skuter), mezo (wyciąg, rynna, liczniki, kamera, oprawy), mikro w dwóch skupiskach: kąt palacza przy drzwiach (5 rzeczy w jednym modelu, kałuża obok) i worki, pudło i kartony przy kontenerze baru (4 rzeczy w 1,2 m); luzem butelki przy dzwonie.
- §15 częściowo: kałuże pod rynną i przed drzwiami, mokry bruk w deszczu, szkło dzwonu i lampy, stal kegu i drzwi obok betonu, blachy daszka i rdzy pod latarnią. Witryny banku na tylnej ścianie świecą mocniej niż lampy podwórka (dług).
- §16 zgodne: ulica: blacha daszka, rdza, beton, plastikowe skrzynki, folia worków; ciepła żółć lamp i zimna świetlówka.
- §17 zgodne: dźwięk ze źródła (szum wyciągu kuchni, kapanie rynny, brzęczenie liczników na tylnej ścianie, słyszane w całości na podwórku i głucho z zaplecza); skala człowieka (drzwi 1,0 × 2,3 m, skrzynka 0,29 m jako stołek, skuter, kontenery 1,3 m, keg 0,6 m); ruch: para z wyciągu. Dług: kot, kucharz przy drzwiach.

## Scenariusz

### Pierwszy kadr
Gracz idzie z Neon Koi deptakiem na zachód, przy x ≈ 285 skręca na południe w przerwę między kamienicami. Pod murem po lewej świeci ciepła latarnia na wysięgniku. Po 15 m przerwa otwiera się w podwórze: po lewej pod murem drugi kontener, dalej tylna ściana kamienicy Koi z lampą pod daszkiem nad drzwiami zaplecza i kontenerem baru w jej świetle, przed nimi 2–4 sylwetki Hebi i skuter dostawczy, za nimi ciemność z zimną świetlówką oficyny. Szumi wyciąg kuchni, nad nim para.

### Postacie i miejsca
- Załoga zlecenia przy (303; −120), (297; −117,5), (305; −115), (299; −122), twarzami na południe ku (300; −132), czyli od baru w głąb podwórza. Ochroniarze wariantu (304,2; −120,8), (302; −118,8), sobowtór (296; −121), czujka blokady (300; −112) pod ścianą Koi, zasadzka (300; −110), (295; −127), (304; −134). Każdy punkt co najmniej 0,7 m od brył sceny (test `koi-back.test.ts`).
- Pijak (wariant `drinker`): idzie z (303; −120) przez (296; −112), (283; −108), przerwą na deptak (282; −88) i wzdłuż fasad do lady przy drzwiach Koi (316,5; −92,6), potem wraca. Trasa omija skuter i drugi kontener.
- Skrytka za kontenerem (305; −112,8): 30 €$, opatrunek, 3 złomu. Kładzie się, gdy Seki odejdzie od kliniki ponad 40 m. Leży w kręgu lampy nad drzwiami.
- Poza zleceniem podwórze jest puste (ślady: kubek i niedopałki kucharza, worki przy kontenerze, tag Hebi).

### Przebieg
1. Zlecenie u Kaito: „podwórko za barem Neon Koi”. Ironia miejsca: robota 25 m w linii prostej od lady, przy której się ją bierze, a teraz kilkanaście kroków przez zaplecze.
2. Rozpoznanie: haki zlecenia (`hook_eliminate_1`, `hook_eliminate_2`); przy wariancie pijaka cel sam przychodzi pod bar.
3. Likwidacja: ciało do kontenera (baru albo drugiego), torba ze skrytki za kontenerem baru.
4. Wypłata przy ladzie Koi (`contract_payday`); barman nie pyta.

### Drogi
- Cicha: załoga patrzy na południe, plecami do baru, więc są dwie drogi za ich plecy: przerwą z deptaka wzdłuż muru za drugim kontenerem, albo z baru przez zaplecze (drzwi obsługi przy końcu regału, korytarz, drzwi na podwórko); kontener baru i skrzynki kryją ostatnie metry.
- Głośna: z przerwy od deptaka przez środek podwórka; osłony po drodze: drugi kontener, skuter, kontener baru, skrzynki.
- Ucieczka: na zachód (x 270) albo pasem na południowy zachód; wąskim przejściem na południowy wschód (x ≈ 318, z −138) ku Placowi Wolności pod świetlówką oficyny; z powrotem przerwą na deptak albo drzwiami zaplecza do baru.
- Pułapki: zasadzka wariantu stoi przy ścianie Koi (300; −110) i przy obu wyjściach na południe, czyli na drodze z baru i na drogach ucieczki.

### Pora i stan świata
- Noc: lampa nad drzwiami, latarnia i świetlówka pokazują drzwi, wejście i wyjście; reszta podwórza w półmroku. Dzień: to samo podwórze w szarym świetle, bez ludzi.
- Przed zleceniem: pusto (poza skrytką i śladami). Po zleceniu: uraza Hebi w `shinsekai-7` rośnie (ADR-0091), ale podwórze nie jest terytorium, więc grupa tu nie wraca.

### Wymagania wobec sceny
- Drzwi zaplecza Neon Koi na podwórze: druga droga z baru, którą obiecuje karta pomieszczenia (zrobione).
- Co najmniej dwa źródła światła i jedno ciepłe światło drogi przy przerwie z deptaka (zrobione: lampa nad drzwiami, świetlówka, latarnia; okno klatki zastąpione świetlówką oficyny).
- Makro i mezo, które dają osłony na otwartym podwórzu: drugi kontener, skrzynki, skuter (zrobione).
- Skupiska drobiazgu przy drzwiach zaplecza i przy kontenerze; wentylator kuchni jako źródło dźwięku i ruchu (zrobione: szum i para).
- Przewężenie przy wejściu z deptaka (np. brama, siatka albo przybudówka), żeby podwórze było wnętrzem kwartału (§12): do zrobienia.

## Dług sceny
Zrobione 23.11 (gałąź `feat/scena-koi-podworko`): drzwi zaplecza z korytarzem (`interiors.ts`, `RoomCut.back` w `lublin/city.ts`, T-339), światła w oprawach, osłony, drobiazg w skupiskach, wyciąg i rynna z dźwiękiem, para z wyciągu (`koi-back.ts`, `tools/blender/rooms/koi_back.py`, `room-sound-map.ts`, `screen-fx.ts`), żarówka i znak wyjścia w korytarzu (`room-lights.ts`). Zostaje:
- Przewężenie przy wejściu z deptaka (brama w murze albo siatka z furtką między kamienicami przy x 279–292, z ≈ −100) bez zamykania grafu nawigacji i trasy pijaka (skan `walk-blocked`): `packages/sim/src/content/koi-back.ts`, przegląd `topography-curator` (w OSM i NMT przerwa jest otwarta, więc to odstępstwo z wierszem T).
- Witryny banku na tylnej ścianie kamienicy Koi świecą od podwórza jak od deptaka i zalewają kadr cyjanem: renderer rysuje witryny parteru na wszystkich ścianach budynku z lokalem (`shopfront`); propozycja: witryny tylko na ścianach od ulicy, tył kamienicy z oknami zaplecza (`shopfront` w `packages/engine/src/renderer/mapcity/facade-style.ts` i `facade-frame.ts`).
- Kot przy kontenerze i kucharz palący przy drzwiach po północy (ruch i życie, §17): postać z planem dnia (ADR-0091) w `packages/sim/src/content/district-m0.ts`.
- Muzyka z baru stłumiona przez mur na podwórku: emiter radia Yoru FM w szafie grającej (`room-sound-map.ts`, dług karty `neon-koi`).
- Przybudówka z blachy przy zachodnim wyjściu: dziś dwie komórki z OSM rysowane jako zwykłe budynki mapy; blacha i drzwi garażowe: `packages/engine/src/renderer/mapcity/`.
- Beczka na zużyty olej kuchni przy skrzynkach (model z Blendera, `tools/blender/rooms/koi_back.py`): beczka `barrel` z paczki ADR-0096 jest w grze pasiastą beczką drogową.
- Bark `hook_eliminate_1` mówi „za myjnię”, a tu jest podwórko za barem: `packages/narrative/ink/{pl,en}/hooks.ink` albo bark na miejsce w `packages/sim/src/content/contract-hooks.ts`.
- Przegląd kuratora topografii: korytarz zaplecza (T-339) i rozstawienie na ścianach z obrysów.
