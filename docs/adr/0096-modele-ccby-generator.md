# ADR-0096: Nieużyte modele CC-BY w mieście z deterministycznym generatorem

Status: Przyjęty (20.11, prośba użytkownika: „użyj tych nieużytych modeli w grze, pamiętaj, aby zrobić pod to deterministyczny generator”; decyzje rekomendowane). Etapy osobnymi PR-ami.

## Kontekst
`tools/assets/sources.json` ma 13 źródeł z Sketchfaba (CC-BY 4.0), pobranych i sprawdzonych (sha256), których nie czyta żaden skrypt wypieku. Podgląd brył (20.11) pokazał, co w nich jest:
- **Street Asset Pack** (vmatthew): bariery betonowe (czerwona, szara), barierki metalowe (całe i pogięte), pachołek, beczka, kosz z deskami, dwa worki na śmieci, kartony, kubki, butelki, szkło. Znaki drogowe są amerykańskie (STOP, ustąp pierwszeństwa), więc odpadają.
- **Asian Shop Pack** (abhayexe): ok. 20 witryn sklepów (rama, szyba, drzwi, kaseton) i markizy.
- **Taiwan style Signboard** (Solarliu): ok. 30 szyldów wysięgnikowych na stalowych ramach i wspornikach.
- Pojedyncze: szyld baru (LukeMarsh201), pionowy neon (Alex Bes), szyld LED na wysięgniku (YD Visual), zestaw płaskich neonów do tła (YD Visual), bankomat ścienny (Blender3D), duża antena satelitarna na podeście (Duane's Mind), drzwi ewakuacyjne z ramą i drążkiem (blue man group), robot w pozie T (Doink), mieszkanie (Jiaxing) i sypialnia z neonami (dylanheyes).

## Wzorzec
Ten sam co ADR-0094: generator reguł w `tools/osm-import` (props), kotwice i strefy wolne, stała kolejność kroków, w kroku kolejność z `fnv(klucz)`, bez losowości (CityEngine CGA: reguła na element miasta; „Make It Home”: strefa dostępu, której mebel nie zastawia). Wybór wariantu modelu z hasha miejsca (`propHash(pointSeed)`, jak dziś bankomaty i automaty), więc ten sam stan danych daje te same modele w tych samych miejscach. Modele wypieczone na paletę jak reszta mebli (ADR-0058, ADR-0063): bez nowych wywołań rysowania, wersja na telefon tylko tam, gdzie mebel jest rysowany na `low`.

Różnice: tekstury z napisami (płaskie neony, szyldy z Tajwanu, szyld baru) nie przechodzą przez paletę. Bryła szyldu bierze nazwę lokalu z atlasu nazw gry (ADR-0056 i szyldy lokali), a nie obraz z paczki.

## Decyzja
Reguły (kotwica → co, gdzie, ile):
1. **Zaplecze lokalu** (`fast_food`, `restaurant`, `cafe`, `bar`, `pub` z `venues.ts`): ściana budynku lokalu od podwórza albo boczna, najbliższa jego szyldowi i poza strefami wolnymi wejść (ADR-0094 §2). Przy ścianie 1–3 worki na śmieci, kartony, czasem beczka; liczba i dobór z hasha lokalu. Przy kontenerach (`container`) worki obok.
2. **Budowa** (ADR-0087, ogrodzenie `site-fence`) i jezdnia przy niej: pachołki w odstępie 1,5 m wzdłuż ogrodzenia od strony jezdni, bariery betonowe na rogach ogrodzenia, barierki metalowe przy bramie budowy (`site-gate`); pogięte warianty z hasha, co najwyżej 1 na 4.
3. **Bank i bankomat** (`amenity=bank`, `amenity=atm` w OSM, bez wolnostojącego `atm` z planu): bankomat ścienny na fasadzie budynku banku, dolną krawędzią 0,8 m nad chodnikiem, obok wejścia poza jego strefą wolną.
4. **Dach** (płaski, budynek od 5 kondygnacji): antena satelitarna, co najwyżej jedna na budynek z hasha (ok. 1 na 6 budynków), w narożniku dachu poza nadbudówkami (ADR-0051) i attyką, czaszą na południe.
5. **Szyld wysięgnikowy** lokalu: rama z paczki z Tajwanu, szyld LED albo pionowy neon jako wariant szyldu lokalu (wybór z hasha lokalu, warstwa 2077), z nazwą lokalu z atlasu. Stare Miasto zostaje oszczędne (ADR-0058).
6. **Witryna**: parter sklepu w warstwie 2077 (Lubartowska, Podzamcze, Nabrzeże) dostaje witrynę z Asian Shop Pack dopasowaną do szerokości lokalu; Stare Miasto i Krakowskie bez zmian.
7. **Drzwi ewakuacyjne**: ściana od podwórza budynku usługowego albo handlowego bez wejścia OSM po tej stronie, jedne drzwi na budynek.
8. **Wnętrza i robot**: mieszkanie i sypialnia jako wnętrza (ADR-0061) z planu zadań; robot jako manekin w witrynie kliniki Moriego.

Kontrola: każdy etap ma testy reguł w `tools/osm-import/test` (kotwica, strefy wolne, liczba, determinizm: dwa przebiegi równe) i, gdzie się da, rodzaj skanu glitchy (np. `prop-blocks-entrance` obejmuje nowe meble). Kredyty: każdy model z `credit` w `packages/ui/src/credits/credits.ts` i w README katalogu `city`.

## Etapy
1. Wypiek `tools/city_extras.py` → `extra-props.glb`: modele z 13 źródeł rozcięte na pojedyncze rzeczy, na palecie, do 6 tys. trójkątów (wnętrza i robot z własnym limitem), kredyty, testy pliku.
2. Zaplecza lokali i bankomaty ścienne (reguły 1 i 3); 2b: budowy (reguła 2, kawałki budów powstają w `core`, ADR-0087), z bryłami w symulacji tam, gdzie mebel stoi na chodniku.
3. Anteny na dachach (reguła 4).
4. Szyldy wysięgnikowe (reguła 5).
5. Witryny (reguła 6).
6. Drzwi ewakuacyjne (reguła 7).
7. Wnętrza i robot (reguła 8).

Każdy etap: `pnpm osm:props`, `scan:diff`, przegląd topografii, `npr-perf` (wywołania, siatki, trójkąty telefonu), zrzuty przed i po.

## Konsekwencje
- Więcej drobiazgu w strefach, gdzie gra była pusta (zaplecza, budowy, dachy), zgodnie z zasadami lokacji (trzy warstwy, ślad świeżej obecności).
- Rośnie liczba trójkątów; wywołania rysowania nie, bo modele idą do istniejących siatek bloków.
- `props.generated.ts` i baza skanu zmieniają się w etapach 2–6.

## Wdrożenie etapu 2 (20.11): zaplecza lokali i bankomaty ścienne
- Kontrakt: rodzaj `clutter` w `StreetPropKind` i tabela `CLUTTER_SHAPES` w `core` (`world/clutter.ts`): kształt to dokładnie jeden model `extra-props.glb`, z bryłą albo bez (kosz z deskami i beczka mają bryłę, worki, kartony, butelka, kubek i bankomat w ścianie nie). Symulacja trzyma własną kopię brył (`CLUTTER_SOLIDS`, importer czyta ten plik bez indeksu `core`), test pilnuje zgodności.
- Generator `tools/osm-import/src/props-clutter.ts` (po budkach z jedzeniem w `props-gen.ts`, `from` = `rule.venue-clutter`): lokal z kuchnią (restauracja, kawiarnia, fast food, bar, pub), pierwszy szyld, prosto od drzwi przez budynek i rząd za nim do 40 m, do pierwszego wolnego gruntu; tam 2–4 rzeczy w odstępach 0,8 m, 0,5 m od muru, obrót z hasha do ±0,6 rad. Każda na wolnym gruncie także 0,3 m dookoła, poza ścieżkami, strefami wejść, bryłami i 4 m od osi każdej ulicy, także uliczek dla pieszych i stref zamieszkania (bez tego 25 rzeczy wychodziło przez budynek na Jezuicką, Przechodnią, Szambelańską i Bernardyńską). Bankomat: 0,9 m za końcem szyldu banku, 0,12 m od muru, mur za nim i wolny chodnik przed nim, strona z hasha.
- Wynik na mapie: 210 rzeczy (201 na zapleczach ok. 70 lokali, 9 bankomatów na 13 banków; jeden w Starym Mieście, na budynku z bankiem w OSM).
- Renderer: `clutter-models.ts` piecze tylko modele z pliku (bez zastępnika w mieście), telefon (`low`) tylko bankomaty. Kolejność i warianty bez losowości: lokale po `fnv(nazwa)`, mieszanka i obrót z `fnv` nazwy.

## Wdrożenie etapu 2b (21.11): pachołki i bariery przy budowach
- Wzorzec: tymczasowa organizacja ruchu przy robotach drogowych (niemieckie RSA, brytyjski Chapter 8: rząd pachołków wzdłuż robót, bariery na końcach, barierki kierujące przy wjeździe), zawężona do tego, czego potrzebuje ogrodzenie budowy przy chodniku.
- Kontrakt: siedem nowych kształtów `clutter` w `CLUTTER_SHAPES` (`core`): pachołek, bariera betonowa, czerwona, dwie barierki metalowe, każda cała i pogięta, wszystkie z bryłą ciała (bez rozstawionych stóp). `SITE_CLUTTER_FROM` = 9: telefon rysuje te kształty, bo są bryłami na chodniku.
- Generator `tools/osm-import/src/construction-barriers.ts` (krok 8 `planSite`, po wszystkich losowaniach strumienia budowy, więc jej wygląd się nie zmienia): strona od ulicy to bok ogrodzenia z jezdnią do 7 m, która przybliża się, gdy odejść od płotu (boki dochodzące do ulicy się nie liczą). Barierki przy bramie po obu stronach otworu, po stronie tablicy za tablicą, dłuższa tam, gdzie się mieści; bariera na każdym rogu tej strony (co trzecia czerwona, z hasha); pachołki co 1,5 m między nimi. Każda rzecz w całości na poboczu (`SiteGround.verge`: chodnik, trawa, goły grunt i pas przed fasadą, nigdy jezdnia), w obrębie swojego boku ogrodzenia, środkiem o połowę głębokości modelu od płotu, z 1,2 m wolnego gruntu za sobą. Pogięte barierki z hasha, w teście 200 budów poniżej jednej na trzy.
- Wynik na mapie: z 6 budów tylko Zielona 5A ma bok od jezdni z poboczem: 11 pachołków, czerwona bariera na rogu i długa barierka przy bramie (13 rzeczy). Pozostałe budowy stoją w podwórzach albo przy pieszych ciągach.

## Wdrożenie etapu 6 (20.11): drzwi ewakuacyjne
- Kontrakt: model `exit` w `DOOR_MODELS` (`core`, `world/doors.ts`), siódma wartość trzybitowego pola modelu drzwi; zapis i symulacja bez zmian, bo drzwi są elementem fasady bez bryły.
- Reguła 4 w `tools/osm-import/src/props-doors.ts` (`exitDoors`, po drzwiach klatek): budynek usługowy albo przemysłowy (`commercial`, `industrial`), ściany od 4 m od najdłuższej, pierwsza, która nie patrzy na ulicę (`facesStreet`) i nie ma jeszcze drzwi; drzwi w slocie najbliżej środka ściany (`DoorRules.fit`, te same strefy wolne co inne drzwi), jedne na budynek, `from` = budynek.
- Wynik na mapie: 35 drzwi (doki 4, kanał 7, Shinsekai-7 9, Targ 15); Stare Miasto bez zmian, bo nie ma tam takich budynków z tylną ścianą od podwórza.
- Renderer: skrzydło `door-exit` z `extra-props.glb` (dwa stalowe skrzydła z poręczą antypaniczną), proceduralny zastępnik w `prop-door.ts` dla telefonu i przed wczytaniem pliku.
## Wdrożenie etapu 4 (21.11): obudowy szyldów wysięgnikowych
- Szyld wysięgnikowy z atlasu (warstwa 2077, budynki bez lokali z OSM) był dotąd samym świecącym prostokątem w powietrzu. Teraz wisi w obudowie z paczek: rama tablicy z Tajwanu (board02, proporcje tablicy 1:3,15 jak szyld z atlasu, podpora do ściany pod spodem), wąska rama (board13, odciąg w górę po ścianie) albo skrzynka szyldu LED na dwóch ramionach. Wybór z ziarna szyldu (trzecie losowanie szyldu), światło leży na tablicy obudowy, a nie w powietrzu.
- Wzorzec: rozdzielenie planu od rysowania (czysta funkcja planu, jak `bracketSpots` szyldów Starego Miasta): `shopSignPlan` odtwarza losowania szyldów budynku w tej samej kolejności, `planBuildingSigns` rysuje z niego światło, a fasada (`planBladeHousings`) stawia obudowę jako slot (`facade-props.ts`). Miejsce sprawdza `clearSpotFrom` dla całej obudowy (od ściany do jej końca, od dołu podpory).
- Wymiary tablic zmierzone na modelach źródłowych (`blade-housings.ts`), test sprawdza je na wypieczonym pliku: rozmiar, płytki przy ścianie, nic nie wystaje przez światło. Tablice obudów wypiekane na ciemno (bez napisów paczki); napis daje atlas gry.
- Telefon dostaje obudowy (światło bez obudowy byłoby bryłą zastępczą), 156–204 trójkątów na szyld. Przed wczytaniem pliku zostaje samo światło, jak dotąd.
- W Krakowskim 10 szyldów wysięgnikowych z atlasu (4 ramy, 2 wąskie, 4 LED); reszta budynków ma szyldy lokali (ADR-0064).
