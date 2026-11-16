# ADR-0082: Sektor W-3, hale montowni dronów Tessen: pionowy wycinek „Dwie drogi”

Status: przyjęty (decyzje użytkownika 15.11): wariant A „Brama nad korytem”, zleceniodawca Genzō, zapis startowy wycinka na poziomie 12 i pasmo W-3 10–30, eskorta Miki wycofana do czasu łodzi; panorama Starego Miasta i Zamku jako sylwetki w skyline (rekomendacja, do potwierdzenia na zrzutach etapu 1).

## Kontekst
- **Decyzje użytkownika 15.11 (backlog):** strategia 14.11 pkt 4 każe zrobić pionowy wycinek, czyli jedną misję od początku do końca, dopracowaną na telefonie, z bramką wydajności. Doki nad Bystrzycą (ADR-0024, ADR-0045, T-002) są „ani budynek, ani miasto” i idą do przebudowy na Sektor W-3, czyli zakłady militarne Tessen z montownią dronów bojowych. Wycinek to wariant C „Dwie drogi”: sabotaż linii montażu przed odbiorem partii przez wojsko. Wejście ciche prowadzi przez serwerownię (wirus przestawia kalibrację, wyjście niezauważone, wyższa stawka, Tessen neutralny). Wejście głośne prowadzi przez zbrojownię (broń i ładunki na stanowiskach, walka i ucieczka, Tessen wrogi w mieście). W pierwszej wersji nie ma dronów bojowych ani łodzi.
- **Grafiki użytkownika** (`docs/world/koncepty/tessen-w3/`): 01 to kompleks na nabrzeżu z wieżą kontrolną o czerwonym przeszkleniu, bramą z neonem TESSEN, pomostem nad wodą, rurami nad rzeką i panoramą Starego Miasta z Zamkiem. 02 to montaż końcowy (suwnice, ramiona, linia w pasach), komora testowa ze strefą startową i rzut. 03 to plan parteru (śluzy, magazyny części, linia, komora testowa, zbrojownie, serwerownie, kalibracja), przekrój z suwnicą, antresolą i piwnicą magazynów oraz schemat przepływu produkcji i personelu. 04 to paleta: grafit, oliwkowy, pomarańcz, czerwień i żółte pasy.
- **Stan dziś (origin/main 71af25e):**
  - `DOCKS_PLACE` = (2560; −28,6; 300), plac `DOCKS_AREA` x 2520..2594, z 390..450, basen `DOCKS_BASIN` x 2520..2594, z 452..500 wykopany na 3 m.
  - `CLEARED` i `CLEARED_BUILDINGS` to oba prostokąty, `PADS` to `grow(DOCKS_AREA, 5, 0)` z blend 6 oraz basen −3.
  - Siatka dzielnicy Nabrzeże ma 4 chunki x 2300..2700, z 60..480. Północna część basenu i barka (z 480..500) leżą poza siatką.
  - Koryto Bystrzycy z OSM: przy z 420 płynie w x 2449..2474, potem skręca na NE ((2500; 463) → (2532; 480)) i łączy się z basenem w zakolu x 2520..2532, z 463..480.
  - **Kładka piesza OSM nad korytem** (pokład (2439,4; 435,6) → (2484; 409), x 2437..2486, z 405..439) ląduje na wschodnim brzegu 36 m na zachód od placu.
  - Metro „Nabrzeże Bystrzycy” ma wejście A w (2527; 388). Na placu i obok stoi tylko budynek w1354195809 (wycięty), reszta to trawa i ścieżki.
  - Treść doków w `sim/src/content/district-doki.ts`: plac kontenerowy, magazyn 9 m, biuro, suwnica 8 m, molo, łódź, `DOKI_NAV` z 27 węzłami. Zlecenia Genzō to `escort`, `infiltrate`, `hack` (`DOCKS_CONTRACT_KINDS`), są posterunki `DOKI_CONTRACT_POSTS` i snajper `SNIPER_PERCHES`.
  - Z treści doków korzysta ok. 25 plików testów, m.in. `stealth`, `perk-stealth`, `m4-docks`, `save-load-hack-fight`, `lublin-session` i `m4-docks-loop`.
- **Systemy, które już są:**
  - wzrok ze stożkiem, kucanie, podejrzenie i słuch kroków (ADR-0069);
  - obezwładnienie, chwyt, ukrywanie ciał i ragdoll (ADR-0065, ADR-0075);
  - przebrania z rolami `tessen_guard` i `tessen_staff` oraz strefy zakazane (ADR-0033, `core/crime/disguise.ts`);
  - kamery i quickhacki `ping`, `reboot_optics`, `distract`, `cripple_movement`, `short_circuit` oraz breach z daemonami (ADR-0028, ADR-0059);
  - snajper z laserem, alarm kontraktu i fale `spawnWaiting`, drzwi z kodem (ADR-0024, ADR-0038);
  - haki obserwacyjne (ADR-0034), harmonogramy (ADR-0017) i patrole Hebi po harmonogramie (ADR-0048);
  - obszary wnętrz z ambience (ADR-0061, ADR-0060) oraz impostory skyline z prawdziwą perspektywą (ADR-0051).
- **Wydajność:**
  - Pomiary telefonu z 15.11 (pliki `phone-perf-*.json` w scratchpadzie): deptak 215 wywołań i 147 siatek, 1,03–1,14 mln aktywnych trójkątów. Bystrzyca przy (2500; 140): 48 wywołań, 26 siatek, 355 tys. trójkątów. Czas klatki tej samej sceny skacze między przebiegami od 5 do 40 ms, więc pojedynczy pomiar jest szumem.
  - PR #575 wprowadza bramkę `activeTriangles` 1,2 mln dla `phone-low`.
  - `nabrzeze` w `tools/perf-budgets.json` ma 339 wywołań i 146 siatek.
  - Scena `models` daje ok. 22 wywołania na ubraną postać.
- **Zapis:** na main `SAVE_SCHEMA_VERSION` = 38, a ADR-0081 rezerwuje v39.
- **Zaczepienie w Lublinie:** Plage i Laśkiewicz, lubelska wytwórnia lotnicza z lat 20. i 30. Drony są jej dziedzicem: W-3 stoi „na terenie dawnej wytwórni”, z ceglanym cokołem w ścianie śluz i tablicą. Cukrownia zostaje na później.

## Decyzja

### 1. Misja „Odbiór partii” (kontrakt `sabotage`)
**Zleceniodawca:** Genzō (`genzo`, frakcja `fixers`, stawki skaluje reputacja u fixerów) jako pośrednik anonimowego klienta. Rekomenduję go, bo nie trzeba nowego `ContractGiverId`, jest już knot ink i telefon. Alternatywą jest nowa postać (pytanie 2). Genzō stoi teraz poza płotem, przy kontenerze KAIUN na publicznym pasie przy metrze (2491; 385).

