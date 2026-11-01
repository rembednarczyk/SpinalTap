# ADR-0047: Meble uliczne Lublina 2077: dane z planu, modele NPR, instancje cienkie, bloki LOD i halo latarń

## Kontekst
Renderer miasta z danych mapowych (ADR-0044) rysuje budynki, teren i nawierzchnie, ale ulice są puste. Plan `docs/world/lublin-street-plan.md` i jego maszynowa wersja `docs/world/lublin-props.todo.json` (480 pozycji, 4052 sztuki) opisują, co tam stoi: pięć typów latarń ze zdjęć, ławki, słupki, drzewa, kosze, pomniki i resztę. Kontrakt jest już w `core`: `StreetPropKind`, `StreetPropItem` i widok `street-props` (rodzaj, x, y, z, yaw, variant).

Ograniczenia:
- dane offline, bez losowości (hash zamiast `Math.random`);
- `WORLD_CHUNKS` i reszta treści gry bez zmian (przenosiny gry do Lublina idą osobno);
- Babylon tylko przez `engine/src/babylon.ts`, części za fasadą `BabylonRenderer`, limity ADR-0031;
- budżety scen gry z `tools/perf-budgets.json` bez zmian, telefon (`low`) ma działać;
- bez dynamicznych świateł per latarnia.

## Decyzja

### Dane: `pnpm osm:props`
- Narzędzie w `tools/osm-import` (`props*.ts`) czyta plan i wygenerowane chunki (teren, nawierzchnie, obrysy budynków, ulice) i pisze `packages/sim/src/content/lublin/props.generated.ts`.
- Format: tabela per id chunka, per rodzaj, płaskie wiersze `x, y, z, yaw, variant` (103 KiB na 3391 sztuk). `content/lublin` dekoduje ją do `LUBLIN_STREET_PROPS: Record<chunkId, StreetPropItem[]>` i daje `streetPropsView(chunkId)`. Widok stoi w początku świata, więc pozycje są światowe, jak przy `ground`.
- `y` to `terrainHeightAt` terenu chunka. Chunk wybiera pozycja sztuki (prostokąt półotwarty), nie podpowiedź z planu; to, co wypada poza chunki, odpada.
- Reguły rozstawiania:
  - `points` i `position` dokładnie;
  - linie z `spacing` co rozstaw; latarnie stają na chodniku tuż za krawędzią jezdni (szukanie wzdłuż normalnej po nawierzchniach chunka), na deptaku w stałym odsunięciu od osi, przed fasadą, jeśli bliżej; ramię latarni patrzy na oś ulicy;
  - „po obu stronach” daje dwa rzędy, drugi przesunięty o pół rozstawu; latarenki stają na fasadzie (pierwszy budynek wzdłuż normalnej), ogródki i potykacze przed fasadą na zmianę stronami;
  - latarnia z linii przesuwa się o 2,5 albo 5 m wzdłuż linii, jeśli stoi w koronie drzewa (3,4 m) albo przy ławce, kiosku, pomniku;
  - linie bez rozstawu: szpalery co 9 m, krzewy i żywopłoty co 6 m, a `count` rozłożony równo po długości;
  - obszary: ciąg Haltona z przesunięciem z hasha id, z minimalnym odstępem, tylko poza budynkami; kiosk i wiata stają w środku swojego obrysu, frontem do najbliższej ulicy;
  - grupy bez geometrii idą za danymi chunków: włazy na jezdni wzdłuż ulic, szafki przy krawężniku, tabliczki z nazwami na rogach skrzyżowań różnie nazwanych ulic, kosze przy przystankach i ławkach bez kosza w promieniu 30 m, kosze z kwiatami na co drugiej latarni pastorałowej i kandelabrze;
  - Plac Litewski: plan prosi o latarnie „po obrysie placu i wzdłuż alejek”, więc poza osiami dochodzi 18 słupów na płytach placu, z dala od drzew.
