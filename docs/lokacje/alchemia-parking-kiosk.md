# Pasaż T0 przy windzie Alchemii (`alchemia-parking-kiosk`)

Miejsce Kurosawy z Kagami Biotech w akcie II „Lustro” (krok `overpass` zadania `m3_lustro`) i zasadzki trzech czyścicieli Kagami. Nazwa w rejestrze mówi o parkingu i kiosku windy, bo tak było w ADR-0074 etap 1. Dziś to zadaszony pasaż T0 pod L2 i L3 frontu galerii (ADR-0074 B1, T-327): między przystankiem windy na T0 (413,5; 31,4), drzwiami głównymi P1 (x 418,8–423,2 na z 32), pawilonem metra `kanal` B „Alchemia” w (428; 28) i domkiem klatki P−1. Parking leży pod spodem, jako P−1.

## Historia
Naziemny parking w173531008 przy Lubartowskiej, z alejką i wyjazdem przy przystanku Brama Krakowska 01, stał na skraju działki Alchemii przez dwie dekady sporu miasta ze spółką Arkady (`docs/plany/alchemia.md`, S4, S5). Plan inwestora z 2026 roku chowa parking pod ziemię, na dwa poziomy, w pełni zautomatyzowany i z funkcją schronu (S11–S13). W grze nad P−1 i P−2 stanął w 2077 roku front galerii od Bajkowskiego: podium L1, płyta L2 na słupach nad pasażem i L3 z neonem ALCHEMIA CENTRUM HANDLOWE (decyzja użytkownika z 19.11). Plac T0 z pergolami zniknął pod frontem (T-241, T-327). Zostały grządki przy parapetach wykopu rampy (`square.ts`) i przerywane pasy LED prowadzące od chodnika do drzwi (ADR-0093 O2b).

Kagami Biotech nagrywa ludzi i sprzedaje im wspomnienia w abonamencie („pierwsza edycja gratis”, reklama w `metro.ink`). Dwa lata temu kurierzy Hebi, Ren i Seki, wieźli dla Kagami walizkę z pięćdziesięcioma chipami. Ren zatrzymał chip Seki i resztę archiwum. Dział odzysku Kagami wystawił na niego zlecenie przez Kaito, a jego człowiek, Kurosawa, czeka dziś w pasażu przy windzie („Ich człowiek, Kurosawa, czeka dziś za Alchemią”, Kaito w `m0.ink`). Nagranie klienta, które puszcza Kaito, mówi o przekazaniu „w nocy, na placu za Alchemią, przy targu”. Kurosawa wybrał miejsce, z którego widać windę, drzwi galerii i wylot metra: każdą drogę, którą Odagiri mógłby zejść z Alchemii.

Przed chwilą (cel sceny, §5): Kurosawa odprawił ochroniarza galerii, który pytał, na kogo czeka. Na grządce przy parapecie leży niedopita kawa w białym kubku z logo Kagami.

## Klimat
- **Światło:** zimna biel pasów LED w posadzce i w podsufitce L2 (światło prowadzące O2b, oś x 419,2–422,8), zielony portal drzwi głównych (§4: wejście), ciepłe szkło sklepów P1 za drzwiami, poświata pawilonu metra B i jego szyldu. Od południa, za krawędzią L2, cyjan neonu pawilonu na rogu i sód Bajkowskiego. Kurosawa stoi w najczystszym świetle pasażu: korporacja w bieli (§16).
- **Dźwięk:** szum wentylacji z wylotu metra, silnik windy, kroki pod płytą (pogłos pod L2), przyjazd autobusu na przystanku, rozmowy przy drzwiach galerii. W grze pasaż nie ma własnych źródeł (dług).
- **Zapach:** spaliny z rampy P−1, mokry beton, perfumy z drogerii za szkłem.
- **Kontrast (§3):** czyściciele w kamizelkach Kagami i biały etui z chipem w pasażu, gdzie ludzie Hebi palą przy grządkach, a kurier Kaito wbiega z paczką do metra.
- **Ruch i życie:** przechodnie na osi, ruch aut na rampie P−1 (`parking-traffic.ts`), drzwi galerii, winda.

