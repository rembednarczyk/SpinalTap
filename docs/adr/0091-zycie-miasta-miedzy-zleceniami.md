# ADR-0091: Życie miasta między zleceniami: terytoria gangów i przestępstwa w toku

Status: Przyjęty (18.11), z decyzjami użytkownika z 18.11 (sekcja na końcu). Wynika z punktu (d) audytu skradania i walki z 17.11 (`docs/backlog.md`, wpis „[17.11 02:30] Audyt skradania i walki”: wolne miasto prawie puste) i z decyzji użytkownika z 18.11: życie miasta między zleceniami wzorem Cyberpunk 2077, w dwóch częściach. (1) Gangi trzymają dzielnice: grupy Hebi stoją w stałych miejscach i są neutralne, dopóki gracz ich nie sprowokuje albo ulica nie jest mu wroga. (2) Na ulicach jest więcej przestępstw w toku: rozwinięcie istniejących mikrozdarzeń, z nagrodą i znacznikiem na mapie. Dotyczy ADR-0011 (frakcje), ADR-0014 (chunki i uśpienie), ADR-0017 (plany dnia), ADR-0029 (świadkowie, heat), ADR-0034 (mikrozdarzenia), ADR-0042 i `docs/topografia.md`, ADR-0046 (testy), ADR-0048 (patrole Starego Miasta), ADR-0056 (języki), ADR-0059 (pasma), ADR-0065 (ciała i kryjówki), ADR-0069 (skradanie), ADR-0070 (reputacja), ADR-0079 (telefon), ADR-0081 (mieszkańcy) i ADR-0089 (AI walki). Stan kodu: `origin/main` 29c74ae.

## Kontekst

### Kto dziś stoi w mieście (pomiar na treści `sim`, 29c74ae)

| Dzielnica (id) | Chunki | Zasięg x / z (m) | Pasmo (ADR-0059) | Postacie z treści | Wrogowie poza zleceniem |
|---|---|---|---|---|---|
| Krakowskie Przedmieście (`shinsekai-7`) | 6 (220×250 i 220×180 m) | −200..460 / −270..160 | 1–8, Alchemia 10–20 | 20 | kurier i ochroniarz M0 (giną w prologu), czujka pod Arkadami Alchemii; 3 sprzątaczy Kagami tylko w akcie II |
| Stare Miasto (`kanal`) | 4 i Trasa Podziemna | 460..760 / −240..160 | 5–14 | 7 | 4 patrole Hebi (ADR-0048) |
| Podzamcze (`targ`) | 6 (200×210 m) | 520..1120 / 160..580 | 10–20 | 0 | 0 |
| Nabrzeże Bystrzycy (`doki`) | 4 i W-3 | 2300..2700 / 60..480 | 16–30 | 2 | 0 (Tessen tylko ze zleceniem) |

- 15 z 22 chunków nie ma żadnej postaci z treści: całe Podzamcze, 4 chunki Krakowskiego, jeden Starego Miasta, dwa Nabrzeża, W-3 (jego ludzie przychodzą ze zleceniem) i Trasa Podziemna.
- Tło żyje bez konfliktu: tłum (ADR-0041, ADR-0050, `CROWD_CAP` 6/18/32 na chunk) i 13 przechodniów (ADR-0040) nie mają zdrowia, klucza ani roli świadka.
- Po prologu zostaje 5 Hebi z kluczem. W linii prostej od miejsca przebudzenia w klinice (320; −65): patrol Bramowej 184 m, czujka pod Arkadami 222 m, patrol Grodzkiej 364 m. Audyt z 17.11 podał 320 m do najbliższego.
- Kryjówki na ciała (ADR-0065): 14. Z tego 8 szafek w hali W-3, 2 kryjówki na pasie publicznym W-3 i 4 w mieście (Krakowskie 3, Stare Miasto 1, Podzamcze 0). Audyt liczył 7, zanim doszły szafki W-3.

### Jak Hebi traktują gracza
- Ganger widzi gracza modelem ADR-0069. Przy postawie Hebi neutralnej albo wrogiej zauważenie go alarmuje (ADR-0011). Tylko patrol uliczny (`ActorDef.patrol`, ADR-0048) przy postawie neutralnej (−10..10) obserwuje gracza (`WatchPlayer`, `NpcReacted` „warn”) zamiast atakować (`tolerates` w `ganger-perception.ts`).
- Postawa Hebi jest jedna dla całego miasta. Po prologu M0 wynosi −19 (`packages/app/test/m0-loop.test.ts`: −15 za rozmowę o wypłacie i −4 za kuriera), czyli jest wroga (`stanceOf` poniżej −10). Patrole Starego Miasta atakują więc gracza na widok od początku aktu I, a tolerancja z ADR-0048 działa tylko w prologu.
- Hebi tracą 4 za każdego zabitego i 5 za likwidację, więc likwidacja Kaito (2–4 cele) kosztuje 13–21. Próg „wrogo” w `reputationTier` (−50 i niżej) przychodzi po ok. 2 likwidacjach po prologu. Dodatnie źródło jest jedno: +2 w spotkaniu z `enc-kanal.ink`.
- Ochroną dzielnicy przy heat (ADR-0029, `securityAt`) są Hebi na Krakowskim, Starym Mieście i Podzamczu, a Tessen na Nabrzeżu. Wsparcie z heat atakuje bez względu na postawę.
- Zaalarmowany ganger nie alarmuje sąsiadów (ADR-0069 odłożył reakcję grupową).

