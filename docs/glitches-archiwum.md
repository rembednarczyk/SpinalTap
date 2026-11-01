# Archiwum glitchy

Pełne wpisy naprawionych, odrzuconych i zdublowanych glitchy, przeniesione z [rejestru](glitches.md), który trzyma tylko otwarte sprawy (ADR-0054).

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
