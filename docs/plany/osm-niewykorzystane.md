# Co jeszcze można wziąć z OSM (31.10)

**Decyzja użytkownika (31.10):** bierzemy 1, 3, 4, 7, 8, 9, 12, 13, 15, 17, 19. Plan etapów: [ADR-0064](../adr/0064-wiecej-danych-z-osm.md).

Przegląd `data/osm/*.json` (cztery dzielnice) i `tools/osm-import`. Liczby to obiekty w danych gry.

## A. Mamy w danych, nie używamy
| # | Co | Ile | Co da w grze |
|---|---|---|---|
| 1 | Lokale w parterach: `shop` (203), restauracje (63), fast food (25), bary i puby (19), kawiarnie (16), banki (17), apteki (12), kluby (5), z nazwami | ok. 380 | Szyldy i neony w prawdziwych miejscach (marki zamienione na wersje 2077), wejścia do sklepów i barów, cele kontraktów, ludzie przy lokalach. Dziś pomijane jako „punkt w budynku”. |
| 2 | Kolory i materiały: `building:colour` (22), `roof:colour` (25), `roof:material` (11), `building:material` (7) | 65 | Prawdziwe kolory elewacji i dachów zamiast losowych z palety. Uwaga: kolor dachu w OSM bywa błędny (T-032). |
| 3 | Kształt dachu `roof:shape` (dwuspadowe 85, mansardowe 16, naczółkowe 16, kopuły 7, cebule 2) i `roof:orientation` (57) | ok. 180 | Prawdziwe dachy zamiast domyślnych (G-056). |
| 4 | Oświetlenie ulic `lit` | 1030 odcinków | Które ulice są oświetlone, a które to ciemne zaułki: skradanie, klimat nocy. |
| 5 | Ruch: `maxspeed` (212), `turn:lanes` (84+32), `oneway:bicycle`, `psv`, `hgv` | ok. 350 | Prędkości aut, strzałki na pasach i skręty jak w Lublinie. |
| 6 | Ścieżki rowerowe `cycleway:*` (ok. 150), `bicycle` (129), stacje rowerów (7) | ok. 290 | Pasy rowerowe w oznakowaniu, stacje rowerów 2077, rowerzyści w ruchu. |
| 7 | Przystanki: `network`, `bus`, `trolleybus`, tablice odjazdów (19) | ok. 120 | Prawdziwe linie na przystankach, tablice odjazdów jako ekrany 2077. |
| 8 | Sztuka i pamięć: `artwork_type` (67), `memorial` (76), `inscription` (31), `artist_name` (24) | ok. 200 | Rodzaj dzieła (mural, rzeźba), tablice z prawdziwymi napisami do przeczytania przez gracza (lore). |
| 9 | Schody: `step_count` (32), `handrail` (65), `incline` (65), `ramp` (62) | ok. 220 | Poręcze i rampy na schodach, liczba stopni zgodna z rzeczywistością. |
| 10 | Wyznanie `religion`/`denomination` (28) | 28 | Styl kościoła, cerkwi, zboru w przepisach ogólnych zabytków (ADR-0062 etap 7). |
| 11 | Zieleń: trawniki (320), zarośla (47), rzędy drzew (18), lasy (8), ogrody, parki, place zabaw (13), `leaf_type` (10) | ok. 420 | Rodzaje roślin, drzewa liściaste i iglaste, wyposażenie placów zabaw (dziś pomijane). |
| 12 | Ogrodzenia i mury (`barrier=fence`, mury miejskie, mury oporowe) | kilkadziesiąt | Płoty i mury jako geometria (dziś pomijane, „potrzebują własnej geometrii”). |
| 13 | Skarpy `natural=cliff` (11), nasypy (6), wieże techniczne (8), potoki (4) | ok. 30 | Wierniejszy teren i panorama. |
| 14 | Zabytkowość `heritage` (17) i `historic=yes` na kamienicach (ok. 50) | ok. 70 | Kamienice zabytkowe bez nadbudów albo ze stonowaną warstwą 2077 (sprawa z G-066). |

