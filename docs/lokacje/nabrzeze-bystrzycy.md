# Nabrzeże Bystrzycy poza W-3 (`nabrzeze-bystrzycy`)

Dolina Bystrzycy na wschodzie miasta (x 2300..2700, z 60..480) bez sektora W-3 Tessen (za płotem x 2477..2606, z 392..452, T-308; karty `w3-*`): rzeka z bulwarem i ścieżkami, para mostów Mełgiewskiej (w172992144 (2428; 264), w50733068 (2439; 310)) z kładkami, most inż. Mariana Lutosławskiego (w834402001, (2462; 422)), Giełda na Kresowej na zachodnim brzegu (stragany x 2302..2376, z 212..256), Dworek Grafa (w48526173, (2513,6; 177,6)), karczma Budzyń (w294483985, (2620,7; 368,2)) i ulice Mełgiewska, Andersa, Turystyczna, Grafa, Łęczyńska, Montażowa, Kresowa, Kalinowszczyzna, Towarowa. Dzielnica `doki`, chunki `nabrzeze-0-0`, `nabrzeze-1-0`, `nabrzeze-0-1`, `nabrzeze-1-1`. Stan gry na `22b1808`.

## Historia
Bystrzyca płynie przez Lublin z południa na północ, a jej dolina na wschód od Starego Miasta była przez stulecia łąkami, młynami i przedmieściami. W XX wieku rzekę uregulowano, po obu brzegach wyrosły zakłady przemysłowe przy Mełgiewskiej i osiedla Tatar i Kalinowszczyzny, a nad wodą ścieżki i bulwar. Most Lutosławskiego z lat 1908–1909, żelbetowy i neogotycki, służy dziś pieszym i rowerzystom. Na zachodnim brzegu działa Giełda na Kresowej, wielki plac z blaszanymi budami; na wschodzie stoją Dworek Grafa, dawna karczma Budzyń i przydrożna kapliczka Matki Bożej (2609,8; 308,8).

W 2077 nabrzeże należy do Tessen: magazyny, dźwig i sektor W-3 za płotem, a na reszcie doliny korporacyjna ochrona jest jedyną policją (ADR-0091: na Nabrzeżu bez gangów, Tessen jako policja). Giełda handluje tym, co spadło z kontenerów, a bulwarem chodzą dokerzy z nocnej zmiany. Przemytnik Genzō twierdzi: „Nabrzeże jest ich, Bystrzyca jest moja” (`m4-doki.ink`). Przed chwilą przy moście Mełgiewskiej ktoś zostawił na barierce wędkę z żyłką w wodzie.

