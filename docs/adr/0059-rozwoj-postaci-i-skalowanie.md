# ADR-0059: Rozwój postaci (poziomy, atrybuty, drzewka) i skalowanie łupów, wrogów i kontraktów

## Kontekst
Gra nie ma dziś rozwoju postaci.
- Build tworzą wszczepy z perkami (ADR-0032, ADR-0033) i ekwipunek (ADR-0015).
- Łupy pochodzą ze stałych tabel. Trzy rzadkości mają stałe mnożniki (`core/items/rarity.ts`: zwykły ×1, niezwykły ×1,08, rzadki ×1,16).
- Jedyne skalowanie to wzór `ukończone kontrakty / 3`. Dokłada przeciwników w kontraktach (`contracts.ts`) i powiększa pulę cyberware (`CYBER_CAPACITY_STEPS`).

Użytkownik chce skalowania jak w grach tego gatunku: łup ma rosnąć z postacią i do niej pasować. Miarą ma być rozwój postaci. Decyzje użytkownika (31.10):
- atrybuty z drzewkami;
- 30 poziomów.

## Decyzja

### Doświadczenie i poziom
- **Poziom** to wartość od 1 do 30. Postęp liczy łączne doświadczenie (XP) w `DomainState.progression`, w formacie `{ xp, level, attributes, perks, unspent }`.
- **Krzywa:**
  - XP na kolejny poziom to `round(100 × L^1,6)` dla poziomu L. Poziom 2 wymaga 100 XP, ostatni próg (29 → 30) ok. 21,9 tys., a cała droga do poziomu 30 ok. 255 tys.
  - Tabela jest w `core/progression/curve.ts`, a test pilnuje jej tempa.
  - Cel tempa: jeden pełny wątek główny dzielnicy z kontraktami daje 8–10 poziomów.
- **Źródła XP**, wszystkie przez nowe zdarzenie domeny `ExperienceGained { amount, source }`:
  - kroki zadań i całe zadania (stała z definicji zadania);
  - kontrakty, według trudności i poziomu kontraktu;
  - pokonani wrogowie, według różnicy poziomów. Wróg o 5 poziomów słabszy daje 10% XP, wróg o 5 poziomów mocniejszy daje 150%;
  - hackowanie: udany quickhack i włamanie;
  - skradanie: obezwładnienie bez alarmu i kontrakt bez wykrycia (premia).
- **Awans:**
  - Zdarzenie `LevelUp { level }` daje 1 punkt atrybutu i 1 punkt perku.
  - Co trzeci poziom pula cyberware rośnie o 2. Zastępuje to progi „ukończone kontrakty”, a odłamki pojemności zostają.
  - Maksymalne zdrowie rośnie o 3 na poziom.

### Atrybuty
Atrybutów jest pięć. Każdy ma wartość od 3 do 15. Na starcie są po 3, a na poziomach 2–30 gracz rozdaje 29 punktów, więc nie da się wymaksować wszystkich. Nazwy i opisy są kluczami z ADR-0056.

| Atrybut | Klucz | Bierny efekt na punkt (przez `StatModifiers`) | Drzewko |
|---|---|---|---|
| Krzepa | `might` | +4 zdrowia, +2% obrażeń wręcz | walka wręcz i ostrza, wytrzymałość |
| Refleks | `reflex` | +1% stabilności celowania, krótszy czas wejścia w celowanie | broń palna, zryw, uniki |
| Technika | `tech` | +1 punkt pancerza z odzieży, +1 pojemności cyberware na 3 punkty | wszczepy, pancerz, granaty i urządzenia |
| Sieć | `net` | +1 RAM na 2 punkty, szybszy upload | quickhacki, włamania, kamery |
| Cień | `shadow` | wolniejsze wykrywanie (−2% na punkt), +0,5% szansy krytycznej | skradanie, obezwładnienia, przebrania |

- Atrybut otwiera progi swojego drzewka przy wartościach 4, 8, 12 i 15.
- Każde drzewko ma ok. 8 perków na czterech progach, ostatni to perk kluczowy.
- Perki zmieniają sposób gry, nie tylko liczby. Przykłady:
  - przeładowanie po obezwładnieniu bez alarmu;
  - quickhack przeskakujący na drugi cel;
  - odbicie pocisku przy pełnym zrywie.
- Część perków ma kilka stopni.
- Perki działają przez `StatModifiers` albo przez flagi zdolności, czytane w systemach `sim` tak jak perki wszczepów (`perk` w `createSystems()`). Nie powstają nowe systemy na każdy perk.
- **Zmiana rozdania** odbywa się u Mori za €$, a cena rośnie z poziomem. Zwraca wszystkie punkty atrybutów i perków.

