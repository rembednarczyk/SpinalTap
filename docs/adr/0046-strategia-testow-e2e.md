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
6. **Modele VRoid tylko tam, gdzie są przedmiotem testu.**
   - Pod SwiftShaderem skinowanie pełnej obsady liczy się na procesorze. W Lublinie start w klinice zajmował 45 s na CI, a klatki blokowały wątek główny tak długo, że `page.evaluate` nie zdążało w 90 s (`inventory`, `smoke`, ślady z CI).
   - Spece startują z `models=off`, z wyjątkiem `models`: ubranie postaci i budżet rysowania. Spec `character-menu` z podglądem na jednym modelu przeszedł do testów sesji (zob. „Wynik przeniesienia”).
7. **CI.** e2e w trzech grupach równolegle ze sprawdzeniami (od 15.11; wcześniej dwa i trzy shardy, a jeszcze wcześniej jeden job po sprawdzeniach). Szkice PR i zmiany samej dokumentacji nie uruchamiają testów, każdy job ma limit czasu (decyzja użytkownika 1.11: oszczędność minut bez utraty pokrycia).
   - **Podział grup według czasu (17.11).** Grupy wybiera `E2E_GROUP` w `playwright.config.ts` (tam czasy speców), grupa 3 bierze wszystko, czego nie wymieniono, więc nowy spec zawsze biegnie. Runnery różnią się tempem do 1,8×: w sześciu zielonych przebiegach main 17.11 grupa 3 trwała 13,8–23,5 min, a w PR #663 24,5 min i zadanie anulowano. `ui-scale` przeszedł z grupy 3 do 2; na najwolniejszym runnerze grupy mają wtedy ok. 17,6, 18,4 i 18,8 min testów, na typowym ok. 15. Limitu 25 min nie podnosimy (decyzja użytkownika 16.11); gdy któraś grupa znów zbliży się do ok. 20 min, przenosimy spec albo dodajemy czwartą grupę.
   - **Czwarta grupa (21.11).** `npr-perf` urósł z 7 do 14 scen (Alchemia T1, T2, P-1, P-2, Zielona, dwie W-3, telefony) i grupa 1 przekraczała 25 min na wolnych runnerach: na main po #856 (LOD drzew i słupków) sceny TPP po 1,4–1,5 min, `gpu-queue` 3,6 min, `models` 1,8 min, a na szybkim runnerze cały shard w 18 min. Grupa 4 bierze sześć późniejszych scen `npr-perf` (P-2, Zielona, obie W-3, oba telefony) i `gpu-queue` (wybór po tytułach, `GROUP_FOUR` w `playwright.config.ts`); grupa 1 zostaje z klatką referencyjną, siedmioma pierwszymi scenami i `models`. Na wolnym runnerze z #847 to ok. 15 i 12 min. Limit 25 min i limity testów bez zmian. Sama scena TPP na wolnym runnerze trwała 85–90 s przy limicie testu 90 s (ok. 30 s z 55 lokalnie to ekran tytułowy i nowa gra) i w powtórce #859 Alchemia T1 padła dwa razy. Sceny miasta w grupie 1 (Krakowskie, Rynek, Podzamcze, Alchemia T1, T2, P-1) dzielą teraz jedną grę (`test.describe` szeregowy ze wspólną stroną, start w `beforeAll`), a każda tylko przenosi gracza i idzie: lokalnie 9–18 s na scenę zamiast 55–60 s, cały `npr-perf` grupy 1 w 2,9 min. Pomiary takie jak przy starcie od zera (Krakowskie 366 / 163, Podzamcze 140 / 61, T1 283 / 113, T2 222 / 77; Rynek 216 / 88 zamiast 220 / 89, P-1 189 / 73 zamiast 197 / 74). Sceny W-3 i telefonów zostają z własnym startem: W-3 sprawdza dokładną listę wczytanych chunków, telefony mają inną jakość. W tej samej rundzie test `traffic-player-car` (z #855) kończy pomiar 3 s po zatrzymaniu się ruchu zamiast po 40 s (11,8 s na wolnym runnerze, 59% limitu).
   - **PR lekki, main i noc pełne (decyzja użytkownika 16.11).** Na PR zawsze biegną typecheck, lint i architektura. Testy jednostkowe tylko te, do których prowadzi graf importów od zmienionych plików (`vitest related`), bez pokrycia i jego progów. E2e tylko przy zmianie `engine`, `app`, `ui`, `e2e/`, `playwright.config.ts`, modeli i zasobów, wygenerowanych tablic mapy albo plików wspólnych. Pliki wspólne (`.github/`, `package.json`, lockfile, `tsconfig*`) dają pełny zestaw, a konfiguracja vitest, narzędzia CI i `data/` pełne testy jednostkowe. Reguły i ich testy są w `tools/ci-scope`. Push do main, nocny przebieg (02:17 UTC) i uruchomienie ręczne biegną w całości. Push po PR-ze nie powtarza testów tylko wtedy, gdy PR miał pełny przebieg na tej samej bazie. Każdy push do main ma własną grupę współbieżności (commit), więc nowszy merge nie anuluje pełnego przebiegu starszego (decyzja użytkownika 16.11): czerwony main wskazuje merge, który go zepsuł. Na PR nowszy push nadal anuluje starszy przebieg.
   - **Czerwony main to pierwsza praca.** To, czego lekki PR nie sprawdził, wychodzi najpóźniej na main albo w nocy. Wtedy pierwszą pracą sesji jest poprawka albo revert winnego commitu, zanim wejdzie cokolwiek innego.
