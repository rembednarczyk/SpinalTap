# Aleja Tysiąclecia i hale bazaru (`aleja-tysiaclecia`)

Aleja Tysiąclecia na Podzamczu, dwujezdniowa droga pod Wzgórzem Zamkowym od Lubartowskiej (x ≈ 560) do ronda Dmowskiego (x ≈ 1080), z ≈ 300..370, i hale Targu „Bazar” na jej północnej stronie (OSM w67502759, środek (681; 413); stragany x 668..716, z 386..437). Przy halach stoi grupa Hebi terytorium `bazaar-halls` (rdzeń (660; 380), 3 członków, ADR-0091). Na wschodzie aleja dochodzi do Dworca Autobusowego (karta `dworzec-autobusowy`), na zachodzie do Lubartowskiej (karta `lubartowska`). Dzielnica `targ`, chunki `podzamcze-0-0`, `podzamcze-1-0`, `podzamcze-2-0` i `podzamcze-0-1`. Stan gry na `22b1808`.

## Historia
Aleję wytyczono po wojnie przez dolinę pod Zamkiem, na terenie zniszczonej dzielnicy żydowskiej, i nazwano na tysiąclecie państwa polskiego. Stała się główną drogą z zachodu na wschód miasta, z przystankami „Muzeum Narodowe – Zamek”, sygnalizacją i barierką w pasie dzielącym. Na północ od niej, między aleją a ulicą Nowy Plac Targowy, działa Bazar: pawilony i budy targu, gdzie kupuje się mięso, pieczywo, ubrania i drobiazg. Na wschodnim końcu, przy rondzie Dmowskiego, stoi Maszt Niepodległości.

W 2077 aleja jest granicą: na południe Zamek i turyści, na północ handel Podzamcza pod okiem Hebi. Do listopada na alei stało targowisko gry na pokładzie nad jezdnią, które przeniesiono do Alchemii (ADR-0063, decyzja użytkownika w `docs/backlog.md`: „Targowisko na al. Tysiąclecia do likwidacji”), a jezdnie znów są ciągłe (T-021). Goro pamięta: „Trzydzieści lat handlujemy obok siebie, pod wiaduktem, a teraz tu, w Alchemii” (`m4-ulica.ink`). Na Bazarze zostali Hebi. Po południu ich poborca liczy dług Akane przy chodniku alei (`enc_targ_debt`), wieczorem Riko śpiewa przy przystanku (`enc_targ_idol`). Przed chwilą ktoś spod hal zostawił na barierce alei siatkę z kiełbasą i poszedł na przystanek.

