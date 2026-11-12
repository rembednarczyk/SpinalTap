# ADR-0077: Pokrycie mapy z danych, nie z ręcznych poprawek

Status: zaakceptowany (11.11, decyzja użytkownika: „zapisz jako ADR, dodaj source-scout i zacznij”).

## Kontekst
Rejestr pokrycia (`docs/mapa-pokrycie.json`, `docs/mapa-pokrycie.md`) ma 20 komórek, z czego 5 przejrzanych (stan 11.11). Użytkownik chce mieć całą obecną siatkę możliwie skorygowaną i wierną: teren, nawierzchnie, budynki, przy oszczędnym zużyciu tokenów.

Dotychczasowa metoda kosztuje ok. 1 mln tokenów na komórkę (szacunek z zużyć agentów 7–11.11):
- przejście opiekuna: 100–140 tys.;
- poprawka ręcznymi obszarami: 300–450 tys.;
- dwie rundy kuratora: ok. 400 tys.

Ręczne obszary kostki (T-243, T-245, T-246) za każdym razem przykryły w pierwszej rundzie prawdziwą zieleń. Model językowy, który rysuje wielokąty z oglądu ortofoto, jest drogi i zawodny. Ten sam rodzaj glitcha (goła ziemia: G-513, G-521, G-527, G-536, G-540) wraca w każdej komórce.

Research źródeł (11.11):
- **Ortofoto PZGiK (RGB):** bezpłatne, do dowolnego wykorzystania, przez WMS. Usługi WMS standardowej i wysokiej rozdzielczości nie mają warstwy CIR (podczerwień). CIR i pełna rozdzielczość są w zasobie, ale nie przez te usługi.
- **Modele 3D budynków GUGiK:** LoD1 dla całego kraju (warstwy do 2024, z wysokością `measuredHeight`), LoD2 w CityGML dla 236 powiatów z 10 województw (stan 2017–2018). Bez tekstur. Bezpłatne, do dowolnego wykorzystania, pobierane po powiatach.
- **Modele 3D drzew GUGiK:** udostępnione także dla powiatu lubelskiego.
- **Siatki 3D z teksturą GUGiK („3D mesh”, OBJ, tekstury ze zdjęć ukośnych):** tylko kilkanaście miast. Skorowidz WMS nie pokazuje Lublina.
- **Miasto Lublin:** otwarte dane NMT, NMPT (2014) i chmura punktów (2022). Model CityGML i siatka w serwisie Lublin 3D bez znalezionej ścieżki pobrania ani licencji. Model siatkowy miasta jest w przetargu z 2026 r.
- **Zdjęcia uliczne (Mapillary):** CC BY-SA, licencja wymagająca udostępniania pochodnych na tych samych warunkach. Odrzucone.

Wniosek: otwartych tekstur elewacji dla Lublina nie ma. Kolory dachów i nawierzchni można próbkować z ortofoto.

Ustalenia `source-scout` (11.11), wszystkie zbiory na licencji CC BY 4.0, do atrybucji w `data/osm/ATTRIBUTION.md` przy pierwszym użyciu:
- **Budynki LoD2 (CityGML 2.0, stan 2017):** Lublin (powiat 0663) jest w zasięgu, 35 602 budynki, kształty dachów; `opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD2/0663_gml.zip`, 24,5 MB.
- **Budynki LoD1 2024 (`measuredHeight`):** 38 687 budynków; `opendata.geoportal.gov.pl/InneDane/Budynki3D/LOD1/2024/06/0663.zip`, 13,2 MB.
- **Drzewa LoD1 2023:** 433 748 drzew w powiecie, położenie, wysokość i wysokość przyziemia, bez korony; `opendata.geoportal.gov.pl/InneDane/Drzewa3D/LOD1/2023/06/0663.zip`, 1,92 GB. Pobierać tylko wycinek mapy.
- **BDOT10k powiatu Lublin (GML lub GPKG, 2026):** bezpłatny, ok. 22 MB; zawiera m.in. budowle (ogrodzenia, mury). Klasy do sprawdzenia po pobraniu.
- **Ortofoto:** najnowszy arkusz w punkcie Lublina z 2025 r.; CIR niedostępne w WMS.
- **Otwarte dane miasta Lublin:** serwery nie odpowiadały, zawartość i licencja nieustalone (NMT, NMPT, chmura punktów EPT 2013–2023 według wyszukiwarki). Rejestrów mebli ulicznych nie znaleziono.
- **OSM a meble i bariery:** wyciągi `data/osm/*.json` odrzucają przy pobieraniu punkty mebli i większość linii barier. Surowe dane OSM z 6 kafli pamięci podręcznej (część mapy) mają m.in.: 380 ławek, 395 słupków, 26 koszy, 51 stojaków, 105 hydrantów, 144 ogrodzenia, 82 mury, 15 murów oporowych, 57 żywopłotów, 145 bram, 9 szlabanów, ale tylko 11 latarni. Meble i bariery z OSM to tani, prawdziwy zysk. Latarnie dalej rozstawia głównie generator (ADR-0047).

