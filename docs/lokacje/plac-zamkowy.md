# Plac Zamkowy (`plac-zamkowy`)

Plac Zamkowy na Podzamczu (x ≈ 700..830, z ≈ 160..300), u stóp Wzgórza Zamkowego: od zachodu łuk kamienic z lat 50. (w66322919…w66324568, x 685..708, T-028), od wschodu monumentalne schody na Zamek (biegi x 760..829, z 211..293, T-113), od południa wiadukt Zamkowej spod Bramy Grodzkiej (w232362907, x 730..761, z 154..186), od północy aleja Tysiąclecia. Na placu parking, pchli targ i wejście A metra Plac Zamkowy (722; 286). Dzielnica `targ`, chunki `podzamcze-0-0` i `podzamcze-1-0`. Stan gry na `22b1808`.

## Historia
Przed wojną w tym miejscu biło serce żydowskiego Podzamcza: ulica Szeroka, synagogi przy wzgórzu, kramy i jatki pod Zamkiem. Niemcy zrównali dzielnicę z ziemią w latach 1942–1943, po likwidacji getta. Po wojnie na pustym terenie wytyczono plac, a od zachodu zamknięto go socrealistycznym łukiem kamienic z podcieniami; od wschodu zbudowano granitowe schody na wzgórze. Zamek, królewski od średniowiecza, w XIX wieku przebudowano w stylu neogotyckim na więzienie, które działało do połowy XX wieku, także jako więzienie niemieckie i potem bezpieki; dziś jest muzeum. Przy placu stoją pomnik żołnierzy AK i WiN, pomnik Lwa Lwowskiego i tablica cadyka Jakowa Ichaka Horowica, „Widzącego z Lublina”. W niedziele plac zamienia się w giełdę staroci.

W 2077 parking jest zawsze pełny, a pchli targ stoi codziennie (ADR-0068: zostaje na stałe): koce z elektroniką i wszczepami z odzysku pod kandelabrami. Tędy prowadzi droga aktu III na dziedziniec Zamku, gdzie Kagami trzyma archiwum (karta `zamek-dziedziniec`, `CASTLE_WALK` w `street-props.ts`). Rano Daigo goni po placu kurę z licencją (`enc_targ_chicken`). Przed chwilą ktoś zwinął koc ze stoiska przy schodach i zostawił na bruku pudełko po bateriach.

