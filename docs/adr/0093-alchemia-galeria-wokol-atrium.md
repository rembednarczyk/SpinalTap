# ADR-0093: Alchemia jako galeria wokół atrium (plansza 1:1)

Status: Przyjęty (19.11). Decyzja użytkownika z 19.11:
> „przeprowadzisz overhaul alchemii - poprawisz obecne wnętrza o plan referencyjny (tam na screenie masz nowy rozkład sklepów). Dodasz taki margines brył jaki Ci będzie potrzebny, możesz dowolnie go zwiększać, przerobić obecną Alchemię i dowolnie ją powiększyć żeby to wszystko zmieścić. Jeśli coś stoi Ci na drodze przesuwasz to a nie obudowujesz. Prawdopodobnie przód zostawisz jak jest, a reszta to gruntowne zmiany. Ma być jak na projekcie referencji.”

Rekomendowane opcje wybiera agent. Wcześniej w tym samym dniu użytkownik zdecydował o dziedzińcu w dachu z pergolami, lampionami i ławkami. Budżety trójkątów można podnosić, a zieleń bierzemy z modeli gry. Zasady miejsc: `docs/zasady-lokacji.md`. Dotyczy ADR-0074 (Alchemia według planu inwestora, etapy 1–8, B1–B4, C1–C7).

## Kontekst
- Plansza `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg` ma obok widoku od frontu trzy rysunki.
  - **Rzut:** pas sklepów wzdłuż ulicy z pasażem wschód–zachód w środku, dwa skrzydła z dziedzińcem między nimi od tyłu i klatki schodowe w trzonach przy pasażu.
  - **Schemat kondygnacji:** parking pod spodem, nad nim sklepy, pasaże ze sklepami, food hall i zielony dach z otworem. Każda kondygnacja jest pierścieniem wokół jednego atrium.
  - **Aksonometria:** zielone tarasy schodzą od dachu, a skrzydła obejmują atrium.
- Dziś Alchemia jest inna:
  - food hall leży na dnie (T1, −6,4) pod tarasem T0 (−2,2);
  - nad nim stoją pełne bryły szkła A (2,3) i B (6,5), do których nikt nie wchodzi, ze schodami po zewnętrznej ścianie;
  - front od Bajkowskiego (L1–L3, C1–C3) to także pełne bryły z fałszywym wnętrzem.
- Teren spada o ok. 10 m z południa na północ. Poziom −6,4 jest parterem od Świętoduskiej (T1), a −2,2 parterem od Bajkowskiego (T0). Galeria z atrium wykorzystuje ten spadek, bo ma dwa parteru, jak galerie na stoku.

## Wzorzec
- Galeria handlowa z centralnym atrium (mall, „galleria”):
  - sklepy w pierścieniu zewnętrznym;
  - wokół atrium pasaż-galeria z balustradą;
  - schody ruchome parami („scissor”) w atrium;
  - dwa trzony komunikacyjne (klatka i winda) w przeciwległych narożnikach, jako drogi ewakuacyjne;
  - food court na najwyższej kondygnacji jako kotwica, która ciągnie ruch w górę (przyjęta praktyka projektowania galerii).
- Różnice:
  - otwór atrium jest otwarty do nieba, jak na planszy: zielony dach z otworem, bez świetlika;
  - fasada jest szklana z widocznym wnętrzem;
  - gęstość i bieda według `docs/zasady-lokacji.md`, a nie sterylna galeria.

## Decyzja
1. **Korpus** to obrys dzisiejszego food hallu: x 400–436, z 32–58. Kondygnacje:
   - **P0, −6,4:** sklepy i wejście od Świętoduskiej (T1), drzwi do P−1;
   - **P1, −2,2:** sklepy i pasaże, wejścia od Bajkowskiego (T0) i od przejścia pod L2;
   - **P2, 2,3:** sklepy i pasaże;
   - **P3, 6,5:** food hall: stoiska wokół atrium i stoliki;
   - **dach, 10,7:** zielony dach na poziomie dachu L3 frontu, z otworem nad atrium, pergolami z lampionami, ławkami, ścieżkami i drzewami z gry.
