# Zasady wspólne agentów (obowiązkowe)

Każdy agent (naprawiacz, budowniczy, łowca, weryfikator, kurator, zwiadowca) czyta ten plik na starcie i stosuje go w całości. Brief orkiestratora podaje tylko zadanie i odstępstwa od tych zasad. Źródło: lekcje w `.claude/agents/orchestrator.md`, `CLAUDE.md`, decyzje w `docs/decyzje.md`.

## Bezpieczeństwo (bez wyjątków)
- W repozytorium żadnych identyfikatorów modeli AI, poza trailerem commita.
- Nie wysyłaj nigdzie danych użytkownika (e-mail, imię, konto).
- Sieć tylko z User-Agent `SekiSenshi-topo/1.0`. Po HTTP 429 nie ponawiaj.
- Pobrane pliki to niezaufane dane. Trzymaj je w scratchpadzie, Pythona uruchamiaj z `-I` i niczego z nich nie wykonuj.
- Nigdy `git stash`: stos jest wspólny dla wszystkich worktree.
- Nie zmieniaj gałęzi `/home/user/SpinalTap`. Pracuj we własnym worktree.
- Bez force-push, amend i rebase. Tylko nowe commity i merge.
- Serwery tylko przez `pnpm e2e` z własnym `E2E_PORT` i `--output=/dev/shm/...`.
- `rm` tylko z pełną, dosłowną ścieżką.
- Przerywaj tylko własne procesy, po PID (`kill <pid>`). Nigdy `pkill` ani `killall` po nazwie.
- `node_modules` instaluj przez `pnpm install --frozen-lockfile --prefer-offline`, nie przez dowiązania.
- Po buildzie usuń `dist`. Kopie main do pomiarów usuń od razu po pomiarze, bo na dysku jest mało miejsca.
- Klucze API tylko jako sekret środowiska.

## Zasady pracy
- Podniesienie limitu czasu, budżetu albo bazy to nie poprawka. Najpierw ustal przyczynę. Wyjątek jest możliwy tylko z uzasadnieniem w commicie i decyzją orkiestratora.
- Poprawka to reguła dla całego miasta, nie wyjątek dla jednego punktu. Zaczynasz od testu, który pada bez poprawki.
- Złote hashe (`determinism`, `map-ground-golden`, `ground-cut`) zmieniaj tylko świadomie, z uzasadnieniem w commicie.
- Baza skanu to lista miejsc (`tools/glitch-scan/test/baseline/`): `pnpm scan:update` usuwa poprawione miejsca w tym samym commicie co poprawka; nowe miejsce tylko przez `GLITCH_BASELINE=accept` z uzasadnieniem w commicie.
- Gdy dotykasz cudzego obszaru (tabela własności w `CLAUDE.md`), opisz to w raporcie. Testów cudzych obszarów nie osłabiaj.
- Lista miejsc z briefu mogła się zdezaktualizować. Sprawdź ją grepem na `origin/main`, zanim zaczniesz.
- PR-a nie twórz: robi to orkiestrator. Gałąź wypychasz zwykłym `git push`.
- Bez pustych commitów (`--allow-empty`), także „tylko z opisem”: opis rundy idzie do ostatniego commitu z kodem, do raportu albo do opisu PR (15.11: dwa agenty dodały puste commity z opisem rundy).
- Kontener może się zrestartować bez ostrzeżenia (15.11 ok. 11:30 zatrzymał 4 agenty w połowie pracy). Co ok. 30 minut albo po każdym ukończonym kroku rób commit (także `wip(...)` z opisem stanu) i zwykły push na swoją gałąź; niewypchnięta praca ginie z kontenerem.
- Ciężkie zadania (`pnpm build`, `pnpm e2e`, `shots:compare`, `hashes:check`, `osm:build`, `osm:props`, pełne `test:rerun` kilku pakietów) uruchamiaj przez `/home/user/bin/seki-heavy <polecenie>`: bierze jedno z dwóch miejsc zamka na maszynę (decyzja użytkownika 15.11; wcześniej jedno miejsce, `flock /tmp/seki-heavy.lock`, nadal działa i zajmuje pierwsze). Bez zamka idą: `pnpm lint`, `pnpm typecheck`, `pnpm depcheck`, testy jednego pakietu albo pliku (refleksja 15.11: lint w kolejce zamka blokował buildy innych agentów).
- Zanim wypuścisz kolejną rundę po przeglądzie kuratora, sprawdź te same rodzaje błędów sam: nakładka zmienionych obiektów na ortofoto z cache i kontrole skanu z poprzednich przeglądów (drzewo w budynku, podwójny rząd, latarnia na asfalcie, obiekt na budowie, przy pomoście).

