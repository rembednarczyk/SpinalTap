# ADR-0048: Stare Miasto: przejścia w bramach, kryta kładka, szyldy na wysięgnikach, patrole Hebi i Trasa Podziemna

## Kontekst
ADR-0045 przeniósł grę do Lublina i zostawił dla Starego Miasta (`kanal`) listę „do dopracowania”:
- przejścia przez Bramę Krakowską i Bramę Grodzką nie mają wyściółki, w otworze widać wnętrze bryły;
- kryta kładka nad Grodzką to trzy proste bloki;
- teren Hebi jest bez patrolu;
- brak Trasy Podziemnej i lochów Mei (`m4-ulica.ink`).

Plan `docs/world/lublin-street-plan.md` dokłada latarenki ścienne, szyldy na wysięgnikach i ogródki Rynku. Latarenki i ogródki to meble uliczne z ADR-0047 (`street-props`, generator `props.generated.ts`). Szyldy na wysięgnikach to część fasad: narzędzie mebli ich nie rozstawia (obiekty w fasadach).

Ograniczenia: zasady z `CLAUDE.md` (determinizm, granice pakietów, ADR-0031), budżety scen z pomiaru (ADR-0046), zapis zgodny z obecną mechaniką.

## Decyzja

### Kontrakt widoku `building` (`core/ports/types.ts`)
- `passages?: BuildingPassage[]`: przejście przez budynek. Zawiera linię `from`..`to` (może kończyć się wewnątrz), szerokość, podłogę na obu końcach, wysokość wezgłowia (`spring`) i zwornik sklepienia (`crown`). Wysokości są liczone od pozycji encji, jak obrys.
- `soffit?: number`: budynek uniesiony nad ulicą (kładka). Ściany zaczynają się `soffit` metrów nad pozycją, spód zamyka podsufitka.
- `signs?: "bracket"`: szyldy sklepów wiszą na kutych wysięgnikach zamiast tablic i flag z ADR-0044.

### Renderer (`engine/src/renderer/mapcity`)
- `passage-plan.ts`:
  - wyściółka przejścia ze ścianami bocznymi (tynk z kamiennym cokołem) do wezgłowia i sklepieniem kolebkowym z 10 pasów do zwornika;
  - na obu końcach pachy łuku, które zamieniają prostokątny otwór fasady w łuk; przy wylocie w fasadzie dochodzi opaska łuku;
  - każdy pas jest przycięty do obrysu na swoim odsunięciu od osi, więc skośna brama zamyka się dokładnie na swojej ścianie;
  - koniec przejścia wewnątrz budynku zostaje otwarty (dalej idą bloki wnętrza);
  - wyściółka trafia do bliskiej i dalekiej siatki komórki, bez nowych wywołań rysowania.
- Kładka: `map-building.ts` liczy `foot` z `soffit` i zostawia ulicę jako parter. Siatka okien kładki liczy się więc od ulicy (pierwsze piętro, okna świecą nocą), ściany zaczynają się od podsufitki, a pod nimi jest spód z opaską. Gzyms nad parterem pomija się.
- Szyldy na wysięgnikach (`bracket-plan.ts`, P2 `stare-miasto.hanging-shop-signs`):
  - jeden lub dwa na budynek ze sklepami, przy końcu ściany ulicznej, nad parterem;
  - kute żelazo (płyta, ramię, zastrzał, zawijas, wieszaki) należy do bliskiej fasady;
  - okrągła neonowa tarcza z glifem to nowy rodzaj `disc` w shaderze szyldów mapy, w tej samej siatce szyldów komórki, obie strony czytelne wzdłuż ulicy, z odbiciem na bruku;
  - budynek z drzwiami gry albo bramą ma własny szyld gry, bez wysięgnika.

### Treść (`sim/src/content`)
- Bramy (`sites.ts`, `lublin/city.ts`):
  - `GATE_PASSAGES` mają `rise` (wysokość sklepienia pod zwornikiem 4,2 m);
  - `carvedProp` wycina z brył przejścia i prostopadłościany (`BUILDING_CUTS`) i podaje rendererowi przejścia;
  - szerokość otworu w fasadzie to szerokość przejścia podzielona przez kosinus kąta do ściany;
  - kolizja bram bez zmian.
