# Tunel z P-2 na T2 (`alchemia-p2-tunnel`)

Korytarz serwisowy poziomu P-2 Alchemii, od magazynu aut na północ do portalu w wykopie pod T2: 6 m szerokości, około 40 m długości, strop na wysokości magazynu (ADR-0074 etap 5a). Osobne wnętrze od 22.11 (`docs/zasady-lokacji.md` §12).

## Historia
Tunel wykuto dla ciężarówek serwisu robotów i dla straży pożarnej. Ciężarówki przestały przyjeżdżać, gdy magazyn przeszedł na zdalny nadzór; od tej pory tunelem chodzą technicy, kurierzy na skróty i ludzie Hebi do schronu. W połowie drogi stalowa brama do schronu ma świeży ślad łomu, a przy szybie windy ktoś zostawił niedopałki.

## Klimat
Długa, niska rura z betonu, oprawy w kratkach co kilka metrów, jedna miga. Na końcu jasny prostokąt portalu: neony T2 i deszcz. Przeciąg od wykopu, echo kroków, kapanie z dylatacji.

## Przeznaczenie
Ciasny odcinek (§12: ciasno, potem otwarcie) między magazynem a wykopem T2 i droga do schronu (brama w ścianie wschodniej). Skradanie i ucieczka: dwa wyjścia, do magazynu i do portalu; trzecie przez bramę schronu. Mało osłon: walka tutaj jest dla gracza ryzykowna.

## Inwentarz docelowy
Tunel rysuje silnik Alchemii (`alchemia/p2.ts`): ściany, strop, posadzka, portal, brama schronu, wnęka szybu windy przy magazynie.

Do zrobienia (kolejka zasad, §12–§17):
- architektura: rury i korytko kablowe pod stropem przez całą długość, kratki odpływu w posadzce, odbojnice przy ścianach (Blender);
- duże obiekty: wózek serwisowy przy szybie windy, szafka hydrantowa, skrzynka rozdzielcza (Blender);
- drobiazg w skupiskach: niedopałki i puszka przy szybie windy, ślad łomu i gruz przy bramie schronu, liście i śmieci nawiane przy portalu (Blender);
- światło: oprawy w kratkach jako bryły rysunku, jedna migająca; zielony znak wyjścia nad portalem i nad bramą schronu (kontrast funkcjonalny).

## Frakcja i zasady
Frakcja: technika (infrastruktura parkingu); druga: ulica (skrót Hebi).
- §12 zgodne co do kontrastu: ciasny tunel między magazynem a otwartym wykopem T2. Dług: instalacje pod stropem; wymiary na siatce w pomiarach.
- §13 dług: tunel nie ma własnych lamp silnika poza światłem P-2; oprawy i zielone znaki wyjścia do dodania. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 79,9%, światło 19,7%, akcenty 0,4%, poza pasmem: baza 79,9% > 75%; akcenty 0,4% < 3%.
- §14 częściowo: generator wnętrz (ADR-0099, zestaw `service-corridor`) stawia gaśnicę przy portalu, szafkę hydrantową i skrzynkę rozdzielczą z kablem na ścianie zachodniej, trzy kratki odpływu rozłożone wzdłuż ścian (co najmniej 8 m), karton z butelkami i kubkiem; 7 rzeczy drobiazgu, 1 luzem. Dług: wózek serwisowy, instalacje pod stropem.
- §15 częściowo: kałuża przy portalu, gdzie wpada deszcz z wykopu (`rd-c-puddle`, generator: `by: "weather"`). Dług: połysk rur.
- §16 zgodne: beton i stal techniki, prowizorka ulicy przy bramie schronu.
- §17 dług: przeciąg i kapanie ze źródła (portal, dylatacja); ruch: migająca oprawa.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-bottles × 1
- blender: rd-c-cable × 1
- blender: rd-c-cartons × 1
- blender: rd-c-cups × 1
- blender: rd-c-drain × 3
- blender: rd-c-extinguisher × 1
- blender: rd-c-fusebox × 1
- blender: rd-c-hydrant × 1
- blender: rd-c-puddle × 1
- blender: rd-w3h-exit × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 241 m², wysokość 2,3 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 4
- warstwy wyposażenia: makro 0, mezo 6, mikro 7
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 6 rzeczy w nich, 1 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
