# Pokrycie przeglądów mapy i opieka nad mapą

Rejestr `docs/mapa-pokrycie.json` mówi, które miejsca miasta ktoś przejrzał w całości, które poprawiono i które są czyste. Uzupełnia rejestry tematyczne: glitche (`docs/glitches.md`), odstępstwa od topografii (`docs/topografia.md`) i bazę skanu (`tools/glitch-scan/test/glitch-baseline.json`).

## Format

Jedna komórka na chunk importu miasta (`MAP_CHUNKS`, 20 prostokątów od ok. 150 × 200 m do 220 × 250 m). Pola komórki:

| pole | znaczenie |
|---|---|
| `id` | id chunka z importu, np. `krakowskie-2-1` |
| `dzielnica` | dzielnica importu, prefiks id (`krakowskie`, `stare-miasto`, `podzamcze`, `nabrzeze`) |
| `dzielnicaGry` | dzielnica gry chunka (`shinsekai-7`, `kanal`, `targ`, `doki`) |
| `bounds` | prostokąt chunka w metrach świata, taki sam jak w imporcie |
| `status` | `nieprzejrzane`, `przejrzane`, `poprawione` albo `czyste` |
| `data` | kiedy ustawiono status (`RRRR-MM-DD`); `null` przy `nieprzejrzane` |
| `pr` | PR-y z poprawkami w komórce |
| `wierszeT` | wiersze `docs/topografia.md` z miejscem (x, z) w komórce: `otwarte` (do poprawy) i `rozwiazane` |
| `przeglady` | audyty i przeglądy kuratora, które dotknęły komórki, krótko |
| `notatka` | co sprawdzono, czego nie, co dalej |

Wiersz T z kilkoma miejscami trafia do każdej komórki, w której ma miejsce. Wiersze `celowe` z miejscem w komórce trafiają do `rozwiazane` (praktyka przeglądów od 12.11).

## Statusy

- `nieprzejrzane`: nikt nie przeszedł całej komórki. Punktowe wiersze T i poprawki mogą już być, są historią w `wierszeT` i `pr`.
- `przejrzane`: opiekun mapy przeszedł całą komórkę (skan, zrzuty, sondy, porównanie z OSM i NMT), zgłosił znaleziska jako glitche i wiersze T, a kurator przyjął przegląd.
- `poprawione`: po przeglądzie wszystkie znaleziska komórki mają poprawki w main (co najmniej jeden PR), ale skan wciąż ma w niej trafienia albo zostały wiersze T odłożone decyzją.
- `czyste`: po przeglądzie, 0 otwartych wierszy T i 0 trafień skanu w komórce.

Test pilnuje: każdy chunk ma komórkę, statusy z listy, data przy każdym statusie poza `nieprzejrzane`, PR przy `poprawione`, przy `czyste` brak otwartych wierszy T (`tools/glitch-scan/test/map-coverage.test.ts`) i 0 trafień skanu (ostatni test w `glitch-scan.test.ts`, po wszystkich rodzajach).

**Trafienie** to rodzaj glitcha w kwadracie 10 × 10 m. Gęste kontrole (`landuse-bare` co 0,5 m, `sidewalk-under-carriageway` wzdłuż drogi) liczą się raz na kwadrat; raport podaje też surową liczbę znalezisk. Rodzaje z niezerową bazą (np. `lane-dead-end`) też są trafieniami: komórka z nimi nie jest czysta, dopóki baza nie spadnie albo kontrola nie wyłączy przypadku celowego.

## Stan początkowy (7.11)

Wszystkie 20 komórek ma status `nieprzejrzane`. Audyty 1 i 2 z 31.10 objęły całe dzielnice, ale tylko topografię (położenie, skala, nazwy ulic, teren), a przeglądy PR-ów i wiersze T dotyczą punktów. Żadna komórka nie przeszła jeszcze pełnego przejścia opiekuna, więc żadna nie jest `przejrzane`. Historia z `docs/topografia.md` (gałąź rejestrów, T-001…T-240) jest wpisana w `wierszeT`, `pr` i `przeglady`: 19 z 20 komórek ma co najmniej jeden poprawiony wiersz T. Raport pokazuje ten odsetek w osobnej kolumnie, poza statusem.

## Raport i plansza

```sh
pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts   # pisze reports/map-coverage-hits.json
node tools/glitch-scan/src/coverage-report.ts                      # procenty, kolejka; reports/map-coverage.json
python3 -I tools/glitch-scan/coverage_board.py reports/map-coverage.json <katalog>/plansza.png
```

