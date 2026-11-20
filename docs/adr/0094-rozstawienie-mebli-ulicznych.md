# ADR-0094: Rozstawienie mebli ulicznych: strefy chodnika, kotwice i strefy wolne

Status: Przyjęty (20.11, prośba użytkownika; decyzje rekomendowane w punktach „Decyzje”). Etapy budowy osobnymi PR-ami.

## Kontekst
Prośba użytkownika z 20.11: rozstawić meble w przemyślany sposób, skutecznym, powtarzalnym i deterministycznym generatorem; bez założeń na dziko. Przykłady z gry:
- ogródek stoi przed wejściem do Trybunału Koronnego;
- tabliczki z nazwami ulic powinny być tylko na początku ulicy;
- Koziołki zawsze frontem do przechodnia, nigdy do ściany;
- pomniki (razem ze Sztukmistrzem) w przemyślanych miejscach.

Stan dziś (`tools/osm-import/src/props-gen.ts`, ADR-0047):
- ogródki i potykacze z planu stają co stały krok wzdłuż linii, na zmianę stronami (`lineMode` „front”), albo w obszarze ciągiem Haltona z minimalnym odstępem, tylko poza budynkami (`rynek.cafe-gardens`, 14 sztuk). Generator nie wie, gdzie są lokale ani wejścia, stąd ogródek przed Trybunałem;
- tabliczki (`namePlates`, `props-streets.ts`) to słupki na narożnikach każdego skrzyżowania ulic o różnych nazwach, do 120 sztuk;
- pomniki i rzeźby stoją w punktach OSM, a obrót bierze się z reguły ogólnej („do ulicy”, w ostateczności z hasha), bez sprawdzenia, co jest za plecami.

Działa już podobny mechanizm dla budek z jedzeniem (`props-food.ts`, ADR-0058 etap 3): budka staje przy fasadzie lokalu `fast_food`, obok jego szyldu (`BoardSpan`), nigdy przed drzwiami (`DoorSpan`), z odstępem od jezdni i przejść.

## Źródła i wzorce
- **Strefy chodnika** (NACTO Urban Street Design Guide, „Sidewalk Zones”; San Francisco Better Streets; Portland): pas przy fasadzie (wejścia, ogródki, potykacze), pas ruchu pieszego (wolny), pas mebli przy krawężniku (latarnie, ławki, drzewa, stojaki, kosze), pas buforowy. SF: pas przy fasadzie 18 cali, pas mebli co najmniej 3 stopy przy drzewach. NYC Street Design Manual: meble 18 cali od krawężnika.
- **Ogródki w polskich zabytkowych centrach:** Kraków (uchwała o Parku Kulturowym Stare Miasto) każe zachować co najmniej 0,5 m skrajni drogowej. Wrocław ma koncepcję wzorcowych form ogródków (konserwator). Ogródek przylega do lokalu, który go prowadzi. Lubelskich zasad nie znalazłem w wyszukiwarce, więc do sprawdzenia w BIP Lublina przy etapie 1.
- **Tablice z nazwami ulic:** obowiązek gminy (Prawo geodezyjne i kartograficzne, art. 47a). Rozporządzenie z 1934 r. umieszczało je na narożnikach ulic i placów, a Warszawa ma własne zasady usytuowania (ZDM). Tablica wisi na budynku narożnym, nie na słupku. Decyzja użytkownika: tylko na początku ulicy.
- **Koziołki lubelskie** (Fundacja Lubelskie Koziołki, szlak legend): to małe figurki z brązu przy kamienicach, na chodniku pod ścianą, często przy wejściu (np. Krakowskie Przedmieście 6, Narutowicza 6). Stoją plecami do muru, przodem do przechodniów.
- **Sztukmistrz z Lublina** (Jerzy Kędziora, od 2018): linoskoczek z małpką zawieszony na linie nad Grodzką, a nie pomnik na cokole.
- **Generatory reguł:** CityEngine (CGA: podział ulicy i chodnika na pasy, rozstawianie wzdłuż pasa), SimWorld (meble wokół budynków i wzdłuż dróg, strefy od osi). Rozmieszczanie z ograniczeniami i strefami wolnymi przed obiektem: Yu i in., „Make It Home” (SIGGRAPH 2011), gdzie mebel ma prostokąt dostępu, który nie może nachodzić na inne.

