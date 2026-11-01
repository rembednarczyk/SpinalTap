# Dane mapowe: źródła i licencje

Surowe dane, z których `tools/osm-import` generuje Lublin 2077 (ADR-0042). Pobiera je `pnpm osm:fetch`, a `pnpm osm:build` generuje z nich offline `packages/sim/src/content/lublin/*.generated.ts`.

## OpenStreetMap

- **Pliki:** `data/osm/<dystrykt>.json`.
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
