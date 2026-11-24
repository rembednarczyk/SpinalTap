# Rynek z Trybunałem (Hideo, Mei, Tetsu) (`rynek`)

Rynek Starego Miasta (x 530..610, z −28..−108) z Trybunałem Koronnym pośrodku (OSM w66264159, środek (582,4; −61,2)). Ludzie dawnej Ulicy Kanałowej mają tu swoje miejsca: Hideo pije pod SAKE, Mei śpiewa w KARAOKE, Tetsu prowadzi DENKI na rogu Rynku i Grodzkiej (ADR-0026, ADR-0045). Rynek to terytorium Hebi `rynek`, czyli patrole uliczne z ADR-0048. Z północno-zachodnich drzwi Trybunału schodzi się do Trasy Podziemnej (karta `docs/pomieszczenia/trasa-podziemna.md`). Stan gry na `1de4702`.

## Historia
Rynek wytyczono przy lokacji miasta w XIV wieku. Pośrodku stanął gotycki ratusz, który od 1578 roku był siedzibą Trybunału Koronnego, najwyższego sądu dla szlachty Małopolski. Pod koniec XVIII wieku Dominik Merlini przebudował go w stylu klasycystycznym. Z Trybunałem wiąże się legenda o czarciej łapie: diabły w nocy wydały sprawiedliwy wyrok w sprawie biednej wdowy, której ludzki sąd odmówił racji, a na stole został wypalony ślad łapy. Wokół stoją kamienice z attykami i polichromiami; w kamienicy przy Rynku 17 urodził się Henryk Wieniawski. Piwnicami kamienic biegnie dziś trasa turystyczna, która zaczyna się w Trybunale.

W 2077 Rynek trzymają Hebi. Za dnia jeden ich człowiek okrąża Trybunał, a reszta stoi na rogach, od 21:00 do 5:00 chodzą wszyscy czterej. Obserwują przechodniów i liczą, kto ile wydaje, ale nie strzelają do neutralnych na własnym terenie (ADR-0048, ADR-0091). Hideo, urzędnik z biura Tessen nad Bystrzycą, pije pod SAKE, bo „Trybunał po drugiej stronie Rynku też nie pyta” (`hideo`). Mei od trzech lat śpiewa w KARAOKE, a wcześniej śpiewała za drobne w lochach Trasy Podziemnej (`mei`). Tetsu naprawia przed DENKI wszystko, co ma baterię, i sprzedaje plotki taniej niż Kaito (`tetsu`). Przed chwilą Takumi postawił przed KARAOKE wiadro z plastikowymi kwiatami i znowu nie wszedł (`enc_kanal_flowers`).

