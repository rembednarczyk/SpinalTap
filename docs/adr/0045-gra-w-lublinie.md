# ADR-0045: Gra w Lublinie: świat gry na dwudziestu chunkach Lublina

## Kontekst
ADR-0042 do ADR-0044 dały Lublin z danych mapowych (20 chunków, 611 budynków, nawierzchnie, teren NMT), bryły wypukłe i teren w symulacji oraz renderer miasta. Gra dalej toczyła się w starym mieście z bloków (Shinsekai 7, Ulica Kanałowa, Targ pod estakadą, Doki). Ta zmiana przenosi grę do Lublina: cały świat, wszystkie postacie, zlecenia i wątek główny, z zachowaniem identyfikatorów dystryktów (`shinsekai-7`, `kanal`, `targ`, `doki`) i treści ink (nazwy w ink zmieniła narracja, `docs/narrative/lublin-names.md`).

Ograniczenia: zasady z `CLAUDE.md` (`core` bez zależności, `sim` tylko `core`, Babylon tylko przez `engine/src/babylon.ts`, determinizm, limity ADR-0031), telefon w jakości `low`, cały wątek do przejścia, bez dotykania plików `.ink`.

## Decyzja

### Świat
- `WORLD_CHUNKS` powstaje z `MAP_CHUNKS` (`sim/src/content/world-map.ts`): każdy chunk mapy z budynkami jako bryłami, terenem po kształtowaniu i rekwizytami oraz postaciami gry, które w nim stoją (chunk z pozycji). Kolejność chunków to kolejność tworzenia i rezerwacji identyfikatorów encji.
- Budynek mapy to rekwizyt statyczny `building` z `prisms` z części wypukłych i flagą `scenery`: w symulacji jest tylko bryłą (encja bez widoku). Teren, nawierzchnie i budynki rysuje `MapCity` raz, jako scenografię: `RenderSync` dostaje `WORLD_SCENERY` i wysyła je portem renderu z identyfikatorami od `SCENERY_ID_BASE` (5 000 000), niezależnie od streamingu. Streaming dotyczy więc tylko treści gry, a obraz miasta jest zawsze cały (`MapCity` ma własne LOD z ADR-0044).
- Stare bloki dzielnic znikają. Zostają scenki gry przeniesione w całości: targ (ramka `MARKET_PLACE`, plac 755..815 × 316..376 pod wiaduktem nad aleją Tysiąclecia), nabrzeże (`DOCKS_PLACE`, plac 2520..2594 × 390..450, basen 452..500), myjnia (`CAR_WASH_PLACE` na Placu Łokietka). Pod nimi budynki mapy ustępują (`CLEARED_BUILDINGS`), a przy nabrzeżu także nawierzchnie (`CLEARED`).
- Teren jest kształtowany tak samo dla każdej siatki (bez szwów): płaskie pola pod scenkami i pokojami (`PADS`, poszerzone o komórkę siatki, z przejściem), rampy wzdłuż schodów z OSM (`RAMPS`). Wysokość punktu w treści: `ground(x, z)` z pierwszego chunka w kolejności tabeli, jak w `GroundField`.
- Bramy Starego Miasta są w mapie bryłami. Przejścia (`PASSAGES`) wycinają parter wzdłuż ulicy: Bramowa przez Bramę Krakowską (relacja OSM 7224409) i Grodzka przez Bramę Grodzką (droga 232362876), 3,4 do 3,6 m szerokości i 4,2 m prześwitu, z otworami w fasadach. Krakowskie, Stare Miasto i Podzamcze są przechodnie pieszo (test w `streaming.test.ts` i e2e `streaming.spec.ts`), Nabrzeże tylko metrem.
- `FarCity` jest wyłączone w grze (`farCity: false`): miasto z mapy samo wypełnia horyzont do płaszczyzny 320 m.
- Mgła nocna 0,021 na 0,0115, dzienna 0,011 na 0,007: Brama Krakowska z deptaka (około 70 m) i Zamek z Placu Zamkowego (około 100 m) są czytelne.

### Wnętrza
Klinika Mori i Neon Koi zachowują układ z ADR-0038, obrócony na fasady kamienic (`frameOf`, X = ox + z_stare, Z = oz − x_stare, yaw + π/2):
- klinika: kamienica OSM `w67499277`, północna pierzeja Krakowskiego Przedmieścia, bliżej Placu Litewskiego, pokój x 318..325, front z = −72,5, drzwi (321,4; −73,6); fotel startu (319,6; −0,05; −64,86), yaw π/2;
- Neon Koi: kamienica `w66330644`, naprzeciwko kliniki, pokój x 306,5..324,5, front z = −94, drzwi (315; −92,9).

Bryła kamienicy dzieli się prostokątem pokoju: poza nim pełne pryzmaty, nad nim pryzmat od stropu pokoju (podłoga + 4,2 m). Fasada dostaje otwór drzwi (`Doorway`), szyld pokoju zastępuje szyldy sklepowe mapy na tej kamienicy.

