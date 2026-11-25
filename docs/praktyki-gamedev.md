# Dobre praktyki tworzenia gier

Zasady, wytyczne i sposób pracy zebrane z trzech projektów: **SpinalTap** (Seki Senshi / Lublin 2077, otwarty świat,
Babylon.js), **PodRcr** (wyścigi podów, Three.js) i **Broadside** (gra morska, Babylon.js). Wszystkie trzy to gry
przeglądarkowe w TypeScript z wersją na Androida, rozwijane przez właściciela razem z agentami Claude w sesjach
w chmurze. Stan na 25.11.2026.

Dokument nie wybiera silnika, języka ani biblioteki. Każdy punkt opisuje praktykę, która sprawdziła się albo zawiodła
w co najmniej jednym z tych projektów. Konkretne narzędzia (Babylon, Vitest, Playwright, Capacitor) pojawiają się
tylko jako przykłady.

## Jak czytać

- **Zasada**: obowiązuje zawsze, bo jej złamanie kosztowało w praktyce dużo czasu albo jakości.
- **Wytyczna**: domyślny wybór. Odstępstwo jest w porządku, jeśli ma zapisany powód.
- Pod punktem jest krótko, skąd się wziął: incydent, pomiar albo decyzja. Skrót mówi, z którego projektu:
  **[ST]** SpinalTap, **[PR]** PodRcr, **[BS]** Broadside.
- Liczby (500 linii, 4 agentów, +40% budżetu) to wartości dobrane w tych projektach. W nowym projekcie dobierz własne,
  ale zostaw mechanizm.

