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

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-p2-cabinet × 1
- blender: rd-p2-lamp × 3
- blender: rd-p2-oil × 1
- blender: rd-p2-pipes × 1
- blender: rd-p2-tech × 1
<!-- inwentarz-gry:end -->
