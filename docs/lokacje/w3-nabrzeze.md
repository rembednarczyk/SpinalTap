# Nabrzeże i pomost W-3 z terminalem (`w3-nabrzeze`)

Pas nabrzeża za płotem Tessen nad Bystrzycą (x 2477–2487,5, z 418,5–440), pomost na palach w nurcie (x 2466–2477, z 426–438) z wozem opancerzonym i terminal Tessen przy pomoście w (2484; 430), miejsce zlecenia włamania `quay_terminal` (ADR-0024, ADR-0082). Nad nabrzeżem stoi brama wagonowa hali z neonem TESSEN, a od południa most Lutosławskiego.

## Historia
W Lublinie brzeg Bystrzycy w tym miejscu jest ziemny i zadrzewiony: woda sięga x 2472,5–2474,5, dalej leży naturalna ława −1,1…−1,5 i dno doliny. Kilka metrów na południe przechodzi nad rzeką most inż. Mariana Lutosławskiego z lat 1908–1909, żelbetowy, dziś pieszo-rowerowy (audyt W-3, T-309). Nabrzeża ani pomostu tu nie ma.

W 2077 roku Tessen obudował brzeg ścianą nabrzeża na długości 21,5 m i wbił w nurt pomost na czterech palach, żeby przyjmować dostawy wodą i trzymać przy wodzie wóz opancerzony. Brama wagonowa hali patrzy prosto na rzekę, z neonem TESSEN czytanym z mostu i z drugiego brzegu, z napisami ZAKŁADY MILITARNE, SEKTOR W-3 i ŚCIŚLE TAJNE na ścianie śluz. Na nabrzeżu stoi terminal sieci Tessen, przez który zakład przepuszcza łodzie. Genzō płaci za to, żeby ktoś go złamał: „Przez tydzień moje łodzie będą dla Tessen niewidzialne”. Za dnia strażnik Tessen toczy tu wojnę z cybernetyczną mewą z zamkniętego programu odstraszania, która kradnie kanapki z tuńczykiem (`enc_doki_gull`).

Przed chwilą (cel sceny, §5): strażnik rzucił w mewę pałką i ta leży na pomoście przy wozie, a na balustradzie zostało pół kanapki w folii.

## Klimat
- **Światło:** zimny reflektor nad pomostem (światło shadera z `W3_FLOOD_LIGHTS`) i dwa reflektory na podeście wieży nad nabrzeżem i pomostem (`W3_FLOODLIGHTS`), czerwono-niebieski neon TESSEN nad bramą (TESS czerwone, EN niebieskie, akcent i światło shadera), lampy pod nadprożem bramy i żółto-czarne pasy na jej skrzydle, czerwona kabina wieży nad głową. Woda odbija neon.
- **Dźwięk:** Bystrzyca wzdłuż nabrzeża (warstwa `river`), brzęczenie neonu (`sign`), szum zakładu zza bramy (`plant`), para z zaworów rurociągu 12 m na północ.
- **Zapach:** mułowata woda, olej napędowy z wozu, mokry beton.
- **Pogoda:** mgła nad rzeką gęstnieje w nocy („Mgła znad rzeki dzisiaj gęsta. Dobra noc na robotę”, Genzō).
- **Kontrast (§3):** terminal z czytnikiem kart i opancerzony wóz na pomoście, na którym kradnie mewa z diodą w oku.
- **Ruch i życie:** strażnik z mewą w dzień, pracownik z telefonem przy wieży (2484; 436), para z rur, odbicia neonu na wodzie.

## Przeznaczenie
- **Zlecenie `hack` Genzō:** podłączenie do terminalu (2484; 430) zaczyna włamanie, podnosi alarm i budzi falę 3–5 strażników, w niej zawsze strzelca na dachu rzędu N (2500,7; +10,4; 434). Połączenie liczy się w promieniu 4 m na tym samym poziomie, 40 s do końca, 15 s z rzędu poza zasięgiem to porażka `connection-lost` (ADR-0024).
- **Trening drogi głośnej** wycinka (ADR-0082 §1 „Zlecenia doków”): fala, strzelec z laserem, osłony.
- **Posterunki infiltracji** biura w wieży stoją też tutaj: (2492; 428) i (2482; 428,5).
- **Wejścia:** z placu odbioru i przerwy przy ścianie hali (x 2487,5–2500), schodami wieży z podestu +10 (stopa przy z 434–436), z rurociągu przez podest wieży. Od mostu nie: płot 2,7 m na północnej krawędzi pokładu i niewidoczna ściana pomostu (T-309).
- **Osłony:** wóz opancerzony na pomoście (2470,5; 435,7), schody wieży, śmietnik przy zachodniej ścianie hali (2498,6; 431, też kryjówka na ciało), narożnik śluz.
- **Punkt widokowy:** z pomostu (2470; 430) na zachód: zakole Bystrzycy i sylwetka Zamku z Donżonem (T-311, na medium i high).

