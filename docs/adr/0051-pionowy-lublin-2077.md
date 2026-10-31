# ADR-0051: Pionowy Lublin 2077: nadbudowy, warstwa nad ulicą, megabudowle i atmosfera kanionu

## Kontekst
Miasto z danych mapowych (ADR-0042 do ADR-0045) ma wierną skalę 1:1 i wierny układ ulic z OSM. Prawdziwy Lublin jest niski: kamienice mają 3 do 4 pięter (około 13 m) przy ulicach szerokich na 20 do 30 m. Gracz mówi, że takie miasto wydaje się przepastne, i wybrał „pionowy Lublin 2077”: fikcyjną warstwę nad prawdziwymi obrysami, która robi z ulic kaniony jak w Cyberpunku 2077, bez zmiany układu ani skali.

Ograniczenia:
- ulice, kolizja na poziomie ulicy i trasy replay bez zmian;
- Stare Miasto ma zostać rozpoznawalne, landmarki bez dodatków;
- telefon (`low`) dostaje uproszczoną wersję;
- budżety scen z pomiaru (ADR-0046), limity ADR-0031;
- równolegle powstają węższa kamera (FOV) oraz meble, tłum i ruch uliczny: ta zmiana ich nie dubluje.

## Decyzja

### Kontrakt i treść
- Widok `building` (`core/ports/types.ts`) ma `vertical?: BuildingVertical`:
  - `rise`: metry nadbudowy nad `height`, całe piętra po 3 m (`RISE_STOREY`);
  - `clutter` (0..1): gęstość tego, co budynek wiesza nad ulicą.
- Treść (`sim/src/content/lublin/vertical.ts`, `verticalOf(b, district)`) decyduje z ziarna `look` i dzielnicy, bez losowości:

| Dzielnica | Udział z nadbudową | Piętra | `clutter` |
|---|---|---|---|
| Krakowskie Przedmieście | 85% zwykłych budynków | 2 do 8 | 0,8 |
| Podzamcze | 90% | 3 do 8 | 0,9 |
| Stare Miasto | 30%, nic w promieniu 80 m od Trybunału | 1 | 0,25 (Rynek 0,1) |
| Nabrzeże | 60% | 1 do 4 | 0,5 |

  - rozkład pięter skośny ku dołowi (wykładnik 1,6), więc większość dostaje kilka pięter, a kilka wież góruje nad ulicą;
  - małe i wąskie obrysy (poniżej 60 m², krótszy bok poniżej 4 m) bez nadbudowy, poniżej 120 m² albo 7 m najwyżej 3 piętra, garaże bez, przemysł i „inne” najwyżej 2;
  - `clutter` budynku to wartość dzielnicy razy 0,7 do 1,3 z ziarna.
- Landmarki bez warstwy (`isLandmark`): kościoły, budynki publiczne i zabytkowe oraz nazwy z bramą, Trybunałem, wieżą, basztą, donżonem, zamkiem, katedrą, kościołem, cerkwią, kaplicą, klasztorem, teatrem, pałacem, ratuszem, urzędem i muzeum.
- Bryła (`city.ts`): wszystkie pryzmaty budynku, także pokoje, przejścia i wycięcia, kończą się na `height + rise`. Dół bez zmian, więc nadbudowa rośnie tylko w górę i nie zmienia ulic.
- Liczby centrum (611 budynków):
  - Krakowskie: 130 z 238 z nadbudową, piętra 2: 35, 3: 31, 4: 17, 5: 10, 6: 12, 7: 15, 8: 10; mediana wysokości z nadbudową 24,2 m, najwyższy 39,6 m;
  - Podzamcze: 95 ze 165, mediana 23,8 m, najwyższy 40,5 m;
  - Stare Miasto: 28 ze 183 po jednym piętrze, Rynek bez zmian;
  - Nabrzeże: 5 z 25.

### Renderer (`engine/src/renderer/mapcity`)
Wszystko trafia do siatek komórek 128 m, które już są (bliska i daleka fasada, szyldy), więc kosztuje wierzchołki, a nie wywołania rysowania. Plany są czystymi funkcjami ramki fasady, testowane bez sceny.

