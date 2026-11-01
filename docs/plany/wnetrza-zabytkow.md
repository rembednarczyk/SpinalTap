# Wnętrza zabytków: odpowiedź kuratora topografii i plan (31.10)

Pytanie użytkownika (31.10): czy główne budowle, jak Archikatedra, będą miały wnętrza, i czy da się w nich osadzić questy poboczne albo część wątku głównego.

**Krótko:** tak, to ma sens i pasuje do danych. Każdy z wymienionych zabytków ma w danych gry swój budynek z OSM, z obrysem i wysokościami, w które wnętrze się zmieści. Dziś wnętrze ma tylko jeden zabytek: Trybunał Koronny, pod którym są piwnice Trasy Podziemnej (ADR-0048). Rekomendowana kolejność: najpierw rozbudowa Trybunału i Trasy, potem Archikatedra z zakrystią akustyczną, Wieża Trynitarska (po naprawie przejścia pod nią) i na końcu Zamek z Kaplicą Trójcy i Donżonem jako miejsce aktu III. Szczegóły niżej.

To jest plan, nie decyzja. Przed budową potrzebny jest ADR „wnętrza zabytków” (backlog, pozycja „Wnętrza głównych zabytków”) oparty na ADR-0061, ADR-0062 i ADR-0038.

## 0. Stan wyjściowy (zmierzony 31.10)

- **Okna (wymóg użytkownika, 31.10):** każde wnętrze ma okna tam, gdzie ma je budynek, jako prawdziwe otwory zgodne z elewacją i z przepisem zabytku (ostrołuki, okna półkoliste, witraże); zasady w ADR-0061 „Uzupełnienie: okna wnętrz”.
- **System wnętrz z ADR-0061 (stan z 31.10 wieczór):** etap 1 zbudowany i w weryfikacji: lista `INTERIORS` (klinika, Neon Koi, biuro Tessen, Trasa Podziemna), zdarzenia `InteriorEntered`/`InteriorLeft`, autozapis przy wejściu, kontrola skanu `interior-outside-building`. Wcześniej były tylko powłoki z ADR-0038 (`interior: true`) i osobny chunk Trasy Podziemnej. Wnętrza zabytków powinny być pierwszymi wpisami `INTERIORS`, które dostają pole `building` (id OSM), żeby kontrola skanu mogła je sprawdzić (rozdział 5).
- **Trasa Podziemna** (`kanal-underground.ts`, `TRASA_PODZIEMNA` w `sites.ts`) leży w całości w obrysie Trybunału w66264159. Narożniki powłoki x 570..585,3, z −64,8..−55,5 są od 1,37 m (NW) do 10,2 m (SE) w głąb od ścian. Na zewnątrz wychodzi tylko przedsionek od (565,5, −57), 1,8 m przed fasadą, i tak ma być, bo to wejście (`PASSAGES`). Wykop to T-004. **Zgodne.**
- **Węzły wejść z OSM nie trafiają do `data/osm/*.json`.** `filterOsm` w `tools/osm-import/src/osm.ts` je usuwa. W surowej pamięci podręcznej `data/osm/cache/*.osm` jest 44 węzłów `entrance=*`, a w wyciągach 0. Wejścia niżej odczytałem z pamięci podręcznej (ten sam zrzut OSM, ODbL). Propozycja dla importu: zachować `entrance=*` i `door=*`, bo bez nich wejść do wnętrz nie da się sprawdzać automatycznie (rozdział 5).

Współrzędne gry według ADR-0042 (x na wschód, z na północ, metry od Placu Litewskiego). Wysokości y to teren w grze, sprawdzony z NMT co do 0,1 m w punktach wejść.

## 1. Zabytki po kolei

Oznaczenia: **[pewne]** to dane OSM, NMT albo gry zmierzone sondą, a także fakty dobrze znane. **[do sprawdzenia]** to rzeczy do potwierdzenia na planach, zdjęciach albo w źródłach przed budową (Wikimedia Commons, strony muzeów, zabytek.pl).

### 1.1 Archikatedra św. Jana Chrzciciela i św. Jana Ewangelisty (Stare Miasto)

