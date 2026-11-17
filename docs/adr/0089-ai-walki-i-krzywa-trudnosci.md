# ADR-0089: AI walki i krzywa trudności

Status: Przyjęty (decyzja użytkownika 17.11): wariant B. Pozostałe pytania z końca dokumentu (cele tempa, płaskie pasmo, `npcPressure`, liczba strzelców naraz, G-909, znak przed serią, odzywki, osłony) zostają otwarte i są rozstrzygane przy etapach, przed budową każdego z nich; do tego czasu obowiązują rekomendacje z dokumentu. Wynika z audytu łowcy z 17.11 („Audyt skradania i walki”, wnioski (a) i (b) w `docs/backlog.md`) oraz z G-909 i G-917. Dotyczy ADR-0024 (ochrona Tessen, snajper), ADR-0029 (pościg do ostatniej pozycji), ADR-0043 (pryzmaty, koszt kroku), ADR-0046 (testy), ADR-0059 (pasma poziomów, etap 8 balansu), ADR-0066 (poziom trudności), ADR-0069 (skradanie), ADR-0072 (celowanie na telefonie) i ADR-0082 (W-3). Wnioski (c) i (d) audytu (wykrywanie binarne, puste miasto) są poza tym ADR-em i czekają na osobną decyzję użytkownika.

## Kontekst

### Co robi dziś wróg w walce
- Drzewo `GANGER_TREE` (`packages/sim/src/systems/ai/ganger-tree.ts`) ma jedną gałąź walki: zaalarmowany, widzi gracza, gracz w `attackRange`, czysta linia, więc `ShootAtPlayer`. Poza zasięgiem `ChasePlayer` idzie prosto do gracza. Nie ma nic pomiędzy.
- `attack()` (`ganger-fight.ts`) zeruje prędkość, obraca wroga do gracza i strzela, gdy broń jest gotowa. Wróg stoi w miejscu jak działko. Jedyny rozrzut w czasie to `cooldown += rng.next() * 0,5`.
- `attackRange` ustawia `gangerEntity` (`packages/sim/src/world/factory.ts:173`): Tessen 20 m, broń biała `0,8 × range`, każda inna broń palna 15 m, niezależnie od zasięgu broni NPC (`npc.range` w `core/src/items/catalog.ts`: `unity9` 40, `hebi_smg` 18, `raijin12` 12, `tessen_ar5` 30, `kagero_dmr` 80).
- Ruchu bocznego, flankowania i osłon nie ma. Z miejsca rusza się tylko snajper (`sniper-ai-system.ts`: odwrót na najdalszy punkt, gdy gracz podejdzie na 14 m), ale to też nie osłona, tylko inny punkt.
- Drzewo nie trzyma stanu między krokami (komentarz w `ganger-tree.ts`), więc po wczytaniu odbudowuje się z komponentów. W zapisie są dziś z AI: `alerted`, `suspicion`, `lastKnown`, `search`, `lost`, `away`, `walk` (`EntitySnapshot`, `SAVE_SCHEMA_VERSION` = 43).

### Liczby z audytu (sondy sim bez renderera, origin/main e2f6330)
- Ganger Hebi: gracz zabija go pistoletem w 0,9-1,5 s; bierny gracz ginie po 31-35 s. Stosunek ok. 1 do 25: pojedynczy ganger nie jest zagrożeniem.
- Strażnik Tessen: gracz 1,7-2,6 s, bierny gracz 7-10 s.
- „Trudny” (ADR-0066) dokłada po stronie gracza tylko 0,2-0,5 s (`npcHealth` 1,2). Profil nie ma pola, które zmienia zachowanie wroga.
- Poziomy 1, 6 i 12 dają prawie ten sam wynik. To jest zamierzone: ADR-0059 skaluje wroga z graczem w paśmie (`enemyLevel`, `core/src/progression/bands.ts`, +4% na poziom), a `packages/sim/test/balance.test.ts` wymaga, żeby każda walka trwała 0,75-1,33 tej samej walki na dnie pasma. Krzywa jest płaska z założenia, nie z błędu.
- G-917: Hebi Enforcer z `raijin12` (zasięg NPC 12 m) stoi na 15 m i strzela: na 12,5-15 m 18-19 strzałów i 0 trafień w 30 s, na 11-12 m 46-77 obrażeń. Elita nie zadaje obrażeń.
- G-909: droga głośna W-3 przy zapisie z aktu I (poziom 6, Unity-9) jest nie do przejścia: strażnicy poziomu 11 (154 HP), pistolet ok. 45 obrażeń z magazynku, zgon w 12 s przy 6 wrogach. Przyczyną jest brak zapisu startowego poziomu 12 (ADR-0082), ale pokazuje też drugą rzecz: sześciu stojących strzelców naraz to ściana, a nie walka.