### Gdzie co stoi (współrzędne świata, x wschód, z północ, kotwica Plac Litewski)
- Krakowskie Przedmieście: Kaito przy fotelu (320,2; −66,2), potem przy barze Neon Koi (317; −99,8); Mori przy monitorach (322,2; −63,3); Ume na deptaku przed kliniką (328,5; −76,8); kurier i strażnik M0 na podwórku za myjnią przy Placu Łokietka (424; −109) i (420,5; −112,5); wrak i brama przy Placu Litewskim (150; −20); parking z furgonetką (100; −30); podwórko za Neon Koi (300; −132); metro Plac Litewski (158; −58,5); ławki Placu Litewskiego jako miejsca aktywności.
- Stare Miasto: SAKE przy Rynku (Hideo, 547,5; −71,5), KARAOKE przy Rynku (Mei, 556; −38,5), DENKI na rogu Rynku (Tetsu, 571,5; −31), dom Hideo na Bramowej (492; −80), kryta kładka nad Grodzką (659; 74) z miejscem zlecenia `kanal_bridge`, skrytka pod Bramą Krakowską od strony deptaka (459,5; −99), metro Brama Krakowska (492; −80), przystanek Hideo na Zamkowej pod Bramą Grodzką (730; 155).
- Podzamcze: targ pod wiaduktem (Hana, Oyaji, Fumiko, Kenta, Goro, kiosk Sachiko, czujka Hebi, Kurosawa na pokładzie wiaduktu), metro Plac Zamkowy (717,5; 296).
- Nabrzeże Bystrzycy: plac kontenerowy, dźwig i biuro Tessen, Genzō (2580,6; 397,6), terminal pod dźwigiem, metro Nabrzeże Bystrzycy.

### Postacie i ruch
- Harmonogramy liczą drogę po ulicach Lublina. Minuta gry to godzina dnia (ADR-0017), więc 300 m dojścia to cztery godziny: Hideo czeka na autobus Tessen na Zamkowej, a do SAKE wychodzi o 17:00.
- Postać z harmonogramem zasypia z chunkiem dopiero wtedy, gdy ani jej chunk, ani chunk, w którym stoi, nie zostaje wczytany (`WorldStreamer.unload`). Bez tego Hideo znikał w połowie Grodzkiej, gdy gracz szedł za nim.
- Pasy tłumu powstają z ulic pieszych OSM w chunkach Krakowskiego i Starego Miasta (`streetLanes`), z odstępem od ścian i rekwizytów gry; przechodnie tła mają miejsca przy witrynach i ławkach.

### Kamera TPP
Engine nie zna brył symulacji. `CameraRig.setOccluder(fn)` przyjmuje funkcję `(origin, dir, maxDist) => number | null`; app (`main.tsx`) podaje ją z `rayGeometry` symulacji (pryzmaty i teren DDA z ADR-0043). Kamera sprawdza ją po swoim `pickWithRay` i bierze bliższe trafienie. Granica pakietów zostaje: app zna oba, engine tylko typ funkcji.

### Zmiany kontraktów
- `core/ports/types.ts`: widok `building` ma `doorways?: readonly Doorway[]`; `neon` i `lamp` mają `facing?: BlockFront`, lampa ma `color`.
- `core` (teksty domeny, właściciel Core Domain): etykiety `CONTRACT_SITES`, cele zadań aktu II („wiadukt nad aleją Tysiąclecia”), pierwszy cel M0, nazwa frakcji cywilów „Mieszkańcy Lublina”.
- `SAVE_SCHEMA_VERSION` 14 na 15 z migracją (niżej).

### Mapa
Minimapa rysuje nawierzchnie, budynki i nazwy ulic z mapy pod blokami gry, w oknie 200 m wokół gracza (komórki 32 m). Ekran postaci ma piątą zakładkę Mapa (M): całe miasto z nazwami ulic, dystryktów, zabytków i stacji metra, przesuwanie i zoom, skoki do dystryktów. Pokłady i poziom gracza na minimapie liczą się od gruntu. Autorstwo danych: mały napis w menu tytułowym, pełny na stronie „Autorzy” i na mapie: „© OpenStreetMap contributors (ODbL), teren: GUGiK NMT”.

### Zapis v15
Pozycje starszych zapisów nic już nie znaczą. Migracja 14 na 15: gracz budzi się na fotelu w klinice z całym dobytkiem, inne zapamiętane encje znikają (wracają z treści, martwi zostają martwi przez flagi), drzwi zamknięte, chunki wczytują się wokół gracza, torby ze starych ulic leżą na podłodze kliniki z zawartością, skrytka jeszcze nieopróżniona trafia na nowe miejsce pełna, ostatnia znana pozycja pościgu znika, przejazd metrem trwa dalej.

