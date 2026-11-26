# ADR-0104 E2: próba grafu ulic na Krakowskim Przedmieściu (26.11)

Próbna budowa `SEKI_STREET_GRAPH=krakowskie pnpm osm:build && pnpm osm:props`, potem skan glitchy z `GLITCH_BASELINE=accept` i porównanie baz z `origin/main` po dzielnicach. Tablice w repozytorium bez zmian, bo `STREET_GRAPH_DISTRICTS` jest puste. Kod jest na gałęzi `feat/grunt-z-grafu-ulic-e2`. Budowa całego miasta trwa 9–11 s, tak jak przed zmianą.

## Wyniki (Krakowskie, main → graf, wersja 6)

| Rodzaj | main | graf | Ocena |
|---|---|---|---|
| sidewalk-surface-patch | 169 | 60 | −64% |
| ground-strip-gap | 288 | 213 | −26% |
| kerb-gap-bare | 222 | 161 | −27% |
| sidewalk-gap | 118 | 87 | −26% |
| kerb-strip-bare | 14 | 1 | −93% |
| crossing-shape-kerb | 17 | 12 | −29% |
| kerb-fill-flicker | 11 | 7 | −36% |
| landuse-bare | 253 | 245 | −3% |
| bare-on-cover | 130 | 120 | −8% |
| sidewalk-step | 154 | 153 | bez zmian |
| sidewalk-width-jump | 88 | 91 | +3 |
| kerb-jag | 3 | 8 | +5 (4 z nich 0,11–0,15 m, 1 0,68 m) |
| ground-ring-self-cross | 0 | 5 | małe kawałki chodnika |
| bus-stop-on-fill | 0 | 2 | zatoki przystanków |
| kerb-fill-wide-estimated | 35 | 276 | kontrola starego modelu (niżej) |
| lane-off-ground, car-lane-off-road, furniture-in-car-lane, walk-blocked, fill-on-green | | | bez nowych miejsc |

Przebieg wersji: v1 bez ścieżek wzdłuż ulic (`kerb-gap-bare` 222 → 268, gorzej niż main); v2 z dopasowaniem ścieżek (`mapped-way`); v3 z domknięciem szczelin do 3 m (najlepsze liczby, 62 samoprzecięcia); v4 z asfaltem do zmapowanego chodnika po stronie szacowanej (G-570); v5 z pasami zieleni; v6 z domknięciem tylko do nawierzchni.

## Co działa

- Skrzyżowania mają jeden gładki krawężnik z łukiem. Znikają kliny poszerzeń (G-845) i ząbki zebr.
- Ścieżki biegnące wzdłuż ulicy (także bez `footway=sidewalk`) stają się chodnikiem ulicy. Łaty nawierzchni spadają o dwie trzecie.
- Pasy ruchu, meble i przejścia bez nowych miejsc, bo jezdnie z grafu zachowują `kerb`.

## Co do zrobienia przed E3

1. **Pierścienie chodnika wokół małych wysepek** (np. 185; 85): chodniki zawinięte w narożnikach trzech ulic plus domknięcie szczelin dają chodnik w kształcie pierścienia z gołą dziurą w środku. Wysepkę trzeba brać w całości: chodnik, plac albo zieleń z ortofoto.
2. **`kerb-fill-wide-estimated`**: około 38 tys. próbek w mieście, głównie w narożnikach, 4–7 m szerokości i ok. 10 m od osi. Kontrola uznaje za wyjaśniony tylko chodnik z prostych pasm `lineBands`, więc chodnik zawinięty wokół narożnika liczy jako „wypełnienie”. Zamiar G-570 (asfalt zatoki i pasa postojowego nie może być chodnikiem) zachowuje reguła poszerzenia po stronie szacowanej. Kontrolę trzeba przepisać na model przekroju albo usunąć (ADR, E6) przed przyjęciem bazy w E3.
3. **Zęby krawężnika +5 i samoprzecięcia 5:** na stykach kawałków jednej jezdni po podziale płaszczyzny i przy zebrach dopasowywanych jeszcze starym `laidZebras`. Zebry z modelu (`zebraOf`) jeszcze nie są podłączone.
4. **Zatoki przystanków (`bus-stop-on-fill` 2):** zatoka do asfaltu, jak w G-570.
5. **Promień narożnika:** 3/4 m zamiast 6 m z ADR-0080. Przy ostrych kątach 6 m zalewało 15–22 m narożnika. Do potwierdzenia przez kuratora na ortofoto.
6. Przegląd `topography-curator` rzutów wobec ortofoto przed E3.

## Runda 2 (wersje 7–18, 26.11 po południu)

