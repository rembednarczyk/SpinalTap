# Przegląd kuratora topografii: ADR-0104 E4, grunt ulic z grafu na Podzamczu i Nabrzeżu (27.11)

Gałąź `feat/grunt-z-grafu-ulic-e4` @ 5f3753fa. Tablice próbne E4 z drzewa roboczego (`SEKI_STREET_GRAPH=podzamcze,nabrzeze`) porównane z tablicami main (`git show HEAD:…`), bez przebudowy. Ortofoto PZGiK, nalot 12.04.2025, przez WMS HighResolution z rozdzielczością 0,08 m (sonda `topo-hr.ts`, User-Agent narzędzia, 35 kafli). Pakiet `pnpm topo:review --no-hashes`: teren i pomosty bez zmian (0 punktów, 19 pomostów bez zmian), nawierzchnia zmienia się na 44 217 m². Złotych hashy nie liczyłem, bo tablice próbne i tak je zmieniają.

Sondy i zrzuty: `/tmp/claude-0/-home-user/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/topo-e4/` (`img/*.png`, `py/topo_lib.py`, `py/topo_w.py`, `py/run1.py`–`run3.py`, `topo-ways.ts`, `ways.txt`), pakiet przeglądu w `.../topo-e4/review/topo-review.md`.

Jak czytać pomiary:
- Przekroje (`m-*.png`) to proste pasy 10 m wzdłuż osi OSM. Kolumny to odległość od osi, w prawo dodatnia.
- Offset we wpisach `KERBS_CHECKED` jest w konwencji `bdotMatch`: środek jezdni na lewo od osi to wartość dodatnia, czyli offset = −(środek w przekroju).
- Kolory jak w E3: czerwony jezdnia, niebieski chodnik, żółty plac, różowy ścieżka, zielony trawa, biały przejście, turkusowa cienka linia to oś BDOT10k, biała to oś OSM, czerwone kółka to sygnalizatory, fioletowe słupki.

## Werdykt: NIEZGODNE w obecnej próbie, ZGODNE Z UWAGAMI po P1–P5

Na większości dróg graf z BDOT10k przybliża Lublin lepiej niż main. Przykłady:
- Andersa ma 7,3 m na ortofoto, w grze 7,4 m, na main 6,2 m;
- Kalinowszczyzna ma 9,4 m (G-861);
- pas dzielący i północny krawężnik Alei Tysiąclecia leżą teraz na swoim miejscu.

Na 8 drogach BDOT10k daje jednak jezdnię o 1,5–3,6 m węższą niż asfalt na zdjęciu. Wtedy pas chodnika grafu leży na prawdziwym pasie ruchu, ze strzałkami, słupkami i autami pod spodem. Do tego graf przykrywa grządki T-165 przed Bazarem. To nowe odstępstwa wobec main. Wszystkie da się usunąć wyjątkami z pomiaru (`KERBS_CHECKED`, wpisy niżej, wzorzec T-360) i pierwszeństwem ręcznych obszarów nad pasem chodnika grafu.

Z 20 konfliktów raportu szerokości 12 to szum. Pomiar z ortofoto ma tam zmierzoną tylko jedną stronę (`sides` „l” albo „r”), a druga połowa to szacunek importu (3,25 albo 4,875 m). Takich konfliktów nie należy rozstrzygać wyjątkiem (P6).

## Uwagi

### P1. Konflikty szerokości: 9 wyjątków `KERBS_CHECKED` (przed scaleniem)
Rozstrzygnięcie każdej drogi z listy, z dowodem z ortofoto:

**BDOT10k zostaje (11 dróg):**
- **w173074311 Kowalska (jednokierunkowa, BDOT10k 3,6 m, ortofoto 6,2 m):** na odcinku grafu (x 520–555) jezdnia z kostki ma ok. 4,0 m (−2,5…+1,6), dalej zatoki skośne z autami, osobno (`kow-c.png`). W grze jest 3,5 m (−1,8…+1,7), na main 6,1 m na trawniku. Ortofoto 6,2 = 2,95 m zmierzone i 3,25 m szacunku. Uwaga: szew 0,2 m między jezdnią a zatoką przy (540; 177) (`top_runs` s25).
- **w179654711 Aleja Tysiąclecia (BDOT10k 10,7, ortofoto 9,1):** 3 pasy od −4,7 do +5,7, czyli 10,4 m. Gra ma 10,6 m (`tys-a.png`, `tys-b.png`). Ortofoto 9,1 to jedna strona i szacunek.
- **w184191188 Rondo Dmowskiego (BDOT10k 10, ortofoto 12,4):** 3 pasy od −5,7 do +4,2, czyli 9,9 m. Za prawą linią krawędziową jest wyspa malowana na asfalcie, 4,3 m. Ortofoto 12,4 = 7,55 m (bierze dodatkowy pas wjazdowy z południa) i 4,875 m szacunku (`dmo-a.png`). Uwaga: wyspa malowana w grze jest chodnikiem (P10).
- **w213514954 Probostwo (5,5 wobec 6,7):** wąska ulica między kamienicami, grunt przesłonięty pochyleniem dachów. Ortofoto 6,7 = 3,45 m i szacunek. Brak dowodu przeciw BDOT10k (`pro-a.png`).
- **w216655514 Lubartowska przy Ciasnej (8,7 wobec 11,3):** od krawężnika do krawężnika −4,2…+5,1, czyli 9,3 m. W grze −3,8…+4,9, czyli 8,7 m. Różnica 0,6 m, w tolerancji (`lub-b.png`). Ortofoto 11,3 = 6,45 m (z placem po zachodniej stronie) i 4,875 m szacunku.
- **w216204909 i w40051142 Aleja Andersa (7,5 wobec 6,3 i 6,1):** asfalt −3,8…+3,6, czyli 7,4 m. W grze −3,9…+3,5; na main 6,2 m (`and-a.png`, `and-b.png`). Tu ortofoto mierzy linie krawędziowe, a nie krawężniki. BDOT10k ma rację, a E4 to poprawia.
- **w40050943 Nowy Plac Targowy (8 wobec 6,3):** cały plac to jedna płaszczyzna z kostki. Aleja ma 5,5 m, rząd miejsc postojowych 5 m. Jezdnia w grze −3,3…+7,2, tak jak na main (`npt-a.png`). Bez odstępstwa.
- **w107667221 Żołnierzy Niepodległej (7 wobec 5,9, Krakowskie, na main od E3):** jezdnia −3,3…+3,6, w grze −3,1…+3,8 (`m-zn.png`). Zgodne.
- **w40051033 i w40051392 Narutowicza (7 wobec 9,2 i 8,8, Krakowskie, na main):** od krawężnika do krawężnika ok. 13 m. Pasy ruchu −4…+4 (8 m), po obu stronach pas postojowy za przerywaną linią (`m-nar1.png`). Jezdnia gry 6,9 m. BDOT10k (7 m) jest bliżej pasów ruchu niż ortofoto 9,2 (5,95 m i szacunek). Pasy postojowe leżą w grze jako chodnik, a rząd słupków stoi na przerywanej linii. Stan main, poza E4 (P11).

