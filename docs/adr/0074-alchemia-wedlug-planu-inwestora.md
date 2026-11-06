# ADR-0074: Przebudowa Alchemii według planu inwestora

Status: przyjęty (6.11, decyzje użytkownika do otwartych pytań 1, 3–6 w sekcji „Decyzje użytkownika”). Decyzje użytkownika z 6.11 są wiążące (sekcja „Decyzje użytkownika”). Krok 2 backlogu „Alchemia według przetargu”. Wejście: plan kuratora topografii [`docs/plany/alchemia.md`](../plany/alchemia.md) (źródła S1–S14, D1–D3, tabela NMT w §2). Stan kodu: `origin/main` 948fe48, rejestr topografii z gałęzi sesji.

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
- **Rampa parkingu:** dwukierunkowa, od Bajkowskiego w miejscu dzisiejszego wjazdu (414; −7, y ok. −1,0) w dół na północ do P−1 (−6). Przy spadku 15% ma ok. 33 m długości i mieści się w obrysie w173531008. Wjazd z pętli Świętoduska → Bajkowskiego, wyjazd w prawo na Bajkowskiego (kierunki z OSM). Ruch na rampie dochodzi do istniejących kontroli pasów (`car-lane-off-road`, `lane-dead-end`, `turn-off-road`) i nie podnosi ich bazy. Auta znikają w kabinie oddawania na P−1, a z kabiny wyjeżdżają inne.
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
  - `game-solid-landmark-occlusion` (z przeglądu #312): bryły Alchemii zasłaniają najwyżej 25% szczytu zabytku z oczu na ulicach w promieniu 250 m. Baza 0, etap 1.
  - `pad-unregistered` (z przeglądu #327): każdy `PADS` ma wiersz T. Baza z pomiaru w etapie 1, potem tylko spada.
  - `underground-level-exit`: każde wnętrze podziemne ma co najmniej dwa wyjścia drożne w grafie poziomów. Baza 0, etap 4.
  - istniejące `metro-shaft-open`, `metro-entrance-blocked`, `building-underground-solid`, `interior-outside-building`, `interior-entrance-gap`, `bay-car-out-of-park` i `parked-car-*` bez wzrostu.

### 12. Etapy (osobne PR-y, w kolejności użytkownika)
Każdy etap ma test sesji bez renderera (`packages/app/test/alchemia-*.test.ts`, krokowanie `freeze` + `step`), testy treści `sim`, skan glitchy, e2e budżetów (`pnpm e2e e2e/npr-perf.spec.ts`), zrzuty do przeglądu kuratora w opisie PR i wpis w tym ADR-ze. Zmiany symulacji i zapisu idą osobno od renderera, jeśli etap jest duży.

1. **Food hall ze sprzedawcami.** Rozbiórka hali, stoisk i windy. Food hall z wnętrzem, 12 lokalami i sprzedawcami za ladami. T0 jako dach i T1 jako plac z Haną, schody T0 ↔ T1, winda T0 ↔ −6, klatka przy windzie, Ren i Kurosawa tymczasowo na T0. `ALCHEMIA_NAV` dla tych poziomów, obszar `INTERIORS` z autozapisem, scena `alchemia-tpp`, migracja zapisu. Test sesji: dojście do każdego sprzedawcy, handel, godziny (`fumiko_closed`, `oyaji_closed`), napad na Oyajiego z obu stron, pościg T0 → T1 → wnętrze, wczytanie zapisu v30 z dachu hali.
2. **Arkady i plac T2.** Odbudowa w66286396 na 2 kondygnacjach, zejście T1 → T2, tablica pamięci, zieleń, skrytka Hebi tymczasowo na T2. Zamyka T-186, T-188 i G-396. Kontrola `osm-building-kept`.
3. **Trójkątny pawilon.** Bryła, neon ALCHEMIA, drabina na dach, Ren z torbą na dachu, migracja. Przegląd osi na Bramę Krakowską i Ratusz.
4. **Parking P−1.** Rampa od Bajkowskiego, kabiny, auta statyczne i wjeżdżające, ładowarki, druga klatka, drzwi z food hallu (kiosk Sachiko na właściwym miejscu), opcjonalnie drzwi z hali metra B, NPC (parkingowy, technik, ochroniarz), zniknięcie naziemnego parkingu, scena `alchemia-p1`, kontrola `underground-level-exit`.
5. **Parking P−2 i schron.** Magazyn z regałami i robotami jako ruchomymi przeszkodami, korytarze serwisowe, wylot na T2, przystanek windy, schron z ekspozycją, skrytka Hebi w schronie i zlecenie odzyskania ze skradaniem. Migracja skrytki. Test sesji: odzyskanie bez alarmu obiema drogami, pościg P−1 → P−2 → schron.
6. **Życie placu** (po decyzji, poza zakresem tego ADR-u): wydarzenia na T1 i T2 z tłumem ADR-0060, rola Arkad i pawilonu.

### 13. Prawa autorskie
Do repo nie trafia nic z wizualizacji ani zdjęć prasowych (redakcje, „materiały prasowe Arkady sp. z o.o.”). Bryły opisujemy słowami i liczbami ze źródeł planu. Geometria jest własna albo z modeli CC0 lub CC-BY 4.0 z wpisem w README katalogu i na ekranie „Autorzy” (ADR-0063). Kopie artykułów zostają w scratchpadzie kuratora.

## Otwarte pytania
Brak. Pytanie o godziny lokali rozstrzygnął użytkownik 6.11 (sekcja „Decyzje użytkownika”).

## Wykonanie

### Etap 1: food hall ze sprzedawcami (gałąź `feat/alchemia-etap1`)
- **Bryła.** Food hall x 400–436, z 32–58 (36 × 26 m, ok. 35% prawdziwej powierzchni), 2,2 m od szybu i hali pawilonu B. Obrys leży na liniach siatki terenu 4 m, więc taras styka się ze ścianami całymi oczkami. Poziomy z pomiaru: T0 = −2,2 (parking przy tylnej ścianie), T1 = posadzka = −6,4 (średnia NMT przed frontem, −5,6…−7,8). W świetle 3,8 m. Grunt pod obrysem to `GroundCut`, czyli dziura w rysowanym terenie, jak pod pawilonem metra, a nie `GroundVault` ani płyta z `decks.ts`. Przy oczku 4 m przejście z T1 do sklepienia pod T0 dawało w drzwiach rampę 48°. Schody mają osobny wycinek przed wycinkiem hali, żeby AI na biegu szło grafem (pomiar: bez tego pościg z sali na dach utykał na stopniu 1,5 m pod celem).
- **Wnętrze.** 12 lokali: Kenta i Goro przy wejściu, bar Fumiko w narożu NW z ladą przez front na T1 i własnymi drzwiami, sklep Oyajiego w narożu NE (lada pancerna, krata, zaplecze, drugie wyjście na T1), kiosk Sachiko przy tylnych drzwiach do klatki. Tła: kawiarnia, tajska, koreańska (roleta), grecka, gruzińska (roleta), wok, burgery (roleta). Sześć lokali z właścicielami z tabeli §3 to w etapie 1 pięć, bo Hana stoi z wózkiem na T1. Stoły wspólne pośrodku. Fronty HW 4 nie wróciły: mają 9 m wysokości, więc lokale to własna geometria, a `alchemia-props.glb` zniknął z gry razem z wpisami w „Autorach”.
- **Godziny.** Wejście do hali z T1, tylne drzwi do klatki i winda są otwarte całą dobę. Godziny 10:00–24:00, 16:00–4:00 i do 22:00 dotyczą lokali (ich ludzi i handlu), a nie drzwi hali, bo symulacja nie ma zamykanych drzwi na harmonogram.
- **Odstępstwo: fronty HW 4 nie wróciły.** Sklepiki z `alchemia-props.glb` mają 9 m wysokości, a lokal pod tarasem ma 3,8 m w świetle. Lokale są więc własną geometrią z pudełek, a plik i wpisy w „Autorach” zniknęły.
- **Komunikacja.** Klatka przy windzie biegnie wzdłuż tylnej ściany z domkiem na dachu i drzwiami na parking. Winda T0 ↔ −6,4 w szybie przy tylnej ścianie: dolne drzwi do sali, górne na parking. Rampy T0 → T1 po obu bokach (16,8%, 9,5°), wschodnia rysowana jako schody. Rampa 8% z §4 nie zmieściła się w 25 m spadku 4,2 m. T0 i T1 z rampami to jeden poziom terenu, więc graf łączy je tylko po to, żeby droga z dachu albo z sali szła dalej.
- **Graf** `ALCHEMIA_NAV`: drzwi frontu (wejście, Fumiko, zaplecze Oyajiego i drzwi do jego sklepu), sala, klatka, dach od strony parkingu. Testy: pościg z parkingu do lady Kenty klatką, z T1 do sali i z powrotem, z sali na dach.
- **Ludzie.** Hana na T1 (428; 66), Ren i torba Hebi na zielonym dachu do etapu 3, Kurosawa i czyściciele przy kiosku windy na parkingu, czujka i skrytka Hebi bez zmian do etapu 2. Godziny według decyzji: Kenta i Goro siedzą w głębi lokali od 0:00 do 10:00, Oyaji po 22:00 przechodzi przez zaplecze na T1, Fumiko w dzień siedzi na stołku przed barem.
- **Pasmo.** `BAND_AREAS` ma dwa prostokąty: działkę x 379–456, z 30–140 i parking x 379–441, z −16…30, bez przystanku „Brama Krakowska 01” i chodnika Lubartowskiej. Test ADR-0059 nie łapie nikogo spoza targu.
- **Zapis.** Schemat v33 (main + 1, po v32 cyberdecku z #341): migracja 32 → 33 w `persistence/src/alchemia-rebuild.ts`, łańcuch od v28.
- **Widok z daleka (przegląd #343).** Grunt pod halą jest wycięty z terenu na stałe, a jej szczegółowa siatka rysuje się tylko do 135 m. Bloki mebli ulicznych (`props-far` i `props`) niosą więc zastępczą bryłę hali, jak pawilony metra: dach, front ze świecącym szkłem, ściany i posadzkę, o 3 cm w głąb pudełek szczegółowej siatki, więc z bliska jej nie widać. Nie ma własnego wywołania rysowania.
- **Światło i budżet.** Zewnętrze jest jedną siatką do 135 m: przy 150 m z §7 włączało się w scenie Rynku (149 m), więc odległość skrócono. Wnętrze to druga siatka do 45 m od ścian, z jedną ciepłą lampą. Front świeci ciepło (`win-warm`). Scena `alchemia-tpp` zmierzona na 209 wywołań i 79 siatek, budżet 216 / 82. Pozostałe sceny i migawka NPR bez zmian.
- **Skan.** `pad-unregistered` (baza 2: pady pokoi kliniki i Neon Koi bez wiersza T) i `game-solid-landmark-occlusion` (baza 0). Pozostałe bazy bez zmian.
- **Wiersze T do rejestru** (numery po T-196 z rejestru sesji): T-145 na nowo (food hall według planu 2026), T-197 (T0, linia siatki pod tylną ścianą na −2,2), T-198 (T1, x 396–444, z 56–76 na −6,4, przejście 8 m), T-199 (rampy T0 → T1 po bokach), T-200 (bryła food hallu i wycięty grunt). T-157 bez zmian: pawilon B stoi poza padem T0.

## Konsekwencje
- Alchemia zgadza się z jedynym planem tego miejsca, a jej tarasy wynikają z NMT, a nie z wyrównanego placu. Topografia ma mniej odstępstw do obrony, a ruina T-188 przestaje być błędem.
- Sprzedawcy mają lokale z ladami, a targ dostaje trzy poziomy, podziemie i drogi pościgu. To więcej testów nawigacji, za to na sprawdzonym wzorcu metra.
- Pięć etapów zmienia zapis, więc migracji będzie kilka. Każda jest mała i ma własny test.
- Alchemia dostaje własne sceny budżetów, a wnętrza i roboty zużywają nowe wywołania rysowania tylko z bliska.
- Część ADR-0063 (etapy 4–6) przestaje opisywać stan gry, a ten ADR ją zastępuje.
