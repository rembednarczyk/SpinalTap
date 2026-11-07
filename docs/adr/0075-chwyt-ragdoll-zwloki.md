# ADR-0075: Chwyt z wyborem, animacje obezwładnienia, ragdoll i zwłoki

Status: Zaakceptowany (7.11, decyzje użytkownika w sekcji „Decyzje użytkownika (7.11)”). Wynika z prośby użytkownika z 7.11 (backlog, sekcja „Następne”, „Obezwładnienie, prośba użytkownika 7.11”). Rozszerza ADR-0065 (obezwładnienie) i zastępuje jego regułę „przytrzymanie ataku zabija”. Stan kodu: `origin/main` 4cad348 (zapis v33), PR #356 (G-449, pozy ogłuszenia i niesienia w rendererze) i PR #357 (Alchemia etap 2, zapis v34) otwarte.

## Kontekst
Użytkownik (7.11):
1. udane skradanie ma się kończyć chwytem postaci, a w chwycie gracz wybiera: ogłuszyć albo zabić, jak w Cyberpunku 2077. Dziś zabija tylko atak przytrzymany przez ponad połowę obezwładnienia (`run.held * 2 > run.steps` w `takedown-system.ts`), a podpowiedź mówi o tym małym drugim napisem. Gracz tego nie odkrył;
2. animacje chwytu, duszenia, zabicia i odłożenia ciała;
3. ragdoll dla każdej śmierci postaci (strzał, broń biała, obezwładnienie, upadek z wysokości, eksplozja), z impulsem z kierunku i siły trafienia. Tylko postacie, bez przedmiotów i otoczenia. Działa w rendererze, bez wpływu na symulację i złote hashe. Po upadku symulacja przyjmuje miejsce ciała, żeby niesienie i znalezienie zgadzało się z obrazem. Na telefonie liczy się kilka świeżych ciał naraz;
4. zwłoki zostają dłużej: dziś renderer chowa je pod ziemię po `DEATH_FALL` 0,65 s i `DEATH_LINGER` 5,5 s (`character-animation.ts`).

**Jak jest dziś:**
- obezwładnienie (ADR-0065) to jedna faza `TAKEDOWN_TIME` = 1,2 s (Quick Takedown skraca ją do 0,72 s). Komenda `takedown { lethal }` przychodzi z `TakedownController` zawsze z `lethal: false`, więc wariant zabicia daje tylko przytrzymany atak;
- świadków ocenia koniec obezwładnienia (`noteViolence` i `seenCommitting` w kroku, w którym cel pada); trzymany w chwycie świadek nie dzwoni (`incapacitated`);
- zwłoki w symulacji zostają tylko po zabiciu w obezwładnieniu i po zastrzeleniu ogłuszonego (`corpseOf`, ADR-0065 etap 3). Zwykła śmierć usuwa byt (`death-system`), a renderer odgrywa upadek na odłączonym rigu (`CharacterDeaths`) i po 0,65 + 5,5 + 1,2 s go zwalnia;
- renderer nie rysuje chwytu: obie postacie stoją. PR #356 dodaje pozy ogłuszenia, leżenia i niesienia (`knockout-pose.ts`) jako cele stawów riga, z myślą o ragdollu. Niesionego rozpoznaje po miejscu postaci śledzonej, bo widok nie mówi, kto niesie;
- glitche do objęcia: G-457 (zwłoki na podniesionym terenie skaczą na y≈0, bo `animateDeath` ustawia wysokość w układzie świata), G-458 (leżące ciało rysowane na 1,7 m wchodzi głową w ścianę, a kolizja to małe koło), G-459 (pistolet w dłoni przy niesieniu).

## Decyzja

### 1. Kontrakt
- Komenda `takedown { lethal?: boolean }`: bez `lethal` chwyta cel i czeka na wybór; z `lethal` wybór jest od razu (testy, debug, przyszłe ustawienie domyślnego wariantu).
- Nowa komenda `takedown-choose { lethal: boolean }`: wybór w chwycie. Odrzucana bez chwytu czekającego na wybór.
- `TakedownStarted { target, duration, window }`: `window` to czas na wybór (0, gdy komenda już wybrała), `duration` to długość zakończenia po wyborze.
- Nowe zdarzenie `TakedownChosen { target, lethal, timedOut }`: początek zakończenia; renderer i dźwięk wybierają po nim animację duszenia albo zabicia.
- `TakedownDone` i `TakedownBroken` bez zmian.
- Etap 3: `Transform` widoku dostaje `carriedBy?: EntityId` (port renderera), żeby renderer nie zgadywał niosącego. Etap 4: komenda `settle-body { body, position, yaw }` (pkt 4).
- Etap 4: `DamageDealt` dostaje opcjonalne `dir?: Vec3` (kierunek trafienia, długość = siła impulsu w umownych jednostkach), a eksplozja i upadek z wysokości wysyłają ją tak samo. Obecne `at` zostaje.

