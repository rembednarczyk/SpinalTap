# Skan glitchy (ADR-0054)

`test/glitch-scan.test.ts` szuka w całym mieście znanych rodzajów glitchy (jeden test na rodzaj, lista `CHECKS`). Każde trafienie dostaje stały klucz miejsca, a baza to lista znanych kluczy (decyzja z 13.11: baza po miejscach, nie po liczbie). Nowe miejsce glitcha czerwieni test nawet wtedy, gdy suma rodzaju spada, bo inny błąd ubył.

## Klucz
Klucz to `<kawałek> <x>,<z>` w pliku rodzaju (`src/scan-keys.ts`):
- **siatka 1 m** (domyślna) dla rodzajów, które znajdują jedną rzecz: mebel, budynek, koniec pasa, pad. `x,z` to zaokrąglone współrzędne świata. Klucz trwa, dopóki rzecz nie przesunie się o pół metra. Dwa trafienia na jednym metrze (np. dwa pasy kończące się w jednym punkcie) dają jeden klucz z licznikiem ` *2`. Klucz znaleziony częściej, niż mówi baza, też czerwieni test.
- **kwadrat 10 m** dla rodzajów liczonych w próbkach co metr albo gęściej (`SAMPLED_KINDS`: `landuse-bare`, `ground-strip-overlap`, `kerb-gap-bare`, pasy i chodniki próbkowane wzdłuż linii…). `x,z` to róg kwadratu o najmniejszych x i z, ta sama siatka co `HIT_SQUARE` rejestru pokrycia. Poprawka, która przesuwa pas o kilka centymetrów, przestawia każdą próbkę, ale nie kwadraty. Liczba próbek w kwadracie nie jest zapisana i nie jest bramką, bo zmienia się przy każdym drobnym przesunięciu.
- **kawałek** (`krakowskie-0-1`) to komórka rejestru pokrycia z miejscem klucza (`cellAt`), a `poza` oznacza miejsce poza kawałkami. Granice kawałków leżą na siatce 10 m, więc kwadrat zawsze należy do jednego kawałka.
- trafienie bez `x,z` w polu `at` (wada modelu pojazdu `traffic …`, budynek, którego brak na mapie, filar Arkad liczony w metrach wzdłuż budynku `a 12.34`) ma klucz `? <tekst at>` albo `? <what>`, gdy `at` to sam znak (`?`, `-`). Kiedy `at` zawiera kilka par, liczy się ostatnia (`patrol lane from 1,2 at 30.4,40.6 y 7`).

Pliki bazy: `test/baseline/<rodzaj>.txt`. Pierwszy wiersz to nagłówek z siatką rodzaju, potem jeden klucz na wiersz, posortowane po kawałku, z i x. Rodzaj bez trafień nie ma pliku. Zmiana siatki rodzaju unieważnia jego plik (nagłówek się nie zgadza), wtedy trzeba go wygenerować na nowo przez `accept`.

## Jak czytać wynik
Czerwony test rodzaju wypisuje:
```
lane-dead-end: sum 44 -> 45, +1 new key(s), 0 grown, -0 gone or fewer
  + lane-dead-end krakowskie-0-0 -91,-167: Peowiaków#0:0
```
- `+` to nowy klucz z rodzajem, kawałkiem, miejscem (dla kwadratu jego zasięg `x0..x1,z0..z1`) i opisem pierwszego trafienia;
- `^` to znany klucz z większym licznikiem (tylko siatka 1 m);
- `-` to klucz ubyły albo ze spadkiem licznika, czyli poprawka;
- `sum` to suma bazy i suma znaleziona.

Po każdym przebiegu pełna lista leży w `reports/glitch-scan-diff.txt`, a klucze każdego rodzaju w `reports/glitch-scan.json` (`keys`, obok `counts` i `found`).

## Jak przyjąć poprawkę
Poprawka usuwa klucze z bazy w tym samym commicie:
```
pnpm scan:update            # = GLITCH_BASELINE=update vitest run tools/glitch-scan/test/glitch-scan.test.ts
```
`update` tylko usuwa klucze i obniża liczniki, niczego nie dodaje. Nowe klucze nadal czerwienią test. Z `-t <rodzaj>` przebiegają i zapisują się tylko pliki wybranych rodzajów. Diff w PR pokazuje wtedy same usunięte wiersze.

## Jak świadomie dodać klucz
Podniesienie bazy wymaga jawnej flagi i uzasadnienia w commicie (najlepiej z decyzją orkiestratora):
```
GLITCH_BASELINE=accept pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts -t <rodzaj>
```
`accept` zapisuje klucze tak, jak je znaleziono, i wypisuje każdy dodany (`+ rodzaj kawałek x,z: opis`). W diffie PR każdy dodany klucz widać jako nowy wiersz pliku rodzaju.

## Porównanie dwóch refów
```
pnpm scan:diff origin/main HEAD        # bazy zapisane w dwóch refach
pnpm scan:diff origin/main .           # baza z drzewa roboczego
pnpm scan:diff origin/main report      # klucze ostatniego przebiegu skanu (reports/glitch-scan.json)
pnpm scan:diff origin/main report --fail-on-new   # kod 1, gdy przybył klucz
```
Wypisuje przybyłe, urosłe i ubyłe klucze rodzaj po rodzaju oraz sumy. `report` z przebiegu z `-t` porównuje tylko przebiegnięte rodzaje. Ref sprzed kluczy (`glitch-baseline.json`) daje tylko sumy na rodzaj.

## Gałąź sprzed kluczy
Gałąź, która obniżała starą bazę `glitch-baseline.json`, po scaleniu z main rozwiązuje konflikt tak:
```
git rm tools/glitch-scan/test/glitch-baseline.json && pnpm scan:update
```
`update` usuwa klucze miejsc, które gałąź naprawiła. Jeśli gałąź dodała nowe miejsce, test je wypisze.

## Przejście: `walk-blocked` (ADR-0080)
Jedna kontrola przejścia po powierzchniach do chodzenia (`test/walk-blocked.ts`, predykat `walkStep` w `packages/sim/src/world/walk.ts`): raster 0,25 m, znalezisko to para sąsiednich komórek z uskokiem `groundY` ponad 0,45 m w górę albo 0,35 m w dół, albo z nachyleniem ponad tg 35° poza schodami. Szczelinę do 1,25 m między dwoma pomostami przechodzi jak zwykły grunt (G-340). Zamierzone krawędzie (ściany, bariery do 0,6 m od elementu, boki pomostu nad niższym terenem, pomost nad drogą pod nim, nisza T-147 z marginesem 0,5 m, tarasy Alchemii i dół Hebi) nie są znaleziskiem. Po przeglądzie kuratora (PR 4) para liczy się tylko wzdłuż drogi (`test/walk-axes.ts`): w zasięgu odcinka osi drogi z OSM, który sam jest zablokowany (uskok między próbkami co 0,25 m albo spadek ponad tg 35° na 2 m). Zasięg: 0,6 m od osi ścieżki, pół jezdni ulicy. Drogi `access=no`, schody i drogi pod ziemią nie wchodzą. Sąsiad komórki poza mapą nie wchodzi do nachylenia (tam `groundY` = 0). Do PR 9 stoi obok sześciu starych kontroli uskoków; pokrycie ich kluczy:
```
pnpm scan:walk-coverage           # klucze z bazy
pnpm scan:walk-coverage report    # klucze ostatniego przebiegu skanu
```
