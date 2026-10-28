# ADR-0030: Wizualia fali 1: paleta dystryktów, szyldy i holoreklamy, post-process zdarzeń, skaner

## Kontekst
ADR-0028 przydzielił engine cztery rzeczy z researchu (`docs/research/reports/Research mechanik gier cyberpunk.md`, sekcja „Wizualia”): paletę i LUT na dystrykt jako dane, atlas szyldów i holoreklam, jeden post-process zdarzeń sterowany uniformami z rozgrzaniem shaderów i widok skanera. Do tego wymagania dostępności: opcja „ogranicz błyski i glitch” i najwyżej 3 błyski na sekundę w każdym trybie.

Na start był błąd z ADR-0027: na estakadzie i na targu u góry kadru wisiała ciemna tarcza. Sfera nieba szła przez to samo `decorate()` co stożki światła i odbicia, a ono zamraża macierz świata. Zamrożona macierz wyłącza `infiniteDistance`, więc kopuła (promień 300 m) została tam, gdzie kamera była przy starcie. Sto metrów dalej jej przeciwna strona wychodziła za płaszczyznę dalekiego cięcia (`maxZ` 320) i przez dziurę było widać kolor czyszczenia.

Ograniczenia: bez zmian w `core` i `sim` (symulację fali 1 kończy równolegle inny agent), w `app` tylko przekazanie zdarzeń i stanu skanera, budżety z `tools/perf-budgets.json` (targ był na 304 z 315 wywołań i 123 ze 126 aktywnych siatek).

## Decyzja
- **Niebo.** Kopuła nieba nie jest zamrażana (`decorate(mesh, freeze)`), więc `infiniteDistance` trzyma ją na kamerze. Test sprawdza, że środek kopuły idzie za kamerą i że jej promień mieści się w `maxZ`.
- **Color script dystryktu jako dane (`npr/district-palette.ts`).** `DISTRICT_PALETTES` daje każdemu dystryktowi nocną mgłę, ambient, kolor rimu z wagą, nasycenie i tony cieni i świateł w jednostkach `ColorCurves`:
  - Shinsekai 7: różowo-fioletowa mgła, różowy rim, cienie fioletowe, światła różowe;
  - Kanałowa: dawna morska zieleń kanału, cyjanowy rim;
  - targ: bursztynowo-czerwona mgła, bursztynowy rim, cienie czerwone, światła bursztynowe;
  - Doki: zimny błękit mgły i cieni, sodowy pomarańcz w rimie i światłach, najmniejsze nasycenie.

  Renderer sam ustala dystrykt z położenia kamery i granic chunków z `WORLD_CHUNKS` (ta sama reguła co `districtAt` w symulacji: przy nakładających się granicach wygrywa późniejszy chunk), więc app nic nie przekazuje. `PaletteBlend` przechodzi do nowej palety przez 2,5 s z wygładzeniem, a zawrócenie w połowie zaczyna od tego, co jest na ekranie. Nowa gra i wczytanie przeskakują od razu. Paleta trafia do `ColorCurves` w `Grading` (LUT jako krzywe, bez tekstury), do mgły i ambientu toon przez `rigWithPalette` (noc z palety, dzień z `DAY_RIG`), do nieba, dalekiego miasta i szyldów. Rim: nowy uniform toon `rimTint` (rgb i waga) miesza kolor dystryktu z rimem presetu.
- **Szyldy i holoreklamy (`renderer/signage*.ts`).** Plan (`planSignage`, czysta funkcja z tabeli chunków, bez stałych współrzędnych) stawia na frontach budynków szyldy-flagi na narożnikach i tablice nad witrynami (tablice tylko na budynkach bez skórki kitu, bo kit ma własne), do trzech holoreklam na najwyższych frontach każdego chunku i pod każdym szyldem przy ulicy pas odbicia neonu na mokrym asfalcie. Szyldy omijają neony z treści. Napisy pochodzą z jednego atlasu 1024×1024 (osiem flag 1:4 i osiem tablic 4:1, białe litery i pseudoznaki na czarnym), barwionych kolorem wierzchołka. Całe miasto to jedna siatka i jeden `ShaderMaterial` (addytywnie, bez zapisu głębi, poza G-buforem, cieniem i glow), czyli jedno wywołanie. Shader:
  - szyld: atlas i lekki szum jasności;
  - holoreklama: wzór proceduralny (kolumny znaków, logo z pierścieniem, postać), fresnel (z boku rama jaśnieje, środek blednie), scanlines, rzadkie zaniki i przesunięcie pasów (glitch);
  - odbicie: pasy jak w `Atmosphere` przemnożone przez maskę kałuż (szum wartości po ziemi).
  Thin instances nie były potrzebne: zapieczona siatka kosztuje tyle samo wywołań i zostaje deterministyczna.
