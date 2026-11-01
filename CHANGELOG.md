# Dziennik zmian

Zmiany widoczne dla gracza, od najnowszych. Wersja gry i commit są na ekranie tytułowym (#81); przy zgłoszeniu błędu podaj je razem z datą. Każdy PR z funkcją albo poprawką widoczną w grze dopisuje tu jedną linię w sekcji „Nieopublikowane”.

## Nieopublikowane (0.1.0)

### 1 listopada 2026
- Megabloki osaczają Lublin: rząd 50 megawież 305–520 m z kładkami i reklamami tuż za miastem, odcinek wokół Nabrzeża i pierścień prostszych megabloków za nimi; na telefonie panorama bez zmian (ADR-0067 etap 1).
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
