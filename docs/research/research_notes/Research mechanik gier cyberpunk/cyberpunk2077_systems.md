# Cyberpunk 2077 (2.0/2.1 + Phantom Liberty): systemy budujące immersję i co z nich przenieść do Seki Senshi

Uwaga o źródłach: fandom wiki (cyberpunk.fandom.com) zwracało HTTP 402, a anglojęzyczna strona z notami 2.1 na cyberpunk.net zwracała 404. Fakty pochodzą więc z oficjalnej strony z notami 2.0 (cyberpunk.net), z ich przedruków (Shacknews), z Fextralife wiki, Gamer Guides oraz z prasy (PC Gamer, Kotaku, Shacknews, TechSpot, Siliconera, RPGamer, God is a Geek). Liczby z poradników fanowskich są oznaczone. Sekcja "Inferences" zawiera ocenę MVP dla Seki Senshi.

## 1. Tłum i żywe miasto (gęstość, reakcje NPC, sprzedawcy, ambient, reklamy, zmiany w 2.0)

### Takeaway
W źródłach udokumentowanych w tych notatkach wersja 2.0 nie przebudowała tłumu jako systemu. Zmieniło się co innego: policja patroluje ulice, NPC skalują się do poziomu gracza, a "Crowd Density" przeniesiono do ustawień grafiki. Na premierę krytykowano puste, mało reaktywne miasto i policję teleportującą się za plecy gracza. W notatkach nie potwierdziłem dokładnej logiki zachowań tłumu (kulenie się, ucieczka, dzwonienie po policję).

