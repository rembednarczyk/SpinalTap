# ADR-0040: Rutyny i aktywności postaci, miejsca aktywności, przechodnie tła

## Kontekst
ADR-0037 (punkt „Rutyny i aktywności”) dał kontrakt: `ActivityId` w `core/world/wave2.ts` i `RenderPort.setActivity?(id, activity | null)`. Harmonogramy z ADR-0017 przenosiły kilka postaci między punktami, ale na miejscu wszyscy stali tak samo, a ulice poza nazwanymi postaciami były puste. Ten ADR opisuje, jak symulacja wybiera aktywność, skąd biorą się przechodnie tła i jak renderer gra animacje.

## Decyzja

### Symulacja
- **Aktywność bytu** (`Entity.activity`) liczy system `activity` zaraz po ruchu. To czysta funkcja bytu i zegara (`world/activity.ts`):
  - przerwanie: strach tłumu (cokolwiek poza `calm`), walka, szukanie gracza, quickhack, śmierć; wtedy brak aktywności;
  - rozmowa z graczem (otwarty dialog z tym bytem): `talk`;
  - postać w ruchu (powyżej 0,3 m/s): brak;
  - przechodzień tła: aktywność jego miejsca, gdy na nim stoi;
  - harmonogram: `activity` przystanku, gdy postać do niego doszła (`ScheduleStop.activity`, pojedyncza albo cykl zmieniany co kilka minut gry od początku przystanku);
  - postać bez harmonogramu: nawyk z tabeli `ACTOR_ACTIVITIES` po kluczu, o ile stoi u siebie;
  - strażnik Tessen na posterunku (`ai.cone` i `ai.watch`): `guard`.
- **Treść.** Przystanki: Hideo pije pod SAKE i śpi w bramie, w drodze do pracy rozmawia przez telefon; Mei pali i rozmawia pod KARAOKE; Fumiko i Oyaji gotują (Oyaji układa towar) i sprzątają w godzinach pracy, po zamknięciu siedzą; Ume zamiata i rozmawia, nocą śpi; czujka Hebi pilnuje i pali. Nawyki: Mori przy terminalu, Tetsu przy terminalu DENKI, Sachiko, Kenta, Goro, Hana, Genzō, doker, Ren i Kurosawa.
- **Miejsca aktywności** (`content/activity-spots.ts`): 27 miejsc w pięciu chunkach (Shinsekai 8, Kanałowa 6, targ 5 + 5, doki 3), rodzaje ławka (`sit`), ściana (`lean`, `smoke`, `phone`), automat (`drink`), stragan (`eat`), bar (`drink`, `talk`). Miejsca przy straganach targu liczą się z rzędów straganów z generatora, więc żadna liczba losowa treści się nie przesuwa. Test pilnuje, że każde miejsce stoi w swoim chunku, ma co najmniej 0,38 m od bryły i 1,5 m od miejsc nazwanych postaci.
- **Przechodnie tła** (`world/passersby.ts`, `systems/passerby-system.ts`):
  - po 3 w Shinsekai i na Kanałowej, po 2 w każdym chunku targu, 1 na nabrzeżu doków, razem 11; limit `MAX_PASSERSBY_PER_CHUNK = 3`;
  - identyfikatory zarezerwowane na końcu konstruktora streamera, więc żadne dotychczasowe id się nie zmienia;
  - doba dzieli się na sloty po 45 minut gry; w każdym slocie przechodnie chunka dostają różne miejsca ze strumienia `deriveRandom(seed, "passersby:<chunk>:<slot>")`, z wagami rodzajów zależnymi od godziny (nocą bary, rano automaty, w południe i wieczorem stragany); wszyscy z chunka zmieniają miejsce na granicy slotu, więc dwóch nigdy nie idzie na jedno miejsce;
  - pojawiają się z chunkiem w pierwszym kroku po jego wczytaniu, odchodzą z nim przy rozładowaniu;
  - chodzą przez AI cywila (gałąź `ReturnHome`) do celu z omijaniem przeszkód z ADR-0025, szukanym co 0,6 s, nie co krok.
- **Reakcja tłumu.** Przechodnie mają komponent `civilian`, więc strzał ich płoszy jak każdego (kulenie, ucieczka). Aktywność wtedy znika; po uspokojeniu postać wraca na miejsce i podejmuje ją znowu.
- **Zapis i determinizm.** Aktywność zawsze wynika z zegara i treści, więc nie wchodzi do migawki bytu. Przechodnie nie mają klucza ani zdrowia i nie wchodzą do zapisu: po wczytaniu stają na miejscach swojego slotu. Żeby nie mogli zmienić zapisanego stanu, nie są świadkami przestępstw, nie pchają nikogo w ruchu, nie zatrzymują windy i nie liczą się do tłoku, który omija AI gangera. Dlatego `SAVE_SCHEMA_VERSION` się nie zmienia, a złoty hash `determinism.test.ts` zostaje ten sam: przebieg skryptu jest identyczny.

### Prezentacja
- `RenderSync` (`sim/presentation`, używany przez `app/game-session.ts`) wysyła `setActivity` tylko przy zmianie aktywności i `null`, gdy się kończy.
- **Engine.** `BabylonRenderer.setActivity` oddaje aktywność nowej części za fasadą, `CharacterActivities` (ADR-0031):
  - `activity-poses.ts`: czyste pozy i pętle dla każdej `ActivityId` oraz mieszanie: wejście z chodu, wyjście i przejście między aktywnościami trwają 0,3 s, chód wstrzymuje pozę;
  - `activity-rig.ts`: nakłada pozę na to, co ustawiła animacja chodu, przed retargetem, więc rigi proceduralne i modele VRoid grają to samo; pozycje siedzące opuszczają biodra ze stopami na ziemi; dobyta broń zostaje w ręce;
  - `activity-props.ts`: papieros z żarzącym się punktem (jaśniejszym przy zaciągnięciu), telefon, puszka, miska, miotła, stołek pod siedzącym; rzeczy w prawej ręce przechodzą do dłoni modelu przez `holdInRightHand`; rysowane tylko do 16 m od kamery.
- **Zasięg rysowania postaci** (`character-lod.ts`): postać dalej niż 60 m od kamery (po płaszczyźnie ziemi) jest wyłączona i nie liczy animacji ani retargetu; postać, za którą idzie kamera, zostaje zawsze. To zwalnia miejsce w budżecie na przechodniów: na targu ludzie Kanałowej stoją 60 do 100 m dalej w osi kadru, schowani za kioskiem, a frustum ich nie odcinał.
- Statyści w wagonie metra (ADR-0036) siedzą, śpią i dzwonią na ławce wagonu, bez stołka.
- Kierunek patrzenia w aktywności daje symulacja: przystanek ma `yaw`, miejsce ma `yaw`, a dojście do celu kończy się obrotem do niego.

## Konsekwencje
- Kadr referencyjny NPR się nie zmienia: tryb `?reference` nie wykonuje kroku symulacji, więc ani przechodnie, ani aktywności się w nim nie pojawiają.
- Przechodnie dokładają do 3 postaci na chunk. Miejsca targu z wysoką wagą nocą (bary TAKO, ramen i stragan pod estakadą) leżą poza kadrem pomiaru `market-tpp`. Pomiar `market-tpp` po zmianie: 303 wywołania rysowania i 123 aktywne siatki (budżet 315 i 126; przed tą zmianą gałąź miała 127 siatek).
- Nowa aktywność to wpis w `ActivityId` (kontrakt), poza w `activity-poses.ts` i ewentualnie rzecz w `activity-props.ts`.