### Co z tego wynika
Walka jest za łatwa przeciw jednemu wrogowi i za ostra przeciw wielu, bo każdy wróg, który widzi gracza, strzela bez przerwy z miejsca. Trudność i poziom zmieniają tylko liczby, więc gra przy każdym ustawieniu wygląda tak samo. Na telefonie stojący cel jest łatwy dla wspomagania celowania (ADR-0072), a sześć luf naraz trudne do odczytania na małym ekranie.

## Cele
1. **Czytelna i sprawiedliwa walka na telefonie.** Gracz widzi, kto do niego strzela i kiedy ma okno na odpowiedź: przeładowanie, przerwa między seriami, zmiana pozycji. Naraz strzela do niego ograniczona liczba wrogów.
2. **Zagrożenie z pojedynczego wroga.** Bierny gracz przeciw jednemu gangerowi Hebi ginie w kilkanaście sekund, nie w pół minuty. Wróg porusza się tak, że trzeba go śledzić celownikiem.
3. **Krzywa trudności, która coś zmienia.** Opowieść, Normalny i Trudny różnią się zachowaniem wroga, nie tylko mnożnikiem zdrowia. Postęp przez pasma przynosi wrogów, którzy grają inaczej.
4. **Bez regresji:** determinizm, zapis, budżet kroku sim i skradanie z ADR-0069 bez zmian w zachowaniu niezaalarmowanego wroga.

### Proponowane cele liczbowe (Normalny, wróg w paśmie, broń gracza jego poziomu)
Do decyzji użytkownika (pytanie 2). Mierzy je bot z opóźnieniem reakcji (opis w „Testach”), nie bot z idealnym celem, bo ruch wroga ma działać przez trafienia.

| Wróg | Gracz zabija (dziś) | Cel | Bierny gracz ginie (dziś) | Cel |
|---|---|---|---|---|
| `hebi_ganger` | 0,9-1,15 s | 1,8-3 s | 57-104 s | 10-14 s |
| `hebi_enforcer` | 1,4-2,0 s | 3-4,5 s | 27-57 s | 6-9 s |
| `tessen_guard` | 1,4-2,0 s | 3-4,5 s | 21-53 s | 7-10 s |

