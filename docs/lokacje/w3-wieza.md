# Wieża przepustek W-3 z zewnątrz (`w3-wieza`)

Wieża kontrolna zakładu W-3 na północno-zachodnim narożniku hali, nad nabrzeżem i zakolem Bystrzycy (ADR-0082, P10): x 2486–2496, z 436–446, podest na +10, kabina z czerwonego szkła na +24…+28, dach +28,6, maszty do +34. Ta karta opisuje bryłę z zewnątrz, schody, podest, most na dach rzędu N i kabinę. Biuro przepustek na parterze to wnętrze `tessen-office` z własną kartą (`docs/pomieszczenia/tessen-office.md`).

## Historia
W Lublinie na tym miejscu rośnie łęg przy brzegu Bystrzycy, a koryto skręca tu na północny wschód (audyt W-3). Wieży nie ma.

W grze wieżę postawiono w 2051 roku razem z miejskim zakładem odzysku wody. Parter był biurem przepustek dla kierowców cystern, a kabina sterownią ujęcia i rurociągu nad rzeką (karta `tessen-office`). Tessen przejął zakład i zostawił wieży dawną rolę: z kabiny widać nabrzeże, pomost, plac odbioru i dach rzędu N, a na podeście stoją reflektory i stanowiska strzelców. Kabinę oszklono na czerwono jak na grafice 01 użytkownika (ADR-0082, `docs/world/koncepty/tessen-w3/`), a na zachodniej ścianie wymalowano wielkie „W-3” do czytania z rzeki. Według ADR-0082 Tessen wywodzi swoje drony od lubelskiej wytwórni lotniczej Plage i Laśkiewicz z lat 20. i 30.: zakład ma mieć ceglany cokół w ścianie śluz i tablicę (w grze ich nie ma).

Przed chwilą (cel sceny, §5): obserwator w kabinie przetarł zaparowaną szybę od środka i zostawił na niej smugę, a na podeście ktoś postawił kubek na skrzynce reflektora.

## Klimat
- **Światło:** czerwona kabina na +24 (pasma podświetlonego szkła za ciemnymi słupkami, `w3-dress.ts`), dwa reflektory na podeście nad nabrzeżem i pomostem, czerwono-niebieski neon TESSEN nad bramą obok, zimne monitory biura za drzwiami. W nocy kabina jest najjaśniejszym punktem nad doliną i znakiem strefy, ale też alarmem (§4: czerwone to zagrożenie).
- **Dźwięk:** wiatr na podeście, para z rurociągu przy podeście, szum zakładu, metalowe stopnie schodów pod butami.
- **Zapach:** zimna stal, mgła znad rzeki.
- **Kontrast (§3):** kabina z czerwonego szkła nad betonowym biurem z paprotką i listą dyżurów pisaną ręcznie.
- **Ruch i życie:** obserwator rozgląda się z okresem 16 s (w czasie sabotażu), para z zaworów, reflektory.

## Przeznaczenie
- **Zlecenie `infiltrate` Genzō:** manifesty ładunków z terminalu na biurku biura przepustek (dane w (2487,2; +0,9; 441)). Drzwi biura we wschodniej ścianie (z 442–444) na kod z haka, panel (2496,21; +1,3; 444,6). Alarm któregokolwiek strażnika to porażka `detected` (ADR-0024).
- **Hak trasy patroli:** udana infiltracja przed sabotażem pokazuje trasy P1–P3 na mapie na czas kontraktu (ADR-0082 §1).
- **Droga cicha Q2** sabotażu prowadzi przez podest: z rurociągu od zachodu, mostem na dach rzędu N od wschodu.
- **Stanowiska strzelców:** podest w narożnikach SW (2486,9; +10; 436,9) i NE (2495; +10; 444,9) (`SNIPER_PERCHES`).
- **Wejścia:** stalowe schody na południowej ścianie (pierwszy bieg x 2486,5–2494,5, z 434,2–436 na zachód do spocznika +5 x 2484,5–2486,5, drugi z 432,2–434 na wschód do spocznika +10 x 2494,5–2496,5), rurociąg od zachodu na +10, most z dachu rzędu N (x 2496–2500, z 437,6–439,7, +10 → +10,4), drzwi biura od wschodu.
- **Osłony:** spoczniki schodów, attyka podestu (od strony brzegu i rzeki 1,9 m), skrzynki reflektorów, automat z napojami przy wschodniej ścianie (2496,5; 440).
- **Punkt widokowy:** z podestu na zachód zakole Bystrzycy i most Lutosławskiego, na wschód plac odbioru i dach N.

