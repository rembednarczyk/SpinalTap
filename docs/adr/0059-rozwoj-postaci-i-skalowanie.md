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