### 2. Chwyt w symulacji (etap 1)
- **Wejście:** te same warunki co w ADR-0065 (zasięg 1,6 m, stożek za plecami, ogłuszony parowaniem albo nieświadomy, linia wzroku). Klawisz interakcji na podpowiedzi „Chwyć” (`prompt.takedown`) wysyła `takedown` bez `lethal`.
- **Czas na decyzję:** `GRAB_TIME` = 3 s. Gracz i cel stoją jak dziś (`playerHeld`, `hold`). Podpowiedź w chwycie (`prompt.grab`) ma dwie akcje: klawisz interakcji „Ogłusz” i atak „Zabij” (`prompt.grab.kill`). Zakończenie trwa `TAKEDOWN_TIME` × Quick Takedown, czyli perk skraca zakończenie, a okno wyboru zostaje.
- **Brak wyboru:** po 3 s chwyt kończy się ogłuszeniem (`TakedownChosen { timedOut: true }`), zgodnie z domyślnym wariantem bez zabijania z ADR-0065. Przytrzymany atak nic już nie wybiera; zabija tylko świeże naciśnięcie w chwycie.
- **Przerwanie:** obrażenie gracza w chwycie albo w zakończeniu przerywa jak dziś (`TakedownBroken { damage }`, cel zaalarmowany ze znaną pozycją gracza); zniknięcie celu to `gone`.
- **Alarm i świadkowie:** bez zmian względem ADR-0065 etap 2: przestępstwo i `witnessed` ocenia koniec zakończenia, gdy cel pada, tymi samymi predykatami (kamera, patrol ochrony, cywil, który zadzwoni). Zabicie dokłada zabójstwo przy śmierci. Trzymany w chwycie nie dzwoni i nie widzi. Uzbrojony NPC, który zobaczy gracza w chwycie, reaguje zwykłą percepcją (ADR-0029), a jego strzał przerywa chwyt. Dłuższy chwyt zwiększa więc szansę, że ktoś nadejdzie, i to jest koszt namysłu.
- **Klawiatura i pad:** wybór wysyła aplikacja (`TakedownController`) z klatki wejścia: `interact` (krawędź) w chwycie to ogłuszenie, krawędź `fire` (mysz, spust pada) to zabicie. Pad nie potrzebuje zmian w `engine/input`, bo jego przyciski już dają `interact` i `fire`.
- **Dotyk:** przycisk „Użyj” w chwycie nazywa ogłuszenie, a przycisk strzału dostaje pod kropką napis akcji („Zabij”, etykieta dostępności „Atak: Zabij”). Bez nowego przycisku na ekranie.
- **Zapis:** chwyt jest przejściowy jak obezwładnienie dziś; zapis i autozapis czekają na jego koniec (G-253). Schemat bez zmian.
- **Determinizm:** bez losowania; złote hashe bez zmian, bo scenariusz determinizmu nie obezwładnia.

### 3. Animacje (etap 2, renderer)
- Klipy proceduralne na rigu postaci jak w `knockout-pose.ts` (cele stawów, bez nowych plików modeli): chwyt (ramię na szyi od tyłu, cel przyciągnięty do 0,45 m przed graczem), duszenie (1,2 s, cel osuwa się na kolana), zabicie (krótkie pchnięcie albo skręt, cel wiotczeje), odłożenie ciała (z ramienia na ziemię przed graczem, z kierunkiem od ściany, G-458).
- Renderer czyta fazę z widoku: `Transform` dostaje `grab?: "hold" | "choke" | "kill"` u celu i u gracza (etap 2, zmiana portu). Zdarzenia służą tylko dźwiękowi.
- Pistolet chowa się na czas chwytu i niesienia (G-459). W FPP widać ręce na szyi celu w pierwszej osobie.