## Topografia
- Prawdziwe miejsce: łęg w230881219 przy brzegu, krawędź wody OSM (2472,5; 433,8) → (2499,3; 462,9), róg wieży 0,5 m od wody w pierwotnym prostokącie ADR.
- W grze: wieża x 2486–2496, z 436–446 zamiast z 438–448 z pierwszej wersji ADR (korekta P10, żeby róg NW nie stał w wodzie), płot strefy przy jej północnej ścianie, skośny brzeg między wieżą a basenem jako skarpa z płotem (P11).
- Odstępstwa celowe: T-002 (strefa W-3 i jej budynki), T-310 (rurociąg do podestu wieży).

## Inwentarz docelowy
- **Architektura:** żelbetowy trzon z biurem na parterze (jest), podest +10 z attyką i barierkami (jest), schody stalowe na południowej ścianie (są), szyb i kabina z czerwonym szkłem (są), dach z masztami (są), most na dach N (jest). Do dodania: drabina serwisowa na maszty, korytka kablowe po ścianie od kabiny do biura, krata wentylacji biura.
- **Duże obiekty:** reflektory na podeście (są, rysunek), kamera nabrzeża na narożniku SW (`dev:doki-quay-cam`, jest), automat z napojami (`dev:doki-vending`, jest), skrzynki rozdzielcze na spocznikach, tablica z napisem „W-3” (jest, malowana), światła przeszkodowe na masztach (czerwone, migające).
- **Drobiazg w skupiskach (§14):**
  - podest: kubek na skrzynce reflektora, niedopałki w puszce, łuski pod stanowiskiem SW;
  - stopa schodów: kartka z dyżurami przyklejona taśmą, rozdeptana ulotka bezpieczeństwa;
  - drzwi biura: kartka z kodem (hak `hook_infiltrate_1`), kosz z kubkami.
  Źródło: Street Asset Pack (ADR-0096), modele z `tools/blender/`.

## Frakcja i zasady
Frakcja: korporacja (Tessen).
- §12 zgodne: schody 1,8 m wzdłuż ściany i spocznik +5 to ciasna droga, po której podest otwiera się na dolinę. Most na dach N (2,1 m) to próg do otwartego dachu. Wymiary wieży na siatce 0,5 m (x 2486–2496, z 436–446, poziomy +4, +10, +24, +28).
- §13 częściowo: kabina (akcent) i reflektory (światło) mają oprawy. Brak pomiaru 60-30-10. Drzwi biura nie są w barwie nawigacji (dług z karty `tessen-office`), stopa schodów nie ma światła.
- §14 dług: na zewnątrz wieży stoją tylko kamera i automat. Brak drobiazgu na podeście i spocznikach.
- §15 częściowo: szkło kabiny daje połysk. Dług: mokra stal schodów i podestu w deszczu.
- §16 zgodne: monumentalna, czysta wieża korporacji z czerwonym okiem nad zakładem.
- §17 częściowo: szum zakładu i para mają źródła (`w3-sound-map.ts`, `w3-fx.ts`). Dług: wiatr i stopnie. Skalę dają drzwi biura 2,1 m i barierki 1,05–1,9 m. Ruch: obserwator tylko w czasie sabotażu, światła przeszkodowe nie migają.

## Scenariusz

### Pierwszy kadr
Seki podchodzi od placu odbioru wzdłuż ściany rzędu N i widzi wieżę z dołu: czarny trzon z białym „W-3” na zachodniej ścianie, schody zygzakiem po południowej ścianie na podest z reflektorami, a wysoko czerwoną kabinę na tle nieba. Po prawej, przy wschodniej ścianie, świeci automat z napojami, a obok niego są drzwi biura z panelem kodu. Wzrok przyciąga kabina (akcent i zagrożenie) i dopiero potem drzwi (dług: nawigacja).

### Postacie i miejsca
- **Posterunki infiltracji** (`tessen_office`): strażnik w biurze (2488,6; 438,4), twarzą na południe; strażnik drzwi w przerwie przy hali (2497,8; 445,4); dwaj na nabrzeżu (2492; 428) i (2482; 428,5); jeden na placu odbioru (2506; 446). Pierwszy posterunek to szef zmiany, egzekutor przebrań (ADR-0033).
- **Obserwator** (tylko sabotaż, `tessen_sniper` z wzrokiem 40 m, przed alarmem bez strzału): (2494,3; +24; 441) przy wschodnich szybach kabiny, obrót 1,0 rad (na wschód, ku placowi odbioru i dachowi N), rozgląda się z okresem 16 s i nie schodzi z kabiny.
- **Strzelcy** (zlecenia z alarmem): stanowiska na podeście SW i NE.

