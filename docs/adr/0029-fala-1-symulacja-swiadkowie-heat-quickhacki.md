# ADR-0029: Fala 1 w symulacji: ostatnia znana pozycja, tłum i świadkowie, heat, skaner i quickhacki, kamery, warstwa zlecenia

## Kontekst
ADR-0028 ustalił kontrakty fali 1 (zdarzenia, komendę `breach-result`, `InputFrame.scan` i `quickhack`, dane w `core`) i reguły, które implementacja musi zachować. Ten ADR opisuje implementację w `packages/sim` i reguły w `packages/core`: liczby, czasy, promienie, kolejność systemów, zapis. HUD, telefon i minigra Breach Protocol są po stronie `ui` i `app` (inny agent), treść dystryktów po stronie agenta od treści.

Ograniczenia jak zawsze: determinizm (bez `Math.random` i zegara ściennego, losowość tylko przez `RandomPort`), zapis w trakcie gry kontynuuje się identycznie, koszt na klatkę rozsądny.

## Decyzja: kolejność systemów
`createSystems()`:
`clock, streaming, interpolation, ability, item, player-control, ladder, schedule, scanner, ganger-ai, sniper-ai, civilian-ai, escort-ai, elevator, movement, weapon, melee, combat, interaction, death, crime, loot, contract, contract-layer, quest`.

- `scanner` przed AI: efekt hacka (ślepota, paraliż, trop) działa w tym samym kroku.
- `crime` po `death`: zabójstwo i jego świadkowie dzielą krok. Szum i przestępstwa zbierają systemy, w których się dzieją (`combat`, `melee`, `death`, `scanner`, alarm zlecenia), do dziennika kroku w `session.street`. `crime` zabiera to, co jest w dzienniku, gdy rusza; to, co dojdzie po nim (alarm `contract`), czeka na następny krok.
- `contract-layer` po `contract`: widzi stan zlecenia z tego kroku.

## Decyzja: ostatnia znana pozycja (Deus Ex)
- `GangerAi` dostaje `lastKnown`, `search` i `lost` (zapisywane w `EntitySnapshot`, pola opcjonalne) oraz przejściowe `sees`.
- Zaalarmowany AI, który widzi gracza, zapisuje jego pozycję. Poza wzrokiem przez `TRACK_GRACE` = 1,5 s dalej wie, dokąd gracz poszedł (słyszy go), potem goni ostatnią pozycję, nie gracza.
- Gdy dojdzie do `lastKnown` (`LEAD_ARRIVE` = 1,5 m) bez kontaktu albo goni duch dłużej niż `GIVE_UP` = 20 s, przestaje walczyć (`alerted` = false) i rozgląda się przez `SEARCH_SECONDS` = 6 s (obrót ±1,4 rad co 3 s wokół kierunku z posterunku). Potem `lastKnown` = null i wraca na posterunek albo trasę z harmonogramu (`HoldPosition`). Kto ma ofiarę (fala ochrony, zasadzka eskorty), nie odpuszcza.
- Trop bez walki (`giveLead`): rozproszenie, kamera, namierzenie uploadu, heat. AI idzie tam po steeringu z ADR-0025 (ta sama funkcja `pursueTo`) i rozgląda się tak samo. Nowa gałąź drzewa `HasLead → Investigate` stoi po `WatchPlayer`, przed `HoldPosition`.
- Zaalarmowany bez tropu (trafienie, strzał obok, fala włamania) dostaje pozycję gracza: wie mniej więcej, gdzie on jest. Tak było dotąd, teraz tylko na start.
- Kto szuka gracza (`alerted` albo `lastKnown`), zostaje w świecie przy wyładowaniu chunka, jak dotąd zaalarmowany.
- `AwarenessChanged` idzie przy zmianie stanu albo zmianie poziomu o `AWARENESS_STEP` = 0,25. Stany: `alerted` (poziom 1), `searching` (zaalarmowany poza `TRACK_GRACE`: 0,75; rozglądanie się: co najmniej 0,5), `suspicious` (trop albo podejrzenie strażnika z ADR-0024), `unaware`. W teście pościgu z ukryciem i powrotem wychodzi kilka zdarzeń na cały epizod, nie jedno na tick.

