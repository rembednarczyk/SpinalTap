# ADR-0032: Kontrakty fali 2: metro, radio, przebrania, cyberware, warianty zleceń, spotkania

## Kontekst
Fala 2 z raportu `docs/research/reports/Research mechanik gier cyberpunk.md` (sekcja „Kolejność wdrożenia”) obejmuje:
- metro między dystryktami;
- radio;
- przebrania z regułą egzekutorów;
- pojemność cyberware z perkami, które zmieniają sposób gry (zryw, zryw w powietrzu, odbijanie pocisków);
- jedzenie z buffami;
- generator wariantów zleceń i haki obserwacyjne;
- uliczne spotkania;
- minimapę z dynamicznym zoomem, znaczniki obszaru i tryb bez znaczników;
- układ dotykowy z łukiem akcji i progi mokrego asfaltu.

Tak jak w ADR-0028, kontrakty ustalam z góry, żeby warstwy powstawały równolegle. Architektura z ADR-0031 obowiązuje: każda funkcja dostaje w app własny kontroler i prezenter, w UI wąski interfejs intencji i hook, a w engine własną część za fasadą `BabylonRenderer`.

## Decyzja: kontrakty
- **Słownik** (`core/src/world/wave2.ts`):
  - `MetroStationId`: shinsekai, kanal, targ, doki;
  - `BuffId`: regen, quick_cooldown, steady;
  - `DisguiseRole`: hebi, tessen_guard, tessen_staff;
  - warianty zleceń: `ContractModifier` (night_only, time_limit, bodyguards, ambush, twin), `SecurityProfile` (light, standard, lockdown), `TargetTrait` (paranoid, drinker, creature_of_habit, armored) i `ContractVariation` z opcjonalnym zwrotem akcji (wrong_target, setup).
- **Zdarzenia:**
  - `Dashed`, `ProjectileReflected`, `CyberwareCapacityChanged`;
  - `BuffApplied`, `BuffEnded`;
  - `DisguiseChanged`, `DisguiseBlown`;
  - `MetroDeparted`, `MetroArrived`;
  - `EncounterStarted`, `EncounterEnded`;
  - `ContractHookFound`.
- **Komenda** `travel-metro { to }`. W tabeli handlerów jest zaślepka, którą zastąpi implementacja.
- **Wejście:** `InputFrame.dash` (krawędź). Klawiatura: lewy Alt, z blokadą menu przeglądarki. Pad i dotyk dostają przypisanie w fali 2. Klawisz jest na liście w ustawieniach.
- **Radio** to czysta prezentacja: stan stacji żyje w app i audio, bez symulacji. Głośnik w barze jest pozycyjnym źródłem w audio.

## Decyzja: reguły
- **Metro.**
  - Peron w każdym dystrykcie z interakcją „Bilet” (kiosk biletowy) i opłatą €$.
  - Przejazd trwa kilka sekund scenki w wagonie: okno z paralaksą, statyści, czasem kwestia z ink.
  - W tym czasie streamer ładuje dystrykt docelowy, a gracz wysiada na peronie docelowym.
  - W trakcie zlecenia z heat > 0 metro nie przyjmuje gracza, bo ochrona pilnuje peronu.
- **Pojemność cyberware.**
  - Każdy implant ma koszt 2-8, a pula rośnie z ukończonymi zleceniami i shardami.
  - Montaż ponad limit jest odrzucany.
  - Nowe implanty: nogi ze zrywem (także w powietrzu, raz na skok) i ostrze z odbijaniem pocisków przy bloku bronią białą i wytrzymałości powyżej progu.
  - Zryw ma odnowienie i daje krótką nietykalność na trafienia z broni palnej.
- **Buffy.** Ramen daje regenerację, kawa syntetyczna szybsze odnowienie zdolności. Buff ma czas i ikonę w HUD i wchodzi do zapisu.
- **Przebrania.**
  - Ubranie z rolą, np. kurtka Hebi albo mundur Tessen, ustawia `apparentRole`.
  - Podejrzenie rośnie tylko u egzekutorów (oznaczeni ikoną) albo u każdego przy czynie zabronionym: dobyta broń, bieg w strefie, wejście za barierkę.
  - Zdemaskowanie emituje `DisguiseBlown` i działa jak wykrycie.
