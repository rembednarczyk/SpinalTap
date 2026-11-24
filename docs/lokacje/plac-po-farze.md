# Plac po Farze (`plac-po-farze`)

Plac po Farze na Starym Mieście (x ≈ 645..700, z ≈ 20..65), na skarpie nad Podzamczem, z zarysem fundamentów fary św. Michała (OSM w173519315, środek (672,8; 43,2)). Od zachodu zamyka go gmach Warsztatów Kultury (r3119721, (641,3; 21,4)), od północy kryta kładka nad Grodzką (ok. (659; 76), karta `grodzka-kladka`), od wschodu taras widokowy i schody Zaułka Panasa w dół ku Podwalu (karta `zaulek-panasa`). Dzielnica `kanal`, chunk `stare-miasto-1-1`. Stan gry na `22b1808`.

## Historia
Na tym miejscu stała fara, czyli kościół parafialny św. Michała, najstarsza świątynia miasta w murach. Według legendy ufundował ją Leszek Czarny po zwycięstwie nad Jaćwingami: we śnie, pod dębem, ukazał mu się archanioł Michał. Kościół podupadł i w połowie XIX wieku został rozebrany. Pusty plac dostał nazwę od tego, czego na nim nie ma: zarys murów pokazują niskie fundamenty, a brązowy model fary stoi przy tarasie, z którego widać Zamek i Podzamcze.

W 2077 plac jest przystankiem między Rynkiem a Bramą Grodzką i balkonem Starego Miasta. Kilkanaście metrów na północ, pod kładką, handlują Hebi (`grodzka-bridge`, zlecenie `kanal_bridge`), a ich rekrut Koji ćwiczy groźby na przechodniach u wylotu placu (`enc_kanal_recruit`). Przed chwilą ktoś zostawił na murku fundamentów puszkę i kartkę z rysunkiem kościoła, który stał tu dwa wieki temu.

