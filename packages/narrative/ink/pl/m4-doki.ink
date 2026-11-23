// Seki Senshi, M4: Nabrzeże Bystrzycy, ex Doki Tessen (ADR-0024, ADR-0042).
// Genzō runs boats on the Bystrzyca for Kaito's network. He hands out jobs against Tessen, whose
// sector W-3 (the drone halls, ADR-0082) fenced the riverside in: copying data from the pass office
// in the control tower unseen, holding a hacked terminal on the quay. Walking a defector to his boat
// is retired with the old container yard till the boats come back. The domain decides and pays; ink only talks.

// Synced like the other factions' stances before each conversation.
VAR tessen_stance = "neutral"

=== genzo ===
{ fixers_stance == "hostile":
    GENZO: Kaito mówi, żeby z tobą nie gadać. Na nabrzeżu słucha się Kaito.
    -> END
}
{
- contract_giver == "genzo" && contract_state == "cleared": -> payday
- contract_giver == "genzo": -> running
- contract_state != "": -> busy
}
-> greeting

= greeting
{ not has_flag("met_genzo"):
    GENZO: Ty od Kaito? Genzō. Pływam nocą, a Tessen płaci ludziom, żeby tego nie widzieli.
    GENZO: Nabrzeże jest ich, Bystrzyca jest moja. Czasem potrzebuję kogoś na lądzie.
    ~ set_flag("met_genzo")
- else:
    GENZO: Mgła znad rzeki dzisiaj gęsta. Dobra noc na robotę.
}
{ has_flag("w3:escort-retired") && not has_flag("w3:escort-retired-told"):
    GENZO: Z Miką na razie nic. Tessen ogrodził plac pod swoje hale dronów. Popłynie wodą, jak będę miał łódź, która im ucieknie.
    ~ set_flag("w3:escort-retired-told")
}
{ tessen_stance == "hostile":
    GENZO: Ochrona Tessen zna już twoją twarz. Uważaj na dachy, mają tam strzelców.
}
-> offer

= offer
+ [Co trzeba wynieść z biura Tessen? #tone:main]
    SEKI: Co trzeba wynieść z biura Tessen?
    ~ offer_contract("infiltrate")
    GENZO: Manifesty ładunków, z terminala na biurku. Biuro przepustek na parterze ich wieży kontrolnej, drzwi od strony hali.
    GENZO: Nikt nie może cię zobaczyć. Jeden alarm i dane znikną, zanim dobiegniesz. Idź nisko i za ich plecami.
    -> END
+ [Który terminal mam złamać? #tone:main]
    SEKI: Który terminal mam złamać?
    ~ offer_contract("hack")
    GENZO: Terminal Tessen na nabrzeżu przy pomoście. Podłączysz się i musisz przy nim wytrzymać, aż skończy.
    GENZO: Ochrona przyjdzie od razu, a na dachu hali nad nabrzeżem siedzi strzelec. Czerwony laser znaczy, że masz sekundę na osłonę.
    -> END
+ {not has_flag("w3:sabotage-offered")} [Co to za partia dronów? #tone:main]
    SEKI: Co to za partia dronów, o której wszyscy szepczą?
    ~ set_flag("w3:sabotage-offered")
    ~ offer_contract("sabotage")
    GENZO: Dwanaście dronów bojowych z hali W-3. Wojsko odbiera je o szóstej rano. Mój klient chce, żeby latały krzywo.
    GENZO: Rdzeń kalibracji stoi w serwerowni N, przy północnym korytarzu. Podłącz to do jego terminala i trzymaj się blisko, aż skończy. Odejdziesz, to zaczeka.
    GENZO: Są dwa wejścia bez strażników. Wylot kolektora pod nabrzeżem: przeczołgasz się nim do piwnicy magazynów, technicy trzymają tam w szatni kombinezony. W takim nikt na linii nie spojrzy na ciebie drugi raz, dopóki broń jest schowana i nie biegasz.
    GENZO: Albo rurociąg nad rzeką na dach rzędu N. Nad serwerownią jest właz, ale dach mają na kamerach, a z wieży patrzy obserwator.
    GENZO: Rdzenia pilnuje kamera, po hali i korytarzu chodzi patrol. Jak podniosą alarm, serwerownie się zamkną. Wyjdź ze strefy niezauważona, to zadzwonię.
    -> END
+ [Nie teraz. #tone:leave]
    GENZO: Będę przy kontenerze. Łódź nie odpływa bez powodu.
    -> END

= running
{
- contract_kind == "escort":
    GENZO: Mika czeka na ciebie. Nie zostawiaj jej samej na nabrzeżu.
- contract_kind == "infiltrate":
    GENZO: Dane dalej są w biurze. Pamiętaj, nisko i bez hałasu.
- contract_kind == "sabotage":
    GENZO: Partia rusza o szóstej. Serwerownia N, terminal rdzenia. Potem ze strefy, i niech nikt cię nie widzi.
- else:
    { contract_time_left > 0:
        GENZO: Terminal jeszcze mieli. Wracaj tam, zostało {contract_time_left} sekund.
    - else:
        GENZO: Terminal na nabrzeżu przy pomoście. Podłącz się i nie odchodź.
    }
}
{ contract_variation != "":
    GENZO: Ludzie z nabrzeża mówią tak. {contract_variation}
}
-> END

= payday
{
- contract_kind == "escort":
    GENZO: Mika na pokładzie. Do rana będzie po drugiej stronie Zalewu Zemborzyckiego.
- contract_kind == "infiltrate":
    GENZO: Czyste dane i nikt nic nie widział. Kaito się ucieszy.
- else:
    GENZO: Terminal złamany. Przez tydzień moje łodzie będą dla Tessen niewidzialne.
}
~ complete_contract()
GENZO: {contract_reward} eddies. Liczone przy latarni, wszystko się zgadza.
-> offer

= busy
GENZO: Masz już robotę. Skończ ją, a potem wróć nad Bystrzycę.
-> END
