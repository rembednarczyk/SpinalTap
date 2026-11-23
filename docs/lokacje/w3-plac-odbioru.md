# Plac odbioru W-3 z ogrodzeniem i bramą (`w3-plac-odbioru`)

Asfaltowe place sektora W-3 za płotem Tessen (ADR-0082): plac odbioru wzdłuż basenu (x 2500–2606, z 440–452) między rzędem N hali a nabrzeżem basenu, i plac wschodni (x 2572–2606, z 392–440) z bramą wjazdową w południowym płocie (x 2586–2596) i wrotami komory testowej. Tu o 6:00 wojsko odbiera partię dwunastu dronów, tu stoi kontener z ludźmi z `enc_doki_container` i stąd przychodzi druga fala alarmu drogi głośnej.

## Historia
W Lublinie to dno doliny Bystrzycy porośnięte łęgiem, z rowem w995914397, który płynie przez las na północ do rzeki, i ścieżką w609533494 (`docs/plany/tessen-w3-audyt.md`). W 2077 roku Tessen wyciął łęg, przykrył rów płytą, a dolinę wylał asfaltem pod place zakładu (T-002, T-308). Według karty hali W-3 to dawny zakład odzysku wody miasta, który Tessen przejął i przestawił na montaż dronów bojowych (`docs/pomieszczenia/w3-hall.md`). Produkcja płynie przez halę od śluzy wagonowej przez taśmy i komorę testową, wrotami wschodnimi na plac wschodni i na plac odbioru (ADR-0082 §2, „Przepływ”).

Plac odbioru jest miejscem, gdzie Tessen oddaje to, co zrobił: drony wojsku, a pracowników pośrednikom. W kontenerze z plombą Tessen siedzi sześcioro ludzi, którym pośrednik obiecał pracę w zakładzie („Zakład okazał się kontenerem, a praca czekaniem”, `enc_doki_container`). Doker na przerwie pali przy balustradzie basenu i nie ma nic do powiedzenia.

Przed chwilą (cel sceny, §5): ktoś zostawił na placu wózek widłowy z podniesionymi widłami i wyłączonym światłem, a przy kontenerze leży pusta butelka po wodzie.

## Klimat
- **Światło:** czerwona kabina wieży nad zachodnim końcem placu, sylwetki dronów na ramach na dachach (`w3-drones.ts`). Cztery reflektory W-3 (`W3_FLOODLIGHTS`) świecą na nabrzeże, pomost i od strony rzeki, a światła shadera to czerwień neonu nad bramą i zimny reflektor nad pomostem (`W3_FLOOD_LIGHTS`), więc plac odbioru nie ma dziś własnego źródła. Docelowo maszty z zimnym światłem nad pasami placu, ciepłe okno wartowni i światła ciężarówek przed odbiorem.
- **Dźwięk:** szum agregatów chłodzenia na dachu N i ścian zakładu (warstwa `plant`), woda w basenie (warstwa `river`), głośnik Tessen na ścianie komory (`dev:doki-speaker`). Docelowo wózek widłowy, silniki ciężarówek o 5:00, pukanie z kontenera nocą.
- **Zapach:** asfalt, olej, woda basenu.
- **Kontrast (§3):** drony warte miliony na paletach obok kontenera, w którym zabrakło wody dla sześciu osób.
- **Ruch i życie:** robotnicy na obchodzie placu wschodniego i placu odbioru (pas tłumu `doki-round`), doker na przerwie, palacze przy kontenerze (2530; 444,6) i przy wschodnim płocie (2585; 444,5), (2580; 410).

## Przeznaczenie
- **Zlecenia:** posterunki infiltracji i włamania na zachodnim końcu placu ((2506; 446), (2498,4; 444,5), (2505; 447)), druga fala sabotażu 60 s po alarmie ((2520; 446), (2530; 446), (2540; 446), twarzami do hali), strzelec na wschodnim końcu dachu N (2566; +10,4; 439,2) nad placem wschodnim.
- **Spotkanie:** `doki_container` w (2530; 445), 22:00–4:00, jednorazowo: otworzyć plombę (cywile +3, Tessen −3), zostawić Genzō (fixerzy +1) albo odejść.
- **Kryjówka na ciało:** kontener (2530; 447,2), 6 × 2,6 × 2,4 m (ADR-0065).
- **Wejścia:** brama wjazdowa x 2586–2596 (szlaban 1,1 m), furtka x 2549–2551 przez pas przy zbrojowni S, wrota wschodnie komory (x 2572, z 414–422), drzwi rzędu N, schody wieży od zachodu.
- **Osłony:** kontener, docelowo ciężarówki i palety; balustrada basenu 1,1 m.
- **Punkt widokowy:** dach rzędu N (+10,4, attyka 1,05 m nad placami) i kabina wieży, z której obserwator widzi cały plac odbioru.

