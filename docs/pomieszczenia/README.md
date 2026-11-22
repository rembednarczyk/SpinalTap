# Karty pomieszczeń

Każde wnętrze gry (`INTERIORS` w `packages/sim/src/content/interior-areas.ts`) ma tu kartę `<id>.md` według `docs/zasady-lokacji.md` §11 i ADR-0098:
- **Historia:** kto miejsce zbudował, kto w nim bywa, co się stało przed chwilą;
- **Klimat:** światło, kolor, dźwięk, zapach, kontrast techniki i biedy;
- **Przeznaczenie:** po co gracz tu wchodzi, wejścia i drogi ucieczki;
- **Inwentarz docelowy:** rzeczy w trzech warstwach, przy każdej źródło (Blender albo model gry);
- **Inwentarz gry:** generowany przez `pnpm rooms:write` z tego, co gra stawia w obrysie wnętrza (props chunków, modele i meble, kawałki Alchemii). Wnętrza rysowane osobnym kodem silnika albo modelem (kapsuła, perony metra, P-2) pokazują tu mniej, niż widać w grze; opis w karcie mówi, skąd pochodzi reszta.

Test `tools/rooms/test/cards.test.ts` sprawdza, że karta istnieje, ma pięć części i aktualny inwentarz gry.
