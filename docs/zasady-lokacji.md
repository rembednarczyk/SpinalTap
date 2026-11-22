# Zasady tworzenia pomieszczeń i lokacji

Stałe zasady dla każdego, kto projektuje albo przerabia miejsce w grze: pomieszczenie, budynek, plac, parking, wnętrze zadania. Obowiązują ludzi i agentów. Wynikają z planu gry (`docs/seki-senshi-plan.md`), z ADR-ów (głównie 0042 topografia, 0046 testy i budżety, 0054 glitche, 0056 teksty, 0058 assety, 0074 Alchemia, 0082 W-3) i z decyzji użytkownika z 19.11. Zasady wiążą się z kodem tam, gdzie się da: kontrolą skanu, testem albo regułą rozstawienia.

Styl to mroczny cyberpunk: brudne niskie życie i wysoka technika, na prawdziwym Lublinie, rysowane jako **komiksowy realizm** (§9, decyzja użytkownika z 20.11). Kształty, proporcje i gęstość detalu są jak w prawdziwym świecie. Komiks jest tylko w sposobie rysowania: tusz, płaskie światło, paleta i mocne źródła światła. Rendering NPR nie usprawiedliwia uproszczonej geometrii.

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
- Drzewa, krzewy, donice, ławki, latarnie, automaty, kosze i pojazdy bierzemy z modeli gry, o ile model spełnia §9 (komiksowy realizm). Model gry, który sam jest bryłą zastępczą (np. korona drzewa jako kilka kul), poprawiamy w modelu, a nie powielamy: meble uliczne (`tree`, `shrubs`, `planter`, `bench` i inne z `StreetPropKind`), `city-kit`, `city-props`, `vehicle-props`. Własną geometrię z pudełek budujemy tylko dla tego, czego w modelach nie ma.
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

## 9. Komiksowy realizm (decyzja użytkownika 20.11)
- Kształt jak w rzeczywistości, rysunek jak w komiksie. Stylizacja to tusz, płaskie światło, paleta i czytelny kolor. Nie zastępujemy kształtu figurą.
- Formy organiczne nie są bryłami zastępczymi (kula, pudło, graniastosłup):
  - drzewo ma pień, konary, gałęzie i koronę z kęp liści o nierównym obrysie;
  - krzew ma gałązki i liście;
  - bluszcz ma pędy i pojedyncze liście, poszarpany dół i masę przy krawędzi;
  - trawnik ma kępy, a nie płaską zieleń;
  - kwiaty mają łodygi i kwiaty.
  To samo dotyczy ludzi, ubrań, wody i ognia.
- Rzeczy techniczne mają prawdziwe części: rury z kołnierzami, kable ze zwisem, automaty z panelem, wlotem i przyciskami, meble z nogami i blatem. Prostopadłościan jest tylko tam, gdzie w rzeczywistości jest prostopadłościan.
- Drobny detal wolno powiększyć, żeby czytał się z odległości gry (np. liść dwa razy większy od prawdziwego). Wolno też zagęścić lub rozrzedzić detal. Kształt zostaje prawdziwy.
- Punktem odniesienia jest zdjęcie prawdziwego obiektu albo plansza koncepcyjna. Wynik sprawdzamy zrzutem z bliska (2–5 m) i z odległości gry, obok odniesienia.
- Uproszczenie wolno stosować tylko jako LOD: z daleka (siatki dalekie, bloki) i na telefonie (`low`). Pełny kształt jest zawsze wersją bliską.
- Budżet: trójkąty są wolne (decyzja z 19.11). Bramkami są wywołania rysowania, aktywne siatki i czas klatki na telefonie odniesienia. Detal dokładamy do istniejących siatek (instancje, scalanie), a nie w nowych wywołaniach.
- Brak tekstury z alfą w zestawie miasta nie usprawiedliwia uproszczeń: liście, pędy i kępy budujemy z geometrii (karty liści jako małe wielokąty).

## 11. Karta pomieszczenia i detal z Blendera (polecenie użytkownika 22.11, ADR-0098)
- Każde pomieszczenie ma kartę `docs/pomieszczenia/<id>.md`: historię, klimat, przeznaczenie, inwentarz docelowy i inwentarz gry. Nowe miejsce zaczyna się od karty, a przeróbka od jej aktualizacji.
- Historia mówi, kto miejsce zbudował, kto w nim był i co się stało przed chwilą (§5). Klimat opisuje światło, kolor, dźwięk i zapach (§4) oraz kontrast techniki i biedy (§3). Przeznaczenie mówi, po co gracz tu przychodzi i którędy wchodzi oraz ucieka (§9).
- Inwentarz docelowy wymienia rzeczy w trzech warstwach (§2). Przy każdej jest źródło: model z Blendera (`tools/blender/`) albo model gry (§8). Inwentarz gry generuje `pnpm rooms:write`, a test `tools/rooms` sprawdza, że jest aktualny.
- Detal z inwentarza budujemy w Blenderze bez okna, skryptem w repozytorium: model jako funkcja wymiarów i ziarna, w prawdziwym kształcie (§9), na palecie zestawu miasta. Rozstawienie w grze jest deterministyczne (§5).
- Zasady §1–§10 obowiązują dalej. Karta jest ich zastosowaniem do konkretnego miejsca.


