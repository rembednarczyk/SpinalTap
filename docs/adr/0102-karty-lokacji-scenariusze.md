# ADR-0102: Karty wszystkich lokacji i scenariusze lokacji fabularnych

Status: Przyjęty (23.11, polecenie użytkownika przed snem: „Wszystkie lokacje w grze również dostają swoje historie i podlegają również naszym zasadom level designu. Jeśli to lokacje fabularne, dodatkowo otrzymują szczegółowe scenariusze. Następnie przeprojektowujesz/dodajesz wszelkie brakujące detale i konfiguracje tych scen bazując na historiach i scenariuszach lokacji.”)

## Kontekst
Karty z ADR-0098 ma 71 wnętrz z `INTERIORS`. Reszta miasta, czyli dzielnice, place, podwórka scen, zabytki, wejścia metra i place budowy, nie ma historii ani audytu zasad. Sceny aktów i punkty zleceń (myjnia z M0, dach pawilonu Rena, dziedziniec zamku z aktu III, strefa W-3) są opisane tylko w ADR-ach jako projekt i w ink jako dialog. Nie ma rejestru lokacji zewnętrznych: gra zna tylko listy częściowe (`CONTRACT_SITE_IDS` 13, `TERRITORY_IDS` 10, `CITY_DISTRICT_IDS` 4, `METRO_ENTRANCES` 6, `LUBLIN_CONSTRUCTION_SITES` 3, `ENCOUNTERS` 16, `WORLD_STASHES` 6).

## Wzorzec
- **Biblia lokacji i narracja środowiskowa**, tak jak w ADR-0098: H. Smith i M. Worch, „What Happened Here? Environmental Storytelling” (GDC 2010).
- **Jednostronicowy projekt poziomu**: S. Librande, „One-Page Designs” (GDC 2010). Scenariusz mieści się na jednej stronie: pierwszy kadr, kto stoi gdzie, przebieg, drogi.
- **Beat chart**, czyli tabela rytmu poziomu z planowaniem misji w grach z otwartymi drogami (Deus Ex, Dishonored): kolejne uderzenia sceny z napięciem, nagrodą i wyjściem. Drogi cicha, głośna i ucieczki są osobno, jak w „Dwóch drogach” W-3 (ADR-0082).

Różnice: karta leży w repozytorium, a test pilnuje, że każde miejsce z list gry ma kartę. Scenariusz jest dla projektanta sceny, a nie dla gracza, więc nie zastępuje ink. Kończy się listą wymagań wobec sceny (dług), którą potem budujemy.

## Decyzja
1. **Rejestr.** `LOCATIONS` w `tools/rooms/src/locations.ts`: 42 lokacje (17 fabularnych, 25 tła), każda z id, nazwą, rodzajem i odnośnikami do list gry. Test `tools/rooms/test/locations.test.ts` pada, gdy punkt zlecenia, terytorium, dzielnica, wejście metra, plac budowy, spotkanie albo skrytka nie należy do żadnej lokacji ani do wnętrza z kartą. Nowe miejsce w grze zaczyna się od wpisu w rejestrze. Rejestr należy do narzędzi dokumentacji, gra go nie czyta. Minimapa i POI (ADR-0100) mają własne źródła.
2. **Karta lokacji.** `docs/lokacje/<id>.md` według `docs/lokacje/README.md`:
   - Historia;
   - Klimat;
   - Przeznaczenie;
   - Topografia (prawdziwe miejsce w Lublinie i odstępstwa z `docs/topografia.md`);
   - Inwentarz docelowy w trzech warstwach;
   - Frakcja i zasady (wiersz `Frakcja:` i §12–§17, na zewnątrz w sensie placu albo ulicy);
   - Dług sceny.
   Karta dzielnicy wymienia też spotkania uliczne (`## Spotkania`) z krótką mikroscenką każdego.
3. **Scenariusz.** Lokacja fabularna, czyli scena aktu, miejsce postaci fabularnej albo punkt zlecenia, i wnętrze fabularne (`STORY_INTERIORS`: klinika, Neon Koi, kapsuła, biuro Tessen, hala i piwnica W-3, Trasa Podziemna, schron, galeria i food hall Alchemii) mają `## Scenariusz` z sześcioma częściami:
   - pierwszy kadr: co gracz widzi, gdy wchodzi;
   - postacie i miejsca: kto stoi gdzie, w którą stronę patrzy i co robi;
   - przebieg: uderzenia sceny w kolejności, według kroków zadań i ink;
   - drogi: cicha, głośna, ucieczka, skróty i pułapki;
   - pora i stan świata: dzień i noc, przed zadaniem i po nim, stan frakcji;
   - wymagania wobec sceny: co scena musi mieć w geometrii, świetle, dźwięku i rozstawieniu, żeby scenariusz działał.
   Scenariusz nie zmienia fabuły: opisuje to, co już ustalają ADR-y i ink, a brak wpisuje jako dług.
4. **Partie z zapadką.** Karty powstają partiami. `tools/rooms/test/locations-pending.json` to lista jeszcze nienapisanych kart, która tylko maleje: pełna karta, która nadal jest na liście, to czerwony test (`LOCATIONS_PENDING=update` przepisuje listę). Po pierwszej partii kolejność: lokacje fabularne aktów, punkty zleceń, wnętrza fabularne, potem tła.
5. **Sceny według kart.** Dług sceny z każdej karty trafia do kolejki w `docs/backlog.md`. Budujemy go jak dług kart pomieszczeń (ADR-0098, ADR-0099): jedna scena na gałąź i PR, ze zrzutami przed i po i z przeglądem kuratora topografii, gdy zmiana dotyka rozstawienia w mieście.

## Konsekwencje
- Każde miejsce gry ma jedną historię, a scena fabularna ma scenariusz, z którego wynika jej detal. Projekt sceny i jej rozstawienie mają uzasadnienie, które da się sprawdzić.
- Nowe miejsce w listach gry bez lokacji to czerwony test w `tools/rooms`. Koszt to wpis w rejestrze i karta.
- Karty są po polsku jak karty pomieszczeń. Nie są tekstem dla gracza, więc nie podlegają ADR-0056.
