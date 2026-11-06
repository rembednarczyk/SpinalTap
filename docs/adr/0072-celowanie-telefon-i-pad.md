# ADR-0072: Celowanie na telefonie i padzie: wspomaganie i strzał z celowaniem jednym kciukiem

Status: przyjęty 6.11 (decyzje użytkownika: na dotyku oba warianty strzału do wyboru w opcjach, A domyślnie do czasu prototypu z etapu 1; wspomaganie domyślnie standardowe, tylko na wrogów w walce w linii wzroku, nie na nieświadomych przy skradaniu, nigdy dla myszy; pad: martwa strefa promieniowa 0,12, krzywa klasyczna domyślnie i własna czułość, także dla obecnych graczy). Wynika z audytu luk (`docs/audyt-luk.md`, wiersz „Brak wspomagania celowania”, P0 dla telefonu, pad w tym samym ADR-ze) i z backlogu „[plan, 31.10] Celowanie na telefonie”.

## Kontekst
Na telefonie nie da się jednym kciukiem jednocześnie celować przez przyrządy (ADS, ADR-0019), strzelać i obracać widok. Na padzie celowanie działa, ale bez wspomagania i z prostą obsługą gałek. Stan na `origin/main` 920dc49:

**Dotyk** (ADR-0035, `packages/ui/src/touch/touch-controls.tsx`, `pad-button.tsx`):
- Lewy kciuk trzyma pływającą gałkę ruchu. Prawa strona to strefa obrotu widoku i osobne przyciski strzału (●) i celowania (◎). Oba mają `lookToo`, więc przeciągnięcie z przycisku obraca widok (`useLookDrag`, 0,0055 rad na piksel CSS).
- Strzał z celowaniem wymaga dwóch palców po prawej stronie: jeden trzyma ◎, drugi ●. Ruch zajmuje lewy kciuk, więc przy trzymaniu celowania (`aimMode: "hold"`, domyślne) strzał w ADS to trzeci palec.
- Tryb przełączany już działa na dotyku: `AimLatch` w `packages/engine/src/input/keymap.ts` przez `InputLatches`, a przycisk ◎ świeci (`touch__btn--on`, z `aiming || blocking` w stanie UI). Ustawienie jest jednak wspólne dla myszy i dotyku, nazywa się „Aim (RMB)” / „Celowanie (PPM)” i leży w zakładce „Mouse & Camera” (`packages/ui/src/menus/settings-panel.tsx`, `MouseAndCamera`). Gracz na telefonie go nie szuka.
- Czułość dotyku (`touchSensitivity`) mnoży obrót w app razem z przybliżeniem ADS (`renderer.rig.lookScale`) i `adsSensitivity` (`packages/app/src/main.tsx`, `scaleLook`). Nie ma krzywej ani wspomagania.

**Pad** (`packages/engine/src/input/browser-input.ts`, `pollPad`, i `mapGamepad` w `keymap.ts`):
- Obsługiwany jest pierwszy pad z `mapping === "standard"` (Gamepad API) i tylko w grze. Menu i dialog padem nie działają (audyt P1, punkt 7, poza tym ADR-em).
- Mapowanie: RT strzał, LT celowanie, A skok, B kucanie (trzymane) i zryw (podwójne B), X interakcja, Y apteczka, LB schowanie broni, RB zdolność, View kamera, L3 sprint i zmiana ramienia przy celowaniu, R3 skaner, krzyżak broń i przeładowanie.
- Martwa strefa 0,16 liczona osobno na każdej osi (`PAD_DEADZONE`), dalej liniowo, obrót stały 2,8 rad/s (`PAD_LOOK_SPEED`). Strefa osiowa daje „krzyż”: mały ruch po skosie przyciąga do osi. Liniowa odpowiedź utrudnia drobne poprawki.
- Pad nie ma własnej czułości. App mnoży scalony obrót wszystkich urządzeń przez `touchSensitivity` na urządzeniu dotykowym albo `mouseSensitivity` w innym przypadku (`main.tsx`, `touchDevice ? …`).