**Wyjątek z pomiaru (gotowe wpisy do `tools/osm-import/src/streets/kerbs-checked.ts`).** Pomiary wzięte z przekrojów wyśrodkowanych na osi OSM (`m-*.png`, 2–3 stacje), offset to mediana:
```ts
  // Kowalska east, two-way, setts: the kerb 3.0–3.6 m left of the way, the parking lane's dashed line 3.6–4.2 m right of it
  // (orthophoto PZGiK 2025-04 at s 12/45/85); BDOT10k 3.6 m (one lane) laid half the carriageway as a sidewalk, its posts on the road.
  ["w438384687", { width: 6.6, offset: -0.3, reason: "Kowalska east of the Brama Grodzka steps: two lanes between the kerb and the parking lane's line (T-NNN)" }],
  // Ciasna: 5 m between the wall and the kiosk at Lubartowska, the car park's aisle 7 m between the rows; BDOT10k 3 m on another line.
  ["w227679341", { width: 6, offset: 0, reason: "Ciasna: the mouth between the walls and the car park's aisle (T-NNN)" }],
  // Lubartowska by Probostwo: kerbs −5.2…+5.4 m round a double line on the axis; BDOT10k 8.7 m sat 1 m right of it.
  ["w215632413", { width: 10.6, offset: -0.1, reason: "Lubartowska by Probostwo: kerb to kerb (T-NNN)" }],
  // Aleja Unii Lubelskiej south of Rondo Dmowskiego: four lanes (OSM lanes=4, merge_to_left) −5.7…+8.7 m; BDOT10k 10.7 m is three.
  ["w60610301", { width: 14.4, offset: -1.5, reason: "Aleja Unii Lubelskiej: four lanes kerb to kerb (T-NNN)" }],
  // Turystyczna (w210273909): two lanes −3.9…+5.0 m; BDOT10k 7.1 m laid 2.4 m of the right lane as a sidewalk.
  ["w210273909", { width: 8.8, offset: -0.6, reason: "Turystyczna by the river: two lanes kerb to kerb (T-NNN)" }],
  // Turystyczna (w90972510): three lanes, the asphalt −5.1…+7.3 m; BDOT10k 11 m is the left edge line to the right kerb.
  ["w90972510", { width: 12.4, offset: -1.1, reason: "Turystyczna to Rondo Cybulskiego: three lanes kerb to kerb (T-NNN)" }],
  // Rondo Cybulskiego: four lanes −8.2…+7.2 m, as the orthophoto's both sides (8.45/7.25); BDOT10k 14 m left the left lane bare.
  ["w215632448", { width: 15.5, offset: 0.5, reason: "Rondo Cybulskiego: four lanes kerb to kerb (T-NNN)" }],
  // Andersa's link to Mełgiewska: asphalt −4.0…+2.0 m at the zebra and above it; BDOT10k 7.5 m (its class) laid the lanes on the verge.
  ["w40051729", { width: 6, offset: -0.2, reason: "Andersa's link to Mełgiewska: the link's asphalt (T-NNN)" }],
  // Cerkiewna's northern branch: 9.8 m at z 355, 11.2 m in the mouth at the zebra (z 348); BDOT10k 8 m.
  ["w739432830", { width: 9.8, offset: -0.2, reason: "Cerkiewna's northern branch: kerb to kerb (T-NNN)" }],
```
Dowody i przyczyny:
- **Kowalska w438384687** (`m-kow.png`, `kow-d/e/f.png`; BDOT10k 3,6 m z osią 1,66 m na prawo, czyli −0,1…+3,5): pas chodnika grafu −2,6…0 leży na kostce jezdni. Słupki z reguły rzędu stoją na jezdni, 0,8–2 m od prawdziwego krawężnika (s12, s45). Na wschodnim odcinku (s85) chodnik grafu leży między pasem ruchu a zatokami. Przyczyna `two-way-fit-narrow` (625; 146), `kerb-strip-bare` (626–630; 144–145), `bay-strip-sparse` (644; 148) i biletomatu (681; 160).
- **Ciasna** (P2).
- **Lubartowska w215632413** (`m-lub.png`): chodnik grafu zachodzi 1,2 m na lewy pas. Na s12 ciemny pas asfaltu +3,4…+6,6 (zatoka albo pas postojowy, w OSM go nie ma) leży w grze jako plac. Na main było tu −5,3…+6,2, bliżej zdjęcia.
- **Unii Lubelskiej** (`uni-a.png`, `uni-b.png`): prawy pas (z „merge_to_left” w OSM) leży w grze jako chodnik (+6,0…+8,4), lewy chodnik zachodzi 1 m na pas. Main miał tam goły pas.
- **Turystyczna w210273909** (`m-tur-a.png`): w grze −4,5…+2,5, na zdjęciu −3,9…+5,0. Ortofoto (obie strony, 8,4 m) jest bliżej prawdy niż BDOT10k.
- **Turystyczna w90972510** (`m-tur-c.png`): chodnik grafu +5,8…+8,2 przykrywa prawy pas ze strzałką.
- **Rondo Cybulskiego** (`m-cyb.png`): w grze lewy pas goły (−9,9…−5,8), a prawy krawężnik 1 m na trawie. Main był tu zgodny co do 0,1 m.
- **Łącznica Andersa** (`and-c.png`, P5).
- **Cerkiewna** (`zeb.png`, P9).
- **Do potwierdzenia jednym zrzutem:** w27473447 Turystyczna (BDOT10k 7,6 wobec 9,0). Na ortofoto prawy krawężnik jest +4,2 m od osi (dokładnie jak w pomiarze ortofoto „r” 4,15), a w grze +1,1, więc 3 m pasa ruchu leży pod chodnikiem (`m-tur-b.png` s45, s70). Lewej krawędzi nie rozstrzygnąłem (pasy wjazdu przechodzą w sąsiednią jezdnię). Proponuję `{ width: 13.7, offset: 2.7 }`, jak na main (−9,6…+4,1), po obejrzeniu zrzutu.
- **Do pomiaru:** w143716181 Emanuela Grafa (BDOT10k 7 wobec 8,4, ortofoto obie strony). Na zdjęciu asfalt −4,0…+5,8, czyli 9,8 m, z dodatkowym pasem 2 m po prawej (`m-gra.png`). Jezdnia gry 6,8 m. Graf kładzie tylko odcinek z 60–126 (środek drogi poza Nabrzeżem). Kandydat `{ width: 9.6, offset: -0.9 }`, ale prawy pas 2 m może być poboczem: sprawdzić na zrzucie, zanim wejdzie.
- **Do pomiaru:** w335644107 Szkolna (BDOT10k 5,5, bez pomiaru ortofoto, więc poza listą konfliktów). Przy (860; 603) asfalt ma ok. 10 m (x 857,3–867,5) z przerywaną osią, w grze 5,4 m (main 10,2 m). Drzewo `furniture-in-car-lane` (859,5; 602,5) przesunęło się z trawnika na krawężnik grafu (`s-drzewo.png`).