- `vertical-plan.ts`, nadbudowy:
  - kondygnacje kontenerowe (rdza, morska zieleń, ochra, stal), kapsułowe (beton, siatka kwadratowych okien) i szklane boksy, po 1 do 3 pięter;
  - każda kondygnacja to prostokąt w układzie obróconego prostokąta budynku, co najmniej 0,9 m od ścian obrysu, bez narożników obrysu w środku; szukany od pożądanej wielkości w dół i po dziewięciu środkach (głębokie działki, skrzydła). Kolejne kondygnacje się przesuwają i czasem wysuwają nad niższe jak kapsuły megabloku;
  - okna maluje shader fasady (style przemysłowy, blok, nowoczesny);
  - na górze maszt z czerwonym światłem, zbiorniki na nogach, wentylatory, panele słoneczne; część kondygnacji ma świecący pas pod gzymsem;
  - daleka siatka: same bryły kondygnacji;
  - 85% budynków z `rise` dostaje stos, reszta ma obrys, w którym nic się nie mieści.
- `wall-clutter.ts` (bliska fasada, bez `low`): rury, klimatyzatory i rusztowania na ścianach szczytowych odsłoniętych nad sąsiadem, klimatyzatory pod oknami wyższych pięter i rynny na ścianach ulicznych. Ilość z `clutter`.
- `canyon-plan.ts`, przęsła nad ulicą:
  - od środka ściany ulicznej (przy ścianie od 18 m także od 20% i 80%) w stronę normalnej, co metr, aż do obrysu innego budynku, od 5 do 34 m;
  - para dostaje przęsła raz, od budynku z mniejszym id, i tylko gdy oba mają `clutter`: Rynek i landmarki zostają czyste;
  - z przęseł: zwisające kable (wstęgi pionowa i od spodu, 72 wierzchołki), sznury lampionów, ramy billboardów zawieszonych nad ulicą na linkach;
  - w kilku miejscach przeszklona kładka 2,6 m szerokości, 6 do 11 m nad ulicą, pod oboma gzymsami (12% głównych przęseł nad ruchliwą ulicą od 7 do 24 m, w całym centrum kilka sztuk), także w dalekiej siatce. Kładki są tylko obrazem, bez kolizji.
- `canyon-signs.ts`, w addytywnej siatce szyldów komórki:
  - nowy atlas reklam (`drawAdAtlas`, 1024²): cztery poziome tablice („LUBLIN 2077 ルブリン”, „SEKI 関重工”, „CEBULARZ 玉葱パン”, „KOZIOŁEK COLA コーラ”) i osiem banerów („ラーメン”, „ホテル”, „薬局”, „居酒屋”, „KINO”, „BAR”, „カラオケ”, „24H”); bez japońskiego fontu pseudoznaki jak w ADR-0044;
  - billboardy nad ulicą, obie strony czytelne wzdłuż ulicy, banery wystające z wyższych pięter, reklamy na ścianach nadbudów zwróconych do ulicy;
  - zasłony z neonowych pasów pod kablami;
  - snopy światła spod billboardów do ulicy;
  - niska mgła w kanionach: dwie miękkie warstwy 0,5 i 1,3 m nad ulicą głównego przęsła z `clutter` od 0,4 (nie na Rynku), z szumem, wygaszane przy brzegach i przy oku.
  - Nowe rodzaje w shaderze szyldów: `ad` 7, `beam` 8, `mist` 9.
  - Na `low` zostają reklamy; zasłony, snopy i mgła odpadają.