## Topografia
- Prawdziwe miejsce: dno doliny Bystrzycy w łęgu w230881219, rów w995914397 (w NMT ok. 1 m głęboki), ścieżka w609533494.
- W grze: posadzka W-3 na −28,6 (`W3_Y`, NMT −0,3…+0,3), strefa w prostokątach `W3_ZONE_RECTS` od x 2515 do 2606, z 392,3–452 i pasami przy ścieżce. Basen x 2508–2592, z 452–478 z nabrzeżem na z 451,75. Płot 2,7 m od wschodu (x 2606) i od południa (z 392).
- Odstępstwa celowe: strefa na łęgu z wyciętymi drzewami i rowem pod płytą (T-002, T-308).

## Inwentarz docelowy
- **Architektura:** asfalt z żółtymi pasami ruchu i polami odkładczymi (jest asfalt), nabrzeże basenu z balustradą (jest), płot z bramą i szlabanem (jest), wartownia przy bramie (ADR-0082: x 2596–2604, z 393–399, nie ma), rampa załadunkowa przy wrotach komory, studzienki odwodnienia.
- **Duże obiekty:** kontener z plombą Tessen (jest jako bryła), trzy ciężarówki od 5:00 (nie ma), wózek widłowy, palety ze skrzyniami transportowymi dronów z szablonowymi napisami, maszty oświetleniowe nad placem (`floodlight`, model gry), parking aut pracowników na placu wschodnim (auta zaparkowane, ADR-0050).
- **Drobiazg w skupiskach (§14):**
  - kontener: pusta butelka, ślad dłoni na blasze, plomba z numerem;
  - przerwa dokera: puszka po kawie, niedopałki, rękawice na balustradzie;
  - palety: folia, taśma, listy przewozowe w koszulce, klin pod koła;
  - wartownia: kubek, monitor kamer, radio.
  Źródło: Street Asset Pack (ADR-0096), `vehicle-props`, modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: korporacja (Tessen, przemysł zbrojeniowy).
- §12 częściowo: wejście przez furtkę albo bramę to wąski próg w płocie, za nim szeroki plac. Pas między rzędem N a basenem (12 m) to ciasny odcinek przed otwarciem na plac wschodni. Prostokąty strefy leżą na siatce terenu 2,5 m.
- §13 dług: czerwień kabiny (akcent) ma oprawę, ale światła motywowanego na placu nie ma: reflektory W-3 patrzą na nabrzeże i pomost. Brak pomiaru 60-30-10 nocą. Plac potrzebuje masztów oświetleniowych i światła nawigacji przy bramie.
- §14 dług: na placach stoi kontener i jedna osoba. Brak palet, pojazdów, wózka i skupisk.
- §15 dług: asfalt matowy, brak plam oleju, kałuż i połysku mokrej nawierzchni przy basenie.
- §16 zgodne: korporacyjny plac roboczy, porządek pasów i plomb.
- §17 częściowo: agregaty, woda i głośnik mają źródła. Dług: wózek, ciężarówki, pukanie z kontenera. Skalę dają kontener i balustrada. Ruch: robotnicy na obchodzie, para z agregatów (High).

## Scenariusz

### Pierwszy kadr
Seki wchodzi na plac odbioru zza narożnika rzędu N od zachodu, spod schodów wieży. Przed nią pas asfaltu długi na 100 m między ścianą hali a balustradą basenu, ciemny poza łuną kabiny (docelowo w pasach zimnych masztów). W połowie stoi kontener z plombą, przy balustradzie pali doker. Na dachu nad nią drony na ramach patrzą nosami na rzekę, a za plecami świeci czerwona kabina wieży. Wzrok łapie kontener (największa bryła w świetle) i koniec placu przy bramie.

### Postacie i miejsca
- **Doker** (`doker`, przechodzień): (2563; 449,4), twarzą na południe, do hali, o każdej porze.
- **Robotnicy tłumu:** obchód `doki-round` (2576; 396,5) → (2602; 396,5) → (2602; 448) → (2540; 448) → (2540; 443,5) → (2576; 443,5), palacze (2530; 444,6), (2585; 444,5), (2580; 410).
- **Ludzie w kontenerze** (`doki_container`, tylko głos): (2530; 445), 22:00–4:00.
- **Załogi zleceń:** posterunki infiltracji i fal włamania na zachodnim końcu, druga fala sabotażu (2520–2540; 446), obserwator w kabinie wieży (sabotaż, przed alarmem bez strzału).

