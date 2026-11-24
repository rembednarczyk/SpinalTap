# Plac Łokietka i Nowy Ratusz (`plac-lokietka`)

Plac Łokietka (OSM w177524462, środek (449; −104)) na wschodnim końcu deptaka Krakowskiego Przedmieścia, x ≈ 380..470, z ≈ −70..−125: od kościoła św. Ducha (w66264126, (383,1; −78,5)) na zachodzie, przez Nowy Ratusz (Urząd Miasta, w66264120, (416,1; −69,6)) od północy, po Bramę Krakowską (r7224409, (472,6; −91,2)) na wschodzie. Pod placem stacja metra Brama Krakowska z wejściem A (433; −107). Plac leży jeszcze w dzielnicy `shinsekai-7` (chunk `krakowskie-2-0`, granica ze Starym Miastem na x = 460). Stan gry na `22b1808`.

## Historia
Plac nosi imię Władysława Łokietka, który w 1317 roku nadał Lublinowi prawa miejskie. Powstał przed Bramą Krakowską, na przedmieściu, którym droga z Krakowa wchodziła do miasta. Od północy zamyka go Nowy Ratusz, klasycystyczny gmach urzędu miasta urządzony w XIX wieku w dawnym klasztorze karmelitów; od zachodu gotycki kościół szpitalny św. Ducha z XV wieku, od wschodu brama. Na placu stoi brązowa makieta Lublina z przełomu XVI i XVII wieku, pamiątkowe tablice na ścianie Ratusza (450-lecie Unii Lubelskiej, Krzyż Grunwaldu, pamięć Żydów z Lublina) i dwa z miejskich koziołków: Onufry i Jan.

W 2077 Ratusz dalej rządzi miastem, ale plac jest jego granicą z ulicą: za plecami urzędników zaczyna się Stare Miasto Hebi, a za Ratuszem, w podwórku od Przystankowej, myjnia, w której Seki zabiła pierwszego kuriera (M0, `m0.ink`: „Podwórko za myjnią, za Placem Łokietka”). Kaito wysyła stąd dostawy do Hany: „Targ w Alchemii, w dół Lubartowskiej od Placu Łokietka” (`m0.ink`). Za dnia Hina szuka tu kota, który uciekł do ciepłej myjni (`enc_s7_neko`). Przed chwilą ktoś zostawił przy makiecie kubek bubble tea z GanBei i odszedł do metra.