## Topografia
- Prawdziwe miejsce: wschodni brzeg Bystrzycy przy moście Lutosławskiego w834402001, woda w949475137, ława −1,1…−1,5 przy z 418–439.
- W grze: nabrzeże x 2480–2487,5, z 418,5–440 na posadzce W-3, ściana x 2477–2480 od ławy do posadzki (ok. 1,3 m, P4), pomost x 2466–2477, z 426–438 na palach x 2468 i 2472,5, z 428 i 436, poziom posadzki, 1,8 m pod pokładem mostu (T-310). Woda na −2,0 względem posadzki (−30,6, P9). Balustrada 1,1 m i niewidoczna ściana nad wodą do wysokości płotu, dopóki nie ma pływania.
- Odstępstwa celowe: T-002 (strefa W-3), T-309 (płot na pokładzie mostu z 1908), T-310 (pomost i kozioł w nurcie), T-311 (sylwetki panoramy).

## Inwentarz docelowy
- **Architektura:** ściana nabrzeża z betonu z odbojnicami i drabinką do wody, pomost z płyty na palach (jest), balustrady (są), nadproże bramy wagonowej z lampami i pasami (jest, `w3-dress.ts`), kanał kablowy od terminalu do ściany śluz.
- **Duże obiekty:** terminal Tessen na cokole z daszkiem (jest jako punkt zlecenia, docelowo model), wóz opancerzony z oznaczeniami Tessen (dziś skrzynia ze skórką furgonetki 5,4 × 2,4 × 2,4 m, docelowo `vehicle-props`), pachołki cumownicze, koło ratunkowe w skrzynce, kamera nabrzeża na narożniku wieży (`dev:doki-quay-cam`, jest), automat z napojami przy wieży (`dev:doki-vending`, jest).
- **Drobiazg w skupiskach (§14):**
  - terminal: taśma na obudowie, karta serwisowa w szczelinie, ślady butów w błocie;
  - wojna z mewą: folia po kanapce na balustradzie, pałka strażnika, pióra i śrubka z dzioba mewy;
  - pomost: zwój liny, kanister, plama oleju pod wozem.
  Źródło: Street Asset Pack (ADR-0096), `vehicle-props`, modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: korporacja (Tessen); druga: technika (terminal, kamery, sieć zakładu).
- §12 częściowo: wejście przerwą 12,5 m między nabrzeżem a ścianą hali albo schodami wieży (1,8 m) to ciasny próg przed otwarciem na rzekę i pomost. Prostokąty idą po siatce terenu (ściana nabrzeża do linii siatki x 2480).
- §13 częściowo: reflektory (światło) i neon TESSEN (akcent) mają oprawy i dwa światła shadera. Brak pomiaru 60-30-10. Terminal nie ma światła odróżniającego go od tła (§13, kontrast funkcjonalny).
- §14 dług: na nabrzeżu stoi wóz i śmietnik. Brak mezo i mikro, brak skupisk.
- §15 częściowo: woda w grze błyszczy (widok `water`). Dług: mokry beton nabrzeża i plama oleju pod wozem.
- §16 zgodne: korporacyjny brzeg z zbrojnym wozem i plombowaną bramą.
- §17 zgodne: rzeka, neon i szum zakładu mają źródła w `w3-sound-map.ts`. Skalę dają balustrada 1,1 m i brama 8 × 7 m. Ruch: para z rur (High), odbicia na wodzie, ludzie przy wieży.

## Scenariusz

### Pierwszy kadr
Seki wychodzi zza narożnika śluz hali w przerwie przy ścianie, od strony placu odbioru, twarzą na zachód. Na prawo brama wagonowa z neonem TESSEN i pasami, na lewo czarna wieża z czerwoną kabiną. Przed nią beton nabrzeża, terminal przy balustradzie, a za nim pomost z wozem opancerzonym nad czarną wodą. Dalej mgła i drugi brzeg. Wzrok łapie neon i reflektor nad pomostem, a terminal ginie w tle (dług).

### Postacie i miejsca
- **Terminal `quay_terminal`:** (2484; 0; 430).
- **Fala włamania** (z alarmem): (2498,4; 444,5) na zachodnim końcu placu odbioru, strzelec na dachu rzędu N przy zachodniej attyce (2500,7; +10,4; 434), (2497; 420) w przerwie przy bramie, (2505; 447) na placu odbioru, (2494; 412,5) w przerwie od południa.
- **Strażnik i mewa** (`enc-gull-guard`, `doki_gull`): (2482,5; 434), 10:00–17:00, jednorazowo.
- **Tło:** pracownik z tłumu przy wieży (2484; 436), rozmawia albo telefonuje. Kamera nabrzeża na narożniku wieży (2485,7; +3; 437) patrzy na zachód nad pomost.

