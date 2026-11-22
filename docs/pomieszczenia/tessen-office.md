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

## Frakcja i zasady
Frakcja: korporacja (Tessen); druga: technika (monitory kamer).
- §12 dług: 0 z 2 wymiarów na siatce. Korporacja: symetria biurek i lady przepustek do sprawdzenia.
- §13 częściowo: 1 widoczne źródło w bryłach; świetlówki i monitory powiązać z oprawami. Drzwi do hali wyróżnione czerwoną lampką: zgodne. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 97,9%, światło 2%, akcenty 0,1%, poza pasmem: baza 97,9% > 75%; światło 2% < 18%; akcenty 0,1% < 3%.
- §14 zgodne co do sterylności (korporacja, §16): 11 rzeczy drobiazgu, skupiska na biurku i na tablicy, 27% luzem (karton akt, kubki w koszu).
- §15 dług: czarne szkło i szczotkowana stal lady.
- §16 częściowo: zimne świetlówki zamiast ukrytego ciepłego światła korporacji; to biuro na zapleczu fabryki, więc tanie światło jest celowe. Zapisać jako odstępstwo.
- §17 do sprawdzenia: szum pomp zza ściany.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-tessen-bench × 1
- blender: rd-tessen-board × 1
- blender: rd-tessen-cabinet × 1
- blender: rd-tessen-desk × 1
- blender: rd-tessen-lights × 1
- prop: blok (metal), rysunek osobno × 3

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 88 m², wysokość 4,0 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 1
- warstwy wyposażenia: makro 2, mezo 1, mikro 11
- drobiazg w skupiskach (≥ 3 w 1,2 m): 2 skupisk, 8 rzeczy w nich, 3 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