**Ramy:**
- Odbiór partii 12 dronów o 06:00. Termin (`deadlineTick`) to najbliższa 06:00, do której zostało co najmniej 6 h gry, czyli 6–30 minut rzeczywistych (minuta to godzina, ADR-0017).
- Od 05:00 na plac odbioru zajeżdżają 3 ciężarówki i 2 dodatkowych strażników.
- Kontrakt jest jednorazowy, bez losowego wariantu (`ContractVariation`). Profil ochrony to `standard`, po alarmie `lockdown`.

**Wspólny początek:**
1. Telefon `phone_genzo_w3_offer`, potem rozmowa przy KAIUN (`genzo_w3_brief`): partia, odbiór i dwie drogi. Seki dostaje pendrive z wirusem (`w3_virus`, przedmiot fabularny) i dwa haki (ADR-0034): kod furtki serwisowej i wylot kolektora pod nabrzeżem.
2. Przygotowanie (opcjonalne):
   - Infiltracja biura przepustek w wieży (dotychczasowy rodzaj `infiltrate`, nowe miejsce) daje hak „trasy patroli”: trasy P1–P3 na mapie i minimapie na czas kontraktu.
   - Spotkanie `enc_w3_smoker` (technik na papierosie przy furtce, 19–23) daje hak „szafka 14”: kombinezon technika (`tessen_staff`) w szatni piwnicy.

**Droga cicha:**
1. Dojście, jedno z dwóch:
   - Q1 „kolektor”: półka pod ścianą nabrzeża od pasa publicznego, wylot kolektora, 37 m w kucaniu, drabina do piwnicy. W szatni piwnicy jest kombinezon technika.
   - Q2 „rury”: zachodni brzeg, drabina na kozioł rurociągu, chodnik nad Bystrzycą na +10, podest wieży +10, kładka na dach rzędu N, 60 m po dachu między agregatami chłodzenia (dwie kamery, obserwator w kabinie wieży), właz nad serwerownią N.
2. Wejście: Q1 prowadzi z piwnicy schodami do magazynu S, potem przez halę w przebraniu albo za taśmami w kucaniu (patrol P1, technicy, kierownik zmiany jako egzekutor przebrań), korytarzem N do drzwi serwerowni N. Q2 prowadzi włazem prosto do serwerowni.
3. Cel: terminal rdzenia kalibracji. Breach jest opcjonalny: skraca upload z 40 s do 25 s, a `datamine` daje premię. Upload liczy się, gdy Seki jest w promieniu 3 m na tym samym poziomie. Odejście **pauzuje** upload, nie zrywa go (inaczej niż `hack`). Fali nie ma. P1 zagląda do korytarza N co drugie okrążenie.
4. Wyjście: przekroczenie płotu strefy albo wejście do metra bez alarmu kontraktu. Wypłata przez telefon od Genzō (`phone_genzo_w3_paid_quiet`). Jeśli wypłata telefonem nie da się podpiąć pod `complete-contract`, Genzō czeka na peronie Nabrzeża.

**Droga głośna:**
1. Dojście: pas publiczny i furtka serwisowa w południowym płocie (kod z haka) albo brama wjazdowa z wartownią (2 strażników).
2. Wejście: zbrojownia S przez drzwi zewnętrzne (2552; 396), zamek kodowy jak ADR-0038 (`during: "sabotage"`). W środku 2 strażników i kwatermistrz-egzekutor. Pierwszy strzał słychać na 22 m, więc alarm idzie przez hałas broni jak dziś.
3. Broń i ładunki:
   - Skrzynia zbrojowni: AR-5, `kagero_dmr`, amunicja, apteczki, kamizelka Tessen.
   - Skrzynka ładunków: 3 × `w3_charge`. Pobranie ich **zawsze** podnosi alarm (czujnik wagi), deterministycznie, także gdy dotąd było cicho.
4. Alarm włącza lockdown: drzwi obu serwerowni zamykają się zamkiem `alarm` i wirus przestaje być możliwy. Fale wchodzą od razu (3 ludzi ze śluz) i po 60 s (3 z placu odbioru). Obserwator z wieży przechodzi na chodnik toru suwnicy +12 jako snajper.
5. Cel: ładunki na 3 z 4 stanowisk montażu (S1–S4). Podkładanie trwa 2,5 s i przerywają je obrażenia. Licznik „Ładunki 2/3” i zapalnik na HUD.
6. Detonacja następuje, gdy Seki wyjdzie z obszaru hali, albo 60 s po trzecim ładunku. W promieniu 10 m od ładunku zadaje 60 obrażeń malejących z odległością, tylko przy czystej linii z `rayGeometry`. Stanowiska zamieniają się we wraki, w hali są dym i ogień.
7. Ucieczka: za płot i ponad 60 m od hali albo metro. Od tej chwili działa pościg Tessen (sekcja 3). Wypłata przez telefon (`phone_genzo_w3_paid_loud`).

**Przejście między drogami:** alarm przed końcem uploadu włącza lockdown, a cele przełączają się na drogę głośną („Serwerownia odcięta. Zostaje zbrojownia.”). Stawka spada do głośnej. Alarm po wgraniu wirusa nie przerywa misji: liczy się jako „wyjście zauważone” (sekcja Balans).

**Porażka:**
- `batch-shipped`, nowy powód w `ContractFailure`: 06:00 mija, a wirus nie jest wgrany i ładunki nie wybuchły.
- Śmierć Seki: zwykłe przebudzenie w klinice. Podłożone ładunki Tessen zdejmuje, flagi stanowisk się kasują, kontrakt trwa do terminu.
- Wyjście ze strefy po alarmie bez celu to nie porażka: kontrakt trwa do 06:00.

**Zlecenia doków:**
- Infiltracja zostaje: miejsce `tessen_office` przechodzi do biura przepustek na parterze wieży, mechanika bez zmian (stożek, alarm to porażka `detected`). To trening drogi cichej i źródło haka.
- Włamanie zostaje: `quay_terminal` przechodzi na nabrzeże przy pomoście (2484; 430). Fala i snajper zostają, stanowiska snajpera to podest wieży +10 i dach rzędu N. To trening drogi głośnej.
- Eskortę (`escort`) wycofujemy z `DOCKS_CONTRACT_KINDS`. Jej trasa i zasadzka stały na placu kontenerowym, a łódź to wariant B (łodzie, później). Aktywna eskorta w zapisie zostaje anulowana bez kary (migracja w etapie 1).
- Sabotaż nie wchodzi do generatora. Genzō oferuje go raz, potem wraca do infiltracji i włamania.

### 2. Projekt hal na prawdziwym terenie
Wszystkie współrzędne to metry świata gry (x na wschód, z na północ). Wysokości liczymy względem posadzki W-3, `W3_Y` = −28,6 (dzisiejsze `DOCKS_PLACE.y`). Woda leży na −1,3, jak dzisiejszy rekwizyt `water`.

