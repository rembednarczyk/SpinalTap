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