Kolumny „dziś” pochodzą z testu tempa z etapu 1 (`packages/sim/test/combat-pace.test.ts`, #684, 17.11). Bot reaguje w nim z opóźnieniem 0,15 s, wróg jest sam w odległości 20 m, sceny to Plac Litewski i podwórze W-3, ziarna 1-3, a gracz i jego broń mają poziom z pasma. Audyt z góry („Liczby z audytu”) grał graczem poziomu 1 przeciw wrogom poziomu 16 i stąd jego krótsze zgony: tym samym botem wychodzi Hebi 1,4-1,7 s i 39-48 s, Tessen 2,3-3,1 s i 9-13,5 s. W paśmie bierny gracz żyje 2-3 razy dłużej, więc cele zgonu wymagają w etapie 5 większej zmiany, niż zakładał projekt. Trudny daje dziś zgon w 0,4-0,7 czasu z Normalnego (cel najwyżej 0,65), a zabicie w 1,0-1,3 (cel co najmniej 1,25).

Trudny: czas zgonu biernego gracza najwyżej 0,65 czasu z Normalnego, czas zabicia co najmniej 1,25. Opowieść: czas zgonu co najmniej 1,6 czasu z Normalnego.

## Warianty

### A. Tylko liczby i zasięg do broni
- Każda broń NPC dostaje pasmo walki `combatRange { min, max }` w profilu `npc` (`core/src/items/catalog.ts`), np. shotgun 4-10 m, SMG 7-15 m, pistolet 10-20 m, karabin 14-24 m. `attackRange` liczy się z `max`, a pościg kończy się na `max`, nie na 15 m. To naprawia klasę G-917 dla każdej broni.
- Strojenie liczb pod cele: obrażenia i kadencja NPC, `NPC_CRIT`, zdrowie bazowe typów w `ENEMY_TYPES`, wartości presetów `DIFFICULTY_PRESETS`.
- **Koszt:** 2 PR-y (pasma broni, strojenie z testem tempa). Mały.
- **Ryzyko:** niskie technicznie. Projektowo: cel 2 osiągamy tylko większymi obrażeniami, więc kilku wrogów naraz staje się jeszcze ostrzejszych (G-909 się pogłębia). Cel 3 nie jest spełniony, bo wróg dalej stoi, a trudność to dalej liczby. Na telefonie stojący cel dalej przyciąga celownik.

### B. A plus ruch do pasma broni, ruch boczny, krótkie przerwy i żetony ataku
Wszystko z A, a do tego nowe zachowania zaalarmowanego wroga z bronią palną:
- **Utrzymanie pasma:** poza `max` podchodzi (jak dziś `ChasePlayer`), poniżej `min` cofa się o krok od gracza, jeśli za nim jest przejście (`walk-blocked` z ADR-0080 i `straightWalk`). Shotgun podchodzi, karabin trzyma dystans.
- **Ruch boczny:** w paśmie wróg przesuwa się w bok względem gracza odcinkami 1,5-3 m z prędkością ok. 0,6 `GANGER_SPEED`, cały czas z twarzą do gracza i strzelając. Kierunek i długość odcinka losuje w chwili decyzji (`ctx.rng`), nie w każdym kroku. Odcinek, który wchodzi w pryzmat, wodę albo na uskok, odpada i wróg próbuje drugiej strony, a gdy obie są zamknięte, stoi.
- **Krótkie przerwy:** po serii (2-4 strzały, zależnie od broni) wróg robi przerwę 0,6-1,2 s bez strzału, a przeładowanie (`magazine` z profilu NPC) trwa naprawdę i jest widoczne. To okna gracza.
- **Żetony ataku:** naraz do gracza strzela najwyżej N wrogów (Normalny 2). Żeton dostają najbliżsi z czystą linią, w kolejności tworzenia przy remisie, i trzymają go co najmniej 2 s. Wróg bez żetonu nie strzela, tylko przesuwa się na pozycję rozstawioną wokół gracza (punkt w paśmie broni przesunięty o 35-60° od kierunku najbliższego strzelca), więc grupa rozchodzi się na boki zamiast stać w jednym rzędzie. To lekkie flankowanie bez danych o osłonach.
- **Trudność:** nowe pole profilu `npcPressure` (Opowieść 0,6, Normalny 1, Trudny 1,5). Liczba żetonów to `clamp(round(2 × npcPressure), 1, 4)`, czyli 1, 2 i 3; przerwy dzielą się przez `npcPressure`, a ruch boczny ma częstość mnożoną przez nie. Na Opowieści strzela naraz jeden wróg.
- **Poziom i typ:** zestaw zachowań zależy od typu i od stopnia wroga w paśmie, a nie od liczb: Hebi w dolnej połowie pasma (nowicjusze) trzyma pasmo i robi długie przerwy, w górnej dochodzi ruch boczny i rozstawienie; Tessen i elity mają pełny zestaw od początku. Liczby zostają płaskie, więc test balansu ADR-0059 zostaje bez zmian.
- **Bez zmian:** wróg z bronią białą (brawler) dostaje tylko żetony (najwyżej jeden naraz w zwarciu) i dzisiejsze `MELEE_REST`; snajper bez zmian; niezaalarmowany wróg i całe skradanie z ADR-0069 bez zmian.
- **Koszt:** 5 PR-ów w `sim` (właściciel AI / NPC) i po jednym w `core` (pasmo broni i pole trudności, zmiana kontraktu komendy `set-difficulty`), `persistence` (migracja) i `ui` (suwak, i18n). Średni.
- **Ryzyko:** średnie. Ruch boczny to nowe miejsca na glitche ruchu (krawężniki, płoty, kładki, poziomy), więc każdy etap ma testy na podłodze testowej i na scenach z kłopotami ruchu (płot Bystrzycy, schody z wiaduktu Zamkowej z G-255). Złote hashe zmieniają się w każdym etapie zachowania. Renderer musi pokazać krok boczny bez „ślizgu” (do sprawdzenia w `character-rig.ts`; jeśli rig nie ma kroku bocznego, osobny PR w obszarze Rendering).

### C. B plus osłony z punktów osłon w treści
Wszystko z B, a do tego:
- **Punkty osłon:** w treści `sim` lista punktów z kierunkiem osłony i wysokością (niska 0,9-1,2 m: kucanie i wychylenie nad; wysoka: wychylenie w bok). Źródła do wyboru: ręcznie w scenach zleceń (W-3 ma wóz opancerzony i palety części) albo generator z pryzmatów (`tools/osm-import`, tablica `*.generated.ts` przeliczana w jobie `tables` z ADR-0083: samochody, bariery, kontenery, murki).
- **Zachowanie:** wróg bez żetonu albo z niskim zdrowiem idzie do najbliższego wolnego punktu w paśmie broni, który zasłania go od gracza (jeden promień gracz-punkt) i ma wychylenie z linią do gracza (drugi promień). W osłonie: chowa się, wychyla na serię, chowa na przerwę. Punkt rezerwuje jeden wróg.
- **Flankowanie:** gdy gracz siedzi w osłonie dłużej niż ok. 4 s, jeden wróg bez żetonu idzie do punktu z kątem co najmniej 60° od osłony gracza (gracz nie ma dziś mechaniki osłony, więc „osłona gracza” to brak linii od strzelców z żetonem).
- **Koszt:** dodatkowe 3-4 PR-y (dane W-3, zachowanie, generator dla miasta, flankowanie). Duży.
- **Ryzyko:** wysokie. Dane osłon dla całego miasta to nowy rodzaj treści do pilnowania skanem (punkt w ścianie, w wodzie, zasłonięty z obu stron). Wybór osłony kosztuje promienie i trzeba go rozkładać na kroki. Najwięcej nowych stanów AI do testów i do zapisu.

## Rekomendacja
Wariant B teraz, a C dopiero po pomiarach B i najpierw tylko w W-3 z ręcznymi punktami osłon. B spełnia wszystkie cztery cele bez nowej treści: pojedynczy wróg staje się zagrożeniem przez to, że strzela z pasma swojej broni i trzeba go śledzić, a nie przez większe obrażenia; żetony i przerwy robią z sześciu luf w W-3 walkę do odczytania na telefonie; trudność dostaje pole, które zmienia zachowanie (Opowieść: jeden strzelec, Trudny: trzech i krótkie przerwy). A jest za mały, bo zostawia działka i pogłębia G-909. C daje najwięcej, ale jego koszt leży w danych i budżecie, a bez B nie ma na czym go zbudować. Liczby zostają płaskie w paśmie (ADR-0059), a krzywa postępu idzie przez zestaw zachowań według typu i stopnia w paśmie.

G-917 i G-909 idą przed tym ADR-em osobno, jak w backlogu: G-917 jako mała poprawka `attackRange` (pasmo broni z etapu 2 ją później uogólnia), G-909 przez zapis startowy poziomu 12 z ADR-0082.

## Wpływ

### Determinizm
- Losowość tylko z `ctx.rng` (`RandomPort`), bez `Math.random` i zegara. Losowanie tylko w chwili decyzji (odcinek ruchu bocznego, długość przerwy, długość serii), czyli ok. raz na 1,5-3 s na wroga, nie co krok.
- Każde nowe losowanie przesuwa wspólny ciąg `rng`, więc zmienia też rozrzut kolejnych strzałów. Złoty hash w `packages/sim/test/determinism.test.ts` (dziś `936bb239`) i drugi hash dla Trudnego zmieniają się świadomie w każdym etapie zachowania (2, 3, 4, 5), z powodem w commicie. Etap 1 (testy) i strojenie bez zmiany reguł hashy nie zmieniają.
- Żetony przydziela się deterministycznie: odległość, potem kolejność tworzenia (`inCreationOrder`), bez losowania.
- Zmiana pasma broni w A dla `hebi_ganger` (SMG 18 m) może zostawić `attackRange` 15 m, więc hash podłogi może się nie zmienić; sprawdzi to PR.

### Budżet kroku sim
- Odniesienie z ADR-0043: 10 zaalarmowanych gangerów na terenie z pryzmatami 0,51-0,54 ms na krok, test pada powyżej 4 ms.
- B dokłada na zaalarmowanego wroga najwyżej jedno sprawdzenie odcinka ruchu (`straightWalk` na krótkim odcinku) na krok, a decyzje z promieniem linii wzroku (nowa pozycja rozstawienia, wybór strony) idą z kolejki: najwyżej 2 decyzje na krok dla wszystkich wrogów, w kolejności tworzenia, jak plasterki planów pościgu (G-643, `PLAN_WORK`). Szacunek: do +0,1 ms na krok przy 10 wrogach.
- C: przy decyzji najwyżej 8 kandydatów po 2 promienie, najwyżej 2 decyzje na krok, czyli do 32 promieni na krok w najgorszym razie; indeks punktów osłon budowany przy wczytaniu chunka.
- Bramką są liczby, nie milisekundy (jak `barrier-chase-budget.test.ts`): liczba sprawdzeń odcinków i promieni na krok w scenie z 10 i 18 zaalarmowanymi wrogami. Czas kroku tylko raportujemy.

### Zapis
- B wprowadza stan, którego nie da się odtworzyć z komponentów: bieżący manewr wroga (`tactic`: rodzaj, strona, tick końca, pozostała seria, tick utraty żetonu). Bez zapisu wczytana gra rozjeżdża się z grą bez wczytania (jak G-913), więc trafia do `EntitySnapshot` jako pole opcjonalne `tactic`.
- Etap 3 podbija `SAVE_SCHEMA_VERSION` (z 43 albo z wersji aktualnej w chwili budowy) i dodaje migrację w `packages/persistence/src/migrations.ts` z testem: stary zapis nie ma `tactic`, więc wróg podejmuje nową decyzję w pierwszym kroku (jak `walk` bez planu).
- Etap 5 dodaje pole `npcPressure` do `DifficultyProfile`. `isDifficultyProfile` wymaga każdego pola, więc to zmiana schematu z migracją: profil równy dawnemu presetowi dostaje wartości nowego presetu (zapis „Trudny” zostaje „Trudnym”, a nie „Własnym”), każdy inny dostaje `npcPressure` 1. To samo dla `pendingDifficulty` (v20, G-171).
- Żetonów nie zapisujemy: liczą się co krok z odległości, a ich minimalne trzymanie siedzi w `tactic`.
- C dodaje do `tactic` indeks zarezerwowanego punktu osłony; same punkty to treść, nie zapis.

### Kontrakty i granice pakietów
- `core/src/commands`: `set-difficulty` niesie pełny profil, więc nowe pole to zmiana kontraktu (Architekt).
- `core` (Core Domain): `combatRange` w profilu broni NPC, pole i presety w `core/src/difficulty`.
- `core/src/events`: tylko gdy użytkownik zechce odzywek (pytanie 8): `NpcReaction` dostaje np. `"reload"` i `"flank"`.
- `ui`: suwak „Własny”, opis presetów. Teksty jako klucze w `packages/ui/src/i18n/{en,pl}/difficulty.ts`: `difficulty.field.npcPressure` i zmieniony opis `difficulty.desc.story` oraz `difficulty.desc.hard`. Polski katalog zmieniamy świadomie, razem z angielskim.
- Odzywki, jeśli będą, jako klucze `bark.hebi.reload`, `bark.hebi.flank`, `bark.tessen.reload`, `bark.tessen.flank` w obu katalogach.

## Testy
Wszystko bez renderera (ADR-0046): `freeze` + `step`, czekanie na stan gry, nie na zegar.
- **Test tempa walki** (`packages/sim/test/combat-pace.test.ts`, etap 1): sonda z audytu jako test. Bot gracza celuje w klatkę wroga z opóźnieniem reakcji ok. 0,15 s (cel z pozycji sprzed kilku kroków) i rozrzutem swojej broni; Plac Litewski i podwórze W-3 (`difficulty-scenes.ts`), ziarna 1-3, wróg sam. Mierzy czas zabicia i czas zgonu biernego gracza dla `hebi_ganger`, `hebi_enforcer`, `tessen_guard`, na trzech presetach. W etapie 1 zapisuje dzisiejsze liczby, od etapu 5 pilnuje celów z tabeli.
- **Pasmo broni** (etap 2): wróg z każdą bronią NPC kończy w swoim paśmie w ciągu 5 s od alarmu, z 4 m i z 30 m; test przyjęcia G-917 (Enforcer na 13 m przy stojącym graczu zadaje obrażenia w 30 s) zostaje zielony.
- **Ruch boczny** (etap 3): zaalarmowany wróg w paśmie przesuwa się w bok co najmniej 2 m w 5 s, nie wychodzi z pasma, nie wchodzi w pryzmat ani do wody i zmienia kierunek najwyżej 2 razy na 3 s. Te same przypadki na scenach z dawnymi glitchami ruchu (płot Bystrzycy z `barrier-floor.ts`, schody z wiaduktu Zamkowej z G-255).
- **Przerwy** (etap 3): w każdym oknie 4 s walki jest co najmniej jedna przerwa bez strzału dłuższa niż 0,6 s na Normalnym (na Trudnym 0,4 s).
- **Zapis w manewrze** (etap 3): `snapshot` w połowie odcinka ruchu bocznego i w przerwie, `fromSnapshot`, 600 kroków: hash równy grze bez wczytania. Migracja: zapis v43 bez `tactic` wczytuje się i wróg walczy.
- **Żetony** (etap 4): 6 zaalarmowanych strażników Tessen: w każdym kroku strzela najwyżej 2 na Normalnym, 1 na Opowieści, 3 na Trudnym; wrogowie bez żetonu rozchodzą się na kąt co najmniej 35° od najbliższego strzelca. Scena drogi głośnej W-3 na poziomie 12 (`packages/app/test/w3-sabotage-loud-session.test.ts`) przechodzi z botem gracza.
- **Trudność** (etap 5): dla `npcPressure` ten sam scenariusz z 0,6 i 1,5 daje wynik w oczekiwanym kierunku (jak testy pól ADR-0066 w `difficulty.test.ts`); migracja profilu „Trudny” zostaje „Trudnym”; test sesji `packages/app/test/difficulty-session.test.ts` i test komponentu suwaka w `packages/ui/test`.
- **Budżet** (etapy 3 i 4): liczby sprawdzeń odcinków i promieni na krok przy 10 i 18 wrogach, jak `barrier-chase-budget.test.ts`.
- **Bez zmian:** `balance.test.ts` (ADR-0059) i `stealth-balance.test.ts` zostają zielone bez zmiany progów. Skradanie z ADR-0069 nie zmienia czasów wykrycia.
- Przeglądarka tylko w razie zmiany riga w rendererze (krok boczny) i do oglądania nagrania walki na telefonie.

## Etapy wdrożenia (osobne PR-y; zachowanie AI zawsze osobno)
0. Przed ADR-em, poza nim: G-917 (mała poprawka `attackRange`) i G-909 (zapis startowy poziomu 12 z ADR-0082).
1. Test tempa walki z botem z opóźnieniem reakcji. Tylko testy, bez zmian reguł i hashy.
2. Pasmo broni NPC (`combatRange` w `core`) i utrzymanie pasma w drzewie (podejście, cofnięcie). Złote hashe.
   Zrobione 17.11: pasmo to `npc.band` w `core/src/items/catalog.ts` (czytane przez `npcBand`), z wartościami z wariantu A; snajper (`kagero_dmr`) pasma nie ma. `attackRange` liczy się z `max`, a strzelec bliżej niż `min` cofa się w `ShootAtPlayer` krokami po 1 m z prędkością 0,6 `GANGER_SPEED` (`backOff` w `ganger-walk.ts`), jeśli `straightWalk` puszcza. Test przyjęcia: `packages/sim/test/weapon-band.test.ts`. Dwa przejścia nie mieszczą się w 5 s przy obecnych prędkościach (shotgun z 30 m do 10 m, karabin z 4 m do 14 m), więc dostają czas przejścia i sekundę na reakcję. Złoty hash podłogi się zmienił, a zraniony ganger z podłogi ma 6 PD zamiast 12, żeby przebieg dalej kończył się zabiciem.
3. Ruch boczny i przerwy: stan `tactic`, zapis i migracja, testy zapisu i ruchu. Złote hashe. Jeśli rig nie ma kroku bocznego: osobny PR w Rendering.
   Zrobione 17.11 (`ganger-tactic.ts`): w walce z graczem strzelec w paśmie po odcinku 1,5-3 m z prędkością 0,6 `GANGER_SPEED` stoi 0,7-1,3 s, więc zmienia kierunek najwyżej dwa razy na 3 s. Kierunek i długość losuje `ctx.rng` w chwili decyzji, a drogę sprawdza jedno `straightWalk` na stronę. Seria to `npc.burst` broni (pistolet i shotgun 2, SMG 4, karabin 3), po niej przerwa 0,6-1,2 s ponad odstęp broni. Strzelec, który strzela do ofiary (napad, zasadzka), robi jak dotąd, bez serii i kroków. Stan `ai.tactic` jest w zapisie (`EntitySnapshot.tactic`, v45, migracja bez zmian danych), a przy zasypianiu fragmentu mapy odpada jak broń i chód. Testy: `packages/sim/test/gun-tactic.test.ts` (ruch, przerwy, płot nad Bystrzycą, wiadukt Zamkowej, zapis w manewrze i w przerwie, budżet przy 10 i 18 wrogach) i `packages/persistence/test/tactic-save.test.ts`. Testy, które zakładały stojącego strzelca albo przypadek losowania, sprawdzają teraz stan zamiast pozycji (G-377 przy wstrzymanym kroku, zakleszczone posiłki G-208 przy oślepionych, napad G-240 i G-242 bez osób, których zapis nie obejmuje). Rig postaci nie ma kroku bocznego (`character-animation.ts` gra cykl chodu przodem), więc krok w bok wymaga osobnego PR-u w Rendering.
4. Żetony ataku i rozstawienie wokół gracza. Złote hashe, budżet.
5. Trudność i krzywa: pole `npcPressure` (kontrakt komendy, migracja, UI, i18n en i pl), zestawy zachowań według typu i stopnia w paśmie, strojenie liczb pod cele z testem tempa. Złote hashe obu presetów.
6. Opcjonalnie (pytanie 8): odzywki przy przeładowaniu i rozstawieniu, `NpcReaction`, i18n.
7. Wariant C, jeśli użytkownik go zechce po pomiarach B: punkty osłon w W-3 ręcznie, zachowanie „osłona, wychylenie, seria”; potem generator punktów z pryzmatów dla miasta z kontrolą w skanie glitchy; na końcu flankowanie gracza w osłonie.

## Konsekwencje
- Wróg w walce przestaje stać. Testy sesji i e2e, które zakładają wroga w stałym miejscu (np. strzał w nieruchomy cel po alarmie), mogą wymagać krokowania do stanu („wróg w paśmie”, „wróg w przerwie”) zamiast pozycji.
- Walka trwa dłużej, więc zmienia się dochód na minutę zleceń bojowych (ADR-0018, ADR-0024, ADR-0082: pasmo ok. 215-230 €$/min). Test ekonomii (`packages/core/test/m4-balance.test.ts`, z W-3 według ADR-0082) trzeba przeliczyć w etapie 5.
- Wspomaganie celowania na dotyku (ADR-0072, spowolnienie nad celem) zaczyna mieć znaczenie, bo cel się rusza. Siła domyślna może wymagać strojenia po etapie 3.
- Każdy nowy system z liczbami walki musi wskazać pole profilu trudności, które go dotyczy (zasada ADR-0066), więc `npcPressure` staje się jedynym miejscem na „agresję” wroga.
- Liczby w tabelach są startowe. Ich strojenie po etapie 5 nie wymaga nowego ADR-u, zmiana celów tempa walki wymaga decyzji użytkownika.

## Pytania do użytkownika
1. Który wariant: B (rekomendowany), tylko A, czy od razu C?
2. Czy cele tempa walki z tabeli są dobre (Hebi: gracz zabija w 1,8-3 s, bierny gracz ginie w 10-14 s; Tessen 3-4,5 s i 7-10 s; Trudny co najmniej 1,25 i najwyżej 0,65 tych czasów)? Czy dłuższy czas zabicia ma przyjść tylko z ruchu wroga, czy wolno też podnieść zdrowie wrogów, co zmienia dochód na minutę zleceń?
3. Krzywa postępu: zostawić płaskie liczby w paśmie (ADR-0059) i różnicować wrogów zachowaniem według typu i stopnia w paśmie (rekomendacja), czy chcesz, żeby walki w górze pasma były też liczbowo trudniejsze?
4. Czy zgadzasz się na nowe pole trudności `npcPressure` (liczba strzelających naraz, przerwy, ruch boczny), widoczne jako suwak w „Własnym”, z jednym strzelcem naraz na Opowieści?
5. Ilu wrogów może strzelać naraz na Normalnym: 2 (rekomendacja), czy 3 jak fala W-3?
6. Gracz poniżej pasma (G-909: poziom 6 w paśmie 10-30): zostaje „mocniejszy świat” i naprawiamy tylko zapisem startowym, czy poziom wroga ma się trzymać bliżej gracza (np. najwyżej +3)?
7. Czy zwykli wrogowie mają widoczny znak przed serią (krótkie celowanie, jak laser snajpera, ale słabszy)? To zmiana `ViewDescriptor` i praca w rendererze.
8. Odzywki przy przeładowaniu i rozstawieniu: w tym ADR-ze (etap 6), czy razem z reakcją grupową, którą ADR-0069 odłożył?
9. Jeśli C: osłony najpierw tylko w W-3 i scenach zleceń (rekomendacja), czy od razu w całym mieście z generatora?

## Decyzje użytkownika (17.11, po przyjęciu wariantu B)
- **Pytanie 2:** cele tempa walki z tabeli zostają. Dłuższy czas zabicia ma wynikać tylko z ruchu wroga (pasmo broni, krok w bok, przerwy). Zdrowie wrogów zostaje bez zmian.
- **Pytanie 5:** na Normalnym strzela naraz 2 wrogów, na Opowieści 1, na Trudnym 3.
- **Pytanie 6:** świat zostaje mocniejszy. Poziom wroga trzyma się pasma (ADR-0059), a gracz poniżej pasma ma w wycinku zapis startowy (G-909).
- **Pytanie 7:** znak przed serią będzie, ale jako osobny etap po ruchu i żetonach (po etapach 3-4), kiedy pomiar pokaże, czy walka jest czytelna bez niego.
- Otwarte przed etapem 5: pytania 3 (krzywa w paśmie), 4 (pole `npcPressure` jako suwak) i 8 (odzywki).