#### Wariant A „Brama nad korytem” (rekomendowany)
Hala ma oś W–E. Śluzy i brama są od strony koryta, wieża na rogu NW przy zakolu, pomost w korycie na północ od kładki OSM, rurociąg nad rzeką. Basen przy placu odbioru przycinamy do siatki.

```
z                                          basen x 2520..2592, z 452..478 (dno -3)
452 ┌──────┬─────────── plac odbioru x 2500..2606, z 440..452 (ciężarówki, reflektory) ───────────┐
    │ rury │[WIEŻA 2486..2496 × 438..448]                                                        │
440 │ z442 ├───────┬──────┬──────┬───────┬────────┬────────┐                                     │
    │ -444 │MAG N1 │MAG N2│MONTAŻ│KALIBR.│ZBROJ N │SERW N  │  plac wschodni                      │
432 │      │ korytarz N z 430..432 (drzwi do hali x 2512 i x 2546) │ (cel wirusa)│  x 2572..2606        │
430 │POMOST├──┬────┴──────┴──────┴───────┼────────┴────────┤  (parking, wartownia                │
    │2466- │ŚL│ S3 ════ taśma L2 ═══ S4  │                 │   x 2596..2604, z 393..399)         │
    │2479  │N │                          │ KOMORA TESTOWA  │                                     │
422 │z424- │ŚL│ ══ aleja produkcji z 413..423 ══►  wrota│ x 2548..2572   ├► wrota wsch. z 414..422      │
    │436   │W │ (brama x2500, z414..422) │ z 406..430      │                                     │
414 │kładka│ŚL│ S1 ════ taśma L1 ═══ S2  │                 │                                     │
406 │OSM   ├──┴────┬──────┬───┬───┬──────┼────────┬────────┤                                     │
404 │(2484;│MAG S  │LINIA │W1 │W2 │ZBROJ S │SERW S  │ korytarz S z 404..406                       │
396 │409)  │+piwn. │POD.  │   │   │(2552;396)      │                                             │
392 └═ścieżka══ płot ══════════════════ furtka x2549..2551 ════════ brama x2586..2596 ════════════┘
380   x2476..2486      pas publiczny z 380..392: metro A (2527; 388), Genzō/KAIUN (2491; 385)
      ściana nabrzeża x 2477..2479; półka x 2475,6..2477 (-1,0); kolektor x 2477..2514, z 399,5..401,5
```

**Prostokąty (`sim/src/content/tessen-w3/site.ts`):**
- **Strefa za płotem** (`W3_ZONE`): x 2486..2606, z 392..452, plus pas nabrzeża x 2479..2486, z 414..452. Płot 2,7 m (siatki ochronne, nie do przeskoczenia, jak dziś). Furtka x 2549..2551 i brama x 2586..2596 w płocie z = 392.
- **Pas publiczny:** x 2476..2606, z 380..392, metro bez zmian. Ścieżka nadrzeczna x 2479..2486, z 380..413 prowadzi do przyczółka kładki OSM, który **zostaje poza płotem**.
- **Hala:** x 2500..2572, z 396..440.
  - Pas śluz x 2500..2510, z 406..430: śluza personelu S (z 406..413), śluza wagonowa (z 413..423, brama 8 × 7 m w ścianie x = 2500) i śluza personelu N (z 423..430, schody zachodnie na antresolę).
  - Rząd S (z 396..406, pokoje z 396..404, korytarz S z 404..406): magazyn części S x 2500..2514 (schody do piwnicy x 2504..2514, z 397..399), linia podzespołów x 2514..2530, warsztaty x 2530..2538 i 2538..2546, zbrojownia S x 2546..2558 (drzwi zewnętrzne (2552; 396), wewnętrzne (2552; 404)), serwerownia S (zasilanie i kopia) x 2558..2572.
  - Rząd N (korytarz N z 430..432, pokoje z 432..440): magazyny części x 2500..2514 i 2514..2524, montaż modułów x 2524..2536, kalibracja x 2536..2548 (3 stanowiska, jedno z logiem jako premia), zbrojownia N x 2548..2560 (zamknięta na stałe w v1), serwerownia N x 2560..2572 (drzwi (2566; 432), właz w dachu z drabiną (2569; 438)).
  - Linia montażu x 2510..2548, z 406..430: taśmy L1 (z 410..412) i L2 (z 424..426), x 2513..2545, wys. 1,2 m. Po 4 ramiona na taśmę (podstawy 1,4 × 1,4 × 1,8). Stanowiska S1 (2519; 412,8), S2 (2537; 412,8), S3 (2519; 423,2), S4 (2537; 423,2). Aleja produkcji z 413..423. Palety części (1,4 m) przy ścianach.
  - Komora testowa x 2548..2572, z 406..430: ściany 0,8 m, 14 m wysokości. Wrota zachodnie 6 × 6 m (x = 2548, z 415..421) i wschodnie (x = 2572, z 414..422) na plac wschodni. Okno z galerii antresoli w ścianie z = 430. Dach otwierany (strefa startowa) zamknięty w v1.
- **Wieża kontrolna:** x 2486..2496, z 438..448. Parter to biuro przepustek (infiltracja), w środku klatka schodowa. Podest +10 łączy się z rurociągiem i kładką na dach rzędu N (x 2496..2500, z 438..440). Kabina +24..+28 (czerwone szkło), dach +28,6, maszty do +34.
- **Rurociąg nad rzeką:** x 2442..2486, z 442..444. Chodnik serwisowy +10 o szerokości 1 m z barierkami 1,05. Kozły w x 2444 (zachodni brzeg, drabina od ścieżki), 2465 (pal w korycie) i 2484.
- **Pomost:** x 2466..2479, z 424..436, poziom 0, na palach, z wozem opancerzonym (osłona). Kładka OSM przy x 2466 leży na z ≈ 420, czyli 4 m dalej. Barierka 1,1 m i niewidoczna kolizja do 2,7 m nad wodą, dopóki nie ma pływania (jak dzisiejszy płot).
- **Nabrzeże:** ściana x 2477..2479, z 380..452, od −3,2 do 0. Półka x 2475,6..2477, z 380..412, na −1,0, tylko do kolektora. Kolektor x 2477..2514, z 399,5..401,5, podłoga −1,6, strop −0,2: kucanie w 1,6 m, do sprawdzenia testem kapsuły. Na końcu drabina do piwnicy.
- **Piwnica magazynów:** x 2514..2546, z 396..406, podłoga −4,5, strop −0,4. Szatnia z szafkami (kryjówki ciał) i szyb windy towarowej (2530; 401) z drabiną dla gracza. Bryły pod terenem jak `GroundVault` z ADR-0074.
- **Wysokości:** hala główna do +16 (dach +16..+16,6), tory suwnicy +12 wzdłuż z 406,6 i 429,4 (x 2510..2572), chodnik toru N +12 (drabina w korytarzu N przy x 2511). Rzędy i pas śluz: parter 0..5, antresola N +5,5..+10 (x 2500..2560: szatnia, biuro kierownika zmiany x 2524..2536, galeria kontroli z oknami +6,5..+8,5 na linię), dachy +10,4 z attyką zewnętrzną 1,9 m. Na dachu N stoi 5 agregatów chłodzenia 3 × 2 × 1,4 przy x 2520, 2532, 2544, 2556, 2568.
- **Plac odbioru** x 2500..2606, z 440..452 i **plac wschodni** x 2572..2606, z 392..440.

