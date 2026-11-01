# Backlog

Zadania zgłoszone, jeszcze niezaczęte. Kolejność to propozycja, nie zobowiązanie.

## Następne

- **Stan prac (31.10, 19:10, dla nowej sesji).** W main: #72 (G-067), #74 (G-061), #75 (ADR-0062 etap 1, Brama Krakowska), #76 (G-064), #77 (ADR-0063 etap 1, słupy i ekran „Autorzy”), #78 (ADR-0064 etap 1, dachy z OSM, zamyka G-056), #79 (ADR-0061 etap 1, obszary `INTERIORS` i autozapis przy wejściu). W toku u agentów (praca w worktree ginie z kontenerem, więc przy nowej sesji sprawdź gałęzie `ccr-ec2c4269-ilh8k8-*` i `worktree-agent-*` i zacznij od nowa to, czego nie ma w PR): G-052 (poszerzenie Krakowskiego o pas ok. 60 m) z poprawkami ruchu G-074/G-075, G-076/G-077 (przejazdy `tunnel=yes`, budynek podziemny na Zamkowej: w weryfikacji, potem kurator), G-058 (dotyk w kole dialogu), ADR-0063 etap 2 (panorama megacity). Następne w kolejce: przegląd kuratora obszarów `INTERIORS` po #79, ADR-0064 etapy 2–15, ADR-0063 etapy 3–4, okna wnętrz, glitche z audytu dróg G-081…G-087, plan wnętrz zabytków (`docs/plany/wnetrza-zabytkow.md`, czeka na akceptację użytkownika), G-073, audyt prześwitów. Decyzja użytkownika do zebrania: reguła 45° dla nadbudów przy zabytkach (T-011).