### Przebieg
1. **Droga cicha omija plac.** Obserwator w kabinie patrzy na plac odbioru i dach N (ADR-0082 §2, „Linie wzroku”). Wejście kolektorem albo rurami nie przechodzi przez plac.
2. **Noc i kontener:** pukanie (trzy krótkie, trzy długie, trzy krótkie). Decyzja moralna z reputacją, bez wpływu na sabotaż.
3. **Alarm drogi głośnej:** 3 strażników ze śluz od razu, po 60 s 3 z placu odbioru (`alarm:<id>:wave2`). Plac odbioru jest drogą fali do hali.
4. **Świt:** według ADR-0082 od 5:00 na plac zajeżdżają 3 ciężarówki i 2 dodatkowych strażników. O 6:00 partia odjeżdża, a sabotaż bez wirusa i bez wybuchu kończy się porażką `batch-shipped` („Partia odpłynęła z nabrzeża o szóstej”).
5. **Ucieczka po wybuchu:** przez plac wschodni do bramy albo przez furtkę, ponad 60 m od hali.

### Drogi
- **Cicha:** tylko po zmroku i poza polem kabiny: wzdłuż ściany rzędu N, za kontenerem. Ciało można ukryć w kontenerze.
- **Głośna:** brama wjazdowa na plac wschodni, walka między kontenerem a ścianą hali, fala z placu odbioru.
- **Ucieczka:** brama wjazdowa (szlaban), furtka na pas publiczny, schody wieży na podest i rurociąg na zachodni brzeg.
- **Pułapki:** basen ma balustradę i niewidoczną ścianę do wysokości płotu, więc nie da się uciec wodą. Kabina wieży widzi cały plac odbioru.

### Pora i stan świata
- Dzień: robotnicy (według ADR-0082 6 techników na zmianie 6:00–18:00), w nocy 3. Noc 22:00–4:00: kontener puka. 5:00: ciężarówki (w ADR, nie w grze). 6:00: odbiór partii.
- Po drodze głośnej wraki stanowisk w hali (`line-wrecks`), pościg Tessen w mieście przez 3 dni. Po cichej plac bez zmian, a drony odjeżdżają krzywo skalibrowane.
- Brak terytoriów gangów na Nabrzeżu. Pasmo doków 16–30, sam prostokąt hali 10–30.

### Wymagania wobec sceny
- Zegar świtu widoczny w świecie: ciężarówki i strażnicy od 5:00, odjazd o 6:00.
- Kontener spotkania i kontener na ciała to dziś ta sama bryła, a w środku jest sześć osób. Scena potrzebuje dwóch kontenerów albo jasnej reguły, że po otwarciu plomby kryjówka jest wolna.
- Osłony dla fali i dla gracza między kontenerem a ścianą (palety, wózek).
- Wartownia z dwoma strażnikami przy bramie (droga głośna przez bramę z ADR-0082).
- Patrol P3 (para na obwodzie, ok. 4 min pętli) z ADR-0082 §2.

## Dług sceny
- Ciężarówki i dwaj strażnicy od 5:00 (ADR-0082 §1 „Ramy”): treść z warunkiem godziny w `packages/sim/src/content/tessen-w3/` (nowy plik placu odbioru), auta jako bryły i rysunek z `vehicle-props`; posterunki na końcu listy w `posts.ts`.
- Wartownia przy bramie z dwoma strażnikami: bryła w `packages/sim/src/content/tessen-w3/quay.ts`, posterunki w `posts.ts` (nowe id na końcu, złoty hash i testy sesji W-3 świadomie).
- Patrol P3 na obwodzie strefy ((2490; 394) → (2604; 394) → (2604; 450) → (2490; 450)): trasa w `packages/sim/src/content/tessen-w3/mission.ts`, wpis w `W3_CONTRACT_POSTS.w3_hall` (`posts.ts`).
- Drugi kontener dla `doki_container` albo zasada wolnej kryjówki po otwarciu plomby: `W3_YARD_PROPS` w `public.ts` (nowa bryła na końcu), punkt spotkania w `packages/sim/src/content/encounters.ts`.
- Palety ze skrzyniami dronów, wózek widłowy, pasy na asfalcie, maszty oświetleniowe: nowy plik `packages/sim/src/content/tessen-w3/yard-dress.ts` (bryły tam, gdzie się stoi), rysunek w `packages/engine/src/renderer/tessen-w3/w3-dress.ts`.
- Plamy oleju i mokry asfalt przy basenie (§15): nawierzchnia strefy w `w3-dress.ts` albo w widoku `ground` strefy (`tessen-w3/index.ts`).
- Dźwięk wózka, ciężarówek i pukania z kontenera: emitery w `packages/engine/src/audio/w3-sound-map.ts`.
- Maszty oświetleniowe nad placem (oprawa w `w3-dress.ts`, światło shadera w `packages/engine/src/renderer/tessen-w3/w3-fx.ts`, tylko na zewnątrz, w limicie slotów świateł).
- Ink `phone_genzo_failed_shipped` w `packages/narrative/ink/{pl,en}/phone.ink`: „Partia odpłynęła z nabrzeża o szóstej” mówi o wodzie, a ADR-0082 każe wojsku odebrać partię ciężarówkami z placu odbioru. Propozycja: „Partia wyjechała z placu o szóstej”.
- Pomiar §13: ujęcie nocne z zachodniego końca placu na wschód w `tools/shots/room-spots.json`.
