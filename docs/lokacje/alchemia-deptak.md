# Deptak Alchemii na Lubartowskiej i jego nocny koniec (`alchemia-deptak`)

Lubartowska od Bajkowskiego do Olejnej (w216497220, od (442,9; −9,9) do (454,9; 42,8), 54 m) zamieniona w deptak bez aut (T-324, wariant W2 do Olejnej, decyzje użytkownika 15.11 i 19.11). Po zachodniej stronie dawnej jezdni stoją kioski i stragany (`deptak-stalls.ts`), na wschodniej ścianie kamienicy Lubartowska 11 wiszą neony z planszy (C7), a południowy koniec przy Bajkowskiego ma nocny wózek yatai pod trzema sznurami lampionów (`deptak-night.ts`, prośba użytkownika z 22.11). Deptak łączy pieszo plac przed frontem, trójkątny pawilon, wylot metra B i schody na T1. Stan gry na `22b1808`.

## Historia
Lubartowska była główną ulicą żydowskiego Lublina. Dalej na północ, pod numerem 85, stoi gmach Jesziwas Chachmej Lublin, uczelni rabinicznej otwartej w 1930 roku. W 1941 roku Niemcy zamknęli tę część miasta w getcie, a wiosną 1942 roku wywieźli większość jego mieszkańców do obozu zagłady w Bełżcu. W chodnikach Lubartowskiej leżą dziś kamienie pamięci Stolpersteine (w danych mapy węzły `memorial=stolperstein`, ok. 75 m od południowego końca deptaku), a plac przy Arkadach nosi nazwę Placu Ofiar Getta (karta `alchemia-t2-arkady`). Po wojnie Lubartowska stała się trzypasmową ulicą jednokierunkową na północ z siecią trolejbusową i przystankiem Brama Krakowska 01, a na rogu z Bajkowskiego stały kasy biletowe MPK (`docs/plany/alchemia.md`, §2, S1).

W 2077 roku odcinek przy Alchemii jest deptakiem. Kiosk MPK na rogu sprzedaje e-karty, jak dawne kasy, kiosk Ruchu prasę i papierosy, budka na północy naprawia telefony i tanie implanty, a stragany z warzywami nawiązują do targu przy Ruskiej. Sprzedawcy podpięli lampy pod daszkami do słupa sieci trolejbusowej kablem na taśmie (§3). Neony SPOŻYWCZY i PARKING CAŁODOBOWY na kamienicy naprzeciw świecą tak samo jak na planszy, a cyjanowy ALCHEMIA prowadzi wzrok wzdłuż ulicy. Po zmroku przy słupkach od Bajkowskiego kucharz z yatai karmi nocnych gości pod czerwonymi lampionami chōchin, jak w tokijskim yokochō. Miasto pilnuje, żeby żaden z tych neonów nie stał bliżej niż 20 m od kamieni pamięci (`memorial-neon-clear`, ADR-0074 §6): od kamienia Placu Ofiar Getta dzieli je 107–115 m.

Przed chwilą (§5, jest w grze): klient yatai odszedł od stołka, a jego miska dalej paruje na desce lady (449,4; −6,6). Herbata sprzedawczyni kwiatów paruje na końcu lady.

## Klimat
- **Światło:** trzy sznury lampionów chōchin w poprzek deptaku na z −7,2, −4,2 i −1,2 (od attyki pawilonu y 4,4 do ściany kamienicy y 4,6, zwis 0,7 m, lampiony ≥ 3,5 m nad kostką), lampiony i podświetlane menu yatai, holo-cena nad dachem wózka, stojący szyld z czerwonym pasem (449,05; −7,55); lampy pod daszkami straganów; neony na w66286394: pionowy cyjanowy SPOŻYWCZY (x 454,5, z −0,6…2,1, 2,8–6,4 m nad chodnikiem), czerwona tablica PARKING CAŁODOBOWY na najwyższym piętrze, czerwony SPOŻYWCZY w poprzek i pionowy cyjanowy ALCHEMIA (5,5 m, od 4,4 m); trzy latarnie pastorały (440,5; 7,7), (453,8; 22,4), (437,6; 29,6); od zachodu szkło pawilonu na rogu i jego neon. Ciepłe światło jedzenia (yatai, lampiony) i zimny cyjan neonów sklepów mieszają się na mokrej kostce.
- **Dźwięk (cel):** gwar przy kioskach, bulgot garnka yatai, brzęczenie neonów, szum sieci trakcyjnej, deszcz na daszkach straganów, zapowiedzi z przystanku. W grze deptak nie ma własnych źródeł dźwięku (dług).
- **Zapach:** bulion i grill z yatai, cebularze z okienka (443,5; 9,4), kwiaty i ziemia przy straganach, piwo ze skrzynek.
- **Pogoda:** deszcz pada na odkrytą kostkę; mokra ulica odbija latarnie (ADR-0084).
- **Kontrast (§3):** holo-ceny obok tekturowych, lampy straganów na kablu przyklejonym do słupa, yatai stoi na skrzynkach piwa i bierze prąd kablem ze ściany kamienicy.
- **Ruch i życie:** 16 miejsc tłumu (klienci przy okienkach trzech kiosków i przy straganach z warzywami, dwoje przy yatai, `DEPTAK_CROWD`, `DEPTAK_NIGHT_CROWD`), sprzedawcy za ladami i kucharz yatai (postacie z gry), postacie planu przy straganie z kwiatami, okienku z cebularzami i na przystanku.

