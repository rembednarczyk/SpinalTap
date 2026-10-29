# ADR-0042: Lublin z danych mapowych: OSM i teren zamiast ręcznych dystryktów

## Kontekst
Gracz chce, żeby świat odtwarzał centrum Lublina wiernie: dotychczasowy setup (Shinsekai 7, Kanałowa, targ, doki) ma się stać centrum Lublina, budowanym z danych mapowych.

Rozważone źródła:
- **Google Photorealistic 3D Tiles** (Map Tiles API).
  - Wymagają klucza API i działają tylko online, strumieniowo.
  - Licencja nie pozwala wyciągać z nich geometrii do kolizji ani budować na nich świata gry.
  - Fotorealizm kłóci się ze stylem NPR.
  - Odrzucone jako podstawa.
- **OpenStreetMap** (licencja ODbL).
  - Obrysy budynków, część z wysokością albo liczbą pięter, ulice z typem i szerokością, chodniki, place, rzeka, nazwy.
  - Pochodne dane wolno trzymać w repo z atrybucją.
  - Z tego środowiska działa API `api.openstreetmap.org/api/0.6/map` (bbox do 50 tys. węzłów). Overpass i Geofabrik są niedostępne.
- **Teren: NMT 1 m z lidaru (GUGiK, Geoportal, WCS)**, z EU-DEM 25 m jako zapasem.
  - Centrum Lublina ma prawdziwe różnice wysokości (NMT): Plac Litewski 195,8 m, Brama Krakowska 196,7 m, Rynek 195,9 m, Plac Zamkowy 175,5 m, Bystrzyca 166 m.

Gracz wybrał (pytania w sesji):
- OSM z terenem;
- dystrykty według propozycji (lista niżej);
- nazwy „Lublin 2077”;
- skala 1:1 z wyciętym obszarem.

## Decyzja

### Dane offline, deterministycznie
- Narzędzie `tools/osm-import` (Node, uruchamiane ręcznie, nie w buildzie):
  - pobiera surowe dane OSM dla prostokątów dystryktów i wysokości terenu;
  - zapisuje surowe dane do `data/osm/` (z plikiem `ATTRIBUTION.md`);
  - generuje treść do `packages/sim/src/content/lublin/` (pliki `*.generated.ts`, wyłączone z limitu `max-lines` jak inne tabele treści).
- Gra nie łączy się z siecią. Ten sam commit daje ten sam świat, więc złote hashe i zapis pozostają deterministyczne.
- Atrybucja „© OpenStreetMap contributors (ODbL)” i „Źródło: GUGiK, NMT” (EU-DEM/Copernicus, jeśli użyty) trafia do README, `data/osm/ATTRIBUTION.md` i napisów w menu tytułowym.

### Układ współrzędnych
- `LUBLIN_ANCHOR` (`core/world/city-geo.ts`): Plac Litewski (51,24838 N, 22,55964 E, 195,8 m n.p.m. według NMT) to świat (0, 0, 0).
- x rośnie na wschód, z na północ, w metrach. Rzutowanie równoodległościowe wokół kotwicy, błąd poniżej 0,1 % na 2 km.
- Wysokość w świecie = wysokość n.p.m. − 195,8.

### Dystrykty (Lublin 2077)
Obecne identyfikatory dystryktów zostają w kodzie, zmieniają się nazwy, treść i geometria.

| Id | Nazwa w grze | Obszar | Co tu było |
|---|---|---|---|
| `shinsekai-7` | Krakowskie Przedmieście | deptak od Placu Litewskiego do Bramy Krakowskiej, z Placem Litewskim | start, klinika Mori, Neon Koi |
| `kanal` | Stare Miasto | od Bramy Krakowskiej przez Rynek do Bramy Grodzkiej | ulica Hebi |
| `targ` | Podzamcze | Plac Zamkowy, ul. Ruska, hala targowa, okolice dworca PKS | targ pod estakadą |
| `doki` | Nabrzeże Bystrzycy | wzdłuż Bystrzycy na północny wschód od Zamku | Tessen i dźwig |

