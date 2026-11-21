# ADR-0097: Prowadzenie aut: fizyka w stylu sim-racingu w deterministycznej symulacji

Status: Przyjęty (20.11, decyzja użytkownika: „przyjmuję ADR-0097”; prośba użytkownika: „zaczynamy planować możliwość prowadzenia samochodów”, z planem fizyki w stylu Assetto Corsa do rozbudowy). Zmienia decyzję z 31.10 („samochody na później”): ruch aut na ulicach zostaje, jak jest, a gracz dostaje auto, które sam prowadzi.

## Kontekst
Plan użytkownika: silnik fizyki brył sztywnych (Rapier albo Cannon-es) obok renderera, własne koła promieniowe zamiast kół z kolizją, model opon Pacejki zamiast liniowego tarcia, zawieszenie z przechyłami i stabilizatorami, napęd z krzywą momentu, skrzynią, sprzęgłem i szperą, aerodynamika, stały krok 120–240 Hz niezależny od klatki, linie telemetrii jak aplikacje deweloperskie AC i wygładzanie skrętu dla klawiatury i pada.

Gra różni się od założeń planu w kilku punktach, które decydują o architekturze:
- Rysuje Babylon (`packages/engine`), nie Three.js. Renderer niczego nie liczy: pokazuje stan symulacji z interpolacją (`interpolation-system`).
- Logika gry, także ruch, żyje w `packages/sim`: deterministyczna (bez `Math.random` i zegara ściennego), krokowana testami bez przeglądarki (ADR-0046) i z kontrolą złotego hasha. `sim` importuje tylko `core` (reguła twarda): pakiet fizyki z WASM w `sim` łamałby granicę, a jego wynik zależałby od wersji binarki.
- Krok symulacji ma 60 Hz (`SIM_HZ`). Miasto ma już bryły (`SolidIndex`: ściany, słupki, meble), grunt z NMT z rampami i piętrami (`groundAt`), nawierzchnie z OSM (asfalt, kostka, bruk, trawa) i ruch aut po pasach (`traffic-system`, auta kinematyczne po trasach, bez fizyki).
- Gracz gra na komputerze i na telefonie (ADR-0079), więc sterowanie dotykiem i budżet procesora telefonu są wymaganiem, nie dodatkiem.

## Wzorzec
- **Pojazd promieniowy (raycast vehicle)**: bryła sztywna nadwozia i cztery promienie zawieszenia, jak `btRaycastVehicle` w Bullecie (Erwin Coumans, wg Kenny'ego Erleben) i kontrolery wyścigowe w Unity (Edy's Vehicle Physics). Koło nie jest bryłą: promień daje ugięcie sprężyny, punkt styku i normalną.
- **Opona**: „Magic Formula” Pacejki (Pacejka i Bakker 1987; Pacejka, *Tire and Vehicle Dynamics*, 2012) w uproszczonej postaci `B, C, D, E` osobno dla siły wzdłużnej i bocznej, z zależnością od obciążenia (`D = μ(Fz)·Fz`, μ malejące z obciążeniem) i łączeniem w elipsę przyczepności (friction ellipse). Do niskich prędkości długość relaksacji opony (relaxation length, model pierwszego rzędu; Pacejka rozdz. 7), która gasi drgania, z jakich słyną uproszczone modele przy postoju.
- **Napęd i dynamika kół**: obrót koła jako własny stopień swobody (moment napędowy, hamujący i reakcja opony na promieniu), silnik z krzywą momentu, koło zamachowe, sprzęgło przenoszące moment do granicy tarcia, skrzynia i przekładnia główna, mechanizm różnicowy o ograniczonym poślizgu typu sprzęgłowego (preload i rampy: osobny procent blokady przy gazie i hamowaniu silnikiem). Źródła: Brian Beckman, *The Physics of Racing*; Marco Monster, *Car Physics for Games*; dokumentacja i fora Kunos (Assetto Corsa) o LSD i FFB.
- **Stały krok z podkrokami** (Glenn Fiedler, „Fix Your Timestep!”): fizyka auta liczy się w podkrokach w obrębie kroku symulacji, render interpoluje.