- `skyline.ts`, megabudowle (`MapSkyline`):
  - cztery skupiska korpo-wież poza chunkami gry: Czechów (4 wieże, 330 do 760 m), al. Kraśnicka (3, do 880 m), Zalew Zemborzycki (3, do 980 m), Tatary (2);
  - wieża to kondygnacje z uskokami, korona i iglica, neon w narożnikach, wielka holo-reklama i światła ostrzegawcze od strony centrum;
  - dwie siatki na całe miasto (wieże i światła), poza komórkami, cieniem i line artem. Kamera gry widzi 320 m, więc wieże są impostorami w prawdziwej perspektywie: shader wierzchołków przyciąga każdą wieżę wzdłuż linii wzroku tak, by jej środek leżał 288 m od oka, i zmniejsza ją w tej samej skali. Zajmuje te same piksele co prawdziwa;
  - mgła liczona z prawdziwej odległości, z limitem 0,82, okna z daleka jako średnia poświata pięter;
  - na `low` bez siatki świateł.
  - Zastępuje wyłączony w grze horyzont `FarCity` z ADR-0027. `FarCity` zostaje dla starego świata z bloków i dalej jest wyłączone w grze i podglądzie.
- `MapCity`: przęsła liczone przy budowie komórki z indeksu budynków (`acrossAt`), spawn budynku odświeża komórki w promieniu 34 m (przęsła przez ulicę).

### Determinizm
Złote hashe w `determinism.test.ts` bez zmian. Bryły rosną tylko w górę, a przebiegi wzorcowe chodzą po ulicach i nie strzelają ponad dachy.

## Konsekwencje
- Testy:
  - `sim/test/lublin-vertical.test.ts`: czysta funkcja, landmarki bez warstwy, całe piętra, Rynek bez nadbudów, gęstości dzielnic, bryły tylko w górę;
  - `engine/test/vertical-plan.test.ts`: determinizm z `look`, kondygnacje w obrysie i do `top + rise`, landmarki bez stosów, przęsła raz na parę, nic z budynku bez `clutter`, mniej na `low`, kilka kładek w centrum.
- Wydajność: patrz tabela w sekcji „Pomiar”.

### Pomiar
`pnpm e2e e2e/npr-perf.spec.ts` przed (gałąź z kamerą 80° z ADR-0049, `9bcb004`) i po, SwiftShader 1280 × 720, wywołania rysowania / aktywne siatki:

| Scena | Przed | Po | Budżet |
|---|---|---|---|
| `reference` | 167 / 67 | 170 / 69 | 173 / 70 bez zmian |
| `krakowskie-tpp` | 359 / 151 | 363 / 154 | 368 / 155 bez zmian |
| `rynek-tpp` | 209 / 77 | 218 / 83 | 215 / 81 → 225 / 87 |
| `podzamcze-tpp` | 256 / 96 | 261 / 100 | 263 / 100 bez zmian |
| `nabrzeze` | 224 / 94 | 228 / 97 | 232 / 99 bez zmian |
| `phone-low` | 227 / 141 | 228 / 142 | 233 / 145 bez zmian |

- Nadbudowy, kable, kładki, klimatyzatory i reklamy nie dodają siatek: idą do siatek komórek. Wzrost to:
  - panorama wież: 3 wywołania (wieże w kolorze i w G-buforze line artu, gdzie są przycięte za płaszczyzną dalszą, oraz światła; na `low` bez świateł);
  - siatki szyldów komórek, które dotąd nie miały żadnego szyldu, a teraz mają reklamy albo mgłę. Pierwsza wersja kładła mgłę pod każdym głównym przęsłem, także na Rynku (221 / 86); mgła tylko w kanionach z `clutter` od 0,4 dała 218 / 83.
- Budżet podniesiony tylko dla `rynek-tpp`, jedynej sceny ponad budżetem, kilka procent nad pomiarem. Po scaleniu ze schodami z OSM i snopami latarń na gruncie mapy `podzamcze-tpp` dało 262 / 101 (o siatkę ponad), budżet 263 / 100 → 270 / 104.
- Po scaleniu z ADR-0050 (meble, tłum i ruch w grze) razem: `reference` 183 / 76, `krakowskie-tpp` 379 / 162, `rynek-tpp` 232 / 90, `podzamcze-tpp` 281 / 110, `nabrzeze` 235 / 101, `phone-low` 233 / 148 (sam ADR-0050: 178 / 73, 375 / 159, 221 / 84, 275 / 105, 230 / 97, 232 / 147). Ponad budżetem i podniesione: `rynek-tpp` 228 / 87 → 239 / 93, `podzamcze-tpp` 283 / 109 → 290 / 113, `nabrzeze` 232 / 99 → 242 / 104.
- Migawka NPR (`reference-m0.png`) nowa: przy Neon Koi widać baner 居酒屋 i klimatyzatory na sąsiedniej kamienicy, banery KINO i HOTEL, kable z lampionami i zasłony z neonowych pasów w głębi deptaka; fasada Neon Koi i postać bez zmian.