## Przeznaczenie
- Krok `overpass` zadania `m3_lustro`: rozmowa `kurosawa.deal` i wybór losu archiwum (`choice_archive`: „street”, „hebi”, „kagami”). Dwa pierwsze wybory podnoszą `kagami_ambush` i walkę z trzema czyścicielami, trzeci kończy akt II bez walki.
- **Wejścia:** oś wejścia głównego od chodnika Bajkowskiego (z −11,3) na północ pod L2; przejście spod arkad domu z arkadami na zachód od rampy i w poprzek nad zakrytą rampą przy z 12,4; drzwi główne P1 z galerii; winda (P−2, P0, T0, P2, P3, dach); wylot metra B; domek klatki P−1 (x 424,3–427,7, drzwi od południa na z 12,4); deptak Lubartowskiej od wschodu (dojście z 24–32 wolne od stoisk, T-157).
- **Osłony:** pawilon metra B (x 424,4–431,6, z 26,2–29,8), słupy L2 (środek x 418,6, z 11,8 i 24,5), domek klatki P−1, szyb windy, parapety wykopu rampy z grządkami.
- **Punkt widokowy:** z miejsca Kurosawy widać drzwi windy, drzwi główne i otwór metra. Z dachu pawilonu na rogu (35 m na południe) pasażu nie widać, bo zasłania go L2.

## Topografia
- Prawdziwe miejsce: parking w173531008 (Przystankowa) przy Lubartowskiej i Bajkowskiego, płot działki w783241007, stanowisko archeologiczne w1559354344 na północ od niego.
- W grze: pasaż T0 na −1,9…−2,2 (NMT bez zmian, bez `PADS`), pod płytą L2 (spód ok. 1,95, prześwit ≥ 2,9 m). P−1 pod spodem (T-236), rampa x 409,7–418,3 od Bajkowskiego (T-237), domek klatki P−1 (T-238 po O2b), pawilon metra B (T-157), front B1 (T-327).
- Odstępstwa celowe: cały front galerii na działce (T-327, decyzja użytkownika z 19.11), zniknięcie naziemnego parkingu i alejek w177513189, w173567309 (T-241).

## Inwentarz docelowy
- **Architektura:** płyta L2 na słupach z podsufitką i pasem LED (jest), parapety wykopu rampy z grządkami (są), zielony portal drzwi głównych (jest), kanał wentylacyjny metra B z kratą przy pawilonie, korytka kablowe pod L2 nad drzwiami windy (§12: linia instalacji pod stropem). Źródło: `front-*.ts`, `square.ts`, `metro-pavilion.ts`.
- **Duże obiekty:** pawilon metra B z automatem biletowym w hali (jest), szyb i drzwi windy (są), domek klatki P−1 (jest); docelowo ławka i kosz przy pawilonie metra (`bench`, `waste-bin`, modele gry), kamera galerii nad drzwiami (`cctv`), tablica kierunkowa galerii (ekran), czarna furgonetka Kagami na szczycie rampy (pojazd z `vehicle-props`, ADR-0050).
- **Drobiazg w skupiskach (§14):**
  - przy wylocie metra: bilety jednorazowe, ulotki Kagami („pierwsza edycja gratis”), guma na posadzce, kubek;
  - przy grządce Kurosawy: biały kubek z logo Kagami, chusteczka, niedopałek ochroniarza;
  - przy drzwiach windy: rozdarta taśma ostrzegawcza, odcisk mokrych butów, karton po dostawie do galerii.
  Źródło: Street Asset Pack (ADR-0096: kartony, kubki, worki), nowe modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: korporacja (Kagami Biotech na czas zadania, czysty pasaż galerii inwestora); druga: ulica (przechodnie, metro, Hebi przy grządkach).
- §12 zgodne: oś od Bajkowskiego prowadzi pod płytę L2 (ciasno, nisko), a za drzwiami głównymi otwiera się hol i atrium galerii. Próg zmienia strop (L2 nad głową) i światło (sód ulicy na biały LED). Wymiary frontu z planszy, poza siatką tam, gdzie wyznacza je rampa i obrys parkingu.
- §13 częściowo: światło prowadzące O2b (zielony portal, pasy LED) jest i ma swoje oprawy. Brak pomiaru 60-30-10 w pasażu nocą.
- §14 dług: w pasażu stoją tylko grządki i bryły architektury. Mezo i mikro po zero, brak skupiska przy wylocie metra i przy windzie.
- §15 dług: posadzka pasażu sucha i matowa (pod płytą deszcz nie pada, ale wilgoć z ulicy i kałuża przy wylocie rampy mają skąd przyjść). Szkło galerii daje połysk.
- §16 zgodne: biel Kagami i oświetlenie architektoniczne galerii odróżniają miejsce od deptaka obok.
- §17 dług: brak źródeł dźwięku (wentylacja metra, winda, pogłos). Skalę dają drzwi 4,4 m i drzwi windy 2,3 m. Ruch: auta rampy, przechodnie i drzwi; Kurosawa stoi bez czynności.