### Cited Findings
- 2.0: "Crowd Density" przeniesiono z zakładki Gameplay do Graphics. Jest powiązana z presetami grafiki i można ją ustawić osobno. Wskazuje to, że gęstość tłumu jest przede wszystkim budżetem wydajności — [CDPR, Update 2.0](https://www.cyberpunk.net/en/news/49060/update-2-0); [Shacknews, 2.0 patch notes](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- 2.0: "The NCPD will now be present in the world, actively patrolling the streets of Night City". Funkcjonariusze na miejscach przestępstw mogą sami rozpocząć pościg — [CDPR, Update 2.0](https://www.cyberpunk.net/en/news/49060/update-2-0)
- 2.0: wszyscy NPC skalują się do poziomu gracza. Usunięto odporności zwykłych NPC. Wrogowie mają tiery zależne od frakcji, a niektóre archetypy pancerz Low/Medium/High — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- 2.0: wrogowie szybciej wykrywają gracza, gdy ten chodzi lub sprintuje. Ulepszono AI wrogich netrunnerów. Wrogowie z Sandevistanem włączają go w odpowiedzi na Sandevistan gracza — [CDPR, Update 2.0](https://www.cyberpunk.net/en/news/49060/update-2-0)
- 2.0 (UX): stożki widzenia pokazują się tylko wtedy, gdy NPC reaguje na gracza albo walczy. Minimapa oddala się dynamicznie zależnie od prędkości — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- Recenzja 2.0: ruch uliczny i pieszy "feel more natural" w porównaniu z wcześniejszymi "sporadic roadblocks". Systemy policji i pojazdów oceniono jako "expected rather than groundbreaking" — [RPGamer, 2.0 deep look](https://rpgamer.com/?p=138544)
- Siliconera: NPC i wrogowie "react much better now in combat" — [Siliconera, 2.0/PL review](https://siliconera.com/?p=986460)
- Krytyka z premiery: Night City "often felt empty and unresponsive at launch". CDPR w ogłoszeniu o pracy przy sequelu (Orion, 2025) mówi o celu "the most realistic and reactive crowd system in any game to date" — [VGC](https://www.videogameschronicle.com/news/cyberpunk-2077s-sequel-is-aiming-for-the-most-realistic-crowds-in-any-game); [80.lv](https://80.lv/articles/cdpr-wants-cyberpunk-2077-sequel-to-have-most-realistic-crowd-system-ever)
- Dogtown (PL) dzieli recenzentów. Siliconera: "feels so alive" i robi wrażenie wizualnie. God is a Geek: wygląda jak reszta Night City i "never feels like a really new area" — [Siliconera](https://siliconera.com/?p=986460); [God is a Geek](https://godisageek.com/?p=284489)

### Inferences
- Lekcja z CP2077: wrażenie gęstego miasta robią światło, reklamy i wielu NPC w tle, ale brak spójnych reakcji jest od razu zauważany i krytykowany. Dla małej gry ważniejsze są wiarygodne reakcje kilkunastu NPC niż setki statystów.
- MVP dla Seki Senshi (ECS): dwa poziomy NPC.
  - "Statysta": tani, ze ścieżką po chodniku, bez harmonogramu, z prostą maszyną stanów calm → alarmed (kucnięcie, ręce na głowie) → flee (ucieczka od źródła zagrożenia) → recover po N sekundach. Wyzwalaczem jest zdarzenie `ShotFired`/`WeaponDrawn` w promieniu R.
  - "Mieszkaniec": już istniejący NPC z harmonogramem dnia.
  - Jeden losowy świadek (przez `RandomPort`) może "zadzwonić po policję" po opóźnieniu. Daje to graczowi okno na ucieczkę lub uciszenie świadka i od razu spina tłum z systemem heat.
- Gęstość tłumu jako parametr na chunk i porę dnia (dzień/noc już istnieje): więcej statystów wieczorem pod neonami. Parametr podpięty pod preset grafiki, jak w CP2077.
- Holoreklamy i neony to w NPR głównie warstwa renderingu: billboardy z animowaną teksturą i emisją. Są tanie i mocno budują klimat. Ambientowe wydarzenia (np. przyjazd karetki, bójka gangów) mogą być wpisami w harmonogramie chunka.
- Uliczni sprzedawcy: NPC-vendor ze stanowiskiem, otwarty według harmonogramu dnia/nocy. Sklepy już są, więc to głównie treść.

### Gaps
- Brak źródła (GDC, wywiad) opisującego logikę reakcji tłumu w CP2077: kulenie się, ucieczkę, telefon na policję i liczby NPC. Talk GDC o crowd systemie CP2077 nie wyszedł w wyszukiwaniu.
- Nie znalazłem źródeł o holoreklamach, ulicznych sprzedawcach jedzenia ani systemie ambient events jako mechanice.

## 2. NCPD heat / wanted po 2.0

### Takeaway
Wersja 2.0 wprowadziła pięciogwiazdkowy system Heat w stylu GTA ze stopniową eskalacją: patrole, potem cięższe oddziały i netrunnerzy, na końcu MaxTac z AV na 5 gwiazdkach. Do tego pościgi pojazdami, blokady i patrole w świecie. Heat gubi się, zrywając linię wzroku: gwiazdki przygasają, potem migają i wygasają. Na premierze policja po prostu pojawiała się tuż za graczem, co było jedną z głównych krytyk.

### Cited Findings
- Oficjalnie: "The NCPD will chase you when you commit a crime, whether on foot or in a vehicle". Typy jednostek i ich zachowanie zależą od Wanted Level. Pościgi mogą obejmować pojazdy NCPD, blokady i "MaxTac swooping in with AVs" — [CDPR, Update 2.0](https://www.cyberpunk.net/en/news/49060/update-2-0)
- Na maksymalnym Heat (5 gwiazdek) pojawiają się oddziały MaxTac i minibossowie. CDPR przedstawia to jako "surprise" mini-boss z różnymi archetypami. Policjantów da się też quickhackować — [GamingBolt](https://gamingbolt.com/cyberpunk-2077-update-2-0-police-system-includes-maxtac-mini-boss/amp); [Prima Games, 2.0 notes](https://primagames.com/tips/cyberpunk-2077-update-2-0-full-patch-notes-listed)
- Wyzwalacze (poradnik): krzywdzenie cywilów lub NCPD, wykrycie w strefach zastrzeżonych NCPD, kradzież radiowozu. Wrogowie (żółty szewron) są "fair game". Liberalne prawo o broni sprawia, że przypadkowe heat zdarza się głównie przez ofiary uboczne. Każda ofiara wśród cywilów podnosi poziom — [Gamer Guides, Police 2.0](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- Eskalacja według tego samego poradnika:
  - 1★: policjanci, którzy cię widzą, atakują i są widoczni na minimapie.
  - 2★: aktywne szukanie; radiowozy z dwoma policjantami jadą do ostatniej znanej pozycji.
  - 3★: czwórki w większych pojazdach, roboty, ciężko opancerzeni taktyczni, czasem snajperzy.
  - 4★: wrodzy netrunnerzy i APC (APC nie strzelają z działek).
  - 5★: MaxTac zrzucany z dropshipa; netrunnerzy NCPD mogą unieruchamiać pojazdy.
  - [Gamer Guides](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- Inny poradnik opisuje eskalację od "street troopers with basic armament and drones" do "armored teams and robots", z cięższymi jednostkami od 4★ — [Pro Game Guides](https://progameguides.com/cyberpunk-2077/cyberpunk-2-0-police-system-explained/)
- Gubienie heat: zerwij linię wzroku (zaułki, budynki, dużo skrętów, unikaj otwartych przestrzeni). Poza zasięgiem wzroku gwiazdki przygasają. Gdy pozostajesz niewykryty, migają, co oznacza koniec poszukiwań. NCPD nie przeszukuje dokładnie, więc wystarczy schować się za filarem, w skrzyni lub na dachu. Posiłki często pojawiają się na pobliskich drogach — [Gamer Guides](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)
- Premiera (1.0): policja pojawiała się natychmiast po przestępstwie i wciąż dospawnowywała, dopóki gracz nie uciekł. Nie było pościgów samochodowych. Quest designer przyznał, że pościgi były planowane, ale nie zdążono ich zrobić — [Purexbox](https://www.purexbox.com/news/2021/03/cyberpunk_2077s_patch_1_2_will_attempt_to_fix_the_much_complained_about_police_ai); [TechSpot](https://www.techspot.com/news/92709-cyberpunk-2077-dev-explains-lack-police-chases.html)
- 1.2: miało zmniejszyć spawnowanie za plecami gracza, a dron zwiadowczy sygnalizował, że policja ocenia sytuację. Kotaku: patch tylko opóźnił teleportujących się policjantów i odsunął ich spawn. Hotfix 1.21 naprawił policję pojawiającą się za graczem na dachach — [Shacknews 1.2](https://shacknews.com/article/123391/cyberpunk-2077-patch-12-will-change-how-police-spawn-improve-driving-systems); [Kotaku](https://kotaku.com/cyberpunk-2077-still-trying-to-fix-cops-with-latest-pat-1846680606); [PC Gamer 1.21](https://pcgamer.com/cyberpunk-2077-hotfix-stops-cops-from-teleporting-behind-you-during-roof-crimes)
- Recenzje 2.0: odpowiedź policji skaluje się z wanted level (Siliconera), "punishment fit the crime" (Press Start), ocena "expected rather than groundbreaking" (RPGamer) — [Siliconera](https://siliconera.com/?p=986460); [Press Start](https://press-start.com.au/reviews/xbox-series-x-reviews/2023/09/21/cyberpunk-2077-phantom-liberty-review/); [RPGamer](https://rpgamer.com/?p=138544)

### Inferences
- Najważniejsza lekcja: spawn musi być fizycznie wiarygodny, czyli poza kamerą, z określonego kierunku i z opóźnieniem. Teleport za plecy zniszczył immersję na premierze.
- MVP dla Seki Senshi bez pojazdów: 3 poziomy heat zamiast 5.
  - 1: patrol pieszy w chunku reaguje.
  - 2: posiłki "z ulicy" w punktach spawnu poza widokiem i strefa poszukiwań.
  - 3: elitarny oddział-miniboss jako odpowiednik MaxTac, np. zrzut z dachu lub windy, co pasuje do istniejącej pionowości mapy.
- Mechanika ucieczki: zapamiętana "ostatnia znana pozycja". Po zerwaniu LOS gwiazdki przygasają i rusza licznik (np. 20–40 s). Gdy dobiegnie końca, poziom spada o 1. Wszystko deterministycznie przez `ClockPort` i jako system ECS w `createSystems()`.
- Proste kryjówki (dach, wnętrze budynku, przejście do innego chunka) dobrze wykorzystują istniejące wspinanie, drabiny i windy.
- Spięcie z frakcjami: heat to osobny licznik "NCPD" obok reputacji frakcji. W dzielnicy gangu (analogia do Dogtown) policja może nie wchodzić.
- Zmiana kontraktu: nowe zdarzenia (`CrimeWitnessed`, `HeatChanged`) w `packages/core/src/events`, czyli ADR po stronie architekta.

### Gaps
- Brak oficjalnych liczb: czas wygasania gwiazdek, promień poszukiwań, punkty heat za konkretne przestępstwa.
- Nie potwierdziłem, czy w 2.0 jest widoczny na mapie obszar poszukiwań. Poradnik wspomina tylko niebieskie kropki na minimapie.
- Brak źródła na temat policji w Dogtown (PL).

## 3. Quickhacking i netrunning (RAM, kategorie, Breach Protocol, urządzenia, demony)

### Takeaway
Quickhacki kosztują RAM z cyberdecka. RAM regeneruje się poza walką oraz dzięki perkom i Overclockowi, który pozwala płacić zdrowiem. Hacki dzielą się na Covert, Combat, Control i Ultimate, i można je kolejkować. W 2.0 Breach Protocol (minigra z siatką kodów i buforem) przestał działać na wrogów. Służy teraz do terminali, Access Pointów, zaszyfrowanych shardów i airdropów, a demony z niego obniżają koszt RAM w sieci (ICEpick) albo dają łup (Datamine).

### Cited Findings
- Kategorie:
  - Covert: infiltracja, unikanie lub ucieczka przed uwagą.
  - Combat: obrażenia po wykryciu.
  - Control: utrudnianie przeciwnikom, w tym wyłączanie cyberware bossów.
  - Ultimate: najsilniejsze hacki, najdroższe w RAM i czasie uploadu, potencjalnie natychmiastowe zabicie.
  - Przykłady: Ping, Memory Wipe, Request Backup, Contagion, Overheat, Short Circuit, Synapse Burnout, Cripple Movement, Cyberware Malfunction, Reboot Optics, Weapon Glitch, Cyberpsychosis, Detonate Grenade, Suicide, System Collapse. Bait jest wymieniony bez przypisanej kategorii.
  - [Fextralife, Quickhack](https://cyberpunk2077.wiki.fextralife.com/Quickhack)
- RAM: zużywany przy uploadzie i regenerowany poza walką. Koszt modyfikują cyberware, perki i różnica poziomów. Maksymalny RAM rośnie z Intelligence, cyberware, perkami i jakością decka. Hacki można kolejkować na jednym wrogu, a niektóre zmieniają kolejne, np. czynią je nienamierzalnymi — [Fextralife, Quickhack](https://cyberpunk2077.wiki.fextralife.com/Quickhack)
- 2.0: przebalansowano koszty RAM, obrażenia i czas uploadu. "Removed the option to use Breach Protocol on enemies". Doszły tryb Overclock (upload kosztem zdrowia przy braku RAM) i perk do kolejkowania wielu hacków. Vendorzy nie sprzedają już komponentów do quickhacków — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes); [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0)
- Liczby perka Overclock (Intelligence, tier 15): +10% regeneracji RAM i +10% obrażeń quickhacków. Na poziomie 3 tryb Overclock pozwala przekroczyć RAM za 10 HP za każdą jednostkę ponad maksimum, trwa 14 s i ma cooldown 30 s — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Breach Protocol po 2.0: do terminali i komputerów (zasoby), zaszyfrowanych shardów i airdropów. Większość quickhacków jest teraz "traceable", czyli wroga sieć może namierzyć gracza. Jedyny perk wpływający na Breach to Forcekill Cypher — [Game8](https://game8.co/games/Cyberpunk-2077/archives/313542); zob. też [Gamepressure, hacking](https://www.gamepressure.com/cyberpunk-2077/hacking/z7c78e)
- Minigra: wybierasz kody z siatki naprzemiennie z podświetlonego wiersza i kolumny, wpisując je do bufora o ograniczonej długości. Ułożenie wymaganej sekwencji aktywuje demona — [Gamepressure](https://www.gamepressure.com/cyberpunk-2077/hacking/z7c78e)
- Demony: każdy deck ma ICEpick, który obniża koszt RAM quickhacków na wrogach i urządzeniach w tej sieci. Datamine na Access Poincie daje pieniądze, komponenty, czasem nowy quickhack — [Fextralife, Quickhack](https://cyberpunk2077.wiki.fextralife.com/Quickhack)
- Netrunnerzy wrogów mają lepsze AI w 2.0 (zob. sekcja 1), a na 4★ heat pojawiają się netrunnerzy NCPD (zob. sekcja 2) — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0); [Gamer Guides](https://gamerguides.com/cyberpunk-2077/guide/introduction/guide-information/police-and-wanted-levels-in-cyberpunk-patch-2-0)

### Inferences
- Seki Senshi ma już kontrakt "hack a terminal" oraz cyberware i zdolności. Quickhacking to naturalne rozszerzenie z dobrym stosunkiem efektu do kosztu.
- MVP:
  1. Skan (przytrzymanie klawisza) z podświetleniem obiektów hakowalnych w NPR, np. kolorowym outline.
  2. Zasób RAM jako komponent ECS z regeneracją przez `ClockPort`.
  3. 4–6 hacków: Distract/Bait na urządzeniu (radio, automat), Camera Loop lub Disable Camera, Turret Friendly-fire, Reboot Optics (wróg tymczasowo ślepy), Short Circuit (obrażenia), jeden Ultimate (np. Overheat lub System Collapse dla elit).
  4. Czas uploadu z paskiem i "trace", który może podnieść alert. Daje to grę napięcia bez dużej złożoności.
- Breach Protocol jako minigra w React HUD jest tania: siatka 5x5, bufor 4–6, 1–3 sekwencje (demony), seed z `RandomPort`. Efekty: zniżka RAM w sieci (ICEpick), łup (Datamine), wyłączenie kamer w sieci. W duchu 2.0 należy ją ograniczyć do terminali i Access Pointów, nie do wrogów.
- Sieci: urządzenia w chunku należą do "sieci" danego obiektu. Prosta tabela w sim, bez potrzeby fizyki.

### Gaps
- Brak potwierdzonych liczb RAM i czasu uploadu dla poszczególnych hacków w 2.x. Fandom był niedostępny, a Fextralife nie podaje ich na stronie zbiorczej.
- Nie zweryfikowałem pełnego przypisania hacków do kategorii ani szczegółów "trace" w 2.0.

## 4. Cyberware po 2.0 (capacity, sloty, ripperdoc) i drzewo Relic (Phantom Liberty)

### Takeaway
Wersja 2.0 zrobiła z cyberware główne źródło pancerza i ograniczyła je pulą Cyberware Capacity. Według Gamer Guides start to 24, +3 za poziom, 201 na poziomie 60. Pulę zwiększają shardy, perki (Edgerunner +50 z karą do HP) i umiejętność Engineer. Implanty są "Attuned" do atrybutów, a część slotów odblokowują perki. Phantom Liberty dodało drzewo Relic za Relic Points z terminali Militechu w Dogtown: 9 perków, 15 punktów.

### Cited Findings
- "The number of cyberware implants your body can handle is now determined by your Cyberware Capacity". Pancerz pochodzi głównie z cyberware, ubrania są w dużej mierze kosmetyczne. Implanty są Attuned do atrybutów: im wyższy atrybut, tym mocniejszy bonus. Niektóre sloty odblokowują perki. Nowy przedmiot to Cyberware Capacity Shards — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0); [Prima Games](https://primagames.com/tips/cyberpunk-2077-update-2-0-full-patch-notes-listed)
- Liczby (poradnik): start 24, +3/poziom, 201 na poziomie 60.
  - Edgerunner: +50 capacity, każdy punkt ponad limit kosztuje 0,5% maks. HP, maksymalnie 25%. Wymaga TA 20.
  - Renaissance Punk: +4 za każdy atrybut ≥9.
  - All Things Cyber: −20% kosztu cyberware integumentary i skeleton.
  - Engineering: +5 na poziomie 10, +10 na poziomie 30.
  - Shardy wypadają losowo z wrogów i pojemników.
  - [Gamer Guides, capacity 2.0](https://gamerguides.com/cyberpunk-2077/guide/cyberware-and-armor/cyberware/cyberware-capacity-shards-how-to-increase-cyberware-capacity-in-patch-2-0)
- Ripperdoc UI w 2.0: gracz siada na fotelu operacyjnym i widzi animacje zależne od typu implantu. Można tam ulepszać cyberware i zmieniać tatuaże. Capacity widać po lewej stronie ekranu ripperdoca — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0); [Shacknews, capacity](https://shacknews.com/article/137236/how-to-increase-cyberware-capacity-cyberpunk-2077)
- Poza cyberware ulepszać da się tylko bronie Iconic. Rzadkości zastąpiono Tierami 1–5++ — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- Relic (PL): 9 perków, 15 punktów na wszystkie, punkty z Militech Data Terminals w Dogtown, bez Perk Points.
  - Emergency Cloaking: Optical Camo w walce sprawia, że wrogowie tracą gracza z oczu, co daje szansę wyjścia z walki.
  - Vulnerability Analytics: wykrywa słabe punkty w pancerzu i cyberware wroga; trafienie daje 100% crit i 25% penetracji; zniszczenie wywołuje EMP w promieniu 3 m.
  - Machine Learning: stackujące się bonusy, 25 s, do 5 stacków.
  - Jailbreak: nowe zdolności broni ramion (Mantis Blades, Gorilla Arms, Projectile Launch System, Monowire).
  - Spatial Mapping: skok z Mantis Blades okalecza.
  - Limiter Removal: fala uderzeniowa Gorilla Arms przewraca wrogów.
  - Data Tunneling: quickhacki przez Monowire przeskakują na kolejnych wrogów.
  - [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)

### Inferences
- Capacity to tani i czytelny limit. Seki Senshi ma już cyberware, więc wystarczy dodać koszt implantu (np. 2–8) i pulę rosnącą z poziomem i shardami. Zamienia to "kolekcjonowanie wszystkiego" w decyzję build-ową.
- Powiązanie z atrybutem (Attuned) to jedna formuła statów. Łatwe w core.
- Ripperdoc jako scena: animacja na fotelu i krótki efekt glitch w NPR to tani, a bardzo immersyjny moment. Lepszy niż sam ekran menu.
- Mini "Relic" dla Seki Senshi: osobne fabularne drzewo 4–5 perków za punkty z konkretnych terminali w aktach I–II. "Słabe punkty" (Vulnerability Analytics) dobrze pasują do istniejących stref trafień.
- Zmiana schematu zapisu (capacity, punkty relic) wymaga podbicia `SAVE_SCHEMA_VERSION` i migracji.

### Gaps
- Brak oficjalnych liczb capacity. Pochodzą z jednego poradnika (Gamer Guides) i nie zweryfikowałem ich drugim źródłem.
- Nie potwierdziłem dokładnej listy typów slotów (Frontal Cortex, Arms, Skeleton, Nervous System, Integumentary, Hands, Legs, Eyes, Circulatory, Operating System) ani ich liczby w 2.x. Znam je z wiedzy ogólnej, bez źródła.

## 5. Perki i atrybuty po 2.0

### Takeaway
Wersja 2.0 zastąpiła wiele drobnych perków mniejszą liczbą perków "zmieniających grę". Drzewa są przypięte do 5 atrybutów, z progami 4/9/15/20. Pięć umiejętności (Headhunter, Netrunner, Shinobi, Solo, Engineer) daje pasywne bonusy co 5 poziomów, maksymalnie do 60. Kluczowe perki ruchowe i bojowe to Dash, Air Dash, Bullet Deflect, Adrenaline Rush, Overclock i Bolt shots.

### Cited Findings
- Drzewa przebudowano na mniej perków o większym efekcie. Zwrócono punkty, a atrybuty można zresetować raz. Perki można zwracać pojedynczo za darmo, usunięto reset wszystkich naraz. Postęp w drzewach odblokowuje zdolności jak tryb Overclock i Bolt shots. Umiejętności połączono w pięć (Headhunter, Netrunner, Shinobi, Solo, Engineer) z bonusem co 5 poziomów, do 60 — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- Atrybuty: Body, Cool, Intelligence, Reflexes, Technical Ability. Perki odblokowują się przy atrybucie 4/9/15/20. Fextralife jest niespójne co do nazw progów — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Dash (Reflexes 9): −20% staminy na unik i dash. Poziom 2 zastępuje unik dashem i automatycznie przeskakuje niskie przeszkody — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Air Dash (Reflexes 15): −20% staminy na dash, +20% prędkości dasha, poziom 3 daje dash w powietrzu — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Bullet Deflect (Reflexes 9): przy staminie >33% blok odbija pociski w stronę celownika. Blokowanie pocisków ostrzami daje perk Lead and Steel. Wiki pisze ogólnie o "Blades", nie tylko o kataną — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Adrenaline Rush (Body 15): +35 maks. HP, +20% regeneracji, tryb Adrenaline Rush na poziomie 3 — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)
- Perki pozwalają używać Sandevistana i Kerenzikova w pojazdach. Doszły też perki pojazdowe, np. quickhackowanie pojazdów — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0)
- Vanishing Act: Optical Camo włącza się automatycznie przy crouch-sprincie lub ślizgu — [Fextralife, Perks](https://cyberpunk2077.wiki.fextralife.com/Perks)

### Inferences
- Filozofia 2.0 ("mniej, ale zmieniających sposób gry") pasuje do małej gry: 3–4 drzewa po 6–8 perków, w każdym 1–2 "zdolności" (aktywny tryb).
- Seki Senshi ma już parry i block, więc Bullet Deflect (parry pocisków kataną przy staminie >X, odbicie w kierunku celownika) to mocny "fantazyjny" perk przy umiarkowanym koszcie w sim. Wymaga kolizji pocisk–ostrze w oknie bloku.
- Dash i Air Dash rozszerzają istniejące skok i mantle: dash naziemny, a potem jeden dash w powietrzu jako perk. Dobrze współgra z pionową mapą.
- Darmowy respec pojedynczych perków zmniejsza frustrację i ułatwia testowanie buildów.

### Gaps
- Nie zebrałem pełnej listy perków ani liczby perk pointów na poziom w 2.x.

## 6. Gigi fixerów i NCPD Scanner Hustles

### Takeaway
Gigi to jednorazowe, niebieskie znaczniki na mapie, przypisane do fixera dzielnicy i odblokowywane progiem Street Cred lub ukończeniem innych zadań. Fixer dzwoni, gdy gracz zbliża się do miejsca gigu. Jest 89 gigów w 6–7 typach plus 8 w PL. Scanner Hustles to szybkie, jednorazowe starcia ("idź, zabij"), od 1.5 widoczne dopiero z bliska. Nie potwierdziłem w źródłach szczegółów bonusów za stealth.

### Cited Findings
- Gigi są opcjonalne, jednorazowe, niebieskie na mapie i zlecane przez fixerów za eurodolary. Część pojawia się tylko nocą. Po dotarciu na miejsce fixer dzwoni z opisem misji — [Fextralife, Gigs (via search)](https://cyberpunk2077.wiki.fextralife.com/Gigs); [Commonsense Gamer](https://commonsensegamer.com/cyberpunk-2077-side-missions-guide/)
- 89 gigów w typach: Thievery 21, Cyberpsycho Sighting 17, SOS: Merc Needed 16, Gun for Hire 14, Search and Recover 10, Agent Saboteur 9, Special Delivery 2. Fixerzy przypisani do dzielnic: Watson (Regina Jones), Westbrook (Wakako), Heywood (Padre), City Center (Dino), Santo Domingo (El Capitan), Pacifica (Mr. Hands), Badlands (Dakota). Rogue daje losowe gigi. Liczba gigów na dzielnicę: Watson 29 … Pacifica 3. PL dodaje 8 gigów — [Fextralife, Gigs](https://cyberpunk2077.wiki.fextralife.com/Gigs)
- Część gigów wymaga progu Street Cred. Według relacji graczy fixerzy wydają gigi partiami po 2–3, a Scanner Hustles pomagają podnieść Street Cred, gdy kolejna partia się nie pojawia. Maksymalny Street Cred to 50 — [Steam discussion](https://steamcommunity.com/app/1091500/discussions/0/4997318143959695414); [PowerPyx](https://www.powerpyx.com/cyberpunk-2077-all-gigs-list-walkthroughs/)
- Scanner Hustles: szybkie zdarzenia jednoetapowe ("go to a location and kill the enemies"), znikają po ukończeniu. Od patcha 1.5 pojawiają się na mapie dopiero z bliska — [Commonsense Gamer](https://commonsensegamer.com/cyberpunk-2077-side-missions-guide/)
- 2.0: fixerzy przestali pisać SMS-y o pojazdach na sprzedaż. Był to częsty zarzut spamu w telefonie — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0)

### Inferences
- Seki Senshi ma już typy kontraktów pokrywające się z gigami CP2077: eliminate (Gun for Hire), protect (SOS), retrieve (Search and Recover / Thievery), infiltrate (Agent Saboteur), hack. Brakuje głównie warstwy dostarczania i nagradzania.
- MVP:
  1. Fixer per dzielnica jako postać z ink-dialogiem.
  2. Odblokowanie partiami po 2–3 według progu reputacji.
  3. "Holocall" od fixera przy wejściu w strefę gigu, z krótkim briefingiem w ink.
  4. Opcjonalne cele (bez wykrycia, bez ofiar wśród cywilów, cel żywy) z bonusem eddies i reputacji. W CP2077 to częsty motyw, ale bez potwierdzonego źródła, więc jako propozycja.
  5. Krótki telefon fixera po zakończeniu, reagujący na sposób wykonania. Tani sposób na reaktywność.
- Scanner Hustle MVP: losowane (przez `RandomPort`) mikro-zdarzenia w chunku (napad gangu, cyberpsycho jako miniboss rzadko) z ikoną widoczną dopiero z bliska. Wypełnia miasto treścią między kontraktami i daje Street Cred.

### Gaps
- Nie potwierdziłem w źródłach mechaniki bonusu za stealth lub non-lethal w gigach ani dokładnych nagród (eddies, Street Cred na gig).
- Brak źródła o typach Scanner Hustles w 2.x i o Dogtown airdrops (PL).

## 7. Telefon, holocalle, radio, vendorzy, crafting, braindance

### Takeaway
Telefon (połączenia i SMS-y od fixerów i postaci) jest głównym kanałem dostarczania zadań. W 2.0 przebudowano jego UI i ograniczono spam. Radio działało w samochodzie, a 2.1 dodało Radioport (radio na piechotę i w metrze) oraz 3 nowe stacje. Crafting w 2.0 uproszczono do jednego typu komponentu, a loot skaluje się z poziomem. Braindance to edytor nagrania z trzema warstwami (wizualna, audio, termiczna) i osią czasu ze wskazówkami: liniowa, ale charakterystyczna mechanika śledcza.

### Cited Findings
- 2.0: "Overhauled the phone UI to be more intuitive". Fixerzy nie piszą już o pojazdach na sprzedaż. Przebudowano Quest Journal — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0)
- Nowe stacje w 2.0: 89.7 Growl FM (utwory społeczności, DJ Ash, głos Sasha Grey), Impulse 99.9 (remiksy Idrisa Elby), 107.5 Dark Star (elektronika) — [CDPR](https://www.cyberpunk.net/en/news/49060/update-2-0)
- 2.1 (5 grudnia 2023): Radioport pozwala słuchać radia na piechotę i w metrze. Przełącza się na radio samochodowe po wejściu do pojazdu i wyłącza przy muzyce questowej. Metro NCART: 19 stacji, 5 linii, jazda lub fast travel (wcześniej stacje były tylko węzłami fast travel albo wymagały moda). Powtarzalne wyścigi, powtarzalne "Hangouts" z partnerami romansowymi — [Dexerto, 2.1 notes](https://www.dexerto.com/cyberpunk-2077/cyberpunk-2077-update-2-1-patch-notes-metro-system-new-vehicles-radioport-more-2413780/); [The Sixth Axis](https://www.thesixthaxis.com/2023/12/05/cyberpunk-2077-update-2-1-adds-radioport-feature-and-replayable-car-races/); [Shacknews 2.1](https://www.shacknews.com/article/137986/cyberpunk-2077-update-2-1-patch-notes)
- Vendorzy po 2.0: nie sprzedają komponentów do quickhacków ani craftingu. Asortyment skaluje się z poziomem i rośnie z Tierem. Sklepy z ubraniami dają dostęp do Wardrobe. Pojazdy kupuje się przez netpage AUTOFIXER lub terminale na stacjach. Podgląd ubrań i broni także w ekwipunku — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- Crafting po 2.0: jeden typ komponentu zamiast wielu. Mod wyższej jakości powstaje z dwóch niższych. Poza cyberware ulepsza się tylko bronie Iconic. Loot skaluje się z poziomem, usunięto nadmiar łupu, NPC nie upuszczają ubrań — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)
- Braindance, warstwy:
  - Wizualna: swobodna kamera i ukryte detale, np. szuflada otwierająca się na moment.
  - Audio: źródła dźwięku jako zielone fale; najechanie izoluje dźwięk, np. rozmowę za ścianą.
  - Termiczna: ciepło i zimno, np. szukanie obiektu przechowywanego w ujemnej temperaturze.
  - Oś czasu z zakreskowanymi fragmentami wskazuje, gdzie są wskazówki.
  - [PC Gamer, BD editor](https://pcgamer.com/how-to-use-cyberpunk-2077-braindance-editor); [GameWatcher](https://www.gamewatcher.com/cyberpunk-2077-braindance-guide)
- Wskazówki pojawiają się tylko wtedy, gdy nagrywana osoba jest blisko nich, i trzeba je zeskanować we właściwej warstwie — [Vulkk](https://vulkk.com/2020/12/10/how-braindance-works-in-cyberpunk-2077/)

### Inferences
- Telefon MVP w React HUD to bardzo dobry stosunek kosztu do efektu. Trzy zakładki: Wiadomości (wątki SMS z ink, z możliwością odpowiedzi wyborem), Kontakty (zadzwoń do fixera lub postaci), Połączenie przychodzące (holocall jako mały portret VRoid w rogu z napisami i tekstem z ink, bez zatrzymywania gry). Lekcja z CP2077: unikać spamu (afera z SMS-ami o samochodach) i ograniczać wiadomości do fabularnie istotnych.
- Radio MVP: 2–3 "stacje" jako playlisty z krótkimi wstawkami DJ-a i reklamami w eterze (tekstowo lub TTS), dostępne "na piechotę" jak Radioport. Plus radia diegetyczne w barach i sklepach z dźwiękiem przestrzennym. Prawa do muzyki: tylko własna lub CC0.
- Crafting: lekcja z 2.0 to upraszczanie (jeden typ komponentu, scalanie 2 modów w 1 lepszy). MVP: rozbiór łupu na "części" i ulepszenie wybranej broni lub implantu o jeden Tier u NPC lub w warsztacie. Bez drzew receptur.
- Drop points (automaty "sprzedaj łup" bez rozmowy z NPC) są tanie jako obiekt w świecie. Brak jednak źródła na ich obecny stan w 2.x.
- Braindance MVP jako specjalna misja śledcza: odtworzenie krótkiej sceny (nagrana sekwencja zdarzeń sim, którą sim deterministyczny umożliwia natywnie: replay z seeda), pauza i przewijanie, przełącznik 2 warstw (wizualna i "termiczna" jako inny shader NPR), 3–4 punkty do zeskanowania. Determinizm ECS to tu realna przewaga: replay jest prawie za darmo.

### Gaps
- Brak potwierdzonych informacji o drop pointach w 2.x i o UX holocalli (np. czy blokują ruch).
- Brak danych o liczbie stacji radiowych łącznie. Z wiedzy ogólnej: ok. 13–14 stacji z DJ-ami, ale bez źródła.

## 8. Pojazdy, taxi i fast travel

### Takeaway
2.0 dodało walkę z pojazdów i pościgi policyjne. 2.1 dodało metro NCART (19 stacji, 5 linii) do jazdy lub szybkiej podróży. Dla małej gry z kilkoma dzielnicami ważniejsza od samochodów jest diegetyczna szybka podróż (metro lub taksówka z krótką sceną przejazdu), która daje "miejski" klimat bez kosztu fizyki pojazdów.

### Cited Findings
- 2.0: walka podczas jazdy w FPP i TPP (pistolety, SMG, leczenie), bronie montowane w niektórych pojazdach, walka wręcz na motocyklu, strzelanie i cięcie opon, perki pojazdowe — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes); [CDPR, vehicle combat preview](https://www.cyberpunk.net/en/news/48874/whats-coming-in-update-2-0-vehicle-combat-and-car-chases)
- 2.1: NCART, 19 stacji na 5 liniach, jazda lub fast travel. Radio działa w metrze — [Dexerto](https://www.dexerto.com/cyberpunk-2077/cyberpunk-2077-update-2-1-patch-notes-metro-system-new-vehicles-radioport-more-2413780/)
- Na premierze nie było pościgów, bo nie zdążono ich zrobić — [TechSpot](https://www.techspot.com/news/92709-cyberpunk-2077-dev-explains-lack-police-chases.html)
- Minimapa w 2.0 oddala się dynamicznie zależnie od prędkości (adaptacja do jazdy) — [Shacknews](https://www.shacknews.com/article/137150/cyberpunk-2077-update-2-patch-notes)

### Inferences
- Pojazdy sterowane przez gracza w Seki Senshi to nieproporcjonalny koszt: fizyka, streaming chunków przy dużej prędkości, AI ruchu. Nie zalecam ich w MVP.
- Zalecane: metro lub monorail jako diegetyczny fast travel między dzielnicami. Peron w każdej dzielnicy, krótka scena w wagonie (okno z przesuwającym się paralaksem NPR, radio i Radioport, tłum statystów, czasem ambientowa rozmowa z ink). Czas jazdy maskuje ładowanie chunków, a to realna korzyść techniczna przy streamingu.
- Taksówka lub autonomiczny "Delamain-lite": wezwanie z telefonu, wsiadanie, przejście ekranu, wysiadka. Ruch uliczny jako tło: pojazdy na szynach-splajnach bez fizyki, z reakcją na strzały (zatrzymanie, trąbienie).

### Gaps
- Brak danych o tym, jak gracze oceniają metro w 2.1 (popularność, odbiór).
