# ADR-0044: Renderer miasta z danych mapowych: fasady NPR, teren, nawierzchnie, LOD i podgląd

## Kontekst
ADR-0042 dał trzy nowe widoki: `building` (obrys, wysokość, piętra, przeznaczenie, dach, nazwa, ziarno wyglądu, potem też `plinth` i `shopfront`), `terrain` (siatka wysokości chunka) i `ground` (nawierzchnia). Importer (`tools/osm-import`) wygenerował centrum Lublina: 20 chunków, 611 budynków, 2028 nawierzchni, teren z NMT 1 m w komórkach 2,5 do 5 m. Renderer ma to narysować w stylu gry: cyberpunkowy Lublin 2077 (noc jak Kabuki i Japantown z Cyberpunka 2077), ale z rozpoznawalnymi kamienicami Krakowskiego Przedmieścia i Starego Miasta.

Ograniczenia:
- Babylon tylko przez `engine/src/babylon.ts`, nowe części za fasadą `BabylonRenderer`, limity ADR-0031;
- migawka NPR i budżety z `tools/perf-budgets.json` bez zmian, bo świat gry się jeszcze nie przenosi;
- bez tekstur bitmapowych w dużej liczbie;
- telefon (`low`) ma działać.

## Decyzja

### Gdzie
- `engine/src/renderer/mapcity/`: czyste plany geometrii (bez Babylona, testowane bez sceny) i klasa `MapCity`. `BabylonRenderer.spawn` kieruje do niej widoki `building`, `terrain` i `ground`. `MapCity` powstaje dopiero przy pierwszym takim widoku, więc scena gry bez danych mapowych jest bajt w bajt taka jak dotąd.
- Shader: części `FACADE` i `MAP_GROUND` w `npr/toon-city.ts`, wkompilowane w shader toon tylko pod tymi definicjami. Nowe presety `facade`, `mapGround` i `mapTerrain` (kolor na wierzchołek, flagi w alfie jak dressing z ADR-0027, dwa kanały UV).

### Wielokąty
- Obrysy przechodzą przez `cleanRing`: bez powtórzonego punktu zamykającego, bez duplikatów i punktów współliniowych, zawsze przeciwnie do ruchu wskazówek zegara na mapie (x wschód, z północ).
- Triangulacja: własne obcinanie uszu (`triangulate`), także dla wielokątów wklęsłych, bez nowej zależności. Pętla ma ogranicznik, a resztę wielokąta samoprzecinającego się wachluje, więc zły obrys nie zawiesza budowy.
- Odsunięcia obrysu (`offsetRing`) po dwusiecznej z limitem ściosu 2,5 × d. Wcięcie, które odwraca krawędź, zwraca null.

### Fasada
Fasada to funkcja deskryptora:
- `facadeStyle` wybiera z `look`, `use` i rozmiaru: tynk z palety lubelskiej (ochra, łosoś, mięta, żółć, terakota, krem, błękit, przybrudzony róż), gzymsy, attykę (zwykła albo z blankami jak renesansowe attyki Starego Miasta), dach, rytm okien i neon;
- witryny na parterze idą z mapy (`shopfront`);
- ten sam `look` daje zawsze tę samą geometrię i te same kolory (test).

Geometria (bliski LOD):
- ściany od najniższego gruntu pod obrysem do gzymsu;
- na zboczu dolne `plinth` metrów to podmurówka, a parter i siatka okien zaczynają się nad nią;
- cokół, gzyms nad parterem, gzyms główny z dwóch pasów, attyka z wewnętrzną ścianą i daszkiem albo dach;
- dach spadzisty: obrys wcięty ku kalenicy, z okapem i podbitką; gdy wcięcie wychodzi poza obrys albo odwraca krawędź, zostaje piramida do środka, a gdy i środek leży poza obrysem, dach płaski;
- kopuła z bębnem, latarnią i iglicą na zwartych budynkach zabytkowych i publicznych;
- kościół dostaje jedną albo dwie wieże na zachodnim końcu z iglicą albo barokowym hełmem;
- ściany, które sąsiedni budynek zasłania w całości, odpadają; zasłonięte częściowo to ślepe ściany szczytowe, bez okien i szyldów.