- **Dane:** obrys w66286341 (634,2, −183,8), 1974 m², x 601,7..666,9, z −205,8..−164,3. Części: nawa w617763433, 47,3 × 16,7 m, 9 kondygnacji, w grze ściany do 38,7 m nad stopą przy cokole 9,9 m. Dwie wieżyczki fasady w617763434 (613,4, −173,2) i w617763435 (615,6, −195,3) z kopułami. **[pewne]**
- **Wejście z OSM:** n1896140383 `entrance=main` (603,5, −184,6), w zachodniej fasadzie, w osi między wieżyczkami. Prowadzą do niego schody w66335060 (7 stopni z rampą). Teren przy wejściu wynosi y −2,6. **Pasuje do bryły w grze:** wejście leży na krawędzi obrysu, w środku fasady. **[pewne]**
- **Teren:** pod obrysem spada o 9,9 m (y −9,6 w najniższym punkcie). Część północna leży na y 0,0, aneks południowy na −5,8, a wschodni koniec na −1,2. Posadzka kościoła powinna być na poziomie wejścia (ok. −2,6 plus stopnie). Pod spadkiem po stronie południowej i wschodniej zostaje miejsce na niższą kondygnację, czyli na krypty. **[pewne: teren; do sprawdzenia: położenie i zasięg krypt]**
- **Realny układ:** jezuicki kościół z przełomu XVI i XVII w. Od zachodu klasycystyczny portyk. Wnętrze z iluzjonistyczną polichromią Józefa Meyera z połowy XVIII w. Za prezbiterium jest zakrystia akustyczna: szept przy ścianie w jednym narożniku słychać w przeciwległym. Pod kościołem są krypty udostępniane zwiedzającym, jest też skarbiec. **[pewne: zakrystia akustyczna, portyk, polichromia; do sprawdzenia: liczba naw (jedno- czy trójnawowa z kaplicami), daty, położenie skarbca i wejścia do krypt]**
- **Dopasowanie do danych:** nawa w OSM kończy się od wschodu zaokrągleniem (prezbiterium), a pełny obrys sięga o 8 m dalej na wschód (x 659..667) w pasie z −203..−165. To dobre miejsce na zakrystię za prezbiterium. **[do sprawdzenia na planie kościoła]**
- **Skala:** nawa ok. 47 × 17 m, więc wnętrze zmieści się bez ściskania. Strop wnętrza musi zostać pod okapem bryły (ok. 28 m nad posadzką) z zapasem na sklepienie i dach.
- **Ryzyka:** spadek 9,9 m (posadzka nie może iść za terenem, krypty pod nią potrzebują wykopu i wpisu w `PADS` jak T-004); proceduralne wieże z T-018, które nie mogą przebić wnętrza; okna i portyk z przepisu ADR-0062 (etap 3) muszą zgadzać się z otworami wnętrza; meble z OSM w obrysie (G-011, reflektory) do usunięcia z wnętrza.

### 1.2 Brama Krakowska z Muzeum Historii Miasta Lublina (Stare Miasto / Krakowskie)

- **Dane:** r7224409 (472,6, −91,2). Przedbramie w617597406, 12,4 × 11 m, 2 kondygnacje. Wieża w617597407, 11,3 × 10,7 m, 5 kondygnacji, w grze do 16,7 m nad stopą. Ośmiobok w617878341, ok. 6,6 m średnicy, z hełmem. **[pewne]**
- **Wejście z OSM:** brak węzła `entrance`. Muzeum ma adres Plac Łokietka 3. Węzeł muzeum n993790419 leży 6 m za obrysem (T-013, G-051). **[do sprawdzenia: które drzwi prowadzą do muzeum i czy muzeum jest dziś otwarte, bo było w remoncie]**
- **Realny układ:** gotycka wieża z XIV w., na niej barokowy ośmiobok z hełmem z XVIII w. W wieży jest kilka kondygnacji ekspozycji połączonych wąskimi schodami w murze albo przy murze. **[do sprawdzenia: rodzaj schodów, czy jest galeria widokowa]**
- **Skala:** wnętrze wieży przy murach 1,5–2 m grubości ma ok. 7 × 7 m na kondygnację. W poziomie przejazdu (`GATE_PASSAGES`, 3,6 × 4,2 m, oś (457, −95,6)–(487, −87,2)) nie ma miejsca na nic poza samym przejazdem. Wnętrze zaczyna się nad sklepieniem przejazdu, ok. 5–6 m nad bruk.
- **Ryzyka:** wnętrze ciaśniejsze niż bryła i trudne dla kamery TPP; schody nie mogą wejść w światło przejazdu ani w posterunek `hebi-bramowa`; przegląd ADR-0062 etap 1 trwa (T-032, T-033), więc wnętrze dopiero po zamknięciu bryły.