## Klimat
- Światło: 127 latarni drogowych na Mełgiewskiej, Andersa, Turystycznej i Grafa (sodowe w planie ulic), 16 parkowych przy ścieżkach (część w korycie rzeki, G-835), latarnie na mostach Mełgiewskiej (T-240, G-504). Neonów prawie brak: jeden lokal (MAKOWY DONUT, (2692; 313,8)) na 28 budynków. Światła gry tylko przy W-3: KAIUN (#ffb000) i ciepła lampa przy kontenerze Genzō (2498,6; 387,2), czerwony TESSEN na płocie. Bulwar między mostami jest ciemny.
- Dźwięk: woda pod mostami, trolejbusy na Mełgiewskiej i Andersa (32 słupy trakcji), ruch aut, z W-3 dźwig i syreny (`w3-scape.ts`). Rzeka nie ma emitera.
- Zapach: mokra trawa łęgu, muł, olej z giełdy, spaliny.
- Kontrast: neogotycki most z graffiti obok płotu korporacji z kamerami; blaszane budy giełdy z wszczepami w kartonach i rzeka, w której nikt nie łowi.
- Ruch: tłum słaby (`nabrzeze-0-0` i `nabrzeze-0-1` profil `street` 0,4, `nabrzeze-1-1` profil `docks`: pełny 7:00–16:00, pusty od 20:00 do 4:00, `nabrzeze-1-0` bez tłumu), 56 postaci z mebli na giełdzie.

## Przeznaczenie
- Teren dojścia do W-3 i do Genzō (metro `doki` A (2527; 388) na skarpie nad bulwarem, karta `w3-pas-publiczny`), ucieczki z W-3 mostem Lutosławskiego i bulwarem, handel na giełdzie.
- Miejsca przestępstw w toku `doki` poza pasem W-3: (2682; 78) przy Montażowej, (2316; 342) przy Andersa, (2520; 78) przy Łęczyńskiej, (2358; 444) przy Kalinowszczyźnie (`MICRO_SPOTS`). Spotkania `doki_*` stoją przy W-3 (karta `dzielnica-doki`).
- Wejścia: tylko metrem z Podzamcza (T-022: 1180 m bez miasta); w dolinie mosty Mełgiewskiej, most Lutosławskiego, kładki, bulwar wzdłuż rzeki.
- Osłony: budy giełdy (158 straganów), 6 kontenerów (T-089, G-169), filary i przyczółki mostów, 281 drzew, 139 krzewów.
- Punkty widokowe: most Lutosławskiego (2462; 421) na zachód, na W-3 i sylwetkę Zamku (T-311); mosty Mełgiewskiej na rzekę.

## Topografia
- Prawdziwe miejsce: Bystrzyca (oś od (2360; 50) do (2500; 473)), mosty Mełgiewskiej, most Lutosławskiego, Giełda na Kresowej w231445090, Dworek Grafa, karczma Budzyń, park w154191322. Teren z NMT ok. 164,2–178,3 m n.p.m. (y −31,6..−17,5), najniżej w korycie.
- Zgodne: koryto i brzegi, mosty w miejscach z OSM, giełda z rzędami straganów (T-026), Dworek Grafa i karczma (T-029: nadbudowa karczmy do sprawdzenia).
- Odstępstwa: Nabrzeże 1180 m od Podzamcza bez zabudowy między nimi (T-022, celowe); W-3 w miejscu łęgu i drzew (T-308, celowe); mosty jako same pomosty (T-023), bulwar pod nimi przecięty (T-024), szczeliny i krawędzie pomostów (T-167, T-171, T-283, G-292); pomost mostu Lutosławskiego za nisko (T-177, G-362); trawa na wodzie rzeki (T-295, do poprawy); park bez zarośli i płotu (T-090); latarnie parkowe w korycie (G-835), latarnia i słupy trakcji w pomostach (G-361, G-504); kontenery w rzędach giełdy (G-169); topola biała (pomnik przyrody) za niska (T-214).

## Inwentarz docelowy
Architektura:
- betonowe umocnienia brzegów, rury zrzutowe, pomosty dla łodzi (plan ulic `nabrzeze.river-banks`; generator w `packages/engine/src/renderer/mapcity`);
- mosty z przęsłami, filarami i balustradami, most Lutosławskiego z neogotyckimi łukami (T-023: model do zrobienia, `tools/blender/`);
- ścieżka bulwaru z kostki i asfaltu, schody na skarpę (mapa).
Duże obiekty:
- budy giełdy z blachy, kontenery, wózki z jedzeniem (model gry `market-stall`, `container`, `food-cart`);
- koksownik i obozowisko pod przęsłem mostu Lutosławskiego, łodzie przemytników przy brzegu (Blender, nowy `tools/blender/rooms/nabrzeze.py`);
- latarnie, ławki nad rzeką, przystanki „Turystyczna – Leclerc” (model gry, meble uliczne).
Drobiazg w skupiskach:
- pod mostami: puszki, butelki, koce, kartony (generator ADR-0096 `litter`, `boxes`);
- na giełdzie: części dronów, kable, wszczepy w woreczkach (Blender `nabrzeze.py`);
- na barierkach mostów: kłódki, wędka, naklejki (model gry, naklejki).

## Frakcja i zasady
Frakcja: korporacja, ulica (Tessen nad doliną, giełda i bulwar pod nią).
- §12 częściowo: przejścia pod mostami są ciasnym odcinkiem bulwaru, po którym dolina otwiera się na rzekę; dziś przecięte (T-024). Płot W-3 jest progiem korporacji. Dolina poza tym jest szeroka i płaska.
- §13 dług: sodowe latarnie dróg, bulwar ciemny, giełda bez światła handlu; akcenty tylko przy W-3. 60-30-10 niemierzone (zrzut nocny z mostu Lutosławskiego na zachód).
- §14 częściowo: makro i mezo z mebli (158 straganów, 6 kontenerów, 281 drzew), mikro 137 naklejek i 8 graffiti, przy giełdzie 20 `market-goods`; pod mostami i nad rzeką zero drobiazgu.
- §15 częściowo: woda rzeki z odbiciem (gdzie nie przykrywa jej trawa, T-295); mokry asfalt; brak połysku blachy bud.
- §16 częściowo: korporacja widać tylko na płocie W-3; giełda i bulwar wyglądają jak każde przedmieście, bez kamer i patroli Tessen.
- §17 dług: rzeka, giełda i mosty bez dźwięku źródła (tylko W-3 ma swój pejzaż dźwiękowy). Ruch: tłum dokerów za dnia, auta, trolejbusy; skala: ławki, przystanki, stragany.

## Scenariusz tła
- Kto tu bywa: dokerzy z nocnej zmiany na bulwarze; handlarze i klienci Giełdy na Kresowej, gdzie sprzedaje się to, co spadło z kontenerów; ochrona Tessen, jedyna policja doliny; wędkarze przy mostach Mełgiewskiej; ludzie Genzō między metrem a rzeką.
- Co się dzieje: rano giełda rozkłada budy i zjeżdżają auta z towarem; w dzień ochrona Tessen obchodzi płot W-3 i most Lutosławskiego; wieczorem dokerzy wracają bulwarem do metra, a nad wodą zostają wędkarze i przemytnicy.
- Ślad obecności: wędka z żyłką w wodzie na barierce mostu Mełgiewskiej, kartony z plombami Tessen pod budami giełdy, puszki na ławkach bulwaru.

## Dług sceny
- Emiter wody pod mostami i przy wylocie kolektora, gwar giełdy: `packages/engine/src/audio/spatial.ts` (lista emiterów spoza `DISTRICT_M0_PROPS`), poziom według pory w `packages/engine/src/audio/soundscape-clock.ts`.
- Patrol ochrony Tessen na bulwarze i kamery na latarniach przy mostach (Tessen jako policja, ADR-0091 §3a): postacie z planem dnia w `packages/sim/src/content/schedules.ts` i treści `packages/sim/src/content/tessen-w3/public.ts`, kamery w `packages/sim/src/content/devices.ts`.
- Koksownik i obozowisko pod mostem Lutosławskiego, łodzie przy brzegu: modele w nowym `tools/blender/rooms/nabrzeze.py`, rekwizyty w nowym `packages/sim/src/content/nabrzeze-detail.ts`, ciepłe światło ognia jako lampa gry tamże.
- Lampy nad budami giełdy (ciepłe) i pod mostami: lampy gry w `nabrzeze-detail.ts`.
- Woda rzeki spod trawy (T-295), latarnie z koryta (G-835) i z pomostów (G-361, G-504), park z zaroślami (T-090): `tools/osm-import` według zgłoszeń, przegląd `topography-curator`.
- Mosty z przęsłami i bulwar pod nimi (T-023, T-024): model mostów w `tools/blender/` i przejścia w `packages/sim/src/content/lublin/decks.ts`.
- Zmierzyć 60-30-10 nocą z mostu Lutosławskiego i wpisać w §13 tej karty.
