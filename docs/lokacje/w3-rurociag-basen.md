# Rurociąg i basen W-3 (`w3-rurociag-basen`)

Rurociąg nad Bystrzycą z chodnikiem serwisowym na +10 (x 2442–2486, z 442–444), od drabiny na zachodnim brzegu do podestu wieży, i basen wykopany przy placu odbioru (x 2508–2592, z 452–478) z ujściem do rzeki w północno-zachodnim narożniku (ADR-0082, P8, P9). Rurociąg to cicha droga Q2 sabotażu „Odbiór partii”: dalej dachem rzędu N do włazu nad serwerownią N. Basen czeka na łodzie z wariantu B.

## Historia
W Lublinie Bystrzyca płynie tu korytem z naturalną ławą przy wschodnim brzegu, a przez łęg na wschodzie płynie na północ rów w995914397 i uchodzi do rzeki przy (2564; 500). Na zachodnim brzegu biegnie ścieżka w291214372, a koryto przecina most Lutosławskiego z 1908–1909 (`docs/plany/tessen-w3-audyt.md`, P8, P9).

W grze rurociąg należał do miejskiego zakładu odzysku wody z 2051 roku, z którego Tessen zrobił W-3 (karta `w3-hall`): wiązka rur na trzech kozłach (na zachodnim brzegu, w nurcie i na wschodnim brzegu) brała wodę z rzeki do filtrów. Dziś chłodzi agregaty na dachu rzędu N i linię montażu, a z zaworów nad rzeką co chwilę bucha para. Serwisanci wchodzą na chodnik drabiną od ścieżki na zachodnim brzegu, bo tak było szybciej niż przez bramę. Basen wykopano na miejscu dolnego biegu rowu jako przystań dla barek zakładu. Barki i molo zniknęły razem ze starymi dokami (ADR-0082 etap 1), a łodzie Genzō i pościg po Bystrzycy przyjdą z wariantem B (ADR-0082 „Na później”).

Przed chwilą (cel sceny, §5): serwisant zostawił na podeście przy drabinie klucz do zaworów i rękawicę, a na jednym z zaworów wisi świeża zawieszka z datą przeglądu.

## Klimat
- **Światło:** chodnik nie ma własnego światła: od wschodu świeci czerwona kabina wieży i reflektory podestu, od dołu odbicia neonu TESSEN na wodzie, od zachodu latarnie ścieżki. Basen jest ciemny, z odbiciem kabiny. W nocy chodnik nad rzeką to najciemniejsza droga do hali, i o to chodzi w drodze cichej.
- **Dźwięk:** rzeka pod chodnikiem i woda basenu (warstwa `river`), syk pary z zaworów nad rzeką i z agregatów na dachu N (`W3_STEAM_OUTSIDE`), wiatr, szum zakładu.
- **Zapach:** para z rur, mułowata woda, rdza.
- **Kontrast (§3):** rury zakładu, który miał dawać miastu wodę pitną, chłodzą dziś drony bojowe. Klucz i rękawica serwisanta leżą obok czujnika z diodą.
- **Ruch i życie:** para (na High), nurt rzeki, mgła nad basenem.

## Przeznaczenie
- **Cicha droga Q2 sabotażu:** ścieżka zachodniego brzegu, drabina (2444; 438,6) na podest (x 2442–2446, z 439–442), chodnik +10 na wschód (1 m szerokości, barierka od południa, wiązka rur od północy), podest wieży +10, most na dach rzędu N, 60 m dachu między pięcioma agregatami (x 2520, 2532, 2544, 2556, 2568), właz nad serwerownią N z drabiną (2569; 438). Hak `hook_sabotage_pipes` od Genzō.
- **Zagrożenia Q2** (G-908): kamera zachodnia dachu N (2530; +11,5; 440) patrzy na zachód, ku mostowi z wieży, kamera wschodnia (2556; +11,5; 440) na wschód, na właz. Obie omijają pas wzdłuż ściany hali i dach za sobą, a agregaty zasłaniają północną stronę. Obserwator w kabinie widzi dach N do x ≈ 2545. Właz jest w polu kamery wschodniej, więc najpierw `reboot_optics`.
- **Basen:** krawędź placu odbioru z balustradą 1,1 m i niewidoczną ścianą, przestrzeń widokowa i miejsce przyszłej przystani.
- **Osłony:** kozły rurociągu, wiązka rur (do +10,9), agregaty chłodzenia na dachu N (3 × 2 × 1,4 m).
- **Punkt widokowy:** z chodnika nad nurtem na południe most Lutosławskiego, na wschód brama z neonem TESSEN, na zachód zakole i sylwetka grupy zamkowej (T-311).

