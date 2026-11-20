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
  - Przegląd kuratora topografii (T-329): zrobiony 19.11, przyjęte z uwagami (tylko dokumentacja, wpisane do T-329, T-145, T-205, T-242, T-327). Zapas skanu przesłaniania: kościół św. Józefa 23,2% przy progu 25% (pomiar bez Arkad i pawilonu; skan liczy 24,3%, 87 z 358, przegląd O4 20.11), więc O4 i O5 go pilnują. Proponowane kontrole skanu `alchemia-mall-footprint` (element galerii poza x 399,7–436,3, z 32–58,3) i `alchemia-mall-height` (ponad y 13,5), baza 0, do dodania w O2.
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

## Etap O2b: wejście główne (19.11, gałąź `feat/alchemia-o2b-wejscie`)
- **Problem (pomiar krokowanym graczem):** z chodnika Bajkowskiego w osi na wschód od rampy nie dało się wejść prosto do galerii. Przy x 420 gracz wchodził do domku klatki P−1 (x 418,3–421,7, z 12,4–22,6, drzwi od południa) i schodził na parking, przy x 413 zjeżdżał rampą aut, a przy x 421–424 zatrzymywał się na zachodnim narożniku trójkątnego pawilonu (420,5; −8,85), który z grządką przy parapecie rampy zostawiał 1,7 m przejścia. Drzwi główne P1 (2,4 m, x 418,8–421,2) stały za domkiem klatki, a środkiem pasa za nim stały dwa słupy przejścia pod L2 (x 422,6, z 9,5 i 24,5). Najkrótsza droga z (421; −11,3) do galerii przy atrium: przęsłem arkad i przejściem pod L2 na zachód od rampy, 10,3 s biegiem i 17,1 s marszem; slalomem wokół domku klatki 7,8 s biegiem, ale tylko przy znajomości pięciu zakrętów.
- **Wzorzec:** czytelne wejście galerii handlowej na końcu prostej osi od ulicy i „desire line” z urbanistyki: pieszy idzie najkrótszą widoczną linią, więc to ona ma być drogą, wolną, szeroką i oświetloną, a nie obudowanym slalomem (J. Gehl, „Cities for People”, 2010; wayfinding: P. Arthur, R. Passini, „Wayfinding: People, Signs, and Architecture”, 1992). Różnice: oś prowadzi pod płytą L2, więc portal i pas w podsufitce zastępują widok na fasadę; wejście jest jedno, na środku południowej ściany P1, a nie w narożniku.
- **Przesunięte, nie obudowane** (decyzja użytkownika z 19.11):
  - domek klatki P−1 o 6 m na wschód, pod zachodnią ścianę skrzydła wschodniego L1 (x 424,3–427,7, z bez zmian, drzwi dalej od południa). Bieg ma 29 stopni po 0,179 m (było 28 po 0,179, spocznik na −1,19 zamiast −1,39). Stopa biegu łączy się z fartuchem P−1 przejściem pod T0 (`P1_STAIR_LINK`, x 418,3–427,5, z 22,6–24,5) przez otwór we wschodniej ścianie P−1; poza obrysem P−1 przejście jest osobną komorą w gruncie (`P1_LINK_VAULT`). Pokój ADR-0061 `alchemia-parking` obejmuje przejście, a graf ma węzeł `alchemia-p1-stair-link`;
  - skrzydło wschodnie L1 zaczyna się na x 427,7 (było 424), domek klatki do niego przylega, ekran na froncie skrzydła krótszy o 3,7 m;
  - dwa słupy przejścia pod L2 z x 422,6 na wschodnią krawędź rampy (środek x 418,6, lico 418,9; z 11,8 i 24,5);
  - zachodni narożnik trójkątnego pawilonu o 2,8 m na wschód po tej samej linii boku Bajkowskiego, do (423,3; −8,7). Zaplecze pawilonu dłuższe o 1 m na północ (do z 1) oddaje część powierzchni: obrys z zapleczem 93,9 → 80,7 m² (−14%), sam trójkąt 82,5 → 62,9 m², w obrysie 12,9 × 14,7 m (plan inwestora ok. 18 × 15 m; przegląd kuratora 19.11). Stopa cokołu 0,1 m głębiej (−1,2);
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
  - Słupki przy krawężniku Bajkowskiego (z −11,8, x 415,8, 419,2 i 421,0, meble planu, nie OSM) stoją na przedłużeniu osi i zostają: słupek przy x 421,0 wypada dokładnie w osi `MAIN_WAY_X`, więc gracz idący w osi od jezdni go obchodzi.
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