Raport podaje procent komórek w każdym statusie dla miasta i dzielnic oraz kolejkę 10 komórek: najmniej przejrzane najpierw, potem najwięcej trafień, potem najwięcej otwartych wierszy T. Plansza rysuje komórki w kolorach statusów, z trafieniami, otwartymi wierszami T, najczęstszymi rodzajami i miejscem w kolejce. Planszy nie commitujemy.

## Instrukcja dla opiekuna mapy

Stały slot (prośba użytkownika 7.11): kiedy slot jest wolny, opiekun bierze komórkę z kolejki.

1. **Wybór.** Pierwsza komórka z kolejki raportu, chyba że orkiestrator wskaże inną. Komórkę wpisz w `docs/backlog.md` jako zajętą, żeby dwa sloty jej nie dzieliły.
2. **Łowy** (metody agenta `glitch-hunter`): skan i `reports/glitch-scan.json` przefiltrowany do prostokąta komórki, sondy na danych gry, zrzuty z gry w siatce punktów komórki (z poziomu oczu i z góry), porównanie z OSM, NMT i ortofoto. Znaleziska zgłaszasz w `docs/glitches.md` (glitche) i `docs/topografia.md` (odstępstwa), z miejscem (x, z), żeby trafiały do komórki.
3. **Przejście do `przejrzane`** (decyzja użytkownika 12.11, oszczędność tokenów). Najpierw czytaj gotowe sekcje raportu `node tools/orto/src/report.ts --cell <id>` (dopasowanie obrysów do LoD2 po IoU, przechył nalotów ortofoto, podział gołego terenu na podwórza, przedpola, szczeliny i próbki w obrysach LoD2), zamiast pisać własne sondy; własną sondę piszesz tylko na pytanie, na które raport nie odpowiada, i zgłaszasz ją jako kandydata na nową sekcję. Gdy wszystkie trafienia komórki należą do znanych glitchy i wierszy T, a raport nie pokazuje nowej klasy, opiekun sam zamyka komórkę (status, data, wiersze T, wpis w `przeglady`, notatka) bez osobnego przeglądu kuratora; kurator przegląda takie komórki paczką co kilka komórek. Nowe znalezisko (nowy glitch, nowy wiersz T, zmiana klasy) przechodzi przegląd kuratora jak dotąd.
4. **Poprawki.** Każda poprawka to osobna gałąź i osobny PR, jeden glitch na commit, z przeglądem kuratora; poprawka kontrolowanego rodzaju obniża bazę skanu w tym samym commicie, a nowy policzalny rodzaj dostaje kontrolę w skanie (osobny PR).
5. **Przejście do `poprawione`.** Kiedy ostatnie znalezisko przeglądu jest w main: PR-y w `pr`, wiersze z `otwarte` do `rozwiazane`.
6. **Przejście do `czyste`.** Tylko gdy skan ma w komórce 0 trafień i nie ma otwartych wierszy T; test to sprawdza. Trafienie, które jest celowe, wymaga zmiany kontroli albo wpisu wyjątku w skanie, nie wpisu w rejestrze.
7. **Rejestry razem.** Zmiana statusu komórki idzie w tym samym PR co wpisy w `docs/glitches.md` i `docs/topografia.md`, których dotyczy. Na koniec raport i plansza do raportu dla orkiestratora.

Komórka wraca do `przejrzane`, kiedy zmiana w niej (import, sceny, meble) doda trafienia albo kurator zgłosi nowe odstępstwo.

## Propozycja kontroli dla G-508 (kanciaste górki terenu)

Skan nie ma dziś kontroli, która liczy G-508. Propozycja (osobny PR, nie wprowadzona): `terrain-crease`. Dla każdej siatki `SHAPED_TERRAIN` (teren z padami i rampami) policzyć normalne obu trójkątów każdej komórki siatki (cięcie przekątną takie jak w siatce terenu renderera; `terrainHeightAt` w symulacji interpoluje dwuliniowo, więc kontrola musi wziąć cięcie z renderera) i kąt między normalnymi sąsiednich trójkątów przez wspólną krawędź. Trafienie: kąt ponad próg (do ustalenia pomiarem, na start 20°) poza padami, rampami, wykopami (`PADS`, `RAMPS`, `FLIGHT_RAMPS`) i obrysami budynków, miejsce `at` w środku krawędzi. Baza z całego miasta, a rozkład kątów w raporcie pomoże dobrać próg tak, żeby łapał to, co widać na zrzutach, a nie naturalne skarpy z NMT. Druga, tańsza wersja: różnica nachylenia między sąsiednimi komórkami siatki ponad próg. Kontrola trafi do kolejki opiekuna przez trafienia na komórkę.
