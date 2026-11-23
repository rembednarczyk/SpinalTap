# Nabrzeże Bystrzycy (Doki) (`dzielnica-doki`)

Dzielnica `doki` (`DISTRICTS` w `world-map.ts`: „Nabrzeże Bystrzycy”): cztery chunki `nabrzeze-0-0`…`nabrzeze-1-1`, x 2300..2700, z 60..480, i chunk sektora W-3 Tessen (`nabrzeze-w3`, ADR-0082) nad nimi. Dolina Bystrzycy na wschodzie miasta, ok. 1,2 km od Podzamcza: rzeka z mostami Mełgiewskiej i mostem Lutosławskiego, Giełda na Kresowej, Mełgiewska, Andersa i Turystyczna, a na północnym wschodzie, przy moście Lutosławskiego, ogrodzony sektor W-3 z halą, wieżą, nabrzeżem i basenem. Z resztą miasta łączy ją tylko metro (T-022). Stan gry na `22b1808`.

## Historia
Bystrzyca płynie przez Lublin z południa na północ, a jej dolina na wschód od Starego Miasta była łąkami, młynami i przedmieściami, potem w XX wieku dzielnicą zakładów przy Mełgiewskiej, osiedli Tatar i Kalinowszczyzny, uregulowanej rzeki i bulwarów. Nad rzeką stoi neogotycki, żelbetowy most Lutosławskiego z lat 1908–1909. Na zachodnim brzegu od lat działa Giełda na Kresowej, na wschodnim stoją Dworek Grafa i dawna karczma Budzyń.

W 2077 dawne Doki Tessen (`docs/narrative/lublin-names.md`) to korporacyjny port rzeczny: magazyny, dźwig, biuro Tessen, w którym pracuje Hideo, i sektor W-3, gdzie Tessen trzyma ładunki i ludzi (ADR-0082, „Dwie drogi”). Gangów tu nie ma; policją jest ochrona Tessen (ADR-0091 §1 i §3a), która płaci za udaremnione przestępstwa. Przy kontenerze KAIUN za metrem czeka przemytnik Genzō: „Nabrzeże jest ich, Bystrzyca jest moja” (`m4-doki.ink`). Tessen Info w radiu: „Wczorajsze zamieszki przy magazynach okazały się ćwiczeniami” (`radio.ink`). W pamięci Seki jest tu rampa za magazynem, kajdanki i walizka Kagami Biotech (`m3-echo.ink`).