### Przebieg
1. **Zlecenie:** Genzō: „Podłączysz się i musisz przy nim wytrzymać, aż skończy”. Haki strzelca z dachu (`hook_hack_1`, `hook_hack_2`).
2. **Podłączenie:** interakcja przy terminalu, alarm, zegar 40 s na HUD. Napięcie od pierwszej sekundy.
3. **Fala:** strażnicy z placu odbioru i obu przerw przy hali. Strzelec z dachu N celuje laserem 1,4 s przed strzałem („Czerwony laser znaczy, że masz sekundę na osłonę”). Gdy Seki podejdzie na 14 m, strzelec zmienia stanowisko.
4. **Decyzja:** trzymać się 4 m od terminalu za osłoną (śmietnik, narożnik, schody wieży) albo oczyścić falę i wrócić przed upływem 15 s.
5. **Nagroda:** „Terminal złamany. Przez tydzień moje łodzie będą dla Tessen niewidzialne”. Wypłata przy kontenerze KAIUN.
6. **Za dnia, bez zlecenia:** mewa i strażnik. Strzelić (Tessen +2), nakarmić mewę (siada na ramieniu) albo zapytać o jej kontrakt.

### Drogi
- **Cicha:** włamanie zawsze podnosi alarm. Cicho można tylko dojść: od rurociągu przez podest wieży i schody na południowej ścianie, z dala od kamery nabrzeża, która patrzy na pomost.
- **Głośna:** obrona terminalu. Osłony: schody wieży (ok. 4,9 m od terminalu, tuż poza zasięgiem 4 m), śmietnik i narożnik śluz od strony placu, wóz na pomoście (14,6 m).
- **Ucieczka:** przerwą przy hali na plac odbioru i do furtki, schodami wieży na podest i rurociągiem na zachodni brzeg (bez pościgu po drabinie rurociągu, ADR-0021).
- **Pułapki:** strzelec na dachu N widzi nabrzeże z góry nad attyką 1,05 m. Woda i most są zamknięte płotem i niewidoczną ścianą.

### Pora i stan świata
- Terminal jest dostępny o każdej porze, ze zleceniem. Mewa 10–17. W nocy reflektory i mgła.
- Po złamaniu terminalu nic się w świecie nie zmienia (łodzi nie ma). Po porażce Tessen nie zmienia postawy wobec Seki, fixerzy −3 (ADR-0024).
- Brak terytoriów gangów. Nabrzeże w paśmie doków 16–30 (strzelec na zachodniej attyce dachu N też, `BAND_AREAS`).

### Wymagania wobec sceny
- Terminal czytelny z daleka: ekran, daszek, światło w barwie technicznej.
- Osłona w promieniu 4 m od terminalu z każdej strony fali i od dachu N (dziś najbliższe są schody wieży ok. 4,9 m od terminalu, a śmietnik i wóz ok. 14,6 m).
- Hak `hook_hack_2` ma wskazywać prawdziwy martwy kąt strzelca na dachu N.
- Ludzie fali wchodzą z miejsc, których gracz nie widzi z terminalu, ale słyszy (kroki, głośnik).

## Dług sceny
- Osłona przy terminalu w promieniu 4 m (skrzynia kablowa albo betonowa zapora z ADR-0096 Street Asset Pack): bryła na końcu `quayAndPier()` w `packages/sim/src/content/tessen-w3/quay.ts`, z testem linii wzroku od strzelca na dachu N.
- Terminal jako model z ekranem i światłem: rysunek w `packages/engine/src/renderer/tessen-w3/w3-dress.ts`, światło ekranu w `w3-fx.ts` (bez nowego wywołania).
- Wóz opancerzony jako pojazd z oznaczeniami Tessen zamiast skrzyni ze skórką furgonetki: rysunek z `vehicle-props`, bryła w `quay.ts` bez zmian.
- Pachołki cumownicze, odbojnice, drabinka do wody, koło ratunkowe, skupiska przy terminalu i wozie: nowy plik `packages/sim/src/content/tessen-w3/quay-dress.ts`, rysunek w `w3-dress.ts`.
- Mokry beton i plama oleju pod wozem (§15): nawierzchnia nabrzeża w `w3-dress.ts`.
- Hak `hook_hack_1` w `packages/narrative/ink/{pl,en}/hooks.ink` mówi o „strzelcu na dachu magazynu”, a `hook_hack_2` o martwym polu „pod wysięgnikiem dźwigu”. Magazynu i dźwigu nie ma od ADR-0082 etap 1, a strzelec stoi na dachu rzędu N. Propozycja: „na dachu hali nad nabrzeżem” i martwe pole za narożnikiem śluz pod attyką, sprawdzone testem linii wzroku.
- Genzō w `packages/narrative/ink/{pl,en}/m4-doki.ink` (`offer`, włamanie): „na podeście wieży siedzi strzelec”, a fala włamania stawia strzelca na dachu rzędu N (`W3_CONTRACT_POSTS.quay_terminal` w `posts.ts`). Albo zmienić tekst, albo stanowisko na podest (2486,9; +10; 436,9), które już jest w `SNIPER_PERCHES`.
- Pomiar §13: ujęcie z pomostu (2470; 430) nocą na bramę w `tools/shots/room-spots.json`.
