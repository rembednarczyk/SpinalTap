# Brama Krakowska i kontener pod nią (Tetsu) (`brama-krakowska`)

Brama Krakowska (OSM r7224409, środek (472,6; −91,2)) z przejazdem Bramowej (od (457; −95,6) do (487; −87,2), 3,6 m szerokości, sklepienie 4,2 m, `GATE_PASSAGES`) i jej przedpole od Placu Łokietka. Pod bramą od strony deptaka Hebi chowają torby za kontenerem na śmieci, o czym mówi Tetsu (`stash:kanal-alley`, (459,5; −99)). Brama jest progiem między Krakowskim Przedmieściem a Starym Miastem Hebi i pierwszym krokiem drogi na Zamek w akcie III. Stan gry na `1de4702`.

## Historia
Brama powstała w XIV wieku jako główna brama murów miejskich od strony traktu krakowskiego: gotycka ceglana wieża z przedbramiem, z wnęką na obraz Matki Boskiej nad łukiem. Później nadbudowano ją białym ośmiobokiem z zegarami, a w 1782 roku Dominik Merlini dał jej barokowy hełm z latarnią. Mury rozebrano, brama została i stała się symbolem Lublina. W środku działa Muzeum Historii Miasta Lublina.

W 2077 brama ma dwie twarze. Od Placu Łokietka, od strony nowego miasta, świeci różowymi liniami na gzymsach, holograficzną tarczą zegara, ekranem „STARE MIASTO 旧市街” i czerwonym światłem na maszcie iglicy. Od Bramowej zostały ciepłe linie i klasyczna tarcza (T-034). W przejeździe Hebi zamontowali skaner: kto wchodzi na Stare Miasto, wchodzi na ich teren, a ich posterunek stoi ok. 30 m dalej na Bramowej (ADR-0048). Hideo śpi w bramie domu przy Bramowej, tuż za przejazdem (492; −80). Kurierzy Hebi, kiedy ktoś ich goni, rzucają torby za kontener przy przedbramiu i nie zawsze po nie wracają (`tetsu`). Przed chwilą ktoś otworzył klapę kontenera i zostawił ją podpartą butelką.