## Scenariusz

### Pierwszy kadr
Seki wchodzi od Bajkowskiego osią wejścia, między pasami LED, pod płytę L2. Na końcu osi świeci zielony portal drzwi galerii. Na lewo od portalu, 2,6 m przed szkłem, stoi mężczyzna w bieli plecami do osi i patrzy na drzwi windy po lewej (413,5; 31,4). Po prawej świeci pawilon metra B. Słychać pogłos kroków pod płytą i szum wentylacji metra. Wzrok prowadzi światło nawigacji (portal), a postać w najjaśniejszym miejscu pasażu odróżnia się od przechodniów.

### Postacie i miejsca
- **Kurosawa** (`kurosawa`, preset `fixer`, frakcja `kagami`): (418; −1,9; 29,4), twarzą do drzwi windy na T0 (413,5; 31,4), rozmowa w promieniu 2,4 m. Jest od flagi `kagami_job` do zasadzki albo do końca aktu II (`market.ts`), o każdej porze. Mówi do każdego, zanim przyjdzie jego chwila: „Czekam na kogoś. Proszę nie zasłaniać mi widoku”.
- **Czyściciele Kagami** (`kagami-cleaner-1..3`, wróg `kagami_cleaner`, tag `kagami_cleaner`): (408; 26,5), (420,5; 24) i (413; 22,5), twarzą do drzwi windy, tylko z flagą `kagami_ambush`.
- Tło: przechodnie na osi i przy metrze, auta na rampie P−1. Ren czeka na dachu pawilonu na rogu, 35 m na południe.

### Przebieg
1. **Zapowiedź** (`kaito_job`): Kaito w Neon Koi puszcza nagranie klienta i mówi, kto płaci (`kagami_job`). Wspomnienie `last_call` pokazuje, jak brzmi podłożony głos. Od tej chwili Kurosawa stoi w pasażu. Cel: „Kurosawa z Kagami czeka na placu za Alchemią, przy windzie. Zdecyduj, co stanie się z archiwum”.
2. **Rozmowa** (`kurosawa.deal`): przedstawienie („dział odzysku”), nawiązanie do decyzji u Kaito (`choice_job`) i do modułu („aya” albo „seki”). Oferta: Odagiri i archiwum za pełny zapis sprzed stołu. Pytania poboczne: ile z zapisu jest prawdziwe i kto mówił głosem Rena (`choice_voice`). Napięcie najwyższe w akcie.
3. **Decyzja:**
   - „Archiwum wraca do ludzi” albo „zostaje u Rena”: Kurosawa unosi dwa palce i odchodzi do windy, flaga `kagami_ambush`, czyściciele w pasażu. Cel: „Czyściciele Kagami atakują na placu za Alchemią. Odeprzyj ich”.
   - „Bierzcie Rena i archiwum”: chip w białym etui, `end_act2()` z zakończeniem „kagami”, Kurosawa odchodzi do windy bez walki. Zaraz potem wspomnienie `recall_mirror` („Za dobrze, jak w katalogu”).
4. **Walka:** trzech czyścicieli w zadaszonym pasażu, między pawilonem metra, słupami L2 i grządkami. Po śmierci wszystkich (`dead:kagami-cleaner-1..3`) cel: „Czyściciele Kagami leżą. Wróć do Rena na dach Alchemii”.
5. **Nagroda i wyjście:** finał na dachu pawilonu (`alchemia-pawilon-dach`). W akcie III po zakończeniu „kagami” trop prowadzi do Kurosawy na Zamku (`kurosawa-castle`), nie tutaj.

