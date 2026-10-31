# ADR-0062: Zabytki z własnej geometrii w wersji Lublin 2077

## Kontekst
Po G-049 (PR #65) zabytki mają prawdziwe bryły z części `building:part` z OSM: Brama Krakowska ma przybudówkę nad przejazdem, wieżę, ośmiobok i hełm, a położenie i wysokości zgadzają się z danymi. Renderer okleja je jednak tym samym zestawem ścian, okien i dachów co kamienice (ADR-0022, ADR-0051). Skutki:
- Brama Krakowska wygląda jak dom z wieżą: tynk z rzędami okien zamiast gotyckiej cegły, a hełm jest dachem czterospadowym, który zasłania ośmiobok (G-056, T-017);
- przy innych kościołach generowane wieże dublują wieże z OSM (G-057, T-018);
- gracz nie rozpoznaje z daleka miejsc, które w Lublinie służą za punkty orientacyjne.

Użytkownik zdecydował (31.10): wszystkie zabytki dostają realistyczną geometrię w stylu cyberpunk, zaczynając od Bramy Krakowskiej.

Gotowych modeli tych zabytków na licencji CC0 nie ma; modele ze Sketchfaba są zwykle na CC-BY, a ADR-0058 dopuszcza tylko CC0.

## Decyzja
- **Proceduralny zestaw zabytków w rendererze** (`packages/engine/src/renderer/mapcity/landmarks/`), za fasadą `BabylonRenderer`.
  - Elementy zestawu: cokół z kamienia, mur ceglany ze ślepymi blendami ostrołukowymi, tynk z pilastrami i gzymsami, ośmiobok, hełm z profilu obrotowego (cebula, dzwon, iglica z latarnią), blanki, łuk przejazdu z głębokością muru, tarcza zegara, okna i otwory dzwonnicy.
  - Każdy zabytek to przepis w tablicy danych: identyfikatory OSM obrysu i części, z których bierze kształt, oraz elementy na kolejnych wysokościach. Obrys, wysokości kondygnacji i położenie zawsze idą z danych OSM. Przepis dodaje detal, nie zmienia bryły.
  - Budynki z przepisem nie przechodzą przez zwykły plan fasad, dachów, nadbudów i proceduralnych wież (ADR-0051), więc G-056 i G-057 przestają ich dotyczyć.
- **Wszystkie zabytki, w dwóch poziomach szczegółu:**
  - najbardziej rozpoznawalne (lista etapów niżej) dostają własny przepis z detalem konkretnego budynku;
  - pozostałe budynki z `isLandmark` (kościoły, cerkwie, synagogi, gmachy publiczne, kamienice z `historic`) dostają przepis ogólny według rodzaju i tagów OSM: materiał (`building:material`, cegła albo tynk), kształt dachu (`roof:shape`, co zamyka G-056 dla zabytków), wieże z części OSM, gzymsy i okna w stylu epoki zamiast okien kamienic. Rodzaje: kościół, cerkiew, gmach publiczny, kamienica zabytkowa, mur i baszta.
- **Symulacja bez zmian.** Kolizja, przejście bramy i pokoje zostają z danych (`sim`). Detal mieści się w bryle z dokładnością do grubości gzymsu. Złote hashe się nie zmieniają.
- **Bez nowych wywołań rysowania.** Geometria trafia do siatek komórek mapcity (bliskiej i dalekiej), jak fasady. Daleka wersja jest uproszczona: bryła, hełm i świecące elementy. Kolory z palety kitu (ADR-0022), cegła i tynk jako nowe próbki palety.
- **Warstwa Lublin 2077** na zabytku:
  - Zabytek zostaje czytelny jako zabytek. Warstwa cyberpunkowa jest dodatkiem: światło, ekrany i kable, a nie nadbudowa. Nadbudów z ADR-0051 na zabytkach dalej nie ma (G-050).
  - Strona od nowego miasta jest neonowa. Na Bramie Krakowskiej to zachodnia elewacja od Krakowskiego Przedmieścia: neonowe obrysy gzymsów ośmioboku, holograficzna tarcza zegara, pasy LED na krawędziach hełmu, maszt z antenami i światłem ostrzegawczym na iglicy, kable do sąsiednich kamienic i ekran z napisem nad łukiem.
  - Każdy zabytek ma warstwę 2077, ale jej natężenie zależy od otoczenia. Na Starym Mieście i przy Rynku warstwa jest stonowana, zgodnie z zasadą ADR-0058 „Rynek i Stare Miasto oszczędnie”: podświetlenie od dołu, pojedyncze hologramy i kamery, cienkie linie światła na gzymsach, bez dużych ekranów i wiązek kabli. Na Bramie Krakowskiej to wschodnia elewacja od Bramowej.
  - Przejazd pod bramą jest punktem kontrolnym gangu Hebi (ADR-0048, posterunek `hebi-bramowa`): skaner w łuku, migające paski na ościeżach. Same rekwizyty renderera, bez nowej logiki.
  - Napisy generyczne, bez prawdziwych marek. Teksty dla gracza idą przez katalogi i18n (ADR-0056).
- **Wierność.** Przepis każdego zabytku przechodzi przegląd kuratora topografii: proporcje, liczba kondygnacji, materiały i kształt hełmu sprawdzone z OSM i fotografiami. Odstępstwa celowe (warstwa 2077) trafiają do `docs/topografia.md` z powodem.
- **Etapy (osobne PR-y, każdy z migawką NPR obejrzaną przed commitem i zrzutami przed i po):**
  1. Zestaw i Brama Krakowska (r7224409 z częściami: przybudówka, wieża, ośmiobok w617878341, hełm), obie elewacje i przejazd z punktem kontrolnym. Przy okazji G-051: napis muzeum na bramie zamiast na Jezuickiej 3.
  2. Brama Grodzka.
  3. Wieża Trynitarska i Archikatedra (zamyka G-057 dla tych budynków).
  4. Ratusz i Trybunał Koronny.
  5. Zamek z Donżonem i Kaplicą Trójcy.
  6. Kościoły Dominikanów i Bernardynów (Bernardyni po decyzji G-052 o granicy danych).
  7. Przepisy ogólne dla pozostałych zabytków według rodzaju (kościół, cerkiew, gmach publiczny, kamienica zabytkowa, mur i baszta) z kształtem dachu z OSM; nowa kontrola skanu: zabytek bez przepisu.

## Konsekwencje
- Kilka najważniejszych punktów orientacyjnych Lublina będzie rozpoznawalnych z daleka, a warstwa 2077 zostanie na nich bez przykrywania zabytku.
- Rośnie liczba trójkątów w komórkach z zabytkami. Pomiar `npr-perf` na scenach Krakowskiego i Rynku przy każdym etapie; budżety wywołań rysowania bez zmian.
- Migawka NPR (kadr przy Neon Koi) zmienia się tylko wtedy, gdy zabytek jest w kadrze, świadomie.
- Przepisy to dane, więc limit 120 linii na funkcję ich nie dotyczy (wyjątek dla tabel, ADR-0031). Kod zestawu podlega zwykłym limitom.
- Kolejne zabytki dochodzą jako przepisy bez zmian w kodzie zestawu, chyba że potrzebny jest nowy element.