**Wiersze T:** każdy wyjątek dostaje osobny wiersz, według wzorca T-360 (polecenia na końcu).

### P2. Ciasna w227679341: skąd 3 m i jaka jest jezdnia (przed scaleniem)
- **Skąd 3 m:** BDOT10k ma Ciasną jako dwie „drogi dojazdowe” (26780F23-AD49 i -AD23) z szerokością 3 m. Linia biegnie inaczej niż w OSM: od Lubartowskiej (649,8; 538,3) do (626,3; 547,2), potem na zachód od parkingu (x ok. 625). `bdotMatch` daje więc mediano 3 m i oś 1,71 m na lewo. To nie jest pomiar Ciasnej. To klasa drogi przypięta do innej geometrii.
- **Ortofoto** (`cia-r-orto.png`, `cia-e.png`, `cia-s.png`, `cia-w.png`):
  - wylot z Lubartowskiej to asfalt ok. 5 m między ścianą kamienicy (−3) a kioskiem (+2);
  - odcinek północ–południe to aleja parkingu ok. 7 m (−3,5…+4) między dwoma rzędami aut prostopadłych. Cały parking jest asfaltem ok. 21 m. Zachodni rząd to zatoka w227679486, wschodni w OSM nie ma obszaru;
  - zachodni odcinek przy kamienicy jest wąski, częściowo pod pochyleniem dachu.
- **W grze:**
  - E4: jezdnia 3 m, a pas chodnika grafu 3 m (−0,1…+2,8) leży na środku alei parkingu. Lampy (635,6; 538,5) i (604,8; 570,1) oraz drzewa (643,5; 540,5) i (597,5; 571,5) stoją przy krawężniku grafu w pasie ruchu dwukierunkowej ulicy (`furniture-in-car-lane`);
  - auto zatoki w227679486 nie mieści się w układzie przy krawężniku grafu (`kerb-bay-cars`);
  - słup przy Ciasnej odsunięty od ściany (`ccby-street`);
  - trawa na asfalcie przy północnym końcu parkingu (633–638; 566–568) (`lawn-strip-on-paving`);
  - main: 6,2–6,4 m, na całym parkingu asfalt.
- **Poprawka:** wyjątek z P1 (6 m, offset 0), bliski main. Wynik: `two-way-fit-narrow` (650; 536), 4 miejsca `furniture-in-car-lane`, 6 miejsc `lawn-strip-on-paving` w podzamcze-0-1 i testy `kerb-bay-cars` oraz `ccby-street` wracają. Po wyjątku sprawdzić, czy na alei nie zostaje pas chodnika grafu między krawężnikiem 3 m a wschodnim rzędem aut. Jeśli tak, wschodni rząd dodać jako obszar parkingu z ortofoto (`ADDED_AREAS`, wzorzec T-164).

### P3. Kowalska i Zamkowa: `two-way-fit-narrow` (Kowalska przed scaleniem, Zamkowa do przyjęcia)
- **Kowalska w438384687** (625; 146), 3,6 m: błąd BDOT10k. Prawdziwa jezdnia ma 6,4–7,5 m z osią i pasem postojowym (P1). Wyjątek usuwa miejsce.
- **Zamkowa w40052001** (990; 289), 3,2 m: zgodne z Lublinem. Na ortofoto (`zam-b.png`, `zam-a.png`) to wąski ciąg pieszo-jezdny pod drzewami: nawierzchnia ok. 3,5 m między kamiennymi obrzeżami przy Zamku, przy Unii Lubelskiej ok. 3–3,5 m kostki. BDOT10k 3,2 m jest dobry, main (4,9 m z chodnikami 2,5 m po obu stronach na trawie i krzakach) był gorszy. Wąska dwukierunkowa `living_street`, na której auta mijają się po kolei, to prawda.
- **Poprawka dla Zamkowej:** przyjąć klucz z uzasadnieniem. Lepiej: reguła ruchu, która na `living_street` i `service` węższych niż 4,5 m kładzie jeden wspólny pas zamiast dwóch (wzorzec: ulica jednopasowa z mijaniem, jak w drogach gruntowych ADR-0055). Pas chodnika grafu po prawej (+1,2…+2,4) leży na trawie, bo to obrzeże: drobne, po scaleniu.