- `yaw`: z planu, z linii albo w stronę otwartego chodnika (ławki, automaty, kosze), albo do ulicy (wiaty, sygnalizatory, pomniki), w ostateczności z hasha.
- `variant`: 16 bitów FNV-1a id OSM albo klucza pozycji. Niskie bity wybierają kształt (`PROP_SHAPES` w engine, `SHAPES` w narzędziu): pomnik i rzeźba 0 obelisk, 1 postać na cokole, 2 Koziołek, 3 abstrakcja, 4 stela z tablicą, 5 kapliczka; maszt 0 zwykły, 1 Maszt Niepodległości; drzewo 0 lipa, 1 klon, 2 kasztanowiec; ławka z oparciem albo bez; słup ogłoszeniowy grafitowy albo żółty z kopułą. Narzędzie wymusza kształty, które plan nazywa (wysoki maszt, żółty słup Placu Zamkowego). Pomnik i rzeźba nigdy nie biorą kształtu z hasha (G-149): kształt daje ręczna tabela znanych pomników Lublina, a bez wpisu tagi OSM (`memorial`, `artwork_type`, `historic`, `name`); bez dopasowania neutralna stela, abstrakcja tylko dla `artwork_type=sculpture`. Tablice, potykacze, murale i mozaiki nie są wolnostojące i zostają pominięte z powodem (`SKIPPED_ART` w `props-kinds.ts`). Bity 4 do 7 skalują drzewa i krzewy.
- Rodzaje spoza `StreetPropKind`: 21 zmapowanych na najbliższy (np. `trolley-wire` na `trolley-pole`, `tree-row` na `tree`, `hedge` na `shrubs`, `fountain` i `fountain-multimedia` na dysze, `shrine` na pomnik z postacią, `phone-booth` i `parcel-locker` na automat), 42 pominięte z powodem w `props-kinds.ts` (przejścia to dekale, płoty, mury i schody potrzebują własnej geometrii wzdłuż linii, mosty i budynki są strukturami, obiekty w fasadach, tymczasowe, pojazdy). Test pilnuje, że każdy rodzaj planu jest w jednej z tych grup.

### Modele
- `engine/src/renderer/mapcity/prop-*.ts`: czyste plany na `MeshSink` (bez Babylona), we własnym układzie: front +z, stopa w początku. Kolor na wierzchołek, flagi w alfie jak dressing (ADR-0027): szkło latarń, neon i ekrany świecą same.
- Latarnie ze zdjęć: pastorał (żeliwny słup, ramię jak pastorał, wisząca czterościenna latarenka), latarenka na kutym wysięgniku z fasady (ciepła albo zimny LED), kandelabr Placu Zamkowego (żłobkowana kolumna, cztery zawinięte ramiona z kulami), smukły grafitowy słup Placu Litewskiego (poprzeczka i płaskie oprawy LED), latarnia drogowa (wysięgnik, sód, baner, kamera ANPR), latarnia parkowa i reflektor iluminacji.
- Reszta: ławy z listew Placu Litewskiego, granitowe słupki z łańcuchem, trzy sylwetki drzew (korony z gładkimi normalnymi, więc tusz rysuje tylko obrys), krzewy, donice, podwójne kosze z kwiatami, kosze, stojaki, totem roweru miejskiego, słupy ogłoszeniowe, potykacze, tabliczki, szafki, włazy, granitowe kostki, maszty z czerwonym banerem, sygnalizatory, wiaty, przystanki, biletomaty, automaty, kiosk, ogródek (podest, płotek, stoliki, parasol), stragan, słup trakcji z wieszakiem i przewodami, dysze fontann, obelisk Unii, postać na cokole, Koziołek, rzeźba, kamera.
- 2077 oszczędnie: holo-pierścień pod latarenką pastorału, pasek LED na słupie Placu Litewskiego, kolorowe kule kandelabrów, pierścień ekranu na słupie ogłoszeniowym, neon pod ławką, panel w kostce granitowej, opaski czujników na klonach, ekrany automatów, holo-pierścienie obelisku.
- Ten sam kształt daje zawsze tę samą geometrię (test).
- Preset `streetProp`; `selfLit` idzie za porą dnia (1 w nocy, 0,6 w dzień), więc szkło latarń w dzień nie świeci jak w nocy.

