# Dziennik zmian

Zmiany widoczne dla gracza, od najnowszych. Wersja gry i commit są na ekranie tytułowym (#81); przy zgłoszeniu błędu podaj je razem z datą. Każdy PR z funkcją albo poprawką widoczną w grze dodaje własny plik w `changelog.d/` (zasady w `changelog.d/README.md`); `pnpm changelog` przenosi wpisy tutaj, do sekcji „Nieopublikowane”.

## Nieopublikowane (0.1.0)

### 11 listopada 2026
- Pliki modeli postaci spoza sceny zwalniają pamięć, na telefonie z limitem plików; plik, który się nie wczytał, wczyta się ponownie (ADR-0076 etap 4b, G-562, #410).

### 8 listopada 2026
- Alchemia: plac T0 z pergolami, girlandami lampek na krzyż i zielony dach z trawnikami, wjazd z Bajkowskiego (ADR-0074 etap 7, #382); bez stożka światła na stropie P−1 i deszczu w food hallu (G-490, G-509, #385, #402).
- Auta zjeżdżają rampą do kabin parkingu P−1 Alchemii i objeżdżają gracza tylko między ścianami (G-491, G-510, #399).
- Modele postaci spoza pierwszej sceny wczytują się w tle: start nowej gry 36,5 MiB zamiast 42,5 (ADR-0076 etap 4a, #407).
- Kostka i trawniki na podwórzach i chodnikach Krakowskiego Przedmieścia (G-513, G-521, T-243, T-245, #397, #405); pastorał przy wiadukcie na pomoście (G-507, #392).
- Starsze postacie wyglądają na swój wiek: siwe włosy, pochylenie, laska Ume, chusty (ADR-0076 etap 3a, #395); Kurosawa z własnym modelem (etap 3, #404); pula tła losuje wszystkie pliki (G-488, #388).
- Seki biega, kuca i dusi bez nóg przechodzących przez spódnicę; rozstaw stóp w pozach i kolana po śmierci w kucki (G-511, G-512, G-514, #386, #394, #396).

### 7 listopada 2026
- Przebudowa Alchemii według planu 2026: food hall i tarasy, Arkady i plac T2, trójkątny pawilon, parking P−1 z rampą (ADR-0074 etapy 1–4, zapis v33–v36, #343, #357, #367, #375).
- Chwyt z wyborem ogłusz albo zabij oraz animacje chwytu, duszenia, zabicia i odłożenia ciała (ADR-0075 etapy 1–2, #359, #371).
- Ogłuszony leży, niesiony wisi na ramieniu, odłożone ciało ląduje poza bryłami, zwłoki opadają z wysokości terenu; zabójstwo przy świadku zgłaszane osobno od nokautu (G-334, G-447, G-449, G-457, G-479, #350, #355, #356, #370, #373).
- Gatunki i wysokości drzew z OSM i NMPT, modele dębu i topoli (G-422, G-423, #345, #348).
- Karty skanu i dzielnicy na telefonie nie zasłaniają przycisków (G-433, G-466, #353, #365).
- Kostka do fasad przy Sądzie, na Kościuszki i Peowiaków, szerokości deptaków z ortofoto, trawnik Placu Czechowicza (G-427, G-428, G-436, G-440, G-450, #347, #349, #352, #364, #366).
- Latarnie z planu przy krawędzi deptaka i pomostów wiaduktów (G-477, G-497, G-503, #374, #381, #383); bryły mają ostatnie słowo przy wypychaniu postaci (G-485, #377); scena poety na płycie Placu Litewskiego (G-489, #378).
- Obsada postaci: każda postać nazwana ma własny wygląd, warianty skóry, włosów i ubrań, Fixer bez czarnej skóry (ADR-0076 etapy 1–2, G-474, #368, #372, #376).
- Postęp postaci w HUD i zakładce Rozwój, poziom wroga w skanerze (ADR-0059 etap 7, #346).
- Osobne suwaki głośności dialogów i radia w opcjach (zakładka „Ogólne”), a muzyka i radio cichną o 8 dB pod mówioną linią (ADR-0060 etap 1).
- Test balansu przejścia (ADR-0059 etap 8): XP zleceń i wrogów rośnie z poziomem jak koszt poziomu dopiero od poziomu 6 (niżej bez zmian), XP za quickhack zależy od różnicy poziomów tak jak XP za wroga, więc walka zawsze daje co najmniej tyle co quickhack; dostawa od Kaito ma poziom Krakowskiego, akt I daje 1350 XP, a dzielnice dają 8 / 7 / 7 / 7 poziomów i doki kończą drogę na 30.

### 6 listopada 2026
- Wszczep cyberdeck z RAM i szybszym wgrywaniem quickhacków (#341).
- Ikony broni, amunicji i wszystkich przedmiotów, pasek broni w HUD, na telefonie torba z samymi ikonami (ADR-0073 etapy 1–2, #334, #340).
- Łup według stylu gracza i ochrona przed pechem (ADR-0059 etap 6, #337).
- Wrogowie ścigają gracza w metrze, a strzał przez szyb nie trafia w ulicę pod pawilonem (G-368, G-371, G-377, #316, #335).
- Mikrozdarzenie bez tekstu nie otwiera pustej rozmowy (G-401, #332); cienki wierzch nie jest podłogą bez oparcia (G-372, #321).
- Kostka na gołych pasach Podzamcza i przy Dworcu, trawniki wycięte z bruku placów, bez migotania nakładających się nawierzchni (G-345, G-382, G-383, G-421, G-320, #318, #339, #344, #328).
- Pad ma promieniową martwą strefę 0,12 bez „krzyża” na skosach, krzywą obrotu (klasyczna domyślnie, liniowa i precyzyjna w opcjach) i własną czułość w zakładce „Dotyk i pad”; mysz, dotyk i pad obracają widok każde ze swoją czułością (ADR-0072 etap 4).
- Pasma dzielnic: poziom wrogów, łupu i kontraktów zależny od dzielnicy (ADR-0059 etap 5, #331).
- Broń i odzież mają poziom 1–30 i dwie nowe rzadkości, epicką i legendarną, z cechami; łup z wrogów i towar u Oyajiego mają poziom gracza, a karta przedmiotu pokazuje poziom, rzadkość i cechy (ADR-0059 etap 4).
- Ramka rzadkości w slotach ekwipunku (G-410, #342).
- Strzał z celowaniem jednym kciukiem na dotyku (ADR-0072 etap 1, #322).
- Targ z al. Tysiąclecia przeniesiony do Alchemii: sprzedawcy przy stoiskach, Hana na placu, skrytka Hebi przy ruinie, Ren na tarasie dachu; aleja wraca do danych OSM (ADR-0063 etap 6).
- Wspomaganie celowania na dotyku (domyślnie standardowe, w opcjach lekkie i wyłączone, zakładka „Dotyk i pad”): obrót zwalnia nad wrogiem w walce, a wejście w przyrządy dociąga celownik o 60% drogi do klatki piersiowej (najwyżej 4°, w stożku 6°, w 0,15 s); ruch w przeciwną stronę przerywa dociąganie. Mysz nie dostaje wspomagania (ADR-0072 etap 3).

### 5 listopada 2026
- Hala Alchemii zatrzymuje na swoich narysowanych ścianach: po cokole da się obejść halę dookoła, wejść pod daszek przed frontem i pod podest schodów, a z podestu przejść na balkon piętra (G-297, G-298). Lada i stojak pod daszkiem oraz policzek schodów są twarde: nie da się przez nie przejść ani zejść bokiem z biegu.
- Zewnętrzne schody hali Alchemii dają się przejść tak, jak są narysowane: od bruku za halą przez cokół na podest pod drzwiami piętra, bez niewidzialnej ściany pod biegiem (G-288).
- Przed frontem hali Alchemii są stopnie z bruku na cokół, jak przy stoiskach: pod daszek przed zamkniętymi drzwiami wchodzi się od placu (G-299).
- Do drzwi stoisk Alchemii od Świętoduskiej prowadzą betonowe stopnie z niskimi murkami po bokach, zamiast progów 0,6–1,9 m nad brukiem (G-287).
- Menu otwarte klawiszem I zaraz po starcie gry zwalnia kursor także wtedy, gdy przeglądarka przyzna blokadę z opóźnieniem; kliknięcia trafiają w ekwipunek, nie w canvas (G-306).
- Strzelba, karabin i SMG w TPP są trzymane oburącz: prawa dłoń zaciska się na rękojeści, lewa podtrzymuje łoże, przy celowaniu kolba opiera się o bark, a przy biodrze broń leży skośnie przed ciałem. Postać z bronią w dłoni zamyka palce na rękojeści, również przy pistolecie i rewolwerze. Tak samo wygląda to u gracza i u NPC (G-282).
- Drabiny bez teleportów: wejście od dołu i od góry oraz zejście na dach płynnie, broń w kaburze na czas wspinania (ADR-0021).
- W ekwipunku jest pasek zdrowia jak w HUD-zie, a wybrany posiłek albo apteczka podświetla na nim, ile HP przywróci (lista użytkownika z 4.11).
- Hana przyjmuje paczkę od Kaito także przy wrogiej postawie ulicy, kurs nie przepada (G-304, ADR-0070).
- Podpowiedzi klawiszy w HUD (pierwsze kroki, dash, przyciski akcji) mówią w języku gracza: przy angielskim ustawieniu „Mouse” i „Space” zamiast „Mysz” i „Spacja”.
- Przechodzień, który boi się Seki, staje między 7 a 9 m i patrzy na nią, zamiast drgać na granicy ucieczki (ADR-0070 etap 1).
- Rewolwer, strzelba i karabin mają własne modele z paczki Quaterniusa zamiast powiększonego pistoletu albo SMG, każda broń jest trzymana za rękojeść i celuje lufą do przodu, w TPP i w FPP (G-282).
- Plama reflektora niskiego patrolu leży na bruku tak, jak go rysuje miasto, i świeci jednolitym kręgiem, bez ciemnego środka i wcięć (G-293).
- Podejrzliwy wróg nie obraca się już za Seki, której nie widzi, tylko patrzy tam, gdzie ją ostatnio widział (G-294).
- Na granicy chunków ziemia pod wiaduktem Zamkowej i mostami Mełgiewskiej jest znowu pomostem, a nie terenem półtora metra niżej (G-278).
- Przy nieufności przechodnie ustępują Seki krokiem na 3,5 m bez komunikatu, uciekają dopiero przy wrogości, a sprzedawcy i postacie z rozmową zostają na miejscu, więc stragan Oyajiego działa (ADR-0070 etap 2, G-305).
- Wrogowie słyszą kroki Seki: sprint z 9 m, chód z 3,5 m, lądowanie z 6 m, kucanie wcale; usłyszawszy, robią się podejrzliwi i idą sprawdzić, ale sam hałas nie podnosi alarmu (ADR-0069 etap 2).
- Wróg, który już widzi biegnącą Seki, nie dostaje za jej kroki dodatkowego podejrzenia, tylko trop: Kagami i ochrona Tessen znów potrzebują ok. 0,6–0,7 s na sprint z 10 m (ADR-0069 etap 3).
- Scalony toast „×N” zostaje pełne 4,5 s od ostatniego identycznego powiadomienia, a toast z flagą `keep` nie scala się ze zwykłym (G-286).
- Wróg, który idzie sprawdzić hałas albo trop, patrzy przed siebie, a nie idzie tyłem z oczami na posterunek; usłyszawszy sprint za plecami, odwraca się po drodze i widzi Seki (ADR-0069 etap 3).

### 4 listopada 2026
- Alchemia 2077 na Placu Ofiar Getta: hala food hallu z neonem ALCHEMIA na dachu i pięć stoisk wzdłuż Świętoduskiej, na razie z zewnątrz (ADR-0063 etap 4).
- Widok z oczu pokazuje broń, którą postać trzyma: SMG, strzelba i karabin mają w FPP model SMG w rozmiarze jak w TPP zamiast pistoletu, a każda broń ma własną pozycję z biodra i przy celowaniu, która nie zasłania celownika (G-282).
- Napisy rozmowy stoją w lewym dolnym rogu, obok koła odpowiedzi, i pokazują tylko bieżącą kwestię czytaną od góry, bez skoku przewijania; każdy krok rozmów mieści się bez przewijania na komputerze (1280×720), a na telefonie poza dwoma zakończeniami aktów, przy których strzałka pokazuje, że tekst ciągnie się niżej. Na czas rozmowy znikają imię z paskiem zdrowia, minimapa i pasek broni, więc nic z HUD nie prześwituje spod napisów. Wcześniejsze kwestie otwiera zakładka „Wcześniejsze kwestie” (G-283).
- Przy złej reputacji tłum nie zasypuje już ekranu powiadomieniami: uciekający przechodnie dają jedno powiadomienie z licznikiem, potem 30 s ciszy, a jednakowe powiadomienia scalają się w jedno (G-281).
- Kamera nie przechyla się już po trafieniu w biegu ani po jeździe metrem: obrót myszą lub gałką znowu obraca widok w poziomie zamiast kręcić całym obrazem (G-279).
- Każdy wróg z AI gangera (Hebi, Kagami, Tessen) widzi w stożku przed sobą, kucającą Seki z połowy zasięgu i potrzebuje chwili patrzenia przed alarmem, więc od tyłu w kucaniu da się podejść i obezwładnić także gangera Hebi (ADR-0069 etap 1, G-285).
- Zryw w przebraniu słabiej zwraca uwagę strażników: pojedynczy zryw nie demaskuje przebrania na żadnym poziomie trudności, a zryw za zrywem pod okiem strażnika nadal je zdradza, choć dużo wolniej niż sprint (G-280).

### 2 listopada 2026
- Nad deptakiem Krakowskiego Przedmieścia (przy Placu Litewskim i Bramie Krakowskiej), Rynkiem, Rybną przy Placu po Farze, Karmelicką, Zamkową i Szkolną co jakiś czas pojawiają się niskie drony policyjne: schodzą pionowo z wysoka, gdzie ich nie widać, przelatują 4–6 m nad głowami ze światłami czerwono-niebieskimi, zawisają na minutę lub dłużej z plamą reflektora, która rośnie na bruku, gdy dron schodzi, i odlatują w górę; nad Starym Miastem rzadziej, nad deptakiem i placami częściej; na telefonie (jakość niska) ich nie ma (ADR-0058 etap 7b).
- Drzwi mają widoczne futryny: jasną kamienną (kamienice, klatki) albo aluminiową (sklepy, banki) ościeżnicę z nadprożem i progiem, odcinającą się od ciemnego skrzydła i tynku; takie samo obramowanie dostały drzwi kliniki, Neon Koi i wejście pokoju kapsułowego (G-270).
- Kable i lampiony przęseł nad ulicami wiszą co najmniej 3,5 m nad nawierzchnią także na zboczach: nie wchodzą już pod ziemię ani nie zwisają na wysokości głowy przechodnia (G-268).
- W FPP pistolet przy celowaniu siedzi pod celownikiem, a odrzut przy celowaniu idzie prosto w tył, więc broń i dłoń nie zasłaniają celu z bliska; w TPP postać, która zasłania widok tuż przed kamerą, przechodzi w półton kropek; klawisz G (na padzie lewa gałka przy celowaniu) i opcja w ustawieniach przenoszą kamerę na drugie ramię razem z linią strzału (G-275).
- Lampa pokoju kapsułowego przy Jezuickiej 14 świeci tylko w pokoju: nie rozjaśnia już bruku i fasady przed budynkiem, a w drodze do pokoju rozjaśnia się płynnie, bez skoku na 45 m (G-263).
- Schody z wiaduktu Zamkowej schodzą równo od pomostu do placu: bez ściany 2,9 m na krawędzi pomostu, bez wznoszenia pod prąd i bez płyty stopni na wysokości pomostu obok biegu (G-255).
- Budynki ceglane z mapy (Donżon, Baszta Gotycka, Kaplica Trójcy) mają ściany z gołej cegły zamiast tynku, a budynki z kolorem fasady w OSM (m.in. Urząd Miasta, Trybunał Koronny, Archikatedra, Zamek) dostają najbliższy mu tynk z palety (G-244).
- Na deptaku Krakowskiego Przedmieścia świecą same pastorały: znika 16 nowoczesnych słupów, które stały metr od nich, i 2 latarnie drogowe u wylotów bocznych ulic; generator nie stawia zwykłej latarni bliżej niż 8 m od stylizowanej (G-259).
- Na pierzei Krakowskiego Przedmieścia przy Placu Litewskim stoją same pastorały, od zachodniego końca placu do Kapucyńskiej: 8 nowoczesnych słupów ustępuje pastorałom w rozstawie deptaka, słupy zostają na alejkach placu (G-266).
- Na Starym Mieście w murach nie ma już latarni drogowych: dwie latarnie z OSM na Archidiakońskiej przy Placu po Farze są stylizowanymi pastorałami w tych samych miejscach (G-264).
- Przy Jezuickiej 14 na Starym Mieście można wejść do pokoju kapsułowego na wynajem (kuchnia, łóżko we wnęce pod szafkami, ekrany); wejście zapisuje grę jak w innych lokalach (ADR-0063 etap 3).
- Na ławkach, w ogródkach i przy budkach z jedzeniem, na przystankach i przed drzwiami lokali są ludzie w nieruchomych pozach: siedzą, czekają w kolejce, palą; na telefonie (jakość niska) jest ich połowa, w prostszej wersji (ADR-0058 etap 8).
- Ciało napastnika z wygranego napadu (obalonego albo zabitego takedownem) nie znika, gdy gracz odejdzie kilkaset metrów: po powrocie, także po zapisie i wczytaniu, leży tam, gdzie upadło; ocucony napastnik znów odchodzi z ulicą jak zwykły przechodzień (G-239).
- Wieża cerkwi św. Jozafata dostaje niski dach namiotowy z NMPT: okap y 8,1 zamiast 6,5, szczyt bez zmian na y 9,5 (G-246).
- Niska przybudówka Pałacu Lubomirskich od Placu Litewskiego ma płaski dach ok. 5,5 m nad ziemią, jak w numerycznym modelu pokrycia terenu, zamiast bryły równej pałacowi; parter i pierwsze piętro fasady pałacu są znów widoczne (G-251).
- Nad dachami ulic Lublina latają drony: patrole policji i korporacji ze światłami, kurierzy z paczkami i drony z ekranami reklamowymi; na telefonie (jakość niska) ich nie ma (ADR-0058 etap 7).
- Zapis czeka na koniec obezwładnienia, bo chwytu nie ma w zapisie: zapis ręczny w chwycie jest odmówiony jak w rozmowie, a autozapis zapisuje się zaraz po chwycie, więc gra wczytana i ta, z której zapisano, toczą się dalej tak samo (G-253).
- Ciało napastnika z wygranego napadu (obalonego albo zabitego takedownem) zostaje po zapisie i wczytaniu tam, gdzie było: na ulicy, na ramieniu gracza albo w kryjówce; zapis w trakcie napadu kończy go jak odejście (G-233).
- Podpowiedź na drążku ruchu na telefonie jest po angielsku („Move”), a po polsku tylko przy wybranym polskim w opcjach.
- Pojazdy z paczki 2 i Kenneya: stary sedan, sportowe auto, SUV, pickup, śmieciarka i trolejbus z autobusu, z prostszymi wersjami na telefon i z daleka (ADR-0058 etap 4).
- Skaner pokazuje „Doctor Mori” w wersji angielskiej i „Doktor Mori” w polskiej, zamiast zawsze po polsku (G-248).
- Wolnostojące wieże z mapy (dzwonnica św. Mikołaja, wieża cerkwi św. Jozafata, Baszta Gotycka, Donżon) mają fasadę wieży zamiast rzędów okien mieszkań, a dzwonnice bez dachu w mapie dostają dach namiotowy (G-232).
- Zapis w trakcie paniki po walce uspokaja ulicę także w grze, z której zapisano, a telefon świadka w toku dochodzi od razu przy zapisie (zgłoszenie i heat jak bez zapisu), więc gra wczytana i niewczytana dalej toczą się tak samo (G-240).
- Pałac Lubomirskich przy Placu Litewskim ma dwie wieże i dach na wysokości z numerycznego modelu pokrycia terenu zamiast płaskiej bryły o domyślnej wysokości (G-249).
- Schody z kierunkiem w mapie wznoszą się w tę stronę co w Lublinie: także schody przy portalu Archikatedry i schody z wiaduktu Zamkowej (G-236).
- Wieża kościoła Brygidek przy Narutowicza stoi w grze z wysokością ok. 34 m z numerycznego modelu pokrycia terenu; wieże zmapowane bez `building` nie są już pomijane (G-098).
- Schody na mapie mają stopnie ułożone wzdłuż biegu i widoczny pas szeroki na co najmniej 0,45 m (G-213).
- Kamienica przy Złotej 6 ma drzwi klatki od Złotej zamiast od parkingu, a Grodzka 7 nie ma już drzwi od zamkniętego podwórza: Trasa Podziemna pod Starym Miastem nie liczy się jako ulica przed ścianą (G-197).
- Napad na przechodnia kończy się wygraną i nagrodą także wtedy, gdy napastnik został obalony albo zabity takedownem i jego ciało leży na ulicy; nagroda jest jedna, także po zapisie i wczytaniu (G-231).
- Posiłek ochrony powalony żywcem nie znika już, gdy gracz odejdzie kilkaset metrów: leży w świecie jak ciało posiłku, a licznik wezwanych posiłków zostaje (G-219).
- Wieża cerkwi św. Jozafata jest o ok. 2,7 m niższa, jak w numerycznym modelu pokrycia terenu (G-224).
- Dziewięć kościołów bez wysokości w OSM (m.in. cerkiew św. Jozafata, Bernardyni, Brygidki, św. Piotra, św. Mikołaja) ma okap i kalenicę z numerycznego modelu pokrycia terenu zamiast domyślnych 16 m ścian i sięga o 3–16 m niżej; wieża cerkwi św. Jozafata nie ginie już pod dachem nawy (G-216).
- Kaplica Trójcy na Zamku nie ma już zmyślonej przez renderer dzwonnicy z iglicą, więc najwyższym akcentem wzgórza zamkowego jest Donżon. Kościół Bernardynów stracił dwie wieże proceduralne w złym miejscu; jego prawdziwa wieża przy południowej ścianie wróci z G-214 (G-210).
- Posiłki ochrony, które już odeszły, nie wypychają z pamięci hacków urządzeń i strażników: po setkach hacków posiłków kamera zhakowana na początku dalej nie płaci XP drugi raz (G-209).
- Schody z Placu Zamkowego na Wzgórze Zamkowe mają ok. 10 m szerokości jak ich murki, a podesty łączą się z biegami bez trawy pomiędzy (G-203).
- Cerkiew św. Jozafata, kościół św. Mikołaja i Brygidki nie dostają już zmyślonej wieży obok prawdziwej z mapy, a renderer nie stawia wieży kościoła poza jego obrysem, np. na trawie u Karmelitów Bosych (G-212).
- Posiłki ochrony, które utknęły na sobie w heacie, po wczytaniu zapisu obchodzą się w tych samych krokach co w grze bez zapisu (G-208, zapis v27).

### 1 listopada 2026
- Decale w mieście: graffiti na ścianach bez okien, cokołach i ścianach szczytowych (Podzamcze, Nabrzeże, mniej na deptaku, bez Starego Miasta), tabliczki z numerami domów z mapy, wlepki na latarniach, sygnalizatorach, słupach trakcji i szafkach oraz kratki ściekowe przy krawężnikach i przejściach (ADR-0058 etap 6).
- Kaplica Trójcy i Donżon na Zamku mają wysokości z pomiaru NMPT GUGiK: niższy okap i wyższy, stromy dach kaplicy, korona wieży o ok. 1,7 m niżej (G-204).
- Quickhack wgrywany w posiłek ochrony w chwili zapisu po wczytaniu kończy się w tym samym posiłku albo jest przerwany (z połową RAM-u z powrotem), nigdy nie trafia w innego (G-194).
- Strażnicy, którzy gonili gracza, uspokajają się i zasypiają, gdy gracz jest daleko (najpóźniej po 30 s poza wczytanymi fragmentami miasta); nie stoją już w świecie do końca sesji, a zapis i wczytanie dają to samo co gra (G-188).
- Strażnik obok gracza nie znika już na jego oczach, gdy usypia się fragment miasta strażnika: ani gdy gracz stoi na terenie poza fragmentami miasta (np. na północ od Nabrzeża), ani gdy strażnik stoi przy graczu w innym wczytanym fragmencie; zasypia dopiero, gdy odejdzie od gracza dalej niż na 30 m, a zapis i wczytanie dają to samo co gra (G-201).
- Posiłki ochrony dają XP za quickhack, każdy raz, jak strażnik z kluczem; ten sam posiłek drugi raz nic, także po zapisie i wczytaniu, a posiłek kolejnego heatu znów płaci (G-202, zapis v26).
- Zapis w trakcie hakowania pod ostrzałem pamięta stan broni strażników i celowanie snajpera: po wczytaniu fala strzela wtedy, kiedy strzelałaby w grze bez zapisu (G-185, zapis v25).
- Drzwi na fasadach: budynki Lublina mają wejścia. Tam, gdzie mapa zna wejście, drzwi stoją w jego miejscu; pod szyldem każdego lokalu są drzwi sklepu (przy bankach pancerne, na kod), a kamienice od ulicy mają drzwi klatki. Drzwi stoją między oknami albo w miejscu całego okna czy witryny, nigdy w połowie okna, pod szyldem ani w bramie przejazdu. Skrzydła to modele z drugiej paczki użytkownika (CC-BY, na ekranie „Autorzy”); na telefonie są prostsze (ADR-0058 etap 9).
- Miejsce wykonanego i opłaconego zlecenia zostaje oczyszczone: ciała i ocaleni strażnicy znikają, gdy gracz odejdzie, i nie wracają aż do następnego zlecenia (G-195).
- Powalony, ale żywy posiłek ochrony nie znika po końcu heatu: leży (albo zostaje schowany) tam, gdzie był, także po zapisie i wczytaniu, i nie zajmuje miejsca następnego posiłku; do domu wracają tylko ci na nogach (G-196).
- Ciało zabitego posiłku ochrony (po powaleniu albo w trakcie obalenia) leży po wczytaniu tam, gdzie było, także niesione i schowane, i ochrona je znajduje jak przed zapisem (G-193).
- Neony DENKI, KARAOKE i SAKE na skośnych ścianach Rynku i Grodzkiej są wąskie i pionowe, przylegają do muru zamiast jednym końcem tkwić w ścianie, a drugim wisieć w powietrzu (G-160).
- Posiłki ochrony wezwane przy heacie zostają w świecie po wczytaniu, tam gdzie były, z tym samym zdrowiem i tym, co wiedzą o graczce, a następne przychodzą wtedy, kiedy przyszłyby bez zapisu: wczytanie nie usuwa już pościgu ani nie sprowadza od razu nowego posiłku w innym miejscu (G-179, zapis v23).
- Na Radziwiłłowskiej stoją trzy auta zamiast jednego: parkometr za krawężnikiem pasa postojowego nie wypycha już aut z zatok, a zatoka, w której wylosowane auto się nie mieści, dostaje krótszy model; w kilku innych pasach przybyło przez to po kilka aut (G-189).
- Auta w głębokich pasach postojowych bez oznaczenia stoją skośnie pod 60°, nosem do chodnika w stronę ruchu, jak na Krakowskim Przedmieściu i Radziwiłłowskiej (G-187).
- Strażnicy zleceń zakończonych porażką albo wykonanych zostają w świecie po wczytaniu, także gdy w trakcie walki przyjęto nowe zlecenie: zaalarmowani po nieudanej infiltracji walczą dalej, więc zapis nie pozwala już uciec z walki, a zabici nie wracają (G-178, zapis v22).
- Targ i budki z jedzeniem: przy straganach Targu na Ruskiej, Bazaru, Giełdy na Kresowej i pchlego targu na Placu Zamkowym stoją kartony na paletach, beczki, skrzynki z owocami i towar pod płótnem, na ladach leżą ramen, warzywa i napoje, a pod płachtami wiszą noreny; przed barami z fast foodem na Krakowskim i Podzamczu stoją budki yatai z ladą, stołkami, norenem i lampionami. Wszystko ma bryłę, a rozstawiają to reguły z danych mapy. Modele CC0 Kenneya są na ekranie „Autorzy” (ADR-0058 etap 3).
- Auta na pasach postojowych z mapy stoją przy krawężniku całą bryłą w obrysie, a na pasach z `orientation=perpendicular` i głębokich bez tagu w poprzek ulicy (G-177).
- Zapis i wczytanie w trakcie infiltracji nie zerują czujności strażników: kto zaczął dostrzegać Seki, po wczytaniu dalej ją dostrzega, a gra toczy się dalej tak samo jak bez wczytania (G-174, zapis v21).
- Latarnie ścienne Starego Miasta nie wiszą już w przejazdach Bramy Krakowskiej, Bramy Grodzkiej i Ku Farze, a latarnia z wylotu przejścia pod Wieżą Trynitarską przeszła na ścianę obok (G-173).
- Neonowe rurki pod gzymsem kończą się przed sąsiednim budynkiem, który wystaje przed ścianę, zamiast wchodzić w jego mur (G-170).
- Szkielety postaci znikają razem z nimi: każda nowa gra i każda postać spoza zasięgu nie zostawia już szkieletu w pamięci (G-184).
- Przechodnie z placów i alejek chodzą chodnikiem obok pasów postojowych, nie po nich (Kowalska, Świętoduska; G-177).
- Zaparkowane auta na pasach postojowych zmapowanych w OSM wzdłuż krawężnika (`parking=street_side`, `lane`), 17 aut więcej.
- Zaparkowane auta nie stoją na przystankach autobusowych ani 15 m przed i za słupkiem, jak każe art. 49 PoRD (G-156).
- Zaparkowane auta nie stoją przy krawężniku ulic o dwóch pasach i więcej w każdą stronę poza zmapowanymi parkingami, jak 3 Maja (G-155).
- Latarnie ścienne nie zasłaniają już tablic lokali: wiszą prostopadle do ściany i przesuwają się poza tablicę, a jedna bez miejsca wypada (G-158).
- Poziom trudności do wyboru przy nowej grze i w pauzie: Opowieść, Normalny, Trudny albo Własny z suwakami, zmiana w walce czeka do jej końca, a slot zapisu pokazuje poziom (ADR-0066 etap 2).
- Tablice lokali nie wchodzą już w sąsiedni budynek, który wystaje przed ścianę: przesuwają się, ściskają albo idą na inną ścianę (G-159).
- Poziom trudności zmieniony w walce („Zmieni się po walce”) przetrwa zapis i wczytanie gry i wejdzie po końcu walki (G-171, zapis v20).
- Banery, holo-reklamy i wysięgniki nie wchodzą już w sąsiednie budynki, które wystają przed ścianę: przesuwają się po niej, zwężają albo znikają (G-157).
- Zaparkowane auta nie stoją na samodzielnych ścieżkach pieszych, np. taksówki przy postoju na Podzamczu (G-143).
- Z ciałem na ramieniu menu postaci nie dobywa ani nie chowa broni (G-164).
- Grę można zainstalować na telefonie: ikona na ekranie głównym i start na pełnym ekranie w poziomie (bez trybu offline).
- Meble deptaka: wolnostojące bankomaty z OSM, hydranty nadziemne z OSM, donice z krzakami i kwiatami, rowery i skutery przy stojakach, wózki z jedzeniem przy Targu na Ruskiej i na Giełdzie na Kresowej, kontenery Tessen na Giełdzie; wszystkie z bryłą, z modeli CC0 i CC-BY na ekranie „Autorzy” (ADR-0058 etap 2).
- Ciała ogłuszonych i zabitych w obezwładnieniu można podnieść, przenieść i ukryć w kontenerze albo śmietniku, a zapis gry je pamięta (ADR-0065 etap 3).
- Podpowiedzi systemowe: zasady Breach w nakładce do pierwszego wyboru, pierwszy heat (zerwij kontakt wzrokowy i przeczekaj poszukiwania) i pierwsze przebranie (strażnicy przepuszczają, bieg, walka albo kręcenie się obok zdradzają).
- Pomniki i rzeźby z OSM mają kształt z tagów i z tabeli znanych pomników Lublina zamiast losowego z hasha: Koziołki jako Koziołki, figury jako postacie, pomniki wojenne i instalacje jako stela z tablicą, kapliczki jako kapliczki; murale, mozaiki, neon na fasadzie i Sztukmistrz na linie nie stoją już jako wolnostojące bryły (G-149).
- Domyślnie grafika High na każdym urządzeniu i liczby obrażeń przy każdym trafieniu (także dla starszych ustawień, jednorazowo); przycisk Ustawienia na ekranie tytułowym.
- Megabloki osaczają Lublin: rząd 41 megawież 309–520 m z kładkami i reklamami tuż za miastem, odcinek wokół Nabrzeża i pierścień prostszych megabloków za nimi, z dala od cmentarzy żydowskich, Ogrodu Saskiego i Bystrzycy, z otwartym widokiem z Placu Litewskiego na Wieżę Trynitarską i katedrę; na telefonie panorama jak dotąd, tylko wieże znad Zalewu stoją w Zemborzycach, z dala od rzeki (ADR-0067 etap 1).
- Prawdziwe lokale z OSM (332: sklepy, kawiarnie, bary, banki, apteki, kluby) mają szyld z neonową nazwą Lublina 2077 na swojej elewacji, w kolorze zbliżonym do prawdziwego (ADR-0064 etap 4).
- Przejazd Bramy Grodzkiej w osi obu frontów, nad łukiem trzy osie okien co 2 m i podświetlenie po obu stronach łuku (G-136).
- Blokada kursora nie wyłącza się na stałe, gdy panel zamknięty Esc przed pierwszym kliknięciem po ładowaniu poprosi o nią bez gestu (G-135).
- Świadek trzymany w chwycie obezwładnienia nie kończy telefonu do ochrony; gdy się wyrwie, dzwoni dalej (G-141).
- Widok nie obraca się sam przy wejściu do gry, gdy przeglądarka odmawia surowego wejścia myszy (Chromium na Linuksie) (G-139).
- Zaparkowane auta nie zastawiają wjazdów i wylotów dróg serwisowych, np. przy Cerkiewnej (G-140).
- Brama Grodzka z własnej geometrii według zdjęć: beżowy tynk, boniowanie, jedna kondygnacja dużych okien, od Grodzkiej kartusz z datą MDCCLXXXV, od Zamku okno półkoliste między blendami, stonowane podświetlenie od dołu (ADR-0062 etap 2).
- Obezwładnienie przy świadku to napaść z heatem; ogłuszonego znajduje i po 6 s budzi NPC, a ochrona i kamery wzywają wsparcie (ADR-0065 etap 2).
- Auta zaparkowane i jadące stoją na rysowanej nawierzchni, bez zapadania w bruk i bez odstawania na stoku; wrak przy Pedecie na deptaku (G-130).
- Automaty z napojami, biletomaty, kamery na masztach i lampiony nad straganami z modeli CC-BY, na ekranie „Autorzy” (ADR-0063, druga paczka).
- Gmachy publiczne z fasadą urzędu zamiast kamienicy (Urząd Miasta na Placu Litewskim, Kuratorium, Teatr Osterwy, Grodzka 5a); Ratusz bez zawyżonej połowy piętra (G-120, G-097, G-116).
- Małe wolnostojące pawilony bez wysokości w danych mają jedną kondygnację: Bar Centralny przy Pedecie (G-127, #103).
- Ekran ładowania z postępem przy nowej grze i wczytaniu (ADR-0057, #102).
- Obezwładnienie od tyłu: ogłuszenie albo zabicie, z podpowiedzią w HUD (ADR-0065 etap 1, #100).
- Import zapisu z pliku do osobnego slotu „Zaimportowany” (#99).
- Chodniki nie chowają się pod domyślnie szeroką jezdnią: 262 → 131 m (G-082, #98).
- Sklepienie bramy z `maxheight` w granicach 2,2–5 m (#96).

### 31 października 2026
- Menu pełnoekranowe (opcje w pauzie) przewija się na telefonie (#94).
- Panorama megawież na horyzoncie z modelu CC-BY (ADR-0063 etap 2, #93).
- Eksport zapisu do pliku z listy slotów (#91).
- Trasa Podziemna zaczyna się w drzwiach Trybunału (G-094, #90).
- Krakowskie Przedmieście poszerzone na południe: Teatr Osterwy, Bernardyni, Brygidki, III LO (G-052, #87).
- Pas ruchu liczony z szerokości odcinka, nie całej ulicy (G-090, #88); bramy na Królewskiej niższe według OSM (G-089, #89).
- Rozmiar napisów i pełne tło napisów w opcjach dostępności (#86).
- Auta nie wjeżdżają w siebie przy 3 Maja (G-075, #85).
- Komunikat dla gracza przy błędzie i utracie grafiki, z wersją do zgłoszenia (#84).
- Wyłączenie kołysania i wstrząsów kamery w opcjach dostępności (#82).
- Wersja gry i commit na ekranie tytułowym (#81).
- Przejazdy bramne z `tunnel=yes` otwarte, bez budynku podziemnego na Zamkowej (G-076, G-077, #80).
- Wnętrza lokali jako obszary, autozapis przy wejściu (ADR-0061 etap 1, #79).
- Dachy według OSM: dwuspadowe, mansardowe, kopuły, cebule (ADR-0064 etap 1, #78).
- Słupy z kablami, robopsy i ekran „Autorzy” z modelami CC-BY (ADR-0063 etap 1, #77).
- Brama Krakowska z własnej geometrii w wersji 2077 (ADR-0062 etap 1, #75).
- Stragany na targowiskach (#76), pawilon Bona (#74), klasztor bez wież kościoła (#72).
- Przejścia pod mostami na Podwalu i bulwarze, AI też je widzi (#70, #71).
- Nadbudowy przy zabytkach odsunięte o co najmniej 5 m (#60); kościoły bez zdublowanych wież (#69).
- Gra po angielsku, polski w opcjach: HUD, ekwipunek, sklepy, telefon, narracja (ADR-0056, #41–#68).
- Suwaki głośności muzyki, efektów i odgłosów miasta (ADR-0060 etap 1, #58).
- Autozapis i zapis przy ukryciu karty na telefonie (#56).
- Rekwizyty fasad z paczek CC0 (ADR-0058, #55).
- Rozwój postaci, etap 1: doświadczenie, poziomy, atrybuty (ADR-0059, #53).
- Dotyk: prawdziwy tap po przycisku pada nie ginie (#48); pierwszy ruch myszy nie obraca widoku (#49).
- Kaito od początku w Neon Koi; znacznik celu prowadzi do postaci (#43, #46).
- Słupki w rzędach z łańcuchami, kandelabry poza pasem aut (#45, #51).

### 30 października 2026
- Pionowy Lublin 2077: nadbudowy, latarnie ścienne (ADR-0051, #18).
- Oznakowanie poziome w neonie, zebry, tłum placów poza jezdnią (#22, #23).
- Ruch aut: jednokierunkowe, zawrotki, parkowanie na jezdni, bez przejazdów przez hale targu (#24, #25, #31, #34, #36–#38).
- Meble ulic na chodnikach, bramy kamienic z mapy, stragany jako bryły, mosty z pomostami (#26–#28, #32, #35).
- Seria poprawek mapy: myjnia, wieża Trynitarska, fontanny, poświata przez mury, dachy w dali (#19–#21).