### P4. Północny chodnik Alei Tysiąclecia (G-337, G-350, G-382): grządki tak, plac nie (przed scaleniem)
- **(670; 382,3) grządka:** na ortofoto przed halami Bazaru są rabaty z krzewami (zielone i brązowe, z ok. 381–385), tak jak w T-165 (`tys-bed.png`). Na main grządki są trawą, w E4 pas chodnika grafu przykrywa je w całości aż do okapu (z ok. 381,5–384,5), a (705; 377,5) to plac zamiast rabaty pod koronami. To utrata zgodności. **Ręczne korekty T-165 i T-285 muszą wygrywać z grafem.** Pas chodnika grafu kończy się na obszarach z `ADDED_AREAS` i na `landuse=flowerbed`, albo ręczne obszary rysują się nad nim. Test G-337 zostaje bez zmian.
- **(830; 350) jezdnia zamiast placu:** prawdą jest jezdnia. Na zdjęciu (`tys-e.png`) ciemny asfalt sięga z ok. 352,8 przy x 826 i 350,3–350,6 przy x 836 (dalej betonowa zatoka autobusowa do z ok. 354,9). W E4 krawężnik leży na z 351,4 (x 826) i 350,0 (x 836), o 0,3–1,4 m za nisko. Na main był na 349,5 i 348,1, o 2–3 m za nisko (T-165: „krawężnik w grze 1,3–3 m na południe od rzeczywistego”). Punkt (830; 350) leży 0,3 m od krawędzi asfaltu. **Test G-350 przepisać:** `surfaceAt(830, 350)` → `road`, a punkt placu przenieść na (826; 354,5).
- **(826; 357) plac zamiast chodnika:** na zdjęciu jedna płaszczyzna beżowej kostki od krawędzi zatoki po wiatę. Linia chodnika w1435832518 to linia OSM, bez krawężnika w terenie. Uskok 8 cm między `sidewalk` a `square` nie istnieje, więc oba stany są równie bliskie prawdy, a jednolity plac jest bliższy. **Testy G-350 i G-382 przepisać** na intencję: (826; 357) i (830; 356,6) mają nawierzchnię `square` albo `sidewalk`, bez gołego gruntu. Pas chodnika grafu nie powinien wychodzić spod placu w szwach.
- **Zatoka autobusowa x 826–842, z 350,3–354,9 (beton, autobus na zdjęciu):** w E4 i na main to plac. Odstępstwo już było (T-173), teraz mniejsze. Po scaleniu jako dopisek do T-173.

### P5. `lane-place-on-green` przy węźle Andersa (2362,8; 362,8), 34 miejsca (przed scaleniem)
- **Łącznica w40051729:** asfalt −4,0…+2,0 m przy zebrze i 15 m wyżej, czyli 5,8–6,0 m (`and-c.png`). W E4 jezdnia ma 7,5 m (−4,1…+3,4) i sięga 1,4 m za krawężnik, na trawnik. Tam leżą pasy ruchu i część z 34 miejsc (`road on green`). Wyjątek z P1 (6 m, offset −0,2).
- **Ciąg pieszy:** po prawej stronie łącznicy jest betonowe obrzeże (+2,0…+2,6), trawnik 1,5 m i kręta ścieżka z ciemnego asfaltu (+4…+6). Graf kładzie ścieżkę jako chodnik ulicy (+4,4…+5,9) z pasem `footway` +3,5…+4,3 na trawniku, stąd `sidewalk on green`. Chodnik ulicy z linii pieszej oddalonej od krawężnika o więcej niż ok. 1,5 m, z trawnikiem między nimi (na ortofoto albo z `landuse=grass`), ma być osobną ścieżką, a nie pasem chodnika ulicy.
- **Klin rozdziału:** bez zmian wobec G-839 (asfalt na zdjęciu do z 321,4–324,4).
- **Pozostałe miejsca `lane-place-on-green` na Podzamczu (nieobjaśnione w planie):** przy węźle (1106,2; 519,2) w podzamcze-2-1 (1100–1120; 390–530), przy (1050–1090; 420–470) (Lwowska i Ruska) oraz (520–530; 380–400) (Aleja Solidarności i Lubartowska). Nie sprawdzałem ich na ortofoto. Wyjaśnić przed przyjęciem bazy.

### P6. Raport konfliktów szerokości porównuje BDOT10k z połową szacunku (przed scaleniem, narzędzie)
- W `ORTHO_WIDTHS` 44 z 86 wierszy to pomiar jednej strony („one-side”), a druga połowa to szacunek importu.
- W tej próbie 12 z 20 konfliktów to takie wiersze: Kowalska w173074311, Aleja Tysiąclecia, Rondo Dmowskiego, Probostwo, obie Lubartowskie, Turystyczna w27473447 i w90972510, Narutowicza ×2, 3 Maja, Żołnierzy Niepodległej, Unii Lubelskiej.
- **Poprawka w `WidthReport.add`:** konflikt liczyć tylko z wierszem „lr”, a przy jednej stronie porównywać tę stronę z połową BDOT10k przesuniętą o jego offset. Raport wtedy wskaże prawdziwe spory, a nie szum.
- Do tego konfliktu BDOT10k z ortofoto nie widać tam, gdzie ortofoto nie zmierzyło drogi wcale: Ciasna, Kowalska wschodnia, Cerkiewna, Szkolna. Kontrola skanu z P12 to łapie.

### P7. Pozostałe nowe miejsca skanu
**Przesunięte stare miejsca, do przyjęcia z uzasadnieniem:**
- **`kerb-jag` 20 → 39** (33 nowe, 14 ubyłe): zygzaki 0,1–0,9 m na narożnikach i przy zebrach, ta sama klasa co G-982 (narożnik grafu przy osi przesuniętej przez BDOT10k). Ubyłe klucze leżą w tych samych węzłach co część nowych (np. Kalinowszczyzna 2650 → 2660, G-845 920 → 910–930). Nie oglądałem każdego. Przyjąć jako G-982, dopisać klucze. 0,88 m przy zebrze Kowalskiej (522,1; 187) sprawdzić po wyjątku Kowalskiej, a 0,76 m przy zebrze (917,8; 472,9) przy G-869.
- **`kerb-strip-bare` Słowikowskiego w40049369** (885–887; 631), (936–954; 607–613):
  - BDOT10k 4,5 m, na zdjęciu 4,6 m (−2,0…+2,6) (`m-slo.png`);
  - za lewym krawężnikiem jest pas liści i krzaków, który w grze był goły na main i jest goły teraz, tylko przesunięty z krawężnikiem;
  - klucze main (980; 590) i (1100; 650) znikają;
  - przyjąć jako przesunięte, glitch zbiorczy `kerb-strip-bare` zostaje.
