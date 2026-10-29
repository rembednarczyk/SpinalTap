# ADR-0043: Pryzmaty wypukłe i teren w symulacji

## Kontekst
ADR-0042 przenosi świat na dane mapowe: budynki z obrysów OSM (dowolne wielokąty, obrócone względem osi) i teren z modelu wysokości. Symulacja znała tylko prostopadłościany wyrównane do osi (AABB, z pochyłym wierzchem dla schodów i ramp, ADR-0020) i płaską ulicę y = 0. Ten ADR przygotowuje `packages/sim` na nową treść, zanim treść się przeniesie. Warunki: determinizm, złote hashe bez zmian (`181fbc08`, `74312929`), zapis bez zmian, koszt kroku poniżej 1 ms przy około 300 pryzmatach w zasięgu. W trakcie prac importer przeszedł z EU-DEM 25 m na NMT 1 m z lidaru (GUGiK), więc siatki będą gęste (komórka 1 do 4 m) i lokalnie strome (skarpa pod Zamkiem, Grodzka, schody terenowe przy murach).

## Decyzja

### Format pryzmatu
- **Treść** (`StaticProp.prisms?: PrismDef[]`): każda część to wypukły wielokąt `points` w płaszczyźnie XZ, **względem `center` propa** (ta sama konwencja co obrys widoku `building`), i wysokości `bottom`, `top` **względem `center.y`**. Kolejność narożników dowolna (normalizowana do przeciwnej do ruchu wskazówek zegara na mapie: x na wschód, z na północ); powtórzone i współliniowe narożniki odpadają. Wielokąt wklęsły albo bez pola to błąd treści (`makePrism` rzuca), bo rozkład na części wypukłe robi importer.
- Skrót: solidny prop z widokiem `building` bez `prisms` i z wypukłym obrysem dostaje jeden pryzmat od `center.y` do `height`. Obrys wklęsły bez części kończy się błędem z położeniem budynku.
- **Encja**: `solid` zostaje i jest prostopadłościanem otaczającym wszystkie części (broad phase), a nowy komponent `prisms: Prism[]` trzyma kształt w **współrzędnych świata**, z policzonymi raz normalnymi krawędzi i ich przesunięciami. Jeden budynek to jedna encja, jeden widok i jeden identyfikator, także gdy ma kilka części (L z dwóch pryzmatów).
- Pryzmaty są statyczne. Windy, bramki i drzwi zostają prostopadłościanami.
- **Warstwa kolizji** (`world/solids.ts`): `Collider` to albo prostopadłościan encji (z pochyłością), albo jedna część pryzmatu, zawsze z prostopadłościanem do odrzucenia. Ścieżka prostopadłościanu to dotychczasowy kod krok w krok, więc świat bez pryzmatów liczy się tak samo.
- **Geometria** (`world/prism.ts`): odległość ze znakiem od prostych krawędzi (szybki test wnętrza), najbliższy punkt brzegu, wypychanie koła (środek na zewnątrz: od najbliższego punktu; w środku: przez najbliższą ścianę), promień przez pryzmat metodą Cyrusa-Becka ze slabem podłogi i dachu.
- Koło postaci ślizga się po ścianie pod dowolnym kątem, bo wypchnięcie idzie wzdłuż normalnej ściany, a składowa styczna ruchu zostaje. Stanie na dachu, sufit nad skokiem, podciąganie na krawędź (ADR-0021) i skok na niski pryzmat działają przez te same funkcje co dla prostopadłościanów.

