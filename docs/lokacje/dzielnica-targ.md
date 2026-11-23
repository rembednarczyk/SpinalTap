# Podzamcze (Targ) (`dzielnica-targ`)

Dzielnica `targ` (`DISTRICTS` w `world-map.ts`: „Podzamcze”): sześć chunków `podzamcze-0-0`…`podzamcze-2-1`, x 520..1120, z 160..580, w dolinie pod Zamkiem. Od Placu Zamkowego i podnóża Starego Miasta na południu (z 160, za nim Stare Miasto) przez aleję Tysiąclecia, Bazar i Dworzec Autobusowy po Nowy Plac Targowy, Ruską i cerkiew na północy; od Lubartowskiej na zachodzie po rondo Dmowskiego i Zamek na wschodzie. Na wschód od x = 1120 mapa się kończy, a Nabrzeże jest 1180 m dalej, tylko metrem (T-022). Stan gry na `22b1808`.

## Historia
Podzamcze przez kilkaset lat było żydowskim miastem Lublina, „Jerozolimą Królestwa Polskiego”: ulica Szeroka pod Zamkiem, synagogi, jesziwy, targi przy Ruskiej i Nowym Placu Targowym, Lubartowska jako główna ulica. W czasie okupacji Niemcy zamknęli tu getto, zlikwidowali je wiosną 1942 roku, a dzielnicę pod Zamkiem zrównali z ziemią. Po wojnie w jej miejscu powstały Plac Zamkowy z łukiem socrealistycznych kamienic, aleja Tysiąclecia, dworzec PKS i targowiska. Zamek, królewski od średniowiecza i przebudowany w XIX wieku na więzienie, jest dziś muzeum z gotycką kaplicą Trójcy Świętej i romańskim donżonem.

W 2077 dzielnica nazywała się Targ pod estakadą, od targowiska na pokładzie nad aleją (`docs/narrative/lublin-names.md`); id `targ` zostało. Targ przeniesiono do Alchemii na Krakowskim (ADR-0063, ADR-0074), a pokład zdjęto (T-021). Na Podzamczu zostały targi Bazaru i Ruskiej, pchli targ na Placu Zamkowym i cztery grupy Hebi (ADR-0091). W akcie III Kagami trzyma archiwum za drzwiami kaplicy na dziedzińcu Zamku (karta `zamek-dziedziniec`, ADR-0095). Goro wspomina: „Trzydzieści lat handlujemy obok siebie, pod wiaduktem, a teraz tu, w Alchemii” (`m4-ulica.ink`).

