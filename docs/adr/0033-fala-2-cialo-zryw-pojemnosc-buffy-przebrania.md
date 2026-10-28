# ADR-0033: Fala 2 w symulacji (sim A): zryw, odbijanie pocisków, pojemność cyberware, buffy, przebrania

## Kontekst
ADR-0032 ustalił kontrakty fali 2. Ten ADR opisuje część „ruch, walka, ciało” w `packages/sim` i reguły w `packages/core`: liczby, kolejność systemów, zapis i wpływ na złote hashe. HUD (ikony buffów, pasek pojemności, wskaźnik przebrania i egzekutora) i efekty (zryw, odbicie, wygląd przebrań) robią app, UI i engine.

## Decyzja: kolejność systemów
`createSystems()`: `clock, streaming, interpolation, ability, body, item, player-control, perk, ladder, …` (reszta jak w ADR-0029).
- `body` po `ability`: buffy, regeneracja, rola przebrania i raport pojemności.
- `perk` zaraz po sterowaniu gracza: zryw nadpisuje prędkość, o którą prosi gałka, zanim ruszy drabina i ruch.

## Decyzja: zryw
- Implant **Ścięgna Kitsune** (`kitsune_tendons`): 950 €$, pojemność 6, chód +0,2 m/s, perk `dash`.
- Slot: istniejący `skeleton`, bez nowego slotu `legs`. Uzasadnienie:
  - UI ma wyczerpującą mapę slotów (`trade-tabs.tsx`), a nowy slot wymagałby zmiany w cudzym pakiecie;
  - ścięgna i stawy to część szkieletu;
  - zryw konkuruje ze splotem podskórnym (pancerz +4), więc wybór „ruch albo pancerz” jest decyzją o buildzie.
  - Osobny slot `legs` można dodać później razem z UI.
- Liczby:
  - `DASH_SPEED` 14 m/s przez `DASH_TIME` 0,18 s, czyli ok. 2,5 m, w kierunku gałki względem patrzenia (bez gałki prosto);
  - `DASH_COOLDOWN` 1,5 s, z `quick_cooldown` ×1,5 szybciej (1 s);
  - `DASH_IFRAMES` 0,3 s: pociski (broń palna) nie trafiają, ciosy wręcz tak.
- Zryw w powietrzu: raz na pobyt w powietrzu, odnawia się na ziemi. Na starcie wstrzymuje opadanie (`fall` = max(fall, 0)), a na końcu prędkość pozioma spada do `DASH_EXIT_SPEED` 6 m/s.
- Bez zrywu: na drabinie, w trakcie przeskoku na krawędź, w zachwianiu, w dialogu i po śmierci.
- Emituje `Dashed { air }`.
- Stan (`Entity.perks`) jest przejściowy: wczytana gra ma zryw gotowy.

## Decyzja: odbijanie pocisków
- Implant **Odruch Tsubame** (`tsubame_reflex`): 1150 €$, pojemność 8, slot `arms`, perk `deflect`. Konkuruje ze stabilizatorem chwytu.
- Warunki odbicia:
  - pocisk trafia gracza w łuk bloku bronią białą (ten sam test co blok z ADR-0019);
  - wytrzymałość jest powyżej `DEFLECT_THRESHOLD` = 1/3.
- Co się dzieje z pociskiem:
  - nie rani gracza;
  - leci hitscanem z punktu celowania gracza w kierunku `yaw`/`pitch` obrońcy, czyli tam, gdzie celownik, na zasięg broni strzelca;
  - kto stoi na linii, dostaje obrażenia broni (profil NPC), mnożnik strefy i swój pancerz, bez krytyka, od gracza.
- Losowość: jedna liczba w `resolveAttack` przez `RandomPort`, jak każde trafienie, bez nowego strumienia.
- Wytrzymałość: nowy, przejściowy stan 0..1 tylko dla odbicia.
  - `DEFLECT_COST` 0,12 na naciśnięcie spustu, dzielone między śruciny.
  - Wraca 0,35/s przy opuszczonej gardzie, przy podniesionej wcale.
  - Z pełnej starcza na 6 odbić, potem ostrze tylko blokuje (×0,7, ADR-0019).