**Wspomagania nie ma** (grep `aimAssist|magnetism` w `packages`: tylko opis wszczepu Hitomi w katalogu tekstów, bez mechaniki wejścia).

**Kontrakt i reguły:**
- `InputFrame` (`packages/core/src/ports/input-port.ts`) niesie przyrosty `lookYaw`/`lookPitch` i trzymane `aim` z opisem „tryb toggle rozwiązuje adapter wejścia, ramka mówi zawsze »chcę teraz celować«”. Każdy wariant niżej mieści się w tym kontrakcie.
- ADS w `sim`: `posture.aim` rośnie od 0 do 1 w czasie `weapon.ads.time` (domyślnie 0,2 s, `packages/sim/src/systems/player-control-system.ts`), a stożek rozrzutu zwęża się z `posture.aim` (`aimSpreadOf`). Bez broni z `ads` (broń biała) `aim` oznacza blok.
- Ustawienia leżą w `localStorage` pod `seki.settings.v1` z `SETTINGS_REV` 2 (`packages/app/src/settings.ts`), a `sanitizeSettings` uzupełnia brakujące pola wartościami domyślnymi. To nie jest zapis gry: `SAVE_SCHEMA_VERSION` (28, `packages/core/src/save/save-snapshot.ts`) dotyczy tylko zapisów.
- Cel dla wspomagania potrafi już wyznaczyć `sim`: `scanFocus` (`packages/sim/src/systems/scanner-system.ts`) szuka rzeczy najbliższej środka widoku z `eyeOf`, `chestOf` i `lineOfSight` z `world/hitscan.ts`. Stan walki wroga to `ai.alerted` (`world/components/ai.ts`).

## Decyzja
Liczby są startowe i do strojenia na telefonie.

### 1. Strzał z celowaniem jednym kciukiem
Nowe ustawienie dotyku `touchFire`. Przeciągnięcie z przycisku strzału obraca widok we wszystkich wariantach, bo tak jest dziś (`lookToo`) i bez tego jeden kciuk nie poprawi celu w trakcie ognia.

| Wariant | Jak działa | Plusy | Minusy |
|---|---|---|---|
| A „Strzał celuje” (`touchFire: "aims"`) | Trzymanie ● daje w ramce `fire` i `aim`. Puszczenie kończy oba, chyba że celowanie jest zatrzaśnięte przyciskiem ◎ w trybie przełączanym. Z bronią białą ● tylko uderza (bez bloku), bo app podaje adapterowi, czy aktywna broń ma `ads`. | Jeden gest, działa przy trybie trzymanym, ◎ zostaje do rozglądania się w ADS bez strzału. | Pierwsze strzały padają w trakcie wejścia w ADS (0,2 s), więc pojedynczy tap z pistoletu to strzał prawie z biodra. Zgodne z regułami `sim`, bez zmian w symulacji. Strzał z biodra na telefonie znika. |
| B „Celowanie tapnięciem” (`touchFire: "separate"` z trybem przełączanym) | Tap ◎ włącza ADS i ◎ świeci. Potem ten sam kciuk trzyma ● i przeciąga. Drugi tap wyłącza. Do stanu przycisku dochodzi zmiana celownika w HUD (np. pierścień ADS), żeby stan był widoczny poza samym przyciskiem. | Zostaje strzał z biodra i pełna kontrola, mechanika już istnieje. | Dwa ruchy przed pierwszym strzałem, a zapomniane ADS spowalnia ruch (`ads.move`). |
| C „Przeciągnięcie z przycisku strzału” | Dzisiejsze `lookToo` na ●. | Już działa. | Samo nie daje ADS, więc nie zamyka luki. Wchodzi do A i B jako ich część. |

