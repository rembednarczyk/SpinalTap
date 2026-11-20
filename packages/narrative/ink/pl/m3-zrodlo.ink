// Seki Senshi, M3: act III of the main thread, "Źródło" (ADR-0095).
// Starts after act II. The opening and the trail follow the act-II ending (act2_ending): Ume after
// "street", Ren after "hebi", Kurosawa on the Castle after "kagami". The three meet at the archive's
// core by the Trinity Chapel (branch and bottleneck). The act-III ending follows from choice_core;
// end_act3() asks the sim to resolve it, and the epilogue plays on its own afterwards.

VAR choice_core = ""
// The act-III ending actually reached, empty until end_act3() was applied.
VAR act3_ending = ""

EXTERNAL end_act3()

// Plays on its own once act III has started (pendingScene in core).
=== act3_opening ===
{
- act2_ending == "street": -> chips_vanish
- act2_ending == "hebi": -> buyers_gone
}
-> calibration

= chips_vanish
Trzy noce po estakadzie Ume dzwoni do ciebie pierwszy raz w życiu. Mówi cicho, jakby ktoś stał za jej drzwiami.
UME: Pan Sato zniknął. Wczoraj pani Nowak. Oboje dostali chipy z archiwum.
UME: Sąsiedzi widzieli białą furgonetkę bez tablic. Przyjdź, dziecko. Nie przez telefon.
~ set_flag("seen:act3_opening")
-> END

= buyers_gone
Ren pisze w nocy. Bez kropek i przecinków, jak zawsze, kiedy się boi.
REN: trzech kupców Hebi nie odbiera od wczoraj
REN: każda kopia archiwum dzwoni gdzieś w nocy jak zgubiony telefon
REN: przyjdź na dach pokażę ci dokąd
~ set_flag("seen:act3_opening")
-> END

= calibration
Chip z białego etui grzeje się w nocy. Rano na optyce czeka wiadomość z podpisem Kagami Biotech.
KUROSAWA: Pani zapis ma lukę. Dwa dni z dzieciństwa, których nie umiemy odtworzyć.
KUROSAWA: Kalibracja dziś na Zamku. Dziedziniec, przy Kaplicy. Proszę przyjść sama.
Na mapie zapala się wzgórze zamkowe. Nie pamiętasz, żebyś tam kiedyś była. Ale ktoś w tobie pamięta.
~ set_flag("seen:act3_opening")
-> END

