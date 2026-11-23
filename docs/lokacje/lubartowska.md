# Lubartowska przy rondzie (`lubartowska`)

Lubartowska na Podzamczu przy skrzyżowaniu z aleją Tysiąclecia i aleją Solidarności, x ≈ 540..610, z ≈ 300..400. Na chodniku przy skrzyżowaniu stoi grupa Hebi terytorium `lubartowska` (rdzeń (569,9; 347,1), 2 członków, ADR-0091), 26 m od Kościoła Ewangelicznego Zgromadzenia Bożego (r6476361, wejście (592,2; 333,3)). Pod ulicą biegnie linia metra z Bramy Krakowskiej na Plac Zamkowy (`METRO_TUNNEL`, (550; 281) → (585; 362)). Na południe Lubartowska wspina się ku Staremu Miastu i Alchemii (karta `alchemia-deptak`), na wschód aleja prowadzi pod Zamek (karta `aleja-tysiaclecia`). Dzielnica `targ`, chunki `podzamcze-0-0` i `podzamcze-0-1`. Stan gry na `22b1808`.

## Historia
Lubartowska, droga z Lublina do Lubartowa, była przed wojną główną ulicą północnej części żydowskiego miasta: kamienice ze sklepami, domy modlitwy, szkoły, a na jej północnym końcu uczelnia rabinacka Jeszywas Chachmej Lublin. Po zagładzie i wojnie dzielnicę przecięły szerokie aleje, a skrzyżowanie z aleją Tysiąclecia i Solidarności stało się jednym z najruchliwszych węzłów miasta.

W 2077 to skrzyżowanie jest wjazdem na Podzamcze od strony Śródmieścia i ostatnim miejscem, gdzie Hebi stoją przed aleją: dwóch obserwuje światła i auta, które skręcają na Podzamcze, i daje znać grupom przy halach i dworcu. Oyaji mówi o nocnym mieście: „Śpi cały targ, tylko Lubartowska nie śpi” (`day-cycle.ink`). Przed chwilą ktoś zostawił przy słupie sygnalizacji torbę z zakupami ze Społem i poszedł na drugą stronę alei.

## Klimat
- Światło: 15 latarni drogowych przy jezdniach (m.in. (545,2; 364,9), (568,3; 360,7), (576; 359,2), (609,9; 368,3)), 2 parkowe przy kościele ((587,2; 346,4), (611,7; 333,9)), dwie sygnalizacje. Neonów w obrysie brak: 12 budynków bez lokali z szyldem. Żadnego światła gry.
- Dźwięk: auta na trzech ulicach, trolejbusy Lubartowskiej (3 słupy trakcji), sygnał przejść. Inne źródła brak.
- Zapach: spaliny, mokry asfalt, farba z graffiti.
- Kontrast: sześciopasmowe aleje z kamerami obok małego kościoła zboru; 23 naklejki i 20 graffiti na fasadach i słupach.
- Ruch: auta i trolejbusy, 2 Hebi, jedna postać z mebli; tłumu brak (`podzamcze-0-0` i `podzamcze-0-1` bez tłumu).

## Przeznaczenie
- Teren Hebi (`lubartowska`) i węzeł: Lubartowską ze Starego Miasta i Alchemii na Podzamcze, aleją pod Zamek i do Dworca. Ulica tła bez zleceń i spotkań.
- Wejścia: Lubartowska z południa i północy, aleja Tysiąclecia od wschodu, aleja Solidarności od zachodu, przejścia z sygnalizacją.
- Osłony: tylko latarnie, szafki, słupy, 6 drzew, 2 automaty; skrzyżowanie jest otwarte i ruchliwe. Ucieczka: w Lubartowską ku Staremu Miastu albo aleją na wschód.
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: Lubartowska (`tertiary` i `residential`), aleja Tysiąclecia, aleja Solidarności (`primary`), Kościół Ewangeliczny r6476361. Teren z NMT ok. 174,8–176,7 m n.p.m. (y −21..−19,1), płasko w dolinie.
- Zgodne: przebieg ulic i jezdni z OSM, budynki w obrysach.
- Odstępstwa: goły teren w komórce `podzamcze-0-0` przy Lubartowskiej i alei (T-273, 10 945 m²); latarnia reguły `lit` przy (531,5; 398,9) w klinie łącznicy (T-304).
- Nazwa: w danych OSM tego prostokąta nie ma ronda; skrzyżowanie jest skrzyżowaniem z sygnalizacją (2 sygnalizatory w meblach). Najbliższe rondo z nazwą, Dmowskiego, leży na wschodnim końcu alei (x ≈ 1080). Nazwa lokacji pochodzi z komentarza `TERRITORIES` („Lubartowska by the roundabout”).

