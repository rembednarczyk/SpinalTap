// Seki Senshi, M3: act I of the main thread, "Echo".
// Memory flashbacks (recall_<memory>) open on their own once the quest graph unlocks the memory.
// Each flashback ends with exactly one story choice. The domain keeps it (story_choice) and the
// runtime syncs it back into the choice_* variables before every conversation.

VAR choice_case = ""
VAR choice_name = ""
VAR choice_crash = ""
// The ending the recorded choices lead to, computed by core (resolveEnding).
VAR act1_ending = ""
// The ending actually reached, empty until end_act() was applied.
VAR story_ending = ""

EXTERNAL has_memory(id)
EXTERNAL story_choice(choice, option)
EXTERNAL end_act()

=== recall_courier_case ===
Obraz rwie się jak zły sygnał. Przez sekundę widzisz dwa miejsca naraz.
Rampa za magazynem w porcie. Leje. Na nadgarstku masz kajdanki, a do nich przypiętą walizkę z logo Kagami Biotech.
REN: Jeszcze dwie przecznice i jesteśmy kwita. Nie zaglądaj do środka.
REN: Płacą nam za to, żebyśmy nie wiedzieli, co wieziemy.
Zamek walizki jest tani. Wystarczy paznokieć.
* [Otwierasz walizkę. #tone:main]
    ~ choice_case = "opened"
    ~ story_choice("case", "opened")
    W środku, w gąbce, leżą rzędy chipów pamięci. Na każdym naklejka z imieniem i datą.
    Na jednym widzisz swoje imię. Zanim zdążysz je przeczytać, Ren zatrzaskuje wieko.
    REN: Mówiłem ci. Teraz będziesz o tym myśleć.
* [Zostawiasz zamek w spokoju. #tone:main]
    ~ choice_case = "sealed"
    ~ story_choice("case", "sealed")
    Niesiesz walizkę dalej. Jest lżejsza, niż powinna. Ren klepie cię w ramię.
    REN: Dobra robota. Za takie zlecenie kupimy sobie pół roku spokoju.
- Deszcz, rampa i Ren znikają. Stoisz na Krakowskim Przedmieściu, a ręka sama szuka kajdanek.
Kagami Biotech. Ta nazwa siedzi w głowie jak drzazga. Mori cię składał, więc może wie, skąd to się bierze.
~ set_flag("recalled:courier_case")
-> END

=== recall_operating_table ===
Biała lampa. Inna niż u Mori, większa, z sześcioma soczewkami.
Leżysz przypięta pasami do stołu i nie czujesz nóg. Ktoś w fartuchu z logo Kagami stuka w tablet.
TECH: Zapis czterdziesty pierwszy. Kontrola tożsamości przed nadpisaniem.
TECH: Jak się nazywasz?
* [Mówisz swoje imię. #tone:main]
    ~ choice_name = "spoken"
    ~ story_choice("name", "spoken")
    SEKI: Aya. Nazywam się Aya.
    TECH: Wciąż pamięta. Odnotowuję: nadpisanie numer czterdzieści jeden nieudane.
    Imię zostaje ci w ustach. Aya. Brzmi znajomo, jak adres, pod którym kiedyś mieszkałaś.
* [Milczysz. #tone:main]
    ~ choice_name = "silent"
    ~ story_choice("name", "silent")
    Zaciskasz zęby. Technik czeka chwilę i wzrusza ramionami.
    TECH: Brak odpowiedzi. Odnotowuję: obiekt nie podaje imienia. Przechodzimy do zapisu.
    Nic im nie powiedziałaś. Teraz nie wiesz nawet, czy miałaś co powiedzieć.
- Lampa gaśnie. Siedzisz w fotelu u Mori, a on wyciąga ci igłę zza ucha.
MORI: Przez dwie minuty cię nie było. Mówiłaś coś o zapisach.
MORI: Moduł reaguje na nowy chrom. Jak coś ci wszczepię, może puści więcej.
~ set_flag("recalled:operating_table")
-> END

=== recall_crash_night ===
Nowy implant łapie prąd i coś w głowie przeskakuje jak bezpiecznik.
Noc, mokra obwodnica, sto sześćdziesiąt na liczniku. Prowadzisz cudzy samochód. Na fotelu obok leży przecięta opaska z kodem Kagami.
Nad maską wisi dron i świeci ci reflektorem w oczy.
REN: Słyszysz mnie? Jedź prosto do wiaduktu. Pod nim zgubi sygnał. Nie skręcaj.
Głos w słuchawce brzmi jak Ren. Trochę za spokojnie.
* [Szarpiesz kierownicę w bok. #tone:main]
    ~ choice_crash = "wheel"
    ~ story_choice("crash", "wheel")
    Samochód wchodzi bokiem w barierę. Dron leciał za nisko i uderza w słup razem z tobą.
    Pamiętasz zgrzyt blachy i to, że sama o tym zdecydowałaś.
* [Jedziesz prosto, tak jak mówi. #tone:main]
    ~ choice_crash = "ren"
    ~ story_choice("crash", "ren")
    Wiadukt jest coraz bliżej. Dron schodzi niżej i strzela w opony.
    Ostatnie, co słyszysz przed uderzeniem, to głos Rena: zapis zakończony.
- Stoisz przed kliniką Mori i trzymasz się framugi. Kark masz mokry od potu.
To była ta noc. Wrak na Krakowskim, przy Placu Litewskim. Teraz wiesz, jak trafiłaś na ten deptak.
~ set_flag("recalled:crash_night")
-> END

=== mori ===
{
- quest_step == "ask_mori" && has_flag("recalled:courier_case"): -> module
- quest_step == "decide" && has_flag("recalled:crash_night"): -> decision
- quest_step == "ren_trail": -> ren_trail
- story_ending == "aya": -> after_aya
- story_ending == "seki": -> after_seki
- else: -> small_talk
}

= small_talk
MORI: Coś boli? To dobrze, znaczy, że działa.
{ quest_step == "new_implant":
    MORI: Moduł w twojej głowie budzi się przy nowym chromie. Kup coś, wszczepię i zobaczymy, co wyjdzie.
}
-> END

= module
MORI: Siadaj. Widzę po źrenicach, że coś ci się przypomniało.
SEKI: Walizka z logo Kagami Biotech. I chłopak, Ren. Skąd to się bierze?
MORI: Stąd.
Mori obraca monitor. Na skanie twojej czaszki, tuż za uchem, świeci prostokąt wielkości paznokcia.
MORI: Siedział tam, kiedy cię składałem. Moduł pamięci Kagami, numer seryjny zeszlifowany.
MORI: Nie wiem, co na nim jest. Twoje życie albo czyjeś. Wiem tylko, że im dłużej z nim chodzisz, tym więcej z niego wypływa.
* [Możesz go wyjąć? #tone:main]
    SEKI: Możesz go wyjąć?
    MORI: Mogę. Ale jest wpięty w korę ruchową. Wyjmę go, kiedy będziesz wiedziała, czego chcesz.
* [Skąd mam wiedzieć, że to moje wspomnienia? #tone:main]
    SEKI: Skąd mam wiedzieć, że to moje wspomnienia?
    MORI: Nie masz skąd. Ja też nie. Moduł nie zostawia podpisu.
- MORI: Połóż się. Podłączę diagnostykę i zobaczymy, co z niego wyciągniemy.
Igła wchodzi za ucho. Lampa nad fotelem jest bardzo biała.
~ set_flag("mori_module")
-> END

= decision
MORI: No i? Masz już całość albo tyle, ile da się z tego złożyć.
MORI: Mogę dziś wyjąć moduł. Zostanie ci to, czego nauczyło się ciało. Obrazy znikną w kilka dni.
MORI: Albo go zostawiam i żyjesz z tym, co jeszcze z niego wyjdzie. Prawdziwe czy nie.
{ act1_ending == "aya":
    -> ending_aya
}
-> ending_seki

= ending_aya
{ choice_case == "opened":
    SEKI: W tamtej walizce leżał chip z moim imieniem. Kagami trzyma gdzieś resztę mnie.
}
{ choice_name == "spoken":
    SEKI: Na stole powiedziałam im, jak się nazywam. Czterdzieści jeden razy próbowali to skasować i nie dali rady.
}
{ choice_crash == "wheel":
    SEKI: Z tamtego auta wyszłam, bo sama skręciłam. Tego nikt mi nie nagrał.
}
SEKI: Zostaw go. Wolę wiedzieć za dużo niż nic.
MORI: Twoja głowa. Jak zacznie dymić, wiesz, gdzie mnie szukać.
MORI: To jak mam cię wpisać do kartoteki?
SEKI: Aya.
~ set_alias("Aya")
~ end_act()
Wychodzisz z kliniki. Gdzieś w mieście Kagami trzyma resztę twoich nagrań. Pójdziesz po nie.
-> END

= ending_seki
{ choice_case == "sealed":
    SEKI: Wtedy nie otworzyłam tej walizki. Teraz też nie muszę.
}
{ choice_name == "silent":
    SEKI: Na tym stole nie podałam im imienia. Może nie miałam czego podać.
}
{ choice_crash == "ren":
    SEKI: Głos w słuchawce mówił jak Ren, a skończył jak ich maszyna. Nie wiem, ile z tego jest moje.
}
SEKI: Wyjmij go. Nie chcę żyć z nagraniem, którego nie da się sprawdzić.
MORI: Rozsądnie. Połóż się.
Mori wyjmuje moduł pincetą i wrzuca go do szklanej fiolki. Jest mniejszy, niż myślałaś.
MORI: Zatrzymasz go?
SEKI: Sprzedaj go komuś, kto lubi cudze życie. Ja zostaję Seki.
~ end_act()
Wychodzisz z kliniki lżejsza o kilka gramów. Ręce dalej wiedzą, jak celować, i na razie ci to wystarcza.
-> END

= after_aya
MORI: Aya. Jak głowa? Moduł dalej coś puszcza, czy już się uspokoił?
-> END

// Act II (m3-lustro.ink): after "seki" he sold the module, after "aya" it talks to her.
= ren_trail
{ story_ending == "seki":
    -> sold
}
MORI: Aya. Jak głowa? Moduł dalej coś puszcza, czy już się uspokoił?
* [Ktoś mówi do mnie przez moduł. #tone:main]
    SEKI: Ktoś mówi do mnie przez moduł.
    MORI: Bywa tak, kiedy nadajnik jest blisko i zna częstotliwość Kagami. Ktoś cię szuka i wie, czego szukać.
    MORI: Kto to, nie wiem. Ale babcia Ume wie o tej ulicy więcej niż ja.
* [Nic. Głowa w porządku. #tone:optional]
    SEKI: Nic. Głowa w porządku.
    MORI: Kłamiesz tak samo jak przed operacją. Jak zacznie boleć, wróć.
- -> END

= sold
MORI: Fiolki już nie ma. Domyślam się, że Kaito ci powiedział.
* [Komu sprzedałeś mój moduł? #tone:main]
    SEKI: Komu sprzedałeś mój moduł?
    MORI: Sama kazałaś go sprzedać. Przyszedł chłopak, Ren Odagiri. Zapłacił więcej, niż moduł był wart.
    MORI: Pytał, czy da się go odtworzyć bez nosicielki. Powiedziałem, że tak, ze złączem i odrobiną cierpliwości.
* [Mogłeś mi powiedzieć. #tone:optional]
    SEKI: Mogłeś mi powiedzieć.
    MORI: Mogłem. Ale moduł był już tylko towarem, a ty nie chciałaś go znać.
    MORI: Kupił go Ren Odagiri. Płacił gotówką, której nikt na tej ulicy nie ma.
- MORI: Nocuje na dachu nad targiem pod estakadą. Na schody pożarowe wchodzi od strony straganów.
~ set_flag("ren_trail")
-> END

= after_seki
MORI: Fiolka dalej stoi na półce. Nikt jej nie chce. Ty też nie, prawda?
-> END
