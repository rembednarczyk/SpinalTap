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
<!-- inwentarz-gry:end -->
