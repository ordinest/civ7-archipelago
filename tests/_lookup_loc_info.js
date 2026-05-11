JSON.stringify({
    pottery: JSON.parse(Game.AP_GetLocationInfo("NODE_TECH_AQ_POTTERY")),
    agriculture_mastery: JSON.parse(Game.AP_GetLocationInfo("MASTERY:NODE_TECH_AQ_AGRICULTURE")),
    pantheon: JSON.parse(Game.AP_GetLocationInfo("Pantheon Founded")),
    wonder1: JSON.parse(Game.AP_GetLocationInfo("Antiquity Wonder Built Slot 1")),
    legacy_military_2: JSON.parse(Game.AP_GetLocationInfo("ANTIQUITY_MILITARY_MILESTONE_2"))
})