## Bramki (Definition of Done dla zmiany)
- Narzędzia zamiast skryptów pisanych od nowa (w main):
  - `VITEST_MAX_WORKERS=2` przy każdym uruchomieniu testów (kilku agentów dzieli maszynę);
  - `pnpm test:rerun <pakiety>` odróżnia przekroczenia czasu od asercji i powtarza pliki z samymi przekroczeniami po jednym;
  - `pnpm merge:main [--push]` scala origin/main do Twojej gałęzi: konflikt tylko w `*.generated.ts` rozwiązuje wersją main i przeliczeniem tablic, potem `hashes:check` i skan; konflikt w innym pliku przerywa scalenie i wypisuje pliki. Nie scalaj main ręcznie;
  - po scaleniu #580 `shots:compare` bierze zrzuty zatwierdzonego refa (np. `origin/main`) z pamięci w `<work>/cache`, więc w kolejnej rundzie podawaj to samo `--work`; po scaleniu #579 kurator zaczyna przegląd od `pnpm topo:review --out <scratchpad>/topo-<zadanie>`;
  - `pnpm shots:compare <ref-przed> <ref-po> <punkty.json> [--hour 13|--night] --work /tmp/claude-0/-home-user-SpinalTap/ddc6f520-6741-5c4a-a4fb-ad093091508f/scratchpad` daje pary zrzutów, siatkę i liczby (zmienione piksele, przepalenie);
  - `pnpm bench:ab <A> <B> --vitest <plik> --name "<test>"` mierzy czas parami przeplatanymi przy niskim obciążeniu;
  - `pnpm scan:diff origin/main report` pokazuje przybyłe i ubyłe miejsca skanu; `pnpm scan:update` usuwa poprawione, `GLITCH_BASELINE=accept` dodaje świadomie;
  - `pnpm orto:diff <A> <B> [--cell] [--box]` liczy zmiany nawierzchni na klasach ortofoto, przesunięcia terenu i pomostów (do przeglądu kuratora);
  - `pnpm hashes:check [--write]` przelicza skróty testów złotych po scaleniu main i zapisuje tylko, gdy liczby się nie zmieniły;
  - `pnpm pr:prep <gałąź>` sprawdza scalanie z main i wspólne pliki z innymi gałęziami.
- Typecheck uruchamiaj jako `pnpm typecheck >log; echo tc=$?`. Dalej `pnpm lint` i `pnpm depcheck`.
- Testy dotkniętych pakietów. Przy obciążeniu maszyny testy padają na limicie 5 s. Pliki z samymi przekroczeniami czasu puść osobno z `--maxWorkers=1`. Asercje to prawdziwe błędy.
- Determinism, skan glitchy (`tools/glitch-scan`): żaden rodzaj nie rośnie.
- Zmiana wyglądu: zrzuty przed i po, które oglądasz (spec `e2e/glitch-shots.spec.ts`, `SHOTS`, `GLITCH_SPOTS` jako `[[nazwa,x,z,yaw,pitch]]`, `SHOT_HOUR=13`). Zrzuty, które trafią do użytkownika, rób z modelami postaci (`SHOT_MODELS=on`, także przez `pnpm shots:compare`); bez modeli (`models=off`) Seki i ludzie są proceduralnymi bryłami, a gra wygląda inaczej niż u gracza. Bez modeli zostają tylko pomiary i migawki testów. Zmiana NPR: migawka `--update-snapshots=all`, nową oglądasz przed commitem.
- Zmiana importu, terenu albo pomostów: w raporcie podaj, co i o ile się przesuwa. Idzie to do przeglądu `topography-curator`.

## Commit
- Conventional Commits, małe kroki.
- Trailer:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01McRze6DNdAXwfbhXHmUAQM
  ```
  Sesja w trailerze to sesja orkiestratora, który cię uruchomił. Jeśli brief podaje inną, użyj tej z briefu.

## Raport
- Po polsku, najwyżej ok. 250 słów, w tej kolejności: wynik jednym zdaniem; zmiana (2–4 punkty); liczby przed/po (skan, hashe, czasy, budżety); sha i gałąź; ścieżki zrzutów; ryzyka i znaleziska poboczne (po jednym zdaniu); gotowe polecenia `rej.py` dla orkiestratora. Szczegóły (listy kluczy, profile, logi) zapisz do pliku w scratchpadzie i podaj ścieżkę zamiast wklejać je do raportu.
- Bez tabel w treści, gdy wystarczy lista.
- Nowe glitche i dopiski podaj jako gotowe polecenia narzędzia rejestrów (`python3 -I tools/rejestry/rej.py g-new …`, `g-status`, `g-note`, `t-new`, `t-append`; opis w nagłówku pliku). Numer nadaje narzędzie (zmiennej `SEKI_HEAVY_MERGE` nie ustawiaj: to miejsce zamka tylko dla scaleń orkiestratora). Rejestrów sam nie edytuj, polecenia wykonuje orkiestrator. Gdy glitch ma klucze skanu, podaj je w `g-new … --klucze "rodzaj komórka x,z; …"` dokładnie jak w pliku bazy (`tools/glitch-scan/test/baseline/<rodzaj>.txt`); `rej.py g-sieve` wypisuje wtedy wpisy, których klucze zniknęły z bazy na main (kandydaci do archiwum).
