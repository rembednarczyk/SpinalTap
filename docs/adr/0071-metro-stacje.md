# ADR-0071: Metro: stacje w stylu warszawskim i mapa linii jako nakładka

Status: przyjęta 5.11 (wariant A, decyzja użytkownika). Pozostałe pytania rozstrzyga orkiestrator w duchu szkicu. Wynika z uwag z testowego przebiegu 4.11, backlog „Metro (ADR, mapa i assety)”.

## Kontekst
Użytkownik zgłosił po przebiegu 4.11 dwie rzeczy:
- stacje to niewidoczne, nieintuicyjne skrzynki, a mają wyglądać jak stacje warszawskiego metra (wejście może dalej działać jak skrzynka);
- mapa linii ma być nakładką na obecną mapę, z zaplanowanymi przystankami, podglądem i możliwymi stacjami.

**Jak działa metro dziś** (ADR-0034, ADR-0035, ADR-0036, ADR-0045):
- `core/world/metro.ts`: jedna linia, cztery stacje w kolejności `METRO_STATION_IDS` (`shinsekai`, `kanal`, `targ`, `doki`). Bilet kosztuje 15 €$ plus 5 €$ za przystanek (20–30 €$), przejazd trwa 5 s plus 2 s za przystanek (7–11 s). `metroRefusal` odmawia w trakcie jazdy, poza kioskiem, na tę samą stację, przy zleceniu z heat > 0 (`watched`) i przy braku środków.
- `sim/content/metro.ts`: stacja to kiosk 0,8 × 1,9 × 0,6 m (`glass`) plecami do fasady (`againstWall`) i jedyna bryła stacji. Obok wisi szklany daszek 4,4 × 0,15 × 2 m na 2,9 m, bez podpór, a na bruku leży metalowa płyta 2,6 × 0,04 × 1,6 m („krawędź schodów”). Nie ma otworu ani schodów. Trzy stacje mają neon „METRO” 2,4 × 0,6 m, Nabrzeże nie ma żadnego. Bilet kupuje się do 2,2 m od kiosku, interakcja działa z 1,8 m.
- `sim/world/metro-ride.ts`: bilet zdejmuje gracza z ulicy (jest pasażerem w sesji) i od razu stawia go w punkcie wyjścia stacji docelowej, a streamer w tym czasie ładuje dzielnicę. Przejazd jest w domenie, więc zapis z wagonu wczytuje się w wagonie (od v12, dziś v28).
- Silnik (`renderer/metro-ride.ts`, `metro-plan.ts`): wagon 16 m daleko od miasta, w punkcie (0; 0; −2600), z trzema warstwami paralaksy i 2–4 pasażerami. Sam wagon kosztuje 61 wywołań i 12 siatek (ADR-0036).
- UI: „mapa linii” w kiosku (`ui/metro/metro-panel.tsx`) to lista czterech przystanków z ceną, a bilet kupuje się jednym kliknięciem. Mapa miasta (M) pokazuje stacje tylko jako etykiety „Ⓜ nazwa” w miejscu kiosku (`app/city-map.ts`), bez linii i bez wejść. Test „opens the line map from a kiosk interaction” (`packages/app/test/wave2-session.test.ts`) wysyła `InteractionStarted` z `kind: "metro"` i sprawdza `metroMap.from`.
- Tłum, ruch i meble omijają kioski i rekwizyty stacji (`crowd.ts`, `traffic.ts`, `street-props.ts`), więc przesunięcie stacji zmienia rozstawienie.

**Pomiar** (sonda testem `sim` na danych gry, main a4b7173; odległości w poziomie do obrysów z OSM i do punktów `historic=*` z `data/osm`):

| Stacja (id) | Kiosk (x; z), teren y | Najbliższy zabytek i pomnik | Uwagi |
|---|---|---|---|
| Plac Litewski (`shinsekai`) | (158,1; −57,9), y 0,6 | 3,6 m od upamiętnienia Andrzeja Struga (n12785177414), 13,5 m od tablicy akcesji do UE, 59,5 m od kościoła Piotra i Pawła | stoi na deptaku Krakowskiego, ok. 90 m od środka placu |
| Brama Krakowska (`kanal`) | (489,7; −76,3), y 1,0 | 10,8 m od Bramy Krakowskiej (r7224409) | na Bramowej, w murach Starego Miasta |
| Plac Zamkowy (`targ`) | (716,6; 296,9), y −20,1 | 101 m od Dworca Autobusowego (w66264171), 107 m od Zamku | przy pierzei zachodniej placu, obok targu pod wiaduktem |
| Nabrzeże Bystrzycy (`doki`) | (2527,0; 391,6), y −28,6 | 200 m od Dworku Grafa | plac kontenerowy Tessen, bez szyldu |

