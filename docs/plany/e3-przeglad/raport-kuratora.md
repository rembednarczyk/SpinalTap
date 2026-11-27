# Przegląd kuratora topografii: ADR-0104 E3 z wyjątkiem T-360 (27.11)

Gałąź `feat/grunt-z-grafu-ulic-e3` @ e5b597fe, tablice z commita (bez przebudowy). Porównanie: `origin/main` (62246ee7), commit E3 `ea35ca68` i HEAD. Ortofoto PZGiK, nalot 12.04.2025 (arkusz M-34-34-A-c-2-1, piksel 5 cm), pobrane przez WMS HighResolution z rozdzielczością 0,08–0,1 m (sonda `topo-hr.ts`, User-Agent narzędzia). Pakiet `pnpm topo:review`: teren i pomosty bez zmian (0 punktów), złote hashe zgodne.

Sondy i zrzuty: `/tmp/claude-0/-home-user/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad/topo-e3p/` (`img/*.png`, `topo_lib.py`, `topo-*.ts`), pakiet przeglądu w `.../scratchpad/topo-e3/topo-review.md`. Kolory zrzutów: czerwony jezdnia, niebieski chodnik, żółty plac (`square`), różowy ścieżka, zielony trawa, biały przejście; kółka to meble gry (fiolet słupki, żółte ławki, pomarańczowe latarnie), kwadraty to węzły OSM, fioletowa linia to linia słupków OSM, biała oś OSM, turkusowa oś BDOT10k.

## Werdykt: ZGODNE Z UWAGAMI

T-360 jest dobrze ustawione. Na ortofoto jezdnia Lubartowskiej ma 7,65–7,8 m, a Królewskiej przy Placu Łokietka ok. 7,6–7,8 m. Gra ma 7,9 m, czyli 0,1–0,25 m za dużo, głównie po zachodniej stronie. To w granicach dokładności zdjęcia, a BDOT10k (9 m) przykrywał linię słupków. Wyjątek usuwa 3 miejsca `osm-bollard-line-missing` i jedno miejsce G-982 (Lubartowska z Bajkowskiego).

Z 38 nowych miejsc skanu ok. 30 to te same, wcześniej przyjęte miejsca, przesunięte o 0,5–1 m razem z krawężnikiem. Prawdziwe skutki uboczne są dwa:
- szew i uskok na zachodnim chodniku Lubartowskiej (P1, do poprawy przed scaleniem);
- goły pas przed fasadami na południu Placu Łokietka (P2): E3 go zakrywało, T-360 go odkrywa.

Testy, które padają (P7–P9), nie pokazują utraty zgodności z Lublinem: trzeba je przepisać na ich intencję. Uzasadnienia dwóch przyjętych grup bazy w `ea35ca68` są błędne (P6, P10).

## Uwagi

