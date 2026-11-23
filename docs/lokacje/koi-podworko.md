# Podwórko za Neon Koi (`koi-podworko`)

Podwórze kamienic na południe od baru Neon Koi (kamienica OSM w66330644), środek sceny `KOI_BACK` (300; −132) w `district-m0.ts`, plac ok. x 272..318, z −104..−132. Miejsce zlecenia Kaito `koi_back` i skrytki `stash:s7-koi-back` za kontenerem baru. Stan gry na `1de4702`.

## Historia
Kamienice po południowej stronie Krakowskiego Przedmieścia mają od XIX wieku podwórza od tyłu: oficyny, komórki, trzepaki, później garaże i miejsca na śmietniki. Z deptaka wchodzi się do nich bramami i przerwami między domami.

W 2077 podwórze za Neon Koi jest zapleczem baru i całego kwartału: kontener Koi pod tylną ścianą, dostawy skrzynek od rana, kucharz na papierosie. Hebi zbierają się tu, kiedy chcą pogadać z dala od kamer deptaka; barman mówi, że sprząta po nich częściej niż po klientach (`koi_barman`). Ktoś z ludzi Hebi wsunął za kontener torbę z drobnymi, opatrunkiem i złomem i już po nią nie wrócił (`S7_STASHES`). Przed chwilą kucharz wystawił worek ze śmieciami i zostawił uchylone drzwi zaplecza (drzwi do zrobienia, patrz dług).

## Klimat
- Światło: dziś żadne. Podwórze nie ma lampy, okna kamienic nie świecą na grunt, neon Koi jest po drugiej stronie budynku. Docelowo: żółta żarówka nad drzwiami zaplecza, niebieskawy blask okien klatek, czerwona dioda kamery nad kontenerem.
- Dźwięk: dziś tylko deszcz i dalekie radio z deptaka. Docelowo: wentylator kuchni Koi na ścianie, kapanie z rynny do kałuży, muzyka z baru stłumiona przez mur.
- Zapach: śmieci z kontenera, frytura z wyciągu kuchni, mokry beton.
- Kontrast: kable światłowodowe baru przypięte trytytkami do rynny.
- Ruch: brak; docelowo para z wyciągu, kot przy kontenerze, kucharz przy drzwiach po północy.

## Przeznaczenie
- Zlecenie Kaito `koi_back` (likwidacja 2–4 Hebi, pula `ELIMINATION_SITE_IDS`, także krok `echo_contract` aktu I), wariant pijaka idzie stąd do lady przy Koi; skrytka za kontenerem.
- Wejścia (pomiar `inBuilding` co 2 m): przerwa między kamienicami z deptaka przy x ≈ 278–292 (z −88..−104), wyjście na zachód przy x 270 (z −104..−108), pas na południowy zachód (x 270–280, dalej za z −140), wąskie przejście na południowy wschód przy x ≈ 316–320, z −138.
- Osłony: tylko kontener (306,5; −112,8), który mieści też ciało (ADR-0065). Reszta podwórza jest pusta.
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: podwórze za kamienicą w66330644 przy Krakowskim Przedmieściu, od strony Placu Wolności. Teren z NMT ok. 196,0–196,2 m n.p.m. (y 0,2..0,4), kontener stoi na terenie pod swoim środkiem (`standing`).
- Zgodne: obrysy budynków wokół podwórza, przejścia między nimi, teren.
- Odstępstwa: brak wpisu T. Pad pokoju Koi (T-280) kończy się na z −109, przed podwórzem.

## Inwentarz docelowy
Architektura:
- tylna ściana kamienicy z drzwiami zaplecza Neon Koi, daszkiem i schodkiem (do zrobienia: drzwi w `interiors.ts`, korytarz zaplecza przez 4–6 m bryły za ścianą baru);
- rynny, kanał wyciągu kuchni z wentylatorem, skrzynki liczników, kable (Blender, nowy `tools/blender/rooms/koi_back.py`);
- przybudówka albo komórka z blachy przy zachodnim wyjściu (do zrobienia, z obrysów OSM, jeśli są w danych).
Duże obiekty:
- kontener Koi (skórka `dumpster`, jest), drugi kontener na segregację i pojemnik na butelki (model gry `container`);
- stos skrzynek po piwie i beczki (generator ADR-0096 `barrel`, `boxes`);
- zaparkowany skuter dostawczy (do zrobienia: pojazd z `vehicle-props`).
Drobiazg w skupiskach:
- przy drzwiach zaplecza: popielniczka z puszki, niedopałki, odwrócona skrzynka jako stołek, kubek (Blender, `koi_back.py`);
- przy kontenerze: worki, rozdarty karton, butelki, kałuża (generator ADR-0096 `bags`, `litter`, Blender `rd-c-puddle`);
- na murze: tag Hebi, naklejki (model gry `graffiti`, `sticker`).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: wejście z deptaka przerwą między domami szeroką na 12–14 m, bez bramy; podwórze nie ma ciasnego progu, choć jest wnętrzem kwartału. Próg (zmiana światła z deptaka na ciemność) jest, ale przypadkowy.
- §13 dług: zero źródeł światła; kadr nocą to sama baza bez światła głównego i akcentów. Cel (załoga przy kontenerze) i wyjścia niewidoczne.
- §14 dług: jedna bryła (kontener), zero mebli ulicznych i drobiazgu w 18 m. Najpustsze miejsce zlecenia w grze.
- §15 dług: brak mokrych powierzchni, rynien i kałuż.
- §16 częściowo: ulica, ale dziś bez materiałów (beton, blacha, rdza) poza bryłami kamienic.
- §17 dług: brak dźwięku ze źródła, brak ruchu, brak przedmiotów skali (drzwi, schodek, skrzynka).

