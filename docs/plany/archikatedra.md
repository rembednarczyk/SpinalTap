# Archikatedra i Plac Katedralny według zdjęć: plan (24.11.2026)

Prośba użytkownika (24.11): „Do placu katedralnego najpierw dorzucamy poprawę wyglądu katedry” według jego zdjęć: frontu Archikatedry, jej boku i tyłu w śniegu, Wieży Trynitarskiej, parkingu i murków. Przed oświetleniem placu (gałąź `feat/katedralny-noc`).

Wzorzec: zabytek według przepisu (ADR-0062), czyli bryła i wysokości z danych, a detal z przepisu w granicach bryły. Bryłę składamy jak w OSM Simple 3D Buildings: obrys na najniższej kondygnacji, nad nim `building:part` z własnymi wysokościami i dachami. Części, których OSM nie ma, a NMPT je pokazuje, dodaje import (`ADDED_AREAS`, `corrections-katedra.ts`). Różnimy się od OSM tylko tym, że te części są korektą gry, a nie danymi mapy, więc każda ma powód i wiersz T-349.

## Pomiar NMPT (GUGiK 0,5 m, wyciąg `data/gugik/nmpt`)

Układ osi kościoła: oś 6,3° od osi x świata ku +z przez środek obrysu (634,2; −183,8); u wzdłuż osi na wschód, v w poprzek na północ. Wartości to y świata (NMT gry + wysokość nad terenem).

| Element | NMPT | Gra przed K1 | K1 |
|---|---|---|---|
| Portyk | u −37…−31 (6 m przed frontem OSM), v −8…14, taras y 13–14 | brak | 6 kolumn r 0,7 m co 4,16 m, 5,8 m od frontu, taras y 13 (`PORTICOES`) |
| Kruchta i kaplice | u −31…11, v −12,5…17,5: y 13–15 | ściany do y 19,5 | część `korpus` do y 14 |
| Pomieszczenia przy prezbiterium | u 11…21, y 10–13 | 19,5 | `prezbiterium-pn/pd` do 11,5, pas pod nawą do 14 |
| Zakrystie i przybudówki (wschód, południe) | y 7–9 | 19,5 | obrys do y 8,3, płaski |
| Nawa | okap y 25 (v 10,5 i −4,5), kalenica 31 (v 2–4), absyda do u 21 | okap 22,1, kalenica 29,1, absyda do u 24,5 | okap 25, kalenica 31,5, obrys OSM przesunięty o 3,5 m na zachód |
| Fronton między wieżyczkami | u −26…−24, y 33–34, szczyt 35 przy v 2–4 | brak | część `fronton` do 33 z trójkątem do 35,3 |
| Wieżyczki fasady | korpusy u −26…−20, v 10…16 i −11…−5, gzyms 33–35, szczyt hełmu 43 | ściany do 29,3, kopuła do 32,3, 3,3–3,5 m na wschód | do 33,5, hełm cebulasty z latarnią i krzyżem do 43, obrysy przesunięte |
| Sygnaturka na kalenicy | u 3…5, v 2…4, do ok. 35 | brak | K3 |
| Kopuły kaplic | u ≈ 5, v ≈ 13,5 i −7, do 22–23 | brak | K3 |

Obrys OSM i jego części stoją ok. 3,5 m na wschód od NMPT i LoD2 tak samo jak Wieża Trynitarska (T-264). Wschodni koniec obrysu zgadza się z NMPT, więc przesuwamy części, a obrysu nie.

## Etapy

| Etap | Zakres | Gdzie |
|---|---|---|
| K1 | bryła z NMPT (korekty importu i części), portyk z kolumnami w symulacji i rysunku, przepis z tynkiem, pilastrami, gzymsami, otworami dzwonnic, hełmami z krzyżem i ciemną blachą nawy | ten PR |
| K2 | fasada: osie pilastrów (za kolumnami co 4,16 m, wyżej co 4 i 5,2 m), okna łukowe kruchty, nawy i frontonu, drzwi portalu na szczycie schodów (y −1,5), złote słońce z tarczą IHS w tympanonie (`cathedral-front.ts`); zostają schody portalu jako bryła i zegar albo otwory wieżyczek według zdjęć | przepis |
| K3 | dach i bok: lukarny, sygnaturka, kopuły kaplic, okna naw i absydy, gzymsy boczne, warstwa 2077 (ciepłe linie na gzymsach, reflektory) | przepis |
| K4 | Wieża Trynitarska: położenie (G-683, T-264), wysokości części według LoD2 i NMPT, iglica ze szczytami i sterczynami, zegar | import i przepis |
| K5 | murki z parapetem z pomiaru, uskok tarasu i schody, parking z kamienną nawierzchnią i autami, drzewa | import, teren, sim |

Szczegóły K4 i K5: audyt kuratora `docs/plany/archikatedra-otoczenie.md` (propozycje T-350…T-354).
