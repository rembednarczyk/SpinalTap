# ADR-0031: Rozbicie god objectów przed falą 2

## Kontekst
Po fali 1 kod urósł do ok. 34 tys. linii (bez testów). Przed kolejnymi funkcjami sprawdziłem, które moduły skupiają za dużo odpowiedzialności. Metoda:
- rozmiary plików;
- liczba metod i pól w klasach;
- długość funkcji, ze skanu AST przez kompilator TypeScript;
- liczba subskrypcji szyny i zapisów do store'u;
- sposób, w jaki komponenty React korzystają ze store'u i intencji.

### Wyniki (od najpoważniejszego)

| Miejsce | Liczby | Problem |
|---|---|---|
| `app/src/game-session.ts`, `GameSession` | 76 metod, 31 pól, 685 linii klasy, 30 z 49 wywołań `patchUi` w app | Klasyczny god object. W jednej klasie siedzą pętla kroku i renderu, dialog, sklep, łup, menu postaci z podglądem 3D, ekwipunek, ustawienia i klawisze, telefon, skaner i breach, zapis, odczyt i odtworzenie stanu, podpowiedzi i synchronizacja HUD. Każda nowa funkcja dopisuje pole i metody tutaj. |
| `ui/src/intents.ts`, `UiIntents` | 41 metod w jednym interfejsie | God interface (łamie ISP). `useIntents()` zwraca cały obiekt, więc każdy komponent zależy od wszystkich 41 intencji. To jedyny „god hook” w kodzie. Selektor `useUi` jest wąski i poprawny. |
| `ui/src/store/ui-store.ts`, `UiState` | 75 pól w jednym płaskim typie | God store. Jeden store Zustand jest w porządku, ale płaski typ bez podziału na obszary nie mówi, kto co zapisuje. App zapisuje go z trzech miejsc. |
| `engine/src/renderer/babylon-renderer.ts`, `BabylonRenderer` | 33 metody, 42 pola, 690 linii | God object po stronie widoku: spawn propów i postaci, ubieranie modeli i loadouty, efekty, lasery, deszcz, city kit, dressing, paleta dystryktu, post-process zdarzeń, podświetlenie skanera i kamera. |
| `app/src/event-presenter.ts`, `bindEventPresenter` | jedna funkcja, 175 linii, 45 subskrypcji | God function: wszystkie zdarzenia domeny na UI, dźwięk i efekty w jednym ciele. |
| `engine/src/audio/synth-audio.ts`, `SynthAudio` | 33 metody, 29 pól, 983 linie pliku | Spójna dziedzina (dźwięk), ale jeden plik łączy syntezę głosów, ambient, muzykę warstwową i mikser. |
| `engine/src/renderer/characters.ts` | 1048 linii, `humanoid` 126, `animateRig` 100 linii | Budowa rigu, animacja i skinning w jednym pliku. |
| `ui/src/inventory/inventory-tab.tsx`, `InventoryTab` | 169 linii jednego komponentu | God component: siatka, przeciąganie, filtry i akcje. |
| `sim/src/simulation.ts`, `apply` | 110 linii, 12 gałęzi | Rozdzielnik komend jako jeden `switch`. Czytelny, ale rośnie z każdą komendą. Handlery przedmiotów i handlu są już osobno. |

### Co jest w porządku
- **`Entity` w sim** (41 opcjonalnych komponentów) to normalny worek komponentów ECS. Systemy biorą tylko swoje komponenty (`world.with(...)`), więc nie jest to god object.
- **`Simulation`** (19 metod) jest fasadą: logika siedzi w systemach z `createSystems()`.
- **Selektory w komponentach** są wąskie (po jednym polu), więc nie ma zbędnych przerysowań. `Hud` składa się z małych podkomponentów.
- **Granice pakietów** pilnuje depcheck i są czyste.

## Decyzja
Docelowy podział, w kolejności:

