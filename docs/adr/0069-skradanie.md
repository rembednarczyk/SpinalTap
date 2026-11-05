# ADR-0069: Skradanie: jeden model wzroku, kucanie i słuch dla wszystkich wrogów

Status: proponowana (szkic do akceptacji użytkownika; wynika z G-285).

## Kontekst
Użytkownik zgłosił po testowym przebiegu 4.11 (G-285), że przeciwnicy wykrywają gracza natychmiast, nie da się zakraść, a obezwładnienie (ADR-0065) jest praktycznie niemożliwe. Sprawdziłem to testami `sim` bez renderera (Plac Litewski, ziarno 7, poziom Normalny, wróg 2, 5, 10 i 16 m na północ od gracza, plecami do niej, krok 1/60 s). Mierzyłem czas do `ai.alerted`.

| Wróg | Gracz | 2 m | 5 m | 10 m | 16 m |
|---|---|---|---|---|---|
| `hebi_ganger` | stoi | 0 s | 0 s | 0 s | 0 s |
| `hebi_ganger` | kuca w miejscu | 0 s | 0 s | 0 s | 0 s |
| `hebi_ganger` | idzie w stronę wroga | 0 s | 0 s | 0 s | 0 s |
| `hebi_ganger` | idzie w kucaniu | 0 s | 0 s | 0 s | 0 s |
| `tessen_guard` | stoi | 0,5 s (`GUARD_NEAR`) | nie | nie | nie |
| `tessen_guard` | kuca w miejscu | nie | nie | nie | nie |
| `tessen_guard` | idzie (staje za plecami) | 0,48 s | 1,15 s | 2,35 s | 3,78 s |
| `tessen_guard` | idzie w kucaniu, podpowiedź obezwładnienia | nie, 0,18 s | nie, 1,62 s | nie, 4,0 s | nie (6 s to za mało) |

„Nie” znaczy brak alarmu przez 6 s. Inne pomiary:
- Hebi widzi dookoła na `aggroRange` = 17 m: przy 16 m alarm od razu, przy 18 m brak. Przy wrogiej postawie (`hebi` = -60) zasięg rośnie do 25,5 m (24 m: alarm od razu, 27 m: brak).
- `awareness` z ADR-0066 nie działa na Hebi (0,6, 1 i 1,3 dają 0 s, gdy gracz stoi 5 m przed nim). Strażnik Tessen alarmuje po 0,97, 0,58 i 0,43 s.
- Obezwładnienie strażnika Tessen w kucaniu od tyłu się udaje. Drugi strażnik 6 m dalej, też plecami, nie zauważa nic (podejrzenie 0).
- Ganger Hebi 1,2 m za plecami kucającej Seki jest zaalarmowany już w pierwszym kroku. Podpowiedź obezwładnienia jest dostępna tylko dlatego, że jeszcze się nie odwrócił. Z każdej większej odległości odwraca się, zanim gracz podejdzie.
- Słuchu kroków nie ma. Zaalarmowany ganger nie alarmuje innych. Hałas daje tylko broń (`alertNearbyGangers`: strzał 22 m, tłumik 8 m, wręcz 4 m), a heat daje tropy wsparciu (`runReinforcements`).

Przyczyna „natychmiast” nie jest błędem czujności, tylko brakiem mechaniki. Stożek, kucanie i licznik podejrzeń (ADR-0024) ma wyłącznie ochrona Tessen (`ai.cone`, `factory.ts`). Każdy inny wróg z AI gangera (Hebi: ganger, lookout, enforcer, brawler; Kagami) widzi dookoła i alarmuje w kroku, w którym ma linię wzroku (`perceivePlayer`, `ganger-perception.ts`). Z Hebi gracz styka się najczęściej: zlecenia eliminacji, odzyskanie poza Dokami, posterunki. ADR-0065 nazywa odzyskanie zleceniem skradania, a jego strażnicy to `hebi_ganger`. Kod robi to, co zapisano w ADR-0024, więc to luka projektu, a nie glitch do poprawki. Model wykrywania dla wszystkich wrogów to decyzja użytkownika.

## Decyzja
Zaakceptowana przez użytkownika 4.11 w całości (wzrok i kucanie dla wszystkich wrogów, słuch kroków, bez cienia i reakcji grupowej).
- **Jeden model wzroku dla każdego wroga z AI gangera.** Licznik podejrzeń z ADR-0024 przestaje być wyjątkiem ochrony. Każdy typ wroga ma w `ENEMY_TYPES` (`core/src/items/enemies.ts`) profil wzroku, a `ai.cone` znika na rzecz tego profilu:

  | Pole | Hebi (ganger, lookout, brawler) | Hebi enforcer | Kagami cleaner | Tessen guard (dziś) |
  |---|---|---|---|---|
  | `sight` (m, stojąca) | 17 | 17 | 17 | 18 |
  | `cone` (pół kąta, rad) | 1,2 | 1,05 | 1,05 | 1,05 |
  | `crouchSight` (mnożnik zasięgu) | 0,5 | 0,5 | 0,5 | 0,5 |
  | `near` (m, widzi bez względu na kierunek, chyba że gracz kuca) | 2,0 | 2,2 | 2,2 | 2,2 |
  | `suspicionRate` (/s, przed mnożnikiem odległości) | 2,0 | 1,6 | 1,6 | 1,4 |

  Liczby są startowe, poprawia je etap 8 ADR-0059. Przyrost liczy się jak dziś: `rate × awareness × (1,5 − min(1, d / sight))`, spadek 0,5/s. Ganger Hebi przy 5 m przed sobą alarmuje po ok. 0,4 s, a przy 15 m po ok. 0,8 s. Ulica pozostaje groźna, ale od tyłu i w kucaniu da się podejść.