## Scenariusz

### Pierwszy kadr
Gracz idzie z Neon Koi deptakiem na zachód, przy x ≈ 285 skręca na południe w przerwę między kamienicami. Po 15 m przerwa otwiera się w podwórze: po lewej tylna ściana kamienicy Koi z kontenerem, przed nim 2–4 sylwetki Hebi, za nimi ciemność. Docelowo wzrok ma iść na żółtą żarówkę nad drzwiami zaplecza Koi i na kontener w jej świetle.

### Postacie i miejsca
- Załoga zlecenia przy (303; −120), (297; −117,5), (305; −115), (299; −122), twarzami na południe ku (300; −132), czyli od baru w głąb podwórza. Ochroniarze wariantu (304,2; −120,8), (302; −118,8), sobowtór (296; −121), czujka blokady (300; −112) pod ścianą Koi, zasadzka (300; −110), (295; −127), (304; −134).
- Pijak (wariant `drinker`): idzie z (303; −120) przez (296; −112), (283; −108), przerwą na deptak (282; −88) i wzdłuż fasad do lady przy drzwiach Koi (316,5; −92,6), potem wraca.
- Skrytka za kontenerem (305; −112,8): 30 €$, opatrunek, 3 złomu. Kładzie się, gdy Seki odejdzie od kliniki ponad 40 m.
- Poza zleceniem podwórze jest puste.

### Przebieg
1. Zlecenie u Kaito: „podwórko za barem Neon Koi”. Ironia miejsca: robota 25 m w linii prostej od lady, przy której się ją bierze.
2. Rozpoznanie: haki zlecenia (`hook_eliminate_1`, `hook_eliminate_2`); przy wariancie pijaka cel sam przychodzi pod bar.
3. Likwidacja: ciało do kontenera, torba ze skrytki za nim.
4. Wypłata przy ladzie Koi (`contract_payday`); barman nie pyta.

### Drogi
- Cicha: załoga patrzy na południe, plecami do przerwy z deptaka, więc wejście od północy wchodzi im za plecy; kontener kryje ostatnie 6 m. Docelowo: drzwi zaplecza Koi jako druga cicha droga prosto z baru.
- Głośna: z przerwy od deptaka, 10–15 m otwartego gruntu bez osłon.
- Ucieczka: na zachód (x 270) albo pasem na południowy zachód; wąskim przejściem na południowy wschód (x ≈ 318, z −138) ku Placowi Wolności; z powrotem przerwą na deptak.
- Pułapki: zasadzka wariantu stoi przy ścianie Koi (300; −110) i przy obu wyjściach na południe, czyli na drodze z baru i na drogach ucieczki.

### Pora i stan świata
- Noc: dziś całkowita ciemność, więc zlecenie nocą gra się na ślepo. Dzień: to samo podwórze w szarym świetle, bez ludzi.
- Przed zleceniem: pusto (poza skrytką). Po zleceniu: uraza Hebi w `shinsekai-7` rośnie (ADR-0091), ale podwórze nie jest terytorium, więc grupa tu nie wraca.

### Wymagania wobec sceny
- Drzwi zaplecza Neon Koi na podwórze: druga droga z baru, którą obiecuje karta pomieszczenia („Drugie wyjście przez zaplecze na podwórze”).
- Co najmniej dwa źródła światła (żarówka nad drzwiami, okno klatki) i jedno ciepłe światło drogi przy przerwie z deptaka.
- Makro i mezo, które dają osłony na otwartym podwórzu: drugi kontener, skrzynki, skuter.
- Skupiska drobiazgu przy drzwiach zaplecza i przy kontenerze; wentylator kuchni jako źródło dźwięku i ruchu.
- Przewężenie przy wejściu z deptaka (np. brama, siatka albo przybudówka), żeby podwórze było wnętrzem kwartału (§12).

## Dług sceny
- Drzwi zaplecza Neon Koi na podwórze z korytarzem przez bryłę kamienicy (z −104..−110): `packages/sim/src/content/interiors.ts` (druga `DoorDef` w `S7_DOORS`, węzły `S7_NAV`), wycięcie w `packages/sim/src/content/lublin/sites.ts` (`KOI_SITE`); sprzeczność karty `docs/pomieszczenia/neon-koi.md` (obiecuje wyjście) z grą (tylna ściana pełna).
- Żarówka nad drzwiami zaplecza, światło okna klatki i ciepła lampa przy przerwie z deptaka: `packages/sim/src/content/district-m0.ts` (grupa `KOI_BACK`, nowe `lamp` na końcu `DISTRICT_M0_PROPS`).
- Drugi kontener, skrzynki, beczki i skuter jako osłony (bryły na końcu listy): `packages/sim/src/content/district-m0.ts` (`standing(KOI_BACK, …)`).
- Drobiazg w skupiskach i wentylator kuchni: nowy `tools/blender/rooms/koi_back.py`, nowy `packages/sim/src/content/koi-back-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES`.
- Dźwięk wentylatora kuchni i kapania z rynny: `packages/engine/src/audio/spatial.ts` (emitery poza neonami deptaka).
- Przewężenie przy wejściu z deptaka bez zamykania grafu nawigacji (skan `walk-blocked`, droga pijaka): `packages/sim/src/content/district-m0.ts`, przegląd `topography-curator`.
- Bark `hook_eliminate_1` mówi „za myjnię”, a tu jest podwórko za barem: `packages/narrative/ink/{pl,en}/hooks.ink` albo bark na miejsce w `packages/sim/src/content/contract-hooks.ts`.
- Zmierzyć 60-30-10 po dodaniu światła (dziś kadr nocny bez źródeł).
