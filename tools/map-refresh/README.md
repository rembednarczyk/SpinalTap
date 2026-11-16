# tools/map-refresh: odświeżenie mapy jedną komendą

Decyzja użytkownika z 14.11 (backlog, strategia, punkt 3: lżejszy proces). Odświeżenie miasta z danych kosztuje czas maszyny, nie tokeny. Agent albo kurator jest potrzebny dopiero wtedy, gdy raport pokaże coś powyżej progu.

```
pnpm map:refresh [--offline] [--sources=osm,gugik,orto] [--from-cache] [--skip=<krok|grupa>,…] [--twice]
```

## Kroki (w tej kolejności)
1. **Pobranie** (sieć, grupa `fetch`): `osm-fetch` (`tools/osm-import/src/fetch.ts --refresh`: wyciągi dzielnic i NMT, od PR #550 także `data/osm/points/furniture.json`), `osm-hydrants`, `osm-entrances`, `osm-trees`, `gugik-fetch` (LoD1, LoD2, BDOT10k do pamięci podręcznej poza repo), `nmpt-fetch` (NMPT 0,5 m z WCS geoportalu, kafle 250 m do `seki-gugik/nmpt`, tylko brakujące), `orto-fetch --all` (kafle ortofoto do pamięci podręcznej, tylko brakujące).
2. **Wyciągi** (grupa `extract`, bez sieci): `gugik-extract`, `nmpt-extract` (NMPT − NMT do `data/gugik/nmpt`, wysokości drzew) i `orto-build` z pamięci podręcznych do `data/gugik` i `data/orto`. Krok bez pamięci podręcznej jest pomijany, więc nie zeruje danych w repo.
3. **Budowa** (grupa `build`): `osm-build` (z `--stats`, liczby szerokości jezdni i barier) i `osm-props`.
4. **Kontrole** (grupa `check`): skan glitchy bez zmiany bazy (`GLITCH_BASELINE` pusty) i `hashes:check` bez zapisu. Ich niezerowy kod to wynik, nie błąd.
5. **Raport** `reports/map-refresh.md` i `.json`: zmienione pliki z rozmiarami, liczba obiektów według rodzaju (listy kawałków i rodzaje mebli `prop:*`), pola nawierzchni według rodzaju i kawałka, klucze skanu przybyłe i ubyłe według rodzaju, testy złote, które by się zmieniły, źródła szerokości jezdni przed i po oraz `orto:diff` bazy z drzewem roboczym, gdy tablice się zmieniły. Na końcu werdykt.

Logi kroków i pliki pośrednie leżą w `reports/map-refresh/`, czasy kroków w `reports/map-refresh/times.json`. Raport nie zawiera czasu ani ścieżek, więc jest deterministyczny.

## Flagi
- `--offline`: bez sieci. Wyciągi tylko z `--from-cache` (z lokalnych pamięci podręcznych). Buduje i sprawdza z danych w repo.
- `--sources=osm,gugik,orto`: które źródła pobrać i wyciągnąć (domyślnie wszystkie).
- `--skip=scan,hashes,orto-diff,fetch,…`: pomija kroki albo całe grupy.
- `--twice`: po pierwszym przebiegu buduje drugi raz i sprawdza, że pliki są bajt w bajt te same (krok `twice`).
- Kod wyjścia (`EXIT` i `exitCodeOf` w `src/pipeline.ts`):
  - 0: raport pełny, werdykt „bez przeglądu”;
  - 2: raport pełny, werdykt „przegląd kuratora” (próg przekroczony, nowy klucz skanu albo źródło nieświeże po nieudanym pobraniu; skan i testy złote przebiegły);
  - 3: HTTP 429, odświeżenie przerwane bez ponowienia;
  - 1 i każdy inny: błąd narzędzia (nieudany krok inny niż pobranie, np. budowa, `twice`, albo wyjątek). Reszta kroków jest wtedy pomijana. Raport powstaje, ale nie jest pełny.

  0 i 2 to udany przebieg: workflow otwiera PR w obu przypadkach.

## Sieć
User-Agent `SekiSenshi-topo/1.0`, bez ponowień po HTTP 429 (zasady agentów). Gdy krok pobrania padnie z 429, odświeżenie kończy się czytelnym komunikatem i kodem 3. Następna próba to następny przebieg, nie pętla.

Zerwane połączenie (ECONNRESET, ETIMEDOUT) to nie 429: `orto-fetch` ponawia takie zapytanie raz, po 5 s (`tools/orto/src/http.ts`). Gdy krok pobrania padnie mimo to (drugie zerwanie, inny błąd HTTP), jego źródło jest **nieświeże**: pozostałe kroki tego źródła (dalsze pobrania i wyciąg) są pomijane, więc jego dane zostają takie, jak w repo, a nie z niepełnej pamięci podręcznej. Budowa, skan i testy złote przebiegają mimo to. Raport wymienia nieświeże źródła na górze i w werdykcie (zawsze „przegląd kuratora”), a kod wyjścia to 2. Nieudany krok poza pobraniem zatrzymuje resztę jak dotąd. Przed pobraniem komenda sprawdza, czy `osm:fetch` w tym checkoucie spełnia te zasady. Jeśli nie, odmawia pracy online.

Manifesty `data/gugik/sources.json` i `data/orto/sources.json` dostają z powrotem stary tekst, gdy różnią się tylko datą pobrania (`fetched`). Te same pliki pobrane drugi raz nie są zmianą mapy.

## Werdykt i progi
„Bez przeglądu”, gdy jednocześnie:
- wszystkie kroki się udały, a skan przebiegł;
- nie przybył klucz skanu w rodzaju S1–S3 (rodzaje S4 w `S4_KINDS` w `src/config.ts`; nowy rodzaj trafia tam tylko decyzją zapisaną w `docs/glitches.md`);
- obiektów razem przybyło lub ubyło mniej niż 2%, a żaden rodzaj nie zmienił się o więcej niż max(2%, 2 sztuki);
- nawierzchnia przesunęła się o mniej niż 1 m² (suma |Δ pola| po rodzajach w tablicach i zmienione m² w `orto:diff`);
- teren nie przesunął się o więcej niż 0,05 m, a żaden pomost się nie zmienił (`orto:diff`);
- testy złote różnią się co najwyżej samym skrótem. Wtedy w PR wystarczy `pnpm hashes:check --write`.

W przeciwnym razie werdykt to „przegląd kuratora”, z listą miejsc: klucze skanu (rodzaj, kawałek, x,z), kawałki ze zmianą nawierzchni, komórki `orto:diff`, rodzaje obiektów powyżej progu. Progi są w `THRESHOLDS` w `src/config.ts`. Przyjął je użytkownik 14.11 razem z listą `S4_KINDS`.

## Workflow `.github/workflows/map-refresh.yml`
Uruchamia się co tydzień (poniedziałek 03:17 UTC) i ręcznie (`workflow_dispatch`, pole `sources`). Puszcza `pnpm map:refresh`. Po kodzie 0 albo 2, gdy zmieniły się `data/` albo tablice, wypycha gałąź `map-refresh/<data>` i otwiera PR z raportem w opisie. Tytuł mówi „bez przeglądu” albo „przegląd kuratora” i wymienia nieświeże źródła. Bez zmian PR nie powstaje. Po kodzie 3 (HTTP 429) i po błędzie narzędzia PR też nie powstaje, a job kończy się na czerwono z komunikatem. Pełny raport i logi są artefaktem przebiegu.

Pamięci podręczne kafli ortofoto (`~/.cache/seki-orto`) i archiwów GUGiK (`~/.cache/seki-gugik/*.zip`) są trzymane między przebiegami w `actions/cache`. `orto-fetch` i `gugik-fetch` pobierają tylko to, czego w nich brak, więc przebieg z pełną pamięcią nie pyta usług ortofoto ani GUGiK o nic. Pierwszy przebieg bez niej (14.11) pobierał 20 z 60 kafli przez 297 s i padł na jednym zerwaniu połączenia.
- Klucz ortofoto: `orto-v1-<rok>-<skrót data/orto/sources.json i tools/orto/src/config.ts>`. Zdjęcia lotnicze zmieniają się mniej więcej raz w roku, więc nowe zdjęcie przychodzi z pierwszym przebiegiem roku. W ciągu roku przebieg zaczyna od ostatniego wpisu tego roku, także po zmianie manifestu.
- Klucz GUGiK: `gugik-v1-<rok-miesiąc>-<skrót data/gugik/sources.json i tools/gugik/src/sources.ts>`. Archiwa są pobierane raz w miesiącu.
- Wpis nosi w nazwie odcisk swoich plików (nazwy i rozmiary), więc nowy powstaje tylko wtedy, gdy przybyły pliki. Zapis idzie także po nieudanym przebiegu, więc przerwane pobieranie następnym razem idzie dalej od ostatniego kafla. Wpisy nieużywane przez 7 dni GitHub usuwa sam. Cotygodniowy przebieg odczytuje bieżące, więc te zostają.

Ograniczenia:
- **CI uruchamia sam workflow** (decyzja użytkownika 14.11). PR otwarty przez `GITHUB_TOKEN` nie uruchamia innych workflow, więc po otwarciu PR `map-refresh.yml` wywołuje `ci.yml` przez `workflow_dispatch` na gałęzi `map-refresh/<data>` (`gh workflow run ci.yml --ref <gałąź>`, uprawnienie `actions: write`). Przebieg dotyczy tego samego commita co głowa PR, więc jego wyniki widać w sprawdzeniach PR. Przy `workflow_dispatch` job „What changed” nie ma bazy do porównania (ani PR, ani `before`), więc puszcza wszystko. Pomijanie już przetestowanego kodu działa tylko przy pushu do main. Gdy uruchomienie CI się nie uda, krok kończy się błędem z instrukcją („Actions > CI > Run workflow”). Nowy commit człowieka w gałęzi uruchamia CI normalnie, jak w każdym PR.
- **Ustawienie „Allow GitHub Actions to create and approve pull requests”** (Settings > Actions > General > Workflow permissions) bywa wyłączone. Wtedy gałąź jest już wypchnięta, a krok kończy się błędem z instrukcją, gdzie je włączyć albo jak otworzyć PR ręcznie.
- Opis PR ma limit 65 536 znaków, więc trafia do niego najwyżej 60 000 znaków raportu.

## Testy
`tools/map-refresh/test/report.test.ts` sprawdza różnice dwóch stanów, werdykt, Markdown, przywracanie manifestów i rozpoznanie 429. `test/refresh.test.ts` puszcza całą komendę offline na małym, sztucznym repo: dwa przebiegi dają te same pliki bajt w bajt (raport też), nowe dane pokazują się w raporcie, a niedeterministyczna budowa daje nieudany krok `twice`. Ten sam plik puszcza krok pobrania ortofoto przez `tools/orto/src/http.ts` na fałszywej sieci: jedno zerwanie i sukces, dwa zerwania (krok nieudany, źródło nieświeże, skan przebiega) oraz 429 (bez powtórki, przerwanie).
