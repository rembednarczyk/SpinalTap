# ADR-0067: Megabloki osaczające Lublin (panorama, wariant B)

## Kontekst
Użytkownik chciał, żeby megabloki 2077 nadbudowały i osaczyły dzisiejsze tło Lublina (31.10). Panorama z ADR-0063 etap 2 to 12 wież za miastem, ledwo widocznych ze Starego Miasta. Prototyp (gałąź `ccr-ec2c4269-ilh8k8-megabloki-proto`, 1e1c85e) pokazał trzy warianty na zrzutach spod Bramy Krakowskiej, z Placu po Farze i z Placu Litewskiego:
- A „pierścień”: 85 megabloków 360–600 m za krawędzią chunków; widać go tylko z Placu Litewskiego;
- B „osaczenie”: rząd 50 wież 300–520 m wysokości ok. 270 m za krawędzią chunków, 112 kładek ze świecącym spodem, dodatkowe reklamy, za nim pierścień A; wyraźne „miasto w kotlinie” ze wszystkich ujęć;
- C „nadbudowa”: płyty na nogach nad osiedlami; ze Starego Miasta prawie niewidoczne.

Żaden wariant nie dodaje wywołań rysowania ani aktywnych siatek: rosną tylko trójkąty dwóch siatek panoramy (B: 160 tys. zamiast 12,9 tys., 18,7 MB danych siatek zamiast 1,5 MB).

## Decyzja
- **Wariant B** (wybór użytkownika 1.11): bliski rząd wież z kładkami i reklamami, za nim pierścień megabloków, razem z dzisiejszymi 12 wieżami.
- **Dane, nie kod:** układ wież, kładek i pierścienia jako tabela w stylu `MEGA_SITES` (pozycja, wysokość, kierunek frontu, liczba reklam), generowana deterministycznie raz i trzymana w repo; bez wyboru przez `location.search`, wariant prototypu znika.
- **Odległość od danych miasta:** najbliższa wieża co najmniej 190 m od krawędzi danych Lublina (dziś 750 m), z testem minimalnej odległości dla każdego rzędu; Nabrzeże (x 2300–2700) dostaje swój odcinek pierścienia, żeby nie zostało poza osaczeniem.
- **Topografia (ADR-0042):** megabloki stoją na prawdziwych dzielnicach poza danymi (Czechów, Tatary, Wieniawa, Kośminek, Wrotków i inne). To celowe odstępstwo 2077 z wpisem w `docs/topografia.md`; przegląd `topography-curator`, który sprawdza, czy rzędy nie zasłaniają osi widokowych ważnych dla rozpoznania miasta (Zamek, Wieża Trynitarska, katedra z Placu Litewskiego).
- **Budżet:** bez nowych wywołań rysowania i siatek (ta sama para siatek panoramy); trójkąty: zewnętrzny pierścień prostsze bryły (LOD) tak, żeby całość zmieściła się w ok. 100 tys. trójkątów; pamięć siatek do 12 MB; telefon (`low`) zostaje przy dzisiejszej panoramie.
- **Impostor:** skala z odległości do szczytu wieży (z prototypu), żeby bliska wysoka wieża nie wypadała za płaszczyznę daleką.
- **Bez zmian w `sim`.**

## Etapy
1. Tabela układu B z LOD pierścienia, renderer bez przełącznika wariantów, testy (odległość od danych, determinizm tabeli, budżet trójkątów i pamięci), migawka NPR i budżety e2e, zrzuty z trzech ujęć prototypu; przegląd kuratora i wpis w topografii.
2. (Opcjonalnie) życie panoramy: ruch na kładkach, migające reklamy z puli ADR-0063, bez nowych wywołań rysowania.

## Konsekwencje
- Miasto dostaje wyraźne tło 2077 z każdego miejsca, w którym gracz patrzy w górę.
- Rośnie rozmiar danych siatek panoramy; LOD i limit pamięci to pilnują.
- Każda zmiana granic danych miasta (nowe chunki) wymaga sprawdzenia odległości megabloków; test to wymusza.

## Wdrożenie
- **Etap 1** (gałąź `feat/megabloki-b`):
  - układ jako dane: `packages/engine/src/renderer/mapcity/skyline-layout-data.ts` (wieże: x, z, wysokość, kierunek frontu w stopniach, liczba dodatkowych reklam; kładki: wieże a i b, wysokość, szerokość), wygenerowany raz przez `skyline-layout-gen.ts`; test `skyline-layout.test.ts` sprawdza, że tabela to wynik generatora, a `SKYLINE_LAYOUT=update` ją przepisuje; przy starcie nic się nie losuje; przełącznik `?skyline=` i warianty A i C z prototypu nie weszły;
  - rzędy: `near` 50 megawież 305–520 m ok. 270 m za prostokątem chunków Krakowskiego, Starego Miasta i Podzamcza, 112 kładek, po 3 dodatkowe reklamy; `docks` 16 wież 281–448 m na północ, wschód i południe od Nabrzeża (zachód patrzy na miasto), 36 kładek, po 2 reklamy; `ring` 85 megabloków 159–350 m w dwóch pasach 360 i 600 m za chunkami; do tego dzisiejsze 12 wież `MEGA_SITES`;
  - odległość: generator odsuwa wieżę od danych, aż jej bryła (0,2 wysokości od osi) mija każdy chunk o 200 m; najbliższy wierzchołek od chunka: `near` 230 m, `docks` 220 m, `ring` 303 m (test: co najmniej 190 m dla każdego rzędu, bryły, kładki i reklamy);
  - LOD: `near` i `docks` dostają bryły megawież CC-BY (ADR-0063), `ring` zostaje przy proceduralnych piętrach (ok. 53 trójkąty na blok zamiast ok. 1070);
  - budżet na medium i high: 92 366 trójkątów i 10,75 MB danych siatek (pozycja, normalna, kolor, uv, uv2 jako float, indeksy 32-bit) zamiast 12 912 i 1,49 MB; prototyp B miał 161 144 i 18,66 MB; ta sama para siatek panoramy;
  - telefon (`low`): `skylineLayoutFor("low")` to pusty układ, geometria 12 wież co do wierzchołka jak przed zmianą (hash w teście);
  - impostor: skala do szczytu wieży (wysokość w `uv2.y` wież i `normal.y` świateł), więc szczyt bliskiej wysokiej wieży nie wypada za płaszczyznę daleką;
  - e2e (`npr-perf`, SwiftShader): wywołania rysowania i aktywne siatki bez zmian we wszystkich scenach (reference 191 / 81, krakowskie-tpp 370 / 162, rynek-tpp 230 / 90, podzamcze-tpp 282 / 113, nabrzeze 236 / 102, phone-low 227 / 149), migawka NPR bez zmian; aktywne trójkąty +157,6 tys. na scenach desktopowych, phone-low bez zmian;
  - zostaje: wpis w `docs/topografia.md` (T-056) i przegląd `topography-curator`.
