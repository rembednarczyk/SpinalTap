# ADR-0036: Engine fali 2: wagon metra, radio, zryw i odbicie, przebrania na modelach, progi mokrego asfaltu

## Kontekst
ADR-0032 dał engine pięć rzeczy z fali 2 (raport `docs/research/reports/Research mechanik gier cyberpunk.md`, sekcje „Metro”, „Radio”, „Mokry asfalt”): scenę wagonu, radio jako stacje sekwencera z ADR-0013 z głośnikiem pozycyjnym, efekty zrywu i odbicia, wygląd przebrań na modelach, progi mokrego asfaltu i przypisanie zrywu na padzie i dotyku. Ograniczenia: bez zmian w `core`, `sim` i `ui`, w `app` tylko podpięcie zdarzeń, budżety z `tools/perf-budgets.json`, reguła ADR-0031 (nowe funkcje jako części za fasadami `BabylonRenderer` i `SynthAudio`).

## Decyzja

### Wagon metra (`renderer/metro-plan.ts`, `renderer/metro-ride.ts`)
- `MetroRide` to nowa część za fasadą. `BabylonRenderer.setMetroRide(ride | null)` włącza ją na `MetroDeparted` i wyłącza na `MetroArrived` (`main.tsx` słucha szyny).
- Wagon stoi w tej samej scenie, 2,6 km na południe od miasta. Miasto jest wtedy za płaszczyzną dalekiego cięcia (`maxZ` 320), więc nie kosztuje wywołań. Osobna scena wymagałaby drugiego potoku NPR (toon, line art, grading) i zmian w pętli renderu w app.
- Wnętrze to jedna siatka z `MeshSink` w materiale `dressing` (kolor wierzchołka, flaga „świeci”), czyli jedno wywołanie na przebieg:
  - długie ławki pod oknami, słupki przy drzwiach, poręcze z uchwytami co 60 cm;
  - świetlówki pod sufitem, linie LED nad drzwiami, ekrany reklam z pasami koloru z `SIGN_COLORS`;
  - dwa światła punktowe pod sufitem, rejestrowane na czas jazdy. Dach rzuca cień księżyca (cień idzie za kamerą w wagonie), więc w środku świecą tylko świetlówki.
- Za oknami są trzy warstwy paralaksy, każda jako jedna siatka na obie strony toru:
  - bliska: filary estakady i neony, 6 m;
  - środkowa: bloki z oknami i szyldami, 26 m;
  - daleka: wieże na horyzoncie, 85 m.
  Wszystkie jadą do tyłu z prędkością pociągu (15 m/s). Paralaksa jest więc prawdziwa: dalsze warstwy same przesuwają się wolniej na ekranie. `parallaxOffset` zawija przesunięcie do okresu warstwy i centruje je, a trzy identyczne kopie warstwy pokrywają ±okres wokół wagonu, więc zawinięcia nie widać.
- Statyści: 2 do 4 z istniejących presetów (cywil, Tessen, Hebi, fixer), liczba wynika z trasy. Idą przez `CharacterViews` z ujemnymi id, więc dostają importowane modele, jeśli są. Dostają pusty loadout, bo nikt nie jedzie z bronią w ręku.
- Kamera siedzi na ławce i patrzy na okna naprzeciwko. `carSway` daje lekkie kołysanie: przechył poniżej 0,5°, drgnięcie na złączach szyn co 25 m i dryf boczny. Przy ograniczeniu błysków kołysanie znika.
- Deszcz i rozbryzgi stają na czas jazdy (`ScreenFx.setIndoor`). Sonda mokrego asfaltu się nie odświeża.
- Wagon powstaje przy pierwszej jeździe i zostaje wyłączony.
- Świat streamuje się dalej za sceną: symulacja i `flush()` dressingu działają jak zwykle.

### Radio (`audio/radio-stations.ts`, `audio/radio-speakers.ts`, `audio/radio.ts`)
- Trzy stacje to zestawy parametrów sekwencera z ADR-0013. Każda ma tempo, skalę, pętlę akordów, barwę warstw i wzór perkusji. Id są te same co w tekstach narracji (`radio.ink`):
  - `drift` (Neon Drift 88.1): synthwave w d-moll, 100 BPM, i–VI–VII–i na piłach, arpeggio szesnastkowe, werbel z bramkowanym ogonem;
  - `yoru` (Yoru FM 76.5): city pop w F-dur, 112 BPM, IVmaj7–iii7–vi7–V, akordy septymowe, slap bas, akordy pianina elektrycznego na słabych częściach, swing;
  - `tessen` (Tessen Info 24): spokojny podkład w C-dur, 84 BPM, dzwonek na akordach, tykający hi-hat, bez stopy. Lektor to formantowe sylaby (piła przez wąski filtr pasmowy, który wędruje jak głos) w frazach z oddechami i pauzą co czwarty takt.
