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

## Uzupełnienie (31.10): okna wnętrz
Wymóg użytkownika: wnętrze ma okna tam, gdzie ma je budynek.
- Każde okno elewacji, za którym leży wnętrze z `INTERIORS`, jest prawdziwym otworem z szybą, a nie tylko oknem namalowanym przez shader fasady (ADR-0022). Z ulicy widać przez nie wnętrze (w nocy podświetlone), ze środka ulicę i miasto.
- Siatka okien wnętrza bierze się z tej samej ramy co fasada (`facade-frame`: kondygnacje, przęsła, styl okien), więc otwory w ścianie wnętrza i na elewacji pokrywają się co do przęsła i kondygnacji. Ściana wnętrza nie dostaje okna tam, gdzie elewacja ma ślepą ścianę, witrynę zastąpioną drzwiami albo ścianę wspólną z sąsiednim budynkiem.
- Zabytki z przepisem (ADR-0062) dają oknom wnętrza swoje kształty: ostrołuki, okna półkoliste, okna kościelne z witrażem.
- Szyba nie przepuszcza gracza ani pocisków (kolizja ściany w `sim` bez zmian); linia widzenia przez okno dla AI i świadków jest osobną decyzją przy etapie, który ją potrzebuje.
- Kontrola w skanie: okno elewacji przy wnętrzu bez otworu we wnętrzu i otwór we wnętrzu bez okna na elewacji, baza 0. Weryfikator i kurator sprawdzają to przy każdym nowym wnętrzu.
- Dotyczy też istniejących wnętrz (klinika, Neon Koi, biuro Tessen): do sprawdzenia i dorobienia jako osobny etap.

## Uzupełnienie (31.10): limit autozapisu przy wejściu
Wejście do lokalu i zmiana dzielnicy nie robią autozapisu, gdy poprzedni autozapis (z dowolnego powodu) był mniej niż 60 s wcześniej (`AUTOSAVE_PLACE_COOLDOWN_TICKS`). Taki wyzwalacz jest odrzucany, nie odkładany: wejście do innego lokalu 10 s po zapisie z kroku zadania nie zapisze się do najbliższego interwału. Nowa gra i wczytanie zerują limit. Powód: drzwi są wąskie, a kroczenie w progu bez limitu dawało zapis z dźwiękiem i toastem co kilka sekund.
