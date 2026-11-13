# ADR-0081: Mieszkańcy: tożsamość, plan dnia, wiedza i scena jako okno

Status: Proponowany (13.11). Prośba użytkownika z 13.11 (`docs/decyzje.md`, „Mieszkańcy”; backlog, „Mieszkańcy: tożsamość, plan dnia, wiedza i scena jako okno”). Rozbudowuje ADR-0017 (zegar, harmonogramy), ADR-0040 (rutyny, przechodnie tła), ADR-0041 i ADR-0050 (mieszkańcy, tłum), ADR-0029 (świadkowie, heat), ADR-0070 (reputacja), ADR-0076 (modele, obsada, pula tła); nie zmienia ADR-0058 etap 8 (postacie w pozach tylko do rysowania). Stan kodu: `origin/main` db52080.

## Kontekst

**Kto dziś żyje w mieście.**
- **Postacie nazwane.** `CAST_OF_SPAWN` (`sim/src/content/cast.ts`) ma 31 kluczy (Kaito, Mori, Ume… do bywalców Neon Koi) i do tego Mikę z eskort. Tylko 8 ma plan dnia w `SCHEDULES` (ume, oyaji, hebi-lookout, hideo, mei, fumiko, kenta, goro), do tego patrole Kanałowej. Plan to lista przystanków `{ at, path, yaw, activity, interaction }`, a `scheduledPose(plan, zegar)` jest czystą funkcją. W zapisie są tylko byty z kluczem (`EntitySnapshot`), także uśpione w zwolnionym chunku (ADR-0014).
- **Przechodnie tła** (ADR-0040, `world/passersby.ts`). Jest ich 13 w 6 chunkach (`PASSERSBY`, najwyżej 3 na chunk). Co slot 45 minut gry dostają miejsce ze strumienia `deriveRandom(seed, "passersby:<chunk>:<slot>")`.
- **Tłum mieszkańców** (ADR-0041 i ADR-0050, `world/crowd.ts`, `systems/crowd-system.ts`). Na chunk przypada `CROWD_CAP` × `CROWD_BY_HOUR[profil][godzina]` × udział chunka, gdzie `CROWD_CAP` to 0, 6, 18 albo 32 (off, low, medium, high), a udział 0,4–1. Rola (idący po `CROWD_LANES` albo stojący na `CROWD_SPOTS`), wygląd i parasol (35%) wynikają z ziarna, chunka i indeksu, a nie z godziny. Id liczą się od 1 000 000. Ludzie przychodzą i odchodzą co 15 kroków, tylko poza wzrokiem gracza (55 m).
- **Postacie w pozach** (ADR-0058 etap 8). To 379 figur wypieczonych do siatek bloków, bez symulacji.
- **Czego tło nie ma.** Przechodnie i tłum nie mają zdrowia ani klucza, nie trafiają do zapisu, nie są świadkami, nikogo nie pchają i nie otwierają drzwi. Dlatego dziś nie zmieniają złotego hasha.
- **Ile tego jest naraz.** Chunk ma ok. 220 × 250 m i wczytuje się w promieniu 30 m od granic (zwalnia przy 44 m), więc zwykle wczytane są 1–4 chunki. Przy `high` daje to do ok. 130 ludzi tłumu w ECS. Koszt sim z ADR-0041: ok. 0,8 ms na krok przy 40 mieszkańcach, ok. 0,2 ms przy `low`.

**Czego brakuje wobec prośby.**
- Nikt z tła nie ma imienia, rodziny, zajęcia ani domu. Tę samą osobę spotkaną w dwóch chunkach łączy tylko przypadek indeksu.
- Plan dnia ma 8 postaci, a reszta to sloty 45 minut bez pracy, snu i posiłków.
- Nie ma dnia tygodnia: jest tylko `dayOf`. Nie ma też pogody w sim, parasol losuje się z ziarna.
- Wiedza jest wspólna dla całego miasta. Reputacja w ADR-0070 jest jedna, a reputację dzielnic i zapominanie ADR-0070 odłożył, bo wymagają stanu w zapisie. Świadkiem może być tylko cywil z kluczem (`CIVILIAN_SIGHT` 22 m, telefon 5 s). Nikt nie „słyszał” o bohaterce.

