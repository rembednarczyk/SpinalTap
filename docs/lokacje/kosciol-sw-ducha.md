# Kościół Świętego Ducha (`kosciol-sw-ducha`)

Kościół pw. Świętego Ducha (OSM w66264126, Krakowskie Przedmieście 1, `heritage=2`) na północnej pierzei deptaku Krakowskiego Przedmieścia, tam gdzie deptak wychodzi na Plac Łokietka i gdzie zaczyna się Świętoduska, ulica nazwana od tego kościoła. Środek obrysu w grze (383,1; −78,5), teren y −0,5, okap 16,5, kalenica 20,4, smukła wieża w narożniku SW (371,6; −82,7) z gzymsem na 18,1 i barokowym hełmem z latarnią do 26,5 (`BELL_TOWERS` w `packages/engine/src/renderer/mapcity/landmarks/bell-towers.ts`). Brama Krakowska stoi 90 m na wschód. Stan gry na `22b1808`.

## Historia
Na początku XV wieku mieszczanie lubelscy ufundowali przed Bramą Krakowską, poza murami, kościół Świętego Ducha ze szpitalem dla ubogich i chorych. Kościół był wiele razy przebudowywany po pożarach i dostał barokowe wnętrze, ale zachował gotycką bryłę z wysokim dachem i jedną smukłą wieżą przy zachodnim narożniku. Stoi u wylotu Krakowskiego Przedmieścia, głównej ulicy miasta poza murami, a ulica Świętoduska biegnie od niego na północ, w stronę Lubartowskiej. Jest w rejestrze zabytków (w OSM `heritage=2`), a parafia ma kancelarię od strony Świętoduskiej (węzeł OSM „Kancelaria”, (374,4; −71,4)). Na sąsiednim gmachu przy Placu Łokietka wisi tablica „Pamięci Żydów z Lublina” (412,5; −85,3).

W 2077 roku deptak Shinsekai-7 świeci szyldami pachinko, ramenu i kantorów aż pod sam kościół, a ściana od Placu Łokietka sąsiaduje z Ratuszem i ekranami Bramy Krakowskiej. Kościół jest jedynym dużym budynkiem przy wylocie deptaku bez reklamy: parafia nie sprzedała ściany pod ekran, choć oferty przychodzą co roku. Wieczorem na ławkach przedpola siedzą ludzie z deptaku, a parafia wydaje z kancelarii od Świętoduskiej zupę dla tych, którzy śpią w bramach Bramowej i Krakowskiego. Zgodnie z ADR-0062 warstwa 2077 na zabytku ma być dodatkiem: światło, kamery i kable, nie nadbudowa. Dziś gra nie ma na kościele żadnej warstwy 2077 (dług).

Przed chwilą (cel sceny, §5, w grze brak): na stopniu bocznego wejścia ktoś postawił znicz w czerwonym szkle i zostawił obok papierowy kubek po zupie.

## Klimat
- **Światło:** w grze kościół nie świeci niczym własnym: ściany i okna z ogólnego stylu kościoła (jasny tynk, wysokie okna w jednym rzędzie, `facade-style.ts`), bez iluminacji. Przedpole oświetlają trzy latarnie pastorały (380,4; −91,6), (367,2; −99,4), (389,6; −101,2), a od deptaku szyldy kamienic (LEWANTYŃSKI RUSZT, OBRĄCZKI I SYGNETY na Świętoduskiej 1) i ekrany Placu Łokietka. Docelowo: ciepłe reflektory od dołu na wieży i fasadzie (jak cztery reflektory Bramy Krakowskiej), światło świec w oknach wieczorem, czerwony znicz przy wejściu, jedna zimna kamera nad wejściem.
- **Dźwięk (cel):** dzwon na wieży o pełnych godzinach, organy przez drzwi w porze mszy, gwar deptaku, kroki na kostce. W grze brak dźwięku ze źródła.
- **Zapach:** wosk i kadzidło przy wejściu, mokry kamień, grill z ruszt-baru za rogiem Świętoduskiej.
- **Pogoda:** deszcz na otwartym przedpolu; mokra kostka odbija latarnie (ADR-0084).
- **Kontrast (§3):** ciemna gotycka bryła bez jednego neonu między neonowym deptakiem a ekranami Ratusza i Bramy.
- **Ruch i życie:** ludzie na ławkach przedpola (5 miejsc tłumu, `CROWD_SPOTS`) i postacie przy ławkach (375,2; −91,5), (391,9; −92); przechodnie deptaku. Przy samym kościele nic się nie rusza.

## Przeznaczenie
- Punkt orientacyjny wylotu deptaku na Plac Łokietka: wieża z hełmem widoczna wzdłuż Krakowskiego Przedmieścia z zachodu i ze Świętoduskiej z północy. Miejsce tła na drodze z deptaku do Bramy Krakowskiej (karta `brama-krakowska`) i do Alchemii Świętoduską.
- **Wejścia:** dziś brak drzwi: ogólny styl kościoła nie rysuje drzwi, bo okna zajmują całą ścianę (`door-slots.ts`), a OSM nie ma węzła wejścia. Docelowo portal główny od deptaku i boczne wejście od Świętoduskiej. Wnętrza w grze nie ma (`INTERIORS`), nie ma go też w planie wnętrz zabytków (`docs/plany/wnetrza-zabytkow.md`).
- **Osłony:** ławki przedpola (10), donice (369,4; −94,5) i (387,3; −96,1), drzewa (363,5; −89,3) i (404,7; −91), narożnik wieży.
- **Ucieczka:** deptakiem na zachód, Świętoduską na północ ku Alchemii, przez Plac Łokietka do metra A (433; −107) i do Bramy Krakowskiej.
- **Punkt widokowy:** z przedpola widać oś deptaku na zachód i Ratusz; sama wieża jest niedostępna.

