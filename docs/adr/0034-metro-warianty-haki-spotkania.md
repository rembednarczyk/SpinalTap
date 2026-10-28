# ADR-0034: Metro, warianty zleceń, haki obserwacyjne i spotkania uliczne (sim B fali 2)

## Kontekst
ADR-0032 ustalił kontrakty fali 2. Ten ADR opisuje, jak symulacja realizuje część „świat i zlecenia”: metro między dystryktami, warianty zleceń, haki obserwacyjne, spotkania uliczne i mikrozdarzenia. Reguły liczbowe są w `core` (`world/metro.ts`, `world/encounters.ts`, `contracts/variation.ts`), wykonanie w `sim`.

## Decyzja: metro
- Jedna linia w kolejności `METRO_STATION_IDS`: Shinsekai, Kanałowa, Targ, Doki. Bilet kosztuje 15 €$ plus 5 €$ za przystanek, przejazd trwa 5 s plus 2 s za przystanek (od 7 do 11 s).
- Perony (`content/metro.ts`) stoją w ślepych zaułkach albo przy fasadach, poza ulicami, trasami NPC i węzłami nawigacji (test `metro.test.ts`):

  | Stacja | Kiosk (x, z) | Wysiadka (x, z) | Miejsce |
  |---|---|---|---|
  | shinsekai | −15, −35,65 | −15, −34,2 | zaułek na południe od zachodniej kamienicy, przy murze dystryktu |
  | kanal | 20, 74,35 | 20, 75,9 | południowa pierzeja, naprzeciw przejścia do Doków |
  | targ | 118, 105,65 | 118, 104,1 | pod północnym murem targu, na wschód od straganów |
  | doki | −33, 91,55 | −33, 92,9 | zachodni koniec pasa przy południowym murze placu |

- Bryłą stałą jest tylko kiosk (0,8 × 1,9 × 0,6 m). Daszek nad zejściem i krawędź schodów są rysowane. Encje peronów dochodzą po urządzeniach z fali 1, więc wcześniejsze identyfikatory się nie zmieniają.
- `travel-metro { to }` działa tylko w zasięgu kiosku (2,2 m). Odmowa idzie zdarzeniem `MetroRefused`, a w trakcie zlecenia z heat > 0 jej powodem jest `watched`.
- Po odjeździe encja gracza wychodzi ze świata i czeka w sesji jako pasażer, już na peronie docelowym. Dzięki temu nikt jej nie widzi ani nie trafi, streamer ładuje dystrykt docelowy, a zegar płynie dalej. Przejazd (`from`, `to`, `arriveTick`) jest w domenie. Zapis w wagonie zawiera gracza na peronie docelowym, a po wczytaniu system metra znów zdejmuje go ze świata.

## Decyzja: warianty zleceń
- Wariant losuje się przy przyjęciu, od drugiego zlecenia, z osobnego strumienia (ziarno gry i id zlecenia). Losowanie zużywa zawsze sześć liczb. Główny strumień i dotychczasowe generatory się nie zmieniają.
- Rodzaje zleceń mają różne pule. Likwidacja ma wszystkie modyfikatory. Odzyskanie: termin, obstawa i zasadzka. Infiltracja: termin i obstawa. Włamanie: zasadzka. Kurs, ochrona i eskorta nie mają modyfikatorów, ale profil ochrony (poza kursem) i rzadki zwrot akcji losują wszystkie z celami.
- Plan zmienia się tak:
  - profil ochrony: `light` daje jednego strażnika mniej i 85% zasięgu wzroku, `lockdown` jednego więcej na punkcie obserwacyjnym (`SITE_PLANS.lookout`), a wszyscy się rozglądają;
  - `night_only`: cele są tylko od 20:00 do 5:00 (flaga obecności `plan:day:<id>`);
  - `time_limit`: termin 240 s, po nim zlecenie przepada (`timeout`);
  - `bodyguards`: dwóch ludzi przy celu, liczonych jako dodatkowe ofiary;
  - `ambush`: po wykonaniu zadania przy wyjściu pojawia się dwóch zaalarmowanych napastników, a przy zwrocie `setup` trzech;
  - `twin`: sobowtór celu z tagiem `decoy:<id>`, a przy zwrocie `wrong_target` cel i sobowtór zamieniają się miejscami;
  - cecha celu: `armored` daje Hebi typ `hebi_enforcer` (hełm, kurtka, 140 HP), a Tessen +40 HP; `paranoid` rozgląda się co 3 s zamiast co 8 s i widzi o 25% dalej; `drinker` chodzi od 22:00 do 2:00 do Neon Koi według planu dnia (tylko na czterech miejscach w Shinsekai); `creature_of_habit` widzi o 25% słabiej.