## Klimat
- Światło: 127 latarni drogowych (sodowe w planie ulic), 16 parkowych przy ścieżkach, światła W-3: reflektory placu i nabrzeża (`W3_FLOOD_LIGHTS` w `w3-fx.ts`), neony TESSEN (#ff5a3c) i czerwona dioda na płocie, ciepły KAIUN (#ffb000) i lampa Genzō (#ffb46a). Jeden lokal z szyldem na 28 budynków. Paleta dzielnicy (`district-palette.ts`): zimna niebieska mgła nad wodą, sodowo-pomarańczowy kontur (#ff9d42).
- Dźwięk: pejzaż W-3 (dźwig, syreny, maszyny hali, `w3-scape.ts` i `w3-sound-map.ts`), ruch na Mełgiewskiej i Andersa z trolejbusami, woda (bez emitera poza W-3).
- Zapach: muł i mokra trawa łęgu, olej napędowy, rdza kontenerów, smażenina z wózków giełdy.
- Kontrast: płot z kamerami i neonowym logo Tessen nad łęgiem, gdzie dokerzy palą przed zmianą; neogotycki most z graffiti; kontener z ludźmi za plombą „części zamienne”.
- Ruch: profil `docks` w chunku W-3 i pasa (`nabrzeze-1-1`: pełny 7:00–16:00, pusty od 20:00 do 4:00), słaby tłum na zachodzie (`street` 0,4), 56 postaci z mebli na giełdzie, Genzō i doker z treści; ochrona W-3 przychodzi ze zleceniem.

## Przeznaczenie
- Akt M4 na nabrzeżu i wycinek „Dwie drogi” (ADR-0082): zlecenia Genzō i Kaito `docks_escort` (pas publiczny), `quay_terminal` (nabrzeże W-3), `tessen_office` (biuro Tessen), `w3_hall` (sabotaż hali). Ucieczki mostem Lutosławskiego, bulwarem i metrem.
- Metro: stacja Nabrzeże Bystrzycy (`doki` A (2527; 388), na skarpie nad bulwarem przy płocie W-3, T-160); `metro_ride_4`: „Pasażerów bez przepustki Tessen prosimy o pozostanie w wagonie”.
- Pasmo trudności (`district-bands.ts`): 16–30 (jedyne pasmo z wrogami powyżej 21); hala W-3 (x 2501..2572, z 396..440) 10–30 (`BAND_AREAS`, decyzja użytkownika 15.11).
- Terytoria: brak (Nabrzeże bez gangów). Przestępstwa w toku: 7 miejsc (`MICRO_SPOTS` `doki`): trzy na pasie przy W-3 ((2540; 387), (2570; 386,5), (2478; 390,5)), Montażowa (2682; 78), Andersa (2316; 342), Łęczyńska (2520; 78), Kalinowszczyzna (2358; 444).
- Kryjówki na ciała: 2 na pasie publicznym (kontener (2530; 447,2), kontener na śmieci (2498,6; 431)), 8 szafek w hali W-3.
- Główne osie: Bystrzyca z bulwarem (z południowego zachodu na północ), Mełgiewska przez mosty na wschód, Andersa i Kalinowszczyzna na północy, Turystyczna na wschodzie.

## Topografia
- Prawdziwe miejsce: dolina Bystrzycy między Mełgiewską a mostem Lutosławskiego (Tatary, Kalinowszczyzna). Teren z NMT ok. 165,1–178,4 m n.p.m. (y −30,7..−17,4), najniżej w korycie.
- Zgodne: rzeka i brzegi, mosty, Giełda na Kresowej, Dworek Grafa i karczma Budzyń z OSM.
- Odstępstwa (wybór): luka 1180 m do Podzamcza (T-022, celowe); W-3 w miejscu łęgu (T-308, celowe, ADR-0082) i przy moście Lutosławskiego (T-309, T-310); mosty jako pomosty (T-023), bulwar przecięty (T-024); trawa na wodzie rzeki (T-295); szczegóły w karcie `nabrzeze-bystrzycy`.

## Inwentarz docelowy
Architektura:
- sektor W-3: hala, wieża przepustek, nabrzeże z pomostem, rurociąg, basen, płot z bramą (treść gry, karty `w3-*`, wnętrza `w3-hall`, `w3-basement`);
- brzegi z umocnieniami, mosty z przęsłami, bulwar (mapa, T-023);
- biuro Tessen (`docs/pomieszczenia/tessen-office.md`).
Duże obiekty:
- kontenery, dźwig, skrzynie (treść W-3), kontener KAIUN Genzō (karta `w3-pas-publiczny`);
- budy giełdy, kontenery i wózki na Kresowej (meble, T-089);
- latarnie drogowe, słupy trakcji, przystanki (meble).
Drobiazg w skupiskach:
- w hali i piwnicy W-3: drobiazg z Blendera (`hall-detail.ts`, `basement-detail.ts`);
- na giełdzie: towar i zapas (`market-goods` 20, T-106);
- pod mostami i na bulwarze: brak (dług w karcie `nabrzeze-bystrzycy`).

## Frakcja i zasady
Frakcja: korporacja, ulica (Tessen za płotem, giełda i przemyt przed nim).
- §12 zgodne: wąski pas publiczny między płotem a skarpą i brama sektora prowadzą na szeroki plac odbioru i nabrzeże; w hali ciasne rzędy, w piwnicy niski strop (karty `w3-*`). Poza W-3 dolina szeroka bez progów.
- §13 częściowo: W-3 ma swoje reflektory i neony ze źródłem, z czerwienią korporacji i ciepłem Genzō; reszta doliny świeci sodowymi latarniami, bulwar ciemny. 60-30-10 niemierzone dla dzielnicy.
- §14 częściowo: W-3 gęsty, giełda gęsta w makro, bulwar i mosty puste w mikro.
- §15 częściowo: woda rzeki i basenu z odbiciem, mokry asfalt, blacha kontenerów; trawa na części rzeki (T-295).
- §16 zgodne w W-3 (korporacja: płot, kamery, porządek) i na giełdzie (ulica); kontrast między nimi to sedno dzielnicy.
- §17 częściowo: W-3 ma pejzaż dźwiękowy ze źródeł, reszta doliny tylko ruch uliczny. Ruch: dokerzy za dnia, auta, trolejbusy.

## Spotkania
- `doki_laidoff`: pas publiczny przy płocie Tessen, za metrem (2538; 388), 5:00–11:00, Tomo (`enc_doki_laidoff`). Doker w kamizelce pali i patrzy w telefon: po dwudziestu dwóch latach algorytm uznał, że jego stanowisko „przestaje być optymalne”, ale bramka dalej go wpuszcza, więc przychodzi i pracuje za darmo. Seki może wziąć kopię jego karty, która do końca miesiąca otwiera furtkę w płocie, albo poradzić mu skargę, którą przeczyta ten sam algorytm.
- `doki_gull`: nabrzeże W-3 (2482,5; 434), 10:00–17:00, strażnik Tessen (`enc_doki_gull`). Strażnik celuje pałką w mewę z metalowym dziobem i diodą w oku, dron ptasi z zamkniętego programu odstraszania, który kradnie kanapki z tuńczykiem. Seki może ją strącić (strażnik „nie widział” jej tu) albo nakarmić, a wtedy mewa siada jej na ramieniu.
- `doki_container`: plac odbioru W-3 przy basenie (2530; 445), 22:00–4:00, bez postaci (`enc_doki_container`). Z kontenera z plombą Tessen słychać pukanie trzy krótkie, trzy długie, trzy krótkie i głos: jest ich sześcioro, nie mają już wody, pośrednik obiecał im pracę. Seki może zerwać plombę, obiecać łódź Genzō albo odejść, a pukanie słychać jeszcze aż do płotu.

## Scenariusz tła
- Kto tu bywa: dokerzy i pracownicy biura Tessen (w tym Hideo); ochrona Tessen, która płaci za udaremnione przestępstwa; przemytnik Genzō przy kontenerze KAIUN za metrem; postacie spotkań: zwolniony doker Tomo przy płocie, strażnik z mewą-dronem na nabrzeżu W-3, pukanie z kontenera na placu odbioru.
- Co się dzieje: rano Tomo pali przy płocie za metrem, a zmiana wchodzi do magazynów; w dzień dźwig pracuje nad basenem, a strażnik przegania mewę z metalowym dziobem; nocą plac odbioru W-3 cichnie, a z zaplombowanego kontenera słychać pukanie.
- Ślad obecności: niedopałki i kubek Tomo przy płocie Tessen, pióra i porwana kanapka strażnika na nabrzeżu, świeże plomby Tessen na kontenerach przy basenie.

## Dług sceny
- Patrol ochrony Tessen poza płotem (Tessen jako policja na całym Nabrzeżu, ADR-0091 §3a): postacie z planem dnia w `packages/sim/src/content/schedules.ts` i treści `packages/sim/src/content/tessen-w3/public.ts` (karta `nabrzeze-bystrzycy`).
- Emitery wody, giełdy i mostów poza W-3: `packages/engine/src/audio/spatial.ts`.
- Spotkania `doki_gull` i `doki_container` stoją za płotem W-3 (x 2477..2606, z 392..452); startują tylko bez aktywnego zlecenia i bez heat (`streetOpen` w `packages/sim/src/world/street-scenes.ts`), więc nie zderzają się z sabotażem hali. Zgodne, bez zmiany. Brakuje za to ochrony Tessen w strefie między zleceniami: strażnik z `doki_gull` pojawia się tylko na czas spotkania (`npcKey: "enc-gull-guard"`), a poza nim strefy nikt nie pilnuje (punkt pierwszy).
- Karty lokacji dzielnicy: `w3-pas-publiczny`, `w3-plac-odbioru`, `w3-nabrzeze`, `w3-wieza`, `w3-rurociag-basen`, `nabrzeze-bystrzycy`; wnętrza: `w3-hall`, `w3-basement`, `tessen-office`, `metro-doki`. Dług każdej z nich jest w jej karcie.