### Poziom przedmiotu i rzadkości
- **Poziom przedmiotu** to wartość od 1 do 30, zapisana w instancji przedmiotu (`ItemInstance.level`).
  - Statystyki skalują się z poziomem: obrażenia i pancerz rosną o 4% na poziom ponad 1, czyli ×2,16 na poziomie 30. Do tego dochodzi mnożnik rzadkości.
  - Cena skaluje się tak samo.
  - Przedmioty bez stanu (amunicja, materiały) nie mają poziomu.
- **Rzadkości:**
  - Zwykły, niezwykły i rzadki zostają.
  - Dochodzą epicki i legendarny.
  - Unikat zostaje z własnymi liczbami i skaluje się z poziomem.
  - Od epickiego przedmiot dostaje 1–2 **cechy** z tabeli dla rodzaju broni lub odzieży, np. tłumik, rykoszet, przebicie pancerza czy odporność na hack. Cechy są danymi w `core/items`, a nie kodem w systemach.
- **Poziom łupu** to `clamp(poziom pasma, poziom gracza ± 2)`:
  - z wroga: poziom wroga ±1;
  - ze skrzyni: poziom dzielnicy.
  - Sklepy mają asortyment w paśmie poziomu gracza, a rzadkość zależy od reputacji (ADR-0011).

### Pasma dzielnic i poziom wrogów
- Każda dzielnica ma pasmo trudności w treści `sim`. Wstępnie, do strojenia testem balansu:
  - Krakowskie: 1–8;
  - Stare Miasto: 5–14;
  - Podzamcze z targiem: 10–20;
  - Nabrzeże i doki: 16–30.
- **Poziom wroga** to poziom gracza przycięty do pasma dzielnicy, ±1 dla elity i szefa. Wewnątrz pasma świat nadąża za graczem, a poza nim zostaje słabszy albo mocniejszy.
- Zdrowie i obrażenia wroga skalują się tak samo jak przedmioty: +4% na poziom. W paśmie czas walki zostaje mniej więcej stały, a przewagę dają atrybuty, perki i rzadkość.
- **Kontrakty:** poziom kontraktu to poziom wroga w jego dzielnicy. Skład, stawka i nagroda liczą się z tego poziomu, a nie z `ukończone / 3`. Stawki z ADR-0018 i ADR-0024 stają się stawkami dla poziomu 1.

### Łup dopasowany do postaci
- **Wagi tabel łupów** przesuwają się w stronę stylu gracza. Styl to licznik użycia rodzaju broni (pistolet, SMG, karabin, wręcz) i ścieżki (quickhacki, skradanie) z ostatnich ok. 50 walk, zapisany w `progression`. Przesunięcie jest ograniczone do +60% wagi, więc inne rodzaje dalej wypadają.
- **Ochrona przed pechem:** po 8 kolejnych łupach bez przedmiotu co najmniej rzadkiego następny ma rzadkość co najmniej rzadką. Licznik jest w `progression`.
- Wszystko to czyste funkcje w `core/items/loot.ts` z `RandomPort`, deterministyczne dla danego stanu.

### Interfejs
- **Ekran postaci** dostaje zakładkę Rozwój: atrybuty z punktami, pięć drzewek, opis perków i zmianę rozdania. Wszystkie teksty są w katalogach `en/pl`.
- **HUD:**
  - pasek XP przy pasku zdrowia;
  - komunikat o awansie;
  - liczba niewydanych punktów przy przycisku postaci, także na dotyku.
- **Karta przedmiotu** pokazuje poziom, rzadkość i cechy, a porównanie z założonym przedmiotem bierze pod uwagę poziom.

### Zapis i determinizm
- `SAVE_SCHEMA_VERSION` rośnie, a migracja w `packages/persistence/src/migrations.ts` ma test. Starszy zapis dostaje:
  - doświadczenie liczone wstecz z ukończonych zadań i kontraktów;
  - niewydane punkty do rozdania;
  - poziom przedmiotów z rzadkości: zwykły 1, niezwykły 3, rzadki 5, unikat równy poziomowi gracza;
  - pustą statystykę stylu i licznik pecha równy 0.
- Złote hashe (`determinism.test.ts`) zmieniają się świadomie, z uzasadnieniem w commicie, bo poziomy wrogów i łupy zmieniają symulację.

