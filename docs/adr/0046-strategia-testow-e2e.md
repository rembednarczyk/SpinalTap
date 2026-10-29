# ADR-0046: Strategia testów e2e: mniej przeglądarki, więcej testów bez renderera

## Kontekst
Po falach 2 i 3 oraz przy przenosinach do Lublina e2e blokowały pracę i niewiele dawały. Dane z logów zadań w tle tej sesji (227 przebiegów Playwright i vitest, 338 plików wyjścia):

- **Koszt.**
  - Łączny czas ścienny przebiegów e2e: ok. 35 godzin. Pojedynczy pełny przebieg lokalnie trwał 28-33 min.
  - W CI e2e trwa 39-48 min, a sprawdzenia bez przeglądarki 4 min.
- **Wynik.** Na 199 podsumowań z zaliczonymi testami przypada 154 z niezaliczonymi. Przyczyny w kolejności:
  - przekroczenia `Test timeout` (257 wystąpień) i `page.evaluate` (78);
  - „Target crashed” (181);
  - budżet czasu klatki (138);
  - konflikty portów i serwera podglądu (74);
  - przekroczenia czasu w vitest pod obciążeniem (31);
  - niestabilne elementy (20).
- **Co naprawdę znalazły.** Prawdziwe błędy z e2e w tej sesji:
  - testy zakładały start na ulicy po przeniesieniu startu do kliniki (7 testów);
  - brak tonu przy dwóch opcjach barmana (to i tak złapał test jednostkowy).

  Wszystkie pozostałe czerwone wyniki to środowisko:
  - cztery agenty puszczały pełne e2e naraz na 4 rdzeniach (load do 22);
  - SwiftShader;
  - zimny start gry, 25-60 s na test;
  - wczytanie dystryktu, 3-22 s.
- **Jak na to reagowaliśmy.**
  - Podnosiliśmy limity: 90 s → 180 s, czas klatki „do ustalenia się”, wywołania rysowania 400 → 520.
  - Przebiegi powtarzaliśmy, a agentom kończyły się 30-minutowe okna monitorowania w trakcie e2e.
  - Każde podniesienie limitu leczyło objaw i wydłużało pętlę.
- **Pokrycie się dubluje.** Z 33 testów e2e tylko 6 sprawdza rysowanie: migawka NPR, budżety perf, ubrane modele VRoid. 27 sprawdza logikę i UI przez pełną przeglądarkę z WebGL, czyli to, co pokrywają już testy pętli w `packages/app/test` (m0-loop, m3-loop, inventory-loop, trade-loop, m4-docks-loop i inne, z fałszywym rendererem) oraz testy komponentów w `packages/ui/test`. Te przechodzą w sekundy.

## Decyzja
1. **Podział testów.**
   - **e2e w przeglądarce zostaje tylko dla tego, czego nie da się sprawdzić bez niej:**
     - rozruch gry;
     - migawka NPR i budżety rysowania (`npr-perf`);
     - modele VRoid (`models`);
     - prawdziwy układ HUD na telefonie i dotyk (`touch-layout`, `touch`);
     - jeden przekrojowy `smoke`: nowa gra, dialog przez UI, zapis i odczyt z IndexedDB.
   - **Reszta przechodzi do testów sesji bez renderera** (app, vitest, fałszywy `RenderPort`), z UI sprawdzanym testami komponentów:
     - ads-melee, character-menu, combat-posture, day-cycle, docks, hud-wave1/2, inventory, levels, m3-lustro, market-contract, streaming, trade.

     Spec usuwamy dopiero, gdy jego asercje są pokryte gdzie indziej.
2. **Bez czasu rzeczywistego w testach.**
   - Testy krokują symulację z testu (`freeze` + `step`) i czekają na stan gry, nie na zegar.
   - Spec zależny od pętli czasu rzeczywistego przepisujemy na krokowanie albo przenosimy do testów sesji.
3. **Czas klatki to raport, nie bramka.** Pod SwiftShaderem w CI czas klatki mierzy wydajność runnera, a nie gry.
   - Bramką CI zostają wywołania rysowania i aktywne siatki, bo są deterministyczne.
   - Czas klatki trafia do `reports/perf.json`.
   - Prawdziwy pomiar wydajności robimy ręcznie na urządzeniu z GPU (telefon i desktop) przy zmianach rysowania.
4. **Podnoszenie limitu czasu nie jest poprawką.**
   - Przekroczenie czasu wymaga przyczyny: śladu, nagrania albo pomiaru. Jeśli przyczyną jest wolny start lub wczytanie, poprawką jest szybszy start, tryb testowy bez zbędnych zasobów albo przeniesienie testu do testów sesji.
   - Wyjątek tylko z uzasadnieniem w commicie i wpisem do listy długu w tym ADR.
5. **Jeden Playwright na maszynę.**
   - Lokalne e2e przez `pnpm e2e e2e/<spec>.spec.ts`, czyli `tools/e2e.sh`.
   - Skrypt bierze blokadę (druga sesja czeka) i daje każdemu checkoutowi własny port.
   - Agenty puszczają tylko spece dotyczące swojej zmiany. Pełny zestaw puszcza CI.
6. **CI.** e2e w trzech shardach równolegle ze sprawdzeniami (wcześniej: jeden job po sprawdzeniach).

## Dług: limity podniesione przed tym ADR
Zostają do czasu przeniesienia lub przyspieszenia, potem do usunięcia:
- `test.setTimeout(180_000)` w `smoke`, `market-contract`, `touch`;
- `settledPerf` w `npr-perf`: oczekiwanie do 15 s na czas klatki;
- `models`: limit wywołań rysowania 520, z rozrzutem 335-486 zależnym od tego, ile modeli zdąży się ubrać. Pomiar powinien czekać na komplet ubranych modeli, a nie na pierwszy.

## Konsekwencje
- **CI:** e2e z ok. 40 min do kilkunastu minut na shard, a po przeniesieniu specs do ok. 10 testów w przeglądarce.
- **Lokalnie:** zmiana logiki sprawdzana w sekundy w vitest. Przeglądarka tylko przy zmianach rysowania, HUD i wejścia.
- **Ryzyko:** test sesji z fałszywym rendererem nie złapie błędu łączenia app z engine. Pokrywa go `smoke` i ręczne granie po większych zmianach.
