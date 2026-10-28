# ADR-0037: Fala 3 z uwag gracza: wnętrza i drzwi, start w klinice, dialog na kole, rutyny NPC

## Kontekst
Uwagi z gry na telefonie i desktopie:
1. „Dialogi są mało intuicyjne”: lista przycisków na dole ekranu. Propozycja: wybór na kole zintegrowanym z ekranem, jak w Cyberpunku 2077 albo Mass Effect.
2. „Postacie powinny być w budynkach, drzwi rozsuwają się automatycznie”. Dziś Kaito stoi na ulicy przed Neon Koi, a Mori przed kliniką. Budynki to pełne bryły bez wnętrz.
3. „Postać powinna budzić się u fixera w klinice, taki jest początek”. Dziś Seki budzi się przy wraku na ulicy i szuka Kaito w Neon Koi.
4. „Postacie mają swoje animacje, są częścią świata i mają swoje rutyny”. Harmonogramy (ADR-0017) przenoszą kilka postaci między punktami, ale na miejscu wszyscy stoją tak samo.

Błąd z telefonu („dialog przerywa się po tapnięciu E”) naprawiłem osobno: kliknięcie zgodności trafiało w wybór dialogowy (commit `31c21df`, `ui/src/touch/ghost-click.ts`).

## Decyzja
- **Wnętrza.** Klinika Mori i bar Neon Koi w Shinsekai 7 dostają wnętrza wycięte z istniejących budynków: pokój z ladą, fotelem zabiegowym, barem, stolikami i światłem.
  - Kaito siedzi przy barze w środku, Mori stoi w klinice. Do tego bywalcy i barman.
  - Ściany są bryłami, a wnętrze należy do tego samego chunka.
  - Nawigacja: węzły wnętrza połączone przez drzwi.
- **Drzwi automatyczne.** Byt `door`: płyta przesuwana w bok. Otwiera się, gdy postać (gracz albo NPC) jest w promieniu czujnika, i zamyka po chwili. Zamknięta drzwi blokują przejście i linię wzroku.
  - Mechanizm podobny do bramek windy z ADR-0020, ale ruch jest w bok, a nie w dół.
  - Silnik dostaje ruch przez `updateTransform`, jak bramki.
  - Część drzwi może być zamknięta na stałe albo na kod, na przykład biuro Tessen z kodem z haka (ADR-0034).
- **Start w klinice.**
  - Nowa gra zaczyna się na fotelu w klinice Mori, z krótką sceną przebudzenia: Mori mówi, co z niej wyciągnął, a Kaito, który zapłacił za łatanie, czeka obok.
  - Pierwsza rozmowa z Kaito odbywa się w klinice. Wrak na Siódmej zostaje jako miejsce w świecie i wspomnienie.
  - Krok questa „Znajdź fixera przy barze” zmienia się zgodnie z tym. Testy e2e i aplikacji, które teleportują do Kaito, przechodzą na nowe miejsca.
- **Dialog na kole.**
  - Wybory ukazują się na łuku albo kole obok rozmówcy, a nie w liście na dole.
  - Każda opcja ma rodzaj (`tone`) z tagu ink, z kolorem i ikoną jak w CP2077: główna, poboczna, wyjście, agresja, perswazja, hack, opcja z historii postaci.
  - Wybór działa myszą (najechanie i klik), klawiszami 1-6, strzałkami albo kółkiem z E/Enter, gałką pada i dotykiem.
  - Napisy rozmowy zostają na dole. Opcja „wyjście” zawsze w tym samym miejscu koła.
- **Rutyny i aktywności.** `ActivityId` (`core/world/wave2.ts`):
  - wartości: idle, smoke, phone, lean, sit, eat, drink, cook, sweep, talk, sleep, terminal, guard;
  - przystanki harmonogramu i miejsca aktywności (smart spots: ławka, bar, stragan, ściana do oparcia, automat) dają postaci aktywność, a postacie bez harmonogramu dostają krótkie rutyny między takimi miejscami;
  - przechodnie chodzą między miejscami dystryktu, a sprzedawcy gotują i sprzątają w godzinach pracy;
  - renderer dostaje aktywność przez `RenderPort.setActivity?(id, activity | null)` i gra pasującą animację na rigach i modelach VRoid.

## Zasady
- Wszystko deterministyczne w sim: czasy aktywności z zegara gry albo `RandomPort`.
- Zapis: nowe pola, czyli stan drzwi i bieżąca aktywność, gdy nie wynika z zegara, wchodzą z migracją. Złote hashe zmieniają się świadomie, z opisanym powodem.
- Architektura z ADR-0031: nowy kontroler, prezenter i intencje w app/UI, nowa część za fasadą renderera.

## Konsekwencje
- Zmienia się kadr referencyjny M0, jeśli klinika i bar zmieniają fasady w kadrze: nowa migawka obejrzana przed commitem.
- Scena otwarcia zmienia pierwsze minuty gry i testy, które zakładały start przy wraku.