- Emituje `ProjectileReflected { at, to, hitEntity }` oraz `DamageDealt` od gracza.

## Decyzja: pojemność cyberware
- Koszt w `CYBERWARE_CATALOG.capacity`:

| Implant | Slot | Koszt |
|---|---|---|
| Optyka Hitomi Mk1 | optics | 2 |
| Stabilizator chwytu | arms | 3 |
| Splot podskórny | skeleton | 4 |
| Wzmacniacz synaps | nervous | 5 |
| Ścięgna Kitsune | skeleton | 6 |
| Akcelerator Kairos | nervous | 7 |
| Odruch Tsubame | arms | 8 |

- Pula `capacityMax`:
  - `BASE_CYBER_CAPACITY` 12;
  - +3 przy 3, 6 i 10 ukończonych zleceniach (najwyżej 21);
  - +2 za każdy shard pojemności (`SHARD_CYBER_CAPACITY`).
- Najpełniejszy build to 23 (2 + 7 + 6 + 8): po wszystkich progach brakuje jednego sharda.
- Na start mieści się optyka i jeden duży implant (2 + 7 ≤ 12), ale nie dwa.
- Montaż ponad pulę (zakup u Mori i implant z plecaka) odrzuca nowy `PurchaseFailure` `"over-capacity"`, zanim pobierze pieniądze. Zamiana na mniejszy implant przechodzi zawsze, także gdy stary zapis jest ponad pulą.
- **Shard pojemności** (`capacity_shard`):
  - materiał eksploatacyjny za 450 €$, czyli ok. jedno zlecenie z targu;
  - jest w sklepie kliniki i w łupie Tessen (waga 1 na 99);
  - łup Hebi bez zmian, żeby nie ruszać balansu z E10 i strumienia replayu;
  - użyty z plecaka zwiększa `DomainState.capacityShards`.
- `CyberwareCapacityChanged { used, max }` idzie w pierwszym kroku (nowa i wczytana gra) i przy każdej zmianie: implant, shard, ukończone zlecenie.

## Decyzja: buffy
- `BUFF_CATALOG` w `core/src/abilities/buffs.ts`:

| Buff | Źródło | Czas | Działanie |
|---|---|---|---|
| `regen` | ramen (35 €$, nadal +30 HP od razu) | 120 s | 0,5 HP/s, całe punkty, razem 60 HP |
| `quick_cooldown` | kawa syntetyczna (40 €$, budka Fumiko) | 90 s | odnowienie zdolności i zrywu ×1,5 |
| `steady` | stymulant Shizuka (70 €$, klinika) | 60 s | stabilność celowania +0,2 (limit 0,6 bez zmian) |

- Ponowne użycie odświeża czas do pełnej dawki, bez kumulacji.
- Stan: `DomainState.buffs` (id i sekundy), w zapisie.
- Regeneracja liczy całe punkty po sekundach pozostałych, więc suma nie zależy od kroku, a zdrowie zostaje liczbą całkowitą.
- Zdarzenia:
  - `BuffApplied` z sekundami pozostałymi, gdy buff się pojawi (zjedzony albo trwający po wczytaniu) albo zostanie odświeżony;
  - `BuffEnded` po upływie czasu.
- Napój i shard można użyć przy pełnym zdrowiu (`needsWounds` w core).
- Uwaga dla UI: `ui/src/inventory/actions.tsx` blokuje „Użyj” przy pełnym HP dla każdego materiału. Powinno pytać `needsWounds(id)`.
- Balans (`core/test/wave2-balance.test.ts`):
  - ramen daje razem więcej niż apteczka, ale najwyżej 2,5 apteczki i poniżej 1 HP/s;
  - odnowienie Kairosa z kawą (10,7 s) jest dalej dłuższe niż dwa czasy działania;
  - stymulant działa słabiej niż stabilizator chwytu;
  - napoje są tańsze od apteczki.

## Decyzja: przebrania
- `GarmentDefinition.disguise`:

