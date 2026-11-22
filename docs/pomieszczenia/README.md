# Karty pomieszczeń

Każde wnętrze gry (`INTERIORS` w `packages/sim/src/content/interior-areas.ts`) ma tu kartę `<id>.md` według `docs/zasady-lokacji.md` §11 i ADR-0098:
- **Historia:** kto miejsce zbudował, kto w nim bywa, co się stało przed chwilą;
- **Klimat:** światło, kolor, dźwięk, zapach, kontrast techniki i biedy;
- **Przeznaczenie:** po co gracz tu wchodzi, wejścia i drogi ucieczki;
- **Inwentarz docelowy:** rzeczy w trzech warstwach, przy każdej źródło (Blender albo model gry);
- **Frakcja i zasady:** wiersz `Frakcja: ulica | technika | korporacja` (§16, z frakcją drugą, gdy jest) i po jednym wierszu na §12–§17: zgodne, częściowo albo dług, z tym, co trzeba zrobić. Dług trafia do kolejki „Zasady pomieszczeń w całej grze” w `docs/backlog.md`;
- **Inwentarz gry:** generowany przez `pnpm rooms:write` z tego, co gra stawia w obrysie wnętrza (props chunków, modele i meble, kawałki Alchemii). Wnętrza rysowane osobnym kodem silnika albo modelem (kapsuła, perony metra, P-2) pokazują tu mniej, niż widać w grze; opis w karcie mówi, skąd pochodzi reszta.

Pod inwentarzem gry ten sam blok podaje pomiary zasad (§12–§16): rzut i wysokości, wymiary na siatce 0,5 m, architekturę i trzy warstwy wyposażenia, drobiazg w skupiskach i luzem, widoczne źródła światła. Liczą tylko to, co symulacja daje rysunkowi (`tools/rooms/src/measures.ts`). Model z Blendera, który sam jest skupiskiem drobiazgu (kubek, kanapka i kask nocnej zmiany), podaje w rejestrze kształtów liczbę rzeczy w sobie (`clutter` w `room-detail.ts`) i liczy się jako tyle rzeczy w jednym skupisku; rury, korytka, poręcze i łaty muru mają `services` i liczą się do architektury. Para z kuchni nie jest rzeczą, a ekrany menu, ekspresy i kasy to mezo.

Test `tools/rooms/test/cards.test.ts` sprawdza, że karta istnieje, ma sześć części, frakcję i wiersz każdej zasady oraz aktualny inwentarz gry z pomiarami.
