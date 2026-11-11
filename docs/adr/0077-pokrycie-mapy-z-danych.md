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
     5. drzewa z modeli 3D drzew GUGiK albo NMPT.
     6. meble uliczne z danych: ławki, słupki, latarnie, kosze, stojaki, hydranty, wiaty, tablice (prośba użytkownika 11.11).
   - **Przejścia po komórkach** obejmują już tylko resztę: raport skryptowy, zrzut tylko przy podejrzeniu.
2. **Ręczne obszary nawierzchni tylko jako wyjątek.** Gdy klasyfikacja się myli (cień, dach widoczny z góry, sezon), obszar ręczny dostaje nakładkę liczbową, a kurator sprawdza liczby zamiast obrazów.
3. **Nowy agent `source-scout`** (`.claude/agents/source-scout.md`, model Haiku): dla rodzaju glitcha albo komórki ustala, które źródło odpowiada. Sprawdza zasięg dla Lublina, licencję i aktualność, pobiera dane gotowymi skryptami i zwraca krótki raport. Nie pisze kodu produkcyjnego. Rutynowe przejście opiekuna mapy może iść na tańszym modelu, gdy ma raport skryptowy. Reguły importu, renderer i przeglądy zostają na najmocniejszym modelu.
4. **Meble uliczne kładziemy razem z pokryciem, z danych i z naszych assetów** (prośba użytkownika 11.11). Część już stoi: `pnpm osm:props` (ADR-0047) bierze punkty z OSM (`highway=street_lamp`, `amenity=bench`, `amenity=waste_basket`, `barrier=bollard` i inne z ADR-0064 etap 3), a generatory (`props-gen`, rzędy słupków, kratki) uzupełniają resztę modelami z `city-props.glb` (ADR-0058). Kolejność źródeł:
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
- **Dane:** surowe ortofoto zostaje w pamięci podręcznej narzędzia poza repo. W repo trafiają tylko wyniki pochodne (raster klasyfikacji, próbki kolorów) z atrybucją w `data/osm/ATTRIBUTION.md` (sekcja PZGiK).
- **Ryzyko:** klasyfikacja RGB myli zieleń w cieniu i jasne dachy z nawierzchnią. Dlatego kurator sprawdza próbkę, a progi ustala na kilku dzielnicach przed zastosowaniem w całym mieście. Zmiana nawierzchni w wielu miejscach naraz zmienia hash podłoża i migawkę NPR; zmieniamy je świadomie, z uzasadnieniem.
