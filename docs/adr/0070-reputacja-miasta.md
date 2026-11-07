# ADR-0070: Reputacja w mieście: progi reakcji, kara u sprzedawców, gangerzy i bilans zleceń

Status: zaakceptowana przez użytkownika 5.11 w całości; otwarte pytania (ogłuszenie, odmowy rozmowy, klinika, limit +25) rozstrzyga orkiestrator w duchu szkicu. Wynika z uwag z testowego przebiegu 4.11, backlog „Reputacja i reakcje mieszkańców”.

## Kontekst
Użytkownik zgłosił po przebiegu 4.11 trzy rzeczy: przy złej reputacji uciekają wszyscy, także sprzedawcy, co psuje immersję; likwidowanie gangerów powinno podnosić reputację w Lublinie; zlecenia dla Kaito obniżają reputację u mieszkańców i nie ma czym tego zrównoważyć. Lawinę powiadomień naprawił G-281 (#248). Został efekt uboczny: przechodzień drga na granicy ucieczki.

**Jak działa reputacja dziś** (ADR-0011, ADR-0018, ADR-0024, ADR-0034):
- `core/reputation`: sześć frakcji, wartość ±100, start 0. Pięć progów `reputationTier` (wrogo ≤ −50, nieufnie −49..−11, neutralnie −10..10, przyjaźnie 11..49, zaufanie ≥ 50) i trzy postawy `stanceOf`, z których postawa „wroga” zaczyna się już przy −11.
- Cywile (`civilian-ai-system.ts`) mają jedną reakcję na reputację: przy wrogiej postawie każdy byt z `civilian` (przechodnie, tłum, a także Oyaji, Fumiko, Kenta, Goro, Sachiko, Ume, barman i bywalcy Neon Koi, Hideo, Tetsu i Mei) ucieka od gracza bliżej niż `FLEE_RADIUS` = 7 m z prędkością 3,4 m/s, potem wraca na miejsce (1,4 m/s). Nie uciekają tylko Mori (frakcja `clinic`) i Hana (nie ma `bystander`).
- Sklep (`shopTerms`): nieufnie ×1,25 przy kupnie i ×0,75 przy skupie, wrogo odmowa (`InteractionRefused`), przyjaźnie ×0,9 i ×1,1, zaufanie ×0,8 i ×1,2. Ink przy postawie wrogiej (czyli od −11): Hana, Ume, Tetsu, Mei, Sachiko, Goro, Kenta i Hideo odmawiają rozmowy, a Oyaji mówi „płacisz więcej”.

**Pomiar** (test `sim` bez renderera, ziarno 3, gracz stoi 2 m od miejsca postaci, 1800 kroków po 1/60 s, liczone od kroku 300; skrypt pomiaru wejdzie jako test etapu 1):

| Postać | Cywile | Zmiany kierunku ruchu względem gracza w 30 s | Odległość od gracza |
|---|---|---|---|
| Ume | −11, −30, −60 | 1095 | 6,97–7,05 m |
| Oyaji | −5 | 0 | 2,00 m |
| Oyaji | −11, −30, −60 | 1079 | 6,97–7,06 m |

Przyczyna drgania: ucieczka kończy się zaraz za 7 m, powrót na miejsce prowadzi z powrotem w promień, więc w co drugim kroku postać zmienia kierunek (ok. 36 razy na sekundę, amplituda 8 cm). Oyaji przy −11..−49 ma otwarty sklep z dopłatą 25%, ale promień interakcji to 3 m, a on trzyma się 7 m od gracza: sklep jest nieosiągalny, zanim reputacja dojdzie do progu odmowy.

**Bilans reputacji u mieszkańców dziś** (`reputationEffects`, `generateContractOfKind`, `contract-plan.ts`, ink):

| Źródło | Cywile | Uwagi |
|---|---|---|
| Zabity ganger Hebi (ostatnie trafienie gracza) | −1 | Hebi −4; tak samo w walce, od tyłu, wsparcie z heatu, cel zlecenia |
| Zabity cywil | −25 | |
| Zabity fixer albo człowiek kliniki | −10 | jego frakcja −25 |
| Zabity Kagami albo Tessen | 0 | |
| Ogłuszenie (ADR-0065) | 0 | reputację zmienia dopiero śmierć |
| Zgłoszone przestępstwo (ADR-0029) | 0 | tylko heat |
| Kaito, likwidacja: +1 za ukończenie, cele 2–4 | −1..−3 | cele `min(4, 2 + los{0,1} + ⌊ukończone/3⌋)`: zlecenia 1–3 dają 2–3 cele, 4–6 dają 3–4, od 7. zawsze 4 (−3) |
| Kaito, likwidacja z wariantem (ADR-0034) | do −10 | ochroniarze +2, sobowtór +1, czujka `lockdown` +1, zasadzka +2 (`setup` +3), każdy −1 |
| Kaito, kurs | +1 | przy wrogiej postawie cywilów Hana odmawia rozmowy, więc kursu nie da się oddać (porażka: fixerzy −4) |
| Hana, odzyskanie: +3, strażnicy 2–4 | −1..+1 | po ogłuszeniu strażników +3; Hana odmawia przy wrogiej postawie |
| Hana, ochrona: +6, fala 2–4 | +2..+4 | porażka (martwy Oyaji) −5; Hana odmawia przy wrogiej postawie |
| Genzō, eskorta | +3 | porażka −3; Genzō odmawia przy wrogich fixerach |
| Genzō, infiltracja, włamanie | 0 | |
| Mikrozdarzenie: napad (60%) | +1 | +3 nagrody, −2 za dwóch zabitych napastników; po ogłuszeniu +3 |
| Mikrozdarzenie: pomoc (40%) | +2 | szansa 12% na wejście do dzielnicy |
| Spotkania w ink (jednorazowe albo raz na noc) | −4..+3 | 14 zmian u cywilów w `enc-*.ink` |
| Fabuła | +5, +2, +3 (ink M0), +5 (M3), +15 albo −5 (koniec aktu II) | jednorazowe |

Wniosek: grając głównie dla Kaito, gracz spada do postawy wrogiej (−11) po ok. 5–6 likwidacjach bez wariantów albo po 1–2 z wariantami. Wtedy zamykają się jedyne powtarzalne źródła reputacji (Hana: odzyskanie, ochrona i odbiór kursu), a zostają eskorta w Dokach i rzadkie mikrozdarzenia. To pętla bez wyjścia, nie brak treści. Zabicie gangera zawsze kosztuje, więc „oczyszczanie” Lublina z Hebi obniża reputację.

## Decyzja
Do akceptacji użytkownika. Liczby są startowe, poprawia je etap 8 ADR-0059. Reputacja nie zależy od poziomu trudności (ADR-0066). Frakcje, zakres ±100 i progi `reputationTier` zostają.

- **Reakcje według progów** (cywile; „stali mieszkańcy” to byty z `civilian` i interakcją: sklep albo rozmowa):

  | Próg | Przechodnie i tłum | Stali mieszkańcy | Sklep | Rozmowy (ink) |
  |---|---|---|---|---|
  | zaufanie ≥ 50 | spokój | zostają | ×0,8 / skup ×1,2 | ciepłe kwestie |
  | przyjaźnie 11..49 | spokój | zostają | ×0,9 / ×1,1 | jak dziś |
  | neutralnie −10..10 | spokój | zostają | ×1 / ×1 | jak dziś |
  | nieufnie −49..−11 | ustępują: odsuwają się krokiem (1,4 m/s) z 3,5 m, patrzą na gracza, bez komunikatu | zostają | ×1,25 / ×0,75, pełna oferta | chłodna kwestia, potem zwykła rozmowa |
  | wrogo ≤ −50 | uciekają z 7 m (3,4 m/s), jeden komunikat jak po G-281 | zostają, odwracają się do gracza | ×1,5 / ×0,5, tylko podstawy | odmowa jak dziś (poza Haną) |

  Reakcja na hałas, strzały i ciała (ADR-0029) zostaje bez zmian i dotyczy też stałych mieszkańców: kulą się i uciekają przed strzelaniną, ale nie przed samą reputacją. Gangerzy, snajperzy i kamery dalej czytają `stanceOf`.
- **Kara zamiast ucieczki u sprzedawców.** `shopTerms` dostaje pole `stock`: „full” albo „basic”. Przy wrogości sklep jest otwarty, ale sprzedaje tylko amunicję i rzeczy z `stack` (jedzenie, apteczki, bandaże). Broń, ubrania, mody, plecaki, naprawy i wszczepy są zablokowane (`PurchaseFailure` „refused”, które już istnieje). UI pokazuje je wyszarzone z powodem. Klinika Mori stosuje tę samą tabelę (przy wrogości bez wszczepów), więc `InteractionRefused` przestaje zamykać panel sklepu. Zdarzenie zostaje w kontrakcie dla rozmów.
- **Ink rozróżnia progi.** `narrative-runtime` dopisuje zmienne `<frakcja>_tier` obok `<frakcja>_stance`. Odmowy rozmowy przechodzą z `civilians_stance == "hostile"` na `civilians_tier == "hostile"`. Przy nieufności postać mówi chłodną kwestię i rozmawia. **Hana nie odmawia nigdy:** przy wrogości daje tylko odzyskanie i ochronę („udowodnij, że jesteś po naszej stronie”) i zawsze przyjmuje kurs od Kaito.
- **Zysk za gangerów.** `member-killed` dostaje kontekst śmierci: czy ofiara była skrzywdzona bez walki (`wronged`), czy była wsparciem z heatu (`security`), czy należała do ekipy zlecenia albo mikrozdarzenia (tag). Cywile za Hebi:

  | Śmierć gangera Hebi | Cywile dziś | Cywile po zmianie |
  |---|---|---|
  | w walce, poza zleceniem i zdarzeniem, przy cywilach < +25 | −1 | **+1** |
  | jak wyżej, przy cywilach ≥ +25 | −1 | 0 (wyżej prowadzą tylko zlecenia i pomoc) |
  | od tyłu albo bez walki (`wronged`) | −1 | 0 (świadek zgłasza zabójstwo, patrz niżej) |
  | wsparcie z heatu (`security`) | −1 | 0 (bez farmienia przez heat) |
  | cel albo ekipa zlecenia, napastnik z mikrozdarzenia | −1 | 0 (liczy się wynik zlecenia albo zdarzenia) |
  | przy przyjaznej postawie Hebi | −1 | 0 (porachunki, nie obrona ulicy) |

  Hebi −4 bez zmian. Pozostałe frakcje bez zmian (cywil −25, fixer i klinika −25 i −10, Kagami i Tessen 0).
- **Świadkowie.** Zgłoszone przestępstwo (`CrimeReported`: cywil, kamera albo patrol) kosztuje cywilów −1 za napaść i −2 za zabójstwo, raz na zgłoszenie (świadkowie jednego zdarzenia dają jedno zgłoszenie, ADR-0029). Ulica ocenia to, co widzi. Jeden czyn liczy się raz: każda zgłoszona napaść kosztuje −1, także kolejna na tę samą ofiarę, a zgłoszone zabójstwo kosztuje −2 minus to, co ta ofiara już kosztowała napaściami (najwyżej do 0). Rozliczenie zabójstwa zamyka rachunek ofiary, a ciało zabójstwa zgłoszonego przez świadka nie daje drugiego zgłoszenia.
- **Bilans zleceń** (cywile za ukończenie; „czysta robota” to brak alarmu i dodatkowych zabitych w liczniku `ContractTally`, ADR-0029):

  | Zlecenie | Dziś (z celami) | Po zmianie | Czysta robota |
  |---|---|---|---|
  | Kaito, likwidacja | −1..−3, z wariantami do −10 | +2 | +4 |
  | Kaito, kurs | +1 | +1 | — |
  | Hana, odzyskanie | −1..+1 | +3 | +5 |
  | Hana, ochrona | +2..+4 | +6 | — |
  | Genzō, eskorta | +3 | +3 | — |
  | Genzō, infiltracja, włamanie | 0 | 0 | — |

  Od wyniku odejmują się zgłoszenia świadków. Strzelanina z dwoma zgłoszonymi napaściami daje więc w likwidacji 0, a cicha robota +4. Porażki bez zmian. Kaito przestaje szkodzić ulicy z założenia, a koszt robi się z tego, jak gracz pracuje.
- **Nowe źródła reputacji:**
  - zabici gangerzy w walce poza zleceniami (patrole Kanału, posterunki, Hebi zaczepiający na ulicy), do +25;
  - premia za czystą robotę w likwidacji i odzyskaniu (+2);
  - Hana jako droga powrotu przy wrogości (jej zlecenia dają +3..+6);
  - mikrozdarzenia częściej przy złej opinii: szansa 12% → 25%, gdy cywile < −10; pomoc +2 → +3; napad +3 bez zmian, a jego napastnicy nie liczą się osobno, więc ogłuszenie i zabicie dają to samo.

  Powrót z −50 do −10 to np. 7 ochron albo 10 czystych likwidacji. Wyjście z samej nieufności (−11) to jedno zlecenie.
- **Drganie na granicy** (sim, bez stanu w zapisie). Martwa strefa bez ukrytego stanu: postać, która boi się gracza i ma miejsce w promieniu ucieczki plus 2 m (7–9 m przy wrogości, 3,5–5,5 m przy nieufności), nie wraca, tylko stoi i patrzy na gracza. Decyzja dalej zależy wyłącznie od pozycji i reputacji (ADR-0011), więc wczytanie gry w trakcie ucieczki kończy się tym samym hashem. Cel: najwyżej 2 zmiany kierunku w 30 s pomiaru (dziś 1095), postać stoi 7–9 m od gracza.
- **Odłożone:** reputacja osobno dla dzielnic, zapominanie z upływem czasu (oba wymagają nowego stanu w zapisie) i nowe rodzaje zleceń (osobny ADR z treścią fabularną).

### Pytania do użytkownika
1. Czy ogłuszenie gangera w walce ma dawać +1 jak zabicie (wymaga znacznika na ciele, żeby późniejsze dobicie nie liczyło się drugi raz)?
2. Czy przy wrogości (≤ −50) Ume, Tetsu i reszta mają dalej odmawiać rozmowy, czy tylko mówić chłodno?
3. Czy klinika ma mieć karę jak sklepy, czy zostaje odmowa obsługi?
4. Czy limit +25 z zabitych gangerów jest dobry?

### Uzupełnienie 5.11: sprzedawcy karzą, nie uciekają
Decyzja użytkownika z 5.11: przy złej reputacji sprzedawca (stragan, sklep, klinika, każdy NPC z ofertą handlu) nie ucieka jak przechodzień, tylko karze ceną i węższą ofertą. Etapy 1–3 już to robią; uzupełnienie zapisuje progi w jednym miejscu i rozstrzyga pytanie o klinikę.

| Próg (`reputationTier` frakcji właściciela) | Kupno | Skup | Oferta (`ShopTerms.stock`) |
|---|---|---|---|
| zaufanie ≥ 50 | ×0,8 | ×1,2 | pełna |
| przyjaźnie 11..49 | ×0,9 | ×1,1 | pełna |
| neutralnie −10..10 | ×1 | ×1 | pełna |
| nieufnie −49..−11 | ×1,25 | ×0,75 | pełna |
| wrogo ≤ −50 | ×1,5 | ×0,5 | podstawy |

- **Podstawy** (`offersEntry`, `offersStack` w `core/shop`): amunicja i stosy, które nie zmieniają ciała. U Oyajiego sama amunicja, u Fumiko całe jedzenie, u Mori apteczki, bandaże i stymulant Shizuka.
- **Pod ladą przy wrogości:** broń, ubrania, mody (każda rzadkość), plecak, naprawy, wszczepy (kupno, montaż z torby, wyjęcie) i **shard pojemności**. Kupno kończy się `PurchaseFailure` „refused” z komunikatem `shop.failure.refused`, a panel pokazuje pozycję wyszarzoną z powodem (`shop.locked.reason`).
- **Klinika i `capacity_shard` (pytanie 3 i pytanie z backlogu):** klinika ma karę jak sklepy, nie odmowę obsługi. Shard jest stosem, więc po etapie 3 wroga klinika go sprzedawała (675 €$ zamiast 450), choć nota mówiła, że Mori nie operuje. Rozstrzygnięcie: stos z `cyberCapacity` to praca przy cyberware, nie podstawa, więc wroga klinika go nie sprzedaje; od nieufności w górę sprzedaje go z mnożnikiem progu (nieufnie 563 €$). Reguła zależy od pola katalogu, a nie od listy id, więc obejmie też przyszłe przedmioty zmieniające pojemność. Nota `shop.clinic.basic` (en i pl) mówi to wprost.
- **Ucieczka:** stali mieszkańcy (`civilian` z interakcją sklepu albo rozmowy) nie ruszają się z powodu reputacji na żadnym progu; przed strzałami, walką obok i ciałami (ADR-0029) uciekają jak dziś. Przechodzień przy wrogości dalej ucieka z 7 m.
- Bez zmian reguł symulacji (złote hashe bez zmian) i bez zmiany zapisu (`SAVE_SCHEMA_VERSION` zostaje).

## Etapy (osobne PR-y)
1. **Martwa strefa ucieczki** (`civilian-ai-system.ts`). Test sesji `sim` jak w pomiarze: Ume przy −30 robi najwyżej 2 zmiany kierunku w 30 s i stoi 7–9 m od gracza; wczytanie w trakcie daje ten sam hash; G-281 dalej daje jeden komunikat. Dowód: test pada na dzisiejszym kodzie (1095).
2. **Progi przechodniów i stali mieszkańcy.** Przy nieufności przechodzień odsuwa się krokiem bez `NpcReacted`, przy wrogości ucieka. Stali mieszkańcy (`civilian` z `interactable`) nie ruszają się z powodu reputacji, ale dalej reagują na strzały. Testy: Oyaji przy −30 i −60 zostaje w 2 m; przechodzień przy −30 odchodzi na 3,5 m; strzał obok Oyajiego go płoszy. Testy `reputation.test.ts`, które zakładają ucieczkę Ume, zmieniają się świadomie, bo zmienia się zasada.
3. **Sklepy i rozmowy:** `shopTerms` z `stock` i ×1,5 / ×0,5, klinika, UI zablokowanych pozycji (`packages/ui`, test komponentu), `<frakcja>_tier` w ink, Hana bez odmowy i z odbiorem kursu, chłodne kwestie przy nieufności. Teksty en i pl.
4. **Gangerzy, świadkowie i bilans zleceń:** kontekst `member-killed`, `CrimeReported` w reputacji, tabela zleceń i czysta robota w `core/reputation`, wywołania w `death-system`, `crime-system` i `contract-commands`. Testy `core` dla każdego wiersza tabel i `sim` dla zabicia w walce, od tyłu, wsparcia, celu zlecenia i limitu +25. Złote hashe.
5. **Mikrozdarzenia przy złej opinii:** próg 25% i pomoc +3. Testy `sim` z ziarnem, które trafia między 12% a 25%. Złote hashe, jeśli scenariusz wchodzi do dzielnicy.

## Konsekwencje
- **Złote hashe:** etap 4 zmienia tylko hash pojedynku wręcz w `determinism.test.ts` (gracz zabija w nim brawlera Hebi w walce, a reputacja jest w migawce). Hashe Normalnego i Trudnego zostają, bo w ich przebiegach nikt nie ginie. Etapy 1, 2 i 5 zmieniają go tylko wtedy, gdy scenariusz ma wrogą postawę cywilów albo trafi w nowy próg mikrozdarzenia. Każda zmiana z uzasadnieniem w commicie. Etap 3 nie zmienia reguł symulacji.
- **Zapis bez zmiany schematu:** reputacja, licznik zlecenia (`alarm`, `extraKills`) i `security` są już w zapisie, a `wronged` jest przejściowe jak w ADR-0029. Ganger zraniony bez walki i zapisany przed śmiercią liczy się po wczytaniu jak zabity w walce (+1 zamiast 0). Przyjmujemy to jak przy przestępstwach. Ogłuszony bez walki niesie to w zapisanym ciele (`downed.fought`), więc jego zabicie po wczytaniu nie daje +1. Rachunek ofiar (`street.charged`) też jest przejściowy, a ciała dostają po wczytaniu nowe id, więc zgłoszone zabójstwo po wczytaniu kosztuje całe −2, bez odliczenia napaści zgłoszonych przed zapisem. Rozjazd równa się kosztowi tych napaści, czyli najwyżej −2: ganger ogłuszony dwa razy na oczach kamery (−2), potem zabity bez świadków i znaleziony przez patrol kosztuje w grze ciągłej −2, a z zapisem i wczytaniem przed znalezieniem −4. Od poprawki G-334 zwłoki ogłuszonego nie dziedziczą `downed.reported`: zgłoszony nokaut nie oznacza zgłoszonego zabójstwa, a połączenia o nokaucie, które dochodzą po śmierci, zgłaszają tylko napaść (`knockOutCallsOver`). Zabójstwo ogłuszonego bez walki jest przestępstwem także po wczytaniu, bo `death-system` czyta zapisane `downed.fought` obok przejściowego `wronged`. Ganger ogłuszony na oczach patrolu, zapisany i po wczytaniu dobity na oczach patrolu daje więc heat 1→2 jak w grze ciągłej, a reputacja różni się tylko o rozjazd `street.charged` opisany wyżej (−3 wobec −2). Przyjmujemy ten rozjazd, jak przy `wronged`. `SAVE_SCHEMA_VERSION` zostaje 28.
- **Kontrakty:** bez zmian w `core/src/{ports,events,commands}`. `PurchaseFailure` „refused” i `InteractionRefused` już istnieją. `ReputationCause` i `ShopTerms` żyją w `core/reputation` i `core/shop`.
- **i18n (ADR-0056):** nowe klucze UI dla zablokowanej pozycji i warunków sklepu w `i18n/{en,pl}`, nowe kwestie ink w `ink/en` i `ink/pl` (Hana przy wrogości, chłodne kwestie przy nieufności). Polski katalog zmienia się świadomie, bo dochodzą nowe teksty, a nie tłumaczenia. Skan `i18n-scan` bez wzrostu bazy.
- ADR-0011 (ucieczka i odmowa sklepu), ADR-0018 (odmowa Hany, liczby zleceń) i ADR-0034 (nagroda za pomoc) zmieniają się w zakresie opisanym wyżej. Reszta zostaje.
- Gra przy złej opinii robi się chłodniejsza, ale nie pusta. Ulica ustępuje, sprzedawcy liczą drożej, a powrót jest zawsze możliwy przez Hanę.

## Uzupełnienie 6.11 (decyzja użytkownika)

Stymulant Shizuka (`steady_stim`) to stymulant bojowy, nie podstawa: wroga klinika go nie sprzedaje (pole katalogu `combatStim`), nieufna sprzedaje drożej. Podstawy u wrogiej kliniki to apteczki i bandaże; jedzenie u Fumiko, także syntetyczna kawa, zostaje.