## Etapy (osobne PR-y, każdy przez `feature-builder` i `change-verifier`)
1. **Model:** `core/progression` (krzywa, atrybuty, punkty), zdarzenia `ExperienceGained` i `LevelUp`, źródła XP, migracja zapisu, pula cyberware z poziomów. Kontrakty zdarzeń zmienia architekt.
2. **Atrybuty i ich efekty bierne** przez `StatModifiers`, RAM i wykrywanie.
3. **Drzewka perków:** dane, wymagania progów, efekty przez modyfikatory i flagi zdolności, zmiana rozdania u Mori.
4. **Poziom przedmiotu, nowe rzadkości i cechy:** skalowanie statystyk i cen, poziom łupu, sklepy.
5. **Pasma dzielnic, poziom wrogów i kontraktów.**
6. **Łup dopasowany do stylu i ochrona przed pechem.**
7. **Interfejs:** zakładka Rozwój, pasek XP, awans, karta przedmiotu, dotyk.
8. **Test balansu:** symulacja przejścia (zadania i kontrakty po kolei) sprawdza tempo 8–10 poziomów na dzielnicę, czas walki w paśmie, rozkład rzadkości na poziomach 1, 10, 20 i 30 oraz brak serii pecha dłuższych niż 8.

## Konsekwencje
- Łup i przeciwnicy rosną razem z graczem, a pasma dzielnic zachowują poczucie, że miasto jest bezpieczniejsze albo groźniejsze w różnych miejscach.
- Wszczepy zostają drugą osią buildu, a pojemność cyberware zależy teraz od poziomu i Techniki zamiast od liczby kontraktów.
- Rośnie stan domeny i zapis. Poziom ma każda instancja przedmiotu, a progresja trzyma statystykę stylu.
- Wartości liczbowe (krzywa, +4% na poziom, pasma, wagi) są wstępne. Ustala je test balansu z etapu 8, a ich zmiany nie wymagają nowego ADR-u.
- **Zależność z audytu (31.10):** gra nie ma jeszcze obezwładnień (takedown, ogłuszenie). Źródło XP „skradanie” i perki drzewka Cień, które ich wymagają, czekają na osobny ADR obezwładnień. Etap 1 emituje tylko XP z tego, co istnieje.
- **Z weryfikacji etapu 1 (31.10):** walidacja zapisu wymaga, żeby poziom był równy poziomowi z krzywej dla XP. Zmiana krzywej w etapie 8 musi więc mieć migrację albo przeliczenie poziomu przy wczytaniu. Liczenie wydanych perków (suma rang) aktualizuje etap 3. XP za quickhack przysługuje raz na cel, a pamięć celów ma 256 wpisów.
- **Z budowy etapu 2 (5.11):**
  - Efekt liczy się od punktów ponad startowe 3, więc nowa postać gra jak przed etapem, a złote hashe się nie zmieniły.
  - Liczby bez wartości w tabeli są wstępne i do strojenia w etapie 8: czas celowania −2% na punkt Refleksu, upload −2% na punkt Sieci.
  - Technika daje +1 pancerza na punkt tylko na strefach, które chroni założona odzież, i dalej obowiązuje limit 8 na strefę. Przy 15 Technice prawie każda ubrana strefa dochodzi do limitu, więc ta liczba jest pierwsza do strojenia.
  - Cień spowalnia napełnianie licznika wzroku gangera, przebrania i kamer, mnożąc je razem z `awareness` trudności. Nie zmienia spadku licznika ani hałasu kroków. Mniejszy hałas daje drzewko w etapie 3.
  - Typ `StatModifiers` dostał pola `meleeDamage` (udział) i `garmentArmor`. Pula RAM to `BASE_RAM` plus Sieć, a punkt, który ją powiększa, od razu wysyła `RamChanged`.
  - Komenda `spend-attribute-point` i zapis atrybutów były już w etapie 1. Etap 2 nie zmienia kontraktów komend ani zdarzeń i nie podbija `SAVE_SCHEMA_VERSION`.
  - Wydawanie punktów ma na razie tylko sekcję na zakładce Karta (`ProgressionIntents`). Pełna zakładka Rozwój przychodzi w etapie 7.
