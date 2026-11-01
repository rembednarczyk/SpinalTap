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
7. **CI.** e2e w trzech shardach równolegle ze sprawdzeniami (wcześniej: jeden job po sprawdzeniach).

## Dług: limity podniesione przed tym ADR
Zostają do czasu przeniesienia lub przyspieszenia, potem do usunięcia:
- `test.setTimeout(180_000)` w `smoke` (dwa zimne starty), `touch` i `touch-layout`; `test.setTimeout(150_000)` w `models`.
- Budżet sceny `reference` w `tools/perf-budgets.json` podniesiony z 184 / 76 do 194 / 81 (G-052, 31.10). Krakowskie sięga do z = −270, a kamera wewnątrz Neon Koi patrzy na południowy zachód: za ścianami w stożku widzenia jest nowy pas (map-ground +2, map-far +1, map-near +1, map-signs +1). Zmierzone 181 / 76 → 191 / 81, pozostałe sceny bez zmian. Do usunięcia, gdy wnętrze zasłoni miasto za ścianami (np. occlusion query albo wyłączanie chunków spoza wnętrza).

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
| Prawy przycisk myszy to celowanie | `E/keymap.test.ts` › aims while the right mouse button…; `E/browser-input.test.ts` › falls back to plain mouse look and fire…; prawdziwa mysz: `e2e/smoke.spec.ts` › real input… |
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
| Prawdziwa spacja w działającej pętli | `e2e/smoke.spec.ts` › real input…; `E/keymap.test.ts` › jumps on the Space edge |
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