2. **Atrium:** x 411–425, z 40–50, otwarte od posadzki P0 do nieba. Na środku posadzki P0 stoi punkt orientacyjny (fontanna z hologramem albo kiosk). Wokół atrium na P1–P3 biegnie galeria szeroka na 3 m z bryłową balustradą szklaną 1,1 m.
3. **Trzony:**
   - **SW:** dzisiejsze schody hali i winda, przedłużone do dachu. Winda obsługuje −9,2, −6,4, −2,2, 2,3, 6,5 i 10,7, a schody biegną zakosami w trzonie.
   - **NE:** x 428–436, z 52–58, nowa klatka zakosami i druga winda, od P0 do dachu.
   - Schody ruchome w parach przy południowej krawędzi atrium, P0↔P1↔P2↔P3.
4. **Sklepy** stoją w pierścieniu zewnętrznym na P0–P2: pasy po 7–8 m od wschodu i zachodu, 4–5 m od północy i południa.
   - Każdy sklep ma witrynę od galerii, ścianki działowe, zaplecze i trzy warstwy (`docs/zasady-lokacji.md` §2).
   - Szyldy to nazwy własne.
   - Sklepy dostają mieszkańców z tłumu (ADR-0060).
5. **Food hall przenosi się na P3.** Jednostki z imionami i sprzedawcami (Fumiko, Kenta, Goro, Oyaji i inni) przenosimy z ich ladami, a nie obudowujemy.
   - Okienko Fumiko od T1 zostaje okienkiem jej drugiego lokalu na P0. Zadania i dialogi, które go dotyczą, idą za nią.
   - Dawna hala na P0 staje się kondygnacją sklepów z wejściem od T1.
6. **Usunięte:** kondygnacje A i B z dziedzińcem, zewnętrzne schody A i B, taras T0 nad halą z donicami.
   - Taras T0 zostaje tylko jako pas od P−1 po stronie południowej (z 30–32) z klatką P−1 i kioskiem windy.
   - Z dzisiejszych tarasów zostaje widok: zielony dach i balkony galerii.
7. **Fasada korpusu:**
   - szkło na każdej kondygnacji jako cienkie bryły symulacji, rysowane tylko ramami, więc przez nie widać prawdziwe wnętrze;
   - płyty z belką i pasem LED;
   - zaokrąglone narożniki zewnętrzne (C1) i zasłony zieleni (C2).
8. **Front od Bajkowskiego zostaje** (L1–L3, budynek z arkadami C3, plac). Jego wnętrza łączy z galerią etap O5.
9. **Budżety:** trójkąty bez sztywnego limitu (decyzja z 19.11). Bramką są wywołania rysowania i aktywne siatki scen `npr-perf`, a wnętrza mają przesłanianie jak P−1 i P−2 (`AlchemiaUndergroundCull`).
10. **Zapis:** pozycje gracza w usuniętych bryłach (A, B) przy wczytaniu trafiają na najbliższy węzeł grafu. Jeśli schemat zapisu się zmienia, wymaga to migracji.

## Etapy (osobne PR-y)
- **O1, szkielet:**
  - kondygnacje P1–P3 i dach jako płyty z otworem atrium;
  - fasada z ram, galerie z balustradami, oba trzony ze schodami i windami, schody ruchome;
  - usunięcie A i B oraz zewnętrznych schodów;
  - graf poziomów (każda kondygnacja osiągalna z T1, T0 i P−1), przesłanianie, testy dróg i budżetów.
- **O2, sklepy P0–P2:** witryny, ścianki, zaplecza, szyldy, trzy warstwy wnętrz, tłum.
- **O3, food hall na P3:** przeniesienie jednostek, sprzedawców, lad i tłumu oraz drugiego lokalu Fumiko na P0.
- **O4, zielony dach:** otwór nad atrium, pergole z lampionami, ławki, ścieżki, trawniki, drzewa i krzewy z gry, wyjścia trzonów.
- **O5, front połączony z galerią:** wnętrza L1–L3 jako prawdziwe kondygnacje pasażu.
- **O6, parking jak na schemacie:** pierścień P−1 wokół szybu atrium (do decyzji po O5).

