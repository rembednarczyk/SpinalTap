# ADR-0027: Dressing wszystkich chunków, skórki gołych brył i dalekie miasto

## Kontekst
Audyt map (W9, W10, C1, C2, C5, C7, C8) pokazał, że świat wygląda kompletnie tylko z ulicy Shinsekai 7:
- proceduralny `createDressing` ubierał wyłącznie `DISTRICT_M0_PROPS`, więc bez `city-kit.glb` Kanałowa, targ i doki zostawały gołymi bryłami (W9), a pokład estakady był gładką płytą (C7);
- mury dystryktów, filary, ściany szybu windy, balkon i kiosk miały jednolity materiał presetu, a filary i ściany szybu dostawały nawet proceduralne okna budynków (C5);
- witryny z Neon Town to płaskie tafle jednej świecącej próbki (C1);
- `Atmosphere` stawiała panoramę 70 wież w pierścieniu 75–165 m wokół (0, 7), czyli w środku targu i doków: z targu i z estakady widać było prostokątne łaty okien bez bryły (C2);
- za ostatnim wczytanym chunkiem była tylko mgła (gęstość 0,021, przy 60 m prawie pełna) albo jednolita szara ściana (W10);
- nadbudówki dachów z city kitu stoją na dachach, po których się chodzi (drabiny targu, ADR-0021), i nie mają kolizji (C8).

Ograniczenia: bez zmian w `sim` i w treści (inni agenci dodają treść równolegle), budżety z `tools/perf-budgets.json` (targ był na 248 z 265 wywołań), migawka NPR, styl toon z `packages/engine/src/npr`.