## Decyzja: tłum i świadkowie
- `Disturbance` z promieniem: strzał (`gunshot`, promień `alertRadius` broni, dla każdego strzelca), trafienie wręcz (`fight`, 10 m), ciało (`body`, 12 m, każda śmierć NPC), alarm (`alarm`: druga faza zlecenia 25 m, kamera 20 m), hack (`hack`: rozproszenie 14 m, zwarcie 8 m).
- Przechodnie (`civilian`, także z harmonogramem, w tym nowi ludzie Kanałowej i sprzedawcy targu z ADR-0026) mają przejściowy `crowd`: `calm`, `alarmed`, `fleeing`, `cowering`. Strzał bliżej niż `COWER_RADIUS` = 6 m: kulenie przez 4 s, potem ucieczka. Strzał dalej, walka, ciało: ucieczka przez 8 s (każdy nowy strach odświeża czas). Hack i daleki alarm: `alarmed` przez 5 s (stoi i patrzy). Silniejszy strach wygrywa ze słabszym. Potem spokój i powrót do harmonogramu. `CrowdReacted` przy każdej zmianie.
- Ucieczka idzie od źródła po steeringu: punkt 6 m dalej przez `steerPoint`. Gdy droga wprost jest zamknięta (ściana za plecami), biegnie najbliższym otwartym kierunkiem (próby co 45°, odcinek 2,5 m).
- **Przestępstwo** to czyn gracza, który zobaczył świadek:
  - otwarcie ognia poza walką (`gunfire`): gracz nie był ostrzelany w ostatnich 3 s i żaden wróg w promieniu 30 m z nim nie walczy;
  - zranienie kogoś, kto nie walczył (`assault`): cywila zawsze, wroga, który nie był zaalarmowany, nie miał ofiary ani nie celował (snajper);
  - śmierć takiej osoby z ręki gracza (`murder`).
- **Zabójstwo cywila jest przestępstwem zawsze**, także w trakcie zlecenia i w trakcie strzelaniny. **Walka z wrogim gangiem w trakcie zlecenia nie daje przestępstwa sama z siebie**: dopóki nikt nie widział, nie ma czego zgłaszać (reguła ADR-0028), a gdy przeciwnik już walczy z graczem, dalsza walka jest obroną. Pierwszy strzał w niezaalarmowany cel widziany przez cywila, kamerę albo patrol jest przestępstwem. Wróg, który walczy z graczem, nie dzwoni po ochronę: walczy. Obrona Oyajiego przed falą Hebi nie jest przestępstwem, bo fala ma ofiarę.
- **Świadkowie**:
  - kamera, która widzi gracza w chwili czynu, zgłasza od razu (`channel: "camera"`);
  - patrol, czyli członek ochrony dystryktu, który nie walczy, widzi gracza (zasięg wzroku, stożek strażnika), zgłasza od razu (`patrol`) i dostaje trop;
  - cywil, który widzi gracza (`CIVILIAN_SIGHT` = 22 m dookoła, bez przeszkód), zaczyna dzwonić (`WitnessCalling`, `WITNESS_CALL_SECONDS` = 5 s czasu świata) i ucieka. Po upływie czasu zgłasza (`CrimeReported`, `civilian`). Kilku świadków jednego zdarzenia daje jedno zgłoszenie: pierwsze, które dojdzie, kasuje resztę.
