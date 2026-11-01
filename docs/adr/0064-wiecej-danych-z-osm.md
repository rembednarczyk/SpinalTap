# ADR-0064: Więcej danych z OSM i bryły LOD2 z geoportalu

## Kontekst
Przegląd z 31.10 (`docs/plany/osm-niewykorzystane.md`) znalazł dane OSM, które mamy w `data/osm`, a których import nie używa, oraz dane, które filtr odrzuca przy pobieraniu. Użytkownik wybrał (31.10) pozycje 1, 3, 4, 7, 8, 9, 12, 13, 15, 17 i 19.

## Decyzja
- **Zasady wspólne:**
  - wszystko idzie przez `tools/osm-import` offline z `data/`; gra dalej nie łączy się z siecią (ADR-0042);
  - zmiany filtra pobierania (`filterOsm`) wymagają ponownego `pnpm osm:fetch` i dopisania tylko nowych elementów, bez zmiany istniejących (sprawdza to weryfikator, jak przy G-049);
  - nowe pola widoku i treści przechodzą przez kontrakt w `core/ports` z dopiskiem w tym ADR-ze;
  - każdy etap przechodzi przegląd kuratora topografii i dostaje kontrolę w skanie, gdy rodzaj jest policzalny;
  - marki i prawdziwe nazwy firm nie trafiają na szyldy (ADR-0058): nazwa lokalu z OSM wybiera rodzaj i nazwę 2077 z tabeli `venue-names` (parodia sieci albo nowa nazwa lokalu, decyzje z 31.10 i 1.11 niżej), a sama na szyld nie trafia.
- **Etapy (osobne PR-y, w tej kolejności):**
  1. **Dachy z `roof:shape` i `roof:orientation`** (poz. 3): dwuspadowe, naczółkowe, mansardowe, kopuły, cebule, piramidy; pole kształtu dachu w widoku `building`. Zamyka G-056 (hełmy i kopuły jako dachy czterospadowe).
  2. **Wejścia `entrance=*`** (poz. 15): drzwi w prawdziwych miejscach elewacji, punkty wejść dla wnętrz (ADR-0061, plan wnętrz zabytków) i dla NPC wychodzących z bram.
  3. **Oświetlenie ulic `lit`** (poz. 4): latarnie tylko tam, gdzie ulica jest oświetlona; nieoświetlone zaułki ciemne. Później źródło dla skradania (widoczność w ciemności, osobna zmiana w `sim`).
  4. **Lokale w parterach** (poz. 1): sklepy, restauracje, bary, kawiarnie, banki, apteki, kluby z węzłów OSM jako szyldy i neony na właściwej elewacji, z nazwą 2077 z tabeli danych `venue-names` (generyczną według rodzaju, gdy lokal nie ma nazwy); słowa rodzajów dla gracza przez i18n.
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

## Uzupełnienie (etap 1)
- Widok `building` (`core/ports/types.ts`) dostaje dwa pola opcjonalne i wsteczne: `roofShape` (`RoofShape`: `gabled`, `half-hipped`, `mansard`, `hipped`, `pyramidal`, `skillion`, `dome`, `onion`, `flat`) z OSM `roof:shape` oraz `roofAcross` z `roof:orientation=across` (kalenica w poprzek dłuższego boku obrysu; bez pola wzdłuż). Import mapuje pokrewne wartości: `lean_to` na `skillion`, `gambrel` na `mansard`, `cone` na `pyramidal`, `side_hipped` i `saltbox` na `gabled`; inne wartości zostają bez pola.
- Bez pola renderer rysuje dach jak dotąd (czterospadowy, czasem kopuła na zwartym zabytku), z tymi samymi losowaniami wyglądu. Z polem kształt idzie z danych, także w częściach `building:part` (G-049).
- Wysokość dachu (`roof`) i bryły kolizji się nie zmieniają: kształt to sam wygląd, złote hashe zostają.

## Uzupełnienie (31.10): szyldy lokali, decyzja użytkownika
Użytkownik uznał zestaw lokali w grze za ubogi i wybrał (31.10) wariant „parodie + kolory” dla etapu 4 (lokale w parterach):
- każdy prawdziwy lokal z OSM (ok. 380: sklepy, restauracje, bary, kawiarnie, banki, apteki, kluby) dostaje szyld w swoim miejscu na właściwej elewacji;
- nazwa jest przerobiona na wersję Lublina 2077 (gra słów, skrót, futurystyczny wariant), rozpoznawalna dla mieszkańca, bez logo i bez dosłownej nazwy sieci; zasada ADR-0058 „bez prawdziwych marek” zostaje, bo chroni przed ryzykiem znaków towarowych;
- kolorystyka szyldu nawiązuje do prawdziwej (`brand:colour`, `colour` z OSM albo przypisana ręcznie w tabeli danych), w palecie kitu (ADR-0022) jako neon;
- szyldy i neony z paczki Sketchfab (ADR-0063, paczka 2) zostają z napisami jak dostarczone (fikcyjne), w kolorach paczki sprowadzonych do palety;
- nazwy dla gracza przez katalogi i18n tam, gdzie są słowami (rodzaj lokalu), a nazwy własne 2077 jako dane (jak nazwy autorów w „Autorach”), w jednej tabeli `venue-names` z testem, że żadna nie jest dosłowną nazwą z OSM.
Etap 4 przesuwa się w kolejności przed etapy 2 i 3, zaraz po pracach w toku.