| Ubranie | Rola | Skąd |
|---|---|---|
| kurtka Hebi | `hebi` | łup Hebi i Oyaji |
| mundur ochrony Tessen | `tessen_guard` | łup Tessen, waga 4, pancerz tors 2, ręce 1 |
| kombinezon personelu Tessen | `tessen_staff` | łup Tessen, waga 2, pancerz tors 1 |

- Rolę ustawia ubranie założone na tors. `DomainState.disguise { role, blown }` jest w zapisie. Zmiana roli emituje `DisguiseChanged` i czyści zdemaskowanie. Pierwszy krok ogłasza noszone przebranie.
- Ludzie frakcji przebrania (gangerzy i strażnicy, snajper):
  - nie alarmują się na widok gracza;
  - nie dają heat kontaktu, więc pościg przechodzi w szukanie;
  - snajper nie celuje.
- Kamera strefy zakazanej przepuszcza `tessen_staff`: personel ma wstęp do biura. Mundur strażnika nie ma wstępu.
- **Egzekutorzy** (`GangerAi.enforcer`, `ViewDescriptor.enforcer` dla HUD) są ustalani z klucza przy spawnie, więc nie wchodzą do zapisu:
  - w ekipie zlecenia (`<id>-g<n>`) u Tessen pierwszy posterunek, czyli szef zmiany (w biurze to strażnik nad salą), a u Hebi `n % 3 == 0`;
  - poza zleceniem co trzeci Hebi według skrótu FNV klucza.
- Podejrzenie (`ai.suspicion`, ten sam pasek co u strażnika z ADR-0024) rośnie tylko u egzekutora albo przy czynie zabronionym w polu widzenia. Czyny zabronione:
  - dobyta broń;
  - sprint albo zryw;
  - obecność w aktywnej strefie zakazanej tej frakcji bez wstępu.
- Tempo przyrostu: egzekutor 0,4/s, czyn zabroniony 1,4/s, oba razy (1,5 − odległość/zasięg wzroku). Spadek 0,5/s.
- Liczby z testów: szef zmiany z 6 m demaskuje spokojnego gracza po ok. 2,1 s, a dobyta broń z 6 m po ok. 0,6 s.
- AI, które już walczy (strzał, trafienie, fala), widzi przez przebranie od razu.
- Pełne podejrzenie emituje `DisguiseBlown`, liczy się jak wykrycie (licznik `detected` zlecenia) i działa do zmiany ubrania. Dalej obowiązują zwykłe reguły z ADR-0024 i ADR-0029.
- Doki dostają trzecią drogę do biura Tessen: w kombinezonie personelu z bronią w kaburze, z dala od szefa zmiany.

## Zapis
- `SAVE_SCHEMA_VERSION` z 11 na 12, z polami `buffs`, `capacityShards` i `disguise`.
- Migracja: brak buffów, zero shardów, brak przebrania. Rolę ustala pierwszy krok z noszonego ubrania.
- Walidacja:
  - buffy: znane id, sekundy > 0, bez powtórzeń;
  - shardy: liczba całkowita ≥ 0;
  - rola: znana albo null.
- Testy w `persistence/test/save-codec.test.ts`.

## Konsekwencje
- Złote hashe zmieniają się tylko przez nowe pola zapisu:
  - replay `d9a66304` na `6523560f`;
  - pojedynek `5be082e2` na `a7a1a5c1`.
  - Test treści po zdjęciu pól v12 (i z wersją 11) dalej daje `bef1026f`, więc przebieg się nie zmienił.
- Reguły fali 2 hashy nie ruszają: replay nie używa implantów, buffów ani przebrań.
- Zmiana poza moim obszarem: jedna linia tekstu odmowy `over-capacity` w `app/src/presenters/trade.ts`, bo mapa jest wyczerpująca.
- Testy:
  - `sim/test/wave2-dash-deflect.test.ts`, `wave2-body.test.ts`, `wave2-disguise.test.ts`;
  - `core/test/wave2-rules.test.ts`, `wave2-balance.test.ts`.
- Na później:
  - osobny slot `legs` z UI;
  - wytrzymałość w HUD;
  - przebrania w kolejnych dystryktach;
  - egzekutorzy w treści (dziś z klucza);
  - zgłoszenia patroli przez przebranie;
  - knoty ink do kwestii egzekutora.