## Etap O1: wykonanie (19.11, gałąź `feat/alchemia-o1-galeria`)
- **Korpus** (`mall-plan.ts`, `mall.ts`): obrys hali x 400–436, z 32–58; P0 −6,4, P1 −2,2, P2 2,3, P3 6,5, dach 10,7 (te same wysokości co dachy L1, L2 i L3 frontu). Płyty P2, P3 i dachu to pierścienie z kilku wypukłych prostokątów wokół atrium x 411–425, z 40–50, otwartego od posadzki P0 do nieba, z otworami na klatki i szyby wind. Płytą P1 jest dawny dach hali, przecięty atrium. Nawis płyt 0,3 m na zachodzie, północy i wschodzie, zaokrąglone narożniki północne (2,3 m płyta, 2,0 m szkło jak w C1). Od południa stoją L2 i L3 frontu, więc narożniki południowe to styki, a szkło L2 i L3 jest ścianą P2 i P3.
- **Fasada:** szkło P1–P3 to cienkie bryły (`pane`, 0,12 m), silnik rysuje je jako ramy bez tafli (cokół, nadproże, słupki co 2,5 m), więc widać prawdziwe wnętrze. Wejścia na P1: drzwi 2,4 m od pasa T0 pod L2, drzwi 1,5 m od wschodniej rampy (stopień do 0,37 m), drzwi 1,5 m od zachodniej rampy do domku klatki hali i otwór przed bramką windy. Płyty z belką, pas LED tylko wzdłuż fasady i wokół atrium. Balustrady bryłowe 1,1 m wokół atrium na P1–P3 i dachu (przerwy tylko przy podestach schodów ruchomych) i po obwodzie dachu.
- **Trzony** (`mall-cores.ts`): SW na północ od domku klatki hali (x 400,3–407,6, z 34,8–37,9), od P1 do dachu, do P0 prowadzą dawne schody hali przez nowe drzwi w domku. NE (x 427,7–433,5, z 54,7–57,8) od P1 do dachu. Biegi zakosami: stopień 0,173–0,175 m, 0,28 m, spocznik co 12–13 stopni, ścianka między biegami, domki klatek 2,6 m nad dachem. Winda hali obsługuje −9,2, −6,4, −2,2, 2,3, 6,5 i 10,7, druga (`alchemia-lift-ne`) −2,2…10,7, obie otwarte na galerię.
- **Schody ruchome** (`escalators.ts`): nożycowo przy południowej krawędzi atrium, P0→P1 na zachód w pasie A (stopa przy wschodnim końcu atrium), P1→P2 na wschód w pasie B, P2→P3 na zachód w pasie A nad pierwszymi. Stopnie 0,175 × 0,30 (0,28), podesty na P1, P2 i P3, balustrady bryłowe po bokach (w silniku pochyłe szkło z pochwytem).
- **Graf** (`mall-nav.ts`): na każdej kondygnacji trzy węzły galerii (SW, S przy schodach ruchomych, SE), biegi trzonów (po dwa węzły na podestach), schody ruchome, drzwi. Klatki i pas A schodów ruchomych mają własne wycięcia gruntu, jak schody hali (G-368). Windy są poza grafem (ADR-0021). Trasy z T1, T0 i P−1 na P0–P3 i dach oraz pościgi z hali na P1 i z dachu do hali w `alchemia-mall.test.ts`.
- **Usunięte:** kondygnacje A i B z dziedzińcem, trawnikami, żywopłotami i kaskadami, schody `FLIGHT_A`/`FLIGHT_B`, donice i attyki dachu hali. L3 frontu kończy się na z 32 (było 38). Stoły hali przesunięte o 1,6 m na północ, poza schody ruchome. Zasłony zieleni C2 wiszą na płytach korpusu (bez południa).
- **Rysunek i budżety:** galerie, balustrady atrium, schody ruchome i trzony leżą w siatce wnętrza (rysowanej do 45 m od hali, jak wnętrza P−1), a płyty, szkło i dach w siatce budynku. Nowych siatek ani wywołań nie ma. Trójkąty: siatka budynku 16 036 (przed 14 764), wnętrze 4 432, zewnętrzna 7 636. Sceny `npr-perf` (wywołania i aktywne siatki, przed → po; budżety bez zmian):
  - `alchemia-tpp`: 287/112 → 299/118 (budżet 380/146). Dochodzą osobne siatki ruchomych bramek obu wind galerii, widoczne przez ramy fasady.
  - `alchemia-t2-tpp`: 222/77 → 222/77.
  - `alchemia-p1`: 209/78 → 209/78.
  - `alchemia-p2`: 213/79 → 211/78 (budżet 216/80). Bramki i platformy wind nad P0 chowa `AlchemiaGalleryCull`, gdy oko jest w P−2. Bez tego scena miała 215/80.
