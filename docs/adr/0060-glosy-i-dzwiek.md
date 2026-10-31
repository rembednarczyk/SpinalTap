# ADR-0060: Głosy postaci i bohaterki, rozbudowa dźwięku

## Kontekst
Gra nie ma dialogów mówionych.
- Są napisy dialogów z mówcą (`ui/src/dialogue`) i syntezowane głosy efektów (`engine/src/audio/synth-voices.ts`).
- SFX to nagrania CC0 i synteza (`app/public/audio`, ADR-0013).
- Miks ma szyny, ale ustawienia mają tylko głośność główną (audyt luk, `docs/audyt-luk.md`).

Decyzje użytkownika (31.10):
- **Źródło głosów:** wszystko z otwartego TTS na licencji komercyjnej, każdy głos sprawdzany osobno. Aktorów nie będzie (zmiana decyzji z 31.10: najpierw mieszane, potem pełne TTS).
- **Język głosów:** angielski, z napisami po angielsku albo po polsku według ustawienia języka (ADR-0056).

## Decyzja

### Zakres głosów
1. **Odzywki (barki):** krótkie, powtarzalne linie w walce, skradaniu i tłumie.
   - Wrogowie: wykrycie, szukanie, alarm, przeładowanie, rana, śmierć, utrata celu.
   - Cywile: zaczepka, strach, świadek dzwoni.
   - Seki: trafienie, przeładowanie, niski poziom zdrowia, udany hack, awans (ADR-0059).
   - Na typ postaci przypada 20–40 linii, w 2–3 wariantach głosu na typ wroga i cywila.
   - Wszystkie odzywki pochodzą z TTS.
2. **Kluczowe linie wątku:** powitania postaci nazwanych, zwroty akcji, zakończenia aktów i linie Seki w scenach. Z TTS, każda postać nazwana ma stały, własny głos.
3. **Pełne dialogi** postaci nazwanych, z TTS, dzielnica po dzielnicy.
4. **Kwestie środowiskowe:** zaczepki i komentarze przechodniów oraz zasłyszane rozmowy NPC między sobą (sekcja „Wyzwalacze kwestii”).

### Źródła i licencje
- **TTS:**
  - Tylko modele i głosy, których licencja pozwala na komercyjną dystrybucję wygenerowanego audio.
  - Każdy model i każdy głos sprawdzamy osobno. Kod, wagi i nagrania treningowe głosu bywają na różnych licencjach, a głos z licencją niekomercyjną odpada.
  - W `packages/app/public/voice/README.md` zapisujemy model, wersję, głos, licencję z cytatem i datę sprawdzenia.
  - Nie klonujemy głosów prawdziwych osób bez ich pisemnej zgody.
- **Wybór głosów:** każda postać nazwana dostaje jeden głos i ustawienia (tempo, wysokość, barwa), zapisane w `tools/voice/voices.json`, żeby przy kolejnych generacjach brzmiała tak samo. Typy postaci tła (ganger, strażnik Tessen, cywil, handlarz) mają po 2–3 warianty.
- **Generowanie TTS:** robi to narzędzie `tools/voice` (offline, deterministyczne ustawienia głosu, normalizacja głośności). Repo trzyma skrypt i wynik, ale nie trzyma modeli.

### Klucze i struktura
- Każda linia mówiona ma klucz.
  - W ink jest to tag `#voice:<klucz>` przy linii. Test strukturalny ink (ADR-0056) pilnuje, że `ink/en` i `ink/pl` mają te same tagi.
  - Odzywki są w katalogu `core`/`sim` jako klucze zdarzeń, np. `bark.ganger.alerted`, z listą wariantów.
- Pliki leżą w `app/public/voice/en/<postać>/<klucz>.ogg` (Opus/OGG).
- Brak pliku nie jest błędem: zostaje sam napis, tak jak dziś.

### Wyzwalacze kwestii
Trzy rodzaje, wszystkie rozstrzygane w `sim` (deterministycznie, losowość przez `RandomPort`), a odtwarzane w `engine` przez `AudioPort`:
1. **Tylko przy interakcji:** postacie nazwane (Kaito, Mori, Ume, Hana, Genzō, barman) i handlarze mówią, gdy gracz zacznie rozmowę albo wejdzie w ich scenę. Bez zaczepek, chyba że treść tak chce (np. powitanie przy wejściu do baru jako jedna linia).
2. **Zaczepki i komentarze (jedna osoba, jedna linia):** przechodzień, handlarz na targu, strażnik czy ganger mówi krótko, gdy gracz przechodzi obok:
   - warunki z treści: dystans (np. 3–6 m), patrzy w stronę gracza, gracz się zatrzymał albo przechodzi, stan gracza (broń w ręce, przebranie, poziom pościgu, rana, deszcz, pora doby, reputacja frakcji, ukończony krok zadania);
   - linie wybierane z puli według warunków i wag, bez powtórzeń z ostatnich kilku;
   - limity: jedna zaczepka na NPC na kilka minut, globalnie najwyżej jedna naraz w zasięgu słuchu i przerwa między nimi.