**Przepływ:**
- Produkcja (grafika 03): śluza wagonowa, magazyny, aleja i taśmy, kalibracja, wrota komory, komora, wrota wschodnie, plac wschodni i plac odbioru.
- Personel: śluzy personelu, szatnia na antresoli, stanowiska.

**Osłony:** taśmy 1,2 m (kucanie), podstawy ramion 1,8 m, palety 1,4 m, ławy warsztatów, agregaty na dachu, wóz na pomoście, ciężarówki. Kryjówki ciał to szafki w szatni piwnicy i śluzach, skrzynie części w magazynach i kontener na placu odbioru.

**Linie wzroku** (każda to przypadek testu w etapie 2):
- Kabina wieży widzi płytę nabrzeża, pomost, plac odbioru i dach N do x ≈ 2545. Półki pod ścianą nabrzeża nie widzi.
- Galeria antresoli widzi całą aleję produkcji. Za taśmą w kucaniu z alei nie widać.
- Aleja z 413..423 to prosta linia 38 m od bramy do wrót komory: przejście w poprzek jest najgroźniejsze.
- Korytarz N od strony hali widać tylko z jego wylotów.
- Serwerownia N za zamkniętymi drzwiami jest niewidoczna. Widzi ją tylko kamera w środku, którą można wyłączyć przez `reboot_optics`.
- Szkło traktujemy jak dziś (zasłania wzrok). Przezierne okna galerii to osobna decyzja (Na później).

**Patrole i posterunki** (trasy po ticku, sekcja 3):
- **P1 (hala):** pętla (2511; 418) → (2546; 418) → (2546; 431) → (2511; 431) → (2511; 418), ok. 96 m, czyli 1,4 m/s plus 4 postoje po 4 s, ok. 85 s. Co drugie okrążenie zbacza korytarzem N do drzwi serwerowni N (+40 m).
- **P2 (antresola):** od schodów zachodnich (2502; 435; +5,5) do (2558; 435; +5,5) i z powrotem, ok. 90 s, postoje przy oknie nad komorą i nad linią.
- **P3 (obwód, para):** (2490; 394) → (2604; 394) → (2604; 450) → (2490; 450), ok. 340 m, ok. 4 min.
- **Posterunki:** kabina wieży (obserwator: `tessen_sniper` z profilem wzroku 40 m, przed alarmem nie strzela), śluza wagonowa (1), wartownia (2), zbrojownia S (2 plus kwatermistrz-egzekutor), plac odbioru (1, od 05:00 +2).
- **Kamery:** dach N (2530; 440; +11,5) i (2556; 440; +11,5), serwerownia N, zbrojownia S, furtka.
- **Personel:** technicy, 6 na zmianie dziennej (6–18) i 3 na nocnej, po trasach produkcji z harmonogramu ADR-0017 (magazyn S, stanowiska, kalibracja, wrota komory). Kierownik zmiany na antresoli.

**Widok na Stare Miasto i Zamek:** Zamek leży ok. 1,7 km na zachód, a mgła (0,0115 w nocy) i płaszczyzna 320 m go ukrywają. Sylwetki Zamku z Donżonem, Katedry, Wieży Trynitarskiej i Bramy Krakowskiej wchodzą jako ciała do istniejących impostorów skyline (ADR-0051). Wysokości bierzemy z budynków mapy, mgłę liczymy z prawdziwej odległości. Sylwetki rysujemy tylko, gdy oko jest dalej niż 600 m od pierwowzoru, więc nie dublują prawdziwych brył. Nie ma nowego wywołania. Punkty widoku:
- z kładki OSM (2462; 421) na wschód: brama, wieża po lewej, kompozycja jak na grafice 01;
- z pomostu (2470; 430) na zachód i południowy zachód: zakole i panorama.

**Zmiany terenu i wycięć:**
- `CLEARED` (nawierzchnie): {x 2486..2606, z 392..452} i {x 2479..2486, z 414..452}. Bez pasa publicznego i bez przyczółka kładki, bo kładka OSM ma zostać cała.
- `CLEARED_BUILDINGS`: te same prostokąty plus pas x 2476..2606, z 380..392 (w1354195809) i `CAR_WASH_AREA`.
- `PADS`: {x 2486..2606, z 380..452, y `W3_Y`, blend 6} oraz {x 2479..2486, z 392..452, y `W3_Y`, blend 1,5}. Węższe przejście nie podnosi koryta (x < 2477). Do tego basen {x 2520..2592, z 452..478, y −3, blend 1,5}: północna krawędź z przejściem kończy się na 479,5, wewnątrz siatki (maxZ 480).
- Wycięcia pod piwnicę i kolektor (wnętrza w ziemi).
- `DOCKS_AREA` i `DOCKS_BASIN` zostają jako nazwy przestarzałe tylko w migracji, a w treści zastępują je `W3_*`.
- Skośny brzeg między wieżą a basenem ((2483; 446) → (2500; 463)) dostaje schodkowe nabrzeże z trzech brył albo skarpę z płotem 2,7 m. Wybór zapada w etapie 1 z pomiarem skanu.
- T-002 w `docs/topografia.md` dostaje nowe prostokąty, pomost nad wodą, przycięty basen i ścieżkę nadrzeczną, która urywa się na przyczółku kładki. Zmiana idzie do przeglądu kuratora.

#### Wariant B „Przy basenie” (bliżej dzisiejszej sceny)
- Hala z osią N–S, skrócona do 44 × 56 m: x 2536..2580, z 392..448. Śluzy i brama na północ, na plac odbioru z 448..460. Komora testowa na południu.
- Wieża x 2524..2534, z 448..458. Pomost w basenie x 2548..2560, z 460..472. Rurociąg nad zakolem x 2466..2524, z 456..458. Basen x 2520..2594, z 460..478.
- `CLEARED` jak dziś plus 2 m. Kładka OSM i ścieżka nadrzeczna bez zmian. Nie ma półki ani kolektora od rzeki, więc droga cicha ma tylko wariant „rury i dach”.
- Zalety: najmniejsza zmiana terenu i koryta. Wady: brama patrzy na basen, a punkt widoku z grafiki 01 (przez wodę na bramę) wypada na z > 480, poza siatką. Linia jest krótsza o 12 m i ma tylko jedną drogę cichą.