- **Różnice od wzorca i od briefu:**
  - Biegi trzonów, schody ruchome i drzwi mają 1,5 m, a nie 1,2 m. Węższych nie przechodzi droga NPC (ciało 0,38 m z marginesem na siatce 0,5 m).
  - Trzon NE zaczyna się na P1, bo róg P0 to sklep Oyajiego z zapleczem, harmonogramem i zadaniami. Przeniesienie należy do O3 (zrobione: trzon i winda od P0), a P0 ma drugą drogę przez schody ruchome i wyjścia na T1. Trzon NE stoi 2,5 m od narożnika (x do 433,7), poza zaokrągleniem.
  - Wejścia z zachodu i wschodu tylko przy południowym końcu, bo dalej rampa schodzi do T1 i stopień przekroczyłby 0,45 m.
  - Węzły wind nie trafiają do grafu, bo NPC nie jeżdżą windami (ADR-0021).
  - Winda jeździ według ADR-0020 (dalej w tę stronę, w którą jechała). Przy sześciu poziomach jazda z T0 do hali prowadzi przez dach, więc wybór piętra w kabinie zostaje na później.
  - Bryły galerii są po kafelkach 12 m, a każdy bieg z podestem u stopy to osobna bryła. Indeks brył zwraca wszystkie pryzmaty encji, a stopa na cienkim stopniu (G-372) potrzebuje stopni aż do podłogi wśród brył w pobliżu.
- **Otwarte po O1:**
  - Zapis: schemat się nie zmienia, więc migracji nie ma. Pozycja zapisana na dachu A lub B nad dzisiejszym atrium (x 411–425, z 40–50) albo na schodach A i B wczyta się w powietrzu i gracz spadnie (do 8,7 m). Przeniesienie na najbliższy węzeł (§10) to praca dla Persistence.
  - Przegląd kuratora topografii (T-329): zrobiony 19.11, przyjęte z uwagami (tylko dokumentacja, wpisane do T-329, T-145, T-205, T-242, T-327). Zapas skanu przesłaniania: kościół św. Józefa 23,2% przy progu 25%, więc O4 i O5 go pilnują. Proponowane kontrole skanu `alchemia-mall-footprint` (element galerii poza x 399,7–436,3, z 32–58,3) i `alchemia-mall-height` (ponad y 13,5), baza 0, do dodania w O2.
  - Wnętrze galerii jako obszar ADR-0061 (nazwa w HUD) w O2, razem ze sklepami. Zrobione w O2 (`alchemia-gallery`), razem z kontrolami skanu.
- **Wydajność:** przeszukiwanie grafu poziomów dostało kopiec (`world/nav.ts`, te same trasy), bo ok. 50 nowych węzłów podniosło czas pościgów w `alchemia-parking.test.ts` z ok. 4,1 do 4,7–5,1 s. Teraz jest ok. 3,8–4,4 s, a czas CPU czterech pościgów 3,7 s wobec 3,9 s przed O1.

## Etap O2: wykonanie (19.11, gałąź `feat/alchemia-o2-sklepy`)
- **Wzorzec:** lokal liniowy galerii handlowej (in-line unit): witryna od pasażu z wejściem, ścianki działowe do sąsiadów, zaplecze za ścianą z drzwiami dla obsługi, fryz pod szyld nad witryną; lokale narożne z witryną tylko na odcinku od galerii. Pierścień lokali między galerią (3 m wokół atrium) a szkłem fasady, jak na schemacie kondygnacji planszy („PASAŻE / SKLEPY”).
- **Plan** (`shops-plan.ts`, liczby w metrach świata): na P1 i P2 po 12 lokali, pasy W i E głębokie na 7,9 m (sala 5,9 m, zaplecze 2 m), N i S na 4,9 m (sala 3,7 m, zaplecze 1,2 m), dwa lokale narożne (P1 i P2 przy galerii zachodniej od północy, P2 przy galerii wschodniej od południa) z zapleczem z boku. Wolne zostają korytarze trzonów SW i NE, hol windy NE, hol wejścia głównego i wschodnich drzwi na P1, hol windy hali na P2 (`RING_WAYS`).
- **Lokale** (P1 / P2; z = zamknięte):
  - P1: MEDIFARM (apteka), IREZUMI (tatuaż), LOMBARD (lombard, narożny), SYNTHMART (syntetyczne jedzenie), lokal do wynajęcia (z, papier na szybie, kartony, drabina), PLASTIFLORA (plastikowe kwiaty), FIXPOINT (naprawa terminali), MEGABOX (z, roleta), NEUROTEK (wszczepy), BITKANTOR (kantor kryptowalut), SAKURA (z, roleta), VOLTAGE (elektronika).
  - P2: DREAMDECK (salon VR), KAWAII WEAR (odzież), HAGANE ARMS (broń legalna, narożny), CHROMEDOC (wszczepy), MOGUMOGU (z, krata, w środku widać sklep), REBOOT (naprawa), OMNIBYTE (elektronika, narożny), KOINEX (kantor), lokal do wynajęcia (z), MEDIX (apteka), TOKYO DRIP (z, roleta), INKSPOT (tatuaż).