Odstępy między kioskami wynoszą 332, 437 i 1813 m. Wniosek: z ulicy widać tylko skrzynkę wielkości człowieka, wiszący daszek i płytę na bruku. Nic nie mówi „tu jest metro” i nic nie prowadzi w dół. Dwie stacje stoją przy zabytkach (upamiętnienie Struga i Brama Krakowska). Żadna nie trafia w dworzec ani w Alchemię.

**Topografia** (ADR-0042). Lublin nie ma metra, więc całe metro to celowe odstępstwo 2077. Dziś opisuje je tylko T-022 („Nabrzeże tylko metrem”). Węzły miasta w układzie gry:
- Plac Litewski: ciąg pieszy placu ze środkiem w (92,8; 7,8). Na placu stoją pomniki Unii Lubelskiej (47,8; −25,7) i Piłsudskiego (−45,9; −13,3), Grób Nieznanego Żołnierza (−57,5; −21,4), fontanna multimedialna (−20; 39) i Ławka Niepodległości (55,6; 52,6).
- Krakowskie Przedmieście: deptak od placu do Bramy Krakowskiej (z ok. −55..−96). Hub gry (Neon Koi i klinika) leży w okolicy (320; −80).
- Stare Miasto: wzgórze (Rynek y −5,6) z piwnicami (Trasa Podziemna 3,95 m pod Rynkiem), wejścia przez Bramę Krakowską (zachód) i Bramę Grodzką (715; 132, wschód).
- Alchemia na Placu Ofiar Getta: hala w (421; 45) frontem na południowy zachód, stoiska na północ od niej (środek grupy (418; 68)), plac na skarpie (y od −1,6 do −9). Teren to stanowisko archeologiczne (w1559354344), a Alchemia już jest tam celowym odstępstwem (T-145).
- Dworzec: w mapie jest tylko Dworzec Autobusowy w66264171 przy al. Tysiąclecia (789; 386, y −20,6), w dolinie Czechówki pod Zamkiem. Lublin Główny (PKP) i Dworzec Metropolitalny leżą ok. (490; −2080) i (630; −1980), czyli 2,1 km na południe od Bramy Krakowskiej, poza prostokątami importu (te sięgają z = −270).
- Nabrzeże Bystrzycy: prostokąt x 2300–2700, za luką T-022 (1180 m bez miasta).

## Decyzja
Do akceptacji użytkownika. Liczby są startowe.

- **Stacje i wejścia (wariant A, zalecany): 4 czynne stacje, 6 wejść, 3 możliwe stacje na mapie.** Id stacji, kolejność, ceny i czas przejazdu zostają, więc zapis i reguły w `core` się nie zmieniają. Stacja może mieć kilka wejść, jak stacja Centrum w Warszawie, a wejście wybiera węzeł miasta.

  | Stacja (id) | Wejście | Miejsce (x; z) ±5 m | Teren y | Odległości (sonda) | Węzeł |
  |---|---|---|---|---|---|
  | Plac Litewski (`shinsekai`) | A „Plac Litewski” | (78; 18), wschodnia część placu | −0,5 | 26 m od Hotelu Europa, 30 m od Urzędu Miasta, ≥ 41 m od pomników i ławki, ok. 95 m od fontann | Krakowskie zachód, plac |
  | Brama Krakowska (`kanal`) | A „Plac Łokietka” | (440; −110), róg Królewskiej, dłuższym bokiem wzdłuż jezdni | 0,0 | 26,8 m od Bramy Krakowskiej, 25 m od Ratusza, 3,6 m od osi Królewskiej (zostają 2 m chodnika), z boku osi deptaka na Bramę | Krakowskie wschód (hub 120 m), Ratusz, Stare Miasto przez Bramę |
  | | B „Alchemia” | (430; 25), plac przed halą od Lubartowskiej | −1,6 | 22 m od środka hali, na skraju placu przy parkingu w173531008, z boku osi frontu hali; 72 m od zabytków, 30 m od budynków z OSM, 19 m od Lubartowskiej; spadek 0,5 m na 5 m | Alchemia, Plac Ofiar Getta |
  | Plac Zamkowy (`targ`) | A „Plac Zamkowy” | (725; 290), 10 m od dzisiejszego kiosku | −20,7 | 11 m od pierzei, 9 m od jezdni placu, 107 m od Zamku | Podzamcze, Zamek, Brama Grodzka |
  | | B „Dworzec” | (760; 375), między dworcem a al. Tysiąclecia | −20,6 | 18,6 m od Dworca Autobusowego, 16 m od Novej, 21 m od jezdni | dworzec autobusowy, przystanki „Muzeum Narodowe – Zamek” |
  | Nabrzeże Bystrzycy (`doki`) | A „Nabrzeże” | (2527; 391,6), w miejscu kiosku | −28,6 | 65 m od budynków | Tessen, Genzō |

  Odstępy między środkami stacji wynoszą 360 m (Plac Litewski – Brama Krakowska), 485 m (Brama Krakowska – Plac Zamkowy) i 1785 m (Plac Zamkowy – Nabrzeże), a cała linia ma 2,63 km. Wejścia jednej stacji leżą 135 m (Brama Krakowska) i 92 m (Plac Zamkowy) od siebie. Żadne wejście nie stoi w murach Starego Miasta.