### 1.3 Trybunał Koronny i Trasa Podziemna (Stare Miasto, Rynek 1)

- **Dane:** w66264159 (582,4, −61,2), 703 m², 29,5 × 24,3 m, obrócony o ok. 30°, 3 kondygnacje, w grze 11,4 m i dach 7 m. Teren pod obrysem spada o 1,8 m. **[pewne]**
- **Wejścia:** w grze przedsionek Trasy od zachodu (565,5, −57) na y 0,3. W OSM węzeł n2969572858 `entrance=yes` (573,8, −71,0) na końcu schodów w293370649 (11 stopni w dół), 3,5 m przed południowo-zachodnią ścianą, 16 m od wejścia w grze. Węzeł Trasy n2439781377 leży w obrysie (580,5, −64,5). **[pewne: dane; do sprawdzenia: czy schody n2969572858 to dzisiejsze wejście albo wyjście Trasy, czy zejście do innej piwnicy. Jeśli to wejście Trasy, odstępstwo trzeba wpisać do rejestru (kandydat T, rozdział 6)]**
- **Realny układ:** gotycki ratusz z XIV w., przebudowany w stylu klasycystycznym w XVIII w. Od 1578 r. siedziba Trybunału Koronnego, dziś m.in. sala ślubów. Trasa Podziemna zaczyna się w Trybunale i prowadzi piwnicami kamienic Rynku do Placu po Farze, ma ok. 280 m. Legenda o „czarciej łapie”: diabły w nocy wydały sprawiedliwy wyrok w sprawie biednej wdowy, a stół z wypalonym śladem łapy trafił do muzeum. **[pewne: legenda i ogólny przebieg Trasy; do sprawdzenia: długość, miejsce wyjścia i to, gdzie dziś stoi stół]**
- **Skala:** sala na parterze albo piętrze zmieści się w 29 × 24 m. Piwnice już są.
- **Ryzyka:** przedłużenie Trasy pod kamienicami Rynku oznacza nowe wykopy pod cudzymi budynkami (każdy w `PADS` i w rejestrze jak T-004); sala w Trybunale wymaga wycięcia bryły (`BUILDING_CUTS`) zgodnego z przepisem ADR-0062 etap 4.

### 1.4 Zamek Lubelski z Kaplicą Trójcy Świętej i Donżonem (Podzamcze)

- **Dane:** Zamek w48500136 (887,6, 234), 3030 m² skrzydeł wokół Dziedzińca Zamkowego w383162808 (y −7,3), 3 kondygnacje, w grze 12,8 m. Donżon w450180469 (893,1, 214,6), średnica 15,5 m, `height=25`, w grze 26 m. Kaplica w66258167 (941, 214,6), 23,2 × 12,4 m, prezbiterium zamknięte od wschodu. **[pewne]**
- **Wejścia z OSM:**
  - n873540657 `entrance=main` (836,4, 238,4): brama w zachodnim skrzydle. Przechodzi przez nią `tunnel=building_passage` w652347355 do dziedzińca, a w grze jest przejście (852, 237,2)–(835,6, 238,5) o wymiarach 2,4 × 3,4 m. **Pasuje** co do położenia. **[do sprawdzenia: wymiary bramy, bo 2,4 × 3,4 m to domyślny przejazd kamienicy, a neogotycka brama Zamku jest większa (audyt bram)]**
  - n14296098394 (850,4, 227,2) i n14296098393 (895,7, 247,1): wejścia ze strony dziedzińca do skrzydeł. **[pewne]**
  - Donżon n6115941842 (886,0, 218,0), `wheelchair=no`: na metalowych schodach w66258166 (8 stopni w górę), czyli wejście podniesione nad dziedziniec. **[pewne]**
  - Kaplica: brak węzła. **[do sprawdzenia: wejście od zachodu, od strony dziedzińca i skrzydła muzeum]**
