# Taras T1 Alchemii z wózkiem Hany (`alchemia-t1`)

Plac na poziomie −6,4 przed północnym frontem galerii Alchemii, nad schodami na plac T2 (ADR-0074 etap 1, T-207). Hana sprzedaje tu części z ręcznego wózka i jest stałym punktem zleceń targu: odbiera dostawy Kaito (`hana_stall`) i daje własne roboty, czyli odzyskanie skrzynki od Hebi i ochronę Oyajiego (ADR-0063, ADR-0070, ADR-0093 O3).

## Historia
Teren między Lubartowską a Świętoduską był do 2026 roku ogrodzonym nieużytkiem na stanowisku archeologicznym w1559354344. Po środku działki biegł dawny wąwóz głęboki na 7–8 m. Archeolodzy znaleźli tu osadę wczesnośredniowieczną z placem pośrodku (`docs/plany/alchemia.md`, S9, S13). Przez trawę szła nieformalna ścieżka od Świętoduskiej na skos (w1269042382). Plan inwestora z 2026 roku stawia na spadku działki taras z placem przed food hallem, schodkami, siedziskami i miejscem na wydarzenia.

W 2077 roku T1 jest placem przed galerią, ale żyje targiem. Kiedy straganiarze spod wiaduktu na alei Tysiąclecia przenieśli się do Alchemii, dostali lokale w środku (Oyaji, Kenta, Goro, Fumiko na P3, Sachiko). Hana została na zewnątrz z wózkiem. Handluje częściami, „głównie takimi, które spadły z ciężarówki”, bierze od Kaito chłodzone moduły i szuka ludzi, którzy umieją strzelać, bo Hebi biorą od targu haracz i zabierają towar. Po północy Fumiko otwiera okienko swojego drugiego lokalu na P0 i karmi nocny targ na tym samym placu.

Przed chwilą (cel sceny, §5): Hana zdjęła plandekę z połowy wózka, bo przyszła dostawa. Na blacie stoi otwarta skrzynka chłodząca, a para z suchego lodu ścieka po jej boku.

