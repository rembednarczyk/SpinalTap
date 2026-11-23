# Grodzka pod krytą kładką i Brama Grodzka (`grodzka-kladka`)

Grodzka od Rynku w dół do Bramy Grodzkiej (OSM w232362876, środek (714,2; 141,3)), z krytą kładką nad ulicą między hotelem przy Grodzkiej 20 a domem „Pod Akacją” (środek ok. (659; 76), `KANAL_SCENERY` w `district-kanal.ts`, ADR-0048). Pod kładką handlują Hebi: zlecenie Kaito `kanal_bridge` i terytorium `grodzka-bridge` (ADR-0091). Za bramą Zamkowa prowadzi na Zamek, więc tędy idzie droga aktu III. Stan gry na `1de4702`.

## Historia
Grodzka to jedna z najstarszych ulic Lublina, droga z Rynku do grodu na wzgórzu zamkowym, od którego ma nazwę. Kończy ją Brama Grodzka, zwana też Żydowską: przez wieki dzieliła chrześcijańskie Stare Miasto od miasta żydowskiego na Podzamczu. W 1785 roku Dominik Merlini przebudował ją w stylu klasycystycznym (data MDCCLXXXV jest w szczycie od Grodzkiej). Miasto żydowskie pod bramą Niemcy zniszczyli w czasie wojny. Dziś w bramie i domach obok działa Ośrodek „Brama Grodzka – Teatr NN”, który przechowuje pamięć tamtego Lublina, a przy bramie stoi Latarnia Pamięci.

W 2077 Grodzka jest najkrótszą drogą ze Starego Miasta na Podzamcze i do autobusów Tessen pod bramą, więc tędy chodzą ludzie z pieniędzmi w kieszeni. Hebi stoją pod krytą kładką, gdzie okna kamienic nie patrzą na bruk, liczą przechodniom portfele i handlują chipami „Hebi z Hebi, chipy za gotówkę” (`tetsu`). Kaito płaci za tych, którzy tam handlują (`hideo`). Nowy rekrut Koji ćwiczy pod kładką groźby na przechodniach (`enc_kanal_recruit`). Przed chwilą ktoś przewrócił skrzynkę przy krawężniku i zostawił na niej niedopałek; Hebi trzymają w niej to, czego nie chcą nosić przy sobie.