Zmiany:
- **Wysepki do 400 m²**, zamknięte gruntem wokół ulicy: zieleń albo chodnik według ortofoto. Wcześniej był tam pierścień chodnika z gołą dziurą.
- **Pas zieleni (`verge` z ADR-0080)** w przekroju: z ortofoto albo zmapowanego trawnika. Chodnik leży za nim, a sam pas zostaje regule gołego terenu.
- **Szczelina do zmapowanego chodnika:** ponad 3 m albo zielona to pas zieleni. Wcześniej ulica w356402586 dostała krawężnik 10 m od osi.
- **Narożniki:** domknięcie tylko ulic danego węzła. Druga jezdnia drogi dwujezdniowej obok węzła zalewała pas rozdziału (test na pas 3 m).
- **Pas rozdziału:** strona bez tagów z inną jezdnią do 6 m za krawężnikiem nie dostaje domyślnego chodnika.
- **Włosy:** chodnik odcięty od schodów, torów i basenów; pierścienie cieńsze niż 0,2 m odrzucone. Odejmowanie starych prostokątów zebr i jezdni spoza grafu (wersje 9–14) zostawiało dziury i szczeliny, więc z niego zrezygnowałem.
- **Kontrola `kerb-fill-wide-estimated`** nie próbkuje dzielnic z grafu.

| Rodzaj | main | v8 | v13 | v18 |
|---|---|---|---|---|
| sidewalk-surface-patch | 169 | 57 | 57 | 76 |
| ground-strip-gap | 288 | 175 | 195 | 229 |
| kerb-gap-bare | 222 | 157 | 170 | 219 |
| sidewalk-gap | 118 | 84 | 87 | 117 |
| landuse-bare | 253 | 221 | 229 | 231 |
| bare-on-cover | 130 | 108 | 111 | 111 |
| sidewalk-step | 154 | 145 | 144 | 164 |
| sidewalk-width-jump | 88 | 102 | 100 | 100 |
| kerb-jag | 3 | 9 | 9 | 7 |
| ground-ring-self-cross | 0 | 58 | 5 | 3 |
| crossing-shape-kerb | 17 | 12 | 12 | 9 |
| kerb-strip-bare | 14 | 0 | 0 | 4 |

Wersje 8 i 13 mają lepsze szczeliny, bo chodnik albo asfalt zalewał pasy zieleni i pasy rozdziału, które ortofoto pokazuje jako zieleń (rzut −94; 137). Wersja 18 odtwarza je z ortofoto, za co płaci liczbą szczelin przy krawężniku: tam, gdzie reguła gołego terenu nie kładzie trawy w wąskim pasie, zostaje goły teren. Która wersja jest bliżej Lublina, rozstrzyga przegląd kuratora na ortofoto (w toku).

## Runda 3 (26.11 po południu): dane przed oceną wzrokową

Po przeglądzie kuratora (raport w scratchpadzie sesji, werdykt: jezdnia bliżej Lublina niż main, odchylenie krawężnika 0,55 → 0,40 m; chodnik za szeroki) i decyzji użytkownika o kolejności źródeł (ADR-0104 pkt 4):
- **Uwagi oparte na danych:**
  - place, strefy piesze, obszary jezdni i parkingi z OSM zatrzymują chodnik (Plac Łokietka);
  - wysepka przy zmapowanym placu dostaje nawierzchnię placu (deptak);
  - graf nie rusza pasm poza dzielnicą.
- **Szerokość jezdni według kolejności źródeł (`streets/widths.ts`):**
  - jezdnie BDOT10k (`pnpm gugik:roads`, `data/gugik/jezdnie.json`) dopasowane do osi;
  - spór BDOT10k i pomiaru z ortofoto ponad 1 m zostawia dzisiejszą szerokość i idzie do raportu.

Wersja 24 (Krakowskie, main → graf):

| Rodzaj | main | v24 |
|---|---|---|
| sidewalk-surface-patch | 169 | 99 |
| ground-strip-gap | 288 | 227 |
| landuse-bare | 253 | 228 |
| bare-on-cover | 130 | 109 |
| kerb-gap-bare | 222 | 214 |
| sidewalk-gap | 118 | 116 |
| sidewalk-step | 154 | 152 |
| crossing-shape-kerb | 17 | 4 |
| kerb-strip-bare | 14 | 5 |
| sidewalk-width-jump | 88 | 99 |
| kerb-jag | 3 | 7 |
| ground-ring-self-cross | 0 | 3 |
| bus-stop-on-fill | 0 | 2 |
| fill-gap | 8 | 10 |
| furniture-in-car-lane | 0 | 1 (latarnia 24; −112) |
| car-lane-off-road, lane-off-ground, walk-blocked | 0 | 0 |

