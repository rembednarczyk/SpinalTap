# ADR-0061: Wnętrza jako obszary i zdarzenie wejścia do lokalu

## Kontekst
Wnętrza (ADR-0038) to bryły treści: klinika i Neon Koi w `sim/src/content/interiors.ts`, biuro Tessen w dokach, Trasa Podziemna (`kanal-underground.ts`; mimo nazwy pliku jest w nim tylko Trasa, osobnej bryły kanału nie ma). Drzwi mają czujniki (`door-system.ts`). Symulacja nie wie jednak, czy gracz jest w środku. Brak takiego zdarzenia blokuje:
- autozapis przy wejściu do lokalu, o który poprosił użytkownik (31.10); autozapis zapisuje dziś zamiast tego przy zmianie dzielnicy;
- pogłos i przejście otoczenia we wnętrzach (ADR-0060);
- zaczepki i rozmowy zależne od miejsca (ADR-0060).

## Decyzja
- **Obszary wnętrz w treści `sim`:** lista `INTERIORS` z polami:
  - `id`, np. `clinic`, `neon-koi`, `tessen-office`, `trasa-podziemna` (kanał dopiero, gdy powstanie jego bryła);
  - prostokąty albo pryzmaty z zakresem wysokości, zgodne z bryłami z ADR-0038;
  - klucz nazwy `interior.<id>` w katalogach `i18n/{en,pl}` (ADR-0056).
- **Kontrakt w `core/events`:**
  - `InteriorEntered { interiorId }`;
  - `InteriorLeft { interiorId }`.
- **System `interior`** w `createSystems()`, po ruchu:
  - porównuje pozycję gracza z obszarami, tanio, bo obszarów jest kilka i są w chunku gracza;
  - emituje zdarzenie przy zmianie;
  - trzyma bieżące wnętrze w stanie przejściowym, nie w zapisie;
  - po wczytaniu gry nie emituje zdarzenia, bo stan odtwarza się z pozycji bez autozapisu.
- **Autozapis:** zapisuje przy `InteriorEntered`, gdy przyjdzie bezpieczna chwila. Zmiana dzielnicy zostaje jako drugi wyzwalacz.
- **Audio (ADR-0060):** `InteriorEntered` i `InteriorLeft` przełączają pogłos i warstwę otoczenia.
- **Determinizm:** zdarzenia wynikają z pozycji, bez losowania. Złoty hash się nie zmienia, chyba że stan przejściowy trafi do snapshotu. Wtedy aktualizacja jest świadoma i uzasadniona w commicie.

## Konsekwencje
- Autozapis łapie wejście do kliniki, baru i biura, co na telefonie skraca utratę postępu.
- Kolejne wnętrza dopisuje się jako jeden wpis w `INTERIORS`. Kurator topografii sprawdza, czy obszar zgadza się z budynkiem z OSM.
- Testy sesji bez renderera sprawdzają:
  - wejście i wyjście przez drzwi, z kolejnością zdarzeń;
  - brak zdarzenia po wczytaniu gry wewnątrz lokalu;
  - autozapis po wejściu, odłożony do bezpiecznej chwili.