## Topografia
- Prawdziwe miejsce: koryto Bystrzycy (woda w949475137, NMT −30,6) z ławą przy wschodnim brzegu, zachodni brzeg ze ścieżką w291214372, rów w995914397 w łęgu.
- W grze: rurociąg x 2442–2486, z 442–444, chodnik 8,2 m nad pokładem mostu, kozły x 2444 (brzeg zachodni, +1,6, 2,7 m od ścieżki), 2465 (pal w nurcie), 2484 (ląd, 3 m od wody), drabina 1,05 m od obrysu mostu (T-310). Basen x 2508–2592, z 452–478, dno 3 m pod posadzką, woda na −2,0 względem posadzki, ujście x 2506–2534, z 464–480 wzdłuż brzegu (P9).
- Odstępstwa celowe: T-310 (rurociąg i kozioł w nurcie), T-002 (basen wykopany w łęgu, rów pod płytą), T-308 (drzewa). Woda basenu zgodna z rzeką z NMT (test P9).

## Inwentarz docelowy
- **Architektura:** chodnik z kraty stalowej (jest jako płyta), barierka (jest od południa na wschód od podestu), wiązka rur z kołnierzami i zaworami (jest jako blok), kozły (są), podest i drabina (są), nabrzeże basenu (jest), ujście basenu z umocnieniem z kamienia.
- **Duże obiekty:** zawory z kołami ręcznymi i manometrami na rurach (Blender, nowy skrypt w `tools/blender/`), skrzynki czujników z diodą, tablica ostrzegawcza Tessen u stóp drabiny, światła przeszkodowe na kozłach nad nurtem; w basenie boja, pachołki cumownicze na nabrzeżu basenu, docelowo barka albo łódź z wariantu B.
- **Drobiazg w skupiskach (§14):**
  - podest przy drabinie: klucz do zaworów, rękawica, termos serwisanta, zawieszki przeglądów;
  - stopa drabiny na brzegu: wydeptana ścieżka w trawie, niedopałki, zerwana kłódka na łańcuchu drabiny;
  - nabrzeże basenu: lina, rozbita skrzynka, plama oleju na wodzie.
  Źródło: Street Asset Pack (ADR-0096), modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: korporacja (infrastruktura Tessen); druga: ulica (rzeka Genzō i serwisanci chodzący na skróty).
- §12 zgodne: chodnik 1 m nad nurtem to najciaśniejszy odcinek wycinka na zewnątrz, po nim podest wieży i otwarty dach N. Próg chodnik i podest zmienia światło (ciemność nad rzeką na reflektory wieży). Wymiary rurociągu na siatce 0,5 m (x 2442–2486, z 442–444, +10).
- §13 częściowo: ciemność chodnika jest celowa (droga cicha), a kabina i reflektory dają światło i akcent od wschodu. Brak pomiaru 60-30-10 i światła nawigacji przy drabinie.
- §14 dług: rurociąg i basen nie mają mezo ani mikro, rury to jeden blok bez zaworów.
- §15 częściowo: woda rzeki i basenu błyszczy (widok `water`). Dług: mokra krata chodnika, plama oleju w basenie.
- §16 zgodne: korporacyjna infrastruktura nad dziką rzeką.
- §17 częściowo: rzeka i para mają źródła (`w3-sound-map.ts`, `w3-fx.ts`). Para jest tylko na High, więc na telefonie (low) chodnik nie ma ruchu. Skalę dają barierka 1,05 m i drabina.

## Scenariusz

### Pierwszy kadr
Seki przechodzi przez most Lutosławskiego na zachodni brzeg i schodzi na ścieżkę. Na wprost, metr od krawędzi mostu, stalowy kozioł z drabiną wznosi się w ciemność. Nad głową, 10 m w górze, chodnik i wiązka rur biegną nad rzeką na wschód, prosto do czarnej wieży z czerwoną kabiną. Z zaworu w połowie nurtu bucha para. Słychać rzekę i syk pary. Wzrok prowadzi kabina na końcu rurociągu: cel i zagrożenie w jednym punkcie.

### Postacie i miejsca
- Na rurociągu i przy basenie nikt nie stoi. Ludzie Q2 są dalej: obserwator w kabinie (2494,3; +24; 441), obrót 1,0 rad, okres 16 s; kamery dachu N (2530; +11,5; 440) na zachód i (2556; +11,5; 440) na wschód; patrol P2 na antresoli i P1 w hali pod dachem.
- Przy basenie od strony placu odbioru: doker na przerwie (2563; 449,4) i robotnicy na obchodzie.