Różnice wobec planu użytkownika i dlaczego:
1. **Bez Rapiera i Cannona w grze.** Nadwozie, koła i kolizje liczymy w `sim`, w TypeScripcie. Jedno auto gracza to jedna bryła sztywna i cztery promienie: tej skali nie trzeba silnikowi z rozwiązywaniem wielu kontaktów, a kolizje z miastem mamy już w `SolidIndex` i `groundAt`. Zysk: determinizm i testy bez przeglądarki jak dla całej gry, brak WASM na telefonie, jedna prawda o świecie (te same bryły dla pieszych i aut). Rapier zostaje opcją na później (np. wiele aut z fizyką naraz, sterty pudeł do rozbijania) i wtedy wejdzie przez port w `core` z ADR-em zmieniającym granice.
2. **240 Hz jako 4 podkroki kroku 60 Hz** w systemie pojazdu, a nie osobna pętla w `requestAnimationFrame`. Renderer nie liczy fizyki.
3. **Opona z relaksacją i ochroną niskiej prędkości.** Poślizg wzdłużny `κ = (ωr − vx)/max(|vx|, v₀)` i kąt znoszenia `α = atan(vy/max(|vx|, v₀))` z `v₀ ≈ 1–2 m/s` oraz filtrem relaksacji, żeby auto stało na pochyłości i nie drgało na postoju. Plan użytkownika tego nie mówi, a bez tego model Pacejki przy prędkości bliskiej zeru jest niestabilny.
4. **Wspomagania zależne od trudności i sterowania**: ABS, kontrola trakcji, kontrola stabilności i ograniczenie skrętu z prędkością. Na klawiaturze i dotyku domyślnie włączone, na kierownicy wyłączone. Fizyka jest jedna, wspomagania tylko korygują wejście.

## Decyzja

### 1. Kontrakty w `core`
- `VehicleSpec` (dane, tabela w `core`, jedna na model auta): masa, położenie środka masy (wysokość nad podłogą), tensor bezwładności z bryły zastępczej (prostopadłościan o masie auta), rozstaw osi i kół z rozmiarów modelu, promień koła i jego bezwładność, sprężyny i tłumiki (osobno ugięcie i odbicie), skok zawieszenia, ograniczniki, stabilizatory, parametry Pacejki przód i tył, krzywa momentu silnika (punkty obr/min → Nm), obroty biegu jałowego i odcięcia, przełożenia biegów i główne, typ napędu (przód, tył, 4×4), szpera (preload, procent blokady gaz i hamowanie), hamulce (moment maksymalny, rozkład przód i tył), aero (`Cd·A`, docisk przód i tył `Cl·A`), maksymalny skręt i Ackermann.
- `DriveInput` w `InputFrame`: gaz 0..1, hamulec 0..1, skręt −1..1, ręczny, zmiana biegu w górę i w dół (zbocze), sprzęgło 0..1 (tylko kierownica). Adapter wejścia wygładza klawiaturę (narastanie skrętu i gazu, skręt malejący z prędkością) i zostawia surowe osie pada i kierownicy.
- Komendy: `enter-vehicle`, `exit-vehicle`, `vehicle-reset` (postaw na koła), zdarzenia `vehicle-hit` (zderzenie z energią), `vehicle-ran-over` (pieszy), `gear-changed`.
- Stan auta w zapisie (podbicie `SAVE_SCHEMA_VERSION` z migracją): pozycja, obrót, prędkości, bieg, obroty, uszkodzenia, kto jest w środku.