- **Realny układ:**
  - Donżon to najstarsza budowla Lublina (XIII w.): okrągła ceglano-kamienna wieża z tarasem widokowym, wewnątrz schody na kolejne kondygnacje.
  - Kaplica jest gotycka, ze sklepieniem wspartym na jednym środkowym filarze. Pokrywają ją rusko-bizantyjskie freski z 1418 r., ufundowane przez Władysława Jagiełłę i podpisane cyrylicą przez mistrza Andrzeja. Przez wieki freski były zatynkowane, odkryto je pod koniec XIX w. Dziś wchodzi się małymi grupami, a kaplica ma pilnowany mikroklimat.
  - Neogotyckie skrzydła z lat 20. XIX w. do 1954 r. były więzieniem, w czasie okupacji i po wojnie miejscem kaźni. Dziś mieści się tu Muzeum Narodowe.
  - Unia lubelska z 1569 r. jest związana z Zamkiem.
  - **[pewne: one; do sprawdzenia: dokładne daty, empora w kaplicy, układ cel i piwnic więzienia, wysokość tarasu Donżonu]**
- **Skala:** wnętrze Donżonu przy murach ok. 2,5 m ma ok. 10 m średnicy. Kaplica ma ok. 20 × 10 m w świetle.
- **Ryzyka:**
  - Wysokość Kaplicy w grze (17,3 m i dach 4,4 m) pochodzi z domyślnych 4 kondygnacji (`source: "default"`, w OSM brak tagu). Przed budową wnętrza trzeba ją sprawdzić, bo strop wnętrza może wyjść za realny budynek albo odwrotnie (kandydat T, rozdział 6).
  - Freski to zadanie dla grafiki: stylizacja NPR, bez kopiowania zdjęć na licencjach CC-BY-SA. Same freski z 1418 r. są w domenie publicznej, ale ich fotografie zwykle nie.
  - Pamięć ofiar więzienia: bez strzelania w celach i bez zabawy w egzekucje.

### 1.5 Wieża Trynitarska z Muzeum Archidiecezjalnym (Stare Miasto)

- **Dane:** w66286371 (591,3, −147,3), obrys 212 m² do 42 m. Korpus w617763431, 13,3 × 12,4 m, do 52 m. Latarnia do 57 m, hełm do 62 m nad stopą (T-006, poprawione). **[pewne]**
- **Wejście z OSM:** brak węzła `entrance`. Węzeł tarasu `tourism=viewpoint` n2525925590 (590,1, −147,0), `direction=360`. Węzeł muzeum n3035127051 (594,4, −147,2). **[pewne]**
- **Uskok 42 m:** obrys (212 m²) jest szerszy od korpusu (137 m²) i kończy się na 42 m, więc w danych powstaje półka dookoła korpusu. Najpewniej to taras widokowy. **[do sprawdzenia na zdjęciach: wysokość tarasu i czy obiega całą wieżę]**
- **Przejście pod wieżą:** w OSM ul. Teodora Gruella w298307007 (`tunnel=yes`, `layer=-1`, deptak, sett) przechodzi pod wieżą z (587,6, −154,2) do (586,6, −140,5): to przejazd bramny między Królewską a Placem Katedralnym. Import tworzy przejścia tylko z `tunnel=building_passage` (`passages.ts`), więc **w grze ten przejazd najpewniej jest zamknięty pełną bryłą wieży.** **[do potwierdzenia zrzutem w audycie bram, kandydat T i glitch, rozdział 6]**
- **Realny układ:** dawna brama klasztoru trynitarzy, przebudowana w XIX w. w stylu neogotyckim. Na kolejnych kondygnacjach ekspozycja muzeum, schody na taras. **[do sprawdzenia: daty, liczba kondygnacji i biegów schodów]**
- **Skala:** wnętrze korpusu przy murach ok. 1,5 m ma ok. 10 × 9 m. Klatka schodowa z ok. 40 m wejścia zmieści się, ale zajmie większość rzutu.
- **Ryzyka:** wnętrze nie może zablokować przejazdu na parterze, który dziś i tak jest zamknięty; schody wzdłuż ścian przy wąskim rzucie są trudne dla kamery TPP; widok z tarasu obejmie całe miasto, więc ujawni dziurę 1180 m między Podzamczem a Nabrzeżem (T-022) i panoramę (ADR-0063). To zaleta dla gracza, ale też koszt w budżecie rysowania.