- **Wariant B (do wyboru):** Alchemia jako piąta stacja `alchemia`, a Brama Krakowska z jednym wejściem. Odstęp Brama Krakowska – Alchemia to 135 m, a pieszo to ok. 30 s (4,2 m/s). Bilet kosztuje wtedy do 35 €$, przejazd trwa do 13 s, a typ `MetroStationId` (używany w `events` i `commands`) dostaje nowy człon, co wymaga zgody architekta. Nie polecam go, bo stacja co 135 m to atrapa.
- **Przebieg tunelu** (tylko linia na mapie, bez geometrii): Plac Litewski → pod Krakowskim → Plac Łokietka → pod Lubartowską (Alchemia) → doliną Czechówki pod al. Tysiąclecia → Plac Zamkowy → wzdłuż al. Tysiąclecia i Bystrzycy → Nabrzeże. Linia omija wzgórze Starego Miasta z piwnicami i wzgórze zamkowe, a schodzi tam, gdzie teren i tak opada (od y 0 do −20).
- **Czas i ceny bez zmian:** przejazd 5 s + 2 s za przystanek, bilet 15 + 5 €$ za przystanek. Od etapu 4 dochodzi zejście z ulicy na peron (ok. 30 m drogi i 8 m w pionie, ok. 8 s marszu przy 4,2 m/s).

  | Trasa | Przystanki | Bilet | Przejazd | Od drzwi do drzwi (etap 4) |
  |---|---|---|---|---|
  | Plac Litewski – Brama Krakowska | 1 | 20 €$ | 7 s | ok. 25 s (pieszo 385 m: ok. 90 s, biegiem ok. 55 s) |
  | Brama Krakowska – Plac Zamkowy | 1 | 20 €$ | 7 s | ok. 25 s |
  | Plac Litewski – Nabrzeże | 3 | 30 €$ | 11 s | ok. 30 s |

- **Pawilon wejścia w stylu warszawskim** (geometria własna, proceduralna):
  - niski pawilon 7,2 × 3,6 m i 3,1 m wysokości: płaski dach z okapem 0,6 m, ściany z szyb w stalowych ramach na cokole z szarego granitu 0,5 m, otwór wejściowy 2,4 m od strony głównego ruchu;
  - w środku schody w dół o szerokości 2,4 m: 16 stopni po 0,17 m do podestu 2,7 m niżej, poręcze ze stali, żółte pasy na krawędziach stopni;
  - na podeście hala biletowa w obrysie pawilonu z biletomatem i dwiema bramkami; peron (etap 4) jest drugim biegiem niżej;
  - pylon 0,5 × 0,5 × 4,2 m przy wejściu, u góry kostka z literą „M” z własnych rurek neonu gry, pod nią tabliczka z nazwą stacji i wejścia;
  - warstwa 2077: ekran z odjazdami nad wejściem, naklejki i kamera nad drzwiami (sam wygląd, bez nowej logiki);
  - **bez znaków Metra Warszawskiego:** nie kopiujemy jego logotypu (kształtu i kroju litery), nazwy, oznaczeń linii M1 i M2, piktogramów ani kroju systemu informacji. Nie odtwarzamy też żadnego konkretnego pawilonu, bo projekt stacji to utwór architekta. Bierzemy wspólne cechy gatunku: niski szklany pawilon, granit, stal i pylon z literą.
