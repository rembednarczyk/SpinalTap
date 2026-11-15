# ADR-0083: Testy całego miasta bez wyścigu z limitem czasu

Status: proponowany (15.11, prośba użytkownika: „wymyśl sposób na krótsze testy, aby unikać timeoutów, bo to stale wraca”). Uzupełnia ADR-0046 (testy) i `docs/plany/czas-testow.md`.

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

## Konsekwencje
- Krok 1 i 2 to ok. dzień pracy jednego agenta, bez zmian gry, zapisu i hashy; kroki 3 i 4 po pomiarze kroków 1–2.
- Tablice: nagłówek z odciskiem zmienia jeden wiersz `*.generated.ts`; `pnpm merge:main` przelicza je jak dotąd.
- Ryzyko kroku 1: odcisk musi obejmować wszystkie wejścia generatora, inaczej przegapi zmianę. Zabezpieczenie: job `tables` porównuje bajt w bajt przy każdej zmianie w `tools/osm-import`, `tools/orto` i `data/`.
- Ryzyko kroku 2: zmienność maszyn CI. Mediana z kilku przebiegów main i próg względny 30%; pojedyncze odstające uruchomienie powtarzane raz.