- Budynki chunków `kanal` dostają `signs: "bracket"`.
- Kryta kładka nad Grodzką to budynek mapy w `WORLD_SCENERY` (`KANAL_SCENERY`), nie encja:
  - stoi między hotelem Grodzka 20 a domem „Pod Akacją”, końce wchodzą 0,4 m w domy;
  - ma 3,2 m głębokości, podsufitkę 4,6 m nad ulicą, dwie „kondygnacje” licząc ulicę i dach czterospadowy;
  - styl (tynk, okna, gzyms, dachówka) idzie z `look`, tak jak w fasadach;
  - poza zasięgiem gracza, więc bez bryły; miejsce zlecenia `kanal_bridge` zostaje pod nią.
- Trasa Podziemna (`kanal-underground.ts`). Prawdziwa trasa zaczyna się w Trybunale Koronnym (Rynek 1, OSM `w66264159`), więc ta też. Składa się z:
  - przedsionka ze sklepieniem od północno-zachodnich drzwi Trybunału (przejście z otwartym końcem);
  - hali schodów w dół na wschód (16 stopni, 3,95 m);
  - podestu, korytarza na południe, korytarza na zachód z żebrami sklepienia;
  - lochu, w którym Mei śpiewała za drobne, ze starą sceną, szyldem KARAOKE i skrytką `stash:trasa-podziemna`;
  - neonu TRASA PODZIEMNA nad drzwiami.

  Powłoka to bloki wnętrza z ADR-0038, w osobnym chunku `stare-miasto-trasa-podziemna`, ostatnim w tabeli. Wczytuje się tylko przy Trybunale, a grunt i dystrykt nad nim są dalej z chunka Rynku. Teren pod piwnicami jest wykopany (pad w `PADS`: punkty siatki 5 m x 575..585, z −65..−55, 2 m pod podłogą). Podłogi są płytami, a drapowany bruk Rynku zostaje pod nimi aż do ścian.
- Patrole Hebi (`kanal-patrols.ts`):
  - `hebi-rynek` cały dzień okrąża Trybunał;
  - `hebi-grodzka` (pod kładką), `hebi-bramowa` i `hebi-rynek-noc` (zachodni skraj Rynku) w dzień stoją na posterunkach, a od 21:00 do 5:00 chodzą: Grodzką do stóp Bramy Grodzkiej i z powrotem do Rynku, Bramową od Bramy Krakowskiej do Rynku, Rynkiem w drugą stronę;
  - za dnia chodzi jeden, nocą czterech;
  - każda pętla mieści się w swoich godzinach całkowitą liczbę razy (prędkość około 1,6 m/s dopasowana do długości), więc przy zmianie przystanku patrol jest na początku pętli i nie tnie przez domy;
  - trasy są sprawdzone testem (z dala od ścian i brył gry).
- Reakcje (`GangerAi.patrol`, `ganger-perception.ts`). Patrol uliczny na własnym terenie widzi gracza neutralnego i tylko go obserwuje (`WatchPlayer`, ostrzeżenie). Atakuje jak każdy ganger, gdy:
  - frakcja jest wroga;
  - trwa obława po heat (ADR-0029);
  - przebranie Hebi zostało zdemaskowane (ADR-0033);
  - pada strzał w pobliżu albo trafienie.

  Przebranie Hebi działa jak u innych, egzekutorzy (co trzeci Hebi po kluczu) je przenikają. Patrol jest świadkiem przestępstw (kanał `patrol`). Bez tej zmiany Rynek nocą byłby polem walki: zwykły ganger atakuje neutralnego gracza, a SAKE, KARAOKE i DENKI to miejsca rozmów aktu M4.

