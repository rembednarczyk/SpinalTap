# Pas publiczny nabrzeża i kontener Genzō (`w3-pas-publiczny`)

Trawiasty pas na tarasie nad Bystrzycą, między oświetlonymi ścieżkami bulwaru a płotem sektora W-3 Tessen (ADR-0082, audyt P2). Tu wysiada się z metra Nabrzeże (`doki-A`), tu przy kontenerze KAIUN czeka przemytnik Genzō, który daje zlecenia nabrzeża i misję „Odbiór partii” (wycinek „Dwie drogi”). Stąd zaczynają się obie drogi cicha i głośna.

## Historia
Wschodni brzeg Bystrzycy w tym miejscu to w Lublinie łęg: zarośnięty las nadrzeczny (OSM natural=wood w230881219) na tarasie nad doliną, z dwiema oświetlonymi ścieżkami bulwaru (w307943890 z czerwonego asfaltu i w972606056). Ścieżki prowadzą do przyczółka mostu inż. Mariana Lutosławskiego, żelbetowego mostu z lat 1908–1909, dziś pieszo-rowerowego (T-309, `docs/plany/tessen-w3-audyt.md`). Przy pasie stał opuszczony budynek w1354195809.

W 2077 roku Tessen ogrodził dolinę pod swoje hale montażu dronów (sektor W-3, „Zakłady militarne”) i wyciął łęg za płotem (T-308). Drzewa tarasu i pasa zostały, a z nimi ścieżki bulwaru, którymi dalej chodzą biegacze i rowerzyści. Stary plac kontenerowy doków zniknął razem z magazynem, dźwigiem i molo. Genzō, przemytnik z sieci Kaito, przeniósł swoje biuro do kontenera KAIUN przy wylocie metra. „Nabrzeże jest ich, Bystrzyca jest moja”: pływa nocą, a Tessen płaci ludziom, żeby tego nie widzieli. Mika, którą miał wywieźć łodzią, czeka, aż Genzō będzie miał łódź szybszą od Tessen. Dokerów zwalnia algorytm, a bramka dalej ich wpuszcza (Tomo, `enc_doki_laidoff`).

Przed chwilą (cel sceny, §5): Genzō dolał oleju do beczki z ogniem i postawił na skrzynce termos. Przez uchylone drzwi kontenera słychać radio z prognozą mgły nad Bystrzycą.

