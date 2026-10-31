// Time of day (ADR-0017). Synced from the domain clock before every conversation.
// game_hour: 0-23. time_of_day: "night", "dawn", "day" or "dusk".

VAR game_hour = 21
VAR time_of_day = "night"

// Oyaji's stall from 22:00 to 8:00: the schedule swaps his interaction for this knot.
=== oyaji_closed ===
{ civilians_stance == "hostile":
    OYAJI: Closed. For you, always closed.
    -> END
}
{ game_hour >= 22 || game_hour < 1:
    OYAJI: Closed, closed. The pots have gone cold, shutter's down.
- else:
    OYAJI: At this hour? The whole market's asleep, only aleja Tysiąclecia never sleeps.
}
OYAJI: Come back after eight, when the shutter's up. We'll talk then.
-> END