- Stawka mnoży się przez `1 + suma wag`, w przedziale 0,8–1,9. Średnia dla likwidacji to około 1,2 (test balansu w core).
- Wariant jest w `Contract.variation`, a więc w zapisie i w `ContractDebrief.variation`. Zapisane gotowe zlecenie z zasadzką rejestruje się po wczytaniu, żeby zasadzka wróciła.

## Decyzja: haki obserwacyjne
- `content/contract-hooks.ts` ma 14 haków, po dwa na każdy z 7 rodzajów zleceń. Knoty mają postać `hook_<kind>_<n>` i są w `hooks.ink`.
- Źródła haków:
  - `bark`: strażnik zlecenia albo postać ze świata (`hebi-lookout`) w promieniu 5 m mówi kwestię (`GuardBark`);
  - `terminal`: terminal zlecenia; interakcja otwiera mail jako rozmowę z tym knotem;
  - `shard`: datachip w worku strażnika, który go nosił; hak liczy się po zabraniu datachipa.
- Odkrycie dopisuje hak do `ContractLog.hooks` i wysyła `ContractHookFound`, raz na zlecenie.
- Haki ujawniają rozwiązania systemowe:
  - luki w rotacji są prawdziwym grafikiem strażnika (flaga `plan:off:<id>:<post>`): w oknie schodzi z posterunku, chyba że ekipa walczy; hak tylko o tym mówi;
  - kod do drzwi biura Tessen działa dopiero po znalezieniu: kamera strefy zakazanej bierze wtedy gracza za personel;
  - reszta to informacje o miejscu albo o celu.

## Decyzja: spotkania uliczne i mikrozdarzenia
- Spotkania z tabeli `ENCOUNTERS` (narracja) zaczynają się dopiero po prologu (flaga `met_fixer`), bez trwającego zlecenia i bez heat.
- Postać spotkania pojawia się 12 m przed promieniem. Wejście w promień w oknie godzin zapisuje spotkanie w domenie (`once` w `used`, cykliczne w `nights` z numerem nocy), otwiera dialog i wysyła `EncounterStarted`.
- Komenda `end-dialogue` kończy spotkanie i wysyła `EncounterEnded` z wynikiem, czyli z końcówką flagi `<knot>_<wynik>` ustawionej przez ink (bez flagi: `none`).
- Nagrody: ink zmienia reputację sam. Wybrane wyniki płacą €$ albo przedmioty z `ENCOUNTER_REWARDS`, raz (flaga `paid:<flaga>`). Pozostałe flagi zostają dla przyszłej treści.
- Mikrozdarzenia (napad dwóch Hebi na przechodnia albo pomoc przy zasłabnięciu) losują się z szansą 12% przy wejściu do dystryktu, z osobnego strumienia (ziarno i tick). Wybierane jest miejsce z `MICRO_SPOTS` w odległości 12–40 m. Używają zdarzeń `EncounterStarted` i `EncounterEnded` z id `micro:<rodzaj>:<tick>` i wynikiem `won`, `helped`, `failed` albo `left`.
- Nagroda za mikrozdarzenie: 70 €$ i +3 u cywili za napad, 25 €$ i +2 za pomoc. Uczestnicy są przejściowi: zapis ich pomija, a odejście na ponad 45 m kończy zdarzenie bez nagrody.

## Konsekwencje
- Zapis v12 (migracja 11 → 12) dodaje `metro` i `encounters`. Złote hashe zmieniły się tylko przez nowe pola i numer wersji. Reguły nie ruszyły replayów, bo te nie przyjmują zleceń, nie wchodzą w sceny i nie jeżdżą metrem.
- Pierwsze zlecenie jest zawsze proste. Dotychczasowe testy zleceń nie zmieniły oczekiwań.
- Kolejność systemów: metro przed streamingiem; plan zlecenia i haki po systemie zleceń; sceny uliczne po warstwie zleceń.
- Do zrobienia gdzie indziej:
  - app: widok metra na `InteractionStarted` z `kind: "metro"` (bez knotu `metro_<stacja>`) i scena wagonu na `MetroDeparted`;
  - app: napisy dla `GuardBark`;
  - app: tracker haków i wariant na karcie.
