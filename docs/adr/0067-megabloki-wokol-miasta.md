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
