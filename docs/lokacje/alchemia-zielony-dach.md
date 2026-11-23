# Zielony dach Alchemii (`alchemia-zielony-dach`)

Dach galerii na poziomie 10,7 (dach L3 frontu), w balustradzie x 399,9–436,1, z 32,5–58,1 (`ROOF_INNER`), wokół otwartego do nieba atrium x 411–425, z 40–50 (ADR-0093 O4, `roof-plan.ts`, `roof-garden.ts`, `roof-dress.ts`). Pierścień ścieżek z płyt, 11 grządek, trzy pergole z rubinowymi lampionami, cztery drzewa z gry, a we wschodniej części technika dachu obok dzikiego ogródka mieszkańców. Jest najwyższym miejscem Alchemii, do którego gracz dochodzi pieszo. Stan gry na `22b1808`.

## Historia
Pod dachem leży działka w1559354343, przez lata ogrodzony nieużytek na stanowisku archeologicznym w1559354344 z osadą wczesnośredniowieczną wokół centralnego placu i dawnym wąwozem głębokim na 7–8 m (`docs/plany/alchemia.md`, S9, S13). Plan inwestora z 2026 roku daje kompleksowi zielony plac i tarasy, a plansza użytkownika (`docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`) zielony dach z otworem nad dziedzińcem. Zielony dach był w grze najpierw na dachu hali food hallu (etap 7, T-242), a od etapu O4 jest na dachu galerii (T-329).

W 2077 roku dach jest ogrodem galerii z pergolami i lampionami chōchin (decyzja użytkownika z 19.11: „nasze pergole z lampionami i ławki”). Wschodnią część zajmuje technika: agregat z wentylatorami i czerwoną lampką awarii (x 432,3–435,8, z 33,0–35,6), rzędy paneli słonecznych, maszt z anteną talerzową i czerwonym światłem (434,8; 48,3). Między nimi mieszkańcy kamienic przy Lubartowskiej założyli bez pytania ogródek: 16 drewnianych skrzynek z sałatą, pomidorami na tyczkach i rozsadą, sznur z praniem, krzesło turystyczne i radio. Ogrodniczka stoi przy skrzynkach z ręką na biodrze (431,45; 41,7). Ochrona galerii udaje, że tego nie widzi, bo kable paneli i tak idą przez ogródek, oklejone taśmą, do domku trzonu NE (§3).

Przed chwilą (§5, jest w grze): przy krześle dymi papieros w popielniczce i paruje kubek, na stole piknikowym pod pergolą zachodnią leży otwarte pudełko z jedzeniem i telefon z zapalonym ekranem, a konewka leży przewrócona w kałuży.

## Klimat
- **Światło:** 44 rubinowe lampiony chōchin pod krokwiami trzech pergoli (dół 1,95 m nad dachem), sześć latarni parkowych przy ścieżkach (`ROOF_LAMPS`), zielony pas LED pod obrzeżem podniesionych grządek wzdłuż dróg (§4: zielone to drogi), czerwone światło masztu i czerwona lampka agregatu, ekran telefonu na stole, dioda radia. Z dołu przez otwór atrium bije sód galerii i cyjan pasów pod płytami (`alchemia-lights.ts`). Za balustradą od południa holo-ekrany i napis L3, od wschodu neony deptaku.
- **Dźwięk (cel):** wentylatory agregatu, radio przy krześle, gwar food hallu z otworu atrium, deszcz na pergolach i liściach, sieć i ulica Lubartowskiej w dole. W grze dach nie ma własnych źródeł (dług).
- **Zapach:** mokra ziemia z grządek, pomidory, papierosy, smażone z food hallu przez otwór atrium.
- **Pogoda:** dach otwarty, deszcz pada na wszystko poza podłogą pod gęstymi krokwiami; kałuża przy konewce.
- **Kontrast (§3):** panele i maszt galerii obok skrzynek z warzywami i prania na sznurku; kable na taśmie przez ogródek.
- **Ruch i życie:** tłum na ławkach trzech pergoli i dwie osoby oparte o balustradę atrium (418; 50,62) i (425,62; 45) (`ROOF_CROWD`), trzy postacie stałe (dwie na ławkach, ogrodniczka), wentylatory agregatu, pranie, ruch w atrium w dole.

## Przeznaczenie
- Odpoczynek i widok, droga między trzonami i windami galerii, wyjście na dach L3 frontu (przerwa w balustradzie x 420,2–423,2, ADR-0093 O5), punkt ucieczki i obserwacji przy pościgu (pościgi z dachu do hali w testach).
- **Wejścia:** domek trzonu SW (drzwi w północnej ścianie, z 38,1), domek trzonu NE (drzwi od zachodu, z 55,5–57,0), kiosk windy hali (bramka od północy, z 34,9), kiosk windy NE (bramka od południa, z 51,8), przejście na dach L3 od południa.
- **Osłony:** podniesione grządki (0,55 m), słupy pergoli, agregat z kanałem, regały paneli, maszt, domki trzonów, kioski wind, pnie drzew.
- **Ucieczka:** dwa trzony i dwie windy w dół, dach L3 i jego taras. Do atrium nie da się zeskoczyć, balustrada jest cała.
- **Punkt widokowy:** z balustrady dachu widać deptak Lubartowskiej, plac T2 z Arkadami na północy i dachy Starego Miasta; przez otwór atrium wszystkie kondygnacje galerii. Narożnik NE (x ≥ 435, z ≥ 57) zostaje pusty, bo tamtędy biegną linie widzenia na kościół św. Józefa.