### Determinizm
Złote hashe zmienione świadomie (`vitest -u`), bo zmienił się świat, a potem wersja zapisu:
- przebieg wzorcowy: 181fbc08 → 1e12cc3f (świat) → ca34413e (wersja 15);
- pojedynek wręcz: 74312929 → df9262a6 → 9dbab235;
- przebieg bez pól v13: 09a78a85 → 32388f9c;
- historyczny hash ADR-0026 (35b2130d) usunięty: zamrażał przebieg, który wczytywał Ulicę Kanałową, a Stare Miasto jest teraz 140 m od tego przebiegu.

### Budżety wydajności
Nowe sceny w `tools/perf-budgets.json` i `e2e/npr-perf.spec.ts`, z pomiaru przy krokowaniu gry z testu (ADR-0046), wywołania rysowania / aktywne siatki, budżet kilka procent wyżej:

| Scena | Pomiar | Budżet |
|---|---|---|
| `reference` (Neon Koi od deptaka) | 179 / 73 | 185 / 76 |
| `krakowskie-tpp` (deptak na zachód od kliniki) | 365 do 369 / 156 | 378 / 160 |
| `rynek-tpp` (Bramowa i Rynek) | 204 / 80 | 210 / 84 |
| `podzamcze-tpp` (targ pod wiaduktem) | 289 / 114 | 296 / 118 |
| `nabrzeze` (nabrzeże nocą) | 266 / 114 | 272 / 118 |
| `phone-low` (800 × 370, `low`, dotyk) | 231 / 145 | 237 / 150 |
| `models` (12 ubranych postaci w zasięgu) | 480 do 483 wywołań | 495 |

Czas klatki trafia tylko do raportu. Pod SwiftShaderem klatka Lublina to około 600 ms po stronie GPU (CPU 3 ms), więc kadr wzorcowy po zbudowaniu miasta wokół kamery przestaje się rysować (`still`), a migawka czeka na ten stan.

### Testy
Według ADR-0046 spece `streaming`, `docks` i `market-contract` zastąpił test sesji `packages/app/test/lublin-session.test.ts` (przejście przez obie bramy na targ z zapisem i odczytem, metro z Placu Zamkowego na Nabrzeże i zlecenie Genzō, zlecenie Hany na targu). Zapis starszej wersji ładuje test `packages/app/test/lublin-save.test.ts`.

## Konsekwencje
- Engine liczy wysokości dekoracji od gruntu (`DressingInput.ground`, `planSignage(chunks, ground)`): pokład wiaduktu, odbicia neonów i szyldy stoją na terenie Lublina, a nie na y = 0.
- Proceduralne szyldy i dressing z ADR-0027 i ADR-0030 dotyczą tylko bloków gry (targ, nabrzeże, myjnia). Kamienice Lublina mają własne witryny i neony z ADR-0044.
- Testy jednostkowe i e2e mają te same znaczenia w nowych miejscach. Debug API ma `place(frame, x, y, z)` dla ramek scenek (`market`, `docks`, `clinic`, `koi`) i `walk(route)` do przejścia trasy w stronie.

### Do dopracowania
Krakowskie Przedmieście:
- wnętrza kliniki i Neon Koi to dalej proste bryły w kamienicy, bez stropu łączącego się z fasadą i bez witryn widocznych od środka;
- poświata neonów z deptaka prześwituje przez ściany kliniki (halo rysowane bez testu głębi);
- wrak, parking i myjnia to bloki z dawnego miasta; ławki Placu Litewskiego są tylko miejscami aktywności, bez modeli;
- brzęczenie neonów i para z kratki tylko na deptaku (`DISTRICT_M0_PROPS`), nie w całym mieście;
- mieszkańcy idą po pasach z ulic pieszych, bez przejść przez jezdnię i bez ruchu aut.

Stare Miasto (wyściółka bram, kładka, patrole Hebi i Trasa Podziemna zrobione w ADR-0048):
- DENKI i KARAOKE to szyldy na kamienicach mapy bez wnętrz;
- dalsze punkty w „Do dopracowania” ADR-0048.

Podzamcze:
- targ to scenka z dawnego miasta przeniesiona w całości pod wiadukt; nie odpowiada hali na Nowym Placu Targowym;
- wiadukt gry nie jest wiaduktem z mapy, a dworzec autobusowy nie jest modelowany;
- zejście z Bramy Grodzkiej na Plac Zamkowy idzie po rampach z terenu, bez schodów jako brył.

Nabrzeże Bystrzycy:
- plac kontenerowy i basen (wykopany 3 m) są scenką gry; Bystrzyca z mapy jest węższa niż basen;
- dojście tylko metrem, bez drogi pieszej z Podzamcza; barka to sylwetka.

Ogólne:
- `FarCity` wyłączone; po ewentualnym włączeniu potrzebuje pierścieni dopasowanych do kształtu Lublina;
- dojścia postaci są długie (cztery godziny dnia na 300 m); harmonogramy innych postaci warto przejrzeć pod kątem dystansów;
- migracja v15 zapomina stan postaci poza graczem (zdrowie, posterunki).
