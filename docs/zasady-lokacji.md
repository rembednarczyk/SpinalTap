# Zasady tworzenia pomieszczeń i lokacji

Stałe zasady dla każdego, kto projektuje albo przerabia miejsce w grze: pomieszczenie, budynek, plac, parking, wnętrze zadania. Obowiązują ludzi i agentów. Wynikają z planu gry (`docs/seki-senshi-plan.md`), z ADR-ów (głównie 0042 topografia, 0046 testy i budżety, 0054 glitche, 0056 teksty, 0058 assety, 0074 Alchemia, 0082 W-3) i z decyzji użytkownika z 19.11. Zasady wiążą się z kodem tam, gdzie się da: kontrolą skanu, testem albo regułą rozstawienia.

Styl to mroczny cyberpunk: brudne niskie życie i wysoka technika, na prawdziwym Lublinie. Komiksowy rendering NPR (kontur, płaskie światło) wymusza czytelne bryły i mocne źródła światła, a nie fotorealizm.

## 1. Miejsce stoi w prawdziwym Lublinie
- Obrys, wysokość terenu i układ ulic biorą się z danych (OSM, NMT, LoD2). Cyberpunkowa warstwa leży na mieście, nie zastępuje go (ADR-0042).
- Każde odstępstwo ma wpis w `docs/topografia.md` z powodem. Zmiana treści `lublin`, scen, terenu albo rozstawienia przechodzi przegląd agenta `topography-curator`.
- Budynek z planu inwestora albo z planszy koncepcyjnej (Alchemia) jest odstępstwem celowym: wpis T z odnośnikiem do planszy.

## 2. Gęsto, nigdy pusto
- Żadnych sterylnych, pustych ani symetrycznych pomieszczeń. Wyjątek: wnętrza korporacji (laboratorium, recepcja, biuro), gdzie sterylność jest celem i kontrastem dla reszty miasta.
- Każde miejsce ma trzy warstwy:
  - **Architektura:** ciasne wymiary, prowizoryczne ścianki działowe, rury i kanały wentylacyjne na wierzchu, kable po ścianach i suficie, łaty, przybudówki.
  - **Duże obiekty:** terminale, ekrany, serwery z chłodzeniem, automaty z jedzeniem, zużyte meble, lady, regały, maszyny.
  - **Drobiazg:** opakowania po syntetycznym jedzeniu, kubki, niedopałki, rozlane napoje, chipy pamięci, kartony, ulotki, taśma.
- Gęstość rośnie z biedą: noclegownia i targ są zawalone, sklep w galerii uporządkowany, ale pełny towaru, korporacja czysta.
- Puste miejsce na podłodze zostaje tylko tam, gdzie się chodzi i walczy (ścieżki, osłony, wyjścia). Gęstość nie może zamknąć przejścia ani grafu nawigacji.

## 3. Kontrast technologii i biedy
- Każde wnętrze łączy drogi sprzęt z prowizorką: pęknięty hologram, kable sklejone taśmą, wszczep za fortunę obok plastikowego kubka, serwerownia w dawnej piwnicy.
- Szyldy i reklamy są nowsze niż ściany, na których wiszą.

## 4. Światło i atmosfera
- Bez zwykłego, równego światła. Źródła są sztuczne i ostre: neony (także zza brudnych okien), zimny blask monitorów, ciepłe światło sklepów, czerwone diody awaryjne, latarnie.
- Para, dym i mgła tam, gdzie mają źródło: kratki wentylacyjne, kuchnie, studzienki, deszcz.
- Każde światło ma swój przedmiot w świecie (lampa, ekran, neon, okno). Nie ma świecących ścian bez powodu.
- Kolory światła niosą znaczenie: ciepłe to handel i jedzenie, zimne to technika i korporacja, czerwone to alarm i zagrożenie, zielone to wejścia i drogi.
- Gracz zawsze widzi drogę: ścieżki, drzwi i schody są jaśniejsze albo obrysowane światłem.

## 5. Narracja środowiska
- W każdym pomieszczeniu jest co najmniej jeden ślad, że ktoś wyszedł przed chwilą: parujący kubek, przewrócone krzesło, otwarte okno terminala z błędem, niedokończony posiłek, kręcący się wentylator, uchylone drzwi.
- Ślad pasuje do mieszkańca i do zadań w tym miejscu (kto tu pracuje, kogo szukamy).
- Rozstawienie jest deterministyczne: reguła albo hash miejsca, nigdy `Math.random` (ADR-0046).

