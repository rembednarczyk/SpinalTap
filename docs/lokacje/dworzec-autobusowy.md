# Dworzec Autobusowy i stragany (`dworzec-autobusowy`)

Dworzec Autobusowy na Podzamczu (OSM w66264171, środek (789,3; 396,1)) przy północnej stronie alei Tysiąclecia, x ≈ 735..905, z ≈ 365..420: budynek dworca, 17 stanowisk „Dworzec Główny PKS” pod zadaszeniem (x 810..900, z 385..394), rząd pawilonów przy alei (x 817..860), pawilon handlowy Nova (w66264174, (735,8; 405,5)) i parking między nimi. Tu jest wejście B metra Plac Zamkowy (754; 379) i grupa Hebi terytorium `bus-station` (rdzeń (801,4; 386,4), 3 członków, ADR-0091). Dzielnica `targ`, chunki `podzamcze-1-0` i `podzamcze-1-1`. Stan gry na `22b1808`.

## Historia
Dworzec PKS przy alei Tysiąclecia przez dziesięciolecia był bramą Lublina dla przyjezdnych z całego regionu: niski modernistyczny budynek z poczekalnią i kasami, zadaszone stanowiska, kioski, piekarnie i budki z kebabem dla czekających. Stoi na dawnym terenie żydowskiego Podzamcza, przy targowiskach Bazaru i Ruskiej.

W 2077 dworzec obsługuje autobusy nocne, na które przesiada się z metra (`metro.ink`: „Wyjście B: Dworzec Autobusowy, przesiadka na linie nocne”). Dworcowi Hebi trzymają parking i peron, sprzedają miejsca na stanowiskach i ochronę czekającym. Wieczorami między peronem a pawilonami wróży Kiku z pękniętej talii kart AR, która spadła z ciężarówki Kagami (`enc_targ_fortune`). Przed chwilą ktoś zostawił pod wiatą stanowiska 5 walizkę na kółkach i nie wrócił z kiosku.

