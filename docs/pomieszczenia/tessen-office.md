# Biuro przepustek Tessen w W-3 (`tessen-office`)

Parter wieży kontrolnej zakładu W-3 na Nabrzeżu (ADR-0082 etap 1). Małe biuro z oknem na bramę.

## Historia
Wieżę postawiono w 2051 razem z zakładem odzysku wody W-3. Parter od początku służył jako biuro przepustek: tu strażnik Tessenu wydaje karty dostępu kierowcom cystern i sprawdza ich twarze w bazie. System jest nowoczesny, ale meble zostały po poprzedniej firmie ochroniarskiej. Na ścianie wisi zdjęcie z otwarcia zakładu i lista dyżurów pisana ręcznie, bo terminal często się wiesza.

## Klimat
Zimne światło świetlówek, błękit monitorów z podglądem kamer, czerwona lampka przy drzwiach. Korporacyjna czystość tylko na pokaz: w koszu stos kubków po kawie, na parapecie zwiędła paprotka. Słychać szum pomp zza ściany.

## Przeznaczenie
Miejsce infiltracji (zadanie z kodem do drzwi): terminal przepustek, szafka z kartami, podgląd kamer. Jedno wejście od strony bramy i schody na platformę.

## Inwentarz docelowy
Stan: zrobione (Blender, `tools/blender/rooms/tessen_office.py`, 22.11) albo do zrobienia.

Architektura:
- lada z szybą i okienkiem do podawania kart (do zrobienia: wymaga bryły symulacji);
- sufit podwieszany ze świetlówkami (zrobione: `rd-tessen-lights`, dwie oprawy);
- listwy kablowe po ścianach (do zrobienia).

Duże obiekty:
- biurko strażnika na dwóch kontenerkach z szufladami, trzy monitory podglądu kamer na belce, klawiatura terminala, drukarka kart (zrobione: `rd-tessen-desk`);
- trzy szafy na akta po cztery szuflady i szafka na karty dostępu z zamkiem szyfrowym i czerwoną diodą (zrobione: `rd-tessen-cabinet`);
- ławka dla kierowców przy drzwiach (zrobione: `rd-tessen-bench`);
- fotel biurowy na kółkach, niszczarka (do zrobienia).

Drobiazg:
- kubki po kawie w koszu i na biurku, kanapka w folii, karty dostępu na blacie (zrobione: `rd-tessen-desk`, `rd-tessen-bench`);
- paprotka w doniczce (zrobione: `rd-tessen-bench`);
- tablica korkowa z grafikiem dyżurów pisanym ręcznie, zdjęcie z otwarcia zakładu, karteczki na pinezkach (zrobione: `rd-tessen-board`).

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-tessen-bench × 1
- blender: rd-tessen-board × 1
- blender: rd-tessen-cabinet × 1
- blender: rd-tessen-desk × 1
- blender: rd-tessen-lights × 1
- prop: blok (metal), rysunek osobno × 3
<!-- inwentarz-gry:end -->