## 12. Architektura i skala: blockout (zasady użytkownika 22.11)
Wzorzec: level blockout z modułową siatką (whitebox i „modular kit”, jak w wykładzie Joela Burgessa o modułowych poziomach Skyrima, GDC 2013) i sekwencja przestrzeni „ciasno, potem otwarcie” (compression and release).
- **Wertykalność i gęstość.** Poza korporacją pomieszczenia są niskie i zabudowane: antresole, schody, wnęki, podesty, a na wierzchu instalacje (rury, korytka kablowe, kanały wentylacyjne), które dociążają górę kadru. Każde pomieszczenie wyższe niż 2,6 m ma pod stropem co najmniej jedną linię instalacji.
- **Siatka modularna.** Rzut ścian i podłóg składamy w module 0,5 m (moduł ściany 1 m albo 2 m, wnęki i przejścia po 0,5 m), wysokości co 0,1 m, z wymiarami z §6. Dzięki temu moduły łączą się bez szczelin, a bryły symulacji pokrywają się z rysunkiem (§7). Odstępstwo od siatki ma powód: obrys prawdziwego budynku z danych (§1) albo plansza. Karta pokazuje liczbę wymiarów na siatce w pomiarach.
- **Kontrast przestrzenny.** Droga do ważnego miejsca prowadzi przez ciasny odcinek (korytarz do 1,5 m, strop do 2,4 m), po którym przestrzeń otwiera się szeroko albo w górę (atrium, hala, wielopoziomowy klub). Duże wnętrze bez ciasnego przedsionka to błąd kompozycji.
- **Próg między pomieszczeniami** (zasada dodana): przejście z jednego pomieszczenia do drugiego zmienia co najmniej jedną rzecz naraz: światło, materiał podłogi albo wysokość stropu. Gracz czuje, że wszedł gdzie indziej.
- **Każde pomieszczenie jest osobnym wnętrzem** (polecenie użytkownika 22.11): sklep, lokal, tunel, poziom garażu, klatka mają własny wpis w `INTERIORS`, własną kartę i własne światło. Wnętrze zagnieżdżone w większym (sklep w galerii) wskazuje rodzica polem `within`.

## 13. Światło (zasady użytkownika 22.11)
Wzorzec: lighting by practicals z filmu i level designu (każde światło ma widoczne źródło) i proporcja barw 60-30-10 z projektowania wnętrz.
- **60-30-10 w kolorze światła:**
  - 60% kadru to baza neutralna: ciemne, chłodne cienie albo przygaszone tło (ambient), które budują głębię;
  - 30% to światło motywowane, główne: chłodne albo ciepłe z konkretnego źródła (jarzeniówka, okno z księżycem, ekran, lampion);
  - 10% to akcenty neonowe: nasycona magenta, cyjan, pomarańcz, tylko punktowo i tylko na realnym źródle (neon, dioda, hologram).
  Sprawdzamy to zrzutem: `pnpm shots:palette <zrzut.png>` liczy udział pikseli w trzech grupach według jasności i nasycenia (`tools/shots/src/palette.ts`); zasada mieści się w pasmach: baza 50–75%, światło 18–42%, akcenty 3–15%. Wynik każdego pomieszczenia jest w jego karcie (§13 audytu).
- **Brak światła znikąd.** Każde światło silnika (`PointLightDef`, zestaw wnętrza, poświata) ma swój przedmiot w świecie: lampę, ekran, neon, okno. Lampa wisi przy swojej oprawie, a nie w powietrzu. Rozproszone tło wnętrza (ambient) jest światłem odbitym od tych źródeł, więc ma ich barwę.
- **Światło w swoim pomieszczeniu** (zasada dodana, z pracy nad Alchemią 22.11): światło shadera nie zna ścian (G-263), więc każda lampa jest przycięta do rzutu i kondygnacji swojego pomieszczenia (`LightClip` z `minY` i `maxY`), wisi tuż nad sufitem (G-509), a świeci kilka najbliższych oku. Wnętrze z własnym światłem ma tryb wnętrza: swój zestaw (`indoorRig`) zamiast nieba.
- **Kontrast funkcjonalny (nawigacja).** Drzwi, terminale, skrzynki z łupem i osłony są jaśniejsze albo w barwie odróżniającej je od reszty pomieszczenia. Barwy nawigacji z §4: zielone wejścia i drogi, czerwony alarm i zagrożenie. Gracz po wejściu wie, gdzie iść, zanim przeczyta jakikolwiek napis.
- **Pora dnia.** Wnętrze z oknami albo atrium sprawdzamy zrzutem w nocy i w dzień. Bez okien wygląda tak samo o każdej porze.

