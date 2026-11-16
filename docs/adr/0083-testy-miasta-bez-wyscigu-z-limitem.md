# ADR-0083: Testy całego miasta bez wyścigu z limitem czasu

Status: przyjęty (15.11, kroki 1–2 od razu, 3–4 po pomiarze; prośba użytkownika: „wymyśl sposób na krótsze testy, aby unikać timeoutów, bo to stale wraca”). Uzupełnia ADR-0046 (testy) i `docs/plany/czas-testow.md`.

## Kontekst
Limit 20 s na test (`vitest.config.ts`) chroni przed zawieszeniem, ale testy całego miasta rosną z każdą regułą importu i co kilka dni któryś go przekracza: paving-overlap (#566), kerb-fill-wide-estimated (#568), a 15.11 `props.test > matches the committed table` (20,5 s na main, blokuje #573, #574, #578, #579). Każdy raz to ręczne przyspieszanie po fakcie, w cudzym PR.

Pomiar z CI 15.11 (shard 1, job 132778962156): `glitch-scan.test.ts` 197 s, `traffic-junction-drive` 153 s, `determinism` 101 s, `props.test` 33 s; najdłuższy pojedynczy test 49,7 s. Shard jednostkowy trwa ok. 18 min, a testy `tools/*` idą pod instrumentacją pokrycia, choć pokrycie ich nie liczy.

Przyczyny:
1. Test „tablica zgodna z generatorem” generuje całe miasto od nowa, żeby sprawdzić, czy ktoś nie zapomniał `pnpm osm:props`.
2. Testy miasta budują te same struktury (świat, grunt, indeksy skanu) w każdym pliku osobno.
3. Czas testu rośnie po cichu: ostrzeżenie o czasie nie zatrzymuje PR-u, który spowolnił test, więc limit przekracza dopiero następny, niewinny PR.
4. Testy miasta i szybkie testy logiki dzielą jeden limit i jedną maszynę z pokryciem.

## Decyzja (proponowana, w kolejności wdrożenia)
1. **Odcisk wejść zamiast ponownego generowania.** `osm:build` i `osm:props` zapisują w nagłówku tablicy skrót SHA-1 wejść (pliki `data/` i `tools/osm-import/src`, `tools/orto/src`, które je czytają). Test jednostkowy porównuje tylko odcisk (milisekundy) i mówi, co przeliczyć. Pełne przeliczenie i porównanie bajt w bajt robi raz osobny job CI `tables` (`osm:build && osm:props && git diff --exit-code`), uruchamiany tylko, gdy zmieniły się wejścia (filtr „What changed”). Usuwa całą klasę jak `props.test` 15.11.
2. **Bramka połowy limitu.** Job „Unit test time” przestaje tylko ostrzegać: PR pada, gdy któryś test przekracza 50% swojego limitu albo rośnie o ponad 30% wobec mediany z main (dane już zbiera `tools/test-time`). Spowolnienie łapie PR, który je wprowadził, z zapasem, zanim cokolwiek przekroczy limit.
3. **Wspólna pamięć miasta.** Kosztowne struktury (świat z treści `lublin`, grunt, indeksy skanu) liczone raz na proces robotnika i zapisywane w `node_modules/.cache/seki-city/<odcisk>`; testy biorą je stamtąd. Odcisk z kroku 1 jest kluczem, więc pamięć nie może się zestarzeć.
4. **Osobny projekt „city”.** Testy `tools/*` i testy całego miasta w `sim` (skan, ruch, determinizm) idą w osobnym jobie bez instrumentacji pokrycia, równolegle do shardów. Ich straż przed zawieszeniem to 120 s na test, a właściwą bramką jest krok 2 (trend i połowa budżetu tego projektu). To zmiana granic, nie podniesienie limitu: wpis do długu w ADR-0046 z pomiarem przed i po.

### Kalibracja bramki czasu (15.11, decyzja użytkownika)
Pierwsze przebiegi pokazały, że ten sam test na wspólnej maszynie CI waha się o 20–30%: w #585, bez zmian w symulacji, dwa testy tłumu wyszły 10,4 i 11,2 s przy progu 10 s. Odtąd próg połowy limitu dotyczy tylko nowych testów (których nie mają przebiegi main); każdy test pada powyżej 75% limitu; test, który main zna, pilnuje wzrost wobec mediany main (+30% i +1 s). Bez żadnego przebiegu main obowiązuje tylko 75% (PR #585).

### Zakres odcisku tablic (15.11, PR #585)
Odcisk w nagłówku obejmuje tylko wejścia mapy (`OWNED`) i dane; zmianę w `sim` czy `engine`, która zmienia tablice, łapie job Map tables, uruchamiany przy każdej zmianie kodu.

### Krok 3 wdrożony inaczej (16.11, gałąź ccr-ec2c4269-ilh8k8-adr83-krok3)
Profil pokazał, że w testach sim z wyjątkami 55–70% czasu to rastry i pola nawigacji (`fieldSteps`, `nav-field.ts`), a budowa świata i gruntu to poniżej 0,4 s na plik. Wspólna pamięć jest więc w pamięci procesu robotnika (`tools/city-cache`, LRU 128 MB + 128 MB, haczyk `shareNav` w `systems/ai/nav-share.ts`, w grze niezainstalowany), a nie na dysku: rastry zależą od kodu sim spoza odcisku `OWNED`, więc klucz dyskowy mógłby się zestarzeć. Klucz z treści (kształty brył, tożsamość gruntu, okno). `SEKI_CITY_CACHE=off` wyłącza. Wynik: suma testów z wyjątkami 209 → 142 s, 13 z 25 wpisów `exceptions.ts` usunięte, złote hashe bez zmian.

## Konsekwencje
- Krok 1 i 2 to ok. dzień pracy jednego agenta, bez zmian gry, zapisu i hashy; kroki 3 i 4 po pomiarze kroków 1–2.
- Tablice: nagłówek z odciskiem zmienia jeden wiersz `*.generated.ts`; `pnpm merge:main` przelicza je jak dotąd.
- Ryzyko kroku 1: odcisk musi obejmować wszystkie wejścia generatora, inaczej przegapi zmianę. Zabezpieczenie: job `tables` porównuje bajt w bajt przy każdej zmianie w `tools/osm-import`, `tools/orto` i `data/`.
- Ryzyko kroku 2: zmienność maszyn CI. Mediana z kilku przebiegów main i próg względny 30%; pojedyncze odstające uruchomienie powtarzane raz.
