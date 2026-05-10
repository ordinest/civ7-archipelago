(function() {
    if (!Game._AP_PROBE) return JSON.stringify({err: "probe not installed"});
    const probe = Game._AP_PROBE;
    const installed = probe.extraInstalled || {};
    const newlyInstalled = [];
    const candidates = [
        "NarrativeStoryStarted",
        "NarrativeStoryUpdated",
        "NarrativeStoryProgressed",
        "NarrativeStoryAdvanced",
        "NarrativeStoryEnded",
        "NarrativeStoryCompleted",
        "NarrativeStoryChoiceMade",
        "NarrativeStoryChoiceSelected",
        "NarrativeStoryRevealed",
        "PlayerStoryRevealed",
        "PlayerStoryUpdated",
        "PlayerStoryStarted",
        "PlayerStoryChosen",
        "PlayerStoryProgressed",
        "PlayerStoryAdvanced",
        "StoryAdvanced",
        "StoryRevealed",
        "StoryUpdated",
        "ChooseNarrativeStoryDirection",
        "DiscoveryRewardSelected",
        "DiscoveryRewardRevealed",
        "DiscoveryChoiceMade",
        "DiscoveryCompleted",
        "DiscoveryFound",
        "RewardSelected",
        "RewardChosen",
        "RewardActivated",
        "PlayerOperationCompleted",
        "OperationCompleted",
        "ActionTaken",
        "PlayerActionTaken"
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
