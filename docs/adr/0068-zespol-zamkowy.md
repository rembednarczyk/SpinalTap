# ADR-0068: Zespół zamkowy wg przepisu (Zamek, Donżon, Kaplica, schody i plac)

## Kontekst
Zamek Lubelski to kanoniczne miejsce Lublina (prośba użytkownika 1.11). Audyt kuratora (`docs/plany/zamek-lubelski.md`, T-112…T-118, G-203…G-207) pokazał, że położenie, obrysy i teren zgadzają się z OSM i NMT, ale wygląd nie:
- Zamek z Placu Zamkowego wygląda jak gmach biurowy: okleina kamienicy z siatką okien, bez ryzalitu bramnego, wieżyczek, blanków, portalu i rozet, w szarym tynku zamiast kremowego (T-112);
- schody na wzgórze mają 3 m zamiast ok. 10 m (G-203), Kaplica ma wysokość domyślną, a Donżon za wysoką koronę (G-204);
- kandelabry, reflektory i zieleń skarpy stoją nie tam, gdzie trzeba (G-205, G-206, G-207).

ADR-0062 ma etap 5 „Zamek z Donżonem i Kaplicą Trójcy”, ale schody, wiadukt i pomniki to konstrukcje i modele, nie budynki z przepisem. Ten ADR rozszerza etap 5 ADR-0062 o otoczenie i zapisuje decyzje użytkownika.

## Decyzja
- **Przepis zabytku (ADR-0062) dla Zamku, Donżonu i Kaplicy**, z bryłą i wysokościami z danych (po poprawkach Z0), z nowymi elementami zestawu: okno i portal ostrołukowy, rozeta, sterczyna, blanki trójkątne.
- **Pełny detal na dwóch fasadach:** zachodniej (od placu) i północnej (od al. Tysiąclecia i dworca); pozostałe elewacje uproszczone (decyzja użytkownika 1.11). Kremowy tynk jako nowa próbka palety.
- **Warstwa 2077:** Zamek jest siedzibą korporacji pod ochroną dronów (decyzja użytkownika 1.11). Od placu i Starego Miasta stonowanie (ciepłe podświetlenie, pojedyncze kamery, cienkie linie światła; ADR-0058 „Stare Miasto oszczędnie”), od dworca i alei neony; radar albo antena na Donżonie; drony patrolowe nad wzgórzem razem z etapem dronów (ADR-0058 etap 7). Nazwa korporacji generyczna, teksty przez i18n (ADR-0056).
- **Otoczenie:**
  - schody w pełnej szerokości z podestami i balustradą z balasów, kolizja zgodna z biegami;
  - jeden lew: „Symbol Lwowa” (1995) przy rogu placu i al. Tysiąclecia, w miejscu z OSM (decyzja użytkownika 1.11);
  - obelisk z planem dzielnicy żydowskiej (1986) przy schodach, położenie potwierdzone zdjęciem (decyzja użytkownika 1.11);
  - ścieżki pod wzgórzem przywrócone jako alejki (T-050; w 2077 remont skończony);
  - nadbudowy na łuku kamienic placu zostają (T-028), pchli targ zostaje na stałe (decyzje użytkownika 1.11);
  - podwójne kandelabry na murkach, reflektory na przedpolu bramy, drzewostan skarpy z reguły (G-205…G-207).
- **Wejścia pod akt III:** etap bryły przygotowuje od razu otwory wejść do Kaplicy i Donżonu (decyzja użytkownika 1.11), zgodne z ADR-0061 (wnętrza).
- **Budżet:** bez nowych wywołań rysowania; detal w siatkach komórek mapcity jak w ADR-0062, daleka wersja uproszczona; telefon (`low`) bez detalu fasad poza bryłą i świecącymi elementami.
- **Symulacja:** zmienia się tylko kolizja schodów (szerokość biegów) i, jeśli trzeba, wejścia; zmiana złotego hasha świadomie, w etapie, który ją wprowadza.
- **Kontrole skanu:** `landmark-default-height` (G-204), `steps-narrower-than-walls` (G-203), `plan-prop-off-target` (G-206), docelowo baza 0 dla zespołu zamkowego.
- **Wierność:** każdy etap przechodzi przegląd kuratora topografii z ortofoto i zdjęciami; odstępstwa celowe (warstwa 2077) w `docs/topografia.md`.

## Etapy (osobne PR-y, renderer z migawką NPR obejrzaną przed commitem i zrzutami przed i po)
- **Z0** poprawki danych w imporcie: G-078 (brama 3,8 × 5,8 m), G-203, G-204, G-205, G-206, T-050 (korekty tagów dla linii).
- **Z1** ten ADR.
- **Z2** przepis Zamku: obie fasady z pełnym detalem, otwory wejść.
- **Z3** Donżon i Kaplica (z niższym prezbiterium i absydą), otwory wejść.
- **Z4** schody, balustrady, kandelabry, Lew, obelisk, armaty i studnia.
- **Z5** wiadukt Zamkowej z arkadami i balustradą (T-023), mury rampy, G-088.
- **Z6** zieleń skarpy (G-207) i warstwa 2077.

Kolejność: Z0, Z2 i Z4 (rozpoznawalność z placu), potem Z3, Z5, Z6. Wnętrza aktu III po Z3.

## Konsekwencje
- Zamek staje się rozpoznawalny z placu i z dworca; z dwiema pełnymi fasadami etap Z2 jest większy (koszt L+).
- Zestaw zabytków zyskuje elementy gotyckie przydatne dla innych kościołów (ADR-0062 etap 7).
- Akt III dostaje gotowe wejścia do Kaplicy i Donżonu.