## Etap O3: poprawka czasu fali (20.11, gałąź `fix/m4-contracts-czas`)

- **Problem:** po O3 fala Hebi zadania ochrony zaczynała na T1 i wspinała się trzy piętra do Oyajiego na P3. Testy ochrony w `m4-contracts` przekraczały 20 s w pełnym przebiegu z pokryciem (main czerwony od #787).
- **Pomiar (profil CPU, seed 5):** kroków do zranienia Oyajiego 1173 (1020 przed O3). Krok z falą kosztował dwa razy więcej: graf poziomów co krok dla czterech gangerów (`pursueTo` 1948 z 4400 ms) i ruch po schodach ruchomych.
- **Zmiana 1, wynik bez zmian (memoizacja w obrębie kroku):** jedno przeszukanie grafu na krok gangera dla drogi i pozycji strzeleckiej (`levelSearch`). Pozycja strzelecka sprawdza węzły w kolejności (koszt, indeks) do pierwszego widzącego cel. Zapytania do indeksu brył: 372 → 273 na krok (`level-chase-cost.test.ts`). Hash stanu fali przez 1400 kroków się nie zmienił.
- **Zmiana 2, treść:**
  - Naloty wchodzą przy drzwiach trzonów na P2 (SW od parkingu przy Świętoduskiej, NE od drzwi wschodnich, drogą od Lubartowskiej). Przed falą zostaje ostatni bieg schodów ruchomych.
  - Wzorzec: opóźnione pojawienie się (spawn delay) na zegarze symulacji. Wejście ma pole `delay` w planie miejsca (`SitePlan.delay`, `contract-plans.ts`): raid_north 6,5 s, raid_east 9,5 s.
  - Flaga `plan:way:<id>` wstaje przy przyjęciu zadania. `contractPlanSystem` opuszcza ją w ticku `tally.startTick + delay`, a streamer wtedy stawia falę.
  - Flaga działa jako warunek `none`: jej opuszczenie fali nie zabiera, ani przy przybyciu, ani przy końcu zadania.
  - Zapis: flaga i `startTick` są w zapisie, schemat bez zmian. Zapis sprzed tej zmiany nie ma flagi, więc fala jest od razu.
- **Czas gry:** Oyaji obrywa po 1069–1094 krokach od przyjęcia zadania (ok. 18 s; przed O3 1020, po O3 z T1 1173). Gracz biegnący od wózka Hany ma więc tyle czasu, co przed O3. Opisy miejsc (en, pl) mówią o schodach.
- **Czasy testów (bez pokrycia / z pokryciem):** „walks up to Oyaji” 4,7 / 11,0 s → 1,8–2,1 / 4,3–6,6 s; „a save during the raid” 8,2 / 19,0 s → 2,7 / 5,3–6,3 s (load 4–9 na 4 rdzeniach).
- **Testy:** `untilCrew` w `packages/sim/test/helpers.ts` czeka na falę. Dostosowane: `m4-contracts`, `contract-yaw`, `m4-docks`, `wave1-net`, app `m4-loop` (`shootDown` staje na piętrze celu). Nowy test: zapis w trakcie dojścia fali, po wczytaniu fala przychodzi w tym samym ticku.
- **Otwarte:** hook `protect_2` w `packages/narrative/ink/{en,pl}/hooks.ink` mówi jeszcze o „ścieżce od Świętoduskiej wzdłuż straganów” (nieaktualne od O3, obszar Narrative). Czujka wariantu `lockdown` stoi dalej na ulicy i wspina się po grafie.

## Etap O4: wykonanie (20.11, gałąź `feat/alchemia-o4-dach`)
- **Wzorzec:** intensywny dach zielony (roof garden), FLL „Dachbegrünungsrichtlinien – Richtlinien für Planung, Bau und Instandhaltung von Dachbegrünungen” (2018): roślinność na warstwie substratu w podniesionych grządkach z obrzeżem (drzewa i krzewy od ok. 0,5 m substratu), utwardzone ścieżki między nimi, technika dachu w osobnej strefie. Jak na planszy (schemat kondygnacji i widok od frontu): jasny pierścień ścieżek wokół otworu atrium, zieleń po obu stronach, pergole, ławki i drzewa na najwyższym tarasie.
- **Plan** (`roof-plan.ts`, metry świata, dach 10,7):
  - ścieżki z płyt (`ROOF_PATHS`): pierścień 2,4 m wokół balustrady atrium, dojścia do drzwi obu trzonów (SW od północy, NE od zachodu) i bramek obu wind (hali od północy, NE od południa), ścieżka poprzeczna do pergoli zachodniej i podłogi trzech pergoli;
  - 11 grządek: 7 podniesionych (0,55 m: substrat w betonowym obrzeżu, drzewa, krzewy, rabaty kwiatów) i 4 trawniki niskie (0,15 m, wchodzi się na nie), wszystkie z zaokrąglonymi narożnikami (`Piece.outline`); grządka w narożniku NW współśrodkowa z zaokrągleniem dachu;
  - trzy pergole z ciemnego drewna (słupy 0,2 m, belki na 2,4 m, krokwie co 0,6 m, pnącza na krokwiach i słupach) z 44 rubinowymi lampionami chōchin (dół na 1,95 m nad dachem): zachodnia nad dwiema parami ławek twarzami do siebie i stołem piknikowym, północna z ławkami twarzą do atrium, południowa nad dwiema ławkami i donicami;
  - modele gry (`ALCHEMIA_ROOF_PROPS`, widok `street-props` na końcu `WORLD_SCENERY`): 4 drzewa (ok. 6 m) i 20 krzewów w grządkach, 9 ławek, 6 latarni parkowych przy ścieżkach, 2 donice, szafka techniczna i trzy nieruchome postacie (ADR-0058 etap 8: dwie siedzą na ławkach, ogrodniczka przy skrzynkach).
- **Trzy warstwy** (`roof-dress.ts`, `docs/zasady-lokacji.md` §2–§5): technika w części wschodniej (agregat z wentylatorami, czerwoną lampką awarii i panelem, cztery rzędy paneli słonecznych pochylonych na południe, maszt z anteną talerzową i czerwonym światłem, kable po dachu oklejone taśmą do domku trzonu NE) tuż obok dzikiego ogródka mieszkańców (16 drewnianych skrzynek z sałatą w rzędach, pomidorami na tyczkach albo rozsadą, sznur z praniem nad szczeliną między nimi, krzesło turystyczne, puszki, wiadro, radio z zapaloną diodą, worek ziemi). Ślady świeżej obecności: papieros dymiący w popielniczce przy krześle, parujący kubek, otwarte pudełko z jedzeniem i telefon z zapalonym ekranem na stole piknikowym, przewrócona konewka w kałuży. Światło: rubinowe lampiony, latarnie parkowe, zielony pas LED pod obrzeżem podniesionych grządek wzdłuż dróg (§4: zielone to drogi), czerwone światło masztu.
- **Bryły:** grządki, słupy pergoli, stół, skrzynki, słupki prania, krzesło, agregat z kanałem, regały paneli, maszt i bryły modeli gry (pnie, ławki, słupy latarni, szafka, betonowe skrzynie donic) jako kafelki 12 m na końcu `ALCHEMIA_PROPS` (`ROOF_SOLID_PROPS`), więc identyfikatory przed nimi zostają. Rysowane tylko: belki, krokwie, lampiony, pnącza, kwiaty, pranie, kable, drobiazg.
- **Graf:** węzły `gr-nw`, `gr-ne` (północne narożniki pierścienia) i `gr-wp` (środek pergoli zachodniej, między ławkami); drzwi trzonu NE na dachu łączą się z `gr-ne`. Dojścia z T1, T0 i P−1 na dach, pościg z dachu do lady Kenty i spacer gracza z trzonu SW na dach bez zmian w testach.
- **Tłum ADR-0060:** siedzący na trzech ławkach (miejsca jak przy meblach ulicznych, `seatGroups`) i dwie osoby oparte o balustradę atrium (od północy i od wschodu), pod gołym niebem (bez `indoor`).
- **Rysunek** (`roof-geometry.ts`, bez nowych siatek i wywołań): grządki, pergole, lampiony, technika i płyty ścieżek w siatce zewnętrznej (z daleka), drobiazg w siatce wnętrza (do 45 m od hali), modele gry w blokach mebli ulicznych (z daleka ich uproszczone drzewa i latarnie). Płyty 0,9 × 0,6 m w przewiązce, co trzydziesta ciemniejsza i co pięćdziesiątej brak (§3). Rośliny (sałata, pomidory, rozsada, pnącza na krokwiach i słupach, kwiaty na rabatach) są nieregularnymi kępami liści: niska kopuła z 5 ścian, wierzchołki z hasza miejsca, czubek pochylony, sześć odcieni jak `LEAF` w zasłonach C2; krzew z gry (`shrubs`, najmniej ok. 1,3 m) nie mieści się w skrzynce 1,25 × 0,72 m. Żadna roślina dachu nie jest prostopadłościanem. Trójkąty: siatka zewnętrzna 7 252 → 22 536 (dach z lampionami jako ośmiokątami, płytami i kwiatami), wnętrze 83 406 → 86 348, siatka budynku bez zmian 16 638; limity testu 40 000 i 90 000 bez zmian.
- **Budżety `npr-perf`** (wywołania i aktywne siatki, przed → po, budżety bez zmian): `alchemia-tpp` 283/113 → 283/113, `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 197/74 → 197/74, `alchemia-p2` 207/76 → 207/76, `zielona-budowa-tpp` 153/70 → 153/70.
- **Pomiary:** skan przesłaniania kościoła św. Józefa 87 z 358 oczu (24,3%) przed i po (przegląd kuratora 20.11; wcześniejsze 83 z 358 to pomiar bez Arkad i pawilonu), także z koronami drzew dachu jako bryłami (pomiar poza skanem). Na mapie wysokości linii widzenia nad dachem wolne linie przechodzą tylko nad narożnikiem NE (x ≥ 435, z ≥ 57), więc nic tam nie stoi. Miara strzału zza barku (G-939): galeria 5 → 5, reszta miasta 8 → 8.
- **Kontrole skanu:** `alchemia-mall-height` i `alchemia-mall-footprint` obejmują elementy dachu (krokwie z pnączami do 13,50, maszt z lampą do 13,45); modele gry na dachu nie, bo drzewo rośnie ponad wysokość galerii jak na każdym dachu. Modele gry na dachu pilnuje osobna kontrola `alchemia-roof-model-height` (z przeglądu kuratora O4): rysowany szczyt modelu z `ALCHEMIA_ROOF_PROPS` ponad y 18,5, baza 0; dziś najwyżej sięgają dwa drzewa, do 18,04 (`tools/glitch-scan/test/alchemia-landmark-checks.ts`).
- **Różnice od wzorca i od planszy:**
  - Plansza ma na dachu prostokątny świetlik i szary budynek techniczny; tu zamiast nich agregat i panele (świetlik nad food hallem wymagałby otworu w stropie P3).
  - Pergole, lampiony i ławki to decyzja użytkownika z 19.11 („nasze pergole z lampionami i ławki”), na planszy ich nie ma; lampiony są rubinowe (czerwony papier chōchin, jak na straganach), co czytamy jako „rubinowy dziedziniec” z prośby.
  - Drzewa z gry nie mogą być niższe niż ok. 6 m (najmniejszy rozmiar modelu 0,7), więc są wyższe od drzewek z planszy (ok. 3–4 m).
  - Pergole mają belki na 2,4 m (na placu T0 w etapie 7 było 2,9 m), żeby zmieścić się w wysokości galerii 13,5 m.
  - Grządek nie ma w narożniku NE (linie widzenia na kościół św. Józefa) ani na drodze NPC (pierścień i dojścia).
- **Skan glitchy:** bez nowych miejsc (`pnpm scan:diff origin/main report`: 3 652 → 3 652 po merge #788).
- **Testy:** sim `alchemia-roof.test.ts` (otwór atrium wolny i balustrada cała, ścieżki wolne do 2,2 m i nic nie wisi nad nimi niżej niż 1,95 m, drzwi trzonów i bramki wind na ścieżkach, trasy z T1, T0 i P−1 do każdej ławki, trzonu NE i windy NE, krokowany spacer gracza od trzonu SW do ławki pergoli zachodniej i do trzonu NE, bryły i rysunek, drzewa i krzewy na substracie, trzy warstwy, tłum i postacie). Poprawione świadomie z komentarzem: liczniki ogona `ALCHEMIA_PROPS` w `alchemia-car-lift`, `-front`, `-p2`, `-pavilion`, `-shelter`, `-square` i filtr widoków w `street-furniture`.
- **Otwarte po O4:**
  - Przegląd kuratora topografii (treść dachu w obrysie T-329, wysokość brył do 13,5).
  - Gracz zapisany na dachu w miejscu nowej grządki wczyta się w niej (jak po O1 i O3).
  - Czas klatki na telefonie odniesienia niezmierzony.

## Etap O5: wykonanie (20.11, gałąź `feat/alchemia-o5-front`)
- **Wzorzec:** pasaż handlowy na kondygnacjach frontu połączony z galerią wokół atrium (skrzydło uliczne galerii, „street wing”): posadzki na poziomach galerii, przejście przez jej szkło na tych samych poziomach, lokale liniowe O2 wzdłuż pasaży, kotwica gastronomiczna na najwyższej kondygnacji jak food hall O3. Różnice: L1 leży na poziomie ulicy (T0 ze spadkiem), nie galerii, więc jest pasażem przejściowym od arkad do T0 z własnymi drzwiami, nie piętrem galerii; L3 to dalszy ciąg food hallu P3, nie osobny poziom sklepów.
- **Kondygnacje** (`front-levels.ts`, `front-shell.ts`): pełne bryły szkła L1–L3 zastąpiło szkło jako ściana 0,2 m (`MALL_GLASS_THICK`, rysowana ramą jak galerii), z drzwiami, a wzdłuż z 32 ścianą jest szkło galerii. Posadzki: L1 zachód −1,152 (nad najwyższą nawierzchnią −1,16 w obrysie, teren −1,24…−2,4), L1 wschód −0,8, L2 = P2 (2,3, strop pod L2), L3 = P3 (6,5, strop L2 plus łata stropu pod nawisem L3 nad x 422–428, z 12–13,7). Wysokości w świetle: L1 3,1 m i 2,75 m (pod stropem L2 na słupach, 1,95), L2 3,9 m, L3 3,9 m. Obrys i wysokość brył bez zmian.
- **Drzwi:** z galerii przez jej szkło od południa na P2 i P3, x 417,2–421,2 (4 m, nadproże 2,3 m); L1 zachód od arkad do pasażu (1,8 m) i do NIGHT SILK (1,5 m), w obu trzy stopnie w dół od podium w środku, nadproża nad progiem podium; od przejścia pod L2 (1,5 m, dwa stopnie po 0,18) i na pas T0 przed domkiem klatki hali (1,8 m, siedem stopni po 0,164 z policzkami); L1 wschód od dojścia do Lubartowskiej (1,5 m, dwa stopnie po 0,16); L3 na taras L2 od południa (2,4 m) i od wschodu (2 m). Stopnie 0,29 m. Na P2 przejście biegnie tam, gdzie stał TOKYO DRIP (przesunięty na L2 z tym samym id i miejscem na liście), na P3 jedna para stołów przesunięta przez drzwi do L3, druga 1 m na zachód, kosz z drzwi.
- **Układ:**
  - L1 zachód: pasaż wzdłuż wschodniego szkła (x 400,2–403,8) od arkad do T0, trzy lokale na zachód od niego (lokal do wynajęcia, FARMA PLUS, BLACK LOTUS) i NIGHT SILK z witryną pod arkadami (jak na planszy: oświetlone sklepy pod łukami), automaty, bankomat, ławka, szafka, kosz i donica z krzewem z gry;
  - L1 wschód: KONBINI z witryną na ulicę (szkło frontu przed jego witryną, drzwi w nim);
  - L2: grzbiet od drzwi galerii na południe do szkła nad placem (x 416,6–421,8; ekrany reklam, ulotki, ławka i lampiony przy szkle) i pasaż poprzeczny (z 17,6–21,6); po cztery lokale na południe i północ od niego na zachód od grzbietu (CYBERDECK, NEUROVIA z kratą, SYNAPSE, BITBANK; SHIBUYA, lokal do wynajęcia, BONSAI, TOKYO DRIP z roletą), dwa na wschód (OKAMI ARMS, DATAFIX), kawiarnia KISSA NEKO za szkłem nad placem (lada z ekspresem, gablotą i półkami, 14 stolików z krzesłami, lampy nad nimi), róg z automatami, bankomatem, ławką i donicą;
  - L3: bar SKY BAR wzdłuż szkła galerii (lada w kształcie L z klapą dla obsługi, stołki, półki z butelkami, ekran), grill YAKITORI w narożniku NE (linia z grillem i dymem, okap, lodówka), NOODLE BOX i ARCADIA od zachodu, dziesięć wspólnych stołów z ławami i lampionami (jak food hall O3), przejścia do drzwi na tarasy.
  Lokale według wzorca O2 (`buildShop`): trzy warstwy, szyldy neonem, sprzedawca z tłumu, ślad świeżej obecności; zamknięte 4 z 18 (22%). Ścianki lokali frontu 0,2 m. Zamknięte narożniki między lokalami a zaokrąglonym szkłem wypełniają szachty instalacyjne (jak NE_RISER). Pod stropami siatka ciepłych paneli światła co 2,4 m (poza zamkniętymi lokalami i szachtami), rysowana z kondygnacjami: oświetlone kondygnacje planszy widać przez szkło z placu i z daleka.
- **Tarasy:** taras L2 przed L3 i na wschód od niego dostępny z L3 drzwiami, dach L3 z zielonego dachu galerii przez przerwę 3 m w jego balustradzie (ławka pergoli południowej przesunięta z drogi, twarzą do niej). Balustrady tarasów bryłowe, stoły pod parasolami na dachu L3 bryłowe, donice i pnie drzew z gry bryłowe; żywopłot L3 na krawędzi południowej (na północnej zamykał przejście). Drzewa przesunięte: dwa spod szkła L2 (stały na dachu L1 wschód) na taras wschodni L2, dwa z masztów na dachu L3. Dach domu z arkadami zostaje za żywopłotem L2, jego balustrada tylko rysowana: bryłowa zasłaniała kościół św. Józefa dwóm kolejnym oczom ulicy.
- **Graf poziomów** (`front-nav.ts`, 12 węzłów): L2 i L3 od węzłów galerii przez drzwi (grzbiet, pasaż poprzeczny, kawiarnia; hala L3, przejście do drzwi południowych, oba tarasy), dach L3 z pierścienia dachu przez pergolę. Skrzydła L1 leżą na poziomie ulicy (do 1,5 m nad nią, idzie się prosto), więc w grafie tylko węzeł na podium w osi drzwi pasażu L1 (pasaż widać z niego przez drzwi) z krawędzią przez schody podium do szczytu rampy i węzeł przed drzwiami L1E z krawędzią do T0: dwa na poziomie ulicy, bo każdy kosztuje każdego idącego tam linię wzroku co krok. Krawędź północnych drzwi L1 do domku klatki wyciągała pościg z placu na P−1 przez skrzydło i halę (15,15 → 19,3 s gry), więc ich nie ma w grafie. Pościgi Alchemii (parking, food hall, 12 przebiegów): 9624 → 9628 kroków, koszt kroku bez zmian (1,13–1,17 wobec 1,20–1,22 ms przy obciążeniu 5–7).
- **Pomieszczenia ADR-0061:** kondygnacje frontu należą do `alchemia-gallery`, prostokąty na licach ścian, bez krawędzi w dłoni od ścianki wzdłuż niej.
- **Rysunek:** szkło frontu ramą (`paneFrame`) zamiast fałszywego wnętrza (`glassFacade` z sylwetkami i stolikami usunięte), pomieszczenia i lokale w siatce wnętrza, nazwy kawiarni, baru i grilla neonem (`venue-signs.ts`). Belka stropów frontu rysowana jako pierścień przy krawędzi (z zewnątrz jak dotąd), sufit pomieszczeń na spodzie stropu: pełna płyta schodziła o belkę (0,32 m) i chowała lampy i instalacje pod stropem. Siatka wnętrza rysowana także w 75 m od frontu (z placu przed nim i z Placu Łokietka przy Ratuszu), nie tylko w 45 m od hali; sceny `npr-perf` poza tym zasięgiem (Rynek ok. 100 m, Zielona) bez zmian. Deszcz nie pada w pomieszczeniach frontu. Modele gry pomieszczeń w ostatnim widoku `street-props` scenerii. Trójkąty: wnętrze 86 348 → 135 966 (limit testu 90 000 → 140 000, decyzja z 19.11: trójkąty wolne), kondygnacje 16 638 → 23 330, zewnętrzna 22 536 → 22 496.
- **Budżety `npr-perf`** (wywołania i aktywne siatki, przed → po, budżety bez zmian): `alchemia-tpp` 283/113 → 283/113, `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 197/74 → 197/74, `alchemia-p2` 207/76 → 207/76, `zielona-budowa-tpp` 153/70 → 153/70.
- **Ciepłe światło widziane z placu** (decyzja koordynatora po pierwszym raporcie: elewacja nocą ciemniejsza niż fałszywe wnętrza z main nie wystarcza; wzorzec: ciepłe tła main jako prawdziwe źródła w pomieszczeniach):
  - bary przy szkle (L3 od południa po obu stronach przejścia do drzwi, L2 w narożniku przy pasażu poprzecznym): lada z podświetlonym frontem i blatem, stołki, postacie z gry siedzące twarzą na plac, lampy wiszące nisko nad ladą, podświetlone tablice menu nad nią, stojaki z menu w narożnikach;
  - ciepłe pasy pod stropem wzdłuż szkła L2 i L3, świetlne sufity nad barami i kawiarnią, panele co 2,4 m (w siatce kondygnacji, więc i z daleka);
  - lokale od ulicy (NIGHT SILK pod arkadami, KONBINI): lampy wzdłuż witryny, podświetlone tło ekspozycji, ściana przy drzwiach i ściana za ladą;
  - pasaż L1: podświetlona reklama na boku NIGHT SILK, totem przy drzwiach od arkad, tablica nad tymi drzwiami, okładzina szachtu za pierwszym łukiem; lampiony w przęsłach arkad;
  - girlandy lampionów nad żywopłotami tarasów L2 i L3; postacie przy stolikach kawiarni przy szkle;
  - drzewa przesunięte w O5 na taras wschodni L2 i na dach L3 stały w linii widoku z placu: taras wschodni dalej na północ, dach L3 z powrotem przy masztach.
  Pomiar na zrzutach o 22:00 (`shots:compare`, obszar frontu w kadrze 1280 × 720, bez ekranu SEKI i hologramów, których O5 nie rusza; ciepły piksel: R > G > B, R − B > 40, jasność > 80):
  - `plac-front`: jasność 66,8 → 64,8, ciepłe piksele 8,0% → 6,6% (przed tym krokiem 61,0 i 3,1%);
  - `plac-gora`: jasność 54,3 → 54,1, ciepłe piksele 5,4% → 5,9% (przed: 48,5 i 0,6%).
  Z placu zostaje różnica pod łukami arkad i w pasie na prawo od ekranu SEKI: tła main były ciepłą płaszczyzną od posadzki do stropu, prawdziwe pomieszczenia mają posadzkę, meble i ludzi. Z daleka (dalej niż 75 m, wnętrza nie rysują się) świecą panele, pasy i sufity w siatce kondygnacji, bez osobnego tła ani siatki.
- **Bryły:** w slocie frontu w `ALCHEMIA_PROPS` zostały schody zieleni i filary arkad (na gruncie), reszta kondygnacji frontu, lokale (po jednym propie) i wyposażenie z donicami tarasów jako ostatnie (`FRONT_O5_PROPS`), kafelki 12 m. Identyfikatory sprzed O5 bez zmian.
- **Pomiary:**
  - miara strzału zza barku (G-275) w pomieszczeniach frontu: 181 przy pierwszym układzie, 0 po ściankach 0,2 m, szachtach w narożnikach i granicach pomieszczeń na licach ścian; galeria 0, reszta miasta bez zmian;
  - skan przesłaniania kościoła św. Józefa 87 z 358 przed i po (89 z bryłową balustradą dachu domu z arkadami, odrzucone);
  - skan glitchy: bez nowych miejsc; nowa kontrola `alchemia-front-footprint` (element pomieszczeń frontu poza obrysem i wysokością jego kondygnacji), baza 0; `alchemia-mall-footprint` liczy tylko lokale galerii;
  - czasy pościgów z pokryciem (main → O5): `alchemia-parking` 9,9 → 9,9 s, `alchemia-foodhall` 5,1/1,6/1,6 → 5,2/1,6/1,6 s, `m4-contracts` ochrona 4,0 → 4,0 s i zapis w trakcie nalotu 5,7 → 5,7 s.
- **Testy:** sim `alchemia-front-rooms.test.ts` (posadzki, szkło jako ściana, każdy lokal L2/L3 osiągalny z galerii, tarasy i dach L3, trasy z T1, T0 i P−1 i sprzed drzwi każdego lokalu, stopnie, gracz nie przechodzi przez szkło, wzorzec O2, HUD, tłum); engine `alchemia-front-rooms.test.ts`; app `alchemia-front.test.ts`; skan `alchemia-mall-checks.test.ts`. Poprawione świadomie z komentarzem: liczniki ogona `ALCHEMIA_PROPS`, slot frontu, ostatnie widoki scenerii, `alchemia-rounded` (szkło ścianą, balustrady bryłowe), `alchemia-green` (4 drzewa na L2), `alchemia-shops` (P2 ma 2 zamknięte z 11), `alchemia-food-court` (tłum przy stole w L3 poza rastrem P3), `alchemia-foodhall` i `alchemia-market` (węzły i tłum frontu w nowym teście), `alchemia-square` (lampiony nad T0), engine `alchemia` (limit trójkątów, deszcz w L1/L2/L3), `alchemia-rounded`.
- **Różnice od briefu i od wzorca:**
  - L1 nie leży na P2: skrzydła stoją na T0 pod stropem L2, więc L1 jest kondygnacją ulicy z wejściami z ulicy, a z galerią łączy ją ulica (arkady, przejście pod L2, drzwi główne P1); na poziomach galerii łączą się L2 (P2) i L3 (P3);
  - wysokość w świetle L1 3,1 m i 2,75 m, mniej niż 4–5 m dla sklepu z zasad: strop L2 na słupach stoi na 1,95;
  - dach domu z arkadami (C3) nie jest tarasem, na który się wchodzi (kościół św. Józefa);
  - schody L1E 0,16 m, L1 od przejścia 0,178 m, od T0 0,164 m;
  - własnych schodów we froncie nie ma: L2 i L3 obsługują trzony, windy i schody ruchome galerii przez jej drzwi.
- **Otwarte po O5:**
  - przegląd kuratora topografii (treść w obrysie frontu, obrys i wysokość bez zmian, skan przesłaniania jak na main);
  - zapis: schemat bez zmian; gracz zapisany przed O5 w bryle szkła frontu (niemożliwe) albo na P2 w lokalu TOKYO DRIP (teraz przejście) wczyta się normalnie, na P3 w miejscu przesuniętego stołu w jego bryle;
  - czas klatki na telefonie odniesienia z siatką wnętrza ok. 136 tys. trójkątów niezmierzony;
  - dalej niż 75 m od frontu (np. z Rynku) wnętrza frontu nie są rysowane: przez ramy szkła widać oświetlone stropy (panele, pasy i sufity w siatce kondygnacji), bez mebli i ludzi;
  - jasność frontu z placu (`plac-front`) o ok. 3% i ciepłe piksele o ok. 1,4 punktu poniżej main (szczegóły wyżej), do decyzji.

## Konsekwencje
- Graf, punkty tłumu, zadania i dialogi związane z halą zmieniają się w O1 i O3. Testy tras i zadań idą za nimi.
- Złote hashe podłogi testowej się nie zmieniają (to inny świat). Identyfikatory brył Alchemii zmieniają się w O1, świadomie, z opisem w commicie.
- Topografia: wpis T dla korpusu (wysokość do 10,7, otwór atrium) i przegląd kuratora w O1.