Spis treści:
1. [Fundament: wzorce i standardy](#1-fundament-wzorce-i-standardy)
2. [Architektura](#2-architektura)
3. [Determinizm i symulacja](#3-determinizm-i-symulacja)
4. [Testy](#4-testy)
5. [Audyty i pomiary rozgrywki](#5-audyty-i-pomiary-rozgrywki)
6. [Zapadki i skany](#6-zapadki-i-skany)
7. [Wydajność](#7-wydajność)
8. [Weryfikacja wizualna](#8-weryfikacja-wizualna)
9. [Świat, lokacje i poziomy](#9-świat-lokacje-i-poziomy)
10. [Projekt rozgrywki i AI](#10-projekt-rozgrywki-i-ai)
11. [Assety i licencje](#11-assety-i-licencje)
12. [UI, wejście, języki i urządzenia mobilne](#12-ui-wejście-języki-i-urządzenia-mobilne)
13. [Audio](#13-audio)
14. [Praca z agentami AI](#14-praca-z-agentami-ai)
15. [Ciągłość pracy w sesjach bez pamięci](#15-ciągłość-pracy-w-sesjach-bez-pamięci)
16. [Zmiany, CI i git](#16-zmiany-ci-i-git)
17. [Proces błędów](#17-proces-błędów)
18. [Dokumentacja i decyzje](#18-dokumentacja-i-decyzje)
19. [Współpraca z właścicielem](#19-współpraca-z-właścicielem)
20. [Co wdrażać na jakim etapie](#20-co-wdrażać-na-jakim-etapie)
21. [Antywzorce](#21-antywzorce)

---

## 1. Fundament: wzorce i standardy

**Zasada. Każde rozwiązanie opiera się na nazwanym, istniejącym wzorcu albo standardzie.** Zanim powstanie własny
pomysł, szukamy gotowego: GoF, „Game Programming Patterns”, ECS, prace naukowe dla fizyki i grafiki, wykłady GDC,
standardy branżowe (GIS, normy budowlane, Unity CanvasScaler). Komentarz modułu, brief dla agenta i ADR podają
wzorzec, źródło i listę różnic z powodem. Jeśli wzorca nie ma, piszą to wprost.
- [BS] Linia bojowa „za punktem za rufą poprzednika” (Reynolds) trzymała szyk przez 26% czasu walki, line-of-sight
  guidance (Fossen 2011) przez 59%. Pierwszy pomysł z intuicji zwykle przegrywa ze wzorcem.
- [ST] Własne operacje na wielokątach dawały samoprzecięcia w 30 obrysach i 29 702 próbki szczelin przy
  krawężnikach. Przejście na Clipper2 (algorytm Vatti) usunęło całą klasę błędów.

**Wytyczna. Okrojenie wzorca zapisuj jako wybór.** Worley w 8 komórkach zamiast 27, XPBD bez kolizji własnych,
reżyser populacji bez krzywej intensywności [BS]. Następna sesja wie wtedy, co jest długiem, a co świadomą decyzją.

**Wytyczna. Wiedzę z dziedziny gry traktuj jako źródło reguł i balansu.** Doktryny flot, kapitulacja przy stracie
ok. 1/3 załogi, czas brasowania [BS]; statyka konstrukcji i hydraulika wodospadów [PR]; normy schodów i wind [ST].
Liczby z rzeczywistości łatwo obronić i łatwo sprawdzić.

**Wytyczna. Jeden algorytm ma jedną implementację.** [ST] Przegląd znalazł sześć siatek kubełkowych i kilka kopii
generatora losowego. Zostały po jednym `SpatialHash<T>`, RNG i `LruMap`.

## 2. Architektura

**Zasada. Logika gry działa bez renderera i bez DOM.** Domena (reguły, fizyka, AI, zapis) jest czystym kodem, który
uruchamia się w teście w Node. Silnik graficzny, dźwięk, wejście i zapis są za portami (interfejsami), a korzeń
kompozycji składa całość.
- [PR] Cały wyścig rozgrywa się w Vitest w kilka sekund, a na tym stoją wszystkie pomiary rozgrywki.
- [ST] 27 z 33 testów przeglądarkowych dało się przenieść do testów sesji z fałszywym rendererem.

**Zasada. Kierunek zależności pilnuje narzędzie w CI.** Reguły typu „domena nie importuje niczego”, „symulacja tylko
domenę”, „UI nie zna silnika ani symulacji”, „bez cykli” sprawdza narzędzie (u nas dependency-cruiser). [ST] Audyt
po kilku tygodniach uznał granice za czyste, bo od pierwszego dnia miały strażnika.

**Wytyczna. Silnik graficzny importuje jeden moduł.** Reszta kodu korzysta z re-eksportów. Wymiana wersji albo silnika
dotyczy jednego pliku, a importy punktowe zmniejszyły paczkę z 7,4 do 1,9 MB [ST].

**Wytyczna. Wybór silnika wynika z pomiaru, nie z rankingu.** [BS] Natywny silnik odrzucono, bo poprzedni projekt
zmierzył, że telefon ogranicza wypełnianie pikseli, czego natywna wersja nie zmienia.

**Zasada. Do symulacji wchodzi się tylko komendami.** Gracz, AI, autopilot i testy wydają te same komendy. Tryby
sterowania różnią się tylko warstwą wejścia, a powtórkę przebiegu opisuje „ziarno + log komend” [BS]. Rozdzielnik
komend to tabela handlerów z typem wymuszającym komplet, zamiast rosnącego `switch` [ST].

**Wytyczna. Gracz i AI używają tego samego interfejsu wejścia i tej samej fizyki.** [PR] Dotyk, klawiatura, pad
i kierowca komputerowy implementują jedno źródło wejścia. Nowe sterowanie to nowa klasa, a reszta działa bez zmian.

**Zasada. Symulacja emituje zdarzenia, prezentacja ich słucha.** Render, dźwięk, HUD i wibracje reagują na zdarzenia.
Dzięki temu narzędzie zrzutów może wstrzyknąć zdarzenie i pokazać sam efekt [PR].

**Zasada. Dane w tabelach, zachowanie w systemach (Type Object).** Klasy pojazdów, amunicja, trasy, planety, skład
rywali, dźwięki to dane. Balans to edycja tabeli, a testy czytają te same liczby. [PR] Warunki `planet === 'tatooine'`
w kodzie dźwięku zamieniono na cechy biomu, bo każda nowa planeta wymagała zmian w logice.

**Zasada. Jedno źródło prawdy dla wszystkiego, co widzi gracz i liczy symulacja.** Kształt kadłuba daje próbki wyporu
i siatkę. Fale liczy symulacja i shader z tych samych parametrów. Teren, układ fortu, rzeźba piasku i położenie wody
to po jednej funkcji dla fizyki, rendera, dźwięku i mapy.
- [ST] Renderer i symulacja liczyły ziemię osobno: testy przechodziły, a gracz chodził w powietrzu pod wiaduktem
  (24 z 63 przejść).
- [PR] Dźwięk wodospadu był metr od skały, a las omijał brzeg o wpisane na sztywno ±80 m.
- [BS] Gdy układ fortu siedział w silniku, trafienia rozjeżdżały się z murami. Przeniesiono go do domeny.

**Wytyczna. Widok może być bogatszy od symulacji, jeśli tylko czyta jej stan.** Ugięcie masztów, tkanina żagli,
lecące deski, dryf silników na linkach to sama prezentacja. Sterowanie zostaje przewidywalne, a złoty hash stoi
[BS, PR].

**Wytyczna. Opcje „gry” da się wyłączyć dla testów.** Reżyser ruchu, pora dnia, populacja mają flagi. Nowy system
nie psuje wtedy testów reguł ani złotego hasha [BS].

**Zasada. Limity rozmiaru z bramką.** Wartości u nas: plik do 500 linii, funkcja i komponent do 120, klasa do
20 metod. Limit pliku i funkcji pilnuje linter, liczbę metod test z bazą, która tylko spada (zob. §6).
- [ST] Limit „ok. 20 metod” bez strażnika przekroczyło 9 klas, w tym fasada renderera z 42 metodami.
- [PR] Próg był tylko raportem i konstruktor sesji wyścigu trzy razy wracał „z powrotem w limicie”.

**Wytyczna. Nowa funkcja dostaje własny kontroler, prezenter i wycinek stanu.** Unikamy dopisywania pola do sesji,
metody do fasady renderera i intencji do wspólnego interfejsu UI. UI dostaje wąskie interfejsy intencji, a renderer
jest fasadą z częściami [ST]. Części sesji implementują wspólny interfejs słuchacza z wąskimi zależnościami, więc
mają testy bez DOM i dźwięku [PR].

**Wytyczna. Mierz odpowiedzialność, a nie tylko liczbę pól.** Encja ECS z 41 opcjonalnymi komponentami jest
w porządku, bo systemy biorą tylko swoje [ST]. Tabel danych, shaderów i niedawno podzielonych klas nie dzielimy dla
samej metryki [PR].

**Wytyczna. Bez ukrytych globalnych singletonów.** [PR] Globalny biom sprawił, że przelot w menu miał piasek ostatnio
odwiedzonej planety. Ustawienia i kontekst są wstrzykiwane.

**Wytyczna. Biblioteka z branży ma pierwszeństwo przed domową geometrią, fizyką czy parserem.** Migracja na
bibliotekę idzie etapami, każdy z pomiarem, a koszt (u nas generator +20%) trafia do długu z warunkiem zdjęcia [ST].

**Wytyczna. Własna, prosta fizyka w grze zręcznościowej.** Gdy testy mają rozgrywać całe wyścigi i bitwy w Node,
deterministyczna fizyka własna jest tańsza i testowalna (u nas ok. 40 µs na krok dla 4 pojazdów) [PR, BS]. Silnik
fizyki może służyć prezentacji, np. pickingowi kamery [ST].

## 3. Determinizm i symulacja

**Zasada. Stały krok symulacji z interpolacją renderu** (Fiedler, „Fix Your Timestep!”). Fizyka nie zależy od
odświeżania ekranu ani ogranicznika klatek [PR, BS].

**Zasada. Losowość i czas w domenie tylko przez porty, a zakaz pilnuje linter.** W domenie bez `Math.random`,
`Date.now`, `performance.now` i bez `any`. Generator z ziarnem, osobne strumienie dla niezależnych warstw.
[PR] Nowa warstwa treści dostała własny strumień, żeby nie przetasować rozmieszczenia reszty świata.

**Zasada. Iteracja w kolejności identyfikatorów tam, gdzie wynik zależy od kolejności.** Kolejność systemów ECS
w jednej jawnej tablicy. Remisy (np. w A*) rozstrzyga numer komórki [BS, ST].

**Wytyczna. Nowe byty dopisuj na koniec, z osobną pulą identyfikatorów.** [ST] Neon jako nowy byt przesunąłby
identyfikatory kolejnych dzielnic i zepsuł zapisy. Nowe pokoje dostały osobną bazę id.

**Zasada. Złoty hash determinizmu liczony na małym, stałym scenariuszu i aktualizowany tylko ręcznie.** Scenariusz to
mała podłoga testowa z każdym rodzajem elementu, poza treścią świata. Commit zmieniający hash nazywa regułę, która go
zmieniła. Automat może przeliczać inne skróty, ten hash nigdy.
- [ST] Hash liczony na całym mieście zmieniał się w każdym PR mapy, dwa takie PR-y zawsze kolidowały, a komentarz nad
  asercją urósł do ok. 60 linii historii.
- [BS] Dwa statki i minuta żeglugi: hash zmienia się rzadko i każda zmiana coś znaczy. Nowych systemów pilnują audyty.

**Wytyczna. Stały hash nie dowodzi, że zachowanie się nie zmieniło.** [ST] Zmianę sterowania AI porównano z main
w siatce punktów i kierunków, bo podłoga testowa nie ma długich objazdów.

**Wytyczna. Stan, który da się policzyć z ziarna, nie trafia do zapisu.** Oferta zleceń to funkcja ziarna, portu
i epoki, zapisywane jest tylko przyjęte zlecenie [BS].

**Zasada. Zmiana schematu zapisu to wersja, migracja i test, także przy przenoszeniu treści.** [ST] Przeniesienie
targu do innego budynku dostało migrację, która budzi gracza w nowym miejscu i przenosi skrytki. [BS] Migracja
świata przenosi statki na najbliższą wodę i zachowuje złoto i reputację.

**Wytyczna. Narzędzia diagnostyczne zapisują stan tą samą drogą co gra.** [ST] Sondy zapisywały inną ścieżką niż
kontroler zapisu, co dało fałszywe rozjazdy i dwa odrzucone zgłoszenia.

**Wytyczna. Zdarzenie fizyczne liczone raz na styk.** [PR] Obrażenia przy lądowaniu liczone co krok mnożyły
uszkodzenia. Teraz raz na początku styku i z oknem 0,4 s.

**Wytyczna. LOD fizyki po odległości.** [BS] Statki dalej niż kilkaset metrów od gracza pływają na zgrubnych próbkach
wyporu: krok symulacji spadł z ok. 1,2 do ok. 0,7 ms.

**Wytyczna. Najpierw zmierz, potem zmieniaj fizykę.** [BS] Zgłoszony „dryf bez żagli” okazał się wytracaniem pędu
zgodnym z epoką. Fizyka została, dodano wcześniejsze zwijanie żagli i kotwicę.

**Wytyczna. Gdy realna fizyka daje złą grę, wspomaganie jest osobną, nazwaną regułą.** [BS] Żaglowiec pod wiatr był
bez szans. Zamiast luzować model doszły tryby „Akcja” i „Fun” dla gracza na życzenie, a AI pływa po staremu.
Wzmocnienie efektu dla czytelności (odrzut salwy ×3) jest nazwane i pilnowane testem zakresu.

**Wytyczna. Fizykę wprowadzaj częściami, każdą z audytem.** [BS] Pełny opór Morisona rozbił autopilota i dwa audyty,
więc weszła tylko składowa pionowa.

**Wytyczna. Konstrukcje otoczenia projektuj ze statyki, deterministycznie, z testem na całej treści.** [PR] Wzory na
wspornik, łuk (warunek Heymana) i naciąg liny w module bez silnika, wymiary liczone w kodzie, test sprawdza każdą
konstrukcję na każdej trasie. Audyt znalazł nawis z naprężeniem ok. 11 MPa przy wytrzymałości ok. 1 MPa i most
linowy wymagający lin niosących setki MN.

**Wytyczna. Parametry z prawdziwego źródła, ściśnięte do grywalnego zakresu.** [PR] Osiągi rywali z tabeli
oryginalnej gry, ściśnięte do ±15%, żeby nikt nie odjeżdżał. Bryły kolizyjne generowane z modeli: wcześniej rywale
dziedziczyli kadłub gracza i najszersze pody były najszybsze.

## 4. Testy

**Zasada. Logikę i UI sprawdzają testy bez przeglądarki.** Testy sesji z fałszywym rendererem i testy komponentów.
Przeglądarka służy do tego, czego inaczej sprawdzić się nie da: rozruch, rysowanie (migawki, budżety), modele,
układ HUD na telefonie, dotyk.
- [ST] 227 przebiegów e2e zajęło ok. 35 godzin. Prawdziwe błędy znalazły dwa, resztę czerwieni dało środowisko:
  257 przekroczeń czasu, 181 awarii przeglądarki, 138 budżetów klatki, 74 konflikty portów.

**Zasada. Testy krokują symulację i czekają na stan gry, zegar ich nie obchodzi.** `freeze` + `step`. [ST] Błąd
speca przy zamrożonym zegarze pokazał w siatce wariantów złą pozę i decyzje o chwycie broni zapadły na złych zrzutach.

**Zasada. Test całej rozgrywki jako bramka zmian fizyki, AI i poziomów.** [PR] Wyścig AI z autopilotem gracza: wszyscy
kończą w limicie, najwyżej 2 rozbicia. Trasa, której AI nie przejedzie, nie przejdzie testu.

**Wytyczna. Test niezmienników z losowym kierowcą.** [PR] „Kierowca-chuligan” co 0,3–1,5 s gwałtownie zmienia wejście,
a test sprawdza skończone wartości, postęp i determinizm. To tani fuzzing fizyki.

**Zasada. Dowód poprawki: test pada bez niej i przechodzi z nią.** Sprawdzamy podmianą pliku na wersję sprzed
poprawki. Kontrola nie może zależeć od pola dodanego przez poprawkę, bo wtedy bez niej nie padnie [ST].

**Zasada. Kontrola liczy niezależnie od poprawki.** Kontrola karmiona tymi samymi liczbami co poprawka dowodzi tylko
rachunku. Kontrola, która kopiuje logikę renderera po swojemu, daje zielony skan przy niezmienionym obrazie. Test
przypina wspólną funkcję, a weryfikator mutuje każdy warunek kontroli osobno [ST].

**Wytyczna. Kryterium sprawdzaj sondą bezpośrednią.** [ST] „Nie widać pojawiania się dronów” sprawdza linia wzroku
z ulic. Kontrola reguły pośredniej dawała zero błędów, a drony pojawiały się 17 m od przechodnia.

**Zasada. Test reguły projektowej obejmuje całą treść gry.** Każda konstrukcja na każdej trasie, rytm wydarzeń przy
trasie, najwęższy przejazd szerszy niż 1,5 × dwa najszersze pojazdy [PR].

**Zasada. Każdy zgłoszony błąd dostaje test regresji.** [PR] Model, z którego optymalizator usunął pustą grupę, nie
wczytywał się: teraz test wczytuje każdy model. [BS] Ląd, który w ogóle się nie rysował przez odwrócone trójkąty,
pilnuje test normalnych.

**Zasada. Refaktor bez zmiany zachowania dowodzi się odciskiem** (testy charakteryzujące, Feathers). Przed podziałem
nagrywa się odcisk: pełne wyścigi AI, graf Web Audio, DOM okien po serii kliknięć, GLB bajt w bajt, ślad siatek
i materiałów. Po podziale odcisk ma być identyczny [PR, ST].

**Wytyczna. Zaczepy testowe tylko w buildzie deweloperskim.** [PR] `finish()` kończy wyścig, żeby test przeszedł cały
turniej, którego renderer programowy nie przejedzie w rozsądnym czasie.

**Zasada. Podniesienie limitu czasu albo budżetu nie jest poprawką.** Najpierw przyczyna: ślad, nagranie, pomiar.
Wyjątek wymaga uzasadnienia w commicie i wpisu na listę długu z warunkiem zdjęcia („do usunięcia, gdy…”).
- [ST] Limity rosły z 90 do 180 s, budżet wywołań z 400 do 520, a pętla tylko się wydłużała.
- [BS] Planer przebił budżet 2 ms. Zamiast podnosić próg: krata z pamięcią i widoczność po siatce, 1,6–1,9 ms.

**Wytyczna. Wolny test dostaje szybszą konstrukcję.** Mała podłoga z barier zamiast mapy miasta: z 71 nadpisanych
limitów zostało 11 [ST]. Kosztowne struktury trzymaj w pamięci procesu z kluczem z treści, ale najpierw profil:
okazało się, że 55–70% czasu to rastry nawigacji, a świat <0,4 s [ST].

**Wytyczna. Bramka czasu testów: twarde progi procentowe, wzrost wobec main tylko jako raport.** [ST] Bramka „+30%
wobec mediany main” zatrzymywała niewinne PR-y, bo ten sam test na współdzielonym runnerze waha się o 30–150%. Zostały
progi: nowy test do 50% limitu, każdy do 75%. Spowolnienie ma złapać PR, który je wprowadził.

**Wytyczna. Pomiar czasu w izolacji i jako najlepszy z N prób.** [BS] Ten sam krok trwał 2,3–2,6 ms przy równoległym
budowaniu i 1,0–1,5 ms osobno.

**Wytyczna. Pułapki uruchamiania.**
- Testy uruchamiaj z konfiguracją główną. W katalogu pakietu runner może nie czytać jej i mieć inny limit czasu,
  co dało fałszywe zgłoszenia [ST].
- Narzędzia, które dokładają pliki tymczasowe do drzewa, nie biegną równolegle z testami [ST].
- Testy narzędzi spoza pakietów (np. strażnik god objectów) łatwo pominąć: wymieniaj je w briefie [ST].
- Kontrole przed commitem łańcuchem `&&`. [PR] `set -e` w powłoce narzędzia nie zatrzymał commitu z błędem typów.
- Czas `beforeAll` oddzielnie od pierwszego testu, inaczej leniwy generator dolicza się do testu [ST].

## 5. Audyty i pomiary rozgrywki

**Zasada. Pomiar z raportem liczbowym jest osobnym narzędziem obok testów z asercją.** Audyty w osobnej konfiguracji
wypisują tabele: kontakty w wyścigu AI, szerokości tras co 2 m, macierz uderzeń, czasy oblężeń [PR]. Pomiar, który
ma pilnować wyniku na stałe, przenosi się do testów z asercją.

**Zasada. Zawsze przed i po, w tym samym wywołaniu i z tym samym składem.** Symulacja jest deterministyczna, więc
różnica to skutek zmiany. Drobna zmiana fizyki potrafi przestawić cały przebieg, więc przy wątpliwości sprawdź drugi
skład [PR].

**Wytyczna. Audyt balansu jako bramka.** [BS] Bitwy AI kontra AI (≥50% rozstrzygniętych, silniejszy nie przegrywa),
soak 20 min (bez NaN, najgorszy krok ≤2 ms), czasy oblężeń. Przekroczenie to błąd albo świadoma zmiana ADR.

**Wytyczna. Pierwszy audyt zwykle pokazuje, że gra nie działa.** [BS] 18 remisów na 18 bitew. Po zmianach obrażeń,
dystansu i łuku dział 12 z 18 rozstrzygniętych. Kilka ręcznych partii by tego nie pokazało.

**Zasada. Próg audytu zmienia się według jego intencji, nie według wyniku.** [BS] Audyt wymagał opłaconego zlecenia,
które wcześniej wygrywał przypadek. Nowy próg opisuje intencję („co najmniej jedno wzięte, żadne niezakończone”).
Asymetria wynikająca z projektu (doktryny narodowe) zmieniła bramkę z wpisem w ADR.

**Wytyczna. Metryka nieosiągalna zostaje raportem, bramką jest metryka rozgrywki** [BS].

**Wytyczna. Audyt autopilota sprawdza, czy w grę da się grać.** [BS] AI dopływa do portu, bierze zlecenie, dostaje
zapłatę. Wykrył porty na mieliźnie i statek, który bez kotwicy odpływał spod portu.

**Wytyczna. Soak wykrywa zablokowaną grę.** [BS] Po zatonięciu gracza gra stała w miejscu. Wyjście wzięte z gatunku:
ratunek kapitana do portu.

**Wytyczna. Beta-testerzy jako agenci z różnymi profilami.** [BS] Nowicjusz na telefonie po angielsku, weteran na
monitorze po polsku, gracz zręcznościowy. Znaleźli kilkadziesiąt konkretnych błędów: dotyk 1,5 raza za daleko przy
DPR 2, podwójny abordaż, ucięte polskie etykiety, bierny gracz tracący okręt w 4–7 min. Poprawka z beta-testu, która
łamie bramkę balansu, wraca.

**Wytyczna. Pomiar z wielu kamer zamiast oglądania.** [PR] Bufor identyfikatorów z kamer co 12 m trasy wykazał, że
440 z 807 kamieni leży w całości pod piaskiem. [ST] Światło 60-30-10 liczone skryptem ze zrzutu (zob. §9).

## 6. Zapadki i skany

**Zasada. Każdy policzalny rodzaj błędu albo długu dostaje kontrolę z bazą, która tylko spada.** Wzrost to czerwony
test, spadek obniża bazę w tym samym commicie. Dodanie do bazy tylko jawne, z uzasadnieniem w commicie.
- [ST] Skan całego świata w ok. 4 s pilnuje 62 rodzajów glitchy (trasy przez budynki, meble w ścianach, mosty bez
  pomostu).
- Ta sama mechanika dla god objectów (start 9 klas, dziś 0), literałów poza katalogami i18n (dziś 0), kart pomieszczeń.

**Zasada. Baza zapisuje miejsca, a nie samą liczbę.** [ST] Przy bazie liczbowej nowy błąd chował się za poprawką
innego, bo suma spadała. Baza to lista kluczy (rodzaj, fragment mapy, zaokrąglone współrzędne). Narzędzie `diff`
pokazuje przybyłe i ubyłe.

**Wytyczna. Klucz miejsca odporny na drobne przesunięcia.** Rodzaje próbkowane co metr kluczowane kwadratem 10 m,
bo poprawka przesuwająca pas o centymetry przestawiała każdą próbkę [ST].

**Wytyczna. Zapadka powstaje w PR, który naprawia pierwszy egzemplarz.** Uwaga recenzenta powtórzona drugi raz staje
się kontrolą [ST].

**Wytyczna. Fałszywy alarm naprawia się w kontroli.** Weryfikator najpierw sprawdza na zrzucie i w danych, czy
trafienie jest prawdziwe [ST].

**Wytyczna. Lista kontrolna jako blokada końca pracy.** [ST] Dodanie fragmentu mapy prowadzi skrypt weryfikacji
z hookiem, który nie pozwala agentowi skończyć tury, dopóki zostały nierozstrzygnięte punkty. Każdy punkt ma pole
„skąd” (błąd, który go nauczył). Raport jest ważny tylko dla commita, przy którym powstał.

**Antywzorzec: próg jako sam raport.** Wszystko, co ma się nie pogarszać, potrzebuje czerwonego testu [PR].

## 7. Wydajność

**Zasada. Budżety wynikają z urządzenia docelowego.** Wybierz urządzenie odniesienia i scenę dla słabszych. [ST]
Budżety „kilka procent nad obecnym” podnoszono wyjątkami cztery razy. Po wyborze telefonu odniesienia budżety
dostały +40% i jasną zasadę, że zmiany rysowania nadal podają pomiar przed i po.

**Zasada. Bramką są liczby deterministyczne: wywołania rysowania i aktywne siatki.** Czas klatki pod rendererem
programowym (SwiftShader) mierzy runner, więc jest raportem. Pomiar prawdziwy robi się ręcznie na urządzeniu [ST].
Pod rendererem programowym miarodajne są udziały części w klatce, a milisekundy tylko orientacyjne [BS].

**Zasada. Najpierw profil, potem optymalizacja.**
- [ST] Na telefonie ok. 80% kosztu klatki zależało od liczby pikseli. Suwak rozdzielczości renderu z domyślnym 70%
  rozwiązał problem bez cięcia geometrii, co właściciel potwierdził na APK.
- [PR] Klatka miała ok. 4 mln trójkątów, drobne odłamki leżały w jednej siatce na całą trasę. Po podziale na komórki
  i gaszeniu małych obiektów: 1,2–1,6 mln.
- [PR] Refaktor klas nie przyspiesza klatek: symulacja kosztowała 0,75 ms, reszta to GPU. Zmierz przed obietnicą.

**Wytyczna. Rozbij koszt klatki na udziały, wyłączając części po kolei** (rozgrzewka po przełączeniu, odczyt piksela,
żeby praca GPU weszła w pomiar). [BS] Niebo zajmowało 53% klatki, choć zakładano, że ocean. Narzędzie pomiaru też
miało błędy (fałszywe oszczędności, mediana zamiast średniej): waliduj je.

**Wytyczna. Wymiary podziału dobieraj pomiarem.** Kawałki siatki 400 m dały te same trójkąty co 250 m przy połowie
dodatkowych wywołań [PR]. Ocean w 4×4 kaflach, bo 6×6 dawało mało przy 2–4 razy więcej wywołań [BS]. Scalanie potrafi
zaszkodzić: ląd w jednej siatce rysował się zawsze w całości, siatka na wyspę z odrzucaniem dała 1,8 → 0,76 mln
trójkątów [BS].

**Wytyczna. Typowe zyski, każdy osobno z pomiarem:**
- miękkie efekty (niebo, chmury, wolumetria) w 35–50% rozdzielczości: koszt nieba −75% [BS];
- amortyzacja czasowa: tło odświeżane co drugą klatkę przy nieruchomej kamerze [BS];
- gęstość pikseli ograniczona do 2, wyostrzenie poniżej 95% skali [BS];
- LOD i frustum na wszystkim, co drogie; gaszenie obiektów mniejszych niż ok. 4 px [PR, BS];
- LOD detalu według gęstości na ekranie (`fwidth`) zamiast odległości: piasek widziany z wysokości skoku przestał
  „wyskakiwać” po lądowaniu [PR, BS];
- pomijanie obliczeń o zerowej wadze [BS];
- detal w istniejących siatkach (instancje, wypieki) zamiast nowych wywołań [ST];
- na telefonach z GPU kafelkowym każdy przebieg pełnoekranowy jest drogi: łańcuch pięciu przebiegów scalony w jeden [PR].

**Zasada. Optymalizacja wchodzi, gdy zrzut przed i po przy zamrożonej symulacji nie pokazuje różnicy** [BS].

**Zasada. Każda opcja jakości ma zrzut z nią i bez niej.** [BS] Wygładzanie na „ultra” istniało tylko w ustawieniach,
dopóki zrzut A/B tego nie pokazał.

**Wytyczna. Kompiluj shadery i wysyłaj tekstury przed startem, do tego samego celu renderu co gra.** [PR] Kompilacja
szła na płótno, a gra rysuje do bufora efektów, więc przy wjeździe do tunelu kompilowało się ok. 30 programów naraz.

**Wytyczna. Stała liczba świateł i obiektów w scenie, zmienia się natężenie albo zakres.** Zmiana liczby świateł
wymusza rekompilację. Obiekt pojawiający się w trakcie gry stoi w scenie od początku [PR].

**Wytyczna. Automatyczna rozdzielczość z histerezą.** [PR] Powrót na gęstość, z której już zeszła, wymaga coraz więcej
dobrych okien (4, 8, 16… s). W symulacji 7 zmian zamiast ok. 40. Logika testowana bez GPU. Narzędzia pomiarowe ją
wyłączają [BS].

**Wytyczna. Ogranicznik klatek domyślnie na telefonie.** Na ekranach 90–144 Hz gra grzała telefon, a automatyczna
rozdzielczość brała nadwyżkę za zapas [PR].

**Wytyczna. Bez alokacji w pętli klatki.** Obiekty budowane raz, sortowanie raz na krok. Recenzent ma to na liście [PR].

**Wytyczna. Reguła liczona dla całego świata ma pomiar czasu generatora przed i po** (u nas cel ≤ +15%) i indeks
przestrzenny [ST]. **Zmiana AI mierzona w najgorszym przypadku z kilkoma agentami naraz**: krok trwał 100 ms przy
budżecie 4 ms, choć własne testy przechodziły [ST].

**Wytyczna. Pułapki cullingu.** Warstwa grupy nie ukrywa dzieci, a odległość od sfery z kamerą w środku wychodzi
ujemna. Test jednostkowy dla kamery wewnątrz obiektu [PR].

**Wytyczna. Koszt wydawaj tam, gdzie gracz go widzi** [ST]. **Budżet wywołań jest kryterium decyzji o treści**: element
za +23% wywołań, który do tego wyglądał źle, został cofnięty [BS].

## 8. Weryfikacja wizualna

**Zasada. Strona testowa stawia scenę w dowolnym miejscu i stanie.** Parametry adresu: poziom, pozycja, widok,
przeciwnicy, „przejedź N s z AI”, pora dnia, zamrożenie. Zrzuty robi Playwright z rendererem programowym bez GPU
[PR, BS].

**Zasada. Zrzuty są powtarzalne:** zamrożona symulacja, przypięta kamera, ziarno, czas cząstek z kroku gry. Bez
`Math.random` także w widoku [BS].

**Zasada. Przed i po z tych samych parametrów, ocena z obrazu.** Autor otwiera swoje zrzuty i opisuje, co widzi.
Zrzuty trzymamy poza repo [PR].

**Wytyczna. Efekt zdarzenia oglądaj przez wstrzyknięcie zdarzenia** i kroki samych efektów (0,1; 0,5; 1,5 s) [PR].

**Wytyczna. Kosztowną iterację przenieś na stanowisko testowe.** [BS] Iteracja chmur na pełnym zrzucie gry trwała
2–3 min, osobne stanowisko z samym shaderem nieba 2–4 s. Po czterech nieudanych próbach „na grze” dopiero ono
doprowadziło do efektu.

**Zasada. Diagnoza przez eksperyment wykluczający.** [PR] „Prawy silnik ciemniejszy”: lustrzana kopia lewego silnika
w miejscu prawego dała ten sam obraz, a po obrocie pojazdu ciemniał lewy, więc przyczyną była strona cienia. [BS]
Gładkie niebo przy wichurze: mgła, deszcz i preset wykluczone po kolei zrzutami.

**Wytyczna. Mierz wartości pikseli.** Odczyt bufora HDR pokazał jasność ok. 190 z dzielenia przez ekstrapolowany
kolor [PR]. Percentyle jasności gry obok klatki referencji: mediana 41 → 51 przy referencji 82 [BS].

**Wytyczna. Referencja wizualna jako dane.** Klatki z mapą sekund i ujęć, tabela cech, sceny referencyjne w pliku,
plansza „gra obok klatki” generowana skryptem [BS]. Nagrania rozgrywki rozstrzygają tam, gdzie zwiastuny są montażem:
2100 klatek rozgrywki pokazało, że kamera się nie przechyla, a FOV nie rośnie z prędkością [PR].

**Wytyczna. Znaj granice renderera programowego.** Kolory i ostrość się zgadzają, płynność, część efektów zależnych od
czasu i dokładne cienie nie [PR].

**Wytyczna. Sprawdź, czy gotowy efekt silnika w ogóle coś rysuje.** [BS] Wbudowane promienie światła od początku nic
nie rysowały i renderowały scenę drugi raz. Rozmycie promieniste z GPU Gems 3 było ładniejsze i tańsze.

**Wytyczna. Po każdym kroku potoku assetów zrzut z bliska.** Konwersja materiałów gubiła orientację ścian, cięcie
gubiło normalne, klon materiału kopiował puste tekstury. Każdy błąd widać było dopiero na zbliżeniu [BS].

**Wytyczna. Sprawdź materiał w najciemniejszym i najjaśniejszym miejscu gry.** Metal bez odbić otoczenia wychodzi
czarny [PR].

**Wytyczna. Zmiana stylu rysowania ma migawkę, którą człowiek ogląda przed commitem** [ST].

## 9. Świat, lokacje i poziomy

**Zasada. Zasady lokacji to jeden dokument z liczbami, wiązany z kodem, gdzie się da** [ST]. Najważniejsze, które
sprawdziły się w praktyce:
- **trzy warstwy gęstości**: architektura, duże obiekty, drobiazg; drobiazg w skupiskach (co najmniej 3 rzeczy
  w promieniu 1,2 m) liczonych skryptem;
- **wymiary z norm**: stopień 0,15–0,18 × 0,28–0,30 m, drzwi 0,9–1,0 × 2,1 m, kondygnacje według przeznaczenia,
  schody i windy w trzonach, dwie drogi w dół jak drogi ewakuacyjne; kamera trzecioosobowa mieści się w korytarzu;
- **blockout na siatce 0,5 m**: moduły łączą się bez szczelin, a bryły kolizji pokrywają się z rysunkiem;
- **compression and release i próg**: do ważnego miejsca prowadzi ciasny odcinek, przejście zmienia światło,
  podłogę albo wysokość stropu;
- **światło 60-30-10 mierzone ze zrzutu**: pomiar 12 placów pokazał, że akcentu brakuje prawie wszędzie (0,2% zamiast
  3–15%), więc poprawki szły od danych;
- **żadnego światła znikąd**: każde światło ma przedmiot w świecie i jest przycięte do swojego pomieszczenia;
- **kontrast funkcjonalny**: drzwi, terminale, łup i osłony gracz rozpoznaje, zanim przeczyta napis;
- **dźwięk ze źródła**, przedmioty o znanych wymiarach dla skali, co najmniej jedna rzecz w ruchu;
- **walka**: osłony, dwie drogi, punkt orientacyjny widoczny z wejścia.

**Zasada. Karta lokacji powstaje przed budową** (location bible). Historia, klimat, przeznaczenie, wejścia i drogi
ucieczki, inwentarz docelowy w trzech warstwach ze źródłem każdej rzeczy, audyt zasad. Inwentarz z gry generuje
skrypt, a test pada, gdy karty brak albo jest nieaktualna. [ST] Detal bez karty powstawał z pudełek dobieranych na
bieżąco.

**Zasada. Stylizacja siedzi w rysowaniu, a kształt jest realistyczny.** Kształt, proporcje i detal jak w rzeczywistości,
styl tylko w tuszu, świetle i palecie. Uproszczenie istnieje wyłącznie jako LOD z daleka i na słabym sprzęcie.
- [ST] Zdanie „NPR wymusza czytelne bryły” było jedną z siedmiu przyczyn drzew z kul i bluszczu z pudeł.
- [PR] Lodowce z prostopadłościanów wyglądały z daleka jak klocki, góry ze stożków jak namioty. Lepszy brak obiektu
  niż zły obiekt: niszczyciele z brył usunięto na prośbę właściciela.

**Wytyczna. Ustal, co jest bryłą, a co obrazem.** Wszystko na wysokości ciała, przy czym postać może się zatrzymać,
jest bryłą symulacji. Graf nawigacji przechodzi przez każde drzwi, a gęstość nie może zamknąć przejścia [ST].

**Wytyczna. Czytelność poziomu przed efektem.** Ubity pas jazdy, jasne portale tuneli, tablice przed ostrymi
zakrętami, rytm (coś przy trasie co ok. 11 s), rozmycie tylko bliskiego planu [PR]. Szerokość przejazdu dla
najszerszego pojazdu, sprawdzana pomiarem [PR].

**Wytyczna. Świat z danych poprawia się w generatorze.** Gdy świat wynika z danych (GIS, generator proceduralny),
poprawka jest regułą dla całego świata. Ręczne obszary są wyjątkiem z nakładką liczbową [ST]. [ST] Model językowy
rysujący wielokąty z oglądu ortofoto był drogi (ok. 1 mln tokenów na komórkę mapy) i za każdym razem przykrywał
prawdziwą zieleń.

**Wytyczna. Rejestr odstępstw od referencji.** Każde odstępstwo od danych, GDD albo referencji ma identyfikator,
miejsce, stan w grze i w rzeczywistości oraz status: celowe z powodem albo do poprawy ze zgłoszeniem. „Tak wyszło
z importu” nie jest powodem [ST].

**Wytyczna. Frakcja albo charakter miejsca jako matryca reguł** (geometria, materiały, światło), z opisanymi
wyjątkami [ST].

## 10. Projekt rozgrywki i AI

**Zasada. Każdy stan porażki ma wyjście.** Ratunek po zatonięciu, zejście z mielizny, powrót na trasę z wyzerowaniem
liczników [BS, PR].

**Wytyczna. Spotkanie otwierające daje graczowi czas.** [BS] Piraci startowali 560–830 m od gracza i bierny gracz
tracił okręt w 4–7 min na każdym ziarnie. Teraz ok. 1,5 km.

**Wytyczna. Pętle nagrody sprawdzaj pod kątem nadużyć** (podwójne zdobycie pryzu) **i warunki mechanik z geometrią
świata**: ratowanie wraku wymagało 60 m, a wraki leżały na wodzie płytszej od zanurzenia statków [BS].

**Wytyczna. Kara przewidywalna dla gracza.** Klasy i progi zamiast ciągłej, niejasnej funkcji: trzy klasy przeszkód,
reguła dwóch trafień [PR]. **Informuj o regule, zanim ukarze**: HUD pokazuje „odpada ostatni · N m” [PR].

**Wytyczna. Każda nagroda ma koszt**: tunel aerodynamiczny za rywalem daje mniejszy opór i gorszą widoczność, skrót
jest ciaśniejszy, naprawa w jeździe kosztuje ciąg [PR].

**Wytyczna. AI z klasycznych, nazwanych technik**: profil prędkości z krzywizny, planer jako programowanie dynamiczne,
regulator kaskadowy [PR], steering Reynoldsa, LOS guidance, A* [BS].
- **Planer z histerezą**: bez pamięci wybranej strony wybór skakał i AI hamowało do ok. 30 m/s [PR].
- **AI zna osiągi swojego pojazdu**: po zróżnicowaniu osiągów słabiej skręcający rywal rozbijał się na głazie [PR].
- **Trudność i osobowość jako parametry**. Lista rzeczy świadomie niekopiowanych (u nas bez rubber-bandingu) [PR].

**Wytyczna. Reżyser populacji liczy całą grupę przed pojawieniem się** [BS]: konwój dobierany przy pięciu statkach
dawał dziesięć.

**Wytyczna. Research gatunku i recenzji: bierz regułę, zapisz, czego nie bierzesz.** Overboard! i Black Flag [BS],
recenzje tras i kar [PR], audyt luk wobec standardów gatunku z priorytetem P0 [ST]: wyszły m.in. brak autozapisu przy
schowaniu aplikacji i brak poziomu trudności.

**Wytyczna. Ruch dla oka oddzielony od fizyki jazdy, prędkości zgodne z animacją.** Bieg zwolniony do tempa klipu,
żeby kroki i dźwięk zgadzały się z obrazem [ST, PR].

**Wytyczna. Kamera bez skoków i zgodna ze sterowaniem.** Kamera pościgowa stoi na przejechanej drodze, a odległość
rośnie razem z FOV, więc pojazd ma stałą wielkość w kadrze [PR]. Przejścia dociągają pozycję, obrót i FOV przez ok.
1,6 s [PR]. W trybie pada kamera za rufą, żeby „lewo” na padzie było lewem na ekranie; drżenie jako przesunięcie
widoku z wyłącznikiem [BS].

## 11. Assety i licencje

**Zasada. Lista dopuszczonych licencji jest decyzją zapisaną w repo**, a wyjątki są wąsko opisane. Licencja wpływa na
dystrybucję: [PR] prywatne assety wykluczyły PWA na publicznym hostingu.

**Zasada. Rejestr pochodzenia każdego assetu**: autor, źródło, licencja, użycie, opis zmian. Ekran autorów generuje się
z tych samych danych, a test pada, gdy plik w paczce nie ma wpisu [ST, BS, PR].

**Zasada. Pobieranie i obróbka assetów to skrypt z manifestem** (adres, sha256, autor, licencja). Ciężkie źródła
(STL 275 MB, FBX, WAV) zostają poza repo, do repo trafia wynik [ST, PR, BS]. Pobrane pliki to niezaufane dane: osobny
katalog, narzędzia o przypiętych wersjach, bez uruchamiania kodu z paczek [ST].

**Wytyczna. Potok assetów doprowadza model do stylu gry, deterministycznie.** Kolory sprowadzone do palety, metry,
front w jednej osi, uproszczenie do budżetu, wynik bajt w bajt (pokój 41 MB → 318 KiB) [ST]. Detal z programu 3D
budowany skryptem w repo, model jako funkcja wymiarów i ziarna [ST].

**Wytyczna. „Nie upraszczaj, dopóki pomiar nie pokaże problemu”** (polecenie właściciela, powtórzone dwa razy) [BS].
Model wchodzi w całości, uproszczenie istnieje jako wariant LOD.

**Wytyczna. Pułapki potoku.**
- Upraszczanie siatek z UV wymaga blokady krawędzi szwów [BS].
- Kwantyzację przekształcaną macierzą węzła najpierw zamień na float, inaczej powstają kolce [PR].
- Części, które gra adresuje po nazwie, mają własny materiał albo są wyłączone z łączenia siatek [PR].
- Automat orientacji modelu potrzebuje jawnego wyjątku w danych [BS].
- Pomiar skryptem (np. wylotów dysz) sprawdzaj z obrazem [PR].

**Wytyczna. Z modelu bierz to, czego nie musisz animować, resztę generuj.** Ze skanów okrętów gra bierze kadłub, a
maszty, żagle i liny są proceduralne, bo reagują na wiatr i uszkodzenia [BS].

**Wytyczna. Reguła ogólna zamiast serii poprawek pojedynczego modelu.** [PR] Po serii poprawek płomieni dwóch pojazdów
powstała reguła płomienia ze wspólnymi stałymi gry i importu.

**Wytyczna. Najpierw katalog assetów, potem generator rozstawienia** (kotwice, skupiska, strefy wolne, hash miejsca).
Rzeczy fabularne stawia się ręcznie [ST]. Pokój po pokoju z ręcznymi współrzędnymi blokował PR-y.

**Wytyczna. Modele właściciela najpierw, otwarte zamienniki tam, gdzie brakuje; bez zastępczych dźwięków** [ST].

**Wytyczna. Rozmiar paczki raportowany przy każdym kroku** [BS], a stały slot pracy na assety pilnowany przy każdym
zwolnieniu slotu [ST].

## 12. UI, wejście, języki i urządzenia mobilne

**Zasada. Jedna skala interfejsu liczona w jednym miejscu.** Wymiary w jednej jednostce od rozmiaru projektu (u nas
800 × 400 i 960 × 540), z granicami. Widżety kotwiczone do stref wokół wolnego środka. Wzorzec: Unity CanvasScaler,
Unreal DPI Scale Rule.
- [ST] Dwie warstwy skalowały się każda po swojemu, a pad wcale: przy skali 0,8 przyciski wchodziły na minimapę.
- [BS] Druga ramka projektu dla niskich ekranów, bo przy jednej pismo na telefonie spadało do 5,6 px.
- [PR] Dla treści, która i tak się nie mieści, osobny mechanizm zmniejszający okno.

**Zasada. Audyt układu UI skryptem na macierzy rozdzielczości i języków, z kodem błędu.** Elementy poza ekranem,
nakładanie, ucięty tekst, przewijanie, pismo poniżej 8 px, każde okno i zakładka. [PR] Kropki karuzeli tras dawały
wszystkie 95 usterek audytu, po poprawce 0 na 315 widokach.

**Zasada. Dotyk sprawdzaj osobno.** Obszar dotyku ≥44 px niezależnie od skali rysunku, z zapasem między sąsiadami,
bo przeglądarka zaokrągla obszar trafienia [ST]. Współrzędne wskaźnika przy skalowaniu rozdzielczości: podawanie
silnikowi pikseli urządzenia dawało punkt 1,5 raza dalej przy DPR 2 [BS].

**Wytyczna. Odstępy liczone z wymiarów sąsiadów** [PR], znaczniki celów liczone z bieżącego układu HUD [BS],
`flex-shrink: 0` dla treści, której nie wolno ścisnąć [PR].

**Wytyczna. Wiele schematów wejścia z automatycznym przełączaniem.** Pad chowa sterowanie dotykowe, pierwsze dotknięcie
je przywraca, instrukcja zależy od faktycznie używanego wejścia, menu padem przez nawigację przestrzenną [PR].
Domyślne sterowanie dla dotyku, klasyczne w opcjach [BS].

**Wytyczna. Haptyka**: impulsy na zdarzenia z priorytetem i limitem częstotliwości, bez ciągłego drżenia, minimalna
długość impulsu ok. 60 ms, jedna wspólna droga i przełącznik [PR, BS].

**Wytyczna. Pauza zatrzymuje symulację, zegar i dźwięk**, automatycznie przy schowaniu aplikacji, z odliczaniem po
wznowieniu. Gra stoi pod menu i pomocą [PR, BS]. **Autozapis przy schowaniu karty**, bo system zabija aplikacje
w tle, a utrata postępu to najgorszy defekt [ST].

**Wytyczna. Ustawienia gracza jednym opisem** (`Setting<T>` z kluczem, domyślną wartością i `onChange`): zastąpił 38 par
`load/save` [PR]. Język jest ustawieniem gracza, więc zapis i determinizm od niego nie zależą [ST].

**Wytyczna. Teksty jak dla człowieka**: druga osoba, pełne zdania („Przesuń kciuk w bok, żeby skręcić”) [PR].

**Zasada. Teksty dla gracza tylko w katalogach języków**, a domena trzyma klucze, także z parametrami
(`notice.hits|7|14`) [ST, BS]. Typ wymusza ten sam zestaw kluczy w każdym języku, liczba mnoga przez
`Intl.PluralRules`. Skan z bazą pilnuje literałów poza katalogami [ST].
- Narracja w każdym języku ma identyczną strukturę (węzły, wybory, zmienne), sprawdzaną testem, więc zapis dialogu
  wczytuje się w każdym języku [ST].
- Lista tego, czego się nie tłumaczy (nazwy własne, napisy w świecie) [ST].
- Audyt UI w każdym języku, bo dłuższe słowa nie mieszczą się na telefonie [ST, BS].
- Czcionki z pełnym zestawem znaków każdego języka, wbudowane w paczkę [BS].

**Wytyczna. Paczka natywna (np. Capacitor) bez złudzeń.** Daje pliki lokalne, pełny ekran i brak zamykania karty, ale
WebView to ta sama przeglądarka i ten sam koszt rysowania [ST].
- Numer wersji z liczby commitów, ten sam w sesji i w CI, stały klucz podpisu: kolejne APK instalują się jako
  aktualizacja bez utraty rekordów [PR, BS].
- Uprawnienia i wtyczki sprawdzaj na urządzeniu: wibracje w APK nie działały od pierwszej wersji, bo brakowało
  uprawnienia w manifeście, a API przeglądarki po cichu nic nie robiło [PR].
- Bez minifikacji kodu natywnego, która może usunąć klasy wtyczek [PR].

**Wytyczna. PWA według „The Offline Cookbook”**, z osobną strategią dla strony, paczek z hashem i assetów. Pierwsza
wizyta ładuje grę przed startem service workera, więc dostaje on listę plików z Resource Timing. Skrypt odcina sieć
i sprawdza, że gra startuje [BS].

**Wytyczna. Ikony z generatora jednym poleceniem dla wszystkich platform** [BS]. **Wstępne ładowanie shaderów
i modeli za ekranem ładowania** [ST, PR].

## 13. Audio

**Wytyczna. Przypisanie dźwięków do zdarzeń jako dane i jako dokument**, z podglądem wszystkich klipów w grze [PR].

**Wytyczna. Nazwy klipów z analizy sygnału** (głośność, wysokość, jasność, udział basu), z rolą w nazwie i uczciwą
uwagą „przesłuchaj, zanim na tym polegniesz” [PR].

**Wytyczna. Miks w grupach z osobnymi suwakami**, muzyka znacznie ciszej, głośność wyrównana (u nas −18 LUFS), muzyka
zależna od miejsca i stanu gry [PR].

**Wytyczna. Synchronizację z obrazem licz.** Czas wjazdu obiektu do środka kadru równy czasowi do szczytu klipu,
dźwięk wybuchu opóźniony o drogę do kamery przy 343 m/s, te same zdarzenia z ziarna w obrazie i dźwięku [PR].

**Wytyczna. Reżyser głosów**: szansa i odstęp na sytuację, wspólna przerwa, ważne chwile zawsze, bez powtórzeń z rzędu
[PR].

**Wytyczna. Decyzje audio w czystej funkcji** (stan, liczniki, dt, losowość jako parametr), testowalnej bez dźwięku;
odtwarzanie osobno [BS]. **Synteza jako zapas i tam, gdzie nagrań brak** [PR, BS].

## 14. Praca z agentami AI

**Wytyczna. Zacznij od jednego wątku, zespół agentów wprowadzaj, gdy praca da się izolować.** [BS] Młody projekt
z jednym orkiestratorem: w 7 dni od pustego repo do grywalnego APK, mało konfliktów. Brak niezależnego weryfikatora
przenosi ciężar na dyscyplinę zrzutów przed i po. [ST] Duży projekt z zespołem: ok. 1040 PR-ów w miesiąc.

**Zasada. Role z rozdzielonymi uprawnieniami.** Koordynator prowadzi plan, rejestry, integrację, commit, PR,
publikację i rozmowę z właścicielem. Specjaliści piszą w swoim obszarze plików. Łowca błędów i weryfikator tylko
czytają i uruchamiają [ST, PR]. Agent, który potrzebuje zmiany poza swoim obszarem, opisuje ją w raporcie, a agent,
który trafi na wybór właściciela, kończy pracę i opisuje warianty z liczbami [PR].

**Zasada. Granica pakietu jest granicą własności.** Zmiana w cudzym obszarze idzie przez kontrakt (port, zdarzenie,
komenda) [ST]. Rozłączne obszary plików usuwają większość konfliktów [PR].

**Zasada. Weryfikator szuka powodu, żeby zmiany nie przyjąć, i nie zna rozumowania autora.** Raport autora to materiał
do sprawdzenia, a weryfikator robi własne sondy brzegowe (inne ziarno, miejsce, język). Autor przed oddaniem przechodzi
listę weryfikatora, bo połowa pierwszych rund wracała z przypadkiem, którego autor nie sprawdził [ST].

**Zasada. Zlecenie i raport w stałym formacie.**
- Zlecenie: cel słowami właściciela, zakres i czego nie ruszać, co już wiadomo (pomiary, odrzucone warianty),
  kryterium odbioru (liczba, zrzut, test), wzorzec, commit bazowy [PR, ST].
- Raport: zrobione, sprawdzone (polecenia i wyniki), niesprawdzone, zmienione pliki, wiersz do decyzji, do decyzji
  właściciela. Około 30 linii, szczegóły w pliku, bo długie raporty zjadają kontekst koordynatora [PR, ST].
- Stałe zasady w jednym pliku czytanym przez każdego agenta, brief zawiera tylko zadanie i odstępstwa. Gdy briefy
  milczały o fragmentach dziennika zmian, przez 10 PR-ów nikt ich nie dodał [ST].
- Listę miejsc w briefie sprawdź na main, bo mogła się zdezaktualizować [ST].

**Zasada. Limit rund.** Po dwóch odrzuceniach nowy agent ze zwięzłym briefem i odsyłaczem do raportu weryfikatora.
[ST] Jeden autor w 6 rundach zużył ok. 4 mln tokenów, a agenci z co najmniej 3 rundami to ok. 25% tokenów sesji.
Agenta przerwanego limitem API albo restartem wznawiaj, bo ma kontekst.

**Zasada. Liczba równoległych agentów wynika z zasobów maszyny.** [ST] Przy 6 agentach testy padały losowo (load
20–28). Potem najwyżej 4 na 4 rdzenie, ciężkie zadania przez zamek z kolejką, lekkie bez zamka. Długie pomiary nie
biegną równolegle z pomiarami czasu [PR].

**Wytyczna. Model dobrany do roli.** Piszący kod, weryfikator i koordynator na najmocniejszym, łowca na średnim,
zwiadowca źródeł na najtańszym [ST].

**Zasada. Agenci na wspólnej maszynie nie wykonują operacji globalnych.** Bez `git stash` (stos wspólny dla worktree),
bez `pkill` po nazwie (agent zabił procesy innych), `rm` tylko z pełną ścieżką, bez force-push i amend, pliki
tymczasowe z prefiksem zadania, własny port serwera (zrzuty mierzyły cudzy build) [ST, PR].

**Wytyczna. Worktree.** Podaj commit bazowy, bo worktree potrafi wystartować od starszego [PR]. Zależności dolinkuj
jako pierwszy krok [PR]. Usuwaj worktree dopiero po scaleniu PR-a, skryptem: bez niego nie wznowisz agenta na drugą
rundę, a sama lekcja nie wystarczyła, bo przedwczesne usunięcie zdarzyło się trzy razy [ST]. Główny checkout nie zmienia
gałęzi [ST].

**Zasada. Co powtórzyło się drugi raz, staje się skryptem.** Sygnały: ta sama sekwencja poleceń, ta sama uwaga
recenzenta, ten sam rodzaj czerwonego CI, log czytany w całości dla jednej linii. Koordynator wdraża takie usprawnienie
bez pytania, jeśli dotyczy procesu, nie luzuje bramek i zajmuje do godziny [ST]. Procedury z gotowymi poleceniami
trzymaj jako umiejętności (skills): zrzuty, pomiary, publikacja [PR].

**Wytyczna. Oszczędzanie limitu bez utraty jakości.** Zmiana tylko w testach albo dokumentacji z dowodem pada/przechodzi
nie potrzebuje weryfikatora. Jeden weryfikator może sprawdzić dwa PR-y z osobnymi werdyktami. Koordynator raportuje
tylko przy scaleniu, odrzuceniu albo potrzebie decyzji [ST].

**Zasada. Prywatność w zapytaniach sieciowych agentów.** Ogólny User-Agent, nigdy dane użytkownika, bez ponowień po
429, bez obchodzenia blokad. Agenci dwa razy wstawili e-mail właściciela do nagłówka, więc zasada jest w każdym
briefie [ST].

**Wytyczna. Kurator domeny z niezależnym źródłem prawdy** (np. ortofotomapa dla topografii), który zaczyna od skryptu
zbierającego pakiet przeglądu [ST]. Przed kolejną rundą autor sam sprawdza rodzaje błędów, które recenzent znalazł
w poprzednich [ST].

## 15. Ciągłość pracy w sesjach bez pamięci

**Zasada. Trwałe jest tylko to, co wypchnięte.** Commit i push co ok. 30 min albo po każdym kroku, także jako `wip`.
[ST] Restart kontenera zatrzymał 4 agentów w połowie pracy. Po restarcie procesy giną, pliki zostają: wypchnij lokalne
commity i wznów agentów.

**Zasada. Start sesji to lektura stałych plików**: backlog (sekcja „Następne”), decyzje, rejestr błędów, lekcje
koordynatora, otwarte PR-y. Stan i decyzje zapisuj na bieżąco [ST, BS, PR].

**Wytyczna. Mapa kodu w pliku instrukcji dla agentów**, aktualizowana po większych zmianach [PR].

**Wytyczna. Tryb nieobecności właściciela jako jawny przełącznik.** Bez pytań, opcja rekomendowana, wpis z etykietą
„rekomendowana, pod nieobecność”. Na koniec podsumowanie, a właściciel zatwierdza decyzje zbiorczo [ST]. [BS]
Orkiestrator decyduje za właściciela z dopiskiem „(orkiestrator)” i może zostać nadpisany lepszą decyzją.

**Wytyczna. Pętla przez zaplanowane zadanie i dziennik raportów.** Godzinne „kontynuuj według backlogu” do tej samej
sesji, codzienny e-mail, dziennik wysyłek, żeby raport nie poszedł dwa razy [BS].

**Wytyczna. Obejście środowiska jest plikiem w repo.** Lustro repozytorium Maven, pobieranie przez curl zamiast
`fetch` [BS]. Ręczna konfiguracja zginie z kontenerem. Prośbę o dostęp do hosta zgłaszaj raz, z planem B [BS].

**Wytyczna. Dysk to zasób**: usuń build po pomiarze, kopie do porównań od razu po porównaniu, worktree scalonych PR-ów
skryptem [ST].

## 16. Zmiany, CI i git

**Zasada. Jedna zmiana, jedna gałąź, jeden PR. Ryzykowne zmiany (symulacja, renderer, ruch, zapis) zawsze osobno**, żeby
jedna regresja nie blokowała reszty. Jeden błąd na commit, bez „przy okazji” [ST].

**Zasada. Czerwony main jest pierwszą pracą sesji**: poprawka albo revert winnego commitu, zanim wejdzie coś innego.
Ten sam czerwony test na kilku niezależnych PR-ach oznacza błąd main [ST].

**Zasada. Kilka zielonych PR-ów scalaj po kolei**, z aktualizacją z main i CI między nimi. Dwa PR-y przeszły osobno,
a razem zepsuły main [ST].

**Wytyczna. PR lekki, main pełny.** Na PR typy, lint, architektura i testy powiązane grafem importów. Pełny zestaw
na main, w nocy i ręcznie. Każdy push do main ma własną grupę współbieżności, bo szybkie scalanie anulowało pełne
przebiegi i czerwony main nie dawał sygnału [ST]. Progi pokrycia i bramki czasu działają dopiero w pełnym
przebiegu, więc długi test zmierz lokalnie z pokryciem przed scaleniem [ST].

**Wytyczna. Zmiana tylko w dokumentacji nie uruchamia testów w CI** (`paths-ignore`). PR otwieraj jako gotowy, bo szkic
nie uruchamia CI [ST, BS].

**Wytyczna. Unikaj plików, które konfliktują przy każdym scaleniu.**
- Dziennik zmian z fragmentów (`changelog.d/<data>-<opis>.md`), składany na main [ST].
- Generowane tablice po jednej linii na element [ST].
- Bez odcisku wejść w nagłówku pliku generowanego: konflikt w 27 z 30 scaleń. Świeżość sprawdza przeliczenie bajt
  w bajt w osobnym jobie [ST].
- Numery wpisów w rejestrach nadaje narzędzie po scaleniu main (ten sam numer nadano dwa razy) [ST].
- Statusy rejestrów zmieniane zbiorczo przy otwarciu PR i po scaleniu. Commit statusu po każdej zmianie mnożył
  konflikty i restartował CI [ST].

**Wytyczna. Scalanie main do gałęzi skryptem z polityką konfliktów**: konflikt w plikach generowanych rozwiązuje
przeliczenie, każdy inny przerywa [ST]. Pliki blisko limitu linii kolidują po scaleniu: przy integracji drugiej
poprawki wydziel moduł [ST]. Wspólna poprawka CI dla wielu PR-ów idzie osobnym PR-em od main [ST].

**Wytyczna. Nieudaną próbę wycofaj i opisz.** Revert zostaje w historii, a wpis w decyzjach mówi, co się nie udało
i dlaczego [BS].

## 17. Proces błędów

**Wytyczna. Rejestr błędów w repo**, bo jednorazowe sondy giną z sesją, a ten sam rodzaj błędu wracał [ST].

**Zasada. Definicja błędu zamyka dyskusję.** Glitch to rozjazd między tym, co gra pokazuje albo symuluje, a tym, co
gracz uzna za realne. Celowa stylizacja jest wyborem, brak funkcji jest pozycją backlogu [ST].

**Wytyczna. Triage**: ważność S1–S4, priorytet = ważność × zasięg / koszt. S1 (awaria, utrata zapisu, czerwony main)
zawsze pierwsze [ST].

**Zasada. Zgłoszenie bez dowodu nie istnieje.** Miejsce, liczba wystąpień w świecie, dowód (licznik, pomiar, zrzut),
właściciel, test przyjęcia „co dziś pada”. Przypuszczenie ma status „niepotwierdzone” [ST].

**Wytyczna. Metody szukania od najtańszej**: skan, pomiar programowy w całym świecie, zrzuty, dane źródłowe [ST].

**Zasada. Poprawka u przyczyny i jako reguła dla całego świata.** Ślad widoczny w jednym miejscu naprawia się tam, gdzie
powstaje. Błędy jednej klasy łączymy we wpis klasowy [ST]. Recenzent zgłasza z dowodem: ścieżka od realnego wywołania
do błędu, inaczej „wątpliwość” [PR].

**Wytyczna. Regresja wprowadzona przez PR blokuje scalenie; wady sprzed PR-a idą do rejestru osobno** [ST]. Testu,
który łapie prawdziwy błąd, nie osłabiamy. Zmiana testów w kolejnej rundzie to sygnał alarmowy dla weryfikatora [ST].

**Wytyczna. Stare zgłoszenie najpierw zmierz na main**, a znalezisko poboczne sprawdź jednym grepem, zanim wyślesz
agenta [ST].

**Wytyczna. Lista kontrolna recenzenta z błędów, które się zdarzały**: jednostki, znaki, kolejność aktualizacji, reset
stanu przy restarcie, pojazdy z kilkoma silnikami, dzielenie przez zero, niedeterminizm, alokacje w pętli, nowe
światła [PR].

## 18. Dokumentacja i decyzje

**Zasada. Dziennik decyzji w repo jest pamięcią między sesjami.** Data, decyzja, powód, gdzie. Nowe na górze sekcji,
nieaktualne oznaczone dopiskiem, nigdy usuwane. Cytat właściciela przy wpisie [ST, PR, BS].

**Zasada. Wpis decyzji zawiera liczby przed i po, odrzucone warianty i to, czego nie sprawdzono.** Bez odrzuconych
wariantów kolejna sesja próbuje tego samego. Błędne założenie prostuje się wprost, co zamyka temat [PR, BS].

**Zasada. ADR dla decyzji zmieniających granice albo zasady**, z sekcją „Wzorzec” i różnicami. ADR zapisuje też wyniki:
kroki odwołane z liczbami, wdrożone inaczej po profilu, tabele przed/po z numerami PR [ST].

**Wytyczna. Backlog bez sekcji „Zrobione”.** Zamknięta pozycja idzie do archiwum z datą, czytanego tylko w razie
potrzeby [ST]. Przy częściowej pozycji „Zostaje:” [BS]. Plany wieloetapowe jako tabela punktów ze statusem, jeden punkt
na commit, przegląd całości na zrzutach na końcu [PR].

**Wytyczna. Kamienie milowe z kryterium akceptacji, od pionowego wycinka przez wszystkie warstwy** (od wejścia gracza
do zapisu, wszystkie bramki zielone) [ST]. „Gra skończona” zdefiniowana mierzalnymi progami [BS]. Rejestr ryzyk na
starcie z przeciwdziałaniem [ST]. Brzeg zakresu jako jawna lista „na później” [ST].

**Wytyczna. Refaktor pod wzorce ma priorytet równy funkcjom**, zanim projekt urośnie dalej [ST].

**Wytyczna. Historia pomiarów należy do ADR-ów i commitów.** Pole komentarza w pliku budżetów urosło do kilkudziesięciu
KB [ST]. Plik danych trzyma liczby i krótki opis.

**Wytyczna. Komentarz modułu narzędzia mówi, co mierzy, dlaczego tak i jak go użyć**, z odwołaniem do ADR [BS].

## 19. Współpraca z właścicielem

**Zasada. Raport kończy się trzema listami: zrobione, sprawdzone, niesprawdzone.** Jawne „nie sprawdzono na telefonie”,
„nieodsłuchane w kontenerze”. Uczciwość co do granic środowiska buduje zaufanie do reszty [PR, BS, ST].

**Zasada. Grywalna wersja po każdej zmianie widocznej dla gracza.** APK, prywatna strona z grą na telefon, przeglądarka
modelu, pakowane skryptem [PR, BS, ST]. Uwagi po obejrzeniu przeglądarki statku dały kilkanaście poprawek [BS].

**Zasada. Zmiana widoczna ma zrzut przed i po z tego samego ujęcia**, z prawdziwymi modelami postaci [ST].

**Wytyczna. Właściciel pokazuje poprawki na modelu.** [PR] Warsztat: podgląd 3D z gizmem, kroki ±10 cm i 5°, notatka,
zapis do bazy strony, skąd Claude je odczytuje i nakłada skryptem (środki 22 pojazdów zgodne co do 1 mm). Mapa dźwięków:
właściciel słucha i flaguje przypisania. Oba narzędzia:
- pakowane skryptem z danych gry, bo ręcznie wgrywane pliki rozjechały się z grą;
- zapisują do bazy strony, bo localStorage jest nieczytelny dla Claude;
- składają kolejne poprawki z zapisanymi.

**Wytyczna. Warianty do wyboru zamiast jednej propozycji.** Makiety A/B/C/D, siatka wariantów obok siebie, wybór
zapisany w decyzjach z linkiem [PR, ST]. [ST] Iteracja rąk w widoku z pierwszej osoby przeszła 7 rund na siatce wariantów.

**Wytyczna. Wartości do strojenia na urządzeniu to pojedyncze nazwane stałe**, a decyzja zapisuje „poprzednia → nowa”.
Właściciel wielokrotnie korygował je po grze (muzyka ciszej, wibracje słabsze) [PR].

**Wytyczna. Właściciel decyduje kierunkiem, agent dostarcza liczby.** Decyzja „przyjąć z długiem: generator +20%”
zapada na pomiarze i trafia do długu z warunkiem zdjęcia [ST].

**Wytyczna. Pytanie zawsze z rekomendacją, odpowiedź zapisana.** Niejednoznaczną prośbę zinterpretuj i zapisz
interpretację („kolizje na statku” jako przenikanie części w widoku, z dopiskiem, co dalej, jeśli chodziło o fizykę)
[BS]. Prośbę rozpisz na kolejność z uzasadnieniem zależności [BS].

**Wytyczna. Kody w raportach z opisem w nawiasie**, np. „G-050 (nadbudowy przy zabytkach)” [ST]. Raport krótki
(2–4 zdania), tylko przy scaleniu, odrzuceniu albo potrzebie decyzji [ST].

**Wytyczna. Kolejność prac właściciela zapisana jako priorytety**, z listą odłożonych. Pilna sprawa czeka na wolny slot
albo zastępuje niższy priorytet [ST]. PR i merge tylko na prośbę [PR, BS].

**Wytyczna. Styl**: po polsku, wprost i konkretnie, bez patosu i marketingowych frazesów, bez myślników em, bez
antytezy kontrastowej [wszystkie].

## 20. Co wdrażać na jakim etapie

Nie wszystko opłaca się od pierwszego dnia. Kolejność, która wynika z tych trzech projektów:

**Dzień 1 (koszt niski, późniejsze wprowadzenie drogie)**
- warstwy z domeną bez silnika i strażnikiem zależności w CI; silnik za jednym modułem;
- stały krok, RNG z ziarnem, zakaz losowości i czasu w domenie w linterze;
- komendy jako wejście, zdarzenia jako wyjście, dane w tabelach;
- limity rozmiaru w linterze;
- dziennik decyzji, backlog, ADR z sekcją „Wzorzec”, mapa kodu w instrukcji dla agentów;
- strona testowa ze scenami i zrzuty bez GPU;
- grywalna wersja dla właściciela i raport „zrobione / sprawdzone / niesprawdzone”.

**Gdy jest pętla rozgrywki**
- test całej rozgrywki z AI i test niezmienników; złoty hash na małym scenariuszu;
- audyty liczbowe przed i po, audyt balansu jako bramka;
- budżety rysowania z urządzenia docelowego, narzędzie udziałów klatki;
- jedna skala UI i audyt układu na macierzy ekranów i języków; katalogi języków od pierwszego tekstu.

**Gdy treści i ludzi (albo agentów) przybywa**
- zapadki z bazą po miejscach, skan całego świata;
- rejestr błędów z triage i niezależnym weryfikatorem;
- zespół agentów z rozłącznymi obszarami, limitem rund i WIP;
- karty lokacji, generatory rozstawienia, rejestr odstępstw;
- CI z zakresem na PR i pełnym przebiegiem na main, fragmenty dziennika zmian.

## 21. Antywzorce

Każdy z nich kosztował w którymś projekcie realny czas.

- Podnoszenie limitu czasu albo budżetu, żeby test przeszedł.
- Próg rozmiaru albo jakości tylko jako raport, bez czerwonego testu.
- Baza zapadki jako sama liczba: nowy błąd chowa się za poprawką innego.
- Złoty hash liczony na treści świata albo poprawiany automatem.
- Kontrola liczona tymi samymi danymi co poprawka albo kopiująca logikę po swojemu.
- Dwie implementacje tego samego kształtu (teren w fizyce i w rendererze osobno).
- Bryły zastępcze (kula jako korona drzewa, pudło jako bluszcz) poza LOD-em.
- Czas klatki pod rendererem programowym jako bramka.
- Opcja jakości bez zrzutu A/B, gotowy efekt silnika bez sprawdzenia, czy rysuje.
- Bramka wzrostu czasu wobec main na zaszumionych runnerach.
- Odcisk wejść w nagłówku pliku generowanego, wspólny `CHANGELOG.md`, status rejestru commitowany po każdej zmianie.
- Agent wznawiany w nieskończoność zamiast nowego z krótkim briefem.
- Ręczna praca modelu językowego tam, gdzie wystarczy reguła albo skrypt (wielokąty z oglądu ortofoto).
- Narzędzie feedbacku z ręcznie wgrywanymi danymi zamiast pakowania z gry.
- Historia pomiarów w komentarzach plików danych i nad asercjami.
- Niewypchnięta praca w kontenerze.