// Ume's trail after the "street" ending (diverted to from her knot in m0.ink).
=== zrodlo_ume ===
UME: Siadaj. Herbata jest gorzka, cukru nie ma od tygodnia.
UME: Pan Sato słuchał głosu żony co wieczór. Wczoraj okno było zamknięte, a jego nie ma.
UME: Furgonetka pojechała Zamkową pod górę. Tam, gdzie teraz siedzi Kagami, w starym zamku.
{ choice_crash == "wheel":
    UME: Ty zawsze sama wybierałaś drogę. Wybierz i tę.
}
* [Pójdę na Zamek. #tone:main]
    SEKI: Pójdę na Zamek. Jeśli ich tam trzymają, to archiwum też tam jest.
    UME: Nie dla mnie te twoje walki. Ale wróć. Ktoś musi mi powiedzieć, jak się skończyło.
    ~ set_flag("castle_lead")
    -> END
* [Potrzebuję chwili. #tone:leave]
    SEKI: Potrzebuję chwili.
    UME: Chwila to wszystko, co mają ci ludzie. Nie trać jej za długo.
    -> END

// Ren's trail after the "hebi" ending (diverted to from his knot in m3-lustro.ink).
=== zrodlo_ren ===
REN: Patrz. Każdy chip, który sprzedaliśmy, raz na noc wysyła pakiet. Zawsze pod ten sam adres.
Ren pokazuje ci mapę na dłoni. Kropka pulsuje nad wzgórzem zamkowym, nad Kaplicą.
REN: Kagami niczego nie odzyskuje. Archiwum nigdy od nich nie wyszło. My tylko nosiliśmy kopie.
{ choice_voice == "listened":
    REN: Wiem, o czym myślisz. Tak, mój głos też tam jest. Pewnie w pierwszej szufladzie.
}
* [Idę tam. #tone:main]
    SEKI: Idę tam. Trzeba to wyłączyć u źródła.
    REN: Hebi nie pójdą pod Zamek, za drogo. Ja też nie. Przepraszam.
    ~ set_flag("castle_lead")
    -> END
* [Jeszcze nie teraz. #tone:leave]
    SEKI: Jeszcze nie teraz.
    REN: Każda noc to jeden kupiec mniej. Pamiętaj o tym.
    -> END

// Kurosawa on the Castle's courtyard after the "kagami" ending (present until act III ends).
=== kurosawa_castle ===
{ quest_step == "source_lead":
    -> invite
}
{ quest_step == "chapel" || quest_step == "core_choice":
    KUROSAWA: Archiwistka czeka przy Kaplicy. Nie każmy jej czekać.
    -> END
}
KUROSAWA: Zamek jest dla pani otwarty, przynajmniej na razie.
-> END

= invite
KUROSAWA: Punktualnie. Doceniam.
KUROSAWA: W pani zapisie zgadza się wszystko poza jednym. Dwa dni, kiedy Aya miała siedem lat. Czarna dziura.
KUROSAWA: Nasz rdzeń stoi w Kaplicy Trójcy. Grube mury, freski, zero zasięgu. Idealne miejsce na serwer.
{ choice_job == "taken":
    KUROSAWA: Kaito mówi, że pani zawsze doprowadza sprawy do końca.
}
- (ask)
* [Co będzie, jak znajdziecie te dwa dni? #tone:optional]
    SEKI: Co będzie, jak znajdziecie te dwa dni?
    KUROSAWA: Zapis będzie kompletny. Kompletny zapis można sprzedać. Niekompletny tylko przechować.
    -> ask
* [Prowadź. #tone:main]
    SEKI: Prowadź.
    KUROSAWA: Archiwistka panią podłączy. Ja tu zaczekam.
    ~ set_flag("castle_lead")
    -> END

// The archivist of Kagami at the core by the Trinity Chapel's door (from the trail on).
=== kagami_core ===
{
- act3_ending != "": -> after
- quest_step == "chapel": -> plug_in
- quest_step == "core_choice" && has_flag("recalled:chapel"): -> decide
}
ARCHIWISTKA: Proszę nie dotykać kabli. Rdzeń nie lubi gości.
-> END

= plug_in
{ act2_ending == "kagami":
    ARCHIWISTKA: Pani Seki. Kurosawa uprzedzał. Proszę usiąść, złącze jest zimne.
- else:
    ARCHIWISTKA: Nie strzelaj. Ja tylko pilnuję, żeby się nie przegrzał.
    ARCHIWISTKA: Chcesz zobaczyć, co tu trzymają? Proszę. I tak nikt mnie o zdanie nie pyta.
}
Za drzwiami Kaplicy szumią szafy serwerów, ustawione pod freskami jak ławki. Święci patrzą na diody.
ARCHIWISTKA: Tu jest wszystko. Pięćdziesiąt tysięcy ludzi. I oryginał Ayi, zapis zero tej serii.
ARCHIWISTKA: Każda kopia, którą nosisz w głowie, liczy się od niego. Ty też.
Złącze dotyka karku. Przez chwilę nie ma nic, a potem czujesz zapach wosku i zimny kamień pod kolanami.
~ set_flag("core_reached")
-> END

= decide
ARCHIWISTKA: Znalazłaś te dwa dni. Rdzeń ich nie ma i nigdy mieć nie będzie.
ARCHIWISTKA: Masz uprawnienia oryginału. Możesz z tym zrobić, co chcesz. Ja się odwrócę.
{ act2_ending == "street":
    Ume chodzi od drzwi do drzwi z chipami, a ten rdzeń zabiera ludziom każdy z powrotem.
}
{ act2_ending == "hebi":
    Kupcy Hebi znikają, bo ich kopie dzwonią tutaj. Ren czeka na wiadomość.
}
{ act2_ending == "kagami":
    Kurosawa stoi na dziedzińcu. Wie, że to ty trzymasz teraz klucz, i nic nie może zrobić.
}
- (ask)
* [Co się stanie z ludźmi z archiwum? #tone:optional]
    SEKI: Co się stanie z ludźmi z archiwum?
    ARCHIWISTKA: Jak wymażesz, zostaną z tym, co mają w głowach. Jak wypuścisz, dostaną wszystko naraz.
    -> ask
* [Wymazuję wszystko. Razem z oryginałem. #tone:main]
    ~ choice_core = "erase"
    ~ story_choice("core", "erase")
    SEKI: Wymazuję wszystko. Razem z oryginałem.
    ARCHIWISTKA: Aya zniknie na dobre. Zostaniesz tylko ty.
    SEKI: Zawsze zostawałam tylko ja.
    ~ end_act3()
    Diody gasną szafa po szafie, od ołtarza do drzwi. Freski zostają.
    -> END
* [Wypuszczam archiwum do sieci miasta. #tone:main]
    ~ choice_core = "release"
    ~ story_choice("core", "release")
    SEKI: Wypuść archiwum do sieci miasta. Każdy dostanie swoje.
    ARCHIWISTKA: I cudze. Nie da się tego rozdzielić czysto.
    SEKI: To niech się nauczą żyć z cudzymi. Ja się nauczyłam.
    ~ end_act3()
    Nad Lublinem zapalają się okna, jedno po drugim, jakby całe miasto obudziło się z tego samego snu.
    -> END
* [Zostaję przy rdzeniu. Ja zdecyduję, kto co odzyska. #tone:main]
    ~ choice_core = "keep"
    ~ story_choice("core", "keep")
    SEKI: Zostaję przy rdzeniu. Ja zdecyduję, kto co odzyska.
    ARCHIWISTKA: Tak zaczynał Kurosawa. Powodzenia.
    ~ end_act3()
    Siadasz pod freskiem z aniołem. Złącze na karku jest już ciepłe.
    -> END

= after
{ act3_ending == "keep":
    ARCHIWISTKA: Rdzeń słucha teraz ciebie. Dziwnie się na to patrzy.
- else:
    ARCHIWISTKA: Kaplica znowu jest cicha. Pierwszy raz od lat słyszę, jak skrzypi podłoga.
}
-> END

// Plays on its own after the core's first connection (memory "kaplica").
=== recall_chapel ===
Masz siedem lat. Matka trzyma cię za rękę w Kaplicy Trójcy, a przewodnik mówi, że te freski mają sześćset lat.
Anioł na ścianie ma twarz sąsiadki z trzeciego piętra. Śmiejesz się za głośno, a matka ściska ci dłoń.
W kaplicy nie ma zasięgu. Telefon matki milczy przez dwa dni, kiedy przychodzicie tu znowu i znowu.
Nikt tego nie nagrał i nikt nie poprawił. To jest twoje, cokolwiek o tobie mówią.
~ set_flag("recalled:chapel")
-> END

// Plays on its own once act III has ended: what became of everyone, from the choices of all three acts.
=== act3_epilogue ===
{ act3_ending:
- "erase":
    Tydzień później Kagami zwija biuro na Zamku. Na wzgórzu zostają freski i ślady po szafach na posadzce.
- "release":
    Przez tydzień Lublin śni cudze sny. Na Starym Mieście ktoś płacze na ławce, bo pamięta ślub, którego nie miał.
- "keep":
    Kagami nie zwija biura. Zmienia tylko tabliczkę na drzwiach Kaplicy: „Archiwum. Wstęp za zgodą”.
}
{ act2_ending == "kagami":
    Ren nie wraca z tamtej nocy na dachu. Kurosawa przysyła ci kwiaty, bez bileciku.
- else:
    { choice_rooftop == "together":
        Ren dzwoni znad Wisły. Mówi, że to nie morze, ale na razie wystarczy.
    - else:
        Ren znika z dachu Alchemii. Zostawia plandekę i pustą fiolkę po module.
    }
}
{ act2_ending == "street":
    Ume dalej chodzi od drzwi do drzwi. Teraz ludzie częściej jej otwierają.
- else:
    Ume pyta, czy to już koniec. Mówisz, że tak. Nie wierzy ci, ale nalewa herbaty.
}
{ choice_job == "taken":
    Kaito wypłaca ci premię za zlecenie, którego nie wykonałaś. Mówi, że to za fatygę.
- else:
    Kaito stawia ci sake i o nic nie pyta. Pierwszy raz.
}
{ story_ending == "aya":
    Moduł za uchem milczy. Imię Aya dalej brzmi obco, ale już się na nie odwracasz.
- else:
    Fiolka z modułem leży na półce u Mori. Zostajesz Seki, kobietą z wraku.
}
To koniec wątku głównego. Miasto żyje dalej, a u Kaito czekają zlecenia.
~ set_flag("seen:act3_epilogue")
-> END