**Dane mapy do wykorzystania** (`content/lublin/*.generated.ts`, 20 chunków):
- 705 budynków, w tym 518 mieszkalnych, 54 handlowe, 27 urzędów, 23 kościoły, 44 zabytki, 26 garaży, 2 przemysłowe i 11 innych; razem 2 099 kondygnacji.
- Punkty POI i lokale: sklepy ok. 213, jedzenie ok. 103, bary ok. 32, usługi ok. 30, biura ok. 24, kultura ok. 17, hotele ok. 13 i przystanki ok. 76.
- Ulice to linie z nazwami. Klucze budynków są stabilnymi id OSM (np. `w66286396`).

**Zapis i determinizm.**
- `SAVE_SCHEMA_VERSION = 38`, migracje 1→38 w `persistence/src/migrations.ts`.
- Złoty hash replayu to `d8da2e11` (1159 kroków).
- Losowość pochodzi tylko z `RandomPort` i `deriveRandom` (mulberry32 z FNV-1a klucza).
- Zegar: 1 krok to 1 sekunda gry, a 1 minuta realna to 1 godzina gry.

## Rozważone opcje

| Opcja | Na czym polega | Koszt | Ryzyko |
|---|---|---|---|
| A. Tożsamość dla obecnego tłumu, bez stanu | Imię i zajęcie z ziarna slotu tłumu | mały, bez zmiany zapisu | wiedza niemożliwa, bo nie ma trwałej osoby; ta sama „osoba” istnieje tylko w jednym chunku; nie spełnia punktów 3 i 4 |
| B. Wszyscy mieszkańcy jako pełne byty ECS w całym mieście | AI, ruch i percepcja dla każdego | bardzo duży CPU (ok. 1 200 × AI), kolizje i streaming bez sensu | telefon odpada; hash zależy od całego miasta |
| C. Rejestr mieszkańców i dwa poziomy symulacji (LOD symulacji, jak spis mieszkańców w Watch Dogs: Legion i Shadows of Doubt) | Tożsamość z ziarna i mapy, plan na grafie miejsc, wiedza jako mały stan, pełne byty tylko w oknie | średni: nowy moduł, sekcja zapisu, 6 PR-ów | przejścia między poziomami, stabilność tożsamości po `osm:build` |
| D. Wiedza zbiorcza (heat i reputacja dzielnic) zamiast wiedzy osób | Licznik plotki na dzielnicę | mały | nie spełnia „każdy wie tyle, ile usłyszał”; świadek, który słyszał, byłby fikcją |

Wybór: **C**. Plotka to model rozprzestrzeniania na grafie miejsc (jak model epidemiologiczny SIR) z zanikiem pewności.

## Decyzja

### 1. Model mieszkańca (`core/residents`, generator w `sim/src/residents`)

**Tożsamość** (`ResidentId`: u16, stały w obrębie wersji rejestru):
- imię, ksywa (z zajęcia albo cechy: „Kluczyk”, „Doktorek”), wiek (0–90), płeć;
- dom: klucz budynku OSM i numer mieszkania;
- gospodarstwo domowe;
- zajęcie: rodzaj i miejsce pracy (klucz POI albo budynku);
- zamożność 0–4 (bieda, skromnie, średnio, dostatnio, bogato).

Tożsamość nie trafia do zapisu, bo generator odtwarza ją z ziarna i mapy.

**Rodzina jako graf.** Gospodarstwa: para, dzieci, czasem dziadek. Krawędzie: `małżonek`, `rodzic`/`dziecko`, `rodzeństwo`, także między gospodarstwami (dorosłe dzieci mieszkają osobno, często w tej samej dzielnicy). Trzymane jako tablice sąsiedztwa. Test pilnuje symetrii krawędzi, braku cykli rodzic→dziecko i różnicy wieku rodzic–dziecko ≥ 16 lat.

**Generowanie** to czysta funkcja `(seed, rosterVersion, MAP_CHUNKS)`:
1. Mieszkania: budynek mieszkalny ma tyle mieszkań, ile wynosi kondygnacje × rzut / 70 m², obcięte przez wspólny limit rejestru.
2. Gospodarstwa losowane strumieniem `deriveRandom(seed, "res:<budynek>:<mieszkanie>")`, więc zmiana jednego budynku zmienia tylko jego mieszkańców.
3. Miejsca pracy z POI i lokali: liczba etatów według rodzaju (sklep 1–3, bar 2–4, biuro 4–8, kościół 1, urząd 6) oraz z gangów i ochrony dzielnic. Etaty przydziela się w kolejności id budynków, najbliższym domom w grafie miejsc.
4. Zamożność z dzielnicy (Stare Miasto i Krakowskie wyżej, Podzamcze i Nabrzeże niżej), wysokości budynku i zajęcia.

