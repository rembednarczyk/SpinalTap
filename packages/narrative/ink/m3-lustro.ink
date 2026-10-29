// Seki Senshi, M3: act II of the main thread, "Lustro" (ADR-0023).
// Starts right after act I. The opening and Ren's first words follow the act-I ending (story_ending)
// and choices (choice_case, choice_crash). The domain keeps every choice (story_choice) and the
// runtime syncs them back into the choice_* variables before every conversation. The act-II
// ending follows from choice_archive; end_act2() asks the sim to resolve it.

VAR choice_rooftop = ""
VAR choice_voice = ""
VAR choice_job = ""
VAR choice_archive = ""
// The act-II ending actually reached, empty until end_act2() was applied.
VAR act2_ending = ""
VAR kagami_stance = "neutral"

EXTERNAL end_act2()

// Plays on its own once act I is over (pendingScene in core).
=== act2_opening ===
{ story_ending == "aya":
    -> module_voice
}
-> sold_module

= module_voice
Za drzwiami kliniki moduł za uchem zaczyna szumieć. Najpierw jak deszcz, potem jak radio między stacjami.
REN: Aya? Jeśli to słyszysz, to dalej go nosisz. Nie wyłączaj się, proszę.
{ choice_crash == "ren":
    Ten sam głos co w słuchawce tamtej nocy. Tylko że teraz drży.
}
REN: Kagami też słucha tego kanału, więc krótko. Żyję. Mam coś, co należy do ciebie.
REN: Babcia Ume wie, gdzie mnie szukać. Nikomu innemu nie mów.
Szum urywa się w pół słowa. Zostaje po nim ból głowy i imię: Ren.
~ set_flag("seen:act2_opening")
-> END

= sold_module
Na optyce miga wiadomość od Kaito. Krótka, jak zawsze, kiedy chodzi o coś ważnego.
KAITO: Mori sprzedał fiolkę z twoim modułem. Nie leżała długo na półce.
KAITO: Kupił ją chłopak z wężem Hebi na karku. Zapłacił gotówką i pytał, czy jeszcze żyjesz.
{ choice_crash == "ren":
    Wąż Hebi na karku. Ren miał taki tatuaż. Ren, którego głos prowadził cię pod wiadukt.
}
Kazałaś sprzedać moduł komuś, kto lubi cudze życie. Ktoś je kupił w jeden dzień.
~ set_flag("seen:act2_opening")
-> END

// Ren Odagiri on the low roof over the market on Podzamcze (present from ren_trail until the "kagami" ending).
=== ren_odagiri ===
{
- act2_ending == "street": -> after_street
- act2_ending == "hebi": -> after_hebi
- quest_step == "meet_ren": -> first_meeting
- quest_step == "overpass" && choice_archive != "" && cleaners_down(): -> finale
- quest_step == "overpass" && has_flag("kagami_ambush"): -> under_fire
}
-> waiting