### Zapis
Bez zmiany schematu (v15). Plany patroli to funkcje zegara (ADR-0017). Zapis trzyma tylko zwykły stan gangera: pozycję, alarm, ślad. Flaga `patrol` idzie z treści, jak `enforcer`. Test w `kanal-patrols.test.ts` zapisuje grę w środku nocnego patrolu, wczytuje ją i porównuje hash po dalszych krokach.

### Determinizm
Złote hashe w `determinism.test.ts` bez zmian. Wzorcowe przebiegi zostają na Krakowskim i nie wczytują Starego Miasta. Nowe encje Rynku nie są w ich zapisie, a identyfikatory piwnic są zarezerwowane na końcu tabeli.

### Budżety
`rynek-tpp` (Bramowa na Rynek o 21:01): wywołania rysowania / aktywne siatki 204 / 80 → 226 / 86:
- patrol Hebi w kadrze: 4 siatki;
- neon nad drzwiami Trybunału: 2 siatki.

Piwnice w chunku Rynku dawały 262 / 104 (szkielet i lampy rysowane spod bruku), stąd osobny chunk. Budżet 210 / 84 → 232 / 90. Pozostałe sceny i migawka NPR bez zmian.

## Konsekwencje
- Testy:
  - `engine/test/old-town-plan.test.ts`: wyściółka, skośna brama, otwarty koniec, kładka, wysięgniki;
  - `sim/test/kanal-patrols.test.ts`: liczba patroli w dzień i w nocy, trasy, ciągłość, reakcje, zapis;
  - `sim/test/trasa-podziemna.test.ts`: wejście, wykop, przejście do lochu i z powrotem, skrytka, chunk.
- Test rutyny Hideo usuwa patrole przed strzałem na Rynku, bo patrol odpowiada na strzał.
- Latarenki ścienne i ogródki Rynku daje generator mebli (ADR-0047). Ta zmiana ich nie dubluje.

### Przejścia z mapy
Importer (`tools/osm-import/src/passages.ts`) robi przejście z każdej drogi `tunnel=building_passage`, która wchodzi pod budynek i wychodzi z niego po drugiej stronie. Przejście biegnie prosto od wejścia do wyjścia i wystaje 0,6 m za obie fasady. Szerokość bierze z tagu `width`, a bez niego: przejazd (`service`) 3,2 m, deptak 3,4 m, ścieżka 2,4 m. Szersze od 3 m mają 4 m wysokości pod zwornikiem, węższe 3,4 m. Droga, która tylko wchodzi pod budynek (na podwórko, którego obrys nie wycina), przejścia nie dostaje: jej koniec otwierałby się w bryłę.

Chunk ma `passages` z przejściami przez swoje budynki. `PASSAGES` w `sites.ts` dokłada je do bram zrobionych ręcznie i pomija budynki bram. W centrum jest ich 20, m.in. Rybna i Ku Farze na Starym Mieście oraz bramy kamienic przy Krakowskim Przedmieściu. Wcześniej dostawczaki na Rybnej i Ku Farze przejeżdżały przez ściany.

### Do dopracowania
- Wykop pod piwnicami siedzi na siatce 5 m. Przy północno-wschodniej ścianie Trybunału bruk opada do 37 cm, 2 m dalej do 12 cm. Lepsze byłyby piwnice jako „studnia” w polu gruntu albo drobniejsza siatka pod Trybunałem.
- Sklepienie bramy jest gładkie: bez cegieł, żeber i oświetlenia w przejściu. Deszcz pada w przejściu.
- Kładka jest tylko scenografią, nie da się na nią wejść.
- Szyldy na wysięgnikach mają glify z pociągnięć zamiast piktogramów rzemiosł.
- Trasa Podziemna to cztery pomieszczenia pod Trybunałem. Prawdziwa trasa idzie pod kamienicami do Placu po Farze. Brak spotkania i haka `terminal`/`shard`.
- DENKI i KARAOKE dalej bez wnętrz.
- Meble uliczne z ADR-0047 nie są jeszcze w scenografii gry (`WORLD_SCENERY`), tylko w podglądzie.