## 6. Komunikacja pionowa jak w prawdziwym budynku
- Klatki schodowe, windy i schody ruchome są zgrupowane w trzonach (rdzeniach komunikacyjnych), tak jak w prawdziwych budynkach i galeriach handlowych. Nie są rozstrzelone po obiekcie.
- Galeria handlowa: trzon z windą i klatką przy każdym końcu ciągu pasaży, schody ruchome parami przy atrium, a dojścia z parkingu prowadzą do trzonów.
- Każda kondygnacja ma co najmniej dwie drogi w dół (druga klatka albo schody zewnętrzne), jak przy drogach ewakuacyjnych.
- Wymiary jak w normach:
  - stopień 0,15–0,18 m wysokości i 0,28–0,30 m głębokości;
  - spocznik co najwyżej co 17 stopni;
  - kabina windy co najmniej 1,1 × 1,4 m;
  - drzwi 0,9–1,0 × 2,1 m;
  - pasaż w galerii 4–6 m szerokości, korytarz w mieszkaniu 1,2–1,5 m.
- Wysokości kondygnacji:
  - mieszkanie: 2,6–3,0 m;
  - sklep i pasaż: 4–5 m;
  - hala, food hall: 5–8 m;
  - parking: 2,2–2,6 m prześwitu.

## 7. Co jest bryłą, a co tylko obrazem
- Wszystko na wysokości ciała, przy czym gracz albo postać może się zatrzymać, jest bryłą symulacji: ściany, lady, regały, automaty, balustrady na tarasach, po których się chodzi, pnie drzew.
- Tylko rysowane są: rzeczy nad głową, płaskie (plakaty, naklejki, plamy), wiszące poza zasięgiem (pnącza za krawędzią, kable) oraz wszystko w miejscach, do których gracz nie dochodzi.
- Rysunek i bryła mają ten sam kształt. Zaokrąglony narożnik to zaokrąglony graniastosłup (`Piece.outline`). Nie ma stania w powietrzu ani przechodzenia przez ścianę.
- Nowa bryła idzie na koniec swojej listy, żeby identyfikatory i złote hashe zostały. Zmiana, która je rusza, robi to świadomie, z opisem w commicie.
- Graf nawigacji przechodzi przez każde drzwi, schody i pasaż. Kontrola skanu `walk-blocked` i testy tras pilnują, żeby gęstość niczego nie zamknęła.

## 8. Assety: modele gry przed własnymi pudełkami
- Drzewa, krzewy, donice, ławki, latarnie, automaty, kosze i pojazdy bierzemy z modeli gry: meble uliczne (`tree`, `shrubs`, `planter`, `bench` i inne z `StreetPropKind`), `city-kit`, `city-props`, `vehicle-props`. Własną geometrię z pudełek budujemy tylko dla tego, czego w modelach nie ma.
- Nowe modele: licencja CC0 albo CC-BY z kredytem w README i w `sources.json` (ADR-0058). Najpierw modele użytkownika.
- Gęstości i szczegółów nie ograniczamy na zapas. Budżety trójkątów na siatkę można podnosić (decyzja użytkownika z 19.11). Bramkami zostają wywołania rysowania i aktywne siatki scen `npr-perf`, a do tego czas klatki na telefonie odniesienia (decyzja z 12.11). Koszt każdej zmiany mierzymy przed i po.
- Detal ma poziomy LOD: z bliska pełny, z daleka zastępnik, na telefonie lekki. Pula najwyższego poziomu jest tylko dla tego, co stoi w miejscu (zaparkowane auta, rekwizyty), bo bufor ruchomych idzie na GPU co klatkę.

## 9. Czytelność i rozgrywka
- Każde miejsce ma punkt orientacyjny widoczny z wejścia: neon, wysoki ekran, drzewo, schody.
- Walka potrzebuje osłon i dwóch dróg. Pomieszczenie zadania ma co najmniej dwa wejścia albo drogę ucieczki (drabina, okno, szyb).
- Linie wzroku: dłuższa oś pomieszczenia prowadzi do celu (lada, drzwi, terminal). Kamera TPP mieści się w każdym korytarzu (co najmniej 2,4 m wysokości, 1,2 m szerokości).
- Teksty dla gracza idą do katalogów `i18n` (ADR-0056). Nazwy własne na szyldach (marki, nazwy lokali) zostają w języku świata.

## 10. Proces
- Zaczynamy od wzorca (CLAUDE.md, „Wzorce i standardy”): typ budynku i jego przyjęta praktyka (galeria handlowa z atrium, kamienica z podwórzem, parking z rampą, hala targowa). Nazywamy go w ADR-ze i opisujemy różnice.
- Plansza albo referencja leży w `docs/world/koncepty/`. Porównanie z nią robimy zrzutami z tych samych ujęć.
- Każda widoczna zmiana kończy się zrzutem przed i po (noc, a gdy ma sens, także dzień), wysłanym użytkownikowi (decyzja z 2.11).
- Testy: geometria i reguły w testach bez przeglądarki, przeglądarka tylko do zrzutów i budżetów (ADR-0046). Skan glitchy bez nowych miejsc.
- Jedna zmiana to jedna gałąź i jeden PR. Bryły symulacji i rysunek idą osobno, gdy zmiana jest duża.
