# Krakowskie Przedmieście (Shinsekai-7) (`dzielnica-shinsekai-7`)

Dzielnica `shinsekai-7` (`DISTRICTS` w `world-map.ts`: „Krakowskie Przedmieście”): sześć chunków `krakowskie-0-0`…`krakowskie-2-1`, x −200..460, z −270..160, od Placu Litewskiego i ulic za nim na zachodzie po Plac Łokietka i Bramę Krakowską na wschodzie (granica ze Starym Miastem na x = 460), od Narutowicza i Bernardynów na południu (z −270, decyzja użytkownika 31.10, ADR-0042) po Plac Ofiar Getta i Alchemię na północy (z 160). Tu Seki budzi się w klinice i tu zaczyna się gra. Stan gry na `22b1808`.

## Historia
Krakowskie Przedmieście wyrosło za Bramą Krakowską wzdłuż drogi na Kraków, poza murami średniowiecznego miasta. Od XIX wieku jest główną ulicą Lublina: reprezentacyjne kamienice, hotele i sklepy, Plac Litewski z pomnikami unii z Litwą i Konstytucji 3 Maja, Ratusz na Placu Łokietka, pałace Lubomirskich, Czartoryskich i Potockich, kościoły kapucynów, bernardynów i św. Ducha, Teatr Osterwy, biblioteka Łopacińskiego. Deptak od Placu Litewskiego do Bramy jest najbardziej ruchliwym miejscem miasta.

W 2077 deptak nazywano kiedyś Shinsekai 7, „Siódmą” (`docs/narrative/lublin-names.md`), i ta nazwa została w kodzie i w języku ulicy. To dzielnica Kaito i jego baru Neon Koi, kliniki Mori, salonu PACHINKO i punktu skupu wspomnień Kagami za kliniką. Hebi trzymają tu trzy miejsca (ADR-0091): podwórko za myjnią przy Placu Łokietka (po prologu), Arkady Alchemii przy czujce i Kapucyńską. Od listopada na północnym skraju, między Świętoduską a Lubartowską, stoi Alchemia z targiem przeniesionym z Podzamcza (ADR-0063, ADR-0074), a w środku dzielnicy trzy place budowy (ADR-0087). Wczoraj w nocy ratownicy wyciągnęli Seki z wraku przy wylocie Kapucyńskiej, dziś rano obudziła się w fotelu Mori.

