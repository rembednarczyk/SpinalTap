# ADR-0011: Frakcje i reputacja (M2)

## Kontekst
Kryterium M2 (§14): „NPC reagują na reputację”. Do M1 reputacja była liczbą na frakcję, którą zmieniał tylko ink i wypłata kontraktu; żaden NPC jej nie czytał, a klinika Mori liczyła się jako cywile.

## Decyzja
- **Frakcje** (`core/reputation`): `fixers` (sieć Kaito, Neon Koi), `hebi` (gang z zaułka), `civilians` (mieszkańcy), `clinic` (klinika Mori, nowa). Wartość w zakresie ±100; pięć progów (`reputationTier`) do wyświetlania i cen, trzy postawy (`stanceOf`: poniżej −10 wrogo, powyżej +10 przyjaźnie, pomiędzy neutralnie) dla zachowań.
- **Przyczyny zmian** to czysta tabela `reputationEffects(cause)` w `core`; `sim` woła ją jawnie w miejscu zdarzenia (bez subskrypcji na szynie, żeby kolejność była oczywista):
  - zabicie członka frakcji (`deathSystem`, po polu `faction` bytu): Hebi −4 i cywile −1; ktokolwiek spoza gangu −25 dla jego frakcji (i −10 u cywilów),
  - ukończenie kontraktu: fixerzy +3, Hebi −5, cywile +1,
  - zakup w klinice: +4 za implant, +1 za przedmiot.
- **Sklep** (`core/shop`): `shopTerms(reputacja właściciela)`: wrogo = odmowa obsługi (`PurchaseFailure` `refused`, a interakcja emituje `InteractionRefused` zamiast otwierać panel), nieufnie +25%, przyjaźnie −10%, zaufanie −20%. Cena jest liczona w `core` i wyświetlana w UI tą samą funkcją.
- **Gangerzy** (drzewo mistreevous): strzelają tylko, gdy są w stanie `alerted`. Przy neutralnej i wrogiej postawie Hebi zauważenie gracza od razu ustawia `alerted` (zachowanie z M0); wroga postawa zwiększa zasięg zauważenia ×1,5. Przy przyjaznej postawie zauważenie tylko obraca gangera w stronę gracza (`NpcReacted` „warn”); atakuje dopiero po prowokacji: strzale gracza w promieniu alarmu lub trafieniu.
- **Cywile** (osobne drzewo, system `civilian-ai` zaraz po `ganger-ai` w `createSystems()`): przy wrogiej postawie mieszkańców uciekają od gracza bliżej niż 7 m, potem wracają na swoje miejsce. Decyzja zależy wyłącznie od pozycji i reputacji, więc system nie ma ukrytego stanu i nie zużywa RNG. Ripperdoc nie ucieka: należy do frakcji `clinic` i odmawia obsługi.
- **Ink** dostaje postawy jako zmienne `<frakcja>_stance`; Ume odmawia rozmowy przy wrogiej postawie cywilów, Kaito komentuje dobrą reputację.
- Schemat zapisu v4: migracja v3→v4 dopisuje `reputation.clinic = 0`.

## Konsekwencje
Złoty hash determinizmu zmienił się (nowe pole reputacji, potem kary za zabójstwa w skrypcie testu). Zdarzenia `NpcReacted` są tylko wskazówką dla prezentacji: pamięć „już ostrzegł” jest przejściowa i po wczytaniu gry może zostać wyemitowana ponownie, co nie wpływa na stan.