## Klimat
- **Światło:** pomarańczowy neon KAIUN nad drzwiami kontenera (#ffb000, akcent), sodowa latarnia obok (#ffb46a, światło motywowane, „liczone przy latarni”), latarnie ścieżek bulwaru, poświata pawilonu metra. Za płotem czerwono-niebieski neon TESSEN nad bramą wagonową, czerwona kabina wieży i reflektory (`w3-dress.ts`). Docelowo ogień w beczce.
- **Dźwięk:** szum zakładu znad agregatów i ścian, brzęczenie neonu TESSEN, rzeka przy nabrzeżu, para z zaworów rurociągu (`w3-sound-map.ts`, warstwy `plant`, `sign`, `river`). Przy kontenerze docelowo radio i trzask ognia.
- **Zapach:** mgła znad rzeki, mokre liście łęgu, olej z beczki.
- **Kontrast (§3):** blaszany kontener przemytnika z ręcznie malowanym szyldem pod ogrodzeniem fabryki dronów bojowych.
- **Ruch i życie:** Genzō, palacz Tessen przy furtce wieczorem, Tomo rano, przechodnie ścieżek (docelowo), pociąg metra pod ziemią.

## Przeznaczenie
- **Zleceniodawca:** Genzō (`genzo`, frakcja `fixers`) daje infiltrację biura przepustek w wieży (`infiltrate`, `tessen_office`), włamanie do terminala na nabrzeżu (`hack`, `quay_terminal`) i raz sabotaż hali (`sabotage`, `w3_hall`). Eskorta Miki (`docks_escort`) jest wycofana do czasu łodzi (ADR-0082), ale jej miejsce i posterunki zostały w treści.
- **Przygotowanie sabotażu:** palacz przy furtce 19:00–23:00 mówi o szafce 14 (`hook_sabotage_2`), Tomo 5:00–11:00 daje kopię karty do furtki.
- **Wejścia:** metro A (2527; 388), ścieżki bulwaru od południa i od mostu Lutosławskiego (przyczółek (2484; 409) poza płotem).
- **Przejścia do strefy:** furtka serwisowa x 2549–2551 w płocie z = 392 (otwarta, decyzja użytkownika z 17.11), brama wjazdowa x 2586–2596 (szlaban 1,1 m), zejście skarpą przy z 384–392 na ławę rzeki i wylot kolektora (Q1), most na zachodni brzeg i drabina rurociągu (Q2).
- **Osłony:** kontener KAIUN, pawilon metra, drzewa tarasu, mur oporowy pod płotem.
- **Punkt widokowy:** z pasa widać furtkę, zbrojownię S za płotem (jej drzwi zewnętrzne (2552; 396) stoją 4 m za siatką) i wieżę.

## Topografia
- Prawdziwe miejsce: taras wschodniego brzegu Bystrzycy z łęgiem w230881219, ścieżki w307943890 i w972606056, łącznik w1551242473 do mostu Lutosławskiego w834402001.
- W grze: pas x 2476–2606, z 380–392 na NMT, bez `PADS` (audyt P2), metro `doki` A w (2527; 388) plecami do muru strefy (T-160), peron pod nim (T-183). Płot 2,7 m 3 m od ścieżki w972606056 (P1), z murem oporowym tam, gdzie taras stoi nad posadzką strefy (P2). Genzō w (2491; 386), kontener x 2492,5–2498,5.
- Odstępstwa celowe: strefa W-3 na łęgu (T-002, T-308), wycięty w1354195809 (P12). Drzewa tarasu i pasa zostają.

## Inwentarz docelowy
- **Architektura:** płot siatkowy 2,7 m z murem oporowym (jest, `quay.ts`), furtka i szlaban (są), ścieżki bulwaru z latarniami (z mapy), pawilon metra (jest).
- **Duże obiekty:** kontener KAIUN jako prawdziwy kontener biurowy z blachy falistej, drzwiami, oknem z kratą, klimatyzatorem i kablem do latarni (dziś bryła budynku 6 × 2,8 × 3 m ze skórką sklepu; model gry `container` albo Blender); beczka z ogniem (w komentarzu kodu jest, w grze stoi skrzynia 0,7 × 0,9 × 0,7 m); krzesło składane Genzō, stół ze skrzyń; tablica ostrzegawcza Tessen na płocie przy furtce; ławka i kosz przy wylocie metra (`bench`, `waste-bin`).
- **Drobiazg w skupiskach (§14):**
  - Genzō: termos, kubek, mapa rzeki z zaznaczonymi mieliznami, zwój liny, koło ratunkowe oparte o kontener, kanister;
  - furtka: puszka z niedopałkami palacza, zgubiona przepustka na trawie, taśma na zamku;
  - wylot metra: bilety, ulotka rekrutacyjna Tessen, kubek po kawie.
  Źródło: Street Asset Pack (ADR-0096: beczka, kartony, worki, kubki), modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: ulica (Genzō, dokerzy, metro); druga: korporacja (płot i hale Tessen tuż za siatką).
- §12 zgodne: wyjście z metra (ciasna klatka pawilonu) otwiera się na szeroki pas z widokiem na halę. Wejścia do strefy to wąskie progi: furtka 2 m, kolektor w kucaniu 1,6 m, chodnik rurociągu 1 m. Pas leży na NMT, siatka modułowa nie dotyczy.
- §13 częściowo: neon KAIUN (akcent) i latarnia sodowa (światło) przy Genzō mają oprawy w treści, neon TESSEN i reflektory za płotem dają akcent i światło od strony strefy. Brak pomiaru 60-30-10. Furtka nie ma światła nawigacji.
- §14 dług: przy kontenerze stoi jedna skrzynia. Brak mezo i mikro, brak skupisk przy Genzō i furtce.
- §15 częściowo: mokra trawa i mgła nad rzeką w opisie, połysk tylko na blasze kontenera. Dług: kałuże na ścieżkach, mokry kontener.
- §16 zgodne: prowizorka przemytnika pod korporacyjnym płotem.
- §17 częściowo: szum zakładu, neon TESSEN i rzeka mają źródła w `w3-sound-map.ts`. Dług: radio i ogień przy kontenerze, brzęczenie neonu KAIUN. Skalę dają drzwi kontenera i płot 2,7 m. Ruch: Genzō stoi bez czynności, ognia nie ma.

## Scenariusz

### Pierwszy kadr
Seki wychodzi z pawilonu metra otworem na wschód, wzdłuż muru strefy, i obraca się na zachód, w noc. Przed nią trawa pasa, po prawej siatka płotu i ściana hali, a w głębi, nad bramą wagonową od strony rzeki, łuna neonu TESSEN. Po lewej drzewa tarasu i światła bulwaru. Na końcu pasa, 36 m dalej, pomarańczowy neon KAIUN nad blaszanym kontenerem i sodowa latarnia obok. Pod nią stoi mężczyzna w kurtce i patrzy na rzekę. Słychać szum zakładu i rzekę. Wzrok przyciąga pomarańczowy akcent KAIUN po przeciwnej stronie niż czerwień Tessen.

### Postacie i miejsca
- **Genzō** (`genzo`, frakcja `fixers`): (2491; −25,66; 386), obrót −2,4 rad (twarzą na południowy zachód, ku ścieżce i rzece), rozmowa w promieniu 2,4 m. Bez planu dnia, o każdej porze. Zapis startowy wycinka stawia Seki przy nim o 21:00 z ofertą W-3 (`start-save.ts`).
- **Palacz Tessen** (technik, tylko w czasie sabotażu, `W3_SMOKER`): (2552,3; 390,4), twarzą na zachód, ku furtce, 19:00–23:00.
- **Tomo** (`enc-tomo`, `doki_laidoff`): (2538; 388), 5:00–11:00, jednorazowo.
- **Posterunki wycofanej eskorty** (`docks_escort`, tylko z alarmem): (2470; 393), (2466,5; 399), (2477; 381), (2461; 408) na ścieżce i ławie.

### Przebieg
1. **Oferta:** telefon `phone_genzo_offer` („Kontener nad Bystrzycą, jak zwykle”), jazda metrem („Pasażerów bez przepustki Tessen prosimy o pozostanie w wagonie”, `metro_ride_4`).
2. **Rozmowa** (`genzo.greeting`, `offer`): przedstawienie, wieść o Mice (`w3:escort-retired`), ostrzeżenie przy wrogim Tessen („mają tam strzelców”). Trzy zlecenia do wyboru.
3. **Odprawa sabotażu** (raz, `w3:sabotage-offered`): dwanaście dronów, odbiór o 6:00, rdzeń kalibracji w serwerowni N, dwa wejścia (kolektor do piwnicy z kombinezonami, rurociąg na dach rzędu N z włazem), kamera i patrol, zamknięcie serwerowni przy alarmie. Seki dostaje pendrive `w3_virus` i dwa haki (`hook_sabotage_culvert`, `hook_sabotage_pipes`). Termin to najbliższa 6:00 co najmniej 6 h gry dalej.
4. **Przygotowanie:** palacz przy furtce (19–23) o szafce 14. Opcjonalna infiltracja biura w wieży daje trasy patroli.
5. **Wybór drogi:** czynem, nie dialogiem (ADR-0082): upload wirusa to cicha, wzięcie ładunków albo alarm przed wgraniem to głośna.
6. **Wypłata:** infiltracja i włamanie przy kontenerze (`payday`: „Liczone przy latarni”), sabotaż telefonem (`phone_genzo_paid`, `phone_genzo_paid_loud`, `phone_genzo_failed_shipped`).

### Drogi
Dwie drogi ADR-0082 zaczynają się tutaj.
- **Cicha Q1 „kolektor”:** z pasa skarpą przy z 384–392 na naturalną ławę rzeki (x 2457–2466), do wylotu kolektora (x 2462–2472, z 405,9–408,5, T-320), 37 m w kucaniu do piwnicy magazynów, szafka 14 z kombinezonem `tessen_overalls`.
- **Cicha Q2 „rury”:** łącznikiem na most Lutosławskiego, przez most na zachodni brzeg, drabina rurociągu (2444; 438,6), chodnik +10 nad rzeką, podest wieży, dach rzędu N, właz nad serwerownią N (karta `w3-rurociag-basen`).
- **Głośna:** furtka (otwarta) i 4 m do drzwi zewnętrznych zbrojowni S (2552; 396), albo brama wjazdowa na plac wschodni. Pobranie ładunków zawsze podnosi alarm.
- **Ucieczka:** za płot i ponad 60 m od hali albo metro A. Po drodze głośnej Tessen poluje na Seki w mieście przez 3 dni gry (`tessen-hunt`). Autozapis przy wejściu do metra.
- **Pułapki:** wieczorem furtka jest w polu widzenia palacza (poza płotem nikogo nie zgłasza, ale stoi przy przejściu). ADR-0082 §2 przewiduje kamerę przy furtce, w grze jej nie ma (`devices.ts`).

### Pora i stan świata
- Genzō jest zawsze. Wieczór 19–23 to palacz przy furtce, rano 5–11 Tomo. Odbiór partii o 6:00, a od 5:00 według ADR-0082 zajeżdżają ciężarówki (w grze ich nie ma, karta `w3-plac-odbioru`).
- Przed sabotażem pas jest spokojny, Tessen nie wychodzi za płot bez zlecenia. Po drodze głośnej Tessen ≤ −60 i pościg w dzielnicach. Po cichej Tessen bez zmian.
- Nabrzeże nie ma terytoriów gangów (ADR-0091: Tessen tylko ze zleceniem). Pasmo doków 16–30, hala W-3 10–30 (`district-bands.ts`).

### Wymagania wobec sceny
- Kontener KAIUN jako kontener, z miejscem na wypłatę „przy latarni” i ogniem w beczce (światło, ruch, dźwięk).
- Furtka oświetlona w barwie nawigacji i czytelna z wylotu metra, z tablicą ostrzegawczą.
- Zejście na ławę rzeki czytelne z pasa (ścieżka wydeptana w trawie skarpy, §5: ktoś tędy chodzi).
- Drzewa łęgu zostają (audyt P13), ale nie zasłaniają linii od metra do Genzō.
- Teksty Genzō mają opisywać grę: kto pilnuje rurociągu, czy furtka ma kod, czy jest łódź.

## Dług sceny
- Kontener KAIUN jako kontener biurowy (blacha falista, drzwi, okno z kratą, klimatyzator, kabel do latarni): rysunek z modelu `container` albo z `tools/blender/`, bryła w `W3_PUBLIC_PROPS` (`packages/sim/src/content/tessen-w3/public.ts`) bez zmiany kolejności, nowe bryły na końcu.
- Beczka z ogniem w miejscu skrzyni (2492,6; 383,2): model beczki (ADR-0096, Street Asset Pack), ogień i dym jako efekt w `packages/engine/src/renderer/tessen-w3/w3-fx.ts`, ciepłe światło punktowe tamże, trzask jako emiter w `packages/engine/src/audio/w3-sound-map.ts`.
- Skupiska przy Genzō, furtce i wylocie metra: nowy plik `packages/sim/src/content/tessen-w3/public-dress.ts` (wzór `hall-detail.ts`), rysunek w `packages/engine/src/renderer/tessen-w3/w3-dress.ts`.
- Lampa nad furtką w barwie nawigacji i tablica ostrzegawcza na płocie: `quay.ts` (płot) i `w3-dress.ts` (oprawa, napis jako nazwa w teksturze jak SEKTOR W-3).
- Genzō z czynnością (pali, grzeje ręce nad beczką): plan dnia z jednym przystankiem w `packages/sim/src/content/schedules.ts`.
- Wartownia przy bramie wjazdowej z dwoma strażnikami (ADR-0082 §1 „Droga głośna” p. 1, §2 „Posterunki”): bryła w `quay.ts`, posterunki na końcu listy `W3_CONTRACT_POSTS.w3_hall` w `posts.ts` (nowe id na końcu, złoty hash i testy sesji W-3 świadomie).
- Ink Genzō w `packages/narrative/ink/{pl,en}/m4-doki.ink` (`offer`): „Są dwa wejścia, których nikt nie pilnuje” przeczy kamerom dachu N i obserwatorowi w kabinie (G-908, ADR-0082 „Etap 2 drogi cichej”: zdanie do poprawy). „Łódź nie odpływa bez powodu” mówi o łodzi, której w grze nie ma.
- Ink Tomo w `packages/narrative/ink/{pl,en}/enc-doki.ink` (`enc_doki_laidoff`): „Moja karta otwiera furtkę w płocie” daje kopię karty do furtki, która jest otwarta (decyzja z 17.11). Propozycja: karta otwiera drzwi śluzy personelu albo przyda się jako przepustka przy kierowniku zmiany.
- `contract.site.docks_escort` („od kontenera Genzō ścieżką nad rzekę”) i posterunki eskorty w `posts.ts` zostają dla zapisów, ale knoty `running` i `payday` eskorty w `m4-doki.ink` mówią o Mice na molo i Zalewie Zemborzyckim: do przeglądu, gdy wróci wariant B z łodziami.
- Pomiar §13: ujęcie nocne z wylotu metra na KAIUN i furtkę w `tools/shots/room-spots.json`.
