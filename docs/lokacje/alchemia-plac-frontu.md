# Plac przed frontem Alchemii od Bajkowskiego (`alchemia-plac-frontu`)

Podniesiony plac przed domem z arkadami, między zielonym stokiem skrzydła zachodniego L1 a wykopem rampy P−1 (ADR-0074 etap C5, plansza `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`). Podium x 394–409,7, z −7,4…1, wierzch −0,64 (`PODIUM`, `PLAZA_TOP` w `front-plaza.ts`), schody na południe do Bajkowskiego (5 stopni, do z −8,9) i za rogiem na zachód (do 7 stopni, do x 392,2), okrągła fontanna z hologramem (399,5; −5,2), dwa kioski z jedzeniem i cztery stoliki pod parasolami (`front-plaza-cafe.ts`). To pierwszy kadr Alchemii dla kogoś, kto przychodzi od Ratusza i Placu Łokietka. Stan gry na `22b1808`.

## Historia
Do 2026 roku był tu płatny parking w173531008 (w OSM adres Przystankowa, bo tak nazywała się dawniej Bajkowskiego) z wjazdem od Bajkowskiego, a za blaszanym płotem leżała ogrodzona działka Alchemii. Miasto oddało teren w 2005 roku w użytkowanie wieczyste spółce Arkady i przez dwie dekady inwestycja stała w sporach i kolejnych wersjach planu: od galerii z parkingiem na tysiąc aut po plan z 2026 roku z food hallem pod tarasem i placem ze schodkami na wydarzenia (`docs/plany/alchemia.md`, S4, S5, S13, S14). Na północ od parkingu, przy Lubartowskiej, zaczynała się dzielnica, której mieszkańców Niemcy w 1942 roku wywieźli z getta do Bełżca (karta `alchemia-t2-arkady`). Pamięć o tym trzyma kamień na T2, 110 m dalej, a nie ten plac.

W 2077 roku plac należy do galerii inwestora: podium z kamienia, fontanna, kioski franczyzy z czerwono-bursztynowymi pasami szyldów. Ludzie z Shinsekai-7 traktują go jak salon deptaku: siedzą na obręczy fontanny, jedzą przy stolikach, umawiają się „pod hologramem”. Hologram nad wodą jest pęknięty: jeden pas obrazu ucieka w bok i nikt go nie naprawia od miesięcy (§3). Kiosk przy schodach bierze prąd z szafki ulicznej kablem przyklejonym taśmą do ściany, bo galeria nie chciała mu dać przyłącza.

Przed chwilą (§5, jest w grze): przy stoliku na wschód od fontanny ktoś zerwał się tak szybko, że krzesło leży na plecach (403,9; −7,15), a jego kubek dalej paruje. Na ladach kiosków stoją kubki z parą, a pod ladą leżą ulotki.

## Klimat
- **Światło:** pas LED w nosie krawędzi podium wzdłuż schodów południowych i zachodnich oraz nad schodami do przejścia pod L2 (droga jaśniejsza, §4); obręcz fontanny z pasem światła u stopy i cyjanowa rama hologramu; witryny z jedzeniem pod szkłem i pasy szyldów kiosków (czerwony i bursztynowy), ciepłe światło pod markizami; lampy pod parasolami stolików; front automatów z napojami przy parapecie rampy. Za plecami placu: pięć papierowych lampionów pod łukami arkad i ciepły napis ALCHEMIA, wyżej skrzynia ALCHEMIA CENTRUM HANDLOWE na L3 i różowy oraz cyjanowy holo-ekran na tarasie L2 (C4). Od ulicy jedna latarnia pastorał (383,5; −1) przy narożniku od Świętoduskiej.
- **Dźwięk (cel):** szum wody w fontannie, skwierczenie płyty w kiosku, rozmowy przy stolikach, auta skręcające z Bajkowskiego w rampę, deszcz na markizach. W grze plac nie ma własnych źródeł dźwięku (dług).
- **Zapach:** smażone z kiosków, mokry kamień, spaliny z rampy.
- **Pogoda:** plac jest odkryty, deszcz pada na podium i parasole; posadzka to farba kitu przyciemniona do mokrego kamienia planszy, bez kałuż.
- **Kontrast (§3):** pęknięty hologram w fontannie, kabel kiosku na taśmie, papierowy kubek pływający w wodzie fontanny (400,1; −5,9) przed szkłem galerii.
- **Ruch i życie:** 14 miejsc tłumu (kolejki przy kioskach, siedzący przy stolikach, jeden na obręczy fontanny, jeden przy automatach, `PLAZA_CROWD`), sprzedawcy w kioskach (postacie z gry), para nad płytami i kubkami, auta rampy obok.