Okna, witryny i tynk maluje shader z UV w metrach:
- uv = (wzdłuż ściany, w górę od parteru), uv2.x = kondygnacja w decymetrach + przęsło / 10, uv2.y = styl + ziarno;
- każda ściana dostaje przęsło dopasowane do całkowitej liczby okien;
- style okien: kamienica (wysokie okna ze słupkiem i ślemieniem, naczółki, parapety, pilastry, boniowany parter i brama), nowoczesne, publiczne, ostrołuki kościoła, pasmo przemysłowe, blok;
- witryny: przęsła ze szprosami, półki, czasem opuszczona roleta, kolor światła z ziarna;
- część okien świeci nocą; udział zależy od `selfLit`, który idzie za porą dnia (`time-of-day`, ADR-0017);
- dolne piętra łapią poświatę neonu w kolorze rimu dystryktu (ADR-0030);
- z daleka siatka okien przechodzi w średnią poświatę, żeby nie migotała;
- ziarno i przęsło są kwantyzowane: interpolowana stała drży w ostatnich bitach, a jej hasze migotałyby jak szum.

### Neon
- Szyldy to jedna addytywna siatka na komórkę z własnym materiałem (`MapSignMaterial`), poza G-buforem, cieniem i glow, jak szyldy ulic z ADR-0030.
- Atlas lubelski: tablice „CEBULARZE”, „BAR MLECZNY”, „KANTOR 両替”, „ZAPIEKANKI”, „RAMEN ラーメン”, „LOMBARD”, „PIEROGI 餃子”, „KARAOKE カラオケ” i flagi „APTEKA”, „KAWA”, „PIWO”, „BAR”, „24H”, „HOTEL”, „薬局”, „ラーメン”.
- Jeśli przeglądarka nie ma japońskiego fontu (kana rysuje się jak nieprzypisany znak), japoński zastępują pseudoznaki.
- Gdzie stoją:
  - tablice nad witrynami i flagi przy narożnikach;
  - pasy odbić na mokrym chodniku;
  - neonowa rurka pod gzymsem części budynków handlowych;
  - holoreklamy na ścianach szczytowych wystających nad niższego sąsiada i wysoko na budynkach ponad 22 m;
  - podświetlona tablica z nazwą na landmarkach (atlas nazw rysowany na żądanie, do 32 nazw).

### Teren i nawierzchnie
- Teren: jedna siatka na chunk (preset `mapTerrain`, przesunięty w głąb przez polygon offset, żeby nawierzchnie wygrywały na każdej odległości).
  - Wierzchołki mają dokładnie `terrainHeightAt` (ta sama interpolacja co w symulacji) na kratce nie rzadszej niż 5 m.
  - Sąsiednie chunki o różnych komórkach dają na granicy złącza w kształcie T rzędu centymetrów. Wzdłuż każdej krawędzi wisi więc fartuch 1,5 m w dół, który przykrywa każdą szczelinę (test szwów).
- Nawierzchnie są drapowane:
  - triangulacja, potem każdy trójkąt dzielony barycentrycznie tak, by żadna krawędź nie przekraczała 5 m;
  - wysokość każdego wierzchołka z terenu plus mały odstęp per nawierzchnia: woda 3 cm, trawa 4, jezdnia 6, tory 7, plac i bruk 8, ścieżka 9, chodnik 16 cm (podniesiony);
  - chodnik przy jezdni dostaje krawężnik: ścianę od jezdni do płyt i jasny pas krawędzi. Krawężnik powstaje tam, gdzie punkt 0,5 m za krawędzią chodnika leży w wielokącie jezdni.
- Wzory nawierzchni w świecie albo w prostokącie otaczającym nawierzchni:
  - asfalt z łatami, mokry: flaga 0,5, połysk pod latarniami i sonda odbić z ADR-0036; na długich pasach linia środkowa przerywana i linie krawędzi;
  - chodnik z płyt 1 m;
  - plac z granitu w wiązaniu z ciemniejszymi pasami;
  - bruk Starego Miasta z kostek, każda w swoim odcieniu;
  - ścieżka z drobnej kostki, trawa w dwóch zieleniach, tory z podkładami i szynami.
