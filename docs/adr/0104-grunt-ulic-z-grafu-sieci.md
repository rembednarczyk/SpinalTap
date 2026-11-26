# ADR-0104: Grunt ulic z grafu sieci: jezdnie, skrzyżowania i chodniki z jednej geometrii

Status: Przyjęty (26.11, decyzja użytkownika: „tak, przygotuj ADR nowego modelu i ulic oraz od razu zabieramy się za implementację”). Kontynuuje ADR-0080 (przekrój ulicy, niezrealizowany PR 7 „przekrój zamiast łatek”) i korzysta z ADR-0078 (Clipper2, podział płaszczyzny). Dotyczy ADR-0042 (import OSM i NMT), ADR-0077 (pokrycie z danych) i ADR-0054 (glitche). Stan kodu: `origin/main` 1ddfb97.

## Kontekst

**Jak dziś powstaje ulica.** Nawierzchnię składa ciąg etapów w `tools/osm-import/src`, w którym każdy poprawia kształty poprzedniego:

1. `lineBands` (`ground.ts`, `line-buffer.ts`): jezdnia i chodnik z tagów jako osobne bufory tej samej osi, `footway=sidewalk` jako bufor własnej osi.
2. `cutSidewalk` (`ground.ts`): chodnik próbkowany co 0,5 m i ucinany prostopadle do własnej osi tam, gdzie środek wchodzi na cudzą jezdnię.
3. `kerbFills` i `kerb-widen.ts`: od krawędzi jezdni marsz co 0,5 m wzdłuż i 0,2 m w poprzek do najbliższej nawierzchni; jezdnia poszerzana albo pas dokładany jako chodnik.
4. `roundJoints`, łaty szczelin, `laidZebras` i `stretchZebras`: domykanie styków i dopasowanie zebr do krawężników.
5. `chunkGround`: przycięcie do chunka, zaokrąglenie do 0,1 m i uproszczenie.
6. `bare-cover.ts`: raster ortofoto w komórkach 0,5 m wypełnia goły teren trawą, placem i (od kroku 1 jednolitości) chodnikiem.
7. `partitionGround`: nakładki rozstrzyga ranga powierzchni (asfalt wygrywa).

Każdy etap próbkuje albo zaokrągla po swojemu i dostaje od poprzedniego kształty już z ząbkami. Bazy skanu na main: `ground-strip-gap` 1378, `landuse-bare` 717, `kerb-gap-bare` 692, `sidewalk-surface-patch` 541, `sidewalk-gap` 416, `sidewalk-step` 410, `bare-on-cover` 375, `sidewalk-width-jump` 233, `kerb-fill-flicker` 72, `kerb-jag` 17.

Poprawki przesuwają problem. Dwa przykłady z 26.11:

- **Krok 1 jednolitości chodników.** Wypełnienie przy jezdni jako chodnik dało −200 łat nawierzchni. Jednocześnie odsłoniło 14 nowych zębów krawężnika (G-980) i zepsuło naprawione miejsce G-837 przy zebrze na Łęczyńskiej. Przyczyną był klin poszerzonej jezdni dochodzący do prostopadle uciętego końca chodnika.
- **Koniec chodnika dociągnięty pod asfalt** (gałąź `fix/koniec-chodnika-przy-jezdni`, pomiar). Dało −13 `kerb-gap-bare` i −21 `ground-strip-gap`, ale 59 nowych miejsc w 13 rodzajach.

ADR-0080 opisał właściwy model przekroju i w PR 7 zapowiedział zastąpienie łatek. Zrobione są PR 5 (`street-section.ts` odtwarzający dzisiejsze pasy bajt w bajt) i PR 6 (podział płaszczyzny). PR 7 nie powstał, a każda nowa reguła gruntu dokłada kolejną warstwę łatek.

## Wzorce

- **Kształty ulic z grafu sieci.** Wzorzec z CityEngine (Parish i Müller, „Procedural Modeling of Cities”, SIGGRAPH 2001; „street shapes” w CityEngine) i z generatorów z OSM: OSM2World, Streets GL.
  - Sieć dróg jest grafem: węzły to skrzyżowania i końce, krawędzie to odcinki między nimi.
  - Jezdnia odcinka to wstęga wokół osi o szerokościach z przekroju.
  - Skrzyżowanie to osobny wielokąt sklejony z wchodzących wstęg.
  - Chodnik to pas odsunięty od krawędzi jezdni.