- **Kolejność: assety przed nowymi dzielnicami (decyzja użytkownika 1.11).** Najpierw assety z regułami rozstawienia z danych OSM (generatory `props-gen`, linie planu, `sign-plan`, `parked-cars`), bez list współrzędnych, żeby przeniosły się na nowe tereny przy `pnpm osm:build`; równolegle glitche rozstawienia. Nowe dzielnice dopiero, gdy: 1) skan ma bazę 0 dla rodzajów rozstawienia (`*-in-neighbour`, `parked-car-*`, `wall-lantern-*`); 2) audyt kuratora obecnych dzielnic bez nowych niezamierzonych odstępstw; 3) etapy assetów z planu (targ, drzwi, decale, pojazdy, drony, tłum) mają reguły i kontrole skanu. Wyjątek: teren dorysowujemy wcześniej, gdy asset potrzebuje brakującego typu terenu (nabrzeże, bloki, tory, przemysł). Rozszerzanie po jednej dzielnicy, każda zaczyna od przebiegu łowcy po istniejących regułach; gęstość i budżet rysowania (telefon) mierzymy przed zasięgiem.
- **Sieć trakcyjna trolejbusów z OSM (pomysł użytkownika 1.11, niski priorytet, na później).** Trolejbusy jeżdżą tam, gdzie OSM ma linie trakcji, a nad nimi wiszą przewody z napięciem; model trolejbusa ma już odbieraki (pręty), które powinny dotykać przewodów. Stan dziś: trasy trolejbusów w sim to ręczna lista ulic `TROLLEY_STREETS` (`packages/sim/src/content/traffic.ts:42`), nie dane; słupy trakcyjne (`trolley-pole`) stawia generator rekwizytów z tagu `trolley_wire=yes` na drogach (w danych 69 odcinków `yes`, 27 `no`), ale każdy słup ma tylko 14-metrowe kikuty przewodów (`trolleyPole` w `prop-street.ts`), bez ciągłej sieci; relacji `route=trolleybus` w danych nie ma (import ich nie pobiera). Do zrobienia: 1) trasy trolejbusów z danych (`trolley_wire=yes` albo relacje `route=trolleybus` w imporcie) zamiast listy ulic; 2) ciągłe przewody jezdne nad pasem trolejbusu, zawieszone na słupach, z wysokością zgodną z odbierakami modelu; 3) kontrola skanu: trolejbus poza siecią, przęsło bez słupa, przewód w budynku; 4) przegląd kuratora (zgodność z siecią MPK Lublin). Budżet rysowania: przewody jako jedna siatka na komórkę.
- **Holograficzna rekonstrukcja kościoła św. Michała na Placu po Farze (decyzja użytkownika 1.11, niski priorytet).** Na fundamentach fary (w173519315, (672,8; 43,2)) stanie holograficzna rekonstrukcja kościoła jako miejsce fabularne i uhonorowanie zabytku. Wnioski do ADR-u: fundamenty (G-053) wchodzą jako realna, niska bryła i podstawa hologramu, więc zarys placu zostaje rozpoznawalny; hologram to półprzezroczysta bryła kościoła (sylwetka gotycka z wieżą, z ikonografii przed rozbiórką w 1850), bez kolizji, z migotaniem i trybem bez błysków (ADR o dostępności); w nocy świeci, w dzień ledwo widoczny. Do ustalenia w ADR: skala i wierność rekonstrukcji (źródła ikonograficzne przez kuratora), rola fabularna (kto utrzymuje hologram, jakie wątki: Narrative), czy wnętrze (ADR-0061: hologramowe wnętrze jako scena), budżet rysowania (jedna siatka, materiał emisyjny), osie widokowe z Grodzkiej na Bramę Grodzką i Zamek (przegląd `topography-curator`, wpis celowego odstępstwa w `docs/topografia.md`, T-015).
- **Wierniejszy Zamek Lubelski z otoczeniem (prośba użytkownika 1.11, plan dla kuratora, niski priorytet).** Zamek to kanoniczne miejsce Lublina i ma być odwzorowany wierniej, razem z otoczeniem: placem pod zamkiem (Plac Zamkowy i podejście od Bramy Grodzkiej), schodami i rampą na wzgórze oraz pomnikami lwów przy schodach. Dziś: bryła z OSM (w48500136, 3 kondygnacje, 12,8 m) z Donżonem (w450180469, 26 m) i Kaplicą Trójcy (w66258167), brama bez neogotyckiego detalu (T-040), łuk kamienic Placu Zamkowego (T-028), ścieżki pod wzgórzem bez nawierzchni (T-050), Zamkowa nad tunelem (T-053), kandelabry na zgadywanych miejscach (T-005). Kolejność: 1) audyt kuratora całego zespołu zamkowego (OSM, NMT, ortofoto PZGiK, zdjęcia elewacji; lista odstępstw i braków: neogotycka fasada skrzydeł, wieżyczki, blanki, okna, kolor tynku, brama, schody i rampa, lwy, latarnie, nawierzchnia placu, zieleń skarpy); 2) ADR „zabytek wg przepisu” dla Zamku (jak ADR-0062 dla Bramy Krakowskiej i Ratusza: przepis fasady, detale, modele lwów); 3) etapy osobnymi PR-ami z przeglądem kuratora i migawką NPR. Powiązane: plan wnętrz (`docs/plany/wnetrza-zabytkow.md` §1.4: Zamek, Kaplica, Donżon jako miejsce aktu III). Krok 1 zrobiony 1.11: audyt i plan etapów Z0–Z6 z pytaniami do użytkownika w `docs/plany/zamek-lubelski.md` (T-112…T-118, G-203…G-207); Z0 (poprawki danych) może iść od razu.
- **Decyzja użytkownika (31.10, 20:45): samochody na później.** Dokończyć tylko prace w toku: G-090 (pas z lokalnej szerokości, w weryfikacji) i po nim G-082 (chodniki pod jezdnią, łatka gotowa). Odłożone bez terminu: G-074 i etap ADR-0055 (włączenia z pierwszeństwem), G-083 (drogi bez pasów), G-092 (dwa pasy na wąskich ulicach), G-093 (dziura na Narutowicza), ADR-0064 etap 6 (linie na przystankach). Agentów na nowe sprawy ruchu aut nie rozsyłać, dopóki użytkownik tego nie zmieni.
- **Ustawienia domyślne (decyzja użytkownika 1.11):** grafika High na każdym urządzeniu, liczby obrażeń przy trafieniu, przycisk Ustawienia na ekranie tytułowym; jednorazowa migracja starych wpisów ustawień (`rev: 2`); w main (#121).
- **Strategia testów (decyzja użytkownika 1.11):** w main (#119): `changelog.d`, e2e w CI tylko dla zmian w kodzie, szkic PR od razu po oddaniu pracy.
- **W main (1.11):** #120 ADR-0066 etap 1 (zapis v18), #121 ustawienia domyślne, #122 CI bez zbędnych minut, #123 megabloki ADR-0067 etap 1. #124 meble deptaka ADR-0058 etap 2 (trzy rundy weryfikacji i kuratora). **W PR-ach:** #125 G-143 (w weryfikacji), #126 dokumentacja z gałęzi sesji. Slot assetów po #124: targ, drzwi, decale, pojazdy, drony, tłum.
- **Sprzątanie god objectów (prośba użytkownika 1.11):** zapadka `tools/code-health` w main (#133) (klasy ponad 20 metod, baza tylko spada). Podziały, każdy osobnym PR-em bez zmiany zachowania (złote hashe, migawka NPR, budżety bez zmian), w kolejności korzyści: 1) `MapCity` 33 → 19, w main (#140; dalej: `MapEntries` ma publiczne modyfikowalne mapy, `MapCity` pisze `terrains` z pominięciem API, kandydat na `addTerrain`/`removeTerrain`); 2) `GameSession` 33 → 14, w main (#157); 3) `BabylonRenderer` 42 → 17, w main (#146) (części `MapCitySlot`, `WetAsphalt`, `RendererLoading`, `RendererStats`; dalej: gettery `RendererStats` bez odbiorców poza rendererem do wycięcia albo pod debug API); 4) `WorldStreamer` 21 → 13, w main (#141); 5) `CharacterViews` 24 → 20, w main (#163); 6) `ToonMaterials` 23 → 19, w main (#171); 7) `SynthAudio` 21 → 18, w main (#180); 8) `GangerAgent` 22 → 14, PR #177 (przyjęte, czeka na CI); zostaje `StreetProps` 22. Przy wolnym slocie jeden podział naraz w rendererze (ryzyko migawki), sim i app mogą iść równolegle.
- **Następne sloty (stan 1.11, 22:40, dla nowej sesji):** w main wieczorem: G-183 (#168), G-193 (#172), G-196 częściowo (#174), G-195 (#175), G-188 (#181, zapis v24), drzwi ADR-0058 etap 9 (#167), podziały `ToonMaterials` (#171) i `SynthAudio` (#180), dokumentacja (#173, #176, #178, #182). Przyjęte, czekają na zielone CI: podział `GangerAgent` (#177), G-194 (#179). W pracy: G-200 (pilne: test tabeli rekwizytów na granicy 20 s pod `--coverage` po #167; przyspieszenie generatora bez zmiany tabeli), decale ADR-0058 etap 6 (slot assetów), G-185 (stan strażników po wczytaniu), audyt kuratora Zamku (`docs/plany/zamek-lubelski.md`). Dalej, w kolejności: G-197 i G-198 (drzwi: Trasa Podziemna, wejście OSM; po G-200 i decalach, bo ten sam generator), G-201 (teren poza chunkami), G-196 reszta (ciała posiłków bez chunku), G-180 (zapis po śmierci), G-191 (gzymsy), G-192 (oś chodnika), G-175, G-176, G-181, G-186 (w przeglądarce); podział `StreetProps` (ostatni w bazie); etap 4 assetów (pojazdy); odsianie sąsiadów dla holo (`fitFlatSign`); pomysły użytkownika: sieć trakcyjna trolejbusów, holograficzna fara, wierniejszy Zamek (po audycie); G-150 czeka na miejsce od gracza; G-161 i G-162 później. Decyzja użytkownika 1.11 (zgodnie ze standardem gatunku): posiłki ochrony dają XP za quickhack raz na postać, jak strażnicy z kluczem; zadanie G-202, po scaleniu #179 (G-194, ten sam plik).
- **Kolejność po samochodach (orkiestrator, 31.10):** 1) ekran ładowania (ADR-0057, P0; etap 1 w main, #102; etap 2 odłożony: tło tytułu, PreviewStage, newGame po pierwszej klatce); 2) obezwładnienie bez zabijania (takedown, P0 dla ADR-0059; ADR-0065, 4 etapy; etap 1 w main, #100; etap 2 w main, #108; etap 3, niesienie i kryjówki, zapis v19, w main, #128 (dwie rundy weryfikacji); dalej etap 4: renderer (poza leżąca, na ramieniu) i XP/perki); 3) poziom trudności z presetami (P0 przed balansem ADR-0059; ADR-0066 zaakceptowany 1.11, etap 1 zbudowany (feat/difficulty-stage1, e9735dd; zapis v18; złote hashe Normalnego przepisane, bo snapshot ma nowe pole: dowód przez v17HashOf); weryfikacja 1: NIE PRZYJĘTE za brak testów snajpera i ścieżki z zapisu oraz HP ponad max po zmianie trudności; weryfikacja 2: wszystko pokryte poza dolnym przycięciem HP do 1, test dopisany przez orkiestratora z dowodem mutacji; w main, #120; etap 2, UI, w main, #139; dalej etap 3, wspomaganie); 4) ADR-0064 etap 4 (lokale i szyldy: parodie nazw z kolorami prawdziwych, decyzja użytkownika 31.10; odrzucony 1.11 dwa razy: za nazwy zbyt bliskie oryginałom, potem za motywy logo i tłumaczenia znaków (Złote Łuki, syrena, żubr, skarbonka); decyzja użytkownika 1.11: dalsze parodie, sieci bez różnicy jednej litery i bez słowa z marki, lokalne z nową nazwą 2077 zamiast prawdziwej z doklejką; ostateczne nazwy lokalne z charakterem (decyzja użytkownika 1.11); w main, #118) i paczka 2 assetów (ADR-0063; etap 1, meble ulicy, w main #106); 5) pozostałe etapy ADR-0062 (zabytki; etap 2 Brama Grodzka w main, #109; dalej G-136) i ADR-0064 (wejścia, oświetlenie) oraz okna wnętrz, w miarę wolnych slotów.
- **Stały slot assetów (decyzja użytkownika 1.11):** jeden z 4 slotów agentów zawsze buduje kolejny etap assetów, gdy się zwolni. Kolejność: ADR-0058 etap 2 (meble deptaka: bankomaty, hydranty, donice i rośliny, skutery i rowery) z uzupełnieniem z paczki 2 (E2: wózek z jedzeniem, kontener, mini-ATM), potem etap 3 (targ), etap 9 (drzwi, z E7 paczki 2), etap 6 (decale), etap 4 (pojazdy, z E5 paczki 2), etap 7 (drony, z E4), etap 8 (tłum); modele użytkownika najpierw, CC0 tam, gdzie brakuje. Każdy etap z pomiarem budżetów i migawką NPR. Źródła już pobrane w scratchpadzie sesji (giną z kontenerem, `tools/assets/fetch.mjs` pobierze je znowu): CC0 w `scratchpad/assets/` (m.in. `oga-pixelmannen-atms`, `oga-tiko-brick-planters`, `oga-tiko-vending`, `oga-lyricsz-bike`, `kenney-nature-kit`, `kenney-food-kit`, `kenney-mini-market`, `quaternius-posed-humans`, `quaternius-public-transport`, `ambientcg-decals`) i paczka 2 użytkownika w `scratchpad/assets2-fetch/` (27 modeli).
- **Megabloki wokół miasta (prośba użytkownika 31.10):** użytkownik wybrał wariant B (1.11), ADR-0067; prototyp na gałęzi `ccr-ec2c4269-ilh8k8-megabloki-proto` (1e1c85e); etap 1 zbudowany (gałąź `feat/megabloki-b`, 2a39dc8: 163 wieże, 148 kładek, 92 tys. trójkątów, 10,75 MB, budżety bez zmian); czeka na slot weryfikacji i przegląd kuratora (osie widokowe, T-056). Żaden wariant nie dodaje wywołań rysowania; B to 160 tys. trójkątów (dziś 12,9 tys.). Po wyborze: dane w stylu `MEGA_SITES`, ADR (rozszerzenie ADR-0051/0063), wpis w `docs/topografia.md`, przegląd kuratora. Do sprawdzenia łowcą: słup z sześcianów na Krakowskim (x≈405, z≈−88).

- **Plan z audytu luk (31.10, `docs/audyt-luk.md`).** Priorytety: P0 blokuje grę albo inne prace, P1 standard gatunku o dużym wpływie, P2 ważne później, P3 opcjonalne. Kolejność P0 i P1 według zależności:
  - **P0, teraz:**
    1. [gotowe, #56] Autozapis (po kroku zadania, kontrakcie, zmianie dzielnicy, co 5 minut) i zapis przy `visibilitychange`/`pagehide` na telefonie; wejście do lokalu z ADR-0061.
    2. Stabilne e2e (G-031, G-043) i ekran ładowania (ADR-0057). W toku.
    3. Języki: etapy 3–5 (ADR-0056). 3, 4 i 5 w main (#66, #63, #64); zostały resztki z listy niżej.
    4. Obezwładnienie bez zabijania, ogłuszenie, przenoszenie ciał (ADR do napisania). Koszt M. Musi być przed etapem 3 ADR-0059, bo drzewko Cień i XP za skradanie je zakładają.
    5. Poziom trudności z presetami wspomagania (ADR do napisania). Koszt M. Przed etapem 8 ADR-0059 (balans liczony dla „normalnego”).
    6. Rozwój postaci i skalowanie (ADR-0059): etap 1 w main (#53), etapy 2–8 do zrobienia.
    7. Celowanie na telefonie i padzie (wspomaganie, celowanie ze strzałem jednym kciukiem), z padem w tym samym ADR-ze.
  - **P1, potem:**
    1. Raportowanie błędów (`window.onerror`, `unhandledrejection`, utrata kontekstu WebGL) i widoczna wersja gry. Koszt S–M.
    2. Automatyczny dobór jakości, limit klatek, tryb baterii na telefonie. Po ADR-0057 i podziale renderera, z danymi z raportów błędów.
    3. AI walki: osłony, potem koordynacja grupy (flankowanie, tłumienie, wycofanie). Koszt L.
    4. Granaty i urządzenia rzucane (EMP, dym, flash). Po osłonach, przed etapem 4 ADR-0059.
    5. Nawigacja: własny znacznik i trasa GPS na minimapie i mapie (graf chodników z ADR-0041).
    6. Autorskie zadania poboczne z wyborami oraz akt III z epilogiem i ekranem końca. Po etapie 5 ADR-0056 i etapach 1 i 5 ADR-0059.
    7. Tanie opcje dostępności: suwaki szyn audio (muzyka, SFX, dialog, radio), wyłączenie kołysania i wstrząsów kamery, rozmiar napisów; pad w menu i dialogu.
    8. Samouczek w misji i podpowiedzi systemowe (heat, Breach, przebrania).
    9. Ikony przedmiotów i assety ubrań (już w planie), żywe miasto (ADR-0058, w toku), podział renderera (ADR-0031).
  - **P2:** szefowie, ragdoll i reakcje śmierci, większy arsenał (broń ciężka i inteligentna, blok NPC), patrole po trasie, zagrożenia środowiska i alternatywne wejścia, relacje z postaciami i widoczne konsekwencje wyborów, pogoda jako stan w `sim`, mieszkanie gracza, aktywności otwartego świata, osobne ustawienia grafiki, eksport zapisu, PWA/offline, odzywki walki.
  - **P3:** pojazdy prowadzone przez gracza (świadome cięcie przy metrze i mieście pieszym), kreator postaci, NG+, muzyka per dzielnica, osiągnięcia, tryb foto, kodeks, modowanie.
  - Łańcuch krytyczny: autozapis → obezwładnienie → trudność → ADR-0059 etapy 1–7 → osłony i AI → granaty → balans (ADR-0059 etap 8) → treść poboczna i akt III. Równolegle: i18n przed treścią; raporty błędów → jakość na telefonie.
- **Kolejność uzgodniona z użytkownikiem (31.10):** najpierw G-031 (niestabilne e2e), dokończenie języków, ekran ładowania i podział renderera; drobne glitche równolegle, po jednym w przerwach.
- **[w toku: etap 1 ADR-0058] Żywe, kolorowe miasto: znacznie więcej assetów CC0 z internetu.** Rozpoznanie: 33 paczki CC0 (Kenney, Quaternius, OpenGameArt, ambientCG). Rekwizyty ulicy (automaty, stragany, rośliny, skutery, ekrany), więcej pojazdów i elementów fasad, postacie tłumu, decale. Wpięcie przez `tools/city_kit.py` (wspólna paleta, jedna siatka na komórkę), z ADR-em i pomiarem budżetów (`tools/perf-budgets.json`).
- **[plan, 31.10] Celowanie na telefonie: wspomaganie i celowanie ze strzałem jednym kciukiem.** Dziś nie da się jednocześnie trzymać celowania i strzelać jednym palcem. Do ADR-u:
  - lekkie wspomaganie celowania tylko na dotyku: spowolnienie obrotu nad celem i delikatne przyciąganie przy wejściu w celowanie, wyłączalne w ustawieniach, bez wpływu na symulację (to warstwa wejścia: `engine/input`, pad dotykowy);
  - strzał z celowaniem bez drugiego palca, do wyboru po prototypie: przycisk strzału wchodzi w celowanie, gdy jest trzymany (fire = ADS + ogień), celowanie przełączane jednym tapnięciem (już w ustawieniach) z widocznym stanem, albo przeciągnięcie z przycisku strzału obraca widok (jak dziś `lookToo`);
  - testy: sesja bez renderera dla logiki wspomagania (deterministyczny cel, wejście z pada), e2e dotyku na telefonie.
- **[plan, 31.10] Assety ubrań i ekwipunku.** Odzież jest dziś proceduralna (hełm, wizjer, płyty kamizelki na kościach, ADR-0015 E7), a ekwipunek nie ma ikon. Do dodania jako etap ADR-0058 albo osobny ADR: modele CC0 ubrań i pancerza (kurtki, kamizelki, hełmy, maski) dopasowane do rigu VRoid i rigu proceduralnego, ikony przedmiotów w ekwipunku i sklepach (render modelu do atlasu ikon albo pakiet CC0), z tą samą zasadą licencji i budżetów.
- **[ADR-0059, 31.10] Skalowanie rozgrywki i łupów do postaci, z rozwojem postaci jako miarą.** Decyzja: atrybuty z drzewkami, 30 poziomów; osiem etapów w ADR-0059. Dziś łupy to stałe tabele z trzema rzadkościami o stałych mnożnikach (`core/items/rarity.ts`, `loot.ts`), a jedynym skalowaniem jest `ukończone kontrakty / 3` w składzie przeciwników (`contracts.ts`). Do ADR-u (propozycja):
  - **Poziom postaci (miara, „dyskryminator”)**: doświadczenie z zadań, kontraktów, walki, hackowania i skradania; poziom 1–N. Obok poziomu ulicznego reputacja frakcji z ADR-0011, która dalej otwiera sklepy i zlecenia.
  - **Rozwój**: punkty za poziom na kilka atrybutów albo drzewka umiejętności, które zmieniają sposób gry (broń palna, wręcz, hackowanie, skradanie, technika), oprócz istniejących wszczepów z perkami (ADR-0032, ADR-0033). Pojemność cyberware może rosnąć z poziomem.
  - **Poziom przedmiotu**: każdy łup dostaje poziom w paśmie wokół poziomu gracza i obszaru (dzielnica ma pasmo trudności), a statystyki skalują się z poziomem i rzadkością. Więcej progów rzadkości (np. epic, legendary) z cechami, nie tylko mnożnikiem.
  - **Łup dopasowany do postaci**: wagi tabel przesuwają się w stronę broni i stylu, którego gracz używa (rodzaj broni, umiejętności), z ochroną przed pechem (gwarantowany lepszy łup po serii słabych).
  - **Przeciwnicy i kontrakty**: poziom wroga z pasma dzielnicy i poziomu gracza; stawki, skład i nagrody kontraktów liczone z tego samego poziomu zamiast `ukończone / 3`.
  - Zasady: wszystko w `core` jako czyste funkcje z `RandomPort`, zmiana schematu zapisu z migracją (poziom, doświadczenie, poziom przedmiotów; stare przedmioty dostają poziom z ich rzadkości), złote hashe aktualizowane świadomie, teksty przez klucze (ADR-0056), balans testami symulacji (krzywa doświadczenia, rozkład łupów na poziomach).
- **[ADR-0058 etap 9, 31.10] Assety drzwi automatycznych i rozsuwanych.** Dziś skrzydła drzwi to proceduralne bryły (ADR-0038). Modele CC0 (Quaternius Cyberpunk `Door`, elementy sci-fi Kenneya): przeszklone drzwi sklepu, drzwi pancerne na kod, rolety, panele z diodą stanu zamka. Podmiana wyglądu bez zmian w symulacji.
- **[gotowe, #79] [ADR-0061, 31.10] Zdarzenie wejścia do lokalu pod autozapis.** Autozapis (#56, w main) zapisuje dziś przy zmianie dzielnicy zamiast przy wejściu do lokalu, bo takiego zdarzenia nie ma. ADR-0061: obszary `INTERIORS`, zdarzenia `InteriorEntered`/`InteriorLeft`, autozapis przy wejściu; to samo zdarzenie posłuży pogłosowi i otoczeniu (ADR-0060). Po merge'u autozapisu.
- **[ADR-0060, 31.10] Głosy postaci i bohaterki oraz rozbudowa dźwięku.** Decyzje: całość z TTS (bez aktorów), VO po angielsku z napisami en/pl, wyzwalacze kwestii (interakcja, zaczepki, zasłyszane rozmowy NPC); sześć etapów w ADR-0060. Dziś gra nie ma dialogów mówionych (VO): są napisy i syntezowane „głosy” efektów (`engine/src/audio/synth-voices.ts`), a SFX to nagrania CC0 i synteza (`app/public/audio`, ADR-0013). W audycie VO było P3; użytkownik podnosi je do planu. Do ADR-u:
  - **Zakres głosów, od najtańszego:**
    1. odzywki (barki) w walce, skradaniu i tłumie: wrogowie, cywile, Seki (ok. 20–40 linii na typ postaci);
    2. kluczowe linie wątku głównego (powitania, zwroty akcji, zakończenia aktów);
    3. pełne dialogi postaci nazwanych (Kaito, Mori, Ume, Hana, Genzō…) i Seki.
  - **Źródło głosów** (licencja musi pozwalać na dystrybucję w grze; zapis źródła i licencji w README katalogu jak przy assetach):
    - nagrania aktorów;
    - syntezowanie przez otwarty TTS na licencji pozwalającej na użycie komercyjne (każdy głos sprawdzony osobno);
    - mieszane: TTS na odzywki, aktorzy na główne linie.
  - **Języki (ADR-0056):** VO po angielsku z napisami w obu językach, albo w obu językach. Struktura ink z `#voice:` jako tagiem linii, a pliki audio według klucza linii i języka.
  - **Technika:**
    - odtwarzanie przez `AudioPort` i szynę dialogu (suwak w opcjach z audytu);
    - ściszanie muzyki pod mową;
    - przestrzenne odzywki w świecie;
    - kompresja OGG/Opus;
    - ładowanie strumieniowe, nie na starcie;
    - budżet rozmiaru dla telefonu.
  - **Dźwięki:**
    - kroki według nawierzchni (bruk, asfalt, metal, kałuże);
    - foley broni i przeładowań;
    - warstwy otoczenia per dzielnica (targ, deptak, nabrzeże, Stare Miasto);
    - ruch aut i trolejbusów;
    - drony i neony;
    - deszcz zależny od pogody;
    - UI;
    - wnętrza z pogłosem.
    
    Źródła CC0 (Kenney, Freesound CC0, OpenGameArt), z tą samą zasadą licencji.
- **[w toku] Języki gry (ADR-0056).** Angielski domyślny, polski w opcjach. Gotowe: etap 1 (menu, opcje, zapadka), 2a (ekwipunek, sklepy), 2b (panele świata), 2c (HUD i dotyk, #50 i #59). Stan pozostałych:
  - etap 4 (treść `sim` i narracja TS na kluczach) z tagami wariantu kontraktu: w main (#63);
  - etap 3 (teksty domeny w `core`: przedmioty, wszczepy, zadania, kontrakty): w main (#66); skan i18n we wszystkich pakietach 0;
  - etap 5 (narracja `ink/en`, 16 plików, zmiana języka w trakcie rozmowy): w main (#64);
  - resztki po etapach: (kontakty w telefonie i widżet zdolności poprawione w #67 i #68); nazwy miejsc kontraktów po polsku w liniach ink (`core/src/i18n/ink-sites-pl.ts` do usunięcia po etapie 5); „gotowe” i „Apteczki × N” w `ui/src/hud/ability-widget.tsx` (skan ich nie łapie); nazwy urządzeń i „Wróg” w `sim/src/systems/scanner-system.ts`; 3 linie w `app` (`lublin-preview/preview-overlay.ts`, `metro.ts`); komentarz `ContractHookDef.text` w core nieaktualny; nieczytane pole `ScanFocusChanged.name`;
  - zachowanie do decyzji: etykieta slotu zapisu, karta podsumowania i toast nowego tropu zostają w języku z chwili zdarzenia.
- **[odłożone, decyzja użytkownika 31.10 20:45] Włączenia pasów z pierwszeństwem (ADR-0055, etap, decyzja użytkownika 31.10).** Zamyka G-074: ślepy koniec pasa wjeżdża na pas innej trasy (zajęty start albo środek pasa w T) z ustępowaniem pierwszeństwa, tak żeby limity czekania w `traffic-junction-drive` zostały bez zmian. Wymaga dopisku do ADR-0055 (reguła „każdy start zajęty raz”), zmiany dwóch testów `traffic-junctions.test.ts` i `turn-off-road` bez wzrostu. Szkic ogólnej reguły: scratchpad agenta ruchu (`g074-tj-general.ts`), przy nowej sesji do odtworzenia. Baza `lane-dead-end` 45 po G-052 ma spaść.
- **[uwaga do ADR-0063 etap 4, 31.10]** Po etapie 2 (panorama megacity) `city-props.glb` ma 476 KB przy limicie 512 KB w `city-props.test`, więc budynki z etapu 4 (Alchemia) potrzebują własnego pliku GLB. `babylon-renderer.ts` ma ok. 495 linii: nowe źródło modeli wydzielić do osobnej części za fasadą (ADR-0031), zanim plik przekroczy 500. `map-city.ts` ma 583 linie mimo limitu 500 (do sprawdzenia, dlaczego lint go nie zgłasza; weryfikator etapu 2).
- **[następne] Więcej danych z OSM (ADR-0064, wybór użytkownika 31.10).** 11 etapów: dachy (G-056), wejścia, oświetlenie ulic, lokale i szyldy 2077, drzewa, linie na przystankach, sztuka i tablice, schody, płoty i mury, skarpy i potoki, bryły LOD2 z geoportalu; z geoportalu także rejestr zabytków NID, punkty adresowe, NMPT i ortofotomapa (etapy 12–15).
- **[następne] Okna wnętrz zgodne z elewacją (ADR-0061, uzupełnienie 31.10, wymóg użytkownika).** Prawdziwe otwory z szybą tam, gdzie budynek ma okna, widoczne z obu stron; najpierw klinika, Neon Koi i biuro Tessen, potem każde nowe wnętrze (także zabytki z ADR-0062). Kontrola skanu: okno elewacji przy wnętrzu bez otworu i odwrotnie.
- **[propozycja] Wnętrza głównych zabytków z wątkiem fabularnym (dodane 31.10).** Dziś wnętrza mają tylko klinika, Neon Koi, biuro Tessen, Trasa Podziemna i kanał. Pomysł użytkownika: główne budowle (Archikatedra, Brama Krakowska z muzeum, Trybunał, Zamek z Kaplicą Trójcy, Wieża Trynitarska) z wnętrzami i questem pobocznym albo wątkiem głównym. Najpierw odpowiedź kuratora (które wnętrza mają sens topograficznie, skala, wejścia z OSM), potem ADR (wnętrza zabytków jako obszary `INTERIORS` z ADR-0061, z warstwą 2077) i pisanie questów w ink (en/pl).
- **[w toku] Paczka assetów od użytkownika (ADR-0063, 31.10; etap 1 #77, etap 2 panorama megacity #93 w main).** Sześć modeli CC-BY 4.0 z folderu na Drive: słup z kablami, robopies, kapsułowe mieszkanie, dwa budynki, panorama megacity. Etapy: 1) licencje, ekran „Autorzy”, potok, słup i robopies; 2) panorama; 3) wnętrze kapsuły; 4) budynki (Alchemia).
- **[w toku] Zabytki z własnej geometrii, wersja 2077 (ADR-0062, decyzja użytkownika 31.10).** Etap 1: Brama Krakowska. Po G-049 zabytki mają prawdziwe bryły z części OSM, ale ścianę i okna z tego samego zestawu co kamienice, więc Brama Krakowska wygląda jak dom z wieżą. Propozycja: osobne modele dla kilku zabytków, które gracz rozpoznaje z daleka: Brama Krakowska (gotycka ceglana wieża, biały barokowy ośmiobok, hełm), Brama Grodzka, Trybunał, Ratusz, Wieża Trynitarska, Zamek z Kaplicą Trójcy. Model wstawiany w miejsce bryły z OSM, w obrysie i wysokościach z danych; kolizja dalej z danych. Źródło: modele CC0, jeśli są, a jeśli nie, proceduralny „zestaw zabytków” (cegła, tynk, ośmiobok, hełm, blanki). Przed tym: G-056 (kształty dachów z OSM) i G-051 (podpis muzeum na złej kamienicy). Wymaga ADR-u i przeglądu kuratora topografii.
- **[plan] Alchemia 2077: food hall na Placu Ofiar Getta (dodane 31.10).** Prawdziwy projekt spółki Arkady: kompleks usługowo-gastronomiczny (kilkadziesiąt punktów jedzenia i restauracji zamiast galerii handlowej), wielopoziomowy parking podziemny i zielony plac na wydarzenia plenerowe, między Świętoduską, Lubartowską i Bajkowskiego, na tyłach Ratusza. W 2077 roku stoi już zbudowany.
  - **Gdzie u nas:** ogrodzony nieużytek w OSM w1559354343 (`landuse=brownfield`, `proposed:landuse=retail`, ok. 4,4 tys. m²) w środku Placu Ofiar Getta (relacja r2316893, 6,7 tys. m²), środek ok. (448, 93) we współrzędnych gry, Krakowskie. Na południe parking powierzchniowy w173531008 (2 tys. m², wjazd od Przystankowej). Mapa: [`docs/plany/alchemia-mapa.svg`](plany/alchemia-mapa.svg). W grze dziś trawa placu i pusta działka.
  - **Uwaga topograficzna:** teren to stanowisko archeologiczne (w1559354344, średniowieczna osada). Budynek jest celowym odstępstwem z przyszłości (wpis T-0xx z powodem); w świecie gry wykopaliska mogą być wątkiem (podziemie, artefakty pod parkingiem).
  - **Zakres do rozpisania (ADR):** bryła food hallu z neonami i stoiskami (assety z ADR-0058 etap 3), wnętrze z autozapisem przy wejściu (ADR-0061), zjazd do parkingu podziemnego jako wnętrze wielopoziomowe, plac z wydarzeniami (koncerty, targi nocne, tłum z ADR-0060). Kandydat na hub fixerów lub frakcji. Przegląd kuratora topografii przed importem.
- **[następne] Ekran ładowania z paskiem postępu (ADR-0057).** Nowa gra i wczytanie doładowują modele, city kit, chunki startowe i shadery, a reszta miasta strumieniuje się w tle. Start po G-029 (`main.tsx`, `GpuPacer`).
- **[po G-029] Sprzątanie god objectów, renderer (ADR-0031).** `babylon-renderer.ts` (39 metod) i `map-city.ts` (562 linie). Ponadto jednolinijkowa zmiana w `main.tsx` na `intents={session.intents}` usunie kopię intencji z refaktoru `game-session.ts`. Do rozważenia osobno, z ADR-em: podział typu `Entity` (50 pól), `GangerAi`, `Interactable` na unię.
- **[decyzja użytkownika] G-024.** Sześć końców pasów jednokierunkowych (Lubartowska, Kowalska, Świętoduska) nie ma ulicy dla aut w zasięgu skrętu. Opcje: auta jadą dalej ulicą dla dostaw albo zostaje jak jest.

- **[gotowe] Dźwięki z publicznych assetów.** Podmienić lub uzupełnić syntezowane SFX nagraniami CC0 ze
  skanu w `docs/assets-research.md` §6:
  - strzały pistoletu i SMG z The Free Firearm Sound Library (wybrane pliki, nie cała paczka);
  - trafienia i kroki z Kenney Impact Sounds;
  - UI i glitch z Kenney Interface Sounds;
  - deszcz z Rain (loopable);
  - muzyka do rozważenia: T&T Free Cyberpunk Pack 2, Mirrorshade.

  Odtwarzanie przez istniejący `AudioPort` i szyny miksu (ADR-0013). Pliki skompresowane (OGG/MP3), licencje w README katalogu.
- **[gotowe] Broń z publicznych assetów.** (`packages/app/public/weapons`, `WeaponMounts`) Pistolet i SMG z Quaternius Ultimate Gun Pack (CC0) zamiast pudełek: w dłoni rigu, w kaburze, w viewmodelu FPP i u modeli
  importowanych. Zachować toon shading i outline.
- **[gotowe] Animacja biegania.** Osobny cykl dla sprintu w rigu proceduralnym (dłuższy krok, pochylenie
  tułowia, wyższe kolana, mocniejsza praca rąk, faza lotu), z płynnym przejściem chód → bieg.
  Działa też na modelach importowanych przez retarget, a broń w biegu trzymana nisko.

- **[gotowe] Plan systemu ekwipunku i uzbrojenia (dokument + ADR), przed lootem i menu.** Model przedmiotów
  (typy, rzadkość, statystyki, stackowanie, waga lub sloty), sloty uzbrojenia (broń główna,
  boczna, wręcz), amunicja i przeładowanie, modyfikacje broni, odzież i pancerz per strefa ciała
  (pod hitboxy), wszczepy a ekwipunek, tabele łupów, sklepy i ceny, zapis i migracje, kontrakty
  między core, sim, UI i rendererem (co widać na postaci), etapy wdrożenia.
  Plan: [`docs/ekwipunek-i-uzbrojenie.md`](ekwipunek-i-uzbrojenie.md), decyzje w
  [ADR-0015](adr/0015-ekwipunek-uzbrojenie-loot.md).
- **[gotowe] Lootowanie wrogów.** Ciało pokonanego wroga (albo upuszczona torba) jako obiekt interakcji:
  eddies, amunicja, apteczki, części i wszczepy z tabel łupów zależnych od typu wroga. Losowanie
  przez `RandomPort`, stan zebranych łupów w zapisie. Wdrożone jako etapy E0 do E6 planu ekwipunku
  (sloty broni, amunicja, przeładowanie, pancerz per strefa, torby z łupem, minimalny panel łupu);
  wygląd torby i postaci (E7: broń w dłoni, kaburze i na plecach, dodatki odzieży, torba z paskiem
  w kolorze rzadkości, animacja przeładowania) gotowy; menu postaci (E8 i E9) w toku.
- **[gotowe] Menu postaci na telefonie (i desktopie).** Ekran ekwipunku z podglądem postaci w 3D (obrót,
  aktualny wygląd z założonymi wszczepami i bronią), statystyki (HP, pancerz, celność, kryt,
  reputacja), siatka inventory z przeciąganiem lub stuknięciem, porównanie przedmiotów. Układ
  pod poziomy ekran telefonu z dużymi celami dotyku; spójny z kartą postaci i dziennikiem.
- **[gotowe] Celowanie prawym przyciskiem myszy (ADS).** ([ADR-0019](adr/0019-celowanie-ads-i-bron-biala.md)) PPM przytrzymany: zbliżenie widoku (FOV) i broń
  podniesiona do oka w FPP, w TPP kamera przez ramię. Parametry per broń w katalogu: zoom (pistolet
  małe, SMG średnie, karabin duże), czas wejścia w celowanie, mniejszy rozrzut i wolniejszy ruch
  podczas celowania, czułość myszy skalowana zoomem. Celownik zwęża się jak przy kucaniu. Na
  telefonie przycisk celowania (przytrzymaj lub przełącz, w ustawieniach). Wejście jako pole
  `aim` w `InputFrame`, stan w sim, deterministycznie. Wdrożone: PPM, LT na padzie, przycisk ◎ na
  dotyku, ustawienie przytrzymaj lub przełącz.
- **[gotowe] Broń biała.** ([ADR-0019](adr/0019-celowanie-ads-i-bron-biala.md)) Pałka i ostrze z katalogu jako pełnoprawne bronie slotu „wręcz”: atak lekki (LPM)
  z krótkim combo, trafienie łukiem przed postacią w zasięgu broni, obrażenia per strefa ciała,
  odrzut i przerwanie akcji trafionego. PPM przy broni białej to blok: zmniejsza obrażenia z
  przodu, kosztuje wytrzymałość lub ma limit, blok w dobrym momencie (parry) ogłusza
  przeciwnika wręcz. Animacje zamachu i bloku w rigu (i retarget na modele), dźwięki uderzeń.
  AI: wrogowie z bronią białą skracają dystans, gracz może ich blokować. Wdrożone: combo trzech
  ciosów, łuk i strefy, ogłuszenie z odrzutem, blok i parowanie z cooldownem (bez wytrzymałości),
  brawler Hebi z pałką (co trzeci ganger fali zlecenia) z telegrafowanym zamachem. Później: blok
  u NPC, ciężki atak, ostrze w sklepie (pałkę sprzedaje Oyaji).

- **[gotowe] Ruch w pionie: schody, windy, mosty.** ([ADR-0020](adr/0020-poziomy-schody-windy-mosty.md))
  Bryły są podłogą (wejście na stopień do 0,45 m, schodzenie bez spadania, grawitacja przy
  zejściu z krawędzi), schody i poręcze jako rampy, promienie strzałów i linia wzroku liczą
  nachylenie, interakcja nie sięga przez strop. Treść: estakada nad targiem jako chodnik z
  poręczami, schody od zachodu i winda towarowa z bramką na górze; kładka nad ulicą Kanałową.

- **[gotowe] Ruch w pionie, dalej: skok, upadki, drabiny, AI między poziomami.** ([ADR-0021](adr/0021-skok-upadki-drabiny-nawigacja.md))
  Skok (Spacja, A na padzie, przycisk na dotyku) z coyote time, buforem i ograniczoną kontrolą
  w powietrzu, bez podwójnego skoku. Obrażenia od upadku powyżej 4 m przez zwykłą ścieżkę
  obrażeń, twarde lądowanie spowalnia, dźwięki skoku i lądowania. Drabiny jako stan ruchu.
  Treść na targu: schody przeciwpożarowe z balkonem i trzema drabinami na dwa dachy, skrytka
  Hebi na dachu. Gangerzy gonią gracza schodami przez graf punktów przejścia (estakada, kładka),
  strzelcy szukają pozycji do strzału, windy i drabiny zostają dla gracza. Pozy skoku, lądowania
  i wspinaczki w rigu (też na modelach VRoid). Minimapa całego miasta z piętrami, ikonami
  schodów, windy i drabin i wysokością gracza.
- **[gotowe] Poprawki linii dialogowych.** Przegląd wszystkich rozmów w `packages/narrative/ink`: wybory
  gracza to kwestie Seki (u Kaito wybór brzmiał jak jego własna rada o doktorze Mori), odpowiedzi
  od właściwego mówcy, bez powtórzeń po pytaniach pobocznych, spójność z wątkiem głównym (liczba
  prób nadpisania, co Seki wie o Renie). Pilnuje tego `packages/narrative/test/dialogue-roles.test.ts`,
  który przechodzi każdą osiągalną ścieżkę wyborów.
- **[gotowe] Mimika postaci VRoid.** Mruganie co 2–6 s i ruch ust podczas kwestii rozmówcy przez
  morph targety VRM (`blink`, `a`, `i`, `u`, `e`, `o`) w shaderze toon; opis w `docs/models.md`.
- **[gotowe] Odzież na modelach VRoid i w podglądzie menu.** ([ADR-0015](adr/0015-ekwipunek-uzbrojenie-loot.md), dopisek E7)
  Hełm, wizjer i płyta kamizelki na kościach głowy i klatki ubranego modelu (na rigu
  proceduralnym bez modelu), kolor kurtki i spodni jako przebarwienie materiałów „Tops” i
  „Bottoms”, podgląd w menu przez te same `Loadouts` co świat.
- **[gotowe] Kabury i wszczepy na modelach.** Kabury i pas na plecach przesuwają się o stosunek
  wzrostu modelu do rigu (pistolet zostaje przy biodrze modelu); widoczne wszczepy z deskryptora:
  optyka jako świecące paski przy kącikach oczu, cyberramię jako miedziane pierścienie na prawym
  przedramieniu, na modelu i na rigu.

- **[gotowe] Budynki i dekoracje z assetów, dostrojone do cyberpunku.** (ADR-0022, `packages/app/public/city`) Zamiast gołych brył: fasady, sklepy,
  bary i wieżowce z paczek CC0 z przeglądu (`docs/assets-research.md`): Neon Town (neony, bar,
  sklepy), Kenney City Kit Commercial (budynki, wieżowce w tle) i Roads (chodniki, latarnie,
  kontenery, kable), Car Kit (zaparkowane auta). Inne stylistyki przemalowane na noc, teal i
  magentę przez toon shader, z dołożonymi neonami, kablami i klimatyzatorami. Kolizje zostają
  bryłami w sim; budżety draw calli i migawka NPR pilnują wydajności i looku.
- **[gotowe] Wątek główny, akt II „Lustro”.** ([ADR-0023](adr/0023-watek-glowny-akt-2.md))
  Quest `m3_lustro` po akcie I: otwarcie zależne od zakończenia (Ren mówi przez moduł albo Kaito
  pisze, że Mori sprzedał moduł), ślad od Ume lub Mori, Ren Odagiri na dachu targu z chipem
  „zapis zero”, zlecenie Kaito na Rena jako haczyk, Kurosawa z Kagami na estakadzie. Trzy
  wspomnienia z retrospekcjami (dach: zdrowie, głos: stabilność celowania, lustro: krytyk i
  obrażenia), wybory w domenie, nowa frakcja Kagami Biotech, walka z czyścicielami albo układ bez
  walki, trzy zakończenia (Archiwum ulicy, Wspólnicy, Kopia) z reputacją Hebi, mieszkańców i
  korporacji. Postacie pojawiają się i znikają według flag. Zapis v9 z migracją. Akceptacja:
  `packages/app/test/m3-lustro-loop.test.ts`, kluczowa rozmowa przez UI w `packages/app/test/m3-lustro-ui.test.tsx`.
- **[gotowe] Przeskok na krawędź (mantle).** Skok przy murku do ok. 2,5 m kończy się podciągnięciem
  na jego wierzch w pół sekundy (dopisek w ADR-0021); bez strzału i skoku w trakcie.
- **[gotowe] Sterowanie PC według standardu i pierwsze uruchomienie.** Kółko myszy zmienia broń,
  F jako druga interakcja, P pauzuje, kucanie domyślnie przełączane, sprint i celowanie do wyboru
  (przytrzymaj albo przełącz), surowe wejście myszy, czułość przy celowaniu, odwrócona oś Y,
  pole widzenia 50–80°, zmiana klawiszy w ustawieniach (bez kolizji, klawisze menu zastrzeżone).
  Podpowiedzi przy pierwszej grze: ruch, sprint i skok, rozmowa, walka, torba, ekwipunek,
  dziennik; jedna naraz, z klawiszy gracza, zapamiętane, do wyłączenia; słowa dotykowe na telefonie.

## Później

- Witryna obok Neon Koi w scenie referencyjnej to duża płaska bursztynowa plama: dodać
  podział szyby, wnętrze albo szyld.

- Wygląd ekwipunku, dalej: hełm i kamizelka jako modele GLB zamiast brył, przebarwienie na rigu
  proceduralnym, wszczepy szkieletu i układu nerwowego (dziś widać tylko optykę i ramię).

- Ruch w pionie, jeszcze dalej: dachy i balkony w Shinsekai 7 (scena referencyjna NPR, zmiana
  wymaga nowej migawki), sniper Hebi na dachu targu, NPC na drabinach i w windzie (dziś
  świadomie nie, ADR-0021).

- Własne modele postaci (VRoid lub grafik) po MVP. Decyzja: obsada z próbek VRoid (CC0 / VRoid Hub license v1)
  zostaje w MVP gry.