## Klimat
- Światło: 29 kandelabrów z kilkoma kloszami (plac i dolne przy schodach, m.in. (712,8; 214,1), (718,2; 227,6), (773,6; 211,8)), 17 pastorałów na grobli Zamkowej (T-232), 4 parkowe, jedna drogowa. Iluminacja Zamku daleko w głębi. Neony lokali łuku: SETKA KROTEK (#ff4040), ZIELONY RÓG 24H (#39ff8a), DZWONEK I SIODEŁKO (#00e5ff), KUCHNIA KRÓLOWEJ (#ffb000) w pawilonie „Bona” (708,4; 166,8). Żadnego światła gry.
- Dźwięk: auta na parkingu i alei, targowanie przy kocach, gołębie, kroki na schodach. Źródeł w grze brak.
- Zapach: spaliny, mokry granit schodów, smar i lutowie z koców.
- Kontrast: neogotycki Zamek i socrealistyczne podcienia nad straganami z wszczepami z odzysku; parkomaty z płatnością siatkówką obok koca z kablami.
- Ruch: tłum na `podzamcze-1-0` (profil `street`, 0,7), wschodnia część; zachodnia część z łukiem kamienic (`podzamcze-0-0`) jest bez tłumu. 23 stragany z 8 postaciami przy nich.

## Przeznaczenie
- Droga na Zamek (akt III) i wyjście z metra Plac Zamkowy (`metro_ride_3`, przesiadka na Dworzec). Plac tła: bez zleceń i terytoriów.
- Spotkanie `targ_chicken` (735; 296) przy pawilonie metra, 6:00–13:00. Miejsca przestępstw w toku `targ` (740; 306) i (702; 234) (`MICRO_SPOTS`).
- Wejścia: wiadukt Zamkowej od Bramy Grodzkiej, Podwale pod wiaduktem (T-024: przecięte pomostem), schody na Zamek, aleja Tysiąclecia od północy, podcienia łuku kamienic.
- Osłony: 27 zaparkowanych aut, 23 stragany, 43 drzewa, pomniki, słup ogłoszeniowy (712; 195), pawilon metra. Dużo średnich osłon, dobra scena walki.
- Punkt widokowy: podesty schodów zamkowych na zachód, na plac i Stare Miasto na skarpie.

## Topografia
- Prawdziwe miejsce: Plac Zamkowy (parking w294103450), łuk kamienic, schody zamkowe (w1435832499, w1305940836, w1305889408, w1305940837, w1306105687), wiadukt Zamkowej. Teren z NMT: płyta placu ok. 175,0–176,0 m n.p.m. (y ok. −20,8..−19,8), skarpa Starego Miasta na zachodzie do 195,8 m.
- Zgodne: obrys placu, łuk kamienic, położenie schodów i pomników, kandelabry na kostce (T-005, celowe do czasu danych).
- Odstępstwa: nadbudowy łuku kamienic do +24 m (T-028, celowe, ADR-0051); wiadukt jako sam pomost bez arkad (T-023), Podwale pod nim przecięte (T-024); pas bez nawierzchni u stopy schodów (T-128, G-218); biegi schodów węższe (T-126, G-217), pochyłe podesty (G-849), dolne kandelabry na skarpie (T-115, G-205); 26 z 38 zatok parkingu bez aut przez spadek (T-087); wyjście pawilonu metra na rabatę (T-158, G-365); postać z kolejki pod wiaduktem na pomoście (T-139, G-262).

## Inwentarz docelowy
Architektura:
- bruk placu z miejscami parkingowymi, kostka chodników, podcienia łuku kamienic (mapa);
- schody zamkowe z pięcioma podestami i balustradami (mapa, `steps`, G-217, G-849);
- wiadukt Zamkowej na arkadach (do zrobienia, T-023: model mostu).
Duże obiekty:
- stragany pchlego targu z kocami, plandekami i lampami na kablu do kandelabrów (model gry `market-stall`, `market-goods`);
- auta na parkingu, parkomaty, słup ogłoszeniowy z holo-kolumną (model gry `vehicle-props`, `ticket-machine`, `advertising-column`);
- pomniki AK-WiN i Lwa, kandelabry, ławki, kosze (model gry `monument`, meble uliczne).
Drobiazg w skupiskach:
- przy straganach: pudełka po bateriach, zwoje kabli, płytki drukowane, kubki sprzedawców (generator ADR-0096 `boxes`, `litter`; zapas straganów T-106);
- przy pawilonie metra: bilety, ulotki (drobiazg `METRO_DETAIL`);
- na podestach schodów: puszki, niedopałki, kartki z wróżbą (Blender, nowy `tools/blender/rooms/plac_zamkowy.py`).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: ciasne przejście pod wiaduktem i wąska grobla Zamkowej otwierają się na plac szeroki na ok. 120 m, a schody zamkowe wznoszą się na nim ku bramie Zamku; to sekwencja ciasno i szeroko w górę. Dług: przecięte Podwale (T-024) zamyka jedno z dojść.
- §13 częściowo: kandelabry i pastorały mają oprawy, ale cały plac świeci jedną ciepłą barwą. Nawigacja: wejście do metra i dolny bieg schodów bez wyróżnienia (G-205: kandelabry dolne na skarpie). 60-30-10 niemierzone (zrzut nocny z wiaduktu na plac, `pnpm shots:palette`). Pomiar nocny 24.11 (22:00, ujęcie `plac-zamkowy` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 85,3/14,4/0,3, za ciemno.
- §14 częściowo: makro i mezo bogate (23 stragany, 27 aut, 43 drzewa, 23 kosze z kwiatami), mikro 2 rzeczy `market-goods` i 2 graffiti; skupisk przy kocach brak.
- §15 częściowo: mokry bruk i lakier aut; brak szkła i chromu na straganach z elektroniką.
- §16 zgodne: ulica w socrealistycznej oprawie, ciepły żółty kandelabrów, prowizoryczne stragany.
- §17 dług: targ i parking bez dźwięku źródła; brak emiterów na Podzamczu. Ruch: tłum na wschodzie placu, auta; skala: stragany, auta, ławki, stopnie.

## Scenariusz tła
- Kto tu bywa: sprzedawcy pchlego targu z kocami elektroniki i wszczepów z odzysku; kierowcy szukający miejsca na zawsze pełnym parkingu; pasażerowie metra Plac Zamkowy i turyści na schodach na Zamek; rano Daigo goniący kurę z licencją (`enc_targ_chicken`).
- Co się dzieje: rano rozkładają się koce pod kandelabrami, a Daigo biega za kurą przy pawilonie metra; w dzień targ i parking żyją razem, turyści wchodzą schodami na wzgórze; wieczorem stoiska się zwijają i zostaje parking, łuk podcieni i droga na dziedziniec Zamku.
- Ślad obecności: pudełko po bateriach na bruku przy schodach, porzucone kable i obudowy przy kocach, znicze pod tablicą Widzącego z Lublina.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/plac-zamkowy-detail.ts`, `tools/blender/rooms/plac_zamkowy.py`, test `packages/sim/test/plac-zamkowy-scene.test.ts`): przed każdym straganem placu koc z elektroniką i wszczepami, girlanda ciepłych żarówek między przednimi słupkami (rysunek), skupiska; zielona oprawa nad otworem pawilonu metra (rysunek). Zostaje:
- Zrobione 23.11: światło w girlandzie każdego z 6 straganów placu (ciepłe, zasięg 5 m) i zielone przy lampie pawilonu metra A (6 m), w oprawach z modeli `rd-pz-stall` i `rd-pz-metro-lamp` (`PLAC_ZAMKOWY_LAMPS` w `packages/sim/src/content/district-targ.ts`, `SceneLamps` w `packages/engine/src/renderer/mapcity/scene-lamps.ts`; włączone do 60 m od środka placu).
- Zrobione 24.11 (decyzja użytkownika: girlandy i pasy świateł w klimacie reszty gry): obszar targu obejmuje wszystkie 23 stragany (x 690..770, z 170..300; wcześniej tylko 6 przy metrze), więc koc, girlanda i światło ma każdy stragan. Nad targiem 8 przęseł od kandelabra do kandelabra (`plac-zamkowy-festoons.ts`, rysunek `festoon-signs.ts`): na 3,2 m, zwis 0,45 m, co drugie z ciepłymi żarówkami (co czwarta różowa albo turkusowa), co drugie z pasem neonu; z dala od drzew, budynków, dachu pawilonu i jezdni. Pomiar 60-30-10 nocą: środek targu (728; 255) baza 92,8 → 85,2%, światło 5,7 → 13,2%, akcenty 1,5 → 1,6%; pod girlandą (736; 230) akcenty 1,0 → 1,4%; ujęcie `plac-zamkowy` (715; 280) bez zmian (0,3 → 0,4%). Akcenty nadal pod 3%: zostaje neon targu przy pawilonie i barwne lampy straganów.
- Zrobione 26.11: neon TARG ZAMKOWY (różowy jak pasy neonu nad targiem, #ff3fa4) na dachu pawilonu metra, dwustronny: od południa przy krawędzi dachu zwrócony na targ (wszystkie stragany stoją na południe od pawilonu), od północy nad otworem i zieloną lampą, zwrócony na chodnik (przegląd kuratora #1059) (`PLAC_ZAMKOWY_SIGNS` w `plac-zamkowy-detail.ts`, na końcu ulicy chunka, więc żadne id się nie przesuwa). Zostają barwne lampy straganów (model girlandy z Blendera w innym kolorze żarówek). Pomiar 60-30-10 po zmianie niezrobiony: ujęcie `plac-zamkowy` nie doczekało się ustalenia miasta w 300 s w kontenerze sesji 26.11.
- Tłum na zachodniej części placu przy łuku kamienic (chunk `podzamcze-0-0` bez tłumu): miejsca w `packages/sim/src/content/crowd.ts` (`CROWD_SPOTS` na końcu).
- Emiter gwaru targu i aut parkingu: `packages/engine/src/audio/spatial.ts`.
- Spotkanie `targ_chicken`: ink („Kura wskakuje na schody na wiadukt i przez chwilę stoi na tle Zamku”) i komentarz w `encounters.ts` („under the Zamkowa viaduct's steps”) zakładają kładkę nad aleją, której gra nie ma (T-021: pokład targu zdjęty); punkt (735; 296) leży 110 m od wiaduktu Zamkowej. Propozycja: przenieść punkt pod schody zamkowe, u stopy biegu w1305940836 przy ok. (772; 244), gdzie kura może wbiec na schody z Zamkiem w tle, i zmienić zdanie na „wskakuje na schody zamkowe” w `packages/narrative/ink/{pl,en}/enc-targ.ink`; punkt w `packages/sim/src/content/encounters.ts`.
- `CASTLE_WALK` w `packages/sim/src/content/street-props.ts` kończy się na alei (741; 327) „do targu”, którego tam już nie ma: komentarz do poprawy.
- Wiadukt Zamkowej na arkadach (T-023) i przejście Podwala pod nim (T-024), schody (G-217, G-218, G-849, G-205): według zgłoszeń, `tools/osm-import` i `packages/engine/src/renderer/mapcity`.
- Zmierzyć 60-30-10 nocą z wiaduktu na plac i wpisać w §13 tej karty.