## Topografia
- Prawdziwe miejsce: kościół w66264126, Krakowskie Przedmieście 1 (OSM: `amenity=place_of_worship`, `denomination=roman_catholic`), teren ok. 195,4 m n.p.m. (y −0,5). Sąsiedzi: Urząd Miasta w66264120 (Plac Łokietka 1), Świętoduska 1 (w67498732).
- Zgodne: obrys i położenie; okap 16,5 i kalenica 20,4 z NMPT (T-122, G-216); jedna wieża w narożniku SW z gzymsem i hełmem z NMPT i LoD2 zamiast dwóch proceduralnych (T-121, G-215 naprawione); przedpole z kostką zamiast zieleni (T-315, G-853).
- Odstępstwa niezamierzone: niższe części obrysu (północna przybudówka i części na y 9–11) stoją w grze na wysokości nawy, 58% obrysu ponad 3 m za wysoko (T-133, G-238, zgłoszone). Brak warstwy 2077 i przepisu zabytku (ADR-0062 etap 7 niezrobiony).

## Inwentarz docelowy
- **Architektura:** bryła z danych (jest), wieża z hełmem (jest), przyporowa ściana z ostrołukowymi oknami, gzyms, cokół z kamienia, portal z drzwiami (przepis zabytku, `packages/engine/src/renderer/mapcity/landmarks/recipes.ts`), niższe części jako osobne bryły (`building:part`, G-238).
- **Duże obiekty:** ławki, latarnie, donice, drzewa, kosze przedpola (są, meble mapy); do zrobienia reflektory iluminacji od dołu (model gry `floodlight`), tablica parafialna z godzinami mszy (ekran albo gablota, tekst przez i18n), kamera nad portalem (`cctv`).
- **Drobiazg w skupiskach (§14):** przy portalu znicze, kubki po zupie, ulotki; przy ławkach niedopałki i puszki (generator ADR-0096 `litter`); przy kancelarii od Świętoduskiej skrzynki z warzywami i termos.

## Frakcja i zasady
Frakcja: ulica (kościół deptaku i jego ławki; bez korporacji na ścianie).
- §12 zgodne: deptak Krakowskiego Przedmieścia między pierzejami (ciasno) otwiera się przy kościele na Plac Łokietka (otwarcie), a wieża zamyka oś. Próg zmienia światło (neony deptaku, ciemny zabytek) i nawierzchnię placu.
- §13 dług: kościół nie ma żadnego źródła światła, więc nocą jest dziurą w kadrze; brak drzwi, czyli brak celu nawigacji. Pomiar 60-30-10 z deptaku nie istnieje.
- §14 częściowo: makro i mezo z mebli przedpola (ławki, donice, latarnie), mikro tylko dwa `clutter` mapy.
- §15 częściowo: mokra kostka przedpola z odbiciami; tynk i dach matowe; prawdziwy dach jest miedziany z patyną (T-315), w grze bez połysku blachy.
- §16 zgodne: ulica bez reklamy na zabytku; kontrast z neonowym deptakiem jest treścią miejsca.
- §17 dług: skalę dają tylko ławki (drzwi brak), dźwięku dzwonu i organów brak, ruch tylko na ławkach.

## Dług sceny
- Sprzeczność ADR i gry: ADR-0062 daje każdemu zabytkowi warstwę 2077 i przepis ogólny według rodzaju (etap 7), a kościół rysuje się ogólnym stylem kamienicy-kościoła bez warstwy. Propozycja: przepis w `packages/engine/src/renderer/mapcity/landmarks/recipes.ts` (gotycka bryła w tynku, przypory, okna ostrołukowe, portal z drzwiami od deptaku, cokół) ze stonowaną warstwą 2077 (reflektory od dołu, jedna kamera, cienka linia światła na gzymsie wieży, bez ekranu), z przeglądem `topography-curator` i migawką NPR, jeśli wejdzie w kadr.
- Drzwi: portal główny od deptaku i boczne wejście od Świętoduskiej. Dziś `door-slots.ts` (`packages/engine/src/renderer/mapcity/`) odrzuca każdą ścianę kościoła; przepis zabytku albo wejście z korekty importu (`tools/osm-import/src/corrections.ts`).
- Niższe części kościoła na wysokości nawy (G-238): części `building:part` z NMPT w `tools/osm-import/src/corrections.ts` (odsyłacz T-133), kontrola `church-part-below-roof`.
- Reflektory iluminacji i tablica parafialna na przedpolu: meble planu w `docs/world/lublin-props.todo.json` (wzór reflektorów Bramy Krakowskiej), import `tools/osm-import`.
- Dzwon o pełnych godzinach (zegar gry, bez `Date.now`) i organy w porze mszy: emitery na zewnątrz w `packages/engine/src/audio/` (mapa źródeł jak `w3-sound-map.ts`).
- Drobiazg przy portalu i ławkach: generator ADR-0096 w treści Krakowskiego (`packages/sim/src/content/`), skupiska przy wejściu.
- Pomiar §13: ujęcie nocne z deptaku na kościół (ok. (350; −95), na wschód) w `tools/shots/room-spots.json`.
