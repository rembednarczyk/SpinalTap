# ADR-0039: Dialog na kole

## Kontekst
Punkt „Dialog na kole” z ADR-0037. Gracz zgłosił, że lista przycisków pod napisami jest mało intuicyjna. Research (`docs/research/research_notes/Research mechanik gier cyberpunk/ux_hud.md`) mówi, jak robi to CP2077: złote opcje posuwają scenę, niebieskie dodają kontekst, ikony oznaczają opcje z historii postaci i hacki, kolor nigdy nie występuje sam. Na dotyku opcje mają być duże. Animacje krótkie, bez błysków, wyłączane przez „ogranicz błyski” i systemowe ograniczenie ruchu.

## Decyzja
- **Rodzaj opcji (`tone`).** `DialogueChoice` w `narrative` dostaje `tone`: `main`, `optional`, `leave`, `aggressive`, `persuade`, `hack`, `lifepath`.
  - Źródło to tag ink wewnątrz nawiasów opcji: `* [Biorę robotę. #tone:main]`. inkjs 2.4 przypisuje opcji tylko tagi z wnętrza nawiasów; tag za nawiasem trafia do linii wyjściowej.
  - Bez tagu albo z nieznanym tonem opcja jest `optional`.
  - Oznaczenia w treści: postępujące scenę i wybory fabularne to `main`, dopytania `optional`, pożegnania i odmowy kończące rozmowę `leave`, groźby, kradzież i przemoc `aggressive`, przekonywanie `persuade`, wejście w elektronikę `hack`, opcje zależne od wspomnień i wcześniejszych wyborów (`has_memory`, `choice_*`) `lifepath`.
  - Test `narrative/test/dialogue-tones.test.ts` pilnuje, że każda opcja w ink ma znany ton, a test ról czyta tekst opcji bez tagów.
- **Koło w UI** (`ui/src/dialogue`).
  - `wheel-layout.ts`: czyste dane. Kolejność slotów to opcje w kolejności ink, a opcje `leave` na końcu, więc wyjście jest zawsze na dole łuku. Zakończona rozmowa ma jeden slot „Zakończ rozmowę”.
  - Punkty łuku leżą na okręgu wokół piasty, krok slotu w pionie stały, promień rośnie z liczbą opcji. Jedna lub dwie opcje też tworzą łuk, bez pustych slotów.
  - `use-dialogue-wheel.ts`: stan podświetlenia i sterowanie. Cyfry 1-9 wybierają od razu, strzałki i kółko myszy przesuwają podświetlenie (z zawinięciem), E, Enter i Spacja wybierają podświetloną. Nad historią napisów kółko przewija historię.
  - `dialogue-wheel.tsx`: przyciski z ikoną, tekstem, klawiszem i ukrytą etykietą rodzaju dla czytników ekranu. Najechanie i fokus podświetlają, klik wybiera. Wybór idzie przez `click`, więc `swallowNextClick` dalej zjada kliknięcie-ducha po tapnięciu E.
  - `dialogue-log.tsx`: napisy na dole. Kontroler dialogu w app trzyma wcześniejsze linie rozmowy (`DialogueVm.history`, do 80 linii), UI pokazuje je przygaszone nad ostatnimi i przewija do najnowszej.
  - Style w `dialogue/dialogue.css`, poza `styles.css`. Warstwa skaluje się jak HUD (`--hud-scale`). Krok slotu to co najmniej 46 px na ekranie (pole dotyku ≥ 44 px) i nie więcej, niż mieści wysokość ekranu. Na ekranach do 500 px wysokości napisy idą do lewej dolnej części, a koło zajmuje prawą połowę od góry do dołu, więc się nie zasłaniają; skala HUD jest tam ograniczona do 110%.
  - Kolory: `--tone-*`, z wariantami dla palet daltonistów; agresja, perswazja, hack i przeszłość biorą tokeny HUD z ADR-0028.
  - Animacja wejścia: 180 ms przesunięcia i przezroczystości, kolejne sloty co 25 ms, bez błysków. Przy „ogranicz błyski” i `prefers-reduced-motion` bez animacji i przejść.
  - Reszta HUD przygasa do 35% na czas rozmowy.
- **Pad: propozycja.** App nie przekazuje dziś pada do UI: `BrowserInput` w `engine` czyta `navigator.getGamepads()` i mapuje go na `InputFrame` dla symulacji. Propozycja:
  - kontroler dialogu w app dostaje z pętli wejścia kierunek lewej gałki i zbocze A, gdy rozmowa jest otwarta, i zapisuje w sklepie UI `dialoguePoint: { angle } | null` oraz wywołuje wybór;
  - UI mapuje kąt na slot przez gotowe `slotAtAngle(arcLayout(n), angle)` (kąt 0 w prawo, dodatni w dół, null gdy gałka wskazuje w lewo, od koła);
  - A potwierdza podświetloną opcję, B nic nie robi, żeby nie przerywać sceny przypadkiem.
  - Wymaga zmiany granicy app i engine (port wejścia), więc idzie osobnym ADR-em.

## Konsekwencje
- Selektory e2e się nie zmieniają: opcje to dalej przyciski z tekstem opcji w nazwie dostępnej, w kolejności slotów. Pierwsza opcja w DOM to pierwsza opcja ink, chyba że ink stawia wyjście wyżej.
- Cyfra wybiera slot na kole, a nie indeks ink. Różnica jest tylko wtedy, gdy wyjście nie jest ostatnie w ink.
- Nowa opcja w ink powinna dostać `#tone:<rodzaj>` w nawiasach; brak tagu nie psuje gry, ale opcja będzie zwykłym pytaniem.