- **Trzy warstwy** (`shop-fittings.ts`, `shop-trades.ts`): ścianki, fryz, zaplecze z regałem towaru i kartonami, rury, kanał i kable pod stropem, pasy światła; lada z terminalem, kablem ze stropu i kubkiem, regały ścienne, wyspy (gabloty, wieszaki, fotele tatuażu, kabiny VR, stoły warsztatowe, cokoły z kwiatami), ekspozycja w witrynie; drobiazg: towar na półkach z lukami po wyprzedanym, ulotki przy drzwiach, kartony. Kontrast techniki i biedy: gabloty z podświetleniem obok kartonów, terminal z błędem na ladzie z plastikowym kubkiem. Ślad świeżej obecności według branży (parujący kubek, terminal z czerwonym błędem, niedojedzony posiłek, rozlany karton, ubrania zostawione na ladzie); w lokalu z kratą też, w lokalu do wynajęcia kubek kawy ekipy.
- **Modele gry:** automaty z napojami (syntetyczne jedzenie), bankomaty (kantory), szafy uliczne jako serwery i sejfy (wszczepy, naprawa, VR, broń, elektronika), biletomaty jako terminale kantoru, krzewy jako plastikowe kwiaty; bryły z ich obrysu w `furniture.ts`. Sprzedawca to figura stałego tłumu (ADR-0058 etap 8, model `crowd-props.glb`) za ladą każdego otwartego lokalu; widok `street-props` sklepów na końcu `WORLD_SCENERY`. Własna geometria tylko dla regałów, lad, gablot, rolet, krat i ścianek.
- **Tłum ADR-0060:** klient przed ladą co drugiego otwartego lokalu (hash lokalu) i cztery osoby przy balustradzie atrium na P1 i P2 (`GALLERY_CROWD`, miejsca stojących w chunku Alchemii).
- **Szyldy:** nazwy własne neonem (`neon-letters.ts`, nowe litery B F G K P V X Y Z) na fryzie nad witryną, kolor według branży (§4: ciepłe jedzenie, odzież i kwiaty; zimna technika; zielona apteka i kantor; czerwona broń), martwa litera w co trzecim, zgaszony przy rolecie, brak przy lokalu do wynajęcia.
- **Bryły:** ścianki, witryny (cienkie bryły rysowane ramą z aluminium), fryzy, rolety, kraty, lady, regały, gabloty i modele gry; drobiazg tylko rysowany. Jeden prop na lokal na końcu `ALCHEMIA_PROPS` (identyfikatory sprzed O2 bez zmian).
- **Graf poziomów:** ścianki zasłoniły proste drogi z O1, więc doszły węzły `g1-main-in` (galeria naprzeciw wejścia głównego), `g1-east-lobby` (hol wschodnich drzwi) i `g1-e`, `g2-e` (północny koniec galerii wschodniej przy holu windy NE).
- **Wnętrze ADR-0061:** `alchemia-gallery` (P1–P3 w obrysie szkła), klucz `interior.alchemia-gallery` w `en` i `pl`.
- **Skan:** kontrole `alchemia-mall-footprint` i `alchemia-mall-height` z bazą 0 (`tools/glitch-scan/test/alchemia-checks.ts`).
- **Różnice od wzorca i od briefu:**
  - Sprzedawca jest figurą stałego tłumu (ADR-0058), a nie stojącym mieszkańcem ADR-0060: stojący zajmują losowo dwa z pięciu miejsc chunku (jest ich więcej niż stojących), więc nie byłoby sprzedawcy w każdym sklepie. Klienci i ludzie przy balustradzie są miejscami tłumu ADR-0060.
  - Drzwi zaplecza mają 0,85 m: tylko dla obsługi, poza drogą NPC; za ladą jest kieszeń sprzedawcy, do której klient nie wchodzi.
  - Lokal z roletą nie ma wyposażenia (nie widać go i nie da się wejść); z kratą ma, przy zgaszonym świetle i ekranach.
  - Plecy lokali to szkło fasady (rama bez tafli), więc zaplecza widać z ulicy; regał towaru stoi przy szkle.
  - Sklepy na P0 (etap O2 w planie etapów) czekają na O3: dopóki food hall nie przejdzie na P3, P0 to hala z jednostkami i sprzedawcami z imionami, których O2 nie rusza (zrobione w O3).