- **Zaokrąglenie narożnika krawężnika domknięciem morfologicznym:** dylatacja o r, potem erozja o r (closing, Serra 1982; `inflatePaths` w Clipper2). Wklęsłe narożniki dostają łuk o promieniu r, wypukłe zostają.
- **Wspólna granica liczona raz:** podział płaszczyzny (planar partition, jak `ST_Difference` w PostGIS). Chodnik to `odsunięcie(jezdnia) − jezdnia`, więc krawężnik jest z definicji tą samą linią po obu stronach, bez szczeliny i zakładki.
- **Migracja: strangler fig** (Fowler, 2004). Nowy generator działa obok starego dzielnica po dzielnicy, skan glitchy jest wyrocznią porównania, a stare etapy znikają, gdy żadna dzielnica ich nie używa.

**Różnice wobec wzorców i dlaczego:**

- Nie budujemy pełnej topologii ścian i półkrawędzi (DCEL). Wystarczają operacje logiczne Clippera na całych warstwach, a wyjście gry (`GroundOut`) to i tak zbiór obrysów.
- Narożniki zaokrąglamy domknięciem tylko w kole wokół węzła skrzyżowania. Globalne domknięcie skleiłoby dwie jezdnie drogi dwujezdniowej rozdzielone pasem węższym niż 2r.
- Szerokości dalej daje przekrój z ADR-0080 (OSM, ortofoto, zmapowany chodnik, domyślne). Ten ADR zmienia geometrię, a źródła szerokości zostają.

## Decyzja

### 1. Model

Moduł `tools/osm-import/src/streets/`, czysta geometria bez wiedzy o chunkach i tablicach:

```ts
interface StreetEdge {
  readonly way: string;                 // droga OSM (źródło pasm)
  readonly axis: readonly Pt[];         // oś jezdni po toAbutments/overTunnels/fitLanes
  readonly left: number;                // m, od osi do krawężnika po lewej
  readonly right: number;               // m, po prawej
  readonly walkLeft: number;            // m szerokości chodnika po lewej, 0: brak
  readonly walkRight: number;
  readonly kerbRadius: number;          // promień narożnika na skrzyżowaniach tej ulicy
}
interface StreetGround {
  readonly carriageway: readonly Pt[][]; // obszar jezdni: suma wstęg i skrzyżowań, z narożnikami
  readonly sidewalks: readonly Pt[][];   // odsunięcie − jezdnia − budynki
  readonly crossings: readonly Pt[][];   // zebry: prostokąt w węźle przejścia ∩ jezdnia
}
```

Kroki budowy:

1. **Węzły skrzyżowań** to punkty wspólne co najmniej dwóch osi jezdni (ten sam węzeł OSM daje ten sam punkt świata).
2. **Wstęga odcinka** to pas od `offset(oś, +left)` do `offset(oś, −right)` (Clipper, łączenia okrągłe, końce proste). Jezdnia C to suma wstęg.
3. **Narożniki:** C ∪ (domknięcie(C, r) ∩ koło(węzeł, R)) dla każdego węzła skrzyżowania. R to największa półszerokość wchodzących ulic plus r plus 1 m zapasu.
4. **Chodnik:**
   - S = suma po stronach z chodnikiem: dylatacja wstęgi tej strony o szerokość chodnika (łączenia okrągłe, więc zawija narożnik), minus C, minus budynki.
   - Krawężnik to brzeg C wspólny z S.
5. **Zebra:** prostokąt w węźle przejścia, w poprzek osi, dłuższy od jezdni, przecięty z C. Pasuje do krawężnika z konstrukcji.
6. **Wyjście:** pasma `road`, `sidewalk` i `crossing` o źródle drogi OSM, w tym samym formacie co dziś. `chunkGround`, `partitionGround`, rozstawienie mebli, ruch i renderer czytają je bez zmian. Ruch i pasy dostają półszerokości z C (ADR-0080 PR 3).