### 4. Ragdoll (etapy 4–5, renderer)
- **Własny lekki ragdoll na verletach** w `packages/engine/src/renderer/ragdoll/` za fasadą `BabylonRenderer`: 14 cząstek (głowa, szyja, miednica, klatka, barki, łokcie, dłonie, biodra, kolana, stopy), ok. 26 więzów odległości (kości i usztywnienia), proste ograniczenia kątów w kolanach i łokciach, ziemia z próbkowania terenu NMT (G-457: wysokość z terenu, nie y = 0) i ściany z prostokątów kolizji, które renderer już ma dla chunku. Cząstki sterują kośćmi istniejącego riga, więc bez nowych siatek i materiałów.
- **Silnik fizyki odrzucony:** Havok (wasm ok. 2 MB) i Ammo.js (ok. 1,5 MB) dokładają pobranie i inicjalizację na telefonie, a do kilku ciał na raz wystarcza 14 cząstek. Ragdoll nie dotyka przedmiotów ani otoczenia, więc pełna fizyka brył nie jest potrzebna.
- **Pomiar kosztu** (mikropomiar w Node, 14 cząstek, 26 więzów, ziemia i 4 ściany, krok 1/60 s, maszyna CI pod obciążeniem, load 14): 9,5 µs na ciało i krok przy 4 iteracjach więzów, 13,6 µs przy 8. Sześć ciał to ok. 5 ms obliczeń na sekundę gry na komputerze. Na telefonie przyjmujemy do 5× wolniej, czyli ok. 70 µs na ciało i krok.
- **Budżet:** wywołania rysowania i aktywne siatki bez zmian (te same siatki rigów). Aktywne ragdolle: 3 na telefonie, 6 na komputerze. Nowe ciało ponad limit zamraża najstarsze w obecnej pozie. Ciało zasypia, gdy cząstki stoją (prędkość poniżej 2 cm/s przez 0,5 s) albo po 3 s. Pomiar etapu 4 dokłada ślad czasu klatki z `npr-perf` (raport) i bramkę wywołań rysowania.
- **Impuls:** z `DamageDealt.dir` i strefy trafienia (głowa, tułów, nogi); upadek z wysokości dziedziczy prędkość z widoku (`air`), eksplozja pcha od środka. Śmierć w obezwładnieniu startuje z pozy końca animacji zabicia.
- **Miejsce ciała w symulacji:** po zaśnięciu ragdolla aplikacja wysyła `settle-body { body, position, yaw }` dla zwłok, które są bytem symulacji. Symulacja przyjmuje je tylko do 1,5 m od miejsca śmierci, na terenie, do którego gracz ma dostęp, i poza ścianą; inaczej zostaje miejsce śmierci. Komenda trafia do nagrania jak każda inna, więc powtórka jest deterministyczna, a sesje bez renderera (testy, złote hashe) jej nie wysyłają.
- Ragdoll zastępuje pozy osunięcia i leżenia z PR #356. Pozy niesienia i wstawania zostają animacjami.

### 5. Zwłoki (etap 3)
- Renderer trzyma upadłe rigi, dopóki gracz jest bliżej niż 40 m, z limitem 12 najbliższych ciał (6 na telefonie). Ciało znika tylko poza kadrem (sprawdzenie frustum kamery): najpierw najdalsze ponad limit, potem każde dalsze niż 40 m. Zanurzanie pod ziemię zostaje tylko dla ciał w kadrze po 60 s, gdy limit jest przekroczony (rzadkie, np. masowa strzelanina).
- Zwłoki z obezwładnienia i zastrzelonego ogłuszonego są dalej bytami symulacji (ADR-0065) i rysuje je ten sam mechanizm. Zwykła śmierć zostaje obrazem bez bytu (decyzja 3).
- G-457 zamyka etap 3 (wysokość ciała z terenu pod nim), a G-458 etap 2 (kierunek odłożenia).

### 6. Zapis
- Etapy 1–3: bez zmiany schematu. Chwyt jest przejściowy, a zwłoki w rendererze nie trafiają do zapisu.
- Etap 4 (`settle-body`): miejsce zwłok zapisuje się już dziś w ciele (`BodySnapshot` z pozycją bytu), więc bez zmiany schematu.
- Zwłoki jako byt po każdej śmierci odpadły (decyzja 3), więc żaden etap nie zmienia schematu zapisu ani złotych hashy.