- **Wejście dalej działa jak skrzynka.** Interakcja „metro” przechodzi z kiosku na biletomat w hali pod pawilonem (zasięg 2,2 m jak dziś, ten sam `InteractionStarted { kind: "metro", station }`). Przejazd kończy się na podeście wejścia, z którego gracz wsiadł do tej samej stacji docelowej (wejście A, jeśli wsiadał gdzie indziej). Pawilon jest bryłą z otworem: ściany, dach i cokół są solidne, a do schodów prowadzi przejście. Teren i bruk są wycięte tylko pod obrysem pawilonu (szyb do 2,7 m), wzorem wykopu Trasy Podziemnej pod Trybunałem (`PADS`), więc dziury nie widać z ulicy.
- **Mapa linii jako nakładka** (UI; app buduje VM z treści `sim`, UI nie zna `sim`):
  - warstwa „Metro” na mapie miasta (M), na minimapie (sama ikona wejścia) i w biletomacie. Linia biegnie łamaną tunelu w kolorze z palety gry, stacje mają kółko z „M”, wejścia znacznik A/B w miejscu pawilonu, a nazwy są po polsku. Warstwę włącza i wyłącza przycisk w narzędziach mapy;
  - **zaplanowane przystanki:** po wyborze celu mapa podświetla odcinek i przystanki po drodze, z ceną, czasem i liczbą przystanków. Lista z boku (na telefonie pod mapą) zostaje dla klawiatury i czytnika ekranu (`metro-stop-<id>`);
  - **podgląd:** karta stacji celu z nazwą, dzielnicą i wejściami, do 4 rzeczy w promieniu 150 m z istniejących znaczników mapy (sklepy, zlecenia, kryjówki), stanem „ochrona pilnuje peronu”, ceną i czasem. Karta ma przybliżoną mapę okolicy z tej samej siatki SVG, bez renderera i bez zrzutów 3D;
  - **możliwe stacje:** przerywana linia i puste kółko, bez biletu, z podpisem „w budowie” i odległością: Ogród Saski (ok. (−810; 180), 0,9 km na zachód od Placu Litewskiego, przedłużenie linii), Lublin Główny (PKP i Dworzec Metropolitalny, ok. (490…630; −2080…−1980), odgałęzienie na południe od Bramy Krakowskiej) i stacja pośrednia w luce T-022 (ok. (1700; 380); nazwę i miejsce wskaże kurator). Możliwe stacje to dane w `sim` (`METRO_PLANNED`), nie nowe id, więc nie zmieniają kontraktu ani zapisu. Czynne staną się z ADR-em nowej dzielnicy;
  - bilet kupuje się w dwóch krokach: wybór celu (klik, dotyk, strzałki) pokazuje trasę i podgląd, a przycisk „Kup bilet” wysyła `travel-metro`. Esc i E zamykają panel jak dziś.
- **Kontrole** (test `sim` dla każdego wejścia i skan glitchy, baza 0):
  - pawilon nie wchodzi w budynek, stoi ≥ 15 m od zabytku (`historic`, `church`, `civic`) i ≥ 10 m od punktów `historic=memorial|monument` i fontann;
  - zostawia ≥ 2 m chodnika od jezdni i 3 m wolnego miejsca przed wejściem;
  - stoi poza trasami tłumu i węzłami nawigacji (jak dziś w `metro.test.ts`);
  - wykop nie wychodzi poza obrys pawilonu;
  - nowe rodzaje skanu: `metro-entrance-in-building`, `metro-entrance-near-heritage`, `metro-entrance-blocked`, `metro-shaft-open`.
- **Budżety rysowania:**
  - pawilony, pylony, schody i poręcze piekę do istniejących siatek bloku mebli i komórki (ADR-0058), a literę „M”, tabliczki i ekran do siatki szyldów (ADR-0030). Bez nowych wywołań rysowania, do 2 tys. trójkątów na wejście (12 tys. na 6 wejść). Telefon (`low`) dostaje ten sam obrys bez odbić w szybach;
  - halę pod pawilonem i peron budują bloki wnętrza scalane według presetu i komórki 64 m, bez cienia księżyca (ADR-0038). Wnętrze ładuje się tylko blisko, we własnym chunku jak Trasa Podziemna;
  - peron ma do 8 tys. trójkątów (budżet wnętrza z ADR-0063). Wagon stoi na nim jako statyczna siatka z `metro-plan.ts`, bez paralaksy i świateł sceny przejazdu;
  - sceny `npr-perf`: `krakowskie-tpp` idzie deptakiem na wschód i może mieć w kadrze wejście A Bramy Krakowskiej, a z `rynek-tpp` (Bramowa) znika dzisiejszy kiosk. Cel: wywołania i aktywne siatki bez wzrostu. Migawka NPR zmieni się, jeśli pawilon wejdzie w kadr, i trzeba ją obejrzeć przed commitem.
