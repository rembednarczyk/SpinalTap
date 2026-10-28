# ADR-0028: Świadkowie, heat, quickhacki i warstwa zleceń (fala 1 z researchu)

## Kontekst
Research gatunku (`docs/research/reports/Research mechanik gier cyberpunk.md`) wskazał trzy filary o najwyższym wpływie przy niskim koszcie:
1. pętla przestępstwa: świadek, telefon, heat i ucieczka przez stożki widzenia;
2. skaner z quickhackami jako akcje na urządzeniach i ludziach;
3. warstwa zlecenia: warunek bonusowy, karta podsumowania z odznakami, styl fixera, telefon z jedną kolejką powiadomień.

Wszystkie trzy przecinają `core`, `sim`, `app`, `ui` i `engine`. Żeby kilka osób (i agentów) mogło budować je równolegle, kontrakty muszą być ustalone z góry. Ten ADR je ustala. Implementację opisują ADR-y kolejnych zmian.

## Decyzja: kontrakty
- **Zdarzenia** (`core/src/events/domain-events.ts`).
  - Tłum i heat: `Disturbance`, `CrowdReacted`, `WitnessCalling`, `CrimeReported`, `HeatChanged`, `AwarenessChanged`.
  - Skaner i quickhacki: `ScanFocusChanged`, `QuickhackStarted`, `QuickhackApplied`, `QuickhackFailed`, `QuickhackTraced`, `RamChanged`, `BreachCompleted`.
  - Zlecenia i telefon: `ContractBonusChanged`, `ContractDebrief`, `PhoneMessage`.
  - Typy pomocnicze: `AwarenessState` (unaware, suspicious, searching, alerted) i `PhonePriority` (story, contract, info).
- **Komenda** `breach-result` (`core/src/commands`). UI rozgrywa minigrę Breach Protocol (albo autorozwiązanie, które daje mniej demonów), a symulacja tylko stosuje wynik. Losowość układu minigry siedzi w UI, poza strumieniem deterministycznym. Symulacja ufa wynikowi, tak jak ufa wyborom w dialogu.
- **Wejście** (`core/src/ports/input-port.ts`): `scan` (przytrzymanie) i `quickhack` (krawędź, 1..5, 0 brak).
  - Klawiatura: skaner na Z lub środkowym przycisku myszy. Tab, klawisz z Cyberpunka, otwiera tu menu postaci. Przy przytrzymanym skanerze klawisze 1-5 wybierają quickhack zamiast broni.
  - Pad: kliknięcie prawej gałki.
  - Dotyk: przycisk i lista w HUD (fala 1 po stronie UI).
  - Klawisz skanera jest na liście w ustawieniach.
- **Dane** w `core`:
  - `hacking/quickhacks.ts`: `QUICKHACKS` z kategorią, celami, RAM, czasem uploadu i działania, `BASE_RAM`, `RAM_REGEN_PER_SECOND`, `QuickhackFailure`, `BreachDaemonId`;
  - `crime/heat.ts`: `CrimeKind`, `WitnessChannel`, `HeatLevel` 0..3, `CrowdState`, `DisturbanceKind`;
  - `contracts/debrief.ts`: `ContractBadge` (ghost, no_alarm, clean, untouched, swift, netrunner), `BonusCondition`, `FIXER_STYLE`, `ContractRank`.

## Decyzja: reguły, które implementacja musi zachować
- **Przestępstwo istnieje dopiero, gdy ktoś je zobaczył.**
  - Cywil po zobaczeniu dzwoni przez kilka sekund (`WitnessCalling`). Zabity, zastraszony albo wyprzedzony przez gracza nie dodzwoni się.
  - Kamera i patrol zgłaszają od razu.
  - Heat rośnie tylko przez `CrimeReported`.
- **Heat 0..3** należy do ochrony dystryktu (Hebi na ulicy i targu, Tessen w Dokach, później NCPD).
  - Wsparcie pojawia się poza kamerą gracza, nigdy za jego plecami w zasięgu wzroku. To główna krytyka premiery Cyberpunka.
  - Utrata kontaktu włącza poszukiwanie wokół `lastKnown`. Po `searchLeft` sekundach bez kontaktu heat spada o jeden poziom.
  - HUD pokazuje gwiazdki: przygaszone przy poszukiwaniu, migające przed końcem.
- **Ostatnia znana pozycja.** Wróg, który stracił gracza z oczu, idzie do `lastKnown`, rozgląda się, potem wraca na posterunek lub trasę. HUD pokazuje tam sylwetkę.
- **Quickhacki.**
  - Działają tylko na cel w fokusie skanera i w zasięgu.
  - RAM pobierany jest przy starcie uploadu. Upload przerwany przez utratę celu zwraca połowę.
  - Upload w zasięgu wzroku wroga może zostać namierzony (`QuickhackTraced`), co daje mu `lastKnown` na gracza.
  - Skaner lekko spowalnia czas świata, przez `worldTimeScale`, jak zdolności.
- **Breach Protocol tylko na terminalach.** Na wrogach nie działa, jak po 2.0. Musi mieć tryb bez limitu czasu i autorozwiązanie.
- **Karta podsumowania.**
  - Odznaki liczy symulacja z własnych zdarzeń w trakcie zlecenia.
  - Liczniki są w stanie zlecenia i zerują się przy wczytaniu.
  - Ranga: S dla co najmniej 4 odznak z kompletem warunku bonusowego, A dla 3, B dla 1-2, C dla 0.
  - Bonus za warunek i za styl fixera (`FIXER_STYLE`) jest jawny na karcie.