- **Mokry asfalt.** Istniejące odbicia lamp i neonów w `Atmosphere` dostają tę samą maskę kałuż (pozycja świata w shaderze pasa). Tanio, na wszystkich urządzeniach.
- **Post-process zdarzeń (`effects/gameplay-fx.ts`, `effects/gameplay-post.ts`).** Jeden przebieg po potoku gradingu z uniformami: aberracja chromatyczna, przesunięte pasy (glitch), skaner (odbarwienie, scanlines, winieta), czerwono-niebieska łuna na krawędziach przy heat i czerwień od krawędzi po trafieniu. Logika obwiedni to czysty `GameplayFxState`:
  - trafienie gracza: siła z obrażeń, aberracja, mały glitch, czerwień;
  - `QuickhackStarted` i `QuickhackApplied`: impuls glitchu i aberracji, mocniejszy przy trafieniu hacka;
  - skaner: płynne wejście i wyjście;
  - heat: siła z poziomu (połowa przy poszukiwaniu), puls czerwony–niebieski najwyżej raz na sekundę.
  Gdy nic się nie dzieje, przebieg jest odpięty od kamery (zero kosztu, klatka referencyjna bez zmian). Shader kompiluje się przy tworzeniu, shader szyldów przez `forceCompilation` w `warmUpMaterials`, więc pierwsze trafienie nie zacina klatki.
- **Błyski (`effects/flash-limiter.ts`).** Jeden `FlashLimiter` renderera liczy początki błysków w przesuwanym oknie 1 s i wpuszcza najwyżej trzy. Pytają go trafienia, hacki, glitch pamięci i puls leczenia w `Grading` oraz światło wystrzału na całą ulicę. Puls heat rezerwuje swój jeden błysk na sekundę. Gdy okno jest pełne, efekt trzyma to, co jest na ekranie, zamiast błysnąć znowu. Wahanie glitcha pamięci zwolniło z około 9,5 do 2,5 cyklu na sekundę.
- **`RenderPort.setReduceFlashes(on)`.** Wyłącza aberrację i glitch (post-process, glitch pamięci, holoreklamy), zaniki reklam dalekiego miasta, migotanie neonów HOTEL i KUSURI, rozjaśnienie przy glitchu i światło wystrzału. Czerwień po trafieniu narasta łagodnie, kolory heat tylko powoli dryfują przy stałej jasności, scanlines skanera stoją.
- **Skaner (`renderer/scan-highlight.ts`).** Przy przytrzymanym skanerze postacie dostają kontur w kolorze rodzaju: wrogowie czerwony, cywile i NPC cyjanowy. Rodzaj pochodzi z `ViewDescriptor` przy `spawn`. Cel w fokusie (`ScanFocusChanged`) dostaje szerszy kontur i delikatne wypełnienie (`renderOverlay`). Kamery i urządzenia (`kind` camera lub device) są żółte, nawet bez własnego konturu. Kontur postaci już istnieje (odwrócona powłoka), więc barwienie nic nie kosztuje. Wypełnienie to jedno dodatkowe wywołanie na siatkę celu, tylko w trakcie skanowania.
- **App.** `main.tsx` słucha na szynie `DamageDealt` z celem w graczu, `QuickhackStarted`, `QuickhackApplied`, `HeatChanged` i `ScanFocusChanged` i woła metody renderera. Stan skanera (`scanning` ze store) przekazuje w pętli renderu. `applyEffects` wołał już `setReduceFlashes`, gdy renderer ją ma.

## Propozycje kontraktu
- `EffectDescriptor` w `core` dostaje rodzaje `player-hurt { amount }`, `quickhack { phase }` i `heat { level, searching }` (dziś `GameplayFxEvent` w engine). Wtedy `bindEventPresenter` przekazuje je przez `playEffect` jak resztę efektów, a `main.tsx` nie słucha szyny.
- `RenderPort.setScanning?(on)` i `RenderPort.setScanFocus?(id, kind?)` jako opcjonalne metody, jak `setReduceFlashes`.
- Dystrykt renderer liczy sam z kamery. Jeśli kiedyś dystrykt ma zależeć od czegoś innego niż położenie (wnętrza, metro), opcjonalne `RenderPort.setDistrict?(id)` nadpisze wynik z kamery.

## Konsekwencje
- Budżety: szyldy to jedna siatka zawsze aktywna (+1 wywołanie, +1 aktywna siatka), post-process tylko gdy coś pokazuje. Pomiary w raporcie zmiany i w `tools/perf-budgets.json`.
- Migawka NPR zmienia się świadomie: Shinsekai 7 jest różowo-fioletowe (mgła, rim, krzywe), na kałużach pod neonem widać maskę.
- Reguły symulacji i złote hashe bez zmian.
