# ADR-0065: Obezwładnienie bez zabijania, ogłuszenie i ukrywanie ciał

## Kontekst
Audyt luk (31.10, `docs/audyt-luk.md`, Skradanie, P0) pokazał, że gra nie ma obezwładnień. Jedyne ogłuszenie to krótki stan po sparowanym ciosie (`parryStun`, `melee-system.ts`). Tymczasem ADR-0059 zakłada je w trzech miejscach:
- źródło XP „skradanie: obezwładnienie bez alarmu”;
- drzewko Cień (`shadow`): „skradanie, obezwładnienia, przebrania”;
- perk „przeładowanie po obezwładnieniu bez alarmu”.

Bez obezwładnień etapy 1–3 ADR-0059 dla drzewka Cień nie mają czego liczyć, a skradanie kończy się strzałem albo ucieczką. Świadkowie, heat i ostatnia znana pozycja z ADR-0029 już istnieją, więc obezwładnienie może się do nich podpiąć bez nowego modelu wykrywania.

## Decyzja
- **Obezwładnienie (takedown)** to czynność gracza w zwarciu:
  - cel to NPC z `combatant` i `health` (gangerzy, ochrona; cywile też, z konsekwencjami niżej), w odległości do `TAKEDOWN_REACH` = 1,6 m, w stożku 120° za jego plecami albo w dowolnym kierunku, gdy cel jest ogłuszony (`parryStun`) lub nieświadomy gracza (stan AI bez śladu gracza);
  - przy celu zaalarmowanym, który patrzy na gracza, obezwładnienie nie jest dostępne: zostaje zwykła walka;
  - trwa `TAKEDOWN_TIME` = 1,2 s; gracz i cel są w tym czasie unieruchomieni, a obrażenie zadane graczowi przerywa obezwładnienie (cel się wyrywa i jest zaalarmowany);
  - dwa warianty, wybierane w ustawieniach (domyślnie bez zabijania) i w trakcie przytrzymaniem drugiego przycisku: **ogłuszenie** (cel `unconscious`) albo **zabicie** (jak dziś śmierć w walce).
- **Stan `unconscious`** (komponent w `sim`):
  - ciało leży, nie widzi, nie słyszy, nie walczy i nie jest celem AI;
  - nie budzi się samo w czasie gry; budzi go NPC, który znajdzie ciało i do niego podejdzie (po `WAKE_TIME` = 6 s), a obudzony jest zaalarmowany i zna ostatnią pozycję gracza sprzed obezwładnienia;
  - zapis gry przechowuje stan (zmiana schematu: `SAVE_SCHEMA_VERSION` + migracja w `packages/persistence/src/migrations.ts`, stare zapisy bez ogłuszonych).
- **Świadkowie i heat (ADR-0029):**
  - obezwładnienie widziane przez świadka jest przestępstwem „napaść” (heat jak przy ataku na cywila, o jeden poziom niżej niż zabójstwo); niewidziane nie jest przestępstwem;
  - ciało (ogłuszone albo martwe) zauważone przez NPC daje podejrzenie: NPC idzie do ciała, wszczyna poszukiwanie od ostatniej znanej pozycji i dla ochrony wzywa wsparcie jak przy zgłoszeniu; kamera widząca ciało działa jak świadek;
  - cywil obezwładniony bez świadków nie daje heatu, ale znalezione ciało cywila podnosi czujność dzielnicy jak dziś zwłoki.
- **Przenoszenie i ukrywanie ciał:**
  - gracz podnosi ciało w zasięgu 1,6 m; niesie je wolniej (`CARRY_SPEED` = 0,6 prędkości chodu), bez broni w ręku, bez sprintu i skoku; upuszcza w dowolnej chwili;
  - ciało włożone do kryjówki (kontener, śmietnik, szafka: rekwizyty z flagą `hide` w danych) znika z widoku NPC i nie daje podejrzenia;
  - w danych chunków (sim `content`) dochodzą kryjówki przy posterunkach i w Dokach; każde zlecenie skradania ma co najmniej jedną.
- **Kontrakty (zmiana granic, zgoda w tym ADR-ze):**
  - komenda `takedown` (`core/src/commands`) z polem `lethal: boolean`, komendy `carry-body` i `drop-body`;
  - zdarzenia `TakedownStarted`, `TakedownDone { target, lethal, witnessed }`, `TakedownBroken`, `BodyFound { body, finder }`, `BodyHidden` (`core/src/events`);
  - widok NPC dostaje pole `unconscious` (renderer: poza leżąca, bez animacji), a HUD podpowiedź kontekstową „Obezwładnij / Zabij / Podnieś” (teksty w katalogach i18n en/pl, ADR-0056).
- **XP i perki (ADR-0059):** `TakedownDone` bez alarmu i bez świadka zasila źródło „skradanie”; drzewko Cień skraca `TAKEDOWN_TIME` i daje perk przeładowania z ADR-0059. Liczby balansu ustala etap 8 ADR-0059.
- **Determinizm:** wszystko w `sim` przez komendy i kroki symulacji, bez losowania (kolejność celów i wynik są regułą); zmiany złotych hashy świadome, z uzasadnieniem w commicie.
- **Dotyk i pad:** obezwładnienie i podnoszenie to ten sam przycisk interakcji z podpowiedzią kontekstową; wariant zabicia przytrzymaniem przycisku walki wręcz. Bez nowego przycisku na ekranie telefonu.

## Etapy (osobne PR-y)
1. Kontrakty, obezwładnienie i stan `unconscious` w `sim` (zasięg, stożek, czas, przerwanie, oba warianty), testy symulacji; HUD z podpowiedzią i i18n.
2. Świadkowie, przestępstwo „napaść”, znalezione ciało i budzenie (`BodyFound`, poszukiwanie, wsparcie), testy sesji bez renderera.
3. Przenoszenie i kryjówki (dane chunków, `BodyHidden`), zapis i migracja schematu.
4. Renderer (poza leżąca, animacja obezwładnienia na modelach VRM) i XP/perki z ADR-0059.

## Konsekwencje
- Skradanie dostaje własne zakończenie starcia i daje sens drzewku Cień; etapy 1–3 ADR-0059 mogą liczyć XP ze skradania.
- Rośnie liczba stanów AI do przetestowania (nieświadomy, ogłuszony, znalazł ciało); każdy etap ma testy sesji z `freeze` + `step` (ADR-0046).
- Zapis gry zmienia schemat w etapie 3.
- Cywile też mogą być obezwładnieni, co otwiera nadużycia (czyszczenie ulic bez heatu); hamulcem jest znalezione ciało i czujność dzielnicy, a balans sprawdzi etap 8 ADR-0059.
