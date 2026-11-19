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
  - Trzon NE zaczyna się na P1, bo róg P0 to sklep Oyajiego z zapleczem, harmonogramem i zadaniami. Przeniesienie należy do O3, a P0 ma drugą drogę przez schody ruchome i wyjścia na T1. Trzon NE stoi 2,5 m od narożnika (x do 433,7), poza zaokrągleniem.
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
  - Sklepy na P0 (etap O2 w planie etapów) czekają na O3: dopóki food hall nie przejdzie na P3, P0 to hala z jednostkami i sprzedawcami z imionami, których O2 nie rusza.
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

## Etap O2b: wejście główne (19.11, gałąź `feat/alchemia-o2b-wejscie`)
- **Problem (pomiar krokowanym graczem):** z chodnika Bajkowskiego w osi na wschód od rampy nie dało się wejść prosto do galerii. Przy x 420 gracz wchodził do domku klatki P−1 (x 418,3–421,7, z 12,4–22,6, drzwi od południa) i schodził na parking, przy x 413 zjeżdżał rampą aut, a przy x 421–424 zatrzymywał się na zachodnim narożniku trójkątnego pawilonu (420,5; −8,85), który z grządką przy parapecie rampy zostawiał 1,7 m przejścia. Drzwi główne P1 (2,4 m, x 418,8–421,2) stały za domkiem klatki, a środkiem pasa za nim stały dwa słupy przejścia pod L2 (x 422,6, z 9,5 i 24,5). Najkrótsza droga z (421; −11,3) do galerii przy atrium: przęsłem arkad i przejściem pod L2 na zachód od rampy, 10,3 s biegiem i 17,1 s marszem; slalomem wokół domku klatki 7,8 s biegiem, ale tylko przy znajomości pięciu zakrętów.
- **Wzorzec:** czytelne wejście galerii handlowej na końcu prostej osi od ulicy i „desire line” z urbanistyki: pieszy idzie najkrótszą widoczną linią, więc to ona ma być drogą, wolną, szeroką i oświetloną, a nie obudowanym slalomem (J. Gehl, „Cities for People”, 2010; wayfinding: P. Arthur, R. Passini, „Wayfinding: People, Signs, and Architecture”, 1992). Różnice: oś prowadzi pod płytą L2, więc portal i pas w podsufitce zastępują widok na fasadę; wejście jest jedno, na środku południowej ściany P1, a nie w narożniku.
- **Przesunięte, nie obudowane** (decyzja użytkownika z 19.11):
  - domek klatki P−1 o 6 m na wschód, pod zachodnią ścianę skrzydła wschodniego L1 (x 424,3–427,7, z bez zmian, drzwi dalej od południa). Bieg ma 29 stopni po 0,179 m (było 28 po 0,179, spocznik na −1,19 zamiast −1,39). Stopa biegu łączy się z fartuchem P−1 przejściem pod T0 (`P1_STAIR_LINK`, x 418,3–427,5, z 22,6–24,5) przez otwór we wschodniej ścianie P−1; poza obrysem P−1 przejście jest osobną komorą w gruncie (`P1_LINK_VAULT`). Pokój ADR-0061 `alchemia-parking` obejmuje przejście, a graf ma węzeł `alchemia-p1-stair-link`;
  - skrzydło wschodnie L1 zaczyna się na x 427,7 (było 424), domek klatki do niego przylega, ekran na froncie skrzydła krótszy o 3,7 m;
  - dwa słupy przejścia pod L2 z x 422,6 na wschodnią krawędź rampy (x 418,9, z 11,8 i 24,5);
  - zachodni narożnik trójkątnego pawilonu o 2,8 m na wschód po tej samej linii boku Bajkowskiego, do (423,3; −8,7). Zaplecze pawilonu dłuższe o 1 m na północ (do z 1), więc powierzchnia zostaje (82 m² przed, 80,7 m² po), a stopa cokołu 0,1 m głębiej (−1,2);
  - grządka przy wschodnim parapecie rampy kończy się na z 1,2 (było 8), bo z latarnią z mapy (422,8; 3,5) zwężała oś do 3,8 m.
- **Drzwi główne:** jeden otwór 4,4 m (x 418,8–423,2, `MAIN_DOORS`), środek w osi drogi (x 421, `MAIN_WAY_X`). Hol wejścia w pierścieniu sklepów P1 ma 4,8 m (było 2,8 m). VOLTAGE (elektronika, otwarty) przeszedł do lokalu SAKURY (x 414,8–418,6), a zamknięta roletą SAKURA do wąskiego lokalu na wschód od holu (x 423,4–425,8). Przejście z holu wschodnich drzwi na galerię ma 2,2 m. Liczba lokali i udział zamkniętych bez zmian.
- **Oś:** od chodnika (z −11,3, na północ od słupków przy krawężniku z −11,8) do drzwi co najmniej 4 m w świetle. Najwęższe są ościeża drzwi (4,4 m) i miejsce przy latarni z mapy (4,3 m). Graf: węzeł `alchemia-t0-axis` (421; 11) łączy chodnik w zasięgu wzroku z `t0-roof` przed drzwiami i z drzwiami klatki P−1.
- **Światło prowadzące** (§4: zielone to wejścia i drogi), tylko rysowane, płaskie albo nad głową, w siatce frontu (bez nowych siatek i wywołań):
  - dwa przerywane pasy LED w posadzce po krawędziach osi (x 419,2 i 422,8), od chodnika do drzwi;
  - pas w podsufitce L2 nad środkiem osi;
  - przerywany pas w poprzek nad zakrytą częścią rampy (z 12,4), z przejścia pod L2 na zachód od rampy, czyli z drogi spod arkad;
  - portal: zielone ościeża i nadproże na szkle wokół otworu, ekran nad drzwiami.
  Neonu „ALCHEMIA” nad drzwiami nie ma: litery neonów rysuje silnik tylko dla szyldów sklepów i napisu na L3, a tekst nad samymi drzwiami zasłaniałaby płyta L2 (podsufitka 1,95 nad drzwiami na −2,2 i +0,1).