## Klimat
- Światło: od zachodu różowe neonowe linie gzymsów (#ff2e88), holo-zegar, pasy LED na hełmie, czerwone światło masztu, ekran nad przedbramiem, cztery reflektory iluminacji od dołu (meble ulicy, w tym (461; −97) przy skrytce), latarenki ścienne. W przejeździe pasy skanera na ościeżach. Od wschodu ciepłe linie (#ffc98a).
- Dźwięk: kroki odbite w sklepieniu, sieć trolejbusowa na Lubartowskiej, gwar Placu Łokietka, deszcz; brak brzęczenia neonów bramy i dźwięku skanera.
- Zapach: zapiekanki z budki przy bramie (Sachiko: „Po zapiekanki idź pod Bramę”), mokra cegła, śmieci z kontenera.
- Kontrast: gotycka cegła i obraz Matki Boskiej obok ekranu reklamowego i skanera gangu.
- Ruch: tłum przechodzi przejazdem, patrol Bramowej nocą, para z budki z zapiekankami (dziś bez źródła), migający holo-zegar.

## Przeznaczenie
- Próg dzielnic: z `shinsekai-7` (pasmo 1–8) do `kanal` (pasmo 5–14) i na teren Hebi; skrytka za kontenerem (trop od Tetsu); punkt orientacyjny całego deptaka (czytelny z ok. 70 m, ADR-0045).
- Wejścia: przedpole od Placu Łokietka (droga z deptaka `GATE_WALK`: (400; −97) → (440; −100) → (447; −95) → (457; −95,6)), przejazd do Bramowej, Jezuicka przy przedbramiu, metro A Plac Łokietka (433; −107).
- Osłony: kontener (do zrobienia), budka z zapiekankami, ławki, słupki, drzewa przedpola; przejazd bez osłon.
- Punkty widokowe: przedpole z widokiem na bramę i deptak; muzeum na piętrach bez dostępu.

## Topografia
- Prawdziwe miejsce: Brama Krakowska (Plac Łokietka 3) z częściami: przedbramie w617597406, wieża w617597407, ośmiobok w617878341; fragment murów na wschód (w609951474). Teren ok. 196,4 m n.p.m. (y 0,6).
- Zgodne: obrys i położenie, przejazd na osi Bramowej, wysokości części po poprawkach (T-007, T-017), przedbramie z blankami, przyporami i wnęką (T-033), ośmiobok i hełm Merliniego (T-032), muzeum podpisane na bramie (T-013).
- Odstępstwa: warstwa 2077 od zachodu (neony, ekran, maszt, skaner Hebi; T-034, celowe, z warunkami: maszt krótszy od iglicy, ekran poza wnęką z obrazem); Jezuicka 3 przy bramie z nadbudową o jedno piętro (T-035, celowe); jezdnia na Placu Łokietka węższa niż w danych (T-156); Plac Łokietka bez nazwy na mapie (T-048).

## Inwentarz docelowy
Architektura:
- brama z przepisem zabytku i warstwą 2077 (jest, `landmarks/recipes.ts` `BRAMA_KRAKOWSKA`);
- sklepienie przejazdu z cegłą, żebrami i oprawą światła (do zrobienia, ADR-0048 „Do dopracowania”);
- skaner Hebi z panelem i kamerą w przejeździe (jest jako pasy na ościeżach; do zrobienia: urządzenie jako model, Blender `tools/blender/rooms/brama_krakowska.py`).
Duże obiekty:
- kontener na śmieci pod przedbramiem od strony deptaka, ok. (462; −100) (plan ulic: „Kontener pod Bramą (narracja `m4-ulica.ink`)… do dodania przez treść”; city kit `dumpster`), z kryjówką na ciało;
- budka z zapiekankami (model gry `food-stall`, jest), ławki, słupki, drzewa, Koziołek Kazik (481,8; −83,3) (model gry `artwork`);
- reflektory iluminacji (model gry `floodlight`, są cztery).
Drobiazg w skupiskach:
- za kontenerem: torba skrytki, worki, karton, butelka podpierająca klapę (Blender `brama_krakowska.py`, generator ADR-0096 `bags`);
- przy budce: tacki po zapiekankach, serwetki, kubki (generator ADR-0096 `litter`);
- w bramie Hideo na Bramowej: koc, kubek, tekturka (Blender).

## Frakcja i zasady
Frakcja: ulica, korporacja (reklama i ekran nowego miasta na gotyckiej bramie).
- §12 zgodne: otwarty Plac Łokietka, ciasny przejazd 3,6 m pod sklepieniem i znowu wąska Bramowa przed otwarciem na Rynek; brama jest progiem w prawdziwym mieście. Zmiana światła na progu jest (neon od zachodu, ciepło od wschodu).
- §13 częściowo: wszystkie światła mają źródło w recepturze i meblach. Nawigacja: przejazd jest ciemniejszy od fasady, choć jest drogą (brak oprawy w sklepieniu); skrytka i kontener bez wyróżnienia. 60-30-10 niemierzone.
- §14 częściowo: makro i mezo z mebli (budka, ławki, reflektory), mikro 4 rzeczy `clutter`; brak kontenera, o którym mówi ink.
- §15 częściowo: mokra kostka z odbiciami; deszcz pada w przejeździe (ADR-0048).
- §16 zgodne: ulica i reklama korporacji na zabytku, dwa światy po dwóch stronach łuku.
- §17 dług: brak dźwięku ze źródła (skaner, neon, pogłos w sklepieniu). Ruch: tłum, holo-zegar. Skala: drzwi, ławki, budka.

## Scenariusz

### Pierwszy kadr
Gracz idzie deptakiem na wschód i wychodzi na Plac Łokietka. Przed nim, ok. 70 m dalej, wieża bramy z różowymi liniami, holo-zegarem i czerwonym światłem na iglicy, ekran „STARE MIASTO 旧市街” nad przedbramiem, pod nim ciemny łuk przejazdu z pasami skanera. Po lewej, 20 m na północ od łuku, budka z zapiekankami (455,8; −76,1). Wzrok ma iść na łuk: to jedyne przejście na Stare Miasto z deptaka.

### Postacie i miejsca
- Skrytka za kontenerem (459,5; −99), przy reflektorze (461; −97): 60 €$, opatrunek, 2 yakitori, 2 złomu. Kładzie się z treścią Starego Miasta.
- Posterunek `hebi-bramowa` przy ścianie na Bramowej (506; −71), ok. 30 m za wschodnim wylotem, za dnia pilnuje i pali; od 21:00 do 5:00 chodzi Bramową do Rynku (541; −52) i z powrotem do wylotu bramy (490; −84).
- Hideo śpi w bramie przy (492; −80) od 2:00 do 7:30, 6 m od wylotu przejazdu.
- Hina szuka kota na Placu Łokietka (428; −99), 9:00–18:00, raz (`enc_s7_neko`).
- Stary Sabu łowi Czechówkę przez kratkę na Bramowej (510; −68), 4:00–9:00, raz (`enc_kanal_fisherman`).

### Przebieg
1. Trop: Tetsu na Rynku mówi o kontenerze „pod Bramą Krakowską, od strony deptaka” (flaga `tetsu_alley`).
2. Przedpole: gracz szuka kontenera przy przedbramiu i znajduje torbę.
3. Próg: przejście pod sklepieniem obok skanera Hebi; za łukiem posterunek Bramowej obserwuje (patrol toleruje neutralnego gracza). Napięcie: wejście na obcy teren.
4. Akt III: brama to pierwszy próg drogi z deptaka na Zamek (Bramowa, Rynek, Grodzka, Brama Grodzka, Zamkowa). Alternatywa: metro z Placu Łokietka na Plac Zamkowy.

### Drogi
- Cicha: przedpolem pod ścianą Jezuickiej 3 i przedbramia, przejazd wzdłuż ościeża; nocą patrol Bramowej dochodzi do wylotu co kilka minut.
- Głośna: strzał w przejeździe słyszy posterunek na Bramowej, a uraza liczy się w `kanal`, jeśli to już Stare Miasto.
- Ucieczka: na Plac Łokietka i do metra A (433; −107), deptakiem na zachód, Lubartowską na północ ku Alchemii.
- Pułapki: przejazd 3,6 m bez osłon, a od wschodu patrol w osi; skaner (dziś bez działania w grze).

### Pora i stan świata
- Noc: neon, holo-zegar i maszt świecą, reflektory od dołu, patrol Bramowej w ruchu, Hideo śpi w bramie. Dzień: tłum, Hina na placu, Sabu przy kratce o świcie, budka z zapiekankami czynna.
- Przed tropem Tetsu: skrytka leży, ale gracz o niej nie wie. Po wzięciu: kontener zostaje kryjówką.
- Akt III: brama bez zmian.

### Wymagania wobec sceny
- Kontener na śmieci przy przedbramiu, o którym mówią ink i komentarz skrytki („A bag left behind the dumpster under Brama Krakowska”). Dziś skrytka leży przy reflektorze na gołym bruku.
- Oprawa światła w sklepieniu przejazdu i brak deszczu pod nim.
- Skaner Hebi, który coś robi: dźwięk i błysk, kiedy gracz przechodzi; posterunek bliżej skanera albo skaner połączony z posterunkiem (ostrzeżenie jak przy patrolu).
- Kratka ściekowa na Bramowej dla Sabu (ink „wędkę spuszczoną w kratkę ściekową”).
- Para i zapach z budki z zapiekankami jako źródło ruchu.

## Dług sceny
Zrobione 23.11 (scena według karty, `packages/sim/src/content/brama-detail.ts`, `tools/blender/rooms/brama_krakowska.py`, test `packages/sim/test/brama-scene.test.ts`): kontener pod przybudówką z kryjówką (bryła w puli pomieszczeń chunku, `BRAMA_SOLIDS`), skrytka Tetsu za nim (`KANAL_ALLEY_STASH` zgodna z ink), skaner Hebi w sklepieniu z dźwiękiem (`hum`), dwie latarnie na ościeżach, posterunek z Bramowej 6,5 m od wschodniego wylotu przodem do niego, budka z zapiekankami z parą i dźwiękiem, transformator neonu, posłanie Hideo w bramie przy Bramowej, kratka Sabu (ink mówi już o Bramowej). Zostaje:
- Sucho pod łukiem: deszcz w `packages/engine/src/effects` nie zna przejazdów.
- Błysk skanera przy przejściu gracza i reakcja posterunku (zdarzenie w `sim`, efekt w `engine`); osobny dźwięk skanowania zamiast `hum` (nowy rodzaj w `RoomSound` i `room-scape.ts`).
- Sprzeczność ADR i gry: ADR-0045 („Gdzie co stoi”) podaje metro Brama Krakowska i skrytkę przy starych punktach (492; −80) i (459,5; −99), a gra ma węzeł (442; −40), wejście A (433; −107) i skrytkę (464,7; −98,3); dopisek w `docs/adr/0045-gra-w-lublinie.md`.
- Zmierzyć 60-30-10 nocą z Placu Łokietka i wpisać w §13 tej karty.
- Przegląd `topography-curator` (sesja jednowątkowa, bez agentów): rozstawienie sprawdzone testem sceny względem ścian z mapy.