## Decyzja
1. **Najpierw narzędzia, potem reguły, na końcu przejścia po komórkach.**
   - **Narzędzia (jednorazowo):**
     - pamięć podręczna ortofoto dla prostokątów mapy;
     - klasyfikator pokrycia na siatce 0,5 m (zieleń, jasna nawierzchnia, asfalt, cień) z indeksu zieleni RGB (np. ExG) i progu jasności, zapisany jako mały raster w `data/` z atrybucją;
     - nakładka liczbowa: wynik importu kontra klasyfikacja, z liczbami na obszar i komórkę;
     - raport komórki generowany skryptem (skan, nakładka, wiersze T), bez zrzutów.
   - **Reguły dla całego miasta,** jeden rodzaj na PR, z kontrolą w skanie i przeglądem kuratora na próbce miejsc. Kolejność:
     1. goła ziemia z klasyfikacji ortofoto (trawa, kostka, asfalt), zamiast ręcznych obszarów;
     2. szczeliny przy krawężnikach (G-522, G-570);
     3. wysokości budynków z LoD1 2024 albo NMPT − NMT (ADR-0064 etap 11);
     4. dachy z LoD2, jeśli Lublin jest w zasięgu;
     5. drzewa z modeli 3D drzew GUGiK albo NMPT;
     6. meble uliczne i bariery z danych: ławki, słupki, latarnie, kosze, stojaki, hydranty, wiaty, tablice, a także murki, mury oporowe, ogrodzenia, żywopłoty, bramy i szlabany (prośby użytkownika 11.11).
   - **Przejścia po komórkach** obejmują już tylko resztę: raport skryptowy, zrzut tylko przy podejrzeniu.
2. **Ręczne obszary nawierzchni tylko jako wyjątek.** Gdy klasyfikacja się myli (cień, dach widoczny z góry, sezon), obszar ręczny dostaje nakładkę liczbową, a kurator sprawdza liczby zamiast obrazów.
3. **Nowy agent `source-scout`** (`.claude/agents/source-scout.md`, model Haiku): dla rodzaju glitcha albo komórki ustala, które źródło odpowiada. Sprawdza zasięg dla Lublina, licencję i aktualność, pobiera dane gotowymi skryptami i zwraca krótki raport. Nie pisze kodu produkcyjnego. Rutynowe przejście opiekuna mapy może iść na tańszym modelu, gdy ma raport skryptowy. Reguły importu, renderer i przeglądy zostają na najmocniejszym modelu.
4. **Meble uliczne i bariery kładziemy razem z pokryciem, z danych i z naszych assetów** (prośby użytkownika 11.11). Bariery to murki, mury oporowe, ogrodzenia, żywopłoty, bramy i szlabany: linie OSM `barrier=wall|retaining_wall|fence|hedge|gate|lift_gate` (ADR-0064 etap „płoty i mury”). Tam, gdzie OSM ich nie ma, wysokość można sprawdzić w NMPT − NMT (murek albo żywopłot to wąski pas 0,5–2 m nad terenem), a zieleń żywopłotu w klasyfikacji ortofoto. Bariery wchodzą do kolizji w `sim`, więc zmieniają złoty hash; zmieniamy go świadomie. Część już stoi: `pnpm osm:props` (ADR-0047) bierze punkty z OSM (`highway=street_lamp`, `amenity=bench`, `amenity=waste_basket`, `barrier=bollard` i inne z ADR-0064 etap 3), a generatory (`props-gen`, rzędy słupków, kratki) uzupełniają resztę modelami z `city-props.glb` (ADR-0058). Kolejność źródeł:
   1. punkty z OSM;
   2. rejestry miasta, jeśli `source-scout` znajdzie je na otwartej licencji, np. oświetlenie uliczne albo ławki w zarządzie ZDiM;
   3. generator z regułami rozstawienia (odstępy, krawędź chodnika, wejścia, przystanki), bez list współrzędnych (decyzja z 1.11).
   
   Każda reguła pokrycia, która zmienia nawierzchnię, od razu przelicza meble na nowej powierzchni: `osm:props` po `osm:build`. Kontrole skanu mebli (`lamp-*`, `prop-off-ground`, `furniture-in-building`, kratki, ławki) nie mogą rosnąć. Raport komórki (punkt 1) liczy też meble: ile jest z OSM, ile z generatora, a gdzie chodnik nie ma żadnych mebli na długich odcinkach. Brakujące rodzaje, dla których nie mamy modelu, idą do slotu assetów (ADR-0058).