**Rekomendacja: A jako domyślne na dotyku, B jako opcja.** A rozwiązuje problem jednym gestem i nie wymaga od gracza zmiany trybu. B zostaje dla tych, którzy chcą strzelać z biodra. Ostateczny wybór domyślnego wariantu po prototypie na telefonie (etap 1 buduje oba za ustawieniem). Ustawienie `aimMode` zostaje wspólne (ustawienia są per przeglądarka, więc telefon i komputer mają osobne), ale zmienia nazwę na neutralną („Aim button” / „Przycisk celowania”) i pokazuje się też w nowej zakładce dotyku i pada.

### 2. Wspomaganie celowania
Dwa efekty, tylko dla obrotu z dotyku i pada, nigdy dla myszy:
- **Spowolnienie nad celem:** gdy oś celowania jest w strefie celu (promień kątowy sylwetki × 1,5), obrót z dotyku i pada mnoży się przez współczynnik od 0,55 w środku do 1 na brzegu strefy (przy poziomie „lekkie” od 0,75).
- **Przyciąganie przy wejściu w ADS:** na zboczu `aim` (po zatrzasku i po `touchFire`) adapter dokłada obrót w stronę klatki piersiowej najbliższego środka celu w stożku 6°, w ciągu 0,15 s, najwyżej 60% odległości kątowej i najwyżej 4°. Ruch gracza w przeciwną stronę przerywa przyciąganie. Bez śledzenia celu w ruchu (to nie jest lock-on).
- **Kto jest celem:** żywy i nieobezwładniony przeciwnik w walce z graczem (`ai.alerted`), w zasięgu broni (najwyżej 40 m) i w linii wzroku. Cywile, patrole neutralne i nieświadomi wrogowie przy skradaniu (ADR-0069) nie przyciągają.
- **Ustawienie** `aimAssist`: wyłączone, lekkie, standardowe (domyślne). Działa tylko z bronią z `ads`.
- **Bez wpływu na symulację.** Wspomaganie zmienia tylko `lookYaw`/`lookPitch` w ramce, zanim trafi do `session.step`. Reguły trafień, rozrzut i AI się nie zmieniają, złote hashe w `determinism.test.ts` zostają. Powtórka z nagranych ramek daje ten sam wynik, bo ramka niesie już obrót po wspomaganiu. Cele adapter dostaje z poprzedniego kroku symulacji, tylko do odczytu.

### 3. Pad
- **Mapowanie bez zmian** (lista w kontekście). `touchFire` nie dotyczy pada, bo pad ma osobne spusty.
- **Martwa strefa promieniowa** dla obu gałek zamiast osiowej: wewnętrzna `padDeadzone` (0,05–0,3, domyślnie 0,12), zewnętrzna 0,95 (wychylenie powyżej to pełny ruch). Usuwa „krzyż” na skosach.
- **Krzywa obrotu** `padCurve`: liniowa (wykładnik 1), klasyczna (1,8, domyślna), precyzyjna (2,6), liczona od długości wychylenia po martwej strefie. Kierunek zostaje.
- **Własna czułość** `padSensitivity` (0,2–3, domyślnie 1) zamiast `mouseSensitivity`/`touchSensitivity`. Przybliżenie ADS (`lookScale`), `adsSensitivity` i `invertY` działają jak dziś.
- Skalowanie czułości przechodzi z app do adaptera, osobno dla każdego urządzenia przed scaleniem ramek (`mergeFrames`). Tylko tak pad, dotyk i mysz mają własne czułości, a wspomaganie widzi wyłącznie obrót z dotyku i pada. App dalej mnoży wynik przez `lookScale` i `adsSensitivity`.
- Poza zakresem: pad w menu i dialogu (audyt P1, punkt 7) oraz remapowanie pada i dotyku (audyt P2).