Dokładne prostokąty ustala importer. Każdy dystrykt dzieli się na chunki streamingu po około 150-250 m.

### Kontrakty
- **Core (ten commit):** `GroundPoint`, `GeoAnchor`, `BuildingUse`, `TerrainGrid`, `terrainHeightAt` (interpolacja dwuliniowa, wspólna dla symulacji i renderera) i `GroundSurface`. Nowe rodzaje widoku:
  - `building` (obrys, wysokość, piętra, przeznaczenie, dach, nazwa, ziarno wyglądu);
  - `terrain` (siatka wysokości chunka);
  - `ground` (nawierzchnia: jezdnia, chodnik, plac, bruk, trawa, woda).
- **Sim (do zrobienia):**
  - **Bryły wypukłe.** `solid` dostaje wariant pryzmatu: wypukły wielokąt w XZ, dół i góra w y. Importer rozkłada obrysy budynków na wypukłe części. Kolizja koła postaci z wypukłym wielokątem, promienie (wzrok, pociski, kamera) przez pryzmat, rasteryzacja do pola odległości AI (ADR-0025). AABB zostaje dla wszystkiego, co jest dziś.
  - **Teren.** Wysokość gruntu z `TerrainGrid` chunka zamiast stałego y = 0 tam, gdzie chunk ma teren: postacie stoją na terenie, schodzą i wchodzą po zboczu bez skoku do nachylenia około 35°, a strome skarpy blokują. Grawitacja i lądowanie liczą się od terenu.
  - Bez terenu i pryzmatów zachowanie jest takie jak dziś: obecne złote hashe się nie zmieniają, dopóki treść się nie przeniesie.
- **Engine (do zrobienia):**
  - Budynki z obrysu: wyciągnięty wielokąt, fasada proceduralna NPR według przeznaczenia i pięter (okna, witryny i neony na parterze, gzymsy, kościoły i zabytki z własnym dachem albo kopułą), scalane na chunk i materiał.
  - Teren jako siatka na chunk, nawierzchnie nałożone na teren.
  - Budżety z `tools/perf-budgets.json` obowiązują dalej; nowe sceny dostaną budżety przy przenosinach.
- **Treść (po sim i engine):**
  - przeniesienie postaci, wnętrz (klinika i Neon Koi w prawdziwych kamienicach na Krakowskim), drzwi, metra (stacje przy Placu Litewskim, Bramie Krakowskiej, Placu Zamkowym i na nabrzeżu), tras tłumu, miejsc aktywności, nawigacji, spotkań, urządzeń i zleceń na nowe miejsca;
  - narracja: nazwy miejsc w ink na lubelskie, postacie i frakcje zostają;
  - złote hashe, zapis i e2e zmieniają się wtedy świadomie, z opisem.
- **Nabrzeże Bystrzycy** leży około 1,2 km na wschód od Podzamcza (tak płynie rzeka). Dojazd metrem, które i tak łączy dystrykty; przejazd pokrywa streaming.

### Zmiany kontraktu
- `LUBLIN_ANCHOR.altitude` 198 → 195,8 (pomiar NMT pod kotwicą).
- Widok `building` dostaje `plinth?` (podmurówka na zboczu) i `shopfront?` (witryny na parterze); obie wartości liczy importer.

### Zapis
- Przeniesienie świata podbija `SAVE_SCHEMA_VERSION`. Migracja przenosi gracza na start w klinice, bo stare współrzędne nic nie znaczą w nowym mieście, i czyści pozycje zapamiętanych postaci.

## Konsekwencje
- Świat staje się większy i nieregularny. Wydajność mobilną sprawdzamy od pierwszego kroku: scalanie budynków na chunk, LOD dalekich bloków i budżety wywołań rysowania.
- City kit (ADR-0022) zostaje do rekwizytów i detali. Budynki z mapy rysuje fasada proceduralna, bo modele kitu nie pasują do dowolnych obrysów.
- Etapy:
  1. kontrakty;
  2. równolegle importer, sim (pryzmaty, teren) i engine (budynki, teren, nawierzchnie);
  3. przeniesienie treści dystrykt po dystrykcie.
