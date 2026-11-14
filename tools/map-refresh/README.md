# tools/map-refresh: odświeżenie mapy jedną komendą

Decyzja użytkownika z 14.11 (backlog, strategia, punkt 3: lżejszy proces). Odświeżenie miasta z danych kosztuje czas maszyny, nie tokeny. Agent albo kurator jest potrzebny dopiero wtedy, gdy raport pokaże coś powyżej progu.

```
pnpm map:refresh [--offline] [--sources=osm,gugik,orto] [--from-cache] [--skip=<krok|grupa>,…] [--twice]
```

## Kroki (w tej kolejności)
1. **Pobranie** (sieć, grupa `fetch`): `osm-fetch` (`tools/osm-import/src/fetch.ts --refresh`: wyciągi dzielnic i NMT, od PR #550 także `data/osm/points/furniture.json`), `osm-hydrants`, `osm-entrances`, `osm-trees`, `gugik-fetch` (LoD1, LoD2, BDOT10k do pamięci podręcznej poza repo), `orto-fetch --all` (kafle ortofoto do pamięci podręcznej, tylko brakujące).
2. **Wyciągi** (grupa `extract`, bez sieci): `gugik-extract` i `orto-build` z pamięci podręcznych do `data/gugik` i `data/orto`. Krok bez pamięci podręcznej jest pomijany, więc nie zeruje danych w repo.
3. **Budowa** (grupa `build`): `osm-build` (z `--stats`, liczby szerokości jezdni i barier) i `osm-props`.
4. **Kontrole** (grupa `check`): skan glitchy bez zmiany bazy (`GLITCH_BASELINE` pusty) i `hashes:check` bez zapisu. Ich niezerowy kod to wynik, nie błąd.
5. **Raport** `reports/map-refresh.md` i `.json`: zmienione pliki z rozmiarami, liczba obiektów według rodzaju (listy kawałków i rodzaje mebli `prop:*`), pola nawierzchni według rodzaju i kawałka, klucze skanu przybyłe i ubyłe według rodzaju, testy złote, które by się zmieniły, źródła szerokości jezdni przed i po oraz `orto:diff` bazy z drzewem roboczym, gdy tablice się zmieniły. Na końcu werdykt.

Logi kroków i pliki pośrednie leżą w `reports/map-refresh/`, czasy kroków w `reports/map-refresh/times.json`. Raport nie zawiera czasu ani ścieżek, więc jest deterministyczny.

## Flagi
- `--offline`: bez sieci. Wyciągi tylko z `--from-cache` (z lokalnych pamięci podręcznych). Buduje i sprawdza z danych w repo.
- `--sources=osm,gugik,orto`: które źródła pobrać i wyciągnąć (domyślnie wszystkie).
- `--skip=scan,hashes,orto-diff,fetch,…`: pomija kroki albo całe grupy.
- `--twice`: po pierwszym przebiegu buduje drugi raz i sprawdza, że pliki są bajt w bajt te same (krok `twice`).
- Kod wyjścia: 0, gdy każdy krok się udał (bez względu na werdykt), 1 po nieudanym kroku (reszta jest pomijana, raport powstaje), 3 po HTTP 429.

## Sieć
User-Agent `SekiSenshi-topo/1.0`, bez ponowień po HTTP 429 (zasady agentów). Gdy krok pobrania padnie z 429, odświeżenie kończy się czytelnym komunikatem i kodem 3. Następna próba to następny przebieg, nie pętla. Przed pobraniem komenda sprawdza, czy `osm:fetch` w tym checkoucie spełnia te zasady. Jeśli nie, odmawia pracy online.

Manifesty `data/gugik/sources.json` i `data/orto/sources.json` dostają z powrotem stary tekst, gdy różnią się tylko datą pobrania (`fetched`). Te same pliki pobrane drugi raz nie są zmianą mapy.

## Werdykt i progi
„Bez przeglądu”, gdy jednocześnie:
- wszystkie kroki się udały, a skan przebiegł;
- nie przybył klucz skanu w rodzaju S1–S3 (rodzaje S4 w `S4_KINDS` w `src/config.ts`; to propozycja, a rodzaj trafia tam tylko decyzją zapisaną w `docs/glitches.md`);
- obiektów razem przybyło lub ubyło mniej niż 2%, a żaden rodzaj nie zmienił się o więcej niż max(2%, 2 sztuki);
- nawierzchnia przesunęła się o mniej niż 1 m² (suma |Δ pola| po rodzajach w tablicach i zmienione m² w `orto:diff`);
- teren nie przesunął się o więcej niż 0,05 m, a żaden pomost się nie zmienił (`orto:diff`);
- testy złote różnią się co najwyżej samym skrótem. Wtedy w PR wystarczy `pnpm hashes:check --write`.

W przeciwnym razie werdykt to „przegląd kuratora”, z listą miejsc: klucze skanu (rodzaj, kawałek, x,z), kawałki ze zmianą nawierzchni, komórki `orto:diff`, rodzaje obiektów powyżej progu. Progi są w `THRESHOLDS` w `src/config.ts`.

## Workflow `.github/workflows/map-refresh.yml`
Uruchamia się co tydzień (poniedziałek 03:17 UTC) i ręcznie (`workflow_dispatch`, pole `sources`). Puszcza `pnpm map:refresh`. Gdy zmieniły się `data/` albo tablice, wypycha gałąź `map-refresh/<data>` i otwiera PR z raportem w opisie. Pełny raport i logi są artefaktem przebiegu.

Ograniczenia:
- **PR otwarty przez `GITHUB_TOKEN` nie uruchamia innych workflow**, więc CI nie ruszy sam. Możliwości (do decyzji właściciela repo):
  1. token PAT (fine-grained, `contents` i `pull-requests` na to repo) jako sekret środowiska repo, użyty w kroku PR zamiast `github.token`. Wtedy push i PR uruchamiają CI normalnie;
  2. ręczne „Update branch” w PR albo pusty commit przez człowieka: zdarzenie od użytkownika uruchamia CI;
  3. `workflow_dispatch` w `ci.yml` i ręczne uruchomienie CI na gałęzi `map-refresh/…`.
  Narzędzie nie tworzy sekretów.
- **Ustawienie „Allow GitHub Actions to create and approve pull requests”** (Settings > Actions > General > Workflow permissions) bywa wyłączone. Wtedy gałąź jest już wypchnięta, a krok kończy się błędem z instrukcją, gdzie je włączyć albo jak otworzyć PR ręcznie.
- Opis PR ma limit 65 536 znaków, więc trafia do niego najwyżej 60 000 znaków raportu.

## Testy
`tools/map-refresh/test/report.test.ts` sprawdza różnice dwóch stanów, werdykt, Markdown, przywracanie manifestów i rozpoznanie 429. `test/refresh.test.ts` puszcza całą komendę offline na małym, sztucznym repo: dwa przebiegi dają te same pliki bajt w bajt (raport też), nowe dane pokazują się w raporcie, a niedeterministyczna budowa daje nieudany krok `twice`.