## Klimat
- Światło: oszczędna warstwa 2077 Starego Miasta (ADR-0058): latarenki ścienne na wysięgnikach (18 w 40 m od środka), ciepły neon TRASA PODZIEMNA (#ffcf8a) nad drzwiami Trybunału; trzy neony lokali jako akcenty: bursztynowy SAKE (#ffb000), różowy KARAOKE (#ff2e88), cyjanowy DENKI (#00e5ff); dwie lampy gry, zimna przy wylocie Bramowej (552; −48) i ciepła przy Grodzkiej (598; −28). Kute szyldy z neonowymi tarczami (ADR-0048).
- Dźwięk: z drzwi SAKE i KARAOKE radio Yoru FM, z DENKI Tessen FM (`radio-speakers.ts`), śpiew Mei nocą (w ink), kroki patrolu po kocich łbach, deszcz. Neony Rynku nie brzęczą: emitery szumu są tylko na deptaku.
- Zapach: sake i smażone szaszłyki z ogródków, ozon z warsztatu Tetsu, mokry kamień.
- Kontrast: renesansowe attyki nad holo-tarczami szyldów; stolik z elektroniką z odzysku pod kamienicą z polichromią.
- Ruch: tłum z pasów Starego Miasta, patrol Hebi wokół Trybunału, Mei pali pod KARAOKE między piosenkami, Hideo z kieliszkiem.

## Przeznaczenie
- Miejsce rozmów aktu M4 (Hideo, Mei, Tetsu dają tropy: Hebi pod kładką na Grodzkiej, torba za kontenerem pod Bramą Krakowską, piosenka z dachów), wejście do Trasy Podziemnej, teren patroli Hebi i przejście z Bramowej na Grodzką w drodze na Zamek (akt III).
- Wejścia: Bramowa od zachodu (wylot przy (536..541; −52..−54)), Grodzka z północno-wschodniego rogu ((577; −23)), Rybna przejściem pod kamienicą w66293430 przy DENKI, uliczki Złota, Jezuicka i inne z pierzei.
- Osłony: Trybunał jako wielka osłona środkowa, ogródki kawiarni (4), stragany (10), stolik Tetsu (572,3; −32), ławki (4), potykacze.
- Punkty widokowe: brak dostępnych; Trybunał to punkt orientacyjny widoczny z wylotu Bramowej.

## Topografia
- Prawdziwe miejsce: Rynek r2082677 w Lublinie, Trybunał Koronny w66264159 (Rynek 1). Teren z NMT ok. 195,3–196,5 m n.p.m. (y −0,5..0,7), lekko opada na wschód.
- Zgodne: obrys Rynku i pierzei, położenie i wysokość Trybunału z OSM, przejście Rybnej, kocie łby wokół Trybunału.
- Odstępstwa: wykop pod Trasę Podziemną pod bryłą Trybunału (T-004, celowe); Trybunał niższy od kamienic Rynku po wyjęciu z LoD1 (T-254); dach Trybunału grafitowy zamiast zielonego (T-066, G-118); mozaika kostki i płyt na krawędziach pasów (T-189, G-406); Trybunał bez przepisu zabytku (G-119, Ratusz już ma); krawędzie przedsionka Trasy (G-111); wejście do piwnic z OSM 16 m od wejścia Trasy w grze (kandydat T w `docs/plany/wnetrza-zabytkow.md` §6).

## Inwentarz docelowy
Architektura:
- Trybunał z przepisem zabytku: klasycystyczna fasada, wieża z zegarem, beżowy tynk, zielony dach (do zrobienia: `landmarks/recipes.ts`, G-119);
- wnętrza KARAOKE i DENKI choćby jako przedsionek z kotarą i witryną (do zrobienia; dziś szyldy na fasadach bez wnętrz, ADR-0048);
- kute szyldy na wysięgnikach, latarenki ścienne (mapa, ADR-0048, generator mebli).
Duże obiekty:
- ogródki pod parasolami browarów, stragany, ławki, potykacze (model gry, meble uliczne);
- stolik Tetsu z elektroniką (dziś blok `metal`; do zrobienia: Blender `tools/blender/rooms/rynek.py`: lutownica, zasilacz, rozbebeszone telefony, skrzynka części);
- automat z napojami przy DENKI, który mówi (`enc_kanal_vending`, (590; −10); do zrobienia: model gry `vending-machine`).
Drobiazg w skupiskach:
- przy SAKE: kieliszki, butelka, popielniczka na parapecie, ślady po kieliszkach na blacie ogródka (Blender `rynek.py`);
- przy KARAOKE: wiadro z plastikowymi kwiatami Takumiego, niedopałki Mei, plakat koncertu (Blender);
- przy DENKI: kable, baterie, kartony po częściach (Blender, generator ADR-0096 `boxes`);
- przy rogach patroli: puszki, niedopałki, tag Hebi (model gry `graffiti`).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: ciasna, kręta Bramowa otwiera się na Rynek 62 × 72 m z Trybunałem pośrodku; kompresja i otwarcie są w prawdziwym układzie miasta.
- §13 częściowo: latarenki i neony mają źródła, barwy niosą znaczenie (ciepły handel, cyjan techniki u Tetsu). Nawigacja: drzwi Trasy Podziemnej mają ciepły neon (zgodne); wyjście na Grodzką nie ma światła drogi. 60-30-10 niemierzone: zrzut sceny `rynek-tpp` (Bramowa na Rynek o 21:01) przez `pnpm shots:palette`. Pomiar nocny 24.11 (22:00, ujęcie `rynek` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 71,2/27,4/1,4, brak akcentu.
- §14 częściowo: makro i mezo z mebli (stragany, ogródki, latarenki), mikro 7 rzeczy `clutter` w 40 m; skupisk przy lokalach brak.
- §15 zgodne: mokre kocie łby z odbiciami neonów i lamp; szkło witryn.
- §16 zgodne: ulica w zabytkowej oprawie, ciepły żółty latarenek i neony lokali.
- §17 częściowo: radia ze źródła w drzwiach SAKE, KARAOKE, DENKI; brak brzęczenia neonów (emitery tylko z `DISTRICT_M0_PROPS`) i dźwięku warsztatu Tetsu. Ruch: patrol, tłum, Mei. Skala: ławki, drzwi, stolik.

## Scenariusz

### Pierwszy kadr
Gracz wchodzi z Bramowej, od Bramy Krakowskiej (scena `rynek-tpp`, 21:01). Wąska ulica kończy się przy zimnej lampie (552; −48) i otwiera na Rynek: na wprost Trybunał z ciepłym neonem TRASA PODZIEMNA nad drzwiami, po lewej różowy KARAOKE i Mei pod nim, dalej na lewo w rogu cyjanowy DENKI, po prawej w głębi bursztynowy SAKE. Patrol Hebi wychodzi zza Trybunału. Wzrok ma iść na Trybunał, a potem na trzy kolorowe lokale wokół niego.

### Postacie i miejsca
- Hideo pod SAKE (559,6; −83,5), plecami do ściany; od 17:00 wraca z przystanku na Zamkowej (dojście ok. 4 godzin gry), stoi z kieliszkiem do 2:00, potem przez Bramową do bramy, w której śpi (492; −80). O 7:30 idzie Grodzką do autobusu Tessen pod Bramą Grodzką (730; 155).
- Mei pod KARAOKE (556; −38,5) od 20:00 do 4:00, pali i gada między piosenkami; za dnia czeka w bramie przy (545; −46), od 4:00 w swojej bramie (533; −50).
- Tetsu przed DENKI (571,5; −31) cały dzień, stolik z elektroniką obok (572,3; −32).
- Patrole Hebi (terytorium `rynek`): `hebi-rynek` cały dzień wokół Trybunału, od (560; −40) przez (599; −39), (606; −62), (603; −87), (563; −87) i (561; −64); `hebi-rynek-noc` za dnia na rogu przy zachodniej pierzei (543; −60), nocą ta sama pętla w drugą stronę; `hebi-bramowa` i `hebi-grodzka` na sąsiednich ulicach.
- Takumi z kwiatami pod KARAOKE (551; −45), 20:00–3:00, raz; automat przy DENKI (590; −10), 10:00–22:00, raz.

### Przebieg
1. Wejście na teren Hebi: patrol zauważa gracza i obserwuje go (`WatchPlayer`, ostrzeżenie), dopóki Hebi w dzielnicy `kanal` nie są sprowokowani ani uraza nie przekroczyła progu (ADR-0091). Napięcie bez walki.
2. Rozmowy: Hideo opowiada o Hebi pod kładką na Grodzkiej i o tym, że Kaito płaci za takich (trop do zlecenia `kanal_bridge`, flaga `hideo_bridge`); Tetsu mówi o torbie za kontenerem pod Bramą Krakowską (`tetsu_alley`) i nocnym handlu chipami; Mei nuci „starą piosenkę z dachów” (`mei_song`, motyw wspomnień Seki i Rena).
3. Spotkania: Takumi i kwiaty dla Mei, automat, który nie chce iść na złom.
4. Trasa Podziemna: zejście przez drzwi Trybunału do lochu Mei ze skrytką.
5. Akt III: przejście przez Rynek na Grodzką w drodze na Zamek (`source_lead` i `chapel`); po zakończeniu `release` epilog mówi, że „na Starym Mieście ktoś płacze na ławce, bo pamięta ślub, którego nie miał”.

### Drogi
- Cicha: wzdłuż pierzei pod ogródkami, w cieniu między latarenkami; patrol idzie środkiem bruku 2 m od ścian i więcej, więc pierzeja daje odstęp. Za dnia jeden chodzący i rogi; nocą czterech.
- Głośna: strzał na Rynku podnosi urazę całego `kanal` i sprowadza patrole z Bramowej i Grodzkiej (ADR-0048: patrol odpowiada na strzał).
- Ucieczka: do Trasy Podziemnej (drzwi Trybunału), przejściem Rybnej przy DENKI, Grodzką w dół, Bramową do Bramy Krakowskiej i metra A na Placu Łokietka.
- Pułapki: patrol `hebi-rynek-noc` stoi za dnia przy zachodniej pierzei, 15 m od wylotu Bramowej.

### Pora i stan świata
- Noc (21:00–5:00): czterech Hebi w ruchu, Mei śpiewa od 20:00, Hideo pod SAKE. Dzień: jeden patrol, wycieczki do Archikatedry (Tetsu), Mei w bramie, Hideo w pracy.
- Przed M4: ludzie Rynku stoją, ale ich tropy prowadzą do zleceń i skrytek dostępnych po prologu. Po zleceniu pod kładką: uraza Hebi w `kanal` rośnie, patrole przestają tolerować gracza powyżej progu 60.
- Akt III: Rynek bez zmian; zmiany są w rozmowach Ume i Rena, nie tutaj.

### Wymagania wobec sceny
- Trybunał jako punkt orientacyjny: wyższy od pierzei i z przepisem zabytku (T-254, G-119).
- KARAOKE z wejściem i kotarą, za którą znika Takumi (ink: „znika za kotarą”), DENKI z witryną.
- Automat z napojami przy DENKI w miejscu spotkania (590; −10). Dziś go tam nie ma.
- Skupiska drobiazgu przy trzech lokalach; brzęczenie neonów i dźwięk warsztatu Tetsu jako emitery.
- Światło drogi na Grodzką w rogu Rynku (wyjście w stronę Zamku w akcie III).

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/rynek-detail.ts`, `tools/blender/rooms/rynek.py`, test `packages/sim/test/rynek-scene.test.ts`): stolik Tetsu jako model (bryła zostaje, rysuje ją model) z brzęczeniem listwy (`hum`), skupiska przy DENKI, SAKE i KARAOKE, automat z napojami przy spotkaniu `enc_kanal_vending`, latarnia na kamienicy przy wylocie Grodzkiej; zdanie Mei o piwnicach poprawione w #955. Zostaje:
- Przepis zabytku Trybunału (fasada Merliniego, wieża z zegarem, beżowy tynk, zielony dach) i wysokość z LoD2 (G-119, T-254, T-066): `packages/engine/src/renderer/mapcity/landmarks/recipes.ts`, korekta wysokości w `tools/osm-import` (`LOD1_LANDMARKS`).
- Przedsionek KARAOKE z kotarą (model `rd-k-curtain` jest w zestawie Blendera) i witryna DENKI: wnętrze w `packages/sim/src/content/interiors.ts` albo nowy plik pokoju w `packages/sim/src/content/`, wpis w `INTERIORS` i karta pomieszczenia (§12: każde pomieszczenie osobnym wnętrzem).
- Brzęczenie neonów Starego Miasta (dziś `neonEmitters()` czyta tylko `DISTRICT_M0_PROPS`) i warsztat Tetsu jako emiter: `packages/engine/src/audio/spatial.ts`, `packages/engine/src/audio/ambience.ts`.
- Zmierzyć 60-30-10 na zrzucie `rynek-tpp` i wpisać w §13 tej karty.
