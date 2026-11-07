# ADR-0060: Głosy postaci i bohaterki, rozbudowa dźwięku

## Kontekst
Gra nie ma dialogów mówionych.
- Są napisy dialogów z mówcą (`ui/src/dialogue`) i syntezowane głosy efektów (`engine/src/audio/synth-voices.ts`).
- SFX to nagrania CC0 i synteza (`app/public/audio`, ADR-0013).
- Miks ma szyny, ale ustawienia mają tylko głośność główną (audyt luk, `docs/audyt-luk.md`).

Decyzje użytkownika (31.10):
- **Źródło głosów:** wszystko z otwartego TTS na licencji komercyjnej, każdy głos sprawdzany osobno. Aktorów nie będzie (zmiana decyzji z 31.10: najpierw mieszane, potem pełne TTS).
- **Język głosów:** angielski, z napisami po angielsku albo po polsku według ustawienia języka (ADR-0056).

## Decyzje użytkownika (7.11)
Zmieniają źródło głosów z „otwartego TTS” na ElevenLabs. Reszta ADR-u (klucze, wyzwalacze, odtwarzanie, etapy) zostaje.
- **Źródło głosów:** ElevenLabs (konto użytkownika), głosy z biblioteki ElevenLabs udostępniane przez lektorów, a gdzie biblioteka nie ma pasującego głosu, głos zaprojektowany z opisu (Voice Design).
- **Gra jest niekomercyjna.** Mimo to każdy głos ma w `packages/app/public/voice/README.md` zapis: nazwa i identyfikator głosu, autor, model, data i warunki użycia, a ekran „Autorzy” wymienia ElevenLabs i autorów głosów.
- **Oszczędzanie kredytów:** jedna próbka na linię (bez wariantów do wyboru); generowanie tylko linii, które wchodzą do gry; odsłuch kandydatów na podstawie darmowych próbek z biblioteki.
- **Obsada (głosy z biblioteki, identyfikatory ElevenLabs):**

| Postać | Głos | Id |
|---|---|---|
| Seki | Emma, Wry Gritty Hero | `dmWfLQZJq7wNPv9WmtiM` |
| Kaito | Silas, Weathered Villain | `WzVKtqQpTUUQ2JNx8YxI` |
| Kurosawa | Malakai, Shadowed and Gruff | `7squ7rvxEIZ2rYy7KYPP` |
| Mori | Jonah Vale | `vveagfomyMCJLZsOPRP2` |
| Ume | Mora, Gritty and Enigmatic | `YHcCpa6SBWnKDaCPZJQR` |
| Genzō | Gravel Midnight | `M5E055lOUxMi0kJpGyE9` |
| Ren | Thomas | `IigRH4ZsY7dfxk9VRn2r` |
| Hana | Ruby B, London Playful | `jUPSOpRcPt8GMPsWx5fy` |
| gangerzy i mieszkańcy | Amir, Deep Voice, Polish Accent | `lh3DpiIvYKliryahXrpY` |

- Angielskiego z japońskim akcentem biblioteka nie ma; ewentualne głosy projektowane z opisu wymagają opisu i linii od użytkownika.
- `tools/voice` generuje przez API ElevenLabs z kluczem jako sekretem środowiska (nigdy w repo), z ustawieniami głosu w `tools/voice/voices.json`. Pliki wynikowe trafiają do repo jak dotąd, a narzędzie nie generuje linii, która ma już plik.

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
- **TTS** (do 7.11; od 7.11 źródłem jest ElevenLabs, sekcja „Decyzje użytkownika (7.11)”):
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

## Z budowy etapu 1 (7.11)
- **Zmiana kontraktu** (`core/src/ports/audio-port.ts`, minimalna):
  - `AudioBus` dostaje `"dialogue"` i `"radio"`; `setVolume` i `getVolume` działają na nich bez zmian sygnatur.
  - `AudioScenePort` dostaje dwie metody opcjonalne, jak `setRadioStation`: `playLine?(key)` gra nagranie linii po kluczu na szynie dialogu i zastępuje linię, która jeszcze brzmi; `stopLine?()` ją ucina. Fałszywe porty w testach nie muszą ich mieć.
  - `AudioPort` (jednorazowe sygnały) się nie zmienia.
- **Szyny** (`engine/src/audio/audio-graph.ts`): `dialogue` idzie prosto do szyny głównej, `radio` przez filtr nastroju muzyki (jak dotąd, gdy radio grało na szynie muzyki), ale z własną głośnością. Domyślnie dialog 1,0, radio 0,55 (poziom muzyki, więc radio brzmi tak samo jak przed zmianą).
- **Ducking pod mową** (`engine/src/audio/ducking.ts`, `SpeechDucker`, czysta logika bez WebAudio):
  - głębokość −8 dB (mnożnik ok. 0,40) na muzyce i radiu; SFX, otoczenie i dialog bez zmian;
  - opadanie liniowe w dB: pełne −8 dB w 0,25 s (pierwsze słowo nie ginie pod muzyką);
  - przytrzymanie 0,35 s po końcu linii, żeby muzyka nie pompowała między dwiema liniami;
  - narastanie z powrotem do 0 dB w 0,8 s; ucięcie linii (`stopLine`) zaczyna narastanie od razu, bez przytrzymania;
  - poziom liczy krok planisty (50 ms), a węzeł dochodzi do niego z `setTargetAtTime` (stała 0,08 s), jak przy suwakach;
  - otwarta rozmowa nadal ścisza muzykę i radio do 0,3 (ok. −10,5 dB, ADR-0013); z dwóch ściszeń liczy się głębsze, nie iloczyn, więc linia w rozmowie nie spycha muzyki niżej.
- **Droga odtwarzania** (`engine/src/audio/dialogue-lines.ts`): adres pliku podaje aplikacja (`voiceUrl`, w grze `voice/en/<klucz>.ogg`), silnik nie buduje ścieżek. Plik pobiera się przy pierwszym użyciu klucza i zostaje w pamięci podręcznej; brak pliku, błąd dekodowania albo brak `voiceUrl` to cisza bez wyjątku, a klucz nie jest pobierany drugi raz. Linia, która doładuje się po `stopLine` albo po nowszej linii, nie gra. Przed pierwszym gestem gracza linie milczą.
- **Ustawienia:** suwaki „Dialog” i „Radio” obok muzyki, SFX i otoczenia; suwak muzyki nazywa się teraz „Muzyka” zamiast „Muzyka i radio”. Nowe pola nie zmieniają domyślnych wartości starych, więc `SETTINGS_REV` zostaje. Wpis zapisany przed zmianą dostaje dialog 1,0, a radio dziedziczy jego głośność muzyki, bo suwak muzyki sterował dotąd i radiem.
- **Aplikacja:** `controllers/audio-mix.ts` (`bindAudioMix`) przejmuje z `main.tsx` nastrój rozmowy i głośności na żywo, a zamknięcie rozmowy woła `stopLine`. Linii z kluczami jeszcze nie ma (tagi `#voice` to etap 5), więc nikt jeszcze nie woła `playLine`.
