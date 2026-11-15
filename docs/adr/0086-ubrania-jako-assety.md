# ADR-0086: Ubrania jako osobne assety na postaciach VRoid

Status: Zaakceptowany (15.11, decyzje użytkownika w sekcji „Decyzje użytkownika”). Wynika z G-870 (kamizelka kuloodporna wcina się w biust) i prośby użytkownika o research ubrań jako assetów. Dotyczy ADR-0076 (obsada VRoid, warianty, powłoki), ADR-0063 i ADR-0058 (licencje), ADR-0036 i ADR-0015 (przebrania, `GarmentMeshId`), ADR-0031 (podział renderera), ADR-0046 i ADR-0079 (budżety). Stan kodu: `wt-session` 512c63c.

## Kontekst

**Jak jest dziś.**
- Przebranie z ekwipunku (`AppearanceDescriptor.garments`, sloty `head`, `torso`, `legs`) na modelu VRoid robi dwie rzeczy: barwi materiały `Tops` i `Bottoms` odcieniem z `GARMENT_TINT` (`loadout.ts`) i wiesza doczepki `GarmentMeshId` (`visor`, `helmet`, `vest-plate`) na kotwicy kości głowy albo klatki (`garment-addons.ts`). Doczepki to bryły z `MeshBuilder` w stałym miejscu względem kości: nie znają kształtu ciała, nie gną się i wchodzą w ciało (G-870: dwie płytki kamizelki w biuście modeli F00).
- Warianty obsady (ADR-0076 §3) mają już drugą drogę: powłokę z ubrania modelu (`buildShell` w `model-apron.ts`). Kopiuje trójkąty góry i spodni z wycinka wysokości i szerokości, odsuwa je o 1,2 cm wzdłuż normalnych i zostawia na szkielecie ubrania. Leży na ciele i gnie się z nim. Ograniczenia: tnie całymi trójkątami (schodkowe brzegi, G-wpis w rejestrze przy `model-apron.ts`), nie ma grubości ani własnego kształtu (kołnierz, ładownice, poły płaszcza poniżej bioder, kaptur), a kształt zawsze powtarza ubranie pod spodem.
- Szkielet: wszystkie pliki obsady to VRoid VRM 0.x z kośćmi `J_Bip_*` na dwóch bazach (F00, M00). Retarget (`model-rig.ts`) zna też nazwy Mixamo i Blendera, ale tylko dla kości sterowanych z riga.
- Instancje: `instantiateModelsToScene(..., { doNotInstantiate: true })`, każda postać ma własny szkielet. Materiały toon są w pamięci podręcznej po kolorze i teksturze.
- Budżet `models` w `tools/perf-budgets.json`: 651 wywołań i 222 aktywne siatki od ADR-0079 (wcześniej 465 / 158, a zanim pojawił się wpis w pliku, stała 495 w specu). Ostatni pomiar 446–448 / 152 przy 12 ubranych postaciach, więc zapas to ok. 200 wywołań i 70 siatek.
- Pamięć: plik VRoid to 39–47 MiB tekstur w GPU (ADR-0076 §4), telefon `low` trzyma 5 plików naraz.

**Pytanie użytkownika.** Czy kamizelka, kurtki, płaszcze, hełmy i spodnie taktyczne mogą być osobnymi assetami zakładanymi na postacie, zamiast proceduralnych brył.

## Źródła (stan 15.11)

Sprawdzone przez strony źródeł i API wyszukiwarki Sketchfaba (`license=by`, `license=cc0`, `downloadable=true`); nic nie pobrano do repo. Strona MakeHuman (`static.makehumancommunity.org`) jest poza siecią tej sesji, więc jej warunków nie potwierdziłem.

**Dozwolone (CC0, CC-BY 4.0, własna praca):**