**Ilu.** Domyślny limit rejestru to 1 200 osób (ok. 600 gospodarstw w 518 budynkach i ok. 900 etatów). Liczba jest stałą wersji rejestru, a nie ustawieniem grafiki.

**Nazwani z fabuły i tło.**
- 31 postaci z `CAST_OF_SPAWN` i Mika to mieszkańcy z ręcznym wpisem (`RESIDENT_OVERRIDES`: dom, rodzina, zajęcie, wiek zgodny z ink i ADR-0076). Generator omija ich mieszkania i etaty.
- Klucz spawnu i `EntitySnapshot` zostają, więc ich zapis się nie zmienia.
- Wygląd tła (`look` z ADR-0076 i `crowd-look`) liczy się z `ResidentId`, a zamożność wybiera paletę ubrań.

### 2. Plan dnia (`sim/src/residents/day-plan.ts`)

**Bloki planu:** `sen`, `dom`, `droga`, `praca`/`zajęcie`, `posiłek`, `wolny czas`. Plan to czysta funkcja `(rezydent, dzień, pogoda)`, która daje listę bloków `{ od, do, miejsce, aktywność }`, gdzie aktywność to `ActivityId` z ADR-0040.

**Szablony według zajęcia:**
- zmiana dzienna 8–16;
- handel 10–19;
- bar i ochrona: nocą;
- uczeń 8–14;
- emeryt: bez pracy, targ rano;
- bezrobotny;
- ganger: nocą na ulicy dzielnicy.

**Co zmienia szablon:**
- przesunięcie ±0–40 min z ziarna osoby;
- zamożność: posiłek w lokalu albo w domu, bar albo automat, metro albo pieszo;
- dzień tygodnia `weekdayOf(clock) = (dayOf − 1 + START_WEEKDAY) % 7`: w weekend bez pracy biurowej, dłuższy wolny czas, kościół w niedzielę rano;
- pogoda `weatherOf(seed, dzień, godzina)`: nowa czysta funkcja (deszcz albo sucho). Przy deszczu wolny czas idzie pod dach, a parasol liczy się z pogody zamiast z 35% ziarna.

**Wyjątki z fabuły.** `PlanOverride` (klucz, warunek na flagę lub etap zadania, bloki) ma pierwszeństwo przed szablonem. Dla postaci z `SCHEDULES` przystanki ADR-0017 stają się blokami. W oknie dalej rządzi `scheduledPose`, więc ich zachowanie i hash się nie zmieniają.

**Zachowanie przed planem.** Ucieczka (ADR-0029), postawa wobec reputacji (ADR-0070) i alarm mają pierwszeństwo jak dziś. Mieszkaniec, który uciekł, dostaje wyjątek „do domu do końca bloku”, zapisany jako odchylenie (punkt 4).

### 3. Wiedza (`sim/src/residents/knowledge.ts`)

**Fakt** (globalna tablica, najwyżej 256 naraz): `{ id, rodzaj, podmiot, miejsce, kiedy }`.
- Rodzaje: `murder`, `assault`, `gunfire`, `body`, `seen-heroine`, `helped`, `job-done`, `story:<klucz>`.
- Podmiot: bohaterka, rezydent albo frakcja.
- Miejsce: węzeł grafu miejsc.
- Czas: sekunda zegara.

**Wiedza osoby:** najwyżej 8 wpisów `{ fakt, źródło, pewność u8, przeskoki u8, poznano }`.
- Źródło: `seen` albo `heard`, z `ResidentId` tego, kto powiedział.
- Gdy brakuje miejsca, wypada wpis o najniższej pewności.

**Skąd fakty.**
- Zdarzenia domeny w oknie, które widział rezydent: przestępstwo z ADR-0029 (`CrimeReported`, `WitnessCalling`), `CrowdReacted` przy strzale, znalezione ciało, pomoc z ADR-0070.
- Fabuła: zakończone zlecenie publikuje `job-done` w miejscu zlecenia.
- Fakt `seen` ma pewność 255.