5. **Tekstury:** elewacje zostają proceduralne (styl 2077). Kolory dachów i nawierzchni mogą pochodzić z próbek ortofoto, w palecie NPR. Siatki 3D z teksturą wracają do decyzji, gdy GUGiK albo miasto Lublin udostępni je dla Lublina na otwartej licencji (sprawdza `source-scout`).
6. **Brzeg mapy** bez zmian: obiekty za brzegiem trafiają do backlogu („Poszerzanie mapy”, `docs/decyzje.md`).

## Konsekwencje
- **Koszt (szacunek, nie pomiar):** zamiast ok. 15 mln tokenów dla 15 nieprzejrzanych komórek wychodzi ok. 8 mln:
  - narzędzia: 2–3 mln;
  - 5–6 reguł po 0,5–0,8 mln;
  - przejścia reszty po 50–100 tys.
- **Wierność:** rodzaje policzalne przez skan schodzą do 0 albo do opisanej reszty w całym mieście, także w komórkach jeszcze nieprzejrzanych. Elewacje i obiekty za brzegiem mapy nie będą wierne.
- **Na rozszerzenie mapy (decyzja użytkownika 11.11):** zwarte wyciągi wektorowe GUGiK trafiają do `data/gugik/` dla całego miasta, z manifestem źródeł (adres, data, sha256, licencja). Narzędzia przyjmują dowolny prostokąt. Klasyfikację ortofoto liczymy tylko dla obecnej mapy, bo dla całego miasta byłaby za duża i zestarzałaby się do czasu rozszerzenia.
- **Dane:** surowe ortofoto zostaje w pamięci podręcznej narzędzia poza repo. W repo trafiają tylko wyniki pochodne (raster klasyfikacji, próbki kolorów) z atrybucją w `data/osm/ATTRIBUTION.md` (sekcja PZGiK).
- **Ryzyko:** klasyfikacja RGB myli zieleń w cieniu i jasne dachy z nawierzchnią. Dlatego kurator sprawdza próbkę, a progi ustala na kilku dzielnicach przed zastosowaniem w całym mieście. Zmiana nawierzchni w wielu miejscach naraz zmienia hash podłoża i migawkę NPR; zmieniamy je świadomie, z uzasadnieniem.