- `SynthAudio.setRadioStation(id | null)` to własne radio gracza. Przy eksploracji zastępuje partyturę (warstwy wyciszone i bez planowania nut). W walce partytura wraca, a radio cichnie do 30%. Przełączenie stacji daje krótki szum strojenia.
- Głośniki diegetyczne: `radioSpeakers()` szuka w `WORLD_CHUNKS` neonów z etykietą lokalu (BAR, NEON KOI, PACHINKO, KARAOKE, SAKE, TAKO, RAMEN, DENKI) i stawia głośnik nad drzwiami. Lokal gra swoją stację. Bez własnego radia gracz słyszy najgłośniejszą stację z głośników: spadek z odległością i panorama jak w ADR-0013, pasmo 320 Hz do 3,8 kHz (mały głośnik), partytura ściszona proporcjonalnie.
- Radio idzie przez szynę `music`, więc dialog je wycisza jak muzykę. Bez wysyłek do echa i pogłosu, bo te wracają z pominięciem poziomu radia i ignorowałyby odległość.
- Gra jedna stacja naraz i tylko wtedy, gdy ją słychać. Ciche radio niczego nie planuje. Radio rusza dopiero z pejzażem dźwiękowym (`autoStart` lub `startAmbience`).

### Zryw i odbicie (`effects/trails.ts`, `effects/trail-meshes.ts`)
- `GameplayFxEvent` dostaje rodzaje `dash { entityId, at, air }` i `reflect { defenderId, attackerId, at }`. `main.tsx` tłumaczy na nie `Dashed` i `ProjectileReflected`.
- Zryw zostawia dwie świecące smugi (pierś w cyjanie, kolana w różu), których czoło przez 0,22 s idzie za postacią. Gasną po 0,42 s. Dla gracza dochodzi rozmycie radialne w post-processie zdarzeń (nowy uniform `blur`, w powietrzu mocniej, przy ograniczeniu błysków o połowę) i wybuch linii prędkości (`SpeedLines.pulse`). Rozmycie nie rozjaśnia kadru, więc nie bierze błysku z limitu.
- Odbicie daje iskrę na ostrzu i świetlny ślad od ostrza do piersi strzelca (0,2 s). Rozświetlenie ulicy jest jednym z trzech błysków na sekundę z `FlashLimiter` (ADR-0030), a przy ograniczeniu błysków nie ma go wcale. Ślad pokazuje się zawsze.
- Pula ma 8 belek i jest wyłączona, gdy nic nie leci.

### Przebrania na modelach (`renderer/character-skin.ts`, `renderer/loadout.ts`)
- Do dziś odcień z `setAppearance` (np. `jacket-tessen` munduru Tessen: granat `#2f4a6b` na ubraniu „Tops” modelu VRoid, do tego płyta kamizelki `vest-plate` na piersi) barwił tylko importowane modele. Proceduralna obsada (telefony, klatka referencyjna, `models=off`) zostawała w kolorach presetu i przebrania nie było widać.
- Scalone siatki postaci pamiętają teraz, z której części pochodzi każdy wierzchołek (`skinParts`). Loadout przemalowuje góry, kurtki i płaszcze odcieniem tułowia, a spodnie odcieniem nóg (`RIG_GARMENT_PRESETS`). Skóra, włosy, buty i cyberware zostają. Kurtka Seki i bojówki (odcień null) przywracają kolory presetu. Malowanie dzieje się tylko przy zmianie wyglądu.
- Kurtka Hebi (`jacket-hebi`) i mundur Tessen działają od razu. Ubranie personelu Tessen nie ma jeszcze klucza palety ani przedmiotu (propozycja niżej).