**Co zastępuje:**
- dla ulic z grafu: `cutSidewalk`, `kerbFills` z `kerb-widen.ts`, `roundJoints` jezdni i chodników, `stretchZebras` i dopasowanie w `laidZebras`;
- osobne pasma `footway=sidewalk` wzdłuż ulic: wyznaczają szerokość chodnika (źródło `mapped-way`), ale nie są osobnym kawałkiem.

**Co zostaje:**
- place i strefy piesze z obrysów (podział płaszczyzny);
- ścieżki z dala od ulic;
- schody, mosty i pomosty (ADR-0053; przekrój na pomoście jeden, w jednym poziomie);
- tory;
- trawniki i wypełnienia z ortofoto, te ostatnie tylko we wnętrzach kwartałów: po etapie E5 kwartał to to, co zostaje po C i S.

### 2. Dzielnice i przełączanie

- Lista `STREET_GRAPH_DISTRICTS` w `config.ts` mówi, które dzielnice dostają ulice z grafu. Pozostałe idą starą drogą bez zmian.
- Pierwsza dzielnica to Krakowskie Przedmieście: najwięcej łat i zębów, sieć z placami i deptakiem.
- Stare Miasto ma bruk i granit zamiast płyt (`SETT_DISTRICTS`), więc idzie na końcu, z nawierzchnią chodnika z reguł dzielnicy (`sidewalk-rules.ts`).

### 3. Miary przyjęcia (skan jako wyrocznia)

Dla dzielnicy przełączanej na graf, wobec main w tej samej dzielnicy:

- **Spadek o co najmniej 80%:**
  - `kerb-jag`;
  - `kerb-gap-bare`;
  - `ground-strip-gap` przy jezdniach;
  - `sidewalk-gap`;
  - `sidewalk-step` i `sidewalk-surface-patch` wzdłuż ulic.
- **Brak nowych miejsc:**
  - `lane-off-ground`;
  - `car-lane-off-road`;
  - `walk-blocked`;
  - `furniture-in-car-lane`;
  - `lamp-on-orto-carriageway`.
- **Krawędź jezdni wobec ortofoto** (przegląd `topography-curator`, jak przy G-837): średnie odchylenie nie gorsze niż dziś.
- **Testy jednostkowe modułu:** skrzyżowania T, X, skośne 30°, łuk, ulica jednostronna, droga dwujezdniowa z pasem 2 m.
  - Zero zębów krawężnika powyżej 0,1 m.
  - Zero szczelin i zakładek między C i S.
  - Promień narożnika co najmniej r − 0,1 m.
  - Dwie jezdnie drogi dwujezdniowej rozdzielone.

### 4. Kolejność źródeł i rola kuratora (decyzja użytkownika 26.11 po przeglądzie E2)

Geometria ulicy wynika z tego, jak ulicę opisują źródła, a nie z oceny wzrokowej ortofoto. Wzorzec: łączenie źródeł z jawnym pierwszeństwem i zapisem pochodzenia (conflation, source priority, data provenance; jak w OSM2World i w konflacji danych GIS, np. Hootenanny). Zwiad i liczby dla Krakowskiego: `docs/plany/zrodla-przekroju-ulic.md`.

| Cecha | Kolejność źródeł |
|---|---|
| Topologia: jezdnie, kierunki, pasy ruchu, przejścia, chodniki osobne, place, strefy piesze, parkingi | OSM |
| Szerokość jezdni | OSM `width` → BDOT10k `OT_SKJZ_L.SZEROKOSCNAWIERZCHNI` → tabela pomiaru z ortofoto (ADR-0080 PR 10) → szacunek z typu |
| Położenie i szerokość chodnika | OSM `sidewalk:*:width` → obrys zmapowanej drogi (`footway=sidewalk`, ścieżka wzdłuż ulicy) → szacunek |
| Pas zieleni, pas postojowy, wysepka | OSM (`verge`, `parking:*`, obszary) → reguła z klas pokrycia ortofoto → szacunek |
| Nawierzchnia ścieżek i placów | OSM `surface` → BDOT10k `MATERIALNAWIERZCHNI` |