- **Licencje:** pawilon, schody, peron i litera to własna geometria w `renderer/metro/`, bez licencji zewnętrznych. Detale z paczek (bramki, biletomat) tylko na CC0 (ADR-0058) albo CC-BY 4.0 z podpisem (ADR-0063), z wierszem w `packages/app/public/city/README.md` i `sources.json`. Modele z cudzym brandingiem odpadają.

### Pytania do użytkownika
1. Wariant A (4 stacje, 6 wejść, Alchemia jako wejście B Bramy Krakowskiej) czy B (Alchemia jako piąta stacja)?
2. Czy możliwe stacje (Ogród Saski, Lublin Główny, stacja w luce T-022) pokazywać od początku gry, czy dopiero wtedy, gdy zapowie je fabuła?
3. Peron (etap 4): czy przejazd ma się zaczynać przy drzwiach wagonu (bilet przy biletomacie, potem zejście na peron), czy bilet ma od razu uruchamiać przejazd jak dziś?
4. Litera „M” na pylonie: czerwona (skojarzenie z Warszawą, ale własny krój) czy w kolorze linii gry?

## Etapy (osobne PR-y)
1. **Mapa linii jako nakładka** (`packages/ui`, `packages/app`, dane linii w `sim`, bez zmiany reguł). `MapVm.metro` z linią, stacjami, wejściami (na razie dzisiejszymi kioskami) i możliwymi stacjami. Do tego warstwa na mapie miasta i minimapie oraz panel biletomatu z mapą, trasą, podglądem i zakupem w dwóch krokach. Testy komponentów (warstwa, wybór, podgląd, możliwe stacje bez biletu, `watched`) i test sesji: kiosk otwiera nakładkę, a test „opens the line map from a kiosk interaction” zmienia się świadomie, bo bilet wymaga drugiego kroku. Układ na telefonie przez `pnpm e2e e2e/touch-layout.spec.ts`. Złote hashe bez zmian.
2. **Miejsca i bryły wejść** (`sim`). `MetroStationDef.entrances[]` w miejscach z tabeli. Każde wejście dostaje wykop pod obrysem, schody, podest −2,7 m i biletomat (interakcja „metro”), a przejazd kończy się na podeście. Dziś ten etap rysuje proste bloki. Tłum, ruch i meble omijają pawilony. Testy `metro.test.ts` rozszerzone o kontrole wyżej, kontrole skanu i test sesji z zejściem, zakupem, przejazdem i wyjściem na ulicę. Złoty hash zmienia się świadomie (rozstawienie tłumu i mebli). Wpisy T w topografii i przegląd kuratora przed scaleniem.
3. **Wygląd pawilonu** (`engine/src/renderer/metro/`): styl warszawski, pylon „M”, tabliczki, pasy i poręcze, wszystko w istniejących siatkach. Pomiar `npr-perf` przed i po, migawka NPR, zrzuty przed i po z tego samego ujęcia nocą i dniem dla każdego wejścia. Przegląd kuratora (osie widokowe na Bramę Krakowską, Plac Litewski i Zamek).
4. **Peron jako wnętrze** (`sim`, `engine`, `app`): drugi bieg schodów do peronu −8 m, wnętrze ADR-0061 `metro-<id>` z nazwą stacji na ścianie, wagon przy peronie, pogłos i otoczenie wnętrza (ADR-0060). Zakres zależy od odpowiedzi na pytanie 3. Testy sesji: zejście, przejazd i wyjście; zapis na peronie wczytuje się na peronie. Złoty hash, jeśli zmienia się miejsce startu przejazdu. Kurator: perony nie wchodzą pod piwnice Starego Miasta, Trasę Podziemną ani przyszły parking Alchemii.