1. **Intencje UI (ui, kontrakt).**
   - `UiIntents` zostaje jako suma wąskich interfejsów: `SessionIntents` (nowa gra, pauza, wyjście, zapis i odczyt), `DialogueIntents`, `ShopIntents`, `LootIntents`, `CharacterIntents` (menu, podgląd, ekwipunek, mody), `SettingsIntents` (ustawienia i klawisze), `PhoneIntents`, `HackIntents` (skaner, quickhack, breach).
   - Komponenty biorą intencje przez wąskie hooki (`useDialogueIntents()` itd.).
   - `useIntents()` zostaje tylko dla kompozycji w `GameUi`.
2. **Stan UI (ui).** `UiState` dostaje nazwane, osobno typowane obszary: sesja i ekran, HUD gracza, walka, zlecenia, dialog, handel, łup, postać, mapa, telefon, hacking, ustawienia. Na razie to typy składowe i funkcje zapisu per obszar w jednym store, bez zmiany kształtu w czasie działania. Komponenty i testy działają dalej.
3. **`GameSession` (app)** zostaje kompozycją i pętlą (krok, render, ekran, `inControl`). Reszta przechodzi do kontrolerów, każdy implementuje swój interfejs intencji i ma własny stan:
   - `DialogueController`, `ShopController`, `LootController`;
   - `CharacterMenuController` (menu, podgląd, ekwipunek);
   - `SettingsController`, `PhoneController`, `HackController` (skaner, touch scan, breach);
   - `SaveController` (zapis, odczyt, snapshot, restore);
   - `HudSync`, czyli dzisiejsze `syncHud` i trackery.
   - Kontrolery dostają wąskie zależności (szyna, store, symulacja przez funkcję), a nie `GameSession`.
4. **Prezenter zdarzeń (app):** osobne prezentery per obszar (walka, handel, zlecenia i fabuła, łup, świat), rejestrowane z jednej listy. `Wave1Hud` też rozbity tak samo.
5. **`BabylonRenderer` (engine)** zostaje fasadą `RenderPort`. Wydzielone są:
   - `CharacterViews`: spawn i despawn postaci, modele, loadouty, śmierć;
   - `PropViews`: bloki, neony, lampy, łup, dekoracje;
   - `ScreenFx`: efekty, lasery, post-process zdarzeń, paleta, podświetlenie skanera;
   - `CityKitLoader` z oczekującymi skórkami.
6. **Pozostałe pliki z tabeli:**
   - `SynthAudio`: głosy, ambient, muzyka i mikser w osobnych modułach;
   - `characters.ts`: budowa rigu, animacja i skinning osobno;
   - `InventoryTab`: podkomponenty i własny hook przeciągania;
   - `Simulation.apply`: tabela handlerów komend, jeden handler na grupę komend, z tym samym porządkiem i deterministycznym wynikiem.
7. **Strażnik przed nawrotem.** ESLint `max-lines` (500 na plik źródłowy) i `max-lines-per-function` (120). Wyjątki dla plików z danymi treści (dystrykty, katalog przedmiotów, dane city kitu) są wypisane w konfiguracji z komentarzem. Reguła z liczbą metod klasy trafia do `CLAUDE.md`.

## Ograniczenia refaktoru
- Zachowanie się nie zmienia: te same testy przechodzą, złote hashe bez zmian, migawka NPR bez zmian, e2e zielone.
- Bez zmian w zapisie i w zdarzeniach domeny. Kontrakt `UiIntents` zmienia tylko kształt typów (suma wąskich interfejsów), metody i nazwy zostają.

## Konsekwencje
- Nowa funkcja z fali 2 (metro, radio, przebrania) dostaje własny kontroler, prezenter i obszar stanu, zamiast dopisywać się do `GameSession`, `UiIntents` i `BabylonRenderer`.
- Testy app mogą tworzyć pojedynczy kontroler bez całej sesji.