- **Rysunek i budżety:** sklepy w siatce wnętrza (do 45 m od hali), bez nowej siatki i wywołań; modele gry i sprzedawcy w siatce bloku mebli ulicznych (ADR-0050). Trójkąty siatki wnętrza 4 432 → 52 342 (104 684 wierzchołki, indeksy 32-bitowe); limit testu wnętrza 60 000 obok wspólnych 40 000 (decyzja z 19.11: trójkąty wolne). Sceny `npr-perf` (wywołania i aktywne siatki, przed → po, budżety bez zmian):
  - `alchemia-tpp`: 299/118 → 299/118 (budżet 380/146);
  - `alchemia-t2-tpp`: 222/77 → 222/77;
  - `alchemia-p1`: 209/78 → 209/78;
  - `alchemia-p2`: 211/78 → 211/78 (budżet 216/80);
  - `zielona-budowa-tpp`: 157/72 (budżet 172/80).
- **Otwarte po O2:**
  - Przegląd kuratora topografii (treść Alchemii w obrysie T-329 bez zmian obrysu i wysokości; kontrole skanu pilnują obu).
  - Czas klatki na telefonie odniesienia z siatką wnętrza ok. 52 tys. trójkątów niezmierzony (pod SwiftShaderem tylko raport).
  - Lokal z roletą nie ma śladu świeżej obecności (nie widać wnętrza).

## Etap O3: wykonanie (19.11, gałąź `feat/alchemia-o3-foodhall`)
- **Wzorzec:** food court na najwyższej kondygnacji galerii handlowej jako kotwica, która ciągnie ruch w górę przez cały budynek (przyjęta praktyka projektowania galerii: kotwice na końcach ciągów i na górze, schody ruchome przy atrium). Stoiska z ladami w pierścieniu zewnętrznym, wspólne stoliki w pasach przed nimi, jedno wejście z galerii do każdej lady. Na P0 lokal liniowy galerii (in-line unit) jak w O2 i punkt orientacyjny w atrium (fontanna pod otwartym atrium jako miejsce spotkań).
- **Przeniesione na P3** (`units.ts`, ten sam identyfikator i klucz sprzedawcy, bo zapis je nazywa): dwanaście jednostek hali z ladami, ściankami (0,2 m), roletami, zapleczem Oyajiego, kioskiem Sachiko z daszkiem, punktami sprzedawców i klientów oraz tłumem (`crowd.ts`).
  - Zachód (lada na wschód, głębokość 4,2 m): thai, korean (roleta), bar Fumiko w narożniku NW (lada od szkła do klapy przy południowym końcu, stołki przed nią).
  - Północ (lada na południe, 4,8 m): Kenta, Goro, kawiarnia.
  - Wschód (lada na zachód, 4,2 m): grecka, gruzińska (roleta), wok.
  - Południe (lada na północ): burger (roleta), kiosk Sachiko.
  - Narożnik SE: sklep Oyajiego, lada pancerna z kratą na zachód, zaplecze za ścianką z drzwiami, klapa w ladzie przy drzwiach zaplecza.
  - Szyldy z nazwami własnymi neonem (RAMEN FUMIKO, OKONOMIYAKI, KASA TEA, KAWA, ARMS, THAI, GYROS, WOK, KIOSK; zgaszone SEOUL, TBILISI, BURGER).
