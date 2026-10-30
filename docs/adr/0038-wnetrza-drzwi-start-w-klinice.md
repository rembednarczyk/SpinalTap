# ADR-0038: Wnętrza kliniki i Neon Koi, drzwi automatyczne, start w klinice

## Kontekst
ADR-0037 zapowiedział wnętrza z ruchomymi drzwiami i nowe otwarcie gry. Budynki Shinsekai 7 były pełnymi bryłami ze skórką city kitu (ADR-0022), Kaito stał na ulicy przed barem, Mori przed kliniką, a nowa gra zaczynała się przy wraku na ulicy. Ograniczenia: determinizm i złoty hash, streaming (ADR-0014), zapis kontynuowany identycznie, AI z polem odległości (ADR-0025), limity ADR-0031.

## Decyzja
- **Wnętrza** (`sim/src/content/interiors.ts`, dołączone na końcu treści chunka `shinsekai-7`).
  - Klinika: x ∈ [-17; -7,3], z ∈ [1,3; 7,7], drzwi na froncie x = -7,15, otwór z ∈ [3,6; 5,2]. Poczekalnia (ławka, recepcja, ekran „NUMER 7”), za ścianką działową z przejściem z ∈ [4,8; 6,4] gabinet: fotel zabiegowy (siedzisko 0,45 m, x ∈ [-15; -14,2], z ∈ [1,7; 3,7]), dwie lampy chirurgiczne, monitory, wózek, szafka. Ramen zostaje w północnej połowie starego bloku.
  - Neon Koi: x ∈ [7,3; 17], z ∈ [-6,7; 10,7], drzwi dwuskrzydłowe x = 7,15, otwór z ∈ [0,4; 2,6]. Lada wzdłuż z przy x ≈ 13,8, półka z neonem za barmanem, stołki, dwa stoliki, scena i szafa grająca.
  - **Skórka a wycięcie.** City kit wypełnia całą objętość bloku zamkniętymi modelami, więc w skórce nie da się zrobić otworu. Dlatego blok dzieli się na trzy części: piętra od 4,2 m w górę zostają blokiem ze skórką (`tenement`), parter to powłoka brył z grubością bez skórki (ściany, sufit, podłoga, wypełnienie z tyłu jako tylna ściana), a fragmenty frontowej ściany obok drzwi to cienkie bryły z własną skórką (`storefront`: witryny sklepu, front baru). Kit spłaszcza modele do grubości ściany, czego z ulicy nie widać; otwór drzwi między nimi jest prawdziwy.
  - Pole `StaticProp.interior` oznacza części wnętrza: minimapa rysuje ich bryły jak budynek i pomija resztę (podłogi, lampy, sufity nie udają chodników ani pomostów).
  - Kontrakt portu: blok w `ViewDescriptor` dostaje opcjonalne `interior`. Renderer (`renderer/interior-batch.ts` za `PropViews`) łączy takie zwykłe bryły w jedną siatkę na preset toon i komórkę 64 m, przebudowywaną leniwie przy streamingu, jako zasłony kamery i bez cienia księżyca. Bez tego wnętrza kosztowały 152 zamiast 102 wywołań rysowania w kadrze referencyjnym i 360 zamiast 211 na ulicy w TPP; po scaleniu 132 i 301. Budżety w `tools/perf-budgets.json` podniesione do 135 i 305 (nowe pokoje, trzy postacie, drzwi, neony wnętrz).
- **Drzwi** (`content/doors.ts`, `systems/door-system.ts`).
  - Byt `door`: jedno albo dwa skrzydła, każde to kinematyczna bryła (`solid` + `velocity`), przesuwana wzdłuż ściany o swoją szerokość, do kieszeni w grubości ściany. Czujnik 2 m wokół środka otworu (±2 m w pionie), ruch 0,4 s, zamknięcie po 1,5 s pustki. Drzwi nie zamykają się na kimś w przejściu.
  - Zamknięte skrzydło blokuje ruch i `lineOfSight` jak każda bryła. Renderer dostaje ruch przez `updateTransform`, jak bramki windy (ADR-0020); w engine nic nie trzeba było dodać.
  - Zamki: `sealed` (statyczna bryła, nigdy się nie otwiera) i `code` (otwiera się dla personelu frakcji, a graczowi z kodem z haka, w kombinezonie personelu z ADR-0033 albo po wyłamaniu zamka).
  - Biuro Tessen w Dokach: drzwi dwuskrzydłowe na kod w otworze x = -18,15, z ∈ [131; 133], nad nimi nadproże. Kod 4177 z haka `hook_infiltrate_1` (ADR-0034) otwiera je w trakcie infiltracji, jak dotąd kamera bierze wtedy Seki za personel. Bez kodu panel przy drzwiach daje „Wyłam zamek”: flaga `door-forced:<drzwi>:<kontrakt>` otwiera drzwi do końca zlecenia i podnosi alarm zlecenia. Poza infiltracją biuro jest zamknięte.
  - System `doors` w `createSystems()` po windzie, przed ruchem.