**Przekazywanie.**
- W oknie: dwóch rezydentów w aktywności `talk`, w jednej grupie miejsc (`CrowdSpot.group`) albo w jednym gospodarstwie wymienia się raz na 60 s gry.
- Poza oknem: na granicy slotu 15 minut ludzie w tym samym węźle (dom, praca, bar) wymieniają się w kolejności id węzła i id osoby. Strumień `deriveRandom(seed, "rumor:<węzeł>:<slot>")`. Szansa przekazania rośnie z pewnością i z więzią (rodzina > praca > ten sam lokal).

**Zniekształcenie.** Każdy przeskok mnoży pewność przez 0,7, a przy przeskokach ≥ 2 zgrubia szczegóły:
- miejsce: punkt → ulica → dzielnica;
- czas: do godziny, potem „wczoraj”;
- rodzaj: `assault` może urosnąć do `murder` z szansą 10% na przeskok;
- opis bohaterki (ubranie, broń) traci pola.

**Wygasanie.** Pewność spada o połowę co 2 dni gry. Poniżej 32 wpis znika, a fakt bez nosicieli wypada z tablicy.

**Użycie.**
- **Rozpoznanie.** Rezydent w oknie z faktem o bohaterce i pewnością ≥ 96 rozpoznaje ją, gdy opis pasuje do bieżącego wyglądu (przebranie z ADR-0033 zrywa dopasowanie). Wtedy reaguje: `alarmed`, odsuwa się, a przy `murder` dzwoni jak świadek z ADR-0029 (kanał `civilian`, źródło „słyszał”, heat najwyżej 1).
- **Dialogi.** Ink dostaje `heard_of_player`, `rumor_kind`, `rumor_source` (imię albo „ludzie mówią”) i `rumor_age`. Sprzedawcy łączą to z reputacją z ADR-0070.
- **Reputacja dzielnic** (odłożona w ADR-0070) wynika z wiedzy: udział mieszkańców dzielnicy z faktem i jego wydźwięk. Bez osobnego licznika.

### 4. Scena jako okno: poziomy symulacji

**Poziom A, pełny.** Rezydent, którego plan umieszcza na zewnątrz albo w wczytanym wnętrzu wczytanego chunka (histereza ADR-0014: 30 i 44 m), jest bytem ECS:
- ma AI cywila, ruch, percepcję, reakcje i wiedzę;
- liczba na chunk dalej wynosi najwyżej `CROWD_CAP` (6/18/32), więc budżety rysowania się nie zmieniają.

Sloty tłumu z ADR-0041 i przechodniów z ADR-0040 dostają twarze z rejestru: najpierw nazwani z planem w chunku, potem rezydenci z blokiem „wolny czas” lub „droga” w tym chunku, posortowani po id. Gdy brakuje rezydentów do liczby z `CROWD_BY_HOUR`, slot zostaje anonimowym przyjezdnym bez wiedzy, jak dziś. Trasy, miejsca, prędkości i fazy zostają funkcjami z `crowd.ts`.

**Poziom B, uproszczony.** Wszyscy pozostali:
- położenie to czysta funkcja `(plan, zegar)` na grafie miejsc: węzeł albo krawędź z postępem;
- graf: węzły to budynki, POI, miejsca tłumu i stacje metra; krawędzie to ulice z `LublinStreetData` z długością, przejście z prędkością 1,2 m/s;
- bez fizyki, kolizji i percepcji;
- wiedza wymienia się na poziomie węzłów (punkt 3).

**Wejście w okno.** Pozycja na krawędzi przechodzi na najbliższy punkt trasy chodnika (`CROWD_LANES`) albo miejsce w węźle, aktywność pochodzi z bloku, a wiedza jest ta sama, bo jest jeden magazyn. Obowiązuje reguła ADR-0041: nikt nie pojawia się w polu widzenia gracza, chyba że chunk dopiero się wczytał. Postacie w pozach (ADR-0058 etap 8) zostają dekoracją bez tożsamości.

**Wyjście z okna.** Rezydent wraca do planu od najbliższego węzła. Jeśli odbiegł (ucieczka, pościg, rozmowa), dostaje odchylenie `{ do kiedy, węzeł }`, zapisywane, póki trwa.

**Jedna osoba, jeden byt.** Test pilnuje, że żaden `ResidentId` nie ma dwóch bytów naraz i że slot tłumu nie podmienia twarzy, póki gracz na niego patrzy.