- **Trzy warstwy P3** (`foodhall-kitchens.ts`, `foodhall-seating.ts`): kuchnie (blat do biodra, kuchenka, garnki z parą, okap z kanałem do stropu, lodówka, ekran z menu, kasa z kablem ze stropu, kubek, kartony); stoły z ławami (dwa zestawy na zachodzie, trzy na wschodzie, dwa na południu między holem windy a kioskiem, jeden w kącie przed barem Fumiko), półki do jedzenia na stojąco przy balustradzie atrium na galerii zachodniej i wschodniej, lampiony nad stołami i girlandy lampionów wzdłuż balustrady atrium, neon FOOD HALL pod stropem nad galerią północną (widoczny z przyjazdu schodami ruchomymi i z niższych kondygnacji), rury, kable i kanał pod stropem, butle gazowe i ekrany menu w ramkach w kuchniach, automaty z napojami i kosze z modeli gry. Ślady świeżej obecności: parujące miski, rozlany napój, przewrócony stołek, serwetki pod stołami, para nad garnkiem w każdej otwartej kuchni.
- **Drugi lokal Fumiko na P0** (`fumiko-p0.ts`): narożnik NW dawnej hali z okienkiem i drzwiami na T1, ścianki do sklepów bez drzwi, kuchnia z okapem i lodówką. Harmonogram (`keeper-walks.ts`, `schedules.ts`): od 16 do północy bar na P3, po północy (hala zamknięta) schodami ruchomymi i przez T1 do okienka, gdzie obsługuje do 4, potem stołek przed okienkiem do 16 (dialog `fumiko_closed`). Stołki przechodniów przy okienku zostały.
- **Sklepy P0** (`shops-plan.ts`, wzorzec O2, ścianki 0,2 m): CHIPFIX (naprawa), NEONSKIN (odzież), APTEKA NOVA, DATAKOM (roleta), SOYA MAX (syntetyczne jedzenie), SKUP (lombard), TETSU (broń, narożny), HOLODROM (VR), lokal do wynajęcia (wszczepy), KANTOR, SUMI INK (tatuaż), FLORA (krata). Zamknięte 3 z 12. Wejście od T1 (6 m), drzwi wschodnie w miejscu tylnych drzwi Oyajiego (do korytarza trzonu NE), tylne przejście do schodów hali i drzwi na P−1, hole obu wind.
- **Punkt orientacyjny P0** (`landmark.ts`): fontanna 3,2 × 3,2 m w środku atrium, na północ od pasów schodów ruchomych, z kolumną projektora i koi ze świetlnych plastrów (jeden przesunięty: pęknięty hologram), dwie ławy z gry i donice. Drogi grafu omijają ją od zachodu i północy.
- **Trzon NE od P0:** klatka zakosami od P0 (biegi P0→P1 jak wyżej, stopień 0,175 m), winda `alchemia-lift-ne` od −6,4 (otwory w płycie P1), szkło frontu przy trzonie 0,2 m zamiast 0,4 m, żeby pas schodów miał 1,5 m. Szacht instalacyjny w rogu za trzonem od P0 do stropu dachu.
- **Graf:** węzły P0 (`g0-ne`, przesunięte `hall-centre` i `hall-aisle` wokół fontanny, drzwi wschodnie do drzwi trzonu), P3 (`g3-e`, `g3-w`, przejścia przed ladami zachodnimi i wschodnimi, przed i za klapą Oyajiego). Usunięte węzły zaplecza Oyajiego na P0.
- **Wnętrza ADR-0061:** `alchemia-foodhall` to teraz P3, `alchemia-gallery` to P0–P2.
- **Zapis:** schemat się nie zmienia, migracji nie ma. Klucze postaci, identyfikatory jednostek i sklepów (`shopId` `yatai`, `oyaji`) zostały. Kenta, Goro, Fumiko i Oyaji mają harmonogramy, więc przy wczytaniu stają tam, gdzie mówi plan; Sachiko dostała jednoprzystankowy plan z tego samego powodu. Bryły hali na P3 zajmują sloty dawnych jednostek i stołów w `ALCHEMIA_PROPS`, więc identyfikatory po nich zostały; winda NE ma o poziom więcej, więc sklepy O2 przesunęły się o dwa (bez stanu w zapisie). Otwarte jak po O1: gracz zapisany na P0 w miejscu nowej ścianki sklepu wczyta się w niej.
- **Różnice od wzorca i od briefu:**
  - P3 ma 3,9 m w świetle (wysokości kondygnacji z O1), mniej niż 5–8 m dla food hallu z zasad.
  - Hana zostaje z wózkiem na T1: to handlarka uliczna, nie jednostka hali.
  - Fala Hebi idzie do Oyajiego po grafie poziomów: `ChaseVictim` używa `pursueTo` jak pościg za graczem (obszar AI/NPC, jedna linia), bo ofiara jest na innej kondygnacji niż ulica. Zamiast tylnych drzwi Oyajiego na T1 lada ma klapę przy drzwiach zaplecza.
  - Oyaji spędza noc za kratą przy ladzie, nie przy tylnych drzwiach na T1 (tych już nie ma).
  - Pościgi z „hali” w testach `alchemia-foodhall`, `alchemia-mall` i `alchemia-parking` biegną z P0 (północny chodnik), nie spod lady Kenty, żeby nie wydłużać ich czasu; nowy pościg z T1 na P3 jest w `alchemia-food-court.test.ts`.