### Przebieg
1. **Odprawa:** Genzō: „Albo rurociąg nad rzeką na dach rzędu N. Nad serwerownią jest właz”. Hak `hook_sabotage_pipes`.
2. **Drabina i chodnik:** 44 m chodnika, z tego ok. 25 m nad nurtem, bez osłon poza rurami. Napięcie: odsłonięcie, choć obserwator patrzy na wschód.
3. **Podest wieży:** pod kabiną, za plecami obserwatora. Most na dach N wchodzi w pole kamery zachodniej.
4. **Dach N:** pas wzdłuż ściany hali poza kamerami, agregaty jako osłony od kabiny, `reboot_optics` na kamerę wschodnią (30 s ślepoty w tej misji, decyzja z 16.11).
5. **Właz:** drabina w dół do serwerowni N, prosto do rdzenia kalibracji (karta `w3-hall`). Upload 40 s (25 s z breachem), w martwym kącie kamery serwerowni.
6. **Wyjście:** tą samą drogą albo innym wyjściem, bez alarmu, za płot. Wypłata telefonem.

### Drogi
- **Cicha:** to jest droga cicha. Wymaga wyczucia obserwatora i kamer, nie wymaga przebrania ani ICEpick.
- **Głośna:** na rurociągu nie ma walki. Alarm na dachu N zamyka serwerownie (lockdown) i zostaje zbrojownia S.
- **Ucieczka:** z dachu N mostem na podest i rurociągiem na zachodni brzeg, gdzie AI nie wchodzi po drabinie (ADR-0021). Zeskok z dachu N na plac odbioru (+10,4) kosztuje ok. 64 obrażeń przy 10 na metr ponad 4 m (`movement-system.ts`).
- **Pułapki:** z dachu nie da się zeskoczyć za płot, a z rurociągu wejść na dach hali +16 (testy ADR-0082 etap 2). Basen to ślepy zaułek: balustrada i niewidoczna ściana do wysokości płotu, dopóki nie ma pływania.

### Pora i stan świata
- Rurociąg działa o każdej porze. Obserwator i kamery dachu pilnują tylko w czasie sabotażu (od przyjęcia do 6:00). Zapis startowy wycinka zaczyna się o 21:00, więc Q2 zwykle idzie się nocą.
- W dzień chodnik widać z mostu i z obu brzegów. W nocy jest ciemny, para świeci w reflektorach wieży.
- Po drodze cichej nic się nie zmienia poza dronami, które latają krzywo. Po głośnej Tessen poluje w mieście przez 3 dni. Pasmo doków 16–30, sabotaż 10–30.

### Wymagania wobec sceny
- Rury z zaworami i kołnierzami w prawdziwym kształcie (§9), z miejscami pary zgodnymi z `W3_STEAM_OUTSIDE`.
- Ruch na low: kapanie albo migająca dioda czujnika, skoro para jest tylko na High.
- Słaba lampa nawigacji przy stopie drabiny i na podeście (zielona, mała), żeby drogę było widać bez zdradzania jej.
- Basen z rekwizytami przystani i bez barki, póki nie ma wariantu B.
- Tekst Genzō zgodny z zagrożeniami dachu N.

## Dług sceny
- Zawory, kołnierze i manometry na wiązce rur zamiast bloku: rysunek z nowego modelu w `tools/blender/` w siatce zewnętrza W-3 (`packages/engine/src/renderer/tessen-w3/w3-dress.ts`), bryła wiązki bez zmian w `packages/sim/src/content/tessen-w3/tower-pipes.ts`.
- Skupiska na podeście przy drabinie i u jej stopy, tablica ostrzegawcza: nowy plik `packages/sim/src/content/tessen-w3/pipes-dress.ts`, rysunek w `w3-dress.ts`.
- Lampa nawigacji przy drabinie i na podeście, światła przeszkodowe na kozłach: `w3-dress.ts` (oprawy), migające z zegara renderera.
- Ruch na low (dioda czujnika albo kapanie z kołnierza): `packages/engine/src/renderer/tessen-w3/w3-fx.ts` (bez cząsteczek, w siatce).
- Przystań w basenie (pachołki, boja, lina, plama oleju, ujście z kamienia): bryły na nabrzeżu basenu na końcu `quayAndPier()` w `packages/sim/src/content/tessen-w3/quay.ts`, rysunek w `w3-dress.ts`. Barka albo łódź Genzō dopiero z wariantem B.
- Mokra krata chodnika (§15): kanał `wet` stali w `packages/engine/src/renderer/tessen-w3/w3-kit.ts`.
- Ink Genzō w `packages/narrative/ink/{pl,en}/m4-doki.ink`: „Są dwa wejścia, których nikt nie pilnuje” przeczy kamerom dachu N i obserwatorowi (G-908; ADR-0082 każe poprawić to zdanie). Propozycja: „Są dwa wejścia bez strażników. Na dachu są kamery, a z wieży patrzy obserwator”.
- Pomiar §13: ujęcie nocne z podestu przy drabinie na wschód w `tools/shots/room-spots.json`.