### 2. System pojazdu w `sim` (`systems/vehicle-system.ts` i `world/vehicle/`)
W `createSystems()` po sterowaniu gracza, przed ruchem pieszych i ruchem aut. Każdy krok 60 Hz to 4 podkroki 240 Hz:
1. **Zawieszenie**: z czterech punktów mocowania promień w dół wzdłuż osi nadwozia, długość skoku plus promień koła. Grunt i bryły: `groundAt` (teren, rampy, piętra, kładki) i `SolidIndex` (krawężnik, próg, słupek pod kołem). Ugięcie `x`, prędkość ugięcia `ẋ`, siła `F = k·x + c·ẋ` (tłumienie osobno dla ugięcia i odbicia), ogranicznik na końcu skoku, stabilizator `F = k_arb·(x_l − x_r)` przenoszony między stronami osi. Siła w punkcie styku wzdłuż normalnej gruntu daje sama przechył i nurkowanie, bo punkt leży pod środkiem masy.
2. **Opona**: prędkość punktu styku w układzie koła, `κ` i `α` jak wyżej, relaksacja, siły `Fx`, `Fy` z Pacejki dla obciążenia `Fz` z kroku 1, przyczepność nawierzchni z mapy (asfalt 1,0, kostka 0,9, bruk 0,8, trawa 0,6, mokra nawierzchnia osobno, gdy wejdzie pogoda), łączenie w elipsę: `(Fx/Fx_max)² + (Fy/Fy_max)² ≤ 1`.
3. **Koła**: `ω̇ = (T_napęd − T_hamulec − Fx·r)/I_koła`; hamulec nie odwraca obrotu (zaciska do zera); ręczny blokuje tył.
4. **Napęd**: obroty silnika z obrotów kół przez skrzynię, gdy sprzęgło trzyma, moment z krzywej razy gaz, hamowanie silnikiem, odcięcie; sprzęgło w samochodzie z automatem zamyka się samo (ruszanie, zmiana biegu z czasem przełączenia), skrzynia automatyczna dla klawiatury i dotyku, ręczna sekwencyjna dla pada i kierownicy; szpera dzieli moment między koła osi: otwarta różnica prędkości kół przenosi moment do granicy `preload + blokada·|T|`.
5. **Aero i opory**: `F_d = ½ρ·Cd·A·v²` przeciw prędkości, docisk `½ρ·Cl·A·v²` w punktach przodu i tyłu, opór toczenia proporcjonalny do obciążenia kół.
6. **Bryła sztywna**: suma sił i momentów, całkowanie półniejawnym Eulerem (najpierw prędkości, potem pozycja i obrót kwaternionem z normalizacją), tensor w układzie nadwozia.
7. **Kolizje nadwozia**: prostopadłościan auta przeciw bryłom `SolidIndex` (ściany, słupki, meble, bryły budów), autom ruchu ulicznego (kinematyczne: auto gracza odbija się od nich z ich prędkością, one hamują i stają, jak dziś przy pieszym na pasie) i pieszym (bryły ciał: impuls, przewrócenie, obrażenia, przestępstwo i reakcja gangów ADR-0091). Impuls z odbiciem i tarciem w punkcie najgłębszego wnikania, rozsunięcie, maksymalnie kilka iteracji na podkrok. Uszkodzenia z energii uderzenia (siła silnika, skręt, wygląd).
8. **Wspomagania** (pkt 4 „Wzorca”): ABS zdejmuje moment hamujący przy `κ < −κ_max`, kontrola trakcji przy `κ > κ_max`, kontrola stabilności hamuje pojedyncze koło przy nadsterowności.

Budżet: jedno auto gracza z pełną fizyką. Auta ruchu ulicznego zostają kinematyczne (bez zmian w `traffic-system`); auto zaparkowane albo porzucone przez gracza zasypia po zatrzymaniu (bez podkroków) i budzi się przy uderzeniu albo wejściu.

### 2a. Układ współrzędnych i znaki
Babylon jest lewoskrętny, a modele w nim mają oś Z glTF zanegowaną (`KitModel`). Fizyka auta nie liczy w układzie renderera: liczy w układzie świata `sim` (oś y w górę, kurs `yaw = atan2(dx, dz)`, czyli przód przy kursie 0 to +z), a renderer przenosi stan auta tak jak resztę stanu gry. Wewnątrz auta obowiązuje jeden lokalny układ nadwozia (y w górę, z do przodu, x w bok), a przejścia świat ↔ nadwozie, iloczyny wektorowe, momenty, kąt skrętu, przechył i pochylenie liczy jeden moduł (`world/vehicle/frame.ts`). Żaden inny plik nie odwraca znaków na własną rękę. Konwencja: dodatni skręt kieruje auto w lewo patrząc od kierowcy, dodatnie pochylenie to nos w dół, dodatni przechył to nadwozie na prawą burtę. Test znaków (pkt 5) pilnuje jej na stałe.

