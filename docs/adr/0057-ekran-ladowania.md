# ADR-0057: Ekran ładowania z paskiem postępu przy nowej grze i wczytaniu

## Kontekst
Dziś po kliknięciu „New Game” gra od razu przechodzi do rozgrywki. Wiele rzeczy ładuje się dopiero w jej trakcie:
- modele postaci z `models/manifest.json` i ich tekstury VRoid;
- broń;
- city kit;
- chunki miasta wokół gracza;
- shadery kompilowane przy pierwszym użyciu materiału.

Każde z tych ładowań blokuje klatki albo wątek strony. Gracz widzi przez to szarpanie i postacie ubierane na jego oczach. Na CI ten sam koszt dawał zawieszone kliknięcie (G-029). Użytkownik zaproponował, żeby nowa gra przy okazji doładowała grę z paskiem postępu.

## Decyzja
- **Ekran ładowania.**
  - Nowa gra i wczytanie zapisu przechodzą przez nowy ekran `loading` (`Screen` w UI) z paskiem postępu i nazwą bieżącego etapu.
  - Symulacja jest w tym czasie zamrożona.
  - Gra startuje dopiero, gdy wszystkie etapy się skończą.
- **Kontrakt w `RenderPort`:** opcjonalna metoda `prepare(at: Vec3, onProgress: (done: number, label: PrepareStage) => void): Promise<void>`. `PrepareStage` to stała lista etapów, którą UI tłumaczy (ADR-0056).
- **Etapy i ich waga w pasku:**
  1. Modele postaci z manifestu i broń. Pobieranie i parsowanie, bez ubierania.
  2. City kit.
  3. Chunki w promieniu startowym wokół `at` i ustalenie miasta (`citySettled`).
  4. Kompilacja shaderów wszystkich materiałów sceny: `scene.whenReadyAsync` i rozgrzewające klatki poza ekranem, odmierzane przez `GpuPacer` z G-029. Shadery podglądu postaci są w etapie 2 wdrożenia.
- **Zakres.** Ekran ładuje to, czego potrzeba na start, i wszystko, co jest wspólne dla całego miasta: modele, materiały i shadery. Pozostałe chunki miasta dalej strumieniują się w trakcie gry, w tle i bez blokowania. Ładowanie całego miasta naraz wydłużyłoby start i zajęło pamięć, której telefon nie ma (budżety ADR-0036). Pełne doładowanie można włączyć później jako opcję ustawień.
- **Ekran tytułowy bez pełnego miasta w tle** (zob. G-029) jest w etapie 2 wdrożenia.
- **Postęp jest monotoniczny.** Etap bez pracy, np. przy `?models=off`, kończy się od razu. Błąd pobrania modelu nie blokuje startu: gra przechodzi wtedy na model proceduralny, jak dziś. Pobranie bez odpowiedzi też go nie blokuje: po limicie etap idzie dalej jak po błędzie.
- **Bez zmian:** symulacja, zapis gry i złote hashe. Tryb `?reference` z G-001 korzysta z tego samego `prepare`, zamiast osobnego warunku.

## Konsekwencje
- Ładowanie modeli, city kitu, miasta i shaderów idzie za ekranem ładowania, który przeglądarka maluje przed pierwszą ciężką klatką. Testy e2e czekają na koniec ekranu ładowania, a nie na samo kliknięcie.
- **Znane ograniczenie:** samo kliknięcie „New Game” nie wraca od razu. `newGame` buduje symulację synchronicznie, więc strona stoi przed pokazaniem ekranu ładowania: 0,2–0,3 s pod SwiftShaderem przy load 5, 2–5 s w e2e pod obciążeniem (load ok. 15). Przeniesienie `newGame` za pierwszą klatkę ekranu ładowania zmienia kolejność w sesji i jest w etapie 2.
- Pierwsze minuty gry mają mniej szarpnięć, bo nie ma pierwszego użycia shaderów i ubierania na oczach gracza.
- Start trwa dłużej o czas, który dotąd rozkładał się na grę. Mierzy go e2e w raporcie, a budżet czasu startu ustalamy z pomiaru.

## Wdrożenie
- **Kontrakt** (zgoda orkiestratora, 31.10): `RenderPort.prepare?(at, onProgress)` oraz `PrepareStage` ze stałą listą `PREPARE_STAGES` w `packages/core/src/ports/render-port.ts`. Port bez `prepare` (fałszywe porty testów, renderer bez tej metody) startuje grę od razu, jak dotąd.
- **Etapy w kolejności, z wagą w pasku:**
  1. `models` (0,3): manifest modeli, potem każdy plik postaci i broni wczytany do kontenera, bez ubierania. Plik z błędem liczy się jako skończony, a postać zostaje proceduralna.
  2. `cityKit` (0,2): city kit i rekwizyty fasad (ADR-0058), wczytane albo odrzucone.
  3. `city` (0,3): miasto wokół kamery, która stoi przy graczu w `at`. Etap trwa, aż `citySettled` utrzyma się przez dwie kolejne klatki.
  4. `shaders` (0,2): `scene.whenReadyAsync`, potem rozgrzewające klatki pod ekranem ładowania. Każda klatka rysuje się tylko wtedy, gdy pozwala na to `GpuPacer` (G-029). Etap kończy się, gdy scena zostaje gotowa po narysowanej klatce.
- **App.** Ekran `loading` prowadzi `LoadingController`. Postęp jest monotoniczny. Symulacja stoi, bo krokuje tylko na ekranie `playing`. Nowy start w trakcie ładowania, np. szybkie wczytanie, unieważnia poprzedni.
- **Rysowanie.** Na ekranie `loading` pętla gry aktualizuje scenę, ale jej nie rysuje: klatki rysuje sam etap `shaders`. Tryb `?reference` rysuje klatkę wzorcową dopiero po końcu ładowania.
- **Limit pobrań.** Etapy `models` i `cityKit` czekają na pliki najwyżej `MAX_FILE_FRAMES` (1800) klatek renderera, potem idą dalej jak po błędzie. Pliki ładują się dalej i pojawiają się w grze, gdy dotrą. Limit liczy klatki, nie czas ścienny, jak pozostałe etapy (`MAX_STAGE_FRAMES`, 900), więc testy są deterministyczne.
- **Powrót do tytułu.** `RenderPort.cancelPrepare?()` (opcjonalna, obok `prepare`) kończy przygotowanie w toku: renderer nie rysuje już klatek rozgrzewki pod ekranem tytułowym. `LoadingController.cancel` woła ją tylko wtedy, gdy start jest w toku.
- **Pointer lock.** Po wyjściu z `loading` do `playing` bez gestu gracza blokada czeka na następne kliknięcie, bo prośba bez gestu jest odrzucana na stałe (`BrowserInput.lockUnavailable`). W pozostałych przypadkach, np. po zamknięciu panelu klawiszem Esc, blokada wraca od razu (`packages/app/src/pointer-focus.ts`).

## Etap 2 (odłożony)
Nie ma go w kodzie etapu 1. Każdy punkt wymaga osobnego pomiaru i osobnej zmiany:
- ekran tytułowy bez pełnego miasta w tle (G-029): tło statyczne albo uproszczone, a koszt na ekranie ładowania;
- shadery podglądu postaci (`PreviewStage`) w etapie `shaders`;
- `newGame` i wczytanie zapisu za pierwszą klatką ekranu ładowania, żeby kliknięcie wracało od razu.