## Klimat
- Światło: ciepła lampa gry pod kładką (652; 70, #ffcf8a), latarenki ścienne na fasadach (8 w 40 m), pastorały przy bramie; okna kładki świecą nocą jak okna pierwszego piętra (ADR-0048). Brama Grodzka w oszczędnej warstwie 2077: ciepłe linie na gzymsach, oprawy przy obu wylotach, kamera od Grodzkiej, bez neonów (T-085).
- Dźwięk: kroki i rozmowy Hebi pod kładką (pogłos pod podsufitką), deszcz z rynien kładki, dalekie radio z Rynku. Brak emitera pod kładką i w bramie.
- Zapach: mokry kamień, papierosy, frytura z ogródków na Grodzkiej.
- Kontrast: przedwojenna kładka z dachówką i oknami nad grupą z wszczepami i chipami za tysiące.
- Ruch: Hideo dwa razy dziennie, nocny patrol Grodzkiej, tłum Starego Miasta, Koji wieczorem.

## Przeznaczenie
- Zlecenie `kanal_bridge` (likwidacja 2–4 Hebi, piąte miejsce w puli Kaito), terytorium `grodzka-bridge` (3 Hebi, cały dzień), posterunek patrolu `hebi-grodzka`; przejście na Podzamcze i Zamek przez bramę.
- Wejścia: Grodzka z Rynku (od (577; −23)), Plac po Farze z boku (687; 35), uliczki boczne, brama od strony Zamkowej (727,3; 153,7).
- Osłony: dwie skrzynki pod kładką (655,5; 76,5, kryjówka na ciało) i (663; 71,5), wnęki drzwi kamienic, stojak na rowery, drzewa przy Placu po Farze.
- Punkty widokowe: Plac po Farze z tarasem na Zamek i Podzamcze (poza tą kartą); z kładki nie, bo jest tylko rysunkiem.

## Topografia
- Prawdziwe miejsce: Grodzka (OSM, `surface=sett`) i Brama Grodzka w232362876. Teren opada od Rynku (ok. 196 m n.p.m.) do ok. 189,9–190,7 m n.p.m. pod kładką (y −5,9..−5,1) i dalej ku bramie.
- Zgodne: przebieg i szerokość Grodzkiej między pierzejami, brama z przepisem zabytku (ADR-0062 etap 2), przejście bramy w osi obu frontów (T-082, G-136), kartusz i data w szczycie (T-083).
- Odstępstwa: kryta kładka jest dodana przez grę (`KANAL_SCENERY`), a nie wzięta z OSM, i nie ma wpisu w `docs/topografia.md`; kurator ma ustalić, czy to odstępstwo celowe (wpis T), czy zgłoszenie. Front od Zamku z gzymsem zamiast daszku (T-084, celowe), warstwa 2077 bramy (T-085, celowe), brak attyki z wazami (G-137), Grodzka 36a przy bramie z nadbudową wyższą od bramy (T-011, G-050), bruk węższy niż pierzeja na odcinku 663..679 (G-081), Sztukmistrz na linie (617; 26) nie ma w grze (G-166).

## Inwentarz docelowy
Architektura:
- kryta kładka z oknami, gzymsem i dachówką (mapa, jest; podsufitka z belkami, lampą i rynną do zrobienia: Blender `tools/blender/rooms/grodzka.py`);
- Brama Grodzka z przepisem (jest), sklepienie przejazdu z oświetleniem (do zrobienia, ADR-0048 „Do dopracowania”);
- szyldy na wysięgnikach, latarenki ścienne (mapa, ADR-0048).
Duże obiekty:
- skrzynki i kontener pod kładką (bloki, są), stół z rozkładanych skrzynek, na którym Hebi pokazują chipy (do zrobienia, Blender);
- Latarnia Pamięci przy bramie, jedyna latarnia bez neonu (model do zrobienia, plan ulic `grodzka.latarnia-pamieci`);
- Sztukmistrz z Lublina na linie nad ulicą (G-166);
- wiata przystanku autobusu Tessen pod bramą, na Zamkowej (730; 155) (model gry `bus-shelter`).
Drobiazg w skupiskach:
- pod kładką: niedopałki, puszki energetyka, pudełko po chipach, rozbity holo-portfel, tag Hebi na murze (Blender `grodzka.py`, model gry `graffiti`);
- przy wnękach drzwi: ulotki, worki (generator ADR-0096);
- przy przystanku: bilety, kubki z automatu (generator ADR-0096 `litter`).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: wąska Grodzka zamknięta nad głową kładką (4,6 m prześwitu), potem przejście bramy (3,4 × 4,2 m) i otwarcie na Zamkową i dolinę Podzamcza: najlepsza w grze sekwencja ciasno i szeroko, wzięta z prawdziwego miasta.
- §13 częściowo: ciepła lampa pod kładką i latarenki mają źródła; nocą okna kładki dają ciepły pas nad grupą. Brak światła w sklepieniu bramy (ADR-0048) i światła drogi w stronę Zamku. 60-30-10 niemierzone.
- §14 częściowo: makro to dwie skrzynki, mezo z mebli (stojak, drzewa), mikro 6 rzeczy `clutter` w 40 m; przy grupie Hebi nic.
- §15 częściowo: mokry bruk; brak rynien i kapania z kładki, deszcz pada w przejściu bramy (ADR-0048).
- §16 zgodne: ulica w zabytkowej oprawie; Brama Grodzka bez neonów jako granica pamięci.
- §17 dług: brak dźwięku ze źródła pod kładką i w bramie (pogłos, kapanie). Ruch: Hideo, patrol, grupa terytorium (palą, dzwonią, gadają). Skala: drzwi kamienic, stojak.

## Scenariusz

### Pierwszy kadr
Gracz schodzi z Rynku Grodzką na północny wschód, w dół. Po ok. 120 m ulica skręca i nad nią pojawia się kryta kładka z oknami, pod nią ciepła lampa i trzech Hebi w kręgu, za nimi skrzynki przy krawężnikach. Za kładką Grodzka opada dalej do jasnej, beżowej Bramy Grodzkiej. Wzrok ma iść pod kładkę: tylko tam jest światło na wysokości ludzi.

### Postacie i miejsca
- Grupa terytorium `grodzka-bridge`: trzech Hebi w kręgu o promieniu 1,4 m wokół (650; 70), twarzami do środka, cały dzień, na zmianę palą, dzwonią, gadają.
- Posterunek patrolu `hebi-grodzka` przy ścianie (653,6; 80,7), za dnia pilnuje i pali; od 21:00 do 5:00 chodzi Grodzką do stóp bramy (697; 126), wraca pod kładkę, idzie do Rynku (573; −28) i z powrotem.
- Załoga zlecenia `kanal_bridge`: (659,5; 74,5), (656,5; 71,5), (662; 77,5), (657,5; 76), twarzami do siebie (bez punktu patrzenia). Ochroniarze wariantu (660,5; 75,5), (658; 73,5), sobowtór (664; 79,5), czujka blokady (650; 63), zasadzka (646; 58), (668; 84), (652; 66).
- Hideo idzie Grodzką o 7:30 do przystanku Tessen pod bramą (730; 155) i wraca od 17:00 (`GRODZKA_WALK`); środek ulicy prowadzi go dokładnie pod kładką, przez grupę Hebi.
- Koji pod kładką (652; 64), 16:00–23:00, raz (`enc_kanal_recruit`).

### Przebieg
1. Trop: Hideo („pod kładką, na Grodzkiej, stoją Hebi i liczą ludziom portfele”) albo Tetsu („Pod kładką znowu handlują”). Zlecenie u Kaito: „pod kładką na Grodzkiej”.
2. Rozpoznanie: haki zlecenia (`hook_eliminate_1`, `hook_eliminate_2`); grupa terytorium stoi 6–10 m od załogi, więc gracz musi zdecydować, czy pierwszy strzał nie rozpęta walki z całą ulicą.
3. Likwidacja: strzał prowokuje Hebi w dzielnicy `kanal` (uraza +5 za prowokację, +20 za zabitego); grupa i posterunek przestają tolerować gracza. Ciało do skrzynki przy posterunku.
4. Wypłata w Neon Koi.
5. Akt III: przejście przez bramę i Zamkową pod górę na Zamek. Ume mówi, że furgonetka z ludźmi z archiwum „pojechała Zamkową pod górę” (`zrodlo_ume`).

### Drogi
- Cicha: wzdłuż pierzei, od wnęki do wnęki, z dala od lampy; podejście od strony bramy (z dołu) albo z Placu po Farze. Załoga stoi twarzami do siebie, więc każdy kierunek widzi jeden z nich.
- Głośna: z góry Grodzkiej, z ok. 25 m, osłonami są tylko wnęki drzwi i skrzynki. Walka obejmuje zwykle grupę terytorium i posterunek (do 8 Hebi naraz).
- Ucieczka: w dół przez Bramę Grodzką na Zamkową i Plac Zamkowy (metro A (722; 286)); w bok na Plac po Farze i schodami ku Podwalu; w górę na Rynek (teren patroli).
- Pułapki: zasadzka wariantu stoi w górze Grodzkiej (646; 58) i (652; 66), czyli na drodze z Rynku, i w dole (668; 84), na drodze do bramy.

### Pora i stan świata
- Noc: okna kładki i lampa pod nią, patrol Grodzkiej w ruchu, handel chipami (Tetsu). Dzień: grupa stoi, posterunek pali, Hideo przechodzi rano i wieczorem, Koji od 16:00.
- Przed zleceniem: Hebi tolerują neutralnego gracza i obserwują go. Po zleceniu: uraza w `kanal`, o świcie spada o 20 (ADR-0091).
- Akt III: brama to próg ze Starego Miasta (Hebi) na wzgórze Kagami; Ren mówi, że Hebi pod Zamek nie pójdą.

### Wymagania wobec sceny
- Kładka, po której da się przejść, albo zmiana ink, który ją obiecuje (Hideo „chodzisz górą, przez kładkę”, hak dostawy „Kładka… szybsza niż ulica pod nią”, hak „Na górę nie chodzimy”).
- Przy grupie Hebi skupisko drobiazgu i stół z chipami (handel z ink).
- Dźwięk pod kładką (pogłos, kapanie z rynny) i światło w sklepieniu bramy.
- Latarnia Pamięci przy bramie jako jedyne światło bez neonu (plan ulic P1).
- Rozdzielenie grupy terytorium i załogi zlecenia albo świadoma decyzja, że to jedna walka.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/grodzka-detail.ts`, `tools/blender/rooms/grodzka.py`, test `packages/sim/test/grodzka-scene.test.ts`): stół handlarzy ze skrzynek z chipami pod kładką (z bryłą, poza trasą Hideo), śmieci w kręgu grupy, rynna kładki z kapaniem (`drip`), dwie latarnie na ościeżach Bramy Grodzkiej, Latarnia Pamięci przed bramą, znak przystanku Tessen poza drogą z bramy. Teksty o kładce i haki dostawy poprawione w #955. Decyzja pod nieobecność: grupa terytorium `grodzka-bridge` i załoga zlecenia `kanal_bridge` to ta sama ekipa handlarzy, jedna walka (przeniesienie grupy zmieniłoby sens miejsca: „pod kładką stoją Hebi”). Zostaje:
- Pogłos pod kładką (dziś tylko kapanie z rynny).
- Wpis w `docs/topografia.md` dla kładki (celowe odstępstwo albo zgłoszenie) po przeglądzie `topography-curator`.
- Brak deszczu w przejściu (ADR-0048 „Do dopracowania”): `packages/engine/src/renderer/mapcity/passage-plan.ts`.
- Sztukmistrz (G-166): `packages/engine` (model) i plan mebli `tools/osm-import`.