## Klimat
- Światło: 174 latarnie drogowe, 40 parkowych, 31 kandelabrów Placu Zamkowego, 17 pastorałów grobli Zamkowej, 19 latarenek ściennych, 6 reflektorów iluminacji Zamku. Zero świateł gry w całej dzielnicy. 57 lokali z szyldami na 177 budynków. Paleta dzielnicy (`district-palette.ts`): bursztyn i czerwień, „światło lampionów i dym z grilla”, ciepły kontur (#ffae55), którego źródeł (lampionów, grilli) gra tu nie stawia.
- Dźwięk: ruch na alei Tysiąclecia, Lubartowskiej i Ruskiej (auta, trolejbusy). Brak emiterów i radia: w dzielnicy nie ma żadnego neonu gry z etykietą.
- Zapach: spaliny alei, wędzonka i pieczywo z Bazaru, marynaty i smażone mięso z Ruskiej, mokry granit schodów zamkowych.
- Kontrast: Zamek z muzeum na fasadzie i archiwum korporacji w kaplicy, pod nim koce z wszczepami na pchlim targu; ślady getta obok kolejki do kebabu.
- Ruch: tłum tylko w dwóch chunkach z sześciu (`podzamcze-1-0`: Plac Zamkowy, aleja, Zamek; `podzamcze-2-1`: Ruska i cerkiew; profil `street` 0,7); Bazar, Dworzec, Nowy Plac Targowy i Lubartowska bez tłumu. 94 postacie z mebli przy straganach, 11 Hebi, archiwistka, Kurosawa i 4 strażników Kagami w akcie III.

## Przeznaczenie
- Dzielnica tła aktów II i III: przejście z metra Plac Zamkowy na Zamek, terytoria Hebi, targi. Żadne zlecenie Kaito ani Genzō nie leży na Podzamczu: zlecenia pasma `targ` (`hana_stall`, `hebi_stash`, `raid_north`, `raid_east`) są w Alchemii (`CONTRACT_SITE_BANDS`, `BAND_AREAS`).
- Terytoria Hebi: `bus-station` (801,4; 386,4, 3), `bazaar-halls` (660; 380, 3), `ruska-market` (830; 521, 3), `lubartowska` (528; 346, 2).
- Metro: stacja Plac Zamkowy (`targ`): wejście A na Placu Zamkowym (722; 286), wejście B przy Dworcu (754; 379).
- Pasmo trudności (`district-bands.ts`): 10–20; gracz wychodzi z pasma targu na ok. 23. poziomie (w praktyce z Alchemii).
- Przestępstwa w toku: 7 miejsc (`MICRO_SPOTS` `targ`): Plac Zamkowy (740; 306), (702; 234), aleja (760; 330), (845; 360), Furmańska (624; 192), Nadstawna (786; 438), Ruska (792; 540).
- Skrytki i kryjówki na ciała: brak (ADR-0091: „dziś 0 postaci i 0 kryjówek”; postacie już są, kryjówek nadal 0).
- Główne osie: aleja Tysiąclecia (wschód–zachód), Lubartowska i Ruska na północ, Zamkowa i schody z Placu Zamkowego na Zamek, Podwale pod skarpą Starego Miasta.

## Topografia
- Prawdziwe miejsce: Podzamcze, dolina Czechówki pod Wzgórzem Zamkowym. Teren z NMT ok. 168,6–193,6 m n.p.m. (y −27,2..−2,2): dno doliny ok. 174–176 m (Plac Zamkowy 175,5 m według planu ulic), Wzgórze Zamkowe ok. 188 m.
- Zgodne: 177 budynków, aleja z ciągłymi jezdniami (T-021), targi z rzędami straganów (T-026), Zamek z przepisem zabytku (T-112), schody zamkowe w miejscu z OSM.
- Odstępstwa (wybór): luka do Nabrzeża (T-022, celowe); nadbudowy łuku kamienic Placu Zamkowego (T-028) i pasa pod murami (T-012), celowe; wiadukt Zamkowej bez arkad (T-023); goły teren w komórkach (T-273, T-275, T-165, T-173); daszki targów pominięte (G-063); skarpy Wzgórza Zamkowego prawie bez drzew (T-117, G-207).

## Inwentarz docelowy
Architektura:
- Zamek, donżon i kaplica z przepisami (`landmarks/castle.ts`, ADR-0068), schody zamkowe z podestami, wiadukt Zamkowej na arkadach (mapa, T-023);
- łuk kamienic z podcieniami, hale Bazaru, dworzec z zadaszonym peronem (mapa, G-063);
- daszki nad rzędami straganów Ruskiej (G-063).
Duże obiekty:
- 226 straganów (Bazar 48, Ruska 131, pchli targ 23 i dalsze), wózki z jedzeniem, auta parkingu (meble, ADR-0058);
- kandelabry, latarnie drogowe z kamerami, wiaty przystanków (meble);
- autobusy nocne na Dworcu (do zrobienia, karta `dworzec-autobusowy`).
Drobiazg w skupiskach:
- przy straganach: zapas (T-106) i towar (`market-goods` 37);
- 245 naklejek i 140 graffiti (najwięcej w mieście, T-123), 7 rzeczy `clutter`; skupisk drobiazgu przy grupach Hebi i przy straganach brak.

## Frakcja i zasady
Frakcja: ulica, korporacja (targi Podzamcza pod Zamkiem Kagami).
- §12 częściowo: przejście pod wiaduktem Zamkowej i grobla otwierają się na Plac Zamkowy, a ciasne rzędy straganów na Ruską; aleja i skrzyżowania są szerokie bez progów.
- §13 dług: zero świateł gry; paleta obiecuje lampiony i grill, a dzielnica świeci latarniami drogowymi. Akcenty tylko z neonów lokali. 60-30-10 niemierzone; punkt pomiaru: scena budżetu `podzamcze-tpp` (795; 339, na zachód).
- §14 częściowo: makro i mezo gęste na targach, mikro to naklejki i graffiti; skupisk przy grupach i straganach brak.
- §15 częściowo: mokry asfalt i granit schodów; brak folii, plandek i mokrej posadzki pod straganami.
- §16 częściowo: ulica (targi, graffiti) i korporacja (Zamek Kagami) są, ale bez prowizorki i światła, które by je rozróżniały.
- §17 dług: poza ruchem ulicznym żadnego dźwięku ze źródła; brak radia i emiterów. Ruch: tłum w dwóch chunkach, Hebi, ruch uliczny.

## Spotkania
- `targ_fortune`: przy pawilonie metra B przed Dworcem (745; 376), 18:00–2:00, Kiku (`enc_targ_fortune`). Kobieta w chuście z diodami rozkłada na stoliku pękniętą talię kart AR z kontenera Kagami, który spadł z ciężarówki. Wróżba pokazuje Seki dach w deszczu i dwie sylwetki przy krawędzi, czyli przeszłość, która „jest jeszcze przed nią”.
- `targ_chicken`: Plac Zamkowy przy pawilonie metra A (735; 296), 6:00–13:00, Daigo (`enc_targ_chicken`). Między nogami klientów pędzi kura z piórami jak folia i anteną, Kurczak Premium z licencją, bez którego Daigo jest „facetem z pustą klatką i długiem w banku”. Seki łapie ją w locie i dostaje jajko z certyfikatem albo patrzy, jak kura ucieka na schody i znika.
- `targ_debt`: północny chodnik alei przy Dworcu (770; 366), 12:00–20:00, Akane i poborca Hebi (`enc_targ_debt`). Kobieta w fartuchu liczy monety na dłoni, a chłopak Hebi z tabletem wylicza dług jej zmarłego męża, który po roku spłacania urósł z trzystu do tysiąca. Seki może wybronić jej miesiąc słowem (przy przyjaznej postawie Hebi) albo ręką na rękojeści.
- `targ_idol`: przy przystanku na alei (790; 362), 19:00–23:00, Riko (`enc_targ_idol`). Dziewczyna śpiewa pod hologramem idolki, która wygląda jak ona, tylko młodsza: wytwórnia sprzedała jej twarz innej, która gra teraz Lubelski Festiwal na Placu Litewskim. Poproszona o piosenkę sprzed wytwórni gasi hologram i śpiewa bez podkładu, a straganiarze przestają ważyć towar.

## Dług sceny
- Pierwsze światła gry na Podzamczu: pchli targ na Placu Zamkowym zrobiony 23.11 (girlandy 6 straganów i zielona lampa metra A, karta `plac-zamkowy`). Światła sceny to grupy `SceneLampGroup` w `packages/sim/src/content/district-targ.ts`, które renderer włącza w pobliżu miejsca (`SceneLamps`). Nie są bytami, więc nie przesuwają id treści i nie potrzebują `GAME_PROPS`. Każde światło stoi w oprawie z modelu sceny (§13: bez światła znikąd). Bazar (48 straganów) i Ruska (171) zrobione 23.11: girlanda `rd-targ-festoon` nad każdym straganem i światło gry w każdej. Goła żarówka przy każdej z 4 grup Hebi zrobiona 23.11: na wysięgniku na ścianie przy dworcu i na Lubartowskiej (`rd-targ-bulb-wall`), na słupku w wiadrze z betonem przy Bazarze i Ruskiej, gdzie ściany nie ma w promieniu 4 m (`rd-targ-bulb-pole`), z ciepło-białym światłem gry nad rdzeniem grupy (`HEBI_BULBS`, `HEBI_LAMPS`). Zielona lampa nad otworem pawilonu B metra przy Dworcu zrobiona 23.11 (model `rd-pz-metro-lamp` z Placu Zamkowego, światło `DWORZEC_METRO_LAMPS`). Zostały neony z etykietami dla radia (`radio-speakers.ts`).
- Tłum w czterech chunkach bez tłumu (`podzamcze-0-0`, `podzamcze-0-1`, `podzamcze-1-1`, `podzamcze-2-0`): `packages/sim/src/content/crowd.ts` (profil `market` dla targów, `street` dla alei).
- Kryjówki na ciała przy targach (kontener przy Bazarze, skrzynie na Ruskiej): rekwizyty z `hide` w `district-targ.ts`.
- Sprzeczności ink i gry na Podzamczu (szczegóły i propozycje w kartach): `enc_targ_chicken` z kładką, której nie ma (`plac-zamkowy`); `enc_targ_debt` przy ścianie hali „od Ruskiej”, a punkt na alei (`aleja-tysiaclecia`); `enc_targ_idol` przy „północnym rzędzie” bez straganów (`aleja-tysiaclecia`); `enc_targ_fortune` „między straganami” 37 m od straganu (`dworzec-autobusowy`); `radio.ink` z wiaduktem nad Tysiąclecia i Fumiko przy dworcu (`aleja-tysiaclecia`, `dworzec-autobusowy`).
- Sprzeczność ADR i gry: ADR-0091 §1 stawia terytoria bez miejsc pamięci i kościołów, a `ruska-market` stoi 56 m od instalacji „Getto – drut kolczasty”, `lubartowska` 26 m od kościoła (karty `nowy-plac-targowy`, `lubartowska`).
- Paleta dzielnicy z lampionami i grillem (`district-palette.ts`) bez źródeł w scenie: dług zamyka punkt pierwszy; do tego czasu opis w komentarzu do poprawy.
- Karty lokacji dzielnicy: `plac-zamkowy`, `aleja-tysiaclecia`, `dworzec-autobusowy`, `nowy-plac-targowy`, `lubartowska`, `zamek-dziedziniec`, `cerkiew-przemienienia`; wnętrze `metro-targ`. Dług każdej z nich jest w jej karcie.