- Telefon się nie uda, gdy świadek zginie, gdy zniknie z wczytanego świata (ucieknie poza zasięg streamingu) albo gdy gracz wyceluje w niego z dobytą bronią z bliska (`INTIMIDATE_RANGE` = 6 m, stożek 0,3 rad). Zastraszyć można tylko kogoś już wystraszonego albo dzwoniącego: spokojny przechodzień, obok którego gracz przechodzi z bronią, nie zmienia stanu (inaczej przejściowy stan tłumu rozjeżdżałby grę po wczytaniu). Zastraszony kuli się i przez `INTIMIDATED_SECONDS` = 25 s nie dzwoni. To jest „wyprzedzony przez gracza” z ADR-0028.
- Stan tłumu i rozmowy są przejściowe (jak stan walki wręcz): wczytana gra zaczyna spokojnie. Zgłoszenie w toku przepada przy zapisie i wczytaniu.

## Decyzja: heat 0..3
- `DomainState.heat`: poziom, frakcja ścigająca, `searching`, `lastKnown`, `searchLeft`, `cooldown`. Reguły w `core/src/crime/rules.ts`.
- Ochrona dystryktu: Tessen w Dokach, Hebi na Shinsekai, Kanałowej i targu (`securityAt`). Frakcja z pierwszego zgłoszenia ściga do końca.
- `CrimeReported` podnosi heat do poziomu czynu (`CRIME_HEAT`: wtargnięcie, hack, strzały, napaść 1, zabójstwo 2). Gdy heat już tam jest, zgłoszenie podnosi o jeden, najwyżej raz na `HEAT_REPORT_COOLDOWN` = 8 s, do 3. Każde zgłoszenie daje kontakt i trop dla ludzi ochrony w promieniu 50 m.
- Kontakt: ktoś ze ścigającej frakcji widzi gracza (AI albo kamera). Bez kontaktu `searching`, licznik `HEAT_SEARCH_SECONDS` = 20/30/40 s (poziom 1/2/3) biegnie, na zero heat spada o jeden i szukanie trwa dalej z licznikiem nowego poziomu. `HeatChanged` przy każdej zmianie poziomu, przy przejściu w szukanie i z powrotem, przy każdym zgłoszeniu.
- Ludzie ścigającej frakcji atakują gracza na widok niezależnie od reputacji.
- **Wsparcie** (`HEAT_REINFORCEMENTS` = 0/1/2/4): co `REINFORCE_INTERVAL` = 4 s jeden, aż będzie komplet (pierwszy od razu). Typ z `SECURITY_ENEMY`: `hebi_ganger` albo `tessen_guard`.
  - Punkt wejścia z `SECURITY_ENTRIES` (24 punkty: końce ulic, przejścia między blokami, przejście do Doków, alejki placu i nabrzeża, w `sim/src/content/devices.ts`), we wczytanym chunku, od `SPAWN_MIN` = 12 m do `SPAWN_MAX` = 60 m od gracza i nigdy w polu widzenia: odrzucony jest każdy punkt w stożku ±1,2 rad przed graczem z czystą linią z oka. Spośród reszty najbliższy `lastKnown`.
  - Wsparcie nie ma klucza i nie wchodzi do zapisu. Po wczytaniu z heat pojawia się od nowa, tak samo poza wzrokiem. Bez heat odchodzi (znika), gdy nie walczy, jest poza wzrokiem i dalej niż 12 m. Nie zostawia łupu.
  - W czasie szukania wsparcie bez tropu dostaje trop 4 m od `lastKnown`, w kierunku zależnym od id, więc przeczesuje okolicę.