**Pomijanie czasu.** `wait` z ADR-0017 przetwarza po kolei każdą granicę slotu w pominiętym czasie (24 h to 96 slotów).

**Tło nadal nie ginie.** Tłum zostaje bez zdrowia jak dziś. Śmierć i trwały stan mają tylko postacie z kluczem.

### 5. Zapis i migracja
- `SAVE_SCHEMA_VERSION` 38 → 39. Nowa sekcja `residents`:
  - `rosterVersion`: hash generatora i kluczy budynków;
  - `facts`;
  - wiedza tylko osób z co najmniej jednym wpisem;
  - odchylenia;
  - nadpisania planów z fabuły, które zależą od flag (po wczytaniu liczą się z flag, więc w zapisie są tylko zmiany jednorazowe).
- Migracja 38 → 39 wstawia pustą sekcję i bieżący `rosterVersion`. Byty z kluczem bez zmian.
- **Zmiana mapy** (`osm:build`) zmienia `rosterVersion`. Wczytanie starszego zapisu przenosi wiedzę po kluczu mieszkania (budynek, numer) i gubi tylko wiedzę zniesionych mieszkań, z ostrzeżeniem w logu. Test sprawdza to na migawce z usuniętym budynkiem.
- **Rozmiar:** najwyżej 256 faktów i 1 200 × 8 wpisów, w praktyce ok. 10–40 KB JSON. Test pilnuje, że sekcja ma ≤ 64 KB przy pełnych limitach.

### 6. Budżety telefonu (ADR-0079) i test deterministyczny

**Pamięć.** Rejestr w tablicach typowanych ≤ 1 MiB sterty, graf miejsc ≤ 0,5 MiB, wiedza ≤ 64 KiB. Generowanie ≤ 40 ms na komputerze CI przy starcie i wczytaniu, mierzone testem.

**CPU, poziom B.** Średnio ≤ 0,1 ms na krok (CI). Granicę slotu dzieli się na partie po węzłach w kolejnych krokach, w stałej kolejności, z pikiem ≤ 1 ms na krok. Mnożnik dla telefonu wyjdzie z etapu 3 ADR-0079; do tego czasu próg CI × 3.

**CPU, poziom A.** Bez wzrostu wobec ADR-0041 przy tym samym `CROWD_CAP`. Wymiana wiedzy w oknie ≤ 0,05 ms na krok. Rozpoznanie sprawdzają tylko rezydenci w 22 m.

**Testy:**
- „Ten sam dzień dwa razy”: dwa przebiegi 24 h poziomu B (`wait` w 96 slotach) z ziarna 1234 i jednym faktem startowym dają ten sam hash sekcji `residents`; złoty hash w `residents-day.test.ts`.
- „Zapis w połowie dnia”: zapis o 12:00, wczytanie i dalsze 12 h dają ten sam hash.
- Replay `determinism.test.ts` z gęstością `low` i `high` daje ten sam hash.
- Złoty `d8da2e11` zmienia się świadomie tylko w PR 5.

## Plan wdrożenia (osobne PR-y)
1. **Rejestr i graf miejsc** (bez użycia w grze).
   - Wynik: liczba osób w granicach 1 200 ± 2%.
   - 100% ma dom, 100% pracujących ma istniejące miejsce pracy, testy grafu rodziny przechodzą.
   - Hash rejestru stały; generowanie ≤ 40 ms, ≤ 1 MiB.
   - Test: usunięcie jednego budynku zmienia tylko jego mieszkańców.
   - Złote hashe bez zmian.
2. **Twarze tłumu i przechodniów z rejestru.**
   - Wynik: o 18:00 na Krakowskim ≥ 80% slotów ma tożsamość; test „jedna osoba, jeden byt”.
   - Skaner pokazuje imię, ksywę i zajęcie.
   - `npr-perf` bez zmian, złote hashe bez zmian (tylko pole widoku).
3. **Plan dnia na grafie miejsc i pogoda dnia** (`weekdayOf`, `weatherOf`).
   - Wynik: o 3:00 ≥ 85% w domu; o 11:00 w dzień roboczy ≥ 70% pracujących w pracy, a w niedzielę ≤ 20%.
   - Plany z ADR-0017 bez zmiany pozy (test porównawczy `scheduledPose`); hashe bez zmian.