- **Z budowy etapu 3 (6.11):**
  - Drzewka są w `core/progression/perks.ts`, efekty w `perk-effects.ts`. Każde drzewko ma na razie 5 perków (zamiast ok. 8): dwa na progu 4, po jednym na 8 i 12 oraz kluczowy na 15. Razem 41 rang przy 29 punktach z poziomów. Pozostałe perki dochodzą razem z mechanikami, których jeszcze nie ma (granaty, przebrania w drzewku Cień, reakcja grupowa).
  - Ranga kosztuje 1 punkt perku. Próg otwiera wyłącznie wartość atrybutu, bez wymogu perka z niższego progu.
  - Perki i ich wstępne liczby. Wszystkie są do strojenia w etapie 8:

    | Drzewko | Perk (klucz) | Próg | Rangi | Efekt na rangę | Gdzie działa |
    |---|---|---|---|---|---|
    | Krzepa | Gruba skóra (`might_tough`) | 4 | 3 | +8 zdrowia | `StatModifiers.maxHp` |
    | Krzepa | Zabijaka (`might_brawler`) | 4 | 2 | +10% obrażeń wręcz | `StatModifiers.meleeDamage` |
    | Krzepa | Drugi oddech (`might_second_wind`) | 8 | 1 | regeneracja wytrzymałości gardy ×1,5 | system `perk` |
    | Krzepa | Zahartowana (`might_hardened`) | 12 | 2 | +2 pancerza | `StatModifiers.armor` |
    | Krzepa | Miażdżąca garda (`might_crushing_parry`), kluczowy | 15 | 1 | ogłuszenie po parowaniu gracza ×2, czyli dłuższe okno obezwładnienia (ADR-0065) | `melee` |
    | Refleks | Pewna ręka (`reflex_steady`) | 4 | 3 | +4% stabilności celowania | `StatModifiers.aimStability` |
    | Refleks | Szybkie dłonie (`reflex_quick_reload`) | 4 | 2 | przeładowanie −15% | `weapon` (tylko gracz) |
    | Refleks | Ślizg (`reflex_slipstream`) | 8 | 1 | odnowienie zrywu −40% | `perk` |
    | Refleks | Snajperskie oko (`reflex_deadeye`) | 12 | 2 | +0,2 mnożnika krytyka | `StatModifiers.critMultiplier` |
    | Refleks | Taniec z kulami (`reflex_bullet_dance`), kluczowy | 15 | 1 | pocisk trafiający w zryw (czas nietykalności) wraca jak odbity Odruchem Tsubame | `combat`, `deflectShot` |
    | Technika | Krawiec (`tech_tailor`) | 4 | 2 | +1 pancerza na strefach chronionych przez odzież | `StatModifiers.garmentArmor` |
    | Technika | Polowy medyk (`tech_field_medic`) | 4 | 2 | leczenie przedmiotami +25% | `use-item` |
    | Technika | Podkręcenie (`tech_overclock`) | 8 | 2 | +2 pojemności cyberware | `cyberCapacityOf` |
    | Technika | Chłodziwo (`tech_coolant`) | 12 | 1 | odnowienie aktywnego wszczepu ×1,4 | `ability` |
    | Technika | Drugie serce (`tech_second_heart`), kluczowy | 15 | 1 | śmiertelny cios zostawia 25% zdrowia, raz na 120 s (stan przejściowy jak zryw, po wczytaniu gotowy) | `death` |
    | Sieć | Bufor (`net_buffer`) | 4 | 2 | +1 RAM | `ramMaxOf` |
    | Sieć | Szybki upload (`net_fast_upload`) | 4 | 2 | upload −10% (mnoży się z Siecią) | `scanner` |
    | Sieć | Odzysk (`net_recycler`) | 8 | 1 | regeneracja RAM ×1,5 | `scanner` |
    | Sieć | Widmowy sygnał (`net_ghost_signal`) | 12 | 2 | licznik kamery −15% (mnoży się z Cieniem) | `crime` |
    | Sieć | Łańcuch (`net_chain`), kluczowy | 15 | 1 | efekt quickhacka przeskakuje na najbliższy cel tego samego rodzaju do 8 m od pierwszego, w jego linii wzroku; bez osobnego śladu i bez XP | `scanner` |
    | Cień | Ciche kroki (`shadow_soft_steps`) | 4 | 2 | hałas kroków i lądowania −25% (ADR-0069) | `hearNoise` |
    | Cień | Szybki chwyt (`shadow_quick_takedown`) | 4 | 2 | `TAKEDOWN_TIME` −20% (ADR-0065) | `takedown` |
    | Cień | Muł (`shadow_mule`) | 8 | 1 | niesienie ciała 0,85 chodu zamiast 0,6 | `player-control` |
    | Cień | Skradacz (`shadow_prowler`) | 12 | 1 | chód w kucaniu 0,7 zamiast 0,5 | `player-control` |
    | Cień | Widmowe przeładowanie (`shadow_ghost_reload`), kluczowy | 15 | 1 | obezwładnienie celu, który nie walczył z graczem, bez świadka napełnia magazynek broni w ręku z zapasu (ADR-0065) | `takedown` |

  - Perki z drzewek nie dublują perków wszczepów (ADR-0033). `hasPerk` dalej czyta wszczepy, a `hasProgressionPerk` i skale z `perk-effects` czytają `progression.perks`. Taniec z kulami i Ślizg wymagają zrywu ze Ścięgien Kitsune, a perk drzewka tylko go wzmacnia.
  - Bez perków każda skala to dokładnie 1, a każdy dodatek 0, więc złote hashe się nie zmieniły.
  - **Kontrakty (zgoda w tym ADR-ze):** komenda `spend-perk-point { perk }` odmawia bez punktu, przy zamkniętym progu i na ostatniej randze. Komenda `respec` to usługa kliniki: przechodzi przez komendy handlowe i odmawia przez `PurchaseFailed` z istniejącymi powodami: `refused` na warunkach podstawowych (ADR-0070), `insufficient-funds`, `empty-slot`, gdy nic nie wydano, oraz `over-capacity`, gdy wszczepy nie zmieszczą się w puli bez Techniki i Podkręcenia (gracz najpierw wyjmuje wszczep, co u Mori nic nie kosztuje). Nie ma nowych zdarzeń. Pula RAM, która się zmienia, wysyła `RamChanged` i przycina RAM.
  - **Zmiana rozdania:** cena to `300 + 150 × (poziom − 1)` €$ (poziom 30: 4650 €$) z mnożnikiem reputacji Mori. Zwraca wszystkie punkty atrybutów i perków, a XP, poziom i pamięć hacków zostają. Liczby są do strojenia w etapie 8.
  - **Zapis:** rangi były w zapisie od etapu 1 (`progression.perks`), a suma rang liczy się już jako wydane punkty perków. Dlatego `SAVE_SCHEMA_VERSION` się nie zmienia i nie ma migracji. Walidacja odrzuca nieznany perk, rangę ponad ostatnią i próg, którego atrybut nie otwiera.
  - **Interfejs:** na zakładce Karta jest sekcja Perki (ranga, opis, wymaganie progu, przycisk 32 px). U Mori na zakładce Wszczepy jest sekcja Przebudowa z ceną. Teksty są w `i18n/{en,pl}/progression.ts`. Pełna zakładka Rozwój przychodzi w etapie 7.

