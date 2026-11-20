# ADR-0095: Wątek główny, akt III „Źródło”: Zamek, Kaplica Trójcy, trzy zakończenia, epilog

## Kontekst
M3 (§14 planu): wątek główny ma przechodzić od startu do zakończenia. Akty I (ADR-0012) i II (ADR-0023) są w main, a akt III jest otwarty (audyt luk, punkt 9; decyzja użytkownika z 20.11: „rób kamienie milowe”). ADR-0068 przygotował pod akt III zespół zamkowy: Zamek jest w 2077 siedzibą korporacji, a Kaplica i Donżon mają otwory wejść. Akt II kończy się na trzy sposoby (`street`, `hebi`, `kagami`), więc akt III musi zaczynać się z każdego z nich i pamiętać wybory obu aktów.

Motyw przewodni gry (§9): czy wspomnienia i tożsamość przy rozbudowanym cyberware są czyjeś własne. Akt I pyta, czy Seki przyjmie przeszłość Ayi. Akt II pyta, komu należy się archiwum Kagami. Akt III odpowiada, co jest źródłem: oryginał w serwerze Kagami czy to, czego nikt nie nagrał.

## Wzorzec
- **Struktura trzech aktów** z punktem bez powrotu przed finałem (jak finałowe misje CP2077, gdzie droga zależy od sojusznika, a finałowa decyzja od gracza).
- **„Branch and bottleneck”** (Sam Kabo Ashwell, *Standard Patterns in Choice-Based Games*, 2015): trzy otwarcia aktu, zależne od zakończenia aktu II, zbiegają się w jednym miejscu (dziedziniec zamku i Kaplica), a stan wyborów zostaje w zmiennych i koloruje rozmowy. Odstępstwo: finałowy wybór nie jest zamknięty przez wcześniejsze drogi. Każda z trzech opcji jest dostępna zawsze, bo decyzja o tożsamości ma należeć do gracza, a nie do sumy wcześniejszych punktów.
- **Epilog z losami postaci** (jak slajdy końcowe w grach Obsidianu): krótka scena po zakończeniu mówi, co stało się z Renem, Ume, Kaito i Kurosawą, z wyborów wszystkich trzech aktów.

## Decyzja
- **Quest `m3_zrodlo` („Źródło”)** startuje sam po `m3_lustro` (`startsAfter`). Trzy kroki:
  1. `source_lead`: trop do Zamku. Cel i rozmówca zależą od zakończenia aktu II (`variants`): `street` u Ume (ludzie, którym oddano chipy, znikają nocą w furgonetkach Kagami), `hebi` u Rena (kupcy Hebi przepadają, każda kopia archiwum dzwoni do serwera na Zamku), `kagami` u Kurosawy na dziedzińcu zamku (zaproszenie na „kalibrację”, bo w jej zapisie jest dziura). Flaga `castle_lead`.
  2. `chapel`: dziedziniec zamku, rdzeń archiwum Kagami za drzwiami Kaplicy Trójcy. Przy `street` i `hebi` stoi tam ochrona Kagami (czterech czyścicieli, wrogich, bo Kagami ma po akcie II −20). Przy `kagami` są ci sami ludzie, ale przyjaźni. Rozmowa z rdzeniem podnosi flagę `core_reached`, a nagrodą kroku jest wspomnienie `chapel` („kaplica”): Aya jako dziecko z matką przed freskami z 1418 roku. To jedyne wspomnienie, którego Kagami nie nagrało, bo w kaplicy nie było zasięgu.
  3. `core_choice`: po retrospekcji wraca do rdzenia i wybiera (`core`), co zrobić z archiwum, w którym leży też oryginalny zapis Ayi. Krok kończy się flagą `act3_ending`.
- **Zakończenia aktu III** (`ACT_THREE_ENDINGS`, `story.act3Ending`, `resolve-ending` z `act: 3`, ink `end_act3()`):
  - `erase` „Cisza”: Seki wymazuje archiwum razem z oryginałem Ayi. Kagami −30, mieszkańcy +5.
  - `release` „Echo miasta”: archiwum idzie w sieć miasta i każdy dostaje swoje wspomnienia, także te, których nie chciał. Mieszkańcy +15, Hebi +5, Kagami −30.
  - `keep` „Strażniczka”: Seki zostaje przy rdzeniu i decyduje, kto co odzyska. Kagami +20, fiksery +10, mieszkańcy −10.
