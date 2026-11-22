# Piwnica W-3 z przepustem (`w3-basement`)

Piwnica pod halą W-3 i kanał przepustu pod tarasem (ADR-0082 etap 2).

## Historia
Piwnica została po przedwojennej garbarni, na której fundamentach stoi zakład. Tessen zamurował jej część i zostawił tylko pompownię i przepust do rzeki, którym kiedyś odpływały ścieki garbarni. Przepust zarósł osadem; technicy schodzą tu raz w miesiącu wymienić filtr. Szmuglerzy znają go lepiej niż Tessen: na ścianie wisi ich znak kredą, a w niszy stoi skrzynka z latarką i zapasową baterią.

## Klimat
Wilgoć, ceglane sklepienia przemieszane z betonem, jedna żarówka w kratce i czerwone światło awaryjne. Woda po kostki w przepuście, echo kropli, zapach mułu.

## Przeznaczenie
Droga ukryta do hali i ucieczka nad rzekę. Ciasno, nisko, bez autozapisu.

## Inwentarz docelowy
Bryła i duże obiekty z symulacji (`tessen-w3/basement.ts`): piwnica 31 × 12,4 m i 4,1 m wysoka, dwa słupy, cztery szafki szatni z kryjówkami, ławka, schody A i B, szyb windy z drabiną, przepust: wylot w skarpie, kanał 37 m długi i 1,5 m wysoki, zejście do piwnicy. Szafki i ławkę rysuje scenografia hali W-3.

Z Blendera (`tools/blender/rooms/w3_basement.py`), tylko rysunek, bez nowych brył, więc identyfikatory hali i jej drzwi zostają:
- dwie rury pod stropem wzdłuż południowej ściany na obejmach, kołnierze, zacieki rdzy (`rd-w3b-pipes`);
- zespół pompowy w narożniku: silnik i korpus pompy na cokole, osłona sprzęgła, ssanie do kratki studzienki, obudowa filtra z przykręconą pokrywą, pion tłoczny do rur pod stropem z zasuwą i manometrem, zawieszka serwisowa (`rd-w3b-pump`);
- skrzynka elektryczna z ostrzeżeniem, rurki kabli do stropu, oprawa awaryjna z czerwonym kloszem (`rd-w3b-panel`);
- dwie żarówki w koszyczkach z drutu (`rd-w3b-bulb`);
- poręcze z rury na schodach A i B (`rd-w3b-handrail-a`, `rd-w3b-handrail-b`);
- cegła garbarni w miejscach, gdzie odpadł tynk, na ścianie południowej i wschodniej (`rd-w3b-brick-wide`, `rd-w3b-brick-tall`);
- krata przepustu odchylona na skrzydło wylotu, zawiasy od czoła, skobel z otwartą kłódką (`rd-w3b-grate`);
- skrytka szmuglerów w kanale: skrzynka z odsuniętym wiekiem, latarka, zapasowy akumulator, znak kredą na ścianie (`rd-w3b-stash`);
- woda po kostki w kanale, ławice mułu przy ścianach, puszki, butelka i worek w mule (`rd-w3b-water`).

Na telefonie (niska jakość) gra pomija drobiazg (`fine` w `ROOM_DETAIL_SHAPES`): żarówki, cegłę, kratę, skrytkę, wodę z mułem, rury i poręcze; zostają pompa i skrzynka (budżet trójkątów hali W-3 w `npr-perf`).

## Frakcja i zasady
Frakcja: korporacja (Tessen, zaniedbana); druga: ulica (przepust).
- §12 zgodne: 5 z 6 wymiarów na siatce; niski przepust (1,5 m) przed piwnicą.
- §13 zgodne (światło): lampy W-3 w silniku (`w3-lights.ts`) przy oprawach z karty: biała pod świetlówkami stropu (słabsza), ciepłe plamy dwóch żarówek w koszyczkach (`rd-w3b-bulb`) i czerwień klosza oprawy awaryjnej nad skrzynką elektryczną (`rd-w3b-panel`). 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): przed zmianą baza 73,9%, światło 26,1%, akcenty 0%; po niej baza 65,7%, światło 30,4%, akcenty 4%, zgodne.
- §14 zgodne: 8 rzeczy drobiazgu (skrytka przemytników, śmieci w mule), 25% luzem; rury, poręcze i łaty cegieł to instalacje (§12), nie drobiazg.
- §15 zgodne: woda w przepuście, mokre ściany.
- §16 zgodne.
- §17 do sprawdzenia: kapanie i pompa ze źródła. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): pompa i buczenie skrzynki elektrycznej, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-w3b-brick-tall × 1
- blender: rd-w3b-brick-wide × 1
- blender: rd-w3b-bulb × 2
- blender: rd-w3b-grate × 1
- blender: rd-w3b-handrail-a × 1
- blender: rd-w3b-handrail-b × 1
- blender: rd-w3b-panel × 1
- blender: rd-w3b-pipes × 1
- blender: rd-w3b-pump × 1
- blender: rd-w3b-stash × 1
- blender: rd-w3b-water × 1
- prop: blok (concrete), rysunek osobno × 7
- prop: blok (concrete, pochyły) × 3
- prop: blok (metal) × 3
- prop: blok (metal), rysunek osobno × 4

Pomiary zasad (§12–§16):
- rzut: 3 prostokąty, 490 m², wysokość 4,1 / 1,5 / 4,4 m
- siatka 0,5 m: 5 z 6 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 17
- warstwy wyposażenia: makro 3, mezo 5, mikro 6
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 6 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
