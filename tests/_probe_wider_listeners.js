(function() {
    if (!Game._AP_PROBE) {
        return JSON.stringify({err: "probe not installed"});
    }
    const probe = Game._AP_PROBE;
    const extraCandidates = [
        "GoodyHut",
        "GoodyHutCollected",
        "GoodyHutTriggered",
        "GoodyHutRevealed",
        "DiscoveryUnlocked",
        "DiscoveryCompleted",
        "DiscoveryCollected",
        "ImprovementActivated",
        "ImprovementChanged",
        "ImprovementDestroyed",
        "UnitMoveComplete",
        "UnitMovementComplete",
        "PlayerSettled",
        "ConstructibleAddedToMap",
        "ConstructibleRemovedFromMap",
        "ConstructibleActivated",
        "NarrativeStoryRevealed",
        "ResourceVisibilityChanged",
        "WonderCompleted",
        "WonderBuilt",
        "WonderConstructed",
        "BuildingConstructed",
        "ConstructibleCompleted",
        "ProductionItemCompleted",
        "BeliefAdded",
        "BeliefAdopted",
        "ReligionAdopted",
        "ReligionFounded",
        "AddReformedBelief",
        "AgeAdvanced",
        "PlayerAgeTransitionComplete",
        "TurnBegin",
        "Notification"
    ];
    const installed = probe.extraInstalled || {};
    const newlyInstalled = [];
    for (const name of extraCandidates) {
        if (installed[name]) continue;
        try {
            engine.on(name, function(data) {
                probe.push(name, data);
            });
            installed[name] = true;
            newlyInstalled.push(name);
        } catch (e) {
            probe.push("__listener_error__", {event: name, err: String(e)});
        }
    }
    probe.extraInstalled = installed;
    return JSON.stringify({newly_installed: newlyInstalled, count: newlyInstalled.length});
})()