### P1. Lubartowska, zachodni chodnik: szew 5 cm i plac 8 cm niżej (przed scaleniem)
- **Miejsce:** krakowskie-2-0, x 421–433, z −82…−25. Miejsca skanu: `landuse-bare` 430..440 × (−90…−50) (4), `bare-on-cover` 430..440,−90..−80, `ground-strip-gap` 430..440,−80..−70 (431,88; −74,88), `sidewalk-step` 442,−54 (Lubartowska#13 left).
- **Dowód z gry:**
  - Na E3 chodnik zachodni był jednym kawałkiem od krawężnika do fasady w66264120.
  - Na HEAD są dwa kawałki `sidewalk`: pas ulicy do dalszej krawędzi zmapowanego chodnika w1054482102 i domknięcie szczeliny do fasady. Między nimi biegnie szczelina 0,05 m wzdłuż linii (432,27; −81,75) → (430,77; −56,75), czyli 1,28 m od osi w1054482102 (sonda `surf_at`, krok 0,05 m). To nie klin gołej ziemi, tylko szew z zaokrąglenia ukośnej wspólnej krawędzi do 0,1 m, ten sam rodzaj co szczeliny deptaka z rundy 6.
  - Na północ od z −57 (x 421–431, z −57…−25) domknięcie jest placem (`square`, 0,08 m) zamiast chodnikiem (0,16 m), stąd uskok 8 cm wzdłuż x ≈ 430,5. Raster 0,25 m: 168 m² `sidewalk` → `square` przy Lubartowskiej.
- **Ortofoto i OSM:** jedna nawierzchnia z płyt od krawężnika do fasad, bez progu (`img/lub-c.png`, `img/lub-n.png`). Plac w kratę zaczyna się dopiero na z ok. −33, przy Bajkowskiego. OSM nie ma tu placu ani obszaru pieszego, tylko krawędź `landuse=residential` w1208186145.
- **Poprawka:**
  - Domknięcie szczeliny, które styka się z pasem chodnika ulicy, dostaje nawierzchnię `sidewalk`. `square` tylko wtedy, gdy dotyka placu z mapy.
  - Przed zaokrągleniem łączyć je z tym pasem (`join`), żeby wspólna ukośna krawędź nie dawała szwu.
  - Test: punkt (431,25; −64,75) i odcinek x 426…438 na z −45 to `sidewalk` bez przerwy.
  - Wynik: miejsca P1 znikają z bazy zamiast do niej trafiać.

### P2. Plac Łokietka, południe: pas gołej ziemi przed fasadami (później jako glitch, albo razem z P1)
- **Miejsce:** krakowskie-2-0, x 427–437, z −136…−148, między ścieżką w232362953 a fasadami w66335319 i w66335268. Pas ma 5–6 m szerokości i ok. 44 m².
- **Dowód z gry:** na main pas jest goły. Na E3 przykrywał go plac (`square`), na HEAD znowu jest goły (sondy na z −138, −142 i −145). Skan go nie zgłasza: zdjęcie leży tam w cieniu budynku, więc `bare-on-cover` widzi klasę „cień”, a nie nawierzchnię.
- **Ortofoto:** kostka w kratę jak na reszcie placu, widoczna w cieniu (`img/lok-s.png`).
- **Poprawka:** ustalić, czemu wypełnienie wysp grafu (`ISLAND_MAX` 400 m²) albo `kerbGaps` przestało brać ten pas po zwężeniu Królewskiej. Najpewniej dziura połączyła się z większą. Pas wypełnić placem jak na E3. Nie jest gorzej niż na main, więc może to być glitch po scaleniu.

### P3. Królewska#18 na Krakowskim: miejsca przesunięte albo wierne (przyjąć)
- **Miejsca `sidewalk-gap` przy (452; −142), (453; −144) i (444; −119):** to miejsca 451,−142, 453,−145 i 444,−118 z bazy E3, przesunięte o 1 m.
  - (452; −142) i (453; −144) leżą w wylocie drogi serwisowej w755152556 przez plac do przejazdu w755152560. Linie słupków OSM w1514057826 i w1514057828 zostawiają tam przerwę ok. 10 m (z −133…−144), tak samo jak zdjęcie. Brak chodnika przy krawężniku jest tu wierny.
  - (444; −119) to brzeg Placu Łokietka: plac z mapy sięga krawężnika, więc też wiernie.
- **Miejsca `sidewalk-step` po wschodniej stronie przy (447; −132), (450; −139), (453; −144) i (454; −146):** to znany rodzaj, styk `sidewalk` z `footway` przy fasadach. W rzeczywistości nawierzchnia jest jedna, płaska. To przesunięte klucze z bazy E3 (449,−137, 449,−138, 452,−144, 454,−147), nie nowy błąd.
- **Poprawka:** przyjąć z uzasadnieniem „przesunięte z krawężnikiem T-360”. Stopnie `sidewalk`/`footway` zostają w ogólnej sprawie uskoków chodnika.

### P4. Królewska na Starym Mieście: szerokość całej drogi w40052496 (przyjąć, opisać w T-360, później zawęzić wyjątek)
- **Miejsce:** stare-miasto-0-0, x 460–500, z −155…−192.
- **Dowód z gry:** zbiór `half` w tablicach:
  - main: jezdnia 6,05 m;
  - E3: 9,0 m (BDOT10k z przesunięciem osi na SW);
  - HEAD: 7,9 m na osi OSM.
  
  Wyjątek dotyczy całej drogi, więc zmienia też kawałek Starego Miasta, choć ten leży poza grafem (stary model, szerokość z `sourcedWidth`). Inne ulice Starego Miasta mają szerokość bez zmian.
- **Ortofoto** (`img/krol-sm-st1.png`, profil na prostej (464,1; −160,2) → (484,1; −181,0)):
  - pasy ruchu między przerywanymi liniami krawędziowymi 7,8 m (−3,5 / +4,3 m wobec cięciwy osi);
  - od NE pas postojowy do ok. −5,5 m (auta, skrzynka „X”);
  - od SW asfalt do ok. +4,8 m.
- **Wobec zdjęcia:**
  - HEAD (−3,97 / +4,0) jest bliżej niż main (−2,8 / +3,5);
  - od SW HEAD zostawia ok. 0,8 m asfaltu jako plac, E3 przesadzał o 0,5 m;
  - od NE pas postojowy zostaje placem 8 cm nad jezdnią, tak jak na main.
- **Kawałki `square` przy x 461–496:** domknięcia starego modelu dociągnięte do nowego krawężnika. Do przyjęcia: raster 41 m² `road` → `square`, 24 m² gołego na krawędziach chunku i za budynkiem. Goły pas przy (476–480; −181…−185) był na main szerszy (4,5 m wobec 4 m).
- **Nowe miejsca skanu:** `sidewalk-gap` przy (465; −162) i (495; −189) prawa strona, `sidewalk-step` przy (465; −162) i (477; −175). Reszta to przesunięte klucze. Przyjąć.
- **Poprawka (później):** ograniczyć wyjątek Królewskiej do odcinka wzdłuż linii słupków (z > −157, Krakowskie). Odcinek na Starym Mieście zmierzyć osobno: pasy 7,8 m plus pas postojowy po NE, wyjątek z dowodem albo BDOT10k 9 m z jego osią. Wiersz T-360 musi już teraz opisać Królewską i jej kawałek na Starym Mieście (polecenia niżej).

### P5. T-360: dokładność (zgodne)
- **Lubartowska** (`img/lub-st1.png`, `img/lub-st2.png`, profile na osi OSM):
  - krawędź jezdni na zdjęciu −4,0 i +3,65–3,7 m od osi, czyli 7,65–7,7 m;
  - gra −4,2 / +3,7, czyli 7,9 m;
  - środkowa linia na zdjęciu leży na osi OSM;
  - słupki na zdjęciu stoją 0,05–0,15 m za krawędzią, nie 0,3 m;
  - linia w1514057822 na odcinku z −82…−63 odchodzi do 0,4 m na zachód od słupków ze zdjęcia, na z −62…−39 się z nimi pokrywa.
- **Królewska przy Placu Łokietka** (`img/krol-st1.png`, `img/krol-st2.png`): jezdnia ok. 7,6–7,8 m, gra 7,9–8,0 m. Słupki OSM w1514057826 leżą 0,3–0,5 m na zachód od słupków na zdjęciu.
- **Wniosek:** 7,9 m przyjąć. Opcjonalnie 7,7 m z cofnięciem słupków o 0,15 m. Zmiana mniejsza niż 0,25 m, nie warto rundy.

### P6. Ławki n6681995509–11 przy (424; −30): spór nie dotyczy BDOT10k (później jako glitch, poprawić uzasadnienie bazy)
- **Dowód z gry:**
  - W tablicy importu (`props.generated.ts`) wszystkie trzy ławki stoją na węzłach OSM (do 0,1 m), zarówno na E3, jak i na HEAD.
  - Gra zdejmuje je w `clearOfGame` (`street-props.ts`, `KEEP_CLEAR`). Odcinek drogi pijaka `car_wash` (`contract-plans.ts`) z (421; −29,8) do (441; −40) mija je w odległości 0,93 m, 0,10 m i 0,80 m.
  - Na main trzecia ławka stała 1,3 m od węzła, na (426; −29,8), i jako jedyna przeżyła. Pokrywała wtedy zasięg 3 m wszystkich trzech węzłów, więc skan milczał.
- **Wniosek:** uzasadnienie „spór BDOT10k z OSM” w `ea35ca68` jest błędne.
- **Poprawka:** poprowadzić drogę `car_wash` co najmniej 1,5 m od grupy ławek, np. punkt pośredni na północ od nich (ok. (427; −28,5)). Właściciel: `packages/sim` (contract-plans). Drugie wyjście: wyjątek w `KEEP_CLEAR` dla mebli z węzłem OSM. W całym mieście gra zdejmuje 12 mebli z OSM, które import postawił (sonda `topo-fm.ts`), w tym te 3 ławki.

### P7. Test `props-rows` „keeps Plac Łokietka's zebra mouth free” (nowy stan wierny, przepisać test)
- **Dowód z gry:**
  - Tablica: słupki na z −99,5, −97,2 i −91,9. Łańcuch z −99,5 idzie na północ do −97,25.
  - Gra (`WORLD_STREET_PROPS`) zdejmuje −99,5 i −89,3 (drogi treści `GATE_WALK` i `car_wash`), a zostawia −101,2, −97,2, −91,9 i −87,5.
  - Zebra gry na zachodnim krawężniku ma z −93,5…−96,5 i jest wolna. Test ogólny „keeps every post and chain of the city out of the zebras' mouths” przechodzi.
- **Ortofoto** (`img/lok-zebra-w2.png`, 0,04 m): rząd słupków przy x ≈ 439 biegnie bez przerwy co ok. 1,1 m także przed zebrą. Zebra ma 9 m szerokości (z −89,6…−98,6), a w grze 3 m i jest skręcona o ok. 7° (na main o ok. 4°). Na zdjęciu krawędzie zebry są prostopadłe do jezdni.
- **Poprawka testu:** sprawdzać intencję: żaden słupek ani łańcuch w paśmie zebry gry, rzędy po obu stronach do jej krawędzi. Kierunek łańcucha pierwszego słupka jest dowolny.
- **Szerokość zebry:** stare odstępstwo, nie z E3. Nowy wiersz T i glitch (polecenia niżej).

### P8. Test `kerb-bollards` P5, Plac Wolności przy Dolnej Panny Marii (stan bez zmian w treści, przepisać test)
- **Dowód z gry:** E3 i HEAD są identyczne, więc to skutek E3, nie T-360. Rząd przesunął się o ok. 0,4 m na zachód. W promieniu 2 m od (329,5; −181) stoją (328,6; −180,4) z łańcuchem i (330,6; −181,1) jako koniec rzędu. Na main były tam 2 słupki z łańcuchem.
- **Ortofoto** (`img/plw2.png`): jeden ciągły rząd z łańcuchem po łuku narożnika, ok. 7 słupków co 1,2 m, od (324,9; −178,9) do (329,8; −185,6). Krawężnik biegnie łukiem o promieniu ok. 5–6 m.
- **W grze:** i main, i HEAD przerywają rząd na narożniku (przerwy 2,8–3,8 m). Nowy stan nie jest mniej wierny.
- **Poprawka:** test powinien sprawdzać, czy rząd z łańcuchem dochodzi do narożnika (słupek z łańcuchem do 1,5 m od (329,5; −181)). Ciągły rząd po łuku zgłosić jako glitch S4 (później).

### P9. Test `props-fronts`: latarnia deptaka (168; −44,9) → (168,2; −44,4) (nie dotyczy topografii, przyjąć)
- **Dowód z gry:** to latarnia z reguły rzędu, bez węzła OSM (wśród latarń OSM nie ma tu żadnej). E3 i HEAD są identyczne. Nawierzchnia pod nią się nie zmieniła (`square` w obu punktach). Stoi 2,3 m od poidełka OSM n4359229295 (167,5; −46,6), na main stała 1,8 m od niego.
- **Poprawka:** przyjąć nowy punkt w teście, a w commicie podać przyczynę przesunięcia. Nie ustaliłem jej: nie zmienił się ani grunt, ani linia deptaka.

### P10. `bollard-blocks-mouth` (−97; −94) i (−98; −99) (później, poprawić uzasadnienie bazy)
- **Dowód:** w OSM nie ma tu żadnego słupka ani linii słupków (sonda `topo-osm2.ts`). Słupki stawia reguła rzędów, więc uzasadnienie „słupki z OSM” w `ea35ca68` jest błędne. Stoją 2,1 m i 2,8 m od wylotu przejścia w720933804 (`tunnel=building_passage`, (−96,5; −96,1)), bez łańcuchów.
- **Poprawka:** sprawdzić, które ujście (przejście czy drzwi) widzi kontrola, i odsunąć słupki od wylotu przejścia. Glitch S4.

### P11. Próbka miejsc bazy przyjętej w `ea35ca68` wobec main
- **Zgodne albo lepsze niż main:**
  - Narutowicza przy przystanku (234; −164): chodnik ciągły do fasady, krawężnik zgodny ze zdjęciem, słupek przystanku na chodniku jak na zdjęciu.
  - Plac Wolności (355; −170): plac i trawnik zgodne.
  - Kapucyńska (275; −155): rząd słupków przy krawężniku jak na zdjęciu.
  - Świętoduska (365; −35): chodnik od krawężnika do fasady.
  - (−125; −65): pas przy fasadzie częściowo zakryty, na main cały goły.
  - Kołłątaja (−97; −96): krawężnik wschodni o 0,7 m bliżej zdjęcia niż na main.
  - Lubartowska i Królewska: krawężniki w granicach 0,25 m (P5).
- **Z uwagami:**
  - Bernardyńska przy Placu Wolności (376; −197): zygzak G-982 widoczny, zgłoszony.
  - (−94; −177): zebra skośna T-312 jak na main, a łuk narożnika grafu dochodzi do jej końca (`crossing-shape-kerb`), drobne.
  - (336; −230): `lawn-strip-on-paving` to kawałek trawy ok. 3 × 3 m (x 335–338, z −230…−233) na płytach chodnika według zdjęcia. Błąd, glitch S4.
- **Liczby `orto:diff` main → HEAD:** zmienione 19 699 m², `sidewalk` +14 188 m². Pod nowym chodnikiem jest na zdjęciu 560 m² trawy i 939 m² koron (klasa kwietniowa). Bez zmian wobec przeglądu E2.

### P12. Wiersz T-358 nieaktualny (rejestr)
- Opis kolejności źródeł („z BDOT10k… przy braku BDOT10k z OSM, potem z ortofoto”) przeczy kodowi i T-360, gdzie kolejność to OSM `width`, BDOT10k, ortofoto.
- Spór o meble przy Lubartowskiej jest rozstrzygnięty: słupki przez T-360, ławki to P6.

### P13. Znalezisko poboczne: meble z reguły nie są lokalne (później, backlog)
- Zmiana na Krakowskim przesuwa studzienki, naklejki i szafki w innych dzielnicach: na Podzamczu 89 studzienek main → E3 i znowu E3 → HEAD, na Nabrzeżu 17–36, o ok. 0,3–0,9 m.
- To nie jest odstępstwo od Lublina, ale każdy przegląd mapy dostaje szum w innych dzielnicach.
- Wzorzec: ziarno z miejsca (hash pozycji albo id drogi), nie licznik wspólny dla całego miasta.

## Proponowane kontrole skanu
1. **`ground-seam`:**
   - definicja: dwa kawałki gruntu tej samej nawierzchni, rozdzielone pasem bez gruntu węższym niż 0,1 m na długości co najmniej 2 m (próbki co 0,05 m w poprzek wspólnych krawędzi);
   - przypadek: szew P1;
   - baza: do policzenia przez budowniczego (P1 daje 1 miejsce w krakowskie-2-0).
2. **`osm-furniture-dropped-by-game`:**
   - definicja: węzeł mebla OSM, przy którym import postawił mebel tego rodzaju (`LUBLIN_STREET_PROPS`, do 0,5 m), a gra go zdjęła (`WORLD_STREET_PROPS`);
   - baza: HEAD 12 (m.in. 3 ławki P6, ławki n9254081988–93 przy (296–312; −87…−89), n6990596558, 2 słupki, 2 drzewa), main 9.
3. **`bare-enclosed`:**
   - definicja: spójny goły obszar (bez gruntu i budynku) do 400 m², otoczony wyłącznie kawałkami gruntu i budynkami, niezależnie od klasy ortofoto;
   - przypadek: pas P2, który `bare-on-cover` gubi w cieniu;
   - baza: do policzenia.

## Polecenia rejestrów (wykonuje orkiestrator)
```
python3 -I tools/rejestry/rej.py t-append T-360 "Królewska w40052496: ten sam wyjątek 7,9 m (krawężniki 3,95 m od osi, linie słupków w1514057825/826/828); szerokość dotyczy całej drogi, więc także kawałka na Starym Mieście (x 460–500, z −155…−192, stary model): main 6,05 m, E3 9,0 m, teraz 7,9 m; ortofoto tam: pasy 7,8 m między liniami krawędziowymi plus pas postojowy ok. 1,8 m od NE. Przegląd kuratora 27.11: Lubartowska na ortofoto 7,65–7,7 m, Królewska przy Placu Łokietka 7,6–7,8 m, czyli gra o 0,1–0,25 m szersza; ZGODNE. Do zrobienia później: wyjątek Królewskiej tylko do z > −157, Stare Miasto osobnym pomiarem (docs/plany/e3-przeglad/raport-kuratora.md, P4–P5)."
python3 -I tools/rejestry/rej.py t-append T-358 "Kurator 27.11: kolejność źródeł szerokości to OSM width, potem BDOT10k, potem ortofoto (ADR-0104 pkt 4, T-360 jako wyjątek z dowodem); spór o meble przy Lubartowskiej rozstrzygnięty: słupki przez T-360, ławki n6681995509–11 zdejmuje droga treści car_wash, nie BDOT10k (raport-kuratora.md P6)."
python3 -I tools/rejestry/rej.py t-new "Krakowskie, Plac Łokietka, zebra przez Lubartowską/Królewską n481931007 (443; −94,5)" "przejście 3 m (z −93,5…−96,5 przy zachodnim krawężniku), skręcone o ok. 7° wobec jezdni" "ortofoto PZGiK 2025-04: zebra 9 m szerokości (z −89,6…−98,6), krawędzie prostopadłe do jezdni; przed nią rząd słupków co ok. 1,1 m bez przerwy" "geometria (przejście)" "do poprawy (glitch)"
python3 -I tools/rejestry/rej.py g-new "Ławki OSM n6681995509–11 przy Lubartowskiej zdjęte przez drogę pijaka car_wash" --waznosc S4 --zasieg "3 ławki OSM przy (424; −30), krakowskie-2-0" --opis "Import stawia ławki na węzłach OSM, a clearOfGame zdejmuje je, bo odcinek drogi car_wash (contract-plans.ts) z (421; −29,8) do (441; −40) mija je w 0,10–0,93 m (KEEP_CLEAR). Na main jedna ławka stała 1,3 m od węzła i przeżyła. Poprawka: przeprowadzić drogę co najmniej 1,5 m od grupy (np. punkt ok. (427; −28,5)) albo nie zdejmować mebli z węzłem OSM. Przegląd kuratora E3, P6." --status zgłoszone --pakiet "packages/sim (content/contract-plans, street-props)" --test "WORLD_STREET_PROPS ma ławkę do 0,5 m od każdego z węzłów n6681995509–11" --klucze "osm-furniture-missing krakowskie-2-0 424,-31; osm-furniture-missing krakowskie-2-0 425,-31; osm-furniture-missing krakowskie-2-0 424,-30"
python3 -I tools/rejestry/rej.py g-new "Goły pas przed fasadami na południu Placu Łokietka po zwężeniu Królewskiej (T-360)" --waznosc S3 --zasieg "ok. 44 m², x 427–437, z −136…−148, krakowskie-2-0" --opis "Między ścieżką w232362953 a fasadami w66335319 i w66335268 pas 5–6 m bez gruntu; E3 kładło tu plac, T-360 i main nie. Ortofoto: kostka placu w cieniu budynku, dlatego bare-on-cover go nie zgłasza. Prawdopodobnie wypełnienie wysp grafu (ISLAND_MAX) albo kerbGaps po zmianie krawężnika. Przegląd kuratora E3, P2." --status zgłoszone --pakiet "tools/osm-import (streets/graph-bands)" --test "punkty (432; −142), (431; −139), (434; −145) mają grunt square albo sidewalk"
python3 -I tools/rejestry/rej.py g-new "Kawałek trawy na płytach chodnika przy (336; −230)" --waznosc S4 --zasieg "ok. 9 m², krakowskie-2-0" --opis "Graf kładzie trawnik x 335–338, z −230…−233 przy narożniku budynku; ortofoto 2025-04 pokazuje tam płyty chodnika. Przegląd kuratora E3, P11." --status zgłoszone --pakiet "tools/osm-import (streets)" --klucze "lawn-strip-on-paving krakowskie-2-0 330..340,-230..-220"
python3 -I tools/rejestry/rej.py g-new "Rząd słupków z łańcuchem przerwany na łuku narożnika Placu Wolności z Dolną Panny Marii" --waznosc S4 --zasieg "(324–331; −178…−186), krakowskie-2-0" --opis "Ortofoto 2025-04: jeden rząd z łańcuchem po łuku krawężnika (r ok. 5–6 m), ok. 7 słupków co 1,2 m od (324,9; −178,9) do (329,8; −185,6). Gra (main i graf) przerywa rząd na narożniku przerwami 2,8–3,8 m. Przegląd kuratora E3, P8." --status zgłoszone --pakiet "tools/osm-import (props kerb rows)"
python3 -I tools/rejestry/rej.py g-new "Zebra na Placu Łokietka 3 m zamiast 9 m" --waznosc S4 --zasieg "Plac Łokietka (443; −94,5)" --opis "Przejście n481931007 w grze ma 3 m i jest skręcone o ok. 7°; ortofoto 2025-04: 9 m (z −89,6…−98,6), krawędzie prostopadłe do jezdni. Szerokość z domyślnej, OSM nie ma width. Przegląd kuratora E3, P7." --status zgłoszone --pakiet "tools/osm-import (zebra-fit)"
python3 -I tools/rejestry/rej.py g-note G-982 "Kurator 27.11: T-360 usuwa miejsce Lubartowska z Bajkowskiego (kerb-jag krakowskie-2-0 430..440,-30..-20)."
```
