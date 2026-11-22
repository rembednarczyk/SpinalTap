# Klinika doktora Moriego (`clinic`)

Parter kamienicy przy Krakowskim Przedmieściu, północna pierzeja deptaku (ADR-0038, ADR-0045). Jedno pomieszczenie za szklanymi drzwiami, z oknem na deptak.

## Historia
W latach dwudziestych była tu apteka „Pod Złotym Moździerzem”, potem bank, potem lombard. Mori wynajął lokal w 2069 za długi poprzedniego najemcy i do dziś nie zdjął z zaplecza sejfu lombardu. Oficjalnie to gabinet „medycyny estetycznej”. W praktyce wszczepia i wyjmuje to, czego nie wolno sprzedawać, a płaci mu się gotówką albo przysługą. Fotel zabiegowy kupił z likwidacji szpitala na Jaczewskiego, lampę operacyjną z demobilu wojskowego. Ostatni pacjent wyszedł kwadrans temu: na tacy leży jeszcze zakrwawiona gaza.

## Klimat
Zimne, sine światło lampy operacyjnej nad fotelem, ciepła żarówka nad biurkiem Moriego, czerwona dioda autoklawu. Kafle sprzed stu lat, popękane, z łatami z blachy. Pachnie środkiem dezynfekującym i papierosami. Technika za fortunę stoi obok plastikowego wiadra.

## Przeznaczenie
Miejsce zadań i usług: wszczepy, leczenie, rozmowy z Morim. Gracz wchodzi z deptaku, rozmawia przy biurku, siada na fotelu. Jedno wejście od ulicy i zaplecze za kotarą (droga ucieczki w zadaniach).

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/clinic.py`, 22.11) albo do zrobienia.

Architektura:
- kafle ścienne do 1,6 m z łatami, sufit z rurami i korytem kablowym (do zrobienia);
- kotara na szynie do zaplecza, okno na deptak z żaluzją (do zrobienia).

Duże obiekty:
- fotel zabiegowy na hydraulicznej kolumnie, oparcie uniesione pod kątem, podnóżek, podłokietniki z pasami, pedał (zrobione: `rd-clinic-chair`);
- lampa operacyjna z sufitu, dwie głowice po sześć soczewek (zrobione: `rd-clinic-lamp`);
- wózek narzędziowy z trzema szufladami i tacą (zrobione: `rd-clinic-cart`);
- lada recepcji z perforowanym frontem, monitorem na ramieniu i czytnikiem kart (zrobione: `rd-clinic-reception`);
- ławka w poczekalni z czterech siedzisk, jedno pęknięte (zrobione: `rd-clinic-bench`);
- szafa lekowa ze szklanymi drzwiami, autoklaw z czerwoną diodą (zrobione: `rd-clinic-cabinet`);
- sejf lombardu, biurko Moriego z dwoma monitorami (do zrobienia: wymaga brył symulacji);
- pojemnik na odpady medyczne (zrobione: `rd-clinic-sharps`).

Drobiazg:
- taca z narzędziami i zakrwawioną gazą, rękawiczki, strzykawka (zrobione: `rd-clinic-cart`);
- karty pacjentów, zimna kawa, popielniczka pełna niedopałków, długopis na ladzie (zrobione: `rd-clinic-counter-things`);
- ramki monitorów „PULS 48”, plakat anatomiczny, kable z taśmą (do zrobienia).

## Frakcja i zasady
Frakcja: technika (ripperdoc); druga: ulica (kafle, wiadro).
- §12 dług: 0 z 2 wymiarów na siatce (obrys z kamienicy, §1). Instalacje na wierzchu do dodania pod stropem.
- §13 zgodne co do źródeł (lampa operacyjna, żarówka, dioda), 6 widocznych. Dług: fotel i terminal Moriego jako cel rozmowy mocniej wyróżnione. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 87,8%, światło 10,8%, akcenty 1,4%, poza pasmem: baza 87,8% > 75%; światło 10,8% < 18%; akcenty 1,4% < 3%.
- §14 dług: mikro 0. Skupiska: narzędzia przy fotelu, papiery i popielniczka na biurku.
- §15 dług: kafle i stal z połyskiem, kałuża przy umywalce.
- §16 zgodne: zimne światło techniki na brudnej ulicy.
- §17 do sprawdzenia: buczenie autoklawu.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-clinic-bench × 1
- blender: rd-clinic-cabinet × 1
- blender: rd-clinic-cart × 1
- blender: rd-clinic-chair × 1
- blender: rd-clinic-counter-things × 1
- blender: rd-clinic-lamp × 1
- blender: rd-clinic-reception × 1
- blender: rd-clinic-sharps × 1
- prop: blok (concrete) × 3
- prop: blok (concrete), rysunek osobno × 1
- prop: blok (glass), rysunek osobno × 2
- prop: blok (metal) × 1
- prop: blok (metal), rysunek osobno × 6
- prop: neon × 3
- prop: neon, rysunek osobno × 2

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 62 m², wysokość 3,9 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 3
- warstwy wyposażenia: makro 6, mezo 17, mikro 0
- drobiazg w skupiskach (≥ 3 w 1,2 m): 0 skupisk, 0 rzeczy w nich, 0 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 6
<!-- inwentarz-gry:end -->
