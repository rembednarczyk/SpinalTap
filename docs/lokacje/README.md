# Karty lokacji

Każda lokacja gry poza wnętrzami ma tu kartę `<id>.md` (ADR-0102, polecenie użytkownika z 23.11). Lista lokacji to `LOCATIONS` w `tools/rooms/src/locations.ts`. Wnętrza mają karty w `docs/pomieszczenia/` (ADR-0098). Karty powstają partiami, a te jeszcze nienapisane są w `tools/rooms/test/locations-pending.json`. Lista tylko maleje: po napisaniu karty uruchom `LOCATIONS_PENDING=update pnpm exec vitest run tools/rooms/test/locations.test.ts`.

## Części karty
Nagłówki dokładnie jak niżej. Test `tools/rooms/test/locations.test.ts` sprawdza ich obecność.

- `## Historia`: kto miejsce zbudował i kto nim rządzi w 2077, co się tu stało w ostatnich latach, w ostatnich dniach i przed chwilą (§5). Wychodzi od prawdziwej historii miejsca w Lublinie. Cyberpunkowa warstwa leży na niej, nie zastępuje jej (§1).
- `## Klimat`: światło (źródła, kolory i ich znaczenie, §4, §13), dźwięk ze źródeł (§17), zapach, pogoda, kontrast techniki i biedy (§3), ruch i życie.
- `## Przeznaczenie`: po co gracz tu przychodzi, wejścia, przejścia, drogi ucieczki, osłony, punkty widokowe (§9).
- `## Topografia`: prawdziwe miejsce (ulica, obiekt OSM, wysokości z NMT), co w grze się zgadza i jakie są odstępstwa, z odnośnikiem do `docs/topografia.md` (wpis T albo glitch).
- `## Inwentarz docelowy`: rzeczy w trzech warstwach (architektura, duże obiekty, drobiazg w skupiskach, §2, §14). Przy każdej źródło: model gry (§8), model z Blendera (`tools/blender/`) albo generator (ADR-0094, ADR-0096, ADR-0099).
- `## Frakcja i zasady`: wiersz `Frakcja: ulica | technika | korporacja` (druga frakcja po przecinku, gdy jest) i po jednym wierszu na zasadę: `- §12 …` do `- §17 …` z oceną (zgodne, częściowo, dług) i tym, co zrobić. Na zewnątrz §12 dotyczy skali placu i ulicy (kontrast ciasno i szeroko, progi), a §13 proporcji światła w kadrze nocą.
- `## Dług sceny`: lista konkretnych zmian w grze (geometria, rozstawienie, światło, dźwięk, postacie), każda z plikiem, w którym ją zrobić. Pusta lista to `- brak`.
- Karta dzielnicy dodatkowo: `## Spotkania` z każdym spotkaniem ulicznym z `ENCOUNTERS` dzielnicy (id w odwrotnych apostrofach, miejsce, pora, mikroscenka w dwóch zdaniach).

## Scenariusz lokacji fabularnej
Lokacja z `story: true` i wnętrze z `STORY_INTERIORS` mają dodatkowo `## Scenariusz` z sześcioma częściami (jedna strona, jak jednostronicowy projekt poziomu):
- `### Pierwszy kadr`: co gracz widzi i słyszy, gdy wchodzi z najczęstszej strony, i co przyciąga wzrok (światło nawigacji, §13);
- `### Postacie i miejsca`: kto stoi gdzie (współrzędne albo punkt odniesienia), w którą stronę patrzy, co robi, kiedy jest;
- `### Przebieg`: uderzenia sceny po kolei według kroków zadania (`packages/core/src/quest/definitions.ts`, kontrakty) i ink (`packages/narrative/ink/`): napięcie, decyzja, nagroda;
- `### Drogi`: cicha, głośna, ucieczka, skróty, pułapki, osłony;
- `### Pora i stan świata`: dzień i noc (harmonogramy), przed zadaniem i po nim, stan frakcji (terytoria ADR-0091);
- `### Wymagania wobec sceny`: czego scena potrzebuje w geometrii, świetle, dźwięku i rozstawieniu, żeby scenariusz działał. Zestaw z tym, co gra ma, a braki przenieś do `## Dług sceny`.

Scenariusz opisuje fabułę ustaloną w ADR-ach i ink, nie wymyśla nowej. Sprzeczności między ADR, ink i grą wpisz jako dług z propozycją.
