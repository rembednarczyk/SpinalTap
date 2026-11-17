// Seki Senshi, M4: Nabrzeże Bystrzycy, ex Doki Tessen (ADR-0024, ADR-0042).
// Genzō runs boats on the Bystrzyca for Kaito's network. He hands out jobs against Tessen, whose
// sector W-3 (the drone halls, ADR-0082) fenced the riverside in: copying data from the pass office
// in the control tower unseen, holding a hacked terminal on the quay. Walking a defector to his boat
// is retired with the old container yard till the boats come back. The domain decides and pays; ink only talks.

// Synced like the other factions' stances before each conversation.
VAR tessen_stance = "neutral"

=== genzo ===
{ fixers_stance == "hostile":
    GENZO: Kaito says not to talk to you. On the riverside, you listen to Kaito.
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
    GENZO: You're Kaito's? Genzō. I run boats at night, and Tessen pays people not to see them.
    GENZO: The riverside is theirs, the Bystrzyca is mine. Sometimes I need someone on dry land.
    ~ set_flag("met_genzo")
- else:
    GENZO: Thick fog off the river tonight. Good night for work.
}
{ has_flag("w3:escort-retired") && not has_flag("w3:escort-retired-told"):
    GENZO: Mika's walk is off. Tessen fenced the yard in for their drone halls. She goes by water, once I have a boat that can outrun them.
    ~ set_flag("w3:escort-retired-told")
}
{ tessen_stance == "hostile":
    GENZO: Tessen security knows your face now. Watch the rooftops, they keep shooters up there.
}
-> offer

= offer
+ [What do I lift from Tessen? #tone:main]
    SEKI: What do I need to lift from the Tessen office?
    ~ offer_contract("infiltrate")
    GENZO: Cargo manifests, off the terminal on the desk. The pass office, ground floor of their control tower, door on the hall side.
    GENZO: Nobody can see you. One alarm and the data's wiped before you get there. Stay low and behind their backs.
    -> END
+ [Which terminal do I crack? #tone:main]
    SEKI: Which terminal do I crack?
    ~ offer_contract("hack")
    GENZO: The Tessen terminal on the quay by the pier. You jack in and hold out next to it until it's done.
    GENZO: Security comes straight away, and there's a shooter on the tower's platform. Red laser means you've got a second to find cover.
    -> END
+ {not has_flag("w3:sabotage-offered")} [What's that batch of drones? #tone:main]
    SEKI: What's that batch of drones everyone's whispering about?
    ~ set_flag("w3:sabotage-offered")
    ~ offer_contract("sabotage")
    GENZO: Twelve combat drones from the W-3 hall. The army collects them at six in the morning. A client of mine wants them to fly wrong.
    GENZO: The calibration core is in server room N, off the north corridor. Plug this in at its terminal and stay close until it's done. Walk away and it waits for you.
    GENZO: Two ways in nobody watches. The culvert mouth under the quay: crawl it into the stores' basement, the techs keep their overalls in the locker room down there. In those the line won't look at you twice, as long as your gun stays away and you don't run.
    GENZO: Or the pipes over the river onto row N's roof. There's a hatch over the server room.
    GENZO: A camera watches the core, a patrol walks the hall and the corridor. If they raise the alarm, the server rooms lock down. Get out of the zone unseen and I'll call.
    -> END
+ [Not now. #tone:leave]
    GENZO: I'll be by the container. The boat doesn't leave without a reason.
    -> END

= running
{
- contract_kind == "escort":
    GENZO: Mika's waiting for you. Don't leave her alone on the riverside.
- contract_kind == "infiltrate":
    GENZO: The data's still in the office. Remember, low and quiet.
- contract_kind == "sabotage":
    GENZO: The batch leaves at six. Server room N, the core's terminal. Then out of the zone, and nobody sees you.
- else:
    { contract_time_left > 0:
        GENZO: The terminal's still grinding. Get back there, {contract_time_left} seconds left.
    - else:
        GENZO: The terminal on the quay by the pier. Jack in and don't walk away.
    }
}
{ contract_variation != "":
    GENZO: The riverside folks say this. {contract_variation}
}
-> END

= payday
{
- contract_kind == "escort":
    GENZO: Mika's on board. By morning she'll be across Zalew Zemborzycki.
- contract_kind == "infiltrate":
    GENZO: Clean data and nobody saw a thing. Kaito will be pleased.
- else:
    GENZO: Terminal cracked. For a week my boats are invisible to Tessen.
}
~ complete_contract()
GENZO: {contract_reward} eddies. Counted under the lamp, it all adds up.
-> offer

= busy
GENZO: You've already got a job. Finish it, then come back to the Bystrzyca.
-> END