## B. Odrzucamy przy pobieraniu, a można dobrać
| # | Co | Co da w grze |
|---|---|---|
| 15 | Wejścia do budynków (`entrance=*`) | Drzwi w prawdziwych miejscach, wejścia do wnętrz zabytków (plan wnętrz), NPC wychodzący z bram. |
| 16 | Godziny otwarcia (`opening_hours`, dziś usuwane) | Lokale zamknięte w nocy, harmonogramy NPC zgodne z miastem. |
| 17 | Pojedyncze drzewa (`natural=tree`, gatunek, wysokość), jeśli są w OSM | Drzewa tam, gdzie rosną. |
| 18 | Trasy linii (`route=bus`, `route=trolleybus`) | Trolejbusy na prawdziwych trasach z numerami linii. |
| 19 | Wysokości z LOD2 geoportalu (bryły 3D budynków, poza OSM) | Dokładne wysokości i dachy całego centrum (przedbramie Bramy wyszło 7,1 zamiast ok. 10 m). |

## Rekomendacja
Na początek 1 (lokale i szyldy), 15 (wejścia), 4 (oświetlenie ulic), 3 (dachy, razem z G-056) i 19 (LOD2), bo dają najwięcej wiarygodności Lublina i wspierają plan wnętrz zabytków oraz skradanie.

## C. Geoportal (GUGiK) i źródła miejskie poza OSM (31.10)

**Decyzja użytkownika (31.10):** bierzemy 20, 23, 25, 26 (ADR-0064, etapy 12–15).
Dziś z geoportalu bierzemy tylko NMT 1 m (teren). Dostępność dla centrum Lublina i licencję każdego zbioru trzeba potwierdzić rozpoznaniem przed decyzją o etapie.
| # | Zbiór | Co da w grze |
|---|---|---|
| 20 | NMPT (model pokrycia terenu: teren + budynki + drzewa) | Wysokość każdego budynku i korony drzewa w metrach, bez zgadywania z `building:levels`; różnica NMPT − NMT to gotowa mapa wysokości. |
| 21 | Chmura punktów LiDAR (sklasyfikowana: grunt, budynki, roślinność) | Kształty dachów, attyk i kominów, drzewa z koroną i wysokością, mury i skarpy z dokładnością do decymetrów. |
| 22 | Budynki 3D LOD1/LOD2 | Gotowe bryły z dachami (już w ADR-0064 jako poz. 19). |
| 23 | Ortofotomapa (w miastach 5–10 cm) | Kolory dachów i nawierzchni, przebieg pasów i przejść, zieleń, place, rozpoznanie bram i prześwitów; materiał referencyjny dla kuratora. |
| 24 | BDOT10k (baza obiektów topograficznych) | Funkcja i liczba kondygnacji budynków, nawierzchnie i szerokości dróg, ogrodzenia, mury, zieleń: drugie źródło do porównania z OSM. |
| 25 | Rejestr zabytków (NID, warstwa w geoportalu) | Oficjalna lista zabytków z obrysami: rozstrzyga, co jest zabytkiem (G-050, G-066, ADR-0062 etap 7). |
| 26 | Punkty adresowe (PRG) | Adresy wszystkich budynków: tabliczki z numerami, cele kontraktów „ul. Grodzka 12”, poprawne przypisanie nazw (G-051, G-065). |
| 27 | GESUT (sieć uzbrojenia terenu: kanalizacja, ciepłociągi) | Przebieg prawdziwych kanałów pod miastem dla poziomu podziemnego (kanał, Trasa Podziemna). Dostęp zwykle ograniczony, do sprawdzenia. |
| 28 | Mapy archiwalne i archiwalne ortofoto (od lat 50.) | Jak wyglądało miasto przed przebudowami: tło fabularne, wspomnienia, warstwa historyczna. |
| 29 | Geoportal miejski Lublina (np. inwentaryzacja drzew, oświetlenie, przystanki, strefy parkowania) | Drzewa z gatunkiem, latarnie w prawdziwych miejscach, przystanki MPK; dostępność i licencja do sprawdzenia. |