### 3. Systemy: co nowe, a co z istniejących
**Bez zmian, tylko nowe dane:** stożek, podejrzenie i słuch (ADR-0069), obezwładnienie i chwyt (ADR-0065, ADR-0075, z nowymi kryjówkami), przebranie `tessen_staff` z egzekutorem (kierownik zmiany; strefy zakazane: serwerownie, zbrojownie, wieża), kamery i quickhacki, breach, snajper (nowe stanowiska), alarm kontraktu z `spawnWaiting`, drzwi z kodem, haki, `INTERIORS` (`w3-hala`, `w3-piwnica`) z ambience. Autozapis działa przy wejściu do metra i przy przyjęciu zlecenia, wewnątrz strefy nie.

**Nowe:**
1. **Kontrakt `sabotage`:** droga (`route`), upload z pauzą, ładunki, zapalnik, wyjście zauważone, termin. System `sabotage-system.ts` w `sim/systems`.
2. **Ładunki i wybuch:**
   - Przedmiot fabularny `w3_charge` i interakcja `charge-site` na stanowiskach.
   - Wybuch: obrażenia w promieniu z linią wzroku, wraki stanowisk z flag `w3:station:<id>:down` (treść czyta flagi przy wczytaniu, jak flagi martwych).
3. **Wirus:** terminal z rolą `virus` (wariant `terminal`), upload bez fali, z pauzą.
4. **Lockdown:** nowy rodzaj zamka drzwi `{ kind: "alarm" }`: zamknięte i zablokowane, póki trwa flaga alarmu kontraktu.
5. **Patrol po trasie:** `ContractPost.route?: readonly Vec3[]` i komponent `ai.route`.
   - Cel na trasie wynika z ticka i fazy, jak `ai.watch`. Postoje z rozglądaniem.
   - Po tropie albo podejrzeniu strażnik wraca na najbliższy odcinek, bez własnego stanu w zapisie (jak eskorta).
   - Zastępuje posterunek wszędzie, gdzie trasa jest podana. Patrole Hebi z harmonogramów zostają.
6. **Personel jako świadkowie zlecenia:** technik, który widzi Seki z bronią, w strefie zakazanej albo bez przebrania na linii, po 2 s zgłasza to (jak cywil dzwoniący, ADR-0029). Zgłoszenie podnosi **alarm kontraktu**, nie heat. Technika można obezwładnić, a w walce ucieka. Ciało znalezione przez patrol to alarm: istniejący `body-watch`, do sprawdzenia dla Tessen w etapie 3.
7. **Pościg Tessen w mieście:**
   - Flaga `tessen-hunt:<dzień końca>` przez 3 dni gry, na końcu drogi głośnej.
   - Przy wejściu do dzystryktu i co 6 h gry w nim losowanie (`RandomPort`, podstrumień z dnia i dystryktu) daje oddział 2–3 `tessen_guard`. Pojawia się na punkcie ulicy co najmniej 45 m od gracza, poza kadrem, z tropem na gracza.
   - Najwyżej jeden oddział naraz, nigdy bliżej niż 60 m od kliniki. Postawa jest wroga, bo reputacja ≤ −50.
   - Wykupienie u Genzō zostaje na później.
8. **Renderer:**
   - Tryb wnętrza: gdy oko jest w obszarze `w3-hala`, siatki miasta (teren, nawierzchnie, budynki, meble, skyline) wyłączają się, poza klinem widocznym przez otwartą bramę.
   - Siatki hali pieczone z tych samych stałych `@seki/sim`, jak `alchemia-view.ts`.
   - Animacja linii z zegara renderera (ramiona, korpusy na taśmach, most suwnicy). Ta animacja jest kosmetyczna, `sim` jej nie zna.
   - Sylwetki panoramy.
9. **Dźwięk:** syrena (pętla przy alarmie), wybuch, podkładanie ładunku, koniec uploadu, pogłos i ambience hali.

**Granice pakietów (ADR-0031: pliki do 500 linii, funkcje do 120):**
- `core`:
  - rodzaj `sabotage` w `contracts/kinds.ts` (giver `genzo`), pola kontraktu, `ContractFailure` `batch-shipped`, miejsce `w3_hall` w `CONTRACT_SITES`;
  - stałe `SABOTAGE` (upload, podkładanie, zapalnik, promień, obrażenia), reguły reputacji i pościgu (czyste funkcje);
  - przedmioty `w3_virus` i `w3_charge`, profil wzroku `tessen_sniper` (40 m), test balansu.
- `sim`:
  - `content/tessen-w3/` z plikami `site.ts`, `hall.ts`, `rows.ts`, `tower-pipes.ts`, `quay.ts`, `basement.ts`, `nav.ts`, `posts.ts`, `patrols.ts`, `mission.ts`;
  - `lublin/sites.ts` (prostokąty, `CLEARED`, `PADS`), `cleared-buildings.ts`, `world-map.ts` (`W3_NAV` zamiast `DOKI_NAV`);
  - systemy `sabotage-system.ts`, `tessen-hunt-system.ts`, `explosion.ts`, AI `systems/ai/route.ts` (właściciel AI/NPC);
  - `district-doki.ts` usunięty, a co zostaje, przechodzi do `tessen-w3/`.
- `engine`: `renderer/tessen-w3/` (`shell-geometry.ts`, `interior-geometry.ts`, `line-anim.ts`, `w3-view.ts`), tryb wnętrza w `mapcity`, efekt `explosion`, światło alarmu, ciała panoramy w `skyline-layout-data`, dźwięki w `engine/src/audio`.
- `narrative`: knoty `genzo_w3_*` w `m4-doki.ink`, `phone_genzo_w3_*` w `phone.ink`, `enc_w3_smoker` w `enc-doki.ink`, oba języki (en, pl).
- `ui`: cele obu dróg w trackerze, pasek uploadu (jak włamanie), licznik ładunków i zapalnik, baner lockdownu, znacznik pościgu Tessen przy HUD heatu. Klucze w `ui/src/i18n/en` i `pl`.
- `app`: podpięcie interakcji i zdarzeń w presenterach, `place(frame: "w3", …)` w debug API, sceny perf, testy sesji.
- `persistence`: walidacja i migracje.

**Zmiany kontraktów (właściciel: Architekt):**
- `core/src/contracts`:
  - `Contract.route?: "quiet" | "loud"`, `charges?: readonly string[]`, `fuseTick?: number`, `seenLeaving?: true`;
  - `progress` opisane ogólnie (ticki uploadu albo włamania), `deadlineTick` użyte ponownie;
  - `ContractFailure` + `"batch-shipped"`.
- `core/src/events`:
  - `SabotageRouteChosen { contract, route }`;
  - `VirusUploadChanged { contract, progress, paused }`;
  - `ChargePlanted { contract, station, planted, needed }`;
  - `ChargesDetonated { contract, stations, at }`;
  - `FacilityLockdown { site, locked }`;
  - `TessenHuntChanged { active, untilTick }`.