- **Epilog**: scena `act3_epilogue` gra sama po retrospekcji „kaplica” i zakończeniu (`pendingScene`, flaga `seen:act3_epilogue`), z losami postaci z wyborów `crash`, `voice`, `job`, `archive` i `core`. Gra toczy się dalej po epilogu (wolna gra). Ekran końca z podsumowaniem wyborów to osobny etap (UI).
- **Postacie na Zamku** (`content/castle-act3.ts`, w `GAME_ACTORS`): archiwistka Kagami przy rdzeniu, przy drzwiach Kaplicy (927,5; 215,5), przez którą idzie rozmowa z archiwum, Kurosawa na dziedzińcu od `ending:kagami` do końca aktu, czterech strażników Kagami na dziedzińcu od `castle_lead` do `act3_ending`. Ren i Ume zostają tam, gdzie są, z nowymi gałęziami rozmów.
- **Zapis v51**: `story.act3Ending` (migracja 50→51 do `null`) i start `m3_zrodlo`, jeśli akt II jest ukończony.
- **Teksty**: ink `m3-zrodlo.ink` w obu językach (ADR-0056), klucze questu, zakończeń i wspomnienia w katalogach `i18n/{en,pl}`.

## Etapy
1. Ten ADR, `core` (quest, wybór, zakończenia, wspomnienie, zapis v51), symulacja (postacie, akt 3 w `resolve-ending`), ink pl i en, test pętli od każdego zakończenia aktu II do każdego zakończenia aktu III z zapisem w połowie.
2. Ekran końca: podsumowanie wyborów trzech aktów i napisy, wejście z epilogu, powrót do wolnej gry.
3. Wnętrze Kaplicy (ADR-0061, po ADR-0068 Z3): sala serwerów pod freskami, rdzeń w prezbiterium zamiast przy drzwiach.

## Konsekwencje
- Złoty hash podłogi zmienia się tylko przez kształt snapshotu (wersja 51 i `story.act3Ending`); nowe postacie stoją w chunkach Podzamcza, poza podłogą.
- Kaplica jest prawdziwym zabytkiem z freskami rusko-bizantyjskimi z 1418 roku. Warstwa 2077 (serwer Kagami w środku) to odstępstwo celowe, wpis w `docs/topografia.md` przy etapie 3, gdy wnętrze powstanie.

## Wdrożenie etapu 2 (20.11): ekran końca
- Wzorzec: ekran podsumowania po napisach (jak „Your Choices” w grach Telltale i karta statystyk po finale CP2077), bez głosowania i porównań z innymi graczami.
- `core`: `END_SCREEN` i `endScreenDue` (epilog obejrzany, `seen:end_screen` jeszcze nie). Flaga trafia do zapisu, więc schemat zostaje w wersji 51.
- `app`: `EndScreenController` (pokazuje ekran raz, gdy gracz ma kontrolę, nie ma rozmowy i jest spokojnie; zamknięcie wysyła `set-flag`) i prezenter `presenters/end-screen.ts` (zakończenia aktów, wybory w kolejności `STORY_CHOICES`, poziom, zlecenia, wspomnienia). Gra stoi, gdy ekran jest otwarty, jak przy oknie czekania.
- `ui`: `EndScreenVm` w magazynie, intencja `EndScreenIntents.closeEndScreen` z hakiem `useEndScreenIntents`, komponent `ending/end-screen.tsx`; teksty w `i18n/{en,pl}/ending.ts` (podsumowanie każdej opcji każdego wyboru).
- Testy: komponent (`packages/ui/test/end-screen.test.tsx`), pętla aktu III (`m3-zrodlo-loop.test.ts`: ekran raz po epilogu, gra stoi, flaga przetrwa zapis), `endScreenDue` w `core`.