## 14. Trzy warstwy wyposażenia (zasady użytkownika 22.11)
Wzorzec: set dressing w trzech przejściach (macro, meso, micro) i clutter clusters z praktyki level artu. Rozwija §2.
1. **Makro (duże bryły):** meble, szafy serwerowe, lady, regały, filary. Wyznaczają układ pomieszczenia i osłony w walce. Są bryłą symulacji (§7).
2. **Mezo (przedmioty średnie):** monitory, krzesła, skrzynie, kable po podłodze, lampy. Nadają pomieszczeniu funkcję (warsztat, mieszkanie, biuro).
3. **Mikro (drobiazg i narracja):** puszki, niedopałki, narzędzia, dokumenty, naklejki, plamy i zabrudzenia na ścianach. Leżą **w skupiskach** przy miejscach, gdzie ktoś coś robi (lada, biurko, stół, kąt), a nie równo po podłodze. Skupisko to co najmniej 3 rzeczy w promieniu 1,2 m; co najmniej trzy czwarte drobiazgu leży w skupiskach.
- Pomiary w karcie (`pnpm rooms:write`) liczą architekturę i trzy warstwy, skupiska i drobiazg luzem oraz widoczne źródła światła. Liczą tylko to, co symulacja daje rysunkowi. Rzeczy rysowane osobnym kodem silnika opisuje karta.
- Puste pomieszczenie (zero mikro poza korporacją, makro bez mezo) to dług w kolejce, nie stan docelowy.

## 15. Powierzchnie i materiały (zasady użytkownika 22.11)
Gra rysuje NPR (tusz, płaskie światło), bez PBR. Zasadę przenosimy na kanały shadera toon: połysk (`gloss`), mokre (`wet`, odbicie sondy), samoświecenie (`selfLit`, kolory emisyjne zestawu).
- **Zróżnicowany połysk.** W każdym pomieszczeniu obok matowych, zniszczonych powierzchni (beton, rdza, brudny tynk, drewno) jest coś z połyskiem albo wilgocią: kałuża, szkło, chrom, lakier, plastik. Mokra posadzka tylko tam, gdzie woda ma skąd przyjść (deszcz przez atrium, przeciek, mycie).
- **Emisja z umiarem.** Świecące materiały mają kontrolowaną jasność: nie przepalają obrazu przy poświacie (glow layer) i nie oślepiają. Jasny neon jest mały, duża plansza świeci słabiej. Akcent emisyjny wlicza się do 10% z §13.

## 16. Frakcja miejsca: szybka matryca (zasady użytkownika 22.11)
Każda karta ma frakcję, która rządzi miejscem, a reguły §12–§15 dobieramy według niej:

| Cecha | Ulica / slumsy | Technologia / hakerzy | Korporacje |
|---|---|---|---|
| Geometria | asymetryczna, prowizoryczna, dobudówki | ciasna, zdominowana przez sprzęt i kable | symetryczna, monumentalna, minimalizm |
| Materiały | beton, rdza, folia, drewno, brud | plastik, metal, maty antystatyczne, szkło | marmur, czarne szkło, złoto, szczotkowana stal |
| Oświetlenie | migoczące jarzeniówki, ciepły brudny żółty, neony | zimne światło monitorów, niebieski, zieleń | ciepłe, ukryte oświetlenie architektoniczne, biel |

- Miejsce mieszane (sklep elektroniczny w galerii, warsztat w piwnicy korporacji) ma frakcję główną i drugą, a kontrast między nimi jest celem (§3).
- Korporacja jest jedynym wyjątkiem od §2 i §14 (gęsto, drobiazg): tam sterylność jest treścią.

## 17. Zasady dodane i proces audytu (22.11)
- **Dźwięk ze źródła.** Jak światło: każdy stały dźwięk pomieszczenia (szum wentylacji, brzęczenie świetlówki, kuchnia, serwery) ma przedmiot, z którego płynie, i cichnie za ścianą (ambience ADR-0060).
- **Skala człowieka.** W każdym pomieszczeniu są przedmioty, po których gracz odczyta skalę: drzwi 2,1 m, blat 0,9 m, krzesło 0,45 m, poręcz 1,1 m. Bez nich wnętrze w NPR wygląda jak makieta.
- **Ruch i życie.** Co najmniej jedna rzecz się rusza albo zmienia: wentylator, migająca świetlówka, para, ekran, człowiek przy pracy (§5).
- **Karta z audytem.** Każda karta ma część `## Frakcja i zasady`: wiersz `Frakcja:` i listę §12–§17 z oceną (zgodne, dług) oraz tym, co trzeba zrobić. Test kart wymaga tej części. Dług trafia do kolejki w `docs/backlog.md` („Zasady pomieszczeń w całej grze”), jedno pomieszczenie na jedną gałąź i jeden PR.
