# Plac Litewski: wrak przy południowej bramie i furgonetka na parkingu (`plac-litewski`)

Plac Litewski (x −100..135, z −55..70) i wylot deptaka przy Kapucyńskiej. Dwa miejsca zleceń Kaito: wrak, z którego wyciągnięto Seki (`south_gate`, wrak (152,6; −51)), i furgonetka na wschodnim skraju placu (`east_lot`, (112; −42)). Pod placem stacja metra Plac Litewski z wejściem A (74; 16,9). Stan gry na `1de4702`, scena przebudowana 23.11 (gałąź `feat/scena-plac-litewski`).

## Historia
Plac wziął nazwę od obozu szlachty litewskiej, która stanęła tu w czasie sejmu 1569 roku, kiedy w Lublinie zawarto unię Polski z Litwą. W XIX wieku powstał tu reprezentacyjny plac z Pomnikiem Unii Lubelskiej (żeliwny obelisk z 1826 roku), potem doszły Pomnik Konstytucji 3 Maja, Grób Nieznanego Żołnierza i konny pomnik Piłsudskiego. W 2017 plac przebudowano: granitowa posadzka, ławy na łukach rabat i fontanna multimedialna z pokazami w letnie wieczory.

W 2077 plac jest wizytówką miasta i jego granicą: za dnia festiwale i reklamy na fasadzie Poczty, nocą wschodni skraj przy deptaku przejmuje półświatek. W kodzie miejsce wraku nosi stare id `south_gate`, po „południowej bramie” dawnej dzielnicy Shinsekai; w Lublinie bramy tu nie ma, został wrak. Noc wypadku: Seki jechała cudzym autem z przeciętą opaską Kagami na fotelu, dron strzelał w opony, auto weszło w słup i skończyło na dachu przy wylocie Kapucyńskiej (`recall_crash_night`, `recall_last_call`: „Wisisz w pasach głową w dół”). Ratownicy wyciągnęli ją wczoraj w nocy, Ume patrzyła. Wraku nikt nie odholował: Hebi traktują go jak punkt spotkań, a obok, na skraju placu, od tygodni stoi furgonetka bez właściciela (w kodzie dawniej „Tetsuo”, od 23.11 bez imienia). Przed chwilą ktoś wyjął z wraku radio i zostawił otwarte drzwi. Ślady nocy leżą do dziś: opony z Kapucyńskiej, zgięty pastorał z krzywo wiszącą latarnią, szczątki drona, szkło, olej i taśma policji, a pod latarnią ktoś z ulicy zapalił znicze.