### 3. Gra wokół auta
- **Skąd auto**: zaparkowane auta z rozstawienia (`parked`) i auta ruchu ulicznego jako źródło. Wejście do zaparkowanego to włamanie (zamek jak drzwi z ADR-0058 etap 9, szansa wykrycia, przestępstwo), wejście do auta z ruchu to porwanie z kierowcą wyciąganym ze środka (przestępstwo cięższe). Własne auto w fabule później (garaż na Podzamczu).
- **Wsiadanie i wysiadanie**: interakcja przy drzwiach (`interaction-system`), animacja i kamera przejścia, wysiadanie po stronie wolnej od brył. W aucie broń tylko z jednej ręki przez okno (później).
- **Ruch po Lublinie**: deptak Krakowskiego Przedmieścia, Rynek i uliczki Starego Miasta są dla pieszych, a gra tego pilnuje tak jak dziś pilnuje przestępstw: wjazd jest możliwy, ale podnosi poszukiwanie i reakcję mieszkańców. Słupki z łańcuchami (G-032) zatrzymują auto bryłą.
- **Kamera** (`engine/camera`, osobna część za fasadą `BabylonRenderer`): za autem na sprężynie z tłumieniem i opóźnieniem obrotu, z przodu (zderzak), kokpit; pole widzenia rośnie z prędkością; drgania z nierówności.
- **HUD** (`ui`, nowy wąski interfejs intencji i hak): prędkościomierz, obrotomierz z odcięciem, bieg, wskaźniki ABS i TC, uszkodzenia; na telefonie pedały i kierownica dotykowa lub przechył telefonu (opcja).
- **Dźwięk** (`engine/audio`): silnik z obrotów i obciążenia (warstwy próbek), pisk opon z poślizgu, uderzenia z energii.
- **Telemetria** (tryb deweloperski, jak aplikacje AC): `sim` oddaje w migawce auta dane każdego koła (punkt styku, normalna, ugięcie, obciążenie `Fz`, kąt znoszenia, poślizg wzdłużny, siły `Fx`, `Fy`), a osobna część renderera (`engine/src/renderer/vehicle-telemetry.ts`) rysuje je narzędziami Babylona: `RayHelper` dla promieni zawieszenia, linie (`LinesMesh`, jak w `PhysicsViewer`) dla wektorów sił, kolor od poślizgu. Do tego panel z wykresem przyczepności w czasie i Inspector Babylona, który w trybie debug już działa. Włączana parametrem adresu, w zwykłej grze nie istnieje (bez siatek i wywołań rysowania).
- **Model auta**: auto gracza z wersji zbliżenia (`-hi`, 4 tys. trójkątów); koła muszą być osobnymi siatkami do obrotu i skrętu. Dziś są zespawane z nadwoziem, więc nowy krok wypieku wycina je z modelu źródłowego Blenderem bez okna (decyzja z 20.11) i zapisuje pozycje osi w `extras`.

### 4. Wejścia
Klawiatura (WSAD/strzałki, spacja ręczny, Q/E biegi), pad (triggery jako gaz i hamulec, gałka skrętu z martwą strefą i krzywą), kierownica przez Gamepad API (osie 1:1, pedały osobno; force feedback przez Gamepad haptics tam, gdzie przeglądarka go daje, bez obietnicy pełnego FFB), dotyk (strefy pedałów i suwak skrętu albo przechył). Ustawienia: czułość, martwa strefa, liniowość, wspomagania.

### 5. Testy (ADR-0046, bez przeglądarki)
Na płaskiej podłodze testowej i na kawałku Lublina, krokowane `step`:
- postój na płaskim i na zboczu 10% z ręcznym: auto stoi (relaksacja, ochrona niskiej prędkości);
- przyspieszenie 0–100 km/h i prędkość maksymalna w przedziale z danych auta;
- droga hamowania ze 100 km/h z ABS i bez;
- płyta poślizgowa (skidpad) promień 40 m: przyspieszenie boczne w ustalonym przedziale, kąt znoszenia przy szczycie przyczepności 6–10°;
- przechył i nurkowanie: znak i rząd wielkości zgodny z przesunięciem obciążenia `ΔFz = m·a·h/t`;
- energia: auto toczące się bez gazu traci prędkość tylko przez opory (bez przyrostu);
- znaki (pkt 2a): hamowanie pochyla nos w dół, gaz unosi nos, w zakręcie w lewo nadwozie przechyla się na prawą burtę, a dodatni skręt skręca auto w lewo; to samo w migawce dla renderera (obrót siatki zgodny z obrotem bryły);
- determinizm: dwa przebiegi tej samej jazdy dają ten sam stan bajt w bajt; złoty hash podłogi testowej zmienia się tylko w etapie, który dodaje auto do podłogi;
- kolizje: wjazd w ścianę i słupek bez tunelowania przy 150 km/h (podkroki i wykrycie ciągłe po drodze środka masy).
W przeglądarce tylko kamera, HUD na telefonie, dotyk i budżet rysowania (`npr-perf` dostaje scenę jazdy).