## Konsekwencje
- **Zapis:** w wariancie A bez zmiany schematu (`SAVE_SCHEMA_VERSION` zostaje 28), bo id stacji, ceny i czas są te same. Przejazd zapisany przed etapem 2 i wczytany po nim kończy się na podeście nowego wejścia, co przyjmujemy. Wariant B dodaje id, które walidator przyjmie przez `isMetroStationId` bez migracji, ale zmienia typ w `core`.
- **Złote hashe:** etapy 1 i 3 ich nie zmieniają. Etap 2 zmienia hash, bo przesuwa bryły, tłum i meble. Etap 4 zmienia go, jeśli przejazd startuje gdzie indziej. Każda zmiana ma uzasadnienie w commicie.
- **Kontrakty:** w wariancie A bez zmian w `core/src/{ports,events,commands}`. `InteractionStarted`, `travel-metro`, `MetroDeparted`, `MetroArrived` i `MetroRefused` zostają, a pawilony rysuje renderer z treści `sim` (jak Alchemię).
- **i18n (ADR-0056):** nowe klucze UI dla warstwy, trasy, podglądu, możliwej stacji, wejścia, zakupu i czasu przejazdu, w `i18n/en` i `i18n/pl`. Nazwy stacji i wejść są polskie w obu językach, jak dziś. Komunikaty `metro_ride_1..4` w `ink/en` i `ink/pl` dostają wejścia („Brama Krakowska, wyjście do Alchemii”, „Plac Zamkowy, dworzec autobusowy”). Polski katalog zmienia się świadomie, bo dochodzą nowe teksty. Skan `i18n-scan` bez wzrostu bazy.
- **Topografia:** nowe wpisy celowe w `docs/topografia.md` dla każdego pawilonu z wykopem, dla hal i peronów pod placami, dla linii na mapie i dla możliwych stacji, a do T-022 dopisek o przebiegu linii. Kurator przegląda tabelę miejsc przed etapem 2 i wygląd przed scaleniem etapu 3.
- ADR-0034 (perony przy fasadach w zaułkach), ADR-0035 (mapa linii jako lista, bilet jednym kliknięciem) i lista miejsc metra w ADR-0045 zmieniają się w zakresie opisanym wyżej. Reszta zostaje.
- Metro robi się widoczne z ulicy i trafia w węzły, które gracz zna (plac, Ratusz, Alchemia, dworzec, Zamek). Mapa mówi, dokąd da się dojechać teraz, a dokąd później.

