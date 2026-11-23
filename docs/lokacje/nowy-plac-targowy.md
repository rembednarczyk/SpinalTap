# Nowy Plac Targowy przy Ruskiej (`nowy-plac-targowy`)

Ulica i plac Nowy Plac Targowy na Podzamczu, między halami Bazaru a Targiem na Ruskiej, x ≈ 640..840, z ≈ 420..580: od Bazaru (stragany do z ≈ 437) przez zabudowę z Targową, Ciasną i Nadstawną po Targ na Ruskiej (OSM w182461192, środek (787; 561), 131 straganów x 736..833, z 529..575). Na Nowym Placu Targowym stoi grupa Hebi terytorium `ruska-market` (rdzeń (690; 460), 3 członków, ADR-0091). Na ścianach kamienic przy Ciasnej instalacja „Getto – drut kolczasty” (672,4; 513). Dzielnica `targ`, chunki `podzamcze-0-1` i `podzamcze-1-1`. Stan gry na `22b1808`.

## Historia
Podzamcze przez stulecia było miastem żydowskim pod Zamkiem, a targi przy Ruskiej i na Nowym Placu Targowym to jego handlowe zaplecze. Ruska wzięła nazwę od prawosławnych Rusinów i ich cerkwi Przemienienia Pańskiego (karta `cerkiew-przemienienia`). W czasie okupacji Niemcy zamknęli tu getto; zlikwidowali je wiosną 1942 roku, a jego mieszkańców wywieźli do obozu zagłady w Bełżcu. Granicę getta przypomina dziś drut kolczasty na ścianach kamienic. Po wojnie przy Ruskiej i na Nowym Placu Targowym zostały targowiska: stragany pod daszkami, budy, lombardy, sklepy mięsne.

W 2077 Targ na Ruskiej jest nocnym targiem Podzamcza: ramen, części, wszczepy z odzysku i girlandy nad rzędami (plan ulic `ruska.targ-na-ruskiej`). Hebi nie stoją na samym targu, tylko na Nowym Placu Targowym, przy bukmacherze i sklepie mięsnym, w drodze między halami a Ruską, i stąd zbierają haracz od straganów. Przed chwilą ktoś wyszedł od bukmachera STS z kuponem w zębach i zostawił drzwi uchylone.