## Decyzja: skaner, RAM i quickhacki
- Przytrzymany `scan` (poza dialogiem i po śmierci nie działa) zwalnia świat do `SCAN_TIME_SCALE` = 0,6 przez `worldTimeScale`. Z przeciążeniem odruchów wygrywa wolniejsze (0,3).
- Fokus: rzecz do zeskanowania (człowiek z AI, snajper, przechodzień, eskorta, kamera, urządzenie) najbliżej środka widoku, do `SCAN_RANGE` = 25 m i `SCAN_CONE` = 0,3 rad, z czystą linią. Remis: bliższy, potem kolejność tworzenia. `ScanFocusChanged` przy zmianie, z `kind` (rodzaj celu), `name` (kamera, automat, głośnik, neon; u wroga nazwa jego strony, np. „Ochrona Tessen”; u reszty „Przechodzień”) i `faction`.
- `quickhack` n uploaduje n-ty hack z listy rodzaju celu (`quickhacksFor` z `core`, ta sama lista co w HUD: kolejność `QUICKHACK_IDS` po filtrze `targets`). Człowiek: ping, restart optyki, paraliż, zwarcie. Kamera: ping, restart optyki. Urządzenie: ping, rozproszenie, zwarcie. Za krótka lista nic nie robi.
- RAM płatny na starcie (`QuickhackStarted`). Odmowa: `busy` (trwa inny upload), `no-ram`, `wrong-target` (urządzenie po zwarciu). Upload liczy czas gracza i wymaga, żeby cel był w fokusie co krok. Utrata fokusu kończy go `lost-target` i zwraca połowę RAM.
- RAM: `BASE_RAM` = 8, regeneracja 0,5/s, gdy nic się nie uploaduje i gracz nie walczy (ostrzał w ostatnich 3 s albo zaalarmowany wróg w promieniu `COMBAT_RADIUS` = 40 m). `RamChanged` przy zmianie liczby całkowitej.
- `DomainState.netrun` (RAM i upload z celem jako kluczem bytu albo `#id`) wchodzi do zapisu. Wczytana gra kończy upload tak samo (test). Efekty na bytach (`hackFx`: `pinged`, `blind`, `crippled`; liczniki urządzeń) są przejściowe i biegną w czasie świata.
- Efekty:
  - `ping` (12 s): flaga `hackFx.pinged` na ludziach i kamerach frakcji celu w promieniu `PING_RADIUS` = 30 m i na kamerach tej samej sieci. HUD pokazuje je przez ściany.
  - `reboot_optics` (10 s): kamera nic nie widzi, strażnik i snajper nic nie widzą. Zaalarmowany gubi trop i idzie do ostatniej pozycji.
  - `distract` (8 s): urządzenie hałasuje, AI w promieniu `DISTRACT_RADIUS` = 14 m dostają trop 1,2 m przed urządzeniem, tłum się ogląda.
  - `cripple_movement` (6 s): cel nie chodzi, ale się obraca i strzela.
  - `short_circuit`: człowiek dostaje `SHORT_CIRCUIT_DAMAGE` = 35 przez `DamageDealt` (strefa `torso`, bez pancerza) i rozgląda się tam, gdzie stoi; urządzenie gaśnie na `DEVICE_SHORT_SECONDS` = 15 s.
- **Namierzenie** jest regułą, bez losowania: gdy upload dochodzi do końca, a gracza widzi wrogi AI (zasięg, linia, stożek strażnika) albo działająca kamera, idzie `QuickhackTraced`, a każdy taki obserwator dostaje trop na gracza. Cel `reboot_optics` się nie liczy: gaśnie, zanim spojrzy.

## Decyzja: kamery i urządzenia
- Nowy komponent `device` (rodzaj, sieć, frakcja, opcjonalna strefa zakazana) i nowy plik treści `sim/src/content/devices.ts`, podpięty jednym wpisem `WORLD_DEVICES` w `world-map.ts`. Każde urządzenie ma swój chunk. Streaming rezerwuje im id po całej treści chunków, więc dotychczasowe id się nie zmieniają. Urządzenia nie są bryłami: kolizje i raster AI zostają bez zmian.
- Kamera widzi `CAMERA_RANGE` = 16 m w stożku ±0,6 rad. Czyn w polu widzenia zgłasza od razu. Gracz w strefie zakazanej (strefa aktywna zawsze albo tylko w trakcie zlecenia danego rodzaju) napełnia licznik w `CAMERA_SPOT_SECONDS` = 1 s (spada dwa razy wolniej), potem: `CrimeReported` (`trespass`, `camera`), `Disturbance` alarmu 20 m, trop dla AI jej frakcji w promieniu 20 m, ponownie po `CAMERA_REPORT_COOLDOWN` = 10 s. `AwarenessChanged` dla kamery (obserwator = kamera) jak dla AI.
- Rozmieszczenie:
  - Doki: kamera w biurze Tessen (strefa: wnętrze biura w trakcie infiltracji, stół z danymi poza stożkiem, drzwi w stożku), kamera nad drzwiami biura na nabrzeże, kamera na placu przy schodach magazynu, automat z napojami pod ścianą biura, głośnik na placu;
  - targ: kamera Hebi na ścianie przy skrytce (strefa: skrytka w trakcie odzyskania), neon i głośnik przy skrytce.
