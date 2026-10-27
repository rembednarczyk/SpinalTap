# ADR-0016: Zlecenia na targu i balans (M4)

## Kontekst
M4 (§14): więcej zleceń i lokacji, balans. Do M3 jedynym zleceniem była likwidacja od Kaito w Shinsekai 7, a Targ pod estakadą (ADR-0014) nie miał żadnej roboty. Nowe zlecenia mają korzystać z istniejących mechanik (rozmowa, ruch, walka, streaming, zapis) i nie zmieniać schematu zapisu, jeśli się da.

## Decyzja
- **Rodzaj zlecenia** (`core/contracts/kinds.ts`): `eliminate` (dotychczasowe), `delivery`, `retrieve`, `protect`. Rodzaj wyznacza zleceniodawcę: Kaito (`fixers`) daje likwidacje i kursy, Hana z targu (`civilians`) odzyskanie i ochronę. Stawkę skaluje reputacja frakcji zleceniodawcy (`contractPayout`, ±50%).
- **Kurs**: paczka od Kaito do Hany w limicie 50, 65 albo 80 s. Termin to `deadlineTick` (tick symulacji jest w zapisie, więc zegar przeżywa wczytanie). Hana przyjmuje paczkę w rozmowie (`deliver_contract()` → komenda `deliver-contract`), Kaito płaci po powrocie. Po terminie `contractSystem` kończy zlecenie porażką.
- **Odzyskanie**: skrzynka Hany w skrytce Hebi pod estakadą (wschodni koniec targu), 2-4 strażników. Skrzynka to byt z interakcją `pickup`: system interakcji zabiera ją od razu, bez rozmowy, i podnosi flagę `taken:<klucz>`, więc nie wraca ani po zwolnieniu chunka, ani po wczytaniu. Strażników nie trzeba zabijać.
- **Ochrona**: fala 2-4 gangerów spod estakady albo od wschodniej ściany idzie po Oyaji (`ai.victim`). W drzewie gangera dwie nowe gałęzie (strzel do ofiary w zasięgu, idź do ofiary) stoją za „strzelaj do gracza” i przed „goń gracza”; ganger bez ofiary zachowuje się jak dotąd. Oyaji ma 120 HP i przy przyjęciu zlecenia wraca do pełnego zdrowia. Śmierć Oyaji kończy zlecenie porażką, a Hana nie oferuje go ponownie.
- **Porażka** (`ContractFailed`, `failContract`): zlecenie znika bez zapłaty, a jego id dostaje flagę `contract_failed:<id>` i nie jest używane ponownie (inaczej flagi `dead:<id>-g<n>` przeszłyby na następne zlecenie). Numer kolejnego to ukończone + nieudane + 1.
- **Reputacja za śmierć** liczy się tylko wtedy, gdy ostatnie trafienie zadał gracz (`lastHitBy`, nie trafia do zapisu, bo śmierć rozstrzyga się w tym samym kroku). Hebi zabijający Oyaji nie obciążają Seki.
- **Losowość**: każdy generator zużywa stałą liczbę liczb z `RandomPort`: likwidacja 2 (bez zmian), kurs 1, odzyskanie 1, ochrona 2.
- **Ink**: knot `hana` (`m4-targ.ink`) z odmową przy wrogiej postawie cywilów i powitaniem zależnym od `civilians_stance` i `fixers_stance`. Kaito po pierwszym zleceniu wspomina Hanę i proponuje kurs. Nowe zmienne `contract_kind`, `contract_giver`, `contract_reward`, `contract_time_left` i funkcje `offer_contract(kind)`, `deliver_contract()`.
- **Bez zmiany schematu**: pola `kind` i `deadlineTick` są opcjonalne, a kontrakt bez `kind` to likwidacja. Każdy zapis v6 jest nadal poprawny i znaczy to samo, więc `SAVE_SCHEMA_VERSION` zostaje 6. Walidator sprawdza nowe pola, gdy są.

## Balans
Stawki przy neutralnej reputacji, na początku gry (z doświadczeniem rośnie liczba gangerów, a z nią stawka):

| Zlecenie | Stawka €$ | Ryzyko | Czas (szac.) |
|---|---|---|---|
| Kurs | 250 / 325 / 400 (luźny, średni, ciasny termin) | brak walki, może przepaść | ok. 1,5 min |
| Odzyskanie | 470-580 | strażnicy, walka opcjonalna | ok. 2,5 min |
| Likwidacja | 500-625 | walka | ok. 2,5 min |
| Ochrona | 550-675 | walka, może przepaść | ok. 2 min |

Średnie zlecenie daje ok. 500 €$, a dochód wychodzi na 200-250 €$ na minutę bez względu na rodzaj: kurs jest tani i szybki, walka płaci więcej, ale zjada apteczki (90 €$). Cen w klinice nie zmieniam: stabilizator chwytu (500) to jedno średnie zlecenie, splot (650) i wzmacniacz synaps (900) od półtora do dwóch, a Akcelerator Kairos (1100) ponad dwa i więcej niż trzy kursy. Apteczka kosztuje mniej niż połowę najtańszego zlecenia, więc leczenie nie zjada zysku. Te relacje pilnuje `core/test/m4-balance.test.ts`; zmiana ceny albo stawki wymaga poprawienia tej tabeli.

Reputacja za ukończenie: likwidacja fixerzy +3, Hebi -5, cywile +1 (bez zmian); kurs fixerzy +2, cywile +1; odzyskanie cywile +3, Hebi -4, fixerzy +1; ochrona cywile +6, Hebi -3. Porażka: spóźniony kurs fixerzy -4, martwy Oyaji cywile -5. Zabici gangerzy liczą się osobno (-4 Hebi, -1 cywile), więc ochrona z czterema gangerami daje cywilom netto +2.

## Konsekwencje
- Złoty hash determinizmu bez zmian (9b3d0871): przebieg testowy nie przyjmuje zlecenia, nie wchodzi na targ i nie ma bratobójczych zabójstw.
- Po wczytaniu zapisu z odzyskaniem w stanie `cleared` strażnicy nie wracają (jak cele wyczyszczonej likwidacji). Fala po nieudanej ochronie zostaje na targu jako zwykli gangerzy i znika po wczytaniu.
- Pieniądze przestają mieć cel po kilku implantach; następny krok to nowy towar w klinice albo u Hany.