## Decyzje użytkownika po etapie 3 (6.11)

Przyjęte: udana zmiana rozdania (respec) i drugi cel Łańcucha dostają własne zdarzenie i komunikat (np. `ProgressionReset`).

Nieprzyjęte, do poprawy w etapie 3b:
- drzewka mają mieć ok. 8 perków jak w ADR, nie 5;
- respec nie odmawia przy wszczepach ponad pulą bez punktów: wszczepy zostają, a pula pokazuje przekroczenie, dopóki gracz ich nie wyjmie (alternatywa z etapu 3);
- próg drzewka wymaga perka z niższego progu tego drzewka, nie samej wartości atrybutu.

## Z budowy etapu 3b (6.11)

Etap 3b wykonuje decyzje użytkownika z 6.11. Zastępuje trzy punkty z opisu etapu 3: 5 perków na drzewko, próg otwierany samą wartością atrybutu i odmowę respecu z powodem `over-capacity`, a także zdanie „Nie ma nowych zdarzeń”. Liczby nowych perków są wstępne i do strojenia w etapie 8.

- **Drzewka:** każde ma 8 perków na progach 4, 8, 12 i 15 (3, 2, 2 i 1 perk). Razem jest 40 perków i 68 rang przy 29 punktach z poziomów. Nowe perki działają tylko na mechanikach, które już są. Granaty, przebrania jako osobna gałąź i reakcja grupowa dalej czekają na swoje mechaniki.

  | Drzewko | Perk (klucz) | Próg | Rangi | Efekt na rangę | Gdzie działa |
  |---|---|---|---|---|---|
  | Krzepa | Twarda głowa (`might_thick_skull`) | 4 | 2 | +2 pancerza głowy | `StatModifiers.headArmor` |
  | Krzepa | Żelazna garda (`might_iron_guard`) | 8 | 2 | odbicie pocisku kosztuje gardę −25% wytrzymałości (wymaga Odruchu Tsubame) | `deflect` |
  | Krzepa | Taran (`might_battering_ram`) | 12 | 1 | odepchnięcie po nieosłoniętym ciosie gracza ×2 | `melee` |
  | Refleks | Strzelec wyborowy (`reflex_sharpshooter`) | 4 | 2 | +3% szansy krytycznej | `StatModifiers.critChance` |
  | Refleks | Lekki krok (`reflex_light_step`) | 8 | 2 | +0,2 m/s chodu | `StatModifiers.moveSpeed` |
  | Refleks | Błyskawiczny celownik (`reflex_snap_aim`) | 12 | 2 | wejście w celowanie −15% (mnoży się z Refleksem) | `player-control` |
  | Technika | Tolerancja stymulantów (`tech_stim_tolerance`) | 4 | 2 | buff z jedzenia i napojów +25% czasu | `use-item` |
  | Technika | Kondensator (`tech_capacitor`) | 8 | 2 | aktywny wszczep działa +20% dłużej | `ability` |
  | Technika | Wzmocnione szwy (`tech_reinforced_seams`) | 12 | 1 | zużycie odzieży ×0,5 (1 zamiast 2 na trafienie) | `combat`, `wearGarments` |
  | Sieć | Daleki zasięg (`net_long_range`) | 4 | 2 | zasięg skanera +20% (25 → 35 m) | `scanner` |
  | Sieć | Uporczywy kod (`net_persistence`) | 8 | 2 | czas efektu quickhacka +20% | `scanner` |
  | Sieć | Przeciążenie (`net_overload`) | 12 | 2 | Zwarcie +25% obrażeń, w całych punktach | `scanner` |
  | Cień | Niski profil (`shadow_low_profile`) | 4 | 2 | tempo wykrywania −5% (strażnicy, przebranie, kamery; mnoży się z Cieniem i trudnością) | `detectionPaceOf` |
  | Cień | Długie ręce (`shadow_long_arms`) | 8 | 1 | zasięg obezwładnienia +0,4 m | `takedown` |
  | Cień | Zabójca (`shadow_assassin`) | 12 | 2 | +4% szansy krytycznej | `StatModifiers.critChance` |