- **Breach Protocol** na terminalu włamania w Dokach: klawisz interakcji na terminalu trwającego zlecenia `hack` wysyła `BreachStarted` z trzema demonami (przy pierwszym naciśnięciu startuje też włamanie), dopóki breach nie zostanie rozliczony; przerwany obrażeniami można więc otworzyć znowu. `breach-result` działa tylko dla terminala trwającego zlecenia `hack`, po starcie włamania, z Seki w zasięgu terminala (4 m), raz na zlecenie. Demony:
  - ICEpick skraca włamanie o `BREACH_ICEPICK_SECONDS` = 10 s i obniża koszt quickhacków o 1 RAM (najmniej 1) do końca zlecenia;
  - Datamine daje `BREACH_DATAMINE_EDDIES` = 80 €$ (`EddiesChanged` ze źródłem `loot`);
  - Mass Vulnerability oznacza ludzi zlecenia (`pinged`) na `BREACH_MARK_SECONDS` = 20 s.
  - Pusta lista („Odłącz” bez demonów) też rozlicza breach.
  - Wynik idzie jako `BreachCompleted` z demonami w stałej kolejności, bez powtórzeń, i zapisuje się w zleceniu (`breach`).

## Decyzja: warunek bonusowy, odznaki, debrief, telefon
- `core/src/contracts/scoring.ts`: jeden `BonusCondition` na szablon i czas par:

| Szablon | Warunek (odznaka) | Bonus | Par |
|---|---|---|---|
| eliminate (Kaito) | clean | 90 €$ | 120 s |
| delivery (Kaito) | no_alarm | 60 €$ | 35 s |
| retrieve (Hana) | ghost | 100 €$ | 120 s |
| protect (Hana) | untouched | 100 €$ | 120 s |
| escort (Genzō) | clean | 110 €$ | 150 s |
| infiltrate (Genzō) | netrunner | 110 €$ | 150 s |
| hack (Genzō) | no_alarm | 120 €$ | 110 s |

- Liczniki (`ContractTally`) są w `domain.contracts.tally`, obok zlecenia, a nie w nim: samo zlecenie i zdarzenia, które je niosą, zostają takie, jak je przyjęto. Przyjęcie zaczyna je od zera, wypłata i porażka je usuwają, nowa gra ich nie ma.
  - `detected`: wróg zaalarmowany widzi gracza, snajper zaczyna celować, kamera go łapie, upload namierzony;
  - `alarm`: zgłoszone przestępstwo albo alarm kamery (druga faza zlecenia, czyli zasadzka eskorty i fala włamania, się nie liczy);
  - `extraKills`: zabici przez gracza spoza celów zlecenia (`EntityKilled.killerId` niesie zabójcę, gdy jest znany);
  - `damaged`: spadek zdrowia gracza między krokami (także upadek);
  - `hacked`: quickhack albo breach;
  - czas od przyjęcia do wykonania zadania (`clearedTick`).