## Klimat
- Światło: 4 latarnie pastorałowe (dwie z OSM przy Archidiakońskiej (653,9; 39,3) i (653,5; 46,6), T-141; dwie z planu przy (674,4; 62,3) i (686; 35,8)), 4 latarenki ścienne na fasadach (m.in. (645,7; 33,9), (691,4; 26,7)), ciepła lampa gry pod kładką (652; 70, #ffcf8a) tuż za północnym skrajem. Neony lokali Warsztatów Kultury: GOŚCINIEC MONARCHÓW i PERŁOWE BĄBELKI (#ffb000). Taras ku wschodowi jest ciemny: w dole świecą Podzamcze i oświetlony Zamek.
- Dźwięk: wiatr na skarpie, gwar ogródka, kroki po żwirze, głosy spod kładki. Źródeł w grze brak.
- Zapach: mokry żwir, kawa i bubble tea z Warsztatów, dym papierosów spod kładki.
- Kontrast: ruina kościoła jako pusty zarys obok holo-rekonstrukcji, którą miasto puszcza za opłatą; puste miejsce po świątyni służy Hebi za poczekalnię.
- Ruch: tłum Starego Miasta (`stare-miasto-1-1`, profil `street` 0,8), Koji wieczorem, klienci kładki.

## Przeznaczenie
- Przejście między Grodzką a Podwalem (schody Zaułka Panasa) i między Rynkiem a Bramą Grodzką; punkt widokowy na Zamek przed drogą aktu III.
- Spotkanie `kanal_recruit` (652; 64) przy północno-zachodnim skraju placu, 16:00–23:00. Miejsce przestępstwa w toku `kanal` (623; 32) przy Grodzkiej i Ku Farze, 50 m na zachód (`MICRO_SPOTS`).
- Wejścia: Grodzka od północnego zachodu, Archidiakońska od zachodu, Ku Farze od południowego zachodu, schody Zaułka Panasa od wschodu.
- Osłony: tylko niskie: murki fundamentów 0,5 m (T-251), ogródek kawiarni, kilka drzew. Plac jest odsłonięty z kładki.
- Punkt widokowy: taras przy modelu fary (683,5; 27,2) na wschód.

## Topografia
- Prawdziwe miejsce: Plac po Farze, fundamenty fary w173519315, model fary (artwork z OSM), Koziołek Lesław (680; 61,7). Teren z NMT ok. 190,0–194,3 m n.p.m. (y −5,8..−1,5), opada ku wschodowi i skarpie.
- Zgodne: obrys placu, położenie fundamentów i modelu, Warsztaty Kultury z OSM.
- Odstępstwa: fundamenty jako bariery 0,5 m bez murowanych lic i żwiru (T-015, G-053 częściowo naprawione, T-251); ruiny `building=ruins` w okolicy pominięte (T-015); dwie latarnie OSM jako fabryczne `lamp-road` (T-141).

## Inwentarz docelowy
Architektura:
- zarys fundamentów z kamienia i cegły z wnęką prezbiterium, żwir w nawie, płyty dróg (do zrobienia: generator barier ADR-0077 z licem i nawierzchnią `gravel`);
- murki oporowe tarasu z balustradą, schody w dół ku Podwalu (mapa, `steps` OSM);
- elewacja Warsztatów Kultury (mapa).
Duże obiekty:
- brązowy model fary na postumencie i holo-rekonstrukcja kościoła nad fundamentami (model gry `artwork`; holo do zrobienia: Blender `tools/blender/rooms/plac_po_farze.py`);
- ławki przy tarasie, kosz, stojak na rowery, ogródek kawiarni (model gry, meble uliczne);
- luneta widokowa na tarasie z płatnym ekranem AR (Blender, ten sam plik).
Drobiazg w skupiskach:
- na murku fundamentów: puszki, niedopałki, kartka z rysunkiem (Blender, `plac_po_farze.py`);
- przy ogródku: kubki bubble tea, słomki, serwetki (generator ADR-0096 `litter`);
- przy wylocie ku kładce: tag Hebi na murze, ulotki (model gry `graffiti`, naklejki).

## Frakcja i zasady
Frakcja: ulica.
- §12 zgodne: wąska, kręta Grodzka otwiera się na plac i dalej na taras z widokiem na całe Podzamcze; schody Zaułka Panasa są ciasnym progiem w dół. To prawdziwa sekwencja Starego Miasta.
- §13 częściowo: wszystkie światła mają oprawy, ciepła lampa pod kładką ma źródło. Nawigacja: zejście schodami ku Podwalu nie ma światła drogi, a taras jest ciemny. 60-30-10 niemierzone (zrzut nocny z Grodzkiej na wschód).
- §14 dług: makro i mezo z mebli (1 ławka, 1 kosz, ogródek, 4 drzewa), mikro 2 rzeczy `clutter`; przy murku i tarasie zero drobiazgu.
- §15 częściowo: mokry bruk Grodzkiej; żwiru i lic fundamentów brak (G-053), więc połowa placu ma jedną nawierzchnię.
- §16 częściowo: plac ulicy bez śladu ulicy; to miejsce, gdzie Hebi czekają na klientów kładki, a nie widać po nich nic.
- §17 dług: wiatru na skarpie i ogródka nie słychać, emiterów brak. Ruch: tłum i Koji wieczorem; skala: ławka, latarnie, drzwi Warsztatów.

## Scenariusz tła
- Kto tu bywa: spacerowicze między Rynkiem a Bramą Grodzką; turyści na tarasie widokowym przy modelu fary; goście ogródka kawiarni; Hebi spod kładki na Grodzkiej i ich rekrut Koji, który po południu ćwiczy groźby na przechodniach (`enc_kanal_recruit`).
- Co się dzieje: w dzień ludzie przysiadają na murkach fundamentów i fotografują Zamek i Podzamcze; po południu u wylotu placu Koji zaczepia przechodniów, a ci przyspieszają ku schodom Zaułka Panasa; nocą plac jest pusty i ciemny między latarniami Grodzkiej.
- Ślad obecności: puszka i kartka z rysunkiem fary na murku fundamentów, filiżanki na stolikach ogródka, niedopałki przy barierce tarasu.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/po-farze-detail.ts`, `tools/blender/rooms/plac_po_farze.py`, test `packages/sim/test/po-farze-scene.test.ts`): luneta widokowa z ekranem AR na wschodniej, otwartej części placu i dwie ławki przy niej (bryły w puli ulicy). Zostaje:
- Fundamenty fary z licem i żwirem w nawie (G-053): generator barier `packages/engine/src/renderer/mapcity` (bariery ADR-0077) i nawierzchnia w `tools/osm-import`, przegląd `topography-curator`.
- Holo-fara nad fundamentami: model w `tools/blender/rooms/plac_po_farze.py` (z emisją w ramach §16), rekwizyt w `packages/sim/src/content/po-farze-detail.ts`.
- Skupiska drobiazgu na murku, przy ogródku i u wylotu ku kładce: `po-farze-detail.ts` jak wyżej.
- Ławki wzdłuż krawędzi tarasu ze skarpy (dziś jedna z planu mebli i dwie przy lunecie): plan mebli `tools/osm-import` (gałąź `po-farze.*`).
- Światło drogi przy górnym biegu schodów Zaułka Panasa: zrobione 24.11 jako światło sceny bez bytu (`PO_FARZE_LAMPS` w `po-farze-detail.ts`: żarówka `rd-targ-bulb-pole` przy (694,6; 47,4) i turkusowy akcent ekranu lunety).
- Emiter wiatru na tarasie i gwaru ogródka: `packages/engine/src/audio/spatial.ts`.
- Pomiar 60-30-10 nocą (24.11, `tools/shots/plaza-spots.json`): z zachodu na plac 87/12,8/0,2 przed i 86,9/12,9/0,2 po świetle sceny; z tarasu na schody 84,1/15,3/0,6 przed i 83/16,4/0,5 po. Dalej poza pasmem: plac nie ma akcentu w kadrze. Następny krok to holo-fara nad fundamentami (model z emisją w `plac_po_farze.py`, §16) jako akcent widoczny z Grodzkiej i z tarasu.