### Przebieg
1. **Infiltracja** (trening drogi cichej): hak kodu z terminalu przy ścianie hali (2498,8; 438) i hak przerwy strażnika drzwi („co pół godziny wychodzi zapalić”, `hook_infiltrate_2`, okno `rotation_gap` w `contract-hooks.ts`). Podejście nisko, za plecami posterunków, kod, drzwi.
2. **Biuro:** dane z biurka, jedno wejście, szef zmiany w środku (karta `tessen-office`).
3. **Wyjście:** tą samą drogą albo schodami na podest i rurociągiem na zachodni brzeg.
4. **Sabotaż Q2:** z rurociągu na podest, pod czerwoną kabiną. Obserwator patrzy na wschód, więc podest za jego plecami jest bezpieczny, a most na dach N i dach do x ≈ 2545 leżą w jego polu.
5. **Alarm drogi głośnej:** według ADR-0082 obserwator przechodzi na chodnik toru suwnicy +12 w hali jako snajper. W grze zostaje w kabinie.

### Drogi
- **Cicha:** od nabrzeża pod kamerą (patrzy na zachód nad pomost), wzdłuż wschodniej ściany do drzwi biura. Albo od góry: rurociąg, podest, schody w dół.
- **Głośna:** schody to wąski korytarz ognia z podestu. Strzelec na SW widzi nabrzeże i pomost.
- **Ucieczka:** rurociąg na zachodni brzeg (drabina, bez pościgu AI), most na dach N, schody na plac odbioru.
- **Pułapki:** biuro ma jedno wejście. Kabina widzi most na dach N i dach do x ≈ 2545.

### Pora i stan świata
- Posterunki infiltracji i strzelcy są tylko ze zleceniem. Obserwator tylko w czasie sabotażu. Bez zlecenia wieża stoi pusta, z pracownikiem tłumu przy schodach.
- W nocy kabina i reflektory, w dzień ciemna bryła z białym „W-3”.
- Po udanej infiltracji fixerzy +3, Tessen −1. Po porażce Tessen −5 („znają twarz”, ADR-0024). Pasmo doków 16–30.

### Wymagania wobec sceny
- Drzwi biura w barwie nawigacji i oświetlone, panel kodu czytelny.
- Światła przeszkodowe na masztach (ruch, akcent).
- Linia wzroku obserwatora zgodna z tabelą ADR-0082 §2 (test w etapie 2).
- Decyzja, czy obserwator po alarmie schodzi do hali na tor suwnicy, i spójny z nią opis w ADR.
- Tablica Plage i Laśkiewicz przy wieży albo na cokole śluz.

## Dług sceny
Zrobione 23.11 (`packages/sim/src/content/tessen-w3/outside-dress.ts`): kąt palaczy przy drzwiach biura (wiadro z piaskiem, woda, kask). Zostaje:
- Światło nawigacji nad drzwiami biura i przy stopie schodów: oprawy w `packages/engine/src/renderer/tessen-w3/w3-dress.ts`, światło w `w3-lights.ts` (tryb wnętrza) albo `w3-fx.ts` (na zewnątrz).
- Światła przeszkodowe na masztach (+32,4 i +34), migające: rysunek w `w3-dress.ts`, miganie z zegara renderera jak animacja linii (`w3-line-anim.ts`).
- Skupiska na podeście, spocznikach i przy drzwiach biura: nowy plik `packages/sim/src/content/tessen-w3/tower-dress.ts` (rysunek bez bryły poza skrzynkami na spocznikach), rysunek w `w3-dress.ts`.
- Mokra stal schodów i podestu w deszczu (§15): kanał `wet` dla stali w `packages/engine/src/renderer/tessen-w3/w3-kit.ts`.
- Obserwator po alarmie: ADR-0082 §1 „Droga głośna” p. 4 przenosi go na tor suwnicy +12 jako snajpera, a `observerEntity` w `packages/sim/src/world/quiet-way-templates.ts` trzyma go w kabinie (`keepsFloor`). Albo dopisać przejście w `sim`, albo poprawić ADR.
- Tablica i ceglany cokół Plage i Laśkiewicz (ADR-0082 „Zaczepienie w Lublinie”): bryła cokołu w `packages/sim/src/content/tessen-w3/hall.ts` (nowa na końcu), tablica w `w3-dress.ts` (napis to nazwa własna w teksturze).
- Hak `hook_infiltrate_1` w `packages/narrative/ink/{pl,en}/hooks.ink`: „Kod do bocznych drzwi od strony dźwigu” (dźwigu nie ma od etapu 1; drzwi są od wschodu, od strony hali). Hak `hook_infiltrate_2`: strażnik „wychodzi zapalić za magazyn” (magazynu nie ma; jest przerwa przy hali).
- ADR-0082 §2 pisze o klatce schodowej w środku wieży, a gra ma stalowe schody na południowej ścianie (`W3_TOWER_STAIR`). Opis w ADR do poprawy (dokumentacja, architekt).
- Pomiar §13: ujęcie nocne z placu odbioru na wieżę w `tools/shots/room-spots.json`.
