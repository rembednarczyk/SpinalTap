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
- drobiazg w skupiskach (od 22.11, `tools/blender/rooms/alchemia_p2.py`): niedopałki, zgnieciona puszka, zapalniczka i podarta paczka papierosów przy zachodniej ścianie u wylotu do magazynu (`rd-p2t-butts`); odpryski betonu i farby, grudka tynku, rękawica i jasne rysy łomu na ościeżnicy bramy schronu (`rd-p2t-gate`); liście, rozmokła gazeta, kubek po zupce i butelka nawiane przy portalu (`rd-p2t-litter`);
- światło: oprawy w kratkach jako bryły rysunku, jedna migająca; zielony znak wyjścia nad portalem i nad bramą schronu (kontrast funkcjonalny).

## Frakcja i zasady
Frakcja: technika (infrastruktura parkingu); druga: ulica (skrót Hebi).
- §12 zgodne co do kontrastu: ciasny tunel między magazynem a otwartym wykopem T2. Dług: instalacje pod stropem; wymiary na siatce w pomiarach.
- §13 dług: tunel nie ma własnych lamp silnika poza światłem P-2; oprawy i zielone znaki wyjścia do dodania. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 79,9%, światło 19,7%, akcenty 0,4%, poza pasmem: baza 79,9% > 75%; akcenty 0,4% < 3%.
- §14 częściowo: 11 rzeczy drobiazgu w trzech skupiskach (u wylotu do magazynu, pod bramą schronu, przy portalu), nic luzem. Dług: duże obiekty (wózek serwisowy, szafka hydrantowa, skrzynka rozdzielcza) i instalacje pod stropem.
- §15 dług: mokra posadzka przy portalu (deszcz z wykopu), połysk rur.
- §16 zgodne: beton i stal techniki, prowizorka ulicy przy bramie schronu.
- §17 dług: przeciąg i kapanie ze źródła (portal, dylatacja); ruch: migająca oprawa.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-p2t-butts × 1
- blender: rd-p2t-gate × 1
- blender: rd-p2t-litter × 1

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 241 m², wysokość 2,3 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 0
- warstwy wyposażenia: makro 0, mezo 0, mikro 11
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 11 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 0
<!-- inwentarz-gry:end -->