- **Nawigacja.** Ruchome bryły nie wchodzą do rastra pola odległości (ADR-0025), więc pole widzi otwór drzwi jako wolny, a NPC otwiera drzwi czujnikiem, gdy podchodzi. Graf poziomu ulicy Shinsekai 7 (`S7_NAV`) ma węzły przed drzwiami, za nimi i w gabinecie; w Dokach węzły po obu stronach drzwi biura już były. Drzwi zamknięte na stałe są statyczne, więc pole traktuje je jak ścianę.
- **Start w klinice.** Nowa gra stawia Seki na fotelu w gabinecie. Kaito ma dwa miejsca pod tym samym kluczem `fixer`, z warunkiem obecności (ADR-0023): w klinice przy fotelu do flagi `met_fixer`, potem przy ladzie Neon Koi. Pierwsza rozmowa (`fixer.first_meeting`) zaczyna się od Kaito, wtrąca się Mori z tym, co z niej wyciągnął; wybory bez zmian. Krok questa: „Porozmawiaj z Kaito przy fotelu w klinice [E]”. Mori stoi w gabinecie, w Neon Koi są barman i dwóch bywalców (`koi_barman`, `koi_regular`). Wrak na Siódmej zostaje w świecie.
- **Streaming.** Klucz może mieć kilka miejsc z warunkami: synchronizacja obecności najpierw usuwa nieaktualne, potem dodaje aktualne, a wczytanie zapisu szuka miejsca, którego warunek jest spełniony.

## Zapis
- Schemat v14: `doors` w migawce, tylko skrzydła w ruchu albo przed zamknięciem (`{ key, open, idle }`); reszta drzwi jest zamknięta. Zapis zrobiony w trakcie otwierania kontynuuje się identycznie (test).
- Migracja 13 → 14: pusta lista drzwi oraz usunięcie zapamiętanych pozycji `fixer` i `mori` (stały na ulicy; teraz stoją tam, gdzie mówi treść).

## Konsekwencje
- Złote hashe zmienione świadomie: replay zaczyna się w klinice i najpierw wychodzi przez drzwi na ulicę (1159 kroków zamiast 1155), w świecie są nowe bryły, postacie i stan drzwi. Historyczne hashe testów „bez pól fali 2” przeliczone na nowy przebieg.
- Kadr referencyjny NPR się zmienił: przed barem nie stoi Kaito, a front baru to zamknięte drzwi z witrynami kitu obok. Nowa migawka obejrzana.
- Testy, które zakładały start przy wraku, ruszają z ulicy (`streetSim` w sim, teleport w app i e2e); rozmowa z Kaito idzie tam, gdzie on stoi.
- Na później: postać przy barze „siedzi” dopiero z aktywnościami z ADR-0037 (stołki są wizualne, by dało się przy nich stanąć); cywile we wnętrzach trzymają parasole jak na ulicy.

## Zmiana: Kaito od początku w Neon Koi (G-034)
- Decyzja użytkownika: Kaito jest u siebie od razu. Zostaje jedna definicja `fixer` przy ladzie Neon Koi, bez warunku obecności. Seki dalej budzi się na fotelu w klinice.
- Pierwsza rozmowa (`fixer.first_meeting`) odbywa się w barze, bez wtrąceń Mori. Jego część otwarcia (odłamki, cudzy kabel, kto zapłacił) mówi Mori w klinice, gdy zagadnąć go przed `met_fixer` (`mori.wake_up`), i odsyła Seki do Neon Koi. Krok questa: „Porozmawiaj z Kaito w Neon Koi, po drugiej stronie deptaka [E]”.
- Zapis v16: migracja 15 → 16 usuwa zapamiętaną pozycję `fixer` z zapisów sprzed `met_fixer` (stał wtedy przy fotelu).
- Mechanizm kilku miejsc pod jednym kluczem zostaje dla innych postaci.