- **Ciąg progów:** próg powyżej pierwszego wymaga wartości atrybutu i co najmniej jednej rangi perka z progu niżej w tym samym drzewku (`perkPathMet`, `perkOpen`). Perk innego drzewka się nie liczy. Odmowa `spend-perk-point` to dalej `locked`. Kolejna ranga już kupionego perka nie wymaga ciągu.
- **Zapisy z etapu 3:** zapis, w którym próg otwierała sama wartość atrybutu, zostaje ważny i zachowuje perki. Przykład: Zahartowana przy Krzepie 12 bez perków z progów 4 i 8. Walidacja nie sprawdza ciągu, a nowe wydania już go wymagają. Schemat się nie zmienia, bo nowe perki to nowe klucze w `progression.perks`. Dlatego `SAVE_SCHEMA_VERSION` się nie zmienia i nie ma migracji.
- **Respec ponad pulą:** `buyRespec` nie dostaje już `implantsFit`, a respec nie odmawia powodem `over-capacity`. Wszczepy zostają. Karta (wiersz pojemności w sekcji Wszczepy) i pasek pojemności u Mori pokazują przekroczenie i wskazówkę, dopóki gracz nie wyjmie wszczepu. Nowy montaż ponad pulą dalej dostaje `over-capacity`. Powód `over-capacity` zostaje w `PurchaseFailure` dla montażu.
- **Odmowy respecu (G-366):** lada sprawdza przed komendą te same warunki co core (`respecRefusal`). Toast mówi, co zrobić: poprawić reputację u Mori, wrócić z pieniędzmi (z ceną) albo najpierw wydać punkt. `PurchaseFailed` z symulacji zostaje jako zabezpieczenie.
- **Kontrakty zdarzeń (zgoda w briefie orkiestratora):**
  - `ProgressionReset { price, attribute, perk }` przychodzi po udanym respecu. `attribute` i `perk` to punkty do rozdania po nim. Prezenter pokazuje toast „Przebudowa gotowa”.
  - `QuickhackChained { hackId, fromId, targetId }` przychodzi przy drugim celu Łańcucha, po jego `QuickhackApplied`. Notatka skanera brzmi „{hack}: przeskok na drugi cel”.
  - Komend nie zmieniono.
- **Determinizm:** bez perków każda skala to dokładnie 1, a każdy dodatek 0, więc złote hashe się nie zmieniły.

## Z budowy etapu 3c (6.11)

