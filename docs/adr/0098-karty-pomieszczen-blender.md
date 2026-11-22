# ADR-0098: Karta pomieszczenia i detal wnętrz z Blendera

Status: Przyjęty (22.11, polecenie użytkownika: „Każde pomieszczenie w grze ma swoją opowiedzianą i spisaną przez Ciebie historię, klimat, przeznaczenie oraz listę użytych propsów, inwentarz pomieszczenia. Na tej podstawie używasz blendera do odtworzenia/stworzenia wszystkich detali w pomieszczeniach… W imię tej zasady poprawisz wszystkie pomieszczenia na komiksowy realizm, oczywiście deterministycznie w grze”).

## Kontekst
Wnętrza gry (16 w `INTERIORS`: klinika, Neon Koi, biuro i hala W-3 z piwnicą, Trasa Podziemna, kapsuła, cztery perony metra, pięć części Alchemii) mają bryłę symulacji i detal z dwóch źródeł:
- prostopadłościany symulacji (`block`), wspólne dla kolizji i rysunku;
- kawałki Alchemii (`Piece`), rysowane przez silnik według rodzaju z prostych brył (`*-geometry.ts`);
- modele z plików `*-props.glb`, wypiekane skryptami numpy z paczek CC0/CC-BY na paletę zestawu miasta (`tools/city_*.py`).
Zasady lokacji (§2, §9) żądają gęstości w trzech warstwach i komiksowego realizmu (kształt jak w rzeczywistości), ale nie mówią, co ma być w danym pomieszczeniu ani dlaczego. Detal powstawał więc z pudełek dobieranych na bieżąco, a nie z historii miejsca.

## Wzorzec
- **Narracja środowiskowa i „kim tu ktoś był”**: H. Smith i M. Worch, „What Happened Here? Environmental Storytelling” (GDC 2010). Pomieszczenie mówi o swoich mieszkańcach przedmiotami.
- **Biblia lokacji (location bible) i karta pomieszczenia**: dokument z historią, nastrojem, funkcją i listą rekwizytów. Tak pracują scenografia filmowa (lista rekwizytów z karty sceny) i działy środowisk w grach (np. „room briefs” u Arkane i w Bethesdzie). Na liście rekwizytów opiera się budowa.
- **Proceduralne modelowanie w DCC ze skryptu**: Blender bez okna (`blender -b --python`), model jako funkcja parametrów i ziarna (jak Houdini Engine czy generatory Blendera w produkcji), wynik deterministyczny i powtarzalny w CI.
Różnice: karta leży w repozytorium obok kodu, a jej część „Inwentarz gry” generuje i sprawdza test (`tools/rooms`). Modele z Blendera trafiają na tę samą paletę i do tych samych plików rekwizytów co dotąd, więc nie dodają wywołań rysowania.

## Decyzja
1. **Karta pomieszczenia.** Każde wnętrze z `INTERIORS` ma plik `docs/pomieszczenia/<id>.md` z pięcioma częściami:
   - Historia: kto zbudował, kto tu był, co się stało, ślad sprzed chwili;
   - Klimat: światło, kolor, dźwięk, zapach, kontrast techniki i biedy;
   - Przeznaczenie: po co gracz tu wchodzi, wejścia i drogi ucieczki;
   - Inwentarz docelowy: rzeczy w trzech warstwach (architektura, duże obiekty, drobiazg), przy każdej źródło: model z Blendera albo model gry;
   - Inwentarz gry: generowany przez `pnpm rooms:write` (`tools/rooms`), czyli to, co gra dziś stawia w obrysie wnętrza.
   Test `tools/rooms/test/cards.test.ts` pada, gdy wnętrze nie ma karty, karcie brakuje części albo inwentarz gry jest nieaktualny. Nowe wnętrze zaczyna się od karty.
2. **Detal z Blendera.** Rzeczy z inwentarza docelowego oznaczone „Blender” budują skrypty `tools/blender/` uruchamiane w Blenderze bez okna:
   - model to funkcja wymiarów i ziarna, bez losowości z zegara;
   - wyjście glTF w metrach, przód +Z, stopa na y = 0, kolory jako role palety zestawu miasta (`city_kit_palette`);
   - skrypt w repozytorium, plik `.glb` wypieczony i zatwierdzony obok innych rekwizytów; przebudowa daje ten sam plik.
3. **Wejście do gry.** Modele mają klucze w rejestrze kształtów (wzorem `CLUTTER_SHAPES`, ADR-0096) i stają we wnętrzu jako rekwizyty o rodzaju z rejestru, z bryłą symulacji z rejestru, jeśli zatrzymuje ciało (§7). Rozstawienie jest deterministyczne (reguła albo hash miejsca).
4. **Przegląd wszystkich wnętrz.** Każde wnętrze przechodzi na detal z karty, kolejno, jedno wnętrze na PR, ze zrzutami przed i po. Kolejność w `docs/backlog.md`.

## Konsekwencje
- Detal wnętrz ma uzasadnienie w historii miejsca i jedną listę rzeczy, którą da się sprawdzić.
- Pudełka symulacji zostają bryłami kolizji. Rysunek przejmują modele, a kształt bryły i rysunku musi się zgadzać (§7, skan `alchemia-off-ground` i podobne).
- Koszt: nowy plik rekwizytów (albo dopisanie do istniejącego) i jego budżet. Bramki zostają te same: wywołania rysowania i aktywne siatki scen `npr-perf`.
- Blender 4.0 jest w obrazie środowiska (`/usr/bin/blender`). Bez niego skrypty się nie uruchomią, ale gra działa na zatwierdzonych plikach `.glb`.
