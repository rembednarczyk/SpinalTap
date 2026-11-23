# Plac Litewski: wrak przy południowej bramie i furgonetka na parkingu (`plac-litewski`)

Plac Litewski (x −100..135, z −55..70) i wylot deptaka przy Kapucyńskiej. Dwa miejsca zleceń Kaito: wrak, z którego wyciągnięto Seki (`south_gate`, wrak (152,6; −51)), i furgonetka na wschodnim skraju placu (`east_lot`, (112; −42)). Pod placem stacja metra Plac Litewski z wejściem A (74; 16,9). Stan gry na `1de4702`.

## Historia
Plac wziął nazwę od obozu szlachty litewskiej, która stanęła tu w czasie sejmu 1569 roku, kiedy w Lublinie zawarto unię Polski z Litwą. W XIX wieku powstał tu reprezentacyjny plac z Pomnikiem Unii Lubelskiej (żeliwny obelisk z 1826 roku), potem doszły Pomnik Konstytucji 3 Maja, Grób Nieznanego Żołnierza i konny pomnik Piłsudskiego. W 2017 plac przebudowano: granitowa posadzka, ławy na łukach rabat i fontanna multimedialna z pokazami w letnie wieczory.

W 2077 plac jest wizytówką miasta i jego granicą: za dnia festiwale i reklamy na fasadzie Poczty, nocą wschodni skraj przy deptaku przejmuje półświatek. W kodzie miejsce wraku nosi stare id `south_gate`, po „południowej bramie” dawnej dzielnicy Shinsekai; w Lublinie bramy tu nie ma, został wrak. Noc wypadku: Seki jechała cudzym autem z przeciętą opaską Kagami na fotelu, dron strzelał w opony, auto weszło w słup i skończyło na dachu przy wylocie Kapucyńskiej (`recall_crash_night`, `recall_last_call`: „Wisisz w pasach głową w dół”). Ratownicy wyciągnęli ją wczoraj w nocy, Ume patrzyła. Wraku nikt nie odholował: Hebi traktują go jak punkt spotkań, a obok, na skraju placu, od tygodni stoi furgonetka bez właściciela (w kodzie „Tetsuo”, postać bez roli w ink). Przed chwilą ktoś wyjął z wraku radio i zostawił otwarte drzwi.