4. **Wiedza poza oknem, zapis v39 i migracja.**
   - Wynik: złoty hash „ten sam dzień dwa razy” i „zapis w połowie dnia”.
   - Krzywa plotki z jednego `murder` po 24 h: 20–50% dzielnicy, < 10% innych dzielnic.
   - Sekcja ≤ 64 KB; poziom B ≤ 0,1 ms na krok.
5. **Wiedza w oknie: świadkowie, rozpoznanie, ink.**
   - Wynik: scenariusz testowy, w którym rezydent, który słyszał (i nie widział), rozpoznaje bohaterkę bez przebrania i nie rozpoznaje jej w przebraniu.
   - Zmienne ink w jednym dialogu sprzedawcy; złoty hash przeliczony świadomie z opisem w teście.
6. **Przejścia okna bez skoków.**
   - Wynik: w sondzie 10 minut chodzenia po granicach chunków 0 pojawień i zniknięć w polu widzenia bliżej niż 55 m i 0 skoków bytu > 1 m na krok.
   - Nowa kontrola skanu `resident-pop-in` z bazą 0; odchylenia przeżywają zapis.
7. **Pomiar na telefonie** (razem z etapem 3 ADR-0079).
   - Wynik: czas kroku sim w scenie `krakowskie-tpp` o 18:00 przy `low` i `high`, pik granicy slotu, sterta. Progi z punktu 6 poprawione według pomiaru.

## Konsekwencje
- Miasto ma stałych ludzi: tę samą sąsiadkę spotyka się rano pod domem i wieczorem w barze. Reputacja dzielnic i zapominanie z ADR-0070 dostają podstawę bez osobnego licznika.
- Zapis rośnie o sekcję `residents` (v39). Każda zmiana mapy zmienia `rosterVersion`, a przeniesienie wiedzy po kluczu mieszkania jest jedną ścieżką migracji do utrzymania.
- Tłum przestaje być w pełni bezstanowy: twarz slotu zależy od rejestru i planu. Trasy, liczby z `CROWD_BY_HOUR` i budżety rysowania zostają.
- Świadkowie spoza obsady z kluczem (od PR 5) zmieniają złoty hash i balans heat. Heat ze „słyszenia” ma limit poziomu 1.
- Postacie z `SCHEDULES` zachowują swoje plany, ale ich treść (dom, rodzina) musi zgadzać się z ink: przegląd treści przy PR 1.

## Ryzyka i jak je mierzyć
- **Tożsamości przesuwają się po `osm:build`.** Test PR 1 sprawdza, że usunięcie budynku zmienia tylko jego mieszkańców. Narzędzie wypisuje przy regeneracji liczbę zmienionych `ResidentId`.
- **Plotka wybucha albo gaśnie.** Mierzy to krzywa udziału nosicieli po 6, 24 i 72 h w teście PR 4, w paśmie z planu. Parametry (0,7, połowa na 2 dni, 32) są w jednej tabeli.
- **Piki CPU na granicy slotu i przy `wait`.** Pik na krok w `residents-perf.test.ts`; `wait 24 h` ≤ 150 ms na CI.
- **Skoki przy wejściu w okno i wyjściu z niego.** Kontrola `resident-pop-in` i sonda z PR 6; zrzuty przed i po na granicy Krakowskie i Stare Miasto.
- **Rozjazd z treścią fabuły** (wiek i rodzina nazwanych). Test zgodności `RESIDENT_OVERRIDES` z `cast` i ADR-0076 (wiek, płeć); przegląd ink.
- **Rozmiar zapisu.** Test ≤ 64 KB przy pełnych limitach.

## Otwarte pytania do użytkownika

1. Ilu mieszkańców: proponuję 1 200 jako stałą wersji rejestru, czy raczej „każde mieszkanie z mapy”? To drugie daje ok. 3–4 tys. osób i więcej pamięci i CPU poziomu B.
2. Imiona i ksywy: japońskie jak obecna obsada, polskie, czy mieszane według dzielnicy lub pochodzenia rodziny?
3. Pogoda: dziś sim jej nie ma, a parasole losuje ziarno (35%). Czy w PR 3 wprowadzić deterministyczną pogodę dnia (zmienia też renderer i parasole), czy na start plan dnia ma pominąć pogodę?
4. Kolejność wobec mapowania: domyślnie po mapowaniu jak inne funkcje, czy PR 1–3 mogą iść wcześniej? Nie zmieniają złotych hashy ani zapisu.