- **Pochodzenie:** każda wartość przekroju niesie źródło (`osm`, `bdot10k`, `ortho`, `mapped-way`, `default`). Raport pochodzenia mówi, ile długości ulic opiera się na szacunku. Miarą przyjęcia dzielnicy w E3 jest też spadek udziału szacunków.
- **Konflikt źródeł:** dwa źródła różniące się o więcej niż 1 m to wpis do przeglądu, a nie wybór „co wygląda lepiej”. Przykład: BDOT10k i tabela ortofoto na Narutowicza mają 7 i 9,2 m.
- **Kurator topografii** sprawdza zgodność geometrii z danymi (tag, wartość zbioru, zmierzona liczba) i zgłasza konflikty źródeł jako wiersze T albo glitche. Ortofoto służy mu do stawiania pytań, a werdykt bez wskazania danej nie wiąże.
- **Źródła niedostępne dziś:**
  - BDOT500 (krawężniki): wektor płatny u starosty;
  - otwarte dane Lublina (`otwartedane.lublin.eu`, `gis.lublin.eu/opendata/wfs`): z tego środowiska niesprawdzone.

  Gdy któreś z nich wejdzie, staje przed BDOT10k dla położenia krawężnika.

## Plan (osobne PR-y)

| Etap | Zakres | Wynik mierzalny |
|---|---|---|
| E1 | Moduł `streets/`: graf, wstęgi, narożniki, chodnik, zebry; testy syntetyczne | testy z punktu 3 zielone; brak zmian w tablicach |
| E2 | Prototyp na Krakowskim Przedmieściu bez zapisu tablic: raport porównawczy skanu stare/nowe i rzuty z góry miejsc z bazy `kerb-jag`, `kerb-gap-bare`, `sidewalk-*` | raport w `docs/plany/`; decyzja o E3 na liczbach |
| E3 | Podłączenie za `STREET_GRAPH_DISTRICTS` = Krakowskie; stare etapy wyłączone dla ulic tej dzielnicy; ruch i pasy z C; baza skanu; kurator | miary z punktu 3; T-wiersz w `docs/topografia.md` |
| E4 | Podzamcze i Nabrzeże, potem Stare Miasto z brukiem | te same miary w każdej dzielnicy |
| E5 | Wypełnienia ortofoto tylko we wnętrzach kwartałów (kwartał = reszta po C i S); ortofoto wybiera nawierzchnię, nie kształt | `landuse-bare`, `bare-on-cover`, `fill-*` w dół bez nowych miejsc |
| E6 | Usunięcie starych etapów i kontroli bez przedmiotu (`kerb-fill-wide-estimated`, `kerb-fill-flicker`), zapadka `code-health` | ok. −1000 linii w `tools/osm-import` |

## Konsekwencje

- Gałęzie kroków 1 i 2 jednolitości chodników (`fix/chodnik-pas-przy-krawezniku`, `fix/chodnik-sciezki-przy-ulicy`) oraz pomiar `fix/koniec-chodnika-przy-jezdni` nie idą do main. Zostają jako źródło reguł:
  - dzielnice z brukiem;
  - ścieżka przy placu zostaje placem;
  - wypełnienie przy ulicy jest chodnikiem;
  - dopasowanie ścieżek do ulic po odległości i kierunku jako źródło `mapped-way`.
- Do E3 nie przyjmujemy nowych łatek gruntu przy ulicach poza glitchami S1–S2.
- Tablice dzielnicy zmieniają się w E3 w całości. Przegląd kuratora porównuje rzuty i ortofoto, a nie diff linii.
- Złoty hash podłogi testowej się nie zmienia, bo podłoga to mały świat poza miastem.

## Ryzyka i jak je mierzyć

- **Ruch i pasy** czytają półszerokości jezdni. Inna krawędź C może zepchnąć pas z asfaltu. Miara: `lane-off-ground`, `car-lane-off-road` i testy `traffic-junction-*` bez nowych kolizji.
- **Meble i drzewa** stoją dziś względem krawężnika z `kerbFills`. Miara: `furniture-in-car-lane`, `lamp-on-orto-carriageway` i przegląd kuratora przesunięć powyżej 0,5 m.
- **Szerokości domyślne** (ok. 45% długości ulic po PR 10) dają krawężnik w złym miejscu wobec ortofoto. Model tego nie pogarsza, ale też nie naprawia. Naprawa idzie przez źródła szerokości (ADR-0080 PR 10).
- **Czas budowy:** operacje logiczne na całej dzielnicy. Miara: czas `osm:build` w CI, który dziś wynosi ok. 40 s; dopuszczamy do +20%.