= first_meeting
Pod plandeką rozpiętą między antenami siedzi chudy chłopak. Na karku ma wytatuowanego węża Hebi.
{ story_ending == "aya":
    REN: Aya. Jednak przyszłaś. Bałem się, że Kagami znajdzie cię pierwsze.
- else:
    REN: Mori mówił, że nie chcesz już tego pamiętać. A jednak przyszłaś.
    Ren obraca w palcach szklaną fiolkę. W środku leży twój moduł.
}
- (talk)
* { choice_crash == "ren" } [Tamtej nocy słyszałam w słuchawce twój głos. #tone:lifepath]
    SEKI: Tamtej nocy słyszałam w słuchawce twój głos. Kazałeś mi jechać prosto.
    REN: Wiem, co słyszałaś. Ja wtedy leżałem w furgonetce Kagami z workiem na głowie. Nikt mi nie dał mikrofonu.
    -> talk
* { choice_crash == "wheel" } [Pamiętam wypadek. Sama skręciłam. #tone:lifepath]
    SEKI: Pamiętam wypadek. Sama skręciłam.
    REN: I dlatego żyjesz. Dron miał cię doprowadzić pod wiadukt, tam czekała ich ekipa.
    -> talk
* { choice_case == "opened" } [Widziałam chip ze swoim imieniem. #tone:lifepath]
    SEKI: Widziałam chip ze swoim imieniem. W tamtej walizce.
    REN: Wyjąłem go, zanim zabrali nam walizkę. Noszę go przy sobie od dwóch lat.
    -> talk
* { choice_case == "sealed" } [Nigdy nie zajrzałam do tej walizki. #tone:lifepath]
    SEKI: Nigdy nie zajrzałam do tej walizki.
    REN: Ja zajrzałem. Pięćdziesiąt chipów, na każdym czyjeś imię. Na jednym twoje.
    -> talk
* [Czego ode mnie chcesz? #tone:main]
    SEKI: Czego ode mnie chcesz?
    REN: Chcę ci coś oddać. I poprosić o pomoc, bo sam już nie dam rady.
    -> offer

= offer
REN: Kagami nagrało cię, zanim zaczęli nadpisywać. Zapis zero. Ty sprzed stołu i sprzed wypadku.
Ren wyjmuje z kieszeni chip w folii. Na naklejce jest imię Aya i data sprzed dwóch lat.
{ story_ending == "aya":
    REN: Moduł za twoim uchem go odczyta. Wystarczy przyłożyć.
- else:
    REN: Moduł mam tutaj, a w fiolce jest złącze. Podepnę cię kablem na kilka minut. Mori mówił, że to bezpieczne.
}
REN: Reszta archiwum leży u mnie. Kagami chce je z powrotem i wystawiło na mnie zlecenie. Kaito je ma.
* [Daj mi ten chip. #tone:main]
    SEKI: Daj mi ten chip. Chcę wiedzieć, kim byłam.
    REN: Usiądź. Za pierwszym razem zawsze kręci się w głowie.
* [Skąd mam wiedzieć, że ten zapis jest prawdziwy? #tone:main]
    SEKI: Skąd mam wiedzieć, że ten zapis jest prawdziwy?
    REN: Nie masz skąd. Ale to jedyny zapis, którego Kagami nie zdążyło poprawić.
- Chip jest ciepły od jego kieszeni. Za uchem coś przeskakuje.
~ set_flag("met_ren")
-> END

= waiting
{ quest_step == "kaito_job":
    REN: Idź do Kaito. Chcę wiedzieć, ile jestem dla nich wart.
- else:
    REN: Kurosawa czeka na wiadukcie. Cokolwiek postanowisz, ja tu będę.
}
-> END

= under_fire
REN: Słyszę strzały aż tutaj. Kurosawa przyprowadził ludzi. Wróć, jak będzie po wszystkim.
-> END

= finale
{ choice_archive == "street":
    REN: Było słychać, że nie dogadałaś się z Kurosawą.
    SEKI: Archiwum wraca do ludzi, których nagrali. Ume będzie wiedziała, do kogo należą te imiona.
    REN: Część z nich już nie żyje. Część nie będzie chciała pamiętać.
- else:
    REN: Kurosawa nie lubi, jak mu się odmawia. Było słychać aż tutaj.
    SEKI: Archiwum zostaje u ciebie. Sprzedaj je przez Hebi albo komu chcesz, byle nie Kagami.
    REN: Hebi zapłacą dobrze. Ludzie zapłacą jeszcze lepiej, żeby odkupić własne wspomnienia. Wiem, jak to brzmi.
}
{ choice_voice == "listened":
    SEKI: Sprzedałeś im swój głos, Ren. Słyszałam to w słuchawce.
    REN: Rok przed tamtym kursem, za tysiąc eddies. Mówili, że to do reklamy. Nie wiedziałem, do czego go użyją.
}
{ choice_rooftop == "together":
    REN: Obiecałem ci morze. Wciąż tam jest, jakby co.
- else:
    REN: Mówiłaś, że pojedziesz sama. Ja i tak siedziałem na kanale.
}
{ story_ending == "aya":
    REN: I uważaj na moduł. Kagami wie już, gdzie go szukać.
- else:
    Ren oddaje ci fiolkę z modułem. Nie wiesz jeszcze, co z nią zrobisz.
}
~ end_act2()
{ choice_archive == "street":
    Schodzisz z dachu z walizką pełną cudzych żyć. Na każdym chipie jest czyjeś imię i czyjś adres.
- else:
    Schodzisz z dachu z połową zapłaty w kieszeni. Za tobą Ren już dzwoni do Hebi.
}
-> END

= after_street
REN: Ume chodzi od drzwi do drzwi z chipami. Jedni płaczą, inni zatrzaskują jej drzwi przed nosem.
-> END

= after_hebi
REN: Hebi biorą już zamówienia. Wiesz, ile ktoś da za wspomnienie własnego ślubu?
-> END

=== function cleaners_down() ===
~ return has_flag("dead:kagami-cleaner-1") && has_flag("dead:kagami-cleaner-2") && has_flag("dead:kagami-cleaner-3")

// Kurosawa of Kagami on the al. Tysiąclecia viaduct deck (present from kagami_job until the ambush or the ending).
=== kurosawa ===
{ quest_step == "overpass" && choice_archive == "":
    -> deal
}
KUROSAWA: Czekam na kogoś. Proszę nie zasłaniać mi widoku.
-> END

= deal
KUROSAWA: Kurosawa, Kagami Biotech, dział odzysku. Wiem, kim pani jest. Wiemy to lepiej niż pani.
{ choice_job == "taken":
    KUROSAWA: Kaito mówił, że przyjęła pani zlecenie. To upraszcza rozmowę.
- else:
    KUROSAWA: Kaito mówił, że pani odmówiła. A jednak pani tu jest.
}
{ story_ending == "aya":
    KUROSAWA: Moduł w pani głowie należy do nas. Na razie niech zostanie tam, gdzie jest.
- else:
    KUROSAWA: Wyjęła pani nasz moduł i sprzedała. Odagiri go kupił, więc wróci do nas razem z nim.
}
KUROSAWA: Propozycja jest prosta. Odagiri i archiwum dla nas. Dla pani pełny zapis sprzed stołu. Dzieciństwo, matka, imię.
{ choice_voice == "listened":
    Znasz ten ton. Tak samo znudzony był technik w słuchawce, kiedy wyłączał filtr Odagiri.
}
- (ask)
* [Ile z tego zapisu jest prawdziwe? #tone:optional]
    SEKI: Ile z tego zapisu jest prawdziwe?
    KUROSAWA: Tyle, ile pani zechce. Prawdziwe jest to, co się pamięta.
    -> ask
* { choice_voice == "listened" } [Kto mówił do mnie głosem Rena? #tone:lifepath]
    SEKI: Kto mówił do mnie głosem Rena tamtej nocy?
    KUROSAWA: Nasz technik. Odagiri sprzedał nam próbkę głosu rok wcześniej. Mamy na to pokwitowanie.
    -> ask
* [Archiwum wraca do ludzi, których nagraliście. #tone:main]
    ~ choice_archive = "street"
    ~ story_choice("archive", "street")
    SEKI: Archiwum wraca do ludzi, których nagraliście. Każdy chip do swojego właściciela.
    KUROSAWA: Szkoda. Dział odzysku nie negocjuje dwa razy.
    -> ambush
* [Archiwum zostaje u Rena. #tone:main]
    ~ choice_archive = "hebi"
    ~ story_choice("archive", "hebi")
    SEKI: Archiwum zostaje u Rena. Hebi zapłacą za nie uczciwiej niż wy.
    KUROSAWA: Uczciwiej. Ciekawe słowo w ustach kogoś, kto nie wie, czyje ma wspomnienia.
    -> ambush
* [Bierzcie Rena i archiwum. Chcę swój zapis. #tone:main]
    ~ choice_archive = "kagami"
    ~ story_choice("archive", "kagami")
    SEKI: Bierzcie Rena i archiwum. Chcę swój zapis.
    KUROSAWA: Rozsądnie. Nasi ludzie zdejmą go z dachu jeszcze tej nocy.
    Kurosawa podaje ci chip w białym etui. Jest zimny, jakby leżał w lodówce.
    { choice_rooftop == "together":
        Ren obiecywał ci morze. Kagami obiecuje tylko tyle, że wszystko będzie się zgadzać.
    }
    ~ end_act2()
    Kurosawa odchodzi w stronę windy. Nie odwraca się.
    -> END

= ambush
Kurosawa unosi dwa palce i odchodzi w stronę windy. Od strony szybu idą ludzie w kamizelkach Kagami.
~ set_flag("kagami_ambush")
-> END

// Plays on its own after the "kagami" ending (memory "lustro").
=== recall_mirror ===
Chip z białego etui wchodzi gładko, jakby ktoś go do ciebie przyciął.
Kuchnia z oknem na port. Matka kroi rybę i nuci. Szkoła, pierwsza praca, pierwszy kurs dla Kagami.
Wszystko się zgadza. Każda data, każda twarz. Za dobrze, jak w katalogu.
TECH: Zapis kompletny. Nosicielka przyjęła pakiet bez odrzutu.
Nie wiesz, czy ten głos jest częścią wspomnienia, czy ktoś mówi do ciebie teraz.
~ set_flag("recalled:mirror")
-> END

// Flashback from Ren's chip (memory "dach").
=== recall_rooftop ===
Ten sam dach, dwa lata wcześniej. Pada, a pod wami szumi targ.
Ren liczy na palcach pieniądze, których jeszcze nie macie.
REN: Kagami płaci za jeden kurs tyle, co Hebi za rok. Walizka z portu do ich laboratorium i jesteśmy wolni.
REN: Jedziemy razem. Ty prowadzisz, ja siedzę na kanale.
* [Podajesz mu rękę. #tone:main]
    ~ choice_rooftop = "together"
    ~ story_choice("rooftop", "together")
    Ściskasz jego dłoń. Jest mokra i ciepła. Śmiejecie się jak dzieciaki, które coś ukradły ze straganu.
    REN: Ostatni kurs. Potem morze, obiecuję.
* [Mówisz, że pojedziesz sama. #tone:main]
    ~ choice_rooftop = "alone"
    ~ story_choice("rooftop", "alone")
    Mówisz mu, że jeden kurier rzuca się w oczy mniej niż dwóch. To tylko połowa prawdy.
    REN: Jak chcesz. Ale i tak będę na kanale, czy ci się to podoba, czy nie.
- Deszcz przestaje padać w pół kropli. Siedzisz na tym samym dachu, a Ren patrzy na ciebie, jakby czekał na wyrok.
Ciało pamięta ten dach: każdą krawędź, każdy skok na sąsiedni. I to, jak się wstaje po upadku.
~ set_flag("recalled:rooftop")
-> END

// Flashback after Kaito plays the client's message (memory "głos").
=== recall_last_call ===
Głos z nagrania zostaje ci w głowie i ciągnie za sobą inny dźwięk: syk pękniętej chłodnicy.
Wrak na Krakowskim. Wisisz w pasach głową w dół. W uchu dalej masz słuchawkę.
REN: Zapis zakończony. Obiekt nie reaguje.
Głos Rena urywa się, a w słuchawce zostaje ktoś inny, starszy i znudzony.
TECH: Wyłączam filtr Odagiri. Próbka głosu dobrowolna, opłacona z góry. Zbierzcie ją przed świtem.
* [Słuchasz dalej, chociaż boli. #tone:main]
    ~ choice_voice = "listened"
    ~ story_choice("voice", "listened")
    Zapamiętujesz każde słowo. Filtr Odagiri. Próbka dobrowolna. Ren sprzedał im swój głos, zanim wsiadłaś do tego auta.
    Może nie wiedział, do czego go użyją. A może wiedział.
* [Wyrywasz słuchawkę z ucha. #tone:main]
    ~ choice_voice = "torn"
    ~ story_choice("voice", "torn")
    Słuchawka ląduje w kałuży oleju. Wolisz ciszę niż kolejny głos, któremu nie da się ufać.
    Zostaje ci tylko pierwsze zdanie, powiedziane głosem Rena.
- Stoisz przy barze Neon Koi. Kaito patrzy na ciebie i czeka, aż wrócisz.
Ręce przestały drżeć. Teraz wiesz, jak brzmi głos, który ktoś ci podkłada.
~ set_flag("recalled:last_call")
-> END