- **Telefon.**
  - Jedna kolejka powiadomień: `story` przerywa, `contract` czeka w kolejce, `info` czeka na spokojną chwilę.
  - W trakcie dialogu i walki nie przychodzi nic poza `story`.
  - Treść to knoty ink (`knot`), a mapa pokazuje tylko przyjęte zlecenia.
- **Dostępność** (wymóg dla UI i engine):
  - opcja „ogranicz błyski i glitch” wyłącza aberrację, glitch i migotanie;
  - każdy efekt mieści się w progach XAG 118 i WCAG 2.3.1 (najwyżej 3 błyski na sekundę);
  - jest skala HUD i opcja czytelnej czcionki;
  - minigra i dialogi z limitem czasu mają tryb bez limitu.
- **Zapis.** Heat, RAM i liczniki zlecenia wchodzą do zapisu, z podbiciem `SAVE_SCHEMA_VERSION` i migracją z testem, w jednej zmianie na całą falę.

## Podział pracy (fala 1)
- **Sim (systemy i AI):**
  - tłum, świadkowie i heat;
  - ostatnia znana pozycja;
  - skaner, RAM i quickhacki na kamerach, urządzeniach i ludziach;
  - warunek bonusowy, liczniki odznak, debrief, `PhoneMessage` z ofert zleceń.
  - Nowe systemy trafiają do `createSystems()`, a złoty hash zmienia się świadomie.
- **App i UI:**
  - telefon z kolejką i holocallem, karta podsumowania, gwiazdki heat, wskaźnik wykrycia i sylwetka, hit marker i liczby obrażeń z trybami;
  - HUD skanera z listą quickhacków i RAM, minigra Breach Protocol;
  - HUD kontekstowy z tokenami kolorów, pakiet dostępności.
- **Engine:**
  - LUT i paleta na dystrykt jako dane;
  - atlas holoreklam i szyldów na thin instances;
  - jeden post-process zdarzeń (obrażenia, skaner, upload, heat), sterowany uniformami, z rozgrzaniem shaderów;
  - widok skanera (podświetlenie celów).
- **Treść:**
  - kamery i urządzenia do hakowania w dystryktach;
  - styl trzech fixerów w dialogach, tagi wejść w miejscach zleceń;
  - trzy prowadzone zlecenia startowe, wiadomości telefonu w ink.

## Konsekwencje
- Nowe pole w `InputFrame` zmienia kształt wejścia, ale nie złote hashe (wejście nie wchodzi do hasha stanu).
- `breach-result` przenosi zaufanie do UI. Gra jest jednoosobowa, więc to akceptowalne, a replay zachowuje wynik jako komendę.
- Kolejne fale (metro, radio, przebrania, Cyberware Capacity, generator wariacji zleceń) korzystają z tych samych zdarzeń.

## Zmiany kontraktu
Tylko dopisania: nowe pola opcjonalne i doprecyzowania. Nic nie zmieniło znaczenia ani nie zniknęło.

- **Fala 1 w symulacji (ADR-0029):**
  - `HeatChanged.faction?: FactionId`: czyja ochrona ściga gracza (`hebi` albo `tessen`), żeby HUD mógł podpisać gwiazdki. Bez heat pole nie występuje.
  - `PhoneMessage.from` to id zleceniodawcy (`kaito`, `hana`, `genzo`), a `knot` ma postać `phone_<id>_<sytuacja>`, sytuacje: `offer`, `paid`, `failed`.
  - `ContractCompleted.reward` zostaje nagrodą bazową. Całą wypłatę (nagroda, bonus, styl) niesie `EddiesChanged.delta`, a podział `ContractDebrief`.
  - `AwarenessChanged` wysyłają też kamery (`observerId` to kamera).
  - Dane w domenie: `DomainState.heat` (`HeatState`) i `DomainState.netrun` (`NetrunState`), `ContractLog.tally?` (`ContractTally`) i `Contract.breach?` (demony wygrane na terminalu), w `EntitySnapshot` opcjonalne `lastKnown`, `search`, `lost`. Schemat zapisu 11.
- **Po HUD fali 1 (propozycje z implementacji UI):**
  - `quickhacksFor(kind)` i `MAX_QUICKHACK_SLOTS` w `core/hacking`: jedna lista hacków dla celu, wspólna dla sim i HUD.
  - `ScanFocusChanged` dostaje opcjonalne `kind`, `name` i `faction`, żeby HUD nie zgadywał rodzaju celu.
  - `EntityKilled.killerId`, opcjonalne: znacznik zabójstwa i liczniki odznak.
  - Nowe zdarzenie `BreachStarted { terminalKey, daemons }`: symulacja otwiera minigrę na terminalu. „Odłącz” wysyła zdobyte do tej pory demony (także pustą listę). Przerwanie przez obrażenia nie wysyła nic i terminal można złamać ponownie.
  - `RenderPort.setReduceFlashes?(on)`: opcja dostępności dla engine.
  - `HeatChanged.searchLeft` zostaje migawką: HUD odlicza sam od ostatniego zdarzenia.