## Klimat
- Światło: 9 latarni pastorałowych z planu mebli (m.in. (389,6; −101,2), (415,9; −101,7), (439,2; −96,1), (447,4; −108,4)), jedna drogowa (431,4; −118,6), dwa reflektory Bramy Krakowskiej od dołu (461; −97) i (468; −101). Żadna lampa ani neon gry nie stoi w obrysie placu; neony lokali na pierzei południowej (LODY NA BOSAKA #ff2e88, OKULARKI DLA MALUCHA #00e5ff, PRZYPALONY CUKIER #ffb000, BLASK KARATA, GARNEK MAMY #ff4040) to jedyne barwy. Najbliższy neon gry, czerwony MYJNIA 24H (403,2; −38,5), świeci 30 m za Ratuszem.
- Dźwięk: trolejbus na Królewskiej i Lubartowskiej (słupy trakcji, linie `TROLLEY_STREETS` w `traffic.ts`), gwar deptaka, kroki pod sklepieniem bramy. Źródła stałego dźwięku na placu brak.
- Zapach: słodkie z lodziarni i bubble tea, mokry granit, ozon z sieci trolejbusowej.
- Kontrast: urzędowa fasada Ratusza z holo-tablicami nad szachownicą płyt, a pod nią budka z jedzeniem i automat; brąz makiety obok drogi do bramy Hebi.
- Ruch: tłum deptaka (`krakowskie-2-0`, profil `evening`, pełny od 17:00 do północy), przechodnie z metra, 8 siedzących postaci z mebli.

## Przeznaczenie
- Węzeł dróg: z deptaka na Stare Miasto przez Bramę Krakowską (droga pieszych `GATE_WALK` w `street-props.ts`: (400; −97) → (440; −100) → (447; −95) → (457; −95,6)), na północ Lubartowską do Alchemii, na południe Królewską pod Archikatedrę. Wejście A metra (433; −107), otwór na północ.
- Spotkanie `s7_neko` (428; −99), 9:00–18:00.
- Osłony: 53 słupki z łańcuchami, 14 ławek, 9 drzew, pawilon metra (3,6 × 7,2 m), budki z jedzeniem (2). Wysokich osłon brak, plac jest otwarty.
- Punkty widokowe: brak dostępnych; Brama Krakowska i wieża Ratusza (20,2–26,6 m, T-008) są punktami orientacyjnymi widocznymi z deptaka.

## Topografia
- Prawdziwe miejsce: Plac Łokietka (w177524462), Nowy Ratusz (w66264120 z wieżą w619138854), kościół św. Ducha, Brama Krakowska. Teren z NMT ok. 195,5–197,1 m n.p.m. (y −0,3..1,3), lekko opada ku Bramie.
- Zgodne: obrys placu, Ratusz z wieżą (T-008, poprawione) i przepisem zabytku z czterokolumnowym portykiem od placu (T-067, G-119 dla Ratusza, `porticoes.ts`), Brama Krakowska z przepisem, makieta (437,6; −123,4) i koziołki w miejscach z OSM, tablice pamiątkowe jako punkty OSM.
- Odstępstwa: pawilon metra A na placu (T-156, celowe, ADR-0071); plac bez nazwy na mapie miasta (T-048, do poprawy); żeliwnej pompy (451; −115) z planu ulic nie ma w meblach (brak wpisu, pozycja `plac-lokietka.pompa` w `docs/world/lublin-street-plan.md`); kościół św. Ducha bez przepisu zabytku, fasada jak każdy gmach (karta `kosciol-sw-ducha`).

## Inwentarz docelowy
Architektura:
- posadzka w szachownicę z jasnych płyt w ramach z ciemnej kostki (mapa, nawierzchnia `square`);
- fasady Ratusza (jest) i Bramy (jest) z przepisami zabytków, kościół św. Ducha do zrobienia (`landmarks/recipes.ts`);
- pawilon metra A (`metro-pavilion.ts`), sieć trolejbusowa nad Królewską i Lubartowską (generator słupów `trolley-pole`).
Duże obiekty:
- makieta Lublina pod szklaną kopułą z holo-warstwą 2077 (model gry `artwork`, do zrobienia: Blender `tools/blender/rooms/plac_lokietka.py`);
- żeliwna pompa z filtrem i kolejką do wody (Blender, ten sam plik);
- budki z jedzeniem, automat, bankomat, ławki, latarnie pastorałowe (model gry, meble uliczne).
Drobiazg w skupiskach:
- przy budkach: kubki, pałeczki, serwetki, karton (generator ADR-0096 `litter`);
- przy wyjściu z metra: bilety, ulotki, niedopałki (drobiazg pawilonu z `METRO_DETAIL`, dziś w hali pod placem);
- przy makiecie: kubek bubble tea, kwiaty i znicz pod tablicą pamięci (Blender `plac_lokietka.py`).

## Frakcja i zasady
Frakcja: korporacja, ulica (urząd miasta nad deptakiem).
- §12 zgodne: deptak (ok. 20 m) otwiera się na plac szeroki na ok. 90 m, a za placem Bramowa zwęża się do 3,6 m w przejeździe bramy; to kompresja i otwarcie z prawdziwego układu. Dług: próg Krakowskie i Stare Miasto czytelny tylko przez bramę, plac sam nie zmienia nawierzchni ani światła przed nią.
- §13 częściowo: wszystkie światła mają oprawy (pastorały, reflektory bramy), ale żadne nie niesie znaczenia nawigacji: wejście do metra nie ma zielonego światła, brama ma ciepłe reflektory, jak cała reszta. 60-30-10 niemierzone (zrzut nocny z deptaka na Bramę, `pnpm shots:palette`). Pomiar nocny 24.11 (22:00, ujęcie `plac-lokietka` w `tools/shots/plaza-spots.json`, baza/światło/akcenty w %): 63,8/35,2/1,1, brak akcentu.
- §14 częściowo: makro i mezo z mebli (53 słupki, 14 ławek, 2 budki, automat, bankomat), mikro 5 naklejek i 4 rzeczy `clutter`; skupisk przy budkach i makiecie brak.
- §15 częściowo: mokra posadzka z odbiciami; szkła i chromu brak poza pawilonem metra.
- §16 częściowo: porządek urzędu (korporacja) jest, brud ulicy tylko na pierzei południowej; brak stróża albo kamery Ratusza, która mówiłaby, czyj to plac.
- §17 dług: sieć trolejbusowa i budki bez dźwięku źródła, brak emiterów (emitery są tylko z `DISTRICT_M0_PROPS`). Ruch: tłum i trolejbusy; skala: ławki, słupki, drzwi Ratusza.

## Scenariusz tła
- Kto tu bywa: urzędnicy Nowego Ratusza w drodze na przerwę; turyści przy makiecie Lublina i koziołkach Onufrym i Janie; ludzie z deptaka idący przez Bramę Krakowską na Stare Miasto albo w dół Lubartowskiej do Alchemii; pasażerowie wejścia A metra; za dnia Hina szukająca kota (`enc_s7_neko`).
- Co się dzieje: rano urzędnicy przechodzą placem do Ratusza, w dzień budki z jedzeniem obsługują kolejki, a przewodnicy zbierają grupy przy makiecie; wieczorem plac pustoszeje szybciej niż deptak, bo za Bramą Krakowską zaczyna się Stare Miasto Hebi.
- Ślad obecności: kubek bubble tea z GanBei przy makiecie, niedopałki przy pawilonie metra, ulotki z budek przy ławkach.

## Dług sceny
- Kamera i holo-tablica na fasadzie Ratusza (urząd pilnuje placu): urządzenie w `packages/sim/src/content/devices.ts`, tablica w przepisie Ratusza w `packages/engine/src/renderer/mapcity/landmarks/recipes.ts`.
- Zielone światło nad otworem pawilonu metra A (433; −107) jako światło drogi: `packages/sim/src/content/metro-pavilion.ts` (lampa na końcu listy rekwizytów pawilonu).
- Żeliwna pompa (451; −115) i makieta z kopułą: modele w nowym `tools/blender/rooms/plac_lokietka.py`, rekwizyty w nowym `packages/sim/src/content/lokietka-detail.ts`, klucze na końcu `ROOM_DETAIL_SHAPES` w `packages/core/src/world/room-detail.ts`.
- Skupiska drobiazgu przy budkach i makiecie: `lokietka-detail.ts` jak wyżej.
- Emiter brzęczenia sieci trolejbusowej i iskier na stykach oraz gwaru budek: `packages/engine/src/audio/spatial.ts`.
- Podpis „Plac Łokietka” na mapie miasta (T-048): `packages/ui` (mapa) albo import nazw obszarów w `tools/osm-import`.
- Ślad Hiny przy deptaku (`enc_s7_neko`: „zagląda pod każdą ławkę i każdy samochód przy deptaku”): na placu nie ma żadnego auta (0 zaparkowanych w obrysie), więc zdanie ink o samochodach nie ma oparcia. Propozycja: zostawić ink i dać 1–2 auta dostawcze na Królewskiej przy placu (`packages/sim/src/content/parked-cars.ts`), albo skrócić zdanie w `packages/narrative/ink/{pl,en}/enc-shinsekai.ink` (decyzja narracji).
- Zmierzyć 60-30-10 nocą z deptaka na Bramę i wpisać w §13 tej karty.
