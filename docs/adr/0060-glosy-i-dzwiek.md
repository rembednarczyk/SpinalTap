# ADR-0060: Głosy postaci i bohaterki, rozbudowa dźwięku

## Kontekst
Gra nie ma dialogów mówionych.
- Są napisy dialogów z mówcą (`ui/src/dialogue`) i syntezowane głosy efektów (`engine/src/audio/synth-voices.ts`).
- SFX to nagrania CC0 i synteza (`app/public/audio`, ADR-0013).
- Miks ma szyny, ale ustawienia mają tylko głośność główną (audyt luk, `docs/audyt-luk.md`).

Decyzje użytkownika (31.10):
- **Źródło głosów:** mieszane. Odzywki pochodzą z otwartego TTS na licencji komercyjnej, a każdy głos jest sprawdzany osobno. Kluczowe linie Seki i postaci wątku nagrywają aktorzy, o ile się ich znajdzie.
- **Język głosów:** angielski, z napisami po angielsku albo po polsku według ustawienia języka (ADR-0056).

## Decyzja

### Zakres głosów
1. **Odzywki (barki):** krótkie, powtarzalne linie w walce, skradaniu i tłumie.
   - Wrogowie: wykrycie, szukanie, alarm, przeładowanie, rana, śmierć, utrata celu.
   - Cywile: zaczepka, strach, świadek dzwoni.
   - Seki: trafienie, przeładowanie, niski poziom zdrowia, udany hack, awans (ADR-0059).
   - Na typ postaci przypada 20–40 linii, w 2–3 wariantach głosu na typ wroga i cywila.
   - Wszystkie odzywki pochodzą z TTS.
2. **Kluczowe linie wątku:** powitania postaci nazwanych, zwroty akcji, zakończenia aktów i linie Seki w scenach.
   - Docelowo nagrywają je aktorzy. Do czasu nagrań są w TTS jako wersja zastępcza, z tym samym kluczem.
3. **Pełne dialogi** postaci nazwanych to etap późniejszy. Domyślnie idą z TTS, a aktorzy podmieniają je stopniowo, linia po linii.

### Źródła i licencje
- **TTS:**
  - Tylko modele i głosy, których licencja pozwala na komercyjną dystrybucję wygenerowanego audio.
  - Każdy model i każdy głos sprawdzamy osobno. Kod, wagi i nagrania treningowe głosu bywają na różnych licencjach, a głos z licencją niekomercyjną odpada.
  - W `packages/app/public/voice/README.md` zapisujemy model, wersję, głos, licencję z cytatem i datę sprawdzenia.
  - Nie klonujemy głosów prawdziwych osób bez ich pisemnej zgody.
- **Aktorzy:**
  - Nagrania wchodzą tylko z pisemną zgodą i licencją na użycie w grze. Tej części nie da się zautomatyzować: znalezienie aktorów i umowy należą do użytkownika.
  - Gra dostarcza aktorom scenariusz: eksport linii postaci z kluczami, kontekstem i emocją.
  - Ustala też format dostawy: WAV 48 kHz, mono, jeden plik na klucz.
- **Generowanie TTS:** robi to narzędzie `tools/voice` (offline, deterministyczne ustawienia głosu, normalizacja głośności). Repo trzyma skrypt i wynik, ale nie trzyma modeli.

### Klucze i struktura
- Każda linia mówiona ma klucz.
  - W ink jest to tag `#voice:<klucz>` przy linii. Test strukturalny ink (ADR-0056) pilnuje, że `ink/en` i `ink/pl` mają te same tagi.
  - Odzywki są w katalogu `core`/`sim` jako klucze zdarzeń, np. `bark.ganger.alerted`, z listą wariantów.
- Pliki leżą w `app/public/voice/en/<postać>/<klucz>.ogg` (Opus/OGG). Plik aktora i plik TTS mają ten sam klucz, a aktor wygrywa.
- Brak pliku nie jest błędem: zostaje sam napis, tak jak dziś.

### Odtwarzanie
- `AudioPort` dostaje nową szynę `dialogue`. Dochodzi też suwak głośności dialogu w opcjach, obok suwaków muzyki, SFX i radia z audytu.
- **Ducking:** muzyka i radio cichną pod mową.
- **Odzywki w świecie są przestrzenne** (`spatial.ts`) i mają limity:
  - najwyżej jedna odzywka na postać naraz;
  - najwyżej 2–3 odzywki w całej scenie;
  - przerwa między powtórzeniem tej samej linii.
- **Dialogi:** linia odtwarza się razem z napisem. Pominięcie linii ucina dźwięk.
- **Ładowanie:**
  - Pliki pobierają się w tle przy wejściu do dzielnicy.
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
3. **Potok odzywek:** `tools/voice`, sprawdzone głosy TTS, klucze odzywek w zdarzeniach, odtwarzanie przestrzenne z limitami. Na początek ganger, cywil i Seki.
4. **Tagi `#voice` w ink i kluczowe linie wątku w TTS:** eksport scenariusza dla aktorów.
5. **Podmiana na nagrania aktorów,** jeśli się znajdą. To praca użytkownika plus wpięcie plików.
6. **Pełne dialogi postaci nazwanych,** stopniowo.

## Konsekwencje
- Wszystkie głosy są po angielsku, a gracz z polskim ustawieniem słyszy angielski i czyta polskie napisy. Polskiego dubbingu nie planujemy.
- Rośnie rozmiar gry. Odzywki są w pakiecie, a reszta strumieniowo z budżetem dla telefonu.
- Każdy głos TTS i każde nagranie mają w repo zapis licencji. Głos bez potwierdzonej licencji komercyjnej nie wchodzi do gry.
- Testy:
  - logika odtwarzania (limity, ducking, wybór wariantu, aktor przed TTS) testowana w sesji bez przeglądarki, z fałszywym `AudioPort`;
  - kompletność tagów `#voice` sprawdza test ink;
  - rozmiar pakietu pilnowany w budżetach.