### 4. Granice pakietów
| Pakiet (właściciel) | Co dochodzi |
|---|---|
| `packages/engine/src/input` (Input) | `aim-assist.ts` (czyste funkcje: strefa, współczynnik, przyciąganie), `touchFire` w `VirtualPad`, martwa strefa promieniowa i krzywa w `keymap.ts`, czułość per urządzenie w `BrowserInput` (np. `setLookTuning`). Cele jako własny typ engine (`AimTarget`: przesunięcie kątowe, promień kątowy, odległość), bez importu `sim`. |
| `packages/sim` (Simulation / ECS) | Zapytanie tylko do odczytu `aimTargets(world, player)` obok `scanFocus`: bez stanu, bez `RandomPort`, poza `createSystems()`. |
| `packages/app` (Infra / Build) | W każdym kroku: `aimTargets` → przesunięcia kątowe → adapter; flaga „broń z `ads`” dla `touchFire`; nowe pola w `sanitizeSettings`. Własny mały moduł (np. `aim-assist-feed.ts`), nie dopisywany do `main.tsx` ponad wywołanie (ADR-0031). |
| `packages/ui` (UI / HUD) | Zakładka „Touch & Gamepad” w ustawieniach, pola w `SettingsVm` i `DEFAULT_SETTINGS`, pierścień ADS przy celowniku dla wariantu B. UI nie zna `engine` ani `sim`. |
| `packages/core/src/ports` (Architekt) | Bez zmian. `InputFrame` już opisuje `aim` jako rozwiązane przez adapter, a wspomaganie mieści się w `lookYaw`/`lookPitch`. Zmiana kontraktu byłaby potrzebna tylko wtedy, gdyby symulacja lub powtórki miały wiedzieć, że wspomaganie działało (np. statystyki). Tego nie planujemy. |

### 5. Zapis ustawień
Nowe pola `touchFire`, `aimAssist`, `padSensitivity`, `padDeadzone`, `padCurve` w `seki.settings.v1`. Stare wpisy ich nie mają, więc `sanitizeSettings` daje wartości domyślne. Żadna istniejąca wartość domyślna się nie zmienia, więc `SETTINGS_REV` zostaje 2. `SAVE_SCHEMA_VERSION` zostaje 28, bo zapis gry się nie zmienia.

### 6. Teksty (ADR-0056)
Nowe klucze w `i18n/{en,pl}`:

| Klucz | en | pl |
|---|---|---|
| `settings.tab.touch` | Touch & Gamepad | Dotyk i pad |
| `settings.touchFire` | Fire button | Przycisk strzału |
| `settings.touchFire.aims` | Aims and fires | Celuje i strzela |
| `settings.touchFire.separate` | Fires only | Tylko strzela |
| `settings.aimAssist` | Aim assist | Wspomaganie celowania |
| `settings.aimAssist.off` / `.light` / `.standard` | Off / Light / Standard | Wyłączone / Lekkie / Standardowe |
| `settings.padSensitivity` | Gamepad sensitivity | Czułość pada |
| `settings.padDeadzone` | Stick dead zone | Martwa strefa gałek |
| `settings.padCurve` | Response curve | Krzywa reakcji |
| `settings.padCurve.linear` / `.classic` / `.precise` | Linear / Classic / Precise | Liniowa / Klasyczna / Precyzyjna |

Zmiana istniejącego `settings.aimMode` z „Aim (RMB)” / „Celowanie (PPM)” na „Aim button” / „Przycisk celowania” jest świadomą zmianą polskiego katalogu, bo zmienia się zakres ustawienia, nie tłumaczenie. Skan `i18n-scan` bez wzrostu bazy.