- **Miara strzału zza barku (G-939):** galeria z food hallem 11 → 5. Trzon NE do P0 dokładał 3 miejsca na P1; szacht w rogu za trzonem zamknął wszystkie dziewięć przy trzonie, zostaje szyb windy hali na P1.
- **Rysunek i budżety:** jednostki, kuchnie, stoły, szyldy, sklepy P0, lokal Fumiko i fontanna w siatce wnętrza, bez nowych siatek; modele gry w widoku `street-props` sklepów. Trójkąty siatki wnętrza 52 342 → 83 378 (limit testu 60 000 → 90 000, decyzja z 19.11). Przesłanianie `AlchemiaGalleryCull` obejmuje ruchome części wind od P0. Sceny `npr-perf` (wywołania i aktywne siatki, przed → po, budżety bez zmian): `alchemia-tpp` 299/118 → 283/113 (budżet 380/146; windy od P0 w przesłanianiu, sprzedawcy hali nad ulicą), `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 209/78 → 197/74, `alchemia-p2` 211/78 → 207/76 (budżet 216/80), `zielona-budowa-tpp` 157/72 → 153/70 (budżet 172/80).
- **Testy:** sim `alchemia-food-court.test.ts` (jednostki P3 w pierścieniu, sprzedawcy za ladami, klienci i tłum w zasięgu, rolety, ściany 0,2 m, kuchnie w trzech warstwach, pościg z T1 do lady Kenty, drugi lokal Fumiko z okienkiem, jej harmonogram, trzon i winda NE od P0, fontanna poza drogami), sklepy P0 w `alchemia-shops.test.ts` (raster drogi NPC przez wspólny `alchemia-raster.ts`), poprawione świadomie z komentarzem: `alchemia-foodhall`, `alchemia-mall`, `alchemia-parking`, `alchemia-market`, `schedule`, `w5-street-life`, `market-night`, `street-furniture`, `tpp-shoulder` i liczniki brył; app `alchemia`, `alchemia-market`, `alchemia-parking`, `trade-loop`, `item-level-session`, `m2-schedules`, `day-trade-ui`, `metro-map`; engine `alchemia`, `alchemia-gallery-cull`. Skan glitchy bez nowych miejsc.
- **Otwarte po O3:**
  - Przegląd kuratora topografii (treść w obrysie T-329, obrys i wysokość bez zmian, kontrole skanu zielone).
  - Gracz zapisany na P0 w miejscu nowej ścianki sklepu albo na P3 w miejscu lady wczyta się w bryle (jak po O1: przeniesienie na najbliższy węzeł to praca dla Persistence).
  - Szyb windy hali przy bramce P1 (5 miejsc miary strzału zza barku, G-939) do osobnej poprawki.
  - Czas klatki na telefonie odniesienia z siatką wnętrza ok. 83 tys. trójkątów niezmierzony.

## Konsekwencje
- Graf, punkty tłumu, zadania i dialogi związane z halą zmieniają się w O1 i O3. Testy tras i zadań idą za nimi.
- Złote hashe podłogi testowej się nie zmieniają (to inny świat). Identyfikatory brył Alchemii zmieniają się w O1, świadomie, z opisem w commicie.
- Topografia: wpis T dla korpusu (wysokość do 10,7, otwór atrium) i przegląd kuratora w O1.