## Klimat
- Światło: 50 latarni drogowych na obu jezdniach (co ok. 35 m, m.in. (644,7; 363,5), (679,4; 358,7), (713,9; 354)), 12 parkowych przy chodnikach, 3 kandelabry przy Placu Zamkowym; przy halach 3 parkowe (np. (721,3; 381,4)) i 3 drogowe. Neony lokali na południowej pierzei: APTEKA GEMMA (#ff2e88), BANK ALIBI (#ff4040), SALON KUPIDYNA (#00e5ff), BANK MILOWE KAMIENIE (#ff2e88); na północy pawilony przy Dworcu: OBŁOK PARY, CHLEB Z TONE, PIEKARNIA ŻARNA, KIOSK. Żadnego światła gry. Hale nocą są ciemną plamą między latarniami alei.
- Dźwięk: ruch na trzech pasach w każdą stronę (auta na `primary`, 13,5 m/s), trolejbusy (aleja jest w `TROLLEY_STREETS` w `traffic.ts`, choć OSM nie ma tu sieci trakcyjnej), sygnalizacja przejść. Od hal: rolety, nawoływanie straganiarzy. Źródeł stałych w grze brak poza autami.
- Zapach: spaliny, wędzonka i pieczywo z hal, guma opon na mokrym asfalcie.
- Kontrast: sześć pasów z kamerami ANPR (plan ulic) obok bud z blachy i plandek; bank z holo-szyldem nad sex shopem.
- Ruch: auta i trolejbusy cały dzień; tłum tylko na `podzamcze-1-0` (profil `street`, 0,7). Hale (`podzamcze-0-1`) i zachodnia część alei (`podzamcze-0-0`) są bez tłumu: przy 48 straganach stoi 16 postaci z mebli.

## Przeznaczenie
- Oś Podzamcza ze wschodu na zachód: z Placu Zamkowego i metra A do Dworca i metra B, z Lubartowskiej pod Zamek. Teren Hebi przy halach (`bazaar-halls`).
- Spotkania `targ_debt` (770; 366), 12:00–20:00, i `targ_idol` (790; 362), 19:00–23:00, na północnym chodniku przy przystanku „Muzeum Narodowe – Zamek 02” (792,6; 363,3). Miejsca przestępstw w toku (760; 330) i (845; 360) (`MICRO_SPOTS`).
- Przejścia: naziemne z sygnalizacją (m.in. (730,7; 357,9), (741; 325)); poza nimi jezdnie z ruchem i barierką w pasie dzielącym.
- Osłony: stragany i budy hal, wiaty przystanków, drzewa, szafki uliczne; na samej alei tylko auta w ruchu.
- Punkt widokowy: brak; z alei widać Zamek na wzgórzu (punkt orientacyjny całego Podzamcza) i skarpę Starego Miasta.

## Topografia
- Prawdziwe miejsce: Aleja Tysiąclecia (w202337368, w1004769663, w739432828), Targ „Bazar” w67502759, przystanki „Muzeum Narodowe – Zamek”, Maszt Niepodległości (1081; 306,8). Teren z NMT ok. 173,4–180,9 m n.p.m. (y −22,4..−14,9), najniżej przy halach.
- Zgodne: obie jezdnie ciągłe z kierunkami z OSM (T-021, poprawione #327), bez kładki, której w rzeczywistości nie ma; przystanki, sygnalizatory przy krawężniku (T-031).
- Odstępstwa: pas dzielący za wąski i goły (T-174, G-351); gołe podłoże przy krawężniku północnym i przy halach (T-165, T-173, T-176, T-191, T-172); drzewa reguły koron na dachach Bazaru (T-300); nazwa „Aleja Tysiąclecia” na odcinku „Aleje” (T-030). G-036 (zawrotki przy targu) dotyczy stanu sprzed #327 i jest do zamknięcia po sprawdzeniu.

## Inwentarz docelowy
Architektura:
- jezdnie, pas dzielący z barierą i reklamami, chodniki z kostki (mapa, G-351);
- hale Bazaru: pawilony z blachy z roletami, daszki nad przejściami (mapa i generator straganów ADR-0058; daszki `building=roof` pominięte, G-063);
- wiaty przystanków z holo-rozkładem (model gry `bus-shelter`).
Duże obiekty:
- stragany i budy z ladami, lodówki, wagi, regały (model gry `market-stall`, `market-goods`);
- latarnie drogowe z kamerami ANPR i banerami, sygnalizatory, szafki (model gry, meble uliczne; kamery: Blender `tools/blender/rooms/aleja_tysiaclecia.py`);
- skrzynie i beczki zapasu przy halach (T-106, generator ADR-0096 `boxes`).
Drobiazg w skupiskach:
- przy halach od strony alei, gdzie stoją Hebi: niedopałki, puszki, tag Hebi na rolecie (model gry `graffiti`, generator `litter`);
- przy przystanku: bilety, kubki, puszka Riko na datki (Blender, `aleja_tysiaclecia.py`);
- przy straganach: folie, kartony, ceny na tekturze (generator ADR-0096).

## Frakcja i zasady
Frakcja: ulica, korporacja (handel Bazaru przy alei miasta).
- §12 częściowo: aleja to szeroka otwarta przestrzeń bez ciasnego przedsionka; ciasne są tylko przejścia między budami hal. Dług: wejście z alei do hal bez progu (brama, daszek, zmiana nawierzchni).
- §13 częściowo: latarnie mają oprawy, ale aleja świeci jednolicie, a hale są ciemne; brak ciepłego światła handlu przy straganach i czerwonego przy grupie Hebi. Scena budżetu `podzamcze-tpp` (795; 339, na zachód) jest punktem do pomiaru 60-30-10 (`pnpm shots:palette`), dziś niemierzone.
- §14 częściowo: makro i mezo z mebli (48 straganów, 12 `market-goods`, 29 drzew na alei), mikro 69 naklejek i 22 graffiti na alei, przy halach 3 naklejki; skupisk przy grupie Hebi i przy przystankach brak.
- §15 częściowo: mokry asfalt z odbiciami latarni; brak szkła wiat i blachy hal z połyskiem.
- §16 częściowo: ulica w halach i korporacyjna infrastruktura alei są, ale bez kontrastu w świetle (wszystko jedna barwa latarni drogowych).
- §17 częściowo: auta i trolejbusy słychać ze źródła; hal i grupy Hebi nie słychać. Ruch: ruch uliczny, 3 Hebi przy halach; skala: wiaty, latarnie, stragany.

## Dług sceny
- Zrobione 23.11: girlanda ciepłych żarówek nad każdym z 48 straganów Bazaru (model `rd-targ-festoon`) i światło gry w każdej (`BAZAR_LAMPS` w `packages/sim/src/content/district-targ.ts`, do 70 m od środka). Zostało: goła żarówka przy grupie Hebi (660; 380), w oprawie na ścianie hali albo na straganie obok rdzenia.
- Daszki nad przejściami hal i brama od alei (G-063): `tools/osm-import` (zadaszenia `building=roof`) i generator straganów w `packages/engine/src/renderer/mapcity`.
- Tłum w halach i na zachodniej części alei (chunki `podzamcze-0-1` i `podzamcze-0-0` bez tłumu): `packages/sim/src/content/crowd.ts` (miejsca przy straganach, profil `market`).
- Skupiska przy halach (grupa Hebi), przy przystanku 02 i przy straganach: nowy `tools/blender/rooms/aleja_tysiaclecia.py`, nowy `packages/sim/src/content/aleja-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES`.
- Emiter gwaru hal i rolet: `packages/engine/src/audio/spatial.ts`.
- Sprawdzić i zamknąć G-036 (zawrotki przy dawnym targu) w `docs/glitches.md`.
- Pas dzielący z barierą (G-351): `tools/osm-import`, `packages/engine/src/renderer/mapcity`.