### 1.6 Ratusz, Urząd Miasta (Krakowskie, Plac Łokietka 1)

- **Dane:** w66264120 (416,1, −69,6), 36,9 × 33,5 m, 4,5 kondygnacji, w grze 17 m. Wieża w619138854 do 26,6 m. **[pewne]**
- **Wejście z OSM:** n10028568613 `entrance=main` (415,1, −84,9), w fasadzie od Placu Łokietka, 3 m przed wieżą. Teren y 0,4. **Pasuje.** **[pewne]**
- **Realny układ:** dawny klasztor, przebudowany na ratusz w XIX w. Dziś biura, sala obrad i hol. **[do sprawdzenia: historia i układ]**
- **Ocena:** mała wartość dla rozgrywki. Wystarczy co najwyżej hol z recepcją i jednym pokojem (urzędnik, miejskie archiwum danych). Niskie ryzyko topograficzne.

### 1.7 Bazylika i klasztor Dominikanów (Stare Miasto)

- **Dane:** kościół w66286338 (731,1, −55,5), 1922 m², kaplice z kopułami w617763428 i w617763429. Klasztor r2366732 (obrys w66286340), 3114 m², z dziedzińcem, który w grze jest wypełniony (dziury multipolygonów są zapełniane). Pod klasztorem chodnik w586408568 (`tunnel=yes`, `layer=-1`, (743, −110)–(752, −126)). **[pewne]**
- **Wejście z OSM:** brak węzła. **[do sprawdzenia: wejście od ul. Złotej]**
- **Teren:** spad od y 0,6 na zachodzie do −8,5 na wschodzie (cokół 10,6 m), czyli kościół na krawędzi skarpy, z miejscem na krypty pod kaplicami.
- **Realny układ:** fundacja z XIV w. Kaplice Firlejów i Tyszkiewiczów, obraz „Pożar miasta Lublina” z 1719 r., relikwia Krzyża Świętego skradziona w 1991 r. i nieodnaleziona. **[do sprawdzenia: wszystkie szczegóły przed użyciem w fabule]**
- **Ocena:** duża wartość, ale też duży koszt (dwa budynki, spadek 10 m). Na później, po Archikatedrze, która jest podobna, a lepiej opisana w danych.

### 1.8 Podziemia Trasy Podziemnej (ADR-0048, ADR-0061)

Już istnieją: przedsionek, schody, korytarze i loch Mei (rozdział 0). Realna trasa ma ok. 280 m i prowadzi pod kamienicami do Placu po Farze. Dalsze odcinki wchodzą pod cudze budynki z OSM. Każdy dostanie wykop w `PADS` i wpis w rejestrze, a podłoga pod Rynkiem nie może wyjść ponad bruk.

## 2. Kolejność

| # | Wnętrze | Wartość dla gracza | Koszt | Ryzyko topograficzne | Warunek wstępny |
|---|---|---|---|---|---|
| 0 | System `INTERIORS` (ADR-0061), ADR „wnętrza zabytków”, wejścia `entrance=*` w imporcie | wszystkie wnętrza | S–M | brak | — |
| 1 | Trybunał: sala nocna i przedłużenie Trasy o 1–2 piwnice | średnia/wysoka (quest „Czarcia łapa”) | S–M (powłoka, chunk i wykop już są) | niskie, każdy nowy wykop jako wpis T | wyjaśnić wejście n2969572858 |
| 2 | Archikatedra: nawa, zakrystia akustyczna, później krypty | wysoka (rozpoznawalna, nowa mechanika szeptu) | M–L | średnie: spadek 9,9 m, wieże T-018, okna z ADR-0062 | ADR-0062 etap 3 (Archikatedra) |
| 3 | Wieża Trynitarska: schody i taras widokowy | wysoka (widok na miasto, zwiad) | M | średnie: przejazd Gruella zamknięty, wąski rzut | naprawa przejazdu (audyt bram), ADR-0062 etap 3 |
| 4 | Zamek: Kaplica Trójcy, Donżon, piwnice dawnego więzienia | bardzo wysoka (akt III) | L (freski, kilka przestrzeni) | średnie: wysokość kaplicy z wartości domyślnej, wymiary bramy | akt III w ink, ADR-0062 etap 5, decyzja o wysokości kaplicy |
| 5 | Brama Krakowska: kondygnacje muzeum nad przejazdem | niska/średnia | S | niskie, ale ciasno nad przejazdem i posterunkiem Hebi | zamknięcie T-032 i T-033 |
| 6 | Dominikanie, Ratusz | średnia / niska | L / S | wysokie (spadek 10 m) / niskie | po Archikatedrze |