Weryfikator etapu 3b (#313) pokazał obejście: Technika i Podkręcenie, pełny montaż wszczepów, respec i punkty w inne drzewka, a wszczepy zostawały ponad pulą z pełnym działaniem. Etap 3c wykonuje decyzje użytkownika z 6.11. Zastępuje zdanie z etapu 3b „Kolejna ranga już kupionego perka nie wymaga ciągu”.

- **Wszczepy ponad pulą nie działają.** Pula jest rozdzielana w stałej kolejności gniazd: optyka, układ nerwowy, szkielet, ramiona (`CAPACITY_ORDER` w `core/cyberware/active.ts`). Wszczep działa, jeśli mieści się w tym, co zostało z puli. Jeśli się nie mieści, jest nieaktywny, a liczenie idzie dalej, więc mniejszy wszczep po nim może jeszcze działać. Nieaktywny wszczep nie daje statystyk, perka (`hasPerk`: zryw, odbicie) ani aktywnej zdolności. Wraca od razu, gdy zwolni się miejsce: po wyjęciu wszczepu, punkcie Techniki, randze Podkręcenia, odłamku albo awansie.
  - Kolejność gniazd zamiast kolejności montażu, bo stan wynika wtedy wyłącznie z zamontowanych wszczepów i puli. Zapis nie dostaje nowego pola, więc `SAVE_SCHEMA_VERSION` się nie zmienia i nie ma migracji.
  - Optyka startowa (2) zawsze mieści się w najmniejszej puli (12), a z nią każdy wszczep układu nerwowego (do 7). Dlatego w praktyce wyłączają się szkielet i ramiona, czyli zryw, Splot podskórny i Odruch Tsubame.
  - Symulacja czyta działające wszczepy przez `workingCyberware(domain)`: statystyki (`playerStatsOf`), perki wszczepów (`perk`, `deflect`) i zdolność (`ability`). Wygląd postaci i limit montażu liczą wszystkie zamontowane wszczepy. Pulę liczy `cyberPoolOf` w `core`, a `cyberCapacityOf` w `sim` ją przekazuje.
  - Kontrakty portów, zdarzeń i komend się nie zmieniają. `CyberwareCapacityChanged` dalej niesie `{ used, max }`.
- **Ciąg progów dla każdej rangi.** `perkPathMet` wymaga perka na każdym progu poniżej perka w tym samym drzewku, także dla kolejnej rangi perka już kupionego. Dla zapisów kupionych zasadami etapu 3b to to samo co „perk z progu niżej”. Zapis z etapu 3 bez ciągu (np. Zahartowana przy pustych progach 4 i 8) zostaje ważny i zachowuje perki, ale w tym drzewku nie dokupi rang powyżej pustego progu, dopóki gracz nie uzupełni ciągu. Walidacja zapisu dalej nie sprawdza ciągu. Wiersz perka pokazuje „Wymaga: perk z progu N” z najniższym pustym progiem (`missingTier`).
- **HUD:** przy pasku zdrowia jest mały znacznik „Ponad pulą 21 / 16” (en: „Over the pool”), tylko gdy pula jest przekroczona. Podpowiedź (`title` i `aria-label`) wymienia nieaktywne wszczepy i mówi, co zrobić. Znacznik trzyma blok zdrowia na ekranie także poza walką, tak jak przebranie. `CapacityVm` dostał opcjonalne pole `inactive`.
- **Komunikat `respec.overPool`** mówi teraz, że wszczepy ponad pulą nie działają, dopóki się nie zmieszczą, i że wystarczy wyjąć wszczep albo zamienić go na mniejszy. Zamiana na mniejszy przechodzi bez wyjmowania, bo `fitsCapacity` zawsze ją przepuszcza.
- **Determinizm:** nowa gra mieści się w puli, więc złote hashe się nie zmieniły.

## Z budowy etapu 4 (6.11)

Etap 4 wprowadza poziom przedmiotu, dwie nowe rzadkości z cechami, skalowanie statystyk i cen, poziom łupu i towaru. Pasma dzielnic i własny poziom wroga to dalej etap 5: do tego czasu wróg ma poziom gracza. Wszystkie liczby są wstępne i do strojenia w etapie 8.

- **Poziom przedmiotu** (`core/items/grade.ts`) mają broń i odzież, w instancji (`ItemInstance.level`) i w linii łupu (`LootLine.level`). Mody i wszczepy nie mają poziomu. Przedmiot bez zapisanego poziomu ma poziom 1. Obrażenia, pancerz (także premia rzadkości i cech) i cena rosną o 4% na poziom ponad 1 (`levelScale`).
- **Rzadkości** (`rarity.ts`):

  | Rzadkość | Obrażenia | Rozrzut | Pancerz strefy głównej | Wartość | Cechy |
  |---|---|---|---|---|---|
  | epicka (`epic`) | ×1,24 | ×0,8 | +3 | ×4 | 1 |
  | legendarna (`legendary`) | ×1,32 | ×0,75 | +4 | ×6 | 2 różne |

  Unikat zostaje bez własnych liczb (w katalogu nie ma jeszcze unikatów) i skaluje się z poziomem.
- **Wagi rzadkości od poziomu przedmiotu** (zwykły / niezwykły / rzadki / epicki / legendarny), liniowo między wierszami: poziom 1: 75 / 20 / 5 / 0 / 0 (jak dotąd), 10: 60 / 26 / 10 / 4 / 0, 20: 45 / 30 / 15 / 8 / 2, 30: 32 / 32 / 19 / 12 / 5. Epicki wypada od poziomu 2, legendarny od 11. Test sprawdza rozkład na poziomach 1, 10, 20 i 30 deterministycznie (równo rozłożone losowania i ziarno).
- **Cechy** (`traits.ts`) to dane z tabelą dla rodzaju przedmiotu. Działają przez liczby `effectiveWeapon` i `armor.ts`, więc żaden system nie zna cechy po nazwie.

  | Tabela | Cecha (klucz) | Efekt |
  |---|---|---|
  | broń palna | Wbudowany tłumik (`silenced`) | alarm strzału najwyżej 10 m, bez straty obrażeń |
  | broń palna | Precyzyjna lufa (`match_barrel`) | rozrzut ×0,85 |
  | broń palna | Mocna amunicja (`hot_loads`) | obrażenia ×1,1 |
  | broń palna | Szybkie dobycie (`quick_draw`) | dobycie ×0,7 |
  | broń palna | Lekki spust (`light_trigger`) | czas między strzałami ×0,92 |
  | wręcz | Obciążona (`weighted`) | obrażenia ×1,12 |
  | wręcz | Wyważona (`balanced`) | dobycie ×0,7 |
  | wręcz | Długi zasięg (`long_reach`) | zasięg +0,25 m |
  | odzież | Wyściółka (`padded`) | +1 pancerza na każdej chronionej strefie |
  | odzież | Trwała (`durable`) | zużycie ×0,5 |
  | odzież | Lekka (`lightweight`) | chód +0,1 m/s |

  Przebicie pancerza i odporność na hack z przykładów ADR-u czekają na mechaniki, które je przeczytają (dziś obrona nie ma przebicia, a wrogowie nie hakują gracza).
- **Poziom łupu:** `lootLevel = clamp(źródło, gracz ± 2)`, z wroga jego poziom −1, 0 albo +1 (`enemyLootLevel`). `rollLoot` dostaje `LootGrade { source, player, rng }`: poziom i dwie cechy losuje osobny strumień (`loot:<klucz>:grade`, 3 liczby na linię), więc główny strumień losuje to samo co przed etapem. Rzadkość zależy od poziomu linii. Skrzynie z treści (dach targu) mają stałe linie bez poziomu, czyli poziom 1, do etapu 5.
- **Sklepy:** towar ma poziom gracza (`stockGrade`). Reputacja podnosi rzadkość: przyjazny handlarz o jeden stopień, zaufany o dwa, nigdy ponad rzadki (epicki i legendarny tylko z łupu, bez cech w sklepie). Cena to wartość × rzadkość × poziom, potem warunki (`stockPrice`), a lada liczy ją tą samą funkcją co symulacja. Komenda `buy-item` się nie zmienia: poziom gracza bierze `buyStock` z domeny.
- **Zapis v29:** migracja daje broni i odzieży poziom z rzadkości (zwykły 1, niezwykły 3, rzadki 5, unikat równy poziomowi gracza), w torbie i w workach z łupem, zaraz po rzadkości jak w nowym przedmiocie. Walidacja przyjmuje poziom 1–30 tylko na broni i odzieży i cechy tylko z tabeli przedmiotu, znane i bez powtórzeń. Typ `LootLine` (słownik kontraktów w `core/items/types.ts`) dostał opcjonalne `level` i `traits`. Pliki kontraktów (`ports`, `events`, `commands`) się nie zmieniają.
- **Interfejs:** karta przedmiotu pokazuje rzadkość, „Poziom N” i listę cech z opisem. Lada pokazuje rzadkość i poziom towaru oraz poziom przedmiotu na sprzedaż. Teksty są w `i18n/{en,pl}`. Pełna karta z porównaniem cech przychodzi w etapie 7.
- **Determinizm:** nowa gra ma poziom 1, więc w zapisie przybywa pole i złote hashe nagrano na nowo. Bez pól poziomu, jako v28, przebiegi dają złote hashe sprzed etapu (`v28HashOf`), a migracja zapisu v28 daje ten sam zapis co gra dziś.
