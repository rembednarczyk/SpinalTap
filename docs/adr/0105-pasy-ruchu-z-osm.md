# ADR-0105: Liczba pasów ulicy jednokierunkowej z OSM, nie z szerokości

Status: Przyjęty (26.11, decyzja użytkownika: „z OSM”). Dotyczy ADR-0050 (ruch uliczny), ADR-0080 (przekrój ulicy, połówki jezdni) i ADR-0104 pkt 4 (szerokość jezdni z BDOT10k).

## Kontekst

Ulica jednokierunkowa dostawała w symulacji dwa pasy, gdy połówki jezdni w 90% jej długości miały co najmniej 2,6 m (`lanesOf`, `traffic.ts`), czyli wyłącznie z szerokości. Przy szerokościach z importu, szacowanych i nierównych, wąskie odcinki często ograniczały ulicę do jednego pasa. Jezdnia z BDOT10k (ADR-0104 pkt 4) ma jednak równą szerokość. Peowiaków dostaje z niej 5,7 m (połowy 2,85 m), więc reguła stawiała dwa pasy po ±1,6 m od osi. Prawy pas wchodził w strefę zmapowanego pasa postojowego (`parking=street_side`, w471191535) i auta przestawały tam parkować. W rzeczywistości Peowiaków ma jeden pas ruchu i parkowanie, a OSM nie podaje dla niej `lanes` (jest `lane_markings=no`).

## Decyzja

1. **Liczba pasów z mapy.** Import zapisuje w treści ulicy (`StreetOut.lanes`) tag `lanes` ulicy jednokierunkowej, gdy wynosi co najmniej 2. Bez tagu ulica jednokierunkowa ma jeden pas, zgodnie z konwencją OSM dla `oneway=yes` (wiki OSM, Key:lanes: brak tagu przy jednokierunkowej to jeden pas).
2. **Szerokość tylko ogranicza.** Dwa pasy symulacja kładzie tam, gdzie OSM je podaje i jezdnia sięga za oba prawie na całej długości (próg 2,6 m na połówkę bez zmian). Jezdnia drogi dwujezdniowej zmapowana jako dwukierunkowa (rozpoznawana `isCarriageway`) zostaje przy regule z szerokości, bo bez `oneway` tag `lanes` liczy oba kierunki.
3. **Łańcuch ulic** (`ROAD_CHAINS`) bierze liczbę pasów, którą tagują kawałki stanowiące większość jego długości. Przy remisie bierze mniejszą.
4. **Jeden pas obok pasa postojowego w jezdni** (dopisane 26.11 wieczorem, `traffic-parking.ts`). Gdy osobno zmapowany pas postojowy (`amenity=parking` z `parking=street_side`, `lane` albo `half_on_kerb`) wchodzi w jezdnię, jedyny pas ruchu biegnie środkiem części, którą pas postojowy zostawia: krawędź pasa postojowego to mediana jego wewnętrznych krawędzi wzdłuż ulicy, jedno przesunięcie na ulicę, ograniczone tak, by auto nie wyjechało za krawężnik. Pas postojowy za krawężnikiem niczego nie przesuwa. Powód: BDOT10k mierzy jezdnię od krawężnika do krawężnika razem z miejscami postojowymi (Peowiaków 5,7 m), więc pas na osi wchodził na miejsca w471191535 i auta tam nie parkowały.

Wzorzec: odczyt atrybutów z danych źródłowych według przyjętej konwencji domyślnej (OSM Key:lanes: „lanes” liczy pasy ruchu bez pasów postojowych, a ich brak przy `oneway=yes` oznacza jeden). Różnica wobec konwencji: tag `lanes` większy niż 2 dla ulicy jednokierunkowej symulacja kładzie jako dwa pasy, bo `lanesOf` zna najwyżej dwa obok siebie.

Wzorzec punktu 4: schemat OSM parkowania przy ulicy (wiki OSM „Street parking”: pas postojowy jako osobny obszar `amenity=parking` + `parking=street_side|lane`) i podział przekroju jezdni na pas postojowy i pas ruchu, jak w narzędziach projektowania przekroju ulic. Różnica: jedno przesunięcie na całą ulicę zamiast zmiennego wzdłuż niej, bo pas ruchu ma biec prosto, a pas postojowy na krótkim odcinku nie powinien go wyginać.

## Skutki

- Na main jednokierunkowe ulice tagowane `lanes` ≥ 2 zachowują dwa pasy: Aleja Tysiąclecia, Turystyczna, Mełgiewska, Lubartowska, Andersa, Podzamcze, Graf, 3 Maja, Lwowska, Ruska, ronda, Bajkowskiego. Jeden pas zamiast dwóch dostaje 11 wąskich ulic Starego Miasta i Podzamcza bez tagu: Kowalska, Furmańska, Cyrulicza, Podwale, Plac Zamkowy, Cerkiewna, Nowy Plac Targowy, Targowa, Probostwo, Nadstawna i Czwartek.
- `lane-dead-end`: 11 miejsc ubywa, przybywa 7. To przesunięte końce tych samych pasów, które leżą teraz na osi ulicy, a nie na pasie bocznym.
- Testy skrzyżowań: południowa jezdnia Furmańskiej skręca w prawo w jednopasową Cyruliczę, a północna kończy się przed łukami. Skręty obok siebie sprawdza test na pasach w dawnym układzie (dwie jezdnie po dwa pasy).
- Złoty hash podłogi testowej bez zmian.
- Punkt 4 przesuwa jedyny pas trzech ulic: Peowiaków o 0,75 m od pasa postojowego (na próbnych tablicach z grafem 0,9 m), Kowalskiej o 0,38 m i Probostwa o 1,28 m. `lane-dead-end`: trzy miejsca przesunięte o 1 do 2 m razem z pasem (przyjęte świadomie).
