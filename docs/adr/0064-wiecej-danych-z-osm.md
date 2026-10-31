# ADR-0064: Więcej danych z OSM i bryły LOD2 z geoportalu

## Kontekst
Przegląd z 31.10 (`docs/plany/osm-niewykorzystane.md`) znalazł dane OSM, które mamy w `data/osm`, a których import nie używa, oraz dane, które filtr odrzuca przy pobieraniu. Użytkownik wybrał (31.10) pozycje 1, 3, 4, 7, 8, 9, 12, 13, 15, 17 i 19.

## Decyzja
- **Zasady wspólne:**
  - wszystko idzie przez `tools/osm-import` offline z `data/`; gra dalej nie łączy się z siecią (ADR-0042);
  - zmiany filtra pobierania (`filterOsm`) wymagają ponownego `pnpm osm:fetch` i dopisania tylko nowych elementów, bez zmiany istniejących (sprawdza to weryfikator, jak przy G-049);
  - nowe pola widoku i treści przechodzą przez kontrakt w `core/ports` z dopiskiem w tym ADR-ze;
  - każdy etap przechodzi przegląd kuratora topografii i dostaje kontrolę w skanie, gdy rodzaj jest policzalny;
  - marki i prawdziwe nazwy firm nie trafiają na szyldy (ADR-0058): nazwa lokalu z OSM służy tylko do wyboru rodzaju i do generycznej nazwy 2077.
- **Etapy (osobne PR-y, w tej kolejności):**
  1. **Dachy z `roof:shape` i `roof:orientation`** (poz. 3): dwuspadowe, naczółkowe, mansardowe, kopuły, cebule, piramidy; pole kształtu dachu w widoku `building`. Zamyka G-056 (hełmy i kopuły jako dachy czterospadowe).
  2. **Wejścia `entrance=*`** (poz. 15): drzwi w prawdziwych miejscach elewacji, punkty wejść dla wnętrz (ADR-0061, plan wnętrz zabytków) i dla NPC wychodzących z bram.
  3. **Oświetlenie ulic `lit`** (poz. 4): latarnie tylko tam, gdzie ulica jest oświetlona; nieoświetlone zaułki ciemne. Później źródło dla skradania (widoczność w ciemności, osobna zmiana w `sim`).
  4. **Lokale w parterach** (poz. 1): sklepy, restauracje, bary, kawiarnie, banki, apteki, kluby z węzłów OSM jako szyldy i neony na właściwej elewacji, z generyczną nazwą 2077 według rodzaju (teksty dla gracza przez i18n).
  5. **Drzewa `natural=tree`** (poz. 17): pojedyncze drzewa z OSM (gatunek liściasty albo iglasty, wysokość, jeśli jest) zamiast losowych tam, gdzie OSM je ma.
  6. **Przystanki i linie** (poz. 7): numery linii autobusów i trolejbusów na przystankach, tablice odjazdów jako ekrany 2077.
  7. **Sztuka i pamięć** (poz. 8): rodzaj dzieła (`artwork_type`: mural, rzeźba, instalacja), tablice pamiątkowe z prawdziwym napisem (`inscription`) do przeczytania przez gracza; napis w oryginale, opis przez i18n.
  8. **Schody** (poz. 9): poręcze (`handrail`), rampy (`ramp`), liczba stopni (`step_count`) zgodna z rzeczywistością.
  9. **Płoty i mury** (poz. 12): `barrier=fence`, mury miejskie i oporowe jako geometria wzdłuż linii, z kolizją w `sim` (świadoma zmiana złotego hasha).
  10. **Skarpy, nasypy, wieże techniczne, potoki** (poz. 13): `natural=cliff`, `man_made=embankment`, `man_made=tower`, `waterway=stream` w terenie i panoramie.
  11. **Bryły LOD2 z geoportalu** (poz. 19): wysokości i dachy budynków z modelu 3D GUGiK (otwarte dane, jak NMT z ADR-0042) jako źródło wysokości ważniejsze od `building:levels`; OSM zostaje źródłem obrysów i tagów. Wcześniej rozpoznanie: format, zasięg dla centrum Lublina, licencja i rozmiar.
- Pozycje 2, 5, 6, 10, 11, 14, 16 i 18 z przeglądu nie wchodzą teraz.

## Uzupełnienie (31.10): zbiory geoportalu wybrane przez użytkownika
Użytkownik dołożył pozycje 20, 23, 25 i 26 z sekcji C przeglądu. Każdy etap zaczyna się od rozpoznania: dostępność dla centrum Lublina, usługa (WCS, WMS/WMTS, WFS, pobranie paczek), licencja i warunki ponownego wykorzystania, rozmiar. Dane pobiera `pnpm osm:fetch` (albo bliźniacze polecenie) do `data/`, gra dalej działa offline, a źródło trafia do `data/osm/ATTRIBUTION.md`.
12. **Rejestr zabytków NID** (poz. 25): oficjalna lista zabytków z obrysami lub punktami jako źródło statusu zabytku w imporcie (obok tagów OSM). Rozstrzyga sprawy G-050 i G-066 oraz zasilają ADR-0062 etap 7 (przepisy ogólne). Kontrola skanu: zabytek z rejestru z nadbudową albo bez przepisu.
13. **Punkty adresowe** (poz. 26): adres każdego budynku. Tabliczki z numerami na elewacjach, adresy w celach kontraktów i dialogach, poprawne przypisanie nazw z punktów OSM (G-051, G-065: nazwa tylko przy zgodnym adresie).
14. **NMPT** (poz. 20): model pokrycia terenu. Wysokość każdego budynku z różnicy NMPT − NMT (mediana w obrysie) zamiast szacunku z `building:levels`, wysokości koron drzew. Uzupełnia i weryfikuje etap 11 (LOD2); budynki z rozbieżnością > 20% trafiają do przeglądu kuratora (np. przedbramie Bramy Krakowskiej 7,1 m wobec ok. 10 m).
15. **Ortofotomapa** (poz. 23): materiał referencyjny dla kuratora i łowców (zdjęcie z góry zamiast fotografii z sieci) oraz źródło kolorów dachów i nawierzchni dla renderera. Do repo trafiają tylko wyliczone kolory na budynek lub powierzchnię, nie kafle zdjęć.

## Konsekwencje
- Miasto zbliża się do prawdziwego Lublina w miejscach, które gracz widzi najczęściej: dachy, wejścia, szyldy, oświetlenie, drzewa.
- Etapy 2, 3 i 9 dotykają `sim` (wejścia, widoczność, kolizja płotów); złote hashe zmieniają się tylko tam, świadomie.
- Etap 11 może zmienić wysokości wielu budynków naraz; wtedy kurator robi przegląd całych dzielnic, a migawka NPR zmienia się świadomie.
