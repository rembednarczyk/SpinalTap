# ADR-0055: Skręty pasów na skrzyżowaniach: pas łączy się z pasem innej ulicy

## Kontekst
Ruch z ADR-0050 jest czystą funkcją ziarna i zegara. Każdy pas to osobna linia z rozkładem, a auto jedzie po niej modulo jej długości. Auto, które dojedzie do końca pasa w polu widzenia gracza, staje (`traffic-system.ts`) i czeka, aż gracz odwróci wzrok. Pasy łączą się dziś tylko w zawrotki: przed blokiem gry i na ślepym końcu ulicy (G-023).

Skan liczy 68 ślepych końców pasów (`lane-dead-end`). Większość z nich leży na skrzyżowaniach: pas jednej ulicy kończy się tam, gdzie zaczyna się pas innej, ale auto nie skręca (G-006). Na sześciu końcach jednokierunkowych ulic (G-024) zawrotka nie wchodzi w grę, bo oznaczałaby jazdę pod prąd. ADR-0050 odłożył skrzyżowania „na później”.

## Decyzja
- **Łączenie na końcach pasów.** Koniec pasa, który nie jest ślepym końcem ulicy ani krawędzią mapy, łączy się z początkiem pasa tego samego użycia (`cars`, `trolley`) innej ulicy. Warunki:
  - początek leży w zasięgu skrzyżowania; zasięg ustala pomiar, dziś rzędu kilkunastu metrów;
  - kierunki nie są przeciwne. Zawrotki zostają przy obecnej regule.
- **Kolejność wyboru.** Każdy początek pasa jest brany najwyżej raz. Pierwszeństwo ma jazda prosto, potem skręt w prawo, potem w lewo, a przy remisie bliższy początek i stała kolejność łańcuchów. Wynik jest więc deterministyczny i nie zależy od ziarna.
- **Łuk skrętu.** Pasy łączy łuk: krzywa Béziera od końca jednego pasa do początku drugiego, styczna do obu. Przejazd przez łuk ma prędkość `TURN_SPEED` i trafia do `turns`, jak zawrotka.
- **Trasy złożone.** Pasy połączone w ciąg tworzą jedną trasę złożoną (`TrafficRoute`), z sumą liczby aut i jednym rozkładem. Trasa może zamknąć się w pętlę. Jeśli się nie zamyka, jej ostatni koniec zachowuje się jak dziś.
- **Bez zmian:**
  - model rozkładu i czystość funkcji;
  - kontrakty w `core`;
  - schemat zapisu;
  - hash stanu, bo ruch do niego nie wchodzi.
- **Kod.** Łączenie siedzi w nowym module `packages/sim/src/content/traffic-junctions.ts`. `traffic.ts` ma już 426 linii (ADR-0031).
- **Skan:**
  - `lane-dead-end` ma spaść, a baza obniża się w tym samym commicie;
  - nowa kontrola: łuki skrętu leżą na nawierzchni drogi (`car-lane-off-road`) i poza budynkami (`lane-in-building`).

## Poza zakresem (dalej „na później” z ADR-0050)
- Pierwszeństwo i sygnalizacja. Auta z różnych tras dalej przejeżdżają przez siebie na skrzyżowaniu.
- Skręty w środku pasa, czyli na skrzyżowaniu, przez które pas przechodzi bez końca. Pas skręca tylko tam, gdzie się kończy.
- Wybór kierunku za każdym przejazdem. Trasa jest stała, a różnorodność daje liczba tras.

## Konsekwencje
- Auta przejeżdżają z ulicy na ulicę, zamiast stawać na końcu pasa. Znika większość z 33 ślepych końców na skrzyżowaniach (G-006).
- Końce G-024 łączą się z boczną ulicą, jeśli taka leży w zasięgu. Jeśli nie, zostają w rejestrze z pomiarem.
- Trasy są dłuższe i jest ich mniej. Identyfikatory tras się zmieniają, ale nic ich nie zapisuje.
- Gęstość ruchu na ulicy może się zmienić, bo auta rozkładają się po trasie złożonej. Budżety perf trzeba sprawdzić w `npr-perf`.