## Etapy (osobne PR-y)
1. **Strzał jednym kciukiem** (engine `VirtualPad`, app, ui). `touchFire` z wariantami A i B, flaga broni z `ads`, zakładka „Touch & Gamepad” z `touchFire` i `aimMode`, pierścień ADS dla B, teksty en i pl. Testy: jednostkowy `VirtualPad` (A: `fire` daje `aim` tylko z bronią z `ads`; B: zatrzask), sesja bez renderera (trzymanie ● z A podnosi `posture.aim` do 1 w 0,2 s, z bronią białą nie blokuje), komponent ustawień, e2e `touch.spec.ts`. Po etapie użytkownik gra na telefonie i wybiera domyślny wariant.
2. **Zapytanie `aimTargets` w `sim`.** Test `sim`: zaalarmowany ganger w linii wzroku jest celem; cywil, patrol neutralny, obezwładniony, nieświadomy i ganger za ścianą nie są. Złote hashe bez zmian.
   Zbudowane (`packages/sim/src/systems/aim-targets.ts`): `aimTargets(world, player, range?)` i `Simulation.aimTargets()` zwracają `AimCandidate[]` (`id`, `point` = klatka piersiowa z `chestOf`, `distance` od oka gracza, `radius` = promień ciała) w kolejności tworzenia. Celem jest NPC z `ai.alerted`, żywy, nieobezwładniony, w zasięgu `aimRangeOf(player)` (40 m, `AIM_ASSIST_RANGE`, albo mniej, gdy broń sięga krócej) i z `lineOfSight` od `eyeOf(player)`. Dane są w przestrzeni świata: etap 3 liczy z nich przesunięcie i promień kątowy względem własnej kamery. Snajper (bez `ai`) nie jest celem, tak jak w tekście decyzji. Kontrakty `core` bez zmian.
   Decyzja użytkownika 6.11: snajper (`sniper`, bez `ai`, ADR-0024) w fazie `aim` (laser na graczce) też jest celem, żywy, nieobezwładniony, w zasięgu i w linii wzroku; w fazach `idle`, `rest` i `move` nie. Zapytanie dalej tylko czyta stan, złote hashe bez zmian. Ganger z `ai.victim` przed alarmem: bez decyzji, nie jest celem. Suwak czułości dotyku przeszedł z „General” do „Touch & Gamepad”.
3. **Wspomaganie dla dotyku** (engine `aim-assist.ts`, app). Ustawienie `aimAssist`, czułość dotyku przeniesiona do adaptera. Testy: jednostkowe współczynnika i przyciągania (granice 6° i 4°, przerwanie ruchem przeciwnym); sesja bez renderera z deterministycznym celem (ziarno, `freeze` + `step`, ganger zaalarmowany 12 m przed graczem 3° w bok): ze wspomaganiem `yaw` po wejściu w ADS zbliża się do celu o 60% ± 5% w 0,15 s, wyłączone nie zmienia nic, mysz nie dostaje wspomagania; powtórka z nagranych ramek daje ten sam hash.
   Zbudowane na kodzie etapu 4: `packages/engine/src/input/aim-assist.ts` (`slowdownFactor`, `snapTurn`, klasa `AimAssist` jako `BrowserInput.aimAssist`) i `packages/app/src/aim-assist-feed.ts` (`feedAimAssist` przed każdym `poll()`). Kąty liczy app wzdłuż osi celowania: od `aimOrigin` (oko w FPP, linia ramienia w TPP, na której stoi kamera) z `yaw`/`pitch` gracza. W TPP cel, który oko widzi zza krawędzi ściany, a ramię nie, odpada (drugi `lineOfSight` od ramienia), bo dociągnąłby celownik na ścianę. Spowolnienie dotyczy ramki dotyku po jej czułości, przed `mergeFrames`. Przyciąganie rusza na zboczu `aim` tylko wtedy, gdy w tej ramce celowania chce dotyk (◎ albo ● z `touchFire: "aims"`), nigdy po PPM; app dokłada je po `viewLook` (`AimAssist.apply`), bo inaczej przybliżenie ADS zmniejszałoby kąt dociągnięcia. Cel jest „w stożku 6°”, gdy jego sylwetka sięga do stożka (kąt − promień kątowy ≤ 6°): przy samym środku w stożku limit 4° nigdy by nie zadziałał (0,6 × 6° = 3,6°). Poziom „lekkie” zmienia tylko spowolnienie (0,75), przyciąganie jest takie samo.
