# Zaułek Panasa i Podwale (`zaulek-panasa`)

Zaułek Władysława Panasa na Starym Mieście, schody i ścieżka wzdłuż murów miejskich od Grodzkiej i Placu po Farze w dół ku Podwalu, x ≈ 695..740, z ≈ 55..120. Na tarasie przy ogródku piwnym (w232362965, `amenity=biergarten`, (708,1; 100,7), T-269) stoi grupa Hebi terytorium `panasa-lane` (rdzeń (715; 100), 2 członków, ADR-0091). Na północy, 40 m dalej, Brama Grodzka (714,2; 141,3) i Villa Merlini (707,1; 119,8); na południu taras Placu po Farze (karta `plac-po-farze`). Dzielnica `kanal`, chunk `stare-miasto-1-1`. Stan gry na `22b1808`.

## Historia
Zaułek biegnie pod murami obronnymi miasta, w miejscu dawnej fosy i podnóża skarpy, którą od średniowiecza schodziło się ze Starego Miasta na żydowskie Podzamcze. Nosi imię Władysława Panasa, historyka literatury z Lublina, który pisał o mieście, jego Żydach i Brunonie Schulzu i był związany z Bramą Grodzką–Teatrem NN. Podwale, ulica pod murami, prowadzi dookoła wzgórza staromiejskiego.

W 2077 zaułek jest kuchennymi schodami Starego Miasta: tędy schodzi się z Grodzkiej na Podwale i dalej na Plac Zamkowy, omijając bramę i kładkę. Hebi trzymają tu ogródek pod murami i mają z niego widok na całe zejście; to drugie stanowisko Starego Miasta obok handlu pod kładką (`grodzka-bridge`, rdzeń (650; 70), ok. 70 m na zachód). Przed chwilą ktoś zostawił na murku pod latarnią kufel z pianą i telefon z pękniętym ekranem, który dzwoni.

## Klimat
- Światło: 2 latarnie parkowe ((709; 73,6), (737,9; 83,1)), 2 pastorały ((722,9; 62,2), (721,8; 92,9)), jedna latarenka ścienna (693,1; 115,9). Bursztynowy neon OGRÓDEK POD MURAMI (#ffb000) nad ogródkiem. Żadnego światła gry. Niżej, przy Podwalu, ciemno: mury i drzewa zasłaniają latarnie Grodzkiej.
- Dźwięk: gwar ogródka, kroki po kamiennych schodach, z daleka ruch na Podwalu i alei. Źródeł w grze brak.
- Zapach: piwo i dym z ogródka, mokry kamień murów, liście.
- Kontrast: średniowieczne mury z holo-tablicą trasy turystycznej obok ogródka, gdzie Hebi płacą za piwo cudzymi kartami.
- Ruch: tłum Starego Miasta (`stare-miasto-1-1`, profil `street`, 0,8), 2 Hebi.

## Przeznaczenie
- Teren Hebi (`panasa-lane`), zejście ze Starego Miasta na Podwale i Plac Zamkowy obok Bramy Grodzkiej, droga ucieczki spod kładki.
- Miejsce przestępstwa w toku `kanal` (744; 48) na Podwalu, 55 m na południowy wschód (`MICRO_SPOTS`).
- Wejścia: z Placu po Farze i Grodzkiej od góry (schody), z Podwala od dołu, ścieżką od Bramy Grodzkiej.
- Osłony: mury miejskie i oporowe (T-251), 74 słupki, 10 drzew, ogródek z ławami; stromy teren daje osłonę z góry.
- Punkt widokowy: górny bieg schodów na Podzamcze i Zamek.

## Topografia
- Prawdziwe miejsce: Zaułek Władysława Panasa (`footway` i `steps`), Podwale, mury miejskie przy Podwalu (701..716; 61..113). Teren z NMT ok. 175,3–192,3 m n.p.m. (y −20,5..−3,5): 17 m spadku na ok. 60 m, rdzeń na y −14,7 (181,1 m).
- Zgodne: przebieg zaułka i schodów, ogródek i Villa Merlini z OSM, mury jako bariery z OSM (T-251).
- Odstępstwa: budynki zaułka na skarpie z wysokością z domyślnych kondygnacji (T-269); chodnik i mur oporowy Podwala pod Archikatedrą przesunięte (T-259, G-649) to dalszy odcinek tej samej ulicy.

## Inwentarz docelowy
Architektura:
- kamienne schody ze spocznikami i poręczą, mury miejskie z blankami, mury oporowe (mapa, bariery ADR-0077);
- taras ogródka z drewnianą podłogą nad skarpą (do zrobienia: Blender `tools/blender/rooms/zaulek_panasa.py`);
- tablica trasy turystycznej z holo-warstwą na murze (Blender, ten sam plik).
Duże obiekty:
- ławy i stoły ogródka pod parasolem, beczki piwne, lodówka (model gry `cafe-garden`, Blender);
- latarnie, kosze, szafka uliczna (model gry, meble uliczne);
- skuter dostawczy Hebi przy Podwalu (model gry `vehicle-props`).
Drobiazg w skupiskach:
- na stole ogródka: kufle, popielniczka, karty płatnicze, telefon (Blender `zaulek_panasa.py`);
- na spocznikach schodów: puszki, niedopałki, kapsle (generator ADR-0096 `litter`);
- na murze przy Podwalu: tag Hebi i plakaty (model gry `graffiti`).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: wąskie schody pod murami prowadzą w dół i otwierają się na Podwale i panoramę Podzamcza; to prawdziwa kompresja skarpy. Próg: zmiana nawierzchni z bruku Grodzkiej na kamienne stopnie.
- §13 częściowo: lampy z oprawami i bursztynowy neon ogródka (handel). Nawigacja: dolny bieg schodów i Podwale ciemne, brak światła drogi w dół. 60-30-10 niemierzone (zrzut nocny z górnego biegu w dół).
- §14 dług: makro i mezo z mebli (ogródek, 74 słupki, 10 drzew), mikro zero; przy grupie i na schodach brak drobiazgu.
- §15 częściowo: mokry kamień schodów i murów; brak szkła kufli i połysku stołów ogródka.
- §16 zgodne: ulica w średniowiecznej oprawie, ciepły bursztyn neonu.
- §17 dług: ogródek bez gwaru ze źródła. Ruch: tłum, 2 Hebi; skala: schody, poręcze, ławy.

## Dług sceny
- Taras ogródka z ławami, beczkami i parasolem, skupiska na stole i spocznikach: modele w nowym `tools/blender/rooms/zaulek_panasa.py`, rekwizyty w nowym `packages/sim/src/content/panasa-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES` w `packages/core/src/world/room-detail.ts`.
- Lampa nad dolnym biegiem schodów przy Podwalu (światło drogi) i ciepła lampa nad stołem Hebi: lampy gry w `packages/sim/src/content/district-kanal.ts` (na końcu `KANAL_PROPS`).
- Emiter gwaru ogródka (wieczór i noc): `packages/engine/src/audio/spatial.ts`.
- Grupa siedzi przy ogródku jak goście, nie na ścieżce: miejsca siedzące przy ławach ogródka zamiast pierścienia w `packages/sim/src/content/territory-groups.ts` (pierścień 1,4 m wokół rdzenia, `memberAt`) albo czynność „pije” w planach `TERRITORY_ACTIVITIES`.
- Holo-tablica trasy turystycznej na murze (tekst świata, ADR-0056: nazwa własna bez tłumaczenia): Blender i rekwizyt jak wyżej.
