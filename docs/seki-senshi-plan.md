# Seki Senshi — plan architektury i pracy agentowej

**Projekt:** cyberpunkowy sandbox 3D (web), FPP z przełączaniem na TPP, stylistyka anime / cel-shading (referencja: Ghost in the Shell).
**Bohaterka:** kobieta po wypadku bez pamięci własnego imienia; fixer nazywa ją **Seki Senshi**. Wątek główny to odzyskiwanie tożsamości.
**Tryb wytwarzania:** agentic development (zespół wyspecjalizowanych agentów pracujących w rozłącznych pakietach).
**Status dokumentu:** v1, baza do iteracji. Decyzje otwarte oznaczone jako `[DECYZJA]`.

---

## Spis treści
1. [Założenia produktu i zakres](#1-założenia-produktu-i-zakres)
2. [Stack technologiczny](#2-stack-technologiczny)
3. [Zasady architektoniczne](#3-zasady-architektoniczne)
4. [Architektura: warstwy, ECS, porty i adaptery](#4-architektura-warstwy-ecs-porty-i-adaptery)
5. [Struktura repozytorium](#5-struktura-repozytorium)
6. [Moduły domenowe i systemy](#6-moduły-domenowe-i-systemy)
7. [Pipeline renderingu NPR](#7-pipeline-renderingu-npr)
8. [Dane, determinizm, zapis stanu](#8-dane-determinizm-zapis-stanu)
9. [Warstwa narracji](#9-warstwa-narracji)
10. [Strategia testów](#10-strategia-testów)
11. [Model pracy agentowej](#11-model-pracy-agentowej)
12. [Roster agentów](#12-roster-agentów)
13. [Przepływ pracy i bramki CI](#13-przepływ-pracy-i-bramki-ci)
14. [Mapa drogowa](#14-mapa-drogowa)
15. [Rejestr ryzyk](#15-rejestr-ryzyk)
16. [ADR do podjęcia na starcie](#16-adr-do-podjęcia-na-starcie)
17. [Następne kroki](#17-następne-kroki)

---

## 1. Założenia produktu i zakres

### Filar rozgrywki
Eksploracja miasta, misje od fixera, walka z użyciem cyberware, dialogi i wybory wpływające na reputację u frakcji. Progresja postaci oparta na odzyskiwaniu wspomnień, co uzasadnia odblokowywanie umiejętności fabularnie (diegetycznie): Seki "przypomina sobie" dawne zdolności.

### Granice wersji (ważne dla realizmu zakresu)
Pełny open-world to zakres osobo-lat. Dlatego fundamentem jest **pionowy wycinek (M0)**: jeden mały dystrykt, jedna pętla rozgrywki działająca od wejścia gracza do zapisu stanu, przechodząca przez wszystkie warstwy. Sandbox rośnie jako iteracje na tym wycinku, nie jako osobny etap "na później".

### Cele niefunkcjonalne
- Determinizm symulacji (powtarzalność dla testów i zapisów).
- Budżety wydajności egzekwowane w CI (frame time, draw calls, pamięć GPU).
- Testowalność logiki bez kontekstu renderującego (większość kodu uruchamiana headless).
- Wymienność silnika renderującego dzięki portom (ochrona przed vendor lock-in).

---

## 2. Stack technologiczny

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| Język | TypeScript (strict) | Typy jako kontrakty między agentami; spójne z Twoim warsztatem. |
| Build | Vite + pnpm workspaces | Szybki HMR; workspaces wymuszają granice pakietów. |
| Silnik 3D | Babylon.js (`@babylonjs/core`, `loaders`, `materials`) | Code-first, pełny silnik w TS: fizyka, audio, GUI 3D, LOD, WebGPU w standardzie. |
| Fizyka | Havok (`@babylonjs/havok`, WASM) | Wysoka wydajność, oficjalna integracja z Babylonem. |
| ECS | `miniplex` | Ergonomiczny, TS-native, czytelny dla agentów. `[DECYZJA]` escape hatch na wydajność: `bitecs`. |
| UI / HUD | React + Zustand | HUD i menu poza silnikiem; Zustand lekki i testowalny. |
| Narracja | `inkjs` + format **ink** | Dialogi i rozgałęzienia jako dane, oddzielone od kodu. |
| Zdarzenia | mały typowany event bus (`nanoevents` lub własny) | Odsprzęganie systemów, UI, audio. |
| AI NPC | drzewa zachowań (`mistreevous`) + FSM | Testowalne, czytelne dla agenta narracyjnego. |
| RNG | własny `mulberry32` z ziarnem | Zero zależności, pełna kontrola nad determinizmem. |
| Stany złożone | `[DECYZJA]` XState dla questów/dialogów | Wizualizowalne i testowalne FSM; waży więcej niż ręczny automat. |
| Assety | glTF / glb + Draco/meshopt, tekstury KTX2/Basis | Kompresja pod web, mniejszy transfer i pamięć. |
| Persystencja | IndexedDB (`idb`) | Zapisy lokalne z wersjonowaniem schematu. |
| Testy jedn./integr. | Vitest + coverage v8 | Szybkie, headless, wysokie pokrycie taniej logiki. |
| Testy E2E | Playwright | Smoke build, uruchomienie sceny, migawki klatek referencyjnych. |
| Egzekwowanie granic | dependency-cruiser (+ eslint) | Reguły kierunku zależności jako bramka CI. |

`[DECYZJA]` cel renderowania: WebGL2 (szeroka kompatybilność) kontra WebGPU (wydajność, węższe wsparcie). Rekomendacja: WebGL2 jako baza, WebGPU za flagą.

---

## 3. Zasady architektoniczne

### SRP w praktyce
Jeden moduł, jedna odpowiedzialność, jeden powód do zmiany. System ECS robi jedną rzecz (np. `MovementSystem` liczy ruch, `CombatSystem` liczy obrażenia). Agent odpowiada za jeden pakiet. Plik odpowiada za jeden byt logiczny.

### Kierunek zależności (reguła twarda, pilnowana w CI)
```
ui ─────────┐
            ├──► app ──► sim ──► core
narrative ──┘             │
engine ───────────────────┘ (implementuje porty z core/sim)
persistence ──► core
```
- **`core` nie importuje niczego z Babylona ani z przeglądarki.** To warunek testowalności headless.
- Zależności wskazują do wewnątrz, w stronę domeny. Warstwy zewnętrzne znają wewnętrzne, nie odwrotnie.
- Silnik i UI komunikują się z domeną przez porty i zdarzenia, nie przez bezpośrednie referencje.

### Paradygmaty
- **Data-oriented** w symulacji (ECS): dane oddzielone od zachowań, systemy operują na komponentach.
- **Hexagonal (porty i adaptery)**: domena definiuje interfejsy, infrastruktura je wypełnia.
- **Funkcyjnie tam, gdzie się opłaca**: reguły domenowe jako czyste funkcje (obliczenia obrażeń, ekonomia, przejścia questów). Łatwe do testu, brak efektów ubocznych.
- **Immutability dla stanu domenowego** na granicach; mutacja dozwolona lokalnie w gorących ścieżkach ECS ze względu na wydajność.
- **Composition over inheritance**: brak głębokich hierarchii klas bytów; byt to zbiór komponentów.

### Konwencje
- Nazwy plików i katalogów kebab-case; typy PascalCase; funkcje camelCase.
- Conventional Commits.
- Każda publiczna granica pakietu ma jawny `index.ts` (barrel) jako kontrakt eksportowy.
- Brak `any` w `core` i `sim` (lint error).

---

## 4. Architektura: warstwy, ECS, porty i adaptery

### Warstwy
1. **core (domena)** — czyste TS. Reguły gry: walka, ekonomia, cyberware, reputacja, stan postaci, graf questów, model zapisu. Zero zależności od silnika.
2. **sim (aplikacja/symulacja)** — świat ECS, rejestr systemów, pętla gry, determinizm. Zależy od `core`. Z silnikiem rozmawia przez porty.
3. **engine (prezentacja)** — adaptery Babylona: renderer, graf sceny, kamery FPP/TPP, wejście, audio, pipeline NPR, LOD. Implementuje porty.
4. **ui** — React: HUD, menu, dialogi, ekwipunek. Czyta stan ze store'a i z busa zdarzeń. Nie dotyka Babylona.
5. **narrative** — integracja ink, treść dialogów i questów, spięcie stanu narracji z domeną.
6. **persistence** — zapis/odczyt, wersjonowanie schematu, migracje.
7. **app** — kompozycja: montuje porty, adaptery, świat, pętlę; punkt wejścia.

### Porty (definiowane w `core`/`sim`, implementowane w `engine`/`persistence`)
```ts
interface RenderPort {
  spawn(entityId: EntityId, view: ViewDescriptor): void;
  updateTransform(entityId: EntityId, t: Transform): void;
  despawn(entityId: EntityId): void;
  setCameraMode(mode: CameraMode): void; // FPP | TPP
}
interface InputPort { poll(): InputFrame; }
interface AudioPort { play(cue: AudioCue): void; stopAll(): void; }
interface PersistencePort {
  save(slot: string, snapshot: SaveSnapshot): Promise<void>;
  load(slot: string): Promise<SaveSnapshot | null>;
}
interface ClockPort { now(): number; } // wstrzykiwalny zegar dla testów
interface RandomPort { next(): number; } // RNG z ziarnem
```
Dzięki portom symulacja uruchamia się w teście z atrapami (fake adapters), bez Babylona i bez przeglądarki.

### Pętla gry
- **Fixed timestep** dla symulacji (np. 60 Hz): logika i fizyka deterministyczne.
- **Variable timestep** dla renderu z interpolacją między krokami symulacji.
- Akumulator czasu; separacja `update(dt)` od `render(alpha)`.

### Przepływ zdarzeń
Systemy emitują zdarzenia domenowe (`DamageDealt`, `QuestAdvanced`, `ItemPicked`). UI i audio nasłuchują. Bus jest typowany i synchroniczny w obrębie kroku, co zachowuje determinizm.

---

## 5. Struktura repozytorium

Monorepo pnpm. Granice pakietów są jednocześnie granicami własności agentów.

```
seki-senshi/
├─ package.json                # workspace root
├─ pnpm-workspace.yaml
├─ dependency-cruiser.config.cjs
├─ docs/
│  ├─ adr/                      # Architecture Decision Records
│  └─ seki-senshi-plan.md
├─ packages/
│  ├─ core/                     # domena, czyste TS
│  │  ├─ src/
│  │  │  ├─ combat/
│  │  │  ├─ cyberware/
│  │  │  ├─ economy/
│  │  │  ├─ reputation/
│  │  │  ├─ character/
│  │  │  ├─ quest/
│  │  │  ├─ ports/             # definicje interfejsów
│  │  │  └─ save/
│  │  └─ test/
│  ├─ sim/                      # ECS, systemy, pętla, determinizm
│  │  ├─ src/
│  │  │  ├─ world/
│  │  │  ├─ systems/           # jeden plik = jeden system (SRP)
│  │  │  ├─ loop/
│  │  │  └─ rng/
│  │  └─ test/
│  ├─ engine/                   # adaptery Babylon
│  │  ├─ src/
│  │  │  ├─ renderer/
│  │  │  ├─ npr/               # toon, outline, rim
│  │  │  ├─ camera/            # FPP/TPP
│  │  │  ├─ physics/           # Havok
│  │  │  ├─ input/
│  │  │  ├─ audio/
│  │  │  └─ assets/
│  │  └─ test/
│  ├─ narrative/                # ink + treść
│  │  ├─ ink/                  # pliki .ink
│  │  └─ src/
│  ├─ ui/                       # React + Zustand
│  │  └─ src/{hud,menus,dialogue,inventory,store}/
│  ├─ persistence/              # IndexedDB, migracje
│  └─ app/                      # kompozycja + entry point
├─ assets/                      # glb, ktx2, audio (źródła i zbudowane)
└─ tools/                       # skrypty pipeline'u assetów, perf-check
```

Reguły dependency-cruiser egzekwują: `core` bez importów z `engine`/`ui`/`babylonjs`; `ui` bez importów z `engine`; cykle zabronione.

---

## 6. Moduły domenowe i systemy

Każdy wpis to jedna odpowiedzialność i jej właściciel (agent).

| Moduł | Pakiet | Odpowiedzialność |
|---|---|---|
| Character state | core | HP, staty, stan cyberware, pamięć/umiejętności odblokowane. |
| Combat rules | core | Obliczenia obrażeń, trafienia, efekty statusowe, zasady broni. |
| Cyberware | core | Implanty, sloty, pasywy i aktywne zdolności, koszty. |
| Economy | core | Waluta (eddies), ceny, transakcje, zlecenia fixera. |
| Reputation / faction | core | Stan relacji z frakcjami, progi, konsekwencje wyborów. |
| Quest graph | core | Automat stanów questów, flagi, warunki, nagrody. |
| Movement system | sim | Integracja wejścia i fizyki w prędkość/transform. |
| Combat system | sim | Spięcie reguł walki z bytami w świecie. |
| Interaction system | sim | Wykrywanie obiektów interaktywnych, podnoszenie, rozmowa. |
| Spawn / schedule | sim | Tworzenie i cykl NPC, harmonogramy dobowe. |
| World streaming | sim | Chunking dystryktów, ładowanie/zwalnianie, LOD triggers. |
| NPC AI | sim | Drzewa zachowań i FSM dla zachowań NPC. |
| Renderer | engine | Scena Babylon, materiały, synchronizacja transformów z ECS. |
| NPR pipeline | engine | Toon shading, outline, rim light (sekcja 7). |
| Camera | engine | FPP i TPP, płynne przełączanie, kolizja kamery TPP. |
| Physics | engine | Havok: ciała, collidery, raycasty, character controller. |
| Input | engine | Mapowanie klawiatura/mysz/pad do `InputFrame`. |
| Audio | engine | Diegetyczne SFX, muzyka, miks. |
| Assets | engine | Ładowanie glb/ktx2, instancing, zarządzanie pamięcią. |
| HUD / menus | ui | Interfejs, ekwipunek, mapa, dialogi (render React). |
| Narrative runtime | narrative | Wykonanie ink, wariable store, spięcie z quest graph. |
| Save / load | persistence | Snapshot świata + stanu domeny, migracje schematu. |

### Przełączanie FPP/TPP (szczegół)
Jeden `CameraController` z dwoma trybami nad tym samym rigiem postaci. FPP: kamera w głowie, model ukryty lub tylko ręce/broń. TPP: kamera za postacią z collisionem (raycast do ścian, przyciąganie przy przeszkodzie). Przełączenie wysyła `setCameraMode` przez `RenderPort`; stan trybu trzyma domena, żeby zapis pamiętał preferencję.

---

## 7. Pipeline renderingu NPR

Stylistyka z referencji nie jest darmowa w żadnym silniku real-time. To osobny moduł wysokiego ryzyka, prowadzony przez dedykowanego agenta.

### Składniki
1. **Toon / cel shading** — custom material (Babylon `NodeMaterial` lub `ShaderMaterial`). Ramp lighting: oświetlenie kwantyzowane do kilku pasów zamiast gładkiego gradientu.
2. **Outline (kontur)** — dwie techniki do rozważenia: inverted-hull (zduplikowana siatka wypchnięta po normalnych, renderowana od tyłu) albo post-process na bazie wykrywania krawędzi (depth + normal edge detection). `[DECYZJA]` inverted-hull daje czystszą kreskę na postaciach, post-process lepiej skaluje na całą scenę.
3. **Rim light** — podświetlenie krawędzi sylwetki, buduje charakterystyczny look anime pod kontrę.
4. **Paleta i grading** — post-process color grading pod stonowaną, lekko wyblakłą paletę z referencji.

### Zasady
- Materiały NPR są wymienne per-obiekt (postać, NPC, otoczenie mogą mieć różne presety).
- Wydajność konturu pilnowana budżetem draw calls; inverted-hull podwaja geometrię postaci, więc wchodzi tylko dla bohaterów i bliskich NPC, nie dla tła.
- Pipeline ma tryb referencyjny (stała kamera + ziarno) do testów migawkowych, które chronią przed regresją wyglądu.

---

## 8. Dane, determinizm, zapis stanu

### Determinizm
- Całe RNG przez `RandomPort` z ziarnem. Brak `Math.random()` w `core`/`sim` (lint error).
- Czas przez `ClockPort`. Fixed timestep. Brak zależności od `Date.now()` w logice.
- Stała kolejność wykonania systemów (jawny rejestr, nie zależny od iteracji po mapie).

### Model zapisu
- `SaveSnapshot` = wersja schematu + ziarno + dane komponentów ECS + stan domeny (questy, flagi narracji, ekonomia, reputacja) + pozycja i preferencje gracza (w tym tryb kamery).
- Serializacja do JSON, zapis w IndexedDB, slot per zapis.
- **Wersjonowanie i migracje**: każda zmiana schematu podnosi wersję i dostarcza migrację ze starej. To jeden z najwyżej priorytetowych obszarów testów (sekcja 10).

### Replay
Ziarno plus zapis sekwencji `InputFrame` pozwala odtworzyć przebieg. Wykorzystywane w testach regresji symulacji i do debugowania zgłoszeń.

---

## 9. Warstwa narracji

### Technologia
Dialogi i rozgałęzienia pisane w **ink**, wykonywane przez `inkjs`. Pisarz pracuje w plikach `.ink` bez wchodzenia w kod silnika. Runtime narracji tłumaczy sygnały z ink na zmiany w domenie (odblokowanie questa, zmiana reputacji, nadanie przedmiotu) przez zdarzenia.

### Architektura treści
- `narrative/ink/` zawiera pliki `.ink`, kompilowane do JSON (build) lub ładowane przez inkjs.
- Zmienne globalne ink są zsynchronizowane z flagami quest graph w `core`, żeby zapis obejmował stan narracji.
- Quest graph w `core` jest nadrzędny dla struktury (automat stanów), ink odpowiada za treść i lokalne rozgałęzienia rozmów.

### Wątek Seki Senshi (szkielet)
- Start: przebudzenie po wypadku, brak imienia, fixer nadaje pseudonim.
- Motyw przewodni zgodny z referencją: pytanie o autentyczność wspomnień i tożsamości przy rozbudowanym cyberware.
- Progresja diegetyczna: odblokowania zdolności podane jako odzyskane wspomnienia, spięte z questami głównego wątku.
- Sandbox: zlecenia fixera jako pętla poboczna zasilająca ekonomię i reputację, z haczykami prowadzącymi do wątku głównego.

---

## 10. Strategia testów

Testowalność jest wbudowana w architekturę (porty, czysta domena, determinizm), nie dołożona na końcu. Podejście risk-based: najwięcej wysiłku tam, gdzie awaria boli najbardziej.

### Piramida
- **Jednostkowe (Vitest), rdzeń wysiłku** — cała logika `core`: obliczenia obrażeń, ekonomia, przejścia questów, reputacja, migracje zapisu. Tanie i wartościowe, cel wysokiego pokrycia w `core`.
- **Integracyjne systemów (Vitest)** — systemy `sim` na świecie ECS z atrapami portów, bez renderowania. Sprawdzają współdziałanie systemów w kroku pętli.
- **Kontraktowe portów** — każdy adapter spełnia kontrakt swojego portu (ten sam zestaw testów dla atrapy i implementacji Babylona tam, gdzie wykonalne).
- **Determinizm / replay** — ziarno plus sekwencja wejścia dają oczekiwany stan końcowy. Strażnik powtarzalności.
- **E2E smoke (Playwright)** — build się uruchamia, menu działa, scena M0 ładuje się, zapis i odczyt przechodzą.
- **Migawki NPR (Playwright)** — stała kamera i ziarno, porównanie klatki referencyjnej. Lekki strażnik wyglądu, świadomy swoich ograniczeń.

### Obszary najwyższego priorytetu (risk-based)
1. Integralność save/load i migracje (utrata postępu to najgorszy defekt w sandboxie).
2. Spójność stanu questów (zablokowanie wątku głównego).
3. Determinizm symulacji.
4. Budżety wydajności.

### Wydajność jako bramka CI
Instrumentacja Babylona (frame time, draw calls, liczba aktywnych siatek) mierzona na scenie referencyjnej. Przekroczenie budżetu to czerwony build. Progi `[DECYZJA]` ustalane po pierwszym profilowaniu M0.

### Znane ograniczenie
Pełna wizualna regresja 3D jest trudna i kosztowna. Migawki na stałej kamerze łagodzą, ale nie zastępują przeglądu wizualnego przy zmianach pipeline'u NPR.

---

## 11. Model pracy agentowej

### Zasada naczelna
Agenci komunikują się przez kontrakty (interfejsy TS) i testy, nie przez czytanie swoich wnętrz. Granica pakietu to granica własności. To przenosi SRP i czystą architekturę na poziom współpracy i eliminuje konflikty scalania.

### Guardrails
- **Własność katalogów**: agent pisze tylko w swoim pakiecie. Zmiana w cudzym pakiecie idzie przez zmianę kontraktu uzgodnioną z agentem-architektem.
- **Kontrakty przed implementacją**: najpierw interfejs portu lub typ zdarzenia, potem kod po obu stronach.
- **Testy jako artefakt handoffu**: moduł jest gotowy, gdy ma zielone testy swojego zakresu. Definition of Done jest mierzalne.
- **ADR dla decyzji**: każda decyzja architektoniczna ma wpis w `docs/adr/`.
- **Małe PR-y**, Conventional Commits, przegląd przez agenta-architekta pod kątem naruszeń granic.
- **Bramki CI** (sekcja 13) blokują merge przy złamaniu reguł zależności, spadku pokrycia lub przekroczeniu budżetu wydajności.

### Orkiestracja
Agent-architekt (orchestrator) dekomponuje zadanie, definiuje kontrakty, dispatchuje do specjalistów i recenzuje. Nie pisze kodu funkcji. Specjaliści pracują równolegle w rozłącznych pakietach.

---

## 12. Roster agentów

Każdy agent odpowiada za jeden pakiet lub jeden przekrojowy obszar. Mapowanie 1:1 do modułów z sekcji 6.

| # | Agent | Pakiet / obszar | Odpowiedzialność | Definition of Done |
|---|---|---|---|---|
| 1 | **Architekt / Orchestrator** | root, `docs/adr`, `ports` | Granice modułów, interfejsy portów, ADR, przegląd PR, dekompozycja zadań. | ADR zatwierdzony; kontrakty opublikowane; reguły CI aktualne. |
| 2 | **Core Domain** | `core` | Reguły walki, cyberware, ekonomia, reputacja, stan postaci, quest graph, model zapisu. Zero zależności silnikowych. | Testy jednostkowe zielone, wysokie pokrycie, brak `any`. |
| 3 | **Simulation / ECS** | `sim` | Świat ECS, rejestr i kolejność systemów, pętla gry, determinizm, RNG. | Testy integracyjne systemów i replay zielone. |
| 4 | **Rendering / NPR** | `engine/renderer`, `engine/npr` | Scena Babylon, synchronizacja z ECS, toon/outline/rim, grading. | Scena referencyjna renderuje; migawki stabilne; budżet draw calls dotrzymany. |
| 5 | **Physics & Controller** | `engine/physics`, `engine/camera` | Havok, character controller, kamera FPP/TPP z kolizją. | Przełączanie trybów płynne; brak przenikania kamery; testy kontraktu portu. |
| 6 | **Input** | `engine/input` | Mapowanie wejścia do `InputFrame`, remap, obsługa pada. | Kontrakt `InputPort` spełniony; testy mapowania. |
| 7 | **Narrative / Content** | `narrative` | Integracja ink, treść dialogów i questów, synchronizacja zmiennych z domeną, wątek Seki Senshi. | Quest M0 przechodzi przez ink do stanu domeny; zapis obejmuje narrację. |
| 8 | **UI / HUD** | `ui` | HUD, menu, ekwipunek, dialogi w React, store Zustand. | Komponenty czytają stan przez store/bus; brak importów z `engine`; testy komponentów. |
| 9 | **Audio** | `engine/audio` | Port audio, SFX diegetyczne, muzyka, miks. | Kontrakt `AudioPort` spełniony; cue odtwarzane na zdarzenia. |
| 10 | **Persistence** | `persistence` | Save/load, wersjonowanie schematu, migracje. | Round-trip zapisu, test migracji ze starej wersji, obsługa uszkodzonego pliku. |
| 11 | **AI / NPC** | `sim` (podobszar) | Drzewa zachowań, FSM, spawn i harmonogramy NPC. | Zachowania testowane na atrapie świata; deterministyczne pod ziarnem. |
| 12 | **Infra / Build** | root, `tools`, `app` | Vite, pnpm workspaces, pipeline assetów, CI, budżety wydajności, bundling. | Build zielony; bramki CI działają; pipeline assetów kompresuje glb/ktx2. |
| 13 | **QA / Test** | przekrojowo (test harness) | Strategia testów, E2E Playwright, harness replay, bramki pokrycia i wydajności, testy risk-based. | Pipeline testów w CI; smoke M0 zielony; raport pokrycia i perf publikowany. |

Agent #11 działa w `sim`, ale na rozłącznym podkatalogu `systems/ai` z własnym barrelem, żeby zachować nieprzecinające się własności z agentem #3.

---

## 13. Przepływ pracy i bramki CI

### Cykl zadania
1. Architekt definiuje lub aktualizuje kontrakt (interfejs/typ zdarzenia) i wpis ADR.
2. Specjaliści implementują po obu stronach kontraktu równolegle, każdy z testami.
3. QA uruchamia harness integracyjny i E2E.
4. Architekt recenzuje PR pod kątem granic, po czym merge.

### Bramki CI (blokujące merge)
- Typecheck (`tsc --noEmit`) we wszystkich pakietach.
- Lint, w tym zakaz `any` w `core`/`sim` i zakaz `Math.random`/`Date.now` w logice.
- dependency-cruiser: brak cykli, brak importów łamiących kierunek zależności.
- Vitest: testy zielone, pokrycie `core` nie spada poniżej progu.
- Playwright smoke na zbudowanej aplikacji.
- Perf-check na scenie referencyjnej: frame time i draw calls w budżecie.

### Artefakty
Raport pokrycia, raport wydajności, migawki NPR dołączane do PR. To daje mierzalne DoD i ślad audytowy zmian.

---

## 14. Mapa drogowa

### M0 — pionowy wycinek (fundament)
Jeden mały dystrykt. Gracz chodzi w FPP i TPP, jedno starcie bojowe, jeden NPC z dialogiem ink, jeden krok questa głównego, zapis i odczyt stanu, shader NPR na bohaterce i jednym NPC.
**Kryterium akceptacji:** pętla działa od wejścia gracza do zapisu, przechodząc przez wszystkie warstwy; wszystkie bramki CI zielone.

### M1 — pętla rdzenia
Głębia walki, cyberware i aktywne zdolności, ekwipunek, ekonomia, pętla zleceń fixera.
**Kryterium:** gracz wykonuje zlecenie, zdobywa eddies, kupuje i instaluje cyberware, zmiana wpływa na walkę.

### M2 — systemy sandboxa
World streaming i chunking, frakcje i reputacja, harmonogramy i AI NPC, kolejne dystrykty.
**Kryterium:** przemieszczanie między dystryktami bez przeładowania całości; NPC reagują na reputację.

### M3 — wątek główny
Pełne spięcie fabuły Seki Senshi: odzyskiwanie wspomnień, progresja diegetyczna, zakończenia zależne od wyborów.
**Kryterium:** wątek główny przechodzi od startu do zakończenia; stan narracji poprawnie w zapisach.

### M4 — skala treści i polish
Więcej zleceń i lokacji, dopracowanie NPR, optymalizacja wydajności, balans.
**Kryterium:** budżety wydajności dotrzymane przy docelowej gęstości sceny.

---

## 15. Rejestr ryzyk

| Ryzyko | Wpływ | Przeciwdziałanie |
|---|---|---|
| Pipeline NPR (toon + kontur) kosztowny i trudny do ustabilizowania | Wysoki | Dedykowany agent, tryb referencyjny, migawki, ograniczenie inverted-hull do bohaterów. |
| Wydajność open-world na web (draw calls, pamięć GPU) | Wysoki | Budżety w CI od M0, instancing, LOD, streaming, KTX2. |
| Integralność save/load i migracje | Wysoki | Priorytet testów, wersjonowanie schematu, testy uszkodzonego pliku. |
| Objętość treści sandboxa przerasta zespół | Wysoki | Hybryda: ręcznie pisany wątek główny plus systemowe i proceduralne wypełnienie zleceń. |
| Zakres rośnie ponad możliwości | Średni | Twardy fundament M0, iteracje na wycinku, jawne kryteria akceptacji milestone'ów. |
| Determinizm łamany przez niekontrolowane źródła losowości/czasu | Średni | Porty RNG i zegara, lint blokujący `Math.random`/`Date.now`. |
| Wybór WebGL2 vs WebGPU wpływa na wsparcie i wydajność | Średni | WebGL2 jako baza, WebGPU za flagą, decyzja po profilowaniu. |

---

## 16. ADR do podjęcia na starcie

1. Wybór silnika: Babylon.js (zatwierdzone).
2. ECS: miniplex vs bitecs.
3. Technika konturu NPR: inverted-hull vs post-process edge detection.
4. Cel renderowania: WebGL2 baseline vs WebGPU.
5. FSM questów/dialogów: XState vs automat ręczny.
6. Format i kompresja assetów: Draco vs meshopt, progi KTX2.
7. Budżety wydajności: wartości progowe po profilowaniu M0.

---

## 17. Następne kroki

1. Scaffold monorepo (pnpm workspaces, pakiety z sekcji 5, puste barrele).
2. Konfiguracja bramek CI (typecheck, lint, dependency-cruiser, Vitest, Playwright, perf-check).
3. Pierwsze ADR: ECS, technika konturu, cel renderowania.
4. Definicja portów w `core`/`sim` (render, input, audio, persistence, clock, random).
5. Szkielet M0: świat ECS z jednym systemem ruchu, adapter Babylon renderujący jedną scenę, kamera FPP/TPP, zapis round-trip.
6. Pierwszy plik `.ink` z jednym dialogiem NPC spiętym z jednym krokiem questa.
7. Preset NPR na bohaterce plus migawka referencyjna jako strażnik wyglądu.