### Drogi
- **Cicha:** droga cicha nie istnieje. Rozmowa z Kurosawą kończy się walką albo zgodą. Walkę można jednak przygotować: przed rozmową zająć osłonę przy pawilonie metra albo domku klatki.
- **Głośna:** walka w pasażu. Strzały pod L2 słyszą przechodnie i świadkowie ADR-0029 (heat). Ochrona dzielnicy to Hebi (`securityAt`).
- **Ucieczka:** metro B (wejście `kanal-B`, jazda ze stacji Brama Krakowska), winda w dół do P0 albo P−2, schody P−1 w domku klatki, drzwi galerii, rampa do Bajkowskiego, deptak Lubartowskiej. 35 m na południe jest drabina na dach pawilonu, pod którą pościg staje (ADR-0021).
- **Skróty i pułapki:** czyściciele wychodzą z miejsc 3–7 m od Kurosawy, więc kto rozmawia z nim na środku pasażu, zaczyna walkę bez osłony. Ruch aut na rampie pod spodem nie dotyczy pasażu.

### Pora i stan świata
- Kurosawa nie ma planu dnia: jest od `kagami_job` do zasadzki albo zakończenia aktu, w dzień i w nocy. Ink mówi o nocy („przekazanie w nocy”, „zdejmą go z dachu jeszcze tej nocy”), a galeria ma godziny 10–24 (food hall).
- Przed `kagami_job` pasaż żyje sam: przechodnie, metro, auta P−1. Po zakończeniu aktu II Kurosawy i czyścicieli nie ma. Ciała czyścicieli zostają jak ciała z flagami `dead:`.
- Frakcje: Kagami pojawia się tylko w tym zadaniu. Pasmo targu 10–20 z obszaru `alchemia-car-park`. Terytoria ADR-0091 nie sięgają pasażu.

### Wymagania wobec sceny
- Geometria: osłony w zasięgu każdego z trzech miejsc czyścicieli i wolna oś wejścia (4 m) mimo nich. Kurosawa nie może stać w osi.
- Wejście czyścicieli: ink mówi „od strony szybu idą ludzie w kamizelkach Kagami”, więc mają wyjść z drzwi windy i z domku klatki P−1, a nie pojawić się 3 m od Seki.
- Odejście Kurosawy: ink mówi „odchodzi w stronę windy”, gra usuwa go w kroku, w którym rośnie flaga.
- Światło: zimne pasy LED jako światło motywowane, zielony portal i szyld metra jako akcenty.
- Dźwięk: wentylacja metra, winda, pogłos pod płytą.
- Wygląd: Kurosawa i czyściciele w barwach Kagami (biel, chip w białym etui), odróżnialni od fixera i od ochrony galerii.
- Pomiar: ujęcie nocne z osi wejścia na drzwi główne w `tools/shots/room-spots.json`.

## Dług sceny
Zrobione 23.11: teksty celu, ink i `docs/narrative/lublin-names.md` mówią o pasażu pod frontem (#955), nazwa w rejestrze „Pasaż T0 przy windzie Alchemii (Kurosawa)”, id bez zmian. Zostaje:
- Wejście czyścicieli z drzwi windy (413,5; 31,4) i z drzwi domku klatki P−1 (426; 12,4) zamiast z miejsc tuż przy Kurosawie: `CLEANER_SPOTS` w `packages/sim/src/content/alchemia/market.ts` (zmiana pozycji rusza testy sesji aktu II w `packages/app/test`, więc osobna gałąź).
- Kurosawa idzie do windy po decyzji, zamiast znikać w kroku flagi: krótka trasa do drzwi windy w planie dnia (`packages/sim/src/content/schedules.ts`) albo obsługa wyjścia postaci z `when` w `sim` (dziś byt z `when` znika od razu).
- Wygląd Kagami: osobny wygląd Kurosawy i czyściciela zamiast presetu `fixer` (`market.ts`, obsada w `packages/sim/src/content/cast.ts`), biały etui jako rekwizyt w rozmowie.
- Skupiska drobiazgu przy wylocie metra, przy grządce Kurosawy i przy drzwiach windy: nowy plik w `packages/sim/src/content/alchemia/` (wzór `roof-dress.ts`), rysunek w `packages/engine/src/renderer/alchemia/`.
- Ławka i kosz przy pawilonie metra, kamera galerii nad drzwiami, tablica kierunkowa: meble z `StreetPropKind` w treści frontu (`front-dress.ts`).
- Furgonetka Kagami na szczycie rampy, z flagą `kagami_job`: auto zaparkowane w `packages/sim/src/content/parked-cars.ts` z warunkiem obecności.
- Dźwięk wentylacji metra, windy i pogłosu pod L2: emitery w `packages/engine/src/audio/` (mapa źródeł na zewnątrz, jak `w3-sound-map.ts`).
- Pomiar §13: ujęcie nocne z osi wejścia w `tools/shots/room-spots.json`.
