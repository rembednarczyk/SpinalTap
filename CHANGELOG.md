# Dziennik zmian

Zmiany widoczne dla gracza, od najnowszych. Wersja gry i commit są na ekranie tytułowym (#81); przy zgłoszeniu błędu podaj je razem z datą. Każdy PR z funkcją albo poprawką widoczną w grze dodaje własny plik w `changelog.d/` (zasady w `changelog.d/README.md`); `pnpm changelog` przenosi wpisy tutaj, do sekcji „Nieopublikowane”.

## Nieopublikowane (0.1.0)

### 1 listopada 2026
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
