# Archiwum glitchy

Pełne wpisy naprawionych, odrzuconych i zdublowanych glitchy, przeniesione z [rejestru](glitches.md), który trzyma tylko otwarte sprawy (ADR-0054).

### G-962 Zawrotki na ślepych końcach Szkolnej i Słowikowskiego wychodzą wierzchołkiem za koniec jezdni
- Status: naprawione (23.11, gałąź fix/g962-zawrotki, PR po G-966); wcześniej: zgłoszone (S4: auto na zawrotce muska plac przez ok. 0,1 m)
- Gdzie: nowy rząd Podzamcza (23.11): Szkolna (843,5, 552,5), gdzie jezdnia przechodzi w deptak, i Słowikowskiego (997,2, 591,0)
- Dowód: `packages/sim/test/ground-readers.test.ts`, „keeps the car lanes on the carriageway”: wierzchołek półokręgu `uTurn` leży na płaskim końcu jezdni, a `surfacesAt` daje tam plac. Ten sam rodzaj co znany `Ciasna:b 583.1,575.5`; obie zawrotki w `KNOWN_OFF_ROAD` z odnośnikiem do tego wpisu.
- Poprawka: `turnRound` cofa zawrotkę na ślepym końcu o promień i zapas, tak by wierzchołek został na jezdni (zmiana pasów w całym mieście, osobny PR). Test przyjęcia: punkty znikają z `KNOWN_OFF_ROAD`.
- Naprawa (23.11): `turnRound` (`packages/sim/src/content/traffic.ts`) cofa oba pasy o promień półokręgu i 0,5 m zapasu (`TURN_CLEAR`), więc wierzchołek zawrotki zostaje 0,5 m przed końcem pasów, na jezdni. Z `KNOWN_OFF_ROAD` znikają oba punkty G-962 i znany wcześniej `Ciasna:b 583.1,575.5` tego samego rodzaju. Zmienia wszystkie zawrotki w mieście o 0,5 m.
- Zależność (23.11): zawrotki krótsze o 0,5 m przestawiły rozkład aut i test pętli przy deptaku odsłonił G-966 (auta z Bajkowskiego stojące na szwie pętli). Ten PR idzie po naprawie G-966; z nią test pętli przechodzi.

### G-963 Schody przy Szkolnej wchodzą końcem na jezdnię
- Status: naprawione (23.11, gałąź fix/g963-schody-szkolna, PR w drodze); wcześniej: zgłoszone (S3: schody leżą na pasie ruchu, auta jadą po stopniach)
- Gdzie: Szkolna przy (864,5, 601,8), schody (862,7–882,7, 593,8–604,7) w podzamcze-1-2
- Dowód: ten sam test: punkt pasa `Szkolna#109` na kawałku `steps`; zachodni koniec schodów zachodzi ok. 1,5 m na jezdnię. Punkt w `KNOWN_OFF_ROAD` z odnośnikiem.
- Poprawka: import przycina schody do krawędzi jezdni, jak chodniki przy skrzyżowaniach. Test przyjęcia: punkt znika z listy, a skan nie ma schodów na jezdni.
- Naprawa (23.11): `chunkGround` tnie każdy bieg schodów kawałkami jezdni chunku (asfalt lub kostka pasa jezdni i jego poszerzeń, zebry, krawężniki), z dokładnością do milimetra jak podział gruntu (`flightsOffRoads` w `steps-cut.ts`), przed `offSteps`. Przycięte 5 biegów: Szkolna (G-963, 3 m), bieg (888; 625) w podzamcze-1-2, (1100; 655) w podzamcze-2-2, (668; −203) i (758; −210) w stare-miasto. Skan: znika `car-lane-off-road podzamcze-1-2 860,600`; przybywa `steps-riser-norm podzamcze-1-2 883,597` (G-965, przyjęte świadomie). Próba z cięciem pasów przed zaokrągleniem do 0,1 m dawała szczelinę przy skośnym boku drugiego biegu (`ground-strip-gap`) i przesunięty klucz `kerb-gap-bare`, cięcie w chunku ich nie daje.

### G-960 Schody A i B w piwnicy W-3 niewidoczne
- Status: zamknięte 22.11: nie błąd gry. Spec roboczy wołał `teleport(page, x, y, z)`, a pomocnik e2e bierze `(x, z, yaw, pitch, y)`: gracz stał w (2530; z −33), daleko od W-3, więc propsy chunku `nabrzeze-w3` (schody, drzwi, drabiny) się nie wczytały, a kamera z `view()` patrzyła na pustą piwnicę. Z poprawnym teleportem schody A i B są widoczne (33 propsy w wypieku W-3).
- Ważność: S2 · Zasięg: schody A (x 2517..2525, z 402..403,8) i B (x 2539..2541, z 397,6..403,6) z `tessen-w3/basement.ts` istnieją w symulacji jako bryły z `slope` (gracz po nich chodzi), ale gra ich nie rysuje: w zrzucie z wnętrza piwnicy widać podłogę, szafki i otwory w stropie, a pod nowymi poręczami z Blendera nie ma stopni. `indoor()` zostawia schody jako widok bytu („Stairs, ladders and doors stay as they are”), a hala piwnicy jest wypiekana z `W3_INSIDE_BLOCKS` bez nich; przypuszczalnie widok bytu schodów pod ziemią (w sklepieniu `GroundVault`) nie powstaje albo jest zasłonięty
- Pakiet właściciela: packages/engine (`tessen-w3/w3-inside-geometry.ts` albo widoki bloków z `slope`), ewentualnie packages/sim (`indoor()`)
- Test przyjęcia: test renderera, że schody A i B mają siatkę w scenie po wejściu do piwnicy; zrzut z (2521; -31; 399,5) w stronę schodów A pokazuje stopnie pod poręczą
- Dowód: zrzut `w3-piwnica-schody-niewidoczne.png` z sesji 22.11 (spec roboczy, widok z boku schodów A)
- Trop (22.11): schody są propsami w pokojach W-3 (`inW3Interior`), więc idą do wypieku `W3PropBake` (`w3-prop-bake.ts`): ich własna siatka gaśnie, gdy wypiek je rysuje, a wypiek pokazuje się z halą (`setShown`). Do sprawdzenia w grze: czy wypiek grupy schodów powstaje (`MergeMeshes` zwraca null przy różnych atrybutach) i czy jest włączony, gdy oko jest w piwnicy.

### G-959 Ściany przy sąsiednim budynku pominięte, choć sąsiad zasłania je tylko w części: dziura w budynku
- Ważność: S2 · Zasięg: 74 ściany Lublina, 76 m dziur (największe: 9 m na ścianie 72 m przy (2536; 406), 5,7 m przy (−155; −108), 4,5 m przy (416; −152) i (218; 60)); szczyty dachów dwuspadowych tak samo
- Opis: Polecenie użytkownika 21.11 („budynki z przezroczystymi ścianami”). Ścianę, przy której stoi inny budynek, `hiddenWall` pomijała, gdy sąsiad był dość wysoki w trzech próbkach (15%, 50%, 85% długości, 0,6 m od ściany). Sąsiad krótszy niż ściana, kilku sąsiadów z przerwami albo sąsiad z wcięciem zostawiali odcinek ściany bez sąsiada i bez ściany: przez dziurę widać pusty środek budynku, a jego dalsze ściany są od tyłu, więc obcięte, i budynek wygląda na przezroczysty (zrzut (416; −152): oświetlona ulica za budynkiem). Kierunek ścian był dobry: `cleanRing` ustawia obrysy przeciwnie do wskazówek zegara, obrysów samoprzecinających się nie ma.
- Status: naprawione (21.11, `fix/sciany-przy-sasiedzie`)
- Pakiet właściciela: packages/engine (`renderer/mapcity/facade-frame.ts`, `roof-shapes.ts`)
- Poprawka: ściana dostaje `hiddenTo`, najniższy wierzch sąsiadów wzdłuż całej jej długości, próbkowany co 0,1 m od 2 cm od końców (−∞, gdy któryś odcinek jest odkryty); pominięcie ściany i szczytu dachu czyta `hiddenTo`. `coveredTo` z trzech próbek zostaje dla szyldów, kabli i kalkomanii; importer kalkomanii (`decal-walls.ts`) pomija ścianę zasłoniętą w trzech próbkach jak dotąd (kalkomania na takiej ścianie mogłaby trafić w sąsiada), więc tablice mapy się nie zmieniają. Pominiętych ścian 575 → 388; ściany odsłonięte w części rysuje się jako ślepe (bez okien).
- Test przyjęcia: `packages/engine/test/hidden-walls.test.ts`: trzech wąskich sąsiadów nad próbkami nie ukrywa ściany; w całym Lublinie żadna pominięta ściana nie ma odkrytego odcinka (sprawdzane co 0,1 m) i żadna ściana nie jest zwrócona do wnętrza swojego budynku. Bez poprawki oba testy padają.

### G-904 Stopy wychodzą z piwnicy W-3 na teren o 2,2 m w jednym kroku (2474,9; 408,5)
- Ważność: S3 · Zasięg: piwnica W-3, wyjście przy (2474,9; 408,5)
- Opis: Znalezione przy G-903: stopy z podłogi piwnicy (−30,2) wychodzą na teren (−28,0), +2,18 m w jednym kroku, także w pełnej symulacji z kolizjami (4 przypadki gracza po poprawce G-903). Bez pomostu, więc reguła deckSide tego nie obejmuje. Sondy: scratchpad g903-sim-probe.test.ts.
- Status: zamknięte (20.11, artefakt sondy 17.11); wcześniej: nie potwierdzone (artefakt sondy, 17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (ruch, W-3)
- 17.11 (orkiestrator, tryb bez agentów): w grze się nie odtwarza. Skok jest tylko wtedy, gdy gracz zostaje postawiony na stojąco w kolektorze przy x 2474-2476 (teleport sondy; tam nad stropem leży pokład 5 z BRIDGE_DECKS nabrzeze-0-1). Gra tego nie daje: do kolektora wchodzi się w kucki (W3_CULVERT_ENTRY), pod stropem nie da się wstać (puszczone kucanie zostawia crouched), chód w kucki i na stojąco przez x 2481-2468 przy z 406,6/407,2/407,8 trzyma podłogę −30,2 (u wylotu −30,05), a zapis i wczytanie w x 2472,5-2477 zostawiają ją na −30,2 w kucki. Sondy: g904.test.ts, g904b, g904c (usunięte po pomiarze).

### G-900 Zapis w trakcie pościgu gubi zgłoszenie przestępstwa, które przychodzi chwilę później
- Ważność: S3 · Zasięg: zapis i wczytanie w trakcie pościgu walczącego z treści
- Opis: Łowca G-899: hebi-bramowa, gracz ucieka sprintem, ziarna 3, 4, 5, zapis w kroku 1005 od startu pościgu (gracz 51 m od walczącego). Po 16 krokach gra żywa ma domain.heat poziom 1 (frakcja hebi, searchLeft 20, cooldown 7,98) i reinforcements.sent 1; wczytana ma heat 0 i reinforcements undefined. Stan przed zapisem identyczny. Przypuszczalnie licznik zgłoszenia (telefon świadka, m.call w crowd, WITNESS_CALL_SECONDS w crime-system.ts) poza zapisem; może się pokrywać z G-891. Sondy: scratchpad g899-heat.txt.
- Status: zamknięte (20.11, artefakt sondy 16.11); wcześniej: nie potwierdzone (artefakt sondy, 16.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim, packages/persistence
- Naprawiacz 16.11: artefakt sondy, zapis bez calmForSave. Gra zapisuje przez SaveController.snapshot() → sim.calmForSave() → settleCalls (G-240), więc zgłoszenie w toku przychodzi w chwili zapisu w obu grach. Z calmForSave 0 rozjazdów heat w ok. 400 zapisach (Lublin, 576,-24, ziarno 3), bez niego sygnatura G-900 (289+16). Sonda: scratchpad g900/g900-probe2.test.ts. Skutek projektu: zapis w trakcie rozmowy świadka przyspiesza zgłoszenie najwyżej o 5 s.

### G-899 Walczący z treści po wczytaniu w trakcie pościgu stoi jeden krok (velocity undefined, yaw o 0,1)
- Ważność: S4 · Zasięg: zapis i wczytanie w trakcie pościgu walczącego z treści (np. hebi-grodzka)
- Opis: Sonda weryfikatora #647: po wczytaniu w trakcie pościgu walczący z treści stoi jeden krok, velocity undefined, yaw różni się o 0,1; hash rozjeżdża się od pierwszego kroku (24 z 33 zapisów, tick 543). Tak samo na main. Sonda ręcznie zmieniała alerted i pozycję, więc do potwierdzenia przez łowcę (scratchpad v-g896-sl-*.json). Pokrewne G-883 (v41: prędkości).
- Status: zamknięte (20.11, nie potwierdzone przez łowcę 16.11); wcześniej: nie potwierdzone (łowca 16.11); wcześniej: do potwierdzenia
- Pakiet właściciela: packages/sim, packages/persistence
- Łowca: 0 rozjazdów w ok. 700 zapisach (hebi-grodzka, hebi-bramowa, ziarna 3-5, strzał z 9 i 22 m, ucieczka sprintem). Sonda #647 daje 21 z 30 tylko po ręcznym przeniesieniu walczącego 130 m od posterunku. Hipoteza nieuzasadniona: zimna pamięć nawigacji (nav-memo, chase-queue) po wczytaniu w pościgu z objazdem bariery; tego wariantu nie sprawdzono. Pułapka sond: te same wejścia i yaw gracza obu symulacjom.
- Ta sama pułapka sondy co w G-900: zapis bez calmForSave.

### G-878 touch-layout scan card: .scan-note wjeżdża toast-in, pomiar w trakcie animacji jak G-852
- Ważność: S4 · Zasięg: e2e/touch-layout.spec.ts karta skanu
- Opis: .scan-note dalej używa toast-in 200 ms (+30 px); test może mierzyć w trakcie animacji pod obciążeniem; znalezione przy G-852
- Status: zamknięte (20.11, nie odtwarza się od 16.11); wcześniej: nie odtwarza się (16.11, partia s4-ui-tests); do zamknięcia przy przeglądzie, jeśli się nie pojawi; wcześniej: nowy
- Pakiet właściciela: e2e
- nie odtwarza się: .scan-note nie powstaje w teście karty skanu; hint-in 8 px przy zapasie 31-46 px; bez zmian w kodzie

### G-254 Drony liczą czas z zegara klatki (latają w pauzie)
- Status: zamknięte (20.11, nie do naprawy: decyzja użytkownika 18.11); wcześniej: nie do naprawy: decyzja użytkownika 18.11 rano, drony mogą latać w pauzie; wcześniej: zgłoszone (2.11, weryfikator ADR-0058 etap 7)
- Ważność: S4 · Zasięg: `packages/engine/src/renderer/drones/*` biorą `dt` klatki renderera, nie czas świata; w pauzie drony dalej lecą (tak samo tłum renderera)
- Poprawka: czas dronów (i tłumu) z czasu świata przez `RenderPort`, zatrzymany w pauzie; test
- Pakiet właściciela: packages/engine (renderer)

### G-868 touch-layout:503 flaky: karta dzielnicy zakrywa minimapę o 16×74 px
- Ważność: S4 · Zasięg: e2e/touch-layout.spec.ts:503, 844x390 i 800x370, en i pl
- Opis: Pada sporadycznie, także na czystym main e839d94; przechodzi w retry. W śladzie porażki na ekranie tylko karta dzielnicy, przyczyna nieustalona.
- Status: zamknięte (20.11, duplikat G-852, naprawionego w #608); wcześniej: duplikat G-852 (ten sam flaky touch-layout:503); prowadzone w G-852; wcześniej: nowy
- Pakiet właściciela: packages/ui

### G-863 Wypełnienia gołej ziemi odrzucane przez crossesItself po cięciu
- Ważność: S4 · Zasięg: ok. 40 miejsc w mieście, największe (975,407) ok. 33 m², (373,-171) ok. 28 m²
- Opis: Zgłoszone przez naprawiacza G-853 r2: wypełnienie jest odrzucane przez crossesItself i miejsce zostaje gołe; mechanizm z main. Klucz frontage-bare 370,-170.
- Status: zamknięte (20.11, duplikat G-858); wcześniej: duplikat G-858 (to samo zgłoszenie z G-853 r2); prowadzone w G-858; wcześniej: nowy
- Pakiet właściciela: tools/osm-import

### G-891 Zakłócenia ulicy z wybuchu, alarmu i znalezienia ciała nie trafiają do zapisu
- Ważność: S4 · Zasięg: zapis dokładnie w kroku zdarzenia
- Opis: disturb() (sabotage-loud.ts:150, contract-system.ts:36, body-watch-system.ts:59) trafia do session.street.disturbances, których nie ma w zapisie; zapis w kroku wybuchu rozjeżdża hash od drugiego kroku. Znalezione przez weryfikatora W-3 3b (#633); klasa sprzed 3b.
- Status: naprawione (16.11, #637 scalony); wcześniej: naprawiony (PR #637); wcześniej: w PR #637; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- calmForSave czyści street.disturbances razem ze strachem tłumu (jak G-240); złote hashe bez zmian, bez v43; test w w3-sabotage-loud.test.ts

### G-888 Po wczytaniu gracz ma health.max 100 do pierwszego kroku player-control
- Ważność: S4 · Zasięg: wczytanie gry, apteczka w pierwszym kroku
- Opis: W grze źródłowej max 103 (np. podłoga determinizmu, zapis w kroku 786); apteczka w pierwszym kroku po wczytaniu leczy do 100. player-control-system.ts:267, factory.ts:60. Znalezione przez weryfikatora G-883, jest też na bazie.
- Status: naprawione (16.11, #636 scalony); wcześniej: naprawiony (PR #636); wcześniej: w PR #636; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-882 Efekty quickhacków (hackFx) nie trafiają do zapisu: po wczytaniu kamera po reboot_optics widzi od razu
- Ważność: S3 · Zasięg: zapis w trakcie quickhacka
- Opis: Znalezisko z W-3 etap 3: hackFx (np. blind z reboot_optics) nie jest zapisywany, więc wczytanie gry przywraca wzrok kamerze.
- Status: naprawione (16.11, w main); wcześniej: naprawiony (main 16.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim, packages/persistence

### G-881 barrier-detour-cost i traffic-bodies-shifted: podniesiony vi.mock w projekcie shared (isolate:false)
- Ważność: S4 · Zasięg: packages/sim/test/barrier-detour-cost.test.ts, traffic-bodies-shifted.test.ts
- Opis: Ten sam wzorzec co G-877: vi.mock nie sięga modułu już załadowanego w workerze; możliwa ta sama wada przy pewnej kolejności plików. Znalezione przy G-877.
- Status: naprawione (16.11, #615 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-g881, 74d3cfe); wcześniej: nowy
- Pakiet właściciela: packages/sim
- Wada realna: po pliku ładującym ../src vi.mock nie docierał (0 odczytów zmockowanego TRAFFIC_ROUTES wobec 91 597), testy przechodziły bez sprawdzania; resetModules + doMock + dynamiczne importy, strażniki (pas przesunięty < 0,05 m, routeAcrossLevels zmockowane).

### G-877 city-kit-loader.test.ts pada w workerze isolate:false, gdy city-kit-loader jest już w pamięci modułów
- Ważność: S4 · Zasięg: packages/engine/test/city-kit-loader.test.ts, projekt shared
- Opis: vi.mock city-kit nie działa, gdy moduł jest już załadowany w workerze (kolejność plików); znalezione przy G-865
- Status: naprawione (16.11, #611 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-s4-ui-tests, f83ba80); wcześniej: nowy
- Pakiet właściciela: packages/engine

### G-876 Karta podsumowania na telefonie zakrywa buffy i .gear pod celem
- Ważność: S4 · Zasięg: telefon, karta .debrief przy aktywnym buffie
- Opis: Karta od 84 px pod celem leży na .buffs (84 px) i .touch-mode .gear (92 px); znalezione przy G-846
- Status: naprawione (16.11, #611 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-s4-ui-tests, 7e83f9c; zależy od #607); wcześniej: nowy
- Pakiet właściciela: packages/ui
- gear na telefonie ma display:none; karta zakrywała buffy także na pulpicie 1024x600 @1, naprawione tą samą regułą

### G-865 model-donors.test.ts wyczerpuje pamięć przy wspólnym przebiegu kilku pakietów
- Ważność: S4 · Zasięg: packages/engine/test/model-donors.test.ts
- Opis: Zgłoszone przez naprawiacza G-853 r2: test:rerun kilku pakietów naraz kończy się brakiem pamięci w tym pliku; sam przechodzi.
- Status: naprawione (16.11, #608 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-test-reliability, 69b355a); wcześniej: nowy
- Pakiet właściciela: packages/engine
- przyczyna: NullEngine bez dispose w EngineStore, worker isolate:false (150 silników, 1722 MB po GC, OOM); setupFiles free-engines.ts; engine 1 worker: OOM -> 151/151; test:rerun engine ui app OK

### G-852 touch-layout: karta dzielnicy raz zachodzi na minimapę przy 844×390 en
- Ważność: S4 · Zasięg: e2e touch-layout, phone district card, skala 1
- Opis: Jedno przecięcie 16×74 px przy obciążeniu maszyny, powtórka zielona; możliwy flake e2e albo wyścig układu przy wczytaniu karty (znalezione przy PR #587)
- Status: naprawione (16.11, #608 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-test-reliability, e4d1d3f); wcześniej: nowy
- Pakiet właściciela: e2e, packages/ui
- 15.11 porządki rejestru: G-868 to duplikat; pada też na czystym main e839d94 (en i pl, 844x390 i 800x370), w śladzie tylko karta dzielnicy, przyczyna nieustalona.
- przyczyna: pomiar karty w trakcie animacji wejścia trzymanej przez brak klatek (toast-in +30 px = 16×74); test czeka na Animation.finished; dowód: wjazd 20 s pada bez/przechodzi z; 10/10 repeat

### G-846 Karta podsumowania zlecenia zakrywa komunikaty i cel, na 1024x600 wychodzi poza ekran
- Ważność: S3 · Zasięg: HUD przy skali 1: desktop 1280x720 przecina komunikat; telefon przecina cel, drążek i komunikat; 1024x600 poza ekranem
- Opis: Sonda e2e agenta skalowania 15.11; poza zakresem ADR-0085 (PR #587)
- Status: naprawione (16.11, #607 scalony); wcześniej: naprawiony (main 16.11); wcześniej: naprawiony na ccr-ec2c4269-ilh8k8-g846 (c55aa4c, 9e1517b), w PR; wcześniej: nowy
- Pakiet właściciela: packages/ui
- Test: e2e/ui-scale.spec.ts contract card (70 kolizji na main → 0) + packages/ui/test/debrief-zone.test.tsx; hint poza kontrolą, środek karty na telefonie nie przewija się palcem

### G-445 Rampa E Alchemii: kostka drapowana na siatce 2,5 m przebija stopnie
- Status: naprawione (20.11, #816 scalony); wcześniej: w naprawie (gałąź fix/alchemia-rowno-z-gruntem, kontrola `alchemia-off-ground`); wcześniej: zgłoszone (7.11, naprawiacz rundy 3 PR #343)
- Ważność: S4 · Zasięg: `drapedTriangles` (`DRAPE_GRID` 2,5 m) czyta teren przy x 435 (NMT w obrysie hali) i x 442,5 (wyższy grunt na wschód), więc paski kostki wychodzą ponad stopnie; poprawka: wyrównać teren pod obrysem hali przy ścianie E albo stopnie dopasowane do siatki drapowania
- Pakiet właściciela: packages/sim (content Alchemii), packages/engine (renderer/mapcity)

### G-958 Zebry pocięte granicą kawałka mapy i ścinki zebr bez pasów
- Ważność: S3 · Zasięg: 4 zebry przecięte granicą chunku i 5 ścinków (krakowskie, podzamcze, stare-miasto, nabrzeże)
- Opis: Pomiar orkiestratora 20.11 (sonda w scratchpadzie zebra/): 123 kawałki zebr (surface crossing) to 119 przejść. Każdy kawałek rysuje pasy z własnego obróconego prostokąta (planCrossing w crossing-plan.ts), więc przejście pocięte granicą chunku ma dwa niezależne rzędy pasów, a ścinek węższy niż 1 m dostaje sam asfalt bez pasów. (1) Pocięte granicą: (383,5; −20) krakowskie-2-0 + 2-1 (Bajkowskiego przy Alchemii; obok trzeci kawałek (383,8–386,9; −23,7…−21,1) przesunięty o 0,3 m i obrócony, z przerwą 0,4 m, oraz pasek 3,0 × 0,7 m bez pasów); (570; 160) stare-miasto-0-1 + podzamcze-0-0; (920; 472,5) podzamcze-1-1 + 2-1; (2500; 204,2) nabrzeże-0-0 + 1-0. (2) Ścinki trójkątne na granicach chunków bez reszty przejścia: (1119,1–1120; 264,3–274,1) podzamcze-2-0, pasek 0,9 m bez pasów; (−102,9…−98,2; −270…−268,4) krakowskie-0-0; trzy trójkąty podzamcze-0-0 przy x 520 (z 182,7–196,1). Poprawka: pasy z całego przejścia (scalić kawałki tego samego przejścia przed rysowaniem albo nieść oś i szerokość przejścia z importu), ścinki bez reszty przejścia usunąć z importu; nowa kontrola skanu (crossing-split / crossing-sliver).
- Status: naprawione (20.11, #819 scalony); wcześniej: w PR #819; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (crossing-bands, zebra-fit), packages/engine (mapcity/crossing-plan.ts)
- 20.11: poprawka w PR #819: kawałek przecięty granicą chunku niesie pierścień całego pasa (pole zebra), renderer liczy ramę pasów z całego pasa i przycina do kawałka. Do zrobienia osobno: przesunięty trzeci kawałek na Bajkowskiego (383.8–386.9; −23.7…−21.1) i osierocone drzazgi (podzamcze 1119–1120; 264–274, krakowskie-0-0 −102.9…−98.2; −270…−268.4, trójkąty przy x 520).

### G-948 Budka sieciowa planu na Placu Łokietka na drodze treści deptaka
- Ważność: S4 · Zasięg: Plac Łokietka (430; −100)
- Opis: Kontrola plan-prop-under-game (PR #803): ręczny punkt planu street.net-booths#1 leży na drodze treści z deptaka do Bramy Krakowskiej, więc import zawsze go zdejmuje. Poprawka: przesunąć punkt poza drogę albo usunąć z planu.
- Status: naprawione (20.11, #804 scalony); wcześniej: w PR #804 (20.11, gałąź fix/g948-budka-lokietka, df0c962), przegląd kuratora w toku; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (content/lublin plan)

### G-953 Auto ruchu przejeżdża przez przechodnia
- Ważność: S3 · Zasięg: ruch uliczny w całym mieście (traffic-system.ts, pushOut)
- Opis: Znalezisko przy G-951 (20.11): pushOut spycha tylko gracza; przechodzień (NPC) na pasie nie ma żadnej reakcji, a auto w ruchu przejeżdża przez niego. G-951 (PR #812) blokuje tylko pojawienie się auta w ciele.
- Status: naprawione (20.11, #815 scalony); wcześniej: w PR (20.11, gałąź fix/g953-auto-przez-przechodnia, 0daef3c); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (systems/traffic-system.ts, ruch przechodniów)

### G-951 Auto rampy P−1 pojawia się w ciele gracza poza jego wzrokiem i go spycha
- Ważność: S3 · Zasięg: rampa P−1 Alchemii, trasa 109 (ruch uliczny comeAndGo)
- Opis: Pomiar agenta testu ramp-pass (20.11): ziarno 77, gracz x 411,05, z 8, kurs 0, krok 2720: auto 3003488 powstaje 0,55 m od osi gracza, w obrysie (szerokość 0,91 + promień 0,38), a ruch spycha gracza o 0,69 m na zachód. comeAndGo i crowded w traffic-system.ts nie sprawdzają gracza. Bliskie G-492. Poprawka: punkt pojawienia się auta poza obrysem ciał (gracza i NPC) albo odłożenie pojawienia.
- Status: naprawione (20.11, #812 scalony); wcześniej: w PR #812 (20.11, gałąź fix/g951-auto-w-ciele, c9d2845); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (systems/traffic-system.ts)

### G-946 Czekanie w trakcie ostrzeżenia gangu prowokuje gang
- Ważność: S2 · Zasięg: każdy posterunek gangu (TerritoryWarned), okno czekania
- Opis: Godz. 12:00, gracz 3 m przed posterunkiem hebi-bramowa z wyciągniętą bronią: przychodzi TerritoryWarned (3 s świata), potem wait 60 min. Skoki czasu wyczerpują ostrzeżenie bez szansy na schowanie broni: 3 zdarzenia TerritoryProvoked, grudge 5, prowokacja na kilka godzin. waitBlock (packages/app/src/presenters/wait.ts) nie blokuje czekania przy trwającym ostrzeżeniu (warnedUntil). Znalezisko agenta G-944 (sonda w scratchpad g944-probe3.test.ts).
- Status: naprawione (20.11, #802 scalony); wcześniej: w PR #802 (20.11, gałąź fix/g946-czekanie-ostrzezenie, 5295a17); wcześniej: w naprawie
- Pakiet właściciela: packages/app (presenters/wait.ts) albo packages/sim (territory-system.ts)

### G-944 Hideo po dojściu do domu na Bramowej wstaje i krąży
- Ważność: S3 · Zasięg: Stare Miasto, Bramowa, dom Hideo (droga „dom” z schedules.ts)
- Opis: Pomiar agenta G-943 na main (przed #800 i po nim): Hideo dochodzi do domu na Bramowej, siada albo zasypia, po czym wstaje i krąży ok. 20 m przez ok. 3 minuty gry, potem znów śpi. Oczekiwane: po dojściu zostaje w domu do następnego punktu harmonogramu.
- Status: odrzucone (20.11): nie glitch, reakcja na strzały (ADR-0029). Hideo śpi w domu bez przerwy na 4 ziarnach i 5 ustawieniach gracza; objaw tylko w ustawieniu seated-walk.test.ts (gracz z wyciągniętą bronią 3 m od drzwi, wait po minucie): patrol hebi-bramowa ostrzega, kolejne skoki wyczerpują ostrzeżenie, gang strzela 19 m od domu, Hideo ucieka i wraca. Ze schowaną bronią 0 strzałów. Prawdziwa przyczyna w G-946; wcześniej: w naprawie
- Pakiet właściciela: packages/sim (content/schedules.ts, systemy harmonogramu)

### G-943 Szyldy i neony przy kamieniach pamięci i Stolpersteine
- Ważność: S3 · Zasięg: 12 miejsc: Lubartowska przy Stolpersteine Cygielmanów (5), kamień Marii Rechtszaft (1), Stare Miasto przy kamieniu Beli Szpiro-Nisenbaum (5, w tym neon SAKE), neon Hebi w schronie pod T2 (14,2 m w poziomie od kamienia Placu Ofiar Getta, pod ziemią)
- Opis: Nowa kontrola skanu memorial-neon-clear (świecący znak < 20 m w poziomie od kamienia pamięci albo memorial=stolperstein) przyjęła bazę 12 miejsc. §6 ADR-0074: przy kamieniu pamięci i Stolpersteine nie ma neonów ani reklam. Większość to szyldy i reklamy z generatora szyldów mapy (w66309795, w232362884, w232362885, w232674409, w66286368, w66286369, w66293690, w66293706), plus neon gry SAKE (546,-75) i neon Hebi dev:targ-neon (428,97) w schronie pod ziemią (do decyzji: liczyć tylko znaki nad ziemią albo przenieść).
- Status: naprawione (20.11, #800 scalony); wcześniej: w naprawie (gałąź fix/g943-szyldy-przy-pamieci); wcześniej: nowy (20.11)
- Pakiet właściciela: tools/osm-import / generator szyldów mapy (wykluczenie stref przy pamięci), sim (neon SAKE)
- Test przyjęcia: memorial-neon-clear: baza z 12 do 0 (albo do 1 z uzasadnieniem dla neonu pod ziemią)

### G-942 Schody placu przed Alchemią schodzą na goły grunt przed chodnikiem Bajkowskiego
- Ważność: S4 · Zasięg: lokalny, Alchemia, x 383,6–404,3, z −9,05…−11,2
- Opis: Między krawędzią placu T0 (z −9,05…−9,3) a kostką chodnika w232464426 (z −10,2…−11,2) leży pas gołego gruntu 1,15–1,9 m (ok. 32 m²); na ortofoto 100% kostki. Pas był przed C5 (ground-strip-gap krakowskie-2-1 400,-10 w bazie), od C5 (#793) schodzą na niego schody południowe placu. Przegląd kuratora 20.11.
- Status: naprawione (20.11, 795 scalony); wcześniej: w PR #795; wcześniej: w naprawie (gałąź fix/g942-schody-placu); wcześniej: nowy (20.11)
- Pakiet właściciela: tools/osm-import (corrections-alchemia.ts), regeneracja tablic
- Test przyjęcia: brak próbki co 0,1 m w x 383,6–404,3 między krawędzią placu a pasem chodnika bez nawierzchni; klucz ground-strip-gap krakowskie-2-1 400,-10 znika z bazy; NMT bez zmian
- Wiersz topografii: T-333 (T-332 zajęty).
- Poboczne z naprawy: pasek ok. 7 cm gołego gruntu pod wjazdem na rampę (x 410–412, z −9,79…−9,86) i goły klin na zachód od narożnika parkingu (x ok. 380–383,6) do sprawdzenia na ortofoto.

### G-939 Galeria Alchemii: strzał zza barku startuje za cienką ścianą szybu windy hali i trzonu NE
- Ważność: S4 · Zasięg: Alchemia, galeria P1–P3 (szyb windy hali x 412,3–414,7, z 32,4–34,8; trzon NE)
- Opis: Miara G-275 (tests/tpp-shoulder) po dodaniu galerii jako wnętrza ADR-0061 (O2): 11 miejsc, w których przykucnięty i celujący gracz zaczyna strzał za ścianą. Ściany szybu windy hali i bramka na P1 (od T0) mają 0,1 m (lift.ts WALL), mniej niż wysunięcie barku za lico (0,16 m); przy bramce na P1 strzał z kabiny startuje na pasie T0. Przy trzonie NE pokój galerii zahacza o wnętrze trzonu, a za jego wschodnią ścianą jest wnęka do narożnika szkła. Szkło fasady poprawione w PR #785 (0,2 m, 770 → 0). Poprawka: bramka na P1 jak na P−2 (wypełnia grubość ściany, platforma krótsza, GATE_DEPTH), ściany szybu 0,2 m albo pokoje galerii bez szybu i trzonu, potem baza galerii w teście z 11 do 0.
- Status: naprawione (20.11, 789 scalony); wcześniej: w PR #789; wcześniej: w naprawie (gałąź fix/g939-szyb-windy); wcześniej: nowy (19.11, z O2)
- Pakiet właściciela: sim (content/alchemia/lift.ts, mall-plan.ts)
- Test przyjęcia: packages/sim/test/tpp-shoulder.test.ts (galleryLeaks ≤ 11)

### G-941 Oś wejścia głównego Alchemii na gołym gruncie klina przy pawilonie
- Ważność: S4 · Zasięg: lokalny, Alchemia, (422–423,5; −9,4…0)
- Opis: Między krawędzią placu T0 (422,0; −8,8)–(423,5; 6,0) a bokiem NW pawilonu T-230 leży klin bez nawierzchni (istniał przed O2b, O2b odsłania ok. 15 m²). Leży na nim wschodni skraj osi wejścia (do 1,8 m przy z −8) i pas LED x 422,8 na z −8,5…−0,8; u wylotu osi pas ok. 0,5 m bez nawierzchni (z −9,35…−8,8) między chodnikiem w232464426 a placem. Przegląd kuratora 19.11.
- Status: naprawione (20.11, 788 scalony); wcześniej: w PR #788; wcześniej: w naprawie (gałąź fix/g940-g941-alchemia-nawierzchnia); wcześniej: nowy (19.11)
- Pakiet właściciela: tools/osm-import (corrections-alchemia.ts), regeneracja tablic
- Test przyjęcia: pasy LED i oś x 419–423 od pasma chodnika do z 0 w całości na nawierzchni
- Proponowana kontrola skanu nav-edge-bare: odcinek krawędzi grafu poziomów na terenie, który ponad 0,5 m biegnie bez nawierzchni (w Alchemii po O2b co najmniej 1).
- Wiersz topografii: T-331.

### G-940 Drzwi klatki P−1 Alchemii wychodzą na trawnik
- Ważność: S4 · Zasięg: lokalny, Alchemia, (426; 9–12,4)
- Opis: Po O2b (#786) domek klatki P−1 (T-238) stoi na zachodnich ok. 28 m² trawnika T-241/trawnik-wschod (x 424–434, z 9–21). Przed drzwiami (x 425,3–426,7, z 12,4) jest 3,2 m trawy, krawędź grafu t0-axis → p1-stair-out (426; 11,2) też biegnie po trawie. Komentarz T0_LAWNS w imporcie (trawnik omija drzwi klatki) już nie jest prawdziwy. Przegląd kuratora 19.11.
- Status: naprawione (20.11, 788 scalony); wcześniej: w PR #788; wcześniej: w naprawie (gałąź fix/g940-g941-alchemia-nawierzchnia); wcześniej: nowy (19.11)
- Pakiet właściciela: tools/osm-import (T0_LAWNS), regeneracja tablic
- Test przyjęcia: pas 1,5 m przed drzwiami domku i krawędź t0-axis→p1-stair-out leżą na square
- Proponowana kontrola skanu door-approach-unpaved: pas 1,5 m × szerokość drzwi przed drzwiami domków klatek, pawilonów i wejść scen na grass albo bez nawierzchni (baza po O2b w Alchemii 1).
- Wiersz topografii: T-330.
- Poboczne z naprawy: węzeł grafu alchemia-p1-stair-east (428,9; 11,2) leży na trawniku, krawędź stair-out → stair-east ok. 0,9 m po trawie; węzeł stracił sens (domek przylega do skrzydła L1), do usunięcia w parking-nav.ts (sim).

### G-938 Strzały napastników do ofiary prowokują patrol Rynku przeciw graczowi
- Ważność: S2 · Zasięg: Stare Miasto przy Bramie Krakowskiej (przestępstwo przy 528; −58), każde przestępstwo z bronią w zasięgu alarmu grupy terytorium
- Opis: Napastnicy Hebi strzelają do ofiary; alertNearbyGangers alarmuje członków terytorium w promieniu strzału, a territory-system uznaje zaalarmowanego członka za prowokację (TerritoryProvoked alarm dla rynek, grodzka-bridge, panasa-lane). Patrol hebi-rynek-noc strzela potem do gracza, który nic nie zrobił (19 strzałów w 15 s, ślad na main 19.11, save-load-crowd-panic seed 13). Poprawka: strzał członka gangu, który nie walczy z graczem, nie alarmuje jego gangu przeciw graczowi albo alarm bez winy gracza nie prowokuje terytorium.
- Status: naprawione (19.11, #757 scalony); wcześniej: w PR #757; wcześniej: nowy
- Pakiet właściciela: packages/sim (combat-system alertNearbyGangers, territory-system)
- Test przyjęcia: test sim: napad przy patrolu, napastnicy strzelają do ofiary, patrol nie strzela do gracza i gang nie jest sprowokowany

### G-908 Droga cicha rurociągiem i dachem W-3 bez zagrożeń
- Ważność: S4 · Zasięg: trasa most, rurociąg, dach N, właz
- Opis: Playtest 17.11: cała trasa bez strażnika, kamery i obserwatora (ADR-0082 zakłada dwie kamery dachu (2530; 440), (2556; 440) i obserwatora w kabinie), ok. 2 minut gry w ciszy. Odtworzenie: od Genzō przez (2484; 409,5), drabina (2444; 438,6), rurociąg +10, tor (2501; 438,6) do włazu (2564; 439,3). Upload 40 s w martwym kącie pewny.
- Status: naprawione (18.11, #736 scalony); wcześniej: w PR #736; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Kamery dachu N, obserwator w kabinie, strefa z polem floor. Otwarte: obserwator po alarmie na tor suwnicy (ADR §1 p. 4), kwestia Genzō w m4-doki.ink.

### G-230 Mikrozdarzenie po skoku gracza o ponad 300 m zostaje w uśpionych do końca sesji
- Status: naprawione (18.11, #728 scalony); wcześniej: w PR #728 (18.11); wcześniej: zgłoszone (2.11, weryfikator G-219)
- Ważność: S4 · Zasięg: skok o ok. 600 m w jednym kroku (metro, teleport): chunk zasypia przed zamknięciem „left”, napastnicy i ofiara (`micro:mugging:5:m0/m1/victim`) zostają w `state.dormant` i nic ich nie budzi; do zapisu nie trafiają (`isMicroKey`), więc to wyciek pamięci w sesji
- Poprawka: przy usypianiu chunka zamknąć trwające mikrozdarzenie (jak „left”) albo nie usypiać kluczy `micro:`; test z teleportem
- Pakiet właściciela: packages/sim (micro-events, streaming)

### G-295 Po alarmie licznik podejrzeń zostaje na 1 i pierwsze ok. 2 s przeszukania alarmuje w jednym kroku
- Status: naprawione (18.11, #729 scalony); wcześniej: w PR #729 (18.11); wcześniej: zgłoszone (4.11, weryfikator ADR-0069 etap 1)
- Ważność: S4 · Zasięg: `ganger-perception.ts` (`track`)
- Pakiet właściciela: packages/sim/src/systems/ai

### G-355 Nazwa slotu `hipL` myli: broń biała wisi po innej stronie albo w innym miejscu
- Status: naprawione (18.11, #727 scalony); wcześniej: w PR #727 (18.11, nazwa stowedMelee); wcześniej: zgłoszone (5.11, weryfikator PR #297)
- Ważność: S4 (kod) · Zasięg: nazwa slotu montażu nie odpowiada położeniu · Koszt: mały
- Pakiet właściciela: packages/engine

### G-321 Mapa M przy mocnym oddaleniu: nazwy dzielnic nakładają się („PRZEDSTARE MIASTO”)
- Status: naprawione (18.11, #725 scalony); wcześniej: w PR #725 (18.11); wcześniej: zgłoszone (5.11, weryfikator PR #270; było też przed tą zmianą)
- Ważność: S4 · Zasięg: `liftDistricts` przesuwa „KRAKOWSKIE PRZEDMIEŚCIE” i „STARE MIASTO” na ten sam wiersz; na telefonie przy oddaleniu tłoczą się też etykiety zabytków
- Pakiet właściciela: packages/ui (mapa miasta)

### G-316 Luki w testach martwej strefy ADR-0070: trzy mutacje przeżywają
- Status: naprawione (18.11, #726 scalony); wcześniej: w PR #726 (18.11, trzy mutacje giną); wcześniej: zgłoszone (5.11, weryfikator PR #267)
- Ważność: S4 (test, nie gra) · Zasięg: `SEATED` bez „sleep” (brak testu leżącego w pasie), `StayFacingPlayer` obracający siedzącego stałego mieszkańca przy −60 (brak testu), `holdLanePlace` bez `waypoint = null` (nic nie sprawdza)
- Pakiet właściciela: packages/sim (testy `flee-dead-zone`, `reputation-tiers`)

### G-322 Panel kiosku metra i karta są półprzezroczyste: przez nie widać napisy HUD
- Status: naprawione (18.11, #724 scalony); wcześniej: w PR #724 (18.11, pełne tło kiosku); wcześniej: zgłoszone (5.11, weryfikator PR #270)
- Ważność: S4 · Zasięg: powiadomienie dzielnicy, cel i podpowiedź dotyku prześwitują przez panel (`shots/metro1-v2/phone-kiosk-kanal-target.png`)
- Pakiet właściciela: packages/ui (metro)

### G-374 Lista quickhacków w HUD pokazuje koszt RAM bez zniżki ICEpick
- Status: naprawione (18.11, #723 scalony); wcześniej: w PR #723 (18.11); wcześniej: zgłoszone (6.11, autor ADR-0059 etapu 3b)
- Ważność: S4 (UI) · Zasięg: `ui/hud/scanner.tsx` bierze koszt z tabeli, a symulacja liczy ze zniżką · Koszt: mały
- Pakiet właściciela: packages/ui, packages/app (przekazanie kosztu z sim)
- Test przyjęcia: test komponentu: przy ICEpick koszt na liście równa się kosztowi pobieranemu w symulacji

### G-091 Długie przytrzymanie „Use” wybiera kwestię pod palcem w kole dialogu
- Status: naprawione (18.11, #720 scalony); wcześniej: w PR #720 (18.11, osłona od podniesienia palca); wcześniej: zgłoszone (z badania G-058; do potwierdzenia na prawdziwym telefonie przez glitch-huntera)
- Ważność: S3 (proponowana; przypadkowy wybór kwestii w rozmowie) · Zasięg: dotyk · Koszt: mały
- Dowód: sonda e2e (`scratchpad/g058-probe.spec.ts`): przytrzymanie „Use” ok. 1,0–1,3 s, aż dialog się otworzy, potem `pointerup` i `click` na `BUTTON.wheel__opt`; dialog idzie dalej. `touchend` trafia w odpięty przycisk pada, więc nie jest anulowany, a osłona z G-048 już wygasła (700 ms). Niepewne, czy prawdziwy telefon wysyła kliknięcie po długim przytrzymaniu (CDP może się różnić)
- Pakiet właściciela: packages/ui (`touch/ghost-click.ts`)
- Test przyjęcia: test komponentu: kliknięcie z dotyku, który zaczął się przed otwarciem koła, nie wybiera kwestii

### G-420 Efekty hacków na wrogu (`hackFx`: oślepienie, spowolnienie, ping) nie trafiają do zapisu
- Status: naprawione (18.11, #722 scalony); wcześniej: w PR #722 (18.11, test regresji; naprawione wcześniej przez zapis hackFx z G-882, #628/#633); wcześniej: zgłoszone (6.11, naprawiacz rundy 3 PR #337)
- Ważność: S3 · Zasięg: po wczytaniu oślepiony wróg od razu widzi gracza, przebieg rozjeżdża się z zapisanym (hash po wczytaniu inny niż w ciągłej grze); dotyczy każdego zapisu w trakcie walki z hackami
- Pakiet właściciela: packages/sim, packages/core (save-snapshot), packages/persistence

### G-358 O 23:00 sprzedawcy północnego targu uciekają na każdym progu reputacji
- Status: naprawione (18.11, #721 scalony); wcześniej: w PR #721 (18.11, test przyjęcia; nie odtwarza się na main); wcześniej: zgłoszone (5.11, weryfikator PR #299, do potwierdzenia)
- Ważność: S3 · Zasięg: sonda sesji, druga doba 23:00, gracz 1,5 m od straganu Fumiko: Fumiko (sklep otwarty) i Kenta w stanie tłumu „fleeing”, Goro się przesuwa; tak samo przy reputacji 0, +50, −30, −60, −100. Możliwy niezidentyfikowany alarm na targu albo artefakt przeskoku zegara w sondzie · Koszt: nieznany
- Pakiet właściciela: packages/sim (`systems/ai`, tłum)
- Test przyjęcia: sesja bez renderera o 23:00 przy straganie Fumiko bez strzałów i walki: żaden sprzedawca nie ucieka

### G-886 Pościg 200 m: bankBetween próbkuje cały odcinek co krok
- Ważność: S4 · Zasięg: pościg strażnika za graczem w zasięgu
- Opis: pinned-far-sleep calmWest (cel 2670,300): 9544 pełnych bankBetween po 400 próbek steepAt, ok. 2,8 s pliku; znalezione przy G-884
- Status: naprawione (18.11, #630 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #630; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- GentleBlocks: bankBetween pyta o spadek tylko poza łagodnymi blokami terenu; pościg 200 m 1190 -> 94 steepAt, pinned-far-sleep (6 s) -44%, hashe bez zmian; to samo do nav-raster.ts:209 i walkable

### G-884 Przypięty strażnik liczy co krok linię wzroku i marsz po całym odcinku do dalekiego gracza (2,4 km)
- Ważność: S3 · Zasięg: strażnicy przypięci do gracza (G-188, G-201), cała gra
- Opis: W pinned-far-sleep 64% czasu to straightWalk, lineOfSight i bankBetween liczone co krok po całym odcinku do gracza 2,4 km dalej. Koszt CPU w grze (telefon) i w testach; do ograniczenia zasięgu albo częstotliwości (profil z partii 2 testów na podłogach).
- Status: naprawione (18.11, #629 scalony); wcześniej: naprawiony (main 16.11, #629); wcześniej: w PR #629; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Przyczyna: lineOfSight brał wszystkie bryły prostokąta odcinka (2300/krok); teraz tylko komórki, które odcinek przecina (5/krok), wynik identyczny, hash bez zmian; pinned-far-sleep −21,5%

### G-883 Zapis w trakcie walki rozjeżdża się po wczytaniu: przechodzień zawraca, yaw gracza i RNG walki inne
- Ważność: S3 · Zasięg: podłoga determinizmu, ziarno 1234, zapis w krokach 200–1000 floorScript(); pierwszy krok po wczytaniu
- Opis: przechodzień (bystander) zmienia yaw o ok. pi; przy pałce yaw gracza o 0,1 rad; ok. ticku 1000 inne rngState i HP gangera; stan mózgu cywila i walki nie jest w zapisie (znalezisko z gałęzi determinism-floor)
- Status: naprawione (18.11, #632 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #632 (zapis v41); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai, packages/sim/src/world
- Druga przyczyna: przeładowanie gracza w toku nie jest w zapisie (gunOf w world/factory.ts:336 pomija gracza); zapis w trakcie przeładowania daje strzał w pierwszym kroku po wczytaniu, także bez tłumu i ruchu; it.todo w packages/sim/test/traffic-panic.test.ts (PR luki determinizmu)

### G-875 Skan: próbka na linii ukośnej ściany liczona jako goła (zaokrąglony obrys 0,1 m)
- Ważność: S4 · Zasięg: tools/glitch-scan landuse-bare, bare-on-cover; krakowskie-2-1 Karmelicka 7
- Opis: Ściana o nachyleniu 2:1 przechodzi przez siatkę 0,25/0,75 o 2-3 mm od obrysu tabeli; import uznaje próbkę za wnętrze, skan za ziemię (G-872 r2: 5 kluczy).
- Status: naprawione (18.11, #609 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #609 (066b575); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan
- Łatka gotowa (scratchpad/g875-fix.patch: próbka w obrysie z mapy i <=0,1 m od ściany tablicy): landuse-bare -36, bare-on-cover -47, ale +1 kerb-gap-bare krakowskie-0-0 -60,-170 (ta sama prawdziwa goła szczelina przy krawężniku przechodzi z landuse-bare do kerb-gap-bare przez landuseBareAt); czeka na decyzję użytkownika: accept 1 klucza (bilans -82) albo zmiana landuseBareAt na próbki 0,25 m
- 16.11 decyzja użytkownika: przyjąć 1 klucz kerb-gap-bare krakowskie-0-0 -60,-170 (bilans −82); łatka na gałęzi #609.
- 066b575: próbka w obrysie z mapy i najwyżej 0,1 m od ściany tablicy zakryta; landuse-bare -36, bare-on-cover -47, kerb-gap-bare +1 (accept, krakowskie-0-0 -60,-170, przesunięcie rodzaju, decyzja użytkownika 16.11); bilans -82

### G-872 Karmelicka 7: stojący budynek z building=construction pominięty przez SKIP_BUILDING
- Ważność: S3 · Zasięg: w1134342880 (311..335; 56..98), Krakowskie
- Opis: Ortofoto 2023-09, 2024-06 i 2025-04 pokazuje dach budynku; OSM building=construction, construction=commercial; w grze goła ziemia bez bryły (SKIP_BUILDING w generate.ts). Znalezione w przeglądzie kuratora G-853 r3. Test: bryła Karmelicka 7 z wysokością z LoD1/NMPT; proponowana kontrola osm-construction-built 1 -> 0.
- Status: naprawione (18.11, #631 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #631 (9 kluczy przyjętych decyzją użytkownika 16.11); wcześniej: wstrzymane do rana: decyzja użytkownika o 17 kluczach skanu (podniesienie bazy) i scalenie po #599; gałąź 2514e3b; wcześniej: w naprawie, runda 2 (przedpole: landuse=construction w1261814241); wcześniej: do przeglądu kuratora (6bbd199), skan czerwony: +15/+10/+5 kluczy przy bryle; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g872); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- builtSites (cfec849, 6bbd199): building=construction pod LoD1 2024 (IoU>=0,7) jako budynek, bryła 19,7 m commercial; osm-construction-built 1->0; przy bryle +15 landuse-bare, +10 bare-on-cover, +5 ground-strip-gap (goła ziemia sprzed poprawki, teraz przedpole sklepu); baza nie podniesiona, czeka na przegląd kuratora i decyzję
- przegląd kuratora (cfec849): bryła zgodna; 30 kluczy przedpola NIE do bazy: 26 w landuse=construction w1261814241 (nieaktualna budowa). Ortofoto: wsch./pn./pas przy ścianie zach. i NW -> grass, pd. nieutwardzony parking -> square. r2: landuse=construction z budynkiem z builtSites jak zakończona budowa + klasy other/cień z innych nalotów; cel +15/+10/+5 -> 0. Proponowana kontrola construction-landuse-built (baza 1).
- r2 2514e3b: działka w1261814241 zakończona (withBuiltSites), classifySite na działce; zostaje 16 kluczy + fill-on-green 1 (5 na linii ściany, 3 asfalt poza działką, 3 szczeliny); kolizja z #599 (krakowskie.cover.png, build.ts, generate.ts).
- 16.11 decyzja użytkownika: przyjąć 17 kluczy skanu z uzasadnieniem; PR po scaleniu #599.
- 16.11 decyzja użytkownika: po #599 przyjąć 9 kluczy w krakowskie-2-1 (3 z uzgodnienia, 5 fill-gap, 1 ground-strip-gap) i zmianę skanu: place budowy jak w imporcie

### G-867 glitch-shots: ta sama treść daje raz klatkę w cieniu (jasność 49), raz w słońcu (148)
- Ważność: S4 · Zasięg: bs-291-pn (291; −78), przebieg naprawiacza G-853 r2 na e04c860 wobec dwóch przebiegów kuratora na e3175f7 (to samo drzewo)
- Opis: Przyczyna nieustalona: oświetlenie albo cień w przebiegu zrzutów, nie geometria. Zrzuty: scratchpad/g853/shots2 i scratchpad/topo-g853r2/shots2
- Status: naprawione (18.11, #618 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #618; wcześniej: nowy
- Pakiet właściciela: packages/engine
- odtworzone na e3175f7 (2/6 stron, 54,1/46,4 wobec 147,2); main 9/9 = 107,3; różnica w treści statycznej mapy cienia księżyca (+335..407 tys. tekseli) przy tych samych rzucających, macierzach i stanie GL; nie zegar, paleta, losowość; kandydaci: shareDepth, kolejność wobec sondy mokrego asfaltu, SwiftShader; capture() po view() zwraca poprzednią klatkę (inna sprawa); bez poprawki
- przyczyna: getIndices() bez kopii w rebuildStaticProxy + MergeMeshes wydłuża indeksy pierwszego klonu w miejscu, nowe proxy indeksuje poza wierzchołki; bez poprawki 6/33 stron inna mapa, z poprawką 12/12; test moon-shadow-proxy.test.ts

### G-866 cover-fixes: plac budowy Zielona 5A opisany jako ogródek kawiarni, front kładzie na nim trawę i kostkę
- Ważność: S4 · Zasięg: Krakowskie (249–256; 1–7), 48 próbek pokrycia, ok. 40 m² frontu
- Opis: Przegląd kuratora G-853 r2: drugi wpis COVER_FIXES opiera się na złym odczycie ortofoto (2025-04 budowa, 2024-06 działka, 2023-09 korony; OSM building=construction w1382552286, landuse=construction w770678456). Usunąć wpis i wyłączyć landuse=construction z frontów jak trawniki OSM. Proponowana kontrola fill-on-construction (baza co najmniej 1). Naprawa w ramach G-853 r3.
- Status: naprawione (18.11, #599 scalony); wcześniej: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: do przeglądu kuratora (aed9fb4); wcześniej: w naprawie
- Pakiet właściciela: tools/orto, tools/osm-import
- r3 (aed9fb4): wpis cover-fixes 2 usunięty, front omija landuse/building=construction, fill-on-construction 3059 -> 0; przegląd kuratora ZGODNE

### G-864 ground-strip-gap liczy szczeliny pod budynkami
- Ważność: S4 · Zasięg: cały skan; 16 kluczy z G-853 r2 w całości pod budynkami
- Opis: Kontrola skanu ground-strip-gap nie odrzuca szczelin przykrytych budynkiem, więc baza rośnie o fałszywe alarmy.
- Status: naprawione (18.11, #609 scalony); wcześniej: naprawiony (main 16.11); wcześniej: w PR #609 (8840dbc); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-scan-false-alarms, 8840dbc); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan
- 8840dbc: ground-strip-gap pomija komórki w obrysach budynków (inBuilding); -53 klucze (1270->1217), 0 nowych

### G-855 Skan nie liczy gołej ziemi przy ulicach pieszych z kamienicami residential: brak kontroli frontage-bare
- Ważność: S4 · Zasięg: deptak 54 kwadraty 10 m (1546 m²) poza bazami, Stare Miasto 75 kwadratów (708 m²)
- Opis: landuse-bare liczy tylko commercial/civic, kerb-gap-bare ≤3 m od jezdni, ground-strip-gap ≤1,25 m; z 109 kwadratów deptaku 24 w bazach
- Status: naprawione (18.11, #599 scalony); wcześniej: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: nowy
- Pakiet właściciela: tools/glitch-scan

### G-854 Plamy gołej ziemi przy Bramie Krakowskiej i wschodnich ulicach Starego Miasta
- Ważność: S4 · Zasięg: (503,0;−69,3) 90 m², (663,5;−38,0) 226 m², (664,8;−119,4) 86 m²; Stare Miasto ≤6 m od ulic 948 m²
- Opis: Ta sama przyczyna co deptak (brak nawierzchni przed pierzeją). Rynek wokół Trybunału bez dużych plam (szczeliny kilka dm)
- Status: naprawione (18.11, #599 scalony); wcześniej: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: nowy
- Pakiet właściciela: tools/osm-import

### G-853 Pasy gołej ziemi między kostką deptaku Krakowskiego Przedmieścia a pierzejami
- Ważność: S3 · Zasięg: deptak x −100..440: 2141 m² w 10 m od osi (2765 m² w 20 m); największe (222,5;−70,6) 620 m², (291,0;−69,9) 592 m², (364,6;−86,0) 200 m²
- Opis: Zgłoszenie użytkownika 15.11. Import nie kładzie nawierzchni między krawędzią kostki (z ortofoto) a ścianami kamienic residential; goła ziemia w kolorze TERRAIN #514c45. Stan od pierwszego importu 29.10 (c0e87f3), malał (2472 → 2141 m²), nie regresja; bardziej widoczny po jaśniejszej kostce z ortofoto (13.11). Zrzuty scratchpad/g-deptak/cmp2/grid.png
- Status: naprawione (18.11, #599 scalony); wcześniej: w PR #599 (kurator r3 ZGODNE, aed9fb4); wcześniej: do przeglądu kuratora (e3175f7); wcześniej: w naprawie (WIP 7ff493d, runda 2: meble niezależne od wypełnień frontu, nowe klucze skanu, grass-on-light-paving); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- Przegląd kuratora r2 (e3175f7): NIEZGODNE z jedną poprawką (cover-fixes wpis 2, plac budowy Zielona 5A); fronty i wpis 1 przyjęte (wpisy T); bs-291-pn: przyciemnienie nieodtwarzalne (148 na e3175f7); plamę trawnika użytkownik przyjął; e3175f7 to pusty commit
- r3 (aed9fb4): cover-fixes wpis 2 usunięty, front omija place budowy, fill-on-construction 3059→0, map-ground-golden e520204b; drzwi i graffiti: wysokość z kostki frontu (+0,08 m), zamierzone
- r3 (aed9fb4) przegląd kuratora: ZGODNE; place budowy wracają do stanu main (Zielona 5A 1464 m² gołej ziemi, ortofoto 2025-04 budowa); klucze 330,50 (T-314) i 0,90/0,100 (wykop muzeum 2025-04) uzasadnione; drzwi/figury +0,08 m tylko na froncie

### G-840 Schody bez wspólnej normy stopnia: płytkie stopnie Placu Zamkowego z daleka jako czarna plama
- Ważność: S3 · Zasięg: wszystkie biegi schodów z mapy (steps-plan.ts); najbardziej schody na Wzgórze Zamkowe z Placu Zamkowego
- Opis: Zgłoszenie użytkownika 15.11 ze zdjęciem: schody na Podzamczu są bardzo płytkie i z daleka widać je jako czarną plamę. steps-plan.ts tnie bieg na stopnie o stałej głębokości STEP_DEPTH 0,33 m, a wysokość wynika ze spadku wygładzonego NMT (od MIN_RISER 0,045 m w górę), więc wysokości są różne między biegami i często bardzo małe. Ciemne podstopnie (#4f4b46) co 0,33 m zlewają się z daleka w czarną plamę (aliasing). Propozycja użytkownika: jedna norma stopnia w całej grze, pilnowana skanem. Do zrobienia: (1) norma: podstopień 0,15 m (0,12–0,17), stopnica 0,32 m (2h+s 0,60–0,66), liczba stopni z całkowitej różnicy wysokości końców biegu (NMT/LOD2, nie z wygładzonego gruntu na każdej stopnicy), spoczniki co najwyżej co 10–12 stopni zamiast rozciągania stopnic; (2) z daleka (od ok. 40 m) bieg jako jedna pochylnia z uśrednionym kolorem, bez linii podstopni; (3) kontrola skanu steps-riser-norm (podstopień i stopnica poza normą, nierówne stopnie w biegu) z bazą. Referencja: schody Placu Zamkowego, dwa biegi ze spocznikiem, szerokie granitowe stopnie (zdjęcie użytkownika w scratchpadzie ref/, tylko jako referencja wizualna).
- Status: naprawione (18.11, #593 scalony); wcześniej: w PR #593 (kurator r2 ZGODNE, d3097ea); wcześniej: naprawione w gałęzi (d3097ea), przegląd kuratora ZGODNE, PR; wcześniej: w naprawie, runda 2 (d3097ea), do przeglądu kuratora; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g840, 4f65035), do przeglądu kuratora; wcześniej: nowy
- Pakiet właściciela: packages/engine/src/renderer/mapcity (steps-plan), tools/glitch-scan
- Przegląd kuratora 15.11 @ 4f65035: NIEZGODNE (T-307). Do poprawy: (1) droga ze step_count dostaje tyle stopni, bez spoczników z maxRun (w1305889408: 40, w1305940836: 12, w1305940837: 13); (2) stopnica nie niżej niż 0,02 m pod terenem (15 biegów). Kontrole steps-count-osm, steps-landing-osm, steps-tread-sunk. Pochylnia od 35–45 m zaciera stopnie widoczne na zdjęciu z ok. 60 m: próg ok. 70 m. Kolor: G-850; podesty: G-849.
- Przegląd kuratora r2 (15.11, @ d3097ea): ZGODNE. Bieg główny w1305889408: 40 podstopni × 0,131 m, stopnice 0,38 m (2h+s 0,64), bez spocznika; stopnica najwyżej 0,005 m pod osią terenu (bez LIFT); pochylnia z daleka 65–75 m. Nawierzchnia i teren 0, hashe zgodne. Wzrost steps-riser-norm 4 → 23 klucze (28 trafień) uzasadniony. 21 trafień (16 kluczy) to biegi z OSM step_count, pod którymi teren gry wznosi się mniej niż liczba × 0,12 m (podstopień 0,047–0,119 m; ADR-0042: liczba z mapy ma pierwszeństwo przed normą), w tym 7 zamkowych (G-849). 7 trafień to za strome lub za krótkie pasy (stride 0,48–0,60): stare 572,-70 i 753–755,-149/-150 oraz nowe 730,160 i 736,143. steps-count-osm 14 kluczy (NMT 0,07–0,6 m na 3–15 stopni), steps-landing-osm 0, steps-tread-sunk 0. Otwarte z r1: stopnice z bliska za ciemne (do trawy 1,39 wobec 1,67–1,92 na zdjęciu; kontrola steps-albedo-drift).

### G-072 Walczący na pomoście nie schodzi pod most do gracza stojącego pod nim
- Status: naprawione (18.11, #627 scalony); wcześniej: naprawiony (main 16.11, #627); wcześniej: w PR #627; wcześniej: zgłoszone (z naprawy G-068)
- Ważność: S4 (proponowana) · Zasięg: pomosty z przejściem pod spodem · Koszt: średni (nawigacja między poziomami)
- Dowód: po G-062 `heightApart` daje 0 dla gracza pod mostem i walczącego na pomoście nad nim; walczący idzie do punktu nad graczem i stoi tam na pomoście, nie szuka zejścia
- Dodatkowo (weryfikacja G-068): pod wiaduktem Zamkowej zaalarmowany walczący idący Podwalem z lewej strony osi (chunk `stare-miasto-1-1`, 12–20 m od osi) utyka w (749.5–750.6, 180.4–181.4), także przed G-068
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: zaalarmowany walczący na pomoście Mełgiewskiej dociera do gracza pod mostem przez zejście w < 20 s
- Poprawka: zejście z pomostu przez landing (deck-landing.ts) + pastLedge/ontoDeck; deck-descent.test.ts i 3 przypadki w under-deck-ai.test.ts padają bez poprawki; hashe bez zmian. Część 'Dodatkowo' (Podwale 749.5–750.6, 180.4–181.4) niesprawdzona.

### G-071 Kule przelatują przez pomost
- Status: naprawione (18.11, #622 scalony); wcześniej: w PR #622; wcześniej: zgłoszone (z weryfikacji G-062)
- Ważność: S3 (proponowana; po G-062 da się stanąć pod mostem i strzelać przez pomost w obie strony) · Koszt: średni
- Dowód: ADR-0053 traktuje pomost jako podłogę dla ruchu, nie jako przesłonę dla strzałów i widoczności
- Pakiet właściciela: packages/sim (walka, linia widzenia)
- Test przyjęcia: strzał z pomostu do celu pod nim (i odwrotnie) trafia w pomost; świadek pod mostem nie widzi gracza na pomoście
- Przyczyna: GroundField.rayHit liczył tylko teren. Poprawka: rayDecks w deck.ts (płyta od powierzchni do spodu), w rayGeometry i lineOfSight. Test deck-cover.test.ts: 4/7 pada bez poprawki, 7/7 z nią. Hash determinism bez zmian.

### G-901 Próg samoobrony (session.lastThreat) poza zapisem: strzał gracza tuż po strzale wroga po wczytaniu liczy się jako przestępstwo
- Ważność: S4 · Zasięg: zapis i wczytanie do 3 s po strzale wroga
- Opis: Znalezione przy G-900 (czytanie kodu, bez pomiaru): session.lastThreat (próg 3 s, playerEngaged w world/street.ts) nie trafia do zapisu. Po wczytaniu strzał gracza w ciągu 3 s po strzale wroga liczy się jako przestępstwo, w grze żywej nie. Do potwierdzenia przez łowcę; sonda musi zapisywać przez calmForSave (jak SaveController.snapshot).
- Status: naprawione (18.11, #653 scalony); wcześniej: naprawione (PR #653); wcześniej: w PR #653; wcześniej: potwierdzone (łowca 16.11); wcześniej: do potwierdzenia
- Pakiet właściciela: packages/sim
- Łowca: lastThreat (combat-system.ts:128 threaten) nie wchodzi do SaveSnapshot, a calmForSave go nie zeruje. Po wczytaniu strzał gracza <3 s po strzale wroga, gdy w 30 m nie ma zaangażowanego AI (np. strzelec zabity), daje offend(gunfire): incidents 1 zamiast 0, ziarna 4, 1, 7 (scena streetSim, zapis jak SaveController.snapshot). Czytają go też scanner-system.ts:162 i hud-sync.ts:36 (isCalm), niezmierzone.

### G-898 Walczący w pasie 10 cm poniżej jezdni przy dolnym moście Mełgiewskiej nie wychodzi do gracza na pomoście
- Ważność: S4 · Zasięg: dolny most Mełgiewskiej, (2454,9; 297,05), gracz na nabrzeze-0-1[1] t=0,4
- Opis: Strome krawędzie terenu poniżej STEP_HEIGHT zatrzymują ruch (offTheBank), a raster ich nie widzi; odchylenie ±31° nie wyprowadza na wschód. Przed i po G-896 (#647). Źródło w imporcie terenu albo w regule offTheBank. Sondy: scratchpad g896-probe.test.ts.
- Status: naprawione (18.11, #655 scalony); wcześniej: naprawione (PR #655); wcześniej: w PR #655; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim (ruch, teren)

### G-896 Walczący przy końcu pomostu na poziomie jezdni nie idzie po pomoście do gracza
- Ważność: S4 · Zasięg: końce mostów z pomostem (Mełgiewska, wiadukt Zamkowej)
- Opis: Brawler z (2454.9, 297.0) do gracza na pomoście nabrzeze-0-1[1] w t=0,2 i z (758.0, 188.5) do gracza na wiadukcie Zamkowej (748.9, 173.4) stoi 20 s, deckLanding zwraca null; tak samo na main i z poprawką G-885. Znalezione przy G-885 (sondy: scratchpad g885-probe*.test.ts).
- Status: naprawione (18.11, #647 scalony); wcześniej: naprawione (PR #647); wcześniej: w PR #647; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Weryfikator #646: wiadukt Zamkowej, brawler z Podwala (745, 169.8) do gracza na pomoście (748.9, 173.4) wchodzi na pomost, ok. 25 s stoi w (758.0, 188.5), schodzi pod wiadukt i staje w (745.1, 170.0); w 60 s nie dociera. Do (755, 180) dociera w 8 s.

### G-895 Szybkie użycie apteczki pomija atut Field Medic
- Ważność: S4 · Zasięg: klawisz szybkiego użycia apteczki z atutem Field Medic
- Opis: item-system woła useConsumable bez healScale(perks); komenda use-item go stosuje, więc atut działa tylko przy komendzie. Znalezione przy G-892.
- Status: naprawione (18.11, #645 scalony); wcześniej: naprawione (PR #645); wcześniej: w PR #645; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-894 Dźwig 66 m przed fasadą Pałacu Lubomirskich od Placu Litewskiego (plac budowy Muzeum Ziem Wschodnich)
- Ważność: S4 · Zasięg: plac budowy w1362895448, widok z Placu Litewskiego
- Opis: Generator dźwigu (construction-crane.ts, ADR-0087 etap 2, gałąź place-budowy-2) stawia maszt w (41; 78) w południowej wnęce Pałacu Lubomirskich w67508859 (historic=castle), między fasadą a Placem Litewskim; 27,1 m, wysięgnik 66 m nad dachem zabytku. Ortofoto 2025-04: budowa trwa (wykop na pn. podwórzu, kontenery), żurawia wieżowego brak; 2024-06 we wnęce trawnik. Miejsce wynika tylko z minimalnego zasięgu do najdalszego narożnika obrysu, który obejmuje cały pałac. Proponowana reguła: na placu, którego obrys obejmuje budynek historic/heritage, maszt nie stoi między fasadą zabytku a placem lub ulicą frontową (preferuj podwórze z wykopem), inaczej bez dźwigu albo wysięgnik do 50 m; kontrola skanu site-crane-heritage z wyjątkiem w1236055101 (żuraw na ortofoto 2025-04).
- Status: naprawione (18.11, #649 scalony); wcześniej: naprawione (PR #649); wcześniej: w PR #649; wcześniej: nowe
- Pakiet właściciela: tools/osm-import, engine mapcity/construction
- Test przyjęcia: construction-site.test.ts: dźwig w1362895448 nie stoi przed fasadą w67508859; skan site-crane-heritage 1 -> 0
- Topografia: T-322.

### G-893 Rusztowanie placu Zielona 5A zasłania szyld lokalu na ścianie w67499313
- Ważność: S4 · Zasięg: jedno miejsce, Zielona 5A
- Opis: Rusztowanie z banerem z etapu 2 placów budowy (gałąź place-budowy-2) stoi przy ścianie w67499313 i zasłania szyld FRYZURA Z PRZYTUPEM; rusztowanie powinno omijać ściany z szyldem lokalu albo szyld przenieść.
- Status: naprawione (18.11, #649 scalony); wcześniej: naprawione (PR #649); wcześniej: w PR #649; wcześniej: nowy
- Pakiet właściciela: osm-import
- Poprawka identyfikatora (kurator 16.11): rusztowanie stoi 0,25 m od szczytowej ściany w69915878 (Zielona 5), nie w67499313; szyld FRYZURA Z PRZYTUPEM sprawdzić na tej ścianie.

### G-892 Maksimum zdrowia po awansie albo implancie spóźnia się o krok: apteczka zaraz potem leczy do starego
- Ważność: S4 · Zasięg: krok awansu lub założenia implantu
- Opis: playerStatsOf().maxHp trafia do health.max dopiero w player-control; item-system i komenda use-item idą przed nim (systems/index.ts:134-135). Deterministyczne, nie rozjeżdża zapisu. Znalezione przy G-888.
- Status: naprawione (18.11, #643 scalony); wcześniej: naprawione (PR #643); wcześniej: w PR #643; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-885 Walczący pod mostem nie wchodzi na pomost do gracza stojącego na nim
- Ważność: S4 · Zasięg: mosty z pomostem (Mełgiewska)
- Opis: Brawler z (2445.9, 302.2) pod pomostem do gracza na (2444.9, 307.5) oscyluje przy krawędzi cienia pomostu (2449.6, 298.9), 30 s bez dotarcia; znalezione przy G-072
- Status: naprawione (18.11, #646 scalony); wcześniej: naprawione (PR #646); wcześniej: w PR #646; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai

### G-874 Zamek Lubelski: skrzydło pn. x 904-942 o 2,6-3,0 m za daleko na północ (uskok obrysu OSM), bryła na asfalcie drogi za zamkiem
- Ważność: S3 · Zasięg: Podzamcze, w48500136, (903,9..941,5; 253,8..261,6)
- Opis: Węzły (903,9;261,6) i (941,5;256,8) tworzą uskok, którego nie ma w NMPT (krawędź x 910/925/940: z 257,75/256,3/254,0) ani na ortofoto 2023-09..2025-04; ściany zach. i pd. zgodne do 0,4 m. Poprawka: obrys pn. prosto (903,6;258,6)->(941,0;253,8) w korekcie importu. Przegląd kuratora G-841 r3. Proponowana kontrola landmark-outline-nmpt (baza 1).
- Status: naprawione (18.11, #616 scalony); wcześniej: naprawione (PR #616); wcześniej: przegląd kuratora ZGODNE (890681a), w PR; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g874 (890681a), do przeglądu kuratora; wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: krawędź obrysu pn. w48500136 w 0,5 m od krawędzi dachu NMPT przy x 910, 925, 940
- 16.11: drop węzłów uskoku w korekcie importu; ściana x 910/925/940 z 257,75/255,77/253,79 (odchyłka do 0,53 m przy x 925, wewnątrz dachu); kontrola landmark-outline-nmpt 1->0; 2 klucze przyjęte przez agenta (landuse-bare podzamcze-1-0 910,250; bare-on-cover podzamcze-2-0 930,250: goły pas odsłonięty spod bryły, G-699) — do potwierdzenia użytkownika; kolizja z #602: łatka g874-x602-resolution.patch
- 16.11 użytkownik zatwierdził 2 przyjęte klucze (pas spod bryły, G-699).
- 16.11 przegląd kuratora 890681a: ZGODNE (odchyłka jednostronna, ściana 0,2-0,5 m w głąb krawędzi dachu NMPT = okap; próg 0,55 akceptowalny; zniknięcie narożnika 941,0;253,8 słuszne)

### G-841 Zamek Lubelski bez przepisu zabytku: fasada od Placu Zamkowego jak zwykły gmach
- Ważność: S3 · Zasięg: Zamek Lubelski, front od Placu Zamkowego i schodów
- Opis: Zgłoszenie użytkownika 15.11 ze zdjęciem frontu (Street View, tylko referencja wizualna, scratchpad ref/zamek-plac-zamkowy-sv.jpg). LANDMARK_RECIPES ma tylko Bramę Krakowską, Bramę Grodzką i Nowy Ratusz. Wygląd do odtworzenia: neogotycka fasada w kolorze kremowym, dwie wieżyczki po bokach bramy z krenelażem i masztami flag, między nimi blankowana attyka; dwa okrągłe okna-rozety nad ostrołukową bramą z napisem MUZEUM; ostrołukowe okna w rzędzie, długie skrzydła z krenelażem po bokach; po lewej w głębi wieża kaplicy (smukła iglica); u stóp schody ze spocznikiem, latarnie i zieleń na skarpie. Wymiary z LOD2/NMPT i OSM, jak przy G-119 (Nowy Ratusz).
- Status: naprawione (18.11, #602 scalony); wcześniej: naprawione (PR #602); wcześniej: w PR #602; wcześniej: kurator r3 ZGODNE, do PR (6eea580); wcześniej: do przeglądu kuratora (r3, 6eea580); wcześniej: w naprawie (runda 3 po przeglądzie kuratora r2); wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-g841 (0c22d9d), runda 2 do przeglądu topography-curator; wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-g841 (e84492c), do przeglądu topography-curator; wcześniej: nowy
- Pakiet właściciela: packages/engine/src/renderer/mapcity/landmarks
- 15.11: przepis zamek-lubelski (attyka do y 7,5 z blankami, wieżyczki do y 10 z flagami, parapet z blankami trójkątnymi, 2 rozety, portal ostrołukowy, lancety, szyld MUZEUM); korekta importu: okap y 3,3, korona y 7,5 z NMPT; test landmark-zamek.test.ts; skan 3900->3900, hashe bez zmian, perf w budżetach
- Przegląd kuratora 15.11 (e84492c): NIEZGODNE. NMPT 0,5 m: wieżyczki do y 12,2 (rise 2,5 -> ok. 4,7), szczyty blanków trójkątnych ryzalitu y 10,0-10,4 (parapet.rise 0,5 -> ok. 1,6), maszty do ok. y 15,5 (mast ok. 5,5 m) jako ciemne metalowe iglice z chorągiewką zamiast flag biało-czerwonych (zdjęcie z placu, plan Z2). Skrzydła fasady zachodniej: jeden rząd lancetów w parterze, wyżej lizeny, okienka okrągłe co ok. 4,7 m i fryz ostrołukowy pod koroną zamiast rzędów 2 i 3. Opcjonalnie: rozety r ok. 1,7 m, rozstaw ok. 3,4 m; środki wieżyczek ok. 0,9 m do wnętrza (NMPT (837,1; 245,9) i (835,8; 231,0)). Sondy topo-g841-dsm*.py w scratchpadzie.
- 15.11 runda 2 (0c22d9d): wg NMPT kuratora: wieżyczki y 12,2, iglice do y 15,5 z chorągiewką, parapet ryzalitu do y 10,3, skrzydła: lancety w parterze, lizeny, okienka okrągłe 10 m, fryz arkadowy; rozety r 1,7; sterczyny; środki wieżyczek bez zmian (brak reguły z obrysu). Skan 3900->3900, hashe bez zmian, perf w budżetach
- Przegląd kuratora r2 (0c22d9d): NIEZGODNE. Przyjęte: wieżyczki y 12,2, iglice do 15,5, parapet 10,3, rozety, skrzydła zachodnie, środki wieżyczek (wspólne przesunięcie OSM/NMPT ok. +0,7 m w z, rozstaw 14,9 vs 14,95). Do poprawy: (1) korona skrzydła pn. od x ok. 855 i ściany wsch. (945..948, 237..257) wg NMPT y 5,4-5,8 zamiast 7,5 (regresja wobec main 6,4), okap pn. od dziedzińca ok. 4,5; (2) sterczyny tylko na NW (842,1;266,1) do y 10,3, SW (836,1;210,9) do 9,4, SE (943,6;197,9) do 10,9, ośmiobok o średnicy ok. 1,3 m z ostrym hełmem; bez sterczyn na narożach pd. (883;201), (897;200) i NE. Opcjonalnie portal i rozety 1-2 m wyżej. Elewacja pd. przepalona w słońcu (12,7%). Proponowana kontrola landmark-crown-nmpt. Sondy i zrzuty: scratchpad topo-g841-r2-*
- Runda 3 (6eea580): korona wg stref NMPT (pn. za x 855 i wsch. y 5,6, okap dziedzińca pn. 4,5), sterczyny tylko NW/SW/SE z hełmami, rozety +2 m, kontrola skanu landmark-crown-nmpt 1->0; do przeglądu topography-curator
- r3 (6eea580) przegląd kuratora: ZGODNE (korona 5,6/okap 4,5, 3 sterczyny, rozety); wysokości w przepisie jako T celowe; uskok OSM pn. skrzydła osobno (G-874)

### G-836 Zebry z węzłów: kąt do jezdni, koniec poza krawężnikiem, paski i poświata na chodniku
- Ważność: S3 · Zasięg: crossing-shape: skew 19, overhang 26, glow 54, kerb 55; Podzamcze, Krakowskie, Nabrzeże, Stare Miasto
- Opis: crossingBand (ground.ts) i stretchZebras (kerb-fill.ts) kładą prostokąt o stałych wymiarach wokół węzła z osią najbliższego segmentu OSM, niedopasowany do poszerzonej jezdni (kerbFills, widened). Kontrole w PR #581; zrzuty scratchpad/jag/final/f1–f6
- Status: naprawione (18.11, #597 scalony); wcześniej: naprawione (PR #597); wcześniej: w PR #597; wcześniej: w PR #597 (kurator r3 ZGODNE, 748ef6c); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g836, e181e1b, runda 2, do przeglądu kuratora); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g836, c52dde6, do przeglądu kuratora); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- 15.11: skew 19->5, overhang 26->9, glow 54->5, kerb 55->44; reszta: wyloty skrzyżowań, brzeg mapy, oś pasma vs ROAD_CHAINS; droga przejścia jako footway pod zebrą; zmieniony test G-811 (chodnik pod zebrą)
- Przegląd kuratora 15.11 @ c52dde6: NIEZGODNE. P1 (2361,432) n4087364975 zebra obrócona o 35° (regresja), oś wzdłuż w406693442 N–S, ok. 10 m; P2 (927,468) w1054556913 zebra 6,5 m, asfalt gry dalej o 6,2/≥11,9 m, na ortofoto ok. 22 m (regresja); P3 (913,345) n4586176953 zebra ok. 50° skośnie, ma biec W–E przez w739432830, ok. 11 m. Reguła: zebra węzła na skrzyżowaniu wzdłuż drogi pieszej OSM przez węzeł; zasięg po asfalcie gry do krawężnika. Kontrole: crossing-off-path (baza 9), crossing-short-of-asphalt (baza 16). Klucz lamp-on-orto-carriageway (−128,−65) przyjąć z powodem: cień budynku na chodniku, krawężnik z ≈ −64,4. Runda 2.
- 15.11 r2: P1–P3 poprawione; crossing-off-path 11->10, crossing-short-of-asphalt 16->8; zebry skrzyżowań wzdłuż ścieżki OSM (f4 12,5° od prostopadłej), zasięg po asfalcie gry z area:highway; P1 6,2 m (asfalt gry węższy), środek P3 3,6 m od punktu kuratora
- Przegląd kuratora r2 (15.11, @48a15ce): NIEZGODNE. P1–P3 kierunek zgodny. Regresja f4 (621,−218) w305027462: 12,1° od prostopadłej do Podwala, na ortofoto zebra prostopadła (azymut ok. 152°). Oczekiwane: kąt gry 24 ± 5, środek ok. (620,6; −220,5); wyjątek wzdłuż ścieżki tylko dla węzłów, nie dla dróg footway=crossing; usunąć klucz skew (621,−218). Runda 3 nowym agentem.
- r3 @ 748ef6c: f4 prostopadła do Podwala (24,3°), footway=crossing zawsze prostopadła, service nie tworzy skrzyżowania; koniec przy chodniku boku (G-837 Kapucyńska); skew 7->4, kerb 42->46 przyjęte przez accept (konflikt z kerb-jag), czeka na decyzję użytkownika
- Przegląd kuratora r3 (15.11, @748ef6c): ZGODNE. f4 (621,−218) prostopadła do Podwala, środek (620,5; −217,2), 5,55 m; od ortofoto 1,28 m wzdłuż ulicy (węzeł OSM 817070507, przyjęte) i 3,0 m w poprzek (T-063). Reguła footway=crossing zmieniła tylko f4 (12,2°) i (1061,455) (2,9°, T-312). Koniec boku: 25 zebr przesuniętych o 0,03–1,7 m, bez obrotów. Teren i pomosty 0, hashe zgodne. Klucze ze scalenia: bollard-blocks-mouth 278,−166 (słupek G-820 +0,4 m, 10→10) przyjęty; kerb −122,50, 185,75, 1090,255 do G-869

### G-825 Jezdnia importu węższa od prawdziwej przy łącznicach, kieszeniach skrętu i placement=left_of; pas wypełnia bruk z pokrycia
- Ważność: S3 · Zasięg: Mełgiewska/łącznica Andersa w40051729, Al. Solidarności w215609082 (kieszenie skrętu), Lwowska (placement=left_of:3)
- Opis: Znalezione przy G-821: import nie czyta placement i nie poszerza jezdni o łącznice i pasy skrętu; pas do prawdziwego krawężnika wypełnia bruk z pokrycia ortofoto, więc latarnie i meble przy krawężniku mapy stoją na prawdziwym asfalcie.
- Status: naprawione (18.11, #595 scalony); wcześniej: naprawione (PR #595); wcześniej: w PR #595 (kurator r5 ZGODNE, e3133eb); wcześniej: w naprawie (runda 2 po przeglądzie kuratora, gałąź ccr-ec2c4269-ilh8k8-g825); wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import, tools/orto
- 15.11 przegląd kuratora (41ddd97): NIEZGODNE. Placement zgodne z ortofoto; zwężenie przy węźle kładzie pół pasa łącznicy za krawężnik: Ruska w216655518 (1071..1074; 428..437) jezdnia na trawie ok. 12 m², Andersa w40051729 (2316..2322; 312..321) jezdnia i chodnik na trawie ok. 12 m², Solidarności w215609082 s 0-6 krawędź 7,7 m wobec 6,3 (ok. 5 m² na szpicu trawnika). kerb-fill-wide-estimated (1113,353) to fałszywy alarm (kostka dojścia do przejścia). Runda 2 naprawiacza.
- 15.11 runda 2: 4f9cf2f + merge ed53299; skan 3842 → 3833, nowa kontrola lane-place-on-green (baza 0); do ponownego przeglądu kuratora, w tym 5 sygnalizatorów przestawionych przy remisach
- Przegląd kuratora r2 (15.11, ed53299): NIEZGODNE. Ruska, Andersa (trawa), Solidarności i szwy zgodne. Do poprawy: pas trawnika z kerbFills na bruku i asfalcie (1088,9-1091,5; 456-472) +21,8 m² i (1110,5-1119; 274,35-276) +13,1 m²; reguła remisu sygnalizatorów pogarsza (-104,3;121) i (-104,1;49,7); n1946478264 (1104,1;264,7) 3,6 m w jezdni łuku (krawężnik placu z≈261,0, 2024-06). Runda 3 nowym agentem. Szczegóły: scratchpad/topo-g825-r2-raport.md
- 15.11 r3 7bfd370: pas do trawnika tylko przy szczelinie ≤ 0,6 m albo przy zieleni na ortofoto, szerszy jako square; reguła remisu sygnalizatorów wycofana (17 z 18 jak na main); kontrola lawn-strip-on-paving, baza 0. n1946478264 zostaje na klinie (1094,5; 279) jak w r1: obie pozycje docelowe wymagają nowej reguły, decyzja orkiestratora: sprawa G-842. Czeka na przegląd kuratora (Lwowska z 397–439 plamista, grządka 1110–1119; 514–522 jako square).
- Przegląd kuratora r3 (15.11, @ 7bfd370): NIEZGODNE, 1 poprawka. Zgodne: A (trawa od x 1090,9 / 1090,1 / 1090,2 / 1091,5 przy z 458 / 462 / 465 / 469; zdjęcie 1091,0 / 1090,0 / 1090,3 / 1091,5), B (square z 274,3–274,8 do 275,9–276,7, bez trawy przy z < 275,9), grządka square jak main i zdjęcie, 5 sygnalizatorów co do 0,0 m jak na main, lawn-strip-on-paving 0, teren 0, hashe zgodne. Do poprawy: pas przy przesuniętej krawędzi zmienia nawierzchnię co 1–3 m (square albo trawa do jezdni): Lwowska, zach. krawędź z 397,5–420,2 (7 przebiegów po 1,5–3 m) i z 337,8–365 (6 przebiegów po 1–5,8 m), A z 462,5–464,4 (2 m trawy do jezdni między pasami square). Zdjęcie 2023-09: na całych odcinkach ciągły trawnik i jasny krawężnik 0,5–1 m. Oczekiwane: jedna nawierzchnia na odcinek krawędzi, bez przebiegów krótszych niż 5 m między przebiegami drugiej (np. square z 392–442 i z 337,8–365). Kontrola: kerb-fill-flicker.
- 15.11 r4 d00cf52: pas do trawnika jedną nawierzchnią na odcinek (lawnStretches), kontrola kerb-fill-flicker (baza 63, wszystkie z main); do kuratora: łącznica Ruskiej (1068–1073; 432–447) square 1–1,5 m częściowo na zieleni ortofoto
- 15.11 kurator r4 d00cf52: NIEZGODNE. Lwowska z 337–365 i 390–441, A z 453–474, Solidarności zgodne z ortofoto. Łącznica Ruskiej w216655518 (1064–1074; 432–444): square 1,0–1,8 m na trawniku (+10,2 m² na zieleni), ortofoto 2023-09/2024-06/2025-04: trawnik od krawędzi jezdni. Przyczyna: weto jednej twardej próbki w lawnStretches (5 z 37). Oczekiwane: trawa z 432–444, square tylko przy zebrze z 444–447,5. Drobne: Andersa (2355,6–2356,6; 357–358) trawa zamiast square 0,3–0,8 m.
- r5 e3133eb: odcinek trawnikiem przy zielonych >1/2 i twardych <=1/5, twardy koniec przy zebrze square; Ruska trawa od krawężnika; scalenie main aa247de (konflikt z G-837)
- 15.11 kurator r5 e3133eb: ZGODNE. Ruska trawa od krawężnika z 431,8–444,5 (17 z 18,6 m² na zieleni ortofoto), square przy zebrze; Lwowska, A, Solidarności, Andersa bez zmian; G-837 zachowane (kerb-jag-places zielony, krakowskie i stare-miasto jak main); hashe zgodne, skan = baza; klucze bazy uzasadnione (kerb-jag 1050,440 = G-860). Resztki S4 w osobnym zgłoszeniu.
- Kurator 16.11 (a29a7d4): ZGODNE; evenKerbs przybliża do ortofoto, 4 próbki trawy 0–0,5 m poza parkingiem w granicy dokładności OSM

### G-897 Migotanie trawa/plac przy końcu zebry (podzamcze-2-1)
- Ważność: S4 · Zasięg: podzamcze-2-1 1060,470, koniec zebry między placami
- Opis: Po G-836 (zebry przy placach, #597) 1 m trawy między placami przy końcu zebry migocze z placem (kerb-fill-flicker). Klucz przyjęty w bazie decyzją użytkownika 16.11, do naprawy w imporcie (kerb-fill.ts).
- Status: naprawione (18.11, #654 scalony); wcześniej: naprawione (PR #654); wcześniej: w PR #654; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import
- Klucze skanu: kerb-fill-flicker podzamcze-2-1 1060,470

### G-731 NPC stoją w pozie z rękami do góry
- Status: naprawione (18.11, #711 scalony); wcześniej: w PR #711; wcześniej: do potwierdzenia przez użytkownika (18.11: nie odtworzone); wcześniej: zgłoszone (12.11, zgłoszenie użytkownika); do zrobienia razem z pozycją backlogu „Animacje ruchu” (po mapowaniu, pierwszy priorytet)
- Ważność: S3 (widoczne na każdym kroku, wiele postaci) · Zasięg: domyślna poza części NPC z modelami VRM to ręce do góry, czyli T-/A-poza pliku modelu; przypuszczalnie przeniesienie pozy z riga (`HumanoidRetarget`, ADR-0076, decyzja „ramiona opuszczone zamiast T-pozy pliku”) nie działa albo działa za późno w części przypadków — możliwa regresja; do ustalenia: które postacie, kiedy (wczytanie, podmiana modelu, LOD, poza aktywności)
- Pakiet właściciela: packages/engine (renderer: modele postaci, retarget)
- Test przyjęcia: test renderera, że żadna postać z modelem nie ma w żadnej klatce kąta ramion T-/A-pozy (poza zamierzonymi pozami); zrzut tłumu przed/po
- 18.11: nie odtworzone na main z ADR-0090 (#706-#709). Sonda w silniku na modelach z manifestu gry (10 cywilów, 4 gangerów, 3 korporacyjnych): stanie, chód, każda czynność ADR-0040, oddalenie poza zasięg rysowania i powrót, model z puli po zniknięciu, nokaut, śmierć: żaden model nie ma ramienia T/A-pozy (poza zamierzonymi: palacz 58°, nokaut z ręką nad głową, upadek). Na żywej grze (e2e, scena gry przez Engine.Instances) przy NPC z Neon Koi i dokach: 20 ramion modeli, wszystkie w dół; podniesione tylko ręce widoku FPP. Tłum (ADR-0041) to kukiełki bez modeli. Do użytkownika: gdzie i kiedy to widać (miejsce, pora, zrzut).
- 18.11 (po zrzucie użytkownika z targu w Alchemii): przyczyna znaleziona. To nie T-poza ani ładowanie, tylko proceduralne pozy czynności na modelach VRM: lean zgina obie ręce przy głowie (wygląda jak ręce do góry), phone podnosi też wolną rękę do twarzy, smoke podobnie. Zrzut przed/po na main i z #711 (hana, sachiko, 1629-1631, goro, fumiko). Poprawka w #711: klipy Mixamo dla smoke, phone, talk, terminal i lean (lean: weight shift, w paczkach nie ma oparcia o ścianę). Test activity-hands-model: bez poprawki lewa dłoń nad barkiem przy lean, z poprawką obie poniżej. Zostają proceduralne: sweep, cook, eat, drink, sit, sleep, guard.

### G-916 Atlas nazw (32 miejsca) pełny w całym mieście: część tabliczek nazw nie jest rysowana
- Ważność: S4 · Zasięg: całe miasto, tabliczki nazw w mapcity
- Opis: Znalezione przy podziale testu map-city (#659, 17.11): zbudowane osobno części miasta rysują o 360 wierzchołków szyldów więcej niż całe miasto, bo NAME_SLOTS = 32 na całe miasto i w pełnym mieście brakuje miejsc. Do triage: znany limit czy glitch (które tabliczki znikają i gdzie; czy atlas powinien działać per komórka albo w zasięgu kamery).
- Status: naprawione (17.11, #701 scalony); wcześniej: w PR #701; wcześniej: zgłoszone; wcześniej: zgłoszone
- Pakiet właściciela: packages/engine
- 17.11 (orkiestrator, tryb bez agentów): glitch, nie znany limit. 126 nazw budynków w mieście na 32 wiersze, jeden fragment mapy do 17 nazw; wiersz był trzymany do końca sesji, więc po kilku dzielnicach tabliczki następnych znikały. Poprawka w #701: komórka oddaje wiersze swoich nazw, gdy znika albo jest budowana od nowa; napisy zabytków przypięte. Test map-names-atlas.

### G-918 Ogłuszenie z tyłu bez XP i bez łupu, zabicie daje +60 XP i torbę
- Ważność: S4 · Zasięg: każdy takedown nieletalny (ADR-0065, ADR-0075)
- Opis: Łowca 17.11 (sonda sim, poz. 1, Hebi ganger z tyłu w kucaniu, bez świadków): ogłuszenie 0 XP, bez torby (łup przy śmierci), znalezione ciało budzi wroga po 6 s z alerted; zabicie takedownem +60 XP, torba, rep Hebi -4. Poza XP stylu stealth brak powodu ogłuszać. Do rozstrzygnięcia z ADR-0075/0059: XP z ogłuszenia albo łup z nieprzytomnego. Pewność średnia (zamierzenie nieczytelne).
- Status: naprawione (17.11, #696 scalony); wcześniej: w PR #696 (gałąź ccr-ec2c4269-ilh8k8-g918), decyzja użytkownika 17.11: łup z nieprzytomnego; wcześniej: w naprawie (orkiestrator): decyzja użytkownika 17.11, łup z nieprzytomnego; torba ogłuszonego 0,8 m za ciałem, bez drugiej przy śmierci; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-912 Teksty Genzō po drodze głośnej i po 06:00 nie pasują do wyniku
- Ważność: S4 · Zasięg: wypłata drogi głośnej i porażka batch-shipped
- Opis: Playtest 17.11: po głośnej "Nikt nic nie widział, nikt nic nie słyszał" (phone_genzo_paid). Po porażce o 06:00 bez alarmu: "Tessen już wie…", a Tessen zostaje 0. Do sprawdzenia przy okazji: toast "Bag gone / Someone was faster." o 03:20 (możliwy wyciek z kuriera M0). Rozwiązanie: osobne telefony phone_genzo_w3_paid_loud i batch-shipped.
- Status: naprawione (17.11, #695 scalony); wcześniej: w PR #695 (gałąź ccr-ec2c4269-ilh8k8-g912); wcześniej: zgłoszone
- Pakiet właściciela: packages/narrative
- Łowca 17.11: toast 'Bag gone' to ogólne wygasanie toreb po 300 s (osobny wpis), nie kurier M0.

### G-926 Punkt (600; 30) testu pościgu W-3 leży w bryle
- Ważność: S4 · Zasięg: test w3-sabotage-loud, sondy
- Opis: Pole do (600; 30) jest null z każdej strony; oddział tam nie dojdzie.
- Status: naprawione (17.11, #674 scalony); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: punkt testu w otwartej, połączonej komórce

### G-921 Wczytanie na drabinie gubi jeden krok wspinaczki i jump.coyote
- Ważność: S4 · Zasięg: każda drabina, zapis w trakcie wspinaczki
- Opis: Znalezione przy G-913 (17.11): po wczytaniu gry zapisanej na drabinie pierwszy krok idzie na ponowne zawieszenie (continue po hangOn w ladder-system.ts), więc wczytana gra traci jeden krok wspinaczki; różni się też jump.coyote (0,12 kontra 0). Gdy gracz dalej się wspina, schodzi i idzie pod kątem, hash rozjeżdża się o kilka cm pozycji (w3-pipe, targ-escape-2/3). Przyczyna wspólna: stan wspinaczki (climb, settle) nie trafia do zapisu.
- Status: naprawione (17.11, #694 scalony); wcześniej: w PR #694 (gałąź ccr-ec2c4269-ilh8k8-g921); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: zapis na drabinie w trakcie wspinaczki, wczytanie, 600 kroków z tymi samymi wejściami: hash równy
- Weryfikator #668 (17.11): potwierdzone na main tymi samymi wartościami (krok wspinaczki, jump.coyote 0,12 kontra 0); na pawilonie przy zeskoku skokiem daje dy -4,6 m. Sonda: scratchpad v-g913-sonda2.test.ts. Uwaga poboczna: przy chodzeniu w stronę szczytu w3-hatch drabina nie łapie gracza (main i gałąź), może celowo (właz).

### G-936 Ogłuszony strażnik dalej podaje bark-hak
- Ważność: S4 · Zasięg: haki z barków (hook-tracker), strażnicy zleceń
- Opis: Znalezione przy weryfikacji G-929: bark w hook-tracker.ts:85 nie sprawdza obezwładnienia; dla palacza W-3 (ofJob) poprawione w #683, dla pozostałych nosicieli nie.
- Status: naprawione (17.11, #693 scalony); wcześniej: w PR #693 (gałąź ccr-ec2c4269-ilh8k8-g936); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: ogłuszony nosiciel haka nie podaje haka

### G-937 Ostrzeżenie o pościgu Tessen bez oddziału do końca odcinka dnia
- Ważność: S3 · Zasięg: pościg Tessen, klinika, kadr wejścia
- Opis: Po G-934 (#686): gdy oddział nie wejdzie w 20 s po ticku (Seki w kadrze jedynego wejścia, klinika), flaga w drodze znika, a losowanie odcinka jest zużyte; toast był, oddział nie przychodzi do końca odcinka (sonda S4 weryfikatora: następny po 167 s, najgorzej ok. 6 min). Decyzja użytkownika 17.11: razem z flagą w drodze znika losowanie odcinka, więc po chwili wypada nowe losowanie z nowym ostrzeżeniem.
- Status: naprawione (17.11, #692 scalony); wcześniej: w PR #692 (gałąź ccr-ec2c4269-ilh8k8-g937, 3ae283c), diff przejrzany przez orkiestratora; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: oddział porzucony po 20 s: następne losowanie w tym samym odcinku z nowym toastem 20-40 s przed wejściem

### G-931 Pendrive w3_virus niewidoczny dla gracza (keyItems bez UI i nazwy)
- Ważność: S4 · Zasięg: ekwipunek, droga cicha W-3
- Opis: Znalezione przy weryfikacji G-907: keyItems nie ma widoku w ekwipunku ani klucza nazwy w katalogach i18n.
- Status: naprawione (17.11, #691 scalony); wcześniej: w PR #691 (gałąź ccr-ec2c4269-ilh8k8-g931); wcześniej: zgłoszone
- Pakiet właściciela: packages/ui
- Test przyjęcia: ekwipunek pokazuje przedmioty kluczowe z nazwą en i pl

### G-930 Podpowiedź kolektora W-3 widoczna ze szczytu ścian skrzydłowych wylotu
- Ważność: S4 · Zasięg: wylot kolektora W-3
- Opis: Znalezione przy weryfikacji G-907: z (406,0) i (408,4) na ok. -0,1 m widać prompt.culvert, klawisz przenosi 1,4 m niżej do kolektora.
- Status: naprawione (17.11, #690 scalony); wcześniej: w PR #690 (gałąź ccr-ec2c4269-ilh8k8-g930); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: podpowiedź tylko z dna wylotu

### G-929 Hala W-3 bez egzekutora przebrań: kombinezon technika całkiem bezpieczny
- Ważność: S3 · Zasięg: droga cicha W-3
- Opis: Po #675 (G-907) c1-g0..g3 mają enforcer=false; ADR-0082 §1 p. 2 daje tę rolę kierownikowi zmiany, którego w hali nie ma (propozycja: biuro antresoli). Pytanie do użytkownika.
- Status: naprawione (17.11, #683 scalony); wcześniej: w PR #683 runda 3 (ff4eb7b, orkiestrator): zwłoki palacza zostają, kierownik nie zostaje w oknie przy ciele, testy skrócone; bez weryfikatora (tryb bez agentów); wcześniej: w naprawie, runda 3 (orkiestrator w trybie bez agentów; r2 odrzucona: palacz zabity znika o 23:00, kierownik po ciele w alei stoi w oknie na stałe, test tropu w app 6,4 s z pokryciem); wcześniej: w PR #683 runda 2 (decb31a), w weryfikacji; wcześniej: w naprawie, runda 2 (PR #683: kierownik po tropie schodzi do hali i nie wraca; postój przy oknie); wcześniej: w PR #683 (gałąź ccr-ec2c4269-ilh8k8-g929, a03c66a), w weryfikacji; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: w przebraniu kierownik zmiany rozpoznaje Seki z bliska
- Decyzja użytkownika 17.11: etap 2 drogi cichej to kierownik zmiany w biurze antresoli jako egzekutor przebrań; palacz enc_w3_smoker tylko wskazuje szafkę 14; furtka zostaje otwarta (hak rurociągu zamiast kodu). Wgranie wirusa nie wymaga pendrive'a.
- Decyzje użytkownika 17.11 po etapie 2: kierownik zmiany dostaje jeden krótki postój (ok. 4 s) przy oknie galerii nad linią na okrążenie (ok. 50 s), osobny mały PR po #683; palaczowi wystarczy kwestia z hakiem, bez pełnego spotkania enc_w3_smoker.

### G-923 Uszkodzona flaga oddziału pościgu Tessen blokuje losowania do końca pościgu
- Ważność: S4 · Zasięg: tylko uszkodzony zapis
- Opis: Weryfikator #671 (17.11): tessenSquadDue przy fladze tessen-hunt-squad:abc daje tick NaN, oddział nigdy nie wchodzi, a flaga blokuje kolejne losowania do końca pościgu. Rozwiązanie: odrzucić albo zdjąć niepoprawną flagę (walidacja przy wczytaniu albo w systemie).
- Status: naprawione (17.11, #689 scalony); wcześniej: w PR #689 (sam test: naprawione przez #686); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: flaga tessen-hunt-squad:abc nie blokuje losowania

### G-915 Toast 'Bag gone / Someone was faster' dla każdej wygasłej torby, także dalekiej
- Ważność: S4 · Zasięg: każda walka z łupem
- Opis: Łowca 17.11: LootExpired (loot-system.syncBags po 300 s, addContainer przy limicie 12) presenters/loot.ts zawsze pokazuje jako 'Someone was faster', choć nikt torby nie wziął; także dla toreb w niezaładowanych chunkach i wypartych limitem. W W-3 głośnej 7 toreb załogi wygasa 305-333 s po zabiciu, 1 toast (scalany). Nie wyciek z kuriera M0. Do rozstrzygnięcia: toast tylko dla toreb w pobliżu gracza albo inny tekst (i18n en/pl).
- Status: naprawione (17.11, #688 scalony); wcześniej: w PR #688 (gałąź ccr-ec2c4269-ilh8k8-g915); wcześniej: zgłoszone
- Pakiet właściciela: packages/app
- Test przyjęcia: presenter nie pokazuje 'Someone was faster' dla torby, której nikt nie wziął

### G-919 Linia bonusu kontraktu stoi pod celem, który HUD akurat pokazuje, także cudzym
- Ważność: S4 · Zasięg: każdy rodzaj kontraktu przy przypiętym albo pierwszym wątku głównym
- Opis: Znalezione przy G-905 (17.11): BonusIndicator pokazuje bonus aktywnego kontraktu zawsze, nie patrzy na shownEntryId; przy przypiętym wątku głównym w trakcie W-3 albo przy kontrakcie, który ustępuje wątkowi (eliminate, delivery…), bonus wisi pod celem wątku. Rozwiązanie: pokazywać bonus tylko, gdy HUD pokazuje kontrakt.
- Status: naprawione (17.11, #687 scalony); wcześniej: w PR #687 (gałąź ccr-ec2c4269-ilh8k8-g919); wcześniej: zgłoszone
- Pakiet właściciela: packages/ui
- Test przyjęcia: przypięty wątek główny w trakcie kontraktu: brak linii bonusu pod jego celem

### G-934 Oddział pościgu z flagą powrotu wchodzi bez ostrzeżenia wiele godzin po toaście
- Ważność: S4 · Zasięg: pościg Tessen
- Opis: Znalezione przy weryfikacji G-922 r3: flaga tessen-hunt-back przechodzi przez odcinki dnia, więc oddział może wejść bez toastu długo po ostrzeżeniu. Do rozważenia toast przy ponownym wejściu po zmianie odcinka.
- Status: naprawione (17.11, #686 scalony); wcześniej: w PR #686 (gałąź ccr-ec2c4269-ilh8k8-g934, a813f9b), w weryfikacji; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g934); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: oddział z tessen-hunt-back po zmianie odcinka dnia: toast przed wejściem
- 17.11 przy blokadzie czekania (#682): po końcu odcinka flaga tessen-hunt-back wisi (czekanie 10 h), system wychodzi przed losowaniem, a gdy Seki stanie tam, dokąd prowadzi droga, oddział wchodzi w 1 s bez flagi w drodze i bez toastu; losowanie bieżącego odcinka przepada. Naprawa: po końcu odcinka z flagi (od #682 niesie @dzień:odcinek) zdjąć flagę powrotu i wayless, żeby kolejne losowanie szło zwykłą drogą z ostrzeżeniem.
- 17.11 weryfikacja #682: to samo dotyczy flagi w drodze tessen-hunt-squad: gdy Seki jest tam, gdzie nie ma wejścia (np. klinika, wejścia bliżej niż 60 m wykluczone), gałąź due wraca bez zdjęcia flagi i flaga wisi do wyjścia albo końca pościgu. #682 ogranicza tylko blokadę czekania (do ticku przyjścia + zapas), reguła sim zostaje do tej poprawki.

### G-928 Walka w korytarzu S W-3 kosztuje 2-8 ms na krok (uciekający cywile i objazdy przeszkód)
- Ważność: S3 · Zasięg: walki z falami W-3, testy sesji walk (bramka czasu na main)
- Opis: Profil testu w3-start-save-session (korytarz S, 18 s): civilian-ai FleeFromDanger ok. 1 s z 2,2 s symulacji, world-barriers piecesOf/barrierBlocked 1,3 s (detourStep), rastry nav-raster finish 0,9 s. Testy korytarza 11,8 i 13,4 s z pokryciem na CI (próg nowego testu 10 s), main czerwony na bramce czasu od #672.
- Status: naprawione (17.11, #677 scalony); wcześniej: w PR #677 runda 2 (be0a92a), w weryfikacji; wcześniej: w naprawie, runda 2 (łowca: okno ucieczki 40 m daje zacięcia i kołysanie przy Bystrzycy i w hali W-3); wcześniej: w PR #677, przyjęte przez weryfikatora z uwagą (okno 40 m zmienia drogi ucieczki przy długich objazdach); przed scaleniem łowca sprawdza zacięcia i kołysanie, a main potrzebuje #679; wcześniej: w PR #677 (gałąź ccr-ec2c4269-ilh8k8-g928, f26847a), w weryfikacji; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: korytarz S 18 s z pokryciem poniżej 5 s lokalnie

### G-922 Oddział pościgu Tessen stoi przy wejściu i znika po ok. 20 s
- Ważność: S3 · Zasięg: pościg Tessen po drodze głośnej W-3 (tessen-hunt)
- Opis: Znalezione przy G-911 (17.11, sondy ziarna 1, 9, 42): oddział wchodzi 120-137 m od gracza, stoi prawie w miejscu i po ok. 20 s znika (wraca do domu, gdy zgubi Seki). W playteście (ten sam dzień) oddział z 50 m zabił biernego gracza w 30 s. Do ustalenia: czy trop (lastKnown) prowadzi oddział do gracza na każdej odległości z ADR-0082 (45-140 m), czy nawigacja/odległość wejścia gubi pościg; sprawdzić po scaleniu #671.
- Status: naprawione (17.11, #674 scalony); wcześniej: w PR #674 runda 3 (464e37d), w weryfikacji; wcześniej: w naprawie, runda 3 (nowy agent; r2 odrzucona: pętla powrotu przy wejściu bez drogi, dwie flagi oddziału naraz); wcześniej: w PR #674 runda 2 (6b8f9ac), w weryfikacji; wcześniej: w naprawie, runda 2 (PR #674 odrzucony przez weryfikatora: wejście bez drogi na innym piętrze); wcześniej: w PR #674 (gałąź ccr-ec2c4269-ilh8k8-g922, 19a59cf), w weryfikacji; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: oddział pościgu z wejścia 45-140 m dochodzi do stojącego gracza w rozsądnym czasie (ziarna 1-5)
- Weryfikator #671 (17.11): to samo na main (ziarna 3, 7, 42: oddział 134-139 m od gracza stoi i znika po ok. 20 s), nie regresja #671; lastKnown ustawiane przy wejściu oddziału. Do naprawy osobno.

### G-907 Droga cicha W-3 bez haków i przebrania: halą nie da się przejść
- Ważność: S3 · Zasięg: misja W-3, droga cicha przez kolektor i halę
- Opis: Playtest 17.11: Genzō nie daje pendrive (keyItems puste) ani haków (contractHooks puste); tessen_overalls to tylko losowy łup, brak szafki 14 i enc_w3_smoker; wylot kolektora bez podpowiedzi prompt.culvert. Bez przebrania technik zgłasza gracza w alei hali po 3,0 s ((2529; 418), broń schowana, kucanie). W jednym przejściu alarm padł po wejściu z korytarza S w drzwi hali (2546; 406), tick ok. 5145; sprawca nieustalony (podejrzenie: patrol P1). Rozwiązanie: przebranie i haki zgodnie z ADR-0082 §1 albo przejście N-S poza aleją.
- Status: naprawione (17.11, #675 scalony); wcześniej: w PR #675 (gałąź ccr-ec2c4269-ilh8k8-g907, 9e63ceb), w weryfikacji; wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Etap 1: haki i pendrive przy przyjęciu, szafka 14, wylot kolektora (prompt.culvert); P1 przestał być egzekutorem i to on zdzierał przebranie. Dalej: kierownik zmiany, palacz, kod furtki. Pytania do użytkownika: furtka z kodem, rola palacza, wymóg pendrive'a, kierownik zmiany w biurze antresoli.

### G-914 Debrief W-3 przyznaje no_alarm mimo alarmu zlecenia
- Ważność: S3 · Zasięg: W-3, droga głośna i alarm z zauważenia
- Opis: Odtworzenie 17.11 (łowca, sesja bez renderera, origin/main e2f6330): W-3 głośna, ładunki wzięte w (2555, 402) podnoszą alarm:c1, załoga zabita bronią, 3 ładunki, wyjście (2527, 384), wypłata; debrief: badges [no_alarm, clean, swift], ranga A. Przyczyna: core/contracts/scoring.ts badgeHolds sprawdza tally.alarm, ustawiany tylko przez noteAlarm z crime-system.report; contract-system.raiseAlarm stawia tylko flagę alarm:<id> (celowo dla doków, komentarz). ghost alarm też nie wyklucza (raiseAlarm nie woła noteDetected); komentarz core/test/w3-sabotage-loud.test.ts:43 'never ghost' kod nie wymusza. Do decyzji przy poprawce: czy flaga alarmu zlecenia liczy się do no_alarm tylko w W-3 (sabotage), czy też w dokach; czy alarm odbiera ghost.
- Status: naprawione (17.11, #673 scalony); wcześniej: w PR #673 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: sesja W-3 głośna: po wzięciu ładunków debrief nie zawiera no_alarm

### G-911 Pościg Tessen: oddział w 0,2 s po wejściu w dzielnicę, bez znaku na HUD
- Ważność: S3 · Zasięg: dzielnice w ciągu 3 dni po drodze głośnej W-3
- Opis: Playtest 17.11: z flagą tessen-hunt oddział 2 strażników pojawił się 13 ticków po wejściu w Bramę Krakowską, 50 m od gracza, zaalarmowany (lastKnown = pozycja gracza). HUD nic nie pokazuje (heat 0, brak toastu). Bierny gracz ginie w ok. 30 s. Rozwiązanie: ostrzeżenie na HUD i zwłoka na pierwsze losowanie.
- Status: naprawione (17.11, #671 scalony); wcześniej: w PR #671 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-913 Zapis na drabinie włazu W-3: yaw gracza rozjeżdża się po wczytaniu
- Ważność: S4 · Zasięg: drabina w3-hatch (2564; 439,3), inne drabiny niesprawdzone
- Opis: Playtest 17.11: zapis i wczytanie na drabinie; po 600 tickach hash różni się tylko w yaw gracza (2,43 kontra 0): bez zapisu kierunek zostaje, po wczytaniu przypina się do osi drabiny. Uwaga z lekcji: sonda zapisu musi iść przez SaveController.snapshot() i calmForSave; do potwierdzenia, że tak było.
- Status: naprawione (17.11, #668 scalony); wcześniej: w PR #668 (17.11, zapis v44); wcześniej: przyjęte (17.11, potwierdzone przez łowcę, mały koszt); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Łowca 17.11 (origin/main e2f6330, sesja bez renderera, snapshot przez saves.snapshot()/calmForSave, identyczne wejścia): POTWIERDZONE w węższym zakresie. Rozjazd tylko, gdy gracz obrócił widok (lookYaw) na drabinie: oryginał zachowuje yaw (1,000 po 600 krokach), wczytana gra przypina do osi drabiny (0,000); y i climb zgodne (w3-hatch y -28,05; w3-pipe y -26,65, ten sam wynik). Przyczyna: sim/systems/ladder-system.ts hangOn() bez settle ustawia e.yaw = l.yaw (gałąź 'game saved on a ladder' w ladderSystem.run, komentarz mówi 'where it was'); w grze yaw na drabinie jest swobodny (player-control-system.ts:289). Ogólne dla drabin. Skutek: po wczytaniu kamera zawraca, kierunek ruchu po zejściu inny niż bez zapisu. Poprawka: nie nadpisywać yaw w hangOn bez settle; test: zapis po lookYaw na drabinie, 600 kroków, yaw równy.

### G-909 Droga głośna W-3 nie do przejścia pistoletem na poziomie 6
- Ważność: S3 · Zasięg: misja W-3 przy zapisie z aktu I (poziom 6, Unity-9)
- Opis: Playtest 17.11: strażnicy poziomu 11 (154 HP); pistolet ok. 45 obrażeń z magazynku 12, AR-5 67 naboi na strażnika (90 w skrzyni); wejście do korytarza S i zbrojowni: zgon w 12 s przy 6 wrogach. AR-5 w skrzyni z pustym magazynkiem, trzeba go wyposażyć ręcznie w ekranie postaci. Przyczyna: brak zapisu startowego poziomu 12 z ADR-0082. Rozwiązanie: zapis poziomu 12 z AR-5 w slocie i załadowanym albo poziom wrogów bliżej gracza.
- Status: naprawione (17.11, #667 scalony); wcześniej: w PR #667 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Agent 17.11: zapis startowy poz. 12 (Nowa gra → Zacznij w W-3, slot w3-slice), gałąź ccr-ec2c4269-ilh8k8-g909; korytarz S: przed zgon 21,9 s, po żyje 60 s (84/133 HP).

### G-910 Łup trupa zasłania podłożenie ładunku w W-3
- Ważność: S3 · Zasięg: stanowiska S1-S4 po walce
- Opis: Playtest 17.11 (średnia pewność): przy S3 Użyj dawał Search zamiast Plant a charge i otwierał panel łupu (blokuje zapis); przy S1 po podłożeniu też Search. Rozwiązanie: priorytet celu misji nad łupem i Grab.
- Status: naprawione (17.11, #663 scalony); wcześniej: w PR #663 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Agent 17.11: odtworzone tylko przy S3 (torba 0,36 m, stanowisko 0,54 m); 'Search' przy S1 po podłożeniu to zachowanie poprawne (stanowiska już nie ma).

### G-920 Cel ucieczki W-3 mówi „za płot”, a płotu 2,7 m nie da się przeskoczyć
- Ważność: S4 · Zasięg: cel sabotageEscape W-3 (en, pl)
- Opis: Znalezione przy G-906 (17.11): contract.objective.sabotageEscape mówi „over the fence” / „za płot”, a według ADR-0082 płot W-3 ma 2,7 m i jest nie do przejścia; wyjście przez furtkę, bramę albo metro. Rozwiązanie: tekst wskazujący wyjścia (oba katalogi).
- Status: naprawione (17.11, #666 scalony); wcześniej: w PR #666 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/ui
- Test przyjęcia: tekst celu ucieczki nie wspomina płotu

### G-917 Hebi Enforcer strzela shotgunem poza zasięgiem 12 m i stoi na 15 m: elita nie zadaje obrażeń
- Ważność: S3 · Zasięg: wariant armored zleceń Hebi (od 5. zlecenia), dowódca zleceniowy
- Opis: Łowca 17.11 (origin/main e2f6330, sonda sim, Plac Litewski, ziarna 1-3, 30 s): hebi_enforcer alerted; na 12,5, 13 i 15 m 18-19 strzałów, 0 trafień; na 11 i 12 m 46-77 obrażeń. Wróg się nie zbliża. Przyczyna: attackRange w world/factory.ts:173 = meleeAttackRange(...) ?? 15 niezależnie od broni, raijin12 ma npc.range 12; GANGER_TREE strzela w attackRange i nie podchodzi do weapon.range. Inne typy mają zapas (Hebi SMG 18 przy 15, Tessen AR-5 30 przy 20). Rozwiązanie: attackRange = min(15, 0,9 × npc.range) albo pościg do npc.range.
- Status: naprawione (17.11, #665 scalony); wcześniej: w PR #665 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim
- Test przyjęcia: Enforcer na 13 m przy stojącym graczu zadaje obrażenia w 30 s (dziś 0 z 3 ziaren)

### G-906 Cele drogi głośnej W-3 z miejscem rdzenia serwerowni
- Ważność: S3 · Zasięg: wszystkie cele drogi głośnej (weź ładunki, podłóż, uciekaj)
- Opis: Playtest 17.11: cel "Plant the charges…" kończy się "the calibration core in server room N of hall W-3", choć stanowiska są w hali. Odtworzenie: pobrać ładunki ze skrzynki w zbrojowni S (2555; 400,8), przypiąć kontrakt. Rozwiązanie: miejsce zależne od route i etapu.
- Status: naprawione (17.11, #664 scalony); wcześniej: w PR #664 (17.11); wcześniej: zgłoszone
- Pakiet właściciela: packages/app

### G-905 HUD nie pokazuje celu W-3 przy aktywnym wątku głównym
- Ważność: S3 · Zasięg: każde zlecenie Genzō (W-3) przy aktywnym wątku głównym
- Opis: Playtest 17.11: po przyjęciu zlecenia W-3 HUD dalej pokazuje cel głównego wątku (Talk to Kaito, Ask Grandma Ume) z linią bonusu W-3 pod spodem; cele drogi cichej i głośnej, licznik ładunków, zapalnik i termin 06:00 widać dopiero po przypięciu w dzienniku. Odtworzenie: nowa gra lub po akcie I, Genzō, Co to za partia dronów, brak przypięcia. Przyczyna: shownEntryId w app/src/objective.ts przepuszcza kontrakt tylko dla CONTRACT_STEPS. Rozwiązanie: autoprzypięcie kontraktu W-3.
- Status: naprawione (17.11, #662 scalony); wcześniej: w PR #662 (17.11); wcześniej: w PR #660; wcześniej: zgłoszone
- Pakiet właściciela: packages/app

### G-902 Goła łata między chodnikiem w793299545 a trawnikiem w804709930 (Ruska, Podzamcze)
- Ważność: S4 · Zasięg: podzamcze-2-1 x 1066-1070, z 479,5-488
- Opis: Ortofoto pokazuje płyty; reguła gołej ziemi nie kładzie tam nic, bo pas jest dalej niż 5 m od asfaltu (kerbStrips). Po G-897 (#654) granica cofa się o 0,5 m (pas 2,25 x 0,5 m). Żaden rodzaj skanu tego nie liczy: kandydat na nową kontrolę (goła ziemia na płytach ortofoto przy chodniku).
- Status: naprawione (17.11, #657 scalony); wcześniej: w PR #657; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import
- Klin 1068,485.5-488 (ścieżka w227713090/chodnik, otwarty na zieleń parku) i obszar 1060-1064,476-484 między chodnikami w856618317 i w793299545 zostają gołe. Kontrola walk-lawn-bare: 14565 próbek w mieście, sufit 14600; największe: podzamcze (998,337) 180 m², (803,317) 113 m², (1077,345) 78 m² (szerokie pasy ponad 20 m²).

### G-903 Stopy wskakują z terenu na pomost mostu z 0,46-2,0 m niżej (DECK_HEADROOM)
- Ważność: S3 · Zasięg: boki pomostów przy przyczółkach: Mełgiewska (2405-2457; 240-330), most Lutosławskiego (2440-2486; 410-440), wiadukt Zamkowej i grobla (730-790; 150-205), kładka (1070-1083; 160); 304 z 1 007 328 prób ruchu (sonda kuratora), 105 z 242 838 (sonda weryfikatora G-898); tak samo na main przed #655
- Opis: Pomost do DECK_HEADROOM (2 m) nad terenem jest ziemią dla stóp na każdej wysokości (decksAt), a offTheBank blokuje tylko, gdy steepAt w punkcie docelowym. Przy skośnym albo krótkim kroku przez krawędź punkt docelowy na płaskim pomoście nie jest stromy, więc stopy w jednym kroku wskakują o 0,46-2,0 m (przy schodach w56965515 do 4,9 m). W 65% przypadków NMT potwierdza w Lublinie skarpę 0,5-2,5 m pod bokiem mostu (lico, balustrada), a w 35% teren gry jest dodatkowo za nisko (G-339). Proponowana reguła ruchu: wejście w obrys pomostu stopami z terenu poza nim tylko o ≤ STEP_HEIGHT (jak G-898); reguła DECK_HEADROOM tylko dla stóp już na pomoście albo pod nim. Sonda pomija kolizje (mury w294098689/690 stoją przy grobli), więc do potwierdzenia przez łowcę w grze. Przy okazji: offTheBank dał NaN (735,40; 165,56) dla stóp w piwnicy pod pomostem (gradient o długości 0). Sondy: scratchpad topo-overstep.test.ts, topo-overstep-nmt.tsv
- Status: naprawione (17.11, #656 scalony); wcześniej: w PR #656; wcześniej: zgłoszone (16.11, kurator, przegląd G-898)
- Pakiet właściciela: packages/sim (ruch: movement-system offTheBank, world/deck decksAt)
- Test przyjęcia: przemiatanie krawędzi wszystkich pomostów (odsunięcie 0,05-0,6 m, krok 0,03-0,25 m, kąty do ±1,2 rad): zero ruchów z przyrostem stóp > STEP_HEIGHT; deck-step.test.ts bez zmian
- Przy okazji (kurator 16.11): offTheBank zwrócił NaN w (735,40; 165,56) dla stóp w piwnicy pod pomostem, prawdopodobnie gradient o długości 0. Do potwierdzenia w grze przez łowcę (sonda pomija kolizje, przy grobli Zamkowej stoją mury w294098689/690). Proponowane kontrole skanu: deck-side-below-nmt (baza 85) i deck-side-overstep (baza 304). Sondy: scratchpad topo-decks*.test.ts, topo-overstep.test.ts.
- Weryfikator 17.11: PRZYJĘTE (sondy różnicowe gracza 13 152 prób, 18 różnic, każda to usunięty glitch; koszt kroku w szumie). Luka do sprawdzenia: krok z niższego pomostu na wyższy o więcej niż stopień nie jest blokowany (warunek !onLowDeck(from)); przemiatanie takiego miejsca nie znalazło. Pomosty 1,68-2 m nad terenem nie są już osiągalne skokiem z boku, zgodnie z regułą.

### G-870 Kamizelka kuloodporna wcina się w biust: dwie płytki nie dopasowane do sylwetki
- Ważność: S3 · Zasięg: garment vest-plate na modelach VRoid (Seki i postacie kobiece)
- Opis: Zgłoszenie użytkownika 15.11. vest-plate (garment-addons.ts) to dwa prostopadłościany na kości chest w stałym miejscu (at 0,-0,05,0,085, size 0,78), nieświadome kształtu ciała. Decyzja użytkownika: kamizelka jako powłoka z ubrania modelu (jak buildVest/buildShell w model-apron.ts), plus osobny research ubrań jako assetów (ADR).
- Status: naprawione (16.11, 603 scalony); wcześniej: gotowe na gałęzi (3b1d870), zrzuty do akceptacji użytkownika; wcześniej: w naprawie (powłoka z ubrania modelu, gałąź ccr-ec2c4269-ilh8k8-g870; docelowo asset wg ADR-0086); wcześniej: nowy
- Pakiet właściciela: packages/engine/src/renderer
- powłoka-płyta z Tops (model-apron.ts PLATE, przycinanie model-shell-clip.ts, 3b1d870); test vest-plate-model.test.ts: przed Seki 272 z 505 wierzchołków do 3,3 cm przed płytą, po 0 w 4 pozach na Seki, gangerze i pliku Kaito; mori.vrm 4 mm, nie nosi kamizelki

### G-873 Graf poziomów: brak testu, że krawędzie nie przekraczają REACH 120 m
- Ważność: S4 · Zasięg: packages/sim/src/world/nav.ts (REACH), graf W-3, S7, metro, Alchemia
- Opis: PR #592 (3ac9856): attach w nav.ts testował linię wzroku do węzłów metra Targowa 1,74 km dalej (946 fałszywych przejść przez ziemię, 2,9 s z 4,0 s testów reinforcement-sidestep). Poprawka REACH 120 m (najdłuższa krawędź 84 m). Brakuje testu, który pilnuje, że nowe krawędzie grafu mieszczą się w REACH.
- Status: naprawione (15.11, 601 scalony); wcześniej: w PR #601; wcześniej: nowy
- Pakiet właściciela: packages/sim

### G-658 Jezdnie w kształcie „lizaka” mają samoprzecinający się obrys
- Status: naprawione (15.11, 559 scalony); wcześniej: zgłoszone (12.11, naprawiacz G-654)
- Ważność: S4 · Zasięg: w173489056, w179269926, w296752325, w360030910, w1561106064 (drogi serwisowe z pętlą zamkniętą na własnym węźle); `simplePieces` z #433 celowo ich nie tnie, bo pocięcie odsłania lukę w cięciu chodnika w Nabrzeżu przy (2696; 299), +1 próbka `landuse-bare`; razem z tym wypełnienie zewnętrznych rogów na stykach kawałków dróg (proste końce `bufferLine`, do 1 m² na róg); nabrzeze-1-1 (12.11): `ground-ring-self-cross` droga (road) 14 punktów (2685; 280) i `kerb-fill-wide-estimated` 7 kwadratów (708 próbek), skupisko (2695; 300), obok miejsca (2696; 299) z G-658; niepotwierdzone, że ta sama droga.
- Pakiet właściciela: tools/osm-import
- 15.11 przesiew po kluczach skanu: ground-ring-self-cross 30 → 8 (#509) → 1 (#559, podział płaszczyzny gruntu ADR-0078 etap 3); żadna z pięciu pętli w173489056, w179269926, w296752325, w360030910, w1561106064 nie ma już klucza (jedyny został stare-miasto-1-0 742,-97).

### G-837 Zygzaki i schodki krawędzi chodnika przy jezdni i zebrze
- Ważność: S3 · Zasięg: kerb-jag 55 trafień w 42 kwadratach 10 m; Podzamcze 18, Krakowskie 16, Nabrzeże 6, Stare Miasto 2
- Opis: cutSidewalk tnie chodnik próbkowaniem co 0,5 m, a krawężnik składa się z pasów kerbFills/widened: schodki i zygzaki, zwłaszcza przy zebrach i narożnikach. Kontrola w PR #581; zrzuty scratchpad/jag/final/f7–f10
- Status: naprawione (15.11, #588 scalony); wcześniej: naprawione (#588); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g837, 906eb3d, czeka na przegląd kuratora); wcześniej: nowy
- Pakiet właściciela: tools/osm-import
- 15.11: kerb-jag 55 -> 16 (14 kwadratów); kontrola liczy łuk między wierzchołkami obrysu, po dogęszczeniu co 0,5 m wzdłuż krawężnika 81 -> 43, przy zebrach 123 -> 109; kontrolę trzeba dogęścić (PR #581) przed scaleniem; zostają zebry (G-836) i kliny narożników (G-845); 30 obiektów przy krawężniku przesuniętych o 0,2–1,0 m do przeglądu kuratora
- Przegląd kuratora 15.11 @ 906eb3d: ZGODNE. Krawędź jezdni wobec krawężnika na ortofoto: średnio +0,14 → −0,09 m (2025-04), +0,17 → −0,03 m (2024-06); 49 przesuniętych obiektów, żaden na jezdni ani zebrze; latarnie, drzewa i słupy na jezdni w mieście 17 → 16. Parkometr n9596789942 (T-306).

### G-820 Brak rzędów słupków z łańcuchami wzdłuż ulic Śródmieścia poza punktami z OSM (reguła dla centrum, decyzja użytkownika 15.11)
- Ważność: S3 (proponowana; rozpoznawalność Krakowskiego i Śródmieścia) · Zasięg: Krakowskie i Stare Miasto poza murami: ok. 3650 m osi ulic tertiary/residential, ok. 7300 m krawężnika; po przerwach szacunkowo 3600–4400 m rzędu, ok. 2000–2400 słupków (dziś 373, z OSM)
- Opis: Użytkownik 15.11: słupki z łańcuchami stoją wzdłuż każdej większej ulicy Śródmieścia i całego Krakowskiego Przedmieścia. OSM ma tylko część (368 węzłów, 16 linii, 0 barrier=chain i 0 tagów chain w czterech dzielnicach). Reguła deterministyczna: (1) obszar: dzielnice krakowskie i stare-miasto, bez wnętrza murów Starego Miasta i bez dróg pieszych/living_street bez krawężnika; Podzamcze i Nabrzeże tylko z OSM; (2) klasy: jezdnie tertiary, residential, unclassified (i wyższe w tym obszarze) po obu stronach, na krawędzi chodnika 0,35 m od krawężnika; place i deptaki (Pl. Łokietka, Pl. Wolności, Pl. Litewski) na swojej granicy z jezdnią, z zawinięciem narożnika po łuku; (3) rozstaw 1,8 m (przedział 1,5–2,2), na odcinku między przerwami równy: n = round(L/1,8), pierwszy i ostatni słupek 0,5 m od przerwy; (4) przerwy: przejście dla pieszych (pasma crossing-bands) +0,5 m z każdej strony, wjazd (droga service, barrier=gate, tunnel=building_passage, wejście z entrances.json typu garage/service) szerokość +1 m, skrzyżowanie od stycznej łuku narożnika (wyjątek: narożnik placu), przystanek autobusowy/trolejbusowy na długości peronu +5 m, postój taksówek i pas parkingowy (parking:lane/parking:both, amenity=parking przy krawężniku) bez rzędu, drzewo w rzędzie, latarnia i słup trakcji w rzędzie jako punkt zaczepu łańcucha (jak G-032); ogródek kawiarniany nie przerywa rzędu; (5) słupek z OSM w 1,0 m od pozycji reguły zastępuje ją (OSM jako kotwica i uzupełnienie); węzły OSM poza linią krawężnika zostają pojedynczo, bez łańcucha; (6) łańcuch tylko gdy chodnik za rzędem (krawężnik do najbliższej ściany, muru, płotu, poręczy) ma ≥3,0 m albo rząd graniczy z placem/deptakiem; węższy chodnik, poręcz za rzędem albo spadek ulicy >6%: słupki bez łańcucha, gęściej co 1,4 m (wzór: Wyszyńskiego, GSV 2025). Ryzyka: brakujące w OSM wjazdy i pasy parkingowe (fałszywe rzędy przed bramami), kawiarnie zajmujące krawężnik, nowsze ulice z donicami zamiast słupków, uwięzienie pieszych i AI (rząd z łańcuchem zamyka jezdnię poza przejściami); budżet rysowania (instancje). T-303
- Status: naprawione (15.11, #573 scalony); wcześniej: naprawione (#573); wcześniej: w PR #573 (przegląd kuratora runda 2: ZGODNE; resztki G-831, G-832, G-833); wcześniej: runda 2 (PR #573): P1 podwójne rzędy, P2 parkowanie prostopadłe, P3 przystanki, P4 Wyszyńskiego, P5 narożniki; wcześniej: w PR #573 (przegląd kuratora); wcześniej: zgłoszone (kurator 15.11, decyzja użytkownika 15.11; do przeglądu kuratora z próbką 5 ulic na zdjęciach)
- Pakiet właściciela: tools/osm-import (props-gen, props-rows; nowa reguła jak lit dla latarni G-798)
- Test przyjęcia: test reguły na Pl. Łokietka (rząd x≈439 od −45 do −113 z przerwą na przejście), Pl. Wolności (rząd zgodny z węzłami OSM ±1 m) i ulicy z wąskim chodnikiem (bez łańcucha); kontrole skanu: kerb-bollard-gap (odcinek krawężnika tertiary/residential w obszarze dłuższy niż 6 m bez słupka i bez powodu przerwy) i bollard-blocks-mouth (słupek albo łańcuch w paśmie przejścia, wjazdu lub drzwi pojazdów przystanku), baza po wdrożeniu 0; budżety e2e bez wzrostu draw calls
- Przegląd kuratora 15.11 (gałąź ccr-ec2c4269-ilh8k8-g820, 15fc2a4): NIEZGODNE, poprawki w tym PR. P1 podwójne rzędy: 212 słupków reguły stoi 1–2,5 m od słupka OSM/G-818 obok jego rzędu (3 Maja 82, Królewska 43, Pl. Wolności 33, Narutowicza 15; zrzuty krolewska i plac-wolnosci pokazują dwa rzędy), kontrola: słupek reguły z istniejącym słupkiem w 1–2,5 m, baza 0. P2 parkowanie prostopadłe/skośne i na chodniku spoza OSM: rzędy z łańcuchem przez stanowiska na Karmelickiej (obie strony), Peowiaków (pn. strona) i Cichej (skośne zatoki) na ortofoto 2025-04; równoległy pas parkowania przy krawężniku rzędu nie wyklucza (Kapucyńska, Lubartowska). P3 przystanek: 11 m symetrycznie za mało za słupkiem dla trolejbusu 18 m (Lubartowska (454; 16): autobus 10–20 m od słupka wzdłuż rzędu); proponowane 20 m pod prąd i 5 m z prądem. P4 Wyszyńskiego: 9 z 14 słupków z łańcuchem, GSV 2025 (zdjęcie 7287a04c) pokazuje całą zachodnią stronę bez łańcucha z płotem za rzędem. P5 brak zawinięcia rzędu po łuku narożnika placu (Pl. Wolności, zdjęcie 2f717e7d), punkt (2) definicji. Zgodne: Królewska przy Ratuszu, 3 Maja, Radziwiłłowska pn. (cienie słupków na ortofoto), Krakowskie (-200..-104) bez rzędów przy parkowaniu prostopadłym i żywopłotach; Ogród Saski leży poza mapą (x < -200).
- Przegląd kuratora rundy 2 (15.11, d8638c2): ZGODNE. P1 kerb-bollard-double-row 173→2 (plan przy Bramie Krakowskiej), P3, P4 (Wyszyńskiego zach. bez łańcucha) i P5 przyjęte; P2 łapie Cichą, Karmelicką wsch. i Peowiaków. Reszta jako S4 bez blokowania: G-831 Karmelicka zach. (ok. 50 m rzędu przez stanowiska), G-832 fałszywe wyłączenia z cieni (3 Maja 24 m, Staszica 15 m, Narutowicza 18 m potwierdzone na nalocie 2024-06; Radziwiłłowska 43 m niepewne, auta skośnie na przedpolu), G-833 łańcuch nie zawija łuku placu.

### G-813 Pasy parkowania Świętoduskiej w1514058888/89/90 bez aut
- Ważność: S4 · Zasięg: Świętoduska, 3 pasy (0 aut z 6,4 / 3,2 / 1,6 oczekiwanych), ten sam stan na main
- Opis: Odsłonięte przez kontrolę bay-strip-sparse przy G-804 (nowa latarnia przy krawężniku). Prawdopodobnie ten sam spadek co w1514058885 (G-133).
- Status: naprawione (15.11, #574 scalony); wcześniej: odrzucone, duplikat G-190 (przegląd S4 15.11: sonda surfaceY pod autem wzdłuż ulicy daje spadek 0,25–0,35 m > LEVEL_DROP 0,15 m na wszystkich trzech pasach, ta sama przyczyna co w1514058885; w skanie przeniesione do bay-strip-empty-known, gałąź ccr-ec2c4269-ilh8k8-s4-batch-1, 6bab190); wcześniej: zgłoszone
- Pakiet właściciela: packages/sim

### G-817 Latarnia z linii przesunięta z jezdni lub ściany traci 7 m odstępu scalania
- Ważność: S4 · Zasięg: linie latarni planu przy offRoad/offWall; widoczność w mieście niesprawdzona
- Opis: fromLine w props-gen działa po tożsamości obiektu, więc latarnia przesunięta przez offRoad/offWall dostaje odstęp 0,3 m zamiast 7 m.
- Status: naprawione (15.11, #574 scalony); wcześniej: naprawione (#574); wcześniej: w PR #574; wcześniej: w poprawce (przegląd S4 15.11, gałąź ccr-ec2c4269-ilh8k8-s4-batch-1, 6a4e9af: odstęp scalania pytany o element tak, jak go postawiono; tablica bez zmian, dziś w mieście brak przypadku); wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (props-gen)

### G-806 Drzewa przy ścianach rysowane niżej niż NMPT: korona nie może urosnąć przy budynku (18 miejsc tree-height-vs-nmpt)
- Ważność: S4 · Zasięg: 18 drzew 0,5–5,3 m od ściany, rysowane z ziarna 7–12 m, NMPT 12–26 m
- Opis: Gałąź ccr-ec2c4269-ilh8k8-tree-heights (wysokości drzew z NMPT EVRF2007): drzewa przy ścianach mają pomiar, ale korona przy budynku nie może urosnąć ponad rozmiar z ziarna; 18 kluczy tree-height-vs-nmpt przyjętych świadomie jako dotąd niewidoczne (brak pomiaru przed zmianą). Ortofoto (kwiecień) nie potwierdza korony przy 4 z nich — część może być dachem z przesuniętym obrysem. Poprawka: węższa korona przy ścianie w rendererze (wariant drzewa) albo odrzut odczytów z dachów.
- Status: naprawione (15.11, #576 scalony); wcześniej: naprawione (#576, 9c36d5e); wcześniej: w PR #576; wcześniej: zgłoszone (14.11, raport agenta wysokości drzew)
- Pakiet właściciela: packages/engine (drzewa), tools/osm-import (measureTree)
- Test przyjęcia: tree-height-vs-nmpt wraca do ≤ 6 bez nowych kluczy tree-unmeasured
- Kurator 14.11: 15 z 18 kluczy to realne drzewa przy ścianach (NMPT przy pniu ≥ 9 m), zgoda na osobne zadanie; 3 klucze (−123,24) n2416068304, (176,139) n2410102295 i (160,155) n2410102343 to błędy pomiaru (sąsiad lub dach), schodzą z poprawką bufora dachu przed scaleniem.

### G-814 Drzewo przy ścianie rysowane w rozmiarze z ziarna zamiast największej korony, która się mieści
- Ważność: S4 · Zasięg: 35 drzew OSM (tree-unmeasured) i 79 wierzchołków reguły koron (G-797)
- Opis: treeVariant (#558) wraca do plainTreeVariant, gdy korona z pomiaru nie mieści się przy ścianach; reguła koron pomija przez to duże drzewa przy budynkach, np. (700, 570).
- Status: naprawione (15.11, #576 scalony); wcześniej: naprawione (#576, 9c36d5e); wcześniej: w PR #576; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (tree-heights)
- Runda 2 G-797: 41 wierzchołków prawdziwych drzew przy ścianach nadal pomijanych (z listy kuratora zostały 2 z 16).
- Kurator r2 (2b26e13): z 22 prawdziwych drzew przy ścianach z rundy 1 zostaje 8 (c92, c345, c350, c357, c585, c623, c626, c639), 2 zastąpione drzewem w 3 m (c641, c1159); bez drzewa: (351,5; −64,5), (409,5; 145,5), (406,5; 148,5), (740,5; −190,5), (530,5; 128,5), (530,5; 110,5), (530,5; 515,5), (577,5; 418,5), (832,5; 488,5), (2555,5; 84,5), (2349,5; 465,5), (2317,5; 444,5) — kandydaci na test przyjęcia.

### G-815 Drzewa reguły koron na okapach, dachach podwórek, budowach, krytym targu i krawędziach pomostów (T-300)
- Ważność: S3 · Zasięg: ok. 28 drzew na okapach/dachach (z 57 wskazanych przez sondę), 20 w landuse=construction (12 na stanie surowym Zielona 5a), 3 w Targu „Bazar” w67502759, 3 przy pomostach; wszystkie dzielnice
- Opis: Reguła crown-trees.ts (G-797) stawia drzewo na wierzchołku korony liczonym tylko po komórkach dopuszczonych, więc piksel okapu przy wyższym dachu (NMPT = maks. z 4 komórek 0,5 m; obrys OSM 1–3 m mniejszy niż dach; przybudówki spoza OSM) staje się wierzchołkiem, a ortofoto daje canopy na miedzi, mchu, pnączach i cieniu podwórek. Przykłady: c152 (117,5; 72,5) 9,4 m na miedzianym dachu, c81 (375,5; −262,5), c86 (385,5; −139,5) przybudówka z pnączem, c273 (497,5; 13,5), c595 (608,5; 569,5). Budowa Zielona 5a (w770678456, w1382552286): drzewa 6–16 m na płaskowyżu stanu surowego. Targ „Bazar”: c592, c593, c594 po 4,0 m w alejkach między dachami straganów. Pomosty: c441, c452 (kładka ok. x 778, z 202), c937 (most nad Bystrzycą x 2451, z 421) — CHM = pomost. Nakładki: scratchpad/topo-g797/eave0.png, eave1.png, budowy.png, targ.png, decks.png, zoom2.png; raport scratchpad/topo-g797-raport.md
- Status: naprawione (15.11, #567 scalony); wcześniej: w PR #567; wcześniej: w ponownym przeglądzie (gałąź ccr-ec2c4269-ilh8k8-g797, 2b26e13): K1 28 → 1, K3 5 → 0, lista kuratora: 12 znika, 6 zostaje; wcześniej: nowe (przegląd kuratora G-797, 15.11); do poprawy w gałęzi G-797 przed scaleniem albo osobno
- Pakiet właściciela: tools/osm-import (crown-trees.ts, crown-ground.ts)
- Test przyjęcia: drzewa reguły: żaden pień w obrysie OSM building (bez ruins), landuse=construction, amenity=marketplace (kontrola K1, baza 27 → 0); żaden do 2 m od pomostu (K3, baza 5 → 0); wierzchołek nie łączy się plateau CHM (bez spadku o 1 m) z obrysem budynku w 3,5 m albo ma lokalne maksimum surowego CHM — lista z raportu: c13, c51, c81, c86, c152, c159, c165, c198, c221, c244, c273, c595 znikają, a c345, c350, c357, c585, c623, c639 zostają
- Przegląd kuratora r2 15.11 (2b26e13): ZGODNE z uwagami. Test przyjęcia spełniony: c13, c51, c81, c86, c152, c159, c165, c198, c221, c244, c273, c595 znikają; c345, c350, c357, c585, c623, c639 zostają. Z 29 dachów/okapów rundy 1 zostają 3: c134 (−173,5; −14,5) to jednak małe drzewo w podwórzu (ortofoto 2024-06), c575 wątpliwe, c588 dach garaży; resztki w G-827. Targ, Zielona 5a, pomosty, doki: 0 drzew. Raport scratchpad/topo-g797r2-raport.md.

### G-797 Drzewa tylko z węzłów OSM: 496 kwadratów korony z ortofoto bez drzewa w grze (ADR-0077 krok 5)
- Ważność: S3 · Zasięg: całe miasto; najgorzej nabrzeże (9% korony w zasięgu drzew) i podzamcze (11%); obejmuje G-207
- Opis: Krok 5 ADR-0077 niewdrożony: drzewa wyłącznie z natural=tree i tree_row przez plan; modele drzew GUGiK LoD1 2023 ani NMPT nie są używane. Pomiar 14.11 (audyt ADR-0077): klasy canopy/canopyHard data/orto, promień 6 m. T-292
- Status: naprawione (15.11, #567 scalony); wcześniej: w PR #567 (przegląd kuratora runda 2: ZGODNE z uwagami); wcześniej: w przeglądzie kuratora (gałąź ccr-ec2c4269-ilh8k8-g797, dffa980): canopy-without-tree 481 → 112, drzewa 640 → 1812; wcześniej: zgłoszone (14.11, audyt ADR-0077)
- Pakiet właściciela: tools/osm-import (props), tools/gugik
- Test przyjęcia: kontrola canopy-without-tree (kwadrat 10 m, ≥ 40 m² korony, ≥ 80% dalej niż 6 m od drzewa gry), baza 496, spada; 0 drzew na drogach, schodach i w budynkach
- Przegląd kuratora 15.11 (dffa980): NIEZGODNE z poprawkami. Próbka 32 drzew: 26 zgodnych, 1 na dachu, 3 na okapach, 2 wątpliwe. Skarpa N Zamku 2 → 44 drzew (korony rysowane 36% wobec CHM 46%), skarpa S 0 → 49 (29% wobec 36%), Plac Litewski 100 → 131 (29% wobec 26%), nabrzeże zgodne. Zabytki niezasłonięte (Brama Krakowska, Trybunał, Brama Grodzka, Kaplica, Donżon: 0 nowych w 10 m). Ruiny Rybna 12 zarośnięte, zgodne. Poprawki: P1 okapy i dachy podwórek, P2 budowy (landuse/building=construction), P3 kryty targ (amenity=marketplace), P4 odstęp 2 m od pomostów — wszystkie w G-815 / T-300; P5 wykluczyć CLEARED_BUILDINGS (112 drzew w dokach T-002 usuwa dopiero clearOfGame, a liczą się w 1812 i w skanie). Raport scratchpad/topo-g797-raport.md, nakładki scratchpad/topo-g797/.

### G-117 Dach całego obrysu przykrywa wyższą część z OSM (ryzalit Ratusza)
- Status: naprawione (15.11, #571 scalony); wcześniej: zgłoszone (audyt gmachów publicznych, kurator 31.10)
- Ważność: S3 (proponowana; Ratusz z Placu Łokietka) · Zasięg: 1 w mieście (Ratusz); części kościoła Dominikanów przykryte ścianami, ale ich dachy wychodzą ponad połać · Koszt: średni
- Gdzie: ryzalit w619138853 (414.8, −79.4) na Ratuszu w66264120; T-065
- Dowód: dach czterospadowy z `addHipRoof` nad całym obrysem od y 17,1 do 24,0; nad środkiem ryzalitu 22,6, a szczyt ryzalitu 20,3 (bez dachu). Widać tylko pas 1,6 m przy okapie
- Przyczyna: `stackParts` stawia część z OSM na bryle (`soffit` = ściany obrysu), a renderer kryje dachem cały obrys, także pod częściami wyższymi od niego
- Pakiet właściciela: packages/engine (mapcity/roof-plan) albo przepis zabytku ADR-0062 etap 4
- Test przyjęcia: połać obrysu nie wchodzi nad obrys części, która jest wyższa od ścian obrysu i dochodzi do jego krawędzi (dach kończy się na ścianach ryzalitu); kontrola `part-buried-in-roof` 1 → 0

### G-818 Rzędy słupków z OSM (drogi barrier=bollard) zredukowane do jednego słupka albo pominięte
- Ważność: S3 (proponowana; Plac Łokietka przed Ratuszem, Królewska, Krakowskie) · Zasięg: 16 dróg OSM, 383 m: 14 daje po 1 słupku (plan 29.10), 2 (w1090997949, w1090997950, 63 m, Krakowskie z −246…−209) brak; szacunkowo ok. 200 słupków brakuje
- Opis: OSM ma rzędy słupków jako linie barrier=bollard bez otagowanych węzłów (w1514057822 Pl. Łokietka 439,−89…−45 43,6 m; w1514057825 439,−113…−99; w1514057826/27/28 Królewska; w1514057829–33 i w1302893330 Królewska przy Katedrze 547…612,−203…−211, 66,7 m; w1514057837 Krakowskie 362…392,−21…−27; w1514057823 Lubartowska; w1024029950 Podzamcze). fetch.ts/furniture.ts bierze tylko węzły (FURNITURE_TAGS), plan ma każdą linię jako jeden punkt. Przed Ratuszem gra stawia 3 słupki z 1 łańcuchem (438,9…439,0; −91,9…−99,5) i 1 przy −65,9; ortofoto 2025-04 i zdjęcie GSV 2025 pokazują ciągły rząd z łańcuchami co 1,5–1,8 m od −45 do −113. T-301
- Status: naprawione (15.11, #570 scalony); wcześniej: w PR #570 (krótki przegląd kuratora); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g818); wcześniej: zgłoszone (kurator 15.11, audyt słupków)
- Pakiet właściciela: tools/osm-import (fetch, furniture, props-gen)
- Test przyjęcia: każda droga barrier=bollard w czterech dzielnicach daje słupki wzdłuż linii co ≤2,0 m (przerwy na przejścia jak w props-rows), łańcuchy według reguły G-032; kontrola skanu osm-bollard-line-missing: droga barrier=bollard z mniej niż długość/2,5 słupkami w 0,8 m od linii, baza 16

### G-819 Słupek z łańcuchem jako gruby granitowy graniastosłup zamiast smukłego czarnego słupka żeliwnego z kulą
- Ważność: S4 (proponowana; charakterystyczny mebel Lublina, zgłoszenie użytkownika 15.11) · Zasięg: wszystkie słupki miasta (373 na main, 275 z łańcuchem)
- Opis: furniture.ts BOLLARD = { side: 0.34, height: 1.05, chain: 0.018 }, prop-street.ts: kwadratowy trzon 0,34 m z granitu #8e8d88 z czapą-piramidą, łańcuch 4-boczną rurą r 0,018 na 0,74 m ze zwisem 1/20 przęsła. W Lublinie (GSV 2025 Pl. Łokietka i Pl. Wolności, Lublin360 2017): czarny słupek żeliwny, okrągły trzon ok. Ø 0,10 m (u stopy kołnierz ok. Ø 0,15 m, wys. 0,15 m), głowica kulista ok. Ø 0,12 m z małym zwieńczeniem, wysokość ok. 0,95 m, uchwyt łańcucha ok. 0,75 m, łańcuch ogniwowy (drut 8–10 mm, ogniwo ok. 50 × 80 mm, widoczny pas 4–5 cm), zwis ok. 0,15 m na przęśle 1,8 m (ok. 1/10–1/12). Kolizja r 0,17 zamiast ok. 0,08. T-302
- Status: naprawione (15.11, #569 scalony); wcześniej: w PR #569; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g819); wcześniej: zgłoszone (kurator 15.11, audyt słupków)
- Pakiet właściciela: packages/sim (content/lublin/furniture.ts: BOLLARD, kolizja) i packages/engine (mapcity/prop-street.ts)
- Test przyjęcia: BOLLARD: trzon okrągły Ø 0,10–0,12, wysokość 0,90–1,00, głowica kulista, czarne żeliwo; łańcuch o widocznej szerokości 0,04–0,05 m (ogniwa albo dwie skrzyżowane wstęgi), zwis 1/10 przęsła; kolizja z promienia trzonu; zrzut z modelami w dzień przy Pl. Łokietka obejrzany przez kuratora; warstwa 2077 (pasek światła) zostaje

### G-828 Kontrole skanu wolne pod obciążeniem CI (paving-overlap, kerb-fill-wide-estimated)
- Ważność: S3 · Zasięg: CI shard testów jednostkowych; main 76cd282 i PR #564
- Opis: Po #559 i #565 kawałków gruntu przybyło, a kontrole przeglądają liniowo listy całego miasta; paving-overlap G-301 naprawione w #566 (4,9 s → 0,1 s), kerb-fill-wide-estimated ok. 11 s lokalnie i ponad 20 s w CI. Poprawka: indeks przestrzenny, bez podnoszenia limitów.
- Status: naprawione (15.11, #566, #568 scalony); wcześniej: w PR #568 (paving-overlap naprawione w #566); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-scan-speed)
- Pakiet właściciela: tools/glitch-scan

### G-821 Przesunięcie stacji lit przy G-812 stawia 3 latarnie lamp-road na jezdni według ortofoto (Mełgiewska, Al. Solidarności, Lwowska)
- Ważność: S3 · Zasięg: gałąź ccr-ec2c4269-ilh8k8-lit-edge (406efb1): ziarno 5849 (2320,5; 307,1), 32338 (531,5; 398,9), nowa 55187 (1119,3; 445,2)
- Opis: Przegląd kuratora G-810/G-812 (ortofoto 2025-04, nakładka scratchpad/topo-lit-bad.png, topo-lit-sheet10.png). Zmiana padded przesuwa stacje reguły lit na długich drogach. 5849: przed na chodniku z kostki po południowej stronie Mełgiewskiej w931927880 (2308,6; 302,4), po w klinie między Mełgiewską a łącznicą Andersa w40051729 (po 3,9 m od obu osi), w rzeczywistości na asfalcie pasa włączania. 32338: przed na trawniku przy przejściu (523,3; 389,2), po 5,5 m od osi Al. Solidarności w215609082 (3 pasy), w rzeczywistości na pasach do skrętu poszerzonej jezdni. 55187 (nowa): 5,2 m od osi Lwowskiej w139586648 (3 pasy), na przejściu dla pieszych przy rondzie Ojca Piotra, ok. 1,3 m w głąb jezdni. Pozostałe 17 zmian (park, pastoral, 1807, 25057, 55863, 21231, 65452, 31521 zamiast 44642 i 65094 z jezdni Podzamcza) stoją na chodnikach, ścieżkach albo ich skraju.
- Status: naprawione (15.11, #564 scalony); wcześniej: w PR #564 (02d0180): stacje jak na main, zmienia się jedna latarnia; wcześniej: zgłoszone (przegląd kuratora 15.11); do poprawy w gałęzi lit-edge przed scaleniem albo osobno
- Pakiet właściciela: tools/osm-import (props-lit, props-gen)
- Test przyjęcia: żadna latarnia lamp-road z gałęzi nie stoi w klasie asfalt/jezdnia ortofoto 2025-04 dalej niż 0,5 m od krawędzi; ziarna 5849, 32338, 55187 wracają na chodnik albo trawnik za krawężnikiem
- Rejestr topografii: T-304.

### G-812 Przebieg uzupełniający lit wydłuża ciemny odcinek poza brzeg mapy i uznaje sąsiedni chodnik za oświetlony
- Ważność: S4 · Zasięg: w185762620 / w232464409, 10 m przy (455..470; 150..160)
- Opis: Znalezione przy G-804: linia przebiegu uzupełniającego reguły lit sięga poza brzeg mapy; chodnik obok liczy się jako oświetlony, choć latarnia tam nie staje (lit-street-dark +2 na gałęzi g804).
- Status: naprawione (15.11, #564 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-lit-edge, 406efb1): padded tylko po punktach na mapie; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (props-lit)

### G-810 Reguła latarni lit stawia latarnię na brzegu mapy z y 0, gdy krawędź Mełgiewskiej przesunie się o 2,5 cm
- Ważność: S3 · Zasięg: Mełgiewska w225998472, wschodni brzeg mapy (2700; 93,5)
- Opis: Znalezione w PR 10 runda 2 (ADR-0080): przesunięcie krawędzi jezdni o 2,5 cm sprawia, że reguła lit (#557, props-lit / props-lit-spot) stawia latarnię poza terenem z y = 0; props.test pada. Mełgiewska trzymana na HELD jako obejście. Reguła powinna odrzucać punkt poza mapą albo bez wysokości terenu.
- Status: naprawione (15.11, #564 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-lit-edge, 0c0c5fd): chunk sprawdzany po zaokrągleniu punktu; wcześniej: zgłoszone
- Pakiet właściciela: tools/osm-import (props-lit)

### G-802 Staszica: chodniki OSM pod zmierzonym asfaltem po szerokościach z ortofoto (gałąź ADR-0080 PR 10)
- Ważność: S2 · Zasięg: Staszica i ulice, gdzie chodnik OSM leży bliżej osi niż krawężnik na ortofoto; sidewalk-under-carriageway 29 -> 34
- Opis: Gałąź ccr-ec2c4269-ilh8k8-adr80-pr10: zmierzona jezdnia 8,3 m przykrywa oba chodniki (w1261814240 bliżej osi niż krawężnik). Wg odpowiedzi użytkownika 13.11 pierwszeństwo ma ortofoto, więc chodnik powinien przesunąć się na krawężnik, co jest zakresem ADR-0080 PR 7; do tego czasu takie ulice zostają w HELD.
- Status: naprawione (15.11, #565 scalony); wcześniej: zgłoszone (14.11, raport agenta PR 10)
- Pakiet właściciela: tools/osm-import (street-section, orto widths)
- Test przyjęcia: sidewalk-under-carriageway nie rośnie wobec main po zastosowaniu tabeli szerokości

### G-804 Latarnie reguły lit: strona z kierunku rysowania OSM, Narutowicza tylko z jednej strony
- Ważność: S4 · Zasięg: ulice tertiary/residential reguły SIDE, m.in. Narutowicza, Peowiaków
- Opis: props-lit SIDE stawia lampy po lewej względem kierunku drogi w OSM; Narutowicza ma w rzeczywistości słupy przy obu krawężnikach co ok. 34 m (ortofoto 2025-04). Propozycja: strona z przejętej linii planu, sides 2 dla ulic z chodnikami separate po obu stronach i jezdnią ponad ok. 10 m. T-297
- Status: naprawione (15.11, #563 scalony); wcześniej: w PR #563 (przegląd kuratora: ZGODNE); wcześniej: w przeglądzie kuratora (gałąź ccr-ec2c4269-ilh8k8-g804, 642425d); wcześniej: zgłoszone (14.11, przegląd kuratora G-798)
- Pakiet właściciela: tools/osm-import (props-lit)

### G-808 Podgląd menu pobiera seki.vrm drugi raz (własna ModelLibrary) już na ekranie tytułowym, równolegle z miastem
- Ważność: S3 · Zasięg: start gry, słabe łącze
- Opis: PreviewStage ma własną ModelLibrary i pobiera 7 MB seki.vrm drugi raz równolegle z plikami miasta; dubluje transfer i zwiększa szansę na limit bezczynności (G-807).
- Status: naprawione (14.11, #562 scalony); wcześniej: w PR #562; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g808); wcześniej: nowe
- Pakiet właściciela: packages/engine/src/renderer

### G-809 Limit bezczynności pobierania modelu liczy czas w kolejce przeglądarki
- Ważność: S3 · Zasięg: słabe łącze (8 Mbit/s)
- Opis: Zegar bezczynności w fetchModelBytes startuje przed wysłaniem żądania; czas w kolejce przeglądarki (6 połączeń na host) liczy się jako przestój, co daje fałszywe 'no data for 30 s' (G-807).
- Status: naprawione (14.11, #561 scalony); wcześniej: w PR #561; wcześniej: nowe
- Pakiet właściciela: packages/engine/src/renderer

### G-807 Seki w grze zostaje proceduralnym szkieletem zamiast modelu seki.vrm
- Ważność: S2 · Zasięg: postać gracza, cała gra (zgłoszenie użytkownika 14.11)
- Opis: Użytkownik widzi w grze (APK lub Render) proceduralną Seki z brył zamiast modelu VRM. Pliki models/manifest.json i models/seki.vrm są na Renderze (HTTP 206, typy JSON i x-world/x-vrml). Do ustalenia: widok (TPP, FPP, menu), urządzenie, od kiedy; podejrzane zmiany: #504 (ręce FPP z modelu), #539 (kompilacja za ekranem ładowania), #546, ADR-0076 4b (zwalnianie plików, limit na telefonie).
- Status: naprawione (14.11, #560 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-g807, 903fd0e): ponawianie pobrania modelu po błędzie; wcześniej: w diagnozie
- Pakiet właściciela: packages/engine/src/renderer (character-models, model-library), packages/app
- Przyczyna: jedno nieudane pobranie seki.vrm zostawiało Seki proceduralną do końca sesji (CharacterModels.dress tylko ostrzegał; PreviewStage ustawiał dressFailed na stałe). Bez zakłóceń sieci nie odtwarza się; odtwarza się przy 8 Mbit/s i przerwanych żądaniach. Do potwierdzenia u użytkownika: widok i łącze; w APK pliki są lokalne.

### G-803 Krawężnik poszerzonej jezdni 0,4 m za daleko od osi, ząbki (ADR-0078 etap 3)
- Ważność: S3 · Zasięg: ok. 1,9 km krawężnika z kerbFills, cała mapa
- Opis: Po podziale płaszczyzny kamień krawężnika leży za krawędzią asfaltu (reach..reach+0,3), krawężnik w u=+0,1 od chodnika OSM; ortofoto: mediana u=-0,25 (2025-04), -0,5 (oba naloty); na 3 Maja (-101; -20..-40) krawężnik z wcięciami. Zrzut scratchpad/adr78-etap3-kurator.png, T-294.
- Status: naprawione (14.11, #559 scalony); wcześniej: w naprawie na gałęzi adr78-etap3 (przed scaleniem)
- Pakiet właściciela: tools/osm-import (kerb-fill.ts)
- Test przyjęcia: kamień w [gap-0,3; gap+0,1] na próbkach full, krawędź asfaltu bez wcięć

### G-798 Latarnie z linii planu zamiast reguły lit: 4,4 km oświetlonych dróg bez latarni (ADR-0064 etap 3)
- Ważność: S3 · Zasięg: całe miasto, 4390 m próbek dróg lit=yes
- Opis: osm-import nie czyta tagu lit (1068 dróg lit=yes w wyciągach); latarnie stawiają linie lamps.* z docs/world/lublin-props.todo.json (29.10), więc nowe ulice i pas z < −200 zostają ciemne. T-293
- Status: naprawione (14.11, #557 scalony); wcześniej: w PR #557 (runda 2: P1 Dziedziniec, P2 Podwale poprawione); wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-lit-lamps, przegląd kuratora w toku; wcześniej: zgłoszone (14.11, audyt ADR-0077)
- Pakiet właściciela: tools/osm-import (props-gen), tools/glitch-scan
- Test przyjęcia: kontrola lit-street-dark (próbki co 5 m dróg lit=yes dalej niż 30 m od lamp-*, kwadraty 10 m), baza 4390 m, spada; kontrole lamp-* nie rosną
- Przegląd kuratora 14.11 (946e866): NIEZGODNE, 2 poprawki przed scaleniem: (P1) Dziedziniec Zamkowy 5 lamp-park, w tym 2 na środku z w73811514 (868,2; 233,6), (915,4; 227,9); w rzeczywistości latarenki ścienne i oprawy w bruku; (P2) Podwale: 10 lamp-road planu zmienione na lamp-candelabra (lookOf: 3 punkty na linii Placu Zamkowego, styleClashes), w rzeczywistości pastorały. Kontrole: lamp-freestanding-in-courtyard (baza 5), lamp-square-style-leak (baza 11).

### G-800 Cień linki girlandy znika z daleka, zostają cienie samych lampek (po #542)
- Ważność: S3 · Zasięg: wszystkie girlandy i przewody nad ulicami, noc, High; widać dopiero z bliska
- Opis: Zgłoszenie użytkownika 14.11 (gra po #542): linka z kwadracikami rzuca cień tylko z bliska, z daleka widać same kwadraciki; to nie cień kontaktowy. Najpewniej cień księżyca: przy patrzeniu w dal kwadrat cienia wraca do 56 m (teksel 2,7 cm), a linka cieńsza niż teksel po nowym filtrze krawędzi (PCF 3 teksele, próg ok. 1 px przez fwidth) znika zamiast iść w kropki; agent G-795 wskazał to ryzyko w raporcie. Przed #542 cień linki był kropkowany.
- Status: naprawione (14.11, #555 scalony); wcześniej: w PR #555 (test CPU 0-3% → 100%; potwierdzenie w grze do zrobienia); wcześniej: zgłoszone (14.11, użytkownik)
- Pakiet właściciela: packages/engine/src/npr (moon-shadow, shadow-fit, toon-shader)
- Test przyjęcia: cienka bryła (przewód 1-2 cm) rzuca w mapie cienia ciągły ślad na ziemi także przy kwadracie 56 m (udział zacienionych pikseli wzdłuż śladu ≥ 80%)
- Ograniczenie: na Medium i Low (mapa cienia 1024) cień linki z daleka może nadal znikać. Potwierdzenie w grze na APK u użytkownika.

### G-801 Raport ortofoto liczy meble z wyciągu OSM jako postawione regułami
- Ważność: S4 · Zasięg: raporty komórek orto, całe miasto
- Opis: tools/orto/src/furniture.ts osmPlanPoints czyta sam plan docs/world/lublin-props.todo.json, a grupy osm.furniture.* z props-osm.ts nie mają inOsm. furnitureCounts (report.ts:55) zalicza 68 obiektów z pasa z < −200 do reguł generatora, nie do OSM.
- Status: naprawione (14.11, #552 scalony); wcześniej: w PR #552; wcześniej: zgłoszone (przegląd kuratora 14.11)
- Pakiet właściciela: tools/orto, tools/osm-import
- Test przyjęcia: furnitureCounts dla krakowskie-0-0 i krakowskie-1-0 liczy obiekty z grup osm.furniture.* jako z OSM: osmPlanPoints bierze loadPropsPlan(), a osmFurnitureItems ustawia inOsm: true

### G-796 Ziarnisty cień kontaktowy pod postacią przy kamerze z góry
- Ważność: S3 · Zasięg: High, cień kontaktowy; zrzut użytkownika z telefonu 14.11 (rozdzielczość renderu 70%, kamera z góry)
- Opis: pod postacią plama z widocznym ziarnem/szachownicą zamiast gładkiego cienia; podejrzenie: wzór Bayera 4x4 i rozmycie 4x4 w połowie rozdzielczości przestają się znosić przy skali renderu 0,7 albo postać (skórowana) jako zasłona daje szum; do naprawy po zmianie formatów G-buffera (gałąź gbuffer-lite)
- Status: naprawione (14.11, #549 scalony); wcześniej: w gałęzi ccr-ec2c4269-ilh8k8-g796 (po gbuffer-lite), zrzuty do akceptacji; wcześniej: w naprawie (14.11): druga runda agenta od G-buffera (gałąź gbuffer-lite albo g796); wcześniej: zgłoszone (14.11, użytkownik)
- Pakiet właściciela: packages/engine (npr/contact-shade*.ts)
- Test przyjęcia: zrzut z góry nad postacią przy skali 0,7 i 1,0 bez ziarna

### G-795 Cień twardy z poszarpanymi krawędziami (teksele mapy cieni)
- Ważność: S3 · Zasięg: cały świat, High i Medium; zrzut użytkownika z telefonu 14.11 (noc, kamera z góry, postać z bronią przy latarni)
- Opis: schodkowe, pikselowe krawędzie cienia postaci i budynków; przyczyna do ustalenia: rozmiar mapy, zasięg frustum cienia, brak filtrowania
- Status: naprawione (14.11, #542 scalony); wcześniej: w PR #542, zrzuty zaakceptowane przez użytkownika 14.11; scalenie po zielonym CI; wcześniej: w PR #542 (zrzuty do akceptacji); wcześniej: w naprawie (14.11, gałąź ccr-ec2c4269-ilh8k8-shadow-edges)
- Pakiet właściciela: packages/engine (npr/moon-shadow.ts)
- Test przyjęcia: zrzut nocny z góry bez schodków na krawędzi cienia; migawka NPR obejrzana

### G-782 roundJoints: suma NonZero pierścieni zgodnych z ruchem wskazówek zegara w fazie okrągłych końców
- Ważność: S4 · Zasięg: 242 z 2141 pasów ma pierścień zgodny z ruchem wskazówek zegara
- Opis: covered w pierwszej fazie roundJoints sumuje pierścienie bez obracania; obszar zgodny z ruchem wskazówek zegara znosi pasy na nim, bit końca może trafić w fałszywą dziurę
- Status: naprawione (14.11, PR #540 scalony 14.11 scalony); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g782 (0ab44d4, scalony main), czeka na przegląd kuratora; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g782 (482856c); test ground-over-steps pada na 3 przesuniętych kluczach; decyzja nocna: nie przyjmować accept, poczekać na #535 (G-781, ground-over-steps -> 0), scalić main i sprawdzić ponownie; potem przegląd kuratora (klin trawnika 768,211); wcześniej: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: pierścienie obrócone przed sumą; ground-strip-overlap i ground-over-steps nie rosną
- Skutek potwierdzony: 51 obrysów, ok. 98 m² bitów końców drugą warstwą na obszarach; nakładki ścieżki i bruku na schodach 8,27 -> 1,20 m²; ground-over-steps 234 -> 231 (5 usuniętych, 3 klucze przesunięte: krakowskie-0-1 -4,127, podzamcze-1-0 768,211, stare-miasto-1-0 694,-176); złoty map-ground-golden 170580 -> 169847, ba4027c1; zrzuty /dev/shm/g782-shots
- Runda 2 po G-781: map-ground-golden 173375 - 676 = 172699 (7610321b); scan:diff wobec main bez zmian (7212), ground-over-steps 0; zrzuty /dev/shm/g782-r2-shots i /dev/shm/g782-shots; ok. 98 m² czap końców znika z placów i trawników
- Kurator topografii: ZGODNE Z UWAGAMI. orto:diff vs merge-base 5,8 m², bilans klas zamknięty, bez gołego terenu, teren i pomosty 0. Oznakowania Al. Tysiąclecia 741–745 kończą się na węźle sygnalizacji, przed zebrą 730,7. Przed PR scalić main (G-775).

### G-775 Beżowa kostka i patyna pomnika jako zieleń w komórkach SM z dwoma nalotami
- Ważność: S4 · Zasięg: stare-miasto-0-1 (476..478; 75..81), stare-miasto-0-0 (607..610; -207..-212); klucze 470,70
- Opis: Po G-771 SM-0-0/0-1 mają 2 naloty; beżowa kostka (exg 0,035 w 2025-04) i nalot letni w cieniu albo z przechyłem dają green/canopy; patyna pomnika daje green; bare-cover kładzie trawę na chodniku. Proponowana kontrola: grass-on-light-paving
- Status: naprawione (14.11, PR #534 scalony 14.11 scalony); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (14.11); do PR; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g775 (89751b9, merge c1ad6ed), czeka na przegląd kuratora; wcześniej: zgłoszone (13.11, kurator, przegląd G-771)
- Pakiet właściciela: tools/orto (classify.ts)
- Test przyjęcia: narożnik Lubartowska/Noworybna i chodnik Królewskiej przy (608,-210) kostką; klucze 470,70 znikają
- 14.11 G-771 runda 2 (scalenie z regułą koron #519): klucze 470,70 zniknęły; do sprawdzenia, czy zostaje tylko kępa trawy przy pomniku na Królewskiej (607..610; -207..-212)
- 14.11 naprawiacz: reguły patyny i beżowej kostki w cieniu przy jednym nalocie letnim (CLASSIFIER_VERSION 5); raster tylko SM-0-0/0-1, 330 m²; orto:diff 25 m² (trawa -23,6, square +11,1); Królewska trawa 3,6 m² -> square; grass-on-light-paving 61,5 -> 38,25 m² (test z kafli, skipIf bez cache); skan bez zmian kluczy, złote bez zmian; zrzuty /dev/shm/g775-shots/grid.png

### G-772 Mediany barw z ortofoto liczone z pustego kafla 2024-06/stare-miasto-0-1
- Ważność: S4 · Zasięg: albedo-medians.json (ALBEDO_FLIGHTS 2025-04, 2024-06), stare-miasto-0-1
- Opis: albedo-report.ts nie pomija pustych nalotów (isBlank z G-771), biały kafel wchodzi do median barw; przeliczenie zmienia wygląd
- Status: naprawione (14.11, PR #531 scalony 14.11 (c2a2765) scalony); wcześniej: w PR (14.11, gałąź ccr-ec2c4269-ilh8k8-g772, 9754068); wcześniej: zgłoszone (13.11, naprawiacz G-771)
- Pakiet właściciela: tools/orto
- Test przyjęcia: albedo-report pomija nalot z isBlank; mediany bez kafla 2024-06/SM-0-1
- albedo-medians przeliczone; 2024-06 cobble do trawy 1,586→1,502; 2025-04 bez zmian od poprawki; renderer nie czyta pliku, wygląd bez zmian; plik nie jest pilnowany wobec pokryć (był nieaktualny już na main)

### G-781 Footway i łaty G-760 na obrysie schodów (193 klucze ground-over-steps na main)
- Ważność: S4 · Zasięg: 193 miejsca, m.in. 950;229, Podzamcze 803-829;237-247, Krakowskie 411-421;-86..-90
- Opis: kawałki gruntu z liftem wyższym niż schody (footway 0,09 nad 0,05) zachodzą na obrys steps ponad 0,01 m² i przebijają najniższy stopień
- Status: naprawione (14.11, PR #535 scalony 14.11 (b37f157) scalony); wcześniej: w PR (14.11, bff7cdd, po przeglądzie kuratora i rundzie 2); wcześniej: w naprawie, runda 2 (14.11): przywrócić drzwi wejścia n4934217573; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g781 (768efbb), czeka na przegląd kuratora; wcześniej: zgłoszone (14.11, naprawiacz G-777)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: ground-over-steps spada; zrzut 1009,6;447,5 bez kostki na stopniach
- chunkGround wycina obrys schodów z gruntu wyższego od nich (steps-cut.ts), narożniki cięcia z dokładnością do mm; ground-over-steps 234 -> 0 (193 klucze -> 0), żaden rodzaj nie rośnie; map-ground-golden 170580 -> 173539 wierzchołków; ubyły drzwi (0,44;-74,64) krakowskie-0-0, ich próg wypadał na stopniach
- Przegląd kuratora 14.11 (768efbb): ZGODNE Z UWAGAMI; brak szczelin poza krawędziami cięcia; grass +0,8 m² w orto:diff to artefakt kolejności mapy (pod stopniami); ubyte drzwi to wejście OSM n4934217573 (Poczta Główna, KP 50), odrzucone regułą ground (front ościeżnicy na pasie schodów 3 m, Site: rail). Decyzja nocna: regresja tej gałęzi, naprawa w rundzie 2 przed PR; kontrola entrance-no-door (baza main 9).
- runda 2: drzwi Poczty Głównej (n4934217573) wróciły: ościeżnica może wychodzić na górny stopień biegu na wysokości progu (props-doors.ts); nowa kontrola entrance-no-door, baza 9 z main, gałąź 10 -> 9; props.generated.ts jak na main; bff7cdd

### G-769 Ciemny trójkąt ok. 0,2 m w kostce na Krakowskim przy (297; -226) po G-764
- Ważność: S4 · Zasięg: krakowskie, (297; -226); zrzut /dev/shm/g764-reshoot/pair/krakowskie-297-215.png na 6b0ebb7
- Opis: drobna dziura w fills między nowym kawałkiem kostki z canopyHard a sąsiednim kawałkiem; widać ciemne podłoże; zauważone przez kuratora w przeglądzie G-764, potwierdzone ponownym zrzutem
- Status: naprawione (14.11, PR #532 scalony 14.11 (aa3d6fd) scalony); wcześniej: w PR #532 (14.11); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (14.11); PR po scaleniu #528 i przegenerowaniu; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g769b (f80370a), czeka na przegląd kuratora; wcześniej: zgłoszone (13.11, kurator, przegląd G-764)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: brak dziury w fills przy (297; -226) (sonda 0,1 m), kontrola lawn-leafoff-patch lub fills-gap
- 14.11: #519 (G-764) w main, można naprawiać
- 14.11: tileRings obrysowuje kafel o komórkę dalej i tnie na krawędzi; nowa kontrola fill-gap 130 -> 16; map-ground-golden 171963 -> 171799 (146ff8d4); przyjęte (decyzja nocna: rekomendowane przyjęcie, artefakty pomiaru) +1 ground-strip-gap nabrzeze-1-0 2521,96 (podzbiór gołego pola z main) i +1 kerb-gap-bare nabrzeze-0-0 2442.6,92.9 (próbka na wspólnej krawędzi, 0,4 mm)
- 14.11 przegląd kuratora (f80370a vs ebed0d2): ZGODNE Z UWAGAMI; orto:diff 6,3 m² (trawa +4,8 na green/canopy, kostka +1,3 na paving), teren 0, pomosty 0; odsłonięte 0,44 m² (paski ≤ 3 cm), nakładki fills bez zmian; klucze 2442,6;92,9 i 2521,1;95,9 potwierdzone jako artefakty; po scaleniu z main powtórzyć osm:build, scan:diff, orto:diff

### G-786 Goły teren zamiast trawnika pod pochyloną patyną dachu przy (475; -195)
- Ważność: S4 · Zasięg: stare-miasto-0-0 (470..480; -200..-190), ok. 14 m²
- Opis: Po G-775 próbki z patyną dachu na 2025-04 i cieniem na 2024-06 mają klasę asphalt; bare-cover zostawia asfalt goły, więc pas przy budynku jest gołym terenem (wcześniej błędny trawnik)
- Status: naprawione (14.11, duplikat G-788 (14.11, przegląd kuratora G-775) scalony); wcześniej: zgłoszone (14.11, naprawiacz G-775)
- Pakiet właściciela: tools/orto / tools/osm-import (bare-cover)
- Test przyjęcia: pas przy (475; -195) kostką, bez gołego terenu

### G-759 walk-blocked nie widzi płyt chodnika i podestu Arkad
- Ważność: S4 · Zasięg: klucze `stare-miasto-0-1 460,100/110/120`, `krakowskie-2-1 450,*`; ok. 500 stromych par po G-748
- Opis: kontrola z #497 bierze tylko teren, więc obniżenie gruntu pod płytami `arkady.ts` liczy jako uskoki i strome pary
- Status: naprawione (14.11, PR #529 scalony 14.11 (f312866) scalony); wcześniej: w PR (14.11), po G-778; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g759, 038d716): walk-blocked bierze wierzch płyt i brył scen (floorOver), bez budynków mapy i ich pokoi; pary na płytach Arkad 1117 -> 0, pary z dachów budynków 34426 -> 0; klucze skanu 1 -> 1; walk-review B zielony na scaleniu z G-778 (#526); do PR po #526; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g759, 6c4fc01): walk-blocked bierze wierzch płyt i brył scen (floorOver); pary na płytach Arkad 1117 -> 0 (G-758: 262 -> 0); klucze skanu 1 -> 1; czeka na poprawkę uskoków płyt Arkad (walk-review B); wcześniej: zgłoszone (13.11, naprawiacz G-748)
- Pakiet właściciela: tools/glitch-scan (walk-blocked)
- Test przyjęcia: `walk-blocked` bez kluczy pod płytami Arkad
- walk-review B pada z poprawką: łapie prawdziwe uskoki płyt Arkad (G-778); osie along zostają na groundY, bo z floorOver wychodzą bryły Alchemii na chodnikach (krakowskie-2-0 416,-38 i inne). Decyzja nocna (wariant rekomendowany): najpierw naprawa uskoków, potem G-759, bez ruszania testu B.
- 14.11 (naprawiacz G-778): floorOver traktuje budynek mapy jako podłogę: budynek stare-miasto-0-1 (468; 124,2, y -9,1..-2,3) daje w kwadracie 460,120 pary ledge 5,7-6,6 m przy ground -2,30; test B tego kwadratu nie sprawdza. Do poprawy w gałęzi g759 przed PR.
- runda 2 (679ef68): dachy budynków mapy i ściany pokoi nie są podłogą (budynek 468;124,2 w 460,120); test B wymaga #526 przed scaleniem

### G-768 Ustępowanie nadwozi G-744 kruche w zakręcie Kołłątaja przy Zesłańców Sybiru
- Ważność: S3 · Zasięg: -108,-150; ziarna 10/13/15/38 przy pasach przesuniętych o 5–10 cm
- Opis: bodiesMeet daje odległość spotkania na przemian z próbek co 1 m i z próbki za zakrętem, goesFirst zmienia decyzję, auto 9,9 m/s nie hamuje, oba są już za późno
- Status: naprawione (14.11, PR #530 scalony 14.11 (562804b) scalony); wcześniej: w PR (14.11): 82ace33, test abcd513 (12 s); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g768 (82ace33), runda 2: skrócenie testu (100 s z własnym limitem); wcześniej: zgłoszone (13.11, budowniczy ADR-0080 PR 3)
- Pakiet właściciela: packages/sim/src/systems
- Test przyjęcia: przemiatanie ziaren 1–40 w zakręcie bez kolizji przy pasach ±0,1 m
- przyczyna: próbki nadwozia co 1 m liczone od pozycji pojazdu gubiły wąskie miejsce za zakrętem co drugą klatkę; kolizje 1-40 ziaren przy pasach -0,2/-0,15/-0,1/-0,05 m: 4/1/4/1 -> 0; hash determinizmu bez zmian

### G-777 Szczeliny 10-30 cm między wstęgami różnych nawierzchni w złączach (gapFills łata tylko tę samą nawierzchnię)
- Ważność: S4 · Zasięg: ok. 10 złączy, ok. 0,8 m²: 837,0;205,3 (chodnik/jezdnia), 949,1;230,7, 247,7;-201,0, 1014,2;450,8, 743,7;13,7 (chodnik/footway), 97,9;98,4 (jezdnia/trawa)
- Opis: gapFills (line-buffer.ts) łata pęknięcia tylko między pasami tej samej nawierzchni, a kliny tylko szersze niż pęknięcie; wąska goła szczelina między chodnikiem a jezdnią lub footway w tarczy złącza zostaje; widać ciemny teren
- Status: naprawione (14.11, PR #528 scalony 14.11 (6c4c5bf) scalony); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (14.11, runda 2), w PR; wcześniej: naprawione na gałęzi (14.11, runda 2: ccr-ec2c4269-ilh8k8-g777, 1a83319; szczeliny poza schodami, kontrola ground-over-steps; komórki w tarczach 130 -> 58); do scalenia z main po #519 i ponownego przeglądu; wcześniej: w naprawie, runda 2 (14.11): przegląd kuratora NIEZGODNE, slitFills ma odjąć stopnie; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g777 (928f25a): komórki w tarczach 130 -> 55, w mieście między wstęgami 870 -> 528; czeka na przegląd kuratora; reszta 97,9;98,4 w osobnym wpisie; wcześniej: zgłoszone (13.11, naprawiacz G-765)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: brak gołych komórek 0,1 m między wstęgami w tarczy złącza w tych miejscach; ground-strip-gap nie rośnie
- Przegląd kuratora 14.11 (928f25a): NIEZGODNE. slitFills nie odejmuje stopni (above): 25 łat nad obrysem steps, 2,03 m² (949,0;230,4 wyszczerbia dolny stopień, 1009,6;445,4 kostka na trzech stopniach, 886,3;222,2 0,31 m²). Poprawka w tej gałęzi (runda 2); T-290; proponowana kontrola ground-over-steps
- Przegląd kuratora 14.11 (6ccd1ba, runda 2): ZGODNE Z UWAGAMI. orto:diff wobec main 6,8 m², teren 0, pomosty 0; wiersze bazowe bez zmian. Łaty na steps najwyżej 0,0064 m². Po wycięciu 47 łat G-760 przybyło 0,026 m² gołego gruntu w 3 szczelinach poniżej MIN_SLIT: 186,3;-210,7 (0,015 m², widoczny klin ok. 1,1 m), -90,3;-75,1 (0,009), 1082,3;255,9 (0,002). Zrzuty /dev/shm/g777-cur2/grid.png

### G-770 Rewolwer: kciuk i palec wskazujący wchodzą w bryłę broni w FPP
- Ważność: S4 · Zasięg: rewolwer w widoku FPP (ta sama poza co pistolet): kciuk do 9,8 mm, wskazujący do 10 mm w bryle; kłąb kciuka lewej dłoni (Thumb1) ok. 11 mm w chwycie pistoletu
- Opis: poza RIGHT_ON_HANDGUN dobrana do szkieletu pistoletu; szerszy bęben rewolweru; test głębokości (mesh-depth.ts) obejmuje tylko pistolet i kości Thumb2/Thumb3
- Status: naprawione (14.11, PR #504 scalony 14.11 (7064224); poza R1, test G-770 w zakresie przodu chwytu (2 mm), tył chwytu do 13 mm zasłonięty pięścią scalony); wcześniej: zgłoszone (13.11, ręce FPP runda 6)
- Pakiet właściciela: packages/engine (renderer/fpp-hand-poses.ts)
- Test przyjęcia: test głębokości skóry dłoni w bryle broni ≤ 2 mm dla każdej broni krótkiej i wszystkich kości kciuka

### G-771 Puste (białe) kafle ortofoto w pokryciu i raporcie komórek stare-miasto-0-0 i 0-1
- Ważność: S3 · Zasięg: kafle 2023-09/stare-miasto-0-0 i 2024-06/stare-miasto-0-1 (100% białe, jedyne w mieście); w pokryciu ok. 2 740 m² zieleni i koron jako kostka/asfalt (0-0: 1 256, 0-1: 1 484) i ok. 250 m² cienia; raport wybiera pusty nalot jako najmniejszy przechył
- Opis: fetch.ts zostawia biały kafel z ostatniej usługi; classifyRect uśrednia go jak nalot; lean.ts daje mu wynik 0. Skutek: bare-cover.ts i kontrole bare-on-cover/fill-on-green czytają zieleń jako twardą; 'twarde 100%' w notatkach 0-0 i 0-1 to artefakt (działka Rybna 12: zieleń i gruz). Proponowana kontrola cover-blank-flight (baza 2).
- Status: naprawione (14.11, PR #527 scalony 14.11 (f4f4df8) scalony); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g771 (5c0dc65, 32c6ec6, merge 4c6fe3b z #519; CLASSIFIER_VERSION 4), w PR; wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (13.11); scalać po #519 z CLASSIFIER_VERSION 4, przebudową data/orto, osm:build i scan:update; poprawić nazwy ulic w opisie PR; wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g771 (5c0dc65, 32c6ec6), czeka na przegląd kuratora; konflikt CLASSIFIER_VERSION z #519 (druga wchodząca daje 4 i przebudowuje data/orto); wcześniej: zgłoszone (13.11, kurator, audyt luk SM)
- Pakiet właściciela: tools/orto (fetch.ts, cover.ts, lean.ts), potem data/orto i osm:build
- Test przyjęcia: nalot z bielą > 95% pominięty w klasyfikacji i w przechyle; stare-miasto.cover przeliczone; raport 0-0/0-1 wybiera nalot ze zdjęciem; orto:diff do kuratora
- 13.11 przegląd kuratora: nazwy w 32c6ec6 („Rybna/Grodzka”) błędne: Królewska, narożnik Lubartowska/Noworybna, 1 m² przy Rybnej. Klucze 510,-170 i 610,-220 powinny zniknąć po #519. Klucze 470,70 to nowe odstępstwo (G-775).

### G-778 Uskoki między płytami chodnika i podestu Arkad
- Ważność: S3 · Zasięg: stare-miasto-0-1 (465..468; 116..119), krakowskie-2-1 (448; 80)
- Opis: arkady.ts pavement(): płyty co 2 m na maksimum terenu mapy, wierzchy a 38..44: -6,17/-6,71/-7,46 (stopnie 0,54 i 0,75 m > STEP_HEIGHT), podest -5,72 przy płycie -5,22 (0,50 m); od północy nie wejdzie się wyżej; wyszło z G-759 (walk-review B)
- Status: naprawione (14.11, PR #526 scalony 14.11 (ebed0d2) scalony); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (14.11); do PR; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g778, 327028f), czeka na przegląd kuratora; wcześniej: zgłoszone (13.11, naprawiacz G-759)
- Pakiet właściciela: packages/sim (content/alchemia)
- Test przyjęcia: walk-review B zielony; między sąsiednimi płytami Arkad <= 0,45 m
- 327028f: chodnik w dwóch pasach (ściana 2 m do a 44, zewnętrzny do a 38), komórki 0,5 m; stopnie 0,75 -> 0,25 m, krawędzie 0,6/0,48 -> 0,42/0,30 m; wierzch nad NMT maks. 1,08 -> 0,41 m; hashe i skan bez zmian; walk-review B zielony na scaleniu z g759
- Przegląd kuratora 14.11 (327028f): ZGODNE Z UWAGAMI. Stopnie do 0,26 m (nie 0,25), krawędzie do 0,42 m, 0 punktów obwodu > 0,45 m; 18 m² na nawierzchni mapy square, bez gołego gruntu; T-206/207/219/230/231 bez zmian; dopisek do T-218.

### G-766 Kawałki fills dotykające same siebie (ósemki) triangulowane z nadmiarem
- Ważność: S4 · Zasięg: stare-miasto-1-0 (619,94; -232,85) 2,0/1,1 m²; na main m.in. trawa podzamcze-1-1 112,4/103,9 m², nabrzeze-0-0 24,5/20,9 m²
- Opis: cutByPieces (bare-cover.ts) przepuszcza obrysy z powtórzonym wierzchołkiem (crossesItself łapie tylko przecięcia); triangulacja daje więcej niż pole; od G-764 czerwony grass-under-paving; naprawa w rundzie 2 G-764
- Status: naprawione (14.11, PR #519 scalony 14.11 (75ab680) scalony); wcześniej: naprawione na gałęzi G-764 (6b0ebb7), do archiwum razem z PR G-764; wcześniej: w naprawie (13.11, gałąź G-764)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola fill-area-mismatch: |triangulacja - pole| <= 0,01 m² dla każdego kawałka fills

### G-764 Trawnik pod koronami drzew na kostce (reguła koron, ADR-0077 krok 1.2)
- Ważność: S4 · Zasięg: 4 dzielnice, ok. 474–670 m², m.in. promenada nad Czechówką przy VIVO (x 1090, z 185), Furmańska (x 646, z 257)
- Opis: bare-clean.ts mixedRow zamienia koronę (klasa canopy) w trawnik, gdy g > q || s > q, także wśród samej kostki (g = 0). Nalot bezlistny 2025-04 pokazuje tam jasną kostkę (L ≥ 115, S ≤ 0,12: 474 m², z tego 199 m² było kostką na main). Propozycja: rozdzielić w tools/orto klasę canopy na koronę nad twardym i nad miękkim; nad twardym kostka, nad miękkim trawnik; kontrola skanu lawn-on-leafoff-paving. Szczegóły: scratchpad topo-adr77kerb-raport.md.
- Status: naprawione (14.11, PR #519 scalony 14.11 (75ab680) scalony); wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g764, e936eb2): klasa canopyHard, lawn-on-leafoff-paving 619 -> 71,5 m² (plamki < 2 m²); runda 2: ósemki w cutByPieces; potem przegląd kuratora (orto:diff, prawda bez leisure=park); wcześniej: zgłoszone (13.11, kurator, przegląd kroku 1.2)
- Pakiet właściciela: tools/osm-import, tools/orto
- Test przyjęcia: kontrola lawn-on-leafoff-paving < 50 m², a zarośla Nabrzeża (x 2500..2534, z 107..139) i żywopłot Podzamcza (x 551..569, z 353..359) zostają trawą
- Wiersz topografii: T-287.
- runda 2 (6b0ebb7): obrysy fills dotykające same siebie rozcinane na proste pierścienie (splitTouching); kontrola fill-area-mismatch 12 -> 0; grass-under-paving zielony; map-ground-golden 168809/f7705141
- Przegląd topografii 13.11 (6b0ebb7): ZGODNE Z UWAGAMI (T-287); zrzut Krakowskie (297; -226) do powtórzenia.
- Ponowny zrzut (297; -226) na 6b0ebb7 potwierdza ciemny trójkąt: zgłoszony jako G-769, nie blokuje PR #519 (kurator).

### G-758 Import wybiera komórki terenu 4 i 8 m niepodzielne przez 2,5 i 5 m sąsiadów
- Ważność: S3 · Zasięg: krakowskie-2-1 i inne kawałki siatki 4/8 m; szwy zostają 0,51 / 0,225 / 0,18 m po G-748
- Opis: `tools/osm-import/src/terrain.ts` `CELLS`: siatka 4 m ma z siatkami 2,5 i 5 m wspólne punkty tylko co 20 m, więc `stitchSeams` nie może jej zszyć; ADR-0043 zakłada wspólny wiersz punktów na szwach
- Status: naprawione (13.11, PR #522 scalony 13.11 (5009251) scalony); wcześniej: przegląd kuratora ZGODNE Z UWAGAMI (13.11); do PR; wcześniej: w naprawie (gałąź ccr-ec2c4269-ilh8k8-g758, 571459c): CELLS 10/5/2,5/1,25, seam-gap 0,05 m: 2 -> 0 kluczy, szwy 0,51 -> 0 m; czeka na przegląd kuratora (orto:diff); wcześniej: zgłoszone (13.11, naprawiacz G-748)
- Pakiet właściciela: tools/osm-import (teren), packages/sim (content/lublin)
- Test przyjęcia: na każdym szwie różnica ≤ 0,05 m
- Do zrobienia razem z kontrolą `seam-gap` z przeglądu #502 (kurator 13.11).
- Kontrola seam-gap (gałąź ccr-ec2c4269-ilh8k8-seam-gap, 29f7b55): baza main 16 kluczy / 210 próbek; po #502 zostaje 1 (myjnia 380,-20); (240;114) w obrysie budynku, x=460 pod płytami Arkad – nie liczone
- Kontrola seam-gap w main (#507, 13.11): baza 1 klucz (krakowskie-2-1 380,-20, myjnia); G-754 w toku.
- seam-gap krakowskie-2-1 380,-20 to był pad myjni; po G-754 baza seam-gap 0

### G-765 roundJoints odrzuca bit klinu 3,5-10 st. (dwa obrysy po mm Clippera)
- Ważność: S4 · Zasięg: złącza dróg pod kątem 3,5-10 st.; sonda losowa: 21/400 par
- Opis: Bit round endu dzielący wspólną krawędź z pasem daje po unii 2 obrysy i jest odrzucany; po G-760 klin kryje osobna łata, więc pas nie ma okrągłego końca w jednym pierścieniu
- Status: zamknięte bez zmian (13.11, fałszywy alarm co do skutku; resztki w G-777); wcześniej: fałszywy alarm co do skutku (13.11, naprawiacz): po G-760 klin kryje łata, bez skutku dla gracza i skanu; poprawka (bit +2 mm) pogarsza skan (marking-step +1, overlap +2) i daje +0,9 m² gołych komórek; wcześniej: zgłoszone (13.11, naprawiacz G-760)
- Pakiet właściciela: tools/osm-import
- Miasto: 74 odrzucenia / 66 bitów; w chunkach gry goło 3,0 m²: 2,2 m² koniec footway w nieutwardzone (856,5;304,6), ok. 0,8 m² szczelin między różnymi nawierzchniami (G-777); wariant ich nie zamyka. Sondy: scratchpad g765-*

### G-761 Trawniki w pierścieniu skweru na Podzamczu pod kostką ścieżki
- Ważność: S4 · Zasięg: w804709919, w804709920 (1045, 424), 46 m²; podobnie zieleń pod footway w pętlach w1343050082 (58,-83) 19 m², w154012559 15 m², w515648305 10 m²
- Opis: Pas footway pierścienia (szerokość domyślna) leży na półksiężycach trawnika widocznych na ortofoto; skwer traci rysunek. Proponowana kontrola skanu loop-paving-on-green (m² kostki na zieleni wewnątrz pętli ścieżek, baza 5 pętli).
- Status: zamknięte bez zmian (13.11, fałszywy alarm, przyczyna w rastrze: G-774); wcześniej: fałszywy alarm (13.11, naprawiacz): zawyżenie przez raster cover, geometria zgodna z ortofoto; wcześniej: zgłoszone (13.11, kurator, przegląd ADR-0078 etap 2)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: zieleń z ortofoto pod footway/square wewnątrz pętli w804709919 < 5 m²
- Wiersz topografii: T-286.
- 13.11 naprawiacz: ortofoto 0,1 m (ExG>0,07 na 2025-04 i 2024-06): trawnik pod footway/square w pętli w804709919 4,0 m² (<5, test przyjęcia spełniony na main), w1343050082 0, w154012559 1,9, w515648305 0. 43,75 m² z rastra to wygładzanie 1,5 m i zielonkawy bruk 2023-09. Pierścień 2,4-2,7 m na zdjęciu, domyślne 2,5 m; półksiężyce zgodne do 0,25 m.

### G-755 Droga pieszo-rowerowa w179264855 w grze za stroma (0,8–0,92) przy (667–682; 134–141)
- Ważność: S3 · Zasięg: zejście ze Starego Miasta na Podzamcze; ok. 1 440 par `walk-blocked` (kwadraty 670,130 i 670,140)
- Opis: OSM: highway=pedestrian, bicycle=yes, lit, nie schody; oś w grze spada 4,5 m na 4 m; sprawdzić NMT i zdjęcia: jeśli spadek jest łagodniejszy — wygładzić, jeśli to schody/rampa — wymusić schody (flightRamps)
- Status: naprawione (13.11, PR #515 scalony 13.11 (7877dda) scalony); wcześniej: w PR (13.11, ccr-ec2c4269-ilh8k8-g755, 7d61872; walk-blocked 5 -> 1); wcześniej: zgłoszone (13.11, kurator, przegląd walk-blocked)
- Pakiet właściciela: packages/sim (content/lublin teren)
- Test przyjęcia: `walk-blocked` bez kluczy na osi w179264855; postać przechodzi
- Teren gry zgodny z NMT (NMT 9 m na 10 m); reguła steepWays (import) + wayRamps (sim): odcinki dróg pieszych za strome na terenie gry kładzione równym spadkiem tg 30°; przy okazji ścieżka w202269259 (podzamcze 770,180) też poprawiona; orto:diff: teren 30 pkt, maks. 1,86 m w dół (670; 132,5)
- Przegląd kuratora 13.11: ZGODNE Z UWAGAMI (T-288).

### G-762 startOf wybiera komórkę startową 3 m nad stopami u muru przyczółka dolnego mostu Mełgiewskiej
- Ważność: S3 · Zasięg: planer pościgu przy murach przyczółków, np. (2415; 280)
- Opis: u stopy muru przyczółka komórka stóp zamknięta (stroma); startOf bierze sąsiada na murze 3,4 m wyżej, a wallOnWay nie widzi ściany ze stromej komórki; droga prowadzi po murze, ganger napiera na niego, dalej idzie tylko po bocznym kroku kontroli utknięcia
- Status: naprawione (13.11, #516 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g762, b4b7410); wcześniej: zgłoszone (13.11, naprawiacz G-747)
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: pościg z (2414,5; 280,1) na pomost nabrzeze-0-1/0 przy t=0,1 bez napierania na mur; startOf nie wybiera komórki wyżej niż krok + stok
- startOf: komórka startowa nie wyżej nad stopami niż krok + stok (aboveLevel); stopa muru: krok w bok kontroli utknięcia 18/30 -> 0/30, najgorszy czas 19,7 -> 6,1 s; sonda G-741 129/150 -> 129/150, 14 prób szybszych

### G-760 Dziury 5–20 cm w nawierzchni jezdni pod pasami aut
- Ważność: S3 · Zasięg: car-lane-off-road i lane-off-ground po G-756: 930,15,329,81 (Al. Tysiąclecia#81:1), 1080,10,564,02 (Podzamcze#107:0), 2525,7,357,5 i 2505,04,331,52 (Turystyczna#122:0), 26,18,−102,66 (Kościuszki#4, pod pasem plac zamiast jezdni)
- Opis: siatka próbek w układzie świata (G-756) trafia w małe dziury nawierzchni pod pasem, które stara siatka po łuku omijała
- Status: naprawione (13.11, #514 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g760, merge 74a981d); wcześniej: wstrzymane: przyczyna w kodzie G-744/ADR-0078 etap 2 (końce pasów w złączach); wcześniej: zgłoszone (13.11, naprawiacz G-756)
- Pakiet właściciela: packages/sim (content/lublin nawierzchnie), tools/osm-import
- Test przyjęcia: `car-lane-off-road` i `lane-off-ground` bez tych kluczy
- Przyczyna: proste ucięcia pasów jezdni dwóch dróg we wspólnym węźle nie pokrywają się (wierzchołki zaokrąglane osobno do 0,1 m, różne szerokości, klin na zakręcie); szczeliny 5-10 cm. Kościuszki#4 to ta sama szczelina, plac tylko prześwituje. Na danych g744 zostają 4 z 5 miejsc (i dziury ok. 25 cm przy ~2526,356): roundJoints pomija kawałki < SLIVER 0,1 m / MIN_CAP 0,3 m² i liczy przed zaokrągleniem do 0,1 m. Naprawa po scaleniu g744, w line-buffer.ts (złącze po zaokrągleniu albo nakładka w złączu); test: odcinek między ucięciami pasów ze wspólnym węzłem leży na road. Sonda: scratchpad g760-probe.test.ts.
- Skan car-lane-off-road nabrzeze-0-1 2340,420 (Kalinowszczyzna#131:f, 2340,427): dziura w jezdni 5-10 cm przy przejściu ścieżki, przyjęta do bazy w 8179d72 na gałęzi G-744; po poprawce scan:update ją usuwa
- Łaty szczelin i klinów w złączach (line-buffer.ts gapFills, osobne wstęgi). Skan: car-lane-off-road 5->0, lane-off-ground 3->0; ground-strip-overlap +20, kerb-gap-bare +2 przyjęte z uzasadnieniem. map-ground-golden 155341/1117bd89. orto:diff 49,8 m² do kuratora.
- 13.11 przegląd kuratora 74a981d: ZGODNE Z UWAGAMI. footway +17,5 m² to łaty szczelin ścieżek (gołe 7,4, schody 5,3, plac 4,9, chodnik 1,4, trawa 0,9); jezdnia na zieleni ortofoto 0,3 m²; kliny jezdni do 4,3 m² na kostce ortofoto; przejścia leżą wyżej (0,13). Uwagi do rundy 2: łaty ścieżek na schodach (10 miejsc, 5,3 m²), zniknięcie 2 kratek ściekowych (126,89;100,89) i (2349,39;314,29), 2 jasne kropki na zrzucie Podzamcza; propozycja kontroli patch-on-steps.
- Runda 2 (#514, 9f0bad0): łaty nie wchodzą na schody i zebry (test), krawężniki i wypełnienia z ortofoto czytają ziemię bez łat (kratki jak w main), Podzamcze 0 dziurek w rastrze 0,1 m. Skan: ground-strip-overlap +18, kerb-gap-bare +1 przyjęte; map-ground-golden 171653/2f66bb82; bench +8,4% / +11,9%.
- Kolejna szczelina 1–2 cm w poprzek jezdni Narutowicza przy 239,-172.9 (krakowskie-1-0); pas trafia w nią przy przesunięciu o 8 mm (ADR-0080 PR 3, wariant odrzucony)

### G-767 Main czerwony: test venues „sign nearly all” ponad 20 s w CI po #510
- Ważność: S2 · Zasięg: CI na main 4f42767 i wszystkie PR-y w osm-import (#514, #515)
- Opis: czas testu rósł z kolejnymi zmianami mapy: etap 2 ADR-0078 (#509) +29% (dług ADR-0046), krok 1.2 ADR-0077 (#510) +9%; pod coverage w CI przekroczył limit 20 s
- Status: naprawione (13.11, #517 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-venues-speed, 6fa4b7b): miasto dla testów w osobnym procesie bez pokrycia; z coverage 11–13,4 s → 3,9–6,2 s; wcześniej: w naprawie (13.11, gałąź ccr-ec2c4269-ilh8k8-venues-speed)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: test pod --coverage < 10 s lokalnie, wynik generowania bajt w bajt, bez podnoszenia limitu
- Poboczne: kerbStrips i steps w bare-strips.ts startują BFS od wszystkich komórek jezdni i chodnika (także wnętrza bez wolnych sąsiadów) — do przyspieszenia osobno.

### G-763 Ganger stoi pod krawędzią dolnego mostu Mełgiewskiej (2449,4; 258,8) i (2454,6; 293,5) mimo przejść obok
- Ważność: S3 · Zasięg: sonda G-741, ok. 6 z 30 punktów przy pomostach nabrzeze-0-1/0 i /1
- Opis: krawędź pomostu 0,1-0,25 m nad gruntem: raster i walkable widzą przejście, bankNear/offTheBank zatrzymuje stopy; ganger stoi od kilku sekund pościgu bez fallbacku followDetour
- Status: naprawione (13.11, #513 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-g763, 13.11); wcześniej: zgłoszone (13.11, naprawiacz G-747)
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: sonda G-741: punkty nabrzeze-0-1 0 0.85 ±9,5 i 1 0.1 8 dochodzą
- Przyczyna: bankNear przepuszczał poślizg wzdłuż skarpy (CREEP), a pole (passable) nie brało Raster.walls. Poprawka: każdy poślizg w pierwszych 0,6 m to brak prostego marszu; pole nie idzie w górę ściany. Sonda G-741: 94 → 129/150, bez regresji, hash bez zmian.
- Po poprawce nadal nie dochodzą w sondzie G-741: podzamcze-2-0 0 0.5 4 i 0 0.3 5 (5/5), nabrzeze-0-1 1 0.15 -14 (5/5), 1 0.9 -12 (3/5), 1 0.15 7 (3/5, stoi w 2451,9; 299,2). Test app alchemia-ramp-traffic trwa ok. 5 s także na main (granica limitu).

### G-754 Podkład myjni (T-051) tworzy skarpę 1,19 m na Bajkowskiego i przejściu
- Ważność: S3 · Zasięg: Krakowskie 380..390, -30..-10; 10 par `walk-blocked`
- Opis: podkład CAR_WASH_AREA (blend 3 m) podnosi teren o 1,3 m; NMT 0,04, w grze 1,19 na ulicy Wacława Bajkowskiego i przejściu; błąd zrobiony przez grę
- Status: naprawione (13.11, #512 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g754, f395319); wcześniej: zgłoszone (13.11, kurator, przegląd walk-blocked)
- Pakiet właściciela: packages/sim (content/lublin teren, podkłady)
- Test przyjęcia: `walk-blocked` bez kluczy przy 380,-20; teren ulicy w ±0,1 m od NMT
- 13.11: walk-blocked 1,19 przy 380,-20 to był artefakt błędu pamięci skanu (fix c17fcb5 w #497); po poprawce brak zablokowanych par, zostaje odstępstwo terenu ulicy od NMT o 1,31 m (topografia, nie przejście)
- 13.11 f395319: pad T-051 x 388..422, z -41..-27; Bajkowskiego i przejścia ≤0,1 m od NMT; pad-on-road krakowskie 7→1, seam-gap 1→0; złote hashe determinism, reinforcement-sidestep i ground-cut krakowskie-2-0 zmienione świadomie (treść)
- 13.11 kurator: ZGODNE Z UWAGAMI; krawędź padu z −25 ≤0,18 m, z −45 = NMT, meble i auto na gruncie; T-003 zaktualizowane

### G-747 `followDetour` bez osiągalnej komórki w linii prostej kieruje gangera do `way[1]`, nawet nieosiągalnej
- Ważność: S3 · Zasięg: planer pościgu w terenie ze skarpami; możliwe źródło części z 14 z 30 nieudanych dojść przy przyczółkach Mełgiewskiej (G-741), np. (2454,5; 293,7), (2449,5; 258,9), (2481,5; 415,7)
- Opis: gdy żadna linia z punktu gangera nie przechodzi, fallback wybiera następny punkt drogi bez sprawdzenia osiągalności; ganger napiera na skarpę albo krąży w kieszeni
- Status: naprawione (13.11, #511 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g747, 7bbafa1): fallback do osiągalnej komórki niżej w polu (walkable + poziom stóp); sonda G-741 18/30 -> 19/30, 150 prób 87 -> 94 bez regresji; hash bez zmian; wcześniej: zgłoszone (13.11, naprawiacze G-741 i G-740)
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: 30 punktów przy bokach pomostów (sonda G-741): dojścia ponad 16/30 bez regresji; test z jednego z punktów wyżej pada bez poprawki
- Po G-746: `followDetour` w `steering.ts` (l. 144), fallback `way[1]` w l. 162.
- Punkty (2454,5; 293,7) i (2449,5; 258,9) stoją na main bez udziału fallbacku, (2481,5; 415,7) już dochodzi; test przyjęcia z punktu sondy przy podzamcze-1-0 (772,7; 200,3)

### G-757 Chodnik w295849309 przy kładce w295849307 ponad tg 35° wzdłuż osi
- Ważność: S4 · Zasięg: Podzamcze 1070..1080,160..170; 44 pary `walk-blocked`
- Opis: oś chodnika do zachodniego końca kładki spada ponad 0,7 na 2 m (skarpa rowu Czechówki); prawdopodobnie ustąpi po G-739 (#501: koniec pomostu na szczycie skarpy) — sprawdzić po scaleniu
- Status: naprawione (13.11, #509 scalony); wcześniej: zgłoszone (13.11, budowniczy walk-blocked)
- Pakiet właściciela: packages/sim (content/lublin teren, pomosty)
- Test przyjęcia: `walk-blocked` bez kluczy przy 1070,160 po G-739
- Po scaleniu main do gałęzi G-744 (141d155) klucz walk-blocked podzamcze-2-0 1070,160 zniknął po scan:update; do archiwum razem z PR G-744

### G-744 Pasy ruchu biorą odsunięcie od zmierzonego zasięgu asfaltu: przesunięcie krawędzi jezdni o centymetry daje kolizje aut
- Ważność: S3 · Zasięg: ruch w całym mieście; ujawnione przez etap 2 ADR-0078 (łuki łączeń zmieniają zasięg asfaltu o kilka cm, pasy przesuwają się do 12 cm): `traffic-junction-drive` przy 3 Maja (1 ziarno z 12), Kołłątaja/Zesłańców Sybiru (−108; −149) seed 10, Cicha seed 30; na main 0
- Opis: `reachAt`/`roadHalfWidth` w `sim/content/traffic.ts` liczą odsunięcie pasów od zmierzonego asfaltu, bez minimalnego odstępu przeciwnych pasów; kruche wobec każdej zmiany geometrii nawierzchni
- Status: naprawione (13.11, #509 scalony); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g744 (13.11, 18967c1, na etapie 2 ADR-0078: przyczyną obrót auta na załamaniu pasa i brak sprawdzania brył z naprzeciwka, nie przesunięcie pasów; `traffic-bodies.ts` z pierwszeństwem, spawn bez kolizji z nadjeżdżającym; seedy 1–40 w 3 miejscach 0/120; czas testów ruchu +5–10%; do scalenia razem z etapem 2); wcześniej: w naprawie (13.11, zgłoszone przez budowniczego etapu 2 ADR-0078); blokuje scalenie etapu 2
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: `traffic-junction-drive` zielony na gałęzi etapu 2 (12/12 ziaren), probe seedów 1–40 bez kolizji na main i na gałęzi; złoty hash świadomie
- Gałąź zsynchronizowana z main (bf81314): hashes zgodne, skan 7412 -> 7159, wzrosty tylko sidewalk-under-carriageway +4 (Podwale x2, Dolna PM, Bernardyńska 390,-240 z footway-on-carriageway) i car-lane-off-road +1 (G-760); dług czasu w ADR-0046

### G-749 Test `grass-under-paving` (Plac Litewski, szwy kawałków) przekracza 20 s w CI
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/grass-under-paving.test.ts` › „leaves no bare strip in Plac Litewski's lawns…”; w CI #491 (13.11) przekroczył 20 s, po ponowieniu przeszedł; lokalnie przechodzi
- Opis: test liczy wyciąg całego obszaru placu przy każdym uruchomieniu; blisko limitu, więc pod obciążeniem runnera pada niezależnie od zmiany
- Status: naprawione (13.11, #508 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g749, c424df6): pomijanie trawników po prostokącie +0,5 m; test 4631 -> 274 ms (bench:ab, 6 par, load 12-16), pod --coverage 8368 -> 337 ms; 80 940 próbek bez różnic; wcześniej: zgłoszone (13.11, orkiestrator, CI #491)
- Pakiet właściciela: tools/glitch-scan
- Test przyjęcia: czas testu w CI ≤ 50% limitu (pomiar `pnpm test:rerun`/raport vitest), bez podnoszenia limitu

### G-746 `steering.ts` ma 717 linii, ponad limit 500 z ADR-0031
- Ważność: S4 · Zasięg: packages/sim/src/systems/ai/steering.ts (686 → 717 po G-741), wyjątek w lincie
- Opis: plik nawigacji urósł przy G-738/G-741; kandydat do podziału (planer, pole odległości, sprawdzanie krawędzi)
- Status: naprawione (13.11, #505 scalony); wcześniej: w PR (gałąź ccr-ec2c4269-ilh8k8-g746, 5f19528): steering.ts 707 → 186 linii, podział na nav-field.ts (259), straight-walk.ts (187), chase-detour.ts (118); hashe bez zmian; wcześniej: zgłoszone (13.11, naprawiacz G-741); po scaleniu G-740 i G-741
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: plik ≤ 500 linii bez wyjątku w lincie, złoty hash bez zmian

### G-756 Klucze rodzajów próbkowanych w bazie skanu przesuwają się przy zmianie tablic, choć suma maleje
- Ważność: S3 · Zasięg: `ground-strip-gap`, `ground-strip-overlap` (i pewnie inne z `SAMPLED_KINDS`); przy G-739 (2 pomosty w podzamcze-2-0) +49/−53 i +145/−155 kwadratów w podzamcze-0-1 i 2-0, z dala od zmiany
- Opis: siatka próbek tych kontroli zależy od zawartości kawałka (np. obrysu albo kolejności kawałków nawierzchni), więc lokalna zmiana przesuwa próbki w całym kawałku i nowe klucze wymagają `GLITCH_BASELINE=accept`; zakotwiczyć siatkę próbek w układzie świata (wielokrotności kroku), żeby klucze zmieniały się tylko tam, gdzie zmienia się mapa
- Status: naprawione (13.11, #503 scalony); wcześniej: w PR (13.11, gałąź ccr-ec2c4269-ilh8k8-g756 @ 3b1b8d3: liczniki i próbki zakotwiczone w kwadratach świata); wcześniej: zgłoszone (13.11, orkiestrator przy scalaniu G-739)
- Pakiet właściciela: tools/glitch-scan
- Test przyjęcia: przesunięcie jednego pomostu w kawałku zmienia klucze tylko w kwadratach, które on dotyka (test na kopii tablic)

### G-748 Uskok terenu do 3,3 m na szwie kawałków krakowskie-2-1 | stare-miasto-0-1
- Ważność: S3 · Zasięg: x = 460, z 104–110: teren krakowskie-2-1 −9,20, stare-miasto-0-1 −5,80…−7,12
- Opis: teren dwóch sąsiednich kawałków rozjeżdża się na szwie; `walk-blocked` (ADR-0080 PR 4): 48 par
- Status: naprawione (13.11, #502 scalony); wcześniej: w PR (13.11, częściowo: x=460 3,30 → 0,51 m, 12 szwów → 0; gałąź ccr-ec2c4269-ilh8k8-g748); wcześniej: zgłoszone (13.11, budowniczy ADR-0080 PR 4)
- Pakiet właściciela: packages/sim (content/lublin terrain)
- Test przyjęcia: `walk-blocked` bez kluczy na szwie x = 460; teren obu kawałków ciągły (różnica ≤ 0,05 m wzdłuż szwu)
- Przegląd topografii PR #502: ZGODNE Z UWAGAMI. Względem NMT (σ 1,5) punkty szwów: mediana 0,028 → 0,035 m, maks. 0,054 → 0,43 m (sm1-1|pz0-0, z 160), w tolerancji importu. Zostają szczeliny > 0,1 m: (240; 113,75–115,25) do 0,18 m, (384,5–386,5; −20) do 0,22 m (krawędź pada myjni T-051), (460; 103–109,25) do 0,51 m pod płytami Arkad. Propozycja kuratora: kontrola skanu `seam-gap` (|h_a − h_b| na szwach co 0,25 m, > 0,1 m, poza płytami; baza 2 miejsca, 16 próbek) razem z G-758.

### G-739 Koniec kładki Podzamcza (1073,9; 160,5) leży na skarpie rowu Czechówki, pomost o 2,7 m za nisko (T-166)
- Status: naprawione (13.11, #501 scalony); wcześniej: w PR #501 (13.11, d70ed63 po scaleniu main: skan z obiema nowymi kontrolami, tablice przegenerowane, golden +20 wierzchołków); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g739 (13.11, ae90173: koniec pomostu na skarpie przesuwany wzdłuż drogi do szczytu skarpy; kładka −23,04…−23,91, ok. 3,8°; `bridge-end-in-slope` 3 → 0, `ground-over-deck` 397 → 395; przy okazji G-362 koniec +0,58 m; przegląd kuratora ZGODNE Z UWAGAMI 13.11; czeka na G-741 i G-743); wcześniej: zgłoszone (13.11, kurator, ortofoto 2025-04 i 2024-06, NMT)
- Ważność: S3 · Zasięg: 1 pomost (podzamcze-2-0, kładka w295849307, 8 m): gracz i AI przechodzą po zjeździe 2,2 m na 8,3 m (15°) zamiast po poziomym przęśle · Koszt: mały
- Gdzie: (1073,9; 160,5) pomost −25,63, chodnik zachodni −22,9, teren na x 1071–1073 od −22,9 do −23,4; 2 próbki `ground-over-deck` (0,054 m); 3 próbki `deck-abutment-step` (1073,8; 161,7), (1073,8; 161,1), (1073,9; 160,6)
- Dowód: nakładki ortofoto w scratchpadzie sesji (`topo-kladka-orto-2025-04.png`, `-2024-06.png`): przęsło poziome, ciągłe z chodnikiem, bez schodów; NMT wzdłuż z = 160,6: krawędź rowu x≈1072,5 (−22,9), skarpa 45° do dna −27,7; koniec osi 1,4 m w głąb skarpy. Drugi koniec (1082,2; 160,9) zgodny (−23,47)
- Przyczyna: `bridge-ends.ts` (`AT_EDGE` 0,5 m) nie przedłuża końca, bo obrys `man_made=bridge` też zachodzi na skarpę (dokładność OSM ok. 1 m); `makeDeck` bierze `rawHeight` końca osi
- Pakiet właściciela: tools/osm-import (`bridge-ends.ts`), packages/sim (`content/lublin/decks.ts`)
- Test przyjęcia: `deck-abutment-step` i `ground-over-deck` = 0 przy kładce; nowa kontrola `bridge-end-in-slope` (koniec osi pomostu z NMT niższym o > 0,5 m od maksimum NMT w 2,5 m wzdłuż osi na zewnątrz) = 0 (baza 1, pozostałe końce do zmierzenia). Propozycja: wysokość końca z najbliższego węzła dojścia albo koniec osi wyniesiony do krawędzi rowu; pomost wtedy ok. −22,9…−23,5

### G-742 Białe fasady przepalają się w słońcu (4,6–4,8% dolnej połowy kadru)
- Ważność: S4 · Zasięg: ujęcia z chodników przy Placu Litewskim (-91;127) i (-89;-199) o 12:00; przepalenie z białych fasad, nie z nawierzchni; próg przyjęty przy G-721: ≤ 3%
- Status: naprawione (13.11, #499 scalony); wcześniej: w PR #499 (13.11, 9f46ff4: `sunSafe()` w `facade-style.ts`, budynki przepalone 543/705 → 0; przepalenie ujęć poniżej 3%); wcześniej: zgłoszone (13.11, naprawiacz G-734)
- Pakiet właściciela: packages/engine (barwy fasad, światło dnia)

### G-740 Ganger staje pod ścianą przyczółka mostu południowego Mełgiewskiej poza planerem pościgu (2 przypadki)
- Ważność: S3 · Zasięg: ta sama ściana co G-738 (do 1,5 m, rampa przyczółka w50733068); po G-738 6 z 225 przebiegów siatki wokół rampy nie dochodzi, także po 90 s
- Opis: (1) z (2410; 310) do (2449; 318): powrót na posterunek przez `straightWalk`, którego próbki co 0,5 m przeskakują ścianę, staje w (2415,6; 310,8); (2) z (2422; 310) do (2405; 318): ganger pod pomostem napiera na ścianę przyczółka, staje w (2416,5; 311,5)
- Status: naprawione (13.11, #495 scalony); wcześniej: w PR #495 (13.11, 8218817 + merge G-741: ściany między komórkami rastra z reguły `offTheBank`, `wallOnWay` w `walkable`/`startOf`/`straightWalk`; przypadki 4/4, siatka 225/225; raster w pagórkach 1,5–2× dłuższy; po #490); wcześniej: zgłoszone (13.11, naprawiacz G-738)
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: oba przypadki dochodzą (test w `bridge-edges-ai.test.ts`), siatka wokół rampy 225/225
- 13.11 (naprawiacz G-741): przy przyczółkach Mełgiewskiej 14 z 30 punktów nie dochodzi (osiłki na skarpach przy końcach pomostów, np. (2454,5; 293,7), (2449,5; 258,9), (2481,5; 415,7)); `followDetour` bez osiągalnej komórki w linii prostej kieruje do `way[1]`, nawet nieosiągalnej: źródło zakleszczeń w kieszeniach przy skarpach

### G-743 Fascja i spód pomostu: nieciągła grubość daje zęby i skośne trójkąty nad skarpą (T-166)
- Ważność: S4 · Zasięg: pomosty nad skarpą, gdzie prześwit pod pokładem przechodzi przez 2–2,8 m; przykład kładka podzamcze-2-0 po G-739, (1074; 161,8) i (1079; 161,8); błąd istniał (G-062), G-739 go odsłania
- Opis: `deckDepth` (`packages/sim/src/world/deck.ts`) skacze nieciągle: przy prześwicie ≤ 2 m 0,9 m, tuż powyżej 0,2 m, potem rośnie do 0,9 m przy ok. 2,8 m. Fascja (`planDeckEdges`, `packages/engine/src/renderer/mapcity/deck-plan.ts`) bierze grubość co ok. 1,9 m, a spód (`planDeckUnderside`) tylko w narożach pierścienia (wszędzie 0,9 m), więc płaski spód wystaje poniżej cienkich odcinków fascji
- Status: naprawione (13.11, #491 scalony); wcześniej: w PR #491 (13.11, 2192ee2: ciągła grubość `deckDepth`, fascja łamana w punktach siatki spodu; testy padają bez poprawki; zrzut spod kładki bez zębów); wcześniej: w naprawie (13.11, zgłoszone przez kuratora przy przeglądzie G-739)
- Pakiet właściciela: packages/engine (`deck-plan.ts`), packages/sim (`deckDepth`)
- Test przyjęcia: grubość fascji ciągła względem prześwitu; spód nigdy nie wystaje poniżej fascji (test na siatce pomostu); zrzut kładki z dołu bez trójkątów
- 13.11: test G-062 „headroom” sprawdzał spód tylko w wierzchołkach; wnętrza spodu nie sprawdza nic (luka testowa, do rozważenia przy ADR-0080)

### G-745 `pnpm osm:props` nie jest idempotentne: wynik zależy od poprzedniego `props.generated.ts`
- Ważność: S3 · Zasięg: generator rekwizytów czyta przez sim własny poprzedni wynik; punkt stały dopiero po drugim przebiegu (pierwszy dał `figure-in-crowd` 2 przy (−74; 160))
- Opis: niedeterministyczny proces budowy danych: ten sam wejściowy OSM daje różne tablice zależnie od stanu pliku wyjściowego; łamie powtarzalność i porównania przed/po
- Status: naprawione (13.11, #494 scalony); wcześniej: w PR #494 (13.11, 60035c4: `buildProps` podaje modułom sim tabelę z bieżącego przebiegu, kolejność jawna w jednym przebiegu; test bajt w bajt z pustym i bieżącym plikiem); wcześniej: zgłoszone (13.11, budowniczy etapu 2 ADR-0078)
- Pakiet właściciela: tools/osm-import (props), packages/sim (odczyt rekwizytów)
- Test przyjęcia: dwa kolejne `osm:props` z tego samego wejścia i z pustego/innego `props.generated.ts` dają ten sam plik bajt w bajt (test w osm-import)
- 13.11: do sprawdzenia, czy `barrier-report.ts` i `tools/orto/src/game.ts` (też ładują sim z zatwierdzonymi tabelami) zapisują coś do repo

### G-741 AI nie widzi boków pomostów jako ścian poza okolicą schodów
- Ważność: S3 · Zasięg: wszystkie pomosty nad niższym terenem; `nav-raster.ts` (`ledgesOf`) zamyka krawędzie pomostów tylko przy biegach schodów, więc planer nie obchodzi pomostu przez koniec i ganger staje pod bokiem pomostu
- Opis: po G-739 (kładka podzamcze-2-0 na poziomie ulicy) osiłek w `bridge-edges-ai.test.ts` („gets from beside the footbridge of podzamcze-2-0 onto its middle”) idzie prosto i staje pod północnym bokiem, 0,77 m niżej, 4,5 m od gracza; na main test przechodzi tylko dzięki przechyleniu pomostu z G-739
- Status: naprawione (13.11, #490 scalony); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g741 (13.11, 56f597f: krawędzie pomostów w każdym oknie z pomostem, `passable` nie wchodzi na krawędź, `startOf` przy krawędzi; test podzamcze-2-0 zaostrzony do 0,3 m; 30 punktów przy bokach pomostów: 11 → 16; w PR); wcześniej: w naprawie (13.11, zgłoszone przez naprawiacza G-739); blokuje scalenie G-739
- Pakiet właściciela: packages/sim/src/systems/ai (`nav-raster.ts`)
- Test przyjęcia: `bridge-edges-ai` przechodzi na gałęzi G-739; nowy test na main z boku innego pomostu nad niższym terenem

### G-734 `sidewalk` za ciemny wobec trawy (1,31 zamiast 1,46–1,58)
- Status: naprawione (13.11, #488 scalony); wcześniej: w PR #488 (13.11, cffd922: `sidewalk` z mediany ortofoto, #858277, chodnik/trawa w planie 1,31 → 1,56; kontrola `paving-albedo-drift` odłożona: mediany wymagają danych ortofoto spoza repo); wcześniej: zgłoszone (12.11, kurator, przegląd G-721)
- Ważność: S4 · Zasięg: wszystkie chodniki miasta (#6a6d73); ortofoto: chodnik do trawy 1,46–1,58; poprawka: 0,9 × square (ok. #868378) tą samą regułą co G-721; kontrola `paving-albedo-drift` (plan/trawa wobec mediany ortofoto > 0,25)
- Pakiet właściciela: packages/engine (`ground-plan.ts`)

### G-737 Chodnik mostu Mełgiewskiej przy Andersa 0,14–0,16 m pod jezdnią (T-283)
- Ważność: S4 · Zasięg: most w50733068, chodnik w230881193 przy Andersa, (2420-2426; 323), zachodni koniec; chodnik −25,86…−25,88, jezdnia −25,72
- Opis: pomost chodnika leży na NMT końca swojej osi, a jezdni na swojej; w poprzek mostu powstaje uskok 0,14–0,16 m poniżej progu `deck-step-face` (0,3). W Lublinie chodnik za krawężnikiem jest w poziomie jezdni.
- Status: naprawione (13.11, #485 scalony); wcześniej: naprawione na gałęzi ccr-ec2c4269-ilh8k8-g737 (13.11, db84383: chodnik i wypełnienia w obrysie mostu biorą oś pomostu jezdni; `deck-kerb-step` 1201 → 0, `ground-over-deck` 397 → 233; przegląd kuratora ZGODNE Z UWAGAMI 13.11; w PR #485, #484 scalony, CI po aktualizacji do main); wcześniej: zgłoszone (13.11, naprawiacz G-736, potwierdzone przez kuratora); propozycja kontroli skanu: różnica chodnik–jezdnia w jednym przekroju mostu > 0,05 m
- Pakiet właściciela: tools/osm-import (`bridge-ends.ts`, wysokości pomostów)

### G-738 Ganger utyka przy narożniku rampy przyczółka mostu południowego Mełgiewskiej (2415; 311)
- Ważność: S3 (pościg staje na stałe) · Zasięg: NW narożnik rampy przyczółka jezdni mostu w50733068, na dnie ściany 1,5 m; na main przy starcie pościgu z (2411,9; 296,0) albo (2414,2; 307,4)
- Opis: plan pościgu prowadzi gangera przez narożnik rampy, gdzie utyka pod ścianą. Po G-737 (chodnik mostu w poziomie jezdni) trasa przez to miejsce staje się wybierana też w `bridge-edges-ai.test.ts` („gets from the lower bridge of Mełgiewska down to the street south of it”), więc test pada; pułapka istnieje na main niezależnie od G-737.
- Status: naprawione (13.11, #484 scalony); wcześniej: w PR #484 (13.11, 3da8ee0: `walkable` sprawdza pominięty odcinek `NEAR_SKIP` regułą ruchu `offTheBank`; siatka 25 startów × 3 cele × 3 ziarna: 192/225 → 219/225; reszta w G-740); wcześniej: zgłoszone (13.11, naprawiacz G-737); blokuje scalenie G-737 (#485)
- Pakiet właściciela: packages/sim/src/systems/ai (nawigacja), ewentualnie dane rampy w content/lublin

### G-708 Trzy budynki przy Grodzkiej i Rybnej o 9–12 m wyższe niż w NMPT; oficyna bez OSM (T-269)
- Status: naprawione (13.11, #481 scalony); wcześniej: w PR #481 (13.11, 3644e06: runda 2, `height-vs-nmpt` na 55 budynków komórki z bazą 0, taras w232362965 −8,4, teren nad dachem 51 → 0, atrybucja NMPT); naprawione na gałęzi ccr-ec2c4269-ilh8k8-g708 (12.11, 990a49b; przegląd kuratora ZGODNE Z UWAGAMI; oficyna (682..691; 72..80) skreślona, to studnia doświetlająca); wcześniej: zgłoszone (12.11, kurator, przegląd stare-miasto-1-1)
- Ważność: S3 (sylwetka skarpy nad Podwalem w widoku od Zamku; płyta 16 m zamiast niskiej zabudowy na Rybnej) · Zasięg: stare-miasto-1-1. Środek dachu gry minus mediana NMPT GUGiK 0,5 m w obrysie: Rybna 13 w66293276 (613,5; 95,6) +11,6 m (gra 16,1 m z LoD1 na całym obrysie 528 m²; NMPT: 25% przy ziemi, 68% na 2–8 m, 7% ≥ 8 m); w232362965 (708,1; 100,7) +10,0 m (16,7 m z wartości domyślnej, cokół 7,1; NMPT: dach na poziomie podwórzy Grodzkiej, y −8,9); w364575978 (703,4; 89,6) +8,6 m (14,6 m: cokół 5 i 3 kondygnacje z tagu; NMPT p90 y −4,3). Obu ostatnich nie ma w LoD1 2024 ani w LoD2. Pozostałe 52 budynki komórki: mediana +0,24 m, p90 +1,0. Do tego oficyna (682..691; 72..80), 52 m², która jest w LoD2 (okap 11,9) i w NMPT, a w OSM jej nie ma. Nakładki `topo-sm11-img/panas.png` i `rybna13.png`
- Pakiet właściciela: tools/osm-import (korekty wysokości z NMPT, jak `CHURCH_SURFACE`; Rybna 13: podział obrysu albo wysokość części; w232362965 i w364575978: wierzch na poziomie podwórzy, bez kondygnacji nad nim; oficyna: korekta obrysu z LoD2)
- Test przyjęcia: proponowana kontrola `height-vs-nmpt` w stare-miasto-1-1 3 → 0; `bare-enclosed-yard` bez składowej (701..711; 101..114)

### G-721 Plac Litewski ciemniejszy i bardziej szary niż w Lublinie: barwa kostki i bruku, kontrast z trawą (T-281)
- Status: naprawione (13.11, #479 scalony); wcześniej: w PR #479 (13.11, d955833: decyzja użytkownika 13.11, niecka fontanny zostaje ciemną wodą; kostka 1,70 × trawa); naprawione na gałęzi ccr-ec2c4269-ilh8k8-g721 (12.11, eeabcf7: barwy nawierzchni z mediany ortofoto, kostka/trawa 1,28 → 1,90, dno fontann jasne; przegląd kuratora ZGODNE Z UWAGAMI; runda 2: square 1,75 × trawa, cobble 0,87, footway 0,92, dno 0,90 × square); zgłoszone (12.11, kurator, przegląd paczki; decyzja użytkownika 12.11 w `docs/decyzje.md`)
- Ważność: S4 (proponowana; plac główny, więc zasięg szeroki) · Zasięg: szeroki (każdy plac i deptak z `square`, `footway`, `cobble`) · Koszt: mały–średni
- Gdzie: Plac Litewski r7690183 (−105…121; −87…92), także deptak Krakowskiego Przedmieścia
- Dowód: ortofoto 2025-04 i 2024-06, średnie RGB próbek na placu według klasy ortofoto i nawierzchni gry. Kostka do trawy: gra 1,34, ortofoto 1,9 i 2,1. Bruk gry ok. 15% ciemniejszy od kostki, na ortofoto ten sam odcień. Zrzuty `plac-litewski/pl-oczy-krakowskie.png`, `pl-z-gory.png`.
- Przyczyna (przypuszczalna): stałe `SURFACE_COLOR` w `ground-plan.ts` dobrane do nocnej palety, wspólne dla całego miasta i bez związku z materiałem z OSM (`surface=paving_stones`, `sett`, `granite`).
- Propozycja (ADR-0077, reguła z danych, bez ręcznych obszarów):
  - Odcień nawierzchni dla pieszych bierze się z tagu `surface`/`material`.
  - Jasność skalibrować na ortofoto: mediana koloru klasy „jasna” pod `square`/`footway` w rastrach pokrycia miasta, a `tools/orto` podaje ją w raporcie.
  - Stosunek jasności kostki do trawy podnieść do ok. 1,8–2,0.
  - `cobble` w tym samym odcieniu co `square`, wyróżniony fakturą, nie ciemniejszym kolorem.
  - Neony i noc bez zmian (warstwa 2077 leży na tym).
- Pakiet właściciela: packages/engine (renderer: mapcity, NPR), tools/orto (mediana barwy)
- Test przyjęcia:
  - test planu: `SURFACE_COLOR.square` do `grass` ma jasność ≥ 1,8, `cobble` w zakresie ±5% jasności `square`;
  - migawka NPR odświeżona i obejrzana;
  - zrzut 12:00 z `pl-oczy-krakowskie` obejrzany przez kuratora.

### G-686 Uskok 0,52 m na zakręcie schodów z wiaduktu Zamkowej blokuje gangera
- Status: naprawione (13.11, #476 scalony); wcześniej: w PR #476 (12.11, 11e9a8d: rampa terenu pod górnym biegiem, `steps-riser-tall` 1 → 0, ganger przechodzi; przegląd kuratora ZGODNE Z UWAGAMI, blokuje łata terenu nad pomostem w (730,25..732,25; 151,75..154,5), 49 próbek do 0,033 m; runda 2: 253613f, `Ramp.ceiling` i `underDeck`: teren 0,05 m pod pomostem przy krawędzi, niżej w głąb; łata znika, test na pomostach gry 49 → 0, uskok wzdłuż biegu 0,098 m; nowa kontrola `ground-over-deck`, baza 860 (G-736); odstępstwo celowe T-282); wcześniej: zgłoszone (12.11, naprawiacz G-643; także na main)
- Ważność: S3 · Zasięg: (732,7; 151,4)–(734,2; 152,8), górny stopień schodów w294098693 na styku z południowym końcem pomostu wiaduktu Zamkowej (T-166). Wysokość chodzenia skacze tam o 0,51–0,54 m na całej szerokości pasa, a skan liczy to jako `steps-riser-tall` (732; 151) 0,51 m. Na schodach w56965515 (dawne (729,5; 163,9), czyli x zakrętu i z krawędzi pomostu) na osi biegów nie ma uskoku powyżej 0,3 m. Przyczyna ta sama co G-339 (pomost poziomy w poprzek na NMT końca osi). Poprawka G-339 w tym punkcie powinna usunąć oba objawy, test G-686 (nawigacja) zostaje osobno; uskok niewidoczny dla `straightWalk` i pól nawigacji; ganger stoi tam wciśnięty na zawsze, na main przechodzi tylko, gdy jest akurat w powietrzu
- Pakiet właściciela: packages/sim (systems/ai, nawigacja), ewentualnie treść schodów

### G-215 Proceduralne wieże na kościołach, które ich nie mają albo mają inne
- Status: naprawione (13.11, #478 scalony); wcześniej: w PR #478 (12.11, 944714c); naprawione na gałęzi ccr-ec2c4269-ilh8k8-g215 (12.11, 1dc2bc5: wieże tylko z tabeli danych; `church-fake-tower` 4 → 0, `church-tower-off-nmpt` 6 → 1 = G-214; przegląd kuratora ZGODNE Z UWAGAMI; runda 2: gzyms Św. Ducha 18,1 z NMPT, kształt hełmu z tabeli, kontrola gzymsu); wcześniej: zgłoszone (2.11, kurator, przegląd #190)
- Ważność: S3 (proponowana) · Zasięg: szeroki (7 kościołów, m.in. deptak: Kapucyni i Świętego Ducha) · Koszt: średni; 12.11 (przejście stare-miasto-1-1): św. Wojciecha w61102109 dalej ma wieżę z iglicą (zrzut `sm11-b`). T-121 trzeba przenieść do `otwarte` w stare-miasto-1-1, krakowskie-0-1, krakowskie-1-0 i stare-miasto-0-0.
- Priorytet (kurator, przegląd #208): wyżej. Wieże skalują się ze ścianami, więc po G-216 Niecała 4 w232674421 ma wieżę do y ok. 13 na budynku ok. 3,7 m (ponad trzy razy wyżej niż budynek bez wieży), a Świętego Ducha dwie wieże do y 28,5 przy kalenicy 20,4. Najtańszy pierwszy krok: kościoły bez wieży w rzeczywistości (Niecała 4, Kapucyni, św. Piotra, św. Wojciecha) na liście bez wieży, z odsyłaczem T-121
- Gdzie: T-121: Kapucyni w67508932, Karmelici r5420467 (poprawione w #198: wieże poza obrysem zdjęte), św. Piotra w66335226, św. Wojciecha w61102109, Niecała 4 w232674421, Świętego Ducha w66264126 (2 wieże zamiast 1 smukłej na narożu SW do y 26,5), cerkiew Przemienienia w66264148 (wieża 13 m za wysoka)
- Dowód: sonda `topo-g210-probe` (towerSpots w świecie) i NMPT GUGiK 0,5 m, wartości w T-121
- Przyczyna: `roof-plan` `addTowers` stawia wieże każdemu kościołowi bez części; zachód obrysu i szerokość > 22 m decydują o liczbie i miejscu, wysokość 1,7 × ściany do 65 m
- Poprawka: wieża proceduralna tylko dla kościołów z tabeli wież (dane: położenie, rzut, wysokość z NMPT albo `building:part` w korektach importu); pozostałe bez wieży (rozszerzyć `TOWERLESS_OSM` do odwrotnej listy); co najmniej: środek wieży w obrysie
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import, tools/glitch-scan
- Test przyjęcia: kontrole `church-fake-tower` i `church-tower-off-building` (niżej) spadają do 0

### G-735 Narożne słupki pawilonów metra migoczą z szybami (z-fighting)
- Ważność: S3 (widoczne z bliska przy każdym wejściu metra, na telefonie); zgłoszenie gracza 12.11 z dwoma nagraniami (Plac Litewski)
- Opis: pierwszy i ostatni słupek ramy ścian bocznych kończył się w płaszczyźnie końców szyb (przy wejściu i z tyłu), więc pas 0,6 m na całą wysokość przeszklenia migotał między szkłem a stalą.
- Status: naprawione (13.11, #477 scalony); wcześniej: w PR #477 (12.11, a027aaa: słupki 1 cm przed szkłem; test płaszczyzn w `pavilion-bake.test.ts` pada na main dla 5 wejść; zrzuty przed/po obejrzane)

### G-720 `corrections.test.ts` trwa w CI ok. 27 s jako plik
- Status: naprawiony w #475 (12.11, 1244783: plik 10,1 → 2,6 s pod pokryciem)
- Ważność: S4 · Zasięg: następny kandydat do limitu czasu w shardzie testów jednostkowych; przy G-719 pamięć wygenerowanego miasta (ADR-0046) w CI nie trafia: CI nie zachowuje `node_modules/.cache`, a klucz obejmuje całe `packages/{core,sim,engine}/src`; `generatedCity()` woła `generate` bez lod1/lod2, więc test liczy inne miasto niż tabele. Do decyzji: węższy klucz i `actions/cache` w CI
- Pakiet właściciela: tools/osm-import (testy), .github (cache)

### G-719 Test `venues` „sign nearly all of the city's venues” przekracza 20 s w CI
- Status: naprawiony w #474 (12.11, fc15a6b: venues 14,5 → 6,9 s na shardzie 2/2, tabele bez zmian)
- Ważność: S3 (czerwone CI na PR-ach, które nie dotykają importu) · Zasięg: shard „Unit tests (2)”: #463 (engine) i #468 (geometria 2D) padły na tym samym teście, `Test timed out in 20000ms`, `tools/osm-import/test/venues.test.ts:218`, `generatedCity()` bez pamięci miasta; main zielony, więc test jest blisko limitu. Krok 1.1 ADR-0077 dokłada +13,5% do tego testu. Podniesienie limitu nie jest poprawką: najpierw pomiar, gdzie idzie czas (import tabel, `generate()`, kolejność plików w projekcie `shared`)
- Pakiet właściciela: tools/osm-import (test), konfiguracja vitest w root

### G-082 Domyślna szerokość jezdni wycina zmapowane chodniki
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: częściowo naprawione (#98: 262 → 131 m); zostaje otwarte do 0 (Zielona, Podwale przy 4,5 m, Łęczyńska przy skrzyżowaniu); przesunięcie jezdni od chodnika jednostronnego: G-113
- Gdzie: Podwale w40052391/w305027452, Staszica w1150131461, w232805965, Zielona w173533827, Łęczyńska w85717509
- Przyczyna: `roadWidth` bez `width`/`lanes` = 6,5/5 m, a `cutSidewalk` usuwa chodnik, którego środek leży na cudzej jezdni
- Propozycja: zwęzić domyślną jezdnię do 2 × (odległość osi od chodnika − pół chodnika), min. 3 m
- Pakiet: tools/osm-import · Test przyjęcia: `sidewalk-under-carriageway` 262 → 0
- Przegląd kuratora (921e44d): UWAGI, T-062/G-112 (zwężenie całej ulicy z próbek przy skrzyżowaniu) i T-063/G-113 (dwukierunkowe poniżej 4,5 m, zwężenie symetryczne); Podwale w305027452 ma 4,3 m, nie 3 m
- Przejście krakowskie-1-0 (12.11): `footway-on-carriageway` 121 na w288178957 (`highway=footway` bez `footway=sidewalk`; Peowiaków 79, Kościuszki 35, Plac Czechowicza 7), niewidoczne, bo chodnik leży nad jezdnią; poprawka przy G-471
- (przejście krakowskie-2-0, 12.11): `sidewalk-under-carriageway` nowe miejsce Dolna Panny Marii w796560163 nad chodnikiem w690581646 (327; -230..-238), 9 próbek; Zielona w173533827 51 próbek (T-046); `footway-on-carriageway` w67508850 na Zielonej (276..285; -23..-29), 31 próbek.
- krakowskie-2-1 (12.11): `sidewalk-under-carriageway` 15 próbek: Zielona w1054482101 pod w173533827 (262..273; -16..-9) 14, w232805935 pod w770589493 (262; 80) 1; `footway-on-carriageway` w67508850 na Zielonej (243..266; -16..-1) 29 próbek (T-046); ciąg dalszy wpisu z krakowskie-2-0.
- podzamcze-0-0 (12.11): `footway-on-carriageway` 188 próbek w 30 kwadratach: w232362926 na bezpasowej w169832249 (652..693; 176..294) 142, w232362941 na w169832249 (639..690; 180..305) 26, w232362922 na Lubartowskiej w263054588 (576..580; 331..342) 13, w173566578 na Kowalskiej w438384687 (668..673; 163..165) 7; ta sama klasa (niepotwierdzone, że ta sama przyczyna dla w169832249).
- nabrzeze-1-0 (12.11): `sidewalk-under-carriageway` 4 kwadraty (16 próbek): chodnik w1159135272 pod w85717509 Łęczyńska (2659; 93) 15 próbek i pod w152220692 (2663; 98) 1; `footway-on-carriageway` ten sam chodnik (2655; 89) 2 próbki.
- nabrzeze-1-1 (12.11): `footway-on-carriageway` 4 kwadraty (23 próbki), Turystyczna w300709307 na w210273910 (2632; 351).
- 12.11 (kurator, przegląd paczki): przyczyna dla w169832249 potwierdzona. Droga `residential`, `oneway=yes`, bez `width`, ma w grze domyślne 6,5 m (±3,2 m), a chodniki w232362926 i w232362941 leżą 2,0–3,6 m i 2,3–5,8 m od osi. Według propozycji G-082 jezdnia ok. 3 m (minimum). T-047 (brak pasa) osobno.

### G-112 Szerokość jezdni z chodnika przy skrzyżowaniu zwęża całą ulicę
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (z przeglądu kuratora G-082) (T-062)
- Ważność: S3 (proponowana; główna ulica Nabrzeża o połowę węższa na 380 m) · Zasięg: Łęczyńska w85717509, Montażowa w40052079, 566 m · Koszt: mały
- Dowód: sonda `topo-g082-probe2.ts`: próbki chodnika z osią na jezdni z typu to 8 z 196 (Łęczyńska) i 21 z 98 (Montażowa), w miejscach, gdzie chodnik skręca do przejścia; wzdłuż reszty oś chodnika 3,6–7,7 m od osi. Po 921e44d 4,1 i 3,6 m dwukierunkowej jezdni zamiast ok. 6–8 m
- Przyczyna: `sidewalkIndex.kerb` (`tools/osm-import/src/generate.ts`) bierze medianę tylko z próbek w zasięgu (`MIN_KERB_SAMPLES` = 5, bez odniesienia do długości ulicy), a `fitToKerb` ustawia jedną szerokość na całą drogę
- Propozycja: dopasowanie tylko wtedy, gdy próbki w zasięgu pokrywają co najmniej 1/3 (lepiej 1/2) próbek ulicy po tej stronie; w pozostałych wycinać chodnik lokalnie albo zwężać tylko odcinek (jak lokalna szerokość w G-090)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `kerb-fit-sparse` (droga z `width:carriageway` z dopasowania, gdzie próbki rozstrzygającej strony < 1/3 próbek ulicy) 2 → 0; `sidewalk-under-carriageway` może wzrosnąć najwyżej o metry przy tych skrzyżowaniach (do policzenia)

### G-113 Dwukierunkowa jezdnia zwężana symetrycznie od chodnika z jednej strony
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (z przeglądu kuratora G-082) (T-063); związane z G-092 (auta na chodniku)
- Ważność: S3 (proponowana; ulice węższe niż w Lublinie, auto 2 m na 1,8 m pół jezdni) · Zasięg: Podwale w40052391 3,6 m, Staszica w1150131461 4,4 m, w232805965 4,7 m (po G-111 także Łęczyńska i Montażowa, jeśli zostaną dopasowane) · Koszt: średni
- Dowód: chodnik zmapowany tylko po jednej stronie (n po stronach [0, 44], [29, 0], [0, 24]); po drugiej asfalt kończy się 1,8–2,4 m od osi, przed terenem posesji, placem budowy albo pasem 4,7 m do budynku (Staszica)
- Przyczyna: `fitToKerb` (`tools/osm-import/src/ground.ts`) daje 2 × kerb wokół osi OSM i to samo minimum 3 m dla dwukierunkowych i jednokierunkowych
- Propozycja: dla ulicy dwukierunkowej minimum 4,5–5 m; gdy ogranicza tylko jedna strona, przesunąć pas jezdni od chodnika (krawędź po wolnej stronie zostaje na szerokości z typu albo do przeszkody), zamiast zwężać ją symetrycznie
- Pakiet właściciela: tools/osm-import (+ packages/sim content/traffic, jeśli oś pasa przestaje być osią OSM)
- Test przyjęcia: kontrola `two-way-fit-narrow` (droga bez `oneway` z dopasowaną szerokością < 4,5 m) 4 → 0 (Podwale 3,6, Montażowa 3,6, Łęczyńska 4,1, Staszica 4,4) bez wzrostu `sidewalk-under-carriageway` i `car-lane-off-road`

### G-192 Uproszczona oś chodnika: auta kilka cm w zmapowanej szerokości
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (1.11, autor G-189)
- Ważność: S4 · Zasięg: `simplifyLine` 0,5 m w imporcie przesuwa oś chodnika do ok. 0,09 m; auta z main (np. taxi (922,53; 430,5) i dwa na Kalinowszczyźnie) wchodzą o kilka cm w szerokość chodnika z OSM; skan ma margines `AXIS_SLACK` 0,1 m
- Poprawka: dokładniejsza oś dla chodników przy pasach postojowych albo odstęp liczony od osi z OSM
- Pakiet właściciela: tools/osm-import, packages/sim

### G-451 Klin gołego terenu między chodnikiem a jezdnią Kościuszki (T-222)
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (7.11, kurator, przegląd G-440)
- Ważność: S4 · Zasięg: zachodni krawężnik x 9–17, z −142…−189, ok. 13 m²; poprawka: lokalnie domknąć jezdnię do krawędzi chodnika; kontrola `kerb-gap-bare` (baza 35 631 próbek 0,25 m); przejście krakowskie-1-0 (12.11): `kerb-gap-bare` 1508 próbek w komórce, m.in. Narutowicza w40051033 (199..217; −197..−188) 62 m² (szczelina 0,6 m), w215824205 (84..94; −269..−262) 37 m² i 33 mniejsze; Peowiaków należy do G-471; krakowskie-2-1 (12.11): `kerb-gap-bare` 71 kwadratów (3097 próbek 0,25 m, szczelina do 2,75 m, 898 próbek > 1 m); skupiska (360..400; 0..80), (400..440; 80..160), (240..280; 80..120).; stare-miasto-0-1 (12.11): `kerb-gap-bare` 26 kwadratów (543 próbki); skupiska (570,150) 75, (460,40) 74, (600,140) 67, (560,150) 65, (580,140) 46, (470,70) 41.; podzamcze-0-0 (12.11): `kerb-gap-bare` 46 kwadratów (629 próbek); skupiska (690; 160) 84, (550; 160) 62, (540; 160) 55, (520; 180) 33, (710; 180) 32, (710; 190) 30.; podzamcze-2-0 (12.11): `kerb-gap-bare` 27 kwadratów (819 próbek); skupiska (1020; 220) 297, (1020; 200) 269, (1020; 240) 130, (940; 340) 25 (pola 20 m, próbki).; podzamcze-2-1 (12.11): `kerb-gap-bare` 62 kwadraty (3811 próbek); skupiska (920; 380) 558, (920; 390) 505, (920; 370) 387, (920; 400) 378, (980; 470) 203, (950; 470) 187.; nabrzeze-0-0 (12.11): `kerb-gap-bare` 10 kwadratów (164 próbki); skupiska (2440,240) 67, (2450,120) 39, (2430,260) 20, (2460,120) 13, (2450,100) 9.; nabrzeze-0-1 (12.11): `kerb-gap-bare` 46 kwadratów (1150 próbek); skupiska (2310,460) 255, (2300,460) 241, (2410,320) 85, (2340,420) 68, (2370,450) 55.; nabrzeze-1-0 (12.11): `kerb-gap-bare` 51 kwadratów (ok. 737 próbek); skupiska (2670,240) 135, (2670,230) 106, (2630,240) 71, (2660,190) 38, (2670,190) 36.; nabrzeze-1-1 (12.11): `kerb-gap-bare` 18 kwadratów (112 próbek); skupiska (2690,430) 16, (2600,340) 14, (2610,340) 13, (2530,280) 12, (2600,330) 8.
- Pakiet właściciela: tools/osm-import (ground)

### G-471 Szczelina przy południowym krawężniku Peowiaków (T-228)
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (7.11, kurator, przegląd G-450)
- Ważność: S4 · Zasięg: x −44…57, 1134 próbki; ta sama klasa co G-451 (`kerb-gap-bare`); przejście krakowskie-1-0 (12.11): dalej na wschód do x 102, `kerb-gap-bare` 73 m² (68..102; −238..−216) i `kerb-strip-bare` 21 (88..109; −238..−222; 1,1–4,8 m). Przyczyna wspólna z `footway-on-carriageway` 79 na w288178957 (T-046): jezdnia +3,25/−4,25 m od osi OSM, a chodnik północny ma oś +3,23 m, chodnik południowy zaczyna się 4,75 m od osi. Prawdziwa jezdnia ma ok. 6,75 m, jej środek leży ok. 1,4 m na południe od osi. Poprawka: `fitToKerb` traktuje równoległy `highway=footway` w zasięgu jak `sidewalk`. Test: `kerb-strip-bare` −21, `footway-on-carriageway` −79; nabrzeze-0-1 (12.11): `kerb-strip-bare` Towarowa w157960322 (2303; 349) i (2304; 349), 2,4..2,5 m gołego pasa za krawężnikiem; ta sama klasa.; nabrzeze-1-0 (12.11): `kerb-strip-bare` Łęczyńska w85717509 (2648; 81), 1,3 m gołego pasa za krawężnikiem; ta sama klasa.; nabrzeze-1-1 (12.11): `kerb-strip-bare` Turystyczna 9 kwadratów (40 próbek): w27473447 (2699; 381) 24 i w210273910 (2647; 343) 16; ta sama klasa.
- Pakiet właściciela: tools/osm-import (ground)

### G-635 Trzy próbki `kerb-fill-wide-estimated` przy nowych skrawkach chodnika na Podzamczu
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, naprawiacz scalenia #409)
- Ważność: S4 · Zasięg: (879,5; 490,5) i (860,5; 497,5): wypełnienia krawężników z #409 łączą się z `PODZAMCZE_AREAS` z main (`DWORZEC_EAST_AREAS`) w dwa małe skrawki chodnika; licznik 3624 → 3627 po scaleniu; podzamcze-2-0 (12.11): `kerb-fill-wide-estimated` 1 próbka: wypełnienie 1,60 m przy (996,1; 292,4), 7,5 m od osi o szacowanej szerokości; inne miejsce niż wpis ((879,5; 490,5), (860,5; 497,5)), ta sama klasa.; podzamcze-2-1 (12.11): `kerb-fill-wide-estimated` 8 kwadratów (1736 próbek) przy skrzyżowaniu Podzamcze/Ruska (1000..1020; 450..470): wypełnienia 2,1..2,6 m, 7,0..7,4 m od osi ulicy o szacowanej szerokości (OSM bez `width`); skupiska (1000; 460) 385, (1000; 450) 382, (1010; 460) 304; ta sama klasa (niepotwierdzone, która droga).; nabrzeze-1-0 (12.11): `kerb-fill-wide-estimated` 6 kwadratów (32 próbki); skupiska (2630,250) 16, (2650,70) 4, (2650,90) 4, (2640,70) 3, (2640,250) 3.
- Pakiet właściciela: tools/osm-import

### G-671 Próg 0,5 m² w `chunkGround` gubi małe wycinki wypełnień krawężnikowych na granicach chunków
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, naprawiacz G-665)
- Ważność: S4 · Zasięg: `tools/osm-import/src/ground.ts` `chunkGround`: wycinki pasm `holed` (wypełnienia chodnika przy krawężniku) poniżej 0,5 m² w chunku są odrzucane; wariant zachowujący je dla wszystkich pasm `holed` dokłada 114 kawałków chodnika i obniża `kerb-gap-bare` o 195, ale podnosi `kerb-fill-wide-estimated` o 15 i daje 22 nowe próbki `kerb-gap-bare` (x≈747, z≈155–160 i (376; −11)), bo wypełnienia G-570 robią się ciągłe; do rozwiązania razem
- Pakiet właściciela: tools/osm-import

### G-674 Północny krawężnik Radziwiłłowskiej przy Placu Litewskim przed trawnikiem OSM
- Status: scalone w klasę G-728 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, kurator przeglądu #437; także na main)
- Ważność: S4 · Zasięg: w914787972 i w331453920, x −87…−40: goły pas 1–2,8 m między północną krawędzią asfaltu (z 119,1–119,7) a trawnikiem w1011367949; ortofoto 2025-04: asfalt do z ≈ 120,3–121,0, dalej trawa; BDOT10k: oś północnej jezdni 117,1 przy x −70, nawierzchnia 7 m; trawnik w OSM 0,3–1,5 m za daleko na północ; poprawka: krawędź jezdni po stronie bez chodnika dociągnąć do `landuse=grass`, gdy ten leży bliżej niż 3 m; kontrola `kerb-strip-bare` (181) spadnie; (krakowskie-2-0): `kerb-strip-bare` Dolna Panny Marii w796560163: 1,3 m (329; -193), 3,8 m (337; -186) gołego pasa za krawężnikiem; ta sama klasa.; krakowskie-2-1 (12.11): `kerb-strip-bare` Zielona w173533827: 1,7..1,8 m gołego pasa za krawężnikiem, 4 próbki (262..265; -11..-9); ta sama klasa (T-063).; podzamcze-0-0 (12.11): `kerb-strip-bare` 4 kwadraty (12 próbek): Lubartowska w263054588 (576..585; 353..359) 2,0..3,9 m, Kowalska w438384687 (711..717; 179..189) 1,2..4,2 m gołego pasa za krawężnikiem; ta sama klasa (T-063).
- Pakiet właściciela: tools/osm-import

### G-003 Zawrót na Alei Tysiąclecia zahacza o skraj chodnika przed targiem
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: przyjęte
- Uzupełnienie (łowca, 2026-10-30): ten sam zawrót biegnie 2,5 m od linii pieszych `targ-deck` pod wiaduktem (758,4, 350,8–353,8), 5 punktów; skan pomija linie scen. Test przyjęcia obejmuje też to.
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (758, 349), trasa `Aleja Tysiąclecia#80:1/0+…#81:1/1`
- Dowód: skan `car-lane-off-road` = 1.
- Pakiet: `packages/sim` (`traffic.ts`, `uTurn`)

### G-022 Pas aut kończy się przed krótkim łańcuchem tej samej jezdni, który nie dostaje pasa
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: przyjęte (po G-020 i G-021, te same pliki)
- Ważność: S3 · Zasięg: lokalny (6 miejsc, 8 ślepych końców) · Koszt: średni; podzamcze-0-0 (12.11): `lane-dead-end` Lubartowska#38:1 (581; 361), ten sam pas co (588; 379) we wpisie; niepotwierdzone, że ten sam koniec (19 m dalej).; podzamcze-2-0 (12.11): `lane-dead-end` Aleja Unii Lubelskiej#95:0 (1098; 266) i #95:1 (1095; 268) leżą 4–6 m od opisanego końca Aleja Unii Lubelskiej#96 (1099; 272); niepotwierdzone, że ten sam koniec (inny numer pasa). Dodatkowo Lubartowska#14:bt>Aleja Tysiąclecia#80:t (1041; 284), nieopisany; niepotwierdzone, że ten sam mechanizm.; podzamcze-2-1 (12.11): `lane-dead-end` Cerkiewna#90:b (930; 472) to ta sama pętla #90 co we wpisie (Cerkiewna#92 (912; 346) -> pętla #90); niepotwierdzone, że ten sam koniec (126 m dalej).; nabrzeze-0-0 (12.11): `lane-dead-end` Mełgiewska#114:t (2456; 245), nieopisany koniec przy końcu pomostu T-166; niepotwierdzone, że ten sam mechanizm.; nabrzeze-0-1 (12.11): `lane-dead-end` Kalinowszczyzna#131:f (2361; 431) to opisany koniec (2361, 430); nieopisane: Turystyczna#122:0 (2487; 303), Aleja Władysława Andersa#127:0 i #127:t (2399; 284); niepotwierdzone, że ten sam mechanizm.; nabrzeze-1-0 (12.11): `lane-dead-end` Mełgiewska#113:t (2539; 259) i Łęczyńska#120:f (2659; 95), nieopisane końce; niepotwierdzone, że ten sam mechanizm.
- Gdzie: Lubartowska#38:1 (588, 379): dwa pasy jednokierunkowe schodzą w jeden dwukierunkowej (po G-021); Cerkiewna#92 (912, 346) → pętla #90 (44,4 m); Aleja Unii Lubelskiej#96 (1099, 272) → Aleja Tysiąclecia#84 (21 m); Kalinowszczyzna#131 (2361, 430); Łęczyńska#121 (2659, 95); Kapucyńska#10 (150, −160); Kołłątaja#2 / Peowiaków#0 (−100, −169) → Zesłańców Sybiru#5 (35 m)
- Dowód: łowca: koniec łańcucha z pasami dotyka (≤ 8 m) łańcucha aut < 45 m z 0 pasami.
- Przyczyna (przypuszczalna): klucz łączenia w `roads.ts:71` zawiera `oneway`; `MIN_ROUTE` (`traffic.ts:83`) liczony dla łańcucha, nie dla ciągu łańcuchów.
- Pakiet właściciela: packages/sim (`content/lublin/roads.ts`, `content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-end-at-laneless-street` daje 0; dziś 8 (bez G-020, po G-021).

### G-024 Jednokierunkowe pasy kończą się przed ulicą dla dostaw (Lubartowska, Kowalska, Świętoduska)
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: przyjęte, decyzja użytkownika ponownie: skręty (opcja B) niemożliwe, w zasięgu 16 m brak ulicy dla aut (najbliższe pasy aut: Lubartowska#37 ok. 100 m, Kowalska#76 56 m, Świętoduska#20 48 m; spotykają je tylko ulice dla dostaw). Zostaje opcja A (dalej ulicą dla dostaw) albo pozostawienie
- Ważność: S3 · Zasięg: lokalny (6 końców) · Koszt: średni; stare-miasto-0-1 (12.11): `lane-dead-end` 2 trafienia to dokładnie opisane końce: Lubartowska#37 (460, 56) (pas z Wacława Bajkowskiego#36:0, trafienie (462; 56)) i Kowalska#76 (568, 160) (trafienie (567; 159)); bez nowych końców.; podzamcze-0-0 (12.11): `lane-dead-end` Kowalska#76:1 (568; 161) to dokładnie opisany koniec Kowalska#76 (568, 160); bez nowych końców tego wpisu. Cztery inne końce komórki: Lubartowska#38:1 (581; 361), Furmańska#77:1 (631; 242), Furmańska#77:0>Cyrulicza#79:1 (555; 277), Furmańska#78:0>Cyrulicza#79:0 (556; 280), niepotwierdzone, że ten sam mechanizm (pas kończy się przed ulicą dla dostaw).
- Gdzie: Lubartowska#37:0/1 (460, 56), Kowalska#76:0/1 (568, 160), Świętoduska#20:0/1 (350, −48)
- Dowód: naprawiacz G-023: oba pasy jadą w tę samą stronę, nie ma pasa powrotnego do zawrotki; zawrotka oznaczałaby jazdę pod prąd (regres G-105) albo czołowe zatory.
- Opcje: A) pasy jadą dalej przez następną ulicę dla dostaw (Kowalska#67 60 m do Furmańskiej#77; Zielona 172 m do Staszica#35; Lubartowska#68 112 m); B) skręty w boczne ulice (G-006).
- Pakiet właściciela: packages/sim (`content/traffic.ts`), ewentualnie `useOf` w `content/lublin`
- Test przyjęcia: `lane-dead-end` spada o 6.
- Decyzja użytkownika 12.11: zostaje jak jest (ruch aut odłożony od 31.10). Ta sama klasa (ślepy koniec pasa jednokierunkowego bez ulicy dla aut w zasięgu skrętu) obejmuje końce znalezione w przejściach komórek 12.11: Lubartowska#38:1 (581; 361), Furmańska#77:1 (631; 242), Furmańska#77:0>Cyrulicza#79:1 (555; 277), Furmańska#78:0>Cyrulicza#79:0 (556; 280) (podzamcze-0-0); Lubartowska#14>Aleja Tysiąclecia#80 (1041; 284) (podzamcze-2-0); Cerkiewna#90:b (930; 472), Podzamcze#107>Ruska#110 (1000; 461) (podzamcze-2-1); Mełgiewska#114:t (2456; 245) (nabrzeze-0-0); Turystyczna#122:0 (2487; 303), Andersa#127 (2399; 284) (nabrzeze-0-1). Bez osobnych zgłoszeń; mechanizm każdego nie był sprawdzany sondą.

### G-025 Istniejące zawrotki na Alei Tysiąclecia wychodzą poza nawierzchnię
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (do potwierdzenia)
- Ważność: S3 (proponowana) · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: Aleja Tysiąclecia #80/#81, zawrotki przy (757,8, 348,5) i (816, 340,6)
- Dowód: naprawiacz G-023: 4–6 próbek co 0,25 m bez żadnej nawierzchni (`surfacesAt` puste). Możliwe, że to znany 1 w `car-lane-off-road`.
- Pakiet właściciela: packages/sim (`content/traffic.ts`, `uTurn`)

### G-037 Pas Andersy kończy się na pasach Mełgiewskiej: auta czekają na siebie
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone; było „w naprawie razem z G-006”, ale G-006 scalono w #47 bez zamknięcia G-037 (1.11: do sprawdzenia, czy blokada nadal występuje; ruch aut odłożony decyzją użytkownika z 31.10)
- Ważność: S3 · Gdzie: ok. (2401, 282) · Dowód: kąt 31°, pojazdy obu tras biorą się nawzajem za „auto przed sobą”, resynchronizacja co ok. 40 m.

### G-074 Ślepe końce pasów po poszerzeniu Krakowskiego (Peowiaków, Kapucyńska, Dolna Panny Marii)
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone do osobnego etapu ADR-0055 (decyzja użytkownika 31.10: włączenia z pierwszeństwem w systemie ruchu; ogólna reguła łączenia ślepych pasów psuje limity czekania). G-052 wchodzi z bazą `lane-dead-end` 45
- Ważność: S3 (proponowana: auta znikają albo stają) · Zasięg: 3 skrzyżowania · Koszt: mały–średni; podzamcze-2-1 (12.11): `lane-dead-end` Podzamcze#107:1>Ruska#110:1 (1000; 461), skrzyżowanie bez skrętu; niepotwierdzone, że ten sam mechanizm.
- Gdzie: Peowiaków (−91, −167): skrzyżowanie trzech ulic, oba wyjazdy zajęte jazdą prosto, jednokierunkowa Peowiaków nie ma skrętu; Kapucyńska (159, −207) i Dolna Panny Marii (336, −185): skrzyżowania T w połowie pasa (znana klasa)
- Dowód: skan `lane-dead-end` na gałęzi G-052: 44 → 45 (dwa stare końce znikają, trzy nowe)
- Pakiet właściciela: packages/sim (traffic-junctions)
- Test przyjęcia: `lane-dead-end` na gałęzi G-052 nie wyższy niż 44

### G-083 Drogi dla aut bez nazwy i łącznice bez pasów ruchu
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (audyt dróg) (T-047) · Ważność: S3 · Zasięg: 7 dróg bez nazwy + 3 łącznice, ok. 550 m · Koszt: mały–średni
- Przyczyna: `labels.ts` `chunkStreets` wymaga `name`, `STREET_KINDS` nie ma `primary_link`/`secondary_link`/`tertiary_link`
- Uwaga: po dodaniu pasów sprawdzić `lane-dead-end`, `car-road-hole`, `turn-off-road`
- Pakiet: tools/osm-import (+ sim roads.ts klucz łączenia dla dróg bez nazwy) · Test przyjęcia: `car-way-without-lane` 10 → 0

### G-092 Ulice ok. 3–4 m z dwoma pasami: auto zachodzi na chodnik
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (z naprawy G-082 i G-090)
- Ważność: S3 (proponowana) · Zasięg: wąskie ulice dwukierunkowe (po G-082 m.in. Staszica miejscami, Łęczyńska#120) · Koszt: średni
- Dowód: po stronie pasa mniej niż 2,1 m asfaltu; przy dolnym progu `laneOffset` (1,2 m) pół auta (0,9 m) wychodzi poza jezdnię; test G-090 celowo pomija takie odcinki
- Przyczyna (przypuszczalna): `lanesOf` w `packages/sim/src/content/traffic.ts` zawsze daje dwa pasy ulicy dwukierunkowej, bez względu na szerokość
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: kontrola skanu „auto poza jezdnią” (pół szerokości auta od pasa poza `surfacesAt` jezdni) z bazą; ulica węższa niż 2 × 2,1 m dostaje jeden pas albo mijankę

### G-093 Dziura w nawierzchni jezdni Narutowicza
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone (samochody na później, decyzja użytkownika 31.10); zgłoszone (z naprawy G-090)
- Ważność: S4 (proponowana) · Zasięg: lokalny · Koszt: mały
- Gdzie: Narutowicza, ok. 62 m wzdłuż łańcucha, 1,75 m od osi: `surfacesAt` pusty
- Dowód: sonda G-090 (`scratchpad/g090-scan.sh`); pas zwęża się przed dziurą
- Pakiet właściciela: tools/osm-import (ground)
- Test przyjęcia: kontrola `car-road-hole` (albo nowa) wykrywa i spada do 0

### G-133 Pojazdy na stromych ulicach bez pochylenia: dolny koniec odstaje od bruku
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (1.11, naprawiacz G-130); odłożone razem z pracami nad autami
- Z G-190 (1.11): przy poprawce wcielić łatkę `docs/plany/g190-zatoki-przy-ulicach-dostaw.patch` (zatoki pasów postojowych wzdłuż wszystkich ulic, omijanie tras dostawczaków); sonda z łatką i progiem spadku 0,6 m: +6 aut Kowalska x 643..668, +2 Rybna w895572841; też w1517184173 (Ruska, północ, 46 m) pusty przez spadek 0,23–0,43 m; Kowalska x 643..655: chodnik 2,5 m zachodzi 0,25 m na pas
- Ważność: S4 · Zasięg: 8 pojazdów odstaje ponad 0,2 m, najgorzej dostawczak (544.7, 167.7) o 0,44 m; też Plac Zamkowy, (450, 40), (550, 165), (810, 481)
- Przyczyna: pojazdy stoją poziomo (`pitch: 0`), a po G-130 opierają się na najwyższym punkcie nawierzchni pod obrysem
- Poprawka wymaga pochylenia i przechyłu w kontrakcie `Transform`/`SceneryItem` oraz w `VehicleViews` (zmiana kontraktu, ADR); auta jadące mają też y z terenu w środku bez `SURFACE_LIFT`
- Pakiet właściciela: packages/core (kontrakt), packages/sim, packages/engine

### G-524 Złoty hash nie obejmuje ruchu aut
- Status: scalone w klasę G-723 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (8.11, weryfikator #399)
- Ważność: S4 · Zasięg: `determinism.test.ts` liczy hash z `snapshot` (zapis), a pojazdów w zapisie nie ma; test „the traffic leave the golden run as it was” celowo zakłada, że ruch hasha nie zmienia; zmiana tras miasta przeszłaby niezauważona; poprawka: złoty wzorzec przebiegu ruchu (pozycje i id aut po N krokach); przy okazji: `ramp-car-off-lane` sprawdza tylko wierzchołki trasy, nie odcinki
- Pakiet właściciela: packages/sim (testy), tools/glitch-scan

### G-146 `onPassageAxes` i skan przejazdów: słabe przy trasie równoległej do osi
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (1.11, weryfikator G-136); dziś żadna trasa tego nie wyzwala
- Ważność: S4
- Gdzie: `packages/sim/src/content/traffic.ts` `onPassageAxes` przesuwa tylko wierzchołki od 1 m przed wylotem do 1 m za drugim; trasa równoległa do osi, odsunięta o 1–3,5 m z gęstymi wierzchołkami, przeskakuje na oś tuż przed wylotem (narożniki dostawczaka 2,0–4,5 m od osi przy połowie przejazdu 1,7–1,8 m); bez wierzchołka pod sklepieniem nic nie przesuwa. `vehicle-outside-passage` liczy środek plus połowę szerokości, nie narożniki
- Poprawka: dociąć trasę do osi na całej długości przejazdu z płynnym wejściem (wstawić wierzchołki na wylotach); skan liczy narożniki prostokąta pojazdu
- Pakiet właściciela: packages/sim, tools/glitch-scan

### G-153 Skan `furniture-overlap` pomija słupki
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (1.11, weryfikator #124)
- Ważność: S4 · Zasięg: np. stojak (-137.1, -52.2) z bryłą na słupku (-137.9, -53.1)
- Poprawka: słupki w kontroli nakładania brył mebli; bryła stojaka dopasowana do rowerów (dziś hx 1,0 przy rowerach do 0,47 m)
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

### G-176 Skan aut przy krawężniku luźniejszy niż generator
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (1.11, weryfikator #143)
- Ważność: S4 (narzędzie) · Zasięg: `parked-car-multilane-kerb` zwalnia auto w każdym `amenity=parking`, także podziemnym i dachowym, a generator tylko w naziemnych; `parked-car-on-footway` liczy `pedestrian` i `cycleway`, których generator (`footWays`, `clearOfKeptWays`) nie pomija; po #143 `clearOfStops` nie zmienia tabeli (te same auta zdejmuje G-155), więc G-156 pilnuje tylko skan
- Poprawka: wyrównać zbiory dróg i parkingów między skanem a generatorem; test generatora dla przystanku niezależny od G-155
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

### G-223 Test skanu `market-piece-on-crowd-lane` przekracza 20 s przy load ponad 20
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (2.11, weryfikator G-212)
- Ważność: S4 (test, nie gra) · Zasięg: `tools/glitch-scan`, kontrola `market-piece-on-crowd-lane`; sama przy load 15 przechodzi
- Poprawka: pomiar i przyspieszenie (indeks przestrzenny jak w G-200), bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: tools/glitch-scan

### G-346 Kontrola `deck-slot` nie widzi pomostu powyżej zasięgu stopy
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (5.11, weryfikator PR #293)
- Ważność: S4 (skan) · Zasięg: `deck-slot` porównuje z `groundY`, a postać stoi na ziemi z `reach` = stopa + `STEP_HEIGHT`; upadek pod pomost przy stopniu wyższym niż `STEP_HEIGHT` daje 0; próg 15° w `bridge-fill.ts` (`SIDE_BY_SIDE`) bez testu
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

### G-370 Skan `metro-shaft-open` nie sprawdza ścian pawilonu powyżej ulicy (szkło nad cokołem)
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (6.11, weryfikator #309; luka sprzed etapu 4)
- Ważność: S4 (skan) · Zasięg: wszystkie wejścia metra · Koszt: mały
- Pakiet właściciela: tools/glitch-scan (`metro-entrances.ts`)

### G-657 Skan `walker-on-car-lane` sprawdza tylko wierzchołki tras
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, naprawiacz G-650)
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/glitch-scan.test.ts:606–608` bierze `l.points` zamiast próbek co metr, więc długi odcinek trasy blisko pasa ruchu może umknąć; poprawka: próbkowanie odcinków, nowa baza z przebiegu (wzrost to odsłonięte trafienia, nie regres)
- Pakiet właściciela: tools/glitch-scan

### G-691 Zapadka bazy skanu przepuszcza zawyżoną bazę po scaleniu z innej podstawy
- Status: scalone w klasę G-724 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, naprawiacz G-689)
- Ważność: S4 · Zasięg: `glitch-scan.test.ts` sprawdza tylko „znaleziono ≤ baza”; gałąź liczona na starszej podstawie wnosi bazę wyższą niż stan main po scaleniu (tak było z #453 po #447) i nikt tego nie widzi; poprawka: ostrzeżenie (albo czerwony test w CI na main) przy bazie wyższej niż wynik, przynajmniej dla kontroli-miar ADR-0078; jak z bramką czasu: ostrzeżenie w podsumowaniu CI
- Pakiet właściciela: tools/glitch-scan, .github

### G-222 Reguła wieży z OSM: krawędzie (bok wieży, maszty, wieże różnej wysokości)
- Status: scalone w klasę G-725 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (2.11, weryfikator G-212); dziś bez skutku w mieście
- Ważność: S4 · Zasięg: `tools/osm-import/src/building-towers.ts:59` mierzy od wierzchołków wieży do ścian kościoła (wieża bokiem bliżej niż 10 m zostanie pominięta); `isTowerTags` uznaje każde `tower:type` i `man_made=tower` (maszt albo wieża ciśnień obok kościoła zdjęłaby mu wieże); `towerTips` w skanie sprawdza tylko najwyższy poziom bryły (wieże różnej wysokości ominęłyby `church-tower-off-building`)
- Poprawka: odległość odcinek–odcinek; `tower:type` z listy (bell_tower, church) i bez `man_made=tower` z `tower:type=communication`/`water`; `towerTips` po wszystkich wieżach; testy dla każdego przypadku
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-225 Reguła drogi pod ziemią (G-197) zdejmuje też nawierzchnię nad tunelem i przejazdy bramne
- Status: scalone w klasę G-725 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (2.11, weryfikator G-197); dziś bez skutku dla drzwi
- Ważność: S4 · Zasięg: `tools/osm-import/src/props-doors.ts:234`: odcinek ulicy z chunków pokrywający się w rzucie z drogą pod ziemią przestaje być ulicą; Rynek nad Trasą Podziemną traci 2 odcinki (609,1; −50,9)→(617,9; −48,7), Teodora Gruella w298307007 (przejazd bramny `tunnel=yes`, `layer=-1`, por. G-076) 1 odcinek. Kamienica stojąca tylko od takiego odcinka straciłaby drzwi, a `door-faces-underground` tego nie wykryje. Testy nie łapią mutacji „tylko końce” i `ALONG=0.3`
- Poprawka: odróżniać drogę pod ziemią od nawierzchni po id/nazwie drogi (chunki niosą id OSM?), przejazdy bramne z tagiem `tunnel=yes` krótsze niż ok. 20 m pod budynkiem traktować jak `building_passage`; testy warunku środka i progu
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-704 Podwórza Starego Miasta przy Archikatedrze, Dominikanach, Farze i Podwalu to goła ziemia (T-266, T-268)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, kurator, przegląd stare-miasto-1-0)
- Ważność: S3 (jak G-527) · Zasięg: stare-miasto-1-0, 7 podwórzy, ok. 2500 m² gołego terenu, w tym 1960 m² twardej nawierzchni na ortofoto: (627..666; −107..−63) 768 m², (699..740; −240..−204) 737 m², (610..654; −132..−101) 431 m², (696..716; −121..−88) 351 m², (691..726; −53..−40) 94 m², (654..673; −159..−146) 123 m². Przyczyna jak G-513 i G-527: OSM nie ma obszarów nawierzchni podwórzy. `landuse-bare` ich nie liczy, bo nie leżą w `landuse`. Zrzut `sm10d-kuria-podworze`. Ortofoto do korekt: 2024-06 (2025-04 ma tu przechył 4–5 m); Przejście stare-miasto-1-1 (12.11, kurator): ta sama klasa w sąsiedniej komórce. 6 podwórzy, ok. 1690 m², twarde ok. 1530 m²: (628..681; −40..13) 1091 m², wnętrze kwartału Grodzka–Złota–Archidiakońska, przejazdem do z −49 w stare-miasto-1-0; (747..760; 107..126) 185 m², dziedziniec Domu na Podwalu w598840139 (OSM i NMPT otwarty, LoD2 wypełnia go dachem); (610..626; 65..79) 154 m²; (621..637; 84..97) 132 m²; (719..728; 125..135) 68 m²; (646..657; 116..125) 57 m². Test przyjęcia w stare-miasto-1-1: `bare-enclosed-yard` z otwarciem 1 m 7 → 0, przy czym siódma składowa (701..711; 101..114) to taras przy Zaułku Panasa i znika z G-708.
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077)
- Test przyjęcia: proponowana kontrola `bare-enclosed-yard` (niżej) w komórce 7 → 0, bez nawierzchni na rabatach i trawnikach podwórzy (zielone na 2024-06); Test przyjęcia”: „Kontrola `bare-enclosed-yard` w krakowskie-1-0 (12.11): 17 składowych, 6222 m². Dwie z nich nie są podwórzami: (60..151; −228..−166) 938 m² łączy wąskim pasem front i zaplecze Teatru, a (37..102; −113..−76) 465 m² to pas wzdłuż alejki. Przed liczeniem składowych potrzebny warunek szerokości: otwarcie maski o 1 m i składowa po otwarciu ≥ 50 m². Podwórza `landuse-bare` tej komórki (KP 23, zaplecze Teatru) naprawia G-705

### G-705 Goły teren przy gmachach i sklepach Krakowskiego (krakowskie-1-0): Pedet, Teatr Osterwy, Urszulanki, Narutowicza (T-267)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, kurator, przegląd krakowskie-1-0)
- Ważność: S3 (jak G-513, G-527) · Zasięg: krakowskie-1-0, `landuse-bare` 6144 próbki (1536 m²), z czego ok. 1300 m² do poprawy. Pedet w67508935 (108..142; −161..−98) 340 m²; Teatr w67508958: front (82..155; −229..−190) 218 m², zaplecze (81..154; −224..−183) 208 m²; w177528398 (188..215; −233..−203) 134 m²; Urszulanki r14476826 (157..225; −270..−248) 94 m²; podwórze KP 23 w67499325 (192..218; −40..−20) 144 m²; Narutowicza w40051033 (224..240; −190..−158) ok. 160 m², gdzie szczeliny 3,5–5 m leżą poza `KERB_REACH`. Ortofoto 2025-04 jest tu prawie pionowe (dachy na obrysach LoD2 co do ok. 1 m, przy KP 23 3 m): 76–98% twardej nawierzchni. Zrzuty `k10-b-teatr`, `k10-c-pedet`, `k10-f-narutowicza`. Poza zakresem: deptak przed KP 23 (95 m², T-045/G-081), dobudówka za Teatrem (G-472), pasy do 1 m przy kościele Urszulanek w obrysie LoD2; podzamcze-2-0 (12.11): przedpola 5 / 1263 m² (twarde 77%) w podzamcze-2-0, m.in. (1087..1120; 168..252) 436 m²; ta sama klasa, wpis zbiorczy G-713.
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2025-04, przy KP 23 2024-06)
- Test przyjęcia: `landuse-bare` w krakowskie-1-0 6144 → najwyżej 1000 (zostają deptak T-045 ok. 380 i próbki w obrysach LoD2 ok. 540). Bez nawierzchni na zieleni (ortofoto 2025-04). Baza miasta spada w tym samym commicie

### G-709 Goły teren w krakowskie-2-0: podwórza, przedpola Dolnej Panny Marii i deptaka, szczeliny przy jezdni i dwa budynki bez gry (T-270)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki krakowskie-2-0)
- Ważność: S3 (jak G-704, G-705, G-527) · Zasięg: krakowskie-2-0, goły teren 16083 m²: podwórza 14 / 4655 m² (twarde 80%), przedpola 15 / 7101 m² (twarde 88%), szczeliny przy jezdni > 3 m 11 / 1224 m² (twarde 93%), w obrysie LoD2 1 / 845 m² (twarde 92%); `landuse-bare` 160 kwadratów 10 m w komórce; położenia w T-270. Dwa budynki LoD2 i LoD1 2024 bez budynku gry: 26780F22-118A-DA8A-E053-CC2BA8C01EC0 (386..412; -217..-197), 26780F22-3E04-DA8A-E053-CC2BA8C01EC0 (407..426; -205..-184), 431 m² (klasa G-472); 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell krakowskie-2-0` (sekcje gołego terenu i budynków bez gry), skan `landuse-bare` 160 w komórce; ortofoto 2025-04, przechył (0; 0,75) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-704, G-705: OSM nie ma obszarów nawierzchni podwórzy i przedpoli; szczeliny > `KERB_REACH` poza zasięgiem wypełnień (T-247); dwa budynki LoD2 nie są w OSM
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2025-04, tam gdzie przechył większy 2024-06)
- Test przyjęcia: `landuse-bare` w krakowskie-2-0 160 -> najwyżej wartość z pozostawionym deptakiem T-045; goły teren w klasach podwórza i przedpola w raporcie komórki -> 0 (poza zielenią ortofoto); dwa budynki LoD2 w grze albo uzasadnione pominięcie. Baza skanu spada w tym samym commicie

### G-710 Goły teren w krakowskie-2-1: przedpola przy fasadach i szczeliny przy jezdni (T-271)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki krakowskie-2-1)
- Ważność: S3 (jak G-705, G-709, G-527) · Zasięg: krakowskie-2-1, goły teren 10063 m²: przedpola 13 / 5222 m² (twarde 70%), szczeliny przy jezdni > 3 m 2 / 2780 m² (twarde 66%), podwórza 1 / 85 m², w obrysie LoD2 1 / 169 m² (pawilon T-230, celowy), inne 2 / 143 m²; `landuse-bare` 14 kwadratów 10 m (693 próbki) w komórce; położenia w T-271; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell krakowskie-2-1` (sekcja gołego terenu), skan `landuse-bare` 14 kwadratów w komórce; ortofoto 2024-06, przechył (0,5; 0) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-704, G-705: OSM nie ma obszarów nawierzchni przedpoli; szczeliny > `KERB_REACH` poza zasięgiem wypełnień (T-247); największa szczelina (267..348; 53..125) leży w połowie pod dachami LoD2 z trzech budynków już rozebranych (niepotwierdzone, raport nie podaje ich położenia)
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2024-06)
- Test przyjęcia: `landuse-bare` w krakowskie-2-1 14 kwadratów -> najwyżej wartość z pozostawionymi pasami T-247; goły teren w klasie przedpola w raporcie komórki -> 0 (poza zielenią ortofoto, 39% zieleni przy (350..410; 113..153)). Baza skanu spada w tym samym commicie

### G-711 Goły teren w stare-miasto-0-1: podwórza i przedpola przy Rybnej, Lubartowskiej i Kowalskiej (T-272)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki stare-miasto-0-1)
- Ważność: S3 (jak G-704, G-705, G-527) · Zasięg: stare-miasto-0-1, goły teren 6600 m²: podwórza 7 / 4223 m² (twarde 100%), przedpola 4 / 1344 m² (twarde 100%), szczeliny, obrys LoD2 i inne 0; `landuse-bare` 2 kwadraty 10 m (10 próbek); położenia w T-272; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell stare-miasto-0-1` (sekcja gołego terenu), skan `landuse-bare` 2 kwadraty w komórce; ortofoto 2024-06, przechył (0; 0) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-704, G-705: OSM nie ma obszarów nawierzchni podwórzy i przedpoli; największe podwórze (495..557; 80..150) obejmuje ruinę w232362881 (385 m² w LoD2 i LoD1 2024, T-015), którą import pomija (`SKIP_BUILDING`)
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2024-06)
- Test przyjęcia: goły teren w klasach podwórza i przedpola w raporcie komórki 11 składowych / 5567 m² -> 0 (poza ruiną T-015 do decyzji z G-053); `landuse-bare` w stare-miasto-0-1 2 kwadraty -> 0. Baza skanu spada w tym samym commicie

### G-712 Goły teren w podzamcze-0-0: podwórza, przedpola i szczeliny przy Kowalskiej, Furmańskiej i Alei Tysiąclecia (T-273)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki podzamcze-0-0)
- Ważność: S3 (jak G-704, G-705, G-527) · Zasięg: podzamcze-0-0, goły teren 10945 m²: podwórza 10 / 5958 m² (twarde 89%), przedpola 10 / 1620 m² (twarde 79%), szczeliny przy jezdni > 3 m 2 / 809 m² (twarde 87%), inne 6 / 781 m², w obrysie LoD2 0; `landuse-bare` 72 kwadraty 10 m (7261 próbek) w komórce; położenia w T-273; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell podzamcze-0-0` (sekcja gołego terenu), skan `landuse-bare` 72 kwadraty w komórce; ortofoto 2025-04, przechył (0,25; 0) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-704, G-705: OSM nie ma obszarów nawierzchni podwórzy i przedpoli; szczeliny > `KERB_REACH` poza zasięgiem wypełnień (T-247)
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2025-04)
- Test przyjęcia: `landuse-bare` w podzamcze-0-0 72 kwadraty -> najwyżej wartość z pozostawionymi pasami T-247; goły teren w klasach podwórza i przedpola w raporcie komórki 20 składowych / 7578 m² -> 0 (poza zielenią ortofoto: 83% zieleni przy (645..672; 268..280), 14% przy (536..623; 172..261)). Baza skanu spada w tym samym commicie

### G-713 Goły teren w podzamcze-2-0: przedpola i szczeliny przy wschodnim Wzgórzu Zamkowym, Alei Tysiąclecia i VIVO (T-274)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki podzamcze-2-0)
- Ważność: S3 (jak G-705, G-712, G-527) · Zasięg: podzamcze-2-0, goły teren 7147 m²: przedpola 5 / 1263 m² (twarde 77%), szczeliny przy jezdni > 3 m 16 / 2941 m² (twarde 73%), inne 5 / 1166 m², podwórza 0, w obrysie LoD2 0; `landuse-bare` 62 kwadraty 10 m (7532 próbki) w komórce; położenia w T-274; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell podzamcze-2-0` (sekcja gołego terenu), skan `landuse-bare` 62 kwadraty w komórce; ortofoto 2025-04, przechył (0,25; 0) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-705, G-712: OSM nie ma obszarów nawierzchni przedpoli; szczeliny > `KERB_REACH` poza zasięgiem wypełnień (T-247); część pasa (920..975; 183..263) może być ciągiem G-699/T-265 z podzamcze-1-0 (niepotwierdzone)
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2025-04)
- Test przyjęcia: `landuse-bare` w podzamcze-2-0 62 kwadraty -> najwyżej wartość z pozostawionymi pasami T-247; goły teren w klasie przedpola w raporcie komórki 5 składowych / 1263 m² -> 0 (poza zielenią ortofoto). Baza skanu spada w tym samym commicie

### G-714 Goły teren w podzamcze-2-1: przedpola i szczeliny przy Ruskiej, Podzamczu i Cerkiewnej (T-275)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki podzamcze-2-1)
- Ważność: S3 (reguła przeglądu paczki 12.11: ok. 3 300 m² twardej nawierzchni; wcześniej S4) (S3 jak G-705 dopiero, gdy ortofoto potwierdzi nawierzchnię na przedpolach: twarde tylko 39%, zieleń ok. 70% przy dwóch największych; `landuse-bare` 5 kwadratów) · Zasięg: podzamcze-2-1, goły teren 9543 m²: przedpola 7 / 5009 m² (twarde 39%), szczeliny przy jezdni > 3 m 16 / 1624 m² (twarde 85%), inne 4 / 569 m², podwórza 0, w obrysie LoD2 0; `landuse-bare` 5 kwadratów 10 m (558 próbek, ok. 140 m²) w (1095..1108; 561..580); położenia w T-275; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell podzamcze-2-1` (sekcja gołego terenu), skan `landuse-bare` 5 kwadratów w komórce; ortofoto 2025-04, przechył (0,25; 0) m
- Przyczyna (przypuszczalna): jak G-513, G-527, G-704, G-705: OSM nie ma obszarów nawierzchni przedpoli; szczeliny > `KERB_REACH` poza zasięgiem wypełnień (T-247)
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; nalot 2025-04)
- Test przyjęcia: `landuse-bare` w podzamcze-2-1 5 kwadratów -> 0 poza pasami T-247; goły teren w klasie przedpola w raporcie komórki 7 składowych / 5009 m² -> 0 poza zielenią ortofoto (69..70% zieleni przy (920..1004; 515..580) i (920..1040; 470..537)). Baza skanu spada w tym samym commicie

### G-715 Goły teren w nabrzeze-0-0: szczeliny przy jezdni Mełgiewskiej i bulwaru (T-276)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki nabrzeze-0-0)
- Ważność: S4 (mała powierzchnia, jak G-451; reszta gołego terenu komórki to zieleń) · Zasięg: nabrzeze-0-0, szczeliny przy jezdni > 3 m 3 / 526 m² (twarde 77%); inne 4 / 2177 m² to zieleń ortofoto (92..100%) i nie wchodzi; podwórza, przedpola i obrys LoD2 0; `landuse-bare` 0; położenia w T-276; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell nabrzeze-0-0` (sekcja gołego terenu); skan `kerb-gap-bare` 10 kwadratów (164 próbki) w komórce; przechył nalotów niepewny (3 m² krawędzi LoD2)
- Przyczyna (przypuszczalna): szczeliny > `KERB_REACH` poza zasięgiem wypełnień krawężnikowych (T-247), nawierzchnia pieszych bez obszarów w OSM
- Pakiet właściciela: tools/osm-import (ground, `kerb-widen.ts`)
- Test przyjęcia: szczeliny > 3 m w raporcie komórki 3 składowe / 526 m² -> 0 (poza zielenią ortofoto); `kerb-gap-bare` w nabrzeze-0-0 10 kwadratów -> nie wyższy niż przy pasach T-247. Baza skanu spada w tym samym commicie

### G-716 Goły teren w nabrzeze-0-1: przedpole DPS "Kalina" i szczeliny przy jezdniach Andersa, Towarowej i Kalinowszczyzny (T-277)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki nabrzeze-0-1)
- Ważność: S4 (twarde tylko 23% przedpola i 48% szczelin, reszta zieleń; mniejsze niż G-705) · Zasięg: nabrzeze-0-1, goły teren 6567 m²: przedpola 2 / 1725 m² (twarde 23%), szczeliny przy jezdni > 3 m 8 / 749 m² (twarde 48%), inne 7 / 908 m², podwórza i obrys LoD2 0; `landuse-bare` 0; `kerb-gap-bare` 46 kwadratów (1150 próbek); położenia w T-277; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell nabrzeze-0-1` (sekcja gołego terenu); skan `kerb-gap-bare` 46 kwadratów i `kerb-strip-bare` 2 próbki (Towarowa) w komórce; przechył nalotów niepewny
- Przyczyna (przypuszczalna): jak G-705 i T-247: OSM nie ma obszarów nawierzchni przedpoli, szczeliny > `KERB_REACH` poza zasięgiem wypełnień; część składowych to prawdziwa zieleń (trawa), niepotwierdzone zrzutem
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; ground)
- Test przyjęcia: goły teren w klasie przedpola i szczelin w raporcie komórki 10 składowych / 2474 m² -> 0 (poza zielenią ortofoto); `kerb-strip-bare` w nabrzeze-0-1 2 próbki -> 0. Baza skanu spada w tym samym commicie

### G-717 Goły teren w nabrzeze-1-0: przedpola przy fasadach i szczeliny przy jezdniach Łęczyńskiej i Mełgiewskiej (T-278)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki nabrzeze-1-0)
- Ważność: S3 (jak G-705, G-709, G-527: trzy szczeliny z twardym 90..99%, razem 1027 m²; przedpola w większości zieleń, twarde 15%) · Zasięg: nabrzeze-1-0, goły teren 10164 m²: przedpola 9 / 5935 m² (twarde 15%), szczeliny przy jezdni > 3 m 10 / 1958 m² (twarde 65%), inne 2 / 263 m², podwórza i obrys LoD2 0; `landuse-bare` 54 kwadraty (7023 próbki); `kerb-gap-bare` 51 kwadratów; położenia w T-278; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell nabrzeze-1-0` (sekcja gołego terenu, klasy z nalotu 2024-06); skan `landuse-bare` 54 kwadraty, `kerb-gap-bare` 51 kwadratów (ok. 737 próbek) w komórce; obrysy zgodne z LoD2 (IoU 0,876), więc klasy ortofoto wiarygodne
- Przyczyna (przypuszczalna): jak G-705 i T-247: OSM nie ma obszarów nawierzchni przedpoli, szczeliny > `KERB_REACH` poza zasięgiem wypełnień; część składowych to prawdziwa zieleń (trawa), niepotwierdzone zrzutem
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; ground)
- Test przyjęcia: goły teren w klasie przedpola i szczelin w raporcie komórki 19 składowych / 7893 m² -> 0 (poza zielenią ortofoto); `landuse-bare` w nabrzeze-1-0 54 kwadraty -> nie wyższy niż przy pasach T-247. Baza skanu spada w tym samym commicie

### G-718 Goły teren w nabrzeze-1-1: przedpole przy fasadach i szczeliny przy jezdni Turystycznej (T-279)
- Status: scalone w klasę G-726 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: zgłoszone (12.11, opiekun mapy, raport komórki nabrzeze-1-1)
- Ważność: S3 (jak G-705: przedpole 3104 m² z twardym 44% i pięć szczelin z twardym 55..95%; część składowych to zieleń) · Zasięg: nabrzeze-1-1, goły teren 6779 m²: przedpole 1 / 3104 m² (twarde 44%), szczeliny przy jezdni > 3 m 6 / 1913 m² (twarde 60%), inne 1 / 113 m² (zieleń), podwórza i obrys LoD2 0; `landuse-bare` 48 kwadratów (5823 próbki); `kerb-gap-bare` 18 kwadratów; `kerb-strip-bare` 9 kwadratów (40 próbek, Turystyczna); położenia w T-279; 12.11 (kurator, przegląd paczki): reguła ważności dla wszystkich wpisów gołego terenu komórek jest jedna: S3, gdy twardej nawierzchni ortofoto (jasna + asfalt) w podwórzach, przedpolach i szczelinach jest co najmniej ok. 1000 m², poniżej S4. Do poprawy tylko część twarda; zieleń i próbki pod koronami zostają (ADR-0077 krok 1.1).
- Dowód: `node tools/orto/src/report.ts --cell nabrzeze-1-1` (sekcja gołego terenu, klasy z nalotu 2023-09); skan `landuse-bare` 48 kwadratów i `kerb-strip-bare` 9 kwadratów w komórce; przechył nalotów niepewny (2024-06 odstaje, 5 budynków LoD2)
- Przyczyna (przypuszczalna): jak G-705 i T-247: OSM nie ma obszarów nawierzchni przedpola, szczeliny > `KERB_REACH` poza zasięgiem wypełnień; część składowych to prawdziwa zieleń (trawa), niepotwierdzone zrzutem
- Pakiet właściciela: tools/osm-import (korekty, krok 1.1 ADR-0077; ground)
- Test przyjęcia: goły teren w klasie przedpola i szczelin w raporcie komórki 7 składowych / 5017 m² -> 0 (poza zielenią ortofoto); `kerb-strip-bare` w nabrzeze-1-1 9 kwadratów -> 0. Baza skanu spada w tym samym commicie

### G-096 Narożnik Starego Miasta za brzegiem z = −240 (Pałac Ordynacki, Kuria)
- Status: scalone w klasę G-727 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone: poszerzanie mapy, zawężone po G-556 #414 do uskoku x = 460 i brył za z = −240 (decyzja użytkownika 8.11, `docs/backlog.md`, sekcja „Poszerzanie mapy”; zgłoszone z przeglądu kuratora G-052)
- Ważność: S3 (proponowana) · Zasięg: lokalny, 7 budynków, 2 zabytki · Koszt: średni (prostokąt, ADR-0042, regeneracja)
- Gdzie: x od 460 do 760, z od −240 do −270; T-058
- Przyczyna: `stare-miasto` minZ = −240, a G-052 przesuwa Krakowskie do −270 (uskok gruntu na x = 460)
- Pakiet właściciela: tools/osm-import (decyzja o prostokątach: Architekt, ADR-0042)
- Test przyjęcia: w66335239 i w66293168 w `MAP_CHUNKS`, bez uskoku gruntu na x = 460; propozycja: `stare-miasto` minZ −270 z `zEdges` [−270, −40, 160] (rząd 230 m, identyfikatory chunków bez zmian); kontrola `historic-cut-by-edge` (budynek zabytkowy z obrysem w prostokącie dzielnicy i środkiem poza wszystkimi) 4 → 1 (Pałac Tarłów zostaje, T-057)

### G-680 Probostwo 11: przejazd bramowy bez tagu w OSM
- Status: scalone w klasę G-727 (12.11, porządki rejestru; pełny opis tutaj); wcześniej: odłożone: poszerzanie mapy (12.11, triage G-678; niepotwierdzone)
- Ważność: S4 · Zasięg: w444375185 × w252541795 (`service=driveway`, 12 m w budynku, bez `tunnel`), (468; 508), poza Podzamczem (x < 520); przy poszerzeniu mapy sprawdzić na ortofoto i ewentualnie korekta `tunnel=building_passage` w `corrections.ts`; tamże rozszerzenie `added-solid-over-way` na budynki z OSM (filtry: `layer<0`, dziury multipolygonu, `SKIP_BUILDING`/`belowGround`/`MIN_AREA`, poza chunkami; dziś po filtrach 0)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-510 Auta rampy P−1 jadą osią Bajkowskiego i Lubartowskiej, a auta ruchu przez nie przejeżdżają
- Status: naprawiony w #399 (8.11, 30c4950: auta rampy P−1 w ruchu symulacji, kontrola `ramp-car-off-lane`; porządki rejestru 12.11); wcześniej: zgłoszone (8.11, kurator przeglądu #382)
- Ważność: S4 · Zasięg: `parking-traffic.ts`: `IN_WAY`/`OUT_WAY` na osi jezdni (np. (407,5; −16,5)), a ruch symulacji ma na Bajkowskiego dwa pasy ±1,6 m; auto szerokości ok. 1,8 m zachodzi na oba, jedzie 2,5 m/s wobec 8 m/s ruchu, bez bryły (G-492); skręt w lewo powinien iść z lewego pasa (`turn:lanes=left|right`); pas wjazdu w `TRAFFIC_ROUTES` sim na osobny PR ze złotym hashem; kontrola `ramp-car-off-lane` (baza dziś 9 punktów)
- Pakiet właściciela: packages/engine (renderer), packages/sim (G-492)

### G-703 Schody przycięte brzegiem mapy: ostatnia podstopnica do y 0 za brzegiem (ściana do 23,7 m)
- Status: naprawiony w #463 (12.11, 89d635e; ściany 20–24 m → ≤ 0,12 m, `steps-riser-tall` 6 → 1, jedna funkcja brzegu `onMapEdge` dla renderera i skanu)
- Ważność: S3 (pionowa szara ściana 20 m, widoczna z ulicy i znad dachów) · Zasięg: 5 z 6 trafień `steps-riser-tall` w mieście. Stare Miasto: w481462067 (760; −210) 20,03 m i w888479969 (760; −148) 5,63 m. Podzamcze: (1090–1092; 160) 23,70 m (2 pasy). Nabrzeże: (2658; 60) 18,21 m. `groundY` poza chunkami zwraca 0 (`terrain.ts`), a `planSteps` dla pasa przyciętego do brzegu bierze wysokość tuż za brzegiem. Zrzuty `sm10d-schody-210`, `sm10d-kuria-podworze`
- Pakiet właściciela: packages/engine/src/renderer/mapcity (`steps-plan`), ewentualnie tools/osm-import (przycięcie pasa schodów odrobinę przed brzegiem) albo `groundY` za brzegiem z wysokością brzegu
- Test przyjęcia: `steps-riser-tall` 6 → 1 (zostaje G-686 przy (732; 151)); pas schodów przy x = 760 kończy się na wysokości terenu brzegu (−20,1 i −6,3)

### G-707 Pas schodów na szwie chunków może nie przebudować się po wczytaniu sąsiada
- Status: zamknięty (12.11): przy weryfikacji #463 `MapCells.touch` przebudowuje komórkę po wczytaniu sąsiada, siatka jak przy obu wczytanych od razu
- Ważność: S4 · Zasięg: przy strumieniowaniu `TerrainEntries.heightAt` zwraca null na wewnętrznym szwie, gdy sąsiedni chunk nie jest wczytany; komórka podłoża z pasem przy szwie może zostać zbudowana jak przy brzegu mapy i nie przebudować się po wczytaniu sąsiada; do sprawdzenia sondą strumieniowania
- Pakiet właściciela: packages/engine/src/renderer/mapcity

### G-694 Ganger czekający na plan objazdu stoi w miejscu
- Status: naprawiony w #461 (12.11, e4f7741; postój 204 → 5 kroków, weryfikacja przyjęta; reszta w G-701)
- Ważność: S3 · Zasięg: po #455 (G-643) ganger bez starej drogi czeka na swój plan w kolejce: przy N różnych celach do ok. 13·N kroków (3,4 s przy 18 pościgach, 5,3 s przy liderach rozrzuconych do 60 m; na main do 16 kroków); poprawka: w czasie czekania ruch w stronę celu (krok w bok przy przeszkodzie, jak przy odklejaniu), priorytet w kolejce dla gangera bez żadnej drogi; także `planChase` z `{ chase: made }` nie zeruje własnego `chaseNext`
- Pakiet właściciela: packages/sim (systems/ai)

### G-639 Płaska bryła na wysokości LoD1 przy stromym dachu wypada na kalenicy
- Status: naprawiony (PR #459, 8c653c0; ADR-0077 krok 4: 80 budynków z dachem z LoD2; kurator PRZYJĘTE w rundzie 2; dalej G-695, G-696, G-698)
- Ważność: S3 · Zasięg: budynki bez tagów dachu stoją płasko na wysokości LoD1, a przy stromym dachu LoD1 leży prawie na kalenicy; np. Pałac Parysów w66330695 w grze 18,1 m i 5 rzędów okien, w LoD2 okap 10,7 m i kalenica 18,2 m (przed zmianą 11,1 m); ok. 59 budynków (płaski dach w grze, dach LoD2 > 4 m, okap gry > 3 m nad okapem LoD2; liczba przybliżona, okap LoD2 bywa okapem przybudówki); poprawka: gdy LoD2 ma okap i kalenicę, a OSM nie ma tagów dachu, okap i dach z LoD2; kontrola `flat-over-lod2-roof` (baza ok. 59); luka pokrewna: `church-over-nmpt` nie wykrywa kościoła za niskiego
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-697 Goły teren przed wyjściem A metra „Plac Zamkowy”
- Status: odrzucone, duplikat G-365 (12.11, kurator, przegląd podzamcze-1-0): przed otworem pawilonu A jest rabata (T-158), nie nawierzchnia; nie brukować
- Ważność: S4 · Zasięg: (721,0–723,5; 289,8–292,6), ok. 6,8 m²; `metro-exit-bare` = 27 (cała baza miasta, wpisu G nie było); front pawilonu (x 720,2–723,8, z 282,4–289,6) poza pierścieniami nawierzchni, kostka kończy się na z 289,0; ortofoto 2025-04: jasna nawierzchnia; ręczny plac z G-332 obejmuje tylko wyjście B; test przyjęcia: `metro-exit-bare` 27 → 0
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)

### G-689 Bazy `ground-strip-overlap` i `ground-strip-gap` nieaktualne albo niedeterministyczne
- Status: naprawiony (PR #458, 56a13cb; kontrole deterministyczne, baza z #453 liczona sprzed #447)
- Ważność: S4 · Zasięg: `GLITCH_BASELINE=update` na main (389e0aa) daje `ground-strip-overlap` 93 727 → 93 726 i `ground-strip-gap` 4 105 → 4 100 bez zmiany nawierzchni; ustalić, czy zmieniły je scalenia po #453 (np. #454), czy kontrola zależy od kolejności; jeśli niedeterministyczna, ustalić przyczynę (zaokrąglenia rastra, kolejność kawałków)
- Pakiet właściciela: tools/glitch-scan

### G-643 Budowa rastra i pola okna `wide` w jednym kroku symulacji
- Status: naprawiony (PR #455, 503bff0; weryfikator PRZYJĘTE; czekanie na plan w tłumie: G-694; decyzja użytkownika 12.11: scalić, poprawić osobno)
- Ważność: S3 · Zasięg: nowy plan objazdu w oknie `wide` buduje pole ok. 15 ms, a przy zmianie komórki 32 m także raster ok. 37 ms w jednym kroku (budżet ADR-0043: 4 ms); przy jednym odciętym gangerze w pościgu za biegnącym graczem przestój 15–50 ms co 1,5–2 s; poprawka: budowa rozłożona na kilka kroków (ganger idzie starą drogą do gotowego planu)
- Pakiet właściciela: packages/sim (systems/ai)

### G-684 Fałszywy alarm `levels-tag-lost` na Bramie Krakowskiej
- Status: naprawiony (PR #456, 4c3b230)
- Ważność: S4 · Zasięg: r7224409 (473; −91): „2 storeys of building:levels=5”; obrys ma `height` 10 m i części `building:part` (wieża 5 kond., przedbramie 2 kond., T-007 rozwiązane); kontrola liczy obrys bez części; poprawka: wyjątek dla budynków z częściami, baza 4 → 3
- Pakiet właściciela: tools/glitch-scan

### G-685 Raport ortofoto liczy bariery z tabeli mebli zamiast z `chunk.barriers`
- Status: naprawiony (PR #457, 1af1024)
- Ważność: S4 (narzędzie, nie gra) · Zasięg: `tools/orto/src/barriers.ts` (`barrierReport`, `game` i `notDrawn`). W stare-miasto-0-0 raport podaje 9 linii „nierysowanych” (np. mur miejski w609951474), a wszystkie są w `stare-miasto.generated.ts` (`barriers`) i w grze (ADR-0077 p. 4). Komentarz modułu („the game draws none of them”) jest nieaktualny.
- Pakiet właściciela: tools/orto
- Test przyjęcia: raport dla stare-miasto-0-0 ma `notDrawn` 0 (bariery z `MAP_CHUNKS[].barriers`)

### G-677 Kontrola skanu: ręczna bryła nad drogą z OSM
- Status: naprawiony (PR #452, 2513ea4)
- Ważność: S4 · Zasięg: brak kontroli, która łapie ręczny obszar `ADDED_AREAS` z `building=*`, którego pierścień (także poza mapą) przecina `highway=*` bez `tunnel` ani `covered`; dziś 1 przypadek: `T-261/garaz-vivo` zamyka schody w376043570 i chodnik w295849313 (wejście do VIVO pod dachem garażu, x 1121–1146, poza mapą, ukryte przycięciem na x = 1120); kontrola `added-solid-over-way` z bazą 1 i wyjątkiem z odsyłaczem do topografii do czasu poszerzenia mapy
- Pakiet właściciela: tools/glitch-scan

### G-675 Przeskok oznakowania na styku zwężonych kawałków jezdni
- Status: naprawiony (PR #454, 389e0aa)
- Ważność: S4 · Zasięg: Radziwiłłowska przy x −66 (`fitLanes`, #437): linia środkowa skacze z 113,7 na 112,9, linia między pasami z 116,6 na 116,2; w rzeczywistości linia środkowa ciągła na z ≈ 114,0–114,5 (w grze 112,9–113,7, wcześniej na main 112,2–113,2); kontrola `marking-step` (skok > 0,3 m na wspólnym węźle kawałków jednej ulicy), baza ≥ 2
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-678 Budynki z OSM przykrywają drogi bez `covered` ani `tunnel`
- Status: odrzucone (12.11, triage łowcy: 16 z 857 to fałszywe alarmy sondy: 4 drogi `layer=-1` pod garażami, 4 dziedzińce i otwór bramy w multipolygonach, VIVO już prowadzone, 5 budynków bez bryły w grze albo poza mapą; żadna droga nie wchodzi w ścianę; skan `lane-in-building`, `passage-blocked`, `building-underground-solid` na 0)
- Ważność: S4 · Zasięg: sonda: 16 z 857 budynków OSM w mapie przykrywa linię `highway=*` bez `tunnel`/`covered`, głównie `service` przez przejazdy bramowe; garaż w173070505 przykrywa 11 dróg wejścia do VIVO (poza grą od G-600); w grze droga może wchodzić w ścianę zamiast przejazdu; do sprawdzenia, które to przejazdy (`tunnel=building_passage`) brakujące w OSM, i rozszerzenia kontroli `added-solid-over-way` na budynki z OSM
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-662 Trójkąt garażu VIVO nad ziemią bez bryły
- Status: naprawiony (PR #447, de64f3e; kurator PRZYJĘTE, 11 m z cienia, niepewność 10–11,4 m)
- Ważność: S3 · Zasięg: w173070505, x 1105,8–1120, z 228–239,7: na trzech nalotach ortofoto dach z sedum i świetlikami ok. 5–10 m nad chodnikiem (cień do z 244–251), w grze trawnik na poziomie gruntu; G-600 usunął całą bryłę garażu; poprawka: niska bryła o wysokości dachu w miejsce trawników T-258 i G-647
- Pakiet właściciela: tools/osm-import

### G-655 Jezdnia z tagiem `lanes` nie jest dociągana do osobno zmapowanego chodnika
- Status: naprawiony (PR #437, 59daf02)
- Ważność: S3 · Zasięg: `fitToKerb` (`tools/osm-import/src/ground.ts:123–126`, `|| Number(t.lanes) > 0) return t;`) pomija ulice z `lanes`; przy `sidewalk=separate` `roadWidth` = `lanes × 3,25`, np. Radziwiłłowska `lanes=3` (w331453920, w356402586, w914787972) 9,75 m, więc jezdnia i zewnętrzny pas ruchu zachodzą na chodnik (pas `footway` ma nawierzchnię „road” i „footway” naraz); po dociągnięciu oś pasa ok. 4 m od płotów w232805994 i w232805996, co odblokowuje G-650; zmiana całego miasta z regeneracją i przeglądem kuratora; zmierzyć czas `generate`
- Pakiet właściciela: tools/osm-import

### G-672 Klasyfikator pokrycia liczy korony drzew jako zieleń pod nimi
- Status: naprawiony (PR #446, bbb5a80)
- Ważność: S4 · Zasięg: `tools/orto` uśrednia nadmiar zieleni z trzech nalotów, więc dwa letnie (2023-09, 2024-06) zawyżają zieleń pod koronami; np. T-246/ruska-a 61% przy 2% na nalocie bez liści 2025-04; propozycja: kostka liczy się jako „na zieleni” tylko przy zieleni także na nalocie 2025-04 (np. ≥ 20%), próg sprawdzić na trawnikach z `truth.ts` (w kwietniu część trawników brązowa)
- Pakiet właściciela: tools/orto, tools/glitch-scan

### G-644 Kilkanaście pościgów naraz przepełnia pamięć rastrów okna `near`
- Status: naprawiony (PR #439, cfd7d3e; weryfikator PRZYJĘTE w rundzie 2: 134 warianty jak main, 0 przebudów rastrów po rozruchu, 18 pościgów mediana 0,8 ms)
- Ważność: S3 · Zasięg: odcięty ganger z planem `wide` nadal co krok pyta okno `near` przez `head(to)` (`ganger-walk.ts:191`); przy ok. 12 pościgach z różnymi celami pamięć `near` (8 rastrów) wypada bez końca: mediana 31,6 ms na krok, 600/600 kroków > 16 ms (main w tym scenariuszu 0,39 ms, 163 kroki > 16 ms tylko na starcie); poprawka: ganger z ważnym planem `wide` nie pyta `near`, albo klucz `near` niezależny od `from`
- Pakiet właściciela: packages/sim (systems/ai)

### G-667 Trawnik `T-245/trawnik-3-maja-klinika` leży na chodniku
- Status: naprawiony (PR #444, f7a18f0; kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: Krakowskie, x −95…−92, z 131–155, 49 m², zieleń 2%: jasny chodnik 3 Maja ze słupkami i latarniami, zieleń w pasach przy x −97 i x −91; poprawka: trawnik na pasy zieleni albo kostka; kryterium zieleń ≥ 55%; wiersz T-245 do uzupełnienia o ten trawnik jako otwarty
- Pakiet właściciela: tools/osm-import

### G-664 Zieleń z `layer>0` ukrywa gołą ziemię przed skanem `landuse-bare`
- Status: naprawiony (PR #443, e4189a1; landuse-bare 69019 → 69214, odsłonięty pas G-661)
- Ważność: S4 · Zasięg: `landuse-bare` pomija punkty w obrysie trawnika z mapy, także trawnika na dachu (r11978659), więc goły pas z G-661 nie zmienił bazy 69019; poprawka: zieleń z `layer>0` albo `location=roof` nie zwalnia próbek, nowa baza z przebiegu
- Pakiet właściciela: tools/glitch-scan

### G-670 Kontrola `added-grass-off-green` bez listy wyjątków celowych i bez lustra dla kostki
- Status: naprawiony (PR #441, 7cd9adb)
- Ważność: S4 · Zasięg: baza 10 liczy też celowe trawniki T-241 (`trawnik-zachod`, `trawnik-wschod`, `trawnik-bajkowskiego`, plan inwestora ADR-0074) i błędy klasyfikatora (`T-243/ck-zachod-trawnik`, `T-245/rabata-kolegium-poludnie`): lista wyjątków z odsyłaczem T-NNN, baza 10 → 5; nowa kontrola `added-paving-on-green` (ręczna kostka z zielenią ≥ 50%, kandydaci `T-245/zn2-wschod-trawnik` 71%, `zn2-wschod-srodek` 40%); do sprawdzenia też pas zieleni ok. 22 m² pod `podworze-litevski` (x −194,5…−192, z 28–39)
- Pakiet właściciela: tools/glitch-scan

### G-660 `save-load-micro-body` przekracza 20 s pod obciążeniem
- Status: naprawiony (PR #442, a07ac75)
- Ważność: S4 · Zasięg: `packages/sim/test/save-load-micro-body.test.ts` „won, knocked out…” (G-242) przekroczył limit 20 s przy load 11–13 na 4 rdzeniach; kandydat na test niestabilny; najpierw pomiar przyczyny, limitu nie podnosimy (ADR-0046)
- Pakiet właściciela: packages/sim

### G-665 Szczelina między kawałkami trawnika na garażu VIVO
- Status: naprawiony (PR #440, e90590b; kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: próbka (1119,75; 238,75), 0,057 m wewnątrz krawędzi garażu w173070505, w pasie ok. 0,1–0,2 m² między kawałkami trawnika z `groundRaisedGreen` (G-647, #436); test G-600 „leaves none of the garage's outline past the mall bare” pada po poprawce skanu G-664; przyczyna prawdopodobnie w cięciu po częściach wypukłych albo przycięciu do granicy chunku x = 1120
- Pakiet właściciela: tools/osm-import

### G-627 Ręczne trawniki T-245 leżą częściowo na nawierzchni
- Status: naprawiony (PR #438, 3503ce7; kurator PRZYJĘTE)
- Ważność: S3 · Zasięg: `LITEVSKI_GREEN` i `SCHOOL_GREEN` w `tools/osm-import/src/corrections-zn.ts` (runda 2 #405) kładą trawę na asfalcie i kostce: pas x −201…−197, z 27–45 (54 m², zieleń 13%) i pas wzdłuż w80139555 do Cichej 4 (104 m², zieleń 4%); krakowskie-0-1; poprawka wg ADR-0077: trawa tylko na płatach zieleni z nakładki ortofoto (domknięcie 1 m, płat od 4 m²), reszta kostką jak T-243; kryterium: trawnik Litevski ≥ 70% zieleni, szkoły ≥ 55%, nowa kostka ≤ 15%; `cover-truth.test.ts` próg 0,55 → 0,7 (trawniki kuratora są prawdą klasyfikatora); nowa kontrola skanu `added-grass-off-green` (ręczne trawniki z zielenią < 50%: 11 z 20, 1 133 m²; do sprawdzenia też T-241 trawnik-wschod, trawnik-bajkowskiego, T-245 trawnik-3-maja-klinika, rabaty przy Collegium, T-246 trawnik-nadstawna-3)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-654 Trasa placu `krakowskie-2-0-square-1` przecina samą siebie
- Status: naprawiony (PR #433, aa534cb)
- Ważność: S4 · Zasięg: przy (368; −223) odcinki 0×3 i 0×5 trasy się przecinają, także na main; test samoprzecięć w `crowd-square-barriers.test.ts` (#428) pomija tę trasę; po poprawce wyjątek z testu do usunięcia
- Pakiet właściciela: packages/sim (tłum)

### G-647 Trawnik na dachu VIVO rysowany na ziemi
- Status: naprawiony (PR #436, 3157e23)
- Ważność: S4 · Zasięg: trawnik r11978659 (`landuse=grass`, `layer=4`) to zieleń na dachu VIVO, a import kładzie go na ziemi pod budynkiem i na pasie nad jezdnią na północy (z 240–244, na ortofoto asfalt); część poza VIVO (x 1112–1120, z 230–239) to strop garażu ze świetlikami i zielenią, trawa tam zostaje; goła ziemia przy zachodniej ścianie (x 1100–1105, z 225–242, na ortofoto kostka chodnika i pas zieleni) do reguły gołej ziemi z ortofoto (ADR-0077 krok 1.1)
- Pakiet właściciela: tools/osm-import

### G-625 Ganger staje przy długim płocie albo murze, gdy w oknie sterowania nie ma drogi
- Status: naprawiony (PR #426, 5888292)
- Ważność: S3 · Zasięg: `planDetour` (`steering.ts`) zwraca „off-field”, gdy w oknie 80 m nie ma objazdu; ganger dochodzi do przeszkody i stoi, gracz za nią bezpieczny (sonda 30 s: 0 strzałów); np. płot (11,83; −251,22), mur 3 m (214; −28,13); bariery z #418 uwidaczniają to w wielu miejscach; test `barrier-ai.test.ts` („moved > 1”) przeszedłby też z gangerem stojącym przy płocie; poprawka: dłuższy objazd (nawigacja po grafie poziomu albo większe okno), a gdy drogi nie ma, przejście do osłony lub szukania
- Pakiet właściciela: packages/sim (systems/ai, steering)

### G-651 `belowGround` zdjęłoby budynek naziemny z `level=-1` i piętrami nad ziemią
- Status: naprawiony (PR #432, f0cad0b)
- Ważność: S4 · Zasięg: `tools/osm-import/src/building-tags.ts` `belowGround`: `level=-1` przy `building:levels=3`, `height=20` albo `roof:levels=1` daje `true`, więc budynek naziemny zniknąłby; w danych dziś takiego nie ma, ryzyko na przyszłość; poprawka: budynek z dodatnimi piętrami lub wysokością nie jest podziemny
- Pakiet właściciela: tools/osm-import

### G-646 Skan `market-pieces` ma własną regułę podziemia
- Status: naprawiony (PR #431, 71841c5)
- Ważność: S4 · Zasięg: `tools/glitch-scan/test/market-pieces.ts:96` `const isBuilding = (t: Tags): boolean => t.building !== undefined && t.building !== "roof" && t.location !== "underground" && Number(t.layer ?? 0) >= 0;`: garaż z `level=-2`, `layer=2` liczy jako budynek, a samo `layer<0` (budynek pod wiaduktem) jako podziemie; do ujednolicenia z `belowGround` (G-600)
- Pakiet właściciela: tools/glitch-scan

### G-601 Budynki na brzegu mapy z domyślną wysokością niezgodną z NMPT
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S4 · Zasięg: Cicha 6 w grze ok. 15 m przy ok. 7 m w rzeczywistości, Cicha 8 ok. 11,2 m przy ok. 17,5 m, XVI LO ok. 6 m za niskie, Pałac Ordynacki bez dachu spadzistego (jak G-122), narożnik Cichej 5 do sprawdzenia; T-250; także VIVO r5601275: 11,1 m z `building:levels=3` w relacji, LoD1 17,2 m (po scaleniu heights sprawdzić, że LoD1 trafia do VIVO, nie do zdjętego garażu w173070505)
- Pakiet właściciela: tools/osm-import

### G-629 Na skarpie cokół NMT połyka kondygnacje z tagu (Kowalska)
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: reguła `MIN_STOREY` w `lod1-heights.ts` liczy ściany od wierzchu cokołu; przy cokole 9–12 m Kowalska 7 spada z 4 kondygnacji do 1, Kowalska 9, 11, 13 z 3 do 1, od ulicy ślepy mur z jednym rzędem okien; 15 budynków (T-252); poprawka: kondygnacje z tagu zostają, gdy `height ≥ levels × 2,6`, cokół do `height − levels × STOREY`
- Pakiet właściciela: tools/osm-import

### G-631 Trybunał Koronny i Teatr Osterwy poniżej LoD1, Trybunał niższy od kamienic Rynku
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: oba w `LOD1_LANDMARKS` zostają przy starych wysokościach; Trybunał okap 11,4 m wobec LoD1 17,5 m i LoD2 ok. 16,4 m, po zmianie kamienice Rynku mają okapy 4–8 m wyżej (odwrócona relacja); Teatr 16,3 wobec 19,5 m (T-254); poprawka: korekta w `TAG_CORRECTIONS` zgodna z LoD1 i NMPT; kontrola `landmark-vs-lod1` (baza 3 z Klasztorem Dominikanów, G-633)
- Pakiet właściciela: tools/osm-import

### G-632 Wyjątek `historic` wyjmuje z LoD1 pałace spoza listy punktów orientacyjnych
- Status: naprawiony (PR #429, e8bbea5)
- Ważność: S3 · Zasięg: `use === "historic"` w `lod1Exempt`: Pałac Zylbera 10,1 m wobec LoD1 19,4 m (okap LoD2 17,7), Pałac Parysów 11,1 wobec 18,1, Złota 3, Rynek 11, Pałac Pawęczkowskiego, DPS im. Michelisowej (T-255); poprawka: usunąć ten warunek, punkty orientacyjne mają własną listę; kontrola `height-vs-lod1` z historic (baza 10)
- Pakiet właściciela: tools/osm-import

### G-600 Podwójna bryła VIVO: garaż podziemny `level=-2` rysowany jako budynek
- Status: naprawiony (PR #427, a6cef32)
- Ważność: S3 · Zasięg: w173070505 (`building=yes`, `level=-2`, `layer=2`) ma prawie ten sam obrys co VIVO r5601275; po G-556 obie bryły wracają przycięte, nakładają się na 1732 m², dachy dzieli 0,1 m (y −12,5 i −12,6), ryzyko migotania; Podzamcze x 1088–1120, z 160–240; poprawka: pomijać w imporcie budynki, których wszystkie `level` są ujemne (jak `location=underground`); garaż wystaje poza VIVO, więc po usunięciu odsłania ok. 149 próbek gołej ziemi (do wyłożenia według ortofoto); skan: ta sama reguła w `edge-buildings.ts` i `building-underground-solid`, nowa kontrola `building-duplicate` (nakładanie > 50% pola mniejszego, bez `building:part`)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-613 Trasy tłumu przy Podwalu biegną po linii muru oporowego zamiast osią chodnika
- Status: naprawione w #428 (12.11; `offBarriers` odsuwa trasy placów 1 m od barier wzdłuż, `unloop`; mur w67626198 179/183 m)
- Ważność: S3 · Zasięg: trasy `stare-miasto-1-0-square-0` i `stare-miasto-1-1-square-0` idą w medianie 0,5 m od muru w67626198, a oś chodnika w56965511 jest 0,65–1,95 m od muru (zwykle 1,7 m); przez to 61 m dwumetrowego muru skarpy pod Archikatedrą wycięte (x 673–693, 701–705, 731–743, 753–760 przy z −200…−161 i x 745–760 przy z −15…12); kryterium: trasy co najmniej 1,0 m od muru i mur w grze ponad 170 z 183 m; T-251
- Pakiet właściciela: packages/sim (tłum), tools/osm-import


### G-626 Piesi tłumu wchodzą w bariery biegnące wzdłuż ich trasy
- Status: naprawione w #428 razem z G-613 (12.11; `CROWD_LINE` 0,70 m, `barrier-on-crowd-lane` 0, `barrier-parallel-cut` 15 → 12)
- Ważność: S4 · Zasięg: `barrier-room.ts` (`CROWD_LINE` 0,3 m) przy pieszych idących 0,28 m od linii trasy bez kolizji z bryłami; 45 kawałków, 149 m (21 płotów, 7 żywopłotów, 1 mur, 16 murów oporowych), najgłębiej ponad 0,2 m, np. płot (729,5; 93,0); skan `barrier-on-crowd-lane` ma próg `ALONG` 0,2 m zamiast 0,58 m; łączy się z G-613 (trasy tłumu z dala od barier)
- Pakiet właściciela: packages/sim (tłum), tools/glitch-scan


### G-522 Klinowe szczeliny bez nawierzchni między jezdnią a chodnikiem Krakowskiego
- Status: naprawione: krok 1 w #400, krok 2 w #409 (12.11; reguła `kerbFills` z indeksem `RingBins`, `kerb-gap-bare` 103 204 → 29 702; budżet reference 199/85 z wpisem w ADR-0046; T-247)
- Ważność: S3 · Zasięg: (−120,5..−114; 54,5..101) 128 m², (−104,5..−102,5; −6,5..13) 48 m², (−121,5..−120,5; 74,5..100,5) 27 m², także części nieliczone skanem; zrzuty `kp-strip-g`, `s-strip-l`, `wedge`; przyczyna: jezdnia i chodnik się nie schodzą; propozycja `kerb-gap-bare` z przeglądu G-440 (baza ok. 35 631 próbek 0,25 m w mieście)
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-570 Wypełnienie G-522 kładzie chodnik na pasach postojowych, zatokach i pasie ruchu
- Status: naprawione w #409 (12.11; asfalt jako osobne kawałki jezdni, kurator runda 3 ZGODNE)
- Ważność: S3 · Zasięg: 12 z 19 miejsc ortofoto, ok. 63% z 5 855 m² wypełnień przy ulicach z `lanes`; krawężnik 1–3 m wewnątrz prawdziwej jezdni (Ruska, Kapucyńska, Niecała, Peowiaków, Lubartowska przy przystanku Brama Krakowska 01, Unii Lubelskiej, Turystyczna, 3 Maja, Dolna Panny Marii, Zesłańców Sybiru); trawnik jako chodnik przy Andersa; przyczyna: szerokość z `lanes` × 3,25 lub typu nie obejmuje postoju, `fitToKerb` (T-046) tylko zwęża; poprawka: pas przy ulicy o szacowanej szerokości i szczelinie ≥ 1 m jako jezdnia z krawężnikiem przy nawierzchni pieszej, zebry do nowego krawężnika, trawniki przez korekty; kontrole `bus-stop-on-fill` i `kerb-fill-wide-estimated`
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-605 Fundamenty fary na Placu po Farze stoją jako murki 1,0 m zamiast ok. 0,5 m
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: r18507551, r18507552, w1348806697–708 (431 m w grze), NMPT − otoczenie: mediana 0,45 m, p75 0,78 m; przy 1,0 m zamknięty labirynt; poprawka: korekta wysokości 0,5 m (bez w1348806709, taras przy Rynku 11); kontrola `ruin-wall-height`
- Pakiet właściciela: tools/osm-import


### G-606 Symulacja tnie bariery, wzdłuż których biegnie trasa tłumu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: 21 odcinków ≥ 3 m, ok. 397 m, m.in. 127 m z ok. 152 m dwumetrowego muru oporowego skarpy pod Archikatedrą w67626198 (Podwale), ogrodzenie w231832115 (70 m), żywopłot w828140561; trasa 0,9 m od muru zostawia 0,4 m luzu; poprawka: ciąć tylko przy przecięciu (kąt jak `CROSS_SINE`) albo mniejszy `CROWD_ROOM`; kontrola `barrier-parallel-cut`
- Pakiet właściciela: packages/sim, tools/osm-import


### G-607 Przy schodach znikają mury po obu stronach biegu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: Zaułek Panasa w179264861: mur miejski w232362994 z 40 m zostaje 7 m (`FLIGHT_ROOM` 1,9 m), mur oporowy w232362995 traci 40 m w imporcie i 37 m w sim; balustrada w231832095 na podeście w Podzamczu (785; 248); poprawka: mur na krawędzi biegu zostaje (ewentualnie odsunięty na krawędź pasa), odstęp z szerokości biegu; kontrola `city-wall-kept`
- Pakiet właściciela: tools/osm-import, packages/sim


### G-608 Import tnie bariery biegnące wzdłuż krawędzi pasa jezdni
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S4 · Zasięg: pas z `roadWidth` szerszy niż jezdnia na ortofoto, więc mur przy krawężniku leży „na jezdni”: w232806008 (51 m, 389; 153), w886723051 (48 m, 220; −196), płot w73811517 przy Zamkowej (985; 281), murek w227679479 (28 m, 534; 517), koniec w67626198 (29 m); poprawka: reguła kąta jak dla dróg, bariery wzdłuż krawędzi przesunąć poza pas
- Pakiet właściciela: tools/osm-import


### G-610 Gracz za płotem jest nietykalny: ganger widzi przez płot i strzela w niego bez końca
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S2 · Zasięg: `inSight` (`ganger-perception.ts:201`) przez `clearSight` przepuszcza wzrok przez płot, a strzał płot zatrzymuje; `ShootAtPlayer` zeruje prędkość, `ChasePlayer` i `firingPosition` się nie włączają; sonda: 11 strzałów, 0 HP straty przy trzech płotach; 1359 płotów w grze
- Pakiet właściciela: packages/sim (systems/ai)


### G-611 Świadkowie przestępstwa nie widzą przez płot i żywopłot, obserwatorzy ciał widzą
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S4 · Zasięg: `crime-system.ts:82-104` (kamera, świadek, patrol, `inPlayerView`) używa `lineOfSight`, a reszta wzroku `clearSight`
- Pakiet właściciela: packages/sim


### G-612 Mury przecinają ogródki kawiarniane i siedziska tłumu
- Status: naprawione w #418 (12.11; bariery z OSM, runda 2 przyjęta przez kuratora i weryfikatora)
- Ważność: S3 · Zasięg: `furnitureClearance` (`world-barriers.ts:513`) pomija meble niesolidne, `CROWD_SPOTS` i `SEAT_SPOTS` nie biorą udziału w cięciu; cafe-garden (629,5; 117,2) 31 ze 168 próbek w murze, (583,7; 24,5), siedziska #286 i #287 z murem 0,05–0,14 m przed twarzą
- Pakiet właściciela: packages/sim, tools/glitch-scan


### G-637 Limit pobierania modelu liczy cały czas, nie bezczynność
- Status: naprawione w #424 (12.11; limit bezczynności 30 s, strumień zwalniany po porażce)
- Ważność: S4 · Zasięg: `MODEL_FETCH_TIMEOUT_MS` (120 s) przerywa całe pobieranie; przy łączu wolniejszym niż ok. 0,5 Mbit/s plik 8 MB (kaito.vrm) nigdy się nie załaduje, bo każda próba zaczyna od zera; poprawka: limit bezczynności (brak nowych bajtów przez N s) zamiast całkowitego; przy okazji: pełny zestaw engine+app+code-health trwa ok. 507 s (import 55%), do rozważenia `isolate: false` albo podział
- Pakiet właściciela: packages/engine (renderer: modele)


### G-634 `ModelLibrary.load` nie sprawdza `response.ok`
- Status: naprawione w #423 (12.11; `r.ok` sprawdzane przed parserem)
- Ważność: S4 · Zasięg: odpowiedź 404 albo 500 trafia do parsera jako GLB i pada dopiero przy parsowaniu z mylącym błędem; `.gltf` po URL (`LoadAssetContainerAsync`) i dynamiczny import pluginu glTF nadal bez limitu czasu (dziś nieużywane, manifest ma `.vrm`)
- Pakiet właściciela: packages/engine (renderer: modele)


### G-638 `fetch` bez sprawdzenia `res.ok` w zestawie miasta i dźwiękach
- Status: nie odtwarza się (12.11; wszystkie trzy miejsca sprawdzają `res.ok` w linii po `fetch` od fe802ea i 51d54c7, zgłoszenie wskazało same wywołania; błąd idzie do zastępstwa: fasady proceduralne, synteza dźwięku)
- Ważność: S4 · Zasięg: `city-kit-loader.ts:108`, `city-kit.ts:167` i `audio/samples.ts:62` pobierają bez sprawdzenia statusu, więc 404 trafia do parsera albo dekodera z mylącym błędem (ten sam wzorzec co G-634)
- Pakiet właściciela: packages/engine (renderer, audio)


### G-561 Model, którego pobieranie się nie kończy, zostawia postacie tła z pożyczką ubrania jako figurę riga na stałe
- Status: naprawione w #422 (12.11; limit 120 s, `fetchModelBytes` z AbortController i wyścigiem z zegarem; dalszy ciąg G-637)
- Ważność: S3 · Zasięg: `ModelLibrary.load` nie ma limitu czasu, więc zawieszony fetch blokuje `settled()` i `clothOf`
- Pakiet właściciela: packages/engine (renderer: modele)


### G-628 `tools/orto report --area` wybiera raster po pierwszym wierzchołku obszaru
- Status: naprawione w #421 (12.11; `coverOfRing` wybiera raster pokrywający najwięcej wierzchołków)
- Ważność: S4 · Zasięg: `report.ts --area T-245/zielen-litevski` zwraca „brak rastra”, bo pierwszy wierzchołek (x −201) leży tuż przed rastrem Krakowskiego (od x −200); poprawka: wybór rastra po środku obszaru albo po dowolnym punkcie na rastrze
- Pakiet właściciela: tools/orto


### G-621 `ModelMemory` bez testu kolejności zwalniania
- Status: naprawione w #420 (12.11; test jednostkowy `model-memory.test.ts`, pada 3/5 przy odwróconym sortowaniu)
- Ważność: S4 · Zasięg: przypadek telefonu w `model-release.test.ts` przechodzi także z odwróconym sortowaniem w `ModelMemory.sweep` (naraz jeden kandydat); brak testu jednostkowego „najdłużej nieużywany idzie pierwszy”
- Pakiet właściciela: packages/engine (testy)


### G-556 Budynek ze środkiem poza mapą znika w całości, także w części leżącej w chunku
- Status: naprawione w #414 (12.11; budynki przycięte do brzegu mapy ze ślepą ścianą; budżety reference 196/84 i krakowskie-tpp 165 z wpisem w ADR-0046; reszta za brzegiem w backlogu „Poszerzanie mapy”, T-250)
- Ważność: S3 · Zasięg: w mieście 50 budynków, ok. 10 100 m²; w krakowskie-0-1 Cicha 3, 5, 6 i 8 (281 m²), które w grze dają gołą ziemię w pasie Cichej i przy ogrodzie na zachód od Cichej 4; Ordynacki i Kuria już w T-058/G-096; propozycja kontroli `edge-building-dropped` (część w chunku > 2 m², środek poza mapą, poza rejestrem), baza 50 albo 48 bez T-058
- Pakiet właściciela: tools/osm-import, tools/glitch-scan


### G-620 Test zwalniania modeli przekracza w CI limit 20 s
- Status: naprawione (PR #419, 11.11; testy zwalniają `NullEngine` w `afterEach`, przypadek telefonu na lekkim pliku pod siedmioma nazwami; 6,3 → 1,8 s, pod obciążeniem 9,7 → 4,3 s; limity czasu bez zmian)
- Ważność: S2 · Zasięg: `packages/engine/test/model-release.test.ts` › „keeps no more files than a phone's limit” (#410) wczytuje sześć pełnych plików VRM przez NullEngine i w CI kończy się `Test timed out in 20000ms`; czerwieni shard „Unit tests (1)” w #416, #417, #418 (lokalnie przechodzi); limitu nie podnosimy, test do odchudzenia
- Pakiet właściciela: packages/engine (testy)

### G-536 Goła ziemia na placu przy Nowym Placu Targowym, Nadstawnej i na podwórzach Podzamcza (podzamcze-1-1)
- Status: naprawione (PR #408, 11.11; 22 obszary T-246/*: 15 kostki, 7 trawników i rabat; `landuse-bare` podzamcze-1-1 8021 → 188, podzamcze-0-1 6972 → 222; kurator ODSTĘPSTWO CELOWE T-246 po rundzie 2; obszary pocięte, żeby nie poszerzać siatek ziemi komórek: `krakowskie-tpp` 164 siatki jak na main)
- Ważność: S3 · Zasięg: 93 kwadraty 10 × 10 m `landuse-bare`, ok. 2005 m² (8021 próbek 0,5 m) w 28 skupieniach; największe (m², x, z): 680 (747..800; 446..490) przy parkingach w227698438 i w227698440, postoju taxi w227698439 i sklepie w73833921; 221 (735..750; 452..511) za Nova w66264174; 159 (815..841; 450..485) przy kioskach w73833930/31/32; 153 (742..769; 513..536) przy skraju Ruskiej; 121 i 107 (848..868; 507..526) przy Szkolnej; 110 (769..808; 501..526); 98 (807..828; 458..490); 91 (860..878; 487..498); dziewięć największych to ok. 88%; 60% próbek w `landuse=commercial` w1305996965 bez `surface`, 37% w pasie do 5 m od ścian; zrzuty dzienne `shots/opiekun-p11/d-d1-d.png`, `d-b1-b.png`, `d-a2-plac-e.png`; przyczyna jak G-513, G-521, G-527; test przyjęcia: `landuse-bare` w komórce do ≤ 10% z bazą obniżoną w tym samym commicie
- Pakiet właściciela: tools/osm-import (korekty nawierzchni)

### G-540 Goła ziemia na podwórzach i placach Podzamcza: Lubartowska, Probostwo, Nowy Plac Targowy, Ruska (podzamcze-0-1)
- Status: naprawione (PR #408, 11.11; 22 obszary T-246/*: 15 kostki, 7 trawników i rabat; `landuse-bare` podzamcze-1-1 8021 → 188, podzamcze-0-1 6972 → 222; kurator ODSTĘPSTWO CELOWE T-246 po rundzie 2; obszary pocięte, żeby nie poszerzać siatek ziemi komórek: `krakowskie-tpp` 164 siatki jak na main)
- Ważność: S3 · Zasięg: 81 kwadratów 10 × 10 m `landuse-bare`, ok. 1743 m² (6972 próbki 0,5 m; pierwotnie zaniżone do 2180 przez błąd zaokrąglenia) w 28 skupieniach; największe (m², x, z): 208 (609..662; 386..457) wzdłuż Lubartowskiej i przy Nowym Placu Targowym, 48 (606..630; 398..461), 38 (636..650; 559..580) przy parkingu w227679484, 37 (520..530; 427..447), 34 (676..715; 567..580) przy Ruskiej; kontekst OSM: 36% w `landuse=retail` w291844839 bez `surface`, 20% w `landuse=commercial` w1094207955, 7% w `landuse=retail` w1547216431, 35% poza wielokątami; zrzuty `shots/opiekun-p01/d-s3-slope2.png`, `d-a1-big-w.png`, `d-a2-big-n.png`; przyczyna jak G-513, G-521, G-527, G-536; przy okazji w komórce `kerb-gap-bare` 116 trafień (G-522) i 7 znanych `lane-dead-end`, G-508 tu to prawdziwe skarpy NMT (największa 548..570 × 538..560, 33°)
- Pakiet właściciela: tools/osm-import (korekty nawierzchni)

### G-059 Testy sesji `m2-schedules` i `m3-loop` trwają ok. 5 s i przekraczają limit vitest pod obciążeniem
- Status: odrzucone (pomiar, 31.10)
- Ustalenie orkiestratora: główny `vitest.config.ts` daje `testTimeout: 20_000` właśnie dla testów całych aktów. Limit 5 s działa tylko przy vitest puszczonym z katalogu pakietu, bez głównej konfiguracji. Z roota przy load 30: najdłuższy test 7,6 s (zegar HUD, 3600 klatek), wszystkie 10 zielonych. Testy uruchamiamy z roota repo

### G-095 Żółty kabel kanionu przez przedsionek Trasy Podziemnej (do potwierdzenia)
- Status: odrzucone, niepotwierdzone (porządek rejestru 11.11): niepotwierdzone (glitch hunt wnętrz, 31.10)
- Ważność: S4 (proponowana) · Koszt: mały
- Dowód: zrzut `scratchpad/shots1/p1-trasa-vest.png` (kamera 567, 1,93, −57, yaw π/2): żółta linia na wysokości głowy w poprzek przedsionka i krótki odcinek na tylnej ścianie
- Do ustalenia: czy to kabel z `renderer/mapcity/canyon-plan.ts` albo `landmarks/cables.ts` przechodzący przez bryłę; ile takich w mieście
- Pakiet właściciela: packages/engine (jeśli się potwierdzi)
- Test przyjęcia: kontrola `cable-through-interior` (odcinek kabla wchodzi w bryłę wnętrza `interior: true`) z bazą → 0

### G-226 E2E `npr-perf` „the Rynek in TPP” przekracza 90 s na `citySettled` przy load 12–15
- Status: odrzucone, nie regresja (porządek rejestru 11.11): zbadane (2.11, naprawiacz): przepustowość maszyny, nie regresja. Klatka pod SwiftShaderem 2–3 s przy load 10, 4–7 s przy 15–19 (skoki 10–16 s); miasto dochodzi do `citySettled` w 1–3 klatki; main vs. przed #186 i #167: wywołania i siatki identyczne, trójkąty +1 %, czas w szumie. Propozycje: (1) wspólna strona dla scen TPP (zmienia historię próbki, decyzja), (2) klatki na żądanie w `freeze` (`__seki.draw(n)`, ADR-0046), żeby `page.evaluate` nie czekało za klatkami w tle (pomoże też G-132), (3) orkiestrator wstrzymuje ciężkie zadania na czas e2e perf. Propozycja (2) zbudowana i odłożona (gałąź `ccr-ec2c4269-ilh8k8-draw-on-demand` @ 07c0b98, bez PR): `FrameGate` i `__seki.draw(n)` działają, budżety i migawka bez zmian, ale scena nie jest krótsza (settle potrzebuje 4–5 klatek zamiast 3–4, sumy w szumie); wątek strony blokuje też coś poza klatkami w tle (wiadukt: `step` 10 s, rynek: teleport 3 s; hipoteza: synchroniczne GL przy spawnie siatek nowego chunka). Następny krok: ślad tego `step`, potem decyzja o (1); raport `scratchpad/g226-raport.md`
- Ważność: S3 (test, czerwony CI kosztuje cykl) · Zasięg: `e2e/npr-perf.spec.ts:89` (Rynek TPP), także „Krakowskie Przedmieście TPP” i „market under the viaduct” (weryfikator #199: timeout 90 s przy load 13–17; viaduct na main 1,4 min przy load 15–21); powtórki same przechodzą
- Poprawka: ślad (trace) i pomiar, co trzyma `citySettled` (wczytywanie chunków, kafle, decale z #186?); bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: e2e (QA), engine

### G-285 Przeciwnicy wykrywają gracza natychmiast, takedown niemożliwy
- Status: naprawione (porządek rejestru 11.11): naprawione przez ADR-0069 etap 1 (#252) i 2 (#254, 5.11, słuch kroków); balans w etapie 3 (trop co krok za ścianą, sprint przed Kagami i Tessen 0,6–0,7 s)
- Ważność: S2 (proponowana: blokuje mechanikę) · Zasięg: walka z gangerami; czujność NPC i kamer (`AWARENESS_STEP`, `GUARD_CONE`, `ganger-perception.ts`)
- Do ustalenia: błąd w czujności czy brak trybu skradania (backlog, skradanie)
- Pakiet właściciela: packages/sim/src/systems/ai

### G-562 Plik modelu, który się nie wczytał, nie wczyta się ponownie w tej sesji
- Status: naprawione (PR #410, 8.11; odrzucony promise wypada z `containers`, plik wczytuje się ponownie; testy `model-loader` i `model-release` padają bez poprawki)
- Ważność: S4 · Zasięg: odrzucony promise zostaje w `containers` `ModelLibrary`, bez ponowienia
- Pakiet właściciela: packages/engine (renderer: modele)

### G-580 `parseModelManifest` przepuszcza pole `lends` bez walidacji
- Status: naprawione (PR #410, 8.11; `parseModelManifest` odrzuca wpis z `lends` innym niż boolean; test w app)
- Ważność: S4 · Zasięg: `"lends": "true"` (napis) po cichu usuwa `base-female.vrm` z dawców i przywraca G-575; żaden test aplikacji nie sprawdza, że `lends` przeżywa parsowanie (`model-donors.test.ts` czyta surowy JSON); przy okazji opis commita d2e8007 mówi o 10 postaciach, ADR wylicza 9
- Pakiet właściciela: packages/app (manifest modeli)

### G-547 `kurosawa.vrm` wczytuje się na ekranie ładowania, choć Kurosawa pojawia się w II akcie
- Status: naprawione (PR #407, 8.11; ADR-0076 etap 4a: start nowej gry 7 plików / 42,5 MiB → 6 / 36,5 MiB, `kurosawa.vrm` wczytuje się, gdy Kurosawa staje w scenie; 3 rundy weryfikacji: G-560, G-575)
- Ważność: S4 · Zasięg: +6 MiB na starcie; `donorsOf` ładuje wszystkie pliki manifestu przy liczeniu dawców ubrań; wczytywanie w tle według dzielnic i aktów to etap 4
- Pakiet właściciela: packages/engine (renderer: modele)

### G-560 Wygląd postaci tła zależy od tego, które pliki modeli są już wczytane
- Status: naprawione (PR #407, 8.11; stały zbiór dawców `donorFiles` = Seki ∪ pliki tła ∪ obsada z `lends`; testy determinizmu padają na rundzie 1)
- Ważność: S3 · Zasięg: w gałęzi #407 `countDonors` (`character-models.ts`) liczy dawców tylko z wczytanych plików, a `donorOf` (`model-dress.ts:48-49`) wybiera teksturę jako `floor(fraction * list.length)`; ta sama postać tła (to samo ziarno) po ponownym ubraniu nosi inne spodnie lub górę po wczytaniu `mori.vrm` w tle i po `kurosawa.vrm` w II akcie; łamie decyzję „Determinizm” ADR-0076
- Pakiet właściciela: packages/engine (renderer: modele)

### G-575 Postacie nazwane zmieniają ubranie po zmianie zbioru dawców w #407
- Status: naprawione (PR #407, 8.11; `base-female.vrm` wśród dawców przez `lends`; względem main zmieniają się tylko spodnie barmana, gull-guard, Shiro, Daigo i Koji, opisane w ADR-0076 §4a; test `model-donors.test.ts`)
- Ważność: S3 · Zasięg: wariant 100+ z `dress` bez `topFrom`/`bottomFrom` bierze te pola z ziarna, więc krótsza lista dawców zmienia indeks w `donorOf`; zmiany: spodnie barmana, gull-guard, shiro, daigo (Kurosawy → Kaito), koji (Kurosawy → gangera), akane (base-female → Seki), koi-regular-2 (góra i spodnie), mei i mika (góra); barman i koi-regular-2 w Neon Koi; ADR nie opisywał zmiany
- Pakiet właściciela: packages/engine (renderer: modele)

### G-521 Goła ziemia na podwórkach bloków Krakowskiego Przedmieścia (krakowskie-0-1)
- Status: naprawione (PR #405, 8.11; 19 obszarów T-245/*, w tym 6 trawników, w `corrections-zn.ts` i `corrections-radziwillowska.ts`; `landuse-bare` komórka 10 004 → 136, miasto 96 273 → 86 405, `kerb-gap-bare` → 101 904; test `landuse-bare-krakowskie-0-1.test.ts` pada bez poprawki; kurator ODSTĘPSTWO CELOWE T-245 po rundzie 2; budynki Cichej 3–8 w G-556, pętle `highway=service area=yes` w G-555)
- Ważność: S3 · Zasięg: 141 kwadratów 10 × 10 m, ok. 3100 m², 59 skupień; największe: blok NW 1431 m² (x −200..−120; z −20..49, zawiera pas z 7..12 od naprawiacza G-513), podwórze SW 289 m² (−198..−165; 92..124) i 273 m² (−163..−135; 73..93), wschód (−27..−5; 143..158) 109 m², (6..19; 139..151) 81 m²; zrzuty `shots/opiekun-k01/` (`nw-strip-a`, `s-yard-i`, `se-a`); przyczyna jak G-513 (OSM bez nawierzchni na podwórkach); poza skanem ok. 4800 m² gołych podwórek mieszkalnych (do decyzji kuratora)
- Pakiet właściciela: tools/osm-import (korekty)

### G-509 Stożek odblasku na stropie food hallu Alchemii (i możliwy w kapsule)
- Status: naprawione (PR #402, 8.11; lampy hali i kapsuły w oprawie stropu, testy padają bez poprawki)
- Ważność: S4 · Zasięg: lampa w `alchemia-view.ts` wisi 0,4 m pod stropem hali (zrzut `shots/g490/after/hall-north.png`), lampa w `capsule-room-view.ts` 0,3 m pod sufitem; poprawka jak w P−1: lampa w oprawie stropu (po G-490 shader już nie świeci od tyłu)
- Pakiet właściciela: packages/engine (renderer)

### G-513 Goła ziemia na podwórkach i przy gmachach Krakowskiego Przedmieścia (krakowskie-0-0)
- Status: naprawione (PR #397, 8.11; 18 ręcznych obszarów kostki T-243/* w `corrections-krakowskie.ts` i `corrections-ck.ts`: podwórza KP 37–60 z Sądem i UM, pasy przy fasadach, okolice Centrum Kultury, trawnik `ck-zachod` przy zachodniej ścianie CK; `landuse-bare` komórka 10 075 → 155, miasto 108 592 → 96 273; test `landuse-bare-krakowskie.test.ts` pada na danych sprzed poprawki; kurator ODSTĘPSTWO CELOWE T-243; kratki i krawężnik w G-519)
- Ważność: S3 · Zasięg: 144 kwadraty 10 × 10 m `landuse-bare` w ok. 87 skupieniach, ok. 2500 m²; największe: 244 m² (x −53,8..−13,8; z −94,3..−84,3), 208 m² (−189..−150; −220..−189), 190 m² (−188..−127; −270..−220), 182 m² (−176..−162; −32..−20), 180 m² (−155..−107; −101..−72), 155 m² (−16..−2; −128..−99); zrzuty `shots/opiekun-k00/clD-0.png`, `bare1-a.png`, `sad.png`; przyczyna: import nie kładzie nawierzchni na podwórkach i pasach przy gmachach (`landuse=retail/commercial`, gmachy publiczne); rozszerzenie G-450/T-221; kontrola `landuse-bare` istnieje, poprawka obniża bazę; przy okazji: G-508 w tej komórce to szum NMT przy krawędziach budynków (1 krawędź > 20° pod budynkiem, 15 > 10° w gołym terenie; propozycja `terrain-crease` z progiem 12° bez obrysów budynków), T-204 do sprawdzenia przez kuratora (skan `tree-height-vs-nmpt` 0 w komórce)
- Pakiet właściciela: tools/osm-import (ground), tools/glitch-scan

### G-517 Duszony strażnik po ok. 4 s nadal stoi zamiast klęczeć
- Status: odrzucone, nie odtwarza się (PR #401, 8.11; test ochronny: cel klęczy po 1,2 s i do końca przytrzymania; zrzut e2e był po krokowaniu hurtem `step(n)` bez klatek renderera, rozwiązanie dokładne w G-482)
- Ważność: S4 · Zasięg: przy przytrzymanym duszeniu (ADR-0075) `heldPose` celu nie przechodzi w klęczenie po ok. 4 s; do sprawdzenia testem pozy w czasie i z czasem fazy (por. G-482)
- Pakiet właściciela: packages/engine (renderer: grab-pose)

### G-511 Znak `spread` w `activity-poses.ts` zwiera nogi zamiast je rozstawiać
- Status: naprawione (PR #396, 8.11; `applyActivityPose` i `poseParts` tłumu: lewa noga −spread, prawa +spread, jak w kucaniu; testy w `activities.test.ts` i `crowd.test.ts` padają bez poprawki)
- Ważność: S4 · Zasięg: dodatnie `spread` dla lewej nogi obraca ją do środka (`legL.rotation.z = +0,2` przesuwa kolano z x −0,083 na +0,005), komentarz mówi „feet apart”; wartości 0,04–0,08, sprzed #386
- Pakiet właściciela: packages/engine (renderer: pozy)

### G-514 Przód spódnicy Seki wcina się w udo przy duszeniu (poza „holdingDown”)
- Status: naprawione (PR #396, 8.11; `holdingDown` w `grab-pose.ts`: pochylenie 0,15, udo −1,0 rad (biodro 66°), kolano 0,8, ciało 3 cm wyżej; wnikanie 3,8/2,2 cm (duszenie) i 3,9/2,5 cm (zabicie) → najwyżej 0,6 cm; rozjazd głowy TPP i oka FPP w duszeniu ok. 9 cm, tylne kolano i stopa w powietrzu w G-516)
- Ważność: S4 · Zasięg: `grab-pose.ts:149`, poza postaci chwytającej ma udo L −1,55 rad przy pochyleniu 0,3 (ok. 72° zgięcia w biodrze), ponad granicą ok. 63° dla przodu spódnicy `seki.vrm` (pomiar z #386); brak przypadku w `seki-skirt.test.ts`; przy okazji: śmierć z kucnięcia nie wygasza `body.position.y/z` ani `body.rotation.x` (ciało przesunięte −0,38/−0,14 m, kosmetyka)
- Pakiet właściciela: packages/engine (renderer: pozy)

### G-512 Postać zabita w kucki leży z kolanami na zewnątrz
- Status: naprawione (PR #394, 8.11; `animateDeath` wygasza `rotation.z` nóg, `applyPose` miesza ją do 0; w chwycie z kucnięcia kolana schodzą płynnie, pozy aktywności bez zmian; testy padają bez poprawki)
- Ważność: S4 · Zasięg: `animateDeath` (`character-animation.ts`, ok. l. 136) nie zeruje `legL/legR.rotation.z`, więc po nowym kucaniu z kolanami na zewnątrz (0,25 rad) ciało leży z rozwartymi kolanami; przy okazji: nieaktualny komentarz `CROUCH_EYE_HEIGHT` w `packages/sim/src/world/hitscan.ts:93` (głowa rigu w kucki 1,22 m, oko 1,14 m)
- Pakiet właściciela: packages/engine (renderer)

### G-507 Pastorał przy przyczółku wiaduktu Zamkowej ma latarenkę na wysokości przechodniów
- Status: naprawione (PR #392, 8.11; `DECK_DROP` 1 m z pomiaru, pastorał (756,8; 175,7) → (756,4; 176,2) na pomoście; przy okazji `lamp-road` Nabrzeża z obrysu pomostu jezdni na chodnik mostu; `lamp-beside-deck` od 1,5 m, 1 → 0)
- Ważność: S4 · Zasięg: (756,8; 175,7) stoi 1,85 m pod pomostem, 2 m od niego (poniżej progu `DECK_DROP` 2,5 m), latarenka ok. 1,55 m nad pomostem, 0,35 m od kostki; poprawka: niższy próg albo `byParapet` od ok. 1,5 m; zaostrzenie `lamp-beside-deck` do 1,5 m (baza 1)
- Pakiet właściciela: tools/osm-import (props)

### G-490 Przez strop P−1 Alchemii widać półprzezroczysty stożek
- Status: naprawione (PR #385, 8.11; stożek na stropie P−1 to odblask lampy P−1 0,4 m pod stropem i shader świecący od tyłu: lampa w oprawie, odblask tylko z powierzchni zwróconej do światła; deszcz nie pada w food hallu (`built-roofs.ts`); oświetlonych punktów stropu 126067 → 0; migawka NPR bez zmian; reszta w G-509)
- Ważność: S4 · Zasięg: na zrzucie `after/e4-deck.png` stożek (prawdopodobnie poświata latarni albo drona z T0) przechodzi przez strop parkingu; do sprawdzenia też, czy w food hallu z etapu 1 nie pada deszcz pod stropem
- Pakiet właściciela: packages/engine (renderer: efekty)

### G-506 Generator mebli ignoruje `yaw` grup planu z `points` (ławki placu T0 tyłem do trawników)
- Status: naprawione (PR #382, 8.11, runda 2; `placeItem` bierze `yaw` grupy także dla `points`, zmiany tylko w krakowskie-2-1; 11 ławek placu T0 przodem do trawników i placu; test w `props.test.ts` pada bez poprawki)
- Ważność: S4 · Zasięg: `placeItem` dla grup z `points` ustawia `yaw: null` (props-gen.ts ok. 245), `openFacing` odwraca 7 z 8 ławek placu T0 od trawy, 4 pod pergolą patrzą na wykop rampy; kontrola `plan-yaw-ignored` (baza 8)
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-500 Asfalt alejek parkingu w173531008 urywa się na parapetach rampy P−1 i wchodzi pod domek klatki
- Status: naprawione (PR #382, 8.11; kurator ODSTĘPSTWO CELOWE T-241; parking i alejki w177513189, w173567309 wyłączone z importu (`REPLACED_WAYS`), plac T0 z kostki w obrysie, wjazd asfaltem tylko między ścianami rampy; `cut-on-road` 3 → 0, pada bez poprawki)
- Ważność: S4 · Zasięg: wykop rampy przecina oś alejki w177513189 na 17,6 m, szyb klatki na 2,2 m, domek klatki stoi na jej zakręcie (zostaje ok. 2,8 m przejazdu); T0 ma nawierzchnię z OSM, choć plan 2026 przewiduje plac i zielony dach; proponowana kontrola `cut-on-road` (baza dziś 3); T-237, T-238
- Pakiet właściciela: tools/osm-import

### G-495 `models.spec` czasem mierzy klatkę bez aktywnych siatek
- Status: naprawione (PR #387, 8.11; po `freeze` `step` nie rysuje klatki, spec czytał klatkę z rozruchu 326/0; `sampleNow` w `e2e/helpers.ts`, asercja aktywnych siatek > 0, scena `models` 465/158 w `tools/perf-budgets.json`; stary pomiar 5/5 pustych klatek, nowy 4/4 stabilnie 448/152)
- Ważność: S4 · Zasięg: na main w dwóch z trzech przebiegów pomiar 324/0 (wywołania / aktywne siatki); pomiar niestabilny, bramka może przepuścić regresję; przy okazji: NPC „doker” w dokach bez wpisu w obsadzie, akcesoria sztywne (fartuch jak deska, dłonie siedzących sprzedawców przez niego); potwierdzone w 4 przebiegach przy load 10–12 (budowniczy i weryfikator #376): koszt wariantów i fartucha nie jest mierzony lokalnie
- Pakiet właściciela: e2e (QA)

### G-488 Waga puli modeli niebędąca liczbą daje zawsze ostatni plik
- Status: naprawione (PR #388, 8.11; `weightOf` w `model-cast.ts`: waga spoza skończonych liczb jak 1, ujemna jak 0; parser manifestu odrzuca wpisy puli z wagą nie będącą skończoną liczbą ≥ 0; dwa testy padają bez poprawki)
- Ważność: S4 · Zasięg: `pickFromPool` w `model-cast.ts`: `weight` = `"abc"` daje NaN i wybór ostatniego pliku puli, także z wagą ujemną; `parseModelManifest` nie sprawdza typu ani znaku `weight`; przy okazji: próg `< 50` MiB w `model-textures.test.ts` nie odróżnia stanu przed i po, a `loadToonModel` nie ma wywołań w kodzie
- Pakiet właściciela: packages/engine (renderer)

### G-503 Generator mebli nie stawia latarni na pomostach (T-239)
- Status: naprawione (PR #383, 7.11; kurator ZGODNE; latarnia linii planu nad przęsłem staje na pomoście 0,3 m od krawędzi (`sideSpot`/`byParapet`), stopa z `deckHeightAt`; 3 pastorały Zamkowej i 3 `lamp-road` Mełgiewskiej na pomoście; `lamp-beside-deck` 6 → 0, pada bez poprawki; reszta G-507)
- Ważność: S4 · Zasięg: linia `lamps.zamkowa` przy wiadukcie w232362907 i pomoście grobli, przy okazji Mełgiewska
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-497 Pastorał grobli przy wiadukcie w232362907 stoi na trawie (T-235)
- Status: naprawione (PR #381, 7.11; kurator ZGODNE; krawędź mierzona z kostki pomostu (`deckAt`, `deckHeightAt`, próg `DECK_DROP` 2,5 m), latarnia (757,6; 175,0) → (756,8; 175,7), 0,35 m od kostki; `lamp-off-band` 1 → 0; test pada bez poprawki; reszta w G-503)
- Ważność: S4 · Zasięg: 1 `lamp-pastoral`
- Pakiet właściciela: tools/osm-import (props)

### G-489 Scena `s7_poet` stoi wewnątrz bryły budynku
- Status: naprawione (PR #378, 7.11; scena z (102, −23) w kamienicy w67498725 na (97, −23), płyta placu Litewskiego, 1,6 m od ściany; kontrola `buildingsAt` w `wave2-encounters.test.ts` (pryzmaty budynków, wysokość od gruntu w punkcie) dla 15 scen, pada ze starym punktem; brak testu dojścia pieszo do poety)
- Ważność: S4 · Zasięg: miejsce sceny `s7_poet` (102, −23) w `encounters.ts` leży w pryzmacie budynku (chunk `krakowskie-1-1`, bryła 318); ruch nie wypycha z głębi pryzmatu (graczka postawiona w (102, −13) dalej w nim stoi); test sceny ulicznej teleportuje graczkę do wnętrza; poprawka: przesunąć scenę na chodnik
- Pakiet właściciela: packages/sim (treść)

### G-469 Brak testu unieważniania koszyków `TerrainEntries` przy `set`/`delete`/`clear`
- Status: naprawione (PR #379, 7.11; sam test `terrain-index.test.ts`, 5 przypadków odczytu przed i po `set`, `delete`, `clear`; mutacja usuwająca czyszczenie koszyków łamie 5/5, 2/5 i 1/5; błędu w kodzie nie znaleziono)
- Ważność: S4 (test) · Zasięg: mutacja usuwająca unieważnienie koszyków po pierwszym odczycie przechodzi wszystkie testy; gotowa sonda weryfikatora w scratchpadzie sesji `v-g444-stale.test.ts` do przeniesienia do `packages/engine/test`
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-477 Latarnie z planu mebli stoją poza pasem deptaka (T-232, T-233)
- Status: naprawione (PR #374, 7.11, dwie rundy; latarnia z linii planu na wyłożonej osi deptaka staje 0,3 m za zmierzoną krawędzią kostki, najwyżej w odstępie FALLBACK; nowa kontrola `lamp-off-band` z tolerancją 1 m: 16 → 1 (przed tolerancją 210 → 188); 24 latarnie przesunięte, żadna nie zniknęła; test i skan padają bez poprawki; build deterministyczny; runda 2: test reputacji G-281 zależał od przypadkowej długości pasa tłumu, scena testu wybiera teraz parę mieszkańców; reszta przy wiadukcie w232362907 w G-497)
- Ważność: S4 · Zasięg: grobla Zamkowej (pastorały na trawie Błoni), Karmelicka (2 `lamp-road` w ogrodzie), przy okazji 17 pastorałów deptaka Krakowskiego Przedmieścia bliżej kostki
- Pakiet właściciela: tools/osm-import (props), tools/glitch-scan

### G-494 Kurosawa wisi nad ziemią
- Status: nie odtwarza się (7.11, naprawiacz; Kurosawa w `KUROSAWA_SPOT` (418; 29,4) na parkingu stoi na gruncie: y = `groundY` = −2,0375, renderer podnosi stopy o 0,1 na drodze (ADR-0045); ucięta głowa to kadr speca zrzutów liczony od y z sim bez podniesienia nawierzchni; uwaga do kadrowania zrzutów, nie glitch gry)
- Ważność: S4 · Zasięg: postać stoi na y −2,04 wyżej niż grunt, także na main; na zrzutach z etapu 2 ucina jej głowę
- Pakiet właściciela: packages/sim (treść) albo packages/engine (renderer), do ustalenia

### G-485 `pushOut` kończy się odepchnięciem od ciał bez ponownego sprawdzenia brył
- Status: naprawione (PR #377, 7.11; `pushOut` w każdej iteracji najpierw ciała, potem bryły, a odepchnięcie od ciała przecinające lico bryły jest odrzucane (`crossesSolid`); test `push-out-bodies-solids.test.ts` 127 przypadków, bez poprawki pada 102; `SINK` w `carry-drop-solid.test.ts` 1 mm; hashe G-208 przepisane świadomie, wnikanie posiłków w bryły ponad 1 mm 116/106 → 0/0 kroków; posiłki w tłumie przy ścianie nakładają się do 1,7 cm, zamierzenie)
- Ważność: S3 · Zasięg: `movement-system.ts`, `ITERATIONS = 2`: ostatni krok to odepchnięcie od innych ciał, bez kolizji z bryłami; postać nachodząca na leżące ciało (zerowa prędkość, nie jest wypychane) przy ścianie zostaje w ścianie, przy cienkiej ścianie przechodzi przez nią; niezależne od G-479; po G-479 runda 2 graczka wchodząca w leżące ciało przy ścianie wnika w nią do 3,5 cm (próg `SINK` 5 cm w `carry-drop-solid.test.ts` do zaostrzenia po naprawie); skutek: graczka stojąca środkiem w cienkiej ścianie (6 cm) odkłada ciało po drugiej stronie, bo bryła ze środkiem graczki nie blokuje odłożenia (G-479); przy okazji: `m1.test.ts` „save/load with deaths and spawns” przekracza limit przy load ok. 22 (146 s), osobno przechodzi (nie podnosić limitu)
- Pakiet właściciela: packages/sim

### G-479 Odłożone ciało może trafić środkiem w bryłę (kontener) i w niej zostać
- Status: naprawione (PR #373, 7.11, dwie rundy; `dropSpot` w `carry-system.ts` sprawdza 8 miejsc w odległości promień graczki + promień ciała (przód, skosy, boki, tył), bez miejsca ciało zostaje na ramieniu z podpowiedzią `prompt.body.no-room`; test `carry-drop-solid.test.ts` 19 przypadków, na kodzie sprzed G-479 pada 22 z sondami; próg `SINK` 5 cm do zaostrzenia po G-485)
- Ważność: S3 · Zasięg: `dropBody` w sim stawia ciało 0,6 m przed graczem bez sprawdzania brył; przy kontenerze (391,2..392,8 × −33,6..−32,4) środek ciała wszedł w bryłę i po 30 krokach wypychanie go nie wyciągnęło; sonda renderera (G-458) patrzy wtedy od środka bryły; poprawka w sim: miejsce odłożenia poza bryłami (cofnięcie do gracza albo bok), test w sim; do połączenia z ADR-0075 etap 4 (`settle-body`)
- Pakiet właściciela: packages/sim

### G-459 Bohaterka niesie ciało z wyciągniętym pistoletem
- Status: naprawione (PR #371, 7.11, ADR-0075 etap 2; `handsBusy` w rigu: broń w kaburze w chwycie i przy niesieniu, kamera chowa viewmodel w FPP; testy `grab-pose` i `camera-grab` padają bez zmiany)
- Ważność: S3 · Zasięg: sim blokuje broń przy niesieniu (ADR-0065), ale renderer dalej rysuje pistolet w dłoni
- Pakiet właściciela: packages/engine (renderer)

### G-458 Leżące ciało rysowane na 1,7 m, a kolizja to małe koło: głowa w ścianie
- Status: naprawione (PR #371, 7.11, ADR-0075 etap 2; `body-lay.ts` sprawdza ściany i meble ulicy (`BabylonRenderer.wallRay` przez `connectWorldRays`) i obraca albo odsuwa ciało do 0,5 m; testy `body-lay`, `wall-probe`, `world-rays` padają bez zmiany)
- Ważność: S4 · Zasięg: ciało odłożone albo osuwające się twarzą do ściany wchodzi w nią (głowa w witrynie; poza leżenia sięga 0,8–0,9 m od punktu symulacji w kierunku yaw); poprawka: odłożenie z kierunkiem od ściany albo kolizja leżącego ciała
- Pakiet właściciela: packages/sim (bodies), packages/engine

### G-457 Zwłoki na podniesionym terenie skaczą na y≈0
- Status: naprawione (PR #370, 7.11; `startDeath` zapamiętuje wysokość korzenia (teren z sim + podniesienie chodnika) w `rig.deathGround`, `animateDeath` liczy od niej; testy `characters.test.ts` i `character-deaths.test.ts` padają bez poprawki; przypadek śmierci w locie i na drabinie w G-481)
- Ważność: S3 · Zasięg: `animateDeath` ustawia `root.position.y = 0.12 − sink` w układzie świata, więc ciało na terenie NMT wyżej niż 0 spada pod teren albo wisi; do połączenia z ragdollem
- Pakiet właściciela: packages/engine (renderer)

### G-466 Karta dzielnicy na telefonie zasłania przycisk „Użyj”; po zmianie języka zostaje po angielsku
- Status: naprawione (PR #365, 7.11; karta dzielnicy na telefonie poza „Use” i skokiem, odświeża język; runda 2: w rozmowie węższa kolumna toastów `toasts--talk`, nie wchodzi pod napisy; testy komponentu padają bez poprawki; dialogue-fit, touch-layout, hud-layout 20/20)
- Ważność: S4 · Zasięg: 667×375 przy przyjeździe na Krakowskie Przedmieście karta zasłania „Użyj”, na 800×370 podobnie pierwsza linia podpowiedzi ruchu; karta pokazana przed zmianą języka nie przechodzi na pl
- Pakiet właściciela: packages/ui (HUD)

### G-428 Deptaki bez `width` buforowane na 8 m zachodzą na trawniki (T-199)
- Status: naprawione (PR #366, 7.11; szerokości z ortofoto PZGiK w `corrections-deptaki.ts`: Karmelicka 5 m, grobla 6,5 m, aleja Placu Litewskiego 6 m, ścieżki 1,5/1 m, podwórze w470555118 jako bruk; kostka na trawnikach 68/79/23 → 0/23/2 m², `grass-under-paving` 5 → 0; test pada bez poprawki, build deterministyczny)
- Ważność: S4 · Zasięg: Karmelicka, Szambelańska, Zamkowa ×2; poprawka: `TAG_CORRECTIONS` `width` z ortofoto; trawnik w470555118 na brukowanym podwórzu
- Pakiet właściciela: tools/osm-import

### G-474 Fixer (Kaito) rysuje się jako czarna postać
- Status: naprawione (PR #368, 7.11; `kaito.vrm` niesie COLOR_0 z samych zer, toon shader mnożył albedo przez kolor wierzchołków; loader zdejmuje COLOR_0 z siatek VRM, glTF bez zmian; test `model-cast-colours.test.ts` na każdym pliku manifestu; jasność postaci na zrzucie 6,9 → 40,3)
- Ważność: S2 · Zasięg: model `kaito.vrm` (Sakurada Fumiriya, `manifest.json` rola `fixer`) widoczny w grze jako czarna sylwetka; do zbadania: materiał MToon/tekstury po zmniejszeniu (`tools/shrink_glb.py`), światło NPR, alfa; postać kluczowa dla wątku
- Pakiet właściciela: packages/engine (renderer: modele postaci), packages/app/public/models

### G-450 Goły pas przy fasadach Peowiaków na rogach Kościuszki i przy w67508886 (T-221, T-224)
- Status: naprawione (PR #364, 7.11; 5 obszarów kostki T-221/* i T-224 od fasad do osi chodników, 431 + 998 + 52 → 0 gołych próbek 0,25 m; skan bez zmian, kontrola `facade-footway-bare` przeniesiona do G-470)
- Ważność: S4 · Zasięg: ok. 70 m pierzei Peowiaków i 3 m² przy w67508886; poprawka jak T-210 i T-211 (`ADDED_AREAS` od fasad do osi chodników, obszar na dom); test: zero gołych próbek 0,25 m; przy okazji kontrola `facade-footway-bare`
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-396 Ruina `ruins=yes` rysowana jak cały budynek (T-188)
- Status: naprawione (PR #357, 7.11; w66286396 odbudowany jako Arkady; inne ruiny w G-462)
- Ważność: S4 · Zasięg: 1 budynek (w66286396, skrytka Hebi) · Koszt: średni; test przyjęcia: budynek z `ruins=yes` nie ma okien ani dachu, a jego wysokość ≤ poziom × 3 m; pokrewne G-053
- Pakiet właściciela: tools/osm-import

### G-460 Dołek do 1,0–1,3 m przy północno-wschodnim końcu Arkad (T-218)
- Status: naprawione (PR #357, 7.11; chodnik do a 44, podest 2,2 m na zachód; `pad-dip-uncovered` 33 → 0)
- Ważność: S4 · Zasięg: a 40–43, x 463–465, z 118–121, ok. 12 m², poza płytami chodnika; test: na wschód od ściany poza płytami `rawHeight − groundY ≤ 0,3`; kontrola `pad-dip-uncovered`
- Pakiet właściciela: packages/sim (content Alchemii), tools/glitch-scan

### G-461 Arkady: 12 równych przęseł zamiast 14 z ortofoto (T-218)
- Status: naprawione (PR #357, 7.11; 13 filarów co do 0,00 m z ortofoto; `arcade-rhythm` 0)
- Ważność: S4 · Zasięg: filary z ortofoto w a = 2,95 / 6,25 / 9,9 / 13,6 / 17,2 / 20,8 / 24,55 / 28,25 / 31,75 / 35,4 / 39,1 / 42,95 / 46,4 m; kontrola `arcade-rhythm`
- Pakiet właściciela: packages/sim, packages/engine (Alchemia)

### G-444 `map-city.test.ts` z małym zapasem do 5 s: koszt docinania i drapowania podłoża
- Status: naprawione (PR #363, 7.11; CPU głównego wątku −35/−39%, czas testu ok. 5,2 → 3,4 s przy load 11–18; geometria identyczna bit w bit, test `map-ground-golden`)
- Ważność: S4 (test) · Zasięg: „builds the whole generated Lublin” zużywa ok. 3,8–4,2 s CPU wobec limitu 5000 ms, więc przy load ok. 15 na 4 rdzeniach przekracza limit na każdym commicie; ok. 60% profilu to `ground-cut.ts` (`cutCovers`, `minusTriangle`), `ground-plan.ts` (drapowanie, `planSurface`) i `heightAt` w `map-entries.ts`; profil w scratchpadzie sesji `g444-new.cpuprofile`; bez podnoszenia limitu
- Pakiet właściciela: packages/engine (renderer/mapcity)

### G-465 Krótkie kliknięcie lub stuknięcie ataku gubi strzał (brak krawędzi `fire` w klatce)
- Status: naprawione (PR #359, 7.11; `fire` w klatce to trzymanie albo krawędź naciśnięcia w `virtual-pad.ts` i `keymap.ts`; krótkie kliknięcie oddaje jeden strzał, trzymanie bez zmian)
- Ważność: S3 · Zasięg: `fire` w klatce to stan trzymania (`virtual-pad.ts` `poll()`, `keymap.ts:143`); naciśnięcie i puszczenie między dwoma odczytami wejścia nie oddaje strzału ani nie wybiera „Zabij” w chwycie; przy 15–20 kl./s na telefonie dotyczy stuknięć krótszych niż 50–66 ms
- Pakiet właściciela: packages/engine (input), packages/app (kontrolery)

### G-449 Ogłuszona postać stoi: renderer nie zna stanu `unconscious`
- Status: naprawione (PR #356, 7.11; pozy osunięcia, leżenia, przebudzenia, niesienia przez ramię i odłożenia w rendererze; `knockout-carry.ts` poza `CharacterViews`)
- Ważność: S2 · Zasięg: każdy nokaut (takedown bez zabicia): `render-sync.ts:79` wysyła `unconscious: true`, ale `packages/engine` nigdzie go nie czyta, więc postać zostaje w pozie stojącej; da się ją tylko nieść. Do sprawdzenia przy okazji: poza niesionego ciała i ciała odłożonego po niesieniu
- Pakiet właściciela: packages/engine (renderer: character-animation, character-poses)

### G-447 Zabójczy takedown widziany przez jednego przechodnia nigdy nie jest zgłaszany jako zabójstwo
- Status: naprawione (PR #355, 7.11; `bodyReported` oznacza martwe ciało tylko przy zgłoszeniu zabójstwa, `knockOutCallsOver` usunięte; nokaut przy przechodniu i zwłoki znalezione w trakcie telefonu: −2 zamiast −3 zgodnie z zasadą jednego czynu z ADR-0070)
- Ważność: S3 · Zasięg: świadek dzwoni tylko o napaść, a będąc już w trakcie połączenia pomija zabójstwo; połączenie o napaści oznacza zwłoki jako zgłoszone, bo zabójczy takedown oznacza ciało jak nokaut (ADR-0065, etap 3); potwierdzone sondą weryfikatora #350: `takedown-system.ts:182` woła `noteViolence(..., target.id)`, `civilianWitness` pomija dzwoniącego, `callThrough` → `bodyReported` oznacza martwe ciało; propozycja: strażnik w `bodyReported`/`callThrough`, żeby zgłoszenie napaści nie oznaczało martwego ciała (może zastąpić `knockOutCallsOver`)
- Pakiet właściciela: packages/sim (bodies, crime-system)

### G-433 Na telefonie karta skanu zasłania pasek broni i podpowiedź ruchu
- Status: naprawione (PR #353, 7.11; hacki w siatce 2×2, karta 264×183 px, kółko drążka schowane przy skanerze; zero nachodzeń przy 844×390, 800×370, 667×375)
- Ważność: S3 · Zasięg: 844×390 i 800×370, karta skanu (Kiroshi) nachodzi na pasek broni i podpowiedź ruchu; do kontroli w `touch-layout`
- Pakiet właściciela: packages/ui (HUD, skan)

### G-440 Goły pas 1–1,5 m wzdłuż fasad ul. Kościuszki (T-211)
- Status: naprawione (PR #352, 7.11; 7 obszarów kostki T-211/* od fasad do osi chodników, 927 + 698 → 0 gołych próbek; landuse-bare bez zmian, bo nie liczy zwykłych domów)
- Ważność: S4 · Zasięg: x ok. 8–21, z −127…−182 i wschodnia strona ulicy, ok. 1200 punktów `landuse-bare`; poprawka jak T-210/T-164 (`ADDED_AREAS` kostki do ścian)
- Pakiet właściciela: tools/osm-import

### G-334 Zabójstwo ogłuszonego gangera po nokaucie zgłoszonym wcześniej nigdy nie jest zgłaszane jako zabójstwo
- Status: naprawione (PR #350, 7.11; zwłoki ogłuszonego nie dziedziczą zgłoszenia nokautu, `wronged` czyta `downed.fought`)
- Ważność: S3 · Zasięg: `corpseOf` przenosi na zwłoki `reported` z nokautu (`bodies.ts:75`), więc patrol, który znajdzie świeże ciało, go nie zgłasza; po wczytaniu dobicie ogłuszonego na oczach patrolu też nie jest przestępstwem, bo `wronged` jest przejściowe, a `offend` w `death-system.ts:72` nie czyta `downed.fought`
- Pakiet właściciela: packages/sim (bodies, death-system, crime-system)

### G-434 Pad T1 Alchemii podnosi Świętoduską o ok. 1,85 m (T-209)
- Status: naprawione (PR #343, runda 3, 7.11; T1 trzy pady, ulica ±0,15 m od NMT; kontrola `pad-on-road` 13 → 8)
- Ważność: S3 · Zasięg: jezdnia w230503896, chodnik w232464426, pas postojowy w1514058885 przy x 393–402, z 56–84; poprawka: przyciąć T1, przejście od ulicy ≤ 2 m; kontrola `pad-on-road`
- Pakiet właściciela: packages/sim (content Alchemii), tools/glitch-scan

### G-423 Pomniki przyrody bez swojego gatunku (dęby i topola „Baobab” jako lipy i klony)
- Status: naprawione (PR #348, 7.11; `tree-species-ignored` 4 → 0, dęby i topola z własnymi modelami)
- Ważność: S4 · Zasięg: 3 drzewa na Placu Litewskim; poprawka: `species`/`genus` z OSM (Quercus, Populus), model dębu; kontrola `tree-species-ignored`
- Pakiet właściciela: tools/osm-import, packages/engine (assety)

### G-436 Pas gołego terenu 1–2 m przed Sądem Okręgowym na Placu Czechowicza (T-210)
- Status: naprawione (PR #349, 7.11; `landuse-bare` 108 863 → 108 592)
- Ważność: S4 · Zasięg: x 2–22, z −104,7…−122, ok. 280 punktów `landuse-bare`; poprawka: domknąć nawierzchnię do ściany w69672563 (baza spadnie o ok. 280)
- Pakiet właściciela: tools/osm-import

### G-427 Plac Czechowicza i plac zabaw na Litewskim pod kostką (T-197, T-198)
- Status: naprawione (PR #347, 7.11; `grass-under-paving` 7 → 5; plac zabaw z T-198 był błędną diagnozą, resztka w G-428)
- Ważność: S3 · Zasięg: trawnik `village_green` 308 m² z pomnikiem wychodzi poza obrysy obu placów, więc `openPavings` go nie wycina; plac zabaw 22 m² styka się z trawnikiem; poprawka: odejmowanie wielokątów albo `place=square` bez nawierzchni
- Pakiet właściciela: tools/osm-import (ground)

### G-422 Drzewa o ok. 1/3 za niskie i z wąskimi koronami (Plac Litewski)
- Status: naprawione (PR #345, 6.11; mediana błędu wysokości 4,91 → 0,03 m, `tree-height-vs-nmpt` 47 → 6)
- Ważność: S3 · Zasięg: w grze 6,7–12,2 m, w NMPT mediana 12,7 m, 43 drzewa ponad 15 m; poprawka: skala z NMPT (szczyt w promieniu 3 m minus teren) albo z tagu `height`, zakres skali ok. 0,7–2,2; test: mediana błędu ≤ 2 m; kontrola `tree-height-vs-nmpt`
- Pakiet właściciela: tools/osm-import (props), packages/engine

### G-421 Trawniki pod kostką placów: multipoligon placu bez wyciętych pierścieni `inner` (Plac Litewski i 70 innych kawałków)
- Status: naprawione (PR #344, 6.11; zgłoszenie użytkownika; Plac Litewski 1,75 → 8 012 m² trawy, `grass-under-paving` 68 → 7)
- Ważność: S2 · Zasięg: 71 kawałków trawy, 13 425 m² w mieście, w tym ok. 9 700 m² w Krakowskim (Plac Litewski r7690183 ma w grze 0,01% trawy wobec 31% w rzeczywistości), obrzeża drzew na deptaku, część Placu Krąpca, Nabrzeże (2343; 161) · Koszt: mały; poprawka w `tools/osm-import` (`features.ts`: wyciąć `inner` z nawierzchni) albo w `ground.ts` (odjąć `grass` od `square`/`cobble`); NIE podnosić `SURFACE_LIFT.grass` (wspólne z symulacją, G-130); test: trawa widoczna na placu ≥ 9 000 m², kontrola `grass-under-paving` z bazą zbijaną do 0
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity)

### G-410 Ramki rzadkości w torbie i slotach ekwipunku niewidoczne (kolejność reguł CSS)
- Status: naprawione (PR #342, 6.11; sloty z ramką rzadkości, zaznaczenie białym pierścieniem)
- Ważność: S3 (weryfikator #334: ramki niewidoczne od E4 4c23a7f; rzadkość tylko tekstem) · Zasięg: w `styles.css` reguły `.inv__cell` i `.inv__slot` stoją za `.rarity--*` i nadpisują kolor ramki; od #334 komórki z ikoną mają kolor w stylu, komórki tekstowe (mody, wszczepy) i sloty ubrań nadal nie; zaznaczenie (magenta) wygląda jak kolor rzadkiego
- Pakiet właściciela: packages/ui (inventory)

### G-383 Gołe podłoże na wschód od stanowisk Dworca, x 870–915 (T-185)
- Status: naprawione (PR #339, 6.11)
- Ważność: S4 · Zasięg: ok. 630 m² · Koszt: mały (najpierw ortofoto x 870–920)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: ≤ 0,5 m² gołego poza rabatą

### G-382 Gołe podłoże przy wiacie przystanku w672635871 (T-184)
- Status: naprawione (PR #339, 6.11)
- Ważność: S4 · Zasięg: ok. 98 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: gołe próbki 0,1 m w klinie ≤ 0,5 m²

### G-409 Kontrole skanu glitchy blisko limitu 20 s w CI z pokryciem
- Status: naprawione (PR #336, 6.11; sześć kontroli 2–70× szybciej, raport skanu identyczny bajt w bajt)
- Ważność: S3 (CI) · Zasięg: pod obciążeniem z `VITEST_COVERAGE_SHARD=1`: building-in-set-piece 21,2 s, cable-low 29,7 s (ponad limit), market-piece-on-crowd-lane 15,2 s, lamp-style-change-on-way 13,8 s, paving-overlap-step 6–8 s; na runnerze CI grożą jak `paving-coplanar` w #328; poprawka: przyspieszyć kontrole (pomiar, indeksy), nie podnosić limitu
- Pakiet właściciela: tools/glitch-scan

### G-381 Strzelec staje w promieniu `ARRIVE` od stanowiska, a linia wzroku liczy się z samego węzła: stanowisko bywa bez strzału
- Status: naprawione w #316 (gałąź `held` w `firingPosition`: strzelec dochodzi do węzła, gdy z pozycji nie ma strzału); potwierdzone sondami 6.11 (metro, stary targ, doki), nie odtwarza się na 245a455
- Ważność: S3 · Zasięg: `firingPosition` i `firstStep` w `packages/sim/src/world/nav.ts`; strzelec czeka z zerową prędkością bez końca · Koszt: średni
- Pakiet właściciela: packages/sim (`world/nav.ts`, AI strzelca)
- Test przyjęcia: strzelec dochodzi do gracza albo strzela we wszystkich przypadkach siatki z #316

### G-377 Promień z ulicy do szybu metra trafia w niewidzialny teren pod pawilonem
- Status: naprawione (PR #335, 6.11; skan `metro-shaft-ray` 948 → 0)
- Ważność: S3 · Zasięg: `GroundField.rayHit` maszeruje teren chunka ulicy w obszarze szybu do najbliższej linii siatki, więc trafia w dawną powierzchnię ulicy pod pawilonem; strzelec 0,5 m przed otworem Alchemii B nie widzi gracza w hali i przez 20 s nie strzela; prawdopodobnie też strzały gracza z zewnątrz do hali · Koszt: średni
- Pakiet właściciela: packages/sim (`world/ground.ts`, raycast)
- Test przyjęcia: linia wzroku i strzał z ulicy przed otworem do gracza w hali przechodzą (i odwrotnie)

### G-320 Nakładające się nawierzchnie `square` i `cobble` leżą w jednej płaszczyźnie: migotanie głębi (z-fighting) bruku i płyt w całym mieście
- Status: naprawione (PR #328, 6.11; zgłoszenie gracza z nagraniem; skan `paving-coplanar` 1560 → 0)
- Ważność: S3 (było S4) · Zasięg: 69 par różnych nawierzchni z tym samym `SURFACE_LIFT` 0,08; dwa nakładające się `square` z różnym wzorem spoin dają słabe kropkowane linie (zrzut `shots/g301/after/g301-c.png`); trwale: rysować jeden kawałek z pary (przycięcie nakładek w imporcie)
- Pakiet właściciela: tools/osm-import i packages/engine (mapcity/ground-plan)

### G-401 Napad z mikrozdarzenia otwiera pusty panel rozmowy i odbiera sterowanie
- Status: naprawione (PR #332, 6.11)
- Ważność: S3 · Zasięg: mikrozdarzenie napadu wysyła `EncounterStarted` z pustym knotem `""`; app (`packages/app/src/controllers/compose.ts`, `onEncounter`) otwiera pusty, zakończony panel rozmowy, który blokuje sterowanie, dopóki gracz go nie zamknie
- Pakiet właściciela: packages/app (controllers), packages/sim (micro-events)

### G-400 E2E w CI: przy trafieniu cache `.deb` apt i tak pobiera czcionki z mirrora (15 min)
- Status: naprawione (PR #330, 6.11; setup e2e 887 s → 21 s)
- Ważność: S3 (CI) · Zasięg: przebieg 42237620499 (#327): cache `playwright-debs` trafiony, ale `apt-get install ~/playwright-debs/*.deb` pobrał te same 9 paczek (21,9 MB) z mirrora Azure w 15 min, shard 1 przekroczył 25 min; regresja po G-387 (#319); poprawka: `dpkg -i` na lokalnych plikach
- Pakiet właściciela: .github (Infra)

### G-391 `Ground.rayHit` poza chunkami: promień 2 km małymi krokami, `chunkIndex` liniowo po wszystkich chunkach
- Status: naprawione (PR #325, 6.11)
- Ważność: S3 (wydajność gry i CI) · Zasięg: `packages/sim/src/world/ground.ts:341` (`rayHit`) i ok. l. 164 (`chunkIndex`); pościg strażników przypiętych daleko woła co krok `lineOfSight`; pierwsze kroki do 110 ms, dalej ok. 25 ms; przyczyna G-357, G-390 i wolnych `save-load-away-guards` · Koszt: średni
- Pakiet właściciela: packages/sim (`world/ground.ts`)
- Test przyjęcia: wyniki `rayHit` identyczne (test z wersją referencyjną), złote hashe bez zmian, czasy wymienionych testów wyraźnie niższe

### G-372 Podciąganie (`ledgeAhead`) sprawdza tylko punkt docelowy: na cienką barierkę da się wejść wzdłuż jej linii i chodzić po wierzchu
- Status: naprawione (PR #321, 6.11; resztka na czubku dachu podzamcze 591 jako G-393)
- Ważność: S3 · Zasięg: prawdopodobnie barierki w całym mieście; przy windzie Alchemii wymusiło barierki 2,6 m zamiast 1,1 m · Koszt: średni
- Pakiet właściciela: packages/sim (`movement-system`)
- Test przyjęcia: podciągnięcie na bryłę węższą niż ciało albo na krawędź barierki jest odrzucane; barierka 1,1 m nie daje się przejść

### G-390 `save-load-contract-ended.test.ts` przekracza 20 s w CI (przypięci daleko strażnicy)
- Status: naprawione (PR #324, 6.11)
- Ważność: S3 (zatrzymuje CI losowych PR-ów) · Zasięg: „saved away from the docks, the guards of the alarm wait at the office in both games”; ten sam wzorzec co G-357 (krokowanie z przypiętymi daleko strażnikami ok. 10× droższe) · Koszt: mały
- Pakiet właściciela: packages/sim (test)
- Test przyjęcia: najdłuższy przypadek pliku lokalnie ≤ 1,5 s, asercje bez zmian

### G-345 Gołe podłoże wokół stanowisk Dworca Autobusowego (x 808–870)
- Status: naprawione w #318 (6.11, 0fc0023; `T-170/*`, trawnik przed pawilonami jako `flowerbed`)
- Ważność: S4 · Zasięg: ok. 1000 m² w x 808–870, z 366–395 (pas między ścieżką w227698420, chodnikiem w227698409 i stanowiskami, z gruntem pod zadaszeniem w458862470); też pas na północ od kiosku w73833929 (z 434–442, x 780–816) · Topografia: T-170 (kurator: pod zadaszeniem ok. 453 m², przed pawilonami ok. 535 m², na północ od kiosku ok. 160 m²)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`), przegląd kuratora

### G-347 Gołe podłoże wzdłuż parkingu w227698441 przy ul. Nowy Plac Targowy (T-172)
- Status: naprawione w #318 (6.11, 0fc0023; `T-172/pas-parkingu` asfalt, latarnia przed autami, `T-172/chodnik-przy-hali`)
- Ważność: S4 · Zasięg: x 672–726, z 436–448, ok. 100 m² (pas 1,2–1,9 m od jezdni w40050943, klin przy chodniku w227698428, szczelina ok. 5 m² przy (725,4; 437)) · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`; pas (a) asfalt jak jezdnia albo parking, nie kostka; klin (b) kostka chodnika)
- Test przyjęcia: gołe próbki 0,1 m poza budynkami w x 672–727, z 434–449 ≤ 0,5 m² (szwy); parking w227698441, chodnik i jezdnia na wierzchu

### G-350 Gołe podłoże przy al. Tysiąclecia na wschód od Dworca (T-173)
- Status: naprawione w #318 (6.11, 0fc0023; `T-173/chodnik-tysiaclecia-wschod`)
- Ważność: S4 · Zasięg: x 806–872, z ok. 343–360, ok. 470 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: gołe próbki 0,5 m w obszarze ≤ 0,5 m² (szwy)

### G-352 Chodnik przy wschodniej ścianie Bazaru za wąski (T-175)
- Status: naprawione w #318 (6.11, 0fc0023; `T-175/chodnik-przy-bazarze`)
- Ważność: S4 · Zasięg: x 716–721, z 389–413, ok. 30–35 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: kostka od ściany hal ok. 5 m, gołe próbki 0

### G-368 AI nie ściga gracza w metrze (hala, zejście, peron, wejścia A i B)
- Status: naprawione w #316 (6.11, 58f3036; graf poziomów przez wejścia metra, `shaftAt` w `heightApart`, `attach()` z wysokością biegu, strzelec wchodzi na węzeł bez strzału z miejsca postoju; siatka 264 pościgów: 176 → 4 bez wyniku)
- Ważność: S3 · Zasięg: ganger zaalarmowany z ulicy, z hali albo z peronu nie dochodzi do gracza w żadnym z 14 sprawdzonych przypadków · Koszt: średni
- Pakiet właściciela: packages/sim (`systems/ai`, nawigacja przez schody i sklepienia)
- Test przyjęcia: pościg z ulicy do hali i z hali na peron dochodzi do gracza w rozsądnym czasie

### G-371 Hala w otwartym wykopie i ulica wychodzą w `heightApart` 1,0 m od siebie, poniżej `LEVEL_GAP`
- Status: naprawione w #316 (6.11, 58f3036; razem z G-368)
- Ważność: S4 · Zasięg: AI (sniper, steering, ganger-walk) może brać halę i ulicę za jedno piętro · Koszt: mały
- Pakiet właściciela: packages/sim (`world/ground.ts`)

### G-387 Shard e2e (1) na granicy `timeout-minutes: 25`: przygotowanie ok. 11 min, testy 13,6 min
- Status: naprawione w #319 (6.11, 354a1cd; cache przeglądarek Playwright i `.deb` czcionek; do potwierdzenia przy drugim przebiegu: „.deb cache hit: true”)
- Ważność: S2 (blokuje scalanie PR-ów z kodem) · Zasięg: `.github/workflows/ci.yml`, job e2e; instalacja, build i pobranie przeglądarek przed testami (10:40 → 10:51), potem 21 testów jednym workerem · Koszt: średni. Przyczyna z logu #317: `pnpm exec playwright install --with-deps chromium` pobiera przez apt 9 pakietów czcionek (fonts-ipafont-gothic, fonts-wqy-zenhei, fonts-unifont, xfonts-*; 22 MB) z lustra azure.archive.ubuntu.com, tym razem 31 kB/s → 10 min 59 s; biblioteki Chromium są już na runnerze. Propozycja: cache `.deb` czcionek albo `~/.cache/ms-playwright` (`actions/cache`, klucz z wersji Playwright) i `install-deps` tylko dla brakujących pakietów; migawka NPR może zależeć od czcionek, więc nie wyrzucać ich bez sprawdzenia
- Pakiet właściciela: Infra/Build (`.github`), QA (`e2e`)
- Poprawka bez podnoszenia limitu (ADR-0046): skrócić przygotowanie (cache przeglądarek Playwright i builda, build raz i artefakt dla shardów) albo trzeci shard
- Test przyjęcia: oba shardy e2e kończą się z zapasem ≥ 5 min na obecnym main

### G-289 Z dachu Alchemii nie ma bezpiecznego zejścia
- Status: naprawione w #312 (6.11, b65bd52; winda Alchemii na dach z mostkiem i tarasem, bramki do nadproża, podświetlone przyciski; weryfikator i kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: zeskok z 11–13 m kosztuje 48–96 HP; dziś dach nieosiągalny
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-373 Odcinek tunelu peronu metra `kanal` A wchodzi 0,4 m w narożnik kamienicy w67498758 (T-181)
- Status: naprawione w #314 (6.11; `w0` −10 → −9,5, test peronu sprawdza `vaults` co 0,25 m)
- Ważność: S4 (niewidoczne) · Zasięg: 0,81 m² podziemia pod obrysem; test `metro-platform.test.ts` sprawdza tylko `rooms`, nie `vaults` · Koszt: mały (np. `w0` −10 → −9,5 albo krótszy odcinek po tej stronie)
- Pakiet właściciela: packages/sim (`content/metro.ts`), tools/glitch-scan (kontrola `metro-vault-in-building`)
- Test przyjęcia: każdy `vault` każdego peronu ma 0 próbek (co 0,25 m) w `inBuilding`; test rozszerzony na `vaults` pada przed poprawką

### G-376 Job CI „Typecheck, lint, architecture, unit tests” przekracza `timeout-minutes: 20`: same testy z pokryciem trwają 18,6 min
- Status: naprawione w #315 (6.11, 63f2bbd; dwie części testów z raportami blob, progi na scalonym pokryciu; części 5 i 11 min, scalanie z typecheckiem 1,5 min)
- Ważność: S2 (blokuje scalanie każdego PR-a z kodem) · Zasięg: `.github/workflows/ci.yml`, job unit (l. 45), `pnpm test:coverage` 1116 s (testy 57%, import 41%; 452 workery, vitest sugeruje `isolate: false`, ok. 31 s mniej) · Koszt: średni
- Pakiet właściciela: Infra/Build (`.github`, konfiguracja vitest w root), QA (najwolniejsze testy)
- Poprawka bez podnoszenia limitu (CLAUDE.md, ADR-0046): podział przebiegu na części (sharding) albo przyspieszenie (izolacja, najwolniejsze pliki, import ciężkich modułów). Pokrycie łączone z części
- Test przyjęcia: job unit kończy się z zapasem ≥ 5 min na obecnym main; progi pokrycia bez zmian

### G-366 Odmowa zmiany rozdania (respec) przy przekroczonej puli wszczepów nie mówi, że trzeba wyjąć wszczep
- Status: naprawione w #313 (6.11, cd6c93e; respec ponad pulą przechodzi, inne odmowy mówią, co zrobić)
- Ważność: S4 (UI/tekst) · Zasięg: toast „Your body won't take any more…”, przycisk Przebudowy aktywny mimo odmowy · Koszt: mały
- Pakiet właściciela: packages/ui, packages/app (`ShopController`), i18n en/pl

### G-088 Zamkowa zapada się o 3,5 m nad tunelem pieszym przed Zamkiem
- Status: naprawione w #306 (6.11, eb33598; pomost Zamkowej nad tunelem w66258159 z `tunnel-decks.ts`, `road-dip-over-tunnel` 1 → 0; AI: pomost z prześwitem > 2 m jest sufitem, gdy prosta NPC→cel przechodzi pod nim; kurator PRZYJĘTE, kształt: T-178)
- Ważność: S3 (proponowana; dojście do Zamku, obejście 6 m od osi) · Zasięg: lokalny · Koszt: średni
- Gdzie: (781.2, 198.8), Zamkowa w154962966 nad w66258159; T-053
- Dowód: GroundField wzdłuż osi: −12,5 → −15,6 → −12,8 m; steepAt prawda na pasie od −8 do +5 m od osi
- Przyczyna (przypuszczalna): NMT bez konstrukcji nad tunelem; ulica bez pomostu (jak BRIDGE_DECKS), a tunel pomija `underground()`
- Pakiet właściciela: tools/osm-import / packages/sim (pomosty)
- Test przyjęcia: kontrola `road-dip-over-tunnel` 1 → 0 (droga z OSM przecina tunel bez wspólnego węzła, a grunt w ±8 m od przecięcia leży > 1 m pod cięciwą; w mieście 34 przecięcia, następne 0,35 m); pod pomostem przejście w66258159 drożne (G-062)

### G-343 Uciekający cywil przełącza się co krok między dwoma kierunkami przy ścianie (ziarna 3 i 7)
- Status: naprawione w #310 (6.11, c9b13d1; trzymana droga po kursie objazdu, próg zawrotu 5π/6, sonda ciała na `STEP_HEIGHT + 0.05`; skoki w przeglądzie 144 przypadków 1414 → 212; złote hashe zmienione świadomie). Resztki: G-369
- Ważność: S4 · Zasięg: ziarno 7, 1002001, gracz 2 m, ok. (309; −99,5): ściana tuż przy końcu sondy 2,5 m, a objazd „na wprost” prowadzi z powrotem obok gracza (242 skoki); ziarno 3, 1002001/1002003, gracz 1 m, ok. (326; −29): `fleeStep` biegnie na zablokowany punkt 6 m dalej (`steerPoint` oddaje cel, objazd pusty), na zmianę z objazdem przy +π/2 (183/186 skoków). Dopisek 6.11 (weryfikacja #305): także warianty z G-328 w zaułku (ok. 309,5; −97,7): ziarno 43, 1002008, gracz (3; 0): 431 skoków, 1,18 m od gracza; ziarno 11 i 7, 1002001, gracz (2; 0): 352 i 417 skoków; ziarna 3 i 29, 1002002, gracz (0; −2): 380 i 129 skoków. Ślad `fleeTurn`: co krok 0 ↔ −π/4, `null` nie pada. Test przyjęcia: w każdym z tych przypadków po 4 s cywil stoi albo ucieka bez przeskoków co krok
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `fleeStep`, `bendsBack`)

### G-359 Odmowa wrogiej kliniki: „Ammo and basics, nothing more.”, choć Mori nie sprzedaje amunicji
- Status: naprawione w #307 (6.11, d8352bc; klucz `shop.failure.refusedClinic` en/pl)
- Ważność: S4 (tekst) · Zasięg: komunikat odmowy wspólny dla sklepów; klinika potrzebuje własnego wariantu (en i pl) · Koszt: mały
- Pakiet właściciela: packages/ui (i18n `trade`), packages/core (klucz odmowy per sklep)

### G-331 Deszcz pada pod dachem pawilonu metra i w hali biletowej
- Status: naprawione w #303 (6.11, fd4e7be; deszcz i rozbryzgi kończą się pod dachem pawilonu i w hali)
- Ważność: S4 · Zasięg: wszystkie wejścia metra (widać na zrzutach schodów `shots/metro2/`); do etapu 3 ADR-0071 albo osobno
- Pakiet właściciela: packages/engine/src/effects (deszcz)

### G-333 Drobne usterki po etapie 2 metra (#279)
- Status: naprawione w #303 (6.11, fd4e7be; granitowy stopień przed otworem Alchemii B, próg 0,32 → 0,23 m; reszta drobiazgów z #279 w #284)
- Ważność: S4 · Zasięg: kontrola `metro-shaft-open` (`tools/glitch-scan/test/metro-entrances.ts:131-135`) krucha na zaokrąglenie przy próbce na krawędzi (`z <= w.maxZ`), potrzebny epsilon; `cutGround` (`engine/.../ground-cut.ts:94-95`) liczy każdy trójkąt każdej siatki gruntu (106 ms CPU na 20 chunków), wystarczy wcześniej pominąć siatki bez otworu; Alchemia B: przy rogu otworu bruk 0,32 m pod progiem podestu; Nabrzeże A: okap 0,4 m w murze placu Tessen (T-160); niesprawdzone: wróg w pościgu schodzący za graczem do hali
- Pakiet właściciela: tools/glitch-scan, packages/engine (mapcity), packages/sim

### G-337 Północny chodnik al. Tysiąclecia bez nawierzchni (T-165)
- Status: naprawione w #298 (6.11, d0b3a6b; `T-165/chodnik-tysiaclecia` i `T-165/okap-bazaru`, kurator PRZYJĘTE po drugiej rundzie)
- Ważność: S4 · Zasięg: x ok. 640–790, z ok. 362–383, ok. 670 m² na samym x 705–790; przed halami Bazaru rabaty (nie brukować); także x 764–806 przed frontem Dworca (T-165 pkt 1–2): ok. 136 m² między drogą rowerową w1435832523 a ścieżką w227698420 (x 773–803 rabata, nie brukować) i ok. 50 m² między chodnikiem w1435832518 a drogą rowerową (kostka z wiatami)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m w obszarze T-165 poza rabatami; propozycja kontroli `paving-sliver` dla całego miasta

### G-357 `pinned-far-sleep.test.ts` przekracza 20 s pod coverage w CI
- Status: naprawione w #302 (6.11, cf1e8fe; podział na przypadki ze wspólnym przebiegiem, najdłuższy pod coverage 9,2 → 2,9 s). Poboczne: krokowanie z przypiętym daleko strażnikiem ok. 10× droższe, do zbadania
- Ważność: S4 (narzędzia testowe) · Zasięg: „a calm guard whose chunk sleeps stays while he stands in a loaded one…” lokalnie ok. 3 s, plik ok. 30 s także na main; w CI pod coverage 20 s. Wzorzec jak #276 i #295: podzielić test albo zapamiętać wspólny przebieg, limitu nie podnosić
- Pakiet właściciela: packages/sim (test)
- Test przyjęcia: najdłuższy test pliku lokalnie ≤ 1,5 s

### G-349 Próg 0,3–0,4 m na zachodnim przyczółku mostu południowego Mełgiewskiej po G-340
- Status: naprawione w #300 (6.11, 5820de7; teren przyczółków na wysokości pomostu, kontrola `deck-abutment-step` 21 → 12; weryfikator i kurator PRZYJĘTE; reszta progów w G-360)
- Ważność: S3 · Zasięg: pomost w50733068 przedłużony przez `bridge-ends.ts` jest poziomy na NMT końca osi (−25,72), a teren wzdłuż 13-metrowej krawędzi przyczółka opada na południe do −26,0…−26,14; na próbkach 0,5 m to skarpa (`MAX_WALK_SLOPE`, ADR-0043): postać idąca z Andersa na wschód 4,75–6,0 m na południe od osi staje w (2414,2–2414,7; 323,3–324,4); pas aut Andersa#126:0 schodzi z pomostu bokiem ze skokiem 0,17 m. Skan nie ma kontroli progu pomost–teren na przyczółkach; `bridge-ends.test.ts` nie pilnuje warunku węzła wspólnego (przypadek ze wspólnym węzłem bliżej niż 15 m od krawędzi)
- Pakiet właściciela: tools/osm-import (`bridge-ends.ts`), packages/sim (terrain/decks), tools/glitch-scan
- Test przyjęcia: postać przechodzi z Andersa na most na całej szerokości jezdni; kontrola progu pomost–teren na przyczółkach (> 0,25 m) = 0

### G-340 Szczelina 1–2 m między jezdnią a chodnikiem obu mostów Mełgiewskiej (T-167)
- Status: naprawione w #293 (5.11, b7bc879; `bridge-fill.ts` wypełnia obrys mostu, `bridge-ends.ts` przedłuża koniec drogi mostowej do krawędzi obrysu; `deck-slot` i `deck-step-face` 0; próg przy przyczółku w G-349)
- Ważność: S2 (spadek 2,5–5 m z mostu) · Zasięg: 2 mosty Nabrzeża, trasa aut · Koszt: mały–średni
- Gdzie: x 2407–2446, z 243–269 oraz x 2423–2457, z 310–324; ok. 148 m²
- Przyczyna (przypuszczalna): pomosty z szerokości jezdni i chodnika z osobnych dróg OSM, bez wypełnienia obrysem mostu (`man_made=bridge` w1123148473/474)
- Pakiet właściciela: tools/osm-import (pomosty z obrysu `man_made=bridge`)
- Test przyjęcia: kontrola `deck-slot` (punkt poza pomostami z pomostem po obu stronach do 2 m i ziemią ≥ 0,5 m niżej) = 0 poza wnęką T-147

### G-344 Most południowy Mełgiewskiej (w50733068): z jezdni na chodnik postać spada 2,6–4,5 m pod pomost (stopień do 2,05 m)
- Status: naprawione w #293 razem z G-340 (5.11, b7bc879; jezdnia i chodnik mostu południowego w jednym poziomie, 0,09–0,17 m)
- Ważność: S2 · Zasięg: jezdnia opada wzdłuż mostu o ok. 2,2 m, pomost chodnika prawie poziomy; z jezdni na chodnik nie da się wejść, po G-340 w rysowaniu stoi tam szara ściana; w Lublinie oba na jednym poziomie. Docelowo wspólny pomost dla obu dróg mostu (por. G-339, T-166) (T-171). Przyczyna: zachodni węzeł w50733068 ok. 8 m przed przyczółkiem, wysokość z NMT na skarpie. Test przyjęcia: kontrola `deck-step-face` (krawędź pomostu z innym pomostem 0,3 m dalej niższym o > 0,3 m, próbki co 0,5 m) = 0 poza T-147
- Pakiet właściciela: tools/osm-import (pomosty mostów), packages/sim (content/lublin decks)

### G-342 Zaplecze Novy bez nawierzchni (T-169)
- Status: naprawione w #296 (5.11, 31f56ed; `T-169/zaplecze-novy`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: x 726–756, z 428–441, ok. 270 m² · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`; nawierzchnia utwardzona, nie trawa)
- Test przyjęcia: 0 gołych próbek 0,5 m poza budynkami w prostokącie; parking w227698438 i jezdnia w40050943 na wierzchu

### G-341 Gołe pasy wokół Dworca Autobusowego od północy i wschodu (T-168)
- Status: naprawione w #294 (5.11, a5b773f; `T-168/peron-przy-dworcu` i `T-168/chodnik-przy-dworcu`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: x 785–797, z 422–430 (ok. 42 m²) i x 793–808, z 376–428 (ok. 325 m²) · Koszt: mały
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m poza budynkami w obu prostokątach; asfalt stanowisk w66323033 i chodniki zostają na wierzchu

### G-338 Uciekający cywil stoi w miejscu, a kierunek przeskakuje 0 ↔ −π/2
- Status: naprawione w #292 (5.11, c49ab71; `bodyWalk`, sonda ucieczki z szerokością ciała; ziarna 3 i 7 w G-343)
- Ważność: S4 · Zasięg: ziarno 17, przechodzień 1002008, pościg 4 m/s do 2 m, ok. (248,2; −65): sonda 2,5 m pokazuje wolną drogę, a ruch jest zablokowany (242 skoki); także ziarno 3, 1002001/1002003, gracz 1 m, ok. (326,5; −29), 183–186 skoków; ziarno 7, 1002001, gracz 2 m
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system)

### G-336 Pasy gołego podłoża przy Dworcu Autobusowym (T-164)
- Status: naprawione w #291 (5.11, 5f49f0c; `T-164/plac-przy-dworcu` i `T-164/chodnik-novy`, kurator PRZYJĘTE)
- Ważność: S4 · Zasięg: pas między parkingiem w175995587 a chodnikiem w227698423 (ok. 70 m²), plac między chodnikiem a ścianą Dworca w66264171 (ok. 250 m²), pas przy ścianie Novy (ok. 105 m²)
- Pakiet właściciela: tools/osm-import (`ADDED_AREAS`)
- Test przyjęcia: 0 gołych próbek 0,5 m w prostokątach T-164 poza rabatami

### G-330 Pozostałości farby przy pomostach po #275
- Status: naprawione w #290 (5.11, fd3f7ce; linie na końcach mostu na powierzchni, bieg 3 w56965515 na pomoście, `paint-under-deck` z trójkątami na obrysie)
- Ważność: S4 · Zasięg: przy (2446; 245,8) linia krawędzi przechodzi przez obrys pomostu (3 trójkąty, uskok 0,51 m na 0,38 m, niewidoczne); schody przy (732–735; 151–161) przy moście Zamkowej wchodzą pod pomost do 2,54 m pod jezdnią (tak samo na main; `paint-under-deck` pomija trójkąty przecinające obrys, być może celowo)
- Pakiet właściciela: packages/engine (mapcity), tools/glitch-scan

### G-310 Dłonie nie trafiają w szczeble: faza rąk 3,4 rad/m (cykl na 1,85 m) przy szczeblach co 0,3 m
- Status: naprawione w #289 (5.11, 2b87fc7; dłonie trzymają szczeble, faza z wysokości, `CLIMB_SPEED` 1,5 m/s)
- Ważność: S3 · Zasięg: ręce zostają za ciałem i ślizgają się; faza niezwiązana z wysokością; przy 2,2 m/s pełne tempo dałoby ok. 3,7 cyklu/s, więc trzeba zmienić tempo albo prędkość wspinania
- Pakiet właściciela: packages/engine/src/renderer (pozy postaci)

### G-326 Uciekający cywil drga przy objeździe: `steerPoint` przełącza się między drogą prosto a objazdem
- Status: naprawione w #286 (5.11, 9899e16; histereza objazdu `fleeStep`; róg w pościgu zostaje w G-328)
- Ważność: S3 · Zasięg: ziarno 17, −60, przechodzień 1002005, gracz 2 m (25 skoków kąta ok. 0,42 rad) i 1 m (42); `straightWalk` do punktu 6 m przed cywilem raz jest wolny, raz nie; także: w rogu (316; −95) `steerPoint` zawraca „prosto od gracza” niemal wprost na gracza (−1,25 rad), na main przy zatrzymaniu gracza ≥ 2 m ok. 465 skoków; drganie ±0,5 rad w miejscu przy stałym wyborze kierunku (ziarno 23, ok. (262; −81))
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `steerPoint`)

### G-332 Plac przed Dworcem Autobusowym bez nawierzchni: wyjście pawilonu metra na gołe podłoże
- Status: naprawione w #285 (5.11, 662209b; `ADDED_AREAS` `T-162/plac-dworca`, obrys kuratora 428,8 m², testy wycofania i węzłów)
- Ważność: S4 · Zasięg: Podzamcze, x ok. 740–764, z ok. 370–377 (ok. 170 m²), wyjście `targ` B (T-162, T-159)
- Pakiet właściciela: packages/sim (treść `lublin`, ręczna nawierzchnia) albo tools/osm-import

### G-318 Zejście chodem z zachodniego dachu przy `targ-escape-2` przelatuje nad balkonem: upadek 9,1 m na posadzkę targu
- Status: naprawione w #288 (5.11, 375456d; balkon `BALCONY_DEPTH` 3,4 m, zejście chodem ląduje na balkonie)
- Ważność: S3 · Zasięg: `targ-escape-2`, balkon z 64–65,3; przy 4,1 m/s graczka mija balkon i ląduje na posadzce targu; do oceny, czy balkon ma łapać, czy krawędź ma być dalej
- Pakiet właściciela: packages/sim (treść targu, ruch)

### G-335 Zapis w locie gubi prędkość: wczytanie zmienia tor lotu
- Status: naprawione w #287 (5.11, 296ab1d; autozapis czeka na podłogę, ręczny zapis w powietrzu z komunikatem; bez zmiany schematu)
- Ważność: S4 · Zasięg: zapis nie trzyma `fall`, `velocity`, `airPeak`, a `compose.ts:169` nie blokuje zapisu w powietrzu, więc każdy zapis w locie wczytuje się z zerową prędkością; do decyzji: blokować zapis w powietrzu (autozapis „w bezpiecznej chwili”) czy zapisywać stan lotu (zmiana schematu)
- Pakiet właściciela: packages/app (compose, autozapis) albo packages/sim i persistence

### G-313 Wczytanie zapisu z paska dachu przy drabinie stawia graczkę na szczycie drabiny
- Status: naprawione w #281 (5.11, d0d30d7; miejsce po podłodze pod graczką, zasięg `TOP_CATCH_REACH` 0,7 m)
- Ważność: S4 · Zasięg: pasek ok. 0,2 × 0,1 m przy krawędzi nad drabiną (t < 0,5 odcinka linia–wyjście, np. `targ-escape-2` (69,2; 9,1; 63,85–64,05)); bez upadku i straty zdrowia. Teoretycznie z ciałem na ramieniu (ADR-0065) system drabin ją pominie i spadnie. Przesunięcie `resumeOnLadderTop` sięga 0,61 m (`targ-escape-1`), a stały test obejmuje tylko `targ-escape-2`
- Pakiet właściciela: packages/sim (`ladder-system.ts`, `resumeOnLadderTop`)

### G-317 Ucieczka cywila pod ścianą drga: kąt skacze o ±0,8 rad co klatkę
- Status: naprawione w #277 (5.11, 11ca247; histereza `fleeTurn` z `bendsBack`, ściana 23 → 3 skoki, pościg jak na main)
- Ważność: S3 · Zasięg: ucieczka przy ścianie; ziarno 3, −60, przechodzień 1002004, gracz w 2 m: ok. 0,4 s, 24 skoki, bo przełącza się kierunek sondy wolnej drogi
- Pakiet właściciela: packages/sim/src/systems/ai (civilian-ai-system, `runFrom`)

### G-327 Testy „zapis bez ukrytego stanu” na przechodniach z tłumu nic nie dowodzą
- Status: naprawione w #280 (5.11, ae546c8; testy wczytania porównują pola przechodnia; test `flee-wall` z #277 nie ma testu wczytania)
- Ważność: S3 (test) · Zasięg: przechodnie z tłumu (bez `key`) nie są w zapisie ani w `stateHash`, więc hash po wczytaniu zgadza się przy dowolnym ukrytym stanie; przejrzeć testy wczytania w `flee-dead-zone`, `flee-wall`, `reputation-tiers` i podobne; porównywać `yaw` i pozycję konkretnego cywila albo używać cywila z `key`
- Pakiet właściciela: packages/sim (testy)

### G-325 Każda `GameSession` w testach kompiluje ink od nowa (ok. 150 ms)
- Status: naprawione w #282 (5.11, fceb8ae; `loadInk`, kompilacja ink raz na źródło)
- Ważność: S4 (czas testów) · Zasięg: prawie każdy test app; pamięć podręczna skompilowanej historii (`compileInk`) przyspieszyłaby cały zestaw
- Pakiet właściciela: packages/narrative

### G-307 Kioski metra stoją przy zabytkach: Plac Litewski 3,8 m od upamiętnienia Andrzeja Struga, Brama Krakowska 10,8 m od Bramy w murach i 2,1 m od tablicy Ludomira Michała Rogowskiego
- Status: naprawione w #279 (5.11, d5c2440; kioski zastąpione pawilonami ponad 80 m od tablic i 25 m od Bramy, T-154)
- Ważność: S3 · Zasięg: dwie stacje metra; zasłaniają zabytek i stoją w murach Starego Miasta (ADR-0042)
- Pakiet właściciela: packages/sim (treść `lublin`, stacje metra), przegląd `topography-curator`

### G-301 Nakładające się kawałki bruku mają różne drapowania (stopnie 1–3 cm, migotanie głębi)
- Status: naprawione w #275 (5.11, cda5b7a; wspólna siatka drapowania 2,5 m, `drapeY` na powierzchni `surfaceAt`; kontrole `paving-overlap-step`, `paint-under-deck`, `paint-lifted-by-deck` z bazą 0; przy okazji znikają linie wiszące do 20 m nad terenem przy (1055; 162))
- Ważność: S4 · Zasięg: np. dwa `square`; jaśniejsze i ciemniejsze łaty o prostych krawędziach; drzazga 8 cm przy (435,3; −94,6)
- Pakiet właściciela: packages/engine (mapcity/ground-plan)

### G-323 Test `reputation-toasts` na granicy limitu CI: 6,5 s pojedynczo, ok. 20 s pod obciążeniem
- Status: naprawione w #276 (5.11, af5e862; chód 20 s, dokładnie 1 toast; pod pokryciem 6,5–7,0 s)
- Ważność: S3 (test; czerwony CI kosztuje cykl) · Zasięg: `packages/app/test/reputation-toasts.test.ts` „gets one toast…”; także `save-crowd-calm` 10,4 s pod obciążeniem. Przyczyna do ustalenia pomiarem, bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: packages/app (testy)

### G-308 Zejście z dachu na drabinę tylko klawiszem: wejście za krawędź przy drabinie kończy się upadkiem
- Status: naprawione w #273 (5.11, 3e7ca0c; `caughtAtTop` przy zejściu tempem chodu, nigdy w locie po dashu)
- Ważność: S3 · Zasięg: `targ-escape-2` i `targ-escape-3`; upadek z 3,6–4,6 m bez obrażeń, drabina nie łapie
- Pakiet właściciela: packages/sim (ruch, drabiny)

### G-314 Linia metra na mapie przechodzi pod Starym cmentarzem żydowskim
- Status: naprawione w #270 (5.11, 02c7c6d; przebieg al. Tysiąclecia – Kalinowszczyzna – most Lutosławskiego, kontrola `metro-line-protected`)
- Ważność: S3 · Zasięg: lokalny, odcinek `METRO_TUNNEL` (1120; 310) → (1700; 380), ok. 75 m pod w40049437 · Koszt: mały
- Pakiet właściciela: packages/sim (`content/metro.ts`)
- Test przyjęcia: każdy punkt `METRO_TUNNEL` co 5 m poza `PROTECTED_AREAS` i obrysami `historic`/`heritage`/`place_of_worship`; przebieg al. Tysiąclecia – Kalinowszczyzna – most Lutosławskiego (ADR-0071, przegląd kuratora)

### G-315 Możliwe stacje Ogród Saski i Lublin Główny w złym miejscu
- Status: naprawione w #270 (5.11, 02c7c6d; Ogród Saski (−630; −84), Lublin Główny (590; −1840))
- Ważność: S4 · Zasięg: mapa metra · Koszt: mały
- Pakiet właściciela: packages/sim (`content/metro.ts`)
- Test przyjęcia: Ogród Saski (−630; −84) poza obrysem parku i ≤ 30 m od Alej Racławickich; Lublin Główny (590; −1840) ≤ 80 m od w171203532; odgałęzienie z Placu Łokietka ulicami Kozią i Bernardyńską, poza obrysami zabytków

### G-305 Oyaji przy nieufności ma otwarty sklep, ale trzyma się 7 m od gracza (interakcja z 3 m)
- Status: naprawione w #267 (5.11, 8de6c8f; ADR-0070 etap 2, stali mieszkańcy nie odsuwają się z powodu reputacji)
- Ważność: S3 · Zasięg: reputacja −11..−49; w praktyce sklep zamknięty przed progiem odmowy
- Pakiet właściciela: packages/sim (civilian-ai-system)

### G-286 Scalony toast „×N” znika 4,5 s od pierwszego zdarzenia, nie od ostatniego
- Status: naprawione w #265 (5.11, 975fdb2; `expireToast` liczy żywe wpisy, `sameToast` porównuje `keep`)
- Ważność: S4 · Zasięg: każdy scalany toast; identyczne powiadomienie po 4,4 s widać ułamek sekundy; `sameToast` pomija flagę `keep` (dziś teoretyczne)
- Pakiet właściciela: packages/ui (store, toasty)

### G-304 Przy wrogiej postawie Hana kończy rozmowę przed sprawdzeniem kursu od Kaito
- Status: naprawione w #263 (5.11, f3c496d; dostawa od Kaito sprawdzana przed odmową)
- Ważność: S3 · Zasięg: `m4-targ.ink`, knot `hana`; paczki nie da się oddać, kurs przepada z karą −4 u fixerów
- Pakiet właściciela: packages/narrative

### G-306 Blokada kursora zostaje na canvasie po otwarciu menu klawiszem I zaraz po starcie
- Status: naprawione w #264 (5.11, 902d7a5; `wantsLock` i zwalnianie spóźnionej blokady)
- Ważność: S3 · Zasięg: desktop; zgoda na blokadę przychodzi po naciśnięciu I, `releasePointerLock` nic nie robi, bo flaga `locked` jest jeszcze fałszywa; kliknięcia w ekwipunek trafiają w canvas
- Pakiet właściciela: packages/engine/src/input (browser-input) i packages/app (pointer-focus)

### G-293 Plama reflektora niskiego patrolu ma ciemny środek: widać tylko jasny pierścień, miejscami przerwany
- Status: naprawione w #260 (5.11, fbfac59; plama na rysowanym bruku, `drapeHeightAt`)
- Ważność: S3 (proponowana; każdy zawis każdego patrolu, plama ma być jednolitym kręgiem światła) · Zasięg: wszystkie patrole na `high` i `medium` przy zawisie 4,6–7,7 m nad brukiem · Koszt: do ustalenia
- Gdzie: deptak (127,1; −55,0), oko (136; −54) 9,5 m od drona; to samo na zrzutach z drugiego miejsca (`r4-plama-a-*`)
- Dowód: zrzuty `/tmp/claude-0/-home-user-SpinalTap/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/shots/drony-niskie/r4-plama-b-4.7m.png` (pierścień z ciemnym wnętrzem i wcięciem po prawej), `r4-plama-a-6.0m.png`, kolaże `r4-plama-a-kolaz.png` i `r4-plama-b-kolaz.png` (ciemny środek na każdej wysokości 4,7–7,7 m). Jasny pas jest węższy niż zewnętrzna połowa promienia, a wnętrze ma kolor bruku albo ciemniejszy
- Przyczyna (przypuszczalna): nie widać wewnętrznego wachlarza plamy (`withBeam` w `packages/engine/src/renderer/drones/patrol-models.ts`: 32 trójkąty od środka do pierścienia 0,5 z jednym narożnikiem zdublowanym) albo części pasa. Nawinięcie obu części jest zgodne (`GeometrySink.quad` układa je według normalnej UP), cienia drona nie ma (ADR-0058). Do sprawdzenia: głębia lub kolejność rysowania wnętrza względem bruku (`layPool`, `pavingAt`, `POOL_LIFT` 0,02 m), przebieg G-bufora i obrysu w miejscu plamy oraz zostawianie plamy po `POOL_RELAY` przy zmianie slotu
- Pakiet właściciela: packages/engine (renderer/drones, npr)
- Test przyjęcia: zrzut FPP z tego samego oka i czasu (`r4-plama-b-4.7m.json`, t 127,12) pokazuje jednolity jasny krąg bez ciemnego środka i wcięć na wysokościach 4,7–7,7 m; test bez renderera: po `placePool` każdy niezdegenerowany trójkąt plamy leży nad brukiem (y ≥ bruk + `POOL_LIFT` − 1 mm) i ma normalną skierowaną w górę; migawka NPR i budżety bez zmian

### G-299 Wejście frontowe hali Alchemii na cokole 1,23 m bez stopni
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S4 · Zasięg: front zasłonięty bryłą (G-298); model nie rysuje stopni
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-298 Korpus kolizji hali Alchemii wystaje poza ściany modelu
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S3 · Zasięg: z przodu z 5,2–6,1 ok. 0,9 m niewidzialnej ściany nad cokołem, z tyłu z −6,1…−5,54 ok. 0,5 m; także na main
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-297 Niewidzialna ściana na krawędzi podestu hali Alchemii
- Status: naprawione w #259 (5.11, 5470042; bryła hali w narysowanych ścianach, lada, stojak, policzek biegu, balkon, stopnie frontu)
- Ważność: S3 · Zasięg: x 2,24: model rysuje podłogę balkonu 6,64 na zachód (x 1–2,2, z 2,5–4), a kolizja korpusu i skosu dachu (9,9 i 11,51 m) ją zasłania
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-288 Zewnętrzne schody hali Alchemii to pełny prostopadłościan do 7,35 m
- Status: naprawione w #257 (5.11, 3a5b56d; schody hali chodzone do podestu 6,64 m)
- Ważność: S4 · Zasięg: `HALL_PARTS[2]`: widać otwarte stopnie, nie da się wejść, pod biegiem niewidzialna ściana; żaden test nie pilnuje, że części hali nie wystają ponad dach
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-287 Drzwi i witryny stoisk Alchemii wiszą nad brukiem od Świętoduskiej
- Status: naprawione w #257 (5.11, 3a5b56d; stopnie z bruku do każdego stoiska)
- Ważność: S3 · Zasięg: podłoga 1,04–1,24 m nad brukiem przy środku frontu stoisk 2, 3, 5, w rogach do 1,88 m; brak stopni i ramp; `placeAlchemiaModule` stawia moduł na najwyższym punkcie rzutu
- Pakiet właściciela: packages/sim (content/alchemia.ts)

### G-278 Wyszukiwanie pomostu na szwie chunków bierze tylko pierwszy chunk
- Status: naprawione w #256 (5.11, 2ec6e1f; pomosty sąsiadów sięgające granic chunka)
- Ważność: S4 · Zasięg: punkty dokładnie na granicy chunków (np. z = 160 przy wiadukcie Zamkowej): wyszukiwanie pomostu (`decksAt`/most) patrzy tylko w pomosty pierwszego chunka, więc w tych punktach bieg schodów wychodzi bez płyty wiaduktu nad nim · Koszt: mały
- Poprawka: na szwie brać pomosty obu chunków (albo indeks pomostów niezależny od chunka); test w punktach z = granica
- Pakiet właściciela: packages/sim (world/deck)

### G-294 Wróg z podejrzeniem obraca się do gracza, którego nie widzi
- Status: naprawione w #254 (5.11, d695c0e; podejrzliwy wróg obraca się tylko do widzianego gracza)
- Ważność: S3 · Zasięg: każdy niezaalarmowany wróg z podejrzeniem > 0 (`HoldPosition`, `ganger-ai-system.ts:135`, `faceTowards(this, this.seen.player)`); gracz 25 m w bok za ścianą: obrót 1,47 → 0 rad w 0,25 s; powinien patrzeć na ostatnie widziane miejsce
- Pakiet właściciela: packages/sim/src/systems/ai

### G-284 Winda nie działa albo jej nie ma
- Status: naprawione w #312 (6.11, b65bd52; winda Alchemii na dach z mostkiem i tarasem, bramki do nadproża, podświetlone przyciski; weryfikator i kurator PRZYJĘTE)
- Ważność: S3 · Zasięg: winda z treści (estakada, ADR windy z bramkami); do ustalenia, która i gdzie
- Pakiet właściciela: packages/sim i treść lublin; docelowo winda w Alchemii (backlog)

### G-283 Okno dialogowe od razu przewija się w dół i często się scrolluje
- Status: naprawione w #251 (5.11, 5ff20cc; napisy tylko bieżącego kroku w lewym dolnym rogu, historia za przyciskiem, HUD ukryty w rozmowie, strzałka przy przepełnieniu)
- Ważność: S3 · Zasięg: dialogi z NPC
- Pakiet właściciela: packages/ui

### G-282 Karabin Tessen w FPP ma model pistoletu
- Status: naprawione w #253 (5.11, 48c9546; FPP pokazuje model aktywnej broni z własną pozycją; własne modele rewolweru, strzelby i karabinu w pracy)
- Ważność: S3 · Zasięg: widok FPP z karabinem Tessen; możliwe także inne rodzaje broni bez własnego modelu
- Pakiet właściciela: packages/engine (renderer, broń) i assety

### G-274 Skraj wiaduktu Zamkowej nad biegiem w56965515 rysowany, ale bez podłogi: spadek 1,7 m przez bruk (po #233)
- Status: naprawione w #233 (4.11, cfd3a73, razem z G-255)
- Ważność: S2 (proponowana: gracz spada przez widoczną nawierzchnię na trasie Brama Grodzka–Zamek) · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: T-144; pas 1,5–2 m wzdłuż północno-zachodniej krawędzi pomostu w232362907 od (729,0; 157,0) do (733,5; 162,0), `stare-miasto-1-1` i `podzamcze-1-0`, ok. 10 m²; w mieście 1 miejsce
- Dowód: sonda `topo-cross` (przekroje w poprzek osi wiaduktu co 1 m od przyczółka): na 223dedc `groundY` spada z −13,57 na −15,31 między 2,0 a 2,5 m od osi, a `deckAt` obrysu wiaduktu (rysowanego) sięga 4,0 m; uskok 1,74 m (t = 2–5), 1,2 m (t = 6), 0,57 m (t = 7). Siatka 0,5 m: 40 punktów obrysu wiaduktu z gruntem niżej o ponad 0,25 m. Na main 8b8ee07 pomost do 4,0 m bez uskoku. Zrzut autora `shots/g255/tpp-z-dolu.png`: stopnie biegu 2 wchodzą pod płytę pomostu
- Przyczyna: `FLIGHT_DECKS` (`content/lublin/decks.ts`) kładzie pas biegu 3,8 m (`FLIGHT_HALF` 1,9) na osi z OSM, a ta leży ok. 3,9 m od osi wiaduktu, na krawędzi obrysu pomostu (pół szerokości 4 m); `beside` w `deckAt` oddaje bieg stopom w całej części wspólnej, a renderer (`Decks.heightAt`, `planSurface` kawałka mostu) rysuje płytę wiaduktu na całym obrysie i nie stawia fasady na tej krawędzi (sąsiedni pomost biegu)
- Poprawka: pas biegu przy moście przycięty do obrysu pomostu (bieg zaczyna się za krawędzią wiaduktu, jak we wnęce na ortofoto PZGiK) albo przesunięty na zewnątrz o część wspólną; `beside` tylko tam, gdzie pomost biegu jest nad gruntem poza obrysem mostu. Bez zmiany obrysu wiaduktu (zgodny z balustradą na ortofoto)
- Pakiet właściciela: packages/sim (content/lublin/decks.ts, world/deck.ts)
- Test przyjęcia: w obrysie każdego kawałka mostu `groundY` nie leży niżej niż pomost o więcej niż `STEP_HEIGHT` poza przejściami pod mostem (G-062); kontrola skanu `deck-drawn-over-flight` 40 → 0; testy G-255 (`flight-walk`, `flight-chase`) dalej zielone

### G-255 Garb w biegu schodów w56965515 przy pomoście wiaduktu Zamkowej: uskok 2,9 m i bieg pod prąd
- Status: naprawione w #233 (4.11, cfd3a73; 9 rund: wnęka w pomoście wiaduktu T-147, pomost biegu zgodny z rysunkiem, nawigacja NPC z maską krawędzi pomostu przy biegach; kurator: zgodne z uwagami)
- Ważność: S3 (proponowana: uskok 2,9 m w środku schodów, gracz spada albo AI się zatrzymuje) · Zasięg: 1 droga (3 kawałki pasa w dwóch chunkach), możliwe dalsze z kontroli `steps-riser-tall` · Koszt: mały do średniego
- Gdzie: T-131; w56965515 bieg węzeł 2 → 3 (734,1; 163,9) → (729,5; 159,9), Podzamcze/Stare Miasto, granica chunków z = 160
- Dowód: `planSteps` na `groundY` (sonda `topo-g236-flight.txt`, 5757fae): stopnie na pomoście y −13,48 do x ≈ 733,4, potem podstopnica 2,92 m na teren −16,41, dalej stopnie w górę do −15,28 przy węźle 3 (flight ma `incline=down`); kawałek tego biegu w `stare-miasto-1-1` (730,8; 159,6) leży płasko na pomoście −13,51 obok −15,4 za granicą chunka. Stan sprzed #219 identyczny
- Przyczyna: pas biegu 3 m idzie ok. 4 m od osi wiaduktu i częściowo leży w obrysie pomostu, więc `groundY` daje tam pomost (stopnie w kawałku pasa nad nim stoją na pomoście, reguła sufitu G-062 tego nie zmienia), a tuż za krawędzią pomostu interpolowany NMT spod wiaduktu (−16,4..−16,8), niższy od końca biegu
- Poprawka: bieg ze `incline` przy pomoście dostaje rampę od wysokości pomostu na węźle wiaduktu do terenu na końcu (jak `flightRamps`, ale z pomostem jako górą), a schody nie biorą pomostu z `groundY` poza węzłem na wiadukcie; razem z G-062
- Pakiet właściciela: packages/sim (content/lublin: shape, decks), packages/engine (steps-plan)
- Test przyjęcia: profil biegów w56965515 maleje od −13,5 do −17,1 bez podstopnicy ponad 0,3 m; kontrola `steps-riser-tall` (podstopnica `planSteps` na `groundY` > 0,5 m) baza 7 → co najwyżej 6

### G-275 W TPP przy celowaniu z bliska (zwłaszcza w kucaniu) postać zasłania cel
- Status: naprawione w #243 (4.11, 93568a1; FPP: ADS 4 cm niżej i bez podrzutu lufy, zasłonięcie 66–85% → 0%; TPP ramię 0,55 m, zmiana ramienia bez rozjazdu; zgłoszone przez użytkownika)
- Ważność: S3 (zgłoszenie gracza, podstawowa mechanika strzelania) · Zasięg: kamera TPP (`packages/engine/src/camera/camera-rig.ts`: `TPP_DISTANCE` 2,2 m, `TPP_SHOULDER_OFFSET` 0,55 m z `packages/sim/src/world/hitscan.ts`, `TPP_HEIGHT_OFFSET` 0, `TPP_ADS_PULL` 0,45; w kucaniu kamera tylko obniża się z `eyeHeightAt`), cel z przyłożenia i do kilku metrów · Koszt: średni
- Rozwiązania branżowe do połączenia: (1) przy celowaniu i w kucaniu większe przesunięcie przez ramię i lekko w górę (postać ucieka na bok kadru); (2) zmiana ramienia klawiszem/padem (akcja wejścia, i18n, opcje sterowania); (3) przezroczystość albo wzór kropek (dither, pasuje do NPR) postaci, gdy zasłania celownik lub kamera jest blisko; (4) strzał z promienia kamery z poprawką lufy, żeby trafienie było tam, gdzie celownik, przy dużych przesunięciach (hitscan w `sim` już liczy punkt startu z kucaniem: sprawdzić zgodność, bo stałe przesunięcia są w `sim`)
- Pakiet właściciela: packages/engine (camera, npr), packages/sim (hitscan: stałe przesunięć, jeśli się zmieniają; złote hashe), packages/engine/src/input (zmiana ramienia), packages/ui (opcje)
- Test przyjęcia: test kamery bez renderera: w kucaniu z celem 1–3 m przed postacią celownik nie leży w rzucie sylwetki postaci (albo postać jest w tym czasie wygaszona); test trafienia: punkt trafienia = punkt pod celownikiem przy obu ramionach; zrzuty przed/po (stanie, kucanie, cel z bliska, oba ramiona) dla użytkownika; budżety bez wzrostu

### G-280 Dash uruchamia ochronę Tessen (security) w siedzibie Tessen
- Status: naprawione w #249 (4.11, bff2d26; zryw w przebraniu z wagą 0,08 przez odnowienie, pojedynczy nie demaskuje, seria 5–8,5 s wobec sprintu 0,5–1,6 s; decyzja użytkownika, notka w ADR-0033)
- Ważność: S3 · Zasięg: użycie umiejętności Dash na terenie Tessen; prawdopodobnie ruch umiejętności liczony jako wtargnięcie albo atak
- Pakiet właściciela: packages/sim (systemy przestępstw i ochrony)

### G-281 Przy złej reputacji setki powiadomień bez przerwy
- Status: naprawione w #248 (4.11, afa615c; znacznik ucieczki resetowany dopiero 14 m od gracza, scalanie identycznych toastów „×N”, 30 s ciszy dla tej samej reakcji frakcji; 696 → 1 w teście sesji; zgłoszone przez użytkownika)
- Ważność: S2 (proponowana: zalewa ekran) · Zasięg: zła reputacja w mieście; każdy uciekający lub reagujący NPC zdaje się generować własne powiadomienie
- Poprawka: scalanie i limit powiadomień tego samego rodzaju; decyzja o samej panice w backlogu (reputacja)
- Pakiet właściciela: packages/ui (powiadomienia) i packages/sim (źródło zdarzeń)

### G-279 Kamera przechyla się w osi i obrót kręci całym obrazem zamiast postacią
- Status: naprawione w #246 (4.11, 45aad32; `updateUpVectorFromRotation`: wektor „góry” kamery z bieżącego obrotu w każdej klatce; zgłoszone przez użytkownika)
- Ważność: S2 (proponowana: utrata sterowania) · Zasięg: niejasny, „w pewnym momencie” gry; do odtworzenia (ślad, nagranie)
- Pakiet właściciela: packages/engine (camera)

### G-268 Kable przęseł nad ulicą wiszą za nisko, kilka pod ziemią
- Status: naprawione w #244 (2.11, b225f89; runda 2 @ ae0a0f2 PRZYJĘTE; przęsła < 3,45 m: 21 → 0, telefon 5 → 0; kontrola `cable-low` baza 0)
- Ważność: S4 (S3, jeśli kabel przecina przechodniów na wysokości głowy) · Zasięg: 11 przęseł niżej niż 2,5 m nad rysowaną nawierzchnią, m.in. x≈996, z≈568 (do −7,8 m, pod ziemią), x≈520, z≈171 (−2,6 m), x≈634, z≈124 (2,1 m) · Koszt: mały
- Przyczyna (do potwierdzenia): wysokość przęsła liczona od podstawy budynku na zboczu, nie od nawierzchni pod przęsłem
- Poprawka: najniższy punkt przęsła ≥ ok. 3,5 m nad nawierzchnią pod nim (albo przęsło pominięte); kontrola skanu `cable-low` (punkt przęsła < 2,5 m nad nawierzchnią) baza z main → 0
- Pakiet właściciela: packages/engine (renderer/mapcity, `spanCables`)
- Także: na zrzucie dolnej Grodzkiej (x≈615, z≈15) linia na wysokości ramion przechodnia, źródło nieustalone

- Potwierdzone (weryfikator #238): (996; 568) −7,78 m, (996; 569) −6,22, (995; 576) −5,60, (995; 568) −4,41, (520; 171) −2,65, (520; 172) −2,23, (635; 124) 2,12 m; linia na Grodzkiej (615; 15) to nie kabel przęsła (może kable słupów).
### G-270 Drzwi bez widocznych futryn
- Status: naprawione w #241 (2.11, c10b1ab; runda 2 @ d818ffb PRZYJĘTE; zgłoszone przez użytkownika)
- Ważność: S3 (zgłoszenie gracza, wszystkie drzwi miasta) · Zasięg: drzwi na fasadach (ADR-0058 etap 9): ościeżnica i nadproże `DOOR_FRAME` (`packages/engine/src/renderer/mapcity/prop-door.ts`: `side` 0,08 m, `lintel` 0,1 m, `depth` 0,2 m) w tym samym kolorze `FRAME_COLOR` #2a2e36 co ciemne skrzydła, więc z kilku metrów skrzydło i futryna to jedna płaszczyzna; drzwi gry (klinika, Neon Koi, ADR-0038) i wejście pokoju kapsułowego (#234) bez obramowania · Koszt: mały do średniego
- Poprawka: widoczna futryna i opaska: szersza ościeżnica (ok. 0,12–0,15 m) i nadproże, opaska wystająca kilka cm przed lico ściany, kolor kontrastujący ze skrzydłem i ścianą (np. jaśniejszy kamienny/tynkowy dla kamienic, metalowy dla sklepów, z palety kitu), próg; te same reguły dla drzwi gry i otworu pokoju kapsułowego; bez nowych wywołań rysowania (w siatce bloku mebli); drzwi nie mogą przez to wejść w szyby, szyldy ani przejazdy (kontrole `door-*` bez wzrostu)
- Pakiet właściciela: packages/engine (renderer/mapcity, rooms, wnętrza gry)
- Test przyjęcia: test engine: futryna szersza od progu i w kolorze różnym od skrzydła i ściany; zrzuty przed/po (kamienica, sklep, klinika, kapsuła) dla użytkownika; budżety i migawka (świadomie, jeśli drzwi w kadrze)

### G-263 Lampy wnętrz świecą przez ściany na ulicę
- Status: naprawione w #239 (2.11, PRZYJĘTE; prostokąt światła `clip` w shaderze toon, płynna moc 35–45 m; klinika i Neon Koi w G-269; próg drzwi nieoświetlony: drobna uwaga)
- Ważność: S4 · Zasięg: światła punktowe wnętrz (pokój kapsułowy `capsule-room-view.ts` `LAMP` 5,5 m, ok. 2,5 m za fasadą Jezuickiej 14; do sprawdzenia klinika i Neon Koi) · Koszt: mały do średniego
- Dowód: światła punktowe shadera toon nie mają przesłaniania, więc lampa wnętrza oświetla też bruk i fasadę przed budynkiem; przy 45–50 m od pokoju włącza się i wyłącza skokowo (wiązanie z siatką wnętrza)
- Poprawka: światło wnętrza tylko dla siatek wnętrza (`includedOnlyMeshes`) albo zasięg przycięty do pokoju; włączanie z płynnym wygaszaniem
- Pakiet właściciela: packages/engine (renderer, rooms)
- Test przyjęcia: zrzut nocą przed drzwiami z lampą i bez: różnica oświetlenia bruku poza progiem drzwi ≤ próg; test, że lampa nie ma w zasięgu siatek ulicy
- Także (weryfikator): pokój nie jest w `ROOM_SITES` (bez zwolnień w `crowd.test` i `neon-off-wall`; dziś bez skutku); niski element modelu wystaje 0,2 m poza bryłę kuchni
- Także (kurator, T-138): na bruku Jezuickiej plama sięga ok. 2,3 m przed fasadę, a Wieży Trynitarskiej (8,5 m) nie dosięga; poza tym topografia jest zgodna

### G-244 Budynki ceglane z OSM rysowane w tynku: `building:material` nie trafia do gry
- Status: naprawione w #237 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: cegła Baszty, Donżonu i Kaplicy; 19 kolorów ścian z OSM; miedziane hełmy w G-272)
- Ważność: S3 (proponowana: rozpoznawalne zabytki w złym materiale) · Zasięg: 4 budynki (6 elementów OSM z `building:material=brick`): Donżon w450180469, Baszta Gotycka w66286376, Kaplica Trójcy w66258167, Brama Krakowska r7224409 (części w617597406, w617597407) · Koszt: średni (pole w danych + paleta fasady)
- Gdzie: T-134; Podzamcze (893,1; 214,6), (941; 214,6), Stare Miasto (512,6; −143), Krakowskie (472,6; −91,2)
- Dowód: import nie przenosi `building:material` ani `building:colour` (tylko `roof:colour` w części dachów); kolor fasady z palety użycia. Po #209 Donżon i Baszta w jasnym tynku kościelnym (zrzut `g232-shots/g232-donzon-po.png`), przed #209 w szarofioletowym tynku `historic`. W rzeczywistości nietynkowana cegła (Brama Krakowska: cegła w części gotyckiej, tynk w nadbudowie)
- Poprawka: import przenosi `building:material` (brick, stone, plaster) i `building:colour` (11 budynków) do danych budynku i części; fasada bierze z nich kolor ściany przed paletą użycia (cegła: czerwonobrązowa, bez tynku); Brama Krakowska rozdzielona po częściach
- Pakiet właściciela: tools/osm-import, packages/engine (renderer/mapcity)
- Test przyjęcia: budynek z `building:material=brick` ma kolor ściany z rodziny cegły; kontrola skanu `brick-plastered` (budynek lub część z `building:material=brick` w OSM z kolorem ściany z palety tynku) 6 → 0

### G-266 Na pierzei Krakowskiego przy Placu Litewskim styl latarni zmienia się przy x 20 bez oparcia w OSM
- Status: naprawione w #236 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: pastorały na całej pierzei placu, decyzja użytkownika)
- Ważność: S4 · Zasięg: Krakowskie Przedmieście x −87…130 (drogi w598108789 i w40049340 z tagami placu w1054556917, nie deptaka); `lamps.kp-deptak` (pastorały) sięga x 20, choć opis planu mówi „od Kapucyńskiej” (tagi deptaka od x 129,7) · Koszt: mały
- Poprawka (decyzja użytkownika 2.11: pastorały): pastorały na całej pierzei placu od x −87 do Kapucyńskiej (`lamps.kp-deptak` wydłużony na zachód), słupy nowoczesne tylko na alejkach wewnątrz placu; kontrola skanu na później: zmiana stylu latarni na osi jednej drogi OSM o tych samych tagach
- Pakiet właściciela: docs/world (plan), tools/osm-import (props)

### G-264 Latarnie OSM na Archidiakońskiej (Stare Miasto) rysowane jako drogowe
- Status: naprawione w #236 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: latarnie OSM w obrysie Starego Miasta jako pastorały; obrys odcina 22 budynki w G-271)
- Ważność: S4 · Zasięg: 2 latarnie `grodzka.street-lamp` → `lamp-road`: (653,9; 39,3), (653,5; 46,6), przy Placu po Farze, 9,8 i 14,9 m od latarni ściennej · Koszt: mały
- Przyczyna: mapowanie `street-lamp → lamp-road` w `tools/osm-import/src/props-kinds.ts:56` („OSM street lamps away from the old town are road lamps”) nie patrzy na miejsce; na Starym Mieście (decyzja użytkownika 2.11: wiodą latarnie stylizowane) powinny być stylizowane
- Poprawka: `street-lamp` w strefie Starego Miasta → stylizowana (np. latarnia ścienna albo pastorał, styl do potwierdzenia przez kuratora); przegląd `topography-curator`
- Pakiet właściciela: tools/osm-import (props)
- Test przyjęcia: kontrola skanu `lamp-road-in-old-town` (zwykła latarnia w obrysie strefy Starego Miasta) 2 → 0
- Także (kurator, T-141): węzły n5830072379 i n5830072380 (`highway=street_lamp`, `layer=1`, bez tagów typu) są wolnostojące, 5–11 m od osi Archidiakońskiej, daleko od ściany. Styl: latarnia stylizowana wolnostojąca (pastorał albo niska latarenka na słupie) w punkcie OSM, nie kinkiet. Te dwa węzły to jedyne latarnie OSM na Starym Mieście

### G-259 Na deptaku Krakowskiego Przedmieścia nowoczesne słupy stoją 1 m od pastorałów
- Status: naprawione w #235 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: na deptaku same pastorały, słupy nowoczesne tylko na alejkach placu; granica stylu przy x 20 w G-266, Archidiakońska w G-264)
- Ważność: S3 (zgłoszenie gracza: charakterystyczne lubelskie latarnie przy deptaku dublowane fabrycznymi) · Zasięg: 16 par `lamp-modern-pole` + `lamp-pastoral` w `krakowskie-1-0` (x 32..227, z −68..−44), odstęp 0,9–2,7 m; do sprawdzenia 2 × `lamp-road` 6,9 m od pastorału w `krakowskie-2-0` (279,7; −89,3), (362,3; −104,3) · Koszt: mały
- Przyczyna: dwa wpisy planu `docs/world/lublin-props.todo.json` mają te same osie deptaka: `lamps.kp-deptak` (pastorał, x 20..440) i `lamps.plac-litewski` (słup nowoczesny), którego `lines` obejmują też odcinki deptaka x 20..240 (`[129.7,-54.9,82.4,-56.3]`, `[240,-66.5,…,129.7,-54.9]`, `[82.4,-56.3,20,-59.4]`), a nie tylko alejki placu
- Poprawka: na deptaku prowadzą latarnie stylizowane (decyzja użytkownika 2.11): odcinki deptaka zdjęte z `lamps.plac-litewski` (słupy zostają na alejkach i obrysie placu), `count` przeliczony; w generatorze reguła: latarnia zwykła (`lamp-road`, `lamp-modern-pole`) nie staje bliżej niż ok. 8 m od stylizowanej (`lamp-pastoral`, `lamp-candelabra`, `lamp-wall-lantern`) przy tej samej ulicy
- Pakiet właściciela: tools/osm-import (props), docs/world (plan)
- Test przyjęcia: kontrola skanu `lamp-plain-by-styled` (zwykła latarnia bliżej niż 8 m od stylizowanej) baza 16+ → 0; tabela z `pnpm osm:props`

### G-252 Złote hashe i testy nie pilnują terenu Trasy Podziemnej; pad wykopu zależy od rozdzielczości siatki
- Status: naprawione w #230 (2.11, PRZYJĘTE z uwagą: pad w metrach, testy pod stopniami, teren bitowo bez zmian; Rynek przy Trybunale bez testu w G-261)
- Ważność: S3 (luka w testach przy ryzykownym obszarze) · Zasięg: przebiegi `determinism.test.ts` nie przechodzą przez Trasę Podziemną ani Rynek przy Trybunale, więc zmiana kształtu terenu tam nie zmienia hasha; pad Trasy Podziemnej (`sites.ts:159`, blend 0,01) jest ustawiony pod węzły siatki 5 m chunka `stare-miasto-0-0`, każda zmiana komórki (także w imporcie) po cichu przesuwa ściany wykopu
- Poprawka: test „grunt pod stopniami Trasy Podziemnej z zapasem ≥ 1 m pod rampą kolizyjną” i „bruk nie wystaje nad stopnie”; pad niezależny od rozdzielczości siatki (granice w metrach, nie w węzłach)
- Pakiet właściciela: packages/sim (content/lublin)

### G-239 Ciało napastnika po wygranym napadzie znika po odejściu gracza ok. 400 m
- Status: naprawione w #229 (2.11, PRZYJĘTE; ciała wroga bez klucza nie są usypiane z chunkiem; nagromadzenie: najwyżej kilka ciał na 30 min, koszt kroku pomijalny)
- Ważność: S4 · Zasięg: po „won” ciało nie ma klucza, a ma chunk ofiary, więc uśpienie chunka zdejmuje je bez stanu (analogia G-219); tak samo po wczytaniu
- Poprawka: jak G-219 (ciało bez chunku), z oceną nagromadzenia ciał (G-196); test z odejściem 400 m
- Pakiet właściciela: packages/sim (micro-events, streaming)

### G-246 Dach namiotowy wieży cerkwi św. Jozafata za stromy, okap ok. 1,5 m za nisko
- Status: naprawione w #226 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: okap y 8,1, szczyt y 9,5, ostrosłup; przesunięcie obrysu cerkwi w OSM w G-257)
- Ważność: S4 · Zasięg: 1 budynek, w1382552285 (270; −9,2), Krakowskie · Koszt: mały (korekta danych)
- Gdzie: T-129
- Dowód: po #209 ściana 8,1 m (okap y 6,5) i dach namiotowy 3 m (stała importu dla wieży bez dachu w OSM), szczyt y 9,5. NMPT GUGiK 0,5 m: wierzchołek y 9,4 w (269,5; −10), okap ok. y 8,0–8,2 przy krawędziach, czyli ok. 1,4 m dachu (ok. 22°); ortofoto PZGiK: jasny blaszany dach namiotowy, rodzaj zgodny
- Poprawka: korekta w `tools/osm-import/src/corrections.ts` z odsyłaczem T-129: `roof:shape=pyramidal`, `roof:height` 1,4 i `height` tak, by szczyt został y 9,5
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: okap w1382552285 y 8,0 ± 0,5, szczyt y 9,5 ± 0,5

### G-256 Skok debugowy robi migawkę z pominięciem `canSave`
- Status: naprawione w #227 (2.11, PRZYJĘTE; `jump` pyta tę samą bramkę `canSave`; sonda weryfikatora: zapis ręczny w walce z `hebi_ganger` bez rozjazdu przez 300 kroków, strażnicy Tessen i pociski w locie niesprawdzone)
- Ważność: S4 (tylko narzędzie debugowe; gracz tego nie widzi) · Zasięg: `packages/app/src/debug-api.ts:154` (`saves.snapshot()`) · Koszt: mały
- Dowód: po #225 wszystkie ścieżki zapisu gracza (slot, szybki zapis, autozapis, ukrycie strony) idą przez `canSave`, a skok debugowy bierze migawkę bez tej bramki, także w chwycie i w walce; skok z takiej migawki odtwarza rozjazd G-253 i G-240 w testach e2e, które go używają
- Poprawka: debugowa migawka przez tę samą bramkę (odmowa z powodem) albo jawny parametr `force` z ostrzeżeniem w logu
- Pakiet właściciela: packages/app
- Test przyjęcia: test sesji: skok debugowy w chwycie odmawia (albo z `force` ostrzega), poza chwytem działa jak dziś

### G-251 Przybudówka Pałacu Lubomirskich w232805924 ok. 6,5 m za wysoka
- Status: naprawione w #224 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: płaski dach y 4,6 w rundzie 2, przesunięcie obrysów zespołu ok. 1 m opisane w T-137, `building:levels` 2 niepotwierdzone)
- Ważność: S4 (proponowana: przy fasadzie południowej od Placu Litewskiego stoi bryła 4 kondygnacji równa pałacowi zamiast niskiej przybudówki; zasłania parter i pierwsze piętro fasady) · Zasięg: 1 budynek · Koszt: mały (korekta tagów, regeneracja `krakowskie`)
- Gdzie: T-137; w232805924 (57,9; 74,3), teren y −1,4
- Dowód: OSM `building=yes`, `layer=1`, bez `height` i `building:levels`; w grze `source: default`, `height` 13, `levels` 4, wierzch y 11,6 (okap pałacu y 11,0). NMPT GUGiK 0,5 m (`scratchpad/topo-g098/dl-nmpt/lubom.asc`, sonda `scratchpad/topo-g249/topo-probe.py`): p10 y 4,6, p50 y 5,1 (p90 12,7 to ściana pałacu w obrysie)
- Przyczyna: OSM bez wysokości, import daje wartość domyślną dzielnicy
- Poprawka: korekta w `TAG_CORRECTIONS` z odsyłaczem T-137: `height` ok. 6,5 (wierzch y 5,1), `roof:shape=flat`, `building:levels` 1 albo 2 według elewacji. Nazwa z tablicy n12281417452 (węzeł obrysu) to G-065, nie mieszać w jednym commicie
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: wierzch w232805924 y 5,1 ± 1 m i co najmniej 4 m pod okapem pałacu; graffiti przy tej ścianie może wrócić (ściana odsłonięta), sprawdzić tabelę `props.generated.ts`
- Przegląd topografii PR #224 (2.11, @ 8e7db42): ZGODNE Z UWAGAMI, nie blokuje. Dach przybudówki w NMPT jest płaski na y 4,6 (p50 5,1 zawiera ścianę pałacu): zalecane `height` 5,8 i cel testu 4,6; `building:levels` 2 niepotwierdzone (1 równie prawdopodobne); przesunięcie obrysów OSM ok. 1 m to T-136, bez nowego glitcha; `props.generated.ts` aktualny (T-137)

### G-253 Zapis w trakcie obezwładnienia: chwyt poza zapisem
- Status: naprawione w #225 (2.11, PRZYJĘTE; zapis ręczny w chwycie odmawia, autozapis czeka do końca chwytu; migawka debugowa w G-256)
- Ważność: S4 · Zasięg: `session.takedown` nie trafia do migawki, a `canSave` nie blokuje zapisu w chwycie; gra wczytana nie ma chwytu, a gra, z której zapisano, go kończy (rozjazd jak G-240)
- Poprawka: `canSave`/autozapis czeka na koniec chwytu (prościej) albo chwyt w zapisie; test hash po zapisie w chwycie
- Pakiet właściciela: packages/app (save-controller, autosave), packages/sim (takedown)

### G-240 Panika tłumu nie trafia do zapisu: wczytana gra rozjeżdża się zaraz po walce
- Status: naprawione w #221 (2.11, PRZYJĘTE; zapis rozlicza zgłoszenia świadków i uspokaja ulicę w obu grach; chwyt przy zapisie w G-253)
- Ważność: S4 · Zasięg: `crowd.state: fleeing` (np. Hideo po walce) poza zapisem; wczytana gra różni się od gry bez zapisu do uspokojenia tłumu (ok. 12 s)
- Poprawka: stan ucieczki tłumu w migawce encji (zapis + migracja) albo wyliczany z zapisanych zdarzeń; test hash co krok po zapisie w trakcie paniki
- Pakiet właściciela: packages/sim (crowd), packages/persistence

### G-236 Schody z `incline` z OSM wznoszą się w grze w drugą stronę
- Status: naprawione w #219 (2.11, runda 3 @ 5757fae PRZYJĘTE; kurator ZGODNE Z UWAGAMI: korekta w56965515 na `incline=down` słuszna, topologia wiaduktu; T-131 poprawiony; garb pod pomostem w G-255, portal bez stopni w G-229)
- Ważność: S4 · Zasięg: 2 z 48 dróg schodów z `incline` w prostokątach map · Koszt: mały do średniego
- Gdzie: T-131; w56965515 pod wiaduktem Zamkowej (736,8; 161,0) → (727,3; 164,0), Podzamcze/Stare Miasto, brzeg chunka z = 160; w66335060 (603,5; −184,6) → (597,3; −185,3), Stare Miasto
- Dowód: teren gry (`SHAPED_TERRAIN`, bez pomostu wiaduktu) na węzłach w56965515: −15,87, −16,76, −15,33, −17,13 przy OSM `incline=up` (sprostowanie kuratora przy #219: droga zaczyna się na pomoście wiaduktu i schodzi, więc błędny był tag OSM, nie teren); w66335060: −2,70 → −2,30 przy `incline=down`, `step_count=7`. `planSteps` stawia stopnie po terenie, więc przy portalu katedry schody szły w dół tam, gdzie w Lublinie idą w górę
- Przyczyna: NMT pod wiaduktem i przy murach to interpolacja (mosty i obiekty usunięte), a schody nie dostają własnego spadku
- Poprawka: dla biegu z `incline` (i `step_count`) wysokości końców z kierunku OSM: wyrównanie terenu wzdłuż schodów (`RAMPS`/`PADS` z uzasadnieniem w T-131) albo spadek biegu liczony w imporcie; razem z G-229
- Pakiet właściciela: tools/osm-import, packages/sim/src/content/lublin (`sites.ts`), packages/engine (steps-plan)
- Test przyjęcia: teren na końcach każdego biegu z `incline` rośnie w kierunku OSM o ≥ 0,1 m na bieg ze stopniami; kontrola `steps-incline-against` 2 → 0

### G-249 Wieże Pałacu Lubomirskich bez bryły, pałac z wysokości domyślnej 3–4 m za niski
- Status: naprawione w #220 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI; dach pałacu 1,0 m i `building:levels=3` dopisane przez orkiestratora; przybudówka w232805924 w G-251)
- Ważność: S4 (proponowana: dwie wieże ok. 20 m stoją 4–6 m nad dachem pałacu przy Placu Litewskim; bez nich i przy za niskim dachu sylwetka pałacu jest płaska) · Zasięg: 1 budynek, 2 wieże · Koszt: mały (korekty tagów jak w T-060, regeneracja `krakowskie`)
- Gdzie: T-136; w1002739983 (83,5; 99,3), w1002739984 (40,3; 102,7), pałac w67508859 (55,8; 87,4)
- Dowód: NMPT GUGiK 0,5 m (kafel `scratchpad/topo-g098/dl-nmpt/lubom.asc`, środek świata (60; 95), ±45 m; pobrany 2.11): wieża zachodnia x 34–40,5, z 99–106, p50 y 17,8; wschodnia x 78–84,5, z 96–102,5, p50 y 17,9, maks. y 19,0; wierzchy płaskie. Dach pałacu p50 y 11,9 (p10 10,8, p90 14,1), w grze wierzch y 8,5 (`source: default`, `height` 10,6, płaski). Obrysy wież z OSM 2–4 m na wschód od NMPT
- Przyczyna: OSM bez `height` dla wież i pałacu; od #216 wieża `man_made=tower` staje się częścią budynku, ale tylko z korektą wysokości (bez niej kontrola `tower-area-missing` ją liczy)
- Poprawka: korekty w `TAG_CORRECTIONS` z odsyłaczem T-136. Wieże: `height` od podstawy pałacu (y −2,1 i cokół 1 m, czyli y −1,1) ok. 19,0, aby wierzch wypadł na y 17,9, oraz `roof:shape=flat`. Pałac: `height` i `roof:height` z profilu NMPT (okap ok. y 11, wierzch dachu y 12–14). Obrysy zostają z OSM, a przesunięcie 2–4 m to sprawa danych OSM, nie gry
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: `tower-area-missing` 2 → 0; wierzch obu wież y 17,9 ± 1 m; wierzch pałacu w ± 1,5 m od NMPT p50 (y 11,9) w środkowym bloku

### G-098 Wieże zmapowane jako `man_made=tower` bez `building` pominięte
- Status: naprawione w #216 (2.11, PRZYJĘTE; kurator ZGODNE Z UWAGAMI: hełm rysowany czterospadowo zamiast ostrosłupa, cegła, okna; wieże Pałacu Lubomirskich w G-249) · Ważność: S3 (od 2.11, przegląd #198: po G-212 Brygidki nie mają żadnej wieży, a prawdziwa ok. 34 m jest dominantą Narutowicza) · Zasięg: 1 obrys w Krakowskim (dawniej 3; wieże pałacu w G-249) · Koszt: mały–średni
- Wysokość: OSM nie ma `height`; z NMPT wieża Brygidek do y 32,4 (teren y ok. −1,2), w imporcie korekta `height` 31,5 i `roof:height` 9,1 z odsyłaczem T-060
- Uwagi kuratora (S4, nie blokują, T-060): hełm rysowany z kalenicą ok. 1,5 m, a NMPT ma jeden wierzchołek (`roof:shape=pyramidal` w tej samej korekcie); cegła bez `building:material` w OSM (G-244); okna dzwonnicy poza G-245, bo część nie ma `tower: true`
- Gdzie: w1090997970 (wieża Brygidek, 161, −229); T-060
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `tower-area-missing` 3 → 2 (zostają w1002739983 i w1002739984, G-249); szczyt w1090997970 y 32,4 ± 0,5 m

### G-248 „Doktor Mori” po polsku także w angielskiej wersji
- Status: naprawione w #218 (2.11, orkiestrator): `shop.clinic.title` w skanerze, test w `wave1-hud.test.ts`
- Ważność: S4 · Zasięg: `packages/app/src/scan-view.ts:20` `"Doktor Mori"` pokazywany graczowi niezależnie od języka; skan go nie liczy (to nie JSX, a „Doktor” nie ma polskich znaków)
- Poprawka: tytuł z katalogu (en „Doctor Mori”, pl „Doktor Mori”) albo nazwa własna z decyzją w katalogu; przy okazji podglądy deweloperskie (`lublin-preview/preview-main.ts:40`, `props-gallery.ts:32`) bez zmian, gracz ich nie widzi
- Pakiet właściciela: packages/app, packages/ui (i18n)

### G-243 Skan i18n nie łapie polskich słów bez polskich znaków
- Status: naprawione w #214 (2.11, PRZYJĘTE; „ruch” w #213; nowa reguła `shown` znalazła jeszcze 2 teksty, przeniesione do katalogów; reszta luk w G-247)
- Ważność: S4 (luka w narzędziu) · Zasięg: `tools/i18n-scan` liczy literały z polskimi znakami; „ruch” w `touch-controls.tsx` przeszedł, baza była 0
- Poprawka: w JSX liczyć każdy tekst węzła (i `aria-label`, `title`, `placeholder`) poza wywołaniami `t()`, z listą dozwolonych (nazwy własne, symbole); baza z nowej reguły, potem w dół
- Pakiet właściciela: tools/i18n-scan

### G-242 Napastnik po wygranym napadzie zachowuje `ai.victim` w grze, ale nie po wczytaniu
- Status: naprawione w #215 (2.11, PRZYJĘTE; luka: brak testu dla „failed” z ogłuszonym napastnikiem, mutacja „czyść tylko przy won” przeżywa; po „failed” żywy napastnik bez klucza teraz rezygnuje z pościgu)
- Ważność: S4 · Zasięg: `close()` przy „won” nie czyści `ai.victim` (np. `micro:mugging:11:victim`), a zapis tego pola nie trzyma; po przebudzeniu ogłuszonego napastnika `isEngaged` (street.ts:45), `freeToLook` (body-watch-system.ts:31) i `interrupted` (activity.ts:18) różnią się między grą bez wczytania i po wczytaniu (atak na niego jest napaścią tylko po wczytaniu); hash tego nie łapie
- Poprawka: czyścić `ai.victim` w `close()`; test zapis/wczytanie z obudzonym napastnikiem
- Pakiet właściciela: packages/sim (micro-events)

### G-232 Wolnostojące dzwonnice i wieże z `use: historic` rysowane jak kamienice
- Status: naprawione w #209 (2.11, PRZYJĘTE; kurator: ZGODNE Z UWAGAMI, uwagi w G-244 (cegła), G-245 (okna wież), G-246 (dach Jozafata za stromy))
- Ważność: S3 (proponowana: zabytek wygląda jak blok) · Zasięg: dzwonnica św. Mikołaja w680377807, wieża cerkwi św. Jozafata w1382552285 (po G-224 z wysokością z NMPT): rzędy oświetlonych okien i płaski szczyt (zrzut `scratchpad/g224/shots/g224-mikolaj-po.png`)
- Poprawka: budynek z `man_made=tower`/`tower:type=bell_tower` dostaje fasadę wieży (bez okien mieszkań, okna dzwonnicy u góry) i dach namiotowy/hełm; kontrola skanu „wieża z oknami mieszkań”
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import (use)

### G-233 Ciało napastnika mikrozdarzenia niesione na ramieniu znika przy zapisie i wczytaniu
- Status: naprawione w #211 (2.11, zapis v28, PRZYJĘTE): `strayBodies`; ciało niesione w trakcie napadu: zapis zamyka napad jak „left”
- Ważność: S4 · Zasięg: napad (mugging): ciało napastnika niesione przez gracza (`carrying` ustawione) po zapisie i wczytaniu: `carrying` null, 0 ciał. Przed „won” ciało ma klucz `micro:` i odpada w `isMicroKey`, po „won” klucza nie ma i dalej ginie
- Poprawka: ciało napastnika po zakończeniu zdarzenia staje się zwykłym ciałem w zapisie (jak ciała posiłków, G-193); test zapis/wczytanie z niesionym ciałem
- Pakiet właściciela: packages/sim (micro-events, bodies), packages/persistence

### G-216 Kościoły z wysokości domyślnej o 3–15 m za wysokie
- Status: naprawione w #208 (2.11, PRZYJĘTE przez weryfikatora; kurator: ZGODNE Z UWAGAMI, nie blokuje; okap Mikołaja 8,5 zostaje, niższe części obrysu w G-238, wieże proceduralne w G-215): 9 kościołów z NMPT (dach potwierdzony niezależną sondą u wszystkich 9), kontrola `church-over-nmpt` 9 → 0 (w tabeli kontroli dawna nazwa `church-default-height`); kontrola łapie rachunek i domyślne wysokości, nie zły pomiar; do kuratora: okap św. Mikołaja może być 1–1,5 m za wysoko, Świętego Ducha: 16,5 to okap, kalenica 20,4
- Ważność: S3 (proponowana) · Zasięg: szeroki (9 kościołów w trzech dzielnicach) · Koszt: mały (dane)
- Gdzie: T-122 (lista i wysokości)
- Dowód: kalenice w grze przed #208 (`y + height + roof`, `height` zawiera cokół) a kalenice NMPT: Bernardyni 27,7/24,5, Brygidki 27,7/22,0, Świętego Ducha 25,1/20,4 (okap 16,5), Niecała 4 18,0/1,8, św. Jozafata 22,6/11,4, Karmelici 23,0/14,5, św. Piotra 23,3/19,7, św. Mikołaja 21,1/12,5, cerkiew Przemienienia 5,4/−4,3 (T-122)
- Priorytet (kurator, przegląd #207): wyżej, zacząć od św. Jozafata w69916021. Po G-224 wieża (szczyt y 9,5) stoi 6,3 m pod okapem nawy (y 15,8) i 13,1 m pod kalenicą, w rzeczywistości ok. 3,8 m pod szczytem kościoła; bez obniżenia nawy poprawna wieża jest niewidoczna z ulicy. U św. Mikołaja kalenicę mierzyć z dala od koron drzew (por. G-235)
- Przyczyna: `building=church` bez `height` i `building:levels` dostaje 4 kondygnacje i cokół
- Poprawka: korekty `height`/`roof:height` z NMPT w `corrections.ts` (jak G-204)
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `church-over-nmpt` spada z 9 do 0

### G-213 Biegi schodów krótsze niż szerokie rysowane w poprzek
- Status: naprawione w #204 (2.11, runda 3 @ 0995c9d PRZYJĘTE; kurator ZGODNE Z UWAGAMI: każdy pas leży wzdłuż biegu swojej drogi poza znanymi brzegami chunków G-234, uproszczenie usuwa wierzchołki do 4,2 cm; odstępstwa sprzed zmiany T-131 (G-236), T-132 (G-237)): pasy ≥ 0,45 m, kontrola `steps-band-hidden`; bazy `steps-across-run` 1 i `steps-band-hidden` 1 to stan sprzed G-213 na brzegach chunków (G-234)
- Ważność: S4 · Zasięg: 36 ze 121 biegów w mieście jest krótszych niż ich pas 3 m, więc renderer bierze dłuższy bok pasa za kierunek biegu i rysuje stopnie w poprzek (np. w66258166 przy Donżonie, w1312664177)
- Poprawka: zdjąć warunek `w > PATHS.steps` w `flightStrips` (tools/osm-import/src/ground.ts, po #194), żeby każdy bieg krótszy niż szeroki był dzielony na pasy; kontrola skanu „bieg w poprzek”
- Poboczne: wyciąg `krakowskie.json` bez murków (nieaktualny cache kafli, `osm:fetch --only=krakowskie` z siecią); pas bez nawierzchni między brukiem Placu Zamkowego (x ok. 759) a ścieżką w56965514 (x ok. 765)
- Z weryfikacji #194: sąsiednie pasy krótkiego biegu dają stopnie przesunięte w pionie do ok. 0,06 m (`planSteps` próbkuje teren osobno na osi każdego pasa); najkrótszy bieg w1435832499 (1,3 m) wychodzi płaski (rise/count < `MIN_RISER`)
- Pakiet właściciela: tools/osm-import

### G-224 Wieże kościołów z OSM z wysokości domyślnej (wieża cerkwi św. Jozafata; dzwonnica św. Mikołaja w G-235)
- Status: naprawione w #207 (2.11, runda 2 PRZYJĘTE; kurator: ZGODNE Z UWAGAMI): tylko wieża cerkwi św. Jozafata (szczyt y 9,5); dzwonnica św. Mikołaja wydzielona do G-235, nawa Jozafata do G-216
- Ważność: S3 (proponowana; po G-212 to jedyna wieża cerkwi) · Zasięg: 1 wieża (Krakowskie) · Koszt: mały (dane)
- Gdzie: T-129; w1382552285 (270; −9,2), wieża cerkwi św. Jozafata
- Dowód: w grze `source: default`: 13,8 m z cokołem 1 m, szczyt y 12,2; NMPT GUGiK 0,5 m: maks. w obrysie y 9,5 (10,1 w promieniu 4 m od środka to krawędź nawy)
- Przyczyna: OSM ma tylko `building=yes`, `man_made=tower`, `tower:type=bell_tower`, bez `height` i `building:levels`
- Poprawka: korekta `height` 10,1 (nad cokołem) z NMPT w `corrections.ts` z odsyłaczem T-129; to samo dla wieży Brygidek przy G-098
- Pakiet właściciela: tools/osm-import, tools/glitch-scan
- Test przyjęcia: najwyższy wierzchołek bryły w1382552285 (`y + height + roof`) y 9,5 ± 1, `source: height`; kontrola `osm-tower-default-height` z bazą 1 (zostaje w680377807, G-235). Wcześniejsze kryterium „w680377807 y 15,7 ± 1” było błędne (korona drzewa)
- Uwaga kuratora: wieża jest teraz 6,3 m pod okapem nawy w69916021 z wysokości domyślnej (w rzeczywistości 3,8 m pod szczytem kościoła); pełna zgodność dopiero z G-216

### G-231 Mikrozdarzenie: obaj napastnicy powaleni żywcem nie dają wygranej (do potwierdzenia)
- Status: naprawione w #206 (2.11, PRZYJĘTE; potwierdzone prawdziwym `takedown`, ogłuszającym i śmiertelnym; `out()` = brak encji albo `downed`)
- Ważność: S3 (proponowana: brak nagrody za wykonaną akcję) · Zasięg: `runMicroEvent` sprawdza `attackers.every((id) => !byId(…))`, więc powaleni, ale obecni napastnicy nie liczą się jako pokonani; po odejściu gracza „left” bez nagrody i usunięcie powalonych (sonda przez `restoreDowned`)
- Poprawka: pokonany = nieobecny albo powalony; test z prawdziwym takedownem obu
- Pakiet właściciela: packages/sim (micro-events)

### G-219 Powalony żywy posiłek ochrony znika po odejściu gracza ok. 300 m
- Status: naprawione w #203 (2.11, PRZYJĘTE; posiłki bez `chunk` jak ciała, nie są usypiane; sprzątanie powalonych i ciał zostaje w G-196)
- Ważność: S4 · Zasięg: posiłek powalony żywcem ma `chunk: ""`; `chunk-unload` usypia go po chunku, w którym leży, a bez klucza nie zostaje po nim stan, więc znika na zawsze, a `sent` spada do 0 (sonda, ziarno 7: 100 m nadal jest, 300 m już nie, po powrocie brak); pokrewne G-196 (ciała posiłków bez chunku)
- Poprawka: powaleni i ciała posiłków przypisani do chunka, w którym leżą, z zapisem przy uśpieniu i powrotem przy wczytaniu chunka (wtedy `goneReinforcement` z G-209 musi uwzględnić uśpionych, żeby nie płacili XP drugi raz)
- Pakiet właściciela: packages/sim (streaming, reinforcements)

### G-220 Brak testu: powalony, niesiony albo schowany posiłek nie jest „odeszły” dla pamięci hacków
- Status: naprawione w #203 (2.11, PRZYJĘTE; test powalonego, niesionego i schowanego posiłku łapie mutację `filter(!e.downed)`)
- Ważność: S4 (luka w testach) · Zasięg: `goneReinforcement` (`packages/sim/src/world/reinforcements.ts`); mutacja `present` bez powalonych (`filter(!e.downed)`) przechodzi testy G-209, łapie ją tylko sonda weryfikatora
- Poprawka: test, w którym powalony, niesiony i schowany posiłek zostaje w pamięci po zapełnieniu jej odeszłymi (pada z mutacją)
- Pakiet właściciela: packages/sim

### G-197 Drzwi klatek od podwórza: Trasa Podziemna liczona jako ulica
- Status: naprawione w #201 (2.11, PRZYJĘTE przez weryfikatora; kurator: ZGODNE Z UWAGAMI, T-110 poprawione): `undergroundWays` z ekstraktów, kontrola `door-faces-underground` 2 → 0; Złota 6 dostaje drzwi od Złotej; drugie zdjęte drzwi (654,9; 9,0) były na Grodzkiej 7 r3119721, która zostaje bez drzwi (G-227); w66293533 bez drzwi już przed zmianą (G-221)
- Ważność: S4 · Zasięg: 2 drzwi: Złota 6 (667,7; −31,0), Grodzka 7 r3119721 (654,9; 9,0)
- Przyczyna: `facesStreet` w `tools/osm-import/src/props-doors.ts` bierze drogi z `tunnel=yes`, `layer=-1` (Trasa Podziemna, w chunkach zwykły `footway`), więc ściana od podwórza wygląda na ścianę od ulicy
- Poprawka: `facesStreet` pomija drogi z `layer<0` albo `tunnel`; kontrola skanu `door-faces-underground` (baza dziś 2) → 0
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-208 Pamięć utknięcia gangera poza zapisem: posiłki w heacie rozjeżdżają się po wczytaniu
- Status: naprawione w #195 (2.11, zapis v27; runda 2 PRZYJĘTE: strona odchylenia posiłku z `n` nazwana zmianą reguły, walidator `since`/`unstickUntil`, `avoid` do 256 najbliższych; świadomy kompromis: ponad 256 postaci w 8 m da inne obejście po wczytaniu)
- Ważność: S4 · Zasięg: posiłki ochrony w heacie (seed 21 i 5, zapis po 300, 450 i 700 krokach, rozjazd w krokach 209, 59 i 50); `sec2` wciśnięty w `sec1` przy (415,6; −98,9), obejście (unstick) zaczyna się w innym kroku
- Przyczyna: przejściowa pamięć postępu `Progress` w `createGangerAiSystem` (ADR-0025) nie jest komponentem i nie trafia do zapisu
- Poprawka: `Progress` jako komponent z zapisem (nowa wersja zapisu) albo pamięć wyliczana z zapisanego stanu; test zapis–wczytanie dla posiłków w heacie
- Poboczne: `gameOver`, `session.lastThreat`, `player.lastHitBy` (id encji) i `velocity` NPC poza zapisem; stan lotu gracza (`fall`, `airPeak`, `jump`) poza zapisem, więc zapis w powietrzu rozjeżdża się w 1. kroku (weryfikator #185: (2440;545), (490;180), seed 8; pokrewne G-201); walidator przyjmuje `gun.loaded` ponad magazynek i `sniper.perch` spoza tabeli; testy zapisujące martwego gracza porównują stan, którego w grze nie ma
- Pakiet właściciela: packages/sim, packages/persistence

### G-212 Podwójne wieże: proceduralna obok wieży z OSM
- Status: naprawione w #198 (2.11, PRZYJĘTE przez weryfikatora, kurator: ZGODNE Z UWAGAMI, uwagi w T-129/G-224 i G-098): `mappedTower` z OSM i wieże tylko w obrysie; Brygidki bez wieży do G-098, Karmelici Bosi bez wież na trawie
- Ważność: S4 · Zasięg: cerkiew św. Jozafata w69916021 (wieża z OSM w1382552285 przy (270; −9)) i kościół św. Mikołaja w66258180 (dzwonnica z OSM w680377807 przy (879; 545)) dostają dodatkowo proceduralną wieżę (`roof-plan` `addTowers`); Brygidki w66264082: proceduralne wieże, prawdziwa w1090997970 niezaimportowana (G-098)
- Poprawka: `addTowers` pomija kościół, przy którym (w obrysie albo do 10 m) stoi wieża z OSM; rozszerzyć kontrolę `landmark-fake-tower` albo nowa `landmark-double-tower`
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/glitch-scan

### G-203 Schody zamkowe mają 3 m zamiast ok. 10 m szerokości
- Status: naprawione w #194 (2.11, PRZYJĘTE przez weryfikatora i kuratora z uwagami): `correctedLine` z `width=10` dla 5 biegów i 6 podestów, kontrola `steps-narrower-than-walls` baza 0. Uwagi kuratora (ortofoto PZGiK): bieg 2 i bieg 5 przed bramą mają w rzeczywistości ok. 15 m (T-126, G-217); kandelabr (826,2; 235,8) na biegu 5 (T-127, G-205)
- Ważność: S3 (proponowana) · Zasięg: lokalny, ale to oś widokowa Placu Zamkowego · Koszt: mały–średni
- Gdzie: biegi w1435832499, w1305940836, w1305889408, w1305940837, w1306105687, x 766..829, z 238..246
- Dowód: `ground.ts` `PATHS.steps = 3`; murki OSM w231832094 i w231832095 stoją ok. 9,9 m od siebie, na ortofoto PZGiK ok. 11 m; zrzut `zamek-schody`
- Przyczyna: OSM nie ma `width` na biegach; import bierze szerokość domyślną. `TAG_CORRECTIONS` zna tylko obszary, nie linie (to samo potrzebne dla T-050)
- Pakiet właściciela: tools/osm-import (korekta `width` dla linii albo szerokość biegu ze ściskających go murków)
- Test przyjęcia: pas `steps` każdego biegu ma ≥ 9,5 m, a podesty łączą się z biegami bez trawy pomiędzy; kontrola `steps-narrower-than-walls` (baza 1) → 0

### G-209 Cel uploadu `security:<n>` niejednoznaczny przy dwóch posiłkach z tym samym numerem; pamięć hacków 256
- Status: naprawione w #196 (2.11, PRZYJĘTE): część 2 (pamięć hacków) naprawiona przez zapominanie odeszłych posiłków; część 1 nie odtwarza się (`sent` i walidator wykluczają powtórzone `n`)
- Ważność: S4 · Zasięg: gdy żyje powalony posiłek z poprzedniego heatu i nowy posiłek z tym samym `n`, `findTarget` (G-194, `scanner-system.ts`) może trafić w niewłaściwy; `HACKED_MEMORY = 256` (`packages/core/src/progression/progression.ts`): po 256 hackach posiłków (każdy dodaje klucz) najstarsze urządzenia z kluczem wypadają z pamięci i płacą ponownie
- Poprawka: cel uploadu jako `security:<n>@<since>` (klucz z G-202); pamięć hacków osobno dla posiłków albo większa granica z testem; przy balansie (ADR-0059 etap 8) ocenić XP za posiłki w długim heacie
- Pakiet właściciela: packages/sim, packages/core

### G-210 Proceduralna dzwonnica z iglicą na Kaplicy Trójcy
- Status: naprawione w #190 (2.11, PRZYJĘTE; Bernardyni na liście do czasu G-214, bo ich prawdziwa wieża stoi przy południowej ścianie)
- Ważność: S3 (proponowana: fałszywa iglica jest najwyższym akcentem wzgórza zamkowego zamiast Donżonu) · Zasięg: Kaplica w66258167 (941; 214,6), możliwe inne kościoły z listy zabytków bez części i bez `tower` w OSM
- Przyczyna: `packages/engine/src/renderer/mapcity/roof-plan.ts` (`towerSpots`/`addTowers`) dokłada wieżę kościołom bez `building:part`, więc wyłączenie z G-057 nie działa; korona wieży ok. y 19,0, iglica do ok. y 28–30 (Donżon 16,9; prawdziwa Kaplica bez wieży, szczyt zachodni ok. y 16,9)
- Poprawka: bez proceduralnej wieży na zabytkach z `LANDMARK_BUILDINGS` bez `tower` w OSM (albo przepis Z3); kontrola skanu `landmark-fake-tower` (baza ≥ 1); migawka NPR świadomie
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/glitch-scan

### G-211 Teleport (narzędzie zrzutów) na targu i w dokach ląduje we wnętrzu
- Status: niepotwierdzone (2.11, łowca na origin/main 421a10b; do zamknięcia jako odrzucone, nie do odtworzenia)
- Ważność: S4 (gdyby się potwierdziło) · Zasięg: zgłoszone (2689; 247) w dokach i (550; 281) na targu
- Dowód (dane): żaden z dwóch punktów nie leży w żadnym pokoju `INTERIORS` (7 pokoi w 4 wnętrzach: clinic x 318–325, neon-koi x 307–324, trasa-podziemna x 568–585 z ok. -64 do -56, tessen-office x 2530–2542, z 428–438; najbliższy (2689; 247) to Tessen, ok. 190 m dalej; `interiorAt` na y gruntu +0,1 i +1 daje null w obu punktach). Żaden nie leży w obrysie budynku OSM (docki: w173489049 środek 17 m, obrys nie obejmuje punktu; targ: najbliższy w66324547 20,7 m, w66324546 22 m) ani w obszarze set piece (MARKET_AREA x 755–815, DOCKS_AREA x 2520–2594). Wysokość: `groundY` = -22,744 (docki) i -18,44 (targ), `teleport` stawia gracza na `streamer.ground.heightAt` (zrzut JSON: y -22,744, kamera y -21,124), czyli nie pod terenem
- Dowód (zrzuty z gry, `glitch-shots`, yaw 0, pitch 0): docki `/tmp/claude-0/-home-user-SpinalTap/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/g211-shots/g211-docks.png`: plac przy ścianie budynku (ciemna ściana po prawej), z lewej granatowa woda/niecka, żadnego wnętrza; targ `.../g211-market.png`: ulica z zabudową, żadnego wnętrza. Niebieski kadr, który widział weryfikator, to najpewniej woda (docki) lub kadr z innego yaw/y; nie odtworzono
- Kontrola `interior-outside-building` (baza 0, tolerancja 0,3 m) nie ma tu nic do zgłoszenia: żadne wnętrze nie sięga tych punktów
- Do zrobienia: zamknąć jako odrzucone (nie do odtworzenia); jeśli weryfikator ma kadr, niech poda yaw, pitch i y teleportu. Opcjonalnie test przyjęcia na przyszłość (QA): `interiorAt` dla (2689; 247) i (550; 281) na gruncie zwraca null
- Pakiet właściciela: bez (packages/sim ani e2e bez zmian)

### G-180 Zapis po śmierci gracza wczytuje się bez game over
- Status: niepotwierdzone (2.11, naprawiacz): żadna ścieżka w app nie zapisuje martwego gracza (obrażenia przed `deathSystem`, `canSave` odrzuca ekran `dead`, pauza wymaga `inControl`, autozapis wymaga `!gameOver` i hp > 0); strażnik `packages/app/test/death-save.test.ts` w PR #193. Poboczne: import spreparowanego zapisu z hp 0 może dać podwójne `PlayerDied` (walidator mógłby odrzucać hp ≤ 0)
- Ważność: S3 do potwierdzenia · Zasięg: zapis przy hp 0 wczytuje się z `gameOver=false` i drugi raz emituje `PlayerDied`
- Pakiet właściciela: packages/sim, packages/app

### G-201 Teren poza chunkami dostępny: reguła „poza wczytanym chunkiem” usypia strażnika obok gracza
- Status: naprawione w #189 (2.11, PRZYJĘTE): `nearFocus` 30 m w `unloadChunks` i `sleepPinned`, także w chunkach; zostaje osobno: strażnik dalej niż 30 m w obcym chunku znika przy uśpieniu własnego
- Ważność: S4 · Zasięg: obszary bez chunków, a z terenem, np. (2440; 545) na północ od Nabrzeża albo pas x 460–520, z > 160 między Starym Miastem a Podzamczem; żywy gracz stoi tam (hp 96), spokojny przypięty strażnik 6 m od niego znika w 1. s, zaalarmowany po 30 s (`sleepPinned`, G-188)
- Poprawka: odległość od gracza zamiast samej przynależności do chunku albo brak dostępnego terenu poza chunkami; pokrewne: spokojny nieprzypięty strażnik w innym wczytanym chunku znika przy uśpieniu własnego (`standing` w `unloadChunks` tylko dla planów dnia i ciał); `ai.victim` z szablonu nie trafia do zapisu; `goAway()` w `contract-site-cleared.test.ts` stawia gracza poza mapą (testy G-195 z martwym graczem); `keepFormer` bez testu integracyjnego
- Weryfikator #189: próg poza chunkami to 30 m (`loadRadius`), w chunkach praktycznie 44 m (histereza usypiania), więc spokojny strażnik 31 m od gracza poza chunkami znika w jednym kroku; w `micro-events.ts` uśpienie obu napastników zamknęłoby zdarzenie jako „won” z nagrodą (dziś wyklucza to geometria `MICRO_SPOTS`, ale nic tego nie pilnuje)
- Pakiet właściciela: packages/sim (streaming)

### G-202 Posiłki ochrony nie dają XP za quickhack
- Status: naprawione w #187 (2.11, PRZYJĘTE; zapis v26): klucz XP `security:<n>@<since>`, decyzja użytkownika „zgodnie ze standardem”
- Ważność: S4 · Zasięg: `grantQuickhackXp` (`packages/sim/src/world/progression-ops.ts`) zaczyna się od `if (!key) return;`, więc posiłek ochrony (bez klucza) nigdy nie daje XP, a strażnik z kluczem daje raz
- Oczekiwane (standard gatunku, bez farmienia): każdy posiłek daje XP za quickhack raz, także po zapisie i wczytaniu; ten sam posiłek drugi raz nic
- Poprawka: klucz XP posiłku z trwałego numeru (`security:<n>` z G-194) z rozróżnieniem kolejnych heatów, jeśli `n` może się powtórzyć po resecie `sent` (np. numer heatu w kluczu); test jednej sesji i zapisu; złoty hash świadomie, jeśli się zmieni
- Pakiet właściciela: packages/sim

### G-204 Wysokości Kaplicy Trójcy (domyślna) i Donżonu niezgodne z NMPT
- Status: naprawione w #188 (2.11, PRZYJĘTE; kurator: wysokości zgodne z NMPT, korona Donżonu na parapecie 16,9)
- Ważność: S3 (proponowana) · Zasięg: lokalny (sylwetka Zamku) · Koszt: mały
- Gdzie: Kaplica w66258167 (941; 214,6), Donżon w450180469 (893,1; 214,6)
- Dowód: NMPT GUGiK 0,5 m. Kaplica: okap ok. y 7 wobec 9,7 w grze, kalenica y 15,3 wobec 14,1; prezbiterium niższe (kalenica ok. y 11). Donżon: korona ok. y 16,4–16,9 wobec 18,6
- Poprawka: `corrections.ts`: Kaplica `height` 21,6 (ściany 13,3 + dach 8,3, wzór importera: walls = height − min(roof, height/2)), `roof:height` 8,3; Donżon `height` ok. 23,3; prezbiterium Kaplicy jako część w etapie Z3 planu
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `landmark-default-height` (baza 3) spada do 2; okap i kalenica Kaplicy oraz korona Donżonu w danych gry co do 1 m z NMPT

### G-185 Stan strażników kontraktu po wczytaniu (hack w toku, uśpieni)
- Status: (a) naprawione w #185 (1.11, PRZYJĘTE w rundzie 2; zapis v25: broń NPC i stan snajpera w zapisie, laser po wczytaniu w fazie `aim`, walidator naboi); (b) i (c) nie odtwarzają się z żywym graczem (artefakt martwego gracza poza mapą), test `save-load-away-guards.test.ts` pilnuje; (d)/(e) w G-208. Zgłoszenie zamknięte.
- Ważność: S3 · Zasięg: (a) hack w toku: seed 9, zlecenie `hack` przy Genzo, połączenie z `quay_terminal`, zapis 565 kroków po połączeniu: w 1. kroku `c1-g1.cooldown` 2,583 w oryginale i 0 po wczytaniu, gracz hp 6 vs 37, inny `rngState`; zapis po 660 krokach: `c1-g2` po wczytaniu stoi na posterunku (2576; −28,6; 421), w oryginale się rusza; (b) `lost` zaalarmowanego strażnika zapisanego poza chunkiem o 1/60 wyżej (`dormant-restore`; seed 77, 10 kroków po alarmie, teleport Genzo+2000, 120 kroków, zapis); (c) `suspicion` uśpionego strażnika: seed 8, aktywny `infiltrate`, wyjście z doków, zapis, powrót na `docks(0,0,120)` i 5 kroków: `c1-g0.suspicion` 0,0266 vs 0,0183 (d) z weryfikacji #165: zapis w trakcie wymiany ognia rozjeżdża się po ok. 150–210 krokach, z posiłkami i z kluczowanym NPC (courier, seed 21: krok 33 na main i HEAD); zapis gubi m.in. `combatant.loaded`, `bloom`, `velocity`, `session.lastThreat` i przechodniów tłumu; (e) z weryfikacji #172: zapis z żywymi, walczącymi posiłkami w trwającym heacie rozjeżdża się w 9. kroku po wczytaniu, także bez ciał (`rngState`, `hp`, `cooldown` broni; stany w `scratchpad/v-g193-c.json`, `v-g193-d.json`)
- Poprawka: cooldown/stan walki strażników w zapisie albo odtwarzane; `dormant-restore` bez dodatkowego kroku; test zapis–wczytanie dla każdego wariantu
- Pakiet właściciela: packages/sim, packages/persistence

### G-200 Test tabeli rekwizytów blisko limitu 20 s w CI po drzwiach
- Status: naprawione w #183 (1.11, PRZYJĘTE; main czerwony od #167 do #183): przyczyna z profilu: `neighbour` w `cityFrames` przeglądał wszystkie 3662 budynki na próbkę co 10 cm, #167 dodał drugie ramkowanie; poprawka przez `BinIndex` i wczesne odrzucenie w `fits`, tabela bajt w bajt, 9,3 → 3,0 s pod `--coverage`. Poboczne: `determinism.test.ts` „golden run… at every density” 27 s pod load 24–27; `DoorRules.fit` filtruje wszystkie rekwizyty na slot; `cityFrames` liczy szczyt sąsiada z `at.y + height`, renderer z `base + height`: sprawdzone przez orkiestratora, to to samo (`MapCity` wpisuje `base: at.y`, `map-city.ts:125`); różni się za to `heightAt` w `mapBuilding`: `cityFrames` podaje `() => null`, więc `foot` = `base`, a renderer bierze najniższy teren pod obrysem; do sprawdzenia przy G-197/G-198, czy `facadeFrame` zależy od `foot` w miejscach drzwi i szyldów na spadku
- Weryfikator #183: na tym samym hoście 2,7–4,5 s zamiast 9,2–13,5 s; w pełnym `test:coverage` 6,7 s; do obserwacji: `traffic-junction-drive.test.ts` „by Ruska and Lwowska (seed 3)” 17,5 s pod coverage przy load 18 (domyślny limit 20 s?) i „is deterministic…” w props.test.ts 10,3 s
- Ważność: S3 (test, czerwony CI kosztuje cykl) · Zasięg: `tools/osm-import/test/props.test.ts` „matches the committed table” przekroczył 20 s w `test:coverage` na CI (przebieg 714 s zamiast ok. 550 s); lokalnie 3,1–3,2 s przy load 17
- Przyczyna do ustalenia: generator rekwizytów urósł o reguły drzwi (#167) i targu (#153); test przelicza całą tabelę pod pokryciem
- Poprawka: pomiar czasu generacji przed i po #167 (profil), przyspieszenie generatora albo wspólne wyliczenie tabeli dla testów; bez podnoszenia limitu (ADR-0046)
- Pakiet właściciela: tools/osm-import (QA)

### G-194 Quickhack w toku na encji bez klucza trafia po wczytaniu w inną encję
- Status: naprawione w #179 (1.11, PRZYJĘTE): posiłek jako `security:<n>`, inne encje bez klucza przerwane po wczytaniu (`SessionWatch.uploadId`), schemat bez zmian
- Ważność: S4 · Zasięg: `packages/sim/src/systems/scanner-system.ts:94` zapisuje cel jako `#<id>` w `domain.netrun.upload`; po wczytaniu id są przydzielane od nowa (worki z łupem biorą nowe), więc upload trafia w inną encję albo w nic
- Poprawka: cel uploadu przez klucz (np. `security:<n>`) albo odrzucenie uploadu na encji bez klucza przy zapisie
- Pakiet właściciela: packages/sim

### G-188 Zaalarmowani strażnicy zlecenia przypięci w świecie daleko od gracza
- Status: naprawione w #181 (1.11, PRZYJĘTE; zapis v24): `sleepPinned` usypia przypiętych poza wczytanymi chunkami (zaalarmowanych po 30 s), znacznik `away` w zapisie, `dormant-restore` po znaczniku, `keepFormer` przycina szablony
- Ważność: S4 · Zasięg: zaalarmowani strażnicy zleceń (np. c1-g2, c3-g3) zostają przypięci w świecie ponad 4000 ticków, gdy gracz jest 2 km dalej; przez to zastąpione zlecenia trwale siedzą w `formerContracts` zapisu
- Z weryfikacji #175 (G-195): uspokojony przypięty strażnik, którego chunk już śpi, zostaje w świecie do końca sesji, a po wczytaniu znika (sesja i zapis się rozchodzą); `dormant-restore.ts` sprawdza chunk szablonu (`former.chunk`), a nie chunk, w którym strażnik stoi, więc uspokojony strażnik oczyszczonego miejsca w innym, załadowanym chunku znika po wczytaniu na oczach gracza; `StreamCatalog.former` nie jest przycinana i rośnie z każdym wypłaconym zleceniem
- Poprawka: zaalarmowany strażnik daleko od gracza (poza zasięgiem chunków przez N s) uspokaja się i zasypia; test jednej sesji i zapisu
- Pakiet właściciela: packages/sim (streaming, dormant-restore)

### G-199 XP za quickhack na celu bez klucza: możliwe wielokrotne zbieranie
- Status: niepotwierdzone (1.11, sonda naprawiacza): `grantQuickhackXp` zaczyna się od `if (!key) return;`, więc cel bez klucza nigdy nie daje XP (posiłek n=1 hackowany 3 razy i 2 razy po wczytaniu: 0 XP); cele z kluczem płacą raz (`progression.hacked` w zapisie). Do decyzji użytkownika (poza rejestrem): czy posiłki ochrony mają płacić raz, pamięć po `security:<n>`
- Ważność: S4 (proponowana) · Zasięg: `grantQuickhackXp(ctx, target.key)` w `packages/sim/src/systems/scanner-system.ts`; posiłki ochrony i inne cele bez klucza nie mają klucza, więc gra nie zapamiętuje, że cel już dał XP
- Do zrobienia: sonda (ten sam posiłek hackowany kilka razy, także po zapisie i wczytaniu); jeśli XP rośnie za każdym razem, pamięć po `security:<n>` jak w G-194
- Uwaga: po wczytaniu trwający upload jest przerwany w 1. kroku, gdy gracz nie trzyma skanu (zachowanie sprzed G-194)
- Pakiet właściciela: packages/sim

### G-195 Strażnicy wykonanego kontraktu wracają po ponownym wejściu
- Status: naprawione w #175 (1.11, PRZYJĘTE; decyzja użytkownika: „jak w innych grach tego typu”): `clearSite()` przy wypłacie i przy wczytaniu; przegrane jak dotąd; schemat v23 bez migracji
- Ważność: S3 · Zasięg: po wykonaniu kontraktu jego strażnicy odradzają się przy ponownym wejściu w chunk, dopóki miejsce nie dostanie następnego kontraktu (zastąpione zlecenia żyją w `formerContracts`, `packages/sim/src/simulation.ts:98`, `:245`)
- Oczekiwane (wzór gier z gigami i posterunkami): miejsce wykonanego kontraktu zostaje oczyszczone; zabici i obezwładnieni nie wracają, ocaleni odchodzą przy wyjściu gracza z zasięgu; nowi strażnicy pojawiają się tylko z następnym kontraktem w tym miejscu; ciała znikają po wyjściu z zasięgu chunków
- Poprawka: strażnicy wykonanego kontraktu nie trafiają do `formerContracts` przy uśpieniu (albo wpis oznaczony jako oczyszczony); test jednej sesji (wyjście i powrót) i zapisu; złoty hash zmieni się świadomie; razem z G-188 (ten sam mechanizm uśpienia)
- Pakiet właściciela: packages/sim (streaming, contracts), packages/persistence

### G-183 Skan latarni ściennych nie widzi przejść spoza `building_passage`
- Status: naprawione w #168 (1.11, PRZYJĘTE w rundzie 2): kontrola `wall-lantern-by-passage` (baza 0) i `Site.nearPassage` przycinają oś `GATE_PASSAGES` do sklepienia; tabela rozstawienia bez zmian (runda 1 była fałszywym alarmem). Poboczne: skan pomija przejścia bez obrysu `p.building`
- Ważność: S4 (narzędzie) · Zasięg: `wall-lantern-in-building` bierze osie tylko z `tunnel=building_passage`; przejście Gruella pod Wieżą Trynitarską (w298307007, `tunnel=yes`, `layer=-1`) i ręczne bramy `GATE_PASSAGES` pilnuje tylko generator (`Site.nearPassage` zna przejazdy chunków, nie zna `GATE_PASSAGES`); dziś 0 trafień
- Poprawka: kontrola „latarnia ścienna bliżej niż 2 m od osi przejścia z danych gry” (`PASSAGES` i `GATE_PASSAGES`, odcinek przycięty do końców), baza 0; `nearPassage` także dla `GATE_PASSAGES`. Uwaga: pas wokół `tunnel=yes|covered=yes` z OSM łapie Trasę Podziemną (w293370650), więc nie z OSM
- Pakiet właściciela: tools/glitch-scan, tools/osm-import

### G-193 Zwłoki posiłku ochrony znikają po wczytaniu
- Status: naprawione w #172 (1.11, PRZYJĘTE): `corpseOf` zachowuje `security`, zapis obejmuje ciała posiłków, `crime-system` liczy tylko żywych; schemat v23 bez zmian
- Ważność: S3 · Zasięg: posiłek zabity po powaleniu albo w trakcie obalenia zostawia ciało bez klucza i bez `security` (`corpseOf`, `packages/sim/src/world/bodies.ts:64`); ciało nie trafia ani do `entities`, ani do `reinforcements`, więc po wczytaniu nie ma go do znalezienia ani zgłoszenia
- Poprawka: zwłoki posiłków w zapisie (z `n`) albo `corpseOf` przenosi klucz `security:<n>`; test zapis–wczytanie
- Pakiet właściciela: packages/sim, packages/persistence

### G-148 Szyldy i neony wcięte w fasady (parasol)
- Status: zamknięte (1.11, orkiestrator): G-157, G-158, G-159 i G-160 naprawione (w archiwum), a kontrole `venue-board-in-neighbour`, `banner-in-neighbour`, `holo-or-blade-in-neighbour` i `wall-lantern-over-venue-board` mają w main bazę 0 (wcześniej 7, 31, 4, 17); zostaje osobno G-161 (markiza nad literami)
- Ważność: S3 · Zasięg: całe miasto, najgęściej Stare Miasto
- Pomiar w całym mieście (660 budynków, 319 tablic lokali): 7 tablic lokali w sąsiedzie (G-159), 31 banerów `canyon-signs`, 3 holo i 1 `blade` w sąsiedzie (G-157), 17 latarni ściennych na tablicach (G-158), płyta „DEN…” o nieznanym źródle (G-160), markiza zasłaniająca dolny rząd liter z oczu gracza (G-161)
- Dowód: zrzuty `scratchpad/g148-shots/` (g148-e/f/h/j przy OKRUSZEK, g148-k przy STAJNIA SMAKU, g148-r2/r4 na Rynku), pomiary `scratchpad/g148-measure.json`, `g148-venue.json`
- Proponowane kontrole skanu (baza dziś): `venue-board-in-neighbour` 7, `banner-in-neighbour` 31, `holo-or-blade-in-neighbour` 4, `wall-lantern-over-venue-board` 17
- Pakiet właściciela: packages/engine (renderer/mapcity), tools/osm-import

### G-043 Zatwierdzona migawka NPR nie zgadza się z tym, co rysuje main
- Status: zamknięte (1.11, orkiestrator): migawka przepisana od zgłoszenia co najmniej 5 razy (ostatnio #153); na main 1592dab `npr-perf` „reference” z `maxDiffPixelRatio: 0` (próg piksela 0,2) przechodzi 2/2, więc klatka main zgadza się z migawką; tolerancja 0,02 zostaje jako zapas na SwiftShader
- Ważność: S3 (proponowana: migawka przestaje pilnować wyglądu) · Koszt: mały
- Dowód: naprawiacz i weryfikator G-030: `e2e/__snapshots__/npr-perf.spec.ts/reference-m0.png` różni się od deterministycznej klatki main (b5507ce) o 39 806 px poza Seki (bbox 0,0–1280,533); m.in. brak białej smugi odblasku na lewym oknie Neon Koi (y ok. 290). Test przechodzi tylko dzięki `maxDiffPixelRatio: 0.02`. Ustalić, który commit zmienił klatkę: regresja czy niezaktualizowana migawka.
- Pakiet właściciela: packages/engine / e2e (QA)

### G-179 Posiłki ochrony przy heacie poza zapisem
- Status: naprawione (1.11, #165: zapis v23 z `reinforcements`, `watch.sent`, rozrzut i enforcer z `n` zamiast id; złote hashe tylko przez posiłki w zapisie; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: encje `security` bez klucza i `session.watch.reinforce` nie wchodzą do zapisu; `stateHash` nie widzi encji bez klucza
- Dane: alleySim seed 21, `heat {level 2, faction hebi, lastKnown ALLEY_START}`, krok do pojawienia się posiłków i 30 dalej, zapis: oryginał 1 posiłek, `reinforce=3.5`; wczytana gra 0 i od razu nowy gdzie indziej; rozjazd w 130. kroku
- Pakiet właściciela: packages/sim, packages/persistence

### G-189 Radziwiłłowska: jedno auto na sześć miejsc postojowych
- Status: naprawione (1.11, #162: ulga za krawężnikiem tylko dla mebli, pełny odstęp od chodnika, krótszy model w zatoce; `bay-strip-sparse` 1 → 0; `PARKED_CARS` 72 → 80; dwie rundy weryfikacji, kurator ZGODNE Z UWAGAMI, T-102..T-104, T-107, T-108)
- Ważność: S4 · Zasięg: w883991779 ma 1 auto na 6 stanowisk; bay s=36 odrzuca `furnitureClearance` 0,75 m przy nosie (mebel w obrysie pasa), s=39 `clearOfKeptWays` (ścieżka w obrysie), s=30 i 33 pomija hash zajętości 0,8
- Poprawka: sprawdzić mebel i ścieżkę w obrysie postoju (czy to błąd danych gry, czy OSM); ewentualnie meble poza obrysem pasa postojowego
- Uwagi: kontrola `bay-car-orientation` bierze kierunek pasa z najdłuższej krawędzi obrysu, w Ciasnej w227679486 ta krawędź biegnie w poprzek ulicy (kontrola słaba); dla pasa bez tagu łapie tylko auta > 75°
- Z weryfikacji #158: skan i generator mają różne reguły dla pasa ≥ 4,5 m bez tagu (skan liczy auto w poprzek jako znalezisko, generator cofa się do układu w poprzek, gdy skośny się nie mieści); auto Ciasnej (628,96; 551,62) stoi pod 2,4° do najbliższej ulicy z ruchem aut; fallback `perpendicular` chroni tylko test jednostkowy `bayLayouts`
- Kurator #158: mebel (parkometr n9596788047) i chodnik o szerokości 2,5 m są prawdziwe i stoją za krawędzią pasa; w Lublinie zajęte są wszystkie 6 zatok; poprawka przez marginesy (np. przy nosie jak `KERB_GAP` dla mebla i chodnika poza obrysem), bez usuwania danych (T-104). Proponowana kontrola: pas OSM ≥ 15 m, mniej niż 50% zatok możliwych przy `BAY_STEP` po odjęciu hasha zajętości, odrzucenia tylko przez mebel lub chodnik spoza obrysu (baza ok. 1)
- Pakiet właściciela: packages/sim (parked-cars, kerb-bays), tools/glitch-scan

### G-160 Neon DENKI (i KARAOKE, SAKE) osiowy na ukośnej ścianie: koniec w murze, koniec w powietrzu
- Status: naprawione (1.11, #161: oś bliższa ścianie, płyty 0,55 m pionowo 0,16 m od ściany, SAKE z narożnika na płaski odcinek; `neon-off-wall` z częścią płyty w bryle ≤ 15%, 3 → 0; dwie rundy weryfikacji). Opcja B (`yaw` w widoku `neon`, ADR) dla szerszych płyt na skośnych ścianach zostaje do decyzji
- Ważność: S3 · Zasięg: lokalny (Rynek/Grodzka, trasa kanału Tetsu, widoczne z deptaka) · Koszt: mały
- Gdzie: DENKI (567,3; −24,9) y 4,1, odsunięcie końca od ściany 1,95 m; KARAOKE (554,0; −33,8) 2,41 m; SAKE (545,0; −74,0) 0,45 m; w mieście 3 z 8 neonów przy ścianach
- Dowód: kąt osi płyty do stycznej ściany 51°/53°/46°; zrzuty `scratchpad/g160-shots/g160-h.png`, `g160-i.png`
- Przyczyna: `facadeNeon()` (`packages/sim/src/content/district-kanal.ts`) zamienia `againstWall().yaw` na `facing` o jednej z czterech osi; widok `neon` (`packages/core/src/ports/types.ts:195`) nie ma obrotu, a ściana jest ukośna
- Poprawka: A (teraz) dane: przestawić albo skrócić trzy neony na płaski odcinek ściany; B (później, ADR) opcjonalny `yaw` w widoku `neon`
- Test przyjęcia: kontrola skanu `neon-off-wall` (baza 3 → 0)
- Pakiet właściciela: packages/sim (district-kanal.ts), tools/glitch-scan

### G-187 Auta w głębokich pasach postojowych bez `orientation` w poprzek zamiast skośnie
- Status: naprawione (1.11, #158: pod 60°, rozstaw 3,0 m, nosem do chodnika; `PARKED_CARS` 75 → 72; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-103 poprawione, T-104)
- Ważność: S4 · Zasięg: 2 pasy: Krakowskie Przedmieście w55897048 (15 aut, w rzeczywistości ok. 60°), Radziwiłłowska w883991779 (1 auto, w rzeczywistości 6 miejsc ok. 65–70°), nosem do chodnika (ortofoto PZGiK)
- Poprawka (do wyboru): (a) domyślny układ dla obrysu ≥ 4,5 m bez tagu `diagonal`; (b) kąt `diagonal` parametrem (60° zamiast 45°); (c) tabela `KERB_ORIENTATION` w `sites.ts` ze źródłem albo `orientation=diagonal` w OSM i ponowny import; z (c) kontrola „auto poza ±20° od kąta z tabeli”, baza 0
- Uwagi z weryfikacji #152: test pasa bez tagu nie sprawdza, że pas płytszy niż 4,5 m trzyma auta wzdłuż; układ `diagonal` nie ma auta na danych (tylko test `bayYaw`); kierunek auta na Ruskiej (963,8; 473,0) ze stycznej osi zamiast krawędzi obrysu (4–7°); `offKerbParks` zagęszcza punkty trasy przy przesunięciach kilku cm (18 → 604); `clearRun` odrzuca odsunięty odcinek krakowskie-2-1-square-1, przyczyna nieustalona
- Pakiet właściciela: packages/sim (kerb-bays.ts, crowd-kerb-parks.ts)

### G-178 Strażnicy nieudanej infiltracji znikają po wczytaniu
- Status: naprawione (1.11, #150: `endedContract` i `formerContracts` w zapisie v22, `completed` z chwili rejestracji, czyszczenie zastąpionych zleceń, unikalność id; trzy rundy weryfikacji). Otwarta decyzja projektowa użytkownika: szablony zakończonego zlecenia respawnują nietkniętych strażników przy ponownym wejściu na teren, aż do następnego zlecenia (tak było przed poprawką)
- Ważność: S2 (zapis pozwala uciec z walki) · Zasięg: kontrakt infiltrate zakończony alarmem (`contracts.active` null), strażnicy `c3-*` (5 encji) dalej walczą; po wczytaniu ich nie ma
- Dane: seed 77, `completed: 2`, gracz w `docks(6,0,110)`, 30 kroków, `accept-contract infiltrate`, teleport 6 m przed `c3-g1`, kroki do alarmu i 60 dalej, zapis; w 1. kroku oryginał: gracz ginie (hp 0), wczytana gra: hp 84
- Przyczyna: konstruktor `Simulation` rejestruje kontrakt tylko przy `status==="active" || hasAmbush`
- Pakiet właściciela: packages/sim, packages/persistence

### G-182 `MapEntries.neighboursNear` bez własnego testu
- Status: naprawione (1.11, #155: test na prawdziwym `MapEntries`, pada przy zawężonym zapytaniu indeksu)
- Ważność: S4 (test) · Zasięg: skan i test jednostkowy G-170 używają kopii logiki odsiania, więc ścieżki gry (`map-entries.ts`) nic nie pilnuje; dziś poprawna (sonda: 7298 czworokątów identycznych z `near` i bez)
- Poprawka: test `neighboursNear` na prawdziwym `MapEntries` (sąsiad na granicy komórek, ściana skośna, sąsiad wyższą częścią)
- Pakiet właściciela: packages/engine (mapcity)

### G-177 Auta na pasach postojowych OSM równolegle na środku głębokości obrysu
- Status: naprawione (1.11, #152: auta przy krawężniku i w poprzek, tłum 1 m od pasów; kontrole `bay-car-out-of-park` 1 → 0, `bay-car-orientation` 1 → 0, `crowd-lane-on-parking` 3 → 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102, T-103)
- Ważność: S4 · Zasięg: auta z `bayCars` (`tools/osm-import/src/parked-cars.ts`): Kowalska w232362980 (683,7; 161,0) odsunięta 0,8 m ku jezdni (narożniki 0,31 i 0,56 m poza obrysem), bo trasa tłumu `stare-miasto-1-1-square-2` biegnie po krawężniku pasa; obrysy 4,7–8 m głębokości (Ruska w1024029951, Radziwiłłowska w883991779, Ciasna w227679486) i Kalinowszczyzna w1000912163 (`orientation=perpendicular`, 4–5 miejsc) mają po jednym aucie równolegle
- Poprawka: auto przy zewnętrznej krawędzi obrysu (krawężnik), w obrysie ≥4,5 m albo z `orientation=perpendicular|diagonal` w poprzek (tag `orientation` do `CarParkOut`); trasa tłumu na osi chodnika w173566577; kontrole skanu `bay-car-out-of-park` (baza 1), `bay-car-orientation` (baza 1), `crowd-lane-on-parking`
- Uwaga: `offMultiLaneKerbs` nie patrzy na stronę ulicy; na drogach 1+2 (Krakowskie w154962958, Lubartowska, Radziwiłłowska w331453920) wyklucza też krawężnik od strony jednego pasa; dziś bez skutku
- Pakiet właściciela: tools/osm-import, packages/sim (crowd), tools/glitch-scan

### G-184 Szkielety modeli przybywają przy każdym cyklu nowa gra / clear
- Status: naprawione (1.11, #151: szkielet postaci proceduralnej zwalniany z rigiem; szkielety po clear 34/43/52/61 → 25 stale; pula VRM zamierzona, ograniczona szczytem jednoczesnych postaci; weryfikacja PRZYJĘTE)
- Ważność: S3 do potwierdzenia (możliwy wyciek pamięci) · Zasięg: liczba szkieletów w scenie rośnie o 12 na cykl newGame/clear (67 → 79) na NullEngine z modelami VRM; sprawdzić, czy to zamierzona pula
- Poprawka: dispose szkieletów postaci przy clear (`CharacterViews`) albo udokumentowana pula; test sesji: dwa cykle, ta sama liczba szkieletów
- Pakiet właściciela: packages/engine (renderer)

### G-173 Latarnie ścienne w przejazdach bramnych i szczelinach
- Status: naprawione (1.11, #147: kontrola `wall-lantern-in-building` 4 → 0, rozstawienie 3774 → 3770, 1 latarnia przesunięta przy Wieży Trynitarskiej; piąta zgłoszona (Grodzka 20, (653,4; 80,8)) wisi przed fasadą, szczeliny w danych nie ma; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI)
- Ważność: S4 · Zasięg: 5 latarni: przejazd Bramy Krakowskiej (475,2; −90,1), Bramy Grodzkiej (713,5; 138,9), (718,6; 144,5), Ku Farze pod Grodzką 14 (621,8; 40,4), szczelina Grodzka 18/20 (653,4; 80,8); 4 były przed #137, (621,8; 40,4) wróciła w #137 przez odstęp od przesuniętej sąsiadki
- Przyczyna: linia planu `lamps.stare-miasto-wall` (rozstaw 15 m) stawia latarnie na osi dróg `tunnel=building_passage`; głowica 3,1–4,5 m wchodzi w sklepienie (4–4,2 m); `furniture-in-building` pomija `lamp-wall-lantern`
- Poprawka: linia planu nie stawia latarni ściennej w obrysie budynku ani w pasie 2 m wokół osi `building_passage`; kontrola skanu `wall-lantern-in-building` (baza 4 → 0); przy okazji latarnia KUCHNI POD KOPYTEM może przejść na sąsiednią ścianę Grodzkiej 20
- Pakiet właściciela: tools/osm-import, tools/glitch-scan

### G-170 Neonowe rurki pod gzymsem wchodzą w sąsiednie budynki
- Status: naprawione (1.11, #148: rurki tylko na wolnych odcinkach ściany, odsianie sąsiadów; skan `tube-in-neighbour` 65 → 0; weryfikacja PRZYJĘTE)
- Ważność: S4 · Zasięg: 58 rurek w 49 budynkach (`tubes` w `sign-plan.ts`), w większości ukryte w bryle sąsiada
- Poprawka: rurka kończy się przed sąsiadem wystającym przed ścianę (to samo `sign-room` co banery z G-157); kontrola skanu z bazą
- Pakiet właściciela: packages/engine (sign-plan.ts)

### G-174 Zapis i wczytanie nie odtwarzają stanu przy kontrakcie infiltrate
- Status: naprawione (1.11, #145: `ai.suspicion` w zapisie v21, pola pochodne sesji odtwarzane przez `resumeSession`; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: każdy aktywny kontrakt infiltrate przy strażnikach z widzeniem stożkowym, nie tylko `time_limit`; bez kontraktu rozjazdu nie ma
- Dane: `Simulation.create({ seed: 4242 })`, `fromSnapshot` z `contracts: { active: null, completed: 5 }` (albo 0), `teleportPlayer(sim, docks(0, 0, 120))`, 30 kroków, `accept-contract infiltrate`, 1 krok, zapis i `fromSnapshot`, oba przebiegi krokowane razem: hash równy zaraz po wczytaniu, rozjazd w 42. kroku (`rngState`, strażnicy c6-g* zaalarmowani tylko w oryginale)
- Przyczyna: `ai.suspicion` (np. c6-g3 = 0,0229) i `ai.sees` nie wchodzą do zapisu, po wczytaniu podejrzliwość startuje od 0; różnią się też pola sesji `watch`, `street2`, `interior`
- Poprawka: podejrzliwość i widzenie strażników (oraz brakujące pola sesji) w zapisie albo świadoma decyzja, że wczytanie zeruje czujność; zmiana schematu z migracją; test zapis–wczytanie z tym scenariuszem
- Pakiet właściciela: packages/sim, packages/persistence

### G-155 Auta przy krawężniku na ulicach wielopasowych bez parkowania
- Status: naprawione (1.11, #143: kontrola skanu do 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102 i G-177)
- Ważność: S4 · Zasięg: 3 Maja w40050974/w757848901 (x −116..−103, z −33..32): 13 aut 4,1–5,4 m od osi, na skrajnych pasach (`lanes=4`, brak `parking:*`)
- Poprawka: bez parkowania przy krawężniku dróg z `lanes>=4` albo `lanes:forward|backward>=2` poza `amenity=parking`; kontrola skanu `parked-car-multilane-kerb`, baza 13 → 0
- Pakiet właściciela: packages/sim (parked-cars), tools/glitch-scan

### G-156 Auta na przystankach
- Status: naprawione (1.11, #143: kontrola skanu do 0; weryfikacja PRZYJĘTE, kurator ZGODNE Z UWAGAMI, T-102 i G-177)
- Ważność: S4 · Zasięg: przystanek „Plac Litewski 02” (słupek n836158674 (−100.3, 3.6)): van 0,7 m, van 11,7 m, hatchback 13,1 m od słupka po stronie przystanku
- Poprawka: zakaz postoju do 15 m od słupka (art. 49 PoRD); kontrola skanu `parked-car-at-bus-stop`, baza 3 → 0; przy okazji `path=sidewalk` poza `footWays` i `pedestrian`/`cycleway` w `parked-car-on-footway`
- Pakiet właściciela: packages/sim (parked-cars), tools/osm-import, tools/glitch-scan

### G-171 Odroczona zmiana poziomu trudności ginie przy zapisie
- Status: naprawione (1.11, #142: czekający profil w zapisie, schemat v20 z migracją; weryfikacja PRZYJĘTE)
- Ważność: S3 · Zasięg: zmiana poziomu w walce („Zmieni się po walce”), potem zapis i wczytanie przed końcem walki
- Przyczyna: `pendingDifficulty` nie wchodzi do zapisu (etap 1); po wczytaniu gracz jest na starym poziomie bez informacji, a slot ma etykietę starego
- Poprawka: odroczony profil w zapisie (zmiana schematu: `SAVE_SCHEMA_VERSION` + migracja + test) albo zastosowanie go przy zapisie; test sesji
- Pakiet właściciela: packages/sim, packages/persistence

### G-158 Latarnie ścienne zasłaniają tablice lokali
- Status: naprawione (1.11, #137: niezależna kontrola 14 → 0, latarnie ścienne prostopadle do ściany; weryfikacja w 2 rundach, kurator zgodne)
- Ważność: S3 · Zasięg: 17 z 169 latarni ściennych, np. WIEJSKI RAJ (564,0; −88,9), KORZEŃ CZAROWNICY (611,4; −74,9), PUB ZA KURTYNĄ (599,6; −2,6); zrzuty g148-r2-rynek-e, g148-r4-rynek-s
- Przyczyna: rozstaw `lamp-wall-lantern` (ADR-0047) nie zna tablic lokali (ADR-0064 etap 4); markiza je zna (`venueBoardOn`)
- Test przyjęcia: `wall-lantern-over-venue-board` 17 → 0
- Pakiet właściciela: tools/osm-import (props-gen), packages/engine

### G-159 Tablica lokalu wchodzi w sąsiedni budynek
- Status: naprawione (1.11, #138: tablica w wolnym odcinku ściany, skan 7 → 0)
- Ważność: S3 · Zasięg: 7: KUCHNIA SPOD ARARATU (600,8; −21,8), ZIELONY CZAROWNIK (168,0; −99,2), SZAFA PÓŁWIECZE (112,5; −111,8), ZJEDZ I ZNIKAJ (622,2; −6,8), WULKANIZACJA PIASTA (580,9; 552,6), KAMBUZ (828,6; 496,4), KLUB ZEBRANIE (205,8; −105,3)
- Przyczyna: `venueBoards` (`venue-plan.ts`) mieści tablicę w ścianie z marginesem 0,3 m, bez sprawdzenia sąsiada przed płaszczyzną ściany
- Test przyjęcia: `venue-board-in-neighbour` 7 → 0
- Pakiet właściciela: packages/engine (venue-plan.ts)

### G-157 Banery, holo-reklamy i wysięgniki wchodzą w sąsiednie budynki
- Status: naprawione (1.11, #138: banery, holo i wysięgniki poza sąsiadem, skan 33 i 4 → 0; wąskie wieże zachowują holo)
- Ważność: S3 · Zasięg: 31 banerów w 29 budynkach, 3 holo, 1 `blade`; np. (−190,6; −3,3), (195,5; −98,8), (228,3; −39,9), (309,8; −70,8); holo (577,3; 540,8), (494,9; −140,2); `blade` (578; 161,6)
- Przyczyna: `banners` w `canyon-signs.ts` (1,2 m od końca ściany, 1 m od niej) i `holos` (0,45 m) nie sprawdzają, czy sąsiad wystaje przed płaszczyznę ściany
- Test przyjęcia: `banner-in-neighbour` 31 → 0, `holo-or-blade-in-neighbour` 4 → 0
- Pakiet właściciela: packages/engine (canyon-signs.ts, sign-plan.ts)

### G-164 Menu postaci zmienia broń przy niesieniu ciała
- Status: naprawione (1.11, #134, 7b27ff1: przy niesieniu ciała `equip-item`/`unequip-item` nie ruszają slotów broni; test w `takedown-carry-limits.test.ts`)
- Ważność: S4 · Zasięg: komendy `equip-item` i `unequip-item` z menu postaci przy `carrying`
- Objaw: z ciałem na ramieniu menu dobywa albo chowa broń (sonda S7), choć ADR-0065 mówi „bez zmiany broni”; broń nie strzela, więc skutek mały
- Poprawka: odrzucić `equip-item`/`unequip-item` broni przy niesieniu (albo zablokować przycisk w menu), test sesji
- Pakiet właściciela: packages/sim, packages/ui

### G-165 `BodyFound` emitowane przy każdym nowym oglądającym zwłoki
- Status: zamknięte jako zamierzone (1.11, orkiestrator): `BodyFound { body, finder }` to „ten NPC znalazł ciało”; każdy NPC ogląda ciało raz (`lookedBy`), więc para ciało–znalazca się nie powtarza, a kolejne znalezienia są potrzebne (patrol zgłasza zwłoki po przechodniu; 8 testów stage 2–3 na tym stoi). UI, które zechce jednego zdarzenia na ciało, filtruje po `body`
- Ważność: S4 · Zasięg: każde zwłoki oglądane przez kilku NPC (np. przechodzień, potem patrol)
- Poprawka: jedno `BodyFound` na ciało albo jawne pole „pierwszy znalazca”, zanim UI zacznie z niego korzystać
- Pakiet właściciela: packages/sim (body-watch)

### G-152 Kontenery w ogrodzonym parku na Nabrzeżu
- Status: naprawione (1.11, #124: 6 kontenerów na Giełdzie na Kresowej, park pusty; dalej G-169)
- Ważność: S3 · Zasięg: 5 z 8 kontenerów w parku w154191322 (`leisure=park`, `natural=scrub`, `barrier=fence`), jeden w poprzek płotu
- Poprawka: kontenery poza parkiem, najlepiej na Giełdzie na Kresowej (plan ulic: „kontenery Tessen”); kontrola skanu „mebel w obrysie `leisure=park`/`natural=*` albo na `barrier=fence`”
- Pakiet właściciela: tools/osm-import (props-bulky)

### G-151 Hydranty stawiane regułą zamiast z OSM
- Status: naprawione (1.11, #124: 6 hydrantów nadziemnych z OSM na węzłach, reguła usunięta)
- Ważność: S3 · Zasięg: 33 hydranty w grze, żaden w prawdziwym miejscu (mediana 143 m od najbliższego nadziemnego)
- Przyczyna: `filterOsm` (`tools/osm-import/src/osm.ts:151`) zostawia tylko węzły z `name`, a hydranty nazwy nie mają; żywe OSM ma w chunkach 77 (6 `pillar`, 71 podziemnych, import z 2015 z `ref`)
- Poprawka: hydranty nadziemne z OSM (do 3 m od węzła), podziemne świadomie pominięte albo jako pokrywa; kontrola skanu „hydrant dalej niż 3 m od `pillar` z OSM”
- Pakiet właściciela: tools/osm-import

### G-149 Pomniki i rzeźby z OSM mają przypadkowy kształt
- Status: naprawione (1.11, #132, 67fc8a1; weryfikator PRZYJĘTE, kurator zgodne z trzema nieblokującymi uwagami → G-166…G-168, T-096…T-100); skan `monument-shape-off-tags` 48 → 0; uwaga weryfikatora: kontrola przepuszcza każdą stelę
- Ważność: S3 · Zasięg: 27 pomników i rzeźb z planu (`docs/world/lublin-props.todo.json`) i wszystkie `memorial`/`artwork` z OSM
- Przyczyna: ADR-0047 bierze pozycję z OSM, ale kształt z hasha id (`variant`, `SHAPES.monument = 4`): obelisk, postać na cokole, Koziołek albo abstrakcja; poza kilkoma wymuszonymi w planie prawdziwy pomnik dostaje losową bryłę (np. stos sześcianów albo postać na czarnym bloku w wąskiej uliczce)
- Poprawka: kształt z tagów OSM (`memorial=plaque|statue|bust|stone`, `artwork_type`, `historic`) i z ręcznej tabeli znanych pomników Lublina; tablica pamiątkowa na fasadzie zamiast wolnostojącej bryły; bez dopasowania: neutralna tablica albo kapliczka, nie abstrakcja; przegląd kuratora
- Pakiet właściciela: tools/osm-import (props-kinds, props-gen), packages/engine (prop-civic)

### G-143 Taksówki na osi chodnika przy Podzamczu
- Status: naprawione (1.11, #125, aee0832; weryfikator PRZYJĘTE, kurator bez zastrzeżeń)
- Ważność: S4 · Zasięg: taxi (928.6, 452.2) 0,01 m od osi `highway=footway` w809962786, taxi (922.9, 430.6) 0,80 m od niej
- Ustalone (1.11, orkiestrator, dane `data/osm/podzamcze.json`): w809962786 to samodzielna ścieżka piesza 52 m (`highway=footway`, bez `footway=sidewalk`/`crossing`, oświetlona, asfalt), co najmniej 7,8 m od osi Cerkiewnej i dróg serwisowych; łączy się z postojem taxi w471549002 (`amenity=taxi`, obszar), placem w66323033 (`area:highway`), chodnikiem w1517184174 i przejściem w1054556913. Taksówka 0,01 m od jej osi stoi więc na ścieżce pieszych obok postoju, nie na jezdni: glitch prawdziwy
- Poprawka: zaparkowane auta trzymają odstęp od osi samodzielnych ścieżek `footway`/`path` (poza `sidewalk` wzdłuż krawężnika), a taksówki z postoju `amenity=taxi` stoją wewnątrz jego obszaru; kontrola skanu „auto bliżej niż 1 m od osi ścieżki pieszej”
- Pakiet właściciela: packages/sim (content), przegląd kuratora

### G-145 Megabloki na zabytkach, w parku, nad Bystrzycą i na osiach widokowych
- Status: naprawione (1.11, #123, a56b621; weryfikator i dwa przeglądy kuratora)
- Ważność: S3 · Zasięg: wiele miejsc poza danymi miasta
- Gdzie: Stary cmentarz żydowski w40049437 (`near[19–21]`, `ring[15]`), Nowy cmentarz żydowski w792467989 (`ring[61]`), Ogród Saski w174005440 (`ring[77]`, `ring[78]`, `ring[34]`, `near[44–45]`), oś Bystrzycy r7577565 (`docks[9–11]`, `docks[15]`, `ring[10]`, `ring[42]` i bryły bliżej niż 50 m od osi); okno Placu Litewskiego na Wieżę Trynitarską i katedrę (azymut 101–109°: `near[13–14]`, `ring[10–11]`, `ring[51]`); panorama z Nabrzeża na Stare Miasto i Zamek (`near[17–18]`, `ring[14]`, `ring[54–55]`); 8 par wież nachodzących na siebie; dawna wieża „Zalew Zemborzycki” (−1200, −3700) 31 m od Bystrzycy w Wrotkowie
- Poprawka: obszary zakazane i okna widokowe w generatorze układu, testy `megablock-protected`, `megablock-overlap`, `megablock-viewaxis` z bazą 0
- Pakiet właściciela: packages/engine (renderer, mapcity)

### G-001 Test migawki NPR przekracza 90 s na wolnym runnerze CI
- Status: naprawione (#39). Tryb `?reference` rysuje dopiero przy gotowej scenie; migawka 18–42 s zamiast 72 s. Ryzyko szczątkowe: `still` nie czeka na `ProbeSchedule` (inwalidacja sondy < 1 s przed gotowością); zapas w pomiarach > 2,6 s.
- Ważność: S1 (czerwone CI) · Zasięg: każdy PR · Koszt: średni
- Gdzie: `e2e/npr-perf.spec.ts` „NPR reference frame matches the approved snapshot”, PR #28 (E2E 1/3, dwa razy)
- Dowód (pomiar lokalny, SwiftShader):
  - gotowość po ~18 s, `still` po ~27 s;
  - pierwszy `capture()` kończy się po ~60 s (`scene.render` 16 ms, `toDataURL` ~16 s, reszta to oczekiwanie na kolejkę GPU);
  - na `main` tak samo (~63 s);
  - zmniejszenie liczby klatek ustalania z 8 do 3 nie zmienia czasu.
- Przyczyna (przypuszczalna): praca GPU po zbudowaniu miasta wokół kadru (kompilacja shaderów, przesyłanie geometrii, klatki w kolejce) pod SwiftShaderem.
- Pakiet: `packages/app` (tryb referencyjny), `packages/engine`.
- Test przyjęcia: test migawki poniżej 45 s lokalnie, migawka bez zmian; limitu się nie podnosi.

### G-002 Dostawczak jedzie przez bramę Ku Farze z zakazem wjazdu
- Status: naprawione (#44) (naprawa orkiestratora: tylko bramy pod budynkiem z `motor_vehicle=no`; deptaki z `motor_vehicle=no` dalej obsługują dostawy zgodnie z ADR-0050)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: Ku Farze (616, 44), droga OSM 481583497 `motor_vehicle=no`
- Dowód: trasa `Ku Farze#66:d` biegnie przez przejście; importer nie zapisuje `motor_vehicle`.
- Pakiet: `tools/osm-import` (ulice), `packages/sim` (`roads.ts`)
- Test przyjęcia: żadna trasa dostaw nie biegnie odcinkiem z `motor_vehicle=no`.

### G-005 Wiata przystanku wchodzi w ścianę przy Alei Tysiąclecia
- Status: duplikat (G-011)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (709, 335)
- Dowód: skan `furniture-in-wall` = 1.
- Pakiet: `tools/osm-import` (meble przy ścianach stawiane z `ON_BUILDINGS`)

### G-008 Budynki z OSM wchodzą w sceny targu i doków
- Status: naprawione (#33)
- Decyzja orkiestratora: budynek znika, gdy przecina pełny blok sceny albo ponad 25% jego powierzchni leży w prostokątach; Dworzec Autobusowy (2,6%, bez kolizji) zostaje. Znikają w1354195809 i „Hunek” w458298766.
- Ważność: S3 · Zasięg: lokalny · Koszt: mały
- Gdzie: w1354195809 przy dokach (2595, 391), wbity w ścianę doków i 1,2 m nad wyrównanym placem; „Hunek" w458298766 (817, 373,5) we wschodniej ścianie targu; w66264171 (789, 396) na placu targu
- Dowód:
  - pomiar siatką 0,5 m (obrysy przecięte z `CLEARED_BUILDINGS` i blokami scen);
  - zrzut `doki-east-wall.png`.
- Przyczyna: `CLEARED_BUILDINGS` usuwa budynek tylko wtedy, gdy jego środek leży w prostokącie (`places.ts` i warstwa rysowania).
- Pakiet: `packages/sim` (`lublin/places.ts`, `sites.ts`, scenografia)
- Test przyjęcia: żaden budynek zostający w grze nie przecina pełnego bloku sceny ani nie leży w prostokątach w ponad 25%; kontrola `building-in-set-piece` w skanie = 0.

### G-009 Auta zaparkowane przy krawężniku stoją na trawniku i chodniku
- Status: naprawione (#31)
- Ważność: S3 · Zasięg: szeroki · Koszt: mały
- Gdzie:
  - Ruska (1071,6, 460), (1067,2, 464,1);
  - Kowalska (533,9, 173,6);
  - Cerkiewna (909–927, 361–406), 8 aut;
  - Nowy Plac Targowy, Nadstawna, 2 w krakowskie-0-0.
- Ile: 19 ze 118 aut ma co najmniej 3 z 5 punktów obrysu poza jezdnią, placem albo parkingiem.
- Dowód: pomiar `surfacesAt`; zrzuty `ruska-b.png`, `kowalska-van.png`, `cerkiewna.png`.
- Przyczyna: `kerbCars()` stawia auta na odsunięciu z mediany szerokości całej ulicy; `fits()` nie sprawdza nawierzchni.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: rogi i środek każdego auta na `road`, `cobble`, `square` albo `parking`; kontrola `parked-car-off-road` w skanie = 0.

### G-010 Brama przy północnej krawędzi mapy kończy się w pustce, posadzka wznosi się o 2,4 m
- Status: naprawione (#31)
- Ważność: S4 · Zasięg: rzadki · Koszt: mały
- Gdzie: kamienica w232674407 (38, 159), przejście (46, 157.2) → (30.7, 161)
- Dowód:
  - koniec przejścia leży poza chunkami (z > 160), gdzie `groundY` = 0;
  - posadzka biegnie od −2,43 do 0, sklepienie ma 6,4 m nad gruntem;
  - gracz staje na krawędzi świata;
  - zrzuty `/tmp/gh-a/01-brama-edge.png`, `10-edge-passage-in.png`.
- Pakiet: `tools/osm-import` (`passages.ts`)
- Test przyjęcia: oba końce każdego przejścia z `PASSAGES` leżą w granicach chunka.

### G-011 Meble wewnątrz budynków: reflektory w Wieży Trynitarskiej, Archikatedrze i przy Zamku, kioski w swoich budynkach, wiata w ścianie
- Status: naprawione (#32)
- Uwaga weryfikatora: `SINGLE_OUTLINE` obejmuje też `bus-stop` i `vending-machine`, więc reguła „centroid obrysu jest budynkiem → bez mebla” może kiedyś po cichu usunąć przystanek z obrysu (dziś nic takiego nie znika; przystanki zasilają `stopsAlong` trolejbusów).
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie:
  - reflektory: (597, −152), (605, −175), (620, −190), (846, 222/240/258), (890, 205);
  - kioski: w66330705 (291.4, −115.9), w458298771 (835.9, 373.5);
  - wiata: (709, 335) (dawne G-005).
- Dowód:
  - `inBuilding` dla 7 reflektorów i 2 kiosków; środki do 7,8 m w głąb;
  - zrzut `/tmp/gh-a3/13-katedra-floodlights.png` (brak reflektorów u fasady).
- Przyczyna: `floodlight`, `kiosk` i `bus-shelter` są w `ON_BUILDINGS` generatora mebli, więc nie dotyczy ich `offWall` ani kontrola głębokości. Kiosk stawiany w centroidzie obrysu, który importer wciąga też jako budynek.
- Pakiet: `tools/osm-import` (`props-gen.ts`), dane w `docs/world/lublin-props.todo.json`
- Test przyjęcia: kontrola `furniture-in-building` w skanie (środek mebla głębiej niż 0,5 m w budynku) = 0.

### G-012 Meble z bryłą nachodzą na siebie: kosze w pniach drzew na deptaku
- Status: naprawione (#35). Kontrola `furniture-overlap` liczy nachodzenie brył > 5 cm; para kandelabr–szafka (734, 215) miała 0,8 cm (modele tylko się stykają), więc skan jej nie liczy, a generator i tak ją rozsunął.
- Ważność: S4 · Zasięg: szeroki · Koszt: mały
- Gdzie:
  - kosze (175.5, −48.6) i (288, −73.3) w pniach drzew z OSM;
  - stragan i automat (705, 267);
  - kandelabr i szafka (734, 215).
- Dowód: odległość środków 0,14 i 0,20 m przy promieniach 0,3 + 0,3.
- Przyczyna: `placeStreetGroup` (`props-streets.ts`) nie omija innych mebli.
- Pakiet: `tools/osm-import`
- Test przyjęcia: kontrola `furniture-overlap` w skanie = 0 (meble z bryłą, poza słupkami).

### G-013 Narzędzie zrzutów: kadr przesunięty o jedno miejsce albo powtórzony
- Status: naprawione (#37). Spec czeka na `frames() > n` po `step` i asertuje pozę kamery (pozycja 3 m, yaw i pitch ±0,01; zakłada FPP i stojącego gracza).
- Ważność: S3 (proces: fałszywe dowody łowców) · Zasięg: każde polowanie · Koszt: mały
- Gdzie: `e2e/glitch-shots.spec.ts`
- Dowód:
  - u łowcy Podzamcza pierwsza seria przesunięta o jeden kadr;
  - u łowcy Krakowskiego dwa różne punkty dały identyczny zrzut.
- Przyczyna (przypuszczalna): `citySettled()` jest już prawdą z poprzedniego miejsca, zanim ruszy streaming nowego.
- Pakiet: `e2e` (QA)
- Test przyjęcia: dwa różne punkty dają różne zrzuty, a kadr odpowiada pozycji gracza (np. zapis pozycji kamery obok zrzutu).

### G-014 Auta zaparkowane na przejściach dla pieszych
- Status: naprawione (#32)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie:
  - (−104,9, 35,2) van, 12/153 punktów obrysu na zebrze;
  - (−111,8, −42,2) dostawczy, 44/153;
  - (920,4, 469,2) hatchback, środek na zebrze.
- Dowód: sonda weryfikatora G-009 (153 punkty obrysu na auto). Auta stały tam przed G-009.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: kontrola `parked-car-on-crossing` w skanie = 0 (żaden punkt obrysu na `crossing`).

### G-015 Auta zaparkowane tyłem do ruchu na ulicach jednokierunkowych
- Status: naprawione (#34)
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: 10 aut, m.in. Lubartowska (449,9, 40,7), Aleja Tysiąclecia (920,0, 329,9), Nowy Plac Targowy, Nadstawna
- Dowód: sonda weryfikatora G-014 (kierunek auta wobec najbliższej osi ulicy; do potwierdzenia).
- Przyczyna: `kerbCars()` w `parked-cars.ts` nie patrzy na `oneway` i stawia auta przy obu krawężnikach w obu kierunkach.
- Pakiet: `packages/sim` (`content/parked-cars.ts`)
- Test przyjęcia: na ulicy jednokierunkowej każde zaparkowane auto stoi przodem w kierunku ruchu.

### G-017 Wiaty przystanków z OSM jako trzypiętrowe bloki mieszkalne na Alei Tysiąclecia
- Status: naprawione (#34)
- Ważność: S3 · Zasięg: lokalny · Koszt: mały
- Gdzie: w672635874 (709,5, 335,3) i w672635872 (781, 365,1), po 3 kondygnacje i 9,7–9,8 m; w672635873 3,3 m
- Dowód: raport naprawiacza G-011 (obrysy `amenity=shelter` + `building=yes` budowane jako `residential`).
- Pakiet: `tools/osm-import` (`building-tags.ts` / `buildings.ts`), wymaga `pnpm osm:build`
- Test przyjęcia: budynek z `amenity=shelter` (lub `building=roof`/`shelter`) ma wysokość wiaty (≤ 3,5 m, jedna kondygnacja) albo staje się meblem `bus-shelter`.

### G-019 Auto z jednokierunkowej pętli Cerkiewnej stoi na trzypasmowej jezdni Alei Tysiąclecia
- Status: naprawione (#36). Luka skanu do domknięcia osobno: auto przy krawężniku bez rozpoznanej ulicy (> 12 m albo > 20°) jest pomijane, a auto wjechane na inną ulicę osiedlową uznawane za stojące przy niej; generację chroni `offOtherRoads`.
- Ważność: S3 · Zasięg: lokalny, trasa główna · Koszt: mały
- Gdzie: (920,02, 329,90), hatchback; 1 na 81 aut w mieście
- Dowód: 2,49 m od osi „Aleje Tysiąclecia” (OSM way 739432828, primary, 3 pasy), kąt 35°; pętla Cerkiewnej (ways 66322976, 422659195) leży 7–13 m od osi Alei bez pobocza.
- Przyczyna: `roadHalfWidth()` (`traffic.ts:102`) skanuje każdą nawierzchnię jezdni, więc lewy krawężnik pętli trafia za Aleję (limit 9 m) i `parked-cars.ts:155` stawia auto na pasie Alei; `fits()` sprawdza tylko pasy `TRAFFIC_ROUTES`, a odcinek Alei (36,4 m < `MIN_ROUTE` 45) nie ma pasa.
- Pakiet właściciela: packages/sim (`content/parked-cars.ts`)
- Test przyjęcia: kontrola skanu `parked-car-on-other-road` (auto przy krawężniku w zasięgu nawierzchni innej drogi dla aut + 0,5 m; własna ulica wyznaczana w skanie, nie z pola poprawki) daje 0; dziś 1.

### G-020 Jezdnia zachodnia Alei Tysiąclecia ma 36 m bez pasa (literówka „Aleje” w OSM)
- Status: naprawione (#38)
- Ważność: S2 · Zasięg: szeroki (trasa główna) · Koszt: mały
- Gdzie: (930,3, 331,4)–(894,1, 335,1), `ROAD_CHAINS[91]`, OSM way 739432828; 1 w mieście
- Dowód: pasy #85/#86 kończą się w x 930, #82–#84 zaczynają w x 894. W symulacji (seed 3, 8:00, 90 s) auta stoją na końcu pasa z v = 0 i tworzą korek do 6 aut, w ramce naliczono 18 pojawień i 21 zniknięć. Łańcuch #82 (128,5 m < `MIN_TROLLEY` 150) traci trolejbus.
- Przyczyna: `tools/osm-import/src/labels.ts:26` przepisuje nazwę bez korekty; klucz łączenia w `content/lublin/roads.ts:71` zawiera nazwę, więc Aleja rozpada się na 3 łańcuchy. Martwy obejściowy wpis „Aleje Tysiąclecia” w `TROLLEY_STREETS` (`traffic.ts:62`).
- Pakiet właściciela: tools/osm-import (korekta nazwy) + regeneracja `content/lublin`
- Test przyjęcia: jeden łańcuch „Aleja Tysiąclecia” ok. 472 m; pas aut bliżej niż 2 m od (912, 333); trolejbus na jezdni zachodniej; kontrola skanu `car-road-hole` (krótki łańcuch między dwoma łańcuchami z pasami, ten sam rodzaj i oneway) daje 0, dziś 1.
- Uwaga: po złączeniu odcinek dostaje pas, a to może samo usunąć objaw G-019; przyczyna G-019 (krawężnik liczony przez cudzą jezdnię) zostaje osobna.
- Trop poza zakresem: 12 bezimiennych dróg dla aut odrzuconych przez import (`labels.ts:27`, m.in. primary_link 60149306, 232464399) może dawać podobne przerwy na łącznikach.

### G-021 Szwy chunków ucinają krótkie kawałki ulic: dziury w pasach aut (Narutowicza, Lubartowska ×2)
- Status: naprawione (#40). `street-seam-gap` 3 → 0, `lane-dead-end` 66 → 61. Pasy Świętoduska:0 i Narutowicza:f zaczynają się 0,8–1,3 m za krawędzią mapy (bez skutków, `car-lane-off-road` tego nie liczy).
- Ważność: S3 · Zasięg: lokalny (3 miejsca, 7 ślepych końców pasów) · Koszt: mały
- Gdzie: Narutowicza szew x = 240 ((238,3, −171,6)–(268,6, −161,6), #8 ma 30,3 m bez pasa); Lubartowska szew z = −20 (brak 4,2 m przy (442,2, −20)); Lubartowska szew z = 370 (brak 3,8 m przy (585, 366,5), #39 ma 9,3 m bez pasa)
- Dowód: łowca (pomiar `clipLineToRect`); `krakowskie.generated.ts:688` kończy Lubartowską na (442,2, −20), `:1492` zaczyna na (442,3, −15,8). OSM w40051392, w40050981, w60145297.
- Przyczyna (przypuszczalna): `tools/osm-import/src/labels.ts:33` (`lineLength(piece) < 5`) odrzuca kawałek przycięty na szwie; `JOIN` 0,6 m w `roads.ts` nie łączy przerwy.
- Pakiet właściciela: tools/osm-import + regeneracja `content/lublin`
- Test przyjęcia: kontrola skanu `street-seam-gap` (pary łańcuchów aut o tej samej nazwie z końcami 0,6–8 m od siebie, dalej niż 6 m od krawędzi mapy) daje 0; dziś 3.

### G-023 Pasy aut kończą się bez zawrotki przy ulicach dla dostaw i na końcach ulic
- Status: naprawione (#37) (częściowo: 7 z 13 końców, dwukierunkowe; 6 końców jednokierunkowych wydzielone do G-024). Skan `lane-dead-end` 75 → 68.
- Ważność: S3 · Zasięg: szeroki (13 końców, m.in. Lubartowska przy Starym Mieście) · Koszt: średni
- Gdzie: Lubartowska#37 (460, 56); Kowalska#76 (568, 160), #87 (668, 161); Królewska#19 (459, −156); Kapucyńska#10 (144, −97); Karmelicka#34 (293, 120); Staszica#35 (199, 28); Świętoduska#20 (350, −48); Kościuszki#4 (28, −103); Browarna#102 (532, 407)
- Dowód: łowca: żaden pas aut w promieniu 6 m od końca; sąsiedni łańcuch ma `use=deliveries` albo OSM ma tylko service/footway/parking. Auto w polu widzenia staje na końcu pasa (`traffic-system.ts:334`) i czeka.
- Przyczyna (przypuszczalna): `turnRound()` w `traffic.ts` paruje tylko pasy przecięte blokiem gry; koniec ulicy i zmiana `useOf` nie dostają zawrotki.
- Pakiet właściciela: packages/sim (`content/traffic.ts`)
- Test przyjęcia: kontrola skanu `lane-dead-end` (koniec pasa w mapie, > 6 m od krawędzi, bez początku pasa zgodnego kierunku w 3 m); dziś 75, z czego 33 to G-006 i 2 to G-020; ta poprawka obniża o 13, baza tylko spada.

### G-028 Resynchronizacja przenosi auto w łuk zawrotki z pełną prędkością
- Status: naprawione (#38)
- Ważność: S3 · Zasięg: lokalny (każda zawrotka; widać po złączeniu Alei w G-020) · Koszt: mały
- Gdzie: Aleja Tysiąclecia, zawrotka przed targiem; seed 3: auto za trolejbusem spada ponad `RESYNC` za rozkład, poza wzrokiem przeskakuje z s=204,6 na s=244,8 (w łuku) i jedzie dalej 7,7 m/s przy `TURN_SPEED` 4
- Dowód: test „turns round before the market on Aleja Tysiąclecia” pada po G-020 (7,69 > 4,01)
- Przyczyna: `traffic-system.ts:296-299` ustawia `st.s` z rozkładu, ale zostawia prędkość auta
- Pakiet właściciela: packages/sim (`systems/traffic-system.ts`)
- Test przyjęcia: auto po resynchronizacji w łuku nie przekracza `TURN_SPEED`; test zawrotki bez złagodzenia przechodzi z G-020.

### G-029 Kliknięcie „Nowa gra” w `models.spec.ts` wisi ponad 60 s na CI
- Status: naprawione (#46). Kliknięcie „New Game” 12,7 s → 4,9 s przy podobnym load; po utracie kontekstu WebGL rysowanie wraca ( naprawa: `GpuPacer` w engine, najwyżej 2 klatki w kolejce GPU; ekran tytułowy 20 → 2 klatki przed płotem, `models.spec` 15–33 s; kryterium < 10 s do potwierdzenia na CI)
- Ważność: S1 (proponowana: czerwone CI, niestabilne) · Zasięg: każdy PR · Koszt: nieznany
- Gdzie: `e2e/models.spec.ts:16`, shard E2E 1/3
- Dowód: PR #37 (CI 41089511069) pada w obu próbach, PR #33 (CI 41069178665) przeszedł przy drugiej. Playwright: element widoczny i stabilny, „performing click action” bez końca, więc wątek strony zablokowany.
- Przyczyna (przypuszczalna): długa praca synchroniczna po „Nowa gra” (budowa świata, ubieranie postaci VRoid) pod SwiftShaderem; może ta sama kolejka GPU co G-001.
- Pakiet właściciela: packages/app / packages/engine (do ustalenia śladem)
- Test przyjęcia: ślad pokazuje, co blokuje wątek; kliknięcie wraca w < 10 s na CI bez podnoszenia limitu.

### G-032 Słupki przy ulicach stoją chaotycznie: łańcuchy celują w różne strony i nie łączą sąsiadów; słupki za małe
- Status: naprawione (#45). Na samym Placu Łokietka nie został żaden łańcuch: słupek z wylotu zebry usunięty, sąsiedni zabiera gra (przejście do Bramy Krakowskiej). (Latarnia jako ogniwo rzędu i wolne wyloty przejść dla pieszych, decyzje użytkownika)
- Ważność: S3 · Zasięg: szeroki (Plac Litewski, Krakowskie Przedmieście, deptak, Plac Łokietka; ok. 53 słupki z OSM) · Koszt: średni
- Dowód: model `bollard()` (`engine/.../mapcity/prop-street.ts:36`) ma stałe odcinki łańcucha ±1 m w lokalnej osi X, a obrót słupka nie wynika z rzędu, w którym stoi; odstępy w rzędach 1,9–2,8 m (`docs/world/lublin-props.todo.json`). Słupek 0,26 × 0,95 m.
- Pakiet właściciela: tools/osm-import (rzędy i obrót), packages/engine (model, łańcuch), packages/sim (`furniture.ts`, bryła)
- Test przyjęcia: słupki w rzędzie mają obrót wzdłuż rzędu; łańcuch łączy dokładnie sąsiednie słupki rzędu (koniec łańcucha przy sąsiedzie, bez wolnych końców w powietrzu); słupek większy (wymiary z dokumentacji/zdjęć Lublina), bryła w sim zgodna z modelem; migawka NPR obejrzana i świadomie zaktualizowana, budżety bez podnoszenia.

### G-033 Postać, która przechodzi w inne miejsce według flag, „umiera”: renderer gra upadek
- Status: naprawione (#46)
- Ważność: S2 · Zasięg: każda postać warunkowa (Kaito klinika → bar, cele wariantów kontraktów) · Koszt: mały
- Dowód: po `met_fixer` `Streaming.syncPresence` usuwa Kaito z kliniki; `RenderSync` (`presentation/render-sync.ts:101`) zgłasza `despawn(id, "removed")`, bo usunięcie nie jest w `streamedOut`, a `CharacterViews.despawn` z `fall` gra animację śmierci.
- Pakiet właściciela: packages/sim (`world/streaming.ts`, `presentation/render-sync.ts`)
- Test przyjęcia: test sesji: po ustawieniu flagi postać warunkowa znika z `despawn(..., "unloaded")`; zabity NPC dalej dostaje `"removed"`.

### G-034 Kaito od początku w Neon Koi (decyzja użytkownika)
- Status: naprawione (#46). Ume i barman wskazują Neon Koi. Zapis v16 z migracją; złote hashe replay i pojedynku zmienione przez wersję schematu i pozycję Kaito
- Ważność: S3 · Zasięg: prolog · Koszt: średni
- Zmiana: jedna postać Kaito w barze bez warunku `met_fixer`; prolog w `m0.ink` i cel HUD prowadzą z kliniki do Neon Koi; pierwsza rozmowa w barze.
- Pakiet właściciela: packages/sim (`content/district-m0.ts`), packages/narrative (`ink/m0.ink`), packages/app (`objective.ts`)
- Test przyjęcia: test sesji prologu: nowa gra w klinice, cel wskazuje Neon Koi, rozmowa z Kaito w barze ustawia `met_fixer` i daje zlecenie kuriera, Kaito się nie przemieszcza.

### G-035 Wskaźniki zadań nie prowadzą do postaci z wątku: nie da się znaleźć babci Ume
- Status: naprawione (#43). Cel kroku (`target`) i znacznik `quest` na minimapie i mapie miasta; poza wczytanym chunkiem znacznik na miejscu z harmonogramu. Uwaga weryfikatora: jeśli Ume zginie w kroku ren_trail (po „aya”), krok nie ma innej drogi ukończenia (do osobnego zgłoszenia).
- Ważność: S2 (blokuje postęp wątku głównego, akt II) · Zasięg: każdy krok „porozmawiaj z X” (Ume, Mori, Ren, Kurosawa) · Koszt: średni
- Dowód: `minimap.ts` `markerKind` oznacza tylko zleceniodawców (`fixer`/`hana`/`genzo`) i cele z tagiem; kroki zadań (`core/quest/definitions.ts`) mają tylko tekst `objective`, bez celu. „Zapytaj babcię Ume o Rena Odagiri” nie mówi, gdzie ona jest (deptak przy klinice ok. (328, −77) od 6:30, w nocy brama obok, `schedules.ts`).
- Pakiet właściciela: packages/core (`quest`, krok z celem), packages/app (`minimap.ts`, HUD), packages/ui (znacznik)
- Test przyjęcia: test sesji: w kroku z celem-postacią minimapa ma znacznik celu na tej postaci (o każdej porze, także gdy postać śpi albo jest poza wczytanym chunkiem: znacznik na jej miejscu z harmonogramu); dla Ume w kroku `m3_lustro` znacznik w ok. (328, −77) w dzień.

### G-039 Łańcuch słupków przechodzi przez podstawę latarni na Placu Łokietka
- Status: naprawione (#45) razem z G-032 (łańcuch przez latarnię nie występuje; słupek z wylotu zebry na Łokietku usunięty)
- Ważność: S4 · Gdzie: `lamp-pastoral` (439,2; −96,1) w rzędzie słupków (439; −94,4)–(439; −96,8)
- Przyczyna (przypuszczalna): słupki są w `LOOSE` (`props-solid.ts`), więc latarnia stawiana później ich nie widzi; łańcuch od G-032 łączy sąsiadów przez latarnię.
- Test przyjęcia: kontrola skanu „łańcuch słupków przez mebel” daje 0.

### G-040 Śmierć babci Ume blokuje krok ren_trail
- Status: odrzucone (Ume nie ma `health` w `district-m0.ts`, a NPC bez niego nie da się zranić ani zabić, `builders.ts:77`; krok nie może się zablokować)
- Ważność: S2 (proponowana: blokada wątku) · Dowód: krok `ren_trail` (po zakończeniu „aya”) kończy tylko rozmowa z Ume; po `dead:ume` znacznik znika i nie ma innej drogi.

### G-018 Pionowy pas czarnych kresek na bruku Placu Litewskiego
- Status: naprawione (#47). Bieg o średnim podstopniu < 4,5 cm rysowany jako bruk; skan `steps-micro-riser` 42 → 0. Uwaga weryfikatora: reguła zmienia 60 ze 101 pasów schodów, w tym zbocza Podzamcza (np. (798, 272), spadek 12%), które teraz są rampą w kolorze stopni
- Ważność: S3 (proponowana) · Zasięg: lokalny
- Gdzie: Plac Litewski (20, 10), kadr z yaw 3,14
- Dowód: zrzut naprawiacza G-013 (pionowy pas czarnych poziomych kresek na środku bruku; może decal albo odpływ).

### G-030 Poza Seki w klatce referencyjnej zależy od czasu zegarowego
- Status: naprawione (#47). Zegary bezczynności postaci stoją w trybie `?reference`; dwa przebiegi migawki: 1106 px różnicy → 0
- Ważność: S4 (proponowana: migawka różni się między przebiegami w prostokącie postaci) · Koszt: mały
- Dowód: naprawiacz G-001: animacja bezczynności dostaje prawdziwe `dt`; dwa przebiegi starego kodu różnią się w x 703–797, y 273–532.
- Pakiet właściciela: packages/engine (animacja postaci) / packages/app (`?reference`)

### G-044 Tłum i pozy czynności animują się zegarem ściennym także w klatce referencyjnej
- Status: naprawione (#47). (cykle chodu, kołysania i czynności idą z `clock`, w `?reference` 0)
- Ważność: S4 (proponowana; dziś poza kadrem referencyjnym) · Koszt: mały
- Dowód: naprawiacz G-030: `crowd-pose.ts` (`stepPuppet`, `s.time`) i `activity-poses.ts` (`b.time`) idą z `dt`; jeśli wejdą w kadr `?reference`, wróci niedeterminizm migawki.
- Pakiet właściciela: packages/engine (renderer)

### G-045 Test `far-city.test.ts` przekracza 5 s pod obciążeniem
- Status: naprawione (#47). Przyczyna: `expect` na każdą parę wierzchołek × chunk; teraz jedna asercja na liście naruszeń, 3773 ms → 12 ms, kontrola ta sama (odwrócony warunek pada)
- Ważność: S3 (proponowana: niestabilny test jednostkowy) · Koszt: mały
- Dowód: „keeps rings and fillers off every chunk's ground” 5182 ms przy load 16 i padł przy load ok. 8; sam przechodzi 5/5. Ustalić, co jest drogie (podniesienie limitu nie jest poprawką).
- Pakiet właściciela: packages/engine

### G-047 Karta skanu hackowania nie zmienia języka do zmiany celu
- Status: naprawione (#47). (presenter pamięta język karty)
- Ważność: S4 (proponowana) · Koszt: mały
- Dowód: `hacking-hud.ts:62` przelicza kartę tylko przy zmianie celu; po zmianie języka w pauzie karta tego samego celu zostaje w starym języku.
- Pakiet właściciela: packages/app (HUD), etap 2c ADR-0056

### G-006 Skręty aut na skrzyżowaniach
- Status: naprawione (#47). w PR. `lane-dead-end` 61 → 44; zator Ruska/Lwowska usunięty; nowa kontrola `turn-off-road` 6 (zawrotki targu, G-025). CPU sceny targu 3,8 → 4,3 s na 3000 kroków
- Ważność: S3 · Zasięg: szeroki (33 ślepe końce pasów na skrzyżowaniach i 6 z G-024) · Koszt: duży
- Test przyjęcia: `lane-dead-end` spada; łuki skrętu na nawierzchni drogi i poza budynkami.

### G-046 Smoke M0: kierunek ruchu po `freeze` zależy od chwili zamrożenia
- Status: naprawione (#49). Przyczyna w grze: Chromium po wejściu w pointer lock wysyła jeden `mousemove` z ruchem równym minus pozycja kursora (−640 px), `BrowserInput` brał go za obrót (yaw π/2 → 0,16); pierwszy ruch po zmianie stanu blokady nie obraca już widoku
- Ważność: S2 (proponowana: niestabilne e2e) · Koszt: mały
- Dowód: weryfikator i18n 2b, sonda: New Game, `freeze`, 6×10 kroków `moveZ`; `tick0` wypada 10, 15 albo 20 i każdy daje inny kierunek; przy `tick0=15` gracz idzie na ścianę z=−62,88 i staje po 2,09 m, więc `smoke.spec.ts:26` (ruch > 2,5) pada. Na czystym main (b5507ce) 3/4 przebiegów sondy trafia na ścianę. Test zakłada kierunek, który zależy od liczby ticków przed `freeze`.
- Pakiet właściciela: e2e (QA) / packages/app

### G-048 Prawdziwy tap tuż po przycisku pada ginie jako „ghost click”
- Status: naprawione (#48). (`packages/ui/src/touch/ghost-click.ts`)
- Ważność: S2 (niestabilne e2e `touch.spec`, a na telefonie zgubiony pierwszy wybór w dialogu) · Koszt: mały
- Dowód: `pointerdown` na przycisku pada uzbraja `swallowNextClick` na 700 ms, a ten sam przycisk w `touchend` robi `preventDefault`, więc klik zgodności nie przychodzi i nasłuch zjada pierwszy prawdziwy tap w wybór dialogu. Pomiar: padły 3 z 5 przebiegów (odstępy 432–679 ms), przeszły przy 1,6–1,8 s; bez G-006 też 2 z 5. Poprawka: nasłuch wygasa przy następnym `pointerdown`.
- Pakiet właściciela: packages/ui (touch)

### G-004 Kandelabr na krawędzi pasa aut na Placu Zamkowym
- Status: naprawione (#51). Jak na prawdziwej mapie: OSM wpuszcza auta na plac, lampy poza pasem, kosze idą z lampami; skan `furniture-in-car-lane` 1 → 0, nowa kontrola `hanging-basket-orphan`.
- Ważność: S4 · Zasięg: lokalny · Koszt: mały
- Gdzie: (738, 282)
- Dowód: skan `furniture-in-car-lane` = 1 (0,9 m od linii pasa).
- Pomiar (orkiestrator, 31.10, po G-006): `lamp-candelabra` z chunku podzamcze-1-0 (737,7; 282,3) stoi 0,04 m od osi jezdni „Plac Zamkowy” (`residential`, `cars`) i 1,34 m od linii pasa `Plac Zamkowy#84:f` (promień 0,45 + pół auta 0,9). Mebel z OSM leży na jezdni, więc poprawka należy do importu mebli (odsunięcie na krawędź albo pominięcie), a nie do tras. Nawierzchnia w tym miejscu to `cobble` (bruk placu, nie `road`), więc `props-place.ts` (`surfaceAt(p) === "road"`) nie widzi jezdni, choć `sim` puszcza tamtędy pas aut. Do wyboru przy naprawie: import mebli traktuje oś ulicy z pasem aut jak jezdnię (lampy na krawędź), albo bruk placu nie dostaje pasa aut.
- Pakiet: `tools/osm-import` (meble) albo `packages/sim` (trasy przez parking)

### G-038 `lane-dead-end` nie sprawdza użycia początku, który „spotyka” koniec
- Status: naprawione (#51). Kontrola wymaga tego samego `use`; licznik 44 bez zmian (po G-006 koniec już liczony).
- Ważność: S4 (skan) · Gdzie: koniec trolejbusu na Mełgiewskiej ok. (2456, 245) ukryty przez początek pasa aut.

### G-031 Testy TPP w `npr-perf` i smoke save/load przekraczają limit przy obciążeniu
- Status: naprawione (#57). Zgłoszona postać nie odtwarzała się już po G-029 (pacer); #57 domyka `captureFrame` (bez własnego renderu) i podgląd postaci (przez pacer). Pozostałości: G-054, G-055.
- Ważność: S2 (proponowana: niestabilne e2e) · Koszt: nieznany
- Dowód: naprawiacz G-001: przy obciążeniu 5–11 za każdym razem pada inny test (Krakowskie, Rynek, targ, Nabrzeże, quicksave/quickload); przypuszczalnie ten sam mechanizm co G-001 w zwykłym trybie (pełne klatki w trakcie ładowania i kroków budują kolejkę GPU SwiftShadera). `captureFrame` rysuje dodatkową klatkę mimo `preserveDrawingBuffer` (1,3–5,8 s na przechwycenie).
- Pakiet właściciela: packages/app / e2e

### G-049 Zabytki tracą wieże, hełmy i wysokość: import pomija `building:part` (Trynitarska 42 zamiast 60 m)
- Status: naprawione (#65). Części `building:part` jako osobne bryły z `soffit`; skan `building-part-ignored` 11 → 0. Pozostałe odstępstwa: G-056, G-057, G-060, G-061 (T-017–T-020)
- Ważność: S3 (proponowana) · Zasięg: szeroki (panorama Starego Miasta, Plac Łokietka, Rynek) · Koszt: średni (fetch, osm.ts, massing, buildings w tools/osm-import; regeneracja danych)
- Gdzie: Trynitarska (591.3, −147.3), Brama Krakowska (472.6, −91.2), Ratusz (415, −79), Archikatedra (634, −184), Dominikanie (731, −55); ile w mieście: co najmniej 5 w próbce, pełna liczba po ponownym pobraniu
- Dowód: OSM w617763432 `height=60 min_height=55 roof:shape=pyramidal` w obrysie w66286371; w617878341 `building:levels=6 roof:shape=onion` w r7224409; w619138854 `building:part=tower building:levels=7.5`; T-006 do T-010
- Przyczyna (przypuszczalna): `filterOsm` nie zachowuje `building:part`, a `massing` liczy jedną bryłę z tagów obrysu zewnętrznego
- Pakiet właściciela: tools/osm-import (dane: packages/sim/src/content/lublin/*.generated.ts)
- Test przyjęcia: test w tools/osm-import na wycinku z Trynitarską: najwyższy punkt bryły ≥ 59 m nad stopą, a przybudówka Bramy Krakowskiej ≤ 2 kondygnacje. Dziś pada (42 m, 5 kondygnacji)
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-054 Narzędzie zrzutów `glitch-shots` może zapisać klatkę sprzed ułożenia miasta
- Status: naprawione (#62). Spec czeka na dwie klatki narysowane po `citySettled`; objawu nie odtworzono (0/24), przyjęte z analizy kodu
- Ważność: S4 (narzędzie, poza CI) · Koszt: mały
- Dowód: po G-031 `captureFrame` nie rysuje własnej klatki. `e2e/glitch-shots.spec.ts:34-35` czeka na `frames() > n && citySettled()`, więc gdy miasto ułoży się w klatce pominiętej przez pacer, zrzut pokazuje ostatnią klatkę sprzed końca wczytywania. Sonda: 2 z 15 punktów, (520, −63) i (146, −49), przy load 11–12. Poprawka: czekać na klatkę narysowaną już po `citySettled`, jak `sampleNow` w npr-perf.
- Pakiet właściciela: e2e (QA)

### G-057 Kościoły z wieżyczkami z OSM dostają dodatkowo proceduralne wieże renderera
- Status: naprawione (#69). Flaga `carriesParts` dla obrysu z częściami z `soffit`; skan `church-towers-over-parts` 2 → 0
- Ważność: S3 (proponowana) · Zasięg: Archikatedra i inne kościoły z `building:part` · Koszt: mały
- Dowód: po G-049 Archikatedra ma wieżyczki z części OSM i proceduralne wieże z `roof-plan`
- Pakiet właściciela: packages/engine (mapcity)
- Test przyjęcia: kościół, który ma części `building:part`, nie dostaje proceduralnych wież

### G-050 Nadbudowa Podzamcza przy Bramie Grodzkiej góruje 16 m nad bramą
- Status: naprawione (#60). Piętra nadbudowy ponad zabytkiem ≥ 5 m od jego obrysu, próg przylegania 5 m; skan `landmark-overbuilt` 25 → 0. Kurator proponuje dalej regułę 45° (T-011), do decyzji użytkownika
- Ważność: S3 (proponowana) · Zasięg: lokalny (widok z Zamku i Placu Zamkowego na bramę) · Koszt: mały (vertical.ts)
- Gdzie: Grodzka 36a w66293355 (717.5, 162), Podzamcze; ile w mieście: 2 (z kontrolą `landmark-overbuilt` niżej; druga to w66324576 przy Kościele Ewangelicznym r6476361)
- Dowód: `verticalOf` daje `rise=15`, szczyt na y 17,5, a brama ma szczyt na y 1,7; T-011
- Przyczyna (przypuszczalna): reguła `targ` nie bierze pod uwagę sąsiadującego landmarku
- Pakiet właściciela: packages/sim (content/lublin/vertical.ts)
- Test przyjęcia (decyzja użytkownika 31.10: nadbudowy zostają, lekko odsunięte): budynek PRZYLEGAJĄCY do landmarku (odstęp obrysów < 5 m; zabytki i gmachy publiczne, także `civic` bez nazwy) zachowuje nadbudowę, ale żadne piętro nadbudowy ponad szczytem landmarku nie stoi bliżej niż ok. 5 m od jego obrysu. Obcinanie wysokości z e783f82 odrzucone; zostaje tylko tam, gdzie po odsunięciu nie mieści się żadne piętro
- Uwaga: odsunięcie wymaga informacji o stronie landmarku w `BuildingVertical` (port w core, obszar architekta): rozszerzenie kontraktu z dopiskiem do ADR-0051
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-062 Przejścia pod mostami zablokowane: grunt pod pomostem to pomost (Podwale, bulwar Bystrzycy)
- Status: naprawione (#70). Pomost > 2 m nad terenem i nad stopami jest sufitem; skan `under-deck-blocked` 6 → 0. Skutki uboczne: G-068–G-072
- Ważność: S3 (proponowana) · Zasięg: lokalny (2 miejsca, 6 par droga × most) · Koszt: średni
- Gdzie: Podwale w66318260 (747, 166) z chodnikami w56965511, w56965514 i schodami w56965515 pod wiaduktem Zamkowej (teren −19,2, pomost −13,5); ścieżka bulwaru w307943890 pod mostami Mełgiewskiej (2435, 262) i (2450, 306); T-024
- Dowód: `groundY` zwraca pomost (sonda kuratora `topo-deck`); ADR-0053 to przyznaje
- Pakiet właściciela: packages/sim (world/deck, lublin/decks), packages/engine (mapcity)
- Test przyjęcia: idąc Podwalem i bulwarem, grunt pod pomostem nie skacze o więcej niż 0,5 m; kontrola `under-deck-blocked` 6 → 0

### G-068 AI nie widzi przejścia pod mostem: walczący wręcz utyka na skarpie bulwaru
- Status: naprawione (#71). Pomost jest sufitem dla AI tylko, gdy NPC albo cel stoi pod nim; pierwsza wersja (7b118fd) odrzucona za regresję na wiadukcie Zamkowej
- Ważność: S3 (proponowana: bezpieczne miejsce przed walką wręcz) · Zasięg: przejścia pod pomostami (Mełgiewska, Podwale) · Koszt: mały
- Gdzie: gracz pod dolnym mostem Mełgiewskiej (2445.9, 302.2); `hebi_brawler` startujący od południa (2449, 318) utyka w (2458.4, 314.2) i przez 20 s zostaje 16–17 m od gracza
- Przyczyna: `packages/sim/src/systems/ai/steering.ts` `terrainOf` (l.140), `closeBanks` (l.155), `bankBetween` (l.359) wołają `heightAt`/`steepAt` bez `reach` (G-062), więc AI widzi pomost jako grunt
- Pakiet właściciela: packages/sim/src/systems/ai
- Test przyjęcia: zaalarmowany walczący wręcz dociera do gracza pod mostem Mełgiewskiej z obu stron w < 10 s

### G-067 Klasztor Dominikanów dostaje proceduralne wieże kościoła
- Status: naprawione (#72). `monastery` i `convent` jako `historic`, bez wież proceduralnych
- Ważność: S4 (proponowana) · Zasięg: 1 znany · Koszt: mały
- Gdzie: r2366732 (748.5, −104.4), Stare Miasto
- Dowód: budynek klasztoru ma `use: church`, więc `addTowers` stawia na nim wieże kościoła, choć to klasztor; widać z ujęcia „Dominikanie od wschodu” (810, −56)
- Pakiet właściciela: tools/osm-import (building-tags) / packages/engine (mapcity)
- Test przyjęcia: klasztor bez wież proceduralnych; kościół obok zachowuje swoje

### G-051 Podpis „Muzeum Historii Miasta Lublina” na kamienicy Jezuicka 3 zamiast na Bramie Krakowskiej
- Status: naprawione (#75, z etapem 1 ADR-0062). Nazwa z punktu tylko przy zgodnym adresie
- Ważność: S4 (proponowana) · Zasięg: lokalny · Koszt: mały (labels/buildings w tools/osm-import)
- Gdzie: w66286384 (478.7, −114.4); ile w mieście: 1 znane
- Dowód: węzeł n993790419 `addr:street=Plac Władysława Łokietka addr:housenumber=3` leży w obrysie Jezuickiej 3, 6 m od r7224409; T-013
- Przyczyna (przypuszczalna): nazwa trafia do budynku zawierającego punkt, a adres węzła nie jest porównywany z adresem budynku. Możliwa też poprawka położenia węzła w OSM
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: po regeneracji w66286384 nie ma nazwy muzeum, a r7224409 nosi nazwę Bramy Krakowskiej (nazwa budynku ma pierwszeństwo przed punktem)
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-064 Targowiska bez straganów (Targ na Ruskiej, Bazar, Giełda na Kresowej)
- Status: naprawione (#76). 420 straganów w rzędach; skan `marketplace-empty` 3 → 0
- Ważność: S4 (proponowana) · Zasięg: 3 · Koszt: mały
- Gdzie: w182461192 (787, 561), w67502759 (681, 413), w231445090 (x 2300..2383); T-026
- Dowód: `props.generated` nie ma `market-stall` w podzamcze-1-1 i 0-1
- Pakiet właściciela: tools/osm-import (props-gen)
- Test przyjęcia: każdy obrys `amenity=marketplace` w dzielnicach ma ≥ 1 stragan na 150 m²; kontrola `marketplace-empty` 3 → 0

### G-056 Kształt dachu z OSM (`roof:shape`) ignorowany: hełmy, kopuły i dachy dwuspadowe jako czterospadowe
- Status: naprawione (#78, ADR-0064 etap 1). Dachy z `roof:shape`/`roof:orientation`; skan `roof-shape-ignored` = 0. Dalej: G-080
- Ważność: S3 (proponowana) · Zasięg: zabytki Starego Miasta i Krakowskiego · Koszt: średni (pole w widoku `building`, czyli kontrakt w core/ports i ADR)
- Dowód: hełm wieży Bramy Krakowskiej rysuje się jako dach czterospadowy i zasłania 3,2 m ścian ośmioboku; to samo przy cebulach i kopułach
- Pakiet właściciela: tools/osm-import, packages/engine (mapcity), kontrakt: architekt

### G-061 Część `building:part` bez obrysu `building` nie trafia do gry (pawilon Bona)
- Status: naprawione (#74). Osierocone części jako budynki (`orphanParts`/`asBuilding`); skan `building-part-orphan` = 0
- Ważność: S4 (proponowana) · Zasięg: 1 · Koszt: mały
- Gdzie: w1236054202 (708.4, 166.8), Podzamcze; T-020
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola skanu `building-part-orphan` (część bez obrysu i bez bryły w grze), baza 1 → 0

### G-076 Przejazdy bramne z `tunnel=yes` zamknięte bryłą (Gruella pod Trynitarską, Królewska, Sąd Okręgowy, Rynek 5)
- Status: naprawione (#80). `streetLevelTunnels`: przejazdy `tunnel=yes`/`covered=yes` na poziomie ulicy jako przejścia; skan `passage-blocked` 9 → 0. Dalej: G-089 (maxheight), G-079 (w586408568)
- Ważność: S2 (proponowana) · Zasięg: 9 miejsc, w tym zabytek · Koszt: mały
- Gdzie: Gruella w298307007 (587.6, −147); Sąd Okręgowy w343899807 (1.4, −96.1); Peowiaków 13 w343899804 (−48.5, −167.8); Królewska, 5 bram kamienic (x 387..489); Rynek 5 w1222303436 (562, −29.1); T-036…T-039
- Dowód: zalewanie siatki 0,25 m: ciało 0,38 m nie przechodzi; tagi OSM `tunnel=yes`
- Przyczyna (przypuszczalna): `passages.ts` bierze tylko `tunnel=building_passage`, a `underground()` w `ground.ts` zabiera nawierzchnię
- Test przyjęcia: kontrola `passage-blocked` (definicja kuratora w `scratchpad/topo-bramy-raport.md`), baza 9 → 0


### G-077 Budynek podziemny zbudowany na powierzchni ul. Zamkowej
- Status: naprawione (#80). `buildingAreas` pomija `location=underground`; skan `building-underground-solid` 1 → 0. Odsłonięte: G-088
- Ważność: S2 (proponowana: zasłania 11,5 m osi drogi na dojściu do Zamku) · Koszt: mały
- Gdzie: w980143457 (771.1, 190.5), `location=underground`, `layer=-1`, bryła 6,9 m na osi w154962966; T-041
- Pakiet właściciela: tools/osm-import (`buildingAreas`)
- Test przyjęcia: kontrola `building-underground-solid` 1 → 0

### G-058 Dotknięcie pierwszego wyboru tuż po otwarciu dialogu czasem ginie (e2e touch)
- Status: naprawione (#50, e970b3d: osłona przed „ghost click” G-048 wygasa przy następnym `pointerdown`). Na bazach z czerwonymi przebiegami (c07dea9, gałąź etapu 5) tej poprawki nie było; ślad: tap 325 ms po „Use” zjadany w fazie capture. Na main 20/20 zielonych przy `--repeat-each=10` i 14/14 z dławieniem CPU ×6 i ×20; test komponentu `ghost-click.test.tsx` („a real tap on a choice right after the talk opens…”) pada na starym pliku
- Ważność: S3 (proponowana: flake w CI i możliwy błąd dotyku na telefonie) · Koszt: mały
- Dowód: `e2e/touch.spec.ts:56-57` „on-screen pad”: 1/4 czerwony na bazie c07dea9 i 2/5 na etapie 5 przy load 6–9; dotknięcie wyboru zaraz po otwarciu koła kwestii nie wybiera kwestii. Sprawdzić, czy koło przyjmuje dotyk przed pierwszym renderem albo czy działa osłona przed „ghost click” (G-048)
- Pakiet właściciela: packages/ui / e2e (QA)

### G-075 Kolizje aut na przecięciu pasów 3 Maja przy Zesłańców Sybiru
- Status: naprawione (#85). `crowded` sprawdza obrócone ciało i następne 12 m obu pojazdów, `onItsWay` następne 6 m pojazdu w tę samą stronę; 3 Maja ziarna 1–30 bez kolizji
- Ważność: S3 (proponowana) · Zasięg: jedno skrzyżowanie · Koszt: mały–średni
- Gdzie: (−110, 56), przecięcie pasów 3 Maja#31:0 i #31:1
- Dowód: `traffic-junction-drive` na gałęzi G-052: Peowiaków ziarna 3 i 7 po 2 kolizje (próg 0), 3 Maja ziarno 7: 3 (próg 2)
- Pakiet właściciela: packages/sim (traffic-junctions)
- Test przyjęcia: `traffic-junction-drive` w progach na gałęzi G-052 i na main

### G-089 Bramy z maxheight=below_default ze sklepieniem 4 m
- Status: naprawione (#89). `vaultOf`: `maxheight` → sklepienie, `below_default` 3,6 m (szacunek, do potwierdzenia zdjęciem); skan `passage-maxheight` 3 → 0
- Gdzie: Królewska w755152552/555/560; T-054
- Przyczyna: `buildingPassages` (wysokość w `out.push`, przy `widthOf`) nie czyta `maxheight`
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: kontrola `passage-maxheight` 3 → 0 (np. sklepienie 3,6 m dla `below_default`)

### G-090 Przesunięcie pasa ruchu z mediany szerokości całego łańcucha ulicy
- Status: naprawione (#88). `laneLine`: przesunięcie pasa zwężane lokalnie (okno ±10 m, ≤ 0,1 m/m); 6 ze 149 pasów na main
- Ważność: S3 (proponowana; na łańcuchach o różnej szerokości pas wychodzi poza wąski odcinek, latarnie w pasie) · Zasięg: łańcuchy ulic z odcinkami różnej szerokości · Koszt: mały–średni
- Gdzie: Staszica (dopasowany w1150131461, połowa asfaltu ok. 2,0–2,5 m, i odcinek 3,25 m); latarnie `lamp-road` (217, 145) i (205, 118) 1,03 m od pasa
- Przyczyna: `packages/sim/src/content/traffic.ts` `lanesOf` bierze `laneOffset(roadHalfWidth(...))` z mediany całego łańcucha (2,75 → pas 1,375 m od osi) zamiast lokalnej szerokości odcinka (1,2 m)
- Pakiet właściciela: packages/sim (content/traffic)
- Test przyjęcia: z łatką G-082 (`scratchpad/g082-wip.patch`) `furniture-in-car-lane` 2 → 0 bez wzrostu `car-lane-off-road`, `lane-dead-end`, `turn-off-road`; świadoma zmiana złotego hasha, jeśli ruch się zmienia
- Uwaga z naprawy G-082: ulice ok. 3–4 m mają w sim dwa pasy, a auta (pół szerokości 0,9 m) zachodzą na chodnik; żadna kontrola tego nie liczy

### G-052 Teatr Osterwy i Kościół Bernardynów poza danymi miasta (brzeg Krakowskiego na z = −200)
- Status: naprawione (#87). Krakowskie do z = −270 (Teatr Osterwy, Bernardyni, Brygidki, III LO); baza `lane-dead-end` 45 (G-074 odłożone), budżet reference 194/81 z długiem w ADR-0046; uwagi kuratora: G-096…G-099, T-057…T-061
- Ważność: S3 (proponowana) · Zasięg: lokalny (Narutowicza, Bernardyńska) · Koszt: duży (prostokąt w config.ts, ADR-0042, regeneracja, budżety)
- Gdzie: (118.0, −205.7), (364.7, −239.8); ile w mieście: 2 zabytki z listy kuratora
- Dowód: brak w66330578 i w67508958 w `*.generated.ts`, `DISTRICTS[0].rect.minZ = −200`; T-014
- Przyczyna (przypuszczalna): zasięg prostokąta Krakowskiego (ADR-0042)
- Pakiet właściciela: tools/osm-import (decyzja: Architekt, ADR-0042)
- Test przyjęcia: kontrola `landmark-missing` daje 0
- Źródło: audyt topografii 1 (kurator, 31.10).

### G-094 Przedsionek Trasy Podziemnej: pierwsze 4,5 m poza obszarem wnętrza
- Status: naprawione (#90). Początek Trasy Podziemnej z obrysu OSM (`facadeAt`); kontrola `interior-entrance-gap` 1 → 0; resztka: G-111
- Ważność: S4 (proponowana) · Zasięg: 1 wejście · Koszt: mały
- Gdzie: wejście do Trybunału w66264159, przedsionek z = −57; fasada przecina go skośnie (x 567,5…568,2), luka w obszarze wnętrza x 567,6…570 (2,4 m; poprawka naprawiacza)
- Dowód: `interiorAt` na stopie (y = podłoga przedsionka + 0,1, z = −57): x 565,6/567/569/569,9 → null, x 570,1 → `trasa-podziemna`; `TRASA_PODZIEMNA.vestibule.from.x` = 565,5, pierwszy pokój `minX: 570`; zrzut `scratchpad/shots1/p1-trasa-vest.png`; test w `interior-areas.test.ts` zaczyna chód od x = 563, a wyjście liczy od 571, więc tego nie łapie
- Skutek: `InteriorEntered` (autozapis, ambient ADR-0060) 4,5 m za drzwiami, już w ciemnym korytarzu; wyjście symetrycznie
- Przyczyna (przypuszczalna): pierwszy pokój zaczyna się od zgadniętego `minX: 570` w `content/kanal-underground.ts` zamiast od `T.vestibule.from.x`
- Pakiet właściciela: packages/sim
- Test przyjęcia: `interiorAt` na (vestibule.from.x + 0,3, −57, door + 0,1) zwraca `trasa-podziemna`; kontrola skanu `interior-entrance-gap` (punkt 0,3 m za fasadą przy drzwiach/przejściu budynku wnętrza leży w obszarze) 1 → 0

### G-125 Ekranu opcji nie da się przewijać na telefonie
- Status: naprawione (#94). `.screen`: `overflow-y: auto`, `justify-content: safe center`; test e2e na telefonie 844×390
- Ważność: S2 (proponowana; na telefonie część opcji, m.in. dostępność, nieosiągalna) · Zasięg: każde menu pełnoekranowe wyższe niż ekran (pauza z opcjami, sloty, autorzy) · Koszt: mały
- Przyczyna: `.screen` z `justify-content: center` bez `overflow-y`, a `html, body` z `overflow: hidden`
- Pakiet właściciela: packages/ui
- Test przyjęcia: `e2e/touch-layout.spec.ts` „phone: the settings in the pause menu scroll to their last control” (844×390)

### G-087 `stepRamps` tylko dla nazwanych schodów
- Status: rozstrzygnięte (#97): rampy tylko dla nazwanych schodów, poprawny opis w `shape.ts`; reszta biegów na terenie zgodnym z NMT
- Gdzie: `packages/sim/src/content/lublin/shape.ts` `stepRamps` czyta `c.streets` (tylko nazwy) → 3 rampy z 69 biegów
- Decyzja: albo rampy dla wszystkich biegów (wtedy sprawdzić `terrain-off-pads`, `steps-micro-riser`), albo poprawić komentarz

### G-131 Etap 1 obezwładnienia: trzy błędy z weryfikacji
- Status: naprawione (#100, ADR-0065 etap 1): poprawki przed PR, sondy weryfikatora jako testy
- Błędy: klawisz interakcji obezwładnia mimo podpowiedzi bliższego celu (rozmowa, łup, drzwi); ogłuszony po parowaniu zostaje „w walce” (`ai.alerted`, RAM i aktywności); przytrzymany atak jako „zabij” strzela po obezwładnieniu
- Pakiet właściciela: packages/sim, packages/app
- Test przyjęcia: sondy weryfikatora (`scratchpad/v-a-probes/`) jako testy, padające przed poprawką

### G-127 Parterowy pawilon na skwerze jako czterokondygnacyjna wieża (Bar Centralny przed Pedetem)
- Status: naprawione (#103): `smallAlone`, 15 pawilonów z 2–4 kondygnacji na 1, `small-freestanding-tall` 16 → 2 (reszta w G-134)
- Ważność: S3 (proponowana; stoi na osi widoku z deptaku na Pedet i zasłania go) · Zasięg: 24 wolnostojące obrysy < 60 m² w mieście · Koszt: mały
- Gdzie: w665959137 (112.5, −84.6), skwer Witkowskiego; T-074. Inne: w631242940 (−86, 19.8) na Placu Litewskim, w67499328 (130.8, 17.5), w458298770 „VapeTube” (851.5, 369.7), w458298766 „Hunek” (817.1, 373.5) i 19 dalszych (lista w `topo-pedet-raport.md`)
- Dowód: okrągły obrys o średnicy 6,7 m (pole 33 m²), `building=yes` bez kondygnacji; w grze `levels: 4`, 13,7 m, `residential` z witryną; zrzut `pedet-north.png`: czerwona kamienica z roletami po prawej, przed Pedetem
- Przyczyna: `defaultLevels` daje 1 kondygnację tylko pod 25 m²; większy wolnostojący pawilon dostaje piętra dzielnicy jak kamienica
- Pakiet właściciela: tools/osm-import (`building-tags.ts`)
- Test przyjęcia: nowa kontrola `small-freestanding-tall` (niżej) 24 → co najwyżej przypadki potwierdzone przez kuratora; w665959137 ma 1 kondygnację

### G-097 Teatr Osterwy jako kamienica mieszkalna
- Status: naprawione (#104)
- Gdzie: w67508958 (118.0, −205.7); T-059
- Przyczyna: `buildingUse` czyta tylko tagi obrysu (`building=yes`); punkt `amenity=theatre` w obrysie daje nazwę, nie przeznaczenie
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: punkt `amenity=theatre`/`arts_centre` w obrysie `building=yes` daje `use=civic`; kontrola `theatre-not-civic` 1 → 0; wysokość według zdjęcia lub LOD2 (ADR-0062 etap 7)
- Uzupełnienie (audyt gmachów publicznych, 31.10): ten sam mechanizm dotyczy punktów `amenity=townhall|courthouse|library` (Pedagogiczna Biblioteka Wojewódzka n10568650059 w w55897083, T-069: `residential` z nadbudową +21 m). Reguła tylko przy zgodnym adresie (jak G-051) i dla `building=yes|public|government|civic`. Punktów `office=government` reguła nie obejmuje, bo bywają lokalem w kamienicy (Biuro Rozwoju Turystyki UM n9529164485 w w66293242). Kontrola `civic-as-residential` (część B) 2 → 0

### G-116 Ułamkowe `building:levels` zaokrąglane w górę (Ratusz o 1,6 m za wysoki)
- Status: naprawione (#104)
- Ważność: S4 (proponowana) · Zasięg: 6 obrysów i części (Ratusz w66264120 z wieżą w619138854, kościół Dominikanów w66286338 z w618270604 i w618270605, w55897040) · Koszt: mały
- Gdzie: Ratusz (416.1, −69.6); T-064
- Dowód: `heights` w `tools/osm-import/src/building-tags.ts`: `levels = Math.round(4.5) = 5` i `walls = floors(levels)`, czyli 16 m zamiast 14,4 m. Wieża Ratusza 7,5 → 8 kondygnacji
- Przyczyna: ściany liczone z zaokrąglonej liczby kondygnacji
- Pakiet właściciela: tools/osm-import
- Test przyjęcia: `building:levels=4.5` daje ściany 14,4 m nad cokołem, a w siatce okien 4 kondygnacje (wyższe, po 3,6 m); kontrola `fractional-levels-rounded` 6 → 0

### G-120 Urzędy z `office=government` w tagach obrysu jako kamienice z nadbudową
- Status: naprawione (#104)
- Ważność: S3 (proponowana; nadbudowa 2,4–3,4 raza wyższa od gmachu) · Zasięg: 2 (Kuratorium Oświaty w55897069, Urząd Miasta przy Placu Litewskim 1 w67498728) · Koszt: mały
- Gdzie: (−132.0, 74.5) i (118.7, 35.9); T-068
- Dowód: `buildingUse` nie czyta `office` ani `government`, więc z `building=yes` wychodzi `residential`. `landmarkName` gubi wtedy nazwę, a `verticalOf` daje +24 m i +21 m
- Pakiet właściciela: tools/osm-import (`building-tags.ts`)
- Test przyjęcia: obrys z `office=government` albo `government=*` daje `use=civic` z nazwą; kontrola `civic-as-residential` (część A) 2 → 0; baza `landmark-overbuilt` bez wzrostu

### G-130 Pojazdy zapadnięte pod nawierzchnię (wrak na deptaku przy Pedecie)
- Status: naprawione (#107): pojazdy na najwyższym punkcie nawierzchni, bez postoju na spadku > 0,15 m, auta jadące z `SURFACE_LIFT`; `vehicle-below-surface` 77 → 0, `vehicle-off-surface` 15 → 0
- Ważność: S3 (proponowana; widoczne na głównym ciągu pieszym) · Zasięg: 38 z 87 pojazdów w mieście zapadniętych ponad 0,15 m pod rysowaną nawierzchnię, 8 ponad 0,25 m · Koszt: mały
- Gdzie: wrak (152.6, −51.0) na deptaku Krakowskiego Przedmieścia przy wylocie Kapucyńskiej, ok. 50 m od Pedetu; T-077. Najgłębiej: dostawczak (544.7, 167.7) 0,36 m, furgonetki na Placu Zamkowym (757, 249.4) 0,30 m, taxi (810.3, 481.3) 0,29 m
- Dowód: pojazd ze zgłoszenia to blok sceny `wreck` z `DISTRICT_M0_PROPS` (`district-m0.ts`, grupa `WRECK` (150, −20), skrzynia (2.6, −31)), nie auto zaparkowane: w promieniu 80 m od Pedetu nie ma żadnego z 80 `PARKED_CARS`. Stoi na nawierzchni `square` (4/5 narożników). Jego spód leży na terenie w środku (y 0,54), teren pod narożnikami ma 0,50–0,61, a renderer kładzie `square` 0,08 m nad terenem (`SURFACE_LIFT`). Koła są więc do 0,15 m pod płytami. To samo dotyczy aut zaparkowanych i jadących: `PARKED_CARS` i `vehicleEntity` biorą `groundY` ze środka, z `pitch: 0`, a jezdnia jest rysowana +0,10 m, chodnik +0,16 m. Zrzuty `wreck.png`, `pedet-wide.png` i `wreck-side.png` (z boku: dolna ćwiartka kół schowana pod płytami)
- Przyczyna: wysokość pojazdu liczona od gołego terenu w jednym punkcie, bez podniesienia nawierzchni i bez pochylenia na spadku
- Pakiet właściciela: packages/sim (`content/parked-cars.ts`, `content/district-m0.ts` przez `standing`, `systems/traffic-system.ts`), a wysokości nawierzchni z `packages/engine/src/renderer/mapcity/ground-plan.ts` (`SURFACE_LIFT`) przenieść do kontraktu w `core`, żeby sim je znał
- Test przyjęcia: kontrola `vehicle-below-surface` 38 → 0; dla wraku najwyższy narożnik nawierzchni ≤ spód + 0,05 m; złoty hash symulacji zmieniony świadomie, jeśli zmieni się y aut

### G-140 Zaparkowane auta na wjazdach i wylotach dróg serwisowych (Cerkiewna)
- Status: naprawione (#110): `serviceWays` w chunkach, auta co najmniej półszerokość + 0,5 m od osi dróg serwisowych; `parked-car-on-service-road` 3 → 0; aut 63 → 61 (próg testu ruchu > 60)
- Ważność: S4 · Zasięg: 3 auta (Cerkiewna (908.8, 440.5) na `driveway` w1381877866, (912.2, 416.4) i (910.8, 422.5) przy wylocie `service` w739432848)
- Przyczyna: `offOtherRoads` w `parked-cars.ts` pilnuje tylko ulic z `CAR_KINDS`, bez `highway=service`
- Poprawka: w `fits()` odstęp od osi `highway=service` (poza `parking_aisle`) co najmniej półszerokość + 0,5 m. Uwaga (1.11): dane chunków sim mają tylko nazwane ulice, a `service` i `driveway` przy Cerkiewnej są bez nazwy, więc najpierw import musi przenosić osie nienazwanych dróg serwisowych (osobne pole, nie `streets`); koszt mały–średni, nie drobna poprawka
- Pakiet właściciela: packages/sim (content)
- Test przyjęcia: kontrola skanu „auto bliżej niż 1,5 m od osi `service`”, baza 3 → 0

### G-114 npr-perf Nabrzeże: czasem +98 wywołań rysowania przy tych samych siatkach
- Status: naprawione (#113): `sampleNow` czeka na klatkę po kroku, kontrola braku renderu sondy `WetProbe` między ustaleniem miasta a próbką; `citySettled` czeka na zaległy render sondy (zabezpieczenie)
- Dowód: 334/102 albo 338/102 zamiast 236/102 w ok. 2 z 7 pełnych przebiegów przy obciążeniu, przy identycznym `byName` siatek i +431 tys. trójkątów; na bazie 0 z 3 próbek (za mało, by wykluczyć)
- Dowód 2 (1.11, weryfikacje Grodzkiej i G-130): 338/102 w 1 z 3 pełnych przebiegów, sama scena 0 z 10 (gałąź i main po 5); ta sama sygnatura (+102 wywołania, +482 tys. trójkątów, identyczne `byName`). Wskazuje na zależność od wcześniejszych testów w przebiegu albo od czasu sondy `WetProbe`; trafia też w weryfikacje innych zmian, więc priorytet rośnie
- Przyczyna (przypuszczalna): w próbkowanej klatce renderuje się sonda odbicia `WetProbe` (6 ścian × ok. 16 siatek + cień); `ProbeSchedule` dławi rendery do 1 s czasu rzeczywistego, a `citySettled`/`sampleNow` na to nie czeka (por. G-001)
- Pakiet właściciela: packages/engine (renderer) / e2e (QA)
- Test przyjęcia: pomiar `npr-perf` czeka na ustalenie sondy; 10 przebiegów Nabrzeża pod obciążeniem bez +98

### G-139 Smoke „title → new game”: gracz przechodzi 2,09 m zamiast ponad 2,5 m przy szybkim starcie
- Status: naprawione (#112): `pointerlockerror` od odrzuconej opcji `unadjustedMovement` nie wyłącza blokady; o odmowie decyduje obietnica żądania
- Ważność: S3 (fałszywie czerwony smoke w CI)
- Gdzie: `e2e/smoke.spec.ts`, test „title → new game → … IndexedDB”: przy starcie ok. 14 s ruch w pierwszych 60 krokach daje 2,09 m; bez renderera zawsze 4,20 m, więc to wyścig startu w aplikacji (może z ekranem ładowania #102: kroki liczone przed końcem `prepare` albo wejście przed pointer lockiem)
- Pakiet właściciela: packages/app, e2e (QA)
- Test przyjęcia: przyczyna ustalona śladem; test czeka na stan gry, nie na zegar (ADR-0046); 10 przebiegów bez błędu

### G-141 Obezwładnienie: telefon świadka kończy się w trakcie chwytu; wyjątek pomocnika bez testu
- Status: naprawione (#114): świadek w chwycie wstrzymuje telefon (po ogłuszeniu urwany, po wyrwaniu wraca); test wyjątku `helper`; zapis w ADR-0065
- Ważność: S4 · Koszt: mały
- Gdzie: `runCalls` sprawdza `c.unconscious`, nie `incapacitated`: telefon, któremu zostało mniej niż `TAKEDOWN_TIME` (1,2 s), dochodzi, gdy gracz trzyma świadka w chwycie (sonda: 0,38 s pozostałych, 1 zgłoszenie); wyjątek `helper` w `react` (`crime-system.ts` ok. l. 155) bez testu (świeże, niezauważone ciało, pomocnik znajduje je pierwszy)
- Pakiet właściciela: packages/sim
- Test przyjęcia: oba przypadki jako testy symulacji, padające bez poprawki

### G-138 Pasy ruchu na szwach chunków i krawędziach mapy bez nawierzchni
- Status: naprawione (#115): końce pasów 0,1 m przed krawędzią mapy (`onTheMap`), `lane-off-ground` 56 → 9 (reszta: zawracanie na Alei Tysiąclecia i G-144)
- Ważność: S4 · Zasięg: 56 z 23 374 punktów pasów (co 1 m), na szwach chunków (z ≈ 160) i krawędziach mapy
- Gdzie: `surfacesAt` nie zwraca tam żadnej nawierzchni, a `GroundField.heightAt` różni się od `groundY` (np. (−96.3, −270.5): −1,80 zamiast 0,00); sprawa sprzed G-130
- Pakiet właściciela: packages/sim (content/lublin, ground)
- Test przyjęcia: kontrola skanu dla punktów pasów bez nawierzchni, baza 56 → 0 albo uzasadnione wyjątki

### G-135 Pointer lock bez gestu: panel otwarty i zamknięty Esc przed pierwszym kliknięciem po ekranie ładowania
- Status: naprawione (#116; NotAllowedError, czyli brak gestu, nie ustawia `lockUnavailable`; następne kliknięcie bierze blokadę)
- Ważność: S4 (proponowana) · Zasięg: desktop, tylko gdy gracz otworzy panel przed pierwszym kliknięciem po ładowaniu
- Gdzie: `packages/app/src/pointer-focus.ts`: zamknięcie panelu Esc woła blokadę od razu; strona bez wcześniejszej blokady i bez gestu może dostać odmowę, a odmowa ustawia na stałe `lockUnavailable` (`browser-input.ts:154` po G-139: odrzucona obietnica ponowionego żądania)
- Pakiet właściciela: packages/app, packages/engine/src/input
- Test przyjęcia: prawdziwy Chrome (e2e) z tym przebiegiem; po odmowie kolejne kliknięcie nadal blokuje

### G-136 Przejazd Bramy Grodzkiej poza osią frontów
- Status: naprawione (#117): przejazd w osi obu frontów, 3 osie okien co 2 m, trasa dostaw na osi, latarnie spod sklepienia; prześwit (T-086) osobno
- Ważność: S3 · Zasięg: lokalny (Brama Grodzka) · Koszt: niski
- Gdzie: `GATE_PASSAGES` w `packages/sim/src/content/lublin/sites.ts` biegnie za węzłem drogi OSM w293488528, ok. 1,4 m na południe od osi bramy; łuk przesunięty o 1,64 m (od Grodzkiej) i 1,36 m (od Zamku) od środka widocznego frontu, przez co przepis ma 2 osie okien zamiast 3
- Poprawka: przejazd przesunięty prostopadle o ok. 1,4 m na północ, (701,0, 129,4)→(727,0, 153,6); potem przepis z 3 osiami co 2,1 m; prześwit łuku (T-086) przy okazji
- Pakiet właściciela: packages/sim (złoty hash zmieniony świadomie), packages/engine (przepis)
- Test przyjęcia: proponowana kontrola skanu `gate-mouth-off-axis` (środek wylotu dalej niż 0,5 m od środka czystej części frontu), baza 2 → 0; Krakowska do zmierzenia przed ustaleniem bazy

## Naprawione przed archiwum wpisów (tabela z rejestru, do G-141)
| ID | Glitch | PR |
|---|---|---|
| G-100 | Plamy blasku przez ściany (warstwa glow bez przesłon), odbicia ignorujące wysokość | #19 |
| G-101 | Spód dachów czterospadowych w dali | #20 |
| G-102 | Myjnia na placu przed ratuszem; wieża Trynitarska jako zwykła kamienica; brzegi fontann; ruch bez ustępowania na skrzyżowaniach | #21 |
| G-103 | Piesi z placów na jezdniach; zebry niewidoczne pod brukiem | #22 |
| G-104 | Jezdnia pod placami i chodnikami; brak oznakowania poziomego | #23 |
| G-105 | Ulice jednokierunkowe jeżdżone w obie strony | #24 |
| G-106 | Auta przez hale targu; zderzenia przy wjeździe na rondo Dmowskiego | #25 |
| G-107 | Sygnalizatory, automaty i drzewa na jezdni; stragany na pasach parkingu | #26 |
| G-108 | Dostawczaki przez ściany Rybnej i Ku Farze (bramy z OSM); piesi deptaków zawracający na ulicy | #27 |
| G-109 | Stragany i szafki bez bryły; rzeźby w ścianach; jezdnia mostów w korycie Bystrzycy | #28 |
| G-110 | Wrak, furgonetka i kontener zapadnięte w zbocze | #29 |
| G-001 | Test migawki NPR przekracza 90 s na wolnym runnerze CI | #39 |
| G-002 | Dostawczak jedzie przez bramę Ku Farze z zakazem wjazdu | #44 |
| G-008 | Budynki z OSM wchodzą w sceny targu i doków | #33 |
| G-009 | Auta zaparkowane przy krawężniku stoją na trawniku i chodniku | #31 |
| G-010 | Brama przy północnej krawędzi mapy kończy się w pustce, posadzka wznosi się o 2,4 m | #31 |
| G-011 | Meble wewnątrz budynków: reflektory w Wieży Trynitarskiej, Archikatedrze i przy Zamku, kioski w swoich budynkach, wiata w ścianie | #32 |
| G-012 | Meble z bryłą nachodzą na siebie: kosze w pniach drzew na deptaku | #35 |
| G-013 | Narzędzie zrzutów: kadr przesunięty o jedno miejsce albo powtórzony | #37 |
| G-014 | Auta zaparkowane na przejściach dla pieszych | #32 |
| G-015 | Auta zaparkowane tyłem do ruchu na ulicach jednokierunkowych | #34 |
| G-017 | Wiaty przystanków z OSM jako trzypiętrowe bloki mieszkalne na Alei Tysiąclecia | #34 |
| G-019 | Auto z jednokierunkowej pętli Cerkiewnej stoi na trzypasmowej jezdni Alei Tysiąclecia | #36 |
| G-020 | Jezdnia zachodnia Alei Tysiąclecia ma 36 m bez pasa (literówka „Aleje” w OSM) | #38 |
| G-021 | Szwy chunków ucinają krótkie kawałki ulic: dziury w pasach aut (Narutowicza, Lubartowska ×2) | #40 |
| G-023 | Pasy aut kończą się bez zawrotki przy ulicach dla dostaw i na końcach ulic | #37 |
| G-028 | Resynchronizacja przenosi auto w łuk zawrotki z pełną prędkością | #38 |
| G-029 | Kliknięcie „Nowa gra” w `models.spec.ts` wisi ponad 60 s na CI | #46 |
| G-032 | Słupki przy ulicach stoją chaotycznie: łańcuchy celują w różne strony i nie łączą sąsiadów; słupki za małe | #45 |
| G-033 | Postać, która przechodzi w inne miejsce według flag, „umiera”: renderer gra upadek | #46 |
| G-034 | Kaito od początku w Neon Koi (decyzja użytkownika) | #46 |
| G-035 | Wskaźniki zadań nie prowadzą do postaci z wątku: nie da się znaleźć babci Ume | #43 |
| G-039 | Łańcuch słupków przechodzi przez podstawę latarni na Placu Łokietka | #45 |
| G-018 | Pionowy pas czarnych kresek na bruku Placu Litewskiego | #47 |
| G-030 | Poza Seki w klatce referencyjnej zależy od czasu zegarowego | #47 |
| G-044 | Tłum i pozy czynności animują się zegarem ściennym także w klatce referencyjnej | #47 |
| G-045 | Test `far-city.test.ts` przekracza 5 s pod obciążeniem | #47 |
| G-047 | Karta skanu hackowania nie zmienia języka do zmiany celu | #47 |
| G-006 | Skręty aut na skrzyżowaniach | #47 |
| G-046 | Smoke M0: kierunek ruchu po `freeze` zależy od chwili zamrożenia | #49 |
| G-048 | Prawdziwy tap tuż po przycisku pada ginie jako „ghost click” | #48 |
| G-004 | Kandelabr na krawędzi pasa aut na Placu Zamkowym | #51 |
| G-038 | `lane-dead-end` nie sprawdza użycia początku, który „spotyka” koniec | #51 |
| G-031 | Testy TPP w `npr-perf` i smoke save/load przekraczają limit przy obciążeniu | #57 |
| G-049 | Zabytki bez wież i hełmów: import pomijał `building:part` | #65 |
| G-054 | `glitch-shots` mógł zapisać klatkę sprzed ułożenia miasta | #62 |
| G-057 | Proceduralne wieże obok wieżyczek z OSM (Archikatedra, Dominikanie) | #69 |
| G-050 | Nadbudowa przy Bramie Grodzkiej góruje nad bramą (piętra odsunięte ≥ 5 m) | #60 |
| G-062 | Przejścia pod mostami zablokowane (Podwale, bulwar Bystrzycy) | #70 |
| G-068 | AI nie widziało przejścia pod mostem | #71 |
| G-064 | Targowiska bez straganów | #76 |
| G-051 | Podpis muzeum na kamienicy Jezuicka 3 zamiast na Bramie Krakowskiej | #75 |
| G-067 | Klasztor Dominikanów z proceduralnymi wieżami kościoła | #72 |
| G-056 | Kształt dachu z OSM (`roof:shape`) ignorowany: hełmy, kopuły i dachy dwuspadowe jako czterospadowe | #78 |
| G-061 | Część `building:part` bez obrysu `building` nie trafia do gry (pawilon Bona) | #74 |
| G-076 | Przejazdy bramne z `tunnel=yes` zamknięte bryłą (Gruella pod Trynitarską, Królewska, Sąd Okręgowy, Rynek 5) | #80 |
| G-077 | Budynek podziemny zbudowany na powierzchni ul. Zamkowej | #80 |
| G-058 | Dotknięcie pierwszego wyboru tuż po otwarciu dialogu czasem ginie (e2e touch) | #50 |
| G-075 | Kolizje aut na przecięciu pasów 3 Maja przy Zesłańców Sybiru | #85 |
| G-089 | Bramy z maxheight=below_default ze sklepieniem 4 m | #89 |
| G-090 | Przesunięcie pasa ruchu z mediany szerokości całego łańcucha ulicy | #88 |
| G-052 | Teatr Osterwy i Kościół Bernardynów poza danymi miasta (brzeg Krakowskiego na z = −200) | #87 |
| G-094 | Przedsionek Trasy Podziemnej: pierwsze 4,5 m poza obszarem wnętrza | #90 |
| G-125 | Ekranu opcji nie da się przewijać na telefonie | #94 |
| G-087 | `stepRamps` tylko dla nazwanych schodów | #97 |
| G-127 | Parterowy pawilon jako czterokondygnacyjna wieża (Bar Centralny przed Pedetem) | #103 |
| G-097 | Teatr Osterwy jako kamienica mieszkalna | #104 |
| G-116 | Ułamkowe `building:levels` zaokrąglane w górę (Ratusz o 1,6 m za wysoki) | #104 |
| G-120 | Urzędy z `office=government` w tagach obrysu jako kamienice z nadbudową | #104 |
| G-130 | Pojazdy zapadnięte pod nawierzchnię (wrak na deptaku przy Pedecie) | #107 |
| G-140 | Zaparkowane auta na wjazdach i wylotach dróg serwisowych (Cerkiewna) | #110 |
| G-114 | npr-perf Nabrzeże: czasem +98 wywołań rysowania przy tych samych siatkach | #113 |
| G-139 | Smoke „title → new game”: gracz przechodzi 2,09 m przy szybkim starcie (skok kursora jako obrót) | #112 |
| G-141 | Obezwładnienie: telefon świadka kończy się w trakcie chwytu; wyjątek pomocnika bez testu | #114 |
| G-138 | Pasy ruchu na krawędziach mapy bez nawierzchni | #115 |
| G-135 | Pointer lock wyłączony na stałe po odmowie bez gestu (Esc przed pierwszym kliknięciem) | #116 |
| G-136 | Przejazd Bramy Grodzkiej poza osią frontów | #117 |
| G-131 | Etap 1 obezwładnienia: klawisz interakcji, ogłuszony „w walce”, strzał po zabiciu | #100 |

## Odrzucone przed archiwum wpisów
- G-005 Wiata przystanku wchodzi w ścianę przy Alei Tysiąclecia: duplikat (G-011)
- G-040 Śmierć babci Ume blokuje krok ren_trail: odrzucone (Ume nie ma `health` w `district-m0.ts`, a NPC bez niego nie da się zranić ani zabić, `builders.ts:77`; krok nie może się zablokować)
- Biała iglica i kreski nad rondem Dmowskiego: megawieże tła horyzontu (`far-city.ts`), celowe.
- Krzewy przy schodach w Podzamczu, rzeźba w fontannie (1078, 175): tak jest w danych OSM.
- Nakładka 26 m² budynków w69916021 i w1382552285: dane OSM, niewidoczna.
- Czarny kadr w dokach (2555, 420): teleport testu do wnętrza bryły.