- `ContractBonusChanged` przy przyjęciu (`kept: true`) i raz przy utracie (`kept: false`): gdy odznaka warunku przestaje być możliwa (dla `swift` po przekroczeniu par).
- Po `ContractCompleted` idzie `ContractDebrief`: odznaki w kolejności `CONTRACT_BADGES`, ranga według ADR-0028 (S: co najmniej 4 odznaki i warunek, A: co najmniej 3, B: 1 albo 2, C: 0), bonus za warunek, `styleBonus` = 6% nagrody za każdą odznakę ze stylu zleceniodawcy (`FIXER_STYLE`), zaokrąglone do 5 €$, i sekundy. Całość płaci jeden przelew: `EddiesChanged.delta` = nagroda + bonus + styl. `ContractCompleted.reward` zostaje nagrodą bazową, jak w umowie.
- Balans (`core/test/wave1-balance.test.ts`): warunek to 10 do 25% średniej wypłaty szablonu, warunek ze stylem najwyżej 40%, a pełny bonus jednego zlecenia mniej niż połowa najtańszego implantu.
- `PhoneMessage` (`from`: id zleceniodawcy, `kind: "text"`, `knot: phone_<fixer>_<sytuacja>`):
  - `offer` (priorytet `contract`): wejście do dystryktu zleceniodawcy (Kaito: Shinsekai, Hana: targ, Genzō: Doki), gdy Seki go już poznała (`met_fixer`, `met_hana`, `met_genzo`) i nie ma zlecenia, najwyżej jedna na wejście. Pierwszy krok po starcie i wczytaniu tylko zapamiętuje dystrykt;
  - `paid` (`contract`): wypłata;
  - `failed` (`info`): porażka.
  - Knoty ink nie są jeszcze napisane: dopisze je właściciel `packages/narrative` (9 knotów: `phone_kaito_offer`, `phone_kaito_paid`, `phone_kaito_failed`, to samo dla `hana` i `genzo`).

## Zapis
`SAVE_SCHEMA_VERSION` 10 na 11. Migracja: heat zero, pełny deck (8 RAM, bez uploadu), liczniki trwającego zlecenia od ticka zapisu. Walidacja nowych pól (heat, netrun, tally, breach, pola szukania w bytach). Jedna zmiana schematu na całą falę, jak chce ADR-0028.

## Konsekwencje
- Złote hashe: `31f58220` na `0243a0a9` i pojedynek `dfa7316b` na `5be082e2` przez nowe pola domeny (heat i netrun w zapisie), potem replay `0243a0a9` na `bef1026f`, bo zaalarmowani gangerzy z replayu mają w zapisie `lastKnown`, `search` i `lost`. Przebieg replayu się nie zmienił: gangerzy cały czas widzą gracza, a pierwszy strzał nie ma świadka. Po merge'u z treścią ADR-0026 (hash treści `74bd1c33`) replay ma `d9a66304`; test bez nowych ludzi i skrytek ADR-0026 daje dalej `bef1026f`, więc treść i reguły zmieniają hash niezależnie.
- Testy, które sprawdzały wypłatę jako samą nagrodę, liczą teraz z kartą (`debriefExtras`).
- Testy w `sim`: ostatnia znana pozycja (pościg, szukanie, powrót, zapis w trakcie), tłum (ucieczka, kulenie, spokój), pętla świadek, telefon, heat (zgłoszenie po 5 s, martwy, zastraszony i uciekający świadek, wsparcie poza wzrokiem w czterech kierunkach patrzenia, spadek heat po szukaniu, zapis), skaner, każdy quickhack, namierzenie, odmowy, RAM, zapis w trakcie uploadu, kamery (zgłoszenie od razu, wtargnięcie w biurze), debrief i ranga, utrata warunku, liczniki w zapisie, telefon z ofertą, breach. W `core`: reguły heat, decku i punktacji, balans.
- Na później: knoty ink telefonu, kamery i urządzenia w kolejnych dystryktach (wystarczy dopisać do `DEVICES`), Cyberware Capacity zmieniające `BASE_RAM`, NCPD jako trzecia ochrona, zgłoszenie w toku w zapisie, strefy zakazane poza zleceniami.