## Klimat
- Światło: ciepła lampa Shiro (100; −21, #ffcf8a) na zachodzie, zimna niebieska przy wraku (160; −48, #9ad7ff), pastorał (155,1; −50,9) tuż przy wraku, grafitowe słupy z płaskimi oprawami nad placem, fontanna i iluminacja pomników daleko w głębi. Wschodni skraj jest ciemniejszy od reszty placu.
- Dźwięk: deszcz na granicie, szum fontanny (dziś bez źródła w grze), gwar deptaka za plecami. Neonów deptaka stąd już nie słychać (najbliższy 140 m).
- Zapach: mokry granit, płyn chłodniczy i spalona guma od wraku.
- Kontrast: wypielęgnowany plac z holo-flagami miasta obok wraku z drutami na wierzchu i furgonetki z zaklejonymi szybami.
- Ruch: tłum na alejkach, Shiro czytający wiersze wieczorem, ludzie wychodzący z metra.

## Przeznaczenie
- Dwa miejsca likwidacji Kaito (pula `ELIMINATION_SITE_IDS`, także krok `echo_contract` aktu I) i miejsce pamięci wątku: wrak jest kotwicą retrospekcji „wrak”.
- Wejścia: deptak od wschodu (x 135), Kapucyńska od południa przy wraku, aleje placu z zachodu i północy, metro A (74; 16,9) otwarte na wschód.
- Osłony: furgonetka 2,4 × 2,2 × 5 m, wrak 2 × 1,4 × 4,4 m, 39 granitowych kostek, 32 ławki, 24 drzewa, słupy ogłoszeniowe. Plac jest szeroki i płaski, więc osłony są niskie.
- Punkty widokowe: brak wysokich; z alejek placu widać oba miejsca zleceń naraz (50 m między nimi).

## Topografia
- Prawdziwe miejsce: Plac Litewski (OSM, rewitalizacja 2017), wylot Kapucyńskiej na Krakowskie Przedmieście. Teren z NMT ok. 196,3–196,5 m n.p.m. (y 0,5..0,7), płaski.
- Zgodne: obrys placu, fontanna multimedialna w miejscu z OSM (niecka i 16 dysz, T-076), pomniki Piłsudskiego i 3 Maja w miejscach z OSM (T-075), ławki i kostki z OSM.
- Odstępstwa: wrak i furgonetka na nawierzchni pieszej (T-077, celowe, scena gry; skan `vehicle-on-pavement` ma je na liście celowych); pomniki jako ta sama stojąca postać, Piłsudski bez konia (G-128); fontanna bez strumieni, czaszy i pokazu (G-129); wzór bruku przesuwa się na szwie chunków przy x ≈ 20 (G-041).

## Inwentarz docelowy
Architektura:
- posadzka z granitu z liniami odwodnienia, rabaty z obrzeżem (mapa, nakładka ADR-0077);
- pomniki Unii, 3 Maja, Piłsudskiego (model gry `monument`, do poprawy G-128), fontanna (G-129);
- pawilon metra Plac Litewski (`metro.ts`).
Duże obiekty:
- wrak na dachu: zgnieciony dach, wybite szyby, przecięte pasy zwisające do środka, otwarte drzwi kierowcy (dziś blok ze skórką `wreck` stojący na kołach; do zrobienia: Blender `tools/blender/rooms/plac_litewski.py`);
- zgięty słup pastorału (155,1; −50,9) i szczątki drona przy nim („Dron uderza w słup razem z tobą”; do zrobienia: Blender);
- furgonetka z zaklejonymi szybami i uchylonymi tylnymi drzwiami (skórka `van`);
- ławy, kostki, drzewa, słupy, kosze (model gry, meble uliczne).
Drobiazg w skupiskach:
- przy wraku: odłamki szkła, kawałek pasa, ślady opon od jezdni Kapucyńskiej, zapalone znicze i kartka od kogoś z ulicy (Blender, `plac_litewski.py`);
- przy furgonetce: kubki, niedopałki, karton po jedzeniu, plandeka (generator ADR-0096 `litter`, `boxes`);
- pod lampą Shiro: kartki z wierszami, plastikowy kubek (Blender).

## Frakcja i zasady
Frakcja: ulica, korporacja (plac miejski Lublina 2077).
- §12 zgodne: deptak (ok. 21 m) otwiera się przy x ≈ 135 na plac szeroki na ponad 200 m; wylot Kapucyńskiej jest ciasnym progiem. Dług: brak progu między placem a jego wschodnim skrajem (półświatek) w świetle albo nawierzchni.
- §13 częściowo: dwie lampy gry ze źródłem, słupy placu z mebli. Nawigacja: wrak nie ma żadnego wyróżnienia, a jest celem zlecenia i miejscem pamięci; nocą 60-30-10 niemierzone (zrzut nocny od deptaka na zachód, `pnpm shots:palette`).
- §14 częściowo: makro i mezo z mebli (39 kostek, 32 ławki, 27 słupków), mikro tylko 9 naklejek i 2 rzeczy `clutter` w 60 m; przy wraku i furgonetce zero drobiazgu.
- §15 częściowo: mokry granit z odbiciami lamp; brak szkła i rozlanych płynów przy wraku.
- §16 częściowo: plac ma porządek miasta (korporacja) i powinien mieć brud na skraju (ulica); dziś skraj wygląda jak reszta placu.
- §17 dług: fontanna bez dźwięku, wrak bez dźwięku (syk chłodnicy z `recall_last_call`, kapanie), żadnego emitera na placu. Ruch: tłum i Shiro wieczorem; skala: ławki, latarnie, pomniki.

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
- Wrak czytelny jako wrak z tamtej nocy: auto na dachu, pasy, szkło, zgięty słup, ślady z jezdni Kapucyńskiej. Dziś: blok `wreck` na kołach.
- Źródło dźwięku przy wraku (kapanie, cichy syk) i fontanna jako emiter.
- Skraj placu ciemniejszy i brudniejszy niż reszta, z drobiazgiem przy furgonetce.
- Światło wyróżniające wrak jako cel (§13), np. lampa ze zgiętego słupa świecąca krzywo na auto.

## Dług sceny
- Wrak jako auto na dachu z pasami, wybitymi szybami i otwartymi drzwiami: model w `tools/blender/rooms/plac_litewski.py` (albo nowa skórka pojazdu), rekwizyt w `packages/sim/src/content/district-m0.ts` (blok wraku zostaje bryłą, rysunek `scenery`).
- Zgięty pastorał (155,1; −50,9) i szczątki drona przy wraku: plan mebli `tools/osm-import` (wyjątek dla latarni) albo rekwizyt w `district-m0.ts`.
- Skupiska drobiazgu przy wraku (szkło, znicze, kartka) i przy furgonetce (kubki, karton, plandeka): `packages/sim/src/content/district-m0.ts` lub nowy `packages/sim/src/content/plac-litewski-detail.ts`, modele w `tools/blender/rooms/plac_litewski.py`.
- Emiter kapania i syku przy wraku oraz szum fontanny: `packages/engine/src/audio/spatial.ts` (lista emiterów spoza `DISTRICT_M0_PROPS`).
- Sprzeczność ink i gry: `recall_crash_night` mówi „mokra obwodnica… Jedź prosto do wiaduktu”, a wrak leży na deptaku przy Placu Litewskim (T-077, `lublin-names.md` trzyma wiadukt na obwodnicy). Propozycja: ślady opon z Kapucyńskiej do wraku w scenie i jedno zdanie w `packages/narrative/ink/{pl,en}/m3-echo.ink`, które łączy obwodnicę z deptakiem (decyzja narracji).
- Nazwa „Tetsuo” furgonetki w komentarzu `district-m0.ts` myli się z Tetsu z DENKI: zmienić albo opisać w ink.
- Pomniki (G-128) i fontanna (G-129): `packages/engine` i `tools/osm-import` według zgłoszeń.
- Zmierzyć 60-30-10 nocą od deptaka i wpisać w §13 tej karty.
