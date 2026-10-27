# ADR-0012: Wątek główny, akt I: wspomnienia, wybory, zakończenia

## Kontekst
M3 (§14): wątek główny od startu do zakończenia, progresja przez odzyskiwanie wspomnień (§1, §9), zakończenia zależne od wyborów, stan narracji w zapisach. Fragmenty wspomnień mają odblokowywać trzy rodzaje postępu: ukończone zlecenie, rozmowa z ripperdociem, zakup implantu.

## Decyzja
- **Quest `m3_echo` („Echo”)** w `core` startuje sam po ukończeniu `m0_first_contract` (nowe pole `startsAfter`, przejście `started`). Każdy krok kończy się nagrodą `memory` (istniejący `unlockMemory` i `MemoryUnlocked`, więc działa efekt `memory-glitch` i modyfikatory statystyk).
- **Postęp ograniczony do kroku**: sim podnosi flagę `contract_completed@<krok>` / `cyberware_installed@<krok>` dla bieżącego kroku każdego aktywnego questa (`progressFlag`). Zakup sprzed kroku się nie liczy, a model warunków questów dalej opiera się wyłącznie na flagach.
- **Retrospekcje**: wspomnienie z `RECALL_MEMORIES` jest „oczekujące”, dopóki nie ma flagi `recalled:<id>`. `GameSession` otwiera knot `recall_<id>`, gdy gracz odzyskuje kontrolę (po rozmowie albo wyjściu z kliniki). Stan wynika z domeny, więc przeżywa zapis. Kolejny krok questa wymaga odegranej retrospekcji.
- **Wybory należą do domeny**: `DomainState.story = { choices, ending }`, komenda `story-choice` (pierwsza odpowiedź jest wiążąca) i `resolve-ending`. Zakończenie liczy czysta funkcja `resolveEnding` (dwa z trzech wspomnień przyjęte jako własne: `aya`, w innym razie `seki`). Ink dostaje wybory i podgląd zakończenia jako zmienne (`choice_*`, `act1_ending`, `story_ending`) synchronizowane przed każdą rozmową; sam o zakończeniu nie decyduje.
- **Rozmowa z Mori**: klinika zostaje interakcją typu `shop`; panel ma przycisk „Porozmawiaj z Mori” (`UiIntents.talkToShopkeeper`), który przechodzi do knota `mori`.
- **Dialogi odblokowane wspomnieniami**: zewnętrzna funkcja ink `has_memory(id)`.
- **Zapis v5**: pole `domain.story`; migracja v4→v5 dodaje pusty stan i startuje `m3_echo`, jeśli pierwsze zlecenie jest ukończone.

## Konsekwencje
Złoty hash determinizmu zmienił się tylko przez nowy kształt snapshotu (wersja 5 i `story`); po usunięciu tych pól hash przebiegu jest identyczny jak wcześniej. Akceptację sprawdza `packages/app/test/m3-loop.test.ts`: od nowej gry przez M0 i trzy fragmenty do każdego zakończenia, z zapisem i odczytem w trakcie aktu i po nim.