## Przegląd kuratora topografii
Status: przegląd tabeli miejsc i linii z mapy (5.11, PR #270 @ a57b56a) zrobiony: tabela wejść przyjęta z poprawkami miejsc niżej, linia i możliwe stacje do poprawy danych w `METRO_TUNNEL` i `METRO_PLANNED` (T-150…T-152). Wygląd (etap 3) czeka. Lista do oceny:
- miejsca sześciu wejść z tabeli: odległości od zabytków i pomników, oś deptaka na Bramę Krakowską (wejście A), ruch pieszy na Placu Litewskim, stanowisko archeologiczne pod wejściem B Alchemii i oś frontu hali, targ pod wiaduktem przy wejściu A Placu Zamkowego (do likwidacji według decyzji użytkownika 4.11);
- rola Dworca Autobusowego w66264171 dziś i w 2077 oraz nazwa wejścia B;
- przebieg tunelu na mapie (omija Stare Miasto i wzgórze zamkowe);
- położenie i nazwy możliwych stacji: Ogród Saski, Lublin Główny i stacja w luce T-022;
- treść nowych wpisów T i dopisku do T-022.

Uwagi kuratora (5.11, sonda na danych gry PR #270 @ a57b56a: `groundY`, wyciągi `data/osm`, odcinki co 1–10 m; poza prostokątami importu OSM API 0.6 z 5.11, rzutowane jak `tools/osm-import`):
- **Przebieg tunelu.** Odcinki Plac Litewski – Brama Krakowska (pod deptakiem Krakowskiego Przedmieścia, od Kościoła Świętego Ducha 1,5 m w bok, pod jezdnią), Brama Krakowska – Plac Zamkowy (punkty na osi Lubartowskiej w40050981…w263054588 i al. Tysiąclecia w179654711, teren schodzi z y 1,2 do −20,5) i Plac Zamkowy – Podzamcze (al. Tysiąclecia, Ruiny Baszty Żydowskiej 40 m, Zamek dalej) są zgodne z Lublinem: linia omija wzgórze Starego Miasta i wzgórze zamkowe (T-148). Dwa wyjątki:
  - etap 1 prowadzi linię do dzisiejszych kiosków, więc wchodzi ok. 20 m za Bramę Krakowską na Bramową (między bramą r7224409 a kamienicą w66286400) i pod łuk kamienic zachodniej pierzei Placu Zamkowego. To odstępstwo tymczasowe (T-149). W etapie 2 węzeł stacji `kanal` leży na osi Lubartowskiej między wejściami A i B (ok. (442; −40)), a `targ` na al. Tysiąclecia między wejściami A i B (ok. (740; 335)); linia nie wchodzi wtedy w mury;
  - w luce T-022 łamana (1120; 310) → (1700; 380) przechodzi na ok. 75 m (x 1396…1470) pod Starym cmentarzem żydowskim w40049437 (XVI w., Q81859, obszar chroniony w `skyline-protected.ts`). Do poprawy (T-150). Bystrzyca płynie w luce 400–800 m na południe od linii (z od −18 do −770), więc „wzdłuż al. Tysiąclecia i Bystrzycy” w tekście ADR i w komentarzu `METRO_TUNNEL` jest nieprawdą; poprawny opis: „al. Tysiąclecia i ul. Kalinowszczyzną”. Proponowane punkty Plac Zamkowy – Nabrzeże: (743; 345), (904; 325), (1060; 300), (1250; 290), (1395; 270), (1580; 232), (1738; 386), (2084; 384), (2340; 428), (2386; 414), (2462; 420). Linia trzyma się wtedy ≥ 39 m od cmentarza, idzie al. Tysiąclecia, potem ul. Kalinowszczyzną i przecina Bystrzycę przy moście Lutosławskiego w834402001. Długość 1,93 km zamiast 1,88 km.
- **Stacja w luce T-022 (rozstrzygnięcie).** Nazwa **„Kalinowszczyzna”**, miejsce **(1738; 386)** ±10 m, pod ul. Kalinowszczyzną w406693436 przy przystankach „Tatarska 01” n1088804120 (1840; 365) i „Tatarska 02” n1088804115 (1729; 398), 38 m od punktu szkicu (1700; 380), który wypada w budynku w231445126. Punkt leży w dzielnicy administracyjnej Kalinowszczyzna (r6096717; granica z Tatarami biegnie Bystrzycą), a ulica tej nazwy prowadzi dalej wprost na Nabrzeże. Odrzucone: „Tatary” (dzielnica za rzeką), „Białkowska Góra” (n3009690205, mało znana nazwa osiedla). W `METRO_PLANNED`: `{ id: "kalinowszczyzna", name: "Kalinowszczyzna", from: "targ", at: (1738; 386), via: [] }`, czyli stacja na samej linii, bez odgałęzienia (T-153).
- **Ogród Saski.** Punkt (−810; 180) leży w parku w174005440, 39 m od jego północnej granicy, a przerywana linia (−200; −64) → (−810; 180) przecina ukośnie kwartały i wchodzi w park. W Lublinie węzłem są Aleje Racławickie na południowym skraju parku: przystanek „Ogród Saski 03” n809902733 (−666; −74), brama parku n8794901411 (−598; −65), skrzyżowanie z Lipową (−565; −84). Do poprawy (T-151): `at` (−630; −84) pod Alejami Racławickimi, `via` (20; −59), (−242; −67), (−480; −88), czyli osią Krakowskiego Przedmieścia i Racławickich. Odległość od środka Placu Litewskiego to 0,73 km, a nie 0,9 km.
- **Lublin Główny.** Współrzędne z „Kontekstu” są przesunięte o ok. 200 m. W OSM dworzec PKP w171203532 ma (595…682; −1904…−1834), stacja n3457415162 (651; −1901), Dworzec Lublin (Metropolitalny) w1070878029 (502…553; −1847…−1790), a Plac Dworcowy w1103204078 (592…645; −1839…−1817). Punkt PR (560; −2030) leży 180 m na południe od budynku PKP, w polu torów. Do poprawy (T-152): `at` (590; −1840) na Placu Dworcowym, 56 m od PKP i 66 m od Dworca Metropolitalnego. Nazwa „Lublin Główny” zostaje. Odgałęzienie z kiosku przez (460; −155) przechodzi pod kamienicą `historic` w364550283 i pod Kościołem św. Piotra w66335226. Linia ma wychodzić z Placu Łokietka i iść ulicami: (440; −110), (420; −128), (390; −144), (368; −170), (380; −210), (413; −256), (492; −370), (506; −389) (Kozia, Bernardyńska), dalej schematycznie do (590; −1840), bo dalsza trasa leży poza danymi.
- **Wejścia z wariantu A.** Mierzę od środka; kontrole etapu 2 mają liczyć odległości od obrysu pawilonu 7,2 × 3,6 m, nie od środka:
  - Plac Litewski A (78; 18): 26 m od budynków, Ławka Niepodległości 41 m, pomniki ≥ 41 m. Stoi jednak 4,5 m od osi ścieżki w1269050254 (N–S, x ok. 82) i 6,5 m od w1269050255 (E–W, z ok. 12), więc obrys wchodzi na ścieżkę albo zostawia mniej niż metr. Przyjęte z przesunięciem w tolerancji do **(74; 20)**: 7,5 m od osi ścieżek, 30 m od budynków, 37 m od ławki, dłuższy bok N–S, otwór na wschód, na skrzyżowanie ścieżek;
  - Plac Łokietka A (440; −110): Ratusz (Urząd Miasta w66264120) 28 m, Brama Krakowska 27 m, oś Królewskiej 3,4 m, oś deptaka na Bramę ok. 14 m w bok. Zgodne z jednym zastrzeżeniem: brązowa makieta Lublina n9268852964 (437,6; −123,4) stoi 13,6 m na południe, więc południowy koniec obrysu wzdłuż Królewskiej ma do niej ok. 10 m. Przesunąć o 3 m na północ, do **(441; −107)** (makieta 16,6 m), i dopisać `tourism=artwork` do kontroli 10 m;
  - Alchemia B (430; 25): poza stanowiskiem archeologicznym w1559354344 (8,1 m od obrysu, wykop ma zostać ≥ 3 m poza nim). Leży w obrysie parkingu w173531008 (ul. Przystankowa), 4,5 m od osi alejki parkingowej w177513189, więc obrys może wejść na alejkę. Przyjęte pod warunkiem, że obrys zostawi ≥ 2 m od krawędzi alejki (oś ≥ 5,5 m). Pawilon na parkingu to odstępstwo celowe do wpisu w etapie 2. Oś frontu hali jest wolna;
  - Plac Zamkowy A (725; 290): pierzeja 11 m, jezdnia placu 9,4 m, Zamek 107 m. Tablica „Jakow Ichak Horowic” n13195855007 (720,1; 302,3, Widzący z Lublina, dawna ul. Szeroka 28) wisi 13,3 m na północny zachód, więc koniec obrysu ma do niej ok. 9,5 m. Przesunąć do **(722; 286)**: tablica 16,4 m, pierzeja ok. 12 m. Targ pod wiaduktem ma zniknąć (4.11). Do tego czasu kontrola „3 m wolnego przed wejściem” liczy stragany;
  - Plac Zamkowy B „Dworzec” (760; 375): punkt wypada w węźle ścieżek przy al. Tysiąclecia (chodniki w227698420 i w227698423, ścieżka w1435832520, droga rowerowa w1435832523, osie 4,0–6,6 m od środka), więc pawilon zamknąłby przejście i drogę rowerową. Przesunąć do **(754; 379)**: 9 m od osi, ok. 9 m od budynków, 24 m od dworca;
  - Nabrzeże A (2527; 391,6): zgodne (budynki 65 m, Turystyczna 33 m).
- **Dworzec Autobusowy w66264171.** W OSM to nadal `building=transportation` z peronami „Dworzec Główny PKS (1…17)” w danych gry. Od 2023 r. główny węzeł autobusowy to Dworzec Metropolitalny przy PKP, czyli możliwa stacja Lublin Główny. W 2077 r. budynek zostaje dworcem autobusowym regionu. Wejście B nazywam **„Dworzec Autobusowy”**, a nie samym „Dworzec”, żeby gracz nie mylił go z Lublinem Głównym. Komunikat `metro_ride` „Plac Zamkowy, dworzec autobusowy” zostaje.
- **G-307 (dzisiejsze kioski).** Pomiar się zgadza: Plac Litewski 3,8 m od tablicy Andrzeja Struga n12785177414, Brama Krakowska 10,8 m od Bramy. Do zgłoszenia trzeba dopisać tablicę Ludomira Michała Rogowskiego n13252649322 (491,3; −75,0), 2,1 m od kiosku `kanal` (T-154). Etap 2 zamyka wszystkie trzy przypadki, bo kioski znikają.
- **Kontrola skanu (propozycja):** `metro-line-protected`. Punkty `METRO_TUNNEL` i linii `METRO_PLANNED` próbkowane co 5 m nie mogą leżeć w `PROTECTED_AREAS` ani w obrysie budynku `historic`/`heritage`/`place_of_worship`. Baza dziś: 3 linie (tunel Plac Zamkowy – Nabrzeże pod cmentarzem, Ogród Saski w parku, odgałęzienie Lublin Główny pod Kościołem św. Piotra), po poprawce 0.
