# ADR-0074: Przebudowa Alchemii według planu inwestora

Status: przyjęty (6.11, decyzje użytkownika do otwartych pytań 1, 3–6 w sekcji „Decyzje użytkownika”; dalsze decyzje 7.11 po etapie 4: plac T0, spójność, teksturowanie, drzwi z metra B). Decyzje użytkownika z 6.11 są wiążące (sekcja „Decyzje użytkownika”). Krok 2 backlogu „Alchemia według przetargu”. Wejście: plan kuratora topografii [`docs/plany/alchemia.md`](../plany/alchemia.md) (źródła S1–S14, D1–D3, tabela NMT w §2). Stan kodu: `origin/main` 948fe48, rejestr topografii z gałęzi sesji.

## Kontekst
Użytkownik (6.11): „Alchemia powinna wyglądać jak na przetargach (zbierz plan z internetu). W niej są sprzedawcy w swoich sklepach. Trzeba będzie całkowicie przebudować obecną i dodać podziemny parking.” Przetargu nie było: teren ma spółka Arkady w użytkowaniu wieczystym, a jedynym planem jest koncepcja inwestora opisana w prasie 2009–2026 (plan, §1). Wersja z 2026 roku to **układ tarasowy na spadku działki** z trzema obiektami nad dwupoziomowym parkingiem:
1. nowy budynek z food hallem (22–23 punkty po 25–35 m², wspólne stoliki) pod tarasem, bliżej Ratusza, od Bajkowskiego (S13, S14);
2. odbudowane Arkady (ruina w66286396, Świętoduska 7) z dobudowanym piętrem i wejściem od Lubartowskiej, z restauracjami na dwóch poziomach (S5, S6, S14);
3. trójkątny przeszklony pawilon na rogu Bajkowskiego i Lubartowskiej, w miejscu kas MPK (S1, S7, S13);
4. parking podziemny na 2 poziomach (ok. 300–370 miejsc), „w pełni zautomatyzowany” (S11, S12), z funkcją schronu; pod działką archeolodzy znaleźli schron przeciwlotniczy z II wojny (S13).