## Decyzja
- **Dressing per chunk (`WorldDressing`, `dressing-plan.ts`).** Renderer przekazuje każdy blok i neon z `spawn` do `WorldDressing`, który grupuje je według chunku z `WORLD_CHUNKS` (po miejscu propa w tabeli, bo prostokąty chunków na siebie zachodzą; poza tabelą po położeniu). Dressing chunku to jedna siatka z kolorem per wierzchołek, budowana leniwie w `frame()`, gdy jego bloki wchodzą, i zwalniana, gdy ostatni wychodzi. Plan (`planDressing`) jest czystą funkcją bez stałych współrzędnych: budynek (wysoki, z głębokością pomieszczeń) dostaje gzymsy, cokół, witryny z roletami albo światłem, markizy, klimatyzatory, rurę, schody pożarowe, czasem automat i śmieci, neon-flagę w kolorach szyldów kitu; fasady zasłonięte sąsiednią bryłą zostają gołe. Kable nad ulicą idą tam, gdzie treść podaje `skin.street`. Na asfalcie leżą kałuże, na długich wąskich ulicach linia środkowa. Gdy kit się wczytał, budynki ze skórką zostają gołe (fasady daje kit); póki się wczytuje, dressing czeka.
- **Pokład drogowy (C7).** Płyta betonowa grubości 0,25–1,8 m, z dołem nad 2,5 m i obrysem co najmniej 6 × 20 m to pokład: asfalt (mokry), krawężniki, linie krawędziowe, przerywane pasy, podwójna żółta przy dwóch pasach, dylatacje z blachami co 12 m, bursztynowe światełka i ślady opon, a pod spodem dwa dźwigary i poprzecznice.
- **Flagi w alfie wierzchołka.** Preset `dressing` dostaje define `DRESS_FLAGS`: alfa 1 to zwykła farba, 0,5 mokra powierzchnia (połysk jak kałuża), 0 świecąca (neony, światełka, witryny). Dzięki temu dressing chunku to jedno wywołanie na przebieg (kolor, G-bufor) plus wspólny proxy cienia statycznego, zamiast trzech siatek w M0.
- **Skórki gołych brył (C5).** `blockPreset`: budynek (co najmniej 6 m wysokości, 3 m głębokości, poniżej 40 m długości) zostaje `concrete`/`glass`/`metal` z oknami; reszta to `concreteBare` (beton z szalunku: fugi, otwory po ściągach, zacieki, wilgotna stopa) albo `metalPanel` (blacha falista z fugami paneli, nitami i rdzą; na podłogach blacha ryflowana). Wzór liczy toon shader w przestrzeni świata (`CONCRETE_PANELS`, `METAL_PANELS`), schodkowo jak cel, i wygasza go z odległością. Kiosk dostaje `metalPanel`, dopóki jego skórka z kitu go nie zakryje.
- **Witryny (C1).** Próbki `shop-*` mają w teksturze kitu alfę 40 zamiast 0. Shader rozpoznaje je i rysuje w świetle witryny szprosy co 1,3 m, nadświetle i cokół, półki z towarem, rolety opuszczone do połowy na części przęseł i spadek jasności ku górze.
- **Dachy, po których się chodzi (C8).** `isWalkedRoof`: dach jest chodzony, gdy kończy się na nim albo z niego zaczyna drabina albo coś na nim stoi (balustrada, skrzynia). Renderer pyta o to `CityKit` przy budowie komórki (`walkedRoof`); `planSkin` wybiera wtedy tylko modele bez wysokich części nad dachem (`WALKED_ROOF_CLEARANCE` 1 m), a `addModel` pomija trójkąty nadbudówek (ponad dachem i dalej niż 0,6 m od krawędzi modelu). Attyki zostają. Proceduralny dressing nie stawia tam zbiorników ani anten. Plik `city-kit.glb` i `tools/city_kit.py` bez zmian.
- **Dalekie miasto (`FarCity`, W10 i C2).** Stara panorama znika z `Atmosphere`. Nowa składa się z czterech siatek:
  1. świat (stałe położenie): zastępcze bryły każdego chunku z `WORLD_CHUNKS` (budynki z oknami), widoczne tylko, gdy chunk nie jest wczytany (shader zwija je przez uniform `hidden[16]`, więc jedno wywołanie niezależnie od liczby chunków), wypełniacze w dziurach między dystryktami i trzy pierścienie wież wokół sumy granic chunków, coraz wyższych i rzadszych;
  2. horyzont (podąża za kamerą w poziomie): dziewięć megabudowli 160–300 m z uskokami i iglicą, 200–240 m od kamery, w zasięgu `maxZ`;
  3. i 4. światła obu warstw (addytywnie, bez zapisu głębi, więc poza G-buforem): holo-reklamy z animowanym wzorem (kolumny znaków, logo z pierścieniem, postać), neonowe pasy na narożnikach i migające światła przeszkodowe.
  Shader dalekiego miasta to płaskie sylwetki w stylu cel: ciemniejsze ku górze, podświetlone łuną przy ziemi, jaśniejszy bok, dachy łapiące łunę, okna całymi piętrami, a mgła ma skalę per kawałek (zastępcze bryły jak ulica, horyzont prawie bez mgły) z górnym limitem, żeby sylwetki zostawały. Animacja reklam stoi w klatce referencyjnej. Dzień przyciemnia okna i reklamy (ADR-0017).

## Konsekwencje
- Bez kitu (`?city=off`) każdy chunk ma fasady; z kitem dressing to pokład estakady, kałuże i budynki bez skórki.
- Reguły i kolejność systemów w `sim` bez zmian, złoty hash też.
- Migawka NPR zmienia się świadomie: w tle M0 stoją wieże i megabudowle z reklamami, mur ma blachę, a kałuże i pasy pochodzą z planu dressingu.
- Koszt: dressing chunku to 2 wywołania (kolor, G-bufor) i wierzchołki w proxy cienia; dalekie miasto 6 wywołań (2 × 2 bryły, 2 światła) w miejsce 2 starej panoramy. Liczby przed i po są w opisie budżetów w `tools/perf-budgets.json`.
- Nowa treść (dystrykt, myjnia, sprzedawcy) dostaje dressing i zastępczą bryłę bez zmian w rendererze. Więcej niż 16 chunków wymaga podniesienia `FAR_CHUNK_SLOTS`.
- Na później: kable i szyldy dressingu z atlasu napisów kitu, low-poly Kenneya jako zastępcze bryły zamiast pudeł, bariery typu New Jersey na pokładzie z kolizją po stronie `sim`.