## Uzupełnienie (1.11): dalsze parodie, doprecyzowanie użytkownika
Pierwsza tabela (warianty z doklejką i nazwy o literę od marki) nie przeszła weryfikacji. Użytkownik zdecydował (1.11) „dalsze parodie”:
- **sieci:** gra słów rozpoznawalna dla mieszkańca, ale bez różnicy jednej litery, bez fonetycznie identycznego brzmienia i bez dosłownego słowa z marki (np. BURGER KONG → KRÓL KOTLETA, Pekao → BANK POD ŻUBREM);
- **lokale lokalne:** nowa nazwa 2077 od rodzaju albo miejsca, nie prawdziwa nazwa z doklejką („-BOT”, „-77”, „2077”);
- kolor zbliżony do prawdziwego zostaje;
- test tabeli porównuje nazwy fonetycznie (ph→f, qu→k, v→w, x→ks, c→k poza cz/ch, y→i, bez podwojeń i diakrytyków): sklejona nazwa 2077 nie zawiera sklejonej prawdziwej, a jej słowo nie zawiera słowa prawdziwego i nie różni się od niego o 1 literę (słowa od 4 liter) ani o 2 (od 7 liter). Słowa ogólne rodzaju (bank, apteka, kantor, kawiarnia, pub, kebab…) wolno powtórzyć. Zakaz obejmuje własną nazwę z OSM każdego wiersza, listę sieci, marki z tagów `brand` i ręcznie dopisane brzmienia, których reguły nie łapią (np. Yves Rocher → „Iw Rosze”). Drugi test zakazuje doklejek.
- Druga weryfikacja (1.11) doprecyzowała: parodia sieci to gra słów, nie tłumaczenie marki ani motyw jej logo czy sloganu (złote łuki, syrena, żubr, skarbonka, żaba, lew przy banku, tysiąclecie, bliźnięta, płomień, „roślinne piękno”, król przy burgerach); jedna sieć ma jedną nazwę. Lokale lokalne zachowują nazwy z charakterem z pierwszej rewizji tabeli (np. KLONOWY STÓŁ, KUCHENNY CHAOS, IGŁA I TUSZ); szablony „rodzaj + miejsce” odpadły (decyzja użytkownika z 1.11). Nową nazwę w tym samym stylu dostają tylko lokale, których nazwa była dosłownym tłumaczeniem prawdziwej (np. POD ZĘBEM → OSTRY WIDELEC), i te, które odrzuca uszczelniony test. Test dostał: porównanie całej sklejonej nazwy sieci złożonej z samych słów ogólnych, próg 2 dla słów od 6 liter, wspólny ciąg 5 liter (zdrobnienia, rdzeń marki), odległość 1 i ten sam szkielet spółgłosek dla marek 3-literowych oraz ręczną listę motywów.

## Uzupełnienie (etap 4)
- Widok `building` (`core/ports/types.ts`) dostaje pole opcjonalne i wsteczne `venues` (`BuildingVenue`: `at` względem pozycji budynku jak obrys, `kind` z `VENUE_KINDS`, `name` 2077, `color` z neonów kitu). `core/world/venues.ts` trzyma rodzaje, klucze `venue.kind.*` (słowa w katalogach UI en/pl) i `SIGN_GLYPHS`, litery atlasu szyldów.
- Import (`tools/osm-import/src/venues.ts`) bierze węzły i obrysy z `shop=*` (poza `vacant`) oraz `amenity` restauracji, barów, pubów, kawiarni, lodziarni, klubów, banków, kantorów i aptek. Lokal idzie na własny obrys, na najmniejszy obrys wokół punktu albo na budynek z najbliższą ścianą w promieniu 8 m; jedna nazwa na budynek. `shopPoints` i `namedPoints` zostają bez zmian: lokal nie zmienia kondygnacji, nazwy budynku ani brył, więc złote hashe zostają.
- Nazwy 2077 są w tabeli danych `tools/osm-import/src/venue-names.ts` (nazwa z mapy, nazwa 2077, kolor prawdziwego szyldu), nie w katalogach i18n: szyldy zostają po polsku w obu językach (ADR-0056). Lokal bez nazwy dostaje nazwę generyczną według rodzaju. Test pilnuje zasad z 1.11 (wyżej).
- Kolor: `brand:colour`, potem `colour`, potem tabela, potem rodzaj; zawsze najbliższy odcieniem neon kitu (szarości jako zimna biel `#c9dcf2`).
- Renderer: tablica nad witryną na ścianie od ulicy najbliższej punktu lokalu, litery z atlasu glifów (jeden quad na literę) w siatce szyldów komórki, bez nowych wywołań rysowania. Budynek z lokalami nie dostaje losowych tablic z atlasu. Zabytki (ADR-0062) zostają przy swoich szyldach; na niskiej jakości bez smugi na chodniku, a atlas liter ma 512² zamiast 1024² (jeden kanał na każdej jakości).
