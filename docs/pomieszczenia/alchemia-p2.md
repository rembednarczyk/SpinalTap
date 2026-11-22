# Magazyn aut P-2 Alchemii (`alchemia-p2`)

Dolny poziom parkingu pod P-1: zautomatyzowany magazyn aut na paletach, korytarz serwisowy do portalu na T2 (ADR-0074 etap 5a).

## Historia
P-2 to magazyn bez ludzi: palety z autami ustawione na jednym poziomie, roboty na szynach przesuwają je do kabin P-1. Technik serwisu schodzi tu raz na tydzień. Ostatnio zostawił na posadzce skrzynkę z narzędziami i rozpięty kombinezon na haku przy szafie sterowniczej, bo robot numer trzy znów stanął.

## Klimat
Półmrok, pomarańczowe koguty robotów, zielone diody szyn. Strop nisko, 2,3 m. Szum wentylacji i stukot robotów, zapach smaru.

## Przeznaczenie
Miejsce skradania i zadania w Alchemii (przejście do schronu, kryjówka Hebi). Wejście schodami z P-1 i korytarzem z portalu na T2.

## Inwentarz docelowy
Magazyn rysuje silnik Alchemii i scenografia (`alchemia/p2-store.ts`):
- dwa rzędy palet z autami (model gry `sedan`);
- słupy i belki regałów, szyny w posadzce pasa;
- pomarańczowe koguty;
- dwa roboty jeżdżące po pasie;
- sterownia z konsolą i oknem na przejście serwisowe.

Z Blendera (`tools/blender/rooms/alchemia_p2.py`, plik `room-detail-alchemia-props.glb`), tylko rysunek:
- rzeczy technika przy drzwiach sterowni: kombinezon na haku, czerwona skrzynka z kluczami i podniesionym wiekiem, kanister smaru, ścierki (`rd-p2-tech`);
- szafa sterownicza w sterowni z ekranem planu magazynu, rzędem lampek (czerwona: robot numer trzy), stacyjkami i grzybkiem bezpieczeństwa (`rd-p2-cabinet`);
- rura tryskaczy z głowicami i rura spustowa pod stropem wzdłuż ściany wschodniej (`rd-p2-pipes`);
- trzy oprawy w kratkach nad przejściem serwisowym (`rd-p2-lamp`);
- plamy oleju na pasie robotów (`rd-p2-oil`).

Odłożone: siatki zabezpieczające na regałach.

## Frakcja i zasady
Frakcja: technika (zautomatyzowany magazyn aut).
- §12 dług: 0 z 8 wymiarów na siatce. Strop 2,3–2,5 m zgodny z §6. Korytarz do portalu to tunel: wydzielić jako osobne wnętrze (polecenie 22.11).
- §13 częściowo: lampy z Blendera (3) i koguty robotów. Dług: drzwi do klatki i portal bez barwy nawigacji.
- §14 dług: bryły symulacji puste (makro 0, mikro 0 w pomiarach); szyny, roboty i regały rysuje silnik (`p2-store.ts`). Dodać drobiazg w skupiskach przy szafie technika i przy stanowisku serwisowym.
- §15 dług: plama oleju jest w detalu; połysk szyn i mokry beton pod wyciekiem.
- §16 zgodne: zimna zieleń diod, sprzęt dominuje.
- §17 do sprawdzenia: stukot robotów ze źródła (ruch jest).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-p2-cabinet × 1
- blender: rd-p2-lamp × 3
- blender: rd-p2-oil × 1
- blender: rd-p2-pipes × 1
- blender: rd-p2-tech × 1

Pomiary zasad (§12–§16):
- rzut: 4 prostokąty, 957 m², wysokość 2,3 / 2,5 m
- siatka 0,5 m: 0 z 8 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 0
- warstwy wyposażenia: makro 0, mezo 7, mikro 0
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 3
<!-- inwentarz-gry:end -->
