# Plan kuratora: deptak i przesunięta rampa P−1 (ADR-0074, decyzje 15.11)

Stan: main @ a3b638c (z drzwiami metra B na P−1). Decyzje 19.11 pod nieobecność użytkownika (polecenie z 18.11: rekomendowane decyzje bez czekania): deptak W2 (z trolejbusem), do Olejnej, rampa A. Użytkownik może je zmienić. Dane: `data/osm/krakowskie.json` i `stare-miasto.json`, rzut z `tools/osm-import/src/project.ts` (x na wschód, z na północ), teren z `groundY` (NMT po padach). Numery T według main (ostatni T-323). Przed etapem trzeba je sprawdzić jeszcze raz.

## 0. Jak czytam planszę
- „Rzut” w decyzji to widok główny planszy. Rzut kondygnacji w lewym dolnym rogu nie pokazuje ulic.
- Widz patrzy z góry na północ zza Ratusza, mniej więcej z miejsca zrzutu `za-ratuszem` (420; −48):
  - Na pierwszym planie biegnie ulica w poprzek kadru, a auto skręca z niej w rampę. To Bajkowskiego w40052294: jednokierunkowa na wschód, na z ≈ −16, przy dzisiejszym wjeździe.
  - Po lewej stoją kamienice za niskim, zielonym skrzydłem, a teren opada. To Świętoduska z pierzeją w66330811 i w66330804. Teren schodzi do T2 (−9).
  - Po prawej ulica biegnie w głąb, ma ciągłą pierzeję kamienic z lokalami na parterze, a od strony kompleksu kioski. To **Lubartowska**. Jej wschodnia pierzeja przylega do chodnika: w66286394, w364550281, w66286395, w66286397, w66293149, w232362884. W OSM są tam piekarnia i garmażerka, a na planszy szyldy SPOŻYWCZY.
- Bajkowskiego nie może być deptakiem, bo prowadzi auta do rampy. Na jej południowej stronie jest parking i Ratusz, a nie pierzeja.
- Świętoduska leży po lewej stronie planszy, bez rampy i bez kiosków.
- W głębi deptaku na planszy jadą auta. Deptak to więc odcinek, za którym ruch wraca.

## 1. Deptak: Lubartowska od Bajkowskiego do Olejnej

**Ulica i odcinek:** w216497220 „Lubartowska”, od (442,9; −9,9) do (454,9; 42,8), 54 m.
- W OSM to `residential`, 3 pasy, jednokierunkowa na północ, asfalt. Jezdnia ma 9,5–11 m (`half` 4,5–6,35).
- Krótki odcinek w173533826 (z −15,8…−9,9) zostaje skrzyżowaniem dla aut.
- Na końcach stoją słupki z wjazdem dla dostaw w godzinach 6–11, jak na innych deptakach (`DELIVERY_HOURS`):
  - na południu linia od narożnika pawilonu (432,3; −8,2) do wschodniego krawężnika (448,2; −9,9);
  - na północy linia przy Olejnej, z ≈ 43.
- Nazwa zostaje bez zmian („Lubartowska”), zmienia się tylko ruch.

Dlaczego ten odcinek:
1. Obejmuje cały front T0 od strony Lubartowskiej: trójkątny pawilon (T-230), wylot metra B (T-157) i wschodnie schody z T0 na T1 (T-208, x 436–442). Deptak łączy pieszo T0, metro B i T1.
2. Kończy się na prawdziwym skrzyżowaniu. Olejna (w173565363, w OSM wpada w Lubartowską) i dalsza Lubartowska zostają ulicami z ruchem, tak jak w głębi planszy.
3. Ma najmniej skutków ubocznych: zajmuje tylko 16 m pasa postojowego w522482244 (z 27…43). Pas w522499471 i dojście do Arkad zostają przy ulicy z autami.

**Wariant długi (do decyzji użytkownika):** deptak także na w742414722, do Noworybnej (473; 88), razem 107 m.
- Zalety: obejmuje wejście na piętro Arkad i wschodnie dojście T1 (z 85–95).
- Koszty: pustoszeją pasy postojowe w522482244 do z 88 i w522499471, a ruch zaczyna się dopiero przy Noworybnej (zostaje 95 m Lubartowskiej).

**Trolejbus (jedyne pytanie do użytkownika):**
- **Rekomendacja W2:** bez aut, z trolejbusem. Sieć 156/160 (plan ulic §6) i przystanek Brama Krakowska 01 (n1088867642, ref 1031, (454,1; 16,2), wschodni krawężnik) zostają. „Bez ruchu aut” jest spełnione, a odstępstwo wychodzi najmniejsze. Przystanek nosi tę samą nazwę co stacja metra.
  - Trolejbus jedzie wschodnim pasem w tempie dostaw (3,5 m/s) i ustępuje pieszym.
  - Dla tłumu ten pas jest jak trasa dostaw: `crowd.ts` pomija trasy `deliveries`, więc piesi go przechodzą.
  - Technicznie trzeba nowego użycia albo wyjątku w `lanesOf`, bo trasa trolejbusu musi przejść przez deptak. Inaczej reszta Lubartowskiej (z 43…176, ok. 145 m) spadnie poniżej `MIN_TROLLEY` = 150 i trolejbusy znikną z całej mapy.