3. **Zasłyszane rozmowy NPC (dwie lub trzy osoby, 2–6 linii):** w miejscach z treści (kolejka do budki z jedzeniem, ławka na Placu Litewskim, palacze pod Neon Koi, ochrona przy bramie, handlarze na targu) pary NPC wymieniają kwestie, gdy gracz jest w zasięgu słuchu:
   - rozmowa startuje, gdy gracz wejdzie w promień miejsca, i toczy się dalej, gdy odejdzie (słychać ją ciszej, z kierunku);
   - przerwana przez walkę, alarm albo zaczepienie gracza (jeden z NPC zwraca się do gracza krótką linią);
   - treść rozmów zależy od stanu świata: flag wątku, zakończeń aktów, reputacji, pory doby, więc miasto komentuje to, co gracz zrobił;
   - każda rozmowa gra raz na jakiś czas (stan „słyszane” w zapisie, z ograniczonym rozmiarem), żeby się nie powtarzała.
- **Treść:** zaczepki to tabele w `sim/src/content` (klucz, warunki, waga, mówca), rozmowy to krótkie knoty ink `amb-*` z tagami mówców i `#voice`, w obu językach napisów (ADR-0056).
- **Napisy w świecie:** zaczepki i rozmowy pokazują się jako krótkie napisy nad mówiącym (z nazwą lub typem postaci), znikające; opcja w ustawieniach (wł./wył., rozmiar z ustawień napisów).
- **Priorytety:** dialog z graczem > odzywki walki i alarmu > zaczepki > rozmowy w tle. Wyższy priorytet ścisza albo przerywa niższy.
- **Zdarzenia:** `sim` emituje `LineSpoken { speakerId, key, kind }` (kontrakt w `core/events`, zmienia architekt). Dźwięk i napis wynikają ze zdarzenia, więc testy sesji widzą, kto i co powiedział, bez przeglądarki.

### Odtwarzanie
- `AudioPort` dostaje nową szynę `dialogue`. Dochodzi też suwak głośności dialogu w opcjach, obok suwaków muzyki, SFX i radia z audytu.
- **Ducking:** muzyka i radio cichną pod mową.
- **Odzywki w świecie są przestrzenne** (`spatial.ts`) i mają limity:
  - najwyżej jedna odzywka na postać naraz;
  - najwyżej 2–3 odzywki w całej scenie;
  - przerwa między powtórzeniem tej samej linii.
- **Dialogi:** linia odtwarza się razem z napisem. Pominięcie linii ucina dźwięk.
- **Ładowanie:**
  - Pliki pobierają się w tle przy wejściu do dzielnicy (razem z zaczepkami i rozmowami tej dzielnicy).
  - Linie dialogu są pobierane z wyprzedzeniem jednej sceny.
  - Odzywki trafiają do małego wspólnego pakietu, który ładuje się na ekranie ładowania (ADR-0057).
  - Budżet rozmiaru na telefon: pakiet odzywek do ok. 3 MB, a reszta strumieniowo.

### Dźwięki
Źródła są wyłącznie CC0 (Kenney, Freesound CC0, OpenGameArt CC0), a licencje zapisujemy w README katalogu, jak przy ADR-0058. Dochodzi:
- **kroki według nawierzchni:** bruk, asfalt, metal, kałuże, drewno. Nawierzchnię bierzemy z `GroundSurface` i `surfacesAt`;
- **foley broni:** przeładowania, puste magazynki, wyciąganie i chowanie;
- **warstwy otoczenia dla każdej dzielnicy:** targ, deptak, nabrzeże, Stare Miasto. Przejścia między nimi są płynne;
- **ruch:** auta i trolejbusy z kierunku, drony, brzęczenie neonów z bliska;
- **deszcz:** zależny od pogody, gdy pogoda stanie się stanem (audyt P2). Do tego czasu deszcz jest stały, jak dziś;
- **pogłos we wnętrzach:** klinika, Neon Koi, Trasa Podziemna;
- **dźwięki UI.**

## Etapy
1. **Szyny i ustawienia:** szyny `dialogue`, `music`, `sfx` i `radio` z suwakami, ducking.
2. **Kroki i otoczenie:** kroki według nawierzchni, warstwy otoczenia dzielnic, foley broni.
3. **Potok głosów:** `tools/voice`, sprawdzone głosy TTS, `voices.json`, odzywki walki z kluczami w zdarzeniach, odtwarzanie przestrzenne z limitami. Na początek ganger, cywil i Seki.
4. **Wyzwalacze kwestii:** zdarzenie `LineSpoken`, zaczepki z warunkami i limitami, napisy w świecie, pierwsze zasłyszane rozmowy w Krakowskim i na targu.
5. **Tagi `#voice` w ink i kluczowe linie wątku w TTS.**
6. **Pełne dialogi postaci nazwanych i rozmowy w tle w pozostałych dzielnicach,** stopniowo.

## Konsekwencje
- Wszystkie głosy są po angielsku, a gracz z polskim ustawieniem słyszy angielski i czyta polskie napisy. Polskiego dubbingu nie planujemy.
- Bez aktorów cała mowa zależy od jakości TTS: wybór modelu i głosów sprawdzamy na odsłuchu, zanim pójdzie do treści, a jakość ocenia użytkownik.
- Rośnie rozmiar gry. Odzywki są w pakiecie, a reszta strumieniowo z budżetem dla telefonu.
- Każdy głos TTS i każde nagranie mają w repo zapis licencji. Głos bez potwierdzonej licencji komercyjnej nie wchodzi do gry.
- Testy:
  - logika wyzwalaczy i odtwarzania (warunki, limity, priorytety, ducking, wybór wariantu, brak powtórzeń, przerwanie rozmowy) testowana w sesji bez przeglądarki, z fałszywym `AudioPort`;
  - kompletność tagów `#voice` sprawdza test ink;
  - rozmiar pakietu pilnowany w budżetach.