### 6. Havok tylko dla fizyki kosmetycznej (opcja)
Notatka o Babylonie z 20.11 (Havok przez `HavokPlugin`, `setSubTimeStep`, gotowy pojazd promieniowy) nie zmienia decyzji z pkt 2, ale sprawdzona na naszej wersji (Babylon 9.32) daje trzy ustalenia:
- `setSubTimeStep` działa tylko w pętli fizyki Babylona, a podkroki 240 Hz są w stałym kroku `sim`; renderer już interpoluje stan.
- W `@babylonjs/core` 9.32 nie ma klasy `PhysicsRaycastVehicle` (fizyka v2 ma kontroler postaci i więzy); gotowego pojazdu nie dostajemy.
- `@babylonjs/havok` nie jest w zależnościach.

Havok ma sens po stronie renderera dla rzeczy, które nie wpływają na rozgrywkę: pachołki i barierki rozrzucone po uderzeniu auta, kartony i worki z zapleczy (ADR-0096), odłamki karoserii. Ich położenie nie idzie do zapisu, przestępstw, AI ani testów, więc liczy je renderer, a `sim` tylko zgłasza zdarzenie (`vehicle-hit` z punktem i energią). Decyzja przy etapie 5, z pomiarem rozmiaru modułu WASM i czasu na telefonie; pakiet przypięty w lockfile jak narzędzia wypieku (decyzja z 20.11).

## Etapy (osobne PR-y)
1. Ten ADR, kontrakty w `core` (`VehicleSpec`, `DriveInput`, komendy), dane jednego auta (sportowe z `veh-cyber`).
2. Bryła sztywna i zawieszenie promieniowe na płaskiej podłodze i terenie, opona liniowa, podkroki 240 Hz, moduł układu nadwozia (pkt 2a), wejście z klawiatury, kamera za autem, telemetria `RayHelper`; testy znaków, postoju, przechyłu, energii, determinizmu.
3. Opona Pacejki z relaksacją, elipsa przyczepności, dynamika kół, hamulce i ręczny; testy płyty poślizgowej i hamowania.
4. Napęd: silnik, sprzęgło, skrzynia automatyczna i sekwencyjna, szpera; aero; testy przyspieszenia i prędkości maksymalnej.
5. Kolizje z bryłami miasta, autami ruchu i pieszymi; uszkodzenia; przestępstwa i reakcje; decyzja o Havoku dla fizyki kosmetycznej (pkt 6).
6. Gra: wejście i wyjście, włamanie i porwanie, HUD, dźwięk, zapis (wersja schematu), wysiadanie; koła jako osobne siatki z Blendera.
7. Wejścia: pad, kierownica, dotyk; wspomagania i ustawienia; scena jazdy w `npr-perf`.
8. Kolejne auta (tabela `VehicleSpec` dla modeli z `vehicle-props.glb`), strojenie i porównanie z danymi prawdziwych aut.

## Konsekwencje
- Ruch gracza dostaje drugi tryb poza pieszym; `player-control-system` przekazuje wejście autu, gdy gracz w nim siedzi.
- Koszt procesora: jedno auto, 240 podkroków na sekundę po kilkaset operacji, mieści się w budżecie telefonu; zaparkowane auta śpią.
- Decyzja z 31.10 o odłożeniu aut przestaje obowiązywać dla auta gracza; ruch uliczny i sprawy z tamtej listy (G-074, G-083, G-092, G-093) zostają odłożone, dopóki użytkownik nie zdecyduje inaczej.
- Rapier i podobne pakiety nie wchodzą do `sim`; gdyby kiedyś były potrzebne, wejdą przez port w `core` z ADR-em i z pomiarem determinizmu.