- **W1:** deptak bez trolejbusu.
  - Linia na Lubartowskiej znika z mapy, a z nią przystanek. Dochodzi trafienie `osm-furniture-missing` i drugi wiersz T.
  - Słupy trakcyjne (439,3; 5,9), (445; 36,4) mogą zostać jako martwa sieć pod neony.

**Ruch po zmianie (`traffic.ts`, `traffic-ramp.ts`):**
- Pasy :0 i :1 Lubartowskiej na odcinku znikają.
- Ruch z Bajkowskiego skręca tylko na południe, w w40050981 (dwukierunkowa, kostka), i dalej w Królewską. Zgadza się to z OSM, bo w40050981 jest dwukierunkowa.
- Pas północny w40050981 kończy się przy Bajkowskiego, więc musi zawracać. Dziś `deadEnd()` tego nie wykryje, bo Bajkowskiego jest w zasięgu 8 m. Bez poprawki będzie nowe `lane-dead-end` w pobliżu (442; −16).
- Lubartowska od Olejnej na północ zaczyna się bez dopływu, bo Olejna (`living_street` poza `kanal`) w grze nie ma ruchu. Auta pojawiają się więc przy słupkach. Do obserwacji. Opcjonalnie Olejna może dostać ruch.
- `alchemia-p1:out` wyjeżdża dziś w lewo w Bajkowskiego, a potem w lewo na północ Lubartowską. Teraz pojedzie Bajkowskiego na wschód i w prawo na południe, w w40050981 i Królewską. Do zmiany są komentarz modułu i `packages/app/test/alchemia-ramp-traffic.test.ts`. Auto musi zmienić pas na prawy przed skrzyżowaniem, ma na to ok. 30 m.
- `alchemia-p1:in` zostaje bez zmian (lewy pas Bajkowskiego).
- Przejścia: w OSM nie ma przejścia przez Lubartowską na tym odcinku. Przejście przez Bajkowskiego w749050538 (x 433) i przez w40050981 przy z −33 (w755152546) zostają.

**Kioski i stragany:**
- Stoją w zachodniej części dawnej jezdni, od strony kompleksu, jak na planszy. Środek kiosku leży 2,5 m na zachód od osi ulicy, a do linii trolejbusu (+1,6 m) zostaje ponad 3 m.
- Wschodni chodnik zostaje dla lokali w kamienicach (markizy, szyldy).
- Stoiska nie mają fundamentów. Od stanowiska w1559354344 dzieli je 5–7 m, a zasada wykopu ≥ 3 m dotyczy tylko wykopów.

| z | ok. (x; z) | Co |
|---|---|---|
| −5 | (441,6; −5) | kiosk MPK (bilety, karta), nawiązanie do dawnych kas na rogu (T-230) |
| 2 | (442,6; 2,4) | kiosk „Ruch”: prasa, e-karty, papierosy |
| 9 | (443,5; 9,4) | okienko z cebularzami i zapiekankami |
| 15 | (444,5; 15,4) | stragan z kwiatami (naprzeciw przystanku) |
| 21 | (445,9; 20,7) | budka z naprawą telefonów i implantów |
| 24–32 | wolne | dojście z wylotu metra B (431,95; 28) przez chodnik do deptaku |
| 33, 37 | (448,6; 34), (449,8; 38) | stragany z warzywami i owocami pod markizą, na pasie w522482244 (nawiązanie do targu przy Ruskiej) |
| 41 | (451; 41,5) | stragan z używaną elektroniką albo rząd automatów z napojami (plan ulic: automaty) przy Olejnej |

Latarnie pastorałowe, kosze i słupki wzdłuż krawężników zostają z OSM i planu. Słupki na końcach to nowe meble.

## 2. Rampa P−1: kandydaci

Warunki brzegowe:
- stanowisko w1559354344: południowa krawędź od (399,6; 42,7) do (438,6; 30,9);
- hala metra B: x 424,4–431,6, z 26,2–29,8, posadzka −4,31;
- przejście do P−1: x 422–424,4, z 26,5–29,5;
- szyb T-238: x 418,3–421,7, z 12,4–22,6;
- dodatkowo trójkątny pawilon T-230 (narożniki (420,5; −8,85), (432,3; −8,2), (436,2; 6,0)). Nie jest warunkiem brzegowym, ale ma miejsce Rena.