Uzasadnienie: Trybunał daje najwięcej za najmniej, bo powłoka, chunk, wykop i wejście już są, a quest dopisuje się do istniejących postaci (Hideo z Tessen pije pod SAKE „naprzeciw Trybunału”, Mei śpiewała w lochu). Archikatedra to najlepsze miejsce na nową mechanikę i jest dobrze opisana w danych: ma wejście z OSM, części i nawę. Zamek warto zostawić na akt III, bo jest najdroższy i najmocniej związany z fabułą.

## 3. Warstwa 2077 we wnętrzach (ADR-0062)

Zasada z ADR-0062 obowiązuje także w środku: zabytek ma być czytelny jako zabytek, a warstwa cyberpunkowa jest dodatkiem ze światła, ekranów i kabli. Wszystkie te wnętrza leżą na Starym Mieście albo przy Zamku, więc warstwa jest stonowana.

- **Nie wolno:**
  - zasłaniać fresków, polichromii, ołtarzy ani sklepień;
  - stawiać dużych ekranów, wiązek kabli na ścianach i neonów na elementach sakralnych;
  - stawiać ścianek działowych, które zmieniają realny układ (nawy, filar kaplicy, kondygnacje wieży).
- **Wolno (w ilości „Stare Miasto oszczędnie”, ADR-0058):**
  - podświetlenie od dołu i cienkie linie światła na gzymsach;
  - pojedyncze hologramy muzealne przy eksponatach (tabliczki, rekonstrukcje 3D) z tekstem przez i18n (ADR-0056);
  - kamery, czujniki mikroklimatu, drony-przewodniki;
  - elektroniczne znicze obok prawdziwych świec;
  - stanowiska kontroli biletów jak bramki metra.
- **Pomysł spajający:** w 2077 r. konserwację i ochronę zabytków opłacają korporacje. Przy wejściach wiszą dyskretne tabliczki sponsorów (nazwy generyczne, bez prawdziwych marek). Dla fabuły to naturalny powód obecności Kagami czy Tessen w muzeum bez przerabiania wnętrza.
- **Sacrum i pamięć:** Archikatedra, Dominikanie i Kaplica Trójcy działają jako kościoły, a Zamek był więzieniem i miejscem kaźni. Propozycja do ADR: w tych wnętrzach strefa bez walki (broń schowana, wrogowie nie wchodzą do środka). Questy w nich opierają się na skradaniu, rozmowie i obserwacji, a walka toczy się przed wejściem. To kwestia szacunku, ale też techniki: mniej AI w ciasnym wnętrzu.
- **Rejestr:** każdy element warstwy 2077 we wnętrzu, który zmienia wygląd zabytku, dostaje wpis T jako celowy (tak jak T-034 dla elewacji Bramy).

## 4. Pomysły na questy

Tło z `m3-echo.ink`, `m3-lustro.ink` i `m4-ulica.ink`: Seki (albo Aya) nosi albo nosiła moduł pamięci Kagami Biotech. Kagami nagrywa i nadpisuje ludzi („zapis zero”, archiwum 50 chipów). Ren Odagiri sprzedał Kagami próbkę głosu, z której zrobiono „filtr Odagiri”. Kagami słucha kanałów modułu. Akt II kończy się decyzją o archiwum: `street` (Ume oddaje chipy ludziom), `hebi` (Hebi sprzedają wspomnienia) albo `kagami` (Seki dostaje „lustro”, zapis za dobry, żeby był prawdziwy). Akt III jest w planie (backlog P1, pozycja 6). Motyw przewodni to autentyczność wspomnień i głosu.

### 4.1 „Szept” (Archikatedra, zakrystia akustyczna): poboczny, haczyk do aktu III