### Mikrozdarzenia dziś (ADR-0034, `world/micro-events.ts`)
- Dwa rodzaje: napad dwóch Hebi na przechodnia (60%) i zasłabnięcie przechodnia (40%). 12 miejsc w `MICRO_SPOTS`, po 3 na dzielnicę.
- Losują się tylko przy przejściu granicy dzielnicy, z szansą 12% (25% przy cywilach poniżej −10), ze strumienia `deriveRandom(seed, "micro:<tick>")`. Na jedno zdarzenie przypada średnio ok. 8 wejść do dzielnicy. Gracz, który zostaje w jednej dzielnicy, nie zobaczy żadnego.
- Miejsce wypada 12–40 m od gracza, a odejście na 45 m kończy zdarzenie bez nagrody. Naraz trwa najwyżej jedno, tylko po `met_fixer`, bez trwającego zlecenia i bez heat (`streetOpen`).
- Nagroda jest stała: napad 70 €$ i +3 u cywilów, pomoc 25 €$ i +3. Nie zależy od pasma i nie daje PD.
- Gracz nie dostaje znacznika ani komunikatu. Aplikacja pomija zdarzenie bez knota (`presentEncounters`), a jedynym tekstem jest prompt „Help” / „Pomóż”. Uczestnicy są przejściowi i zapis ich pomija.
- Obok tego jest 15 spotkań ink (`ENCOUNTERS`, 4/4/4/3), wszystkie jednorazowe.

### Koszt postaci
- Uśpiona postać z kluczem to `EntitySnapshot` w `StreamState.dormant` i w zapisie. Niezaalarmowany ganger zajmuje ok. 107 B JSON i nie kosztuje nic w kroku: wraca przy wczytaniu chunka, a plan dnia liczy się z zegara (ADR-0017).
- Naraz wczytane są 1–3 chunki (wczytanie w 30 m od granic, zwolnienie przy 44 m). Najwięcej postaci z treści ma `krakowskie-2-1`: 12.
- Aktywne AI: 10 zaalarmowanych gangerów na terenie z pryzmatami kosztuje 0,51–0,54 ms na krok (ADR-0043), a ADR-0089 dokłada do 0,1 ms przy 10 wrogach.
- Rysowanie: model VRoid to 10–15 wywołań, Quaternius 4–11 (ADR-0076), patrol Hebi w kadrze to 4 siatki (ADR-0048). Budżety scen (`tools/perf-budgets.json`): `krakowskie-tpp` 541 wywołań, `rynek-tpp` 335, `podzamcze-tpp` 224, `phone-low` 239.
- Zapis: `SAVE_SCHEMA_VERSION` = 47. Złoty hash liczy cały `SaveSnapshot` przebiegu na podłodze testowej w dzielnicy `shinsekai-7`, która nie wchodzi do żadnej dzielnicy (ADR-0088, `packages/sim/test/determinism.test.ts`).

## Cele
1. Po wyjściu z kliniki gracz w ciągu ok. minuty realnej widzi grupę Hebi na ulicy, która go nie atakuje.
2. Hebi są groźni tam, gdzie gracz ich sprowokował albo skrzywdził. Pozostałe grupy zostają neutralne także po kilku zleceniach.
3. Przestępstwa w toku są widoczne na mapie, płacą w paśmie dzielnicy i wracają co pewien czas.
4. Telefon: krok sim w budżecie, a budżety rysowania rosną tylko z pomiarem (ADR-0076 pkt 8, ADR-0046).
5. Determinizm i zapis jak zawsze. Wróg, który już walczy, zachowuje się jak w ADR-0089, a niezaalarmowany jak w ADR-0069.

## Warianty