## Topografia
- Prawdziwe miejsce: środek działki w1559354343 (`landuse=brownfield`, `proposed:landuse=retail`) na stanowisku w1559354344; teren pod dachem według NMT −6,9…−2,1.
- W grze: dach galerii na 10,7, ok. 17 m nad posadzką P0 i chodnikiem Świętoduskiej, pergole i krokwie z pnączami do 13,5, maszt z lampą do 13,45, drzewa do y 18,04 (kontrole `alchemia-mall-height`, `alchemia-mall-footprint`, `alchemia-roof-model-height`); T-329, T-242 (zastąpione).
- Odstępstwa celowe: galeria na obrysie food hallu (T-329), zielony dach według planszy (O4). Różnice od planszy (ADR-0093 O4): agregat i panele zamiast świetlika i szarego budynku technicznego, pergole i lampiony z decyzji użytkownika, drzewa z gry ok. 6 m zamiast 3–4 m, bez grządek w narożniku NE. Przesłanianie kościoła św. Józefa przez bryły Alchemii 87 z 358 oczu (24,3% przy progu 25%).

## Inwentarz docelowy
- **Architektura:** płyty ścieżek w przewiązce, co trzydziesta ciemniejsza i co pięćdziesiątej brak (jest), balustrady dachu i atrium (są), domki trzonów i kioski wind (są), grządki z obrzeżem i substratem (są), pergole z ciemnego drewna (są).
- **Duże obiekty:** 4 drzewa, 20 krzewów, 9 ławek, 6 latarni parkowych, 2 donice, szafka techniczna (modele gry, `ALCHEMIA_ROOF_PROPS`); stół piknikowy, agregat, panele, maszt, 16 skrzynek z warzywami, słupki prania, krzesło (`roof-dress.ts`); do zrobienia mały plac zabaw z planu inwestora.
- **Drobiazg w skupiskach (§14):** przy krześle popielniczka z papierosem, kubek, radio, puszki, wiadro, worek ziemi; na stole pudełko z jedzeniem i telefon; konewka w kałuży; pranie (są). Do dołożenia niedopałki i puszki przy balustradzie atrium, gdzie stoją palący.

## Frakcja i zasady
Frakcja: korporacja, ulica (ogród galerii i dziki ogródek mieszkańców przy jej technice).
- §12 zgodne: wąskie klatki trzonów i kabiny wind (ciasno) otwierają się na niebo i otwór atrium (otwarcie w górę i w dół). Próg z domku trzonu na dach zmienia światło, strop i materiał podłogi. Plan dachu w metrach świata z planszy i obrysu, ścieżki 2,4 m i szersze.
- §13 częściowo: wszystkie światła mają oprawę (lampiony, latarnie, pas LED w obrzeżu, światło masztu). Drogi są zielone. Brak pomiaru 60-30-10 nocą; czerwone lampiony w dużej liczbie mogą przekroczyć 15% akcentów.
- §14 zgodne: trzy warstwy w obu częściach dachu i skupiska przy krześle, stole i skrzynkach.
- §15 zgodne: kałuża pod konewką, szkło paneli, mokre liście obok matowego drewna i betonu obrzeży.
- §16 zgodne: uporządkowany ogród inwestora z prowizorką mieszkańców; kontrast jest treścią dachu.
- §17 częściowo: skalę dają ławki, stół, drzwi trzonów, balustrada 1,1 m. Ruch: tłum, pranie, wentylatory, papieros. Dźwięku ze źródła brak, choć na dachu stoi radio z zapaloną diodą.

## Dług sceny
- Dźwięk ze źródeł: radio przy krześle jako głośnik stacji (dziś `packages/engine/src/audio/radio-speakers.ts` zna tylko szyldy lokali), wentylatory agregatu, gwar food hallu z atrium: mapa źródeł na zewnątrz w `packages/engine/src/audio/`.
- Plac zabaw z planu inwestora (S13), którego nie ma w żadnej części Alchemii: mały placyk (piaskownica w grządce niskiej, huśtawka) na trawniku `w-lawn` albo `e-meadow` w `packages/sim/src/content/alchemia/roof-plan.ts`, z dala od pierścienia i dróg NPC (`alchemia-roof.test.ts`), z przeglądem `topography-curator` (wysokość brył do 13,5).
- Drzewa dachu ok. 6 m zamiast 3–4 m z planszy, bo model gry nie schodzi poniżej rozmiaru 0,7: mniejszy wariant w modelu drzewa (`measuredTreeVariant` w `packages/core/src/world/trees.ts` i `packages/engine/src/renderer/mapcity/tree-plan.ts`), nie nowe pudełka (§8).
- Drobiazg przy balustradzie atrium (palący): części w `packages/sim/src/content/alchemia/roof-dress.ts`, na końcu listy.
- Zapis: gracz zapisany na dachu przed O4 w miejscu grządki wczyta się w niej (otwarte po O4); wypchnięcie z bryły jak G-485 w `packages/persistence` albo przy wczytaniu w `packages/sim`.
- Czas klatki na telefonie odniesienia na dachu niezmierzony (otwarte po O4).
- Pomiar §13: ujęcie nocne z pergoli zachodniej na atrium (ok. (404; 52)) w `tools/shots/room-spots.json`.