Rampa musi zaczynać się przy ulicy z autami. Lubartowska odpada (deptak), zostają Bajkowskiego i Świętoduska. Spadek liczę do posadzki −6,4. Przykrycie zaczyna się tam, gdzie teren leży co najmniej 2,65 m nad rampą: prześwit 2,2 m, strop 0,3 m i 0,15 m gruntu.

**Odrzucony: narożnik przy deptaku (dosłownie z planszy).**
- Wariant prosty, x 422,3–430,3 od Bajkowskiego na północ:
  - przechodzi przez trójkątny pawilon;
  - stopa przy z ≈ 24 wypada 2 m od hali metra B;
  - wjazd na P−1 musiałby się zmieścić w szczelinie z 22,6…26,5 (3,9 m) między szybem a przejściem metra. Na dwa pasy to za mało.
- Wariant ze skrętem na zachód na południe od szybu: ok. 27 m drogi przy spadku 5,9 m, czyli 22%, ponad 18%.

**A (rekomendowany): w osi kompleksu przy szybie, wjazd od krawędzi Bajkowskiego.**
- Położenie i kierunek: między ścianami x 410,0–418,0 (ściany 409,7–418,3), na północ.
  - Szczyt przesuwa się z z −5,5 na z −8,8, czyli na południową krawędź placu (obrys parkingu (422; −8,8)). Wysokość szczytu −0,94 (NMT).
  - Stopa zostaje na z 24,5, na −6,4.
- Długość i spadek: 33,3 m, spadek 16,4% (dziś 17,8%, w planie 2026 ok. 15%).
- Część otwarta: z −8,8…11 (dziś −5,5…12). Od z 11 rampa jest przykryta schodkowym stropem z prześwitem 2,2 m. Nad portalem jest 0,23 m gruntu (teren −1,46, spód stropu −1,99).
- Warunki:
  - szyb jak dziś (ściana przy ścianie, 0,3 m);
  - metro B 6 m, przejście metra 4 m;
  - stanowisko ponad 20 m od stopy;
  - pawilon trójkątny 2,2 m od ściany przy wjeździe;
  - chodnik w232464426 (oś z ≈ −10,9) poza wykopem, `cut-on-road` = 0. Dlatego szczyt jest na −8,8, a nie −9,0.
- Ruch: wjazd z lewego pasa Bajkowskiego bez zmian. Asfaltowy wjazd przez plac (z −13…−5,5) znika i zostaje tylko przejazd przez ciągłą kostkę chodnika.
- Plansza:
  - rampa prostopadle do ulicy z pierwszego planu, wylot przy krawężniku;
  - po lewej plac z pergolą A i trawnikiem W, po prawej strona deptaku;
  - przejście dla pieszych wzdłuż prawej ściany (`walk` 416,5–418), jak na planszy.
  - Oś hali i kondygnacji to x 418. Rampa leży 4 m obok, bo dalej na wschód jest szyb.
- Koszt: mały.
  - `P1_RAMP.top` −5,5 na −8,8 i `covered` 12 na 11. `yTop` liczy się sam.
  - Grządki przy parapetach i pergola A od z −8: to samo, czym dziś jest `PARAPET_BEDS` od −3,5.
  - Girlandy mają zostać ≥ 4,8 m nad rampą.
  - P−1, kabiny i fartuch bez zmian.
- Uwaga dla użytkownika: przy warunkach brzegowych pas x 410–418 to jedyne miejsce od Bajkowskiego zgodne z planszą. „Przesunięcie” oznacza więc wysunięcie wjazdu do ulicy, a nie zmianę x.

**B: w osi frontu placu od Bajkowskiego.**
- Położenie i kierunek: x 398–406 (oś 402, środek frontu między narożnikiem Świętoduskiej (383,6) a pawilonem (420,5)), na północ.
- Szczyt z −9,0 na −1,26, stopa z 22,3, 31,3 m, spadek 16,4%. Część otwarta z −9…11, potem przykrycie z prześwitem 2,2 m.
- Warunki są spełnione z zapasem: szyb 12 m, metro B 18 m, stanowisko 19 m.
- Kosztem jest układ P−1:
  - stopa trafia na kabiny (x 398–404, z 25–31,6);
  - ściany tną zachodni rząd miejsc z czterema ładowarkami i dzielą P−1 na pas 3,4 m i część 15,7 m;
  - trawnik W i pergola A idą na miejsce dzisiejszego wykopu.
- Plansza: rampa w osi placu, ale na lewo od osi kompleksu (16 m), z placem po obu stronach. Zgodność częściowa.
- Niezalecany.