- **`kerb-strip-bare` stare-miasto-1-1 (620–640; 140–150) i `bay-strip-sparse` (644; 148):** skutki Kowalskiej (P1), znikną z wyjątkiem.
- **`lit-street-dark` (1100–1110; 200–210):** ta sama ścieżka w427417969 przy schodach Zamku co w bazie, o jedną komórkę dalej. Przyjąć.
- **`lamp-beside-deck` (756,6; 175,9):** latarnia `lamps.zamkowa` przesunięta o 0,36 m, 1,76 m pod pomostem wiaduktu Zamkowej. Na main stała 0,4 m od tego miejsca. Przyjąć, ale odsunąć latarnię od krawędzi pomostu w tej samej regule (po scaleniu).
- **`paving-coplanar` (2409; 280), 0,01 m²:** szum. Przyjąć.
- **`furniture-in-car-lane` (681; 160), biletomat:** stoi na przerywanej linii pasa postojowego Kowalskiej (węzeł OSM tam, na main 1,1 m dalej). W pasie ruchu znalazł się przez zwężenie jezdni do 3,6 m. Zniknie z wyjątkiem Kowalskiej. Jeśli nie, przesunąć na chodnik (G-004).

**Nowe odstępstwa:**
- **`furniture-in-car-lane` (860; 603), drzewo:** Szkolna (P1, do pomiaru). Drzewo z reguły rzędu przesunęło się o ok. 3,2 m z trawnika na krawężnik grafu, a krawężnik grafu leży ok. 2 m w asfalcie.
- **`deck-abutment-step` 2 → 6** (nabrzeze-0-0 2440–2450,240–250; nabrzeze-0-1 2410–2420,310–330; 2440–2450,420–430): grunt 0,3 m za końcem pomostu leży 0,3–2,0 m niżej (mosty na Mełgiewskiej i Andersa). Na main tego nie było. Złącze z rundy 3 kładzie asfalt 10 m za pomostem, ale nie podnosi terenu. Glitch S3 (polecenie niżej), według planu osobno, ale przed włączeniem E4 na stałe, bo to krok dla gracza i AI.
- **`bus-stop-on-fill` (702; 692), Lubartowska:** przystanek stoi na kawałku jezdni wypełnienia (`road`), a na zdjęciu (`s-bus.png`) to chodnik z kostki z czekającymi ludźmi. Na main `sidewalk`. Glitch S4.
- **`lawn-strip-on-paving` 1 → 17:**
  - 6 miejsc przy Ciasnej (P2);
  - (964; 357), (813–815; 749–758), (1073–1087; 731–732) i 7 na Nabrzeżu: nie oglądałem na ortofoto. Trawa 0,6–2,9 m od krawężnika na kostce według klas ortofoto, rodzaj P11 z E3. Glitch zbiorczy S4 z kluczami, do sprawdzenia przy poprawce.
- **`metro-entrance-blocked` targ A (722; 286), `ground-ring-self-cross` (2690; 64):** poza listą briefu. Pierwsze to test `metro-entrances` z planu, drugie to drobny pierścień chodnika na krawędzi chunku. Wyjaśnić przed przyjęciem bazy.

### P8. Sygnalizatory reguły G-825 r3: przeskok na drugi narożnik (po scaleniu, glitch)
- **Pomiar przesunięć:** każde duże przesunięcie to przeskok między dwoma narożnikami tego samego węzła OSM `highway=traffic_signals`. Main i E4 leżą po przeciwnych stronach, mniej więcej równie daleko od węzła:

| węzeł OSM | main | E4 | od węzła main / E4 |
|---|---|---|---|
| n304514596 (2463,6; 242,7), Rondo Cybulskiego | (2454,7; 239,0) | (2471,6; 248,0) | 9,6 / 9,6 m |
| n2348421821 (2531,4; 264,7), Turystyczna | (2523,5; 261,4) | (2540,8; 266,6) | 8,5 / 9,6 m |
| n1838236176 (2483,5; 293,4) | (2485,3; 284,5) | (2481,7; 302,3) | 9,1 / 9,1 m |
| n646753017 (2368,3; 319,9), łącznica Andersa | (2371,1; 324,1) | (2364,4; 314,0) | 5,0 / 7,1 m |
| n2328762095 (2387,4; 280,9) | (2387,4; 285,0) | (2388,5; 275,4) | 4,1 / 5,6 m |
| n481919937 (664,3; 573,9), Lubartowska z Ciasną | (671,3; 576,8) | (657,3; 572,5) | 7,6 / 7,1 m |

- **Ortofoto:**
  - przy n304514596 (`sg-cyb.png`) słup z sygnalizatorami stoi na wysepce przy węźle, ok. (2464,7; 242,1). Pozycja E4 leży na asfalcie jezdni za łukiem narożnika grafu, main na chodniku SW. Obie są ok. 10 m od słupa;
  - przy n481919937 (`sg-lub.png`) jest maszt z wysięgnikiem nad skrzyżowaniem, od (653; 572,5) do (673,5; 577,5). E4 i main leżą przy przeciwnych końcach wysięgnika. Podstawy z jednego zdjęcia nie rozstrzygam.
- **Wniosek:** przesunięcie o 10–19 m nie pogarsza zgodności wobec main, bo obie pozycje są ok. 10 m od prawdziwego słupa. Reguła „najbliższy chodnik, z której strony przyjeżdża ruch” jest jednak niestabilna: wystarczy inny kształt narożnika grafu.
- **Przyczyna:** narożnik grafu (łuk 3–4 m) zmienia, który kawałek chodnika jest najbliżej. Przy Cybulskiego najbliższy „chodnik” to pas grafu na asfalcie.
- **Poprawka:** słup przy krawężniku jezdni z węzłem, na prostopadłej z węzła po stronie ruchu przyjeżdżającego, nie dalej niż półszerokość jezdni plus 2 m od węzła; na wysepce, jeśli jest. Wzorzec: rozstawienie wzdłuż krawędzi (snap to kerb). Glitch S4, kontrola w P12.
- Mniejsze przesunięcia 0,5–2 m (587,5; 360,4), (1094,5; 279,0), (592,1; 372,6), (1058,8; 288,1) idą z krawężnikiem. Przyjąć.

### P9. Zebra n4586176953 przez północną odnogę Cerkiewnej (914; 346) (przed scaleniem, razem z P1)
- **Ortofoto** (`zeb.png`):
  - jezdnia odnogi w739432830 ma 9,8 m na z 355 (x 909,5–919,3) i rozszerza się do 11,2 m w wylocie przy zebrze (x 908,7–919,9 na z 348);
  - zebra ma ok. 10 m (pasy x ok. 910,5–920,5), z 346,5–350, wzdłuż ścieżki w1435832526.