## Przeznaczenie
- Plac wejściowy Alchemii od południa: stąd pod arkadami do sklepów L1 (NIGHT SILK, pasaż L1 zachód), a przejściem pod L2 na zachód od rampy i w poprzek nad zakrytą rampą przy z 12,4 do osi wejścia głównego P1 (ADR-0093 O2b).
- **Wejścia:** schody południowe z chodnika Bajkowskiego (kostka w232464426), schody zachodnie od narożnika Świętoduskiej i zielonego stoku, dwa stopnie od szczytu rampy przy parapecie (C7), schody północne w dół do przejścia pod L2 (3 stopnie, x 404–409,7).
- **Osłony:** kioski (x 387,6–390, z −7,2…−5,6 i x 381,6–383,6, z −6,4…−4,8), obręcz fontanny (0,42 m, bryła), filary arkad, automaty z napojami (409,25; −4,3 i −3,2), donica z drzewem (385,6; −7,6). Stoliki i krzesła to niskie bryły bez osłony.
- **Ucieczka:** Bajkowskiego na wschód i zachód, Świętoduska na północ, rampa P−1 w dół (ruch aut), pod arkady i do galerii.
- **Punkt widokowy:** ze szczytu schodów widać Bajkowskiego, Ratusz i Plac Łokietka na południu; z tarasu L2 nad arkadami cały plac (postacie, bez tłumu).

