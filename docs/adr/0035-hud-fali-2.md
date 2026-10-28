# ADR-0035: App i UI fali 2

## Kontekst
ADR-0032 ustalił kontrakty fali 2. Symulacja (sim A i sim B) dopiero zaczyna emitować nowe zdarzenia, więc app i UI powstały równolegle i są testowane ręczną emisją na szynie oraz przez debug API. Obowiązuje podział z ADR-0031: każda funkcja ma w app kontroler albo prezenter, a w UI wąski interfejs intencji i hook.

## Decyzja

### Kontrolery (app, `controllers/`)
- **`MetroController`** implementuje `MetroIntents` (`travelMetro`, `closeMetro`).
  - `InteractionStarted` z `kind: "metro"` i `station` (ADR-0034) otwiera mapę linii zamiast ink. Ceny liczy `metroFare` z core.
  - `MetroRefused` daje toast z powodem odmowy.
  - Bilet wysyła `travel-metro { to }`, a po interakcji także `end-dialogue`.
  - Brak środków albo gorące zlecenie (heat > 0 przy aktywnym zleceniu) daje odmowę i dźwięk `denied`.
  - `MetroDeparted` pokazuje ekran przejazdu z postępem, a `MetroArrived` go zamyka. Napisy pochodzą z puli knotów `metro_ride_<n>`; pusta pula daje cichy przejazd.
  - W trakcie przejazdu gracz nie ma kontroli, a zapis jest zablokowany.
- **`RadioController`** implementuje `RadioIntents` (`setRadioStation`, `nextRadioStation`).
  - Stacje: `drift` (Neon Drift 88.1), `yoru` (Yoru FM 76.5), `tessen` (Tessen Info 24) i wyłączone.
  - Klawisz B jest dopisany do `RESERVED_KEYS`. Radio da się też wybrać w telefonie.
  - Stacja jest polem ustawień (`settings.radioStation`, localStorage).
  - Co 45 s gry toast z wstawką z puli `radio_<stacja>_<n>`.
- **`TouchController`** implementuje `TouchIntents` (`touchDash`): zryw z łuku dotykowego trafia do następnej klatki wejścia (`withTouch`), tak jak skaner z fali 1.

### Prezentery (app, `presenters/`, fasada `Wave2Hud`)
- **`BodyHud`** czyta stan z domeny w każdej klatce, więc wczytanie gry pokazuje go od razu:
  - pojemność z `capacityUsed` i `capacityMax` z core;
  - buffy z `domain.buffs` z czasem i nazwą z `BUFF_CATALOG`; `BuffApplied` daje toast;
  - ikona zrywu z `Dashed`, odnowienie `DASH_COOLDOWN` z sim (1,5 s) podzielone przez `cooldownRateOf` (z kawą 1 s);
  - toast przy `ProjectileReflected` gracza.
- **`DisguiseHud`**: rola i spalenie przy pasku zdrowia z `domain.disguise`. `DisguiseBlown` daje toast i oznacza obserwatora jako egzekutora na minimapie; pozostałych egzekutorów minimapa bierze z `view.enforcer`.
- **`ContractIntel`**:
  - haki z `ContractHookFound` w trackerze, czyszczone z końcem zlecenia;
  - po wczytaniu haki wracają z `ContractLog.hooks`;
  - `GuardBark` pokazuje kwestię strażnika jako napis.
- **`presentEncounters`**: `EncounterStarted` otwiera knot drogą zwykłego dialogu, jeśli żaden panel nie jest otwarty.
- Karta podsumowania pokazuje wariant zlecenia z `ContractDebrief.variation` albo z kontraktu (`variationOf` z narracji).
- W czasie przejazdu `sim.player()` zwraca `undefined`; HUD i minimapa to znoszą (test sesji z prawdziwym przejazdem).

### Minimapa
- Na mapie są tylko fixerzy i cele przyjętych zleceń. Sklepy zniknęły, a terminal, skrzynia i eskortowany są widoczne tylko przy aktywnym zleceniu.
- Cel to okrąg o promieniu 10 m wokół punktu zaokrąglonego do siatki 8 m, więc nie zdradza wejścia.
- Zoom: 1,35 przy sprincie, 1,6 po zrywie. W metrze zoom jest wyłączony. Przy ruchu widok wyprzedza gracza o 1/3 zasięgu, a strzałka siedzi w dolnej tercji.
- Ustawienia: `mapMarkers` (tryb bez znaczników) i `highlights` (podświetlenia, przekazywane do renderera).

### Klinika
- Koszt implantu to `capacity` z katalogu core, a zgodność liczy `fitsCapacity` z core.
- UI blokuje przycisk z komunikatem, a `ShopController` odrzuca komendę z toastem.
- W ekwipunku „Użyj” działa przy pełnym zdrowiu dla przedmiotów, które nie tylko leczą (`needsWounds`): kawa, stymulant, shard pojemności.

### Dotyk
- Łuk akcji drugorzędnych wokół przycisku ognia: przeładowanie, następna broń, skaner, zryw.
- Kontekstowy przycisk „Użyj” z treścią promptu zamiast „E”.
- Cele mają co najmniej 44 px, a pozycje biorą `env(safe-area-inset-*)`.

## Propozycje kontraktów
- **Audio:** `AudioScenePort.setRadioStation?(id: string | null)`. App woła ją, jeśli adapter ją ma (`RadioAudio`).
- **Render:** `setHighlights?(on: boolean)` obok `setReduceFlashes`.
- **Wejście:** `VirtualPad` z przyciskiem `dash`. Wtedy `TouchController` staje się zwykłym naciśnięciem pada.
- **Core:** stała odnowienia zrywu w core zamiast w sim, żeby app nie sięgał po nią do `@seki/sim`.
- **Sim:**
  - spotkanie emituje tylko `EncounterStarted`, bez `InteractionStarted`, żeby knot nie startował dwa razy.

## Konsekwencje
- `UiState` ma nowe obszary `MetroUiState` i `BodyUiState`. `UiIntents` jest sumą 12 wąskich interfejsów.
- Zmiana reguły minimapy zmieniła oczekiwania w `journal-map-settings.test.ts`, bo klinika i sklepy nie mają już znaczników.