8. **Bramka czasu testów jednostkowych (decyzja użytkownika 12.11).** Ostrzeżenie, nie czerwony test; limitu 20 min na shard nie podnosimy.
   - Shardy unit zapisują czas każdego pliku reporterem `tools/test-time/src/reporter.ts` (całość: import z blokami `describe` i testy z hookami; import był 58% czasu przed PR #430, `docs/plany/czas-testow.md`) i wysyłają artefakt `unit-times-<shard>`. Przebieg na main (push) to punkt odniesienia, artefakt trzyma 30 dni.
   - Zadanie `test-time` po shardach, obok sprawdzeń, więc poza ścieżką krytyczną: bez `pnpm install`, Node uruchamia TypeScript narzędzia wprost. Pobiera czasy z ostatniego zielonego przebiegu main, który je ma (`gh run download` z `GITHUB_TOKEN` i `actions: read`), i porównuje plik po pliku (`tools/test-time/src/times.ts`, testy w `tools/test-time/test`).
   - Ostrzeżenie (`::warning` i tabela w podsumowaniu przebiegu) dostaje plik wolniejszy o ponad 50% i o ponad 2 s. Próg bezwzględny odsiewa szum: małe pliki trwają 0,1–1 s i skaczą o sekundę między przebiegami, a plik, którego worker nie wczytał jeszcze tabel miasta, płaci za import ok. 5 s (projekt `shared` bez izolacji). Podsumowanie ma też sumę czasu i 10 najwolniejszych plików z rozbiciem na import. Nowy plik i brak punktu odniesienia nie dają ostrzeżenia.
   - Pomiar przed wejściem (12.11, lokalnie dwa razy `packages/sim` i `packages/core` z pokryciem, 208 plików): żaden z 104 plików poniżej 1 s nie zmienił się o ponad 1 s. Duże pliki zależą od obciążenia maszyny: przy load 11–13 na 4 rdzeniach 34 pliki przekroczyły oba progi między dwoma przebiegami tego samego kodu, a 6 plików przeniosło między sobą import tabel miasta (12–19 s pod tym obciążeniem). Runner CI nie dzieli procesora z innymi zadaniami, więc szumu będzie mniej; gdy ostrzeżeń okaże się za dużo, kolejny krok to skalowanie czasów main przez stosunek sum albo porównanie samych testów w projekcie `shared`.

## Dług: limity podniesione przed tym ADR
Zostają do czasu przeniesienia lub przyspieszenia, potem do usunięcia:
- (12.11) Punkty o budżecie `reference` niżej mieszczą się w progach docelowych z [ADR-0079](0079-urzadzenie-docelowe-i-apk.md) (+40%). Zostają jako opis przyczyn; przesłanianie dla kamery we wnętrzu dalej w backlogu jako optymalizacja.
- `test.setTimeout(180_000)` w `smoke` (dwa zimne starty), `touch` i `touch-layout`; `test.setTimeout(150_000)` w `models`.
- Budżet sceny `reference` w `tools/perf-budgets.json` podniesiony z 184 / 76 do 194 / 81 (G-052, 31.10). Krakowskie sięga do z = −270, a kamera wewnątrz Neon Koi patrzy na południowy zachód: za ścianami w stożku widzenia jest nowy pas (map-ground +2, map-far +1, map-near +1, map-signs +1). Zmierzone 181 / 76 → 191 / 81, pozostałe sceny bez zmian. Do usunięcia, gdy wnętrze zasłoni miasto za ścianami (np. occlusion query albo wyłączanie chunków spoza wnętrza).
- Aktywne siatki tego samego budżetu `reference` podniesione z 81 do 82 (ADR-0058 etap 7, 2.11): wspólna siatka dronów nad deptakiem jest w stożku widzenia kamery w Neon Koi za ścianami, poza obrazem (migawka bez zmian). Zmierzone 191 / 81 → 193 / 82; wywołania mieszczą się w 194. Do usunięcia razem z punktem wyżej.
- Budżet `reference` podniesiony z 194 / 82 do 196 / 84, a aktywne siatki `krakowskie-tpp` ze 164 do 165 (G-556, decyzja użytkownika 11.11). Budynki ze środkiem poza mapą wracają przycięte do brzegu. Szkoła Urszulanek (r14476826) stoi w komórce renderu 1:−3, gdzie dotąd nie było budynku, i dokłada jej siatki `map-far` i `map-signs`. XVI LO (w66330436) dokłada `map-far` w komórce 3:−3. Samo przycięcie nie tworzy osobnej siatki. Zmierzone 193 / 82 → 196 / 84 i 375 / 164 → 377 / 165. Do usunięcia, gdy siatki komórek scalą się w większe bloki albo gdy poszerzenie mapy przesunie budżety tych scen.
- Budżet `reference` podniesiony z 196 / 84 do 199 / 85 (G-522, PR #409, decyzja użytkownika 12.11: wyjątek i przesłanianie osobno). Wypełnienia krawężników dają w chunku `krakowskie-1-0` miejsce na jeszcze jedno zaparkowane auto (dostawczak w (153,7; −147,9), w mieście 91 → 92). Leży w stożku widzenia kamery w Neon Koi, ok. 60 m od jego najbliższej płaszczyzny, a z kadru znika tylko za ścianami. Siatka zaparkowanej floty (`parked`) jest więc rysowana: odcięcie po stożku z G-595 tego nie usuwa. Zmierzone po połączeniu z main (2fac07d) 196 / 84 → 199 / 85, tyle samo co na gałęzi przed połączeniem (193 / 82 → 196 / 83). Pozostałe sceny mieszczą się w swoich budżetach. Do usunięcia razem z dwoma pierwszymi punktami o `reference`, gdy wejdzie przesłanianie dla kamery we wnętrzu (pozycja „Przesłanianie dla kamery we wnętrzu” w [backlogu](../backlog.md)).
- (13.11) Czas importu po etapie 2 [ADR-0078](0078-operacje-na-wielokatach-clipper2.md) (bufor linii na Clipper2 z `roundJoints`, gałąź G-744) przekracza próg +15%. Decyzja użytkownika 13.11: przyjąć z wpisem tutaj. `pnpm bench:ab origin/main HEAD`, 12 par przeplatanych, pod obciążeniem (load 3,4–24,0, większość par ponad progiem 4), więc liczby są przybliżone: `osm:build` (`generate` całego miasta) +20,2% (4998 → 5695 ms, połowa par +14…+24%); test „sign nearly all of the city's venues” w `tools/osm-import/test/venues.test.ts` (zimna pamięć podręczna miasta) +29,1% (3975 → 4969 ms, połowa par +15…+32%). Limity czasu testów bez zmian. Do usunięcia, gdy etap 3 lub 4 ADR-0078 zastąpi własne cięcia (`cutHoles`, `clipRingToRect`) operacjami Clipper2 albo gdy `roundJoints` przestanie liczyć sumę pokrycia przy każdym złączu; pomiar powtórzyć tym samym poleceniem przy niskim obciążeniu.

- (20.11) Sufit trójkątów sceny `phone-low` w `tools/perf-budgets.json` podniesiony z 1 200 000 do 1 400 000 (decyzja użytkownika 20.11: „podbij limit miasta do 1400000”). Zmierzone na main po #827 1 195 985 (Koziołek w wersji na telefon), z pełnym Koziołkiem 1 204 281; modele bliżej oryginałów (limit 6 tys. trójkątów) i kolejne meble potrzebują zapasu. Wywołania rysowania i aktywne siatki bez zmian (239 / 151). Do usunięcia, gdy LOD mebli z daleka zmieści telefon z powrotem pod 1,2 mln.

- Test „sign nearly all…” (`tools`, podpisy miasta) wolniejszy o +15,0% wobec main przez regułę gołej ziemi (ADR-0077 krok 1.1, PR #483; decyzja użytkownika 13.11: przyjąć). Dwie rundy przyspieszeń bez zmiany wyniku (`coverFills` ok. 375 → 290 ms, `convexParts` 90 → 17 ms) zeszły z +19–21% do progu kroku; w CI ok. 9,5 s przy celu 12 s. Reszta kosztu: Clipper (85–90 ms) i rozgrzewka JIT. Do usunięcia, gdy wypełnienia staną się buforowanym artefaktem `osm:build` albo gdy wejdzie zmiana Clippera (odrzucanie rozłącznych pierścieni, zmiana tablic o 1 cm, do decyzji).

## Konsekwencje
- **CI:** e2e z ok. 40 min do kilkunastu minut na shard, a po przeniesieniu specs do ok. 10 testów w przeglądarce.
- **Lokalnie:** zmiana logiki sprawdzana w sekundy w vitest. Przeglądarka tylko przy zmianach rysowania, HUD i wejścia.
- **Ryzyko:** test sesji z fałszywym rendererem nie złapie błędu łączenia app z engine. Pokrywa go `smoke` i ręczne granie po większych zmianach.

## Wynik przeniesienia
Dziesięć speców logiki i UI przeszło do vitest.
- Testy `packages/app/test/*-ui.test.tsx` montują prawdziwe UI (`GameUi`) na store sesji, z sesją jako intencjami, fałszywym `RenderPort` i tym samym debug API, którego używały spece (`packages/app/test/game-ui.tsx`).
- Symulację krokuje test w `act()`. Nie ma zegara ani pętli przeglądarki.
- Porty są jeden do jednego: te same ziarna, miejsca, kroki i kliknięcia.

Skróty: `A` = `packages/app/test`, `U` = `packages/ui/test`, `E` = `packages/engine/test`, `S` = `packages/sim/test`.

### hud-wave1
| Asercja | Teraz |
|---|---|
| PhoneMessage daje powiadomienie „Oyaji” | `A/hud-ui.test.tsx` › phone, debrief card and breach…; `A/wave1-hud.test.ts` › queues phone messages… |
| T otwiera telefon, wątek „Wróć po ósmej”, drugie T zamyka | `A/hud-ui.test.tsx` › phone, debrief…; `U/wave1-hud.test.tsx` › opens on T… |
| Karta zlecenia: „Infiltracja”, ranga S, suma 1650, Enter zamyka | `A/hud-ui.test.tsx` › phone, debrief…; `U/wave1-hud.test.tsx` › shows rank, badges… |
| Breach: 25 komórek, „Autorozwiązanie (1 demon)” zamyka i oddaje sterowanie | `A/hud-ui.test.tsx` › phone, debrief…; `U/breach.test.tsx` › auto-solves into one daemon…; `A/wave1-hud.test.ts` › plays a breach… |

### hud-wave2
| Asercja | Teraz |
|---|---|
| Mapa linii z kiosku, „Jesteś tutaj”, Esc zamyka | `A/hud-ui.test.tsx` › metro, radio and the wave 2 badges…; `U/wave2-hud.test.tsx` › lists the stops… |
| Przejazd: „Nabrzeże Bystrzycy”, napis z ink, znika po MetroArrived | `A/hud-ui.test.tsx` › metro, radio…; `A/wave2.test.ts` › shows the ride with ink subtitles… |
| B stroi radio, telefon pokazuje stację `drift` | `A/hud-ui.test.tsx` › metro, radio…; `U/wave2-hud.test.tsx` › switches stations with B… |
| Buff `regen`, przebranie „ochrona Tessen”, „Spalona przykrywka” | `A/hud-ui.test.tsx` › metro, radio…; `A/wave2.test.ts` › shows the disguise from the domain… |

### inventory
| Asercja | Teraz |
|---|---|
| Pasek broni „Unity-9”, „12 / 48”, strzały zmniejszają licznik | `A/inventory-ui.test.tsx` › the weapon strip counts rounds down…; `A/inventory-loop.test.ts` › shows the starter pistol… |
| R: „przeładowanie”, potem „12 / 4x” | `A/inventory-ui.test.tsx` › the weapon strip…; `U/weapon-loot.test.tsx` › tells reloading, empty… |
| Zabity strażnik zostawia `loot:guard`, podpowiedź „Przeszukaj” | `A/inventory-ui.test.tsx` › a killed ganger leaves a bag…; `A/inventory-loop.test.ts` › a killed ganger leaves a bag… |
| Panel „Torba gangera”, pierwsza linia „€$”, „Weź wszystko” zamyka panel | `A/inventory-ui.test.tsx` › a killed ganger…; `U/weapon-loot.test.tsx` › takes one line, all of it… |
| Więcej €$, torby nie ma, brak dialogu | `A/inventory-ui.test.tsx` › a killed ganger… |

### day-cycle
| Asercja | Teraz |
|---|---|
| Zegar „Dzień 1”, „noc”, 21:0x | `A/day-trade-ui.test.tsx` › the HUD clock follows game time…; `U/ui.test.tsx` › shows the game clock… |
| Po 90 min i 300 krokach 22:3x | `A/day-trade-ui.test.tsx` › the HUD clock…; `A/m2-schedules.test.ts` › the HUD clock runs… |
| Stragan nocą: podpowiedź „zamknięte” | `A/day-trade-ui.test.tsx` › the HUD clock…; `A/m2-schedules.test.ts` › Oyaji is closed at night… |
| Rano „dzień”, „Dzień 2”, brak podpowiedzi | `A/day-trade-ui.test.tsx` › the HUD clock… |

### trade
| Asercja | Teraz |
|---|---|
| Południe następnego dnia, podpowiedź „Stragan Oyajiego”, sklep „Oyaji” | `A/day-trade-ui.test.tsx` › by day Oyaji's stall buys a medkit…; `A/trade-loop.test.ts` › sells the loot at the stall… |
| Zakładka „Sprzedaj”, apteczka za 22 €$, portfel +22 | `A/day-trade-ui.test.tsx` › by day…; `U/shop-trade.test.tsx` › the Sprzedaj tab quotes… |
| Znika „Apteczki × 1” i linia apteczki | `A/day-trade-ui.test.tsx` › by day… |
| „Odejdź od straganu” zamyka sklep, bez dialogu | `A/day-trade-ui.test.tsx` › by day… |

### m3-lustro
| Asercja | Teraz |
|---|---|
| Skok do kroku 3 aktu II, cel „Kurosawa z Kagami czeka na wiadukcie” | `A/m3-lustro-ui.test.tsx` › Kurosawa's deal on the overpass…; `A/m3-lustro-loop.test.ts` › M3 acceptance… |
| Na wiadukcie podpowiedź „Kurosawą”, rozmowa: „dział odzysku”, „przyjęła pani zlecenie” | `A/m3-lustro-ui.test.tsx` › Kurosawa's deal… |
| Przyciski „Bierzcie Rena i archiwum”, „chip w białym etui”, „Zakończ rozmowę” | `A/m3-lustro-ui.test.tsx` › Kurosawa's deal…; `U/dialogue-wheel.test.tsx` › mouse: hovering highlights, a click picks… |
| „Koniec aktu II: Lustro”, flagi `act2_ending` i `ending:kagami`, retrospekcja „Wszystko się zgadza.” | `A/m3-lustro-ui.test.tsx` › Kurosawa's deal…; `A/m3-lustro-loop.test.ts` › after aya, she sells Ren to Kagami |

### combat-posture
| Asercja | Teraz |
|---|---|
| Rozrzut celownika > 0 | `A/posture-ui.test.tsx` › crouching lowers the view… |
| Kucanie: klasa `crosshair--crouched`, rozrzut < 0,6 stania | `A/posture-ui.test.tsx` › crouching…; `A/combat-posture.test.ts` › narrows while crouched…; `U/ui.test.tsx` › spreads the crosshair ticks… |
| Kamera niżej o ponad 0,35 m | `A/posture-ui.test.tsx` › crouching… (transform gracza na porcie renderu przez `eyeHeightAt`, tę samą krzywą co `camera-rig`) |
| Bieg: bez kucania, rozrzut większy niż na stojąco | `A/posture-ui.test.tsx` › crouching…; `A/combat-posture.test.ts` › narrows while crouched… |

### ads-melee
| Asercja | Teraz |
|---|---|
| Prawy przycisk myszy to celowanie | `E/keymap.test.ts` › aims while the right mouse button…; `E/browser-input.test.ts` › falls back to plain mouse look and fire…; prawdziwa mysz: `e2e/smoke-play.spec.ts` › real input… |
| Celowanie: `crosshair--aiming`, rozrzut < 0,7 biodra, `posture.aim` = 1 | `A/posture-ui.test.tsx` › holding the aim button…; `A/ads-melee.test.ts` › reports aiming and the zoom…; `U/ui.test.tsx` › pulls the ticks in while aiming… |
| Puszczenie: bez klasy, rozrzut wraca do biodra | `A/posture-ui.test.tsx` › holding the aim button… |
| Digit3 wybiera pałkę, pasek „Pałka” | `E/keymap.test.ts` › reloads on R and picks weapon slots…; `A/posture-ui.test.tsx` › with the baton… |
| Z pałką celowanie to garda: `crosshair--guard`, `melee.guard` | `A/posture-ui.test.tsx` › with the baton…; `S/ads-melee.test.ts` › a guard raised early takes a quarter of the blow… |
| Strzał to zamach: faza nie `idle`, potem `idle` | `A/posture-ui.test.tsx` › with the baton…; `S/ads-melee.test.ts` › holding the button chains the three swings… |

### levels
| Asercja | Teraz |
|---|---|
| Schodami na wiadukt, wysokość 9,9 m | `A/levels-ui.test.tsx` › stairs up to the overpass…; `S/levels.test.ts` › climbs the stairs… |
| Przy bramce windy podpowiedź „Winda”, winda w dół, pod pomostem na ziemi | `A/levels-ui.test.tsx` › stairs up…; `S/levels.test.ts` › the freight lift carries… |
| Skok w górę o ponad 0,3 m i lądowanie | `A/levels-ui.test.tsx` › jump onto a stall counter…; `S/jump-ladder.test.ts` › has no double jump… |
| Prawdziwa spacja w działającej pętli | `e2e/smoke-play.spec.ts` › real input…; `E/keymap.test.ts` › jumps on the Space edge |
| Skok na ladę 1 m | `A/levels-ui.test.tsx` › jump onto…; `S/jump-ladder.test.ts` › cannot walk onto a 1 m counter… |
| Drabina `targ-escape-1`, podpowiedź „Wspinaj się”, `targ-escape-2`, dach > 8 m | `A/levels-ui.test.tsx` › jump onto…; `S/jump-ladder.test.ts` › walks into the ladder… |
| Minimapa pokazuje poziom („m”) | `A/levels-ui.test.tsx` › jump onto…; `U/journal-map-settings.test.tsx` › shows stairs, lifts and ladders… |

### character-menu
| Asercja | Teraz |
|---|---|
| Łup ze strażnika: niezwykły Hebi SMG (ziarno 71), klik albo dotyk „Weź wszystko” | `A/character-menu-ui.test.tsx` › on a desktop…, on a phone… |
| I albo „Postać” otwiera menu z ekwipunkiem; na telefonie bez padu | `A/character-menu-ui.test.tsx` › on a desktop…, on a phone…; `U/character-screen.test.tsx` › opens on its tab…, replaces the touch sheet… |
| Podgląd widoczny, w ręce pistolet, nic schowanego | `A/character-menu-ui.test.tsx` › on a desktop… (prostokąt i wygląd na `PreviewHost`); `E/loadout.test.ts` › holsters the sidearm… |
| Pole podglądu wystarczająco duże (desktop > 180×300, telefon > 100×150) | `e2e/smoke.spec.ts` › journal, minimap and settings; `e2e/touch-layout.spec.ts` › nothing overlaps… |
| Szczegóły SMG: „niezwykły”, „slot główny pusty”, „Obrażenia” | `A/character-menu-ui.test.tsx` › on a desktop…; `U/character-screen.test.tsx` › selects on a tap and compares… |
| „Załóż”: slot główny, zegar stoi, podgląd dostaje SMG, „Założona” | `A/character-menu-ui.test.tsx` › on a desktop…; `A/character-menu.test.ts` › stops the clock while open… |
| Przeciągnięcie myszą albo palcem obraca podgląd | `A/character-menu-ui.test.tsx` › on a desktop…, on a phone…; `U/character-screen.test.tsx` › sends its rectangle, turns on a drag… |
| Zakładka „Karta”, podgląd znika, Esc albo krzyżyk zamyka, krok idzie dalej | `A/character-menu-ui.test.tsx` › on a desktop…, on a phone… |
| Zapis, nowa gra, odczyt: SMG w slocie i w podglądzie | `A/character-menu-ui.test.tsx` › on a desktop…, on a phone… |
| Hełm i kamizelka na podglądzie, przyciemniona góra | `A/character-menu-ui.test.tsx` › a helmet and a ballistic vest… (wygląd); `E/loadout.test.ts` › moves garment add-ons to the model's head and chest bones…, tints the model's cloth… |
| Podgląd przerysowany po zmianie, ubrany model VRoid | rysowanie modeli: `e2e/models.spec.ts`; licznik przerysowań podglądu nie jest już sprawdzany |

### Co zostało w przeglądarce
Zostają `smoke`, `npr-perf`, `models`, `touch-layout` i `touch`. Doszły tylko kroki, których nie da się sprawdzić bez przeglądarki:
- `smoke` › real input: prawy przycisk myszy celuje, a spacja skacze w działającej pętli. Sprawdza drogę zdarzeń strony przez `BrowserInput` (blokada wskaźnika albo jej zastępstwo) do symulacji. Mapowanie przycisków sprawdzają `E/keymap.test.ts` i `E/browser-input.test.ts`.
- `smoke` › journal, minimap and settings: rozmiar pola podglądu postaci na desktopie (układ CSS).
- `touch-layout`: menu postaci z przycisku „Postać” na telefonie, pad schowany, rozmiar pola podglądu przy 800×370 i 667×375.

### Liczby
- **Testy e2e** (`pnpm e2e --all --list`): 33 w 15 plikach przed, 19 w 5 plikach po.
- **Czas e2e przed:** lokalny pełny przebieg 26 testów bez `npr-perf` i `models` trwał 19,7 min, a te dwa spece w shardzie CI ok. 7,5 min, razem ok. 27 min. Przeniesione 15 testów zajmowało z tego ok. 11 min (od 20 s do 66 s na test).
- **Czas e2e po:** każdy spec osobno przez `pnpm e2e`: `smoke` 4,1 min, `npr-perf` 3,6 min, `touch` 1,2 min, `models` 0,7 min, `touch-layout` 0,6 min, razem ok. 10 min. Przebieg „przed” miał jeszcze obsadę VRoid w specach logiki, więc część różnicy daje też `models=off` (punkt 6).
- **Nowe testy bez przeglądarki:** 15 testów w 7 plikach `A/*-ui.test.tsx`, od 0,15 do 1,4 s na test, razem ok. 12 s z importami na obciążonej maszynie.
- **Pokrycie** (`pnpm test:coverage`, zakres bez `app` i `engine`) wzrosło: instrukcje 96,79 → 96,85%, gałęzie 90,87 → 91,07%, funkcje 96,72 → 96,90%, linie 98,19 → 98,25%.

## Dług: testy ponad połową limitu przy starcie bramki ADR-0083 (15.11)
22 testy przekraczały 10 s z 20 s już w pierwszym przebiegu bramki czasu (CI run 43714759388): determinizm, zapis i wczytanie w trakcie paniki i walki, modele postaci, P-1 Alchemii, `generate.test` i jeden rodzaj skanu. Są na liście `tools/test-time/src/exceptions.ts` z `only: "limit"`: zwalnia je to tylko z progu połowy limitu, a wzrost wobec main nadal zatrzymuje PR. Wpis znika, gdy test zejdzie poniżej 10 s (ADR-0083 krok 3: wspólna pamięć miasta).

16.11 doszły dwa wpisy: `vest-plate-model.test.ts` (G-870, 11,2 s, trzy pliki VRM i cztery pozy) i `flee-dead-zone.test.ts` (15,5 s, 78%, bez zmian w sim, na granicy progu 75% pod obciążeniem CI). Oba do kroku 3 ADR-0083.

16.11 z listy zeszły cztery wpisy determinizmu (decyzja użytkownika po przeglądzie antywzorców): złoty hash liczy się teraz na małej podłodze testowej poza miastem (`packages/sim/test/fixtures/determinism-floor.ts`), a jej testy biegną 0,9–2,6 s pod pokryciem (wcześniej 6,2–7,8 s na Lublinie). Został jeden wpis: „same seed + same input stream = same end state”, dwa przebiegi na Lublinie bez złotej liczby (7,6–10 s pod pokryciem), do kroku 3 ADR-0083.

16.11 (po #647) z listy zszedł `generate.test` „generates the same tables from the committed raw data twice”: na CI 19,3 s, potem ponad 20 s (run 43955164086, czerwony main). Profil nie wskazał drogiej reguły: jedno `generate` Starego Miasta to ok. 1,7 s bez pokrycia, w tym Clipper2 (`roundJoints`) 27%, place budowy (`withBuiltSites`) 2%, zebry ok. 1%, `kerbFills` 4%; czas trzykrotnie mnożyła instrumentacja pokrycia (2,9 → 8,5 s lokalnie). Test sprawdza teraz dwa przebiegi `generate` w jednym procesie na tych samych wejściach (stan modułów, zmienione wejścia), na jednym chunku `stare-miasto-1-1`, w procesie poza pokryciem (`tools/osm-import/test/generate-twice.ts`): 8,5 → 2,4 s lokalnie pod pokryciem (mediana z 3). Determinizm całego miasta między procesami i maszynami pilnuje porównanie bajt w bajt w jobie Map tables i `pnpm tables:check`.

## Dług: pościg z parkingu do hali Alchemii (20.11)
`alchemia-foodhall.test.ts` „an alerted brawler on the car park gets to the player in the hall (P0) down the stairs” po galerii (ADR-0093 O1–O4) i placu (C5) trwał na CI 10,0 s (run 44669513871), czyli 50% limitu, a lokalnie 5,1–5,7 s z pokryciem. Profil: dominuje koszt kroku (+40% po O3), nie liczba kroków (+18%). `SolidIndex.collidersNear` oddaje każdemu ciału w Alchemii 140–375 brył z kubełków 16 m; zawężenie zmienia `foothold`/`supported`, więc to osobne zadanie w sim, nie poprawka testu. Do tego czasu wyjątek bramki tylko dla limitu (`tools/test-time/src/exceptions.ts`), do zdjęcia po zadaniu. Przy okazji: test zmienił nazwę w #787 i bramka trzyma go na 50%, dopóki main nie ma zielonego przebiegu.

20.11, po zawężeniu (`perf/solid-index-granularity`): `collidersNear` oddaje tylko części, których własne pudełko styka się z prostokątem ciała (w tym pościgu 249 → 57 na zapytanie, w całym pakiecie sim 35 → 9), a punkt oparcia poza prostokątem (`supported`, stopnie schodów i ruchomych schodów jeden pod drugim) bierze dawną pełną listę (`collidersAt`). Trajektorie bajt w bajt te same w 1501 testach sim z ruchem, złoty hash bez zmian. Zysk czasu jest mały: ruch w teście z pokryciem 654 → 478 ms na ziarno (pomiar A/B w jednym procesie, ten sam stan), cały test ok. −0,35 s z ok. 5 s lokalnie (ok. 7%), na CI szacunkowo 10,0 → ok. 9,3 s. Wyjątek zostaje. Przesłanka z profilu z 20.11 była błędna: pętle po bryłach to mała część kroku. Profil z pokryciem: `ganger-ai` ok. 50% czasu kroku (ChasePlayer → `pursueTo`, w tym zimne rastry i pola nawigacji pierwszego pościgu w pliku, `rasterise` i `fieldSteps` ok. 1,1–1,5 s), ruch ok. 20%, `lineOfSight` ok. 8%. Następny krok w obszarze AI: rastry pościgu z wspólnej pamięci miasta albo mniej pól na krok.

20.11, rastry sterowania (gałąź `perf/ai-poscig-rastry`): napastnik schodzący po schodach i rampie dostaje nowe piętro co 0,25 m (`floorOf`), więc nowy raster tego samego okna, a każdy liczył od nowa teren okna (ok. połowa rastra piętra) i przechodził komórki pod bryłami innych kondygnacji. Teraz teren okna jest liczony raz na ziemię, okno i zasięg (`terrainLayer`), a raster pomija bryły bez wierzchu w paśmie piętra i nad głową, zanim policzy obrys. Wyniki bez zmian: hash pozycji, prędkości i kąta każdego ciała po każdym kroku w całym `sim` (2101 testów, 1,23 mln kroków) i w testach app Alchemii i Lublina ten sam. Z pokryciem lokalnie (load 2,5–4,5): pościg do hali 5,2–5,3 → 4,7–4,9 s, pościg parking ↔ pomost (`alchemia-parking.test.ts`, 4 pościgi, wpis `KNOWN_SLOW`) 10,0 → 9,2–9,8 s; `rasterise` w profilu parkingu 1150 → 400 ms, w hali 1170 → 850 ms. To za mało, by zdjąć oba wpisy (na CI ok. 2× wolniej: ok. 9,5 i 18 s). Zostaje koszt kroku poza rastrami. W parkingu: `attach` grafu poziomów (`world/nav.ts`, linie wzroku na wysokości kolan do węzłów w 120 m) 2,6 s z 10,2 s profilu, z czego połowa to przyczepienie celu, który w teście stoi w miejscu, a liczony jest co krok (`routeAcrossLevels`); ruch 2,7 s (PR #808). W hali: rastry i pola parteru 0,85 + 0,36 s (`closeBanks` 0,28 s), ruch 1,5 s, oraz zbędny szeroki raster piętra -6,25, porzucony, gdy napastnik zszedł na -6,5 (stoi przy tym ok. 60 kroków u stóp schodów; kandydat na glitch, zgłoszony orkiestratorowi). Dalej: pamięć przyczepienia punktu do grafu, póki punkt i bryły kinematyczne stoją (obszar Simulation), i przyspieszenie ruchu.

## Dług: droga Hideo pod kładką (20.11)
`w5-street-life.test.ts` „Hideo walks down Grodzka under the footbridge to the bus stop in the morning” trwał na CI 16,2 s (81% globalnego limitu, shard w tempie 1,27 przy #806), lokalnie 9,1–9,8 s z pokryciem. Pomiar: test krokuje całą drogę Hideo (18 tys. kroków, na przystanek dochodzi ok. kroku 17 tys.), gracz idzie 20 s za nim i dociąga chunki; bez tłumu i ruchu ulicznego czas spada tylko o ok. 7%. Czekanie na stan nic nie da (stan końcowy przychodzi na końcu), więc to praca samego testu, nie spowolnienie. Wyjątek bramki tylko dla limitu w `tools/test-time/src/exceptions.ts`; test ma własny limit 60 s. Do zdjęcia, gdy krok symulacji w mieście stanieje albo test sprawdzi drogę na krótszym odcinku z tym samym przejściem pod kładką.

## Dług: wzrost czasu testu wobec main tylko jako raport (16.11)
Bramka wzrostu z ADR-0083 (test ponad 30% i 1 s wolniejszy od mediany main) przez dobę zatrzymywała niewinne PR-y. Na współdzielonych runnerach ten sam test waha się o 30–150%, a skalowanie tempem przebiegu (#612, potem per shard) nie wystarczało. Przez ten czas nie złapała żadnego prawdziwego spowolnienia. Decyzja użytkownika z 16.11: wzrost jest ostrzeżeniem (`::warning` i tabela w podsumowaniu), a PR zatrzymują tylko limity: 50% limitu dla nowego testu i 75% dla każdego (`blocking` w `tools/test-time/src/gate.ts`). Wpis znika, gdy mediany main przyjdą ze spokojnego przebiegu (osobny runner albo liczba instrukcji zamiast czasu) i wzrost znów zacznie blokować.

## Dług: nadpisane limity testów jednostkowych ponad 20 s (16.11)
Decyzja użytkownika z 16.11 po przeglądzie antywzorców: wolny test dostaje szybszą konstrukcję, nie wyższy limit. Bramka czasu liczy od 16.11 udział każdego testu w globalnych 20 s, nie w jego własnym `timeout` (`tools/test-time/src/reporter.ts`). Testy logiki pościgu za barierą (G-610, G-625, G-643, G-644, G-694) przeszły na podłogę z barier mapy (`packages/sim/test/fixtures/barrier-floor.ts`), a nadpisania testów poniżej 10 s na CI zniknęły: z 71 miejsc (ok. 77 testów) zostało 11. Każde z powodem:
- `traffic-junction-drive.test.ts` (3 miejsca, 11 testów, 120–240 s): minuta porannego szczytu z pełnym ruchem i tłumem przy skrzyżowaniach i zakrętach Lublina (G-006, G-075, G-744), 15–62 s na CI. Tematem jest geometria tych skrzyżowań, więc bez podłogi. Wyjątek bramki w `exceptions.ts`. Podział na trzy pliki według miejsc (26.11, #1064) cofnięty: trzy pliki szły równolegle w trzech workerach jednego shardu, a reszta testów shardu zwalniała o 40–110% wobec main w dwóch przebiegach CI (bramka czasu: `loot.test.ts` 76–79%, `god-objects.test.ts` 75%). Ciężkie symulacje jednego pliku idą kolejno w jednym workerze. Do zrobienia: ruch tylko w chunkach wokół skrzyżowania albo mniej ziaren w jednym teście.
- `props-build.test.ts` (240 s): dwa pełne przebiegi `pnpm osm:props` (G-745), 58 s na CI. Wyjątek bramki.
- `bridge-edges-ai.test.ts`, pierwszy test (120 s): 19 s na CI, buduje rastry wokół dolnego mostu Mełgiewskiej dla siedmiu następnych. Wyjątek bramki.
- `w5-street-life.test.ts` (60 s): Hideo na Grodzkiej, 13 s na CI, w 75% z 20 s.
- `crowd.test.ts`, „a shot sends them running” (30 s, dawniej `vi.setConfig` dla całego pliku): 12 s na CI.
- `fpp-hands.test.ts`, dwa `it.each` (60 s, obszar Rendering): 8,7–9,9 s na CI, z wczytaniem modelu.
- `grass-on-light-paving.test.ts` i `blank-flight.test.ts` (120 s): tylko lokalnie, na ortofoto z pamięci podręcznej (na CI pominięte).
Wpis znika, gdy ostatnie z nich zejdą poniżej 10 s.

16.11 (#625): `crowd.test.ts` „a shot sends them running…” wraca na listę wyjątków z `only: "limit"` (19,5 s z 20 s na CI). Wpis zdjęto w #610, gdy test miał w sobie limit 30 s, a od #623 udział liczy się od globalnych 20 s. Czas to sama panika i powrót tłumu na trasę; wpis znika po przyspieszeniu systemu tłumu (profil).