## Topografia
- Prawdziwe miejsce: południowa część parkingu w173531008 (Przystankowa) przy Wacława Bajkowskiego (w40052294, jednokierunkowa na wschód), dawny trawnik przy Bajkowskiego (na ortofoto 91% kostki). Teren według NMT −2,4…−1,0, spada na zachód.
- W grze: podium na płycie 0,46–1,22 m nad NMT, bez `PADS`, nic na chodniku Bajkowskiego; stopa schodów południowych 1,15–1,95 m od kostki chodnika (T-241, dopisek C5 i przegląd kuratora C5). Pas gołego gruntu przed schodami naprawiony (T-333, G-942).
- Odstępstwa celowe: cały front galerii na działce (T-327) i plac C5 według planszy (T-241). Różnice od planszy opisuje ADR-0074 C5: mniej stopni, kiosk u stopy schodów zachodnich zamiast przed schodami, stoliki na podium zamiast na wschód od rampy, automaty z gry zamiast wysokich szaf z neonem.
- Meble planu zdjęte przez bryły gry (ławki bench-west#0 i bench-south, pastorał (401,5; −2,8)): G-947.

## Inwentarz docelowy
- **Architektura:** podium z kamienia ze stopniami (jest, `front-plaza.ts`), poręcz na parapecie rampy (jest, rysunek), fontanna z obręczą i projektorem (jest), podcień domu z arkadami (karta `alchemia-dom-z-arkadami`), kratki odpływu w posadzce podium i studzienka przy kioskach (do zrobienia).
- **Duże obiekty:** dwa kioski z ladą, witryną, markizami i zapleczem (są, rysunek i bryła z pudełek), cztery stoliki z parasolami i krzesłami (są), automaty z napojami ×2, kosze ×4, ławka u stopy stoku, donice ×4 (w tym jedna na dachu kiosku), drzewo w donicy, szafka uliczna (modele gry, `FRONT_PLAZA_PROPS`).
- **Drobiazg w skupiskach (§14):** przy kioskach kubki z parą, ulotki, kartony za zapleczem (są); na stolikach kubek z parą i karton z jedzeniem co drugi (są); przewrócone krzesło (jest); do dołożenia niedopałki i puszki przy automatach i koszach, serwetki pod stolikami, monety i ulotki w wodzie fontanny (Street Asset Pack, ADR-0096).

## Frakcja i zasady
Frakcja: korporacja, ulica (plac galerii inwestora, na którym siedzi i je deptak).
- §12 zgodne: z wąskiego chodnika Bajkowskiego schody prowadzą na szeroki, podniesiony plac, a z niego pod niski podcień arkad (strop 2,3, około 2,9 m nad podium) albo w dół do przejścia pod L2. Próg zmienia wysokość i materiał (kostka ulicy, kamień podium, posadzka podcienia). Wymiary stopni według §6 (0,16 × 0,30), podium na rzucie z planszy i NMT, poza siatką 0,5 m.
- §13 częściowo: każde światło ma oprawę (pas w nosie, obręcz, witryny, lampy parasoli), droga po schodach jest jaśniejsza. Brak pomiaru 60-30-10 nocą. Akcentów jest dużo naraz (różowy i cyjanowy holo-ekran, szyldy kiosków, hologram fontanny, napis L3), do sprawdzenia, czy nie przekraczają 15%. Pomiar nocny 24.11 (22:00, ujęcie `alchemia-plac-frontu` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 42,6/54,9/2,5, za jasno, akcent poniżej 3%.
- §14 zgodne: trzy warstwy (kioski i stoliki, automaty i donice, kubki, ulotki, kartony) i skupiska przy ladach i stolikach. Do dołożenia drobiazg przy automatach i koszach.
- §15 częściowo: woda fontanny i szkło witryn dają połysk, posadzka jest ciemna jak mokry kamień, ale bez kałuż i bez wody kapiącej z markiz, choć deszcz tu pada.
- §16 zgodne: czysty kamień i franczyzowe kioski inwestora z ulicznym tłumem i prowizorycznym kablem; kontrast jest treścią placu.
- §17 częściowo: skalę dają stopnie, krzesła (0,45), lady kiosków (1,0) i obręcz (0,42). Ruch: tłum, para, auta rampy. Dźwięku ze źródła brak.

## Scenariusz tła
- Kto tu bywa: ludzie z Shinsekai-7, którzy traktują plac jak salon deptaku: siedzą na obręczy fontanny, jedzą przy stolikach kiosków, umawiają się „pod hologramem”; sprzedawcy kiosków franczyzy; klienci w drodze pod arkadami do sklepów L1 i do drzwi P1.
- Co się dzieje: w dzień kioski wydają kubki z parą, a przy stolikach zmieniają się goście z deptaku; wieczorem pęknięty hologram nad fontanną zaczyna świecić mocniej niż szyldy, a ludzie zostają dłużej na obręczy; nocą zostaje kiosk przy schodach na kablu z szafki ulicznej.
- Ślad obecności: przewrócone krzesło i parujący kubek przy stoliku na wschód od fontanny, ulotki pod ladami kiosków, kabel przyklejony taśmą do ściany przy schodach.

## Dług sceny
- Bryły donic przy filarach arkad (397,22; −2,55) i (402,92; −2,55), dziś rysowane bez bryły, a ta przy x 397,22 stoi na filarze (G-957): `planterSolids` w `packages/sim/src/content/alchemia/front-plaza-cafe.ts`, z przesunięciem donicy z filara i sprawdzeniem wyjścia z NIGHT SILK (`alchemia-front-rooms.test.ts`).
- Źródła dźwięku: woda fontanny, płyty kiosków, deszcz na markizach. Dziś `packages/engine/src/audio/room-sound-map.ts` zna tylko wnętrza, potrzebna mapa źródeł na zewnątrz (wzór `w3-sound-map.ts`) w `packages/engine/src/audio/`.
- Kałuże na podium i przy stopie schodów, woda kapiąca z krawędzi markiz (§15): kanał `wet` w `packages/engine/src/renderer/alchemia/plaza-geometry.ts`.
- Drobiazg przy automatach i koszach, monety w fontannie, kratki odpływu w podium: nowe części na końcu listy w `packages/sim/src/content/alchemia/front-plaza-cafe.ts` (bryły tylko tam, gdzie trzeba, §7), rysunek w `plaza-geometry.ts`.
- Ławki i pastorały planu zdjęte przez podium (G-947): nowe punkty na wolnej kostce albo usunięcie z planu z wpisem T, w `docs/world/lublin-props.todo.json` i imporcie mebli (`tools/osm-import`), z przeglądem `topography-curator`.
- Pomiar §13: ujęcie nocne ze szczytu schodów południowych (ok. (400; −8,5), na północ) w `tools/shots/room-spots.json` i `pnpm shots:palette`.