Nasze rozwiązanie łączy te wzorce. Chodnik ma strefy, meble mają kotwice (lokal, wejście, początek ulicy, punkt OSM), a każdy mebel ma strefę wolną, której nie wolno zastawić. Różnice: nie optymalizujemy stochastycznie jak „Make It Home”, tylko stawiamy regułami w ustalonej kolejności z hashem, żeby wynik był deterministyczny i powtarzalny.

## Decyzja

### 1. Strefy chodnika
Dla każdej próbki chodnika `Site` zna odległość do fasady i do krawężnika. Strefy:
- przy fasadzie: od fasady do 1,5 m (ogródki do 3 m, gdy chodnik ma co najmniej 5 m);
- ruchu pieszego: co najmniej 1,8 m wolne, nic w niej nie stoi;
- mebli: 0,5–1,5 m od krawężnika (latarnie, drzewa, ławki, kosze, słupki);
- na placach: strefy liczone od fasad wokół placu, środek placu wolny poza meblami z planu (fontanny, pomniki).

Każdy rodzaj mebla ma swoją strefę (`PROP_ZONE`). Mebel spoza swojej strefy to glitch skanu.

### 2. Strefy wolne
- **Wejście:** prostokąt przed każdymi drzwiami (wejścia OSM, drzwi lokali z `props-doors.ts`, bramy przejazdów): szerokość drzwi plus 0,6 m z każdej strony, głębokość 2 m od fasady. Nic tam nie stoi. Przypadek Trybunału zamykają wejścia OSM do budynku.
- **Przejście dla pieszych i przystanek:** jak dziś (`crossingBands`, przystanki).
- **Pomnik:** pierścień 1,5 m wokół cokołu i pas 6 m przed jego frontem (miejsce, z którego się go ogląda). Ogródki i stragany tam nie stają, ławki mogą stać na brzegu.

### 3. Kotwice
- **Ogródek** należy do lokalu gastronomicznego (`amenity=cafe|restaurant|bar|pub|ice_cream|fast_food` z `venues.ts`, szyld na fasadzie). Stoi w strefie przy fasadzie przed witryną lokalu, w obrębie jego szerokości fasady, poza strefami wolnymi wejść, także jego własnego. Na placu (Rynek) stoi przed fasadą lokalu na placu, a nie w dowolnym punkcie obszaru. Liczba ogródków wynika z lokali (jeden na lokal, dwa przy fasadzie dłuższej niż 12 m), a liczby z planu są górnym limitem dzielnicy.
- **Potykacz** stoi przy drzwiach lokalu lub sklepu, 0,5–1 m z boku wejścia, w strefie przy fasadzie, ustawiony prostopadle do fasady, żeby obie strony czytał przechodzień idący wzdłuż chodnika.
- **Tabliczka z nazwą ulicy** wisi na ścianie budynku narożnego na początku ulicy, na wysokości 2,5–3 m, licem w stronę ulicy. Początek ulicy to koniec o najniższych numerach domów (adresy OSM `addr:street`, `addr:housenumber`). Bez adresów jest to koniec bliższy centrum (Brama Krakowska), bo w Polsce numeracja biegnie od centrum. Jedna tabliczka na każdy koniec początku, na budynkach po obu stronach wylotu, jeśli są narożne. Ulica o kilku odcinkach ma tabliczkę tylko na początku pierwszego.
- **Koziołek** (`monument`/`artwork` z kształtem `koziolek`) stoi w punkcie OSM. Obrót to plecy do najbliższej fasady w promieniu 3 m, a przód wzdłuż jej normalnej na zewnątrz, w stronę chodnika. Bez fasady w pobliżu przód patrzy w stronę najbliższego ciągu pieszego. Nigdy przodem do ściany: test i skan.
- **Pomnik** stoi w punkcie OSM. Front patrzy w stronę największej otwartej przestrzeni wokół (najdłuższy wolny promień po placu albo chodniku, próbki co 15°), a gdy wiele kierunków jest równych, w stronę głównego dojścia (najbliższej ulicy z nazwą). Ręczna tabela znanych pomników (`props-art.ts`) może podać obrót z planu i ma pierwszeństwo.
- **Sztukmistrz** nie stoi na cokole. Wisi na linie rozpiętej między fasadami nad Grodzką, w punkcie OSM, na wysokości ok. 7 m. Osobny model w etapie 4.

