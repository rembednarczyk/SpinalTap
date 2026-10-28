// Seki Senshi, M4: Doki Tessen (ADR-0024).
// Genzō runs boats out of the docks for Kaito's network. He hands out three jobs against Tessen,
// the corporation that owns the port: walking a defector to his boat, copying data from the
// Tessen office unseen, holding a hacked terminal. The domain decides and pays; ink only talks.

// Synced like the other factions' stances before each conversation.
VAR tessen_stance = "neutral"

=== genzo ===
{ fixers_stance == "hostile":
    GENZO: Kaito mówi, żeby z tobą nie gadać. W porcie słucha się Kaito.
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
    GENZO: Port jest ich, woda jest moja. Czasem potrzebuję kogoś na lądzie.
    ~ set_flag("met_genzo")
- else:
    GENZO: Mgła dzisiaj gęsta. Dobra noc na robotę.
}
{ tessen_stance == "hostile":
    GENZO: Ochrona Tessen zna już twoją twarz. Uważaj na dachy, mają tam strzelców.
}
-> offer

= offer
+ [Kogo trzeba przeprowadzić?]
    SEKI: Kogo trzeba przeprowadzić?
    ~ offer_contract("escort")
    GENZO: Mika, księgowa z biura Tessen. Wie za dużo i chce zniknąć. Czeka przy moim kontenerze.
    GENZO: Odprowadź ją na molo, do łodzi. Tessen będzie na nią polować na nabrzeżu, więc trzymaj się blisko.
    -> END
+ [Co trzeba wynieść z biura Tessen?]
    SEKI: Co trzeba wynieść z biura Tessen?
    ~ offer_contract("infiltrate")
    GENZO: Manifesty ładunków, z terminala na biurku. Biuro stoi na nabrzeżu, drzwi od strony dźwigu.
    GENZO: Nikt nie może cię zobaczyć. Jeden alarm i dane znikną, zanim dobiegniesz. Idź nisko i za ich plecami.
    -> END
+ [Który terminal mam złamać?]
    SEKI: Który terminal mam złamać?
    ~ offer_contract("hack")
    GENZO: Terminal portowy pod dźwigiem. Podłączysz się i musisz przy nim wytrzymać, aż skończy.
    GENZO: Ochrona przyjdzie od razu, a na dachu magazynu siedzi strzelec. Czerwony laser znaczy, że masz sekundę na osłonę.
    -> END
+ [Nie teraz.]
    GENZO: Będę przy kontenerze. Łódź nie odpływa bez powodu.
    -> END

= running
{
- contract_kind == "escort":
    GENZO: Mika czeka na ciebie. Nie zostawiaj jej samej na nabrzeżu.
- contract_kind == "infiltrate":
    GENZO: Dane dalej są w biurze. Pamiętaj, nisko i bez hałasu.
- else:
    { contract_time_left > 0:
        GENZO: Terminal jeszcze mieli. Wracaj tam, zostało {contract_time_left} sekund.
    - else:
        GENZO: Terminal pod dźwigiem. Podłącz się i nie odchodź.
    }
}
{ contract_variation != "":
    GENZO: Ludzie z portu mówią tak. {contract_variation}
}
-> END

= payday
{
- contract_kind == "escort":
    GENZO: Mika na pokładzie. Do rana będzie po drugiej stronie zatoki.
- contract_kind == "infiltrate":
    GENZO: Czyste dane i nikt nic nie widział. Kaito się ucieszy.
- else:
    GENZO: Terminal złamany. Przez tydzień moje łodzie będą dla Tessen niewidzialne.
}
~ complete_contract()
GENZO: {contract_reward} eddies. Liczone przy latarni, wszystko się zgadza.
-> offer

= busy
GENZO: Masz już robotę. Skończ ją, a potem wróć do portu.
-> END