## Inwentarz docelowy
Architektura:
- jezdnie z przejściami, wysepki, barierki (mapa);
- fasady kamienic z witrynami i rolety na parterze (mapa, drzwi fasad T-109);
- sieć trolejbusowa nad Lubartowską (generator `trolley-pole`).
Duże obiekty:
- przystanek z wiatą i holo-rozkładem (model gry `bus-shelter`, do sprawdzenia z OSM);
- automaty, szafki, latarnie z kamerami ANPR (model gry, meble uliczne; kamery: Blender `tools/blender/rooms/lubartowska.py`);
- kiosk nocny 24H przy skrzyżowaniu (model gry `kiosk`).
Drobiazg w skupiskach:
- przy grupie Hebi: niedopałki, puszki energetyków, tag Hebi na szafce (model gry `graffiti`, generator ADR-0096 `litter`);
- przy przejściu: ulotki, torba z zakupami (Blender `lubartowska.py`);
- przy automatach: kubki, opakowania (generator `litter`).

## Frakcja i zasady
Frakcja: ulica, korporacja (skrzyżowanie alei miasta).
- §12 dług: skrzyżowanie jest szerokie z każdej strony; brak ciasnego odcinka przed nim. Lubartowska od Starego Miasta mogłaby być progiem, jeśli kamienice dojdą do jezdni (mapa jest zgodna z rzeczywistością, więc to tylko ocena, nie zmiana).
- §13 dług: tylko latarnie drogowe i sygnalizacja; grupa Hebi stoi w świetle jak każdy przechodzień, a fasady są ciemne (bez lokali). 60-30-10 niemierzone.
- §14 częściowo: mezo z mebli (latarnie, szafki, 2 automaty), mikro 23 naklejki i 20 graffiti; skupisk przy grupie brak.
- §15 częściowo: mokry asfalt z odbiciami świateł aut; brak szkła i połysku przy fasadach.
- §16 częściowo: ulica na skraju korporacyjnej alei, ale miejsce nie ma żadnego znaku, że jest Hebi.
- §17 częściowo: ruch aut i trolejbusów słychać ze źródła; nic poza tym. Ruch: auta, 2 Hebi; skala: latarnie, sygnalizatory, drzwi.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/lubartowska-detail.ts`, test `packages/sim/test/lubartowska-scene.test.ts`): kiosk całodobowy (model gry `kiosk`, bryła w puli ulicy) przy kamienicy obok grupy Hebi, drobiazg z modeli ADR-0096 wokół grupy. Zostaje:
- Sprzeczność ADR i gry: ADR-0091 §1 stawia terytoria bez kościołów, a rdzeń (569,9; 347,1) leży 26 m od wejścia do Kościoła Ewangelicznego Zgromadzenia Bożego (miejsca przestępstw w toku mają co najmniej 50 m, `street-crime-board.test.ts`). Propozycja: rdzeń na zachodni chodnik Lubartowskiej, co najmniej 50 m od kościoła, np. ok. (552; 380), i ta sama kontrola odległości od kościołów w teście terytoriów: `packages/sim/src/content/territory-groups.ts`, przegląd `topography-curator`.
- Nazwa w komentarzu `TERRITORIES` („by the roundabout”, `packages/core/src/world/territories.ts`) i w rejestrze lokacji (`tools/rooms/src/locations.ts`): „przy skrzyżowaniu z aleją Tysiąclecia” zamiast „przy rondzie” (zmiana komentarza w `core` przez architekta, nazwa w rejestrze w `tools`).
- Neony na parterze kamienic przy skrzyżowaniu (lokale z OSM albo `venues` importu): `tools/osm-import` (venues), przegląd `topography-curator`.
- Tłum na chodnikach Lubartowskiej (chunk `podzamcze-0-0` bez tłumu): `packages/sim/src/content/crowd.ts`.