### Teren
- `ChunkDef.terrain?: TerrainGrid` (typ i `terrainHeightAt` z `core`, ADR-0042). Bez terenu grunt chunka to y = 0 jak dotąd.
- **`GroundField`** (`world/ground.ts`) buduje się raz z tablicy chunków w `WorldStreamer` i jest przypięty do świata ECS (`bindGround`, `groundOf`), bo promienie i sterowanie dostają tylko świat. To treść, nie stan: nie trafia do zapisu.
- **Wysokość gruntu** w punkcie: teren pierwszego w kolejności tabeli chunka, którego prostokąt zawiera punkt (jak `chunkAt`), albo 0 w chunku bez terenu. Poza wszystkimi chunkami: grunt najbliższego chunka (siatka przycięta do krawędzi). Zapytanie to jeden kubełek stałej siatki 64 m z listą kandydatów i jedna interpolacja dwuliniowa, bez alokacji.
- **Granice chunków**: sąsiednie chunki muszą dawać te same wysokości tam, gdzie ich prostokąty się stykają albo nakładają. Importer zapewnia to, tnąc jedną siatkę na chunki ze wspólnym wierszem albo kolumną punktów. `terrainSeamGap(a, b)` mierzy największą różnicę na wspólnym pasie (do testów treści). Wtedy przejście postaci przez granicę nie zmienia wysokości skokowo (test: różnica między krokami poniżej 1 cm).
- **Ruch**: `groundAt` zaczyna od wysokości terenu zamiast 0 i bierze najwyższy wierzch bryły w zasięgu kroku, więc wchodzenie i schodzenie po zboczu to dotychczasowe `STEP_HEIGHT` i `SNAP_DOWN`, bez skoku. Grawitacja, lądowanie i obrażenia od upadku liczą się od terenu.
- **Nachylenie**: gradient z różnic centralnych na odcinku 0,5 m (±0,25 m), czyli wygładzona normalna; drobne nierówności siatki 1 m nie robią drgań (test: garb 5 cm na siatce 1 m nie jest stromy). Próg `MAX_WALK_SLOPE` = tg 35°.
- **Skarpa jak ściana** (`offTheBank`): krok, który wchodzi pod górę na grunt stromszy niż próg, a stopy są na tym gruncie, traci składową pod górę i postać ślizga się po poziomicy; gdy i to wspina się stromo, stoi. Stopy w powietrzu nad terenem (skok, dach) nie są blokowane. Schodzenie po stromym zboczu jest dozwolone (do `SNAP_DOWN` na krok idzie po gruncie, dalej to upadek).
- **Promienie przez teren** (linia wzroku, pociski, hitscan, skaner, wręcz): DDA po komórkach siatki. Wewnątrz jednej komórki wysokość dwuliniowa wzdłuż prostej to funkcja kwadratowa, dopasowana dokładnie z trzech próbek, więc pierwszy punkt pod gruntem wychodzi z pierwiastka, a grzbietu nie da się przeskoczyć przy żadnej gęstości siatki (test: grzbiet szerokości jednego punktu na siatce 2 m, promień 2 cm pod szczytem). Szybkie odrzucenie: promień w całości ponad najwyższym punktem terenu. Ulica y = 0 dalej nie zatrzymuje promieni, jak dotąd.
- **Piętra AI**: wysokość punktu liczy się od gruntu pod nim (`aboveGround`, `heightApart`), więc dwie postacie na jednym zboczu są na tym samym piętrze, a 20 m różnicy wysokości na wzgórzu nie wysyła gangera do grafu poziomów. Bez terenu to zwykła różnica y, jak dotąd.
- **Pole odległości AI** (ADR-0025): piętro 0 to „na gruncie”. Komórka mierzy się od terenu pod swoim środkiem, komórka na skarpie stromszej niż próg jest zamknięta (najpierw tani test różnic na rastrze, potem ten sam test nachylenia co w ruchu), pryzmaty zamykają komórki, których dotyka ciało z marginesem, tak jak prostopadłościany. Test prostej drogi na wysokości kolan pomija sam teren (linia przechodzi pod każdym grzbietem) i zamiast tego sprawdza, czy po drodze nie ma skarpy.
- **Rozmieszczanie**: postać ze streamingu (`settle` w `spawnActors`) jest podnoszona na teren, gdy stoi pod nim, i wypychana ze ścian pryzmatów. Prostopadłościany zostają nietknięte (dotychczasowa treść stawia ludzi przy ladach celowo), świat bez terenu i pryzmatów dostaje ten sam obiekt pozycji. Resztę (tłum, przechodnie, posiłki) poprawia pierwszy krok ruchu.