## Etapy (osobne PR-y)
1. **Chwyt z wyborem w symulacji i UI** (ten PR): kontrakt (`takedown { lethal? }`, `takedown-choose`, `TakedownStarted.window`, `TakedownChosen`), faza chwytu i zakończenia w `takedown-system`, podpowiedź z dwiema akcjami (klawiatura, pad, dotyk), teksty en/pl, testy symulacji i sesji bez renderera. Renderer bez zmian: postacie stoją w chwycie jak dotąd.
2. **Animacje chwytu, duszenia, zabicia i odłożenia** (renderer, pole `grab` w widoku), chowanie broni (G-459), kierunek odłożenia (G-458), migawka NPR.
3. **Polityka zwłok** w rendererze (pole `carriedBy`, limity, znikanie poza kadrem), G-457.
4. **Ragdoll** dla śmierci z obezwładnienia i dla zwłok z bytem, `DamageDealt.dir`, `settle-body`, pomiar na telefonie.
5. **Ragdoll dla każdej śmierci** (strzał, broń biała, upadek, eksplozja), limity na telefonie, budżety w `npr-perf`.

## Decyzje użytkownika (7.11)
1. Brak wyboru w 3 s kończy chwyt ogłuszeniem (wariant a).
2. Świadek ocenia koniec obezwładnienia, jak w ADR-0065; sam chwyt nie jest jeszcze napaścią (wariant a).
3. W symulacji zwłoki zostają tylko po obezwładnieniu i po zastrzeleniu ogłuszonego. Każda inna śmierć to obraz z ragdollem w rendererze, bez zmiany zapisu i złotych hashy (wariant a).
5. Zwłoki leżą w promieniu 40 m od gracza, najwyżej 12 (6 na telefonie), i znikają tylko poza kadrem (wariant a).

## Pytania otwarte
4. Czy zabicie w chwycie ma być krótsze od duszenia? (a) oba 1,2 s; (b) zabicie 0,8 s, duszenie 1,2 s; (c) inne liczby. Bez odpowiedzi z 7.11: obowiązuje (a), jak w etapie 1.

## Konsekwencje
- Wybór jest jawny i widoczny w podpowiedzi, a przytrzymanie ataku przestaje cokolwiek znaczyć. Obezwładnienie trwa dłużej o czas decyzji, więc skradanie ma więcej napięcia, a ochrona więcej czasu na nadejście.
- Testy ADR-0065, które zabijały przytrzymaniem ataku, przechodzą na `takedown-choose`; testy sesji wciskają klawisz interakcji drugi raz albo czekają na koniec okna.
- Ragdoll i zwłoki zostają w rendererze, więc symulacja i złote hashe nie zmieniają się (decyzja 3). Jedyny przepływ z renderera do symulacji to komenda `settle-body`, ograniczona regułami symulacji i nagrywana jak wejście.
- Własny ragdoll to kod do utrzymania (ok. 300 linii w kilku plikach) bez zależności i bez kosztu pobrania.

## Wdrożenie
- **Etap 1** (gałąź `feat/chwyt-etap1`):
  - `core`: `takedown { lethal? }`, `takedown-choose { lethal }`, `TakedownStarted { target, duration, window }`, `TakedownChosen { target, lethal, timedOut }`;
  - `sim`: `TakedownRun` z fazą `grab | finish`, `GRAB_TIME` = 3 s, `chooseTakedown`; reguła przytrzymanego ataku usunięta; podpowiedź w chwycie `prompt.grab` (`GRAB_PROMPT`), w zakończeniu pusta, a klawisz należy dalej do obezwładnienia;
  - `app`: `TakedownController` wysyła `takedown` bez `lethal`, a w chwycie `takedown-choose` z interakcji albo ze świeżego naciśnięcia ataku; prezenter podpowiedzi daje drugą akcję tylko dla `prompt.grab`;
  - `ui`: przycisk strzału na dotyku nazywa drugą akcję podpowiedzi (`FireButton`); teksty `prompt.takedown` („Grab” / „Chwyć”), `prompt.grab` („Knock out” / „Ogłusz”), `prompt.grab.kill` („Kill” / „Zabij”), `touch.fireAction`; klucz `prompt.takedown.kill` usunięty;
  - zapis i złote hashe bez zmian.
