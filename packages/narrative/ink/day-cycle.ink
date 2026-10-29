// Time of day (ADR-0017). Synced from the domain clock before every conversation.
// game_hour: 0-23. time_of_day: "night", "dawn", "day" or "dusk".

VAR game_hour = 21
VAR time_of_day = "night"

// Oyaji's stall from 22:00 to 8:00: the schedule swaps his interaction for this knot.
=== oyaji_closed ===
{ civilians_stance == "hostile":
    OYAJI: Zamknięte. Dla ciebie zawsze zamknięte.
    -> END
}
{ game_hour >= 22 || game_hour < 1:
    OYAJI: Zamknięte, zamknięte. Gary już wystygły, roleta w dół.
- else:
    OYAJI: O tej godzinie? Śpi cały targ, tylko aleja Tysiąclecia nie śpi.
}
OYAJI: Wróć po ósmej, jak podniosę roletę. Wtedy pogadamy.
-> END