## Wdrożenie etapu 1 (21.11): kontrakty
- `VehicleSpec` w `core` (`world/vehicle-spec.ts`): dane auta sportowego ulicy (`veh-cyber`, około 1350 kg i 280 kW, napęd na tył), z testem wielkości: częstość sprężyn 1,3–2 Hz, tłumienie od 0,2 do 0,5 krytycznego, szczyt siły bocznej opony przy 6–10° i wzdłużnej przy 8–15% poślizgu, moc szczytowa 250–320 kW, prędkość na odcięciu na najwyższym biegu 260–320 km/h. `vehicleSpec(model)` przykrawa nadwozie, rozstaw osi i kół do pudła danego nadwozia ulicy (`VEHICLE_SIZE`); wszystkie auta ulicy poza trolejbusem są do prowadzenia (`isDrivable`), bo wszystkie noszą model auta sportowego (decyzja z 19.11). Pomocnicze: `engineTorque` (krzywa liniowa między punktami) i `magic` (wzór Pacejki).
- `DriveInput` w `InputFrame` jako pole opcjonalne `drive`, dla urządzeń z własnymi osiami (pad, kierownica). Bez niego (klawiatura, dotyk, starsze klatki) auto czyta osie ruchu: `moveZ` jako gaz i hamulec, `moveX` jako skręt, `jump` jako ręczny, a wygładzanie klawiatury liczy `sim`, deterministycznie i jednakowo dla powtórek. Różnica wobec pkt 1: adapter wejścia nic nie wygładza, bo nie wie, czy gracz siedzi w aucie.
- Zdarzenia: `VehicleEntered` (skąd auto: z ruchu, zaparkowane, własne), `VehicleExited`, `VehicleHit` (energia zderzenia), `VehicleRanOver`, `GearChanged`. Wsiadanie i wysiadanie idzie istniejącą interakcją (`interact`), więc bez nowych komend; postawienie auta na koła wejdzie przy etapie 5 jako przytrzymanie przeładowania, gdy auto leży.
- Zapis stanu auta wchodzi w etapie 6 razem z wsiadaniem.

## Wdrożenie etapów 2–4 (21.11): fizyka auta w `sim`
- Jeden PR na etapy 2–4 zamiast trzech: CI na wolnych runnerach trwa ponad 25 minut, a polecenie na noc to jazda do rana; etapy są osobnymi modułami w `world/vehicle/` i osobnymi testami.
- `frame.ts`: jedyny moduł obrotów i znaków (kwaterniony, przejścia świat ↔ nadwozie, kurs, pochylenie, przechył, osie koła przy skręcie). `state.ts`: stan auta (bryła, cztery koła, obroty, bieg, wygładzone sterowanie, sen, kotwica postoju). `suspension.ts`: promień z mocowania wzdłuż osi nadwozia, siła sprężyny i tłumika (osobno ugięcie i odbicie), ogranicznik, stabilizator, siła wzdłuż normalnej gruntu. `tyre.ts`: poślizgi z ochroną niskiej prędkości, relaksacja kąta znoszenia, Pacejka, elipsa przyczepności, opór toczenia, ABS i kontrola trakcji; koło całkowane półjawnie na nachyleniu krzywej opony (lekkie koło na sztywnej oponie rozbiega się jawnie przy 240 Hz), hamulec zatrzymuje obrót, nie odwraca go; Ackermann i skręt malejący z prędkością. `drivetrain.ts`: silnik z krzywej, hamowanie silnikiem, odcięcie, skrzynia automatyczna z wstecznym jak w grach (hamulec na postoju wrzuca wsteczny i jedzie nim), szpera z blokadą `preload + lock·|T|`, hamulce przód i tył, ręczny na tył. `step.ts`: siły i momenty, półniejawny Euler z członem żyroskopowym, 4 podkroki na krok 60 Hz, aero (opór i docisk przy osiach), sen auta bez kierowcy po sekundzie postoju.
- Różnica wobec pkt 3 „Wzorca”: sama relaksacja i ochrona niskiej prędkości dają przy hamowanym aucie na zboczu pełzanie kilku centymetrów na sekundę (siła opony rośnie z prędkością poślizgu, nie z przesunięciem). Auto zahamowane i prawie stojące trzyma kotwica postoju w płaszczyźnie gruntu (tarcie statyczne), sprężyny działają dalej; puszcza przy zwolnieniu hamulca albo gazie.
- Testy (`packages/sim/test/vehicle-physics.test.ts`): osiadanie na sprężynach i rozkład obciążeń, postój na zboczu 10% z ręcznym i stoczenie bez niego, 0–100 km/h w 4–7 s, prędkość maksymalna 230–310 km/h, droga hamowania ze 100 km/h 33–45 m po prostej, znaki (nurkowanie przy hamowaniu, uniesienie nosa przy gazie, skręt w lewo obniża kurs i przechyla na prawą burtę), przyspieszenie boczne 0,85–1,15 g w ustalonym okręgu, toczenie bez gazu bez przyrostu prędkości, determinizm bajt w bajt, wsteczny z hamulca, jazda z klatki klawiatury.