- `core/src/ports/types.ts`: `EffectDescriptor` + `{ kind: "explosion"; at; radius }` i `{ kind: "alarm-light"; active }`, `AudioCue` + `"explosion" | "alarm-siren" | "charge-plant" | "upload-done"`. Nowego rodzaju widoku nie ma: hala jest pieczona w engine, stanowiska i wraki to zwykłe `block`.
- `core/src/commands`: **bez nowych komend**. Drogę wybiera się czynami, detonacja jest automatyczna, podkładanie i upload idą przez interakcję (`InputFrame`).

**Zapis:**
- **Etap 1:** `SAVE_SCHEMA_VERSION` podnosimy do następnego wolnego numeru w chwili scalenia (dziś 38, ADR-0081 rezerwuje 39, więc prawdopodobnie 40). Migracja:
  - gracz w obrysie starych doków (dach magazynu, suwnica, molo) trafia na pas publiczny przy metrze (2527; 384), twarzą na północ;
  - migawki bytów z kluczami starych posterunków, eskorty i snajpera (`EntitySnapshot.sniper`) znikają i wracają z treści;
  - ciała ukryte w starym kontenerze i śmietniku leżą na pasie publicznym;
  - aktywny `docks_escort` jest anulowany bez kary, z flagą `w3:escort-retired` dla kwestii Genzō;
  - `infiltrate` i `hack` zostają, ich miejsca przesunięte.
- **Etap 3:** wersja +1 dla pól `sabotage` i walidacji. Flagi pościgu i stanowisk to zwykłe flagi.
- Każda migracja ma test wczytania zapisu poprzedniej wersji w `persistence` i w teście sesji.

**i18n (ADR-0056):**
- klucze `contract.kind.sabotage`, `contract.failure.batch-shipped`;
- cele `objective.w3.*` (dotrzyj do serwerowni, wgraj wirusa, wyjdź niezauważona, weź ładunki, podłóż ładunki, uciekaj);
- podpowiedzi `prompt.upload-virus`, `prompt.plant-charge`, `prompt.vent-hatch`, `prompt.culvert`;
- notatki `hook.w3.*`, `hud.lockdown`, `hud.tessen-hunt`, nazwy wnętrz `interior.w3-*`, przedmioty `item.w3_virus`, `item.w3_charge`.
- Wszystko w en i pl, polski katalog zmienia się świadomie, baza `i18n-scan` nie rośnie. Napisy na bryłach (TESSEN, SEKTOR W-3, ZAKŁADY MILITARNE, ŚCIŚLE TAJNE) to nazwy własne w teksturze. Godło jest własne, bez herbu państwowego.

### 4. Wydajność
**Zasada:**
- Wszystkie bryły hali w `sim` są bez widoku (jak budynki mapy). Renderer piecze je w kilka siatek na materiale kitu, z kreską z G-bufora.
- Wnętrza nie mają cienia księżyca. Dwie lampy punktowe i emisja pasów, jak w ADR-0074.
- Osobnej sceny Babylona dla wnętrza nie robimy. Symulacja i kamera są ciągłe: brama, strzały słychać na zewnątrz, ucieczka przez bramę. Ten sam zysk daje tryb wnętrza, który wyłącza siatki miasta.

| Element | Wywołania (High / low) | Trójkąty High / low | Kiedy włączony |
|---|---|---|---|
| Skorupa (hala, rzędy, wieża, rury, pomost, nabrzeże, płot) | 2 (+ cień na High) / 2 | ≤ 45 tys. / ≤ 25 tys. (LOD: attyki i rury jako bryły) | do 400 m |
| Szkło, światła, neon TESSEN (litery jak ALCHEMIA) | 2 (+ glow High) / 1 | ≤ 6 tys. | do 400 m |
| Wnętrze statyczne (pokoje, antresola, taśmy, regały, szafy) | 2 / 2 | ≤ 60 tys. / ≤ 35 tys. | w środku, do 30 m od ścian, w klinie bramy do 60 m |
| Ruch linii (8 ramion, 6 korpusów, most suwnicy) | 2 / 1 | ≤ 25 tys. / ≤ 12 tys. (na low ramiona stoją) | jak wnętrze |
| Rekwizyty placów (ciężarówki, wóz, zapory, skrzynie) | 0 (siatki bloków mebli i parkowanych aut, ADR-0050) | ≤ 40 tys. | jak meble |
| Panorama Stare Miasto i Zamek | 0 (siatki skyline) | ≤ 3 tys. | oko dalej niż 600 m od pierwowzoru |
| Postacie | ok. 22 wywołania na ubraną postać (scena `models`) | do zmierzenia w etapie 1 | limit: najwyżej 10 Tessen w hali naraz, LOD ADR-0076 |

**Budżety telefonu (low, 800 × 370):**
- zewnątrz (kładka, noc): ≤ 120 wywołań, ≤ 80 siatek, ≤ 700 tys. trójkątów;
- hala: ≤ 100 wywołań, ≤ 60 siatek, ≤ 600 tys. trójkątów.

Zapas do bramki 1,2 mln z #575 jest na walkę, wybuch i fale. Na High (Xiaomi 15T Pro, ADR-0079) bramką jest mediana czasu klatki ≤ 16,7 ms i p95 ≤ 25 ms z co najmniej 3 przebiegów skryptu pomiaru telefonu. Pojedynczy pomiar to szum (zob. Kontekst).

**`tools/perf-budgets.json`:**
- `w3-zewnatrz` zastępuje `nabrzeze` w etapie 1: kamera na kładce (2462; 421) patrzy na wschód, w nocy, chunki `nabrzeze-0-1` i `nabrzeze-1-1`.
- `w3-hala` w etapie 2: oko na alei przy śluzie (2512; 418), patrzy na wschód na komorę.
- `phone-w3-hala` w etapie 2: low, dotyk, z `activeTriangles`.
- Budżet to pomiar plus kilka procent, w PR-ze, który scenę wprowadza. Opis zmian w `$comment`.
- Skrypt pomiaru telefonu (APK) dostaje sceny `w3:zewnatrz`, `w3:hala` i od etapu 3 `w3:walka` (8 wrogów i wybuch).

**Ładowanie (ADR-0057):** przy odjeździe metra na Nabrzeże `RenderPort.prepare` przygotowuje siatki W-3, shadery wybuchu i syreny oraz modele obsady Tessen. Nowego ekranu nie ma: wystarcza czas przejazdu.

