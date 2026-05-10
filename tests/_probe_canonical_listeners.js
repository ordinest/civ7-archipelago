(function() {
    if (!Game._AP_PROBE) return JSON.stringify({err: "probe not installed"});
    const probe = Game._AP_PROBE;
    const installed = probe.extraInstalled || {};
    const newlyInstalled = [];

    // Canonical event names from gamecore-events.xml
    const candidates = [
        "NotificationActivated",
        "NotificationAdded",
        "NotificationDismissed",
        "NotificationRefreshRequested",
        "NarrativeStateEvent",
        "CityReligionFollowersChanged",
        "NaturalWonderRevealed",
        "WonderCompletedNarrative",
        "NaturalWonderRevealedNarrative",
        "CityProjectCompletedNarrative"
    ];
    for (const name of candidates) {
        if (installed[name]) continue;
        try {
            engine.on(name, function(data) { probe.push(name, data); });
            installed[name] = true;
            newlyInstalled.push(name);
        } catch (e) {
            probe.push("__listener_error__", {event: name, err: String(e)});
        }
    }
    probe.extraInstalled = installed;
    return JSON.stringify({newly_installed: newlyInstalled, count: newlyInstalled.length});
})()
