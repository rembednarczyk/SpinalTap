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
- §13 zgodne: tryb wnętrza z lampami przy oprawach (`room-lights.ts`, od 22.11): chłodna biel podwieszanych świetlówek, turkus ekranów terminalu przy biurku. Drzwi do hali wyróżnione czerwoną lampką. 60-30-10 na zrzucie z 22.11 (noc, ujęcie z `tools/shots/room-spots.json`): baza 58,7%, światło 37,6%, akcenty 3,7% (wcześniej 97,9 / 2 / 0,1).
- §14 zgodne co do sterylności (korporacja, §16): 11 rzeczy drobiazgu, skupiska na biurku i na tablicy, 27% luzem (karton akt, kubki w koszu). Generator wnętrz (ADR-0099, zestaw `office`) dokłada tylko gaśnicę przy drzwiach i skrzynkę rozdzielczą, bez drobiazgu.
- §15 dług: czarne szkło i szczotkowana stal lady.
- Partia 2 ADR-0099: fotel na kółkach odsunięty od biurka (`rd-k-office-chair`), niszczarka przy biurku (`rd-k-shredder`), segregatory na szafce (`rd-k-binders`). Na telefonie bez nich (drobny detal, budżet bloku W-3).
- §16 częściowo: zimne świetlówki zamiast ukrytego ciepłego światła korporacji; to biuro na zapleczu fabryki, więc tanie światło jest celowe. Zapisać jako odstępstwo.
- §17 do sprawdzenia: szum pomp zza ściany. Dźwięk ze źródła w grze od 22.11 (`room-sound-map.ts`, emitery w przedmiotach): świetlówki i buczenie szafy sterowniczej, w pełni w pomieszczeniu, cicho i głucho zza ściany.

## Scenariusz

### Pierwszy kadr
Seki podchodzi przerwą między wschodnią ścianą wieży a rzędem N hali (x 2496–2500), od strony placu odbioru albo od nabrzeża. Drzwi dwuskrzydłowe biura (2496; 443) są zamknięte, panel z kodem przy nich (2496,2; 1,3; 444,6), obok automat z napojami (`dev:doki-vending`, (2496,5; 440)). Po otwarciu widać pokój 9,4 × 9,4 m pod zimnymi świetlówkami: na wprost przy zachodniej ścianie biurko z trzema monitorami podglądu i terminalem, po prawej szafy na akta, po lewej ławka dla kierowców. Wzrok ma iść na biurko (dane), a łapie go turkus ekranów i czerwona lampka przy drzwiach.

### Postacie i miejsca
Zlecenie `infiltrate` Genzō (ADR-0024, ADR-0082 §1), 3–5 strażników Tessen (`W3_CONTRACT_POSTS.tessen_office`), w kolejności:
- strażnik biura (2488,6; 438,4) twarzą na południe, ku południowej ścianie 2 m przed nim, plecami do biurka (2487,2; 441);
- strażnik drzwi (2497,8; 445,4) w przerwie przy hali, twarzą na południe, wzdłuż przerwy;
- strażnik 4 m na południe od schodów wieży (2492; 428), twarzą na południe;
- strażnik nabrzeża (2482; 428,5) twarzą na zachód, ku pomostowi;
- strażnik placu odbioru (2506; 446) twarzą na wschód.
- Kamera biura (`dev:doki-office-cam`) w północno-zachodnim narożniku pod stropem (2486,6; 3; 445,4), patrzy w pokój ku drzwiom; strefa zakazana to całe biuro na czas infiltracji.
- Warianty (ADR-0034): dwóch ochroniarzy w środku (2490; 439), (2493; 438,2), czujka u stopy schodów wieży (2492; 432).
- Terminal z mailem haka `hook_infiltrate_1` stoi na zewnątrz w przerwie (2498,8; 438).

### Przebieg
1. Zlecenie u Genzō przy kontenerze KAIUN na pasie publicznym: „Manifesty ładunków, z terminala na biurku. Biuro przepustek na parterze ich wieży kontrolnej, drzwi od strony hali. Nikt nie może cię zobaczyć”.
2. Haki: mail na terminalu w przerwie daje kod 4177 („Kod jest zapisany na karteczce”), a bark strażnika przy schodach (`hook_infiltrate_2`) mówi, że strażnik drzwi co pół godziny wychodzi zapalić. W grze to przerwa w minutach 20–25 każdego półgodzinnego okresu.
3. Wejście: kod otwiera drzwi bez alarmu, a kamera bierze wtedy Seki za personel (ADR-0038). Bez kodu panel daje „Wyłam zamek”, co otwiera drzwi do końca zlecenia i podnosi alarm.
4. Zgranie danych z biurka (`W3_ITEM_SPOTS`, (2487,2; 0,9; 441)). Napięcie: stożek strażnika biura i kamera. Pełne podejrzenie któregokolwiek strażnika przed zgraniem to porażka `detected` (fixerzy −3, Tessen −5, telefon `phone_genzo_failed`: „Przez parę dni nie pokazuj się przy biurze”).
5. Powrót do Genzō: „Czyste dane i nikt nic nie widział”. Fixerzy +3, Tessen −1. Ta sama infiltracja jest treningiem drogi cichej sabotażu (ADR-0082).