## Korekty kuratora przed etapem 1 (audyt 15.11)
Audyt miejsca: [`docs/plany/tessen-w3-audyt.md`](../plany/tessen-w3-audyt.md), nakładka [`05-korekty-kuratora.png`](../world/koncepty/tessen-w3/05-korekty-kuratora.png), wpis T-002. Werdykt: teren i hala pasują, ale płot, pady i nabrzeże w prostokątach z sekcji „Decyzja” rozmijają się z prawdziwym brzegiem. Etap 1 buduje według korekt P1–P13 z audytu, które mają pierwszeństwo przed liczbami wyżej. Najważniejsze:
- kładka OSM to zabytkowy most Lutosławskiego (1908), pokład +1,8; woda na −2,0 (NMT −30,6), a nie −1,3;
- strefa to łęg (las łęgowy, OSM natural=wood); wycięcie 32 drzew i rowu w995914397 jest celowe i dostaje wpis T (P13);
- płot 3 m na NE od ścieżki w972606056, hala ze ściętym narożnikiem SW albo 10 m na wschód (P1); bez padu na pasie publicznym, od tarasu blend ≤ 1 i mur oporowy (P2);
- nabrzeże tylko z 418,5..440 ze ścianą ok. 1,3 m, gdzie indziej skarpa z płotem (P3, P4, P11); naturalna ława x 2457..2466 zamiast półki (P5);
- kolektor x 2466..2514 (P6); pomost z 426..438, płot ≥ 2,7 m nad pokładem mostu (P7); basen x 2508..2592 (P9); wieża z 436..446 (P10).
- Skyline: z kładki i pomostu Stare Miasto (Katedra, Trynitarska, Brama Krakowska) zasłania zabudowa 8–12 m; Zamek wystaje ok. 0,2°. Rekomendacja kuratora: sylwetka tylko grupy zamkowej, Stare Miasto wyłącznie jako licencja z wpisem T. Decyzja na zrzutach etapu 1.

## Etapy (osobne PR-y)
Przed etapem 1 kurator robi audyt miejsca: ortofoto, wysokość pokładu kładki OSM nad półką, skarpa i woda przy x 2475..2479, skośny brzeg przy wieży. Każdy etap:
- ma testy sesji bez renderera (ADR-0046: `freeze` + `step`, fałszywy `RenderPort`);
- musi przejść bramki: typecheck, lint, depcheck, testy dotkniętych pakietów, determinizm, skan bez nowych miejsc i perf;
- kończy się zrzutami z modelami (`SHOT_MODELS=on`, `SHOT_HOUR=13` i noc) przed i po.

1. **Teren i bryły:**
   - Zakres: `W3_*`, `CLEARED`, `PADS`, basen, nabrzeże, półka, pomost, rurociąg, wieża, skorupa hali (brama zamknięta), płot, pas publiczny, Genzō przy KAIUN, panorama. Usunięcie placu kontenerowego, magazynu, biura, suwnicy, mola i barki. Infiltracja w wieży, włamanie na nabrzeżu, eskorta wycofana. Migracja zapisu.
   - Testy `sim`, `w3-site.test.ts`:
     - płyta poziomo ±0,05, dno basenu −3, basen połączony z korytem i w siatce;
     - koryto x < 2477 bez zmian wysokości względem NMT, kładka OSM cała;
     - żaden budynek mapy w strefie;
     - graf: metro → Genzō → furtka, kładka → zachodni brzeg → drabina rurociągu;
     - stealth i perki skradania przeniesione na W-3 z tym samym znaczeniem.
   - Testy `app`, `w3-site-session.test.ts`: metro, Genzō, infiltracja w wieży, włamanie na nabrzeżu, wczytanie zapisu poprzedniej wersji stojącego na dachu starego magazynu.
   - Bramki: `map-ground-golden` i `ground-cut` zmienione świadomie, `orto:diff`, przegląd kuratora T-002, `w3-zewnatrz`, `phone-low` bez zmian.
   - Zrzuty:
     - z kładki na bramę (jak grafika 01), noc i 13:00;
     - z pomostu na zachód (zakole i panorama);
     - z pasa przy metrze na furtkę, zbrojownię i wieżę;
     - z zachodniego brzegu na rurociąg;
     - z góry nad strefą.
2. **Wnętrze hali i osłony:**
   - Zakres: pomieszczenia z grafiki 03, antresola, piwnica, kolektor, dachy z agregatami, drzwi (kody i zamek `alarm` przygotowany), `W3_NAV` (parter, antresola, piwnica, dachy +10,4, wieża, rurociąg i tor suwnicy tylko dla gracza), `INTERIORS`, tryb wnętrza, siatki wnętrza i linii (animacja).
   - Testy:
     - każdy pokój osiągalny, piwnica ma co najmniej 2 wyjścia (`underground-level-exit`);
     - tabela linii wzroku z sekcji 2 na `rayGeometry`;
     - z dachu nie da się zeskoczyć za płot, z rurociągu nie da się wejść na dach +16;
     - kucanie przechodzi kolektor.
   - Perf: `w3-hala`, `phone-w3-hala`.
   - Zrzuty:
     - aleja ku komorze;
     - stanowisko S2 z bliska;
     - galeria antresoli nad linią;
     - serwerownia N, zbrojownia S;
     - piwnica z wylotem kolektora;
     - dach N z wieżą;
     - telefon low w hali.
3. **Przebieg misji i AI.** Jeśli PR będzie za duży, dzielimy go na 3a (droga cicha, patrole, personel) i 3b (droga głośna, wybuch, pościg).
   - Zakres: kontrakt, wirus, ładunki, wybuch, lockdown, patrole po trasie, personel, posterunki, fale, obserwator i snajper, haki, ink en i pl, HUD, pościg, zapis +1, test balansu.
   - Testy sesji:
     - (a) cicha przez kolektor w przebraniu: wynik `completed`, `route: quiet`, Tessen bez zmian;
     - (b) cicha przez rurociąg i dach z `reboot_optics`;
     - (c) głośna: Tessen ≤ −50, pościg aktywny, oddział na Starym Mieście w ciągu dnia;
     - (d) alarm w trakcie uploadu, lockdown, przejście na głośną;
     - (e) 06:00 daje `batch-shipped`;
     - (f) zapis i odczyt w trakcie uploadu, przy 2 ładunkach i przy biegnącym zapalniku: ten sam hash stanu co bez zapisu;
     - (g) patrol po 10 000 krokach z zapisem w połowie w tym samym miejscu.
   - Bramki: determinizm (hash zmieniony tylko wersją), test balansu, `i18n-scan`.
   - Zrzuty:
     - HUD z celami obu dróg;
     - upload w serwerowni;
     - podkładanie ładunku;
     - alarm z czerwonym światłem;
     - wybuch;
     - mapa z trasami patroli (hak);
     - oddział Tessen w mieście.