## Realizacja: krok 1.1, goła ziemia z klasyfikacji (12.11, etap 1)
Reguła w imporcie: `tools/osm-import/src/bare-cover.ts` (z `bare-cells.ts` i `contour.ts`), wejściem są rastry `data/orto/*.cover.png`.
- **Wzorzec:** budowa warstwy pokrycia jak w GIS (Urban Atlas, CORINE): klasyfikacja rastra, czyszczenie (cień i korony biorą klasę dominującą w promieniu 2 m, plamy poniżej 2 m² dołączają do otoczenia, czyli minimalna jednostka kartowania), wektoryzacja klasy marching squares, uproszczenie Douglas-Peucker (0,1 m) i próg pola (1 m²). Kontur obejmuje jeszcze komórkę pod kawałkami mapy i ścianami obok, a potem kawałki i ściany go przycinają (Clipper2 `difference`, jak w ADR-0078): wypełnienie kończy się dokładnie na ich krawędziach, bez zakładek i szczelin (`ground-strip-overlap`, `ground-strip-gap`). Odstępstwo od wzorca: kafle 36 m zamiast jednej warstwy, bo obrys bez dziur (dziura dzieli kafel) i plac poniżej 1500 m² pętli tłumu.
- **Klasy:** zieleń → trawa, jasna nawierzchnia → kostka (`square`, jak ręczne obszary), cień i korony → klasa dominująca w sąsiedztwie albo nic przy remisie. Asfalt zostaje goły: jako `road` symulacja czytałaby go jako jezdnię (szerokość ulicy, parkowanie). To osobny etap.
- **Gdzie:** wszystko w miejscach brukowanych miasta (to, co liczy `landuse-bare`: tereny handlu i usług, targ, dworzec, perony, 5 m przed sklepem i budynkiem publicznym, 10 m przy przystanku). Miejsca są poszerzone o 3 m, żeby ich brzeg nie zostawiał gołego pasa między wypełnieniem a kawałkiem. Poza nimi tylko zwarte płaty, średnio co najmniej 6 m szerokie i od 20 m². Bez kawałków przy moście (2 m), na placu doków i w pasie 5 m od jezdni za gołym krawężnikiem (krok 1.2).
- **Dlaczego nie wszędzie:** renderer kładzie kawałek na siatce 2,5 m, więc wypełnienie kosztuje ok. 3 wierzchołki na metr obrysu. Cała goła ziemia miasta to +0,31 mln wierzchołków przy 0,92 mln i budżecie 1 mln (`map-city.test.ts`). Etap 1 dodaje ok. 58 tys. (916 803 → 974 354, stan po scaleniu z main 12.11).
- **Wynik (po scaleniu z main 12.11):** `landuse-bare` 69 214 → 32 497 próbek (−53%), `kerb-gap-bare` 29 696 → 28 460, `kerb-strip-bare` 181 → 180, `ground-strip-overlap` 93 727 → 93 707, `ground-strip-gap` 4 105 → 4 100, `ground-ring-self-cross` 30 bez zmian; żaden rodzaj nie wzrósł. Nowa kontrola `bare-on-cover` (próbki `landuse-bare` na zieleni albo jasnej nawierzchni) ma bazę 5 934, przed regułą 39 094. Wcześniejszy pomiar przed scaleniem, na obszarach dzielnic: Krakowskie −41%, Stare Miasto −50%, Podzamcze −58%, Nabrzeże −60%; trawa reguły w 99% na zieleni albo pod koronami, kostka w 92% na jasnej nawierzchni.
- **Ręczne obszary:** z 113 ręcznych obszarów nawierzchni i trawy reguła zastępuje bez straty tylko `T-246/ruska-a` (usunięty: ta sama nakładka, `kerb-gap-bare` −5). `T-243/ck-poludnie-skraj` wyszedł w nakładce lepiej, ale bez niego `landuse-bare` rośnie o 1 próbkę, więc został. Przy pozostałych nakładka z regułą jest gorsza, głównie przez goły pas 5 m przy jezdniach i asfalt podwórzy, więc obszary zostają do kroku 1.2 i etapu asfaltu.
- **Czas:** reguła wydłuża zimny `generate` całego miasta. Test `venues` („sign nearly…”, bez pamięci miasta), A/B wobec main 503bff0 z rotowaną kolejnością wariantów, load 2,6–6,3, 16 par: mediana +13,5% (pary od −8% do +48%; rozrzut to obciążenie maszyny), przed optymalizacją ok. +25–31%. Przyczyny z profilu i `--trace-opt`: moduł Vitesta czyta zaimportowane wiązanie przez getter, więc pętle po komórkach trzymają lokalne kopie `LABEL` i `taken`; funkcje wielu pętli (pas krawężników, obszary) V8 kompilował od nowa przy każdej pętli (OSR), więc kroki są osobnymi funkcjami; szerokie fazy przez `SpatialHash`. Reguła na wejściach całego miasta pod Vitestem: zimna 0,86–0,95 → 0,44–0,61 s. Zostaje cięcie Clipper2 (ok. 0,12 s na zimno, głównie rozgrzewanie JIT biblioteki). Sprawdzone i odrzucone: mniej przydziałów w `scan` i `near` (226 → 165 MB, ale pod Vitestem wolniej), cięcie z kawałkami przyciętymi do pudełka wypełnień (−50 ms, ale tablice o 1 cm inne i skan +2 `landuse-bare`, +2 `bare-on-cover`, +1 `ground-strip-gap` wobec gałęzi), jedno cięcie na grupę nie stykających się kafli (bez zysku na zimno).
- **Dalej:** (a) asfalt jako nawierzchnia, z decyzją, jak ją czyta symulacja; (b) pasy przy krawężnikach (krok 1.2); (c) reszta gołej ziemi poza miejscami brukowanymi, gdy renderer będzie kładł wypełnienia taniej (np. kolor terenu z rastra zamiast osobnych kawałków).