### A. Patrole wszędzie, bez nowego stanu
- Grupy Hebi jako `ActorDef` z flagą `patrol` w każdej dzielnicy. Tolerancja czyta próg zamiast postawy: gracza nieufnego (−11..−49) grupa obserwuje, wrogiego (−50 i niżej) atakuje.
- Prowokacją jest to, co dziś alarmuje gangera: strzał w zasięgu alarmu, trafienie, heat Hebi, spalone przebranie.
- Mikrozdarzenia: 6–8 miejsc na dzielnicę i losowanie co 15 minut gry zamiast przy wejściu. Znacznik pojawia się, gdy uczestnicy już stoją (12–40 m).
- Koszt mały: 2–3 PR-y, bez zmiany zapisu.
- Wady: postawa Hebi spada do −50 po ok. 2 likwidacjach i od tej chwili strzela całe miasto. Sprowokowany ganger po przeszukaniu (20 s i 6 s, ADR-0029) znów toleruje, a jego sąsiedzi niczego nie pamiętają. Znacznik widoczny z 40 m prawie nic nie daje.

### B. Terytoria z pamięcią grupy i tablica przestępstw
- **Terytorium** to dane w treści `sim`: obszar, rdzeń (podwórze, zaułek, kryjówka), 2–4 członków z planem dnia, czasem elita na czele (ADR-0059: poziom ponad pasmem).
- **Stan gangu w dzielnicy** w domenie, czyli w zapisie: uraza 0..100 i czas, do którego gang jest w tej dzielnicy sprowokowany. Terytoria jednej dzielnicy dzielą ten stan. Grupa toleruje gracza, dopóki nie ma heat od gangu, dzielnica nie jest sprowokowana, a uraza nie przekroczyła progu. Globalna postawa gangu zmienia tylko to, jak szybko grupa ostrzega i traci cierpliwość.
- **Tablica przestępstw:** co 4 godziny gry (4 minuty realne) każda dzielnica dostaje 1–2 przestępstwa w toku w znanych miejscach, ze znacznikiem na mapie od chwili wystawienia. Ludzie przestępstwa pojawiają się dopiero w zasięgu. Rodzaje: dwa dzisiejsze i dwa nowe. Nagroda rośnie z pasmem.
- Koszt średni: 7 PR-ów, zapis v48 i v49.

### C. B i kontrola dzielnic
- Wszystko z B, a do tego wpływ gangu na dzielnicę: wyczyszczone terytorium pustoszeje na kilka dni gry, potem Hebi wracają. Przestępstw jest więcej tam, gdzie gang jest silny. Na Nabrzeżu Hebi ścierają się z Tessen. Ceny i reakcje mieszkańców zależą od kontroli, a plotka z ADR-0081 niesie wieści o czystkach.
- Koszt duży: 4–5 PR-ów więcej, model kontroli w `core`, nowy balans. Wymaga rejestru mieszkańców z ADR-0081, którego budowa czeka na mapowanie.
- Ryzyko wysokie: stan zależny od całego miasta, trudny do testów i do strojenia.

## Rekomendacja
Wariant B. A nie spełnia celu 2 z powodu liczb: przy −19 po prologu i −13..−21 za likwidację tolerancja z progu wytrzymuje najwyżej dwa zlecenia Kaito, potem wszystkie grupy strzelają. B przenosi pamięć tam, gdzie była krzywda: Hebi ze Starego Miasta wiedzą, że gracz strzelał na Rynku, a Hebi z Podzamcza nie. Stan jest mały (gang × dzielnica, dziś 1 × 3 wpisy po dwie liczby), a tablica przestępstw liczy się z ziarna i zegara, więc zapis trzyma tylko listę zrobionych. B odpowiada temu, co w CP2077 działa: gangi stoją w swoich dzielnicach jako neutralni (żółte znaczniki), przy dobytej broni albo wejściu na ich teren ostrzegają, potem atakują, a przestępstwa w toku z NCPD Scanner Hustles („Assault in progress”, „Suspected organized crime activity”) są na mapie jako znaczniki z nagrodą. C ma sens po pomiarach B i po budowie ADR-0081.

## Decyzja (szczegóły wariantu B)

### 1. Terytoria
Dane w `packages/sim/src/content/territories.ts`, ludzie jako `ActorDef` z polem `territory` w miejsce flagi `patrol`. Terytorium ma pole `faction`, a reguły tolerancji, urazy i przestępstw czytają frakcję z danych, nie z nazwy Hebi. Lublin urośnie do pełnych rozmiarów (decyzja użytkownika 18.11), więc kolejny gang to nowe wiersze w tabelach `core` i treści, bez zmiany reguł. Patrole z ADR-0048 stają się terytorium Rynku z tymi samymi kluczami i trasami. Kandydaci (miejsca ustala etap 4 z kuratorem topografii):

