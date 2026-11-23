# Zaułek przy Kapucyńskiej (`zaulek-kapucynska`)

Kapucyńska na Krakowskim Przedmieściu, krótka ulica od deptaka (wylot przy wraku z karty `plac-litewski`, (152,6; −51)) na południe, x ≈ 135..180, z ≈ −55..−175. Na chodniku przed bankiem (Millennium, (159; −138,7)) stoi grupa Hebi terytorium `kapucynska-alley` (rdzeń (153,1; −132), 2 członków, ADR-0091). Na zachód od ulicy dom towarowy Pedet (w67508935, (124,1; −128,1), T-073), na rogu z deptakiem Pijalnia Czekolady Wedla (152,8; −61,2). Dzielnica `shinsekai-7`, chunk `krakowskie-1-0`. Stan gry na `22b1808`.

## Historia
Ulica wzięła nazwę od kapucynów, których kościół pw. świętych Piotra i Pawła z XVIII wieku stoi kilkadziesiąt metrów na zachód, przy Krakowskim Przedmieściu. Kapucyńska była zawsze boczną, handlową uliczką śródmieścia: kamienice z kawiarniami i sklepami, hotel, banki, a od strony deptaka tablica Andrzeja Struga, pisarza urodzonego w Lublinie.

W 2077 Kapucyńska to tylne wyjście deptaka: tu kończy się światło festiwali i reklam, a zaczyna ulica, na której Hebi pilnują bankomatu i kantoru. Przy wylocie ulicy, na deptaku, auto Seki skończyło na dachu w noc wypadku i do dziś tam leży (karta `plac-litewski`, `recall_last_call`). Ucieczka po zleceniu przy wraku w stronę Kapucyńskiej to ucieczka w ręce Hebi (karta `plac-litewski`, „Drogi”). Przed chwilą ktoś z Ookii Ramen wystawił na chodnik worek z odpadkami i nie zamknął drzwi zaplecza.

