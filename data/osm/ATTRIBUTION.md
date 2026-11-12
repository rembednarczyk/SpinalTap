# Dane mapowe: źródła i licencje

Surowe dane, z których `tools/osm-import` generuje Lublin 2077 (ADR-0042). Pobiera je `pnpm osm:fetch`, a `pnpm osm:build` generuje z nich offline `packages/sim/src/content/lublin/*.generated.ts`.

## OpenStreetMap

- **Pliki:** `data/osm/<dystrykt>.json`, `data/osm/points/hydrants.json` (hydranty `emergency=fire_hydrant` z tych samych prostokątów, `pnpm osm:hydrants`, bo wyciągi dystryktów trzymają tylko nazwane punkty), `data/osm/points/entrances.json` (wejścia i drzwi `entrance=*`, `door=*`, `pnpm osm:entrances`, bo wyciągi nie trzymają tagów węzłów obrysów) i `data/osm/points/trees.json` (tagi `genus`, `species`, `taxon`, `leaf_type` drzew planu, które mają rodzaj lub gatunek, z `api/0.6/nodes` po id, `pnpm osm:trees`).
  - Wyciąg z `api.openstreetmap.org/api/0.6/map` dla prostokątów dystryktów z marginesem 40 m.
  - Bez metadanych edycji (wersja, autor, zestaw zmian, czas) i bez elementów, których generator nie czyta (trasy, granice, zakazy skrętu).
  - Bez części tagów (notatki, źródła, adresy WWW, telefony, godziny otwarcia).
- **Licencja:** © OpenStreetMap contributors, dane dostępne na licencji Open Database License (ODbL) 1.0: https://www.openstreetmap.org/copyright, https://opendatacommons.org/licenses/odbl/1-0/.
- **Baza pochodna:** wyciągi w `data/osm/` i wygenerowane tabele `packages/sim/src/content/lublin/*.generated.ts` są bazą danych pochodną od OpenStreetMap. Podlegają ODbL 1.0: kto je rozpowszechnia, musi zachować tę atrybucję i udostępnić je (albo sposób ich odtworzenia, czyli to narzędzie i te pliki) na tej samej licencji.
  - Gra, która je wyświetla, jest „Produced Work” w rozumieniu ODbL i wymaga atrybucji „© OpenStreetMap contributors” (README, napisy w menu tytułowym).

### Obszary chronione panoramy megabloków (ADR-0067)

- **Plik:** `packages/engine/src/renderer/mapcity/skyline-protected.ts`.
  - Obrysy dróg w40049437 (Stary cmentarz żydowski), w792467989 i w180729831 (Nowy cmentarz żydowski, z zatrawioną częścią) i w174005440 (Ogród Saski) oraz oś relacji r7577565 (Bystrzyca, ok. 5 km wokół centrum, uproszczona do ok. 4 m).
  - Pobrane z Nominatim (`nominatim.openstreetmap.org`, `polygon_geojson`) 1 listopada 2026 i rzutowane jak w `tools/osm-import` (od `LUBLIN_ANCHOR`).
  - Generator układu megabloków (`skyline-layout-gen.ts`) trzyma wieże z dala od tych miejsc.
- **Licencja:** jak wyżej, © OpenStreetMap contributors, ODbL 1.0; plik jest bazą pochodną.

## Teren: NMT GUGiK

- **Pliki:** `data/terrain/<dystrykt>.json` (nagłówek) i `data/terrain/<dystrykt>.bin` (wysokości).
  - Numeryczny Model Terenu o oczku 1 m z lotniczego skanowania laserowego.
  - Pobrany przez WCS `DTM_PL-KRON86-NH_TIFF`, układ PUWG 1992 (EPSG:2180), wysokości normalne PL-KRON86-NH.
  - Przechowywany jako mozaika 1 m na dystrykt: uint16 little-endian, decymetry ponad 100 m (wartość × 0,1 + 100), 0 oznacza brak danych.