**Co jest dziś w grze** (ADR-0063 etapy 4–6, #247, #312, #327):

| Element | Kod | Rejestr |
|---|---|---|
| Hala z modelu igor.tesV (CC-BY) w (421; 45), 11,0 × 12,2 m, dach 11,5 m, napis ALCHEMIA, schody zewnętrzne | `sim/content/alchemia.ts`, `alchemia-stairs.ts`, `engine/renderer/alchemia/` | T-145 |
| 5 stoisk z HW 4 (Just_Eh, CC-BY) na cokołach wzdłuż zachodniego płotu | `alchemia.ts`, `public/.../alchemia-props.glb` | T-145 |
| Winda na dach hali z mostkiem i tarasem (mechanizm ADR-0020), `ALCHEMIA_ROOF`, `ALCHEMIA_LIFT_SITE` | `alchemia-lift.ts`, `renderer/alchemia/lift-bake.ts` | T-145 |
| Sprzedawcy u stóp schodów stoisk (`STALL_OF`, `STALL_KEEPERS`), Hana z wózkiem (`HANA_SPOT`), Ren na tarasie (`REN_SPOT`), Kurosawa i czyściciele Kagami przy windzie, czujka Hebi | `alchemia-market.ts`, `schedules.ts` | |
| Skrytki `stash:targ-roof` (taras hali) i `stash:targ-overpass` (za ruiną), niecka `HEBI_HOLLOW` w `PADS`, kamera, neon i głośnik Hebi na ścianie ruiny | `alchemia-market.ts`, `lublin/sites.ts`, `devices.ts` | T-186 |
| Ruina w66286396 jako cała bryła 7,3 m | import mapy | T-188, G-396 |
| Pawilon metra `kanal` B „Alchemia” w (428; 28), hala biletowa 2,7 m pod ulicą (podłoga ok. −4,3) | `metro.ts`, `metro-pavilion.ts`, `metro-nav.ts` | T-157 |
| Pasmo targu 10–20 w `BAND_AREAS` `alchemia-market` (x 400–456, z 32–124) | `district-bands.ts` | ADR-0059 |
| Zapis v30, migracja targu z al. Tysiąclecia | `persistence/src/market-move.ts` | |

Hala, stoiska i winda nie odpowiadają żadnej bryle z planu. Teren spada ok. 10 m z południa (parking, ok. −1,5) na północ (Świętoduska, ok. −11), a w poprzek od Lubartowskiej do dna niecki o 3–4 m (plan, §2). Tarasy z planu wynikają z tego spadku. Alchemia nie ma dziś własnej sceny w `npr-perf`: stoi 166 m i dalej od każdej.

## Decyzje użytkownika (6.11)
- Bazą jest plan inwestora z 2026 roku: food hall pod tarasem, odbudowane Arkady (w66286396) z piętrem, trójkątny szklany pawilon na rogu Bajkowskiego i Lubartowskiej, parking na 2 poziomach. Wersja z 2009 roku odpada.
- P−1 i P−2 są grywalne. P−2 to automatyczny magazyn aut z robotami. Obok leży schron z II wojny ze skrytką Hebi do zadań na skradanie.
- Hana stoi z wózkiem na placu, a Ren na dachu trójkątnego pawilonu.
- Kenta i Fumiko mają lokale w food hallu, Sachiko kiosk przy wejściu z parkingu, Goro sklep hybrydowy, a Oyaji sklep na narożu. Każdy sprzedawca stoi w swoim lokalu.
- Kolejność: najpierw food hall ze sprzedawcami, potem Arkady, pawilon i parking.
- Druga tura (6.11): model hali igor.tesV znika całkiem; Arkady i trójkątny pawilon to tło z restauracjami, bez nowej mechaniki; cały kompleks z parkingiem i pawilonem w paśmie targu 10–20; hala metra B dostaje zejście do P−1 (etap 4); tunel pod Lubartowską do kwartału Olejna–Szambelańska–Bramowa wchodzi do zakresu jako przejście z P−1 (osobny etap po etapie 5, z kuratorem topografii, bo to odstępstwo od planu 2026 wzięte z wersji 2009).
- Godziny lokali (6.11, otwarte pytanie 1 rozstrzygnięte): jak w propozycji. Food hall 10:00–24:00, Fumiko z własnymi drzwiami 16:00–4:00, Oyaji do 22:00, reszta według dzisiejszych harmonogramów.

## Decyzje użytkownika (7.11, po etapie 4)
- **Pawilon (T-230):** bez powiększenia, zgodnie z rekomendacją kuratora z przeglądu etapu 4 (na zachód wszedłby w wylot rampy; powiększenie na północ nie jest zlecone).
- **T0 nad parkingiem:** asfalt parkingu z OSM znika. W jego miejscu atrakcyjny plac z pergolami i lampionami w stylu deptaku Krakowskiego Przedmieścia oraz zielony dach z trawnikami (zielony w sensie trawników, nie tylko koloru). Zamyka G-500.
- **Drzwi z hali metra B na P−1:** osobny etap.
- **Spójność:** Alchemia ma wyglądać jak jeden, jednolity kompleks, a nie zestaw osobnych klocków. Bryły food hallu, tarasów, Arkad, pawilonu, placu T0 i wejść na parking mają być ze sobą zintegrowane (wspólny język materiałów, przejścia, krawędzie, balustrady, oświetlenie).
- **Teksturowanie:** dodatkowy etap, w którym cała Alchemia dostaje odpowiednie tekstury w stylu NPR gry.

## Decyzje użytkownika (15.11, koncepcja rozbudowy)
Plansza: [`docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`](../world/koncepty/alchemia/01-rozbudowa-front.jpg) (widok od frontu, schemat kondygnacji, aksonometria). Użytkownik: „Podoba mi się taka zmiana”.
- **Wysokie zielone kondygnacje:** kompleks rośnie w górę schodkowymi tarasami z zielenią, jak na planszy. Obecne urozmaicenia dachu (pergole, girlandy, trawniki, ławki z etapu 7) przechodzą na te tarasy zamiast leżeć na jednym poziomie T0.
- **Parking:** wjazd i rampa na P−1 przesunięte zgodnie z planszą; nowe położenie ustala plan kuratora (stanowisko archeologiczne w1559354344, pawilon metra B T-157 i szyb T-238 zostają warunkami brzegowymi).
- **Deptak:** ulica po prawej stronie rzutu staje się deptakiem z kioskami i straganami (bez ruchu aut). To nowe celowe odstępstwo od Lublina: kurator wskazuje ulicę i odcinek, a wpis w `docs/topografia.md` powstaje razem z etapem, który to buduje.
- **Kolejność:** osobna seria etapów po wycinku rozgrywki w Sektorze W-3 (ADR-0082), chyba że użytkownik zdecyduje inaczej. Pierwszy krok: plan kuratora (bryły, poziomy, deptak, nowy wjazd) i zrzuty przed/po z modelami.

## Decyzja

### 1. Poziomy i bryły na NMT
Wszystkie y są orientacyjne, liczone w układzie gry (ADR-0042). Etap mierzy je na NMT 1 m i zapisuje w wierszu T. Każdy poziom łączy się na równi z jedną ulicą albo z sąsiednim poziomem:

| Poziom | y | Zasięg (x; z) | Na równi z | Co stoi |
|---|---|---|---|---|
| **T0**, taras górny | ok. −1,5 | parking w173531008 i południowy pas działki, z −16…ok. 32 | Bajkowskiego, chodnik Lubartowskiej na południu | zielony dach food hallu i parkingu, plac zabaw, pawilon metra B, kiosk windy, wyjścia klatek, trójkątny pawilon na rogu |
| **T1**, taras środkowy | ok. −6 | przed frontem food hallu, z ok. 58–75; od wschodu do Lubartowskiej przy z ≈ 85–95 | Lubartowska (ok. −5,5 przy z 88) | plac przed food hallem z wózkiem Hany, ogródki, schodki i siedziska, scena; wejście na piętro Arkad |
| **T2**, plac dolny | ok. −8,5…−9,5 | dno niecki: zachodnia połowa działki do Świętoduskiej i plac przed podcieniami Arkad, z ok. 75–135 | Świętoduska | zieleń, tablica pamięci (nazwa placu), zarys osady z ekspozycji archeologicznej, parter Arkad, wyjście z P−2, właz schronu |
| **Food hall** | podłoga ≈ T1 (−6), dach = T0 | propozycja x 398–438, z 32–58 (ok. 40 × 26 m) | T1 przez front, P−1 przez tylną ścianę | wspólna sala i 12 lokali |
| **P−1** | podłoga ok. −6 | pod T0, propozycja ok. 45 × 35 m | food hall (drzwi w tylnej ścianie), Bajkowskiego (rampa) | kabiny oddawania aut, miejsca z ładowarkami EV, kasy |
| **P−2** | podłoga ok. −9 | pod P−1, z wysięgiem na północ pod T1 aż do T2 („przed front Arkad”, S13) | T2 (wyjście północne) | regały z autami na paletach, roboty na szynach, korytarze serwisowe, sterownia |
| **Schron** | podłoga ok. −12 | pod T2, przy północnym końcu P−2 | P−2 (brama stalowa), T2 (właz ze schodami) | skrytka Hebi, ekspozycja |

- **Food hall a metro.** Szyb i hala pawilonu B (x 424,4–431,6, z 26,2–29,8, podłoga ok. −4,3) leżą na skraju proponowanego obrysu. Ściany food hallu i P−1 trzymają co najmniej 2 m od szybu i hali. Kontrole `metro-shaft-open`, `metro-entrance-blocked` i `building-underground-solid` zostają na bazie. Dokładny obrys ustala etap 1.
- **Tarasy T1 i T2** to `PADS` z wierszem T i powodem „bryła z planu inwestora” (ADR-0042). Teren z NMT zostaje tam, gdzie tarasu nie ma.
- **T0 nad food hallem i parkingiem** to grunt mapy wyrównany przez `PADS` do ok. −1,5. Bryły pod nim to wnętrza w ziemi (`GroundVault`, jak peron metra z ADR-0071 etap 4), więc `heightApart` mierzy je zwykłym y, a z ulicy ich nie widać (#316). Front food hallu na T1 i północny wylot P−2 na T2 to ściany w skarpie. Zamiennik do rozważenia w etapie 1: płyta-podłoga (`decks.ts`) nad wykopem. Wybór idzie do commitu z pomiarem.
- **Arkady** (w66286396) mają obrys z OSM bez zmian, 49,7 × 5,8 m. Parter stoi na T2 z podcieniami od zachodu, w rytmie przęseł z ortofoto. Piętro dobudowane „według materiałów międzywojennych” (S6) ma wejście od Lubartowskiej na równi z chodnikiem, ok. T1. Dach płaski z attyką, bo danych o dachu nie ma. Szopa w1565213799 zostaje bez zmian.
- **Trójkątny pawilon** stoi we wcięciu parkingu na rogu (ok. x 422–441, z −12…4). Trójkąt ok. 18 × 15 m, jedna kondygnacja do 5 m na T0, szkło na ramie, płaski dach z attyką dającą osłonę. Na dachu neon ALCHEMIA (nazwa własna, bez i18n) i miejsce Rena. Na dach wchodzi się drabiną serwisową od zaplecza (ADR-0021).
- **Skala.** Food hall ma ok. 40% prawdziwej powierzchni, a P−1 ok. 50 widocznych miejsc (ok. 15% z 370). Reszta stoi za ścianą albo w regałach P−2. To uproszczenie zapisujemy w T-145.

### 2. Rozbiórka
Znikają hala igor.tesV (z napisem, schodami, `ALCHEMIA_HALL_ROOF`), pięć cokołów stoisk, winda z szybem, mostkiem i tarasem (`ALCHEMIA_LIFT`, `ALCHEMIA_TERRACE`, `ALCHEMIA_ROOF`, `ALCHEMIA_LIFT_SITE`), `alchemia-stairs.ts` (o ile nie posłuży schodom tarasów) i niecka `HEBI_HOLLOW` (etap 2, zastępuje ją T2). Usuwamy też naziemny parking w173531008 (miejsca, zatoki i auta z `mapcity`) w etapie 4, kiedy auta zjeżdżają pod ziemię. Do tego czasu T0 na południu jest dzisiejszym parkingiem.

Propozycja (pytanie 1): model hali znika całkiem, bo nie pasuje do żadnej bryły z planu. Fronty pięciu sklepików HW 4 wracają jako fronty lokali **wewnątrz** food hallu. To ciągłość dla gracza i ten sam plik `alchemia-props.glb` po nowym wypieku.

### 3. Lokale i sprzedawcy
Food hall ma wspólną salę ze stołami pośrodku i lokale 5 × 6 m wzdłuż ścian. Z 12 lokali sześć ma właścicieli z gry. Reszta to tła z kuchni wymienionych w S13, część z opuszczonymi roletami.

| Postać | Lokal | Wejście i uwagi |
|---|---|---|
| Kenta | food hall, lokal przy wejściu z T1, otwarta płyta (okonomiyaki) | `STALL_KEEPERS.kenta` za ladą |
| Fumiko | food hall, bar z ladą na 6 stołków (ramen, `shopId: yatai`) | własne drzwi na T1, żeby działała po zamknięciu hali (pytanie 2) |
| Sachiko | kiosk przy wejściu z P−1 do food hallu (gazety, papierosy) | w etapie 1 przy tylnych drzwiach, które do etapu 4 prowadzą klatką na T0 |
| Goro | sklep hybrydowy przy wejściu z T1 (parasole i herbata) | parasole przy wyjściu na deszcz |
| Oyaji | sklep na północno-wschodnim narożu food hallu, krata i lada pancerna (`shopId: oyaji`, 120 HP) | zaplecze z drugim wyjściem na T1; napady `raid_north` (od Świętoduskiej przez T2 → T1) i `raid_east` (od Lubartowskiej przez T1) |
| Hana | wózek na placu T1 przed food hallem | decyzja użytkownika; `hana_stall` na T1 |
| Ren | dach trójkątnego pawilonu (etap 3), do tego czasu zielony dach T0 nad food hallem | decyzja użytkownika; torba Hebi (`stash:targ-roof`) obok niego |
| Kurosawa i czyściciele Kagami | T0 przy kiosku windy | zasadzka `KAGAMI_AMBUSH_FLAG` bez zmian |
| Czujka Hebi | w dzień przy włazie schronu na T2, w nocy obchód P−2 (etap 5) | do etapu 5 przy Arkadach na T2 |

Klucze postaci, `shopId`, dialogi (`oyaji_closed`, `fumiko_closed`), harmonogramy i zlecenia się nie zmieniają. Zmieniają się pozycje, `STALL_OF` (z numerów stoisk na lokale), `TARG_CONTRACT_SITE_SPAWNS`, `TARG_CONTRACT_SITE_FACING`, `CONTRACT_ITEM_SPOTS` i miejsca aktywności tłumu (ADR-0060): stołki przy ladach Kenty i Fumiko oraz stoliki wspólne jako miejsca „siedzi i je”.

Food hall, P−1, P−2 i schron dostają obszary w `INTERIORS` (ADR-0061): autozapis przy wejściu, pogłos i otoczenie. Arkady i pawilon dostają je razem ze swoim wnętrzem, jeśli rola z pytania 3 tego wymaga. Bez roli zostają bryłami z witrynami i tłem za szkłem.

### 4. Wejścia i komunikacja pionowa
- **Schody terenowe:** T0 → T1 przy obu bokach food hallu, T1 → T2 szerokie schody z siedziskami („schodki, nieregularne przestrzenie”, S13). Do tego jedna rampa piesza T0 → T1 → T2 o nachyleniu do ok. 8%.
- **Winda** (mechanizm ADR-0020) jedzie T0 (kiosk) ↔ food hall/P−1 (−6) ↔ P−2 (−9) w szybie przy tylnej ścianie food hallu. Etap 1 buduje przystanki T0 ↔ −6, a etap 5 dokłada P−2. Winda jest dla gracza. AI chodzi schodami (ADR-0021), więc każdy poziom ma drogę schodami.
- **Klatki schodowe:** dwie. Jedna przy windzie (T0 ↔ −6 ↔ −9), druga przy pawilonie metra (T0 ↔ P−1).
- **Rampa parkingu:** dwukierunkowa, od Bajkowskiego w miejscu dzisiejszego wjazdu (414; −7, y ok. −1,0) w dół na północ do P−1 (−6). Przy spadku 15% ma ok. 33 m długości i mieści się w obrysie w173531008. Wjazd z pętli Świętoduska → Bajkowskiego, wyjazd w lewo, na wschód, na Bajkowskiego (w40052294 jest jednokierunkowa na wschód; kierunki z OSM). Ruch na rampie dochodzi do istniejących kontroli pasów (`car-lane-off-road`, `lane-dead-end`, `turn-off-road`) i nie podnosi ich bazy. Auta znikają w kabinie oddawania na P−1, a z kabiny wyjeżdżają inne.
- **P−1 ↔ P−2:** klatka przy windzie i winda, a dla aut winda robotów (dekoracja).
- **Metro:** hala pawilonu B (ok. −4,3) dostaje w etapie 4 drzwi i krótki bieg w dół do P−1 (ok. 1,7 m). To propozycja z pytania 7 planu, bez decyzji użytkownika. Etap może ją pominąć bez szkody dla reszty.
- **Wyjścia:** każdy poziom podziemny ma co najmniej dwa wyjścia drożne dla gracza i AI. P−1: rampa, obie klatki, drzwi do food hallu. P−2: klatka i wylot na T2. Schron: brama do P−2 i właz na T2. Food hall: front na T1, zaplecze Oyajiego, drzwi do P−1 i klatka. Kontrola skanu `underground-level-exit` (§10).

### 5. Nawigacja AI między poziomami
Tak jak w metrze (#316, `metro-nav.ts`), nowy `content/alchemia/nav.ts` dodaje `ALCHEMIA_NAV` do `WORLD_NAV` w `world-map.ts`. Węzły stoją na osiach biegów, krok za pierwszym i ostatnim stopniem, oraz w drzwiach. Krawędzie mają `via` po rzucie biegu:
- T0 ↔ T1: oba biegi przy bokach food hallu i rampa;
- T1 ↔ T2: schody z siedziskami i rampa;
- T1 ↔ food hall: front i zaplecze Oyajiego;
- food hall ↔ P−1: drzwi przy kiosku Sachiko;
- T0 ↔ P−1: obie klatki i rampa aut (pieszo przy ścianie);
- P−1 ↔ P−2: klatka;
- P−2 ↔ T2: wylot północny;
- P−2 ↔ schron i schron ↔ T2: brama i właz;
- T1 ↔ piętro Arkad i T2 ↔ parter Arkad, jeśli wnętrze powstanie (pytanie 3);
- dach pawilonu: bez węzła. Ren stoi, a pościg kończy się u stóp drabiny, jak na dachach ADR-0021.

Wnętrza w ziemi liczą `heightApart` zwykłym y (jak sklepienia po G-371). Na jednym poziomie NPC omija przeszkody sam, a graf mówi tylko, którędy na inny poziom. Roboty P−2 to ruchome bryły (ADR-0020). Ich trasy są stałe i zależą od kroku symulacji, bez `Math.random`. Węzły korytarzy omijają szyny, a AI czeka na przejazd robota tak, jak czeka na windę pod platformą.

### 6. Oświetlenie i NPR
- Bryły zewnętrzne (food hall, Arkady, pawilon, schody i balustrady tarasów) idą do jednej siatki na materiale kitu, jak dziś `renderer/alchemia/`: bez cienia księżyca i warstwy glow, z kreską z G-bufora. Szkło food hallu i pawilonu działa jak szkło pawilonu metra (ADR-0071): nieprzezroczyste, z emisją wnętrza. W nocy pawilon świeci jak latarnia, a front food hallu ciepło.
- Neony (ALCHEMIA na pawilonie, szyldy lokali, holo-menu) świecą przez glow. Lampy tarasów biorą styl z kontroli `lamp-*` (Stare Miasto obok, `lamp-plain-by-styled` bez wzrostu).
- Wnętrza (food hall, P−1, P−2, schron) to bloki wnętrz (ADR-0038, `interior: true`) bez cienia księżyca, każde z jedną lampą punktową, jak pokój kapsułowy. Food hall ma ciepłe światło, P−1 zimne pasy jako emisję, P−2 półmrok z pomarańczowymi kogutami robotów, a schron słabe lampy z zasilania awaryjnego. Światło nie wpływa na wykrycie (ADR-0069 odkłada cień), więc półmrok P−2 to tylko nastrój.
- Tablica pamięci i Stolpersteine przy Lubartowskiej zostają bez neonów i reklam. Przy tablicy nie stawiamy miejsc zleceń ani spawnów napadu.

### 7. Budżety rysowania
- **Nowa scena** `alchemia-tpp` w `e2e/npr-perf.spec.ts` (krok `freeze` + `step`, ADR-0046): gracz na T1 przed frontem food hallu, kamera na Arkady i zejście na T2. Etap 1 dodaje scenę z budżetem „pomiar plus kilka procent” w `tools/perf-budgets.json`. Etap 4 dodaje `alchemia-p1` (gracz na P−1 przy kabinach). Bramką są wywołania i aktywne siatki, czas klatki to raport.
- **Koszt na element:** bryły zewnętrzne to 1 wywołanie (2 z G-buforem), włączone do 150 m. Każde wnętrze to osobny chunk albo siatka włączana tylko blisko (do ok. 45 m albo w środku), 1–2 wywołania. Roboty i auta w ruchu dzielą jedną siatkę (jak drony ADR-0058 etap 7), 1–2 wywołania. Sprzedawcy to istniejące postacie.
- **Trójkąty:** budynek do ok. 8 tys., wnętrze do 8 tys., rekwizyt do 1,5 tys. (ADR-0063).
- **Istniejące sceny** stoją dziś 166 m i dalej. Pawilon na rogu jest najbliżej Bramy Krakowskiej. Test silnika liczy odległości. Jeśli coś wejdzie w zasięg sceny, commit podaje pomiar przed i po, a podniesienie budżetu wymaga uzasadnienia i wpisu długu w ADR-0046. Migawkę NPR odświeżamy tylko wtedy, gdy zmiana jest w kadrze.

### 8. Zapis
- Każdy etap, który przesuwa albo usuwa coś zapisywanego, podbija `SAVE_SCHEMA_VERSION` i dodaje migrację z testem (CLAUDE.md). Numer wersji ustala etap przy integracji, bo inne PR-y też podbijają schemat. Dziś jest 30.
- Migracje mieszkają w `persistence/src/alchemia-rebuild.ts` (jak `market-move.ts`), a `migrations.ts` tylko je rejestruje. Każda jest rozpisana treścią swojego czasu, ze stałymi obszarami i punktami.
- **Etap 1:** gracz zapisany w obrysie hali, stoisk, szybu, mostka albo tarasu budzi się na T1 przed frontem food hallu. Zapisane stany ludzi targu (`MOVED_PEOPLE` z v30) znikają, więc postacie wracają na nowe miejsca. `stash:targ-roof` przechodzi do miejsca Rena na T0. Torby leżące w usuniętych bryłach spadają na T1.
- **Etap 2:** `stash:targ-overpass` i torby z niecki idą na T2 przy Arkadach, a gracz z niecki budzi się na T2.
- **Etap 3:** `stash:targ-roof` przechodzi na dach pawilonu, a stan Rena znika.
- **Etap 4:** gracz z naziemnego parkingu zostaje na T0. Bez zmian dla zaparkowanych aut, bo są treścią, nie zapisem.
- **Etap 5:** skrytka Hebi przechodzi do schronu, a stany czujki i ludzi zlecenia odzyskania znikają.
- Złoty hash determinizmu: jeśli etap go zmieni (nowe bryły w alokatorze, przesunięte postacie w scenariuszu testu), aktualizujemy go świadomie z powodem w commicie. Bryły Alchemii mają id od `ROOM_ID_BASE`, poza alokatorem, więc same budynki hasha nie ruszają.

### 9. Pasmo poziomów
Propozycja (pytanie 5): cały kompleks z parkingiem, schronem i trójkątnym pawilonem ma pasmo targu 10–20. `BAND_AREAS` `alchemia-market` rośnie do ok. x 379–479, z −16…140. `bandAt` patrzy tylko na x i z, więc pasmo obejmuje też poziomy podziemne. Test z ADR-0059 sprawdza, że w obszarze nie stoi żaden człowiek Krakowskiego spoza targu. Jeśli prostokąt złapie przystanek „Brama Krakowska 01” (447; 16), chodnik Lubartowskiej albo pawilon metra B, obszar dzielimy na kilka prostokątów (tabela przyjmuje listę), a nie wyłączamy test. Zamiennik: parking i pawilon w paśmie Krakowskiego 1–8 jako „przedsionek”, a targ 10–20 od T1 w dół.

### 10. Kontrakty, zadania i kod
- **Bez zmian w `packages/core/src/{ports,events,commands}`.** `ContractSiteId` (`hana_stall`, `hebi_stash`, `raid_north`, `raid_east`), `MetroStationId`, klucze postaci, skrytek i urządzeń zostają. `InteriorEntered` i `InteriorLeft` już istnieją. Jeśli etap 4 zechce interakcji z kabiną oddawania auta (gracz oddaje swoje auto), to osobne pytanie do architekta.
- **Hana:** zlecenia i bilans z ADR-0070 bez zmian, spawn `hana_stall` na T1.
- **Kurosawa:** zadanie z archiwum i zasadzka Kagami przy kiosku windy na T0. Czyściciele mają drogi grafu do T1 i P−1.
- **Hebi:** odzyskanie skrytki (ADR-0065, ADR-0069) do etapu 5 na T2 przy Arkadach, potem w schronie z dwoma podejściami (brama z P−2 obok robotów i kamer parkingu, właz z T2 obok czujki). Kamera, neon i głośnik (`dev:targ-*`) idą razem ze skrytką, a strefa `restricted` z `HEBI_STASH_ZONE` obejmuje schron.
- **Ren:** `m3_lustro`, miejsce i torba na dachu pawilonu (etap 3). Test sesji wchodzi tam drabiną.
- **i18n (ADR-0056):** nowe klucze nazw wnętrz (`interior.alchemia-foodhall`, `interior.alchemia-parking`, `interior.alchemia-shelter`), podpowiedzi windy i włazu w `i18n/en` i `i18n/pl`. Szyldy lokali tła są nazwami własnymi. Polski katalog zmienia się świadomie, bo dochodzą nowe teksty. Baza `i18n-scan` nie rośnie.
- **Podział kodu (ADR-0031):** treść w katalogu `sim/src/content/alchemia/` (`terraces.ts`, `foodhall.ts`, `units.ts`, `arkady.ts`, `pavilion.ts`, `parking.ts`, `p2-robots.ts`, `shelter.ts`, `nav.ts`, `market.ts` z ludźmi), każdy plik do 500 linii. Renderer w `engine/src/renderer/alchemia/` jako części za fasadą `BabylonRenderer` (zewnętrze, wnętrze food hallu, parking, roboty). Modele przez `tools/city_alchemia.py` (nowy wypiek frontów HW 4 i własna geometria Arkad, pawilonu i parkingu).
- **ADR-0063:** etapy 4–6 (hala, stoiska, winda, rozstawienie targu) zastępuje ten ADR. Licencje, ekran „Autorzy” i reszta ADR-0063 obowiązują dalej. **ADR-0071:** wejście B zostaje, a T-157 mierzymy na nowo, bo grunt wokół pawilonu robi się tarasem T0.

### 11. Topografia i skan
Każdy etap przechodzi przegląd `topography-curator` ze zrzutami z osi: z Bajkowskiego, z Lubartowskiej od Bramy Krakowskiej, z Placu Łokietka, zza Ratusza, ze Świętoduskiej i z T2 na Arkady.
- **T-145:** etap 1 pisze go na nowo jako celowe odstępstwo: plan inwestora z 2026 roku zbudowany do 2077, ze skalą z §1.
- **T-186:** zamyka go etap 2 (niecka znika, T2 jako nowy `PADS`).
- **T-188** i **G-396:** zamyka je etap 2 przez odbudowę Arkad na 2 kondygnacjach, z numerem PR.
- **T-157:** nowy pomiar w etapie 1 (pawilon metra na T0) i w etapie 4 (drzwi do P−1).
- **Nowe wiersze** (numery nadaje etap): tarasy T0, T1, T2 jako `PADS` z wartościami; food hall; trójkątny pawilon w miejscu kas MPK; P−1, P−2 i schron pod stanowiskiem archeologicznym w1559354344, gdzie w 2077 roku parking już stoi, a stanowisko zostaje ekspozycją; rampa i zniknięcie naziemnego parkingu w173531008.
- **Kontrole skanu** (baza w commicie etapu, który je dodaje):
  - `osm-building-kept`: budynek z listy `KEPT_OSM` (w66286396, w1565213799) ma bryłę z obrysem z OSM. Baza 0, etap 2.
  - `arcade-rhythm` (z przeglądu #357, G-461): filary podcieni Arkad stoją do 0,3 m od filarów z ortofoto, mają 0,45–0,65 m i nie ma filarów, których na ortofoto nie ma. Baza 0, etap 2.
  - `pad-dip-uncovered` (z przeglądu #357, G-460): próbki co 0,5 m w zasięgu padów T-217 na pojedynczych punktach siatki (przejście i oczko wokół nich), poza obrysem Arkad, płytami chodnika i podestem, gdzie `rawHeight − groundY` > 0,3 m. Pasy placu z przejściem to zamierzone ścięcie i kontrola ich nie liczy. Baza 0, etap 2.
  - `game-solid-landmark-occlusion` (z przeglądu #312): bryły Alchemii zasłaniają najwyżej 25% szczytu zabytku z oczu na ulicach w promieniu 250 m. Baza 0, etap 1.
  - `pad-unregistered` (z przeglądu #327): każdy `PADS` ma wiersz T. Baza z pomiaru w etapie 1, potem tylko spada.
  - `underground-level-exit`: każde wnętrze podziemne ma co najmniej dwa wyjścia drożne w grafie poziomów. Baza 0, etap 4.
  - `memorial-neon-clear` (z przeglądów kuratora, §6): świecący znak bliżej niż 20 m w poziomie od kamienia pamięci Placu Ofiar Getta albo od węzła OSM `memorial=stolperstein`. Liczą się szyldy, tablice venue, holo i reklamy mapy, neony gry i urządzeń, neony deptaka (C7), światło frontu (C4) i neonowe szyldy galerii, food hallu, pawilonu i domu z arkadami (`tools/glitch-scan/test/alchemia-landmark-checks.ts`). Liczą się tylko znaki na wysokości gruntu albo wyżej, więc neon Hebi w schronie pod T2 (14,2 m w poziomie od kamienia, 0,9 m pod placem) zostaje. Pierwszy pomiar 20.11 dał 12 miejsc (11 przy Stolpersteine: szyldy mapy i neon SAKE, oraz neon Hebi). Po G-943 baza 0: generator szyldów mapy ma strefę wykluczenia 20 m wokół miejsc pamięci (`packages/sim/src/content/remembrance.ts`), a neon SAKE wisi na domu Wiejskiego Raju, 22,5 m od kamieni.
  - `stair-foot-unpaved` (z przeglądu kuratora C5, PR #793): pas 1 m przed najniższym stopniem schodów gry (bryły ze stopniami w scenach i pawilonach metra, stopnie Alchemii z P−1, P−2, schronu i Arkad) z co najmniej 0,25 m² gołego gruntu albo trawnika; stopa schodów, która schodzi ze spadkiem placu, to jeden bieg (`tools/glitch-scan/test/stair-foot.ts`). Baza z pomiaru 20.11: 0; przed #795 (G-942, T-333) jedno miejsce, schody południowe placu C5 (4,55 m², 26% pasa).
  - `plan-prop-under-game` (z przeglądu kuratora C5, PR #793): punkt planu mebli (`docs/world/lublin-props.todo.json`, `inOsm: false`, `points` albo `position`), którego mebel import stawia, a gra zawsze zdejmuje (`street-props.ts`: obrys frontu, blok, postać, droga treści, L2 nad lampą), czyli martwy punkt planu (`tools/glitch-scan/test/plan-prop-under-game.ts`). Baza z pomiaru 20.11: 13 miejsc, 12 na T0 (6 ławek i 6 pastorałów pod frontem, podium C5 i L2) i budka sieciowa (430; −100) na drodze przez Plac Łokietka.
  - istniejące `metro-shaft-open`, `metro-entrance-blocked`, `building-underground-solid`, `interior-outside-building`, `interior-entrance-gap`, `bay-car-out-of-park` i `parked-car-*` bez wzrostu.

### 12. Etapy (osobne PR-y, w kolejności użytkownika)
Każdy etap ma test sesji bez renderera (`packages/app/test/alchemia-*.test.ts`, krokowanie `freeze` + `step`), testy treści `sim`, skan glitchy, e2e budżetów (`pnpm e2e e2e/npr-perf.spec.ts`), zrzuty do przeglądu kuratora w opisie PR i wpis w tym ADR-ze. Zmiany symulacji i zapisu idą osobno od renderera, jeśli etap jest duży.

1. **Food hall ze sprzedawcami.** Rozbiórka hali, stoisk i windy. Food hall z wnętrzem, 12 lokalami i sprzedawcami za ladami. T0 jako dach i T1 jako plac z Haną, schody T0 ↔ T1, winda T0 ↔ −6, klatka przy windzie, Ren i Kurosawa tymczasowo na T0. `ALCHEMIA_NAV` dla tych poziomów, obszar `INTERIORS` z autozapisem, scena `alchemia-tpp`, migracja zapisu. Test sesji: dojście do każdego sprzedawcy, handel, godziny (`fumiko_closed`, `oyaji_closed`), napad na Oyajiego z obu stron, pościg T0 → T1 → wnętrze, wczytanie zapisu v30 z dachu hali.
2. **Arkady i plac T2.** Odbudowa w66286396 na 2 kondygnacjach, zejście T1 → T2, tablica pamięci, zieleń, skrytka Hebi tymczasowo na T2. Zamyka T-186, T-188 i G-396. Kontrola `osm-building-kept`.
3. **Trójkątny pawilon.** Bryła, neon ALCHEMIA, drabina na dach, Ren z torbą na dachu, migracja. Przegląd osi na Bramę Krakowską i Ratusz.
4. **Parking P−1.** Rampa od Bajkowskiego, kabiny, auta statyczne i wjeżdżające, ładowarki, druga klatka, drzwi z food hallu (kiosk Sachiko na właściwym miejscu), opcjonalnie drzwi z hali metra B, NPC (parkingowy, technik, ochroniarz), zniknięcie naziemnego parkingu, scena `alchemia-p1`, kontrola `underground-level-exit`.
5. **Parking P−2 i schron.** Magazyn z regałami i robotami jako ruchomymi przeszkodami, korytarze serwisowe, wylot na T2, przystanek windy, schron z ekspozycją, skrytka Hebi w schronie i zlecenie odzyskania ze skradaniem. Migracja skrytki. Test sesji: odzyskanie bez alarmu obiema drogami, pościg P−1 → P−2 → schron.
6. **Życie placu** (po decyzji, poza zakresem tego ADR-u): wydarzenia na T1 i T2 z tłumem ADR-0060, rola Arkad i pawilonu.
7. **Plac T0 i zielony dach** (decyzja 7.11): rozbiórka asfaltu i alejek parkingu w173531008 (korekta importu z przeglądem kuratora), plac w stylu deptaku z pergolami, lampionami, ławkami i zielenią, zielony dach z trawnikami; domek klatki P−1 i parapety rampy wpisane w plac; kontrola `cut-on-road` z bazą 0. Zamyka G-500.
8. **Spójność kompleksu** (decyzja 7.11): wspólny język brył i materiałów dla food hallu, tarasów T0–T2, Arkad, pawilonu, placu i wejść na parking: ciągłe krawędzie i balustrady, jednolite przejścia między poziomami, wspólne oświetlenie; przegląd zrzutów z ulic dookoła.
9. **Teksturowanie** (decyzja 7.11): tekstury dla całej Alchemii w stylu NPR (elewacje, posadzki, trawniki, pergole, szkło pawilonu), CC0 albo własne, z wpisem w README i „Autorach”; migawka NPR i budżety bez wzrostu wywołań.
10. **Drzwi z hali metra B na P−1** (decyzja 7.11): osobny etap; nowy pomiar do T-157, świadoma zmiana złotego hasha.

### 13. Prawa autorskie
Do repo nie trafia nic z wizualizacji ani zdjęć prasowych (redakcje, „materiały prasowe Arkady sp. z o.o.”). Bryły opisujemy słowami i liczbami ze źródeł planu. Geometria jest własna albo z modeli CC0 lub CC-BY 4.0 z wpisem w README katalogu i na ekranie „Autorzy” (ADR-0063). Kopie artykułów zostają w scratchpadzie kuratora.

## Otwarte pytania
Brak. Pytanie o godziny lokali rozstrzygnął użytkownik 6.11 (sekcja „Decyzje użytkownika”).

## Wykonanie

### Etap 1: food hall ze sprzedawcami (gałąź `feat/alchemia-etap1`)
- **Bryła.** Food hall x 400–436, z 32–58 (36 × 26 m, ok. 35% prawdziwej powierzchni), 2,2 m od szybu i hali pawilonu B. Obrys leży na liniach siatki terenu 4 m, więc taras styka się ze ścianami całymi oczkami. Poziomy z pomiaru: T0 = −2,2 (parking przy tylnej ścianie), T1 = posadzka = −6,4. NMT w prostokącie T1 (x 396–444, z 56–76) ma −8,6…−3,7, średnio −6,96, więc taras jest wykopem do 2,62 m (narożnik SE, przy rampie wschodniej) i nasypem do 2,28 m (w północnej części, nad spadkiem do T2). Po przycięciu do chodnika Świętoduskiej (niżej) zakres się nie zmienia, a średnia to −6,89. W świetle 3,8 m. Grunt pod obrysem to `GroundCut`, czyli dziura w rysowanym terenie, jak pod pawilonem metra, a nie `GroundVault` ani płyta z `decks.ts`. Przy oczku 4 m przejście z T1 do sklepienia pod T0 dawało w drzwiach rampę 48°. Schody mają osobny wycinek przed wycinkiem hali, żeby AI na biegu szło grafem (pomiar: bez tego pościg z sali na dach utykał na stopniu 1,5 m pod celem).
- **Wnętrze.** 12 lokali: Kenta i Goro przy wejściu, bar Fumiko w narożu NW z ladą przez front na T1 i własnymi drzwiami, sklep Oyajiego w narożu NE (lada pancerna, krata, zaplecze, drugie wyjście na T1), kiosk Sachiko przy tylnych drzwiach do klatki. Tła: kawiarnia, tajska, koreańska (roleta), grecka, gruzińska (roleta), wok, burgery (roleta). Sześć lokali z właścicielami z tabeli §3 to w etapie 1 pięć, bo Hana stoi z wózkiem na T1. Stoły wspólne pośrodku. Fronty HW 4 nie wróciły: mają 9 m wysokości, więc lokale to własna geometria, a `alchemia-props.glb` zniknął z gry razem z wpisami w „Autorach”.
- **Godziny.** Wejście do hali z T1, tylne drzwi do klatki i winda są otwarte całą dobę. Godziny 10:00–24:00, 16:00–4:00 i do 22:00 dotyczą lokali (ich ludzi i handlu), a nie drzwi hali, bo symulacja nie ma zamykanych drzwi na harmonogram.
- **Odstępstwo: fronty HW 4 nie wróciły.** Sklepiki z `alchemia-props.glb` mają 9 m wysokości, a lokal pod tarasem ma 3,8 m w świetle. Lokale są więc własną geometrią z pudełek, a plik i wpisy w „Autorach” zniknęły.
- **Krawędź od Świętoduskiej (T-209, przegląd #343, runda 3).** Taras nie wchodzi na ulicę: jezdnia w230503896, chodnik w232464426, pas postojowy w1514058885 i ich wjazdy zostają na NMT (różnica do 0,3 m, test `pad-on-road.test.ts`). Chodnik biegnie skosem na północny wschód (x 394,5 przy z 56, 402,8 przy z 76), a pad jest prostokątem, więc T1 to trzy pady na jednym poziomie: pas przed okienkiem i drzwiami Fumiko od ściany hali (x 400, z do 62), reszta od x 408, oba z przejściem 2 m od strony ulicy, i właściwy plac od x 412 z przejściem 8 m na północ i wschód. Oczko chodnika w siatce 4 m zostaje na NMT, a taras kończy się oczko dalej, czyli rysowany spadek do ulicy ma jedno oczko (do 1,5 m na 4 m przy z 76). Rampa zachodnia kończy się na poziomie NMT przy chodniku (−6,4 wobec −6,5), więc go nie rusza. Kontrola skanu `pad-on-road` liczy w całym mieście pady i rampy Alchemii, które zmieniają teren na osi drogi albo chodnika OSM o ponad 0,3 m. Alchemia ma w niej 0; baza 8 to starsze pady T-051 (7 dróg i chodników przy Bajkowskiego) i T-002 (ścieżka w972606056), osobne sprawy. Nieformalna ścieżka przez działkę (w1269042382, `informal=yes`, trawa) znika pod tarasem razem z działką.
- **Komunikacja.** Klatka przy windzie biegnie wzdłuż tylnej ściany z domkiem na dachu i drzwiami na parking. Winda T0 ↔ −6,4 w szybie przy tylnej ścianie: dolne drzwi do sali, górne na parking. Rampy T0 → T1 po obu bokach (16,8%, 9,5°), wschodnia rysowana jako schody. Rampa 8% z §4 nie zmieściła się w 25 m spadku 4,2 m. T0 i T1 z rampami to jeden poziom terenu, więc graf łączy je tylko po to, żeby droga z dachu albo z sali szła dalej.
- **Graf** `ALCHEMIA_NAV`: drzwi frontu (wejście, Fumiko, zaplecze Oyajiego i drzwi do jego sklepu), sala, klatka, dach od strony parkingu. Testy: pościg z parkingu do lady Kenty klatką, z T1 do sali i z powrotem, z sali na dach.
- **Ludzie.** Hana na T1 (428; 66), Ren i torba Hebi na zielonym dachu do etapu 3, Kurosawa i czyściciele przy kiosku windy na parkingu, czujka i skrytka Hebi bez zmian do etapu 2. Godziny według decyzji: Kenta i Goro siedzą w głębi lokali od 0:00 do 10:00, Oyaji po 22:00 przechodzi przez zaplecze na T1, Fumiko w dzień siedzi na stołku przed barem.
- **Pasmo.** `BAND_AREAS` ma dwa prostokąty: działkę x 379–456, z 30–140 i parking x 379–441, z −16…30, bez przystanku „Brama Krakowska 01” i chodnika Lubartowskiej. Test ADR-0059 nie łapie nikogo spoza targu.
- **Zapis.** Schemat v33 (main + 1, po v32 cyberdecku z #341): migracja 32 → 33 w `persistence/src/alchemia-rebuild.ts`, łańcuch od v28.
- **Widok z daleka (przegląd #343).** Grunt pod halą jest wycięty z terenu na stałe, a jej szczegółowa siatka rysuje się tylko do 135 m. Bloki mebli ulicznych (`props-far` i `props`) niosą więc zastępczą bryłę hali, jak pawilony metra: dach, front ze świecącym szkłem, ściany i posadzkę, o 3 cm w głąb pudełek szczegółowej siatki, więc z bliska jej nie widać. Nie ma własnego wywołania rysowania.
- **Światło i budżet.** Zewnętrze jest jedną siatką do 135 m: przy 150 m z §7 włączało się w scenie Rynku (149 m), więc odległość skrócono. Wnętrze to druga siatka do 45 m od ścian, z jedną ciepłą lampą. Front świeci ciepło (`win-warm`). Scena `alchemia-tpp` zmierzona po rundzie 1 na 263 wywołania i 101 siatek, budżet 271 / 104 (`tools/perf-budgets.json`); pierwszy pomiar 209 / 79 nie obejmował zastępczej bryły z daleka. Pozostałe sceny i migawka NPR bez zmian.
- **Skan.** `pad-unregistered` (baza 2: pady pokoi kliniki i Neon Koi bez wiersza T), `game-solid-landmark-occlusion` (baza 0) i `pad-on-road` (baza 8, wszystkie poza Alchemią). Pozostałe bazy bez zmian.
- **Wiersze T do rejestru:** T-145 zmieniony (Alchemia według planu 2026), T-205 (bryła food hallu x 400–436, z 32–58 i wycięty grunt), T-206 (T0, linia siatki pod tylną ścianą na −2,2), T-207 (T1 na −6,4: x 412–444, z 56–76 z przejściem 8 m, od strony Świętoduskiej x 408 i pas x 400 do z 62 z przejściem 2 m), T-208 (rampy T0 → T1 po bokach: zachodnia x 394–400, wschodnia x 436–442 rysowana jako schody, obie z 31–56). T-209 (taras na Świętoduskiej) naprawiony przycięciem T1, przyjęty przez kuratora (runda 3). T-157 bez zmian: pawilon B stoi poza padem T0.

### Etap 2: Arkady i plac T2 (gałąź `feat/alchemia-etap2`)
- **Arkady (T-218).** Obrys w66286396 z importu bez zmian: narożniki (443,1; 83,4), (448,5; 81,3), (466,5; 127,7), (461,0; 129,8), 49,7 × 5,8 m. Bryła stoi w ramce budynku prostopadłej do zachodniej ściany (obrys jest o 1° od prostokąta, więc wschodnie narożniki bryły leżą do 0,1 m od narożników OSM). NMT 1 m wzdłuż zachodniej ściany: −7,1 na południowym narożniku, −8,0…−8,8 do połowy, −9,3…−9,4 na północy; wzdłuż wschodniej −5,4…−5,7 przez cztery piąte długości i −8,9 na północnym końcu, gdzie Lubartowska opada. Stąd poziomy: parter na T2 (−9,2), piętro na −5,6 (chodnik Lubartowskiej), dach −2,2 z attyką do −1,5, czyli 7,7 m nad T2 (ruina miała 7,3 m nad swoim najniższym punktem −9,6). Od zachodu podcienie w rytmie z ortofoto PZGiK (5 cm/px, pomiar kuratora w przeglądzie #357, ±0,15 m): 13 filarów, czyli 14 przęseł, w a = 2,95 / 6,25 / 9,9 / 13,6 / 17,2 / 20,8 / 24,55 / 28,25 / 31,75 / 35,4 / 39,1 / 42,95 / 46,4 m od południowego narożnika (`ARKADY_PIERS`). Przęsła mają 3,3–3,85 m, skrajne 2,95 m od południa i 3,35 m od północy. Filary z cegły mają 0,55 m, podcienie 2,4 m głębokości, łuki 2,7 m nad posadzką. Pierwsze przęsło od południa to zamknięty narożny lokal, bo przy nim zaczyna się skarpa T1. Za podcieniami witryny trzech restauracji tła z drzwiami i szyldami (nazwy własne, bez napisów), bez wnętrz (decyzja 6.11). Piętro ma okna z obu stron, drzwi na chodnik Lubartowskiej (19,4–21,4 m od południa) i drzwi od południa na podest z T1.
- **Ruina na mapie.** Arkady (`ARKADY_PROP`) zajmują miejsce ruiny na liście budynków jej chunku, a nie stoją obok w `ALCHEMIA_PROPS`. Pomiar: przy zwykłym usunięciu ruiny id kolejnych encji przesunęły się o jeden, a napad z `raid_east` dochodził do Oyajiego ok. 80 kroków później i test `m4-contracts` (zapis podczas napadu) padał. Obrys ruiny zostaje dla `places.ts` i mapy miasta. Kontrola `osm-building-kept` (baza 0) sprawdza, że Arkady są w świecie, ruina nie jest rysowana drugi raz, obrys zgadza się z OSM do 0,15 m, bryły nie wychodzą poza obrys i stoją co najmniej 6 m nad posadzką. Szopa w1565213799 zostaje bryłą mapy.
- **T2 (T-217).** Poziom −9,2, czyli dno dawnej niecki (NMT w (442; 93)). Pady: dziesięć pasów po 4 m (z 88–128) od zachodniej krawędzi placu (x 424 na południu, 426–440 dalej na północ, z dala od chodnika Świętoduskiej) do linii 1,2 m w głąb Arkad, z przejściem 4 m. Do tego punkty siatek terenu (4 m na zachód od x 460, 2,5 m na wschód) wszystkich oczek pod posadzką podcieni, każdy osobno, więc teren pod posadzką jest równy T2 co do centymetra (test). W pasach placu (972 m² w siatce 1 m) teren jest ścięty o do 4,12 m: to grzbiet 11–13 m na zachód od Arkad, do −5,3 na NMT, ścięty na 508 m² o ponad 0,3 m, najgłębiej przy jego północnym końcu (450; 126). Dosypka sięga 1,1 m na 205 m², na zachodnim skraju przy (429; 115). Liczby z pomiaru kuratora w przeglądzie #357. Zachodnia połowa działki (−9,1…−10,9) zostaje na NMT i opada do Świętoduskiej jak dziś. `HEBI_HOLLOW` i jego pad zniknęły (T-186).
- **Dołek przy Arkadach.** Część punktów pod podcieniami leży za wschodnią ścianą, więc teren przy niej opada do 3,2 m. Przykrywa go chodnik przy Arkadach od strony Lubartowskiej: płyty 2 × 5 m na wysokości najwyższego punktu NMT pod każdą (−5,22…−7,46, od 2 m przed południowym narożnikiem do 44 m od niego, krawężnik nad niższą stroną). Od południa przykrywa go podest przed drzwiami piętra (−5,72), który sięga 2,2 m na zachód od budynku i 0,5 m wzdłuż narożnego lokalu. W pierwszej rundzie chodnik kończył się na 40 m i na północnym końcu zostawał dołek przy ścianie (G-460: a 40–43, ok. 12 m², do 0,97 m pod siatką mapy). Skan przy tej poprawce znalazł jeszcze dwa małe dołki po bokach podestu (do 1,27 m na zachód od narożnika i do 0,8 m na wschód), więc podest i chodnik wydłużyłem. Test: na wschód od ściany, poza płytami i podestem, `rawHeight − groundY` ≤ 0,3 m. Przed pierwszym filarem punkty siatki pod posadzką zaczynają się na linii ściany, a nie 0,3 m przed nią, bo następne oczko siatki 4 m na zachód ściągałoby skarpę T1 przy schodach.
- **Schody T1 → T2 (T-219).** Rampa x 426–436, z 76–92, 2,8 m na 16 m (17,5%), rysowana jako stopnie co 1 m, z siedziskami z bloków 1 × 1,6 m po obu bokach. Leży na padach (nowe pole `over` w `Ramp`): blend T1 na północ (8 m) ściągał jej górną połowę do −6,4, a dolną robił stromą.
- **Tablica pamięci i zieleń.** Kamień z nazwą placu (Plac Ofiar Getta), bez neonu i reklam, w kwietniku na zachodniej krawędzi T2 (428,7–430,3; 112,0–112,4). Dwa kwietniki-siedziska wzdłuż tej krawędzi. Najbliższe miejsce zlecenia (spawn, przedmiot albo punkt planu: czujka napadu `raid_north`) leży 11,0 m od kamienia (test: ponad 10 m).
- **Hebi.** Skrytka z osłoną i skrzynia na ciało stoją na T2 przed południowymi łukami w tych samych punktach względem zachodniej ściany co przy ruinie (`byArkady`, dawniej `byRuin`): skrytka 9 m od południa, przed trzecim przęsłem (6,25–9,9 m), bo wokół niej jest ułożone podejście bez alarmu (test `stealth`: przy 8,5 i 8,08 m dwa ziarna z odmianą `lockdown` nie przechodzą), a skrzynia 13,6 m od południa, 1,5 m przed filarem. Neon wisi na ścianie piętra w środku trzeciego przęsła (8,08 m), głośnik na łuku czwartego (11,75 m), a kamera na łuku piątego (15,4 m). Czujka stoi w dzień pod łukami w środku dziewiątego przęsła (30,0 m) i patrzy na schody z T1, a w nocy obchodzi T2, wychodząc spod łuku tego przęsła. Torba z blokady (`stash:targ-overpass`) leży przed tym samym łukiem. Skrytka stoi 0,9 m od osi filara, pozostałe punkty 1,75–1,85 m (test: ponad pół filara i pół skrzyni, 0,58 m). Strefa `HEBI_STASH_ZONE` bez zmian. Pasmo targu bez zmian, a czujka stoi w nim (x 455,0).
- **Zapis.** Schemat v34, migracja 33 → 34 `levelAlchemiaT2` w `persistence/src/alchemia-rebuild.ts`. Gracz zapisany na zachód od wschodniej ściany Arkad w prostokącie x 422–467, z 80,5–130 (dawna niecka ze skarpami, grzbiet i nowy plac) budzi się na T2 w (440; −9,15; 104). Torba z blokady idzie przed łuki (452,78; −9,0; 111,82), a inne torby z tego obszaru na punkt pobudki. Ludzie, posiłki napadu i ciała z tego obszaru znikają, więc czujka wraca z treści pod łuki. Łańcuch od v32 przez etap 1 jest testowany.
- **Złoty hash.** Zmieniły się tylko trzy migawki bieżącego hasha (bieg, „hard” i pojedynek), bo zmieniła się wersja schematu. Hashe v31 i starsze stoją, więc reguły i id encji są te same. Rytm przęseł, punkty Hebi, chodnik i podest z drugiej rundy przeglądu hasha nie zmieniają.
- **Daleki widok.** Zewnętrze Alchemii (z Arkadami, T2 i schodami) włącza się do 135 m od środka hali albo od środka Arkad, bliższego z nich. Sceny `npr-perf` leżą dalej niż 145 m od obu (test). Z dalszej odległości Arkady (ściany, łuki, dach, attyka, posadzka i chodnik) stoją jako zastępcza bryła w meblach ulicznych bloku, tak jak hala, bez własnego wywołania rysowania.
- **Budżet.** Nowa scena `alchemia-t2-tpp`: gracz schodzi schodami z T1 na północny wschód, a w kadrze są T2, łuki i piętro Arkad. Pomiar w dwóch przebiegach dał 194 wywołania i 71 aktywnych siatek, więc budżet to 200 / 74. `alchemia-tpp` bez zmian (263 / 101), pozostałe sceny i migawka NPR też bez zmian. Arkady, T2 i schody leżą w siatce zewnętrza Alchemii (test silnika: do 8 tys. trójkątów), bez własnego wywołania.
- **Skan.** Nowe kontrole `osm-building-kept`, `arcade-rhythm` i `pad-dip-uncovered` (baza 0). `pad-on-road` zostaje na 8, bo Świętoduska, jej chodnik i pas postojowy przy T2 zostają na NMT ±0,3 m (test rozszerzony do z 140). `pad-unregistered` zostaje na 2, a `game-solid-landmark-occlusion` liczy też bryły Arkad i zostaje na 0. Pozostałe bazy bez zmian.
- **Wiersze T do rejestru:** T-186 zamknięty (niecka zastąpiona przez T2), T-188 i G-396 zamknięte (Arkady na 2 kondygnacjach), T-217 (T2 na −9,2 z liczbami wyżej), T-218 (Arkady odbudowane: poziomy, podcienie, chodnik i podest nad dołkiem), T-219 (schody T1 → T2).

### Etap 3: trójkątny pawilon (gałąź `feat/alchemia-etap3`)
- **Bryła (T-230).** Trójkąt we wcięciu parkingu w173531008 na rogu Bajkowskiego i Lubartowskiej: narożniki (420,5; −8,85) przy Bajkowskiego, (432,3; −8,2) na rogu ulic i (436,2; 6,0) przy Lubartowskiej. Boki 11,8 m (wzdłuż chodnika w232464426), 14,7 m (wzdłuż chodnika w749050539) i 21,6 m (od parkingu), 82 m², w obrysie 15,7 × 14,9 m. To mniej niż „ok. 18 × 15 m” z §1: większy trójkąt wszedłby na chodniki albo głęboko na parking. Obrys stoi 0,39–0,8 m od nawierzchni obu chodników, na zachodzie do 1,6 m na parkingu (wcięcie kończy się na x 422), a północny wierzchołek 1,6 m za linią wcięcia (z 4,4). Jedna kondygnacja: posadzka −0,25, dach 3,85, attyka 0,9 m, czyli 5,0 m od posadzki do wierzchu attyki. Szkło na stalowej ramie (słupki co 1,6 m, rygiel nad drzwiami), ciemny gzyms, cokół. Teren zostaje na NMT, bez padu: pod obrysem −0,79…−0,39, więc cokół ma od 0,14 do 0,54 m. Restauracja za szkłem jest tłem bez wnętrza (decyzja 6.11). Bryły mają id od `ROOM_ID_BASE` za bryłami etapów 1 i 2.
- **Zaplecze i drabina (T-231).** Od strony parkingu skrzynka zaplecza 4 × 3,5 m (x 424,5–428,5, z −3,5…0) z drzwiami serwisowymi na północ i drabiną (ADR-0021) na zachodniej ścianie: stopa na parkingu (424,1; −0,75; −1,75), głowica na dachu zaplecza. Attyka obiega cały dach i ma przerwę 1,3 m tylko przy głowicy drabiny. Drabina nie ma encji z widokiem (`scenery`): rysuje ją silnik razem z pawilonem, a szczeble leżą na siatce 0,3 m od y = 0, tam gdzie dłonie wspinacza sięgają bez widoku drabiny. Graf poziomów bez zmian (§5): pościg kończy się u stóp drabiny.
- **Neon.** Tablica na dwóch słupkach przy południowym boku dachu (x 425,3–431,5, z −7), od 1,0 do 2,2 m nad dachem, z napisem ALCHEMIA (nazwa własna, bez i18n) z rur `neon-cyan` po obu stronach, czytelnym od Bajkowskiego, Ratusza i Bramy Krakowskiej oraz od T0. Wierzch tablicy jest 6,3 m nad posadzką. Litery to proste odcinki w siatce pawilonu (`neon-letters.ts`), a nie atlas glifów: ten jest w siatce szyldów komórki miasta, która powstaje tylko tam, gdzie są inne szyldy.
- **Ren i torba.** Ren na dachu pawilonu (430; 3,85; −3,4), patrzy na Stare Miasto. Torba Hebi (`stash:targ-roof`) obok (431,3; 3,85; −2,7). Cel zadania `quest.m3_lustro.meet_ren` mówi o drabinie pawilonu (dotąd o windzie na taras dachu, której nie ma od etapu 1), w obu katalogach.
- **Zapis.** Schemat v35, migracja 34 → 35 `raiseAlchemiaPavilion` w `persistence/src/alchemia-rebuild.ts`: torba idzie na dach pawilonu, stan Rena znika (wraca z treści na dach), a gracz zapisany w obrysie pawilonu i zaplecza budzi się pod drabiną (423,5; −0,73; −1,75); torby z obrysu idą tam, a posiłki i ciała z niego znikają. Łańcuch od v29 jest testowany.
- **Złoty hash.** Zmieniły się trzy bieżące migawki w `determinism.test.ts` i dwie w `reinforcement-sidestep.test.ts`, bo hash zawiera numer schematu. Z wersją cofniętą na 34 wszystkie dają dawne wartości.
- **Napad i id.** Torba przy Renie leży teraz 68 m od wózka Hany, poza promieniem 40 m, w którym skrytka dachowa się pojawia, więc w teście napadu na Oyajiego alokator daje ludziom napadu id o jeden mniejsze. Pierwsza rana Oyajiego przy ziarnach 5 i 6 przychodzi po 992 krokach zamiast 659, przy 7 i 8 bez zmian (748). Test zapisu w czasie napadu czeka teraz na ranę, a nie na stałe 960 kroków.
- **Widok z daleka i światło.** Pawilon leży w siatce zewnętrza Alchemii (1358 trójkątów, zewnętrze 2628 → 3986 z 8 tys.), bez własnego wywołania rysowania. Szkło świeci ciepło jak witryna (`shop-warm`), w nocy jak latarnia na rogu (§6). Brama Krakowska leży 146 m od środka hali, poza zasięgiem zewnętrza (135 m), więc meble uliczne bloku niosą zastępczą bryłę pawilonu z dachem, attyką, tablicą i neonem (788 trójkątów, 3 cm w głąb szczegółowych ścian).
- **Budżet.** Pawilon nie dokłada wywołania rysowania ani siatki, więc nie ma własnej sceny. Pomiar przed i po w dwóch scenach Alchemii: `alchemia-tpp` 263 / 101 → 258 / 99 (torba Hebi przy Renie nie pojawia się już na zielonym dachu w kadrze, bo leży poza promieniem 40 m od gracza), `alchemia-t2-tpp` 194 / 71 bez zmian. Pozostałe sceny bez zmian (reference 193 / 82, krakowskie-tpp 375 / 164, rynek-tpp 232 / 91, podzamcze-tpp 153 / 65, nabrzeze 236 / 102, phone-low 227 / 149), migawka NPR bez zmian. Budżety bez zmian.
- **Skan.** Nowa kontrola `pavilion-on-paving` (baza 0): obrys pawilonu bliżej niż 0,3 m od nawierzchni chodnika, na obszarze utwardzonym (chodnik, przejście), bliżej niż 4 m od osi jezdni albo stopa drabiny na chodniku. `game-solid-landmark-occlusion` liczy też bryły pawilonu i zostaje 0. `pad-on-road` zostaje 8: pawilon nie ma padu, a Bajkowskiego, Lubartowska i chodnik w749050539 przy rogu zostają na NMT (test). Pozostałe bazy bez zmian.
- **Osie widokowe.** Zrzuty dnia i nocy przed i po: z Lubartowskiej od Bramy Krakowskiej, spod Bramy, zza Ratusza (z Bajkowskiego na północ), z Bajkowskiego od zachodu, z Lubartowskiej od północy i z dachu pawilonu. Z Lubartowskiej od północy pawilon stoi poniżej Ratusza, a dach i wieża Ratusza zostają nad nim widoczne. Spod Bramy i z Lubartowskiej od Bramy pawilon z neonem zamyka widok na końcu ulicy. Zza Ratusza zasłania z tej osi pawilon metra B, który nie jest zabytkiem. Neon czyta się od południa w dzień i w nocy.
- **Wiersze T do rejestru:** T-230 (pawilon: obrys, wymiary, poziomy, odległości od chodników, teren na NMT, skala mniejsza niż w §1), T-231 (zaplecze z drabiną, attyka, tablica neonu nad 5 m). T-145 bez zmian treści poza dopiskiem „pawilon na rogu, etap 3”.

### Etap 4: parking P−1 (gałąź `feat/alchemia-etap4`)
- **Bryła (T-236).** P−1 to `GroundVault` pod T0 (x 394–422, z 2–32, 28 × 30 m, ok. 840 m²), a nie wykop z dachem: parking w173531008 nad nim zostaje gruntem mapy (NMT −2,6…−1,0), bez padu. Podłoga −6,4 jak food hall, strop −3,7, płyta do −3,4. Bryły wnętrza leżą co najmniej 0,1 m pod rysowanym gruntem (test; najmniej 0,15 m nad stropem rampy przy z 12). Grunt sklepienia jest 2 m pod płytą podłogi, jak pod torowiskiem peronu metra: ciało na P−1 jest „uniesione” (`LEVEL_GAP`), więc NPC z hali do P−1 idzie grafem przez drzwi, a nie w ścianę. Ściany trzymają 2,4 m od pawilonu metra B (szyb klatki 4,5 m, wykop rampy 15,5 m).
- **Rampa (T-237).** Dwukierunkowa, x 410–418 (pasy 6,5 m, chodnik 1,5 m przy ścianie wschodniej), od Bajkowskiego w miejscu dzisiejszego wjazdu: szczyt w z −5,5 na NMT (−1,04), stopa w z 24,5 na −6,4, czyli 5,4 m na 30 m (17,8%, nie 15% z §4: przy 15% stopa wypadała pod tylną ścianą hali). Otwarta w wykopie (`GroundCut`, dno −5,17) z parapetami 1 m nad gruntem do z 12, dalej pod tarasem ze stropem w stopniach po 2 m (prześwit 2,2 m). Bryła to kliny po 2 m (`slope`, jak schody pawilonów metra), żeby AABB żadnego nie sięgał gruntu T0.
- **Druga klatka (T-238).** Przy pawilonie metra B: prosty bieg 28 stopni po 0,179 m w szybie x 418,3–421,7, z 12,4–22,6, od podłogi P−1 na południe do spocznika na poziomie T0 (−1,39), pod domkiem 2,6 m z drzwiami na południe na parking. Stopa drabiny pawilonu na rogu stoi 14,4 m od ściany domku.
- **Drzwi z hali i kiosk Sachiko.** Drzwi w tylnej ścianie hali x 410,5–412,2, 2,3 m, na poziomie, przy stopie schodów hali. Lada kiosku Sachiko jest obrócona na wschód, do tych drzwi: miejsce klienta 5,3 m od nich (było 8,2 m). Kiosk stoi w swoim obrysie.
- **Wnętrze.** Dwie kabiny oddawania aut na zachodzie płyty (x 398–404, z 25–31,6) z roletami, 14 miejsc w dwóch rzędach na pokładzie (10 aut; ok. 4% z 370, §1 zakładał ok. 50 widocznych), 4 ładowarki przy ścianie zachodniej, kasa przy drzwiach do hali, pulpit przy kabinach. Auta w zatokach to solidy ulicy i sceneria (jak zaparkowane auta, ADR-0050), po solidach ulicy chunku, więc żadne id się nie przesuwa. Ludzie: parkingowy przy pulpicie, technik przy ładowarce, ochroniarz przy drzwiach do hali, jako stali mieszkańcy tłumu (ADR-0060), bez dialogów.
- **Auta w ruchu.** Dla oka, jak drony: cykl 60 s na zegarze renderera, auto zjeżdża wschodnim pasem i wjeżdża do kabiny południowej, pół cyklu później drugie wyjeżdża z północnej zachodnim pasem; rolety podnoszą się przed autem. Bez bryły i bez pasa w `TRAFFIC_ROUTES`, więc kontrole pasów (`car-lane-off-road`, `lane-dead-end`, `turn-off-road`) się nie zmieniają. Auto pojawia się i znika na szczycie rampy przy chodniku Bajkowskiego.
- **Naziemny parking.** W grze nie miał miejsc, zatok ani aut (`PARKED_CARS` i oznakowanie nic tu nie stawiały), tylko nawierzchnię asfaltu z OSM. Ta zostaje jako nawierzchnia T0 nad P−1: zmiana na zielony dach czy plac to zmiana importu (osm-import) i przegląd kuratora, poza tym etapem.
- **Metro B.** Drzwi z hali pawilonu B na P−1 (propozycja z §4) pominięte: drzwi w ścianie końcowej hali dokładają bryły pawilonu B w alokatorze (id kolejnych encji i złoty hash), a P−1 ma i tak trzy wyjścia. Hala B leży 2,1 m nad P−1 (−4,31 wobec −6,4) i 2,4 m od jego ściany, więc bieg w dół zmieści się w osobnym etapie.
- **Graf.** `parking-nav.ts`: chodnik rampy (szczyt, koniec wykopu, krok pod tarasem, stopa), płyta, pokład, drzwi do hali, stopa i spocznik klatki, wyjście z domku, węzły na parkingu po obu stronach szczytu rampy i za rogiem domku. Na dolnych 8 m rampy cel na pokładzie jest 1–1,5 m niżej, ponad `SAME_FLOOR`, a poniżej `LEVEL_GAP`: ganger szedł prosto w ścianę rampy. Poprawka w `ganger-walk.ts` (tylko gdy cel albo on jest pod ulicą): w tym paśmie bez kroku z `head()`, więc idzie grafem. Testy: pościg z parkingu na pokład (dwa ziarna) i z powrotem, z hali na płytę i z powrotem.
- **Zapis.** Schemat v36, migracja 35 → 36 `digAlchemiaParking` w `persistence/src/alchemia-parking.ts`: gracz z wykopu albo domku klatki budzi się na parkingu przy szczycie rampy (406; −1,2; −3), torby z nim, a ludzie, posiłki i ciała stamtąd znikają; stan Sachiko znika (wraca za ladę obróconą do drzwi). Gracz na parkingu nad P−1 zostaje, gdzie był.
- **Złoty hash.** Zmieniły się tylko trzy bieżące migawki w `determinism.test.ts` i dwie w `reinforcement-sidestep.test.ts`, bo hash zawiera numer schematu. Z wersją cofniętą na 35 wszystkie dają dawne wartości (z poprawką gangera też).
- **Światło i budżet.** Wykop, rampa i domek klatki są w siatce zewnętrza (3986 → 4706 trójkątów z 8 tys.), z daleka w meblach ulicznych bloku jako zastępstwo (parapety, ciemne dno, domek). Wnętrze P−1 to trzecia siatka `alchemia-parking` (1452 trójkąty) do 30 m od obrysu, z jedną zimną lampą przyciętą do P−1; auta i rolety to czwarta, mała, przepisywana co klatkę, do 40 m od wykopu albo P−1. Nowa scena `alchemia-p1` (gracz na płycie przy stopie rampy idzie do kabin): 203 wywołania i 71 aktywnych siatek w dwóch przebiegach, budżet 210 / 74. `alchemia-tpp` 263 / 101 → 261 / 100 (siatki P−1 są tam wyłączone), pozostałe sceny i migawka NPR bez zmian.
- **Skan.** Nowa kontrola `underground-level-exit` (baza 0): wnętrze gry pod ziemią ma co najmniej dwa wyjścia w grafie; peronowi metra drugim jest pociąg. P−1 ma trzy. Pozostałe bazy bez zmian (`pad-on-road` 8, `pavilion-on-paving` 0, `metro-shaft-open`, `metro-entrance-blocked`, `building-underground-solid`, `interior-outside-building`, `interior-entrance-gap`, `bay-car-out-of-park`, `parked-car-*`).
- **Zrzuty** (noc, przed i po w tych samych kadrach): z Bajkowskiego na wjazd, z parkingu od zachodu, od pawilonu metra B, z Lubartowskiej, z hali na drzwi do P−1; po: z chodnika rampy, z pokładu, z płyty na kabiny, z P−1 na drzwi do hali, z P−1 na drugą klatkę. W pierwszej rundzie pod stropem P−1 padał deszcz i próg drzwi z hali był czarny: obie rzeczy poprawione (`parkingRoofOver`, posadzka progu).
- **Wiersze T do rejestru** (do przeglądu kuratora): T-236 (P−1 pod parkingiem), T-237 (rampa), T-238 (druga klatka), T-157 (nowy pomiar: P−1 2,4 m od pawilonu B, bez drzwi do niego), T-145 dopisek „P−1 etap 4, skala ok. 4% miejsc”.

### Etap 7: plac T0 i zielony dach (gałąź `feat/alchemia-etap7`)
- **Import (T-241).** Parking w173531008 i jego alejki w177513189 (z wyjazdem na Lubartowską przy przystanku (447; 16)) oraz w173567309 wychodzą z importu: lista `REPLACED_WAYS` w `tools/osm-import/src/corrections-alchemia.ts`, każda droga z powodem i wierszem T. Surowe dane w `data/osm` zostają. W obrysie parkingu, z jego węzłów, leży plac z kostki (`area:highway=pedestrian`, ta sama nawierzchnia co deptak), a w nim trzy trawniki, które import wycina z kostki jako dziury (`openPavings`): zachodni nad pokładem P−1 (x 391–403,6, z 3–21), wschodni między drugą klatką a pawilonem metra B (x 424–434, z 9–21) i przy Bajkowskiego (x 385–398, z −5,5…−1,5), wszystkie ze ściętymi narożnikami. W chunku krakowskie-2-1 znikają nawierzchnia asfaltu, dwa pasma alejek i wpis `carParks`, a przerywana linia pasa Lubartowskiej biegnie jednym odcinkiem przez dawny wyjazd. Wjazd na rampę od Bajkowskiego zostaje. Teren (NMT) bez zmian, bez nowych `PADS`.
- **Meble deptaku.** Z planu mebli 9 pastorałów (ten sam model co `lamps.kp-deptak`) i 11 ławek: cztery pod pergolą A przodem do trawnika zachodniego, trzy pod pergolą C przodem do placu (runda 2), dwie przy wschodnim (x 427 i 431: przy x 435 siedząca postać zajmowała miejsce mieszkańca tłumu, `figure-in-crowd`) i dwie przy trawniku od Bajkowskiego; generator dokłada kosz i siedzące postacie. Grupy planu z `points` biorą teraz `yaw` grupy, jak pojedyncza `position`: w rundzie 1 dostawały `yaw: null` i ławki stały tyłem do trawników (przegląd #382). Inne grupy z `points` nie mają `yaw`, więc reszta miasta bez zmian. Grupa latarni ma nowe pole planu `baskets: false`: bez niego 9 latarni przesuwało parzystość listy koszy i 54 kosze zmieniały latarnie w pięciu chunkach. Latarnie stoją ponad 8 m od osi chodnika Bajkowskiego i Świętoduskiej (w232464426): bliżej podnosiły `lamp-style-change-on-way` i usuwały latarnię drogową obok stylowej. Zmiany `props.generated.ts` tylko w krakowskie-2-1.
- **Pergole, lampiony, rabaty (`sim/content/alchemia/square.ts`).** Pergola A wzdłuż wykopu rampy od Bajkowskiego do P−1 (x 404–409,3, z −1,5…22,7, pary słupów co 3 m, belki 2,9 m nad gruntem), pergola C wzdłuż tylnej ściany hali od głowy zachodniej rampy T0 → T1 do domku klatki hali (x 396,4–405,6, z 26,5–29,5) i pergola B nad drzwiami domku drugiej klatki P−1 (T-238): dwa słupy 4 m na południe od drzwi, belki oparte o ścianę domku, listwy w poprzek. Pod belkami 26 papierowych lampionów świecących ciepło (`win-warm`), co najmniej 2 m nad gruntem. Wzdłuż parapetów wykopu (T-237) rabaty po 2 m, 0,45 m nad gruntem: zachodnia 0,8 m (z −3,5…11,5), wschodnia 0,5 m (z −3,5…8), węższa, bo obok niej idzie się od szczytu rampy do drzwi klatki. Słupy i rabaty to bryły (jeden `solidProp` na końcu `ALCHEMIA_PROPS`, id od `ROOM_ID_BASE`), belki, lampiony i trawniki tylko rysunek. Wszystko trzyma 0,8 m od węzłów grafu na T0 i od Kurosawy, a krawędzie grafu i przejście od szczytu rampy do drzwi klatki mają 0,5 m wolnego (test).
- **Zielony dach (T-242).** Na dachu hali cztery trawniki 13,5 × 7,5 m po obu stronach krzyża ścieżek (`ROOF_LAWNS`), z dala od domku klatki, kiosku windy i donic; płyta dachu między nimi jest teraz kostką (`trim-light`), a nie całą zielenią. Trawniki rysują się 5 cm nad płytą, bez bryły.
- **Girlandy (prośba użytkownika 7.11, runda 2).** Cztery girlandy kolorowych lampek na krzyż, od rogu do rogu pergoli, na wierzchach belek: dwie między północnym końcem pergoli A a pergolą C (14,4 i 6,9 m), dwie nad wykopem rampy między wschodnim rzędem A a pergolą B przy domku klatki (10,5 i 10,7 m). Przewód zwisa o 4,5 cm na metr rozpiętości, co 0,6 m żarówka w kolejnych kolorach glow zestawu miasta (65 żarówek), świecą w nocy same. Wiszą ponad 2,4 m nad gruntem i ponad 3 m nad rampą (test). Dane w `square.ts` (`SQUARE_GARLANDS`), rysunek w `renderer/alchemia/garlands.ts`, w siatce zewnętrza bez nowego wywołania rysowania.
- **Wjazd z Bajkowskiego (runda 2).** Asfalt (`area:highway=service`, wiersz T-241) między liniami ścian rampy: od jej szczytu do północnej krawędzi chodnika w232464426 i od jego południowej krawędzi do jezdni. Chodnik biegnie przez wjazd bez przerwy. Krawężnik jest obniżony w tym sensie, że chodnik w grze nie ma krawężnika, a asfalt styka się z jezdnią równo.
- **Auta rampy w ruchu (G-491, runda 2).** Wjeżdżające jedzie Bajkowskiego na wschód od skrzyżowania ze Świętoduską i skręca w lewo na wjazd. Wyjeżdżające skręca w lewo, na wschód (Bajkowskiego jest jednokierunkowa), i jedzie dalej na północ Lubartowską za przystanek. Pojawiają się i znikają na skrzyżowaniach, nie na szczycie rampy. Cykl 60 → 100 s. Nadal tylko dla oka: ruch symulacji (`TRAFFIC_ROUTES`) nie ma pasa wjazdu na rampę, więc te auta nie omijają aut ruchu i nie mają bryły (G-492). Pełne włączenie w ruch to nowy pas w symulacji ze świadomą zmianą złotego hasha, osobny PR.
- **Spójność.** Pergole prowadzą z Bajkowskiego do P−1 i do hali, do głowy zachodniej rampy na T1 i do domku klatki hali; latarnie stoją u głów obu ramp T0 → T1, przy pawilonie metra B i przy domku drugiej klatki. Wspólny język materiałów całej Alchemii to etap 8.
- **Kontrola `cut-on-road` (G-500).** Wycięcie gruntu z `ChunkDef.cuts` (szyby metra należą do strumieniowania, nie do chunka) albo bryła gry z `ChunkDef.rooms` wystająca ponad grunt na osi ulicy lub chodnika z OSM, której import nie pomija na liście `REPLACED_WAYS` z wierszem T. Przed zmianą 3 (wykop rampy na 17,6 m osi alejki w177513189, szyb klatki 2,7 m, domek klatki z parapetami 3,7 m), po zmianie 0, baza 0.
- **Zapis.** Bez zmiany schematu (zostaje v36): grunt T0 ma te same wysokości, a nowe bryły to cienkie słupy i rabaty przy parapetach; postać zapisana w ich miejscu jest wypychana przez bryły (G-485). Złoty hash bez zmian.
- **Światło i budżet.** Pergole, lampiony, girlandy, rabaty i trawniki dachu są w siatce zewnętrza (4706 → 6050 trójkątów, z girlandami 7358 z 8 tys.), bez nowego wywołania rysowania. Latarnie i ławki to meble uliczne chunka. Sceny `npr-perf` bez zmian: `alchemia-tpp` 261 / 100, `alchemia-t2-tpp` 194 / 71, `alchemia-p1` 203 / 71, reference 193 / 82, krakowskie-tpp 375 / 164; migawka NPR bez zmian, budżety bez zmian.
- **Skan.** `cut-on-road` 3 → 0 (nowa kontrola). Pozostałe bazy bez zmian, w tym `lamp-style-change-on-way` 5, `grass-under-paving`, `landuse-bare`, `pad-on-road` 8, `pavilion-on-paving` 0, `underground-level-exit` 0.
- **Wiersze T do rejestru:** T-241 (plac T0 zamiast parkingu w173531008 z alejkami w177513189 i w173567309: kostka, trzy trawniki, pergole z lampionami i girlandami, wjazd z Bajkowskiego przez chodnik, rabaty przy parapetach rampy, latarnie pastorały i ławki deptaku; wyjazd na Lubartowską przy (447; 16) znika), T-242 (zielony dach hali: cztery trawniki i ścieżki z kostki na T0 nad food hallem). Dopiski: T-237 i T-238 „alejka zastąpiona placem T0 (T-241), G-500 zamknięty”, T-157 „pawilon B na placu T0, alejka w177513189 zniknęła z importu”, T-145 „plac T0 i zielony dach, etap 7”.

### Kondygnacje A i B nad food hallem (decyzje z 15.11, plansza `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`)
- **Bryły (`sim/content/alchemia/tiers.ts`).** Kondygnacja A (sklepy) na dachu hali: x 402–434, z 36–54,5, 4,5 m wysokości, w obrysie hali i poza tylnym pasem dachu (domek klatki i kiosk windy do z 34,8 zostają wolne). Kondygnacja B (pierścień food courtu) na A: x 406–430, z 38–52, 4,2 m, wokół otwartego dziedzińca x 414–422, z 42–48 ze świetlikiem, rabatą i drzewkiem o dwupiętrowej koronie poniżej dachu B, żeby dziedziniec był otwarty z góry. Szczyt B 8,7 m nad dachem hali, niżej niż kamienice dookoła. Ściany szklane, nad każdą płyta z okapem 0,3 m i pas LED na krawędzi (nowy rodzaj elementu `led`, swatch `neon-cyan`, sam rysunek). Dachy obu kondygnacji to tarasy: trawniki zielonego dachu przeniesione z dachu hali na pasy B (`ROOF_LAWNS`, nadal cztery), donice na północnej krawędzi A, żywopłoty wzdłuż zewnętrznych parapetów (B od południa i północy, A od wschodu), kaskady zieleni po ścianach, stoliki i ławki na południowym pasie A.
- **Schody.** Zachodni bieg z T0 na A (x 400,25–402, 25 stopni po 0,18 m) i z A na B (x 403,8–406, 24 stopnie po 0,175 m), każdy ze spocznikiem w szczelinie parapetu i balustradą od strony spadku i na końcu spocznika (bez niej gracz schodził ze spocznika w powietrze). Stopnie to osobny `solidProp`, reszta kondygnacji drugi, oba na końcu `ALCHEMIA_PROPS`.
- **Graf.** Ścieżka po dachu hali omija kondygnacje wschodnim pasem: nowe węzły `alchemia-roof-east-south` i `alchemia-roof-east-north` (x 434,9), `roof-north` przesunięty na z 55,6. Starty testów pościgu z dachu (food hall, parking) i spacer po zielonym dachu w teście sesji idą tym pasem.
- **Rysunek.** Kondygnacje to trzecia siatka zewnętrza `alchemia-tiers` (osobny budynek wg §7): 1230 trójkątów. Zewnętrze 7468 z 8 tys. dzięki pomijaniu ścian, których nikt nie widzi (spód elementów stojących na podłodze, tył stopnia zakryty wyższym), `GeometrySink.box(..., skip)`. +1 wywołanie rysowania w scenach z Alchemią (`alchemia-tpp` w budżecie 380).
- **Zapis i hash.** Bez zmiany schematu i złotego hasha: nowe bryły dokładają się na końcu listy, a postać zapisana w ich miejscu na dachu hali jest wypychana (G-485).
- **Odłożone:** rampa w osi placu i deptak (zmieniają trasy ruchu, osobny PR z wierszem T), etapy 5 i 10, spójność materiałów (etap 8, razem z teksturami ADR-0092).

### Etap 10: drzwi z hali metra B na P−1 (gałąź `ccr-ec2c4269-ilh8k8-alchemia-metro-b`)
- **Pomiar (T-157).** Wejście B stacji Brama Krakowska stoi w x 424,4–431,6, z 26,2–29,8. Posadzka hali leży na −4,31, czyli 2,09 m nad P−1 (−6,4). Ściana końcowa hali (zewnętrzna x 424,4) stoi 2,4 m od wschodniej ściany P−1 (zewnętrzna x 422), a hala w osi z 28 wychodzi na fartuch P−1.
- **Drzwi.** Ściana końcowa hali B dostaje otwór na szerokość hali (z 26,8–29,2) o wysokości 2,1 m (`EndDoorway.through`). Posadzka hali biegnie dalej przez otwór, a ściana końcowa zostaje jednym blokiem nad nim. Pawilon ma więc tyle samo brył w alokatorze, a złote hashe (`determinism`, `reinforcement-sidestep`) się nie zmieniają, wbrew założeniu z §12.
- **Przejście (`alchemia/metro-door.ts`).**
  - Za drzwiami 11 stopni po 0,28 m i 0,174 m prowadzi na zachód pod terenem. Ostatnie trzy stoją w P−1, za otworem we wschodniej ścianie (`P1_METRO_OPENING`).
  - Ściany boczne, strop 2,1 m nad posadzką hali i ścianka nad otworem P−1. Pod całym przejściem jest co najmniej 2 m prześwitu (test). Płyta leży pod terenem, więc z placu nic nie widać.
  - Przejście jest sklepieniem w ziemi (`GroundVault`), jak korytarz peronu A.
  - Jego bryły to jeden `solidProp` na końcu `ALCHEMIA_PROPS`. Pokój nad stopniami należy do wnętrza `alchemia-parking`.
- **Graf.**
  - W grafie metra węzeł w otworze (`metro-kanal-B-end`), po stronie wolnej od automatu biletowego.
  - W grafie P−1 węzeł przy stopie schodów (`alchemia-p1-metro-foot`) z krawędzią na fartuch.
  - Schody łączy krawędź `via` w osobnym grafie `METRO_DOOR_LINK`, scalanym w `WORLD_NAV`. Dzięki temu grafy metra i Alchemii zostają zamknięte.
  - P−1 ma teraz cztery wyjścia.
- **Rysunek.** Ściana końcowa pawilonu B rysuje się z otworem (`pavilion-bake` czyta `endDoor`). Przejście jest w siatce wnętrza P−1 (`P1_ALL_PIECES`).
- **Skan.** `metro-shaft-open` uznaje otwór B tak jak otwór peronu A.
- **Zapis.** Bez zmiany schematu, bo przejście zajmuje dotąd pełną ziemię.

### Rampa P−1 wysunięta do Bajkowskiego (plan kuratora 19.11, `docs/world/alchemia-deptak-rampa.md`)
- **Decyzja (rekomendowana, pod nieobecność użytkownika).** Plansza z 15.11 przesuwa wjazd. Rampa zostaje w pasie x 410–418, w osi kompleksu przy szybie T-238, ale jej szczyt przechodzi z z −5,5 na z −8,8, na krawędź chodnika Bajkowskiego. Auto wjeżdża w rampę wprost z ulicy, a asfaltowy wjazd przez plac znika.
  - Narożnik przy deptaku, dosłownie z planszy, odpada: rampa przecinałaby pawilon trójkątny, a wjazd na P−1 musiałby się zmieścić w 3,9 m między szybem a przejściem z metra B.
  - Rampa w osi frontu placu (x 398–406) wymagałaby przebudowy P−1. Portal od Świętoduskiej nie zgadza się z planszą.
- **Liczby.** 33,3 m przy spadku 16,4% (było 17,8%). Część otwarta do z 11, dalej strop z prześwitem 2,2 m. Rabaty przy parapetach od z −6,8. Punkt, przy którym trasa wjazdu szuka lewego pasa Bajkowskiego, jest stały (z −13,5) i nie zależy już od szczytu rampy.
- **Import.** Bez zmian. Wykop zjada północną część asfaltowego wjazdu (`T-241/wjazd-plac`), a chodnik w232464426 zostaje poza wykopem: `cut-on-road` = 0.
- **Zapis i hash.** Bez zmian.
- **Deptak** na Lubartowskiej (w216497220, od Bajkowskiego do Olejnej, z trolejbusem) idzie osobnym PR. Zmienia trasę wyjazdu z rampy na południową.

### Deptak na Lubartowskiej (plan kuratora 19.11, §1, wariant W2 do Olejnej, T-324)
- **Odcinek.** Lubartowska w216497220 od Bajkowskiego (442,9; −9,9) do Olejnej (454,9; 42,8), 54 m. Krótki w173533826 (6 m do Bajkowskiego) też dostaje kostkę. Nie jechał nim żaden pas aut, bo łańcuch był krótszy niż `MIN_ROUTE`. Skręt z Bajkowskiego w w40050981 zostaje na asfalcie obu ulic. Przy asfalcie na w173533826 brzeg kostki biegłby w poprzek wylotu, a podział gruntu rozsuwa tam oba kawałki o milimetry (nowe `kerb-gap-bare` przy (443,1; −9,9)). Z kostką do Bajkowskiego tej szczeliny nie ma, a `kerb-gap-bare` spada z 585 do 584.
- **Import.** Nowa lista `CAR_FREE_WAYS` w `tools/osm-import/src/corrections-car-free.ts`, każda droga z powodem i wierszem T. Import kładzie na niej kostkę (`surface=sett`, bez malowanych pasów) i oznacza jej odcinki `carFree`. Geometria, krawężniki i szerokość jezdni zostają z mapy. Zmiany w tabelach tylko w `krakowskie-2-1`.
- **Ruch.** Odcinek `carFree` ma tylko dostawy, jak deptak (`roads.ts`), ale 54 m to mniej niż 80 m trasy dostaw, więc pojazdów na nim nie ma. Trasy trolejbusu tu nie było także przed etapem, bo ten odcinek Lubartowskiej ma w grze 74 m przy `MIN_TROLLEY` 150. Sieć i przystanek Brama Krakowska 01 zostają jako meble, a inne trasy trolejbusu się nie zmieniają.
- **Skrzyżowanie z Bajkowskiego** (`traffic-deptak.ts`). Bajkowskiego skręca tylko w prawo, w w40050981 i dalej w Królewską. Prawy pas skręca, a lewy zjeżdża na prawy 14 m przed łukiem skrętu. Pas północny w40050981 zawraca przy Bajkowskiego, a z zawracaniem na końcu Królewskiej tworzy pętlę (`ring`), którą pojazdy jeżdżą bez końca. Trasy z Bajkowskiego kończą się na początku pętli. Pozostałe trasy miasta zachowują miejsca w tabeli, a pętla dochodzi na końcu, więc identyfikatory ich pojazdów się nie zmieniają. Wyjazd z P−1 (`alchemia-p1:out`) jedzie lewym pasem, zmienia go na prawy i skręca na południe. Wjazd bez zmian.
- **Stoiska.** Osiem z planu mebli (`lubartowska-deptak.*`): kioski MPK, Ruch i naprawa telefonów, okienko z cebularzami, stragan z kwiatami, dwa stragany z warzywami i automaty. Stoją na zachodniej części dawnej jezdni, ponad 1,4 m od linii trolejbusu. Dojście z wylotu metra B (z 24–32) jest wolne. Słupki stoją na obu końcach co ok. 3,7 m, bez łańcuchów. Na północy stoją 3 m przed Olejną, żeby wylot Olejnej został wolny.
- **Skan.** Nowe kontrole z bazą 0: `deptak-car-lane`, `road-retag-row` i `deptak-stall-clear`. `lane-dead-end` spada z 45 do 43, bo znikają dwa końce Lubartowskiej przy granicy Starego Miasta. `kerb-gap-bare` spada z 585 do 584. `market-piece-on-road` pomija drogi z `CAR_FREE_WAYS`. `lane-dead-end` pomija pętlę, bo jej koniec jest jej początkiem.

### Etap 5a: P−2 (gałąź `feat/alchemia-p2-shell`)
Pierwszy z czterech kroków etapu 5: bryła P−2, schody z P−1, korytarz i wylot na T2. Roboty (5b), przystanek windy (5c) oraz schron ze skrytką Hebi (5d) idą osobno.
- **Poziom.** Podłoga −9,2, czyli poziom T2 (`ARKADY.ground`), więc wylot wychodzi na grunt T2 bez stopni. Płyta podłogi P−1 kończy się od spodu na −6,7, a spód stropu P−2 leży na −6,9: w świetle 2,3 m, na jedną warstwę palet z autami. Przy głębszej podłodze wylot potrzebowałby schodów.
- **Bryła (T-325).** Magazyn x 394–418, z 2–32 pod pokładem, rampą i fartuchem P−1 leży w sklepieniu P−1 (`P1_VAULT`). Grunt sklepienia zszedł z −8,4 na −11,2, 2 m pod podłogę P−2. Do tego kąt x 418–420,4, z 23–32 pod fartuchem, przy stopie schodów. Korytarz serwisowy x 414,4–420,4 biegnie na północ pod food hallem i T1 do portalu w z 77, we własnym `GroundVault`, z bryłami co najmniej 0,1 m pod gruntem (test). Jego zachodnia ściana to wschodnie lico szybu windy, więc etap 5c otworzy windę na korytarz. P−2 trzyma 4 m od pawilonu metra B.
- **Ziemia przy magazynie.** Pod fartuchem i klatką T-238, na wschód od magazynu, ziemię zastępują bryły bez rysunku. W sklepieniu promień przechodzi przez grunt, więc bez nich strzał spod wschodniej ściany magazynu zaczynał się za nią (`tpp-shoulder.test.ts`: 11 przecieków wobec bazy 8).
- **Wylot (T-326).** Za portalem wykop w skarpie (`GroundCut`, x 414,4–420,4, z 77–97, dno −9,2) ze ścianami i parapetem 1 m nad skarpą, w odcinkach po 2 m. Przy z 97 grunt ma −9,2…−9,3. Zachodnia ściana stoi 2 m od osi chodnika w232464409 przy Świętoduskiej, a `cut-on-road` zostaje na 0. Wykop przecina nieformalną ścieżkę w1269042382 i linię płotu w783241007, który w grze nie jest barierą. Leży na zachodnim skraju stanowiska w1559354344, tak jak food hall (§11).
- **Schody.** Z fartucha P−1 przy drzwiach hali i windzie jeden bieg na wschód: 16 stopni po 0,175 m i 0,28 m przez otwór w płycie P−1 (x 414,4–418,6, z 29,8–31,4) z balustradą na trzech bokach, do kąta magazynu. Nad każdym stopniem jest co najmniej 2,1 m (test). Bieg ma ściany po obu stronach. Bez południowej NPC z dolnych stopni szedł prosto do celu w magazynie (różnica wysokości poniżej `SAME_FLOOR`) i utykał głową pod krawędzią płyty P−1. Ściana północna ma 0,6 m i oddziela bieg od korytarza.
- **Wnętrze.** Dwa rzędy po 10 palet wzdłuż toru robotów z dwiema szynami i 14 aut na paletach, regały ze słupkami i belkami, pomarańczowe pasy świetlne wzdłuż toru i w stropie, sterownia ze szklaną ścianą w narożniku SE, alejka serwisowa przy ścianie wschodniej. Wszystko stoi w miejscu do etapu 5b. Obszar `alchemia-p2` ma nazwę `interior.alchemia-p2` w katalogach en i pl.
- **Graf.** `p2-nav.ts`: szczyt biegu przy drzwiach hali (`alchemia-p1-door`), stopa w kącie, alejka magazynu, korytarz, portal, wykop i wylot na T2. P−2 ma dwa wyjścia (`underground-level-exit` = 0; bez krawędzi portalu skan znajduje jedno), a P−1 zyskuje jedno wyjście. Test `sim`: pościg z fartucha P−1 do magazynu i z korytarza na T2. Test sesji: graczka schodzi z P−1 do magazynu i wychodzi na T2, potem wraca tą samą drogą.
- **Rysunek.** Magazyn i korytarz to siatka `alchemia-p2` (2136 trójkątów z 8 tys.). Włącza się, gdy oko jest w P−2, na P−1 do 14 m od otworu schodów i na T2 do 35 m od wykopu. Ma jedną przyciemnioną pomarańczową lampę przyciętą do magazynu, zapaloną tylko z okiem w P−2. Wtedy lampy P−1 i hali gasną, bo światła toon nie mają przesłon (G-263) i świeciłyby przez płyty. Bieg schodów jest w siatce P−1 (1668 → 1944 trójkątów). Wykop i portal są w siatce zewnętrza (7558 → 7858 z 8 tys.), a z daleka w meblach bloku jako zastępstwo. W P−2 nie pada deszcz (`p2RoofOver`).
- **Budżet.** Nowa scena `alchemia-p2` (gracz w alejce przy sterowni idzie na północny zachód): 209 wywołań i 77 aktywnych siatek w dwóch przebiegach, budżet 216 / 80. `alchemia-p1` 197 / 72 → 199 / 73, bo przez otwór schodów widać magazyn (pomiar z wyłączonym zasięgiem otworu). `alchemia-tpp` 273 / 105 i `alchemia-t2-tpp` 226 / 79 bez siatki P−2. Migawka NPR i pozostałe budżety bez zmian.
- **Zapis i hash.** Schemat bez zmian. Nowe bryły stoją w dotąd pełnej ziemi. Gracz zapisany nad wykopem albo otworem schodów spada najwyżej 2,8 m, bez obrażeń (`FALL_SAFE_HEIGHT` 4 m), a z balustrady wypycha go ruch (G-485). Złote hashe (`determinism`, `reinforcement-sidestep`) się nie zmieniają, bo cztery bryły P−2 są ostatnie w `ALCHEMIA_PROPS`.
- **Koszt symulacji.** Indeks brył jest płaski, więc zapytania na P−1 biorą też bryły magazynu pod nim. Paleta z autem to jedna bryła bez rysunku, belki nad głową są tylko rysowane, a korytarz z wykopem to osobna bryła poza oczkami P−1 (pryzmaty magazynu 91 → 60). Testy ruchu na rampie trwają ok. 10% dłużej niż bez P−2 (wcześniej 15%).
- **Zostaje.** 5b: roboty na szynach jako ruchome bryły i winda aut z kabin P−1. 5c: przystanek windy na −9,2 w korytarzu. 5d: schron pod T2 przy północnym końcu P−2 z bramą, włazem i skrytką Hebi (migracja). Przegląd zrzutów (19.11, z T2 na wylot, z T1 na portal, z lotu): wykop ze schodkowymi murami i portal pod T1 pasują do skarpy, a wykop nie wchodzi na jezdnię. Pełny parapet wykopu wychodzi z T1 jako długa szara ściana, która zasłania plac T2. Zamiana na balustradę idzie z detalami planszy (B4).

### Etap 5b: roboty magazynu P−2 (gałąź `feat/alchemia-5b`)
- **Mechanizm `shuttle`** (`builders.ts`, `shuttle-system.ts`): bryła jeździ tam i z powrotem po jednej osi według zegara domeny, w realnych sekundach.
  - Jej miejsce wynika z czasu, więc zapis nie potrzebuje nowego pola. Wczytana gra stawia robota tam, gdzie był, a czekanie przesuwa go dalej.
  - System działa przed ruchem, razem z windami i drzwiami.
  - Ciało na drodze robota zostaje zepchnięte w bok, na bliższą stronę jego toru. Bez tego robot najeżdżał na stojącego gracza (test).
  - Bryła ma prędkość, więc raster terenu AI jej nie piecze, jak platformy windy.
- **Dwa wózki na pasie magazynu** (`P2_ROBOTS`):
  - wymiary 1,6 × 2,2 × 0,9 m, każdy na swojej połowie pasa;
  - trasa 9,5 m, 32 s tam i z powrotem, z postojem na obu końcach;
  - obok zostaje 1,5 m chodnika z każdej strony, a trasy obu wózków się nie stykają.
- **Kolejność propów.** Wózki są ostatnimi propami Alchemii, więc identyfikatory i złote hashe się nie zmieniają. Zapis bez zmian.
- **Zostaje:**
  - winda aut z kabin P−1 (otwór w płycie P−1 ze ścianami kabiny i jazda na platformie): osobny krok;
  - 5c: przystanek windy na −9,2;
  - 5d: schron ze skrytką Hebi.

### Etap 5c: przystanek windy na P−2 (gałąź `feat/alchemia-5c`)
- **Trzy poziomy windy** (`lift.ts`): P−2 (−9,2), hala (−6,4), T0 (−2,2), od najniższego.
  - Szyb schodzi pod podłogę hali w wykopie `LIFT_SHAFT_CUT`. Na liście cięć stoi przed wykopem hali, bo o podłodze w punkcie decyduje pierwsze cięcie.
  - Na P−2 bramka otwiera się na wschód, prosto w korytarz serwisowy.
  - Platforma startuje jak dotąd przy hali: fabryka ustawia cel na poziom, przy którym stoi platforma.
- **Jazda.** Jedzie dalej w tę stronę, w którą jechała ostatnio, i zawraca na końcu: hala, T0, hala, P−2, hala. Przy dwóch poziomach to to samo co wcześniej. Kierunek nie jest zapisywany, a po wczytaniu jazda zaczyna w górę.
- **Korytarz P−2.** Jego zachodnia ściana i strop omijają rozpiętość szybu (x 412,3–414,7, z 32,4–34,8), więc platforma jedzie swobodnie, a szyb zamykają jego własne ściany i bramka. Północna i południowa ściana szybu stoją na podłodze P−2, bo pod nią płyta podłogi korytarza wchodzi w jamę szybu.
- **Testy.**
  - Sesja: z hali na T0, z powrotem do hali, w dół na P−2 i wyjście do korytarza, bez obrażeń.
  - Ściany korytarza poza otworem.
  - Trzy poziomy i drzwi na P−2.
- **Zapis i hashe.** Złote hashe zgodne, schemat zapisu bez zmian.

### Etap 5d1: bryła schronu (gałąź `feat/alchemia-5d1`)
Pierwsza z dwóch części 5d: schron bez skrytki. Skrytka Hebi, czujka i zlecenie odzyskania przechodzą do schronu w 5d2 razem z migracją zapisu.
- **Pokój** (`shelter.ts`): x 420,4–435, z 84–97, podłoga −12,2 (3 m pod T2), strop −9,9, płyta −9,6 pod gruntem T2 (−9,2). Pokój i droga do bramy to dwa `GroundVault`, więc teren i bruk T2 nad nimi są całe.
- **Brama stalowa** we wschodniej ścianie korytarza P−2 (z 69–70,6): drzwi automatyczne (ADR-0038), otwierają się każdemu, kto podejdzie. Zamek dostaje w 5d2. Za bramą podest na poziomie P−2, schody w dół na północ (17 stopni po 0,176 m) i przejście do południowo-zachodniego rogu pokoju. Nad schodami strop korytarza P−2 pod gruntem T1.
- **Właz** na T2 na wschód od pokoju, przy (441, 96): szyb (`GroundCut`) ze schodami w dół na zachód i pasem podłogi pokoju u ich stopy, żeby postać przechodziła pod ścianą nad otworem. Ściany szybu mają balustradę 1 m nad T2, a obok stoi otwarta klapa i lampka. Do kamienia pamięci jest 20 m (§6).
- **Ekspozycja:** ławki z czasów wojny przy ścianie południowej i północnej, dwa słupy, dwie gabloty ze znaleziskami, panele zdjęć na ścianie zachodniej, ręczny wentylator i lampy awaryjne. Północno-zachodni róg zostaje wolny na skrytkę.
- **Wnętrze i graf.** Wnętrze `alchemia-shelter` (en/pl). Graf poziomów ma dwa wyjścia: bramą do węzłów korytarza P−2 i włazem na T2.
- **Silnik.** Schron rysuje się w siatce P−2, z własną słabą, ciepłą lampą zasilania awaryjnego (§6), gdy oko jest w schronie. Wtedy lampy P−2, P−1 i hali gasną. Szyb włazu należy do zewnętrza Alchemii. Deszcz nie pada pod płytą schronu.
- **Zlecenie skrytki.** Jeden z ludzi Hebi stał na miejscu włazu, więc przesunął się o metr na południe (`byArkady(8.3, 7.5)`).
- **Testy.**
  - Symulacja: bryły pod gruntem i poza bryłami P−2, P−1, hali i T2, schody w kroku i z prześwitem, właz na poziomie T2 i poza bryłami mapy, wnętrze, graf, pościg przez bramę i przez właz.
  - Silnik: siatki, lampa, widoczność, deszcz.
  - Sesja: z T2 włazem do schronu i bramą do P−2, potem z powrotem, bez obrażeń.
- **Zapis i hashe.** Złote hashe zgodne, schemat zapisu bez zmian.

### Etap 5d2: skrytka Hebi w schronie (gałąź `feat/alchemia-5d2`)
- **Skrytka** w północno-zachodnim rogu sali schronu. Osłona stoi między nią a salą, a skrzynia na ciało stoi przy wentylatorze. Kamera wisi wysoko w południowo-wschodnim rogu i patrzy na skrytkę. Neon jest nad ławką przy północnej ścianie, a głośnik przy schodach włazu (`dev:targ-*`). Strefa `restricted` (`HEBI_STASH_ZONE`) obejmuje salę.
- **Ludzie zlecenia** stoją w sali i patrzą na zachód, w stronę przejścia od bramy. Straż stoi przy osłonie, czujka lockdownu na T2 przy włazie, a zasadzka czeka przy obu wyjściach: w korytarzu P−2 przed bramą i na T2 przy włazie.
- **Czujka** w dzień stoi przy włazie na T2. W nocy chodzi po P−2 tam i z powrotem: wzdłuż T2, w wykop, korytarzem obok bramy do narożnika magazynu i jego alejki serwisowej.
- **Brama** ma zamek kodowy Hebi (ADR-0082) na czas odzyskania. Hebi przechodzą swobodnie. Gracz przechodzi z kodem albo po wyłamaniu panelu, a wyłamanie podnosi alarm.
- **Kod bramy** (2207) czujka powtarza pod nosem. To trop `hook_retrieve_2`, który był wcześniej notatką o widoku z tarasu. Podsłuchany kod otwiera bramę bez alarmu, a kamera bierze gracza za swojego.
- **Dwa podejścia bez alarmu:**
  - włazem z T2: skulona postać schodzi za plecami załogi i idzie wzdłuż północnej ściany;
  - bramą od P−2, obok robotów: z podsłuchanym kodem, wzdłuż zachodniej ściany.
- **Spawn w sklepieniu.** `clearSpot` podnosił nowo stworzoną postać na teren nad nią, nawet w `GroundVault`. Załoga stawała więc na T2 nad schronem. Teraz postać postawiona głęboko w sklepieniu zostaje na jego podłodze.
- **Zapis v50.** Migracja `moveHebiStash` w `alchemia-rebuild.ts` usuwa czujkę, ludzi i skrzynię trwającego odzyskania oraz wszystkich z dawnego miejsca skrytki przy Arkadach (x 435–449, z 86–101). Treść przywraca ich w nowych miejscach. Gracz zostaje, bo T2 dalej jest.
- **Testy.**
  - Symulacja:
    - odzyskanie bez alarmu włazem i bramą;
    - brama zamknięta bez kodu;
    - pościg P−1 → P−2 → schron;
    - miejsca ludzi, urządzeń i planów na podłodze schronu.
  - Sesja: brama zatrzymuje gracza bez zlecenia, a właz działa w obie strony.
  - Migracja: osobny test.
- **Hashe.** Złoty hash determinizmu zmienia się tylko przez wersję schematu: z wersją 49 przebieg daje dawny skrót.

### Etap 5e: winda aut z kabin P−1 (gałąź `feat/alchemia-winda-aut`)
- **Szyb** (`P1_CAR_LIFT`, x 399,2–403,6, z 30–31,35) leży w północnej kabinie oddawania aut. Przechodzi przez podłogę pokładu P−1 i strop P−2 do północnego końca pasa robotów: za ostatnimi słupkami regałów i ich belkami, za biegiem robotów, przed północną ścianą P−2.
- **Platforma** z autem (nadwozie i kabina) jeździ w górę i w dół według zegara, jak roboty: `shuttle` z nową osią `y`, okres 40 s, postój 20% na każdym końcu. Na dole platforma jest równo z podłogą P−2, na górze równo z podłogą P−1. Nic z niej nie trafia do zapisu.
- **Na P−1** szyb zamykają ściany kabiny i jej roleta. **Na P−2** barierka zamyka go z zachodu i wschodu, a od strony pasa szyb jest otwarty, z kogutem nad nim. Kto stanie pod opadającą platformą, zostaje wypchnięty na pas.
- **Testy:**
  - szyb w kabinie, za paletami i biegiem robotów;
  - otwór bez innych brył Alchemii;
  - trzy jeźdźcy w osi `y` o wspólnym rytmie;
  - poziomy na końcach;
  - nikt nie stoi w platformie.
- **Hashe i zapis:** złote hashe zgodne, schemat zapisu bez zmian.

### Etap 8: spójność, pierwszy przegląd (19.11)
Przegląd zrzutów z ulic dookoła: od Bajkowskiego, Lubartowskiej, Świętoduskiej, z T1, z T2, od Placu Łokietka i z lotu z północy i z południa.
- **Zielone stopnie** zachodniego skrzydła miały ściany w tynku, a zieleń tylko na wierzchu, więc od Bajkowskiego wyglądały jak białe pudła. Teraz są obsadzone w całości, jak zielony stok z planszy.
- **Drzewa na tarasie L2** zasłaniały napis CENTRUM HANDLOWE na L3, z ulicy i z lotu. Drzewa stoją teraz na zachód od napisu, a przed nim zostają same donice.
- Bez zmian w symulacji ruchu i kolizji: stopnie zostają bryłami, a drzewa i donice są tylko rysowane.

### Bryła na całym terenie (decyzje użytkownika 19.11)
Plansza `01-rozbudowa-front.jpg` to widok od Bajkowskiego i Placu Łokietka. Dotąd bryła stała tylko nad food hallem (36 × 26 m), więc od Bajkowskiego było widać 9 m tarasów 50 m w głębi, a resztę terenu zajmował plac T0. Użytkownik zdecydował, że bryła zajmuje cały teren Alchemii, czyli parking w173531008 od Bajkowskiego i działkę w1559354343 do Świętoduskiej i Lubartowskiej (ok. 150 × 45–60 m), z frontem od Bajkowskiego. Budżet siatek Alchemii rośnie do 16 000 trójkątów na siatkę.
- **Kształty z planszy.**
  - Schodkowe kondygnacje cofające się od frontu, z zieloną krawędzią i ciągłym pasem LED na każdej płycie.
  - Zaokrąglone narożniki płyt.
  - Podium przy Bajkowskiego z ekranami i zielonym spadzistym dachem schodzącym do ulicy, z linią światła wzdłuż jego profilu.
  - Najwyższe piętro ze skrzynią napisu ALCHEMIA CENTRUM HANDLOWE i masztami, patrzące na Bajkowskiego.
  - Z tyłu bryła schodzi na północ do T1, T2 i Arkad.
  - Na rogu jasny budynek z arkadami.
  - Przed frontem plac ze schodami, fontanną i kioskami oraz rampa P−1 w środku.
- **Poziomy.** Dachy kondygnacji leżą na wysokościach istniejących tarasów: L1 2,3 (dach A), L2 6,5 (dach B), L3 10,7 (nowa, +4,2). Od chodnika Bajkowskiego (−0,8…−1,8) to ok. 12 m do dachu L3, a z napisem i masztami więcej.
- **Bryły etapu B1 (front, nad P−1), `front.ts`.**
  - **L1, skrzydło zachodnie.** x 394–404, z −2…14 i x 396–404, z 14…27,5, wzdłuż skośnej granicy parkingu od Świętoduskiej, z ekranem od frontu.
  - **Zielony stok.** Trzy zielone stopnie z dachu L1 na zachód, x 386,8–394, z −2…14, każdy z linią LED wzdłuż krawędzi.
  - **L1, skrzydło wschodnie.** x 424–436, z 13,5…22,5. Stoi między pawilonem trójkątnym a pawilonem metra B, poza okapem metra i 1,1 m od węzła wyjścia z klatki P−1, z ekranem od południa. Przejście od klatki na Lubartowską zostaje pod gołym niebem.
  - **L2.** Dwie płyty na słupach nad pasażem T0: x 394–422, z 4…32 oraz x 422–436, z 13,5…32. Spód płyty leży na 1,95, czyli co najmniej 2,9 m nad gruntem pasażu. Ekran wisi na południowej ścianie L2. Pod płytą zostają rampa P−1 (otwarta do z 11, dalej pod płytą), domek klatki P−1, rabaty przy rampie i wejście do metra B. Okap metra jest wolny, bo spód L2 leży nad jego pasmem.
  - **Słupy.** Siedem słupów 0,6 m poza rampą, klatką, węzłami grafu na T0 i drogą od klatki do Lubartowskiej.
  - **L3.** x 398–428, z 12…32, ze skrzynią napisu na ścianie południowej i dwoma masztami na dachu. Napis to neon ALCHEMIA w cyjanie nad CENTRUM HANDLOWE w różu, a nowe litery R, U, D, O i W są w `neon-letters.ts` (od C4 skrzynia świetlna z literami atlasu znaków, „Etap C4”).
  - **Dachy.** Front cofa się od ulicy: skrzydła od z −2, L2 od z 4, L3 od z 12. Na dachach L2 i L3 rosną żywopłoty, a każda płyta ma pas LED.
  - **Plac T0 z pergolami** (etap 7) zniknął razem z girlandami. Zostały rabaty przy rampie. Meble mapy omijają obrysy skrzydeł, stopni i słupów (`FRONT_FOOTPRINTS` w `street-props.ts`), a latarnie znikają spod L2.
  - **Rysunek i liczenie.** Front jest rysowany w siatce kondygnacji (`alchemia-tiers`), a w symulacji to osobny, ostatni prop Alchemii. Identyfikatory brył i złote hashe się nie zmieniają. Budżet każdej siatki Alchemii w testach wynosi 16 000 trójkątów.
- **Etapy.**
  - **B1.** Front nad P−1: skrzydła, L2 na słupach, L3 z napisem, zielony stok, usunięte pergole, budżet 16 000, przegląd kuratora.
  - **B2 (zrobione, `pavilion-shape.ts`).** Pawilon trójkątny jako budynek z arkadami. Obrys, wysokości, aneks, drabina, Ren i neon na dachu zostają bez zmian, więc symulacja też.
    - Zamiast szklanej ściany z ramą na każdym boku stoi jasny tynk z łukami: przęsło 1,8 m, filar 0,9 m, łuk zaczyna się na 1,9 m.
    - W łukach, 0,25 m w głębi, świeci ciepłe szkło restauracji.
    - Nad łukami na obu bokach od ulic jest napis ALCHEMIA ciepłymi literami.
    - Zastępnik z daleka ma ten sam podział (ciepły pas, tynk nad nim). Jego ściana stoi za szkłem łuków, bo w swoim bloku widać go też z bliska.
  - **B3 (zrobione).** L3 sięga na północ nad tylnym pasem T0 do południowej krawędzi kondygnacji B (z 38), więc od północy bryła schodzi kaskadą: dach L3 (10,7), B (6,5), A (2,3), T1.
    - Skrzydła na północ od hali nie ma. T1 to front hali z wejściami i Haną.
    - T2 to plac z kamieniem pamięci Placu Ofiar Getta, przy którym nie ma neonów ani reklam (§6).
    - Pas między granicą działki od Świętoduskiej a T2 ma przy wykopie P−2 najwyżej 3,6 m.
  - **B4 (pierwsza część zrobiona).**
    - **Zaokrąglone narożniki płyt** kondygnacji (A, B, L1–L3), promień 1 m, w silniku (`rounded-slab.ts`). Pas LED biegnie po łuku, a proste pasy z symulacji przy płytach znikają. Symulacja zostaje przy pudłach, a szkło pod płytą (0,3 m w głąb) mieści się pod łukiem.
    - **Detale rysowane bez kolizji** (`front-dress.ts`):
      - pnącza na krawędziach L2 i L3, z dala od napisu i ekranu;
      - trzy drzewa w donicach na tarasie L2;
      - cztery parasole ze stolikami na dachu L3;
      - wysokie ekrany na bokach L3;
      - zielone pasy światła w ścianach rampy P−1 i nad wjazdem pod strop.
    - **Fontanna z hologramem** na placu przed skrzydłem zachodnim, x 397,9–401,1, z −7,1…−3,9: niecka z czterech brył do kolan, woda i figura ze światła ze stosu pierścieni wokół rdzenia. Meble mapy ją omijają (`FRONT_FOOTPRINTS`).
    - **Wylot P−2.** Ściany wykopu i parapet nad portalem mają w rysunku balustradę, czyli słupki i dwie poręcze na wysokości metra nad zboczem, zamiast pełnego parapetu. Z T1 widać przez nią wykop i plac T2. Zastępnik z daleka też ma tylko ścianę do zbocza i poręcz, bo w swoim bloku stoi i z bliska. Symulacja zostaje przy pełnym parapecie.
    - **Kioski** (zrobione): dwa na placu przed frontem, na zachód od fontanny i między nią a drogą do rampy (`FRONT_KIOSKS`). Mają ladę z ciepło świecącym okienkiem od ulicy, daszek i pas światła wokół dachu. Są bryłami, a meble mapy je omijają.
    - **Zaokrąglone szkło** (zrobione): szkło kondygnacji pod płytą z równym wysięgiem na wszystkie strony (front L1–L3, kondygnacje A i B) silnik rysuje po obrysie płyty z łukami, cofniętym o wysięg (`roundedGlass`). Narożniki szkła idą więc za łukami płyty. Symulacja zostaje przy pudłach.
- **Zasady.** Bryły to sceneria jak kondygnacje A i B: solidne pudła szkła z dachami do chodzenia. Nowe bryły idą na koniec `ALCHEMIA_PROPS`, więc identyfikatory brył i złote hashe się nie zmieniają, chyba że usunięcie pergoli przesunie wcześniejsze. Wtedy hash zmienia się świadomie i opis trafia do commita. Graf poziomu na T0 zostaje drożny, a słupy i skrzydła stoją poza jego krawędziami (skan `walk-blocked`).

### Do 1:1 z planszą (decyzje użytkownika 19.11, wieczór)
Porównanie zrzutów z planszą (21:00, od Bajkowskiego, z lotu, z góry, przy rampie i przy pawilonie) dało listę różnic. Użytkownik: „Lecimy z Twoim planem usprawnień, budynek z arkadami może przejść od frontu, robimy dziedziniec w dachu taki jak na referencji + nasze pergole z lampionami i ławki. Maksymalnie 1:1 z referencyjną grafiką”. Etapy, każdy osobnym PR-em:
- **C1.** Szkło z wnętrzem, płyty, balustrady, mocniejsze LED.
- **C2.** Zieleń: pnącza na krawędziach, drzewa i krzewy na tarasach, zielony stok jako ciągła pochylnia z linią LED.
- **C3.** Jasny budynek z arkadami w osi frontu, za fontanną i obok rampy, z dwiema kondygnacjami (łuki i okna). Pawilon na rogu wraca do szkła z planu inwestora.
- **C4.** Jasna skrzynia napisu, pionowe holo-ekrany obok niej, ekrany podium z obrazem.
- **C5.** Plac: szerokie schody, okrągła fontanna, kioski z jedzeniem i parasolami, automaty, stoliki.
- **C6.** Dziedziniec w dachu jak w aksonometrii, z pergolami, lampionami i ławkami.
- **C7.** Deptak z neonami (pionowy ALCHEMIA, PARKING CAŁODOBOWY, SPOŻYWCZY) i straganami, ruch aut na rampie, schody obok niej, ludzie na tarasach.

### Etap C1: szkło, płyty i balustrady (19.11)
- **Zaokrąglenia w symulacji.** B4 zaokrąglał tylko rysunek, więc na odciętym narożniku tarasu dało się stać w powietrzu. Teraz element (`Piece`) może mieć obrys (`outline`), a bryła symulacji to graniastosłup tego obrysu.
  - Płyta, szkło pod nią i balustrada kondygnacji mają jeden zaokrąglony obrys (`rounded.ts`). Wzorzec: prostokąt o zaokrąglonych narożnikach, czyli suma Minkowskiego prostokąta i koła, z łukami współśrodkowymi, więc obrys przesunięty do środka zostaje zaokrąglony.
  - Promień wynosi 2 m, najwyżej ćwierć krótszego boku (wcześniej 1 m).
  - Zaokrąglone są tylko narożniki zewnętrzne. Styki pasm kondygnacji B i skrzydeł L1 zostają proste (`outerCorners`).
  - Liczba brył się nie zmienia, więc identyfikatory i złote hashe zostają.
- **Balustrady.** Tarasy A i B dostały balustrady z bryłami wzdłuż zaokrąglonej krawędzi płyty, w miejsce prostych murków na linii szkła. Przejścia zostają nad podestami schodów.
  - Na każdym prostym boku jest jeden graniastosłup, a na każdym łuku dwa, bo każda bryła kosztuje w płaskim indeksie brył.
  - Dachy L1–L3 dostały balustrady tylko rysowane, bo nikt po nich nie chodzi. Przy zielonych stopniach L1 balustrada ma przerwę.
  - Silnik rysuje balustradę jako słupki co 2 m z poręczą. Balustrad schowanych w szkle wyższej kondygnacji nie rysuje.
- **Szkło jak na planszy** (`storey-facade.ts`). Wzorzec: fałszywe wnętrze oświetlonego okna (interior mapping, J. van Dongen 2008), zbudowane z geometrii, bo materiał kitu nie ma paralaksy.
  - Na linii szkła stoją białe słupki ram co 3 m, cokół i nadproże.
  - 1,6 m w głębi świeci ciepło tylna ściana pomieszczenia, a pod stropem ma ciemny pas.
  - Pomieszczenie ma podłogę, a przy niej stoją ciemne sylwetki ludzi i stoliki, rozstawione deterministycznie co 2,9 m.
  - Krawędzie schowane w sąsiedniej kondygnacji nie dostają nic.
- **Płyty.** Są jasne, z belką krawędziową 0,32 m pod płytą. Pas światła ma 0,14 m zamiast 0,08 i biegnie po łuku wzdłuż belki.
- **Budżet.** Siatka kondygnacji ma 12,2 tys. trójkątów przy budżecie 16 tys. Wywołania rysowania się nie zmieniają, bo ramy, wnętrza i balustrady leżą w siatce kondygnacji.

### Etap C2: zieleń (19.11)
- **Zasłony zieleni** (`front-green.ts`) wiszą na każdej odsłoniętej krawędzi kondygnacji: L1–L3 frontu oraz A i B.
  - Biegną wzdłuż zaokrąglonego obrysu płyty, 8 cm za jej krawędzią, co 2,6 m. Każda ma 0,9–1,7 m szerokości i spada 0,6–1,8 m spod belki płyty, a od góry wystaje nad płytę.
  - Pomijane są krawędzie, przy których stoi inna kondygnacja, oraz miejsca przy napisie i ekranach.
  - Co gdzie rośnie, rozstrzyga skrót położenia (hash). Nie ma list pozycji ani losowości.
  - Zasłony są tylko rysowane.
- **Drzewa i krzewy z gry** (decyzja użytkownika z 19.11: modele gry zamiast własnych pudełek) to meble uliczne `shrubs`, `planter` i `tree` w osobnym elemencie sceny chunka Alchemii, na końcu `WORLD_SCENERY` (`FRONT_GREEN_PROPS`).
  - Krzewy stoją co 1,6 m wzdłuż balustrad dachów frontu, 0,85 m od krawędzi, tam, gdzie nad dachem nie stoi wyższa kondygnacja. Ich wielkość rozstrzyga skrót położenia.
  - Cztery drzewa wysokie na 6–7 m (`measuredTreeVariant`) stoją w donicach na rogach skrzydła wschodniego L1 i na tylnych rogach L3.
  - Na tarasach A i B, po których się chodzi, nowych krzewów nie ma.
- **Zielony stok** (`green-slope.ts`): trzy zielone stopnie silnik rysuje jako jedną równą pochylnię trawy od krawędzi dachu L1 do najniższego stopnia. Linia światła biegnie wzdłuż profilu po obu stronach i u stopy.
  - Symulacja zostaje przy trzech stopniach. Stopnie wysokie na 1,05 m nie są do chodzenia, więc pochylnia, która w głębi stopnia leży nad jego wierzchem, nikogo nie zasłania w zwykłej grze.
- **Budżet.** Decyzja użytkownika z 19.11: budżety trójkątów można podnosić. Budżet siatki Alchemii w testach rośnie z 16 do 40 tys., a bramkami zostają wywołania rysowania i aktywne siatki. Szkło zachowuje cokół i dwa pasy tylnej ściany, zasłony wiszą co 2,6 m.
- **Kolor.** Liście i trawniki kondygnacji mają świeżą zieleń planszy (farba kitu barwiona na #4f9a58 i #5a9e4e), bo ciemna zieleń kitu w nocy czytała się jak ciemne płyty. Zasłona to dwa pasma nierównej długości.

### Etap C3: budynek z arkadami w osi frontu (19.11)
- **Decyzja użytkownika (19.11):** „budynek z arkadami może przejść od frontu”.
- **Bryła** (`arcade-front.ts`): jasny dom z arkadami. Wzorzec: podcień (portyk) domu targowego, jak podcienia Starego Miasta i Arkady przy Świętoduskiej, czyli przejście pod piętrem za rzędem filarów.
  - Stoi x 394–409, z −2…3,7, między zielonym stokiem a wykopem rampy, za fontanną.
  - Na parterze jest pięć łuków na sześciu filarach (filary to bryły, 0,75 × 0,8 m). Podcień ma 3 m głębokości, a za nim świecą sklepy skrzydła zachodniego L1, które cofa się do z 1.
  - Piętro od stropu podcienia (2,3) do dachu na poziomie L2 (6,5) jest bryłą. Dach łączy się z tarasem L2 w jeden taras, z balustradą na trzech bokach.
  - Ekran z frontu skrzydła zachodniego zniknął. Ekran L2 przeszedł na wschód, nad wylot rampy.
  - Lampy ulic znikają spod domu, a meble omijają filary.
- **Rysunek** (`arcade-front-geometry.ts`):
  - kremowy tynk (farba kitu barwiona na #e6d6b4);
  - łuki z licem i podniebiem na głębokość filarów;
  - okna piętra z ramą, słupkiem i ślemieniem, świecące ciepło albo ciemne;
  - ciepły napis ALCHEMIA nad środkowym łukiem;
  - gzyms z pasem światła;
  - krzewy z gry na dachu, bez zasłon na elewacji.
- **Pawilon na rogu** wraca do szkła z planu inwestora (rysunek sprzed B2), bo arkady ma teraz dom w osi frontu.

### Etap C4: napis, holo-ekrany i ekrany z obrazem (20.11)
- **Wzorzec.** Szyld świetlny galerii handlowej (lightbox z literami podświetlanymi od środka, ang. *illuminated sign* / *channel letters*) i ekrany LED na fasadzie (*digital billboard*: pokaz spotów po kilka sekund, cięcie przejściem). Holo-ekrany to efekt addytywny, jak holo-reklamy miasta (ADR-0044, ADR-0030): światło dodaje się do tła, czerń nic nie zasłania, więc panel jest półprzezroczysty, bez sortowania i bez zapisu głębi. Źródło: plansza `docs/world/koncepty/alchemia/01-rozbudowa-front.jpg`, praktyka oznakowania galerii (szyld nazwy nad wejściem, ekrany LED na podium).
- **Gdzie rysuje.** Całe światło frontu leży w siatce szyldów komórki mapy (`map-signs`, `front-signs.ts`), jak nazwy metra (ADR-0071 etap 3): bez nowego wywołania rysowania i bez nowej siatki. Bryły pod nim (skrzynia, ramy, emitery, ciemne panele ekranów) są w siatce kondygnacji (`front-sign-geometry.ts`). Animacja tylko w shaderze, z czasu materiału szyldów (krok klatki gry), bez losowości.
- **Tylko z bliska.** Siatka szyldów komórki świeci do 240–500 m, a front Alchemii znika 135 m od środka hali. Rodzaj szyldu powiększony o `NEAR_ONLY.kind` (16) gaśnie między 75 a 92 m od oka. Najdalsze światło frontu leży 42 m od środka hali, więc gaśnie, zanim zniknie budynek (test).
- **Skrzynia napisu.** `FRONT_SIGN` podniesiona i wysunięta przed krawędź płyty L3: x 403–423, z 11,15–11,55, y 8,4–11,7, czyli od 1,9 m nad tarasem L2 do metra nad dachem L3. Dawna skrzynia (y 7,1–10,0) stała pod belką płyty, a linia wzroku z placu nad krawędzią i żywopłotem L2 trafia w ścianę L3 ok. 8,8 m nad ziemią, więc z placu było widać tylko górę liter ALCHEMIA, a CENTRUM HANDLOWE wcale.
  - Skrzynia ma 0,4 m grubości, jasną ramę 0,16 m wysuniętą 6 cm przed lico i pas cyjanu wzdłuż górnej krawędzi (linia z planszy nad literami).
  - Lico świeci słabo od środka, z jaśniejszym brzegiem przy ramie (rodzaj `venue`).
  - Litery z atlasu znaków (ADR-0064), białe z dwoma pierścieniami cyjanowej poświaty, szersze o 10% niż czcionka atlasu: ALCHEMIA ok. 1,3 m wysokości wersalików, CENTRUM HANDLOWE ok. 0,5 m, obie linie podobnej szerokości jak na planszy. Neon z prostokątnych rurek (B1) zniknął.
  - Skrzynia jest tylko rysunkiem (`solid: false`): nikt do niej nie dochodzi, a nad dachem nie przybywa bryła (skan przesłaniania liczy tylko bryły).
- **Holo-ekrany.** Dwa pionowe panele na tarasie L2 przy końcach L3, 0,9 m przed jej krawędzią: zachodni różowy (x 399,4–402,0) i wschodni cyjanowy (x 424,1–427,1). Sięgają 3,2 i 3 m nad dach L3, jak na planszy; zachodni wystaje ponad drzewa tarasu L2 (C2). Treść to program hologramu obrazu ekranu (`screen-glsl.ts`): stojąca figura ze światła, która „oddycha”, obracając się, deszcz znaków, paski u stóp, niebieskawa rama, linie skanowania i rzadkie przesunięcie rzędów (bez niego przy ograniczonych błyskach). Czarne tło nic nie dodaje, więc panel jest półprzezroczysty. Emiter na tarasie to obudowa z pasem światła, dwa cienkie słupki i belka nad panelem. Wszystko tylko rysowane.
- **Ekrany z obrazem.** Pięć ekranów na zewnątrz (front skrzydła wschodniego L1, ściana L2 nad wylotem rampy, boki L3 i ekran nad wejściem głównym) ma ciemny panel w siatce kondygnacji, bez dawnych pasów, a na nim obraz z shadera (`screen-glsl.ts`, rodzaj `screen`): co 8 s następny spot z trzech (nocne miasto z wieżami i księżycem, logo z pierścieniem i paskami tekstu, figura w pierścieniach), cięcie świetlnym przejściem (bez niego przy ograniczonych błyskach), rzędy diod. Sąsiednie ekrany zaczynają od innego spotu. U dołu pas podpisu z nazwą marki świata (LUBLIN 2077, SEKI, NEO RAMEN, ALCHEMIA, CEBULARZ), bez tekstów dla gracza. Boczne ekrany L3 patrzą od L3, na zachód i wschód (dawne pasy rysowały się na stronie przy ścianie).
- **Odstępstwa od planszy.**
  - Skrzynia wystaje metr nad dach L3, bo L3 ma 4,2 m, a z placu musi być czytelna. Na planszy cała ściana najwyższego piętra jest szyldem, a widok jest z góry.
  - Litery mają czcionkę atlasu (wąską), poszerzoną o 10%. Na planszy to szeroki krój geometryczny.
  - Lico skrzyni jest ciemne z poświatą, jak tło napisu na planszy, a jasne są litery i rama.
- **Symulacja.** Skrzynia przestała być bryłą, więc prop frontu ma o jeden graniastosłup mniej. Identyfikatory brył i złote hashe się nie zmieniają. Zieleń omija nową skrzynię jak starą.
- **Budżet.** Wywołania rysowania i aktywne siatki scen `npr-perf` bez zmian (przed i po na tej samej maszynie): `alchemia-tpp` 283 i 113, `alchemia-t2-tpp` 222 i 77, `alchemia-p1` 197 i 74, `alchemia-p2` 207 i 76, `zielona-budowa-tpp` 153 i 70. Siatka kondygnacji 16 638 → 15 486 trójkątów (bez rurek liter i pasów ekranów, ze skrzynią i emiterami), siatka szyldów komórki 3:0 +230. Migawka NPR bez zmian (Neon Koi jest dalej niż 92 m).
- **Testy.** `alchemia-front-signs.test.ts` (engine): skrzynia, litery w ramie, holo-ekrany, obraz na zewnętrznej stronie każdego ekranu, wygaszanie przed zniknięciem budynku, ciemne panele bez pasów. Test pasów ekranów w `alchemia.test.ts` usunięty, a test skrzyni w `alchemia-front.test.ts` (sim) poprawiony świadomie.

### Etap C5: plac przed frontem (19.11, gałąź `feat/alchemia-c5-plac`)
- **Wzorzec:** plac przed wejściem budynku jako „people place” (J. Gehl, „Life Between Buildings”, 1971, i „Cities for People”, 2010; Project for Public Spaces, „How to Turn a Place Around”, 2000): aktywne krawędzie (sklepy pod arkadą, kioski), miejsca do siedzenia (krzesła, obręcz fontanny, ławka, same schody), jedzenie i woda. Różnice: plac jest podniesiony na płycie nad gruntem jak na planszy, a nie zrównany z ulicą, a jedzenie sprzedają kioski, nie parter budynku.
- **Podium** (`front-plaza.ts`): płyta od zachodniego narożnika domu z arkadami do parapetu rampy, x 394–409,7, z −7,4…1, z posadzką podcienia arkad. Wierzch −0,64, czyli trzy podstopnie nad kostką przejścia pod L2 (−1,12; kostka placu jest rysowana 8 cm nad gruntem, `SURFACE_LIFT.square`). Teren opada na zachód, więc podium stoi 0,46 m nad gruntem przy rampie i 1,22 m przy zielonym stoku. NMT bez zmian, bez `PADS`.
- **Schody** (bryły, 0,16 × 0,30 m, §6):
  - na południe do Bajkowskiego pięć stopni na całej szerokości, do z −8,9, czyli do krawędzi kostki placu przed chodnikiem;
  - za rogiem na zachód do siedmiu stopni (z kostki wychodzi sześć), do stopy zielonego stoku (z −2), razem z południowymi jedno L;
  - na północ dwa stopnie w dół do przejścia pod L2 na zachód od rampy, którym droga spod arkad idzie dalej do wejścia głównego (O2b), i trzeci tam, gdzie kostka przejścia leży niżej (opada wzdłuż niego o 6 cm).
  - Podstopnie liczy się od kostki, bo ją widzi oko. Stopień zostaje wszędzie, gdzie wychodzi z kostki (sprawdzane co 10 cm), więc żaden podstopień nie przekracza 0,18 m. Na końcu stopnia, gdzie kostka podchodzi pod niego, ostatni podstopień maleje do zera, jak przy schodach na pochyłej ulicy. Dolnej granicy 0,15 m nie da się tam utrzymać bez zmiany NMT, a kostka może wejść kilka centymetrów na tył najniższego stopnia. Ciało stoi na terenie, 8 cm pod kostką, jak wszędzie w mieście, więc ostatni krok ruchu ma do 0,26 m (`STEP_HEIGHT` 0,45).
- **Fontanna** okrągła jak na planszy, w miejscu kwadratowej z B4: średnica 3,2 m, środek (399,5; −5,2), u szczytu schodów, 1,6 m przed filarami arkad.
  - Obręcz do kolan (0,42 m, siedzisko) z 20 łuków jako bryła; ten sam obrys ma rysunek i bryła, jak w `rounded.ts`.
  - Woda jako bryła, a u stopy obręczy pas światła.
  - W wodzie projektor, nad nim pionowy panel hologramu w cyjanowej ramie z jednym pasem przesuniętym w bok (pęknięty hologram, §3).
- **Kioski z jedzeniem** (`front-plaza-cafe.ts`, `FRONT_KIOSKS` przebudowane): jeden u stopy schodów zachodnich z ladą do ulicy, drugi przy narożniku placu od Świętoduskiej z ladą do placu.
  - Lada z oświetlonym jedzeniem w witrynie, ściany boczne i tylna, słupki przy ladzie, dach z pasami szyldu (czerwony i bursztynowy).
  - Markiza nad ladą i z boku, opadająca od kiosku. Silnik rysuje ją jako pochyłą płachtę z ciepłym światłem pod krawędzią (`plaza-geometry.ts`).
  - W środku blat z parującą płytą, menu na ekranie i światło pod dachem; na ladzie kubki, przed nią ulotki, za kioskiem kartony.
  - Kiosk przy schodach bierze prąd z szafki ulicznej z gry kablem po ścianie (kontrast techniki i biedy, §3), a na jego dachu stoi donica.
- **Stoliki:** cztery okrągłe stoliki z krzesłami pod parasolami. Dwa stoją na wschód od fontanny przy automatach, jeden na zachód od niej, jeden między kioskami.
  - Parasol silnik rysuje jako niski stożek z falbaną i lampą pod spodem.
  - Bryłą stolika jest ośmiokąt blatu do podłogi, a krzesła siedziskiem.
  - Ślady sprzed chwili (§5): kubki z parą, karton z jedzeniem, krzesło przewrócone na plecy.
- **Z modeli gry** (`FRONT_PLAZA_PROPS`, osobny widok mebli, ostatni w `WORLD_SCENERY`):
  - dwa automaty z napojami przy parapecie rampy, przodem do podium;
  - cztery kosze i ławka u stopy zielonego stoku;
  - donice przy filarach arkad i donica z drzewem między kioskami;
  - szafka uliczna;
  - sprzedawcy w kioskach (postacie z gry jak w sklepach O2).
  Bryły mebli to ich prostopadłościany (`modelBoxes`). Własne bryły z pudełek ma tylko to, czego gra nie ma: kiosk, stolik, krzesło, parasol i markiza.
- **Tłum** (ADR-0060, `PLAZA_CROWD`): klienci w kolejkach przy kioskach, siedzący przy stolikach, jeden na obręczy fontanny i jeden przy automatach.
- **Przesunięte, nie obudowane:**
  - trawnik T0 przy Bajkowskiego (x 385–398, z −5,5…−1,5) zniknął z importu, bo na ortofoto miał 1% zieleni (przegląd T-245). Zieleń wraca jako donice i drzewo z gry;
  - grządka przy zachodnim parapecie rampy zaczyna się u stopy schodów do przejścia (z 1,9, było −6,8);
  - ławka mapy pod arkadą (404,8; 0) odpada, bo meble mapy omijają obrys podium i schodów (`FRONT_FOOTPRINTS`).
- **Światło:** pasy w nosie krawędzi podium na południu i zachodzie i nad schodami do przejścia (§4: droga jaśniejsza). Do tego obręcz fontanny, hologram, witryny i szyldy kiosków, lampy pod parasolami i automaty. Na parapecie rampy wzdłuż podium stoją słupki i poręcz, tylko rysowane.
- **Bryły i identyfikatory:** bryły placu leżą w propach po 8 m na końcu `ALCHEMIA_PROPS` (`FRONT_PLAZA_SOLID_PROPS`), więc identyfikatory wcześniejszych brył zostają. Bryła frontu traci tylko fontannę i kioski z B4. Złote hashe podłogi testowej się nie zmieniają.
- **Rysunek:** plac należy do siatki kondygnacji (`alchemia-tiers`), więc nie dokłada siatek ani wywołań rysowania. Siatka ma 19 886 trójkątów przy budżecie testu 40 000. Meble gry są wypiekane w blokach mebli ulicy.
  - Posadzka podium to farba kitu przyciemniona do mokrego kamienia planszy. Stopnie są jasne (§4: droga jaśniejsza).
  - Hologram to obraz ze światła: blady cyjan z pasami w poprzek, jak ekrany frontu, a nie świecąca płyta.
- **Sceny `npr-perf`** (wywołania i aktywne siatki, przed → po, budżety bez zmian): `alchemia-tpp` 283/113 → 283/113, `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 197/74 → 197/74, `alchemia-p2` 207/76 → 207/76, `zielona-budowa-tpp` 153/70 → 153/70. Żadna scena nie patrzy na plac; zrzuty z placu są w raporcie etapu.
- **Skan:** bez nowych i bez ubyłych miejsc (`scan:diff`: 3652 → 3652). Przesłanianie kościoła św. Józefa przez bryły Alchemii: 87 z 358 oczu (24,3% przy progu 25%), z placem i bez niego tyle samo, bo bryły placu sięgają najwyżej dachu kiosku.
- **Zapis:** pobudka zapisu v35 z wykopu rampy (`PARKING_WAKE`) stała w (406; −3), czyli teraz w podium. Przeszła na kostkę u stopy schodów przy szczycie rampy (406; −9,6). Schemat bez zmian.
- **Odstępstwa od planszy:**
  - Na planszy schody mają sześć do siedmiu stopni na całej szerokości. Tu podium leży 0,48 m nad przejściem, bo inaczej droga spod arkad do wejścia miałaby więcej stopni, a NMT zostaje. Stopnie na wschodzie przechodzą więc w spadek terenu.
  - Na planszy kiosk stoi przed schodami od ulicy. Tu stoi u stopy schodów zachodnich, bo schody południowe kończą się 1,1 m przed chodnikiem (krawędź placu z −9,2), a na chodnik nic nie wchodzi.
  - Kawiarnia z parasolami stoi na planszy na wschód od rampy. Tam jest oś wejścia głównego O2b i pawilon, więc stoliki stoją na podium i przy kioskach.
  - Automaty z planszy to wysokie szafy z neonem na dachu, a tu automaty z napojami z gry.
- **Testy:**
  - sim `alchemia-front-plaza.test.ts`: stopnie według reguł; krokowany gracz z chodnika po schodach na podium, pod arkadę, w dół do przejścia i do galerii P1, a także schodami zachodnimi i południowymi w obie strony; fontanna jako bryła; kioski, stoliki i meble z gry; chodnik, jezdnia, rampa i oś O2b wolne; tłum.
  - engine `alchemia-plaza.test.ts`: plac w siatce kondygnacji, stożki parasoli, markizy, kolory.
  - Poprawione świadomie: liczniki propów od końca (`FRONT_PLAZA_SOLID_PROPS`), start spod arkady w `alchemia-entrance` na podium, widoki mebli w `street-furniture`, trawniki w `corrections-alchemia`.

### Etap C7: wykonanie (20.11, gałąź `feat/alchemia-c7-deptak`)
- **Wzorzec:** aktywna krawędź ulicy handlowej (J. Gehl, „Cities for People”, 2010, „soft edges”: małe lokale, towar wystawiony na ulicę, ludzie przystający przy nim; Project for Public Spaces, „active frontages”) i szyld wysięgnikowy (*blade sign*, szyld prostopadły do elewacji, czytany wzdłuż ulicy z obu stron, jak szyldy miasta w `sign-plan.ts`), pionowy albo tablica w poprzek. Różnice: stragany stoją na kostce dawnej jezdni, a nie przy parterach, bo wschodni chodnik zostaje lokalom kamienic (T-324).
- **Neony (`engine/renderer/alchemia/deptak-signs.ts`, korpusy `deptak-sign-geometry.ts`).** Plansza wiesza je na kamienicy po drugiej stronie deptaku, a nie na Alchemii, i tak są zrobione: na zachodniej ścianie w66286394 (OSM), patrząc od Bajkowskiego:
  - na występie ściany (x 454,5, z −0,6…2,1) pionowy cyjanowy SPOŻYWCZY nisko (3,6 m, od 2,8 m nad chodnikiem), a nad nim na najwyższym piętrze czerwona tablica PARKING CAŁODOBOWY w poprzek ściany (3,2 × 1,5 m, wysunięta 0,4–3,6 m), czytana z placu i z Bajkowskiego;
  - dalej na północ czerwony SPOŻYWCZY w poprzek nad sklepem (2,65 × 0,75 m, wysunięty 0,35–3,0 m);
  - za nim wysoko pionowy cyjanowy ALCHEMIA (5,5 m, od 4,4 m nad chodnikiem).
  Każdy ma dwie strony. Światło (obwódka i blask rodzaju `venue`, litery z atlasu znaków, ADR-0064) jest w siatce szyldów komórki kamienicy (`planDeptakSigns` w `cell-builder.ts`, obok `planAlchemiaSigns`), bez nowej siatki i wywołania rysowania. Nie jest „tylko z bliska” (`NEAR_ONLY`), bo wisi na budynku mapy, rysowanym tak daleko jak jego szyldy; światło frontu C4 zostaje tylko z bliska (test). Korpusy są w siatce kondygnacji, jak skrzynia napisu frontu: ciemne skrzynki pionowych szyldów na dwóch wspornikach, czerwone tablice w czerwonej poświacie kitu (`neon-red`) pod drążkiem ze ściany, z białą obwódką i białymi literami jak na planszy. Z daleka (siatka kondygnacji do 135 m od środka hali) zostaje samo światło, jak szyldy miasta. W pierwszej wersji czerwone tablice były samym światłem: blask położony dwa razy prześwietlał się do różu i litery ginęły, a tablica PARKING płasko na ścianie była z placu widoczna tylko pod ostrym kątem. Wszystkie neony wiszą na północ od z 0, w komórce szyldów mapy frontu (`MAP_CELL` 128 m, test): dwa pierwsze wisiały najpierw przy południowym końcu ściany (z −8,6 i −6,4), w komórce z −128…0, której siatkę szyldów scena na Zielonej 5A miała dotąd poza ostrosłupem widzenia, i dokładały tam wywołanie rysowania i siatkę (bisekcja). Słowa na szyldach to język świata (ADR-0056): plik doszedł do wyjątków skanu i18n, jak `canyon-signs.ts`. Bez bryły.
- **Stragany (`sim/content/alchemia/deptak-stalls.ts`).** Plansza ma kioski i stragany na deptaku, a gra miała je od T-324 (trzy kioski, okienko z cebularzami, trzy stragany, automaty) jako puste pudła. Etap dokłada przy trzech straganach (bierze je z tabeli mebli mapy, więc idą za planem mebli):
  - duże obiekty: sprzedawca za każdą ladą (postać z gry, ADR-0058, jak w kioskach placu C5), stos trzech skrzynek z towarem między straganami z warzywami przy słupie sieci (rysunek i bryła Alchemii, skrzynki z ogródka O4: model `market-goods` dokładał blokowi mebli przy deptaku, który go nie miał, siatkę widoczną z Zielonej);
  - drobiazg: skrzynki z warzywami i wiaderka kwiatów na ladach, wiadra z kwiatami przy straganie z kwiatami (bryły do kolan), kartony za nim, ulotki na kostce;
  - kontrast techniki i biedy (§3): holo-cena obok tekturowej, lampa pod daszkiem na kablu przyklejonym do słupa trolejbusowego;
  - ślad świeżej obecności (§5): herbata sprzedawcy paruje na końcu lady.
  Klienci przy okienkach trzech kiosków i przy straganach z warzywami to miejsca tłumu (ADR-0060, `DEPTAK_CROWD` na końcu `CROWD_SPOTS`). Sprzedawcy nie są z tłumu: stojący tłum chunka zajmuje miejsca w kolejności ziarna, więc w większości gier stragan zostałby bez sprzedawcy. Przy straganie z kwiatami i okienku z cebularzami stoją już postacie planu mebli, więc tłumu tam nie ma.
  Wszystko stoi na kostce deptaku: poza chodnikami, pasem postojowym w522482244, dojściem z metra B (z 26–30) i ponad 1,4 m od linii trolejbusu (test i skan `deptak-stall-clear`). Bryły to jeden zestaw propów po 8 m na końcu `ALCHEMIA_PROPS` (`DEPTAK_SOLID_PROPS`), rysunek w siatce kondygnacji.
- **Ruch na rampie P−1.** Ruch już był (G-491, G-510): jedna trasa w dół do kabiny południowej i jedna z kabiny północnej, po jednym aucie. W nocy (22:00, poziom ruchu 0,45) rampa była więc przez większość godzin pusta, a na planszy auto stoi u wylotu. Teraz każda trasa ma dwa auta (`RAMP_CARS`), skalowane jak każdy pas porą i gęstością ruchu: w szczycie dwa w dół i dwa w górę, w nocy zwykle po jednym. Trasy, kabiny i pierwszeństwo bez zmian. Auta zaparkowane na P−1 zostają (10 w zatokach). Złote hashe podłogi testowej bez zmian, bo trasa rampy leży w Lublinie.
- **Schody obok rampy.** Na planszy to wschodni koniec szerokich schodów placu, przy ścianie rampy, z poręczą. Zbudował je etap C5: dwa stopnie po 0,16 m (głębokość 0,30) dochodzą do parapetu rampy, a dalej teren NMT wchodzi na poziom kostki (podium leży tam 0,36 m nad kostką). Więcej stopni wymagałoby podniesienia podium, czyli zmiany C5 i przejścia pod L2 do wejścia głównego, albo zmiany NMT, więc etap nie dokłada nowych brył. Test sprawdza te stopnie według §6 i krokowanego gracza od szczytu rampy na podium i z powrotem. Graf ich nie potrzebuje: to jeden poziom terenu z różnicą poniżej `STEP_HEIGHT`.
- **Ludzie na tarasach (`sim/content/alchemia/terrace-people.ts`).** Na planszy tarasy są pełne. Na dachu domu z arkadami, na tarasie L2 przed L3, na L2 na wschód od L3 i na dachu L3 przy stolikach pod parasolami stoi 19 postaci z gry (ADR-0058), za krzewami balustrad, z dala od donic, drzew, emiterów hologramów i stolików (test). To postacie, a nie tłum, bo na tarasy frontu nie prowadzą schody (`front-dress.ts`).
- **Odstępstwa od planszy:**
  - Neony wiszą tam, gdzie na planszy, na kamienicy naprzeciw, a nie na narożniku frontu ani przy wjeździe na rampę (brief etapu). PARKING CAŁODOBOWY na planszy stoi na słupach nad dachem kamienicy. Tu jest tablicą w poprzek ściany na najwyższym piętrze, pod okapem: nad dachami etap nie dokłada niczego.
  - Czerwony neon ALCHEMIA na dachu kamienicy z prawego górnego rogu planszy nie wchodzi do etapu (nie było go w zakresie C7).
  - Kawiarnia z białym parasolem na deptaku przy rampie stoi na planszy na osi wejścia O2b i na pawilonie trójkątnym. Etap jej nie stawia.
- **Budżety** (wywołania rysowania i aktywne siatki scen `npr-perf`, przed na 85d29da i po na tej samej maszynie, budżety bez zmian): `alchemia-tpp` 283/113 → 283/113, `alchemia-t2-tpp` 222/77 → 222/77, `alchemia-p1` 197/74 → 197/74, `alchemia-p2` 207/76 → 207/76, `zielona-budowa-tpp` 153/70 → 153/70. Trójkąty scen rosną o ok. 50 tys. (korpusy neonów, drobiazg straganów).
- **Skan i topografia:** skan glitchy bez nowych miejsc (293 testy skanu zielone, w tym `deptak-stall-clear`, `figure-in-crowd`). Nowe bryły to wiadra, kartony i skrzynki na kostce deptaku, najwyżej 0,6 m nad nią, czyli pod okiem przechodnia, z którego skan prowadzi linię w górę do szczytu wieży, więc przesłanianie kościoła św. Józefa przez bryły Alchemii nie może się zmienić (87 z 358 oczu, z C5; nie mierzone osobno). Neony to samo światło i korpusy bez bryły pod okapem kamienicy. Obrysy, NMT i `corrections-*` bez zmian, więc bez `osm:build` i `osm:props`. Dopisek w T-324.
- **Czasy testów ruchu** (`alchemia-ramp-traffic`, `alchemia-parking`, konfiguracja z roota, 4 przebiegi na zmianę z jednym i dwoma autami na trasę, load 0,7–2,1, mediany): „brings one…” 7466 → 7650 ms, „stops before Seki…” 3149 → 3433 ms, testy `alchemia-parking` bez zmian (ok. 1,0, 1,0, 0,45, 0,16 s). Rozrzut między przebiegami ±20%, więc różnica mieści się w szumie, ale dwa auta to więcej pracy ruchu.
- **Testy:** sim `alchemia-deptak.test.ts` (sprzedawcy za ladami, trzy warstwy, wszystko na kostce deptaku i poza dojściem z metra B, linią trolejbusu i chodnikami, bryły na końcu `ALCHEMIA_PROPS`, klienci tłumu, ludzie na tarasach, schody przy rampie i krokowany gracz); engine `alchemia-deptak-signs.test.ts` (cztery neony na ścianie w66286394, litery pionowych szyldów w kolejności, białe obwódki czerwonych tablic, korpusy w czerwieni kitu, wszystko nad głowami i przy ścianie, światło nie tylko z bliska, światło frontu C4 dalej tylko z bliska); app `alchemia-ramp-traffic.test.ts` (oba auta każdej trasy jadą rampą; wyjeżdżające może pojawić się pod płytą, a nie tylko w kabinie, bo auto spoza widoku wraca tam, gdzie mówi jego rozkład). Poprawione świadomie: liczniki propów od końca (`DEPTAK_SOLID_PROPS`) w testach Alchemii i widok mebli placu C5 przedostatni.

## Konsekwencje
- Alchemia zgadza się z jedynym planem tego miejsca, a jej tarasy wynikają z NMT, a nie z wyrównanego placu. Topografia ma mniej odstępstw do obrony, a ruina T-188 przestaje być błędem.
- Sprzedawcy mają lokale z ladami, a targ dostaje trzy poziomy, podziemie i drogi pościgu. To więcej testów nawigacji, za to na sprawdzonym wzorcu metra.
- Pięć etapów zmienia zapis, więc migracji będzie kilka. Każda jest mała i ma własny test.
- Alchemia dostaje własne sceny budżetów, a wnętrza i roboty zużywają nowe wywołania rysowania tylko z bliska.
- Część ADR-0063 (etapy 4–6) przestaje opisywać stan gry, a ten ADR ją zastępuje.