4. **Pad** (engine `keymap.ts`, `browser-input.ts`, app, ui). Martwa strefa promieniowa, krzywa, `padSensitivity`, wspomaganie dla obrotu z pada. Testy: jednostkowe `mapGamepad` (skos 0,1/0,1 w martwej strefie, 0,3/0,3 bez przyciągania do osi, krzywa dla każdego wykładnika), sesja bez renderera z ramkami z syntetycznego `PadState` i tym samym celem co w etapie 3, test `sanitizeSettings` dla nowych pól i starego wpisu.
   Zbudowane bez wspomagania (czeka na etap 3): `shapeStick` i `mapGamepad(pad, dt, PadTuning)` w `keymap.ts` (strefa promieniowa dla obu gałek, zewnętrzna 0,95, krzywa tylko dla obrotu), `BrowserInput.setLookTuning({ mouse, touch, pad })` skaluje każde urządzenie osobno przed `mergeFrames`, a app (`look-tuning.ts`) mnoży wynik już tylko przez `lookScale`, `adsSensitivity` i `invertY`. Czułość dotyku przeszła więc do adaptera już tutaj; etap 3 dokłada wspomaganie w miejscu oznaczonym w `poll()`, gdzie ramki dotyku i pada są jeszcze osobno. Skos 0,1/0,1 ma długość 0,141, więc przy strefie promieniowej 0,12 wychodzi poza nią jako mały skos (strefa osiowa 0,16 go zjadała); w martwej strefie zostaje np. 0,08/0,08. Pola ustawień `padSensitivity`, `padDeadzone` (zaokrąglana do 0,01) i `padCurve` w zakładce „Touch & Gamepad”.

Etapy 1 i 4 są niezależne. Etap 3 wymaga 2. E2e tylko dla dotyku (etap 1, układ zakładki w `touch-layout.spec.ts`); wspomaganie i pad sprawdzają testy sesji (ADR-0046).

## Konsekwencje
- Reguły symulacji bez zmian, złote hashe zostają, zapis gry bez zmian. Kontrakty `core` bez zmian.
- Wariant A zmienia odczucie dotyku dla obecnych graczy: ● zaczyna celować. Kto chce strzelać z biodra, wybiera „Tylko strzela”.
- Pad czuje się inaczej od etapu 4 (strefa 0,16 osiowa → 0,12 promieniowa, krzywa klasyczna zamiast liniowej, własna czułość zamiast czułości myszy lub dotyku). Kto wolał stare zachowanie, wybiera krzywą liniową.
- Wspomaganie korzysta ze stanu symulacji z poprzedniego kroku, więc opóźnia się o jeden krok (1/60 s). Przy tych siłach jest to niezauważalne.
- Wszczep Hitomi ma w opisie „basic aim assist”, ale działa przez statystyki (kryt, stabilność), nie przez wejście. Opis zostaje; łączenie wszczepu ze wspomaganiem wejścia wymaga osobnej decyzji, bo wspomaganie nie dotyczy myszy.
- ADR-0019 (tryb celowania) i ADR-0035 (układ dotykowy) zmieniają się w zakresie opisanym wyżej.

## Pytania do użytkownika
1. Czy domyślnie na dotyku ma być wariant A („strzał celuje”), z B jako opcją, czy wybierasz dopiero po prototypie z etapu 1?
2. Czy wspomaganie ma być domyślnie włączone (standardowe) i działać tylko na wrogów w walce, bez nieświadomych przy skradaniu?
3. Czy zmiana odczucia pada dla obecnych graczy (martwa strefa promieniowa, krzywa klasyczna, osobna czułość) jest w porządku, czy domyślnie zostawić liniową krzywą?
