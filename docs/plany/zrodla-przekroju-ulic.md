# Źródła przekroju ulic Lublina (zwiad 26.11, ADR-0104)

Decyzja użytkownika z 26.11: geometria ulic ma wynikać z tego, jak ulice opisują źródła, a nie z oceny wzrokowej zdjęcia. Przegląd kuratora próby E2 pokazał oba rodzaje ustaleń:
- **twarde, oparte na danych:** place i parkingi z OSM, przeciek do sąsiedniej dzielnicy, zmierzone odchylenie krawężnika;
- **słabe, z interpretacji zdjęcia:** pasy zieleni na nalocie bez liści, kolor wysepek.

Tutaj jest zestawienie, co które źródło mówi o przekroju ulicy na Krakowskim Przedmieściu (prostokąt x −200…460, z −270…160, 3,2 km ulic z jezdnią).

## OSM (tagi ulic)

| Cecha | Pokrycie długości ulic |
|---|---|
| `width`, `width:carriageway` | 0% |
| `lanes` | 64% |
| jakikolwiek `sidewalk*` | 79% (prawie wyłącznie `separate`) |
| `sidewalk:*:width` | 0% |
| `parking:*` | 0% |
| `verge`, `kerb` (węzły i linie) | 0 |
| `area:highway` (obrysy jezdni) | 0 obszarów jezdni, 2 obszary chodnika |
| place i strefy piesze, parkingi (obszary) | 14 i 39 |
| `footway=sidewalk` | 1,9 km |
| zwykłe `footway` | 7,3 km (część to chodniki ulic, dopasowanie po odległości i kierunku) |
| przejścia (węzły) | 43 |

OSM daje topologię: gdzie są jezdnie, chodniki, przejścia, place i parkingi. Wymiarów przekroju nie daje wcale.

## BDOT10k (GUGiK, bezpłatny, dowolne użycie; paczka `0663_GPKG.zip`, już pobierana przez `tools/gugik`)

- **`OT_SKJZ_L` (jezdnia):**
  - `SZEROKOSCNAWIERZCHNI` dla 73 z 74 jezdni w prostokącie;
  - w całym Lublinie 86% jezdni ma szerokość, zaokrągloną do 0,5–1 m;
  - źródło geometrii w 98,5% to `ortofotomapa`: opracowanie operatorów GUGiK z tych samych nalotów, ale ręczne, według jednych zasad i niezależne od naszej klasyfikacji pokrycia;
  - pole `BDOT500` jest puste.
- **`OT_SKDR_L` (oś drogi):** ma szerokość nawierzchni dla zagregowanych odcinków.
- **`OT_SKRP_L` (ciągi piesze i rowerowe):**
  - `SZEROKOSC` i `MATERIALNAWIERZCHNI` (kostka, płyty, asfalt, bruk);
  - na Krakowskim tylko 23 ciągi biegną wzdłuż ulic, więc BDOT10k nie mapuje chodników ulic;
  - materiał przydaje się do nawierzchni ścieżek i placów.
- **Porównanie z dzisiejszym importem** (58 ulic dopasowanych po punkcie środkowym w promieniu 3 m):
  - 32 zgadzają się co do 1 m, a 17 różni się o 2 m i więcej;
  - BDOT10k szerszy niż import: Kapucyńska 10 wobec 6,5 m, Kołłątaja 10 wobec 6,5, Królewska 9 wobec 6,5;
  - BDOT10k węższy niż tabela pomiaru z ortofoto (ADR-0080 PR 10): Narutowicza 7 wobec 9,2, Radziwiłłowska 7 wobec 9,75, 3 Maja 11 wobec 13–13,5;
  - Świętoduska 3 wobec 9,9 wygląda na złe dopasowanie: do sprawdzenia, zanim liczba pójdzie dalej.

## BDOT500 (mapa zasadnicza, krawężniki)

- Dane wektorowe wydaje odpłatnie starosta, czyli w Lublinie miasto na prawach powiatu; budynki są wyjątkiem.
- Na Geoportalu da się je tylko oglądać jako warstwę WMS „Obiekty topograficzne (BDOT500)”. Odczytywanie geometrii z obrazu WMS byłoby znowu interpretacją obrazu i wymaga sprawdzenia licencji.

## Otwarte dane Lublina

- Miasto ma portal `otwartedane.lublin.eu` i usługę WFS `gis.lublin.eu/opendata/wfs` (m.in. ewidencja gruntów: działki, punkty graniczne).
- Z tego środowiska oba serwery zrywały połączenie przez proxy, więc nie sprawdziłem, czy jest tam coś o jezdniach i chodnikach.
- Do sprawdzenia: lista warstw WFS (GetCapabilities) i wyszukiwanie „krawężnik”, „jezdnia”, „chodnik” w katalogu. Potrzebny dostęp sieciowy do obu hostów albo pliki pobrane przez użytkownika.

## Wnioski dla modelu

1. **Topologia z OSM:** jezdnie, kierunki, pasy ruchu, chodniki osobne, przejścia, place, strefy piesze, parkingi.
2. **Szerokość jezdni:**
   - OSM `width`, jeśli jest (dziś nigdzie);
   - BDOT10k `SZEROKOSCNAWIERZCHNI`;
   - tabela pomiaru z ortofoto (ADR-0080 PR 10) tylko tam, gdzie BDOT10k nie ma wartości albo gdzie różnica wobec niej idzie do przeglądu jako konflikt źródeł;
   - na końcu szacunek z typu ulicy.
3. **Chodnik:**
   - położenie z OSM (`footway=sidewalk`, ścieżki wzdłuż ulicy);
   - szerokość z OSM (`sidewalk:*:width`, dziś nigdzie), dalej z obrysu zmapowanej drogi, a na końcu szacunek;
   - BDOT10k chodników ulic nie daje.
4. **Pasy zieleni, pasy postojowe, wysepki:** OSM i BDOT10k ich nie opisują. Zostają szacunkiem z jawnym oznaczeniem albo regułą z klas pokrycia ortofoto. Nie z oceny kuratora.
5. **Każda wartość w przekroju niesie źródło** (`osm`, `bdot10k`, `ortho`, `mapped-way`, `default`). Raport pochodzenia mówi, ile długości ulic opiera się na szacunku.