### Rysowanie
- `StreetProps` za `MapCity` (widok `street-props` trafia przez `isMapView`), tworzony przy pierwszym takim widoku: scena bez mebli jest taka jak dotąd.
- Sztuki trafiają do komórek 128 m mapy, komórki do bloków 256 m.
- Bliskie bloki: pełne modele jako instancje cienkie, jedna siatka na rodzaj i kształt dla wszystkich bliskich komórek. Komórki wybierają, co trafia do bufora macierzy, a bufor przebudowuje się tylko przy zmianie pasma którejś komórki. Dzięki temu wywołania rysowania rosną z liczbą rodzajów w zasięgu (około 40), a nie z liczbą komórek razy rodzajów (wersja per komórka dawała ponad 100 siatek na Placu Litewskim).
- Dalekie bloki: jedna wypieczona siatka na blok z uproszczonymi drzewami (pień i jedna korona), latarniami (słup i świecące bloki w miejscach świateł), pomnikami i masztami. Drobiazgi znikają.
- Halo: jedna addytywna siatka na blok. Przy każdym świetle sprite zwrócony do kamery (wierzchołki rozciąga shader z UV, przysunięty do oka, żeby szkło go nie zasłaniało) i miękka plama na chodniku pod latarniami ulicznymi. Gaśnie w dzień i we mgle. Poza G-buforem, cieniem i glow. Bez dynamicznych świateł.
- Meble nie rzucają cienia księżyca (instancje nie idą do `MoonShadow`).

### LOD (`PROP_LOD`, histereza 10 m)
| Jakość | drobiazgi | szczegóły | daleko |
|---|---|---|---|
| `high` | 80 m | 170 m | 650 m |
| `medium` | 60 m | 130 m | 480 m |
| `low` | 40 m | 80 m | 320 m |

Blok bliżej niż „szczegóły” rysuje swoje komórki w szczegółach (każda co najmniej wysokie i średnie rzeczy, drobiazgi tylko komórki bliżej niż „drobiazgi”), dalej do „daleko” swoją siatkę daleką, potem nic.

### Podgląd
- `?lublin-preview` spawnuje widok `street-props` każdego chunka, `props=0` je wyłącza (do porównań). Nowe ujęcia: `litewski`, `pastoraly`, `latarenki`, `kandelabry`.
- `?props-gallery` (także z `?lublin-preview`): wszystkie rodzaje i kształty w czterech rzędach (latarnie, zieleń, drobne, większe i pomniki) na granitowym placu, ujęcia `galeria`, `galeria-noc`, `latarnie`, `latarnie-dzien`, `zielen`, `drobne`, `drobne-noc`, `stoiska`, `rzezby`.

## Konsekwencje
- Dane: 3391 sztuk w 20 chunkach (Krakowskie 1566, Stare Miasto 586, Podzamcze 772, Nabrzeże 467). Najwięcej: drzewa 611, krzewy 433, latarnie drogowe 363, słupki 356, ławki 337, włazy 187, latarenki 171. Odpadło 116 sztuk poza chunkami, 77 w obrysach budynków (dziedzińce wypełnione przez importer, drzewa w nich przebiłyby dach), 41 za blisko tego samego rodzaju. Latarenek jest 171 z 236 z planu: na szerokim Rynku i przy placach fasada bywa dalej niż 16 m od osi.
- Wierzchołki modeli: od 44 (kostka) do 953 (kandelabr); pastorał 836, drzewa 210 do 344, słupek z łańcuchem 128; dalekie latarnie i drzewa 44 do 236.
- Podgląd całego centrum, SwiftShader 1280 × 720, wywołania rysowania bez mebli i z meblami:
  - `high`: plac 138 → 204, krakowskie 148 → 233, rynek 171 → 259, zamek 107 → 179, stare (z góry) 172 → 196;
  - `low`: plac 56 → 88, krakowskie 67 → 101, rynek 68 → 98, zamek 53 → 82, stare 54 → 58.
  - Gra nie spawnuje widoku `street-props`, więc budżety scen gry są bez zmian (reference, market-tpp i docks jak w ADR-0044). `street-tpp` na `d9c030d` i na tej gałęzi daje raz 301, raz 306, raz 331 wywołań przy tym samym kroku: niestabilność istniała przed tą zmianą, do zbadania osobno.
- Na później:
  - kolizje mebli w symulacji (to treść sim) i dekale (przejścia, odwodnienia);
  - płoty, mury, schody i balustrady jako geometria wzdłuż linii, mosty;
  - fontanna multimedialna z niecką i pokazem, Latarnia Pamięci i pomnik konny jako własne modele;
  - kilka najbliższych latarń jako światła punktowe toon, jeśli scena gry w Lublinie tego potrzebuje;
  - kolor per instancja (atrybut instancji w shaderze toon), żeby warianty kolorów nie były osobnymi siatkami;
  - budżety scen Lublina przy przenosinach gry.