### Progi mokrego asfaltu (`npr/quality.ts`, `renderer/wet-probe.ts`, shader toon)
- `RenderQuality` dostaje `medium`. `QUALITY_TIERS` zbiera w jednym miejscu, co robi każdy próg: mapa cienia, line art, rozbryzgi, sonda, podgląd postaci na żywo.
  - `low`: maska kałuż i pasy odbić jak dziś;
  - `medium`: do tego statyczna sonda 128 px;
  - `high`: sonda 256 px.
- Sonda (`ReflectionProbe`) widzi niebo, dalekie miasto, szyldy i wszystko, co świeci w warstwie glow. Renderuje raz, spod ulicy na wysokości lustrzanego oka kamery (−1,7 m). Odświeża się przy wejściu do dystryktu i gdy zmieni się to, co odbija: wczytany chunk, zestaw miasta, pora dnia. Najwyżej raz na sekundę i nigdy w metrze (`ProbeSchedule`). Między odświeżeniami kosztuje zero wywołań.
- W shaderze toon pod definicją `ENV_REFLECT` (tylko asfalt, kałuże, woda i mokre wierzchołki dressingu, wkompilowane od startu) mokra pozioma powierzchnia dodaje odbicie z sondy w pięciu płaskich stopniach (cel). Odbicie jest najmocniejsze w kałużach (ta sama maska szumu co pasy) i przy patrzeniu pod kątem.
- **SSR na `high`: nie.** `SSRRenderingPipeline` w Babylon czyta odbijalność z bufora geometrii, a bufor zapisuje ją tylko z właściwości materiałów standard i PBR. Materiały toon to `ShaderMaterial`, więc droga dostałaby zerową odbijalność i nic by nie odbijała. Własny przebieg SSR potrzebowałby drugiego bufora geometrii z maską drogi albo zmiany potoku line art, do tego marszu promienia na pełnej rozdzielczości, czyli kosztu, którego SwiftShader w CI i laptopy nie uniosą w budżecie. Zostaje sonda. Planarne odbicie (`MirrorTexture`) jest możliwą kontynuacją dla jednej płaszczyzny drogi, ale renderuje scenę drugi raz w każdej klatce.
- App przyjmuje `?quality=medium`. Wpis w ustawieniach należy do UI.

### Wejście
- Pad: zryw to podwójne stuknięcie B w 0,3 s (`DoubleTap`). Wszystkie przyciski twarzy, bumpery, triggery i kliknięcia gałek są zajęte. B kuca przy przytrzymaniu, a podwójne stuknięcie kucania to unik z Cyberpunka 2077, który gracze znają. Przy przełączanym kucaniu dwa stuknięcia znoszą się, więc postawa się nie zmienia.
- Dotyk: `VirtualPad` ma przycisk `dash` (krawędź jak skok). UI dodaje przycisk w HUD pod nazwą akcji `dash`.

## Propozycje kontraktu
- `RenderPort.setMetroRide?(ride: { from: MetroStationId; to: MetroStationId; seconds: number } | null)`. App woła ją, jeśli istnieje, na `MetroDeparted` i `MetroArrived`.
- `AudioScenePort.setRadioStation?(id: RadioStationId | null)` i typ `RadioStationId = "drift" | "yoru" | "tessen"` w `core` (dziś w engine, eksportowany z `@seki/engine`). Stan stacji żyje w app (ADR-0032).
- `EffectDescriptor` dostaje `dash { entityId, at, air }` i `reflect { defenderId, attackerId, at }` (dziś `GameplayFxEvent`). Wtedy `bindEventPresenter` przekaże je przez `playEffect`, a `main.tsx` przestanie słuchać szyny, tak jak proponował ADR-0030.
- `PaletteKey` dostaje `uniform-staff` (szary uniform personelu, propozycja `#8a9099`), a `GarmentMeshId` dostaje `badge` (identyfikator na piersi) dla roli `tessen_staff`. Engine doda kolor do `GARMENT_TINT` i kształt do `ADD_ONS`.
- `GraphicsQuality` w UI dostaje `medium`.

## Konsekwencje
- Budżety: patrz tabela pomiarów w opisie zmiany i `$comment` w `tools/perf-budgets.json`. Sonda nie dodaje wywołań w zwykłej klatce, wagon żyje poza budżetem scen (miasto jest wtedy poza kadrem).
- Migawka NPR zmienia się świadomie: klatka referencyjna działa na `high`, więc mokry asfalt pod Neon Koi odbija teraz neon i niebo w stopniach.
- Złote hashe bez zmian (nic w `sim`).