### Do dopracowania
- Nadbudowy nad dachem spadzistym przebijają dach: wygląda to jak dobudowa, ale bez obróbki blacharskiej.
- Kładki nie mają kolizji ani wejść; przęsła nie omijają latarń i drzew z ADR-0047 (kable wiszą od 4,5 m).
- Reklamy mają osiem haseł; brak animowanych treści i dźwięku.
- Mgła to warstwy w siatce szyldów, bez prawdziwej objętości; przy kamerze bardzo nisko widać ich krawędź.
- Okna wież to jeden wzór; brak sylwetek ruchomych (sterowce, AV).

### Uzupełnienie (G-050)
- Problem: reguła dzielnicy nie widzi sąsiedniego landmarku, więc dom przy bramie albo kościele stawiał nadbudowę tuż przy jego ścianie i górował nad nim (Grodzka 36a 15 m nad Bramą Grodzką). Obcięcie `rise` do szczytu landmarku zabierało nadbudowę 23 budynkom; użytkownik zdecydował, że nadbudowy zostają, tylko cofnięte od landmarku.
- Kontrakt: `BuildingVertical.landmarks?` to landmarki (`isLandmark`) bliżej niż 5 m od obrysu budynku, niższe od szczytu nadbudowy: ich obrysy (x, z względem pozycji encji) i szczyty (y względem niej). Renderer nie zna innych budynków niż te w swojej komórce, więc treść podaje mu, od czego się cofnąć; pole jest opcjonalne i bez niego wygląd jest jak dotąd.
- Treść (`nearLandmarks`, `verticalOf`): `rise` zostaje z reguły dzielnicy, pole dostają tylko budynki z `rise > 0` i landmarkiem w zasięgu (22 w mieście).
- Renderer (`stackTiers`): kondygnacja, której góra wychodzi ponad szczyt landmarku, stoi co najmniej 5 m od jego obrysu (`LANDMARK_CLEAR`); `fitRect` szuka mniejszego albo przesuniętego prostokąta, przy landmarku także dosuniętego metr od przeciwnej ściany pudełka budynku, a gdy żaden się nie mieści, stos kończy się na niższej kondygnacji. Kondygnacje poniżej szczytu landmarku mogą stać przy nim. Budynki bez landmarku w zasięgu dostają stos jak dotąd.
- Bryła kolizji dalej rośnie o `rise` na całym obrysie, także tam, gdzie po odsunięciu nie zostało nic do narysowania (1 budynek, w66324560). To ten sam rozjazd co dla obrysów, w których stos się nie mieści (wyżej: 85% budynków z `rise` ma stos); na dachy mapy Lublina nie prowadzą drabiny ani windy, a skok sięga ok. 1,2 m, więc gracz na nią nie wejdzie. Złote hashe stoją.
- Skan `landmark-overbuilt` liczy kondygnacje ponad szczytem landmarku bliżej niż 5 m od jego obrysu: przed G-050 25, po 0. Przy landmarkach (79 budynków bliżej niż 5 m) nadbudowę ma 29 budynków jak przed G-050 (obcięcie dawało 6); kondygnacji 39 → 41: w66324560 traci swoje 2, a w66322912 i w66324576 (przy Kościele Ewangelicznym), w których dotąd nic się nie mieściło, dostają po 2 dosunięte do tylnej ściany. Budynków z `rise` ze stosem w całym mieście 195 → 196 z 258.