## Klimat
- Światło: najgęstsze w mieście. 23 światła gry: neony deptaka przy klinice i Koi (PACHINKO #39ff8a, RAMEN #ffb000, KUSURI #b46cff, NUMER 7, PULS 48, KLINIKA #39ffd0, NEON KOI i KOI LIVE #ff2e88, JUKE), lampy (zimne #9ad7ff i ciepłe #ffcf8a), czerwony MYJNIA 24H, lampy Placu Litewskiego (Shiro i wrak) i dwie przy Alchemii. Z mebli 51 latarni pastorałowych deptaka, 37 nowoczesnych słupów Placu Litewskiego, 119 drogowych, 21 parkowych. Partytura barw dzielnicy (ADR-0030, `district-palette.ts`): różowo-fioletowa mgła, różowy kontur (#ff8ad6), „neon barów przesącza się w fioletową mgłę”.
- Dźwięk: radio z drzwi Neon Koi, PACHINKO i RAMEN (`radio-speakers.ts`), brzęczenie neonów i para z kratek (`neonEmitters`, `DISTRICT_M0_VENTS` w `spatial.ts`: jedyne emitery stałe w mieście), tłum, trolejbusy Krakowskiego i Lubartowskiej.
- Zapach: ramen i yakitori z deptaka, ozon z neonów, mokry granit, środki odkażające z kliniki.
- Kontrast: zabytkowe pierzeje z holo-reklamami UMCS Corp i Kagami, a w bramach kartony i kubki; wszczep za fortunę u Mori obok skupu wspomnień bez szyldu.
- Ruch: tłum na deptaku (chunki `krakowskie-1-0` i `krakowskie-2-0`, profil `evening`: pełny od 17:00 do północy), w reszcie profil `nightlife` (udział 0,6, najwięcej nocą), w Alchemii profil `market`; 284 postacie z mebli, 28 postaci z treści (14 NPC, 14 Hebi).

## Przeznaczenie
- Dzielnica startu i aktu I: prolog M0 (klinika, Koi, myjnia), zlecenia Kaito na wraku i przy furgonetce (`south_gate`, `east_lot`), za Koi (`koi_back`) i przy myjni (`car_wash`), akt II w Alchemii (targ Hany, schron Hebi, galeria i food hall: `hana_stall`, `hebi_stash`, `raid_north`, `raid_east`).
- Terytoria Hebi: `car-wash-yard` (405; −25, po prologu), `alchemia-arcades` (449,5; 105,9), `kapucynska-alley` (153,1; −132).
- Metro: stacja Plac Litewski (`shinsekai` A (74; 16,9)) i oba wejścia stacji Brama Krakowska (`kanal` A na Placu Łokietka (433; −107), `kanal` B przy Alchemii (428; 28)).
- Skrytki: `stash:s7-pachinko`, `stash:s7-koi-back`, `stash:targ-roof` i `stash:targ-overpass` (Alchemia).
- Pasmo trudności (ADR-0059, `district-bands.ts`): 1–8; Alchemia (x 379..456, z −16..140, `BAND_AREAS`) w paśmie targu 10–20. Gracz wychodzi stąd na ok. 9. poziomie.
- Przestępstwa w toku (ADR-0091 §3): 7 miejsc `MICRO_SPOTS`, m.in. deptak (290; −84), (313; −113), Plac Litewski (0; −54), Karmelicka (108; 72), Peowiaków (66; −222).
- Główne osie: deptak Krakowskiego Przedmieścia (wschód–zachód, z ≈ −55..−105), Lubartowska z Placu Łokietka na północ do Alchemii, Kapucyńska i Karmelicka na południe i północ, 3 Maja, Peowiaków i Narutowicza na południu, Zielona i Świętoduska.

## Topografia
- Prawdziwe miejsce: Śródmieście Lublina między Placem Litewskim a Bramą Krakowską, z Placem Wolności, Placem Łokietka i Placem Ofiar Getta. Teren z NMT ok. 181,2–198,4 m n.p.m. (y −14,6..2,6): płasko na grzbiecie deptaka, w dół ku Czechówce na północy.
- Zgodne: 297 budynków, ulice i place z OSM, wysokości z LoD1 i LoD2, 198 lokali z szyldami (`venues` importu).
- Odstępstwa (wybór): wrak i furgonetka na Placu Litewskim (T-077); klinika i Koi wycięte w kamienicach (ADR-0045); myjnia w podwórku za Placem Łokietka (T-003, T-051); Alchemia według planu inwestora na Placu Ofiar Getta (T-145, T-205…T-208, ADR-0074); pawilony metra (T-155, T-156, T-157); linia metra pod deptakiem (T-148). Każda karta lokacji dzielnicy ma swoje wpisy.

## Inwentarz docelowy
Architektura:
- pierzeje kamienic z witrynami, bramami i podwórkami, granitowy deptak i bruk (mapa, ADR-0044, ADR-0077);
- wnętrza wycięte w kamienicach (klinika, Neon Koi) i Alchemia (`docs/pomieszczenia/`);
- place budowy z dźwigami i ogrodzeniem (generator ADR-0087).
Duże obiekty:
- wrak, furgonetka, kontenery, automaty, budki z jedzeniem, ogródki (treść gry, model gry);
- 306 ławek, 483 drzewa, 1839 słupków, latarnie pastorałowe deptaka (meble uliczne);
- yatai na południowym końcu deptaka i stoiska Alchemii (treść gry).
Drobiazg w skupiskach:
- przy lokalach deptaka, w podwórkach Koi i myjni, w Alchemii: 337 rzeczy `room-detail` i 138 `clutter` (Blender, ADR-0098);
- naklejki (188), graffiti (98), plakaty na słupach (meble i decale ADR-0058).

## Frakcja i zasady
Frakcja: ulica, korporacja (deptak półświatka w zabytkowym śródmieściu korporacji).
- §12 zgodne: deptak (ok. 20 m) z ciasnymi bramami podwórek (Koi, myjnia), wąska Kapucyńska, otwarcie na Plac Litewski (ponad 200 m) i Plac Łokietka; Alchemia z ciasnymi przejściami parkingu i atrium.
- §13 częściowo: światło gry skupione na odcinku x 297..334 deptaka, przy myjni i w Alchemii; reszta dzielnicy (Plac Litewski poza dwiema lampami, Kapucyńska, Peowiaków, Narutowicza, place budowy) świeci tylko latarniami. 60-30-10 niemierzone dla dzielnicy; punkt pomiaru: scena budżetu `krakowskie-tpp` (270; −81, na wschód).
- §14 częściowo: makro i mezo bogate, mikro w skupiskach tylko we wnętrzach i Alchemii; na ulicach 138 rzeczy `clutter` na 6 chunków.
- §15 częściowo: mokry granit i bruk z odbiciami (barwa mokrej ulicy z palety ADR-0084), szkło witryn; mało rozlanych płynów i kałuż poza myjnią.
- §16 zgodne: ulica (prowizorka, neony, brud bram) i korporacja (fasady UMCS Corp, Kagami, plac miejski) stoją obok siebie, jak chce §3.
- §17 częściowo: jedyna dzielnica z emiterami (neony, para) i radiami w drzwiach; poza deptakiem bez dźwięku źródła. Ruch: tłum, ruch uliczny, Hebi, NPC z planami dnia.

## Spotkania
- `s7_pachinko`: deptak przed salonem PACHINKO (306; −77), 19:00–4:00, Nobu (`enc_s7_pachinko`). Na ławce siedzi starszy facet z pustym rękawem, z którego sterczą kable: postawił w automacie prawą rękę z odzysku i przegrał. Seki może wyciągnąć dłoń z podajnika przez gniazdo serwisowe (razem z garścią żetonów do Neon Koi) albo poradzić mu, żeby przestał grać.
- `s7_salaryman`: chodnik przy Neon Koi (328; −91), 1:00–6:00, sarariman (`enc_s7_salaryman`). Na chodniku śpi facet w garniturze z teczką pod głową, a optyka miga mu dwunastoma nieodebranymi połączeniami od „Szefa”. Obudzony bierze Seki za dziekana UMCS Corp i oddaje jej kartę na ramen u Fumiko; okradziony prosi mamę o jeszcze pięć minut.
- `s7_neko`: Plac Łokietka (428; −99), 9:00–18:00, Hina (`enc_s7_neko`). Dziewczynka w żółtej pelerynie zagląda pod ławki i szuka srebrnego kota na baterię, który „mruczy jak lodówka”. Kot śpi pod szczotkami myjni za Placem Łokietka; oddany Hinie przynosi Seki błyszczący drobiazg spod wraku, rozebrany na baterię zostawia dziewczynkę z pytaniem, dlaczego się nie rusza.
- `s7_poet`: Plac Litewski pod latarnią (97; −23), 18:00–23:00, Shiro (`enc_s7_poet`). Chudy mężczyzna czyta na głos wiersz o żonie, której wspomnienia sprzedał Kagami „z dopłatą za ślub”. Wysłuchany do końca dziękuje, że ktoś usłyszał go dwa razy, a zapytany o Kagami wskazuje punkt skupu bez szyldu za kliniką.

## Dług sceny
- Światło gry poza odcinkiem kliniki i Koi: przynajmniej jedno źródło z barwą znaczenia (§4) przy każdym terytorium Hebi i przy każdym miejscu przestępstwa w toku (`MICRO_SPOTS` `shinsekai-7`): lampy w `packages/sim/src/content/district-m0.ts` (na końcu `DISTRICT_M0_PROPS`), przegląd `topography-curator`.
- Emitery poza deptakiem (tłum Placu Litewskiego, fontanna, place budowy z dźwigami ADR-0087): `packages/engine/src/audio/spatial.ts`.
- Sprzeczność ADR i gry: stacja `kanal` nosi nazwę „Brama Krakowska, Stare Miasto” (`metro.ink`, `metro.ts`), a oba jej wejścia stoją w Krakowskim (x 433 i 428, chunki `krakowskie-2-0` i `krakowskie-2-1`); Stare Miasto nie ma wejścia metra w swoich granicach. ADR-0045 („Gdzie co stoi”) podaje jeszcze węzeł przy (492; −80) (karta `brama-krakowska`). Propozycja: dopisek w `docs/adr/0071-metro-stacje.md`, że stacja obsługuje Stare Miasto z Placu Łokietka; zdanie w `packages/narrative/ink/{pl,en}/metro.ink` bez zmian.
- Sprzeczność komentarza i gry: `district-palette.ts` opisuje paletę słowami sprzed przenosin („Shinsekai 7”); paleta pasuje do deptaka, ale nie do Alchemii w paśmie targu. Propozycja: osobna paleta obszaru Alchemii albo świadome zostawienie fioletu Krakowskiego w `packages/engine/src/npr/district-palette.ts` (decyzja renderingu).
- Karty lokacji dzielnicy: `deptak-krakowskie`, `plac-litewski`, `myjnia-podworko`, `koi-podworko`, `plac-lokietka`, `zaulek-kapucynska`, `kosciol-sw-ducha`, `alchemia-*` (dziesięć kart), `budowa-arkologia`, `budowa-wzgorza`, `budowa-plac-koziolka`; wnętrza: `clinic`, `neon-koi`, `metro-shinsekai`, `metro-kanal`, `alchemia-*`. Dług każdej z nich jest w jej karcie.