## Klimat
- Światło: ciepła lampa Shiro (100; −21, #ffcf8a) na zachodzie, zimna niebieska przy wraku (160; −48, #9ad7ff), zgięty pastorał (155,1; −50,9) z latarnią wiszącą krzywo nad wrakiem (dwie szyby jeszcze świecą ciepło), czerwone tylne światła wraku (akumulator żyje) i płomyki zniczy, grafitowe słupy z płaskimi oprawami nad placem, fontanna i iluminacja pomników daleko w głębi. Wschodni skraj jest ciemniejszy od reszty placu.
- Dźwięk: deszcz na granicie, szum suchych fontann wzdłuż Krakowskiego (emiter na każdej dyszy `fountain-jets`, najbliższa (128,2; −49,3)), kapanie oleju spod maski wraku i cichy syk pękniętej chłodnicy (para nad szczeliną maski), gwar deptaka za plecami. Neonów deptaka stąd już nie słychać (najbliższy 140 m).
- Zapach: mokry granit, płyn chłodniczy i spalona guma od wraku.
- Kontrast: wypielęgnowany plac z holo-flagami miasta obok wraku z drutami na wierzchu i furgonetki z zaklejonymi szybami.
- Ruch: tłum na alejkach, Shiro czytający wiersze wieczorem, ludzie wychodzący z metra, cienka para z chłodnicy wraku, mgła nad dyszami suchych fontann.

## Przeznaczenie
- Dwa miejsca likwidacji Kaito (pula `ELIMINATION_SITE_IDS`, także krok `echo_contract` aktu I) i miejsce pamięci wątku: wrak jest kotwicą retrospekcji „wrak”.
- Wejścia: deptak od wschodu (x 135), Kapucyńska od południa przy wraku, aleje placu z zachodu i północy, metro A (74; 16,9) otwarte na wschód.
- Osłony: furgonetka 2,4 × 2,2 × 5 m, wrak 1,9 × 1,25 × 4,5 m z otwartymi drzwiami (1,1 × 0,95 × 0,56) i stopą zgiętego słupa (0,8 × 1,8 × 0,65) od wschodu, 39 granitowych kostek, 32 ławki, 24 drzewa, słupy ogłoszeniowe. Plac jest szeroki i płaski, więc osłony są niskie.
- Punkty widokowe: brak wysokich; z alejek placu widać oba miejsca zleceń naraz (50 m między nimi).

## Topografia
- Prawdziwe miejsce: Plac Litewski (OSM, rewitalizacja 2017), wylot Kapucyńskiej na Krakowskie Przedmieście. Teren z NMT ok. 196,3–196,5 m n.p.m. (y 0,5..0,7), płaski.
- Zgodne: obrys placu, fontanna multimedialna w miejscu z OSM (niecka i 16 dysz, T-076), pomniki Piłsudskiego i 3 Maja w miejscach z OSM (T-075), ławki i kostki z OSM.
- Odstępstwa: wrak i furgonetka na nawierzchni pieszej (T-077, celowe, scena gry; skan `vehicle-on-pavement` ma je na liście celowych); zgięty pastorał w miejscu prostego z OSM (155,1; −50,9), ślady opon i taśma (T-077, celowe, noc wypadku); pomniki jako ta sama stojąca postać, Piłsudski bez konia (G-128); fontanna bez strumieni, czaszy i pokazu (G-129); wzór bruku przesuwa się na szwie chunków przy x ≈ 20 (G-041).

## Inwentarz docelowy
Architektura:
- posadzka z granitu z liniami odwodnienia, rabaty z obrzeżem (mapa, nakładka ADR-0077);
- pomniki Unii, 3 Maja, Piłsudskiego (model gry `monument`, do poprawy G-128), fontanna (G-129);
- pawilon metra Plac Litewski (`metro.ts`).
Duże obiekty:
- wrak na dachu: zgnieciony dach, wybite szyby, przecięte pasy zwisające do środka, otwarte drzwi kierowcy (zrobione 23.11: `rd-lit-wreck`, auto gry `veh-dirty` obrócone na dach skryptem Blendera `tools/blender/rooms/plac_litewski.py`, z wnętrzem, poduszką, kablami po radiu i podwoziem);
- zgięty słup pastorału (155,1; −50,9) i szczątki drona przy nim („Dron uderza w słup razem z tobą”; zrobione: `rd-lit-bent-lamp`, `rd-lit-drone`);
- furgonetka z zaklejonymi szybami i uchylonymi tylnymi drzwiami (skórka `van`);
- ławy, kostki, drzewa, słupy, kosze (model gry, meble uliczne).
Drobiazg w skupiskach:
- przy wraku: odłamki szkła, kawałek pasa, rękawiczka ratownika, urwana taśma (`rd-lit-glass`), olej i płyn chłodniczy (`rd-lit-spill`), ślady opon od jezdni Kapucyńskiej (`rd-lit-skid` ×3), taśma policji na słupku (`rd-lit-tape`), zapalone znicze, goździki i kartka od kogoś z ulicy (`rd-lit-candles`); zrobione 23.11, Blender `plac_litewski.py`;
- przy furgonetce: kubki, niedopałki wokół puszki, karton po makaronie z pałeczkami, puszki, zapalniczka, telefon (`rd-lit-van-camp`), plandeka z oponą (`rd-lit-tarp`), kartony, butelki i kałuża z zestawu wspólnego (`rd-c-cartons`, `rd-c-bottles`, `rd-c-puddle`); zrobione 23.11;
- pod lampą Shiro: kartki z wierszami przyciśnięte kamieniem, plastikowy kubek (`rd-lit-poems`; zrobione 23.11).

## Frakcja i zasady
Frakcja: ulica, korporacja (plac miejski Lublina 2077).
- §12 zgodne: deptak (ok. 21 m) otwiera się przy x ≈ 135 na plac szeroki na ponad 200 m; wylot Kapucyńskiej jest ciasnym progiem. Dług: brak progu między placem a jego wschodnim skrajem (półświatek) w świetle albo nawierzchni.
- §13 częściowo: dwie lampy gry ze źródłem, słupy placu z mebli. Nawigacja (23.11): wrak wyróżniają akcenty, których nie ma nigdzie indziej na placu, każdy na swoim źródle: czerwone tylne światła auta, ciepła latarnia wisząca krzywo nad nim na zgiętym pastorale, czerwono-biała taśma, płomyki zniczy i para nad maską. Lampy gry ze światłem silnika nie ruszałem (zimna (160; −48) zostaje). 60-30-10 nocą (`pnpm shots:palette`, 23:00): pierwszy kadr przed 81,3 / 15,4 / 3,3%, po 81,5 / 15,1 / 3,4% (poza pasmem: baza za duża, światło za małe, bo deptak przed wrakiem jest ciemny); przy wraku przed 70,6 / 27,7 / 1,7%, po 69,4 / 28,6 / 2,0% (akcenty poniżej 3%). Dług: latarnia zgiętego pastorału nie rzuca światła (model nie ma lampy silnika), więc auto oświetla tylko zimna lampa z boku. Pomiar nocny 24.11 (22:00, ujęcie `plac-litewski` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 55,5/41,1/3,3, zgodne.
- §14 częściowo (23.11): makro i mezo z mebli (39 kostek, 32 ławki, 27 słupków) i sceny (wrak, zgięty pastorał, drzwi, dron, plandeka); mikro w skupiskach: przy wraku i latarni 16 rzeczy w promieniu 3 m (szkło z pasem i rękawiczką, znicze z goździkami i kartką, szczątki drona, taśma), przy furgonetce 13 w promieniu 4 m (kubki, niedopałki, karton, puszki, telefon, kartony, butelki), pod lampą Shiro 6 (wiersze, kamień, kubek). Na telefonie drobiazg `fine` znika jak w innych scenach; wrak, pastorał, dron, taśma i plandeka zostają.
- §15 częściowo (23.11): mokry granit z odbiciami lamp; olej (ciemne lustro) i płyn chłodniczy pod maską, szkło na bruku i w środku auta, matowe podwozie z rdzą obok lakieru. Emisja z umiarem: tylne światła, dwie szyby latarni i płomyki to małe plamy.
- §16 częściowo: plac ma porządek miasta (korporacja); skraj od 23.11 ma brud ulicy przy wraku i furgonetce (śmieci, plandeka, kałuża, plama oleju), ale nawierzchnia i światło skraju są te same co placu (dług §12).
- §17 częściowo (23.11): dźwięk ze źródła: kapanie z plamy oleju pod maską (`drip`), cichy syk i para z chłodnicy (trzeci `STEAM_VENTS`), szum suchych fontann z każdej dyszy `fountain-jets` (nowy dźwięk `fountain`); emiter na ulicy słyszany z ulicy idzie w pełni, nie jak zza ściany. Ruch: para nad wrakiem, mgła dysz, tłum i Shiro wieczorem; skala: ławki, latarnie, pomniki, auto.

## Scenariusz

### Pierwszy kadr
Najczęściej gracz przychodzi deptakiem z Neon Koi na zachód (droga pijaka `east_lot` i `south_gate` w `contract-plans.ts` idzie odwrotnie: (300; −86,5) → (240; −66) → (150; −53)). Przy x ≈ 140 deptak się kończy: na wprost, przy wylocie Kapucyńskiej, wrak pod zimną lampą (160; −48), za nim otwarty plac z fontanną i pomnikami, 30 m dalej po prawej furgonetka na skraju placu, a jeszcze dalej na prawo ciepła lampa Shiro. Wzrok ma iść na wrak: jedyny obiekt w kadrze, który nie pasuje do placu.

### Postacie i miejsca
- Załoga `south_gate` (2–4 Hebi) tuż na południe od wraku: (146; −53), (154,5; −54,5), (149; −55), (156,5; −53,5), twarzami na północ, ku placowi (150; −40). Ochroniarze wariantu (145; −54,2), (147; −54,6), sobowtór (158,5; −54,5), czujka blokady (147; −49), zasadzka na wyjściu (150; −44), (145; −46), (155; −45).
- Załoga `east_lot` wokół furgonetki: (110,5; −45,5), (113,5; −38,5), (116; −44), (109,5; −39), twarzami na zachód (100; −42). Ochroniarze (109; −46,2), (111,8; −46,3), sobowtór (117,5; −40), czujka (106; −42), zasadzka (105; −43), (104; −36), (105; −50).
- Obie załogi istnieją tylko w czasie zlecenia; poza nim przy wraku i furgonetce nie ma nikogo.
- Shiro pod latarnią (97; −23), 18:00–23:00, raz (`enc_s7_poet`): sprzedał Kagami wspomnienia o żonie.

### Przebieg
1. Zlecenie u Kaito (`fixer.contract_offer`): miejsce „wrak na Krakowskim, przy Placu Litewskim” albo „parking przy furgonetce na Placu Litewskim”. W akcie I to krok `echo_contract`.
2. Dojście deptakiem i rozpoznanie: haki zlecenia (`hook_eliminate_1` podsłuch strażnika, `hook_eliminate_2` shard z luką w zmianie o 2:00). Warianty ADR-0034: ochroniarze, sobowtór, czujka, zasadzka, cel tylko nocą, limit czasu, pijak (cel idzie deptakiem do Koi i wraca).
3. Likwidacja przy wraku albo furgonetce. Napięcie: plac jest otwarty, więc strzał słyszy cały skraj.
4. Wypłata w Neon Koi (`contract_payday`). W akcie I Kaito pyta „Gdzie odpłynęłaś?”, a retrospekcja walizki gra sama.
5. Wspomnienie bez zlecenia: retrospekcja nocy wypadku (`recall_crash_night`) kończy się zdaniem „Wrak na Krakowskim, przy Placu Litewskim”; gracz, który tu wróci, stoi przy aucie, w którym wisiała w pasach (`recall_last_call`).
6. Shiro wieczorem: wysłuchać wiersza albo zapytać, czy Kagami wciąż kupuje (trop do punktu skupu za kliniką).

### Drogi
- Cicha: obie załogi patrzą na plac, plecami do deptaka, z którego przychodzi gracz; podejście od wschodu za pastorałem i wrakiem albo alejką od Kapucyńskiej. Kostki i ławki kryją tylko w przysiadzie.
- Głośna: z alejek placu na załogę `east_lot` jest 15–25 m otwartej posadzki; furgonetka to jedyna wysoka osłona.
- Ucieczka: na wschód deptakiem do Koi, na zachód przez plac do metra A (74; 16,9), na południe Kapucyńską (terytorium Hebi `kapucynska-alley` przy (153,1; −132), więc ucieczka w ich stronę jest ryzykowna).
- Pułapki: zasadzka wariantu stoi na stronie placu, czyli tam, dokąd gracz ucieka od deptaka.

### Pora i stan świata
- Noc: zimna lampa przy wraku i ciepła Shiro to dwa jedyne światła skraju; cel z wariantem `night_only` jest tylko nocą. Dzień: plac pełen ludzi, fontanna, festiwal (wzmianka w `enc_targ_idol`).
- Przed zleceniem: wrak i furgonetka stoją puste. Po zleceniu: ciała zostają do streamingu, Hebi tracą w dzielnicy `shinsekai-7` urazę za każdego zabitego (ADR-0091), co odczuje grupa przy myjni i przy Kapucyńskiej.
- Po akcie I: retrospekcja wraku zamyka pytanie, jak Seki trafiła na deptak.

### Wymagania wobec sceny
- Wrak czytelny jako wrak z tamtej nocy: auto na dachu, pasy, szkło, zgięty słup, ślady z jezdni Kapucyńskiej. Od 23.11 jest (`rd-lit-*`, `plac-litewski-detail.ts`).
- Źródło dźwięku przy wraku (kapanie, cichy syk) i fontanna jako emiter. Od 23.11 jest.
- Skraj placu ciemniejszy i brudniejszy niż reszta, z drobiazgiem przy furgonetce. Drobiazg jest, ciemniejszego skraju nie ma (dług).
- Światło wyróżniające wrak jako cel (§13), np. lampa ze zgiętego słupa świecąca krzywo na auto. Latarnia wisi krzywo i świeci, ale tylko jako emisja (dług: światło silnika).

## Dług sceny
Zrobione 23.11 (gałąź `feat/scena-plac-litewski`, zrzuty przed i po nocą i w dzień z pierwszego kadru, przy wraku i przy furgonetce):
- wrak jako auto gry na dachu z pasami, wybitymi szybami, otwartymi drzwiami, wnętrzem i podwoziem (`rd-lit-wreck`, `tools/blender/rooms/plac_litewski.py`); bryła 1,9 × 1,25 × 4,5 m zostaje w `district-m0.ts` jako `scenery`;
- zgięty pastorał w miejscu tego z OSM i szczątki drona (`rd-lit-bent-lamp`, `rd-lit-drone`), bryły stopy słupa i otwartych drzwi na końcu `DISTRICT_M0_PROPS` (T-077);
- skupiska drobiazgu przy wraku, przy furgonetce i pod lampą Shiro, ślady opon z Kapucyńskiej, taśma, olej (`packages/sim/src/content/plac-litewski-detail.ts`);
- dźwięk: kapanie wycieku, syk i para chłodnicy, szum suchych fontann (`packages/engine/src/audio/room-sound-map.ts`, `room-scape.ts`, `STEAM_VENTS`);
- nazwa „Tetsuo” zniknęła z komentarza furgonetki;
- 60-30-10 zmierzone (§13); koszt: wywołania rysowania w kadrze 143 → 141, przy wraku 180 → 178, przy furgonetce 208 → 209 (para), trójkąty +1,4 tys. do +15 tys.

Zostaje:
- Światło silnika z latarni zgiętego pastorału na auto (§13): dziś świeci tylko emisja szyb latarni. Potrzebny punkt światła bez modelu lampy gry (`PointLightDef` przy modelu `room-detail` albo nowy rodzaj lampy), czyli zmiana kontraktu widoku (`packages/core/src/ports`) albo światło sceny w `packages/engine/src/renderer` (ADR).
- Próg między placem a jego wschodnim skrajem (§12, §16): ciemniejsza i brudniejsza nawierzchnia przy furgonetce i wraku (nakładka ADR-0077 albo plamy z generatora ADR-0096 w `tools/osm-import`).
- Furgonetka: zaklejone szyby i uchylone tylne drzwi (skórka `van` jest blokiem z kitu, model z Blendera albo `vehicle-props`).
- Pomniki (G-128) i fontanna (G-129): `packages/engine` i `tools/osm-import` według zgłoszeń.
- 60-30-10 pierwszego kadru poza pasmem (baza 81,5%, światło 15,1%): deptak przed wrakiem potrzebuje światła ze źródła (witryny parteru, latarnie), osobno od sceny.
- Lampa Shiro (100; −21) stoi 1,3 m w kamienicy w67498725 (G-502, osobna poprawka): wiersze leżą przed nią na bruku, (97,9; −22).
