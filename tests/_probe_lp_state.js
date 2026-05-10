(function() {
    const out = {};
    try {
        const p = Players.get(GameContext.localPlayerID);
        const lp = p.LegacyPaths;

        // Enabled / completed enumerations
        try {
            out.enabled = lp.getEnabledLegacyPaths ? lp.getEnabledLegacyPaths() : null;
        } catch (e) { out.enabled_err = String(e); }
        try {
            out.completed = lp.getCompletedLegacyPaths ? lp.getCompletedLegacyPaths() : null;
        } catch (e) { out.completed_err = String(e); }

        // Score per path - probe all four Antiquity paths.
        const paths = [
            "LEGACY_PATH_ANTIQUITY_SCIENCE",
            "LEGACY_PATH_ANTIQUITY_MILITARY",
            "LEGACY_PATH_ANTIQUITY_CULTURE",
            "LEGACY_PATH_ANTIQUITY_ECONOMIC"
        ];
        out.scores = {};
        out.rewards = {};
        for (const path of paths) {
            try {
                out.scores[path] = lp.getScore ? lp.getScore(path) : "no_method";
            } catch (e) { out.scores[path] = "err: " + e; }
            try {
                out.rewards[path] = lp.getRewards ? lp.getRewards(path) : "no_method";
            } catch (e) { out.rewards[path] = "err: " + e; }
        }
    } catch (e) {
        out.outer_err = String(e);
    }
    return JSON.stringify(out);
})()