| Dzielnica | Terytoria (członkowie) | Uwagi |
|---|---|---|
| Krakowskie | podwórze za myjnią, miejsce M0, po prologu (3); Arkady Alchemii przy czujce (3); zaułek przy Kapucyńskiej lub Karmelickiej (2) | pierwsze 81–86 m od kliniki; kryjówki już są przy myjni i w Alchemii |
| Stare Miasto | Rynek wokół Trybunału (4 patrole); kładka nad Grodzką (3, handel); Zaułek Panasa albo Podwale (2) | kryjówka przy kładce już jest |
| Podzamcze | stoiska przy Dworcu Autobusowym (3); hale Bazaru przy Alei Tysiąclecia (3); Nowy Plac Targowy przy Ruskiej (3); Lubartowska przy rondzie (2) | dziś 0 postaci i 0 kryjówek |
| Nabrzeże | bez gangów | Tessen jako policja (punkt 3a) |

Razem 10 terytoriów i 28 Hebi wobec dzisiejszych 5. Bez miejsc pamięci (ślad getta i synagoga Chewra Nosim na Podzamczu), kościołów i wnętrz z fabułą. Członkowie stoją, palą, rozmawiają przez telefon i piszą na nim (klipy Mixamo z 18.11, czynności z #711), a nocą częściej chodzą po pętli, jak patrole Rynku.

### 2. Tolerancja i eskalacja
Liczby są startowe i stroi je etap 7.
Stan wrogości jest liczony per dzielnica (decyzja użytkownika 18.11): `GangStanding` dla pary gang × dzielnica. Terytoria w jednej dzielnicy dzielą urazę i prowokację.
- **Grupa toleruje gracza**, gdy: gang nie ściga go w heat, dzielnica nie jest dla gangu sprowokowana, uraza gangu w dzielnicy jest poniżej 60, a gracz nie ma spalonego przebrania Hebi. Wtedy członek, który widzi gracza, patrzy na niego (`WatchPlayer`), jak dziś patrol.
- **Ostrzeżenie:** gracz z dobytą bronią bliżej niż 8 m od członka albo w rdzeniu terytorium słyszy odzywkę (`NpcReacted` „warn”, nowe teksty), a grupa daje mu 3 s czasu świata. Przy postawie Hebi nieufnej odległość rośnie do 10 m, przy wrogiej do 12 m, a czas spada do 2 s. Schowana broń albo wyjście z rdzenia kasuje licznik.
- **Prowokacja** (gang sprowokowany w tej dzielnicy na 6 godzin gry): koniec licznika, celowanie w członka z dobytą bronią z 6 m przez 1 s (`INTIMIDATE_RANGE`), trafienie członka, strzał w zasięgu alarmu broni, obezwładnienie albo ciało członka zauważone przez innego członka, zgłoszone przestępstwo widziane przez członka. Każdy członek dalej sam wykrywa gracza (ADR-0069 bez zmian): grupa przestaje tolerować, ale nie wie od razu, gdzie gracz jest.
- **Uraza:** +20 za zabitego członka, +10 za obezwładnionego, +5 za prowokację. Do tego udaremnienie przestępstwa gangu, który trzyma dzielnicę: +8 (punkt 3). Pomoc gangowi przy przestępstwie: −10. O świcie (5:00) uraza spada o 20. Od 60 gang jest w tej dzielnicy wrogi bez prowokacji, aż uraza spadnie. Ekipy zleceń i ludzie przestępstw nie należą do terytoriów (jak `crew` w ADR-0070), więc ich śmierć urazy nie podnosi.
- **Reszta reguł bez zmian:** atak na tolerującego członka to napaść albo zabójstwo (ADR-0029), więc grozi heat od Hebi i wsparcie z wejść. Śmierć członka w walce po prowokacji to dla cywilów walka na ulicy (+1 z ADR-0070). Hebi tracą 4 za zabitego jak dziś.

### 3. Przestępstwa w toku
- **Miejsca:** 6–8 na dzielnicę (ok. 28 wobec 12), poza trasami planów dnia, na ulicach, placach i podwórzach, które gracz może przejść. Każde co najmniej 40 m od rdzenia terytorium (decyzja orkiestratora 18.11): strzały przy przestępstwie nie prowokują grupy, która stoi obok, a test treści pilnuje odległości.
- **Tablica:** granica slotu co 4 godziny gry, także po `wait`. Dla każdej dzielnicy `deriveRandom(seed, "crime:<dzielnica>:<slot>")` wybiera 1–2 przestępstwa (rodzaj i miejsce). Tablica jest czystą funkcją ziarna i slotu. Zapis trzyma numer slotu, listę zrobionych w tym slocie, licznik nagród w dobie gry i śledzone przestępstwo. Zrobione miejsce wraca do puli od następnego slotu.
- **Rodzaje** (decyzja użytkownika 18.11: wszystkie): napad (jest), pomoc przy zasłabnięciu (jest), haracz (2–3 członków gangu przy straganie albo sklepie), handel (3 członków i skrzynia z łupem; zdjęcie wszystkich bez alarmu daje premię, jak w CP2077 przy zorganizowanej przestępczości), kradzież drona (2 złodziei przy dronie dostawczym, który odlatuje po 60 s) i porwanie (2 porywaczy prowadzą ofiarę do auta, które odjeżdża po 45 s).
- **Dwie strony** (decyzja użytkownika 18.11: ciemne zlecenia budują reputację we frakcji). Każde przestępstwo z udziałem gangu gracz może udaremnić albo w nim pomóc:
  - udaremnienie: płaci Tessen jako policja (punkt 3a), +3 u Tessen, +3 u cywilów, PD; jeśli to gang trzymający dzielnicę, jego uraza w niej rośnie o 8;
  - pomoc (osłona haraczu, eskorta skrzyni, odciągnięcie ochrony od drona, pilnowanie auta porywaczy): płaci gang, +3 u gangu, uraza gangu w dzielnicy −10, −3 u Tessen, −3 u cywilów, PD;
  - zasłabnięcie nie ma strony gangu i płaci tylko za pomoc ofierze, jak dziś.
  Pomoc to rozmowa z członkiem przy przestępstwie (knot ink, en i pl) i zadanie na miejscu. Prowadzi do niej odzywka „Masz chwilę?” / „Got a minute?” w zasięgu 8 m.
- **Start:** ludzie pojawiają się, gdy gracz jest w 60 m i poza ich polem widzenia, jak wsparcie z heat. Odejście dalej niż 80 m zdejmuje ich bez nagrody, a przestępstwo zostaje na tablicy do końca slotu. Śmierć ofiary albo ucieczka (dron, auto) kończy je porażką i wpisuje na listę zrobionych.
- **Kiedy:** jak w CP2077 (decyzja użytkownika 18.11) przestępstwa są dostępne zawsze, także w trakcie zlecenia i przy heat. Ukryte są tylko w obszarze aktywnego zlecenia (np. teren W-3 podczas sabotażu). Bramka `streetOpen` z ADR-0034 zostaje tylko dla dzisiejszych mikrozdarzeń przy wejściu do dzielnicy, które tablica zastępuje w etapie 5.
- **Nagroda:** stawka rodzaju razy mnożnik poziomu zlecenia z pasma dzielnicy (ADR-0059). Dzienny limit (decyzja orkiestratora 18.11): pierwsze 6 przestępstw w dobie gry płaci 100%, kolejne 25%, co zamyka farmienie przez `wait`. Cel ekonomii: przestępstwo daje najwyżej połowę dochodu na minutę zleceń tego pasma (dziś 215–230 €$/min, ADR-0089). Pilnuje tego test w `core`.
- **Znaczniki** (decyzja użytkownika 18.11: cała mapa; szczegóły orkiestratora): ikona na mapie miasta widoczna wszędzie od wystawienia do końca slotu albo zakończenia, jak niebieskie ikony NCPD w CP2077. Rodzaj, strona gangu i nagroda pokazują się w promieniu 300 m albo po odkryciu. Na minimapie, kompasie i w HUD znacznik jest tylko w promieniu 300 m albo dla przestępstwa śledzonego, żeby nie zaśmiecać ekranu telefonu.
- **Śledzenie:** jedno przestępstwo naraz można śledzić jako cel na mapie, tak jak zlecenie. Śledzenie zlecenia i przestępstwa wyklucza się wzajemnie.

### 3a. Tessen jako policja (decyzja użytkownika 18.11)
- Do czasu nowych gangów Tessen pełni w mieście rolę policji, odpowiednik NCPD z CP2077: wystawia tablicę przestępstw i płaci za udaremnienie.
- Konflikt z dzisiejszymi regułami: droga głośna W-3 kończy się na Tessen ≤ −50 i pościgu (ADR-0082). Rozwiązanie: przy postawie Tessen „wrogo” (−50 i niżej) tablica dalej istnieje i znaczniki są na mapie, ale udaremnienie nie płaci (policja nie płaci poszukiwanemu). Zostają PD i cywile. Płatną drogą zostaje wtedy pomoc gangom. Reputację u Tessen da się odbudować udaremnieniami (+3 każde), więc droga głośna nie zamyka tablicy na zawsze.
- Ochrona dzielnic przy heat (ADR-0029, `securityAt`) w tym ADR-ze się nie zmienia: Hebi w trzech dzielnicach, Tessen na Nabrzeżu. Zamiana wsparcia z heat w mieście na patrole Tessen to etap 8, po decyzji użytkownika i z dopiskiem w ADR-0029. Zmienia charakter pościgu na Starym Mieście, więc zostaje odłożona.

### 4. Kontrakty
- **Typy w `core`** (`core/world/territories.ts`, `core/world/encounters.ts`): `TerritoryId` (unia jak `ContractSiteId`) z frakcją w danych; `GangStanding { grudge: number; provokedUntil: number | null }` i `DomainState.gangStandings` z kluczem `<frakcja>:<dzielnica>`; reguły (`gangTolerates`, `provokeGang`, `grudgeAfter`, `dawnGrudge`) i stałe z punktu 2; `MicroEventKind` dostaje `extortion`, `deal`, `droneTheft` i `kidnap`; `StreetCrimeSide = "foil" | "assist"`; `StreetCrimeLog { slot: number; done: readonly string[]; day: number; paidToday: number; tracked: string | null }` w `DomainState.streetCrimes`; tabela nagród `STREET_CRIME_REWARD` z mnożnikiem pasma, limitem dziennym i płatnikiem strony (Tessen albo gang).
- **Zdarzenia** (`domain-events.ts`): `TerritoryWarned { territory, entityId }`, `TerritoryProvoked { territory, cause }`, `TerritoryCalmed { territory }`, `StreetCrimeCleared { id, kind, side, outcome, eddies, xp }`, `StreetCrimeTracked { id | null }`. `EncounterStarted` i `EncounterEnded` zostają dla przebiegu, z id `crime:<rodzaj>:<slot>:<n>`.
- **Odczyt dla prezentacji:** `streetCrimeMarks(sim)` w `sim/src/presentation`, czysta funkcja tablicy, czytana przez minimapę co klatkę, tak jak dziś byty. Bez nowego stanu w aplikacji, więc po wczytaniu nic nie trzeba odtwarzać.
- **Komenda** `TrackStreetCrime { id: string | null }` (jak śledzenie zlecenia; wybór w mapie). Bez nowych portów. `RenderPort` bez zmian, bo Hebi i Tessen mają już wygląd, a dron dostawczy i auto są rekwizytami z ADR-0050 i ADR-0082. Nowe rodzaje znaczników (`crime`, opcjonalnie obszar `territory`) są w `MapMarkerVm` w `ui`, poza kontraktami `core`.

### 5. Zapis
- **v48** (etap 2): `domain.gangStandings` z migracją 47→48 do pustego obiektu (brak wpisu to spokój i uraza 0). Klucze patroli Rynku się nie zmieniają, więc ich uśpione migawki przechodzą bez zmian.
- **v49** (etap 5): `domain.streetCrimes` z migracją 48→49 do slotu i doby z zapisanego zegara, pustej listy, licznika 0 i bez śledzenia. Zapis v48 z trwającym mikrozdarzeniem wczytuje się bez jego ludzi, jak dziś.
- Każda migracja z testem w `packages/persistence/test`. Uśpieni członkowie terytoriów: ok. 28 × 110 B, czyli ok. 3 KB zapisu.

### 6. Determinizm
- Tablica losuje tylko ze strumienia `crime:<dzielnica>:<slot>`, poza głównym strumieniem i walką. Eskalacja nie losuje. Plany dnia członków są czystymi funkcjami zegara (ADR-0017).
- Złoty hash podłogi zmieni się w etapach 2 i 5 tylko przez nowe pola i numer wersji, bo hash liczy cały `SaveSnapshot`. Reguły podłogi nie dotykają: jej ganger i brawler nie mają terytorium, przebieg nie wchodzi do dzielnicy, a 1331 kroków (22 minuty gry) nie przekracza granicy slotu. Zmiana hasha w etapie 3 albo 4 jest błędem do wyjaśnienia przed scaleniem. Każdą aktualizację (`vitest -u`) opisuje commit.
- Nowe testy: zapis w trakcie ostrzeżenia, po prowokacji i w środku przestępstwa daje po 600 krokach ten sam hash co gra bez wczytania; dwa przebiegi `wait` 24 h z tego samego ziarna dają ten sam dziennik przestępstw i te same urazy.

### 7. Wydajność
- Limity treści: najwyżej 2 terytoria i 8 członków na chunk, najwyżej 1 przestępstwo wczytane naraz w dzielnicy. Dziś najwięcej postaci w chunku to 12, po zmianie najwyżej 20.
- Krok sim: test budżetu jak w `gun-tactic.test.ts` (10 i 18 wrogów) i `far-sight-cost.test.ts`: 8 tolerujących członków i 4 walczących w chunku Rynku, liczba sprawdzeń promieni i odcinków na krok oraz czas z pomiarem przed i po w commicie. Cel: do +0,2 ms na krok na CI. Uśpieni nie kosztują nic w kroku.
- Rysowanie: sceny `krakowskie-tpp`, `rynek-tpp`, `podzamcze-tpp` i `phone-low` mierzone w etapie 4 z grupą w kadrze. Jeśli budżet trzeba podnieść, to z pomiarem przed i po i wpisem w ADR-0046. Znaczniki są w SVG interfejsu i nie dodają wywołań rysowania. Pomiar na telefonie czeka na etap 3 ADR-0079, do tego czasu bramką są wywołania i aktywne siatki.

### 8. Topografia
- Terytoria i miejsca przestępstw leżą w prawdziwych miejscach czterech dzielnic. Etapy 2, 3 i 5 nie zmieniają geometrii. Etap 4 dodaje treść w mieście (postacie, kryjówki jako meble, ewentualnie tagi graffiti w warstwie 2077), więc przechodzi przegląd `topography-curator`.
- Punkty sprawdzają istniejące testy (punkt poza budynkiem, przejście `walk-blocked`), a skan glitchy nie może podnieść bazy. Odstępstw w `docs/topografia.md` nie przewiduję; jeśli kurator jakieś znajdzie, dostaje wpis.

### 9. Języki (ADR-0056)
- `core` i `sim` trzymają klucze. Teksty en i pl w `packages/ui/src/i18n/{en,pl}`: nazwy terytoriów na mapie (`world.territory.<id>`), legenda znaczników, nazwy rodzajów przestępstw, komunikaty udaremnienia i porażki, odzywki ostrzeżenia i prowokacji Hebi (`world.bark.warn.hebi.*`, 3–4 warianty, mowa ulicy jak `world.bark.reload.hebi`). Szacunek: ok. 30 kluczy na język. Polskie teksty są nowe, więc gracz z polskim ustawieniem nie zobaczy zmian w starych.
- Skan `tools/i18n-scan` bez wzrostu bazy. Odzywki bez głosu w tym ADR-ze (głosy według ADR-0060 osobno).

## Etapy wdrożenia (osobne PR-y)
Każdy etap: `pnpm typecheck`, `pnpm lint`, `pnpm depcheck`, `pnpm test:coverage`, `pnpm build`, e2e dotkniętych speców przez `pnpm e2e`. Logika w testach sesji bez renderera (`packages/app/test`, fałszywy `RenderPort`) i w testach komponentów (`packages/ui/test`), symulacja krokowana do stanu gry, nowy test lokalnie najwyżej ok. 3 s z pokryciem.
1. **Spis miasta (tylko testy):** `packages/sim/test/city-life-census.test.ts` liczy postacie, wrogów poza zleceniem, kryjówki i miejsca przestępstw na dzielnicę oraz odległość najbliższego Hebi od kliniki, z wartościami z kontekstu jako dolną zapadką. Bez zmian reguł i hashy.
2. **Kontrakty i zapis v48** (Architekt, Persistence): typy, reguły tolerancji i urazy per gang × dzielnica w `core` z testami w `packages/core/test`, migracja 47→48 z testem. Złoty hash: nowe pole i wersja.
3. **Terytoria w `sim`** (AI / NPC): `territory` w treści, patrole Rynku jako pierwsze terytorium, `tolerates` czyta stan gangu w dzielnicy, ostrzeżenie i prowokacja. Testy sim: spacer obok grupy ze schowaną bronią (nikt nie strzela przez 60 s), dobyta broń (odzywka, po 3 s walka), strzał, trafienie, heat, uraza po zabiciu i spadek o świcie, zapis w ostrzeżeniu. Test sesji w `packages/app/test`: gracz po prologu (Hebi −19) przechodzi przez Rynek bez walki. Test budżetu kroku. Bramki: `kanal-patrols.test.ts`, `stealth-balance.test.ts` i `balance.test.ts` zielone bez zmiany progów.
4. **Treść terytoriów** w Krakowskim i na Podzamczu, kryjówki przy rdzeniach, plany dnia z czynnościami. Przegląd kuratora, e2e `npr-perf.spec.ts` dla dotkniętych scen, spis z etapu 1 w górę.
5. **Tablica przestępstw i zapis v49:** sloty, nowe miejsca (≥ 40 m od rdzeni), pięć rodzajów po stronie udaremnienia, Tessen jako płatnik, nagroda z pasma i limit dzienny, ukrycie w obszarze zlecenia. Testy sim (ten sam slot daje te same przestępstwa, zrobione nie wracają w slocie, wczytanie w trakcie przywraca przestępstwo, siódme w dobie płaci 25%, przy Tessen ≤ −50 udaremnienie nie płaci), test sesji (od wejścia w 60 m do nagrody, porażka po odejściu, ucieczka drona i auta), test ekonomii w `core`, migracja. Etap może się podzielić na 5a (tablica, napad, zasłabnięcie, haracz) i 5b (handel, dron, porwanie).
5c. **Strona gangu (ciemne zlecenia):** rozmowa ink en i pl, zadania pomocy dla czterech rodzajów, płatnik gang, reputacja i uraza. Testy sesji: pomoc przy haraczu obniża urazę Hebi w dzielnicy i reputację u Tessen, udaremnienie w dzielnicy Hebi podnosi urazę o 8.
6. **Znaczniki, śledzenie i teksty** (UI, Infra): ikona na mapie całego miasta, szczegóły i minimapa w 300 m, śledzenie jednego przestępstwa, komunikat zakończenia, i18n en i pl. Test komponentu (znacznik, legenda, przełącznik `mapMarkers`, szczegóły ukryte poza 300 m), test sesji (znacznik znika po zakończeniu, śledzenie zlecenia zdejmuje śledzenie przestępstwa). Przeglądarka tylko do układu HUD na telefonie (`e2e/touch-layout.spec.ts`, 667×375).
7. **Strojenie** po playteście (limit dzienny, stawki obu stron, +8 i −10 urazy): szansa i liczba przestępstw, nagrody, progi urazy i czasy ostrzeżeń. Bez nowego ADR-u, zmiana celów wymaga decyzji użytkownika.

8. **Tessen jako policja przy heat w mieście** (odłożone, punkt 3a): wymaga decyzji użytkownika i dopisku w ADR-0029.

## Konsekwencje
- Testy, które zakładają wrogi Rynek po prologu (`kanal-patrols.test.ts`, rutyna Hideo, napad G-231 z oślepionym patrolem), zmienią przygotowanie: wrogość trzeba w nich ustawić jawnie przez heat albo urazę.
- Hebi są naraz gangiem z terytoriami i ochroną dzielnicy przy heat. Atak na neutralną grupę daje heat i wsparcie z wejść (`SECURITY_ENTRIES`, 25 punktów); wsparcie bez terytorium może wejść w środek tolerującej grupy, co sprawdza test etapu 3.
- Przestępstwa leżą co najmniej 40 m od rdzeni, ale strzał z karabinu niesie się dalej (zasięg alarmu broni do 45 m). Grupa w zasięgu alarmu dalej się prowokuje. To świadomy koszt głośnej broni, który test etapu 5 pokazuje wprost.
- Reputacja u Tessen staje się zmienną pieniężną: droga głośna W-3 zamyka płatne udaremnienia, dopóki gracz jej nie odbuduje.
- Nowe postacie w treści rezerwują id w kolejności tabel (ADR-0014). Zapis trzyma klucze, ale etap 3 i 4 muszą wczytać zapis v47 z uśpionymi patrolami i dostać ten sam stan.
- Więcej postaci w chunkach Rynku i Podzamcza wydłuża testy sesji miasta (ADR-0083). Mierzyć lokalnie z `--coverage`, bez podnoszenia limitów.
- Rejestr mieszkańców z ADR-0081 może później brać fakty z przestępstw (świadek udaremnionego napadu). Ten ADR go nie wymaga.

## Ryzyka
- Uraza i ostrzeżenie to nowe miejsca na glitche zachowania (grupa strzela do gracza, który tylko przechodzi; grupa nie reaguje na strzał). Testy etapu 3 sprawdzają oba kierunki.
- Farmienie: `wait` 4 godziny daje nową tablicę. Limit 6 pełnych nagród na dobę ogranicza zysk, a strojenie w etapie 7 sprawdza, czy próg jest dobry.
- Dwie migracje zapisu w krótkim czasie. Stare zapisy z trwającym mikrozdarzeniem są już przypadkiem testów (G-230, G-233, G-242) i muszą zostać zielone.
- Telefon: więcej postaci w kadrze na Rynku i Podzamczu. Bez pomiaru na urządzeniu znamy tylko liczby z CI.

## Decyzje użytkownika (18.11)
1. Wariant B.
2. Wrogość liczona per dzielnica: uraza i prowokacja są stanem pary gang × dzielnica.
3. Ostrzeżenie i 3 s na schowanie broni albo wyjście z terytorium.
4. Docelowo więcej gangów, bo Lublin urośnie do pełnych rozmiarów: terytoria i reguły są niezależne od frakcji. Na razie Hebi, a Tessen w roli policji (punkt 3a).
5. Znaczniki na całej mapie. Szczegóły od orkiestratora: ikona wszędzie, rodzaj i nagroda w 300 m albo po odkryciu, minimapa i HUD w 300 m albo dla śledzonego.
6. Jak w CP2077: przestępstwa dostępne zawsze, ukryte tylko w obszarze aktywnego zlecenia.
7. Decyzja orkiestratora: tablica co 4 godziny gry także po `wait`, 6 pełnych nagród na dobę, potem 25%, jedno śledzone przestępstwo naraz.
8. Wszystkie rodzaje: napad, zasłabnięcie, haracz, handel, kradzież drona, porwanie. Ciemne zlecenia budują reputację: udaremnienie u Tessen, pomoc u gangu.
9. Decyzja orkiestratora: miejsca co najmniej 40 m od rdzeni; udaremnienie przestępstwa gangu trzymającego dzielnicę +8 urazy (próg 60), pomoc gangowi −10.