## Klimat
- Światło: 24 latarnie drogowe na Ruskiej, Targowej, Ciasnej i Nowym Placu Targowym (m.in. (672,8; 461,1), (696,2; 475,4), (708,5; 490,6)), 3 parkowe. Neony sklepów: zielone spożywcze (MIĘSNY RAJ, ZIELONY RÓG 24H, SKLEPIK NA ROGU, CHLEBOWA SKÓRKA, KOKTAJL TRUNKOWY #39ff8a), czerwone (TYP NA MECZ, KEBAB ZNAD BOSFORU, KAMBUZ #ff4040), cyjanowe (WSZYSTKO ZA GROSZ, PROTEZY I KULE #00e5ff), różowe (FRYZJER OSOBISTY, TRAFIONY CIUCH). Żadnego światła gry; targ na Ruskiej nocą nie ma lamp nad straganami.
- Dźwięk: w zamyśle nawoływania, skwierczenie wózków z jedzeniem, rolety, radio z budy. W grze tylko auta na Ruskiej i Lubartowskiej.
- Zapach: smażone mięso, ocet i marynaty, ryby, mokre kartony.
- Kontrast: protezy i kule w witrynie obok budki ze wszczepami na raty; drut kolczasty pamięci nad kolejką do kebabu.
- Ruch: 59 postaci z mebli przy straganach, 3 Hebi; tłumu nie ma w żadnym z dwóch chunków.

## Przeznaczenie
- Teren Hebi (`ruska-market`) i targ tła. Droga z Bazaru i Dworca na Ruską i ku cerkwi.
- Miejsca przestępstw w toku (786; 438) przy Nadstawnej i (792; 540) przy Ruskiej (`MICRO_SPOTS`); haracz przy straganie (ADR-0091 §3) ma tu naturalne miejsce.
- Wejścia: Nowy Plac Targowy od Lubartowskiej i od Dworca, Ruska, Targowa, Ciasna, Szkolna (deptak), Nadstawna.
- Osłony: 131 straganów na Ruskiej, 3 wózki z jedzeniem (T-089), zapas przy straganach (T-106), drzewa; na samym Nowym Placu Targowym przy grupie Hebi tylko fasady i auta.
- Punkt widokowy: brak.

## Topografia
- Prawdziwe miejsce: ulica Nowy Plac Targowy (w40050943), Targ na Ruskiej w182461192, Ruska, Targowa, Ciasna. Teren z NMT ok. 174,0–189,1 m n.p.m. (y −21,8..−6,7), wznosi się ku północy.
- Zgodne: stragany w rzędach w obrysie targu (T-026, poprawione #76), wózki z jedzeniem (T-089), zapas przy straganach (T-106, celowe), instalacja getta i mural „Jest Super” jako punkty OSM.
- Odstępstwa: jezdnia Ruskiej węższa przy targu (T-249, G-565), pasy przeciwne Ruska/Podzamcze nachodzą na siebie (G-751); goły teren przy fasadach w komórce `podzamcze-2-1` (T-275) i przy parkingu Bazaru (T-172); daszki targu `building=roof` pominięte (G-063).

## Inwentarz docelowy
Architektura:
- daszki nad rzędami straganów Ruskiej na słupach, z rynnami i kablami (G-063);
- kamienice z witrynami i drzwiami na parterze, rolety (mapa, drzwi fasad T-109);
- drut kolczasty instalacji pamięci na ścianach w73833875 i w1306000299 (model do zrobienia, Blender `tools/blender/rooms/nowy_plac_targowy.py`, bez warstwy 2077).
Duże obiekty:
- stragany z ladami, wagi, lodówki, wózki z jedzeniem (model gry `market-stall`, `market-goods`, `food-cart`);
- girlandy żarówek nad rzędami nocnego targu (Blender, `nowy_plac_targowy.py`);
- skrzynie, beczki, płótna zapasu (generator ADR-0096 `boxes`, T-106).
Drobiazg w skupiskach:
- przy wózkach z jedzeniem: pałeczki, kubki, serwetki, kości (generator `litter`);
- przy grupie Hebi pod bukmacherem: kupony, puszki, niedopałki, tag Hebi (model gry `graffiti`);
- przy straganach z częściami: śrubki, kable, baterie (Blender).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: ciasne rzędy straganów pod daszkami otwierają się na Ruską i plac przed cerkwią; Ciasna i Targowa są wąskimi przejściami. Dług: bez daszków (G-063) rzędy nie mają niskiego stropu.
- §13 dług: tylko latarnie drogowe; nocny targ bez girland i lamp nad ladami, a 10% akcentów to wyłącznie neony sklepów. Grupa Hebi bez czerwonego akcentu. 60-30-10 niemierzone (zrzut nocny z Nowego Placu Targowego na wschód).
- §14 częściowo: makro i mezo z mebli (131 straganów, 25 `market-goods`, 3 wózki), mikro 22 naklejki, 11 graffiti, 4 rzeczy `clutter`; skupisk przy wózkach i grupie Hebi brak. Gęstość targu odpowiada biedzie (§2), drobiazgu za mało.
- §15 częściowo: mokry asfalt; brak folii, plandek i mokrej posadzki pod straganami z rybami.
- §16 zgodne: prowizorka, beton, folia, neony sklepików.
- §17 dług: targ bez żadnego dźwięku ze źródła. Ruch: postacie z mebli i 3 Hebi bez tłumu; skala: stragany, drzwi, wózki.

## Dług sceny
- Girlandy i lampy nad ladami Targu na Ruskiej (ciepłe światło handlu) i daszki nad rzędami: lampy gry w nowym `packages/sim/src/content/district-targ.ts`, daszki w `tools/osm-import` (G-063), girlandy w nowym `tools/blender/rooms/nowy_plac_targowy.py`.
- Tłum na targu i na Nowym Placu Targowym (chunki `podzamcze-0-1` i `podzamcze-1-1` bez tłumu): `packages/sim/src/content/crowd.ts` (profil `market`).
- Skupiska drobiazgu przy wózkach, straganach i grupie Hebi: nowy `packages/sim/src/content/nowy-plac-targowy-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES`.
- Emitery gwaru, wózków i radia z budy: `packages/engine/src/audio/spatial.ts`.
- Sprzeczność ADR i gry: ADR-0091 §1 stawia terytoria „bez miejsc pamięci (ślad getta …)”, a rdzeń `ruska-market` (690; 460) leży 56 m od instalacji „Getto – drut kolczasty” (672,4; 513). `REMEMBRANCE_PLACES` (`packages/sim/src/content/remembrance.ts`) nie zna tej instalacji, więc żaden test tego nie pilnuje. Propozycja: dopisać instalację do `REMEMBRANCE_PLACES` z odstępem jak dla przestępstw (100 m) i przesunąć rdzeń na skraj Targu na Ruskiej, ok. (760; 525), po sprawdzeniu wolnego pierścienia 1,5 m i odstępu od cerkwi, w `packages/sim/src/content/territory-groups.ts` (przegląd `topography-curator`); przy okazji grupa trafi tam, gdzie zbiera haracz.
- Nazwa terytorium (`ruska-market`, „Nowy Plac Targowy by Ruska”) i rdzeń (690; 460) mówią o dwóch różnych miejscach oddalonych o ok. 85 m; przesunięcie z punktu wyżej rozwiązuje oba.
- Drut kolczasty jako model na ścianach w miejscu z OSM (bez neonów i reklam w promieniu 20 m, jak przy Stolpersteinach T-334): `tools/blender/rooms/nowy_plac_targowy.py` i rekwizyt w `nowy-plac-targowy-detail.ts`.