## Klimat
- **Światło:** zimna lampa nad wózkiem Hany (#9ad7ff, `market.ts`), ciepłe szkło galerii za jej plecami, żółte okienko Fumiko w nocy na zachodnim końcu frontu, zielone ościeża wejścia (x 413–419). Na wschodzie świecą witryny restauracji Arkad, a w dole za balustradą schodów leży ciemny plac T2.
- **Dźwięk:** rozmowy przy wózku, okap kuchni Fumiko, kroki na schodach do T2, deptak Lubartowskiej zza krawędzi placu. W grze plac nie ma własnych źródeł (dług).
- **Zapach:** bulion tonkotsu z okienka, olej z części na wózku, mokra kostka.
- **Pogoda:** deszcz pada tu na otwarty plac. Przechodnie mają parasole (ADR-0041), Goro sprzedaje je w środku.
- **Kontrast (§3):** moduły za tysiące eddies w skrzynce chłodzącej na drewnianym wózku z plandeką.
- **Ruch i życie:** dwie osoby rozmawiają przy wózku (441; 71,5), ludzie palą pod frontem (`activity-spots.ts`: 410, 422,5 i 428,5 na z 58,55), stołki przed okienkiem Fumiko, przechodnie schodzą na T2.

## Przeznaczenie
- **Zlecenia:** dostawa od Kaito (`delivery`, limit 50, 65 albo 80 s, `deliver_contract()` u Hany), odzyskanie skrzynki z kryjówki Hebi w schronie pod T2 (`retrieve`, `hebi_stash`), ochrona Oyajiego w jego sklepie na P3 (`protect`, `raid_north` i `raid_east`, tylko 8:00–22:00). Hana zawsze bierze kurs Kaito i daje robotę także wtedy, gdy ulica boi się Seki (G-304).
- **Wejścia:** wejście do galerii (x 413–419, 6 m), drzwi wschodnie do korytarza trzonu NE (x 425,6–427,1), drzwi i okienko Fumiko (x 401–406,8), rampa zachodnia od T0 (x 394–400), schody na rampie wschodniej od T0 (x 436–442), chodnik Lubartowskiej od wschodu, schody na T2 (x 426–436, z 77,5–92,5).
- **Osłony:** wózek Hany, siedziska wzdłuż schodów na T2, narożniki frontu.
- **Punkt widokowy:** z krawędzi nad schodami widać cały plac T2, łuki Arkad i właz schronu. Hana stoi twarzą do drzwi wschodnich, którymi napad na Oyajiego wchodzi do trzonu NE.

## Topografia
- Prawdziwe miejsce: środek działki w1559354343 przy Plac Ofiar Getta, nieużytek z niecką od −2…−3 przy parkingu do −7…−9 przy Świętoduskiej (T-145). NMT w prostokącie placu −8,6…−3,7, średnio −6,96.
- W grze: T1 na −6,4 (posadzka galerii P0), x 412–443, z 56–76 z przejściem 8 m na północ i wschód, od Świętoduskiej x 408 i pas x 400 do z 62 z przejściem 2 m (T-207). Wykop do 2,62 m przy rampie wschodniej, nasyp do 2,28 m nad spadkiem do T2. Chodnik Świętoduskiej zostaje na NMT (T-209 naprawione). Rampy T0 → T1 to T-208, schody na T2 to T-219.
- Odstępstwo celowe: taras z planu inwestora (ADR-0074, T-207). Galeria na obrysie food hallu to T-329.

## Inwentarz docelowy
- **Architektura:** szklany front galerii z wejściem, drzwiami wschodnimi i okienkiem Fumiko (jest, `foodhall.ts`), balustrada nad spadkiem do T2, schody z siedziskami (są, `plaza.ts`), stopnie rampy wschodniej (są, `terrace-steps.ts`), studzienki i kratki odpływu w kostce, zadaszenie nad okienkiem Fumiko.
- **Duże obiekty:** wózek Hany jako ręczny wózek z dwoma kołami, dyszlem, blatem, plandeką na pałąkach i skrzynką chłodzącą (dziś skrzynia 0,9 × 1,0 × 1,8 m, Blender albo model gry `food-cart`); lampa na tyczce z kablem do akumulatora; stołki przed okienkiem Fumiko (są jako miejsca aktywności, bez modeli); ogródek z kilkoma stolikami przy zachodnim końcu frontu (`cafe-garden`, model gry, ADR-0074 tabela T1); ławki i kosz (`bench`, `waste-bin`).
- **Drobiazg w skupiskach (§14):**
  - wózek: skrzynki z częściami, zwój kabla, moduły w folii, taśma, kubek Hany, kartonowa tabliczka z cenami;
  - okienko Fumiko: miski, pałeczki, kubki z herbatą, serwetki, niedopałki pod stołkami;
  - pod frontem: puszki i niedopałki przy miejscach palaczy, ulotka nocnego targu.
  Źródło: Street Asset Pack (ADR-0096), modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: ulica (Hana i nocny targ przed szkłem galerii).
- §12 częściowo: zejście z T0 rampą wzdłuż ściany galerii (ciasno między ścianą a skarpą) otwiera się na szeroki plac i widok w dół na T2 (zgodne). Próg z placu do galerii zmienia światło i strop. Wymiary placu idą po siatce terenu 2,5 m (G-758), a nie po module 0,5 m.
- §13 dług: brak pomiaru 60-30-10 nocą. Światło motywowane dają szkło galerii i okienko Fumiko, akcentu poza zieloną ramą wejścia nie ma. Lampa Hany jest zimna, choć wózek to handel (§4: ciepłe to handel); jako handel techniką może zostać, do decyzji przy pomiarze.
- §14 dług: na placu jest jedna bryła z wyposażenia (skrzynia wózka) i lampa. Brak drobiazgu i skupisk.
- §15 dług: kostka matowa, bez kałuż po deszczu i bez mokrej plandeki. Połysk daje tylko szkło frontu.
- §16 zgodne: ulica przed czystą galerią, kontrast jest treścią placu.
- §17 dług: brak źródeł dźwięku (okap Fumiko, radio przy wózku). Skalę dają drzwi i schody. Ruch: tłum i palacze są, Hana stoi bez czynności.

## Scenariusz

### Pierwszy kadr
Najczęściej Seki przychodzi z dostawą od Kaito: rampą wschodnią z T0 albo chodnikiem Lubartowskiej, biegiem, z zegarem na HUD. Za narożnikiem galerii plac otwiera się na zachód. Po lewej ciągnie się świecący szklany front, pośrodku stoi wózek z zimną lampą, a przy nim kobieta twarzą do frontu. Za placem ziemia opada schodami w ciemny T2 z łukami Arkad. Wzrok łapie lampa wózka (motywowana) i zielona rama wejścia.

### Postacie i miejsca
- **Hana** (`hana`, frakcja `civilians`): (428; −6,4; 66), twarzą na południe, do drzwi wschodnich galerii (x 425,6–427,1), rozmowa w promieniu 2,4 m. Bez planu dnia: stoi przy wózku o każdej porze.
- **Wózek:** bryła (429,3; 66), lampa (429,3; 67,6).
- **Ludzie zlecenia `hana_stall`:** punkty (426,5; 66), (426,5; 67,5), (426,5; 64,5) i (425; 66) przy wózku; dostawa nikogo nie stawia.
- **Fumiko:** od 0:00 do 4:00 za okienkiem na P0 (x 401–405,6), w dzień na ostatnim stołku przed nim (`schedules.ts`, `fumiko-p0.ts`).
- **Tło:** rozmowa przy wózku (441; 71,5) i (442,2; 71,5), przechodnie przy schodach (435,5; 75,5), (439,5; 76,8 i 78), (444; 64), (445; 74,5).

### Przebieg
1. **Dostawa** (`delivery` od Kaito): zegar 50–80 s od Neon Koi. Napięcie: czas. U Hany `delivery`: „Od Kaito? Dawaj, zanim się nagrzeje”. Hana sprawdza plomby i wsuwa pudełko pod plandekę. Zapłata u Kaito (`delivered`).
2. **Odzyskanie** (`retrieve`): Hana: „Hebi zabrali mi skrzynkę z towarem”. Droga w dół schodami na T2 i do schronu (`alchemia-t2-arkady`, `alchemia-shelter`). Powrót ze skrzynką: „Plomby całe, nawet nie zajrzeli do środka”, wypłata w `payday`.
3. **Ochrona** (`protect`, 8:00–22:00): Oyaji nie zapłacił Hebi. Napad idzie trzonami galerii na P3 (z parkingu przy Świętoduskiej i od drzwi wschodnich na T1). Seki biegnie od wózka do sklepu Oyajiego. Po walce w `payday`: „Oyaji żyje. Już narzeka”.
4. **Zmiana planu** (odmiany ADR-0034): Hana dopowiada plotkę z targu (`contract_variation`).
5. **Po zleceniu:** przy przyjaznych cywilach „Ludzie z targu zaczynają o tobie mówić”. Przy wrogich Hana nie sprzeda „nawet śrubki”, ale robotę daje.

### Drogi
- **Cicha:** do wózka nie trzeba się skradać, to miejsce cywilne. Cicha droga zlecenia `retrieve` zaczyna się tu: schodami na T2, za plecami czujki Hebi, do włazu schronu, albo rampą zachodnią i przejściem P−2 do bramy schronu.
- **Głośna:** napad na Oyajiego toczy się w galerii, nie na placu. Strzały na T1 widzą cywile (heat ADR-0029).
- **Ucieczka:** wejście do galerii i winda albo schody ruchome, rampy na T0 po obu stronach, chodnik Lubartowskiej, schody na T2 i dalej na Świętoduską.
- **Skróty:** dostawa najszybciej przychodzi od Lubartowskiej rampą wschodnią (stopnie na rampie).

### Pora i stan świata
- Hana jest zawsze. Ochrona tylko 8:00–22:00 (sklep Oyajiego, `OYAJI_HOURS`), po 22:00 Hana mówi, że Oyaji już zamknął. Food hall działa 10:00–24:00, nocny targ u okienka Fumiko 0:00–4:00.
- W nocy plac żyje okienkiem Fumiko i lampą Hany, w dzień szkłem galerii i ruchem do wejścia.
- Stan cywilów zmienia powitanie Hany (`civilians_tier`, `civilians_stance`). Hebi mają terytorium `alchemia-arcades` 40 m dalej, na T2, z urazą liczoną dla dzielnicy `shinsekai-7`. Pasmo targu 10–20 (`alchemia-market`).

### Wymagania wobec sceny
- Wózek Hany w prawdziwym kształcie (§9) z miejscem na „pudełko pod plandekę” z ink: skrzynka chłodząca, plandeka.
- Wolna linia od drzwi wschodnich i od wejścia do wózka (bieg napadu i powrót gracza).
- Światło: lampa wózka jako źródło motywowane, okienko Fumiko ciepłe, zielona rama wejścia jako nawigacja.
- Dźwięk: okap Fumiko i radio przy wózku.
- Teksty Hany mają mówić o miejscach, które są: o placu przed galerią i schronie pod T2.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/alchemia/t1-dress.ts`, `tools/blender/rooms/alchemia_t1.py`, test `packages/sim/test/alchemia-t1-scene.test.ts`): wózek Hany jako ręczny wózek z kołami, dyszlem, plandeką na pałąkach i otwartą skrzynką chłodzącą (bryła zostaje, rysuje ją model), akumulator lampy; daszek, noren, lampion i menu nad okienkiem Fumiko, wyciąg kuchni z szumem (`vent`) na otwartym powietrzu, trzy stołki z naczyniami na ladzie; skupiska niedopałków i puszek przy miejscach palaczy; ogródek (`cafe-garden`) przy zachodnim końcu frontu i kosz przy drzwiach Fumiko; brzęczenie skrzynki chłodzącej (`hum`). Teksty Hany o placu i schronie poprawione w #955. Zostaje:
- Kałuże i mokra kostka po deszczu (§15): nawierzchnia placu w `packages/engine/src/renderer/alchemia/plaza-geometry.ts`.
- Radio przy wózku: nowy rodzaj dźwięku w `RoomSound` i `room-scape.ts`.
- Para z suchego lodu nad skrzynką: wylot pary (`STEAM_VENTS`) dopiero po scaleniu kolejki scen, bo kolejność wylotów wyznacza ich wygląd.
- Ogródek bez miejsc do siedzenia: miejsca dają tylko meble z importu (`seats.ts`), a ogródek sceny ich nie dostaje; przenieść do importu albo dopisać miejsca w `activity-spots.ts`.
- Pomiar §13: ujęcie `alchemia-tpp` nocą (T1 przed wejściem) w `tools/shots/room-spots.json` i `pnpm shots:palette`.