- **Arkady:** przerwy w parapecie rampy na wschód od podcienia nie ma. Przy z < 11 rampa jest otwarta, a kładka nad nią nie zostawiłaby autom 2,2 m prześwitu: przy z 0 jezdnia leży tylko ok. 1,2 m pod terenem. Droga spod arkad prowadzi na północ przejściem pod L2 na zachód od rampy, a przy z 12,4 w poprzek nad zakrytą częścią rampy na oś (oznaczona pasem w posadzce). Z wnętrza przęsła arkad (407,5; 0,5) do galerii przy atrium: 7,4 s biegiem.
- **Pomiar przed i po** (krokowany gracz, bieg; w nawiasie marsz):
  - z chodnika (421; −11,3) prosto na północ do galerii P1 przy atrium (z 37,6): przed nie da się (pawilon, potem domek klatki), najkrótsza droga przez arkady 10,3 s (17,1 s); po 7,3 s (12,1 s), bez zejścia niżej niż −2,2;
  - trasa grafu NPC z chodnika do P1: po ok. 50 m osią, przed ok. 90 m.
- **Testy:** nowy `alchemia-entrance.test.ts` (prosto z chodnika, spod arkad, szerokość osi, trasa grafu). Poprawione świadomie: test frontu (skrzydło wschodnie przylega do domku klatki), test silnika P−1 (wierzchołki klatki i jej zastępnika z daleka do x 428,2). Klatka P−1, rampa, parking, pościgi, pawilon, plac i sklepy przechodzą bez zmian w testach.
- **Rysunek i budżety:** sceny `npr-perf` (wywołania i aktywne siatki, przed → po, budżety bez zmian): `alchemia-tpp` 299/118 → 299/118 (budżet 380/146), `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 209/78 → 209/78, `alchemia-p2` 211/78 → 211/78 (budżet 216/80), `zielona-budowa-tpp` 157/72 → 157/72 (budżet 172/80). Przejście do klatki należy do siatki wnętrza P−1, światło prowadzące (52 prostopadłościany, ok. 620 trójkątów) do siatki frontu.
- **Uwagi do przeglądu kuratora topografii:**
  - T-230: pawilon na rogu krótszy od zachodu, narożnik (423,3; −8,7) zamiast (420,5; −8,85), na tej samej linii boku Bajkowskiego (odstęp od kostki chodnika jak przed); T-231: zaplecze x 424,5–428,5, z −3,5…1 (było do 0), stopa drabiny (424,1; −1,25);
  - T-238: druga klatka P−1 x 424,3–427,7, z 12,4–22,6 (było x 418,3–421,7), spocznik −1,19, 29 stopni; plan inwestora 2026 („klatka przy pawilonie metra”) bliżej niż przed: szyb klatki 4,2 m od wykopu hali metra B, przejście pod T0 2,0 m;
  - T-236: P−1 ma przejście pod T0 poza obrysem x 394–422 (x 422–427,7, z 22,6–24,8), jako komora w gruncie, NMT nad nim nietknięty.
- **Otwarte po O2b:**
  - Przejście do klatki P−1 na wschód od x 422 leży poza zasięgiem lampy parkingu (przycięcie `clip` do obrysu P−1), więc jest ciemniejsze niż fartuch.
  - Zapis: schemat bez zmian. Pozycja zapisana na dachu pawilonu w odciętym klinie (x 420,5–423,3) albo w dawnym domku klatki wczyta się na gruncie albo w powietrzu nad nim.
  - Słupki przy krawężniku Bajkowskiego (z −11,8, x 415,8, 419,3 i 420,8, meble z mapy) stoją na przedłużeniu osi i zostają: gracz idący dokładnie w osi od jezdni ociera się o słupek przy x 420,8.

## Konsekwencje
- Graf, punkty tłumu, zadania i dialogi związane z halą zmieniają się w O1 i O3. Testy tras i zadań idą za nimi.
- Złote hashe podłogi testowej się nie zmieniają (to inny świat). Identyfikatory brył Alchemii zmieniają się w O1, świadomie, z opisem w commicie.
- Topografia: wpis T dla korpusu (wysokość do 10,7, otwór atrium) i przegląd kuratora w O1.