- **Prawdziwa cecha:** szept przy ścianie w jednym narożniku zakrystii słychać w przeciwległym, a w środku pomieszczenia już nie.
- **Zaczepienie:** Kaito ma klienta, który nie ufa żadnej sieci, bo Kagami słucha wszystkiego (Ren: „Kagami też słucha tego kanału”). To technik Kagami (głos `TECH` z `recall_last_call` i `recall_operating_table`), który chce odejść. Spotkanie nie może przejść przez elektronikę. W całym mieście jest jedno miejsce, gdzie wiadomość wędruje bez kabla: zakrystia akustyczna, wieczorem po nabożeństwie.
- **Rozgrywka:**
  - Wejście z tłumem albo po zamknięciu: strefa bez walki, w nawie ochrona z drona-przewodnika.
  - W zakrystii dwa narożniki to dwa obszary nasłuchu (deterministyczne, z pozycji). Seki staje w jednym, technik szepcze w przeciwległym, a strażnik w środku nie słyszy nic.
  - Wybór, który wraca do tematu głosu:
    - słuchać gołym uchem;
    - nagrać modułem, co w zakończeniu `aya` oznacza, że Kagami usłyszy nagranie (`choice_voice`, `story_ending`).
- **Cel fabularny:** w zakrystii głos jest niefiltrowany, bez „filtra Odagiri”. Technik mówi, że oryginały „zapisów zero” nie leżą w laboratorium, tylko w chłodni, której nikt nie podejrzewa: pod Zamkiem (4.2).
- **Wątek główny:** tak, jako most z aktu II do III. Da się go też zagrać jako zwykłe zlecenie Kaito, jeśli akt III ruszy inaczej.

### 4.2 „Pod tynkiem” (Zamek: Kaplica Trójcy, Donżon, piwnice więzienia): kandydat na akt III

- **Prawdziwe cechy:**
  - freski z 1418 r. przez wieki leżały pod tynkiem, aż je odkryto i odsłonięto;
  - na fresku jest podpis mistrza Andrzeja cyrylicą;
  - kaplica ma pilnowany mikroklimat i wpuszcza małe grupy;
  - Zamek przez ponad sto lat był więzieniem;
  - Donżon ma podniesione wejście po metalowych schodach i taras z widokiem na dolinę Bystrzycy.
- **2077:** Kagami sponsoruje konserwację fresków. System klimatyzacji kaplicy i piwnice dawnego więzienia to dla Kagami idealna chłodnia na oryginały zapisów. Miasto trzymało tu kiedyś ludzi, a teraz trzyma ich pamięć.
- **Rozgrywka:**
  - wejście z grupą zwiedzających na bilet czasowy (okno czasowe jak w prawdziwej kaplicy, mechanika „zdążyć przed końcem tury”) albo przez Donżon nocą;
  - w kaplicy strefa bez walki, skradanie wśród czujników mikroklimatu;
  - piwnice to wnętrze z walką, ale poza celami, które są pamiątką (rozdział 3).
- **Temat:** prawdziwy obraz przetrwał pod nadpisaniem, a odsłonięcie go to praca konserwatora, nie kopia. Mori mówił: „Moduł nie zostawia podpisu”. Fresk zostawia: mistrz Andrzej podpisał swoje dzieło. W chłodni Seki szuka w swoim zapisie zero podpisu, czyli śladu, którego Kagami nie umiało podrobić.
- **Zakończenia według aktu II:**
  - `street`: oryginały wracają do ludzi tak jak kopie Ume;
  - `hebi`: Hebi chcą chłodni dla siebie;
  - `kagami`: Seki ma „lustro” i porównuje je z oryginałem. Z Donżonu widać dolinę Bystrzycy, a w „lustrze” jest „kuchnia z oknem na Bystrzycę”: gracz sam sprawdza, czy taki widok jest możliwy.
- **Wątek główny:** tak, finał aktu III.

### 4.3 „Czarcia łapa” (Trybunał i Trasa Podziemna): poboczny