### 4. Kolejność i determinizm
Generator stawia w stałej kolejności: wejścia i strefy wolne, potem pomniki i rzeźby (z ich strefami), latarnie i drzewa (pas mebli), tabliczki, ogródki i potykacze (pas przy fasadzie), na końcu ławki, kosze i drobiazg. W obrębie kroku kolejność wyznacza klucz (`fnv(key)`). Nie ma losowości. Ten sam stan danych daje te same meble.

### 5. Kontrola
Skan glitchy dostaje nowe rodzaje, z bazą od dnia wdrożenia:
- `prop-blocks-entrance`: mebel w strefie wolnej wejścia;
- `statue-faces-wall`: Koziołek albo pomnik przodem do fasady bliżej niż 2 m;
- `plate-not-at-start`: tabliczka nie na początku ulicy;
- `garden-without-venue`: ogródek dalej niż 8 m od lokalu gastronomicznego.

Testy narzędzia sprawdzają reguły na małych scenach i na całym mieście: Trybunał bez ogródka w strefie wejścia, każdy Koziołek z fasadą za plecami i liczba tabliczek równa liczbie ulic z nazwą (z adresami albo bez).

## Etapy (osobne PR-y)
1. Strefy wolne wejść (z wejść OSM, drzwi lokali i bram) dla wszystkich mebli oraz rodzaj skanu `prop-blocks-entrance`. Usuwa ogródek przed Trybunałem i podobne przypadki.
2. Ogródki i potykacze zakotwiczone przy lokalach. Zastępują rozrzut po obszarze i krok na linii.
3. Tabliczki na początku ulicy, na ścianie budynku narożnego, z adresów OSM. Model tabliczki ściennej.
4. Koziołki i pomniki: obrót według reguł, strefa oglądania pomnika, Sztukmistrz na linie nad Grodzką.
5. Strefy chodnika dla reszty mebli (`PROP_ZONE`) i rodzaj skanu mebla poza strefą.

Każdy etap: `pnpm osm:props`, `scan:diff`, przegląd topografii (zmiana rozstawienia), zrzuty przed i po z Rynku, deptaku i Krakowskiego.

## Konsekwencje
- Mebli może być mniej tam, gdzie nie ma lokali i wejść, a więcej przy lokalach. Liczby z planu stają się limitami.
- Tabliczek jest mniej (jedna na ulicę zamiast na każde skrzyżowanie), za to wiszą na ścianach jak w Lublinie.
- Zmienia się `props.generated.ts` i baza skanu. Symulacja widzi meble jako bryły, więc złote hashe Lublina mogą się zmienić tylko w testach na mieście, nie w podłodze testowej.

## Źródła
- NACTO, Urban Street Design Guide, Sidewalk Zones: https://nacto.org/publication/urban-street-design-guide/street-design-elements/sidewalks/sidewalk-zones/
- San Francisco Better Streets, Sidewalk Zones: https://sfbetterstreets.org/design-guidelines/sidewalk-zones/
- Portland, Sidewalk Zones: https://www.portland.gov/transportation/sidewalk-zones
- NYC Street Design Manual: https://nycstreetdesign.info/node/138
- Kraków, uchwała o Parku Kulturowym Stare Miasto: https://krakow.pl/zalacznik/286185
- Wrocław, ogródki gastronomiczne: https://www.wroclaw.pl/przedsiebiorczy-wroclaw/zarzadzenie-w-sprawie-ogrodkow-gastronomicznych-oraz-koncepcja-organizacji
- ZDM Warszawa, zasady tablic adresowych i ulicowych: https://zdm.waw.pl/wp-content/uploads/2020/07/Zasady-umieszczania-treści-i-usytuowania-tablic-adresowych-i-ulicowych-.pdf
- Rozporządzenie z 1934 r.: https://api.sejm.gov.pl/eli/acts/DU/1934/850/text/U/D19340850Lj.pdf
- Esri CityEngine, street furniture: https://support.esri.com/en-us/knowledge-base/faq-how-do-i-place-street-furniture-like-lamp-poles-or-000011366
- SimWorld, City Generation: https://simworld.readthedocs.io/en/latest/components/citygen.html
- Lubelskie Koziołki: https://miastoinspiracji.lublin.eu/en/trasy/koziolkowy-szlak-legend/, https://radio.lublin.pl/2024/07/zna-sie-na-dobrej-literaturze-koziolek-czytelnik-na-krakowskim-przedmiesciu
- Sztukmistrz z Lublina: https://archiwum.radio.lublin.pl/2021/01/warunki-zimowe-zaskoczyly-sztukmistrza-z-lublina-co-dalej-z-popularna-rzezba