## Klimat
- Światło: 7 latarni parkowych (wzdłuż peronu (806,3; 381,5), (836,8; 380,5), (866,6; 377,1), (896,4; 373,6) i przy dworcu (781,4; 371,9), (783,9; 420), (800; 415,6)). Neony dworca czerwone (#ff4040: KEBAB CHŁODNY DZBAN, KAWA W PĘDZIE, SZCZĘŚLIWY TRAF), Novy zielony, czerwony i bursztynowy (APTEKA DOKTOR MAŁY #39ff8a, ZAKUPY NA NOWIU, PIEKARNIA SĄSIEDZKA), pawilony przy alei bursztynowe i cyjanowe. Żadnego światła gry; tablica odjazdów nie świeci.
- Dźwięk: w zamyśle silniki autobusów na stanowiskach, zapowiedzi z głośnika, ruch alei za plecami. W grze słychać tylko auta alei.
- Zapach: olej napędowy, kebab, kawa z automatu, mokry beton peronu.
- Kontrast: holo-tablica odjazdów nad połamanymi ławkami poczekalni; czekający z wszczepem na kredyt obok babci z koszykiem jajek.
- Ruch: chunk `podzamcze-1-1` jest bez tłumu: przy dworcu stoją 2 postacie z mebli i 3 Hebi. Autobusów w grze nie ma (pojazdy to auta, furgonetki i trolejbusy, `VEHICLE_SIZE` w `core/ports/types.ts`).

## Przeznaczenie
- Wyjście B metra (`targ` B, pawilon (754; 379), otwór na południe ku alei, T-159) i teren Hebi (`bus-station`). Przesiadka fabularna na linie nocne bez autobusów w grze.
- Spotkanie `targ_fortune` (745; 376) przy pawilonie metra, 18:00–2:00. Miejsce przestępstwa w toku (786; 438) za dworcem (`MICRO_SPOTS`).
- Wejścia: aleja Tysiąclecia od południa, Nowy Plac Targowy i parking od zachodu (Nova), stanowiska od wschodu, Nadstawna od północy.
- Osłony: wiaty i zadaszenie peronu (dziś tylko podłoga, G-063), pawilony przy alei, pawilon metra, budynek dworca. Peron jest długi i odsłonięty od parkingu.
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: Dworzec Autobusowy w66264171, peron pod zadaszeniem w458862470, pawilony w458298766…w458298774, Nova w66264174, parking w175995587. Teren z NMT ok. 174,9–176,4 m n.p.m. (y −20,9..−19,4), płaski.
- Zgodne: obrysy dworca, pawilonów i Novy, stanowiska z OSM.
- Odstępstwa: pawilon metra B na parkingu (T-159, celowe, ADR-0071); zadaszenie peronu pominięte (G-063); goły teren peronu i placu przy stanowiskach (T-170, T-185, T-164); kiosk z ogródkiem bez bryły (T-193); zaplecze Novy gołe (T-169).

## Inwentarz docelowy
Architektura:
- zadaszenie peronu na słupach z rynnami i świetlówkami, wysepki stanowisk z krawężnikami (do zrobienia: G-063, generator w `packages/engine/src/renderer/mapcity`);
- poczekalnia dworca z witrynami i drzwiami (mapa, drzwi fasad T-109);
- pawilon metra B (`metro-pavilion.ts`).
Duże obiekty:
- autobusy nocne na stanowiskach (model do zrobienia: nowy `VehicleModel` przez zmianę kontraktu w `core/ports`, ADR);
- holo-tablica odjazdów nad peronem, ławki i wiaty na wysepkach, automat z kawą, kiosk (Blender `tools/blender/rooms/dworzec.py`, model gry `vending-machine`, `bus-shelter`);
- stragany dworcowe przy pawilonach (model gry `market-stall`, dziś jedna budka `food-stall`).
Drobiazg w skupiskach:
- pod wiatami: bilety, kubki, niedopałki, walizka (Blender `dworzec.py`, generator ADR-0096 `litter`);
- przy grupie Hebi na peronie: puszki, kartony, tag Hebi na słupie (model gry `graffiti`);
- przy stoliku Kiku: talia kart AR, świeczka LED, puszka na datki (Blender).

## Frakcja i zasady
Frakcja: ulica.
- §12 częściowo: wąskie przejście między pawilonami przy alei a dworcem prowadzi na długi peron, ale bez zadaszenia nie ma ciasnego stropu ani otwarcia; peron i parking to jedna płaska płyta.
- §13 dług: 7 latarni parkowych na całe 170 m; tablica odjazdów, wiaty i stanowiska bez światła; wejście do metra bez zielonego światła. 60-30-10 niemierzone (zrzut nocny z alei na dworzec).
- §14 dług: makro i mezo prawie brak (1 budka, 1 automat, 1 bankomat, 2 postacie), mikro 3 rzeczy `clutter` i 6 graffiti; peron jest pusty.
- §15 dług: mokry beton bez szkła wiat, bez blachy zadaszenia, bez lakieru autobusów.
- §16 częściowo: miejsce ulicy (Hebi, kebab, lotto), ale bez prowizorki, która by to pokazywała.
- §17 dług: silników, zapowiedzi i gwaru nie ma. Ruch: 3 Hebi, auta alei; skala: drzwi dworca, pawilon metra.

## Scenariusz tła
- Kto tu bywa: podróżni z metra (wyjście B) czekający na linie nocne; trzech Dworcowych Hebi z terytorium `bus-station`, którzy sprzedają miejsca na stanowiskach i ochronę; sprzedawcy z pawilonów przy alei; wieczorem wróżka Kiku przy pawilonie metra (`enc_targ_fortune`).
- Co się dzieje: w dzień pawilony z pieczywem i kebabem obsługują czekających; po zmroku ruch przenosi się na peron, Hebi chodzą wzdłuż stanowisk, a między peronem a pawilonami Kiku stawia karty z pękniętej talii AR.
- Ślad obecności: walizka na kółkach pod wiatą stanowiska 5, kubki po kawie i bilety na ławkach peronu, zielone światło nad wyjściem B metra.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/dworzec-detail.ts`, `tools/blender/rooms/dworzec.py`, test `packages/sim/test/dworzec-scene.test.ts`): stolik wróżki Kiku przy pawilonie metra B w miejscu jej spotkania; reklama Fumiko w `radio.ink` poprawiona w #955. Zostaje:
- Zadaszenie peronu ze świetlówkami (zimne, migające) i wysepki stanowisk (G-063, T-170): `tools/osm-import` (zadaszenia `building=roof`) i `packages/engine/src/renderer/mapcity`, lampy gry pod zadaszeniem w nowym `packages/sim/src/content/district-targ.ts`.
- Autobusy nocne na 3–4 stanowiskach, stojące i odjeżdżające w nocy: nowy model pojazdu (zmiana `VehicleModel` w `packages/core/src/ports/types.ts`, ADR architekta) i rozkład w `packages/sim/src/content/traffic.ts`.
- Holo-tablica odjazdów, ławki i wiaty na wysepkach, skupiska drobiazgu: nowy `tools/blender/rooms/dworzec.py` (jest już stolik Kiku), `packages/sim/src/content/dworzec-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES`; potrzebne położenie stanowisk z OSM (G-063).
- Tłum czekających na peronie i w poczekalni (chunk `podzamcze-1-1` bez tłumu): `packages/sim/src/content/crowd.ts` (miejsca na końcu `CROWD_SPOTS`).
- Emitery silników, zapowiedzi i automatu z kawą: `packages/engine/src/audio/spatial.ts`.
- Sprzeczność ADR i gry: ADR-0091 i `TERRITORIES` (`packages/core/src/world/territories.ts`: „The stalls by the bus station”) stawiają grupę przy straganach dworca, a najbliższy stragan jest 91 m od rdzenia (801,4; 386,4). Propozycja: 4–6 straganów dworcowych przy pawilonach alei (x 810..860, z 375..380) w planie mebli `tools/osm-import` albo w `district-targ.ts`, przegląd `topography-curator`.
- Sprzeczność ink i gry: `enc_targ_fortune` („Między straganami siedzi kobieta”) stoi 37 m od najbliższego straganu Bazaru; przy straganach dworcowych z punktu wyżej zdanie się zgadza bez zmiany ink.
- Zmierzyć 60-30-10 nocą z alei na dworzec i wpisać w §13 tej karty.
