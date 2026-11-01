# ADR-0066: Poziom trudności z presetami i wspomaganiem

## Kontekst
Audyt luk (31.10, `docs/audyt-luk.md`, Walka, P0) pokazał, że gra nie ma osi trudności. W `core`, `sim` i `ui` jedyne „difficulty” to `variationDifficulty` w kontraktach. Skutki:
- gracz, któremu walka sprawia kłopot (dotyk, pierwszy kontakt z TPP), nie ma jak jej ułatwić, a gracz doświadczony nie ma jak jej utrudnić;
- etap 8 ADR-0059 (balans rozwoju postaci) nie ma punktu odniesienia: liczby balansu muszą dotyczyć jednego poziomu, a pozostałe wynikać z mnożników;
- opcje dostępności (#82, #86) dotyczą widoku i napisów, nie samej rozgrywki.

Liczby walki i wykrywania są dziś stałymi w `sim`: `NPC_CRIT` i rozrzut strzału NPC (`combat-system.ts`, `aimSpreadOf`), tempo czujności (`AWARENESS_STEP`, `GUARD_CONE`, `ganger-perception.ts`), czas celowania snajpera (`SNIPER_AIM_TIME`), wsparcie przy heacie (`REINFORCE_INTERVAL`, `crime-system.ts`), a statystyki gracza z `StatModifiers` (`core/character/stats.ts`).

## Decyzja
- **Trzy presety i własne ustawienia:**
  - **Opowieść** (story): dla gracza, który chce fabuły;
  - **Normalny**: domyślny i jedyny, dla którego liczy się balans ADR-0059;
  - **Trudny**: bez zmian zasad, tylko ostrzejsze liczby;
  - **Własny**: dowolny zestaw suwaków z listy niżej; wybór presetu ustawia suwaki, ręczna zmiana suwaka przełącza na „Własny”.
- **Oś trudności to tabela mnożników w `core`** (`core/src/difficulty`), typ `DifficultyProfile`:

  | Pole | Opowieść | Normalny | Trudny | Działa na |
  |---|---|---|---|---|
  | `damageTaken` | 0,5 | 1 | 1,4 | obrażenia zadane graczowi (po pancerzu) |
  | `npcAccuracy` | 0,6 | 1 | 1,25 | odwrotność rozrzutu strzału NPC (`aimSpreadOf`) |
  | `awareness` | 0,6 | 1 | 1,3 | przyrost czujności NPC i kamer na sekundę |
  | `reinforce` | 0,5 | 1 | 1,5 | częstość wsparcia przy heacie (odwrotność `REINFORCE_INTERVAL`) |
  | `npcHealth` | 0,8 | 1 | 1,2 | `maxHp` wrogich NPC przy pojawieniu |
  | `snipeTell` | 1,6 | 1 | 0,8 | czas ostrzeżenia snajpera (`SNIPER_AIM_TIME`) |

  Wartości są punktem startu; poprawia je etap 8 ADR-0059. Normalny ma same jedynki, więc złote hashe symulacji się nie zmieniają.
- **Wspomaganie (niezależne od presetu, w opcjach dostępności):**
  - pomoc celowania na padzie i dotyku: przyciąganie celownika przy wejściu w cel (siła 0–1, domyślnie 0,5 na dotyku, 0,3 na padzie, 0 na myszy); żyje w `engine/src/input` i nie dotyka `sim`;
  - dłuższe okno QTE i parowania (`parryWindow` ×1,5);
  - pominięcie walki w zleceniu po dwóch przegranych z rzędu (pytanie w dialogu po śmierci); zlecenie liczy się jako wykonane bez XP za walkę.
- **Gdzie żyje stan:**
  - profil trudności jest częścią stanu gry (`sim`), bo zmienia wynik symulacji; zmienia go komenda `set-difficulty` (`core/src/commands`) z pełnym profilem, przyjmowana w dowolnej chwili poza walką (NPC zaalarmowany w pobliżu: komenda czeka do końca walki);
  - zapis gry przechowuje profil (zmiana schematu: `SAVE_SCHEMA_VERSION` + migracja w `packages/persistence/src/migrations.ts`; stare zapisy dostają „Normalny”);
  - wspomaganie celowania jest ustawieniem (jak `cameraMotion`), nie stanem gry.
- **Odczyt w systemach:** systemy `sim` czytają profil z jednego zasobu świata (`world.difficulty`), mnożąc stałe w jednym miejscu na system; żadnych rozgałęzień `if (preset === …)`. Gracz z modyfikatorami (`StatModifiers`) liczy się jak dziś, a `damageTaken` działa po pancerzu.
- **UI:**
  - wybór presetu przy „Nowej grze” (ekran przed ładowaniem, domyślnie Normalny) i w opcjach w pauzie;
  - opis presetu jednym zdaniem; suwaki w zwiniętej sekcji „Własny”;
  - teksty w katalogach i18n en/pl (ADR-0056);
  - na ekranie zapisu (slot) mała etykieta presetu.
- **XP i osiągnięcia:** poziom nie zmienia XP (gracz nie jest karany za Opowieść); jedyny wpływ to pominięcie walki z listy wspomagania.
- **Determinizm:** profil to dane wejściowe symulacji jak ziarno; ten sam profil i te same komendy dają ten sam przebieg. Test determinizmu dostaje drugi złoty hash dla „Trudnego”.

## Etapy (osobne PR-y)
1. `DifficultyProfile` w `core`, komenda `set-difficulty`, zasób w `sim`, mnożniki w walce, czujności, wsparciu i snajperze; testy symulacji (dla każdego pola: ten sam scenariusz, różny wynik w oczekiwanym kierunku), drugi złoty hash; zapis i migracja.
2. UI: wybór przy nowej grze, opcje w pauzie, etykieta slotu, i18n; testy sesji bez renderera i komponentów.
3. Wspomaganie: pomoc celowania (engine/input), okno parowania, pominięcie walki w zleceniu.

## Konsekwencje
- Etap 8 ADR-0059 balansuje tylko „Normalny”, pozostałe poziomy wynikają z tabeli.
- Każdy nowy system z liczbami walki albo wykrywania musi zdecydować, które pole profilu go dotyczy (albo żadne) i mieć na to test.
- Zapis gry zmienia schemat w etapie 1.
- Pomoc celowania zmienia odczucie gry na dotyku; e2e dotyku (`touch.spec.ts`) sprawdza, że przy sile 0 zachowanie jest jak dziś.