- Wzory gasną z odległością.
- Woda (Bystrzyca, fontanny) ma własny prosty shader: prawie czarna, pasy zmarszczek płynące w czasie, łuna nieba pod kątem i rozbite smugi różowego i cyjanowego neonu nocą.

### Scalanie i LOD
- Budynki i nawierzchnie trafiają do komórek 128 m według środka obrysu. Komórka ma:
  - siatkę daleką: jeden blok na budynek z tymi samymi ścianami (okna z shadera), płaskim wierzchem i wieżami jako bryłami; cztery i więcej razy mniej wierzchołków;
  - siatkę bliską z pełną fasadą, budowaną na żądanie, najwyżej dwie na klatkę, i zwalnianą za 2 × zasięgiem;
  - jedną siatkę szyldów, jedną nawierzchni i ewentualnie wody.
- Komórki przebudowują się leniwie, gdy coś w nich lub obok (ściany szczytowe, krawężniki, teren) się zmieni.
- Poziom komórki wybiera odległość od kamery do prostokąta komórki, z wysokością kamery. Progi (`MAP_LOD`): blisko / cokolwiek / nawierzchnie / szyldy
  - `high`: 170 / 1400 / 650 / 500 m;
  - `medium`: 130 / 900 / 480 / 380 m;
  - `low`: 80 / 550 / 320 / 240 m.
- Histereza 15 m. Dalej wszystko jest wyłączone.
- Cień księżyca rzucają tylko siatki bliskie (dynamiczne rzucające w `MoonShadow`, wyłączone razem z siatką).

### Podgląd `?lublin-preview`
- `app/src/boot.ts` jest nowym wejściem: z `?lublin-preview` ładuje `lublin-preview/preview-main.ts` zamiast gry (osobne chunki, gra się nie uruchamia).
- Podgląd stawia `BabylonRenderer` z `world: []`, więc bez dressingu, szyldów i zastępczych brył starej mapy, i ukrywa horyzont megabudowli. Mgłę zmniejsza przez `fogScale` (nowa opcja i `setFogScale`, w grze 1).
- Spawnuje przez `RenderPort` wszystkie widoki z `LUBLIN_CHUNKS`. Dane bierze z nowej ścieżki `@seki/sim/lublin` w `exports` pakietu sim, nie z głównego eksportu, więc 0,9 MB danych trafia tylko do chunka podglądu i gra ich nie pobiera.
- Kamera orbitalna (`OrbitCamera`, kontroler), nakładka z atrybucją i liczbami (prezenter). Ujęcia pod klawiszami 1 do 8, N przełącza noc i dzień.
- `window.__lublin` służy do zrzutów. `?data=<url>` wczytuje inny zestaw widoków, na przykład z `tools/lublin-fixture.mjs`: prosty konwerter OSM XML do JSON, z którego powstał pierwszy test przed prawdziwymi danymi.

## Konsekwencje
- Migawka NPR i liczby budżetów bez zmian: reference 132 / 47, street-tpp 301 / 121, market-tpp 307 / 124, docks 227 / 100.
- Podgląd całego centrum, 611 budynków, SwiftShader 1280 × 720:
  - `high`: 107 do 172 wywołań rysowania, 44 do 86 aktywnych siatek, 0,5 do 0,7 mln wierzchołków w pamięci;
  - `low`: 67 do 68 wywołań na ulicy, bez line artu;
  - budowa wszystkich komórek około 1,3 s w Node.
  - Przy przenosinach treści sceny Lublina dostaną własne budżety.
- `FarCity` bez chunków nie wpada już w nieskończoną pętlę pierścieni (rysuje sam horyzont).
- Na później:
  - dachy z prawdziwym szkieletem prostym zamiast wcięcia;
  - dziedzińce: importer wypełnia dziury obrysów;
  - mosty (`bridge` w danych, w widoku jeszcze go nie ma);
  - drzewa, latarnie i ławki z OSM;
  - megabudowle horyzontu i pierścienie `FarCity` dopasowane do Lublina zamiast ukrycia w podglądzie;
  - budżety dla scen Lublina;
  - w grze zasięg mgły (94 m nocą) zakryje większość tego, co rysuje daleki LOD, więc progi warto zestroić z mgłą przy przenosinach.