- **Źródło:** Główny Urząd Geodezji i Kartografii (geoportal.gov.pl), NMT.
  - Dane udostępniane bezpłatnie do dowolnego celu (art. 40a ustawy Prawo geodezyjne i kartograficzne).

## Teren zapasowy: EU-DEM

- **Pliki:** `data/terrain/<dystrykt>.eudem.json`, tylko gdy NMT jest niedostępny.
  - Pobiera je `pnpm osm:fetch --eudem` z `api.opentopodata.org`.
  - Obecnie nieużywane: wszystkie dystrykty mają NMT.
- **Źródło:** EU-DEM v1.1, Copernicus Land Monitoring Service, Europejska Agencja Środowiska. Produced using Copernicus data and information funded by the European Union.

## Ortofotomapa PZGiK: pokrycie terenu (ADR-0077)

- **Pliki:** `data/orto/<obszar>.cover.png`, `data/orto/<obszar>.cover.json` i `data/orto/sources.json`.
  - Raster klas pokrycia co 0,5 m w układzie gry, paleta 4-bitowa: brak zdjęcia, zieleń, jasna nawierzchnia, asfalt, cień, nieznane. Obok nagłówek rastra.
  - Manifest: usługi i warstwa, arkusze i daty nalotów, data pobrania, progi i wersja klasyfikatora.
  - Wynik pochodny klasyfikacji kolorów ortofotomapy (`tools/orto`). Surowe zdjęcia zostają w pamięci podręcznej narzędzia, poza repozytorium.
  - Pobrane przez WMS `PZGIK/ORTO/WMS/HighResolution` (obraz bieżący) i `PZGIK/ORTO/WMS/StandardResolutionTime` (naloty archiwalne, parametr `TIME`), warstwa `Raster`, EPSG:2180. Daty nalotów ze skorowidza `SkorowidzeWgAktualnosci`.
- **Źródło:** Główny Urząd Geodezji i Kartografii, państwowy zasób geodezyjny i kartograficzny (geoportal.gov.pl), ortofotomapa.
  - Dane udostępniane bezpłatnie, do dowolnego wykorzystania (art. 40a ustawy Prawo geodezyjne i kartograficzne).
  - Regulamin: https://www.geoportal.gov.pl/pl/o-geoportalu/regulamin/

## Budynki 3D i BDOT10k: GUGiK (ADR-0077)

- **Pliki:** `data/gugik/` (wyciągi pochodne dla całego miasta, kafle 1 km w układzie gry; format w `data/gugik/index.json`), manifest paczek `data/gugik/sources.json` (adres, data pobrania, `Last-Modified`, rozmiar, sha256) i próbki `tools/gugik/test/fixtures/*.gml` (Collegium Maximum).
  - Modele 3D budynków LoD1 (stan 2024, `measuredHeight`): `opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/06/0663.zip`.
  - Modele 3D budynków LoD2 (CityGML 2.0, stan 2017, kształty dachów): `opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD2/0663_gml.zip`.
  - Baza Danych Obiektów Topograficznych BDOT10k powiatu 0663 (GeoPackage): `opendata.geoportal.gov.pl/bdot10k/schemat2021/GPKG/06/0663_GPKG.zip`; w wyciągu tylko linie ścian oporowych, umocnień brzegu, murów historycznych, ekranów akustycznych i żywopłotów.
  - Pobiera je `pnpm gugik:fetch` do pamięci podręcznej poza repo (`${XDG_CACHE_HOME:-~/.cache}/seki-gugik`), wyciągi tworzy `pnpm gugik:extract`. Surowe paczki nie trafiają do repo.
- **Źródło i licencja:** Główny Urząd Geodezji i Kartografii (geoportal.gov.pl), dane na licencji Creative Commons Uznanie autorstwa 4.0 (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/.
  - Wyciągi są przetworzone: współrzędne przeliczone z PUWG 1992 (EPSG:2180) do układu gry, obrysy zaokrąglone do 0,1 m, wysokości dachów liczone z powierzchni LoD2.