## Wynik
| Miejsce | Przed | Po |
|---|---|---|
| `GameSession` | 808 linii, 76 metod | 239 linii; kontrolery w `app/src/controllers/` (dialog, sklep, łup, menu postaci, ustawienia, telefon, hacking, zapis, `HudSync`, `HintSync`), każdy poniżej 190 linii |
| `UiIntents` | 41 metod w jednym interfejsie | suma 9 wąskich interfejsów (dodatkowo `ContractIntents`), wąskie hooki `use*Intents()`; żaden komponent nie wywołuje `useIntents()` |
| `UiState` | 75 pól płasko | 12 nazwanych obszarów, typy VM w `ui-vm.ts` |
| `bindEventPresenter` | 175 linii, 45 subskrypcji | 28 linii i lista prezenterów per obszar w `app/src/presenters/` |
| `Wave1Hud` | 386 linii | 115 linii, fasada nad częściami |
| `BabylonRenderer` | 798 linii, 33 metody | 249 linii; `CharacterViews`, `PropViews`, `ScreenFx`, `CityKitLoader` |
| `SynthAudio` | 983 linie | 219 linii; `cues`, `audio-graph`, `synth-voices`, `ambience`, `layered-music` |
| `characters.ts` | 1048 linii | reeksport; 7 plików, `animateRig` 16 linii |
| `InventoryTab` | 194 linie | 138 linii i hook `useInventorySelection` |
| `Simulation.apply` | 110 linii, `switch` | tabela handlerów z typem wymuszającym komplet, `simulation.ts` 175 linii |

Złote hashe, migawka NPR i zapis bez zmian. ESLint pilnuje limitów (`max-lines` 500, `max-lines-per-function` 120); wyjątek `max-lines` mają tabele treści dystryktów, katalog przedmiotów i dane city kitu.

## Zapadka klas (1.11)
Limit „ok. 20 metod na klasę” nie miał strażnika i dziewięć klas go przekroczyło. Od 1.11 pilnuje go test `tools/code-health/test/god-objects.test.ts`: liczy metody, akcesory i właściwości z funkcją (parser TypeScript), a klasy ponad 20 trzyma w `god-objects-baseline.json`. Baza tylko spada; nowa klasa ponad limit albo wzrost klasy z listy to czerwony test. Stan na wejściu: `BabylonRenderer` 42, `GameSession` 33, `MapCity` 33, `CharacterViews` 24, `ToonMaterials` 23, `StreetProps` 22, `GangerAgent` 22, `SynthAudio` 21, `WorldStreamer` 21. Podział każdej z nich to osobny PR bez zmiany zachowania (złote hashe, migawka NPR, budżety bez zmian).

Postęp (1.11, każdy podział osobnym PR-em, zachowanie potwierdzone sondą porównującą stary i nowy kod):

| Klasa | Przed | Po | PR | Części |
|---|---|---|---|---|
| `MapCity` | 33 | 19 | #140 | `MapEntries` (wpisy i zapytania), `MapCells`, `CellBuilder`, `streamCells`, `MapLook`, `map-city-stats` |
| `WorldStreamer` | 21 | 13 | #141 | `StreamCatalog`, `contract-templates`, `ActorSpawner`, `chunk-unload`, `presence-sync`, `dormant-restore` |
| `BabylonRenderer` | 42 | 17 | #146 | `MapCitySlot`, `WetAsphalt`, `RendererLoading`, `RendererStats`, typ `ScreenEffects` |
| `GameSession` | 33 | 14 | #157 | `SessionFlow`, `SessionLoop`, `SessionScreen`, `composeIntents`; zapis pod `session.saves`, debug pod `session.debug` |
| `CharacterViews` | 24 | 20 | #163 | `CharacterModels`, `CharacterKit`, `CharacterDeaths`, funkcja `disposeRig` |
| `ToonMaterials` | 23 | 19 | #171 | `createToonMaterial` (fabryka), `ToonPointLights`, `ToonSceneUniforms`, `ToonEnvironment` (sonda mokrego asfaltu); zrzut 67 materiałów identyczny bajt w bajt |
| `GangerAgent` | 22 | 14 | #177 | `GangerWalk` (pościg przez poziomy, obchodzenie, utknięcie), `ganger-fight` (`attack`, `faceTowards`) nad wąskim `GangerBinding`; agent to sam blackboard drzewa |

Zostają w bazie: `StreetProps` 22, `SynthAudio` 21.