## Przeznaczenie
- Piesza oś handlu Alchemii: zakupy w kioskach, droga z wylotu metra `kanal` B (hala (426; 27,8), dojście z 24–32 wolne od stoisk) na plac przed frontem i na T1 schodami rampy wschodniej (x 436–442).
- **Wejścia:** od Bajkowskiego za słupkami (z ok. −12), od Olejnej za słupkami (z ok. 39–41), od wylotu metra B, od pawilonu na rogu i osi wejścia głównego, schodami z T1.
- **Osłony:** kioski (441,6; −5), (442,6; 2,4), (445,9; 20,7), okienko z cebularzami, stragany (444,5; 15,4), (448,2; 33,4), (449,9; 37,6), stos skrzynek między straganami z warzywami, yatai, słupy sieci (439,2; 5,9) i (446,3; 36), rząd słupków przy krawężniku.
- **Ucieczka:** w Olejną na wschód, Lubartowską dalej na północ, do metra B, Bajkowskiego, na dach pawilonu po drabinie zaplecza (karta `alchemia-pawilon-dach`).
- **Punkt widokowy:** z południowego końca widać cały deptak pod lampionami aż do Olejnej; z dachu pawilonu na rogu widać deptak z góry.

## Topografia
- Prawdziwe miejsce: Lubartowska w216497220 (3 pasy na północ, asfalt, sieć trolejbusowa, pas postojowy w522482244), kamienica Lubartowska 11 (w66286394, 3 kondygnacje) i Lubartowska 9 (w66286404), przystanek Brama Krakowska 01 (n1088867642, (454,1; 16,2)), Olejna (w173565363). Teren według NMT od −0,4 przy Bajkowskiego do −2,4 przy Olejnej.
- W grze: kostka zamiast asfaltu, 8 stoisk na zachodniej części dawnej jezdni, słupki na obu końcach, równe końce kostki (T-324 z dopiskami C7 i z 21–22.11). Przystanek i słupy sieci zostają. Pawilon na rogu: T-230, T-231. Wylot metra B: T-157. Chodnik Lubartowskiej przy rampie E zapada się pod NMT (T-338, G-955), nierówne stopnie rampy E (G-956).
- Odstępstwo celowe: deptak zamiast ulicy (T-324, powód z rozgrywki: piesza oś między T0, metrem B i T1). Sprzeczność planu i gry: plan kuratora (`docs/world/alchemia-deptak-rampa.md` §1, W2) przewidywał trolejbus w tempie pieszym i dostawy 6–11, a w grze nie ma tu ani trasy trolejbusu (odcinek 74 m krótszy od `MIN_TROLLEY`), ani dostaw (T-324). Sieć trakcyjna wisi więc bez trolejbusu.

## Inwentarz docelowy
- **Architektura:** kostka dawnej jezdni (jest), słupki na końcach (są), sieć trakcyjna na słupach (jest), pierzeja kamienic z lokalami na parterze i neonami (są), nawierzchnia pasa między kostką a chodnikiem kamienicy pod yatai (dziś goły grunt, x 448,8–451,9).
- **Duże obiekty:** trzy kioski, okienko z cebularzami, trzy stragany, automat z napojami (452; 38,5), wiata przystanku (meble mapy, `lublin-props.todo.json`, `lubartowska-deptak.*`); yatai z kołami, dachem, noren i stołkami (jest, rysunek i bryła z pudełek, `deptak-night.ts`); skrzynki piwa, stos skrzynek z towarem (są); kosz, latarnie.
- **Drobiazg w skupiskach (§14):** na straganach skrzynki z warzywami, wiadra kwiatów, holo-ceny, tekturowe ceny, kartony, ulotki, herbata z parą (są); przy yatai puszki, ulotki, miski (są); do dołożenia przy kioskach: bilety, gazety w stojaku, części telefonów i taśma w budce naprawy, niedopałki przy przystanku (Street Asset Pack, ADR-0096).

