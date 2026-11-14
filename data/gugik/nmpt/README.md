# data/gugik/nmpt: wysokość nad terenem (NMPT − NMT)

- **Co:** dla każdej dzielnicy mapy siatka 1 m w PUWG 1992 (EPSG:2180) nad prostokątem dzielnicy z marginesem 10 m. W oczku jest najwyższe z czterech oczek 0,5 m NMPT, minus 0,15 m (PL-EVRF2007-NH na PL-KRON86-NH) i minus NMT z `data/terrain`. Zapis to jeden bajt w krokach 0,2 m: 0 to teren, 255 brak danych. Nagłówek `<dzielnica>.json`, dane `<dzielnica>.bin`, wiersz 0 na północy.
- **Do czego:** wysokości drzew w `pnpm osm:props` (`tools/osm-import/src/tree-heights.ts`, audyt ADR-0077, luka 4).
- **Jak powstaje:** `pnpm gugik:nmpt` (`tools/gugik/src/nmpt-fetch.ts`, potem `nmpt-extract.ts`), także w `pnpm map:refresh` (kroki `nmpt-fetch` i `nmpt-extract`). Ta sama pamięć podręczna i ten sam NMT dają te same bajty.
- **Źródło:** Główny Urząd Geodezji i Kartografii, państwowy zasób geodezyjny i kartograficzny, NMPT 0,5 m. Usługa WCS `https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMPT/GRID1/WCS/DigitalSurfaceModel`, pokrycie `DSM_PL-EVRF2007-NH`, pobrane 14.11.2026.
- **Licencja:** dane udostępniane bezpłatnie do dowolnego celu (art. 40a ustawy Prawo geodezyjne i kartograficzne), jak NMT. Atrybucja w `data/osm/ATTRIBUTION.md`, sekcja „Powierzchnia: NMPT GUGiK”.