## Klimat
- Światło: 4 latarnie drogowe po zachodniej stronie ((145,3; −63,1), (148,3; −93), (137,4; −120,7), (144,5; −138,6)), 2 pastorały przy deptaku, zimna lampa gry przy wraku (160; −48, #9ad7ff) u wylotu. Neony lokali: cyjanowe (ZASIĘG TELEFONY, SALON SOCZEWKI, ZIELONY CZAROWNIK), bursztynowe (BISTRO W KOSZYKU, WIELKA MISKA), różowe (LODY NA BOSAKA, BANK MILOWE KAMIENIE #ff2e88), czerwony SALON KAKAO. Przy rdzeniu Hebi najjaśniejszy jest różowy szyld banku.
- Dźwięk: gwar deptaka od północy, ramen i bistro, dzwonek drzwi sklepu z telefonami. Źródeł w grze brak.
- Zapach: czekolada od Wedla, bulion z Ookii Ramen, zioła z Green Djinn, worki z odpadkami.
- Kontrast: pijalnia czekolady i salon optyczny obok sklepu z konopiami i Hebi pod bankiem; holo-reklama kredytu nad bankomatem, przy którym dwóch chłopaków liczy cudze pieniądze.
- Ruch: tłum deptaka (`krakowskie-1-0`, profil `evening`, pełny od 17:00), 2 postacie z mebli, auta na odcinku z ruchem (Kapucyńska `residential`).

## Przeznaczenie
- Teren Hebi (`kapucynska-alley`) na skraju Krakowskiego; droga ucieczki od wraku na południe; skrót z deptaka do Peowiaków i Narutowicza.
- Wejścia: z deptaka od północy (wylot przy wraku), od południa z dalszej Kapucyńskiej; z zachodu przejście obok Pedetu i skwer Witkowskiego.
- Osłony: 59 słupków, 13 drzew, automat, stacja roweru miejskiego, 2 ławki; wnęki drzwi kamienic (8 drzwi z mebli).
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: Kapucyńska (część `pedestrian` od deptaka, dalej `residential`), kamienice w67504387…w67504413, Pedet w67508935, Klasztor Kapucynów r5420680 (52,6; −84,6). Teren z NMT ok. 194,9–197,0 m n.p.m. (y −0,9..1,2), płaski.
- Zgodne: przebieg ulicy, obrysy kamienic i Pedetu (T-073), lokale i banki z OSM.
- Odstępstwa: pas między jezdnią a chodnikiem przy (149; −128) (T-247); wirydarz kapucynów wypełniony bryłą (T-042, G-079); proceduralna wieża kościoła kapucynów (T-121).
- Nazwa: w Lublinie przy Kapucyńskiej nie ma zaułka, a rdzeń stoi na chodniku samej ulicy. „Zaułek” to nazwa z ADR-0091 („zaułek przy Kapucyńskiej lub Karmelickiej”).

## Inwentarz docelowy
Architektura:
- kostka chodników i jezdni, krawężniki, słupki (mapa, meble);
- bramy przejazdowe do podwórek kamienic z kratami (do zrobienia: przejścia `PASSAGES` w `lublin/gate-passages.ts`, jeśli są w OSM);
- witryny i drzwi lokali (mapa, drzwi fasad T-109).
Duże obiekty:
- bankomat i kantor z holo-reklamą kredytu przy rdzeniu Hebi (model gry `atm`; holo: Blender `tools/blender/rooms/kapucynska.py`);
- kontenery na odpadki przy zapleczu Ookii Ramen i bistro (model gry `dumpster`);
- ławki, automat, stojaki, stacja roweru miejskiego (model gry, meble uliczne).
Drobiazg w skupiskach:
- przy grupie Hebi: niedopałki, puszki, paragony z bankomatu, tag Hebi na słupie (generator ADR-0096 `litter`, model gry `graffiti`);
- przy zapleczu ramen: worki, skrzynki, kałuża z kuchni (generator `boxes`, `rd-c-puddle`);
- przy wylocie ku wrakowi: szkło z wypadku, ślady opon (karta `plac-litewski`, `tools/blender/rooms/plac_litewski.py`).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: wąska Kapucyńska jest ciasnym progiem między szerokim deptakiem a Placem Litewskim; z drugiej strony otwiera się na Peowiaków. Dług: brak podwórka albo bramy, które dałyby prawdziwy zaułek.
- §13 częściowo: lampy i neony mają źródła; różowy szyld banku nad grupą działa jak akcent, ale nie jako znak zagrożenia (czerwień z §4). 60-30-10 niemierzone (zrzut nocny z deptaka na południe).
- §14 częściowo: makro i mezo z mebli (59 słupków, 13 drzew, automat), mikro 8 rzeczy `clutter`, 3 naklejki, 2 graffiti; przy grupie zero drobiazgu.
- §15 częściowo: mokra kostka, szkło witryn; brak kałuż z kuchni i połysku bankomatu.
- §16 częściowo: ulica, ale czysta jak deptak; brudu i prowizorki tylnej uliczki brak.
- §17 dług: gwar deptaka słychać jako tło, ale lokale i bankomat nie mają źródła dźwięku. Ruch: tłum i auta; skala: drzwi, ławki, słupki.

## Scenariusz tła
- Kto tu bywa: goście kawiarni i hotelu; kucharze Ookii Ramen na zapleczu; ludzie wychodzący z deptaka na Peowiaków i Narutowicza; Hebi z terytorium `kapucynska-alley`, którzy pilnują bankomatu i kantoru.
- Co się dzieje: w dzień uliczka jest skrótem z deptaka i kolejką do kantoru; wieczorem światło festiwali zostaje za plecami, Hebi stoją przy bankomacie, a przechodnie wracają na deptak obok wraku auta Seki przy wylocie.
- Ślad obecności: worek z odpadkami z Ookii Ramen i uchylone drzwi zaplecza, paragony z bankomatu na chodniku, rower miejski zostawiony w poprzek stacji.

## Dług sceny
- Sprzeczność ADR i gry: ADR-0091 i nazwa terytorium mówią o zaułku, a rdzeń (153,1; −132) stoi na chodniku Kapucyńskiej pod bankiem. Propozycja: grupa w bramie przejazdowej kamienicy w67504413 albo w podwórku za nią, jeśli OSM ma przejście (wtedy zaułek jest prawdziwy), w `packages/sim/src/content/territory-groups.ts` i `packages/sim/src/content/lublin/gate-passages.ts`; bez przejścia nazwa „Kapucyńska pod bankiem” w `tools/rooms/src/locations.ts` i komentarzu `TERRITORIES`. Przegląd `topography-curator`.
- Kontenery na odpadki i worki przy zapleczu Ookii Ramen (153,3; −111,6), skupiska przy grupie: rekwizyty w `packages/sim/src/content/district-m0.ts` (na końcu `DISTRICT_M0_PROPS`) albo nowy `packages/sim/src/content/kapucynska-detail.ts`, modele w nowym `tools/blender/rooms/kapucynska.py`.
- Czerwona lampa albo goła żarówka nad bramą przy grupie (zagrożenie, §4): lampa gry w `district-m0.ts`.
- Emiter gwaru lokali i kuchni ramen: `packages/engine/src/audio/spatial.ts` (lista spoza `DISTRICT_M0_PROPS` albo neon z etykietą `RAMEN`, który już daje radio w `radio-speakers.ts`).
- Zmierzyć 60-30-10 nocą z deptaka w głąb Kapucyńskiej i wpisać w §13 tej karty.