## Wdrożenie etapów 5–6 w części potrzebnej do jazdy (21.11)
- System pojazdu (`systems/vehicle-system.ts`) w `createSystems()` zaraz po ruchu, przed ruchem ulicznym. Stan jazdy w sesji (`driving`, nie zapisywany) i na bohaterce (`seated`); w aucie sterowanie gracza i ruch nie ruszają jej ciała, a interakcja słucha tylko auta.
- Przejęcie auta z ruchu (polecenie użytkownika 21.11): auto ulicy w zasięgu 2,4 m od boku i wolniejsze niż 6 m/s (staje przed nią, gdy wejdzie mu w drogę) daje podpowiedź „Przejmij auto”; klawisz zabiera je z ruchu (jego miejsce w rozkładzie wraca później poza wzrokiem), w jego miejsce staje auto z fizyką z jego prędkością i kursem, kierowca wyciągnięty to napaść w regułach przestępstw. Wysiadanie przy prędkości do 3 m/s, po lewej; auto zostaje i zasypia. Najwyżej trzy porzucone auta, najstarsze znika.
- Kolizje: nadwozie jako szereg kół wzdłuż auta przeciw bryłom miasta (krawężniki i niskie bryły do 0,25 m nad podłogą auta przejeżdża), z utratą prędkości w ścianę i małym odbiciem; auta ruchu jako prostokąty (kinematyczne, stają przed nią jak dziś); piesi wypychani z obrysu, a uderzeni szybciej niż 4 m/s potrąceni (napaść, zdarzenie `VehicleRanOver`). Upadki i obrażenia pieszych, szkody auta i Havok kosmetyczny zostają na dalszą część etapu 5.
- Renderer: przechył i pochylenie auta w buforze aut (`tilt` w transformacji), postać bohaterki ukryta za kierownicą (`seat`), kamera pościgowa 6,5 m za autem w każdym trybie. HUD: prędkościomierz i bieg (`VehicleHud`). Teksty: `prompt.car.take` po angielsku i polsku.
- Zapis: auto nie jest zapisywane; gra zapisana za kierownicą wczytuje się z bohaterką pieszo (stan sesji). Zapis auta z podbiciem schematu zostaje na etap 6.
- Test sesji `vehicle-carjack.test.ts`: na Alei Tysiąclecia auto staje przed nią, podpowiedź się pojawia, klawisz je przejmuje, gaz rozpędza (ponad 15 m w 3 s), ona siedzi w nim, hamulec zatrzymuje, wysiadanie stawia ją 1–2,5 m obok, auto zostaje.

## Wdrożenie etapu 7 w części potrzebnej do jazdy (21.11): wejścia
- Pad: prawy spust to gaz, lewy hamulec (analogowo, z martwą strefą 5%), lewa gałka skręt, A ręczny; pole `drive` w klatce tylko wtedy, gdy spust jest wciśnięty, inaczej auto jedzie z osi ruchu jak z klawiatury (gałka do przodu to gaz). Klawiatura: W/S gaz i hamulec z wstecznym, A/D skręt, spacja ręczny, wygładzane w `sim`. Dotyk: gałka ruchu i przycisk skoku dają to samo co klawiatura, bez zmian w interfejsie dotykowym.
- Odłożone: kierownica przez Gamepad API z osobnymi pedałami i sprzęgłem, przechył telefonu, ustawienia czułości i wspomagań (ABS i kontrola trakcji są zawsze włączone), scena jazdy w `npr-perf` (CI na wolnych runnerach już dziś mieści się na granicy 25 minut shardu).
## Wysiadanie na prawo (21.11, polecenie użytkownika)
- Wysiadanie najpierw po lewej (strona kierowcy), a gdy tam stoi bryła wysokości ciała (wyższa niż stopień `STEP_HEIGHT`) albo auto ruchu, po prawej. Miejsce to koło ciała bohaterki (`BODY_RADIUS`) 0,7 m za bokiem nadwozia i 0,4 m przed środkiem auta. Z obiema stronami zamkniętymi zostaje w aucie.
- Test sesji `vehicle-carjack.test.ts`: słupek przy drzwiach kierowcy, wysiada po prawej; słupki po obu stronach, zostaje w środku. Bez zmiany test pada (wysiada w słupek po lewej).