- **W grze:**
  - E4: jezdnia z BDOT10k 8 m, wschodni krawężnik na x ok. 918, o 1,9 m za blisko osi, zebra 8,87 m (908,9–917,8);
  - main: zebra 12,3 m (907,2–919,5).
- **Wniosek:** test `zebra-fit-city` (9–13 m) ma rację. Wyjątek P1 `w739432830 { width: 9.8, offset: -0.2 }` przywraca zebrę do ok. 10 m. Przy łuku wylotu zebra może wyjść ok. 10,5 m, nadal w teście.

### P10. Rondo Dmowskiego: wyspa malowana jako chodnik (po scaleniu, glitch S4)
- Na zdjęciu pas ukośnych linii (powierzchnia wyłączona z ruchu) +4,2…+8,5 od osi w184191188 to asfalt w poziomie jezdni.
- W E4 to `sidewalk` (krawężnik 0,16 m), na main `square`.
- Oba stany odstają od zdjęcia. E4 dokłada krawężnik, którego w terenie nie ma.
- Poprawka: obszar wyłączony z ruchu jako `road` bez pasów ruchu, z OSM `area:highway` albo z ortofoto (wzorzec `ADDED_AREAS`).

### P11. Znaleziska spoza E4 (po scaleniu)
- **3 Maja w186145292** (Krakowskie, na main od E3):
  - asfalt −3,0…+4,2 od osi (7,2 m), w grze −2,7…+2,2 (BDOT10k 5 m);
  - słupki rzędu stoją na pasie ruchu (s15, `m-maja.png`);
  - wyjątek `["w186145292", { width: 7.2, offset: -0.6, … }]` z osobnym wierszem T, w osobnej zmianie Krakowskiego.
- **Narutowicza w40051033 i w40051392:** pasy postojowe po obu stronach za przerywaną linią leżą jako chodnik, a rząd słupków stoi na linii (`m-nar1.png`). Sprawdzić, czy słupki są z OSM. Jeśli nie, glitch.

### P12. Glitche z listy: co E4 zmienia
- **G-838:** zamyka. Klucz `kerb-gap-bare podzamcze-2-1 1110,440` znika. Obok przybywa `ground-strip-gap` 1110–1120,450–460, do obejrzenia przy przyjęciu bazy.
- **G-845:** zmienia, nie zamyka. Klucze 2650,110 i 920,470 znikają, ale w tych samych narożnikach przybywają `kerb-jag` (2660,100; 910–930,460–480) i `kerb-gap-bare` 910,460. Klucze przenieść.
- **G-851:** zamyka część (1110,330). Przy (530; 390) zmienia: `kerb-gap-bare` znika, przybywają `kerb-jag` 530,380 i `ground-strip-gap` 520–540,390–410.
- **G-860:** zmienia. Klucza `kerb-jag` 1050,440 nie ma już w bazie main. Przy łącznicy Ruskiej przybywają `kerb-gap-bare` 1050,450 i 1070,440. Nie zamykać przed obejrzeniem.
- **G-861:** zamyka szerokość. Kalinowszczyzna w1551268848 ma w E4 9,4 m (−4,9…+4,5), na zdjęciu 9,5–10 m, na main 7,2. Zebrę n4087364975 sprawdzić po scaleniu, bo przy niej przybywają `kerb-jag` i `kerb-gap-bare` 2360,420.
- **G-862:**
  - część Ruskiej: zmienia, nie zamyka. Klucz `kerb-gap-bare` 1060,440 znika, ale (1064; 445) to teraz `sidewalk` zamiast `square`, nadal na zieleni ortofoto;
  - część Andersa (2356; 357,5): `road` zamiast trawy, w obszarze P5;
  - zostaje otwarty.
- **G-811:** zamyka na Podzamczu i Nabrzeżu. Ulice grafu nie używają `kerbFills`, a `kerb-fill-wide-estimated` spada 62 → 26, `kerb-fill-flicker` 70 → 31. Poza grafem (Stare Miasto) zostaje.
- **G-144:** zamyka w wymienionych miejscach. Gołe próbki co 0,2 m w kwadratach 4 × 4 m: Mełgiewska (2370; 285) 3 → 0, Turystyczna (2606; 332) 1 → 0, (2526; 357) 0 → 0. `lane-off-ground` 0 na main i w E4. Resztę z ok. 20 miejsc przesiać `g-sieve`.
- **G-783:** nie zamyka. `fill-gap` 2544,270, 2500,295 i 796,370 zostają.
- **G-351:** zamyka. Pas dzielący Alei Tysiąclecia w przekrojach x 625–735 ma nawierzchnię na 2,5–2,7 m (−7,4…−4,7), na zdjęciu 2,5 m płyt między krawężnikami. Na main goły pas 3,4 m. Bariery nie ma (to model, osobno).
- **G-353:** zmienia. Na x 625–735 przy jezdni leży chodnik grafu (krawężnik, kratki), więc tam zamyka. Na x 806–872 (T-173, przystanek, P4) przy jezdni nadal plac bez krawężnika. Zasięg zawęzić.
- **G-794:** nie dotyczy, linie pasów ruchu się nie zmieniają. Nie zamyka.

## Proponowane kontrole skanu
1. **`kerb-inside-asphalt`:**
   - definicja: na ulicy grafu pas 0,5–1,5 m za krawężnikiem jezdni, na odcinku co najmniej 10 m, ma na ortofoto klasę `asphalt` w ponad 70% próbek, a w grze nawierzchnię inną niż `road`, `crossing` albo `parking`;
   - łapie P1, P2, P9 i Szkolną;
   - baza: E4 ok. 10 odcinków (Kowalska, Ciasna, Lubartowska w215632413, Unii, Turystyczna ×3, łącznica Andersa, Cerkiewna, Szkolna), main do policzenia.
2. **`signal-far-from-node`:**
   - definicja: sygnalizator dalej od swojego węzła OSM `highway=traffic_signals` niż półszerokość jezdni plus 3 m;
   - baza: main 6 i E4 6 (tabela P8), do policzenia przez budowniczego.