- **Prawdziwa cecha:** legenda o diabłach, które nocą w Trybunale wydały sprawiedliwy wyrok wdowie, gdy sędziowie byli przekupieni, i o stole z wypaloną łapą. Trasa Podziemna zaczyna się w Trybunale.
- **2077:** o północy w sali Trybunału zbiera się nielegalny „czarci trybunał”, arbiter AI, do którego idą ludzie skrzywdzeni przez Tessen i Hebi. Hideo, urzędnik Tessen, który „wpisuje kontenery, których nie ma”, chce zeznawać, ale się boi.
- **Rozgrywka:** Seki zbiera dowody (manifesty z haka infiltracji Tessen, ADR-0034), wchodzi nocą przez Trasę i loch Mei i decyduje:
  - dać arbitrowi dowody: reputacja ulicy rośnie, Tessen spada;
  - zdemaskować arbitra jako przekręt Hebi, który za wyrok bierze haracz: Hebi spadają.
- **Koszt:** mały, bo Trasa, chunk i wykop już są. Wystarczy sala w Trybunale (wycięcie bryły) i nowe postacie.
- **Wątek główny:** nie. Za to ten quest dobrze uczy wnętrz i nocnych godzin.

### 4.4 Krótko: „Oko miasta” (Wieża Trynitarska)

Wejście na taras (ok. 42 m) i zwiad: z tarasu Seki oznacza na minimapie posterunki Hebi (`hebi-bramowa`) i skrytki na dachach. Wspomnienie „dach” podpowiada trasy po dachach, co łączy się z tym, że Ume pamięta, jak Seki „biegała po dachach z chłopakiem od Hebi”. Nadaje się na aktywność powtarzalną i nagrodę za quest, a nie na wątek główny.

## 5. Proponowane kontrole skanu i zmiany importu

Kontrole pisze naprawiacz albo budowniczy (`tools/glitch-scan`).

1. **Wnętrze zabytku w obrysie:** każdy wpis `INTERIORS` z polem `building` leży w obrysie OSM z marginesem co najmniej 0,3 m (poza wyjątkami z `PASSAGES`), a jego strop leży poniżej `y + height` budynku (dla części z `soffit` poniżej okapu części). Baza: 0 (Trasa ma najmniej 1,37 m).
2. **Wejście wnętrza przy wejściu z OSM:** jeśli w obrysie albo w odległości do 5 m od niego jest węzeł `entrance=*`, wejście wnętrza leży od niego najwyżej 3 m. Inaczej trzeba mieć wpis T. Baza: 1 (Trasa: 16,3 m od n2969572858, do wyjaśnienia).
3. **Przejazd pod budynkiem bez przejścia** (do audytu bram): droga z `highway` i `tunnel=yes` albo `tunnel=building_passage`, która przecina obrys budynku, nie mając przejścia w `PASSAGES`. Baza: co najmniej 1 (Gruella pod Wieżą Trynitarską w298307007). Chodnik w586408568 pod klasztorem Dominikanów do sprawdzenia.
4. **Import:** `filterOsm` ma zachować węzły `entrance=*` i `door=*` (dziś 44 w pamięci podręcznej, 0 w wyciągach), żeby kontrola 2 miała dane.

## 6. Kandydaci na wpisy w rejestrze (do potwierdzenia w audycie bram i przy ADR)

Nie wpisane jeszcze do `docs/topografia.md` jako T-NNN, bo wymagają zrzutu albo źródła.

- Wieża Trynitarska, przejazd Gruella (587, −147): w OSM przejście pod wieżą, w grze najpewniej pełna bryła. Rodzaj: geometria (przejście). Jeśli zrzut to potwierdzi, status „do poprawy” i glitch (`passages.ts` pomija `tunnel=yes`).
- Trybunał, wejście do piwnic (573,8, −71,0): w OSM `entrance=yes` na schodach w dół przy ścianie SW, w grze wejście Trasy od NW (565,5, −57). Jeśli to wejście Trasy: odstępstwo celowe (dostęp od Rynku dla gracza) albo „do poprawy”.
- Kaplica Trójcy w66258167: wysokość z wartości domyślnej (4 kondygnacje, 17,3 m i dach 4,4 m), bez tagu w OSM. Rodzaj: wysokość. Do sprawdzenia na zdjęciach albo w dokumentacji zabytku.
- Zamek, brama w zachodnim skrzydle (852..836, 237..238): przejście 2,4 × 3,4 m z domyślnego przejazdu kamienicy. Rodzaj: geometria (przejście). Wymiary do sprawdzenia.
