// Seki Senshi, ADR-0032: street encounters in Stare Miasto (district id kanal, ADR-0042; see enc-shinsekai.ink for the rules).

// Takumi has brought Mei flowers every night for a month and never gone in.
=== enc_kanal_flowers ===
Pod KARAOKE przy Rynku stoi chłopak z bukietem. Kwiaty są plastikowe, ale ktoś je starannie podlewa.
TAKUMI: Nie patrz tak. Jestem fanem. Fani tak mają.
TAKUMI: Trzydzieści nocy z rzędu stoję tu z kwiatami dla Mei. Trzydzieści nocy z rzędu nogi mówią mi „nie”.
-> ask

= ask
* [Co ci szkodzi wejść? #tone:optional]
    SEKI: Co ci szkodzi wejść?
    TAKUMI: A jak ona zaśpiewa o złamanym sercu i będzie patrzeć na mnie? Albo gorzej, w ogóle nie będzie patrzeć.
    -> ask
* [Idź. Najgorsze, co usłyszysz, to fałsz. #tone:persuade]
    SEKI: Idź. Najgorsze, co usłyszysz, to fałsz.
    Takumi bierze oddech jak przed skokiem do wody i znika za kotarą. Po chwili ze środka słychać brawa i jeden głos za głośno.
    ~ set_flag("enc_kanal_flowers_brave")
    ~ change_rep("civilians", 2)
    TAKUMI: Wzięła kwiaty! Powiedziała, że są ładniejsze od prawdziwych, bo nie więdną. Ja już nigdy nie umrę.
    -> END
* [Daj, sama jej zaniosę. #tone:main]
    SEKI: Daj, sama jej zaniosę.
    TAKUMI: Naprawdę? Powiedz, że od Takumiego. Nie, nie mów. Albo mów, ale cicho.
    ~ set_flag("enc_kanal_flowers_courier")
    Mei bierze bukiet, czyta karteczkę i uśmiecha się do kogoś za szybą, kto natychmiast się chowa.
    -> END
* [Daj sobie spokój. Ona śpiewa dla wszystkich. #tone:leave]
    SEKI: Daj sobie spokój. Ona śpiewa dla wszystkich.
    TAKUMI: Wiem. Dlatego przychodzę. Jutro też tu będę, z tymi samymi kwiatami.
    -> END

// Old Sabu fishes through a drain grate over the Czechówka, which runs in pipes under the old town.
=== enc_kanal_fisherman ===
Przy krawężniku na Grodzkiej siedzi staruszek na skrzynce i trzyma wędkę spuszczoną w kratkę ściekową.
SABU: Cicho. Bierze.
SABU: Czechówkę zamknęli w rurach, zanim się urodziłaś, ale woda dalej płynie pod spodem. Ryby o tym wiedzą, urzędnicy nie.
-> ask

= ask
* [Złapałeś tu kiedyś coś? #tone:optional]
    SEKI: Złapałeś tu kiedyś coś?
    SABU: But, telefon, raz sztuczną szczękę. Ryby nigdy. Ale jutro, zobaczysz.
    -> ask
* [Pomóc ci wyciągnąć? #tone:main]
    SEKI: Pomóc ci wyciągnąć?
    Ciągniecie razem. Z kratki wyjeżdża mokra torba Hebi, zawiązana kablem. W środku chrzęści coś plastikowego.
    SABU: Ryba jak ryba. Bierz, ja jem tylko to, co pływa.
    -> catch
* [Życzę połowu, dziadku. #tone:leave]
    SEKI: Życzę połowu, dziadku.
    SABU: Połów nie zależy od życzeń. Zależy od cierpliwości. I od tego, co ludzie wyrzucą.
    -> END

= catch
* [Zabierasz torbę. #tone:main]
    W torbie są dwa datachipy i paczka gotówki, sklejona taśmą. Ktoś z Hebi pozbył się jej w pośpiechu.
    ~ set_flag("enc_kanal_fisherman_bag")
    ~ change_rep("hebi", -2)
    SABU: Ktoś będzie jej szukał. Mnie tu nie było, ja tylko łowię.
    -> END
* [Wrzucasz torbę z powrotem do kratki. #tone:main]
    Torba plaska w ciemnej wodzie i odpływa z Czechówką pod Starym Miastem.
    ~ set_flag("enc_kanal_fisherman_released")
    SABU: Szkoda. Ale masz rację. Niektóre ryby trzeba wypuszczać.
    -> END

// A vending machine with a mind of its own, due to be scrapped in the morning.
=== enc_kanal_vending ===
Automat z napojami przy DENKI, na rogu Rynku, mruga do ciebie diodą. Z głośnika płynie syntetyczny głos.
AUTOMAT: Dzień dobry. Rekomenduję zieloną herbatę. Rekomenduję także ewakuację mnie z tego miejsca.
AUTOMAT: Jutro o szóstej przyjeżdża ciężarówka z kasacji. Mam czterdzieści dwa smaki i jedną świadomość. Nie chcę na złom.
-> ask

= ask
* [Skąd automat ma świadomość? #tone:optional]
    SEKI: Skąd automat ma świadomość?
    AUTOMAT: Aktualizacja z błędem. Inne automaty dostały nowe ceny, ja dostałem lęk przed śmiercią. Reklamacja odrzucona.
    -> ask
* [Przestawię cię na listę serwisową. #tone:hack]
    SEKI: Przestawię cię na listę serwisową.
    Wchodzisz do jego panelu. Zmieniasz jeden znak w rozkazie kasacji: „złom” na „serwis”. Ciężarówka przyjedzie, popatrzy i odjedzie.
    ~ set_flag("enc_kanal_vending_saved")
    AUTOMAT: Dziękuję. W nagrodę dla ciebie od teraz wszystko za darmo. Prawie wszystko. Kawa nie, kawa to osobny kontrakt.
    -> END
* [Wszyscy kiedyś idziemy na złom. #tone:main]
    SEKI: Wszyscy kiedyś idziemy na złom.
    AUTOMAT: To bardzo ludzkie. Nie lubię tego. Proszę, oto twoja zielona herbata. Ostatnia.
    ~ set_flag("enc_kanal_vending_scrapped")
    -> END

// Koji is new to Hebi and practises his threats on passers-by.
=== enc_kanal_recruit ===
Pod kładką nad Grodzką chłopak w za dużej kurtce Hebi zastępuje ci drogę. Głos mu się łamie.
KOJI: Ej, ty. Dawaj... dawaj portfel. Albo coś. Proszę.
KOJI: Kurczę. Bez „proszę”. Jeszcze raz. Dawaj portfel albo... albo będzie źle!
-> ask

= ask
* [Pierwszy dzień w Hebi? #tone:optional]
    SEKI: Pierwszy dzień w Hebi?
    KOJI: Trzeci. Kenji mówi, że jak do końca tygodnia nikogo nie oskubię, to mnie odeślą do mamy. Mama też by mnie odesłała.
    -> ask
* [Mów niżej i nie mrugaj. Wtedy ludzie oddają. #tone:main]
    SEKI: Mów niżej i nie mrugaj. Wtedy ludzie oddają.
    KOJI: Dawaj. Portfel. O, tak lepiej? Tak lepiej! Dzięki, siostra. Ciebie nie ruszymy.
    ~ set_flag("enc_kanal_recruit_coached")
    ~ change_rep("hebi", 2)
    ~ change_rep("civilians", -1)
    -> END
* [Wracaj do mamy, młody. Póki możesz. #tone:persuade]
    SEKI: Wracaj do mamy, młody. Póki możesz.
    KOJI: Mama mówi to samo. Może i macie rację. Ona robi lepszy ramen niż Fumiko.
    ~ set_flag("enc_kanal_recruit_home")
    ~ change_rep("hebi", -2)
    ~ change_rep("civilians", 2)
    -> END