## Frakcja i zasady
Frakcja: ulica (handel z kiosków i straganów, nocny yatai).
- §12 zgodne: z ciasnego wylotu metra B i spod płyty L2 wychodzi się na szeroki deptak; na południu przestrzeń zamykają sznury lampionów między pawilonem a kamienicą (niski „sufit” ze światła), na północy otwiera się Lubartowska. Próg na końcach daje zmiana nawierzchni (kostka i asfalt) i rząd słupków. Wymiary z obrysów OSM, poza siatką 0,5 m (§1).
- §13 częściowo: każde światło ma oprawę (lampiony, lampy straganów, neony na wspornikach, latarnie). Ciepłe światło jedzenia zgodne z §4. Pomiar 60-30-10 nocą nie istnieje. Wylot metra B i schody na T1 nie są wyróżnione zielenią nawigacji. Pomiar nocny 24.11 (22:00, ujęcie `alchemia-deptak` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 73,7/22,9/3,4, zgodne.
- §14 częściowo: trzy warstwy przy straganach i yatai, skupiska przy ladach. Kioski mają tylko klientów, bez drobiazgu.
- §15 zgodne: mokra kostka z odbiciami latarni i neonów, szkło pawilonu; mat drewna yatai i kartonów obok.
- §16 zgodne: prowizorka ulicy (kable na taśmie, skrzynki jako podstawa) przy szkle galerii i neonach.
- §17 częściowo: skalę dają lady (1,05), stołki (0,5), słupki i drzwi kamienic. Ruch: klienci, para nad garnkiem i herbatą. Dźwięku ze źródła brak. Yatai, kucharz i jego goście stoją także w dzień, choć to scena nocna.

## Scenariusz tła
- Kto tu bywa: klienci kiosków (prasa, papierosy, naprawa telefonów i tanich implantów), straganiarze z warzywami, sprzedawczyni kwiatów; pasażerowie z wylotu metra `kanal` B w drodze na plac i na T1; po zmroku nocni goście yatai pod lampionami chōchin.
- Co się dzieje: w dzień deptak jest osią handlu Alchemii, a ludzie z metra przechodzą między kioskami na plac przed frontem; wieczorem zapalają się SPOŻYWCZY, PARKING CAŁODOBOWY i cyjanowy ALCHEMIA, a kucharz z yatai karmi gości przy słupkach od Bajkowskiego.
- Ślad obecności: parująca miska na desce lady yatai, herbata na końcu lady kwiaciarki, kabel lamp straganów przyklejony taśmą do słupa trakcji.

## Dług sceny
- Pora yatai: wózek, lampiony nad nim i kucharz stoją przez całą dobę (`DEPTAK_NIGHT_PIECES`, `DEPTAK_NIGHT_PROPS`, `DEPTAK_NIGHT_CROWD` bez godzin). Propozycja: w dzień wózek złożony (plandeka zamiast noren, bez kucharza i klientów), wieczorem rozstawiony; plan dnia kucharza w `packages/sim/src/content/schedules.ts`, rysunek pory w `packages/engine/src/renderer/alchemia/deptak-night-geometry.ts`.
- Nawierzchnia pasa pod yatai i stołkami (x 448,8–451,9, z −8…−4), dziś goły grunt (klasa G-726): obszar kostki w korektach importu (`tools/osm-import/src/corrections-alchemia.ts`), z wierszem T i przeglądem `topography-curator`.
- Drobiazg przy kioskach MPK, Ruchu i naprawy telefonów: części na końcu listy w `packages/sim/src/content/alchemia/deptak-stalls.ts`.
- Zielone wyróżnienie wylotu metra B i schodów na T1 od strony deptaku (§13 nawigacja): rysunek w `packages/engine/src/renderer/alchemia/deptak-sign-geometry.ts` albo pas LED przy wylocie w `packages/engine/src/renderer/metro/pavilion-signs.ts`.
- Źródła dźwięku: garnek yatai, neony, sieć trakcyjna, przystanek: mapa źródeł na zewnątrz w `packages/engine/src/audio/`.
- Chodnik i stopnie przy rampie E (G-955, G-956): `packages/sim/src/content/alchemia/terrace-steps.ts` i teren w imporcie.
- Pomiar §13: ujęcie nocne z południowego końca deptaku pod lampionami (ok. (445; −10), na północ) w `tools/shots/room-spots.json`.