1. **VRoid Studio, ubrania robione w programie przez użytkownika.** Wytyczne VRoid Studio (https://vroid.com/en/studio/guidelines) mówią, że autorowi należą „textures and hair meshes you created from scratch” i że „Any individual or corporation may sell or use for commercial purposes any mesh, texture, or preset item provided by VRoid Studio” oraz „You can sell the data created by modifying preset items”, o ile przedmiot nie ma osobnej klauzuli. Zakaz, który nas dotyczy pośrednio: „You cannot create an application that can generate or output 3D models, avatars, or items”. Gra, która ubiera postacie w czasie gry i nie zapisuje plików modeli, tego nie robi; edytor postaci z eksportem VRM by to robił. Format: VRM 0.x albo 1.0, szkielet `J_Bip_*` identyczny z obsadą, ubrania jako osobne prymitywy z materiałami `Tops`, `Bottoms`, `Onepiece`, `Shoes`, `Accessory`, tekstury w stylu anime. Trójkąty: ubranie VRoid to zwykle kilka tysięcy; cały model 15–40 tys. Styl: dokładnie jak obsada. Ograniczenie: kategorie VRoid Studio to góra, dół, jednoczęściowe, buty i dodatki z presetów (kurtki, bluzy z kapturem, płaszcze są wśród presetów; twardej kamizelki z płytami i hełmu nie ma, buduje się je z narzędzia włosów albo jako sztywną bryłę poza programem).
2. **Próbki „VRoid Studio CC0 models”** (https://opengameart.org/content/vroid-studio-cc0-models, strona: CC0, w metadanych VRM `licenseName` CC0, redystrybucja i modyfikacja dozwolone). W grze jest sześć z jedenastu. Ich ubrania (kurtka Seki, bluza z kapturem HairSample_Male, sukienki AvatarSample_E i G, garnitur Sakurady) to gotowe skinned meshe na `J_Bip_*` i na tej samej bazie co reszta obsady. Wycięte z pliku jako osobny asset dają ubrania CC0 w stylu obsady bez pracy w programie. Dziś wymiana jest tylko teksturą i tylko przy tym samym kroju (`lends`), bo geometria zostaje u właściciela.
3. **Quaternius Modular Character Outfits – Fantasy** (https://quaternius.com/packs/modularcharacteroutfitsfantasy.html, https://quaternius.itch.io/modular-character-outfits-fantasy): „Free to use in personal, educational and commercial projects. (CC0 License)”. 12 strojów z 62 części, 3 warianty tekstur, FBX, OBJ, glTF i Blend, „Humanoid rig allowing easy retargeting”, zgodne z **Universal Base Characters** (CC0, ok. 13 tys. trójkątów na postać, glTF). Za darmo tylko Ranger i Peasant, cała paczka od 20 USD (licencja CC0 bez względu na cenę). Liczby trójkątów strojów strona nie podaje. Styl: stylizowane low-poly, fantasy (płaszcze, kaptury, skórzane zbroje, pasy, buty). Szkielet i proporcje Quaterniusa, nie VRoid: część wymaga dopasowania do ciała VRoid w Blenderze i przeniesienia wag.
4. **Sketchfab, CC-BY 4.0** (filtr licencji i pobierania w API, 15.11). Wersji CC0 z riggiem dla kurtek, kamizelek, płaszczy i hełmów wyszukiwarka nie zwróciła wcale. Z CC-BY najlepsze:
   - „Cyberpunk Jacket Concept 001 - Rigged” (agung.ihackstuff, https://sketchfab.com/3d-models/a213525b02f34413ad01f1d79416371e): CC Attribution, 9,7 tys. trójkątów, rig Mixamo, autor pisze, że zrobił ją dla swoich postaci VRoid (link do testu na VRoid Hub) i że „It's free for your game”. Najbliżej stylu i ciała obsady z tego, co znalazłem.
   - „"Spade" M1 Vietnam Helmet” (zuda, https://sketchfab.com/3d-models/d99ac1f10a6346a5a7912ed012d0ee5f): CC Attribution, 3,2 tys. trójkątów; hełm jest sztywny, więc rig nie jest potrzebny.
   - „Vest Armor Holster LowPoly GameReady Pack” (00amza, https://sketchfab.com/3d-models/7c41d35e505c4057abe60f89537408bd, 26.04.2026): CC Attribution, 18,2 tys. trójkątów, kamizelka z kaburą, opisana jako „Rigged Character Accessory”; realistyczna, do uproszczenia.
   - Odpadają mimo CC-BY: modele postaci z cudzych marek (Wolverine, Disco Elysium, League of Legends i podobne) oraz „Low Poly Jacket”, „Low Poly Military Jacket Tactical Top” i „Jumpsuit” od 1799danly, bo autor pisze „I downloaded the model from sketchfab and did retopology”, bez źródła i jego licencji. „Basic Vest” i „Chest Rig” (x3dv3s) mają w opisie „[NOT RIGGED]”, ale jako kształt kamizelki do dopasowania są dozwolone.
   - Każdy model z Sketchfaba przed użyciem: sprawdzenie licencji na stronie, pochodzenia (czy nie jest przeróbką cudzego modelu) i braku marek, wiersz w README i „Autorach” jak w ADR-0063.
5. **MakeHuman, ubrania społeczności** (do potwierdzenia): według opisów na OpenGameArt wynik MakeHuman i zasoby systemowe są CC0, a zasoby społeczności mają licencję wpisaną przy każdym (CC0 albo CC-BY). Styl realistyczny, szkielet MakeHuman. Wymaga sieci do `makehumancommunity.org`.

**Tylko tekstury, nie ubrania:** Poly Haven i ambientCG (CC0) mają tkaniny, skórę i kamuflaże, przydatne jako tekstury ubrań albo do uśrednienia na kolor wierzchołka. Kenney (CC0) nie ma ubrań na szkielecie humanoidalnym; jego postacie są blokowe (ADR-0076).

**Wykluczone:**
- **BOOTH.** Każdy twórca ma własne warunki, a typowe dla ubrań VRoid zabraniają dokładnie tego, co robi gra w przeglądarce, czyli udostępnienia pliku do pobrania. Przykłady: „Cyber Jacket 4Colors” (https://booth.pm/en/items/4210894): „Redistribution is prohibited regardless of whether it has been modified, paid or free of charge” i „It is prohibited to use it for model data when DL is possible”; „Tactical dress” i „Cyber Cheongsam” podobnie; presety włosów pozwalają na gry, ale zabraniają formy, z której dane „can be easily extracted”, a pliki z `public/` są do wyciągnięcia z każdej przeglądarki. Darmowy „Strawberry Summer” ma tylko „Do not resell”, bez słowa o grach i redystrybucji, czyli nie jest CC0 ani CC-BY. Reguła: BOOTH odpada, chyba że twórca da pisemnie zgodę na redystrybucję w grze, a wtedy to osobna decyzja użytkownika z wpisem w ADR-0063.
- **VRoid Hub:** każdy model ma własną licencję, zwykle bez redystrybucji (ADR-0076).
- **Mixamo** jako źródło modeli (licencja Adobe), CC-BY-SA, NC, płatne „royalty free” z CGTrader, RenderHub i Fab (poza listą ADR-0063).
- **Darmowe ubrania z itch.io z warunkiem „just credit me”** (np. kitekki): licencja nie jest CC-BY 4.0; tylko po pisemnym potwierdzeniu CC-BY 4.0 albo CC0 przez autora.

## Warianty techniczne

### A. Osobne skinned meshe ubrań na szkielecie VRoid
- **Format assetu:** `packages/app/public/garments/<klucz>.glb`, siatka w pozie spoczynkowej bazy (F00 albo M00), wagi do kości o nazwach `J_Bip_*`, bez ciała, z małą teksturą (512 px) albo kolorami wierzchołków. Manifest ubrań: klucz, baza, slot, które części modelu chowa, przesunięcie głębi.
- **Przypięcie do instancji:** kontener ubrania wczytany raz; na postać kopia siatki (`doNotInstantiate`, wspólna geometria), której indeksy kości są przemapowane po nazwie na szkielet instancji. Mapę liczy się raz na parę (ubranie, plik obsady) i trzyma w pamięci podręcznej. Szkielet i tekstura kości są wspólne z ciałem, więc koszt skinningu to tylko wierzchołki ubrania.
- **Dopasowanie do pliku:** modele tej samej bazy różnią się suwakami sylwetki (wzrost, biust, ramiona), więc ubranie zrobione na jednym pliku wejdzie w ciało innego. Rozwiązanie przy wczytaniu, raz na parę (ubranie, plik): każdy wierzchołek ubrania, który leży bliżej ciała albo ubrania pod spodem niż o próg (ok. 1 cm), wypychamy wzdłuż normalnej najbliższego punktu ciała; siatka przestrzenna, przy 3–10 tys. wierzchołków to kilka milisekund. Ta sama procedura może przenieść wagi z najbliższych wierzchołków ciała (jak robi `buildShell`), wtedy asset nie musi mieć wag ani nazw `J_Bip_*`, tylko pozę spoczynkową bazy.
- **Przeciw przebijaniu:** trzy warstwy, od najtańszej:
  1. ukrycie prymitywów, które ubranie zakrywa w całości (np. `Tops` pod płaszczem, włosy pod hełmem): `setEnabled(false)` na prymitywie, czyli mniej wywołań, nie więcej;
  2. przesunięcie głębi materiału ubrania (`zOffset`), które wygrywa z ciałem przy przebiciach rzędu milimetrów w ruchu;
  3. maska ciała: dla skóry pod ubraniem osobny bufor indeksów bez trójkątów z zakrytego obszaru UV ciała. UV ciała jest wspólne dla bazy (ADR-0076 §3), więc jedna maska na ubranie i bazę działa na wszystkich plikach. Do sprawdzenia w etapie 1: czy eksport VRoid próbek już usunął ciało pod ubraniem (opcja eksportu „usuń przezroczyste siatki”); jeśli tak, ukrycie `Tops` odsłoni dziurę i ubranie musi zakryć cały obszar góry.
- **Źródła dla A:** ubrania wycięte z próbek CC0 i z plików VRoid Studio (narzędzie w `tools`, np. `garment_extract.py` obok `shrink_glb.py`: zostawia prymitywy ubrań i ich tekstury, wycina ciało, twarz, włosy i spring bones), a ubrania spoza VRoid (Quaternius, Sketchfab) po dopasowaniu w Blenderze (shrinkwrap do ciała bazy w jej pozie, przeniesienie wag „Data Transfer”, zmiana nazw kości, eksport GLB) albo przez dopasowanie przy wczytaniu.
- **Koszt rysowania:** siatka to wywołanie w przebiegu koloru i w G-buforze linii, plus cień, jeśli postacie go rzucają; czyli ok. 2–3 wywołania na siatkę. Wszystkie ubrania jednej postaci scalone w jedną siatkę na wspólnym materiale (`charVertexColor` albo atlas ubrań) to +1 siatka i +2–3 wywołania na postać, minus ukryte prymitywy. Przy 12 postaciach: +12 siatek i +24–36 wywołań, w zapasie budżetu `models` (ok. 200 / 70).
- **Pamięć i paczka:** ubranie 3–10 tys. trójkątów to ok. 100–300 KB GLB; tekstura 512 px to ok. 1,3 MiB w GPU z mipmapami, kolory wierzchołków nic. Dwadzieścia ubrań to kilka MB paczki i kilkanaście MiB GPU, mniej niż jeden dodatkowy plik VRoid.
- **Praca ręczna:** narzędzie wycinające i manifest raz; każde ubranie spoza VRoid to dopasowanie w Blenderze (godzina do kilku); ubrania z VRoid Studio to praca w programie.
- **Ryzyka:** pozy skrajne (siad, sen, ogłuszenie) mogą przebić płaszcz udami; poły płaszcza poniżej bioder bez fizyki wyglądają sztywno (spring bones VRoid dla pół płaszcza da się przenieść tylko z ubrań VRoid). Broń i chwyt oburęczny (G-282) nie zmieniają się, bo ubranie nie rusza kości.

### B. Powłoki z ubrania modelu (`buildShell`, dziś fartuch i kamizelka)
- **Co daje:** zero assetów i licencji, idealne dopasowanie do każdego pliku, gięcie z ciałem, jedna siatka na materiale kolorów wierzchołków.
- **Co trzeba poprawić, żeby nadawała się na kamizelkę kuloodporną (G-870):** przycięcie trójkątów na granicy wycinka (zamiast całych trójkątów), większe odsunięcie dla płyt (2–3 cm) i grubość: brzeg powłoki zszyty z kopią na ciele, żeby kamizelka miała krawędź, a nie tylko kolor. Szelki i pasy jako druga, wąska powłoka.
- **Czego nie da:** kształtu innego niż ubranie pod spodem. Kołnierz, kaptur, ładownice, poły płaszcza poniżej bioder, rękaw szerszy niż koszula i hełm są poza zasięgiem powłoki.
- **Koszt:** +1 siatka na powłokę (2–3 wywołania), pamięć pomijalna, paczka bez zmian.

### C. Ubrania z VRoid Studio jako warianty całych modeli
- **Co daje:** najlepszy wygląd i spójność, fizyka pół i włosów z VRM, bez nowego kodu (manifest obsady przyjmuje pliki, ADR-0076 decyzja 1).
- **Koszt:** każdy strój to cały plik: 5–8 MB paczki i 39–47 MiB tekstur GPU. Przebrania z ekwipunku to kombinacje (głowa × tułów × nogi) na każdej postaci, więc pliki rosną iloczynem; limit 80 MiB obsady i 5 plików na telefonie `low` pozwalają na kilka strojów, nie na garderobę. Przebranie Seki w czasie gry to podmiana całego modelu (ponowne wczytanie, przeniesienie broni i dodatków, ADR-0076 etap 4a o podmianie model→model).
- **Kiedy ma sens:** dla postaci nazwanych ze stałym strojem (Kurosawa w garniturze, Mori w kitlu), nie dla ubrań z ekwipunku.

## Rekomendacja
1. **Teraz, G-870:** kamizelka kuloodporna jako powłoka B (decyzja użytkownika z rejestru), z przycięciem trójkątów na brzegu i większym odsunięciem płyt. To zamyka wcinanie się w biust bez nowych assetów.
2. **Potem: A jako docelowa droga dla ubrań z ekwipunku**, z ubraniami robionymi na szkielecie i bazach VRoid. Najpierw z tego, co już mamy na CC0: geometria ubrań z próbek VRoid (kurtka Seki, bluza z kapturem, garnitur Sakurady, płaszcze i sukienki AvatarSample) jako osobne assety, potem ubrania z VRoid Studio od użytkownika (kurtka Hebi, płaszcz Tessen, spodnie taktyczne), na końcu pojedyncze CC-BY ze Sketchfaba po dopasowaniu w Blenderze (Cyberpunk Jacket Concept 001, hełm M1).
3. **Hełmy i wizjery zostają sztywne** na kotwicy głowy, ale z prawdziwego modelu zamiast `dome`, i chowają prymitywy włosów pod sobą (albo przełączają je na krótką fryzurę).
4. **C tylko dla postaci nazwanych** ze stałym strojem, jak w ADR-0076.
5. Quaternius Fantasy i MakeHuman jako zapas na części, których nie ma w VRoid (płaszcze z kapturem, pasy, buty), po pomiarze, czy styl low-poly i realistyczny nie odstaje od anime w jednym kadrze.

## Etapy (osobne PR-y)
0. **G-870:** kamizelka z powłoki, przycięcie trójkątów na brzegu wycinka, test, że żaden wierzchołek ciała z wycinka nie leży przed kamizelką w pozach chodu, siadu i celowania (skinning na CPU w teście silnika, bez przeglądarki).
1. **Rozpoznanie plików:** czy próbki VRoid mają ciało pod ubraniem, jakie prymitywy ma każdy plik obsady, ile wierzchołków mają ubrania; pomiar `models` przed zmianą.
2. **Kontrakt (Architekt):** `GarmentMeshId` rozszerzony o skinned ubrania (`kevlar-vest`, `jacket-hebi`, `coat-tessen`, `cargo-tac`, `helmet-m1` albo pole `garment` w `GarmentLook` z kluczem assetu); nazwy przykładowe, lista z ekwipunku. Teksty dla gracza tylko kluczami (ADR-0056).
3. **Potok i loader:** `garment_extract.py`, manifest `garments/manifest.json`, przemapowanie kości, dopasowanie przy wczytaniu, chowanie prymitywów, `zOffset`, scalanie ubrań postaci w jedną siatkę; pierwsze ubranie z próbki CC0. Test sesji z fałszywym `RenderPort` i test silnika na pliku; pomiar `models` przed i po.
4. **Ubrania z VRoid Studio** po jednym albo dwóch na PR, ze zrzutami z ulicy i dialogu; wpis licencji użytkownika w README i „Autorach”.
5. **Hełmy z modeli** (sztywne, chowanie włosów) i maska ciała pod ubraniem, jeśli etap 1 pokaże, że jest potrzebna.
6. **CC-BY ze Sketchfaba i Quaternius** po dopasowaniu w Blenderze (`tools`, Blender bez okna, odtwarzalnie z `sources.json`), z wpisem w „Autorach”.

## Pytania do użytkownika
1. Czy przyjmujesz A (osobne ubrania na szkielecie VRoid) jako docelową drogę dla ubrań z ekwipunku, a B tylko dla G-870 i drobnych rzeczy (fartuch, kamizelka sprzedawcy)?
2. Kto robi ubrania w VRoid Studio (ty, osoba z zewnątrz), i pod jaką licencją zapisujemy je w README i metadanych (np. CC0 albo „własność autora gry”)?
3. Czy zgadzasz się na Blendera w `tools` (bez okna) do dopasowania ubrań spoza VRoid, czy wolisz tylko dopasowanie przy wczytaniu w grze (mniej dokładne, bez ręcznej pracy)?
4. Wygląd ubrań: kolory wierzchołków w stylu akcesoriów (lekko, płasko) czy małe tekstury 512 px jak w VRoid (więcej detalu, ok. 1,3 MiB GPU na ubranie)?
5. Czy hełm może chować włosy postaci (fryzura znika pod hełmem), czy ma być większy i zostawiać grzywkę?
6. Które ubrania najpierw: kamizelka kuloodporna, kurtka Hebi, płaszcz Tessen, hełm, spodnie taktyczne?
7. Quaternius Fantasy: wystarczy darmowa część (Ranger, Peasant), czy kupić pełną paczkę za 20 USD (licencja ta sama, CC0)?
8. BOOTH: czy w ogóle pytać twórców o pisemną zgodę na redystrybucję w grze, czy zamykamy to źródło?

## Decyzje użytkownika (15.11)
1. Docelowa droga to A: osobne ubrania jako skinned meshe na szkielecie VRoid `J_Bip_*`. B (powłoki) zostaje dla G-870 i drobnych rzeczy.
2. Ubrań z VRoid Studio na razie nie robimy. Zaczynamy od ubrań wyciętych z próbek VRoid CC0. Pliki z VRoid Studio dojdą później bez zmian w kodzie.
3. Blender w `tools`, uruchamiany bez okna, do dopasowania ubrań spoza VRoid i przeniesienia wag przy imporcie.
4. Pytania 4–8 zostają otwarte. Do czasu decyzji obowiązuje: tekstury 512 px jak w VRoid tylko tam, gdzie ubranie pochodzi z próbki; hełm chowa włosy; kolejność kamizelka, hełm, kurtka; z Quaterniusa tylko darmowa część; BOOTH zamknięty.

## Konsekwencje
- Zmiana kontraktu przebrań w `core` (Architekt) i nowy katalog assetów z manifestem; symulacja, zapis i złote hashe bez zmian (wygląd to pole widoku).
- Postać w przebraniu kosztuje jedną siatkę więcej (2–3 wywołania), w zapasie budżetu `models`; pomiar w każdym etapie.
- Każde ubranie z zewnątrz przechodzi ścieżkę licencji z ADR-0063 (README, `sources.json` z sha256, „Autorzy”, test `credits.test.ts`).
- Migawka NPR nie widzi modeli (`models=off`), więc wygląd ubrań sprawdzają zrzuty w PR-ach i testy przebijania.