- **Warianty zleceń.**
  - Przy przyjęciu zlecenie losuje z `RandomPort` modyfikatory, profil ochrony, cechę celu i rzadki zwrot akcji.
  - Wariant zmienia plan: porę, liczbę i ochronę wrogów, czas, zasadzkę, sobowtóra.
  - Wariant jest w zapisie, a karta podsumowania go pokazuje.
- **Haki obserwacyjne.**
  - Jeden lub dwa na szablon: podsłuchana kwestia strażnika, mail na terminalu, shard.
  - Każdy ujawnia rozwiązanie systemowe wynikające z harmonogramu NPC (luka w rotacji, kod, nawyk celu).
  - Po odkryciu hak trafia do trackera (`ContractHookFound`).
- **Spotkania uliczne.**
  - 3-5 scen ink na dystrykt, każda w 1-3 krokach, wyzwalanych porą dnia i harmonogramem.
  - Jednorazowe, z nagrodą albo konsekwencją w reputacji.
  - Do tego mikrozdarzenia w stylu Scanner Hustles, czyli jednoetapowa walka albo pomoc.
- **HUD.**
  - Minimapa oddala się przy sprincie i zrywie, a strzałka gracza siedzi w dolnej tercji.
  - Na mapie są tylko przyjęte zlecenia i fixerzy, a znacznik celu pokazuje obszar zamiast wejścia.
  - W ustawieniach jest tryb bez znaczników.
- **Dotyk.** Łuk akcji drugorzędnych wokół przycisku ognia, kontekstowy przycisk „Użyj”, cele o boku co najmniej 44 px, `safe-area-inset`.
- **Mokry asfalt.** Trzy progi jakości: maska i pasy odbić na `low`, statyczna sonda na `medium`, opcjonalny SSR tylko na drodze na `high`. Mieści się w budżetach.
- **Zapis.** Pola fali 2 (buffy, rola przebrania, wariant i haki zlecenia, zużyte spotkania, pojemność) wchodzą z podbiciem `SAVE_SCHEMA_VERSION` i migracją. Przy łączeniu gałęzi migracje numeruje się kolejno.

## Podział pracy (fala 2)
- **Sim A (ruch, walka, ciało):** zryw i zryw w powietrzu, odbijanie pocisków, pojemność cyberware, nowe implanty, buffy z jedzenia, przebrania i egzekutorzy.
- **Sim B (świat i zlecenia):**
  - metro (perony, `travel-metro`, przejazd ze streamingiem);
  - generator wariantów zleceń, haki obserwacyjne;
  - wyzwalacze spotkań ulicznych i mikrozdarzeń w sim.
- **Narracja:** sceny spotkań, kwestie w wagonie, haki (barki strażników, maile), kwestie fixerów o wariantach.
- **App i UI:**
  - widok metra (mapa linii i przejazd), wybór stacji radia i lista stacji;
  - pojemność cyberware w panelu ripperdoka, ikony buffów, wskaźnik przebrania i egzekutorów;
  - minimapa z dynamicznym zoomem, znaczniki obszaru, tryb bez znaczników;
  - łuk dotykowy, spotkania i haki w trackerze, wariant na karcie.
- **Engine:**
  - scena wagonu (paralaksa za oknem, statyści), radio jako stacje sekwencera z audycjami i głośnikiem pozycyjnym;
  - efekty zrywu i odbicia;
  - wygląd przebrań na modelach;
  - progi mokrego asfaltu;
  - przypisanie zrywu na padzie i dotyku.

## Zmiany kontraktu
Same dopiski. Zmiany sim A, opisane w [ADR-0033](0033-fala-2-cialo-zryw-pojemnosc-buffy-przebrania.md):
- `ProjectileReflected` dostaje `to: Vec3` (dokąd poleciał odbity pocisk) i `hitEntity: EntityId | null` (kogo trafił). Engine rysuje z tego smugę.
- `ViewDescriptor` wroga (`kind: "enemy"`) dostaje opcjonalne `enforcer?: boolean`. Egzekutor widzi przez przebranie, a HUD pokazuje nad nim ikonę.
- `PurchaseFailure` dostaje `"over-capacity"`: implant przekracza pojemność cyberware.

## Konsekwencje
- Nowa komenda, zdarzenia i pole wejścia nie zmieniają złotych hashy. Implementacja zmieni je świadomie.
- Pojazdy sterowane przez gracza zostają poza zakresem (raport: odradzane).
