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
- **Sklepy:** towar ma poziom gracza (`stockGrade`). Reputacja podnosi rzadkość broni i odzieży: przyjazny handlarz o jeden stopień, zaufany o dwa, nigdy ponad rzadki (epicki i legendarny tylko z łupu, bez cech w sklepie). Mod zostaje przy rzadkości z listy, bo jego efekt nie zależy od rzadkości: lepsza rzadkość podniosłaby tylko cenę, a dobra reputacja ma dawać rabat (ADR-0011). Tłumik kosztuje więc 350 / 315 / 280 €$ u neutralnego, przyjaznego i zaufanego handlarza (poprawka z weryfikacji #323). Cena to wartość × rzadkość × poziom, potem warunki (`stockPrice`), a lada liczy ją tą samą funkcją co symulacja. Komenda `buy-item` się nie zmienia: poziom gracza bierze `buyStock` z domeny.
- **Zapis v29:** migracja daje broni i odzieży poziom z rzadkości (zwykły 1, niezwykły 3, rzadki 5, unikat równy poziomowi gracza), w torbie i w workach z łupem, zaraz po rzadkości jak w nowym przedmiocie. Walidacja przyjmuje poziom 1–30 tylko na broni i odzieży i cechy tylko z tabeli przedmiotu, znane, bez powtórzeń i w liczbie, jaką daje rzadkość (epicki 1, legendarny 2, niższe 0). Typ `LootLine` (słownik kontraktów w `core/items/types.ts`) dostał opcjonalne `level` i `traits`. Pliki kontraktów (`ports`, `events`, `commands`) się nie zmieniają, ale `LootLine` jest ładunkiem zdarzenia `LootTaken` (`core/events/domain-events.ts`), więc kontrakt tego zdarzenia rozszerza się o te dwa opcjonalne pola. Odbiorcy, którzy ich nie czytają, działają jak dotąd.
- **Interfejs:** karta przedmiotu pokazuje rzadkość, „Poziom N” i listę cech z opisem. Lada pokazuje rzadkość i poziom towaru oraz poziom przedmiotu na sprzedaż. Teksty są w `i18n/{en,pl}`. Pełna karta z porównaniem cech przychodzi w etapie 7.
- **Determinizm:** nowa gra ma poziom 1, więc w zapisie przybywa pole i złote hashe nagrano na nowo. Bez pól poziomu, jako v28, przebiegi dają złote hashe sprzed etapu (`v28HashOf`), a migracja zapisu v28 daje ten sam zapis co gra dziś.

## Z budowy etapu 5 (6.11)

Etap 5 wprowadza pasma dzielnic, poziom wroga oraz poziom łupu i kontraktu. Wszystkie liczby są wstępne i do strojenia w etapie 8.

- **Pasma** są w `sim/content/district-bands.ts`, według identyfikatorów dzielnic z kodu: `shinsekai-7` (Krakowskie) 1–8, `kanal` (Stare Miasto) 5–14, `targ` (Podzamcze z targiem) 10–20, `doki` (Nabrzeże) 16–30. Tabela `CONTRACT_SITE_DISTRICTS` przypisuje każde miejsce kontraktu do dzielnicy, a test sprawdza ją z pozycjami ludzi tego miejsca. Poza dzielnicami wróg ma poziom gracza. Od przeniesienia targu do Alchemii (ADR-0063, etap 6) ludzie i miejsca kontraktów targu (`hana_stall`, `hebi_stash`, `raid_north`, `raid_east`), czujka Hebi i czyściciele Kagami leżą w dzielnicy `shinsekai-7`, więc mają pasmo Krakowskiego 1–8. Pasmo `targ` 10–20 obejmuje dziś samo Podzamcze, czyli spotkania i mikrozdarzenia przy Placu Zamkowym. Do decyzji: czy targ w Alchemii ma dostać własne pasmo.
- **Poziom wroga** (`core/progression/bands.ts`, `enemyLevel`) to poziom gracza przycięty do pasma, z dodatkiem rangi: elita +1, szef +1 (`RANK_LEVEL_BONUS`), najwyżej 30. Elitą jest typ z `rank: "elite"` (egzekutor Hebi, czyściciele Kagami), a szefem kierownik zmiany Tessenu (egzekutor załogi w dokach, ADR-0033). Dzielnicę wyznacza dom wroga, czyli miejsce, w którym go postawiono i w którym zapis go odbudowuje.
- **Skalowanie:** zdrowie i obrażenia broni wroga rosną o 4% na poziom (`enemyScale` to ta sama funkcja co `levelScale` przedmiotu). `toughen` liczy zdrowie razem z `npcHealth` trudności. Wróg trzyma poziom w komponencie `enemy` (stan przejściowy).
- **Świat nadąża za graczem:** awans (`grantXp`) przelicza poziom wrogów w świecie (`regradeEnemies`) przy tym samym udziale zdrowia. Poziom zależy więc tylko od pozycji i poziomu gracza. Zapis nie dostaje pola, a maksymalne zdrowie i tak już zapisuje się, gdy różni się od bazowego (ADR-0066). Wczytana gra buduje wrogów tak samo, więc `SAVE_SCHEMA_VERSION` się nie zmienia i nie ma migracji.
- **Poziom łupu:** z wroga jest to jego poziom −1, 0 albo +1, ze skrytki poziom dzielnicy (`stashLines`, broń i odzież bez poziomu w treści). W obu przypadkach obowiązuje `clamp(…, gracz ± 2)`. Dzisiejsze skrytki nie mają broni ani odzieży.
- **Kontrakty:** poziom kontraktu to poziom zwykłego wroga w dzielnicy miejsca (`ContractContext.levelAt`). Dotychczasowe stawki są stawkami poziomu 1, a wypłata rośnie o 4% na poziom przed mnożnikiem reputacji (`contractPay`). Skład rośnie o jednego człowieka na każde 10 poziomów od 20 (`contractExperience`: 0 do 19, 1 do 29, 2 przy 30). Do tego dochodzi limit 4 albo 5 jak dotąd. Poniżej poziomu 20 poziom robi załogę twardszą, a nie liczniejszą, więc kontrakt na dolnej granicy każdego pasma, także doków (16), wysyła załogę z poziomu 1. Liczba ukończonych kontraktów nie wpływa już na zdrowie celów (`contractGangerHp`, `docksGuardHp`). Zostaje w zapisie i dalej otwiera wariacje (ADR-0034).
- **XP:** zabicie wroga daje XP według różnicy poziomów (`killXpShare`): 5 poziomów niżej 10%, równy poziom 100%, 5 wyżej 150%, liniowo pomiędzy. XP z kontraktu rośnie o 4% na poziom kontraktu, liczony przy wypłacie z bieżącego poziomu gracza, bo kontrakt go nie przechowuje.
- **Determinizm:** złote hashe nagrano na nowo, bo to nowa reguła. Gracz przebiegu dochodzi do poziomu 2, a gangerzy w paśmie Krakowskiego dochodzą z nim (83 zamiast 80 zdrowia). Posiłki Tessenu w przebiegu na dachu w dokach mają poziom 16.

## Decyzje użytkownika po etapie 5 (6.11)

Obie decyzje zastępują dwa punkty z „Z budowy etapu 5”: pasmo Krakowskiego dla targu w Alchemii i skład rosnący dopiero od poziomu 20.

- **Targ w Alchemii ma pasmo targu 10–20.** Pasmo zależy od obszaru, nie tylko od dzielnicy. W `sim/content/district-bands.ts` tabela `BAND_AREAS` nadpisuje pasmo dla prostokąta w dzielnicy: działka Alchemii z targiem (`alchemia-market`, x 400–456, z 32–124, w `shinsekai-7`) ma pasmo `targ`. `bandAt(dzielnica, punkt)` daje pasmo w punkcie i z niego korzystają wszystkie trzy miejsca, które pytają o pasmo: poziom wroga (`gradeEnemy`, według domu wroga), poziom skrytki (`districtLevelAt`) i posiłki. Tabela `CONTRACT_SITE_BANDS` (dawniej `CONTRACT_SITE_DISTRICTS`) przypisuje miejscom kontraktów targu (`hana_stall`, `hebi_stash`, `raid_north`, `raid_east`) pasmo `targ`. Test sprawdza, że ludzie targu, jego skrytki (dach hali, worek za ruiną) i miejsca kontraktów leżą w obszarze, a żaden inny człowiek Krakowskiego w nim nie stoi. Reszta Krakowskiego zostaje przy 1–8. Czujka Hebi ma więc poziom 10–20, czyściciele Kagami (elita) 11–21, a kontrakt na skrytkę Hebi dla gracza z poziomem 1 ma poziom 10.
- **Skład kontraktu rośnie o jednego człowieka co 5 poziomów** (`contractExperience = floor(poziom / 5)`): poziomy 1–4 bez dodatku, 5–9 +1, 10–14 +2, 15–19 +3 i tak dalej. Górnym limitem są limity szablonów, jak dotąd: 4 osoby, a dla większych załóg w dokach (infiltracja, hack) 5. Postać z poziomem 1 w Krakowskim dostaje więc załogę jak przed etapem, a pierwszy dodatkowy człowiek przychodzi z poziomem 5. Skutek do strojenia w etapie 8: od poziomu 10 każdy szablon ma już najliczniejszą załogę. Dotyczy to więc całego targu (od 10) i doków (od 16), gdzie dalej rośnie tylko poziom ludzi.
- **Determinizm:** złote hashe w `determinism.test.ts` i `reinforcement-sidestep.test.ts` się nie zmieniają. Przebiegi nie biorą kontraktu na poziomie 5 lub wyższym i nie budzą ludzi targu. Testy, które sprawdzały co innego niż skład, a padły przez liczniejszą załogę w dokach, dostały poprawkę ustawienia, nie warunku. Hack pod ostrzałem ma `damageTaken` o połowę mniejsze, bo fala ma 5 ludzi zamiast 3–4. Zapis po zasadzce eskorty wycisza ulicę przed zapisem (`calmForSave`), tak jak robi to aplikacja (G-240), bo czwarty człowiek zasadzki płoszy dokera. Infiltracja po alarmie ma 7 osób zamiast 5.

## Z budowy etapu 6 (6.11)

Etap 6 wprowadza łup dopasowany do stylu gracza i ochronę przed pechem. Wszystkie liczby są wstępne i do strojenia w etapie 8.

- **Styl** (`core/progression/style.ts`) to lista ostatnich 50 walk (`STYLE_WINDOW`) w `progression.style`, od najstarszej. Rodzaje: pistolet (z rewolwerem), SMG, strzelba, karabin (z DMR-em), wręcz (pałka i ostrze) oraz ścieżki quickhack i skradanie. Strzelba jest osobnym rodzajem, bo w grze jest broń tej klasy, a ADR jej nie wymienia.
- **Walka i użycie** liczą się deterministycznie z tego, co już dzieje się w symulacji:
  - wróg pokonany przez gracza liczy się raz, z tym, co zadało ostatni cios. Tym czymś jest broń palna z ręki (rodzaj z klasy broni), cios wręcz, Zwarcie (quickhack) albo obezwładnienie (skradanie). Encja trzyma to w przejściowym `lastHitStyle` obok `lastHitBy`;
  - obezwładnienie bez zabicia liczy się przy ogłuszeniu, a późniejsze zabicie ciała nie liczy się drugi raz;
  - jeden wróg to najwyżej jedna walka i liczy się pierwsze użycie na nim. Znacznik `fought` na encji stawia pierwszy hack, ogłuszenie albo zabicie i każde z nich go sprawdza. Zwarcie, które zabija świeży cel, to jedna walka quickhack. Hack, a po nim strzał zabijający, to też jedna walka quickhack, tak samo jak ogłuszenie, a po nim zabicie, to jedna walka skradania. Wróg ogłuszony, obudzony i ogłuszony ponownie też daje jedną walkę, więc stylu skradania nie da się nabić na jednym celu. Znacznik jest w zapisie (`EntitySnapshot.fought`, opcjonalny, w ramach v31), więc wczytanie gry go nie zeruje;
  - pierwszy udany quickhack na cel, ten sam, który płaci XP (`rememberHack`), liczy się jako walka ścieżki quickhacków. Kolejne hacki tego samego celu się nie liczą;
  - pocisk odbity przez gardę albo zryw nie jest bronią gracza, więc taka walka się nie liczy. Nie liczy się też wróg zabity przez kogoś innego ani upadek.
- **Wagi:** wpis tabeli łupów rodzaju k ma wagę `× (1 + 0,6 × udział k)` (`styledEntries`, `STYLE_LOOT_BONUS`). Gracz, który walczył tylko SMG, ma SMG z wagą +60%. Pozostałe wpisy zostają przy swojej wadze, więc wszystko dalej wypada. Rodzaj wpisu (`lootStyleOf`) to rodzaj broni, a dla ścieżek: tłumik i przebrania Tessenu to skradanie, a datachip to quickhacki. Amunicja nie ma rodzaju. W dzisiejszych tabelach nie ma pistoletów ani broni wręcz, więc ten styl na razie nie zmienia łupu (pytanie do użytkownika). Styl działa na każdy worek wroga. Liczba losowań się nie zmienia (wagi przesuwają tylko granice wyboru), więc strumienie zostają jak były.
- **Ochrona przed pechem:** łupem w jej rozumieniu jest każdy przedmiot z losowaną rzadkością (broń i odzież, `rarity: "roll"`). Stała rzadkość (mundury, chwyt), mody, stosy i pieniądze się nie liczą. `progression.unlucky` liczy takie przedmioty z rzędu poniżej rzadkiego. Przy 8 (`PITY_AFTER`) następny ma rzadkość co najmniej rzadką (`PITY_FLOOR`), a lepszy los (epicki, legendarny) zostaje. Przedmiot rzadki lub lepszy zeruje licznik. Liczą się tylko worki wrogów pokonanych przez gracza, bo to jej łup. Worek wroga zabitego przez kogoś innego nie liczy się i nic w nim nie jest podnoszone. `rollLootFor` w `core/items/loot.ts` robi to w jednej czystej funkcji, a `rollLoot` to ona bez stylu i bez licznika, czyli łup jak przed etapem.
- **Zapis v31:** `progression` dostał pola `style` i `unlucky`. Migracja daje staremu zapisowi pusty styl i licznik 0. Walidacja przyjmuje najwyżej 50 znanych rodzajów i licznik od 0 do 8. Respec ich nie zmienia.
- **Kontrakty:** zdarzenia, komendy i porty się nie zmieniają. Nowe pola są w `ProgressionState` w `core/progression`, a nie w plikach kontraktów.
- **Determinizm:** złote hashe nagrano na nowo, bo w zapisie są nowe pola. Bez tych pól, jako v30, wszystkie przebiegi (główny, na trudnym, pojedynek i posiłki w dokach) dają złote hashe sprzed etapu (`v30HashOf`), więc reguły w nich się nie zmieniły. Gracz głównego przebiegu nikogo nie pokonuje i nie hakuje, więc jego styl jest pusty, a licznik równy 0.

## Decyzje użytkownika po etapie 6 (6.11)

Te decyzje zastępują trzy zdania z „Z budowy etapu 6”: że w tabelach nie ma pistoletów ani broni wręcz, że strzelba jest osobnym rodzajem z wyboru budującego oraz że ścieżki przesuwają tylko tłumik, przebrania Tessenu i datachip. Liczby są wstępne i do strojenia w etapie 8.

- **Pistolety i broń biała są w łupie wrogów.** To świadoma zmiana bazowego łupu. Wszystkie te wpisy mają losowaną rzadkość, poziom łupu z etapów 4 i 5 i liczą się do ochrony przed pechem.
  - Hebi, tabela wspólna: Unity 9 i pałka, po 2 na 100. Ich wagę oddały złom (24 → 22) i części broni (8 → 6), więc tabela dalej sumuje się do 100.
  - Egzekutor Hebi: do tabeli wspólnej dochodzą rewolwer Oni .44 i shirasaya, po 2.
  - Tessen (strażnik i snajper): Unity 9 i pałka, po 2. Ich wagę oddała amunicja 5,56 (34 → 29), więc strażnik dalej ma 99.
  - Worek gangera jest wart u Oyajiego średnio 53,6 €$ zamiast 50,6 €$. W przykładzie z planu łup trzech celów to 25,7% stawki zamiast 24,3%, nadal w paśmie 20–30% (test E10).
  - Pałka i shirasaya z łupu mają ikonę i model jak z handlu (`look` z katalogu). Test sprawdza, że shirasaya z worka egzekutora trafia do torby, do gniazda broni białej i do ręki.
- **Strzelba zostaje osobnym rodzajem stylu** (decyzja użytkownika).
- **Ścieżki przesuwają więcej wpisów**, w tym samym limicie +60%:
  - quickhacki: datachip, odłamek pojemności i wszczep Synapse booster (układ nerwowy, „szybsze przetwarzanie celów”). Wszczep dochodzi do tabeli Tessenu z wagą 1 i stałą rzadkością zwykłą, jak chwyt stabilizujący u Hebi. W grze nie ma jeszcze wszczepu samego cyberdecku ani przedmiotu z RAM, więc to najbliższy hakerski wpis z katalogu;
  - skradanie: tłumik i przebrania, czyli kurtka Hebi oraz mundur i kombinezon Tessenu.
- **Determinizm:** złote hashe się nie zmieniają. W przebiegach z `determinism.test.ts` i `reinforcement-sidestep.test.ts` nowe wagi nie zmieniają żadnego worka: hashe przed zmianą i po niej są takie same.

## Cyberdeck jako wszczep (decyzja użytkownika 6.11, po etapie 6)

Decyzja zastępuje zdanie z „Decyzji użytkownika po etapie 6”, że w grze nie ma wszczepu samego cyberdecku ani przedmiotu z RAM, i zdanie z „Z budowy etapu 4”, że wszczepy nie mają poziomu. Liczby są wstępne i do strojenia w etapie 8.

- **Wszczep** `kumo_cyberdeck` (Cyberdeck Kumo, en: Kumo cyberdeck) w gnieździe układu nerwowego, obok Wzmacniacza synaps i Akceleratora Kairos, więc hakowanie konkuruje z krytykiem i spowolnieniem czasu. Pojemność 4, cena katalogowa 800 €$, bez `StatModifiers` (pole `deck` w `CyberwareDefinition`).
- **Jedyny wszczep z rzadkością i poziomem.** `hasItemLevel` obejmuje cyberdeck, więc w torbie i w łupie ma poziom jak broń i odzież. Nie ma cech (tabele cech są dla broni i odzieży). Zamontowany trzyma rzadkość i poziom w `CharacterState.implantGrades` według gniazda (`core/cyberware/cyberdeck.ts`), więc po wyjęciu lub zamianie wraca do torby ten sam egzemplarz. Inne wszczepy dalej wracają jako zwykłe.
- **Efekt** (`deckStats`), skalowany jak obrażenia broni, czyli mnożnik obrażeń rzadkości × `levelScale` (moc):

  | | Wartość |
  |---|---|
  | RAM do puli | 2 + rzadkość (rzadki i epicki +1, legendarny +2) + 1 na każde 15 poziomów |
  | czas wgrywania quickhacka | × (1 − min(0,3; 0,08 × moc)) |
  | odnowa RAM | × (1 + 0,1 × moc) |

  Przykłady: zwykły poziom 1: RAM +2, wgrywanie −8%, odnowa +10%; rzadki 10: +3, −12,6%, +15,8%; legendarny 30: +6, −22,8%, +28,5%. Mnożniki łączą się z Siecią, Szybkim wgrywaniem i Odzyskiem przez mnożenie. Działa tylko wszczep w puli (`workingDeck`, etap 3c). Pula RAM to `BASE_RAM` + Sieć + Bufor + cyberdeck (`ramMaxOf`). Montaż i wyjęcie u Mori wysyłają `RamChanged` i przycinają RAM.
- **Klinika** (`implantOffer`): cyberdeck ma poziom gracza, a rzadkość rośnie z reputacją kliniki jak towar u handlarzy (`SHOP_RARITY_STEPS`): neutralna zwykły, przyjazna niezwykły, zaufana rzadki, nigdy powyżej rzadkiego. Cena to 800 × wartość rzadkości × `levelScale`, potem warunki: 800 €$ dla neutralnej na poziomie 1, 1280 × 0,9 dla przyjaznej, 2829 × 0,8 dla zaufanej na poziomie 10. Cyberdeck innej rzadkości lub poziomu zastępuje zamontowany, a ten trafia do torby. Ten sam odmawia `already-installed`. Montaż z torby kosztuje ćwierć wartości z rzadkością i poziomem (`installFee`). Komenda `buy-cyberware` się nie zmienia: poziom bierze symulacja z domeny.
- **Pełna torba przy zamianie:** zwykły wszczep, który nie mieści się w torbie, dalej przepada (ADR-0015). Cyberdeck z oceną powyżej zwykłego poziomu 1 (`isPreciousGrade`: inna rzadkość niż zwykła albo poziom > 1) nie przepada nigdy: kupno w klinice i montaż z torby, po których nie miałby gdzie wrócić, symulacja odrzuca powodem `inventory-full` i nie pobiera opłaty. Wybraliśmy odmowę, nie potwierdzenie, bo potwierdzenie wymagałoby nowego pola w komendzie `buy-cyberware` (kontrakt), a zwolnienie jednego pola w plecaku to jeden ruch gracza. Klinika pokazuje to z góry: oferta ma wyszarzony przycisk „Brak miejsca” i ostrzeżenie „Brak miejsca w plecaku: najpierw zwolnij pole, bo obecny deck by przepadł” (en: „No room in the backpack: free a cell first, or your current deck would be lost”). Zwykły deck poziomu 1 zachowuje się jak inne wszczepy (dawne ostrzeżenie, że przepadnie).
- **Łup:** w tabeli Tessenu (strażnik, snajper) z wagą 1 i losowaną rzadkością. Wagę oddała amunicja 5,56 (29 → 28), więc strażnik dalej ma 99. Liczy się do ochrony przed pechem. Styl quickhack przesuwa go tak jak datachip, odłamek i Synapse booster, w limicie +60%.
- **Ikona** `deck`: własny rysunek w `ui/src/icons/icon-paths.ts` (deck z ekranem, dwoma portami i wtykiem neuralnym), bez atrybucji. Test ikon z game-icons.net wymienia go jako jedyny wszczep rysowany w repo.
- **Interfejs:** karta przedmiotu pokazuje rzadkość, poziom i wiersz „RAM +N · wgrywanie −X% · odnowa RAM +Y%”, a oferta w klinice rzadkość, poziom, ten sam wiersz i cenę. Store UI dostał `implantGrades`. Teksty są w `i18n/{en,pl}`.
- **Zapis v32:** opcjonalne `character.implantGrades`. Migracja v31 → v32 zmienia tylko wersję, bo starszy zapis nie miał cyberdecku. Walidacja przyjmuje ocenę tylko dla gniazda z cyberdeckiem, znaną rzadkość i poziom 1–30. Zamontowany cyberdeck bez oceny liczy się jako zwykły z poziomem 1.
- **Kontrakty:** porty, zdarzenia i komendy się nie zmieniają.
- **Determinizm:** złote hashe nagrano na nowo tylko przez wersję v32. Jako v31 (`v31HashOf`) wszystkie przebiegi, także trudny, pojedynek i posiłki w dokach, dają złote hashe sprzed zmiany: gracz przebiegów nie ma cyberdecku, a zmiana wagi 5,56 nie zmienia żadnego worka.

## Z budowy etapu 7 (6.11)

Etap 7 to sam interfejs. Symulacja, zapis i kontrakty (porty, zdarzenia, komendy) się nie zmieniają, więc złote hashe i `SAVE_SCHEMA_VERSION` zostają.

- **Zakładka Rozwój** (en: Progress) na ekranie postaci, klawisz K, między Kartą a Dziennikiem. K jest zarezerwowany jak I, Tab, J i M, więc nie da się go przypisać do sterowania.
  - Na górze poziom i pasek XP z liczbami („50 / 303 PD”), liczony krzywą z `core/progression/curve.ts`.
  - Po lewej pięć atrybutów: wartość, efekt punktu, liczba kupionych rang w drzewku i przycisk „+” (36 px, na dotyku 44 px). Atrybut jest też przyciskiem, który pokazuje swoje drzewko.
  - Po prawej jedno drzewko naraz, próg po progu (4, 8, 12, 15). Zamknięty próg mówi „Otwiera się przy: Krzepa 8”, a perk pokazuje rangę jako romby, opis, perk kluczowy, wymaganie atrybutu i ciąg progów (`missingTier`) oraz przycisk kupna. Reguły kupna to te same funkcje core, które sprawdza komenda `spend-perk-point`.
  - Zakładka otwiera się na pierwszym drzewku, w którym punkt perku coś kupi. Bez takiego drzewka otwiera się na tym z największą liczbą rang, a bez rang na Krzepie.
  - Przebudowa jest usługą kliniki (komendy handlowe, etap 3), więc zakładka tylko mówi, gdzie ją zrobić i za ile. Cenę liczy `respecPrice` z warunkami Mori, tą samą funkcją co lada. Przy warunkach podstawowych zakładka mówi, że Mori przebudowuje tylko zaufanych, a bez wydanych punktów, że nie ma czego zerować.
- **Karta:** sekcje Atrybuty i Perki przeszły na zakładkę Rozwój, bez kopii. Na Karcie zostaje poziom, pasek XP, liczba punktów do rozdania i przycisk „Rozdaj w Rozwoju”. Wiersz wszczepu, który nie działa ponad pulą (etap 3c), ma dopisek „nie działa: ponad pulą”. Ten sam dopisek ma oferta zamontowanego wszczepu u Mori. Znacznik na HUD z etapu 3c zostaje bez zmian.
- **HUD:**
  - pod paskiem zdrowia jest „Poz. N” i cienki pasek XP. Znikają razem z paskiem zdrowia poza walką, ale nowe XP trzyma blok na ekranie przez 4 s, a awans rozbłyskuje pasek na 2,5 s (bez błysku przy ograniczonych błyskach);
  - niewydane punkty (atrybutów i perków razem) pokazuje znacznik „▲ N K” przy pasku na komputerze, plakietka na przycisku postaci na dotyku i plakietka na zakładce Rozwój;
  - komunikat awansu to toast z etapu 1, a udanej przebudowy toast z etapu 3b. Ich teksty się nie zmieniają.
- **Karta przedmiotu:** poziom, rzadkość i cechy były od etapu 4. Liczby porównania już wcześniej skalowały się z poziomem obu przedmiotów (`weaponStatsOf`, `garmentArmor`). Etap 7 dopisuje do nagłówka porównania poziom założonego przedmiotu („Hebi SMG · Poziom 5”) i pod tabelą jego cechy.
- **Teksty:** nowe klucze są w `i18n/{en,pl}/progression.ts`. Polskie liczby punktów są w formie „Punkty do rozdania: N”, bez odmiany, bo test katalogów wymaga tych samych parametrów w obu językach.
- **Bez zmian:** poziom wroga w interfejsie czeka na decyzję użytkownika (otwarta od etapu 5).

## Decyzje użytkownika po etapie 7 (6.11)

Te decyzje zastępują dwa punkty z „Z budowy etapu 7”: liczby punktów bez odmiany i poziom wroga czekający na decyzję.

- **Poziom wroga w skanerze.** Karta skanu pokazuje poziom zeskanowanego wroga („Poziom 12”, en: „Level 12”). Nad głową nie ma paska. Poziom to `enemy.level` z oceny wroga w symulacji (`gradeEnemy`, pasmo dzielnicy z etapu 5). Aplikacja czyta go z encji tak jak resztę karty skanu (`scanTargetVm`), więc zdarzenie `ScanFocusChanged` i porty się nie zmieniają. `ScanTargetVm` w UI dostał opcjonalne pole `level`, które mają tylko wrogowie. Awans przelicza wrogów w świecie (`regradeEnemies`), a karta otwarta na tym samym celu rysuje się wtedy na nowo.
- **Przycisk postaci na dotyku (☰)** otwiera ekran od razu na zakładce Rozwój, gdy są punkty do wydania. Bez punktów otwiera Ekwipunek, jak dotąd.
- **Odmiana liczby punktów.** Liczby punktów i rang mają formy mnogie: po polsku „1 punkt”, „3 punkty”, „5 punktów”, „22 punkty”, po angielsku „1 point” i „N points”. Dotyczy to kluczy `progress.unspent`, `attribute.points`, `perk.points` i `perk.rankCount`. Test katalogów przyjmuje formy mnogie, jeśli są w obu językach naraz: angielski ma `one` i `other`, polski `one`, `few`, `many` i `other`, a każda forma ma te same parametry co angielskie `other`.

## Z budowy etapu 8 (7.11)

Etap 8 to test balansu `packages/sim/test/balance.test.ts` z modelem przejścia w `balance-model.ts`. Ta sekcja zastępuje zdanie z „Z budowy etapu 5”, że XP z kontraktu rośnie o 4% na poziom kontraktu, oraz wartości pasm Starego Miasta (5–14) i targu (10–20).

- **Model przejścia.** Test nie uruchamia ECS, tylko te same funkcje, których używa symulacja: generator kontraktów (`generateContractOfKind`), poziom kontraktu i wroga z pasma (`contractLevelOf`, `enemyLevel`), źródła XP, krzywą (`gainXp`) i łup ze stylem i ochroną przed pechem (`rollLootFor`) na ziarnie (`deriveRandom`). Test przechodzi grę z pięcioma ziarnami w kilkadziesiąt milisekund, bez zegara. Dzielnice idą w kolejności pasm:
  - Krakowskie: pierwszy kontrakt i akt I („Echo”) z kurierem i jego ochroną, do tego dziesięć zleceń Kaito na zmianę (eliminacja w miejscach Krakowskiego i dostawa do straganu Hany);
  - Stare Miasto: dziesięć eliminacji pod kładką na Grodzkiej;
  - targ: akt II („Lustro”) z trzema czyścicielami Kagami i dziesięć zleceń Hany (odzyskanie, ochrona);
  - doki: dziesięć zleceń Genzō (eskorta, infiltracja, hack).
- **Założenia modelu.** Gracz wygrywa każdą walkę, z którą przychodzi zlecenie, a infiltrację robi bez zabijania i bez wykrycia. Każde zlecenie daje jeden quickhack, hack wygrywa dwa demony, a cztery zlecenia na dziesięć idą bez wykrycia. Styl jest pusty. Do czasu walki gracz ma zwykłą broń i kurtkę swojego poziomu, tak jak towar w sklepie. Czas walki to liczba trafień potrzebna do pokonania drugiej strony razy odstęp strzałów, przy trafieniach w 10% w głowę, 50% w tułów i po 20% w ręce i nogi.
- **Progi (z ADR-u, ustalone przed pomiarem):**
  - tempo: każda dzielnica poza ostatnią daje 8–10 poziomów, gracz wchodzi do doków poniżej 30 i kończy je na 30;
  - czas walki w paśmie: każda walka trwa od 0,75 do 1,33 czasu tej samej walki na dolnej granicy pasma, w obie strony (gracz pokonuje wroga i wróg pokonuje gracza);
  - rzadkości na poziomach przedmiotu 1, 10, 20 i 30, po 3000 przedmiotów: udział rzadkich i lepszych rośnie z poziomem, zwykłe i niezwykłe to razem co najmniej 60%, na poziomie 1 nie ma epickich, poniżej 11 legendarnych, a na 30 legendarne mają 2–10%; ochrona przed pechem podnosi rzadkie na poziomie 1 najwyżej do 20%;
  - pech: żadna seria losowanych przedmiotów poniżej rzadkiego nie jest dłuższa niż 8, w przejściu ani w próbce.
- **Wyniki przed strojeniem i po nim** (przed: pięć ziaren testu; po: te same pięć i sonda na 200 ziarnach, z tym samym tempem):

  | Miara | Przed | Po |
  |---|---|---|
  | Poziomy w dzielnicach (Krakowskie / Stare Miasto / targ / doki) | 9–10 / 3–4 / 4 / 3, gra kończy się na poziomie 21. Test pada. | 10 / 8 / 9 / 2, czyli 1 → 11 → 19 → 28 → 30. |
  | Czas pokonania wroga względem dolnej granicy pasma | 0,90–1,00 | 0,90–1,00 |
  | Czas pokonania gracza względem dolnej granicy pasma | 0,84–1,00 | 0,80–1,00 |
  | Rzadkości z tabel, poziom 1 (zwykły / niezwykły / rzadki / epicki / legendarny) | 75,3 / 19,4 / 5,3 / 0 / 0% | bez zmian |
  | Poziom 10 | 59,7 / 26,0 / 9,9 / 4,4 / 0% | bez zmian |
  | Poziom 20 | 46,0 / 30,6 / 13,3 / 8,1 / 2,0% | bez zmian |
  | Poziom 30 | 32,6 / 31,9 / 19,2 / 11,7 / 4,6% | bez zmian |
  | Rzadkie i lepsze z ochroną przed pechem (poziomy 1, 10, 20, 30) | 12,8 / 19,1 / 25,5 / 36,1% | bez zmian |
  | Najdłuższa seria pecha | bez ochrony 106 na poziomie 1 i 17 na 30; z ochroną 8; w przejściu 3–8 | bez zmian |

  Przed strojeniem nie przechodziło tylko tempo. XP z zadań jest stałe, a XP ze zleceń rosło o 4% na poziom, podczas gdy koszt poziomu rośnie jak L^1,6. Dlatego Krakowskie dawało 9–10 poziomów, a każda następna dzielnica 3–4. Do tego gracz wychodził ponad górną granicę Starego Miasta (14) i targu (20), a wtedy zlecenia przestają rosnąć, a XP za wroga spada do 10%.
- **Zmienione liczby:**
  - XP zleceń, wrogów i premii za brak wykrycia rośnie z poziomem źródła jak koszt poziomu, od poziomu 6: `xpLevelScale = max(1, (poziom / 6)^1,6)` (`XP_CURVE_FROM = 6`, wykładnik krzywej `CURVE_EXPONENT`). Zastępuje to +4% na poziom. Do poziomu 6 nic się nie zmienia, na 12 mnożnik wynosi 3,03, a na 30 13,1. Zlecenie albo wróg daje więc mniej więcej ten sam ułamek poziomu w każdym paśmie. Próg 6 wybrał test: przy 5 dzielnice dawały 11 / 10 / 8 / 0 poziomów, a przy 7 dawały 9 / 7 / 7 / 6.
  - XP za wroga rośnie teraz z jego poziomem, a nie tylko z różnicą poziomów. Bez tego wróg na poziomie 20 jest wart 0,5% poziomu.
  - Premia za kontrakt bez wykrycia to `undetectedXp(poziom kontraktu)`, czyli 150 XP razy ten sam mnożnik.
  - Baza XP dostawy: 300 zamiast 500. Dostawa nie ma walki, a ma poziom straganu Hany w paśmie targu (co najmniej 10), więc przy nowym mnożniku jest warta więcej niż eliminacja w Krakowskiem. Z bazą 500 sonda na 200 ziarnach dawała 10 / 8 / 10 / 1 dla 190 ziaren i 11 / 8 / 9 / 1 dla 3, czyli Krakowskie ponad próg. Z bazą 300 wszystkie 200 dają 10 / 8 / 9 / 2.
  - Pasma: Stare Miasto 5–19 zamiast 5–14, targ 10–28 zamiast 10–20. Gracz wychodzi ze Starego Miasta na poziomie 19, a z targu na 28, więc w starych granicach świat zostawał za nim. Z nowym XP i starymi pasmami dzielnice dają 10 / 7 / 8 / 4 poziomy, a test pada na Starym Mieście. Dolne granice i pasma Krakowskiego (1–8) i doków (16–30) zostają. Krakowskie 1–8 przy wyjściu na poziomie 11 też przechodzi próg czasu walki, a wyższa granica nic w tempie nie zmienia.
- **Bez zmian:** krzywa XP (więc zapis i walidacja poziomu się nie zmieniają, a migracja nie jest potrzebna), +4% na poziom dla przedmiotów, wrogów i wypłat, wagi rzadkości, ochrona przed pechem, ceny zmiany rozdania i liczby perków. Ostatnich dwóch test nie mierzy, więc nie ma podstaw, żeby je zmieniać.
- **Zapis i determinizm:** `SAVE_SCHEMA_VERSION` zostaje na v32, a kontrakty (porty, zdarzenia, komendy) się nie zmieniają. Złote hashe w `determinism.test.ts` i `reinforcement-sidestep.test.ts` się nie zmieniły (testy przechodzą bez `-u`): w przebiegach mnożnik XP zostaje równy 1, a gracz nie przekracza starych górnych granic pasm.
- **Do decyzji użytkownika:**
  - 29 poziomów na cztery dzielnice to średnio 7,25. Przy 8–10 na każdą z trzech pierwszych doki dają tylko 2 poziomy, bo gracz wchodzi do nich na 28. Do wyboru: zostawić tak, obniżyć cel do ok. 7 na dzielnicę, podnieść limit poziomu albo dać dokom własny wątek główny.
  - Marginesów nie ma: Krakowskie jest na górnej granicy (10), a Stare Miasto na dolnej (8). Przyczyną jest treść: Krakowskie ma dwa zadania główne, a Stare Miasto i doki żadnego. Każde nowe zadanie w jednej dzielnicy przesunie tempo, a test to pokaże.
  - Dostawa od Kaito ma poziom straganu Hany (pasmo targu), więc dla gracza z poziomem 1 jest kontraktem poziomu 10. Można zostawić obniżoną bazę albo liczyć poziom dostawy z dzielnicy Kaito.
  - Po podniesieniu górnej granicy targ (10–28) i doki (16–30) pod koniec gry mają prawie ten sam poziom. Do decyzji, czy doki mają zostać jedynym miejscem z wrogami 29–30.
  - Wypłaty dalej rosną o 4% na poziom, a XP jak koszt poziomu. Test nie mierzy ekonomii (ceny, wypłaty), więc jej balans zostaje do osobnego przeglądu.

### Runda 2: decyzje użytkownika z 7.11 i strojenie

Ta część zastępuje w punktach wyżej próg tempa (8–10), wzrost XP dopiero od poziomu 6, bazy zleceń, bazę dostawy 300, XP aktu I i pasma Starego Miasta 5–19 oraz targu 10–28.

- **Decyzje użytkownika (7.11):**
  - Cel to ok. 7 poziomów na dzielnicę, równo we wszystkich czterech, także w dokach. Próg testu tempa to 6–9 poziomów w każdej dzielnicy, a doki kończą na poziomie 30. Liczby mają mieć zapas po obu stronach, bo każde nowe zadanie przesunie tempo.
  - Dostawa od Kaito ma poziom dzielnicy Kaito (pasmo Krakowskiego 1–8), jak jego eliminacje, a nie poziom straganu Hany w paśmie targu. Baza XP dostawy wraca do 500, chyba że test pokaże, że trzeba inaczej.
  - Reguła XP z rundy 1 jest przyjęta: XP za wroga rośnie z jego poziomem, a XP zleceń jak koszt poziomu.
  - Jeśli cel 7 na to pozwala, pasma wracają bliżej starych (Stare Miasto 5–14, targ 10–20), żeby pod koniec gry targ i doki się różniły.
- **Poprawka modelu.** Pierwszy kontrakt idzie teraz w całości przed zleceniami Kaito (`opening` w `DistrictPass`), bo to on prowadzi gracza do Kaito. W rundzie 1 jego kroki były rozłożone między zlecenia. Na poziomach 1–4 jego 1250 XP to ponad trzy poziomy, więc gracz robi potem zlecenia na wyższym poziomie, a Krakowskie daje o ok. poziom więcej niż w modelu z rundy 1.
- **Wyniki przed rundą 2 i po niej** (model i progi jak wyżej, poza progiem tempa; „przed” to stan rundy 1 po scaleniu `main` z #343 i #350; sonda na 200 ziarnach, test na pięciu):

  | Miara | Przed | Po |
  |---|---|---|
  | Poziomy w dzielnicach (Krakowskie / Stare Miasto / targ / doki) | 10 / 8 / 9 / 2 dla wszystkich 200 ziaren, czyli 1 → 11 → 19 → 28 → 30. Z progiem 6–9 test pada na Krakowskiem i dokach. | 8 / 7 / 7 / 7 dla wszystkich 200 ziaren, czyli 1 → 9 → 16 → 23 → 30. |
  | Poziom z ułamkiem przy wyjściu z dzielnicy | nie mierzony | Krakowskie 9,56–9,85, Stare Miasto 16,42–16,65, targ 23,38–23,54 |
  | Zapas doków | doki dają 2 poziomy | bez limitu poziomu doki dałyby o 1,4–1,6 poziomu więcej, niż trzeba do 30 (w kosztach poziomu 29), więc gracz dochodzi do 30 przy ósmym albo dziewiątym zleceniu z dziesięciu |
  | Czas pokonania wroga względem dolnej granicy pasma | 0,90–1,00 | 0,88–1,00 |
  | Czas pokonania gracza względem dolnej granicy pasma | 0,80–1,00 | 0,84–1,00 |
  | Rzadkości, ochrona przed pechem, serie pecha | jak w rundzie 1 | bez zmian (testy przechodzą) |

  Każda dzielnica jest co najmniej o poziom od obu granic progu (7 i 8 przy progu 6–9). Krakowskie daje o poziom więcej niż reszta, bo tylko ono ma dwa zadania główne, a 29 poziomów nie dzieli się równo na cztery. Nowe zadanie warte mniej niż ok. poziomu przesunie dzielnicę najwyżej o jeden poziom, a ta dalej zmieści się w progu. Najbliżej granicy jest Krakowskie: wychodzi na 9,56–9,85, więc ok. 0,2 poziomu więcej w tej dzielnicy da 9 poziomów, czyli górną granicę progu.
- **Dlaczego zmieniła się reguła poniżej poziomu 6.** Przy wzroście XP dopiero od poziomu 6 (pod nim baza) Krakowskie dawało co najmniej 8 poziomów, nawet bez XP z jego zadań. Pierwsze poziomy kosztują 100 do 1313 XP, a zlecenie z bazą 1000 XP dawało pod poziomem 6 kilka poziomów naraz. Sondy na 10 ziarnach w modelu z rundy 1, przy tej regule, pasmach 5–15 i 10–22, eliminacji 400 XP i 130 XP za cel: z XP pierwszego kontraktu i aktu I zmniejszonym do 30% dzielnice dawały 8 / 7 / 8 / 6 albo 8 / 7 / 9 / 5, a bez XP z tych zadań 7 / 7 / 9 / 6. Z podłogą mnożnika 0,25 zamiast 1 Krakowskie wychodziło na 9 dla 35 z 50 ziaren, na granicy poziomu. Dlatego XP zleceń, wrogów i premii za brak wykrycia rośnie jak koszt poziomu od poziomu 1: `xpLevelScale = (poziom / 6)^1,6` bez dolnej granicy 1 (`XP_BASE_LEVEL = 6`, dawniej `XP_CURVE_FROM`). Bazy w kodzie są wartościami na poziomie 6. Na poziomie 1 mnożnik wynosi 0,057, więc zabity wróg daje ok. 3% poziomu, a zlecenie ok. pół poziomu, na każdym poziomie gry. Ganger na poziomie 1 daje 3 XP zamiast 60, a eliminacja z trzema celami 49 XP zamiast 1000, przy koszcie poziomu 1 równym 100. To odstępstwo od przyjętego „od poziomu 6” i czeka na potwierdzenie użytkownika.
- **Zmienione liczby:**
  - dostawa ma poziom pasma Krakowskiego (`CONTRACT_KIND_BANDS` w `sim/content/district-bands.ts`, a `levelAt` w `ContractContext` dostaje rodzaj zlecenia). Dotyczy to XP i wypłaty, więc dostawa dla gracza z poziomem 1 płaci jak zlecenie poziomu 1 (np. 400 kredytów zamiast 544 przy tym samym limicie czasu). Baza XP dostawy wraca do 500, jak chciał użytkownik. Test tego nie zmienia;
  - bazy zleceń: eliminacja 500 (było 550), odzyskanie 350 (600), ochrona 400 (650), eskorta 350 (800), infiltracja 400 (850), hack 350 (800), a za każdego wysłanego człowieka 120 (150). Eliminacje Kaito niosą tempo Krakowskiego i Starego Miasta, zlecenia Hany targu, a Genzō doków, więc bazy są ustawione osobno dla dawcy. Zlecenia Hany i Genzō mają bazę niższą niż dostawa, bo przychodzą z dużymi załogami (od poziomu 10 czterech ludzi, pięciu przy infiltracji i hacku w dokach), a strażnik Tessenu jest wart więcej niż Hebi. Eliminacja 500 zamiast 475 przesuwa wyjście ze Starego Miasta z 16,11–16,49 na 16,42–16,65, a z Krakowskiego z 9,36–9,81 na 9,56–9,85;
  - XP aktu I („Echo”): 1350 zamiast 4600 (zakończenie 700 zamiast 2500, kroki 150, 100, 150 i 250 zamiast 500, 400, 500 i 700). Na poziomach 5–9 stare XP dawało dwa poziomy, a nowe daje ok. trzech piątych poziomu, tyle co akt II (7100 XP) na poziomach 16–23. Przy 1850 XP (i eliminacji 475) Krakowskie wychodziło na 9,68–9,96, tuż pod granicą dziewięciu poziomów. Pierwszy kontrakt zostaje bez zmian (1250 XP), bo jego pierwszy krok daje poziom 2 na starcie gry, na czym opierają się złoty hash i testy sesji;
  - tabela XP zadań w migracji v16 → v17 (`V17_QUEST_XP` w `persistence/src/migrations.ts`) ma nowe XP aktu I, bo test zapisu wymaga, żeby stary zapis dostał tyle, ile dziś daje nowa gra. Schemat zapisu się nie zmienia (v33), a zmiana dotyczy tylko zapisów sprzed v17;
  - pasma wracają do starych: Stare Miasto 5–14, targ 10–20. Gracz wychodzi ze Starego Miasta na ok. 16, a z targu na ok. 23, więc pod koniec każdej z tych dzielnic świat zostaje trochę za nim, a XP zleceń i wrogów przestaje rosnąć. To hamuje tempo bez nowych liczb. Pod koniec gry targ (do 20, elita 21) i doki (16–30) znów się różnią: tylko doki mają wrogów powyżej 21. Próg czasu walki przechodzi.
- **Bez zmian:** krzywa XP (zapis i walidacja poziomu się nie zmieniają), `SAVE_SCHEMA_VERSION` (v33 po #343), kontrakty w `core/src/{ports,events,commands}`, pierwszy kontrakt, akt II, XP quickhacków i włamań, `ENEMY_XP`, rzadkości i ochrona przed pechem.
- **Determinizm i luka w złotych hashach.** Złoty hash przebiegu w `determinism.test.ts` (i jego wersje vN) się nie zmienił. Jedyne XP w tym przebiegu to krok zadania „find_fixer” (100 XP, poziom 2), a gracz nikogo nie pokonuje. Zmienił się hash pojedynku wręcz (we wszystkich wersjach vN): gracz z poziomem 1 pokonuje tam zbira bez poziomu, który dostaje poziom gracza, i dostaje 4 XP zamiast 70. To jedyne miejsce, gdzie złoty hash obejmuje zdobywanie XP, i to tylko za wroga na poziomie 1. W rundzie 1 ten hash się nie zmienił, bo do poziomu 6 XP zostawało bez zmian. XP zleceń, premii za brak wykrycia, wrogów powyżej poziomu 1 i kroków zadań poza pierwszym nie obejmuje żaden złoty hash. Pilnują ich test balansu, `core/test/progression*.test.ts` i `sim/test/progression.test.ts`. Tę lukę można zamknąć przebiegiem z kontraktem zakończonym w wyższym paśmie.
- **Do decyzji użytkownika:**
  - XP rośnie jak koszt poziomu także poniżej poziomu 6 (wyżej, dlaczego). Liczby w toastach na początku gry są przez to małe (3 XP za gangera), choć poziomy przychodzą równie szybko. Quickhack (25 XP) i włamanie (100 XP i 25 za demona) zostają stałe, więc na poziomie 1 quickhack jest wart więcej niż zabicie wroga, a na poziomie 30 prawie nic.
  - Akt I daje 1350 XP zamiast 4600.
  - Krakowskie daje 8 poziomów, a reszta po 7. Równe 7 w Krakowskiem wymaga też obcięcia pierwszego kontraktu: sonda na 100 ziarnach z pierwszym kontraktem za 600 XP, aktem I za 1850 XP i eliminacją 475 dawała Krakowskie z wyjściem na 8,88–9,11, czyli na granicy poziomu (7 albo 8 zależnie od ziarna).
  - Wypłata dostawy liczy się teraz z poziomu Krakowskiego, a nie targu. `V17_CONTRACT_XP` (850 XP za stary kontrakt w migracji) zostaje, choć dzisiejsze zlecenia dają XP zależne od poziomu. Test nie mierzy ekonomii, więc to zostaje do przeglądu wypłat z rundy 1.

### Runda 3: decyzje użytkownika z 7.11 i strojenie

Ta część zastępuje w rundzie 2 regułę XP bez dolnej granicy (`xpLevelScale = (poziom / 6)^1,6` także poniżej poziomu 6) i bazę XP dostawy 500. Rozstrzyga też punkty z jej listy „Do decyzji użytkownika”.

- **Decyzje użytkownika (7.11):**
  - XP zleceń, wrogów i premii za brak wykrycia rośnie jak koszt poziomu dopiero od poziomu 6, a poniżej mnożnik wynosi 1: `xpLevelScale = 1` do poziomu 6, wyżej `(poziom / 6)^1,6`. Walka ma zawsze dawać więcej XP niż quickhack.
  - Tempo Krakowskiego stroją niższe bazy zleceń i XP aktu I, a nie zmiana reguły z punktu wyżej.
  - Akt I za 1350 XP jest przyjęty.
  - Tempo 8 / 7 / 7 / 7 wystarczy. Próg testu zostaje 6–9 poziomów na dzielnicę, z zapasem od granic.
- **Nowa miara w teście balansu.** Na każdym poziomie od 1 do 30 każdy zwykły wróg (bez rangi elity) na poziomie gracza daje co najmniej tyle XP, co quickhack (`QUICKHACK_XP`, 25). Z regułą z rundy 2 test pada na poziomie 1 (ganger daje 3 XP), a z podłogą przechodzi. Najtańszy zwykły wróg, czujka Hebi, daje na poziomie 1 50 XP. Wróg o 5 poziomów słabszy od gracza daje 10% swojego XP (`killXpShare`), więc wtedy zabicie jest warte mniej niż quickhack. Miara tego nie obejmuje, bo mówi o zwykłym wrogu, a nie o wrogu daleko poniżej gracza.
- **Strojenie.** Sama podłoga dawała tempo 9 / 6 / 7 / 7 (47 z 50 ziaren) albo 9 / 7 / 6 / 7 (3 z 50), z wyjściem z Krakowskiego na 10,02–10,32. Test przechodził, ale Krakowskie stało na górnej granicy progu. Zlecenia Kaito na poziomach 1–6 dają z podłogą pełną bazę, a dostawa jest jego zleceniem bez walki tylko w Krakowskiem (pasmo 1–8), więc niższa jest jej baza. Eliminacja zostaje na 500, bo niesie też tempo Starego Miasta. Sonda na 200 ziarnach z bazą dostawy 300 dawała wyjście z Krakowskiego na 9,47–9,97, z bazą 250 na 9,38–9,77, a z bazą 225 na 9,33–9,72. Przy bazie 200 (sonda na 50 ziarnach) wyjście wynosiło 9,27–9,60. Wybrana jest baza 225, bo wyjście leży najbliżej środka między poziomem 9 a 10. Akt I zostaje na 1350 XP, więc tabela migracji `V17_QUEST_XP` się nie zmienia.
- **Wyniki przed rundą 3 i po niej** (model i progi jak w rundzie 2; „przed” to stan rundy 2 po scaleniu `main` z #353 i #355; sonda na 200 ziarnach, test na pięciu):

  | Miara | Przed | Po |
  |---|---|---|
  | Poziomy w dzielnicach (Krakowskie / Stare Miasto / targ / doki) | 8 / 7 / 7 / 7 dla wszystkich 200 ziaren | 8 / 7 / 7 / 7 dla wszystkich 200 ziaren |
  | Poziom z ułamkiem przy wyjściu z dzielnicy | Krakowskie 9,56–9,85, Stare Miasto 16,42–16,65, targ 23,38–23,54 | Krakowskie 9,33–9,72, Stare Miasto 16,19–16,52, targ 23,25–23,43 |
  | Zapas doków (XP ponad próg poziomu 30, w kosztach poziomu 29) | 1,4–1,6 | 1,30–1,52 |
  | Czas pokonania wroga względem dolnej granicy pasma | 0,88–1,00 | 0,88–1,00 |
  | Czas pokonania gracza względem dolnej granicy pasma | 0,84–1,00 | 0,84–1,00 |
  | XP za gangera na poziomie gracza (poziomy 1, 5, 10, 20, 30) | 3 / 45 / 136 / 412 / 788 | 60 / 60 / 136 / 412 / 788 |
  | XP za czujkę Hebi, najtańszego zwykłego wroga (te same poziomy) | 3 / 37 / 113 / 343 / 657 | 50 / 50 / 113 / 343 / 657 |
  | XP za quickhack | 25 na każdym poziomie | bez zmian |
  | Eliminacja z trzema celami (poziomy 1 i 5) | 49 / 642 | 860 / 860 |
  | Dostawa (poziomy 1 i 5, a pasmo Krakowskiego kończy się na 8) | 28 / 373 | 225 / 225 |
  | Rzadkości, ochrona przed pechem, serie pecha | jak w rundzie 1 | bez zmian (testy przechodzą) |

  Krakowskie wychodzi na 9,33–9,72. Do 9 poziomów w tej dzielnicy brakuje więc co najmniej 0,28 poziomu, a do 7 trzeba by stracić co najmniej 0,33. W rundzie 2 do 9 poziomów brakowało 0,15. Oba wyniki, 7 i 9, mieszczą się jeszcze w progu 6–9. Stare Miasto wychodzi na 16,19–16,52, więc 0,19 poziomu mniej dałoby mu 6 poziomów zamiast 7, co też mieści się w progu.
- **Zmienione liczby:**
  - `xpLevelScale`: 1 do poziomu 6 (`XP_BASE_LEVEL`), wyżej `(poziom / 6)^1,6`. Bazy w kodzie są wartościami do poziomu 6;
  - baza XP dostawy: 225 zamiast 500.
- **Bez zmian:** krzywa XP, `SAVE_SCHEMA_VERSION`, kontrakty w `core/src/{ports,events,commands}`, akt I (1350 XP), pierwszy kontrakt, akt II, pozostałe bazy zleceń, `ENEMY_XP`, XP quickhacków i włamań, pasma, rzadkości i ochrona przed pechem.
- **Determinizm i luka w złotych hashach.** Hash pojedynku wręcz w `determinism.test.ts` (`hashOf` i wersje v17–v31) wraca do wartości sprzed rundy 2 (`b036f5d7` i pozostałe), bo zbir pokonany przez gracza z poziomem 1 znów daje 70 XP zamiast 4. Pozostałe złote hashe się nie zmieniły. Luka z rundy 2 zostaje: żaden złoty hash nie obejmuje XP zleceń, premii za brak wykrycia, wrogów powyżej poziomu 1 ani kroków zadań poza pierwszym. Pilnują ich test balansu, `core/test/progression*.test.ts` i `sim/test/progression.test.ts`. Lukę zamknie przebieg z kontraktem zakończonym w wyższym paśmie.
- **`V17_CONTRACT_XP` (850 XP za kontrakt zakończony przed v17).** Zostaje. Zapis sprzed v17 nie trzyma rodzajów ani poziomów zleceń, a w tamtej treści były tylko zlecenia Kaito w Krakowskiem, czyli dziś zlecenia na poziomach 1–8, w większości z mnożnikiem 1. Dzisiejsze zlecenie Kaito daje tam średnio ok. 540 XP z samego kontraktu (dostawa 225, eliminacja z trzema celami 860), a z walką, quickhackiem i premią za brak wykrycia ok. 720 XP. Migracja nie zna zabitych ani hacków, więc 850 XP za kontrakt to rozsądna rekompensata za całe zlecenie. Test zapisu daje dla aktu I z dziewięcioma kontraktami poziom 9, a model przejścia kończy Krakowskie (akt I i dziesięć zleceń) na 9,33–9,72, więc oba się zgadzają. Test zapisu przechodzi bez zmiany.
- **Do decyzji użytkownika:**
  - Wróg o 5 i więcej poziomów słabszy od gracza daje 10% swojego XP, więc od poziomu gracza ok. 6 w górę zabicie go jest warte mniej niż quickhack (np. ganger na poziomie 1 przy graczu z poziomem 6 daje 6 XP). Można zostawić tak albo dać quickhackowi ten sam udział zależny od różnicy poziomów.
  - Dostawa daje teraz 225 XP przy wypłacie bez zmian, więc w Krakowskiem płaci mniej XP niż eliminacja (860 XP z trzema celami), a ta przynosi do tego XP za walkę.
