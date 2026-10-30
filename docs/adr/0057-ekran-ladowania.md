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
  4. Kompilacja shaderów wszystkich materiałów sceny i podglądu postaci: `scene.whenReadyAsync` i rozgrzewające klatki poza ekranem, odmierzane przez `GpuPacer` z G-029.
- **Zakres.** Ekran ładuje to, czego potrzeba na start, i wszystko, co jest wspólne dla całego miasta: modele, materiały i shadery. Pozostałe chunki miasta dalej strumieniują się w trakcie gry, w tle i bez blokowania. Ładowanie całego miasta naraz wydłużyłoby start i zajęło pamięć, której telefon nie ma (budżety ADR-0036). Pełne doładowanie można włączyć później jako opcję ustawień.
- **Ekran tytułowy** nie rysuje pełnego miasta w tle (zob. G-029). Jego tło może być statyczne albo uproszczone, a koszt przenosi się na ekran ładowania, gdzie jest widoczny i zmierzony.
- **Postęp jest monotoniczny.** Etap bez pracy, np. przy `?models=off`, kończy się od razu. Błąd pobrania modelu nie blokuje startu: gra przechodzi wtedy na model proceduralny, jak dziś.
- **Bez zmian:** symulacja, zapis gry i złote hashe. Tryb `?reference` z G-001 korzysta z tego samego `prepare`, zamiast osobnego warunku.

## Konsekwencje
- Kliknięcie „New Game” wraca od razu, bo ekran ładowania pokazuje się w pierwszej klatce, a praca idzie asynchronicznie. Testy e2e czekają na koniec ekranu ładowania, a nie na samo kliknięcie.
- Pierwsze minuty gry mają mniej szarpnięć, bo nie ma pierwszego użycia shaderów i ubierania na oczach gracza.
- Start trwa dłużej o czas, który dotąd rozkładał się na grę. Mierzy go e2e w raporcie, a budżet czasu startu ustalamy z pomiaru.
