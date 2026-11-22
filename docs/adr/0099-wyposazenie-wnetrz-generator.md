# ADR-0099: Wyposażenie wnętrz z katalogu i generatora: kotwice, skupiska, strefy wolne

Status: Przyjęty (22.11, propozycja użytkownika: najpierw zaprojektować wszystkie zaplanowane assety z wykazu kart, potem rozmieścić je na mapie deterministycznym generatorem). Etapy osobnymi PR-ami.

## Kontekst
Do 22.11 wyposażenie wnętrz (ADR-0098) powstawało pokój po pokoju: model w Blenderze, ręcznie liczone współrzędne w pliku `*-detail.ts`, osobny wypiek i osobny PR. Kolejka zasad z 22.11 (`docs/zasady-lokacji.md` §12–§17) dotyka 17 kart i 52 sklepów, a duża część potrzeb powtarza się w wielu miejscach: śmieci, kable, kartony, kubki i papiery, znaki wyjścia, tablice ostrzegawcze, gaśnice, kratki, plamy i kałuże. Do tego rejestr kształtów (`ROOM_DETAIL_SHAPES`) przyjmuje nowe kształty tylko na końcu, więc PR-y kolejnych pokoi stoją jeden na drugim (#918, #920, #921).

## Źródła i wzorce
- **ADR-0094** (meble uliczne): strefy, kotwice, strefy wolne, stała kolejność i klucz `fnv` zamiast losowania, kontrola w skanie glitchy. Ten sam mechanizm przenosimy do wnętrz.
- **Level dressing w grach:**
  - modułowe zestawy i drobiazg (Bethesda, praktyka „kit” i „clutter” w Fallout 4 i Skyrim);
  - rzecz główna i drobiazg wokół niej („hero prop” i „supporting clutter” w set dressingu).
- **Rozstawianie regułami po powierzchniach z maskami wykluczeń:** Unreal Engine PCG, scatter w Houdini.
- **Relacje między przedmiotami** (na blacie, przy ścianie, w zasięgu ręki) i odstępy od przejść:
  - Yu i in., „Make It Home” (SIGGRAPH 2011);
  - Fisher i in., „Example-based Synthesis of 3D Object Arrangements” (SIGGRAPH Asia 2012).

Różnice: bez optymalizacji stochastycznej i bez uczenia z przykładów. Stawiamy regułami w ustalonej kolejności, z kluczem `fnv`. Wynik to czyste dane w symulacji, sprawdzane testami.

## Decyzja

### 1. Katalog
Każdy kształt rejestru dostaje opis rozstawienia (`room-kits.ts` w `core`):
- **kotwica:**
  - `floor-wall`: na podłodze tyłem do ściany;
  - `floor-corner`;
  - `counter-top`, `table-top`, `shelf`;
  - `wall`: na ścianie, na wysokości;
  - `ceiling`;
  - `door-side`: przy drzwiach, poza strefą wolną;
  - `floor-free`: na podłodze, poza przejściami;
- **wymiary** (z wypieku);
- **rola** (główna, wspierająca, drobiazg) i liczba drobiazgów (`clutter`, §14);
- **znaczniki:** połysk albo mokro (§15), źródło dźwięku (§17).

Zestawy łączą kształty według rodzaju pomieszczenia: kuchnia, sklep według branży, peron, korytarz techniczny, biuro korporacji, hala przemysłowa, skrytka ulicy, mieszkanie. Gęstość zestawu wynika z frakcji miejsca (§16: ulica gęsto, korporacja rzadko).

Wykaz potrzeb ze wszystkich kart i z kolejki jest w `docs/pomieszczenia/katalog.md`. Z niego powstają modele.

### 2. Kotwice z geometrii symulacji
- **Ściany:** krawędzie prostokątów `InteriorRoom` bez otworów drzwi.
- **Blaty, stoły i biurka:** bryły według rodzaju (lada, stół, biurko, regał), ich wierzch i krawędź od strony klienta.
- **Drzwi:** strefa wolna przed drzwiami i za nimi, szerokość drzwi plus 0,6 m z każdej strony, 1,5 m w głąb.
- **Przejścia:** pas 0,7 m od krawędzi grafu nawigacji pokoju zostaje wolny (§12: przejścia czytelne).

### 3. Kolejność
1. Rzeczy fabularne, stawiane ręcznie (sprzęt Hebi, szafka 14, lady postaci). Zostają w `*-detail.ts` i zajmują swoje miejsce przed generatorem.
2. Rzeczy główne zestawu.
3. Rzeczy wspierające.
4. Drobiazg w skupiskach: 3–6 rzeczy w promieniu 1,2 m wokół rzeczy głównej albo na blacie.
5. Ślady: plamy, kałuże przy źródle wody, niedopałki przy drzwiach.

W obrębie kroku kolejność wyznacza `fnv(id pomieszczenia + zestaw + numer)`. Nie ma losowania, a ten sam kod daje ten sam pokój.

### 4. Budżet
- Trójkąty na pomieszczenie, osobno dla desktopu i telefonu (drobiazg `fine` znika na telefonie).
- Gęstość drobiazgu na m² według frakcji.
- Bloki rekwizytów nie rosną poza budżet z dopiskiem w `docs/backlog.md` (6,9 mln trójkątów na Krakowskim to dług).

### 5. Rejestr kształtów
Nowe kształty wchodzą rodzinami (jedna partia na rodzinę), a nie pokojami, więc PR-y przestają stać na stosie.

### 6. Kontrola
- Test na każde pomieszczenie:
  - wszystko w pokoju, nic w strefach wolnych drzwi i w pasach przejść, nic w bryłach;
  - pomiary kart w normie: luzem do 25% (§14);
  - budżet trójkątów.
- Skan glitchy dostaje rodzaj `room-prop-blocks-door`.

## Etapy
1. Katalog potrzeb (`docs/pomieszczenia/katalog.md`) z kart i z kolejki, z rodzinami, kotwicami i liczbą miejsc.
2. Generator i testy na istniejących kształtach, bez nowych modeli. Najpierw perony metra i biuro Tessen.
3. Partia modeli 1: wspólny drobiazg i oznakowanie (śmieci, kable, kartony, kubki, papiery, znaki wyjścia, tablice, gaśnice, kratki, plamy i kałuże). Jedna partia, jeden wypiek.
4. Partia modeli 2: zestawy rodzajów (sklepy według branż, kuchnie, perony, biura, przemysł).
5. Rozstawienie we wszystkich wnętrzach i przegląd zrzutami każdej karty, przed i po.
6. Połysk i wilgoć (§15) oraz dźwięk ze źródła (§17) z tych samych kotwic.

## Konsekwencje
- Mniej PR-ów i bez stosów. Jedna reguła dla wszystkich pokoi, więc łatwiej utrzymać zasady.
- Ryzyko jednakowego wyglądu. Zabezpieczenia:
  - rzeczy fabularne stawiane ręcznie;
  - warianty kształtów w rodzinie;
  - klucz zależny od pokoju;
  - przegląd zrzutami.
- Rozstawienia ręczne z #918, #920 i #921 zostają. Generator dokłada wokół nich i ich nie przesuwa.