3. **`kerb-row-on-asphalt`:**
   - definicja: słupek, drzewo albo latarnia z reguły rzędu (bez węzła OSM) w miejscu, gdzie ortofoto ma klasę `asphalt` dalej niż 0,5 m od krawędzi jezdni gry;
   - przypadki: Kowalska, 3 Maja, Szkolna;
   - uogólnienie `lamp-on-orto-carriageway` na inne meble;
   - baza do policzenia.
4. **`added-area-under-graph`:**
   - definicja: punkt obszaru z `ADDED_AREAS` albo grządki (`landuse=flowerbed`), który w tablicy ma inną nawierzchnię niż obszar;
   - przypadek: P4, grządki T-165;
   - baza: main 0, E4 co najmniej 1 (Bazar).

## Polecenia rejestrów (wykonuje orkiestrator)
```
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Kowalska w438384687 (625–725; 146–193)" "jezdnia 6,6 m, środek 0,3 m na prawo od osi OSM (KERBS_CHECKED), zamiast BDOT10k 3,6 m z osią 1,66 m na prawo" "ortofoto PZGiK 2025-04: kostka od krawężnika 3,0–3,6 m na lewo od osi do przerywanej linii pasa postojowego 3,6–4,2 m na prawo, dwa pasy z podwójną osią; na wschodzie pasy postojowe po obu stronach; BDOT10k 3,6 m to jeden pas" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1/P3"
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Ciasna w227679341 (583–650; 536–577)" "jezdnia 6 m na osi OSM (KERBS_CHECKED), zamiast BDOT10k 3 m" "ortofoto PZGiK 2025-04: wylot z Lubartowskiej 5 m między ścianą a kioskiem, odcinek N–S to aleja parkingu ok. 7 m między dwoma rzędami aut (cały parking asfalt ok. 21 m); BDOT10k: dwie drogi dojazdowe 3 m na innej linii (na zachód od parkingu)" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P2"
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Lubartowska w215632413 (608–623; 427–466)" "jezdnia 10,6 m, środek 0,1 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 8,7 m 0,3 m na prawo" "ortofoto PZGiK 2025-04: krawężniki −5,2…+5,4 m wokół podwójnej osi; przy południowym końcu ciemny pas asfaltu +3,4…+6,6 (zatoka, brak w OSM)" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1"
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Aleja Unii Lubelskiej w60610301 (1047–1052; 215–283)" "jezdnia 14,4 m, środek 1,5 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 10,7 m" "ortofoto PZGiK 2025-04: cztery pasy (OSM lanes=4, turn:lanes …|merge_to_left) −5,7…+8,7 m od osi; BDOT10k mierzy trzy" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1"
python3 -I tools/rejestry/rej.py t-new "Nabrzeże, Turystyczna w210273909 (2526–2606; 333–356)" "jezdnia 8,8 m, środek 0,6 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 7,1 m" "ortofoto PZGiK 2025-04: dwa pasy −3,9…+5,0 m od osi (3 stacje); pomiar ortofoto obu stron 8,4 m" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1"
python3 -I tools/rejestry/rej.py t-new "Nabrzeże, Turystyczna w90972510 (2531–2569; 264–311)" "jezdnia 12,4 m, środek 1,1 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 11 m" "ortofoto PZGiK 2025-04: trzy pasy, asfalt −5,1…+7,3 m od osi; BDOT10k 11 m to odcinek od lewej linii krawędziowej do prawego krawężnika" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1"
python3 -I tools/rejestry/rej.py t-new "Nabrzeże, Rondo Cybulskiego w215632448 (2463–2505; 218–243)" "jezdnia 15,5 m, środek 0,5 m na lewo od osi (KERBS_CHECKED), zamiast BDOT10k 14 m 1,24 m na prawo" "ortofoto PZGiK 2025-04: cztery pasy −8,2…+7,2 m od osi, jak pomiar ortofoto obu stron (8,45 i 7,25 m) i jak main" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1"
python3 -I tools/rejestry/rej.py t-new "Nabrzeże, łącznica Andersa w40051729 (2319–2363; 311–363)" "jezdnia 6 m, środek 0,2 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 7,5 m 0,81 m na prawo" "ortofoto PZGiK 2025-04: asfalt łącznicy 5,8–6,0 m przy zebrze i nad nią, za nim betonowe obrzeże, trawnik 1,5 m i kręta ścieżka asfaltowa; BDOT10k 7,5 m to szerokość klasy" "geometria (jezdnia)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P1/P5"
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Cerkiewna, północna odnoga w739432830 (913–919; 346–390)" "jezdnia 9,8 m, środek 0,2 m na prawo od osi (KERBS_CHECKED), zamiast BDOT10k 8 m; zebra n4586176953 ok. 10 m" "ortofoto PZGiK 2025-04: 9,8 m na z 355, 11,2 m w wylocie na z 348; zebra ok. 10 m wzdłuż ścieżki w1435832526" "geometria (jezdnia, przejście)" "celowe: sprawdzony spór danych (decyzja 27.11, wzorzec T-360), przegląd kuratora E4 P9"
python3 -I tools/rejestry/rej.py t-new "Podzamcze, Rondo Dmowskiego w184191188: wyspa malowana (1056–1060; 297–326)" "pas ukośnych linii za prawą linią krawędziową jako chodnik z krawężnikiem 0,16 m (E4), plac (main)" "ortofoto PZGiK 2025-04: asfalt w poziomie jezdni z ukośnymi liniami (powierzchnia wyłączona z ruchu), 4,3 m" "geometria (nawierzchnia)" "do poprawy (glitch)"
python3 -I tools/rejestry/rej.py t-append T-173 "Kurator E4 27.11: krawężnik al. Tysiąclecia przy przystanku z grafu 0,3–1,4 m od asfaltu ortofoto (main 2–3 m); betonowa zatoka autobusowa x 826–842, z 350,3–354,9 nadal jako plac; (826; 357) jedna płaszczyzna kostki, sidewalk/square bez uskoku w terenie (raport-kuratora E4 P4)."
python3 -I tools/rejestry/rej.py t-append T-165 "Kurator E4 27.11: grządki przed Bazarem potwierdzone na ortofoto 2025-04 (z ok. 381–385); graf E4 przykrywał je chodnikiem; ręczne obszary T-165/T-285 mają pierwszeństwo przed pasem chodnika grafu (raport-kuratora E4 P4)."
python3 -I tools/rejestry/rej.py g-new "Uskok terenu za końcami pomostów mostów na Mełgiewskiej i Andersa (graf E4)" --waznosc S3 --zasieg "4 miejsca deck-abutment-step: (2443,6–2444,5; 241,5–242), (2413,3–2415,8; 310,8–311,6), (2416,8–2418,8; 328,4–329,1), (2440,3–2441,6; 429–429,8)" --opis "Na próbie E4 grunt 0,3 m za końcem pomostu leży 0,3–2,0 m niżej niż pomost; złącze jezdni grafu z końcem pomostu (streets/abutment-joints.ts) kładzie asfalt 10 m dalej, ale nie podnosi terenu. Na main tych miejsc nie ma. Przegląd kuratora E4, P7." --status zgłoszone --pakiet "tools/osm-import (streets/abutment-joints, teren pomostów)" --test "deck-abutment-step bez kluczy w nabrzeze-0-0 i nabrzeze-0-1" --klucze "deck-abutment-step nabrzeze-0-0 2440..2450,240..250; deck-abutment-step nabrzeze-0-1 2410..2420,310..320; deck-abutment-step nabrzeze-0-1 2410..2420,320..330; deck-abutment-step nabrzeze-0-1 2440..2450,420..430"
python3 -I tools/rejestry/rej.py g-new "Przystanek przy Lubartowskiej (702; 692) na kawałku jezdni wypełnienia zamiast na chodniku" --waznosc S4 --zasieg "podzamcze-0-2 (701,9; 691,9)" --opis "Na próbie E4 pod przystankiem leży road (wypełnienie), na main sidewalk; ortofoto 2025-04: chodnik z kostki z wiatą i czekającymi. Przegląd kuratora E4, P7." --status zgłoszone --pakiet "tools/osm-import (streets)" --klucze "bus-stop-on-fill podzamcze-0-2 702,692"
python3 -I tools/rejestry/rej.py g-new "Sygnalizatory reguły G-825 r3 przeskakują między narożnikami węzła, ok. 10 m od słupa" --waznosc S4 --zasieg "6 węzłów: n304514596, n2348421821, n1838236176, n646753017, n2328762095, n481919937" --opis "Reguła najbliższego chodnika daje na main i na grafie E4 pozycje po przeciwnych stronach węzła, 4–10 m od niego; ortofoto 2025-04 przy Rondzie Cybulskiego: słup na wysepce przy węźle (2464,7; 242,1), pozycja E4 na asfalcie za łukiem narożnika. Poprawka: słup przy krawężniku na prostopadłej z węzła po stronie ruchu, do półszerokości jezdni + 2 m od węzła, na wysepce, jeśli jest. Przegląd kuratora E4, P8." --status zgłoszone --pakiet "tools/osm-import (props-place)" --test "każdy sygnalizator do półszerokości jezdni + 3 m od swojego węzła OSM"
python3 -I tools/rejestry/rej.py g-new "Wyspa malowana Ronda Dmowskiego jako chodnik z krawężnikiem" --waznosc S4 --zasieg "(1056–1060; 297–326), ok. 120 m²" --opis "Pas ukośnych linii za prawą linią krawędziową w184191188 to na ortofoto 2025-04 asfalt w poziomie jezdni; E4 kładzie sidewalk (krawężnik 0,16 m), main square. Przegląd kuratora E4, P10." --status zgłoszone --pakiet "tools/osm-import"
python3 -I tools/rejestry/rej.py g-note G-838 "Kurator E4 27.11: klucz kerb-gap-bare podzamcze-2-1 1110,440 znika na próbie grafu E4; obok nowy ground-strip-gap 1110..1120,450..460."
python3 -I tools/rejestry/rej.py g-note G-845 "Kurator E4 27.11: na grafie E4 klucze 2650,110 i 920,470 znikają, w tych samych narożnikach kerb-jag 2660,100 i 910–930,460–480, kerb-gap-bare 910,460; nie zamykać."
python3 -I tools/rejestry/rej.py g-note G-851 "Kurator E4 27.11: na grafie E4 znika 1110,330; przy 530,390 zamiast kerb-gap-bare kerb-jag 530,380 i ground-strip-gap 520–540,390–410."
python3 -I tools/rejestry/rej.py g-note G-860 "Kurator E4 27.11: przy łącznicy Ruskiej na grafie E4 nowe kerb-gap-bare 1050,450 i 1070,440; obejrzeć przed zamknięciem."
python3 -I tools/rejestry/rej.py g-note G-861 "Kurator E4 27.11: na grafie E4 Kalinowszczyzna w1551268848 9,4 m (BDOT10k 9,5), ortofoto 9,5–10 m: szerokość zgodna; zebra n4087364975 do sprawdzenia (kerb-jag i kerb-gap-bare 2360,420)."
python3 -I tools/rejestry/rej.py g-note G-862 "Kurator E4 27.11: na grafie E4 (1064; 445) sidewalk zamiast square, nadal na zieleni; (2356; 357,5) road zamiast trawy (obszar łącznicy Andersa, P5); zostaje otwarte."
python3 -I tools/rejestry/rej.py g-note G-811 "Kurator E4 27.11: na Podzamczu i Nabrzeżu z grafem E4 kerbFills nie działa (kerb-fill-wide-estimated 62 → 26, kerb-fill-flicker 70 → 31); po włączeniu E4 zostaje tylko poza grafem."
python3 -I tools/rejestry/rej.py g-note G-144 "Kurator E4 27.11: na grafie E4 gołe próbki co 0,2 m: Mełgiewska (2370; 285) 3 → 0, Turystyczna (2606; 332) 1 → 0, (2526; 357) 0; resztę przesiać g-sieve po scaleniu."
python3 -I tools/rejestry/rej.py g-note G-351 "Kurator E4 27.11: na grafie E4 pas dzielący al. Tysiąclecia x 625–735 ma nawierzchnię 2,5–2,7 m, ortofoto 2,5 m płyt między krawężnikami: do zamknięcia po włączeniu E4 (bariera osobno)."
python3 -I tools/rejestry/rej.py g-note G-353 "Kurator E4 27.11: na grafie E4 x 625–735 chodnik z krawężnikiem przy jezdni; zostaje x 806–872 (T-173, przystanek)."
```