- **Postawa frakcji** zmienia tylko zasięg (`HOSTILE_AGGRO_MULTIPLIER` = 1,5, jak dziś). Patrol tolerujący neutralną Seki (ADR-0048) dalej tylko patrzy.
- **Zaalarmowany widzi dookoła** (jak dziś strażnik po alarmie). Podejrzenie > 0 obraca wroga w stronę gracza (jak `watch` strażnika), więc obezwładnienie z przodu znika już przy pierwszym podejrzeniu (`awarenessOf` ≠ „unaware”, ADR-0065).
- **Słuch kroków** (nowy, deterministyczny, bez losowania). Gracz w ruchu robi hałas w promieniu zależnym od chodu: sprint 9 m, chód 3,5 m, kucanie 0 m, lądowanie po skoku albo upadku 6 m. Promień liczy się w poziomie i na tym samym poziomie (`LEVEL_GAP`). Hałas nie alarmuje: niezaalarmowany wróg w promieniu dostaje podejrzenie 0,35 i trop (`giveLead`) na pozycję gracza, więc odwraca się i idzie sprawdzić. Hałas broni (`alertNearbyGangers`) zostaje bez zmian. Doprecyzowanie z etapu 3 (5.11): wróg, który w tym kroku widzi gracza, dostaje z hałasu tylko trop, bez podłogi 0,35, bo jego licznik prowadzi już wzrok; dzięki temu sprint na wprost skraca czas wykrycia z etapu 1 najwyżej o jeden krok symulacji (ok. 17 ms), bo z tropem wróg idzie w stronę gracza. Wróg idący do tropu patrzy w kierunku marszu.
- **Bez reakcji grupowej w tym ADR-ze.** Zaalarmowany ganger nie alarmuje innych (dziś też nie). Okrzyk do sąsiadów to osobna decyzja razem z odzywkami (backlog, barki).
- **Cień i światło odłożone.** `sim` nie zna oświetlenia, a latarnie z OSM (ADR-0064) żyją w rendererze. Mnożnik zasięgu za ciemność wymaga danych światła w `sim` i osobnego ADR-u.
- **Trudność:** `awareness` (ADR-0066) działa na każdy licznik podejrzeń, nie tylko na ochronę, a także na podejrzenie z hałasu. Promienie hałasu nie zależą od poziomu.
- **Kamery, cywile i snajperzy bez zmian** (ADR-0029, ADR-0024): mają własne reguły wzroku.
- **Determinizm:** etap 1 i 2 zmieniają przebieg każdej sceny z gangerami, więc złote hashe w `determinism.test.ts` zmieniają się świadomie, z uzasadnieniem w commicie.

## Etapy (osobne PR-y)
1. Profil wzroku w `ENEMY_TYPES` i jeden model wzroku w `ganger-perception.ts` (stożek, kucanie, `near`, licznik, obrót przy podejrzeniu, `awareness`). Te same predykaty dostają `patrolSees` (`crime-system.ts`), skaner (`scanner-system.ts`) i `body-watch`. Testy `sim` dla każdego typu: kucanie od tyłu z 2, 5 i 10 m do obezwładnienia bez alarmu na Normalnym; stanie z przodu 5 m daje alarm do 0,6 s; kucanie z przodu 5 m daje alarm; `awareness` 0,6 i 1,3 przesuwa czas w oczekiwanym kierunku. Kontrola, że każde zlecenie skradania (odzyskanie, infiltracja) da się przejść do celu od tyłu posterunków. Złote hashe.
2. Słuch kroków: hałas gracza z prędkości i postawy, trop i podejrzenie. Testy: chód 3 m za plecami daje odwrócenie bez alarmu, sprint 8 m daje trop, kucanie 1 m nic. Złote hashe.
3. Balans: poprawki słuchu i obrotu do tropu (5.11, PR #268), dalej w etapie 8 ADR-0059 (drzewko Cień: mniejszy hałas, wolniejszy licznik) i odzywki przy podejrzeniu (barki, i18n en/pl).

## Konsekwencje
- Ulica przestaje być „strzelnicą od pierwszej klatki”: wróg z AI gangera daje graczowi ułamek sekundy reakcji, a od tyłu w kucaniu można go obezwładnić. ADR-0065 i XP za skradanie z ADR-0059 zaczynają mieć sens poza Dokami.
- Walka w zleceniach eliminacji zaczyna się później i mniej naraz, więc testy sesji i e2e z walką mogą wymagać pozycji gracza w polu widzenia wroga (krokowanie do alarmu zamiast założenia alarmu w pierwszym kroku).
- Rośnie liczba stanów AI do testów (podejrzliwy po hałasie, odwrócony). Każdy etap ma testy `sim` z `freeze` + `step` (ADR-0046).
- Bez zmiany kontraktów `core/src/{ports,events,commands}`: `AwarenessChanged` i HUD czujności (`heat-hud.ts`) już niosą stan „suspicious” z poziomem.