### Siatka przestrzenna brył
- `SolidIndex` (`world/solid-index.ts`): jednolita siatka 16 m nad bryłami statycznymi, przebudowywana leniwie, gdy bryła wchodzi albo wychodzi ze świata (streaming). Bryły kinematyczne (windy, bramki, drzwi przesuwne) idą zawsze.
- Ruch: każda postać dostaje kolidery z prostokąta swojego kroku powiększonego o promień i 3 m, w kolejności tworzenia (tej samej co pełny przegląd). Gdy wypchnięcie wyniesie ją poza zasięg zebranych koliderów, krok liczy się jeszcze raz z pełną listą, więc wynik zawsze równa się pełnemu przeglądowi.
- Promienie i raster AI biorą bryły z prostokąta odcinka albo okna. Najbliższe trafienie, raster i podpis zbioru brył nie zależą od kolejności.
- Złote hashe po tej zmianie: `181fbc08` i `74312929`, bez zmian.

### Kontrakty
- `core` bez zmian: `TerrainGrid`, `terrainHeightAt`, `GroundPoint` i widok `building` z ADR-0042 wystarczyły.
- `sim`: `StaticProp.prisms`, `ChunkDef.terrain`, komponent `Entity.prisms`, `SimulationOptions.chunks` (mały świat testów i narzędzi), eksport `GroundField`, `groundOf`, `bindGround`, `heightApart`, `aboveGround`, `terrainSeamGap`, `MAX_WALK_SLOPE`, `makePrism`, `prismsAt`, `rayGeometry`, `clearSpot`. `lineOfSight` dostaje opcjonalny parametr `terrain` (domyślnie `true`). `groundAt` w ruchu bierze teraz kolidery i grunt.
- Przykład treści:

```ts
const chunk: ChunkDef = {
  id: "krakowskie-1", district: "shinsekai-7",
  bounds: { minX: 0, maxX: 200, minZ: 0, maxZ: 200 },
  terrain: { originX: 0, originZ: 0, cell: 2, cols: 101, rows: 101, heights },
  props: [{
    center: { x: 40, y: 3.2, z: 60 }, // y: najniższy teren pod obrysem
    view: { kind: "building", outline, height: 14, levels: 4, use: "residential", look: 7 },
    solid: true,
    prisms: [
      { points: [{ x: -10, z: -6 }, { x: 10, z: -6 }, { x: 10, z: 0 }, { x: -10, z: 0 }], bottom: 0, top: 14 },
      { points: [{ x: -10, z: 0 }, { x: -4, z: 0 }, { x: -4, z: 14 }, { x: -10, z: 14 }], bottom: 0, top: 14 },
    ],
  }],
  actors: [],
};
```

## Konsekwencje
- Testy w `sim`: geometria (`prism.test.ts`), grunt, szwy, wygładzone nachylenie, promienie DDA i raster (`ground.test.ts`), scenariusze na świecie testowym z dwóch chunków z terenem (`terrain-sim.test.ts`: zbocze 20 m na 200 m na siatce 2 m i 10 m, przejście przez granicę chunków, skarpa 63° z poślizgiem, skok i lądowanie na terenie, skok na niski pryzmat, poślizg po budynku obróconym o 17°, ganger goni gracza wokół L z dwóch pryzmatów, pocisk na ścianie pryzmatu i na grzbiecie wzgórza, dwa przebiegi z tym samym hashem) i pomiar (`prism-perf.test.ts`).
- Koszt: 300 pryzmatów (czworokąty i sześciokąty, obrócone) na terenie z siatką 2 m, gracz, 10 zaalarmowanych gangerów: mediana 0,51 do 0,54 ms na krok przy obciążonej maszynie (4 rdzenie, load average 9); bez siatki przestrzennej było 0,9 ms. Test pada dopiero powyżej 4 ms, żeby obciążony CI nie migał. Ulica obecnej treści kosztuje tyle co przed zmianą (0,39 wobec 0,41 ms na krok w tym samym pomiarze).
- Nowy raster AI na terenie kosztuje więcej (wysokość w każdej z 25 600 komórek, nachylenie tylko tam, gdzie tani test coś widzi), ale jest pamiętany jak dotąd.
- Nie zrobione, na etap treści: przeniesienie świata (WORLD_CHUNKS), cele tłumu i przechodniów z y z terenu (trasy dalej mają y = 0, ruch je podnosi), węzły grafu poziomów na terenie, kamera TPP (kolizja kamery jest w `engine`, ma tam użyć `rayGeometry` albo własnej kopii), zjeżdżanie po stromym zboczu, wspinanie się po skarpie serią skoków nie jest blokowane osobno (jak skok na niski murek). Rozkład wklęsłych obrysów na części wypukłe robi importer, nie symulacja.
