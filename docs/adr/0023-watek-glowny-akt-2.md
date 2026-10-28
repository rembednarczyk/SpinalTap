# ADR-0023: Wątek główny, akt II „Lustro”: Ren, archiwum Kagami, trzy zakończenia

## Kontekst
M3 (§1, §9, §14): wątek główny ma iść dalej po akcie I (ADR-0012). Akt II ma startować z każdego zakończenia aktu I i pamiętać jego wybory, odzyskiwać kolejne wspomnienia jako progresję, wprowadzić Rena Odagiri (o którym mówią Ume i wspomnienie „walizka”), skończyć się konfrontacją z wyborem, który przesuwa frakcje, i dać 2–3 zakończenia. Zlecenia fixera mają być haczykiem do wątku. Nowa dzielnica (Doki, ADR-0024) powstaje równolegle, więc akt II korzysta tylko z istniejących: Shinsekai 7 bez zmian (scena referencyjna NPR, złoty replay), dach i estakada na targu.

## Decyzja
- **Quest `m3_lustro` („Lustro”)** startuje sam po `m3_echo` (`startsAfter`). Cztery kroki:
  1. `ren_trail`: ktoś mówi, gdzie śpi Ren (Ume, a po zakończeniu „seki” także Mori, który sprzedał moduł). Flaga `ren_trail`.
  2. `meet_ren`: Ren na betonowym dachu południowego rzędu targu (trzecia drabina schodów pożarowych) oddaje chip „zapis zero”. Flaga `met_ren`, nagroda: wspomnienie `rooftop` („dach”, zdrowie +15).
  3. `kaito_job`: haczyk ze zlecenia: Kaito ma kontrakt Kagami na Rena i odtwarza wiadomość mówioną głosem Rena. Wybór `job` (odmowa / przyjęcie, reputacja fixera ±3), flaga `kagami_job`, nagroda: wspomnienie `last_call` („głos”, stabilność celowania +10%). Wymaga odegranej retrospekcji „dach”.
  4. `overpass`: Kurosawa z Kagami na estakadzie proponuje pełny zapis Seki za Rena i archiwum. Wybór `archive` decyduje o zakończeniu. Kończy się flagą `act2_ending` po odegranej retrospekcji „głos”.
- **Wybory aktu II** dochodzą do `STORY_CHOICES` (`rooftop`, `voice`, `job`, `archive`) i do ink jako `choice_*`, jak w akcie I. Zakończenie aktu I liczy już tylko `ACT_ONE_CHOICES`.
- **Zakończenia aktu II** (`ACT_TWO_ENDINGS`, `story.act2Ending`), komenda `resolve-ending` z `act: 2` (ink: `end_act2()`), sim stosuje tabelę reputacji zakończenia i ewentualne wspomnienie:
  - `street` „Archiwum ulicy”: chipy wracają do ludzi; walka z czyścicielami, potem finał u Rena. Mieszkańcy +15, Hebi −5, Kagami −20.
  - `hebi` „Wspólnicy”: archiwum zostaje u Rena i idzie przez Hebi; walka, potem finał u Rena. Hebi +15, mieszkańcy −5, Kagami −20.
  - `kagami` „Kopia”: Seki oddaje Rena i archiwum za swój zapis; bez walki, koniec na estakadzie. Kagami +20, fixerzy +10, Hebi −10, mieszkańcy −5, wspomnienie `mirror` („lustro”, krytyk +5%, obrażenia +2) z retrospekcją. Ren znika z dachu.
- **Konfrontacja**: odmowa Kurosawie podnosi `kagami_ambush`; Kurosawa odchodzi, a trzech czyścicieli (`kagami_cleaner`, frakcja Kagami, 110 HP) wchodzi na estakadę. Ren zamyka akt dopiero, gdy wszyscy trzej leżą (flagi `dead:<klucz>`).
- **Nowa frakcja `kagami` („Kagami Biotech”)**, startuje neutralnie, więc jej ludzie strzelają bez ostrzeżenia jak Hebi. Śmierć czyściciela kosztuje tylko reputację u Kagami (−6), ulica jej nie opłakuje.
- **Obecność postaci zależna od flag**: `ActorDef.when = { all, none }`. Streaming dodaje i usuwa takie postacie, gdy zmieniają się flagi (porównanie tablicy flag po referencji, przegląd chunków w kolejności tabeli), i nie przywraca ich z zapisu, gdy warunek nie zachodzi. Ren: od `ren_trail` do `ending:kagami`; Kurosawa: od `kagami_job` do zasadzki albo końca aktu; czyściciele: od zasadzki.
- **Różne otwarcie**: zakończenie aktu I zostaje też flagą `ending:<id>`. Scena `act2_opening` gra sama po finale aktu I (`pendingScene`: najpierw zaległa retrospekcja, potem otwarcie, raz, flaga `seen:act2_opening`): po „aya” Ren mówi do niej przez moduł, po „seki” Kaito pisze, że Mori sprzedał moduł chłopakowi z wężem Hebi. Cel pierwszego kroku też się różni: `QuestStep.variants` (pierwszy pasujący warunek) i `stepObjective` w HUD, dzienniku i zdarzeniu `QuestAdvanced`. Ostatni krok ma warianty na czas walki i po niej.
- **Reakcje postaci**: Ren, Kurosawa i Kaito odnoszą się do wyborów aktu I (`case`, `crash`, zakończenie) i aktu II (`rooftop`, `voice`, `job`); po zakończeniu Ren, Ume i Kaito mówią o skutkach.
- **Zapis v9**: frakcja `kagami` w reputacji, `story.act2Ending`, flaga `ending:<id>` dla zapisów po akcie I i start `m3_lustro`, jeśli akt I jest ukończony (migracja 8→9 z testem).
- Modele: Ren używa presetu `civilian`, Kurosawa `fixer`, czyściciele `ganger` (z pancerzem i wizjerem), dopóki nie będzie własnych modeli.

## Konsekwencje
Złoty hash determinizmu i hash pojedynku zmieniły się tylko przez kształt snapshotu (wersja 9, `reputation.kagami`, `story.act2Ending`); po usunięciu tych pól hash replayu jest identyczny jak wcześniej (`5c60913b`). Nowe postacie stoją na targu, więc ich identyfikatory przesuwają tylko numerację późniejszych chunków; Shinsekai 7 i migawka NPR się nie zmieniają. Akceptację sprawdza `packages/app/test/m3-lustro-loop.test.ts`: od zapisu po każdym zakończeniu aktu I do każdego zakończenia aktu II, z zapisem i odczytem w połowie aktu i po nim; rozmowy pilnuje `dialogue-roles.test.ts`, a kluczową rozmowę z Kurosawą przechodzi `e2e/m3-lustro.spec.ts` przez UI.