### Drogi
- Cicha: od placu odbioru wzdłuż ściany rzędu N do przerwy, w minutach 20–25 albo za plecami strażnika drzwi, kod z haka, potem wzdłuż północnej ściany pod kamerą do biurka. Ze stożkiem z ADR-0024 (60° w każdą stronę, rozglądanie ±0,7 rad) strażnik biura nie widzi drogi od drzwi do biurka, więc pilnuje jej tylko kamera i jego zasięg 2,2 m.
- Głośna nie istnieje: każdy alarm przed zgraniem kończy zlecenie. Wyłamanie zamka to alarm.
- Ucieczka po wykryciu: drzwiami w przerwę i na plac odbioru albo schodami wieży na podest +10 i rurociągiem nad Bystrzycą (ADR-0021). Drugiego wyjścia z biura nie ma.
- Pułapka: czujka wariantu stoi u stopy schodów wieży, na drodze ucieczki na podest.

### Pora i stan świata
- Bez zlecenia biuro jest zamknięte, a drzwi otwierają się tylko personelowi Tessen (zamek `code`, `staff: "tessen"`). Wnętrze bez okien, więc w dzień i w nocy wygląda tak samo; na zewnątrz w nocy reflektory i mgła znad rzeki.
- Zlecenie jest dostępne o każdej porze. Po sabotażu głośnym Tessen jest wrogi (najwyżej −60) i Genzō ostrzega przed strzelcami na dachach. Brak terytoriów gangów w paśmie doków.

### Wymagania wobec sceny
- Biurko z danymi czytelne od drzwi: terminal w barwie technicznej, jaśniejszy niż monitory podglądu (§13).
- Martwy kąt kamery i strażnika biura, którędy prowadzi cicha droga, czytelny bez napisu (cień, regał, ślad butów).
- Druga droga z pokoju zadania (§9) albo świadomy wyjątek: infiltracja kończy się porażką przy wykryciu, więc ucieczka jest potrzebna tylko po porażce.
- Ślad „przed chwilą”: kubek po kawie i kanapka na biurku (są w `rd-tessen-desk`), krzesło odsunięte od biurka (jest w partii 2).

## Dług sceny
Zrobione 23.11: brak autozapisu w biurze jak w hali i piwnicy (`autosave: false`, test `packages/sim/test/w3-no-autosave.test.ts`); haki `hook_infiltrate_1` i `_2` poprawione w #955. Zostaje:
- Strażnik biura (2488,6; 438,4) z yaw π patrzy w ścianę 2 m przed sobą. Do sprawdzenia, czy to zamierzone. Propozycja: okno w południowej ścianie na nabrzeże i schody wieży (karta: „Małe biuro z oknem na bramę”) albo posterunek twarzą ku drzwiom w `packages/sim/src/content/tessen-w3/posts.ts` (zmiana testów skradania).
- Część „Przeznaczenie” tej karty mówi o schodach na platformę w biurze, a schody wieży biegną na zewnątrz, po południowej ścianie (`W3_TOWER_STAIR`). Poprawka karty.
- Terminal na biurku jako cel: światło ekranu w `packages/engine/src/renderer/rooms/room-lights.ts`, oprawa w `tools/blender/rooms/tessen_office.py`.

## Inwentarz gry

<!-- inwentarz-gry:start (generuje `pnpm rooms:write`, nie edytować ręcznie) -->
- blender: rd-c-extinguisher × 1
- blender: rd-c-fusebox × 1
- blender: rd-k-binders × 1
- blender: rd-k-office-chair × 1
- blender: rd-k-shredder × 1
- blender: rd-tessen-bench × 1
- blender: rd-tessen-board × 1
- blender: rd-tessen-cabinet × 1
- blender: rd-tessen-desk × 1
- blender: rd-tessen-lights × 1
- prop: blok (metal), rysunek osobno × 3

Pomiary zasad (§12–§16):
- rzut: 1 prostokąt, 88 m², wysokość 4,0 m
- siatka 0,5 m: 0 z 2 wymiarów
- architektura (ściany, płyty, stopnie, instalacje na wierzchu): 2
- warstwy wyposażenia: makro 2, mezo 4, mikro 17
- drobiazg w skupiskach (≥ 3 w 1,2 m): 3 skupisk, 14 rzeczy w nich, 3 luzem
- widoczne źródła światła (lampy, neony, ekrany, szyldy): 1
<!-- inwentarz-gry:end -->