4. **Warstwa 2077 i dźwięk:**
   - Zakres: neon TESSEN, czerwona kabina, napisy, pasy bezpieczeństwa, paleta z grafiki 04, para z rur, reflektory, iskry spawania (cząsteczki na High), drony stojące na dachu i na linii jako rekwizyty (bez AI), komplet dźwięków.
   - Testy: migawka NPR obejrzana, wszystkie sceny perf, pomiar telefonu użytkownika z bramką ms.
   - Zrzuty: zestawienie obok grafik 01 i 02 (te same kadry), telefon High i low.

## Etap 3a: zmiany kontraktów i decyzje (16.11)
- **Kontrakty dodane w etapie 3a:**
  - efekt renderera `line-screens` i typ `LineScreens` w `core/ports/types.ts` (stan ekranów stanowisk i rdzenia: bez misji, upload, po wirusie);
  - rodzaj haka `sabotage` w `HookContractKind` (`core/world/wave2.ts`).
  Granice pakietów się nie zmieniają, a stan misji idzie do renderera tylko przez `RenderPort`.
- **Decyzje użytkownika z 16.11:**
  - wyjątek sabotażu w bilansie wave1 przyjęty. Pilnuje go test dochodu na minutę, liczący nagrodę, premię i styl;
  - pasmo poziomu kontraktu 10–30;
  - kamera serwerowni N ma martwy kąt przy terminalu od strony szafy, a `reboot_optics` oślepia ją w tej misji na 30 s. Cicha droga ma być wykonalna bez ICEpick.
- **Zapis v40:** pola `route` i `seenLeaving` oraz efekty quickhacków (G-882), żeby wczytanie przy oślepionej kamerze nie podnosiło alarmu.
- **Przeniesione do 3b razem z drogą głośną:** świadkowie z personelu (technicy) oraz zdarzenia `VirusUploadChanged` i `SabotageRouteChosen`. Do czasu 3b alarm przed wgraniem wirusa kończy zlecenie porażką o 06:00.

## Balans
Stawki przy neutralnej reputacji u fixerów, przed mnożnikiem Genzō:

| Wynik | Stawka €$ | Reputacja | XP (ADR-0059) | Czas (szac., z dojściem) |
|---|---|---|---|---|
| Cicha, wyjście niezauważone | 2400 (+300 za „bez ofiar”) | fixerzy +5, Tessen 0 | 900 | ok. 11 min |
| Cicha, wyjście zauważone | 1700 | fixerzy +3, Tessen −20 (bez pościgu) | 750 | ok. 11 min |
| Głośna (także po przejściu z cichej) | 1400 + zawartość zbrojowni (ok. 450 €$ w łupie) | fixerzy +3, Tessen do min(obecna, −60), cywile −2, pościg 3 dni | 700 + zabici | ok. 8 min |
| Porażka (`batch-shipped`) | 0 | fixerzy −4, Tessen −10, jeśli był alarm | 0 | — |

- **Dochód na minutę:** cicha 2400 / 11 ≈ 218 €$/min, głośna (1400 + 450) / 8 ≈ 230 €$/min minus amunicja i apteczki. Obie mieszczą się w paśmie ok. 215–220 z ADR-0018 i ADR-0024. Pilnuje tego `core/test/w3-balance.test.ts` albo rozszerzony `m4-balance.test.ts`.
- **Poziom:** pasmo Nabrzeża to 16–30 (ADR-0059). Rekomenduję pasmo W-3 10–30 i zapis startowy wycinka na poziomie 12 (pytanie 3).
- **Liczby czasu:** upload 40 s (25 s z breachem), ładunek 2,5 s, zapalnik 60 s, wybuch 60 obrażeń w 10 m, druga fala po 60 s. Wszystkie są startowe, stroi je etap 8 ADR-0059 bez nowego ADR-u.

## Konsekwencje
- Doki tracą plac kontenerowy, magazyn, biuro, suwnicę i molo. Znikają `DOKI_NAV`, `SNIPER_PERCHES`, `ESCORT_ROUTE` i posterunki. Około 25 plików testów trzeba przenieść na W-3 z tym samym znaczeniem (skradanie, perki, zapis włamania, uśpienie dalekich), bez osłabiania asercji.
- Spotkania doków (`doki_laidoff`, `doki_gull`, `doki_container`) dostają nowe punkty na pasie publicznym i nabrzeżu. Tłum i miejsca aktywności (`crowd.ts`, `activity-spots.ts`, `devices.ts`) przechodzą na `W3_*`.
- Ścieżka nadrzeczna na wschodnim brzegu kończy się na przyczółku kładki. Kładka OSM zostaje cała, a pomost i rurociąg zajmują część koryta. Wszystko to opisuje T-002.
- Wycinek jest jednorazowy. Po nim Genzō wraca do infiltracji i włamania w nowych miejscach.
- Tessen po raz pierwszy pojawia się poza dokami (pościg), więc testy dzielnic z wrogim Tessen dostają nowe przypadki.

## Ryzyka
- **Postacie w hali:** z modelami to ok. 22 wywołania na ubraną postać, więc 10 osób i fala może przekroczyć budżet telefonu. Środki: limit 10 Tessen naraz, LOD ADR-0076, technicy daleko we wspólnej siatce tłumu. Pomiar w etapie 1, przed budową wnętrza.
- **Brzeg:** półka, kolektor i pomost przy wodzie z mapy oraz skośny brzeg przy wieży mogą dać nowe glitche terenu (uskoki, woda pod płytą). Środki: audyt kuratora przed etapem 1 i skan bez nowych miejsc.
- **Kolektor 1,6 m:** jeśli kapsuła w kucaniu się nie mieści, kolektor rośnie do 1,8 m i podłoga piwnicy schodzi niżej.
- **Zakres etapu 3:** największy ze wszystkich, w razie potrzeby podział 3a i 3b.

## Na później
- Drony bojowe i łodzie (wariant B wycinka): start z komory testowej, pościg po Bystrzycy, eskorta Miki łodzią.
- Okna przezierne dla wzroku (galeria, komora), pływanie zamiast niewidocznej kolizji nad wodą.
- Wykupienie pościgu u Genzō, zbrojownia N i drugi rdzeń w serwerowni S jako trudniejszy wariant, cukrownia jako drugi obiekt nad Bystrzycą.
- Wnętrze wieży powyżej podestu (kabina jako miejsce walki), otwierany dach komory.

## Pytania do użytkownika
1. Ustawienie hal: wariant A „Brama nad korytem” (rekomendowany) czy B „Przy basenie”?
2. Zleceniodawca: Genzō jako pośrednik (rekomendowane) czy nowa postać?
3. Od jakiego poziomu gramy wycinek? Rekomenduję zapis startowy na poziomie 12 i pasmo W-3 10–30 (dziś Nabrzeże ma 16–30).
4. Widok na Zamek i Stare Miasto jako sylwetki w panoramie: Zamek leży ok. 1,7 km na zachód, zasłania go mgła, a sylwetki kosztują 0 wywołań. Czy to wystarczy?
5. Wycofać eskortę Miki do czasu łodzi (rekomendowane)?