**Raport pochodzenia szerokości** (strony jezdni z grafu):
- BDOT10k 79,6%;
- pomiar z ortofoto 18,0% (konflikty);
- dopasowanie do chodników 1,1%;
- OSM 0,8%;
- szacunek 0,5%.

**Konflikty BDOT10k i ortofoto ponad 1 m (9, do przeglądu):**
- Lubartowska: 9 wobec 7,5 m i 10 wobec 12,5 m;
- Narutowicza: 7 wobec 9,2 m i 7 wobec 8,8 m;
- Żołnierzy Niepodległej: 7 wobec 5,9 m;
- 3 Maja: 5 wobec 7,1 m, 5 wobec 3,4 m i 11 wobec 13,5 m;
- Kapucyńska: 10 wobec 7,6 m.

## Runda 4 (26.11 wieczorem): BDOT10k wygrywa zawsze

Decyzja użytkownika: w dzielnicach z grafem szerokość i oś jezdni daje BDOT10k, także wbrew pomiarowi z ortofoto. Zmiany:
- **BDOT10k w potoku importu (`streets/bdot-ways.ts`):**
  - każda ulica w dzielnicy z grafem, wzdłuż której biegnie jezdnia BDOT10k, dostaje jej szerokość jako `width:carriageway`;
  - przesunięcie linii BDOT10k od osi OSM idzie tą samą drogą co przesunięcie z ortofoto (`orthoPieces` z rampą 0,1 m/m od końców), więc pasma, pasy, oznakowanie i połówki jezdni czytają jedną miarę;
  - obie strony jezdni są zmierzone;
  - dopasowanie pasów do zmapowanych chodników nie rusza ulic z BDOT10k.
- **Oś ulicy w treści gry:** ulica z BDOT10k wychodzi na środku swojej jezdni, uproszczona do 0,1 m (`labels.ts`). Inaczej połówki są niesymetryczne i reguła dwóch pasów (`min(L, R) ≥ 2,6 m`) daje Bajkowskiego jeden pas na 6 m jezdni BDOT10k, a `osm:props` pada w `traffic-deptak.ts`.
- **Raport sporów** porównuje BDOT10k z tablicą ortofoto.

Wersja 25 (Krakowskie, main → v24 → v25):

| Rodzaj | main | v24 | v25 |
|---|---|---|---|
| sidewalk-surface-patch | 169 | 99 | 100 |
| ground-strip-gap | 288 | 227 | 232 |
| landuse-bare | 253 | 228 | 235 |
| bare-on-cover | 130 | 109 | 117 |
| kerb-gap-bare | 222 | 214 | 221 |
| sidewalk-gap | 118 | 116 | 127 |
| sidewalk-step | 154 | 152 | 170 |
| crossing-shape-kerb | 17 | 4 | 6 |
| kerb-strip-bare | 14 | 5 | 1 |
| sidewalk-width-jump | 88 | 99 | 112 |
| kerb-jag | 3 | 7 | 7 |
| ground-ring-self-cross | 0 | 3 | 0 |
| bus-stop-on-fill | 0 | 2 | 1 |
| fill-gap | 8 | 10 | 8 |
| furniture-in-car-lane | 0 | 1 | 0 |
| ramp-car-off-lane | 0 | 0 | 12 (fałszywy alarm, niżej) |
| car-lane-off-road, lane-off-ground, walk-blocked | 0 | 0 | 0 |

- **Pochodzenie szerokości:** BDOT10k 97,6%, dopasowanie do chodników 1,1%, OSM 0,8%, szacunek 0,5%. Spory ponad 1 m te same 9 co w rundzie 3.
- **Gorzej:** `sidewalk-step` (+18), `sidewalk-width-jump` (+13) i `sidewalk-gap` (+11). BDOT10k podaje szerokości w pełnych metrach i często węższe niż ortofoto, więc chodnik dostaje uskoki na granicach odcinków. To skutek decyzji o źródle; do sprawdzenia w E3, czy uskoki leżą na granicach odcinków BDOT10k.
- **`ramp-car-off-lane` (12 punktów przy 423–430; −17):** wyjazd z rampy P−1 Alchemii dołącza do lewego pasa Bajkowskiego 0,1 m za początkiem zmiany pasa przed Lubartowską. `join` w `packages/sim/src/content/traffic-ramp.ts` przenosi tylko łuki leżące w całości w przejętej części trasy, więc gubi łuk zmiany pasa i skan widzi samochód między pasami. Poprawka (przyciąć łuk do przejętej części) idzie osobnym PR-em symulacji przed E3.