**C: portal w skarpie od Świętoduskiej.**
- Położenie i kierunek: wylot na wschodnim krawężniku Świętoduskiej, z ≈ 15–23 (jezdnia −4,4…−4,8). Rampa biegnie na ESE, prostopadle do ulicy, do zachodniej ściany P−1 (x 394).
- 14–15 m, spadek ok. 1,9 m, 12–14%.
- Część otwarta tylko x 380…386. Portal stoi w skarpie, gdzie teren ma −2,6…−3,1, a przykrycie ≥ 0,15 m.
- Warunki: stanowisko ≥ 20 m, szyb 25 m, metro B 30 m.
- Ruch: skręt w lewo z lewego pasa Świętoduskiej (jednokierunkowa na południe). Wyjazd w lewo na południe, potem Bajkowskiego, w40050981 i Królewska.
- Zalety: wykop z placu T0 znika, cały plac jest jednym kawałkiem, a rampa jest krótka.
- Wady:
  - wjazd tam, gdzie w OSM i w planie 2026 go nie ma (T-237: „rampa w tym miejscu”);
  - obniżenie chodnika w232464426 o ok. 0,3–0,6 m i wycięcie 8 m pasa w1514058885;
  - `cut-on-road` +1, nowy wiersz T rodzaju teren;
  - na planszy rampa jest z przodu, a nie z boku.
- Do rozważenia tylko wtedy, gdy użytkownikowi zależy na placu bez wykopu bardziej niż na planszy.

## 3. Wiersze T (numery według main; sprawdzić przy etapie)
- **T-324 (nowy):** Krakowskie, Lubartowska w216497220, (442,9; −9,9)…(454,9; 42,8).
  - W grze: deptak bez aut z 8 stoiskami, słupkami na końcach, dostawami 6–11 i trolejbusem w tempie pieszym (W2). Przystanek Brama Krakowska 01 zostaje. Pas w522482244 na z 27…43 jest zajęty przez stragany. Bajkowskiego skręca tylko na południe, a północny pas w40050981 zawraca.
  - W rzeczywistości: 3 pasy na północ, sieć trolejbusowa, pas postojowy.
  - Rodzaj: geometria (ruch), meble.
  - Status: celowe (ADR-0074, decyzja użytkownika 15.11, plansza 01). Powód z rozgrywki: piesza oś handlu między T0, metrem B i T1.
- **T-325 (tylko przy W1):** brak linii trolejbusowej i przystanku na Lubartowskiej w mapie.
- **Dopiski:**
  - T-237: szczyt z −8,8, 33,3 m, 16,4%, część otwarta do z 11, wyjazd na południe;
  - T-241: wjazd asfaltowy przez plac znika, a trasa wyjazdu się zmienia;
  - T-157: wylot B na deptak, korytarz z 24–32 wolny od stoisk;
  - T-230: pawilon na narożniku deptaku;
  - T-145: lista części (deptak T-324);
  - przy wariancie długim T-208 i wpis o Arkadach.
- Poza rejestrem: plan ulic §6 (sieć na Lubartowskiej, przy W1) zmienia budowniczy w tym samym PR.

## 4. Skan (`tools/glitch-scan`)
**Kontrole, które zmiana poruszy:**
- `lane-dead-end`: +1 przy (442; −16), jeśli pas północny w40050981 nie zawraca;
- `kerb-strip-no-car-street`: pas w522482244 przy ulicy dostaw. Wpis do `EMPTY_STRIPS_KNOWN` z T-324 albo stragany jako uzasadnienie;
- `ramp-cars`, `ramp-car-off-lane`, `turn-off-road`: nowa trasa wyjazdu;
- `cut-on-road`: ma zostać 0 przy szczycie −8,8;
- `metro-entrance-blocked`: stoiska poza z 24–32;
- `walk-blocked` i `bollard-blocks-mouth`: słupki na końcach;
- `osm-furniture-missing`: tylko przy W1;
- `metro-shaft-open` i `building-underground-solid`: bez zmian.

**Proponowane nowe kontrole:**
1. `deptak-car-lane`: trasa aut (`use: "cars"`, bez trolejbusu i dostaw) z punktem w pasie jezdni drogi z listy deptaków (po id OSM). Dziś 2 (pasy :0 i :1 na w216497220), po etapie 0.
2. `road-retag-row`: każda droga, której import zmienia użycie (lista deptaków jak `REPLACED_WAYS`, z polem `ref`), ma wiersz T z id drogi. Baza 0.
3. `deptak-stall-clear`: bryła gry na deptaku bliżej niż 1,4 m od linii trolejbusu albo w korytarzu wylotu metra B (x 431,6–447, z 26–30). Baza 0.

## 5. Przed etapem
- Użytkownik potwierdza wariant trolejbusu (W2 albo W1) i długość deptaku (do Olejnej albo do Noworybnej). Rampa: A, chyba że wybierze C.
- Zrzuty przed i po (ADR-0054): `za-ratuszem` (420; −48), czyli kadr planszy, z Lubartowskiej (452; 50) na południe i z wylotu metra B na wschód.
